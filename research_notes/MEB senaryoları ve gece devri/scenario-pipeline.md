# Güncel senaryo edinme ve GINA entegrasyonu

## 1. Güncel resmî dosya nasıl bulunur ve ne doğrulandı?

### Takeaway
5 Kasım 2026'da ÖDSGM 2026–2027/1 resmî konu-soru dağılım dizini açıldı; matematik kısa bağlantısı canlı XLSX kaynağına kadar izlenip dosya hash'i depodaki kopyayla karşılaştırıldı. Bu tek dosyanın aynı olması, bütün 648 adayın pedagojik veya okul kapsamı onayını sağlamaz.

### Cited Findings
- ÖDSGM dizini 7 Eylül 2026 yayın, 10 Eylül güncelleme tarihi gösteriyor; temel eğitim ve ortaöğretim derslerine ayrı bağlantılar sunuyor. Kaynağın eğitim yılı ve dönemi sayfa başlığında açık. — [Resmî dizin](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724).
- İlköğretim Matematik bağlantısı `https://meb.ai/ankmeb3`, canlı olarak `https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx` adresine yönlendi. Python HTTPS isteğiyle 23.454 bayt, XLSX MIME ve SHA-256 `d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf` doğrulandı; yerel manifest ile aynı. Web okuma aracı XLSX'i parse edemedi; bu sınırlama HTTPS indirme/hash kontrolüyle aşıldı. — [Resmî dosya](https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx); [yerel kaynak kaydı](../../docs/learning/catalog/2026-2027-term1/sources/manifest.json).
- Depodaki bu kaynak için `5.sınıf` sayfası `D6` başlığı Senaryo 1 / 1. Dönem 1. Ortak Yazılı; `D7:D13` birer soru, `C7:C13` MAT.5.3.1–MAT.5.3.7; toplam 7. Bunlar aynı hash'e sahip kaynaktan ayrılmış aday verileridir. Senaryonun okul tarafından seçildiği varsayılmaz. — [aday veri](../../docs/learning/catalog/2026-2027-term1/scenario-candidates.json).
- Program sayfası MAT.5.3.1–7 için geometrik çizim, araç kullanımı, yansıtma, açı/çokgen ve çemberlerden üçgen muhakemesini tanımlar. Yalnız bir kod etiketlemek, sorunun bu beceriyi gerçekten ölçtüğünü kanıtlamaz. — [TYMM 5. sınıf geometri](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3).

### Inferences
- Ürün kararı: `eğitim_yılı → dönem → yazılı_no → sınıf → ders → program/okul kapsamı → senaryo` açık seçim zinciri olmalı. Veli zaten çocuk seçtiyse sınıf/program güvenilir profilden gelsin ama tarihli bağlamla doğrulansın.
- “Güncel” sistemin bugünkü takvim yılına göre değil, hazırlanacak sınavın eğitim yılı/dönemi için en son yayımlanmış uygun revizyon demektir. Yeni sayfa veya dosya yolu gelince yıl/terim uydurarak önceki link değiştirilmez.
- MEB merkezî güncel kapsamının yetkisi başka araştırmacının kurallar notuyla birleştirilmeli. Eski il tablosu sadece daha yerel diye yeni merkezî tablonun otomatik önüne geçirilmez. Okulun seçtiği senaryo ayrıca beyan/kaynakla teyit edilir.

### Gaps
- Diğer 15 dosya bu araştırmada yeniden indirilmedi. Bütün adayların güncelliği/onayı ileri sürülemez.
- Kamuya açık bu dağılım dosyası, kapalı öğretmen soru havuzu veya okulun gizli sınav soruları değildir. OYSS öğretmen oturumuna veya yayımlanmamış sorulara erişim istenmedi.

## 2. GINA'da mevcut olan nedir, hangi gerçek açık işler kalmıştır?

### Takeaway
Eski OUTCOME-INDEX metninde entegrasyon açık yazsa da sonraki kod katalog inceleme/yayın → aile seçimi → sabit senaryo kopyası → AI üretim bağını zaten içeriyor. Claude bunu yeniden kurmamalı; canlı yayın/veri durumunu ayrıca doğrulayıp güncel kaynak edinme ve anlamsal soru kalite kapılarını tamamlamalı.

### Cited Findings
- Yerel JSON gerçek sayımları: 62 sınıf/ders grubu, 648 senaryo adayı, 708 çıktı adayı; 17 senaryo uyarısı, 4 kodsuz yönerge, 6 metin varyantı. `outcome-index.json` publishable=false; bütün adaylar kaynak inceleme gerektiriyor. — [aday dizin açıklaması](../../docs/learning/catalog/2026-2027-term1/OUTCOME-INDEX.md); [dizin verisi](../../docs/learning/catalog/2026-2027-term1/outcome-index.json).
- XLSX çıkarıcı ZIP/XML kullanıyor; formül çalıştırmıyor, dış workbook linklerini takip etmiyor, açılmış dosya boyutuna sınır koyuyor ve manifest hash eşleşmesini şart koşuyor. Birleşik hücredeki bir soru sayısını her çıktı için çoğaltmıyor. — [extract-meb-scenarios.py](../../scripts/extract-meb-scenarios.py).
- Yönetim `draft → reviewed → published → withdrawn` ayrı aşamalar; program/okul kapsamı, kaynak/adet/uygulanabilirlik kontrolü mevcut. İçe alma ve tekrar koruması bulunuyor. — [curriculum-review.ts](../../packages/core/src/curriculum-review.ts); [yönetim arayüzü](../../apps/backoffice/src/components/curriculum-review.tsx); [078000 migration](../../supabase/migrations/20261103078000_curriculum_source_review.sql).
- Aile API'si yayımlı ve etkin katalog içinden çocuğun sınıfı + yıl/dönem/yazılı/dersi filtreliyor. `save_catalog_blueprint` açık okul doğrulaması, revision, yetki, idempotency ve aile/çocuk için dondurulmuş özel senaryo bağı kullanıyor. — [079000 migration](../../supabase/migrations/20261103079000_catalogue_family_selection.sql); [aile seçimi](../../packages/core/src/catalog-blueprint.ts); [mobil katalog](../../apps/mobile/src/app/parent/prova/catalog.tsx).
- AI katalog bağı çağıranın JSON beyanından değil özel sunucu bağından okunuyor. Tam çıktı metinleri, ortak bloklar ve toplam kontrol ediliyor; `officially_verified:false` ve özgün çalışma taslağı anlatımı korunuyor. — [catalogue-plan.ts](../../supabase/functions/_shared/catalogue-plan.ts); [prova-generate](../../supabase/functions/prova-generate/index.ts).
- Çıktı doğrulayıcı toplam soru sayısı, blok başına soru sayısı, topic üyeliği, istenen tür, soru/çözüm/beklenen cevabın varlığı ve çoktan seçmeli biçimini denetliyor. Her soruya blueprintSnapshot, senaryo kodu, model/prompt sürümü/hash, draft scope ve varsa belge hash'i provenance olarak kaydediliyor. Soru başına ayrı `outcome_ids`, puan rubriği üzerinden anlamsal doğrulama burada görünmüyor; bloğa topic ataması semantik uygunluk kanıtı değildir. — [generation-result.ts](../../supabase/functions/_shared/generation-result.ts).
- Eski yönetim kanıtı dosya hash'inin içe aktarmada dış web üzerinden yeniden indirilmediğini açıkça belirtiyor; editör karşılaştırması bekleniyor. Testte 648 kayıt taslak içe alınmış, işlem geri çevrilmiş; bu üretime yayın/onay değildir. — [inceleme kanıtı](../../docs/design/screens/curriculum-review/README.md).

### Inferences
Somut kalan geliştirme:
1. Mevcut katalogya bağlı bir kaynak edinme işi: resmî dizini bul, uygun ders dosyasını indir, orijinal/dönüş URL zinciri + retrieved_at + last_checked_at + yayın/güncelleme tarihi + MIME/boyut/SHA-256 kaydet. İlk prototip için tüm web kazıyıcı motorunu baştan kurma.
2. Bilinen aynı hash kaynağı yeniden adaylaştırma/AI çağrısı/kota tüketimi doğurmasın. Dosya değişirse yeni kaynak revizyonu ve fark incelemesi açılsın; eski yayımlı senaryo ve atanmış sınav snapshot'ı sessizce değişmesin. Kritik yanlışlık varsa yeni üretimi durdur, eski kanıtı koru.
3. Resmî HTTPS host listesi + yönlendirme başına yeniden doğrulama + private IP/loopback reddi + indirme boyutu/süre/MIME/ZIP açılma sınırı. `meb.ai` yalnız resmî dizinden gözlenen link ve doğrulanmış nihai meb.gov.tr/eba.gov.tr hedefiyle; keyfî URL serbestliği yok. Dış belgeler veri, yürütülecek talimat değil.
4. Güncel kaynak kontrolü ağdan yapılamadıysa son onaylı kopyanın tarihi ve “güncellik doğrulanamadı” görünür; farklı yılın dosyası otomatik seçilmez. Kaynak yoksa “serbest çalışma / veli kaynaklı dağılım” açık etiketiyle ayrı yol; “MEB senaryosuna uygun” rozeti yok.
5. Mevcut sunucu bağını genişlet: `scenario_version`, `block_id`, `outcome_ids`, kaynak hücre/sayfa, soru türü, bilişsel talep, puan/ölçüt ve kanıt ilişkisi. Bir soru birden çok çıktıyı ölçebilir; bir senaryo bloğunun sayısı çıktı sayısıyla çarpılmaz. Ortak metin/görsel grubu ayrı kaynak kimliği taşır; sorulara bağlantı verilir, tekrar veri kopyası zorunlu değildir.
6. LLM'e yalnız URL göndermek indirme/okuma değildir. Kaynak doğrulandıktan sonra normalize edilmiş gerçek blok/çıktı metinleri ve gereken ilgili özgün dosya parçaları bağlama konur; AI veri dışı talimatlara uymaz. Sağlayıcının internet erişimi varmış gibi varsayılmaz.
7. Soru sayısı/çıktı ilişkisi yapısal test + gerçek sorunun beklenen beceriyi ölçmesi, tek anlamlılığı, çözüm doğruluğu, rubrik/alternatif cevap, yaş/dil/görsel erişilebilirliği için içerik incelemesi. AI ikinci göz öneri üretir; bağımsız insan pedagojik onayı yerini almış sayılmaz.

### Gaps
- Canlı DB'de 078/079 ve katalog özelliğinin son yayın durumu bu araştırmada sorgulanmadı; eski README dağıtılmadı notları güncel canlı gerçek sayılmamalı.
- `GenerationResult` incelemesi bütün ürün kalite kontrollerinin yokluğunu kanıtlamaz; farklı alt modüllerde mevcut olanlar önce envanterlenmeli. Yeni çıktı eşleme alanları tasarım önerisidir, uygulanmış değildir.

## 3. Kütüphane üretimi ve kabul nasıl bağlanmalı?

### Takeaway
Sınıf/ders başına 20 soru hedefi kütüphane havuz büyüklüğüdür; bir OYSS provanın soru sayısı seçilen senaryonun dağılımından gelir. Her kütüphane sorusunun uygunluğu ve senaryo bağlantısı saklanmalı; tüm 1–12 havuzu OYSS olarak etiketlenmemeli.

### Cited Findings
- Yerel kapsam hedefi 77 sınıf/ders ×20=1.540; mevcut 100 taslak bağımsız yayın onayı anlamına gelmez. Senaryo kataloğu ayrı 62 sınıf/derslik dönemlik aday kümesidir. — [kütüphane kapsamı](../../docs/learning/library-pilot/coverage.json); [senaryo dizini](../../docs/learning/catalog/2026-2027-term1/outcome-index.json).
- 5. sınıf örnek senaryo toplam 7 soru iken ürün pilotu 20 taslaktır; depodaki açıklama da bunları ayırır. — [OUTCOME-INDEX](../../docs/learning/catalog/2026-2027-term1/OUTCOME-INDEX.md).
- Programdaki çalışma kâğıdı/performance örnekleri yazılı sınav kurallarıyla aynı sınav türü değildir. Ürün pratik modundaki farklı soru türlerini OYSS uyumu diye sunmamalı. — [TYMM geometri](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3).

### Inferences
- K01'e ekle: güncel incelenmiş senaryoların çıktı kapsamı haritasından özgün OYSS uyumlu taslakları üret; her soru bir veya birden çok senaryo sürümüne ilişkilendirilsin. Havuzdaki soru tekrarları, yalnız sayı/hedef değişimi veya dekoratif hikâye değişikliğiyle yapay biçimde şişirilmesin.
- Önerilen modlar: “Okulun seçtiği senaryoyla prova” (senaryo veli tarafından doğrulanmış), “Seçilen senaryoyla çalışma” (okul tercihi bilinmiyor), “Konu pekiştirme” (senaryodan bağımsız), “Karma prova” (derslere özgü alt dağılımlar; tek resmî OYSS sınavı iddiası yok).
- GINA resmî öğretmen soru havuzunun aynısını veya gerçek sınavı teslim etmez; indirilmiş kamuya açık dağılıma göre özgün hazırlık üretir. Uygun soru eksikse eksik çıktı/adet açık gösterilir, kullanıcı onaylı AI/manual taslak önerilir; dağılımı bozmadan görünmez başka soru doldurulmaz.
- Önerilen kabul seti: (a) uygun sınıf/ders/yıl/term/exam doğru kaynağa gider; (b) yanlış güncel yıl/eksik dosyada uydurma yok; (c) değişen hash eski sınavı değiştirmez; (d) merged-cell ortak blok toplamı tek sayılır; (e) manuel senaryo `reviewed_catalogue` gibi yükseltilemez; (f) çekilen katalog revizyonu yeni üretimi engeller ama önceki kayıt korunur; (g) her soru/blok/çıktı kanıtı gösterilir; (h) 20 havuzdan 7lik senaryo doğru dağılımla seçilir; (i) ağ tekrarı çift indirme işi/AI ücreti doğurmaz; (j) SSRF, format bozukluğu, zip bomb, prompt injection reddedilir; (k) soru tipi/senaryo değişince uygunluk yeniden hesaplanır; (l) fiziksel veli/çocuk akışında kaynak görüntüleme ve defter rubriği okunur.
- Var olan testleri genişlet: `scripts/test-meb-scenarios.py`, `scripts/test-curriculum-candidates.py`, `scripts/test-curriculum-review.py`, `scripts/test-curriculum-races.py`, `scripts/test-catalogue-selection-races.py`, `supabase/tests/056_curriculum_source_review.test.sql`, `057_catalogue_family_selection.test.sql`, `_shared/catalogue-plan.test.ts`, `_shared/generation-result.test.ts`. Hazırlık: `scripts/prepare-curriculum-review.py`, `scripts/build-curriculum-candidates.py`. Mobil: `apps/mobile/src/app/parent/prova/{catalog,blueprint}.tsx`; birleşik builder'a mevcut akış bağlanır. Yönetim: `apps/backoffice/src/components/curriculum-review.tsx`.

### Gaps
- “Her ders/sınıfın bütün senaryolarını 20 soruyla eksiksiz kapsama” garanti edilemez; çıktı/blok birleşimleri daha fazla içerik isteyebilir. Kapsama matrisi eksiği gösterecek, sayısal hedef kalite/onay yerine geçmeyecek.
- Bu araştırma yeni soru üretmedi, veri kataloğu yayımlamadı veya uygulama kodunu değiştirmedi.
