import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

import { localDateOf, starBalance, templatesDueOn, weekDatesOf, type CompletionStatus } from "@gina/core";

import { useFamilyTimezone } from "./family";
import { useRealtimeInvalidate } from "./realtime";
import { supabase } from "./supabase";

export interface ChildTodayData {
  today: string;
  week: string[];
  /** Bugün düşen şablonlar (sıralı). */
  due: {
    id: string;
    title: string;
    icon: string;
    stars: number;
    status: CompletionStatus | null;
    completionId: string | null;
  }[];
  /** Hafta günleri → o gün düşen görev sayısı ve biten (done+approved) sayısı. */
  weekSummary: { date: string; due: number; done: number }[];
  stars: number;
  todayDone: number;
  todayStarsEarned: number;
  loading: boolean;
  error: unknown;
  complete: (templateId: string) => void;
  completing: boolean;
}

/**
 * Çocuğun gün/hafta verisi: tablet (cihaz claim'i) ve veli telefonunda çocuk modu ortak kullanır.
 * complete_task done/approved sözleşmesini korur; yıldız istemcide yazılmaz.
 */
export function useChildToday(childId: string, actingAsParent = false): ChildTodayData {
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const week = weekDatesOf(today);
  const from = week[0] ?? today;
  const to = week[6] ?? today;
  const queryClient = useQueryClient();

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
        .select("id, template_id, due_date, status")
        .eq("child_id", childId)
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data;
    },
  });

  const starEvents = useQuery({
    queryKey: ["star_events", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("star_events")
        .select("delta, created_at")
        .eq("child_id", childId);
      if (error) throw error;
      return data;
    },
  });

  useRealtimeInvalidate("task_completions", childId ? `child_id=eq.${childId}` : null, [["task_completions_week", childId, from]]);
  useRealtimeInvalidate("star_events", childId ? `child_id=eq.${childId}` : null, [["star_events", childId]]);
  useRealtimeInvalidate("task_templates", childId ? `child_id=eq.${childId}` : null, [["task_templates", childId]]);

  const complete = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc("complete_task", {
        p_template_id: templateId,
        p_due_date: today,
        p_client_id: Crypto.randomUUID(),
        ...(actingAsParent ? { p_acting_child_id: childId } : {}),
      });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["task_completions_week", childId, from] }),
  });

  const byTemplateToday = new Map(
    (completions.data ?? []).filter((c) => c.due_date === today).map((c) => [c.template_id, c]),
  );
  const due = templatesDueOn(templates.data ?? [], today).map((t) => {
    const completion = byTemplateToday.get(t.id);
    return {
      id: t.id,
      title: t.title,
      icon: t.icon,
      stars: t.stars,
      status: (completion?.status ?? null) as CompletionStatus | null,
      completionId: completion?.id ?? null,
    };
  });

  const weekSummary = week.map((date) => {
    const dueCount = templatesDueOn(templates.data ?? [], date).length;
    const doneCount = (completions.data ?? []).filter(
      (c) => c.due_date === date && (c.status === "done" || c.status === "approved"),
    ).length;
    return { date, due: dueCount, done: doneCount };
  });

  const todayStarsEarned = (starEvents.data ?? [])
    .filter((e) => localDateOf(new Date(e.created_at), timeZone) === today)
    .reduce((sum, e) => sum + e.delta, 0);

  return {
    today,
    week,
    due,
    weekSummary,
    stars: starBalance(starEvents.data ?? []),
    todayDone: due.filter((t) => t.status === "done" || t.status === "approved").length,
    todayStarsEarned,
    loading: templates.isPending || completions.isPending,
    error: templates.error ?? completions.error ?? starEvents.error ?? complete.error,
    complete: (templateId) => complete.mutate(templateId),
    completing: complete.isPending,
  };
}
