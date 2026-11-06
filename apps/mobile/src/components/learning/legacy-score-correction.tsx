import { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { X } from "lucide-react-native";
import { z } from "zod";
import {
  type LegacyZeroApplyResult,
  legacyZeroApplyResultSchema,
  legacyZeroImpact,
  legacyZeroItemSchema,
  legacyZeroPreviewSchema,
  legacyZeroSelectable,
} from "@gina/core";
import { NOTEBOOK_MODAL_PROPS } from "@/components/learning/notebook-layout";
import { IconButton, p, SatinButton, u } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { Toggle } from "@/components/ui/toggle";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * C01 UI — P04 öncesi otomatik sıfır puanların veli onaylı düzeltmesi.
 * `preview_legacy_open_zero_corrections` (yazmaz) → veli seçer ve açıkça onaylar →
 * `apply_legacy_open_zero_corrections` (aynı istek kimliği aynı sonucu döner) → `get_legacy_open_zero_corrections`
 * denetim izi. Yalnız deneme toplamları yeniden hesaplanır; verilmiş puan/cevap/rapor değişmez (sunucu sözleşmesi).
 * Giriş bağlantısı yalnız etkilenen deneme veya geçmiş varsa görünür.
 */
const auditSchema = z.array(z.object({
  attempt_id: z.uuid(),
  before: z.object({ score_pct: z.number().nullable() }),
  after: z.object({ score_pct: z.number().nullable() }),
  items: z.array(legacyZeroItemSchema),
  applied_role: z.enum(["parent", "admin"]),
  applied_at: z.string(),
}));
type Rpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as Rpc).rpc(fn, args);
const knownErrors = ["request_conflict", "forbidden"];

function useLegacyData(family: string, open: boolean) {
  const preview = useQuery({
    queryKey: ["legacy_zero_preview", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await rpc("preview_legacy_open_zero_corrections");
      if (error) throw error;
      return legacyZeroPreviewSchema.parse(data);
    },
  });
  const audit = useQuery({
    queryKey: ["legacy_zero_audit", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await rpc("get_legacy_open_zero_corrections");
      if (error) throw error;
      return auditSchema.parse(data);
    },
  });
  // Adlar için yalnız açıkken: çocuk adı ve deneme başlığı (kimlik gösterilmez).
  const attemptIds = [
    ...(preview.data?.attempts.map((a) => a.attempt_id) ?? []),
    ...(audit.data?.map((a) => a.attempt_id) ?? []),
  ];
  const names = useQuery({
    queryKey: ["legacy_zero_names", family, [...attemptIds].sort().join(",")],
    enabled: open && attemptIds.length > 0,
    queryFn: async () => {
      const [attempts, children] = await Promise.all([
        supabase.from("exam_attempts").select("id,exam_id,child_id").in(
          "id",
          attemptIds,
        ),
        supabase.from("children").select("id,name"),
      ]);
      if (attempts.error) throw attempts.error;
      if (children.error) throw children.error;
      const exams = await supabase.from("exams").select("id,title").in(
        "id",
        [...new Set(attempts.data.map((a) => a.exam_id))],
      );
      if (exams.error) throw exams.error;
      const child = new Map(children.data.map((c) => [c.id, c.name]));
      const exam = new Map(exams.data.map((e) => [e.id, e.title]));
      return new Map(
        attempts.data.map((a) => [a.id, {
          child: child.get(a.child_id) ?? "",
          exam: exam.get(a.exam_id) ?? "",
        }]),
      );
    },
  });
  return { preview, audit, names };
}

export function LegacyScoreCorrectionEntry() {
  const { t } = useTranslation(),
    { claims } = useSession(),
    family = claims?.family_id ?? "";
  const [open, setOpen] = useState(false);
  const data = useLegacyData(family, open);
  const count = data.preview.data?.attempts.length ?? 0;
  const history = data.audit.data?.length ?? 0;
  if (!count && !history) return null;
  return (
    <>
      <Pressable
        testID="legacy-zero-entry"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={u.link}
      >
        <Text style={u.linkText}>
          {count
            ? t("c01ui.legacy.entry", { count })
            : t("c01ui.legacy.entryHistory")}
        </Text>
      </Pressable>
      {open
        ? (
          <LegacyScoreCorrection
            family={family}
            data={data}
            onClose={() => setOpen(false)}
          />
        )
        : null}
    </>
  );
}

function LegacyScoreCorrection(
  { family, data, onClose }: {
    family: string;
    data: ReturnType<typeof useLegacyData>;
    onClose: () => void;
  },
) {
  const { t, i18n } = useTranslation(),
    cache = useQueryClient();
  const { preview, audit, names } = data;
  const [picked, setPicked] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    // Aynı seçim için aynı istek kimliği: yanıt kaybolursa yeniden gönderim iki kez uygulanmaz.
    [request, setRequest] = useState<{ id: string; ids: string[] } | null>(
      null,
    ),
    [result, setResult] = useState<LegacyZeroApplyResult | null>(null);
  const selectable = preview.data ? legacyZeroSelectable(preview.data) : [];
  const chosen = picked.filter((id) => selectable.includes(id)).sort();
  const date = (v: string | null) =>
    v ? new Date(v).toLocaleDateString(i18n.language) : "—";
  const pct = (v: number | null | undefined) =>
    typeof v === "number"
      ? t("c01ui.legacy.pct", { value: v })
      : t("c01ui.legacy.scoreNone");
  const label = (attempt: string) => names.data?.get(attempt);
  const apply = useMutation({
    mutationFn: async (retry: boolean) => {
      const same = request &&
        JSON.stringify(request.ids) === JSON.stringify(chosen);
      const command = retry && request
        ? request
        : same
        ? request!
        : { id: randomUUID(), ids: chosen };
      setRequest(command);
      const { data, error } = await rpc("apply_legacy_open_zero_corrections", {
        p_request_id: command.id,
        p_attempt_ids: command.ids,
      });
      if (error) throw Error(error.message);
      return legacyZeroApplyResultSchema.parse(data);
    },
    onSuccess: async (value) => {
      setResult(value);
      setPicked([]);
      setConfirmed(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["legacy_zero_preview", family] }),
        cache.invalidateQueries({ queryKey: ["legacy_zero_audit", family] }),
        cache.invalidateQueries({ queryKey: ["learning_progress", family] }),
      ]);
    },
  });
  const failure = apply.error
    ? knownErrors.includes(apply.error.message)
      ? apply.error.message
      : "unknown"
    : null;
  return (
    <Modal
      {...NOTEBOOK_MODAL_PROPS}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#20195166",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          testID="legacy-zero-sheet"
          style={{
            maxHeight: "95%",
            maxWidth: 640,
            width: "100%",
            alignSelf: "center",
            backgroundColor: p.cream,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
            <View style={[u.row, { justifyContent: "space-between" }]}>
              <Text
                accessibilityRole="header"
                style={[u.heading, { flex: 1 }]}
              >
                {t("c01ui.legacy.title")}
              </Text>
              <IconButton label={t("common.close")} onPress={onClose}>
                <X color={p.ink} />
              </IconButton>
            </View>
            <Text style={u.copy}>{t("c01ui.legacy.intro")}</Text>
            <View
              testID="legacy-zero-keeps"
              style={[u.card, { backgroundColor: p.mint }]}
            >
              <Text style={u.bold}>{t("c01ui.legacy.keeps")}</Text>
            </View>
            {preview.isError || audit.isError || names.isError
              ? (
                <View>
                  <Text accessibilityRole="alert" style={u.error}>
                    {t("c01ui.legacy.loadError")}
                  </Text>
                  <SatinButton
                    secondary
                    title={t("common.retry")}
                    onPress={() => {
                      void preview.refetch();
                      void audit.refetch();
                      void names.refetch();
                    }}
                  />
                </View>
              )
              : null}
            {preview.isPending
              ? <Text style={u.copy}>{t("common.loading")}</Text>
              : null}
            {result
              ? (
                <View
                  testID="legacy-zero-result"
                  accessibilityLiveRegion="polite"
                  style={[u.card, { backgroundColor: p.lilac }]}
                >
                  <Text style={u.bold}>
                    {t("c01ui.legacy.done", { count: result.corrected })}
                  </Text>
                  {result.results.map((r) => (
                    <Text key={r.attempt_id} style={u.copy}>
                      {label(r.attempt_id)?.exam ?? ""} ·{" "}
                      {t(`c01ui.legacy.result.${r.result}`)}
                    </Text>
                  ))}
                </View>
              )
              : null}
            {preview.data && preview.data.attempts.length === 0
              ? <Text style={u.copy}>{t("c01ui.legacy.none")}</Text>
              : null}
            {preview.data?.attempts.map((a) => {
              const impact = legacyZeroImpact(a), name = label(a.attempt_id);
              return (
                <View
                  key={a.attempt_id}
                  testID="legacy-zero-attempt"
                  style={[u.card, { gap: 6 }]}
                >
                  <Text style={u.bold}>
                    {t("c01ui.legacy.attempt", {
                      child: name?.child ?? "",
                      exam: name?.exam ?? "",
                    })}
                  </Text>
                  <Text style={u.small}>
                    {t("c01ui.legacy.finished", { date: date(a.finished_at) })}
                  </Text>
                  <Text style={u.copy}>
                    {t("c01ui.legacy.score", {
                      before: pct(impact.scoreBefore),
                      after: pct(impact.scoreAfter),
                    })}
                  </Text>
                  <Text style={u.copy}>
                    {t("c01ui.legacy.items", {
                      list: a.items.map((i) => i.position).join(", "),
                      pending: impact.pending,
                      unanswered: impact.unanswered,
                    })}
                  </Text>
                  {a.kept_scores
                    ? (
                      <Text style={u.copy}>
                        {t("c01ui.legacy.kept", { count: a.kept_scores })}
                      </Text>
                    )
                    : null}
                  {impact.becomesProvisional
                    ? (
                      <Text style={u.small}>{t("c01ui.legacy.provisional")}</Text>
                    )
                    : null}
                  {a.blocked
                    ? (
                      <Text style={u.error}>{t("c01ui.legacy.blocked")}</Text>
                    )
                    : (
                      <Toggle
                        label={t("c01ui.legacy.select", {
                          exam: name?.exam ?? "",
                        })}
                        value={picked.includes(a.attempt_id)}
                        disabled={apply.isPending}
                        onChange={(on) => {
                          setConfirmed(false);
                          setPicked((v) =>
                            on
                              ? [...v, a.attempt_id]
                              : v.filter((x) => x !== a.attempt_id)
                          );
                        }}
                      />
                    )}
                </View>
              );
            })}
            {selectable.length
              ? (
                <>
                  <Toggle
                    label={t("c01ui.legacy.confirm")}
                    value={confirmed}
                    disabled={!chosen.length || apply.isPending}
                    onChange={setConfirmed}
                  />
                  <SatinButton
                    title={t("c01ui.legacy.apply", { count: chosen.length })}
                    disabled={!chosen.length || !confirmed}
                    busy={apply.isPending}
                    onPress={() => apply.mutate(false)}
                  />
                </>
              )
              : null}
            {failure
              ? (
                <View testID="legacy-zero-error" style={{ gap: 8 }}>
                  <Text accessibilityRole="alert" style={u.error}>
                    {t(`c01ui.legacy.errors.${failure}`)}
                  </Text>
                  {failure === "unknown" && request
                    ? (
                      <SatinButton
                        secondary
                        title={t("c01ui.legacy.retry")}
                        busy={apply.isPending}
                        onPress={() => apply.mutate(true)}
                      />
                    )
                    : null}
                </View>
              )
              : null}
            <Text accessibilityRole="header" style={u.heading}>
              {t("c01ui.legacy.audit")}
            </Text>
            <View testID="legacy-zero-audit" style={{ gap: 6 }}>
              {audit.data?.length
                ? audit.data.map((r) => (
                  <View key={r.attempt_id} style={u.card}>
                    <Text style={u.bold}>
                      {t("c01ui.legacy.attempt", {
                        child: label(r.attempt_id)?.child ?? "",
                        exam: label(r.attempt_id)?.exam ?? "",
                      })}
                    </Text>
                    <Text style={u.copy}>
                      {t("c01ui.legacy.auditRow", {
                        date: date(r.applied_at),
                        who: t(`c01ui.legacy.role.${r.applied_role}`),
                        before: pct(r.before.score_pct),
                        after: pct(r.after.score_pct),
                      })}
                    </Text>
                  </View>
                ))
                : <Text style={u.copy}>{t("c01ui.legacy.auditEmpty")}</Text>}
            </View>
            <SatinButton
              secondary
              title={t("common.close")}
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
