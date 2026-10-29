import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { localDateOf, type Enums } from "@gina/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type GradeKind = Enums<"grade_kind">;
const KINDS: GradeKind[] = ["exam", "homework", "project", "oral", "performance"];

/** Veli: çocuk başına okul puanları (sınav, ödev, proje …) listesi ve giriş formu. */
export default function ParentGradesScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<GradeKind>("exam");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const timeZone = useFamilyTimezone();
  const [gradedOn, setGradedOn] = useState(localDateOf(new Date(), timeZone));
  const [formError, setFormError] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const selectedChild = childId ?? children.data?.[0]?.id ?? null;

  const grades = useQuery({
    queryKey: ["grades", selectedChild],
    enabled: !!selectedChild,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("id, subject, kind, score, max_score, graded_on, note")
        .eq("child_id", selectedChild ?? "")
        .order("graded_on", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const addGrade = useMutation({
    mutationFn: async () => {
      const scoreNum = Number(score.replace(",", "."));
      const maxNum = Number(maxScore.replace(",", "."));
      if (!selectedChild || !subject.trim() || Number.isNaN(scoreNum) || Number.isNaN(maxNum) || maxNum <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(gradedOn)) {
        throw new Error(t("grades.invalid"));
      }
      const { error } = await supabase.from("grades").insert({
        family_id: familyId,
        child_id: selectedChild,
        subject: subject.trim(),
        kind,
        score: scoreNum,
        max_score: maxNum,
        graded_on: gradedOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setScore("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["grades", selectedChild] });
    },
    onError: (e) => setFormError(e.message),
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const numberFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });

  return (
    <Screen title={t("parent.grades")}>
      <View className="flex-row flex-wrap gap-2">
        {children.data?.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            onPress={() => setChildId(child.id)}
            className={`rounded-full px-4 py-2 ${child.id === selectedChild ? "bg-teal" : "bg-mist"}`}
          >
            <Text className={child.id === selectedChild ? "font-semibold text-white" : "text-ink"}>{child.name}</Text>
          </Pressable>
        ))}
      </View>

      {grades.data?.length === 0 ? <Text className="text-gray-500">{t("grades.none")}</Text> : null}
      {grades.data?.map((grade) => (
        <View key={grade.id} className="flex-row items-center gap-3 rounded-parent border border-mist p-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink dark:text-night-text">{grade.subject}</Text>
            <Text className="text-xs text-gray-500">
              {t(`grade.kind.${grade.kind}`)} · {dateFormat.format(new Date(`${grade.graded_on}T00:00:00Z`))}
            </Text>
          </View>
          <Text className="text-xl font-bold text-ink dark:text-night-text">
            {numberFormat.format(Number(grade.score))}
            <Text className="text-sm font-normal text-gray-500"> / {numberFormat.format(Number(grade.max_score))}</Text>
          </Text>
        </View>
      ))}

      {selectedChild ? (
        <View className="gap-3 rounded-parent bg-teal-light p-4">
          <Text className="text-lg font-semibold text-ink">{t("grades.new")}</Text>
          <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} placeholder={t("grades.subjectPlaceholder")} />
          <View className="flex-row flex-wrap gap-2">
            {KINDS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setKind(option)}
                className={`rounded-full px-3 py-2 ${kind === option ? "bg-teal" : "bg-white"}`}
              >
                <Text className={kind === option ? "font-semibold text-white" : "text-ink"}>{t(`grade.kind.${option}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label={t("grades.score")} keyboardType="decimal-pad" value={score} onChangeText={setScore} />
            </View>
            <View className="flex-1">
              <Field label={t("grades.maxScore")} keyboardType="decimal-pad" value={maxScore} onChangeText={setMaxScore} />
            </View>
          </View>
          <Field label={t("calendar.date")} value={gradedOn} onChangeText={setGradedOn} autoCapitalize="none" />
          {formError ? <Text className="text-sm text-danger">{formError}</Text> : null}
          <Button title={t("common.save")} loading={addGrade.isPending} disabled={!subject.trim() || !score.trim()} onPress={() => addGrade.mutate()} />
        </View>
      ) : (
        <Text className="text-gray-500">{t("tasks.addChildFirst")}</Text>
      )}

      <ErrorText error={children.error ?? grades.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
