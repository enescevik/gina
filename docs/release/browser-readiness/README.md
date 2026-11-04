# Web ve yönetim paneli yayın dosyaları

4 Kasım 2026. Gerçek public proje yapılandırmasıyla `build-web.mjs` ve `build-backoffice.mjs` geçti. Üretilen statik dosyalar, üretilen Cloudflare güvenlik başlıklarıyla yalnız 127.0.0.1 üzerinde açıldı. Gerçek sağlayıcı ayarları salt okunur alındı; giriş/kayıt/sıfırlama e-postası gönderilmedi.

## Bulunan ve düzeltilen

Yönetim panelinin `img-src` kuralı, kütüphane dosyasını doğrulayan `readLibraryFile` içindeki `Image.decode()` için gereken blob görselini engelliyordu. Aynı PNG ve gerçek tarayıcı politikasıyla önce çözümleme başarısız + `img-src blob` ihlali, yalnız `img-src blob:` eklendikten sonra başarılı + sıfır ihlal doğrulandı. Script, dış kaynak, nesne ve çerçeve izinleri genişletilmedi.

İki yayın derleyicisi artık istemci anahtarının yalnız public/anon olmasını, proje adresinin public HTTPS kökü olmasını ve public değişkenlere sunucu anahtarı konmamasını derlemeden önce denetler. Yanlış adla konmuş service-role değeri de reddedilir. Hata metinleri anahtar değerini içermez. Sekiz test geçti. Bu yapılandırma koruması ağdaki projenin sahipliğini veya JWT imzasını doğrulayan bir yetkilendirme sistemi değildir.

## Görsel kontrol

Türkçe, 390×844 ve 1280×800: web ve yönetim girişi, logo/font/görsel yüklenmesi, yatay taşma ve tarayıcı hataları kontrol edildi. Web sosyal giriş düğmeleri gerçek sağlayıcı ayarları geldikten sonra görünür; yetişkin beyanı seçilmeden devre dışıdır. Şifremi unuttum ekranına geçiş çalıştı. E-posta teslimi veya Google/Apple hesabıyla tam giriş yapılmadı.

- [Web telefon](web-sign-in-390.png) / [Web tablet](web-sign-in-1280.png)
- [Yönetim telefon](backoffice-sign-in-390.png) / [Yönetim tablet](backoffice-sign-in-1280.png)

Ekran görüntüleri tarayıcı görünüm alanıdır; mobil uygulamanın native ekranları değildir. React Native web iç kaydırıcısı nedeniyle alt içerik bu karelerde görünmeyebilir; kullanıcı kaydırabilir.

Cloudflare oturumu kullanıcı isteğiyle ertelendi; yayın yapılmadı. Bütün oturumlu ekranlar bu tarayıcı koşumunda gezilmiş sayılmaz. Destek/SSS/Prova gibi gerçek hizmet kabulü ayrı raporlardadır.
