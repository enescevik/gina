# Veli Prova · v5 uygulama denetimi

31 Ekim 2026. On ekran: Prova ana sayfa, deneme hazırlama, soru ekleme, senaryo, AI üretim, seviye tespiti, konu ilerlemesi, kitapçık, sonuç inceleme ve çalışma planı. Onaylı pencere sanatı, kâğıt yüzeyler, Baloo/Nunito ve mevcut nesne/avatarlar kullanılır; bütün yazılar native ve TR/EN'dir.

Düzeltmeler: sorgu yükleme/hata/yeniden deneme; en az 48 dp seçimler ve bütün satırdan kullanılabilen anahtarlar; sınıf/soru sayısı/süre doğrulaması; çift kaydetme engeli; doğru cevap alanlarına ekran okuyucu etiketi; okunur doğru cevap rengi; AI hata kodlarının çevirisi; soru kaydı sonrası kütüphane/önizleme önbelleklerinin yenilenmesi. Ekranların ortak `children` önbelleğinde aynı alanları seçmesi sağlandı: önce Görevler'e girmenin Prova'da sınıf/avatara eksik veri bırakması önlendi.

`capture.js`: üretim web export'u üzerinde on ekran, ilk ve devam sayfaları. `layout-qa.json`: sıfır eksik resim, yatay taşma, küçük erişilebilir hedef ve JS hatası. Dekoratif, erişilebilirlik ağacından gizli Switch içi ölçülmez; kontrolün gerçek hedefi 52 dp satırdır.

`flows.js`: geçersiz sınıf sunucuya gönderilmez; iki Kaydet düğmesi aynı anda kayıt açamaz; seçilen doğru cevap yükte korunur. Bütün backend istekleri izole fixture ile karşılanır; demo DB'ye yazılmaz. Bunlar canlı AI, ödeme veya imzalı cihaz testi değildir.

Mobile tsc, Expo lint ve web production export kontrolü tamamlandı. Çocuk denemesinde cevapların yeniden yüklenmesi ve süre sonu hata davranışı, ayrı işlev düzeltmesinde ele alınır.
