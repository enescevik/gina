# Dil seçimi ve marka yüzeyleri — 7 Kasım 2026

## Kapsam

- Mobil/veli webinde giriş, kayıt, şifre yenileme, callback ve diğer `navigation=false` ortak ekran başlıklarında TR/EN seçimi. Menü → Hesap'ta tam dil adları ve cihaz tercihi açıklaması.
- Form yeniden oluşturulmaz; girilen bilgiler ve seçili işlem korunur. Dil cihazda saklanır (native SQLite KV, web localStorage); saklama başarısızsa bu oturumda çalışır ve kullanıcıya bilgi verilir.
- Öncelik: açık cihaz tercihi → giriş yapılan hesabın kayıtlı dili → cihaz dili → Türkçe. Hesap e-postası için mevcut metadata eşitlemesi korunur; parola kurtarma sırasında auth güncellemesi yapılmaz.
- `html lang` etkin dille güncellenir. Kullanıcının içerikleri/ders isimleri otomatik çevrilmez. Backoffice ekip içi Türkçe arayüz olmaya devam eder; bu tur orada ikonlar güncellenir.
- iOS ana/dark/tinted ikonları zaten yeni maskottu. Eski favicon, Android adaptive/mono ve eksik bildirim ikonu mevcut mint kaynağından teknik olarak türetildi.
- Web ve yönetim paneline favicon, Apple touch icon ve manifest; iki tablet kurulum üreticisine favicon/touch icon eklendi. Eski `generate-brand` komutu artık eski Yan Yana logosunu geri yazmaz.
- Kaynaklar: `packages/assets/brand/apple-mint-delivery/`; türevler: `platform-mint/manifest.json`. Yeni çizim yapılmadı.

## Kontrol ve yayın

- Mobil ve backoffice tip kontrolü/lint; core 615 test; tablet/release betikleri 15 test.
- Canlı webde TR/EN geçişi, oturum açık Hesap sekmesi, parola yenileme, seçili dilin erişilebilirlik durumu ve yenilemede kalıcılık doğrulandı. Telefon ölçüsü aracında tutarsızlık görüldüğü için dar ekranın son fiziksel kabulü açık; masaüstü/tablet genişliğinde taşma görülmedi. Bu kontroller fiziksel cihaz kabulü sayılmaz.
- Yeni dependency veya migration yok. Native değişiklikler yeni derleme ister; web ve kurulum HTML'i ayrı yayımlanabilir.

## Doğrulanmış yayınlar

Kod PR [#162](https://github.com/enescevik/gina/pull/162) main'e birleşti: `4084e3f0a45cc29ea12625df37d9d26ef7dad2e5`. Paket kaynak commit'i `6d4e80c1763ca0d7f1b81410bdba02c092128046`; merge commit'iyle içerik farkı yok.

| Hedef | Sonuç |
|---|---|
| Tablet kurulumu | **0.1.0 (33)**, deployment `fsko56n982`, `tablet` alias canlı. IPA SHA-256 `e4235b6d5cb95663d00786aca89677d406e7f59cee972d2fdcd2ff82a404371e`; manifest/sürüm/hash geçti, ikon metadata ve PNG eşleşti. Öncekiyle aynı kayıtlı cihaz; geliştirici debug yetkisi kapalı. Ana Expo web korunuyor. [Kanıt](evidence/tablet-live-check.json) |
| TestFlight | **0.1.0 (33)** Apple işlemesini tamamladı; mevcut **Team (Expo), 2 iç testçi** grubunda. Türkçe test notları kaydedildi. Gönderim `42030ac6-f3f3-4db3-87a3-1917f6330e8f`, ASC build `206cf8ed-e4ee-41dc-82db-9fc622ce93d9`. Henüz kullanıcı cihaz kabulü değildir. [Paket/imza kanıtı](evidence/store-check.json) |
| Veli webi | `4d1b22e3.gina-web.pages.dev` → `gina-web.pages.dev` / `ginafamily.com`; 141 HTML/JS/CSS dosyasının iki kökende 282/282 hash'i eşleşti |
| Eski Expo web adresi | `gina-aile-enescevik.expo.app` → `ojabbuctp1`; aynı paket, 141/141 hash eşleşti. İlk taramada 7 istek 429 aldı; bekleme sonrası tekli kontrolle geçti. Canlı girişte TR/EN görüldü. Tablet alias ayrı tutuldu. [Kanıt](evidence/expo-web-hashes.json) |
| Marka dosyaları | `ginafamily.com` ve `www` üzerinde 10/10 ikon hash'i eşleşti |
| Backoffice | `bd359eb9.gina-backoffice.pages.dev`; mevcut yönetici oturumunda `/operations` açıldı, yeni touch-icon/manifest başlığı görüldü. Alias ve gerçek önizleme için Access 12/12 korumalı |
| Main CI | lint/typecheck/test, pgTAP ve Edge başarılı; Security review başarılı. [Kanıt](evidence/main-checks.json) |
| Zamanlanmış işler / DB | Salt okunur kontrolde 164 migration, son `20261107040000`; 13 etkin cron; son 24 saatte 1.834 başarılı çalışma, 0 başarısız. Bu tur migration uygulanmadı. [Kanıt](evidence/server-state.json) |
| Canlı sunucu | Web güvenlik başlıkları, anon veri erişim engeli, Auth, 27 etkin Edge fonksiyonu başarılı; atlanan kontrol yok. [Kanıt](evidence/health-web.json) |

Canlı UI testi sırasında dil TR → EN → TR değiştirildi; gerçek hesap Türkçe bırakıldı. Şifre yenileme e-postası tetiklenmedi, aile verileri değiştirilmedi. Kullanıcı oturumu içeren ekran görüntüleri depoya alınmadı.

Son yayından sonra `health-check --strict` **başarılı**, başarısız/atlanan yok; beklenen tablet derlemesi 33. [Son sağlık kaydı](evidence/health-final.json). Android ikonları kaynakta hazır; Android dağıtımı bu tur yapılmadı (Play/Firebase kurulumu ayrı).

## Nasıl kullanılır?

- **Giriş yapmadan:** giriş, yeni hesap ve şifre yenileme başlığındaki **TR / EN** düğmeleri.
- **Giriş yaptıktan sonra:** alt menü **Diğer → Aile ayarları → Hesap → Uygulama dili**. Bazı giriş yollarında ekran doğrudan “Aile ayarları” olarak açılır.
- Tercih bu cihazda saklanır. Çocuk cihazının ilk eşleme ekranında da seçilebilir. Kullanıcı içeriği, çocuk adı ve ders adları çevrilmez.
- Kaydedilmiş ana ekran web kısayolu eski resmi tutarsa önce sayfayı yenile; hâlâ eskiyse yalnız web kısayolunu kaldırıp Safari → Paylaş → Ana Ekrana Ekle ile tekrar ekle. **GINA uygulamasını veya verisini silme.** Native uygulama için güncelleme gerekir.
- Backoffice bu yayınla Türkçe kalır; bu tur backoffice'de dil çevirisi değil marka ikonları güncellendi.

## Kullanıcının yapacağı son kontroller

### 1. Güncelleme ve dil (5 dakika)

1. iPhone’da TestFlight → GINA → Güncelle; sürüm bilgisini not et.
2. Kayıtlı iPad’de Safari ile [tablet kurulum sayfasını](https://gina-aile-enescevik--tablet.expo.app/) aç → Yükle / Güncelle. Mevcut uygulamayı silme.
3. Girişte EN seç; Şifremi unuttum ekranına git. Ekran İngilizce kalmalı. TR’ye dön.
4. Giriş yaptıktan sonra Hesap → Uygulama dili ile EN seç; uygulamayı kapat/aç. Seçim kalmalı. Sonra istediğin dile dön.
5. Uygulama simgesi ve web ana ekran kısayolunda mint maskotu kontrol et.

### 2. Fiziksel cihaz kabulü

[C15'in 18 maddesini](../h06-2026-11-06/C15-DEVICE-CHECKLIST.md) **son derlemeyle** uygula. Oradaki B30/B31 etiketleri tarihsel; yeni testte gerçek sürümü yaz. Önce Pencil ile çizim ve veliye ulaşması, dikey/yatay dönüş, büyük yazı, VoiceOver ve kilitli telefona push teslimine bak. Hata için madde numarası + sürüm + ekran görüntüsü/kısa video yeterli.

### 3. Apple ve e-posta

- Apple hesap silmeyi yalnız silinebilecek ayrı bir test hesabıyla yap. Giriş → Hesap → silme etkisini gör → Apple ile doğrula → kalıcı sil. Sonrasında iPhone Ayarlar → Apple Hesabı → Apple ile Giriş Yap altında GINA erişimini kontrol et. Asıl aile hesabını silme.
- Sahibi olduğun bir iCloud veya Outlook gelen kutusuyla doğrulama/şifre yenileme e-postasını dene. Gelen kutusu/spam ve bağlantının telefondaki dönüşünü kontrol et. Parola, anahtar veya tek kullanımlık kod gönderme. Gmail teslim kanıtı başka sağlayıcının teslim garantisi değildir.

### 4. Yaygın yayın öncesi karar/hesaplar

- **Geri yükleme tatbikatı:** ayrı Supabase test projesi ve bunun maliyeti için karar gerekiyor. Üretimin üstüne restore yapılmaz. Ortam ayrılınca ajan tatbikatı yürütebilir.
- **Hukuk/satış:** TR/EN hukuk metinlerini avukata incelet; yasal kimlik/adres ve rıza modelini kesinleştir. Ücretli mağaza yayını bu karara bağlı.
- **Android/SMS:** Play Console/Firebase ve SMS sağlayıcısı erişimi gerekiyorsa hesaplarını aç. Sırları sohbete yapıştırma; ilgili servis kasasına/ayarına girilir. iOS/web dil ve ikon yayını bunları beklemez.

Kütüphane içerikleri backoffice üzerinden ayrı süreç; 3B dünya ayrı çalışma; Prova yeni soru türlerinin tamamlandığı bu yayınla iddia edilmez.
