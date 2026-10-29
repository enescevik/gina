// Apple App Store Server Notifications V2 alıcısı.
// Kurulum: App Store Connect → App Information → App Store Server Notifications → bu fonksiyonun URL'si.
// Deploy: `supabase functions deploy apple-notifications --no-verify-jwt` (Apple kendi JWS imzasını taşır).
//
// GÜVENLİK MODELİ (DECISIONS.md): gelen signedPayload yalnız "ipucu" sayılır; transactionId'yi
// decode edip gerçeği App Store Server API'den TLS ile yeniden çekeriz. Böylece Apple'ın x5c
// zincir doğrulamasını Deno'da yeniden kurmak gerekmez. API çağrısı APPLE_IAP_KEY_* secrets ister.

import { json, serviceClient } from "../_shared/supabase.ts";
import { logNotification, markProcessed } from "../_shared/entitlement.ts";

interface NotificationV2 {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: { signedTransactionInfo?: string; signedRenewalInfo?: string; bundleId?: string };
}

function decodeJwsPayload<T>(jws: string): T {
  const part = jws.split(".")[1] ?? "";
  const pad = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(pad)) as T;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { signedPayload?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!body.signedPayload) return json({ error: "missing_signedPayload" }, 400);

  const db = serviceClient();
  const payload = decodeJwsPayload<NotificationV2>(body.signedPayload);
  const eventKey = payload.notificationUUID ?? crypto.randomUUID();

  const fresh = await logNotification(db, "apple", eventKey, payload.notificationType ?? null, payload);
  if (!fresh) return json({ ok: true, duplicate: true });

  if (!Deno.env.get("APPLE_IAP_KEY_ID")) {
    // Mağaza anahtarları henüz tanımlı değil: olay günlüğe alındı, işleme Faz 2 kurulumunda açılır.
    await markProcessed(db, eventKey, "store_not_configured");
    return json({ ok: true, deferred: true });
  }

  try {
    // TODO(iap): App Store Server API ile transactionId'yi doğrula, aileyi app_account_token
    // üzerinden eşle ve upsertSubscription çağır. (expo-iap istemcisi appAccountToken'a family_id yazar.)
    await markProcessed(db, eventKey, "not_implemented");
    return json({ ok: true });
  } catch (e) {
    await markProcessed(db, eventKey, String(e));
    return json({ error: "processing_failed" }, 500);
  }
});
