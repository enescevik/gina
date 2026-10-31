import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { localDateOf, occurrencesBetween, templatesDueOn, weekDatesOf } from "@gina/core";


import { Avatar } from "@/components/avatar";
import { DayTimeline } from "@/components/calendar/day-timeline";
import type { WeekEvent } from "@/components/calendar/week-list";
import { CalendarDays, ChevronRight, Plus, Play } from "lucide-react-native";
import { TaskIcon } from "@/components/task-icon";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, ChildPicker } from "@/components/ui/parent-screen";
import { Collectible } from "@/components/collectible";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useFamilyEvents } from "@/lib/use-family-events";

/** Aile saat dilimindeki saate göre selam anahtarı (05–11 sabah, 12–17 gün, diğer akşam). */
function greetingKey(timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "day";
  return "evening";
}

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

/** Veli ana sayfası (onaylı tasarım, resim 2): ailenin günü, onay kuyruğu, bugünün planı, içgörü. */
export default function ParentHomeScreen() {
  const { t, i18n } = useTranslation();
  const { claims, session } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
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

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_task", { p_completion_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSettled: () =>
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family_star_totals", familyId] }),
      ]),
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", weekday: "long" });
  const greeting = greetingKey(timeZone);
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

  const todaysPlan = occurrencesBetween(events.data ?? [], today, today, timeZone, exceptions.data ?? new Set()).filter(
    (o) => !childFilter || o.event.child_id === null || o.event.child_id === childFilter,
  );
  // Çocuğa bağlı olmayan etkinlik tüm çocuklarındır: «Ece ve Can»; tek çocukta adı, hiç yoksa «Tüm aile».
  const allChildNames = (children.data ?? []).map((c) => c.name);
  const whoOf = (event: WeekEvent) => {
    if (event.childName) return event.childName;
    if (allChildNames.length === 0) return t("calendar.allFamily");
    if (allChildNames.length === 1) return allChildNames[0] ?? "";
    return t("parent.namesAnd", { names: allChildNames.slice(0, -1).join(", "), last: allChildNames[allChildNames.length - 1] });
  };

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

  const screenTitle = parentName ? t(`parent.greeting.${greeting}`, { name: parentName }) : t(`parent.greeting.${greeting}NoName`);
  return <Screen home title={screenTitle} subtitle={dateFormat.format(new Date(`${today}T12:00:00Z`))}
    loading={children.isLoading || templates.isLoading || approvals.isLoading}
    error={children.error ?? templates.error ?? completions.error ?? approvals.error ?? events.error ?? me.error}
    onRetry={() => { void children.refetch(); void templates.refetch(); void approvals.refetch(); void completions.refetch(); void events.refetch(); void me.refetch(); }}>
    {children.data?.length === 0 ? <>
      <View style={homeStyles.welcome}>
        <View style={{flexDirection:"row",alignItems:"center",gap:16}}><Avatar slug="avatar-reference-girl" size={76}/><Avatar slug="avatar-reference-boy" size={76}/></View>
        <Text style={homeStyles.welcomeTitle}>{t("release.firstChildTitle")}</Text>
        <Text style={homeStyles.copy}>{t("release.firstChildBody")}</Text>
        <Button title={t("release.firstChildAction")} onPress={()=>router.push("/parent/menu")}/>
      </View>
      <Text style={homeStyles.note}>{t("redesign.firstChildHint")}</Text>
    </> : <>
      <ChildPicker profiles={children.data ?? []} selected={childFilter} onSelect={setChildFilter} allLabel={t("parent.allChildren")} />
      <View style={{gap:12}}>
        <Text accessibilityRole="header" style={homeStyles.section}>{t("parent.familyDay")}</Text>
        {familyDay.map(({child,due,done,stars:childStars})=><Pressable key={child.id} accessibilityRole="button"
          accessibilityLabel={`${child.name}, ${t("parent.tasksOf", {done,total:due})}, ${t("room.starCount",{count:childStars})}`}
          onPress={()=>router.push("/parent/tasks")} style={({pressed})=>[homeStyles.child,{opacity:pressed?.8:1}]}>
          <Avatar slug={child.avatar} size={66}/>
          <View style={{flex:1,gap:5}}><Text style={homeStyles.childName}>{child.name}</Text><Text style={homeStyles.note}>{t("parent.tasksOf",{done,total:due})}</Text>
            <View style={{height:7,borderRadius:8,backgroundColor:"#D8E4DF",overflow:"hidden"}}><View style={{height:7,backgroundColor:"#0B7F7F",width:due?`${Math.min(100,done/due*100)}%`:"0%"}}/></View>
          </View>
          <View style={{alignItems:"center",gap:1}}><Collectible slug="star-filled" size={30}/><Text style={homeStyles.score}>{childStars}</Text></View>
          <ChevronRight size={20} color="#527E72"/>
        </Pressable>)}
      </View>
      <View style={homeStyles.quickActions}>
        <Pressable accessibilityRole="button" onPress={()=>router.push("/parent/tasks")} style={homeStyles.quickAction}><Plus size={24} color="#0B7F7F"/><Text style={homeStyles.actionLabel}>{t("tasks.new")}</Text></Pressable>
        <View style={{width:1,backgroundColor:"#C4DCD0",marginVertical:16}}/>
        <Pressable accessibilityRole="button" onPress={()=>router.push("/parent/child-mode")} style={homeStyles.quickAction}><Play size={24} color="#0B7F7F"/><Text style={homeStyles.actionLabel}>{t("redesign.childSpace")}</Text></Pressable>
      </View>
      <View style={[homeStyles.sectionSurface,pendingApprovals.length>0?{backgroundColor:"#FFF2CC"}:undefined]}>
        <View style={homeStyles.sectionHeading}><Text accessibilityRole="header" style={[homeStyles.section,{flex:1}]}>{t("parent.waitingApproval")}</Text>
          <Text style={homeStyles.count}>{pendingApprovals.length}</Text></View>
        {pendingApprovals.length===0?<Text style={homeStyles.note}>{t("parent.noApprovals")}</Text>:null}
        {pendingApprovals.map(item=><View key={item.id} style={homeStyles.approval}>
          <View style={{flexDirection:"row",alignItems:"center",gap:12}}><TaskIcon slug={item.task_templates?.icon} size={58} variant="illustrated"/><View style={{flex:1}}><Text style={homeStyles.itemTitle}>{item.task_templates?.title}</Text><Text style={homeStyles.note}>{item.children?.name} · {t("room.plusStars",{count:item.task_templates?.stars??0})}</Text></View></View>
          <View style={{flexDirection:"row",gap:10}}><View style={{flex:1}}><Button variant="ghost" title={t("parent.return")} disabled={review.isPending} onPress={()=>review.mutate({id:item.id,approve:false})}/></View><View style={{flex:1}}><Button title={t("parent.approve")} disabled={review.isPending} loading={review.isPending&&review.variables?.id===item.id} onPress={()=>review.mutate({id:item.id,approve:true})}/></View></View>
        </View>)}
        <ErrorText error={review.error}/>
      </View>
      <View style={homeStyles.sectionSurface}>
        <View style={homeStyles.sectionHeading}><Text accessibilityRole="header" style={[homeStyles.section,{flex:1}]}>{t("parent.todaysPlan")}</Text><Pressable accessibilityRole="link" accessibilityLabel={t("parent.openCalendar")} onPress={()=>router.push("/parent/calendar")} style={homeStyles.iconAction}><CalendarDays size={24} color="#0B7F7F"/></Pressable></View>
        {todaysPlan.length===0?<Text style={homeStyles.note}>{t("calendar.noEvents")}</Text>:null}<DayTimeline occurrences={todaysPlan} timeZone={timeZone} whoOf={whoOf}/>
      </View>
      <Pressable accessibilityRole="button" onPress={()=>router.push("/parent/prova/progress")} style={homeStyles.insight}>
        {highlightTemplate?<TaskIcon slug={highlightTemplate.icon} size={60} variant="illustrated"/>:<Collectible slug="display-bookworm" size={60}/>}
        <View style={{flex:1,gap:4}}><Text style={homeStyles.itemTitle}>{t("parent.insightTitle")}</Text><Text style={homeStyles.note}>{highlight&&highlightTemplate&&highlightChild?t("parent.insightHighlight",{child:highlightChild.name,count:highlight.days,task:highlightTemplate.title}):t("parent.insightWeek",{count:weekApproved})}</Text></View><ChevronRight size={22} color="#0B7F7F"/>
      </Pressable>
      <View style={homeStyles.sectionSurface}>
        {([['/parent/prova','prova.title','display-bookworm'],['/parent/rewards','parent.rewards','star-filled'],['/parent/notes','parent.notes','display-first-task']] as const).map(([href,label,slug],i)=><Pressable accessibilityRole="button" key={href} onPress={()=>router.push(href)} style={[homeStyles.destination,i>0?{borderTopWidth:1,borderTopColor:"#E4DAC8"}:undefined]}><Collectible slug={slug} size={44}/><Text style={[homeStyles.itemTitle,{flex:1}]}>{t(label)}</Text><ChevronRight size={22} color="#527E72"/></Pressable>)}
      </View>
    </>}
  </Screen>;
}
const homeStyles=StyleSheet.create({
  section:{fontFamily:"Baloo2_700Bold",fontSize:26,lineHeight:33,color:"#284E4B"},
  sectionHeading:{flexDirection:"row",alignItems:"center",gap:12},
  sectionSurface:{backgroundColor:"#FFFCF6",borderRadius:24,padding:20,gap:14},
  child:{backgroundColor:"#FFFCF6",borderRadius:24,padding:16,flexDirection:"row",alignItems:"center",gap:14,borderWidth:1,borderColor:"#E4DAC8"},
  childName:{fontFamily:"Baloo2_700Bold",fontSize:24,lineHeight:30,color:"#284E4B"},
  score:{fontFamily:"Nunito_700Bold",fontSize:18,color:"#284E4B"},
  note:{fontFamily:"Nunito_400Regular",fontSize:15,lineHeight:22,color:"#425E58"},
  copy:{fontFamily:"Nunito_400Regular",fontSize:18,lineHeight:27,color:"#425E58"},
  quickActions:{flexDirection:"row",backgroundColor:"#E1F2EB",borderRadius:22},
  quickAction:{flex:1,minHeight:76,alignItems:"center",justifyContent:"center",gap:7,padding:12},
  actionLabel:{fontFamily:"Nunito_700Bold",fontSize:16,color:"#284E4B",textAlign:"center"},
  count:{fontFamily:"Nunito_700Bold",fontSize:18,color:"#284E4B",backgroundColor:"#FFD979",borderRadius:18,paddingHorizontal:14,paddingVertical:8},
  approval:{padding:14,gap:12,backgroundColor:"#FFFCF6",borderRadius:20},
  itemTitle:{fontFamily:"Nunito_700Bold",fontSize:18,lineHeight:25,color:"#284E4B"},
  iconAction:{width:48,height:48,alignItems:"center",justifyContent:"center",backgroundColor:"#E1F2EB",borderRadius:16},
  insight:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#E1F2EB",padding:18,borderRadius:24},
  destination:{flexDirection:"row",alignItems:"center",gap:14,minHeight:76},
  welcome:{gap:20,backgroundColor:"#E1F2EB",borderRadius:28,padding:24},
  welcomeTitle:{fontFamily:"Baloo2_700Bold",fontSize:32,lineHeight:39,color:"#284E4B"},
});
