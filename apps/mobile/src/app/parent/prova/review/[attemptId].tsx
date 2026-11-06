import { useCallback, useState } from "react";
import { openAnswerState } from "@gina/core";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ParentScreen } from "@/components/ui/parent-screen";
import {
  ParentReviewWorkspace,
  type ReviewState,
} from "@/components/learning/parent-review-workspace";
import { REVIEW_SNAPSHOT_OPTIONS } from "@/lib/answer-state";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ParentReviewScreen() {
  const { attemptId, questionId } = useLocalSearchParams<
    { attemptId: string; questionId?: string }
  >();
  const { claims } = useSession();
  const { t } = useTranslation();
  const [position, setPosition] = useState<
    { attempt: string; question: string | undefined; index: number } | null
  >(null);
  const family = claims?.family_id;
  const attempt = useQuery({
    queryKey: ["review_workspace", family, attemptId],
    ...REVIEW_SNAPSHOT_OPTIONS,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_attempts").select(
        "id,status,children(name),exams(question_ids)",
      ).eq("id", attemptId).single();
      if (error) throw error;
      const ids = data.exams?.question_ids ?? [];
      const [qs, answers] = await Promise.all([
        supabase.from("question_bank").select(
          "id,stem,kind,choices,correct_key,expected_answer,solution,explanation,provenance",
        ).in("id", ids),
        supabase.from("exam_answers").select(
          "question_id,answer_document,answer_text,answer_key,is_correct,score,graded_by,ai_score",
        ).eq("attempt_id", attemptId),
      ]);
      if (qs.error || answers.error) throw qs.error ?? answers.error;
      if (
        !ids.length || ids.some((id) => !qs.data.some((q) => q.id === id))
      ) throw new Error("question_not_found");
      return {
        ...data,
        questions: ids.map((id) => qs.data.find((q) => q.id === id)!),
        answers: answers.data,
      };
    },
  });
  const requestedIndex = Math.max(
    0,
    attempt.data?.questions.findIndex((q) => q.id === questionId) ?? 0,
  );
  const index =
    position?.attempt === attemptId && position.question === questionId
      ? position.index
      : requestedIndex;
  const q = attempt.data?.questions[index];
  const review = useQuery({
    queryKey: ["answer_review", family, attemptId, q?.id],
    enabled: !!q,
    ...REVIEW_SNAPSHOT_OPTIONS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_answer_review", {
        p_attempt_id: attemptId,
        p_question_id: q!.id,
      });
      if (error) throw error;
      return data as unknown as ReviewState;
    },
  });
  const policy = useQuery({
    queryKey: ["review_ai_policy", family],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_review_ai_policy");
      if (error) throw error;
      return data as unknown as { enabled: boolean; remaining: number };
    },
  });
  const count = attempt.data?.questions.length ?? 0;
  const navigate = useCallback((next: number) => {
    if (next < 0 || next >= count) {
      router.replace(`/parent/prova/attempt/${attemptId}`);
    } else {setPosition({
        attempt: attemptId,
        question: questionId,
        index: next,
      });}
  }, [attemptId, questionId, count]);
  if (
    !attempt.data || !review.data || review.isFetching || !q || attempt.error ||
    review.error
  ) {
    return (
      <ParentScreen
        title={t("parentReview.assessment")}
        loading={!attempt.error && !review.error &&
          (attempt.isPending || review.isPending || review.isFetching)}
        error={attempt.error ?? review.error}
        onRetry={() => {
          void attempt.refetch();
          void review.refetch();
        }}
      >
        <></>
      </ParentScreen>
    );
  }
  return (
    <ParentReviewWorkspace
      key={`${family}:${attemptId}:${q.id}`}
      attemptId={attemptId}
      childName={attempt.data.children?.name ?? ""}
      question={q}
      answer={attempt.data.answers.find((a) => a.question_id === q.id)}
      review={review.data}
      index={index}
      count={count}
      questionStates={attempt.data.questions.map((question) => {
        const answer = attempt.data.answers.find((item) =>
          item.question_id === question.id
        );
        if (question.kind === "multiple_choice") {
          return answer?.answer_key ? "reviewed" : "empty";
        }
        // P04: sunucu kuralıyla aynı — veli puanı (açık 0 dahil) "değerlendirildi";
        // yalnız çizim "inceleme bekliyor"; ne metin ne çizim "cevap yok" (0 değil).
        const state = openAnswerState(answer ?? {});
        return state === "graded"
          ? "reviewed"
          : state === "pending"
          ? "waiting"
          : "empty";
      })}
      finished={attempt.data.status !== "in_progress"}
      onNavigate={navigate}
      onReload={() => { void review.refetch(); void attempt.refetch(); }}
      aiRemaining={policy.data?.enabled ? policy.data.remaining : null}
    />
  );
}
