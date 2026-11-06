# C10 — Bildirim kanallarını uçtan uca tamamla (S01/S02/B04) · 6 Kasım 2026

C10 ajanı (Claude Opus 5.5). Dal `worktree-agent-a98a6db030512f666`, taban main `e23828e`; çalışma sırasında main (`f95b8d5`, C07 dahil) birleştirildi.
**Main'e push edilmedi; üretime dokunulmadı; `db reset` yok; gerçek e-posta/SMS/push gönderilmedi** (X01/X02 BEKLİYOR — bütün kanal
testleri loopback sahte SMTP/HTTP sunucularıyla). Tek migration `20261106300000_channel_ui_support.sql`; pgTAP `116`. i18n'e yalnız yeni
anahtar (107 anahtar, tr+en; silinen/değişen yok).

| Alan | Durum |
|---|---|
| Kod | KOD HAZIR (bu dal) |
| Test | TEST EDİLDİ — pgTAP iki saat dilimi, yarış betiği, Deno, core, mobil tsc/lint, izole servis + Playwright |
| Gerçek kanal kabulü (SMTP TLS, gerçek e-posta/SMS teslimi, APNs/FCM) | **BEKLİYOR — X01/X02** |
| Native push ön plan/arka plan davranışı | **BEKLİYOR — cihaz** (aşağıda) |
| Yönetim ekranı bağlantısı | Bileşen hazır, **sayfaya bağlanmadı** (C07 sahipliği) |
| Yayın | Yayımlanmadı |

## Commit'ler

| Commit | İçerik |
|---|---|
| `5e54e81` | DB: tek kullanımlık + one-click vazgeçme, veli görünümüne limit/deneme/rıza geçmişi, doğrulanmamış adrese opt-in reddi, duyuru×kanal×adres tekilliği, operatör yeniden sıraya alma, kapsamlı (bölge) operatör hedefi; pgTAP 116 |
| `601499c` | Edge: `channel-unsubscribe` (RFC 8058), SMTP güven çapası + STARTTLS düşürmeme, sayfa/one-click bağlantı ayrımı, doğrulama derin bağlantısı; Deno testleri; `config.toml`, CI |
| `4d4ed6a` | Mobil/web + core: adres doğrulama, kanal × amaç tercihleri, rıza kapsamı, `/unsubscribe`, `/verify-contact`; core kuralları + testleri; i18n |
| `f4bb775` | `apps/backoffice/src/components/channel-failures.tsx` — bağlanmamış bileşen |
| `8fdacf2` | main birleştirmesi (C07) |
| (bu rapor) | README, `ui/` (betik çıktısı + 13 ekran × ölçü), `services.json`, `tz-istanbul/`, `tz-utc/`, `race-checks-s02-rerun.json`, `scripts/test-c10-channels-ui.cjs`, `scripts/c10-channel-drain.ts`, izole Edge'e `/channel-unsubscribe` |

## Ne değişti (kart maddesi → sonuç)

| Kart maddesi | Önce (S02) | Sonra |
|---|---|---|
| Mevcut in-app/push korunur | — | Push izin kartı ve 5 push türü anahtarı aynen; `push-send` drain mantığı değişmedi (yalnız `CHANNEL_UNSUBSCRIBE_PAGE_URL` render seçeneği). Kabulde ekranda push anahtarları doğrulandı. |
| E-posta/telefon doğrulama UI (kod/bağlantı, süre, tekrar sınırı) | Yalnız RPC | `components/notifications/contact-verification.tsx`: adres gir → kod iste → kod gir/derin bağlantı → doğrula; değiştir/kaldır (onaylı). Kalan deneme (5), kodun geçerlilik saati, 60 sn istemci bekleme, sunucunun saatlik 3 istek sınırı ve kalan hak ekranda. Kanal hazır değilken form yok, hiçbir şey vaat edilmiyor. |
| Kanal × amaç tercihleri | Yalnız RPC | `channel-preferences.tsx`: amaç başına kart (Hesap ve güvenlik / Duyurular / Kampanya), kanal başına satır. Kilitli satır nedenini söyler: zorunlu, “önce adresini doğrula”, “telefon bildirimi yukarıdan”, “hukuki inceleme”. |
| Rıza kapsamı | — | `consent-scope.tsx`: neye izin verildiği, iletide ne olmadığı, nasıl durdurulacağı, metin sürümü (`channels-2026-11-06`) ve son 10 değişiklik (ekrandan / iletideki bağlantıdan). Sunucu her kullanıcı değişikliğini `policy_version` ile kaydeder. |
| Güvenli doğrulama bağlantısı | Bağlantı `?code=` (UI yok) | E-postada `CHANNEL_CONFIRM_URL?kind=email&code=…`. Web `/verify-contact`: oturumlu veliyi tercihler ekranına yönlendirir, kod yalnız **doldurulur**; “Doğrula”ya dokunmadan hiçbir şey olmaz (tarayıcı/tarayıcı önizleme taraması doğrulayamaz; kod veli hesabına bağlı). Oturumsuzsa giriş yönergesi. Bozuk bağlantı sıkı biçim kontrolüyle reddedilir. |
| İmzalı vazgeçme + RFC 8058 one-click POST | RPC; başlık vardı, uç yoktu | Edge `channel-unsubscribe` (`verify_jwt=false`): POST yalnız `List-Unsubscribe=One-Click` gövdesiyle (urlencoded/multipart, ≤2 KB); GET/HEAD **hiçbir şey değiştirmez** (303 sayfaya ya da POST formu, CSP'li). DB'de HMAC + süre + **tek kullanım** (`gina.unsubscribe_token_uses`): tekrar → `already_done`, ikinci consent/audit satırı yok; eski bağlantı sonradan yapılan opt-in'i ezmez. `List-Unsubscribe` başlığı one-click uca, görünür bağlantı/SMS web `/unsubscribe` sayfasına gider (`CHANNEL_UNSUBSCRIBE_PAGE_URL`). |
| İşlemsel/pazarlama ayrımı; pazarlama kapalı | Gönderimde blok | Ek olarak UI'da pazarlama satırları kilitli; veli görünümü `marketing_allowed=false`. Hukuki onay bayrağı değişmedi. |
| Doğrulanmamış/izinsiz adrese gönderim yok | Claim'de blok | Ek: e-posta/SMS opt-in'i doğrulanmış adres olmadan **sunucuda reddedilir** (`address_unverified`); kapatmak her zaman serbest. Kabulde: doğrulanmamış veli için duyuru yayınında e-posta satırı oluşmadı. |
| Okul/bölge hedefi yalnız yetkili kapsam | Yalnız `release` rolü | `gina.operations_member_scopes` + `parent_announcements` tetikleyicisi: kapsam satırı olan operatör yalnız kapsamındaki yer (veya alt okulları) için taslak kaydeder/yayımlar; “herkes” ve başka bölge `announcement_scope_forbidden`; başkasının global taslağını yayımlayamaz. Kapsamsız operatör ve admin bugünkü gibi. |
| Aynı duyuru-kanal-alıcı tekrarında mükerrer teslim/ücret yok | `dedupe_key` (kullanıcı başına) | Ek: iki veli hesabı aynı adresi doğrulamışsa claim anında ikinci satır `duplicate_recipient` (adres yalnız SHA-256 özetiyle tutulur, danışma kilidiyle yarışsız). Retry/yeniden sıraya alma aynı satır + aynı idempotency anahtarıyla. |
| Yönetim: sağlayıcı hazırlığı, başarısız teslim, yeniden deneme | Hazırlık kartı (mevcut) | RPC `release_channel_failures` (adres/kod/payload yok) ve `release_requeue_channel` (yalnız duyuru; `failed` veya `skipped:provider_unconfigured`; en çok 3; kanal hazır + duyuru güncel olmalı; `accepted` asla; doğrulama kodu asla; audit). Bileşen `channel-failures.tsx` hazır, **sayfaya bağlanmadı**. |
| SMTP TLS/STARTTLS | Yalnız düz metin sahte | `caCerts`/`SMTP_CA_CERT` (doğrulama kapatılamaz); STARTTLS reddi/sıyrılması → düz metne düşmeden `smtp:starttls_454` (retry). Gerçek TLS sahte sunucusu + geçici CA ile test edildi. |
| Token yenilenmesi / push iptal | Mevcut | pgTAP 116: yenilenen token eskisini siler (aynı telefona çift push yok), aynı token idempotent; geri çekmede bekleyen push `no_targets`, bekleyen e-posta `announcement_withdrawn`; push payload yalnız kimlik. |

## Testler (gerçekten çalıştırıldı)

```
pgTAP 116 (tek dosya)                         → 81 ok, 0 not ok
pgTAP 095 / 102 / 081 (tek tek, regresyon)    → 127 / 16 / 41 ok
Tam pgTAP, Europe/Istanbul (main birleşik)    scripts/test-q02-sql.py --run-local --out docs/release/c10-2026-11-06/tz-istanbul
                                              → 113 dosya, 4716 assertion, 0 hata (113_operator_access dahil)
Tam pgTAP, UTC                                → 113 dosya, 4716 assertion, 0 hata
S02 yarış betiği (yeni claim ile)             scripts/test-notification-channels-races.py --run-local
                                              → races 5, passed true (race-checks-s02-rerun.json; S02 rapor dosyaları geri alındı)
Deno, supabase/functions tümü                 → 433 passed, 0 failed
  yeni: channel-unsubscribe/handler.test.ts 6 (one-click, replay, multipart, GET/HEAD yan etkisiz, imza/süre/biçim, 413/405/503)
        _shared/channels/email-tls.test.ts 5 (örtük TLS, STARTTLS sırası, STARTTLS reddi → düşürme yok, güvenilmeyen sertifika, SMTP_CA_CERT)
        push-send/channels.test.ts +1 (one-click başlık ≠ görünür sayfa bağlantısı, derin bağlantı)
  mevcut: email.test.ts 7 + sms.test.ts 3 (sahte SMS HTTP) geçti
deno check channel-unsubscribe, push-send, isolated-source-edge → temiz
pnpm --filter @gina/core test                 → 56 dosya, 397 test (yeni notification-channels-ui.test.ts 6); typecheck temiz
apps/mobile npx tsc --noEmit / npx expo lint  → exit 0 / exit 0
apps/backoffice tsc                           → yalnız önceden var olan globals.css bildirimi; yeni dosyada hata yok
expo export -p web (yer tutucu loopback backend) → başarılı (unsubscribe.html, verify-contact.html)
İzole servis  test-isolated-services.py --run-local --with-storage --ui-hold
                                              → 273/273 servis kontrolü; storage/rest/auth konteynerleri ve DB silindi (services.json)
Playwright  scripts/test-c10-channels-ui.cjs (Chrome, tr-TR, 390×844 ve 1280×800) → {"ok":true,"count":9} (ui/ui-checks.json)
```

### Kabul zinciri (`ui/ui-checks.json`, 9/9)
Sentetik `example.invalid` veli, tek kullanımlık DB. E-posta kanalı yalnız bu DB'de “hazır” yapıldı (sağlayıcı `smtp`, alan adı bayrağı, işçi kalp atışı psql ile); SMS bilerek hazır değil. E-posta, **değiştirilmemiş** `drainChannels` + render + SMTP adapter'ı ile STARTTLS sahte sunucuya (geçici CA) gitti; claim/makbuz gerçek service-role RPC'leri.
1. Tercihler ekranı: push anahtarları yerinde, e-posta formu, “SMS gönderimi henüz açılmadı”, e-posta satırları kilitli (“Önce yukarıdan adresini doğrula”), pazarlama kilitli.
2. **Doğrulanmamış adres engeli**: opt-in RPC `address_unverified`; SMS kodu `channel_not_ready`; yayında e-posta `address_unverified`, outbox'ta 0 satır.
3. UI'dan kod isteği → sahte SMTP: düz metinde yalnız `EHLO`, `STARTTLS`; kod payload'dan kabul sonrası silindi.
4. Yanlış kod → “4 deneme hakkın kaldı”; e-postadaki derin bağlantı → kod dolu, bağlantıyı açmak hiçbir şey doğrulamadı; “Doğrula” → doğrulandı.
5. Duyuru opt-in → rıza günlüğünde `policy_version` ile; ekranda geçmiş satırı.
6. Duyuru e-postası: `List-Unsubscribe` → one-click Edge, `List-Unsubscribe-Post: One-Click`, gövdede web sayfası bağlantısı, kişisel veri yok. GET → form, tercih değişmedi; POST → `unsubscribed`, tekrar → `already_unsubscribed`, bozuk imza → 400; audit 1 kez.
7. 1280×800: geçmişte “iletideki bağlantıdan”, veli yeniden açtı.
8. Web `/unsubscribe`: açmak değiştirmedi; “Durdur” → durduruldu; yeniden → “daha önce kullanıldı”; bozuk token sayfası.
9. Vazgeçme sonrası yeni duyuruda e-posta `preference_off`; adres kaldırıldı; audit'te adres yok.
Her görüntüde yatay taşma yok, çevrilmemiş `channels.` anahtarı yok, `pageerror` yok. Görüntüler kaydırma alanının görünen kısmıdır (tam sayfa değil).

### pgTAP 116 kapsamı (81)
anon EXECUTE listesi değişmedi; one-click yalnız service_role; requeue yalnız operatör; yeni tablolar RLS'li/özel. Veli görünümü: istek hakkı, son istek zamanı, kalan deneme, pazarlama kilidi, rıza geçmişi (yeni→eski), sürüm kaydı. Doğrulanmamış e-posta/SMS opt-in reddi, kapatma serbest; kod küçük harfle de doğrular. Doğrulanmamış adres claim'de atlanır. Ortak adres: tek satır adapter'a, ikincisi `duplicate_recipient`, adres yalnız özet. Retry ve requeue aynı satır; requeue: listede adres yok, tekrar no-op, mükerrer/doğrulama satırı reddi, `accepted` reddi, sınır 3, kanal hazır değilse ret, audit 1. Vazgeçme: tek kullanım, tekrar consent/audit yazmaz, sonraki opt-in'i ezmez, one-click anon'a kapalı, süresi geçmiş/servis amaçlı/bozuk/biçimsiz token reddi, yol kaydı. Kapsamlı operatör: global ve başka bölge reddi, kendi okulu kabul, başkasının global taslağını yayımlayamaz, bölge dışı aile almaz. Push: token yenileme, idempotent kayıt, geri çekmede push+e-posta iptali, push payload'da metin/adres yok.

## Değişen dosyalar
- DB: `supabase/migrations/20261106300000_channel_ui_support.sql` (yeni `gina.unsubscribe_token_uses`, `gina.operations_member_scopes`, `gina.apply_unsubscribe`, `public.channel_one_click_unsubscribe`, `public.release_channel_failures`, `public.release_requeue_channel`, `gina.announcement_scope_*` + tetikleyici; `channel_outbox.recipient_digest/requeue_count`, `notification_consent_log.policy_version`; **imzası aynı yeniden tanımlananlar**: `unsubscribe_with_token`, `my_notification_channels`, `set_notification_preference`, `channel_claim`. C07'nin `admin_*` fonksiyonlarına dokunulmadı), `supabase/tests/116_channel_ui_support.test.sql`.
- Edge: yeni `supabase/functions/channel-unsubscribe/{index,handler,handler.test}.ts`; `_shared/channels/{email.ts,render.ts}`, yeni `_shared/channels/{fake-smtp.ts (yalnız test), email-tls.test.ts}`; `push-send/{index.ts,channels.test.ts}`; `supabase/config.toml` (`[functions.channel-unsubscribe] verify_jwt=false`); `.github/workflows/ci.yml` (deno check + 2 test satırı).
- Core: `packages/core/src/notification-channels.ts`, yeni `notification-channels-ui.test.ts`, `i18n/{tr,en}.json` (+107).
- Mobil/web: `app/parent/notifications.tsx`, yeni `app/unsubscribe.tsx`, `app/verify-contact.tsx`, `components/notifications/{contact-verification,channel-preferences,consent-scope}.tsx`.
- Backoffice (bağlanmamış): `apps/backoffice/src/components/channel-failures.tsx`.
- Test altyapısı (eklemeli): `scripts/isolated-source-edge.ts` (`/channel-unsubscribe`), `scripts/test-isolated-services.mjs` (Edge env izin listesine `CHANNEL_UNSUBSCRIBE_PAGE_URL`), yeni `scripts/c10-channel-drain.ts`, `scripts/test-c10-channels-ui.cjs`.

## Onaylı referans karşılaştırması
Yeni bir tasarım yönü üretilmedi: mevcut `ParentScreen`, `parentStyles.card`, `Toggle`, `Field`, `Button`, `ConfirmAction`, `InfoCard` (mint/mor/krem, Nunito, 48 dp+ hedef) kullanıldı; `/unsubscribe` ve `/verify-contact` öğretmen paylaşım sayfasının (`s/[token]`) navigasyonsuz/noindex desenini izler. Ayrı bir onaylı ekran referansı (docs/design) bu ekranlar için yok; karşılaştırma bu bileşen düzeyindedir.

## Kalan sınır (yapılmadı / doğrulanmadı)
1. **Gerçek kanal kabulü BEKLİYOR (X01/X02):** gerçek SMTP sunucusu/alan adı, gerçek e-posta/SMS teslimi, SMS sağlayıcısı ve İYS yok. TLS/STARTTLS yalnız loopback sahte sunucu + geçici CA ile. `app_settings` kanal anahtarları, `CHANNEL_UNSUBSCRIBE_URL`/`CHANNEL_UNSUBSCRIBE_PAGE_URL`/`CHANNEL_CONFIRM_URL` üretimde ayarlanmadı; `channel-unsubscribe` dağıtılmadı.
2. **Push ön plan/arka plan/dokunma** native davranışı (`lib/push.ts`, sahiplik dışı) cihazda denenmedi; sunucu tarafı (token yenileme, geri çekme iptali, payload) pgTAP ile. Teslim edilmiş bir bildirimin cihazdan geri çekilmesi (sessiz push) yok.
3. **Sunucu tarafı 60 sn yeniden gönderme beklemesi yok**: 095 aynı işlemde art arda istek beklediği için eklenmedi; sunucu sınırı saatte 3 + 5 yanlış deneme; 60 sn yalnız istemcide.
4. **Pazarlama opt-in'i kaydedilebiliyor** (095 sözleşmesi) ama gönderimde ve UI'da kilitli; hukuki inceleme bayrağı değişmedi.
5. **Operatör kapsamını verecek UI yok**: `gina.operations_member_scopes` satırları şimdilik SQL ile; yönetim ekranı ve `channel-failures.tsx` bağlantısı C07/yönetim işine.
6. iOS Universal Link / Android App Link yapılandırılmadı: e-postadaki https derin bağlantısı web'de açılır; native uygulamada `gina://verify-contact` rotası çalışır ama e-postadan otomatik açılması ayrı iş.
7. Vazgeçme tokenının gövdesinde (S02 tasarımı) kullanıcı UUID'si base64 olarak bulunur; sayfa bunu göstermez ama URL'de taşınır. Opak token'a geçiş ayrı bir değişiklik.
8. `scripts/check-hosted-function-boundaries.mjs` listesine `channel-unsubscribe` eklenmedi (sahiplik dışı; tokensız POST zaten 400 döner).
9. Büyük yazı, ekran okuyucu, yatay yön ve tablet bu turda ayrıca test edilmedi; yalnız 390×844 ve 1280×800.

## Temizlik
İzole koşu: storage/rest/auth konteynerleri ve `gina_http_<hex>_audit` DB silindi (`services.json` `cleanup` hepsi `true`); sonradan `pg_database`'te `gina_(http|q02sql)_*` = 0, `docker ps`'te `gina_http` = 0; fixture dosyası silindi; statik sunucu durduruldu. Geçici CA/anahtarlar her koşuda temp dizinde üretilip silindi; Git'te anahtar yok. Başka ajanların konteyner/DB'lerine dokunulmadı. Scratchpad dosyaları `c10_` önekli.
