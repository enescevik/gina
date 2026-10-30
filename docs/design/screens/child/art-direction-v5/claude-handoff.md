> **30 Ekim güncellemesi:** v5 görsel yönü onaylandı: “bu güzel, tüm ekranları yap bu şekilde”. Yeni ekran maketleri hazırlanıyor; v4 modeller ve animasyonlar onaylı değildir.

# Claude için güncel düzeltme

Ürün sahibi `game-materials-v4` görsellerini reddetti. O GLB'leri, karakterleri, petleri, malzemeleri ve hareket kalitesini onaylanmış üretim hedefi olarak kullanma. V4 içindeki önceki handoff artık sanat yönü için geçerli değil; dosyalar inceleme geçmişi olarak korunuyor.

Yeni inceleme `docs/design/screens/child/art-direction-v5/` altında. Önce `REVIEW.md` ve üç oda görselini incele. Bunlar doğrudan onaylı çizimden üretilmiş, sanat kalitesini yeniden belirleyen raster görsellerdir; çalışan 3D sahne, yeniden yapılmış GLB ya da native entegrasyon değildir. Bu resmi arka plana koyup buton ekleyerek giydirme yapma.

Oda kurgusu değişmedi. Sol pano, orta pencere/kitaplık/çocuk/pet, sağ hedef/takvim/ödül dolabı korunacak. İçeriden oda kadrajı; katmanlı saç, kompakt kıvrılmış pet; ayırt edilebilir ahşap/kumaş/kâğıt/altın malzemeler hedefleniyor. Pano ve biletin yazıları native olacak. Çocukta bottom-nav yok.

Ürün sahibi bu sanat hedefini onaylamadan mobil giydirmeye geçme. Onaydan sonra tek bir gerçek 3D örneğin bu kaliteye ulaşıp ulaşmadığı gösterilmeli; tüm modelleri aynı yetersiz geometriyi çoğaltarak üretme. Doğal pet animasyonu için yüz/kapak/çene/omurga ve yumuşak deformasyon gerekir. Sonra gerçek cihaz performansı, native metin ve mevcut veri akışlarıyla entegrasyon ayrı aşamalarda ele alınır.
