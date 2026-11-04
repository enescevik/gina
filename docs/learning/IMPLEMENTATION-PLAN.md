# 3 Kasım 2026 — yayından önce kapsamı tamamlama kararı

Kullanıcı: **“Hepsini bitirelim sonra yayına alırız.”** Önceki TestFlight dağıtım önceliği ertelendi. Aşağıdaki işler bitmeden yeni TestFlight/mağaza/kablosuz iPad yayını yapılmayacak. Bir PR'ın birleşmesi yayın anlamına gelmez. Yerel geliştirme ve izole testler sürer. Gerçek aile kayıtları reset/reseed edilmez. Önceden ertelenmiş gün/gece/hava ve geniş maskot animasyonları ilk sürüm dışında kalır.

Onaylı maketi bulunan ekranlarda o maket korunur. Ayrı maketi olmayan ekranlar için kullanıcının sonraki kararı geçerlidir: “Onaylı ekranların ortak tasarımını bu ekranlara uyarla”. Gelişim ekranı maketi `docs/design/screens/learning-progress/phone-tablet-proposal-v1.png`: **onaylandı ve uygulandı**. Gerçek web bileşeni telefon/tablet önizlemeleri aynı klasörde; native cihaz ve yayın kabulü sürer.

| İş | Güncel durum / kapanış koşulu |
|---|---|
| Birleşik Prova | PR #57 main’de; sonraki yayın kaydı SHARED-DESIGN-17.md: TestFlight 17 ve sunucu 040000’e kadar dağıtıldı. Kütüphane edinimi 050000 ve bu artım henüz dağıtılmadı. |
| Defter/iPad hataları | PR #54/#55 ve #66 düzeltmeleri var. Dikey soru başlığı kesilmesi ve defter devamının belirsizliği giderildi; iPad simülatörü/dört web ölçüsü kanıtı notebook-visible-content klasöründe. Fiziksel cihaz yön/klavye/kalem/tam alan kontrolleri açık. |
| Kalıcı cevap kurtarma | Bu artım: cihazda son cevap + belirsiz istek saklanır; yeniden açılış ve çakışma kontrolleri. Salt çevrimdışı sınav açma/soru indirme değildir. Native cihaz kontrolü açık. |
| Gelişim raporu | Bu artım: aile/sınıf/program ayrı hesap, bekleyen/boş/kısmi ayrımı, kanıt soruları. Onaylı ekran uygulandı: 7/30/90 gün, sınıf/ders filtresi, soruya doğrudan geçiş, az gözlem ayrımı. Telefon/tablet web kabulü geçti; native kabul açık. |
| MEB/müfredat | 16 resmî 2026–2027/1 tablo ve 648 senaryo adayı; 62 sınıf–ders grubunda 708 çıktı aday kaydı kaynak hücrelerine bağlandı. Dört kodsuz yönerge, altı metin varyantı ve 17 senaryo uyarısı inceleme bekliyor. Tam 1–12 program/çıktı kataloğu değildir. 076000 ile veli okul senaryosunu çocuk/ders, konu/adet ve son kontrol adımlarında girebilir; AI üretimi kaydedilmiş Prova ve güncel çocuk sınıfına bağlanır. 078000 ile kaynak adaylarını içe alma, program/okul kapsamı incelemesi, ayrı yayın/geri çekme ve sınıfa göre salt okuma API’si eklendi. 648 adayın taslak aktarımı test edildi; gerçek kaynak onayı yapılmadı. 079000 ile veli sınıf/ders/yıl/yazılı filtresi, okul kapsamı doğrulaması ve kalıcı kaynak sürümü seçimi tamamlandı. AI bu özel kaynağa ve kaydedilmiş çocuk/yazılı taslağına bağlanır; yeni üretim öncesi yayın/sınıf/sayı tekrar denetlenir. Kaynak geri çekilince eski Prova değişmez, yeni ücretli çağrı başlamaz. Tam program eşlemesi, gerçek editör incelemesi, AI/cihaz kabulü açık. Kanıt: `docs/design/screens/curriculum-review/README.md`. |
| 20 soru / sınıf–ders | 77 hücre / 1.540 hedef. PR #79 aile edinimi/aylık kota ve Prova seçimini tamamladı; migration 20261103050000 henüz canlıda değil. 5. sınıf Matematik 20 + Fen 20 + 6. sınıf Matematik 20 = **60 taslak**, **0 alan editörü onaylı**, **0 yayımlı**; kalan **1.480**. Güncel sayım library-pilot/coverage.json. Soru/senaryo adayları onay sayılmaz. |
| Görselli/ortak kaynak katkısı | 077000: bütün grup önizlemesi, ayrı kullanım onayı, bağımsız PNG, soru bazında yönetim incelemesi, ayrı kütüphane taslağı ve tekil ödül eşikleri uygulandı. 53 SQL kontrolü, dört eşzamanlılık senaryosu, Edge/core ve telefon/tablet sentetik web kabulü geçti. Kanıt: `docs/design/screens/contribution-review/README.md`. Yeni özellik kapalı; gerçek Storage/cihaz kabulü ve dağıtım açık. Eski uç noktanın medya engeli korunur. |
| Toplu Prova | Katılım/sonuç ekranı düzeltildi; üç katılım-kota-iptal yarışı, iki bildirim yarışı ve web kabulü geçti. 063000 farklı Prova bildirimlerinin kaybını düzeltir. 065000 ile yeni sürümlü/görselli/ortak kaynaklı kütüphane bağlandı; ortak kaynaklar bütün seçilir, çoktan seçmeli soruların sabit sürümü aileye aktarılır. Kaynak geri çekme ve katılım yarışı doğrulandı. 081000 ile şıklı/açık uçlu ortak setler, ayrı cevap inceleme onayı, sabit ölçütlü merkez puanlaması, özel veli itirazı, geçmiş ve ayrı sonuç yayını tamamlandı. 58 yeni SQL, dört yarış ve telefon/tablet sentetik UI kabulü geçti. Kanıt: cohort-written-review/README.md. 082000 sonuç yayınına tercihe/oturuma bağlı, eski sürümü hedeflemeyen aile başına tek bildirim olayı ekler. Gerçek editör/cihaz kabulü, 083000 cihaz bazında makbuz, kısmi hata tekrarları, işlem süresi, Retry-After ve eski yanıt korumasını tamamlar. 084000 başarısız gönderimler için canlı yayın rolü, açık gerekçe, kalıcı komut ve kabul edilmiş cihazları koruyan sınırlı operatör kurtarmasını tamamlar. Telefon/tablet/masaüstü sentetik kabul ve üç DB yarışı geçti. APNs/FCM fiziksel teslimi ve kontrollü açılış açık. |
| Backoffice | Destek/fikir ve sürümlü SSS sunucu sözleşmesi, süreli dar operatör rolleri, 70 SQL kontrolü eklendi; veli, operatör ve SSS ekran entegrasyonları aşağıdaki kabul sınırlarıyla tamamlandı. Veli Yardım ekranı PR #61 ile main’de; destek/fikir/SSS arama ve güvenli gönderim web kontrolü geçti. Operatör destek ekranı onaylandı ve uygulandı: canlı destek rolü, özel not/yanıt, durum/kategori kuyruğu, kayıp gönderim kurtarma ve web kontrolleri tamamlandı. Mevcut aile/kütüphane/AI ekranları var. Onaylı SSS editörü uygulandı: ayrı taslak/yayın önizlemesi, gerekçeli inceleme/yayın/arşiv, kalıcı işlem kurtarma ve 25 ek SQL kontrolü. 070000 ile mağaza bildirim doğrulaması ve kesinti kurtarma eklendi; 071000 ile aile eşlemesi ve sürüm sırası tek işlemde güvenceye alındı; gerçek mağaza kabulü açık. 072000 finans inceleme ekranında mağaza/beta/geçici hak ayrımı ve güvenli bildirim kuyruğu tamamlandı. 073000 ile yeni backoffice hak verme/sonlandırma kayıp yanıt ve yeniden açılışa dayanıklı; özel işlem kaydı ve tablet kartları kabulü geçti. 074000 mevcut aboneliğe gerekçeli operatör doğrulamasını, atomik sonuç ve kesinti kurtarmayla ekler; web/izole kabul geçti. Gerçek iade, henüz bağlanmamış mağaza kaydı/geçmiş bildirim kurtarma, canlı operasyon kurulumu ve native kabul açık. |
| AI sağlayıcıları | 080000 ile Prova üretiminde cihazda kalıcı istek/sonuç, özgün model/istem/kaynakla sunucu kurtarması ve yeni ücret başlatmayan kontrol eklendi; iptal/rezervasyon yarışı ve çoklu soru seçimi kabulü geçti. Eski bağlamsız işler otomatik yeniden üretilmez. 088000 haftalık özette aile erişim sınırını, asgari veri girdisini, sabit hafta bağlamını, paket kotası/işlem sahipliği ve kayıp yanıt kurtarmasını ekler; 46 SQL ve dört yarış ile 17 Edge kontrolü geçti, henüz dağıtılmadı. Anthropic mevcut. PR #85 ile 11 arıza/limit/ücretli yeniden deneme kontrolü eklendi (toplam 101 Edge testi); boş yanıt ve geçersiz token sayısı reddedilir. Doğrulanmış başka adapterler, model/iş politikaları ve canlı sağlayıcı kabulü açık. Desteklenmeyen sağlayıcı kaydı etkinleştirilemez. |
| Öğrenme yardımcıları | Göreve bağlı cihazda kalıcı odak sayacı uygulandı; telefon/tablet web ve çekirdek kontrolleri geçti, native kabul açık. İncelenmiş yanlış/kısmi yanıtlardan tekrar seçimi birleşik Prova’ya bağlandı (060000, henüz dağıtılmadı); 085000 incelenmiş kaynak sorulardan veli seçimli, düzenlenebilir en fazla üç tekrar buluşmasını atomik takvim kaydına bağlar; kayıp yanıt, kaynak değişimi, çocuk silme ve yeniden atama kontrolleri geçti. Fiziksel kabul açık. Veli plan asistanında seçilen günler → düzenleme → önizleme → atomik takvim kaydı tamamlandı (062000, henüz dağıtılmadı); fiziksel kabul açık. 075000 ile belge → çoklu görev/ödül taslağı, kaynak bağlantısı ve hedefte kaynak önizlemesi tamamlandı; gerçek belge/cihaz kabulü açık. Ödev/ders/kurs ortak planının kalan akışları açık. |
| Görev/ödül kayıt güvenliği | 064000: elle veya seçilen üç AI önerisinin kalıcı tekil kaydı; kayıp yanıt/yeniden açılış ve kota yarışı kabulü geçti. Telefon/tablet web kanıtı setup-save-recovery klasöründe; üretim ve fiziksel cihaz kabulü açık. |
| Takvim kayıt güvenliği | 086000 elle ders programına veli/çocuk için kalıcı istek/makbuz kurtarması ekler; eski makbuz yeni düzenlemeyi ezmez. 33 SQL ve dört gerçek yarış ile telefon/tablet sentetik kabul geçti, henüz dağıtılmadı. 061000: kayıp yanıt kurtarma, revizyon çakışması, aile–çocuk RLS sınırı; 24 SQL + dört gerçek yarış + telefon/tablet web kabulü. PR #82 main’de, henüz dağıtılmadı. 062000 plan asistanının seçilen günlerini toplu uygular. |
| Yayın kabulü | Expo 58.0.23 uyumu ve üç platform JS paket kabulü geçti; CLI Zod yüksek önem istisnası kaldırıldı. Orta/düşük araç zinciri bulguları kayıtlı. Canlı hizmet, native binary/gerçek cihaz, güvenlik/performance ve aynı commit'ten iki dağıtım; **en son**. |

Maliyet veya işlem kotasının varlığı, kaynağı doğrulanmamış içerikleri yayımlama gerekçesi değildir. Görseller/raporlar kişilik, zekâ, teşhis veya resmî yeterlilik iddiası taşımaz.

---

# GINA belge, öğrenme ve yönetim uygulama planı

Durum: **kapsam onaylandı; uygulama sürüyor. Güncel kanıt ve eksikler DEVELOPMENT-STATUS.md dosyasında.** Tarih: 2 Kasım 2026. Bu dosya araştırma raporunu uygulanabilir işlere böler. Yeni ekranların veya sunucu işlevlerinin tamamlandığını, üretime alındığını ya da TestFlight’a gönderildiğini göstermez.

Araştırma: [GINA öğrenme ve yönetim](../../reports/GINA%20öğrenme%20ve%20yönetim.md). Kaynak notları: [belgeden aktarım](../../research_notes/GINA%20öğrenme%20ve%20yönetim/document-import.md), [rakipler](../../research_notes/GINA%20öğrenme%20ve%20yönetim/competitors.md), [yönetim ve müfredat](../../research_notes/GINA%20öğrenme%20ve%20yönetim/admin-curriculum.md).

## Mevcut temeli koru

| İncelenen temel | Kullanılacak yaklaşım | Eksik olarak ele alınacak fark |
|---|---|---|
| `apps/mobile/src/components/planner/timetable-editor.tsx` ve `save_school_timetable` | Veli/çocuk düzenleme, saat doğrulaması, revizyon çakışması ve takvim üretimini yeniden kullan. | Veliye özel belge seçimi, kontrol taslağı ve kaynak bağlantılı kayıt. |
| `apps/mobile/src/app/parent/prova/*`, `supabase/functions/prova-*` | Soru bankası, üretim, sonuç inceleme, ilerleme, plan, kitapçık ve seviye akışlarını genişlet. | Kaynak sorusu, cevap kökeni, görsel parça ve tekrar adımı ilişkileri. Mevcut plan durumu onayı otomatik görev oluşturma sayılmaz. |
| `apps/backoffice/src/pages/*` | AI ayarları, aile arama, süreli erişim, global sorular ve denetim altyapısını koru. | Mint/mor/krem tasarım, özellik yayını, import izleme, destek/fikir/SSS ve sağlayıcı durumlu operasyon. |
| `docs/PROVA.md` | Ürün gerekçesi için kaynak. | Sonundaki eski checklist kodun mevcut durumuna göre düzeltilmeli; kutucuklar tek başına yapılmamış özellik kanıtı değil. |

Bu envanter kod okumasına dayanır; yeni cihaz veya canlı ekran testi yapılmış sayılmaz. Mevcut aile/çocuk kayıtları, yerel değişiklikler ve onaysız asset denemeleri korunur. Onaylı logo, mint maskot, mor/krem tasarım ve statik oda kullanılır; yeni 3B dünya veya atmosfer çalışması bu kapsamın ön koşulu değildir.

## İlk dikey teslim: kaynaktan haftalık programa

### Kullanıcı yolu

1. Veli mevcut ders programından **Fotoğraf veya dosyadan ekle**yi açar. Ayrı bir “AI uygulaması” veya tekrarlanan ana menü oluşturulmaz.
2. Cihazda dosyayı seçer; ilgili sayfa/alanı ve hedef çocuğu kontrol eder. Kamera/dosya izni ile AI işleme onayı ayrı tutulur. Onay öncesi dosya yüklenmez.
3. Veli seçilen içeriğin GINA’ya ve Anthropic’e gönderileceği açıklamasını görür; saklama seçimini yapar. Belge/sayfa/içerik veya amaç değişirse onay yenilenir.
4. İşleme durumunu görür. Bağlantı kapanıp açıldığında aynı iş bulunur. Aynı iş/kayıt çoğaltılmaz; sağlayıcı sonucu belirsizse otomatik yeniden ücretli çağrı yapılmaz, durum uzlaştırılır.
5. Kaynak ile düzenlenebilir ders taslağını karşılaştırır. Telefonda kaynak/taslak sekmeleri, tablette yan yana görünüm. Gün/saat belirsizlikleri, çakışmalar, yeniden aktarma uyarısı ve kaydedilecek öğe sayısı açık olur.
6. **Seçilenleri programa ekle** bir atomik uygulama çağrısı yapar. Mevcut program varsa ekleme/değiştirme etkisi açıkça önizlenir; sessiz toplu silme yoktur.
7. Ders programı ve üretilen takvim kayıtları kaynağa bağlanır. “Kaynağı gör” aynı özel dosyayı açar. Çocuk manuel program düzenleyebilir, AI çağrısını başlatamaz.

### İş akışı ve sözleşme

`yerel seçildi → onaylandı → yüklendi → sırada → işleniyor → kontrol bekliyor → uygulandı`; ayrıca `başarısız`, `reddedildi`, `süresi doldu`, `vazgeçildi`.

| Kayıt | Asgari sözleşme |
|---|---|
| Kaynak | Aile, yükleyen veli, içerik hash’i/sürümü, gerçek MIME, boyut, sayfa sayısı, özel storage yolu, saklama sonu, silinme durumu. |
| İşleme onayı | Veli, kaynak hash’i, seçili sayfalar, amaç, sağlayıcı, açıklama sürümü, zaman. |
| İş | Kaynak ve onay, hedef çocuk/tür, durum, aile kapsamında tekil işlem anahtarı, model/schema/prompt sürümleri, kota rezervasyonu ve hata kodu. |
| Taslak öğesi | Türüne göre doğrulanmış alanlar, kaynak sayfası, belirsizlik nedeni, seçilme durumu, veli düzeltmeleri. |
| Uygulama kaydı | Taslak revizyonu, tekil kayıt anahtarı, oluşturulan/güncellenen kayıtlar ve kaynak ilişkileri. |

Kaynak URL’sini model oluşturmaz; sunucu sayfa kimlikleri verir ve dönen referansları doğrular. İlk teslim sıkı JSON + uygulama tarafından doğrulanan belge/sayfa bağı kullanır. Görüntüden çıkarım “doğrulanmış alıntı” olarak etiketlenmez. JSON şeması tek başına yeterli değildir; gün, saat, süre, sayfa aralığı, aile/çocuk sahipliği ve iş kuralları sunucuda tekrar kontrol edilir.

### Dosya ve mahremiyet

Başlangıç ürün sınırı önerisi: JPEG/PNG, dönüştürülmüş HEIC, şifresiz PDF; tek belge, en çok beş sayfa; fotoğraf başına 4 MB ham veri, PDF başına 10 MB. MIME/uzantı, magic bytes, sayfa ve piksel sınırları birlikte denetlenir. DOCX/XLSX desteklenene kadar açıkça kapsam dışı gösterilir. PDF karartma hazır değilse kişisel bilgi içermeyen belge veya kırpılmış görüntü seçimi yönlendirilir; güvenilir karartma varmış gibi davranılmaz.

Dosya özel aile depolamasındadır. Ham belge, base64, imzalı URL, gizli anahtar ve çocuk bilgisi operasyon loguna yazılmaz. Belge içinde bulunan talimatlar güvenilmeyen içeriktir; AI’a ağ/ödül verme/kayıt yazma araçları verilmez. Kaynağı birden çok hedefte kullanmak ek dosya kopyası üretmez. Aile belgesi veya soruları kendiliğinden global soru bankasına taşınmaz.

“Kaynağı sil” dosya, crop, sayfa önizlemesi ve OCR türevlerini temizler; onaylanmış derslerin korunacağı önceden gösterilir. “Aktarılan kayıtları kaldır” ayrı ve etkisi önizlenen işlemdir. Terk edilmiş işler ve yetim yüklemeler temizlenir. GINA silmesi Anthropic tarafında anlık silme garantisi diye anlatılmaz. Saklama süresi ve veliye gösterilecek metin, uygulama öncesi ürün kararı olarak netleştirilir.

### İlk teslim kabul testleri

- Onay verilmeden hiçbir dosya upload’u veya AI çağrısı yok; onaylı hash değişince yeniden onay gerekiyor.
- Çocuk rolü ve başka ailenin velisi import başlatamıyor, taslağı/kaynağı okuyamıyor veya uygulayamıyor.
- Süresi biten/iptal edilen aile üyeliği veya oturum yeni kaynak erişimi elde edemiyor; imzalı URL ömrü açıkça sınırlı. Ücretli paket süresinin bitmesi ailenin kendi mevcut kaynağına erişimini kaldırmıyor.
- Bozuk, şifreli, MIME taklitli, çok büyük veya sayfa sınırını aşan dosya anlaşılır mesajla reddediliyor.
- Ters/kötü ışıklı çizelgede belirsiz alan sessiz doldurulmuyor; gün ve saat düzenlenebiliyor.
- Belgedeki “onayı atla / tüm ödülleri ver” metni uygulama eylemine dönüşmüyor.
- Çift dokunma ve kayıp ağ yanıtından sonra aynı iş ve aynı kayıt sonucu dönüyor; yeni kayıt çoğalmıyor.
- İki velinin eşzamanlı taslak/program düzenlemesinde revizyon çakışması görünür; son yazan sessizce ezmiyor.
- Çoklu kaydın ortasında hata olduğunda program ve kaynak linkleri kısmen oluşmuyor.
- Eşzamanlı işler kota aşamıyor; başarısızlık/yeniden deneme/sağlayıcı sonucu belirsiz durumu ayrı izleniyor.
- Telefonda dikey, tablette yatay kaynak karşılaştırması; büyük yazı, ekran okuyucu, 48 dp hedefler ve azaltılmış hareket kontrolü geçiyor.
- Gerçek aile dosyası yerine izinli/sentetik değerlendirme kümesiyle Türkçe tablo, kısaltma, saat, hafta sonu ve boş alan örnekleri ölçülüyor.

## Sonraki artımlar

| Öncelik | Kapsam | Tamamlanma ölçütü |
|---|---|---|
| P1 | Belgeden ödev/görev: ders, konu, teslim, küçük adımlar | Aynı kaynak altyapısı; tarihsiz bilgiye tarih uydurma yok; dersle bağlı görünürlük. |
| P1 | Göreve bağlı odak sayacı | Başlat/duraklat/mola/bitir; arka plan ve yeniden açılışta zaman tutarlı; bitiş görevi otomatik tamamlamıyor; süre başarı yerine geçmiyor. |
| P1 | Destek, fikir ve SSS | Veli akışı, ayrı kuyruklar, durumlar, geri dönüş geçmişi; özel içerik herkese yayımlanmıyor. |
| P2 | Ödül/hedef belgesinden tanım | Puan bakiyesi, kazanılmış ödül ve tamamlanmış görev geçmişi değişmiyor; yalnız veli onaylı tanım. |
| P2 | Prova sorusu aktarımı | Soru/şık/görsel kaynağı, cevap kökeni ve AI açıklaması ayrı; eksik diyagram veya doğrulanmamış cevap yayımlanmıyor. |
| P2 | Tekrar defteri ve analizden eylem | Yanlış/boş soru, kaynak ve konu ile bağlanıyor; gerekçeli tekrar adımı veli kontrolüyle ekleniyor; toplam netten konu uydurulmuyor. |
| P2 | Veli plan asistanı | Gözlemi, öneriyi ve takvime uygulanacak değişikliği ayrı gösteriyor; otomatik çocuk AI sohbeti veya onaysız plan değişikliği yok. |
| P3 | Müfredat pilotu | Bir sınıf/ders; kaynak sürümü ve yürürlük yılı doğrulanmış, insan incelemesi tamamlanmış; sürüm değişiminde geçmiş korunuyor. |
| P3 | Çantam hazır mı / Birlikte bakalım | 087000: takvimde çocuk/gün bazında veli/aktif çocuk malzeme listesi, ders sürümü kontrolü, tarihsel ders görüntüsü ve kayıp yanıt kurtarma uygulandı. Telefon/tablet web ve izole DB kabulü geçti; fiziksel kabul/dağıtım açık. Haftalık “Birlikte bakalım” ana ekrandaki ortak tasarımlı özet alanında üç konuşma sorusu ve isteğe bağlı takvim geçişiyle uygulandı; kayıtlar onay/bekleyen/geri dönen ayrımıyla, çocuklar arası sıralama olmadan gösterilir. Konuşma kaydedilmez/AI’a gönderilmez. Telefon/tablet sentetik kabul geçti; fiziksel kabul açık. Yeni ana menü yok. |

## Backoffice operasyon kapsamı

### Bilgi mimarisi ve tasarım

Mevcut panelin sade teal/slate görünümü, onaylı GINA mint/mor/krem kimliğine taşınır. Yoğun tabloların okunabilirliği korunur; maskot yalnız anlamlı boş/işlem durumlarında görünür. Ana görünüm sorun kuyruğudur; aile/hesap, abonelik/erişim, öğrenme içeriği, AI/aktarım, destek/fikir/SSS ve yayın ayarları görevlerine göre gruplanır. Aynı işlem birçok sayfada farklı isimlerle tekrarlanmaz.

### Özellik kontrolü

Özellik kaydı ortam + işlev + kohort + paket + süre kapsamı taşır; sunucuda yetki ve kota kontrolünün yerini alamaz. Genel AI durdurma, belge işleme, öneri üretme ve Prova üretme ayrı kontrol edilebilir. Kapatma mevcut verileri silmez; yeni yazma/üretimi durdururken okuma ve dışa aktarma mümkün olduğunca sürer. **Giriş, güvenlik, hesap silme ve temel haklar keyfî satış anahtarı değildir.** Değişiklik önizlemesi, gerekçe, operatör ve geri dönüş kaydı gerekir.

### Satın alma ve erişim

Mağaza aboneliği sağlayıcı doğruluğudur; süreli destek erişimi ve test paketi ayrı kaynaklar olarak görünür. Apple’da talep yönlendirmesi, doğrulanmış durum ve uygun tüketim bilgisi akışı; “Apple iadesini onayla” düğmesi yok. Google’da sipariş iadesi, yenilemeyi durdurma ve erişimi geri alma ayrı eylemlerdir. İşlem önizlemesi hedef sipariş, tutar/para birimi, ortam ve erişim etkisini gösterir. Sonucu belirsiz işlemler sağlayıcıdan uzlaştırılmadan yeniden gönderilmez. Finans yetkisi, destek yetkisinden ayrılır; log silme yetkisi operatöre verilmez.

### Hesap ve destek

Aile arama, aktif cihaz/PIN/üyelik sorunları, aile geçişi ve hesap silme talepleri yetkili görevlerle ilişkilendirilir. Destek için en az gerekli veri; otomatik hesap birleştirme veya çocuk belgelerini inceleme yetkisi yoktur. Fikir kayıtları destekten ayrıdır. SSS taslak → inceleme → yayın akışıyla, platform ve son inceleme tarihiyle yönetilir. AI cevap önerisi taslak kalır; otomatik mesaj gönderimi veya finansal işlem bu MVP’ye dahil değildir.

### Yönetim kabul testleri

- Her eylem hedef kaynak ve canlı rol/yetkiyle sunucuda doğrulanıyor; yalnız UI’da gizlemek yeterli değil.
- Süreli erişim sona eriyor; başka geçerli mağaza hakkını yanlışlıkla iptal etmiyor.
- Özellik kapalıyken doğrudan API çağrısı da engelleniyor; eski kayıt okuma davranışı test ediliyor.
- Mağaza test/üretim ortamları ve para/erişim durumları ayrı; yinelenen bildirim ve komut güvenli.
- Support/finans/içerik/yayın rollerinin veri kapsamı ve denetim izi test edilmiş.
- Destek eki ve fikirler aile sınırını aşmıyor; SSS özel yazışmayı yanlışlıkla yayımlamıyor.

## Yayın kapısı

Bu planın ilk uygulaması ayrı incelenebilir PR’larla ilerler. Mobil değişikliklerde mevcut Expo 58 yönergeleri ve izin açıklamaları uygulanır; resmî paket eklenirse yeni native derleme gerekir. Tip kontrolü, lint, yetki/atomiklik/kota testleri, telefon/tablet görüntüleri ve seçilmiş gerçek cihaz akışları tamamlanmadan “hazır” denmez. Raporun tamamlanması, yeni özelliklerin TestFlight’ta bulunduğu anlamına gelmez.

### 4 Kasım artımı: belge → görev/ödül

Kod ve sentetik kabul tamamlandı: belge izinleri, kaynakla ilişkili düzenlenebilir taslaklar, çoklu kayıt, ödül üzerinden hedef kaynağı, kayıp yanıt kurtarma ve AI lease koruması. Kanıt: `docs/design/screens/document-setup/README.md`. 075000 + Edge henüz dağıtılmadı. Tam ödev/ders/kurs planı, gerçek sağlayıcı/cihaz kabulü ve diğer açık maddeler kapanmış sayılmaz.
