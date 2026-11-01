import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localDateOf, occurrencesBetween, templatesDueOn, weekDatesOf } from '@gina/core';
import { ParentHomeView } from '@/components/parent-home/home-view';
import { useFamilyTimezone } from '@/lib/family';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useFamilyEvents } from '@/lib/use-family-events';

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

/** Approved mint/violet parent home; existing queries and review RPC remain authoritative. */
export default function ParentHomeScreen() {
  const { t } = useTranslation();
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

  useRealtimeInvalidate("star_events", familyId ? `family_id=eq.${familyId}` : null, [["family_star_totals", familyId]]);

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_task", { p_completion_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSettled: () =>
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family_star_totals", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family_completions", familyId, today] }),
      ]),
  });

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

  const occurrences = occurrencesBetween(events.data ?? [], from, to, timeZone, exceptions.data ?? new Set()).filter(
    (o) => !childFilter || o.event.child_id === null || o.event.child_id === childFilter,
  );
  const upcoming = occurrencesBetween(events.data ?? [], today, to, timeZone, exceptions.data ?? new Set())
    .filter(o => o.event.type === 'exam' && (!childFilter || o.event.child_id === null || o.event.child_id === childFilter) && (o.endsAt ?? o.startsAt).getTime() >= now)
    .sort((a,b) => a.startsAt.getTime()-b.startsAt.getTime())[0];

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

  const dailyTasks = visibleChildren.flatMap(child => templatesDueOn((templates.data ?? []).filter(template => template.child_id === child.id), today).map(task => ({
    id: task.id, title: task.title, icon: task.icon, childName: child.name,
    status: completions.data?.find(completion => completion.template_id === task.id && completion.child_id === child.id && completion.due_date === today)?.status ?? 'planned',
  })));
  return <ParentHomeView
    profiles={children.data ?? []} selected={childFilter} select={setChildFilter}
    today={today} week={week} parentName={parentName} timeZone={timeZone}
    summary={highlight && highlightTemplate && highlightChild ? t('parent.insightHighlight',{child:highlightChild.name,count:highlight.days,task:highlightTemplate.title}) : t('parent.insightWeek',{count:weekApproved})}
    weeklyCount={weekCompletions.filter(c=>c.status==='done'||c.status==='approved').length}
    familyDay={familyDay} tasks={dailyTasks} approvals={pendingApprovals}
    review={(id,approve)=>review.mutate({id,approve})} reviewing={review.isPending} reviewingId={review.variables?.id} reviewError={review.error}
    occurrences={occurrences} upcoming={upcoming}
    loading={children.isLoading || templates.isLoading || approvals.isLoading || completions.isLoading || events.isLoading || exceptions.isLoading || stars.isLoading}
    error={children.error ?? templates.error ?? completions.error ?? approvals.error ?? events.error ?? exceptions.error ?? stars.error ?? me.error}
    retry={()=>{void children.refetch();void templates.refetch();void approvals.refetch();void completions.refetch();void events.refetch();void exceptions.refetch();void stars.refetch();void me.refetch();}}
  />;
}
