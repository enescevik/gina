# H01 — Apple ile girişte hesap silme ve belirteç iptali (6 Kasım 2026)

Durum ayrımı: **kod + izole test tamam**; **üretim yayını yapılmadı**; **gerçek Apple hesabıyla kabul yapılmadı** (erişim yok). Hukuki metinler (`docs/legal`) bu kartta değiştirilmedi; koordinatör günceller.

## 1. Apple girişi üretimde açık mı? — Evet (kanıt, üretim sorgulanmadı)

| Kanıt | Kaynak |
| --- | --- |
| iOS yeteneği istenmiş: `ios.usesAppleSignIn: true`, eklenti `expo-apple-authentication` | `apps/mobile/app.json:31`, `:83` |
| Supabase Apple sağlayıcısı **etkin**; Client IDs `com.enescevik.gina.web,com.enescevik.gina`; Services ID ve yalnız Sign in with Apple yetkili anahtar oluşturulmuş; sunucu gizlisi 1 Mayıs 2027'de sona eriyor | `docs/release/FAMILY-EXPERIENCE-13.md:22` |
| Salt okunur `supabase config diff` (üretim): "Google ve Apple sağlayıcısı açık" | `docs/release/c06-2026-11-06/README.md:29` |
| Arayüz düğmeyi canlı ayardan gösteriyor: `/auth/v1/settings` → `external.apple === true` ise "Apple ile devam et" görünür | `apps/mobile/src/lib/social-auth.ts` `availableSocialProviders`, `src/components/social-sign-in.tsx` |
| Yerel `config.toml` `[auth.external.apple] enabled = false` | yalnız yerel geliştirme; üretimi göstermez |

Sonuç: Apple ile giriş canlıda açık, "ileride açılacak" varsayımıyla ertelenemez. Bu dal yayımlanana kadar üretimdeki `delete-account` Apple iptali yapmıyor (App Store 5.1.1(v) açığı sürüyor).

## 2. Ne yapıldı

**Edinme (giriş anında, best-effort, girişi asla engellemez)**
- iOS yerel: `expo-apple-authentication` `credential.authorizationCode` → yeni `apple-token` fonksiyonu → Apple `/auth/token` (client_id = `APPLE_BUNDLE_ID`, ES256 client secret) → `id_token.sub` hesabın Apple kimliğiyle aynı mı kontrol → refresh token (yoksa access token) AES-256-GCM ile şifrelenip `gina.apple_auth_tokens`'a.
- Web/Android (Supabase OAuth): oturumdaki `provider_refresh_token` (Services ID'ye verilmiş) → `apple-token` → Apple `grant_type=refresh_token` ile doğrulama + `sub` eşleşmesi → şifreli saklama. Native Android `completeOAuthCode`, web `auth-callback` üzerinden.
- Şifreleme anahtarı veritabanında değil Edge sırrında (`APPLE_TOKEN_ENCRYPTION_KEY`); `apple_sub` doğrulanmış ek veri (satır başka hesaba taşınamaz). Vault bu repoda yalnız birkaç dağıtım değeri için kullanılıyor ve izole test şablonunda yok; "DB hiçbir zaman düz metin tutmaz" özelliği aynı, test edilebilir.

**Silme (`delete-account`)**
- Apple bağlı hesap için yeni yeniden doğrulamalar: `reauthentication: "apple"` (iOS: taze yerel Apple girişi; kimlik belirteci sunucuda Supabase Auth `signInWithIdToken` ile imza/aud/nonce doğrulanır, aynı kullanıcı olmalı; taze yetkilendirme kodu hemen belirtece çevrilir) ve `"apple_oauth"` (web/Android: JWT `amr` içinde ≤ 5 dk `oauth`). Şifre/OTP yolları değişmedi.
- Sıra: kimlik doğrulama → (varsa) etki önizlemesi → **kalıcı iş kaydı** (`apple_revocation_begin`, istemcinin `request_id`'si ile idempotent) → Apple `/auth/revoke` (8 sn zaman aşımı) → sonuç kaydı → `auth.admin.deleteUser` (mevcut tetikleyici: ortak aile sahipliği aktarımı / son velide aile silme — değişmedi) → `account_deleted_at`.
- Yanıt Apple bağlı hesapta `{"ok":true,"apple_revocation":"succeeded"|"pending"|"manual_required"}`; diğer hesaplarda eskisi gibi `{"ok":true}`.

**Engelleme kuralı (yanlış başarı yok, sonsuza dek engel yok)**

| Durum | Sonuç |
| --- | --- |
| İş kaydı yazılamadı | 500, **silme yok**, Apple çağrısı yok |
| Apple iptali 200 | `succeeded`, belirteç silinir |
| Zaman aşımı / ağ / 5xx / 429 / `invalid_client` / sırlar eksik | iş `pending` (5 dk·2ⁿ, en çok 24 saat, 12 deneme) → **silme devam eder**, kullanıcıya "sürüyor" denir; worker 15 dk'da bir dener; 12. denemede `failed(max_attempts)` |
| `invalid_grant` (süresi geçmiş/iptal edilmiş belirteç) | `failed(token_invalid)`, silme devam, kullanıcıya appleid.apple.com yolu (manual_required) |
| Belirteç yok + taze Apple doğrulaması yok (güncel istemci) | 409 `apple_reauthentication_required`, **silme yok** → arayüz Apple ile doğrulama ister |
| Belirteç yok + taze Apple doğrulaması var (eski kullanıcı) | `token_unavailable`, silme devam, manual_required — "iptal edildi" denmez |
| iOS kod değişimi sırasında Apple erişilemez ve saklı belirteç yok | 503 `apple_unavailable`, **silme yok** (kod tek kullanımlık; tekrar denenince yeni kod alınır) |
| H01 öncesi istemci (`request_id` yok), belirteç yok | silinir, `token_unavailable` (eski istemcide silme kilitlenmesin) |
| Aynı `request_id` tekrarı (ör. iptal başarılı, auth silme başarısız) | aynı iş, ikinci iptal yok; başka hesap aynı id'yi kullanamaz |
| Sonuç kaydı yazılamadı | yanıt `pending` (DB'de iş pending; worker tekrar dener — Apple iptali idempotent) |

Bilinçli ödünleşim: Apple iptali silmeden önce yapılır; auth silme başarısız olursa hesap kalır ama Apple bağı iptal edilmiş olur (tekrar Apple ile girişte yeniden verilir). Tersi (önce silme) iptal kaybı riski taşırdı.

**Arayüz** (`account-deletion.tsx`): Apple bağlı hesapta OTP/şifre yerine "Apple ile doğrula" (onaylı `Button`/metin stilleri; yeni ekran yok). iOS yerel sayfa; Android oturum tarayıcısı; web yönlendirme → aynı sayfaya dönüş (`sessionStorage`, yalnız aynı köken yolu) ve 4 dk içinde tamamlama. Silme sonrası `pending`/`manual_required` ise bilgi kartı kalır. Yeni i18n anahtarları (tr+en): `accountV5.appleReauth*`, `appleUnavailable`, `appleRevocationPending`, `appleRevocationManual`.

**Gizlilik/sır**: belirteç, kod, kimlik belirteci, nonce, özel anahtar hiçbir yanıtta veya logda yok (Deno testi konsolu ve yanıtları tarar). Hatalar sabit kodlara indirgenir. Sınır: supabase-js web oturumunu yerel depoda tutar ve `provider_refresh_token` bu oturumun parçasıdır (Supabase davranışı; biz ayrıca saklamıyoruz).

## 3. Dosyalar

- Migration `supabase/migrations/20261106460000_apple_token_revocation.sql`: `gina.apple_auth_tokens`, `gina.apple_revocation_jobs` (RLS açık, anon/authenticated/service_role tablo yetkisi yok), service_role-yalnız RPC'ler `apple_token_store`, `apple_revocation_begin`, `apple_revocation_record`, `apple_revocation_claim`, `apple_revocation_mark_deleted`; `gina.purge_apple_revocation_jobs()` (12 ay); pg_cron `apple-revocation-worker` (*/15) ve purge (03:45). Terminal işte belirteç ve Apple öznesi silinir.
- Edge: `_shared/apple-signin.ts`, `_shared/apple-revocation.ts`, `delete-account/handler.ts`, `apple-token/`, `apple-revocation-worker/`; `config.toml` (`apple-token` verify_jwt=true, worker false).
- Mobil: `src/lib/social-auth.ts`, `src/components/account-deletion.tsx`, `src/app/auth-callback.tsx`. Çekirdek: i18n, `database.types.ts` (yeniden üretildi).

## 4. Test kanıtı (izole, yerel)

- pgTAP 131: **64/64** (`sql-checks-131.json`) — tablo/RLS/yetki, servis-dışı JWT reddi, düz metin reddi, idempotent begin, request çakışması, token_required/token_unavailable, geri çekilme, kiralama, başarı sonrası belirteç silme, terminal değişmezlik, invalid_grant, 12 deneme, kullanıcı silinince saklı belirteç gider iş kalır, purge.
- Tüm pgTAP: **130 dosya, 5981 onay, 0 hata** (`sql-checks-full.json`; 102 anon-çalıştırılamaz ve 113 dahil).
- Deno H01: **46/46** (`deno-h01.txt`): ES256 client secret imzası doğrulanır, şifreleme/AAD, kod değişimi/refresh doğrulama/iptal hata eşlemesi; silmede yerel başarı, saklı belirteç + timeout → pending, eksik belirteç 409, eski kullanıcı token_unavailable, invalid_grant, süresi geçmiş kod → saklı belirtece düşüş, kod değişiminde kesinti 503, tekrar istek tek iptal, kayıt hatası, iş yazılamadı, başka hesabın kimlik belirteci, oauth tazeliği, sır sızıntısı taraması, şifreli hesap regresyonu; `apple-token` ve worker testleri.
- Tüm Edge testleri `-A`: **509/509** (izinsiz koşuda yalnız ilgisiz `email-tls` openssl izni ister).
- Çok velili aile / son veli silme: tetikleyici değişmedi; `015_account_lifecycle` (sahiplik aktarımı, son veli ailesinin silinmesi) tam koşuda geçti. Edge tarafında Apple yolu `deleteUser`'ı aynı şekilde çağırır.
- Mobil `tsc --noEmit` ve `expo lint` temiz; core vitest 457/457, core tsc temiz; backoffice `typecheck` temiz.

## 5. Üretim adımları (Enes; değerler sohbete/repoya yazılmaz)

1. **Apple Developer**: mevcut Sign in with Apple anahtarının birincil App ID'si `com.enescevik.gina` olmalı ve Services ID `com.enescevik.gina.web` aynı birincil App ID altında gruplu olmalı (tek anahtar iki client_id için client secret imzalar). Yeni dönüş adresi gerekmez (sunucu `redirect_uri` kullanmaz). Team ID ve Key ID'yi not edin.
2. **Edge sırları** (`supabase secrets set --project-ref <prod>`): `APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` (`.p8` dosyasının tam PEM içeriği), `APPLE_SERVICES_ID` (= web Services ID), `APPLE_BUNDLE_ID` (zaten tanımlı olmalı; = iOS bundle id), `APPLE_TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`; kaybolursa saklı belirteçler çözülemez → yeni girişte yenilenir), `APPLE_REVOCATION_SECRET` (rastgele).
3. **Vault**: `apple_revocation_secret` (= `APPLE_REVOCATION_SECRET`); `project_url` yoksa ekleyin (source-cleanup ile ortak).
4. **Sıra**: migration `20261106460000` → `supabase functions deploy delete-account apple-token` ve `supabase functions deploy apple-revocation-worker --no-verify-jwt` → web yayını → yeni imzalı iOS derlemesi (yerel kod saklama ve Apple yeniden doğrulama arayüzü yalnız yeni derlemede). Eski istemciler silmeye devam eder (`request_id` yok → engel yok, `token_unavailable`).
5. **Gerçek kabul (cihaz + gerçek Apple hesabı)**: iPhone'da Apple ile giriş → `gina.apple_auth_tokens`'ta satır (yalnız ciphertext) → Ayarlar > Hesabı sil → Apple ile doğrula → sil → yanıt `succeeded`, `apple_revocation_jobs.status = succeeded` → iPhone Ayarlar > [ad] > Apple ile Giriş listesinde GINA'nın kalkması (sağlayıcı iptal kanıtı). Web'de Apple ile giriş sonrası `provider_refresh_token` geldiğini ve `apple-token` 200 döndüğünü doğrulayın (Supabase'in bu belirteci döndürmesi gerçek hesapta teyit edilmeli; dönmezse web kullanıcıları `manual_required` alır). Worker: Vault/secret sonrası pg_cron `apple-revocation-worker` çalışmalarını `cron.job_run_details`'ten izleyin.
6. Sunucu gizlisi (Supabase sağlayıcısı için) 1 Mayıs 2027'de sona eriyor; bu kartın Edge kodu client secret'ı her çağrıda kendisi üretir, ondan etkilenmez.

## 6. Açık / sınırlar

- Gerçek Apple uç noktalarıyla uçtan uca kabul yapılmadı (yalnız sahte Apple uç noktası). Açık kalır.
- Apple sunucudan-sunucuya bildirimleri (kullanıcının Apple tarafında GINA'yı kaldırması) kapsam dışı.
- `docs/legal` metinlerindeki "iptal henüz yapılmaz" notları yayın + kabul sonrası koordinatörce güncellenmeli.
- Web yeniden doğrulaması sayfadan ayrılıp döner; 4 dk içinde tamamlanmazsa yeniden istenir.
