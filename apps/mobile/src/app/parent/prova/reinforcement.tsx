import { randomUUID } from "expo-crypto";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { newProvaDraft, type ProvaDraft, type ProvaBlock } from "@gina/core";
import { ParentScreen, EmptyCard, parentStyles } from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { persistProvaDraft } from "@/lib/prova-draft";
interface Suggestion { child_id:string; child_name:string; question_id:string; subject:string; topic:string; stem:string; attempt_id:string|null; reason:"struggled"|"focus"; outcome_known:boolean }
export default function Reinforcement() {
  const {t}=useTranslation(); const {claims}=useSession(); const cache=useQueryClient();
  const key=["reinforcement_suggestions",claims?.family_id];
  const starting=useRef(false);
  const prepared=useRef(new Map<string,{id:string;request:string;content:ProvaDraft}>());
  const suggestions=useQuery({queryKey:key,queryFn:async()=>{
    const {data,error}=await supabase.rpc("get_reinforcement_suggestions");if(error)throw error;
    return data as unknown as Suggestion[];
  }});
  const create=useMutation({mutationFn:async(row:Suggestion)=>{
    const identity=`${row.child_id}:${row.question_id}`;
    let entry=prepared.current.get(identity);
    if(!entry){
      const [selection,question]=await Promise.all([
        supabase.rpc("get_reinforcement_questions",{p_child_id:row.child_id,p_question_id:row.question_id}),
        supabase.from("question_bank").select("grade").eq("id",row.question_id).single(),
      ]);
      if(selection.error)throw selection.error;if(question.error)throw question.error;
      if(selection.data.length<3)throw Error("not_enough_questions");
      const originals=await supabase.from("question_bank").select("id,provenance").in("id",selection.data);
      if(originals.error)throw originals.error;
      const blocks: ProvaBlock[]=selection.data.map(id=>{
        const provenance=originals.data.find(q=>q.id===id)?.provenance;
        const generator=provenance&&typeof provenance==="object"&&!Array.isArray(provenance)?provenance.generator:null;
        const source=generator==="gina-library"?"library":generator==="ai"||generator==="ai_edited"?"ai":"manual";
        return {kind:"question",id,source};
      });
      entry={id:randomUUID(),request:randomUUID(),content:{...newProvaDraft(),
        childId:row.child_id,grade:question.data.grade,title:t("reinforcement.warmup"),purpose:"practice",format:"practice",
        subjects:[row.subject],topics:[row.topic],target:selection.data.length,kind:"mixed",step:2,
        blocks,
      }};
      prepared.current.set(identity,entry);
    }
    await persistProvaDraft(entry.id,0,entry.content,entry.request);
    return entry.id;
  },onSuccess:id=>router.push({pathname:"/parent/prova/builder",params:{draftId:id}})});
  const dismiss=useMutation({mutationFn:async(row:Suggestion)=>{
    const {error}=await supabase.rpc("snooze_reinforcement",{p_child_id:row.child_id,p_question_id:row.question_id});
    if(error)throw error;
  },onSuccess:async()=>{await cache.invalidateQueries({queryKey:key});}});
  return <ParentScreen title={t("reinforcement.title")} subtitle={t("reinforcement.body")}
    loading={suggestions.isPending} error={suggestions.error} onRetry={()=>void suggestions.refetch()}>
    {suggestions.data?.length===0?<EmptyCard title={t("reinforcement.empty")} slug="display-bookworm" />:null}
    {suggestions.data?.map(row=><View key={`${row.child_id}:${row.question_id}`} style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t(row.reason==="focus"?"reinforcement.focusReason":"reinforcement.said",{name:row.child_name,topic:row.topic})}</Text>
      <Text style={parentStyles.muted}>{row.subject} · {row.stem}</Text>
      {!row.outcome_known?<Text style={parentStyles.muted}>{t("reinforcement.outcomeMissing")}</Text>:null}
      <Button title={t("reinforcement.shortPractice")} loading={create.isPending&&create.variables?.question_id===row.question_id} disabled={!row.outcome_known||dismiss.isPending||create.isPending}
        onPress={()=>{if(starting.current)return;starting.current=true;create.mutate(row,{onSettled:()=>{starting.current=false;}});}} />
      {row.attempt_id?<Button variant="secondary" title={t("reinforcement.openPlan")} onPress={()=>router.push({pathname:"/parent/prova/repeat/[attemptId]",params:{attemptId:row.attempt_id!}})} />:null}
      <Button variant="ghost" title={t("reinforcement.skip")} disabled={dismiss.isPending} onPress={()=>dismiss.mutate(row)} />
      {(create.error&&create.variables?.child_id===row.child_id&&create.variables?.question_id===row.question_id)||(dismiss.error&&dismiss.variables?.child_id===row.child_id&&dismiss.variables?.question_id===row.question_id)?<Text accessibilityRole="alert">{t(create.error?.message==="not_enough_questions"?"reinforcement.notEnough":"questionLikes.error")}</Text>:null}
    </View>)}
  </ParentScreen>;
}
