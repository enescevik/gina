// Google Play Real-time Developer Notifications alıcısı (Cloud Pub/Sub push).
// Kurulum: Pub/Sub topic + push subscription (OIDC token açık, audience bu URL) → Play Console → Monetization setup.
// Deploy: `supabase functions deploy google-rtdn --no-verify-jwt` (Pub/Sub OIDC JWT'si ayrıca doğrulanır).
//
// GÜVENLİK MODELİ: bildirim yalnız "ipucu"dur; purchaseToken'ın gerçek durumu Play Developer API'den
// (subscriptionsv2.get) okunur. GOOGLE_RTDN_AUDIENCE tanımlıysa OIDC JWT zorunludur (imza + aud + iss;
// GOOGLE_RTDN_SA_EMAIL tanımlıysa e-posta da). Aile eşlemesi: mevcut satır, yoksa obfuscatedExternalAccountId.

import { json, serviceClient } from "../_shared/supabase.ts";
import { logNotification, markProcessed } from "../_shared/entitlement.ts";
import {
  applyStoreState,
  GOOGLE_PACKAGE_NAME,
  googleApiConfigured,
  IapError,
  refreshGoogle,
  verifyGoogleOidc,
} from "../_shared/iap.ts";

interface PubSubEnvelope {
  message?: { data?: string; messageId?: string };
  subscription?: string;
}

interface DeveloperNotification {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string };
  voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
  testNotification?: unknown;
}

/** RTDN SubscriptionNotification.notificationType: 12 = SUBSCRIPTION_REVOKED. */
const SUBSCRIPTION_REVOKED = 12;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const audience = Deno.env.get("GOOGLE_RTDN_AUDIENCE");
  const verified = audience
    ? await verifyGoogleOidc(req.headers.get("authorization"), audience, Deno.env.get("GOOGLE_RTDN_SA_EMAIL") ?? undefined)
    : false;
  // Audience tanımlıyken doğrulanamayan istek reddedilir (Pub/Sub 401'de yeniden dener).
  if (audience && !verified) return json({ error: "unauthorized" }, 401);

  let envelope: PubSubEnvelope;
  try {
    envelope = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const eventKey = envelope.message?.messageId ?? crypto.randomUUID();
  let notification: DeveloperNotification = {};
  try {
    notification = JSON.parse(atob(envelope.message?.data ?? "")) as DeveloperNotification;
  } catch {
    // boş/deneme bildirimi
  }

  const db = serviceClient();
  const type = notification.subscriptionNotification
    ? `subscription:${notification.subscriptionNotification.notificationType ?? "?"}`
    : notification.voidedPurchaseNotification
      ? "voided"
      : notification.testNotification
        ? "test"
        : "unknown";

  const fresh = await logNotification(db, "google", eventKey, type, { verified, notification });
  if (!fresh) {
    const { data: prev } = await db.from("store_notifications").select("error").eq("event_key", eventKey).maybeSingle();
    if (!prev?.error) return json({ ok: true, duplicate: true });
  }

  const purchaseToken =
    notification.subscriptionNotification?.purchaseToken ?? notification.voidedPurchaseNotification?.purchaseToken;
  if (!purchaseToken || (notification.packageName && notification.packageName !== GOOGLE_PACKAGE_NAME())) {
    await markProcessed(db, eventKey);
    return json({ ok: true, ignored: true });
  }

  if (!googleApiConfigured()) {
    await markProcessed(db, eventKey, "store_not_configured");
    return json({ ok: true, deferred: true });
  }

  try {
    await db.from("store_notifications").update({ store_key: purchaseToken }).eq("event_key", eventKey);
    const revoked =
      notification.subscriptionNotification?.notificationType === SUBSCRIPTION_REVOKED ||
      !!notification.voidedPurchaseNotification;
    const state = await refreshGoogle(db, purchaseToken, { revoked });
    if (state) await applyStoreState(db, state);
    await markProcessed(db, eventKey, state ? undefined : "pending");
    return json({ ok: true });
  } catch (e) {
    const code = e instanceof IapError ? e.code : String(e);
    await markProcessed(db, eventKey, code);
    // 4xx (ör. aile henüz eşlenmedi, bilinmeyen ürün): Pub/Sub'ın tekrar denemesi işe yaramaz.
    if (e instanceof IapError && e.httpStatus < 500) return json({ ok: true, deferred: code });
    return json({ error: "processing_failed" }, 500);
  }
});
