# Gina oyun sahnesi — yön önerisi ve gerçek 3D mekân çalışması

Durum: **öneri, ürün sahibi onayı bekleniyor**. Tablet v1/v2 reddedildi. Bu çalışma onların onayı veya BRIEF 14 ekran tesliminin tamamlanması değildir. Ana uygulama, paketler, veri katmanı ve üretim asset sözleşmeleri değiştirilmedi.

[Gerçek 3D modeli incele](viewer.html) · [Blender kaynağı](room-spatial-study.blend) · [Taşınabilir GLB](room-spatial-study.glb) · [Kapalı görünüm](room-spatial-study.png) · [Açık çekmece](room-spatial-study-open.png)

## Korunan oda mantığı — son kullanıcı düzeltmesi

3D teknik deneme ürünün odasını yeniden tanımlamaz. İlk 3D çalışma kitaplık, hafta takvimi ve çocuk/pet yerleşimini eksik gösterdi; bunlar kapsamdan çıkarılmadı. Onaylı çocuk ana ekranı kompozisyon referansı olmaya devam eder.

| Bölge | Korunan işlev | Bu çalışmadaki durum |
| --- | --- | --- |
| Sol pano | Görevler, ilerleme, onay | 3D yazısız yüzeyler mevcut; native içerik henüz yok |
| Orta pencere | Gün/gece, konuma bağlı hava | Gündüz/gece manuel renk/ışık denemesi var; canlı veri ve yağmur/kar yok |
| Pencere yanı kitaplık | Prova, eğlenerek öğrenme | 3D kitaplık ve kitaplar geri eklendi |
| Halının ortası | Seçilebilir çocuk karakteri | GLB/Blender ankrajı var; rigli model yok |
| Çocuğun solu | Kedi/köpek/maymun/aslan seçimi | Pet ankrajı ve dinlenme yeri var; rigli model yok |
| Sağ üst | Hedef bileti, hedefe kalan | 3D yüzey var; canlı bilgi henüz yok |
| Hedefin altı | Hafta takvimi | Yedi hücreli 3D yerleşim geri eklendi |
| Sağ alt | Rozetler ve kazanılan ödüller | Raf/dolap ve açılan çekmece mevcut |

İnceleme sayfasında onaylı referans ve eşleme birlikte gösterilir. Çocuk/pet konum işaretleri yalnız inceleme aracıdır, ürünün butonları değildir. Karakterler 2D kart olarak yeniden yapıştırılmadı; gerçek modellerin eksikliği açıkça gösterildi.

## Önerdiğim yön

Gerçek 3D nesneler + kontrollü kamera + dokunmaya dayalı 2.5D etkileşim. Buradaki 2.5D, resim parçalarını birbirine yapıştırmak anlamına gelmiyor: derinliği, nesne ilişkileri ve ışığı olan bir dünya; çocuğun kamerayı yönetmesi gerekmiyor. Kontrollü kamera telefon ve tablet için ayrı kadrajlar kullanır.

HTML önceki turun yerleşim maketiydi, mobil uygulamanın motoru değildi. Sorun dosya uzantısı kadar üretim yöntemindeydi: mobilyalar tek resimde, paneller ayrı koordinat sisteminde; aydınlatma ve perspektif ortak değildi. Animasyonda ise deforme olabilen model yerine iki resim ve scale kullanıldı. Bunlar final kalite için yeterli değil.

Bu yeni inceleme sayfası da tarayıcıda açılır; ancak içeriği DOM panelleri değil **gerçek GLB mesh'leri ve animasyon kanallarıdır**. Kamera çevrilebilir, çekmece ve kitap kendi pivotlarından hareket eder. Web görüntüleyici, uygulama motoru seçimi veya native performans kanıtı değildir.

## Bu turda gerçekten üretilen

Blender 5.0.1 ile yeniden üretilebilir sahne: mesh geometrileri, birbiriyle hizalı pano/masa, pencere, koltuk, gerçek raf gövdesi ve çekmece, halı, eğitim kitabı; iki ayrı nesne animasyonu (`drawer_open_close`, `book_open_close`). `.blend`, `.glb`, iki render ve kaynak üretim betiği birlikte teslim edilir. Panolar, mobilyalar ve ödül nesneleri aynı sahnede ışık alır ve birbirlerinin önüne/arkasına geçer.

Bu bir **mekân ve hareket altyapısı çalışmasıdır**. Final sanat, okunabilir UI, pet, karakter, canlı hava durumu, mobil çalıştırıcı veya tamamlanmış eğitim oyunu içermez. Basit kupa/kitap şekilleri mevcut ödül kataloğunun üretim sürümü değildir. Kamera orbiti inceleme için açık; çocuk arayüzünde serbest orbit önerilmiyor.

## Görsel düzenin kuralları

- Oda tek kompozisyon olarak tasarlanır. Her sonradan eklenen obje ortak ölçekte, ışıkta, perspektifte ve malzemede üretilir.
- Ana görünümde sıradaki görev + onay durumu + mevcut yıldız/hedefe kalan bilgisi az sayıda, aynı mimariye bağlı yüzeyde görünür. Bu çalışmadaki yüzeyler yazısız yer tutucudur.
- Tam görev listesi duvardaki küçük karta sıkıştırılmaz. Panoya dokununca kontrollü yakın kadraja geçilir; uzun metinlerin native, okunaklı düzeni bu kadraja bağlanır.
- Koleksiyon rafı gerçek gövde/raf/plaka parçalarından oluşur; objeler yüzeylere temas eder. Çekmece açılırken içindeki nesneler parent ilişkisinden dolayı birlikte hareket eder.
- Kitaplık eğitim bölümüne, takvim haftaya, pet halıdaki etkileşime bağlanır. Dekor, etkileşimli nesne gibi sahte işaret vermez.
- Dinamik metinler texture/PNG içine basılmaz. Native metin ve erişilebilir kontroller ortak camera-anchor dönüşümünü kullanır. Yazı yüzeyleri kameraya yeterince dönük tutulur; büyük yazıda yakın kadraj/native akış kullanılır.
- Telefon görünümü tüm odayı küçültmek değildir: kontrollü odak noktaları ve yeterli hit area. Tablet geniş sahneyi gösterir. Klavye, safe-area ve VoiceOver/TalkBack için native karşılık gerekir.

## Teknik tercih ve karar kapısı

| Yol | Gina için değerlendirme |
| --- | --- |
| **Blender → GLB → React Native Filament** | İlk test edeceğim aday. Mevcut Expo/React Native kabuğunu koruyarak gerçek 3D ve model animasyonu verir. Web için ayrı renderer adaptörü gerekir. Expo 58 / RN 0.88.1 üzerinde projeye özel uyumluluk ve gerçek cihaz profili henüz doğrulanmadı. |
| Rive ile rig edilmiş 2D/2.5D | Premium boyalı görünümü ve 2D eğitim etkileşimlerini korumak için güçlü alternatif. Bones/mesh deformasyonu destekler; modelin gerçek 3D uzayında dönmesiyle aynı şey değildir. Export ücretli plan gerektirir. |
| Unity çocuk dünyası + mevcut veli uygulaması | Daha karmaşık fizik/sahne/oyun ihtiyaçlarında değerlendirilebilir. Native gömme, yaşam döngüsü ve web build hattı ayrı iş getirir. Şu an tüm ürünü Unity'ye taşımayı önermiyorum. |
| React Three Fiber native | Bir web demosundan native üretim güvenilirliği çıkarılamaz. Yeni native paket kendi README'sinde kararsız/geçişte olduğunu söylüyor; alpha sürümü üretim temeli olarak seçmiyorum. |

Filament bir renderer ve animasyon altyapısıdır; eğitim oyunlarının içerik, kurallar ve erişilebilirlik sistemini kendiliğinden sağlamaz. İlk native teknik deneme geçmezse bu tercih kesinleşmez. Aynı GLB varlıkları alternatif motorda denenebilsin; ürün verisini renderer'a bağlamayalım. Bu tur yeni paket yüklenmedi.

## Pet neden yeniden üretilmeli?

PNG bedenin yalnız bir görünümünü içerir; gizlenen arka pati, ağız içi, göz kapağı veya dönünce görülecek yüzeyi vermez. Kalite için şu teslim gerekiyor:

- Stil onaylı tek kedi modeli; temiz topology, UV ve malzemeler; `.blend` kaynak + mobil GLB.
- Omurga/kalça/boyun/baş/çene/kulak/kuyruk ve dört bacak kontrolleri. Göz kırpma ve ağız şekilleri için blendshape veya uygun rig.
- Weight paint, patilerin yerle temasını koruyan kontroller, eklemlerde çökme/kesişme kontrolü. Modeli doğru rig etmek, yalnız kemik isimleri koymak değildir.
- Klipler: `sleep_loop`, `wake`, `yawn_stretch`, `idle`, `look_at_touch`, `play_tap`, `settle_sleep`. Klipler arasında yumuşak geçiş; hepsine tüm-nesne scale uygulanmaz.
- Esneme: önce uyanma/nefes alma, göz kısma, çenenin kontrollü açılması, omurganın uzaması, patilerin sabitlenmesi, kulak/kuyruk takibi, kapanış ve yatış. Ağzı açık tek kare kabul edilmez.
- Gerçek/licensed miyav, mırlama ve hareket sesleri. Sesler klibin olay işaretleriyle eşlenir, durum değişince rastgele çalınmaz. Kaynak dosyası ve kullanım lisansı teslim edilir.

İlk satın alınacak/üretilecek şey dört ayrı hayvan seti değil, **bir kedinin tam kaliteli rig + animasyon örneği** olmalı. Gerekirse bu iş için stylized character artist ve karakter animatörü gerekir; aynı kişi iki rolü üstlenebilir. AI görsel üretimi konsepti hızlandırır; tek başına doğru topology, skin weights ve kesintisiz animasyon garantilemez. Bu teslim hazır olunca diğer hayvanların bütçesi ölçülebilir.

## Uygulama ve eğitim bölümü için sınırlar

```text
Expo kabuk: hesap / yetki / i18n / navigasyon / erişilebilir native kontroller
          ↓ yalnız doğrulanmış görünüm durumu ve sahne komutları
Scene adapter: oda / nesne ankrajları / kamera / rig / ses / hava / lifecycle
          ↓ oyuncunun niyeti (task.open, drawer.open, lesson.open)
Mevcut uygulama use-case'leri; veri/yetki kontrolü burada kalır

Eğitim modülü: sürümlü içerik + etkileşim + değerlendirme sonucu
          ↓ tamamlanma önerisi, hiçbir istemci yıldız/rozet vermez
Claude'ın tasarlayacağı sunucu doğrulaması / mevcut ödül kuralları
```

Bu şema yeni RPC veya tablo varmış anlamına gelmez. İsimler teklif edilen sınırları gösterir; uygulama entegrasyonu yazılmadı. AI ile çocuk arasında sohbet kanalı açılmaz.

İlk eğitim örneği: kitap açılır → sayı miktarını temsil eden nesneler doğru yuvaya taşınır → doğru/yanlış için yumuşak görsel geri bildirim → çocuk kısa bölümün sonunu görür. Sürükleyemeyen çocuk için dokun-seç/dokun-bırak ve erişilebilir native alternatif. İçerik ile oyun kodu ayrıdır; TR/EN metinler ve öğrenme hedefi içerik dosyasında tutulur. Öğrenme sonucu ile oda kozmetiği ayrı durumdur.

## Hava / ses / dikkat

Gündüz/gece aile saat diliminden; hava tercihen velinin seçtiği şehirden gelen veriyle. Açık gökyüzü + sıcaklık gibi gereksiz ayrıntılar v1 hedefi değil. Konum/hava kaynağı ve önbellek sözleşmesini Claude tasarlar. Pencere dışındaki hava parçacıkları camın arkasında kalır; gece tek bir koyu filtre değil ışık düzeni değişimidir.

Arka planda render/animasyon/ses durur. Prova ve okuma sırasında pet dikkat istemez. Hareketi azalt, sessiz kullanım ve ses yoğunluğu tercihi olmalı. Peti beslemezsen üzülür gibi baskı mekanikleri eklenmez; odaya dönüş motivasyonu öğrenme ve sahiplenmedir.

## İlk kabul denemesi — bütün ekranları yeniden yapmadan önce

1. Tek oda + tek profesyonel kedi + çekmece + bir eğitim etkileşimi.
2. iPhone/iPad ve orta seviye fiziksel Android'de development build; web ayrı doğrulama. Repo SDK sürümlerini rastgele düşürme yok.
3. Uyanma → esneme → yatma kesintisiz; kamera yakınlaşmasında perspektif/anchor kayması yok. Patiler kaymaz, mesh kırılmaz, materyal değişmez. Ses klibe senkron.
4. Hedef: 60 fps; test cihazında sürdürülebilir değilse ayrıntı azaltılmış 30 fps modu. Bunlar **kabul hedefi**, ölçülmüş sonuç değil. 10 dakikalık kullanımda frame time, bellek eğilimi, termal davranış, arka plana girip çıkma ve yükleme süresi kaydedilir.
5. Native metin / 48 dp / büyük yazı / safe-area / reduced-motion / ekran okuyucu denemesi. 390×844 ve 1280×800 kadrajları ayrı kabul edilir.
6. Bu kalite örneği beğenilirse oda varyantları, diğer petler ve BRIEF 14 alt ekranları genişletilir. Mevcut tablet v2 uygulanmaz.

## Şu an gerekenler

Blender 5.0.1 bu Mac'te mevcut; yeni 3D yazılım satın almak gerekmiyor. En kritik açık, onaylı kalitede rig edilmiş kedi ve animasyon üretimi. Önce tek hayvan için örnek iş/teklif alınmalı; kişi, kapsam ve bütçe onaylanmadan ödeme veya dışarıya mesaj gönderilmez. Ayrıca native runtime denemesinde yeni bağımlılıklar ve development build gerekecek. Önceki “yeni paket ekleme” kuralı nedeniyle bu öneride uygulamaya kurulmadı. Sonraki adım için bu sınırlı teknik denemenin kapsamı ayrıca onaylanmalı.

## Doğrulanan teknik kaynaklar — 30 Ekim 2026

- [Filament özellikleri / native renderer](https://github.com/margelo/react-native-filament)
- [Filament model animasyonu ve geçiş](https://margelo.github.io/react-native-filament/docs/guides/animator)
- [Rive RN gereksinimleri ve native runtime](https://rive.app/docs/runtimes/react-native/react-native)
- [Rive bones ve mesh deformasyonu](https://rive.app/docs/editor/manipulating-shapes/bones)
- [Rive export planları](https://rive.app/pricing)
- [Unity as a Library kısıtları](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/cross-platform-features/unityasa-library)
- [R3F native geçiş durumu](https://github.com/pmndrs/native)
- [Expo 58 belge kökü](https://docs.expo.dev/versions/v58.0.0/)
- [Blender lisansı](https://www.blender.org/about/license/)
- [Web inceleme aracı: model-viewer](https://modelviewer.dev/)
