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
 const {t}=useTranslation();const {claims}=useSession();const family=claims?.family_id;const cache=useQueryClient();
 const [child,setChild]=useState<string|null>(null);const [exam,setExam]=useState<string|null>(null);
 const children=useQuery({queryKey:["reading_children",family],queryFn:async()=>{
  const {data,error}=await supabase.from("children").select("id,name,question_reading_enabled,study_break_minutes,evening_reminder_start,evening_reminder_end").eq("family_id",family!).is("archived_at",null).order("sort_order");if(error)throw error;return data;
 }});
 const exams=useQuery({queryKey:["reading_exams",family,child],enabled:!!child,queryFn:async()=>{
  const {data,error}=await supabase.from("exams").select("id,title,question_reading_override").eq("family_id",family!).eq("child_id",child!).order("created_at",{ascending:false}).limit(10);if(error)throw error;return data;
 }});
 const study=useMutation({mutationFn:async(change:{id:string;study_break_minutes?:number;evening_reminder_start?:number|null;evening_reminder_end?:number})=>{
  const {id,...values}=change;const {error}=await supabase.from("children").update(values).eq("id",id).eq("family_id",family!).select("id").single();if(error)throw error;
 },onSuccess:async()=>{await cache.invalidateQueries({queryKey:["reading_children",family]});await cache.invalidateQueries({queryKey:["study_preferences",family]});}});
 const save=useMutation({mutationFn:async(change:{kind:"child";id:string;enabled:boolean}|{kind:"exam";id:string;mode:"inherit"|"on"|"off"})=>{
  const result=change.kind==="child"?await supabase.from("children").update({question_reading_enabled:change.enabled}).eq("id",change.id).eq("family_id",family!).select("id").single()
   :await supabase.from("exams").update({question_reading_override:change.mode}).eq("id",change.id).eq("family_id",family!).select("id").single();
  if(result.error)throw result.error;
 },onSuccess:async()=>{await Promise.all([cache.invalidateQueries({queryKey:["reading_children",family]}),cache.invalidateQueries({queryKey:["reading_exams",family]}),cache.invalidateQueries({queryKey:["question_reading_permission",family]})]);}});
 return <ParentScreen title={t("studyPreferences.title")} subtitle={t("studyPreferences.body")} loading={children.isPending} error={children.error} onRetry={()=>void children.refetch()}>
  {children.data?.map(item=><View key={item.id} style={parentStyles.card}>
   <Text style={parentStyles.title}>{item.name}</Text>
   <NumberChoice label={t("studyPreferences.breakMinutes")} value={item.study_break_minutes} min={10} max={60} presets={[15,20,25,30]} unit={t("studyPreferences.minutes")} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,study_break_minutes:value})} />
   <Toggle label={t("studyPreferences.evening")} value={item.evening_reminder_start!==null} disabled={study.isPending} onChange={on=>study.mutate({id:item.id,evening_reminder_start:on?1260:null})} />
   {item.evening_reminder_start!==null?<View style={{gap:12}}>
    <TimeChoice label={t("studyPreferences.start")} value={minutesClock(item.evening_reminder_start)} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,evening_reminder_start:clockMinutes(value)})} />
    <TimeChoice label={t("studyPreferences.end")} value={minutesClock(item.evening_reminder_end)} disabled={study.isPending} onChange={value=>study.mutate({id:item.id,evening_reminder_end:clockMinutes(value)})} />
   </View>:null}
   <Toggle label={t("questionReading.child",{name:item.name})} value={item.question_reading_enabled} disabled={save.isPending} onChange={enabled=>save.mutate({kind:"child",id:item.id,enabled})} />
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
