# Mint ana ekranlar ve yeni uygulama ikonu — 1 Kasım 2026

Hedef: mevcut Gina Aile uygulamasına yeni TestFlight beta derlemesi. Herkese açık App Store yayını bu teslimin kapsamı değildir.

## İçerik

- Onaylı mint/mor marka: açık, koyu ve tinted iOS ikonları; yeni yatay logolu açılış ekranı.
- Yeni ebeveyn ana ekranı ve resim temelli çocuk odası. Çocuk ana ekranı telefon dikey/yatay ve tablet yatay düzeni destekler.
- Ana ekranlardaki gerçek görev, onay, yıldız ve hedef akışları korunur. Diğer ekranların görsel dönüşümü sonraki aşamadır.
- Maskot sabittir; yeni oda görseline canlı hava, pet seçimi ve eşya düzenleme henüz yansıtılmaz.
- İkon dosyaları imagegen üretiminden gelir; onaylı raster kaynağa göre küçük kontur farkları teslim notunda belgelenmiştir.

## Doğrulama

- TypeScript ve Expo lint geçti.
- Önceki ana ekran teslimlerinde ebeveyn için 13, çocuk için 17 izole web akış kontrolü geçti; gerçek veritabanı değiştirilmedi.
- Üç iOS ikonu 1024×1024, opak, sRGB; teslim manifestindeki SHA-256 değerleri doğrulandı.
- EAS production ortamı çekilip sırlar yazdırılmadan kontrol edildi. Üretim Auth sağlık uç noktası HTTP 200 yanıtladı.
- Gizlilik/abonelik yayın adresi hâlâ eksik. Bu ve fiziksel cihaz kabulü mağaza hazırlığında açık iş olarak kalır.

Derleme/gönderim sonucu aşağıya eklenecek. App Store mağaza ekran görüntülerinin güncellendiği iddia edilmez.
