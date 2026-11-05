# Deneyim akışları ve görev geçmişi yayını — 5 Kasım 2026

Kaynak `1f1b505b9b8e9d8491554f22c1ff194142956a32`, main birleştirmesi `17e106050172a98f3fd897d156f01b48e8eb045e` ([PR #143](https://github.com/enescevik/gina/pull/143)). İki commit aynı dosya ağacına sahiptir.

## Kapsam

- Prova taslaklarını kaldırma/geri alma, aile kapsamı ve taslak koruması.
- Çocuk eğitim dönemi/okul değişikliği, profil arşivi ve geçmişin korunması.
- Yönetimde eğitim takvimleri, okul bildirimleri ve hedefli veli duyuruları; velide gelen kutusu.
- Döneme göre gelişim/okul puanları; puan düzeltme, geçmiş, kaldırma ve geri alma.
- Görev rutini düzenleme, önce/sonra karşılaştırması, geçmiş, duraklatma ve arşiv/geri alma. Gönderilmiş görevde o gönderimin adı/ikonu/yıldızı kullanılır.

## Yayın sırası ve kanıt

1. `public` ve `gina` şeması/verisi için erişimi sınırlı yerel yedek alındı. Bu, Auth/Storage dahil tam felaket kurtarma yedeği değildir; geri dönüş tatbikatı yapılmadı. Veri dökümünde döngüsel yabancı anahtar uyarıları vardır; geri yükleme sırası/trigger yönetimi gerekir.
2. Üretime sekiz migration uygulandı: `20261105030000`, `20261105040000`, `20261105050000`, `20261105060000`, `20261105061000`, `20261105070000`, `20261105071000`, `20261105072000`.
3. `prova-grade`, `prova-plan`, `prova-review`, `timetable-import`, `ai-weekly-summary`, `learning-plan-import`, `prova-generate`, `push-send` dağıtıldı.
4. PR main'e birleştirildi. Main CI ve güvenlik incelemesi başarılı. GitHub yayın işleri eksik yayın anahtarları nedeniyle **atlandı**; yayın başarısı sayılmadı. Gerçek web/yönetim yayını mevcut yetkili yerel Wrangler oturumuyla yapıldı.
5. Web: https://gina-web.pages.dev — dağıtım https://e6f5362c.gina-web.pages.dev. Altı sayfa ve beş JavaScript dosyasının canlı içeriği üretilen dosyalarla hash düzeyinde aynı.
6. Yönetim: https://gina-backoffice.pages.dev — dağıtım https://6a1b070c.gina-backoffice.pages.dev. Ana adres ve bu gerçek önizlemede toplam 12 yol doğru `gina-family` Access kapısına yönleniyor. Bu yayında yönetici olarak giriş/yazma akışı yeniden denenmedi.
7. iOS 0.1.0 (26): derleme/yükleme sonucu `release.json` ile tamamlanacak.

## Doğrulama ve sınırlar

- Paket geliştirme kanıtı: 2.419 SQL kontrolü, 257 core testi, 149 Auth/REST/Realtime kontrolü, 4 yarış durumu, 9 telefon/tablet web akışı. Önceki alt paket kanıtları kendi raporlarında.
- Canlı giriş ekranında telefon/tablet: taşma, çalıştırma hatası, giriş düğmesine kaydırarak ulaşma ve oturumsuz veli alanı yönlendirmesi için 6 kontrol geçti.
- Canlı veritabanında 10 salt okunur yapı/yetki kontrolü geçti. Başta şema kullanım iznini yasak sayan kontrol düzeltildi: `gina` şemasına kullanım izni mevcut tasarımın parçasıdır; özel geçmiş tablosunun doğrudan okuma/yazma izinleri kapalı olduğu doğrulandı.
- 19 Edge giriş sınırı denemesinde 18 istek 4xx ile reddedildi. `google-rtdn` mevcut eksik Google bildirim yapılandırması nedeniyle 503 verdi; bu kanal hazır sayılmaz. Gerçek AI üretimi, ödeme veya bildirim gönderimi bu denemelerde yapılmadı.
- Eğitim hatırlatmaları varsayılan kapalı kaldı. Gerçek velilere test duyurusu gönderilmedi; aile kayıtları sıfırlanmadı.
- Expo Doctor 19/20: mevcut `newArchEnabled` alanı SDK 58 şemasınca artık tanınmıyor; bu alan derlemeyi engellemedi. Bu kontrol tamamen geçti diye raporlanmaz. Derlenen uygulamanın imzası, iPhone/iPad desteği, dört iPad yönü ve üretim adresleri ayrıca doğrulandı. Sonraki bakımda eski alan kaldırılacak.
- Fiziksel iPhone/iPad/Android, Apple Pencil ve ekran okuyucu kabulü bu yayın sırasında yapılmadı. App Store herkese açık yayın başlatılmadı.

## Sonraki geliştirme

Ödül/özel not düzenleme geçmişi; yeni döneme seçerek görev/ödev taşıma; toplu içerik arşivi. Tam tarihli eski plan sürümleri ve kalıcı silmenin kapsamlı önizlemesi ayrıca açık. Kütüphane soru üretimi kullanıcının isteğiyle sona bırakılmıştır. Bu paket açık işleri bitmiş saymaz.
