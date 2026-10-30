import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

interface Choice {
  key: string;
  text: string;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Deneme çözme: tek tek soru, şıklı ya da açık uçlu; süreli denemede geri sayım; bitince sonuç. */
export default function TakeExamScreen() {
  const { t } = useTranslation();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const queryClient = useQueryClient();
  const { actingChild } = useChildMode();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { key?: string; text?: string }>>({});
  const [now, setNow] = useState(() => Date.now());

  const attempt = useQuery({
    queryKey: ["attempt", examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("start_exam_attempt", { p_exam_id: examId });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });

  const questions = useQuery({
    queryKey: ["attempt_questions", examId],
    enabled: !!attempt.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_attempt_questions", { p_exam_id: examId });
      if (error) throw error;
      return data;
    },
  });

  const deadline = attempt.data?.deadline_at ? new Date(attempt.data.deadline_at).getTime() : null;
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const submit = useMutation({
    mutationFn: async ({ questionId, key, text }: { questionId: string; key?: string; text?: string }) => {
      const { error } = await supabase.rpc("submit_exam_answer", {
        p_attempt_id: attempt.data?.id ?? "",
        p_question_id: questionId,
        p_answer_key: key ?? undefined,
        p_answer_text: text ?? undefined,
      });
      if (error) throw error;
    },
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("finish_exam_attempt", { p_attempt_id: attempt.data?.id ?? "" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["child_exams"] }),
  });

  const timeUp = deadline !== null && now >= deadline;
  useEffect(() => {
    if (timeUp && !finish.isPending && !finish.data && attempt.data) finish.mutate();
  }, [timeUp, finish, attempt.data]);

  if (finish.data) {
    return (
      <Screen tone="child" title={t("prova.finished")}>
        <View className="items-center gap-3 rounded-child bg-white p-8 dark:bg-night-surface">
          <Text className="text-5xl">🎉</Text>
          <Text className="font-display text-2xl text-ink dark:text-night-text">
            {t("prova.resultMc", { correct: finish.data.mc_correct ?? 0, total: finish.data.mc_total ?? 0 })}
          </Text>
          <Text className="text-center text-base text-gray-600">{t("prova.openEndedNote")}</Text>
        </View>
        <Button size="child" title={t("prova.backToList")} onPress={() => router.replace(actingChild ? "/parent/child-mode/prova" : "/child/prova")} />
      </Screen>
    );
  }

  const list = questions.data ?? [];
  const q = list[index];
  const current = q ? answers[q.id] : undefined;
  const choices = (q?.choices as Choice[] | null) ?? [];

  async function saveAndGo(nextIndex: number) {
    if (q && current) await submit.mutateAsync({ questionId: q.id, key: current.key, text: current.text });
    if (nextIndex >= list.length) finish.mutate();
    else setIndex(nextIndex);
  }

  return (
    <Screen tone="child" title={t("prova.questionOf", { n: index + 1, total: list.length })}>
      {deadline ? (
        <Text className={`text-right font-display text-lg ${deadline - now < 60_000 ? "text-danger" : "text-teal-dark"}`}>
          ⏱ {formatRemaining(deadline - now)}
        </Text>
      ) : null}
      {q ? (
        <View className="gap-4 rounded-child bg-white p-5 dark:bg-night-surface">
          <Text className="font-body-bold text-xl leading-7 text-ink dark:text-night-text">{q.stem}</Text>
          {q.kind === "multiple_choice" ? (
            <View className="gap-2">
              {choices.map((choice) => {
                const selected = current?.key === choice.key;
                return (
                  <Pressable
                    key={choice.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setAnswers((a) => ({ ...a, [q.id]: { key: choice.key } }))}
                    className={`min-h-14 flex-row items-center gap-3 rounded-child border-2 px-4 py-3 ${selected ? "border-teal-dark bg-teal" : "border-mist bg-white"}`}
                  >
                    <Text className={`font-display text-lg ${selected ? "text-white" : "text-ink"}`}>{choice.key}</Text>
                    <Text className={`flex-1 text-base ${selected ? "font-body-bold text-white" : "text-ink"}`}>{choice.text}</Text>
                    {selected ? <Text className="text-lg text-white">✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              multiline
              value={current?.text ?? ""}
              onChangeText={(text) => setAnswers((a) => ({ ...a, [q.id]: { text } }))}
              placeholder={t("prova.writeAnswer")}
              placeholderTextColor="#9CA3AF"
              className="min-h-32 rounded-child border-2 border-mist bg-white p-3 text-base text-ink"
              textAlignVertical="top"
            />
          )}
        </View>
      ) : null}
      <ErrorText error={attempt.error ?? questions.error ?? submit.error ?? finish.error} />
      <View className="flex-row gap-2">
        {index > 0 ? (
          <View className="flex-1">
            <Button variant="secondary" size="child" title={t("prova.prev")} onPress={() => setIndex(index - 1)} />
          </View>
        ) : null}
        <View className="flex-1">
          <Button
            size="child"
            title={index + 1 >= list.length ? t("prova.finish") : t("prova.next")}
            loading={submit.isPending || finish.isPending}
            disabled={!q}
            onPress={() => void saveAndGo(index + 1)}
          />
        </View>
      </View>
    </Screen>
  );
}
