// Uygulama içi satın alma doğrulaması. Veli uygulaması her satın alma/geri yüklemede çağırır (JWT ile).
// Deploy: `supabase functions deploy iap-verify` (verify_jwt açık kalır).
//
// İstek:
//   { "platform": "apple",  "signedTransaction": "<StoreKit 2 JWS>" }
//   { "platform": "google", "purchaseToken": "<token>", "productId": "gina_plus" }   (Android abonelik kimliği)
// Yanıt 200: { ok: true, plan, status, product_id, expires_at }   → istemci finishTransaction çağırır
//        200: { ok: false, pending: true }                         → ödeme bekliyor (Android), finish yok
//        400 invalid_input · 403 forbidden · 409 account_mismatch (işlem başka aileye bağlı)
//        422 invalid_jws / bundle_mismatch / invalid_purchase_token / unknown_product
//        503 store_not_configured (Google service account tanımlı değil) · 502 mağaza API hatası
//
// Kurallar: yalnız parent rolü; aile = JWT'deki family_id; işlemin appAccountToken'ı (iOS) /
// obfuscatedExternalAccountId'si (Android) varsa bu aileyle aynı olmalı. Apple JWS zinciri gömülü
// Apple Root CA G3'e karşı çevrimdışı doğrulanır; App Store Server API anahtarı varsa durum ayrıca
// API'den tazelenir. Google tarafı yalnız Play Developer API yanıtına güvenir ve satın almayı onaylar.

import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import {
  appleApiConfigured,
  applyStoreState,
  appleState,
  fetchAppleState,
  googleApiConfigured,
  IapError,
  refreshGoogle,
  verifyAppleJws,
  type AppleTransaction,
  type StoreState,
} from "../_shared/iap.ts";

import { readParent } from "../_shared/auth.ts";

type Input =
  | { platform: "apple"; signedTransaction: string }
  | { platform: "google"; purchaseToken: string; productId: string };

function parseInput(body: unknown): Input | null {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const parent = await readParent(req);
  if (!parent) return json({ error: "forbidden" }, 403);
  const familyId = parent.familyId;

  let input: Input | null = null;
  try {
    input = parseInput(await req.json());
  } catch {
    // aşağıda invalid_input
  }
  if (!input) return json({ error: "invalid_input" }, 400);

  const db = serviceClient();

  try {
    let state: StoreState | null;
    if (input.platform === "apple") {
      // Zincir + imza + bundleId; anahtar yoksa da çalışır (çevrimdışı doğrulama).
      const tx = await verifyAppleJws<AppleTransaction>(input.signedTransaction);
      state = appleState(tx, null);
      if (appleApiConfigured()) {
        state = (await fetchAppleState(tx.originalTransactionId, tx.environment)) ?? state;
      }
    } else {
      const { data: known } = await db
        .from("plan_products")
        .select("product_id")
        .eq("android_product_id", input.productId)
        .eq("active", true)
        .limit(1);
      if (!known?.length) return json({ error: `unknown_product:${input.productId}` }, 422);
      if (!googleApiConfigured()) return json({ error: "store_not_configured" }, 503);
      state = await refreshGoogle(db, input.purchaseToken);
      if (!state) return json({ ok: false, pending: true });
      const androidProductId = (state.raw as { androidProductId?: string }).androidProductId;
      if (androidProductId !== input.productId) return json({ error: "product_mismatch" }, 422);
    }

    const result = await applyStoreState(db, state, { callerFamilyId: familyId, purchaserUserId: parent.userId });
    return json({
      ok: true,
      plan: result.plan,
      status: result.status,
      product_id: result.productId,
      expires_at: result.expiresAt,
    });
  } catch (e) {
    if (e instanceof IapError) return json({ error: e.code, detail: e.detail }, e.httpStatus);
    console.error("iap-verify", e);
    return json({ error: "verify_failed" }, 500);
  }
});
