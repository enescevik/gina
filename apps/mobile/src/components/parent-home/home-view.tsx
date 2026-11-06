import { useEffect, useState, type ReactNode } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarDays, Check, ChevronRight, Circle, Clock3, GraduationCap, Home, LockKeyhole, MoreHorizontal, Plus, RotateCcw, Star, Users, CircleAlert, FileText, WifiOff } from 'lucide-react-native';
import { reviewErrorKey, type Occurrence, type TaskReturnReason } from '@gina/core';
import { ReturnReasonSheet } from '@/components/tasks/return-reason-sheet';
import type { WeekEvent } from '@/components/calendar/week-list';
import { Pressable } from '@/components/ui/pressable';
import { Avatar } from '@/components/avatar';
import { TaskIcon } from '@/components/task-icon';
import { EventIcon } from '@/components/event-icon';
import { SubjectIcon } from '@/components/subject-icon';
import { Collectible } from '@/components/collectible';
import { SatinButton, IconButton } from '@/components/planner/ui';
import { useChildGoal } from '@/lib/use-child-goal';
import { colors as c, styles as s } from './theme';
import { FamilyWeekReview } from './family-week-review';

const logo = require('../../../../../packages/assets/brand/growing-friend/logo.png');
const mascot = require('../../../../../packages/assets/brand/growing-friend/contextual/family.png');
type Child = { id: string; name: string; grade: number | null; avatar: string | null };
type ReturnInfo = { reason: TaskReturnReason; note: string | null } | null;
type Approval = { id: string; child_id: string; previous?: ReturnInfo; task_templates: { title: string; icon: string; stars: number } | null; children: { name: string } | null };
type Task = { id: string; title: string; icon: string; childId: string; childName: string; status: string; returned?: ReturnInfo };
/** One card's own query state: a failing query closes only its card (U03). */
export type SectionState = { loading: boolean; error: unknown; retry: () => void };
export interface HomeViewProps {
  profiles: Child[]; selected: string | null; select: (id: string | null) => void;
  today: string; week: string[]; parentName: string | null | undefined; timeZone: string;
  weeklyCounts: { approved: number; pending: number; returned: number };
  familyDay: { child: Child; due: number; done: number; pending: number; stars: number }[];
  tasks: Task[];
  approvals: Approval[]; review: (id: string, approve: boolean, choice?: { reason: TaskReturnReason | null; note: string | null }, onDone?: () => void) => void;
  reviewing: boolean; reviewingId?: string; reviewError: unknown;
  occurrences: Occurrence<WeekEvent>[]; upcoming: Occurrence<WeekEvent> | undefined;
  unread: number; online: boolean;
  /** Only the child list gates the whole screen. */
  loading: boolean; error: unknown; retry: () => void;
  sections: { approvals: SectionState; tasks: SectionState; progress: SectionState; plan: SectionState };
}

const destinations = [
  { key: 'today', href: '/parent', Icon: Home },
  { key: 'calendar', href: '/parent/calendar', Icon: CalendarDays },
  { key: 'prova', href: '/parent/prova', Icon: GraduationCap },
  { key: 'more', href: '/parent/menu', Icon: MoreHorizontal },
] as const;
/** Returned work first: the child still has something to fix; then planned, waiting and approved. */
const taskOrder: Record<string, number> = { returned: 0, planned: 1, done: 2, approved: 3 };
const SLOW_MS = 6000;
const go = (href: Href) => router.push(href);
function Label({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <Text style={small ? s.small : s.text}>{children}</Text>;
}
function Heading({ children }: { children: ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return <Text accessibilityRole="header" style={[s.sectionTitle, width >= 1000 && fontScale < 1.4 && { fontSize: 28, lineHeight: 34 }]}>{children}</Text>;
}
function TextLink({ label, href }: { label: string; href: Href }) {
  return <Pressable accessibilityRole="link" onPress={() => go(href)} style={s.link}>
    <Text style={s.linkText}>{label}</Text><ChevronRight size={18} color={c.purple}/>
  </Pressable>;
}
function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label}
    aria-valuemin={0} aria-valuemax={Math.max(1, max)} aria-valuenow={Math.max(0, Math.min(value, Math.max(1, max)))}
    accessibilityValue={{ min: 0, max: Math.max(1, max), now: Math.max(0, Math.min(value, Math.max(1, max))) }} style={s.track}>
    <View style={[s.progress, { width: `${max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0}%` }]}/>
  </View>;
}
function Mascot({ large = false, wide = false }: { large?: boolean; wide?: boolean }) {
  return <View accessible={false} pointerEvents="none" style={large ? s.emptyArt : [s.heroArt, wide && s.heroArtWide]}>
    <View style={s.blob}/><Image source={mascot} style={s.mascot} resizeMode="contain"/>
  </View>;
}
/** Card-level loading/error. Errors keep the rest of the screen usable and offer a retry of just this card. */
function CardState({ state, message, testID }: { state: SectionState; message: string; testID: string }) {
  const { t } = useTranslation();
  if (state.error) return <View testID={testID} accessibilityRole="alert" style={[s.card, s.cardError]}>
    <View style={s.row}><CircleAlert size={22} color={c.orange}/><Text style={[s.text, s.bold, s.fill]}>{message}</Text></View>
    <SatinButton title={t('common.retry')} secondary onPress={state.retry}/>
  </View>;
  return <View testID={testID} accessible={false} style={s.card}><View style={[s.skeleton, { width: '55%' }]}/><View style={s.skeleton}/></View>;
}
function GoalRow({ child, balance, wide }: { child: Child; balance: number; wide: boolean }) {
  const { t } = useTranslation();
  const goal = useChildGoal(child.id);
  if (goal.isLoading) return <View style={s.goalRow}><Label>{child.name}</Label><ActivityIndicator accessibilityLabel={t('release.loading')} color={c.purple}/></View>;
  if (goal.error) return <View style={s.goalRow}><Label>{child.name}</Label><Label>{t('parentHome.goalError')}</Label>
    <SatinButton title={t('common.retry')} secondary onPress={() => void goal.refetch()}/></View>;
  if (!goal.data) return <View style={[s.goalRow, s.row]}><Collectible slug="reward-mystery-box" size={64}/><View style={s.fill}><Text style={[s.text, s.bold]}>{t('betaUx.goalTitle', { name: child.name })}</Text><Label small>{t('betaUx.goalBody')}</Label><TextLink label={t('betaUx.chooseGoal')} href={{ pathname: "/parent/rewards", params: { goal: "1", childId: child.id } }}/></View></View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.goalTitle', { name: child.name })}
    onPress={() => go({ pathname: '/parent/rewards', params: { goal: '1', childId: child.id } })} style={[s.goalRow, s.row]}>
    <Collectible slug={goal.data.rewardIcon} size={44}/>
    <View style={[s.fill, { gap: 5 }]}>
      <Text style={[s.text, s.bold]}>{child.name} · {goal.data.rewardTitle}</Text>
      <Label small>{t('parentHome.starProgress', { count: balance, total: goal.data.cost })}</Label>
      {!wide ? <><Progress value={balance} max={goal.data.cost} label={goal.data.rewardTitle}/><Label small>{balance >= goal.data.cost ? t('parentHome.goalReady') : t('parentHome.starsRemaining', { count: goal.data.cost - balance })}</Label></> : null}
    </View>{wide ? <View style={[s.fill, { gap: 8 }]}><Progress value={balance} max={goal.data.cost} label={goal.data.rewardTitle}/><Label small>{balance >= goal.data.cost ? t('parentHome.goalReady') : t('parentHome.starsRemaining', { count: goal.data.cost - balance })}</Label></View> : null}<ChevronRight size={18} color={c.muted}/>
  </Pressable>;
}

export function ParentHomeView(p: HomeViewProps) {
  const { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 1000 && fontScale < 1.4;
  const compact = width < 370 || fontScale >= 1.4;
  const [planDate, setPlanDate] = useState(p.today);
  const [showWeek, setShowWeek] = useState(false);
  const [expandedFor, setExpandedFor] = useState<string | null | undefined>(undefined);
  const [slow, setSlow] = useState(false);
  // The return sheet closes only when this submission's return was stored; errors stay visible inside it.
  const [returning, setReturning] = useState<Approval | null>(null);
  useEffect(() => {
    if (!p.loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [p.loading]);
  const allApprovals = expandedFor === p.selected;
  const selectedDate = showWeek && p.week.includes(planDate) ? planDate : p.today;
  const otherDay = selectedDate !== p.today;
  const selectedChild = p.profiles.length === 1 ? p.profiles[0] : p.profiles.find(child => child.id === p.selected);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' });
  const clock = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: p.timeZone });
  const dayEvents = p.occurrences.filter(o => o.date === selectedDate);
  const greeting = p.parentName ? t('parentPremium.greeting', { name: p.parentName }) : t('parentHome.familyToday');
  const todayScope = otherDay ? <Text testID="home-today-scope" style={s.small}>{t('parentToday.todayScope', { date: shortDate.format(new Date(p.today + 'T12:00:00Z')) })}</Text> : null;
  const tasksReady = !p.sections.tasks.loading && !p.sections.tasks.error;
  const orderedTasks = [...p.tasks].sort((a, b) => (taskOrder[a.status] ?? 1) - (taskOrder[b.status] ?? 1));

  const approvals = p.sections.approvals.error ? <CardState state={p.sections.approvals} message={t('parentToday.approvalsError')} testID="home-approvals-error"/>
    : !p.approvals.length ? null : <View testID="home-approvals" style={[s.card, s.approvalCard, !wide && { padding: 10, gap: 8 }]}>
      <View style={s.row}><Heading>{t('parent.waitingApproval')}</Heading><Text style={s.badge}>{p.approvals.length}</Text></View>
      {(allApprovals ? p.approvals : p.approvals.slice(0, 2)).map((item, i) => <View key={item.id} style={[s.approvalItem, i > 0 && s.divider]}>
        <View style={[s.row, s.approvalDetail, !wide && { minHeight: 56 }]}>
          <View style={[s.iconTile, { backgroundColor: c.apricot }]}><TaskIcon slug={item.task_templates?.icon} size={48} variant="illustrated"/></View>
          <View style={s.fill}><Text style={[s.text, s.bold]}>{item.task_templates?.title}</Text><Label small>{item.children?.name} · {t('room.plusStars', { count: item.task_templates?.stars ?? 0 })}</Label></View>
        </View>
        <View style={[s.row, compact && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <SatinButton title={t('parent.return')} secondary style={compact ? undefined : s.fill} onPress={() => setReturning(item)} disabled={p.reviewing}/>
          <SatinButton title={t('parent.approve')} style={compact ? undefined : s.fill} onPress={() => p.review(item.id, true)} disabled={p.reviewing} busy={p.reviewing && p.reviewingId === item.id}/>
        </View>
        {item.previous ? <Text testID="home-approval-previous" style={s.small}>{t('c03.review.previous', { reason: t(`c03.reason.${item.previous.reason}`) })}{item.previous.note ? ` · “${item.previous.note}”` : ''}</Text> : null}
        {p.reviewError && p.reviewingId === item.id && !returning ? <Text accessibilityRole="alert" style={[s.text, { color: c.orange }]}>{t(reviewErrorKey((p.reviewError as Error).message))}</Text> : null}
      </View>)}
      {p.approvals.length > 2 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: allApprovals }}
        onPress={() => setExpandedFor(allApprovals ? undefined : p.selected)} style={s.link}>
        <Text style={s.linkText}>{t(allApprovals ? 'parentPremium.showLess' : 'parentPremium.showApprovals', { count: p.approvals.length })}</Text>
      </Pressable> : null}
    </View>;

  // The next concrete thing after approvals: a returned task (the child fixes it) or the next planned one.
  const next = orderedTasks.find(task => task.status === 'returned' || task.status === 'planned');
  const nextUp = !tasksReady || !p.tasks.length ? null : next ? <Pressable testID="home-next" accessibilityRole="button"
    accessibilityLabel={`${t('parentToday.nextUp')}: ${next.title}`}
    onPress={() => go({ pathname: '/parent/tasks', params: { childId: next.childId, taskId: next.id } })} style={[s.card, s.nextCard]}>
    <Text style={[s.small, s.bold, s.purple]}>{t('parentToday.nextUp')}</Text>
    <View style={s.row}>
      <TaskIcon slug={next.icon} size={48} variant="illustrated"/>
      <View style={s.fill}><Text style={[s.text, s.bold]}>{next.title}</Text>
        <View style={[s.row, { gap: 6 }]}>{next.status === 'returned' ? <RotateCcw size={16} color={c.orange}/> : null}
          <Label small>{next.status === 'returned' ? t('parentToday.returnedHint', { name: next.childName }) : t('parentToday.plannedHint', { name: next.childName })}</Label></View>
      </View><ChevronRight size={18} color={c.muted}/>
    </View>
  </Pressable> : !p.approvals.length ? <View testID="home-next-done" style={[s.row, s.summary, { padding: 14 }]}><Check size={22} color={c.green}/>
    <View style={s.fill}><Text style={[s.text, s.bold]}>{t('parentToday.allDone')}</Text><Label small>{t('parentToday.allDoneBody')}</Label></View></View> : null;

  const weekControl = <>
    {showWeek ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{p.week.map(date => <Pressable key={date} accessibilityRole="button"
      accessibilityLabel={dateFormat.format(new Date(date + 'T12:00:00Z'))} accessibilityState={{ selected: date === selectedDate }} aria-pressed={date === selectedDate}
      onPress={() => setPlanDate(date)} style={[s.day, date === selectedDate && { backgroundColor: c.mint }, date === p.today && s.todayDay]}>
      <Label small>{weekday.format(new Date(date + 'T12:00:00Z'))}</Label><Label>{Number(date.slice(-2))}</Label>
    </Pressable>)}</ScrollView> : null}
    {otherDay ? <View testID="home-selected-day" style={[s.row, s.wrap, s.dayNote]}>
      <Text style={[s.small, s.fill, { color: c.ink }]}>{t('parentToday.selectedDay', { date: dateFormat.format(new Date(selectedDate + 'T12:00:00Z')) })}</Text>
      <Pressable accessibilityRole="button" onPress={() => setPlanDate(p.today)} style={s.link}><Text style={s.linkText}>{t('parentToday.backToToday')}</Text></Pressable>
    </View> : null}
  </>;

  const plan = <View testID="home-plan" style={s.stack}>
    <View style={[s.row, s.between, s.wrap]}><Heading>{!otherDay ? t('parentHome.planToday') : dateFormat.format(new Date(selectedDate + 'T12:00:00Z'))}</Heading>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showWeek }} onPress={() => { if (showWeek) setPlanDate(p.today); setShowWeek(!showWeek); }} style={s.link}>
        <CalendarDays size={20} color={c.purple}/><Text style={s.linkText}>{t(showWeek ? 'parentPremium.hideWeek' : 'planner.weekOverview')}</Text>
      </Pressable>
    </View>
    {weekControl}
    {p.sections.plan.loading || p.sections.plan.error ? <CardState state={p.sections.plan} message={t('parentToday.planError')} testID="home-plan-state"/> : <View style={[s.card, { paddingVertical: 4, gap: 0 }]}>
      {dayEvents.map((o, i) => <Pressable key={`${o.event.id}-${o.date}`} accessibilityRole="button" onPress={() => go({ pathname: '/parent/calendar', params: { date: o.date, ...(o.event.child_id ? { childId: o.event.child_id } : {}) } })} style={[s.eventRow, wide && { minHeight: 78 }]}>
        <Text style={s.eventTime}>{o.event.all_day ? t('calendar.allDay') : clock.format(o.startsAt)}</Text>
        <View style={s.timeline}><View style={[s.timelineLine, i === 0 && { top: '50%' }, i === dayEvents.length - 1 && { bottom: '50%' }]}/><View style={[s.dot, { backgroundColor: i % 2 ? '#CB4A81' : c.purple }]}/></View>
        <View style={[s.iconTile, { backgroundColor: i % 2 ? '#FCE6EF' : c.lavender }]}>
          {o.event.type === 'school' ? <SubjectIcon subject={o.event.title} size={48} variant="illustrated"/> : <EventIcon type={o.event.type} size={48} variant="illustrated"/>}</View>
        <View style={s.fill}><Text style={[s.text, s.bold]}>{o.event.title}</Text><Label small>{o.event.childName || t('calendar.allFamily')} · {t(`event.type.${o.event.type}`)}</Label></View>
      </Pressable>)}
      {!dayEvents.length ? <View style={[s.row, { paddingVertical: 12 }]}><EventIcon type="school" size={56} variant="illustrated"/><View style={s.fill}><Text style={[s.text, s.bold]}>{otherDay ? t('parentPremium.noPlan') : t('betaUx.planTitle')}</Text><Label small>{t('betaUx.planBody')}</Label></View></View> : null}
      <TextLink label={dayEvents.length ? t('parentHome.openCalendar') : t('betaUx.planAction')} href={{ pathname: "/parent/calendar", params: { date: selectedDate, ...(selectedChild ? { childId: selectedChild.id } : {}) } }}/>
    </View>}
  </View>;

  const progress = <View testID="home-progress" style={s.stack}><Heading>{t('parentPremium.progress')}</Heading>{todayScope}
    {p.sections.progress.loading || p.sections.progress.error ? <CardState state={p.sections.progress} message={t('parentToday.progressError')} testID="home-progress-state"/> :
    <View style={[s.childGrid, wide && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
      {p.familyDay.map((d, i) => <Pressable key={d.child.id} accessibilityRole="button" accessibilityLabel={t('betaUx.childTasks', { name: d.child.name })}
        onPress={() => go({ pathname: "/parent/tasks", params: { childId: d.child.id } })} style={[s.childCard, wide && { flexBasis: 'auto', width: '100%', flexDirection: 'row', alignItems: 'center' }, i % 2 === 1 && { backgroundColor: '#F4F0FD', borderColor: '#ECE4FA' }]}>
        <View style={[s.row, wide && s.fill]}><Avatar slug={d.child.avatar} size={42}/><View style={s.fill}><Text style={[s.text, s.bold]}>{d.child.name}</Text><Label small>{d.due ? t('parent.tasksOf', { done: d.done, total: d.due }) : t('betaUx.firstStep')}</Label></View></View>
        <View style={[{ gap: 8 }, wide && s.fill]}>
          <View style={s.row}><Star size={18} color="#AA6500" fill="#FFC75A"/><Label small>{t('parentPremium.stars', { count: d.stars })}</Label></View>
          {d.pending > 0 && <Label small>{t('experience.pendingTasks', { count: d.pending })}</Label>}
          {d.due > 0 && <Progress value={d.done} max={d.due} label={t('parentPremium.taskProgress', { name: d.child.name })}/>}
        </View>{wide ? <ChevronRight size={18} color={c.muted}/> : null}
      </Pressable>)}
    </View>}
  </View>;
  const goals = <View testID="home-goals" style={s.stack}>
    <View style={[s.row, s.between, s.wrap]}><Heading>{t('parentPremium.goals')}</Heading><TextLink label={t('parentToday.rewardsLink')} href="/parent/rewards"/></View>
    <View style={[s.card, { paddingVertical: 2 }]}>{p.familyDay.map((d, i) => <View key={d.child.id} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
      <GoalRow child={d.child} balance={d.stars} wide={wide}/></View>)}</View>
  </View>;
  const tasks = p.sections.tasks.loading || p.sections.tasks.error ? <View style={s.stack}><Heading>{t('parentHome.dailyTasks')}</Heading><CardState state={p.sections.tasks} message={t('parentToday.tasksError')} testID="home-tasks-state"/></View>
    : <View style={s.card} testID="home-tasks">
    <View style={s.stack}><Heading>{t('parentHome.dailyTasks')}</Heading>{todayScope}</View>
    {!p.tasks.length ? <View style={{ gap: 12 }}><View style={s.row}><Image accessible={false} source={require('../../../../../packages/assets/brand/growing-friend/contextual/planner.png')} style={{ width: 88, height: 84 }} resizeMode="contain"/><View style={s.fill}><Text style={[s.text, s.bold]}>{t('betaUx.taskTitle')}</Text><Label small>{t('betaUx.taskBody')}</Label></View></View><SatinButton title={t('betaUx.firstTask')} onPress={() => go({ pathname: '/parent/tasks', params: { create: '1', ...(selectedChild ? { childId: selectedChild.id } : {}) } })}/></View> : orderedTasks.map((task, i) => {
      const done = task.status === 'approved', pending = task.status === 'done', returned = task.status === 'returned';
      return <Pressable key={`${task.childId}:${task.id}`} accessibilityRole="button" onPress={() => go({ pathname: '/parent/tasks', params: { childId: task.childId, taskId: task.id } })} style={[s.taskRow, i > 0 && s.divider]}>
        {done ? <Check size={22} color={c.green}/> : pending ? <Clock3 size={22} color={c.orange}/> : returned ? <RotateCcw size={22} color={c.orange}/> : <Circle size={22} color={c.purple}/>}
        <TaskIcon slug={task.icon} size={44} variant="illustrated"/><View style={s.fill}><Text style={[s.text, s.bold]}>{task.title}</Text>
          <Label small>{task.childName} · {t(done ? 'parentHome.done' : pending ? 'parentHome.waiting' : returned ? 'parentHome.returned' : 'parentHome.planned')}</Label>
          {returned && task.returned ? <Text testID="home-task-return-reason" style={s.small}>{t('c03.review.returnedBecause', { reason: t(`c03.reason.${task.returned.reason}`) })}{task.returned.note ? ` · “${task.returned.note}”` : ''}</Text> : null}
        </View><ChevronRight size={18} color={c.muted}/>
      </Pressable>;
    })}{p.tasks.length > 0 && <TextLink label={t('parentHome.tasks')} href={selectedChild ? { pathname: '/parent/tasks', params: { childId: selectedChild.id } } : '/parent/tasks'}/>}
  </View>;
  const prova = !p.upcoming ? null : <View style={s.card} testID="home-exam">
    <Heading>{t('parentHome.upcomingExam')}</Heading>
    <Text style={[s.text, s.bold]}>{p.upcoming.event.title}</Text><Label small>{dateFormat.format(new Date(p.upcoming.date + 'T12:00:00Z'))}{!p.upcoming.event.all_day ? ' · ' + clock.format(p.upcoming.startsAt) : ''}</Label>
    <SatinButton title={t('parentHome.prepareProva')} secondary onPress={() => go({ pathname: '/parent/prova/builder', params: p.upcoming?.event.child_id ? { childId: p.upcoming.event.child_id } : selectedChild ? { childId: selectedChild.id } : {} })}/>
  </View>;
  // Bottom navigation already opens Prova and the calendar; the strip only holds creation shortcuts not shown elsewhere.
  const shortcuts = ([
    ...(tasksReady && p.tasks.length ? [['parentHome.addTask', { pathname: '/parent/tasks', params: { create: '1', ...(selectedChild ? { childId: selectedChild.id } : {}) } }, Plus] as const] : []),
    ...(!p.upcoming ? [['parentHome.prepareProva', { pathname: '/parent/prova/builder', params: selectedChild ? { childId: selectedChild.id } : {} }, FileText] as const] : []),
  ]);
  const quickActions = !shortcuts.length ? null : <View testID="home-quick-actions" style={s.quickStrip}>
    {shortcuts.map(([label, href, Icon]) => <Pressable key={label} accessibilityRole="button" onPress={() => go(href)} style={s.quick}>
      <View style={s.quickIcon}><Icon size={19} color="#fff"/></View><Text style={s.linkText}>{t(label)}</Text>
    </Pressable>)}
  </View>;

  const empty = !p.loading && !p.error && !p.profiles.length;
  const offlineState = <View testID="home-offline" style={s.state} accessibilityLiveRegion="polite"><WifiOff size={40} color={c.orange}/><Heading>{t('parentToday.offlineTitle')}</Heading>
    <Text style={[s.text, s.stateCopy]}>{t('parentToday.offlineBody')}</Text><SatinButton title={t('common.retry')} onPress={p.retry}/></View>;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
    <ScrollView testID="home-scroll" contentContainerStyle={[s.page, !wide && s.phonePage]} keyboardShouldPersistTaps="handled">
      <View style={s.topbar}><Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="GINA"/>
        <View style={[s.row, { gap: 8, flexShrink: 1 }]}>
          {p.profiles.length ? <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.childSpace')} onPress={() => go('/parent/child-mode')} style={s.childMode}>
            <LockKeyhole size={18} color={c.purple}/><Text style={s.linkText}>{t('parentPremium.childMode')}</Text>
          </Pressable> : null}
          <View><IconButton label={p.unread > 0 ? t('parentToday.inboxUnread', { count: p.unread }) : t('inbox.title')} onPress={() => go('/parent/inbox')}><Bell size={23} color={c.muted}/></IconButton>
            {p.unread > 0 ? <Text testID="home-unread" accessible={false} style={s.bellBadge}>{p.unread > 9 ? '9+' : p.unread}</Text> : null}</View>
        </View>
      </View>
      {!p.online && !p.loading && !p.error && !empty ? <View testID="home-offline-banner" accessibilityRole="alert" style={[s.row, s.offlineBanner]}><WifiOff size={20} color={c.orange}/><Text style={[s.small, s.fill, { color: c.ink }]}>{t('parentToday.offlineCached')}</Text></View> : null}
      {!p.online && (p.loading || p.error) ? offlineState : p.loading ? <View testID="home-loading" style={s.state} accessibilityLiveRegion="polite"><ActivityIndicator color={c.purple}/><Label>{slow ? t('parentToday.slow') : t('release.loading')}</Label>
        {slow ? <SatinButton title={t('common.retry')} secondary onPress={p.retry}/> : null}
        {[1, 2, 3].map(n => <View key={n} accessible={false} style={[s.card, { width: '100%', maxWidth: 600 }]}><View style={[s.skeleton, { width: '60%' }]}/><View style={s.skeleton}/></View>)}
      </View> : p.error ? <View style={s.state}><CircleAlert size={40} color={c.orange}/><Heading>{t('release.loadError')}</Heading><Text style={[s.text, s.stateCopy]}>{t('parentHome.loadHint')}</Text><SatinButton title={t('common.retry')} onPress={p.retry}/></View> : empty ? <>
        <View style={s.heroCopy}><Text accessibilityRole="header" style={[s.title, !wide && s.phoneTitle]}>{greeting}</Text><Label>{t('parentPremium.welcome')}</Label></View>
        <View testID="home-empty" style={s.state}><Mascot large/><Text accessibilityRole="header" style={[s.title, s.stateCopy, { fontSize: 32, lineHeight: 40 }]}>{t('parentPremium.firstChild')}</Text>
          <Text style={[s.text, s.stateCopy]}>{t('parentPremium.firstChildBody')}</Text><SatinButton title={t('parentPremium.addChild')} icon={<Plus size={22} color="#fff"/>} style={{ width: '100%', maxWidth: 440 }} onPress={() => go({ pathname: '/parent/menu', params: { setup: 'new' } })}/>
          <Text style={[s.small, s.stateCopy]}>{t('parentPremium.firstChildHint')}</Text><View style={[s.row, s.summary]}><Users size={28} color={c.green}/><Label>{t('parentPremium.separateSpace')}</Label></View>
        </View>
      </> : <>
        <View testID="home-hero" style={s.hero}>
          <View style={s.heroCopy}><Text accessibilityRole="header" style={[s.title, wide ? s.wideTitle : s.phoneTitle]}>{greeting}</Text><Text style={[s.small, wide && { fontSize: 18, lineHeight: 25 }]}>{dateFormat.format(new Date(p.today + 'T12:00:00Z'))}</Text></View>
          {compact ? null : <Mascot wide={wide}/>}
        </View>
        {p.profiles.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={wide ? { maxWidth: '55%' } : undefined} contentContainerStyle={s.filters}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !p.selected }} aria-pressed={!p.selected} onPress={() => p.select(null)} style={[s.chip, !p.selected && s.selectedChip]}><Text style={[s.text, s.bold]}>{t('parentHome.all')}</Text></Pressable>
          {p.profiles.map(child => <Pressable key={child.id} accessibilityRole="button" accessibilityLabel={t('parentHome.selectChild', { name: child.name })} accessibilityState={{ selected: p.selected === child.id }} aria-pressed={p.selected === child.id}
            onPress={() => p.select(child.id)} style={[s.chip, p.selected === child.id && s.selectedChip]}><Avatar slug={child.avatar} size={30}/><Text style={[s.text, s.bold]}>{child.name}</Text></Pressable>)}
        </ScrollView>}
        {wide ? <View style={s.columns}>
          <View style={[s.column, { flex: 1.15 }]}>{approvals}{nextUp}{plan}{tasks}</View>
          <View style={s.column}>{progress}{prova}{goals}{quickActions}</View>
        </View> : <>{approvals}{nextUp}{plan}{progress}{tasks}{prova}{goals}{quickActions}</>}
        {tasksReady ? <FamilyWeekReview key={`${p.week[0]}:${p.selected ?? 'family'}`} from={p.week[0] ?? p.today} to={p.today} childName={selectedChild?.name} counts={p.weeklyCounts}/> : null}
      </>}
    </ScrollView>
    <View style={[s.bottomNav, { paddingBottom: insets.bottom }]}>{destinations.map(({ key, href, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(`parentHome.${key}`)} accessibilityState={{ selected: key === 'today' }} aria-current={key === 'today' ? 'page' : undefined} onPress={() => key !== 'today' && router.navigate(href)} style={[s.bottomItem, wide && s.row]}>
      <Icon size={25} color={key === 'today' ? c.purple : c.muted} fill={key === 'today' ? c.purple : 'none'}/>
      <Text style={[s.small, { textAlign: 'center' }, wide && { fontSize: 18, lineHeight: 25 }, key === 'today' && s.purple, key === 'today' && s.bold]}>{t(`parentHome.${key}`)}</Text>{key === 'today' ? <View style={s.navIndicator}/> : null}
    </Pressable>)}</View>
    <ReturnReasonSheet visible={!!returning} taskTitle={returning?.task_templates?.title ?? ''} childName={returning?.children?.name ?? ''}
      busy={!!returning && p.reviewing && p.reviewingId === returning.id}
      error={returning && p.reviewError && !p.reviewing && p.reviewingId === returning.id ? t(reviewErrorKey((p.reviewError as Error).message)) : null}
      onCancel={() => setReturning(null)}
      onSend={(choice) => { if (returning) p.review(returning.id, false, choice, () => setReturning(null)); }}/>
  </SafeAreaView>;
}
