import { json, preflight } from "../_shared/supabase.ts";
import type { StoreState } from "../_shared/iap.ts";
export interface Command { id:string; family:string; subscription:string; reason:string }
export interface ReconcileDependencies {
 prepare:(token:string,command:Command)=>Promise<{data:Record<string,unknown>|null;error:{code?:string;message:string}|null}>;
 claim:(id:string)=>Promise<Record<string,unknown>>;
 read:(platform:"apple"|"google",key:string)=>Promise<StoreState|null>;
 configured:(platform:"apple"|"google")=>boolean;
 finish:(id:string,token:string,state:StoreState|null,code:string|null)=>Promise<Record<string,unknown>>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const terminal=new Set(['succeeded','unchanged','failed']);
export async function operatorReconcile(req:Request,deps:ReconcileDependencies):Promise<Response> {
 if(req.method==='OPTIONS')return preflight();
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'';
 if(!token)return json({error:'unauthorized'},401);
 let c:Command;
 try {
  const raw=await req.text();if(raw.length>6000)throw Error();c=JSON.parse(raw);
  if(!c || typeof c!=='object' || Object.keys(c).length!==4 || ![c.id,c.family,c.subscription].every(v=>typeof v==='string'&&uuid.test(v)) || typeof c.reason!=='string' || c.reason.trim().length<3 || c.reason.trim().length>1000)throw Error();
 }catch{return json({error:'invalid_input'},400);}
 let lease:string|undefined;
 try {
  // PostgREST validates the bearer token; the RPC checks the LIVE finance role.
  // No service-role claim/read is attempted before this authorization succeeds.
  const prepared=await deps.prepare(token,c);
  if(prepared.error){
   const message=prepared.error.message,code=prepared.error.code;
   if(code==='42501'||code==='PGRST301'||code==='PGRST302')return json({error:'forbidden'},403);
   const safe=['request_conflict','reconcile_pending','reconcile_rate_limit','subscription_not_found','invalid_input'].includes(message)?message:'request_failed';
   return json({error:safe},safe==='reconcile_rate_limit'?429:safe==='request_conflict'||safe==='reconcile_pending'?409:safe==='subscription_not_found'?404:503);
  }
  if(!prepared.data||prepared.data.id!==c.id)throw Error('request_failed');
  if(terminal.has(String(prepared.data.status)))return json({job:prepared.data});
  const claim=await deps.claim(c.id);
  if(claim.status==='done'||claim.status==='busy')return json({job:claim.receipt},claim.status==='busy'?202:200);
  if(claim.status!=='claimed'||typeof claim.token!=='string'||!uuid.test(claim.token)||!['apple','google'].includes(String(claim.platform))||typeof claim.store_key!=='string')throw Error('claim_failed');
  lease=claim.token;
  const platform=claim.platform as 'apple'|'google';
  if(!deps.configured(platform))return json({job:await deps.finish(c.id,lease,null,'store_not_configured')});
  let state:StoreState|null;
  try {state=await deps.read(platform,claim.store_key);}
  catch {return json({job:await deps.finish(c.id,lease,null,'provider_failed')});}
  if(state && (state.platform!==platform || state.storeKey!==claim.store_key))return json({job:await deps.finish(c.id,lease,null,'account_mismatch')});
  // SQL verifies the lease and commits state+completion atomically.
  return json({job:await deps.finish(c.id,lease,state,state?null:'no_data')});
 }catch(error){
  const e=error as {code?:string;message?:string};
  if(lease && /^(P0001|22\w{3}|23\w{3})$/.test(e.code??'') && e.message!=='reconcile_lease_lost'){
   try {return json({job:await deps.finish(c.id,lease,null,e.message==='account_mismatch'?'account_mismatch':'state_write_failed')});}catch { /* The result is still uncertain; preserve the request. */ }
  }
  // A failed/uncertain finish must not be reported as success or overwrite it.
  // The same request can inspect a committed receipt or reclaim its expired lease.
  return json({error:'result_unconfirmed'},503);
 }
}
