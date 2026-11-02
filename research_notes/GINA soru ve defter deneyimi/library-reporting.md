# GINA ortak soru bağlamı ve gelişim raporu

## Mevcut projede hangi parçalar var ve ne eksik?

### Takeaway

GINA’da kütüphane, soru başına medya, veli puanı/metin geri bildirimi, AI incelemesi ve ayrı konu ilerleme ekranı zaten var. Eksik olan, bunların sürümlü ortak bağlamlı soru setleri, düzenlenebilir cevap defteri ve karşılaştırılabilir gelişim raporu olarak birleştirilmesi; mevcut ekranları yok sayıp paralel akış üretmek doğru değil. İnceleme 2 Kasım 2026 tarihinde repo kaynak kodu ve migration okumasıdır; bu araştırmada çalışan uygulamanın yeni görsel/native testi yapılmadı.

### Cited Findings

- `question_bank` 1–12 sınıf, serbest metin ders/konu, iki cevap türü (çoktan seçmeli/açık uçlu), zorluk, çözüm, açıklama, kaynak URL ve köken alanları tutuyor. `scenario_code`, ortak bir hikâye/görsel nesnesi değil; soru dağılım senaryosunu ifade ediyor. — [Soru şeması](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261030040000_prova.sql:12)
- Ücretli kütüphane aile soru bankasından ayrı `library_collections`/`library_items`; koleksiyonda sınıf, ders, `curriculum_version`, paket ve yayın durumu var. `redeem_library_item` aile kilidi ve tekil aile–öğe kaydıyla **tek soruyu** aileye kopyalıyor. Tekrar edinim ikinci soru/kota oluşturmuyor. — [Kütüphane](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102123000_learning_library.sql:5), [Edinim](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102123000_learning_library.sql:198)
- Veli katalog ekranında koleksiyon ve soru başına konu/tür/zorluk ile ekleme düğmesi var; ortak bağlam/set seçimi yok. — [Veli kütüphane UI kodu](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/parent/prova/library.tsx:170)
- `learning_source_links` aynı dosyanın farklı sorularla ilişkilenmesini yapısal olarak mümkün kılıyor. Ancak ortak metin, bağlam sürümü, alt soruların sıra/grup bağı ve grup için atomik edinim sözleşmesi yok. Mevcut medya erişimi yalnız aile/atanmış soru yetkisine bağlı. — [Kaynak bağlantıları](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102130000_learning_sources.sql:18), [Medya okuma](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102130000_learning_sources.sql:85)
- Özel görselli sorunun kütüphaneye katkısı, bağımsız kopyalama/moderasyon yapılmadığından `source_contribution_not_ready` ile engelleniyor. Dolayısıyla bugünkü katkı akışını görselli setlere doğrudan açmak veri/eksik içerik sorunu doğurur. — [Katkı medya koruması](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102130000_learning_sources.sql:188)
- Kütüphane doğrulaması ve soru kayıt RPC’si MC için **tam dört A–D şıkkı** istiyor; AI üretim şeması da aynı. ÖSYM gibi farklı sınav profili eklemek yalnız prompt düğmesi değildir; tür profiline göre doğrulama/UI/puanlama/kitapçık güncellenmelidir. — [Kütüphane doğrulama](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102123000_learning_library.sql:52), [Soru kayıt doğrulama](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102130000_learning_sources.sql:156), [AI şeması](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/functions/prova-generate/index.ts:71)
- Veli incelemesinde açık uçlu soruya 0–100 puan ve metin geri bildirim, AI önerisi ve veli puanı ayrımı mevcut; özel veli notu, deftere çizerek işaretleme ve geri bildirim katman sürümü yok. — [AnswerCard](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx:270)
- AI raporu konu gözlemini gerçek soru referanslarına bağlıyor; çalışma adımı, başarı ölçütü, veli desteği ve sınırlar var. Okunamayan görsel için null puan ve boş cevabı bilgi eksikliği diye yorumlamama kuralları mevcut. — [Rapor sözleşmesi ve prompt](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/functions/_shared/grade-report.ts:1)

### Inferences

**Önerilen ortak bağlam modeli:** kullanıcıya “Ortak metin / görsel”; uygulama içinde `stimulus` + değişmez sürüm. Soru seti = bir bağlam sürümü + sıralı alt soru sürümleri + cevap/rubrik sürümleri. Telefon kaynak paneli daraltılabilir/sabit erişimli; tablette kaynak ve cevap yan yana. Sonraki soruya geçince ortak görsel yeniden indirilmemeli veya kaydırma konumu gereksiz sıfırlanmamalı.

Bu ayrımın sektör karşılığı vardır: QTI 3, birden çok sorunun kullanabildiği bağlamı ayrı bir `assessment-stimulus` nesnesi ve soru referanslarıyla tanımlar. Bu araştırma **GINA’nın QTI uyumlu olduğunu veya tüm standardın uygulanması gerektiğini söylemez**; kendi JSON modelimizde aynı ayrımı kurmak makul. — [1EdTech QTI 3 bilgi modeli, ortak stimulus ve referansları](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html)

Önerilen yeni sözleşmeler:

1. `stimulus_versions`: sahibi/aile veya editoryal içerik, güvenli metin blokları, onaylı medya kimlikleri, alt metin, değişmez içerik hash’i/sürüm, kaynak kökeni ve kullanım hakkı kaydı.
2. `question_set_versions`: bağlam sürümü, ders/sınıf/müfredat/öğrenme çıktısı kimlikleri, sıralı sorular, tür profili ve yayın durumu. Eski sürüm atanmışsa sonradan düzenleme yeni sürüm üretir.
3. `exam_set_snapshots`: sınavda çözülen tam bağlam/soru/rubrik sürümü. Başka çocuğa atanmış setin cevapları bu bağı takip ederek okunamaz.
4. `answer_documents`: soru/attempt, cevabın düzenlenebilir çizgi/metin/parça katmanları, revizyon, raster AI önizleme, kaydedildi durumu. Kaynak nesnesine referanslı bir alıntı ile öğrencinin kendi çizgisi ayrılır.
5. `review_documents`: çocuğun cevabına dokunmadan ayrı veli işaretleme katmanı. “Çocuğa gösterilecek geri bildirim” ve “Yalnız velinin notu” açık ayrılır. AI yalnız istenen kapsam ve onayla değerlendirme taslağı oluşturur.

Edinim “seti ekle” olmalı: soru, bağlam ve gerekli medya bir işlemde bağlanır; yarım set yayın/edinim olmaz. Kotada **bir set mi yoksa alt soru sayısı mı** sayılacağı önceden açık gösterilir; önerim alt soru başına soru hakkı, ortak bağlamın ayrıca ücretlendirilmemesi. Örneğin “1 metin + 4 soru = 4 soru hakkı”; önceden edinilenler tekrar düşmez. Tüm alt soruların cevap anahtarları katalog JSON’una konmamalı.

Özel aile dosyası ortak kütüphane dosyasına yalnız URL kopyasıyla dönüşmemeli. Katkı sırasında ayrı kullanım onayı ve bağımsız editoryal kopya oluşturulmalı; kişisel bilgi/eksik görüntü kontrolü sonrası taslak set incelemeye girmeli. Katkı geri çekilmesi, önceden edinilmiş sürümler ve hak iptali davranışı açık ürün politikası gerektirir. Özgün öğrenci cevapları katkı içeriğine kendiliğinden eklenmemeli.

### Gaps

- Canlı kütüphane doluluğu ve aktif ücret politikası bu araştırmada sorgulanmadı; “tüm dersler hazır” sayısı verilemez.
- QTI’nin iki rehber sayfası fetch zaman aşımı verdi; yukarıdaki teknik iddia başarıyla açılan resmî bilgi modeli üzerinden doğrulandı.
- Cihazdaki kalem/avuc içi reddi ve AI el yazısı başarımı bu alt araştırmanın kapsamı değil; ayrı notebook incelemesiyle tamamlanmalı.

## Tüm sınıf ve dersler için özgün kütüphane nasıl doldurulmalı?

### Takeaway

Toplu içerik üretimini “her derse birkaç rastgele soru” olarak değil, doğrulanmış sınıf–ders–program sürümü–öğrenme çıktısı–soru biçimi kapsam matrisi olarak ele almak gerekir. Üretim miktarı, taslak miktarı ve yayımlanmış insan incelemeli miktar ayrı sayaçlar olmalı; hazırlık ile yayını ayırmalıyız.

### Cited Findings

- Mevcut üretim ders/sınıf/konu veya dağılım senaryosu, soru türü, zorluk ve practice/written/context amacı alıyor; azami üretim 30. Sistem promptu resmî metin verilmeden tam güncel müfredat uyumu iddiasını ve eksik görsele bağlı soru üretimini yasaklıyor. — [Üretim işlevi](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/functions/prova-generate/index.ts:27)
- AI üretim kökeninde model, prompt sürümü/hash’i ve istek kaydı tutuluyor. Modele atfedilen URL’ler doğrudan doğru kabul edilmiyor; kaydedilen resmî kaynak listesi doğrulanan senaryo URL’sinden kuruluyor. Bu URL, belgenin içerik olarak modele verildiğini kanıtlamaz. — [Köken ve kaynak oluşturma](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/functions/prova-generate/index.ts:392)
- Kütüphanede exact/normalize edilmiş soru gövdesi/şık/cevap hash’iyle tekrar kontrolü ve taslak-yayın ayrımı var. Anlamsal olarak çok yakın soruların veya yalnız isim/sayı değiştirilmiş kopyaların tespiti bu hash’in yaptığı işlem değil. — [Kütüphane hash’i](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102123000_learning_library.sql:66), [İnceleme ve yayın](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102123000_learning_library.sql:130)
- OECD’nin kendi soru geliştirme süreci inceleme ve deneme uygulamasını içeriyor; soru biçimini taklit etmek, soru kalitesini tek başına doğrulamaz. — [OECD PISA SSS, soru geliştirme](https://www.oecd.org/en/about/programmes/pisa/pisa-frequently-asked-questions-faqs.html)

### Inferences

Önerilen kontrollü içerik hattı:

- **Kapsam kaydı:** resmî kaynağın başlığı/URL’si/yılı, yerel dosya hash’i, öğrenme çıktısı kodu, incelenen sayfa ve editör notu. Resmî kaynaklar soru kopyalama havuzu değil, kapsam/biçim inceleme kaynağıdır.
- **Soru biçimi seçenekleri:** kısa beceri çalışması; bağlam/metin yorumlama; veri tablosu/grafik; geometrik şekil/şema; bir ortak bağlama bağlı soru grubu; okul yazılısı açık uçlu; sınav profiline uygun çoktan seçmeli. Her biri her sınıf/derse zorla açılmaz. Çoktan seçmeli/açık uçlu **cevap türü** ile hikâye/grafik **sunum biçimi** ayrı eksenlerdir.
- **Batch manifesti:** job_id, hedef hücreler, kaynak sürümleri, model/prompt/schema sürümü, üretilecek set/soru sayısı, izinli görsel üretimi türü, tahmini ve gerçek token/maliyet, bütçe tavanı, devam noktası, başarısız/uncertain iş durumu, üretilen dosya ve hash’ler.
- **Doğrulama:** JSON/şık sayısı/tek doğru; birim ve sayı tutarlılığı; okunabilir çözüm; yanlış seçenek gerekçeleri; şeklin metinle tutarlılığı; alt soruların gerçekten ortak bağlama ihtiyaç duyması; bir sorunun cevabının sonraki soruda istemeden açıklanmaması; eksik dış bilgi; sınıfa uygun dil. AI öz denetimi insan incelemesinin yerine geçmez.
- **Yayın kuyruğu:** generated → validation failed/review pending → approved → published; onaylayan kişi/sürüm ve geri çekme nedeni kaydı. Matematiksel/ölçülü diyagramı mümkünse parametrik/veri temelli çizimle üret; dekoratif görselin ölçü kanıtı sayılmasına izin verme.
- **Kapsam paneli:** her hücrede hedef / üretilen / incelenmiş / yayımlanan / reddedilen sayılar. Yayımlanmamış hücreyi “hazır” boyama. İlk üretim bütün geçerli ders-sınıf hücrelerine taslak açabilir, fakat doğrulanmamış program eşlemelerini yayınlamaz.
- **Kalite ve çeşitlilik:** sadece soru sayısını büyütmek yerine aynı öğrenme çıktısı için farklı bağlam, farklı temsil ve farklı akıl yürütme adımı. “Zorluk” başlangıçta editoryal tahmin; kullanım kanıtıyla izlenir, otomatik psikometrik kalibrasyon diye sunulmaz.

### Gaps

- Her sınıf/derste yürürlükteki resmî öğrenme çıktısı kataloğu henüz bu repo alanlarında kodlanmış değil; serbest metinle tam kapsam garantisi verilemez. Pedagoji araştırmasıyla sürüm matrisi oluşturulmalı.
- Tüm kapsamın doğru soru hedefi, editör kapasitesi ve sağlayıcı bütçesi verilmiş değil. Bu araştırma ücretli batch başlatmadı veya bir soru bankasını yayınlamadı.

## Gelişim raporu ve veli incelemesi nasıl güvenilir ve kullanışlı olmalı?

### Takeaway

Mevcut `progress` sayfası geliştirilmelidir; yeni paralel “analiz” menüsü şart değil. Ana rapor, çocuğun zaman içindeki çalışmalarını açıklayan, soru sayısını ve değerlendirme durumunu gösteren bir öğrenme özeti olmalı; farklı soru türleri/sürümleri karışınca otomatik “gelişti/geriledi” sonucu üretmemeli.

### Cited Findings

- `child_topic_mastery` son denemelere 30 günlük yarı ömürle ağırlık veriyor; MC yanlış/boşu 0, puanlanan açık uçluyu puan/100, puanlanmamış açık uçluyu bekleyen olarak sayıyor. Sonuç **subject + topic** gruplu, sınıf alanı `max(grade)`; farklı sınıf kayıtları aynı konu başlığı altında birleşebilir. — [İlerleme RPC](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261030090000_prova_level.sql:157)
- UI, konu puanlarının basit ortalamasını ders ortalaması olarak gösteriyor; 60 altını zayıf, 80 üstünü yeşil sınıflıyor. Örneklem sayısı gösteriliyor ama yeterli gözlem eşiği olmadan etiket veriliyor; zaman serisi/grafik filtreleri yok. — [İlerleme sayfası](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/parent/prova/progress.tsx:15), [Ortalama hesabı](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/parent/prova/progress.tsx:65)
- Toplu prova aynı soru sürümüyle karşılaştırma, katılım tercihi ve aileye özel konu raporuna sahip. Bu dar karşılaştırma, farklı ailelerin farklı günlük soru setlerinin genel sıralamaya çevrilmesiyle aynı şey değil. — [Toplu prova veri ve skor sözleşmesi](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102140000_group_exams.sql:5)
- OECD, PISA’nın bireysel öğrenci puanları üretmek için tasarlanmadığını açıkça söylüyor. Bu, GINA’da “PISA seviyen” gibi bir bireysel etiket kullanmak için resmî örnek soruları çözmenin yeterli olmadığını gösterir; GINA’ya ilişkin öneri bir çıkarımdır. — [OECD PISA SSS](https://www.oecd.org/en/about/programmes/pisa/pisa-frequently-asked-questions-faqs.html)

### Inferences

Önerilen rapor ekranı:

1. Üstte çocuk + son 7/30/90 gün + ders/sınıf/program sürümü filtreleri. Tek çocukta gereksiz seçim yok. Ailenin saat dilimi bütün gün/hafta hesaplarında aynı.
2. **Bu dönemin özeti:** çözülen özgün soru, yapılan tekrar, tamamlanan çalışma, değerlendirilmeyi bekleyen cevap. Bir sorunun tekrarı yeni özgün soru gibi sayılmaz.
3. **Zaman içindeki sonuç:** her noktada değerlendirilen soru sayısı, doğru/kısmi/yanlış/boş/bekleyen ayrı; puanlanmamış cevabı yüzdeye sıfır olarak ekleme. Yeni, daha zor set nedeniyle puan düşüşünü “öğrenme kaybı” diye adlandırma.
4. **Konu/çıktı tablosu:** öğrenme çıktısı + program sürümü + sınıf anahtarı; örnek sayısı ve son çalışma tarihi. Az gözlemde “Henüz yeterli gözlem yok”, yeterli ölçüde “Bu çalışmalarda…” dili. 60/80 eşikleri ürün kararıysa etiket açık olmalı, resmî yeterlilik sınırı gibi sunulmamalı.
5. **Geri bildirimin etkisi:** özgün cevap → veli/AI önerisi → yeniden deneme; önceki cevabı ezmeden sürümler. Hatayı düzeltmek ödüllendirilebilir, sırf toplam dakika/çizgi sayısı başarı ölçütü olmamalı.
6. **Önerilen sonraki adımlar:** en fazla birkaç uygulanabilir adım; her biri kanıt sorularına açılır. “Bu hafta şu 3 soruda kesir karşılaştırmasını tekrar edelim” gibi. Toplu yeni görev yazmadan önce veli seçer/önizler.
7. Grafiklerin metin eşdeğeri; renk tek anlam taşıyıcısı değil. Tablet geniş görünüm; telefonda kaydırılabilir büyük kartlar, minik çok eksenli/radar grafiklerle sahte hassasiyet yok.

Veli inceleme deneyimi: solda/üstte soru ve ortak kaynak, sağda/altta cevap defteri; “Çocuğun cevabı”, “Benim işaretlemelerim”, “Çocuğa geri bildirim”, “Özel notum”, “AI önerisi” ayrımı. Veli notu otomatik çocuğa/AI’a gönderilmez. AI değerlendirme taslağı kanıt noktalarını ve belirsiz okunmuş sembolleri gösterir; veli kabul/değiştirir. Kısmi puan rubriği (ör. yöntem, işlem, gerekçe) tek sayıdan daha açıklayıcı olabilir. Sonradan değişen rubrik geçmiş sınavın puanını sessiz değiştirmez.

Üç önerinin seçimi için ürün önerisi: birbirinden bağımsız görev/ödül taslakları çoklu seçilebilir, bütün seçimler bir kontrol ekranında düzenlenebilir; aynı üretim yeniden ücretlendirilmez. Birbiriyle alternatif planlar veya aynı çocuk için tek aktif hedef gerekiyorsa çatışma görünür; “tek aktif hedef + sonrakiler istek listesi” gibi açık semantik korunur. Öneri üretme hakkı ile seçilen kaydın ürün kapasite sınırı farklıdır; birini diğerinin yerine sessiz ücretlendirmemek gerekir. Bu bölüm ürün önerisidir; mevcut üç öneri akışının uygulama değişikliğini ana ajan inceliyor.

### Gaps

- Gerçek kullanım verisi, madde kalibrasyonu, güvenilirlik veya öğrenme kazanımı ölçümü bu incelemede yok; yüzde grafiklerini doğrulanmış yetenek puanına çeviremeyiz.
- Mevcut UI kodunun not/çizim deneyimi ve native kalem davranışı cihazda test edilmedi; grafik tasarımının görsel onayı ayrı yapılmalı.
- Bu notlar araştırma ve tasarım önerisidir; yeni soru seti, defter veya raporun uygulandığı/üretime alındığı anlamına gelmez.

## Ek: İlk kapsam matrisi ve uygulama temas noktaları

### Takeaway

Aşağıdaki matris bir **ilk aday üretim planıdır**; bütün resmî dersleri, kazanımları veya okul türlerini kapsayan tamamlanmış banka değildir. Her sınıf–ders hücresi için **20 aday soru** başlangıç hesabı kullanılabilir; kullanıcı yanıtı, maliyet sınırı ve müfredat eşlemesi gelmeden ücretli üretim başlatılmadı. 20 soru bir dersi kapsama/ölçme yeterliliği iddiası değildir. Görsel sanatlar, müzik, beden eğitimi gibi alanlarda çoktan seçmeli soru zorlamak yerine performans görevi ve rubrik gerekir; ayrı içerik türleri olarak planlanmalı.

| Sınıf | İlk aday üretim için ders grubu | Açık sınır / doğrulama gereği |
|---|---|---|
| 1 | Türkçe, Matematik, Hayat Bilgisi | Okuma düzeyi ve dönem önemli; uzun ortak metin otomatik verilmez. |
| 2 | Türkçe, Matematik, Hayat Bilgisi, İngilizce | İngilizce görsel/dinleme ihtiyacı ve kazanım eşlemesi doğrulanmalı. |
| 3 | Türkçe, Matematik, Hayat Bilgisi, Fen Bilimleri, İngilizce | Güncel çizelge ve programın öğrenme çıktıları ayrı doğrulanmalı. |
| 4 | Türkçe, Matematik, Fen Bilimleri, Sosyal Bilgiler, İngilizce; Din Kültürü ve Ahlak Bilgisi, İnsan Hakları Yurttaşlık ve Demokrasi, Trafik Güvenliği | Son üç alan için ders bazında program/çıktı eşlemesi; bu tablo zorunlu ders kararı yerine geçmez. |
| 5–7 | Her sınıf ayrı: Türkçe, Matematik, Fen Bilimleri, Sosyal Bilgiler, İngilizce, Din Kültürü ve Ahlak Bilgisi | Bilişim/teknoloji ve seçmeliler okul çizelgesine göre ayrı açılır; tek ortak 5–7 kazanım listesi kullanılmaz. |
| 8 | Türkçe, Matematik, Fen Bilimleri, T.C. İnkılap Tarihi ve Atatürkçülük, İngilizce, Din Kültürü ve Ahlak Bilgisi | Ders çalışması ve LGS profili ayrı; sınav biçimi ders içeriğinin tamamı değildir. |
| 9–10 | Her sınıf ayrı: Türk Dili ve Edebiyatı, Matematik, Fizik, Kimya, Biyoloji, Tarih, Coğrafya, İngilizce, Din Kültürü ve Ahlak Bilgisi | Okul türü/ders çizelgesi doğrulanacak; felsefe ve diğer derslerin hangi sınıfta bulunduğu güncel çizelgeye göre eklenmeli. |
| 11–12 | Sınıf ve alan ayrı: ortak dersler + sayısalda Matematik/Fizik/Kimya/Biyoloji; eşit ağırlıkta Matematik/Edebiyat/Tarih/Coğrafya; sözelde Edebiyat/Tarih/Coğrafya/Felsefe grubu; dilde hedef yabancı dil | Bunlar içerik havuzu gruplarıdır, öğrencinin zorunlu derslerinin listesi değildir. Anadolu/fen/sosyal bilimler/mesleki/imam hatip okulları, seçmeli dersler ve sınav kapsamları doğrulanmadan otomatik atama yapılmaz. |

### Cited Findings

- MEB'in temel eğitim taslak çerçeve sayfası 2026–2027 için **1, 2, 3 ve 5, 6, 7. sınıfları** TYMM kapsamında belirtir. Bu, 1–12 için tek müfredat sürümü atamamak gerektiğini destekler. [MEB temel eğitim çerçeveleri](https://tymm.meb.gov.tr/taslak-cerceve-planlari/temel-egitim).
- OGM duyurusu 2026–2027'de hazırlık, 9, 10, 11 için TYMM; 12 için önceki programların devamını belirtir. Kazanım düzeyinde dokümanlar tek tek bu araştırmada okunmadı. [MEB OGM duyurusu](https://ogm.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-turkiye-yuzyili-maarif-modeli-taslak-cerceve-planlar-yayimlandi/icerik/2633/tr).
- İlköğretim haftalık çizelgesi 09.05.2025/04 kararıyla güncellenmiş. Eski 2024 çizelgesini tek kaynak almak uygun olmaz. [MEB çizelge değişikliği](https://tegm.meb.gov.tr/www/ilkogretim-kurumlari-ilkokul-ve-ortaokul-haftalik-ders-cizelgesinde-degisiklik-yapildi/icerik/1150). Bu araştırmada son PDF'nin bütün hücreleri karşılaştırılmadığı için yukarıdaki tablo **önerilen gruplama** olarak tutuluyor.

### 4/5 seçenek ve ortak kaynak için kesin kod temas noktaları

Depo kökü: `/Users/enes/.codex/worktrees/gina-avatars/gina`. Aşağıdaki mevcut dosyalar okunarak saptandı; tarihli uygulanmış göçleri geriye dönük değiştirmek yerine yeni göç kullanılmalı.

| Yol:satır | Mevcut kısıt / güvenli genişletme ihtiyacı |
|---|---|
| `supabase/functions/prova-generate/index.ts:66` | Prompt tam dört seçenek istiyor. `assessment_profile` ile doğrulanmış seçenek sayısı belirlenmeli; prompt tek başına yeterli değil. |
| Aynı dosya `:109`, `:324`, `:382` | Şema A–D enum, doğrulama uzunluk4/anahtar sayısı4, kayıtta `.slice(0,4)` var. Beşinci seçenek sessiz kaybolabilir; tüm katmanlar tek seçenek politikasıyla güncellenmeli. |
| `supabase/migrations/20261102123000_learning_library.sql:61` | `gina.library_question` dört A–D kabul ediyor; yayınlama, katkı ve kütüphane alımı bu doğrulamadan etkilenir. Doğru anahtar gerçekten seçenekler içinde ve seçenek anahtarları benzersiz olmalı. |
| `supabase/migrations/20261102130000_learning_sources.sql:160` | `save_question_with_sources` aynı dört seçenek doğrulamasını tekrarlıyor. Yeni politika hem elle hazırlanan hem AI hem kütüphane içeriğine uygulanmalı. |
| `apps/mobile/src/app/parent/prova/question.tsx:25`, `:47`, `:70`, `:94` | Elle düzenleme A–D sabitleri, ilk state, kaydetme ve sıfırlama dört seçeneğe bağlı. Form profil seçince seçenek sayısını göstermeli; doğru E seçilmişken seçenek sayısı azaltılırsa görünür doğrulama gerek. |
| `supabase/migrations/20261102140000_group_exams.sql:60`, `:101`, `:152` | Grup sınavı soru içeriğini kopyalıyor ve donduruyor. Ortak metin/görsel sürümleri de set hash ve snapshot içine girmeli; sonradan editör güncellemesi başlamış sınavı değiştirmemeli. |
| `supabase/migrations/20261102123000_learning_library.sql:198` | Tek madde atomik alım var; ortak kaynak + soru grubu için aynı işlem içinde set, varlıklar, soru kopyaları ve kota kaydı gerekir. Tekrar denemede aynı sonuç dönmeli. |
| `supabase/migrations/20261102130000_learning_sources.sql:18`, `:85`, `:188` | Dosya bağlantıları ve erişim kontrolü mevcut; ortak kaynağın soru seti üyeliği üzerinden erişimi kurulmalı, aile özel kaynak URL'si global kataloğa taşınmamalı; mevcut görsel katkı engeli kaldırılmadan ayrı editoryal kopyalama gerekecek. |
| `supabase/migrations/20261030040000_prova.sql:156` | Çocuğa soru veren RPC yalnız soru kökü/seçenekleri döndürüyor; ortak kaynak çocuk güvenli DTO'su eklenirken cevap anahtarı, beklenen cevap, çözüm ve diğer soruların değerlendirme içeriği taşınmamalı. Daha yeni RPC tanımları da değişiklik öncesi taranmalı. |
| `apps/mobile/src/app/parent/prova/booklet.tsx:19`, `apps/mobile/src/lib/prova-booklet.ts:109` | Kitapçık seçenekleri dinamik map ediyor; ortak metin ve görselleri soru grubu başına bir kez basacak sayfa bölme/alt açıklama gerekir. |
| `supabase/functions/_shared/grade-report.ts:1` | AI değerlendirme soruların yanına setin gerçek ortak kaynağını da almalı; salt kaynak URL'sini modele içeriği görmüş gibi sunmamalı. |

### Inferences / Gaps

Mevcut 4 seçenekli içerik korunmalı; profil verilmemiş eski kayıtların davranışı değişmemeli. Yeni soru profili seçenek sayısı, müfredat ve kaynak sürümünü bir arada taşımalı. 3/4/5 gibi seçenek sayıları yaş ve sınav türüne göre resmî kaynakla doğrulanacak; bu ek yalnız dört ve beş arasındaki teknik açığı somutlaştırır. İlk kapsam matrisi için gerçek maliyet, eğitimci inceleme kapasitesi, sınıf–ders başına öğrenme çıktıları ve örnek sayıları henüz kararlaştırılmış değildir. Hiç soru üretilmedi, banka yayınlanmadı ve kod değiştirilmedi.
