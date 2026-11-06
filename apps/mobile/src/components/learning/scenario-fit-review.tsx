import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { p, SatinButton } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { provaErrorMessage } from "@/lib/prova-ai";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { b, BuilderCard, BuilderChoice } from "./prova-builder-ui";

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
type Decision = "fit" | "not_fit" | "needs_revision";
export interface FitItem {
  question_id: string;
  stem: string;
  topic: string;
  subject: string;
  grade: number;
  kind: string;
  block_id: string;
  outcomes: { id: string; text: string | null }[];
  decision: Decision | "pending_human_review";
  reason: string | null;
  measured_outcome_ids: string[] | null;
  revision: number;
  reviewed_at: string | null;
  scenario_version: string | null;
  shared: { title: string; body: string; position: number } | null;
  ai_suggestion: {
    recommendation?: string;
    decision_reason?: string;
    confidence?: number;
  } | null;
  exams: { id: string; title: string; status: string }[];
}
export interface FitList {
  items: FitItem[];
  summary: {
    total: number;
    pending_human_review: number;
    fit: number;
    not_fit: number;
    needs_revision: number;
  };
}

export function useScenarioFit(state: "pending" | "reviewed") {
  const { claims } = useSession();
  return useQuery({
    queryKey: ["scenario_fit", claims?.family_id, state],
    enabled: !!claims?.family_id,
    queryFn: async () => {
      const r = await (supabase.rpc as unknown as Rpc).call(
        supabase,
        "list_scenario_question_fit",
        { p_state: state, p_limit: 50 },
      );
      if (r.error) throw r.error;
      return r.data as FitList;
    },
  });
}

/**
 * D1 / C05: one question ↔ outcome review. The parent's decision (with a reason ≥ 10 characters, the
 * outcomes the question really measures and an explicit confirmation) is the only decision; an AI
 * suggestion is shown in its own box and never preselects anything.
 */
export function ScenarioFitCard({ item }: { item: FitItem }) {
  const { t } = useTranslation(),
    { claims } = useSession(),
    cache = useQueryClient();
  const reviewed = item.decision !== "pending_human_review";
  const [decision, setDecision] = useState<Decision | null>(
    reviewed ? item.decision as Decision : null,
  );
  const [reason, setReason] = useState(item.reason ?? "");
  const [measured, setMeasured] = useState<string[]>(
    item.measured_outcome_ids ?? [],
  );
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(!reviewed);
  const request = useRef<{ key: string; id: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const input = {
        decision,
        reason: reason.trim(),
        measured_outcome_ids: measured,
        revision: item.revision,
        confirmed,
      };
      const key = JSON.stringify(input);
      if (!request.current || request.current.key !== key) {
        request.current = { key, id: randomUUID() };
      }
      const r = await (supabase.rpc as unknown as Rpc).call(
        supabase,
        "review_scenario_question_fit",
        {
          p_request_id: request.current.id,
          p_question_id: item.question_id,
          p_input: input,
        },
      );
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      request.current = null;
      setEditing(false);
      void cache.invalidateQueries({
        queryKey: ["scenario_fit", claims?.family_id],
      });
    },
    onError: (e) => {
      if ((e as { message?: string }).message === "content_fit_revision_conflict") {
        void cache.invalidateQueries({
          queryKey: ["scenario_fit", claims?.family_id],
        });
      }
    },
  });
  const reasonOk = reason.trim().length >= 10;
  const measuredOk = decision !== "fit" || measured.length > 0;
  const ready = !!decision && reasonOk && measuredOk && confirmed;
  const ai = item.ai_suggestion;
  return (
    <BuilderCard>
      <Text style={b.muted}>
        {item.subject} · {item.grade}. {t("d1.fit.grade")} · {item.topic} ·{" "}
        {t("d1.fit.block", { block: item.block_id })}
      </Text>
      {item.shared
        ? (
          <View
            style={{ backgroundColor: p.lilac, borderRadius: 16, padding: 12, gap: 4 }}
          >
            <Text style={[b.muted, { color: p.purple }]}>
              {t("sharedQuestions.common")}
            </Text>
            <Text style={b.bold}>{item.shared.title}</Text>
            <Text style={b.copy} numberOfLines={6}>{item.shared.body}</Text>
          </View>
        )
        : null}
      <Text style={b.bold}>{t("d1.fit.question")}</Text>
      <Text selectable style={b.copy}>{item.stem}</Text>
      <Text style={b.bold}>{t("d1.fit.outcomes")}</Text>
      <Text style={b.muted}>{t("d1.fit.outcomesHelp")}</Text>
      {item.outcomes.map((o) => (
        <BuilderChoice
          key={o.id}
          label={`${o.id} — ${o.text ?? t("d1.fit.outcomeMissing")}`}
          selected={measured.includes(o.id)}
          disabled={!editing || save.isPending}
          onPress={() =>
            setMeasured((v) =>
              v.includes(o.id) ? v.filter((x) => x !== o.id) : [...v, o.id]
            )}
        />
      ))}
      {ai
        ? (
          <View
            accessibilityLabel={t("d1.fit.aiTitle")}
            style={{ borderWidth: 1.5, borderColor: "#DDD6E8", borderRadius: 16, padding: 12, gap: 4 }}
          >
            <Text style={b.bold}>{t("d1.fit.aiTitle")}</Text>
            <Text style={b.copy}>
              {t(`d1.fit.ai_${ai.recommendation ?? "admin_review"}`)}
              {typeof ai.confidence === "number"
                ? ` · ${t("d1.fit.aiConfidence", { value: Math.round(ai.confidence * 100) })}`
                : ""}
            </Text>
            <Text style={b.muted}>{t("d1.fit.aiNotDecision")}</Text>
          </View>
        )
        : null}
      <Text style={b.bold}>{t("d1.fit.decision")}</Text>
      <View style={b.wrap}>
        {(["fit", "needs_revision", "not_fit"] as const).map((d) => (
          <BuilderChoice
            key={d}
            label={t(`d1.fit.decision_${d}`)}
            selected={decision === d}
            disabled={!editing || save.isPending}
            onPress={() => setDecision(d)}
          />
        ))}
      </View>
      <Field
        label={t("d1.fit.reason")}
        value={reason}
        editable={editing && !save.isPending}
        onChangeText={setReason}
        multiline
        maxLength={2000}
        hint={t("d1.fit.reasonHelp")}
      />
      {editing
        ? (
          <>
            <Toggle
              label={t("d1.fit.confirm")}
              value={confirmed}
              disabled={save.isPending}
              onChange={setConfirmed}
            />
            {!measuredOk
              ? <Text style={b.error}>{t("d1.fit.measuredRequired")}</Text>
              : null}
            {save.error
              ? (
                <Text accessibilityRole="alert" style={b.error}>
                  {provaErrorMessage(save.error)}
                </Text>
              )
              : null}
            <SatinButton
              title={t("d1.fit.save")}
              busy={save.isPending}
              disabled={!ready || save.isPending}
              onPress={() => save.mutate()}
            />
          </>
        )
        : (
          <View style={[b.row, { gap: 8 }]}>
            <Text style={[b.muted, { flex: 1 }]}>
              {t("d1.fit.saved", {
                decision: t(`d1.fit.decision_${item.decision}`),
              })}
            </Text>
            <SatinButton
              secondary
              title={t("d1.fit.change")}
              onPress={() => {
                setConfirmed(false);
                setEditing(true);
              }}
            />
          </View>
        )}
      {item.exams.length
        ? (
          <Text style={b.muted}>
            {t("d1.fit.usedIn", { titles: item.exams.map((e) => e.title).join(", ") })}
          </Text>
        )
        : null}
    </BuilderCard>
  );
}
