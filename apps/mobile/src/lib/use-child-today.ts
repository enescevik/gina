import { useRef } from "react";
import { invalidateTaskState } from "./task-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

import {
  dayPlansSchema,
  pausedHoliday,
  readChildStarBalance,
  tasksWithRecordedWork,
  templatesForPlanDay,
  weekDatesOf,
  localDateOf,
  readReturnReason,
  type CompletionStatus,
  type TaskReturnReason,
  type DayPlan,
  type DayPlanHoliday,
} from "@gina/core";

import { useFamilyTimezone } from "./family";
import { useSession } from "./session";
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
    /** C03: geri gönderme nedeni (yalnız geri gönderilmiş gönderimde). */
    returned?: { reason: TaskReturnReason; note: string | null } | null;
  }[];
  /** Hafta günleri → o gün düşen görev sayısı ve biten (done+approved) sayısı. */
  weekSummary: { date: string; due: number; done: number }[];
  stars: number;
  /** C12: holiday the parent accepted for today (lessons paused); null otherwise. */
  holiday: DayPlanHoliday | null;
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

  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  // C02: the week comes from the same dated contract as the calendar (`plan_for_days`): each day counts
  // the routine version in force that day, so a change planned for a later day never shows up early.
  const plans = useQuery({
    queryKey: ["plan_for_days", familyId, childId, from, to],
    enabled: !!childId && !!familyId,
    queryFn: async (): Promise<DayPlan[]> => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)(
        "plan_for_days",
        { p_child_id: childId, p_from: from, p_to: to },
      );
      if (error) throw error;
      return dayPlansSchema.parse(data);
    },
  });
  const planOf = (date: string) => plans.data?.find((p) => p.day === date) ?? null;

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
        .select("id, template_id, due_date, status, task_snapshot, return_reason, return_note")
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
  useRealtimeInvalidate("task_templates", childId ? `child_id=eq.${childId}` : null, [["task_templates", childId], ["plan_for_days", familyId, childId]]);
  useRealtimeInvalidate("task_routine_sync", childId ? `child_id=eq.${childId}` : null, [["task_routine_sync", childId], ["plan_for_days", familyId, childId]]);

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
  // Until the dated plan arrives nothing is shown as due (no fallback to the live row, which may already
  // carry a later-dated change).
  const dayTemplates = (date: string) => {
    const plan = planOf(date);
    return plan ? templatesForPlanDay(plan, templates.data ?? []) : [];
  };
  const due = tasksWithRecordedWork(dayTemplates(today), completions.data ?? [], today).map((t) => {
    const completion = byTemplateToday.get(t.id);
    return {
      id: t.id,
      available: t.available,
      title: t.title,
      icon: t.icon,
      stars: t.stars,
      status: (completion?.status ?? null) as CompletionStatus | null,
      completionId: completion?.id ?? null,
      returned: completion?.status === "returned" ? readReturnReason(completion) : null,
    };
  });

  const weekSummary = week.map((date) => {
    const dueCount = tasksWithRecordedWork(dayTemplates(date), completions.data ?? [], date).length;
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
    holiday: pausedHoliday(planOf(today)),
    todayDone: due.filter((t) => t.status === "done" || t.status === "approved").length,
    todayStarsEarned,
    loading: templates.isPending || completions.isPending || plans.isPending,
    error: plans.error ?? templates.error ?? completions.error ?? starEvents.error,
    completionError: complete.error,
    complete: (templateId) => { if (completingRef.current) return; completingRef.current = true; complete.mutate(templateId); },
    completing: complete.isPending,
  };
}
