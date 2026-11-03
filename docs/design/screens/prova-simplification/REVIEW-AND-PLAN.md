# Prova: tek çalışma, tek hazırlama akışı

Durum: **3 Kasım 2026’da kullanıcı ana ekranı ve birleşik hazırlama yönünü onayladı.** Bu onay, “Önceki ekran bazında onay düzenimizi koruyarak, bu ana ekranı ve birleşik hazırlama akışını bu yönde ilerletelim mi?” sorusuna verilen “buna evet diyorum” yanıtıdır. Ana ekran ve birleşik oluşturucunun uygulama kodu henüz tamamlanmadı. Oluşturucunun ayrıntılı dört ekranı `builder/` altında yeni tasarım incelemesine hazırdır; bu yeni ekranlar henüz ayrıca onaylanmış sayılmaz. Bu turdaki kod düzeltmeleri yalnız sorunun görünürlüğü, yanıt türüne uygun inceleme ve çizim sırasında kaydırma içindir. TestFlight 16 bu düzeltmeleri içermez.

## İncelenen kanıt ve dürüst değerlendirme

Kullanıcının iki iPhone görüntüsü; gerçek `ParentReviewWorkspace` ve `DrawingPad` bileşenleriyle sentetik boş, şıklı, yazılı ve çizimli yanıtların web gösterimleri. Üretim ailesinin kayıtları kullanılmadı veya değiştirilmedi. Fiziksel iOS dokunma/kalem testi yapılmadı.

Prova ana ekranı, sınav oluşturma, AI üretme, soru yazma, ortak kaynak, senaryo, seviye, kütüphane, sonuç/inceleme akışlarının kodu ve veri sözleşmeleri incelendi. Diğer veli ekranlarının yönlendirme/kontrol yapıları koddan tarandı; hepsinin gerçek cihazda görsel denetimi yapılmış değildir.

| Bulgu | Kaynak | Sonuç / öneri |
|---|---|---|
| Telefonda soru varsayılan kapalı; görselsiz soruda boş küçük resim yeri var | `parent-review-workspace.tsx` | Soru ilk açılışta görünür; gereksiz küçük resim alanı kaldırıldı. Daraltılsa bile soru özeti kalır. |
| Cevap kontrolü `answer_key` alanını hesaba katmıyor | Aynı bileşen | Şıklı cevapta yanlış “cevap yok” mesajı düzeltildi. Seçilen/doğru cevap yazıyla da ayrılır. |
| Soru türünden bağımsız boş defter açılıyor | Aynı bileşen | Şıklı, yazılı ve boş yanıtta önce soru/yanıt görünür. Çizim notu isteğe bağlı açılır. Mevcut çizimli cevap korunur. |
| Çizim modali dış ScrollView içinde kayıyor | `drawing-pad.tsx` | Çizim sürerken dış kaydırma kapalı; bırakma/iptalde açılır. Web touch-action kilidi var. |
| Ana ekran yeni prova yanında 8 ayrı araç kartını ve senaryo listesini sunuyor | `parent/prova/index.tsx` | Araç menüsü yerine Provalar / Sonuçlar / Kütüphane; bir ana “Prova hazırla” eylemi. |
| Tekil sorular otomatik seçiliyor; ortak grup ayrı atama yolunda | `exam.tsx`, `shared-source.tsx` | Aynı taslak içine tekil sorular + ortak kaynaklı gruplar + farklı üretim kaynakları. |
| Yeni sınavın sınıfı 5 olarak başlıyor; çocuk seçimi bu alana bağlanmıyor | `exam.tsx` | Çocuk profili varsayılanı; eksik sınıfı tahmin etmek yerine bir kez sor. |
| Ders ve konu yazı alanı; AI/elle/seviye girişleri benzer bilgiyi yeniden soruyor | `generate.tsx`, `question.tsx`, `level.tsx` | Tek taslağın bağlamını bütün ekleme yollarına taşı. Ders/konu/kazanım seçilebilir kontroller. |
| Çocuk profilinde doğum/sınıf/ilgi var, okul türü veya doğrulanmış müfredat profili yok | `children` sözleşmesi | Yeni profil alanlarını ayrı geliştirme olarak tanımla; okulun adından müfredat veya yeterlik çıkarımı yapma. |

## Uzmanlık alanlarına göre ürün kararları

Bunlar psikolog/pedagog tarafından yapılmış klinik veya kişiye özel değerlendirmeler değil; öğrenme ve kullanılabilirlik kaynaklarına dayanan tasarım önerileridir.

- **Psikolojik yük:** bir anda tek karar; veliye tekrar tekrar aynı bilgileri sordurmama; taslağa geri dönebilme. Çocukta puandan önce ne yapacağı ve bir sonraki adım. Cevapsız soruyu “başarısızlık” veya kalıcı yetenek etiketiyle eşitlememe. Sınav sırasında hareketli maskot, gereksiz kutlama ve zorunlu süre baskısı yok.
- **Pedagoji:** işlenen konular ve öğrenme çıktıları esas. Alıştırmada açıklama/destek, sınav modunda cevap anahtarı ancak bitişten sonra. Kalem, klavye ve görsel yanıt seçenekleri; yazı biçimini konu bilgisinden ayıran rubrik. AI önerisi veli onayı olmadan kesin puan olmaz.
- **Eğitmen:** sınav kapsamı ve dağılımı görünür; her soru kaynak/kazanım/zorluk/yanıt türü bilgisine sahip. Ortak metin/görsel tek blok, alt sorular aynı setin içinde. Karma sınavda derslere göre bölüm ve ayrı analiz; yanlış toplam puan veya aynı sorunun tekrar eklenmesi engellenir.
- **Tasarım:** onaylı mint/mor/krem, Baloo 2/Nunito ve özgün logo korunur. Premium his; okunaklı hiyerarşi, hizalama, boşluk ve az sayıda güçlü eylemden gelir. Gölge/parlama/kart ve ikon sayısını artırmak hedef değil. Maskot yalnız anlamlı bağlamlarda; soru alanının önüne geçmez.

## Birleşik hazırlama: dört adım

1. **Kimin için, neye hazırlık?** Tek çocuksa otomatik seç; birden fazlaysa profil seçici. Sınıf/müfredat özetini göster, değişiklik bağlantısı sun. Amaç: konu çalışması, yazılıya hazırlık, deneme. Ders seçimi: tek ders veya karma. “Karma”, sınav amacıyla aynı seçenek listesine karıştırılmaz.
2. **Kapsamı belirle.** Ders → işlenen ünite/konu → öğrenme çıktısı. Soru sayısı adımlayıcı, süre seçimi, zorluk dağılımı, yanıt biçimi; gelişmiş ayarlar kapalı. MEB yazılısı seçilirse eğitim yılı, dönem, yazılı numarası ve doğrulanmış konu–soru dağılımı/senaryosu. Seçili sınıfa uygulanmayan sınav tipi önerilmez. Sadece serbest AI isteği ve kendine özgü notlar metin alanıdır; seçimler düzenlenebilir.
3. **Soruları oluştur ve düzenle.** Tek sıralı liste. “Soru ekle” içinden AI / kütüphane / kendim yazacağım / dosyadan. Tüm listeyi AI ile doldurabilir, sadece eksik sayıyı tamamlayabilir veya seçili soruları değiştirebilir. Üretilmiş ve kabul edilmiş sorular izinsiz silinmez. Ortak kaynak bir soru grubudur; aynı Prova’ya eklenir, bağımsız Prova açmaz. Gruplar varsayılan bitişik taşınır; bağımlı alt soru kaldırılırsa eksik bağlam uyarısı verilir. İzin verilen bağımsız alt sorular seçilebilir, kaynak ilişkisi korunur.
4. **Çocuk gibi önizle ve gönder.** Sıra, soru/görsel okunurluğu, anahtar/rubrik, toplam sayı/süre ve kapsamı kontrol et. Taslağı kaydet / çocuğa gönder. Elle oluşturulan seçili soruları isteğe bağlı GINA kütüphanesine öner; varsayılan kapalı, özel çocuk cevabı veya kişisel dosya paylaşılmaz. Paylaşmamak sınavı tamamlamayı engellemez.

İlk kullanımda kısa açıklama satırları; deneyimli kullanıcıda kayıtlı tercih ve “aynı ayarlarla yeni Prova” kısayolu. Yardım gerektiğinde açılır. Uzun ve tekrar eden zorunlu eğitim turu yok.

### AI ve kota

Üretmeden önce istenecek soru adedi ve hesaplanabilir kullanım bedeli gösterilir. Aynı sonuçtan birden çok soru seçilebilir; seçmek yeniden AI çağrısı değildir. Üretim sırasında mevcut taslak kullanılabilir kalır; başarısız parça tekrar denenir. İstek kimliği ve içerik sürümü ile tekrar ücret/kopya kayıt engellenir. Kota yetersizse kütüphane/elle ekleme aynı taslakta devam eder. “MEB uyumlu” etiketi yalnız doğrulanmış kapsam ve tür kontrollerinden sonra kullanılabilir; bir prompt veya zorluk etiketi yeterli değildir.

### Çocuğa uygun seçim

| Etken | Davranış |
|---|---|
| Sınıf, program/müfredat sürümü, ders | Zorunlu uygunluk filtresi; çocuk profilinden gelir, veli değiştirebilir. |
| Eğitim yılı/dönem, işlenen konular | Henüz öğrenilmemiş konuları varsayılan dışarıda bırakır. |
| Okul türü/programı, kullanılan kitap/öğretmen senaryosu | Gerektiğinde istenir. Okulun tam adresi veya prestijine göre seçim yapılmaz. |
| Önceki sonuçlar | Yeterli kanıt varsa konu bazında tekrar önerisi; az veri varsa “henüz yeterli çalışma yok”. |
| Dil, okuma yükü, erişilebilirlik tercihleri | Yönerge uzunluğu ve sunum uyarlanır; soru güçlüğüyle karıştırılmaz. |
| İlgi alanı | Uygun olduğunda hikâye bağlamını seçebilir; kazanımı değiştirmez. |
| Yaş ve cinsiyet | Yaş sınıfın yerine geçmez. Cinsiyete göre ders, zorluk veya yetenek tahmini yapılmaz. |

**İki farklı “senaryo”:** MEB konu–soru dağılımı = sınav planı; hikâye/görsel senaryosu = soru bağlamı. Kontrollerde ayrı adlandırılır. “Yeni nesil” tek başına bilimsel bir uygunluk ölçütü veya tüm soruların hikâyeli olması zorunluluğu değildir.

## Veri/iş kuralı işleri — tasarım onayı sonrasında

- Kalıcı Prova taslağı, sıralı soru/grup blokları ve grup kaynağının sürüm referansı; farklı ekleme yollarından dönünce seçimler korunur.
- Mevcut `exams.subject/grade` tek ders sözleşmesini karma ders için açıkça genişletmek; rapor/kitapçık/atama ve yetki kontrollerini birlikte güncellemek. Sadece başlığa “Karma” yazmak yetmez.
- Ortak kaynak sürümlerini atanmış setlerde sabitleme; atama sırasında set bütünlüğü, kazanım/sınıf uygunluğu, hak/kota ve tekrar gönderim kontrolü.
- Doğrulanmış müfredat/ders/konu kataloğu. Mevcut serbest metin kayıtlarına geçiş/eşleme; eski sınavları kaybetmeden sürümlendirme.
- AI, kütüphane ve elle eklemenin ortak taslak API’si; kısmi hata kurtarma. İdempotency ve eşzamanlı düzenleme çatışmaları korunur.
- Eski girişler kaldırılmadan yönlendirme: yeni soru → taslağa soru ekle veya kütüphaneye kaydet; seviye → yeni Prova amacı; senaryo → kapsam ayarı; kitapçık → setin menüsündeki dışa aktar; toplu sınav → ayrı etkinlik katılımı; gelişim → Sonuçlar altındaki rapor. Mevcut işlevler silinmez.

## Diğer ekranlarda uygulanacak ortak kontrol düzeni

Bu bölüm öneridir; bütün ekranların yeni kodu yazılmış veya görsel onayı alınmış değildir.

| Ekran ailesi | Önerilen sadeleşme |
|---|---|
| Veli bugün | Bugün gereken işler ve bekleyen onaylar; Prova/Takvim alt menüsünün bütün araçlarını yeniden listeleme. |
| Takvim/ders programı | Tarih görünümü + tek ekle; etkinlik/ders türü ekleme içinde. Haftalık program ayrı düzenleme görünümü. |
| Görev/hedef/ödül | Liste → ayrıntı → bağlama uygun tek ana eylem; AI/şablon/elle kaynakları oluşturma içinde. |
| Aile/cihaz/PIN | Önce “Kendi telefonum / çocuğun cihazı / paylaşılan cihaz”; sonra yalnız ilgili PIN ve erişim seçenekleri. Güvenlik veya hesap silme çocuk profili akışına serpiştirilmez. |
| Paketler | Aktif plan ve gerçek kalan hak; ayrıntılı karşılaştırma, satın almayı geri yükleme ve yasal bilgiler ikincil düzeyde kalır. |
| Çocuk çözme | Soru ilk görünür; uygun yanıt kontrolü (şık/yazı/defter); çizimde kaydırma kilidi, kaydırma için ayrı el aracı. |
| Sonuç/inceleme | Şıklıda seçim + doğru yanıt + açıklama; açık uçluda çözüm + ayrı veli notu/rubrik; AI isteğe bağlı yardımcı. |

Eylemler: ana eylem dolu mor, ikincil düzenleme satır/ikon+etiket, yardımcı açıklama açılır. Mobilde her ikon tek başına belirsiz bırakılmaz; 48 dp hedefler korunur. Durum yalnız renkle anlatılmaz. Animasyon yalnız açılma/kaydetme/yer değiştirme ilişkisini gösterir; azaltılmış hareket tercihine uyar.

## Tasarım teslimi ve sıradaki onay

- `proposal-v1.html`, `proposal-phone-v1.png`, `proposal-tablet-v1.png`: **yeni Prova ana ekranı önerisi**, örnek veriler. Etkileşimsiz maket; gerçek yeni oluşturucu değildir. Tablette sağdaki taslak içeriği aynı sette tekil ve ortak kaynaklı soruları gösterir.
- `review-*-phone.png`, `review-mc-tablet.png`: hata düzeltmelerinden sonraki **gerçek bileşenler**, sentetik veriler. Maketle karıştırılmamalı.
- Sıra: ana ekran tasarım onayı **alındı** → birleşik oluşturucunun ayrıntılı ekranları `builder/` altında **onaylandı; uygulaması tamamlandı** → backend+UI uygulaması → soru türlerine göre çözme/inceleme → diğer ekran aileleri → fiziksel cihaz kontrolü ve yeni TestFlight.

## Kabul ölçütleri

Soru ilk açılışta okunur; görselsiz/boş/şıklı/çizimli/uzun ortak kaynaklı durum ayrı denenir. Şıklı yanıtta “cevap yok” yazmaz. İsteğe bağlı veli notu aslı değiştirmez. Çizim sürerken iPhone ve iPad sayfa kaydırmaz; bırakma ve OS iptalinde kilit çözülür. Aynı taslağa 3 kütüphane, 2 AI, 1 elle ve 3 ortak kaynaklı soru eklenebilir; toplam 9, sırası ve kaynak ilişkisi korunur. Karma ders raporu ayrılır. Uygun olmayan sınıf/senaryo sessizce kabul edilmez. Eksik bağlantı veya kota mevcut taslağı silmez; aynı isteği tekrar etmek kopya/çift ücret üretmez. Büyük yazı, 320 dp telefon, dikey/yatay tablet, klavye, ekran okuyucu ve azaltılmış hareket ayrı kontrol edilir.

## Dayanaklar

- [MEB 2026–2027 1. dönem konu–soru dağılım tabloları](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724): kapsamın eğitim yılı ve dersle eşlenmesi için resmî başlangıç kaynağı. Bu incelemede tüm ders PDF’lerinin tek tek içerik doğrulaması yapılmadı.
- [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/): seçim, dikkat dağıtıcıları azaltma, farklı ifade araçları ve eyleme dönük geri bildirim için çerçeve. Buradaki GINA düzeni bu kaynaktan yapılan ürün tasarımı yorumudur.
- [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): ikincil seçenekleri gerektiğinde açma ilkesi; GINA’ya uyarlama önerimiz.
- [React Native gesture responder](https://reactnative.dev/docs/gesture-responder-system), [ScrollView](https://reactnative.dev/docs/scrollview), [Expo 58](https://docs.expo.dev/versions/v58.0.0/): çizim kaydırma düzeltmesinin API dayanakları.

## Bu tur tamamlanan kontroller

Mobil TypeScript ve Expo lint geçti; 44 core testi geçti. 390×844 telefon, 320×568 küçük telefon ve 1280×800 tablette sentetik inceleme durumları kontrol edildi. Çizim dokunma testinde kilit, kaydırma konumunun korunması, bırakma ve iptal sonrası kilidin açılması doğrulandı. `verification.json` kapsamı ve sınırları kaydeder. `qa-fixture.tsx` yalnız QA için geçici Expo rotası olarak kullanıldı; uygulama rotası/kimlik doğrulama düzenlemesi teslimde yoktur.


## Birleşik Prova uygulaması — 3 Kasım 2026

Kullanıcının ayrıntılı dört adım maketine verdiği “evet” onayıyla uygulandı. `implementation/` altındaki görüntüler gerçek Expo Web bileşenlerinin sentetik API verileriyle çekimleridir; fiziksel cihaz veya canlı AI testi olarak sunulmaz.

- Ana ekran: tek hazırlama eylemi, Provalar / Sonuçlar / Kütüphane, çocuk filtresi yalnız birden fazla çocukta, taslağa devam, inceleme bekleyen sonuçlar. Önceki seviye tespiti, grup sınavı, kitapçık ve senaryo araçları Kütüphane → Diğer araçlar altında korunur.
- Oluşturma: Başlangıç → Kapsam → Sorular → Kontrol. Çocuğun mevcut sınıfı kullanılır, eksikse açıkça sorulur. Kütüphane, AI, elle hazırlama ve özel belgeden AI üretimi aynı Prova taslağına eklenir. Ortak kaynak grubu bütün hâlinde sıralanır. Eski `/exam` ve `/generate` girişleri birleşik oluşturucuya gider.
- AI: konu başına dağılım ve toplam kullanım önceden görünür; paket uygunsa veliye ait senaryo seçilebilir. Çoklu öneri seçimi yeni kota tüketmez. Belge için ayrıca saklama/AI onayı gerekir; aile sahipliği ve dosya hash’i doğrulanır, kaynak kimliği sorunun kökeninde saklanır. Veli cevap kontrolünde özgün belgeye erişebilir; belge çocuk önizlemesine otomatik eklenmez.
- Kayıt: aileye bağlı, sürümlü taslak; aynı istek için aynı makbuz; eşzamanlı kayıt çatışması; atomik ve tekil atama; atanmış sorular/ortak kaynak ve hazırlama metaverisi korunur. Yeni testler yalnız `gina_prova_builder_audit` adlı ayrı veritabanında çalıştı.
- Resmî MEB kataloğu henüz bağlı olmadığı için arayüz bunu açıklayıp bu etiketle göndermeyi engeller. “Okul çalışması” ve veli senaryosu kullanılabilir; bunlar resmî uyum sertifikası değildir.

Doğrulama: 48 core testi, 38 yeni veritabanı kontrolü, 57 mevcut ortak-kaynak regresyon kontrolü, gerçek iki oturumlu kayıt/gönderim yarışı ve 5 belge güvenlik testi geçti. Mobil tür kontrolü, Expo lint ve Edge Function Deno kontrolü geçti. Ayrıntılı kapsam ve sınırlar `implementation/verification.json` içindedir.

Yayın öncesi sıra: yeni migration → `prova-generate` dağıtımı → canlı belge/kota tekrar denemesi → aynı commit’ten TestFlight ve kablosuz iPad paketi → fiziksel iPad’de dikey/yatay defter ve araç açılış kontrolü. Bu teslimde yeni TestFlight veya kablosuz iPad paketi yayımlanmadı.


Ek regresyon: merkezi GINA kütüphanesinden alınan sorunun da taslağa bağlanması, sınıf/ders filtresi ve mevcut hakkın korunması eklendi. 30 kütüphane ve 19 üretim kotası kontrolü geçti. Kota testinde bulunan önceki hesap silme engeli `20261103011000_credit_deletion_order.sql` ile düzeltildi: kullanılan katkı hakkını tek başına silmek hâlâ yasak; aile silinirken birbirini izleyen temizleme adımları işlem sonunda doğrulanır.
