# Odam kaplamaları — üretim ve yerleşim notu

Referans: aynı klasördeki `child-home-approved.png` ve `parent-home-approved.png`. 30 yazısız kaplama/durum, her biri düzenlenebilir SVG ve aynı SVG’den @3x PNG. Kaynak: `packages/assets/room-chrome/`. Native SVG contact-sheet burada ve kaynak klasöründe bulunur. İsimli, açık/koyu ve gerçek 9-slice genişleme denemeleri kaynak klasöründeki `contact-sheet.html` içindedir.

## Referans → parça eşlemesi

| Referanstaki parça | Kaplama / varyant |
| --- | --- |
| Çocuk ekranı sol görev panosu | board-frame |
| Panodaki ayrı krem görev kâğıdı | task-card, task-card-pressed |
| Teal Başla çipi | chip-start, chip-start-pressed, chip-start-disabled |
| Kart sağındaki durum | status-done, status-waiting, status-returned |
| Başlık ilerleme noktaları | progress-dot-filled, progress-dot-empty |
| Sağ üst hedef bileti | ticket-goal, ticket-goal-empty |
| Hedef ilerlemesi | progress-bar-track, progress-bar-fill |
| Sağdaki Haftam takvimi | week-frame; hücreler native |
| Gün durumları | week-check, week-partial, week-empty |
| Üç ödüllük raf | shelf-display; üç yuva native eşit genişlikte |
| Raf altındaki Hazinem çekmecesi | drawer-front, drawer-front-pressed |
| Üst yıldız sayacı | pill-star, pill-star-pressed |
| Üst ebeveyn çıkışı | pill-parent, pill-parent-pressed |
| Selamlama altındaki opsiyonel vurgu | header-greeting-underline |
| Dar ekranda yeniden akan panel | panel-generic |
| Veli beyaz ana kartları | parent-card |
| Veli onay bekleyen krem alan | parent-approval-card |

## 9-slice sözleşmesi

Manifestte capInsets ve contentInsets **@3x kaynak piksel** birimindedir. width/height ve minimumLogicalSize ise 1x mantıksal birimdir. Örnek: 72 kaynak piksel, 24 mantıksal birim. Native platform API’sinin beklediği birime dönüştür; 72’yi yanlışlıkla 72 dp padding yapma. PNG’nin pixelRatio değeri 3’tür.

Köşeler ve süsler ölçeklenmez. Orta bölge ve düz kenarlar esner; `stretch: horizontal` olan raf/çubuk/altçizginin yüksekliğini koru. Kaynağı tek resim olarak en-boy yönünde germek 9-slice değildir. Dokuz parçalı renderer hedef sınırlarını tam fiziksel piksele yuvarlamalı; kesirli parça sınırları ince dikiş çizgisi oluşturabilir. HTML büyütme kontrolü ortak tam-piksel sınırlarla dokuz parçayı çizer. Platformun capInsets desteği uygun değilse aynı manifestten dokuz parçalı renderer kullan. PNG kaynağını doğrudan background-size:100% 100% yapma. SVG kaynak düzenleme ve sabit ölçü render için uygundur; farklı oranda SVG viewBox’ı germek köşeleri bozar.

Her kaplamanın minimumLogicalSize sınırı vardır; daha küçük genişliğe zorlamak yerine yerleşimi değiştir. Hedef bileti 160 dp sabit kap yüksekliği nedeniyle daha küçük hâle sıkıştırılmaz. İlerleme dolgusunun sıfır genişliğinde hiç çizim yok; çok düşük yüzde için tam minimum kapsülü çizerek ilerlemeyi abartma: dolgu kapsülünü native clip/overflow alanında gerçek değere kes. Bu runtime kesim SVG kaynağa mask eklemek değildir.

Üç raf yuvası content rect içinde x=(1/6,1/2,5/6) merkezlerine yerleşir. Kaplamaya sabit bölücü çizilmedi; genişleyen rafta yuva aralıklarını native layout belirler. Çekmece yıldız kulpu ve hap ikonları sol sabit kapta kalır. Metin contentInsets dışında çizilmez.

Pressed ve disabled dosyalarının tuval, cap ve içerik sınırları aynıdır; durum geçişinde içerik zıplamaz. Disabled yalnız görseldir: etkileşimi/accessibility disabled durumunu uygulama ayrıca kapatır. Kaplamadaki tik/kilit/yıldız gibi BRIEF’te istenen sembollerin üstüne ikinci ikon çizme. Diğer yazı, sayı, görev/ödül resmi, avatar ve gün hücreleri native katmandır.

## Oda ve karakterler

`packages/assets/rooms/v2/room-base.webp`: **1586×992**, lossless, opak arka plan. Pano, hedef bileti, takvim ve sağ sergi dolabı tabana gömülü değildir; bu kaplamalar ayrı yerleşir. Böylece responsive düzen çift çerçeve üretmez. Sabit sahne dekoru (pencere, kitaplık/bitki, minder, halı ve zemin) tabanda kalır; tam mobilya/zemin ayrıştırması bu teslimde yapılmadı.

`character-girl.webp`, `character-boy.webp`, `character-unspecified.webp`: 1254×1254, lossless RGBA, aynı oturan/kitap okuyan rol; ayrı şeffaf katmanlar. Manifestte alfa içerik sınırları vardır. Karakterleri kare tuvalin altına göre değil içerik sınırının altına göre aynı ayak çizgisine hizala. Kız/erkek/belirtmeyen isteğe bağlı görünüm tercihidir; tüm seçenekler herkese açık kalır.

Oda ve karakterler built-in imagegen ile konseptten üretildi. Üç karakter ikinci temizlik turundan alındı; tarayıcıda açık/koyu arka plan üzerinde kontrol edildi. Oda kaynağı 1585×992 çıktı; istenen 1586×992 teslim boyutuna yalnız bir piksel yatay ölçü normalizasyonu yapıldı. Üretim promptları `rooms/v2/generation-production.json` içindedir. Kayıpsız WebP kodlama, kaynak piksel kalitesine ilave kayıp eklemez.

## Claude için uygulama sırası

1. Güncel main’i al; room-chrome manifestini, bu notu ve iki onaylı referansı oku. Eski art-candidates yerine üretim WebP’lerini kullan.
2. Arka plan → kaplama → gerçek metin/veri/ikon → karakter/ödül → erişilebilir dokunma alanı olarak ayrı katmanlar kur. Eski CSS/native kart zeminlerini yeni kaplamanın arkasında bırakıp çift kenar üretme.
3. Baloo 2 başlık ve Nunito gövdeyi mevcut tipografi sisteminden kullan. Bu paket font veya metin rasterize etmez. Tasarım referansının yazılı ekranını arka plan yapma.
4. Yatay geniş ekranda oda yerleşimi; dar ekranda aynı kaplamalar dikey akış. 320/390 dp, tablet, fontScale 1.0/1.5/2.0 ve uzun Türkçe metinlerle kontrol. minimumLogicalSize altına inme; küçük bileşeni yeniden düzenle.
5. Native hitbox ≥48 dp; dekor erişilebilirlik ağacından çıkarılır. PIN çıkışı, RPC, yıldız ledger’ı, idempotency ve mevcut veri modelleri korunur. Bu PR yalnız görsel ve dokümandır, uygulama entegrasyonu değildir.

Kaplamalar referansın düzenlenebilir, esneyebilir yorumudur; resimdeki perspektif ve suluboyanın piksel kopyası değildir. SVG’de yumuşak etki üst üste düşük opaklıklı şekiller ve ince ahşap çizgileriyle sağlandı; filter/mask/gradient/text/style/image yok. PNG aynı kaynaktan render edilir; ayrı, SVG ile uyuşmayan gizli doku katmanı yoktur.
