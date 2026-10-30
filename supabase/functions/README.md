# Edge Functions

| Fonksiyon | Amaç | Deploy |
| --- | --- | --- |
| `apple-notifications` | App Store Server Notifications V2 alıcısı; olayları `store_notifications`'a yazar, mağaza anahtarları tanımlanınca aboneliği doğrulayıp `store_subscriptions`'ı günceller | `supabase functions deploy apple-notifications --no-verify-jwt` |
| `iap-verify` | Uygulamadan gelen StoreKit 2 JWS / Play purchaseToken'ı doğrular, aile aboneliğini yazar; istemci `finishTransaction`'ı yalnız 200 ok'ta çağırır (bkz. docs/IAP.md) | `supabase functions deploy iap-verify` |
| `iap-reconcile` | pg_cron ile 6 saatte bir; süresi yaklaşan abonelikleri mağazadan yeniden kontrol eder. `x-cron-secret: IAP_CRON_SECRET` | `supabase functions deploy iap-reconcile --no-verify-jwt` |
| `prova-generate` | Veli isteğiyle konu/sınıf için soru üretir, provenance ile `question_bank`'a yazar (Plus/Pro, aylık kota) | `supabase functions deploy prova-generate` |
| `prova-grade` | Bitmiş denemenin açık uçlu cevaplarını puanlar; veli puanını ezmez; çocuk adı gönderilmez (Pro) | `supabase functions deploy prova-grade` |
| `prova-plan` | Zayıf konulardan 7/14 günlük çalışma planı taslağı (Pro) | `supabase functions deploy prova-plan` |
| `push-send` | `push_outbox` kuyruğunu boşaltır; APNs (token auth) ve FCM HTTP v1 ile kişisel veri içermeyen bildirim gönderir. Sırlar: `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_ENV`, `FCM_SERVICE_ACCOUNT_JSON`, `PUSH_SEND_SECRET`; Vault: `push_send_url`, `push_send_secret` (bkz. docs/PUSH.md) | `supabase functions deploy push-send --no-verify-jwt` |
| `google-rtdn` | Google Play RTDN (Pub/Sub push) alıcısı; aynı akış | `supabase functions deploy google-rtdn --no-verify-jwt` |

Gerekli secrets (`supabase secrets set …`; değerleri yalnız Enes girer):

- `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_P8` — App Store Connect → Integrations → In-App Purchase anahtarı
- `APPLE_BUNDLE_ID` = `com.enescevik.gina`
- `GOOGLE_PLAY_SA_KEY` — Play Android Developer API service account JSON'u
- `GOOGLE_RTDN_AUDIENCE` — Pub/Sub push aboneliğinin audience URL'si
- `ANTHROPIC_API_KEY` — haftalık özet (ayrı fonksiyon, Faz 2)

Anahtarlar tanımlı değilken fonksiyonlar olayları günlüğe alır ve `store_not_configured` ile işaretler; hiçbir istek kaybolmaz, kurulumdan sonra `store_notifications` üzerinden yeniden işlenebilir.

Yerelde çalıştırma: `supabase functions serve apple-notifications --no-verify-jwt` + `curl -X POST localhost:54321/functions/v1/apple-notifications -d '{"signedPayload":"<jws>"}'`.
