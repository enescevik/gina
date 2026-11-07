import {useEffect,useRef,useState} from 'react';
import {AppState,Text,View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {isEveningReminder} from '@gina/core';
import {supabase} from '@/lib/supabase';
import {useSession} from '@/lib/session';
import {Button} from '@/components/ui/button';
/** No push, reward, timer mutation or health inference. Counts only this screen's foreground time. */
export function useStudyReminder(childId:string){
 const {t}=useTranslation();const {claims}=useSession();const [elapsed,setElapsed]=useState(0);
 const [now,setNow]=useState(()=>new Date());const [eveningDismissed,setEveningDismissed]=useState(false);
 const active=useRef(AppState.currentState==='active');const last=useRef(0);
 const prefs=useQuery({queryKey:['study_preferences',claims?.family_id,childId],enabled:!!childId,
  queryFn:async()=>{const {data,error}=await supabase.rpc('get_study_preferences',{p_child_id:childId});if(error)throw error;return data?.[0]??null;},refetchInterval:60000});
 useEffect(()=>{
  last.current=Date.now();
  const listener=AppState.addEventListener('change',state=>{active.current=state==='active';last.current=Date.now();});
  const timer=setInterval(()=>{const n=Date.now();if(active.current)setElapsed(v=>v+Math.max(0,Math.min(n-last.current,10000)));last.current=n;setNow(new Date(n));},5000);
  return()=>{listener.remove();clearInterval(timer);};
 },[]);
 const p=prefs.data;if(!p||prefs.error)return null;
 const evening=!eveningDismissed&&isEveningReminder(now,p.timezone,p.evening_start,p.evening_end);
 const due=elapsed>=p.break_minutes*60000;
 if(!evening&&!due)return null;
 return <View style={{backgroundColor:'#E7F7F0',borderRadius:16,padding:12,gap:6}} accessibilityLiveRegion="polite">
  <Text style={{color:'#24203C',fontSize:16}}>{t(evening?'studyPreferences.eveningNotice':'studyPreferences.breakNotice')}</Text>
  <Button variant="ghost" title={t('studyPreferences.understood')} onPress={()=>{setElapsed(0);setEveningDismissed(true);}} />
 </View>;
}
