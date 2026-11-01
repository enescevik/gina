import {useEffect,useRef,useState} from 'react';
import {router} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Text,View,ActivityIndicator} from 'react-native';
import {BookOpen,ClipboardCheck,Check} from 'lucide-react-native';
import {ParentScreen as Screen,parentStyles,ChildPicker,InfoCard,NavigationCard} from '@/components/ui/parent-screen';
import {Button} from '@/components/ui/button';
import {Field} from '@/components/ui/field';
import {Toggle} from '@/components/ui/toggle';
import {Pressable} from '@/components/ui/pressable';
import {ErrorText} from '@/components/ui/screen';
import {QuestionCard} from '@/components/prova-question-review';
import {invokeProvaAi,type GenerateResponse,type GeneratedQuestion,provaErrorMessage} from '@/lib/prova-ai';
import {preferences} from '@/lib/preferences';
import {useSession} from '@/lib/session';
import {supabase} from '@/lib/supabase';

type Kind='mixed'|'multiple_choice'|'open_ended';
type Difficulty='kolay'|'orta'|'orta_ustu'|'zor';
interface Entitlement{scenarios:boolean;ai_generate_limit:number;ai_generate_used:number}
export default function GenerateQuestionsScreen(){
 const {t,i18n}=useTranslation();const {claims,session}=useSession();const qc=useQueryClient();const familyId=claims?.family_id??'';
 const [step,setStep]=useState(0);const [quick,setQuick]=useState(false);const interacted=useRef(false);
 const [purpose,setPurpose]=useState<'bank'|'exam'>('exam');const [child,setChild]=useState<string|null>(null);
 const [subject,setSubject]=useState('');const [grade,setGrade]=useState('5');const [topic,setTopic]=useState('');
 const [blueprint,setBlueprint]=useState<string|null>(null);const [count,setCount]=useState('5');const [kind,setKind]=useState<Kind>('mixed');const [difficulty,setDifficulty]=useState<Difficulty>('orta_ustu');
 const [title,setTitle]=useState('');const [timed,setTimed]=useState(false);const [minutes,setMinutes]=useState('20');
 const [result,setResult]=useState<GeneratedQuestion[]|null>(null);const [selected,setSelected]=useState<string[]>([]);const [reviewed,setReviewed]=useState(false);
 const examId=useRef(Crypto.randomUUID());
 const generationRequest=useRef<{body:string;id:string}|null>(null);
 const preference=`gina-ai-guidance:${session?.user.id}`;
 useEffect(()=>{let live=true;void preferences.get(preference).then(v=>{if(live&&!interacted.current)setQuick(v==='quick');}).catch(()=>{});return()=>{live=false;};},[preference]);
 const children=useQuery({queryKey:['children'],queryFn:async()=>{const{data,error}=await supabase.from('children').select('id,name,avatar,grade').order('sort_order');if(error)throw error;return data;}});
 const ent=useQuery({queryKey:['prova_entitlement',familyId],queryFn:async()=>{const{data,error}=await supabase.rpc('get_prova_entitlement');if(error)throw error;return data as unknown as Entitlement;}});
 const blueprints=useQuery({queryKey:['blueprints',familyId],queryFn:async()=>{const{data,error}=await supabase.from('exam_blueprints').select('id,name,subject,grade,rows').order('created_at',{ascending:false});if(error)throw error;return data;}});
 const bp=blueprints.data?.find(b=>b.id===blueprint);
 const remaining=ent.data?Math.max(0,ent.data.ai_generate_limit-ent.data.ai_generate_used):0;
 const validPurpose=purpose==='bank'||!!child;
 const validTopic=!!bp||!!subject.trim()&&!!topic.trim()&&Number.isInteger(+grade)&&+grade>=1&&+grade<=12;
 const validCount=Number.isInteger(+count)&&+count>=1&&+count<=30;
 const validTime=!timed||Number.isInteger(+minutes)&&+minutes>=1&&+minutes<=180;
 const generate=useMutation({mutationFn:async()=>{
  if(!validPurpose||!validTopic||!validCount||!validTime)throw new Error(t('release.invalidForm'));
  const body={subject:bp?.subject??subject.trim(),grade:bp?.grade??+grade,topic:topic.trim(),blueprint_id:bp?.id??null,count:+count,kind,difficulty,locale:i18n.language.startsWith('en')?'en':'tr'};
  const key=JSON.stringify(body);if(generationRequest.current?.body!==key)generationRequest.current={body:key,id:Crypto.randomUUID()};
  return invokeProvaAi<GenerateResponse>('prova-generate',{...body,request_id:generationRequest.current.id});
 },onSuccess:data=>{setResult(data.questions);setSelected(data.questions.map(q=>q.id));setReviewed(false);examId.current=Crypto.randomUUID();void preferences.set(preference,'quick').catch(()=>{});void qc.invalidateQueries({predicate:q=>['prova_entitlement','question_bank','question_bank_count','booklet_library'].includes(String(q.queryKey[0]))});}});
 const assign=useMutation({mutationFn:async()=>{
  if(!reviewed||!selected.length||!child||!validTime)throw new Error(t('release.invalidForm'));
  const {error}=await supabase.from('exams').insert({id:examId.current,family_id:familyId,child_id:child,blueprint_id:bp?.id??null,title:title.trim()||`${bp?.subject??subject.trim()} · ${t('prova.title')}`,subject:bp?.subject??subject.trim(),grade:bp?.grade??+grade,question_ids:selected,timed,duration_minutes:timed?+minutes:null,status:'assigned',created_by:session?.user.id??null});
  if(error){if(error.code!=='23505')throw error;const existing=await supabase.from('exams').select('id').eq('id',examId.current).single();if(existing.error)throw error;}
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:['exams',familyId]});}});
 function choice<T extends string>(values:T[],value:T,set:(v:T)=>void,label:(v:T)=>string){return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{values.map(v=><Pressable key={v} accessibilityRole="radio" accessibilityState={{checked:v===value}} disabled={generate.isPending} onPress={()=>set(v)} style={{minHeight:48,paddingHorizontal:16,paddingVertical:12,borderRadius:22,borderWidth:1,borderColor:v===value?'#6042DE':'#E3DDED',backgroundColor:v===value?'#EEE8FA':'#FFFFFF'}}><Text style={[parentStyles.copy,{fontFamily:'Nunito_700Bold'}]}>{label(v)}</Text></Pressable>)}</View>;}
 if(assign.isSuccess)return <Screen title={t('experience.ai.assigned')}><InfoCard title={t('experience.ai.assigned')} body={t('experience.ai.assignedBody')}><Check color="#247A68" size={38}/></InfoCard><Button title={t('prova.backToList')} onPress={()=>router.replace('/parent/prova')}/></Screen>;
 if(result)return <Screen title={t('prova.ai.generatedTitle')} subtitle={t('experience.ai.savedHelp')}>
  {result.map((q,i)=><View key={q.id} style={{gap:8}}><QuestionCard index={i+1} question={q}/>{purpose==='exam'?<Toggle label={`${i+1}. ${t('experience.ai.include')}`} value={selected.includes(q.id)} onChange={v=>{setSelected(v?[...selected,q.id]:selected.filter(id=>id!==q.id));setReviewed(false);}} disabled={assign.isPending}/>:null}</View>)}
  {purpose==='exam'?<View style={parentStyles.form}>
   <Text style={parentStyles.title}>{t('experience.ai.selected',{count:selected.length})}</Text>
   <Toggle label={t('experience.ai.reviewed')} value={reviewed} onChange={setReviewed} disabled={assign.isPending}/>
   <ErrorText error={assign.error?new Error(provaErrorMessage(assign.error)??t('experience.ai.generationError')):null}/>
   <Button title={t('experience.ai.assign')} disabled={!reviewed||!selected.length} loading={assign.isPending} onPress={()=>assign.mutate()}/>
  </View>:null}
  <Text style={parentStyles.muted}>{t('experience.ai.learned')}</Text>
  <Button variant="ghost" title={t('prova.ai.generateMore')} disabled={assign.isPending} onPress={()=>{setResult(null);generationRequest.current=null;generate.reset();assign.reset();setQuick(true);}}/>
  <Button variant="ghost" title={t('prova.backToList')} disabled={assign.isPending} onPress={()=>router.replace('/parent/prova')}/>
 </Screen>;
 return <Screen title={t('experience.ai.title')} subtitle={t('experience.ai.body')} loading={ent.isLoading||children.isLoading||blueprints.isLoading} error={ent.error??children.error??blueprints.error} onRetry={()=>{void ent.refetch();void children.refetch();void blueprints.refetch();}}>
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
   <Text style={parentStyles.muted}>{t('prova.ai.quotaLeft',{count:remaining})}</Text>
   <Button variant="ghost" title={t(quick?'experience.ai.guided':'experience.ai.quick')} disabled={generate.isPending} onPress={()=>{interacted.current=true;setQuick(!quick);void preferences.set(preference,!quick?'quick':'guided').catch(()=>{});}}/>
  </View>
  {!quick?<View style={{flexDirection:'row',gap:8}}>{[0,1,2].map(n=><View key={n} style={{flex:1,gap:6}}><View style={{height:4,borderRadius:2,backgroundColor:n<=step?'#6042DE':'#E8E0F3'}}/><Text style={[parentStyles.muted,{fontFamily:step===n?'Nunito_800ExtraBold':'Nunito_400Regular'}]}>{t(`experience.ai.step${n+1}`)}</Text></View>)}</View>:null}
  {quick||step===0?<View style={parentStyles.card}>
   <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>{(['exam','bank'] as const).map(v=>{
     const Icon=v==='exam'?ClipboardCheck:BookOpen;
     return <Pressable key={v} accessibilityRole="radio" accessibilityState={{checked:purpose===v}} disabled={generate.isPending} onPress={()=>setPurpose(v)} style={{flexGrow:1,flexBasis:230,minWidth:220,minHeight:140,gap:10,padding:18,borderRadius:22,borderWidth:2,borderColor:purpose===v?'#6042DE':'#E7E0EF',backgroundColor:purpose===v?'#F2EDFF':'#FCFAF6'}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Icon color="#6042DE" size={26}/><Text style={[parentStyles.copy,{flex:1,fontFamily:'Nunito_800ExtraBold'}]}>{t(`experience.ai.${v}`)}</Text>{purpose===v?<Check color="#6042DE" size={20}/>:null}</View>
      <Text style={parentStyles.muted}>{t(`experience.ai.${v}Help`)}</Text>
     </Pressable>;
   })}</View>
   {purpose==='exam'?<><ChildPicker profiles={children.data??[]} selected={child} onSelect={id=>{if(generate.isPending)return;setChild(id);const c=children.data?.find(c=>c.id===id);if(c?.grade)setGrade(String(c.grade));}}/>{!children.data?.length?<NavigationCard title={t('experience.ai.noChild')} onPress={()=>router.push('/parent/menu?section=family')}/>:null}<Field label={t('experience.ai.titleLabel')} value={title} onChangeText={setTitle} maxLength={120} editable={!generate.isPending}/><Toggle label={t('experience.ai.timed')} value={timed} onChange={setTimed} disabled={generate.isPending}/>{timed?<Field label={t('experience.ai.minutes')} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={3} editable={!generate.isPending}/>:null}</>:null}
  </View>:null}
  {quick||step===1?<View style={parentStyles.card}>
   {ent.data?.scenarios&&blueprints.data?.length?choice(['',...blueprints.data.map(b=>b.id)],blueprint??'',v=>setBlueprint(v||null),v=>blueprints.data?.find(b=>b.id===v)?.name??t('prova.noBlueprint')):null}
   {!bp?<><View style={{flexDirection:'row',gap:12}}><View style={{flex:2}}><Field label={t('grades.subject')} value={subject} onChangeText={setSubject} maxLength={80} editable={!generate.isPending}/></View><View style={{flex:1}}><Field label={t('prova.grade')} value={grade} onChangeText={setGrade} keyboardType="number-pad" maxLength={2} editable={!generate.isPending}/></View></View><Field label={t('prova.topic')} value={topic} onChangeText={setTopic} maxLength={200} editable={!generate.isPending}/></>:null}
   <Field label={t('prova.ai.count')} value={count} onChangeText={setCount} keyboardType="number-pad" maxLength={2} editable={!generate.isPending}/>
   {bp?<Text style={parentStyles.muted}>{t('prova.ai.blueprintCountHint')}</Text>:null}
   {choice<Kind>(['mixed','multiple_choice','open_ended'],kind,setKind,v=>t(v==='mixed'?'prova.ai.kindMixed':`prova.kind.${v}`))}
   {choice<Difficulty>(['kolay','orta','orta_ustu','zor'],difficulty,setDifficulty,v=>t(`prova.difficulty.${v}`))}
  </View>:null}
  {quick||step===2?<InfoCard title={t('experience.ai.review')} body={t('experience.ai.reviewBody')}><Text style={parentStyles.copy}>{[purpose==='exam'?children.data?.find(c=>c.id===child)?.name:t('experience.ai.bank'),bp?.subject??subject,bp?.name??topic,t(`prova.difficulty.${difficulty}`)].filter(Boolean).join(' · ')}</Text></InfoCard>:null}
  {generate.isPending?<View accessibilityLiveRegion="polite" style={parentStyles.form}><ActivityIndicator color="#6042DE"/><Text style={parentStyles.title}>{t('experience.ai.preparing')}</Text><Text style={parentStyles.muted}>{t('experience.ai.preparingHelp')}</Text></View>:null}
  <ErrorText error={generate.error}/>
  {ent.data&&ent.data.ai_generate_limit<=0?<InfoCard title={t('prova.ai.needsPlus')} body={t('prova.ai.generateIntro')}/>:null}
  {quick||step===2?<Button title={t('prova.ai.generate')} loading={generate.isPending} disabled={!remaining||!validPurpose||!validTopic||!validCount||!validTime} onPress={()=>generate.mutate()}/>:<Button title={t('experience.ai.next')} disabled={step===0?(!validPurpose||!validTime):(!validTopic||!validCount)} onPress={()=>setStep(step+1)}/>}
  {!quick&&step>0?<Button variant="ghost" title={t('experience.ai.previous')} disabled={generate.isPending} onPress={()=>setStep(step-1)}/>:null}
 </Screen>;
}
