# İncelenmiş sorular → tekrar takvimi

4 Kasım 2026. Ayrı onaylı maketi olmayan akışlarda onaylı ortak tasarımı kullanma kararı uygulanmıştır. Mevcut GINA logosu, kitap okuyan maskot, krem zemin, mint açıklama ve mor seçim/işlem dili korunur. Yeni ana menü eklenmez: Prova incelemesindeki çalışma planlarından açılır.

## Gerçek bileşen görüntüleri

- `phone.png`: 390 × 844, seçim ekranının başlangıcı.
- `tablet.png`: 1280 × 800, sorular ve günler iki sütun.
- `preview-tablet.png`: seçilen sorular, saat/süre düzenlemesi ve kayıt etkisi.
- `saved-phone.png`: takvim tarihleri ve özgün kaynak soruları.

Ekran görüntüleri gerçek Expo web bileşenleriyle, `qa-fixture.cjs` içindeki sentetik aile/API yanıtlarıyla alındı. ScrollView içinde devam eden içerik vardır; tek görüntü bütün akışın yerine geçmez. Fiziksel iPhone/iPad/Pencil kabulü değildir.

## Kabul

- Başlangıçta hiçbir soru/gün seçili değil. Bir soru, iki gün seçildi; saat 18:00 ve süre 20 dakika olarak değiştirildi; önizleme doğru gösterdi.
- Uygulama kaydedip yanıtı kaybettiğinde sayfa yeniden açıldı. Aynı istek kimliğiyle iki buluşma geri alındı; ikinci kayıt oluşmadı.
- İnceleme değişti hatası açıkça gösterildi; kesin reddedilen istek belirsiz kayıt gibi tutulmadı.
- Takvimden 5 Kasım buluşması açıldı; kaynak Prova bağlantısı görüldü. Kaynak bağlantısı olan etkinlikte kaydedilmemiş düzenleme varken bağlantı pasif olur.
- Kayıttan sonra kaynak soru numarası korunur; sorunun yeni bir çalışmada doğru cevaplanması geçmiş bağlantıyı silmez.
- Telefon ve tablette yatay taşma yok; büyük yazıda sütunlar alt alta geçer. Dokunma alanları mevcut ortak kontrolleri kullanır.

## Sunucu ve sınırlar

`085000`: canlı veli/aile sınırı, güncel sınıf ve son 90 gün içinde yanlış şıklı / veli incelemeli kısmi açık uçlu cevap seçimi. AI önerisi veya boş cevap tek başına tekrar gereksinimi sayılmaz. Daha yeni tamamlanmış gözlem önceki soruyu öneriden çıkarır.

Bir kaynak Prova için en fazla üç hatırlatmalık tek plan; atomik takvim kaydı, kalıcı yanıt, kaynak imzası ve eşzamanlı değişim denetimi vardır. Takvim kaydı yeni sınav, ödül veya görev tamamlanması değildir. 1/3/7 gün yalnız değiştirilebilir başlangıç önerisidir, optimal süre veya öğrenme garantisi iddiası yoktur.

Takvimden silinen hatırlatma yeniden oluşturulmaz. Başka çocuğa/aileye yeniden atanan etkinlik eski Prova bağından ayrılır. Kaynak çocuk/Prova silinince bağlı hatırlatmalar temizlenir; bütün aileye görünür hâle dönüşmez. Eski planı sınırsız yeniden üretme yok; mevcut tarihler takvimden düzenlenebilir.

40 yeni SQL kontrolü; 63 dosyada toplam 1.725 kontrol geçti. Aynı istek, iki farklı istek, inceleme değişimi ve çocuk silme için dört gerçek eşzamanlı DB testi ayrı atılabilir audit veritabanlarında geçti. Core 164 test, mobil tip/lint ve core tip kontrolleri geçti. Gerçek aile verisi değiştirilmedi, ücretli model çağrısı yapılmadı. Migration/istemci henüz dağıtılmadı; TestFlight 17 değişmedi.
