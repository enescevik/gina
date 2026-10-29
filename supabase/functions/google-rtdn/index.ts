// Google Play Real-time Developer Notifications alıcısı (Cloud Pub/Sub push).
// Kurulum: Pub/Sub topic + push subscription (OIDC token açık, audience bu URL) → Play Console → Monetization setup.
// Deploy: `supabase functions deploy google-rtdn --no-verify-jwt` (Pub/Sub OIDC JWT'si ayrıca doğrulanır).

import { json, serviceClient } from "../_shared/supabase.ts";
import { logNotification, markProcessed } from "../_shared/entitlement.ts";

interface PubSubEnvelope {
  message?: { data?: string; messageId?: string };
  subscription?: string;
}

interface DeveloperNotification {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string };
  testNotification?: unknown;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // TODO(iap): Authorization: Bearer <OIDC JWT> imzasını Google JWKS + audience ile doğrula
  // (kurulumda GOOGLE_RTDN_AUDIENCE secret'ı tanımlanınca). Doğrulamasız istek yalnız günlüğe düşer.
  const verified = false;

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
    : notification.testNotification
      ? "test"
      : "unknown";

  const fresh = await logNotification(db, "google", eventKey, type, { verified, notification });
  if (!fresh) return json({ ok: true, duplicate: true });

  if (!Deno.env.get("GOOGLE_PLAY_SA_KEY")) {
    await markProcessed(db, eventKey, "store_not_configured");
    return json({ ok: true, deferred: true });
  }

  try {
    // TODO(iap): purchaseToken'ı purchases.subscriptionsv2.get ile doğrula, obfuscatedExternalAccountId
    // üzerinden aileyi bul ve upsertSubscription çağır; gerekiyorsa acknowledge et.
    await markProcessed(db, eventKey, "not_implemented");
    return json({ ok: true });
  } catch (e) {
    await markProcessed(db, eventKey, String(e));
    return json({ error: "processing_failed" }, 500);
  }
});
