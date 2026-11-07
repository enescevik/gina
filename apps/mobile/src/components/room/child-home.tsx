import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, Check, ChevronRight, Circle, ClipboardCheck, Clock3, GraduationCap, House, LockKeyhole, Pencil, Play, Star, Timer, Trophy, X } from 'lucide-react-native';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Modal, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApprovedScene } from '@/components/child-home/approved-scene';
import { BagGlance, HomeworkNext, useChildHomework } from '@/components/child-home/day-extras';
import { ReturnNext } from '@/components/child-home/return-next';
import { c, s } from '@/components/child-home/theme';
import { Collectible } from '@/components/collectible';
import { rewardTicketArt } from './room-art';
import { SatinButton } from '@/components/planner/ui';
import { Button } from '@/components/ui/button';
import { TaskFocus, useOpenFocus } from '@/components/tasks/task-focus';
import { TaskIcon } from '@/components/task-icon';
import { ErrorText } from '@/components/ui/screen';
import { useFutureLearningReady } from '@/lib/future-learning';
import { supabase } from '@/lib/supabase';
import { childPath } from '@/lib/active-child';
import { useChildExamCount } from '@/lib/use-child-exam-count';
import { useChildGoal } from '@/lib/use-child-goal';
import { useChildToday } from '@/lib/use-child-today';
import type { CharacterKey } from './scene';

export interface RoomChildHomeProps {
  childId: string; childName: string; character?: CharacterKey; actingAsParent?: boolean;
  onParentExit: () => void; exitBusy?: boolean; actionError?: unknown;
}

/** Approved mint room, shared by paired child devices and PIN-locked parent mode. */
export function RoomChildHome({ childId, childName, actingAsParent = false, onParentExit, exitBusy, actionError }: RoomChildHomeProps) {
  const { t } = useTranslation();
  const data = useChildToday(childId, actingAsParent);
  const goal = useChildGoal(childId);
  const exams = useChildExamCount(childId);
  const ready = useFutureLearningReady("daily_practice");
  const daily = useQuery({
    queryKey: ['daily_practice', childId],
    enabled: ready && !!childId,
    staleTime: 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const offer = await supabase.rpc('daily_practice_offer', { p_child_id: childId });
      if (offer.error?.code !== 'PGRST202') {
        if (offer.error) throw offer.error;
        return offer.data as { exam_id?: string; automatic?: boolean; legacy?: boolean } | null;
      }
      const legacy = await supabase.rpc('get_daily_practice', { p_child_id: childId });
      if (legacy.error) throw legacy.error;
      return legacy.data ? { exam_id: legacy.data, legacy: true } : null;
    },
  });
  const dailyOffer = ready && !daily.isError && !daily.isPaused ? daily.data : null;
  const openDaily = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('open_daily_practice', { p_child_id: childId });
      if (error) throw error;
      return data;
    },
    onSuccess: (examId) => {
      void daily.refetch();
      if (examId) goToDaily(examId);
    },
  });
  const goToDaily = (examId: string) => router.push({
    pathname: actingAsParent ? '/parent/child-mode/prova/[examId]' : '/child/prova/[examId]',
    params: { examId },
  });
  const homework = useChildHomework(childId, data.today);
  const openFocus = useOpenFocus(childId, data.today);
  const client = useQueryClient();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shortLandscape = width > height && height < 520 && fontScale <= 1.25;
  const wide = width >= 640 && width > height && fontScale <= 1.25;
  const [taskSheet, setTaskSheet] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(Math.max(1, height - 150));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const returnToRoom = useCallback(() => scroll.current?.scrollTo({ y: 0, animated: false }), []);
  const next = data.due.find(x => x.available && x.status === 'returned') ?? data.due.find(x => x.available && x.status === null);
  // Görev bitince sıradaki adım ödev/çalışma, sonra Prova: çocuk tek bir somut adım görür.
  const homeworkNext = !next && !data.loading && !data.error ? homework.items[0] : undefined;
  const selected = data.due.find(x => x.id === selectedId);
  const approved = data.due.filter(x => x.status === 'approved').length;
  const waiting = data.due.filter(x => x.status === 'done').length;
  const todo = data.due.filter(task=>task.available && (task.status===null || task.status==='returned')).length;
  const go = (page: Parameters<typeof childPath>[0]) => router.push(childPath(page, actingAsParent));
  const openTasks = () => { setSelectedId(null); setTaskSheet(true); };
  const openTask = (id: string) => { setSelectedId(id); setTaskSheet(true); };
  const retry = () => {
    for (const key of ['task_templates', 'task_completions_week', 'star_events', 'child_goal']) void client.refetchQueries({ queryKey: [key, childId] });
  };
  const error = data.error ?? actionError;
  const statusText = (status: string | null) => status === 'done' ? t('child.waitingApproval') : status === 'approved' ? t('child.approved') : status === 'returned' ? t('child.returnedTryAgain') : t('childMint.ready');
  const primary = (label: string, run: () => void, busy = false) => <SatinButton title={label} onPress={run} busy={busy} icon={<Play size={20} fill={c.white} color={c.white}/>} style={{ borderRadius: 18, minHeight: 50 }}/>;
  const panel = <View style={[s.panelContent, wide && { paddingLeft: 22 }, !wide && s.panelContentPhone, shortLandscape && { padding: 12, gap: 10 }]}>
    <View style={[s.section, !wide && { gap: 8 }]}>
      <Text accessibilityRole="header" style={s.heading}>{t('childMint.next')}</Text>
      {openFocus && !taskSheet ? <Pressable testID="child-focus-open" accessibilityRole="button" onPress={() => openTask(openFocus.taskId)} style={({ pressed }) => [s.link, pressed && s.pressed]}><Timer size={22} color={c.purple} /><Text style={[s.small, { color: c.ink, flex: 1 }]}>{t(openFocus.phase === 'finished' ? 'childMint.focusFinished' : openFocus.running ? 'childMint.focusRunning' : 'childMint.focusPaused')}</Text><ChevronRight size={18} color={c.purple} /></Pressable> : null}
      {error ? <View style={s.card}><ErrorText error={error} />{primary(t('common.retry'), retry)}</View> : data.loading ? <View style={s.state}><ActivityIndicator color={c.purple} /><Text style={s.text}>{t('childMint.loading')}</Text></View> : next ? <View style={[s.card, !wide && { padding: 10, gap: 8 }]}>
        <View style={s.row}><View style={s.taskArt}><TaskIcon slug={next.icon} size={wide ? 76 : 60} variant="illustrated" /></View><View style={{ flex: 1, gap: 4 }}><Text style={[s.heading, { fontSize: 19 }]}>{next.title}</Text><Text style={s.text}>{t('room.plusStars', { count: next.stars })}</Text>{next.status === 'returned' && <Text style={[s.small, { color: c.amber }]}>{t('child.returnedTryAgain')}</Text>}</View></View>
        {next.status === 'returned' && <View testID="child-returned-explain" style={{ backgroundColor: '#FFF6E5', borderRadius: 14, padding: 10, gap: 4 }}><Text style={[s.small, { color: c.ink }]}>{t('childMint.returnedTitle')}</Text><ReturnNext returned={next.returned} compact/></View>}
        {primary(t(next.status === 'returned' ? 'childMint.returnedAction' : 'childMint.start'), () => openTask(next.id))}
      </View> : homeworkNext ? <HomeworkNext item={homeworkNext} compact={!wide} onOpen={() => go('calendar')} /> : (!waiting && (exams.data ?? 0) > 0 ? null : <View style={s.card}><View style={s.row}><Collectible slug={waiting ? 'star-filled' : data.due.length ? 'reward-trophy' : 'display-first-task'} size={shortLandscape ? 48 : 64}/><View style={{ flex: 1 }}><Text style={s.heading}>{t(waiting ? 'childMint.waitingTitle' : data.due.some(x=>!x.available && x.status==='returned') ? 'routine.pausedTitle' : data.due.length ? 'childMint.allDone' : 'childMint.emptyTitle')}</Text><Text style={s.text}>{t(waiting ? 'childMint.waitingBody' : data.due.some(x=>!x.available && x.status==='returned') ? 'routine.pausedBody' : data.due.length ? 'childMint.allDoneBody' : 'childMint.emptyBody')}</Text></View></View>{!data.due.length && !(exams.data ?? 0) && primary(t('betaUx.exploreCollection'), () => go('collection'))}</View>)}
      {!next && !homeworkNext && !data.loading && !error && !waiting && dailyOffer && <View style={s.card}>
        <Text style={s.heading}>{t('dailyPractice.title')}</Text>
        <Text style={s.text}>{t('dailyPractice.invitation')}</Text>
        {primary(t('dailyPractice.open'), () => {
          if (dailyOffer.legacy && dailyOffer.exam_id) goToDaily(dailyOffer.exam_id);
          else if (!openDaily.isPending) openDaily.mutate();
        }, openDaily.isPending)}
        {openDaily.isError && <Text accessibilityRole="alert" style={s.text}>{t('dailyPractice.openFailed')}</Text>}
      </View>}
      {!next && !homeworkNext && !data.loading && !error && !waiting && !dailyOffer && (exams.data ?? 0) > 0 && <View style={s.card}><View style={s.row}><Collectible slug="reward-book" size={shortLandscape ? 48 : 64}/><View style={{ flex: 1 }}><Text style={s.heading}>{t('childMint.provaWaitingTitle', { count: exams.data ?? 0 })}</Text><Text style={s.text}>{t('childMint.provaWaitingBody')}</Text></View></View>{primary(t('childMint.provaWaitingAction'), () => go('prova'))}</View>}
    </View>
    {data.due.length > 0 && <View style={[s.section, s.divider, !wide && { gap: 8, paddingTop: 12 }]}>
      <Text accessibilityRole="header" style={s.heading}>{t('childMint.steps')}</Text>
      <View style={[s.row, { gap: 7, alignItems: 'stretch' }]}>
        {([{ count: approved, key: 'finished', Icon: Check, color: '#128772' }, { count: waiting, key: 'waiting', Icon: Clock3, color: c.amber }, { count: todo, key: 'todo', Icon: Circle, color: c.muted }] as const).map(({ count, key, Icon, color }) => <View key={key} style={[s.status, !wide && s.statusPhone]} accessible accessibilityLabel={t(`childMint.${key}`, { count })}><Icon size={wide ? 24 : 20} color={color} strokeWidth={2.3} /><Text style={[s.small, { color, textAlign: 'center', fontSize: wide ? 12 : 13 }]}>{data.loading || data.error ? '—' : t(`childMint.${key}`, { count })}</Text></View>)}
      </View>
    </View>
    }{data.holiday ? <View accessibilityRole="text" style={[s.card, { backgroundColor: '#E7F5EE' }]}><Text style={s.heading}>{data.holiday.title}</Text><Text style={s.text}>{t('c12.holiday.child')}</Text></View> : null}
    <BagGlance childId={childId} today={data.today} onOpen={() => go('calendar')} />
    <View style={[s.section, s.divider, !wide && { gap: 8, paddingTop: 12 }]}>
      <Text accessibilityRole="header" style={s.heading}>{t('childMint.goal')}</Text>
      {goal.error ? <View style={s.card}><ErrorText error={goal.error} /><Pressable accessibilityRole="button" onPress={() => void goal.refetch()} style={s.chip}><Text style={s.text}>{t('common.retry')}</Text></Pressable></View> : goal.isLoading ? <ActivityIndicator color={c.purple} /> : <Pressable accessibilityRole="button" accessibilityLabel={t('room.myGoal')} onPress={() => go('goal')} style={({ pressed }) => [s.card, s.row, pressed && s.pressed]}>
        {rewardTicketArt(goal.data?.rewardIcon).left ? <Image source={rewardTicketArt(goal.data?.rewardIcon).left!} resizeMode="contain" style={{ width: wide ? 84 : 64, height: wide ? 84 : 64 }} /> : <Collectible slug="star-filled" size={wide ? 84 : 64} />}
        <View style={{ flex: 1, gap: 3 }}><Text style={[s.text, s.bold]}>{goal.data?.rewardTitle ?? t('goal.pickCta')}</Text>{goal.data && <><Text style={s.small}>{t('room.goalProgress', { stars: Math.min(data.stars, goal.data.cost), cost: goal.data.cost })}</Text><View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.max(1, goal.data.cost), now: Math.min(data.stars, goal.data.cost) }} style={s.track}><View style={[s.fill, { width: `${Math.min(100, Math.max(0, data.stars / Math.max(1, goal.data.cost) * 100))}%` }]} /></View><Text style={s.small}>{data.stars >= goal.data.cost ? t('goal.reached') : t('room.starsLeft', { count: goal.data.cost - data.stars })}</Text></>}</View><ChevronRight size={21} color={c.purple} />
      </Pressable>}
    </View>
    <View style={[s.link, { paddingHorizontal: 8, paddingVertical: 0, gap: 0 }]}><Pressable accessibilityRole="button" onPress={() => go('week')} style={({ pressed }) => [s.row, { flex: 1, minHeight: 52, paddingHorizontal: 6 }, pressed && s.pressed]}><CalendarDays size={24} color={c.purple}/><Text style={[s.small, { color: c.ink, flex: 1 }]}>{t('betaUx.weekProgress')}</Text><ChevronRight size={18} color={c.purple}/></Pressable><Pressable accessibilityRole="button" onPress={() => go('calendar')} style={({ pressed }) => [s.row, { minHeight: 52, paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: c.line }, pressed && s.pressed]}><Text style={[s.small, { color: c.purple }]}>{t('child.calendar')}</Text></Pressable></View>
  </View>;
  const availableWidth = width - insets.left - insets.right;
  const panelWidth = Math.max(300, Math.min(availableWidth * .58, availableWidth - bodyHeight * 729 / 641 + 28));
  const scene = <ApprovedScene style={wide ? { flex: 1 } : { width: '100%', height: width * 641 / 729 }} onTasks={openTasks} onProva={() => go('prova')} onCollection={() => go('collection')} />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
    <View style={[s.header, !wide && s.headerPhone, shortLandscape && { paddingVertical: 2, paddingHorizontal: 12, gap: 8 }]}>
      <Image source={require('../../../../../packages/assets/brand/growing-friend/logo.png')} accessible accessibilityLabel="Gina" resizeMode="contain" style={[s.logo, (!wide || shortLandscape) && s.logoPhone]} />
      {wide && <Text accessibilityRole="header" style={[s.greeting, shortLandscape && { fontSize: 20 }]}>{t('child.hello', { name: childName })}</Text>}
      {!wide && <View style={{ flex: 1 }} />}
      <View style={[s.chip, !wide && { paddingHorizontal: 8 }]} accessible accessibilityLabel={t('room.starCount', { count: data.stars })}><Star size={24} color="#EBA12D" fill="#FFD06A" /><Text style={[s.text, s.bold]}>{data.loading || data.error ? '—' : data.stars}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('childV5.customize')} onPress={() => go('room-preview')} style={({ pressed }) => [s.chip, !wide && { paddingHorizontal: 8 }, pressed && s.pressed]}><Pencil size={21} color={c.purple} />{(wide || width >= 390) && <Text style={[s.small, { color: c.purple }]}>{t(wide && !shortLandscape ? 'childV5.customize' : 'childMint.room')}</Text>}</Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('room.parentExit')} accessibilityState={{ disabled: !!exitBusy }} disabled={exitBusy} onPress={onParentExit} style={({ pressed }) => [s.chip, !wide && { paddingHorizontal: 8 }, pressed && s.pressed]}>{exitBusy ? <ActivityIndicator color={c.purple} /> : <LockKeyhole size={21} color={c.muted} />}{wide && <Text style={s.small}>{t('room.parentExit')}</Text>}</Pressable>
    </View>
    {wide ? <View style={s.body} onLayout={e => setBodyHeight(e.nativeEvent.layout.height)}>{scene}<ScrollView style={[s.panel, { width: panelWidth, marginLeft: -28, flexGrow: 0, flexShrink: 0 }]}>{panel}</ScrollView></View> : <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}><Text accessibilityRole="header" style={[s.greetingPhone, { color: c.ink }]}>{t('child.hello', { name: childName })}</Text>{scene}<View style={[s.panel, s.panelPhone]}>{panel}</View></ScrollView>}
    <View style={[s.nav, { paddingBottom: insets.bottom }, shortLandscape && { paddingTop: 0 }]}>
      {([{ key: 'world', Icon: House, run: () => {}, label: t('childMint.world') }, { key: 'tasks', Icon: ClipboardCheck, run: openTasks, label: t('childMint.tasks') }, { key: 'prova', Icon: GraduationCap, run: () => go('prova'), label: (exams.data ?? 0) > 0 ? `${t('prova.title')} (${exams.data})` : t('prova.title') }, { key: 'collection', Icon: Trophy, run: () => go('collection'), label: t('childMint.collection') }]).map(({ key, Icon, run, label }) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === 'world' }} aria-current={key === 'world' ? 'page' : undefined} onPress={key === 'world' ? returnToRoom : run} style={({ pressed }) => [s.navItem, shortLandscape && { minHeight: 48, flexDirection: 'row', gap: 8 }, pressed && s.pressed]}><Icon size={wide && !shortLandscape ? 28 : 23} color={key === 'world' ? c.purple : c.muted} fill={key === 'world' ? c.purple : 'none'} /><Text style={[s.small, { color: key === 'world' ? c.purple : c.muted }]}>{label}</Text>{key === 'world' && <View style={s.navLine} />}</Pressable>)}
    </View>
    <Modal visible={taskSheet} transparent animationType="none" onRequestClose={() => setTaskSheet(false)} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaProvider><SafeAreaView style={s.overlay}><View style={s.modal} accessibilityViewIsModal>
        <View style={s.row}><Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>{selected ? selected.title : t('room.todayTasks')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('childMint.close')} onPress={() => setTaskSheet(false)} style={s.chip}><X size={22} color={c.ink} /></Pressable></View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
          <ErrorText error={data.completionError ?? data.error} />
          {taskSheet && !data.loading && !data.error && <TaskFocus childId={childId} day={data.today} tasks={data.due.filter(task=>task.available)} selectedId={selectedId} onSelect={setSelectedId} />}
          {data.loading ? <ActivityIndicator color={c.purple} /> : (selected ? [selected] : data.due).map(task => <View key={task.id} style={s.card}>
            <View style={s.row}><TaskIcon slug={task.icon} size={72} variant="illustrated" /><View style={{ flex: 1 }}><Text style={[s.text, s.bold]}>{task.title}</Text><Text style={s.small}>{t('room.plusStars', { count: task.stars })}</Text><Text accessibilityLiveRegion="polite" style={[s.small, { color: task.status === 'done' || task.status === 'returned' ? c.amber : c.muted }]}>{!task.available && task.status === "returned" ? t("routine.pausedWork") : statusText(task.status)}</Text></View></View>
            {task.available && task.status === 'returned' && <ReturnNext returned={task.returned} testID="child-task-return-next"/>}
            {task.available && (task.status === null || task.status === 'returned') && <>{primary(t(task.status === 'returned' ? 'childMint.returnedDone' : 'child.markDone'), () => data.complete(task.id), data.completing)}{!selected && <Button variant="ghost" title={t('focus.focusTask')} onPress={() => setSelectedId(task.id)} />}</>}
          </View>)}
          {!data.loading && !data.error && !data.due.length && <Text style={s.text}>{t('childMint.emptyBody')}</Text>}
        </ScrollView>
      </View></SafeAreaView></SafeAreaProvider>
    </Modal>
  </SafeAreaView>;
}
