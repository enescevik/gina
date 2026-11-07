import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";
import { readNotebook } from "@gina/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen } from "@/components/ui/parent-screen";
import { NotebookPage } from "@/components/learning/notebook-page";
import { ContextualQuestion } from "@/components/learning/question-context";
import { QuestionMedia } from "@/components/learning/question-media";
import { supabase } from "@/lib/supabase";
import { StructuredQuestion } from "./StructuredQuestion";
import {
  parentItemStatus,
  parseScoreInput,
  readOverrides,
  readScoreDetails,
  readStructuredAnswer,
  reasonRequired,
  type StructuredSummaryRow,
} from "./model";
import { fetchStructuredSummary, structuredStatusText, structuredSummaryKey } from "./structured-attempt-section";
import { qt } from "./ui";

export interface StructuredReviewQuestion {
  id: string;
  stem: string;
  interaction_type: string | null;
  schema_version: number | null;
  payload: unknown;
}
export interface StructuredReviewAnswer {
  answer?: unknown;
  answer_document?: unknown;
  score?: number | null;
  graded_by?: string | null;
  score_details?: unknown;
}

const SCORE_ERRORS = ["score_reason_required", "answer_changed", "attempt_not_finished", "request_conflict", "question_not_structured", "forbidden", "invalid_input"];
function scoreError(error: unknown): string {
  const message = error && typeof error === "object" ? String((error as { message?: unknown }).message ?? "") : "";
  return SCORE_ERRORS.includes(message) ? message : "generic";
}

/**
 * Veli: tek yapılandırılmış madde incelemesi. Çocuğun cevabı + sunucu işaretleri + anahtar (yalnız veli),
 * durum (puanlı/kısmi/sizi bekliyor/cevapsız) ve `set_structured_answer_score` ile puan. Otomatik puanı
 * değiştirirken gerekçe zorunlu; geçmiş `get_structured_score_overrides`'tan. Açık uçlu inceleme akışına dokunmaz.
 */
export function StructuredReviewPanel({
  attemptId,
  childName,
  question,
  answer,
  index,
  count,
  finished,
  onNavigate,
  onReload,
}: {
  attemptId: string;
  childName: string;
  question: StructuredReviewQuestion;
  answer?: StructuredReviewAnswer;
  index: number;
  count: number;
  finished: boolean;
  onNavigate: (index: number) => void;
  onReload: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const cache = useQueryClient();
  const summary = useQuery({ queryKey: structuredSummaryKey(attemptId), queryFn: () => fetchStructuredSummary(attemptId), staleTime: 0, refetchOnMount: "always" });
  const keys = useQuery({
    queryKey: ["qt_answer_keys", question.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_answer_keys", { p_question_ids: [question.id] });
      if (error) throw error;
      const list = Array.isArray(data) ? (data as { question_id: string; key: unknown }[]) : [];
      return list.find((k) => k.question_id === question.id)?.key ?? null;
    },
  });
  const overrides = useQuery({
    queryKey: ["qt_score_overrides", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_structured_score_overrides", { p_attempt_id: attemptId });
      if (error) throw error;
      return readOverrides(data);
    },
  });
  const row: StructuredSummaryRow | undefined = summary.data?.find((r) => r.question_id === question.id);
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [reasonMissing, setReasonMissing] = useState(false);
  // Aynı içerikle yeniden denemede aynı istek kimliği (idempotent); içerik değişince yenisi.
  const request = useRef<{ id: string; body: string } | null>(null);
  let structured;
  try {
    structured = readStructuredAnswer(question.interaction_type ?? "", answer?.answer);
  } catch {
    structured = undefined;
  }
  const details = readScoreDetails(answer?.score_details);
  const document = readNotebook(answer?.answer_document);
  const numeric = parseScoreInput(score);
  const needReason = !!row && numeric !== null && reasonRequired(row, numeric);
  const save = useMutation({
    mutationFn: async () => {
      if (!row || numeric === null) throw new Error("invalid_input");
      const body = JSON.stringify([row.answer_hash, numeric, reason.trim()]);
      if (request.current?.body !== body) request.current = { id: randomUUID(), body };
      const { data, error } = await supabase.rpc("set_structured_answer_score", {
        p_request_id: request.current.id,
        p_attempt_id: attemptId,
        p_question_id: question.id,
        // Hiç gönderilmemiş maddede beklenen hash NULL'dır.
        p_answer_hash: row.answer_hash as string,
        p_score: numeric,
        p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      request.current = null;
      setSaved(true);
      setScore("");
      setReason("");
      void cache.invalidateQueries({ queryKey: ["attempt_summary", attemptId] });
      void cache.invalidateQueries({ queryKey: ["qt_score_overrides", attemptId] });
      void cache.invalidateQueries({ queryKey: ["attempt_review", attemptId] });
      void cache.invalidateQueries({ queryKey: ["attempt_review_answers", attemptId] });
      onReload();
    },
  });
  const history = (overrides.data ?? []).filter((o) => o.question_id === question.id);
  const status = row ? parentItemStatus(row) : null;
  const errorKey = save.error ? scoreError(save.error) : null;
  return (
    <ParentScreen
      title={t("prova.qt.review.questionN", { n: index + 1, type: question.interaction_type ? t(`prova.qt.review.type.${question.interaction_type}`) : "" })}
      subtitle={childName}
      loading={summary.isPending || keys.isPending}
      error={summary.error ?? keys.error}
      onRetry={() => { void summary.refetch(); void keys.refetch(); void overrides.refetch(); }}
    >
      <View testID="qt-review-panel" className="gap-3 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
        <ContextualQuestion questionId={question.id} stem={question.stem} />
        <QuestionMedia questionId={question.id} />
        {row ? (
          <Text testID={`qt-review-status-${status}`} accessibilityRole="summary" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: qt.ink, backgroundColor: status === "pending_parent" ? qt.warm : qt.lilac, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            {structuredStatusText(t, row)}
          </Text>
        ) : null}
        <StructuredQuestion
          questionId={question.id}
          type={question.interaction_type}
          schemaVersion={question.schema_version}
          payload={question.payload}
          answer={structured}
          review={{ details, answerKey: keys.data ?? null, score: answer?.score ?? null, gradedBy: answer?.graded_by ?? null }}
        />
        {document?.elements.length ? (
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" className="font-body-bold text-base text-ink">{t("prova.qt.review.workArea")}</Text>
            <NotebookPage document={document} width={Math.max(220, Math.min(640, width - 96))} />
          </View>
        ) : null}
      </View>

      {finished && row ? (
        <View testID="qt-score-form" className="gap-3 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
          <Text accessibilityRole="header" className="font-body-bold text-base text-ink">{t("prova.qt.review.scoreTitle")}</Text>
          <Text className="font-body text-sm text-gray-600">{t(status === "unanswered" ? "prova.qt.review.unansweredHelp" : status === "pending_parent" ? "prova.qt.review.pendingHelp" : "prova.qt.review.changeHelp")}</Text>
          <Field
            testID="qt-score-input"
            label={t("prova.qt.review.scoreLabel")}
            value={score}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
            onChangeText={(v) => { setScore(v.replace(/[^0-9]/g, "")); setSaved(false); setInvalid(false); setReasonMissing(false); save.reset(); }}
            error={invalid ? t("prova.qt.review.scoreInvalid") : null}
          />
          <Field
            testID="qt-reason-input"
            label={t(needReason ? "prova.qt.review.reasonRequired" : "prova.qt.review.reasonOptional")}
            value={reason}
            multiline
            maxLength={500}
            onChangeText={(v) => { setReason(v); setSaved(false); setReasonMissing(false); save.reset(); }}
            error={reasonMissing || errorKey === "score_reason_required" ? t("prova.qt.review.errors.score_reason_required") : null}
          />
          <Button
            testID="qt-score-save"
            title={t("prova.qt.review.save")}
            loading={save.isPending}
            disabled={save.isPending}
            onPress={() => {
              if (numeric === null) { setInvalid(true); return; }
              // Sunucu da denetler (score_reason_required); burada boşuna istek atmayız.
              if (needReason && reason.trim().length < 3) { setReasonMissing(true); return; }
              save.mutate();
            }}
          />
          {saved ? <Text testID="qt-score-saved" accessibilityLiveRegion="polite" className="font-body-bold text-base text-teal-dark">{t("prova.qt.review.saved")}</Text> : null}
          {errorKey && errorKey !== "score_reason_required" ? (
            <Text accessibilityRole="alert" style={{ fontFamily: "Nunito_700Bold", color: "#A43135", fontSize: 15, lineHeight: 22 }}>{t(`prova.qt.review.errors.${errorKey}`)}</Text>
          ) : null}
          {errorKey === "answer_changed" ? <Button variant="secondary" title={t("common.retry")} onPress={() => { save.reset(); void summary.refetch(); onReload(); }} /> : null}
        </View>
      ) : null}

      {history.length ? (
        <View testID="qt-score-history" className="gap-2 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
          <Text accessibilityRole="header" className="font-body-bold text-base text-ink">{t("prova.qt.review.history")}</Text>
          {history.map((o, i) => (
            <View key={`${o.created_at}-${i}`} style={{ gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: "#F0ECF4", paddingTop: i ? 6 : 0 }}>
              <Text className="font-body-bold text-sm text-ink">
                {t("prova.qt.review.historyRow", {
                  date: new Date(o.created_at).toLocaleString(i18n.language),
                  from: o.previous_score === null ? t("prova.qt.review.historyNone") : String(o.previous_score),
                  to: o.parent_score,
                })}
              </Text>
              {o.auto_score !== null ? <Text className="font-body text-sm text-gray-600">{t("prova.qt.review.historyAuto", { score: Math.round(o.auto_score) })}</Text> : null}
              {o.reason ? <Text className="font-body text-sm text-gray-600">{t("prova.qt.review.historyReason", { reason: o.reason })}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {index > 0 ? <View style={{ flexGrow: 1, flexBasis: 160 }}><Button variant="secondary" title={t("prova.qt.review.prev")} onPress={() => onNavigate(index - 1)} /></View> : null}
        <View style={{ flexGrow: 1, flexBasis: 160 }}>
          <Button variant="secondary" title={t(index + 1 < count ? "prova.qt.review.next" : "prova.qt.review.backToAttempt")} onPress={() => onNavigate(index + 1)} />
        </View>
      </View>
      <Button variant="ghost" title={t("prova.qt.review.backToAttempt")} onPress={() => router.replace(`/parent/prova/attempt/${attemptId}`)} />
    </ParentScreen>
  );
}
