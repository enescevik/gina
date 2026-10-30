// Apple App Store Server Notifications V2 alıcısı.
// Kurulum: App Store Connect → App Information → App Store Server Notifications → bu fonksiyonun URL'si.
// Deploy: `supabase functions deploy apple-notifications --no-verify-jwt` (Apple kendi JWS imzasını taşır).
//
// GÜVENLİK MODELİ: signedPayload ve içindeki signedTransactionInfo / signedRenewalInfo x5c zinciriyle
// gömülü Apple Root CA G3'e karşı doğrulanır (_shared/iap.ts). Doğrulanamayan olay günlüğe düşer,
// işlenmez. APPLE_IAP_KEY_* tanımlıysa durum ayrıca App Store Server API'den tazelenir.
// Aile eşlemesi: mevcut store_subscriptions satırı, yoksa appAccountToken (= family_id).

import { json, serviceClient } from "../_shared/supabase.ts";
import { logNotification, markProcessed } from "../_shared/entitlement.ts";
import {
  APPLE_BUNDLE_ID,
  appleApiConfigured,
  applyStoreState,
  appleState,
  fetchAppleState,
  IapError,
  peekJws,
  verifyAppleJws,
  type AppleRenewalInfo,
  type AppleTransaction,
} from "../_shared/iap.ts";

interface NotificationV2 {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: { signedTransactionInfo?: string; signedRenewalInfo?: string; bundleId?: string; environment?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { signedPayload?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (typeof body.signedPayload !== "string") return json({ error: "missing_signedPayload" }, 400);

  const db = serviceClient();

  let payload: NotificationV2;
  let verified = true;
  try {
    payload = await verifyAppleJws<NotificationV2>(body.signedPayload);
  } catch {
    verified = false;
    payload = peekJws<NotificationV2>(body.signedPayload) ?? {};
  }
  const eventKey = payload.notificationUUID ?? crypto.randomUUID();
  const eventType = [payload.notificationType, payload.subtype].filter(Boolean).join(":") || null;

  const fresh = await logNotification(db, "apple", eventKey, eventType, { verified, payload });
  if (!fresh) {
    // Aynı olay: yalnız önceki deneme hata ile bittiyse (Apple yeniden gönderdi) tekrar işlenir.
    const { data: prev } = await db.from("store_notifications").select("error").eq("event_key", eventKey).maybeSingle();
    if (!prev?.error || prev.error === "invalid_jws") return json({ ok: true, duplicate: true });
  }

  if (!verified) {
    await markProcessed(db, eventKey, "invalid_jws");
    return json({ error: "invalid_jws" }, 400);
  }
  if (payload.notificationType === "TEST" || !payload.data?.signedTransactionInfo) {
    await markProcessed(db, eventKey);
    return json({ ok: true });
  }
  if (payload.data.bundleId && payload.data.bundleId !== APPLE_BUNDLE_ID()) {
    await markProcessed(db, eventKey, "bundle_mismatch");
    return json({ ok: true, ignored: true });
  }

  try {
    const tx = await verifyAppleJws<AppleTransaction>(payload.data.signedTransactionInfo);
    const renewal = payload.data.signedRenewalInfo
      ? await verifyAppleJws<AppleRenewalInfo>(payload.data.signedRenewalInfo)
      : null;
    let state = appleState(tx, renewal);
    if (appleApiConfigured()) {
      state = (await fetchAppleState(tx.originalTransactionId, tx.environment)) ?? state;
    }
    await db.from("store_notifications").update({ store_key: state.storeKey }).eq("event_key", eventKey);
    await applyStoreState(db, state);
    await markProcessed(db, eventKey);
    return json({ ok: true });
  } catch (e) {
    const code = e instanceof IapError ? e.code : String(e);
    await markProcessed(db, eventKey, code);
    // Aile henüz eşlenmediyse (istemci iap-verify'ı sonra çağıracak) Apple'ın tekrar denemesine gerek yok.
    if (e instanceof IapError && e.httpStatus < 500) return json({ ok: true, deferred: code });
    return json({ error: "processing_failed" }, 500);
  }
});
