import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { Enums } from "@gina/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = Enums<"question_kind">;
type Difficulty = Enums<"question_difficulty">;
const DIFFICULTIES: Difficulty[] = ["kolay", "orta", "orta_ustu", "zor"];
const KEYS = ["A", "B", "C", "D"] as const;

/** Kütüphaneye elle soru ekleme (AI üretimi anahtar tanımlanınca ayrıca gelir). */
export default function QuestionScreen() {
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState("");
  const [kind, setKind] = useState<Kind>("multiple_choice");
  const [difficulty, setDifficulty] = useState<Difficulty>("orta_ustu");
  const [stem, setStem] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({ A: "", B: "", C: "", D: "" });
  const [correct, setCorrect] = useState<string>("A");
  const [expected, setExpected] = useState("");
  const [solution, setSolution] = useState("");
  const [explanation, setExplanation] = useState("");

  const save = useMutation({
    mutationFn: async (andNew: boolean) => {
      if (!subject.trim() || !topic.trim() || !stem.trim()) throw new Error(t("prova.questionInvalid"));
      if (kind === "multiple_choice" && KEYS.some((k) => !choices[k]?.trim())) throw new Error(t("prova.choicesInvalid"));
      const { error } = await supabase.from("question_bank").insert({
        family_id: familyId,
        grade: Number(grade) || 5,
        subject: subject.trim(),
        topic: topic.trim(),
        scenario_code: scenario.trim() || null,
        kind,
        difficulty,
        stem: stem.trim(),
        choices: kind === "multiple_choice" ? KEYS.map((k) => ({ key: k, text: choices[k]?.trim() ?? "" })) : null,
        correct_key: kind === "multiple_choice" ? correct : null,
        expected_answer: kind === "open_ended" ? expected.trim() || null : null,
        solution: solution.trim() || null,
        explanation: explanation.trim() || null,
        provenance: { generator: "parent", requested_by: session?.user.id ?? null },
        created_by: session?.user.id ?? null,
      });
      if (error) throw error;
      return andNew;
    },
    onSuccess: (andNew) => {
      void queryClient.invalidateQueries({ queryKey: ["question_bank_count", familyId] });
      if (andNew) {
        setStem("");
        setChoices({ A: "", B: "", C: "", D: "" });
        setExpected("");
        setSolution("");
        setExplanation("");
      } else {
        router.back();
      }
    },
  });

  const chip = (active: boolean) => `rounded-full px-3 py-2 ${active ? "bg-teal" : "bg-mist"}`;
  const chipText = (active: boolean) => (active ? "font-semibold text-white" : "text-ink");

  return (
    <Screen title={t("prova.newQuestion")}>
      <View className="flex-row gap-2">
        <View className="flex-[2]">
          <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} placeholder="Matematik" />
        </View>
        <View className="flex-1">
          <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
        </View>
      </View>
      <Field label={t("prova.topic")} value={topic} onChangeText={setTopic} placeholder="Kesirler" />
      <Field label={t("prova.scenario")} value={scenario} onChangeText={setScenario} placeholder="Senaryo 3" />
      <View className="flex-row flex-wrap gap-2">
        {(["multiple_choice", "open_ended"] as Kind[]).map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setKind(k)} className={chip(kind === k)}>
            <Text className={chipText(kind === k)}>{t(`prova.kind.${k}`)}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {DIFFICULTIES.map((d) => (
          <Pressable key={d} accessibilityRole="button" onPress={() => setDifficulty(d)} className={chip(difficulty === d)}>
            <Text className={chipText(difficulty === d)}>{t(`prova.difficulty.${d}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t("prova.stem")} value={stem} onChangeText={setStem} multiline className="min-h-24" />
      {kind === "multiple_choice" ? (
        <View className="gap-2">
          {KEYS.map((k) => (
            <View key={k} className="flex-row items-center gap-2">
              <Pressable accessibilityRole="button" onPress={() => setCorrect(k)} className={`h-10 w-10 items-center justify-center rounded-full ${correct === k ? "bg-green" : "bg-mist"}`}>
                <Text className={correct === k ? "font-body-bold text-white" : "text-ink"}>{k}</Text>
              </Pressable>
              <View className="flex-1">
                <Field label="" value={choices[k] ?? ""} onChangeText={(v) => setChoices((c) => ({ ...c, [k]: v }))} />
              </View>
            </View>
          ))}
          <Text className="font-body text-xs text-gray-500">{t("prova.correctHint")}</Text>
        </View>
      ) : (
        <Field label={t("prova.expected")} value={expected} onChangeText={setExpected} multiline className="min-h-20" />
      )}
      <Field label={t("prova.solution")} value={solution} onChangeText={setSolution} multiline className="min-h-20" />
      <Field label={t("prova.explanation")} value={explanation} onChangeText={setExplanation} multiline className="min-h-16" />
      <ErrorText error={save.error} />
      <Button title={t("prova.saveAndNew")} loading={save.isPending} onPress={() => save.mutate(true)} />
      <Button variant="secondary" title={t("common.save")} onPress={() => save.mutate(false)} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
