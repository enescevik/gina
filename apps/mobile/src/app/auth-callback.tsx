import {useEffect,useState} from 'react';
import {Platform,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ParentScreen,parentStyles} from '@/components/ui/parent-screen';
import {Button} from '@/components/ui/button';
import {AuthIssueText,classifyAuthIssue,type AuthIssue} from '@/components/social-sign-in';
import {AuthLinkResend} from '@/components/email-verification';
import {supabase} from '@/lib/supabase';
import {completeOAuthCode} from '@/lib/social-auth';

/** Web keeps redirect errors in the fragment for the implicit flow; PKCE puts them in the query. */
function fragmentParams():{error?:string;error_code?:string}{
 if(Platform.OS!=='web'||typeof window==='undefined'||!window.location.hash)return {};
 const hash=new URLSearchParams(window.location.hash.slice(1));
 return {error:hash.get('error')??undefined,error_code:hash.get('error_code')??undefined};
}

/**
 * OAuth and e-mail confirmation return. Separates: cancelled (back to a usable sign-in), expired/used link
 * (request a new one here), opened in another browser/device (sign in with password), offline, other failure.
 */
export default function AuthCallback(){
 const params=useLocalSearchParams<{code?:string;error?:string;error_code?:string}>();const {code}=params;const {t}=useTranslation();
 const [issue,setIssue]=useState<AuthIssue|null>(null);const [attempt,setAttempt]=useState(0);
 const errorParam=params.error??fragmentParams().error;const errorCode=params.error_code??fragmentParams().error_code;
 useEffect(()=>{let live=true;void(async()=>{
  try{
   if(errorParam)throw {error:errorParam,error_code:errorCode};
   if(Platform.OS!=='web'){if(!code)throw new Error('missing_code');await completeOAuthCode(code);}
   // Browser client consumes PKCE during initialization; wait for it instead of exchanging twice.
   const {data,error}=await supabase.auth.getSession();if(error)throw error;
   if(!data.session)throw code?{code:'flow_state_not_found'}:new Error('missing_session');
   if(live)router.replace('/');
  }catch(e){if(live)setIssue(classifyAuthIssue(e));}
 })();return()=>{live=false;};},[code,errorParam,errorCode,attempt]);
 const backToSignIn=()=>router.replace('/(auth)/sign-in');
 return <ParentScreen navigation={false} title={t(issue==='cancelled'?'u01.cancelledTitle':issue?'auth.signIn':'experience.social.callback')} loading={!issue}>
  {issue==='cancelled'
   ?<Text accessibilityLiveRegion="polite" style={parentStyles.copy}>{t('u01.cancelled')}</Text>
   :<AuthIssueText issue={issue}/>}
  {issue==='expired'?<View style={[parentStyles.card,{gap:12}]}>
   <Text style={parentStyles.title}>{t('u01.resendTitle')}</Text>
   <Text style={parentStyles.muted}>{t('u01.resendSignupHelp')}</Text>
   <AuthLinkResend kind="signup"/>
  </View>:null}
  {issue==='offline'?<Button title={t('common.retry')} onPress={()=>{setIssue(null);setAttempt(n=>n+1);}}/>:null}
  {issue?<Button variant={issue==='offline'||issue==='expired'?'secondary':'primary'} title={t(issue==='cancelled'||issue==='other_device'?'u01.backToSignIn':'auth.signIn')} onPress={backToSignIn}/>:null}
 </ParentScreen>;
}
