import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { localDateOf, occurrencesBetween, templatesDueOn, weekDatesOf } from "@gina/core";

import LogoMark from "../../../../../packages/assets/brand/yan-yana/logo-mark.svg";

import { Avatar } from "@/components/avatar";
import { TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Veli ana sayfası (onaylı tasarım, resim 2): ailenin günü, onay kuyruğu, bugünün planı, içgörü. */
export default function ParentHomeScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const week = weekDatesOf(today);
  const from = week[0] ?? today;
  const to = week[6] ?? today;
  const queryClient = useQueryClient();
  const [childFilter, setChildFilter] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const templates = useQuery({
    queryKey: ["family_task_templates", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, child_id, days_of_week, starts_on, ends_on, active, sort_order")
        .eq("family_id", familyId);
      if (error) throw error;
      return data;
    },
  });

  const completions = useQuery({
    queryKey: ["family_completions", familyId, today],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, child_id, template_id, due_date, status")
        .eq("family_id", familyId)
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data;
    },
  });

  const stars = useQuery({
    queryKey: ["family_star_totals", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("star_events").select("child_id, delta").eq("family_id", familyId);
      if (error) throw error;
      const totals = new Map<string, number>();
      for (const e of data) totals.set(e.child_id, (totals.get(e.child_id) ?? 0) + e.delta);
      return totals;
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, due_date, child_id, task_templates(title, icon, stars), children!task_completions_child_id_fkey(name)")
        .eq("family_id", familyId)
        .eq("status", "done")
        .order("completed_at");
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, type, child_id, starts_at, ends_at, all_day, rrule, location, children!events_child_id_fkey(name)")
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  useRealtimeInvalidate("task_completions", familyId ? `family_id=eq.${familyId}` : null, [
    ["approvals", familyId],
    ["family_completions", familyId, today],
  ]);

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_task", { p_completion_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSettled: () =>
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family_star_totals", familyId] }),
      ]),
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", weekday: "long" });
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });

  const visibleChildren = (children.data ?? []).filter((c) => !childFilter || c.id === childFilter);
  const familyDay = visibleChildren.map((child) => {
    const due = templatesDueOn((templates.data ?? []).filter((t2) => t2.child_id === child.id), today).length;
    const done = (completions.data ?? []).filter(
      (c) => c.child_id === child.id && c.due_date === today && (c.status === "done" || c.status === "approved"),
    ).length;
    return { child, due, done, stars: stars.data?.get(child.id) ?? 0 };
  });

  const todaysPlan = occurrencesBetween(events.data ?? [], today, today, timeZone).filter(
    (o) => !childFilter || o.event.child_id === null || o.event.child_id === childFilter,
  );

  // İçgörü: bu hafta onaylanan görev sayısı (aile geneli, gerçek veri)
  const weekApproved = (completions.data ?? []).filter((c) => c.status === "approved").length;

  const pendingApprovals = (approvals.data ?? []).filter((a) => !childFilter || a.child_id === childFilter);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <LogoMark width={44} height={44} />
        <Button variant="secondary" title={t("parent.menu")} onPress={() => router.push("/parent/menu")} />
      </View>
      <Text className="font-display text-3xl text-ink dark:text-night-text">{t("parent.goodDay")}</Text>
      <Text className="text-base text-gray-600">{dateFormat.format(new Date(`${today}T12:00:00Z`))}</Text>

      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={() => setChildFilter(null)}
          className={`min-h-12 flex-row items-center gap-2 rounded-full px-4 ${childFilter === null ? "bg-teal" : "bg-white dark:bg-night-surface"}`}
        >
          <Text className={childFilter === null ? "font-semibold text-white" : "text-ink dark:text-night-text"}>{t("parent.allChildren")}</Text>
        </Pressable>
        {children.data?.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            onPress={() => setChildFilter(child.id)}
            className={`min-h-12 flex-row items-center gap-2 rounded-full py-1 pl-1 pr-4 ${childFilter === child.id ? "bg-teal" : "bg-white dark:bg-night-surface"}`}
          >
            <Avatar slug={child.avatar} size={36} />
            <Text className={childFilter === child.id ? "font-semibold text-white" : "text-ink dark:text-night-text"}>{child.name}</Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-3 rounded-parent bg-white p-4 dark:bg-night-surface">
        <Text className="font-display text-xl text-ink dark:text-night-text">{t("parent.familyDay")}</Text>
        {familyDay.length === 0 ? <Text className="text-gray-500">{t("tasks.addChildFirst")}</Text> : null}
        {familyDay.map(({ child, due, done, stars: childStars }) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            onPress={() => router.push("/parent/tasks")}
            className="flex-row items-center gap-3"
          >
            <Avatar slug={child.avatar} size={44} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink dark:text-night-text">{child.name}</Text>
              <View className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
                <View className="h-2 rounded-full bg-teal" style={{ width: due > 0 ? `${Math.round((done / due) * 100)}%` : "0%" }} />
              </View>
              <Text className="mt-0.5 text-xs text-gray-600">{t("parent.tasksOf", { done, total: due })}</Text>
            </View>
            <Text className="text-base font-bold text-ink dark:text-night-text">⭐ {childStars}</Text>
            <Text className="text-gray-400">›</Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-2 rounded-parent bg-star/15 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xl text-ink">{t("parent.waitingApproval")}</Text>
          <View className="h-7 w-7 items-center justify-center rounded-full bg-star">
            <Text className="font-bold text-ink">{pendingApprovals.length}</Text>
          </View>
        </View>
        {pendingApprovals.length === 0 ? <Text className="text-gray-600">{t("parent.noApprovals")}</Text> : null}
        {pendingApprovals.map((item) => (
          <View key={item.id} className="gap-2 rounded-parent bg-white p-3">
            <View className="flex-row items-center gap-3">
              <TaskIcon slug={item.task_templates?.icon} size={32} />
              <View className="flex-1">
                <Text className="font-semibold text-ink">{item.task_templates?.title}</Text>
                <Text className="text-sm text-gray-600">
                  {item.children?.name} · {t("room.plusStars", { count: item.task_templates?.stars ?? 0 })}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title={t("parent.approve")} loading={review.isPending} onPress={() => review.mutate({ id: item.id, approve: true })} />
              </View>
              <Button variant="ghost" title={t("parent.return")} onPress={() => review.mutate({ id: item.id, approve: false })} />
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2 rounded-parent bg-white p-4 dark:bg-night-surface">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xl text-ink dark:text-night-text">{t("parent.todaysPlan")}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/parent/calendar")}>
            <Text className="font-semibold text-teal-dark">{t("parent.openCalendar")} ›</Text>
          </Pressable>
        </View>
        {todaysPlan.length === 0 ? <Text className="text-gray-500">{t("calendar.noEvents")}</Text> : null}
        {todaysPlan.map((o) => (
          <View key={`${o.event.id}:${o.date}`} className="flex-row items-center gap-3">
            <Text className="w-14 text-sm font-semibold text-teal-dark">
              {o.event.all_day ? t("calendar.allDay") : timeFormat.format(o.startsAt)}
            </Text>
            <View className="flex-1">
              <Text className="text-base text-ink dark:text-night-text">{o.event.title}</Text>
              <Text className="text-xs text-gray-600">{o.event.children?.name ?? t("calendar.allFamily")}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-3 rounded-parent bg-sky-light p-4">
        <Text className="text-2xl">📘</Text>
        <View className="flex-1">
          <Text className="font-semibold text-ink">{t("parent.insightTitle")}</Text>
          <Text className="text-sm text-gray-700">{t("parent.insightWeek", { count: weekApproved })}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/parent/grades")}>
          <Text className="font-semibold text-teal-dark">{t("parent.seeProgress")} ›</Text>
        </Pressable>
      </View>

      <Button title={t("parent.addTaskTogether")} onPress={() => router.push("/parent/tasks")} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.notes")} onPress={() => router.push("/parent/notes")} />
        </View>
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.childMode")} onPress={() => router.push("/parent/child-mode")} />
        </View>
      </View>

      <ErrorText error={children.error ?? templates.error ?? completions.error ?? approvals.error ?? events.error ?? review.error} />
    </Screen>
  );
}
