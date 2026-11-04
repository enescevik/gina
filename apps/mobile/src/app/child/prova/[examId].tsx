import { invalidateProvaLists } from "@/lib/prova-cache";
import { ChildReviewFeedback } from "@/components/learning/child-review-feedback";
import { ContextualQuestion } from "@/components/learning/question-context";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { QuestionMedia } from "@/components/learning/question-media";
import { NotebookWorkspace } from "@/components/learning/notebook-workspace";
import { NotebookPage } from "@/components/learning/notebook-page";
import { p, SatinButton } from "@/components/planner/ui";
import {
  type AnswerJournal,
  AnswerJournalConflict,
  notebookHasAnswer,
  readNotebook,
  SerialWrites,
} from "@gina/core";
import {
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  AppState,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Collectible } from "@/components/collectible";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";
import { decodeClaims, useSession } from "@/lib/session";
import { createAnswerJournal } from "@/lib/answer-journal";

import {
  acknowledgeAnswerDraft,
  mergeAnswerSnapshot,
  sameAnswer,
  type SavedAnswer as Answer,
} from "@/lib/answer-state";

interface Choice {
  key: string;
  text: string;
}

/** Cevap verilmiş mi: şık seçilmiş ya da boş olmayan metin yazılmış. */
function isAnswered(answer: Answer | undefined): boolean {
  return !!answer?.key || !!answer?.text?.trim() ||
    notebookHasAnswer(answer?.document);
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
  const { width } = useWindowDimensions();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const queryClient = useQueryClient();
  const { actingChild } = useChildMode();
  const { session, claims } = useSession();
  const [localError, setLocalError] = useState<unknown>(null);
  const [restored, setRestored] = useState<AnswerJournal | null>(null);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [confirmServerAnswer, setConfirmServerAnswer] = useState(false);
  const [showLocalCopies, setShowLocalCopies] = useState(false);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Answer>>({});
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const [unsavedAtDeadline, setUnsavedAtDeadline] = useState(false);
  const autoFinishAttempt = useRef<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Boş soru varken "Bitir"e basılınca satır içi onay gösterilir (web'de Alert yok).
  const [confirmFinish, setConfirmFinish] = useState(false);
  const lastAnnouncedMinute = useRef<number | null>(null);

  const attempt = useQuery({
    queryKey: ["attempt", examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("start_exam_attempt", {
        p_exam_id: examId,
      });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });

  const examInfo = useQuery({
    queryKey: ["notebook_exam_title", examId],
    enabled: !!attempt.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("title").eq(
        "id",
        examId,
      ).single();
      if (error) throw error;
      return data;
    },
  });

  const savedAnswers = useQuery({
    queryKey: ["attempt_saved_answers", attempt.data?.id],
    structuralSharing: mergeAnswerSnapshot,
    enabled: !!attempt.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saved_exam_answers_v3", {
        p_attempt_id: attempt.data?.id ?? "",
      });
      if (error) throw error;
      return Object.fromEntries(data.map((row) => {
        const document = readNotebook(row.answer_document);
        if (row.answer_document !== null && !document) {
          throw new Error("notebook_version_unsupported");
        }
        return [row.question_id, {
          key: row.answer_key ?? undefined,
          text: row.answer_text ?? undefined,
          revision: row.revision,
          document: document ?? undefined,
        }];
      })) as Record<string, Answer>;
    },
  });
  const answers: Record<string, Answer> = { ...savedAnswers.data, ...drafts };

  const questions = useQuery({
    queryKey: ["attempt_questions", examId],
    enabled: !!attempt.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_attempt_questions", {
        p_exam_id: examId,
      });
      if (error) throw error;
      return data;
    },
  });

  const deadline = attempt.data?.deadline_at
    ? new Date(attempt.data.deadline_at).getTime()
    : null;
  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [deadline]));

  // Son 5 dakikada ekran okuyucuya dakikada bir kalan süre duyurulur.
  const remainingMs = deadline ? deadline - now : null;
  const minutesLeft =
    remainingMs !== null && remainingMs > 0 && remainingMs < 5 * 60_000
      ? Math.ceil(remainingMs / 60_000)
      : null;
  useEffect(() => {
    if (minutesLeft === null || lastAnnouncedMinute.current === minutesLeft) {
      return;
    }
    lastAnnouncedMinute.current = minutesLeft;
    AccessibilityInfo.announceForAccessibility(
      t("prova.minutesLeft", { count: minutesLeft }),
    );
  }, [minutesLeft, t]);

  const [, renderWrites] = useState(0);
  const attemptId = attempt.data?.id;
  const owner = session?.user.id;
  const family = claims?.family_id;
  const child = attempt.data?.child_id;
  const journal = useMemo(
    () =>
      owner && family && child && attemptId
        ? createAnswerJournal(owner, family, child, attemptId)
        : null,
    [owner, family, child, attemptId],
  );
  const writes = useMemo(() => {
    return new SerialWrites<string, Answer>(
      async (questionId) => {
        if (!attemptId || !journal) throw new Error("attempt_not_found");
        await journal.send(questionId, async (receipt) => {
          const { data: auth } = await supabase.auth.getSession();
          const currentClaims = decodeClaims(auth.session?.access_token);
          if (
            auth.session?.user.id !== owner ||
            currentClaims?.family_id !== family ||
            (currentClaims?.role === "device" &&
              currentClaims.child_id !== child)
          ) throw new Error("forbidden");
          const abort = new AbortController();
          const timer = setTimeout(() => abort.abort(), 20_000);
          try {
            const { data, error } = await supabase.rpc(
              "submit_exam_answer_v3",
              {
                p_request_id: receipt.id,
                p_attempt_id: attemptId,
                p_question_id: questionId,
                p_expected_revision: receipt.revision,
                p_answer_key: receipt.answer.key,
                p_answer_text: receipt.answer.text,
                p_answer_document: receipt.answer.document,
              },
            ).abortSignal(abort.signal);
            if (error) throw error;
            return data;
          } finally {
            clearTimeout(timer);
          }
        }, (answer, revision) => {
          queryClient.setQueryData<Record<string, Answer>>(
            ["attempt_saved_answers", attemptId],
            (previous) => ({
              ...previous,
              [questionId]: { ...answer, revision },
            }),
          );
          setDrafts((previous) =>
            acknowledgeAnswerDraft(previous, questionId, answer, revision)
          );
        });
      },
      () => {},
      (task, delay) => {
        const timer = setTimeout(task, delay);
        return () => clearTimeout(timer);
      },
    );
  }, [attemptId, queryClient, journal, owner, family, child]);
  useEffect(() => {
    const unsubscribe = writes.observe(() => renderWrites((n) => n + 1));
    return () => {
      unsubscribe();
      writes.cancelPending();
    };
  }, [writes]);
  useEffect(() => {
    if (
      !journal || restored === journal || !savedAnswers.isSuccess ||
      !questions.isSuccess
    ) return;
    let live = true;
    // Hydrate external device storage after mount; a cancelled route must not replay it.
    void Promise.resolve().then(() => {
      if (!live) return;
      try {
        const recovered = journal.restore();
        const allowed = new Set(questions.data.map((q) => q.id));
        if (Object.keys(recovered).some((id) => !allowed.has(id))) {
          throw new Error("answer_local_invalid");
        }
        setDrafts(recovered);
        setRecoveredCount(Object.keys(recovered).length);
        setRestored(journal);
        setLocalError(null);
        if (
          attempt.data?.status === "in_progress" &&
          (!deadline || Date.now() < deadline)
        ) {
          for (const [id, value] of Object.entries(recovered)) {
            writes.enqueue(id, value);
          }
        }
      } catch (error) {
        setLocalError(error);
      }
    });
    return () => {
      live = false;
    };
  }, [
    journal,
    restored,
    savedAnswers.isSuccess,
    questions.isSuccess,
    questions.data,
    writes,
    attempt.data?.status,
    deadline,
    restoreAttempt,
  ]);
  const localReady = !!journal && restored === journal;
  const saving = writes.busy;
  useEffect(() => {
    const resume = () => {
      if (
        !localReady || localError || attempt.data?.status !== "in_progress" ||
        (deadline && Date.now() >= deadline)
      ) return;
      if (writes.error && !(writes.error instanceof AnswerJournalConflict)) {
        void writes.retry().catch(() => undefined);
      }
    };
    const unsubscribe = onlineManager.subscribe((online) => {
      if (online) resume();
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") resume();
    });
    return () => {
      unsubscribe();
      listener.remove();
    };
  }, [writes, localReady, localError, deadline, attempt.data?.status]);

  const finish = useMutation({
    mutationFn: async () => {
      if (!localReady || localError) {
        throw localError ?? new Error("answer_local_not_ready");
      }
      if (
        deadline && Date.now() >= deadline &&
        Object.keys(journal!.restore()).length
      ) setUnsavedAtDeadline(true);
      try {
        await writes.flush();
      } catch (error) {
        if (!deadline || Date.now() < deadline) throw error;
        setUnsavedAtDeadline(true);
      }
      const { data, error } = await supabase.rpc("finish_exam_attempt", {
        p_attempt_id: attempt.data?.id ?? "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["attempt", examId], result);
      void invalidateProvaLists(queryClient);
    },
  });

  const timeUp = deadline !== null && now >= deadline;
  const list = questions.data ?? [];
  const q = list[index];
  const current = q ? answers[q.id] : undefined;
  const draft = q ? drafts[q.id] : undefined;
  const saved = q ? savedAnswers.data?.[q.id] : undefined;
  const choices = (q?.choices as Choice[] | null) ?? [];
  const unanswered = list.filter((item) => !isAnswered(answers[item.id]));
  const result = finish.data ??
    (attempt.data?.status !== "in_progress" ? attempt.data : null);
  const differs = (a: Answer | undefined, b: Answer | undefined) =>
    !sameAnswer(a, b);
  const dirty = !!draft && differs(draft, saved);
  const anyDirty = Object.entries(drafts).some(([id, value]) =>
    differs(value, savedAnswers.data?.[id])
  );

  usePreventRemove(
    !allowExit && !result && (anyDirty || saving),
    ({ repeat }) => setLeaveAction(() => repeat),
  );

  useEffect(() => {
    if (
      !timeUp || !localReady || localError || finish.isPending || result ||
      !attempt.data || autoFinishAttempt.current === attempt.data.id
    ) return;
    autoFinishAttempt.current = attempt.data.id;
    finish.mutate();
  }, [timeUp, saving, finish, result, attempt.data, localReady, localError]);

  function editAnswer(answer: Answer) {
    if (!q || timeUp || result || !savedAnswers.isSuccess || !localReady) {
      return;
    }
    setConfirmFinish(false);
    const revision = drafts[q.id]?.revision ??
      savedAnswers.data?.[q.id]?.revision ?? 0;
    setDrafts((previous) => ({ ...previous, [q.id]: { ...answer, revision } }));
    try {
      journal.edit(q.id, {
        key: answer.key,
        text: answer.text,
        document: answer.document,
      }, revision);
      setLocalError(null);
    } catch (error) {
      setLocalError(error);
      return;
    }
    writes.enqueue(q.id, answer, q.kind === "multiple_choice" ? 0 : 400);
  }

  function retryLocal() {
    if (!journal) return;
    if (restored !== journal) {
      setRestoreAttempt((n) => n + 1);
      return;
    }
    try {
      for (const [id, value] of Object.entries(drafts)) {
        journal.edit(id, {
          key: value.key,
          text: value.text,
          document: value.document,
        }, value.revision ?? savedAnswers.data?.[id]?.revision ?? 0);
        writes.enqueue(id, value);
      }
      setLocalError(null);
      void writes.retry().catch(() => undefined);
    } catch (error) {
      setLocalError(error);
    }
  }
  async function adoptServerAnswer() {
    const conflict = writes.error;
    if (!(conflict instanceof AnswerJournalConflict) || !journal) return;
    try {
      const refreshed = await savedAnswers.refetch();
      if (refreshed.error) throw refreshed.error;
      journal.discard(conflict.questionId);
      writes.cancelPending();
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[conflict.questionId];
        return next;
      });
      setConfirmServerAnswer(false);
      setLocalError(null);
      if (!timeUp) {
        for (const [id, answer] of Object.entries(journal.restore())) {
          writes.enqueue(id, answer);
        }
      }
    } catch (error) {
      setLocalError(error);
    }
  }
  const localNotice = (
    <>
      {recoveredCount > 0
        ? (
          <Text
            accessibilityLiveRegion="polite"
            className="font-body text-sm text-ink"
          >
            {t("notebook.localRecovered", { count: recoveredCount })}
          </Text>
        )
        : null}
      {localError
        ? (
          <View>
            <Text accessibilityRole="alert">{t("notebook.localFailed")}</Text>
            <Button title={t("common.retry")} onPress={retryLocal} />
          </View>
        )
        : null}
      {writes.error instanceof AnswerJournalConflict
        ? (
          <View>
            <Text>{t("notebook.conflictHelp")}</Text>
            {confirmServerAnswer
              ? (
                <>
                  <Text>{t("notebook.useServerConfirm")}</Text>
                  <Button
                    title={t("notebook.useServer")}
                    onPress={() => {
                      void adoptServerAnswer();
                    }}
                  />
                  <Button
                    variant="ghost"
                    title={t("common.cancel")}
                    onPress={() => setConfirmServerAnswer(false)}
                  />
                </>
              )
              : (
                <Button
                  variant="secondary"
                  title={t("notebook.useServer")}
                  onPress={() => setConfirmServerAnswer(true)}
                />
              )}
          </View>
        )
        : null}
    </>
  );

  if (result) {
    return (
      <Screen
        tone="child"
        surface="desk"
        title={t("prova.finished")}
        subtitle={t("releaseReview.examDone")}
      >
        <View className="items-center gap-3 rounded-child bg-white p-8">
          <Collectible slug="display-first-task" size={96} />
          <Text className="font-display text-2xl text-ink">
            {t("prova.resultMc", {
              correct: result.mc_correct ?? 0,
              total: result.mc_total ?? 0,
            })}
          </Text>
          {(result.open_graded ?? 0) < (result.open_total ?? 0) && (
            <Text className="font-body text-center text-base text-gray-600">
              {t("prova.openEndedNote")}
            </Text>
          )}
        </View>
        <ChildReviewFeedback attemptId={result.id} />
        {localNotice}
        {anyDirty
          ? (
            <View className="gap-3 rounded-child bg-cream p-4">
              <Text>{t("notebook.finishedLocal")}</Text>
              <Button
                variant="secondary"
                title={t(
                  showLocalCopies ? "notebook.hideLocal" : "notebook.showLocal",
                )}
                onPress={() => setShowLocalCopies((value) => !value)}
              />
              {showLocalCopies
                ? Object.entries(drafts).filter(([id, value]) =>
                  differs(value, savedAnswers.data?.[id])
                ).map(([id, value]) => (
                  <View key={id} className="gap-2">
                    <Text className="font-body-bold">
                      {list.find((item) => item.id === id)?.stem}
                    </Text>
                    {value.key ? <Text>{value.key}</Text> : null}
                    {value.text ? <Text>{value.text}</Text> : null}
                    {value.document
                      ? (
                        <NotebookPage
                          document={value.document}
                          width={Math.max(200, Math.min(600, width - 96))}
                        />
                      )
                      : null}
                  </View>
                ))
                : null}
            </View>
          )
          : null}
        {unsavedAtDeadline
          ? (
            <Text
              accessibilityRole="alert"
              className="font-body text-base text-danger"
            >
              {t("learningReport.unsavedDeadline")}
            </Text>
          )
          : null}
        <Button
          size="child"
          title={t("prova.backToList")}
          onPress={() =>
            router.replace(
              actingChild ? "/parent/child-mode/prova" : "/child/prova",
            )}
        />
      </Screen>
    );
  }

  function saveAndGo(nextIndex: number) {
    if (timeUp) return;
    if (nextIndex >= list.length) {
      if (unanswered.length > 0) {
        setConfirmFinish(true);
        AccessibilityInfo.announceForAccessibility(
          t("prova.unansweredConfirm", { count: unanswered.length }),
        );
      } else finish.mutate();
    } else goTo(nextIndex);
  }

  function goTo(nextIndex: number) {
    setConfirmFinish(false);
    setIndex(nextIndex);
  }

  if (q?.kind === "open_ended" && savedAnswers.isSuccess) {
    return (
      <NotebookWorkspace
        key={q.id}
        title={examInfo.data?.title ?? t("prova.title")}
        progress={`${index + 1} / ${list.length}`}
        questionId={q.id}
        stem={q.stem}
        document={current?.document}
        text={current?.text ?? ""}
        onChange={(document) => editAnswer({ ...current, document })}
        onTextChange={(text) => editAnswer({ ...current, text })}
        disabled={timeUp || finish.isPending || !localReady || !!localError}
        onExit={() =>
          router.replace(
            actingChild ? "/parent/child-mode/prova" : "/child/prova",
          )}
        saved={localReady && !localError && !timeUp && !writes.error &&
          !dirty && !saving}
        status={(deadline
          ? t("prova.timeLeft", { time: formatRemaining(deadline - now) }) +
            " · "
          : "") + (localError
            ? t("notebook.localFailed")
            : timeUp
            ? t("provaV5.timeEnded")
            : writes.error
            ? t("notebook.localPending")
            : dirty || saving || !localReady
            ? t("provaV5.savingAnswer")
            : t("notebook.saved"))}
        alerts={
          <>
            {localNotice}
            <ErrorText error={writes.error ?? finish.error} />
            {writes.error && !timeUp
              ? (
                <Button
                  title={t("common.retry")}
                  onPress={() => {
                    void writes.retry().catch(() => undefined);
                  }}
                />
              )
              : null}
            {leaveAction
              ? (
                <View>
                  <Text>
                    {t(
                      localError
                        ? "provaV5.unsaved"
                        : "notebook.leaveStoredHelp",
                    )}
                  </Text>
                  <Button
                    title={t("provaV5.keepWorking")}
                    onPress={() => setLeaveAction(null)}
                  />
                  <Button
                    variant="ghost"
                    title={t(
                      localError ? "provaV5.discard" : "notebook.leaveStored",
                    )}
                    onPress={() => {
                      writes.cancelPending();
                      setAllowExit(true);
                      leaveAction();
                    }}
                  />
                </View>
              )
              : null}
            {confirmFinish && unanswered.length > 0
              ? (
                <View>
                  <Text>
                    {t("prova.unansweredConfirm", { count: unanswered.length })}
                  </Text>
                  <Button
                    title={t("prova.goToUnanswered")}
                    onPress={() =>
                      goTo(
                        list.findIndex((item) => item.id === unanswered[0]?.id),
                      )}
                  />
                  <Button
                    title={t("prova.finishAnyway")}
                    disabled={saving || timeUp}
                    loading={finish.isPending}
                    onPress={() => finish.mutate()}
                  />
                </View>
              )
              : null}
            {timeUp && finish.error
              ? (
                <Button
                  title={t("common.retry")}
                  onPress={() => finish.mutate()}
                />
              )
              : null}
          </>
        }
        footer={
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              justifyContent: "flex-end",
            }}
          >
            {index > 0
              ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("prova.prev")}
                  disabled={finish.isPending || timeUp}
                  onPress={() => saveAndGo(index - 1)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: p.lilac,
                  }}
                >
                  <ArrowLeft size={22} color={p.purple} />
                </Pressable>
              )
              : null}
            <SatinButton
              title={t(
                index + 1 >= list.length
                  ? "prova.finish"
                  : "notebook.nextQuestion",
              )}
              disabled={timeUp}
              busy={finish.isPending}
              onPress={() => saveAndGo(index + 1)}
              icon={<ArrowRight size={20} color="#fff" />}
              style={{
                minHeight: 48,
                borderRadius: 28,
                paddingVertical: 10,
                paddingHorizontal: 18,
              }}
            />
          </View>
        }
      />
    );
  }

  return (
    <Screen
      tone="child"
      surface="desk"
      loading={attempt.isLoading || questions.isLoading ||
        savedAnswers.isLoading}
      title={list.length
        ? t("prova.questionOf", { n: index + 1, total: list.length })
        : t("prova.title")}
    >
      {deadline
        ? (
          <Text
            accessibilityLabel={t("prova.timeLeft", {
              time: formatRemaining(deadline - now),
            })}
            className={`text-right font-display text-lg ${
              deadline - now < 60_000 ? "text-danger" : "text-teal-dark"
            }`}
          >
            ⏱ {formatRemaining(deadline - now)}
          </Text>
        )
        : null}
      {q
        ? (
          <View className="gap-4 rounded-child bg-cream p-5">
            <ContextualQuestion questionId={q.id} stem={q.stem} />
            <QuestionMedia questionId={q.id} />
            {q.kind === "multiple_choice"
              ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("prova.choicesLabel")}
                  className="gap-2"
                >
                  {choices.map((choice) => {
                    const selected = current?.key === choice.key;
                    return (
                      <Pressable
                        key={choice.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`${choice.key}, ${choice.text}`}
                        accessibilityState={{ checked: selected, selected }}
                        aria-checked={selected}
                        disabled={timeUp || finish.isPending ||
                          !savedAnswers.isSuccess || !localReady ||
                          !!localError}
                        onPress={() => editAnswer({ key: choice.key })}
                        className={`min-h-14 flex-row items-center gap-3 rounded-child border-2 px-4 py-3 ${
                          selected
                            ? "border-teal-dark bg-teal-dark"
                            : "border-mist bg-white"
                        }`}
                      >
                        <Text
                          className={`font-display text-lg ${
                            selected ? "text-white" : "text-ink"
                          }`}
                        >
                          {choice.key}
                        </Text>
                        <Text
                          className={`flex-1 text-base ${
                            selected
                              ? "font-body-bold text-white"
                              : "font-body text-ink"
                          }`}
                        >
                          {choice.text}
                        </Text>
                        {selected
                          ? (
                            <Text className="font-body text-lg text-white">
                              ✓
                            </Text>
                          )
                          : null}
                      </Pressable>
                    );
                  })}
                </View>
              )
              : (
                <TextInput
                  multiline
                  accessibilityLabel={t("prova.answerLabel")}
                  value={current?.text ?? ""}
                  editable={!timeUp && !finish.isPending &&
                    savedAnswers.isSuccess}
                  onChangeText={(text) => editAnswer({ text })}
                  placeholder={t("prova.writeAnswer")}
                  placeholderTextColor="#9CA3AF"
                  className="font-body min-h-32 rounded-child border-2 border-mist bg-white p-3 text-base text-ink"
                  textAlignVertical="top"
                />
              )}
          </View>
        )
        : null}
      {confirmFinish && unanswered.length > 0
        ? (
          <View
            accessibilityLiveRegion="polite"
            className="gap-3 rounded-child bg-coral-light p-4"
          >
            <Text className="font-body-bold text-base text-ink">
              {t("prova.unansweredConfirm", { count: unanswered.length })}
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  variant="secondary"
                  size="child"
                  title={t("prova.goToUnanswered")}
                  disabled={timeUp || finish.isPending ||
                    !savedAnswers.isSuccess}
                  onPress={() =>
                    goTo(
                      list.findIndex((item) => item.id === unanswered[0]?.id),
                    )}
                />
              </View>
              <View className="flex-1">
                <Button
                  size="child"
                  title={t("prova.finishAnyway")}
                  disabled={saving || timeUp}
                  loading={finish.isPending}
                  onPress={() => finish.mutate()}
                />
              </View>
            </View>
          </View>
        )
        : null}
      {localNotice}
      <Text
        accessibilityLiveRegion="polite"
        className="font-body text-sm text-gray-600"
      >
        {timeUp
          ? t("provaV5.timeEnded")
          : writes.error
          ? t("notebook.localPending")
          : dirty || saving || !localReady
          ? t("provaV5.savingAnswer")
          : t("provaV5.answerSaved")}
      </Text>
      <ErrorText
        error={attempt.error ?? questions.error ?? savedAnswers.error ??
          writes.error ?? finish.error}
      />
      {attempt.error || questions.error || savedAnswers.error
        ? (
          <Button
            title={t("common.retry")}
            onPress={() => {
              void attempt.refetch();
              if (attempt.data) {
                void questions.refetch();
                void savedAnswers.refetch();
              }
            }}
          />
        )
        : null}
      {writes.error && !timeUp
        ? (
          <Button
            title={t("common.retry")}
            onPress={() => {
              void writes.retry().catch(() => undefined);
            }}
          />
        )
        : null}
      {leaveAction
        ? (
          <View className="gap-3 rounded-child bg-coral-light p-4">
            <Text className="font-body-bold text-base text-ink">
              {t(localError ? "provaV5.unsaved" : "notebook.leaveStoredHelp")}
            </Text>
            <Button
              title={t("provaV5.keepWorking")}
              onPress={() => setLeaveAction(null)}
            />
            <Button
              variant="ghost"
              title={t(localError ? "provaV5.discard" : "notebook.leaveStored")}
              onPress={() => {
                writes.cancelPending();
                setAllowExit(true);
                leaveAction();
              }}
            />
          </View>
        )
        : null}
      {timeUp && finish.error
        ? (
          <Button
            title={t("common.retry")}
            loading={finish.isPending}
            onPress={() => finish.mutate()}
          />
        )
        : null}
      <View className="flex-row gap-2">
        {index > 0
          ? (
            <View className="flex-1">
              <Button
                variant="secondary"
                size="child"
                title={t("prova.prev")}
                disabled={finish.isPending || timeUp}
                onPress={() => void saveAndGo(index - 1)}
              />
            </View>
          )
          : null}
        <View className="flex-1">
          <Button
            size="child"
            title={index + 1 >= list.length
              ? t("prova.finish")
              : t("prova.next")}
            loading={finish.isPending}
            disabled={!q || timeUp || !!savedAnswers.error}
            onPress={() => void saveAndGo(index + 1)}
          />
        </View>
      </View>
      <Button
        variant="ghost"
        title={t("prova.backToList")}
        disabled={finish.isPending}
        onPress={() => router.replace(
          actingChild ? "/parent/child-mode/prova" : "/child/prova",
        )}
      />
    </Screen>
  );
}
