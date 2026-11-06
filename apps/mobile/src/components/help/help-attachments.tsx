import { useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { p, SatinButton, u } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;
type Listed = { id: string; mime: string; bytes: number; width: number | null; height: number | null; created_at: string; mine: boolean };
type Crop = "none" | "top" | "bottom";
type Draft = { source: string; width: number; height: number; crop: Crop; preview: string; data: string; outWidth: number; outHeight: number };

const MAX_SIDE = 1280;
const MAX_BYTES = 600000;
const STRIP = 0.14;

/** Re-encode on the device: drops EXIF/location, scales down, optionally cuts the top/bottom strip (names, clock, bars). */
async function render(source: string, width: number, height: number, crop: Crop) {
  const context = ImageManipulator.manipulate(source);
  if (crop !== "none") {
    const cut = Math.round(height * STRIP);
    context.crop({ originX: 0, originY: crop === "top" ? cut : 0, width, height: height - cut });
  }
  const h = crop === "none" ? height : height - Math.round(height * STRIP);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, h));
  if (scale < 1) context.resize({ width: Math.round(width * scale), height: Math.round(h * scale) });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) throw new Error("help_attachment_failed");
  return { data: saved.base64, preview: `data:image/jpeg;base64,${saved.base64}`, outWidth: saved.width, outHeight: saved.height };
}

/**
 * C03/U07: optional image on a help request, personal data hidden by the parent before sending.
 * Nothing is uploaded on pick: the parent sees the processed copy, can cut the top or bottom strip
 * and must confirm that no personal information shows. Retries reuse the same ids (no duplicate).
 */
export function HelpAttachments({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const ids = useRef<{ data: string; request: string; attachment: string } | null>(null);
  const listed = useQuery({
    queryKey: ["help_attachments", ticketId],
    queryFn: async () => {
      const { data, error } = await rpc("list_help_attachments", { p_ticket_id: ticketId });
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? (data as Listed[]) : [];
    },
  });
  const image = useQuery({
    queryKey: ["help_attachment", opened],
    enabled: !!opened,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await rpc("get_help_attachment", { p_attachment_id: opened });
      if (error) throw new Error(error.message);
      const row = data as { mime: string; data: string };
      return `data:${row.mime};base64,${row.data}`;
    },
  });

  const pick = async () => {
    setMessage(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, allowsEditing: true, exif: false, quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      const out = await render(asset.uri, asset.width, asset.height, "none");
      setDraft({ source: asset.uri, width: asset.width, height: asset.height, crop: "none", ...out });
      setConfirmed(false);
    } catch { setMessage(t("c03.help.attachError")); }
    finally { setBusy(false); }
  };
  const recrop = async (crop: Crop) => {
    if (!draft) return;
    setBusy(true);
    try {
      const out = await render(draft.source, draft.width, draft.height, crop);
      setDraft({ ...draft, crop, ...out });
      setConfirmed(false);
    } catch { setMessage(t("c03.help.attachError")); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!draft || !confirmed || busy) return;
    if (draft.data.length * 0.75 > MAX_BYTES) { setMessage(t("c03.help.attachTooLarge")); return; }
    if (ids.current?.data !== draft.data) ids.current = { data: draft.data, request: randomUUID(), attachment: randomUUID() };
    setBusy(true); setMessage(null);
    try {
      const { error } = await rpc("add_help_attachment", {
        p_request_id: ids.current.request, p_ticket_id: ticketId, p_attachment_id: ids.current.attachment,
        p_mime: "image/jpeg", p_data: draft.data, p_width: draft.outWidth, p_height: draft.outHeight,
        p_redaction: { confirmed_no_personal_data: true, metadata_removed: true, cropped: draft.crop !== "none" },
      });
      if (error) throw new Error(error.message);
      ids.current = null;
      setDraft(null); setConfirmed(false); setMessage(t("c03.help.attached"));
      await cache.invalidateQueries({ queryKey: ["help_attachments", ticketId] });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMessage(t(code === "help_attachment_limit" ? "c03.help.attachLimit" : code === "help_attachment_too_large" ? "c03.help.attachTooLarge"
        : code === "help_reopen_required" ? "c03.help.attachClosed" : "c03.help.attachError"));
    } finally { setBusy(false); }
  };

  const rows = listed.data ?? [];
  return (
    <View testID="help-attachments" style={{ gap: 8 }}>
      {rows.length ? <Text style={u.bold}>{t("c03.help.attachments", { count: rows.length })}</Text> : null}
      {rows.map((row, i) => (
        <View key={row.id} style={{ gap: 6 }}>
          <Pressable accessibilityRole="button" onPress={() => setOpened(opened === row.id ? null : row.id)} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={[u.bold, { color: p.purple }]}>{t("c03.help.attachmentLabel", { n: i + 1 })} · {t("c03.help.openAttachment")}</Text>
          </Pressable>
          {opened === row.id && image.data ? (
            <Image accessibilityLabel={t("c03.help.attachmentLabel", { n: i + 1 })} source={{ uri: image.data }}
              style={{ width: "100%", aspectRatio: row.width && row.height ? row.width / row.height : 1, borderRadius: 12 }} resizeMode="contain" />
          ) : null}
        </View>
      ))}
      {closed || rows.length >= 3 ? null : draft ? (
        <View testID="help-attachment-draft" style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: p.line, backgroundColor: "#FFFFFF" }}>
          <Text style={u.small}>{t("c03.help.attachHelp")}</Text>
          <Image accessibilityIgnoresInvertColors source={{ uri: draft.preview }} style={{ width: "100%", aspectRatio: draft.outWidth / draft.outHeight, borderRadius: 12 }} resizeMode="contain" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SatinButton secondary title={t("c03.help.cropTop")} selected={draft.crop === "top"} disabled={busy} onPress={() => void recrop("top")} />
            <SatinButton secondary title={t("c03.help.cropBottom")} selected={draft.crop === "bottom"} disabled={busy} onPress={() => void recrop("bottom")} />
            {draft.crop !== "none" ? <SatinButton secondary title={t("c03.help.cropReset")} disabled={busy} onPress={() => void recrop("none")} /> : null}
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} aria-checked={confirmed} onPress={() => setConfirmed(!confirmed)}
            style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: p.purple, backgroundColor: confirmed ? p.purple : "#FFFFFF" }} />
            <Text style={[u.bold, { flex: 1 }]}>{t("c03.help.confirm")}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SatinButton title={t("c03.help.send")} busy={busy} disabled={!confirmed} onPress={() => void send()} />
            <SatinButton secondary title={t("c03.help.remove")} disabled={busy} onPress={() => { setDraft(null); setConfirmed(false); }} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <SatinButton secondary title={t("c03.help.attach")} busy={busy} onPress={() => void pick()} />
          <Text style={u.small}>{t("c03.help.attachHelp")}</Text>
        </View>
      )}
      {message ? <Text accessibilityLiveRegion="polite" style={u.small}>{message}</Text> : null}
    </View>
  );
}
