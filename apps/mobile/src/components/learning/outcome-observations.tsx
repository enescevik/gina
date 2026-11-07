import {useFutureLearningReady} from "@/lib/future-learning";
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Text,View} from 'react-native';
import {outcomeObservationsSchema} from '@gina/core';
import {supabase} from '@/lib/supabase';
import {useSession} from '@/lib/session';
import {parentStyles} from '@/components/ui/parent-screen';
import {Button} from '@/components/ui/button';
export function OutcomeObservations({childId,days,subject,grade,period}:{childId:string;days:number;subject:string;grade:number;period:string}){
  const ready=useFutureLearningReady();
 const {t}=useTranslation();const {claims}=useSession();
 const query=useQuery({queryKey:['outcome_observations',claims?.family_id,childId,days,subject,grade,period],
  enabled:ready,queryFn:async()=>{const {data,error}=await supabase.rpc('learning_outcome_observations',{p_child_id:childId,p_days:days,p_subject:subject||undefined,p_grade:grade||undefined,p_period:period});if(error)throw error;return outcomeObservationsSchema.parse(data);},refetchInterval:60000});
 if(!ready)return null;
  return <View style={parentStyles.card}>
  <Text accessibilityRole="header" style={parentStyles.title}>{t('outcomeObservations.title')}</Text>
  <Text style={parentStyles.muted}>{t('outcomeObservations.help')}</Text>
  {query.isPending?<Text>{t('outcomeObservations.loading')}</Text>:null}
  {query.error?<Button variant="ghost" title={t('common.retry')} onPress={()=>void query.refetch()} />:null}
  {query.data?.length===0?<Text style={parentStyles.copy}>{t('outcomeObservations.empty')}</Text>:null}
  {query.data?.map(row=><View key={row.scope} style={{padding:12,borderRadius:16,gap:6,backgroundColor:row.limited_observation?'#F0ECFC':'#E7F7F0'}}>
   <Text style={parentStyles.copy}>{row.subject} · {t('outcomeObservations.grade',{grade:row.grade})}</Text>
   <Text style={parentStyles.muted}>{row.outcomes.join(' · ')}</Text>
   <Text style={parentStyles.copy}>{row.limited_observation?t('outcomeObservations.limited',{count:row.scored}):t('outcomeObservations.score',{score:row.mean_points,count:row.scored})}</Text>
   {row.mean_points!==null?<View accessible accessibilityLabel={t('outcomeObservations.score',{score:row.mean_points,count:row.scored})} style={{height:8,borderRadius:4,backgroundColor:'#DED8EE',overflow:'hidden'}}><View style={{height:8,width:`${row.mean_points}%`,backgroundColor:'#6C48D8'}} /></View>:null}
   {row.pending>0||row.blank>0?<Text style={parentStyles.muted}>{t('outcomeObservations.excluded',{pending:row.pending,blank:row.blank})}</Text>:null}
  </View>)}
 </View>;
}
