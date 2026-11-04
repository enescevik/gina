import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertPublicBuildEnvironment} from './public-build-env.mjs';
const token=role=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
for(const prefix of ['EXPO_PUBLIC_','NEXT_PUBLIC_']) {
 const env=()=>({[prefix+'SUPABASE_URL']:'https://project.supabase.co',[prefix+'SUPABASE_ANON_KEY']:token('anon')});
 test(prefix+'accepts public credentials and never blocks private server-only env',()=>{
  assert.doesNotThrow(()=>assertPublicBuildEnvironment({...env(),SUPABASE_SERVICE_ROLE_KEY:token('service_role')},prefix));
  assert.doesNotThrow(()=>assertPublicBuildEnvironment({...env(),[prefix+'SUPABASE_ANON_KEY']:'sb_publishable_public-example'},prefix));
 });
 test(prefix+'rejects secrets disguised under the public-key name',()=>{
  for(const value of [token('service_role'),token('authenticated'),'sb_secret_test','not-a-key','']) {
   assert.throws(()=>assertPublicBuildEnvironment({...env(),[prefix+'SUPABASE_ANON_KEY']:value},prefix), e=>!e.message.includes(value||'undefined')&&e.message.includes('public key required'));
  }
 });
 test(prefix+'blocks secret public variables before a bundler can expose them',()=>{
  for(const [name,value] of [[prefix+'SERVICE_ROLE_KEY','hidden'],[prefix+'OTHER',token('service_role')],[prefix+'OTHER','sk-ant-synthetic-private']]){
   assert.throws(()=>assertPublicBuildEnvironment({...env(),[name]:value},prefix),e=>e.message.includes('cannot be bundled')&&!e.message.includes(value));
  }
 });
 test(prefix+'rejects local, credential-bearing and non-origin endpoints',()=>{
  for(const url of ['http://127.0.0.1:54321','https://localhost','https://user:pass@project.supabase.co','https://project.supabase.co/rest/v1','https://project.supabase.co?token=private'])assert.throws(()=>assertPublicBuildEnvironment({...env(),[prefix+'SUPABASE_URL']:url},prefix));
 });
}
