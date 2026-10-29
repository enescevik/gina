import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { DEFAULT_TIMEZONE, localDateOf, templatesDueOn, weekDatesOf } from "@gina/core";

import { TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuğun «Haftam» ekranı: haftanın günleri, o gün düşen görevler ve durumları. */
export default function ChildWeekScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const today = localDateOf(new Date(), DEFAULT_TIMEZONE);
  const week = weekDatesOf(today);
  const from = week[0] ?? today;
  const to = week[6] ?? today;

  const templates = useQuery({
    queryKey: ["task_templates", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order")
        .eq("child_id", childId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const completions = useQuery({
    queryKey: ["task_completions_week", childId, from],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("template_id, due_date, status")
        .eq("child_id", childId)
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data;
    },
  });

  useRealtimeInvalidate("task_completions", childId ? `child_id=eq.${childId}` : null, [["task_completions_week", childId, from]]);

  const byKey = new Map((completions.data ?? []).map((c) => [`${c.template_id}:${c.due_date}`, c.status]));
  const dayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <Screen tone="child" title={t("child.week")}>
      <ErrorText error={templates.error ?? completions.error} />
      {week.map((date) => {
        const due = templatesDueOn(templates.data ?? [], date);
        const isToday = date === today;
        return (
          <View key={date} className={`gap-2 rounded-child p-4 ${isToday ? "bg-teal-light" : "bg-white dark:bg-night-surface"}`}>
            <Text className={`text-base font-bold ${isToday ? "text-teal-dark" : "text-ink dark:text-night-text"}`}>
              {dayFormat.format(new Date(`${date}T00:00:00Z`))}
              {isToday ? ` · ${t("calendar.today")}` : ""}
            </Text>
            {due.length === 0 ? <Text className="text-sm text-gray-500">{t("child.noTasks")}</Text> : null}
            {due.map((task) => {
              const status = byKey.get(`${task.id}:${date}`);
              return (
                <View key={task.id} className="flex-row items-center gap-3">
                  <TaskIcon slug={task.icon} size={28} />
                  <Text className="flex-1 text-base text-ink dark:text-night-text">{task.title}</Text>
                  <Text className="text-xl">{status === "approved" ? "✅" : status === "done" ? "⏳" : date < today ? "▫️" : "⬜️"}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
      <Button variant="ghost" title={t("child.today")} onPress={() => router.replace("/child/today")} />
    </Screen>
  );
}
