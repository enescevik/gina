// iap-verify işleyicisi (bağımlılıklar test için enjekte edilir; Deno.serve index.ts'te).
//
// Sıra (Google): plan_products kontrolü → Play API'den oku (acknowledge YOK) → aile eşlemesi ve
// hak yazımı tek SQL işleminde → ancak hak yazıldıysa acknowledge → onay kaydı. Böylece başka
// aileye bağlı bir token acknowledge edilmez (Google 3 günde iade eder) ve acknowledge hatası
// 503 ile istemciye döner: istemci finishTransaction çağırmaz, yeniden doğrulama acknowledge'ı tekrar dener.
// Sıra (Apple): JWS zinciri → appleState → (anahtar varsa) App Store Server API → hak yazımı.
// Başka aileye bağlı makbuz: 409 account_mismatch + audit_log kaydı (ham anahtar yazılmaz).

import { json, preflight } from "../_shared/supabase.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  acknowledgeGoogle,
  appleApiConfigured,
  applyStoreState,
  appleState,
  fetchAppleState,
  fetchGoogleSubscription,
  googleApiConfigured,
  googleNeedsAcknowledge,
  googleState,
  IapError,
  recordStoreAccountConflict,
  verifyAppleJws,
  type AppleTransaction,
  type GoogleSubscriptionV2,
  type StoreState,
} from "../_shared/iap.ts";
import { readParent, type ParentContext } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/supabase.ts";

export type Input =
  | { platform: "apple"; signedTransaction: string }
  | { platform: "google"; purchaseToken: string; productId: string };

export function parseInput(body: unknown): Input | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.platform === "apple") {
    const jws = b.signedTransaction;
    if (typeof jws !== "string" || jws.length > 20_000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jws)) return null;
    return { platform: "apple", signedTransaction: jws };
  }
  if (b.platform === "google") {
    const token = b.purchaseToken;
    const productId = b.productId;
    if (typeof token !== "string" || !/^[A-Za-z0-9._:-]{10,2048}$/.test(token)) return null;
    if (typeof productId !== "string" || !/^[a-z0-9_.]{1,100}$/.test(productId)) return null;
    return { platform: "google", purchaseToken: token, productId };
  }
  return null;
}

export interface VerifyDependencies {
  readParent: (req: Request) => Promise<ParentContext | null>;
  serviceClient: () => SupabaseClient;
  verifyAppleJws: <T extends object>(jws: string) => Promise<T>;
  appleState: typeof appleState;
  appleApiConfigured: () => boolean;
  fetchAppleState: (originalTransactionId: string, environment?: string) => Promise<StoreState | null>;
  googleApiConfigured: () => boolean;
  /** plan_products'ta aktif Android ürünü var mı. */
  knownAndroidProduct: (db: SupabaseClient, androidProductId: string) => Promise<boolean>;
  fetchGoogleSubscription: (purchaseToken: string) => Promise<GoogleSubscriptionV2>;
  googleState: (db: SupabaseClient, purchaseToken: string, sub: GoogleSubscriptionV2) => Promise<StoreState | null>;
  acknowledgeGoogle: (subscriptionId: string, purchaseToken: string) => Promise<void>;
  applyStoreState: typeof applyStoreState;
  recordStoreAccountConflict: typeof recordStoreAccountConflict;
  now: () => number;
}

export const defaultDependencies: VerifyDependencies = {
  readParent: (req) => readParent(req),
  serviceClient,
  verifyAppleJws: (jws) => verifyAppleJws(jws),
  appleState,
  appleApiConfigured,
  fetchAppleState,
  googleApiConfigured,
  knownAndroidProduct: async (db, androidProductId) => {
    const { data, error } = await db.from("plan_products").select("product_id").eq("android_product_id", androidProductId).eq("active", true).limit(1);
    if (error) throw new IapError("store_state_write_failed", 503);
    return !!data?.length;
  },
  fetchGoogleSubscription,
  googleState: (db, token, sub) => googleState(db, token, sub),
  acknowledgeGoogle,
  applyStoreState,
  recordStoreAccountConflict,
  now: () => Date.now(),
};

export async function iapVerify(req: Request, deps: VerifyDependencies = defaultDependencies): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const parent = await deps.readParent(req);
  if (!parent) return json({ error: "forbidden" }, 403);
  const familyId = parent.familyId;

  let input: Input | null = null;
  try {
    input = parseInput(await req.json());
  } catch {
    // aşağıda invalid_input
  }
  if (!input) return json({ error: "invalid_input" }, 400);

  const db = deps.serviceClient();
  const ctx = { callerFamilyId: familyId, purchaserUserId: parent.userId };
  let state: StoreState | null = null;

  try {
    if (input.platform === "apple") {
      // Zincir + imza + bundleId; anahtar yoksa da çalışır (çevrimdışı doğrulama).
      const tx = await deps.verifyAppleJws<AppleTransaction>(input.signedTransaction);
      state = deps.appleState(tx, null);
      if (deps.appleApiConfigured()) {
        state = (await deps.fetchAppleState(tx.originalTransactionId, tx.environment)) ?? state;
      }
      state.source = "client_verify";
      const result = await deps.applyStoreState(db, state, ctx);
      return json({ ok: true, plan: result.plan, status: result.status, product_id: result.productId, expires_at: result.expiresAt });
    }

    if (!(await deps.knownAndroidProduct(db, input.productId))) return json({ error: `unknown_product:${input.productId}` }, 422);
    if (!deps.googleApiConfigured()) return json({ error: "store_not_configured" }, 503);
    // Yerel gözlem sırası; Google olay sürümü değildir. Ağ çağrısından önce alınır.
    const observedAt = deps.now();
    const sub = await deps.fetchGoogleSubscription(input.purchaseToken);
    state = await deps.googleState(db, input.purchaseToken, sub);
    if (!state) return json({ ok: false, pending: true });
    state.version = observedAt;
    state.source = "client_verify";
    const androidProductId = (state.raw as { androidProductId?: string }).androidProductId;
    if (androidProductId !== input.productId) return json({ error: "product_mismatch" }, 422);

    // 1) Hak yazımı (aile eşlemesi burada reddedilirse acknowledge yapılmaz).
    const result = await deps.applyStoreState(db, state, ctx);
    // 2) Acknowledge yalnız hak yazıldıktan sonra; tekrar güvenli. Hata → 503, istemci finish çağırmaz.
    if (googleNeedsAcknowledge(state)) {
      try {
        await deps.acknowledgeGoogle(androidProductId!, input.purchaseToken);
      } catch (e) {
        if (e instanceof IapError) return json({ error: "acknowledge_failed", detail: e.code }, 503);
        throw e;
      }
      // 3) Onay kaydı: aynı durum, acknowledged=true, yeni gözlem sürümü. Hatası hak kaybettirmez;
      //    iap-reconcile PENDING görülen onaysız satırları yeniden okur.
      try {
        await deps.applyStoreState(db, { ...state, acknowledged: true, version: Math.max(deps.now(), observedAt + 1) }, ctx);
      } catch (e) {
        console.error("iap-verify acknowledged flag not saved", e instanceof IapError ? e.code : "error");
      }
    }
    return json({ ok: true, plan: result.plan, status: result.status, product_id: result.productId, expires_at: result.expiresAt });
  } catch (e) {
    if (e instanceof IapError) {
      if (e.code === "account_mismatch" && state) {
        await deps.recordStoreAccountConflict(db, state, { callerFamilyId: familyId, userId: parent.userId, source: "client_verify" });
      }
      return json({ error: e.code, detail: e.detail }, e.httpStatus);
    }
    console.error("iap-verify", e);
    return json({ error: "verify_failed" }, 500);
  }
}
