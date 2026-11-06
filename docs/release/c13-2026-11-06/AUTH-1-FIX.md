# C13-AUTH-1 düzeltmesi — eşleme kodunun kaba kuvvetle ele geçirilmesi (P0)

Bulgu: [README.md](README.md) §5 C13-AUTH-1. 6 haneli kod (10⁶), 10 dk ömür, `preview_device_pairing` /
`pair_device` / `pair_child_device` için deneme sınırı yok; herhangi bir kayıtlı veli kodları deneyip bekleyen yabancı
tableti kendi ailesine bağlayabiliyordu. `pair_device` hatada istisna fırlattığı için başarısız deneme geri alınıyor,
sayılamıyordu.

Migration: `supabase/migrations/20261106340000_pairing_bruteforce_guard.sql` (tek dosya). pgTAP:
`supabase/tests/120_pairing_bruteforce_guard.test.sql` (112 iddia).

## 1. Tasarım (koordinatör kararı uygulandı)

| # | Karar | Uygulama |
|---|---|---|
| 1 | Kod alanını büyüt | `request_pairing` 8 karakter, alfabe `ACDEFHJKMNPRTUVWXY3479` (22 sembol, 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B yok) → 22⁸ ≈ 5,5·10¹⁰. `gen_random_bytes` + reddetmeli örnekleme (≥242 bayt atılır, modulo sapması yok). Tabloya biçim `CHECK`'i; yayındaki eski 6 haneli bekleyen kodlar migration'da silinir (≤10 dk ömürlü, tablet yeni kod ister). Girişte büyük/küçük harf, boşluk ve tire yok sayılır; ekranda 4+4 (`ACDE FH34`). QR bağlantısı ham 8 karakteri taşır. |
| 2 | Sayılabilir deneme | `preview_device_pairing` artık `volatile`, yanlış kodda **hata fırlatmaz**, `{status:'invalid_or_expired', attempts_left}` döner → deneme kaydı commit olur (`device_pairing_attempts`). Kayan 10 dk pencerede **kullanıcı başına 10** başarısız → 15 dk kilit; **aile başına 20** (tüm veliler) → 15 dk aile kilidi (`device_pairing_locks`). Kilitliyken arama yapılmaz, sayılmaz: `{status:'pairing_locked', retry_after_seconds, locked_until}`; doğru kod da token vermez. Aynı kullanıcı/aile denemeleri `pg_advisory_xact_lock` ile sıralanır (paralel istekle sayaç aşılamaz). Başarılı önizleme sayacı **sıfırlamaz** (saldırgan kendi tabletiyle denemeyi “aklayamaz”). Biçimsiz/null/eski 6 haneli kod da başarısız sayılır. |
| 2b | Önizleme jetonu | Başarılı önizleme `preview_token` (uuid, `device_pairing_previews`) döner: ömrü `min(5 dk, kodun kalan ömrü)`, **kullanıcıya, aktif aileye ve koda bağlı**, tek kullanımlık; kullanıcının yeni önizlemesi eski kullanılmamış jetonunu siler. Tablolar RLS açık, istemciye hiçbir yetki yok. |
| 3 | Eşleme yalnız jetonla | Yeni imzalar `pair_device(p_code, p_preview_token)` ve `pair_child_device(p_code, p_preview_token)`. Jeton yok/biçimsiz/bilinmiyor/süresi dolmuş/kullanılmış/başka kullanıcının/başka ailenin/başka kodun → `invalid_preview_token`. Başarıda kod tüketilir, jeton `used_at` alır, aynı koda ait diğer velilerin jetonları silinir. Plan cihaz sınırı aynen. **Eski tek argümanlı imzalar** (`pair_device(text)`, `pair_child_device(text)`) `client_update_required` (P0001) fırlatır. |
| 4 | Cihaz tarafı görünürlük | `device_pairing_status()` (cihazın kendi oturumu): `{status:'paired', family_name, device_name, paired_at, undo_seconds_left}` — aile adı dışında veri yok. `reject_device_pairing()`: yalnız `auth.uid()`'ye ait iptal edilmemiş cihaz, yalnız `paired_at + 15 dk` içinde; cihazı veli kaldırmasıyla aynı duruma getirir (`revoked_at`), JWT yenilenince rol düşer, tablet hemen yeni kod alabilir. Veli oturumu/eşlenmemiş tablet → `forbidden`; pencere dışı → `pairing_undo_expired`. |

Tüm yeni/değişen fonksiyonlar `security definer` + `search_path=''`, `anon`/`public`'ten geri alındı, yalnız `authenticated`.

### Mobil

- `components/device/pairing-code.ts` (yeni): alfabe, normalize, 4+4 biçim, okuyucu için harf harf okuma.
- `components/device/pending-pairing.ts`: QR/derin bağlantı ve oturum öncesi saklanan kod 8 karakter.
- `app/parent/pair-device.tsx`: gruplu giriş (büyük harf, otomatik düzeltme kapalı), önizleme → jeton → `pair_child_device(p_code, p_preview_token)`; onay kartında “Onay için kalan süre” (jeton ömrü); jeton bitince/geçersizse “Onay süresi doldu” ve yeniden göster; yanlış kodda “{{count}} hakkınız kaldı”; kilitte “Çok fazla hatalı deneme … mm:ss sonra” ve “Cihazı göster” devre dışı.
- `app/device/pair.tsx` + `components/device/pairing-receipt.tsx` (yeni): tablet eşleme gerçekleşince doğrudan çocuk moduna geçmez; “Bu tablet şu aileye bağlandı: “…”” kartı, kalan iptal süresi, **Devam et** ve **Bu benim ailem değil** (tek dokunuş → `reject_device_pairing` → JWT yenileme → “Eşleme iptal edildi” + yeni kod). Kod 4+4 gösterilir.
- `components/device/pairing-steps.tsx`, `components/family-choice.tsx`, `components/family/family-hub.tsx`: “6 haneli” geçen metinler yerine yeni anahtarlar.
- i18n: **yalnız yeni anahtarlar** (`auth1.*`, tr+en, 20'şer); mevcut anahtarların metni değişmedi (eski 6 haneli metinler artık bu ekranlarda kullanılmıyor).
- `packages/core/src/database.types.ts`: yeni imzalar elle eklendi (overload birleşimi + iki cihaz RPC'si).

## 2. Eski istemci etkisi (26/27)

- Eski veli uygulaması `pair_child_device(p_code)` / `pair_device(p_code)` çağırır → **`client_update_required`**: eski istemciden yeni cihaz eşlenemez. Ayrıca eski istemci 8 karakterli kodu `^\d{6}$` ile reddeder, QR bağlantısını da tanımaz.
- Eski tablet uygulaması `request_pairing` ile 8 karakter alır ve gösterir (ekrandaki “6 haneli” metni yanlış kalır); yeni veli uygulamasıyla eşlenebilir. Eşlemeden sonra cihaz tarafı onay ekranı yoktur (eski sürüm doğrudan çocuk moduna geçer).
- **Mevcut eşleşmiş cihazlar etkilenmez**: migration hiçbir `devices` satırına dokunmaz; 120 §5 ile kanıt: 20 gün önce eşlenmiş cihaz `revoked_at` boş, erişim ayarları (`all/existing`) aynı, access-token hook rolü `device`; veli `revoke_device` aynen çalışır ve rol `none` olur; eski cihaz 15 dk penceresi dışında olduğundan kendini kaldıramaz.

## 3. Test çıktıları (gerçekten koşuldu, 6 Kasım)

| Test | Sonuç | Kanıt |
|---|---|---|
| pgTAP 120 tek başına | `{"files": 1, "assertions": 112, "failures": []}` | — |
| pgTAP 112 / 019 (davranış değişikliğine göre güncellendi) | 38/38 · 29/29 | — |
| Tam pgTAP, Europe/Istanbul (`test-q02-sql.py --run-local --out <scratch>`) | **119 dosya, 5.272 iddia, 0 hata** | [auth1/pgtap-istanbul/sql-checks.json](auth1/pgtap-istanbul/sql-checks.json) |
| Tam pgTAP, UTC (`--timezone UTC`) | **119 dosya, 5.272 iddia, 0 hata** | [auth1/pgtap-utc/sql-checks.json](auth1/pgtap-utc/sql-checks.json) |
| A/B: 120, migration'sız (`--only 120 --skip-migration 20261106340000`) | beklenen düşüş: `function "public.pair_child_device(text,text)" does not exist` | [auth1/pgtap-ab-120-without-migration.txt](auth1/pgtap-ab-120-without-migration.txt) |
| Uçtan uca zincir (`test-e2e-family-chain.py --run-local`, gerçek GoTrue + PostgREST + Deno Edge) | **456/456** (C13 bölümü 79 kontrol, Edge 12; yeni AUTH-1 alt bölümü 38 kontrol), temizlik `rest/auth/db removed: true` | [auth1/chain-details.json](auth1/chain-details.json) |
| İzole servisler `--with-realtime --ui-hold` (eşleme artık önizleme+jeton) | **194/194**, realtime/rest/auth konteynerleri ve geçici DB kaldırıldı | — |
| Playwright C06 (`scripts/test-c06-pairing-pin-ui.cjs`, Chrome headless, 390×844 / 768×1024 / 1280×800, `expo export -p web` fixture'a bağlı) | **19/19** (16 eski + 3 yeni) | [auth1/ui/ui-checks.json](auth1/ui/ui-checks.json), [auth1/ui/screenshots/](auth1/ui/screenshots/) |
| `pnpm typecheck` / `pnpm lint` | 4/4 · 2/2 | — |
| `pnpm --filter @gina/core test` | 415/415 (58 dosya) | — |

**pgTAP 120 kapsamı:** sözleşme/yetki (yeni imzalar, `volatile`, anon hiçbirini çalıştıramaz, `search_path`, tablolar istemciye kapalı, RLS açık), 6 haneli kodun saklanamaması; 1000 üretimde biçim, tekrarsızlık, 22 sembolün hepsi, benzer karakter yok, normalize; `request_pairing` 8 karakter/10 dk. Önizleme: küçük harf+tire kabul, aile adı yalnız çağıranın ailesi, jeton ≤300 s ve kodun ömrünü aşmaz, başarısızlıklar kalıcı ve `attempts_left` azalır, 10. başarısızlık 900 s kilit, kilitte doğru kod da token almaz ve sayılmaz, aynı ailenin ikinci velisi kullanıcı kilidinden etkilenmez, başka aile ayrı sayaç, kilit/pencere bitince açılır, 9+9+2 = 20 aile başarısızlığı tüm aileyi kilitler ama başka aileye taşmaz, başarı sayacı sıfırlamaz. Jeton: eski imza `client_update_required`, null/biçimsiz/bilinmeyen/başka kod/başka aile velisi/aynı aile başka veli/aile değiştirmiş veli/süresi dolmuş jeton reddedilir; geçerli jetonla eşleme, tekrar (replay) reddi, diğer velinin jetonu kodla ölür, cihaz `selected/required`; cihaz/anonim kullanıcı önizleyemez/eşleyemez, jeton tablosu 42501. Mevcut cihazlar (§2). Cihaz tarafı: durum + aile adı + pencere, başka veri yok; veli/eşlenmemiş tablet iptal edemez; tablet kendini iptal eder, tek seferlik, yeni kod alır, diğer cihaz etkilenmez, hook rolü `none`; 16 dk sonra `pairing_undo_expired` ve cihaz eşli kalır. Yabancı aile: önizleme yalnız kendi aile adını gösterir, sahte aile claim'i önizleyemez/eşleyemez.

**UI (yeni/değişen adımlar):** QR 8 karakterli kodu taşır (CoreImage ile çözüldü); oturumsuz veli QR → giriş → önizleme → onay → eşleme, DB'de jeton `used_at` dolu; bekleyen tablet “Yılmaz Ailesi” onay kartını gösterir, “Devam et” ile çocuk moduna geçer (`device-paired-receipt-*`); elle yazılan `acde-fhjk` biçimi `ACDE FHJK`'ye normalize; **yabancı aile (Demir Ailesi) bekleyen tableti eşler → tablet “Bu benim ailem değil” → cihaz DB'de iptal, tablet çocuk moduna girmez, yeni kod alır** (`device-wrong-family-receipt-*`, `device-not-my-family-done-tablet`); **veli uygulamasında 10 yanlış kod: 1.–9. “N hakkınız kaldı”, 10. kilit kartı, DB'de ≥14 dk kilit, “Cihazı göster” devre dışı, canlı doğru kod RPC'de `pairing_locked` (900 s), kod tüketilmedi** (`parent-pair-wrong-code-phone`, `parent-pair-locked-{phone,tablet}`). Tüm sayfalarda yatay taşma, ham i18n anahtarı (`auth1.` dahil), “ailesi ailesi” ve çalışma zamanı hatası yok.

Ortam temizliği: kendi geçici DB'leri (`gina_q02sql_*`, `gina_q02c_*`, `gina_http_*`) ve konteynerleri silindi (sonradan `pg_database`/`docker ps` 0), fixture dosyası silindi, 8537 statik sunucusu durduruldu. Üretime, `main`'e ve başka ajanların kaynaklarına dokunulmadı; `db reset` yok.

## 4. Kalan sınırlar

- **Sybil:** sınır kullanıcı ve aile başınadır. Çok sayıda hesap açan saldırgan hesap başına 10/10 dk dener; 22⁸ alan ve 10 dk kod ömrüyle tek kodu tutturma olasılığı hesap başına ~10·(bekleyen kod sayısı)/5,5·10¹⁰ — pratikte ihmal edilebilir, ama ağ geçidinde IP/kayıt hızı sınırı (hosted) hâlâ önerilir.
- **Aile kilidi DoS:** aileye katılmış kötü niyetli bir veli 20 yanlış denemeyle ailenin eşlemesini 15 dk durdurabilir (kabul edilen ödünleşim).
- **Cihaz tarafı onay** yalnız tablet eşleme ekranında beklerken eşleme gerçekleşirse gösterilir; uygulama eşleme anında kapalıysa ve yeniden açılınca doğrudan çocuk alanına girerse kart görünmez (sunucu tarafı `device_pairing_status`/`reject_device_pairing` 15 dk boyunca yine kullanılabilir; çocuk alanına giriş noktası eklenmedi).
- **İptal bildirimi:** tablet eşlemeyi reddettiğinde veliye ayrıca bildirim gönderilmez; cihaz yalnız listeden düşer.
- `scripts/test-u02-device-family-ui.cjs` hâlâ 6 haneli kod ve token'sız `pair_child_device` bekliyor; **güncellenmedi ve koşulmadı** (C06 testi aynı akışı kapsıyor). `docs/release/q02-2026-11-06/chain-details.json` zincirin varsayılan çıktısıydı; üzerine yazılan dosya geri alındı, yeni çıktı `auth1/` altında.
- CI (GitHub Actions) bu dalda koşmadı (push yok). Fiziksel cihaz yok; doğrulama web export üzerinde.

## 5. Yayın notu

**Migration `20261106340000` ile yeni mobil (veli) ve tablet sürümü aynı yayında çıkmalı.** Migration uygulandığı andan itibaren eski veli uygulamaları yeni cihaz eşleyemez (`client_update_required`), eski tabletler yeni kodu eski metinle gösterir. Mevcut eşleşmiş cihazlar ve çocuk girişleri etkilenmez. Sıralama: (1) yeni mobil/tablet derlemesini mağazaya/OTA'ya hazırla, (2) migration'ı uygula, (3) aynı pencerede sürümü yayınla; zorunlu güncelleme eşiği varsa 26/27 için açılması önerilir. Geri alma: migration'ı geri almak eski 6 haneli, sınırsız akışı geri getirir — önerilmez.
