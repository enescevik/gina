import { operatorReconcile,type ReconcileDependencies,type Command } from "./handler.ts";
import type { StoreState } from "../_shared/iap.ts";
const eq=(a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);};
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const command:Command={id:id(1),family:id(2),subscription:id(3),reason:'Support verification'};
const request=(body:unknown=command,token='verified-by-postgrest')=>new Request('https://local.test',{method:'POST',headers:{Authorization:token?`Bearer ${token}`:''},body:JSON.stringify(body)});
function fixture(){
 const calls:string[]=[];
 let status='queued';
 const deps:ReconcileDependencies={
  prepare:async()=>{calls.push('prepare');return{data:{id:command.id,status},error:null};},
  claim:async()=>{calls.push('claim');return{status:'claimed',token:id(4),platform:'apple',store_key:'PRIVATE_TOKEN'};},
  configured:()=>true,
  read:async()=>{calls.push('read');return{platform:'apple',storeKey:'PRIVATE_TOKEN',version:100} as StoreState;},
  finish:async(_id,_token,state,code)=>{calls.push('finish:'+String(code));status=state?'succeeded':code==='no_data'?'unchanged':'failed';return{id:command.id,status,code};},
 };
 return{deps,calls};
}
Deno.test('operator verification requires auth before service access',async()=>{
 const f=fixture();eq((await operatorReconcile(request(command,''),f.deps)).status,401);eq(f.calls,[]);
});
for(const error of [{code:'42501',message:'private details'},{code:'PGRST301',message:'jwt invalid'}])Deno.test('live role/token rejection '+error.code,async()=>{
 const f=fixture();f.deps.prepare=async()=>({data:null,error});const r=await operatorReconcile(request(),f.deps);eq(r.status,403);eq(f.calls,[]);eq(await r.json(),{error:'forbidden'});
});
for(const [message,status] of [['reconcile_pending',409],['reconcile_rate_limit',429],['request_conflict',409],['subscription_not_found',404],['PRIVATE TOKEN raw error',503]] as const)Deno.test('request error redaction '+status+' '+message,async()=>{
 const f=fixture();f.deps.prepare=async()=>({data:null,error:{message}});const r=await operatorReconcile(request(),f.deps);eq(r.status,status);eq(f.calls,[]);eq((await r.text()).includes('PRIVATE'),false);
});
Deno.test('malformed or huge payload never reaches auth RPC',async()=>{
 for(const body of [{...command,extra:true},{...command,reason:'x'},{...command,reason:'x'.repeat(7000)},{...command,id:'not-id'},null]){
  const f=fixture();eq((await operatorReconcile(request(body),f.deps)).status,400);eq(f.calls,[]);
 }
});
Deno.test('committed response replay does not call provider again',async()=>{
 const f=fixture();await operatorReconcile(request(),f.deps);const replay=await operatorReconcile(request(),f.deps);eq(replay.status,200);eq(f.calls,['prepare','claim','read','finish:null','prepare']);
});
Deno.test('concurrent worker receives busy receipt, not another provider call',async()=>{
 const f=fixture();f.deps.claim=async()=>({status:'busy',receipt:{id:command.id,status:'processing'}});const r=await operatorReconcile(request(),f.deps);eq(r.status,202);eq(f.calls,['prepare']);
});
Deno.test('missing provider remains a visible failed result',async()=>{
 const f=fixture();f.deps.configured=()=>false;const r=await operatorReconcile(request(),f.deps);eq((await r.json()).job.status,'failed');eq(f.calls,['prepare','claim','finish:store_not_configured']);
});
Deno.test('provider errors are redacted and recorded',async()=>{
 const f=fixture();f.deps.read=async()=>{throw Error('PRIVATE key/provider response');};const r=await operatorReconcile(request(),f.deps);const body=await r.text();eq(body.includes('PRIVATE'),false);eq(JSON.parse(body).job.code,'provider_failed');
});
Deno.test('no provider record is unchanged, never revocation',async()=>{
 const f=fixture();f.deps.read=async()=>null;const r=await operatorReconcile(request(),f.deps);eq((await r.json()).job.status,'unchanged');eq(f.calls,['prepare','claim','finish:no_data']);
});
Deno.test('wrong purchase cannot reach verified state write',async()=>{
 const f=fixture();f.deps.read=async()=>({platform:'apple',storeKey:'OTHER'} as StoreState);const r=await operatorReconcile(request(),f.deps);eq((await r.json()).job.code,'account_mismatch');
});
Deno.test('uncertain finish does not overwrite result with failure',async()=>{
 const f=fixture();let writes=0;f.deps.finish=async()=>{writes++;throw Error('committed but network lost');};const r=await operatorReconcile(request(),f.deps);eq(r.status,503);eq(writes,1);eq(await r.json(),{error:'result_unconfirmed'});
});
Deno.test('preflight/method do not touch jobs',async()=>{
 const f=fixture();eq((await operatorReconcile(new Request('https://local.test',{method:'OPTIONS'}),f.deps)).status,204);eq((await operatorReconcile(new Request('https://local.test'),f.deps)).status,405);eq(f.calls,[]);
});
Deno.test('definitive SQL rejection records failure without claiming successful update',async()=>{
 const f=fixture();const finish=f.deps.finish;let writes=0;
 f.deps.finish=async(...args)=>{writes++;if(args[2])throw Object.assign(Error('account_mismatch'),{code:'P0001'});return await finish(...args);};
 const r=await operatorReconcile(request(),f.deps);eq((await r.json()).job.code,'account_mismatch');eq(writes,2);
});
