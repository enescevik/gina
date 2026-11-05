# Ders programını birlikte kontrol etme — 5 Kasım 2026

Önceki ekran, haftalık tabloyu kırk ayrı karta dönüştürüyor; fotoğraf ve teknik uyarılar programın önüne geçiyordu. Bu düzeltme fotoğraftan inceleme ile kayıtlı program düzenlemeyi aynı gün/hafta tablosunda birleştirir. GINA'nın mevcut mor, mint, krem ve yazı ailesi korunur.

## Kullanım

1. Ders programı → Fotoğraftan aktar (telefonda üç nokta içinde). Dosya/galeri/kamera seçimi değişmez. İsteğe bağlı açıklama alanına kısaltmaları veya tablonun nasıl okunacağını yazın; örnek ekleyip düzenleyebilirsiniz.
2. Sonuç önce tablo olarak gelir. MAT, İNG, SOS gibi bilinen kısaltmalar tam adla gösterilir. Düzenlemede özgün ad korunur; belirsiz adlar tahmin edilerek tamamlanmaz. Kullanıcı son eşlemeyi onaylar.
3. Saatler yoksa Saatler → ilk ders, ders süresi, normal teneffüs ve isteğe bağlı uzun ara. Önizlemeyi kontrol edip bütün günlere veya yalnız seçili güne uygulayın. AI görünmeyen saatleri uydurmaz.
4. Derse dokunarak ad/gün/saati düzenleyin. Teneffüs değişikliği o günün sonraki derslerini kaydırır; ders süreleri ve sonraki aralar korunur. Geri al son değişikliği geri getirir.
5. Yer değiştir → tutamaktan diğer dolu hücreye sürükleyin veya iki dersi sırayla seçin. Derslerin kimliği/kaynak ilişkisi korunur; saatler bulundukları yuvada kalır. Boş hücreye sürükleme ve ekran dışına otomatik kaydırma bu sürümde yoktur; gün değiştirmek için ders düzenleyicisi kullanılabilir.
6. Fotoğraf ve kontrol notları gerektiğinde açılır. Son kontrol ve kaydetme ayrı adımdır. Kayıtlı programdaki değişiklikler de Programı kaydet ile uygulanır.

## Değerlendirme ölçütleri

Bu bir uzman görüşü/klinik değerlendirme değildir; ürün incelemesinde aşağıdaki ilkeler kullanılmıştır.

| Bakış | Sorun ve çözüm |
|---|---|
| Bilişsel yük | Uzun uyarı yığını yerine açılır notlar; önce gün/hafta tablosu, ayrıntı derse dokununca. |
| Çocuk ve veli kullanımı | İşlem adları Türkçe ve görünür; sürüklemeye bağımlı olmayan iki dokunuşla değiştirme; yanlış işlem için geri alma. |
| Eğitim | Tekrar eden aynı dersler ayrı saat olarak kalır. Eksik saati tahmin etmek yerine okulun zil düzeni girilir. Belirsiz ders eşlemesi incelemede kalır. |
| Mimari | Aynı tablo ve saf zaman hesaplama kuralları iki akışta kullanılır. Gün dışına taşan saatler reddedilir; kaynak, kayıt sürümü ve tekrar deneme koruması korunur. |
| Görsel kullanım | Telefonda gün odaklı, tablette haftalık görünüm; dar ekranda yatay kaydırılabilen hafta tablosu; dokunma alanları en az 48 dp. |

Ödev/kurs belgesi incelemesindeki kontrol notları da açılır düzene alınmıştır. Diğer bütün ekranların nihai denetiminin tamamlandığı iddia edilmez.

## Doğrulama ve sınırlar

- Temel mantık: 251 test; bunun 8'i bu akışın zamanlama, ad eşleme, hariç tutma, öğle arasını koruma ve yer değiştirme davranışını kapsar.
- İçe aktarma şeması ve açıklama sınırı: 5 test.
- Mobil TypeScript/lint ve Edge tip kontrolü geçti.
- Gerçek yerel Auth/REST/Storage/Edge/DB ile sentetik aile üzerinde fotoğraf seçme, açıklama gönderme, 40 ders inceleme, saat tamamlama, kayıt/yeniden açma kontrol edildi. AI sağlayıcısı bu otomatik/yerel kabulde deterministik test yanıtı verir; gerçek fotoğrafı okuma kalitesi testi değildir.
- Tarayıcıda tutamaktan sürükleme, iki dokunuşla değiştirme ve geri alma; 10 → 20 dakika teneffüste yalnız o günün devamının kayması doğrulandı.
- Dar/geniş görünüm geçişinde içe aktarma penceresinin kapanması bulundu ve giderildi; tablo ve girişler korunarak geçiş tekrar denendi.
- Ekran görüntüleri gerçek uygulamanın sentetik verili web çalıştırmasındandır; fiziksel iPhone/iPad görüntüsü değildir. Dokunmatik tutamak, klavye ve büyük yazı kabulü cihazda ayrıca denenmelidir.

## Görüntüler

[Telefon](screenshots/phone.png) · [Tablet](screenshots/tablet.png) · [Telefon inceleme](screenshots/import-phone.png) · [Tablet inceleme](screenshots/import-tablet.png) · [Saat düzeni](screenshots/bell-times.png)

Yayın durumu bu klasördeki release.json dosyasında ayrıca kaydedilir; bu belgenin varlığı dağıtımın tamamlandığı anlamına gelmez.
