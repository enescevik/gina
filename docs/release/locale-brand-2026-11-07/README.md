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
- Gerçek tarayıcı ve canlı yayın sonuçları bu kaydın takip commit'inde eklenecek; henüz fiziksel cihaz kabulü sayılmaz.
- Yeni dependency veya migration yok. Native değişiklikler yeni derleme ister; web ve kurulum HTML'i ayrı yayımlanabilir.

## Kalan gerçek kullanıcı adımları

1. Son mobil sürümde C15 fiziksel cihaz kabulü: Pencil, VoiceOver, büyük yazı, yön değişimi, push, Apple/Google dönüşü. `../h06-2026-11-06/C15-DEVICE-CHECKLIST.md`.
2. Kullan-at Apple test hesabıyla giriş/hesap silme ve iPhone Ayarlar'da Apple erişimini kontrol etme. Asıl aile hesabını silme. Sunucu Apple sırları kurulu; tekrar gönderilmesi gerekmiyor.
3. Sahibi olunan farklı e-posta sağlayıcısında (iCloud/Outlook) teslim ve gerçek cihazdan şifre yenileme bağlantısını açma. Gmail TR/EN teslimi geçti.
4. Barındırılan geri yükleme tatbikatı için ayrı ortam/maliyet kararı; üretimin üstüne geri yükleme yapılmaz.
5. Hukuk/mağaza satışı için avukat onayı ve yasal kimlik/adres; Android/Firebase/Play ve SMS hizmetinin erişim/kurulumları.

Kütüphane içerik üretimi kullanıcı tarafından backoffice üzerinden; yeni MEB pilotu/insan içerik onayı bu sürece aittir. 3B dünya ayrı çalışma. Prova soru türleri ayrı thread'in teslimi; buradaki yayın onların bitmiş olduğu anlamına gelmez.
