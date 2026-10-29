# Katmanlı sanat ve gerçek arayüz

Onaylı PNG ekranlar tasarım yönünü anlatır. Fotoğraf gibi bir Image içine tüm ekranı koyup şeffaf buton ekleme; ad, görev, sayaç, rozet durumu, hedef ve düğme metinleri gerçek React Native Text/Pressable/SVG öğeleridir.

`art-candidates/room-base.webp`: boş oda, sol pano, sağ bilet, takvim çerçevesi, üç sergi yuvası, çekmece. `character-*.webp`: aynı pozda üç şeffaf karakter. Kaynaklar built-in imagegen ile ayrı ayrı üretildi; lossless WebP'ye yalnız format dönüşümü yapıldı. Kız sprite'ının alt kenarında hafif açık renk parçalar dahil olabilecek alfa pürüzleri var; üretimden önce sanat temizliği ve açık/koyu zemin incelemesi gerekir. Bu adaylar strict SVG/palet teslimi değildir.

Layer sırası: oda tabanı → tematik dekor → karakter → sergilenen ödül/rozet → gerçek görev/hedef/hafta metinleri ve kontroller → güvenli üst çubuk → modal/panel. Sezon dekoru yalnız korunan alanlar dışında; hiçbiri etkileşimi kapatamaz.

`scene-layout.json` 1586×992 tasarım koordinatında başlangıç yerleşimini verir. Çerçeveler eğik çizildiği için dokunma/okuma alanları iç dikdörtgen kullanır; yazıyı perspektif eğme. normalize koordinatları gerçek görüntü alanına uygula: scale=min(containerW/baseW,containerH/baseH); offset=(container−base×scale)/2. Safe-area önce çıkarılır; metinler cihaz font ölçeğiyle ayrı büyür. `cover` crop kullanma, aksi halde sağdaki ebeveyn çıkışı/hedef kaybolur.

Yatay tablet ≥900 dp ve fontScale≤1.2: tüm oda. Daha dar/dikey veya büyük yazı: aynı mobilya dilinden görev panosu ve hedef bileti dikey akışa yeniden yerleşir; oda görseli dekoratif başlık parçası olur. Tam odayı telefona küçültme. Ana eylem en az 48 dp; tuşlar arasında en az 8 dp. Metin uzarsa kart büyür/alt satıra geçer; sayaç, görev ve çıkış kesilmez. Breakpoint sayısı başlangıç önerisi; gerçek cihazla doğrula.

İlk ekran kelimeleri gerçek i18n kaynağından: “Bugünkü görevlerim”, “Onay bekliyor”, “Hedefim”, “{n} yıldız kaldı”, “Hazinem”, “Koleksiyonum”, “Odam”, “Ebeveyn”. Sadece renkle durum anlatma. Okuma sırası: selamlama → görev özeti → sıradaki görev → hedef → hafta → koleksiyon/hazine → ebeveyn çıkışı. Mobilya dekorunu accessibility tree'ye katma.

## Logo

`packages/assets/brand/yan-yana/logo-mark.svg`, `logo-mark-mono.svg`, `logo-wordmark.svg` yeni native kaynaklar. Seçilen iki kemerli yönün düz paletli yorumu; yeni wordmark eski özel path harflerini kullanır, font bağımlılığı yok. App/splash/notification/web/e-posta platform ihracı hâlâ eski yıldız işareti. Claude marka geçişini ayrı bütünlüklü değişiklikte yapmalı: tüm platform varyantları + safe area + iOS alfa/Android mono kontrolleri; sadece bir PNG değiştirip iki kimliği karıştırma. Yeni logo 24/48 px contact-sheet mevcut.

## Üretim durumu

4–6 ikonları ve yeni logo/dekor SVG'leri düzenlenebilir kaynak teslimidir. Oda görselinin shader, texture veya 3D motor ihtiyacı yok; hedef katmanlı 2D. Konseptlerin üretim sanatına dönüşümü ve üç dekor seçeneğinin birleşik ekran önizlemeleri sonraki görsel onay turuna tabidir; bu belgelerde “tamamlanmış uygulama” iddiası yoktur.
