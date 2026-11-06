import * as Crypto from "expo-crypto";
import { Toggle } from "@/components/ui/toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import {
  type QuestionImageDraft,
  QuestionImageEditor,
} from "@/components/learning/question-image-editor";
import { addToProvaDraft, fetchProvaDrafts } from "@/lib/prova-draft";
import { uploadLearningFile } from "@/lib/learning-files";

import { type Enums, type Json, parseRubricInput } from "@gina/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import {
  ParentScreen as Screen,
  parentStyles,
} from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = Enums<"question_kind">;
type Difficulty = Enums<"question_difficulty">;
const DIFFICULTIES: Difficulty[] = ["kolay", "orta", "orta_ustu", "zor"];
const KEYS = ["A", "B", "C", "D"] as const;

/** Parent-owned question; optional contribution is a separate consented snapshot. */
export default function QuestionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<
    { draftId?: string; subject?: string; grade?: string }
  >();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  // D1: taslaktan açılan elle soru, taslağın dönem/programıyla soru düzeyinde işaretlenir.
  const draftPeriod = useQuery({
    queryKey: ["prova_draft_period", familyId, params.draftId],
    enabled: !!params.draftId,
    queryFn: async () => {
      const context = (await fetchProvaDrafts(params.draftId))[0]?.content.context;
      return { term: context?.term ?? null, program: context?.program ?? null };
    },
  });
  const period = draftPeriod.data ?? { term: null, program: null };
  const request = useRef<{ body: string; id: string; shareId: string } | null>(
    null,
  );
  const [images, setImages] = useState<QuestionImageDraft[]>([]);
  const [storageConsent, setStorageConsent] = useState(false);
  const [share, setShare] = useState(false);
  const [rights, setRights] = useState(false);
  const [noPersonal, setNoPersonal] = useState(false);
  const [subject, setSubject] = useState(params.subject ?? "");
  const [grade, setGrade] = useState(params.grade ?? "");
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState("");
  const [kind, setKind] = useState<Kind>("multiple_choice");
  const [difficulty, setDifficulty] = useState<Difficulty>("orta_ustu");
  const [stem, setStem] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({
    A: "",
    B: "",
    C: "",
    D: "",
  });
  const [correct, setCorrect] = useState<string>("");
  const [expected, setExpected] = useState("");
  const [solution, setSolution] = useState("");
  const [explanation, setExplanation] = useState("");
  // C04: açık uçluda kabul edilecek diğer doğru cevaplar + puanlama ölçütleri (isteğe bağlı).
  const [alternatives, setAlternatives] = useState("");
  const [rubricText, setRubricText] = useState("");
  const rubric = kind === "open_ended"
    ? parseRubricInput(alternatives, rubricText)
    : null;
  // P02: soru/görsel → yanıt/ölçüt → öğrenci önizleme. Doğru şık başlangıçta boş.
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [stepError, setStepError] = useState<string | null>(null);
  function stepProblem(target: 0 | 1 | 2): string | null {
    if (target >= 1) {
      if (
        !subject.trim() || !topic.trim() || !stem.trim() ||
        !Number.isInteger(Number(grade)) || Number(grade) < 1 ||
        Number(grade) > 12
      ) return t("prova.questionInvalid");
      if (images.some((image) => image.alt.trim().length < 3)) {
        return t("sources.altRequired");
      }
      if (images.length && !storageConsent) {
        return t("sources.consentRequired");
      }
    }
    if (target >= 2) {
      if (kind === "multiple_choice") {
        if (KEYS.some((k) => !choices[k]?.trim())) {
          return t("prova.choicesInvalid");
        }
        if (!KEYS.some((key) => key === correct)) {
          return t("provaP02.editor.correctMissing");
        }
      } else if (!expected.trim()) return t("provaP02.editor.expectedMissing");
      else if (!rubric) return t("provaC04.question.rubricInvalid");
    }
    return null;
  }
  function goStep(target: 0 | 1 | 2) {
    const problem = target > step ? stepProblem(target) : null;
    setStepError(problem);
    if (!problem) setStep(target);
  }

  const save = useMutation({
    mutationFn: async (andNew: boolean) => {
      if (
        !subject.trim() || !topic.trim() || !stem.trim() ||
        !Number.isInteger(Number(grade)) || Number(grade) < 1 ||
        Number(grade) > 12
      ) throw new Error(t("prova.questionInvalid"));
      if (kind === "multiple_choice" && (!KEYS.some(key => key === correct) || KEYS.some((k) => !choices[k]?.trim()))) {
        throw new Error(t("prova.choicesInvalid"));
      }
      if (images.some((image) => image.alt.trim().length < 3)) {
        throw new Error(t("sources.altRequired"));
      }
      if (images.length && !storageConsent) {
        throw new Error(t("sources.consentRequired"));
      }

      if (
        share &&
        (!solution.trim() || (kind === "open_ended" && !expected.trim()))
      ) throw new Error(t("library.answerRequired"));
      if (share && (!rights || !noPersonal)) {
        throw new Error(t("library.consentRequired"));
      }
      const tag = params.draftId
        ? draftPeriod.data ?? (await draftPeriod.refetch()).data ?? period
        : period;
      const body = {
        grade: Number(grade),
        subject: subject.trim(),
        topic: topic.trim(),
        scenario_code: scenario.trim() || null,
        kind,
        difficulty,
        stem: stem.trim(),
        choices: kind === "multiple_choice"
          ? KEYS.map((k) => ({ key: k, text: choices[k]?.trim() ?? "" }))
          : null,
        correct_key: kind === "multiple_choice" ? correct : null,
        expected_answer: kind === "open_ended" ? expected.trim() || null : null,
        solution: solution.trim() || null,
        explanation: explanation.trim() || null,
        ...(kind === "open_ended" && rubric &&
            (rubric.criteria.length || rubric.alternative_answers.length)
          ? { rubric: rubric as unknown as Json }
          : {}),
        ...(tag.term !== null ? { term: tag.term } : {}),
        ...(tag.program !== null ? { program: tag.program } : {}),
      };
      if (kind === "open_ended" && !rubric) {
        throw new Error(t("provaC04.question.rubricInvalid"));
      }
      const attachments = images.map((image) => ({
        source_id: image.file.id,
        alt: image.alt.trim(),
      }));
      const fingerprint = JSON.stringify({ body, attachments });
      if (!request.current || request.current.body !== fingerprint) {
        request.current = {
          body: fingerprint,
          id: Crypto.randomUUID(),
          shareId: Crypto.randomUUID(),
        };
      }
      for (const image of images) {
        await uploadLearningFile(image.file, "question_image");
      }
      const { error } = await supabase.rpc("save_question_with_sources", {
        p_request_id: request.current.id,
        p_question: body,
        p_images: attachments,
      });
      if (error) throw error;
      if (params.draftId) {
        await addToProvaDraft(params.draftId, [{
          kind: "question",
          id: request.current.id,
          source: "manual",
        }]);
      }
      return andNew;
    },
    onSuccess: (andNew) => {
      void queryClient.invalidateQueries({
        queryKey: ["question_bank_count", familyId],
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "question_bank",
            "question_bank_subjects",
            "booklet_library",
            "level_preview",
          ].includes(String(query.queryKey[0])),
      });
      if(share&&request.current){router.push({pathname:"/parent/prova/share",params:{questionId:request.current.id}});return;}
      if (andNew) {
        request.current = null;
        setImages([]);
        setStorageConsent(false);
        setShare(false);
        setRights(false);
        setNoPersonal(false);
        setStem("");
        setChoices({ A: "", B: "", C: "", D: "" });
        setCorrect("");
        setExpected("");
        setSolution("");
        setExplanation("");
        setAlternatives("");
        setRubricText("");
        setStep(0);
      } else {
        if (params.draftId) {
          router.replace({
            pathname: "/parent/prova/builder",
            params: { draftId: params.draftId },
          });
        } else if (router.canGoBack()) router.back();
        else router.replace("/parent/prova");
      }
    },
  });

  const chip = (active: boolean) =>
    `min-h-12 min-w-12 items-center justify-center rounded-full border px-4 py-2 ${
      active ? "bg-teal-dark border-teal-dark" : "bg-[#FFFFFF] border-[#D9D3E6]"
    }`;
  const chipText = (
    active: boolean,
  ) => (active ? "font-body-bold text-white" : "font-body text-ink");

  return (
    <Screen title={t("prova.newQuestion")} subtitle={t("unified.questionHelp")}>
      <View style={parentStyles.card}>
        <View
          style={{ gap: 20 }}
          pointerEvents={save.isPending ? "none" : "auto"}
          accessibilityElementsHidden={save.isPending}
        >
          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          >
            {([0, 1, 2] as const).map((n) => (
              <Pressable
                key={n}
                accessibilityRole="tab"
                accessibilityState={{ selected: step === n }} aria-selected={step === n}
                onPress={() => goStep(n)}
                className={chip(step === n)}
              >
                <Text className={chipText(step === n)}>
                  {`${n + 1}. ${t(`provaP02.editor.step${n}`)}`}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={parentStyles.muted}>
            {t(`provaP02.editor.step${step}Help`)}
          </Text>
          {step === 0 ? (<>
          <View className="flex-row gap-2">
            <View className="flex-[2]">
              <Field
                editable={!save.isPending}
                label={t("grades.subject")}
                value={subject}
                onChangeText={setSubject}
                placeholder={t("grades.subjectPlaceholder")}
              />
            </View>
            <View className="flex-1">
              <Field
                editable={!save.isPending}
                label={t("prova.grade")}
                keyboardType="number-pad"
                maxLength={2}
                value={grade}
                onChangeText={setGrade}
              />
            </View>
          </View>
          <Field
            editable={!save.isPending}
            label={t("prova.topic")}
            value={topic}
            onChangeText={setTopic}
            placeholder={t("provaV5.topicExample")}
          />
          {period.term !== null || period.program !== null
            ? (
              <Text style={parentStyles.muted}>
                {t("d1.question.periodTag", {
                  value: [
                    period.term !== null ? t("d1.period.termN", { n: period.term }) : null,
                    period.program,
                  ].filter(Boolean).join(" · "),
                })}
              </Text>
            )
            : null}
          <Field
            editable={!save.isPending}
            label={t("prova.scenario")}
            value={scenario}
            onChangeText={setScenario}
            placeholder={t("provaV5.scenarioExample")}
          />
          <View className="flex-row flex-wrap gap-2">
            {(["multiple_choice", "open_ended"] as Kind[]).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                onPress={() => setKind(k)}
                accessibilityState={{ selected: kind === k }} aria-pressed={kind === k}
                className={chip(kind === k)}
              >
                <Text className={chipText(kind === k)}>
                  {t(`prova.kind.${k}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                onPress={() => setDifficulty(d)}
                accessibilityState={{ selected: difficulty === d }} aria-pressed={difficulty === d}
                className={chip(difficulty === d)}
              >
                <Text className={chipText(difficulty === d)}>
                  {t(`prova.difficulty.${d}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            editable={!save.isPending}
            label={t("prova.stem")}
            value={stem}
            onChangeText={setStem}
            multiline
            className="min-h-24"
          />
          <QuestionImageEditor
            images={images}
            onChange={(next) => {
              setImages(next);
              setStorageConsent(false);
              if (next.length) {
                setShare(false);
              }
            }}
            disabled={save.isPending}
          />
          {images.length
            ? (
              <Toggle
                label={t("sources.storageConsent")}
                value={storageConsent}
                onChange={setStorageConsent}
                disabled={save.isPending}
              />
            )
            : null}
          </>) : null}
          {step === 1 ? (<>
          {kind === "multiple_choice"
            ? (
              <View className="gap-2">
                <Text className="font-body-bold text-base text-ink">{t("experience.chooseCorrect")}</Text>
                {KEYS.map((k) => (
                  <View key={k} className="flex-row items-center gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("provaV5.correctChoice", {
                        key: k,
                      })}
                      accessibilityState={{ selected: correct === k }} aria-pressed={correct === k}
                      onPress={() =>
                        setCorrect(k)}
                      className={`h-12 w-12 items-center justify-center rounded-full ${
                        correct === k ? "bg-teal-dark" : "bg-mist"
                      }`}
                    >
                      <Text
                        className={correct === k
                          ? "font-body-bold text-white"
                          : "font-body text-ink"}
                      >
                        {k}
                      </Text>
                    </Pressable>
                    <View className="flex-1">
                      <Field
                        editable={!save.isPending}
                        label={t("provaV5.choice", { key: k })}
                        value={choices[k] ?? ""}
                        onChangeText={(v) =>
                          setChoices((c) => ({ ...c, [k]: v }))}
                      />
                    </View>
                  </View>
                ))}
                <Text className="font-body text-xs text-gray-500">
                  {t("prova.correctHint")}
                </Text>
              </View>
            )
            : (
              <View className="gap-4">
                <Field
                  editable={!save.isPending}
                  label={t("prova.expected")}
                  value={expected}
                  onChangeText={setExpected}
                  multiline
                  className="min-h-20"
                />
                <Field
                  editable={!save.isPending}
                  label={t("provaC04.question.alternatives")}
                  hint={t("provaC04.question.alternativesHint")}
                  value={alternatives}
                  onChangeText={setAlternatives}
                  multiline
                  className="min-h-16"
                />
                <Field
                  editable={!save.isPending}
                  label={t("provaC04.question.rubric")}
                  hint={t("provaC04.question.rubricHint")}
                  error={rubric ? undefined : t("provaC04.question.rubricInvalid")}
                  value={rubricText}
                  onChangeText={setRubricText}
                  multiline
                  className="min-h-16"
                />
              </View>
            )}
          <Field
            editable={!save.isPending}
            label={t("prova.solution")}
            value={solution}
            onChangeText={setSolution}
            multiline
            className="min-h-20"
          />
          <Field
            editable={!save.isPending}
            label={t("prova.explanation")}
            value={explanation}
            onChangeText={setExplanation}
            multiline
            className="min-h-16"
          />
          </>) : null}
          {step === 2 ? (<>
          <View
            accessibilityLabel={t("provaP02.editor.previewTitle")}
            style={[parentStyles.card, { gap: 12 }]}
          >
            <Text style={parentStyles.muted}>
              {t("provaP02.editor.previewTitle")} · {subject} · {t("prova.grade")} {grade}
            </Text>
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18, lineHeight: 26, color: "#2A2346" }}>
              {stem}
            </Text>
            {images.length
              ? (
                <Text style={parentStyles.muted}>
                  {t("provaP02.editor.previewImages", { count: images.length })}
                </Text>
              )
              : null}
            {kind === "multiple_choice"
              ? KEYS.map((k) => (
                <View
                  key={k}
                  style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 48, borderWidth: 1, borderColor: "#D9D3E6", borderRadius: 16, paddingHorizontal: 12 }}
                >
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", color: "#5132BD" }}>{k}</Text>
                  <Text style={{ flex: 1, fontFamily: "Nunito_600SemiBold", color: "#2A2346" }}>{choices[k]}</Text>
                </View>
              ))
              : (
                <View style={{ minHeight: 96, borderWidth: 1, borderStyle: "dashed", borderColor: "#C7BED7", borderRadius: 16, padding: 12, justifyContent: "center" }}>
                  <Text style={parentStyles.muted}>{t("provaP02.editor.previewNotebook")}</Text>
                </View>
              )}
            <Text style={parentStyles.muted}>{t("provaP02.editor.previewHidden")}</Text>
          </View>
          <View style={parentStyles.card}>
            <Toggle
              label={t("library.share")}
              value={share}
              onChange={setShare}
              disabled={save.isPending}
            />
            {share
              ? (
                <>
                  <Text style={parentStyles.muted}>
                    {t("library.shareHelp")}
                  </Text>
                  <Toggle
                    label={t("library.rights")}
                    value={rights}
                    onChange={setRights}
                    disabled={save.isPending}
                  />
                  <Toggle
                    label={t("library.noPersonal")}
                    value={noPersonal}
                    onChange={setNoPersonal}
                    disabled={save.isPending}
                  />
                </>
              )
              : null}
          </View>
          </>) : null}
        </View>
        {stepError
          ? <Text accessibilityRole="alert" style={{ color: "#B3261E", fontFamily: "Nunito_700Bold" }}>{stepError}</Text>
          : null}
        <ErrorText error={save.error} />
        {step > 0
          ? (
            <Button
              variant="secondary"
              title={t("provaP02.editor.back")}
              disabled={save.isPending}
              onPress={() => goStep((step - 1) as 0 | 1)}
            />
          )
          : null}
        {step < 2
          ? (
            <Button
              title={t("provaP02.editor.next")}
              onPress={() => goStep((step + 1) as 1 | 2)}
            />
          )
          : (<>
        <Button
          title={t("prova.saveAndNew")}
          loading={save.isPending}
          onPress={() =>
            save.mutate(true)}
        />
        <Button
          variant="secondary"
          title={t("common.save")}
          disabled={save.isPending}
          onPress={() =>
            save.mutate(false)}
        />
          </>)}
        <Button
          variant="ghost"
          title={t("common.cancel")}
          disabled={save.isPending}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/parent/prova")}
        />
      </View>
    </Screen>
  );
}
