import * as Crypto from "expo-crypto";
import { Toggle } from "@/components/ui/toggle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import {
  type QuestionImageDraft,
  QuestionImageEditor,
} from "@/components/learning/question-image-editor";
import { addToProvaDraft } from "@/lib/prova-draft";
import { uploadLearningFile } from "@/lib/learning-files";

import type { Enums } from "@gina/core";

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
  const [correct, setCorrect] = useState<string>("A");
  const [expected, setExpected] = useState("");
  const [solution, setSolution] = useState("");
  const [explanation, setExplanation] = useState("");

  const save = useMutation({
    mutationFn: async (andNew: boolean) => {
      if (
        !subject.trim() || !topic.trim() || !stem.trim() ||
        !Number.isInteger(Number(grade)) || Number(grade) < 1 ||
        Number(grade) > 12
      ) throw new Error(t("prova.questionInvalid"));
      if (kind === "multiple_choice" && KEYS.some((k) => !choices[k]?.trim())) {
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
      };
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
        setExpected("");
        setSolution("");
        setExplanation("");
      } else {
        if (params.draftId) {
          router.replace({
            pathname: "/parent/prova/builder",
            params: { draftId: params.draftId },
          });
        } else router.back();
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
                accessibilityState={{ selected: kind === k }}
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
                accessibilityState={{ selected: difficulty === d }}
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
          {kind === "multiple_choice"
            ? (
              <View className="gap-2">
                {KEYS.map((k) => (
                  <View key={k} className="flex-row items-center gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("provaV5.correctChoice", {
                        key: k,
                      })}
                      accessibilityState={{ selected: correct === k }}
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
              <Field
                editable={!save.isPending}
                label={t("prova.expected")}
                value={expected}
                onChangeText={setExpected}
                multiline
                className="min-h-20"
              />
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
        </View>
        <ErrorText error={save.error} />
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
        <Button
          variant="ghost"
          title={t("common.cancel")}
          disabled={save.isPending}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
