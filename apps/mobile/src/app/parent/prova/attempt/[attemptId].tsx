import { attemptEndedByTime, attemptSummary, parseAttemptSummary, readNotebook, type AttemptSummaryRpc } from "@gina/core";
import { Toggle } from "@/components/ui/toggle";
import { type QuestionMediaItem } from "@/components/learning/question-media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen } from "@/components/ui/parent-screen";
import { invokeProvaAi, type GradeResponse, type PlanResponse } from "@/lib/prova-ai";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface AiSummary {
  unscored?: {ref:string;reason:string}[];
  guclu_konular?: string[];
  zayif_konular?: string[];
  genel_oneri?: string;
  konu_analizi?: {konu:string;kanitlar:string[];gozlem:string;sonraki_adim:string}[];
  calisma_adimlari?: {konu:string;etkinlik:string;sure_dk:number;basari_olcutu:string}[];
  veli_destegi?:string[]; sinirlar?:string[];
}

/** get_attempt_summary henüz üretilmiş tiplerde yok; yanıt zod ile doğrulanır, bozuksa eski sütun yoluna düşülür. */
async function fetchAttemptSummary(attemptId: string): Promise<AttemptSummaryRpc | null> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc("get_attempt_summary", { p_attempt_id: attemptId });
  if (error) throw error;
  return parseAttemptSummary(data);
}

interface ProvaEntitlement {
  ai_grading: boolean;
  study_plan: boolean;
}

/** Deneme incelemesi (veli): soru soru çocuğun cevabı; şıklı doğru/yanlış, açık uçlu elle ya da AI ile puanlama, çalışma planı. */
export default function AttemptReviewScreen() {
  const { t, i18n } = useTranslation();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const attempt = useQuery({
    queryKey: ["attempt_review", attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id, status, mc_total, mc_correct, open_total, open_graded, score_pct, ai_feedback, finished_at, deadline_at, children(name), exams(title, subject, grade, question_ids)")
        .eq("id", attemptId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // P04: inceleme durumu (bekleyen / cevapsız / ara sonuç) sunucu özetinden; eski kayıtta saklı sayaçlar aynen gelir.
  const attemptState = useQuery({
    queryKey: ["attempt_summary", attemptId],
    enabled: !!attemptId,
    queryFn: () => fetchAttemptSummary(attemptId),
  });

  const questionIds = attempt.data?.exams?.question_ids ?? [];
  const media = useQuery({
    queryKey:["attempt_question_media",familyId,attemptId],enabled:questionIds.length>0,
    queryFn:async()=>{const {data,error}=await supabase.rpc("get_question_media",{p_question_ids:questionIds});if(error)throw error;return data as unknown as QuestionMediaItem[];},
  });
  const questions = useQuery({
    queryKey: ["attempt_review_questions", attemptId],
    enabled: questionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_bank")
        .select("id, topic, kind, stem, choices, correct_key, expected_answer, solution")
        .in("id", questionIds);
      if (error) throw error;
      const byId = new Map(data.map((q) => [q.id, q]));
      return questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
    },
  });

  const answers = useQuery({
    queryKey: ["attempt_review_answers", attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_answers")
        .select("question_id, answer_key, answer_text, answer_document, is_correct, score, feedback, graded_by, ai_score, ai_details")
        .eq("attempt_id", attemptId);
      if (error) throw error;
      return new Map(data.map((a) => [a.question_id, a]));
    },
  });

  const entitlement = useQuery({
    queryKey: ["prova_entitlement", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_prova_entitlement");
      if (error) throw error;
      return data as unknown as ProvaEntitlement;
    },
  });

  const plans = useQuery({
    queryKey: ["study_plans_for_attempt", attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data, error } = await supabase.from("study_plans").select("id, status, created_at").eq("attempt_id", attemptId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["attempt_review", attemptId] });
    void queryClient.invalidateQueries({ queryKey: ["attempt_review_answers", attemptId] });
    void queryClient.invalidateQueries({ queryKey: ["attempt_summary", attemptId] });
    void queryClient.invalidateQueries({ queryKey: ["exams", familyId] });
    void queryClient.invalidateQueries({ queryKey: ["learning_progress", familyId] });
  };

  const [imageAiConsent,setImageAiConsent] = useState(false);
  const aiGrade = useMutation({
    mutationFn: () => invokeProvaAi<GradeResponse>("prova-grade", { attempt_id: attemptId, image_consent: imageAiConsent }),
    onSuccess: refresh,
  });

  // "Cevap yok" otomatik 0 değildir; veli isterse bu soruya açıkça 0 verir.
  const giveZero = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.rpc("score_open_answer", { p_attempt_id: attemptId, p_question_id: questionId, p_score: 0 });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const makePlan = useMutation({
    mutationFn: () =>
      invokeProvaAi<PlanResponse>("prova-plan", { attempt_id: attemptId, days: 7, locale: i18n.language.startsWith("en") ? "en" : "tr" }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["study_plans_for_attempt", attemptId] });
      router.push(`/parent/prova/plan/${data.plan_id}`);
    },
  });

  const a = attempt.data;
  const summary = (a?.ai_feedback ?? null) as AiSummary | null;
  const finished = a && a.status !== "in_progress";
  const notebookNeedsReview = Array.from(answers.data?.values() ?? []).some(answer => answer.graded_by !== "parent" && (readNotebook(answer.answer_document)?.elements.length ?? 0) > 0);
  const hasOpen = (a?.open_total ?? 0) > 0;
  const legacy = a ? attemptSummary(a, questions.data ?? []) : null;
  const rpc = attemptState.data ?? null;
  // RPC yoksa/hata verirse/bozuksa eski sütunlarla aynı davranış (legacy kayıt değişmez); ekranı kilitlemez.
  const view = rpc
    ? { pending: rpc.pending_open_count, unanswered: rpc.unanswered_open_count, provisional: rpc.provisional, scorePct: rpc.score_pct, reviewState: rpc.review_state }
    : legacy
    ? { pending: legacy.pendingOpenCount, unanswered: legacy.unansweredOpenCount, provisional: legacy.pendingReview, scorePct: a?.score_pct ?? null, reviewState: legacy.reviewState }
    : null;
  const openAnswers = [...(rpc?.open_answers ?? [])].sort((x, y) => x.position - y.position);
  const attemptGraded = view?.reviewState === "graded";
  const ent = entitlement.data;

  return (
    <Screen title={a?.exams?.title ?? t("prova.ai.reviewTitle")} loading={attempt.isLoading || attemptState.isLoading || media.isLoading || questions.isLoading || answers.isLoading || plans.isLoading || entitlement.isLoading} error={attempt.error ?? media.error ?? questions.error ?? answers.error ?? plans.error ?? entitlement.error} onRetry={() => { void attempt.refetch(); void attemptState.refetch(); void media.refetch(); if (questionIds.length) void questions.refetch(); void answers.refetch(); void plans.refetch(); void entitlement.refetch(); }}>
      {a && view ? (
        <View className="gap-2 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
          <Text className="font-body text-sm text-gray-600">
            {a.children?.name} · {a.exams?.subject} {a.exams?.grade}. {t("prova.gradeWord")}
          </Text>
          {/* D4-2: süre dolunca biten denemede veli bunu sakin bir notla görür (kusur değil, bilgi). */}
          {attemptEndedByTime(a) ? (
            <View testID="prova-time-up-result" accessibilityRole="summary" className="gap-1 rounded-xl bg-[#F6F3FB] px-3 py-2">
              <Text className="font-body-bold text-base text-ink">⏱ {t("d8.timeUpTitle")}</Text>
              <Text className="font-body text-sm text-ink">{t("d8.timeUpParent")}</Text>
            </View>
          ) : null}
          {/* Önce inceleme durumu, sonra puan: eksik puan "ara sonuç"tur, sıfır değil. */}
          {view.pending > 0 ? <Text accessibilityRole="alert" className="font-body-bold text-base text-ink">{t("prova.ai.reviewWaiting", { count: view.pending })}</Text> : null}
          {view.unanswered > 0 ? <Text className="font-body-bold text-base text-ink">{t("prova.ai.unansweredCount", { count: view.unanswered })}</Text> : null}
          {view.provisional ? (
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <View style={{ borderRadius: 999, backgroundColor: "#FFF1D6", borderWidth: 1, borderColor: "#E9C77E", paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text className="font-body-bold text-sm text-ink">{t("prova.provisionalResult")}</Text>
              </View>
              <Text className="font-display text-xl text-ink">
                {view.scorePct !== null ? t("prova.ai.answerScore", { score: view.scorePct }) : t("prova.ai.noScoreYet")}
              </Text>
            </View>
          ) : (
            <Text className="font-display text-xl text-ink">
              {view.scorePct !== null ? t("prova.ai.scorePct", { pct: view.scorePct }) : t(`prova.ai.attemptStatus.${a.status}`)}
            </Text>
          )}
          {view.provisional ? <Text className="font-body text-sm text-gray-600">{t("prova.ai.provisionalNote")}</Text> : null}
          {(a.mc_total ?? 0) > 0 ? <Text className="font-body text-sm text-teal-dark">{t("prova.resultMc", { correct: a.mc_correct ?? 0, total: a.mc_total ?? 0 })}</Text> : null}
          {hasOpen ? (
            <Text className="font-body text-sm text-teal-dark">
              {rpc && !attemptGraded
                ? t("prova.ai.openBreakdown", { graded: rpc.open_graded ?? 0, pending: view.pending, unanswered: view.unanswered })
                : t("prova.ai.openGraded", { graded: a.open_graded ?? 0, total: a.open_total ?? 0 })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {finished && openAnswers.length > 0 ? (
        <View className="gap-1 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
          <Text accessibilityRole="header" className="font-body-bold text-base text-ink">{t("prova.ai.openAnswersTitle")}</Text>
          {openAnswers.map((item) => {
            const state = item.state;
            return (
              <View key={item.question_id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F0ECF4" }}>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Text className="font-body-bold text-base text-ink" style={{ flexGrow: 1 }}>
                    {t("prova.ai.questionN", { n: item.position })} · {state === "graded" && item.score !== null ? t("prova.ai.answerScore", { score: item.score }) : t(`prova.ai.answerState.${state}`)}{state === "graded" && item.graded_by ? ` · ${t(item.graded_by === "ai" ? "provaC04.review.byAi" : "provaC04.review.byParent")}` : ""}
                  </Text>
                  {state !== "unanswered" || attemptGraded ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${t("prova.ai.review")}: ${t("prova.ai.questionN", { n: item.position })}`} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}
                      onPress={() => router.push({ pathname: "/parent/prova/review/[attemptId]", params: { attemptId, questionId: item.question_id } })}>
                      <Text className="font-body-bold text-teal-dark">{t("prova.ai.review")}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {/* C08: AI puanı öneridir; kesin puan veli incelemede kaydedince oluşur. */}
                {state === "pending" && item.ai_suggested && item.ai_score != null ? <Text testID="attempt-ai-suggestion" className="font-body text-sm text-gray-600">{t("c08.review.suggestionRow", { score: item.ai_score })}</Text> : null}
                {state === "pending" && item.has_document && !item.has_text ? <Text className="font-body text-sm text-gray-600">{t("prova.ai.drawingPendingHint")}</Text> : null}
                {state === "unanswered" && !attemptGraded ? (
                  <>
                    <Text className="font-body text-sm text-gray-600">{t("prova.ai.unansweredHint")}</Text>
                    <Button variant="secondary" title={t("prova.ai.giveZero")} accessibilityLabel={t("prova.ai.giveZeroA11y", { n: item.position })}
                      loading={giveZero.isPending && giveZero.variables === item.question_id} disabled={giveZero.isPending}
                      onPress={() => giveZero.mutate(item.question_id)} />
                  </>
                ) : null}
              </View>
            );
          })}
          <ErrorText error={giveZero.error} />
        </View>
      ) : null}

      {summary && (summary.zayif_konular?.length || summary.genel_oneri) ? (
        <View className="gap-1 rounded-parent bg-teal-light p-4">
          <Text className="font-body-bold text-base text-ink">{t("prova.ai.summaryTitle")}</Text>
          {summary.guclu_konular?.length ? (
            <Text className="font-body text-sm text-ink">
              {t("prova.ai.strong")}: {summary.guclu_konular.join(", ")}
            </Text>
          ) : null}
          {summary.zayif_konular?.length ? (
            <Text className="font-body text-sm text-ink">
              {t("prova.ai.weak")}: {summary.zayif_konular.join(", ")}
            </Text>
          ) : null}
          {summary.genel_oneri ? <Text className="font-body text-sm text-ink">{summary.genel_oneri}</Text> : null}
        </View>
      ) : null}

      {summary?.konu_analizi?.map((item, n) => <View key={`topic-${n}`} className="gap-3 rounded-parent border border-mist bg-white p-5">
        <Text className="font-display text-xl text-ink">{item.konu}</Text>
        <Text className="font-body text-base text-ink">{item.gozlem}</Text>
        <Text className="font-body text-sm text-gray-600">{t("learningReport.evidence")}: {item.kanitlar.map(ref => ref.replace(/^M/, "")).join(", ")}</Text>
        <Text className="font-body-bold text-base text-teal-dark">{item.sonraki_adim}</Text>
      </View>)}
      {summary?.calisma_adimlari?.length ? <View className="gap-4 rounded-parent bg-teal-light p-5">
        <Text className="font-display text-xl text-ink">{t("learningReport.nextSteps")}</Text>
        {summary.calisma_adimlari.map((step,n)=><View key={n} className="gap-1">
          <Text className="font-body-bold text-base text-ink">{step.konu} · {step.sure_dk} {t("prova.min")}</Text>
          <Text className="font-body text-base text-ink">{step.etkinlik}</Text>
          <Text className="font-body text-sm text-teal-dark">{t("learningReport.check")}: {step.basari_olcutu}</Text>
        </View>)}
      </View> : null}
      {summary?.veli_destegi?.length ? <View className="gap-2 rounded-parent bg-white p-5">
        <Text className="font-display text-xl text-ink">{t("learningReport.parentHelp")}</Text>
        {summary.veli_destegi.map((tip,n)=><Text key={n} className="font-body text-base text-ink">{tip}</Text>)}
      </View> : null}
      {summary?.unscored?.map(item=><View key={item.ref} className="gap-2 rounded-parent border border-mist p-4"><Text className="font-body-bold text-base text-ink">{t("prova.ai.questionN",{n:item.ref.replace(/^M/,"")})}</Text><Text className="font-body text-base text-ink">{item.reason}</Text></View>)}
      {summary?.sinirlar?.length ? <View className="gap-2 rounded-parent border border-mist p-4">
        <Text className="font-body-bold text-base text-ink">{t("learningReport.limits")}</Text>
        {summary.sinirlar.map((limit,n)=><Text key={n} className="font-body text-sm text-gray-600">{limit}</Text>)}
      </View> : null}
      {finished ? (
        ent?.ai_grading ? (
          <View style={{gap:12}}>{media.data?.length ? <Toggle label={t("sources.aiConsent")} value={imageAiConsent} onChange={setImageAiConsent} disabled={aiGrade.isPending}/> : null}<Button variant="secondary" title={t("prova.ai.gradeWithAi")} disabled={notebookNeedsReview} loading={aiGrade.isPending} onPress={() => aiGrade.mutate()} /></View>
        ) : (
          <Text className="font-body text-sm text-gray-500">{t("prova.ai.needsProGrading")}</Text>
        )
      ) : null}
      {notebookNeedsReview ? <Text className="font-body text-base text-gray-600">{t("notebook.manualReview")}</Text> : null}
      <ErrorText error={aiGrade.error} />

      <Button title={t("parentReview.openReview")} onPress={() => router.push(`/parent/prova/review/${attemptId}`)} />

      {finished ? (
        <View className="gap-2 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
          <Text className="font-display text-xl text-ink">{t("prova.ai.studyPlans")}</Text>
          <Button variant="secondary" title={t("repeatCalendar.entry")} onPress={() => router.push(`/parent/prova/repeat/${attemptId}`)} />
          {plans.data?.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} onPress={() => router.push(`/parent/prova/plan/${p.id}`)}>
              <Text className="font-body-bold text-teal-dark">
                • {new Date(p.created_at).toLocaleDateString(i18n.language)} · {t(`prova.ai.planStatus.${p.status}`)}
              </Text>
            </Pressable>
          ))}
          {ent?.study_plan ? (
            <Button variant="secondary" title={t("prova.ai.makePlan")} loading={makePlan.isPending} onPress={() => makePlan.mutate()} />
          ) : (
            <Text className="font-body text-sm text-gray-500">{t("prova.ai.needsProPlan")}</Text>
          )}
          <ErrorText error={makePlan.error} />
        </View>
      ) : null}

      <ErrorText error={attempt.error ?? media.error ?? questions.error ?? answers.error ?? plans.error} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </Screen>
  );
}
