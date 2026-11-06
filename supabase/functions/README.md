# Edge Functions

| Fonksiyon | Amaç | Deploy |
| --- | --- | --- |
| `apple-notifications` | App Store Server Notifications V2 alıcısı; olayları `store_notifications`'a yazar, mağaza anahtarları tanımlanınca aboneliği doğrulayıp `store_subscriptions`'ı günceller | `supabase functions deploy apple-notifications --no-verify-jwt` |
| `iap-verify` | Uygulamadan gelen StoreKit 2 JWS / Play purchaseToken'ı doğrular, aile aboneliğini yazar; istemci `finishTransaction`'ı yalnız 200 ok'ta çağırır (bkz. docs/IAP.md) | `supabase functions deploy iap-verify` |
| `iap-reconcile` | pg_cron ile 6 saatte bir; süresi yaklaşan abonelikleri mağazadan yeniden kontrol eder. `x-cron-secret: IAP_CRON_SECRET` | `supabase functions deploy iap-reconcile --no-verify-jwt` |
| `prova-generate` | Veli isteğiyle konu/sınıf için soru üretir, provenance ile `question_bank`'a yazar (Plus/Pro, aylık kota) | `supabase functions deploy prova-generate` |
| `prova-grade` | Bitmiş denemenin açık uçlu cevaplarını puanlar; veli puanını ezmez; çocuk adı gönderilmez (Pro) | `supabase functions deploy prova-grade` |
| `prova-plan` | Zayıf konulardan 7/14 günlük çalışma planı taslağı (Pro) | `supabase functions deploy prova-plan` |
| `push-send` | `push_outbox` kuyruğunu boşaltır; S02: aynı tick e-posta/SMS `gina.channel_outbox` kuyruğunu da boşaltır (Resend/SMTP/HTTP SMS adapterleri `_shared/channels/`, env adları docs/PUSH.md §5; sağlayıcı yokken `unconfigured`); APNs (token auth) ve FCM HTTP v1 ile kişisel veri içermeyen bildirim gönderir. Sırlar: `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_ENV`, `FCM_SERVICE_ACCOUNT_JSON`, `PUSH_SEND_SECRET`; Vault: `push_send_url`, `push_send_secret` (bkz. docs/PUSH.md) | `supabase functions deploy push-send --no-verify-jwt` |
| `google-rtdn` | Google Play RTDN (Pub/Sub push) alıcısı; aynı akış | `supabase functions deploy google-rtdn --no-verify-jwt` |
| `content-prereview` | E01: kütüphane taslağı / katkı kopyası / MEB senaryo adayı için AI ön inceleme. Yönetici JWT ile (`request_content_prereview` RPC yetkiyi kanıtlar ve kaydı kuyruğa alır) veya `x-cron-secret: CONTENT_PREREVIEW_SECRET` ile `{"drain":true}`. Normalize içerik modele gider; çıktı şemayla doğrulanır; güven ≥ 0,85 ve engelleyici bulgu yoksa `ai_approved` (yayın değil), aksi `needs_admin` + yönetici outbox bildirimi. Kapı: `app_settings content_prereview.enabled` (varsayılan kapalı), plan: `content_prereview.plan` (varsayılan `pro`); `ai.enabled`/`ai_settings`/`ai_models` kill switch'leri geçerli. Üretime dağıtılmadı. | `supabase functions deploy content-prereview --no-verify-jwt` |
| `curriculum-source-fetch` | Yönetici (admin JWT) için sunucuda resmî ÖDSGM dizininden ders dosyasını indirir: host/IP doğrulamalı yönlendirme, 15 s / 5 MB, ZIP dizin denetimi, SHA-256 ve URL zinciri ile `record_curriculum_source_fetch` makbuzu. Aynı hash yeni iş açmaz; yeni hash fark incelemesi bekler. Katalog yayımlamaz, okul senaryosu seçmez (bkz. docs/learning/MEB-SCENARIO-PROTOCOL.md) | `supabase functions deploy curriculum-source-fetch` |
| `delete-account` | Doğrulanmış hesabı siler (şifre / e-posta OTP / Apple yeniden doğrulaması). H01: Apple bağlı hesapta silmeden önce kalıcı iptal işi açar, Apple `/auth/revoke` çağırır; Apple erişilemezse iş `pending` kalır ve yanıt `apple_revocation` ile dürüst durum verir (bkz. docs/release/h01-2026-11-06) | `supabase functions deploy delete-account` |
| `apple-token` | H01: Apple ile girişten sonra iOS yetkilendirme kodunu / web-Android sağlayıcı yenileme belirtecini Apple'da doğrulayıp şifreli saklar; değer istemciye dönmez | `supabase functions deploy apple-token` |
| `apple-revocation-worker` | H01: pg_cron (15 dk) ile bekleyen Apple iptal işlerini yeniden dener. `x-cron-secret: APPLE_REVOCATION_SECRET` | `supabase functions deploy apple-revocation-worker --no-verify-jwt` |

| `curriculum-source-extract` | H02: yönetici (admin JWT) panelden tek bir kaynak sürümünün çıkarımını başlatır. Kısa kilit (3 dk) ile eşzamanlı tıklama tek iş yapar; özgün dosya özel kovadan, yoksa aynı host/DNS/boyut politikasıyla resmî adresten okunur; SHA-256 sürümle eşleşmezse gerekçeli `failed`; Python çıkarıcının Deno karşılığı (16 resmî dosyada birebir aynı adaylar) yalnız taslak/inceleme adayı içe alır. Ağ/depolama hatası karar sayılmaz, sürüm kuyrukta kalır. Onay/yayın yapmaz | `supabase functions deploy curriculum-source-extract` |

Gerekli secrets (`supabase secrets set …`; değerleri yalnız Enes girer):

- H01 Apple ile Giriş iptali: `APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` (Sign in with Apple `.p8` içeriği), `APPLE_SERVICES_ID`, `APPLE_BUNDLE_ID` (aşağıdaki), `APPLE_TOKEN_ENCRYPTION_KEY` (32 bayt base64), `APPLE_REVOCATION_SECRET`; Vault: `project_url`, `apple_revocation_secret`

- `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_P8` — App Store Connect → Integrations → In-App Purchase anahtarı
- `APPLE_BUNDLE_ID` = `com.enescevik.gina`
- `GOOGLE_PLAY_SA_KEY` — Play Android Developer API service account JSON'u
- `GOOGLE_RTDN_AUDIENCE` — Pub/Sub push aboneliğinin audience URL'si
- `ANTHROPIC_API_KEY` — haftalık özet (ayrı fonksiyon, Faz 2)

Anahtarlar tanımlı değilken fonksiyonlar olayları günlüğe alır ve `store_not_configured` ile işaretler; hiçbir istek kaybolmaz, kurulumdan sonra `store_notifications` üzerinden yeniden işlenebilir.

Yerelde çalıştırma: `supabase functions serve apple-notifications --no-verify-jwt` + `curl -X POST localhost:54321/functions/v1/apple-notifications -d '{"signedPayload":"<jws>"}'`.
