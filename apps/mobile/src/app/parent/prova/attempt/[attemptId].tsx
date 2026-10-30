import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen } from "@/components/ui/parent-screen";
import { invokeProvaAi, provaErrorMessage, type GradeResponse, type PlanResponse } from "@/lib/prova-ai";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface Choice {
  key: string;
  text: string;
}

interface AiSummary {
  guclu_konular?: string[];
  zayif_konular?: string[];
  genel_oneri?: string;
}

interface AiDetails {
  eksikler?: string[];
  iyilestirme_onerileri?: string[];
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
        .select("id, status, mc_total, mc_correct, open_total, open_graded, score_pct, ai_feedback, finished_at, children(name), exams(title, subject, grade, question_ids)")
        .eq("id", attemptId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const questionIds = attempt.data?.exams?.question_ids ?? [];
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
        .select("question_id, answer_key, answer_text, is_correct, score, feedback, graded_by, ai_score, ai_details")
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
    void queryClient.invalidateQueries({ queryKey: ["exams", familyId] });
  };

  const aiGrade = useMutation({
    mutationFn: () => invokeProvaAi<GradeResponse>("prova-grade", { attempt_id: attemptId }),
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
  const hasOpen = (a?.open_total ?? 0) > 0;
  const ent = entitlement.data;

  return (
    <Screen title={a?.exams?.title ?? t("prova.ai.reviewTitle")} loading={attempt.isLoading || questions.isLoading || answers.isLoading || plans.isLoading || entitlement.isLoading} error={attempt.error ?? questions.error ?? answers.error ?? plans.error ?? entitlement.error} onRetry={() => { void attempt.refetch(); if (questionIds.length) void questions.refetch(); void answers.refetch(); void plans.refetch(); void entitlement.refetch(); }}>
      {a ? (
        <View className="gap-1 rounded-2xl border border-[#E4DAC8] bg-[#FFFCF6] p-4">
          <Text className="font-body text-sm text-gray-600">
            {a.children?.name} · {a.exams?.subject} {a.exams?.grade}. {t("prova.gradeWord")}
          </Text>
          <Text className="font-display text-xl text-ink">
            {a.score_pct !== null ? t("prova.ai.scorePct", { pct: a.score_pct }) : t(`prova.ai.attemptStatus.${a.status}`)}
          </Text>
          <Text className="font-body text-sm text-teal-dark">{t("prova.resultMc", { correct: a.mc_correct ?? 0, total: a.mc_total ?? 0 })}</Text>
          {hasOpen ? (
            <Text className="font-body text-sm text-teal-dark">{t("prova.ai.openGraded", { graded: a.open_graded ?? 0, total: a.open_total ?? 0 })}</Text>
          ) : null}
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

      {finished && hasOpen ? (
        ent?.ai_grading ? (
          <Button title={t("prova.ai.gradeWithAi")} loading={aiGrade.isPending} onPress={() => aiGrade.mutate()} />
        ) : (
          <Text className="font-body text-sm text-gray-500">{t("prova.ai.needsProGrading")}</Text>
        )
      ) : null}
      <ErrorText error={aiGrade.error} />

      {questions.data?.map((q, i) => (
        <AnswerCard
          key={q.id}
          index={i + 1}
          attemptId={attemptId}
          editable={!!finished}
          question={{ ...q, choices: (q.choices ?? null) as Choice[] | null }}
          answer={answers.data?.get(q.id)}
          onSaved={refresh}
        />
      ))}

      {finished ? (
        <View className="gap-2 rounded-2xl border border-[#E4DAC8] bg-[#FFFCF6] p-4">
          <Text className="font-display text-xl text-ink">{t("prova.ai.studyPlans")}</Text>
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

      <ErrorText error={attempt.error ?? questions.error ?? answers.error ?? plans.error} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </Screen>
  );
}

interface ReviewQuestion {
  id: string;
  topic: string;
  kind: "multiple_choice" | "open_ended";
  stem: string;
  choices: Choice[] | null;
  correct_key: string | null;
  expected_answer: string | null;
  solution: string | null;
}

interface ReviewAnswer {
  answer_key: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  ai_score: number | null;
  ai_details: unknown;
}

function AnswerCard({
  index,
  attemptId,
  editable,
  question: q,
  answer,
  onSaved,
}: {
  index: number;
  attemptId: string;
  editable: boolean;
  question: ReviewQuestion;
  answer: ReviewAnswer | undefined;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState(answer?.score !== null && answer?.score !== undefined ? String(answer.score) : "");
  const [feedback, setFeedback] = useState(answer?.feedback ?? "");
  const [showKey, setShowKey] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(score);
      if (score.trim() === "" || !Number.isInteger(value) || value < 0 || value > 100) throw new Error("invalid_score");
      const { error } = await supabase.rpc("score_open_answer", {
        p_attempt_id: attemptId,
        p_question_id: q.id,
        p_score: value,
        p_feedback: feedback.trim() || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: onSaved,
  });

  const details = (answer?.ai_details ?? null) as AiDetails | null;
  const isMc = q.kind === "multiple_choice";
  const answered = isMc ? !!answer?.answer_key : !!answer?.answer_text?.trim();

  return (
    <View className="gap-2 rounded-2xl border border-[#E4DAC8] bg-[#FFFCF6] p-4">
      <Text className="font-body text-xs text-gray-500">
        {t("prova.ai.questionN", { n: index })} · {q.topic} · {t(`prova.kind.${q.kind}`)}
      </Text>
      <Text className="font-body-bold text-base text-ink">{q.stem}</Text>

      {isMc ? (
        <View className="gap-1">
          {q.choices?.map((c) => {
            const chosen = answer?.answer_key === c.key;
            const correct = q.correct_key === c.key;
            return (
              <Text
                key={c.key}
                className={correct ? "font-body-bold text-teal-dark" : chosen ? "font-body-bold text-danger" : "font-body text-ink"}
              >
                {c.key}) {c.text}
                {chosen ? ` ← ${t("prova.ai.childChoice")}` : ""}
              </Text>
            );
          })}
          <Text className={answer?.is_correct ? "font-body-bold text-teal-dark" : "font-body-bold text-danger"}>
            {!answered ? t("prova.ai.unanswered") : answer?.is_correct ? t("prova.ai.correct") : t("prova.ai.incorrect")}
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          <View className="rounded-parent bg-cream p-3">
            <Text className="font-body text-xs text-gray-500">{t("prova.ai.childAnswer")}</Text>
            <Text className="font-body text-base text-ink">{answered ? answer?.answer_text : t("prova.ai.unanswered")}</Text>
          </View>
          <Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} accessibilityState={{ expanded: showKey }} onPress={() => setShowKey((v) => !v)}>
            <Text className="font-body-bold text-teal-dark">{showKey ? t("prova.ai.hideExpected") : t("prova.ai.showExpected")}</Text>
          </Pressable>
          {showKey ? (
            <View className="gap-1">
              {q.expected_answer ? (
                <Text className="font-body text-sm text-gray-600">
                  <Text className="font-body-bold">{t("prova.expected")}: </Text>
                  {q.expected_answer}
                </Text>
              ) : null}
              {q.solution ? (
                <Text className="font-body text-sm text-gray-600">
                  <Text className="font-body-bold">{t("prova.solution")}: </Text>
                  {q.solution}
                </Text>
              ) : null}
            </View>
          ) : null}

          {answer?.score !== null && answer?.score !== undefined ? (
            <Text className="text-sm font-body-bold text-teal-dark">
              {t("prova.ai.currentScore", { score: answer.score })} · {answer.graded_by === "parent" ? t("prova.ai.byParent") : t("prova.ai.byAi")}
            </Text>
          ) : answered ? (
            <Text className="font-body text-sm text-gray-500">{t("prova.ai.awaitingScore")}</Text>
          ) : null}
          {answer?.graded_by === "parent" && answer.ai_score !== null ? (
            <Text className="font-body text-xs text-gray-500">{t("prova.ai.aiSuggested", { score: answer.ai_score })}</Text>
          ) : null}
          {details?.eksikler?.length ? (
            <Text className="font-body text-sm text-ink">
              {t("prova.ai.missing")}: {details.eksikler.join("; ")}
            </Text>
          ) : null}
          {details?.iyilestirme_onerileri?.length ? (
            <Text className="font-body text-sm text-ink">
              {t("prova.ai.suggestions")}: {details.iyilestirme_onerileri.join("; ")}
            </Text>
          ) : null}

          {editable ? (
            <View className="gap-2">
              <View className="flex-row items-end gap-2">
                <View className="w-28">
                  <Field label={t("prova.ai.scoreLabel")} keyboardType="number-pad" maxLength={3} value={score} onChangeText={setScore} placeholder="0-100" />
                </View>
                <View className="flex-1">
                  <Field label={t("prova.ai.feedbackLabel")} value={feedback} onChangeText={setFeedback} />
                </View>
              </View>
              <Button variant="secondary" title={t("prova.ai.saveScore")} loading={save.isPending} onPress={() => save.mutate()} />
              {save.error ? <Text className="font-body text-sm text-danger">{provaErrorMessage(save.error)}</Text> : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
