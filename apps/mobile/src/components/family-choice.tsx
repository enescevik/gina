import {useState} from 'react';
import {router} from 'expo-router';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Text,View} from 'react-native';
import {Users,Check} from 'lucide-react-native';
import {parentStyles,InfoCard,NavigationCard} from './ui/parent-screen';
import {Field} from './ui/field';
import {Button} from './ui/button';
import {ErrorText} from './ui/screen';
import {myFamilies,type FamilyChoice} from '@/lib/family-experience';
import {supabase} from '@/lib/supabase';
import {refreshClaims} from '@/lib/session';

export function FamilyChoicePanel(){
 const {t}=useTranslation();const qc=useQueryClient();
 const [code,setCode]=useState('');const [previewCode,setPreviewCode]=useState('');const [preview,setPreview]=useState<FamilyChoice|null>(null);const [choice,setChoice]=useState<FamilyChoice|null>(null);
 const families=useQuery({queryKey:['my_families'],queryFn:myFamilies});
 const inspect=useMutation({mutationFn:async(requestedCode:string)=>{
  const {data,error}=await supabase.rpc('preview_family_invite',{p_invite_code:requestedCode});if(error)throw error;
  const result=data as unknown as FamilyChoice;
  if(result.error)throw new Error(t(`experience.errors.${result.error}`));
  return result;
 },onSuccess:(v,requestedCode)=>{setPreviewCode(requestedCode);setPreview(v);setChoice(v);}});
 const join=useMutation({mutationFn:async()=>{
  if(!choice)return;
  if(preview?.id===choice.id&&!choice.already_member){
   const {data,error}=await supabase.rpc('join_family',{p_invite_code:previewCode});if(error)throw error;
   if(!data)throw new Error(t('experience.errors.invalid_invite_code'));
  }else{
   const {error}=await supabase.rpc('select_family',{p_family_id:choice.id});if(error)throw error;
  }
  await refreshClaims();
 },onSuccess:()=>{qc.clear();router.replace('/parent');}});
 return <>
  <InfoCard title={t('experience.family.explainerTitle')} body={t('experience.family.explainer')}/>
  <View style={parentStyles.card}>
   <Text style={parentStyles.title}>{t('experience.family.yours')}</Text>
   {families.data?.map(f=><NavigationCard key={f.id} title={f.name} body={t(f.active?'experience.family.current':'experience.family.children',{count:f.children})} icon={f.active?<Check color="#247A68"/>:<Users color="#6042DE"/>} onPress={()=>{if(!join.isPending&&!inspect.isPending){setChoice(f);setPreview(null);join.reset();}}}/>)}
   <ErrorText error={families.error}/>{families.error?<Button variant="ghost" title={t('common.retry')} onPress={()=>void families.refetch()}/>:null}
   {!families.data?.length&&!families.isLoading?<Text style={parentStyles.muted}>{t('experience.family.noFamily')}</Text>:null}
  </View>
  <View style={parentStyles.form}>
   <Text style={parentStyles.title}>{t('experience.family.joinTitle')}</Text>
   <Text style={parentStyles.muted}>{t('auth1.family.codeHelpPath')}</Text>
   <Field label={t('parent.inviteCode')} maxLength={8} autoCapitalize="characters" editable={!join.isPending&&!inspect.isPending} value={code} onChangeText={v=>{setCode(v.replace(/[^a-f0-9]/gi,'').toUpperCase());setPreview(null);setChoice(null);inspect.reset();join.reset();}}/>
   <Button title={t('experience.family.preview')} loading={inspect.isPending} disabled={code.length!==8||join.isPending} onPress={()=>inspect.mutate(code)}/>
   <ErrorText error={inspect.error}/>
  </View>
  {choice?<View style={parentStyles.card}>
   <Text style={parentStyles.title}>{choice.name}</Text>
   <Text style={parentStyles.copy}>{t('experience.family.children',{count:choice.children})}</Text>
   <Text style={parentStyles.copy}>{t('experience.family.preserve')}</Text>
   <InfoCard title={t('experience.family.duplicatesTitle')} body={t('experience.family.duplicates')}/>
   <ErrorText error={join.error}/>
   <Button title={t('experience.family.useThis')} loading={join.isPending} onPress={()=>join.mutate()}/>
   <Button variant="ghost" title={t('common.cancel')} disabled={join.isPending} onPress={()=>{setChoice(null);setPreview(null);}}/>
  </View>:null}
 </>;
}
