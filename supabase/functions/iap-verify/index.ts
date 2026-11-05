// Uygulama içi satın alma doğrulaması. Veli uygulaması her satın alma/geri yüklemede çağırır (JWT ile).
// Deploy: `supabase functions deploy iap-verify` (verify_jwt açık kalır).
//
// İstek:
//   { "platform": "apple",  "signedTransaction": "<StoreKit 2 JWS>" }
//   { "platform": "google", "purchaseToken": "<token>", "productId": "gina_plus" }   (Android abonelik kimliği)
// Yanıt 200: { ok: true, plan, status, product_id, expires_at }   → istemci finishTransaction çağırır
//        200: { ok: false, pending: true }                         → ödeme bekliyor (Android), finish yok
//        400 invalid_input · 403 forbidden · 409 account_mismatch (işlem başka aileye bağlı; audit_log'a yazılır)
//        422 invalid_jws / bundle_mismatch / invalid_purchase_token / unknown_product / product_mismatch
//        503 store_not_configured (Google service account tanımlı değil) · 503 acknowledge_failed (hak yazıldı,
//            Google onayı alınamadı; istemci finish çağırmaz, yeniden dener) · 502 mağaza API hatası
//
// Kurallar: yalnız parent rolü; aile = JWT'deki family_id; işlemin appAccountToken'ı (iOS) /
// obfuscatedExternalAccountId'si (Android) varsa bu aileyle aynı olmalı. Apple JWS zinciri gömülü
// Apple Root CA G3'e karşı çevrimdışı doğrulanır; App Store Server API anahtarı varsa durum ayrıca
// API'den tazelenir. Google tarafı yalnız Play Developer API yanıtına güvenir; acknowledge ancak hak
// yazıldıktan sonra yapılır (handler.ts).

import { iapVerify } from "./handler.ts";

Deno.serve((req) => iapVerify(req));
