// Yaşam döngüsü durum makinesi: sahte Apple işlem/yenileme yükleri ve Google subscriptionsv2 yanıtlarıyla
// satın al → yenile → yükselt/düşür → geri yükle → iptal → billing retry → grace → iade → yeniden abone.
// Deterministik: sabit `now`; gerçek mağaza yok. SQL tarafı pgTAP 094'te.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appleState, googleState, IapError, type AppleRenewalInfo, type AppleTransaction, type StoreState } from "./iap.ts";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const NOW = Date.parse("2026-11-06T00:00:00Z");
const DAY = 86_400_000;
const FAMILY = "10000000-0000-4000-8000-000000000001";
const BUNDLE = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.enescevik.gina";
const tx = (over: Partial<AppleTransaction> = {}): AppleTransaction => ({
  transactionId: "t1", originalTransactionId: "o1", bundleId: BUNDLE, productId: "gina_plus_monthly",
  purchaseDate: NOW - 10 * DAY, expiresDate: NOW + 20 * DAY, signedDate: NOW - 10 * DAY, appAccountToken: FAMILY.toUpperCase(), environment: "Sandbox", ...over,
});
const summary = (s: StoreState) => ({ status: s.status, product: s.productId, renew: s.autoRenewing, expires: s.expiresAt, version: s.version });
/** Hak verir mi (SQL get_family_entitlement kuralı: active/grace ve expires_at > now). */
const grants = (s: StoreState) => (s.status === "active" || s.status === "grace") && Date.parse(s.expiresAt) > NOW;

Deno.test("Apple lifecycle table (state, access, version order)", () => {
  const steps: { name: string; tx: AppleTransaction; renewal: AppleRenewalInfo | null; expect: { status: string; access: boolean; product?: string; renew?: boolean } }[] = [
    { name: "purchase", tx: tx(), renewal: { autoRenewStatus: 1, signedDate: NOW - 10 * DAY }, expect: { status: "active", access: true, product: "gina_plus_monthly", renew: true } },
    { name: "renew", tx: tx({ transactionId: "t2", expiresDate: NOW + 50 * DAY, signedDate: NOW - 1 * DAY }), renewal: { autoRenewStatus: 1, signedDate: NOW - DAY }, expect: { status: "active", access: true } },
    { name: "upgrade (same originalTransactionId, new product, immediate)", tx: tx({ transactionId: "t3", productId: "gina_pro_monthly", expiresDate: NOW + 30 * DAY, signedDate: NOW }), renewal: { autoRenewProductId: "gina_pro_monthly", autoRenewStatus: 1, signedDate: NOW }, expect: { status: "active", access: true, product: "gina_pro_monthly" } },
    { name: "downgrade scheduled (renewal info only; current product keeps running)", tx: tx({ transactionId: "t3", productId: "gina_pro_monthly", expiresDate: NOW + 30 * DAY, signedDate: NOW }), renewal: { autoRenewProductId: "gina_plus_monthly", autoRenewStatus: 1, signedDate: NOW + DAY }, expect: { status: "active", access: true, product: "gina_pro_monthly", renew: true } },
    { name: "downgrade applied at renewal", tx: tx({ transactionId: "t4", productId: "gina_plus_monthly", purchaseDate: NOW + 30 * DAY, expiresDate: NOW + 60 * DAY, signedDate: NOW + 30 * DAY }), renewal: { autoRenewProductId: "gina_plus_monthly", autoRenewStatus: 1, signedDate: NOW + 30 * DAY }, expect: { status: "active", access: true, product: "gina_plus_monthly" } },
    { name: "cancel (auto-renew off) keeps access until expiry", tx: tx({ transactionId: "t4", expiresDate: NOW + 60 * DAY, signedDate: NOW + 30 * DAY }), renewal: { autoRenewStatus: 0, expirationIntent: 1, signedDate: NOW + 31 * DAY }, expect: { status: "active", access: true, renew: false } },
    { name: "billing retry after expiry, no grace", tx: tx({ transactionId: "t4", expiresDate: NOW - DAY, signedDate: NOW - 30 * DAY }), renewal: { autoRenewStatus: 1, isInBillingRetryPeriod: true, signedDate: NOW }, expect: { status: "on_hold", access: false } },
    { name: "grace period keeps access until gracePeriodExpiresDate", tx: tx({ transactionId: "t4", expiresDate: NOW - DAY, signedDate: NOW - 30 * DAY }), renewal: { autoRenewStatus: 1, isInBillingRetryPeriod: true, gracePeriodExpiresDate: NOW + 15 * DAY, signedDate: NOW }, expect: { status: "grace", access: true } },
    { name: "grace ended without payment = expired", tx: tx({ transactionId: "t4", expiresDate: NOW - 20 * DAY, signedDate: NOW - 50 * DAY }), renewal: { autoRenewStatus: 1, gracePeriodExpiresDate: NOW - 4 * DAY, signedDate: NOW - 4 * DAY }, expect: { status: "expired", access: false } },
    { name: "refund (revocationDate) closes access immediately even with future expiry", tx: tx({ transactionId: "t5", expiresDate: NOW + 25 * DAY, revocationDate: NOW, revocationReason: 0, signedDate: NOW }), renewal: { autoRenewStatus: 0, signedDate: NOW }, expect: { status: "revoked", access: false } },
    { name: "resubscribe (new original transaction) grants again", tx: tx({ transactionId: "t9", originalTransactionId: "o2", expiresDate: NOW + 30 * DAY, signedDate: NOW + DAY }), renewal: { autoRenewStatus: 1, signedDate: NOW + DAY }, expect: { status: "active", access: true } },
  ];
  for (const step of steps) {
    const s = appleState(step.tx, step.renewal, null, NOW);
    const got = { status: s.status, access: grants(s), ...(step.expect.product ? { product: s.productId } : {}), ...(step.expect.renew !== undefined ? { renew: s.autoRenewing } : {}) };
    eq({ step: step.name, ...got }, { step: step.name, ...step.expect });
    eq(s.accountToken, FAMILY); // appAccountToken normalised to lowercase family id
    eq(s.version, Math.max(step.tx.signedDate ?? 0, step.renewal?.signedDate ?? 0)); // order = signed state, not purchase date
  }
});
Deno.test("Apple: API status overrides heuristics (status 5 = revoked, 4 = grace, 3 = billing retry)", () => {
  const t = tx({ expiresDate: NOW + 20 * DAY });
  eq(appleState(t, null, 5, NOW).status, "revoked");
  eq(appleState(t, { gracePeriodExpiresDate: NOW + 5 * DAY }, 4, NOW).status, "grace");
  eq(appleState(tx({ expiresDate: NOW - DAY }), null, 3, NOW).status, "on_hold");
  eq(appleState(tx({ expiresDate: NOW - DAY }), null, 2, NOW).status, "expired");
  eq(appleState(tx({ expiresDate: NOW - DAY }), null, 1, NOW).status, "active"); // API says active: trust the store
});
Deno.test("Apple: restore replays the same signed state with the same version (SQL skips it as stale)", () => {
  const a = appleState(tx(), { autoRenewStatus: 1, signedDate: NOW - 10 * DAY }, null, NOW);
  const b = appleState(tx(), { autoRenewStatus: 1, signedDate: NOW - 10 * DAY }, null, NOW);
  eq(summary(a), summary(b)); eq(a.storeKey, b.storeKey);
});
Deno.test("Apple: out-of-order notification carries an older version than the state it must not overwrite", () => {
  const renew = appleState(tx({ transactionId: "t2", expiresDate: NOW + 50 * DAY, signedDate: NOW }), { autoRenewStatus: 1, signedDate: NOW }, null, NOW);
  const lateCancel = appleState(tx({ transactionId: "t1", expiresDate: NOW + 20 * DAY, signedDate: NOW - 10 * DAY }), { autoRenewStatus: 0, signedDate: NOW - 5 * DAY }, null, NOW);
  eq(lateCancel.version! < renew.version!, true);
});
Deno.test("Apple: wrong bundle or non-subscription is a permanent 422", () => {
  for (const bad of [tx({ bundleId: "com.other.app" }), tx({ expiresDate: undefined })]) {
    let caught: unknown; try { appleState(bad, null, null, NOW); } catch (e) { caught = e; }
    eq(caught instanceof IapError && caught.httpStatus === 422, true);
  }
});

const db = { from: () => ({ select: () => ({ eq: () => ({ eq: (_c: string, basePlan: string) => ({ maybeSingle: async () => ({ data: basePlan === "monthly" || basePlan === "yearly" ? { product_id: `gina_plus_${basePlan}` } : null, error: null }) }) }) }) }) } as unknown as SupabaseClient;
const gsub = (state: string, over: Record<string, unknown> = {}) => ({
  subscriptionState: state, acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  externalAccountIdentifiers: { obfuscatedExternalAccountId: FAMILY },
  lineItems: [{ productId: "gina_plus", expiryTime: new Date(NOW + 20 * DAY).toISOString(), autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly", offerId: "trial7" } }],
  ...over,
});
Deno.test("Google lifecycle table", async () => {
  const future = new Date(Date.now() + 20 * DAY).toISOString(), past = new Date(Date.now() - DAY).toISOString();
  const cases: { name: string; sub: Record<string, unknown>; revoked?: boolean; expect: { status: string | null; renew?: boolean; replaces?: string | null } }[] = [
    { name: "purchase (active, acknowledged)", sub: gsub("SUBSCRIPTION_STATE_ACTIVE", { lineItems: [{ productId: "gina_plus", expiryTime: future, autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly" } }] }), expect: { status: "active", renew: true } },
    { name: "pending payment: no entitlement yet", sub: gsub("SUBSCRIPTION_STATE_PENDING"), expect: { status: null } },
    { name: "cancelled but paid period still running keeps access, auto-renew off", sub: gsub("SUBSCRIPTION_STATE_CANCELED", { lineItems: [{ productId: "gina_plus", expiryTime: future, autoRenewingPlan: { autoRenewEnabled: false }, offerDetails: { basePlanId: "monthly" } }] }), expect: { status: "active", renew: false } },
    { name: "cancelled and period over = expired", sub: gsub("SUBSCRIPTION_STATE_CANCELED", { lineItems: [{ productId: "gina_plus", expiryTime: past, offerDetails: { basePlanId: "monthly" } }] }), expect: { status: "expired" } },
    { name: "grace period keeps access", sub: gsub("SUBSCRIPTION_STATE_IN_GRACE_PERIOD", { lineItems: [{ productId: "gina_plus", expiryTime: future, offerDetails: { basePlanId: "monthly" } }] }), expect: { status: "grace" } },
    { name: "account hold (billing retry) closes access", sub: gsub("SUBSCRIPTION_STATE_ON_HOLD"), expect: { status: "on_hold" } },
    { name: "paused closes access", sub: gsub("SUBSCRIPTION_STATE_PAUSED"), expect: { status: "on_hold" } },
    { name: "expired", sub: gsub("SUBSCRIPTION_STATE_EXPIRED"), expect: { status: "expired" } },
    { name: "refund/revocation confirmed by API = revoked", sub: gsub("SUBSCRIPTION_STATE_EXPIRED"), revoked: true, expect: { status: "revoked" } },
    { name: "late revocation hint vs active API = still active", sub: gsub("SUBSCRIPTION_STATE_ACTIVE", { lineItems: [{ productId: "gina_plus", expiryTime: future, offerDetails: { basePlanId: "monthly" } }] }), revoked: true, expect: { status: "active" } },
    { name: "plan change: new token links the old one for same-transaction expiry", sub: gsub("SUBSCRIPTION_STATE_ACTIVE", { linkedPurchaseToken: "old-token", lineItems: [{ productId: "gina_plus", expiryTime: future, offerDetails: { basePlanId: "yearly" } }] }), expect: { status: "active", replaces: "old-token" } },
    { name: "unknown state fails closed (expired)", sub: gsub("SUBSCRIPTION_STATE_SOMETHING_NEW"), expect: { status: "expired" } },
  ];
  for (const c of cases) {
    const s = await googleState(db, "token", c.sub, { revoked: c.revoked });
    const got = { status: s?.status ?? null, ...(c.expect.renew !== undefined ? { renew: s?.autoRenewing } : {}), ...(c.expect.replaces !== undefined ? { replaces: s?.replacesStoreKey } : {}) };
    eq({ step: c.name, ...got }, { step: c.name, ...c.expect });
    if (s) eq(s.accountToken, FAMILY);
  }
});
Deno.test("Google: unknown base plan is a permanent 422, not an entitlement", async () => {
  let caught: unknown;
  try { await googleState(db, "token", gsub("SUBSCRIPTION_STATE_ACTIVE", { lineItems: [{ productId: "gina_plus", offerDetails: { basePlanId: "weekly" } }] })); } catch (e) { caught = e; }
  eq(caught instanceof IapError && caught.httpStatus === 422 && caught.code.startsWith("unknown_product"), true);
});
