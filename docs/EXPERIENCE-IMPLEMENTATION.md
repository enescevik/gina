# GINA deneyim iyileştirmelerinin uygulama takibi

5 Kasım 2026. Kullanıcı inceleme planını onayladı. Onaylı tasarım kimliği korunacak; mevcut işlevler sessizce kaldırılmayacak. Kütüphane sorularının toplu üretimi, önceki karar gereği en sonda.

İlk paket: [değişiklikler ve kontrol kanıtları](release/experience-foundation-2026-11-05/README.md). **Aşağıdaki açık işler tamamlanmış sayılmaz.**

## Faz durumu

| Faz | Durum |
|---|---|
| 1 — Kapsam ve durum doğruluğu | Temel değişiklikler uygulandı; yerel kabul geçti. Cihaz/PIN taslak koruması ve fiziksel cihaz kabulü açık. |
| 2 — Ortak seçim ve düzeltme | Tarih/saat/puan ve zil editörü uygulandı. Mevcut kayıtların geçmişi koruyan düzenlemesi açık. |
| 3 — Veli günlük akış ve kurulum | Açık. |
| 4 — Çocuk ve Prova bütünlüğü | Görsel/teslim/geçici sonuç temeli uygulandı; kalan kapsam açık. |
| 5 — Yönetim çalışma alanları | AI/katalog görünümü ve taslak koruması uygulandı; kalan kapsam açık. |
| 6 — Cihaz, erişilebilirlik ve yayın | Açık. Web önizlemesi fiziksel cihaz kabulünün yerine geçmez. |

## Ekran ve alt akış bazında kalan kapsam


### Hesap, aile ve günlük veli işleri

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| Başlangıç `/` | Açık / yeniden doğrulanacak | Rol, cihaz ve şifre yenileme yönlendirmelerini ayrı durumlarla koru; burada doğrulanmış bir tasarım kusuru yok — Her rol doğru alana ulaşır; çocuk kilidi geçmiş gezinmesiyle aşılmaz |
| Giriş / kayıt `/(auth)/sign-in` | Açık / yeniden doğrulanacak | Giriş ile kayıt gerekliliklerini ayır; devre dışı sosyal girişin nedeni anlaşılır olsun; çocuk cihazı alternatifini açık göster — Dönen kullanıcı neden işlem yapamadığını anlar; yetişkin kayıt şartı korunur |
| Aile kur / katıl `/(auth)/family` | Açık / yeniden doğrulanacak | Başta “Yeni aile kur / Mevcut aileye katıl” niyeti; hesap silme ilk kurulumun ana seçeneği olmasın — Eşinin ailesine katılacak kişi yanlışlıkla ikinci aile kurmaz |
| Şifre yenile `/reset-password` | Kısmi: Şifre görünürlüğü eklendi. Gerçek kurtarma bağlantısı kabulü açık. | Girişteki gibi şifre görünürlüğü; süresi dolmuş bağlantıdan doğrudan yeniden isteme — İki giriş kontrol edilir; kullanıcı çıkışsız hata ekranında kalmaz |
| Giriş dönüşü `/auth-callback` | Açık / yeniden doğrulanacak | İptal, teknik hata ve tamamlanmayı ayır — İptal kullanılabilir girişe döner; sonsuz yükleme olmaz |
| Cihaz eşleme `/device/pair` | Açık / yeniden doğrulanacak | İki cihazda yapılacakları görsel adımlarla anlat; kodun nereye girileceğini göster; QR ayrı sonraki özellik önerisi — İlk kullanımda başka menü tahmin edilmez; süre dolunca yenilenir |
| Bugün `/parent` | Kısmi: Çocuk/tarih/görev bağlamı ve bekleyen/onaylı ayrımı uygulandı. Ana iş önceliği ve tekrarların azaltılması açık. | Onay ve sıradaki iş öne; selamlama/maskot kompakt; aynı verinin tekrarı azaltılsın; bağlantılar bağlamı taşısın — İlk görünümde anlamlı bir sonraki iş; doğru çocuk/gün/kayıt açılır |
| Takvim `/parent/calendar` | Kısmi: Tümü kapsamı ve etkinlikte tarih/saat kontrolü uygulandı. Günün birleşik bilgi hiyerarşisi açık. | Tümü kapsamını düzelt; etkinlik, ders ve ödevi aynı gün altında ayrı anlamlarla göster — İki çocuklu ailede hiçbir iş sessizce ilk çocuğa bağlanmaz |
| Görevler `/parent/tasks` | Açık / yeniden doğrulanacak | Günlük gerçekleşme ile rutin ayarını ayır; ayrıntı ve güvenli düzenleme ekle — Ad/gün/yıldız düzeltmesi kopya görev veya geçmiş puan değişimi üretmez |
| Ödüller `/parent/rewards` | Açık / yeniden doğrulanacak | Düzenleme, teslim geçmişi ve talep durumları; yanlış ret/iptali önleyen sonuç açıklaması — Bedel değişiminin önceki taleplere etkisi açık; teslim edilmiş ödül bulunur |
| Diğer / ayarlar `/parent/menu` | Açık / yeniden doğrulanacak | Hesap, aile, cihazlar, öğrenme kayıtları ve yardım grupları; aynı düzeyde tutarlı gezinme — PIN, okul puanı ve destek beklenen kategoride bulunur |
| Cihaz erişimi `/parent/device-access` | Açık / yeniden doğrulanacak | Kullanıcı/PIN politikası taslağını koru; eksik PIN oluşturup aynı taslağa dön; kayıt özeti — Geri gitmek seçili çocukları sessizce kaybettirmez |
| Aileler `/parent/families` | Açık / yeniden doğrulanacak | Etkin aile durumu; katılma ve değiştirmeyi ayır; çocuk sayısı ve sonuç özeti — Aile değiştirmek veri birleştirme sanılmaz |
| Okul puanları `/parent/grades` | Kısmi: Ders kataloğu, tarih ve ondalıklı puan seçimi uygulandı. Düzenleme/geçmiş/arama/sayfalama açık. | Ders ve tarih seçimi, puan kontrolü, düzeltme/geçmiş, arama/sayfalama — Yanlış kayıt düzeltilir; 200 üzerindeki eski kayıt ulaşılabilir |
| Notlar `/parent/notes` | Açık / yeniden doğrulanacak | Liste filtresinden bağımsız not hedefi; kim görecek özeti; etiketler, düzenleme — Kaydetmeden çocuk ve izleyici açık; yanlışlık düzeltilebilir |
| Bildirimler `/parent/notifications` | Açık / yeniden doğrulanacak | Zil yalnız tercih açıyor; giriş adını düzelt veya ayrı gelen bildirim merkezi oluştur — Zil beklentisi ile hedef aynı; merkez eklenmesi ayrı işlev kapsamıdır |
| Paketler `/parent/subscription` | Açık / yeniden doğrulanacak | Gerçek AI, belge, kütüphane ve kullanım hakları; deneme hakkı ile mağaza aboneliğini ayır — Ekrandaki haklar sunucunun uyguladığı haklarla örtüşür |
| Yardım `/parent/help` | Açık / yeniden doğrulanacak | Bağlama uygun SSS; isteğe bağlı güvenli ekran görüntüsü, yanıt beklentisi — Kullanıcı sorunu rota adı yazmadan anlatır; hata taslağı kaybettirmez |
| Paylaş `/parent/share` | Açık / yeniden doğrulanacak | Bağlantı üretmeden alıcının göreceği veri ve süre önizlemesi; listede arama — Veli hangi veriyi açtığını bilir; önceki bağlantılar bulunur |
| Haftalık özet `/parent/weekly-review` | Açık / yeniden doğrulanacak | Veri dönemi/kapsamı; öneriyi isteğe bağlı düzenlenebilir plana dönüştür — AI kendiliğinden görev atamaz; veli öneriyi düzeltip seçer |
| Görsel kaynakları `/parent/room-credits` | Kısmi: Bağlantı adları düzeltildi. Son uçtan uca kaynak erişimi açık. | Genel düğme adı yerine gerçek kaynak adı ve kısa atıf satırları — Bağlantının adı hedefini doğru anlatır |
| Paylaşılan görünüm `/s/[token]` | Açık / yeniden doğrulanacak | Geçici ağ problemiyle kullanılamayan bağlantıyı ayır; güvenli yeniden dene — Ağ kesintisi yeni bağlantı gerektiriyor sanılmaz; kapalı veriye erişilmez |

### Veli ekranlarının içindeki sihirbaz ve düzenleyiciler

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| Ana ekran onayı ve haftaya açılma | Açık / yeniden doğrulanacak | Geri gönderilen göreve somut düzeltme açıklaması; Bugün sayılarıyla seçili günün planı ayrılmalı |
| Çocuk ekleme: profil, okul, rutinler, son kontrol | Açık / yeniden doğrulanacak | Avatarlar kademeli; sınıf/yaş rahat seçilir; zorunlu öğrenme bilgisi ile isteğe bağlı kimlik ayrılır; seçilen her rutin uzun form açmaz; son kontrolde günler görünür |
| Görev: şablon/kendi/AI kaynağı ve ayrıntı | Açık / yeniden doğrulanacak | Sık kullanan için kısa yol; okul günü/hafta sonu/tek sefer hazır seçenekleri; başlangıç/bitiş ayrıntıları isteğe bağlı |
| Ödül oluşturma ve hedef seçimi | Açık / yeniden doğrulanacak | Yıldız bedeli hazır değer/adım kontrolü; hedef seçiminde mevcut hedef ve birikim; hedef seçmek yıldız harcamak değildir |
| Görev/ödül için AI-belge önerisi | Açık / yeniden doğrulanacak | Örnekli geniş açıklama, dosya sayısı ve işlem hakkı özeti; çoklu seçim korunur; yeniden deneme çift tüketmez |
| Etkinlik düzenleme | Kısmi: Tarih/saat seçimi ve seçili çocuk bağlamı uygulandı. Başlık önerileri ve tekrar kapsamı açık. | Tarih/saat seçici; tür ve başlık önerileri; tekrar eden kayıtta tek gün/tüm seri kapsamı |
| Ders tablosu, tek ders düzenleme, gün kopyalama | Açık / yeniden doğrulanacak | Ders kataloğu; dolu hücre değişimi ve boş hücreye taşıma; hedef günün önce/sonra görünümü, geri alma |
| Zil düzeni | Uygulandı; telefon/tablet web kabulü geçti. Fiziksel cihaz kabulü açık. | Odaklı düzenleme alanı; ilk ders/süre/ara/öğle arası; seçili gün/tüm günler açık; “Uygula” ve “Programı kaydet” aşamaları anlaşılır |
| Program aktarımı: kaynak, kontrol, kaynak kaldırma | Açık / yeniden doğrulanacak | Yeni tablo korunur; belirsizlik hücre üzerinde; kaynak görüntüyle karşılaştırma; ek dosyayı kaldırmak dersleri silmekten ayrı anlatılır |
| Ödev/çalışma listesi, düzenleyici ve belge aktarımı | Kısmi: Tarih/saat ortak kontrolleri uygulandı. Toplu dağıtım ve belge kapsamı açık. | Elle tarih biçimi yerine seçici; belgeye bağlam; işleri günlere topluca dağıtma; kaynak tarihi ve kullanıcının seçimi ayrılır |
| Çanta listesi | Açık / yeniden doğrulanacak | Yarınki derslerden düzenlenebilir eşya önerisi; zorunlu okul talebi gibi sunulmaz; özgür ekleme korunur |
| Çocuk PIN’i, veli PIN’i ve eşleme sonrası erişim | Açık / yeniden doğrulanacak | Tutarlı PIN kontrolü ve yeni PIN doğrulaması; eşleme tamamlandıktan sonra kimlerin kullanacağı/PIN kuralı özetlenir |
| Çocuk silme, hesap silme ve e-posta doğrulama | Açık / yeniden doğrulanacak | İsim/veri etkisi, yeniden doğrulama, kod süresi/yeniden gönderme; mağaza aboneliği yönetimine bağlantı; mevcut silme açıklamaları korunur |
| SSS, destek yazma, görüşme | Açık / yeniden doğrulanacak | Sıradan Türkçe arama terimleri, ilgili yazı önerisi, isteğe bağlı gizlenmiş görsel, taslak koruma ve görüşmeye dönen bildirim |
| Deneme paketi ve paylaşım oluşturma | Açık / yeniden doğrulanacak | Deneme bitişi ile gerçek abonelik ayrı; paylaşılan alanlar ve süre alıcı görünümüyle onaylanır |
| Ortak hata durumu | Açık / yeniden doğrulanacak | Çevrimdışı, oturum bitmiş, yetkisiz ve geçici servis hatası farklı güvenli eyleme yönlendirir; ilgisiz tek sorgu hatası çalışan bütün ekranı kapatmaz |

### Çocuk ekranları ve güvenli devir

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| Cihazdaki çocuklar `/child` | Açık / yeniden doğrulanacak | İzinli profil yoksa yetişkinden yardım ve yeniden deneme; tek profilde gereksiz seçimden kaçın — Çocuk beklemenin nedenini ve yapabileceği adımı anlar |
| Çocuk PIN’i `/child/pin` | Açık / yeniden doğrulanacak | Avatar/ad, dört nokta, sakin hata ve yetişkin yardım yolu; diğer çocuk girişiyle ortak kontrol — Aynı PIN işi iki farklı etkileşim öğretmez |
| Dünyam `/child/today` | Açık / yeniden doğrulanacak | Görev, ödev ve atanmış Prova’yı dikkate alan sıradaki adım; sabit oda korunur — Görevler bittiğinde bekleyen Prova varken bütün gün tamam sanılmaz |
| Görev haftası `/child/week` | Açık / yeniden doğrulanacak | Geri gönderilen işin nedeni ve yeniden deneme; tamamlanmadı ile aynı etikete düşmesin — Çocuk neyi düzelteceğini görür; emeği yok sayılmış görünmez |
| Çocuk takvimi `/child/calendar` | Açık / yeniden doğrulanacak | Bugün/yarın, ödev ve çanta önceliği; kendi ekranında gereksiz kişi filtresi yok — Yarın ne hazırlayacağı tek görünümden anlaşılır |
| Koleksiyon `/child/collection` | Açık / yeniden doğrulanacak | Rozetin anlamı, kazanma koşulu ve kişisel ilerleme; kilitlerden oluşan duvar azaltılır — Çocuk rozet için hangi davranışı sürdürdüğünü söyleyebilir |
| Hedef `/child/goal` | Açık / yeniden doğrulanacak | Mevcut yıldız, hedefe kalan fark, sabit seçim özeti; birikimin korunması — Uzun listede seçilen hedef ve onay görünür |
| Odamı düzenle `/child/room-preview` | Açık / yeniden doğrulanacak | Sahneyi değiştirmeyen seçimi özelleştirme gibi sunma; “Tercihlerim” adı veya geçici gizleme ayrı ürün kararı — Kaydetmenin neyi değiştirdiği önceden ve sonradan açık |
| Provalarım `/child/prova` | Kısmi: Karma sınavda inceleme beklediği gösteriliyor. Süre/tahmin ayrımı açık. | Süreli/tahmini süre ayrımı; şıklı sonuç ile açık uçlu inceleme durumunu birlikte göster — Karışık sınavın kısmi sonucu tamamının sonucu sanılmaz |
| Çözüm `/child/prova/[examId]` | Kısmi: Bağımsız soru görseli yakınlaştırma, teslim ve süreli çıkış kontrolü uygulandı. Araç rehberliği ve cihaz kabulü açık. | Tek çözücü yapısı; okunur soru/görsel; süre uyarısı; teslim öncesi kontrol; araçları bağlama göre aç — Soru/cevap dönüşte korunur; yakınlaştırma çizime dönüşmez; teslim bilinçlidir |
| Veli telefonunda çocuk modu `/parent/child-mode` | Açık / yeniden doğrulanacak | İlk kullanım açıklaması, sonra kısa avatar/PIN akışı; eşleme gerekmediğini belirt — Aynı telefonda çocuk modu ile ayrı cihaz bağlama karışmaz |
| Veli cihazında Dünyam ve yetişkine dönüş `/parent/child-mode/today` | Açık / yeniden doğrulanacak | Çocuk ekranı önde; çıkışta yetişkin adımı ve güvenli kurtarma — PIN/ağ/sosyal hesap dönüşleri çocuk kilidini korur |

### Veli Prova hazırlama, inceleme ve gelişim

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| Prova merkezi `/parent/prova` | Açık / yeniden doğrulanacak | Hazırla, gönderilenler, inceleme ve sonraki adım; aynı sınavın tekrar kartlarını azalt — Veli tek çalışma için hangi kartı açacağını bilir |
| Birleşik hazırlayıcı `/parent/prova/builder` | Açık / yeniden doğrulanacak | Ders seçenekleri soru bankası doluluğundan bağımsız katalogdan; sınıf/program/dönem bağlamı; tek taslakta tüm kaynaklar — Boş bankada da ders seçilir; çocuk değişince uyumsuz kapsam uyarılır |
| Tek soru `/parent/prova/question` | Kısmi: Varsayılan doğru şık kaldırıldı. Adımlı editör/önizleme açık. | Uzun formu soru/görsel → yanıt/ölçüt → önizleme olarak böl; doğru şık başlangıçta boş — Veli bilinçli cevap anahtarı seçer; öğrenci görünümünü kayıttan önce görür |
| Ortak kaynak `/parent/prova/shared-source` | Açık / yeniden doğrulanacak | Ayrı ürün gibi değil hazırlayıcı içindeki soru bloğu; bağlı soru listesi görünür — Aynı sınavda tekil ve ortak metin/görselli sorular birlikte kalır |
| Kütüphane `/parent/prova/library` | Açık / yeniden doğrulanacak | Uygun içerik, ailedeki içerik ve katkılar ayrılır; edinme ile taslağa ekleme açıklanır — Hak ne zaman harcanır bilinir; aynı edinim yeniden tüketmez |
| Resmî senaryo `/parent/prova/catalog` | Açık / yeniden doğrulanacak | Kontrollü öğretim yılı, sınıf/dönem/yazılı özeti; okulun seçtiği senaryo ayrı doğrulanır — Kaynak bulunamadığında uygun soru üretildi izlenimi verilmez |
| Soru dağılımı `/parent/prova/blueprint` | Açık / yeniden doğrulanacak | “Senaryo” belirsizliği yerine Soru dağılımı; konu/kazanım seçimi ve sayı dağılımı — Şablon kaydetmek soru üretmek sanılmaz; hangi Prova’ya ekleneceği açıktır |
| Başlangıç çalışması `/parent/prova/level` | Açık / yeniden doğrulanacak | Standart ölçüm çağrıştıran “Seviye tespiti” dilini düzelt; çocuk sınıfı; üretimden sonra önizleme/atama — Tek örneklem tanı veya kesin yeterlilik sonucu gibi sunulmaz |
| Kitapçık `/parent/prova/booklet` | Açık / yeniden doğrulanacak | Öğrenci nüshası ile cevap anahtarı ayrı; soru seçimi ve sayfa önizlemesi — Çocuğa verilen çıktıya yanlışlıkla çözüm eklenmez |
| Birlikte Prova `/parent/prova/groups` | Açık / yeniden doğrulanacak | Amaç/uygunluk, katılım, sonuç aşamaları; sıralama ikincil ve isteğe bağlı — Sıralamaya katılmadan çalışma yapılır; bekleyen sonuç kesin görünmez |
| Gelişim `/parent/prova/progress` | Açık / yeniden doğrulanacak | Grafiğin hangi sayıyı gösterdiği ve veri kapsamı; konu filtresi ve kanıt sorusuna erişim — Az gözlem aşırı yoruma dönüşmez; bekleyen cevap yanlış sayılmaz |
| Sonuç özeti `/parent/prova/attempt/[attemptId]` | Kısmi: Geçici puan etiketi uygulandı. İnceleme eylemlerinin birleştirilmesi açık. | Önce inceleme durumu, sonra puan; tek “İncelemeyi tamamla”; AI ilgili incelemenin içinde — Eksik puanlama varken sonuç geçici etiketlidir |
| Cevap inceleme `/parent/prova/review/[attemptId]` | Açık / yeniden doğrulanacak | Soru/ortak kaynak/cevap birlikte; şıklı ve açık uçluya uygun alan; ölçüt ve somut geri bildirim — Çocuğun cevabı değişmez; veli hangi kanıta puan verdiğini görür |
| Tekrar `/parent/prova/repeat/[attemptId]` | Açık / yeniden doğrulanacak | Sorular → gün/süre → son kontrol; ortak kaynak grubunu koru — Aynı tekrar iki kez oluşmaz; takvimde günlük yük görünür |
| Çalışma planı `/parent/prova/plan/[planId]` | Açık / yeniden doğrulanacak | Tek Planla alanında mevcut takvim, süre ve çakışma; AI önerisini veli seçer — Gün onayı olmadan takvime iş yazılmaz; arşiv atanmış işi silmez |
| Katkı paylaş `/parent/prova/share` | Açık / yeniden doğrulanacak | Kaydetme sonrası ayrı katkı adımı; içerik, kişisel veri, inceleme ve kazanılacak hak özeti — Aileye kaydetmek yayımlama sanılmaz; ret sonrası düzeltme yolu vardır |

### Ortak kullanılan yollar ayrı tasarım diye çoğaltılmamalı

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| `/parent/child-mode/calendar` | Açık / yeniden doğrulanacak | Veli cihazındaki çocuk oturumu ve geri dönüş sınırı |
| `/parent/child-mode/collection` | Açık / yeniden doğrulanacak | Doğru çocuk ve rol kapsamı |
| `/parent/child-mode/goal` | Açık / yeniden doğrulanacak | Hedef kaydı ve çocuk kapsamı |
| `/parent/child-mode/room-preview` | Açık / yeniden doğrulanacak | Aynı tercih açıklaması ve güvenli geri dönüş |
| `/parent/child-mode/week` | Açık / yeniden doğrulanacak | Doğru çocuk/gün ve durumlar |
| `/parent/child-mode/prova` | Açık / yeniden doğrulanacak | Atanmış çalışmaların yetkili çocuğa ait olması |
| `/parent/child-mode/prova/[examId]` | Açık / yeniden doğrulanacak | Cevap, teslim ve oturum kilidi |
| `/parent/prova/exam` | Açık / yeniden doğrulanacak | Mevcut grup bilgisinin korunması |
| `/parent/prova/generate` | Açık / yeniden doğrulanacak | Eski girişin doğru taslağa yönlenmesi |

### Yönetim paneli veri tablosundan iş kuyruğuna dönüşmeli

| Ekran / akış | Durum | Tamamlanma hedefi |
|---|---|---|
| Başlangıç `/` | Açık / yeniden doğrulanacak | Yükleme ve rol eksikliğini ayır; doğru hesap/yetki isteme yolu — Her rol uygun başlangıca ulaşır |
| Yönetici girişi `/sign-in` | Kısmi: Şifre görünürlüğü, gönderim ve ağ hatası durumu uygulandı. Gerçek şifre yenilemeden dönüş kabulü açık. | Parola görünürlüğü, gönderim durumu, yenilemeden panele dönüş; iki giriş katmanını açıkla — Kullanıcı Cloudflare ile GINA girişini karıştırmaz |
| Panel `/dashboard` | Açık / yeniden doğrulanacak | Sayılardan önce bekleyen destek, inceleme, hata ve yayın işleri; role göre öncelik — Operatör ilk üç işi ve neden beklediğini görür |
| Aileler `/families` | Açık / yeniden doğrulanacak | Ad/paket/son durum öne; kimlik ayrıntıda; arama ve gerçek sayfalama — İlk 100 bütün kayıt gibi sunulmaz; tablette temel eylem görünür |
| Paket ve ödeme `/billing` | Açık / yeniden doğrulanacak | Sabit aile bağlamı; mağaza/geçici hak zaman çizgisi; geçmiş sayfalama — İade, iptal ve ücretsiz erişim karışmaz |
| Geçici hak `/overrides` | Açık / yeniden doğrulanacak | Seçilen aile özeti, süre hazır seçenekleri, önce/sonra etkisi — Yanlış aile veya kapsam farkı onaydan önce fark edilir; güvenli tekrar korunur |
| AI ayarları `/ai` | Kısmi: Okunur kartlar, model/limit taslak koruması, yüklenme ve sürüm kontrolü uygulandı. Sağlayıcı yeteneği/test/etki kapsamı açık. | Dar tablo yerine paket düzenleme paneli; model yeteneği, test ve etki özeti; taslak/yüklenme koruması — Seçili model ve Kaydet aynı görünür bağlamda; kapatma etkilenen akışları gösterir |
| AI işlemleri `/operations` | Açık / yeniden doğrulanacak | Hata kuyruğu önce, politikalar ayrı; durum/işlem/aile/tarih filtreleri — İncele doğru olayı açar; ilk 100 dışında kayıt bulunur; yeniden deneme etkisi anlaşılır |
| Hazır seçenekler `/input-catalog` | Kısmi: Otomatik kimlik, mobil görünüm özeti ve taslak koruması uygulandı. Ders eşanlamlıları ve katalog kapsam denetimi açık. | Otomatik kimlik, bilinçli sınıf kapsamı, ders eşanlamlıları, telefon önizleme ve taslak koruma — Kapatmak yazılanı sessizce silmez; MAT/İNG doğru ders kaydına bağlanır |
| Eski soru bankası `/questions` | Açık / yeniden doğrulanacak | JSON şık editörü yerine ortak soru editörü; sürümlü düzeltme ve etki önizlemesi — Atanmış/yayımlanmış içerik sessizce değişmez |
| Kütüphane `/library` | Açık / yeniden doğrulanacak | Soru bankası/koleksiyon/taslak için tek içerik yaşam döngüsü; eski içerik korunarak taşınır — Kaydet hiçbir yoldan yanlışlıkla yayınlamaz |
| Taslak paketler `/library?tab=drafts` | Açık / yeniden doğrulanacak | Soru/kaynak/ölçüt karar sırasında erişilebilir; hatalı paket için alan bazlı açıklama ve örnek — İnceleme notu yazarken kanıt kaybolmaz; geçerli dosya yolu anlaşılır |
| Yayına hazırla `/library-publication` | Açık / yeniden doğrulanacak | Program/dönem seçimi, yeterli açıklama alanı, aile erişim/hak önizlemesi — Önizleme gerçek erişimi anlatır; kayıt ile yayın ayrımı korunur |
| Haklar ve ödüller `/library?tab=policy` | Açık / yeniden doğrulanacak | Kabul sayısına göre kazanılacak hakkın örnek hesabı; çakışan kuralların toplamı — Birden çok kuralın birlikte etkisi ve eski hakların korunması görünür |
| Katkılar `/library?tab=review` | Açık / yeniden doğrulanacak | Soru bazında düzeltme işaretleri, rubrik düzenleme; kısmi kabul ayrı iş kuralı önerisi — Ortak kaynak bütünlüğü ve kabul edilen özgün soru sayısı korunur |
| Senaryo kaynakları `/library?tab=curriculum` | Açık / yeniden doğrulanacak | Belge/dağılım/kazanım yan yana; standart yıl/program/okul kapsamı — Dosya uyumu pedagojik onay sanılmaz; okulun seçimi ayrı kalır |
| Birlikte Prova `/groups` | Açık / yeniden doğrulanacak | Kapsam → sorular/süre → aile/çocuk önizleme; inceleme iş yükü — Katılım penceresi, kişisel süre, içerik sabitleme ve sıralama tercihi açık |
| Ortak cevap inceleme `/cohort-review` | Açık / yeniden doğrulanacak | Sonraki incelenmemiş/itirazlı kuyruğu; kanıt ve rubrik birlikte; puanlanmamış ≠ sıfır — Okunamayan defter boş cevap sayılmaz; büyük katılımda kayıt bulunur |
| Destek `/support` | Açık / yeniden doğrulanacak | Sorumlu, bekleme süresi, arama, hazır yanıt ve ilgili yardım yazısı — Özel not aileye gitmez; taslak yanlış görüşmeye taşınmaz |
| Fikirler `/ideas` | Açık / yeniden doğrulanacak | İnceleniyor/planlandı/yapılıyor/yayımlandı ürün durumları; benzer fikir ilişkisi — Destek görüşmesi kamu oylamasına dönüşmez; taahhütsüz tarih verilmez |
| Yardım yazıları `/help-articles` | Açık / yeniden doğrulanacak | Başlıktan kod önerisi; kısa yanıt/adımlar/bağlantılar; cihaz önizleme ve dil farkı — Taslak yayımlanmış yanıtı değiştirmez; yazı gerçek işlemi yaptırır |
| Bildirim işlemleri `/notifications` | Açık / yeniden doğrulanacak | Olay ve çözüm özeti; teknik makbuz ikincil; tekrarın nedeni ve kapsamı — Sağlayıcı kabulü “okundu” diye sunulmaz; başarılı gönderi yeniden yollanmaz |

## Kapatma kuralı

Her satırda kaynak değişikliği, beklenen davranış ve gerçek kontrol kanıtı bulunmadan “tamamlandı” yazılmayacak. Yeni bir veri kuralı gerekiyorsa migration, sunucu yetkisi, eşzamanlılık ve tekrar güvenliği ayrı test edilecek. Yayın durumu, kodun yazılmasıyla eş tutulmayacak.

## Sıradaki uygulama paketi

1. Görev/ödül/not/okul puanını geçmişi koruyarak düzenleme; ad/gün/yıldız/bedel değişiminin mevcut kayıtları geriye dönük değiştirmemesi.
2. Veli ana ekranında sıradaki iş ve doğru bağlam; cihaz/PIN ayarlarında taslağı koruyarak tamamlama.
3. Hazırlayıcıda soru bankasından bağımsız ders/program kapsamı ve tek soru sırası; ardından kalan çocuk/inceleme akışları.
4. Yönetim iş kuyrukları ve içerik yaşam döngüsü; fiziksel cihaz ve yayın kapısı.
