# Hesap ve diğer ekranlar · v5 uygulama denetimi

31 Ekim 2026. [Yan yana karşılaştırma](index.html): onaylı maket ve üretim web paketinden gerçek uygulama görüntüsü. Testler Playwright ile 390×844 Türkçe tarayıcıda yapıldı. Supabase HTTP ve realtime trafiğinin tamamı yakalandı; yerel demo verisine istek gitmedi.

- Giriş/kayıt, aile, eşleme, bildirim, paylaşım, paketler, öğretmen raporu, şifre yenileme ve hesap silme: eksik görsel/yatay taşma/48 dp altı etkileşim alanı yok (`layout-qa.json`).
- V5 pencere sahnesi, Baloo 2 başlık, Nunito gövde, aynı kâğıt ve buton yüzeyleri. Çalışmayan Apple/Google yer tutucuları kaldırıldı; beta e-posta/şifreyle çalışır.
- Kayıt doğrulaması beklenirken giriş yapılmış gibi yönlendirme yok. Şifre kurtarma PKCE; bağlantı isteğin yapıldığı cihazda açılır. Gerçek SMTP/deep-link cihaz kabulü ayrıca gereklidir.
- Bildirim kaydı tamamlanmadan başarı gösterilmez. Paylaşımın tam web adresi yoksa oluşturma kapalıdır. Mağaza fiyatı ve yayımlanmış hukuki adres olmadan yeni satın alma açılmaz; geri yükleme ayrı kalır.
- Hesap silme şifreyle yeniden doğrulama ve açık onay ister. Sunucu kimliği mevcut doğrulanmış oturumdan alır. Son veli aileyi siler; başka veli varsa sahiplik devredilir. Kullanıcının yazdığı notlar ve oluşturduğu paylaşım linkleri silinir. Abonelik ayrıca mağazadan iptal edilir.

`capture.js` ve `flows.js` yalnız sahte test verisi içerir. Bunlar gerçek mağaza, push teslimatı, SMTP veya cihaz performansının kanıtı değildir. Bunların kabul adımları yayın rehberindedir.
