// C11: istemcinin seçtiği paket / gönderdiği ek alanlar kalıcı ücretli hak üretemez.
// Hak yalnız mağazanın imzalı/okunan durumundan türer; istemci gövdesindeki plan, aile, süre, durum yok sayılır.
// Sahte mağaza ve DB bağımlılıkları; gerçek Apple/Google çağrısı yok.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { iapVerify, parseInput, type VerifyDependencies } from "./handler.ts";
import { appleState, type AppleTransaction, type GoogleSubscriptionV2, type StoreState } from "../_shared/iap.ts";

const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};
const FAMILY = "10000000-0000-4000-8000-000000011701";
const OTHER = "10000000-0000-4000-8000-000000011702";
const post = (body: unknown) =>
  new Request("https://local/iap-verify", { method: "POST", headers: { authorization: "Bearer parent" }, body: JSON.stringify(body) });

Deno.env.set("APPLE_BUNDLE_ID", Deno.env.get("APPLE_BUNDLE_ID") ?? "com.enescevik.gina");

function deps(opts: { tx?: Partial<AppleTransaction>; storeProduct?: string; useRealAppleState?: boolean } = {}) {
  const applied: StoreState[] = [];
  const d: VerifyDependencies = {
    readParent: async () => ({ familyId: FAMILY, userId: "user-1" }),
    serviceClient: () => ({}) as SupabaseClient,
    verifyAppleJws: async <T extends object>() =>
      ({
        transactionId: "t1", originalTransactionId: "o1", bundleId: Deno.env.get("APPLE_BUNDLE_ID"), productId: "gina_plus_monthly",
        expiresDate: Date.now() + 86_400_000, signedDate: 500, appAccountToken: FAMILY, ...opts.tx,
      }) as unknown as T,
    appleState: opts.useRealAppleState ? appleState : (tx) => ({
      platform: "apple", storeKey: tx.originalTransactionId, productId: tx.productId, status: "active",
      expiresAt: new Date(tx.expiresDate!).toISOString(), autoRenewing: true, accountToken: tx.appAccountToken ?? null, version: tx.signedDate, raw: {},
    }),
    appleApiConfigured: () => false,
    fetchAppleState: async () => null,
    googleApiConfigured: () => true,
    knownAndroidProduct: async () => true,
    fetchGoogleSubscription: async (): Promise<GoogleSubscriptionV2> => ({
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      externalAccountIdentifiers: { obfuscatedExternalAccountId: FAMILY },
      lineItems: [{ productId: opts.storeProduct ?? "gina_plus", expiryTime: "2099-01-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }],
    }),
    googleState: async (_db, token, sub) => ({
      platform: "google", storeKey: token, productId: `${sub.lineItems![0].productId}_monthly`, status: "active",
      expiresAt: sub.lineItems![0].expiryTime!, autoRenewing: true, accountToken: FAMILY, acknowledged: true,
      raw: { androidProductId: sub.lineItems![0].productId },
    }),
    acknowledgeGoogle: async () => {},
    applyStoreState: async (_db, state) => {
      applied.push(structuredClone(state));
      return { familyId: FAMILY, productId: state.productId, plan: state.productId.includes("pro") ? "pro" : "plus", status: state.status, expiresAt: state.expiresAt };
    },
    recordStoreAccountConflict: async () => true,
    now: () => Date.now(),
  };
  return { d, applied };
}

Deno.test("C11: client-side plan/family/expiry/status fields are dropped before any store call", () => {
  const forged = { platform: "google", purchaseToken: "purchase-token-0123456789", productId: "gina_plus", plan: "pro", familyId: OTHER, expiresAt: "2999-01-01", status: "active", source: "operator" };
  eq(parseInput(forged), { platform: "google", purchaseToken: "purchase-token-0123456789", productId: "gina_plus" });
  const apple = { platform: "apple", signedTransaction: "aaa.bbb.ccc", productId: "gina_pro_yearly", plan: "pro" };
  eq(parseInput(apple), { platform: "apple", signedTransaction: "aaa.bbb.ccc" });
});

Deno.test("C11: Google — choosing the Pro package in the client while the store says Plus writes nothing", async () => {
  const f = deps({ storeProduct: "gina_plus" });
  const res = await iapVerify(post({ platform: "google", purchaseToken: "purchase-token-0123456789", productId: "gina_pro" }), f.d);
  eq(res.status, 422);
  eq((await res.json()).error, "product_mismatch");
  eq(f.applied.length, 0);
});

Deno.test("C11: Google — written plan and expiry come from the store, never from the request body", async () => {
  const f = deps({ storeProduct: "gina_plus" });
  const res = await iapVerify(post({ platform: "google", purchaseToken: "purchase-token-0123456789", productId: "gina_plus", plan: "pro", expiresAt: "2999-01-01" }), f.d);
  eq(res.status, 200);
  eq(f.applied.length, 1);
  eq(f.applied[0].productId, "gina_plus_monthly");
  eq(f.applied[0].expiresAt, "2099-01-01T00:00:00Z");
  eq(f.applied[0].source, "client_verify");
  eq((await res.json()).plan, "plus");
});

Deno.test("C11: Apple — product comes from the signed transaction; a body product claim is ignored", async () => {
  const f = deps({ tx: { productId: "gina_plus_monthly" } });
  const res = await iapVerify(post({ platform: "apple", signedTransaction: "aaa.bbb.ccc", productId: "gina_pro_yearly", plan: "pro" }), f.d);
  eq(res.status, 200);
  eq(f.applied[0].productId, "gina_plus_monthly");
});

Deno.test("C11: Apple — an expired signed transaction cannot produce an active entitlement (real state mapping)", async () => {
  const f = deps({ tx: { expiresDate: Date.now() - 60_000 }, useRealAppleState: true });
  const res = await iapVerify(post({ platform: "apple", signedTransaction: "aaa.bbb.ccc" }), f.d);
  eq(res.status, 200);
  eq(f.applied[0].status === "active" || f.applied[0].status === "grace", false);
});

Deno.test("C11: Apple — a revoked (refunded) signed transaction is written as revoked, not active", async () => {
  const f = deps({ tx: { revocationDate: Date.now() - 1000 } as Partial<AppleTransaction>, useRealAppleState: true });
  await iapVerify(post({ platform: "apple", signedTransaction: "aaa.bbb.ccc" }), f.d);
  eq(f.applied[0].status, "revoked");
});
