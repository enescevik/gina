// Abonelik uzlaştırması: bitişi yaklaşan / askıdaki abonelikleri ve PENDING görülmüş onaysız Google
// satın almalarını mağazadan yeniden sorgular. Bildirim (ASSN V2 / RTDN) kaçsa bile yetki doğru kalır.
// pg_cron 6 saatte bir çağırır (20261030100000_iap.sql; Vault: project_url + iap_cron_secret).
// Deploy: `supabase functions deploy iap-reconcile --no-verify-jwt` (x-cron-secret başlığıyla korunur).
//
// İstek: POST, başlık `x-cron-secret: <IAP_CRON_SECRET>`; gövde isteğe bağlı { "limit": 200 }.
// Yanıt 200: { ok: true, checked, updated, unchanged, skipped, failed: [{ store_key_hint, error }] }
//        401 unauthorized · 503 store_not_configured (ne Apple API anahtarı ne Google service account var)

import { serviceClient } from "../_shared/supabase.ts";
import { appleApiConfigured, applyStoreState, fetchAppleState, googleApiConfigured, refreshGoogle } from "../_shared/iap.ts";
import { iapReconcile } from "./handler.ts";

Deno.serve((req) =>
  iapReconcile(req, {
    cronSecret: () => Deno.env.get("IAP_CRON_SECRET"),
    serviceClient,
    appleConfigured: appleApiConfigured,
    googleConfigured: googleApiConfigured,
    read: (db, platform, key) => (platform === "apple" ? fetchAppleState(key) : refreshGoogle(db, key)),
    applyStoreState,
  }));
