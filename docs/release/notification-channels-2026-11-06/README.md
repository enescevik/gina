# S02 — E-posta ve SMS duyuru kanalları (sunucu + core)

6 Kasım 2026, gece devri. Dal: `worktree-agent-a1a6dc819aba4cf97` (kaynak main `840477e`). **Main'e push edilmedi, üretime migration/fonksiyon dağıtılmadı, backoffice/mobil UI bağlanmadı. Gerçek sağlayıcı yok — X01 (alan adı/SMTP) ve X02 (SMS/kanal hesabı) BEKLİYOR; bütün adapter testleri sahte sunucuyla koştu, hiçbir gerçek e-posta/SMS gönderilmedi.** Kota nedeniyle gece erken kapatıldı; «yapılmadı» listesi aşağıda eksiksizdir.

## Model — `20261106080000_notification_channels.sql`

- **İletişim adresi ≠ izin.** `gina.contact_channels` (kullanıcı × `email|sms`, doğrulanmış, iptal edilebilir); `gina.contact_verifications` (yalnız token **hash**'i, süre, deneme sayacı). Trigger `contact_owner_guard`: tablet/anonim kullanıcı → `child_contact_forbidden`; aile üyesi olmayan → `parent_account_required`. Çocuk için adres tutulmaz.
- **Tercih matrisi** `gina.notification_preferences` (kanal `in_app|push|email|sms` × amaç `service|announcement|marketing`, `enabled`, `source user|unsubscribe_link`). Satır yoksa: `service` açık (adres hesap amacıyla doğrulandı), `announcement` yalnız in_app/push, `marketing` asla. Push duyuru tercihi mevcut `push_preferences.announcements`'ta kalır (korundu). Her değişiklik `gina.notification_consent_log`'a yazılır; hesap silinince log da silinir (KVKK silme).
- **E-posta/SMS aktif olma kuralı** `gina.channel_block_reason(user,channel,purpose)`: `channel_unsupported → marketing_legal_review_pending → not_a_parent → address_unverified → preference_off → no_active_session`; null = izinli. Hem yayın anında hem **claim anında** yeniden değerlendirilir.
- **Vazgeçme:** `gina.unsubscribe_token` — HMAC-SHA256 (gizli anahtar `gina.channel_settings`, API rollerine kapalı), 30 gün süreli, `user:channel:purpose:exp` gövdeli; `public.unsubscribe_with_token` anon çağrılabilir, yalnız `announcement|marketing` için, tercih kapatılır + consent log + `audit_log` + bekleyen outbox satırları `preference_off`. E-postaya `List-Unsubscribe` ve `List-Unsubscribe-Post: One-Click` başlığı yazılır (gerçek One-Click POST uç noktası alan adı gelince ayrı Edge işi).
- **Outbox** `gina.channel_outbox`: `pending|sending|accepted|failed|skipped`, `skip_reason`, kiralı claim (5 dk), `attempts ≤ 5`, üstel bekleme + sağlayıcı `Retry-After`, `provider_message_id`, `accepted_at`. **`accepted` = sağlayıcı kabul etti; teslim/okundu değildir** (`note` alanı RPC çıktılarında). Doğrulama kodu düz metin **yalnız** outbox payload'ında yaşar; terminal sonuçta (`accepted/failed/skipped`, confirm, iptal) `payload - 'secret'` ile silinir.
- **Hazırlık** `gina.channel_readiness()` → `public.channel_readiness()` (release rolü): `app_settings` (`channels.email.provider|from_address|sender_domain_verified`, `channels.sms.provider|sender_id`, `channels.marketing.legal_review_done`) + worker kalp atışı `gina.channel_provider_status` (`channel_report_provider_status`, env adları yalnız). Eksikler adlarıyla döner: `provider_not_selected`, `from_address_missing`, `sender_domain_unverified`, `sender_id_missing`, `worker_report_missing` (24 saat), `provider_secret_missing`, `unsubscribe_url_missing`. Push için de APNs/FCM eksikleri raporlanır. Kanal hazır değilken `request_contact_verification` → `channel_not_ready`; duyuru yayınında kanal `channel_not_ready` olarak sayılır; hiçbir yerde «hazır/gönderildi» yazılmaz.

### RPC'ler

| RPC | Rol | İş |
|---|---|---|
| `my_notification_channels()` | veli | maskeli adresler, bekleyen doğrulamalar, tercih matrisi, etkin durum (neden), kanal hazırlığı |
| `set_notification_preference(channel,purpose,enabled)` | veli | `push` → `use_push_preferences`; `in_app/service` kapatılamaz; consent log |
| `request_contact_verification(kind,value)` | veli | normalize+doğrula, hazırlık kapısı, saatte 3 istek, önceki istek `verification_superseded`, e-posta 8 karakter kod (60 dk) / SMS 6 hane (15 dk), outbox'a yazar, sırrı döndürmez |
| `confirm_contact_verification(token)` | veli | tek kullanımlık; yanlış kod **hata fırlatmaz** (`{status:'invalid',remaining}`) ki sayaç geri alınmasın; 5 yanlış → iptal |
| `revoke_contact_channel(kind)` | veli | adres iptali + bekleyen satırlar `address_revoked` |
| `unsubscribe_with_token(token)` | anon/veli | tek dokunuş vazgeçme |
| `channel_claim(limit)` | service_role | kiralar, claim anında alıcı/tercih/duyuru güncelliği yeniden kontrol; atlananlar nedenle kapanır; adapter'a alıcı, metin, sağlayıcı adı, vazgeçme tokenı verilir |
| `channel_record_result(id,lease,status,provider,msg_id,error,retry_after)` | service_role | `accepted|retry|failed|unconfigured`; kira dışı → `channel_lease_changed`; `accepted` yapışkan (geç çelişen sonuç yutulur); `delivered` kabul edilmez |
| `channel_report_provider_status(...)` | service_role | kalp atışı |
| `channel_readiness()`, `release_channel_operations()`, `admin_announcement_channels(id)` | release | hazırlık matrisi, 30 günlük sayılar, duyuru başına planlanan/outbox sonuçları |

### Duyuru dağıtımı

`gina.parent_announcements.channels text[]` (isteğe bağlı `email|sms`; `admin_save_announcement` `p_value.channels` kabul eder, UI göndermezse davranış eskisi gibi). `admin_preview_announcement` → `channels.{email,sms}.{ready,missing,eligible,blocked{reason:n}}`. `admin_publish_announcement` push/in-app adımlarını aynen korur; her kanal × alıcı için outbox satırı ya da nedenli sayım (`gina.announcement_channel_summary`), sonuç `channels` anahtarıyla döner, `audit_log`'a kanal özeti yazılır. `admin_withdraw_announcement` bekleyen kanal satırlarını `announcement_withdrawn` yapar. Sağlayıcıya verilmiş e-posta/SMS geri çağrılamaz.

**5.000+ bölümlü kuyruk (yalnız tasarım notu):** F01 §5 ile uyumlu — duyuru `approved` → `announcement_batches` (≤ 2.000 alıcı) → her tick bir bölüm; kanal outbox satırları bölüm içinde `dedupe_key` ile zaten çift yazılamaz; bölüm bazında parmak izi; geri çekme gönderilmemiş bölümleri iptal eder. Uygulanmadı; tetik eşiği 3.000 aktif veli.

## Adapter sözleşmesi (`_shared/channels/`)

`contract.ts`: `OutboundEmail{to,from,subject,text,html?,headers?,idempotencyKey}`, `OutboundSms`, `AdapterResult = {ok:true,providerMessageId,acceptedAt} | {ok:false,retry,error,retryAfterSeconds?}`, `AdapterSetup = {adapter}|{adapter:null,missing:string[]}`. Ortak politika: 408/425/429/5xx → retry (Retry-After 1 s–24 h), diğer 4xx kalıcı, ağ/zaman aşımı → retry; hata metni ≤160 karakter, adres/numara/URL asla hata metnine girmez. `idempotencyKey = gina-channel-<outbox_id>` denemeler arasında sabittir (kayıp yanıt sonrası sağlayıcı tekilleştirir).

- `email.ts`: **Resend** (HTTPS JSON, `Idempotency-Key`, `RESEND_API_KEY`; test için `RESEND_ENDPOINT`) ve **SMTP** (minimal RFC 5321 istemci: EHLO, AUTH PLAIN, MAIL/RCPT/DATA, RFC 2047 konu, base64 gövde, dot-stuffing, `Message-ID`; `tls|starttls|plain`, `plain` yalnız `SMTP_ALLOW_PLAINTEXT=1` ile yerel sahte sunucu için; 4xx retry, 5xx kalıcı). `emailAdapterFromEnv(provider, env)` eksik env **adlarını** döner.
- `sms.ts`: tek genel HTTPS JSON iskelet (`SMS_API_URL`, `SMS_API_KEY`; `{to,from,text,reference}` → `{id|message_id|messageId}`). Türkiye sağlayıcısı ve İYS yükümlülüğü seçilmedi.
- `render.ts`: genel metinler (TR/EN): doğrulama kodu + süre; duyuru = operatör metni + vazgeçme bağlantısı + `List-Unsubscribe` başlıkları. Vazgeçme URL'si (`CHANNEL_UNSUBSCRIBE_URL`) yokken duyuru maili **gönderilmez** (`unconfigured:unsubscribe_url_missing`). Çocuk adı/not/puan hiçbir şablona girmez.
- `push-send/channels.ts` + `index.ts`: mevcut push drain **değişmedi**; aynı tick sonrasında kanal kalp atışı (`channel_report_provider_status` ×3) ve `drainChannels` (≤50 satır / 45 s bütçe). Adapter yok → `unconfigured` (terminal, görünür); render hatası → `unconfigured`; adapter istisnası → retry; kayıp makbuz → worker durur. `gina.kick_push_send` artık kanal kuyruğu için de uyanır (tek zamanlayıcı).

## Hazırlık matrisi (bugün, gerçek değerler)

| Kanal | Durum | Eksik |
|---|---|---|
| in_app | hazır | — |
| push | **hazır değil** | worker raporu yok; APNs/FCM sırları (X02) |
| email | **hazır değil** | `provider_not_selected`, `from_address_missing`, `sender_domain_unverified` (X01), `worker_report_missing`, `RESEND_API_KEY`/SMTP sırları, `CHANNEL_UNSUBSCRIBE_URL` |
| sms | **hazır değil** | `provider_not_selected`, `sender_id_missing`, sağlayıcı/İYS (X02) |
| marketing | **kapalı** | `channels.marketing.legal_review_done=false` (Ticaret Bakanlığı/İYS incelemesi) |

## Testler (gerçekten çalıştırıldı)

- **pgTAP, izole DB** (`scripts/test-notification-channels-races.py --run-local`; `gina_completion_audit` şablonundan geçici klon, 0 aile/0 kullanıcı, `db reset` yok): **88 dosya / 2.675 kontrol**; yeni `095_notification_channels.test.sql` **127 kontrol, 0 başarısız** — [sql-checks.json](sql-checks.json). Kapsam: anon/veli/tablet/service_role yetki; hazırlık kapısı ve eksik adları; doğrulama (normalize, maskeleme, hash saklama, yanlış kod sayacı, başka velinin tokenı, tek kullanım, oran sınırı, 5 yanlış → iptal, iptal edilen satır adapter'a verilmez); çocuk/aile dışı adres reddi; adres ≠ izin, push tercihinin ayrı kalması, marketing kilidi; duyuru önizleme/yayın kanal sayıları, in-app/push değişmezliği; kira, 429 retry-after, eski kira reddi, yapışkan `accepted`, çift gönderim yok, `delivered` reddi; imzalı vazgeçme (anon), bozuk imza, consent/audit; geri çekme/iptal/oturum kapanması claim anında nedenli atlama; `retry_limit` ve `provider_unconfigured` terminal; audit'te adres yok.
  **Not:** `083_school_grade_lifecycle.test.sql` 3 kontrolde başarısız; aynı hata **bu migration olmadan da** (aynı şablon + mevcut main migration'ları) üretildi → önceden var olan/tarihe bağlı sorun, S02 regresyonu değil; gizlenmedi, JSON'da kayıtlı.
- **Yarışlar (gerçek eşzamanlı DB)** — [race-checks.json](race-checks.json): aynı satırın iki worker'ca alınması (tek), aynı makbuz iki kez (tek kabul, yeniden gönderim yok), süresi geçmiş kira (yeni claim kazanır, eski `channel_lease_changed`), 4 eşzamanlı doğrulama isteği (3 kabul/1 `verification_rate_limited`, tek canlı sır), vazgeçme × yayın (sonrasında gönderilebilir satır yok).
- **Deno** (`--allow-net=127.0.0.1`, sahte sunucular): `email.test.ts` 7 + `sms.test.ts` 3 + `push-send/channels.test.ts` 6 = **16 geçti**: Resend kabul/idempotency/başlıklar, 429+Retry-After, 500, 422, timeout, bağlantı reddi; SMTP kabul (başlıklar, base64, dot-stuffing, queue id), 450/550/535, askıda kalma → timeout; drain: çift gönderim yok, retry/failed ayrımı, kayıp makbuzda durma, unconfigured/vazgeçme URL'si yok → gönderim yok, zaman bütçesi, render. Mevcut `push-send` 23 test geçti; `deno check push-send/index.ts` geçti. CI'ya eklendi.
- **Core:** `pnpm --filter @gina/core test` → **42 dosya / 264 test** geçti; typecheck geçti.

## Yapılmadı / sınırlar

- Gerçek sağlayıcı, alan adı, SMTP, SMS hesabı yok (X01/X02). Hiçbir gerçek e-posta/SMS gönderilmedi; fiziksel teslim doğrulanmadı.
- UI bağlanmadı: backoffice `notifications.tsx`/`announcements.tsx` ve mobil tercih/doğrulama ekranları başka ajanların işi; `channels` alanını UI göndermediği sürece duyuru davranışı eskisiyle aynı.
- Yayımlanmadı: migration üretime uygulanmadı, `push-send` dağıtılmadı; env adları (`RESEND_API_KEY`/`SMTP_*`/`SMS_API_*`/`CHANNEL_UNSUBSCRIBE_URL`/`CHANNEL_CONFIRM_URL`) ve `app_settings` kanal anahtarları ayarlanmadı.
- One-Click unsubscribe HTTPS POST uç noktası (Edge) ve e-posta içi doğrulama derin bağlantısı yazılmadı (RPC hazır).
- Operatör «yeniden sıraya al» (push'taki `release_retry_push` benzeri) kanal outbox'ı için yok; `skipped:provider_unconfigured` satırları yapılandırma sonrası yeni duyuru gerektirir.
- 5.000+ bölümlü kuyruk yalnız tasarım notu. İYS/pazarlama hukuk incelemesi yapılmadı; `marketing` kilitli.
- `docs/PUSH.md` ve `docs/learning/PUSH-DELIVERY-ACCEPTANCE.md` güncellemesi yalnız kısa bölüm olarak eklendi; `docs/CLAUDE-REMAINING-WORK.md` S02 kutusu **kapatılmadı** (uçtan uca kabul UI + gerçek sağlayıcıyla).
- Deno SMTP istemcisi gerçek bir SMTP sunucusuyla (TLS/STARTTLS) denenmedi; yalnız düz metin sahte sunucu.

## Commit'ler (dal `worktree-agent-a1a6dc819aba4cf97`)

- `d273341` feat(db): email/SMS notification channels — verified contacts, purpose preferences, unsubscribe tokens, fenced outbox, readiness (S02)
- `3b8477a` feat(edge): email (Resend/SMTP) and SMS adapters, channel drain in push-send, readiness heartbeat (S02)
- `60b9361` feat(core): notification channel types, skip reasons, readiness schema; CI runs channel tests (S02)
- docs commit: bu rapor, test JSON'ları, PUSH dokümanları, remaining-work notu.
