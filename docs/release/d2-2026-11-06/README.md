# D2 — C06 / C13-AUTH-1 kalanları (6 Kasım 2026)

**Durum: KOD HAZIR / izole serviste TEST EDİLDİ — yayımlanmadı.** Kaynak main `88b31be`. Dal `worktree-agent-adaa43f51685b7c49`. Main'e push yok, üretime dokunulmadı, `db reset` yok.
Kapatılan sınırlar: [C06 README](../c06-2026-11-06/README.md) "çocuk modundaki PIN'siz çocuk", [AUTH-1-FIX](../c13-2026-11-06/AUTH-1-FIX.md) §4 "cihaz tarafı onay yalnız eşleme ekranında", "iptal bildirimi yok", "u02 betiği güncellenmedi".

## Ne değişti

| İş | Çözüm | Dosyalar |
|---|---|---|
| 1. Veli telefonunda PIN'siz çocuk | Yeni salt-okunur RPC `child_mode_pin_status()` (yalnız veli; aktif ailenin arşivlenmemiş çocukları için `{child_id, pin_set}`; hash/sayaç yok). Ekran sunucu kuralını (`verify_child_pin` PIN'siz çocukta `true`) izler: PIN'siz çocukta PIN kutusu yok, "Bu profilde PIN yok … doğrudan girer, çıkışta ebeveyn PIN'i sorulur" kartı ve doğrudan "Dünyama gir"; PIN'li çocukta ortak `PinEntry` + `PinRecovery`. Durum bilinmiyorsa (yükleniyor/hata) PIN istenir; sunucu her durumda otoritedir. Bu arada başka telefondan PIN eklenirse sunucu reddeder → "Bu profile az önce PIN eklenmiş" + `PinEntry`. Seçici ekranındaki giriş metni PIN'siz çocuğu da anlatan yeni anahtara geçti. | migration, `app/parent/child-mode/index.tsx` |
| 2. Eşleme sonrası onay kartı, uygulama açılışında | (a) Tablet eşleme ekranında açılırsa ve elindeki token henüz `device` rolü taşımıyorsa bir kez `device_pairing_status()` sorulur; eşlenmişse token yenilenir ve kart "Uygulama kapalıyken bu tablet bağlandı" notuyla gösterilir. (b) Token zaten `device` ise `child/_layout` çocuk alanını açmadan önce bir kez (uygulama çalışması başına) kontrol eder: 15 dk penceresi açık ve bu eşleme bu tablette "Devam et" ile onaylanmamışsa `/device/pair?receipt=1`'e götürür. "Devam et" yalnız `{device_id, paired_at}`'i yerelde saklar (web `localStorage`, native KV); yeni eşleme (yeni `paired_at`) yeniden sorar. Pencere kapalıysa kart yok (sunucu karar verir). Kontrol hata verirse çocuk alanı açılır (veli cihazı yine kaldırabilir). "Bu benim ailem değil" mevcut `reject_device_pairing` → token yenileme → "Eşleme iptal edildi" + yeni kod. | `components/device/pairing-receipt-ack.ts` (yeni), `app/child/_layout.tsx`, `app/device/pair.tsx`, `components/device/pairing-receipt.tsx` |
| 3. Reddedince veliye bildirim | Eşleyen veli sunucuda tutulur: `gina.device_pairers` (istemciye kapalı, RLS açık) `devices` üzerindeki AFTER tetikleyicisiyle (`paired_at`/`family_id` değişince, yalnız oturum sahibi o ailenin üyesiyse). `reject_device_pairing` aynı sözleşmeyle çalışır, ek olarak `gina.parent_inbox`'a `kind='device_pairing_rejected'` notu yazar: eşleyen veliye (hâlâ ailedeyse), bilinmiyorsa (migration öncesi eşleme) ailenin tüm velilerine. Not: sabit başlık/metin, **cihaz adı, aile adı, çocuk, kimlik yok**; 30 gün; `event_key` ile tekrarsız. Mevcut gelen kutusu (`parent_inbox()` RPC, `/parent/inbox`) değişmeden gösterir. Pencere dışı red hata verir, not yazılmaz. | migration |
| 4. `scripts/test-u02-device-family-ui.cjs` | 8 karakter (4+4 gösterim), QR'da yalnız `code`, veli QR'ı açınca önizleme kartı (cihaz + aile, kod tüketilmeden) → onay → `device_pairing_previews.used_at`; tablette alıcı aile kartı → "Devam et"; süresi dolan kod "Cihazı göster" ile; REST eşlemesi önizleme + jetonla, token'sız imza `client_update_required`; C06'da değişen aile katıl/değiştir düğme metinleri (`c06.family.*`); çıktı dizini `GINA_U02_OUT`, hata dökümü `GINA_U02_FAIL_DIR` ile seçilebilir. | betik |

Migration: `supabase/migrations/20261106360000_pairing_reject_notice.sql` (tek dosya; `child_mode_pin_status`, `gina.device_pairers` + tetikleyici, `parent_inbox_kind_check` genişletmesi, `reject_device_pairing` yeniden tanımı). pgTAP: `supabase/tests/122_pairing_reject_notice.test.sql`.
i18n: `packages/core/src/i18n/{tr,en}.json` içine yalnız 6 yeni `d2.*` anahtarı (TR 2950→2956, EN 2955→2961); mevcut değer değişmedi. Yeni paket yok. Prova ekranlarına dokunulmadı; `app/_layout.tsx` değişmedi (açılış kontrolü `child/_layout` ve `device/pair` içinde yeterli oldu).

## Testler (gerçekten koşuldu)

| Test | Sonuç |
|---|---|
| pgTAP 122 tek başına (`test-q02-sql.py --run-local --only 122`) | `{"files": 1, "assertions": 39, "failures": []}` (1. koşu betik hatası: arşivli çocuk doğrudan `update` ile kurulamaz → `child_archive_state` ile kuruldu) |
| Tam pgTAP, Europe/Istanbul | `{"files": 120, "assertions": 5311, "failures": []}` — [pgtap-istanbul/sql-checks.json](pgtap-istanbul/sql-checks.json) |
| Tam pgTAP, UTC | `{"files": 120, "assertions": 5311, "failures": []}` — [pgtap-utc/sql-checks.json](pgtap-utc/sql-checks.json) |
| Mobil `pnpm exec tsc --noEmit` / `pnpm exec expo lint` | çıkış 0 / çıkış 0 |
| İzole servis (`test-isolated-services.py --run-local --with-realtime --ui-hold`) | servis sözleşmesi 194/194; temizlik `realtime/rest/auth_removed: true`, `disposable_database_removed: true`; sonradan kendi `gina_http_b91ca…` konteyner/DB'si 0, `gina_q02sql_*` 0, fixture dosyası silindi, 8642 sunucusu durduruldu. Başka ajanın (`gina_http_daab…`) kaynaklarına dokunulmadı. |
| Playwright D2 (`scripts/test-d2-pin-receipt-ui.cjs`, Chrome headless, 390×844 + 768×1024) | **9/9** — [ui-checks.json](ui-checks.json), `screenshots/` |
| Playwright U02 güncel betik (390×844 / 768×1024 / 1280×800) | **15/15** — [u02/ui-checks.json](u02/ui-checks.json), `u02/screenshots/`. 1. koşu: `families_two` adımında eski `u02.family.joinAction` metni (C06'da değişmiş) → betik düzeltildi; 2. koşu 15/15. |
| Playwright C06 (gerileme, aynı fixture, çıktı scratchpad) | 11/12 adım geçti (menü, QR, giriş→önizleme→onay, tablet alıcı aile kartı → Devam, tekrar kullanım, süre, PIN, çocuk sınırı, iptal, veli çıkış PIN'i). `family_texts` adımı düştü: fixture velisi U02 koşusunda ikinci aileye katılmış kaldı (DB'de 2 üyelik doğrulandı) → "Bir aileye katıl" sekmesi beklenen durumda değil. Kod değişikliğiyle ilgisi olmayan sıra/fixture etkisi; temiz fixture'la yeniden koşulmadı. |

**pgTAP 122 (39):** yeni/değişen fonksiyonlar `search_path` sabit, anon çalıştıramaz; `device_pairers` istemciye kapalı + RLS; gelen kutusu yeni türü kabul, bilinmeyeni reddeder. PIN durumu: veli aktif çocuk başına yalnız `child_id`+`pin_set` görür (arşivli yok), başka aile `[]`, sahte aile claim'i ve cihaz oturumu `forbidden`; `verify_child_pin` PIN'siz çocukta PIN'siz `true`, PIN'li çocukta PIN'siz `false`. Eşleme (önizleme+jeton) eşleyen veliyi kaydeder; doğrudan eklenen cihazda eşleyen yok. Red: tek not, yalnız eşleyen veliye (diğer veli/başka aile 0), metinde cihaz/aile adı/kimlik yok, çocuk yok, 30 gün, cihaz iptal; tablet gelen kutusunu okuyamaz; veli `parent_inbox()`'ta okunmamış 1 görür. Eşleyen bilinmiyorsa ailenin iki velisine. Pencere dışında `pairing_undo_expired`, not yok, cihaz eşli kalır.

**UI D2 (sentetik `@example.invalid`, gerçek GoTrue/PostgREST/Realtime):**
1. PIN'siz çocuk (Can): seçici yeni giriş metni; PIN kutusu yok, bilgi kartı; "Dünyama gir" → `/parent/child-mode/today`, hiçbir PIN sayacı artmadı; çıkış ebeveyn PIN'iyle.
2. PIN'li çocuk (Ece): `PinEntry` (`maxlength=4`), yanlış PIN → mesaj + kutu boş, doğru PIN → içeri.
3. PIN'siz ekran açıkken DB'de PIN eklendi → "az önce PIN eklenmiş" + `PinEntry`, yeni PIN'le giriş.
4. **Kapalı tablet**: kod istendi, sekme kapatıldı, veli REST'ten önizleme+jetonla eşledi (`device_pairers.paired_by` = veli), tablet yeniden açıldı → çocuk alanına girmeden "Uygulama kapalıyken…" + "Yılmaz Ailesi" kartı.
5. "Bu benim ailem değil" → cihaz DB'de iptal, "Eşleme iptal edildi" + kod düğmesi; tek not, eşleyen veliye, kişisel veri yok.
6. Veli `/parent/inbox`: "Bir tablet eşlemeyi geri aldı" → Oku → metin; `read_at` doldu.
7. **Token zaten `device`** (yenilenmiş token sekmeye yazıldı): `/child/today` → `/device/pair?receipt=1` kartı → "Devam et" → `/child`; yerelde yalnız `device_id, paired_at`; yeniden açılışta kart yok.
8. Pencere dışı (`paired_at` −16 dk, yerel onay silindi): doğrudan `/child`, kart yok, ek not yok.
9. Hiçbir sayfada çalışma zamanı hatası, yatay taşma, ham i18n anahtarı yok.

## Kalan sınırlar

- **Yayımlanmadı.** Migration `20261106360000` üretime uygulanmadı; `20261106340000` ile aynı ya da sonraki yayında çıkmalı. Eski (26/27) veli uygulaması `child_mode_pin_status` çağırmaz, eski davranışla (4 hane) devam eder; eski tablette açılış kartı yoktur. Sunucu tarafı not her istemcide çalışır.
- Bildirim yalnız **uygulama içi gelen kutusu**; push (`push_outbox`) gönderilmez (tür listesi ve Edge teslimi ayrı iş). `/parent/inbox` yeni tür için ayrı ikon kullanmıyor (duyuru dışı türlerde mevcut kep ikonu görünür; `inbox.tsx` bu işin sahipliğinde değil). Not metni yalnız Türkçe (diğer gelen kutusu kayıtları gibi DB'de sabit metin).
- Açılış kontrolü uygulama çalışması başına bir kez; uygulama arka plandan dönerken (kapanmadan) yeniden sorulmaz. Kontrol ağ hatası verirse çocuk alanı açılır.
- Seçici ekranın alt başlığı (`parentV5.childModeSubtitle`, mevcut anahtar) hâlâ "çocuk profilinde çocuk PIN'ini belirleyin" der; PIN'siz kartla çelişmez ama değer değiştirilmedi (yalnız yeni anahtar kuralı).
- Fiziksel cihaz/native soğuk açılış denenmedi (web export); native KV deposu kodlandı, iOS/Android'de doğrulanmadı (C15).
- C06 betiğinin `family_texts` adımı bu koşuda fixture durumu yüzünden düştü (yukarıda); temiz fixture'la yeniden koşulmadı.
- CI bu dalda koşmadı (push yok).

## Değişen dosyalar

`supabase/migrations/20261106360000_pairing_reject_notice.sql`, `supabase/tests/122_pairing_reject_notice.test.sql`, `apps/mobile/src/app/parent/child-mode/index.tsx`, `apps/mobile/src/app/child/_layout.tsx`, `apps/mobile/src/app/device/pair.tsx`, `apps/mobile/src/components/device/{pairing-receipt.tsx,pairing-receipt-ack.ts}`, `packages/core/src/i18n/{tr,en}.json`, `scripts/test-u02-device-family-ui.cjs`, `scripts/test-d2-pin-receipt-ui.cjs` (yeni), bu klasör.
