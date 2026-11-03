import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import type { ProvaBlock, ProvaDraft } from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import {
  chooseLearningDocument,
  type LocalLearningFile,
  uploadLearningFile,
} from "@/lib/learning-files";
import {
  type GenerateResponse,
  invokeProvaAi,
  provaErrorMessage,
} from "@/lib/prova-ai";
import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import { b, BuilderChoice, BuilderQuestionPreview } from "./prova-builder-ui";
import type { BuilderQuestion } from "./prova-builder-data";

type Mode = "sources" | "library" | "ai" | "manual" | "document" | "repeat";
type RepeatUnit = { kind: "question" | "group"; id: string; title: string; subject: string; affected: number; question_count: number; evidence: {attempt_id:string; question_id:string; state:"wrong"|"partial"}[] };
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
    { claims } = useSession(),
    familyId = claims?.family_id ?? "";
  const [repeatDetails, setRepeatDetails] = useState(false);
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
  const request = useRef<{ id: string; body: string } | null>(null),
    [preview, setPreview] = useState<BuilderQuestion | null>(null),
    [aiRows, setAiRows] = useState<BuilderQuestion[]>([]);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
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
    queryKey: ["builder_blueprints", familyId, draft.grade, subject],
    enabled: visible && !!subject && !!draft.grade,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_blueprints").select(
        "id,name,subject,grade,rows",
      ).eq("grade", draft.grade!).eq("subject", subject).order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return data;
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
    queryKey: ["repeat_candidates", familyId, draftId, draft.childId, draft.grade, draft.subjects],
    enabled: visible && mode === "repeat" && !!draft.childId,
    queryFn: async () => {
      const {data,error} = await supabase.rpc("get_repeat_candidates", {p_draft_id:draftId});
      if (error) throw error;
      return data as unknown as RepeatUnit[];
    },
  });
  const remaining = entitlement.data?.ai_generate_remaining;
  const generation = useMutation({
    mutationFn: async () => {
      if (!subject) throw new Error(t("provaBuilder.subjectRequired"));
      if (!planValid) {
        throw new Error(t("provaBuilder.topicRequired"));
      }
      if (mode === "document" && (!file || !consent)) {
        throw new Error(t("provaBuilder.consent"));
      }
      if (mode === "document" && file) {
        await uploadLearningFile(file, "document");
      }
      const payload = {
        subject,
        grade: draft.grade,
        topic_plan: plan,
        blueprint_id: blueprint?.id ?? null,
        count: aiCount,
        kind: draft.kind,
        assessment: draft.kind === "open_ended" && draft.purpose === "written"
          ? "written"
          : "practice",
        difficulty: draft.difficulty,
        note: draft.note,
        locale: i18n.language.startsWith("en") ? "en" : "tr",
        ...(mode === "document" && file
          ? { source_id: file.id, ai_consent: consent }
          : {}),
      };
      const body = JSON.stringify(payload);
      if (!request.current || request.current.body !== body) {
        request.current = { id: randomUUID(), body };
      }
      return invokeProvaAi<GenerateResponse>("prova-generate", {
        ...payload,
        request_id: request.current.id,
      });
    },
    onSuccess: (data) => {
      setAiRows(
        data.questions.map(
          (q) => ({ ...q, grade: draft.grade!, subject } as BuilderQuestion),
        ),
      );
      setSelected([]);
      void entitlement.refetch();
    },
    onError: setLocalError,
  });
  const add = useMutation({
    mutationFn: () => onAdd(selected),
    onError: setLocalError,
  });
  const busy = generation.isPending || add.isPending;
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
  const error = localError ?? (mode === "library" ? bank.error : mode === "repeat" ? repeats.error : null);
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
                <Pressable accessibilityRole="button" accessibilityLabel={t("provaBuilder.back")} disabled={busy} onPress={() => switchMode("sources")} style={[b.row,{minHeight:48,alignSelf:'flex-start',paddingRight:16}]}><ArrowLeft size={20} color={p.purple}/><Text style={[b.bold,{color:p.purple}]}>{t("provaBuilder.back")}</Text></Pressable>
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
                  <SatinButton secondary title={t("provaBuilder.repeat")} disabled={!draft.childId} onPress={() => switchMode("repeat")} />
                  {!draft.childId && <Text style={b.muted}>{t("provaBuilder.repeatChild")}</Text>}
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
            {mode === "repeat" && <>
              <Text style={b.copy}>{t("provaBuilder.repeatIntro")}</Text>
              <Pressable accessibilityRole="button" accessibilityState={{expanded:repeatDetails}} onPress={()=>setRepeatDetails(!repeatDetails)} style={{minHeight:48,justifyContent:'center'}}><Text style={[b.bold,{color:p.purple}]}>{t("provaBuilder.repeatRules")}</Text></Pressable>
              {repeatDetails && <Text style={b.muted}>{t("provaBuilder.repeatHelp")}</Text>}
              {repeats.isPending && <Text style={b.copy}>{t("common.loading")}</Text>}
              {repeats.error && <SatinButton secondary title={t("common.retry")} onPress={() => void repeats.refetch()} />}
              {repeats.isSuccess && !repeats.data.length && <Text style={b.hint}>{t("provaBuilder.repeatEmpty")}</Text>}
              {repeats.data?.map(unit => {
                const already=draft.blocks.some(block=>block.id===unit.id);
                return <View key={unit.id} style={b.block}>
                  <BuilderChoice label={unit.title} selected={already || selected.some(block=>block.id===unit.id)} disabled={already || busy || (unit.kind==='group' && !policy.data)} onPress={()=>choose({kind:unit.kind,id:unit.id,source:'library'})}/>
                  <Text style={b.muted}>{unit.subject} · {t('provaBuilder.repeatCount',{affected:unit.affected,total:unit.question_count})}</Text>
                  {unit.kind==='group' && <Text style={b.copy}>{t('provaBuilder.repeatShared')}</Text>}
                  {unit.kind==='group' && !policy.data && <Text style={b.muted}>{t('provaBuilder.sourceDisabled')}</Text>}
                  {already && <Text style={b.muted}>{t('provaBuilder.repeatAlready')}</Text>}
                  <Pressable accessibilityRole="button" accessibilityLabel={t('provaBuilder.repeatEvidence')} disabled={busy} style={[b.row,{minHeight:48}]} onPress={()=>{
                    const first=unit.evidence[0]; if(!first)return;
                    onClose();router.push({pathname:'/parent/prova/review/[attemptId]',params:{attemptId:first.attempt_id,questionId:first.question_id}});
                  }}><Text style={[b.bold,{color:p.purple}]}>{t('provaBuilder.repeatEvidence')}</Text><ArrowRight size={18} color={p.purple}/></Pressable>
                </View>;
              })}
            </>}
            {mode === "ai" || mode === "document"
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
                    {entitlement.data?.scenarios && blueprints.data?.length
                      ? (
                        <View style={{ gap: 10 }}>
                          <Text style={b.bold}>{t("prova.fromBlueprint")}</Text>
                          <View style={b.wrap}>
                            <BuilderChoice
                              label={t("prova.noBlueprint")}
                              selected={!blueprintId}
                              onPress={() => setBlueprintId(null)}
                            />
                            {blueprints.data.map((bp) => (
                              <BuilderChoice
                                key={bp.id}
                                label={bp.name}
                                selected={blueprintId === bp.id}
                                onPress={() => setBlueprintId(bp.id)}
                              />
                            ))}
                          </View>
                        </View>
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
                          <Field
                            label={t("provaBuilder.target")}
                            keyboardType="number-pad"
                            value={String(count)}
                            maxLength={2}
                            onChangeText={(v) =>
                              setCount(
                                Math.min(30, Math.max(1, Number(v) || 1)),
                              )}
                          />
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
                          <SatinButton
                            secondary
                            title={t("provaBuilder.pickDocument")}
                            onPress={() =>
                              void chooseLearningDocument().then((f) => {
                                if (f) {
                                  setFile(f);
                                  setConsent(false);
                                  setAiRows([]);
                                  setSelected([]);
                                }
                              }).catch(setLocalError)}
                          />
                          {file
                            ? <Text style={b.muted}>{file.name}</Text>
                            : null}
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
                    disabled={add.isPending || typeof remaining !== "number" ||
                      remaining < aiCount || !planValid || !subject ||
                      (mode === "document" && (!file || !consent))}
                    title={t(
                      generation.isError
                        ? "provaBuilder.aiRetry"
                        : "provaBuilder.generate",
                    )}
                    onPress={() => {
                      setLocalError(null);
                      if (generation.isSuccess) request.current = null;
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
                  {aiRows.length
                    ? <Text style={b.bold}>{t("provaBuilder.aiCheck")}</Text>
                    : null}
                  {aiRows.map((q) => {
                    const already = draft.blocks.some((b) => b.id === q.id);
                    return (
                      <View key={q.id} style={b.card}>
                        <BuilderChoice
                          label={q.stem}
                          selected={already ||
                            selected.some((b) => b.id === q.id)}
                          disabled={already || busy}
                          onPress={() =>
                            choose({
                              kind: "question",
                              id: q.id,
                              source: mode === "document" ? "document" : "ai",
                            })}
                        />
                        <BuilderQuestionPreview q={q} showAnswer />
                      </View>
                    );
                  })}
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
