import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export function ChildQuestionSignal({attemptId,questionId}:{attemptId:string;questionId:string}) {
  const {t}=useTranslation();
  const {claims}=useSession();
  const family=claims?.family_id;
  const cache=useQueryClient();
  const key=["child_question_signal",family,attemptId,questionId];
  const signal=useQuery({queryKey:key,enabled:!!family,queryFn:async()=>{
    const {data,error}=await supabase.from("question_child_signals").select("liked,struggled")
      .eq("attempt_id",attemptId).eq("question_id",questionId).maybeSingle();
    if(error)throw error;
    return data??{liked:false,struggled:false};
  }});
  const save=useMutation({mutationFn:async(field:"liked"|"struggled")=>{
    if(!family||!signal.data)throw Error("unavailable");
    const {error}=await supabase.rpc("set_question_child_signal",{p_attempt_id:attemptId,
      p_question_id:questionId,p_field:field,p_selected:!signal.data[field]});
    if(error)throw error;
  },onSuccess:async()=>{await cache.invalidateQueries({queryKey:key});}});
  return <View style={{gap:4}}>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
      {(["liked","struggled"] as const).map(field=><Button key={field} variant="ghost"
        title={t(`childSignals.${field}${signal.data?.[field]?"Selected":""}`)}
        accessibilityState={{selected:signal.data?.[field]===true}}
        disabled={!signal.data||!!signal.error||save.isPending}
        onPress={()=>save.mutate(field)} />)}
    </View>
    {save.error||signal.error?<Text accessibilityRole="alert">{t("childSignals.error")}</Text>:null}
  </View>;
}
