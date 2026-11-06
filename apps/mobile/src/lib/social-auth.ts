import {Platform} from 'react-native';
import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';

// PKCE verifier is persisted by the same Supabase client used for the callback.
WebBrowser.maybeCompleteAuthSession();

/**
 * H01: hand Apple's one-time authorization code (iOS) or the provider refresh token Supabase returns after the
 * Apple OAuth flow (web/Android) to the server, which keeps it encrypted for revocation at account deletion.
 * Best-effort: a failure never blocks sign-in (deletion then asks for a fresh Apple sign-in). Values are never
 * logged or kept here.
 */
async function storeAppleToken(body:{authorization_code:string}|{refresh_token:string}){
 try{await supabase.functions.invoke('apple-token',{body});}catch{/* deletion falls back to Apple re-authentication */}
}
const sentProviderTokens=new Set<string>();
export async function syncAppleProviderToken(session:Session|null|undefined){
 const token=session?.provider_refresh_token;
 if(!token||!session.user.identities?.some(i=>i.provider==='apple')||sentProviderTokens.has(token))return;
 sentProviderTokens.add(token);await storeAppleToken({refresh_token:token});
}
export function hasAppleIdentity(session:Session|null|undefined){return !!session?.user.identities?.some(i=>i.provider==='apple');}

let pendingCode: {code:string;promise:Promise<void>}|null=null;
export function completeOAuthCode(code:string){
 if(pendingCode?.code===code)return pendingCode.promise;
 const promise=(async()=>{const {data,error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;await syncAppleProviderToken(data.session);})();
 pendingCode={code,promise};return promise;
}
export async function availableSocialProviders(){
 const res=await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}});
 if(!res.ok)throw new Error('provider_settings_unavailable');
 const settings=await res.json();
 return {google:settings.external?.google===true,apple:settings.external?.apple===true && (Platform.OS!=='ios'||await Apple.isAvailableAsync())};
}
async function nativeApple(){
 const nonce=Crypto.randomUUID();const hashed=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,nonce);
 const credential=await Apple.signInAsync({requestedScopes:[Apple.AppleAuthenticationScope.EMAIL,Apple.AppleAuthenticationScope.FULL_NAME],nonce:hashed});
 if(!credential.identityToken)throw new Error('missing_identity_token');
 return {nonce,identityToken:credential.identityToken,authorizationCode:credential.authorizationCode};
}
export async function signInSocial(provider:'apple'|'google'){
 if(provider==='apple'&&Platform.OS==='ios'){
  try{
   const credential=await nativeApple();
   const {error}=await supabase.auth.signInWithIdToken({provider:'apple',token:credential.identityToken,nonce:credential.nonce});if(error)throw error;
   if(credential.authorizationCode)void storeAppleToken({authorization_code:credential.authorizationCode});
   return true;
  }catch(e){if((e as {code?:string}).code==='ERR_REQUEST_CANCELED')return false;throw e;}
 }
 const redirectTo=Linking.createURL('/auth-callback');
 const {data,error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo,skipBrowserRedirect:Platform.OS!=='web',queryParams:provider==='google'?{prompt:'select_account'}:undefined}});
 if(error)throw error;
 if(Platform.OS==='web')return false;
 const result=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);
 if(result.type!=='success')return false;
 const code=new URL(result.url).searchParams.get('code');
 if(!code)throw new Error('oauth_callback_missing_code');
 await completeOAuthCode(code);return true;
}

const REAUTH_RETURN='gina.appleReauthReturn';
/** Web: the in-app path to return to after an Apple re-authentication redirect (same-origin paths only). */
export function takeReauthReturn():`/${string}`|null{
 try{
  const path=sessionStorage.getItem(REAUTH_RETURN);sessionStorage.removeItem(REAUTH_RETURN);
  return path&&/^\/(?!\/)[A-Za-z0-9/_()-]*$/.test(path)?path as `/${string}`:null;
 }catch{return null;}
}
export type AppleReauth=
 |{reauthentication:'apple';apple_identity_token:string;apple_nonce:string;apple_authorization_code?:string}
 |{reauthentication:'apple_oauth'};
/** Fresh Supabase Apple OAuth sign-in (web/Android) — the server accepts amr "oauth" for 5 minutes. */
export function freshAppleOAuth(session:Session|null|undefined,maxAgeSeconds=240){
 try{
  const part=session?.access_token.split('.')[1];if(!part)return false;
  const claims=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));const now=Date.now()/1000;
  return Array.isArray(claims.amr)&&claims.amr.some((a:{method?:string;timestamp?:number})=>a.method==='oauth'&&typeof a.timestamp==='number'&&now-a.timestamp<=maxAgeSeconds);
 }catch{return false;}
}
/**
 * Re-authenticate with Apple before account deletion. iOS: native sheet → identity token + fresh authorization
 * code for the server (nothing is signed in on the device). Android: Apple OAuth in the auth session, returning a
 * fresh session. Web: redirects away (returns 'redirected'); the user reopens deletion within 4 minutes.
 * Returns null when the user cancels.
 */
export async function appleReauthenticate():Promise<AppleReauth|'redirected'|null>{
 if(Platform.OS==='ios'){
  try{
   const c=await nativeApple();
   return {reauthentication:'apple',apple_identity_token:c.identityToken,apple_nonce:c.nonce,...(c.authorizationCode?{apple_authorization_code:c.authorizationCode}:{})};
  }catch(e){if((e as {code?:string}).code==='ERR_REQUEST_CANCELED')return null;throw e;}
 }
 if(Platform.OS==='web'){
  try{sessionStorage.setItem(REAUTH_RETURN,window.location.pathname);}catch{/* lands on home instead */}
  await signInSocial('apple');return 'redirected';
 }
 const done=await signInSocial('apple');
 return done?{reauthentication:'apple_oauth'}:null;
}
