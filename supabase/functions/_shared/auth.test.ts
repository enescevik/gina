import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { readParent } from "./auth.ts";
function fixture({ valid = true, member = true, anonymous = false } = {}) {
 const chain = { select:()=>chain, eq:()=>chain, maybeSingle:()=>({data:member?{family_id:"family"}:null,error:null}) };
 return {auth:{getUser:()=>({data:{user:valid?{id:"owner",is_anonymous:anonymous}:null},error:valid?null:{}})},from:()=>chain} as unknown as SupabaseClient;
}
const req = (sub="owner",role="parent") => new Request("https://local",{headers:{authorization:`Bearer header.${btoa(JSON.stringify({sub,gina:{role,family_id:"family"}}))}.signature`}});
Deno.test("parent access requires verified identity and current membership",async()=>{
 const good=await readParent(req(),fixture());if(good?.familyId!=="family"||good.userId!=="owner")throw Error("valid parent rejected");
 for(const db of [fixture({valid:false}),fixture({member:false}),fixture({anonymous:true})])if(await readParent(req(),db)!==null)throw Error("revoked parent accepted");
 if(await readParent(req("victim"),fixture())!==null)throw Error("mismatched subject accepted");
 if(await readParent(req("owner","device"),fixture())!==null)throw Error("device accepted");
});
