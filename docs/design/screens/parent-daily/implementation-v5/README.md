# Veli günlük ekranları · v5 uygulama denetimi

31 Ekim 2026. Onaylı `../*-phone.png` maketleriyle aynı pencere illüstrasyonu, Nunito/Baloo, sıcak kâğıt kartlar, native metinler ve çizilmiş ikonlar kullanılır. İşlevler korunur; güncel veriye göre kart sayısı/uzunluğu değişir.

## Düzeltilenler

- Ana sayfa, görev, ödül, takvim, puan, not, aile menüsü ve çocuk modu girişinde ortak v5 düzeni.
- Yükleme, boş liste ve hata durumları ayrıldı; hata sonrası yeniden deneme var.
- Çocuk seçimleri boyalı avatarlarla, ikonlar mevcut illustrated setten; emoji yerine görev/ödül nesneleri.
- Onay ve ödül işlemlerinde çift dokunma engeli; başarısız güncelleme görünür.
- PIN kaydı sonrası çocuk modu önbelleği yenilenir. PIN girişleri yalnız rakam kabul eder.
- Silme/kaldırma için iki aşamalı native/web ortak kontrol.
- Gerçek tarih/saat ve puan aralığı kontrolü; aile saat diliminde yeni görev tarihi.
- En az 48 dp hedefler; büyük yazıda buton etiketleri sarılır.

## Kanıt ve sınırlar

`capture.js` her API isteğini yakalayan izole tarayıcı oturumunda sekiz ekranı üretir; demo veritabanına yazmaz. `layout-qa.json` eksik resim, yatay taşma ve küçük dokunma hedeflerini kaydeder. Ekran görüntüleri gerçek Expo web render'ıdır; mockup değildir. İmzalı iOS/Android cihaz kabulü bu kontrolün yerine geçmez.

`pnpm exec tsc --noEmit`, `pnpm exec expo lint` ve core testleri çalıştırıldı. Tarih testleri artık yıl/olanaksız gün/saat sınırlarını kapsar. Backend mock'ları üretim sunucusunun hazır olduğu anlamına gelmez.
