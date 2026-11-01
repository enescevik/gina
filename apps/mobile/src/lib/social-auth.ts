import {Platform} from 'react-native';
import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {supabase} from './supabase';

// PKCE verifier is persisted by the same Supabase client used for the callback.
WebBrowser.maybeCompleteAuthSession();
let pendingCode: {code:string;promise:Promise<void>}|null=null;
export function completeOAuthCode(code:string){
 if(pendingCode?.code===code)return pendingCode.promise;
 const promise=(async()=>{const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;})();
 pendingCode={code,promise};return promise;
}
export async function availableSocialProviders(){
 const res=await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}});
 if(!res.ok)throw new Error('provider_settings_unavailable');
 const settings=await res.json();
 return {google:settings.external?.google===true,apple:settings.external?.apple===true && (Platform.OS!=='ios'||await Apple.isAvailableAsync())};
}
export async function signInSocial(provider:'apple'|'google'){
 if(provider==='apple'&&Platform.OS==='ios'){
  const nonce=Crypto.randomUUID();const hashed=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,nonce);
  try{
   const credential=await Apple.signInAsync({requestedScopes:[Apple.AppleAuthenticationScope.EMAIL,Apple.AppleAuthenticationScope.FULL_NAME],nonce:hashed});
   if(!credential.identityToken)throw new Error('missing_identity_token');
   const {error}=await supabase.auth.signInWithIdToken({provider:'apple',token:credential.identityToken,nonce});if(error)throw error;
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
