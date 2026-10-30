# Veli · Günlük — v5 tasarım teslimi

**31 Ekim 2026:** Ürün sahibinin v5 onayı ve “devam edelim, yayına geçmek istiyorum” kararıyla giydirme aşamasına geçildi. Tasarım PR’ları main’de; üretim kaplamaları ve native entegrasyon henüz tamamlanmadı. Güncel karar ve işler: [TestFlight kontrol listesi](../../../release/TESTFLIGHT.md). Önceki v4 GLB/model/animasyonları reddedilmiş olarak kalır.

- 8 ana görünüm; telefon 390×844.
- Her ekran için normal, boş/başlangıç, yükleniyor ve hata PNG’si; üç durum birlikte `*-states.png`.
- Uzun formlar kaydırılır. `*-part-2.png` vb. görüntüler aynı ekranın devamıdır; alan silinmedi.
- Türkçe metin HTML arayüz katmanında; sanat plakalarında yazı/rakam yok. Sahne plakaları yalnız **referans maketi** içindir; uygulamada tek resmin üstüne görünmez hitbox koyulmayacak.
- Veriler tasarım örnekleridir (Ece/Can ve bilinen demo bağlamı). Canlı veritabanından çekilmiş sonuç iddiası yok. Alanlar ve akışlar `route-map.json` ile mevcut route kaynaklarına eşlendi.
- Sunum kodu, `apps/mobile/assets`, i18n, sorgu, mutasyon, auth, routing, RPC ve `supabase/` değiştirilmedi. Paket eklenmedi.

## Görsel kararlar

Ahşap/krem/teal, Baloo 2 başlıklar ve Nunito gövde; yumuşak malzeme ayrımı; boyalı mevcut avatar, görev, ders, etkinlik ve koleksiyon sanatları. Çocukta oda, pano, masa ve raflar tek mekân olarak okunur. Veli formları ferah kâğıt yüzeylerde sürer. Çocuk bottom-nav yok; büyük içerik doğal kaydırma ile devam eder. Referansta animasyon yanılsaması veya büyütülen pet yok; gerçek rig/animasyon üretimi bu PNG tesliminin kapsamı değildir.

## Gerçek uygulama karşılaştırması

30 Ekimdeki **Database error querying schema** hatası 31 Ekimde Docker disk alanı açılıp Postgres/Realtime yeniden başlatılarak çözüldü. Veli ve çocuk PIN girişi doğrulandı; güncel ana ekran kanıtları [yayın kontrol listesinde](../../../release/TESTFLIGHT.md). Veritabanı resetlenmedi, seed/migration çalıştırılmadı; önceki hata görüntüsü tarihsel kanıttır. Bu grubun bütün alt ekranları ve gerçek cihaz karşılaştırmaları hâlâ giydirme PR’ında tamamlanmalı.

## Claude için

1. Onaylı v5 düzeniyle bu grubun üretim parçalarını ve giydirmesini hazırla. Tasarım PR’ı uygulama PR’ından ayrı tutulur; gerçek uygulama kabulü ayrıca yapılır.
2. Onaydan sonra gereken art/skin parçalarını `room-chrome` 9-slice (`capInsets`, `contentInsets` @3x, `minimumLogicalSize`) ve `rooms/v2` içerik sınırı/ortak ayak çizgisi sözleşmesine göre ayrı asset olarak teslim et. Bu maket plakasını production arka plan/hitbox çözümü yapma.
3. Mevcut NineSlice, SkinPressable, SkinProgress, TaskIcon, SubjectIcon, EventIcon ve Collectible bileşenleri korunacak. Metinler tr/en i18n, en az 48 dp hedef, safe area, büyük yazıda reflow ve iOS/Android/web doğrulaması uygulama PR’ında yapılacak.
4. Mevcut davranışlar ve erişim kısıtları korunur. PIN, yıldız/rozet verme, Prova deneme başlatma/puanlama, oda tercihi kalıcılığı ve mağaza işlemleri makette gerçek çalışmaz. Yeni veri/RPC gereksinimi kodlanmadan ayrı istek olarak açıklanır.
5. Demo oturumu artık erişilebilir. Gerçek ekran yan yana karşılaştırmalarını tamamla; ekran görüntüsü almak için görev, ödül veya Prova kaydı değiştirme.

## Dosyalar ve kontrol

`manifest.json` tam dosya listesi, `render-report.json` ekran bazında tarayıcı kontrolü, `route-map.json` kaynak eşlemesi. `reference-v5.html?screen=<slug>&device=phone&state=normal` kaydırılabilir maket kaynağıdır; backend bağlantısı yoktur.
