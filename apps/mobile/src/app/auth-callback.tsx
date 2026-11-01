import {useEffect,useState} from 'react';
import {Platform} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ParentScreen} from '@/components/ui/parent-screen';
import {Button} from '@/components/ui/button';
import {supabase} from '@/lib/supabase';
import {completeOAuthCode} from '@/lib/social-auth';
export default function AuthCallback(){
 const {code,error:errorParam}=useLocalSearchParams<{code?:string;error?:string}>();const {t}=useTranslation();const [error,setError]=useState<Error|null>(null);
 useEffect(()=>{let live=true;void(async()=>{
  try{
   if(errorParam)throw new Error('oauth_failed');
   if(Platform.OS!=='web'){if(!code)throw new Error('missing_code');await completeOAuthCode(code);}
   // Browser client consumes PKCE during initialization; wait for it instead of exchanging twice.
   const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('missing_session');
   if(live)router.replace('/');
  }catch{if(live)setError(new Error(t('experience.social.noCode')));}
 })();return()=>{live=false;};},[code,errorParam,t]);
 return <ParentScreen navigation={false} title={t('experience.social.callback')} loading={!error} error={error} onRetry={()=>router.replace('/(auth)/sign-in')}><Button title={t('auth.signIn')} onPress={()=>router.replace('/(auth)/sign-in')}/></ParentScreen>;
}
