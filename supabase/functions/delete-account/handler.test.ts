import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteAccount } from "./handler.ts";

const id = "owner-account";
function fixture({ anonymous = false, authFail = false, passwordFail = false, otherUser = false, deleteFail = false } = {}) {
  const calls: string[] = [];
  const db = { auth: {
    getUser: () => ({ data: { user: authFail ? null : { id, email: "owner@test.local", is_anonymous: anonymous } }, error: authFail ? {} : null }),
    admin: { deleteUser: (userId: string, soft: boolean) => { calls.push(`${userId}:${soft}`); return { error: deleteFail ? {} : null }; } },
  } } as unknown as SupabaseClient;
  const reauth = { auth: {
    signInWithPassword: ({ password }: { password: string }) => ({ data: { user: { id: otherUser ? "attacker" : id } }, error: passwordFail || password !== "correct" ? {} : null }),
    signOut: () => ({ error: null }),
  } } as unknown as SupabaseClient;
  return { db, reauth, calls };
}
const request = (body: unknown, token = true) => new Request("https://local/delete-account", {
  method: "POST", headers: token ? { authorization: "Bearer fixture" } : {}, body: JSON.stringify(body),
});
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }
Deno.test("delete: verified current account only, injected user ID ignored, hard deletion", async () => {
  const f=fixture();const res=await deleteAccount(request({confirm:true,password:"correct",user_id:"victim"}),f);
  equal(res.status,200);equal(f.calls,[`${id}:false`]);equal(await res.json(),{ok:true});
});
for (const [label,options] of Object.entries({ revoked:{authFail:true}, anonymous:{anonymous:true}, password:{passwordFail:true}, mismatch:{otherUser:true} })) {
 Deno.test(`delete: ${label} is rejected without deletion`,async()=>{const f=fixture(options);const res=await deleteAccount(request({confirm:true,password:"correct"}),f);equal(res.status,403);equal(f.calls,[]);});
}
Deno.test("delete: confirmation required and token required",async()=>{
 const f=fixture();equal((await deleteAccount(request({password:"correct"}),f)).status,400);
 equal((await deleteAccount(request({confirm:true,password:"correct"},false),f)).status,403);equal(f.calls,[]);
});
Deno.test("delete: database failure never returns success",async()=>{const f=fixture({deleteFail:true});equal((await deleteAccount(request({confirm:true,password:"correct"}),f)).status,500);});
Deno.test("delete: CORS preflight does not authenticate or delete",async()=>{const f=fixture();const res=await deleteAccount(new Request("https://local",{method:"OPTIONS"}),f);equal(res.status,204);equal(res.headers.get("access-control-allow-origin"),"*");equal(f.calls,[]);});
