import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export function ChildQuestionSolution({attemptId,questionId}:{attemptId:string;questionId:string}) {
  const {t}=useTranslation();const {claims}=useSession();const [open,setOpen]=useState(false);
  const explanation=useQuery({queryKey:["child_question_solution",claims?.family_id,claims?.child_id,attemptId,questionId],
    enabled:open,queryFn:async()=>{
      const {data,error}=await supabase.rpc("get_child_question_solution",{p_attempt_id:attemptId,p_question_id:questionId});
      if(error)throw error;
      return data as {solution:string|null;explanation:string|null}|null;
    }});
  return <View style={{gap:8}}>
    <Button variant="ghost" title={t(open?"questionSolution.hide":"questionSolution.show")} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} />
    {open?<View style={{gap:8}}>
      {explanation.isPending?<Text>{t("questionSolution.loading")}</Text>:null}
      {explanation.error?<Button variant="ghost" title={t("questionLikes.retry")} onPress={()=>void explanation.refetch()} />:null}
      {!explanation.isPending&&!explanation.error&&!explanation.data?.solution&&!explanation.data?.explanation?<Text>{t("questionSolution.notReady")}</Text>:null}
      {explanation.data?.solution?<Text>{explanation.data.solution}</Text>:null}
      {explanation.data?.explanation?<Text>{explanation.data.explanation}</Text>:null}
    </View>:null}
  </View>;
}
