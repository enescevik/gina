> **30 Ekim güncellemesi:** v5 görsel yönü onaylandı: “bu güzel, tüm ekranları yap bu şekilde”. Yeni ekran maketleri hazırlanıyor; v4 modeller ve animasyonlar onaylı değildir.

# Oda sanatını düzeltme · v5

**V4 görselleri ürün sahibi tarafından reddedildi.** Teknik olarak açılan GLB, görsel kalite kabulü değildir. V4 üretim hedefi olarak kullanılmayacak. Bu klasör yeni görsel hedefin incelemesidir; henüz onaylanmış değildir.

## Önceki işin eleştirisi

1. **Kimlik kaybı:** kızın katmanlı saç silueti kaska, yüzü genel bir oyuncak figüre dönüştü. Petler aynı uzatılmış gövdenin varyasyonları gibi kaldı. Renk ve aksesuar benzerliği, karakter benzerliğinin yerini tutmadı.
2. **Yanlış kamera:** onaylı çizim odanın içinden bakıyordu. V4 yüzen platform üzerinde dışarıdan görülen bir oyuncak oda yaptı. Mekânın yakınlık ve derinlik ilişkisi değişti.
3. **Malzeme ayrımı zayıf:** ahşap, saç, kumaş ve pet aynı yuvarlatılmış plastik/kil yüzeyini andırıyordu. Gürültü dokusu, boyanmış yüzey veya doğru biçimin yerini tutmadı.
4. **Kompozisyon kaybı:** eşit kalınlıklı kutu çerçeveler ve küçük karakterler, referansın pano–karakter–ödül hiyerarşisini bozdu. Halı/oturuş/puf ilişkisi zayıfladı.
5. **Hareket kalitesi:** çene kemiği bulunması doğal esneme demek değil. Göz kapakları, yüz, omurga, ağırlık aktarımı ve türlere özgü zamanlama eksikti. Segmentli hareketler mekanik kaldı.
6. **Yanlış teslim önceliği:** 20 modeli tamamlamak, tek bir modelin doğru sanat kalitesine ulaşmasından önce geldi. Dosya sayısı ve çalışan testler sanat kalitesine kanıt olarak sunulmamalıydı.

## Bu revizyonda ne düzeldi?

Onaylı ana ekran ve özgün kız/kedi/diş ödülü doğrudan referans verildi. Oda kadrajı yeniden içeriden ve kenarlara kadar devam eden biçimde kuruldu. Kızın omuza yakın, katmanlı kahverengi saçı; mercan papatyalı üstü, teal kitabı/pantolonu ve bağdaş oturuşu geri geldi. Kedi kompakt kıvrılmış siluete döndü. Mobilya, kâğıt, kumaş, halı, altın ödül ve saç ayrı malzemeler olarak okunuyor.

Sol görev panosu, orta pencere/kitaplık/çocuk/pet, sağ hedef/takvim/ödül dolabı aynı düzende. Teal çanta, kedi fotoğrafı, sarmaşık, puf, kalemlik, yatak ucu ve duvar kartları korunuyor. Panolardaki yazı yerleri boş; görsellere metin işlenmedi.

Üç görsel var: gündüz, gün batımı, karlı gece. Gündüz pencere güneşi simgesel çizimden atmosferli ışığa çevrildi. Gün batımında alçak güneş ve sıcak kenar ışığı; karlı gecede soğuk dış ışık/sıcak iç ışık dengesi gösteriliyor.

## Dürüst teslim sınırı

Bunlar **imagegen ile üretilmiş raster sanat hedefleridir**. Blender renderı, GLB modeli, çalışan oyun sahnesi veya üretim katmanı değildir. V4'ün modelleri bu görünümü verecek şekilde yeniden yapılmış değildir. Görseldeki pano, çocuk ve pet henüz ayrıştırılmış/riglenmiş üretim parçaları değildir. Bu resim uygulama arka planına konup üstüne buton yapıştırılmayacak.

Hava varyantları ayrı üretilmiş görsellerdir; piksel hizalı sprite dizisi ya da gerçek ışık simülasyonu değildir. Üretim 3D sahnede aynı kamera/geometri üzerinde ışık ve dış hava değişmelidir. Tüm 24 hava birleşimi, animasyonlar ve diğer karakter/petler bu v5 sanat seviyesine henüz taşınmadı.

## Görsel kabul için benim değerlendirmem

| Ölçüt | V4 | Yeni görsel hedef |
|---|---|---|
| Karakter/pet kimliği | Başarısız | Referansa belirgin biçimde daha yakın; ürün sahibi onayı yok |
| Odanın içinde hissetme | Başarısız | Kadraj düzeltildi |
| Malzeme ayrımı | Başarısız | Kumaş/ahşap/kâğıt/altın ayırt ediliyor |
| Tek mekânda nesne ilişkisi | Zayıf | Ana kompozisyon korunuyor |
| Gerçek 3D geometri | Var, sanat kalitesi reddedildi | Henüz yok |
| Doğal animasyon | Yetersiz | Statik hedef; değerlendirilmedi |
| Üretim UI okunabilirliği | Tamamlanmadı | Native metin ile ayrıca denenmeli |

Hâlâ dikkat edilmesi gerekenler: gün batımı kâğıt yüzeylerinde fazla sıcak kalabilir; metin kontrastı native katmanda kontrol edilmeli. Halı ve kumaş detayları birebir mesh olarak yapılırsa gereksiz maliyet oluşturur; texture/normal/shader ile karşılanmalı. Üretilen varyantlarda küçük çizgi/detay farkları oluşabilir; bunlar üretim animasyonu için uygun kabul edilmemeli.

## Sonraki üretim kararı

Yeni görsel yön onaylanırsa önce **tek bir çocuk + tek bir kedi + üç ödül + oda** aynı kamerada yeniden modellenir. Saç kütlesi/katmanları, karakter oranları, pet anatomisi ve malzeme ayrımı sanat kabulünden geçmeden aile genişletilmez. Gerçek GLB'nin ekran görüntüsü bu görselle yan yana konur; yalnız üretilmiş resmin güzel görünmesi model kabulü sayılmaz.

Pet için yüz/göz kapağı/çene/omurga/pati/kuyruk rig'i, yumuşak ağırlıklar, sabit zemin teması ve doğal hareket zamanlaması gerekir. Çalışan esneme/oyun klibi onaylanmadan diğer petlere kopyalanmaz. Renderer ve gerçek cihaz profili daha sonra doğrulanır. Mevcut veri/RPC/yönlendirme değiştirilmez.

## Kaynak

Üretim: yerleşik imagegen aracı. Tam promptlar `prompts.json` içinde. Girdi: onaylı çocuk ana ekranı, mevcut kız/kedi ve diş ödülü. İlk görselde pencere güneşi ayrıca düzeltilerek son gündüz kaynağı üretildi. Seçilen üç çıktı bu repo klasörüne kopyalandı; var olan üretim asset'leri değiştirilmedi.
