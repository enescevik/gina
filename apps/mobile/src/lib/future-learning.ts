import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import {useSession} from './session';
/** A missing RPC on a pre-release server is expected. Do not offer an action it cannot complete. */
export function useFutureLearningReady(scope: "all" | "daily_practice" = "all"){
 const {claims,session}=useSession();
 const result=useQuery({queryKey:['future_learning_ready',scope,session?.user.id,claims?.family_id],enabled:!!session&&!!claims?.family_id,
  staleTime:60000,retry:false,queryFn:async()=>{const {data,error}=await supabase.rpc(scope==='daily_practice'?'daily_practice_ready':'future_learning_ready');return !error&&data===true;}});
 return result.data===true;
}
