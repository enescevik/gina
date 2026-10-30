# Claude’a son tasarım notu — v5

Gina’da görsel yön değişti ve ürün sahibi v5’i “bu güzel, tüm ekranları yap bu şekilde” diyerek onayladı. Esas referans `docs/design/screens/child/art-direction-v5/`; v4 prosedürel 3D modeller ve yapay büyüme/esneme animasyonları reddedildi, onları üretime taşıma.

Yeni ekran maketleri dört grup hâlinde hazır:

1. `docs/design/screens/child/`: brief’teki 8 alt ekran + oda ana ekranı ve profil seçimi; 390×844 telefon ve 1280×800 tablet.
2. `docs/design/screens/parent-daily/`: 7 günlük alt ekran + veli ana ekranı.
3. `docs/design/screens/parent-prova/`: Prova’nın 10 ekranı.
4. `docs/design/screens/account/`: giriş, aile, eşleştirme, bildirim, paylaşım, paket ve öğretmen raporu.

Her klasörde `index.html`, `contact-sheet.png`, ekran PNG’leri, durum sayfaları, devam görüntüleri, `manifest.json`, `route-map.json`, `render-report.json` ve `REVIEW.md` var. Ortak inceleme girişi `docs/design/screens/shared-v5/index.html`. HTML dosyaları **maket üretimi ve inceleme kaynağı**; uygulama mimarisi kararı değildir.

**Görsel dil onaylandı; bu yeni ekran düzenleri henüz grup bazında onaylanmadı.** Ürün sahibi ilgili grubun maketlerini onaylamadan uygulama koduna geçme. Tasarım ve giydirme PR’larını ayrı tut.

Onay sonrası giydirme:

- Çocukta pano/masa/raf arayüzün fiziksel parçası; oda arkasıyla uyumlu ölçek ve ışık. Krem kâğıt, gerçek ahşap hissi, teal vurgu; Baloo 2 başlık ve Nunito gövde. Veli alanları aynı dilde sakin ve hızlı okunur.
- Maket sahne plakalarını tek resim olarak koyup görünmez buton ekleme. Gereken parçalar ayrı, metinsiz üretim asset’i olmalı; room-chrome 9-slice sözleşmesi (`capInsets`/`contentInsets` @3x, `minimumLogicalSize`, aynı geometride pressed/disabled) ve rooms/v2 içerik/ayak çizgisi sözleşmesi korunmalı. Yeni plakalar henüz bu üretim seti değildir.
- Karakter, oda ve pet seçimi serbest. Kız/erkek/belirtmeyen seçimi zorunlu renk veya oda stereotipine bağlanmaz. Kedi, köpek, maymun, aslan yavrusu ve petsiz seçenek korunur.
- Ödüller/rozetler raftaki nesneler olarak görünür; bütün katalog ve kazanım mantığı mevcut backend’den gelir. İstemcide yıldız/rozet üretme. Fiziksel ödül yerleştirme/envanter veya yeni oda durumları veri değişikliği gerektirirse önce ayrı iş olarak tanımla.
- Gündüz/gün batımı/karlı gece görselleri sanat hedefidir. Gerçek zamanlı gün doğumu/gece, yağmur/kar/rüzgâr ve doğal pet animasyonu için ayrı sahne/rig/ışık üretimi ve kalite kabulü gerekir. Bu statik paket gerçek 3D/animasyon teslimi değildir. Çocuğun konumunu sessizce toplama; hava/konum kaynağı ve izin akışı ayrı ürün kararıdır. Reduced-motion ve sessiz varsayılan korunmalı.
- NineSlice, SkinPressable, SkinProgress, TaskIcon, SubjectIcon, EventIcon ve Collectible kullanılacak. JSX/stil/görsel dışında veri sorgusu, mutasyon, RPC, realtime, auth, routing ve supabase değişmeyecek. Yeni paket ekleme.
- Yeni Türkçe metinler i18n tr/en anahtarlarına taşınır; var olan anahtarlar silinmez. En az 48 dp dokunma alanı, büyük yazıda yeniden akış, safe area, iOS/Android/web. Çocukta bottom-nav yok. Uzun formlardaki bütün alanlar ve mevcut seçim seçenekleri korunur.
- Örnek sayılar ve tarihler maket verisidir. Abonelik özellikleri mevcut plans migration’ından; fiyat uydurulmadı. Gerçek fiyat mağaza offer.displayPrice’dan gelir. Webde satın alma düğmesi gösterme; öğretmen raporuna düzenleme yetkisi ekleme.

30 Ekim kontrolünde localhost:8081 açıldı fakat verilen demo hesabı “Database error querying schema” ile giriş yapamadı. Veritabanı değiştirilmedi/resetlenmedi/seedlenmedi. Kanıt `shared-v5/evidence/demo-schema-error.png`. Giriş ekranı dışındaki gerçek uygulama karşılaştırmaları eksik; auth sorunu ayrı ele alınmalı. Prova route’una girerek deneme başlatmak gibi kayıt değiştiren işlemler ekran görüntüsü almak için kullanılmadı.

Her uygulama PR’ından önce: `cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec expo lint`; sonra gerçek cihaz/web görüntülerini onaylı maketle yan yana ekle. Tasarım paketinin derlenmesi, native uygulamanın bu görünüme ulaştığı anlamına gelmez.
