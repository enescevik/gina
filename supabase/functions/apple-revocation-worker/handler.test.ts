import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAppleRevocations } from "./handler.ts";
import { encryptToken } from "../_shared/apple-signin.ts";
import { fakeApple, testConfig } from "../_shared/apple-signin.fixture.ts";

const { config } = await testConfig();
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }

Deno.test("apple worker: only the cron secret runs it", async () => {
  const db = { rpc: () => { throw new Error("must not run"); } } as unknown as SupabaseClient;
  for (const header of [undefined, "wrong-secret-x", "cron-secret-x0"]) {
    const res = await runAppleRevocations(new Request("https://local", { method: "POST", headers: header ? { "x-cron-secret": header } : {} }), { db, secret: "cron-secret-x1" });
    equal(res.status, 403);
  }
  equal((await runAppleRevocations(new Request("https://local", { method: "POST", headers: { "x-cron-secret": "" } }), { db, secret: undefined })).status, 403);
});

Deno.test("apple worker: claimed jobs are revoked, retried or failed and recorded", async () => {
  const job = async (n: number) => ({ job_id: `j${n}`, client_id: config.bundleId, token_type: "refresh_token", token_ciphertext: await encryptToken(config.encryptionKey, `t${n}`, "s"), apple_sub: "s" });
  const jobs = [await job(1), await job(2), await job(3), { ...(await job(4)), token_ciphertext: "v1.AAAA.BBBB" }];
  const recorded: unknown[] = [];
  const db = { rpc: (name: string, a: Record<string, unknown>) => {
    if (name === "apple_revocation_claim") return { data: jobs, error: null };
    recorded.push([a.p_job_id, a.p_outcome, a.p_error]);
    return { data: a.p_outcome === "retry" ? "pending" : a.p_outcome, error: null };
  } } as unknown as SupabaseClient;
  const apple = fakeApple({ revoke: [{ status: 200 }, { status: 503 }, { status: 400, body: { error: "invalid_grant" } }] });
  const res = await runAppleRevocations(new Request("https://local", { method: "POST", headers: { "x-cron-secret": "s3cret" } }), { db, secret: "s3cret", apple: { config, fetch: apple.fetch, timeoutMs: 20 } });
  equal([res.status, await res.json()], [200, { ok: true, processed: 4, succeeded: 1, pending: 2, failed: 1 }]);
  equal(recorded, [["j1", "succeeded", null], ["j2", "retry", "apple_unavailable"], ["j3", "failed", "token_invalid"], ["j4", "retry", "decrypt_failed"]]);
  equal(apple.calls.map((c) => c.form.token), ["t1", "t2", "t3"]);
});

Deno.test("apple worker: claim failure is a 503, not a silent success", async () => {
  const db = { rpc: () => ({ data: null, error: {} }) } as unknown as SupabaseClient;
  equal((await runAppleRevocations(new Request("https://local", { method: "POST", headers: { "x-cron-secret": "k" } }), { db, secret: "k" })).status, 503);
});
