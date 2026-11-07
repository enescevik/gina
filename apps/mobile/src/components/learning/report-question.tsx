import { useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
const REASONS=["incorrect","unclear","image","inappropriate"] as const;
export function ReportQuestion({questionId,attemptId}:{questionId:string;attemptId?:string}) {
 const {t}=useTranslation();const [open,setOpen]=useState(false);
 const requests=useRef(new Map<string,string>());
 const send=useMutation({mutationFn:async(reason:typeof REASONS[number])=>{
  const identity=`${questionId}:${attemptId??"parent"}:${reason}`;
  let id=requests.current.get(identity);if(!id){id=randomUUID();requests.current.set(identity,id);}
  const {error}=await supabase.rpc("report_question",{p_request_id:id,p_question_id:questionId,p_reason:reason,...(attemptId?{p_attempt_id:attemptId}:{})});
  if(error)throw error;
 }});
 return <View style={{gap:8}}>
  <Button variant="ghost" title={t("questionReports.report")} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} />
  {open?<View style={{gap:8}}>
   <Text>{t("questionReports.help")}</Text>
   {send.isSuccess?<Text accessibilityLiveRegion="polite">{t("questionReports.sent")}</Text>:<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{REASONS.map(reason=><Button style={{flexBasis:"45%",flexGrow:1}} key={reason} variant="secondary" title={t(`questionReports.reasons.${reason}`)} loading={send.isPending&&send.variables===reason} disabled={send.isPending} onPress={()=>send.mutate(reason)} />)}</View>}
   {send.error?<Text accessibilityRole="alert">{t(send.error.message==="question_report_rate_limited"?"questionReports.limited":"questionReports.error")}</Text>:null}
  </View>:null}
 </View>;
}
