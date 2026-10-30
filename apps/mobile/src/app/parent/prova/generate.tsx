import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { Enums } from "@gina/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { invokeProvaAi, type GenerateResponse, type GeneratedQuestion } from "@/lib/prova-ai";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Difficulty = Enums<"question_difficulty">;
type KindMode = "mixed" | "multiple_choice" | "open_ended";
const DIFFICULTIES: Difficulty[] = ["kolay", "orta", "orta_ustu", "zor"];
const KIND_MODES: KindMode[] = ["mixed", "multiple_choice", "open_ended"];

interface ProvaEntitlement {
  plan: "free" | "plus" | "pro";
  scenarios: boolean;
  ai_generate_limit: number;
  ai_generate_used: number;
}

/** AI ile soru üretimi (veli): ders/sınıf/konu ya da senaryo → prova-generate → kütüphaneye kaydedilen sorular. */
export default function GenerateQuestionsScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [topic, setTopic] = useState("");
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [count, setCount] = useState("5");
  const [kind, setKind] = useState<KindMode>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("orta_ustu");
  const [result, setResult] = useState<GeneratedQuestion[] | null>(null);

  const entitlement = useQuery({
    queryKey: ["prova_entitlement", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_prova_entitlement");
      if (error) throw error;
      return data as unknown as ProvaEntitlement;
    },
  });

  const blueprints = useQuery({
    queryKey: ["blueprints", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_blueprints").select("id, name, subject, grade, rows").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const bp = blueprints.data?.find((b) => b.id === blueprintId);
      if (!bp && (!subject.trim() || !topic.trim())) throw new Error(t("prova.ai.formInvalid"));
      return invokeProvaAi<GenerateResponse>("prova-generate", {
        subject: bp ? bp.subject : subject.trim(),
        grade: bp ? bp.grade : Number(grade) || 5,
        topic: bp ? undefined : topic.trim(),
        blueprint_id: bp?.id ?? null,
        count: Number(count) || 5,
        kind,
        difficulty,
        locale: i18n.language.startsWith("en") ? "en" : "tr",
      });
    },
    onSuccess: (data) => {
      setResult(data.questions);
      void queryClient.invalidateQueries({ queryKey: ["question_bank_count", familyId] });
      void queryClient.invalidateQueries({ queryKey: ["prova_entitlement", familyId] });
    },
  });

  const ent = entitlement.data;
  const remaining = ent ? Math.max(0, ent.ai_generate_limit - ent.ai_generate_used) : null;
  const chip = (active: boolean) => `rounded-full px-3 py-2 ${active ? "bg-teal" : "bg-mist"}`;
  const chipText = (active: boolean) => (active ? "font-semibold text-white" : "text-ink");

  if (result) {
    return (
      <Screen title={t("prova.ai.generatedTitle")}>
        <Text className="font-body text-base text-gray-600">{t("prova.ai.generatedCount", { count: result.length })}</Text>
        {result.map((q, i) => (
          <QuestionCard key={q.id} index={i + 1} question={q} />
        ))}
        <Button title={t("prova.ai.generateMore")} onPress={() => setResult(null)} />
        <Button variant="secondary" title={t("prova.newExam")} onPress={() => router.replace("/parent/prova/exam")} />
        <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title={t("prova.ai.generateTitle")}>
      <Text className="font-body text-base text-gray-600">{t("prova.ai.generateIntro")}</Text>
      {ent && ent.ai_generate_limit <= 0 ? (
        <View className="rounded-parent bg-coral-light p-3">
          <Text className="font-body text-base text-ink">{t("prova.ai.needsPlus")}</Text>
        </View>
      ) : remaining !== null ? (
        <Text className="font-body text-sm text-teal-dark">{t("prova.ai.quotaLeft", { count: remaining })}</Text>
      ) : null}

      {ent?.scenarios && blueprints.data?.length ? (
        <View className="gap-2">
          <Text className="text-sm font-body text-ink dark:text-night-text">{t("prova.fromBlueprint")}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable accessibilityRole="button" onPress={() => setBlueprintId(null)} className={chip(blueprintId === null)}>
              <Text className={chipText(blueprintId === null)}>{t("prova.noBlueprint")}</Text>
            </Pressable>
            {blueprints.data.map((bp) => (
              <Pressable key={bp.id} accessibilityRole="button" onPress={() => setBlueprintId(bp.id)} className={chip(blueprintId === bp.id)}>
                <Text className={chipText(blueprintId === bp.id)}>
                  {bp.subject} {bp.grade} · {bp.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {blueprintId ? <Text className="font-body text-xs text-gray-500">{t("prova.ai.blueprintCountHint")}</Text> : null}
        </View>
      ) : null}

      {blueprintId ? null : (
        <>
          <View className="flex-row gap-2">
            <View className="flex-[2]">
              <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} placeholder="Fen Bilimleri" />
            </View>
            <View className="flex-1">
              <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
            </View>
          </View>
          <Field label={t("prova.topic")} value={topic} onChangeText={setTopic} placeholder="Isı ve Sıcaklık" />
        </>
      )}
      <Field label={t("prova.ai.count")} keyboardType="number-pad" maxLength={2} value={count} onChangeText={setCount} />

      <View className="flex-row flex-wrap gap-2">
        {KIND_MODES.map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setKind(k)} className={chip(kind === k)}>
            <Text className={chipText(kind === k)}>{k === "mixed" ? t("prova.ai.kindMixed") : t(`prova.kind.${k}`)}</Text>
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

      <Text className="font-body text-xs text-gray-500">{t("prova.ai.privacyNote")}</Text>
      <ErrorText error={generate.error ?? entitlement.error ?? blueprints.error} />
      <Button
        title={generate.isPending ? t("prova.ai.generating") : t("prova.ai.generate")}
        loading={generate.isPending}
        disabled={!!ent && ent.ai_generate_limit <= 0}
        onPress={() => generate.mutate()}
      />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}

function QuestionCard({ index, question: q }: { index: number; question: GeneratedQuestion }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-2 rounded-parent border border-mist bg-white p-3 dark:bg-night-surface">
      <Text className="font-body text-xs text-gray-500">
        {index}. {q.topic} · {t(`prova.kind.${q.kind}`)} · {t(`prova.difficulty.${q.difficulty}`)}
      </Text>
      <Text className="font-body-bold text-base text-ink dark:text-night-text">{q.stem}</Text>
      {q.choices?.map((c) => (
        <Text key={c.key} className={c.key === q.correct_key ? "font-body-bold text-green" : "text-ink dark:text-night-text"}>
          {c.key}) {c.text}
        </Text>
      ))}
      {q.kind === "open_ended" && q.expected_answer ? (
        <Text className="font-body text-sm text-ink dark:text-night-text">
          <Text className="font-body-bold">{t("prova.expected")}: </Text>
          {q.expected_answer}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)}>
        <Text className="font-body-bold text-teal-dark">{open ? t("prova.ai.hideSolution") : t("prova.ai.showSolution")}</Text>
      </Pressable>
      {open ? (
        <View className="gap-1">
          {q.solution ? (
            <Text className="font-body text-sm text-gray-600">
              <Text className="font-body-bold">{t("prova.solution")}: </Text>
              {q.solution}
            </Text>
          ) : null}
          {q.explanation ? <Text className="font-body text-sm text-gray-600">{q.explanation}</Text> : null}
          {q.source_urls.length ? <Text className="font-body text-xs text-gray-500">{t("prova.ai.sources")}: {q.source_urls.join(", ")}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
