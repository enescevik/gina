import { NumberChoice } from "@/components/ui/number-choice";
import { SourceFilesPicker } from "@/components/learning/source-files-picker";
import { provaGenerationJournal } from "@/lib/setup-command";
import { aiInteractionTypesFor, aiTypesAllowed, canonicalSubject, catalogBlueprintFits, provaAiUnits, provaGenerationKind, provaRemainingCount,
  structuredFitsKind,
} from "@gina/core";
import i18next from "@/lib/i18n";
import { PHASE2A_AUTHOR_ENABLED, PHASE2B_AUTHOR_ENABLED } from "./question-types/support";
import { structuredTypeLabel } from "./structured-question-author";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import type {
  ProvaBlock,
  ProvaDraft,
  ProvaGenerationPayload,
  ProvaGenerationRecord,
} from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import {
  type LocalLearningFile,
  uploadLearningFile,
} from "@/lib/learning-files";
import {
  type GenerateResponse,
  invokeProvaAi,
  ProvaAiError,
  provaErrorMessage as baseErrorMessage,
} from "@/lib/prova-ai";

import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import {
  b,
  BuilderChoice,
  BuilderQuestionPreview,
  EditAction,
} from "./prova-builder-ui";
import { type BuilderQuestion, loadAiEdits } from "./prova-builder-data";
import { aiEditRoute } from "@/lib/prova-draft";

/** 2A/2B AI tür seçenekleri yalnız faz anahtarı açıkken görünür. */
const AI_PHASES = { phase2a: PHASE2A_AUTHOR_ENABLED, phase2b: PHASE2B_AUTHOR_ENABLED };
/** QT-AI: tür/model hataları kendi sakin metinleriyle (prova.qt.author.aiErr.*); diğerleri eski yolla. */
function provaErrorMessage(error: unknown): string | null {
  const code = error instanceof ProvaAiError ? error.code
    : error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  const key = `prova.qt.author.aiErr.${code}`;
  if (code && i18next.exists(key)) return i18next.t(key);
  return baseErrorMessage(error);
}

type Mode = "sources" | "library" | "ai" | "manual" | "document" | "repeat";
type RepeatUnit = {
  kind: "question" | "group";
  id: string;
  title: string;
  subject: string;
  affected: number;
  question_count: number;
  evidence: {
    attempt_id: string;
    question_id: string;
    state: "wrong" | "partial";
  }[];
};
export function ProvaSourcePicker(
  { visible, draft, draftId, onClose, onAdd, currentCount = 0 }: {
    visible: boolean;
    draft: ProvaDraft;
    /** Questions already in the draft (groups expanded) — for "complete with AI". */
    currentCount?: number;
    draftId: string;
    onClose: () => void;
    onAdd: (blocks: ProvaBlock[]) => Promise<void>;
  },
) {
  const { t, i18n } = useTranslation(),
    { claims, session } = useSession(),
    familyId = claims?.family_id ?? "";
  const [repeatDetails, setRepeatDetails] = useState(false);
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<Mode>("sources"),
    [selected, setSelected] = useState<ProvaBlock[]>([]),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(50);
  const [subject, setSubject] = useState(""),
    [count, setCount] = useState(3),
    [file, setFile] = useState<LocalLearningFile | null>(null),
    [consent, setConsent] = useState(false),
    [localError, setLocalError] = useState<unknown>(null);
  const [topics, setTopics] = useState<string[]>([]),
    [blueprintId, setBlueprintId] = useState<string | null>(null);
  // QT-AI: isteğe bağlı tür seçimi; boşsa istek eski gövdeyle birebir aynı gider.
  const [aiTypes, setAiTypes] = useState<string[]>([]);
  const writtenTrack = draft.purpose === "written" || draft.context?.track === "meb_common";
  const requestedTypes = aiInteractionTypesFor(aiTypes, writtenTrack, AI_PHASES);
  const [preview, setPreview] = useState<BuilderQuestion | null>(null),
    [aiRows, setAiRows] = useState<BuilderQuestion[]>([]);
  const journal = useMemo(
    () => provaGenerationJournal(session?.user.id ?? "", familyId, draftId),
    [session?.user.id, familyId, draftId],
  );
  const [generationRecord, setGenerationRecord] = useState<
      ProvaGenerationRecord | null
    >(null),
    [storageBlocked, setStorageBlocked] = useState(false);
  const recoveredFits = !generationRecord ||
    (generationRecord.payload.grade === draft.grade &&
      draft.subjects.includes(generationRecord.payload.subject));
  const [view, setView] = useState({ visible: false, journal });
  if (visible !== view.visible || journal !== view.journal) {
    setView({ visible, journal });
    if (visible) {
      try {
        const r = journal.read();
        setGenerationRecord(r);
        setStorageBlocked(false);
        setAiRows(
          r?.result?.questions.map(
            (q) => ({
              ...q,
              grade: r.payload.grade,
              subject: r.payload.subject,
            } as BuilderQuestion),
          ) ?? [],
        );
      } catch {
        setStorageBlocked(true);
        setGenerationRecord(null);
        setAiRows([]);
      }

      setMode("sources");
      setTopics(draft.subjects.length === 1 ? draft.topics : []);
      setBlueprintId(null);
      setSelected([]);
      setSubject(draft.subjects[0] ?? "");
      setLocalError(null);
    }
  }
  const policy = useQuery({
    queryKey: ["question_group_policy", familyId],
    enabled: visible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_group_policy");
      if (error) throw error;
      return data === true;
    },
  });
  const entitlement = useQuery({
    queryKey: ["builder_entitlement", familyId],
    enabled: visible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_prova_entitlement");
      if (error) throw error;
      return data as unknown as {
        ai_generate_remaining: number;
        ai_generate_limit: number;
        scenarios: boolean;
      };
    },
  });
  const blueprints = useQuery({
    queryKey: [
      "builder_blueprints",
      familyId,
      draft.grade,
      subject,
      draft.childId,
      draft.purpose,
    ],
    enabled: visible && !!subject && !!draft.grade,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_blueprints").select(
        "id,name,subject,grade,rows,source_context",
      ).eq("grade", draft.grade!).order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return data.filter((bp) =>
        canonicalSubject(bp.subject) === canonicalSubject(subject) &&
        catalogBlueprintFits(
          bp.source_context,
          draft.childId ?? "",
          draft.purpose,
        )
      );
    },
  });
  const blueprint = blueprints.data?.find((v) => v.id === blueprintId);
  const plan = blueprint
    ? (blueprint.rows as { topic: string; count: number }[])
    : topics.map((topic, index) => ({
      topic,
      count: Math.floor(count / topics.length) +
        (index < count % topics.length ? 1 : 0),
    }));
  const aiCount = plan.reduce((sum, row) => sum + row.count, 0);
  const planValid = plan.length > 0 &&
    plan.every((row) => Number.isInteger(row.count) && row.count > 0) &&
    aiCount <= 30;
  const bank = useQuery({
    queryKey: [
      "builder_bank",
      familyId,
      draft.grade,
      draft.subjects,
      limit,
      search,
    ],
    enabled: visible && mode === "library" && !!draft.grade &&
      draft.subjects.length > 0,
    queryFn: async () => {
      const [qs, gs] = await Promise.all([
        supabase.from("standalone_question_bank").select("*").eq(
          "grade",
          draft.grade!,
        ).in("subject", draft.subjects).ilike(
          "stem",
          `%${search.replace(/[\\%_]/g, "\\$&")}%`,
        ).order("created_at", {
          ascending: false,
        }).limit(limit),
        supabase.from("question_source_groups").select(
          "id,title,body,grade,subject,series_id,version,question_source_members(question_id,position)",
        ).eq("grade", draft.grade!).in("subject", draft.subjects).order(
          "version",
          { ascending: false },
        ).limit(200),
      ]);
      if (qs.error || gs.error) throw qs.error ?? gs.error;
      const seen = new Set<string>();
      return {
        questions: qs.data as BuilderQuestion[],
        groups: gs.data.filter((g) => {
          if (seen.has(g.series_id)) return false;
          seen.add(g.series_id);
          return true;
        }),
      };
    },
  });
  const repeats = useQuery({
    queryKey: [
      "repeat_candidates",
      familyId,
      draftId,
      draft.childId,
      draft.grade,
      draft.subjects,
    ],
    enabled: visible && mode === "repeat" && !!draft.childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_repeat_candidates", {
        p_draft_id: draftId,
      });
      if (error) throw error;
      return data as unknown as RepeatUnit[];
    },
  });
  const remaining = entitlement.data?.ai_generate_remaining;
  const generation = useMutation({
    mutationFn: async () => {
      if (storageBlocked) throw Error(t("generationRecovery.blocked"));
      let record = journal.read();
      const recovering = !!record;
      if (record?.result) return record;
      if (record?.safeFailure) throw Error(t("generationRecovery.failed"));
      if (!record) {
        if (!subject) throw new Error(t("provaBuilder.subjectRequired"));
        if (!planValid) throw new Error(t("provaBuilder.topicRequired"));
        if (mode === "document" && (!file || !consent)) {
          throw new Error(t("provaBuilder.consent"));
        }
        if (mode === "document" && file) {
          await uploadLearningFile(file, "document");
        }
        const payload: ProvaGenerationPayload = {
          draft_id: draftId,
          subject,
          grade: draft.grade!,
          topic_plan: plan,
          blueprint_id: blueprint?.id ?? null,
          count: aiCount,
          kind: provaGenerationKind(draft),
          assessment: draft.purpose === "written" ? "written" : "practice",
          difficulty: draft.difficulty,
          note: draft.note,
          locale: i18n.language.startsWith("en") ? "en" : "tr",
          ...(mode === "document" && file
            ? { source_id: file.id, ai_consent: true as const }
            : {}),
          ...(requestedTypes ? { interaction_types: requestedTypes } : {}),
        };
        record = journal.prepare(payload);
        setGenerationRecord(record);
      }
      try {
        const data = await invokeProvaAi<GenerateResponse>("prova-generate", {
          ...record.payload,
          request_id: record.request_id,
          ...(recovering ? { recover_only: true } : {}),
        });
        return journal.complete(record, data);
      } catch (error) {
        if (
          error instanceof ProvaAiError &&
          error.code === "generation_failed_safe"
        ) setGenerationRecord(journal.failed(record));
        throw error;
      }
    },
    onSuccess: (record) => {
      setGenerationRecord(record);
      setAiRows(
        record.result!.questions.map(
          (q) => ({
            ...q,
            grade: record.payload.grade,
            subject: record.payload.subject,
          } as BuilderQuestion),
        ),
      );
      setSelected([]);
      void entitlement.refetch();
    },
    onError: setLocalError,
  });
  const cancelGeneration = useMutation({
    mutationFn: async () => {
      const record = journal.read();
      if (!record) return;
      if (record.result) {
        journal.release();
        return;
      }
      const { data, error } = await supabase.rpc(
        "cancel_unstarted_generation",
        { p_id: record.request_id, p_intent: record.payload },
      );
      if (error) throw error;
      journal.cancel(record, data);
    },
    onSuccess: () => {
      setGenerationRecord(null);
      setAiRows([]);
      setSelected([]);
      setLocalError(null);
      generation.reset();
    },
    onError: setLocalError,
  });
  const releaseGeneration = () => cancelGeneration.mutate();
  const aiUnits = provaAiUnits(generationRecord?.result);
  const aiSource = generationRecord?.payload.source_id
    ? "document" as const
    : "ai" as const;
  // D14: veli bir öneriyi düzenlediyse seçicide düzenlenmiş hâli (ve onun kimliği) görünür; özgün satır değişmez.
  const aiEdits = useQuery({
    queryKey: [
      "ai_question_edits",
      familyId,
      aiUnits.map((unit) => `${unit.kind}:${unit.id}`).join(","),
    ],
    enabled: visible && aiUnits.length > 0,
    queryFn: () =>
      loadAiEdits(
        aiUnits.filter((u) => u.kind === "question").map((u) => u.id),
        aiUnits.filter((u) => u.kind === "group").map((u) => u.id),
      ),
  });
  const editedQuestion = (id: string) => aiEdits.data?.questions.get(id);
  const editedGroup = (id: string) => aiEdits.data?.groups.get(id);
  const effectiveId = (unit: (typeof aiUnits)[number]) =>
    unit.kind === "group"
      ? editedGroup(unit.id)?.group.id ?? unit.id
      : editedQuestion(unit.id)?.id ?? unit.id;
  function openEdit(target: { kind: "question" | "group"; id: string }) {
    onClose();
    router.push(aiEditRoute(target, draftId));
  }
  const inDraft = (id: string) => draft.blocks.some((block) => block.id === id);
  const unitInDraft = (unit: (typeof aiUnits)[number]) =>
    inDraft(unit.id) || inDraft(effectiveId(unit));
  const isSelected = (id: string) => selected.some((block) => block.id === id);
  const unitSize = (unit: (typeof aiUnits)[number]) =>
    unit.kind === "group" ? unit.questions.length : 1;
  const add = useMutation({
    mutationFn: () => onAdd(selected),
    onError: setLocalError,
  });
  const busy = picking || generation.isPending || add.isPending ||
    cancelGeneration.isPending;
  function choose(block: ProvaBlock) {
    setSelected((v) =>
      v.some((b) => b.id === block.id)
        ? v.filter((b) => b.id !== block.id)
        : [...v, block]
    );
  }
  function destination(shared: boolean) {
    onClose();
    router.push({
      pathname: shared
        ? "/parent/prova/shared-source"
        : "/parent/prova/question",
      params: { draftId, subject, grade: String(draft.grade ?? "") },
    });
  }
  function switchMode(next: Mode) {
    setMode(next);
    setSelected([]);
    setPreview(null);
    setLocalError(null);
  }
  const error = localError ??
    (mode === "library"
      ? bank.error
      : mode === "repeat"
      ? repeats.error
      : null);
  return (
    <Modal
      visible={visible}
      transparent
      {...NOTEBOOK_MODAL_PROPS}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={b.overlay}>
        <View style={[b.modal, { maxWidth: 880, flexShrink: 1 }]}>
          <View style={b.row}>
            <Text style={[b.h2, { flex: 1 }]}>
              {t(
                mode === "sources"
                  ? "provaBuilder.addQuestions"
                  : `provaBuilder.${mode}`,
              )}
            </Text>
            <IconButton
              label={t("common.close")}
              disabled={busy}
              onPress={onClose}
            >
              <X color={p.ink} />
            </IconButton>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18, paddingBottom: 12 }}
          >
            {mode !== "sources"
              ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("provaBuilder.back")}
                  disabled={busy}
                  onPress={() => switchMode("sources")}
                  style={[b.row, {
                    minHeight: 48,
                    alignSelf: "flex-start",
                    paddingRight: 16,
                  }]}
                >
                  <ArrowLeft size={20} color={p.purple} />
                  <Text style={[b.bold, { color: p.purple }]}>
                    {t("provaBuilder.back")}
                  </Text>
                </Pressable>
              )
              : <Text style={b.copy}>{t("provaBuilder.sourceHelp")}</Text>}
            {error
              ? (
                <Text accessibilityRole="alert" style={b.error}>
                  {provaErrorMessage(error)}
                </Text>
              )
              : null}
            {mode === "sources"
              ? (
                <>
                  {generationRecord
                    ? (
                      <View style={b.hint}>
                        <Text style={b.bold}>
                          {t(
                            generationRecord.result
                              ? "generationRecovery.ready"
                              : "generationRecovery.pending",
                          )}
                        </Text>
                        <Text style={b.copy}>
                          {generationRecord.payload.subject} ·{" "}
                          {t("parent.gradeShort", {
                            grade: generationRecord.payload.grade,
                          })} · {t("catalogFlow.count", {
                            n: generationRecord.payload.count,
                          })}
                        </Text>
                        <SatinButton
                          secondary
                          title={t("generationRecovery.open")}
                          onPress={() =>
                            switchMode(
                              generationRecord.payload.source_id
                                ? "document"
                                : "ai",
                            )}
                        />
                      </View>
                    )
                    : null}
                  {(["library", "ai", "manual", "document"] as const).map(
                    (m) => (
                      <SatinButton
                        key={m}
                        secondary
                        title={t(`provaBuilder.${m}`)}
                        onPress={() => switchMode(m)}
                      />
                    ),
                  )}
                </>
              )
              : null}
            {mode === "manual"
              ? (
                <>
                  <View style={b.wrap}>
                    {draft.subjects.map((s) => (
                      <BuilderChoice
                        key={s}
                        selected={subject === s}
                        label={s}
                        onPress={() => setSubject(s)}
                      />
                    ))}
                  </View>
                  <SatinButton
                    disabled={!subject}
                    title={t("prova.newQuestion")}
                    onPress={() => destination(false)}
                  />
                  <SatinButton
                    secondary
                    disabled={!subject || !policy.data}
                    title={t("provaBuilder.shared")}
                    onPress={() => destination(true)}
                  />
                  <Text style={b.muted}>{t("provaBuilder.sharedHelp")}</Text>
                  {!policy.data
                    ? (
                      <Text style={b.muted}>
                        {t("provaBuilder.sourceDisabled")}
                      </Text>
                    )
                    : null}
                </>
              )
              : null}
            {mode === "library"
              ? (
                <>
                  <SatinButton
                    secondary
                    title={t("provaBuilder.ginaLibrary")}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/parent/prova/library",
                        params: { draftId },
                      });
                    }}
                  />
                  <SatinButton
                    secondary
                    title={t("provaBuilder.repeat")}
                    disabled={!draft.childId}
                    onPress={() => switchMode("repeat")}
                  />
                  {!draft.childId && (
                    <Text style={b.muted}>{t("provaBuilder.repeatChild")}</Text>
                  )}
                  <Field
                    label={t("provaBuilder.search")}
                    value={search}
                    onChangeText={setSearch}
                  />
                  {bank.isPending ? <Text>{t("common.loading")}</Text> : null}
                  {bank.error
                    ? (
                      <SatinButton
                        title={t("common.retry")}
                        onPress={() => void bank.refetch()}
                      />
                    )
                    : null}
                  {!bank.isPending && !bank.data?.questions.length &&
                      !bank.data?.groups.length
                    ? <Text style={b.hint}>{t("provaBuilder.noLibrary")}</Text>
                    : null}
                  {bank.data?.groups.filter((g) =>
                    g.title.toLocaleLowerCase().includes(
                      search.toLocaleLowerCase(),
                    )
                  ).map((g) => {
                    const block: ProvaBlock = {
                        kind: "group",
                        id: g.id,
                        source: "library",
                      },
                      already = draft.blocks.some((b) => b.id === g.id);
                    return (
                      <View key={g.id} style={b.hint}>
                        <BuilderChoice
                          label={g.title}
                          selected={selected.some((b) => b.id === g.id) ||
                            already}
                          disabled={already || !policy.data}
                          onPress={() => choose(block)}
                        />
                        <Text style={b.muted}>
                          {t("sharedQuestions.common")} ·{" "}
                          {g.question_source_members.length} · {g.subject}
                        </Text>
                        <Text style={b.copy}>{g.body}</Text>
                      </View>
                    );
                  })}
                  {bank.data?.questions.filter((q) =>
                    (q.stem + " " + q.topic).toLocaleLowerCase().includes(
                      search.toLocaleLowerCase(),
                    )
                  ).map((q) => {
                    const already = draft.blocks.some((b) => b.id === q.id);
                    return (
                      <View key={q.id} style={b.block}>
                        <BuilderChoice
                          label={q.stem}
                          selected={already ||
                            selected.some((b) => b.id === q.id)}
                          disabled={already}
                          onPress={() =>
                            choose({
                              kind: "question",
                              id: q.id,
                              source: "library",
                            })}
                        />
                        <View style={b.row}>
                          <Text style={[b.muted, { flex: 1 }]}>
                            {q.subject} · {q.topic} ·{" "}
                            {q.kind === "structured" ? t("prova.qt.author.kindStructured") : t(`provaBuilder.${q.kind}`)}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            style={b.choice}
                            onPress={() =>
                              setPreview(preview?.id === q.id ? null : q)}
                          >
                            <Text style={b.muted}>
                              {t("provaBuilder.answerShow")}
                            </Text>
                          </Pressable>
                        </View>
                        {preview?.id === q.id
                          ? <BuilderQuestionPreview q={q} showAnswer />
                          : null}
                      </View>
                    );
                  })}
                  {bank.data?.questions.length === limit
                    ? (
                      <SatinButton
                        secondary
                        title={t("provaBuilder.moreLibrary")}
                        onPress={() => setLimit((v) => v + 50)}
                      />
                    )
                    : null}
                </>
              )
              : null}
            {mode === "repeat" && (
              <>
                <Text style={b.copy}>{t("provaBuilder.repeatIntro")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: repeatDetails }}
                  onPress={() => setRepeatDetails(!repeatDetails)}
                  style={{ minHeight: 48, justifyContent: "center" }}
                >
                  <Text style={[b.bold, { color: p.purple }]}>
                    {t("provaBuilder.repeatRules")}
                  </Text>
                </Pressable>
                {repeatDetails && (
                  <Text style={b.muted}>{t("provaBuilder.repeatHelp")}</Text>
                )}
                {repeats.isPending && (
                  <Text style={b.copy}>{t("common.loading")}</Text>
                )}
                {repeats.error && (
                  <SatinButton
                    secondary
                    title={t("common.retry")}
                    onPress={() => void repeats.refetch()}
                  />
                )}
                {repeats.isSuccess && !repeats.data.length && (
                  <Text style={b.hint}>{t("provaBuilder.repeatEmpty")}</Text>
                )}
                {repeats.data?.map((unit) => {
                  const already = draft.blocks.some((block) =>
                    block.id === unit.id
                  );
                  return (
                    <View key={unit.id} style={b.block}>
                      <BuilderChoice
                        label={unit.title}
                        selected={already ||
                          selected.some((block) => block.id === unit.id)}
                        disabled={already || busy ||
                          (unit.kind === "group" && !policy.data)}
                        onPress={() =>
                          choose({
                            kind: unit.kind,
                            id: unit.id,
                            source: "library",
                          })}
                      />
                      <Text style={b.muted}>
                        {unit.subject} · {t("provaBuilder.repeatCount", {
                          affected: unit.affected,
                          total: unit.question_count,
                        })}
                      </Text>
                      {unit.kind === "group" && (
                        <Text style={b.copy}>
                          {t("provaBuilder.repeatShared")}
                        </Text>
                      )}
                      {unit.kind === "group" && !policy.data && (
                        <Text style={b.muted}>
                          {t("provaBuilder.sourceDisabled")}
                        </Text>
                      )}
                      {already && (
                        <Text style={b.muted}>
                          {t("provaBuilder.repeatAlready")}
                        </Text>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("provaBuilder.repeatEvidence")}
                        disabled={busy}
                        style={[b.row, { minHeight: 48 }]}
                        onPress={() => {
                          const first = unit.evidence[0];
                          if (!first) return;
                          onClose();
                          router.push({
                            pathname: "/parent/prova/review/[attemptId]",
                            params: {
                              attemptId: first.attempt_id,
                              questionId: first.question_id,
                            },
                          });
                        }}
                      >
                        <Text style={[b.bold, { color: p.purple }]}>
                          {t("provaBuilder.repeatEvidence")}
                        </Text>
                        <ArrowRight size={18} color={p.purple} />
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}
            {mode === "ai" || mode === "document"
              ? (
                <>
                  {generationRecord
                    ? (
                      <View style={b.hint}>
                        <Text style={b.bold}>
                          {t(
                            generationRecord.result
                              ? "generationRecovery.ready"
                              : generationRecord.safeFailure
                              ? "generationRecovery.failedTitle"
                              : "generationRecovery.pending",
                          )}
                        </Text>
                        <Text style={b.copy}>
                          {generationRecord.payload.subject} ·{" "}
                          {t("parent.gradeShort", {
                            grade: generationRecord.payload.grade,
                          })} · {t("catalogFlow.count", {
                            n: generationRecord.payload.count,
                          })}
                        </Text>
                        <Text style={b.copy}>
                          {t(
                            generationRecord.result
                              ? "generationRecovery.readyHelp"
                              : generationRecord.safeFailure
                              ? "generationRecovery.failed"
                              : "generationRecovery.pendingHelp",
                          )}
                        </Text>
                        {!recoveredFits
                          ? (
                            <Text style={b.error}>
                              {t("generationRecovery.scopeChanged")}
                            </Text>
                          )
                          : null}
                        {generationRecord.safeFailure
                          ? (
                            <SatinButton
                              secondary
                              disabled={busy}
                              title={t("generationRecovery.edit")}
                              onPress={releaseGeneration}
                            />
                          )
                          : generationRecord.result
                          ? null
                          : (
                            <SatinButton
                              busy={generation.isPending}
                              disabled={add.isPending || storageBlocked}
                              title={t("generationRecovery.check")}
                              onPress={() => {
                                setLocalError(null);
                                generation.mutate();
                              }}
                            />
                          )}
                      </View>
                    )
                    : null}
                  {generationRecord && !generationRecord.result &&
                      !generationRecord.safeFailure
                    ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={releaseGeneration}
                        style={{ minHeight: 48, justifyContent: "center" }}
                      >
                        <Text style={[b.bold, { color: p.purple }]}>
                          {t("generationRecovery.cancel")}
                        </Text>
                      </Pressable>
                    )
                    : null}
                  {storageBlocked
                    ? (
                      <Text accessibilityRole="alert" style={b.error}>
                        {t("generationRecovery.blocked")}
                      </Text>
                    )
                    : null}
                  {!generationRecord
                    ? (
                      <>
                        <Text style={b.copy}>
                          {t(
                            mode === "document"
                              ? "provaBuilder.documentHelp"
                              : "provaBuilder.aiHelp",
                          )}
                        </Text>
                        <View
                          pointerEvents={busy ? "none" : "auto"}
                          style={{ gap: 14 }}
                        >
                          <View style={b.wrap}>
                            {draft.subjects.map((s) => (
                              <BuilderChoice
                                key={s}
                                selected={subject === s}
                                label={s}
                                onPress={() => {
                                  setSubject(s);
                                  setTopics([]);
                                  setBlueprintId(null);
                                  setAiRows([]);
                                  setSelected([]);
                                }}
                              />
                            ))}
                          </View>
                          {entitlement.data?.scenarios &&
                              blueprints.data?.length
                            ? (
                              <View style={{ gap: 10 }}>
                                <Text style={b.bold}>
                                  {t("prova.fromBlueprint")}
                                </Text>
                                <View style={b.wrap}>
                                  <BuilderChoice
                                    label={t("prova.noBlueprint")}
                                    selected={!blueprintId}
                                    onPress={() => setBlueprintId(null)}
                                  />
                                  {blueprints.data.map((bp) => (
                                    <BuilderChoice
                                      key={bp.id}
                                      label={[
                                        bp.name,
                                        typeof bp.source_context === "object" &&
                                          bp.source_context &&
                                          !Array.isArray(bp.source_context) &&
                                          typeof bp.source_context
                                              .academic_year ===
                                            "string"
                                          ? bp.source_context.academic_year
                                          : "",
                                      ].filter(Boolean).join(" · ")}
                                      selected={blueprintId === bp.id}
                                      onPress={() => setBlueprintId(bp.id)}
                                    />
                                  ))}
                                </View>
                              </View>
                            )
                            : null}
                          {entitlement.data?.scenarios
                            ? (
                              <SatinButton
                                secondary
                                title={t("prova.newBlueprint")}
                                onPress={() => {
                                  onClose();
                                  router.push("/parent/prova/blueprint");
                                }}
                              />
                            )
                            : null}
                          {blueprint
                            ? (
                              <Text style={b.hint}>
                                {t(
                                  blueprint.source_context &&
                                    typeof blueprint.source_context ===
                                      "object" &&
                                    !Array.isArray(blueprint.source_context) &&
                                    blueprint.source_context.origin ===
                                      "reviewed_catalogue"
                                    ? "catalogFlow.notice"
                                    : "blueprintFlow.manualNotice",
                                )}
                              </Text>
                            )
                            : null}
                          {!blueprint
                            ? (
                              <>
                                <Text style={b.muted}>
                                  {t("provaBuilder.aiTopics")}
                                </Text>
                                <View style={b.wrap}>
                                  {draft.topics.map((topic) => (
                                    <BuilderChoice
                                      key={topic}
                                      label={topic}
                                      selected={topics.includes(topic)}
                                      onPress={() =>
                                        setTopics((v) =>
                                          v.includes(topic)
                                            ? v.filter((t) => t !== topic)
                                            : [...v, topic]
                                        )}
                                    />
                                  ))}
                                </View>
                                <NumberChoice label={t("provaBuilder.target")} value={count} min={1} max={30} step={1} presets={[3,5,10,20,30]} disabled={busy} onChange={setCount}/>
                                {/* C04: kısmi veya tam AI üretimi aynı taslakta — eksik soru sayısı tek istekle. */}
                                {provaRemainingCount(draft.target, currentCount) > 0 &&
                                    count !== provaRemainingCount(draft.target, currentCount)
                                  ? (
                                    <SatinButton
                                      secondary
                                      disabled={busy}
                                      title={t(currentCount === 0 ? "provaC04.ai.fillAll" : "provaC04.ai.fillRemaining", {
                                        count: provaRemainingCount(draft.target, currentCount),
                                      })}
                                      onPress={() => setCount(provaRemainingCount(draft.target, currentCount))}
                                    />
                                  )
                                  : null}
                              </>
                            )
                            : null}
                          {plan.map((row) => (
                            <Text key={row.topic} style={b.muted}>
                              {row.topic} · {row.count}
                            </Text>
                          ))}
                          {!planValid
                            ? (
                              <Text style={b.muted}>
                                {t("provaBuilder.aiPlanRequired")}
                              </Text>
                            )
                            : null}
                          {mode === "document"
                            ? (
                              <>
                                <SourceFilesPicker value={file} onBusyChange={setPicking} disabled={busy || !!generationRecord} onChange={(f)=>{setFile(f);setConsent(false);setAiRows([]);setSelected([]);}} />
                                <Toggle
                                  label={t("provaBuilder.consent")}
                                  value={consent}
                                  onChange={setConsent}
                                />
                              </>
                            )
                            : null}
                        </View>
                        <View testID="qt-ai-types" style={{ gap: 8 }}>
                          <Text style={b.bold}>{t("prova.qt.author.ai.typesTitle")}</Text>
                          <Text style={b.muted}>{t("prova.qt.author.ai.typesHelp")}</Text>
                          <View style={b.wrap}>
                            {aiTypesAllowed(false, AI_PHASES).map((type) => {
                              const allowed = aiTypesAllowed(writtenTrack, AI_PHASES).includes(type);
                              return (
                                <BuilderChoice
                                  key={type}
                                  label={type === "multiple_choice" || type === "open_ended" ? t(`provaBuilder.${type}`) : structuredTypeLabel(t, type)}
                                  selected={allowed && aiTypes.includes(type)}
                                  disabled={busy || !!generationRecord || !allowed}
                                  onPress={() => setAiTypes((v) => v.includes(type) ? v.filter((x) => x !== type) : [...v, type])}
                                />
                              );
                            })}
                          </View>
                          {writtenTrack
                            ? <Text testID="qt-ai-types-written" style={b.muted}>{t("prova.qt.author.ai.typesWritten")}</Text>
                            : null}
                          {requestedTypes?.some((x) => x !== "multiple_choice" && x !== "open_ended" && !structuredFitsKind(provaGenerationKind(draft), x))
                            ? <Text style={b.muted}>{t("prova.qt.author.ai.typesKindHint")}</Text>
                            : null}
                        </View>
                        <View style={b.hint}>
                          <Text style={b.bold}>
                            {typeof remaining === "number"
                              ? t("provaBuilder.aiQuota", { count: remaining })
                              : t("provaBuilder.quotaUnavailable")}
                          </Text>
                          <Text style={b.muted}>
                            {t("provaBuilder.aiCost", { count: aiCount })}
                          </Text>
                        </View>
                        <SatinButton
                          busy={generation.isPending}
                          disabled={picking || storageBlocked || add.isPending ||
                            typeof remaining !== "number" ||
                            remaining < aiCount || !planValid || !subject ||
                            (mode === "document" && (!file || !consent))}
                          title={t(
                            generation.isError
                              ? "provaBuilder.aiRetry"
                              : "provaBuilder.generate",
                          )}
                          onPress={() => {
                            setLocalError(null);
                            generation.mutate();
                          }}
                        />
                        {entitlement.error
                          ? (
                            <SatinButton
                              secondary
                              title={t("common.retry")}
                              onPress={() => void entitlement.refetch()}
                            />
                          )
                          : null}
                      </>
                    )
                    : null}
                  {aiRows.length
                    ? <Text style={b.bold}>{t("provaBuilder.aiCheck")}</Text>
                    : null}
                  {/* C04: aynı üretimin bütün önerileri seçilebilir; seçim yeni üretim/ücret doğurmaz.
                      D1: sunucunun kurduğu ortak kaynak grubu tek seçimdir (bölünmez); ortak metin bir kez görünür. */}
                  {aiUnits.some((unit) => !unitInDraft(unit) && !isSelected(effectiveId(unit))) &&
                      recoveredFits
                    ? (
                      <View style={[b.hint, { gap: 8 }]}>
                        <SatinButton
                          secondary
                          disabled={busy}
                          title={t("provaC04.ai.selectAll", {
                            count: aiUnits.filter((unit) => !unitInDraft(unit))
                              .reduce((n, unit) => n + unitSize(unit), 0),
                          })}
                          onPress={() =>
                            setSelected((v) => [
                              ...v,
                              ...aiUnits.filter((unit) =>
                                !unitInDraft(unit) &&
                                !v.some((block) => block.id === effectiveId(unit))
                              ).map((unit) => ({
                                kind: unit.kind,
                                id: effectiveId(unit),
                                source: aiSource,
                              })),
                            ])}
                        />
                        <Text style={b.muted}>{t("provaC04.ai.noSecondCharge")}</Text>
                      </View>
                    )
                    : null}
                  {aiUnits.map((unit) => {
                    const already = unitInDraft(unit);
                    const id = effectiveId(unit);
                    const first = aiRows.findIndex((q) =>
                      q.id === (unit.kind === "group" ? unit.questions[0]?.id : unit.id)
                    );
                    if (unit.kind === "question") {
                      const q = editedQuestion(unit.id) ??
                        aiRows.find((row) => row.id === unit.id);
                      if (!q) return null;
                      return (
                        <View key={unit.id} style={b.card}>
                          <BuilderChoice
                            label={t("generationRecovery.question", {
                              n: first + 1,
                            })}
                            selected={already || isSelected(id)}
                            disabled={already || busy || !recoveredFits}
                            onPress={() =>
                              choose({ kind: "question", id, source: aiSource })}
                          />
                          <BuilderQuestionPreview
                            q={q}
                            showAnswer
                            onEdit={busy || !recoveredFits || q.kind === "structured"
                              ? undefined
                              : () => openEdit({ kind: "question", id })}
                          />
                        </View>
                      );
                    }
                    const edited = editedGroup(unit.id);
                    const view = edited
                      ? {
                        title: edited.group.title,
                        body: edited.group.body,
                        questions: edited.questions,
                      }
                      : unit;
                    return (
                      <View
                        key={unit.id}
                        style={[b.card, { gap: 10 }]}
                        accessibilityLabel={t("d1.ai.groupLabel", { count: unit.questions.length })}
                      >
                        <BuilderChoice
                          label={t("d1.ai.groupLabel", { count: unit.questions.length })}
                          selected={already || isSelected(id)}
                          disabled={already || busy || !recoveredFits || !policy.data}
                          onPress={() =>
                            choose({ kind: "group", id, source: aiSource })}
                        />
                        <Text style={b.muted}>{t("d1.ai.groupHelp")}</Text>
                        {edited
                          ? (
                            <Text style={[b.muted, { color: p.purple }]}>
                              {t("d14.edit.edited")}
                            </Text>
                          )
                          : null}
                        {policy.data && recoveredFits
                          ? (
                            <EditAction
                              disabled={busy}
                              label={t("d14.edit.groupAction")}
                              onPress={() => openEdit({ kind: "group", id })}
                            />
                          )
                          : null}
                        <View
                          style={{
                            backgroundColor: p.lilac,
                            borderRadius: 16,
                            padding: 12,
                            gap: 6,
                          }}
                        >
                          <Text style={[b.muted, { color: p.purple }]}>
                            {t("sharedQuestions.common")}
                          </Text>
                          <Text style={b.bold}>{view.title}</Text>
                          <Text selectable style={b.copy}>{view.body}</Text>
                        </View>
                        {edited
                          ? edited.questions.map((q, i) => (
                            <View key={q.id} style={{ gap: 4 }}>
                              <Text style={b.bold}>
                                {t("generationRecovery.question", { n: first + i + 1 })}
                              </Text>
                              <BuilderQuestionPreview
                                q={q}
                                showAnswer
                                editable={!!policy.data}
                              />
                            </View>
                          ))
                          : unit.questions.map((member, i) => {
                            const q = aiRows.find((row) => row.id === member.id);
                            return q
                              ? (
                                <View key={member.id} style={{ gap: 4 }}>
                                  <Text style={b.bold}>
                                    {t("generationRecovery.question", { n: first + i + 1 })}
                                  </Text>
                                  <BuilderQuestionPreview
                                    q={{ ...q, stem: member.stem }}
                                    showAnswer
                                    editable={!!policy.data && recoveredFits}
                                  />
                                </View>
                              )
                              : null;
                          })}
                      </View>
                    );
                  })}
                  {generationRecord?.result
                    ? (
                      <SatinButton
                        secondary
                        disabled={busy}
                        title={t("generationRecovery.new")}
                        onPress={releaseGeneration}
                      />
                    )
                    : null}
                </>
              )
              : null}
          </ScrollView>
          {selected.length
            ? (
              <View style={b.row}>
                <Text style={[b.muted, { flex: 1 }]}>
                  {t("provaBuilder.selected", { count: selected.length })}
                </Text>
                <SatinButton
                  busy={add.isPending}
                  disabled={busy}
                  title={t("provaBuilder.addSelected")}
                  onPress={() => add.mutate()}
                />
              </View>
            )
            : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
