import { type ComponentRef, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router, usePreventRemove } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
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
import { useTranslation } from "react-i18next";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import {
  type QuestionImageDraft,
  QuestionImageEditor,
} from "./question-image-editor";
import { QuestionMedia, type QuestionMediaItem } from "./question-media";
import { uploadLearningFile } from "@/lib/learning-files";
import { addToProvaDraft } from "@/lib/prova-draft";
import { supabase } from "@/lib/supabase";

export interface SharedQuestionDraft {
  topic: string;
  kind: "open_ended" | "multiple_choice";
  difficulty: "kolay" | "orta" | "orta_ustu" | "zor";
  stem: string;
  expected_answer: string;
  solution: string;
  choices: { key: string; text: string }[];
  correct_key: string;
}
export interface SharedGroupDraft {
  title: string;
  body: string;
  grade: string;
  subject: string;
  questions: SharedQuestionDraft[];
  existingImages: QuestionMediaItem[];
  previousId?: string;
}
const blankQuestion = (): SharedQuestionDraft => ({
  topic: "",
  kind: "open_ended",
  difficulty: "orta",
  stem: "",
  expected_answer: "",
  solution: "",
  choices: ["A", "B", "C", "D"].map((key) => ({ key, text: "" })),
  correct_key: "A",
});
const blankGroup = (): SharedGroupDraft => ({
  title: "",
  body: "",
  grade: "5",
  subject: "",
  questions: [blankQuestion(), blankQuestion()],
  existingImages: [],
});

export function SharedQuestionWizard(
  { initial, enabled, familyId, catalog, draftId, scope }: {
    draftId?: string;
    scope?: { grade: string; subject: string };
    initial?: SharedGroupDraft;
    enabled: boolean;
    familyId: string;
    catalog?: { id: string; title: string; version: number }[];
  },
) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 900 && height >= 540 && fontScale < 1.4;
  const [draft, setDraft] = useState<SharedGroupDraft>(() =>
    initial ?? { ...blankGroup(), ...scope }
  );
  const [step, setStep] = useState(0),
    [active, setActive] = useState(0),
    [expanded, setExpanded] = useState(false),
    [details, setDetails] = useState(false);
  const [images, setImages] = useState<QuestionImageDraft[]>([]),
    [consent, setConsent] = useState(false);
  const [dirty, setDirty] = useState(false),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const [validation, setValidation] = useState<string | null>(null),
    [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState<{ id: string; version: number } | null>(
    null,
  );
  const request = useRef<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const save = useMutation({
    mutationFn: async () => {
      request.current ??= randomUUID();
      for (const image of images) {
        await uploadLearningFile(image.file, "question_image");
      }
      const { data, error } = await supabase.rpc("save_question_source_group", {
        p_request_id: request.current,
        p_group: {
          title: draft.title.trim(),
          body: draft.body.trim(),
          subject: draft.subject.trim(),
          grade: Number(draft.grade),
        },
        p_questions: draft.questions.map((q) => ({
          ...q,
          topic: q.topic.trim() || draft.title.trim(),
          stem: q.stem.trim(),
          expected_answer: q.kind === "open_ended"
            ? q.expected_answer.trim()
            : null,
          choices: q.kind === "multiple_choice"
            ? q.choices.map((c) => ({ ...c, text: c.text.trim() }))
            : null,
          correct_key: q.kind === "multiple_choice" ? q.correct_key : null,
        })),
        p_images: [
          ...draft.existingImages.map((m) => ({
            source_id: m.source_id,
            alt: m.alt,
          })),
          ...images.map((m) => ({ source_id: m.file.id, alt: m.alt.trim() })),
        ],
        ...(draft.previousId ? { p_previous_id: draft.previousId } : {}),
      }).abortSignal(AbortSignal.timeout(20_000));
      if (error) throw error;
      return data as unknown as { id: string; version: number };
    },
    onSuccess: (data) => {
      setSaved(data);
      setDirty(false);
      setUncertain(false);
      void cache.invalidateQueries({
        predicate: (q) =>
          [
            "question_source_groups",
            "question_bank_count",
            "question_bank",
            "question_bank_subjects",
            "booklet_library",
          ].includes(String(q.queryKey[0])),
      });
    },
    onError: (error) => {
      // A database rejection rolls the transaction back. An unknown transport
      // outcome keeps the exact payload locked and retries the same receipt.
      const code = (error as { code?: string }).code;
      const rolledBack = !!code && /^(P0001|42501|22\w+|23\w+)$/.test(code);
      setUncertain(!rolledBack);
      if (rolledBack) request.current = null;
    },
  });
  const attach = useMutation({
    mutationFn: async (groupId: string) => {
      if (draftId) {
        await addToProvaDraft(draftId, [{
          kind: "group",
          id: groupId,
          source: "manual",
        }]);
      }
      return groupId;
    },
    onSuccess: (groupId) => {
      if (draftId) {
        router.replace({
          pathname: "/parent/prova/builder",
          params: { draftId },
        });
      } else {router.replace({
          pathname: "/parent/prova/exam",
          params: { groupId },
        });}
    },
    onError: (e) =>
      setValidation(
        e instanceof Error ? e.message : t("sharedQuestions.saveFailed"),
      ),
  });
  const locked = save.isPending || attach.isPending || uncertain || !!saved;
  const reusable = step === 2 && !dirty && !!draft.previousId;
  usePreventRemove(
    (dirty || save.isPending || uncertain) && !saved,
    ({ repeat }) => {
      if (uncertain) setValidation(t("sharedQuestions.uncertain"));
      else if (!save.isPending) setLeave(() => repeat);
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
  function update(value: Partial<SharedGroupDraft>) {
    setDraft((d) => ({ ...d, ...value }));
    setDirty(true);
    setValidation(null);
    save.reset();
  }
  function question(value: Partial<SharedQuestionDraft>) {
    update({
      questions: draft.questions.map((q, i) =>
        i === active ? { ...q, ...value } : q
      ),
    });
  }
  function move(next: number) {
    setValidation(null);
    setStep(next);
    if (next === 2) setExpanded(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function next() {
    if (step === 0) {
      if (
        !draft.title.trim() || !draft.subject.trim() ||
        !Number.isInteger(Number(draft.grade)) || Number(draft.grade) < 1 ||
        Number(draft.grade) > 12 ||
        (draft.body.trim().length < 20 && !images.length &&
          !draft.existingImages.length)
      ) return setValidation(t("sharedQuestions.sourceRequired"));
      if (
        images.length + draft.existingImages.length > 3 || images.some((m) =>
          m.alt.trim().length < 3
        ) || (images.length > 0 && !consent)
      ) return setValidation(t("sources.consentRequired"));
      move(1);
    } else if (step === 1) {
      const invalid = draft.questions.findIndex((q) =>
        q.stem.trim().length < 5 || !q.solution.trim() ||
        (q.kind === "open_ended"
          ? !q.expected_answer.trim()
          : q.choices.some((c) => !c.text.trim()))
      );
      if (invalid >= 0) {
        setActive(invalid);
        return setValidation(
          t("sharedQuestions.questionRequired", { n: invalid + 1 }),
        );
      }
      move(2);
    } else save.mutate();
  }
  const q = draft.questions[active]!;
  const common = (
    <View style={s.sourceCard}>
      <Text style={s.sourceTitle}>
        {draft.title || t("sharedQuestions.sourceTitle")}
      </Text>
      {draft.existingImages.length
        ? (
          <QuestionMedia
            questionId={draft.existingImages[0]!.question_id}
            items={draft.existingImages}
            notebook
          />
        )
        : null}
      {images.map((m) => (
        <Image
          key={m.file.id}
          source={{ uri: m.file.uri }}
          accessibilityLabel={m.alt}
          style={{ width: "100%", height: 190, resizeMode: "contain" }}
        />
      ))}
      {draft.body ? <Text selectable style={s.copy}>{draft.body}</Text> : null}
      <View style={[s.row, s.sourceUsage]}>
        <Layers size={20} color={p.purple} />
        <Text style={[s.small, { color: p.ink, flexShrink: 1 }]}>
          {t("sharedQuestions.usedIn", { count: draft.questions.length })}
        </Text>
      </View>
    </View>
  );
  const editor = (
    <View style={{ gap: 16 }}>
      {wide
        ? (
          <View style={s.row}>
            <Text style={[s.heading, { flex: 1 }]}>
              {t("sharedQuestions.questions")}
            </Text>
            <Text style={s.tag}>
              {t("prova.questionCount", { count: draft.questions.length })}
            </Text>
          </View>
        )
        : null}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {draft.questions.map((_, i) => (
          <Pressable
            key={i}
            accessibilityRole="tab"
            accessibilityLabel={t("sharedQuestions.questionN", { n: i + 1 })}
            accessibilityState={{ selected: active === i }}
            onPress={() => {
              setActive(i);
              setDetails(false);
            }}
            style={[s.number, active === i && { backgroundColor: p.purple }]}
          >
            <Text style={[s.bold, { color: active === i ? "#fff" : p.ink }]}>
              {i + 1}
            </Text>
          </Pressable>
        ))}
        {draft.questions.length < 12 && !locked
          ? (
            <IconButton
              label={t("sharedQuestions.addQuestion")}
              onPress={() => {
                update({ questions: [...draft.questions, blankQuestion()] });
                setActive(draft.questions.length);
              }}
            >
              <Plus color={p.purple} size={22} />
            </IconButton>
          )
          : null}
      </View>
      <View style={s.editorCard}>
        <View style={s.row}>
          <Text style={[s.bold, { flex: 1, fontSize: 20 }]}>
            {t("sharedQuestions.questionN", { n: active + 1 })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("sharedQuestions.changeType")}
            disabled={locked}
            onPress={() =>
              question({
                kind: q.kind === "open_ended"
                  ? "multiple_choice"
                  : "open_ended",
              })}
            style={s.pill}
          >
            <Text style={s.small}>{t(`prova.kind.${q.kind}`)}</Text>
            <ChevronDown color={p.purple} size={18} />
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel={t("prova.stem")}
          value={q.stem}
          editable={!locked}
          onChangeText={(stem) => question({ stem })}
          maxLength={3500}
          multiline
          style={[s.input, s.textarea]}
        />
        {q.kind === "open_ended"
          ? (
            <Field
              label={t("prova.expected")}
              value={q.expected_answer}
              editable={!locked}
              maxLength={10000}
              onChangeText={(expected_answer) => question({ expected_answer })}
              multiline
              style={{ height: 58 }}
            />
          )
          : (
            <View style={{ gap: 10 }}>
              <Text style={s.small}>{t("prova.correctHint")}</Text>
              {q.choices.map((c, i) => (
                <View key={c.key} style={s.row}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={t("provaV5.correctChoice", {
                      key: c.key,
                    })}
                    accessibilityState={{ checked: q.correct_key === c.key }}
                    disabled={locked}
                    onPress={() => question({ correct_key: c.key })}
                    style={[
                      s.number,
                      q.correct_key === c.key && { backgroundColor: p.mint },
                    ]}
                  >
                    <Text style={s.bold}>{c.key}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t("provaV5.choice", { key: c.key })}
                      editable={!locked}
                      value={c.text}
                      maxLength={5000}
                      onChangeText={(text) =>
                        question({
                          choices: q.choices.map((entry, at) =>
                            at === i ? { ...entry, text } : entry
                          ),
                        })}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        <Field
          label={t("sharedQuestions.solution")}
          value={q.solution}
          editable={!locked}
          onChangeText={(solution) => question({ solution })}
          multiline
          maxLength={10000}
          style={{ height: 64 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: details }}
          onPress={() => setDetails(!details)}
          style={s.link}
        >
          <Text style={s.small}>{t("sharedQuestions.details")}</Text>
          {details
            ? <ChevronUp size={18} color={p.purple} />
            : <ChevronDown size={18} color={p.purple} />}
        </Pressable>
        {details
          ? (
            <>
              <Field
                label={t("prova.topic")}
                value={q.topic}
                placeholder={draft.title}
                editable={!locked}
                maxLength={200}
                onChangeText={(topic) => question({ topic })}
              />
              <View style={[s.row, { flexWrap: "wrap" }]}>
                {(["kolay", "orta", "orta_ustu", "zor"] as const).map((d) => (
                  <Pressable
                    key={d}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: q.difficulty === d }}
                    disabled={locked}
                    onPress={() => question({ difficulty: d })}
                    style={[
                      s.pill,
                      q.difficulty === d && { backgroundColor: p.mint },
                    ]}
                  >
                    <Text style={s.small}>{t(`prova.difficulty.${d}`)}</Text>
                  </Pressable>
                ))}
              </View>
              {draft.questions.length > 2
                ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={locked}
                    onPress={() => {
                      update({
                        questions: draft.questions.filter((_, i) =>
                          i !== active
                        ),
                      });
                      setActive(Math.max(0, active - 1));
                    }}
                    style={s.link}
                  >
                    <Trash2 color="#A43135" size={20} />
                    <Text style={[s.small, { color: "#A43135" }]}>
                      {t("sharedQuestions.removeQuestion")}
                    </Text>
                  </Pressable>
                )
                : null}
            </>
          )
          : null}
      </View>
    </View>
  );
  const errorCode = (save.error as { message?: string } | null)?.message;
  const translatedError = errorCode &&
    t(`sharedQuestions.errors.${errorCode}`, {
      defaultValue: t("sharedQuestions.saveFailed"),
    });
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[s.header, { paddingHorizontal: wide ? 30 : 16 }]}>
          <IconButton
            label={t("common.back")}
            disabled={save.isPending}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/parent/prova")}
          >
            <ArrowLeft size={24} color={p.ink} />
          </IconButton>
          <Image
            source={require(
              "../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            accessibilityLabel={t("app.name")}
            style={{ width: 110, height: 42, resizeMode: "contain" }}
          />
          {wide
            ? (
              <Text style={[s.heading, { marginLeft: 20, flex: 1 }]}>
                {t("sharedQuestions.title")}
              </Text>
            )
            : null}
        </View>
        {!wide
          ? (
            <Text style={[s.heading, { marginHorizontal: 20, fontSize: 25 }]}>
              {t(
                step === 0
                  ? "sharedQuestions.title"
                  : step === 1
                  ? "sharedQuestions.questions"
                  : "sharedQuestions.preview",
              )}
            </Text>
          )
          : null}
        <View style={[s.steps, { gap: wide ? 24 : 8 }]}>
          {["common", "questions", "preview"].map((key, i) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{
                selected: step === i,
                disabled: i > step || locked,
              }}
              disabled={i > step || locked}
              onPress={() => move(i)}
              style={[s.step, step === i && { backgroundColor: p.purple }, { paddingHorizontal: wide ? 16 : 8, gap: wide ? 8 : 4 }]}
            >
              <View style={{ width: wide ? 28 : 20, height: wide ? 28 : 20, borderRadius: 14, backgroundColor: step === i ? "#FFFFFF22" : "#FFFFFF80", borderWidth: 1, borderColor: "#D9CCF3", alignItems: "center", justifyContent: "center" }}>
                <Text style={[s.small, { color: step === i ? "#FFFFFF" : p.ink, fontSize: wide ? 17 : 13 }]}>{i + 1}</Text>
              </View>
              <Text
                style={[s.small, {
                  color: step === i ? "#fff" : p.ink,
                  fontSize: wide ? 16 : 13,
                }]}
              >
                {t(`sharedQuestions.${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={[
            s.workspace,
            wide && { flexDirection: "row", paddingHorizontal: 28 },
          ]}
        >
          {wide && step > 0
            ? (
              <ScrollView
                style={s.left}
                contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1 }}
              >
                <View style={s.row}>
                  <Text style={[s.heading, { flex: 1 }]}>
                    {t("sharedQuestions.common")}
                  </Text>
                  <IconButton
                    label={t("sharedQuestions.editSource")}
                    disabled={locked}
                    onPress={() => move(0)}
                  >
                    <Pencil color={p.purple} size={22} />
                  </IconButton>
                </View>
                {common}
                <View style={{ flex: 1 }} />
                <View style={s.row}>
                  <Image
                    source={require(
                      "../../../../../packages/assets/brand/growing-friend/reading.png",
                    )}
                    style={{ width: 150, height: 130, resizeMode: "contain" }}
                    accessible={false}
                  />
                  <Text style={[s.copy, s.bubble]}>
                    {t("sharedQuestions.hint")}
                  </Text>
                </View>
              </ScrollView>
            )
            : null}
          <View
            style={[
              s.right,
              step === 0 &&
              { maxWidth: 760, alignSelf: "center", width: "100%" },
            ]}
          >
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: wide ? 22 : 16,
                gap: 18,
                paddingBottom: 24,
              }}
            >
              {!enabled
                ? (
                  <Text style={s.notice}>
                    {t("sharedQuestions.unavailable")}
                  </Text>
                )
                : null}
              {step === 0
                ? (
                  <>
                    <Text style={s.copy}>{t("sharedQuestions.intro")}</Text>
                    <View style={s.row}>
                      <View style={{ flex: 3 }}>
                        <Field
                          label={t("grades.subject")}
                          value={draft.subject}
                          onChangeText={(subject) => update({ subject })}
                          editable={!locked}
                          maxLength={80}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label={t("prova.grade")}
                          value={draft.grade}
                          onChangeText={(grade) => update({ grade })}
                          editable={!locked}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      </View>
                    </View>
                    <Field
                      label={t("sharedQuestions.sourceTitle")}
                      value={draft.title}
                      onChangeText={(title) => update({ title })}
                      editable={!locked}
                      maxLength={160}
                    />
                    <Field
                      label={t("sharedQuestions.sourceBody")}
                      value={draft.body}
                      onChangeText={(body) => update({ body })}
                      editable={!locked}
                      multiline
                      style={{ minHeight: 160, textAlignVertical: "top" }}
                      maxLength={6000}
                      hint={t("sharedQuestions.sourceHint")}
                    />
                    {draft.existingImages.map((m) => (
                      <View key={m.source_id}>
                        <QuestionMedia questionId={m.question_id} items={[m]} />
                        <SatinButton
                          secondary
                          title={t("sources.remove")}
                          disabled={locked}
                          onPress={() =>
                            update({
                              existingImages: draft.existingImages.filter(
                                (item) => item.source_id !== m.source_id,
                              ),
                            })}
                        />
                      </View>
                    ))}
                    <QuestionImageEditor
                      images={images}
                      onChange={(nextImages) => {
                        if (
                          nextImages.length + draft.existingImages.length <= 3
                        ) {
                          setImages(nextImages);
                          setConsent(false);
                          setDirty(true);
                        } else setValidation(t("sharedQuestions.imageLimit"));
                      }}
                      disabled={locked}
                      maxImages={3 - draft.existingImages.length}
                    />
                    {images.length
                      ? (
                        <Toggle
                          label={t("sources.storageConsent")}
                          value={consent}
                          onChange={setConsent}
                          disabled={locked}
                        />
                      )
                      : null}
                    {!dirty && !initial && catalog?.length
                      ? (
                        <View style={{ gap: 8 }}>
                          <Text style={s.bold}>
                            {t("sharedQuestions.existing")}
                          </Text>
                          {catalog.map((g) => (
                            <Pressable
                              key={g.id}
                              style={s.catalogRow}
                              accessibilityRole="button"
                              onPress={() =>
                                router.replace({
                                  pathname: "/parent/prova/shared-source",
                                  params: {
                                    groupId: g.id,
                                    ...(draftId ? { draftId } : {}),
                                    ...scope,
                                  },
                                })}
                            >
                              <Text style={[s.copy, { flex: 1 }]}>
                                {g.title}
                              </Text>
                              <Text style={s.small}>
                                {t("sharedQuestions.version", { n: g.version })}
                              </Text>
                              <Pencil size={20} color={p.purple} />
                            </Pressable>
                          ))}
                        </View>
                      )
                      : null}
                  </>
                )
                : (
                  <>
                    {!wide
                      ? (
                        <View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}
                            onPress={() => setExpanded(!expanded)}
                            style={s.collapsed}
                          >
                            {draft.existingImages.length
                              ? (
                                <View style={{ width: 48 }}>
                                  <QuestionMedia
                                    questionId={draft.existingImages[0]!
                                      .question_id}
                                    items={draft.existingImages}
                                    compact
                                  />
                                </View>
                              )
                              : images[0]
                              ? (
                                <Image
                                  source={{ uri: images[0].file.uri }}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    resizeMode: "contain",
                                  }}
                                />
                              )
                              : null}
                            <Text style={[s.bold, { flex: 1 }]}>
                              {draft.title} · {t("prova.questionCount", {
                                count: draft.questions.length,
                              })}
                            </Text>
                            {expanded
                              ? <ChevronUp size={20} color={p.purple} />
                              : <ChevronDown size={20} color={p.purple} />}
                          </Pressable>
                          {expanded ? common : null}
                        </View>
                      )
                      : null}
                    {step === 1 ? editor : (
                      <View style={{ gap: 18 }}>
                        <View style={s.row}>
                          {saved ? <Check color="#24735D" size={24} /> : null}
                          <Text style={s.heading}>
                            {t(
                              saved
                                ? "sharedQuestions.saved"
                                : "sharedQuestions.childPreview",
                            )}
                          </Text>
                        </View>
                        <Text style={s.copy}>
                          {t("sharedQuestions.previewHelp")}
                        </Text>
                        {draft.questions.map((item, i) => (
                          <View key={i} style={s.editorCard}>
                            <Text style={s.small}>
                              {t("sharedQuestions.questionN", { n: i + 1 })}
                            </Text>
                            <Text selectable style={s.bold}>{item.stem}</Text>
                            {item.kind === "multiple_choice"
                              ? item.choices.map((c) => (
                                <Text key={c.key} style={s.copy}>
                                  {c.key}) {c.text}
                                </Text>
                              ))
                              : (
                                <View style={s.answerLines}>
                                  <View style={s.line} />
                                  <View style={s.line} />
                                  <View style={s.line} />
                                </View>
                              )}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
            </ScrollView>
            <View style={{ paddingHorizontal: 16 }}>
              {validation || translatedError
                ? (
                  <Text accessibilityRole="alert" style={s.error}>
                    {validation ?? translatedError}
                  </Text>
                )
                : null}
              {uncertain
                ? <Text style={s.notice}>{t("sharedQuestions.uncertain")}</Text>
                : null}
            </View>
            <View style={[s.footer, !wide && { flexWrap: "wrap" }]}>
              {wide
                ? (
                  <Text style={[s.small, { flex: 1, fontSize: 13 }]}>
                    {t("sharedQuestions.versionHint")}
                  </Text>
                )
                : null}
              {step > 0 && !locked
                ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => move(step - 1)}
                    style={s.link}
                  >
                    <Text style={s.small}>{t("common.back")}</Text>
                  </Pressable>
                )
                : null}
              <SatinButton
                style={{
                  flexGrow: wide ? 0 : 1,
                  borderRadius: 28,
                  minWidth: wide ? 170 : 160,
                }}
                title={t(
                  saved || reusable
                    ? "sharedQuestions.useExam"
                    : uncertain
                    ? "common.retry"
                    : step === 0
                    ? "sharedQuestions.continue"
                    : step === 1
                    ? "sharedQuestions.previewAction"
                    : "sharedQuestions.save",
                )}
                busy={save.isPending}
                disabled={attach.isPending || (step === 2 && !enabled)}
                icon={<ArrowRight color="#fff" size={20} />}
                onPress={() =>
                  saved || reusable
                    ? attach.mutate(saved?.id ?? draft.previousId!)
                    : next()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={!!leave}
        transparent
        animationType="none"
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => setLeave(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#20195180",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={[s.editorCard, {
              backgroundColor: p.cream,
              maxWidth: 440,
              width: "100%",
            }]}
          >
            <Text style={s.copy}>{t("sharedQuestions.leave")}</Text>
            <SatinButton
              title={t("provaV5.keepWorking")}
              onPress={() => setLeave(null)}
            />
            <SatinButton
              secondary
              title={t("provaV5.discard")}
              onPress={() => {
                setDirty(false);
                leave?.();
                setLeave(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 72,
  },
  heading: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 26,
    color: p.ink,
    lineHeight: 34,
  },
  bold: {
    fontFamily: "Nunito_700Bold",
    fontSize: 18,
    color: p.ink,
    lineHeight: 25,
  },
  copy: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 17,
    color: p.ink,
    lineHeight: 26,
  },
  small: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: p.purple },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: p.lilac,
    flexShrink: 1,
  },
  workspace: { flex: 1, gap: 16, paddingBottom: 8 },
  left: {
    width: "38%",
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "#E2DCE7",
    borderRadius: 24,
  },
  right: {
    flex: 1,
    minWidth: 0,
    borderRadius: 24,
    borderColor: p.line,
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  sourceCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: "#DCD0F4",
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFCF8",
  },
  sourceTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 25,
    color: p.ink,
    backgroundColor: p.lilac,
    marginHorizontal: -18,
    marginTop: -18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  sourceUsage: { backgroundColor: p.lilac, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  tag: {
    fontFamily: "Nunito_600SemiBold",
    color: p.ink,
    backgroundColor: p.lilac,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    overflow: "hidden",
  },
  number: {
    minWidth: 48,
    minHeight: 48,
    padding: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.lilac,
  },
  editorCard: {
    backgroundColor: "#FFFFFFA0",
    borderColor: p.line,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  pill: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: p.lilac,
  },
  input: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 17,
    lineHeight: 24,
    color: p.ink,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8CDF1",
    borderRadius: 16,
    padding: 14,
  },
  textarea: { minHeight: 84, textAlignVertical: "top" },
  link: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: p.line,
    backgroundColor: p.cream,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bubble: {
    flex: 1,
    backgroundColor: p.mint,
    padding: 14,
    borderRadius: 20,
    fontSize: 16,
  },
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: p.lilac,
    padding: 16,
    minHeight: 64,
    borderRadius: 20,
  },
  error: { color: "#A43135", fontFamily: "Nunito_700Bold", fontSize: 16 },
  notice: {
    color: p.muted,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
    backgroundColor: p.lilac,
    borderRadius: 14,
  },
  catalogRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: p.line,
  },
  answerLines: { gap: 22, paddingVertical: 12 },
  line: { height: 1, backgroundColor: "#DCD6DE" },
});
