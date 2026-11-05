# GINA veli, hesap ve ortak ekranlar: derin kullanım incelemesi

Tarih: 5 Kasım 2026. Kaynak: `codex/deep-experience-audit`, `a123b7f` (TestFlight 25 kaynak zinciri). İnceleme kapsamı: Prova alt yolları ve çocuk/çocuk modu yolları dışındaki veli, hesap, cihaz eşleştirme ve herkese açık paylaşım ekranları. Ayrıntılı 57 satırlık rota ve alt-akış dökümü: [parent-inventory.json](parent-inventory.json). Bu inceleme uygulama değişikliği veya yayın değildir.

## Kapsam ve kanıt sınırı

22 rota/rol giriş noktası, 35 modal veya alt durum envanteri çıkarıldı. JSX, olay işleyicileri, sorgu kapsamları, durum geçişleri ve güncel Türkçe metinler incelendi. Kontrol yolları hedefli kaynak okumayla değerlendirildi; bütün bağımlılıkların her satırını veya tüm iş kuralı permütasyonlarını test ettiğim iddia edilmiyor.

Güncel Expo web çıktısı `http://127.0.0.1:8088`, gerçek fakat yalnız bu denetime ayrılmış yerel Auth/PostgREST hizmetine bağlandı. Yapay iki çocuklu aileyle 15 veli rotasında 390×844, 1280×800 ve 1440×900 boyutlarında 45 ilk görünüm kaydı alındı. Kayıtlar `parent-render-observations.json` içinde. Ekran açılması, düğme tıklaması ve formların görünmesi kontrol edildi; gerçek satın alma, hesap/çocuk silme, gerçek e-posta, AI çağrısı veya üretim verisine yazma yapılmadı. Başlangıçta karşılaşılan 8087 eski önizleme kapsam dışında bırakıldı. Paylaşım ve haftalık özetin ilk görüntüleri yükleniyordu; bunları içerik kanıtı saymadım, ayrıca beklenmiş görüntüler aldım.

Telefon formları ve modal durumları ayrıca açıldı: çocuk ekleme profil/okul, görev kaynağı, ödül kaynağı, hedef seçimi, etkinlik düzenleme, not/puan girişi, ders programı, zil düzeni, hesap/güvenlik/cihaz sekmeleri, hesap silme açıklaması, destek yazma. Sonucun gerçek iPhone/iPad render ve VoiceOver, fiziksel kalem, kamera izinleri, satın alma ekranları açısından doğrulandığı söylenemez. Güncel yerel fixture'da ders programı boştu: dolu hafta sürükleme işlemi bu turda canlı kanıtlanmadı; yeni tablo ve zil algoritması kaynak üzerinden değerlendirildi. Sosyal sağlayıcılar yerel ortamda görünmedi; üretimdeki Apple/Google ekranları bu audit'te test edilmiş değildir.

Psikoloji/pedagoji/eğitmen bakışları burada uzman tanısı veya kullanıcı araştırması sonucu değil, bilişsel yük, anlaşılabilirlik, seçim hakkı, öğrenme amacı ve hata düzeltme açısından sezgisel değerlendirmedir. Çocuk/veli görüşmesi yapılmadı. Güvenlik açığı bulunmadığına dair genel garanti verilmez.

## Temel değerlendirme

Marka yönü artık tutarlı: krem zemin, mor eylemler, mint seçili alanlar ve farklı bağlama ait maskot çizimleri mevcut. Asıl problem markayı yeniden çizmek değil; ekranların işlerini ve kapsamını ayırmak, yanlış işlemi geri almayı/düzeltmeyi kolaylaştırmak ve rutin işi kısa tutmak. Aynı ürün içinde takvim/görev/ödül ekranları daha zengin kontrol sistemine sahipken not, puan, etkinlik ve ödev formları hâlâ ham metin alanlarına dönüyor. Veliye veritabanı biçimlerini öğretmek yerine yaptığı işi temsil eden kontroller kullanılmalı.

## 1. Takvimde aile kapsamı ile çocuğa özel işler birbirine karışıyor — P1

**Görülen:** Takvim Tümü seçiliyken aile etkinliklerini topluyor; buna rağmen `selectedChild` ilk çocuğa düşüyor. Ödev/çalışma sorgusu ve çanta düğmesi yalnız o çocuk için. Yerel iki çocuklu ailede Tümü altında doğrudan “Synthetic child · Çanta listesi” görünüyor. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/calendar-screen.tsx:100), [çanta/ödev yerleşimi](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/calendar-screen.tsx:646), [telefon kanıtı](screenshots/parent-calendar-phone.png), [tablet kanıtı](screenshots/parent-calendar-tablet.png).

**Değişiklik:** Tümü görünümünde her çocuğun işini adıyla grupla; çanta/program gibi tek çocuğa uygulanacak işlemde bağlamı belirginleştir. İlk çocuğu sessizce seçme. Aile takvimi, çocuğun ders programı ve yapılacak ödevler ayrı işlevler olarak aynı gün görünümünde koordine edilmeli.

**Beş bakış:** Veli hangi çocuğa işlem yaptığını hatırlamak zorunda kalmamalı; kardeşlerin görünürlüğü dengeli olmalı; günlük toplam iş yükü görülebilmeli; sorgu ve görünen seçim aynı kapsamı taşımalı; aile/çocuk seçimi görsel olarak üstte sabit ve okunur olmalı.

**Kabul:** İki çocuğun farklı ödevi varken Tümü ikisini gösterir veya açık çocuk seçimi ister; hiçbir kayıt yanlış çocuğa yazılmaz. Bir çocuk varsa gereksiz Tümü seçimi çıkmaz (ana ekranda bu zaten düzeltilmiş).

## 2. Var olan görev, ödül ve okul puanını düzeltmek oluşturmak kadar kolay değil — P1

**Kaynak ve görünüm:** Görev kartı yalnız Duraklat/Devam sunuyor; mevcut görev için ad/gün/yıldız düzenleme giriş noktası yok. Ödül kataloğunda da etkin/pasif yönetimi var fakat başlık/fiyat düzeltme yok. Puanlar ekranı yeni kayıt oluşturup listeleyebiliyor; mevcut puanı düzeltme/silme görünmüyor. Notlar ekle/sil yapıyor, düzenleme sunmuyor. [Görev](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/tasks/tasks-screen.tsx:345), [ödül](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/rewards/rewards-screen.tsx:140), [puan](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/grades.tsx:129), [not](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/notes.tsx:113), [görev telefon](screenshots/parent-tasks-phone.png).

**Değişiklik:** Kartın ana dokunuşu ayrıntı, küçük ek menü düzenle/duraklat/geçmiş olsun. İleriye etkili değişiklik ile geçmiş tamamlamanın eski değerleri ayrılmalı. Puan ve not düzeltmesinde güvenli düzenleme ve gerekirse geçmiş tutulmalı. Ödül teslim geçmişi de ulaşılabilir olmalı; mevcut sorgu yalnız istenen/onaylanan talepleri getiriyor. [Talepler](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/rewards/rewards-screen.tsx:45).

**Beş bakış:** Hata düzeltilebilirlik güven yaratır; küçük yanlışlık çocuğa haksız puan kaybı olarak yansımamalı; okul notu ile davranış yıldızı ayrılmalı; revizyon geçmişi ve talep anındaki fiyat korunmalı; Düzenle her ekranda aynı yerde bulunmalı.

**Kabul:** Tek görevin adını/gününü düzeltmek ikinci görev üretmez. Geçmiş onayın yıldızları değişmez. Puan yanlış girildiğinde silip yeniden oluşturmak tek çözüm değildir.

## 3. Ders programı iyileşti; aynı seviye diğer planlama ekranlarına yayılmadı — P1/P2

**Artık mevcut olanlar:** Fotoğraf aktarımında 1500 karaktere kadar açıklama ve örnek, gün/hafta tablosu, kısaltma eşleme, ilk ders/ders süresi/teneffüs/uzun ara düzeni, ders saati değişince sonraki dersleri kaydırma, yer değişimi ve geri alma var. Eski uzun hata/listesi ekranını bugünkü kusur diye yeniden raporlamıyorum. [Aktarım promptu](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-import.tsx:494), [zil düzeni](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-board.tsx:93), [düzenleme/kaydırma](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-board.tsx:593), [güncel boş program](screenshots/parent-timetable-phone.png).

**Kalan:** Etkinlik ekle, okul puanı, ödev planlama ve ödev aktarımı hâlâ “YYYY-AA-GG”, “SS:DD” yazdırıyor. Ödev aktarımında kullanıcının belgeye bağlam ekleyebileceği prompt yok; her çıkarılan işin `planned_on` alanı seçili güne atanıyor. [Etkinlik](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/event-editor.tsx:347), [puan tarihi](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/grades.tsx:120), [ödev](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/learning-plan.tsx:802), [aktarım](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/learning-plan-import.tsx:133), [etkinlik görseli](screenshots/parent-event-editor.png).

**Değişiklik:** Ortak tarih/saat seçici; bugün/yarın/hafta içi gibi kısa yollar; elle yazma ikincil yol. Belgeden ödev çıkarmada açıklama örnekleri, seçilen işleri topluca günlere dağıtma ve kaydetmeden tablo özeti. Zil uygularken “tüm günler” kapsamını varsayıma saklamadan, mevcut saatleri nasıl değiştireceğini önizle. Dolu hücreler arası değişim ile boş hücreye taşıma ayrı yetenekler; mevcut sınırlama kullanıcıya dürüst aktarılmalı.

**Kabul:** Normal kullanıcı tarih biçimi öğrenmeden işini planlar. Öğle arasını artırınca sadece seçilen günlerde sonraki dersler kayar; yanlışlık tek eylemle geri alınır. Kaynaktan gelen saat, kullanıcı seçimi ve öneri ayırt edilir.

## 4. Ana ekranın bilgi önceliği ve dokunma sonuçları netleşmeli — P1/P2

**Görülen:** Telefon ekranında uzun veli adı ve maskot ilk görünümü büyütüyor; iki çocuk kartı ve hızlı eylemler alt menüye kadar uzanıyor. Tablet görünümünde boş gün planı solda kısa, hedefler sağda uzuyor; büyük boşluk oluşuyor. Bu kesilme kendi başına veri kaybı değildir: sayfa kaydırılabilir. Fakat ilk bakışta önemli işler ve sonraki eylem aynı ağırlıkta değil. [Telefon](screenshots/parent-home-phone.png), [tablet](screenshots/parent-home-tablet.png).

**Kaynak:** Etkinlik ve görev satırları genel takvim/görev rotasına gidiyor; seçili tarih/çocuk/kayıt iletilmiyor. Hedef tıklaması da genel ödüllere gidiyor. İlerleme hesabındaki `done` hem onayda hem onaylanmış kayıtları sayıyor; bu ayrım günlük durum etiketlerinde var fakat toplamın anlamı daha görünür olmalı. [Bağlantılar](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/parent-home/home-view.tsx:127), [görev satırı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/parent-home/home-view.tsx:157), [ilerleme hesabı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/index.tsx:138).

**Değişiklik:** Bugünün gerçekten yapılacak işi/veli onayı ilk sırada. Kısa selamlama ve dekoratif maskot, veri büyüdükçe kompaktlaşır. Kardeşleri başarı sıralaması gibi göstermek yerine isimli kişisel durumlar; onayda/tamam ayrı. Bir nesneye dokunmak o nesneye veya filtrelenmiş doğru listeye götürür. Tablet sütunları bağımsız, dengeli gruplansın.

**Kabul:** Yeni/yoğun ailelerde ilk görünümde bir belirgin sonraki eylem; çocuk/tarih değişimi navigasyonda korunur; onay bekleyen sayı başarı puanı sanılmaz.

## 5. Bildirim düğmesinin vaat ettiği iş ile açtığı ekran farklı — P1

Ana ekranların zil simgesi “Bildirimler”e götürüyor, açılan sayfa yalnız bildirim tercihleri. Kullanıcı geçmiş bir bildirim aradığında kuyruk yok. [Ekran kaynağı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/notifications.tsx:62), [görünüm](screenshots/parent-notifications-phone.png).

Bildirim merkezi ve “Bildirim ayarları” ayrılmalı. Merkez ertelenecekse zil yerine doğru isim ve simgeyle tercihler bağlantısı kullanılmalı. Gelen onay/Prova bildirimi ilgili öğeye açılmalı, okunmuş/okunmamış ve eski bildirimden ulaşılan artık değişmiş kayıt açıklanmalı. Bu yeni işlev önerisidir; mevcut görünmeyen bir inbox varmış gibi anlatılmıyor.

## 6. Seçmeli veri girişi tutarlı olmalı — P1/P2

Çanta/ödev içinde `GuidedField` mevcut: ilk altı öneri, daha fazlası, elle yaz seçeneği. Ancak puan/not dersleri serbest metin; etkinlik başlığı ve program ders adı da kendi kontrolleriyle ilerliyor. Aynı dersin farklı yazımları raporlamayı zorlaştırabilir; gerçek veri kirliliği ölçülmedi, bu mimari risktir. [GuidedField](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/ui/guided-field.tsx:64), [puan](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/grades.tsx:98), [not](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/notes.tsx:96).

Ortak aranabilir ders/konu kataloğu, bağlama göre kısa öneriler, sonra özgür ekleme. 14 sınıf seçeneği + yıl + cinsiyet + ilgi alanını tek uzun adımda sunan çocuk sihirbazı sadeleştirilmeli. Gerekli öğrenme bilgisi ile isteğe bağlı kişisel bilgi ayrılmalı. İlgiler/cinsiyet okul içeriğine stereotip filtresi yapılmamalı. [Çocuk okul adımı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/setup/child-setup.tsx:186).

## 7. AI girdisi ve kotası anlaşılır, tutarlı sözleşmeye dönüşmeli — P1

Çoklu dosya/galeri/kamera seçimi ortak bileşende var; varsayılan üst sınır 5, sunucu politikası okunuyor; seçilen dosyalar `members` grubunda tek bağlam olarak taşınıyor. Bunu yanlışlıkla tek dosya eksikliği diye raporlamıyorum. [Seçici](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/source-files-picker.tsx:24). Gerçek kamera/galeri izinleri masaüstü webde doğrulanamaz.

Görev/ödül AI önerilerinde profil veya belge seçilebiliyor ve çoklu öneri kabulü mevcut; isteğe bağlı ek açıklama alanı yok. Kalan hak gösteriliyor fakat paket ekranındaki özellik karşılaştırması yalnız haftalık aile özetini sayıyor; AI soru/aktarımı/kütüphane kapsamı kullanıcı tarafından buradan anlaşılamıyor. [AI istek yükü](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/setup/ai-suggestions.tsx:108), [paket maddeleri](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/subscription.tsx:218).

Değişiklik: Her AI başlatma eylemi öncesi seçilen dosya sayısı, bu işlemin hesaplama birimi, kalan hak ve yenilenme zamanı; örnekli geniş açıklama alanı. Paket ekranı gerçek yetki sözleşmesini göstermeli. Bir öneriyi seçme ile yeniden üretme kotası karıştırılmamalı. Bu audit'te gerçek ücretli AI çağrısı yapılmadı. Yerel aile free olduğundan kilitli düğme bir hata diye değerlendirilmedi.

## 8. Hassas işlemler ve bağlam devamlılığı — P1/P2

Cihaz erişimi düzenlenirken seçilen çocuklar/PIN tercihi yerel state; PIN eksik bağlantısı ve Geri düğmesi bu draft'ı koruyan bir çıkış kontrolü göstermiyor. PIN belirlemede tek gizli dört haneli alan var; ikinci doğrulama yok. [Cihaz](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/device-access.tsx:27), [PIN](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/menu.tsx:42). Bunlar teknik saldırı kanıtı değil, kullanıcı hatasını önleme eksikleri.

Not listesi çocuk filtresi yeni notun hedefini de belirliyor; varsayılan görünürlük Aile. Kaydetmeden “X çocuğu / Aile üyeleri görebilir” gibi açık hedef/izleyici özeti gerekli. [Not state](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/notes.tsx:27).

Aile seçimi duplicate profillerin otomatik birleşmediğini açıkça anlatıyor; bunu koru. Hesap silme metni tüm ailelere etkisini ve mağaza aboneliğinin ayrı kaldığını doğru açıklıyor; eksik olan yanındaki mağaza yönetimi kısa yolu. [Aile](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/family-choice.tsx:54), [hesap silme](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/account-deletion.tsx:42).

Paylaşımda kapsam/süre var; link oluşturmadan alıcının göreceği alanları önizlemek kontrol hissini güçlendirir. Herkese açık paylaşım ekranı ağ hatasını da geçersiz bağlantı gibi gösteriyor; geçici erişim problemiyle iptal/sona erme ayrılmalı, hassas geçerlilik ayrıntısı sızdırmadan yeniden dene sunulmalı. [Paylaş](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/share.tsx:186), [alıcının ekranı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/s/[token].tsx:76).

## Ortak görsel ve etkileşim yönü

- Aynı kök sayfalarda alt gezinme devam etsin; ayrıntıda geri, sihirbazda adım/çıkış. Şu an görev/ödül/takvim alt menülü, not/puan/ayarlar farklı gövdede; her sayfaya “Ana sayfa” düğmesi eklemek yerine kabuk kararı tutarlı olmalı.
- Birincil eylem dolu mor; ikincil işlem sakin yüzey; gezinti bağlantı; tehlikeli işlem bağlamsal menü+sonuç onayı. Bütün kartları ve menüleri büyük eşit butona çevirmemeli.
- Maskot durumun anlamına katkıda bulunsun; her sayfada aynı boy hero zorunlu olmasın. Şu an farklı bağlam çizimleri zaten var, bunu kaybetmeyelim.
- İlk açılışta rehberlik, tekrar kullanımda kısa yol. Hazır seçimlerin tamamını her seferinde gösteren uzun formlar yerine seçili özeti + düzenle.
- Hata mesajı “ne oldu / ne kaldı / ne yapabilirim”; çalışan bölümü tek sorgu hatası nedeniyle gizlememeli. Ana ekran `me.error` dahil tüm sorgulardan herhangi bir hata için bütün içeriği hata durumuna alıyor; dekoratif selamlama hatası planı engellememeli. [home veri hata birleştirme](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/index.tsx:166).
- Başarı/boş/yükleniyor durumları aynı sanatsal dilde, fakat gereksiz büyük kutu ve ilave CTA üretmeden. Örneğin ödül boş taleplerde katalog bağlantısı + hedef bağlantısı + yeni ödül + kalıcı alt menü birlikte mevcut; bir sonraki anlamlı adımı öncelikle göster.

## Yanlış alarm olarak sunulmaması gerekenler

Ödül süresi örneği `Math.ceil(cost/3)` ile hesaplanıyor ama Türkçe metinde açıkça “Bu bir örnektir; gerçek süre tamamlanan görevlere bağlıdır” yazıyor. Bu bir yalan süre vaadi değil; kişiselleştirme fırsatı P2. Tek çocuklu ana ekranda Tümü filtresi kaldırılmış. Çoklu belge/görsel ve üç AI önerisinden çoklu seçim uygulanmış. Aktarım tablosu ve saat şablonu yeni sürümde mevcut. Aile birleştirme yapılmaması açıkça açıklanıyor. Bunları yeniden eksikmiş gibi saymak güvenilir olmaz.

## Kabul kapısı ve kalan gerçek cihaz kontrolleri

1. İki çocuklu ve tek çocuklu aile; boş, yoğun ve uzun adlı veriler. Her rota/alt akışta kullanıcı kimliği ve kayıt hedefi belirgin.
2. 390×844 telefon, 1280×800 tablet, 1440×900 web; ayrıca dar320, %200 yazı/zoom, klavye açık, yatay/dikey dönüş ve uzun Türkçe içerik. Bu tur ilk üç boyut kaydı var, diğerleri yapılmış sayılmıyor.
3. Aynı anda iki veli düzenlemesi, bağlantı kesilip geri gelmesi, çift dokunma, kaydetme cevabının kaybolması ve hesap/aile değiştirme. Sadece UI render bu doğrulamaların yerini tutmaz.
4. Gerçek iPhone/iPad’de fotoğraf, çoklu galeri, kamera izni, modal kapanması, safe area, geri hareketi ve form klavyesi. Yerel Chromium sonuçları TestFlight kanıtı sayılmaz.
5. VoiceOver/klavye odağı ve hata ilişkileri; Field label/hint mevcut ama hata metninin web alanına `aria-invalid`/`aria-describedby` ile bağlanması ayrıca denetlenmeli. [Field](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/ui/field.tsx:16).

Önerilen sıra: önce kapsam/bağlam ve düzeltme yolları; sonra ortak seçiciler ve AI açıklama/kota; sonra dashboard/gezinti sadeleştirme; en sonda dekoratif yoğunluk, mikro hareket ve ince hizalar. Yeni bir tema üretmek yerine onaylı kimliği kullanım mantığıyla tamamlamak gerekiyor.


## Ek gözlem: iç içe kaydetme eylemleri

Zil düzeni telefonda ana başlık, çocuk seçimi, görünüm ve araç şeritlerinden sonra satır içine açılıyor. İlk görünümün yaklaşık üst 500 pikseli değişmiyor; altta ana “Programı kaydet” devre dışı dururken zil formunun kendi “Bu saatleri uygula” eylemi daha aşağıda kalıyor. Bu bir kayıp veri kanıtı değil, iki aşamalı kaydın kullanıcı tarafından yanlış anlaşılma riski. Zil düzenini kendi Uygula eylemi görünen odaklı yüzeye alıp ardından “Programda değişiklik var; kaydet” durumunu açık gösterelim. [Görsel](screenshots/parent-bell-editor.png), [yerleşim kaynağı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-board.tsx:531).
