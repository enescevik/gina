import { useRef } from "react";
import { invalidateTaskState } from "./task-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

import { readChildStarBalance, tasksWithRecordedWork, weekDatesOf, localDateOf, type CompletionStatus } from "@gina/core";

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
    available: boolean;
  }[];
  /** Hafta günleri → o gün düşen görev sayısı ve biten (done+approved) sayısı. */
  weekSummary: { date: string; due: number; done: number }[];
  stars: number;
  todayDone: number;
  todayStarsEarned: number;
  loading: boolean;
  error: unknown;
  completionError: unknown;
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
        .select("id, template_id, due_date, status, task_snapshot")
        .eq("child_id", childId)
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data;
    },
  });

  // Q02-3: bakiye ve bugünkü hareket sunucuda toplanır (tüm defter çekilmez). Anahtar "star_events" ile
  // başlar: mevcut realtime/yenileme anahtarları (["star_events", childId]) önek eşleşmesiyle geçerli kalır.
  const starEvents = useQuery({
    queryKey: ["star_events", childId, today],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("child_star_balance", { p_child_id: childId, p_day: today });
      if (error) throw error;
      return readChildStarBalance(data);
    },
  });

  useRealtimeInvalidate("task_completions", childId ? `child_id=eq.${childId}` : null, [["task_completions_week", childId, from]]);
  useRealtimeInvalidate("star_events", childId ? `child_id=eq.${childId}` : null, [["star_events", childId]]);
  useRealtimeInvalidate("task_templates", childId ? `child_id=eq.${childId}` : null, [["task_templates", childId]]);
  useRealtimeInvalidate("task_routine_sync", childId ? `child_id=eq.${childId}` : null, [["task_routine_sync", childId]]);

  const requestIds = useRef(new Map<string, string>());
  const completingRef = useRef(false);
  const complete = useMutation({
    mutationFn: async (templateId: string) => {
      const requestKey = `${childId}:${templateId}:${today}`;
      let requestId = requestIds.current.get(requestKey);
      if (!requestId) { requestId = Crypto.randomUUID(); requestIds.current.set(requestKey, requestId); }
      const { error } = await supabase.rpc("complete_task", {
        p_template_id: templateId,
        p_due_date: today,
        p_client_id: requestId,
        ...(actingAsParent ? { p_acting_child_id: childId } : {}),
      });
      if (error) throw error;
      requestIds.current.delete(requestKey);
    },
    onSettled: async () => { completingRef.current = false; await invalidateTaskState(queryClient); },
  });

  const byTemplateToday = new Map(
    (completions.data ?? []).filter((c) => c.due_date === today).map((c) => [c.template_id, c]),
  );
  const due = tasksWithRecordedWork(templates.data ?? [], completions.data ?? [], today).map((t) => {
    const completion = byTemplateToday.get(t.id);
    return {
      id: t.id,
      available: t.available,
      title: t.title,
      icon: t.icon,
      stars: t.stars,
      status: (completion?.status ?? null) as CompletionStatus | null,
      completionId: completion?.id ?? null,
    };
  });

  const weekSummary = week.map((date) => {
    const dueCount = tasksWithRecordedWork(templates.data ?? [], completions.data ?? [], date).length;
    const doneCount = (completions.data ?? []).filter(
      (c) => c.due_date === date && (c.status === "done" || c.status === "approved"),
    ).length;
    return { date, due: dueCount, done: doneCount };
  });

  const todayStarsEarned = starEvents.data?.todayDelta ?? 0;

  return {
    today,
    week,
    due,
    weekSummary,
    stars: starEvents.data?.balance ?? 0,
    todayDone: due.filter((t) => t.status === "done" || t.status === "approved").length,
    todayStarsEarned,
    loading: templates.isPending || completions.isPending,
    error: templates.error ?? completions.error ?? starEvents.error,
    completionError: complete.error,
    complete: (templateId) => { if (completingRef.current) return; completingRef.current = true; complete.mutate(templateId); },
    completing: complete.isPending,
  };
}
