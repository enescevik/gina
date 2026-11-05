# GINA — silme, temizleme, arşiv ve eğitim geçişleri

> **Güncel takip:** [Claude devir listesi](CLAUDE-REMAINING-WORK.md) R01/L01–L04/U04. Eğitim dönemi, profil arşivi, dönem raporları ve görev geçmişi 26 paketinde yayımlandı. Ödül/not geçmişi main’de; üretim yayını R01’de açık. Aşağıdaki eski paket notları yazıldıkları anı anlatır.

5 Kasım 2026. Bu belge kullanıcının yeni isteği üzerine yapılan kaynak kodu/veri ilişkisi incelemesini ve ürün önerisini kaydeder. “Mevcut” kodda bulunan işlemi, “eklendi” bu daldaki değişikliği, “öneri/açık” henüz uygulanmamış davranışı ifade eder. Üretim verisi değiştirilmedi.

## 5 Kasım devam paketinin durumu

Eğitim dönemi ve okul geçmişinin ilk uygulaması hazır: ilk kayıt, yeni eğitim yılı, okul değişikliği, ayrı bilgi düzeltme, sürümlü kayıt ve kapanan dönemin okunabilir program kopyası. [Uygulama ve test kanıtı](release/education-periods-2026-11-05/README.md). Profil arşivleme/geri alma da uygulandı: rutinler durur, cihaz erişimi ve bağlantılar kapatılır; geri alma bunları otomatik açmaz. [Arşiv kontrol raporu](release/child-archive-2026-11-05/README.md). Dönem rapor filtreleri ve okul puanının sürümlü düzeltme/kaldırma/geri alma akışı da uygulandı; [rapor ve kontroller](release/education-reports-2026-11-05/README.md). Rutin ayrıntısı/düzenleme, gönderim bilgisini koruma ve tek rutin arşivi/geri alma da uygulandı; [görev paketi](release/task-routines-2026-11-05/README.md). Seçerek rutin taşıma ve bütün içerik arşivi hâlâ açıktır. Üretim yayını yapılmadı.

## Ana karar önerisi

Çocuğun kimliği kalıcı; sınıfı, okulu ve öğretim yılı tarihli eğitim kayıtları olmalı. Veliye **“Yeni eğitim yılına geç”**, **“Okul değiştir”**, **“Bilgiyi düzelt”** ayrı eylemler sunulmalı. “Çocuğu sil” veya profil arşivi sınıf atlamanın yolu olmamalı.

Örnek: Ece’nin `2026–2027 / 2. sınıf` kaydı kapanır, `2027–2028 / 3. sınıf` kaydı açılır. Aynı yıl okul değiştirirse iki okul kaydı aynı öğretim yılı içinde ayrı başlangıç/bitiş tarihleriyle korunur. Bu işlemler yeni bir çocuk hesabı oluşturmaz. Sınıf tekrarı, hazırlık sınıfı, farklı ülke takvimi ve yanlış girilmiş sınıf düzeltmesi de desteklenmeli; her yıl otomatik +1 yapılmamalı.

Yıldız, rozet, maskot, oda ve kişisel başarılar profilde kalır. Ders programı, okul puanı ve Prova sonuçları ait oldukları eğitim bağlamıyla gösterilir. Eski 2. sınıf cevabı, profil bugün 3. sınıf diye yeniden 3. sınıf verisi olarak etiketlenmez. Farklı kapsamlı iki dönemin yüzdeleri doğrudan başarı artışı/azalışı diye yorumlanmaz.

## Kaynaklar ve bunlardan çıkardığımız ürün ilkeleri

- **Eğitmen/pedagoji:** NSW Eğitim Bakanlığının geçiş rehberi öğrenmenin sürekliliğini, öğrenci ihtiyaçlarına uygun devam eden veri kullanımını, öğrenci sesini ve aile katılımını vurgular. GINA’ya uyarlama önerimiz, yeni başlangıçta eski öğrenme kanıtlarını saklamak; velinin ve çocuğun uygun rutinleri seçerek taşımasıdır. Rehber belirli bir uygulama arşiv arayüzünü doğrulamış değildir. [Transition guidance for school leaders](https://education.nsw.gov.au/teaching-and-learning/curriculum/leading-curriculum-k-12/transition-from-primary-to-high-school/guidance-with-transition-for-school-leaders-and-transition-coord).
- **Psikoloji açısından:** Ryan ve Deci’nin öz-belirleme yaklaşımı özerklik, yeterlik ve ilişkililiği motivasyon açısından ele alır. Bundan türettiğimiz tasarım önerisi; kazanımları sıfırlamamak, çocuğu “geriledi/başarısız” etiketiyle karşılamamak, taşınacak rutinleri seçtirmek ve sakin bir “Yeni dönem hazır” anlatımı kullanmaktır. Bu, GINA üzerinde yapılmış bir etki araştırmasının sonucu değildir. [Ryan & Deci, 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf).
- **Yazılım/veri modeli:** Ed‑Fi, öğrenciyi okul kaydından ayırır; giriş/çıkış tarihleri ile kayıt dönemlerini temsil eder ve sınıf/öğretim yılı gibi değişikliklerde yeni ilişki kaydı kullanılmasını önerir. GINA’da tarihli eğitim kaydı önerisinin teknik dayanağı budur. Ed‑Fi uyumluluğu veya MEB/e‑Okul entegrasyonu teslim edilmiş sayılmaz. [Enrollment Domain — Best Practices](https://docs.ed-fi.org/reference/data-exchange/data-standard/5/model-reference/enrollment-domain/best-practices/).
- **Tasarım:** Üç ayrı niyet için farklı sonuç önizlemesi: “Sil” → kaldırılacak taslak; “Temizle” → etkilenen gün/çocuk/ders sayısı; “Arşivle” → görünürlük ve devam edecek işler. Kırmızı bir eylem yığını yerine ikincil “Düzenle” menüsü, açıklamalı son kontrol ve uygun yerde geri alma. Bu etkileşim seçimi ürün önerimizdir.

## Silme ve temizleme envanteri

| Alan | İncelenen mevcut durum | Uygulama/öneri |
|---|---|---|
| Prova hazırlama taslağı | Liste ve devam et vardı; kaldırma yoktu | **Eklendi:** Silinen taslaklara taşıma, geri alma, sayfalı silinenler listesi. Sürüm/rol/aile kontrolü, tekrar güvenliği. |
| Taslağın soruları ve ortak kaynakları | Taslaktan bağımsız kayıtlar; başka çalışmalarda kullanılabilir | Taslak silme bunları silmez. Kaynak/banka temizliği ayrı etki önizlemesi ister. |
| Atanmış Prova | Taslak ve atanmış sınav aynı şey değil | Taslak silme yolu atanmış Prova’ya kapalı. İptal/arşiv için katılım/cevap/inceleme durumuna göre ayrı akış açık. |
| AI üretim taslağı/işi | Kullanım makbuzu ve geri kazanılabilir üretim işi var | Silme yeni ücretli üretime başlamayı engeller; başlamış işin sonucunu/harcanmış hakkını yok etmez. Kullanıcıya açıklanır. |
| Haftalık ders programı | Tek ders kaldırma var; toplu temizleme yoktu | **Eklendi:** Seçili çocuğun bütün derslerini taslaktan kaldır, aynı ekranda geri al, ayrıca Programı kaydet. Saat ayarları ve kaynaklar korunur. |
| Ders programının dönem arşivi | Tek güncel program var | Devam paketinde dönem kapanırken okunabilir program kopyası **eklendi**. Seçerek kopyalama/geri yükleme **açık**. Tek başına Programı temizle işlemi dönem arşivi oluşturmaz. |
| Aktarılan belge/görsel | Kaynak kaldırma mevcut | Kaynağı silmek ders/ödevleri silmez; ters işlem de kaynak dosyasını silmez. Ayrı sonuç açıklaması korunmalı. |
| Ödev/çalışma | Tek kayıtta `archived` ve tamamlanma var | Tarih/kapsam seçerek toplu arşivleme, geri alma ve filtre **açık**. Tamamlanmışı başarısız sayma. |
| Çanta listesi | Tek eşya çıkarılabiliyor | “İşaretleri sıfırla” ile “Bu günün listesini temizle” ayrı olmalı; başka günlere etki etmemeli. Toplu işlem **açık**. |
| Görev rutinleri | Düzenleme, değişiklik geçmişi, duraklat/devam et, tek rutin arşivi/geri alma **eklendi** | Gönderilmiş görev adı/ikonu/yıldızı korunur. Eski özgün veri yoksa geçiş anında bilinen değer ayrıştırılır. Henüz gönderilmemiş görevler güncel plandan hesaplanır. Toplu seçim/aktarım **açık**. |
| Ödüller | Düzenleme/geçmiş/tek ödül arşivi ve talep anındaki bedeli koruma PR #146 ile main’de | Üretim yayını R01; toplu işlemler L02, kalan talep/teslim deneyimi U04. Kazanılmış ödül geçmişi yok edilmez. |
| Hedef | Hedef seçimi ödül talebinden ayrı | Hedefi bırakma/değiştirme birikmiş yıldızı silmemeli. Ayrı son kontrol ve geçmiş hedef görünümü **açık**. |
| Okul puanı | Ekleme, düzeltme, geri alınabilir kaldırma ve geçmiş **eklendi** | Önce/sonra kontrolü, eşzamanlılık ve tekrar güvenliği; dönem filtresi/sayfalama; kaldırılan puan öğretmen görünümünden çıkar. Tarihi başka döneme taşıyan düzeltme ayrı karar gerektirir. |
| Not | Görünürlük/hedef, düzenleme/geçmiş, arşiv/özel geri alma ve kişisel not yetkisi PR #147 ile main’de | Yetki düzeltmesi dahil üretim yayını R01; toplu işlemler L02 ve son kabul U09. |
| Takvim etkinliği | Silme ve kayıt makbuzu var | Tek gün/tekrarlı seri kapsamını açıkça göster; toplu tarih aralığı temizliği **açık**. |
| Çocuk profili | Ayarlar içinde kalıcı silme var; birçok bağlı kayıt zincirleme siliniyor | Silmeyi sınıf değişiminden uzaklaştır. Profil arşivi ve arşiv etkisi önizlemesi **eklendi**. Kalıcı silmenin kapsamlı önizlemesi ve ayrı güçlü onayı **açık**. |
| Bağlı cihaz | İptal etme var | Profil arşivi/kalıcı silme cihazdaki aktif oturumu ve izinli çocukları da güncellemeli. Arşiv entegrasyonu **eklendi**; geri alma erişimi kendiliğinden açmaz. |
| Paylaşım bağlantıları | Çocuk bağlantıları ilişkisel olarak tutuluyor | Profil arşivinde devam etsin mi kapatılsın mı açık olmalı; önerilen varsayılan kapatma. Arşiv entegrasyonu **eklendi**; geri alma erişimi kendiliğinden açmaz. |
| Yönetim soru bankası | Silme var; kullanımda soru korumaları var | Kullanılan soruda sürüm/arşiv; kullanılmamışta güvenli kaldırma. İçerik yaşam döngüsünü tekleştirme **açık**. |
| Yönetim yardım/kütüphane | Taslak/yayın/arşiv akışları mevcut | Taslak kaldırma ile yayımdan çekme ayrı. Eski erişim ve kullanılmış içerik etkisi görünür olmalı; bütün yolların ortaklaştırılması **açık**. |
| Paket/ödeme/AI makbuzu | Muhasebe/kota ve tekrar güvenliği için kullanılıyor | Liste temizlemek üzere kayıt silinmez. Operatör filtresi, izinli saklama politikası ve anonimleştirme ayrı iş. |

İnceleme dayanakları: `prova-draft-overview.tsx`, `prova-draft.ts`, `timetable-editor.tsx`, `timetable-import.tsx`, `learning-plan.tsx`, `school-bag.tsx`, `tasks-screen.tsx`, `rewards-screen.tsx`, `parent/menu.tsx`, `parent/grades.tsx`, `parent/notes.tsx`, `event-editor.tsx`, yönetim soru/kütüphane sayfaları ve `children` tablosuna bağlı yabancı anahtarlar. Bu tablo her ekranda yeni bir fiziksel cihaz kabul testi yapıldığı anlamına gelmez.

## Yeni eğitim yılı ve okul değişikliği — geniş hedef akış

1. **Niyet:** Yeni eğitim yılı / Okul değişikliği / Yanlış bilgiyi düzelt. Sınıf tekrarı ayrı damgalayıcı bir ekran yerine normal sınıf seçimiyle desteklenir.
2. **Yeni bilgiler:** Öğretim yılı, sınıf, başlangıç tarihi, gerekiyorsa program/okul türü. Okulun tam adı isteğe bağlı; açık adres veya öğrenci numarası gerekli değil. Ülke/müfredat seçimi yalnız içerik eşleştirmeye hizmet eder.
3. **Neler devam edecek:** Günlük alışkanlıklar, aktif hedef ve ödüller özetlenir. Yeni sınıfın programına eski saatler otomatik kopyalanmaz; veli “boş başla / seçerek taşı / belgeden getir” seçer. Bir yeni dönem oluşturmak otomatik olarak ödev atamaz.
4. **Açık işleri çöz:** Eski dönemin bekleyen Provası, onay bekleyen görevi ve teslim edilmemiş ödülü sayılarıyla görünür. Devam et / uygun olanı arşivle / ilgili incelemeye git. Çözülmüş cevapları silen toplu düğme yok.
5. **Son kontrol:** Önce/sonra dönem, tarih, taşınan rutin sayısı ve korunacak geçmiş. Sunucuda tek, sürümlü ve tekrar güvenli işlem.
6. **Çocuk görünümü:** “Yeni dönem hazır. Önceki çalışmaların yerinde.” İsteğe bağlı kısa kutlama; sıfırlanmış puan veya zorunlu sıralama yok. Geçmiş çalışmalar erişilebilir.

## Profil arşivi uygulandı; kalıcı silmenin yeni akışı açık

Profil arşivi uygulamayı artık kullanmayan veya ara veren çocuk içindir. Geri alınabilir. Çocuğa bağlı yeni görev/AI işlemi/Prova ataması ve yeni bildirim hedeflemesi durur (başlamış sağlayıcı işi veya yola çıkmış bildirim geri çağrılamaz); eski cevap, veli geri bildirimi, yıldız hareketi, rozet ve oda tercihi okunabilir kalır. Mevcut cihaz oturumları sunucuda da engellenir; yalnız listeden gizlemek yeterli değildir. Geri alma otomatik olarak kaçırılmış işleri yeniden atamaz veya tüm cihaz izinlerini yeniden açmaz.

Kalıcı silme ayrı ve açık bir işlem olmalı: çocuk adı, silinecek veri grupları, aileye ait ortak içeriklerin kapsam dışında kaldığı bilgisi ve yeniden doğrulama. Mevcut kodda birçok çocuk kaydı zincirleme silinir; fakat JSON içindeki çocuk başvuruları, aileye ait soru/kaynaklar ve kota makbuzları aynı anlama gelmez. “Her şey silinir” metni, bunların envanteri ve sunucu temizliği tamamlanmadan kullanılmamalı.

Paket için öneri: aktif çocuk kapasitesi ile arşiv depolaması ayrı tanımlansın; arşivle/geri al AI haklarını yenilemesin. Henüz kota kuralı değiştirilmedi. Arşivlenmiş profilden yeni veri üretimi veya eski hakları tekrar kazanma mümkün olmamalı.

## Veri ve uygulama sınırları

- `child_id` kalıcıdır; tarihli eğitim kaydı ayrı kimlik taşır. Başlangıç/bitiş ve tek etkin ana kayıt tutarlılığı sunucuda korunur. Kurs/etüt ayrı ilişki olabilir; okul değişimi diye yanlış modellenmez.
- Mevcut `children.grade` uyumluluk için güncel görünüm olarak sürdürülebilir. Eski kayıtlardaki sınıfı bugünkü değerden tahmin ederek geriye dönük doldurmayız; bilinmeyen dönem “Dönemi belirtilmemiş” olur.
- Soru üretimi, atama ve rapor kendi dönem/sınıf/program bağlamını sabitler. Açık taslakta çocuk sınıfı değiştiyse yayımlamadan önce yeniden kontrol edilir; atanmış sınav sessizce yeniden yazılmaz.
- Etkin eğitim dönemi değişikliği ile serbest profil düzenleme aynı yazma yoluna alınır; eski istemcinin `grade` alanını güncellemesi geçmişi atlatmamalı. Tarih düzeltmesinin etki alanı önizlenmeli.
- İşlem kimliği, beklenen sürüm, satır kilidi ve etki özeti gerekir. Başka veli eşzamanlı düzenlediyse eski ekran üzerine yazamaz. Yetki kontrolleri aile ve çocuk kapsamını sunucuda doğrular.
- Arşiv sonrası bildirim, AI rezervasyonu, cihaz yetkisi, paylaşım ve arka plan işleri aynı aktiflik kuralını kullanmalı. İptal, tamamlandı ve arşiv raporda ayrı anlamlardır.

## Bu paketin durumu

Kodlandı: geri alınabilir Prova taslak silme ve programın tamamını taslakta temizleme/geri alma. Sınıf/okul geçmişinin ilk sürümü sonraki devam paketinde uygulandı (üstteki durum notu). Profil arşivi/geri alma devam paketinde kodlandı ve yerel kontrolleri geçti. Toplu içerik arşivi ve kalıcı silmenin yeniden kurulması **öneri ve açık iş** olarak kalır. Hiçbiri üretime teslim edilmiş sayılmaz.
