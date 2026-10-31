import { useState, type ReactNode } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronRight, Circle, Clock3, ClipboardCheck, FileText, Gift, GraduationCap, Home, LockKeyhole, MoreHorizontal, Plus, Star, Users, UserRound, CircleAlert } from 'lucide-react-native';
import type { Occurrence } from '@gina/core';
import type { WeekEvent } from '@/components/calendar/week-list';
import { Avatar } from '@/components/avatar';
import { TaskIcon } from '@/components/task-icon';
import { EventIcon } from '@/components/event-icon';
import { Collectible } from '@/components/collectible';
import { useChildGoal } from '@/lib/use-child-goal';
import { colors as c, styles as s } from './theme';

const logo = require('../../../../../packages/assets/brand/growing-friend/logo.png');
const mascot = require('../../../../../packages/assets/brand/growing-friend/reading.png');
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
  { key: 'tasks', href: '/parent/tasks', Icon: ClipboardCheck },
  { key: 'calendar', href: '/parent/calendar', Icon: CalendarDays },
  { key: 'prova', href: '/parent/prova', Icon: GraduationCap },
  { key: 'rewards', href: '/parent/rewards', Icon: Star },
  { key: 'more', href: '/parent/menu', Icon: MoreHorizontal },
] as const;
const go = (href: Href) => router.push(href);
function Label({ children, small = false }: { children: ReactNode; small?: boolean }) { return <Text style={small ? s.small : s.text}>{children}</Text>; }
function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={s.sectionTitle}>{children}</Text>; }
function Action({ label, onPress, primary = false, disabled = false, loading = false }: {label:string; onPress:()=>void;primary?:boolean;disabled?:boolean;loading?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: loading }} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,primary&&s.primary,{opacity:disabled?.5:pressed?.8:1}]}>
    {loading?<ActivityIndicator color={primary?c.white:c.purple}/>:null}<Text style={[s.buttonLabel,primary&&{color:c.white}]}>{label}</Text>
  </Pressable>;
}
function TextLink({label,href}:{label:string;href:Href}) {return <Pressable accessibilityRole="link" onPress={()=>go(href)} style={s.link}><Text style={[s.small,s.purple,s.bold]}>{label}</Text><ArrowRight size={16} color={c.purple}/></Pressable>;}
function Progress({value,max,label}:{value:number;max:number;label:string}) {return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:Math.max(1,max),now:Math.max(0,Math.min(value,Math.max(1,max)))}} style={s.track}><View style={[s.progress,{width:`${max>0?Math.max(0,Math.min(100,value/max*100)):0}%`}]}/></View>;}

function GoalCard({child,balance}:{child:Child;balance:number}) {
  const {t}=useTranslation();
  const goal=useChildGoal(child.id);
  return <View style={s.card}>
    <View style={[s.row,s.between,s.wrap]}><Heading>{t('parentHome.goalTitle',{name:child.name})}</Heading><TextLink label={t('parentHome.viewGoal')} href="/parent/rewards"/></View>
    {goal.isLoading?<ActivityIndicator accessibilityLabel={t('release.loading')} color={c.purple}/>:goal.error?<><Label>{t('parentHome.goalError')}</Label><Action label={t('common.retry')} onPress={()=>void goal.refetch()}/></>:goal.data?<View style={s.row}>
      <Collectible slug={goal.data.rewardIcon} size={80}/><View style={{flex:1,gap:8}}><Text style={[s.text,s.bold]}>{goal.data.rewardTitle}</Text>
        <Label>{t('parentHome.starProgress',{count:balance,total:goal.data.cost})}</Label>
        <Progress value={balance} max={goal.data.cost} label={goal.data.rewardTitle}/>
        <Label small>{balance>=goal.data.cost?t('parentHome.goalReady'):t('parentHome.starsRemaining',{count:goal.data.cost-balance})}</Label>
      </View></View>:<><Label>{t('parentHome.noGoal',{name:child.name})}</Label><TextLink label={t('parentHome.rewards')} href="/parent/rewards"/></>}
  </View>;
}

export function ParentHomeView(p:HomeViewProps) {
  const {t,i18n}=useTranslation();
  const {width,fontScale}=useWindowDimensions();
  const wide=width>=1000&&fontScale<1.4;
  const [planDate,setPlanDate]=useState(p.today);
  const selectedDate=p.week.includes(planDate)?planDate:p.today;
  const selectedChild=p.profiles.find(child=>child.id===p.selected);
  const dateFormat=new Intl.DateTimeFormat(i18n.language,{day:'numeric',month:'long',weekday:'long',timeZone:'UTC'});
  const weekday=new Intl.DateTimeFormat(i18n.language,{weekday:'short',timeZone:'UTC'});
  const clock=new Intl.DateTimeFormat(i18n.language,{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:p.timeZone});
  const dayEvents=p.occurrences.filter(o=>o.date===selectedDate);
  const nav=(mobile=false)=><>{destinations.filter(d=>!mobile||['today','calendar','prova','more'].includes(d.key)).map(({key,href,Icon})=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:key==='today'}} accessibilityLabel={t(`parentHome.${key}`)} onPress={()=>go(href)} style={({pressed})=>[mobile?s.bottomItem:s.nav,key==='today'&&!mobile&&s.navSelected,{opacity:pressed?.7:1}]}>
    <Icon size={23} color={key==='today'?c.purple:c.muted} fill={key==='today'?c.purple:'none'}/><Text style={[mobile?s.small:s.text,key==='today'&&s.purple,key==='today'&&s.bold,mobile&&{fontSize:12}]}>{t(`parentHome.${key}`)}</Text>
  </Pressable>)}</>;
  const approvals=<View style={[s.card,s.approvalCard]} testID="home-approvals">
    <View style={s.row}><CircleAlert size={22} color={c.orange}/><Text accessibilityRole="header" style={[s.sectionTitle,s.orange,{flex:1}]}>{t('parent.waitingApproval')}</Text><Text style={s.badge}>{p.approvals.length}</Text></View>
    {!p.approvals.length?<View style={s.row}><Check size={22} color={c.green}/><Label>{t('parent.noApprovals')}</Label></View>:p.approvals.map((item,i)=><View key={item.id} style={[s.approvalItem,i>0&&s.divider]}>
      <View style={s.row}><View style={[s.eventIcon,{width:48,height:48,backgroundColor:c.apricot}]}><TaskIcon slug={item.task_templates?.icon} size={32}/></View><View style={s.fill}><Text style={[s.text,s.bold]}>{item.task_templates?.title}</Text><Label small>{item.children?.name} · {t('room.plusStars',{count:item.task_templates?.stars??0})}</Label></View></View>
      <View style={s.row}><View style={s.fill}><Action label={t('parent.return')} onPress={()=>p.review(item.id,false)} disabled={p.reviewing}/></View><View style={s.fill}><Action label={t('parent.approve')} primary onPress={()=>p.review(item.id,true)} disabled={p.reviewing} loading={p.reviewing&&p.reviewingId===item.id}/></View></View>
    </View>)}
    {p.reviewError?<Text accessibilityRole="alert" style={[s.text,s.orange]}>{t('parentHome.reviewError')}</Text>:null}
  </View>;
  const plan=<View style={s.card} testID="home-plan">
    <View style={[s.row,s.between,s.wrap]}><Heading>{selectedDate===p.today?t('parentHome.planToday'):dateFormat.format(new Date(selectedDate+'T12:00:00Z'))}</Heading><TextLink label={t('parentHome.openCalendar')} href="/parent/calendar"/></View>
    {wide?<View style={[s.row,{gap:6}]}>{p.week.map(date=><Pressable key={date} accessibilityRole="button" accessibilityLabel={dateFormat.format(new Date(date+'T12:00:00Z'))} accessibilityState={{selected:date===selectedDate}} onPress={()=>setPlanDate(date)} style={[s.day,date===selectedDate&&s.daySelected]}><Text style={[s.small,date===selectedDate&&s.purple]}>{weekday.format(new Date(date+'T12:00:00Z'))}</Text><Text style={[s.text,date===selectedDate&&s.purple,date===selectedDate&&s.bold]}>{Number(date.slice(-2))}</Text></Pressable>)}</View>:null}
    {!dayEvents.length?<><Label>{t('calendar.noEvents')}</Label><TextLink label={t('parentHome.addEvent')} href="/parent/calendar"/></>:dayEvents.map((o,i)=><Pressable key={`${o.event.id}-${o.date}`} accessibilityRole="button" onPress={()=>go('/parent/calendar')} style={[s.eventRow,i>0&&{borderTopWidth:1,borderTopColor:c.border}]}>
      <View style={[s.dot,{backgroundColor:[c.green,c.purple,c.orange][i%3]}]}/><Text style={[s.small,{width:48}]}>{o.event.all_day?t('calendar.allDay'):clock.format(o.startsAt)}</Text>
      <EventIcon type={o.event.type} size={30}/><View style={s.fill}><Text style={[s.text,s.bold]}>{o.event.title}</Text>{!p.selected?<Label small>{o.event.childName||t('calendar.allFamily')}</Label>:null}</View>
    </Pressable>)}
  </View>;
  const tasks=<View style={s.card} testID="home-tasks"><View style={[s.row,s.between,s.wrap]}><Heading>{t('parentHome.dailyTasks')}</Heading><Label small>{t('parentHome.completed',{done:p.familyDay.reduce((n,d)=>n+d.done,0),total:p.familyDay.reduce((n,d)=>n+d.due,0)})}</Label></View>
    {!p.tasks.length?<><Label>{t('parentHome.noTasks')}</Label><TextLink label={t('parentHome.addTask')} href="/parent/tasks"/></>:p.tasks.map((task,i)=>{
      const done=task.status==='approved',pending=task.status==='done',returned=task.status==='returned';
      return <Pressable key={task.id} accessibilityRole="button" onPress={()=>go('/parent/tasks')} style={[s.taskRow,i>0&&{borderTopWidth:1,borderTopColor:c.border}]}>
        {done?<Check size={24} color={c.green}/>:pending?<Clock3 size={24} color={c.orange}/>:<Circle size={24} color={c.purple}/>}
        <TaskIcon slug={task.icon} size={30}/><View style={s.fill}><Text style={[s.text,s.bold]}>{task.title}</Text>{!p.selected?<Label small>{task.childName}</Label>:null}<Text style={[s.small,{color:done?c.green:pending||returned?c.orange:c.muted}]}>{t(done?'parentHome.done':pending?'parentHome.waiting':returned?'parentHome.returned':'parentHome.planned')}</Text></View><ChevronRight size={18} color={c.muted}/>
      </Pressable>;
    })}</View>;
  const goals=p.familyDay.map(d=><GoalCard key={d.child.id} child={d.child} balance={d.stars}/>);
  // Exams have no scheduled-at field. Only a real calendar exam can supply a date.
  const prova=<View style={s.card}><View style={[s.row,s.between,s.wrap]}><Heading>{t(p.upcoming?'parentHome.upcomingExam':'parentHome.prova')}</Heading><TextLink label={t('parentHome.viewAll')} href="/parent/prova"/></View>
    {p.upcoming?<View style={s.row}><GraduationCap size={32} color={c.purple}/><View style={s.fill}><Text style={[s.text,s.bold]}>{p.upcoming.event.title}</Text><Label small>{dateFormat.format(new Date(p.upcoming.date+'T12:00:00Z'))}{!p.upcoming.event.all_day?' · '+clock.format(p.upcoming.startsAt):''}</Label></View></View>:<Label>{t('parentHome.provaHint')}</Label>}
    <Action label={t('parentHome.openProva')} onPress={()=>go('/parent/prova')}/>
  </View>;
  const states=p.loading?<View style={s.state} accessibilityLiveRegion="polite"><ActivityIndicator size="large" color={c.purple}/><Label>{t('release.loading')}</Label></View>:p.error?<View style={s.state}><CircleAlert size={36} color={c.orange}/><Heading>{t('release.loadError')}</Heading><Label>{t('parentHome.loadHint')}</Label><Action label={t('common.retry')} primary onPress={p.retry}/></View>:!p.profiles.length?<View style={[s.card,s.state]}><Image source={mascot} style={{width:180,height:120}} resizeMode="contain" accessible={false}/><Heading>{t('release.firstChildTitle')}</Heading><Text style={[s.text,{textAlign:'center',maxWidth:420}]}>{t('release.firstChildBody')}</Text><Action label={t('release.firstChildAction')} primary onPress={()=>go('/parent/menu')}/></View>:null;
  return <SafeAreaView style={s.root}><View style={s.shell}>
    {wide?<View style={s.sidebar}><Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="GINA"/><View style={{gap:8}}>{nav()}</View><View style={s.fill}/><Pressable accessibilityRole="button" onPress={()=>go('/parent/menu')} style={[s.row,{minHeight:58}]}><UserRound size={26} color={c.purple}/><View style={s.fill}><Text style={[s.text,s.bold]}>{p.parentName||t('parentHome.parent')}</Text><Label small>{t('parentHome.parent')}</Label></View><ChevronRight size={16} color={c.muted}/></Pressable></View>:null}
    <View style={s.fill}><ScrollView contentContainerStyle={[s.page,!wide&&s.phonePage]} keyboardShouldPersistTaps="handled">
      <View style={[s.row,s.between]}>{wide?<Text accessibilityRole="header" style={s.title}>{t('parentHome.familySpace')}</Text>:<Image source={logo} style={{width:132,height:50}} resizeMode="contain" accessibilityLabel="GINA"/>}<View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.childSpace')} onPress={()=>go('/parent/child-mode')} style={wide?s.button:s.iconButton}><LockKeyhole size={20} color={c.purple}/>{wide?<Text style={s.buttonLabel}>{t('parentHome.childSpace')}</Text>:null}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('parentHome.notifications')} onPress={()=>go('/parent/notifications')} style={s.iconButton}><Bell size={24} color={c.muted}/></Pressable>
      </View></View>
      {states??<>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
          <Pressable accessibilityRole="button" accessibilityState={{selected:!p.selected}} onPress={()=>p.select(null)} style={[s.chip,!p.selected&&s.selectedChip]}><Users size={22} color={c.muted}/><Text style={[s.small,!p.selected&&s.purple]}>{t(wide?'parent.allChildren':'parentHome.all')}</Text></Pressable>
          {p.profiles.map(child=><Pressable key={child.id} accessibilityRole="button" accessibilityLabel={t('parentHome.selectChild',{name:child.name})} accessibilityState={{selected:p.selected===child.id}} onPress={()=>p.select(child.id)} style={[s.chip,p.selected===child.id&&s.selectedChip]}><Avatar slug={child.avatar} size={36}/><View><Text style={[s.text,p.selected===child.id&&s.purple]}>{child.name}</Text>{child.grade!==null?<Label small>{t('parent.gradeShort',{grade:child.grade})}</Label>:null}</View></Pressable>)}
        </ScrollView>
        <View style={[wide?s.row:undefined,wide&&s.between,{gap:16,flexWrap:'wrap'}]}><View><Text accessibilityRole="header" style={[s.title,!wide&&s.phoneTitle]}>{selectedChild?t('parentHome.childToday',{name:selectedChild.name}):t('parentHome.familyToday')}</Text><Label>{dateFormat.format(new Date(p.today+'T12:00:00Z'))}</Label></View>
          <View style={[s.row,{gap:8},!wide&&{width:'100%'}]}>{([{key:'addTask',href:'/parent/tasks',Icon:Plus,bg:wide?c.purple:c.lavender,color:wide?c.white:c.purple},{key:'prepareProva',href:'/parent/prova/exam',Icon:FileText,bg:c.mint,color:c.green},{key:'addReward',href:'/parent/rewards',Icon:Gift,bg:'#FFE6D1',color:c.orange}] as const).map(({key,href,Icon,bg,color})=><Pressable key={key} accessibilityRole="button" onPress={()=>go(href)} style={({pressed})=>[s.quick,wide&&s.quickWide,{backgroundColor:bg,opacity:pressed?.8:1}]}><Icon size={22} color={color}/><Text style={[s.small,s.bold,{color,textAlign:'center'}]}>{t(`parentHome.${key}`)}</Text></Pressable>)}</View>
        </View>
        <View style={[s.summary,!wide&&s.summaryPhone]}><View style={s.fill}>{wide?<Heading>{t('parentHome.smallSteps')}</Heading>:null}<Text style={[wide?s.text:s.small,{color:c.ink}]}>{t(selectedChild?'parentHome.childWeek':'parentHome.familyWeek',{name:selectedChild?.name,count:p.weeklyCount})}</Text></View><Image source={mascot} resizeMode="contain" accessible={false} style={wide?s.mascot:s.mascotPhone}/></View>
        {!p.selected?<View style={[wide?s.row:undefined,{gap:12,flexWrap:'wrap'}]}>{p.familyDay.map(d=><Pressable key={d.child.id} accessibilityRole="button" accessibilityLabel={t('parentHome.selectChild',{name:d.child.name})} onPress={()=>p.select(d.child.id)} style={[s.card,s.row,{flex:wide?1:undefined,minWidth:220}]}><Avatar slug={d.child.avatar} size={42}/><View style={s.fill}><Text style={[s.text,s.bold]}>{d.child.name}</Text><Label small>{t('parent.tasksOf',{done:d.done,total:d.due})}</Label><Progress value={d.done} max={d.due} label={d.child.name}/></View><Star size={17} color={c.orange}/><Label>{d.stars}</Label><ChevronRight size={16} color={c.muted}/></Pressable>)}</View>:null}
        {wide?<View style={s.columns}><View style={[s.column,{flex:1.45}]}>{plan}{tasks}</View><View style={s.column}>{approvals}{goals}{prova}</View></View>:<>{approvals}{plan}{goals}{tasks}{prova}</>}
        <View style={[s.row,s.wrap,{columnGap:24}]}><TextLink label={t('parent.notes')} href="/parent/notes"/><TextLink label={t('parent.grades')} href="/parent/grades"/><TextLink label={t('share.title')} href="/parent/share"/></View>
        <Pressable accessibilityRole="button" onPress={()=>go('/parent/prova/progress')} style={[s.row,{minHeight:48,paddingHorizontal:8}]}><BookOpen size={20} color={c.green}/><Text style={[s.small,{flex:1}]}>{p.summary}</Text><ChevronRight size={18} color={c.muted}/></Pressable>
      </>}
    </ScrollView>{!wide?<View style={s.bottomNav}>{nav(true)}</View>:null}</View>
  </View></SafeAreaView>;
}
