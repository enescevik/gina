import { createClient } from "npm:@supabase/supabase-js@2";
import { serviceClient } from "../_shared/supabase.ts";
import { appleApiConfigured,fetchAppleState,googleApiConfigured,fetchGoogleSubscription,googleState } from "../_shared/iap.ts";
import { operatorReconcile, type ReconcileDependencies } from "./handler.ts";
const deps:ReconcileDependencies={
 prepare:async(token,c)=>{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  return await db.rpc('finance_request_reconcile',{p_id:c.id,p_family_id:c.family,p_subscription_id:c.subscription,p_reason:c.reason});
 },
 claim:async id=>{const {data,error}=await serviceClient().rpc('claim_operator_reconcile',{p_id:id});if(error)throw error;return data;},
 configured:p=>p==='apple'?appleApiConfigured():googleApiConfigured(),
 read:async(p,key)=>{
  // Read-only store check: no acknowledge, no refund, no cancellation. Labelled source=operator.
  if(p==='apple'){const s=await fetchAppleState(key);if(s)s.source='operator';return s;}
  const version=Date.now();
  const state=await googleState(serviceClient(),key,await fetchGoogleSubscription(key));
  if(state){state.version=version;state.source='operator';}
  return state;
 },
 finish:async(id,token,state,code)=>{const {data,error}=await serviceClient().rpc('finish_operator_reconcile',{p_id:id,p_token:token,p_state:state,p_code:code});if(error)throw error;return data;},
};
Deno.serve(req=>operatorReconcile(req,deps));
