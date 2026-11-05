import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { isCalendarDate, localDateOf, type Enums } from "@gina/core";

import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { DateChoice } from "@/components/ui/date-time-choice";
import { NumberChoice } from "@/components/ui/number-choice";
import { GuidedField } from "@/components/ui/guided-field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, FormSection, ChildPicker, EmptyCard } from "@/components/ui/parent-screen";
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
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
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
      if (!selectedChild || !subject.trim() || !score.trim() || !Number.isFinite(scoreNum) || !Number.isFinite(maxNum) || scoreNum < 0 || scoreNum > maxNum || maxNum <= 0 || !isCalendarDate(gradedOn)) {
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
    <Screen title={t("parent.grades")} subtitle={t("unified.gradesHelp")} loading={children.isLoading || grades.isLoading} error={children.error ?? grades.error} onRetry={() => { void children.refetch(); if (selectedChild) void grades.refetch(); }}>
      <ChildPicker profiles={children.data ?? []} selected={selectedChild} onSelect={setChildId} />

      {selectedChild ? (
        <FormSection title={t("grades.new")}>
          <GuidedField childId={selectedChild} kind="subject" label={t("grades.subject")} value={subject} onChange={setSubject} disabled={addGrade.isPending} />
          <View className="flex-row flex-wrap gap-2">
            {KINDS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }}
                onPress={() => setKind(option)}
                className={`min-h-12 items-center justify-center rounded-full px-3 py-2 ${kind === option ? "bg-teal-dark border border-teal-dark" : "bg-white border border-[#A89BD4]"}`}
              >
                <Text className={kind === option ? "font-body-bold text-white" : "font-body text-ink"}>{t(`grade.kind.${option}`)}</Text>
              </Pressable>
            ))}
          </View>
          <NumberChoice label={t("grades.score")} value={score === "" ? null : Number(score)} onChange={n => setScore(String(n))} min={0} max={Number(maxScore)} step={1} precision={2} presets={[0, 25, 50, 75, 85, 90, 100]} disabled={addGrade.isPending}/>
          <NumberChoice label={t("grades.maxScore")} value={Number(maxScore)} onChange={n => setMaxScore(String(n))} min={1} max={9999} step={1} precision={2} presets={[5, 10, 20, 100]} disabled={addGrade.isPending}/>
          {score !== "" && Number(score) > Number(maxScore) ? <Text accessibilityRole="alert" className="font-body text-danger">{t("grades.invalid")}</Text> : null}
          <DateChoice label={t("experience.dateLabel")} value={gradedOn} onChange={setGradedOn} today={localDateOf(new Date(), timeZone)} disabled={addGrade.isPending}/>
          {formError ? <Text className="font-body text-sm text-danger">{formError}</Text> : null}
          <Button title={t("common.save")} loading={addGrade.isPending} disabled={!subject.trim() || !score.trim() || Number(score) > Number(maxScore)} onPress={() => addGrade.mutate()} />
        </FormSection>
      ) : (
        <EmptyCard title={t("unified.chooseChild")} body={t("unified.noChildHelp")}><Button title={t("unified.createFirstChild")} onPress={()=>router.push("/parent/menu")}/></EmptyCard>
      )}

      {grades.data?.length === 0 ? <EmptyCard title={t("grades.none")} slug="display-bookworm" /> : null}
      {grades.data?.map((grade) => (
        <View key={grade.id} className="flex-row items-center gap-3 rounded-parent border border-mist p-3">
          <SubjectIcon subject={grade.subject} size={48} variant="illustrated" />
          <View className="flex-1">
            <Text className="text-base font-body-bold text-ink">{grade.subject}</Text>
            <Text className="font-body text-xs text-gray-500">
              {t(`grade.kind.${grade.kind}`)} · {dateFormat.format(new Date(`${grade.graded_on}T00:00:00Z`))}
            </Text>
          </View>
          <Text className="text-xl font-body-bold text-ink">
            {numberFormat.format(Number(grade.score))}
            <Text className="text-sm font-body text-gray-500"> / {numberFormat.format(Number(grade.max_score))}</Text>
          </Text>
        </View>
      ))}



      <ErrorText error={children.error ?? grades.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
