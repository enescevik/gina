import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { localDateOf, taskTemplateInputSchema, type IsoWeekday } from "@gina/core";

import { TASK_ICON_SLUGS, TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles, FormSection, ChildPicker, EmptyCard } from "@/components/ui/parent-screen";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const WEEKDAYS: { day: IsoWeekday; label: string }[] = [
  { day: 1, label: "Pzt" },
  { day: 2, label: "Sal" },
  { day: 3, label: "Çar" },
  { day: 4, label: "Per" },
  { day: 5, label: "Cum" },
  { day: 6, label: "Cmt" },
  { day: 7, label: "Paz" },
];

/** Veli: çocuk başına görev şablonları (tekrarlayan görevler) listesi ve yeni şablon formu. */
export default function ParentTasksScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const timeZone = useFamilyTimezone();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stars, setStars] = useState("1");
  const [days, setDays] = useState<IsoWeekday[]>([1, 2, 3, 4, 5]);
  const [icon, setIcon] = useState<string>("task-custom");
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

  const templates = useQuery({
    queryKey: ["task_templates", selectedChild],
    enabled: !!selectedChild,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, title, icon, stars, days_of_week, active")
        .eq("child_id", selectedChild ?? "")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const addTemplate = useMutation({
    mutationFn: async () => {
      const parsed = taskTemplateInputSchema.safeParse({
        child_id: selectedChild,
        title,
        icon,
        stars: Number(stars),
        days_of_week: days,
        starts_on: localDateOf(new Date(), timeZone),
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
      }
      const { error } = await supabase.from("task_templates").insert({ ...parsed.data, family_id: familyId });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setStars("1");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["task_templates", selectedChild] });
    },
    onError: (e) => setFormError(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("task_templates").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["task_templates", selectedChild] }),
  });

  function toggleDay(day: IsoWeekday) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  return (
    <Screen title={t("parent.tasks")} subtitle={t("parentV5.tasksSubtitle")} loading={children.isLoading || templates.isLoading} error={children.error ?? templates.error} onRetry={() => { void children.refetch(); if (selectedChild) void templates.refetch(); }}>
      <ChildPicker profiles={children.data ?? []} selected={selectedChild} onSelect={setChildId} />

      {selectedChild ? (
        <FormSection title={t("tasks.new")}>
          <Field label={t("tasks.title")} value={title} onChangeText={setTitle} placeholder={t("tasks.titlePlaceholder")} />
          <Text className="text-sm font-body text-ink">{t("tasks.icon")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {TASK_ICON_SLUGS.map((slug) => (
                <Pressable
                  key={slug}
                  accessibilityRole="button" accessibilityLabel={t(`taskIcon.${slug}`)} accessibilityState={{ selected: icon === slug }} aria-pressed={icon === slug}
                  onPress={() => setIcon(slug)}
                  className={`rounded-parent border p-1.5 ${icon === slug ? "border-teal bg-white" : "border-transparent"}`}
                >
                  <TaskIcon slug={slug} size={56} variant="illustrated" />
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Field label={t("tasks.stars")} keyboardType="number-pad" maxLength={2} value={stars} onChangeText={setStars} />
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAYS.map((w) => (
              <Pressable
                key={w.day}
                accessibilityRole="button" accessibilityState={{ selected: days.includes(w.day) }} aria-pressed={days.includes(w.day)}
                onPress={() => toggleDay(w.day)}
                className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 ${days.includes(w.day) ? "bg-teal-dark border border-teal-dark" : "bg-white border border-[#527E72]"}`}
              >
                <Text className={days.includes(w.day) ? "font-body-bold text-white" : "font-body text-ink"}>{t(`weekday.${w.day}`)}</Text>
              </Pressable>
            ))}
          </View>
          {formError ? <Text className="font-body text-sm text-danger">{formError}</Text> : null}
          <Button title={t("common.save")} loading={addTemplate.isPending} disabled={!title.trim() || days.length === 0} onPress={() => addTemplate.mutate()} />
        </FormSection>
      ) : (
        <EmptyCard title={t("release.firstChildTitle")} body={t("release.firstChildBody")}><Button title={t("release.firstChildAction")} onPress={() => router.push("/parent/menu")} /></EmptyCard>
      )}
      {templates.data?.map(template => <View key={template.id} style={[parentStyles.card, { opacity: template.active ? 1 : .75, flexDirection:"row", alignItems:"center", padding:14, gap:10 }]}>
        <View style={[parentStyles.row,{flex:1}]}>
          <TaskIcon slug={template.icon} size={56} variant="illustrated" />
          <View className="flex-1 gap-1">
            <Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{template.title}</Text>
            <Text style={parentStyles.muted}>{t("room.starCount", { count: template.stars })} · {template.days_of_week.length === 7 ? t("redesign.everyDay") : WEEKDAYS.filter(w => template.days_of_week.includes(w.day)).map(w => t(`weekday.${w.day}`)).join(" ")}</Text>
          </View>
        </View>
        <Button style={{maxWidth:96,paddingHorizontal:10}} variant="ghost" title={template.active ? t("tasks.pause") : t("tasks.resume")}
          loading={toggleActive.isPending && toggleActive.variables?.id === template.id} disabled={toggleActive.isPending}
          onPress={() => toggleActive.mutate({ id: template.id, active: !template.active })} />
      </View>)}
      {templates.data?.length === 0 ? <EmptyCard title={t("tasks.none")} body={t("parentV5.firstTask")} /> : null}



      <ErrorText error={children.error ?? templates.error ?? toggleActive.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
