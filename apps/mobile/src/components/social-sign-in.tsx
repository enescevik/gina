import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Platform,Text,View,Image,ActivityIndicator} from 'react-native';
import * as Apple from 'expo-apple-authentication';
import {availableSocialProviders,signInSocial} from '@/lib/social-auth';
import {Button} from './ui/button';
import {Pressable} from './ui/pressable';
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
  {providers.data.google?<Pressable accessibilityRole="button" accessibilityLabel={t('experience.social.google')} accessibilityState={{disabled:!adult||busy||disabled,busy}} disabled={!adult||busy||disabled} onPress={()=>void login('google')} style={({pressed})=>({minHeight:52,paddingHorizontal:16,paddingVertical:12,borderRadius:18,borderWidth:1,borderColor:'#747775',backgroundColor:'#FFFFFF',flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12,opacity:(!adult||busy||disabled)?0.4:(pressed?0.8:1)})}>
    <Image source={require('../../../../packages/assets/auth/google/g-logo.png')} accessible={false} style={{width:20,height:20}} resizeMode="contain"/>
    <Text style={{fontFamily:'GoogleSans_Medium',fontSize:16,lineHeight:22,color:'#1F1F1F',flexShrink:1}}>{t('experience.social.google')}</Text>
    {busy?<ActivityIndicator size="small" color="#1F1F1F"/>:null}
  </Pressable>:null}
  {error?<Text accessibilityRole="alert" style={[parentStyles.copy,{color:'#A43135'}]}>{t('experience.social.failed')}</Text>:null}
  <Text style={[parentStyles.muted,{textAlign:'center',paddingVertical:8}]}>{t('experience.social.or')}</Text>
 </View>;
}
