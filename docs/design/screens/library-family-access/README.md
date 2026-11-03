# Aile kütüphanesi → birleşik Prova

3 Kasım 2026. Mevcut kütüphane ekranı, onaylı ortak ParentScreen/BuilderChoice/Button bileşenleriyle genişletildi. Ayrı onaylı maketi olmayan ekranlara ortak tasarımın uyarlanması izni esas alındı; yeni bir maket onayı veya piksel eşitliği iddiası yoktur.

## Davranış

Prova taslağındaki sınıf ve dersler katalog kapsamını belirler. Ortak metin/görsele bağlı sorular tek bir grup, bağımsız sorular ayrı seçeneklerdir. Birden fazla seçimde toplam soru ve kullanılacak hak gösterilir. Sunucu aile üyeliği, paket, güncel yayın/inceleme, sınıf/ders, çocuk sınıfı, taslak durumu ve kotayı tekrar denetler. Seçim, aileye kopyalama, hak tüketimi ve taslağa ekleme tek işlemde tamamlanır.

Aynı aile daha önce aldığı soruyu tekrar kullanırken hak tüketmez. İşlem kimliği cihazda gönderimden önce saklanır. Bağlantı kesilirse ekran yeniden açıldığında aynı işlem açık eylemle sorgulanır; yeni işlem kimliğiyle otomatik tekrar yapılmaz. Eski koleksiyon ve yeni paket aynı aylık/ek hak hesabını kullanır.

Ortak kaynak başlığı, metni, görseli, soruların sırası ve öğretmen cevapları korunur. Gerekli görseller yayın sırasında hazırlanmış PNG baytlarından sunulur; aile yüklemeleri özel Storage akışını kullanmaya devam eder. Çocuk erişimi mevcut atanmış soru kontrolünden geçer. AI görüntü kullanımı mevcut ayrıca rıza kontrolünden geçer. Öğretmen rubriği kopyada korunur; bu artım rubriğe özel yeni puanlama arayüzü eklemez.

## Görsel kanıt

Gerçek Expo web ekranı, **sentetik API** yanıtlarıyla:

- [Telefon 390×844](phone.png)
- [Tablet 1280×800](tablet.png)
- [Dikey tablet 834×1194](portrait-tablet.png)
- [Boş kapsam](empty.png), [bağlantı hatası](error.png)

Seçim görselleri sayfa kaydırılarak işlem alanında alınmıştır; üst başlık ekran dışında kalabilir. Sabit gezinme başlığı korunur. Kaynak: `qa-fixture.cjs`; gerçek aile veya çocuk verisi içermez. Yerel Expo 8098, yalnız süreç ortamında `https://ginaqa.supabase.co` sentetik bağlantısı kullanır.

10 tarayıcı kontrolü: çoklu seçim toplamı; üç boyutta seçim genişliği; sayfa yeniden açıldıktan sonra kayıp yanıtın aynı UUID ile kurtarılması; sahip olunan grubun sıfır maliyeti; yetersiz hakta eylemin kapanması; abonelik kilidi; boş/hata durumları. Bunlar fiziksel iPhone/iPad, VoiceOver, üretim API veya native PDF kabul testi değildir.

## Sunucu ve yayın sınırı

Migration: `20261103050000_library_family_access.sql`. Önce migration, sonra `learning-source`, `prova-grade`, `prova-review` Edge kodu ve mobil sürüm yayımlanmalı. Bu artım **üretime dağıtılmadı**, `library_packages.enabled` açılmadı; pilot sorular yayımlanmadı. Güncel TestFlight hâlâ 17'dir.

Ortak kaynak birimi en fazla 12 soru; metin en fazla 6000, başlık 160 karakterdir. Bu sınırı aşan paket birimleri edinimde açık hata verir ve hak tüketmez. Editör paket hazırlarken bu sınırları doğrulamalıdır. Sonraki kapsam: gerçek alan editörü incelemesi, geri kalan sınıf/ders havuzu, üretim uçtan uca kabulü ve fiziksel cihaz testleri.

## Doğrulama kaydı

- Temiz, ayrı `gina_prova_builder_audit` kopyasına yeni migration bütünüyle uygulandı; 43 SQL dosyasında 1042 kontrol geçti (bu artımda 36 yeni kontrol).
- Üç gerçek eşzamanlı SQL denemesi: aynı işlem kimliği, farklı kimliklerle aynı birim, eski katalog/yeni paket ortak kota yarışı. Üçü de geçti.
- Workspace tip/lint denetimi, 81 core testi; ilgili üç Edge giriş noktasının tip denetimi ve 17 medya/defter render testi geçti.
- Normal yerel veritabanı, demo hesapları ve üretim verileri değiştirilmedi. Testler ayrı geçici veritabanlarında çalıştı.
