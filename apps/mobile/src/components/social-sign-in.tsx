import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Platform,Text,View,Image,ActivityIndicator} from 'react-native';
import * as Apple from 'expo-apple-authentication';
import {classifyServerError} from '@gina/core';
import {availableSocialProviders,signInSocial} from '@/lib/social-auth';
import {Button} from './ui/button';
import {Pressable} from './ui/pressable';
import {Toggle} from './ui/toggle';
import {parentStyles} from './ui/parent-screen';

/** U01: one user-facing reason per auth failure; the next action depends on it. */
export type AuthIssue='cancelled'|'expired'|'other_device'|'offline'|'session_expired'|'rate_limited'|'invalid_login'|'email_not_confirmed'|'weak_password'|'service'|'failed';

/** Maps Supabase Auth errors and redirect params (`error`, `error_code`) onto U08 categories, then auth-specific reasons. */
export function classifyAuthIssue(input:unknown):AuthIssue{
 const detail=typeof input==='object'&&input!==null?input as {code?:unknown;status?:unknown;name?:unknown;message?:unknown;error?:unknown;error_code?:unknown}:{};
 const code=String(detail.error_code??detail.code??'').toLowerCase();
 const error=String(detail.error??'').toLowerCase();
 const message=String(detail.message??(typeof input==='string'?input:'')).toLowerCase();
 const name=String(detail.name??'');
 if(/otp_expired|flow_state_expired/.test(code))return 'expired';
 if(/flow_state_not_found|bad_code_verifier|code verifier|pkce/.test(code+' '+message))return 'other_device';
 if(error==='access_denied')return 'cancelled';
 if(/invalid_credentials|invalid login credentials/.test(code+' '+message))return 'invalid_login';
 if(/email_not_confirmed/.test(code+' '+message))return 'email_not_confirmed';
 if(/weak_password|same_password/.test(code))return 'weak_password';
 if(/refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|pgrst301/.test(code)||/jwt expired/.test(message))return 'session_expired';
 const network=name==='AuthRetryableFetchError'||/network|failed to fetch|fetch failed|timeout|abort/.test(message);
 const safeCode=/^[a-z][a-z0-9_]{0,63}$/.test(code)?code:undefined;
 const status=typeof detail.status==='number'&&detail.status>0?detail.status:null;
 const classified=classifyServerError({code:safeCode,status,network});
 if(classified.category==='offline')return 'offline';
 if(classified.category==='rate_limited'||/over_email_send_rate_limit|over_request_rate_limit/.test(code))return 'rate_limited';
 if(classified.category==='session_expired')return 'session_expired';
 if(classified.category==='service_unavailable'&&status!==null)return 'service';
 return 'failed';
}

/** i18n key for an auth issue; existing copy is reused where it already says the right thing. */
export function authIssueKey(issue:AuthIssue){
 return ({cancelled:'u01.cancelled',expired:'u01.linkExpired',other_device:'u01.otherDevice',offline:'release.networkError',session_expired:'u01.sessionExpired',rate_limited:'unified.errorRate',invalid_login:'auth.invalidLogin',email_not_confirmed:'unified.errorEmail',weak_password:'unified.errorPassword',service:'u01.serviceDown',failed:'experience.social.failed'} as const)[issue];
}

export function AuthIssueText({issue}:{issue:AuthIssue|null}){
 const {t}=useTranslation();
 if(!issue)return null;
 return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{fontFamily:'Nunito_600SemiBold',color:'#A43135',fontSize:15,lineHeight:22}}>{t(authIssueKey(issue))}</Text>;
}

/**
 * Apple/Google. The adult declaration can be owned by the parent screen (sign-up: one shared statement for
 * social and email); otherwise this block shows its own, because a social sign-in may create an account.
 */
export function SocialSignIn({disabled=false,onBusy,adult:sharedAdult}:{disabled?:boolean;onBusy?:(busy:boolean)=>void;adult?:boolean}){
 const {t}=useTranslation();const providers=useQuery({queryKey:['social_providers'],queryFn:availableSocialProviders,staleTime:60000,retry:1});
 const [ownAdult,setOwnAdult]=useState(false);const [busy,setBusy]=useState(false);const [issue,setIssue]=useState<AuthIssue|null>(null);
 const adult=sharedAdult??ownAdult;
 async function login(provider:'apple'|'google'){
  if(busy||disabled||!adult)return;setBusy(true);onBusy?.(true);setIssue(null);
  try{
   if(await signInSocial(provider))router.replace('/');
   // Web leaves the page for the provider; native `false` means the person closed the sheet.
   else if(Platform.OS!=='web')setIssue('cancelled');
  }catch(e){const next=classifyAuthIssue(e);setIssue(next==='invalid_login'?'failed':next);}finally{setBusy(false);onBusy?.(false);}
 }
 if(providers.isLoading)return null;
 if(providers.error||(!providers.data?.apple&&!providers.data?.google)){
  // Say why there is no Apple/Google button instead of silently hiding it.
  return <View style={{gap:8}}>
   <Text style={parentStyles.muted}>{t(providers.error?'u01.socialUnavailableNow':'u01.socialNotEnabled')}</Text>
   {providers.error?<Button variant="ghost" title={t('common.retry')} disabled={disabled} onPress={()=>void providers.refetch()}/>:null}
  </View>;
 }
 const off=!adult||busy||disabled;
 return <View style={{gap:12}}>
  {sharedAdult===undefined?<Toggle label={t('experience.social.adult')} value={ownAdult} onChange={setOwnAdult} disabled={busy||disabled}/>:null}
  {!adult?<Text style={parentStyles.muted}>{t('u01.socialAdultFirst')}</Text>:null}
  {providers.data.apple&&Platform.OS==='ios'?<View pointerEvents={off?'none':'auto'} style={{opacity:off?.4:1}}><Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE} buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK} cornerRadius={18} style={{height:52,width:'100%'}} onPress={()=>void login('apple')}/></View>:providers.data.apple?<Button variant="secondary" title={t('experience.social.apple')} disabled={off} onPress={()=>void login('apple')}/>:null}
  {providers.data.google?<Pressable accessibilityRole="button" accessibilityLabel={t('experience.social.google')} accessibilityState={{disabled:off,busy}} disabled={off} onPress={()=>void login('google')} style={({pressed})=>({minHeight:52,paddingHorizontal:16,paddingVertical:12,borderRadius:18,borderWidth:1,borderColor:'#747775',backgroundColor:'#FFFFFF',flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12,opacity:off?0.4:(pressed?0.8:1)})}>
    <Image source={require('../../../../packages/assets/auth/google/g-logo.png')} accessible={false} style={{width:20,height:20}} resizeMode="contain"/>
    <Text style={{fontFamily:'GoogleSans_Medium',fontSize:16,lineHeight:22,color:'#1F1F1F',flexShrink:1}}>{t('experience.social.google')}</Text>
    {busy?<ActivityIndicator size="small" color="#1F1F1F"/>:null}
  </Pressable>:null}
  {issue==='cancelled'?<Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t('u01.cancelled')}</Text>:<AuthIssueText issue={issue}/>}
  <Text style={[parentStyles.muted,{textAlign:'center',paddingVertical:8}]}>{t('experience.social.or')}</Text>
 </View>;
}
