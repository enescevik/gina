# GINA ekranlarını daha anlaşılır ve güvenilir kılmak

**GINA’yı şu hâliyle kullanım tasarımı açısından tamamlanmış saymıyorum.** Onayladığın krem, mint ve mor kimlik, logo ve maskot artık tutarlı bir temel oluşturuyor; asıl açık, kullanıcının hangi işi nereden yapacağı, yaptığı seçimin kimi etkileyeceği ve hatasını nasıl düzelteceği. Bazı ekranlar güzel bir çerçevenin içinde hâlâ uzun form, tekrar eden bağlantı ve birbirinden kopuk araç mantığıyla çalışıyor. Daha önemlisi, aile/çocuk kapsamı, geçici/nihai sonuç ve taslak/kayıt/yayın ayrımları her yerde aynı açıklıkta değil. Bu rapor renkleri yeniden seçmek yerine bu davranışları düzeltmeyi öneriyor. Psikoloji, pedagoji, eğitim, yazılım mimarisi ve tasarım bakışlarını birlikte kullandık; ancak çocuklarla yapılmış kullanıcı araştırması, klinik değerlendirme veya bütün cihazlarda eksiksiz test iddiasında bulunmuyoruz. **Bu çalışma inceleme ve değişiklik kapsamıdır; uygulama kodu değiştirilmedi ve yeni yayın yapılmadı.**

## İnceleme bütün rota envanterini kapsıyor; her durum canlı test edilmiş değil

5 Kasım 2026 tarihli `a123b7f` kaynak durumu incelendi. Mobil uygulama ile aile web uygulaması aynı Expo ekran kaynağını kullanıyor; yönetim paneli ayrı bir uygulama. Mobil/web tarafındaki **59 rota dosyası**, yönetimdeki **18 sayfa rotası** envantere alındı. Bunları 77 farklı özgün tasarım diye saymıyoruz: çocuk modunda aynı ekranı kullanan yollar, yönlendirmeler ve giriş kapıları var. Ayrıca 35 veli alt akışı, çocuk/Prova araç durumları, yönetimin kütüphane sekmeleri ve kritik düzenleme diyalogları değerlendirildi. ([Veli envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent-inventory.json>), [çocuk ve Prova envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child-inventory.json>), [yönetim envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice-inventory.json>))

| Alan | Kaynak kapsamı | Gerçek arayüz kontrolü | Bu turda kanıtlanmayanlar |
|---|---|---|---|
| Veli, hesap ve ortak ekranlar | 22 rota; ayrıca 35 alt akış | Ayrı yerel servis ve yapay aileyle 15 veli rotası, 390×844, 1280×800 ve 1440×900; giriş ve form durumlarıyla 72 görüntü | Bütün görüntülerin ayrı görsel incelemesi, tüm hesap çeşitleri, gerçek mağaza ve sosyal giriş işlemleri |
| Çocuk ve Prova | 28 temel giriş/ekran, 9 ortak kullanım/yönlendirme yolu, ayrıca cihaz yerleşim dosyası | 390×844 ve 1280×800; defter ve incelemede ayrıca 768×1024; çizim ve araç açıp kapama denemeleri | Fiziksel iPad yön değişimi, Apple Pencil, gerçek çevrimdışı devam, bütün dolu kütüphane ve ortak Prova durumları |
| Yönetim paneli | 18 rota; kütüphane sekmeleriyle 22 envanter girdisi | 20 başlangıç görünümü; 10 görünüm ayrıca 1280 ve 768 genişlikte; düzenleme/önizlemelerle 51 görüntü | Dolu katkı, resmî senaryo, ortak sınav inceleme ve nihai yayın akışlarının tamamı; gerçek ödeme işlemleri |

Görüntü kaydetmek, o ekranın bütün davranışlarının doğrulandığı anlamına gelmiyor. Araştırma kayıtlarında görsel olarak açılıp incelenen görüntüler ile metin/kontrol üzerinden incelenen görünümler ayrıldı. Üretim hesapları ve verileri değiştirilmedi; ücretli AI çağrısı, satın alma, aileye mesaj veya içerik yayını yapılmadı. Yerel denemede yalnız sentetik bir deftere test çizgisi eklendi. Başlangıçta karşılaşılan eski önizleme kanıt dışı bırakıldı. İnceleme, güncel yerel uygulama çıktısına dayanıyor. ([Kapsam ve sınırlar](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent.md>), [defter etkileşim ölçümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-notebook-interactions.json>))

Aşağıdaki tablolarda **G** ilgili yerel arayüz durumunun gözlendiğini, **K** kaynak kodu ve metin/olay akışı incelemesini, **S** ise arayüzde yalnız başlangıç, boş veya seçimsiz durumun görüldüğünü belirtir. G+K, her iş kuralının çalıştırıldığı anlamına gelmez. **P1**, yanlış karar veya temel kullanım güçlüğü nedeniyle önce çözülmeli; **P2**, akışı ve erişilebilirliği iyileştirmeli; **P3**, son görsel/metinsel incelik. Bu sınırlı denetimde doğrulanmış P0 güvenlik olayı yok; bu ifade güvenlik açığı bulunmadığı garantisi değildir.

## Beş bakış aynı sorunu gösteriyor: seçimin anlamı ve sonucu açık olmalı

| Bakış | Uyguladığımız soru | GINA’daki somut karşılığı | Tasarım kararı |
|---|---|---|---|
| Psikolojik ve bilişsel | Kullanıcı kontrolü elinde hissediyor mu; belirsizlik ve hata korkusu azalıyor mu? | Uyarısız kaybolan taslak, görünmeyen kişiselleştirme sonucu, süreyi durdurmayan “Ara ver”, geçici puanın kesin görünmesi | Sonuçları açık adlandır; geri dönme/düzeltme olanağı ver; beklemeyi ve belirsizliği dürüst göster |
| Pedagojik ve gelişimsel | Çocuk sıradaki küçük işi anlayabiliyor mu; okuma ve araç yükü göreve uygun mu? | Sembol yığını, gizlenen ortak kaynak, küçük soru görseli, açıklamasız kilitli rozetler | İlgili araçları önce göster; görseli okunur kıl; başarıyı kişisel süreç ve somut davranışla açıkla |
| Eğitmen ve ölçme | Seçilen soru gerçekten uygun kapsamda mı; sonuç ve geri bildirim kanıta dayanıyor mu? | Soru bankası doluluğuna bağlı ders seçenekleri, varsayılan doğru A şıkkı, inceleme bitmeden puan, “Seviye tespiti” adı | Sınıf/program/dönem/öğrenme çıktısı bağlamı; bilinçli cevap anahtarı; geçici sonuç; ölçüt ve sonraki çalışma |
| Yazılım mimarisi | Ekranın söylediği kapsam, kayıt ve yetkiyle aynı mı? | Tümü altında ilk çocuk işlemleri, bağlantıda çocuk/tarih kaybı, eski ve yeni yayın yolları | Ortak bağlam modeli, sürümlü kayıt, güvenli tekrar, sunucuda yetki; tek içerik yaşam döngüsü |
| Görsel ve etkileşim tasarımı | İlk bakışta ana iş bulunuyor mu; kontrol okunur ve erişilebilir mi? | Büyük karşılama alanı, eşit ağırlıklı butonlar, daralan model seçimi, dağınık tablet sütunları | Bir belirgin ana eylem; bağlamsal ikincil işlemler; içerik türüne göre alan paylaşımı; tutarlı seçim ve kayıt kontrolleri |

Bu bakışlar tanı veya kişilik çıkarımı değildir. Örneğin “çocuğun şu renge ihtiyacı var” gibi kanıtsız bir yorum yapmıyoruz. Adımların ve tutarlı kontrollerin anlaşılır olması W3C’nin bilişsel erişilebilirlik önerileriyle; geri bildirimin sonraki öğrenme eylemine dönüşmesi EEF yaklaşımıyla; AI’nın şeffaf ve çocuk yararını gözeten kullanımı UNICEF çerçevesiyle uyumludur. Bunlar GINA’nın etkisinin ölçüldüğü anlamına gelmez. ([W3C: açık adımlar](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/), [W3C: anlaşılır yapı](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/), [EEF: geri bildirim](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/feedback), [UNICEF: AI ve çocuklar](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children))

### Önce düzeltilmesi gerekenler görünümden daha derinde

**Takvimde kapsam tutarsız.** “Tümü” aile etkinliklerini toplarken ödev/çanta işlemleri ilk çocuğa düşebiliyor; iki çocuklu denemede bu durum görüldü. Kullanıcıya bütün aileyi gösterdiğini söyleyip tek çocuğa işlem yaptırmak doğru değil. Tümü altında çocuklara göre gruplanmış işler gösterilmeli; tek çocuğa ait işlemde açık seçim yapılmalı. Ana ekrandan görev, hedef ve etkinliğe giderken ilgili çocuk, gün ve kayıt korunmalı. ([Takvim kapsamı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/calendar-screen.tsx:100>), [ana ekran bağlantıları](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/parent-home/home-view.tsx:127>))

**Düzeltme yolu oluşturma kadar güçlü değil.** Mevcut görev ve ödülde duraklatma var, fakat ad/gün/yıldız veya bedel düzeltme yolu belirgin değil; okul puanında mevcut kaydı düzeltme, notta düzenleme eksik. Bu, yalnız bir menü eklemekten ibaret değil: değişikliğin geçmiş tamamlamaları, kazanılan yıldızları ve daha önce istenmiş ödülün fiyatını değiştirmemesi gerekir. ([Görevler](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/tasks/tasks-screen.tsx:345>), [ödüller](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/rewards/rewards-screen.tsx:140>), [puanlar](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/grades.tsx:129>))

**Prova durumları daha dürüst olmalı.** Süreli çalışmada “Ara ver” sürenin durduğu beklentisini yaratıyor, oysa süre mutlak bitiş zamanına göre ilerliyor. Tüm sorular yanıtlı olduğunda bitirme doğrudan teslim edebiliyor. Sonuç örneğinde “95/100” gösterilirken açık uçlu cevapların yalnız bir kısmı puanlanmıştı. Süre devam ediyorsa bunu çıkışta açıkça söylemek, teslimden önce kısa kontrol sunmak ve inceleme bitene kadar “Ara sonuç” demek gerekir. ([Çocuk çözüm akışı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/[examId].tsx:597>), [sonuç özeti](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx:144>))

**Soru görseli okunabilir olmalı.** Defterde görsel alanı küçülüyor ve doğrudan dokunup büyütme yolu yok. Görseli okumak için “deftere kopyala” aracına girmek yanlış bir dolambaç. Bağımsız yakınlaştırma ve kaydırma, kapatınca aynı soru/cevap noktasına dönüş gerekir. Şıklı inceleme ise güncel örnekte doğru yanıt ile çocuğun seçimini ayırıyor ve zorunlu boş defter göstermiyor; bu eski şikâyeti hâlâ varmış gibi yazmıyoruz. ([Görsel bileşeni](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/question-media.tsx:113>), [güncel inceleme kanıtı](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-review-mc-phone.png>))

**Yönetim işlemlerinde görünürlük ve taslak koruması eşit değil.** 768 px AI ayarında model seçimi yaklaşık 41 px’e sıkışıp seçili adı gizliyor; Kaydet yatay kaydırma dışında kalıyor. Hazır seçenek formuna yazılan taslak, “Taslağı kapat” ile uyarısız kayboldu. Aynı üründe destek/yayın akışlarının daha iyi korumaları varken eski editörlerin geride kalması önlenmeli. ([AI ekran kanıtı](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-ai-768.png>), [taslak kapatma](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/input-catalog.tsx:249>))

### Güncel ekranlardan dört kanıt

Aşağıdaki görüntüler yeni tasarım önerisi değil, incelenen güncel yerel uygulama çıktılarıdır. Yapay isim/veri içerirler.

**Aile takvimi:** Tümü görünümü ile tek çocuğa bağlı çanta işleminin kapsamı aynı değil.

![Güncel aile takvimi, telefon](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/parent-calendar-phone.png>)

**Zil düzeni:** Düzenleyici uzun üst alanın altında açılıyor; kendi “Uygula” işlemi ile ana program kaydı iki farklı aşama olarak yeterince ayrılmıyor.

![Ders programı zil düzenleyicisi](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/parent-bell-editor.png>)

**Çözüm defteri:** Dikey web görünümünde defter mevcut; fakat soru görselindeki küçük ayrıntılar için bağımsız büyütme gerekiyor.

![Dikey çözüm defteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-portrait.png>)

**Yönetim AI ayarı:** Tablet genişliğinde seçili model ve kaydetme işlemi aynı okunur bağlamda kalmıyor.

![Yönetim AI ayarı, 768 piksel](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-ai-768.png>)

## Her ekran için değişiklik kapsamı

Tablolar yapılacak işi özetler; satır düzeyindeki kaynaklar, gözlenen durumlar ve daha ayrıntılı kabul ölçütleri bağlı envanterlerde bulunur. Bir işlevi kaldırmak, yayın kuralını değiştirmek veya yeni veri toplamak yalnız görsel düzenleme sayılmamalı. Bu tür öneriler aşağıda ayrıca işaretlenmiştir.

### Hesap, aile ve günlük veli işleri

Bu bölümün kanıtları [veli inceleme notları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent.md>) ve [57 girişli rota/alt akış envanteridir](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent-inventory.json>).

| Ekran / rota | Öncelik, kanıt | Önerilen değişiklik | Bitti sayma ölçütü |
|---|---|---|---|
| Başlangıç `/` | P2 · K | Rol, cihaz ve şifre yenileme yönlendirmelerini ayrı durumlarla koru; burada doğrulanmış bir tasarım kusuru yok | Her rol doğru alana ulaşır; çocuk kilidi geçmiş gezinmesiyle aşılmaz |
| Giriş / kayıt `/(auth)/sign-in` | P2 · G+K | Giriş ile kayıt gerekliliklerini ayır; devre dışı sosyal girişin nedeni anlaşılır olsun; çocuk cihazı alternatifini açık göster | Dönen kullanıcı neden işlem yapamadığını anlar; yetişkin kayıt şartı korunur |
| Aile kur / katıl `/(auth)/family` | P2 · K | Başta “Yeni aile kur / Mevcut aileye katıl” niyeti; hesap silme ilk kurulumun ana seçeneği olmasın | Eşinin ailesine katılacak kişi yanlışlıkla ikinci aile kurmaz |
| Şifre yenile `/reset-password` | P2 · G+K | Girişteki gibi şifre görünürlüğü; süresi dolmuş bağlantıdan doğrudan yeniden isteme | İki giriş kontrol edilir; kullanıcı çıkışsız hata ekranında kalmaz |
| Giriş dönüşü `/auth-callback` | P2 · K | İptal, teknik hata ve tamamlanmayı ayır | İptal kullanılabilir girişe döner; sonsuz yükleme olmaz |
| Cihaz eşleme `/device/pair` | P2 · K | İki cihazda yapılacakları görsel adımlarla anlat; kodun nereye girileceğini göster; QR ayrı sonraki özellik önerisi | İlk kullanımda başka menü tahmin edilmez; süre dolunca yenilenir |
| Bugün `/parent` | P1 · G+K | Onay ve sıradaki iş öne; selamlama/maskot kompakt; aynı verinin tekrarı azaltılsın; bağlantılar bağlamı taşısın | İlk görünümde anlamlı bir sonraki iş; doğru çocuk/gün/kayıt açılır |
| Takvim `/parent/calendar` | P1 · G+K | Tümü kapsamını düzelt; etkinlik, ders ve ödevi aynı gün altında ayrı anlamlarla göster | İki çocuklu ailede hiçbir iş sessizce ilk çocuğa bağlanmaz |
| Görevler `/parent/tasks` | P1 · G+K | Günlük gerçekleşme ile rutin ayarını ayır; ayrıntı ve güvenli düzenleme ekle | Ad/gün/yıldız düzeltmesi kopya görev veya geçmiş puan değişimi üretmez |
| Ödüller `/parent/rewards` | P1 · G+K | Düzenleme, teslim geçmişi ve talep durumları; yanlış ret/iptali önleyen sonuç açıklaması | Bedel değişiminin önceki taleplere etkisi açık; teslim edilmiş ödül bulunur |
| Diğer / ayarlar `/parent/menu` | P2 · G+K | Hesap, aile, cihazlar, öğrenme kayıtları ve yardım grupları; aynı düzeyde tutarlı gezinme | PIN, okul puanı ve destek beklenen kategoride bulunur |
| Cihaz erişimi `/parent/device-access` | P1 · G+K | Kullanıcı/PIN politikası taslağını koru; eksik PIN oluşturup aynı taslağa dön; kayıt özeti | Geri gitmek seçili çocukları sessizce kaybettirmez |
| Aileler `/parent/families` | P2 · G+K | Etkin aile durumu; katılma ve değiştirmeyi ayır; çocuk sayısı ve sonuç özeti | Aile değiştirmek veri birleştirme sanılmaz |
| Okul puanları `/parent/grades` | P1 · G+K | Ders ve tarih seçimi, puan kontrolü, düzeltme/geçmiş, arama/sayfalama | Yanlış kayıt düzeltilir; 200 üzerindeki eski kayıt ulaşılabilir |
| Notlar `/parent/notes` | P1 · G+K | Liste filtresinden bağımsız not hedefi; kim görecek özeti; etiketler, düzenleme | Kaydetmeden çocuk ve izleyici açık; yanlışlık düzeltilebilir |
| Bildirimler `/parent/notifications` | P1 · G+K | Zil yalnız tercih açıyor; giriş adını düzelt veya ayrı gelen bildirim merkezi oluştur | Zil beklentisi ile hedef aynı; merkez eklenmesi ayrı işlev kapsamıdır |
| Paketler `/parent/subscription` | P1 · G+K | Gerçek AI, belge, kütüphane ve kullanım hakları; deneme hakkı ile mağaza aboneliğini ayır | Ekrandaki haklar sunucunun uyguladığı haklarla örtüşür |
| Yardım `/parent/help` | P2 · G+K | Bağlama uygun SSS; isteğe bağlı güvenli ekran görüntüsü, yanıt beklentisi | Kullanıcı sorunu rota adı yazmadan anlatır; hata taslağı kaybettirmez |
| Paylaş `/parent/share` | P1 · G+K | Bağlantı üretmeden alıcının göreceği veri ve süre önizlemesi; listede arama | Veli hangi veriyi açtığını bilir; önceki bağlantılar bulunur |
| Haftalık özet `/parent/weekly-review` | P2 · G+K | Veri dönemi/kapsamı; öneriyi isteğe bağlı düzenlenebilir plana dönüştür | AI kendiliğinden görev atamaz; veli öneriyi düzeltip seçer |
| Görsel kaynakları `/parent/room-credits` | P3 · G+K | Genel düğme adı yerine gerçek kaynak adı ve kısa atıf satırları | Bağlantının adı hedefini doğru anlatır |
| Paylaşılan görünüm `/s/[token]` | P2 · K | Geçici ağ problemiyle kullanılamayan bağlantıyı ayır; güvenli yeniden dene | Ağ kesintisi yeni bağlantı gerektiriyor sanılmaz; kapalı veriye erişilmez |

### Veli ekranlarının içindeki sihirbaz ve düzenleyiciler

Burada 35 alt durum, aynı işlemin parçaları olduklarında birlikte gösteriliyor. **Ders programının eski uzun liste problemi büyük ölçüde ele alınmış:** açıklama alanı, kısaltma eşleme, gün/hafta tablosu, zil düzeni, derslerin saatlerini kaydırma, yer değiştirme ve geri alma mevcut. Kalan iş, bunları daha açık bir düzenleme akışına yerleştirmek ve benzer kaliteyi diğer formlara yaymak. Çoklu dosya/galeri/kamera seçimi ve AI önerilerinden çoklu seçim de mevcut; yeniden yapılacak eksik olarak yazılmıyor. ([Güncel aktarım](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-import.tsx:494>), [tablo](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/timetable-board.tsx:593>), [kaynak seçici](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/source-files-picker.tsx:24>))

| Akış ve kapsanan durumlar | Öncelik | Değişiklik / kabul |
|---|---|---|
| Ana ekran onayı ve haftaya açılma | P1/P2 | Geri gönderilen göreve somut düzeltme açıklaması; Bugün sayılarıyla seçili günün planı ayrılmalı |
| Çocuk ekleme: profil, okul, rutinler, son kontrol | P1/P2 | Avatarlar kademeli; sınıf/yaş rahat seçilir; zorunlu öğrenme bilgisi ile isteğe bağlı kimlik ayrılır; seçilen her rutin uzun form açmaz; son kontrolde günler görünür |
| Görev: şablon/kendi/AI kaynağı ve ayrıntı | P2 | Sık kullanan için kısa yol; okul günü/hafta sonu/tek sefer hazır seçenekleri; başlangıç/bitiş ayrıntıları isteğe bağlı |
| Ödül oluşturma ve hedef seçimi | P2 | Yıldız bedeli hazır değer/adım kontrolü; hedef seçiminde mevcut hedef ve birikim; hedef seçmek yıldız harcamak değildir |
| Görev/ödül için AI-belge önerisi | P1 | Örnekli geniş açıklama, dosya sayısı ve işlem hakkı özeti; çoklu seçim korunur; yeniden deneme çift tüketmez |
| Etkinlik düzenleme | P1 | Tarih/saat seçici; tür ve başlık önerileri; tekrar eden kayıtta tek gün/tüm seri kapsamı |
| Ders tablosu, tek ders düzenleme, gün kopyalama | P2 | Ders kataloğu; dolu hücre değişimi ve boş hücreye taşıma; hedef günün önce/sonra görünümü, geri alma |
| Zil düzeni | P1/P2 | Odaklı düzenleme alanı; ilk ders/süre/ara/öğle arası; seçili gün/tüm günler açık; “Uygula” ve “Programı kaydet” aşamaları anlaşılır |
| Program aktarımı: kaynak, kontrol, kaynak kaldırma | P1/P2 | Yeni tablo korunur; belirsizlik hücre üzerinde; kaynak görüntüyle karşılaştırma; ek dosyayı kaldırmak dersleri silmekten ayrı anlatılır |
| Ödev/çalışma listesi, düzenleyici ve belge aktarımı | P1/P2 | Elle tarih biçimi yerine seçici; belgeye bağlam; işleri günlere topluca dağıtma; kaynak tarihi ve kullanıcının seçimi ayrılır |
| Çanta listesi | P2 | Yarınki derslerden düzenlenebilir eşya önerisi; zorunlu okul talebi gibi sunulmaz; özgür ekleme korunur |
| Çocuk PIN’i, veli PIN’i ve eşleme sonrası erişim | P1/P2 | Tutarlı PIN kontrolü ve yeni PIN doğrulaması; eşleme tamamlandıktan sonra kimlerin kullanacağı/PIN kuralı özetlenir |
| Çocuk silme, hesap silme ve e-posta doğrulama | P1/P2 | İsim/veri etkisi, yeniden doğrulama, kod süresi/yeniden gönderme; mağaza aboneliği yönetimine bağlantı; mevcut silme açıklamaları korunur |
| SSS, destek yazma, görüşme | P2 | Sıradan Türkçe arama terimleri, ilgili yazı önerisi, isteğe bağlı gizlenmiş görsel, taslak koruma ve görüşmeye dönen bildirim |
| Deneme paketi ve paylaşım oluşturma | P1/P2 | Deneme bitişi ile gerçek abonelik ayrı; paylaşılan alanlar ve süre alıcı görünümüyle onaylanır |
| Ortak hata durumu | P2 | Çevrimdışı, oturum bitmiş, yetkisiz ve geçici servis hatası farklı güvenli eyleme yönlendirir; ilgisiz tek sorgu hatası çalışan bütün ekranı kapatmaz |

Ödülün “günde 3 yıldız” hesabı mevcut metinde açıkça **örnek** diye belirtiliyor. Bunu yanlış süre vaadi saymıyorum; gerçek kazanma düzenine göre kişiselleştirmek sonraki iyileştirme olabilir. Aynı şekilde tek çocuklu ana ekrandaki gereksiz Tümü seçimi kaldırılmış; güncel hata olarak yeniden listelenmemeli. ([Doğrulama ve yanlış alarmlar](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent.md>))

### Çocuk ekranları ve güvenli devir

Bu bölüm [çocuk ve öğrenme incelemesine](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child.md>) dayanır. Odanın onaylı özgün görseli korunmalı. Bu rapor gerçek 3B sahne, hava değişimi veya yeni maskot üretimini yeniden gündeme getirmiyor.

| Ekran / rota | Öncelik, kanıt | Önerilen değişiklik | Bitti sayma ölçütü |
|---|---|---|---|
| Cihazdaki çocuklar `/child` | P2 · K | İzinli profil yoksa yetişkinden yardım ve yeniden deneme; tek profilde gereksiz seçimden kaçın | Çocuk beklemenin nedenini ve yapabileceği adımı anlar |
| Çocuk PIN’i `/child/pin` | P2 · K | Avatar/ad, dört nokta, sakin hata ve yetişkin yardım yolu; diğer çocuk girişiyle ortak kontrol | Aynı PIN işi iki farklı etkileşim öğretmez |
| Dünyam `/child/today` | P1 · G+K | Görev, ödev ve atanmış Prova’yı dikkate alan sıradaki adım; sabit oda korunur | Görevler bittiğinde bekleyen Prova varken bütün gün tamam sanılmaz |
| Görev haftası `/child/week` | P1 · G+K | Geri gönderilen işin nedeni ve yeniden deneme; tamamlanmadı ile aynı etikete düşmesin | Çocuk neyi düzelteceğini görür; emeği yok sayılmış görünmez |
| Çocuk takvimi `/child/calendar` | P2 · G+K | Bugün/yarın, ödev ve çanta önceliği; kendi ekranında gereksiz kişi filtresi yok | Yarın ne hazırlayacağı tek görünümden anlaşılır |
| Koleksiyon `/child/collection` | P2 · S+K | Rozetin anlamı, kazanma koşulu ve kişisel ilerleme; kilitlerden oluşan duvar azaltılır | Çocuk rozet için hangi davranışı sürdürdüğünü söyleyebilir |
| Hedef `/child/goal` | P2 · G+K | Mevcut yıldız, hedefe kalan fark, sabit seçim özeti; birikimin korunması | Uzun listede seçilen hedef ve onay görünür |
| Odamı düzenle `/child/room-preview` | P1 · G+K | Sahneyi değiştirmeyen seçimi özelleştirme gibi sunma; “Tercihlerim” adı veya geçici gizleme ayrı ürün kararı | Kaydetmenin neyi değiştirdiği önceden ve sonradan açık |
| Provalarım `/child/prova` | P1 · G+K | Süreli/tahmini süre ayrımı; şıklı sonuç ile açık uçlu inceleme durumunu birlikte göster | Karışık sınavın kısmi sonucu tamamının sonucu sanılmaz |
| Çözüm `/child/prova/[examId]` | P1 · G+K | Tek çözücü yapısı; okunur soru/görsel; süre uyarısı; teslim öncesi kontrol; araçları bağlama göre aç | Soru/cevap dönüşte korunur; yakınlaştırma çizime dönüşmez; teslim bilinçlidir |
| Veli telefonunda çocuk modu `/parent/child-mode` | P2 · K | İlk kullanım açıklaması, sonra kısa avatar/PIN akışı; eşleme gerekmediğini belirt | Aynı telefonda çocuk modu ile ayrı cihaz bağlama karışmaz |
| Veli cihazında Dünyam ve yetişkine dönüş `/parent/child-mode/today` | P2 · G+K | Çocuk ekranı önde; çıkışta yetişkin adımı ve güvenli kurtarma | PIN/ağ/sosyal hesap dönüşleri çocuk kilidini korur |

Çözüm defterinde **dikey web görünümü açıldı**; sentetik çizim sırasında ölçülen kaydırma konumu değişmedi. Yazı, Semboller ve Diğer araçlar açılıp kapatıldığında web görünümü 768×1024 kaldı. Bu gözlem, fiziksel iPad’deki yön değiştirme döngüsünün tamamen bittiğini kanıtlamaz. Gerçek Pencil, avuç içi teması, iOS klavyesi ve uygulamadan çıkıp dönme kabul testinde kalıyor. ([Etkileşim kaydı](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-notebook-interactions.json>))

### Veli Prova hazırlama, inceleme ve gelişim

| Ekran / rota | Öncelik, kanıt | Önerilen değişiklik | Bitti sayma ölçütü |
|---|---|---|---|
| Prova merkezi `/parent/prova` | P2 · G+K | Hazırla, gönderilenler, inceleme ve sonraki adım; aynı sınavın tekrar kartlarını azalt | Veli tek çalışma için hangi kartı açacağını bilir |
| Birleşik hazırlayıcı `/parent/prova/builder` | P1 · G+K | Ders seçenekleri soru bankası doluluğundan bağımsız katalogdan; sınıf/program/dönem bağlamı; tek taslakta tüm kaynaklar | Boş bankada da ders seçilir; çocuk değişince uyumsuz kapsam uyarılır |
| Tek soru `/parent/prova/question` | P1 · G+K | Uzun formu soru/görsel → yanıt/ölçüt → önizleme olarak böl; doğru şık başlangıçta boş | Veli bilinçli cevap anahtarı seçer; öğrenci görünümünü kayıttan önce görür |
| Ortak kaynak `/parent/prova/shared-source` | P2 · G+K | Ayrı ürün gibi değil hazırlayıcı içindeki soru bloğu; bağlı soru listesi görünür | Aynı sınavda tekil ve ortak metin/görselli sorular birlikte kalır |
| Kütüphane `/parent/prova/library` | P2 · S+K | Uygun içerik, ailedeki içerik ve katkılar ayrılır; edinme ile taslağa ekleme açıklanır | Hak ne zaman harcanır bilinir; aynı edinim yeniden tüketmez |
| Resmî senaryo `/parent/prova/catalog` | P2 · G+K | Kontrollü öğretim yılı, sınıf/dönem/yazılı özeti; okulun seçtiği senaryo ayrı doğrulanır | Kaynak bulunamadığında uygun soru üretildi izlenimi verilmez |
| Soru dağılımı `/parent/prova/blueprint` | P2 · G+K | “Senaryo” belirsizliği yerine Soru dağılımı; konu/kazanım seçimi ve sayı dağılımı | Şablon kaydetmek soru üretmek sanılmaz; hangi Prova’ya ekleneceği açıktır |
| Başlangıç çalışması `/parent/prova/level` | P1 · G+K | Standart ölçüm çağrıştıran “Seviye tespiti” dilini düzelt; çocuk sınıfı; üretimden sonra önizleme/atama | Tek örneklem tanı veya kesin yeterlilik sonucu gibi sunulmaz |
| Kitapçık `/parent/prova/booklet` | P2 · G+K | Öğrenci nüshası ile cevap anahtarı ayrı; soru seçimi ve sayfa önizlemesi | Çocuğa verilen çıktıya yanlışlıkla çözüm eklenmez |
| Birlikte Prova `/parent/prova/groups` | P2 · S+K | Amaç/uygunluk, katılım, sonuç aşamaları; sıralama ikincil ve isteğe bağlı | Sıralamaya katılmadan çalışma yapılır; bekleyen sonuç kesin görünmez |
| Gelişim `/parent/prova/progress` | P2 · G+K | Grafiğin hangi sayıyı gösterdiği ve veri kapsamı; konu filtresi ve kanıt sorusuna erişim | Az gözlem aşırı yoruma dönüşmez; bekleyen cevap yanlış sayılmaz |
| Sonuç özeti `/parent/prova/attempt/[attemptId]` | P1 · G+K | Önce inceleme durumu, sonra puan; tek “İncelemeyi tamamla”; AI ilgili incelemenin içinde | Eksik puanlama varken sonuç geçici etiketlidir |
| Cevap inceleme `/parent/prova/review/[attemptId]` | P1 · G+K | Soru/ortak kaynak/cevap birlikte; şıklı ve açık uçluya uygun alan; ölçüt ve somut geri bildirim | Çocuğun cevabı değişmez; veli hangi kanıta puan verdiğini görür |
| Tekrar `/parent/prova/repeat/[attemptId]` | P2 · G+K | Sorular → gün/süre → son kontrol; ortak kaynak grubunu koru | Aynı tekrar iki kez oluşmaz; takvimde günlük yük görünür |
| Çalışma planı `/parent/prova/plan/[planId]` | P2 · K | Tek Planla alanında mevcut takvim, süre ve çakışma; AI önerisini veli seçer | Gün onayı olmadan takvime iş yazılmaz; arşiv atanmış işi silmez |
| Katkı paylaş `/parent/prova/share` | P2 · S+K | Kaydetme sonrası ayrı katkı adımı; içerik, kişisel veri, inceleme ve kazanılacak hak özeti | Aileye kaydetmek yayımlama sanılmaz; ret sonrası düzeltme yolu vardır |

Bu alanda **bir çalışma, bir taslak, bir soru sırası** ilkesi öneriyorum. AI ile üç soru üretmek, kütüphaneden beş soru eklemek ve ortak metne bağlı iki soru yazmak aynı sınavın içindeki ekleme yöntemleri olmalı. Ortak kaynak mevcutta hazırlayıcıya eklenebiliyor; ihtiyaç sıfırdan bu yeteneği yazmak değil, bütün girişleri aynı taslak ve aynı kavramlarla birleştirmek. Soru bankası, program/kazanım kataloğu yerine geçmemeli. Okul adı veya cinsiyetten yetenek çıkarılmamalı; sınıf, eğitim programı, dönem, öğretmenin seçtiği kapsam ve veli tercihi somut bağlamdır. ([Hazırlayıcı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/prova-builder.tsx:132>), [ortak soru akışı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/shared-question-wizard.tsx:648>))

Defter alt akışları da incelendi: Soru/Defter geçişi, genişletme, görsel/metin alma, kırpma, kalem/silgi/seçim, yazı/semboller, diğer araçlar, kayıt/çakışma, teslim ve yerel cevap kurtarma. Araçları kaldırmak yerine ilk kullanımda kısa yardım, sınıfa/işe uygun semboller ve son kullanılanlar öneriliyor. Veli incelemesinde soru seçimi, not katmanı, AI önerisini alma, taslak kurtarma ve nihai kaydetme ayrı anlamlarını korumalı. Yapay zekâ önerisi bir değerlendirme asistanıdır; çocuğun kişiliğine veya ruh hâline ilişkin hüküm değildir. ([Defter ve inceleme ayrıntıları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child.md>))

### Ortak kullanılan yollar ayrı tasarım diye çoğaltılmamalı

| Yol | Kullandığı ekran / hedef | Ayrı kontrol gereği |
|---|---|---|
| `/parent/child-mode/calendar` | `/child/calendar` | Veli cihazındaki çocuk oturumu ve geri dönüş sınırı |
| `/parent/child-mode/collection` | `/child/collection` | Doğru çocuk ve rol kapsamı |
| `/parent/child-mode/goal` | `/child/goal` | Hedef kaydı ve çocuk kapsamı |
| `/parent/child-mode/room-preview` | `/child/room-preview` | Aynı tercih açıklaması ve güvenli geri dönüş |
| `/parent/child-mode/week` | `/child/week` | Doğru çocuk/gün ve durumlar |
| `/parent/child-mode/prova` | `/child/prova` | Atanmış çalışmaların yetkili çocuğa ait olması |
| `/parent/child-mode/prova/[examId]` | `/child/prova/[examId]` | Cevap, teslim ve oturum kilidi |
| `/parent/prova/exam` | `/parent/prova/builder` | Mevcut grup bilgisinin korunması |
| `/parent/prova/generate` | `/parent/prova/builder` | Eski girişin doğru taslağa yönlenmesi |

Aynı çizimi kullanmak aynı yetki sınırına sahip olmak demek değildir. Ortak cihaz, kişisel cihaz ve veli telefonunda çocuk modu yollarının yetki/geri gezinme testleri ayrı kalmalı. ([Yol eşlemeleri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child-inventory.json>))

### Yönetim paneli veri tablosundan iş kuyruğuna dönüşmeli

Bu bölümün kaynağı [yönetim inceleme notları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice.md>) ve [22 girişli envanterdir](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice-inventory.json>). Yöneticiye aynı GINA kimliğinin daha sakin, okunur çalışma yüzeyi gerekir; her tabloda büyük peluş görsel veya dekoratif kart gerekmiyor.

| Ekran / rota | Öncelik, kanıt | Önerilen değişiklik | Bitti sayma ölçütü |
|---|---|---|---|
| Başlangıç `/` | P2 · K | Yükleme ve rol eksikliğini ayır; doğru hesap/yetki isteme yolu | Her rol uygun başlangıca ulaşır |
| Yönetici girişi `/sign-in` | P2 · G+K | Parola görünürlüğü, gönderim durumu, yenilemeden panele dönüş; iki giriş katmanını açıkla | Kullanıcı Cloudflare ile GINA girişini karıştırmaz |
| Panel `/dashboard` | P1 · G+K | Sayılardan önce bekleyen destek, inceleme, hata ve yayın işleri; role göre öncelik | Operatör ilk üç işi ve neden beklediğini görür |
| Aileler `/families` | P2 · G+K | Ad/paket/son durum öne; kimlik ayrıntıda; arama ve gerçek sayfalama | İlk 100 bütün kayıt gibi sunulmaz; tablette temel eylem görünür |
| Paket ve ödeme `/billing` | P2 · G+K | Sabit aile bağlamı; mağaza/geçici hak zaman çizgisi; geçmiş sayfalama | İade, iptal ve ücretsiz erişim karışmaz |
| Geçici hak `/overrides` | P1 · G+K | Seçilen aile özeti, süre hazır seçenekleri, önce/sonra etkisi | Yanlış aile veya kapsam farkı onaydan önce fark edilir; güvenli tekrar korunur |
| AI ayarları `/ai` | P1 · G+K | Dar tablo yerine paket düzenleme paneli; model yeteneği, test ve etki özeti; taslak/yüklenme koruması | Seçili model ve Kaydet aynı görünür bağlamda; kapatma etkilenen akışları gösterir |
| AI işlemleri `/operations` | P1 · G+K | Hata kuyruğu önce, politikalar ayrı; durum/işlem/aile/tarih filtreleri | İncele doğru olayı açar; ilk 100 dışında kayıt bulunur; yeniden deneme etkisi anlaşılır |
| Hazır seçenekler `/input-catalog` | P1 · G+K | Otomatik kimlik, bilinçli sınıf kapsamı, ders eşanlamlıları, telefon önizleme ve taslak koruma | Kapatmak yazılanı sessizce silmez; MAT/İNG doğru ders kaydına bağlanır |
| Eski soru bankası `/questions` | P1 · S+K | JSON şık editörü yerine ortak soru editörü; sürümlü düzeltme ve etki önizlemesi | Atanmış/yayımlanmış içerik sessizce değişmez |
| Kütüphane `/library` | P1 · G+K | Soru bankası/koleksiyon/taslak için tek içerik yaşam döngüsü; eski içerik korunarak taşınır | Kaydet hiçbir yoldan yanlışlıkla yayınlamaz |
| Taslak paketler `/library?tab=drafts` | P2 · G+K | Soru/kaynak/ölçüt karar sırasında erişilebilir; hatalı paket için alan bazlı açıklama ve örnek | İnceleme notu yazarken kanıt kaybolmaz; geçerli dosya yolu anlaşılır |
| Yayına hazırla `/library-publication` | P2 · S+K | Program/dönem seçimi, yeterli açıklama alanı, aile erişim/hak önizlemesi | Önizleme gerçek erişimi anlatır; kayıt ile yayın ayrımı korunur |
| Haklar ve ödüller `/library?tab=policy` | P1 · G+K | Kabul sayısına göre kazanılacak hakkın örnek hesabı; çakışan kuralların toplamı | Birden çok kuralın birlikte etkisi ve eski hakların korunması görünür |
| Katkılar `/library?tab=review` | P1 · S+K | Soru bazında düzeltme işaretleri, rubrik düzenleme; kısmi kabul ayrı iş kuralı önerisi | Ortak kaynak bütünlüğü ve kabul edilen özgün soru sayısı korunur |
| Senaryo kaynakları `/library?tab=curriculum` | P1 · S+K | Belge/dağılım/kazanım yan yana; standart yıl/program/okul kapsamı | Dosya uyumu pedagojik onay sanılmaz; okulun seçimi ayrı kalır |
| Birlikte Prova `/groups` | P1 · S+K | Kapsam → sorular/süre → aile/çocuk önizleme; inceleme iş yükü | Katılım penceresi, kişisel süre, içerik sabitleme ve sıralama tercihi açık |
| Ortak cevap inceleme `/cohort-review` | P1 · S+K | Sonraki incelenmemiş/itirazlı kuyruğu; kanıt ve rubrik birlikte; puanlanmamış ≠ sıfır | Okunamayan defter boş cevap sayılmaz; büyük katılımda kayıt bulunur |
| Destek `/support` | P2 · G+K | Sorumlu, bekleme süresi, arama, hazır yanıt ve ilgili yardım yazısı | Özel not aileye gitmez; taslak yanlış görüşmeye taşınmaz |
| Fikirler `/ideas` | P2 · G+K | İnceleniyor/planlandı/yapılıyor/yayımlandı ürün durumları; benzer fikir ilişkisi | Destek görüşmesi kamu oylamasına dönüşmez; taahhütsüz tarih verilmez |
| Yardım yazıları `/help-articles` | P2 · G+K | Başlıktan kod önerisi; kısa yanıt/adımlar/bağlantılar; cihaz önizleme ve dil farkı | Taslak yayımlanmış yanıtı değiştirmez; yazı gerçek işlemi yaptırır |
| Bildirim işlemleri `/notifications` | P2 · G+K | Olay ve çözüm özeti; teknik makbuz ikincil; tekrarın nedeni ve kapsamı | Sağlayıcı kabulü “okundu” diye sunulmaz; başarılı gönderi yeniden yollanmaz |

## Ortak tasarım sistemi yalnız renk değil, davranış da tanımlamalı

**Tek kontrol dili kurulmalı.** Tarih ve saatler normal kullanımda elle biçim yazdırmamalı; süre ve puanlarda hazır değerler, artır/azalt ve gerektiğinde elle giriş bulunmalı. Ders, konu, çanta eşyası ve ödev türü aynı yönetilen katalogdan beslenmeli; özgür metin son seçenek olmalı. Açıklama veya AI yönlendirmesi gerçekten metin istiyorsa çok satırlı, örnekli ve düzenlenebilir olmalı. Her seçici seçilen değeri, kapsamı ve değiştirme yolunu aynı biçimde göstermeli. Şu anda çanta/ödevde rehberli seçim varken puan/not/etkinlikte ham girişe dönülmesi bu tutarlılığı bozuyor. ([Rehberli alan](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/ui/guided-field.tsx:64>), [etkinlik düzenleyici](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/planner/event-editor.tsx:347>))

**Tek kayıt dili kurulmalı.** Taslak, bu ekrana uygula, sunucuya kaydet, çocuğa ata ve yayımla farklı sonuçlardır. Rutin bir taslağı kaydetmek gereksiz onay istememeli; başka aileleri etkileyen model/paket/yayın değişikliği önce–sonra etkisini göstermeli. Düğme devre dışıysa nedenini söylemeli. Kullanıcı yazmışsa geri/sekme/kapat işlemleri aynı taslak korumasını uygulamalı. Tekrar deneme yeni iş veya ikinci ücret yaratmamalı; cevabı bilinmeyen işlemde önce durum kontrol edilmeli. Destek, geçici hak ve yeni yayın akışlarındaki korumalar ortak örnek alınabilir. ([Geçici hak akışı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/overrides.tsx:148>), [destek akışı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/support/help-center.tsx:745>))

**Tek görsel hiyerarşi kurulmalı.** Dolu mor düğme ekrandaki ana işi taşımalı; ikincil işlem sakin yüzey, gezinme bağlantı, seyrek işlem bağlamsal menü olmalı. Bu, her ekranda yalnız bir tıklanabilir şey bulunması demek değildir. Birbiriyle yarışan aynı ağırlıktaki düğmeleri azaltmak demektir. Telefonda ana iş ve kısa özet; tablette karşılaştırılması gereken iki içerik birlikte; geniş webde liste/ayrıntı düzeni kullanılmalı. İki sütun oluşturmak kendi başına tablet tasarımı değildir: boş/dolu alan dengesi, okunur satır uzunluğu ve kayıt düğmesinin hangi bölüme ait olduğu tasarlanmalı. ([Veli görsel bulguları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent.md>), [yönetim ölçümleri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice.md>))

**Maskot anlamlı bir yardımcı olmalı.** Onaylı karakter, oda ve harf biçimleri korunmalı. Maskot ilk kurulumda yönlendirebilir, gerçekten boş bir durumda bir sonraki adımı gösterebilir, kısa bir başarıyı kutlayabilir. Her sayfanın ilk yarısını kaplayan zorunlu karşılama görseline dönüşmemeli. Hareket yalnız dikkat çekmesi gereken durum, kısa geri bildirim veya isteğe bağlı atmosfer için kullanılmalı; okuma, çizme ve puanlama sırasında döngüsel hareket olmamalı. Hareket azaltma tercihi, sesin kullanıcı kontrolünde olması ve aynı işin animasyonsuz da anlaşılması kabul ölçütüdür. Bu bölüm yeni animasyon üretimi değil, önerilen ortak davranış standardıdır.

**Öğrenme içeriği ile ödül dili ayrılmalı.** Görev yıldızı çocuğun yeteneğini, tek Prova puanı genel başarısını, maskot mimiği gerçek ruh hâlini temsil etmez. Çocuk ekranında küçük ve uygulanabilir sonraki adım; veli ekranında kanıt, veri kapsamı ve düzenlenebilir öneri; yönetimde içerik uygunluğu ve ölçüt gerekir. Sıralama açık rızaya bağlı ve ikincil kalmalı. Aynı sınıfın tek başına aynı program veya aynı öğrenme deneyimi demek olmadığı içerik seçiminde hesaba katılmalı. ([Gelişim ekranının mevcut sınırlılık açıklamaları](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/learning-progress-view.tsx:314>), [öğrenme incelemesi](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child.md>))

**Korunacaklar açıkça sabitlenmeli.** Yerel cevap günlüğü, kayıt sırası/sürüm kontrolü, idempotent işlemler, çocuğun özgün çözümünden ayrı veli notu, AI önerisinin veli onayından ayrılması, ortak kaynağa bağlı soru bütünlüğü, taslak–inceleme–yayın ayrımı ve destek özel notu korunmalı. Ekranı sadeleştirmek için bu korumaları kaldırmak ilerleme olmaz. Mevcut çoklu kaynak seçimi, çoklu AI önerisi kabulü, gelişimde az veri açıklaması ve isteğe bağlı sıralama da korunacak temeldir. ([Cevap akışı](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/[examId].tsx:200>), [veli inceleme](</Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/parent-review-workspace.tsx:448>), [yönetim korumaları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice.md>))

Ayrı ürün/veri kararı gerektiren öneriler; gelen bildirim merkezi, sıradaki işi görev/ödev/Prova arasında seçme kuralı, oda tercihlerinin yeniden adlandırılması veya geçici gizlenmesi, mevcut kayıtların geçmişi koruyan düzenlemesi, katkıların kısmi kabulü, destek iş atama ve birleşik içerik sürümleme yoludur. Bunları yalnız görünüm değişikliği altında sessizce uygulamamak gerekir. Soru/özellik kaldırmak yerine önce aynı görevin gereksiz girişlerini birleştirmek öneriliyor.

## Uygulama sırası yanlış anlamayı azaltarak başlamalı

| Faz | Yapılacak iş | Somut kabul kapısı |
|---|---|---|
| 1 — Kapsam ve durum doğruluğu | Tümü/çocuk ayrımı, bağlantı bağlamı, geçici puan, süreli çıkış, teslim kontrolü, taslak kaybı, küçük soru görseli | İki çocuklu ailede doğru kayıt; eksik incelemede ara sonuç; süre devamı açık; geri dönünce taslak korunur; soru görseli cevabı bozmadan büyür |
| 2 — Ortak seçim ve düzeltme | Tarih/saat/süre/puan, ders kataloğu, geniş AI açıklaması, kota özeti, görev/ödül/not/puan düzenleme | Normal iş için biçim ezberlemek gerekmez; mevcut kayıt kopyalanmadan düzelir; geçmiş anlamı korunur; işlem hakkı başlamadan anlaşılır |
| 3 — Veli günlük akış ve kurulum | Ana ekran önceliği, çocuk sihirbazı, takvim/ödev/çanta, cihaz ve PIN, paket açıklaması | Yeni ve deneyimli veli aynı işi farklı rehberlik yoğunluğuyla tamamlar; ilk görünümde sonraki iş ve hedef çocuk nettir |
| 4 — Çocuk ve Prova bütünlüğü | Tek hazırlayıcı, ortak kaynak bloğu, tek çözücü, cevap türüne uygun inceleme, plan/gelişim | AI+elle+kütüphane aynı taslakta; çocuk soru/cevap kaybetmez; geri bildirim bir sonraki öğrenme adımına dönüşür |
| 5 — Yönetim çalışma alanları | İş kuyruğu, okunur AI ayarı, tek içerik yaşam döngüsü, etki önizleme, yardım/destek iyileştirmesi | Yanlış aile/model/paket/yayın kararı önlenir; operatör bekleyen işi aramak için ayar tablolarını geçmez |
| 6 — Cihaz, erişilebilirlik ve yayın denetimi | Gerçek iPhone/iPad/Android, geniş ve dar web, büyük yazı, klavye, ekran okuyucu, ağ ve yetki senaryoları | Her kritik işin başlangıç, tamamlanma, hata, geri dönüş ve eşzamanlılık kanıtı; açık P1 kalmadan yayın kararı |

Fazlar maliyet veya süre tahmini değildir. Aynı ortak bileşen birden fazla fazı destekleyebilir; ancak iş kuralı ile görsel değişiklik ayrı doğrulanmalı. Önce bir temel akışın bitiş ölçütünü karşılamak, bütün ekranların yüzeyini aynı anda yeniden boyamaktan daha değerlidir. Bu raporun sonucunda yeni bir logo veya yeni oda tasarlamaya ihtiyaç görmüyorum.

### Yayına hazır demeden önce tamamlanacak doğrulama

| Denetim alanı | Bu incelemenin ardından gereken kanıt |
|---|---|
| Gerçek mobil çizim | iPad dikey/yatay; araçları 20 kez aç/kapat; Pencil/parmak/avuç içi; klavye; arka plana alıp dönme; çizim sırasında kaydırma kontrolü |
| Boyut ve erişilebilirlik | 320 px dar görünüm, büyük yazı/%200 yakınlaştırma, uzun Türkçe adlar, klavye açıkken eylemler, VoiceOver/klavye odağı, kontrast ve hareket azaltma |
| Veri yoğunluğu | Boş, tek ve çok çocuk; uzun takvim; 100 üzeri yönetim kaydı; çok sorulu/ortak kaynaklı sınav; dolu katkı ve ortak Prova inceleme |
| Güvenilir kayıt | Yavaş ağ, yanıtın kaybolması, tekrar dokunma, uygulamayı kapatma, iki velinin/operatörün aynı kaydı düzenlemesi; mükerrer kayıt/kota oluşmaması |
| Yetki sınırı | Veli/çocuk/bağlı cihaz/yönetim rolleri; aile değişimi, süresi dolan oturum, rol kaybı, doğrudan bağlantı; UI gizlemenin ötesinde sunucu kontrolü |
| Dış servisler | Gerçek Google/Apple giriş ve şifre yenileme; galeri/kamera izinleri; mağaza satın alma/geri yükleme; gerçek AI belge akışı; cihazda bildirim |
| İnsanlarla kullanım | Çocuk ve veliyle izinli kısa görev denemeleri; öğretmenle kapsam/ölçüt incelemesi; yardım almadan bitirme, yanlış hedefe işlem, geri dönüş ve anlaşılmayan metinlerin kaydı |

Bu son satır özellikle önemlidir: beş mesleki bakışla yapılan sezgisel denetim, gerçek insanların kullanırken yaşadığı bütün güçlükleri göstermez. “Nereden başlayacağını buldu mu?”, “hangi çocuğa işlem yaptığını biliyor mu?”, “hatasını yardım almadan düzeltebiliyor mu?” gözlenmeden kullanımın tamamlandığını söylememeliyiz. Bugünkü kanıtlar tasarımın değişmesi gereken yerlerini belirlemek için yeterli; bütün işlevlerin hatasız veya bütün güvenlik sınırlarının aşılmaz olduğunu ilan etmek için yeterli değil.

GINA’nın kalite hissi, daha fazla gölge veya hareketten çok, kullanıcının verdiği kararın uygulamada beklediği sonucu görmesinden doğacak. Bundan sonraki geliştirme için esas başarı ölçüsü, ekranın onaylı kimliğini korurken aileden daha az hatırlama, daha az tekrar giriş ve daha az belirsiz karar istemesidir.

Ayrıntılı kanıt dosyaları: [veli ve hesap notları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent.md>), [çocuk ve Prova notları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child.md>), [yönetim notları](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice.md>). Ekran bazında değişiklik/kabul kayıtları: [veli envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/parent-inventory.json>), [çocuk/Prova envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-child-inventory.json>), [yönetim envanteri](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice-inventory.json>). Tüm dosyalar bu denetimin kaynağına aittir; önceki sürüm raporlarının yerine geçmiş kusurları otomatik taşımadık.
