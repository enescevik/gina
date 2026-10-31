import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { localDateOf, occurrencesBetween, templatesDueOn, weekDatesOf } from "@gina/core";


import { Avatar } from "@/components/avatar";
import { DayTimeline } from "@/components/calendar/day-timeline";
import type { WeekEvent } from "@/components/calendar/week-list";
import { NineSlice, SkinPressable } from "@/components/room/nine-slice";
import { TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, ChildPicker, EmptyCard } from "@/components/ui/parent-screen";
import { Collectible } from "@/components/collectible";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useFamilyEvents } from "@/lib/use-family-events";

/** Aile saat dilimindeki saate göre selam anahtarı (05–11 sabah, 12–17 gün, diğer akşam). */
function greetingKey(timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "day";
  return "evening";
}

interface WeeklyHighlight {
  childId: string;
  templateId: string;
  days: number;
}

/**
 * «Küçük adımlar birikiyor» içgörüsü (yapay zekâ yok, deterministik): bu hafta aynı görevi en çok farklı günde
 * tamamlayan (yapıldı/onaylandı) çocuk + görev. Eşitlikte çocuk ve görev sırası (sort_order) belirler.
 * En az 2 gün yoksa null (genel haftalık sayı gösterilir).
 */
function weeklyHighlight(
  completions: readonly { child_id: string; template_id: string; due_date: string; status: string }[],
  childOrder: readonly string[],
  templateOrder: ReadonlyMap<string, number>,
): WeeklyHighlight | null {
  const days = new Map<string, Set<string>>();
  for (const c of completions) {
    if (c.status !== "done" && c.status !== "approved") continue;
    const key = `${c.child_id}|${c.template_id}`;
    const set = days.get(key) ?? new Set<string>();
    set.add(c.due_date);
    days.set(key, set);
  }
  let best: WeeklyHighlight | null = null;
  const rank = (h: WeeklyHighlight) => [-h.days, childOrder.indexOf(h.childId), templateOrder.get(h.templateId) ?? 0, h.templateId] as const;
  for (const [key, set] of days) {
    const [childId = "", templateId = ""] = key.split("|");
    const candidate = { childId, templateId, days: set.size };
    if (!best) {
      best = candidate;
      continue;
    }
    const a = rank(candidate);
    const b = rank(best);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if ((a[i] as number | string) < (b[i] as number | string)) best = candidate;
      break;
    }
  }
  return best && best.days >= 2 ? best : null;
}

/** Veli ana sayfası (onaylı tasarım, resim 2): ailenin günü, onay kuyruğu, bugünün planı, içgörü. */
export default function ParentHomeScreen() {
  const { t, i18n } = useTranslation();
  const { claims, session } = useSession();
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
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
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
        .select("id, child_id, title, icon, days_of_week, starts_on, ends_on, active, sort_order")
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

  const { events, exceptions } = useFamilyEvents();

  // Selamdaki ad: family_members.display_name (oturumdaki veli).
  const userId = session?.user.id ?? "";
  const me = useQuery({
    queryKey: ["family_member_me", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_members").select("display_name").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data?.display_name?.trim() || null;
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
  const greeting = greetingKey(timeZone);
  const parentName = me.data;

  const visibleChildren = (children.data ?? []).filter((c) => !childFilter || c.id === childFilter);
  const familyDay = visibleChildren.map((child) => {
    const dueIds = new Set(templatesDueOn((templates.data ?? []).filter((t2) => t2.child_id === child.id), today).map(task => task.id));
    const due = dueIds.size;
    const done = (completions.data ?? []).filter(
      (c) => c.child_id === child.id && c.due_date === today && dueIds.has(c.template_id) && (c.status === "done" || c.status === "approved"),
    ).length;
    return { child, due, done, stars: stars.data?.get(child.id) ?? 0 };
  });

  const todaysPlan = occurrencesBetween(events.data ?? [], today, today, timeZone, exceptions.data ?? new Set()).filter(
    (o) => !childFilter || o.event.child_id === null || o.event.child_id === childFilter,
  );
  // Çocuğa bağlı olmayan etkinlik tüm çocuklarındır: «Ece ve Can»; tek çocukta adı, hiç yoksa «Tüm aile».
  const allChildNames = (children.data ?? []).map((c) => c.name);
  const whoOf = (event: WeekEvent) => {
    if (event.childName) return event.childName;
    if (allChildNames.length === 0) return t("calendar.allFamily");
    if (allChildNames.length === 1) return allChildNames[0] ?? "";
    return t("parent.namesAnd", { names: allChildNames.slice(0, -1).join(", "), last: allChildNames[allChildNames.length - 1] });
  };

  // İçgörü: bu haftanın gerçek tamamlamalarından deterministik öne çıkan (filtreye uyar); yoksa haftalık onay sayısı.
  const weekCompletions = (completions.data ?? []).filter((c) => !childFilter || c.child_id === childFilter);
  const weekApproved = weekCompletions.filter((c) => c.status === "approved").length;
  const templateById = new Map((templates.data ?? []).map((tt) => [tt.id, tt]));
  const highlight = weeklyHighlight(
    weekCompletions,
    (children.data ?? []).map((c) => c.id),
    new Map((templates.data ?? []).map((tt) => [tt.id, tt.sort_order])),
  );
  const highlightTemplate = highlight ? templateById.get(highlight.templateId) : undefined;
  const highlightChild = highlight ? children.data?.find((c) => c.id === highlight.childId) : undefined;

  const pendingApprovals = (approvals.data ?? []).filter((a) => !childFilter || a.child_id === childFilter);

  // Odam kaplamaları: beyaz ana kartlar parent-card, onay alanı parent-approval-card (eski düz kart zeminleri kaldırıldı).
  // Kaplamalar açık renklidir; koyu temada da içlerindeki metin ink kalır (okunur kontrast).
  return (
    <Screen home title={parentName ? t(`parent.greeting.${greeting}`, { name: parentName }) : t(`parent.greeting.${greeting}NoName`)}
      subtitle={dateFormat.format(new Date(`${today}T12:00:00Z`))}
      loading={children.isLoading || templates.isLoading || approvals.isLoading}
      error={children.error ?? templates.error ?? completions.error ?? approvals.error ?? events.error ?? me.error}
      onRetry={() => { void children.refetch(); void templates.refetch(); void approvals.refetch(); void completions.refetch(); void events.refetch(); void me.refetch(); }}>
      <ChildPicker profiles={children.data ?? []} selected={childFilter} onSelect={setChildFilter} allLabel={t("parent.allChildren")} />

      <NineSlice skin="parent-card" contentStyle={{ gap: 10 }}>
        <Text accessibilityRole="header" className="font-display text-[26px] leading-9 text-ink">
          {t("parent.familyDay")}
        </Text>
        {children.data?.length === 0 ? <EmptyCard title={t("release.firstChildTitle")} body={t("release.firstChildBody")}><Button title={t("release.firstChildAction")} onPress={() => router.push("/parent/menu")} /></EmptyCard> : null}
        {familyDay.map(({ child, due, done, stars: childStars }) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityLabel={`${child.name}, ${t("parent.tasksOf", { done, total: due })}, ${t("room.starCount", { count: childStars })}`}
            onPress={() => router.push("/parent/tasks")}
            className="min-h-16 flex-row items-center gap-2 rounded-2xl border border-mist bg-white px-2 py-2 active:bg-cream"
          >
            <Avatar slug={child.avatar} size={44} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <Text style={{ flexShrink: 1 }} className="font-display-semi text-lg text-ink">{child.name}</Text>
                <View className="flex-row items-center gap-1"><Collectible slug="star-filled" size={20} /><Text className="font-body-bold text-sm text-ink">{t("room.starCount", { count: childStars })}</Text></View>
              </View>
              <Text className="font-body text-sm text-ink">{t("parent.tasksOf", { done, total: due })}</Text>
              <View className="h-2.5 overflow-hidden rounded-full bg-mist">
                <View className="h-2.5 rounded-full bg-teal" style={{ width: due > 0 ? `${Math.min(100, Math.round((done / due) * 100))}%` : "0%" }} />
              </View>
            </View>
            <Text className="font-display text-xl text-ink/60">›</Text>
          </Pressable>
        ))}
      </NineSlice>

      <NineSlice skin="parent-approval-card" contentStyle={{ gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" className="flex-1 font-display text-[26px] leading-9 text-ink">
            {t("parent.waitingApproval")}
          </Text>
          <View className="h-10 min-w-10 items-center justify-center rounded-full bg-star px-2">
            <Text className="font-display text-lg text-white">{pendingApprovals.length}</Text>
          </View>
        </View>
        {pendingApprovals.length === 0 ? <Text className="font-body text-gray-600">{t("parent.noApprovals")}</Text> : null}
        {pendingApprovals.map(item => <View key={item.id} className="gap-3 rounded-2xl bg-white p-3">
          <View className="flex-row items-center gap-3">
            <TaskIcon slug={item.task_templates?.icon} size={56} variant="illustrated" />
            <View className="flex-1 gap-1"><Text className="font-body-bold text-lg text-ink">{item.task_templates?.title}</Text>
            <Text className="font-body text-sm text-gray-600">{item.children?.name} · {t("room.plusStars", { count: item.task_templates?.stars ?? 0 })}</Text></View>
          </View>
          <View className="flex-row gap-2"><View className="flex-1"><Button variant="ghost" title={t("parent.return")} disabled={review.isPending} onPress={() => review.mutate({ id: item.id, approve: false })} /></View>
          <View className="flex-1"><Button title={t("parent.approve")} loading={review.isPending && review.variables?.id === item.id} disabled={review.isPending} onPress={() => review.mutate({ id: item.id, approve: true })} /></View></View>
        </View>)}
      </NineSlice>

      <NineSlice skin="parent-card" contentStyle={{ gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" className="flex-1 font-display text-[26px] leading-9 text-ink">
            {t("parent.todaysPlan")}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/parent/calendar")} hitSlop={8} className="min-h-12 justify-center">
            <Text className="font-body-bold text-base text-teal-dark">{t("parent.openCalendar")} ›</Text>
          </Pressable>
        </View>
        {todaysPlan.length === 0 ? <Text className="font-body text-gray-500">{t("calendar.noEvents")}</Text> : null}
        <DayTimeline occurrences={todaysPlan} timeZone={timeZone} whoOf={whoOf} />
      </NineSlice>

      {/* Approved insight skin, with native copy and the actual weekly highlight. */}
      <SkinPressable skin="parent-insight-card"
        accessibilityRole="link"
        onPress={() => router.push("/parent/prova/progress")}
        contentClassName="flex-row items-center gap-3"
      >
        {highlightTemplate ? (
          <TaskIcon slug={highlightTemplate.icon} size={56} variant="illustrated" />
        ) : (
          <Collectible slug="display-bookworm" size={64} />
        )}
        <View className="flex-1">
          <Text className="font-display text-base leading-6 text-ink">{t("parent.insightTitle")}</Text>
          <Text className="font-body text-sm text-gray-700">
            {highlight && highlightTemplate && highlightChild
              ? t("parent.insightHighlight", { child: highlightChild.name, count: highlight.days, task: highlightTemplate.title })
              : t("parent.insightWeek", { count: weekApproved })}
          </Text>
        </View>
        <Text className="font-body-bold text-sm text-teal-dark">{t("parent.seeProgress")} ›</Text>
      </SkinPressable>

      <SkinPressable skin="parent-card" onPress={() => router.push("/parent/prova")} contentClassName="flex-row items-center gap-3">
        <Collectible slug="display-bookworm" size={56} />
        <View className="flex-1">
          <Text className="font-display text-xl text-ink">{t("prova.title")}</Text>
          <Text className="font-body text-sm text-gray-700">{t("prova.parentCard")}</Text>
        </View>
        <Text className="font-display text-xl text-teal-dark">›</Text>
      </SkinPressable>

      <SkinPressable skin="button-outline" pressedSkin="button-outline-pressed" onPress={() => router.push("/parent/tasks")}
        contentClassName="items-center justify-center">
        <Text className="font-body-bold text-lg text-teal-dark">{t("parent.addTaskTogether")}</Text>
      </SkinPressable>
      <View className="flex-row flex-wrap gap-2">
        <View className="min-w-[45%] flex-1">
          <Button variant="secondary" title={t("parent.rewards")} onPress={() => router.push("/parent/rewards")} />
        </View>
        <View className="min-w-[45%] flex-1">
          <Button variant="secondary" title={t("parent.notes")} onPress={() => router.push("/parent/notes")} />
        </View>
        <View className="w-full">
          <Button variant="secondary" title={t("parent.childMode")} onPress={() => router.push("/parent/child-mode")} />
        </View>
      </View>

      <ErrorText error={review.error} />
    </Screen>
  );
}
