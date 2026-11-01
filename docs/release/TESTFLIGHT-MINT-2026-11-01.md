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

## Gönderim sonucu

- **0.1.0 (9)** Apple tarafından işlendi: `VALID`, iç test durumu `IN_BETA_TESTING`, expired=false.
- [EAS build](https://expo.dev/accounts/enescevik/projects/gina-aile/builds/b1e8f306-385e-4ee5-afd5-6d222c6d49d3)
- [EAS gönderimi](https://expo.dev/accounts/enescevik/projects/gina-aile/submissions/375f5838-2113-41e8-8914-200cbb0ec9d6)
- [App Store Connect / TestFlight](https://appstoreconnect.apple.com/apps/6829083239/testflight/ios)
- Derlenen kaynak commit: `1ecc303349fe263769ecf85d7377b8ed049af76a` (`codex/child-home-mint`).
- Production iOS export'u ve bulut imzalı derleme başarılı.
- Test açıklamasını EAS üzerinden ekleme denemesi plan kısıtı nedeniyle gönderim oluşturulmadan reddedildi; açıklamasız tekrar gönderim başarıyla tamamlandı. Ücretli plan değişikliği yapılmadı.
- Bu bir iç TestFlight beta yayınıdır; herkese açık mağaza yayını yapılmadı. App Store mağaza ekran görüntüleri bu teslimde değiştirilmedi.

TestFlight uygulamasında Gina Aile → Güncelle → 0.1.0 (9). Yeni ikon/açılış ekranı, ebeveyn ana ekranı, çocuk odası, telefon yön değişimi, görev tamamlama, PIN ile çıkış ve takvim geçişleri fiziksel cihazda denenmeli.
