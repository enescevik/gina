import { invalidateProvaLists } from "@/lib/prova-cache";
import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePreventRemove } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronDown,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Sparkles,
  Check,
  X,
} from "lucide-react-native";
import { emptyNotebook, readNotebook, type ReviewDraft, type ReviewBase } from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";
import { useSession, decodeClaims } from "@/lib/session";
import { createReviewJournal } from "@/lib/review-journal";
import { invokeProvaAi, provaErrorMessage } from "@/lib/prova-ai";
import { NotebookEditor } from "./notebook-editor";
import { useQuestionContext } from "./question-context";
import { QuestionMedia } from "./question-media";

export interface ReviewQuestion {
  id: string;
  stem: string;
  kind: string;
  expected_answer: string | null;
  solution: string | null;
  choices: unknown;
  correct_key: string | null;
}
export interface ReviewAnswer {
  answer_document: unknown;
  answer_text: string | null;
  answer_key: string | null;
  is_correct: boolean | null;
}
export interface ReviewState {
  score: number | null;
  feedback: string | null;
  document: unknown;
  revision: number;
  answer_hash: string;
}
export interface ReviewSuggestion {
  id: string;
  result: {
    score: number | null;
    readable: boolean;
    feedback: string;
    evidence: string[];
    next_step: string;
    limitation: string;
  };
}
export function ParentReviewWorkspace(
  {
    attemptId,
    childName,
    question,
    answer,
    review,
    index,
    count,
    finished,
    onNavigate,
    onReload,
    aiRemaining,
    questionStates,
  }: {
    attemptId: string;
    childName: string;
    question: ReviewQuestion;
    answer?: ReviewAnswer;
    review: ReviewState;
    index: number;
    count: number;
    finished: boolean;
    onNavigate: (index: number) => void;
    onReload: () => void;
    aiRemaining: number | null;
    questionStates: ("empty" | "reviewed" | "waiting")[];
  },
) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { session, claims } = useSession();
  const userId = session?.user.id, familyId = claims?.family_id;
  const journal = useMemo(() => userId && familyId
    ? createReviewJournal(userId, familyId, attemptId, question.id) : null,
  [userId, familyId, attemptId, question.id]);
  const [localReady, setLocalReady] = useState(false);
  const [localError, setLocalError] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [staleDraft, setStaleDraft] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreTry, setRestoreTry] = useState(0);
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 900 && height >= 540 && fontScale < 1.4;
  const stackedFooter = width < 380 || fontScale >= 1.4;
  const [picker, setPicker] = useState(false);
  const [questionPreview, setQuestionPreview] = useState(false);
  const [tab, setTab] = useState<"solution" | "assessment">("solution");
  const [expanded, setExpanded] = useState(false),
    [sourceOpen, setSourceOpen] = useState(true),
    [keyOpen, setKeyOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(true),
    [document, setDocument] = useState(
      readNotebook(review.document) ?? emptyNotebook(),
    );
  const [score, setScore] = useState(
      review.score === null ? "" : String(review.score),
    ),
    [feedback, setFeedback] = useState(review.feedback ?? "");
  const [exit, setExit] = useState<(() => void) | null>(null);
  const [dirty, setDirty] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const [aiOpen, setAiOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [suggestion, setSuggestion] = useState<ReviewSuggestion | null>(null),
    [appliedAi, setAppliedAi] = useState<string | null>(null);
  const request = useRef<string | null>(null);
  const draftRef = useRef<ReviewDraft>({score, feedback, document, appliedAi});
  const baseRef = useRef<ReviewBase>({revision:review.revision, answerHash:review.answer_hash, openEnded:question.kind === "open_ended"});
  const original = useMemo(() => readNotebook(answer?.answer_document), [
    answer?.answer_document,
  ]);
  const [notesOpen, setNotesOpen] = useState(() =>
    question.kind === "open_ended" &&
    !!readNotebook(review.document)?.elements.length
  );
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (!live || !journal) return;
      try {
        const record = journal.restore();
        if (record) {
          draftRef.current = record.draft;
          baseRef.current = record.base;
          request.current = record.pending;
          setScore(record.draft.score); setFeedback(record.draft.feedback);
          setDocument(record.draft.document); setAppliedAi(record.draft.appliedAi);
          setNotesOpen(record.draft.document.elements.length > 0);
          setUncertain(!!record.pending); setDirty(true); setRecovered(true);
          setStaleDraft(!record.pending && (record.base.revision !== review.revision || record.base.answerHash !== review.answer_hash));
        }
        setLocalReady(true); setLocalError(false);
      } catch { setLocalError(true); }
    });
    return () => { live = false; };
  }, [journal, restoreTry, review.revision, review.answer_hash]);
  const invalidDocument = (answer?.answer_document != null && !original) ||
    (review.document != null && !readNotebook(review.document));
  const context = useQuestionContext(question.id);
  const [commonOpen, setCommonOpen] = useState(true);
  const isOpen = question.kind === "open_ended";
  const hasAnswer = !!answer?.answer_key || !!answer?.answer_text?.trim() ||
    !!original?.elements.length || invalidDocument;
  const showNotebook = notesOpen || (isOpen && !!original?.elements.length);
  const choices = Array.isArray(question.choices)
    ? question.choices.filter(
      (item): item is { key: string; text: string } =>
        !!item && typeof item === "object" && typeof item.key === "string" &&
        typeof item.text === "string",
    )
    : [];
  const save = useMutation({
    mutationFn: async () => {
      if (!journal || !localReady || (localError && !request.current) || (staleDraft && !uncertain)) {
        throw Error("review_local_not_ready");
      }
      // Store the exact request before I/O; reopen/retry uses its original base.
      if (!request.current) journal.edit(baseRef.current, draftRef.current);
      const record = journal.prepare();
      request.current = record.pending;
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const currentClaims = decodeClaims(auth.session?.access_token);
      if (auth.session?.user.id !== userId || currentClaims?.role !== "parent" || currentClaims.family_id !== familyId) {
        throw Error("forbidden");
      }
      const { data, error } = await supabase.rpc("save_answer_review", {
        p_request_id: record.pending!,
        p_attempt_id: attemptId,
        p_question_id: question.id,
        p_revision: record.base.revision,
        p_answer_hash: record.base.answerHash,
        p_score: record.base.openEnded ? Number(record.draft.score) : null,
        p_feedback: record.draft.feedback.trim(),
        p_document: record.draft.document,
        ...(record.draft.appliedAi ? {p_ai_id:record.draft.appliedAi} : {}),
      }).abortSignal(AbortSignal.timeout(20_000));
      if (error) throw error;
      journal.acknowledge(record.pending!, data);
      request.current = null;
      return data;
    },
    onSuccess: () => {
      setDirty(false);
      setLocalError(false);
      setUncertain(false);
      setSaved(true);
      void cache.invalidateQueries({
        queryKey: ["answer_review"],
        refetchType: "none",
      });
      void cache.invalidateQueries({ queryKey: ["attempt_review", attemptId] });
      void cache.invalidateQueries({
        queryKey: ["attempt_review_answers", attemptId],
      });
      void cache.invalidateQueries({ queryKey: ["child_answer_reviews"] });
      void invalidateProvaLists(cache);
      void cache.invalidateQueries({ queryKey: ["learning_progress"] });
      void cache.invalidateQueries({ queryKey: ["review_workspace"] });
    },
    onError: (e) => {
      const definitive = ["invalid_score", "forbidden", "review_local_not_ready"].includes(e.message) ||
        /^(P0001|42501|22\w+|23\w+)$/.test((e as { code?: string }).code ?? "");
      if (definitive && request.current) {
        try { journal?.reject(request.current); request.current = null; setLocalError(false); }
        catch { setLocalError(true); setUncertain(true); return; }
      }
      setUncertain(!definitive && !!request.current);
      if (/^(review_changed|answer_changed)$/.test(e.message)) setStaleDraft(true);
      if (!definitive && !request.current) setLocalError(true);
    },
  });
  const ai = useMutation({
    mutationFn: () =>
      invokeProvaAi<ReviewSuggestion>("prova-review", {
        attempt_id: attemptId,
        question_id: question.id,
        answer_hash: review.answer_hash,
        consent,
      }),
    onSuccess: (data) => {
      setSuggestion(data);
      setAiOpen(false);
      void cache.invalidateQueries({ queryKey: ["review_ai_policy"] });
    },
  });
  const locked = save.isPending || uncertain || saved || !finished ||
    invalidDocument || !localReady || localError || staleDraft;
  usePreventRemove(
    (dirty || save.isPending || uncertain) && !saved && !exit,
    ({ repeat }) => {
      if (uncertain || save.isPending) setError(t("parentReview.uncertain"));
      else setLeave(() => repeat);
    },
  );
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || saved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);
  useEffect(() => {
    exit?.();
  }, [exit]);
  useEffect(() => {
    if (saved) onNavigate(index + 1);
  }, [saved, index, onNavigate]);
  function change(patch: Partial<ReviewDraft>) {
    if (locked) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setScore(next.score); setFeedback(next.feedback); setDocument(next.document); setAppliedAi(next.appliedAi);
    setDirty(true); setError(null); save.reset();
    try { journal!.edit(baseRef.current, next); setLocalError(false); }
    catch { setLocalError(true); }
  }
  function retryLocal() {
    if (!localReady) { setRestoreTry(n => n + 1); return; }
    try { journal!.edit(baseRef.current, draftRef.current); setLocalError(false); }
    catch { setLocalError(true); }
  }
  function useCurrentReview() {
    try { journal!.discard(); setDirty(false); setConfirmReset(false); onReload(); }
    catch { setLocalError(true); }
  }
  function navigate(next: number) {
    if (save.isPending || uncertain) {
      return setError(t("parentReview.uncertain"));
    }
    if (dirty) setLeave(() => () => onNavigate(next));
    else onNavigate(next);
  }
  const source = (
    <View style={{ gap: 12 }}>
      <QuestionMedia questionId={question.id} notebook maxImageHeight={wide ? 200 : 170} />
      {context.data
        ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: commonOpen }}
              onPress={() => setCommonOpen(!commonOpen)}
              style={s.key}
            >
              <Text style={[s.bold, { flex: 1 }]}>{context.data.title}</Text>
              <ChevronDown size={18} color={p.purple} />
            </Pressable>
            {commonOpen && <Text style={s.copy}>{context.data.body}</Text>}
          </>
        )
        : null}
      <Text selectable style={s.bold}>
        {context.data?.prompt ?? question.stem}
      </Text>
      {!isOpen &&
        choices.map((choice) => (
          <View
            key={choice.key}
            style={[s.row, {
              padding: 10,
              borderRadius: 16,
              backgroundColor: choice.key === question.correct_key
                ? "#E7F5EE"
                : choice.key === answer?.answer_key
                ? p.lilac
                : "transparent",
            }]}
          >
            <Text style={s.bold}>{choice.key}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.copy}>{choice.text}</Text>
              {choice.key === answer?.answer_key && (
                <Text style={s.small}>{t("parentReview.selectedChoice")}</Text>
              )}
              {choice.key === question.correct_key && (
                <Text style={s.small}>{t("parentReview.correctChoice")}</Text>
              )}
            </View>
          </View>
        ))}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: keyOpen }}
        onPress={() => setKeyOpen(!keyOpen)}
        style={s.key}
      >
        <ChevronDown size={18} color={p.purple} />
        <Text style={s.bold}>
          {t(isOpen ? "parentReview.key" : "parentReview.explanation")}
        </Text>
      </Pressable>
      {keyOpen
        ? (
          <View style={s.hint}>
            <Text selectable style={s.copy}>
              {question.expected_answer ??
                choices.find((choice) => choice.key === question.correct_key)
                  ?.text ??
                question.correct_key}
            </Text>
            <Text selectable style={s.copy}>{question.solution}</Text>
          </View>
        )
        : null}
    </View>
  );
  const assessment = (
    <View style={{ gap: 14 }}>
      <Text style={s.heading}>{t("parentReview.assessment")}</Text>
      {isOpen
        ? (
          <View style={s.row}>
            <View style={[s.row, { flex: 1, borderWidth: 1, borderColor: '#D8CBF3', borderRadius: 16, paddingHorizontal: 14 }]}>
              <TextInput accessibilityLabel={t("parentReview.score")} value={score} onChangeText={v => change({ score: v })} keyboardType="number-pad" maxLength={3} editable={!locked} placeholder="0" style={{ flex: 1, minWidth: 0, minHeight: 48, color: p.purple, fontFamily: 'Nunito_800ExtraBold', fontSize: 24 }}/><Text style={[s.heading, { color: p.purple, flexShrink: 0 }]}>/ 100</Text>
            </View><Text style={[s.tag, { paddingVertical: 7 }]}>{t("parentReview.score")}</Text>
          </View>
        )
        : (
          <Text style={s.copy}>
            {t(
              answer?.answer_key
                ? answer.is_correct ? "prova.ai.correct" : "prova.ai.incorrect"
                : "prova.ai.unanswered",
            )}
            {answer?.answer_key ? ` · ${answer.answer_key}` : ""}
          </Text>
        )}
      <Field
        label={t("parentReview.feedback")}
        value={feedback}
        onChangeText={(v) => change({ feedback: v })}
        editable={!locked}
        maxLength={4000}
        multiline
        style={{ minHeight: 90 }}
      />
      <Text style={s.small}>{t("parentReview.visibleToChild")}</Text>
      {isOpen
        ? (
          <>
            <SatinButton
              title={t("parentReview.askAi")}
              secondary
              disabled={locked || !hasAnswer || aiRemaining === null ||
                aiRemaining <= 0 ||
                ai.isPending}
              onPress={() => setAiOpen(true)}
              icon={<Sparkles size={20} color={p.purple} />}
            />
            <Text style={s.small}>
              {!hasAnswer
                ? t("parentReview.aiNeedsAnswer")
                : aiRemaining === null
                ? t("parentReview.aiUnavailable")
                : t("parentReview.aiRemaining", { count: aiRemaining })}
            </Text>
          </>
        )
        : null}
      {suggestion
        ? (
          <View style={s.hint}>
            <Text style={s.bold}>{t("parentReview.aiProposal")}</Text>
            <Text style={s.copy}>
              {suggestion.result.score === null
                ? t("parentReview.unscored")
                : t("parentReview.aiScore", { score: suggestion.result.score })}
            </Text>
            <Text style={s.copy}>{suggestion.result.feedback}</Text>
            {suggestion.result.evidence.map((e, i) => (
              <Text style={s.copy} key={i}>• {e}</Text>
            ))}
            <Text style={s.copy}>{suggestion.result.next_step}</Text>
            {!!suggestion.result.limitation && (
              <Text style={s.small}>{suggestion.result.limitation}</Text>
            )}
            <SatinButton
              title={t("parentReview.takeDraft")}
              secondary
              disabled={locked || !suggestion.result.readable ||
                suggestion.result.score === null}
              onPress={() =>
                change({score:String(suggestion.result.score), feedback:suggestion.result.feedback, appliedAi:suggestion.id})}
            />
          </View>
        )
        : null}
    </View>
  );
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <IconButton
            label={t("common.back")}
            onPress={() =>
              navigate(-1)}
          >
            <ArrowLeft color={p.ink} size={22} />
          </IconButton>
          <Image
            source={require(
              "../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            style={{ width: 110, height: 42, resizeMode: "contain" }}
          />
          {wide && (
            <Text style={[s.heading, { flex: 1 }]}>
              {t("parentReview.title", { name: childName })}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("parentReview.pickQuestion")}
            onPress={() =>
              setPicker(true)}
            style={!wide ? { marginLeft: "auto" } : undefined}
          >
            <Text style={s.tag}>{index + 1} / {count}</Text>
          </Pressable>
          {wide && (
            <SatinButton
              title={t("parentReview.summary")}
              secondary
              onPress={() => navigate(-1)}
              icon={<ChartNoAxesCombined size={20} color={p.ink} />}
            />
          )}
        </View>
        {!wide && (
          <>
            <Text style={[s.heading, { paddingHorizontal: 20 }]}>
              {t("parentReview.title", { name: childName })}
            </Text>
            <View style={s.tabs}>
              {(["solution", "assessment"] as const).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => setTab(key)}
                  style={[s.tab, tab === key && { backgroundColor: p.purple }]}
                >
                  <Text
                    style={[s.bold, { color: tab === key ? "white" : p.ink }]}
                  >
                    {t(
                      key === "assessment"
                        ? "parentReview.assessmentTab"
                        : "parentReview.solution",
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {!finished && (
          <Text style={s.notice}>{t("parentReview.inProgress")}</Text>
        )}
        <View style={[s.body, { flexDirection: wide ? "row" : "column" }]}>
          {wide && showNotebook && !expanded
            ? (
              <ScrollView
                style={s.sidebar}
                contentContainerStyle={{ padding: 16, gap: 14 }}
                keyboardShouldPersistTaps="handled"
              >
                {source}
                {assessment}
              </ScrollView>
            )
            : null}
          {!wide && tab === "assessment"
            ? (
              <ScrollView
                style={s.panel}
                contentContainerStyle={{ padding: 16, gap: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: sourceOpen }}
                  style={s.key}
                  onPress={() => setSourceOpen(!sourceOpen)}
                >
                  <Text style={[s.bold, { flex: 1 }]}>
                    {t(
                      sourceOpen
                        ? "parentReview.collapseQuestion"
                        : "notebook.showQuestion",
                    )}
                  </Text>
                  <ChevronDown size={20} color={p.purple} />
                </Pressable>
                {sourceOpen && source}
                {assessment}
              </ScrollView>
            )
            : null}
          {!showNotebook && (wide || tab === "solution") && (
            <ScrollView
              style={[s.panel, { flex: 1 }]}
              contentContainerStyle={{
                padding: 16,
                gap: 24,
                flexDirection: wide ? "row" : "column",
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ width: wide ? "58%" : "100%", gap: 20 }}>
                {source}
                {!!answer?.answer_text?.trim() && (
                  <View style={s.hint}>
                    <Text style={s.bold}>{t("parentReview.childAnswer")}</Text>
                    <Text selectable style={s.copy}>{answer.answer_text}</Text>
                  </View>
                )}
                {!hasAnswer && (
                  <Text style={s.notice}>{t("parentReview.noAnswer")}</Text>
                )}
                {invalidDocument && (
                  <Text accessibilityRole="alert" style={s.notice}>
                    {t("parentReview.unknownDocument")}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  style={[s.key, { backgroundColor: "transparent" }]}
                  onPress={() => setNotesOpen(true)}
                >
                  <Text style={s.bold}>
                    {t(
                      document.elements.length
                        ? "parentReview.openDrawingNotes"
                        : "parentReview.addDrawingNote",
                    )}
                  </Text>
                </Pressable>
              </View>
              {wide && <View style={{ flex: 1 }}>{assessment}</View>}
            </ScrollView>
          )}
          {showNotebook && (
            <View
              style={[s.panel, {
                flex: 1,
                display: !showNotebook || (!wide && tab !== "solution")
                  ? "none"
                  : "flex",
              }]}
            >
              {wide
                ? (
                  <View style={s.panelHead}>
                    <Text style={[s.heading, { flex: 1 }]}>
                      {t("parentReview.notebook", { name: childName })}
                    </Text>
                    <Pressable accessibilityRole="switch" accessibilityLabel={t("parentReview.myNotes")} accessibilityState={{ checked: showNotes }} onPress={() => setShowNotes(!showNotes)} style={[s.key, { backgroundColor: showNotes ? '#E5F5EB' : p.lilac, paddingVertical: 6 }]}>{showNotes ? <Check size={18} color="#087F70"/> : <EyeOff size={18} color={p.muted}/>}<Text style={s.small}>{t("parentReview.myNotes")}</Text></Pressable>
                    <IconButton
                      label={t(
                        expanded ? "notebook.restore" : "notebook.expand",
                      )}
                      onPress={() => setExpanded(!expanded)}
                    >
                      {expanded
                        ? <Minimize2 size={22} color={p.purple} />
                        : <Maximize2 size={22} color={p.purple} />}
                    </IconButton>
                  </View>
                )
                : (
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={[s.row, { backgroundColor: '#F4F0FA', borderRadius: 18, padding: 8 }]}>
                      <View style={{ width: 94 }}><QuestionMedia questionId={question.id} compact/></View>
                      <Pressable accessibilityRole="button" accessibilityLabel={t("notebook.showQuestion")} onPress={() => setQuestionPreview(true)} style={{ flex: 1, minHeight: 74, justifyContent: 'center', gap: 6 }}>
                        <Text style={[s.small, { color: p.ink }]} numberOfLines={2}>{context.data?.prompt ?? question.stem}</Text>
                        <View style={[s.row, { gap: 6 }]}><Eye size={18} color={p.purple}/><Text style={[s.small, { color: p.purple }]}>{t("notebook.showQuestion")}</Text></View>
                      </Pressable>
                      <IconButton label={t(showNotes ? "parentReview.hideNotes" : "parentReview.showNotes")} onPress={() => setShowNotes(!showNotes)}>{showNotes ? <Eye size={20} color={p.purple}/> : <EyeOff size={20} color={p.muted}/>}</IconButton>
                    </View>
                  </View>
                )}
              {!!answer?.answer_text && (
                <ScrollView style={{ maxHeight: 150, margin: 12 }}>
                  <Text selectable style={s.copy}>{answer.answer_text}</Text>
                </ScrollView>
              )}
              {notesOpen && !(isOpen && original?.elements.length) && (
                <Pressable
                  accessibilityRole="button"
                  style={s.key}
                  onPress={() => setNotesOpen(false)}
                >
                  <Text style={s.bold}>{t("parentReview.backToAnswer")}</Text>
                </Pressable>
              )}
              {!hasAnswer && (
                <Text style={s.notice}>{t("parentReview.noAnswer")}</Text>
              )}
              {invalidDocument
                ? (
                  <Text accessibilityRole="alert" style={s.notice}>
                    {t("parentReview.unknownDocument")}
                  </Text>
                )
                : (
                  <NotebookEditor
                    document={document}
                    underlay={original ?? emptyNotebook()}
                    annotation
                    showInk={showNotes}
                    disabled={locked || !showNotes}
                    onChange={(doc) => change({ document: doc })}
                  />
                )}
            </View>
          )}
        </View>
        {(recovered || dirty || localError || staleDraft) && (
          <View style={{paddingHorizontal:16, gap:8}}>
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {t(uncertain ? "parentReview.localPending" : localError ? "parentReview.localFailed" : staleDraft ? "parentReview.localStale" : recovered ? "parentReview.localRestored" : "parentReview.localStored")}
            </Text>
            {localError && !uncertain && <SatinButton title={t("common.retry")} secondary onPress={retryLocal} />}
            {staleDraft && !uncertain && (confirmReset ? <View style={{gap:8}}>
              <Text style={s.small}>{t("parentReview.resetConfirm")}</Text>
              <SatinButton title={t("parentReview.resetLocal")} secondary onPress={useCurrentReview} />
              <SatinButton title={t("common.cancel")} secondary onPress={() => setConfirmReset(false)} />
            </View> : <SatinButton title={t("parentReview.resetLocal")} secondary onPress={() => setConfirmReset(true)} />)}
          </View>
        )}
        {(error || save.error || uncertain) && (
          <Text accessibilityRole="alert" style={s.error}>
            {uncertain
              ? t("parentReview.uncertain")
              : error ?? provaErrorMessage(save.error)}
          </Text>
        )}
        <View
          style={[
            s.footer,
            stackedFooter && { flexDirection: "column", alignItems: "stretch" },
          ]}
        >
          <Text style={s.small}>
            {t(
              save.isPending
                ? "parentReview.saving"
                : (dirty || uncertain)
                ? "parentReview.unsaved"
                : review.revision > 0
                ? "parentReview.saved"
                : !isOpen && answer?.answer_key
                ? "parentReview.autoChecked"
                : "parentReview.pending",
            )}
          </Text>
          {!stackedFooter && <View style={{ flex: 1 }} />}
          {wide && index > 0 && (
            <IconButton
              label={t("parentReview.previous")}
              onPress={() => navigate(index - 1)}
            >
              <ArrowLeft color={p.purple} size={20} />
            </IconButton>
          )}
          <SatinButton
            title={t(
              !wide && tab === "solution"
                ? "parentReview.toAssessment"
                : uncertain
                ? "common.retry"
                : !finished
                ? "parentReview.next"
                : index + 1 === count
                ? "parentReview.saveFinish"
                : "parentReview.saveNext",
            )}
            busy={save.isPending}
            disabled={invalidDocument || !localReady || (localError && !uncertain) || (staleDraft && !uncertain)}
            onPress={() => {
              if (!wide && tab === "solution") setTab("assessment");
              else if (!finished) navigate(index + 1);
              else save.mutate();
            }}
            icon={<ArrowRight color="white" size={20} />}
          />
        </View>
        <Modal
          {...NOTEBOOK_MODAL_PROPS}
          visible={picker}
          transparent
          animationType="fade"
          onRequestClose={() => setPicker(false)}
        >
          <View style={s.shade}>
            <View style={s.dialog}>
              <Text style={s.heading}>{t("parentReview.pickQuestion")}</Text>
              <ScrollView contentContainerStyle={{ gap: 8 }}>
                {Array.from(
                  { length: count },
                  (_, i) => (
                    <SatinButton
                      key={i}
                      title={`${t("prova.ai.questionN", { n: i + 1 })} · ${
                        t(`parentReview.state.${questionStates[i]}`)
                      }`}
                      secondary
                      selected={i === index}
                      onPress={() => {
                        setPicker(false);
                        if (i !== index) navigate(i);
                      }}
                    />
                  ),
                )}
              </ScrollView>
              <SatinButton
                title={t("common.cancel")}
                secondary
                onPress={() => setPicker(false)}
              />
            </View>
          </View>
        </Modal>
        <Modal
          {...NOTEBOOK_MODAL_PROPS}
          visible={!!leave}
          transparent
          animationType="fade"
          onRequestClose={() => setLeave(null)}
        >
          <View style={s.shade}>
            <View style={s.dialog}>
              <Text style={s.heading}>{t("parentReview.leaveTitle")}</Text>
              <Text style={s.copy}>{t("parentReview.leaveBody")}</Text>
              <SatinButton
                title={t("parentReview.stay")}
                onPress={() => setLeave(null)}
              />
              <SatinButton
                title={t("parentReview.keepLocal")}
                secondary
                disabled={localError || !localReady}
                onPress={() => { setExit(() => leave); setLeave(null); }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("parentReview.discard")}
                style={{minHeight:48, justifyContent:"center", alignItems:"center"}}
                onPress={() => {
                  try { journal?.discard(); setExit(() => leave); setLeave(null); }
                  catch { setLocalError(true); setLeave(null); }
                }}
              ><Text style={s.error}>{t("parentReview.discard")}</Text></Pressable>
            </View>
          </View>
        </Modal>
        <Modal
          {...NOTEBOOK_MODAL_PROPS}
          visible={aiOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!ai.isPending) setAiOpen(false);
          }}
        >
          <View style={s.shade}>
            <ScrollView
              style={{
                width: "100%",
                maxWidth: 520,
                maxHeight: "90%",
                borderRadius: 26,
                backgroundColor: p.cream,
              }}
              contentContainerStyle={{ padding: 24, gap: 16 }}
            >
              <Text style={s.heading}>{t("parentReview.askAi")}</Text>
              <Text style={s.copy}>{t("parentReview.aiConsentBody")}</Text>
              <Toggle
                label={t("parentReview.aiConsent")}
                value={consent}
                onChange={setConsent}
                disabled={ai.isPending}
              />
              <Text style={s.small}>
                {t("parentReview.aiRemaining", { count: aiRemaining ?? 0 })}
              </Text>
              {ai.error && (
                <Text style={s.error}>{provaErrorMessage(ai.error)}</Text>
              )}
              <SatinButton
                title={t("parentReview.analyze")}
                disabled={!consent}
                busy={ai.isPending}
                onPress={() => ai.mutate()}
              />
              <SatinButton
                title={t("common.cancel")}
                secondary
                disabled={ai.isPending}
                onPress={() => setAiOpen(false)}
              />
            </ScrollView>
          </View>
        </Modal>
        <Modal {...NOTEBOOK_MODAL_PROPS} visible={questionPreview} transparent animationType="fade" onRequestClose={() => setQuestionPreview(false)}>
          <View style={s.shade}><View style={s.dialog}><View style={s.row}><Text style={[s.heading, { flex: 1 }]}>{t("notebook.question")}</Text><IconButton label={t("notebook.close")} onPress={() => setQuestionPreview(false)}><X size={22} color={p.ink}/></IconButton></View><ScrollView contentContainerStyle={{ paddingBottom: 16 }}>{source}</ScrollView></View></View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heading: { fontFamily: "Nunito_800ExtraBold", fontSize: 25, color: p.ink },
  bold: { fontFamily: "Nunito_700Bold", fontSize: 17, color: p.ink },
  copy: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 17,
    lineHeight: 25,
    color: p.ink,
  },
  small: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    lineHeight: 19,
    color: p.muted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tag: {
    backgroundColor: p.lilac,
    borderRadius: 22,
    padding: 12,
    fontFamily: "Nunito_700Bold",
    color: p.ink,
  },
  tabs: {
    margin: 16,
    padding: 4,
    backgroundColor: p.lilac,
    borderRadius: 28,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  body: { flex: 1, minHeight: 0, gap: 0, paddingHorizontal: 12 },
  sidebar: {
    width: "35%",
    flexBasis: "35%",
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: p.line,
  },
  panel: {
    minHeight: 0,
    minWidth: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: p.line,
    overflow: "hidden",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  key: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    padding: 12,
    backgroundColor: p.lilac,
    borderRadius: 20,
  },
  hint: { backgroundColor: "#E7F5EE", borderRadius: 20, padding: 16, gap: 10 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderColor: p.line,
  },
  notice: { fontFamily: "Nunito_600SemiBold", color: p.muted, padding: 12 },
  error: { fontFamily: "Nunito_600SemiBold", color: "#9C3832", padding: 10 },
  shade: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#20195170",
  },
  dialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: p.cream,
    borderRadius: 26,
    padding: 24,
    gap: 16,
  },
});
