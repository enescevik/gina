import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { provaErrorMessage } from "@/lib/prova-ai";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface Row {
  topic: string;
  count: number;
}

/**
 * Deneme oluştur: çocuk + (isteğe bağlı) senaryo seç → konu başına soru sayısı önerisi (düzenlenebilir)
 * → kütüphaneden sorular seçilir → süreli/süresiz → çocuğa atanır.
 */
export default function ExamCreateScreen() {
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [timed, setTimed] = useState(true);
  const [minutes, setMinutes] = useState("20");

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

  const bank = useQuery({
    queryKey: ["question_bank_for", subject, grade],
    enabled: !!subject.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_bank")
        .select("id, topic, times_asked")
        .eq("subject", subject.trim())
        .eq("grade", Number(grade) || 5)
        .order("times_asked");
      if (error) throw error;
      return data;
    },
  });

  // Senaryo seçilince ders/sınıf/satırlar ve başlık önerisi dolar.
  function pickBlueprint(id: string | null) {
    setBlueprintId(id);
    const bp = blueprints.data?.find((b) => b.id === id);
    if (!bp) return;
    setSubject(bp.subject);
    setGrade(String(bp.grade));
    setRows(Array.isArray(bp.rows) ? (bp.rows as unknown as Row[]) : []);
    setTitle(`${bp.subject} · ${bp.name}`);
  }

  // Konu başına mevcut soru sayısı (öneri ile kütüphane karşılaştırması).
  const availableByTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of bank.data ?? []) map.set(q.topic.toLocaleLowerCase("tr"), (map.get(q.topic.toLocaleLowerCase("tr")) ?? 0) + 1);
    return map;
  }, [bank.data]);

  const selectedIds = useMemo(() => {
    const ids: string[] = [];
    const pool = bank.data ?? [];
    if (rows.length === 0) return pool.slice(0, 10).map((q) => q.id);
    for (const row of rows) {
      const matches = pool.filter((q) => q.topic.toLocaleLowerCase("tr") === row.topic.toLocaleLowerCase("tr"));
      ids.push(...matches.slice(0, row.count).map((q) => q.id));
    }
    return ids;
  }, [bank.data, rows]);

  const create = useMutation({
    mutationFn: async () => {
      if (!childId) throw new Error(t("prova.pickChild"));
      if (selectedIds.length === 0) throw new Error(t("prova.noQuestionsForExam"));
      const { error } = await supabase.from("exams").insert({
        family_id: familyId,
        child_id: childId,
        blueprint_id: blueprintId,
        title: title.trim() || subject.trim(),
        subject: subject.trim(),
        grade: Number(grade) || 5,
        question_ids: selectedIds,
        timed,
        duration_minutes: timed ? Math.max(1, Number(minutes) || 20) : null,
        status: "assigned",
        created_by: session?.user.id ?? null,
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

  return (
    <Screen title={t("prova.newExam")}>
      <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.forChild")}</Text>
      <View className="flex-row flex-wrap gap-2">
        {children.data?.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => setChildId(c.id)} className={chip(childId === c.id)}>
            <Text className={chipText(childId === c.id)}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.fromBlueprint")}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable accessibilityRole="button" onPress={() => pickBlueprint(null)} className={chip(blueprintId === null)}>
          <Text className={chipText(blueprintId === null)}>{t("prova.noBlueprint")}</Text>
        </Pressable>
        {blueprints.data?.map((bp) => (
          <Pressable key={bp.id} accessibilityRole="button" onPress={() => pickBlueprint(bp.id)} className={chip(blueprintId === bp.id)}>
            <Text className={chipText(blueprintId === bp.id)}>
              {bp.subject} · {bp.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row gap-2">
        <View className="flex-[2]">
          <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} />
        </View>
        <View className="flex-1">
          <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
        </View>
      </View>

      {rows.length > 0 ? (
        <View className="gap-2 rounded-parent bg-teal-light p-3">
          <Text className="font-body-bold text-sm text-ink">{t("prova.distribution")}</Text>
          {rows.map((row, i) => {
            const available = availableByTopic.get(row.topic.toLocaleLowerCase("tr")) ?? 0;
            return (
              <View key={`${row.topic}-${i}`} className="flex-row items-center gap-2">
                <Text className="font-body flex-1 text-sm text-ink">{row.topic}</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(row.count)}
                  onChangeText={(v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, count: Math.max(0, Number(v) || 0) } : r)))}
                  className="w-12 rounded-parent border border-mist bg-white px-2 py-1 text-center text-ink"
                />
                <Text className={`font-body w-20 text-xs ${available >= row.count ? "text-gray-600" : "text-danger"}`}>
                  {t("prova.available", { count: available })}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text className="font-body text-sm text-gray-600">{t("prova.selectedCount", { count: selectedIds.length })}</Text>
      <Field label={t("calendar.title")} value={title} onChangeText={setTitle} />
      <View className="flex-row items-center gap-3">
        <Switch value={timed} onValueChange={setTimed} />
        <Text className="font-body text-base text-ink dark:text-night-text">{t("prova.timed")}</Text>
        {timed ? (
          <TextInput
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
            className="w-16 rounded-parent border border-mist bg-white px-2 py-1 text-center text-ink"
          />
        ) : null}
        {timed ? <Text className="font-body text-ink dark:text-night-text">{t("prova.min")}</Text> : null}
      </View>

      <ErrorText error={(create.error && provaErrorMessage(create.error)) || (create.error ?? children.error ?? blueprints.error ?? bank.error)} />
      <Button title={t("prova.assign")} loading={create.isPending} onPress={() => create.mutate()} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
