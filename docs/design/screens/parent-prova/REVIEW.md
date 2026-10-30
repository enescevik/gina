# Veli · Prova — v5 tasarım teslimi

Ürün sahibinin “bu güzel, tüm ekranları yap bu şekilde” mesajıyla **art-direction-v5 görsel dili onaylandı**. Bu grubun ekran düzenleri, üretim kaplamaları ve uygulama entegrasyonu ayrıca onay bekliyor. Önceki v4 GLB/model/animasyonları onaylanmış sayılmaz.

- 10 ana görünüm; telefon 390×844.
- Her ekran için normal, boş/başlangıç, yükleniyor ve hata PNG’si; üç durum birlikte `*-states.png`.
- Uzun formlar kaydırılır. `*-part-2.png` vb. görüntüler aynı ekranın devamıdır; alan silinmedi.
- Türkçe metin HTML arayüz katmanında; sanat plakalarında yazı/rakam yok. Sahne plakaları yalnız **referans maketi** içindir; uygulamada tek resmin üstüne görünmez hitbox koyulmayacak.
- Veriler tasarım örnekleridir (Ece/Can ve bilinen demo bağlamı). Canlı veritabanından çekilmiş sonuç iddiası yok. Alanlar ve akışlar `route-map.json` ile mevcut route kaynaklarına eşlendi.
- Sunum kodu, `apps/mobile/assets`, i18n, sorgu, mutasyon, auth, routing, RPC ve `supabase/` değiştirilmedi. Paket eklenmedi.

## Görsel kararlar

Ahşap/krem/teal, Baloo 2 başlıklar ve Nunito gövde; yumuşak malzeme ayrımı; boyalı mevcut avatar, görev, ders, etkinlik ve koleksiyon sanatları. Çocukta oda, pano, masa ve raflar tek mekân olarak okunur. Veli formları ferah kâğıt yüzeylerde sürer. Çocuk bottom-nav yok; büyük içerik doğal kaydırma ile devam eder. Referansta animasyon yanılsaması veya büyütülen pet yok; gerçek rig/animasyon üretimi bu PNG tesliminin kapsamı değildir.

## Gerçek uygulama karşılaştırması

30 Ekim 2026 yeniden denendi: `http://localhost:8081/sign-in` açıldı; demo hesabı girişinde **Database error querying schema** alındı. Veritabanı değiştirilmedi, sıfırlanmadı, seed çalıştırılmadı. `../shared-v5/evidence/demo-schema-error.png` gerçek uygulama kanıtıdır. Oturum gerektiren ekranlar için gerçek karşılaştırma eksik; maketler “uygulama ekranı” diye sunulmadı. Hesap grubunda erişilebilen giriş ekranı ayrıca yan yana verilir.

## Claude için

1. Ekran düzeni onayından önce bu grubu uygulamaya giydirme. Tasarım PR’ı uygulama PR’ından ayrı tutulur.
2. Onaydan sonra gereken art/skin parçalarını `room-chrome` 9-slice (`capInsets`, `contentInsets` @3x, `minimumLogicalSize`) ve `rooms/v2` içerik sınırı/ortak ayak çizgisi sözleşmesine göre ayrı asset olarak teslim et. Bu maket plakasını production arka plan/hitbox çözümü yapma.
3. Mevcut NineSlice, SkinPressable, SkinProgress, TaskIcon, SubjectIcon, EventIcon ve Collectible bileşenleri korunacak. Metinler tr/en i18n, en az 48 dp hedef, safe area, büyük yazıda reflow ve iOS/Android/web doğrulaması uygulama PR’ında yapılacak.
4. Mevcut davranışlar ve erişim kısıtları korunur. PIN, yıldız/rozet verme, Prova deneme başlatma/puanlama, oda tercihi kalıcılığı ve mağaza işlemleri makette gerçek çalışmaz. Yeni veri/RPC gereksinimi kodlanmadan ayrı istek olarak açıklanır.
5. Demo auth şema sorununu ayrıca incele; bu sanat işinde veritabanına müdahale edilmedi. Gerçek ekran yan yana karşılaştırmaları oturum erişimiyle tamamlanmalı.

## Dosyalar ve kontrol

`manifest.json` tam dosya listesi, `render-report.json` ekran bazında tarayıcı kontrolü, `route-map.json` kaynak eşlemesi. `reference-v5.html?screen=<slug>&device=phone&state=normal` kaydırılabilir maket kaynağıdır; backend bağlantısı yoktur.
