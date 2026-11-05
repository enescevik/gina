# Çocuk iPad’i kablosuz kurulum — 0.1.0 (26)

5 Kasım 2026. Kullanıcının çocuk tableti için kurulan ayrı kablosuz dağıtım yolu güncellendi. Önceki TestFlight yanıtı bu kurulum yolunu gözden kaçırmıştı; bağlantının canlı sürümü 20 idi. Tabletin sürümü, başka bir TestFlight hesabında görülen iPad kurulumundan çıkarılmaz.

## Kullanıcı adımı

iPad'de Safari ile [kurulum sayfasını aç](https://gina-aile-enescevik--tablet.expo.app/?v=26), **0.1.0 (26)** yazdığını kontrol et, **Yükle / Güncelle** düğmesine dokun ve iOS kurulum onayını ver. Mevcut GINA silinmez. TestFlight veya veli Apple hesabıyla giriş gerekmez. Bu bağlantı yalnız mevcut paketin profilinde kayıtlı iPad için kullanılabilir.

## Doğrulama

- Gerçek EAS yerel `tablet` / `internal` paketi. Kaynak `1f1b505b9b8e9d8491554f22c1ff194142956a32`, TestFlight 26 ile aynı commit. Uygulama kodu, veri veya yetki değişmedi; bulut build kaydı taklit edilmedi.
- EAS uzaktaki build numarası 26; otomatik artırma kapalı. IPA `com.enescevik.gina`, 0.1.0 (26), imza geçerli.
- Gömülü Ad Hoc profilinde önceki çalışan tablet paketiyle **aynı tek kayıtlı cihaz** var. Yeni cihaz yetkilendirilmedi; UDID/anahtar bu rapora yazılmadı. Profil bitişi 31 Ekim 2027.
- iPhone/iPad cihaz aileleri, dört iPad yönü ve doğru üretim Supabase/web adresleri doğrulandı. Görev düzenleme/geçmiş/yenilenme ve veli gelen kutusu işaretleri iki pakette de mevcut.
- Store ve Ad Hoc paketleri aynı kaynaktan ayrı derlemelerdir; JavaScript dosyaları byte düzeyinde aynı değildir. Raporda bu alan `false` bırakıldı; bit düzeyinde aynı paket iddia edilmez.
- EAS Hosting önizlemesinden ve canlı `tablet` alias'ından indirilen IPA'nın SHA-256 değeri yerel doğrulanmış paketle aynı. Canlı sayfa, yayın kaydı ve manifest tam içerik eşleşmesiyle kontrol edildi.
- Son dağıtım `sbfnt5ls4x`. Önceki sürüm 20'nin yayın kaydı saklandı; önceki dağıtım `rsu5vouy3l` idi. Ana web uygulamasının yayını değiştirilmedi.
- Manifest bir saat önbelleklenebildiği için yeni düğme `manifest-26.plist` kullanıyor. Paket URL'si `gina-26.ipa`. İlk alias değişiminde kısa yayılım gecikmesi görüldü; son canlı okuma doğrulandı.

**Sınır:** Fiziksel iPad'de son kurulum ve açılış bu turda yapılmadı. Kullanıcı iOS kurulum onayını vermeli; yayın başarısı cihazda kurulumun tamamlandığı anlamına gelmez. TestFlight 26 yayını ayrı olarak tamamlanmıştır.
