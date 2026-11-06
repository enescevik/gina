# H04 — Hesap ve ürün e-postası kabulü · 6 Kasım 2026

H04 ajanı (Claude Opus 5.5), dal `worktree-agent-a000c63174031efc9`, taban main `12115bc`. **Main'e push yok, üretime dokunulmadı,
hiçbir e-posta gönderilmedi, hiçbir gelen kutusu okunmadı, sır değeri görülmedi/yazılmadı.** Tek migration `20261106490000`,
pgTAP `134`. Yeni i18n anahtarı yok (mevcut metinler yeterli).

| Alan | Durum |
|---|---|
| Kod (bu dal) | KOD HAZIR — aşağıdaki 6 düzeltme |
| Test | TEST EDİLDİ — core vitest, Deno (tümü), pgTAP iki saat dilimi, izole servis, şablon denetimi, mobil tsc/lint |
| Yayın | YAYIMLANMADI — migration `20261106490000` + `push-send` Edge + web/mobil istemci yayını gerekiyor |
| Gerçek teslimat kabulü (EN reset, yeni hesap, ürün e-postası, vazgeçme) | **BEKLİYOR — Enes**, aşağıdaki [kabul yönergesi](#kabul-yönergesi-enes--koordinatör) |

## 1. Hesap e-postaları (Supabase Auth, Brevo Auth SMTP)

**Doğrulanan (kod/şablon düzeyinde, `scripts/check-auth-email-templates.mjs`, 8 render × 13 kontrol, hepsi geçti):**
- `confirm.html` / `reset.html` tek `{{ if eq .Data.locale "en" }} … {{ else }} … {{ end }}` bloğu; `.Data` = `user_metadata`.
  `locale` `"en"` → İngilizce; `"tr"`, yok, bilinmeyen (`"de"`) → Türkçe. Konu (`subjects.json`) aynı kuralla.
- Her dalda tam bir `href="{{ .ConfirmationURL }}"`, başka şablon değişkeni yok, `<html lang>` doğru, yalnız https,
  görseller `ginafamily.com/email/v1/` ve dosyaları `deploy/web/email/v1/` altında var, EN dalında Türkçe karakter yok,
  destek adresi/mailto vaadi yok.
- Uygulama tarafı: kayıt `signUp(... data: { locale: resolveLocale(...) })` yazıyor; oturumlu, anonim olmayan oturum dil
  değişince `updateUser({ data: { locale } })` ile eşitliyor (kurtarma sırasında değil). Kayıt dönüşü `/auth-callback`,
  reset dönüşü `/reset-password`.
- **Sonuç:** İngilizce reset yalnız hesabın kayıtlı `locale`'i `en` ise İngilizce gelir; tarayıcı/uygulama dili o an EN olsa da
  hesap metadata'sı eski/yoksa Türkçe gelir. Kabulde test hesabı EN ile açılmalı (aşağıda).

**Bağlantının açıldığı ekran (kullanılmış/süresi geçmiş):** davranış zaten vardı (U01); bu turda saf mantık
`packages/core/src/auth-links.ts`'e taşındı, testlendi ve üç boşluk kapatıldı:
1. Supabase'in `error_code` olmadan döndüğü durumda (`error=access_denied&error_description=Email link is invalid or has expired`,
   eski sunucu ya da Site URL'ye düşen yönlendirme) ekran **"giriş iptal edildi"** diyordu → artık "süresi dolmuş ya da kullanılmış;
   aşağıdan yeni bağlantı iste" (`u01.linkExpired`) + yerinde yeniden gönderme formu.
2. Yönlendirme parametreleri üç ekranda (`index`, `auth-callback`, `reset-password`) ayrı ayrı elle okunuyordu; tek, sınırlı,
   testli okuyucu (`readAuthRedirectError`: sorgu > fragman, yalnız `[a-z][a-z0-9_]` biçimli değerler, açıklama 200 karakter,
   gösterilmez yalnız sınıflandırılır). Kök adrese düşen hata açıklamasıyla birlikte girişe taşınır.
3. Native reset: kod değişimi **çevrimdışı** başarısız olunca "bağlantı geçersiz, yenisini iste" deniyordu (bağlantı aslında
   geçerli) → artık ağ hatası + "Tekrar dene" (aynı bağlantı); kullanılmış/süresi geçmiş/başka uygulamada başlatılmış → yeni
   bağlantı formu. Şifre kaydetme hatası (ör. ağ) formu gizlemez.

Değişmeyen: `otp_expired` (Supabase kullanılmış ve süresi geçmiş bağlantıyı aynı kodla bildirir) → "süresi dolmuş ya da daha önce
kullanılmış"; PKCE doğrulayıcısı yok (başka tarayıcı) → `u01.otherDevice` (kayıt) / `accountV5.resetExpired` (reset).

## 2. Ürün bildirimi e-posta kanalı (Auth SMTP'den ayrı)

Ayrım: Auth e-postalarını Supabase Auth kendi SMTP ayarıyla (Dashboard → Authentication → SMTP) gönderir. Ürün kanalı
`push-send` Edge işçisinin `_shared/channels/email.ts` adaptörüyle ve **Edge sırları**yla gönderir; Auth ayarına hiç dokunmaz.

| Konu | Durum (kanıt) |
|---|---|
| Yapılandırma | Sağlayıcı/gönderen DB'de (`app_settings`), anahtarlar yalnız Edge env adıyla; eksikler ad olarak raporlanır (Deno factory testi) |
| İzin | Adres yalnız doğrulanmışsa; duyuru e-postası açık opt-in (varsayılan kapalı); pazarlama hukuk bayrağına kilitli (pgTAP 095/116) |
| Kuyruk | `gina.channel_outbox`, kira (lease) + 5 dk; yeniden deneme 60 s·2ⁿ⁻¹ (≤ 15 dk), 5 denemede `retry_limit` (095) |
| Çift gönderim | `dedupe_key` tekil; aynı duyuru×kanal×adres ikinci satır `duplicate_recipient`; makbuz tekrarı idempotent; yeni: aşağıdaki 1 ve 2 |
| Geçici / kalıcı | SMTP 4xx → retry, 5xx → failed, AUTH 535 → failed; Resend 408/425/429/5xx → retry (Retry-After), diğer 4xx → failed; zaman aşımı/ağ → retry (Deno) |
| Vazgeçme | `List-Unsubscribe` (RFC 8058 one-click POST → Edge `channel-unsubscribe`) + gövdede web `/unsubscribe` bağlantısı; GET yan etkisiz; tek kullanımlık, 30 gün geçerli imzalı token (Deno + 116) |

**Bu turda kapatılan boşluklar (testli):**
1. **SMTP'de yanıt kaybı → ikinci kopya.** Mesaj sonlandırıcısı (`.`) gönderildikten sonra bağlantı koparsa/zaman aşarsa eskiden
   `retry` dönüyordu; relay mesajı kuyruğa almış olabileceği ve SMTP'de idempotency anahtarı olmadığı için tekrar ikinci kopya
   demekti. Artık `smtp:end_of_data_unknown`, kalıcı (en fazla bir kopya). Sunucu açıkça 4xx dönerse retry sürer.
2. **Kabul sonrası geçici makbuz hatası → ikinci kopya.** Sağlayıcı kabul ettikten sonra `channel_record_result` RPC'si geçici
   başarısız olursa satır kirada kalıyor, 5 dk sonra yeniden alınıp tekrar gönderiliyordu. Makbuz DB'de idempotent olduğu için
   işçi artık makbuzu 3 kez (250/500 ms arayla) dener; yine olmazsa eskisi gibi durur.
3. **Gönderen adı.** `channels.email.from_address` = `GINA <bildirim@…>` biçimi eskiden `MAIL FROM:<GINA <…>>` üretip reddedilirdi.
   Artık zarf adresi ayrıştırılır, başlıkta ad korunur (ASCII dışı ad RFC 2047); CR/LF ya da açılı ayraç içeren gönderen/alıcı
   bağlantı açılmadan `smtp:invalid_address` (kalıcı). `Message-ID` alan adı artık gönderenin alan adı (`gina.local` değil).
4. **Dil.** Ürün e-postası dili yalnız en yeni push token'ın `locale`'inden geliyordu: push izni olmayan/web veli hep Türkçe alırdı.
   Migration `20261106490000`: önce `user_metadata.locale` (Auth şablonlarıyla aynı kaynak), sonra desteklenen dilde en yeni push
   token, sonra `tr`. `channel_claim` imzası/yetkileri ve geri kalanı birebir aynı.
5. **Hazırlık nabzı.** Kanal hazırlığı 24 saatten genç bir işçi raporu ister, ama işçi yalnız iş varken uyanıyordu: sessiz bir günden
   sonra e-posta kanalı "hazır değil" olur, doğrulama formu kaybolur, yeni duyuruların e-postası `channel_not_ready` atlanırdı.
   Aynı migration: sağlayıcı seçiliyse ve rapor 12 saatten eskiyse dakikalık tetik işçiyi bir kez uyandırır
   (`gina.channel_heartbeat_due()`, özel). Sağlayıcı seçili değilse ek çağrı yok.

**Bilinen kalan risk:** İşçi, sağlayıcı kabulünden sonra makbuzu 3 denemede de yazamazsa (DB kesintisi) satır 5 dk sonra yeniden
alınır; SMTP'de bu ikinci kopya demektir (Resend'de idempotency anahtarı bunu önler). Kalıcı çözüm iki aşamalı "gönderiliyor"
işareti ister; bu turda yapılmadı.

## Testler (gerçekten çalıştırıldı)

```
node scripts/check-auth-email-templates.mjs (CI'ya eklendi) → ok, 8 render (confirm/reset × en/tr/""/de), 0 hata
pnpm --filter core: vitest run                         → 65 dosya, 470 test geçti (yeni auth-links.test.ts 13)
                    tsc --noEmit                        → temiz
deno test (supabase/functions tümü, --allow-net=127.0.0.1 --allow-run=openssl --allow-read --allow-write --allow-env)
                                                       → 485 passed, 0 failed
  yeni: email.test.ts +2 (yanıt kaybı → kalıcı, 4xx DATA → retry; görünen adlı gönderen, başlık enjeksiyonu reddi)
        push-send/channels.test.ts +1 (kabul sonrası geçici makbuz hatası → tek sağlayıcı çağrısı)
  değişen beklenti: Message-ID alan adı gina.local → gönderen alan adı
deno check push-send, channel-unsubscribe, isolated-source-edge, c10-channel-drain → temiz
pgTAP 134 tek başına                                   → 26 ok (dil önceliği 5 durum, yetkiler, yönergedeki tek alıcılı
                                                         SQL: push yok, ikinci kopya 23505, tek satır/adres/token/dil, okunmuş öğe atlanır;
                                                         nabız 4 durum, özel yetkiler)
pgTAP tam, Europe/Istanbul                             → 130 dosya, 5943 assertion, 0 hata (son koşu; bir önceki koşuda
                                                         116/1 "anon yalnız …" bir kez düştü, 116 tek başına 2× ve tam koşu
                                                         yeniden temiz — tekrarlanamadı, aşağıda not)
pgTAP tam, UTC                                         → 130 dosya, 5943 assertion, 0 hata
İzole servis (test-isolated-services.py --run-local)   → 183/183 kontrol true; rest/auth/DB temizliği true
apps/mobile npx tsc --noEmit / npx expo lint           → exit 0 / exit 0
```

## Değişen dosyalar
- Core: yeni `packages/core/src/auth-links.ts`, `auth-links.test.ts`; `index.ts` dışa aktarım.
- Mobil/web: `src/components/social-sign-in.tsx` (mantık core'dan), `src/app/index.tsx`, `src/app/auth-callback.tsx`,
  `src/app/reset-password.tsx`, `src/app/(auth)/sign-in.tsx` (`error_description` parametresi).
- Edge: `_shared/channels/email.ts` (+test), `push-send/channels.ts` (+test).
- DB: `supabase/migrations/20261106490000_channel_claim_account_locale.sql`, `supabase/tests/134_channel_claim_account_locale.test.sql`.
- Betik: `scripts/check-auth-email-templates.mjs` (yerel denetim), `scripts/h04-auth-email-trigger.sh` (üretim tetikleyici, **çalıştırılmadı**).
- CI: `.github/workflows/ci.yml` şablon denetimi satırı (mevcut Deno satırları yeni testleri zaten kapsıyor).

---

## Kabul yönergesi (Enes / koordinatör)

Kurallar: yalnız Enes'in kendi adresleri (Gmail + mümkünse farklı sağlayıcıda bir adres: Outlook/iCloud/Yandex); gerçek velilere
hiçbir şey gitmez; sır değerleri sohbete/depoya yazılmaz; her adım için UTC saatini not et.

### 0. Ön koşullar
- **Yayın sırası (önerilen):** migration `20261106490000` → `push-send` Edge dağıtımı → web (ve sonraki mobil) istemci. Bu dal yayımlanmadan
  da (c)–(e) üretimdeki C10 koduyla denenebilir, ama o zaman: `from_address` **yalın adres** olmalı (`bildirim@ginafamily.com`;
  `GINA <…>` biçimi eski kodda reddedilir), ürün e-postası dili push token'dan gelir, SMTP yanıt kaybı düzeltmesi yoktur.
- Supabase → Authentication → URL Configuration → Redirect URLs listesinde `https://ginafamily.com/auth-callback` ve
  `https://ginafamily.com/reset-password` birebir olmalı (değilse bağlantı Site URL'ye düşer). Listeyi kontrol et, joker ekleme.
- Supabase → Authentication → Providers → Email: "Confirm email" açık olmalı; kapalıysa (b) için doğrulama e-postası gitmez
  (betik bunu `session_returned: True` olarak gösterir).
- Rate limit: Authentication → Rate Limits → e-posta/saat; testler arasında acele etme.

### Ürün kanalı için üretim sırları (yalnız ADLAR; değerleri Enes `supabase secrets set --project-ref wixjxlxgyhgdacadsawo …` ile girer)

| Edge secret | Zorunlu | Değerin niteliği |
|---|---|---|
| `SMTP_HOST` | evet | Ürün kanalı SMTP relay sunucusu (Brevo kullanılırsa Brevo SMTP relay) |
| `SMTP_PORT` | 587 için evet | `587` (STARTTLS) ya da `465` (örtük TLS) |
| `SMTP_SECURITY` | 587 için evet | `starttls` (587) / `tls` (465, varsayılan). `plain` üretimde kullanılmaz |
| `SMTP_USERNAME` | evet | SMTP giriş adı |
| `SMTP_PASSWORD` | evet | **Auth SMTP'den ve Gmail SMTP'den ayrı, yeni** bir SMTP anahtarı (ör. Brevo'da "GINA product channel") — ayrı iptal edilebilsin |
| `CHANNEL_UNSUBSCRIBE_URL` | evet | `https://wixjxlxgyhgdacadsawo.supabase.co/functions/v1/channel-unsubscribe` (yoksa duyuru e-postası gönderilmez: `unsubscribe_url_missing`) |
| `CHANNEL_UNSUBSCRIBE_PAGE_URL` | önerilir | `https://ginafamily.com/unsubscribe` (gövdedeki görünür bağlantı; `channel-unsubscribe` de GET'te buraya yönlendirir) |
| `CHANNEL_CONFIRM_URL` | önerilir | `https://ginafamily.com/verify-contact` (doğrulama e-postasındaki kodu dolduran bağlantı) |
| `SMTP_CA_CERT`, `SMTP_ALLOW_PLAINTEXT`, `RESEND_*` | hayır | Ayarlama. (`RESEND_API_KEY` yalnız sağlayıcı `resend` seçilirse) |

Zaten olması gerekenler (değiştirme): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Edge varsayılanı), `PUSH_SEND_SECRET`, Vault
`push_send_url` / `push_send_secret` (dakikalık tetik). Sır değiştirmek Edge'i yeniden dağıtmayı gerektirmez.

DB ayarları (sır değil; koordinatör, Enes onayıyla, SQL editöründe — **bu adım kanalı canlıya alır**: tüm velilerin bildirim
ayarlarında e-posta doğrulama formu görünür hale gelir; duyuru e-postası yine yalnız doğrulayıp açıkça açanlara gider):
```sql
update public.app_settings set value='"smtp"' where key='channels.email.provider';
update public.app_settings set value='"bildirim@ginafamily.com"' where key='channels.email.from_address';  -- Brevo'da doğrulanmış gönderen/alan adı
update public.app_settings set value='true' where key='channels.email.sender_domain_verified';            -- yalnız SPF/DKIM doğrulanmışsa
```
Geri alma: `channels.email.provider` → `'null'` (bekleyen satırlar `provider_unconfigured` olur, gönderim durur).

İşçiyi bir kez uyandır ve hazırlığı oku (değer yazdırmaz):
```bash
curl -sS -X POST "https://wixjxlxgyhgdacadsawo.supabase.co/functions/v1/push-send" -H "authorization: Bearer $PUSH_SEND_SECRET" -H 'content-type: application/json' -d '{}'
```
```sql
select gina.channel_readiness()->'email';   -- beklenen: "ready": true, "missing": []
```
`missing` adları neyin eksik olduğunu söyler (`SMTP_PASSWORD`, `unsubscribe_url_missing`, `sender_domain_unverified` …).

### (a) İngilizce şifre sıfırlama
1. EN test hesabı: (b)'deki hesap ya da mevcut bir hesap; hesabın dili EN olmalı → uygulamada o hesapla giriş yap, dili English yap
   (oturum `user_metadata.locale=en` yazar). Kontrol (salt okunur): `select raw_user_meta_data->>'locale' from auth.users where email='<adres>';`
2. Çıkış yap → web `https://ginafamily.com` → Giriş → "Şifremi unuttum" → adres → gönder. (Tıklama akışını gerçekçi sınamak için
   uygulama ekranını kullan; betik bağlantısı web'de yeni şifre formunu açmaz, bkz. betik notu.)
   Yalnız teslimat/içerik için alternatif: `scripts/h04-auth-email-trigger.sh reset <adres>`.
3. Aynı tarayıcıda e-postadaki "Reset my password" → yeni şifre → kaydet → yeni şifreyle giriş.

**Kanıt:** konu `Reset your GINA password`, gövde İngilizce, From `noreply@ginafamily.com`, Gmail "Orijinali göster"de SPF/DKIM/DMARC
PASS, bağlantı alan adı (`wixjxlxgyhgdacadsawo.supabase.co/auth/v1/verify…` → `ginafamily.com/reset-password`), "şifren değişti"
ekranı, yeni şifreyle giriş. Ekran görüntüsünde bağlantı/token görünmesin.

### (b) Yeni hesap doğrulaması
- Uygulamadan (tercih): uygulama dili English → Kayıt ol → yeni artı-adres (`<sen>+gina-en1@…`) → e-posta → "Confirm my email" aynı
  tarayıcıda → `/auth-callback` → aile kurulum ekranı.
- Betikle: `GINA_SUPABASE_URL=… GINA_SUPABASE_ANON_KEY=… scripts/h04-auth-email-trigger.sh signup <sen>+gina-en2@… --locale en`
  (onay için `SEND` yazdırır, şifreyi gizli sorar, yalnız HTTP durumu ve güvenli alanları yazar). Bağlantıya tıklamak adresi sunucuda
  doğrular; ardından uygulamada bu adres+şifreyle giriş yap (betik bağlantısı PKCE'siz olduğu için tarayıcıda otomatik oturum açmaz).
- Aynısını `--locale tr` ile bir kez: konu `GINA hesabını doğrula`.

**Kanıt:** EN konu `Confirm your GINA account` / TR `GINA hesabını doğrula`, From, SPF/DKIM/DMARC, tıklama sonrası ekran;
`select email_confirmed_at is not null from auth.users where email='<adres>';` → true.

### (c) Tek ürün bildirimi (izinli test adresi)
1. Enes kendi veli hesabıyla: Ayarlar → Bildirimler → E-posta adresi → kendi adresini **kendisi** yazar → "Kod gönder".
   Bu, ürün kanalının ilk e-postasıdır (amaç `service`, konu `GINA verification code` / `GINA doğrulama kodu`).
2. Kodu gir → doğrulandı. Duyurular → E-posta satırını aç (açık rıza; rıza geçmişinde sürüm `channels-2026-11-06`).
3. Tek alıcılı duyuru (koordinatör, Enes onayıyla; **yayın/duyuru akışı kullanılmaz**, çünkü o tüm velilere uygulama içi/push gönderir).
   `<USER>` ve `<FAMILY>` Enes'in kimlikleri:
   ```sql
   with i as (
     insert into gina.parent_inbox(user_id,family_id,event_key,kind,title,body,expires_on)
     values('<USER>','<FAMILY>','h04-acceptance:2026-11-06','announcement','GINA e-posta kanal testi',
            'Bu ileti yalnız kabul testi içindir; başka veliye gönderilmedi.',current_date+2)
     returning id)
   insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key)
   select '<USER>','<FAMILY>','email','announcement','parent_announcement',jsonb_build_object('inbox_id',i.id::text),'h04-acceptance:2026-11-06:email' from i;
   ```
   Dakikalık tetik bir dakika içinde gönderir (beklemeden: yukarıdaki `curl`). Uygulamada bu gelen kutusu öğesini e-posta gelmeden
   **açma**: okunmuş öğe `announcement_not_current` ile atlanır. `dedupe_key` tekrarı ikinci satırı reddeder (çift gönderim yok).
4. Sonuç (adres göstermeden):
   ```sql
   select id,kind,status,skip_reason,attempts,provider,provider_message_id is not null as has_id,accepted_at,last_error
   from gina.channel_outbox where user_id='<USER>' order by id desc limit 5;
   ```

**Kanıt:** satır `accepted` (bu "sağlayıcı kabul etti" demektir; teslim/okunma değil), gelen kutusunda konu = başlık, From = `from_address`,
SPF/DKIM/DMARC, `List-Unsubscribe: <…/functions/v1/channel-unsubscribe?token=…>` ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
başlıkları, gövdenin sonunda `ginafamily.com/unsubscribe?token=…` bağlantısı, gövdede çocuk/aile verisi yok. Mümkünse aynı 1–3'ü
farklı sağlayıcıdaki bir adresle tekrarla (dış teslimat kanıtı).

### (d) Kullanılmış / süresi geçmiş bağlantı
- (a)'daki reset bağlantısını **ikinci kez** aç → `/reset-password`: "Bu bağlantı geçersiz, kullanılmış…" + yerinde "Yeni şifre yenileme
  bağlantısı iste" formu (EN: "This link may be invalid, used…").
- İki reset iste, **ilk** e-postadaki bağlantıyı aç → aynı ekran (yeni istek eskisini geçersiz kılar). Süre dolumu için Auth "Email OTP
  expiration" süresinden (varsayılan 1 saat) eski bir bağlantı.
- (b)'deki doğrulama bağlantısını doğrulamadan sonra tekrar aç → `/auth-callback` ya da giriş ekranında "Bu bağlantının süresi dolmuş
  ya da daha önce kullanılmış. Aşağıdan yeni bir bağlantı isteyebilirsiniz." + yeniden gönderme formu.
- Ürün doğrulama kodu: yanlış kod → "4 deneme hakkın kaldı"; 60 dk sonra eski kod reddedilir.

**Kanıt:** her durum için ekran görüntüsü (adres çubuğundaki `error_code=otp_expired` görünebilir; token görünmesin), "iptal edildi"
yazmadığı, form çalıştığı.

### (e) Vazgeçme (unsubscribe)
1. (c)'deki e-postada Gmail üstte "Aboneliği iptal et" gösterirse o (one-click POST; Gmail bunu her gönderende göstermez), **ve/veya** gövdedeki bağlantı → `/unsubscribe` → "Durdur".
2. Aynı bağlantı tekrar → "daha önce kullanıldı" (ikinci rıza/denetim satırı yok).
3. Uygulamada Duyurular → E-posta kapalı görünür; rıza geçmişinde "iletideki bağlantıdan".
4. (c)/3'ü yeni `event_key`/`dedupe_key` ile tekrarla → satır `skipped` / `preference_off`, e-posta gelmez.
   ```sql
   select channel,purpose,enabled,source,created_at from gina.notification_consent_log where user_id='<USER>' order by id desc limit 5;
   ```

**Kanıt:** ekran görüntüleri, sorgu çıktıları, ikinci kez `already_done`.

### Temizlik
Test artı-adres hesapları (b) uygulamadaki hesap silme akışıyla silinir; `parent_inbox` test öğesi uygulamada arşivlenebilir. Kanal
açık kalacaksa sorun yok; kapatılacaksa `channels.email.provider='null'`.

### Rapor şablonu
| Adım | UTC | Sonuç | Kanıt dosyası |
|---|---|---|---|
| (a) EN reset | | | |
| (b) yeni hesap EN / TR | | | |
| (c) ürün e-postası (Gmail / farklı sağlayıcı) | | | |
| (d) kullanılmış/süresi geçmiş | | | |
| (e) vazgeçme | | | |

## Sınırlar
- pgTAP 116/1 (anon'un çalıştırabildiği `public`/`gina` fonksiyon listesi) Istanbul tam koşusunda bir kez düştü; tek başına 2 kez ve tam
  koşuda yeniden geçti. Bu dalın yeni fonksiyonu (`gina.channel_heartbeat_due`) aynı migration işleminde tüm rollerden geri alınır ve 134
  bunu doğrular; yine de tekrarlanamayan bir dalgalanma olarak kayıtta.
- Gerçek gönderim, gelen kutusu, SPF/DKIM/DMARC ve Brevo panosu bu turda görülmedi; hepsi yukarıdaki kabulde.
- Yalnız `confirm` ve `reset` şablonları markalı; e-posta değişikliği, sihirli bağlantı, davet Supabase varsayılanı (İngilizce).
- Betik tetiklemesi implicit akıştır; reset tıklama akışı web'de uygulama ekranından sınanmalı.
- Native uygulamada e-posta bağlantısı (Universal/App Link yok) web'de açılır — C10 sınırı aynen.
- Makbuz 3 denemede de yazılamazsa SMTP'de ikinci kopya riski (yukarıda).
- Ekran okuyucu/yazı boyutu bu turda ayrıca denenmedi; değişen ekranlarda yeni bileşen yok, mevcut metin/düğmeler.
