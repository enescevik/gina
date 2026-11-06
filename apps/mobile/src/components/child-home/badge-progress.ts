import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type BadgeRule =
  | { kind: 'first_task'; target: 1; done: number }
  | { kind: 'task_count'; target: number; done: number }
  | { kind: 'planned_care'; target: number; done: number; icon: string }
  | { kind: 'unknown' };

/**
 * Rozetin anlamı ve çocuğun KENDİ ilerlemesi. Sunucudaki `gina.award_badges_for_child` kuralını okur:
 * yalnız onaylanmış görevler sayılır; başka çocuklarla karşılaştırma yapılmaz. Rozeti yine sunucu verir.
 */
export function useBadgeProgress(childId: string) {
  return useQuery({
    queryKey: ['child_badge_progress', childId],
    enabled: !!childId,
    queryFn: async (): Promise<Map<string, BadgeRule>> => {
      const [defs, done, templates] = await Promise.all([
        supabase.from('badge_definitions').select('slug, rule').eq('active', true),
        supabase.from('task_completions').select('template_id, task_snapshot').eq('child_id', childId).eq('status', 'approved').limit(5000),
        supabase.from('task_templates').select('id, icon').eq('child_id', childId),
      ]);
      if (defs.error) throw defs.error;
      if (done.error) throw done.error;
      if (templates.error) throw templates.error;
      const iconOf = new Map(templates.data.map(x => [x.id, x.icon]));
      const icons = done.data.map(row => {
        const snap = row.task_snapshot as { icon?: unknown } | null;
        return typeof snap?.icon === 'string' ? snap.icon : iconOf.get(row.template_id) ?? '';
      });
      const result = new Map<string, BadgeRule>();
      for (const def of defs.data) {
        const rule = (def.rule ?? {}) as { kind?: string; params?: { count?: number; icon?: string } };
        const count = Number(rule.params?.count);
        if (rule.kind === 'first_task') result.set(def.slug, { kind: 'first_task', target: 1, done: Math.min(1, icons.length) });
        else if (rule.kind === 'task_count' && Number.isFinite(count) && count > 0) result.set(def.slug, { kind: 'task_count', target: count, done: Math.min(count, icons.length) });
        else if (rule.kind === 'planned_care' && Number.isFinite(count) && count > 0 && rule.params?.icon) {
          const icon = rule.params.icon;
          result.set(def.slug, { kind: 'planned_care', target: count, icon, done: Math.min(count, icons.filter(x => x === icon).length) });
        } else result.set(def.slug, { kind: 'unknown' });
      }
      return result;
    },
  });
}
