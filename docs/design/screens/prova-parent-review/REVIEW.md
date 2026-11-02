# Veli çözüm incelemesi — onay bekleyen tasarım

2 Kasım 2026. Bu teslim yalnız görsel öneri ve uygulama sözleşmesi taslağıdır. Maket çalışan uygulama ekranı değildir. Uygulama, veritabanı ve TestFlight değiştirilmedi.

## İncelenen mevcut akış

`apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx` bütün soruları, raporu ve çalışma planını tek kaydırılan sayfada gösteriyor. Açık uçlu cevap için 0–100 puan, geri bildirim, cevap anahtarı ve salt okunur `NotebookPage` var. Çoktan seçmeli soruda çocuğun seçimi ve doğru cevap bulunuyor. Tamamlanmamış Prova puanlanmıyor. `supabase/functions/prova-grade/index.ts` çizimli cevaplar için `notebook_review_required` döndürüyor; el yazısı değerlendirmesi hazır değil.

Bu turda ekran kodu incelendi; mevcut ekran canlı uygulamada yeniden açılmadı. Yeni görsel yerleşim önerisidir. Önceki çocuk defteri maketi kimlik referansıdır; eski reddedilmiş tasarımlar kullanılmadı.

## Yerleşim

- Tablet 1280×800: yaklaşık üçte bir soru/değerlendirme, üçte iki defter. Defter genişletildiğinde değerlendirme paneli kapanır; geri dönünce taslak korunur. Her panel kendi içinde kayabilir, footer içerik örtmez.
- Telefon 390×844: Çözüm / Değerlendirme sekmeleri. Çözüm sekmesinde kompakt soru önizlemesi ve geniş defter; Değerlendirme sekmesinde soru özeti, cevap anahtarı, puan, geri bildirim ve ikincil AI eylemi. Dar 320 dp ve büyük yazıda yatay taşma olmamalı.
- Çocuk yazısı mevcut koyu mor, veli işaretleri başlangıçta koyu teal. Yazar ayrımı yalnız renkle verilmez: "Notlarım" görünürlük anahtarı, katman açıklaması ve ayrı araç alanı olur.
- Aynı gina logosu, mevcut Nunito ailesi, krem/lila yüzeyler, mor ana eylem. Yeni maskot çizimi yok; bu çalışma yüzeyinde logo yeterli. Notlar çözümün üzerindeki ayrı katmandır.
- Kalem, yalnız veli çizgisini silen silgi, metin notu, geri alma/yineleme. Dokunma alanları en az 48 dp. Yeni font/paket yok; native metin ve mevcut bileşenler esas alınacak.
- Maketteki "Özete dön" yanındaki fincan üretim modelinin referanstan taşıdığı bir ayrıntıdır; uygulamada sonuç özeti simgesi kullanılacak. "100 / 100" gösterimi sabit paydalı sayısal alandır, tek metin halinde düzenlenmez.

## İşlem akışı ve korunan işlevler

1. Prova özeti mevcut sonuç/AI raporu/çalışma planına erişimi korur. İnceleme soru soru açılır; numara seçiciden tamamlanan, bekleyen ve boş soruya gidilir. Yeni rapor veya yeni çalışma planı ekranı bu onayın konusu değildir.
2. Çocuğun gönderilmiş metni/defteri değiştirilemez. Veli işaretleri ve geri bildirimi ayrı kayıttır; çocuğun belgesi üzerine yazılmaz. Kalem/parmak desteği mevcut araçların kapsamındadır; basınç/eğim/avuç içi reddi tamamlandı diye sunulmaz.
3. Cevap anahtarı açılıp kapanır. Puan mevcut iş kuralına uygun 0–100 tam sayı; boş alan 0'a çevrilmez. Boş/okunamayan cevap açıkça belirtilir, otomatik sıfır verilmez. Çoktan seçmeli doğru/yanlış gösterimi korunur; otomatik sonucu değiştirecek yeni iş kuralı varsayılmaz.
4. Telefonun "Değerlendirmeye geç" eylemi yalnız sekme değiştirir; kayıt yapmış gibi görünmez. "Kaydet ve sonraki" puan, geri bildirim ve veli katmanını tek işlemde kaydeder; başarıdan sonra ilerler. Kayıpsızlık için istek makbuzu ve revizyon kontrolü gerekir. Bunlar henüz uygulanmadı.
5. Taslakta "Kaydedilmedi", istek sırasında "Kaydediliyor", sunucu doğrulamasından sonra "Kaydedildi". Geri/başka soru/özete geçişte kayıtsız değişiklik uyarılır. Belirsiz ağ yanıtında aynı istek uzlaştırılır; yeni kayıt veya sonraki soruya atlama yapılmaz. Kalıcı çevrimdışı taslak bu tasarımla teslim edilmiş sayılmaz.
6. İlk sürüm önerisi: kaydedilen veli notları ve geri bildirim ilgili çocuğa görünür; düğmenin yakınında bu açıkça yazılır. Gizli veli not defteri ayrıca önerilmedikçe eklenmez. Makette bu yardım satırı gösterilmemiştir; uygulama öncesi tamamlanacak.

## AI — ayrıca uygulanması gereken sözleşme

"AI önerisi al" ikincil eylemdir. Paket hakkı ve gerçek kalan hak sunucudan okunur; üretim öncesinde gösterilir. Yeni veya görsel paylaşım onayı olmayan değerlendirmede soru, çocuğun çözüm görüntüsü ve cevap anahtarının AI hizmetine gönderileceği açıklanır; işaretlenmemiş ayrı onay gerekir. Bu ekranda onay verilmesi üretimde başka dosyaları paylaşma yetkisi sayılmaz.

Çocuğun özgün çözümü ve soru kaynağı değerlendirilir; veli anotasyonları çocuk cevabı gibi AI'a gönderilmez. Belgenin sürümü/hash'i, çıktı ve AI işlemi ilişkilendirilir. Kaynak okunamadığında tahmin veya 0 puan değil açık eksik nedeni gösterilir. Güçlü adım, düzeltilmesi gereken adım, kanıt ve sonraki çalışma önerisi ayrı olmalı; kesin zekâ/yeterlilik etiketi üretilmemeli.

AI sonucu öneri panelidir: önerilen puan, gerekçe ve düzenlenebilir geri bildirim. Veli "Taslağa al" demedikçe mevcut alanlar değişmez. Ardından normal kayıt gerekir. Kullanıcıya açık değişiklik: mevcut toplu AI işleminin otomatik puan yazması yerine bu yeni çizimli cevap yolunda veli onayı öneriliyor. Eski toplu değerlendirme davranışı bu tasarım onayıyla kendiliğinden değiştirilmez; uygulama kapsamı ayrıca belirtilir.

## Durumlar ve kabul kontrolleri

| Durum | Beklenen davranış |
|---|---|
| Yükleniyor | Defter ölçüsünde sakin yer tutucu; boş cevap/0 puan gösterme |
| Cevap yok | "Bu soru için cevap gönderilmemiş."; kaynak açık, değerlendirme bağlamı korunur |
| Eski/bilinmeyen belge | "Bu çözüm bu sürümde açılamıyor."; boş defter gibi sunma, AI/işaretleme kapalı |
| Ağ/görsel hatası | Aynı soruda tekrar dene; mevcut taslağı koru |
| Prova sürüyor | Salt okunur; "Prova tamamlanınca değerlendirebilirsin." |
| AI hakkı yok | Açıklamalı ikincil alan; elle değerlendirme kullanılabilir |
| AI bekliyor/hata/okunamıyor | İlerleme, tekrar politikası ve açık neden; tahminî puan yazma |
| İki veli düzenliyor | Revizyon çakışması; sessiz son-yazan kazanır davranışı yok |
| Kaydetme cevabı kayıp | Aynı makbuzla uzlaştır; ikinci kayıt/çift AI ücreti yok |
| Hesap değişimi | Aile/çocuk oturumu değişince taslak ve görsel erişimi izole |

Onaydan sonra: ayrı veri modeli ve yetki/revizyon testleri → veli katmanı/puan akışı → izinli AI görsel hattı → gerçek telefon/tablet web kanıtı ve native cihaz kontrolleri. Defteri değiştirmeme, notları gizle/göster, yakınlaştırmada aynı koordinatlar, soru değiştirme, tekrar kayıt, çocukta yalnız ilgili yayımlanmış geri bildirim ve aile hesabı silme özellikle doğrulanmalı. Görsel onay kod/üretim doğrulaması yerine geçmez.
