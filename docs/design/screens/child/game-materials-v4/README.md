# Gina · Referansa göre 3D model ve atmosfer paketi · v4

**Durum: görsel inceleme için ilk 3D adaylar.** Bu paket BRIEF 14 tasarım onayı veya mobil giydirme teslimi değildir. Tablet v1/v2 reddedilmiş olarak kalır. Oda fikri korunur; 3D sanat eşleşmesi ayrıca değerlendirilir.

[Canlı 3D oda](viewer.html) · [20 model ve çizim karşılıkları](contact-sheet.html) · [Işık / hava örnekleri](weather-sheet.html) · [Referans karşılaştırması](comparison.html) · [Dosya envanteri](manifest.json)

## Teslim

- Üç çocuk: `character-girl`, `character-boy`, `character-unspecified`. Mercan çiçekli kazak, teal kitap/pantolon, beyaz çorap, bağdaş oturuşu. Seçim herhangi bir cinsiyete kilitlenmez; mevcut slug'lar yalnız dosya uyumluluğu için korunur.
- Dört pet: `pet-cat`, `pet-dog`, `pet-monkey`, `pet-lion`. Beyaz/kahverengi kedi ve köpek, krem yüzlü maymun, altın renkli aslan yavrusu. Ortak dinlenme ankrajı.
- 13 ödül: diş, filiz, kitaplar, ilk görev yıldızı, bronz/gümüş/altın yıldız, elmas yıldız, kilit, erken kuş, yardımsever, matematik yıldızı, hafta kahramanı. Her biri ayrı GLB.
- Düzenlenebilir model ailesi: `characters-pets-collectibles.blend`. Koleksiyonlar `children-*`, `pets-*`, `collectibles-*` olarak ayrıdır. Rig, parça adları, malzemeler ve animasyonlar içeride.
- Kurulu oda: `gina-room-reference.blend` ve `gina-room-reference.glb`. Pano, kâğıtlar, etiket, pencere/perdeler, kitaplık/çanta/fotoğraf/sarmaşık, puf, çocuk, pet, halı, hedef bileti/patlamış mısır/klaket, haftalık takvim, ödül dolabı/çekmece ve eğitim kitabı ayrı nesnelerdir.
- Dokuz adet 512×512 base-color haritası: ahşabın üç tonu, teal, mercan, krem, kâğıt, saç, kahverengi kürk. Blender dosyalarındaki kaynak shader düğümleri korunur; haritalar Blender ve GLB içine gömülüdür. Roughness/metallic skaler malzemelerdir; normal/ORM atlası teslim edilmiş değildir.
- Blender gün ışığı renderı, gerçek WebGL model önizlemeleri, 24 atmosfer kombinasyonunun inceleme görüntüleri ve karşılaştırma sayfası.

Model ve texture dosyalarında yazı yoktur. Fotoğraf çerçevesinde mevcut `pet-cat-portrait.webp` kullanılır; çocuk/petler görüntü düzlemi değil mesh geometrisidir. Türkçe metinler yalnız inceleme sayfalarının arayüzündedir.

## Referans ve görsel sınır

Temel referans `docs/design/room-v2/references/child-home-approved.png`; çocuk/pet biçim referansları `packages/assets/rooms/v2/`; ödüller `packages/assets/gamification/illustrated-v3/display-*.webp`.

Sol görev panosu, orta pencere ve kitaplık, halının üstündeki çocuk/pet ve sağdaki hedef/takvim/ödüller korunur. Yumuşak kenar, mat kumaş, sıcak ahşap, mercan/teal ve altın kaideli ödül ailesi birlikte kullanılır.

Bunlar prosedürel olarak modellenmiş, oyuncak heykel hissi veren ilk adaylardır. Resimli referansın saç kıvrımları, yüz ifadesi, kumaş detayları ve boya dokusu birebir yakalanmış sayılmaz. Karşılaştırma sayfası bu farkı açıkça gösterir. Görsel eşleşme onaylanmadan üretim varlıklarının yerine geçirilmemeli.

## Atmosfer

Gün doğumu / gündüz / gün batımı / gece; her birinde açık / bulutlu / yağmur / kar / rüzgâr / sis. 4×6 kombinasyon aynı sahnede çalışır.

`atmosphere.js` ışık rengini, yönünü, yoğunluğunu, gökyüzü gradyanını ve ufuk parıltısını yaklaşık 2 saniyede yeni duruma yaklaştırır. Sabah/akşam alçak ışık ve uzun gölgeler; gece soğuk dış ışık ve sıcak iç dolgu bulunur. Yağmur eğimi ve kar sürüklenmesi rüzgâr kontrolünden etkilenir. Cam damlaları ve pencere dışı kar birikimi ayrı nesnelerdir. Dış bitkiler, bulutlar ve uçuşan yapraklar rüzgârı gösterir. Yağış pencere sınırlarında kalır.

Bu, fiziksel atmosfer simülatörü veya astronomik güneş hesabı değildir. Hava, şehir, gerçek saat ve tarih servisine bağlı değildir. İnceleme için sanat yönetimiyle belirlenmiş ışık presetleri kullanılır. Konum ve hava durumu entegrasyonu sonraki ürün/veri işidir. Parlak şimşek ve yanıp sönme kullanılmaz.

## Animasyonlar

Her petin `sleep_loop`, `yawn_stretch`, `play_tap`, `look_at_touch` klipleri vardır. Nefes yerel gövde hareketi; esneme çene/baş/kulak/kuyruk eklemleri; oyun pati ve baş hareketidir. Tüm modeli büyütüp küçültme yoktur. Çocuklarda `read_idle`, `look_up`; odada `drawer_open_close`, `book_open_close` korunur.

Rigler bölümlere ayrılmış mesh'lere kemik ağırlığı veren **segmentli deform rig** yapısındadır. Organik, kesintisiz cilt deformasyonu, göz kırpma/mimik rig'i veya final anatomik animasyon değildir. Dört pet aynı temel hareket zamanlamasını kullanır; tür bazlı final animasyon rötuşu gereklidir. Önceki üretim sözleşmesindeki `wake`, `idle`, `settle_sleep` ayrı klipleri henüz teslim edilmedi.

Önizlemede yaklaşık 45 saniyede bir esneme, pete dokununca baş hareketi ve manuel hareket düğmeleri var. İsteğe bağlı hareket kapatılabilir. Hareketi azalt tüm klip/partikül hareketini durdurur; görünmeyen sekmede simülasyon ilerlemez. Prova sırasında dikkat dağıtmayan davranış native entegrasyon sözleşmesinde yer alır; bu bağımsız sayfa Prova'ya bağlı değildir. Ses dosyası ve ses senkronu teslim edilmiş değildir.

## Birimler ve ankrajlar

GLB: metre birimi, Y yukarı, yüzler +Z yönünde. Blender: Z yukarı, yüzler −Y yönünde. Model kaynaklarında root orijindedir. `models/manifest.json` tarayıcıda ölçülen içerik sınırlarını, klipleri ve ölçekleri içerir.

Oda yerleşimi GLB koordinatlarında:

| Nesne | Root konumu | Ölçek | Görünür alt çizgi |
|---|---|---|---|
| Çocuk | `[0, 0.06625, 0.72]` | 1.35 | y=0.10 |
| Pet | `[-1.13, 0.10, 0.98]` | 1.0 | y≈0.10 |
| İlk üç ödül | `[1.48 + i×0.61, 1.02, -0.91]` | 0.88 | Raf üzeri |
| Dış gökyüzü | `[0, 2.22, -2.21]` | 1.4×2.02 | Pencere arkası |

Oda sanat sözleşmeleri (`room-chrome`, `rooms/v2`) değiştirilmedi. Bu 3D paket onların 9-slice dosyalarının yerine kullanılmaz; yeni bir çalışma zamanı henüz seçilmiş değildir. 3D yüzeylere native metin/hit-area yerleştirme kabulü sonraki entegrasyon işidir.

## Yeniden üretim / çalıştırma

Repo kökünden statik HTTP sunucusu ile bu klasörde `viewer.html` açılır. Three.js **0.180.0** CDN importmap ile sabitlenmiştir; önizleme için internet gerekir. Uygulama bağımlılığı eklenmedi. Blender kaynakları CDN olmadan düzenlenebilir.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b \
  --python docs/design/screens/child/game-materials-v4/build_assets.py -- \
  /absolute/path/to/gina/docs/design/screens/child/game-materials-v4
```

Blender 5.0.1 ile doğrulandı. Üretici betik önceki `game-direction-v3/room-spatial-study.blend` kaynağını ve mevcut onaylı pet portresini okur. Çıktı yeri bu tasarım klasörüdür; mevcut uygulama varlıklarını üzerine yazmaz. `.blend1` yedekleri paket envanterine alınmaz.

## Kabul durumu ve sonraki çalışma

`qa-report.json` gerçek tarayıcı denemelerini kaydeder. Modeller tek tek yüklenir, karakter/pet değişimi ve 24 atmosfer kombinasyonu incelenir. TypeScript/lint sonucu PR'da verilir.

WebGL sahnesi yaklaşık 300'ün üzerinde draw call ve 130 bin üçgen içerir; bu mobil performans kabulü değildir. Atlas, mesh birleştirme, LOD, animasyon sıkıştırma, GPU belleği ve düşük cihaz testi yapılmadan üretim olarak kullanılamaz. Görsel onaydan sonra öncelik: sanat/rig rötuşu → optimizasyon → fiziksel iOS/Android cihazında renderer denemesi → native metin ve erişilebilirlik → eğitim etkileşimleri.

Gerçek pet sesleri ve kullanım hakları, kalan animasyonlar, canlı hava/saat bağlantısı ve mobil çalışma zamanı açık işlerdir. Bunları yapılmış gibi göstermek için sentetik miyav, boş klip veya konum taklidi eklenmedi.
