# BRIEF 13 — Onaylı ana ekranlarla birebir eşleşme

**Hedef:** Uygulamadaki çocuk ve veli ana ekranları, onaylı referanslarla birebir aynı görünmeli:
`references/child-home-approved.png` ve `references/parent-home-approved.png`. Ürün sahibi kedi, kitaplıktaki çanta, pano biçimi gibi tüm parçaların referanstakiyle aynı olmasını istiyor; "yorum" değil, referansın kendisi.

Uygulamanın şu anki görüntüsü ve referansla yan yana karşılaştırması bu klasörde:
`references/compare-2026-10-30-child.jpg`, `references/compare-2026-10-30-parent.jpg`. Ürün sahibi bunları sana ayrıca da verecek.

Kurallar değişmedi: yazı yok (tüm metin native); kaplamalar room-chrome manifest sözleşmesiyle (9-slice, capInsets/contentInsets @3x, minimumLogicalSize); oda ve karakterler `rooms/v2` sözleşmesiyle (içerik sınırları, ayak çizgisi). Görsel stil referansla aynı; flat-only istisnası resimli katmanda geçerli. Kaynakları güncellerken mevcut dosya adlarını ve slug'ları koru, yeni parçaları manifestlere ekle.

## A. Oda tabanı ve dekor (`packages/assets/rooms/v2/`)

Şu an `room-base.webp` referanstan sade. Referanstaki her şey olmalı:

1. **Sol ön plan:** kalemlik (yıldızlı mavi kup, renkli kalemler) ve üst üste kitaplar olan ahşap sehpa; sol alt köşede pembe kareli battaniyeli yatak ucu; sol kenarda büyük yeşil bitki.
2. **Sağ alt köşe:** sarı puf/koltuk kenarı.
3. **Sağ duvar:** gökkuşağı kartpostalı ve yaprak çizimli kart, bantla tutturulmuş.
4. **Kitaplık:** referanstaki oran ve konumda. Üst rafta kedi fotoğraflı çerçeve, alt rafta **teal okul çantası**, kitapların renk ve dizilimi referanstaki gibi; tepesinde sarkan büyük sarmaşık bitki.
5. **Pencere ve perde** referanstaki genişlik ve konumda.
6. **Sarı armut koltuk + teal yastık:** karakterin oturduğu yer, referanstaki gibi.
7. **Evcil hayvan (seçilebilir):** referanstaki uyuyan kedi (beyaz-kahve benekli, kıvrılmış), halının üstünde, karakterin solunda. Çocuk evcil hayvanını seçebilecek: **kedi, köpek, maymun, aslan yavrusu**. Her biri ayrı şeffaf katman olsun: `pet-cat.webp`, `pet-dog.webp`, `pet-monkey.webp`, `pet-lion.webp`. Hepsi aynı ölçekte, aynı çizim dilinde ve aynı ankrajda (halı üstü, ayak/zemin çizgisi manifestte) dursun; uyuyan ya da kıvrılmış sakin poz kullan. Ayrıca seçim ekranı için her birinin 256 px yüz/portre küçük resmi (`pet-{slug}-portrait.webp`). "Evcil hayvan yok" seçeneği de olacak, onun için görsel gerekmez.
8. **Halı:** referanstaki boy ve konumda.

Pano, bilet, takvim ve sağ dolap yine tabana gömülmesin; aşağıdaki kaplamalarla ayrı gelsin. Üç oda teması aynı yerleşim ankrajlarını korusun.

## B. Karakterler (`character-{girl,boy,unspecified}.webp`)

`character-girl` referanstaki kızla **aynı** olmalı: düz kahverengi, omuza yakın küt saç; mercan renkli, göğsünde beyaz çiçek olan kazak; teal kitap; bağdaş kurmuş poz; beyaz çoraplar. Şu anki üretim kızının saçı kıvırcık ve çiçek motifi yok. Erkek ve belirtmeyen karakterler aynı poz, ölçek ve ayak çizgisiyle, aynı çizim dilinde olsun.

## C. Kaplamalar (`packages/assets/room-chrome/`)

| Parça | Referansta | Şu an | İstenen |
| --- | --- | --- | --- |
| `board-frame` | Kalın ahşap çerçeve; başlık alanı ile görev listesi arasında **ahşap ara çıta**; sağ üstte güneş karalaması ve yaprak dalı | İnce çerçeve, ara çıta yok, süs yok | Referanstaki çerçeve; başlık ve liste bölgeleri için iki ayrı contentInsets (ya da `board-header` + `board-list` olarak iki parça) |
| `task-card` | Kenarı yırtık krem kâğıt, köşede renkli raptiye (kırmızı, mavi, teal değişken) | Düz kart, raptiye tek renk | Yırtık kenarlı kâğıt; raptiye renkleri için 3 varyant ya da ayrı `pin-{red,blue,teal}` parçası |
| `chip-start` (+pressed/disabled) | Raptiyeyle asılı, hafif eğik teal **etiket** | Düz hap | Referanstaki etiket biçimi |
| Pano başlık ilerlemesi | Teal **çubuk** | Nokta (manifestteki eşleme) | `progress-bar-teal-track` + `progress-bar-teal-fill` |
| `ticket-goal` | Krem-sarı dolgulu, tırtıklı kenarlı bilet; "Hedefim" çevresinde ışın çizgileri; yıldız süsleri | Soluk kontur | Referanstaki dolgulu bilet; içerikte ödül görseli için sol ve sağ yuvalar (contentInsets ile tarif et) |
| `week-frame` | İple çiviye asılı çerçeve | Benzer | Ölçü ve renkleri referansa eşitle; `week-check` dolu teal daire + beyaz tik |
| `shelf-display` + `drawer-front` | **Tek ahşap dolap:** üstte üç ürünün durduğu raf, altında aynı dolabın çekmecesi, ayaklı | Düz kahverengi tahta + ayrı çekmece | `cabinet-display` (raf + çekmece gövdesi + ayaklar) ve ürün altı **isim plakası** `plaque` (9-slice, yazısız) |
| `pill-star` | Krem-sarı hap | Beyaz | Referans rengi |
| `pill-parent` | Nane hap | Benzer | Referansa eşitle |
| "Odam" etiketi | Kitaplık yanında asılı kâğıt etiket, tişört ikonu ve ok | Yok | `tag-hanging` kaplaması; aynı dille **Prova** girişi için de kullanılacak |

## D. Ödül ve sergi görselleri (`packages/assets/gamification/illustrated-v3/`)

1. **Hedef biletindeki ödül görselleri:** referanstaki patlamış mısır ve klaket. `family_rewards.icon` slug'larının her biri için (`reward-movie-night`, `reward-mystery-box` ve kataloğun geri kalanı) bilette sola ve sağa yerleşen bir çift ya da tek bir görsel.
2. **Raftaki sergi nesneleri:** referansta altın diş kupası, altın çerçevede fidan ve kitap yığını, kaidenin üstünde **3B nesne** olarak duruyor. Şu an aynı yerde rozet madalyaları var. Her rozet için `display-{slug}.webp` sergi varyantı ver (madalyalar Koleksiyonum'da kalır).

## E. Veli ana ekranı

1. **Başlık sahnesi:** sağ üstte pencere, güneş, bitkiler, kedi fotoğrafı, sarı kupa ve kitaplardan oluşan şeffaf illüstrasyon (`parent-header-scene.webp`). Logo, selam ve tarih native metin olarak üstüne gelir.
2. **Çocuk avatarları:** referanstaki resimli çocuk yüzleri. Mevcut avatar slug'larının her biri için resimli sürüm (`avatars/illustrated-v3/`).
3. **"Tümü" çipi:** aile grubu ikonu.
4. **Bugünün planı:** zaman çizelgesi noktaları ve bağlantı çizgisi (`timeline-dot-filled`, `timeline-dot-empty`, `timeline-line`).
5. **"Küçük adımlar birikiyor" kartı:** açık teal kart kaplaması (`parent-insight-card`) ve açık kitap illüstrasyonu.
6. **"Birlikte yeni görev ekle":** konturlu buton kaplaması (`button-outline`), artı ikonuyla.
7. **`parent-card` ve `parent-approval-card`:** referanstaki iç boşluk daha dar. contentInsets'i referansa göre güncelle.

## Teslim

- Her yeni parçayı manifestlere, contact-sheet'e ve `preview-note.md` eşleme tablosuna ekle.
- Referansla yan yana bir montaj ver: yalnız senin parçalarınla kurulmuş, yazısız bir "maket" yeterli.
- Mevcut slug ve yol adlarını değiştirme. Değişen parçaların eski sürümlerini silme; manifestte `supersedes` ile işaretle.
