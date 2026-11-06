import { useQuery } from '@tanstack/react-query';
import { Backpack, BookOpen, CheckCircle2, Circle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { schoolBagSourceSchema } from '@gina/core';
import { c, s } from '@/components/child-home/theme';
import { useLearningPlan } from '@/components/planner/learning-plan';
import { Pressable } from '@/components/ui/pressable';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Calendar date + n days (YYYY-MM-DD, timezone-free arithmetic). */
export function shiftDay(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Open homework/study items planned up to today (read-only for the child's next step). */
export function useChildHomework(childId: string, today: string) {
  const plan = useLearningPlan(childId, shiftDay(today, -7), today);
  const items = (plan.data?.items ?? [])
    .filter(row => !row.content.done && !row.content.archived && row.content.planned_on <= today)
    .sort((a, b) => (a.content.due_on ?? '9999').localeCompare(b.content.due_on ?? '9999') || a.content.planned_on.localeCompare(b.content.planned_on));
  return { items, loading: plan.isPending, error: plan.error };
}

export function HomeworkNext({ item, onOpen, compact }: {
  item: { content: { title: string; subject: string; kind: string; due_on: string | null; steps: { checked: boolean }[] } };
  onOpen: () => void; compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const due = item.content.due_on ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${item.content.due_on}T00:00:00Z`)) : null;
  const steps = item.content.steps.length;
  const checked = item.content.steps.filter(x => x.checked).length;
  return <View style={s.card} testID="child-next-homework">
    <View style={s.row}>
      <View style={[s.taskArt, { width: compact ? 56 : 64, height: compact ? 56 : 64, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEAFE' }]}><BookOpen size={compact ? 28 : 32} color={c.purple} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.small}>{t(item.content.kind === 'homework' ? 'childMint.homeworkKind' : 'childMint.studyKind')}{item.content.subject ? ` · ${item.content.subject}` : ''}</Text>
        <Text style={[s.heading, { fontSize: 19 }]}>{item.content.title}</Text>
        {due ? <Text style={s.small}>{t('childMint.homeworkDue', { date: due })}</Text> : null}
        {steps ? <Text style={s.small}>{t('childMint.homeworkSteps', { done: checked, total: steps })}</Text> : null}
      </View>
    </View>
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [s.button, pressed && s.pressed]}>
      <Text style={s.buttonText}>{t('childMint.homeworkAction')}</Text>
    </Pressable>
  </View>;
}

/** Today / tomorrow school bag, shown only when the family has a list or a timetable for that day. */
export function BagGlance({ childId, today, onOpen }: { childId: string; today: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const [which, setWhich] = useState<'today' | 'tomorrow'>('today');
  const days = { today, tomorrow: shiftDay(today, 1) };
  const query = (day: string) => ({
    queryKey: ['school_bag', claims?.family_id, childId, day],
    enabled: !!childId && !!claims?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_school_bag', { p_child_id: childId, p_day: day });
      if (error) throw error;
      return schoolBagSourceSchema.parse(data);
    },
  });
  const todayBag = useQuery(query(days.today));
  const tomorrowBag = useQuery(query(days.tomorrow));
  const bags = { today: todayBag, tomorrow: tomorrowBag };
  const hasAny = [todayBag, tomorrowBag].some(q => (q.data?.items.length ?? 0) > 0 || (q.data?.lessons.length ?? 0) > 0);
  const anyError = todayBag.error && tomorrowBag.error;
  // Veri yoksa yer kaplamaz: çocuğa boş bir “çanta” görevi göstermeyiz.
  if (!hasAny && !anyError) return null;
  const current = bags[which];
  const items = current.data?.items ?? [];
  const ready = items.filter(x => x.checked).length;
  return <View style={[s.section, s.divider]} testID="child-bag-glance">
    <View style={s.row}><Backpack size={22} color={c.purple} /><Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>{t('childMint.bagTitle')}</Text></View>
    <View accessibilityRole="tablist" style={[s.row, { gap: 8 }]}>
      {(['today', 'tomorrow'] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: which === key }} aria-selected={which === key} onPress={() => setWhich(key)} style={[s.chip, { flex: 1 }, which === key && { backgroundColor: c.purple, borderColor: c.purple }]}>
        <Text style={[s.small, { color: which === key ? c.white : c.ink }]}>{t(key === 'today' ? 'childMint.bagToday' : 'childMint.bagTomorrow')}</Text>
      </Pressable>)}
    </View>
    {current.isPending ? <ActivityIndicator color={c.purple} /> : current.error ? <Text style={s.text}>{t('childMint.bagError')}</Text> : <View style={[s.card, { gap: 8 }]}>
      {current.data && current.data.lessons.length > 0 ? <Text style={s.small}>{t('childMint.bagLessons', { count: current.data.lessons.length, names: current.data.lessons.slice(0, 4).map(l => l.title).join(', ') })}</Text> : null}
      {items.length ? <>
        <Text style={[s.small, { color: c.ink }]}>{t('schoolBag.count', { ready, total: items.length })}</Text>
        {items.slice(0, 6).map(item => <View key={item.id} style={s.row} accessible accessibilityLabel={`${item.label}: ${item.checked ? t('childMint.bagPacked') : t('childMint.bagNotPacked')}`}>
          {item.checked ? <CheckCircle2 size={20} color="#128772" /> : <Circle size={20} color={c.muted} />}
          <Text style={[s.text, { flex: 1 }]}>{item.label}</Text>
        </View>)}
        {items.length > 6 ? <Text style={s.small}>{t('childMint.bagMore', { count: items.length - 6 })}</Text> : null}
      </> : <Text style={s.text}>{t('childMint.bagEmpty')}</Text>}
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [s.chip, pressed && s.pressed]}><Text style={[s.small, { color: c.purple }]}>{t('childMint.bagOpen')}</Text></Pressable>
    </View>}
  </View>;
}
