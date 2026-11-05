// iap-reconcile: cron secret, idempotency, kısmi hata. Sahte mağaza; gerçek çağrı yok.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { iapReconcile, type Candidate, type ReconcileDependencies } from "./handler.ts";
import { IapError, type StoreState } from "../_shared/iap.ts";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const post = (secret: string | null, body?: unknown) => new Request("https://local/iap-reconcile", { method: "POST", headers: secret === null ? {} : { "x-cron-secret": secret }, body: body === undefined ? null : JSON.stringify(body) });
const candidates: Candidate[] = [
  { id: "1", platform: "apple", store_key: "APPLE_ORIGINAL_TX_1", expires_at: "2026-11-07T00:00:00Z" },
  { id: "2", platform: "google", store_key: "GOOGLE_PURCHASE_TOKEN_PRIVATE", expires_at: "2026-11-07T00:00:00Z" },
  { id: "3", platform: "google", store_key: "GOOGLE_PENDING_TOKEN_PRIVATE", expires_at: "2026-11-07T00:00:00Z" },
];
function fixture(options: { apple?: boolean; google?: boolean; rpcError?: boolean; stale?: boolean } = {}) {
  const calls: string[] = [];
  const applied: StoreState[] = [];
  const deps: ReconcileDependencies = {
    cronSecret: () => "cron-secret-value",
    serviceClient: () => ({ rpc: async (name: string, args: unknown) => { calls.push(`rpc:${name}:${JSON.stringify(args)}`); return options.rpcError ? { data: null, error: {} } : { data: candidates, error: null }; } }) as unknown as SupabaseClient,
    appleConfigured: () => options.apple ?? true,
    googleConfigured: () => options.google ?? true,
    read: async (_db, platform, key) => {
      calls.push(`read:${platform}`);
      if (key.includes("PENDING")) return null;
      if (platform === "apple") throw new Error(`fetch failed for https://api/${key}`); // URL carries the key
      return { platform, storeKey: key, productId: "gina_plus_monthly", status: "active", expiresAt: "2026-12-07T00:00:00Z", autoRenewing: true, accountToken: null, version: 5, raw: {} };
    },
    applyStoreState: async (_db, state) => { applied.push(state); calls.push("apply"); return { familyId: "f", productId: state.productId, plan: "plus", status: state.status, expiresAt: state.expiresAt, ...(options.stale ? { skipped: "stale" as const } : {}) }; },
  };
  return { deps, calls, applied };
}
Deno.test("missing or wrong cron secret is 401 before any database access", async () => {
  // (Headers API trims surrounding whitespace, so "value " would legitimately match.)
  for (const secret of [null, "", "wrong", "cron-secret-valu", "cron-secret-valueX", "CRON-SECRET-VALUE"]) {
    const f = fixture(); eq((await iapReconcile(post(secret), f.deps)).status, 401); eq(f.calls, []);
  }
});
Deno.test("unset server secret fails closed even if header matches an empty string", async () => {
  const f = fixture(); f.deps.cronSecret = () => undefined;
  eq((await iapReconcile(post(""), f.deps)).status, 401); eq(f.calls, []);
});
Deno.test("no store credentials: 503 and no candidates read", async () => {
  const f = fixture({ apple: false, google: false });
  eq((await iapReconcile(post("cron-secret-value"), f.deps)).status, 503); eq(f.calls, []);
});
Deno.test("partial failure: one provider error does not stop the others; failure report has no token or URL", async () => {
  const f = fixture();
  const res = await iapReconcile(post("cron-secret-value"), f.deps);
  const body = await res.json();
  eq(res.status, 200);
  eq({ checked: body.checked, updated: body.updated, unchanged: body.unchanged, skipped: body.skipped }, { checked: 3, updated: 1, unchanged: 0, skipped: 1 });
  eq(body.failed, [{ store_key_hint: "APPLE_OR", error: "unexpected_error" }]);
  eq(JSON.stringify(body).includes("PRIVATE"), false); eq(JSON.stringify(body).includes("https://"), false);
  eq(f.applied[0].source, "reconcile");
});
Deno.test("IapError codes are reported by code only", async () => {
  const f = fixture(); f.deps.read = async () => { throw Object.assign(new IapError("google_api_500", 502), { detail: "PRIVATE body" }); };
  const body = await (await iapReconcile(post("cron-secret-value"), f.deps)).json();
  eq(body.failed.length, 3); eq(body.failed[0].error, "google_api_500"); eq(JSON.stringify(body).includes("PRIVATE"), false);
});
Deno.test("re-running the same round is idempotent: stale writes count as unchanged, never as new entitlements", async () => {
  const f = fixture({ stale: true });
  const body = await (await iapReconcile(post("cron-secret-value"), f.deps)).json();
  eq({ updated: body.updated, unchanged: body.unchanged }, { updated: 0, unchanged: 1 });
});
Deno.test("only the configured platform is read; the other is skipped, not failed", async () => {
  const f = fixture({ apple: false });
  const body = await (await iapReconcile(post("cron-secret-value"), f.deps)).json();
  eq(f.calls.filter((c) => c.startsWith("read:")), ["read:google", "read:google"]);
  eq({ skipped: body.skipped, failed: body.failed.length, updated: body.updated }, { skipped: 2, failed: 0, updated: 1 });
});
Deno.test("limit is bounded and candidates RPC failure is 500 without touching stores", async () => {
  const f = fixture();
  await iapReconcile(post("cron-secret-value", { limit: 5000 }), f.deps);
  eq(f.calls[0], 'rpc:iap_reconcile_candidates:{"p_limit":1000}');
  const g = fixture({ rpcError: true });
  eq((await iapReconcile(post("cron-secret-value"), g.deps)).status, 500); eq(g.calls.filter((c) => c.startsWith("read")), []);
});
Deno.test("non-POST is refused", async () => {
  const f = fixture(); eq((await iapReconcile(new Request("https://local/iap-reconcile", { headers: { "x-cron-secret": "cron-secret-value" } }), f.deps)).status, 405);
});
