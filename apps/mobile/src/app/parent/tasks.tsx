import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { taskTemplateInputSchema, type IsoWeekday } from "@gina/core";

import { TASK_ICON_SLUGS, TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
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
      const { data, error } = await supabase.from("children").select("id, name").order("sort_order");
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
        starts_on: new Date().toISOString().slice(0, 10),
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
    <Screen title={t("parent.tasks")}>
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

      {templates.data?.map((template) => (
        <View key={template.id} className={`flex-row items-center gap-3 rounded-parent border border-mist p-3 ${template.active ? "" : "opacity-50"}`}>
          <TaskIcon slug={template.icon} size={48} variant="illustrated" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink dark:text-night-text">{template.title}</Text>
            <Text className="text-sm text-gray-600">
              {template.stars} ⭐ · {WEEKDAYS.filter((w) => template.days_of_week.includes(w.day)).map((w) => t(`weekday.${w.day}`)).join(" ")}
            </Text>
          </View>
          <Button
            variant="ghost"
            title={template.active ? t("tasks.pause") : t("tasks.resume")}
            onPress={() => toggleActive.mutate({ id: template.id, active: !template.active })}
          />
        </View>
      ))}
      {templates.data?.length === 0 ? <Text className="text-gray-500">{t("tasks.none")}</Text> : null}

      {selectedChild ? (
        <View className="gap-3 rounded-parent bg-teal-light p-4">
          <Text className="text-lg font-semibold text-ink">{t("tasks.new")}</Text>
          <Field label={t("tasks.title")} value={title} onChangeText={setTitle} placeholder={t("tasks.titlePlaceholder")} />
          <Text className="text-sm font-medium text-ink">{t("tasks.icon")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {TASK_ICON_SLUGS.map((slug) => (
                <Pressable
                  key={slug}
                  accessibilityRole="button"
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
                accessibilityRole="button"
                onPress={() => toggleDay(w.day)}
                className={`rounded-full px-3 py-2 ${days.includes(w.day) ? "bg-teal" : "bg-white"}`}
              >
                <Text className={days.includes(w.day) ? "font-semibold text-white" : "text-ink"}>{t(`weekday.${w.day}`)}</Text>
              </Pressable>
            ))}
          </View>
          {formError ? <Text className="text-sm text-danger">{formError}</Text> : null}
          <Button title={t("common.save")} loading={addTemplate.isPending} disabled={!title.trim() || days.length === 0} onPress={() => addTemplate.mutate()} />
        </View>
      ) : (
        <Text className="text-gray-500">{t("tasks.addChildFirst")}</Text>
      )}

      <ErrorText error={children.error ?? templates.error ?? toggleActive.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
