import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Platform,Text,View} from 'react-native';
import * as Apple from 'expo-apple-authentication';
import {availableSocialProviders,signInSocial} from '@/lib/social-auth';
import {Button} from './ui/button';
import {Toggle} from './ui/toggle';
import {parentStyles} from './ui/parent-screen';
export function SocialSignIn({disabled=false,onBusy}:{disabled?:boolean;onBusy?:(busy:boolean)=>void}){
 const {t}=useTranslation();const providers=useQuery({queryKey:['social_providers'],queryFn:availableSocialProviders,staleTime:60000,retry:1});
 const [adult,setAdult]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 async function login(provider:'apple'|'google'){
  if(busy||disabled||!adult)return;setBusy(true);onBusy?.(true);setError(false);
  try{if(await signInSocial(provider))router.replace('/');}catch{setError(true);}finally{setBusy(false);onBusy?.(false);}
 }
 if(!providers.data?.apple&&!providers.data?.google)return null;
 return <View style={{gap:12}}>
  <Toggle label={t('experience.social.adult')} value={adult} onChange={setAdult} disabled={busy||disabled}/>
  {providers.data.apple&&Platform.OS==='ios'?<View pointerEvents={!adult||busy||disabled?'none':'auto'} style={{opacity:adult&&!busy&&!disabled?1:.4}}><Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE} buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK} cornerRadius={18} style={{height:52,width:'100%'}} onPress={()=>void login('apple')}/></View>:providers.data.apple?<Button variant="secondary" title={t('experience.social.apple')} disabled={!adult||busy||disabled} onPress={()=>void login('apple')}/>:null}
  {providers.data.google?<Button variant="secondary" title={t('experience.social.google')} disabled={!adult||busy||disabled} onPress={()=>void login('google')}/>:null}
  {error?<Text accessibilityRole="alert" style={[parentStyles.copy,{color:'#A43135'}]}>{t('experience.social.failed')}</Text>:null}
  <Text style={[parentStyles.muted,{textAlign:'center',paddingVertical:8}]}>{t('experience.social.or')}</Text>
 </View>;
}
