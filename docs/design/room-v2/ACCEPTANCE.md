# Kabul senaryoları

- Çocuk ilk bakışta sıradaki görevi, tamamlanan/toplamı, bekleyen onayı, yıldız bakiyesini ve hedefe kalanı ayırt eder. 5/7 ise progress=5/7; hafta çizimi takvim verisine bağlıdır.
- Boş görev, tümü bitti, yalnız bekleyen, iade edilmiş, ağ hatası, offline, yükleme ve hedef yok durumları yerleşimi bozmaz. Sunucu onayı olmayan yıldız harcanmaz.
- İki çocuk, iki aile, anonim tablet ve ebeveyn çocuk modu test edilir. Diğer ailenin ödül/rozet/PIN kaydı erişilemez. Parent PIN ekranında çıkış koruması atlanamaz.
- Aynı görev çift dokunuşu ve aynı client_id ile retry tek sonuç verir. Eşzamanlı iki ödül talebi eksi bakiye/çift debit yaratmaz. Onay, iptal ve refund idempotenttir.
- Aile saat diliminde gece yarısı, planlanmamış gün, geç onay, returned yeniden gönderme, geçmiş plan değişimi ve seri backfill kontrol edilir.
- Türkçe/İngilizce uzun adlar, büyük yazı, VoiceOver/TalkBack, klavye/focus, reduced-motion, tablet yatay/dikey ve ebeveyn telefonu denenir. Dokunma alanı ≥48 dp.
- Karakter/oda tercihi değişince görev/hitbox konumu sabit kalır. Kız/erkek/belirtmeyen seçimleri her temaya erişir; seçimsiz kullanım çalışır.
- Hazinem teslim edilmemiş ödülü elde edilmiş gerçek ürün gibi göstermez. Raf üç nesneyi aşmaz. Bilet kodları public/log/asset içinde bulunmaz.
- Sezon kapatılınca süs görünmez; yıl geçişi ve dinamik bayram tarihleri doğrulanır; yerel gün yanlış şehirden taşınmaz.
- SVG kaynakta text/style/filter/mask/gradient/clipPath/use/image/script ve dış bağlantı yok. PNG yalnız önceden tanımlanan brand/store ihracı; tasarım referansları runtime değildir.
- Onaylı ana ekran referansı ile ekran görüntülerini yan yana karşılaştır; beyaz dashboard/bottom-nav tasarımına geri dönme. Alt ekran mockup'larını kullanıcı görmeden onaylı sayma.
