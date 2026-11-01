import { useState, type ReactNode } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell, BookOpen, CalendarDays, Check, ChevronRight, Circle, Clock3, FileText, Gift, GraduationCap, Home, LockKeyhole, MoreHorizontal, Plus, Star, Users, CircleAlert } from 'lucide-react-native';
import type { Occurrence } from '@gina/core';
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

const logo = require('../../../../../packages/assets/brand/growing-friend/logo.png');
const mascot = require('../../../../../packages/assets/brand/growing-friend/contextual/family.png');
type Child = { id: string; name: string; grade: number | null; avatar: string | null };
type Approval = { id: string; child_id: string; task_templates: { title: string; icon: string; stars: number } | null; children: { name: string } | null };
export interface HomeViewProps {
  profiles: Child[]; selected: string | null; select: (id: string | null) => void;
  today: string; week: string[]; parentName: string | null | undefined; timeZone: string;
  summary: string; weeklyCount: number;
  familyDay: { child: Child; due: number; done: number; stars: number }[];
  tasks: { id: string; title: string; icon: string; childName: string; status: string }[];
  approvals: Approval[]; review: (id: string, approve: boolean) => void;
  reviewing: boolean; reviewingId?: string; reviewError: unknown;
  occurrences: Occurrence<WeekEvent>[]; upcoming: Occurrence<WeekEvent> | undefined;
  loading: boolean; error: unknown; retry: () => void;
}

const destinations = [
  { key: 'today', href: '/parent', Icon: Home },
  { key: 'calendar', href: '/parent/calendar', Icon: CalendarDays },
  { key: 'prova', href: '/parent/prova', Icon: GraduationCap },
  { key: 'more', href: '/parent/menu', Icon: MoreHorizontal },
] as const;
const go = (href: Href) => router.push(href);
function Label({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <Text style={small ? s.small : s.text}>{children}</Text>;
}
function Heading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={s.sectionTitle}>{children}</Text>;
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
  return <View accessible={false} pointerEvents="none" style={large ? s.emptyArt : [s.heroArt, wide && { height: 100, width: 300 }]}>
    <View style={[s.blob, wide && { height: 152, top: 0 }]}/><Image source={mascot} style={[s.mascot, wide && { position: 'absolute', height: 178, top: -8 }]} resizeMode="contain"/>
  </View>;
}
function GoalRow({ child, balance, wide }: { child: Child; balance: number; wide: boolean }) {
  const { t } = useTranslation();
  const goal = useChildGoal(child.id);
  if (goal.isLoading) return <View style={s.goalRow}><Label>{child.name}</Label><ActivityIndicator accessibilityLabel={t('release.loading')} color={c.purple}/></View>;
  if (goal.error) return <View style={s.goalRow}><Label>{child.name}</Label><Label>{t('parentHome.goalError')}</Label>
    <SatinButton title={t('common.retry')} secondary onPress={() => void goal.refetch()}/></View>;
  if (!goal.data) return <View style={s.goalRow}><Label>{t('parentHome.noGoal', { name: child.name })}</Label><TextLink label={t('parentHome.rewards')} href="/parent/rewards"/></View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.goalTitle', { name: child.name })}
    onPress={() => go('/parent/rewards')} style={[s.goalRow, s.row]}>
    <Collectible slug={goal.data.rewardIcon} size={52}/>
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
  const wide = width >= 1000 && fontScale < 1.4;
  const compact = width < 370 || fontScale >= 1.4;
  const [planDate, setPlanDate] = useState(p.today);
  const [showWeek, setShowWeek] = useState(false);
  const [expandedFor, setExpandedFor] = useState<string | null | undefined>(undefined);
  const allApprovals = expandedFor === p.selected;
  const selectedDate = showWeek && p.week.includes(planDate) ? planDate : p.today;
  const selectedChild = p.profiles.find(child => child.id === p.selected);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' });
  const clock = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: p.timeZone });
  const dayEvents = p.occurrences.filter(o => o.date === selectedDate);
  const greeting = p.parentName ? t('parentPremium.greeting', { name: p.parentName }) : t('parentHome.familyToday');

  const approvals = <View testID="home-approvals" style={p.approvals.length ? [s.card, s.approvalCard] : [s.row, s.summary]}>
    {!p.approvals.length ? <><Check size={22} color={c.green}/><Label>{t('parent.noApprovals')}</Label></> : <>
      <View style={s.row}><View style={s.fill}><Heading>{t('parent.waitingApproval')}</Heading></View><Text style={s.badge}>{p.approvals.length}</Text></View>
      {(allApprovals ? p.approvals : p.approvals.slice(0, 2)).map((item, i) => <View key={item.id} style={[s.approvalItem, i > 0 && s.divider]}>
        <View style={[s.row, s.approvalDetail]}>
          <View style={[s.iconTile, { backgroundColor: c.apricot }]}><TaskIcon slug={item.task_templates?.icon} size={48} variant="illustrated"/></View>
          <View style={s.fill}><Text style={[s.text, s.bold]}>{item.task_templates?.title}</Text><Label small>{item.children?.name} · {t('room.plusStars', { count: item.task_templates?.stars ?? 0 })}</Label></View>
        </View>
        <View style={[s.row, compact && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <SatinButton title={t('parent.return')} secondary style={compact ? undefined : s.fill} onPress={() => p.review(item.id, false)} disabled={p.reviewing}/>
          <SatinButton title={t('parent.approve')} style={compact ? undefined : s.fill} onPress={() => p.review(item.id, true)} disabled={p.reviewing} busy={p.reviewing && p.reviewingId === item.id}/>
        </View>
        {p.reviewError && p.reviewingId === item.id ? <Text accessibilityRole="alert" style={[s.text, { color: c.orange }]}>{t('parentHome.reviewError')}</Text> : null}
      </View>)}
      {p.approvals.length > 2 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: allApprovals }}
        onPress={() => setExpandedFor(allApprovals ? undefined : p.selected)} style={s.link}>
        <Text style={s.linkText}>{t(allApprovals ? 'parentPremium.showLess' : 'parentPremium.showApprovals', { count: p.approvals.length })}</Text>
      </Pressable> : null}
    </>}
  </View>;

  const plan = <View testID="home-plan" style={s.stack}>
    <View style={[s.row, s.between, s.wrap]}><Heading>{selectedDate === p.today ? t('parentPremium.plan') : dateFormat.format(new Date(selectedDate + 'T12:00:00Z'))}</Heading><TextLink label={t('parentHome.openCalendar')} href="/parent/calendar"/></View>
    <View style={[s.card, { paddingVertical: 4, gap: 0 }]}>
      {dayEvents.length ? dayEvents.map((o, i) => <Pressable key={`${o.event.id}-${o.date}`} accessibilityRole="button" onPress={() => go('/parent/calendar')} style={s.eventRow}>
        <Text style={s.eventTime}>{o.event.all_day ? t('calendar.allDay') : clock.format(o.startsAt)}</Text>
        <View style={s.timeline}><View style={[s.timelineLine, i === 0 && { top: '50%' }, i === dayEvents.length - 1 && { bottom: '50%' }]}/><View style={[s.dot, { backgroundColor: i % 2 ? '#CB4A81' : c.purple }]}/></View>
        <View style={[s.iconTile, { backgroundColor: i % 2 ? '#FCE6EF' : c.lavender }]}>
          {o.event.type === 'school' ? <SubjectIcon subject={o.event.title} size={48} variant="illustrated"/> : <EventIcon type={o.event.type} size={48} variant="illustrated"/>}</View>
        <View style={s.fill}><Text style={[s.text, s.bold]}>{o.event.title}</Text><Label small>{o.event.childName || t('calendar.allFamily')} · {t(`event.type.${o.event.type}`)}</Label></View>
      </Pressable>) : <View style={{ paddingVertical: 12, gap: 8 }}><Label>{t('parentPremium.noPlan')}</Label>
        <View style={[s.row, s.wrap]}><TextLink label={t('parentHome.addEvent')} href="/parent/calendar"/><TextLink label={t('planner.program')} href="/parent/calendar"/></View></View>}
    </View>
  </View>;

  const progress = <View testID="home-progress" style={s.stack}><Heading>{t('parentPremium.progress')}</Heading>
    <View style={[s.childGrid, wide && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
      {p.familyDay.map((d, i) => <Pressable key={d.child.id} accessibilityRole="button" accessibilityLabel={t('parentHome.selectChild', { name: d.child.name })}
        onPress={() => p.select(d.child.id)} style={[s.childCard, wide && { flexBasis: 'auto', width: '100%', flexDirection: 'row', alignItems: 'center' }, i % 2 === 1 && { backgroundColor: '#F4F0FD', borderColor: '#ECE4FA' }]}>
        <View style={[s.row, wide && s.fill]}><Avatar slug={d.child.avatar} size={42}/><View style={s.fill}><Text style={[s.text, s.bold]}>{d.child.name}</Text><Label small>{t('parent.tasksOf', { done: d.done, total: d.due })}</Label></View></View>
        <View style={[{ gap: 8 }, wide && s.fill]}>
          <View style={s.row}><Star size={18} color="#AA6500" fill="#FFC75A"/><Label small>{t('parentPremium.stars', { count: d.stars })}</Label></View>
          <Progress value={d.done} max={d.due} label={t('parentPremium.taskProgress', { name: d.child.name })}/>
        </View>{wide ? <ChevronRight size={18} color={c.muted}/> : null}
      </Pressable>)}
    </View>
  </View>;
  const goals = <View testID="home-goals" style={s.stack}><Heading>{t('parentPremium.goals')}</Heading>
    <View style={[s.card, { paddingVertical: 2 }]}>{p.familyDay.map((d, i) => <View key={d.child.id} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
      <GoalRow child={d.child} balance={d.stars} wide={wide}/></View>)}</View>
  </View>;
  const quick = <View style={s.quickStrip}>{([
    { key: 'addTask', label: 'parentPremium.task', href: '/parent/tasks', Icon: Plus },
    { key: 'prepareProva', label: 'parentHome.prova', href: '/parent/prova/exam', Icon: FileText },
    { key: 'addReward', label: 'parentPremium.reward', href: '/parent/rewards', Icon: Gift },
  ] as const).map(({ key, label, href, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(`parentHome.${key}`)} onPress={() => go(href)}
    style={({ pressed }) => [s.quick, pressed && { backgroundColor: '#E2D8F6' }]}>
    <View style={s.quickIcon}><Icon size={18} color="#fff"/></View><Text style={[s.text, s.bold, s.purple]}>{t(label)}</Text>
  </Pressable>)}</View>;
  const tasks = <View style={s.card} testID="home-tasks">
    <View style={[s.row, s.between, s.wrap]}><Heading>{t('parentHome.dailyTasks')}</Heading><Label small>{t('parentHome.completed', { done: p.familyDay.reduce((n, d) => n + d.done, 0), total: p.familyDay.reduce((n, d) => n + d.due, 0) })}</Label></View>
    {!p.tasks.length ? <Label>{t('parentHome.noTasks')}</Label> : p.tasks.map((task, i) => {
      const done = task.status === 'approved', pending = task.status === 'done', returned = task.status === 'returned';
      return <Pressable key={task.id} accessibilityRole="button" onPress={() => go('/parent/tasks')} style={[s.taskRow, i > 0 && s.divider]}>
        {done ? <Check size={22} color={c.green}/> : pending ? <Clock3 size={22} color={c.orange}/> : <Circle size={22} color={c.purple}/>}
        <TaskIcon slug={task.icon} size={48} variant="illustrated"/><View style={s.fill}><Text style={[s.text, s.bold]}>{task.title}</Text>
          <Label small>{task.childName} · {t(done ? 'parentHome.done' : pending ? 'parentHome.waiting' : returned ? 'parentHome.returned' : 'parentHome.planned')}</Label>
        </View><ChevronRight size={18} color={c.muted}/>
      </Pressable>;
    })}<TextLink label={t('parentHome.tasks')} href="/parent/tasks"/>
  </View>;
  const prova = <View style={s.card}>
    <Heading>{t(p.upcoming ? 'parentHome.upcomingExam' : 'parentHome.prova')}</Heading>
    {p.upcoming ? <><Text style={[s.text, s.bold]}>{p.upcoming.event.title}</Text><Label small>{dateFormat.format(new Date(p.upcoming.date + 'T12:00:00Z'))}{!p.upcoming.event.all_day ? ' · ' + clock.format(p.upcoming.startsAt) : ''}</Label></> : <Label>{t('parentHome.provaHint')}</Label>}
    <SatinButton title={t('parentHome.openProva')} secondary onPress={() => go('/parent/prova')}/>
  </View>;
  const weekControl = <View style={s.stack}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showWeek }} onPress={() => setShowWeek(!showWeek)} style={s.link}>
      <CalendarDays size={20} color={c.purple}/><Text style={s.linkText}>{t(showWeek ? 'parentPremium.hideWeek' : 'planner.weekOverview')}</Text>
    </Pressable>
    {showWeek ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{p.week.map(date => <Pressable key={date} accessibilityRole="button"
      accessibilityLabel={dateFormat.format(new Date(date + 'T12:00:00Z'))} accessibilityState={{ selected: date === selectedDate }}
      onPress={() => setPlanDate(date)} style={[s.day, date === selectedDate && { backgroundColor: c.mint }]}>
      <Label small>{weekday.format(new Date(date + 'T12:00:00Z'))}</Label><Label>{Number(date.slice(-2))}</Label>
    </Pressable>)}</ScrollView> : null}
  </View>;
  const empty = !p.loading && !p.error && !p.profiles.length;
  return <SafeAreaView style={s.root}>
    <ScrollView testID="home-scroll" contentContainerStyle={[s.page, !wide && s.phonePage]} keyboardShouldPersistTaps="handled">
      <View style={s.topbar}><Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="GINA"/>
        <View style={[s.row, { gap: 8, flexShrink: 1 }]}>
          {p.profiles.length ? <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.childSpace')} onPress={() => go('/parent/child-mode')} style={s.childMode}>
            <LockKeyhole size={18} color={c.purple}/><Text style={s.linkText}>{t('parentPremium.childMode')}</Text>
          </Pressable> : null}
          <IconButton label={t('parentHome.notifications')} onPress={() => go('/parent/notifications')}><Bell size={23} color={c.muted}/></IconButton>
        </View>
      </View>
      {p.loading ? <View testID="home-loading" style={s.state} accessibilityLiveRegion="polite"><ActivityIndicator color={c.purple}/><Label>{t('release.loading')}</Label>
        {[1, 2, 3].map(n => <View key={n} accessible={false} style={[s.card, { width: '100%', maxWidth: 600 }]}><View style={[s.skeleton, { width: '60%' }]}/><View style={s.skeleton}/></View>)}
      </View> : p.error ? <View style={s.state}><CircleAlert size={40} color={c.orange}/><Heading>{t('release.loadError')}</Heading><Text style={[s.text, s.stateCopy]}>{t('parentHome.loadHint')}</Text><SatinButton title={t('common.retry')} onPress={p.retry}/></View> : empty ? <>
        <View style={s.heroCopy}><Text accessibilityRole="header" style={[s.title, !wide && s.phoneTitle]}>{greeting}</Text><Label>{t('parentPremium.welcome')}</Label></View>
        <View testID="home-empty" style={s.state}><Mascot large/><Text accessibilityRole="header" style={[s.title, s.stateCopy, { fontSize: 32, lineHeight: 40 }]}>{t('parentPremium.firstChild')}</Text>
          <Text style={[s.text, s.stateCopy]}>{t('parentPremium.firstChildBody')}</Text><SatinButton title={t('parentPremium.addChild')} icon={<Plus size={22} color="#fff"/>} style={{ width: '100%', maxWidth: 440 }} onPress={() => go('/parent/menu')}/>
          <Text style={[s.small, s.stateCopy]}>{t('parentPremium.firstChildHint')}</Text><View style={[s.row, s.summary]}><Users size={28} color={c.green}/><Label>{t('parentPremium.separateSpace')}</Label></View>
        </View>
      </> : <>
        <View style={[s.hero, wide && { minHeight: 100 }, compact && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={s.heroCopy}><Text accessibilityRole="header" style={[s.title, !wide && s.phoneTitle]}>{greeting}</Text><Label>{dateFormat.format(new Date(p.today + 'T12:00:00Z'))}</Label></View>
          <Mascot wide={wide}/>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !p.selected }} onPress={() => p.select(null)} style={[s.chip, !p.selected && s.selectedChip]}><Text style={[s.text, s.bold]}>{t('parentHome.all')}</Text></Pressable>
          {p.profiles.map(child => <Pressable key={child.id} accessibilityRole="button" accessibilityLabel={t('parentHome.selectChild', { name: child.name })} accessibilityState={{ selected: p.selected === child.id }}
            onPress={() => p.select(child.id)} style={[s.chip, p.selected === child.id && s.selectedChip]}><Avatar slug={child.avatar} size={30}/><Text style={[s.text, s.bold]}>{child.name}</Text></Pressable>)}
        </ScrollView>
        {wide ? <View style={s.columns}>
          <View style={[s.column, { flex: 1.15 }]}>{approvals}{plan}{weekControl}</View>
          <View style={s.column}>{progress}{goals}{quick}</View>
        </View> : <>{approvals}{plan}{progress}{quick}{goals}{weekControl}</>}
        <View style={[wide ? s.columns : s.stack]}><View style={s.column}>{tasks}</View><View style={s.column}>{prova}
          <View style={s.summary}><Heading>{t('parentHome.smallSteps')}</Heading><Label>{t(selectedChild ? 'parentHome.childWeek' : 'parentHome.familyWeek', { name: selectedChild?.name, count: p.weeklyCount })}</Label>
            <Pressable accessibilityRole="button" onPress={() => go('/parent/prova/progress')} style={s.link}><BookOpen size={22} color={c.green}/><View style={s.fill}><Label small>{p.summary}</Label></View><ChevronRight size={18} color={c.muted}/></Pressable>
          </View>
        </View></View>
        <View style={[s.row, s.wrap, { columnGap: 24 }]}><TextLink label={t('parent.notes')} href="/parent/notes"/><TextLink label={t('parent.grades')} href="/parent/grades"/><TextLink label={t('share.title')} href="/parent/share"/></View>
      </>}
    </ScrollView>
    <View style={s.bottomNav}>{destinations.map(({ key, href, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(`parentHome.${key}`)} accessibilityState={{ selected: key === 'today' }} onPress={() => go(href)} style={[s.bottomItem, wide && s.row]}>
      <Icon size={25} color={key === 'today' ? c.purple : c.muted} fill={key === 'today' ? c.purple : 'none'}/>
      <Text style={[s.small, { textAlign: 'center' }, key === 'today' && s.purple, key === 'today' && s.bold]}>{t(`parentHome.${key}`)}</Text>{key === 'today' ? <View style={s.navIndicator}/> : null}
    </Pressable>)}</View>
  </SafeAreaView>;
}
