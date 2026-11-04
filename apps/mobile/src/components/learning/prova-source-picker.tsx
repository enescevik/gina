import { NumberChoice } from "@/components/ui/number-choice";
import { SourceFilesPicker } from "@/components/learning/source-files-picker";
import { provaGenerationJournal } from "@/lib/setup-command";
import { canonicalSubject, catalogBlueprintFits, provaGenerationKind } from "@gina/core";
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
  provaErrorMessage,
} from "@/lib/prova-ai";
import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import { b, BuilderChoice, BuilderQuestionPreview } from "./prova-builder-ui";
import type { BuilderQuestion } from "./prova-builder-data";

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
  { visible, draft, draftId, onClose, onAdd }: {
    visible: boolean;
    draft: ProvaDraft;
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
                            {t(`provaBuilder.${q.kind}`)}
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
                  {aiRows.map((q, index) => {
                    const already = draft.blocks.some((b) => b.id === q.id);
                    return (
                      <View key={q.id} style={b.card}>
                        <BuilderChoice
                          label={t("generationRecovery.question", {
                            n: index + 1,
                          })}
                          selected={already ||
                            selected.some((b) => b.id === q.id)}
                          disabled={already || busy || !recoveredFits}
                          onPress={() =>
                            choose({
                              kind: "question",
                              id: q.id,
                              source: generationRecord?.payload.source_id
                                ? "document"
                                : "ai",
                            })}
                        />
                        <BuilderQuestionPreview q={q} showAnswer />
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
