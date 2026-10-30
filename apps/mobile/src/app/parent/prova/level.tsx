import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const DIFFICULTIES = ["kolay", "orta", "orta_ustu", "zor"] as const;

/** Sunucu hata kodlarını kullanıcı metnine çevirir. */
function friendlyError(error: unknown, t: (k: string) => string): unknown {
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : "";
  if (message === "no_questions") return new Error(t("prova.level.noQuestions"));
  if (message === "child_not_found") return new Error(t("prova.pickChild"));
  return error;
}

/**
 * Seviye tespiti: çocuk + ders/sınıf (isteğe bağlı senaryo) → sunucu her konudan karışık zorlukta
 * (kolay→zor) dengeli bir set seçer (pick_level_questions) → önizleme → create_level_test ile atanır.
 */
export default function LevelTestScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [perTopic, setPerTopic] = useState("3");
  const [maxQuestions, setMaxQuestions] = useState("24");
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState("40");

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade").order("sort_order");
      if (error) throw error;
      return data;
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

  // Kütüphanedeki dersler (hızlı seçim çipleri).
  const subjects = useQuery({
    queryKey: ["question_bank_subjects", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank").select("subject, grade");
      if (error) throw error;
      const seen = new Map<string, { subject: string; grade: number }>();
      for (const row of data) seen.set(`${row.subject}|${row.grade}`, row);
      return Array.from(seen.values()).sort((a, b) => a.subject.localeCompare(b.subject, "tr") || a.grade - b.grade);
    },
  });

  const gradeNum = Number(grade) || 5;
  const perTopicNum = Math.min(10, Math.max(1, Number(perTopic) || 3));
  const maxNum = Math.min(60, Math.max(1, Number(maxQuestions) || 24));

  const preview = useQuery({
    queryKey: ["level_preview", familyId, subject.trim(), gradeNum, blueprintId, perTopicNum, maxNum],
    enabled: !!familyId && !!subject.trim(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pick_level_questions", {
        p_subject: subject.trim(),
        p_grade: gradeNum,
        p_blueprint_id: blueprintId ?? undefined,
        p_per_topic: perTopicNum,
        p_max_questions: maxNum,
      });
      if (error) throw error;
      return data;
    },
  });

  const summary = useMemo(() => {
    const rows = preview.data ?? [];
    const byDifficulty = new Map<string, number>();
    const byTopic = new Map<string, number>();
    for (const r of rows) {
      byDifficulty.set(r.difficulty, (byDifficulty.get(r.difficulty) ?? 0) + 1);
      byTopic.set(r.topic, (byTopic.get(r.topic) ?? 0) + 1);
    }
    return { total: rows.length, byDifficulty, byTopic: Array.from(byTopic.entries()) };
  }, [preview.data]);

  function pickChild(id: string) {
    setChildId(id);
    const child = children.data?.find((c) => c.id === id);
    if (child?.grade && !blueprintId) setGrade(String(child.grade));
  }

  function pickBlueprint(id: string | null) {
    setBlueprintId(id);
    const bp = blueprints.data?.find((b) => b.id === id);
    if (!bp) return;
    setSubject(bp.subject);
    setGrade(String(bp.grade));
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!childId) throw new Error(t("prova.pickChild"));
      if (!subject.trim()) throw new Error(t("prova.level.subjectRequired"));
      const { error } = await supabase.rpc("create_level_test", {
        p_child_id: childId,
        p_subject: subject.trim(),
        p_grade: gradeNum,
        p_blueprint_id: blueprintId ?? undefined,
        p_per_topic: perTopicNum,
        p_max_questions: maxNum,
        p_title: t("prova.level.examTitle", { subject: subject.trim() }),
        p_timed: timed,
        p_duration_minutes: timed ? Math.max(1, Number(minutes) || 40) : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams", familyId] });
      router.back();
    },
  });

  const chip = (active: boolean) => `rounded-full px-3 py-2 ${active ? "bg-teal" : "bg-mist"}`;
  const chipText = (active: boolean) => (active ? "font-semibold text-white" : "text-ink");
  const blueprintsForSubject = blueprints.data ?? [];

  return (
    <Screen title={t("prova.level.title")}>
      <Text className="text-base text-gray-600">{t("prova.level.intro")}</Text>

      <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.forChild")}</Text>
      <View className="flex-row flex-wrap gap-2">
        {children.data?.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => pickChild(c.id)} className={chip(childId === c.id)}>
            <Text className={chipText(childId === c.id)}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {subjects.data && subjects.data.length > 0 ? (
        <>
          <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.level.fromLibrary")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {subjects.data.map((s) => {
              const active = !blueprintId && subject.trim() === s.subject && gradeNum === s.grade;
              return (
                <Pressable
                  key={`${s.subject}-${s.grade}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setBlueprintId(null);
                    setSubject(s.subject);
                    setGrade(String(s.grade));
                  }}
                  className={chip(active)}
                >
                  <Text className={chipText(active)}>
                    {s.subject} · {s.grade}. {t("prova.gradeWord")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View className="flex-row gap-2">
        <View className="flex-[2]">
          <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} />
        </View>
        <View className="flex-1">
          <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
        </View>
      </View>

      <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.level.topicsFrom")}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable accessibilityRole="button" onPress={() => pickBlueprint(null)} className={chip(blueprintId === null)}>
          <Text className={chipText(blueprintId === null)}>{t("prova.level.allTopics")}</Text>
        </Pressable>
        {blueprintsForSubject.map((bp) => (
          <Pressable key={bp.id} accessibilityRole="button" onPress={() => pickBlueprint(bp.id)} className={chip(blueprintId === bp.id)}>
            <Text className={chipText(blueprintId === bp.id)}>
              {bp.subject} · {bp.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label={t("prova.level.perTopic")} keyboardType="number-pad" maxLength={2} value={perTopic} onChangeText={setPerTopic} />
        </View>
        <View className="flex-1">
          <Field label={t("prova.level.maxQuestions")} keyboardType="number-pad" maxLength={2} value={maxQuestions} onChangeText={setMaxQuestions} />
        </View>
      </View>
      {blueprintId ? <Text className="text-xs text-gray-600">{t("prova.level.blueprintQuotaNote")}</Text> : null}

      {subject.trim() ? (
        <View className="gap-2 rounded-parent bg-teal-light p-3">
          <Text className="font-body-bold text-sm text-ink">{t("prova.level.preview", { count: summary.total })}</Text>
          {summary.total === 0 && !preview.isLoading ? <Text className="text-sm text-danger">{t("prova.level.noQuestions")}</Text> : null}
          {summary.total > 0 ? (
            <>
              <View className="flex-row flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Text key={d} className="rounded-full bg-white px-2 py-1 text-xs text-ink">
                    {t(`prova.difficulty.${d}`)}: {summary.byDifficulty.get(d) ?? 0}
                  </Text>
                ))}
              </View>
              {summary.byTopic.map(([topic, n]) => (
                <View key={topic} className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm text-ink">{topic}</Text>
                  <Text className="text-sm text-gray-600">{t("prova.questionCount", { count: n })}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        <Switch value={timed} onValueChange={setTimed} />
        <Text className="text-base text-ink dark:text-night-text">{t("prova.timed")}</Text>
        {timed ? (
          <TextInput
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
            className="w-16 rounded-parent border border-mist bg-white px-2 py-1 text-center text-ink"
          />
        ) : null}
        {timed ? <Text className="text-ink dark:text-night-text">{t("prova.min")}</Text> : null}
      </View>

      <ErrorText error={friendlyError(create.error ?? preview.error ?? children.error ?? blueprints.error ?? subjects.error, t)} />
      <Button title={t("prova.level.create")} loading={create.isPending} disabled={summary.total === 0} onPress={() => create.mutate()} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
