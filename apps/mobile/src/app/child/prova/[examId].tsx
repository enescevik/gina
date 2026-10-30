import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useFocusEffect, usePreventRemove } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, AppState, Pressable, Text, TextInput, View } from "react-native";

import { Collectible } from "@/components/collectible";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

type Answer = { key?: string; text?: string };

interface Choice {
  key: string;
  text: string;
}

/** Cevap verilmiş mi: şık seçilmiş ya da boş olmayan metin yazılmış. */
function isAnswered(answer: { key?: string; text?: string } | undefined): boolean {
  return !!answer?.key || !!answer?.text?.trim();
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
  const [drafts, setDrafts] = useState<Record<string, Answer>>({});
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const autoFinishAttempt = useRef<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Boş soru varken "Bitir"e basılınca satır içi onay gösterilir (web'de Alert yok).
  const [confirmFinish, setConfirmFinish] = useState(false);
  const lastAnnouncedMinute = useRef<number | null>(null);

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

  const savedAnswers = useQuery({
    queryKey: ["attempt_saved_answers", attempt.data?.id],
    enabled: !!attempt.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saved_exam_answers", { p_attempt_id: attempt.data?.id ?? "" });
      if (error) throw error;
      return Object.fromEntries(data.map(row => [row.question_id, { key: row.answer_key ?? undefined, text: row.answer_text ?? undefined }])) as Record<string, Answer>;
    },
  });
  const answers: Record<string, Answer> = { ...savedAnswers.data, ...drafts };

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
  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") setNow(Date.now()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [deadline]));

  // Son 5 dakikada ekran okuyucuya dakikada bir kalan süre duyurulur.
  const remainingMs = deadline ? deadline - now : null;
  const minutesLeft = remainingMs !== null && remainingMs > 0 && remainingMs < 5 * 60_000 ? Math.ceil(remainingMs / 60_000) : null;
  useEffect(() => {
    if (minutesLeft === null || lastAnnouncedMinute.current === minutesLeft) return;
    lastAnnouncedMinute.current = minutesLeft;
    AccessibilityInfo.announceForAccessibility(t("prova.minutesLeft", { count: minutesLeft }));
  }, [minutesLeft, t]);

  const submit = useMutation({
    mutationFn: async ({ questionId, key, text }: { questionId: string; key?: string; text?: string }) => {
      const { error } = await supabase.rpc("submit_exam_answer", {
        p_attempt_id: attempt.data?.id ?? "",
        p_question_id: questionId,
        p_answer_key: key ?? undefined,
        p_answer_text: text ?? undefined,
      });
      if (error) throw error;
      return { questionId, key, text };
    },
    onSuccess: saved => queryClient.setQueryData<Record<string, Answer>>(["attempt_saved_answers", attempt.data?.id], previous => ({ ...previous, [saved.questionId]: { key: saved.key, text: saved.text } })),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("finish_exam_attempt", { p_attempt_id: attempt.data?.id ?? "" });
      if (error) throw error;
      return data;
    },
    onSuccess: result => {
      queryClient.setQueryData(["attempt", examId], result);
      void queryClient.invalidateQueries({ queryKey: ["child_exams"] });
    },
  });

  const timeUp = deadline !== null && now >= deadline;
  const list = questions.data ?? [];
  const q = list[index];
  const current = q ? answers[q.id] : undefined;
  const draft = q ? drafts[q.id] : undefined;
  const saved = q ? savedAnswers.data?.[q.id] : undefined;
  const choices = (q?.choices as Choice[] | null) ?? [];
  const unanswered = list.filter(item => !isAnswered(answers[item.id]));
  const { mutate: saveAnswer, isPending: saving, isError: saveFailed } = submit;
  const result = finish.data ?? (attempt.data?.status !== "in_progress" ? attempt.data : null);
  const dirty = !!draft && (draft.key !== saved?.key || draft.text !== saved?.text);

  usePreventRemove(!allowExit && !result && (dirty || saving), ({ repeat }) => setLeaveAction(() => repeat));

  // Save the latest draft after typing settles. One request at a time; errors need explicit retry/edit.
  useEffect(() => {
    if (!q || !draft || !dirty || saving || saveFailed || timeUp || result) return;
    const timer = setTimeout(() => saveAnswer({ questionId: q.id, ...draft }), 450);
    return () => clearTimeout(timer);
  }, [q, draft, dirty, saving, saveFailed, timeUp, result, saveAnswer]);

  useEffect(() => {
    if (!timeUp || saving || finish.isPending || result || !attempt.data || autoFinishAttempt.current === attempt.data.id) return;
    autoFinishAttempt.current = attempt.data.id;
    finish.mutate();
  }, [timeUp, saving, finish, result, attempt.data]);

  function editAnswer(answer: Answer) {
    if (!q || timeUp || result) return;
    setConfirmFinish(false);
    if (submit.isError) submit.reset();
    setDrafts(previous => ({ ...previous, [q.id]: answer }));
  }

  if (result) {
    return <Screen tone="child" surface="desk" title={t("prova.finished")}>
      <View className="items-center gap-3 rounded-child bg-white p-8">
        <Collectible slug="display-first-task" size={96} />
        <Text className="font-display text-2xl text-ink">{t("prova.resultMc", { correct: result.mc_correct ?? 0, total: result.mc_total ?? 0 })}</Text>
        <Text className="font-body text-center text-base text-gray-600">{t("prova.openEndedNote")}</Text>
      </View>
      <Button size="child" title={t("prova.backToList")} onPress={() => router.replace(actingChild ? "/parent/child-mode/prova" : "/child/prova")} />
    </Screen>;
  }

  async function saveAndGo(nextIndex: number) {
    try {
      if (q && current && dirty) await submit.mutateAsync({ questionId: q.id, key: current.key, text: current.text });
    } catch { return; } // Error stays visible; keep the draft and current question.
    if (timeUp) return;
    if (nextIndex >= list.length) {
      if (unanswered.length > 0) {
        setConfirmFinish(true);
        AccessibilityInfo.announceForAccessibility(t("prova.unansweredConfirm", { count: unanswered.length }));
      } else finish.mutate();
    } else goTo(nextIndex);
  }

  function goTo(nextIndex: number) {
    setConfirmFinish(false);
    setIndex(nextIndex);
  }

  return (
    <Screen tone="child" surface="desk" loading={attempt.isLoading || questions.isLoading || savedAnswers.isLoading} title={list.length ? t("prova.questionOf", { n: index + 1, total: list.length }) : t("prova.title")}>
      {deadline ? (
        <Text
          accessibilityLabel={t("prova.timeLeft", { time: formatRemaining(deadline - now) })}
          className={`text-right font-display text-lg ${deadline - now < 60_000 ? "text-danger" : "text-teal-dark"}`}>
          ⏱ {formatRemaining(deadline - now)}
        </Text>
      ) : null}
      {q ? (
        <View className="gap-4 rounded-child bg-cream p-5">
          <Text accessibilityRole="header" className="font-body-bold text-xl leading-7 text-ink">{q.stem}</Text>
          {q.kind === "multiple_choice" ? (
            <View accessibilityRole="radiogroup" accessibilityLabel={t("prova.choicesLabel")} className="gap-2">
              {choices.map((choice) => {
                const selected = current?.key === choice.key;
                return (
                  <Pressable
                    key={choice.key}
                    accessibilityRole="radio"
                    accessibilityLabel={`${choice.key}, ${choice.text}`}
                    accessibilityState={{ checked: selected, selected }}
                    aria-checked={selected}
                    disabled={timeUp || finish.isPending}
                    onPress={() => editAnswer({ key: choice.key })}
                    className={`min-h-14 flex-row items-center gap-3 rounded-child border-2 px-4 py-3 ${selected ? "border-teal-dark bg-teal-dark" : "border-mist bg-white"}`}
                  >
                    <Text className={`font-display text-lg ${selected ? "text-white" : "text-ink"}`}>{choice.key}</Text>
                    <Text className={`flex-1 text-base ${selected ? "font-body-bold text-white" : "font-body text-ink"}`}>{choice.text}</Text>
                    {selected ? <Text className="font-body text-lg text-white">✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              multiline
              accessibilityLabel={t("prova.answerLabel")}
              value={current?.text ?? ""}
              editable={!timeUp && !finish.isPending}
              onChangeText={text => editAnswer({ text })}
              placeholder={t("prova.writeAnswer")}
              placeholderTextColor="#9CA3AF"
              className="font-body min-h-32 rounded-child border-2 border-mist bg-white p-3 text-base text-ink"
              textAlignVertical="top"
            />
          )}
        </View>
      ) : null}
      {confirmFinish && unanswered.length > 0 ? (
        <View accessibilityLiveRegion="polite" className="gap-3 rounded-child bg-coral-light p-4">
          <Text className="font-body-bold text-base text-ink">{t("prova.unansweredConfirm", { count: unanswered.length })}</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                variant="secondary"
                size="child"
                title={t("prova.goToUnanswered")}
                disabled={timeUp || finish.isPending} onPress={() => goTo(list.findIndex((item) => item.id === unanswered[0]?.id))}
              />
            </View>
            <View className="flex-1">
              <Button size="child" title={t("prova.finishAnyway")} disabled={submit.isPending || timeUp} loading={finish.isPending} onPress={() => finish.mutate()} />
            </View>
          </View>
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" className="font-body text-sm text-gray-600">{timeUp ? t("provaV5.timeEnded") : submit.error ? t("provaV5.saveFailed") : dirty || saving ? t("provaV5.savingAnswer") : t("provaV5.answerSaved")}</Text>
      <ErrorText error={attempt.error ?? questions.error ?? savedAnswers.error ?? submit.error ?? finish.error} />
      {attempt.error || questions.error || savedAnswers.error ? <Button title={t("common.retry")} onPress={() => { void attempt.refetch(); if (attempt.data) { void questions.refetch(); void savedAnswers.refetch(); } }} /> : null}
      {submit.error && !timeUp && q && current ? <Button title={t("common.retry")} loading={submit.isPending} onPress={() => submit.mutate({ questionId: q.id, ...current })} /> : null}
      {leaveAction ? <View className="gap-3 rounded-child bg-coral-light p-4">
        <Text className="font-body-bold text-base text-ink">{t("provaV5.unsaved")}</Text>
        <Button title={t("provaV5.keepWorking")} onPress={() => setLeaveAction(null)} />
        <Button variant="ghost" title={t("provaV5.discard")} disabled={saving} onPress={() => { setAllowExit(true); leaveAction(); }} />
      </View> : null}
      {timeUp && finish.error ? <Button title={t("common.retry")} loading={finish.isPending} onPress={() => finish.mutate()} /> : null}
      <View className="flex-row gap-2">
        {index > 0 ? (
          <View className="flex-1">
            <Button variant="secondary" size="child" title={t("prova.prev")} disabled={submit.isPending || finish.isPending || timeUp} onPress={() => void saveAndGo(index - 1)} />
          </View>
        ) : null}
        <View className="flex-1">
          <Button
            size="child"
            title={index + 1 >= list.length ? t("prova.finish") : t("prova.next")}
            loading={submit.isPending || finish.isPending}
            disabled={!q || timeUp || !!savedAnswers.error}
            onPress={() => void saveAndGo(index + 1)}
          />
        </View>
      </View>
      <Button variant="ghost" title={t("prova.backToList")} disabled={finish.isPending} onPress={() => router.replace(actingChild ? "/parent/child-mode/prova" : "/child/prova")} />
    </Screen>
  );
}
