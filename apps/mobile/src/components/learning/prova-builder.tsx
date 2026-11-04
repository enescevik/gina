import { NumberChoice, PromptExamples } from "@/components/ui/number-choice";
import { invalidateProvaLists } from "@/lib/prova-cache";
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from "expo-router";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ellipsis,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  appendProvaBlocks,
  moveProvaBlock,
  newProvaDraft,
  provaGenerationKind,
  type ProvaBlock,
  type ProvaDraft,
} from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/avatar";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import {
  type DraftRecord,
  fetchProvaDrafts,
  persistProvaDraft,
} from "@/lib/prova-draft";
import { provaErrorMessage } from "@/lib/prova-ai";
import { NOTEBOOK_MODAL_PROPS } from "./notebook-layout";
import {
  hasAnswer,
  loadBuilderMaterial,
  questionsOf,
} from "./prova-builder-data";
import { ProvaSourcePicker } from "./prova-source-picker";

import {
  b,
  BuilderCard,
  BuilderChoice,
  BuilderQuestionPreview,
} from "./prova-builder-ui";
export default function ProvaBuilder() {
  const { t } = useTranslation(),
    { claims } = useSession(),
    cache = useQueryClient();
  const { draftId, groupId, childId: initialChild } = useLocalSearchParams<
    { draftId?: string; groupId?: string; childId?: string }
  >();
  const [id] = useState(() => draftId ?? randomUUID());
  const [draft, setDraft] = useState<ProvaDraft>(newProvaDraft),
    [record, setRecord] = useState<DraftRecord | null>(null);
  const [loaded, setLoaded] = useState(!draftId),
    [loadError, setLoadError] = useState<unknown>(null),
    [error, setError] = useState<unknown>(null);
  const [actions, setActions] = useState<string | null>(null);
  const [source, setSource] = useState(false),
    [checked, setChecked] = useState(false),
    [answer, setAnswer] = useState(false),
    [previewIndex, setPreviewIndex] = useState(0);
  const [subjectInput, setSubjectInput] = useState(""),
    [topicInput, setTopicInput] = useState(""),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const [allowLeave, setAllowLeave] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 950 && fontScale < 1.4;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null),
    saveRequest = useRef<{ fingerprint: string; id: string } | null>(null),
    submitRequest = useRef(randomUUID());
  const familyId = claims?.family_id ?? "";
  const dirty = loaded &&
    JSON.stringify(draft) !==
      JSON.stringify(record?.content ?? newProvaDraft());
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const reload = useCallback(async (force = false) => {
    try {
      setLoadError(null);
      const r = (await fetchProvaDrafts(id))[0];
      if (!r) throw new Error("prova_draft_not_found");
      if (!force && dirtyRef.current) return;
      setRecord(r);
      setDraft(r.content);
      setLoaded(true);
      setError(null);
      setUncertain(false);
      saveRequest.current = null;
    } catch (e) {
      setLoadError(e);
    }
  }, [id]);
  useFocusEffect(useCallback(() => {
    if (draftId && !dirtyRef.current) void reload();
  }, [draftId, reload]));
  const children = useQuery({
    queryKey: ["children", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,grade,avatar",
      ).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const catalog = useQuery({
    queryKey: ["builder_catalog", familyId, draft.grade],
    enabled: !!draft.grade,
    queryFn: async () => {
      const { data, error } = await supabase.from("current_question_bank")
        .select("subject,topic").eq("grade", draft.grade!).limit(1500);
      if (error) throw error;
      return data;
    },
  });
  const material = useQuery({
    queryKey: ["builder_material", familyId, draft.blocks],
    queryFn: () => loadBuilderMaterial(draft.blocks),
  });
  const legacy = useQuery({
    queryKey: ["builder_legacy", familyId, groupId],
    enabled: !!groupId && !draftId,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_source_groups")
        .select("id,grade,subject,title,question_source_members(question_id)")
        .eq("id", groupId!).single();
      if (error) throw error;
      return data;
    },
  });
  const [seededGroup, setSeededGroup] = useState<string | null>(null);
  if (legacy.data && !draftId && seededGroup !== legacy.data.id) {
    setSeededGroup(legacy.data.id);
    setDraft((d) =>
      d.blocks.length ? d : {
        ...d,
        grade: legacy.data.grade,
        subjects: [legacy.data.subject],
        title: legacy.data.title,
        target: legacy.data.question_source_members.length,
        blocks: [{ kind: "group", id: legacy.data.id, source: "library" }],
      }
    );
  }
  if (
    loaded && !draft.childId && initialChild &&
    children.data?.some((c) => c.id === initialChild)
  ) {
    const c = children.data.find((c) => c.id === initialChild)!;
    setDraft((d) => ({ ...d, childId: c.id, grade: c.grade }));
  }
  if (loaded && !draft.childId && children.data?.length === 1) {
    const c = children.data[0];
    setDraft((d) => ({ ...d, childId: c.id, grade: c.grade ?? d.grade }));
  }
  const update = (patch: Partial<ProvaDraft>) => {
    if (uncertain || save.isPending || submit.isPending) return;
    setDraft((d) => ({ ...d, ...patch }));
    setChecked(false);
    setError(null);
  };
  const save = useMutation({
    mutationFn: async (content: ProvaDraft) => {
      const fingerprint = JSON.stringify({
        version: record?.version ?? 0,
        content,
      });
      if (
        !saveRequest.current || saveRequest.current.fingerprint !== fingerprint
      ) saveRequest.current = { fingerprint, id: randomUUID() };
      return persistProvaDraft(
        id,
        record?.version ?? 0,
        content,
        saveRequest.current.id,
      );
    },
    onSuccess: (r) => {
      setRecord(r);
      setDraft(r.content);
      if (!draftId) router.setParams({ draftId: id });
      setUncertain(false);
      setError(null);
      void cache.invalidateQueries({ queryKey: ["prova_drafts", familyId] });
    },
    onError: (e) => {
      setError(e);
      const code = (e as { code?: string }).code;
      setUncertain(!code || !/^(P0001|42501|22\w+|23\w+)$/.test(code));
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      const r = await save.mutateAsync(draft);
      const { error } = await supabase.rpc("submit_prova_draft", {
        p_request_id: submitRequest.current,
        p_id: id,
        p_version: r.version,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAllowLeave(true);
      void invalidateProvaLists(cache);
      void cache.invalidateQueries({ queryKey: ["prova_drafts", familyId] });
      router.replace("/parent/prova");
    },
    onError: setError,
  });
  const busy = save.isPending || submit.isPending,
    locked = busy || uncertain || !!record?.submitted_at;
  usePreventRemove(
    !allowLeave && (dirty || busy || uncertain),
    ({ repeat }) => {
      if (!busy) setLeave(() => repeat);
    },
  );
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const child = children.data?.find((c) => c.id === draft.childId),
    mat = material.data ?? { questions: [], groups: [] };
  const flat = draft.blocks.flatMap((block) => questionsOf(block, mat));
  const missing = material.isSuccess && draft.blocks.some((block) =>
    questionsOf(block, mat).length === 0
  );
  const mismatch = flat.some((q) =>
    q.grade !== draft.grade || !draft.subjects.includes(q.subject)
  );
  const noAnswer = flat.some((q) => !hasAnswer(q));
  const scopeValid = !!child && !!draft.grade && draft.subjects.length > 0;
  const publishValid = scopeValid && !!draft.title.trim() &&
    draft.format !== "meb" && flat.length === draft.target && !missing &&
    !mismatch && !noAnswer && !material.isPending && !material.error && checked;
  async function navigateStep(step: number) {
    if (step > 0 && !scopeValid) {
      setError(new Error(t("provaBuilder.missingScope")));
      return;
    }
    try {
      await save.mutateAsync({ ...draft, step });
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch {}
  }
  async function openSources() {
    try {
      await save.mutateAsync(draft);
      setSource(true);
    } catch {}
  }
  async function addBlocks(blocks: ProvaBlock[]) {
    const next = appendProvaBlocks(draft, blocks);
    await save.mutateAsync(next);
    setChecked(false);
    setSource(false);
  }
  const choicesSubjects = [
    ...new Set([
      ...(catalog.data ?? []).map((c) => c.subject),
      ...draft.subjects,
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const suggestedTopics = [
    ...new Set(
      (catalog.data ?? []).filter((c) => draft.subjects.includes(c.subject))
        .map((c) => c.topic),
    ),
  ];
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
  const header = t(
    `provaBuilder.${
      ["start", "scope", "questions", "review"][draft.step]
    }Title`,
  );
  const preview = flat[Math.min(previewIndex, flat.length - 1)],
    previewBlock = preview
      ? draft.blocks.find((block) =>
        questionsOf(block, mat).some((q) => q.id === preview.id)
      )
      : null;
  const previewGroup = mat.groups.find((g) => g.id === previewBlock?.id);
  const summary = (
    <View style={{ gap: 18 }}>
      <Text style={b.h2}>{t("provaBuilder.summary")}</Text>
      {[
        [t("provaBuilder.child"), child?.name ?? "—"],
        [t("provaBuilder.grade"), draft.grade ?? "—"],
        [t("provaBuilder.purpose"), t(`provaBuilder.${draft.purpose}`)],
        [t("provaBuilder.subjects"), draft.subjects.join(" · ") || "—"],
        [t("provaBuilder.target"), draft.target],
        [
          t("provaBuilder.timing"),
          draft.minutes
            ? `${draft.minutes} ${t("prova.min")}`
            : t("provaBuilder.untimed"),
        ],
      ].map(([key, value]) => (
        <View key={key} style={b.summaryRow}>
          <Text style={b.muted}>{key}</Text>
          <Text style={[b.bold, { flex: 1, textAlign: "right" }]}>{value}</Text>
        </View>
      ))}
      <View style={b.hint}>
        <Text style={b.muted}>{t("provaBuilder.scopeHint")}</Text>
      </View>
      <View style={b.row}>
        <Image
          source={require(
            "../../../../../packages/assets/brand/growing-friend/reading.png",
          )}
          style={{ width: 112, height: 108 }}
          resizeMode="contain"
        />
        <Text style={[b.muted, { flex: 1 }]}>{t("provaBuilder.mascot")}</Text>
      </View>
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={b.top}>
          <IconButton
            label={t("common.back")}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/parent/prova")}
          >
            <ArrowLeft color={p.ink} />
          </IconButton>
          <Image
            source={require(
              "../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            style={{ width: 86, height: 42 }}
            resizeMode="contain"
          />
          <Text style={[b.bold, { flex: 1 }]}>{t("provaBuilder.title")}</Text>
          {wide
            ? (
              <Text accessibilityLiveRegion="polite" style={b.muted}>
                {t(
                  busy
                    ? "provaBuilder.loading"
                    : dirty
                    ? "provaBuilder.unsaved"
                    : "provaBuilder.saved",
                )}
              </Text>
            )
            : null}
        </View>
        {!loaded || children.isPending
          ? <Text style={b.status}>{t("common.loading")}</Text>
          : loadError || children.error || legacy.error
          ? (
            <View style={b.card}>
              <Text style={b.error}>
                {provaErrorMessage(loadError ?? children.error ?? legacy.error)}
              </Text>
              <SatinButton
                title={t("common.retry")}
                onPress={() => {
                  void reload();
                  void children.refetch();
                }}
              />
            </View>
          )
          : (
            <>
              <ScrollView
                ref={scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={b.page}
              >
                <Text accessibilityRole="header" style={b.h1}>{header}</Text>
                <Text style={b.copy}>
                  {t(
                    `provaBuilder.${
                      ["start", "scope", "questions", "review"][draft.step]
                    }Body`,
                  )}
                </Text>
                <View style={b.steps}>
                  {[0, 1, 2, 3].map((step) => (
                    <Pressable
                      key={step}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: draft.step === step,
                        disabled: locked || step > draft.step,
                      }}
                      disabled={locked || step > draft.step}
                      onPress={() => void navigateStep(step)}
                      style={[
                        b.step,
                        draft.step === step && { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Text
                        style={[
                          b.bold,
                          {width:28,height:28,lineHeight:28,textAlign:"center",borderRadius:14,overflow:"hidden",backgroundColor:draft.step===step?p.purple:step<draft.step?"#DDF3E9":"#E4DDF2",color:draft.step===step?"#FFFFFF":step<draft.step?"#287460":p.muted},
                        ]}
                      >
                        {step < draft.step ? "✓" : step + 1}
                      </Text>
                      <Text
                        style={[b.muted, {
                          fontSize: width < 600 ? 13 : 15,
                          lineHeight: 20,
                        }, draft.step === step && { color: p.purple }]}
                      >
                        {t(`provaBuilder.step${step}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {record?.submitted_at
                  ? <Text style={b.hint}>{t("provaBuilder.sent")}</Text>
                  : null}
                {error || material.error
                  ? (
                    <View accessibilityRole="alert" style={b.hint}>
                      <Text style={b.error}>
                        {provaErrorMessage(error ?? material.error)}
                      </Text>
                      {(error as { message?: string })?.message ===
                          "prova_draft_changed"
                        ? (
                          <SatinButton
                            secondary
                            title={t("provaBuilder.reload")}
                            onPress={() => void reload(true)}
                          />
                        )
                        : (
                          <SatinButton
                            secondary
                            title={t("common.retry")}
                            onPress={() => {
                              if (material.error) void material.refetch();
                              else {void save.mutateAsync(draft).catch(
                                  () => {},
                                );}
                            }}
                          />
                        )}
                    </View>
                  )
                  : null}
                <View style={[b.columns, wide && { flexDirection: "row" }]}>
                  <View
                    style={{ flex: 1, gap: 20 }}
                    pointerEvents={locked ? "none" : "auto"}
                  >
                    {draft.step === 0
                      ? (
                        <>
                          <BuilderCard title={t("provaBuilder.child")}>
                            <View style={b.wrap}>
                              {children.data?.map((c) => (
                                <Pressable
                                  key={c.id}
                                  accessibilityRole="button"
                                  accessibilityState={{
                                    selected: draft.childId === c.id,
                                  }}
                                  onPress={() =>
                                    update({
                                      childId: c.id,
                                      grade: c.grade,
                                      title: "",
                                    })}
                                  style={[
                                    b.child,
                                    draft.childId === c.id && b.selected,
                                  ]}
                                >
                                  <Avatar slug={c.avatar} size={56} />
                                  <View>
                                    <Text style={b.bold}>{c.name}</Text>
                                    <Text style={b.muted}>
                                      {c.grade
                                        ? t("parent.gradeShort", {
                                          grade: c.grade,
                                        })
                                        : t("provaBuilder.gradeMissing")}
                                    </Text>
                                  </View>
                                </Pressable>
                              ))}
                            </View>
                            {children.data?.length === 0
                              ? (
                                <SatinButton
                                  title={t("unified.createFirstChild")}
                                  onPress={() => router.push("/parent/menu")}
                                />
                              )
                              : null}
                            {child && !child.grade
                              ? (
                                <>
                                  <Text style={b.muted}>
                                    {t("provaBuilder.gradeMissing")}
                                  </Text>
                                  <View style={b.wrap}>
                                    {Array.from({ length: 12 }, (_, i) => i + 1)
                                      .map((g) => (
                                        <BuilderChoice
                                          key={g}
                                          label={String(g)}
                                          selected={draft.grade === g}
                                          onPress={() => update({ grade: g })}
                                        />
                                      ))}
                                  </View>
                                </>
                              )
                              : null}
                          </BuilderCard>
                          <BuilderCard title={t("provaBuilder.purpose")}>
                            <View style={b.wrap}>
                              {(["practice", "written", "trial"] as const).map(
                                (v) => (
                                  <BuilderChoice
                                    key={v}
                                    label={t(`provaBuilder.${v}`)}
                                    selected={draft.purpose === v}
                                    onPress={() =>
                                      update({
                                        purpose: v,
                                        kind: v === "written"
                                          ? "open_ended"
                                          : draft.kind,
                                      })}
                                  />
                                ),
                              )}
                            </View>
                          </BuilderCard>
                          <BuilderCard title={t("provaBuilder.subjects")}>
                            <Text style={b.muted}>
                              {t("provaBuilder.subjectsHelp")}
                            </Text>
                            <View style={b.wrap}>
                              {choicesSubjects.map((s) => (
                                <BuilderChoice
                                  key={s}
                                  label={s}
                                  selected={draft.subjects.includes(s)}
                                  onPress={() =>
                                    update({
                                      subjects: toggle(draft.subjects, s),
                                    })}
                                />
                              ))}
                            </View>
                            <Field
                              label={t("provaBuilder.otherSubject")}
                              value={subjectInput}
                              onChangeText={setSubjectInput}
                              maxLength={80}
                            />
                            <SatinButton
                              secondary
                              disabled={!subjectInput.trim() ||
                                draft.subjects.length >= 12}
                              title={t("provaBuilder.add")}
                              onPress={() => {
                                update({
                                  subjects: [
                                    ...new Set([
                                      ...draft.subjects,
                                      subjectInput.trim(),
                                    ]),
                                  ],
                                });
                                setSubjectInput("");
                              }}
                            />
                          </BuilderCard>
                        </>
                      )
                      : null}
                    {draft.step === 1
                      ? (
                        <>
                          <BuilderCard title={t("provaBuilder.format")}>
                            <View style={b.wrap}>
                              {(["school", "meb"] as const).map((v) => (
                                <BuilderChoice
                                  key={v}
                                  label={t(`provaBuilder.${v}`)}
                                  selected={draft.format === v}
                                  onPress={() => update({ format: v })}
                                />
                              ))}
                            </View>
                            {draft.format === "meb"
                              ? (
                                <Text style={b.hint}>
                                  {t("provaBuilder.mebHelp")}
                                </Text>
                              )
                              : null}
                          </BuilderCard>
                          <BuilderCard title={t("provaBuilder.topics")}>
                            <Text style={b.muted}>
                              {t("provaBuilder.topicHelp")}
                            </Text>
                            <View style={b.wrap}>
                              {[
                                ...new Set([
                                  ...suggestedTopics,
                                  ...draft.topics,
                                ]),
                              ].slice(0, 60).map((topic) => (
                                <BuilderChoice
                                  key={topic}
                                  label={topic}
                                  selected={draft.topics.includes(topic)}
                                  disabled={!draft.topics.includes(topic) &&
                                    draft.topics.length >= 30}
                                  onPress={() =>
                                    update({
                                      topics: toggle(draft.topics, topic),
                                    })}
                                />
                              ))}
                            </View>
                            <Field
                              label={t("provaBuilder.topicAdd")}
                              value={topicInput}
                              onChangeText={setTopicInput}
                              maxLength={200}
                            />
                            <SatinButton
                              secondary
                              title={t("provaBuilder.add")}
                              disabled={!topicInput.trim() ||
                                draft.topics.length >= 30}
                              onPress={() => {
                                update({
                                  topics: [
                                    ...new Set([
                                      ...draft.topics,
                                      topicInput.trim(),
                                    ]),
                                  ],
                                });
                                setTopicInput("");
                              }}
                            />
                          </BuilderCard>
                          <BuilderCard>
                            <NumberChoice label={t("provaBuilder.target")} value={draft.target} min={1} max={100} step={1} presets={[5,10,15,20]} onChange={target=>update({target})}/>
                            <View style={b.wrap}>
                              <BuilderChoice
                                label={t("provaBuilder.untimed")}
                                selected={draft.minutes === null}
                                onPress={() => update({ minutes: null })}
                              />
                              <BuilderChoice
                                label={t("provaBuilder.timed")}
                                selected={draft.minutes !== null}
                                onPress={() => update({ minutes: 20 })}
                              />
                            </View>
                            {draft.minutes !== null
                              ? (
                                <NumberChoice label={t("provaBuilder.minutes")} value={draft.minutes} unit={t("prova.min")} onChange={minutes=>update({minutes})} />
                              )
                              : null}
                          </BuilderCard>
                          <BuilderCard title={t("provaBuilder.kind")}>
                            <View style={b.wrap}>
                              {(draft.purpose === "written"
                                ? ["open_ended"] as const
                                : ["mixed", "multiple_choice", "open_ended"] as const).map((v) => (
                                <BuilderChoice
                                  key={v}
                                  label={t(`provaBuilder.${v}`)}
                                  selected={provaGenerationKind(draft) === v}
                                  onPress={() => update({ kind: v })}
                                />
                              ))}
                            </View>
                            {draft.purpose === "written"
                              ? <Text style={b.muted}>{t("provaBuilder.writtenKindHelp")}</Text>
                              : null}
                            <Text style={b.bold}>
                              {t("provaBuilder.difficulty")}
                            </Text>
                            <View style={b.wrap}>
                              {(["kolay", "orta", "orta_ustu", "zor"] as const)
                                .map((v) => (
                                  <BuilderChoice
                                    key={v}
                                    label={t(`prova.difficulty.${v}`)}
                                    selected={draft.difficulty === v}
                                    onPress={() => update({ difficulty: v })}
                                  />
                                ))}
                            </View>
                            <Field
                              label={t("provaBuilder.note")}
                              value={draft.note}
                              onChangeText={(note) => update({ note })}
                              multiline
                              maxLength={1500}
                              hint={t("provaBuilder.noteHelp")}
                            />
                            <PromptExamples value={draft.note} onChange={note=>update({note})} examples={[t("guidedInput.prompt1"),t("guidedInput.prompt2"),t("guidedInput.prompt3")]}/>
                          </BuilderCard>
                        </>
                      )
                      : null}
                    {draft.step === 2
                      ? (
                        <BuilderCard>
                          <View style={b.row}>
                            <Text style={[b.h2, { flex: 1 }]}>
                              {t("provaBuilder.listTitle")}
                            </Text>
                            <SatinButton
                              secondary
                              title={t("provaBuilder.addQuestions")}
                              icon={<Plus color={p.purple} size={18} />}
                              onPress={() => void openSources()}
                            />
                          </View>
                          <Text style={b.muted}>
                            {material.isPending ? t("common.loading") : t("provaBuilder.count", {
                              count: flat.length,
                              target: draft.target,
                            })}
                          </Text>
                          {!draft.blocks.length
                            ? (
                              <View style={b.hint}>
                                <Text style={b.h2}>
                                  {t("provaBuilder.emptyQuestions")}
                                </Text>
                                <Text style={b.copy}>
                                  {t("provaBuilder.emptyQuestionsBody")}
                                </Text>
                              </View>
                            )
                            : null}
                          {draft.blocks.map((block, index) => {
                            const qs = questionsOf(block, mat),
                              group = mat.groups.find((g) => g.id === block.id);
                            return (
                              <View
                                key={block.id}
                                style={[
                                  b.block,
                                  block.kind === "group" &&
                                  {
                                    backgroundColor: "#F7F2FD",
                                    borderRadius: 20,
                                    padding: 16,
                                  },
                                ]}
                              >
                                <View style={b.row}>
                                  <View style={{ flex: 1, gap: 5 }}>
                                    <Text style={b.bold} numberOfLines={2}>
                                      {group?.title ?? qs[0]?.stem ??
                                        t(material.isPending ? "common.loading" : material.error ? "provaHub.loadError" : "provaBuilder.unavailable")}
                                    </Text>
                                    <Text style={b.muted}>
                                      {t(`provaBuilder.source_${block.source}`)}
                                      {group
                                        ? ` · ${
                                          t("sharedQuestions.common")
                                        } · ${qs.length}`
                                        : ""}
                                    </Text>
                                  </View>
                                  <IconButton
                                    label={t("provaBuilder.questionActions")}
                                    onPress={() =>
                                      setActions(
                                        actions === block.id ? null : block.id,
                                      )}
                                  >
                                    <Ellipsis size={22} color={p.purple} />
                                  </IconButton>
                                </View>
                                {actions === block.id
                                  ? (
                                    <View style={b.wrap}>
                                      <IconButton
                                        label={t("provaBuilder.up")}
                                        disabled={index === 0}
                                        onPress={() =>
                                          update({
                                            blocks: moveProvaBlock(
                                              draft.blocks,
                                              index,
                                              -1,
                                            ),
                                          })}
                                      >
                                        <ArrowUp size={18} color={p.purple} />
                                      </IconButton>
                                      <IconButton
                                        label={t("provaBuilder.down")}
                                        disabled={index ===
                                          draft.blocks.length - 1}
                                        onPress={() =>
                                          update({
                                            blocks: moveProvaBlock(
                                              draft.blocks,
                                              index,
                                              1,
                                            ),
                                          })}
                                      >
                                        <ArrowDown size={18} color={p.purple} />
                                      </IconButton>
                                      <IconButton
                                        label={t("provaBuilder.remove")}
                                        onPress={() =>
                                          update({
                                            blocks: draft.blocks.filter((v) =>
                                              v.id !== block.id
                                            ),
                                          })}
                                      >
                                        <Trash2 size={18} color={p.muted} />
                                      </IconButton>
                                    </View>
                                  )
                                  : null}
                                {group
                                  ? qs.map((q, i) => (
                                    <Text key={q.id} style={b.copy}>
                                      {i + 1}. {q.stem}
                                    </Text>
                                  ))
                                  : null}
                              </View>
                            );
                          })}
                          <Text style={b.muted}>
                            {t("provaBuilder.savedInLibrary")}
                          </Text>
                        </BuilderCard>
                      )
                      : null}
                    {draft.step === 3
                      ? (
                        <>
                          <BuilderCard>
                            <Field
                              label={t("provaBuilder.name")}
                              value={draft.title}
                              maxLength={160}
                              onChangeText={(title) => update({ title })}
                            />
                            <Text style={b.muted}>
                              {t("provaBuilder.count", {
                                count: flat.length,
                                target: draft.target,
                              })}
                            </Text>
                            {missing
                              ? (
                                <Text style={b.error}>
                                  {t("provaBuilder.unavailable")}
                                </Text>
                              )
                              : null}
                            {mismatch
                              ? (
                                <Text style={b.error}>
                                  {t("provaBuilder.scopeMismatch")}
                                </Text>
                              )
                              : null}
                            {noAnswer
                              ? (
                                <Text style={b.error}>
                                  {t("provaBuilder.missingAnswer")}
                                </Text>
                              )
                              : null}
                            {material.isSuccess && flat.length !== draft.target
                              ? (
                                <Text style={b.error}>
                                  {t("provaBuilder.missingCount")}
                                </Text>
                              )
                              : null}
                            <Toggle
                              label={t("provaBuilder.reviewCheck")}
                              value={checked}
                              onChange={setChecked}
                            />
                          </BuilderCard>
                          <BuilderCard title={t("provaBuilder.preview")}>
                            <View style={b.wrap}>
                              {flat.map((q, i) => (
                                <BuilderChoice
                                  key={q.id}
                                  label={String(i + 1)}
                                  selected={previewIndex === i}
                                  onPress={() => {
                                    setPreviewIndex(i);
                                    setAnswer(false);
                                  }}
                                />
                              ))}
                            </View>
                            {previewGroup
                              ? (
                                <View style={b.hint}>
                                  <Text style={b.bold}>
                                    {previewGroup.title}
                                  </Text>
                                  <Text style={b.copy}>
                                    {previewGroup.body}
                                  </Text>
                                </View>
                              )
                              : null}
                            {preview
                              ? (
                                <BuilderQuestionPreview
                                  key={preview.id}
                                  q={preview}
                                  showAnswer={answer}
                                />
                              )
                              : null}
                            <Toggle
                              label={t("provaBuilder.answerShow")}
                              value={answer}
                              onChange={setAnswer}
                            />
                          </BuilderCard>
                        </>
                      )
                      : null}
                  </View>
                  {wide ? <View style={b.sidebar}>{summary}</View> : null}
                </View>
                {!wide && draft.step === 3
                  ? <BuilderCard>{summary}</BuilderCard>
                  : null}
              </ScrollView>
              <View style={b.footer}>
                <SatinButton
                  secondary
                  busy={save.isPending}
                  disabled={submit.isPending || !!record?.submitted_at}
                  title={t(width < 360 ? "common.save" : "provaBuilder.save")}
                  onPress={() => void save.mutateAsync(draft).catch(() => {})}
                />
                <SatinButton
                  busy={submit.isPending}
                  disabled={locked || (draft.step === 3 && !publishValid) ||
                    draft.format === "meb"}
                  title={t(
                    draft.step === 3
                      ? (width < 360
                        ? "provaBuilder.sendShort"
                        : "provaBuilder.send")
                      : draft.step === 2
                      ? (width < 360
                        ? "provaBuilder.reviewShort"
                        : "provaBuilder.readyReview")
                      : "provaBuilder.continue",
                  )}
                  onPress={() => {
                    if (draft.step === 3) submit.mutate();
                    else void navigateStep(draft.step + 1);
                  }}
                />
              </View>
            </>
          )}
      </KeyboardAvoidingView>
      <ProvaSourcePicker
        visible={source}
        draft={draft}
        draftId={id}
        onClose={() => setSource(false)}
        onAdd={addBlocks}
      />
      <Modal
        visible={!!leave}
        transparent
        {...NOTEBOOK_MODAL_PROPS}
        onRequestClose={() => setLeave(null)}
      >
        <View style={b.overlay}>
          <View style={b.modal}>
            <Text style={b.h2}>{t("provaBuilder.leaveTitle")}</Text>
            <Text style={b.copy}>{t("provaBuilder.leaveBody")}</Text>
            {error
              ? <Text style={b.error}>{provaErrorMessage(error)}</Text>
              : null}
            <SatinButton
              busy={save.isPending}
              title={t("provaBuilder.saveLeave")}
              onPress={() =>
                void save.mutateAsync(draft).then(() => {
                  const go = leave;
                  setLeave(null);
                  go?.();
                }).catch(() => {})}
            />
            <SatinButton
              secondary
              title={t("provaBuilder.stay")}
              onPress={() => setLeave(null)}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || uncertain}
              onPress={() => {
                const go = leave;
                setLeave(null);
                go?.();
              }}
              style={b.choice}
            >
              <Text style={b.muted}>{t("provaBuilder.discard")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
