// iap-verify: sahte mağaza/DB bağımlılıklarıyla sıra ve ret yolları. Gerçek Apple/Google çağrısı yok.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { iapVerify, parseInput, type VerifyDependencies } from "./handler.ts";
import { IapError, type GoogleSubscriptionV2, type StoreState } from "../_shared/iap.ts";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const FAMILY = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const post = (body: unknown, auth = "Bearer parent-jwt") => new Request("https://local/iap-verify", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });
const googleSub = (over: Partial<GoogleSubscriptionV2> = {}): GoogleSubscriptionV2 => ({
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
  externalAccountIdentifiers: { obfuscatedExternalAccountId: FAMILY },
  lineItems: [{ productId: "gina_plus", expiryTime: "2027-01-01T00:00:00Z", autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly" } }],
  ...over,
});
function fixture(options: { sub?: GoogleSubscriptionV2 | null; applyError?: IapError; ackError?: Error; knownProduct?: boolean; apple?: boolean; parent?: boolean } = {}) {
  const calls: string[] = [];
  const applied: StoreState[] = [];
  const conflicts: unknown[] = [];
  let tick = 1000;
  const deps: VerifyDependencies = {
    readParent: async () => options.parent === false ? null : { familyId: FAMILY, userId: "user-1" },
    serviceClient: () => ({}) as SupabaseClient,
    verifyAppleJws: async <T extends object>() => { calls.push("verifyJws"); return { transactionId: "t1", originalTransactionId: "o1", bundleId: "com.enescevik.gina", productId: "gina_plus_monthly", expiresDate: Date.now() + 86_400_000, signedDate: 500, appAccountToken: FAMILY } as unknown as T; },
    appleState: (tx, renewal, api, now) => {
      calls.push("appleState");
      return { platform: "apple", storeKey: tx.originalTransactionId, productId: tx.productId, status: "active", expiresAt: new Date(tx.expiresDate!).toISOString(), autoRenewing: true, accountToken: tx.appAccountToken ?? null, version: tx.signedDate, raw: { renewal, api, now } };
    },
    appleApiConfigured: () => options.apple ?? false,
    fetchAppleState: async () => { calls.push("appleApi"); return null; },
    googleApiConfigured: () => true,
    knownAndroidProduct: async () => options.knownProduct ?? true,
    fetchGoogleSubscription: async () => { calls.push("fetch"); if (options.sub === null) throw new IapError("invalid_purchase_token", 422); return options.sub ?? googleSub(); },
    googleState: async (_db, token, sub) => {
      calls.push("state");
      if (sub.subscriptionState === "SUBSCRIPTION_STATE_PENDING") return null;
      return { platform: "google", storeKey: token, productId: "gina_plus_monthly", status: "active", expiresAt: sub.lineItems![0].expiryTime!, autoRenewing: true,
        accountToken: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null, acknowledged: sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        raw: { subscription: sub, androidProductId: sub.lineItems![0].productId } };
    },
    acknowledgeGoogle: async () => { calls.push("ack"); if (options.ackError) throw options.ackError; },
    applyStoreState: async (_db, state) => {
      calls.push("apply" + (state.acknowledged ? ":acked" : ""));
      applied.push(state);
      if (options.applyError && applied.length === 1) throw options.applyError;
      return { familyId: FAMILY, productId: state.productId, plan: "plus", status: state.status, expiresAt: state.expiresAt };
    },
    recordStoreAccountConflict: async (_db, state, ctx) => { calls.push("audit"); conflicts.push({ platform: state.platform, storeKey: state.storeKey, ...ctx }); return true; },
    now: () => (tick += 1),
  };
  return { deps, calls, applied, conflicts };
}
const googleBody = { platform: "google", purchaseToken: "purchase-token-0123456789", productId: "gina_plus" };
const appleBody = { platform: "apple", signedTransaction: "aaa.bbb.ccc" };

Deno.test("input parsing rejects malformed receipts before any store call", () => {
  eq(parseInput(null), null);
  eq(parseInput({ platform: "apple", signedTransaction: "not a jws" }), null);
  eq(parseInput({ platform: "google", purchaseToken: "short", productId: "gina_plus" }), null);
  eq(parseInput({ platform: "google", purchaseToken: "purchase-token-0123456789", productId: "Gina Plus" }), null);
  eq(parseInput(appleBody), appleBody);
  eq(parseInput(googleBody), googleBody);
});
Deno.test("no parent session: 403 and no store/database access", async () => {
  const f = fixture({ parent: false });
  eq((await iapVerify(post(googleBody), f.deps)).status, 403); eq(f.calls, []);
});
Deno.test("Google: entitlement is written before acknowledge; acknowledge is confirmed as a second versioned write", async () => {
  const f = fixture();
  const res = await iapVerify(post(googleBody), f.deps);
  eq(res.status, 200); eq((await res.json()).ok, true);
  eq(f.calls, ["fetch", "state", "apply", "ack", "apply:acked"]);
  eq(f.applied[0].source, "client_verify"); eq(f.applied[0].acknowledged, false);
  eq(f.applied[1].acknowledged, true); eq(f.applied[1].version! > f.applied[0].version!, true);
});
Deno.test("Google: already acknowledged purchase is not acknowledged again", async () => {
  const f = fixture({ sub: googleSub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }) });
  eq((await iapVerify(post(googleBody), f.deps)).status, 200);
  eq(f.calls, ["fetch", "state", "apply:acked"]); // API already says ACKNOWLEDGED: one write, no ack call
});
Deno.test("Google: receipt bound to another family is refused BEFORE acknowledge and audited", async () => {
  const f = fixture({ applyError: new IapError("account_mismatch", 409), sub: googleSub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: OTHER } }) });
  const res = await iapVerify(post(googleBody), f.deps);
  eq(res.status, 409); eq((await res.json()).error, "account_mismatch");
  eq(f.calls, ["fetch", "state", "apply", "audit"]);
  eq(f.conflicts, [{ platform: "google", storeKey: googleBody.purchaseToken, callerFamilyId: FAMILY, userId: "user-1", source: "client_verify" }]);
});
Deno.test("Google: acknowledge failure keeps entitlement but tells the client not to finish (503)", async () => {
  const f = fixture({ ackError: new IapError("google_ack_500", 502) });
  const res = await iapVerify(post(googleBody), f.deps);
  eq(res.status, 503); eq((await res.json()).error, "acknowledge_failed");
  eq(f.calls, ["fetch", "state", "apply", "ack"]);
});
Deno.test("Google: pending payment grants nothing and acknowledges nothing", async () => {
  const f = fixture({ sub: googleSub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING" }) });
  const res = await iapVerify(post(googleBody), f.deps);
  eq(await res.json(), { ok: false, pending: true }); eq(f.calls, ["fetch", "state"]);
});
Deno.test("Google: product mismatch between client claim and store is rejected without write", async () => {
  const f = fixture({ sub: googleSub({ lineItems: [{ productId: "gina_pro", expiryTime: "2027-01-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }] }) });
  eq((await iapVerify(post(googleBody), f.deps)).status, 422); eq(f.calls.includes("apply"), false);
});
Deno.test("Google: unknown Android product never reaches the store API", async () => {
  const f = fixture({ knownProduct: false });
  eq((await iapVerify(post(googleBody), f.deps)).status, 422); eq(f.calls, []);
});
Deno.test("Google: invalid purchase token is a clear 422, not a server error", async () => {
  const f = fixture({ sub: null });
  const res = await iapVerify(post(googleBody), f.deps);
  eq(res.status, 422); eq((await res.json()).error, "invalid_purchase_token");
});
Deno.test("Apple: offline chain verification path writes with client_verify source", async () => {
  const f = fixture();
  const res = await iapVerify(post(appleBody), f.deps);
  eq(res.status, 200); eq(f.calls, ["verifyJws", "appleState", "apply"]);
  eq(f.applied[0].source, "client_verify"); eq(f.applied[0].acknowledged, undefined);
});
Deno.test("Apple: configured server API refreshes before write", async () => {
  const f = fixture({ apple: true });
  eq((await iapVerify(post(appleBody), f.deps)).status, 200); eq(f.calls, ["verifyJws", "appleState", "appleApi", "apply"]);
});
Deno.test("Apple: receipt of another family is refused and audited (hak taşıma yalnız operatörle)", async () => {
  const f = fixture({ applyError: new IapError("account_mismatch", 409) });
  const res = await iapVerify(post(appleBody), f.deps);
  eq(res.status, 409); eq(f.calls, ["verifyJws", "appleState", "apply", "audit"]);
  eq((f.conflicts[0] as { storeKey: string }).storeKey, "o1");
});
Deno.test("Apple: invalid signature is 422 without database write", async () => {
  const f = fixture(); f.deps.verifyAppleJws = async () => { throw Object.assign(new IapError("invalid_jws", 422), { detail: "signature" }); };
  const res = await iapVerify(post(appleBody), f.deps);
  eq(res.status, 422); eq(await res.json(), { error: "invalid_jws", detail: "signature" }); eq(f.applied.length, 0);
});
Deno.test("unexpected errors are redacted", async () => {
  const f = fixture(); f.deps.fetchGoogleSubscription = async () => { throw new Error("PRIVATE token in url"); };
  const res = await iapVerify(post(googleBody), f.deps);
  eq(res.status, 500); eq((await res.text()).includes("PRIVATE"), false);
});
