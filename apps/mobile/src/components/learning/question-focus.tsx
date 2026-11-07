import {useFutureLearningReady} from "@/lib/future-learning";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export function QuestionFocus({questionId,grade}:{questionId:string;grade:number}) {
  const ready=useFutureLearningReady();
  const {t}=useTranslation(); const {claims}=useSession(); const family=claims?.family_id;
  const [expanded,setExpanded]=useState(false); const cache=useQueryClient();
  const key=["question_focus",family,questionId];
  const state=useQuery({queryKey:key,enabled:ready&&expanded&&!!family,queryFn:async()=>{
    const [children,focus]=await Promise.all([
      supabase.from("children").select("id,name").eq("family_id",family!).is("archived_at",null).eq("grade",grade).order("sort_order"),
      supabase.from("question_focus").select("child_id,expires_at").eq("question_id",questionId).eq("family_id",family!),
    ]);
    if(children.error)throw children.error;if(focus.error)throw focus.error;
    return {children:children.data,focus:focus.data};
  }});
  const save=useMutation({mutationFn:async({id,selected}:{id:string;selected:boolean})=>{
    const {error}=await supabase.rpc("set_question_focus",{p_child_id:id,p_question_id:questionId,p_selected:selected});
    if(error)throw error;
  },onSuccess:async()=>{await cache.invalidateQueries({queryKey:key});}});
  if(!ready)return null;
  return <View style={{gap:8}}>
    <Button variant="ghost" title={t("reinforcement.focus")} onPress={()=>setExpanded(!expanded)} accessibilityState={{expanded}} />
    {expanded?<View style={{gap:8}}><Text>{t("reinforcement.focusHelp")}</Text>
      {state.data?.children.length===0?<Text>{t("reinforcement.noMatchingChild")}</Text>:null}
      {state.data?.children.map(child=><Toggle key={child.id} label={child.name}
        value={!!state.data.focus.find(row=>row.child_id===child.id&&Date.parse(row.expires_at)>Date.now())}
        disabled={save.isPending} onChange={selected=>save.mutate({id:child.id,selected})} />)}
      {state.error||save.error?<Text accessibilityRole="alert">{t("questionLikes.error")}</Text>:null}
    </View>:null}
  </View>;
}
