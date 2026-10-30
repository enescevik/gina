import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WeekStrip } from "@/components/room/week-strip";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { localDateOf, templatesDueOn, weekDatesOf } from "@gina/core";

import { TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, ChildColumns, childStyles } from "@/components/room/child-screen";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useActiveChild } from "@/lib/active-child";
import { supabase } from "@/lib/supabase";

/** Çocuğun «Haftam» ekranı: haftanın günleri, o gün düşen görevler ve durumları. */
export default function ChildWeekScreen() {
  const { t, i18n } = useTranslation();
  const { childId, path } = useActiveChild();
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const week = weekDatesOf(today);
  const [selected, setSelected] = useState(today);
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
    <Screen tone="child" loading={templates.isLoading || completions.isLoading} title={t("child.week")}>
      <ErrorText error={templates.error ?? completions.error} />
      <ChildColumns rail={<WeekStrip week={week} selected={selected} onSelect={setSelected} />}>
      {[selected].map((date) => {
        const due = templatesDueOn(templates.data ?? [], date);
        const isToday = date === today;
        return (
          <View key={date} style={{ gap: 12 }}>
            <Text style={[childStyles.title, { fontSize: 20 }]}>
              {dayFormat.format(new Date(`${date}T00:00:00Z`))}
              {isToday ? ` · ${t("calendar.today")}` : ""}
            </Text>
            {due.length === 0 && !templates.error ? <Text style={childStyles.copy}>{t("child.noTasks")}</Text> : null}
            {due.map((task) => {
              const status = byKey.get(`${task.id}:${date}`);
              return (
                <View key={task.id} style={[childStyles.card, { flexDirection: "row", alignItems: "center", padding: 12 }]}>
                  <TaskIcon slug={task.icon} size={56} variant="illustrated" />
                  <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                    <Text style={[childStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{task.title}</Text>
                    <Text style={{ alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: status === "approved" ? "#E6F7EF" : "#FFF1D4", color: "#425E58", fontFamily: "Nunito_700Bold", fontSize: 13 }}>{status === "approved" ? t("child.approved") : status === "done" ? t("child.waitingApproval") : t("childV5.notCompleted")}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      </ChildColumns>
      <Button variant="ghost" title={t("child.today")} onPress={() => router.replace(path("today"))} />
    </Screen>
  );
}
