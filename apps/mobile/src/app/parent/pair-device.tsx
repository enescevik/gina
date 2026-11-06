import { useEffect, useRef, useState, type ReactNode } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Tablet, Users } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InfoCard, ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { PairingSteps } from "@/components/device/pairing-steps";
import { clearPairingCode, usePendingPairing } from "@/components/device/pending-pairing";
import { supabase } from "@/lib/supabase";

const expiredError = (error: unknown) => /invalid_or_expired_code/.test(String((error as { message?: string } | null)?.message ?? ""));
type Preview = { status: "ok"; device_name: string; family_name: string | null; seconds_left: number } | { status: "invalid_or_expired" };
// Generated database types predate the C06 preview RPC.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * The single parent-side pairing screen (menu, QR link and post-sign-in hand-off all land here).
 * Code → server preview (device name + receiving family, nothing consumed) → explicit confirm →
 * device access settings. A code kept from a signed-out QR scan is never paired automatically.
 */
export default function PairDeviceScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ code?: string; resume?: string }>();
  const linkCode = typeof params.code === "string" && /^\d{6}$/.test(params.code) ? params.code : null;
  const resume = params.resume === "1";
  const pending = usePendingPairing();
  // Typed input wins; otherwise the code comes from the QR link or the code kept before sign-in.
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? linkCode ?? (resume ? pending?.code ?? "" : "");
  const source: "qr" | "resume" | "manual" = typed !== null ? "manual" : linkCode ? "qr" : resume ? "resume" : "manual";
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const sending = useRef(false);
  const started = useRef(false);

  const inspect = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await rpc("preview_device_pairing", { p_code: value });
      if (error) throw error;
      return data as Preview;
    },
    onSuccess: (result) => {
      if (result.status === "ok") { setDeadline(Date.now() + result.seconds_left * 1000); setRemaining(result.seconds_left); }
      else { setDeadline(null); void clearPairingCode(); }
    },
  });
  const pair = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await supabase.rpc("pair_child_device", { p_code: value });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (deviceId) => {
      void clearPairingCode();
      void qc.invalidateQueries({ queryKey: ["devices"] });
      if (deviceId) router.replace({ pathname: "/parent/device-access", params: { deviceId } });
    },
    onError: (error) => { if (expiredError(error)) { setDeadline(null); void clearPairingCode(); } },
    onSettled: () => { sending.current = false; },
  });

  // QR (signed in) or a code kept from before sign-in: show the target right away, never pair.
  useEffect(() => {
    if (started.current) return;
    if (linkCode) { started.current = true; void clearPairingCode(); inspect.mutate(linkCode); return; }
    if (resume && pending) { started.current = true; inspect.mutate(pending.code); }
    if (resume && pending === null) started.current = true;
  }, [linkCode, resume, pending, inspect]);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) void clearPairingCode();
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const preview = inspect.data?.status === "ok" ? inspect.data : null;
  const timedOut = !!preview && !!deadline && remaining === 0;
  const invalid = inspect.data?.status === "invalid_or_expired" || expiredError(pair.error) || timedOut;
  const lostResume = resume && !linkCode && pending === null && !inspect.data && !inspect.isPending && source === "resume";
  const valid = /^\d{6}$/.test(code);
  const busy = inspect.isPending || pair.isPending;
  const reset = () => { inspect.reset(); pair.reset(); setDeadline(null); };
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/parent/menu?section=devices"));

  return (
    <ParentScreen title={t("u02.parentPair.title")} subtitle={t("u02.parentPair.body")}>
      <PairingSteps current={3} />
      {source !== "manual" && !invalid && !lostResume ? (
        <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t(source === "resume" ? "c06.pair.resumed" : "u02.parentPair.fromQr")}</Text>
      ) : null}
      {lostResume ? <InfoCard title={t("c06.pair.lostTitle")} body={t("c06.pair.lostBody")} /> : null}

      {preview && !timedOut && !pair.isSuccess ? (
        <View testID="pairing-target" accessibilityLiveRegion="polite" style={[parentStyles.card, { gap: 14, borderColor: "#A89BD4" }]}>
          <Text accessibilityRole="header" style={parentStyles.title}>{t("c06.pair.targetTitle")}</Text>
          <Target icon={<Tablet size={22} color="#6042DE" />} label={t("c06.pair.device")} value={preview.device_name} />
          <Target icon={<Users size={22} color="#6042DE" />} label={t("c06.pair.family")} value={preview.family_name ?? "—"} />
          <Text style={parentStyles.muted}>{t("c06.pair.checkDevice")}</Text>
          <Text style={parentStyles.muted}>{t("accountV5.codeRemaining", { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` })}</Text>
          <ErrorText error={expiredError(pair.error) ? null : pair.error} />
          <Button
            title={t("u02.parentPair.confirm")}
            loading={pair.isPending}
            disabled={busy}
            onPress={() => {
              if (sending.current || busy) return;
              sending.current = true;
              pair.mutate(code);
            }}
          />
          <Button variant="ghost" title={t("c06.pair.notThis")} disabled={pair.isPending} onPress={() => { void clearPairingCode(); reset(); setTyped(""); }} />
          <Text style={parentStyles.muted}>{t("u02.parentPair.next")}</Text>
        </View>
      ) : (
        <>
          <InfoCard title={t("u02.parentPair.cameraTitle")} body={t("u02.parentPair.cameraBody")} />
          <Field
            label={t("unified.pairCode")}
            keyboardType="number-pad"
            autoComplete="off"
            maxLength={6}
            editable={!busy}
            value={code}
            onChangeText={(v) => { setTyped(v.replace(/\D/g, "").slice(0, 6)); reset(); }}
          />
          {invalid
            ? <InfoCard title={t("u02.parentPair.expiredTitle")} body={t("u02.parentPair.expiredBody")} />
            : <ErrorText error={inspect.error} />}
          <Button
            title={t("c06.pair.show")}
            disabled={!valid || busy}
            loading={inspect.isPending}
            onPress={() => { if (valid && !busy) { reset(); inspect.mutate(code); } }}
          />
          <Text style={parentStyles.muted}>{t("c06.pair.previewFirst")}</Text>
        </>
      )}
      <Button variant="ghost" title={t("common.cancel")} disabled={pair.isPending} onPress={() => { void clearPairingCode(); leave(); }} />
    </ParentScreen>
  );
}

function Target({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2EDFF", alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[parentStyles.muted, { fontSize: 14 }]}>{label}</Text>
        <Text style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{value}</Text>
      </View>
    </View>
  );
}
