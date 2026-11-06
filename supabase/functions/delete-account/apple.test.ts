// H01: Apple-linked account deletion with token revocation. Apple endpoints are a scripted fake; the database is an
// in-memory model of apple_revocation_begin/record/mark_deleted (the SQL itself is covered by pgTAP 131).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteAccount } from "./handler.ts";
import { decryptToken, encryptToken } from "../_shared/apple-signin.ts";
import { fakeApple, testConfig, tokenReply } from "../_shared/apple-signin.fixture.ts";

const id = "apple-owner", sub = "001234.apple-sub";
const { config } = await testConfig();
type Job = { job_id: string; request_id: string; user_id: string; status: string; client_id: string | null; token_type: string | null; token_ciphertext: string | null; apple_sub: string | null; attempts: number; last_error?: string | null; deleted?: boolean };

function world({ stored = false as false | string, identities = [{ provider: "apple", provider_id: sub, identity_data: { sub } }] as unknown[],
  idTokenUser = id, deleteFail = false, beginFail = false, recordFail = false, apple = fakeApple() } = {}) {
  const jobs: Job[] = []; const deletions: string[] = []; const rpcs: string[] = []; let tokenRow: { client_id: string; token_type: string; token_ciphertext: string } | null = null;
  const ready = (async () => { if (stored) tokenRow = { client_id: config.servicesId, token_type: "refresh_token", token_ciphertext: await encryptToken(config.encryptionKey, stored, sub) }; })();
  const db = {
    rpc: (name: string, a: Record<string, unknown>) => {
      rpcs.push(name);
      if (name === "apple_revocation_begin") {
        if (beginFail) return { data: null, error: { message: "db down" } };
        const existing = jobs.find((j) => j.request_id === a.p_request_id);
        if (existing) {
          if (existing.user_id !== a.p_user_id) return { data: { status: "request_conflict" }, error: null };
          if (existing.status === "pending" && a.p_token_ciphertext) Object.assign(existing, { client_id: a.p_client_id, token_type: a.p_token_type, token_ciphertext: a.p_token_ciphertext });
          return { data: { ...existing }, error: null };
        }
        const t = a.p_token_ciphertext ? { client_id: a.p_client_id, token_type: a.p_token_type, token_ciphertext: a.p_token_ciphertext } : tokenRow;
        if (!t && !a.p_allow_without_token) return { data: { status: "token_required" }, error: null };
        const job: Job = t
          ? { job_id: crypto.randomUUID(), request_id: a.p_request_id as string, user_id: a.p_user_id as string, status: "pending", ...(t as { client_id: string; token_type: string; token_ciphertext: string }), apple_sub: sub, attempts: 0 }
          : { job_id: crypto.randomUUID(), request_id: a.p_request_id as string, user_id: a.p_user_id as string, status: "token_unavailable", client_id: null, token_type: null, token_ciphertext: null, apple_sub: null, attempts: 0 };
        jobs.push(job); return { data: { ...job }, error: null };
      }
      if (name === "apple_revocation_record") {
        if (recordFail) return { data: null, error: { message: "db down" } };
        const j = jobs.find((x) => x.job_id === a.p_job_id)!;
        if (j.status !== "pending") return { data: j.status, error: null };
        j.attempts++; j.last_error = a.p_error as string | null;
        if (a.p_outcome !== "retry") { j.status = a.p_outcome as string; j.token_ciphertext = null; tokenRow = null; }
        return { data: j.status, error: null };
      }
      if (name === "apple_revocation_mark_deleted") { jobs.find((x) => x.job_id === a.p_job_id)!.deleted = true; return { data: null, error: null }; }
      if (name === "check_deletion_preview") return { data: { status: "ok" }, error: null };
      return { data: null, error: {} }; // source cleanup is best-effort
    },
    auth: {
      getUser: () => ({ data: { user: { id, email: "relay@privaterelay.appleid.com", is_anonymous: false, identities } }, error: null }),
      admin: { deleteUser: (userId: string) => { deletions.push(userId); return { error: deleteFail ? {} : null }; } },
    },
  } as unknown as SupabaseClient;
  const signIns: unknown[] = []; let signOuts = 0;
  const reauth = { auth: {
    signInWithIdToken: (args: unknown) => { signIns.push(args); return { data: { user: { id: idTokenUser } }, error: idTokenUser ? null : {} }; },
    signInWithPassword: () => ({ data: { user: { id } }, error: null }),
    signOut: () => { signOuts++; return { error: null }; },
  } } as unknown as SupabaseClient;
  return { ready, deps: { db, reauth, apple: { config, fetch: apple.fetch, timeoutMs: 20 } }, apple, jobs, deletions, rpcs, signIns, signOutCount: () => signOuts, get tokenRow() { return tokenRow; } };
}
const jwt = (amr?: { method: string; timestamp: number }[]) => "h." + btoa(JSON.stringify({ sub: id, amr })) + ".s";
const now = () => Math.floor(Date.now() / 1000);
const post = (body: Record<string, unknown>, token = jwt()) => new Request("https://local/delete-account", { method: "POST", headers: { authorization: "Bearer " + token }, body: JSON.stringify({ confirm: true, ...body }) });
const native = (extra: Record<string, unknown> = {}) => post({ reauthentication: "apple", apple_identity_token: "apple.id.token", apple_nonce: "raw-nonce", apple_authorization_code: "code-1", ...extra });
const otp = (extra: Record<string, unknown> = {}) => post({ reauthentication: "email_otp", ...extra }, jwt([{ method: "otp", timestamp: now() - 10 }]));
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }
const REQ = "6f1c2b1a-9c1e-4e5d-8a3b-2d9f0c7e1a11";

Deno.test("apple delete: native re-auth → code exchange → revoke → delete, reported as succeeded", async () => {
  const w = world({ apple: fakeApple({ token: [tokenReply(sub)], revoke: [{ status: 200 }] }) }); await w.ready;
  const res = await deleteAccount(native({ request_id: REQ }), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "succeeded" }]);
  equal(w.signIns, [{ provider: "apple", token: "apple.id.token", nonce: "raw-nonce" }]);
  equal(w.apple.calls.map((c) => [c.path, c.form.client_id]), [["/auth/token", config.bundleId], ["/auth/revoke", config.bundleId]]);
  equal([w.apple.calls[1].form.token, w.apple.calls[1].form.token_type_hint], ["apple-refresh-SECRET", "refresh_token"]);
  equal(w.deletions, [id]); equal([w.jobs[0].status, w.jobs[0].token_ciphertext, w.jobs[0].deleted], ["succeeded", null, true]);
  // The job is written and revoked BEFORE the auth user is deleted.
  equal(w.rpcs.slice(0, 2), ["apple_revocation_begin", "apple_revocation_record"]);
});

Deno.test("apple delete: stored web token + email OTP; Apple timeout keeps a pending job and deletion proceeds honestly", async () => {
  const w = world({ stored: "web-refresh-SECRET", apple: fakeApple({ revoke: ["timeout"] }) }); await w.ready;
  const res = await deleteAccount(otp(), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "pending" }]);
  equal(w.apple.calls.map((c) => [c.path, c.form.client_id, c.form.token]), [["/auth/revoke", config.servicesId, "web-refresh-SECRET"]]);
  equal([w.jobs[0].status, w.jobs[0].attempts, w.jobs[0].last_error], ["pending", 1, "timeout"]);
  equal(await decryptToken(config.encryptionKey, w.jobs[0].token_ciphertext!, sub), "web-refresh-SECRET");
  equal(w.deletions, [id]);
});

Deno.test("apple delete: pre-H01 client (no request_id) without token is not blocked: deleted, manual_required", async () => {
  const w = world(); await w.ready;
  const res = await deleteAccount(otp(), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "manual_required" }]);
  equal([w.jobs[0].status, w.deletions, w.apple.calls], ["token_unavailable", [id], []]);
});

Deno.test("apple delete: no token and no fresh Apple sign-in → 409, nothing deleted, no job, no Apple call", async () => {
  const w = world(); await w.ready;
  const res = await deleteAccount(otp({ request_id: REQ }), w.deps);
  equal([res.status, await res.json()], [409, { error: "apple_reauthentication_required" }]);
  equal([w.deletions, w.jobs, w.apple.calls], [[], [], []]);
});

Deno.test("apple delete: legacy account, fresh Apple sign-in without any token → deleted, manual_required (never 'revoked')", async () => {
  const w = world(); await w.ready;
  const res = await deleteAccount(native({ apple_authorization_code: undefined }), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "manual_required" }]);
  equal([w.jobs[0].status, w.deletions], ["token_unavailable", [id]]);
});

Deno.test("apple delete: expired/invalid stored token (invalid_grant) → failed job, deleted, manual_required", async () => {
  const w = world({ stored: "revoked-SECRET", apple: fakeApple({ revoke: [{ status: 400, body: { error: "invalid_grant" } }] }) }); await w.ready;
  const res = await deleteAccount(otp(), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "manual_required" }]);
  equal([w.jobs[0].status, w.jobs[0].last_error, w.jobs[0].token_ciphertext], ["failed", "token_invalid", null]);
});

Deno.test("apple delete: expired authorization code falls back to the stored token", async () => {
  const w = world({ stored: "web-refresh-SECRET", apple: fakeApple({ token: [{ status: 400, body: { error: "invalid_grant" } }], revoke: [{ status: 200 }] }) }); await w.ready;
  const res = await deleteAccount(native(), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "succeeded" }]);
  equal(w.apple.calls[1].form.token, "web-refresh-SECRET");
});

Deno.test("apple delete: Apple down during code exchange and no stored token → 503, nothing deleted", async () => {
  const w = world({ apple: fakeApple({ token: ["timeout"] }) }); await w.ready;
  const res = await deleteAccount(native(), w.deps);
  equal([res.status, await res.json()], [503, { error: "apple_unavailable" }]);
  equal([w.deletions, w.jobs], [[], []]); if (w.signOutCount() !== 1) throw new Error("re-auth session not closed");
});

Deno.test("apple delete: repeat request after a failed auth deletion reuses the job and never revokes twice", async () => {
  const apple = fakeApple({ token: [tokenReply(sub)], revoke: [{ status: 200 }] });
  const w = world({ deleteFail: true, apple }); await w.ready;
  const first = await deleteAccount(native({ request_id: REQ }), w.deps);
  equal([first.status, await first.json()], [500, { error: "deletion_failed" }]);
  equal(w.jobs[0].status, "succeeded"); // partial failure: revoked, account still there
  const w2 = { ...w.deps, db: w.deps.db }; // same database
  (w.deps.db.auth.admin as unknown as { deleteUser: (u: string) => unknown }).deleteUser = (u: string) => { w.deletions.push(u); return { error: null }; };
  const second = await deleteAccount(native({ request_id: REQ, apple_authorization_code: undefined }), w2);
  equal([second.status, await second.json()], [200, { ok: true, apple_revocation: "succeeded" }]);
  equal(w.jobs.length, 1); equal(apple.calls.filter((c) => c.path === "/auth/revoke").length, 1);
});

Deno.test("apple delete: revocation result cannot be recorded → reported pending (job stays pending in DB), deletion proceeds", async () => {
  const w = world({ stored: "web-refresh-SECRET", recordFail: true, apple: fakeApple({ revoke: [{ status: 200 }] }) }); await w.ready;
  const res = await deleteAccount(otp(), w.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "pending" }]);
});

Deno.test("apple delete: job cannot be written → 500, no Apple call, nothing deleted", async () => {
  const w = world({ stored: "web-refresh-SECRET", beginFail: true }); await w.ready;
  const res = await deleteAccount(otp(), w.deps);
  equal([res.status, w.deletions, w.apple.calls], [500, [], []]);
});

Deno.test("apple delete: Apple identity token of another account is rejected before anything", async () => {
  const w = world({ idTokenUser: "attacker" }); await w.ready;
  const res = await deleteAccount(native(), w.deps);
  equal([res.status, w.deletions, w.jobs, w.apple.calls], [403, [], [], []]);
});

Deno.test("apple delete: apple re-auth on a non-Apple account, bad inputs, request id reuse", async () => {
  const w = world({ identities: [{ provider: "email" }] }); await w.ready;
  equal((await deleteAccount(native(), w.deps)).status, 403);
  const v = world({ stored: "x" }); await v.ready;
  equal((await deleteAccount(native({ apple_nonce: 7 }), v.deps)).status, 400);
  equal((await deleteAccount(otp({ request_id: "' or 1=1" }), v.deps)).status, 400);
  v.jobs.push({ job_id: "j", request_id: REQ, user_id: "someone-else", status: "succeeded", client_id: null, token_type: null, token_ciphertext: null, apple_sub: null, attempts: 1 });
  equal((await deleteAccount(otp({ request_id: REQ }), v.deps)).status, 400);
  equal(v.deletions, []);
});

Deno.test("apple delete: web/Android fresh Apple OAuth sign-in is accepted only within 5 minutes", async () => {
  for (const [age, status] of [[30, 200], [900, 403]] as const) {
    const w = world({ stored: "web-refresh-SECRET", apple: fakeApple({ revoke: [{ status: 200 }] }) }); await w.ready;
    const res = await deleteAccount(post({ reauthentication: "apple_oauth" }, jwt([{ method: "oauth", timestamp: now() - age }])), w.deps);
    equal(res.status, status);
  }
  const legacy = world(); await legacy.ready;
  const res = await deleteAccount(post({ reauthentication: "apple_oauth" }, jwt([{ method: "oauth", timestamp: now() - 5 }])), legacy.deps);
  equal([res.status, await res.json()], [200, { ok: true, apple_revocation: "manual_required" }]);
});

Deno.test("apple delete: tokens and Apple secrets never appear in responses or console output", async () => {
  const logged: string[] = []; const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  try {
    for (const script of [{ token: [tokenReply(sub)], revoke: [{ status: 200 }] }, { token: [tokenReply(sub)], revoke: ["timeout"] }, { token: ["network"] }]) {
      const w = world({ apple: fakeApple(script as never) }); await w.ready;
      const text = await (await deleteAccount(native(), w.deps)).text();
      for (const secret of ["SECRET", "code-1", "apple.id.token", "raw-nonce", "PRIVATE KEY", config.encryptionKey]) {
        if (text.includes(secret)) throw new Error(`response leaks ${secret}`);
      }
    }
  } finally { Object.assign(console, orig); }
  equal(logged, []);
});

Deno.test("apple delete: password account and multi-parent family path is unchanged (no Apple RPC, plain ok)", async () => {
  const w = world({ identities: [{ provider: "email" }] }); await w.ready;
  const res = await deleteAccount(post({ password: "pw" }), w.deps);
  equal([res.status, await res.json()], [200, { ok: true }]);
  equal(w.rpcs.filter((r) => r.startsWith("apple_")), []); equal(w.deletions, [id]);
});
