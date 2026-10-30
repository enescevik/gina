## Güncel öncelik: BRIEF 13

Önce `references/preview-note.md`, `references/brief-13-montage.html`, `CODEX-BRIEF-13-birebir.md` ve dört güncel asset manifestini oku. Bu teslim önceki düz kaplamaların yerine boyalı üretim parçaları getirir. Aynı slug’ın manifest `file` kaynağını kullan; eski SVG fallback’i yeni PNG sanma. room-chrome 9-slice kaynak piksel @3x; rooms/v2 içerik sınırları ve ortak zemin ankrajları; bağımsız dört hayvan ve portreleri; tek dolap ve display-* sergi nesneleri; tüm avatarların resimli sürümleri yeni sözleşmedir. Native metin/etkileşimleri sen uygula. Yeni bir ana ekran yorumu tasarlama; onaylı referanslarla gerçek cihaz ekran görüntüsünü karşılaştır. Bu PR’de uygulama kodu değişmedi.

> **Odam kaplamaları teslim edildi:** Önce `references/preview-note.md` ve `packages/assets/room-chrome/manifest.json` dosyalarını oku. 30 SVG + @3x PNG kaplama ve `packages/assets/rooms/v2/` altında room-base + üç karakter üretim WebP’si var. Uygulamada bu üretim kaynaklarını kullan; eski art-candidates konsept olarak kalır. Metinler native; kaplamaları manifestteki 9-slice/contentInsets sözleşmesiyle bağla.

# Claude’a verilecek güncel uygulama talimatı — premium v3

Gina’da onaylanan oyun odası ana ekranını ve premium resimli koleksiyon dilini sürdür. Önce güncel main, `docs/DECISIONS.md`, `apps/mobile/AGENTS.md`, bu klasördeki `IMPLEMENTATION.md`, `ART-HANDOFF.md`, `PRODUCT-EXTENSIONS.md`, `ACCEPTANCE.md` ve kategori manifestlerini oku. Yerel değişiklikleri koru. Bu metin eski teslim promptlarının yerine geçer.

## Hazır olanı koru

İncelenen main: `3d81e4b`. Odam, Hazinem/Koleksiyonum veri katmanı, gerçek hedef bileti, ödül RPC’leri ve sergi rafı mevcut. `collectible.tsx` ile oyunlaştırma WebP’leri ve `scripts/generate-collectibles.mjs` ile mobil boyut türetimi bağlanmış. `20261030070000_badge_icons_v3.sql` Diş Parlatan görselini zaten düzeltiyor. Bunları yeniden kurma. Sonraki main değişikliklerini de incele.

Marka iki kemerli **Yan Yana**, kaynak `packages/assets/brand/yan-yana/`. Platform geçişi `8f81896` ile yapılmış; eski yıldız-tik logosuna dönme. Ödül yıldızı simetrik beş kollu ayrı bir sembol. Mevcut Baloo 2 başlık + Nunito gövde tipografisini koru. Eski Inter/Nunito önerileri ve eski lockfile engeli tarihsel kayıttır.

## Yeni sanat kaynakları

| Kategori | Kaynak dizin | Dosya |
| --- | --- | ---: |
| Görev | `packages/assets/icons/tasks/illustrated-v3/` | 66 WebP |
| Ders | `packages/assets/icons/subjects/illustrated-v3/` | 19 WebP |
| Etkinlik | `packages/assets/icons/events/illustrated-v3/` | 20 WebP |
| Oyunlaştırma | `packages/assets/gamification/illustrated-v3/` | 25 WebP |

Toplam 129 ayrı illüstrasyon, 130 WebP teslimi: yükleme sabit yıldızı mevcut dolu yıldızla aynı kaynağı kullanır. Her kategori `manifest.json`, `generation.json`, `README.md`, açık/koyu zeminli `contact-sheet.html` içerir. Manifest slug/path eşlemesini esas al. Dosya uydurma veya slug değiştirerek veritabanı kimliklerini kırma.

Sanat referansı `docs/design/icon-refresh-v3/concepts/collectibles-direction.webp`. Aynı klasördeki sekiz eski düz SVG taslak seçilen yön değildir. Eski SVG setleri geçiş uyumluluğudur; büyük görev kartı, ödül rafı ve koleksiyon için yeni WebP setini kullan. Küçük gezinme/aksiyon ikonlarında mevcut native SVG/Lucide devam eder. Resimli nesneler en az 64 dp, ayrıntılı rozetler tercihen 96 dp; 24 px’e küçültme. `Collectible` mevcut 48 dp alt sınırı ve çağrı boyutlarını bu ayrımla gözden geçir.

Kaynaklar yüksek çözünürlüklü, gerçek alfa kanallı lossless WebP’dir. Her kaynağı ekranda aynı anda yükleme. Mevcut türetim scriptini genişleterek kullanım boyutuna uygun 128/256/512 px çıktıları yalnız ihtiyaç kadar oluştur; alfa, oran ve içerik sınırlarını koru. Metro için statik eşleme, bilinmeyen slug için güvenli fallback kullan. Profil çıkararak paket/bellek boyutunu ölç; görsel kalitesini ölçmeden agresif sıkıştırma yapma. Görsellerde yazı yok; ad, puan, seri sayısı ve durum gerçek i18n metnidir.

Bu resimli katmanda onaylanan boyalı tonlama/doku, eski flat-only ve piksel başına exact palet kuralının açık istisnasıdır; ana renk aileleri ve ders/etkinlik vurguları korunur. PNG teslimi ekleme, bitmap’i SVG içine gömme. Native SVG’de text/style/filter/mask/gradient kullanma.

`gamification/illustrated-v3/animations.json`: 6 kutlama + 8 yükleme dönüşüm durumu; ayrı AI kareleri değil aynı taban görsel üzerinde native scale/rotate/opacity. Reduced motion sabit varlığı gösterir; sonsuz dekor döngüsü kurma. Bu JSON bir animasyon tarifi, uygulama entegrasyonu ayrıca doğrulanmalı.

## Ekranın davranışı

Onaylı ana ekranlar `references/child-home-approved.png` ve `parent-home-approved.png`. Çocuk ana ekranı oyun odası gibi kalır: görev panosu, hedef bileti, hafta takvimi ve raf/çekmece aynı sanat diliyle bütünleşir. Alt bottom-nav veya odayı örten bağımsız beyaz dashboard butonlarına dönme. İlk bakışta sıradaki görev, bekleyen onay, kazanılan yıldız ve hedefe kalan anlaşılır olsun.

Ekran resmini tek Image içine koyup üstüne koordinatla buton yapıştırma. Sanat, metin, veri ve erişilebilir kontroller ayrı katmanlar olmalı. Küçük telefon/büyük yazıda mobilya düzeni yeniden aksın; hitbox en az 48 dp, safe area ve ebeveyn çıkışı her zaman erişilebilir. Loading/empty/error/offline/returned/pending/approved durumları gerçek veriyle ayrışsın.

Karakter tercihi kız/erkek/belirtmeyen olabilir; zorunlu cinsiyet alanı veya seçime göre kilitlenen dekor olmasın. Her çocuk tüm karakter/oda seçeneklerini seçebilsin. `art-candidates` oda/karakter kaynakları hâlâ konsepttir; bu 130 dosyalık teslim onları üretim onaylı yapmaz. Üç oda aynı yerleşim ankrajlarını paylaşmalı.

Hazinem gerçek ödül envanteri: bilet çekmecede detay listesi, bisiklet/konsol gibi nesneler envanterde; odada en fazla üç seçili sergi nesnesi. İlk sürüm sabit yuvalar. Ayrı ödül odası/serbest sürükleme sonraki tasarım turu. Koleksiyonum kazanılmış rozetlerdir. Mevcut `dis-parlatan` 14 planlı bakım, `kitap-kurdu` 10 planlı bakım kuralını bu görsel teslim yüzünden değiştirme; eski 7 günlük öneriyi uygulama. Fırçalama süresi yarışı, leaderboard, loot box veya kayıp korkusu yaratan seri baskısı ekleme.

Özel günler gelecekte ayrı dekor katmanı: Yeni Yıl, yerel kurtuluş günü, Ramazan Bayramı vb. Aile tercihi/konum/tarih kaynaklarıyla açılıp kapanır; dini tercih çıkarımı yapma, bayramı sabit Gregoryen güne kodlama. Dekor görev okunurluğunu veya dokunma alanlarını kapatamaz.

## Şimdi nasıl devam et

1. Güncel kodda hazır ve eksik olanı kısa listele. Oyunlaştırma entegrasyonunu koru; 66 görev, 19 ders ve 20 etkinliğin manifestlerinden statik görsel eşlemelerini mevcut bileşenlere ekle. Küçük ikon ve büyük resim kullanımını ayır.
2. Çocuk ve ebeveyn ana ekranında yeni varlıkları gerçek cihaz boyutları, büyük yazı, açık/koyu zemin ve uzun i18n metinle göster. Ana ekranı birlikte gözden geçirdikten sonra alt ekranların sanat düzenini ele al.
3. Auth/child JWT, parent PIN, plan yetkileri, realtime, Prova ve Haftam/AI altyapısını koru. complete_task/review_task, ledger ve reward RPC’lerini yeniden yazma; istemcide yıldız/rozet verme. Aile saat dilimi, onay gecikmesi, idempotency ve returned yeniden gönderme davranışlarının mevcut testlerini koru.
4. Etkilenen lint/typecheck/test ve görsel senaryoları çalıştır; veri kuralı değişirse gerçek RLS/RPC testini ekle. Görsel bağlantısı için gereksiz schema migration üretme. Yapılmış işleri yeniden “eksik” sayma; görülmeyen cihaz davranışını doğrulanmış diye sunma.

Codex bu teslimde sadece asset ve tasarım belgelerini değiştirdi; uygulama entegrasyonu Claude tarafında devam eder. Hesap/anahtar/TestFlight işleri ayrı `OWNER-SETUP.md` kapsamındadır; gizli anahtarları isteme veya repoya yazma.
