import * as Crypto from "expo-crypto";
import { invalidateTaskState } from "@/lib/task-cache";
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localDateOf, occurrencesBetween, tasksWithRecordedWork, taskSnapshot, templatesForPlanDay, weekDatesOf, recordedWeek, starTotalsByChild } from '@gina/core';
import { useTranslation } from 'react-i18next';
import { dayLessonOccurrences, useWeekPlans } from '@/components/planner/week-plans';
import { ParentHomeView } from '@/components/parent-home/home-view';
import { useFamilyTimezone } from '@/lib/family';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useFamilyEvents } from '@/lib/use-family-events';

/** Web reports `navigator.onLine` on first load; native updates `onlineManager` from expo-network (app-lifecycle). */
function isOnline() {
  return onlineManager.isOnline() && !(Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false);
}
function subscribeOnline(notify: () => void) {
  const off = onlineManager.subscribe(notify);
  if (Platform.OS !== 'web' || typeof window === 'undefined') return off;
  window.addEventListener('online', notify); window.addEventListener('offline', notify);
  return () => { off(); window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
}
/** A1-13: no second slow attempt while the device is known to be offline; reconnect refetches (refetchOnReconnect). */
const retryOnline = (count: number) => count < 1 && isOnline();

/** Approved mint/violet parent home; existing queries and review RPC remain authoritative. Each card owns its load/error state (U03). */
export default function ParentHomeScreen() {
  const { i18n } = useTranslation();
  const { claims, session } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = useFamilyTimezone();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const today = localDateOf(new Date(now), timeZone);
  const week = weekDatesOf(today);
  const from = week[0] ?? today;
  const to = week[6] ?? today;
  const queryClient = useQueryClient();
  const [childFilter, setChildFilter] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children"],
    retry: retryOnline,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").is("archived_at", null).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const templates = useQuery({
    queryKey: ["family_task_templates", familyId],
    retry: retryOnline,
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, child_id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order")
        .eq("family_id", familyId);
      if (error) throw error;
      return data;
    },
  });

  const completions = useQuery({
    queryKey: ["family_completions", familyId, today],
    retry: retryOnline,
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, child_id, template_id, due_date, status, task_snapshot")
        .eq("family_id", familyId)
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data;
    },
  });

  const stars = useQuery({
    queryKey: ["family_star_totals", familyId],
    retry: retryOnline,
    enabled: !!familyId,
    queryFn: async () => {
      // Q02-3: çocuk başına bakiye sunucuda toplanır; tüm aile defteri çekilmez. Görünüm aynı (yok → 0).
      const { data, error } = await supabase.rpc("family_star_balances");
      if (error) throw error;
      return starTotalsByChild(data);
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals", familyId],
    retry: retryOnline,
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, completed_at, due_date, child_id, task_snapshot, task_templates(title, icon, stars), children!task_completions_child_id_fkey(name)")
        .eq("family_id", familyId)
        .eq("status", "done")
        .order("completed_at");
      if (error) throw error;
      return data.map(row => ({...row, task_templates: taskSnapshot(row.task_snapshot) ?? row.task_templates}));
    },
  });

  const { events, exceptions } = useFamilyEvents();

  // Selamdaki ad: family_members.display_name (oturumdaki veli).
  const userId = session?.user.id ?? "";
  const me = useQuery({
    queryKey: ["family_member_me", userId, familyId],
    enabled: !!userId && !!familyId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_members").select("display_name").eq("user_id", userId).eq("family_id", familyId).maybeSingle();
      if (error) throw error;
      return data?.display_name?.trim() || null;
    },
  });

  useRealtimeInvalidate("task_templates", familyId ? `family_id=eq.${familyId}` : null, [["family_task_templates", familyId], ["plan_for_days", familyId]]);

  useRealtimeInvalidate("task_completions", familyId ? `family_id=eq.${familyId}` : null, [
    ["approvals", familyId],
    ["family_completions", familyId, today],
  ]);

  useRealtimeInvalidate("star_events", familyId ? `family_id=eq.${familyId}` : null, [["family_star_totals", familyId]]);

  const reviewRequests = useRef(new Map<string, string>());
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const row = approvals.data?.find(item => item.id === id);
      if (!row) throw new Error("submission_changed");
      const key = `${id}:${row.completed_at}:${approve}`;
      let requestId = reviewRequests.current.get(key);
      if (!requestId) { requestId = Crypto.randomUUID(); reviewRequests.current.set(key, requestId); }
      const { error } = await supabase.rpc("review_task_once", {
        p_request_id: requestId, p_completion_id: id, p_approve: approve, p_expected_completed_at: row.completed_at,
      });
      if (error) throw error;
    },
    onSettled: () => invalidateTaskState(queryClient),
  });

  // Zil rozeti: Duyurular ekranının ilk sayfasıyla aynı anahtar/şekil (önbellek paylaşılır). Hata rozeti gizler, ekranı kapatmaz.
  const inbox = useQuery({
    queryKey: ["parent_inbox", session?.user.id, claims?.family_id, false, null],
    enabled: !!familyId,
    retry: retryOnline,
    refetchInterval: 60000,
    queryFn: async () => {
      const r = await supabase.rpc("parent_inbox", { p_archived: false });
      if (r.error) throw r.error;
      return r.data as unknown as { unread: number; rows: unknown[] };
    },
  });

  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);

  const parentName = me.data;

  const visibleChildren = (children.data ?? []).filter((c) => !childFilter || c.id === childFilter);
  // C02: today's tasks and the week's lessons come from the same dated contract as the calendar and the
  // child's Today (`plan_for_days`): the routine/timetable version in force that day, never the live row.
  const childIds = (children.data ?? []).map((c) => c.id);
  const weekPlans = useWeekPlans(familyId, childIds, from, to);
  // A planned education change whose day has come is applied on the parent's next open (idempotent on the
  // server; until then every dated read already shows the planned period). Children see the result after.
  const dueChanges = useQuery({
    queryKey: ["apply_due_education_changes", familyId, today, childIds.join(",")],
    enabled: !!familyId && childIds.length > 0,
    staleTime: Infinity,
    retry: retryOnline,
    queryFn: async () => {
      let applied = 0;
      for (const id of childIds) {
        const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: { applied?: boolean } | null; error: Error | null }>)(
          "apply_due_education_changes",
          { p_child_id: id },
        );
        if (error) throw error;
        if (data?.applied) applied++;
      }
      return applied;
    },
  });
  useEffect(() => {
    if (dueChanges.data) {
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      void queryClient.invalidateQueries({ queryKey: ["plan_for_days", familyId] });
      void queryClient.invalidateQueries({ queryKey: ["plan_for_day", familyId] });
    }
  }, [dueChanges.data, queryClient, familyId]);
  const planOf = (childId: string, day: string) => weekPlans[childIds.indexOf(childId)]?.data?.find((p) => p.day === day) ?? null;
  const dayTemplates = (childId: string, day: string) => {
    const plan = planOf(childId, day);
    return plan ? templatesForPlanDay(plan, (templates.data ?? []).filter((t2) => t2.child_id === childId)) : [];
  };
  const familyDay = visibleChildren.map((child) => {
    const dueIds = new Set(tasksWithRecordedWork(dayTemplates(child.id, today), completions.data ?? [], today).map(task => task.id));
    const due = dueIds.size;
    const done = (completions.data ?? []).filter(
      (c) => c.child_id === child.id && c.due_date === today && dueIds.has(c.template_id) && c.status === "approved",
    ).length;
    const pending = (completions.data ?? []).filter(c => c.child_id === child.id && c.due_date === today && dueIds.has(c.template_id) && c.status === "done").length;
    return { child, due, done, pending, stars: stars.data?.get(child.id) ?? 0 };
  });

  const english = i18n.language.startsWith('en');
  const occurrences = [
    ...occurrencesBetween(events.data ?? [], from, to, timeZone, exceptions.data ?? new Set())
      // Timetable-generated rows are replaced by each day's own timetable version below.
      .filter((o) => !(o.event.type === 'school' && o.event.timetable_entry_key)),
    ...weekPlans.flatMap((q) => (q.data ?? []).flatMap((plan) => dayLessonOccurrences(plan, timeZone, english))),
  ].filter(
    (o) => !childFilter || o.event.child_id === null || o.event.child_id === childFilter,
  ).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const upcoming = occurrencesBetween(events.data ?? [], today, to, timeZone, exceptions.data ?? new Set())
    .filter(o => o.event.type === 'exam' && (!childFilter || o.event.child_id === null || o.event.child_id === childFilter) && (o.endsAt ?? o.startsAt).getTime() >= now)
    .sort((a,b) => a.startsAt.getTime()-b.startsAt.getTime())[0];

  const weeklyCounts = recordedWeek(completions.data ?? [], visibleChildren.map(c => c.id), from, today);

  const pendingApprovals = (approvals.data ?? []).filter((a) => visibleChildren.some(child => child.id === a.child_id));

  const dailyTasks = visibleChildren.flatMap(child => tasksWithRecordedWork(dayTemplates(child.id, today), completions.data ?? [], today).map(task => ({
    id: task.id, title: task.title, icon: task.icon, childId: child.id, childName: child.name,
    status: completions.data?.find(completion => completion.template_id === task.id && completion.child_id === child.id && completion.due_date === today)?.status ?? 'planned',
  })));

  const section = (queries: { isLoading: boolean; error: unknown; refetch: () => unknown }[]) => ({
    loading: queries.some(q => q.isLoading),
    error: queries.find(q => q.error)?.error ?? null,
    retry: () => { for (const q of queries) void q.refetch(); },
  });
  return <ParentHomeView
    profiles={children.data ?? []} selected={childFilter} select={setChildFilter}
    today={today} week={week} parentName={parentName} timeZone={timeZone}
    weeklyCounts={weeklyCounts}
    familyDay={familyDay} tasks={dailyTasks} approvals={pendingApprovals}
    review={(id,approve)=>review.mutate({id,approve})} reviewing={review.isPending} reviewingId={review.variables?.id} reviewError={review.error}
    occurrences={occurrences} upcoming={upcoming}
    unread={inbox.data?.unread ?? 0} online={online}
    // Yalnız çocuk listesi bütün ekranı belirler; diğer sorgular kendi kartında yüklenir ve hata verir.
    loading={children.isLoading}
    error={children.error}
    retry={()=>{void children.refetch();void me.refetch();void inbox.refetch();}}
    sections={{
      approvals: section([approvals]),
      tasks: section([templates, completions, ...weekPlans]),
      progress: section([templates, completions, stars, ...weekPlans]),
      plan: section([events, exceptions, ...weekPlans]),
    }}
  />;
}
