import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteAccount } from "./handler.ts";

const id = "owner-account";
function fixture({ anonymous = false, authFail = false, passwordFail = false, otherUser = false, deleteFail = false, previewStatus = "ok", previewFail = false } = {}) {
  const calls: string[] = [];
  const rpcCalls: unknown[] = [];
  const db = { rpc: (name: string, args: unknown) => {
    if (name !== "check_deletion_preview") return { data: null, error: {} }; // source cleanup is best-effort here
    rpcCalls.push([name, args]); return previewFail ? { data: null, error: {} } : { data: { status: previewStatus }, error: null };
  }, auth: {
    getUser: () => ({ data: { user: authFail ? null : { id, email: "owner@test.local", is_anonymous: anonymous } }, error: authFail ? {} : null }),
    admin: { deleteUser: (userId: string, soft: boolean) => { calls.push(`${userId}:${soft}`); return { error: deleteFail ? {} : null }; } },
  } } as unknown as SupabaseClient;
  const reauth = { auth: {
    signInWithPassword: ({ password }: { password: string }) => ({ data: { user: { id: otherUser ? "attacker" : id } }, error: passwordFail || password !== "correct" ? {} : null }),
    signOut: () => ({ error: null }),
  } } as unknown as SupabaseClient;
  return { db, reauth, calls, rpcCalls };
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

Deno.test('delete: social account accepts only fresh verified OTP authentication',async()=>{
 const now=Math.floor(Date.now()/1000);
 for(const [name,claims,status] of [
  ['fresh',{sub:id,amr:[{method:'otp',timestamp:now-20}]},200],
  ['old',{sub:id,iat:now,amr:[{method:'otp',timestamp:now-600}]},403],
  ['future',{sub:id,amr:[{method:'otp',timestamp:now+100}]},403],
  ['refresh',{sub:id,iat:now,amr:[{method:'token_refresh',timestamp:now}]},403],
  ['wrong identity',{sub:'another',amr:[{method:'otp',timestamp:now}]},403],
  ['missing',{sub:id},403],
 ] as const){
  const f=fixture();const token='header.'+btoa(JSON.stringify(claims))+'.signature';
  const req=new Request('https://local/delete-account',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({confirm:true,reauthentication:'email_otp'})});
  const res=await deleteAccount(req,f);if(res.status!==status)throw new Error(name+': wrong status '+res.status);equal(f.calls,status===200?[`${id}:false`]:[]);
 }
});

const token = "6f1c2b1a-9c1e-4e5d-8a3b-2d9f0c7e1a11";
Deno.test("delete: without preview_token the existing flow is unchanged and no preview check runs", async () => {
  const f = fixture(); const res = await deleteAccount(request({ confirm: true, password: "correct" }), f);
  equal(res.status, 200); equal(f.calls, [`${id}:false`]); equal(f.rpcCalls, []);
});
Deno.test("delete: fresh preview token is checked for the verified user, then deletion proceeds", async () => {
  const f = fixture(); const res = await deleteAccount(request({ confirm: true, password: "correct", preview_token: token }), f);
  equal(res.status, 200); equal(f.calls, [`${id}:false`]);
  equal(f.rpcCalls, [["check_deletion_preview", { p_token: token, p_user_id: id }]]);
});
for (const status of ["stale", "expired", "used", "not_found"]) {
  Deno.test(`delete: ${status} preview is rejected with 409 and nothing is deleted`, async () => {
    const f = fixture({ previewStatus: status }); const res = await deleteAccount(request({ confirm: true, password: "correct", preview_token: token }), f);
    equal(res.status, 409); equal(await res.json(), { error: `deletion_preview_${status}` }); equal(f.calls, []);
  });
}
Deno.test("delete: malformed preview token is invalid input before any deletion", async () => {
  const f = fixture(); const res = await deleteAccount(request({ confirm: true, password: "correct", preview_token: "' or 1=1" }), f);
  equal(res.status, 400); equal(f.calls, []); equal(f.rpcCalls, []);
});
Deno.test("delete: preview check failure never deletes and never returns success", async () => {
  const f = fixture({ previewFail: true }); const res = await deleteAccount(request({ confirm: true, password: "correct", preview_token: token }), f);
  equal(res.status, 500); equal(f.calls, []);
});
Deno.test("delete: preview check runs only after re-authentication succeeded", async () => {
  const f = fixture({ passwordFail: true }); const res = await deleteAccount(request({ confirm: true, password: "correct", preview_token: token }), f);
  equal(res.status, 403); equal(f.rpcCalls, []); equal(f.calls, []);
});
