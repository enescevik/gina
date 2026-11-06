import {useEffect,useState} from 'react';
import {Platform,Text,View} from 'react-native';
import {router,useLocalSearchParams,type Href} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ParentScreen,parentStyles} from '@/components/ui/parent-screen';
import {Button} from '@/components/ui/button';
import {AuthIssueText,classifyAuthIssue,type AuthIssue} from '@/components/social-sign-in';
import {AuthLinkResend} from '@/components/email-verification';
import {supabase} from '@/lib/supabase';
import {completeOAuthCode,syncAppleProviderToken,takeReauthReturn} from '@/lib/social-auth';
import {readAuthRedirectError,type AuthRedirectError} from '@gina/core';

/** Web: PKCE errors arrive in the query, implicit-flow errors in the fragment. Native: the deep-link query. */
function redirectError(params:{error?:string;error_code?:string;error_description?:string}):AuthRedirectError|null{
 if(Platform.OS==='web'&&typeof window!=='undefined')return readAuthRedirectError(window.location.search,window.location.hash);
 return params.error?readAuthRedirectError(new URLSearchParams(Object.entries(params).filter((e):e is [string,string]=>typeof e[1]==='string')).toString(),''):null;
}

/**
 * OAuth and e-mail confirmation return. Separates: cancelled (back to a usable sign-in), expired/used link
 * (request a new one here), opened in another browser/device (sign in with password), offline, other failure.
 */
export default function AuthCallback(){
 const params=useLocalSearchParams<{code?:string;error?:string;error_code?:string;error_description?:string}>();const {code}=params;const {t}=useTranslation();
 const [issue,setIssue]=useState<AuthIssue|null>(null);const [attempt,setAttempt]=useState(0);
 const [linkError]=useState(()=>redirectError(params));
 useEffect(()=>{let live=true;void(async()=>{
  try{
   if(linkError)throw linkError;
   if(Platform.OS!=='web'){if(!code)throw new Error('missing_code');await completeOAuthCode(code);}
   // Browser client consumes PKCE during initialization; wait for it instead of exchanging twice.
   const {data,error}=await supabase.auth.getSession();if(error)throw error;
   if(!data.session)throw code?{code:'flow_state_not_found'}:new Error('missing_session');
   if(Platform.OS==='web')await syncAppleProviderToken(data.session);
   if(live)router.replace(((Platform.OS==='web'?takeReauthReturn():null)??'/') as Href);
  }catch(e){if(live)setIssue(classifyAuthIssue(e));}
 })();return()=>{live=false;};},[code,linkError,attempt]);
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
