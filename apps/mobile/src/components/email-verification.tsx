import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Text,View} from 'react-native';
import {useSession} from '@/lib/session';
import {supabase} from '@/lib/supabase';
import * as Linking from 'expo-linking';
import {Button} from './ui/button';
import {AuthIssueText,classifyAuthIssue,type AuthIssue} from './social-sign-in';
import {Field} from './ui/field';
import {parentStyles} from './ui/parent-screen';
/** Reauthentication for accounts without a password; never accepts a caller-entered email. */
export function EmailVerification({onVerified,onExpired}:{onVerified:()=>void|Promise<void>;onExpired?:()=>void}){
 const {session}=useSession();const {t}=useTranslation();const [sent,setSent]=useState(false);const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 const [verifiedUntil,setVerifiedUntil]=useState(0);
 useEffect(()=>{if(!verifiedUntil)return;const timer=setTimeout(()=>{setVerifiedUntil(0);setSent(false);onExpired?.();},Math.max(0,verifiedUntil-Date.now()));return()=>clearTimeout(timer);},[verifiedUntil,onExpired]);
 const email=session?.user.email;const userId=session?.user.id;
 async function send(){if(busy||!email)return;setBusy(true);setError(false);try{const{error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(error)throw error;setSent(true);}catch{setError(true);}finally{setBusy(false);}}
 async function verify(){if(busy||!email||code.length<6)return;setBusy(true);setError(false);try{const{data,error}=await supabase.auth.verifyOtp({email,token:code,type:'email'});if(error)throw error;if(data.user?.id!==userId){await supabase.auth.signOut({scope:'local'});throw new Error('identity_mismatch');}setCode('');setVerifiedUntil(Date.now()+240000);await onVerified();}catch{setError(true);}finally{setBusy(false);}}
 if(verifiedUntil)return <Text accessibilityLiveRegion="polite" style={[parentStyles.copy,{color:'#247A68'}]}>{t('experience.verify.success')}</Text>;
 return <View style={{gap:12}}><Text style={parentStyles.muted}>{t('experience.verify.help',{email})}</Text>
  {!sent?<Button variant="secondary" title={t('experience.verify.send')} disabled={!email} loading={busy} onPress={()=>void send()}/>:<><Field label={t('experience.verify.code')} keyboardType="number-pad" autoComplete="one-time-code" secureTextEntry value={code} onChangeText={v=>setCode(v.replace(/\D/g,''))} maxLength={10} editable={!busy}/><Button title={t('experience.verify.confirm')} loading={busy} disabled={code.length<6} onPress={()=>void verify()}/><Button variant="ghost" title={t('experience.verify.resend')} disabled={busy} onPress={()=>void send()}/></>}
  {error?<Text accessibilityRole="alert" style={[parentStyles.muted,{color:'#A43135'}]}>{t('experience.verify.failed')}</Text>:null}
 </View>;
}

/**
 * U01: request a fresh link straight from an expired/used one. The answer never says whether the address
 * has an account (same neutral copy for both outcomes).
 */
export function AuthLinkResend({kind,initialEmail=''}:{kind:'signup'|'recovery';initialEmail?:string}){
 const {t}=useTranslation();const [email,setEmail]=useState(initialEmail);const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [issue,setIssue]=useState<AuthIssue|null>(null);
 const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
 async function send(){
  if(busy||!valid)return;setBusy(true);setIssue(null);setSent(false);
  try{
   const result=kind==='recovery'
    ?await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:Linking.createURL('/reset-password')})
    :await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:Linking.createURL('/auth-callback')}});
   if(result.error)throw result.error;setSent(true);
  }catch(e){setIssue(classifyAuthIssue(e));}finally{setBusy(false);}
 }
 return <View style={{gap:12}}>
  <Field label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={v=>{setEmail(v);setSent(false);}} editable={!busy} returnKeyType="send" onSubmitEditing={()=>void send()}/>
  <Button title={t(kind==='recovery'?'accountV5.sendReset':'u01.resendSignup')} loading={busy} disabled={!valid} onPress={()=>void send()}/>
  <AuthIssueText issue={issue}/>
  {sent?<Text accessibilityLiveRegion="polite" style={[parentStyles.copy,{backgroundColor:'#F1EDFD',padding:16,borderRadius:12}]}>{t(kind==='recovery'?'accountV5.resetSent':'u01.resendSent')}</Text>:null}
 </View>;
}
