# GINA çocuk ve öğrenme akışları — derin ekran incelemesi

## Kapsam ve kanıtın sınırı
### Takeaway
Bu çalışma bir tasarım ve kullanım denetimidir; psikolojik tanı veya çocuklarla yapılmış kullanıcı araştırması değildir. Bilişsel/duygusal, gelişimsel/pedagojik, eğitmen/ölçme, mimari ve görsel etkileşim bakışlarını birlikte kullandım. Onaylı oda, mint maskot, mor/krem marka ve native metin yaklaşımı korunur. Ana mesele artık yeni resim üretmek değil; hangi eylemin hangi sonucu doğurduğunu tutarlı ve anlaşılır kılmaktır.

### Cited Findings
- Kaynak baseline: `a123b7f`; kapsamda 28 canonical ekran, 9 alias/yönlendirme ve 1 device layout kaydı. Bunlar ayrı tasarım sayısı gibi toplanmamalı.
- Yerel sentetik hesapla Expo-web 390×844 ve1280×800 gerçek içerikleri açıldı. Açık notebook ve inceleme ayrıca768×1024 portrede kontrol edildi. 8087 eski önizleme yanlışlığı fark edilince kanıt silindi; rapor yalnız8088 currentexporta dayanır.
- Ekran başına somut değişiklik, öncelik ve kabul ölçütü aşağıdadır. Maket/onaylı ekran piksel eşleşmesi bu raporda yeniden kanıtlanmış değildir.

### Inferences
Birçok ortak bileşen doğru yönde olmasına rağmen, aynı kavram hâlâ farklı ekranlarda farklı etkileşimlerle çözülüyor. Bu durum yeni kullanıcıya ürünün daha karmaşık görünmesine yol açabilir; bunun büyüklüğü çocuk/veli görev testiyle ölçülmelidir.

### Gaps
Fiziksel iPad Apple Pencil, iOS modal rotation, Android stylus/palm rejection, gerçek offline/reconnect ve büyük yazı ekran okuyucu davranışları bu turda test edilmedi. Web viewport resize fiziksel cihaz döndürme testi değildir. Kütüphane/ortakProva dolu katalog, AI servis çalıştırma, ücretli haklar ve planID gerektiren ekranlar için yerel seed sınırlı. Kaynak incelemesi güvenlik açığı yokluğu kanıtı değildir.

## En önce ne değişmeli?
### Takeaway
P0 güvenlik/cevap kaybı olayı bu sınırlı denetimde doğrulanmadı. Aşağıdaki P1 maddeleri öğrenme anlamını, yanlışlıkla teslimi veya kullanıcının güvenini etkiliyor; kozmetik işlerden önce ele alınmalı.

### Cited Findings

- **L03 Çocuk / gününü ve sıradaki adımı görmek** — Sabit onaylı oda korunuyor. Ana görev alanı tamamlandı dediğinde atanmış Prova yalnız alttaki sayaçta kalabiliyor. Odam eylemi görünmeyen tercihlere götürüyor. Öneri: Sıradaki adımı görev/ödev/Prova önceliğiyle açıklayan ortak öneri kuralı öner; yetişkinin verdiği sırayı koru. Oda görselini yeniden çizme. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/room/child-home.tsx:44). Kanıt: rendered Expo-web + source.

- **L04 Çocuk / görev haftası** — Tek gün görevleri okunuyor; returned durumu approved/done dışındaki her şeyle birlikte tamamlanmadı gösteriliyor. Görevler salt okunur, neden geri geldiği yok. Öneri: İade/düzeltme istenen görev için nedeni ve yeniden deneme yolunu göster; haftalık ilerleme ile takvim farkını açıkla. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/week.tsx:83). Kanıt: rendered Expo-web + source.

- **L08 Çocuk / odasını kişiselleştirme** — Canlı ekranda Karakter/Oda/Dostum seçimi sunuluyor ama açıklama seçimlerin ana ekranı değiştirmediğini söylüyor; kaydetmek karşılıksız eylem. Öneri: Bu sürümde işlevin adını Tercihlerim yap veya çalışmayan özelleştirme seçimini Odam menüsünden çıkarıp sonra yeniden sunmayı ayrı ürün kararı olarak değerlendir. Kullanıcının sabit oda kararı korunmalı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/room-preview.tsx:41). Kanıt: rendered Expo-web + source.

- **L09 Çocuk / atanmış çalışmaya başlama ve sonuç bulma** — Bekleyenler/tamamlananlar net; tamamlanan karışık sınav başlık sonucu yalnız MC doğru sayısını gösterip açık uçlu bekleyen incelemeyi liste özetinde bastırıyor. Öneri: Soru türlerine göre sonucu ve değerlendirme durumunu birlikte göster; birincil kartta kısa hedef, tahmini/süreli ayrımı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/index.tsx:79). Kanıt: rendered Expo-web + source.

- **L10 Çocuk / yanıtlama, defter, teslim ve geri bildirim** — Açık uçlu notebook ile çoktan seçmeli çözüm iki farklı kabuk. Ara ver süreli sınavda süreyi durdurmuyor. Tümü cevaplıysa Bitir doğrudan gönderiyor. İmge küçük kalabiliyor; çizim araçları keşif gerektiriyor. Öneri: Ortak çözücü başlık/gezinme; süreli çalışmada süre sürer uyarısı; son kontrol özeti; görsele bağımsız yakınlaştırma; defter araçları aşamalı açıklama. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/[examId].tsx:597). Kanıt: rendered submitted mixed results and active open answer; tools interaction appended below.

- **L14 Veli / dört adımlı birleşik çalışma hazırlama** — Ders/konu önerileri var olan question_bank içeriğinden gelir; boş kütüphanede rehberlik kaybolur. Child query yalnız grade/avatar; okul/program/dönem kapsamı başlangıçta yok. Kaynak ekle ve manuel/shared yönleri ayrı panellere dağılıyor. Öneri: Sınıf+dönem+program/kazanım bağlamını yönetilen katalogdan getir; okul adıyla yetenek çıkarsama. Yeni kullanıcıya öneri, deneyimliye hızlı şablon; tek taslak içinde soru/ortak içerik blokları. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/prova-builder.tsx:132). Kanıt: rendered Expo-web + source.

- **L15 Veli / tek soru oluşturma** — Ders, sınıf, konu, senaryo, tür, zorluk, soru, görsel, dört seçenek, çözüm ve paylaşım tek uzun formda; ders/sınıf/konu elle; varsayılan doğru şık A. İlk kaydetme öncesi öğrenci/cevap önizlemesi yok. Öneri: Builder kapsamını miras al; soru/görsel→yanıt/ölçüt→öğrenci önizlemesi şeklinde; doğru şık boş başlasın ve bilinçli seçilsin; paylaşım kaydetme sonrası. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/question.tsx:65). Kanıt: rendered Expo-web + source.

- **L20 Veli / başlangıç çalışması atama** — Başlık Seviye tespiti; soru bankasından örneklem, standartlaştırılmış ölçüm değil. Varsayılan sınıf5, konu başına/en fazla sayıları input; Oluştur ve ata tek adım. Öneri: Başlangıç çalışması dilini ve sınırlılıkları kullan; çocuk sınıfını otomatik; sayı seçiciler; önizleme ve sonra atama. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/level.tsx:41). Kanıt: rendered Expo-web + source.

- **L24 Veli / sonuç özeti ve incelemeye başlama** — Canlı fixture Puan95/100 gösterirken açık uçlu1/2puanlandı diyor: üst puan nihai gibi. AIpuanla/çözümleriincele/tekrar/plan ayrı buton yolları. Öneri: Önce inceleme durumu; eksik varken Ara sonuç etiketi; tek İncelemeyi tamamla eylemi; sonrası özet ve bir önerilen çalışma; AI asistanı inceleme içinde. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx:144). Kanıt: rendered Expo-web + source.

- **L25 Veli / yanıtı görüp değerlendirme** — Şıklı soru kaynakta ve canlıda doğru/çocuk seçimi ile ayrı sunuluyor, boş defter zorunlu değil: iyi. Açık uçlu telefonda ortak metin Soruyu göster arkasında; notlu metin cevapta büyük boşluk ve küçük tuval; 0–100 çıplak sayı ölçüt sunmuyor. Öneri: Soru+ortak kaynak bağlamı ilk bakışta; cevap türüne uyarlanan düzen; ölçüt/rubrik destekli skor+tek somut geri bildirim; isteğe bağlı çizimli not. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/parent-review-workspace.tsx:399). Kanıt: rendered multiple-choice and open-answer; question-picker interaction; phone/tablet/portrait.

### Inferences
Tek birleşik hazırlayıcı, tek çözücü kabuğu ve cevap türüne uyarlanan tek inceleme deneyimi ürünün zihinsel modelini sadeleştirir. Mevcut özellikleri kaldırmak yerine arka planda korunup ilgili adımda gösterilmeleri öneriliyor. Oda özelleştirmesinin etkisiz seçeneklerini gizlemek veya yeniden adlandırmak ayrı ürün kararıdır; henüz uygulanmadı.

### Gaps
Yeni bilgi mimarisi ve sayısal kullanım hedefleri henüz A/B test veya görev tamamlama ölçümüyle doğrulanmadı.

## Neleri korumalıyız?
### Takeaway
Her şeyi baştan yapmak gerekmiyor; özellikle veri güvenliği ve geri bildirimde değerli kontroller var.
### Cited Findings
- Cevaplar yerel journal, sıra ve revision ile gönderiliyor; MC seçimi yerelde anlık, açık uçlu400ms kuyruğa giriyor. [Cevap akışı](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/[examId].tsx:200).
- Şıklı inceleme doğru ve seçilen cevabı ayırıyor; boş defter zorunlu gösterilmiyor. [İnceleme](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/parent-review-workspace.tsx:342).
- AI tek cevap önerisi çocuğun özgün çözümünü kullanıyor; veli notu ayrı; öneriyi alma ve kaydetme ayrılıyor. [AI önerisi](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/parent-review-workspace.tsx:448).
- Gelişim ekranı az gözlem ve farklı soruların doğrudan karşılaştırılamayacağını açıklıyor. [Gelişim](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/learning-progress-view.tsx:314).
- Ortak Prova sıralaması açık rızaya bağlı; eşit doğru sayısı aynı sıra, hız avantajı yok. [Türkçe açıklama](/Users/enes/.codex/worktrees/gina-library-access/gina/packages/core/src/i18n/tr.json:1606).
- Notebook araç modalı tüm yönleri destekliyor; çizim aracında iç scroll kilitli; bu kod fiziksel iPad sorununun tamamen bittiğini kanıtlamaz. [Modal](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/notebook-layout.ts:33), [Scroll](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/notebook-editor.tsx:802).
### Inferences
İyileştirme sırasında bu korumaları görsel sadeleştirme uğruna kaldırmak regresyon yaratır.
### Gaps
Her korumanın eşzamanlı iki cihaz, ağ kesintisi ve gerçek mobil arkaplan senaryosunda ayrıca kabul testi gerekiyor.

## Ekran ekran ne değişecek?
### Takeaway
Aşağıdaki maddeler uygulama taahhüdü değil; kaynak ve görülen UI üzerinden önerilen değişiklik kapsamıdır. JSON envanteri test kapsamını ayrıca taşır.
### Cited Findings

#### L01 · /child · P2
**Kullanıcı / iş:** Çocuk / izinli cihaz profili seçimi
**Mevcut sorun:** Profil seçimi anlaşılır; hiç profil yok durumunda yalnız bekleme metni, çocuğun yapabileceği sonraki adım yok.
**Değişiklik:** Yetişkine gösterilecek bağlantı/cihaz adı ve son eşleşme durumunu ekle; tek izinli profilde gereksiz ikinci karar sunma.
**Beş bakış:** duygusal: bekleme belirsizliği; pedagojik: okumaya yeni başlayanlar için avatar+sesli açıklama; eğitmen: hesap ile çocuk ayrımı; mimari: değişen izin listesi canlı güncelleme korunur; tasarım: tek adım
**Kabul:** Boş izin listesinde çocuk yeniden deneme ile yetişkinden yardım istemeyi ayırt eder.
**Kanıt:** [app/child/index.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/index.tsx:19) — source-only / no representative populated render.

#### L02 · /child/pin · P2
**Kullanıcı / iş:** Çocuk / güvenli giriş
**Mevcut sorun:** Cihaz PIN ekranı PinEntry kullanırken veli telefonunda standart Field kullanılıyor. PIN unutma yardımı metinsel.
**Değişiklik:** Tek çocuk PIN bileşeni; ad/avatar ve dört nokta; yanlış denemede sakin açıklama, yetişkinden yardım, iptal.
**Beş bakış:** duygusal: hata utandırmaz; pedagojik: rakam okuma; eğitmen: bağımsız giriş; mimari: server PIN sınırları korunur; tasarım: tutarlı kontrol
**Kabul:** İki giriş yolu aynı tuş ve yardım modelini kullanır; engelleme süresi anlaşılırdır.
**Kanıt:** [app/child/pin.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/pin.tsx:44) — source-only / no representative populated render.

#### L03 · /child/today · P1
**Kullanıcı / iş:** Çocuk / gününü ve sıradaki adımı görmek
**Mevcut sorun:** Sabit onaylı oda korunuyor. Ana görev alanı tamamlandı dediğinde atanmış Prova yalnız alttaki sayaçta kalabiliyor. Odam eylemi görünmeyen tercihlere götürüyor.
**Değişiklik:** Sıradaki adımı görev/ödev/Prova önceliğiyle açıklayan ortak öneri kuralı öner; yetişkinin verdiği sırayı koru. Oda görselini yeniden çizme.
**Beş bakış:** duygusal: başarı ile bekleyen iş çelişkisi; pedagojik: tek sonraki adım; eğitmen: ödev/prova ayrımı; mimari: ortak durum özeti; tasarım: oda korunur
**Kabul:** Görevler tamam ama Prova bekliyorsa tüm gün bitti izlenimi verilmez; aynı çocuk telefon/tablette aynı durumu görür.
**Kanıt:** [app/child/today.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/room/child-home.tsx:44) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-today-1280.png).

#### L04 · /child/week · P1
**Kullanıcı / iş:** Çocuk / görev haftası
**Mevcut sorun:** Tek gün görevleri okunuyor; returned durumu approved/done dışındaki her şeyle birlikte tamamlanmadı gösteriliyor. Görevler salt okunur, neden geri geldiği yok.
**Değişiklik:** İade/düzeltme istenen görev için nedeni ve yeniden deneme yolunu göster; haftalık ilerleme ile takvim farkını açıkla.
**Beş bakış:** duygusal: emeği yok saymama; pedagojik: düzeltilebilir geri bildirim; eğitmen: durum anlamı; mimari: tek durum eşleme; tasarım: rozet+metin
**Kabul:** Geri gönderilmiş görev Onay bekliyor/Tamamlanmadı ile karışmaz; uygun günün görevine ulaşılır.
**Kanıt:** [app/child/week.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/week.tsx:83) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-week-1280.png).

#### L05 · /child/calendar · P2
**Kullanıcı / iş:** Çocuk / ders ödev kurs ve çanta
**Mevcut sorun:** Aynı takvim bileşeni çocukMode ile çalışıyor. Canlı boş gün görünümünde çok sayıda haftalık boş satır ve ayrı ödev paneli oluşuyor; çocuk adına tekrar filtre gösteriliyor.
**Değişiklik:** Çocuk için bugün/yarın yapılacaklar önce; günlerde ders ve ödev yoğunluğu; kişisel cihazda çocuk filtresi kaldırılmış ortak adaptasyon. Saatli ders ve tarihli ödev farklı ikon/başlık.
**Beş bakış:** duygusal: yapılabilir yük; pedagojik: zaman kavramı; eğitmen: ders/ödev farkı; mimari: tek takvim modelini koru; tasarım: yaşa göre öncelik
**Kabul:** Çocuk yarın hangi kitap ve ödevi hazırlayacağını tek görünümden anlar; tablo/sürükleme ayrıntısı ebeveyn takvim raporuyla ortak.
**Kanıt:** [app/child/calendar.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/calendar.tsx:1) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-calendar-1280.png).

#### L06 · /child/collection · P2
**Kullanıcı / iş:** Çocuk / başarı hatıraları
**Mevcut sorun:** Kazanılan/kilitli etiketleri var; kazanma koşulu, kişisel ilerleme, sıradaki küçük adım kartta yok. Canlı fixture boş rozet durumunu gösterdi; dolu raf kaynakla incelendi.
**Değişiklik:** Rozette neyi kutladığı, nasıl kazanıldığı ve kişisel ilerleme; tüm kilitleri gösterip eksiklik hissi yaratma.
**Beş bakış:** duygusal: olumlu öz yeterlik; pedagojik: süreç odaklı; eğitmen: anlamlı davranış; mimari: koşul server kaynaklı; tasarım: küçük hedef rafı
**Kabul:** Rozeti açan çocuk neyi başardığını veya hangi davranışı sürdüreceğini söyleyebilir; sosyal karşılaştırma eklenmez.
**Kanıt:** [app/child/collection.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/collection.tsx:42) — rendered empty/locked state only; populated source-only.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-collection-1280.png).

#### L07 · /child/goal · P2
**Kullanıcı / iş:** Çocuk / ödül hedefi seçimi
**Mevcut sorun:** Ödül bedeli var ama mevcut yıldız ve yeni hedefe kalan fark seçim ekranında yok; seçme sonrası onay düğmesi listenin sonunda.
**Değişiklik:** Mevcut/hedef yıldız farkı, hedef değişince birikimin kalacağı ve harcama olmadığı açık; sabit seçim özeti+tek onay.
**Beş bakış:** duygusal: gerçekçi hedef; pedagojik: miktar karşılaştırma; eğitmen: çaba ve ödül dengesi; mimari: tekrar seçme idempotent; tasarım: karar özeti
**Kabul:** Uzun listede seçilen hedef ve onay görünür; yıldız şimdi harcanmaz bilgisi korunur.
**Kanıt:** [app/child/goal.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/goal.tsx:49) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-goal-1280.png).

#### L08 · /child/room-preview · P1
**Kullanıcı / iş:** Çocuk / odasını kişiselleştirme
**Mevcut sorun:** Canlı ekranda Karakter/Oda/Dostum seçimi sunuluyor ama açıklama seçimlerin ana ekranı değiştirmediğini söylüyor; kaydetmek karşılıksız eylem.
**Değişiklik:** Bu sürümde işlevin adını Tercihlerim yap veya çalışmayan özelleştirme seçimini Odam menüsünden çıkarıp sonra yeniden sunmayı ayrı ürün kararı olarak değerlendir. Kullanıcının sabit oda kararı korunmalı.
**Beş bakış:** duygusal: güven ve kontrol; pedagojik: eylem/sonuç; eğitmen: dikkat dağılmaması; mimari: saklanan tercih ve görünen sahne ayrımı; tasarım: dürüst affordance
**Kabul:** Kaydedilen seçimin etkisi önceden ve sonradan görülebilir; etkisiz düğmeler çocuk için özelleştirme gibi sunulmaz.
**Kanıt:** [app/child/room-preview.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/room-preview.tsx:41) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-room-preview-1280.png).

#### L09 · /child/prova · P1
**Kullanıcı / iş:** Çocuk / atanmış çalışmaya başlama ve sonuç bulma
**Mevcut sorun:** Bekleyenler/tamamlananlar net; tamamlanan karışık sınav başlık sonucu yalnız MC doğru sayısını gösterip açık uçlu bekleyen incelemeyi liste özetinde bastırıyor.
**Değişiklik:** Soru türlerine göre sonucu ve değerlendirme durumunu birlikte göster; birincil kartta kısa hedef, tahmini/süreli ayrımı.
**Beş bakış:** duygusal: erken yargı yok; pedagojik: süreç farkı; eğitmen: puanlanmamış ayrımı; mimari: son attempt sırası açık; tasarım: durum hiyerarşisi
**Kabul:** 1 şıklı doğru/2 açık uçlu bekleyen sınav tamamı doğru gibi okunmaz; yeniden başlama ve devam etme net.
**Kanıt:** [app/child/prova/index.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/index.tsx:79) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-prova-1280.png).

#### L10 · /child/prova/[examId] · P1
**Kullanıcı / iş:** Çocuk / yanıtlama, defter, teslim ve geri bildirim
**Mevcut sorun:** Açık uçlu notebook ile çoktan seçmeli çözüm iki farklı kabuk. Ara ver süreli sınavda süreyi durdurmuyor. Tümü cevaplıysa Bitir doğrudan gönderiyor. İmge küçük kalabiliyor; çizim araçları keşif gerektiriyor.
**Değişiklik:** Ortak çözücü başlık/gezinme; süreli çalışmada süre sürer uyarısı; son kontrol özeti; görsele bağımsız yakınlaştırma; defter araçları aşamalı açıklama.
**Beş bakış:** duygusal: süre kaygısı ve kontrol; pedagojik: soru görünürlüğü; eğitmen: teslim öncesi kontrol; mimari: journal/revision/serialwrites korunur; tasarım: tek çözüm kabuğu
**Kabul:** Telefon/tablet/portrede aynı soru/context/cevap korunur; çizimde scroll yok; modal açıp kapama boyutu değiştirmez; tümü cevaplı teslim de son kontrol sunar.
**Kanıt:** [app/child/prova/[examId].tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/child/prova/[examId].tsx:597) — rendered submitted mixed results and active open answer; tools interaction appended below.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-exam-1280.png).

#### L11 · /parent/child-mode · P2
**Kullanıcı / iş:** Veli+çocuk / aynı telefonda çocuk oturumu
**Mevcut sorun:** Tek çocuk otomatik seçimi var. İki profil seçimi sonrası standart PIN input; sürekli uzun ebeveyn PIN açıklaması yeni/deneyimli ayrımı yapmıyor.
**Değişiklik:** İlk kullanım kısa açıklama; sonraki kullanım avatar+PIN; cihaz eşleme ile aynı cihazda çocuk modu ayrımını tek cümleyle koru.
**Beş bakış:** duygusal: giriş sürtünmesi; pedagojik: aynı kontrol; eğitmen: güvenli devir; mimari: ayrı route guard testi; tasarım: progresif bilgi
**Kabul:** Çocuk modunun cihaz eşleştirmesi gerektirmediği anlaşılır; PIN kurtarma yetişkin alanında.
**Kanıt:** [app/parent/child-mode/index.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/index.tsx:75) — source-only / no representative populated render.

#### L12 · /parent/child-mode/today · P2
**Kullanıcı / iş:** Çocuk / veli cihazında oda; veli / güvenli dönüş
**Mevcut sorun:** Oda aynı bileşeni kullanıyor; veliye dönüş normal PIN, unutma halinde parola/sosyal e-posta doğrulaması ayrı akış.
**Değişiklik:** Önce çocuk dünyası; çıkış kartında Bu adım yetişkin içindir ve kurtarma yolu; telefon ekranında yardım üst üste buton yığınına dönüşmesin.
**Beş bakış:** duygusal: güvenli ayrım; pedagojik: yetişkin eylemi işareti; eğitmen: devir; mimari: UIlock/RLS ayrı; tasarım: tutarlı erişim
**Kabul:** Yanlış PIN, ağ kesilmesi, sosyal/e-posta hesapları dönüşü ayrı test; çıkış öncesi çocuk kilidi korunur.
**Kanıt:** [app/parent/child-mode/today.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/today.tsx:58) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-child-today-1280.png).

#### L13 · /parent/prova · P2
**Kullanıcı / iş:** Veli / hazırlama, atanmışlar, sonuçlar
**Mevcut sorun:** Birleşik Prova hub önemli ilerleme. Aynı inceleme bekleyen sınav hem üst inceleme kuyruğunda hem gönderilenlerde tekrar. Diğer araçlar altında başka hazırlama yolları sürüyor.
**Değişiklik:** Ana akış Hazırla→Gönderilenler→İncele→Sonraki adım; araçları ilgili adım içinde bağlamsal aç. Tek sınav tek kart, durumla gruplama.
**Beş bakış:** duygusal: karar yükü; pedagojik: rehberli hazırlık; eğitmen: iş kuyruğu; mimari: canonical builder; tasarım: tek baskın CTA
**Kabul:** İlk kez gelen veli bir Prova oluşturmak için hangi girişe basacağını bilir; aynı iş aynı ekranda iki kart olmaz.
**Kanıt:** [app/parent/prova/index.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/index.tsx:112) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-1280.png).

#### L14 · /parent/prova/builder · P1
**Kullanıcı / iş:** Veli / dört adımlı birleşik çalışma hazırlama
**Mevcut sorun:** Ders/konu önerileri var olan question_bank içeriğinden gelir; boş kütüphanede rehberlik kaybolur. Child query yalnız grade/avatar; okul/program/dönem kapsamı başlangıçta yok. Kaynak ekle ve manuel/shared yönleri ayrı panellere dağılıyor.
**Değişiklik:** Sınıf+dönem+program/kazanım bağlamını yönetilen katalogdan getir; okul adıyla yetenek çıkarsama. Yeni kullanıcıya öneri, deneyimliye hızlı şablon; tek taslak içinde soru/ortak içerik blokları.
**Beş bakış:** duygusal: başlangıç güveni; pedagojik: gelişim düzeyi; eğitmen: kapsam/kazanım; mimari: katalog ve bankayı ayır; tasarım: dört adım sade kalır
**Kabul:** Kütüphane boşken de uygun ders seçilebilir; çocuk değişiminde kapsam uyuşmazlığı kesin gösterilir; süre ve sayı rahat seçilir; taslak dönüşte korunur.
**Kanıt:** [components/learning/prova-builder.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/prova-builder.tsx:132) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-builder-1280.png).

#### L15 · /parent/prova/question · P1
**Kullanıcı / iş:** Veli / tek soru oluşturma
**Mevcut sorun:** Ders, sınıf, konu, senaryo, tür, zorluk, soru, görsel, dört seçenek, çözüm ve paylaşım tek uzun formda; ders/sınıf/konu elle; varsayılan doğru şık A. İlk kaydetme öncesi öğrenci/cevap önizlemesi yok.
**Değişiklik:** Builder kapsamını miras al; soru/görsel→yanıt/ölçüt→öğrenci önizlemesi şeklinde; doğru şık boş başlasın ve bilinçli seçilsin; paylaşım kaydetme sonrası.
**Beş bakış:** duygusal: hata endişesi azaltma; pedagojik: dil yükü; eğitmen: yanlış anahtar önleme; mimari: ortak taslak/veri doğrulama; tasarım: aşamalı form
**Kabul:** Yanıt işaretlenmeden soru yayımlanamaz; açık uçlu beklenen cevap ve ölçüt net; uygulamadan çıkınca taslak kurtarılabilir.
**Kanıt:** [app/parent/prova/question.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/question.tsx:65) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-question-1280.png).

#### L16 · /parent/prova/shared-source · P2
**Kullanıcı / iş:** Veli / ortak metin-görsele bağlı sorular
**Mevcut sorun:** Üç adım var ve builder’a eklenebiliyor; bağımsız rota ikinci bir ürün hissi veriyor. Ortak içerik terimleri senaryo ile karışabilir.
**Değişiklik:** Builder içinde Ortak içerik bloğu alt akışı; kaynak başlığı+hangi soruların bağlı olduğu sabit; sürüm/yeniden kullanım inceleme sırasında özet.
**Beş bakış:** duygusal: yönünü kaybetmeme; pedagojik: okuma yükü; eğitmen: ortakstimulus bütünlüğü; mimari: immutable sürüm; tasarım: inline blok
**Kabul:** Tek prova içerisinde bağımsız soru ile 2–12 ortak kaynak sorusu birlikte düzenlenir; grupta sıra ve kaynak ilişkisi korunur.
**Kanıt:** [app/parent/prova/shared-source.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/shared-question-wizard.tsx:648) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-shared-source-1280.png).

#### L17 · /parent/prova/library · P2
**Kullanıcı / iş:** Veli / incelenmiş içeriği edinme
**Mevcut sorun:** Kütüphaneye doğrudan gelince önce Prova hazırla yönü, boş koleksiyon ve katkı bilgileri aynı ekranda. Satın alınan/eklenen içerik ile hazır paket ayrımı zihinsel yük.
**Değişiklik:** Çocuğa uygun içerik, ailemdeki içerik ve katkılarım ayrı sekme/filtre; hak ne zaman harcanır seçim öncesi özet; boş state filtre/erişim/yayın eksikliğini ayrı anlatsın.
**Beş bakış:** duygusal: kota güveni; pedagojik: uygun içerik; eğitmen: kalite etiketi; mimari: acquisition journal korunur; tasarım: keşfet/kullan ayrımı
**Kabul:** Veli edinme ile taslağa ekleme farkını ve kalan hakkı bilir; aynı içerik tekrar hak tüketmez.
**Kanıt:** [app/parent/prova/library.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/library.tsx:145) — rendered empty/locked state only; populated source-only.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-library-1280.png).

#### L18 · /parent/prova/catalog · P2
**Kullanıcı / iş:** Veli / resmî okul senaryosuna uygun dağılım seçme
**Mevcut sorun:** Kaynak/doğrulama uyarısı iyi; öğretim yılı serbest alan ve çok seçeneğin ilk adımda yığılması; senaryonun okulca seçildiğini veli ayrıca doğruluyor.
**Değişiklik:** Okul duyurusu/öğretmen seçimi bilgisi varsa ön doldur; yıl kontrollü seçim; sınıf+dönem+yazılı özet; resmîlik iddiası kaynak ve sürümle sınırlı.
**Beş bakış:** duygusal: kesinlik yanılsaması önleme; pedagojik: program uyumu; eğitmen: kaynak geçerliliği; mimari: sürüm/hash; tasarım: kademeli seçim
**Kabul:** Okulunun kullandığı senaryo bulunamazsa soru üretildi sanmaz; manuel dağılıma geçince bağlamı korunur.
**Kanıt:** [app/parent/prova/catalog.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/catalog.tsx:304) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-catalog-1280.png).

#### L19 · /parent/prova/blueprint · P2
**Kullanıcı / iş:** Veli / dağılım şablonu hazırlama
**Mevcut sorun:** Senaryo ekle adı öğrenci hikâye senaryosu ile karışabilir; ilk açıklama bunu çözüyor fakat uzun. Konu adları serbest giriş, soru üretmediği ayrı açıklama.
**Değişiklik:** Adı Soru dağılımı; konuları katalog/kazanımdan seç; kaynak isteğe bağlı panel; kaç soru hangi kazanım görsel dağılım.
**Beş bakış:** duygusal: belirsizlik; pedagojik: hedef görünürlüğü; eğitmen: kapsam dengesi; mimari: versioned blueprint; tasarım: dağılım tablosu
**Kabul:** Kaydet sonrası şablonun hangi Prova’da kullanılacağı tek eylemle belli; soru oluşturulduğu sanılmaz.
**Kanıt:** [app/parent/prova/blueprint.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/blueprint.tsx:287) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-blueprint-1280.png).

#### L20 · /parent/prova/level · P1
**Kullanıcı / iş:** Veli / başlangıç çalışması atama
**Mevcut sorun:** Başlık Seviye tespiti; soru bankasından örneklem, standartlaştırılmış ölçüm değil. Varsayılan sınıf5, konu başına/en fazla sayıları input; Oluştur ve ata tek adım.
**Değişiklik:** Başlangıç çalışması dilini ve sınırlılıkları kullan; çocuk sınıfını otomatik; sayı seçiciler; önizleme ve sonra atama.
**Beş bakış:** duygusal: etiketleme yok; pedagojik: örneklem sınırı; eğitmen: geçerlik; mimari: scope validation; tasarım: tekdenemenin anlamı
**Kabul:** Veli sonucu tanı/seviye belgesi sanmaz; yanlış sınıfa atama önlenir; tek tık üretim-atama ayrılır.
**Kanıt:** [app/parent/prova/level.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/level.tsx:41) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-level-1280.png).

#### L21 · /parent/prova/booklet · P2
**Kullanıcı / iş:** Veli / yazdırılabilir çalışma
**Mevcut sorun:** Kitapçıktaki soru altkümesini seçmek zor; kaynak library/exam, alan/konu filtreleri var ama soru düzeyinde önizleme yok. Çözüm yolları varsayılan açık.
**Değişiklik:** Öğrenci nüshası ve veli cevap anahtarı ayrı çıktı seçimi; taslaktan kitapçık üretme; sayfa önizlemesi ve seçilen sorular.
**Beş bakış:** duygusal: yanlış paylaşımı önleme; pedagojik: okunur kâğıt; eğitmen: doğru sınav nüshası; mimari: aynı snapshot; tasarım: print preview
**Kabul:** Çocuğa gönderilen PDF yanlışlıkla cevapları içermez; ortak kaynak ayrı sayfada kaybolmaz; kaynak sorular eksikse çıktı engellenir.
**Kanıt:** [app/parent/prova/booklet.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/booklet.tsx:57) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-booklet-1280.png).

#### L22 · /parent/prova/groups · P2
**Kullanıcı / iş:** Veli / ortak Prova kaydı, rıza, sonuç
**Mevcut sorun:** Açık sıralama onayı ve eşit puanda eşit sıra olumlu. Tek ekran kayıt/kota/katalog/rıza/sıralama/raporla çok yüklü olabilir; dolu etkinlik canlı seed yok.
**Değişiklik:** Önce çalışmanın amacı ve kişisel gelişim; sıralama ikincil/isteğe bağlı; takvim, sınıf/program, katılım sonucu ayrı aşamalar; çocuğa rekabet baskısı taşınmamalı.
**Beş bakış:** duygusal: karşılaştırma baskısı; pedagojik: kişisel gelişim; eğitmen: eşdeğer koşul; mimari: consent/audit; tasarım: aşamalı kayıt
**Kabul:** Sıralama kapalıyken katılım mümkün; hız puanı olmaz; değerlendirme bekleyen sonuç geçici etiketli; yetki testleri ayrıca.
**Kanıt:** [app/parent/prova/groups.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/groups.tsx:375) — rendered empty/locked state only; populated source-only.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-groups-1280.png).

#### L23 · /parent/prova/progress · P2
**Kullanıcı / iş:** Veli / öğrenme kanıtı ve sonraki adım
**Mevcut sorun:** Farklı soru karşılaştırılmaz ve az gözlem uyarıları iyi. Grafik adet gösteriyor; yüzdelik başarı eğrisi sanılmaması için anlamı ilk bakışta açık olmalı. Konu listesi veri büyüyünce uzar.
**Değişiklik:** Grafik başlığında çözülen soru sayısı ve değerlendirme kapsamı; az veri durumunda küçük sonraki adım; konu bazlı filtre/kanıta erişim.
**Beş bakış:** duygusal: gelişim etiketlenmez; pedagojik: deneyimden gözlem; eğitmen: kanıt sınırı; mimari: cohort/scope isolation; tasarım: anlamlı grafik
**Kabul:** Aynı sorunun tekrarları ayrı sayılır; bekleyen yanlış sayılmaz; her çıkarım kanıt sorusuna açılır.
**Kanıt:** [app/parent/prova/progress.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/learning-progress-view.tsx:314) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-progress-1280.png).

#### L24 · /parent/prova/attempt/[attemptId] · P1
**Kullanıcı / iş:** Veli / sonuç özeti ve incelemeye başlama
**Mevcut sorun:** Canlı fixture Puan95/100 gösterirken açık uçlu1/2puanlandı diyor: üst puan nihai gibi. AIpuanla/çözümleriincele/tekrar/plan ayrı buton yolları.
**Değişiklik:** Önce inceleme durumu; eksik varken Ara sonuç etiketi; tek İncelemeyi tamamla eylemi; sonrası özet ve bir önerilen çalışma; AI asistanı inceleme içinde.
**Beş bakış:** duygusal: erken yargı yok; pedagojik: geri bildirim süreci; eğitmen: puan geçerliliği; mimari: status/score ayrı; tasarım: karar kuyruğu
**Kabul:** Eksik değerlendirme varsa nihai başarı ilan edilmez; AI önerisinin veli onayı ve kaynak kapsamı açık.
**Kanıt:** [app/parent/prova/attempt/[attemptId].tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx:144) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-attempt-item-1280.png).

#### L25 · /parent/prova/review/[attemptId] · P1
**Kullanıcı / iş:** Veli / yanıtı görüp değerlendirme
**Mevcut sorun:** Şıklı soru kaynakta ve canlıda doğru/çocuk seçimi ile ayrı sunuluyor, boş defter zorunlu değil: iyi. Açık uçlu telefonda ortak metin Soruyu göster arkasında; notlu metin cevapta büyük boşluk ve küçük tuval; 0–100 çıplak sayı ölçüt sunmuyor.
**Değişiklik:** Soru+ortak kaynak bağlamı ilk bakışta; cevap türüne uyarlanan düzen; ölçüt/rubrik destekli skor+tek somut geri bildirim; isteğe bağlı çizimli not.
**Beş bakış:** duygusal: yapıcı geri bildirim; pedagojik: düzeltme fırsatı; eğitmen: rubrik tutarlılığı; mimari: ayrı notlayer/revision; tasarım: yanıt türüneuyarlama
**Kabul:** Veli hangi soru/cevap/anahtar üzerinde olduğunu aynı anda görür; çocuğun cevabı değişmez; AI uygulamak kaydetmek değildir.
**Kanıt:** [app/parent/prova/review/[attemptId].tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/parent-review-workspace.tsx:399) — rendered multiple-choice and open-answer; question-picker interaction; phone/tablet/portrait.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-review-item-1280.png).

#### L26 · /parent/prova/repeat/[attemptId] · P2
**Kullanıcı / iş:** Veli / kanıta dayalı tekrar takvimi
**Mevcut sorun:** Yanlış/kısmi sorular seçimi ve gün planı aynı uzun akış; eski soru yeniProva ile çözülmüşse önerilmiyor olması iyi.
**Değişiklik:** Seçili sorular→gün/süre→sonkontrol mini akış; öğrenciye anlaşılır kısa çalışma başlığı; ortak içeriği bölmeden seç.
**Beş bakış:** duygusal: toparlanabilir hata; pedagojik: aralıklı çalışma; eğitmen: kanıtlı ihtiyaç; mimari: repeat journal; tasarım: mini wizard
**Kabul:** Aynı tekrar iki kez kaydedilmez; çocuğun takvim yükü görülür; çalışma kaynak sınavla ilişkili kalır.
**Kanıt:** [app/parent/prova/repeat/[attemptId].tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/repeat/[attemptId].tsx:36) — rendered Expo-web + source.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-repeat-item-1280.png).

#### L27 · /parent/prova/plan/[planId] · P2
**Kullanıcı / iş:** Veli / AI çalışma planını düzenleyip uygulama
**Mevcut sorun:** Yedi günlük AI plan ile tekrar takvimi iki alternatif; görev fikirleri ve arşiv eylemi uzakta. Canlı planID yok, kaynak denetimi.
**Değişiklik:** Aynı Planla yüzeyinde mevcut takvimle çatışma, süre ve günlük yük; AIplan öneri olarak başlar, veli seçerek uygular; arşiv ikincil.
**Beş bakış:** duygusal: aşırıyük yok; pedagojik: kısa uygulanabilir adım; eğitmen: içerikle ilişki; mimari: plan/tasks ayrımı; tasarım: takvimüstündedüzenleme
**Kabul:** Gün seçmeden plan takvime yazılmaz; eski plan arşivlenirken atanmış işler silinmez; manuel düzenleme kolay.
**Kanıt:** [app/parent/prova/plan/[planId].tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/plan/[planId].tsx:97) — source-only / no representative populated render.

#### L28 · /parent/prova/share · P2
**Kullanıcı / iş:** Veli / kendi içeriğini incelemeye gönderme
**Mevcut sorun:** Hak/kisisel veri onayı ve ödül bilgisi olumlu; doğrudan rota yalnız önce soru seç placeholderı. Kaydederek paylaş ile aynı haklar ekranlarda tekrarlanabiliyor.
**Değişiklik:** Soru kaydetme ardından tek Katkı gönder adımı; ne paylaşılacak, kişisel veri, inceleme durumu ve hakkın ne zaman verileceği önizleme.
**Beş bakış:** duygusal: adil karşılık; pedagojik: içerikkalitesi; eğitmen: lisans/yanıt anahtarı; mimari: inceleme yayınayrı; tasarım: tek onay
**Kabul:** Reddetme gerekçesi ve düzeltme yolu görünür; paylaşım aileye kaydetmeyle karışmaz; rıza ayrı.
**Kanıt:** [app/parent/prova/share.tsx](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/share.tsx:224) — rendered missing-selection state only; populated share source-only.
**Görünüm:** [Telefon/tablet kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-prova-share-1280.png).

### Inferences
Yukarıdaki P1/P2 sırası maliyet tahmini değildir. Birden çok ekranı aynı anda düzeltmenin en verimli yolu birincil iş nesnelerini (Prova taslağı, soru bloğu, cevap, inceleme, çalışma planı) ortaklaştırmaktır.
### Gaps
Aliaslar aynı çizimi kullanır fakat rol/routeguard/cihaz erişimi farklıdır; yalnız aynı görünümden yetki eşdeğerliği çıkarılamaz.

## Alias, modal ve durumlar nasıl sayıldı?
### Takeaway
Yönlendirmeleri yeni ekran diye saymadım; kritik modallar ayrıca akış olarak ele alındı.
### Cited Findings
- `/parent/child-mode/calendar` → `/child/calendar` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/calendar.tsx:1).
- `/parent/child-mode/collection` → `/child/collection` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/collection.tsx:1).
- `/parent/child-mode/goal` → `/child/goal` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/goal.tsx:1).
- `/parent/child-mode/room-preview` → `/child/room-preview` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/room-preview.tsx:1).
- `/parent/child-mode/week` → `/child/week` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/week.tsx:1).
- `/parent/child-mode/prova` → `/child/prova` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/prova/index.tsx:1).
- `/parent/child-mode/prova/[examId]` → `/child/prova/[examId]` (re-export); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/child-mode/prova/[examId].tsx:1).
- `/parent/prova/exam` → `/parent/prova/builder` (redirect-preserves-groupId); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/exam.tsx:1).
- `/parent/prova/generate` → `/parent/prova/builder` (redirect); [kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/app/parent/prova/generate.tsx:1).
- Builder kaynak seçimi: kütüphane/AI/manuel/belge/tekrar; AI üretim bekleme, yeniden alma, çoklu seçim, önizleme, ayrılma ve belirsiz kayıt durumları kaynakta incelendi. Ücretli AI çağrısı yapılmadı.
- Notebook: soru/defter, genişlet, görsel/metin kopyalama, kırpma, kalem/silgi/seçim, yazı/sembol/diğeraraçlar, kaydetme/çakışma, sonlandırma ve yerelcevap kurtarma kaynakta; ayrı etkileşim sonuçları ek notta.
- Veli inceleme: şıklı/açıkuçlu, soruseç, soru önizleme, notkatmanı, değerlendirme, AI öneri rızası, taslak kurtarma/çakışma; görüntülenenler screenshotdosyalarında.
- Ortak Prova: katılma rızası, sıralama onayı, özel sonuç; populated cohort fixture olmadığından yalnız kaynak+kapanmış/boş UI.
### Inferences
Boş ekranların güzelliği tek başına dolu, uzun, hatalı veya eşzamanlı düzenlenen ekranın doğru çalışacağını göstermiyor.
### Gaps
Her girişten tüm modal/durum kombinasyonlarının uçtan uca geçildiği iddia edilmiyor.

## Önerileri hangi ilkelere dayandırdım?
### Takeaway
Aşağıdaki birincil kaynaklar ürün kararlarını destekler; bu uygulamanın çocuk üzerindeki etkisini doğrudan ölçmez.
### Cited Findings
- W3C COGA, çok adımlı işlerde bulunulan adım ve sıradaki işin anlaşılır olmasını; talimatların açıklayıcı örneklerle verilmesini öneriyor. Bu nedenle senaryo/kaynak/Prova kavramlarını birbirinden ayırıp adımları görünür tutmak önerildi. [Adımı anlaşılır kılma](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/), [Adım adım talimat](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/).
- W3C COGA tanıdık ve tutarlı kontrol konumu/davranışını destekliyor; çözücü ve PIN yollarını ortaklaştırma bu ilkeye dayanıyor. [Anlaşılır yapı](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/).
- EEF geri bildirimi bir sonraki öğrenme eylemine hizmet eden süreç olarak ele alıyor. Bu nedenle yalnız0–100 vermek yerine neyin doğru olduğu ve sıradaki düzeltmenin açıklanması öneriliyor. [EEF geri bildirim rehberi](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/feedback).
- UNICEF çocuk odaklı AI rehberi şeffaflık, güvenlik, adillik ve çocukların esenliğini temel alıyor. AI değerlendirmesini nihai hüküm veya çocuğun kişiliği/ruh hali gibi sunmamak, veli kontrolünü korumak bu çerçeveyle uyumlu. [UNICEF AI ve çocuklar](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children).
### Inferences
Kullanıcı testinde yaşlar/kabiliyetler arasında farklılık beklemek makul bir tasarım hipotezidir; yaş tek başına çocuğun okuma, motor veya bilişsel kapasitesini belirlemez. 1–4,5–8,9–12 gibi modlar yalnız tartışılacak ürün segmentidir, otomatik kişilik tanısı değildir.
### Gaps
Çocuk ve veli katılımcılarla onamlı görev testi, öğretmen incelemesi ve erişilebilirlik cihaz denetimi henüz yapılmadı. Bu rapor son hâl sertifikası değildir.


## Defter, çizim ve inceleme için mevcut sürümde gerçekten ne gördüm?
### Takeaway
Önceki şikâyetleri otomatik olarak bugün de var saymadım. Current exportta portre defter görünürlüğü ve şıklı inceleme anlamlı biçimde daha iyi; yine de fiziksel iPad doğrulaması yapılmadan dönüş döngüsü tamamen çözüldü denemez.
### Cited Findings
- **Portre notebook görünür:** 768×1024 web görünümünde soru yukarıda, defter aşağıda. 1280×800 yanda;390×844 Soru/Defter sekmeleri. [Portre kanıt](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-ink-portrait.png), [telefon](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-390.png). Sayfa içeriğinin tamamı viewporttan büyük; bu beklenen defter alanıdır. Sayfanın devamı aşağıda ve yukarı/aşağı kontrolleri mevcut. Bu, görünmeyen çizim bug'ı değildir.
- **Çizerken scroll:** sentetik kalem hareketiyle görünen çizgi eklendi; ölçülen tüm mevcut scrollTop değerleri öncesinde ve sonrasında0. [Çizim kanıtı](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-ink-portrait.png), [ölçüm](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/learning-notebook-interactions.json). Bu tek masaüstü mouse denemesidir; finger/Pencil/palm rejection testi değildir.
- **Yazı / Semboller / Diğer araçlar:** üçünü açıp kapattım; web viewport768×1024 kaldı. Yazı ve Semboller aynı metin+sembol editörünü açıyor. [Semboller](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-symbols-portrait.png), [diğer araçlar](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-more-portrait.png). Grade1 çocuğa24matematik sembolünü birlikte vermek yerine ilgili/son kullanılan işaretleri önce göstermek P2 öneridir; çocukla test edilmedi.
- **P1 — soru görselinin okunabilirliği:** fixture görseli notebookta çok küçük göründü; kaynakta standalone Image, notebook maxHeight190 ve doğrudan dokunup yakınlaştırma eylemi yok. [Görsel bileşeni](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/question-media.tsx:113), [portre](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-portrait.png). Soru metni görünüyor; görseldeki küçük yazı okunabilirliği ayrı problemdir. Çözüm: görsele dokun→bağımsız tam ekran yakınlaştırma/pan, kapatınca aynı cevap/yazma noktası. Kabul: tablo/şekil üzerindeki sayı/değer okuma deftere kopyalama gerektirmesin; yakınlaştırma kalem çizimine dönüşmesin.
- **P2 — seçip deftere alma:** kırpma alanı ve tüm görseli alma düğmesi gerçekten mevcut. Metin için seç/kopyala/yapıştır talimatı teknik bir ara adım bırakıyor. [Kaynak seçici](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-notebook-source-picker.png), [kod](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/mobile/src/components/learning/notebook-source-picker.tsx:71). Öneri: otomatik çıkarılabilenverilenler/tammetin parçaları bir dokunuş; serbestseçim alternatif; kırpmada sınır tutamaçları ve geri al. Bu turda kırpılmış yeni görseli kaydetmedim, geometri doğruluğu ayrıca test edilmeli.
- **Şıklı inceleme:** telefon ve tablette soru, şıklar, çocuğun seçtiği ve doğru yanıt gösterildi; çizimli not isteğe bağlı. [Telefon](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-review-mc-phone.png). Eski boşdefter şikâyeti bu current çoktan seçmeli örnekte tekrarlanmadı.
- **Açık uçlu inceleme:** ortak metin kaynaklı2.soru seçildi. Telefonda yalnız soru cümlesi özet kartı; ortak metne Soruyu göster üzerinden ulaşılıyor. Metin cevabı+mevcut çizimli not paneli ciddi boşluk bırakıyor ve defter küçük kalıyor. [Telefon](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-review-open-phone.png), [tablet](/Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/learning-review-open-tablet.png). Öneri: cevap türüne göre alan paylaşımı; ortak kaynak/yanıt bağlamını önce göster, not tuvalini gerekince genişlet.
### Inferences
Mevcut yazı/sembol/kırpma özellikleri kaldırılmamalı. Sorun araç eksikliği kadar araçların ne zaman ve nasıl göründüğüdür. Aynı sayfada okuma, çizme ve not verme görevlerinin alan paylaşımı içerik türüne göre uyarlanmalı.
### Gaps
Yukarıdaki kanıtlar Expo-web ve sentetik yerel kayıtlar içindir. Fiziksel iPad portre/yatay, modal açıp kapama20döngü, Pencil+palm, iOS klavye, cihazı kilitleyip geri dönme ve bağlantısız devam senaryoları yayın kabul listesinde kalır. Her ekranın bütün durumlarını canlı geçtim veya tüm güvenlik açılarını kapattım iddiası yoktur.
