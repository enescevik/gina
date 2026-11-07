import {useFutureLearningReady} from "@/lib/future-learning";
import { selectLocalQuestionVoice } from "@gina/core";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { onlineManager, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify);
const getOnline = () => onlineManager.isOnline();

class QuestionReadingTransportError extends Error {}

/** Android needs an installed local voice reported by the native module. */
export function QuestionReader({examId,text,language="tr-TR"}:{examId:string;text:string;language?:string}) {
  const online=useSyncExternalStore(subscribeOnline,getOnline,getOnline);
  const ready=useFutureLearningReady("daily_practice");
  const {t}=useTranslation();const {claims,session}=useSession();const [speaking,setSpeaking]=useState(false);
  const [unavailable,setUnavailable]=useState(false);const generation=useRef(0);
  const permission=useQuery({queryKey:["question_reading_permission",claims?.family_id,claims?.child_id,examId,session?.user.id],
    enabled:ready,queryFn:async()=>{
      const {data,error,status}=await supabase.rpc("get_question_reading_permission",{p_exam_id:examId});
      if(error){
        if(status===0)throw new QuestionReadingTransportError(error.message);
        throw error;
      }
      return data;
    },
    refetchInterval:15000,
  });
  // A request already in flight can fail as Android disconnects. Keep only a previously
  // authorized result for this session and exam, and never fall back after a server denial.
  const canRead=permission.data===true&&(!permission.error||
    (Platform.OS==="android"&&!online&&permission.error instanceof QuestionReadingTransportError));
  const androidVoice=useQuery({
    queryKey:["offline_question_voice",language],
    networkMode:"always",
    enabled:ready&&canRead&&Platform.OS==="android",
    queryFn:async()=>selectLocalQuestionVoice("android",await Speech.getAvailableVoicesAsync(),language),
  });
  useEffect(()=>{
    const stop=()=>{generation.current++;void Speech.stop();setSpeaking(false);};
    const listener=AppState.addEventListener("change",state=>{if(state!=="active")stop();});
    // Cancellation counter, not a rendered node ref; cleanup must invalidate the latest request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return ()=>{listener.remove();generation.current++;void Speech.stop();};
  },[text,language]);
  useEffect(()=>{if(!canRead){const current=++generation.current;void Speech.stop().then(()=>{if(current===generation.current)setSpeaking(false);});}},[canRead]);
  async function read(){
    const current=++generation.current;setUnavailable(false);
    await Speech.stop();setSpeaking(false);
    if(speaking)return;
    // While offline, only an already authorized exam in this session can be read.
    const allowed=Platform.OS==="android"&&!onlineManager.isOnline()
      ? canRead
      : await permission.refetch().then(result=>!result.error&&result.data===true);
    if(current!==generation.current||!allowed)return;
    try {
      const voices=await Speech.getAvailableVoicesAsync();
      const voice=selectLocalQuestionVoice(Platform.OS,voices,language);
      if(current!==generation.current)return;
      if(!voice||text.length>Speech.maxSpeechInputLength){setUnavailable(true);return;}
      setSpeaking(true);
      Speech.speak(text,{language,voice,rate:0.85,...(Platform.OS==="android"?{localOnly:true}:{}),
        onDone:()=>{if(current===generation.current)setSpeaking(false);},
        onStopped:()=>{if(current===generation.current)setSpeaking(false);},
        onError:()=>{if(current===generation.current){setSpeaking(false);setUnavailable(true);}},
      });
    }catch{if(current===generation.current){setSpeaking(false);setUnavailable(true);}}
  }
  if(!ready||!canRead||(Platform.OS==="android"&&!androidVoice.data))return null;
  return <View style={{gap:4}}>
    <Button variant="ghost" title={t(speaking?"questionReading.stop":"questionReading.read")} onPress={()=>void read()} />
    {unavailable?<Text accessibilityRole="alert">{t("questionReading.unavailable")}</Text>:null}
  </View>;
}
