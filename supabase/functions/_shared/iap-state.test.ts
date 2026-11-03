import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appleState, applyStoreState, googleState, IapError, type StoreState } from "./iap.ts";
const equal=(a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);};
const now=Date.parse("2026-11-04T00:00:00Z");
Deno.test("Apple updates order by signed state, not the original purchase date",()=>{
  // env is only used for the configured bundle, covered with an explicit default below.
  const tx={transactionId:"t",originalTransactionId:"o",bundleId:Deno.env.get("APPLE_BUNDLE_ID")??"com.enescevik.gina",productId:"gina_plus_monthly",purchaseDate:10,signedDate:200,expiresDate:now+1000};
  equal(appleState(tx,null,null,now).version,200);
  equal(appleState({...tx,revocationDate:now,signedDate:300},null,null,now).status,"revoked");
  equal(appleState(tx,{signedDate:400},null,now).version,400);
});
function db(error?: {message:string},data:unknown={familyId:"family",plan:"plus"}){
 const calls:unknown[]=[];
 const client={rpc:async(...args:unknown[])=>{calls.push(args);return{data,error:error??null};},
  from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{product_id:"gina_plus_monthly"},error:null})})})})})} as unknown as SupabaseClient;
 return{client,calls};
}
Deno.test("store write is a single atomic RPC; no client-side read then upsert",async()=>{
 const f=db();const state={platform:"apple",version:200} as StoreState;
 await applyStoreState(f.client,state,{callerFamilyId:"family",purchaserUserId:"parent"});
 equal(f.calls,[["apply_verified_store_state",{p_state:state,p_caller_family_id:"family",p_purchaser_user_id:"parent"}]]);
});
for(const [message,status] of [["account_mismatch",409],["forbidden",403],["family_not_found",404],["unknown_product",422],["invalid_store_state",422],["private provider/database detail",503]] as const)Deno.test(`atomic store error mapped safely: ${status} ${message}`,async()=>{
 const f=db({message});let caught:unknown;try{await applyStoreState(f.client,{} as StoreState);}catch(e){caught=e;}
 equal(caught instanceof IapError,true);equal((caught as IapError).httpStatus,status);
 if(status===503)equal((caught as IapError).code,"store_state_write_failed");
});
Deno.test("malformed store write response is not success",async()=>{
 const f=db(undefined,null);let caught:unknown;try{await applyStoreState(f.client,{} as StoreState);}catch(e){caught=e;}
 equal((caught as IapError).httpStatus,503);
});
Deno.test("late Google revocation hint cannot override active API state",async()=>{
 const f=db();const sub={subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",lineItems:[{productId:"gina_plus",expiryTime:"2027-01-01T00:00:00Z",offerDetails:{basePlanId:"monthly"}}]};
 equal((await googleState(f.client,"token",sub,{revoked:true}))?.status,"active");
 equal((await googleState(f.client,"token",{...sub,subscriptionState:"SUBSCRIPTION_STATE_EXPIRED"},{revoked:true}))?.status,"revoked");
 equal(await googleState(f.client,"token",{...sub,subscriptionState:"SUBSCRIPTION_STATE_PENDING"},{revoked:true}),null);
});
