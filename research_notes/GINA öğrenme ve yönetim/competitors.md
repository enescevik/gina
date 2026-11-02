# GINA için öğrenme planlama rakipleri

## Hangi DersTakip incelendi; kanıt ne kadar güçlü?

### Takeaway
“DersTakip” tek bir ürün olarak kullanılamaz: üç farklı alan adı/mağaza kimliği bulundu. 2 Kasım 2026 araştırması resmi ürün sayfaları ve mağaza açıklamalarına dayanır; oturum açılmış uygulama kullanılmadı, özelliklerin çalışması ve öğrenme etkisi deneysel olarak doğrulanmadı.

### Cited Findings
- **DersTakip / derstakip.app:** Sitesinin Google Play bağlantısı `ataberkw.derstakip` paketine gidiyor; mağazada ad **Study Tracker: Your AI Coach**, geliştirici **KORATA Software**. Ders süresi, ödev, soru, hedef ve AI planlama özellikleri geliştirici tarafından listeleniyor. — [Resmi mağaza](https://play.google.com/store/apps/details?id=ataberkw.derstakip)
- **DersTakip / ders-takip.com:** Öğretmen ve koçlara yönelik web ürünü; giriş alanı `derstakip.online`. Özel ders, ödeme, koçluk, deneme analizi, föy ve beyaz tahta sunuyor. Site ekran görsellerini “gerçek ekranlar, kurgusal öğrencilerle” diye tanımlıyor; bu ifade yayıncının beyanıdır. — [Resmi site](https://ders-takip.com/)
- **DersTakip2 / derstakip2.com.tr:** Resmi bağlantı **Ders Takip 2 - Dijital Ajanda**, **simYA tech.**, `com.romerto.dersapp2` mağaza kaydına gidiyor. Haftalık çalışma programı, konu ilerleme yüzdesi, deneme grafikleri ve zamanlayıcı listeleniyor. — [Resmi site](https://derstakip2.com.tr/), [Google Play](https://play.google.com/store/apps/details?id=com.romerto.dersapp2)
- **MyStudyLife:** Google Play geliştiricisi **My Study Life, Ltd.**, paket `com.virblue.mystudylife`; açıklaması takvim, ödev, sınav, not ve Pomodoro'yu bir araya getiriyor. — [Google Play](https://play.google.com/store/apps/details?id=com.virblue.mystudylife&hl=en)

### Inferences
- GINA raporunda her bulguya ürün alan adı yazılmalı; “DersTakip'te var” ifadesi yeterli kimlik değildir. Kullanıcının kastettiği sürüm kesinleşene kadar üç ürün ayrı karşılaştırma satırları olarak kalmalı.
- Mağaza açıklaması özellik mevcudiyetine ilişkin yayıncı kanıtıdır; kullanılabilirlik, doğruluk, bağlılık veya okul başarısı kanıtı değildir.

### Gaps
- Kullanıcının kastettiği DersTakip kesinleşmedi. İsim benzerliği veya benzer özellikler ortak sahiplik kanıtı sayılmadı.
- Hiçbir ürün için elde tutma, okul başarısı veya çocukların uygulamayı sevmesi hakkında bağımsız nedensel veri incelenmedi. İndirme sayıları ve pazarlama yorumları bu amaçla kullanılmadı.
- Bağlantısı bulunan tanıtım ekranları canlı ürün doğrulaması sayılmadı; piksel düzeyinde arayüz değerlendirmesi yapılmadı.

## Yapılandırılmış ödev, ders ve zaman çizelgesinden ne alınmalı?

### Takeaway
MyStudyLife'ın aktarılabilir gücü, ders/ödev/sınavı ayrı nesneler olarak tutup tek gün/hafta görünümünde buluşturmasıdır. GINA'da çocuk “şimdi ne yapacağım?”, ebeveyn “bu haftanın yükü ne?” sorusunun cevabını aynı kayıtlardan almalı.

### Cited Findings
- MyStudyLife turu dönem ve tatil tarihlerini, ders/sınav çakışmasını, ders başlangıç-bitiş tarihlerini ve tatilde otomatik duraklamayı anlatıyor. Görevlerde kısmi tamamlanma, yedi görev türü, tekrarlama ve belirli sınava bağlanabilen tekrar çalışmaları listeleniyor. Yaklaşan ders, sınav ve bitmemiş görevler ana görünümde bir araya geliyor. — [Resmi ürün turu](https://mystudylife.com/tour/)
- Güncel ana sayfa dönen/blok programları, A/B haftalarını, program fotoğrafından giriş ve Scout ile hafta planlamayı tanıtıyor. Bunlar ürün iddiası; fotoğraf okuma doğruluğu test edilmedi. — [MyStudyLife](https://mystudylife.com/)
- MyStudyLife App Store açıklaması karmaşık ödevlerde alt görevleri ve Family Connect içinde öğrencinin paylaşımı kontrol etmesini söylüyor. Ebeveyn bağlantısı resmi sitede yaklaşan işleri görme ve planlayıcıya katkı verme olarak anlatılıyor. — [App Store](https://apps.apple.com/us/app/my-study-life-school-planner/id910639339), [Resmi site](https://mystudylife.com/)

### Inferences
- **GINA veri modeli:** Ders → konu → ödev/çalışma adımı → bağlı sınav ilişkisi. Süreli ders ile teslim tarihli ödev farklı ikon, etiket ve işlem taşımalı; renk tek ayırt edici olmamalı.
- **Çocuk ana ekranı:** “Sıradaki küçük adım” kartı; ders, anlaşılır hedef, gereken malzeme, isteğe bağlı tahmini süre, Başla / Yardım iste / Sonraya al. Uzun görevi somut alt adımlara bölmek, belirsiz bir yüzde sürgüsünden daha anlaşılır bir başlangıç varsayımıdır; yaş gruplarıyla test edilmeli.
- **Ebeveyn haftası:** Okul, ev ödevi, tekrar ve etkinlik yükünü beraber göster; tatil istisnaları ve tekrarlama ilk sürümden desteklensin. Çocuğun ekranına yoğun yönetim tablosu taşınmasın.
- **Fotoğrafla giriş:** Sonraki aşamada ebeveyn tarafında “fotoğraf → düzenlenebilir önizleme → onayla” şeklinde uygulanabilir. Yanlış gün/saat ve çakışma açıkça işaretlenmeli.
- **Paylaşım:** Çocuğun “ailem bunu görebilir” durumunu anlayacağı açıklama; ebeveyn katkısı görünür geçmişte gösterilmeli. Bu öneri, aile desteğini sürekli gözetim hissine çevirmemek için GINA tasarım tercihidir.

### Gaps
- Yaşa göre en uygun görev ayrıntısı, çocuk/ebeveyn düzenleme yetkileri ve plan değiştirme beklentileri kullanıcı testi gerektirir.
- MyStudyLife destek merkezindeki program ekleme yazısı alınamadı; ayrıntılı ayar akışları doğrulanmadı.

## Odak, planlama ve deneme analizi nasıl bağlanmalı?

### Takeaway
En değerli örüntü “planla → kısa çalışma → ne yaptığını kaydet → bir sonraki adımı seç” döngüsüdür. Süre, kazanımın yerine geçmez; analiz grafiği yeni bir çalışma adımına bağlanmalıdır.

### Cited Findings
- `derstakip.app`, seansa ders/konu seçerek başlanmasını ve çalışma/mola sürelerinin ayrı tutulmasını açıklıyor. AI koçun hedef, çalışma geçmişi ve deneme netlerinden haftalık plan ürettiğini iddia ediyor. — [DersTakip](https://derstakip.app/)
- MyStudyLife turunda çalışma ve mola aralıklarıyla Pomodoro; Google Play açıklamasında özelleştirilebilir çalışma oturumları bulunuyor. — [Ürün turu](https://mystudylife.com/tour/), [Google Play](https://play.google.com/store/apps/details?id=com.virblue.mystudylife&hl=en)
- DersTakip2, kronometre, kişiselleştirilebilir Pomodoro ve ağaç büyütmeli “Sert Odak” seçeneklerini tanıtıyor; ders/konu süreleri için haftalık ve aylık istatistikler sunduğunu söylüyor. — [DersTakip2](https://derstakip2.com.tr/)
- `ders-takip.com` deneme analizini yanlış/boş kaybı, hedef net farkı ve kazanım gelişimiyle anlatıyor; bulgunun tek tıkla çalışma planına eklenebildiğini söylüyor. Koçluk panosunda dikkat isteyen öğrenciler gerekçeleriyle öne çıkıyor. Görüşme notlarının özel, veli haftalık raporunun ayrı olduğunu belirtiyor. Puan tahminlerinin sonuç garantisi olmadığını açıkça yazıyor. — [DersTakip öğretmen ürünü](https://ders-takip.com/)

### Inferences
- **Odak kartı:** Seçili ödevden tek dokunuşla başlat; kısa/esnek süre seçenekleri, kolay mola ve cezasız bitirme. Süre sonunda “Ne tamamlandı?” ile alt adım güncellenmeli. Mint maskot nazik eşlikçi; kullanıcıyı uygulamada tutma hedefi değil.
- **Anlamlı ölçüm:** “Çalışılan dakika” ve “tamamlanan adım / tekrar gereken konu” ayrı gösterilsin. Daha çok dakika otomatik daha iyi öğrenme olarak puanlanmasın.
- **Ebeveyn AI akışı:** Kayıt özeti + önerinin dayandığı gözlem + önerilen haftalık taslak → ebeveyn düzenler/onaylar → çocuk yalnız onaylı adımları görür. Doğrudan çocuk AI sohbeti eklenmez.
- **Deneme ekranı:** Girdi tarihi/kaynağı, ders bazında doğru-yanlış-boş, önceki karşılaştırılabilir sonuç ve konu etiketi; ardından “Bu konudan 1 tekrar adımı ekle”. Yalnız toplam net verisinden belirli konu eksiği çıkarılmamalı; konu iddiası için soru/konu verisi gerekli.
- **Ebeveyn özeti:** “Matematik kötü” yerine gözlenebilir durum ve yardım önerisi: “İki adım ertelendi; süreyi küçültmeyi birlikte değerlendirin.” Görünür gerekçe, tanı veya başarı garantisi üretmez.

### Gaps
- Rakip AI önerilerinin doğruluğu, öğrenci verisini hangi kapsamda kullandığı ve konu çıkarım yöntemleri test edilmedi.
- Deneme netleri, konu başarıları ve çalışma süreleri arasındaki nedensellik gösterilmiş değil. GINA analiz dili gözlem ve öneri sınırında kalmalı.

## Hangi mekanikler alınmamalı; öncelikli beş aktarım nedir?

### Takeaway
Yapılandırma ve aile işbirliği alınabilir; çocuk üzerinde kayıp baskısı, saat yarışı veya sohbet bağımlılığı üreten mekanikler taşınmamalı. GINA'nın onaylı mint maskot, mor ve krem dili korunarak işlevsel örüntüler yeniden tasarlanmalı.

### Cited Findings
- `derstakip.app` günlük seri, haftalık lig/XP, kedi giydirme, oda ve coin ekonomisini tanıtıyor. Bu mekaniklerin öğrenmeyi veya uzun vadeli sağlıklı alışkanlığı artırdığı bu kaynakla doğrulanmış değildir. — [DersTakip](https://derstakip.app/)
- DersTakip2 herkese açık/özel ortak çalışma odası, anlık sohbet ve rekabeti; ayrıca günlük seri animasyonlarını tanıtıyor. — [DersTakip2](https://derstakip2.com.tr/)
- MyStudyLife mağaza sayfalarında 2024 tarihli bazı kullanıcı yorumları yeniden tasarım sonrası veri taşıma ve görev bulma sorunlarını bildiriyor. Bunlar eski, seçilmiş kullanıcı deneyimleridir; güncel ürünün bütününe genellenemez. — [Google Play](https://play.google.com/store/apps/details?id=com.virblue.mystudylife&hl=en)
- MyStudyLife sitesindeki reklam gösterilmediği beyanı ile App Store'daki reklam/izleme veri kategorileri aynı yönde görünmüyor. Mağaza gizlilik bilgisi geliştirici beyanıdır ve Apple tarafından doğrulanmadığı yazılıdır; mevcut uygulamanın reklam davranışı hakkında hüküm kurulmadı. — [Resmi site](https://mystudylife.com/), [App Store](https://apps.apple.com/us/app/my-study-life-school-planner/id910639339)

### Inferences
1. **P0 — Ortak öğrenme omurgası:** Ders, ödev, sınav ve tekrar aynı veriye bağlansın; çocuk Bugün, ebeveyn Hafta görünümünü kullansın.
2. **P0 — Küçük adımlar ve odak bağlantısı:** Görevden süreye, süreden tamamlanan adıma tek akış; mola hakkı ve cezasız geri dönüş.
3. **P0 — Ebeveyn onaylı öneri:** AI taslağı gerekçeli ve düzenlenebilir olsun; onay verilmeden çocuğun programı değişmesin.
4. **P1 — Analizden eyleme:** Grafiklerin yanına kanıta bağlı tek tekrar önerisi; veri yetersizse bunu söyle. Net/puan tahmini çocuk ana ekranının merkezine konmasın.
5. **P1 — Sakin aile işbirliği:** Erteleme/yardım isteme, haftalık değerlendirme ve plan değişikliği geçmişi. Kırılan seri, lig sıralaması, coin harcama baskısı ve açık yabancı sohbeti önerilmez.
- Tasarım kabul ölçütü: Çocuk bir sonraki adımı açıklayabiliyor mu; ebeveyn haftayı düzenleyebiliyor mu; yanlış öneri düzeltilebiliyor mu? Bunlar önerilen doğrulama sorularıdır, araştırmayla ölçülmüş sonuçlar değildir.

### Gaps
- Bu çalışma ürün deneyimi ve etki araştırması yerine kaynaklı özellik karşılaştırmasıdır. Uygulama içi erişilebilirlik, eşzamanlama güvenilirliği ve çocukların anlama düzeyi ayrıca test edilmelidir.
