# Gina resimli v3

Kullanıcının onayladığı koleksiyon illüstrasyonu yönünde ayrı şeffaf WebP varlıkları. Her dosyanın boyutu, alfa içerik sınırı, kullanım boyutu ve checksum bilgisi manifest.json içinde; gerçek üretim promptları generation.json içinde.

`contact-sheet.html` dosyasını bir yerel HTTP sunucusunda açarak tüm görselleri açık/koyu zeminde incele. SVG içine resim gömülmediği için resimli setin contact-sheet'i HTML'dir. PNG teslimi yok. Raster piksel tonları exact eski SVG paleti değildir; onaylanan boyalı renk ailelerini kullanır.

Yalnız gerekli görselleri yükle; bütün atlası başlangıçta decode etme. Aspect ratio korunur, contain kullanılır; alfa sınırları optik hizalama için metadata sağlar. Telefon ve tablet üzerinde kenar/performans/kontrast testi Claude entegrasyonunda yapılmalı. 24 px durum simgesi için bu ayrıntılı görseli küçültmek yerine native sade simge ve erişilebilir metin kullan. Ödül yıldızı Yan Yana logosu değildir.

Önceki SVG dosyaları uyumluluk için korunur; yeni resimli görsellerin mono varyantı diye sunulmaz. Bu PR uygulama kaynaklarını ve apps/mobile/assets dizinini değiştirmez.
