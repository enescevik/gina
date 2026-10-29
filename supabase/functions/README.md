# Edge Functions

| Fonksiyon | Amaç | Deploy |
| --- | --- | --- |
| `apple-notifications` | App Store Server Notifications V2 alıcısı; olayları `store_notifications`'a yazar, mağaza anahtarları tanımlanınca aboneliği doğrulayıp `store_subscriptions`'ı günceller | `supabase functions deploy apple-notifications --no-verify-jwt` |
| `google-rtdn` | Google Play RTDN (Pub/Sub push) alıcısı; aynı akış | `supabase functions deploy google-rtdn --no-verify-jwt` |

Gerekli secrets (`supabase secrets set …`; değerleri yalnız Enes girer):

- `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_P8` — App Store Connect → Integrations → In-App Purchase anahtarı
- `APPLE_BUNDLE_ID` = `com.enescevik.gina`
- `GOOGLE_PLAY_SA_KEY` — Play Android Developer API service account JSON'u
- `GOOGLE_RTDN_AUDIENCE` — Pub/Sub push aboneliğinin audience URL'si
- `ANTHROPIC_API_KEY` — haftalık özet (ayrı fonksiyon, Faz 2)

Anahtarlar tanımlı değilken fonksiyonlar olayları günlüğe alır ve `store_not_configured` ile işaretler; hiçbir istek kaybolmaz, kurulumdan sonra `store_notifications` üzerinden yeniden işlenebilir.

Yerelde çalıştırma: `supabase functions serve apple-notifications --no-verify-jwt` + `curl -X POST localhost:54321/functions/v1/apple-notifications -d '{"signedPayload":"<jws>"}'`.
