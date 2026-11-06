# U02 — eşler, aileler, cihaz ve PIN + QR eşleme (6 Kasım 2026)

Durum: **KOD HAZIR / yerelde TEST EDİLDİ — yayımlanmadı.** Dal: `worktree-agent-a8e48d00c0cf1ffbf` (main'e push yok, üretime dokunulmadı, `db reset` yok). Migration **yok** (mevcut `request_pairing` / `pair_child_device` / `configure_child_device` / `select_family` / `join_family` RPC'leri yetti), bu yüzden pgTAP koşusu gerekmedi.

## Ne değişti

| Alan | Değişiklik | Dosyalar |
|---|---|---|
| QR eşleme | Çocuk cihazı kod oluşturunca QR + 6 haneli kod gösterir. QR yalnız `…/parent/pair-device?code=<6 hane>` uygulama bağlantısını taşır (ad/aile/çocuk bilgisi yok; testte çözülüp doğrulandı). Yeni paket yok: bağımlılıksız QR kodlayıcı (`lib/qr-code.ts`, bayt kipi, ECC M, sürüm 1–10) + mevcut `react-native-svg`. | `lib/qr-code.ts`, `components/device/pairing-qr.tsx`, `app/device/pair.tsx` |
| Veli tarafı eşleme | Yeni rota `/parent/pair-device`: telefon kamerası QR'ı okuyup uygulamayı bu ekranla açar (kod alanı dolu gelir) ya da kod elle yazılır. Onaysız eşleme yok; onaydan sonra doğrudan cihaz erişimi ayarına gider (o zamana kadar cihazda profil açılmaz — sunucu `pair_child_device` zaten `selected` + çocuksuz bırakıyor). Süresi dolmuş/kullanılmış kod için ne yapılacağını söyleyen kart. | `app/parent/pair-device.tsx` |
| İki cihaz adımları | "Çocuğun cihazında" / "Veli telefonunda" iki sütunlu, numaralı, o anki adımı vurgulayan görsel adımlar (telefon tek sütun, tablet/masaüstü iki sütun). | `components/device/pairing-steps.tsx` |
| Süre dolunca | Geri sayım çubuğu; süre bitince QR ve kod gizlenir, "Kodun süresi doldu" + "Yeni kod oluştur". Yeni kod eski kodu sunucuda siler. | `app/device/pair.tsx` |
| Cihaz erişimi özeti | Tek/ortak cihaz, izinli çocuklar (sayı + adlar), PIN gerekli/istenmez ve PIN'i eksik çocuklar tek kartta; taslak kaydedilmemişse "Kaydedilmedi" rozeti ve açıklaması. Mevcut taslak koruması (`usePreventRemove` + `beforeunload`) korunup geçmiş yığını yokken de çalışacak şekilde "Geri" düzeltildi (QR ile gelen veli için `router.back()` hiçbir şey yapmıyordu). Başka oturumda iptal edilen cihaz için açık mesaj. | `components/device/device-access-summary.tsx`, `app/parent/device-access.tsx` |
| PIN ekranları | Çocuk cihazı PIN'i, veli telefonunda çocuk modu PIN'i ve PIN belirleme (`PinSetup`) artık aynı `PinEntry` kontrolünü kullanır (Q00-A2-6 kapandı). Ortak `PinRecovery`: kim yeniler, nereden yenilenir, 5 yanlış → 1 dk bekleme (sunucu politikasıyla aynı). Yanlış PIN'de kutular temizlenir. | `components/ui/pin-entry.tsx`, `components/ui/pin-setup.tsx`, `app/child/pin.tsx`, `app/parent/child-mode/index.tsx` |
| Açık oturumda erişim iptali | PIN ekranındaki çocuk sakin "Bu cihazın erişimi kaldırıldı… hiçbir çalışman silinmedi" mesajını görür, düğmeyle eşleme ekranına döner; eşleme ekranı aynı notu gösterir. Çocuk dünyasının içindeyken mevcut `child/_layout` kontrolü cihazı eşleme ekranına döndürür. | `app/child/pin.tsx`, `app/device/pair.tsx` |
| Aileler | "Aile değiştir" ve "Bir aileye katıl" ayrı sekmeler. Değiştirmede: açılacak aile + çocuk sayısı, geride kalan çocuk adları ve bağlı cihaz sayısı, hiçbir şeyin silinmediği/taşınmadığı/birleşmediği. Katılmada: eşler ayrı aile kurduysa "İki ayrı aile olacak" uyarısı, iki tarafın çocuk sayıları, aynı çocuğun iki ayrı profil olarak kalacağı. Hiçbir yerde "birleştirme" eylemi yok; otomatik birleştirme yok. | `components/family/family-hub.tsx`, `app/parent/families.tsx` |
| i18n | Yalnız yeni `u02.*` anahtarları (TR/EN 74'er), `{{x}}` biçimi; mevcut anahtar silinmedi/değişmedi. | `packages/core/src/i18n/{tr,en}.json` |

### Kamera paketi kararı

`expo-camera` projede **yok**; eklenmedi. Gerekçe: QR'ı veli telefonunun **sistem kamerası** okuyup `gina://parent/pair-device?code=…` bağlantısıyla uygulamayı açabildiği için uygulama içi tarayıcıya gerek kalmadı; bu yol yeni yerel modül, kamera izni metni (`NSCameraUsageDescription`) ve yeni geliştirme derlemesi gerektirmiyor. Kod girişi her zaman yedek. Uygulama içi tarama istenirse öneri: veli tarafında `npx expo install expo-camera` (SDK 58 uyumlu sürüm), izin metni "Çocuk cihazındaki eşleştirme QR kodunu okumak için" ve aynı `/parent/pair-device` onay ekranına yönlendirme — ayrı karar.

## Testler (gerçekten çalıştırıldı)

- `npx tsc --noEmit` (apps/mobile): ara koşuda `pairing-qr.tsx` içinde `shapeRendering` prop hatası yakalandı ve kaldırıldı; son koşu **TSC_EXIT=0**.
- `npx expo lint` (apps/mobile): **çıkış 0, uyarı/hata yok**.
- QR kodlayıcı: 5 farklı yük (sürüm 1, 3, 4, 8, 10) PNG'ye çizildi ve macOS CoreImage `CIDetectorTypeQRCode` ile (`scripts/u02/decode-qr.swift`) **5/5 birebir çözüldü**. UI testinde ekrandaki QR öğesi de aynı yolla çözüldü.
- İzole servis + web export + Playwright: `test-isolated-services.py --run-local --with-realtime --ui-hold` (kendi fixture yolu `/tmp/gina-u02-fixture.json`, tek kullanımlık `gina_http_<hex>_audit` DB + kendi Auth/REST/Realtime konteynerleri), bu servise bağlı `expo export -p web` (`scripts/u02/export-web.sh`, yalnız `127.0.0.1` URL'sini kabul eder), `scripts/u02/serve-spa.mjs` (8297), `scripts/test-u02-device-family-ui.cjs`. Ölçüler 390×844, 768×1024, 1280×800; sentetik `example.invalid` hesapları. Sonuçlar: [ui-checks.json](ui-checks.json), görüntüler `screenshots/`.

### Son UI koşusu (04:56, 15/15 geçti — `ui-checks.json`)

| Kontrol | Sonuç |
|---|---|
| Tek aile: "Aile değiştir" sekmesi birleştirme olmadığını açıklıyor | geçti |
| İki eş ayrı aile kurmuş: katılma önizlemesinde "İki ayrı aile olacak" + sayılar; katıldıktan sonra iki aile ve çocukları ayrı (DB'de 1+1 çocuk) | geçti |
| Aile değiştirme etkisi (geride kalan çocuk adları, cihaz sayısı) ve özgün aileye dönüş | geçti |
| Tek çocuk, veli telefonunda çocuk modu: ortak PIN kontrolü, yanlış PIN (kutular temizlenir), kurtarma yolu | geçti |
| QR öğesi CoreImage ile çözüldü: yalnız `/parent/pair-device?code=<6 hane>`; ad/aile verisi yok | geçti |
| Veli QR bağlantısından onaylıyor; cihaz `selected`/`required`, çocuksuz kalıyor | geçti |
| Kaydedilmemiş izin taslağı: "Kaydedilmedi" rozeti, Geri → uyarı → düzenlemeye dönünce seçim korunuyor | geçti |
| Tek çocuk kişisel cihaz kaydı (DB: yalnız Ece) | geçti |
| Çocuk cihazı: yanlış PIN, kurtarma, doğru PIN → `/child/today` | geçti |
| Çok çocuk ortak cihaz: PIN'siz çocuk uyarısı, satır içi PIN (uyuşmazlık uyarısı dahil), PIN kaydından sonra taslak (Ece, Can) korunuyor, kayıt (DB: Can, Ece) | geçti |
| Çok çocuk çocuk modu: seçici → ortak PIN kontrolü | geçti |
| Süresi dolan kod: QR gizlenir, "Kodun süresi doldu"; veli eski kodu girince yönlendirme kartı; "Yeni kod" eskisini sunucuda siler | geçti |
| Açık PIN ekranındayken erişim iptali → cihaz ~2 sn'de eşleme ekranına döndü | geçti |
| Çocuk dünyasındayken (telefon, PIN'siz cihaz) iptal → ~1 sn'de eşleme ekranına döndü | geçti |
| Hiçbir sayfada çalışma zamanı hatası, yatay taşma veya ham i18n anahtarı yok | geçti |

Temizlik: harness çıktısı `realtime/rest/auth_removed: true`, `disposable_database_removed: true`; sonrasında `pg_database` içinde `gina_http_*` = 0, `docker ps` içinde `gina_http*` = 0; fixture dosyası silindi; 8297 sunucusu durduruldu. Başka ajanların DB/konteynerlerine dokunulmadı. Not: test ortamı üç kez kuruldu (45 dk tutma süresi doldu); ara koşulardaki başarısızlıklar test betiği ve küçük UI düzeltmeleriydi (commit geçmişinde).

## Kalan sınırlar

- Veli oturum açmamışken QR bağlantısı açılırsa `parent/_layout` yönlendirmesi kodu taşımaz; veli girişten sonra kodu elle yazar (kod ekranda durur). Kod bağlantısını girişten sonra sürdürmek ortak giriş akışına dokunur (başka sahiplik).
- `parent/menu.tsx` (başka ajan) hâlâ kendi kod alanını kullanıyor; yeni `/parent/pair-device` ekranına bağlantı vermesi önerilir.
- Veli çıkış PIN'i ekranı (`components/room/child-mode-home.tsx`, `lib/child-mode.tsx`) bu işin sahipliğinde değil; `PinEntry` + `PinRecovery kind="parent"` hazır, oraya bağlanması ayrı küçük iş.
- Açık oturumda iptal, uygulamanın mevcut arka plan kontrolleri (`child/_layout`, `/child` profil yoklaması) tarafından 1–2 sn'de yakalanıp cihaz eşleme ekranına dönüyor; ama o yol iptal notunu (`?revoked=1`) taşımıyor (layout başka sahiplikte). PIN ekranındaki sakin "erişim kaldırıldı" kartı ve eşleme ekranındaki not kodda var, fakat bu koşuda arka plan kontrolü PIN gönderiminden hep önce davrandığı için **ekranda gözlenemedi** (3 deneme; test bu yolu doğrulanmış saymıyor). Öneri: `child/_layout` iptalde `/device/pair?revoked=1`'e yönlendirsin.
- react-native-web seçim kartlarında `aria-checked` yazmıyor (Q00-A1-19 ile aynı kök); test bu yüzden özet kartını doğruladı.
- Gerçek iOS/Android cihazda sistem kamerasıyla `gina://` bağlantısının açılması ve fiziksel tablet kabulü yapılmadı (yalnız web + CoreImage çözümü).
- Aile verisi birleştirme istenirse çocuk/üyelik/ödeme/kanıt çakışması için ayrı öneri ve karar kaydı gerekir; bu iş yalnız açıklama ekledi.
