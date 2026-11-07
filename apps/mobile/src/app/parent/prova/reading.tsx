import { router } from "expo-router";
import { DeferStudyDay } from "@/components/learning/defer-study-day";
import {useFutureLearningReady} from "@/lib/future-learning";
import {NumberChoice} from "@/components/ui/number-choice";
import {TimeChoice} from "@/components/ui/date-time-choice";
import {minutesClock,clockMinutes} from "@gina/core";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
export default function ReadingPreferences(){
  const ready=useFutureLearningReady();
 const {t}=useTranslation();const {claims}=useSession();const family=claims?.family_id;const cache=useQueryClient();
 const [child,setChild]=useState<string|null>(null);const [exam,setExam]=useState<string|null>(null);
 const [historyChild,setHistoryChild]=useState<string|null>(null);
 const {i18n}=useTranslation();
 const history=useQuery({queryKey:["study_preference_history",family,historyChild],enabled:ready&&!!historyChild,retry:false,queryFn:async()=>{
  const {data,error}=await supabase.rpc("get_study_preference_history",{p_child_id:historyChild!});
  if(error?.code==="PGRST202")return null;
  if(error)throw error;return data;
 }});
 const children=useQuery({queryKey:["reading_children",family],enabled:ready&&!!family,queryFn:async()=>{
  const {data,error}=await supabase.from("children").select("id,name,question_reading_enabled,study_break_minutes,evening_reminder_start,evening_reminder_end").eq("family_id",family!).is("archived_at",null).order("sort_order");if(error)throw error;return data;
 }});
 const exams=useQuery({queryKey:["reading_exams",family,child],enabled:ready&&!!child,queryFn:async()=>{
  const {data,error}=await supabase.from("exams").select("id,title,question_reading_override").eq("family_id",family!).eq("child_id",child!).order("created_at",{ascending:false}).limit(10);if(error)throw error;return data;
 }});
 const study=useMutation({mutationFn:async(change:{id:string;study_break_minutes?:number;evening_reminder_start?:number|null;evening_reminder_end?:number})=>{
  const {id,...values}=change;const {error}=await supabase.from("children").update(values).eq("id",id).eq("family_id",family!).select("id").single();if(error)throw error;
 },onSuccess:async()=>{await cache.invalidateQueries({queryKey:["reading_children",family]});await cache.invalidateQueries({queryKey:["study_preferences",family]});await cache.invalidateQueries({queryKey:["study_preference_history",family]});}});
 const save=useMutation({mutationFn:async(change:{kind:"child";id:string;enabled:boolean}|{kind:"exam";id:string;mode:"inherit"|"on"|"off"})=>{
  const result=change.kind==="child"?await supabase.from("children").update({question_reading_enabled:change.enabled}).eq("id",change.id).eq("family_id",family!).select("id").single()
   :await supabase.from("exams").update({question_reading_override:change.mode}).eq("id",change.id).eq("family_id",family!).select("id").single();
  if(result.error)throw result.error;
 },onSuccess:async()=>{await Promise.all([cache.invalidateQueries({queryKey:["reading_children",family]}),cache.invalidateQueries({queryKey:["reading_exams",family]}),cache.invalidateQueries({queryKey:["question_reading_permission",family]}),cache.invalidateQueries({queryKey:["study_preference_history",family]})]);}});
 if(!ready)return <ParentScreen title={t("futureLearning.unavailable")}>{null}</ParentScreen>;
  return <ParentScreen title={t("studyPreferences.title")} subtitle={t("studyPreferences.body")} loading={children.isPending} error={children.error} onRetry={()=>void children.refetch()}>
  <View style={parentStyles.card}>
   <Text accessibilityRole="header" style={parentStyles.title}>{t("studyPermissions.title")}</Text>
   <Text style={parentStyles.copy}>{t("studyPermissions.weeklyHelp")}</Text>
   <Button variant="secondary" title={t("studyPermissions.weekly")} onPress={()=>router.push("/parent/weekly-review")} />
   <Text style={parentStyles.copy}>{t("studyPermissions.teacherHelp")}</Text>
   <Button variant="secondary" title={t("studyPermissions.teacher")} onPress={()=>router.push("/parent/share")} />
  </View>
  {children.data?.map(item=><View key={item.id} style={parentStyles.card}>
   <Text style={parentStyles.title}>{item.name}</Text>
   {family ? <DeferStudyDay childId={item.id} familyId={family} /> : null}
   <NumberChoice label={t("studyPreferences.breakMinutes")} value={item.study_break_minutes} min={10} max={60} presets={[15,20,25,30]} unit={t("studyPreferences.minutes")} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,study_break_minutes:value})} />
   <Toggle label={t("studyPreferences.evening")} value={item.evening_reminder_start!==null} disabled={study.isPending} onChange={on=>study.mutate({id:item.id,evening_reminder_start:on?1260:null})} />
   {item.evening_reminder_start!==null?<View style={{gap:12}}>
    <TimeChoice label={t("studyPreferences.start")} value={minutesClock(item.evening_reminder_start)} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,evening_reminder_start:clockMinutes(value)})} />
    <TimeChoice label={t("studyPreferences.end")} value={minutesClock(item.evening_reminder_end)} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,evening_reminder_end:clockMinutes(value)})} />
   </View>:null}
   <Toggle label={t("questionReading.child",{name:item.name})} value={item.question_reading_enabled} disabled={save.isPending} onChange={enabled=>save.mutate({kind:"child",id:item.id,enabled})} />
   <Button variant="ghost" title={t("studyHistory.title")} accessibilityState={{expanded:historyChild===item.id}} onPress={()=>setHistoryChild(historyChild===item.id?null:item.id)} />
   {historyChild===item.id?<View style={{gap:8}}>
    {history.isPending?<Text style={parentStyles.muted}>{t("studyHistory.loading")}</Text>:null}
    {history.error?<Button variant="ghost" title={t("common.retry")} onPress={()=>void history.refetch()} />:null}
    {history.data===null?<Text style={parentStyles.muted}>{t("futureLearning.unavailable")}</Text>:null}
    {history.data?.length===0?<Text style={parentStyles.muted}>{t("studyHistory.empty")}</Text>:null}
    {history.data?.map(entry=>{
      const value=entry.new_value;
      const display=entry.setting==="break"?t("studyHistory.minutes",{count:Number(value)}):
        entry.setting==="evening_start"||entry.setting==="evening_end"?value===null?t("studyHistory.off"):minutesClock(Number(value)):
        value==="inherit"?t("studyHistory.inherit"):value==="true"||value==="on"?t("studyHistory.on"):t("studyHistory.off");
      return <View key={entry.id} style={{gap:3}}>
       <Text style={parentStyles.copy}>{t(`studyHistory.setting.${entry.setting}`)} · {display}</Text>
       <Text style={parentStyles.muted}>{t(`studyHistory.actor.${entry.actor}`)} · {new Intl.DateTimeFormat(i18n.language,{dateStyle:"medium",timeStyle:"short"}).format(new Date(entry.changed_at))}</Text>
      </View>;
    })}
   </View>:null}
   <Button variant="ghost" title={t("questionReading.examPreferences")} onPress={()=>{setChild(item.id===child?null:item.id);setExam(null);}} />
   {item.id===child?<View style={{gap:8}}>
    <Text style={parentStyles.muted}>{t("questionReading.recent")}</Text>
    {exams.error?<Button variant="ghost" title={t("questionLikes.retry")} onPress={()=>void exams.refetch()} />:null}
    {exams.data?.map(row=><View key={row.id} style={{gap:8}}>
     <Button variant="ghost" title={row.title} accessibilityState={{expanded:exam===row.id}} onPress={()=>setExam(exam===row.id?null:row.id)} />
     {exam===row.id?<View style={{gap:8}}>
      <Toggle label={t("questionReading.inherit")} value={row.question_reading_override==="inherit"} disabled={save.isPending} onChange={inherit=>save.mutate({kind:"exam",id:row.id,mode:inherit?"inherit":"off"})} />
      {row.question_reading_override!=="inherit"?<Toggle label={t("questionReading.allow")} value={row.question_reading_override==="on"} disabled={save.isPending} onChange={enabled=>save.mutate({kind:"exam",id:row.id,mode:enabled?"on":"off"})} />:null}
     </View>:null}
    </View>)}
   </View>:null}
  </View>)}
  {save.error||study.error?<Text accessibilityRole="alert">{t("questionLikes.error")}</Text>:null}
 </ParentScreen>;
}
