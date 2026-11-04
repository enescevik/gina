# GINA öğrenme platformu — geliştirme durumu

2 Kasım 2026. Kullanıcı tüm kapsamın geliştirilmesini onayladı. Bu liste tamamlanma beyanı değil, devam eden işin kaydıdır. İlk bölümler tarihî geliştirme kaydıdır. Güncel durum belgenin sonundaki tarihli eklemelerdedir. TestFlight 0.1.0 (17) yayımlandı; ayrıntılar `docs/release/SHARED-DESIGN-17.md`. Aşağıdaki eski “dağıtılmadı” notları kendi tarihindeki durumu gösterir; güncel yeni artım kaydı belgenin sonundadır.

## Bu dalda yapılan, doğrulaması süren

- Veli görev onayından sonra çocuk önbelleğinin de geçersizlenmesi; Realtime rota odağı/yeniden bağlantı uzlaştırması.
- Prova yanıtlarında sıralı, son düzenlemeyi koruyan yazma; soru geçişinde ağ yanıtını beklememe.
- Görev onayında istek makbuzu ve özgün gönderim zamanı kontrolü.
- AI model etkinliği/ayar okuma hatası/çıktı sınırı ve sağlayıcı tokenizer ile giriş sınırı.
- AI değerlendirme/plan için kalıcı iş, kota, eşzamanlılık, oran sınırlama, belirsiz sonuçta otomatik tekrar engeli, geç yanıtları reddeden işlem kimliği.
- Kanıt sorularıyla ayrıntılı Prova raporu; soru/konu referansı doğrulaması.
- Backoffice AI işlem merkezi; sağlayıcı sonucu kontrol edildikten sonra gerekçeli tekrar izni.
- Trivy + pnpm audit, yeni güvenlik CI; upstream geliştirme bağımlılığı uyarıları açık risk kaydında.
- Ayrı ücretli kütüphane tabanı, aileye kopyalama ve aylık kullanım; aileden rızalı soru katkısı, yönetici incelemesi, tekil ödül dönüm noktaları. Yönetici koleksiyon/yayın/inceleme/hak ekranları ve veli katalog/paylaşım akışı eklendi. AI soru, kütüphane ve geçici paket hakları bağlandı; varsayılan ödül kuralı kapalı.

## Tamamlanacak ana iş paketleri

1. Bu değişikliklerin DB/RLS/yarış/idempotency testleri; gerçek telefon/tablet kanıtı ve performans ölçümü.
2. Fotoğraf/PDF kaynağı → veli onayı → taslak → atomik kayıt; ders programı ile başlayıp ödev, ödül/hedef ve sorulara yay.
3. Resim/çizim destekli soru yazarı; özel kaynak ve soru görseli erişim kuralları; PDF kitapçık ve çocuk çözme ekranı desteği.
4. Kütüphane/katkı akışının gerçek cihaz ve uçtan uca kontrolleri; görüntülü soru desteğiyle medya incelemesi. Varsayılan ödül politikası kapalı; operatör etkinleştirecek.
5. Müfredat sürümü ve öğrenme çıktısı; okul yazılısı/konu pratiği/bağlam temelli deneme ayrımı; resmî senaryo ile doğrulama. Her sorunun hikâye/görsel zorunluluğu yok.
6. Toplu denemeler: aynı sürüm/düzey, veli katılım ve sıralama tercihi, takma ad, eşit puan kuralları, sonradan puanlama ve kapsamı sınırlı veli bildirimi. Başka çocuğun kişisel sonuçları açılmaz.
7. Göreve bağlı odak, ödev/ders/kurs ortak planı, tekrar defteri, çanta listesi, gerekçeli veli plan asistanı.
8. Backoffice onaylı görsel dil; feature flags sunucu denetimi; satın alma/erişim/iade farklı durumlar; hesap/cihaz desteği; destek/fikir/SSS.
9. Çok sağlayıcılı doğrulanmış adapterler, model/iş bazında politikalar, anahtar referansları, maliyet/kota/limit; yeni sağlayıcı sırf metin eklenerek çalışıyor gibi gösterilmeyecek.
10. Güvenlik taraması, kapsamlı yetki/iş kuralı testleri, kod temizliği; incelenebilir PR ve en son TestFlight.

## Mevcut sınırlar

- AI provider şu an Anthropic; kaydı bulunmayan veya pasif model çalıştırılmaz. Yeni sağlayıcı adapteri henüz yok.
- Soru üretimi earned AI credits ile çalışır; 18 işlem testi, kütüphane/katkı için 30 yetki/tekrar testi geçti. Üretim sağlayıcısıyla yeni uçtan uca çağrı ve fiziksel cihaz testi henüz yapılmadı.
- Daha eski tasarım adayları/untracked varlıklar korunuyor. Yerel asıl veritabanı sıfırlanmıyor; migration testleri ayrı `gina_release13_audit` üzerinde.

## 2 Kasım doğrulama kaydı

- İzole veritabanında 25 SQL dosyasında 423 kontrol geçti; mevcut aile verisi değişmedi.
- Core: 25 test; mobil/backoffice tip kontrolü ve lint geçti. Backoffice statik üretim derlemesi geçti.
- Kütüphane yönetim ekranı gerçek uygulama kodundan, yalnız sentetik verili yerel önizlemede incelendi. Bu, üretim yetkilendirmesi veya iPhone performans ölçümü değildir.
- Soru üretiminde sağlayıcı sonucu kayıt öncesi saklanır; lease, kalıcı kota tahsisi ve belirsiz sonuç uzlaştırması eklendi.

## Görselli soru ve özel kaynak eklemesi

- Fotoğraf seçimi ve çizim → yerel önizleme → açıklama ve ayrı saklama onayı → doğrulanan özel kaynak → soru ile tek işlemde kayıt eklendi. Aynı istek makbuzu tekrarında ikinci soru oluşmaz.
- En fazla üç soru görseli; görüntüler yerelde 1600 px sınırında hazırlanır, fotoğraf metadata'sı işlem kopyasına taşınmaz. JPG/PNG 4 MB, PDF 10 MB ve en fazla beş sayfa. Sunucu tür/ölçü/sayfa/hash kontrolü yapar; bu bir antivirüs veya tam görüntü decoder taraması değildir.
- Çocuk soru ekranı, veli incelemesi ve PDF kitapçıkta görsel desteği eklendi. Veli incelemesindeki medya listesi tek istekte alınır. PDF, süreli bağlantıya bağlı kalmadan resim bytes'larını içerir.
- AI'a görsel gönderimi özel depolama onayından ayrı tutulur. Her kaynak/veli/değerlendirme için onay kaydı vardır. Okunamayan görsel puan=0'a çevrilmez; açık gerekçeyle puanlanmadan bırakılabilir.
- Silinen kaynakların nesne temizliği kalıcı kuyruk + saatlik görevle yapılır. İki saat geçerli yükleme bağlantıları için silme kaydı üç saat tutulup tekrar temizlenir. Bağlantısız taslaklar 24 saat sonra temizlenir.
- `sources.enabled` varsayılan kapalıdır. Yayında açmadan önce private bucket, iki Edge function, SOURCE_CLEANUP_SECRET + aynı Vault değeri, Vault project_url ve saatlik temizleme görevi doğrulanmalıdır. Bu değişiklikler henüz üretime uygulanmadı.
- Telefon 390×844 ve tablet 1280×800 web önizlemesi sentetik API ile incelendi. Çizim → PNG → soru önizlemesi ve geri alma denendi. İlk çizgideki web modal odak kaybı, tuvalin odak almasıyla giderildi. Bunlar fiziksel iPhone/iPad veya gerçek Storage uçtan uca testi değildir. Kanıtlar `previews/question-image-phone-fixture.png`, `previews/question-drawing-tablet-fixture.png`; tarayıcı dili İngilizce, Türkçe metinler i18n içinde.
- Görselli kütüphane katkısının bağımsız medya kopyası ve moderasyonu henüz tamamlanmadığı için sunucu bu katkıyı açık hata ile engeller; metni görselsiz kabul edip yayınlamaz. Fotoğraf/PDF’den program çıkarma eklemesinin durumu aşağıdaki bölümde ayrıca kaydedildi.

## Deneme veri sınırı düzeltmesi

- Aileye ait deneme satırı tek başına yeterli yetki kontrolü değildi: question_ids dizisi başka ailenin soru kimliklerini taşıyabiliyordu. Deneme/çocuk/senaryo/soru bağları artık sunucuda doğrulanıyor. Tekrarlı soru kimliği engellenir.
- Eski hatalı satırlar için de çocuk soru okuma, görsel okuma, deneme başlatma ve AI soru çekiminde ayrı korumalar var.
- Başlamış denemenin soru listesi, çocuğu ve temel koşulları; kullanılmış sorunun metni/cevabı değiştirilemez. Atanmış soruyu silerek sonuçları bozmak engellenir; aile hesabının silinmesi korunur.
- Bu, veri sızıntısı yaşandığı iddiası değil; izole testlerle doğrulanan bir yetkilendirme eksikliğinin düzeltmesidir. Üretim incelemesi ve dağıtım henüz yapılmadı.

## Belgeden ders programı — aynı gün eklemesi

- Fotoğraf/PDF → ayrı saklama ve AI paylaşım onayları → özel kaynak doğrulaması → kalıcı AI işi → düzenlenebilir taslak → veli kontrolü → atomik program/kaynak/takvim kaydı uygulandı.
- Gün ve saat okunamıyorsa null kalır. Sayfa numarası doğrulanır; eksik/çakışan saatle kayıt olmaz. Mevcut dersleri koruma varsayılandır; değiştirme etkisi açıkça gösterilir. AI işlemi kendi başına programı değiştirmez.
- İşlem makbuzu kayıp yanıtta aynı revizyonu döndürür. Aynı taslağın ikinci kez uygulanması engellenir. İki düzenleme çakışırsa eski revizyon yeni programı ezmez.
- İlk çıkarım taslakları 7 gün saklanır; ekrandaki kaydedilmemiş düzeltmeler kapanınca kaybolur ve kapanışta açıklanır. Kaydedilen programdan özgün dosya açılabilir; veli dosyayı silerse dersler korunur. Belgesiz yetim yüklemeler için 24 saatlik temizlik sürer.
- `import` ayrı AI işlem politikasıdır: öneri varsayılanı Plus 5/ay, Pro 20/ay, Free kapalı; backoffice’ten ayarlanır. Kaynak genel anahtarı hâlâ kapalı. Üretim dağıtımı/gerçek dosya–Storage–AI uçtan uca testi yapılmadı.
- Önizleme 390×844 ve 1280×800’de sentetik kayıtlı taslakla incelendi: eksik saat tamamlandı, veli kontrol kutusu seçildikten sonra kayıt açıldı. Web checkbox durumunun ekran okuyucuya aktarılması düzeltildi. Kanıtlar `previews/timetable-import-phone-fixture.png` ve `previews/timetable-import-tablet-fixture.png`; fiziksel cihaz testi değildir, tarayıcı dili İngilizcedir.
- Kütüphanenin yönetici soru yazarı açık uçlu ve dört seçenekli soruları destekler; doğru seçenek ve açıklama zorunludur. Sorular önce taslak, incelemeden sonra yayın akışındadır.
- Şema türleri izole, tüm migration’ların uygulanmış olduğu veritabanından yenilendi. SQL NULL kabul eden ödül-paketi parametresi için generator’ın gösteremediği null türü korundu.

Son kontrol: 28 SQL dosyasında 504 kontrol, 46 Edge testi ve 25 core testi geçti. Mobil/backoffice lint ve tip denetimi, 11 Edge giriş noktasının tip denetimi ve backoffice üretim derlemesi geçti. Toplu prova, çok sağlayıcılı AI, destek/SSS ve diğer planlanan iş paketleri henüz tamamlanmadı.


## Birlikte Prova — ilk uygulama

- Yönetici yayımlanmış kütüphaneden aynı sınıf/müfredat sürümüne ait 3–50 çoktan seçmeli soruyla sabit bir ortak prova oluşturabilir. İlk sürüm görselsizdir; gözetimli veya resmî sınav iddiası yoktur. Başlangıç/bitiş, 5–120 dakika, dahil paketler ve aile başına aylık haklar yönetilir. Genel katılım varsayılan kapalıdır.
- Veli katılımı onaylar; takma adla sıralama ayrı, varsayılan seçilmemiş tercihtir. Sonradan açılırken paylaşım tekrar açıklanır; kapatma hemen diğer ailelerin listesinden çıkarır, değişiklik denetim izine yazılır.
- Aynı katılımın tekrarı ikinci deneme veya kota tüketmez. Aile kotası ve 1.000 katılımcı üst sınırı kilit altında kontrol edilir. Atanmış soru/cevap anahtarı/süre sabittir; aile hesabı silme akışı korunur.
- Çocuk mevcut Prova ekranında çözer. Kişisel süre ortak bitişi aşamaz. İptal yeni cevapları durdurur ve katılım hakkını geri açar. Süresi dolan/iptal edilen açık denemeler 5 dakikalık görevle kapanır; tekrar kapanış ikinci sonuç üretmez. Üretimde bu zamanlanmış görevin kurulumu doğrulanmalıdır.
- Sıralama ortak pencere sonunda açılır; doğru sayısı eşitse aynı sıradır, hız avantajı yoktur. İlk 50 ve ailenin kendi sonucu görünür. Gerçek ad/çocuk kimliği paylaşılmaz. Konu düzeyindeki doğru/boş bilgisi yalnız ilgili veliye açılır; birkaç sorudan genel yeterlilik sonucu çıkarılmaz. Ayrıntılı soru/AI incelemesine geçiş vardır.
- Mobil katılım 390×844, sonuç 1280×800 ve backoffice hak formu sentetik web verileriyle incelendi. Önizlemeler `previews/group-*-fixture.png`; gerçek cihaz, gerçek sınav/AI sağlayıcısı ve bildirim teslimi testi değildir.
- Son doğrulama: 29 SQL dosyasında 552 kontrol; mobil/backoffice lint ve tip denetimi, backoffice üretim derlemesi geçti. Üretime dağıtılmadı. Önceki bölümdeki toplu prova “henüz tamamlanmadı” ifadesi bu eklemeyle ilk uygulama düzeyinde ilerledi; üretim kabulü henüz yapılmadı.


## Cevap gecikmesi ve kayıt güvenliği — ikinci kontrol

- Cevap yazımı sunucuda revizyon + istek makbuzu kullanıyor. Kayıp yanıt yeniden denenirken aynı istek önce uzlaştırılır; geç gelen eski yanıt yeni cevabı ezemez. Başka ekrandan değişmiş cevaba eski istemci yazısı açık `answer_changed` hatası verir. Eski uygulamanın yazıları da revizyonu artırır.
- Cevap isteğinde 20 saniyelik ulaşım sınırı var; bu, sunucudaki işlemin geri alındığı varsayımı değildir. Tekrar, aynı makbuzla yapılır. Süreç belirsizken yeni yerel cevap eski isteği atlayamaz.
- Açık uçlu yanıt yazarken 400 ms düzenleme toplama, bitirirken hemen boşaltma; çıkışta kuyruktaki gönderilmemiş cevapları bırakma eklendi. Devam eden ağ isteğinin geri alınacağı vaat edilmez. Kayıt hatası başka sorudayken de yeniden deneme görünür.
- 5 saniyelik sentetik kayıt gecikmesinde seçim + sonraki soru + ekran gözlemi 321 ms içinde tamamlandı; ekranda ikinci soru ve “kaydediliyor” birlikte görüldü. Yazılı cevap sonunda “kaydedildi” durumuna geçti. Bu araçla ölçülen web akışı süresidir, fiziksel iPhone gecikme ölçümü veya üretim performans iddiası değildir. Kanıt: `previews/answer-next-slow-network-phone-fixture.png`.
- Dekoratif SVG düğme zeminindeki `accessible=false` web DOM uyarısı giderildi; native erişilebilirlik ve web `aria-hidden` ayrı ele alındı.
- Veritabanı lintindeki rastgele soru seçimi `STABLE` işaretlemesi `VOLATILE` düzeltildi; program/toplu prova boş dizi ilklemeleri açık türle tanımlandı. İzole DB public şema lintinde hata/uyarı kalmadı.
- 30 SQL dosyasında 567 kontrol, 30 core testi geçti; mobil lint/tip denetimi geçti. Bağımlılık taramasındaki önceden kayıtlı Expo CLI Zod/deepmerge/minimatch/glob bulguları sürüyor. Gerçek cihaz/üretim ve diğer açık iş paketleri tamamlanmış sayılmıyor.


## AI önerilerini birlikte kullanma ve soru araştırması

- Görev, ödül ve çocuk kurulumunda üretilen üç fikrin biri, birkaçı veya tamamı seçilebilir. Seçilen görev/ödüllerin adı, yıldız değeri ve görev günleri ayrı düzenlenir; onayda toplam kayıt sayısı görünür. Seçim yeni AI üretimi değildir. Yeni fikir istemenin ayrı hak kullandığı açıklanır.
- `save_setup_batch` veli/aile kontrolü, istek makbuzu, 1–3 öğe doğrulaması ve tek veritabanı işlemi kullanır. Aynı isteği tekrar göndermek ikinci kayıt oluşturmaz. Son öğe geçersizse veya paket görev sınırına takılırsa önceki öğeler de kaydedilmez. Çocuk kurulumunda mevcut atomik kayıt sürer.
- Üretilen fikirler uygulama oturumunun sorgu önbelleğinde tutulur; sihirbazda geri dönmek otomatik olarak yeni AI çağrısı yapmaz. Bu kalıcı öneri geçmişi değildir; uygulama kapanıp açılmasına dayanıklı geçmiş henüz yok.
- 390×844 telefon ve 1280×800 tablet web önizlemesinde üç öneri seçildi, birinin adı/yıldızı değiştirildi, üçü birlikte onay ekranında görüldü. Geri dönüşte düzenlemeler korundu; seçim ekranında önceki üretim yeniden gösterildi. `previews/ai-suggestions-{phone,tablet}-fixture.png` sentetik API ve İngilizce tarayıcı dilidir; Türkçe metinler i18n içinde. Gerçek veri kaydı, fiziksel cihaz ve sağlayıcı üretimi uçtan uca denenmedi.
- 31 SQL dosyasında 579 kontrol, mobil tür/lint denetimi ve public şema lint geçti. Değişiklik üretime veya TestFlight’a dağıtılmadı.
- OYSS, özgün soru kütüphanesi, ortak kaynaklı sorular, çözüm defteri ve gelişim raporu araştırması `reports/GINA soru ve defter deneyimi.md` içinde. 77 ilk kapsam hücresi × 20 = 1.540 aday hedefi `research_notes/GINA soru ve defter deneyimi/coverage-candidates.json` içinde; üretilen/onaylanan/yayımlanan soru 0. Bu liste bütün seçmeli/alan/sanat/spor derslerini kapsamaz.
- Yerelde tanımlı Anthropic anahtarının salt okunur model listesi kontrolü 401 authentication_error verdi. Anahtar yazdırılmadı; ücretli toplu üretim başlatılmadı. Üretimdeki bağlantının aynı anahtar olduğu varsayılmadı.
- Düzenlenebilir çocuk defteri, kaynak bölgesini kopyalama, sürümlü ortak soru seti, veli çizim/not katmanları ve yeni gelişim raporu bu teslimde uygulanmadı. Araştırma ve öneri, tamamlanmış özellik değildir.


## Canlı hizmet doğrulaması — 2 Kasım, sonraki aşama

- Yerel Anthropic anahtarı 401 döndürürken üretim anahtarı farklıdır. Üretim anahtarı değiştirilmeden sunucuda bağlantı ve sabit yapılandırılmış çıktı testi geçti: claude-sonnet-5-5, 227 giriş/9 çıkış tokeni. Bağımsız sentetik ders programı görsel testi 492/182 tokenle geçti; eksik bitiş saati null kaldı.
- `ai-preflight` yalnız geçici operatör anahtarı + platform JWT kontrolüyle çalışır; anahtar en çok 15 dakikalık kontrol için açılır ve betik sonunda silinir. Genel kullanıcıya veya anonim çağrıya açık değildir. Anahtarlar/belge metinleri/gizli hata gövdeleri yanıta verilmez. Kontrol betiği `scripts/check-ai-connection.py`; 6 olumsuz/olumlu yetki ve çıktı testi var.
- 20261102120000–20261102150000 arası 11 migration üretime uygulandı. prova-generate, prova-grade, prova-plan, setup-suggestions, learning-source, source-cleanup, timetable-import ve delete-account güncel sürümleri dağıtıldı. Mevcut aile kayıtlarına elle müdahale/reset/reseed yapılmadı.
- Private bucket, saatlik source-cleanup ve beş dakikalık settle-group-attempts görevleri doğrulandı. Eksik source_cleanup_secret Vault/Edge eşleştirmesi tamamlandı; gerçek temizleyici çağrısı 200, failed=0 döndürdü. sources.enabled ve cohorts.enabled testlerin sonunda kapalı.
- Gerçek Storage yükleme/indirme byte eşleşmesi ve anonim/public erişim engeli doğrulandı. Silme sonrası önbellekli aynı URL eski cevabı döndürebildi; storage.objects kaydı ayrıca sorgulandı ve test nesnesi kalmadığı doğrulandı. Bu nedenle anlık önbellek temizliği iddia edilmez.
- Gerçek DB üzerinde geçici transaction fixture’ıyla üç görev, makbuz tekrarı, aile sınırı, hak/politika/grup okuma testleri geçti; tamamı rollback edildi. `scripts/learning-production-smoke.sql` mevcut aile/planları güncellemez.
- `scripts/learning-service-smoke.mjs` ile gerçek HTTP/Auth/Storage/AI/DB zinciri ayrıca test edildi: ayrı sentetik hesap ve aile → çocuk → üç görev/makbuz → imzalı görsel yükleme ve doğrulama → AI ders programı → veli düzeltmesini temsil eden eksik saat tamamlama → takvim ve kaynak bağlantısı → yeniden gönderme → özgün belge indirme → normal hesap silme. 9 kontrol geçti. Aynı import iki kez istendi; yalnız bir AI kullanım satırı oluştu (506 giriş/196 çıkış tokeni). Test hesabı/aile/kaynak/nesne silindi, geçici kaynak özelliği eski kapalı konumuna döndü.
- Bunlar gerçek hizmet/API kontrolleridir, telefon/tablet ekran etkileşimi veya native kalem gecikmesi testi değildir. TestFlight gönderilmedi. Şema kopyası alma ilk denemesi CLI geçici oturum çakışmasıyla başarısız oldu; bu girişim dağıtım öncesi yedek alınmış gibi sunulmaz.
- Çocuk çözüm defterinin telefon/tablet görsel yönü kullanıcı tarafından onaylandı: `docs/design/screens/prova-notebook/phone-tablet-approved-v1.png`. Bu görsel bir tasarım maketidir; çalışan defter/kalem veya ortak kaynak özelliği değildir. Uygulama çalışması sıradaki aşamadır.


## Çözüm defteri — tasarım onayı sonrası, 2 Kasım

Kullanıcı `docs/design/screens/prova-notebook/phone-tablet-approved-v1.png` taslağını onayladı. Açık uçlu sorular bu yönde uygulandı: tablette soru/defter yan yana, telefonda Soru/Defter sekmeleri; mevcut mint maskot, krem sayfa, mor kontroller. Gerçek uygulama bileşeninin 390×844 ve 1280×800 web görüntüleri aynı klasörde `*-implemented-web.png` dosyalarıdır; fiziksel iOS ekran görüntüsü değildir.

- Kalem/parmak çizgileri, çizgi silgisi, kutuyla seçme/taşıma, metni düzenleme, matematik işaretleri, geri alma/yineleme, sayfa kaydırma ve %100/%150/%200 yakınlaştırma var. Tek metin/görsel parçası oranını koruyarak büyütülüp küçültülebilir. Kopyalanan parça çözümün üzerine düşmek yerine uygun boş alana yerleşir.
- `answer_document` sürüm 1; sabit 1000×1400 mantıksal sayfada ham çizgi noktaları, metin nesneleri, kaynak kimliği ve normalize kırpma alanı saklanır. İmzalı URL/HTML/SVG belgeye kaydedilmez. Veli incelemesi aynı renderer ile çocuğun defterini gösterir.
- `submit_exam_answer_v3` ve `get_saved_exam_answers_v3`: revizyon, tekrar makbuzu, aile/çocuk/soru sınırı ve süre/bitirme kontrolü. Belirsiz isteğin çizim verisi derin kopyalanır; yeni düzenlemeden önce aynı makbuz uzlaştırılır. Eski istemcilerin cevap uçları korunur. İptal edilmiş ortak provada yalnız defteri değiştiren yazma da reddedilir.
- Kırpma yalnız o soruya bağlı, aileye ait hazır özel kaynağa başvurabilir. Sayfa ve nesne sınırları, boyut, renk, alanlar ve kimlikler sunucuda doğrulanır. Bilinmeyen defter sürümü eski istemcide sessizce boş cevap olarak açılmaz.
- İzole audit veritabanına bağlı gerçek PostgREST ile uygulama ekranında çizim/yazı/görsel kaydı, sayfayı yeniden açma, sorular arası geçiş, kısmi görsel kırpma, silgi, geri alma, yakınlaştırma, taşıma ve boyut değiştirme denendi. Yalnız sentetik QA hesabı/soruları kullanıldı; Auth oturumu yerel test imzası ve görsel sunumu yerel sentetik dosyadır. Bu bir üretim Auth/Storage veya fiziksel kalem testi değildir.
- Kontroller: 32 SQL dosyasında 594 kontrol (grup sınırı son testi dahil), 38 core testi, 56 Edge testi; workspace tip/lint ve iOS JavaScript/Hermes dışa aktarımı geçti. iOS export bir TestFlight derlemesi ya da cihaz testi değildir.
- Üretimde `20261102160000_answer_notebooks` ve `20261102160500_group_notebook_guard` uygulandı; `prova-grade` yeniden dağıtıldı. Bu artımda gerçek aile kayıtları değiştirilmedi. Mobil istemci henüz TestFlight'a gönderilmedi.

### Bu artımın açık sınırları

- Bir kaynağı birden fazla soruya sürümlü bağlama henüz tamamlanmadı; bu artım mevcut tek sorunun görsel/metin parçalarını deftere alır.
- Defter için yerel kalıcı çevrimdışı kuyruk yok. Sunucuya kaydedilmiş çalışma yeniden açılır; bağlantı hatasında kayıt bekler ve çıkış uyarılır. Uygulama zorla kapatılırsa gönderilmemiş yerel düzenleme korunmuş sayılmaz.
- Gerçek Apple Pencil basınç/eğim/avuç içi reddi, Android kalem ve fiziksel cihaz gecikmesi doğrulanmadı. Mevcut çizgiler sabit kalınlıktadır; bu API yüzeyi tam yerel kalem motoru diye sunulmaz.
- Çizimli defter henüz AI'a görüntü olarak aktarılmaz. Veli puanlayabilir; AI, defterin içeriğini görmeden yalnız metin kırıntısını tam cevap gibi değerlendirmesin diye bu cevaplar için otomatik değerlendirme bloke edilir. Ayrı veli not/çizim katmanı ve onaylı AI görsel değerlendirmesi sonraki artımdır.
- Soru havuzunda yeni üretim hâlâ 0. Üretim AI bağlantısı çalışıyor; 20 soru/hücre üretimi müfredat/kaynak sözleşmesi ve inceleme akışından sonra yapılacak.

## 2026-11-02 — Onaylı çözüm defteri düzenine dönüş

Kullanıcının ikinci maket onayı uygulandı. Tablet 35/65 soru/defter ve genişletme, telefon görsel önizlemesi ve Soru/Defter sekmeleri, tek sıra lila araç çubuğu, isteğe bağlı kalem ayarları, Verilenler ekleme düğmeleri ve sabit tablet maskotu tamamlandı. Mevcut revizyon/idempotency ve kayıt korumaları korundu. Gerçek ekranlar ve doğrulama sınırları `docs/design/screens/prova-notebook/refined-v2-review.json` içindedir. Native simülatör bağlantısı bu turda doğrulanamadı; web kontrolleri ve iOS paketleme geçti. TestFlight yükleme durumu ayrıca kaydedilecek.

### TestFlight 15 yayımlandı

`0.1.0 (15)` Apple tarafında `VALID / IN_BETA_TESTING` olarak doğrulandı. Onaylı defter v2 düzeni dahil kaynak commit `dab1f66`. Expo gönderim kuyruğu uzadığından bekleyen gönderim iptali doğrulandı; aynı imzalı IPA Apple altool ile hatasız yüklendi. Yeni anahtar üretilmedi; geçici özel anahtar dosyası silindi. Ayrıntılar ve gerçek cihaz test adımları: `docs/release/NOTEBOOK-15.md`. Bu sürüm yeni ortak kaynak/soru grupları, veli çizim notları veya yeni kütüphane soruları tamamlandı anlamına gelmez. Sonraki artım ortak kaynağın sürümlenmesi ve sınava atanmış içeriğin korunmasıdır.


## 2026-11-02 — Onaylı ortak içerikli soru hazırlama

Kullanıcının telefon/tablet maket onayı uygulandı: Ortak içerik → Sorular → Önizleme. Aynı metin ve en fazla üç özel görselle 2–12 açık uçlu/çoktan seçmeli soru hazırlanabilir. Tablet iki sütun; telefonda açılıp kapanan ortak kaynak. Kaynak çizimi mevcut çizim bileşeniyle eklenir. Aynı sürümden Prova hazırlanabilir; düzenleme yeni soru kimlikleriyle yeni sürüm oluşturur.

- Atama anında soru/cevap/koşul ve görsel bağları kilitlenir; atama ile düzenleme yarışları satır kilitleriyle sıralanır. Atanmış Prova sonraki düzenlemeden etkilenmez. Kayıt ve atama makbuzları tekrar gönderimde ikinci işlem oluşturmaz.
- Çocuk çözümü, çözüm defteri ve veli incelemesi ortak kaynağı ayrı gösterir. Eski okuyucular için tam bağlam soru metninde de korunur. PDF’de ardışık grup sorularının kaynağı bir kez; AI görsel girişinde aynı resim bütün ilgili soru numaralarıyla bir kez gönderilir. Bu, AI çizimli cevap değerlendirmesi değildir.
- 651 SQL testi, dört gerçek eşzamanlı atama/düzenleme/görsel yarışı, 44 core testi, dokuz soru-görseli Edge testi, yedi yayın/metin testi geçti. Workspace lint/tip kontrolü ve iOS JS/Hermes dışa aktarımı geçti. Gerçek PostgREST + izole audit DB ile sürüm kaydı, atama, kayıp cevap/aynı istek tekrarı ve eski Prova içeriği kontrol edildi.
- Web kanıtı ve onaylı tasarım: `docs/design/screens/prova-shared-source/index.html`. Auth ve görsel sunumu sentetik yerel proxy; fiziksel iOS/Android/kalem testi yapılmadı. Test hesabı temizlendi, yalnız bu işin sunucuları durduruldu.
- Üretim migration/Edge dağıtımı yapılmadı; `question_groups.enabled` varsayılan kapalı. TestFlight hâlâ 0.1.0 (15). Dağıtım sırası ve kapsam: `SHARED-QUESTION-SOURCES.md`.
- Kayıtsız taslak kalıcı çevrimdışı saklanmaz; çıkış uyarısı vardır. Ortak/görselli kütüphane katkısı tam bağlamlı moderasyon hazır olana kadar engelli. Yeni kütüphane soru üretimi hâlâ 0. Sıradaki ayrı ekran işi veli inceleme/not katmanı ve çizimli cevabın rızalı AI değerlendirmesidir; önce tasarım onayı gerekir.

## 3 Kasım — destek/fikir/SSS sunucu sözleşmesi

- Aileye özel destek ve fikir kayıtları; durum geçmişi, aileye görünen yanıt ile yalnız operatörün iç notu ayrı. Başka aile ve çocuk cihazı bu yazışmalara erişemez. E-posta/push gönderimi bu artımda yoktur.
- İstek makbuzu kayıp yanıtta aynı kayıt/yanıtı döndürür; eski revizyon diğer velinin/operatörün değişikliğini ezmez. Günlük veli kayıt/mesaj sınırı ve açık yeniden açma adımı vardır. Aile silinince özel mesaj ve makbuzlar da silinir; denetim izi mesaj metnini kopyalamaz.
- `operations_members` süreli ve geri alınabilir dar roller getirir. Destek rolü AI, paket/para veya SSS yayın yetkisi kazanmaz. İçerik rolü destek yazışmalarını okuyamaz. Finans/yayın rol kayıtları henüz finans/yayın eylemlerini açmaz; mevcut genel yönetici API'leri değiştirilmedi. Backoffice giriş/menü entegrasyonu açık.
- SSS taslağı ayrı sürümdür: düzenleme yayımlanmış yanıtı değiştirmez. Aynı sürüm için inceleme → yayın gerekir; yeni taslak eski incelemeyi devralmaz. Metin düz yazı sözleşmesidir, HTML olarak çalıştırılmayacak. Dil/platform alanları ve arşivleme vardır. Özel destek mesajından kendiliğinden SSS üretilmez.
- 70 yeni pgTAP kontrolü; toplam 37 izole SQL dosyasında 821 kontrol geçti. Tüm workspace tür denetimleri geçti. Ekranlar, ek dosya yükleme, gerçek destek operasyonu ve mağaza iade entegrasyonu tamamlanmış değildir. Canlı migration/TestFlight yapılmadı.


## 3 Kasım — onaylı Gelişim ekranı

- Mevcut Prova/Gelişim yolu onaylı krem/mor/mint makete taşındı. Yeni paralel rapor menüsü eklenmedi. 7/30/90 günlük, çocuğa ait sınıf/ders kapsamı; tek çocukta gereksiz Tümü seçimi yok.
- Farklı soru, tekrar ve bekleyen değerlendirme ayrı. Doğru/kısmi/yanlış/boş sütunları gerçek sayılardan çizilir. Bekleyen yanıtlar yanlış sayılmaz. Konular sınıf/program sürümüyle ayrılır; aynı sorunun tekrarı bağımsız gözlem sayılmaz. Eski “zayıf konu” ortalaması bu ekrandan kaldırıldı.
- Konu açılınca en fazla beş kanıt yanıtı görünür; bağlantı doğru deneme ve soruyu açar. Veli notu/puanı veya toplu değerlendirme kaydedilince rapor önbelleği geçersizlenir.
- 390×844, 1280×800 ve 834×1194 gerçek Expo web bileşenlerinde sentetik veriyle görüntü alındı; filtreler, 90 günlük yatay grafik, yanıt bağlantısı, geri dönüş, boş/yükleniyor/503 ve yeniden deneme doğrulandı. Temiz tarayıcı oturumunda açılış/geri dönüş/yenileme geçti. Ölçülen düğmeler en az 48 CSS px; sayfada yatay taşma yok.
- 27 SQL rapor kontrolü, 63 core testi, workspace lint/typecheck geçti. `docs/design/screens/learning-progress/verification.json` sınırları açıklar. Web görüntüsü fiziksel iPad/Pencil, Dynamic Type veya VoiceOver kabulü değildir. Canlı hizmet ve TestFlight dağıtımı yapılmadı.

## 2026-11-03 — onaylı veli Yardım ekranı

- `parent/help`: Türkçe/İngilizce SSS arama, yayımlanmış yazı açılımı, özel aile destek/fikir görüşmeleri; telefon sıralı, tablet yan yana. Menüde Hesap bölümünde tek giriş.
- Yeni talep, yanıt, kapatma/onay ve açık yeniden açma; destek/ebeveyn ve bekleyen taraf ayrımı. Aile görünürlüğü metni, iç notların istemcide de filtrelenmesi. Ek yükleme/otomatik AI yanıtı/yanıt süresi vaadi yok.
- Gönderim önce kullanıcı+aile kapsamlı cihaz deposuna yazılır; ağ sonucu belirsizse yeniden açılışta aynı UUID ve içerikle açık tekrar. SQL reddi kesin başarısızlık sayılır, metin korunur. Çıkışta yerel gönderimler temizlenir, eski nesne geç yazma yapamaz.
- Görünür ekranda 30 sn sorgu yenileme, odak ve ön plana dönüşte tazeleme; yayınlanmamış realtime kanalına güvenilmiyor.
- `docs/design/screens/help/verification.json`: üç ekran boyutu, boş/yükleme/hata, mesaj/yanıt/kapat/aç, kayıp cevap sonrası tek talep, taslak koruma; 67 core testi + tüm tip/lint kontrolleri geçti. Gerçek iOS/Android klavye/ekran okuyucu doğrulaması açık.
- Sentetik SSS/görüşme yalnız QA'da. Üretim SSS yayımlanmadı; operatör ekranı ve destek operasyonu ayrıca tamamlanmalı. Üretim/TestFlight yayını yapılmadı.

## 2026-11-03 — onaylı yönetim Destek merkezi

- `/support` ve `/ideas`: durum/kategori süzme, imleçli 50'li kuyruk, özel görüşme, bağımsız aile yanıtı/ekip notu taslakları, açık gerekçeli yeniden açma. Durumu değişen seçili görüşme kaybolmaz; güncellenen görüşmede eski taslak açık onay olmadan gönderilmez.
- Sınırlı destek rolü kendi başlangıç sayfası ve menüsüne girer. AI/finans/genel admin ekranlarına ayrıcalık kazanmaz. Canlı rol kontrolü 30 sn/odakla yenilenir; her RPC sunucuda tekrar doğrular. Süre/geri alma kontrolleri JWT yenilemeden etkilidir. Başarısız yetki yenilemesi erişimi kapalı tutar.
- Belirsiz gönderim kullanıcı kapsamlı yerel depoda UUID + içerik + görünürlükle korunur; tekrar/güncel sayfa açma aynı makbuzu sorgular. İç not aile yanıtına çevrilemez. Çıkış/rolün kaldırılması yerel özel gönderimi temizler. Henüz gönderilmemiş metin kalıcı taslak değildir; ayrılma uyarısı var. Yetki yenilemesinin geçici ağ hatasında ekran/işlemler gizlenir; kontrol başarıyla yenilenince gönderilmemiş metin korunur. Gerçek yetki iptalinde çalışma alanı kaldırılır.
- 18 yeni SQL kontrolü ve 3 yeni core kontrolü; toplam 70 core testi, workspace lint/typecheck ve Next statik build geçti. Dört ekran boyutu, ayrı taslaklar, klavye sekmeleri, tekrar gönderim, çakışma, durum değişimi, yetki geri alma, boş/hata/yükleme web fixture'ında denendi. Kaynak: `docs/design/screens/support-operator/verification.json`.
- Örnek verili tarayıcı kontrolüdür; fiziksel iPad/Safari ve ekran okuyucu kontrolü açık. Üretim rolü atanmadı, destek mesajı/e-posta gönderilmedi, migration/hosting/TestFlight yayımlanmadı. SSS düzenleme/inceleme/yayın ekranı, finans ve diğer kapsam açık.


## 2026-11-03 — onaylı Yardım yazıları editörü

- `/help-articles`: content rolüne özel liste, dil/platform filtreleri ve imleçli sayfalama; yeni yazı ve sabit kimlik, düz metin düzenleyici/önizleme. Onaylı GINA maketiyle masaüstü ve tablet düzeni uygulandı.
- Taslak ve gerçekten yayımlanan sürüm ayrı okunur. Kaydetme yayını değiştirmez; inceleme, yayımlama, arşiv ayrı gerekçeli adımlardır. Yeni sürüm önceki incelemeyi devralmaz. Aynı operatör inceleyip yayımlayabilir; iki kişili onay iddiası yok.
- Kalıcı ve kullanıcıya özel komut kaydı, aynı istekle belirsiz yayın kurtarma, güncel sürüm/rol kontrolü, taslak ayrılma uyarısı. Sunucu rol iptali UI yetkisinden bağımsızdır.
- 25 yeni SQL kontrolü izole veritabanında geçti; toplam core 73 test, workspace lint/typecheck ve 15 rotalı backoffice üretim derlemesi geçti. Ayrı Chromium bağlamında 17 akış kontrolü; telefon/tablet/masaüstü ve boş/yükleniyor/hata görüntüleri `docs/design/screens/help-article-editor/` altında.
- Sentetik içerik yalnız QA; gerçek yardım yazısı yayımlanmadı, üretim rolü atanmadı, production migration/hosting/TestFlight dağıtımı yapılmadı. Gerçek cihaz ve ekran okuyucu kabulü, gerçek yardım metinlerinin ürün doğruluğu incelemesi ve operasyon kurulumu açık.

## 2026-11-03 — çözüm defteri iOS simülatör kabulü

- Güncel kodla yerel iOS Debug simülatör derlemesi üretildi. iPad Air M4 ve iPhone 17 Pro'da gerçek NotebookWorkspace/NotebookEditor, sentetik soru ile açıldı. Dikey iPad'de soru ve defter birlikte; yazı/sembol/araç menüleri ve açık pencereyle dönüşte otomatik yön döngüsü görülmedi. Çizgi, metin ve kaynak görseli dönüş/genişletmede korundu.
- Kontrolde eklenen yazı/görselin aşağıda kalabildiği bulundu ve düzeltildi: yalnız ekleme sonrası nesne görünür alana getirilir; seçim çubuğunun yerleşimine uyar. Kalem/seçim veya elle kaydırma bunu sonlandırır; çizim sırasında sayfa kaydırılmaz. Nesne koordinatları değişmez.
- 8 yerleşim/modal/görünürlük testi, mobil tip ve lint denetimi geçti. Web'de 4 farklı boyut, 15 araç aç/kapat döngüsü, görünürlük sınırı ve çizim sırasında kaydırma sabitliği doğrulandı. Görüntüler ve kapsam: `docs/design/screens/notebook-device-acceptance/`.
- Bu, gerçek hesap/cevap kaydı/çevrimdışı ağ veya fiziksel Pencil testi değildir. Fiziksel iPad hâlâ 0.1.0 (16); yeni sürüm kurulmadı. Geçici QA rotası dağıtımdan çıkarıldı. Üretim/TestFlight yayımlanmadı. Sonraki ana iş müfredat/kütüphane kapsamı; gerçek cihaz ve yayın kabulü açık kalıyor.

## 3 Kasım — dikey tablette soru kesilmesi

Kopyalama eylemi sabit başlığa taşındı; soru özeti ve tam soru görünümü ayrıldı. Defterin devamı açık yazı ve yukarı/aşağı kontrolleriyle erişilebilir. iPad simülatöründe ve dört web ölçüsünde kontrol edildi. Kanıt ve sınırlar: [görünür içerik kontrolü](../design/screens/notebook-visible-content/README.md). Fiziksel cihaz ve kalıcı cevap kabulü açık; yeni dağıtım yapılmadı.

## 3 Kasım — öğrenme çıktısı aday dizini

Sıradaki müfredat/kütüphane işine geçildi. 648 senaryo 62 sınıf–ders grubu ve 708 çıktı aday kaydına kaynak hücreleri korunarak bağlandı. Dört kodsuz yönerge ve altı bağlama göre değişen metin kaydı incelemeye ayrıldı; mevcut 17 senaryo uyarısı korunuyor. Dokuz doğrulama kontrolü ve CI adımı eklendi. [Dizin ve açık işler](catalog/2026-2027-term1/OUTCOME-INDEX.md). Bu bir soru üretimi/yayın veya tam müfredat kabulü değildir. İlk 20 soruluk içerik pilotu, program sürümü incelemesiyle 5. sınıf Matematik geometri üzerinden ilerleyecek. Canlı katalog/API/AI entegrasyonu açık.

## 3 Kasım — ilk 20 soruluk geometri içerik pilotu

5. sınıf Matematik için 20 özgün açık uçlu taslak, yedi çıktı adayı, sekiz SVG/PNG diyagramı, çözüm ve kısmi puan ölçütleri hazırlandı. Öğrenci projeksiyonu cevap anahtarından ayrıldı; 18 teknik kontrol CI’ye eklendi. Yerel içerik görüntüleyicisi üç web ölçüsünde kontrol edildi. [Paket ve kabul sınırları](library-pilot/grade-5-math/README.md). İnsan editoryal onayı, okul/program sürümü, ortak kaynakları koruyan kütüphane aktarımı ve uygulama testi açık. Üretilen 20 taslak yayımlanmadı; 1.540 hedefinin tamamı değildir. Canlı veritabanı/AI/TestFlight değişikliği yok.

## 3 Kasım — taslak kütüphane paketi kabul sözleşmesi

20 soruluk pilot için çevrimdışı istek hazırlayıcı ve yöneticiye özel atomik aktarım/okuma RPC'leri eklendi. Ortak metin/PNG kaynağı, ayrı öğretmen cevabı/rubriği ve değiştirilemez sürümler birlikte korunur. Tekrar gönderim, aynı anda gelen istekler ve eski sürüme dayalı değişiklik kontrol edildi. 67 SQL kontrolü, üç hazırlayıcı testi, üç gerçek eşzamanlı yarış ve gerçek pilotun geri okuma karşılaştırması geçti. Mobil tip/lint ve 73 core testi geçti. [Sözleşme ve sınırlar](LIBRARY-BUNDLE-IMPORT.md).

Bu, yeni bir yönetim ekranı veya yayın değildir. Taslak seçme/önizleme/inceleme arayüzü, alan editörü onayı, aile paket hakları ve ortak kaynaklı Prova seçimi hâlâ açık. PNG kontrolü yapısaldır; piksel/CRC doğrulaması iddia edilmez. Normal/demo kayıtları değiştirilmedi; gerçek pilot testi geri alındı. Üretim migration, hosting ve TestFlight yayımlanmadı.


## 3 Kasım — onaylı kütüphane taslak inceleme ekranı

Mevcut Kütüphane içine Taslak paketler sekmesi eklendi; koleksiyonlar, aile katkıları ve haklar korundu. Dosya seçimi otomatik yüklemez; doğrulanan ortak metin/PNG, öğrenci görünümü ve ayrı cevap/puanlama önizlenir. Her soru için sürüme bağlı editör sonucu/notu kaydedilir. Düzeltme gerekçesi zorunlu; yeni paket eski onayı devralmaz; inceleme yayın yapmaz.

Bekleyen gönderim kullanıcıya özel IndexedDB'de önce saklanır. Ağ sonucu belirsizse aynı kimlikle tekrar; iki editör çakışırsa yerel not ve güncel kayıt birlikte gösterilir. Yetki 30 sn/odakla yenilenir; her RPC tekrar doğrular. Çıkış/iptalde özel kuyruk temizlenir. Görseller dosya seçimi sırasında tarayıcıda açılarak ve SHA-256/ölçüyle kontrol edilir; bu sunucuda yeniden kodlama hattı değildir.

36 yeni SQL kontrolü, iki yeni gerçek eşzamanlı editör yarışı (toplam beş aktarım/inceleme yarışı), altı yeni core testi (toplam 79), workspace lint/typecheck/test ve 15 rotalı statik build geçti. Dört boyutta 25 tarayıcı kontrolü ve görüntüler: [kütüphane karşılaştırması](../design/screens/library-review/comparison.html). Tarayıcı yanıtları sentetiktir; SQL ayrı izole DB'de denenmiştir. Fiziksel Safari/erişilebilirlik/üretim bağlantısı kabulü, gerçek alan editörü incelemesi, yayın–aile hakkı–Prova seçimi açık. Üretim, hosting ve TestFlight dağıtılmadı.


## 3 Kasım — onaylı kütüphane yayın ekranı

Taslak paketten ayrı yayın ayarları, Ücretsiz/Plus/Pro kapsamı, aile katalog kartı önizlemesi ve açık onay uygulandı. Bütün soruların güncel uygun incelemesi ve sunucuda doğrulanan PNG kaynakları zorunlu. İnceleme/sürüm değişikliği eski yayını geçersizleştirir; kayıp cevap aynı işlem kimliğiyle kurtarılır. Gerekçeli arşiv ve yetki iptalinde özel verilerin temizlenmesi var.

38 SQL kontrolü, 11 Edge testi, toplam sekiz gerçek eşzamanlı yarış; 81 core testi, workspace ve 16 rotalı build geçti. Dört boyutta 22 yayın akışı kontrolü ve eski inceleme ekranında 19 regresyon kontrolü geçti. Gerçek pilotun sekiz görseli yeniden kodlandı; tüm RGBA pikselleri ve ölçüleri bağımsız karşılaştırmada aynı kaldı. [Karşılaştırma ve kabul](../design/screens/library-publication/comparison.html).

Yeni paketlerin aile erişimi varsayılan kapalıdır. Aile edinimi, aylık kota tüketimi ve ortak kaynakları koruyan Prova seçimi tamamlanmadı. Pilot gerçek editörce incelenmedi/yayımlanmadı; kalan 1.520 taslak açık. Ekran testleri sentetik API yanıtlarıdır; üretim uçtan uca ve fiziksel Safari/iPad kabulü açık. Normal/demo kayıtları, üretim migration/hosting/Edge/TestFlight değişmedi.


## 3 Kasım — yayın ekranının görsel sadakat düzeltmesi

Kullanıcı uyarısıyla ilk yayın ekranının onaylı makete birebir uymadığı kabul edildi. Başlık sırası, ikonlar, çerçeveli kontrol satırları, kart/form boşlukları, tablet başlığı ve mor eylem düğmesi referansa göre düzeltildi. Eski/güncel görüntüler karşılaştırmada saklanır. Açık yayın onayı ve kapalı erişim bilgisi korunur; sunucu/veri işleyişi değişmedi. 22 yayın akışı kontrolü, dört boyut ve referansa yakın masaüstü ölçüsü kontrol edildi. Görsel eşleşme ile işlev kabulü ayrı; piksel eşitliği iddiası yok. Yayın/TestFlight yapılmadı.


## 3 Kasım — aile paket edinimi ve Prova taslağı

İncelenmiş/yayımlanmış paketlerin sınıf ve ders kapsamına göre seçilmesi, ortak kaynakların grup olarak korunması, aileye değişmez kopya, aylık/ek hak tüketimi ve mevcut Prova taslağına atomik ekleme tamamlandı. Çoklu seçim desteklenir. Tekrar edinim ücretsiz; kayıp yanıt cihazda saklanan aynı işlem kimliğiyle kurtarılır. Eski katalogla ortak kota kilidi ve öğretmen/çocuk veri ayrımı korunur. Paket görselleri mevcut soru/defter/kitapçık/AI erişim yollarına bağlandı; AI paylaşım rızası atlanmaz.

[Görüntüler, kapsam ve açık kabul işleri](../design/screens/library-family-access/README.md). Yeni migration ve uygulama değişikliği henüz üretime/TestFlight'a gönderilmedi. Kütüphane genel açılış anahtarı kapalı; 20 soruluk pilot gerçek alan editörü onayı bekliyor, kalan 1520 taslak ve üretim uçtan uca/gerçek cihaz kabulü açık. Web/backoffice Cloudflare yayını için bağlantı bilgileri hâlâ eksik. Bu artım, önceki “aile edinimi tamamlanmadı” kaydını geliştirme düzeyinde ilerletir; canlı içerik kabulünü tamamlanmış saymaz.

Doğrulama: 43 SQL dosyasında 1042 kontrol (36 yeni), üç eşzamanlı edinim/kota yarışı, 81 core testi, 17 medya/render testi ve workspace tip/lint geçti. Telefon ve iki tablet boyutunda 10 sentetik tarayıcı kontrolü geçti.

## 3 Kasım — Fen Bilimleri havuzu ve gerçek dosya kapsamı

5. sınıf Fen Bilimleri için ilk ünitenin üç güncel çıktı adayına bağlı 20 özgün açık uçlu taslak, dört özgün şema ve iki ortak metin kaynağı hazırlandı. Cevap, çözüm, kısmi puan, olası yanılgı ve sonraki adım öğretmen projeksiyonunda; öğrenci çıktısı ayrıdır. Dört evre kartı telefon için iki satır düzenlendi. Bu bir yeni uygulama ekranı değildir.

Hazırlayıcı artık kayıtlı Fen taslak profilini ve görselsiz ortak metni koruyor. Matematik pilotunun özel geometrik kontrolleri korunuyor. 20 yeni teknik test, 18 Matematik regresyon testi ve üç hazırlayıcı testi geçti. Tam Fen paketi ayrı geçici veritabanına aktarılıp tüm soru/cevap/meta veri ve PNG baytları birebir geri okundu; aynı istek tekrarında ikinci paket oluşmadı. İşlem geri alındı, test veritabanı silindi. Normal/demo/üretim verisi değişmedi.

[Kapsam kaydı](library-pilot/coverage.json) gerçek pilot dosyalarından hesaplanır: **40 taslak, 0 alan editörü onaylı, 0 yayımlanmış; hedefe göre 1500 taslak açık**. Önceki 20/1520 kayıtları tarihîdir. Soru sayısı yıllık ders kapsamı veya resmî senaryo kabulü değildir. [Fen paketi, kaynaklar ve açık kabul işleri](library-pilot/grade-5-science/README.md). TestFlight 17 değişmedi; içerik yayımlanmadı.

## Göreve bağlı odak sayacı — 3 Kasım, kapsam tamamlama

- Mevcut çocuk görev ayrıntısında isteğe bağlı 5/10/15/25 dakika; duraklat/devam, 5 dakika mola, erken bitirme onayı.
- Cihazda hesap/aile/çocuk/gün kapsamında tek sayaç. Yeniden açılış, arka plan zamanı, eski yazıcı/çakışma ve kayıt hatası koruması. Süre dolması görev, yıldız veya gelişim kaydı yazmaz.
- 11 yeni çekirdek kontrolü; toplam 92 test, mobil typecheck/lint; telefon/tablet gerçek web bileşeni kontrolleri. Kanıt: docs/design/screens/task-focus/.
- Native arka plan/ekran okuyucu kabulü açık; cihazlar arası süre eşitlemesi yok; henüz dağıtılmadı.
- Üst planın eski yayın/kütüphane satırları düzeltildi: TestFlight 17; PR79 aile edinimi hazır fakat 050000 canlıda değil; PR80 sonrası 40 taslak, 1.500 eksik, editör onaylı/yayımlı 0. Sonraki açık işler planın tablosunda.

## İncelenmiş yanıtlardan tekrar — 3 Kasım

- Birleşik Prova'nın Kütüphane seçimine tekrar önerileri eklendi. Sunucuda taslak/aile/çocuk/sınıf/ders sınırı; son 90 gün, son yanıt. Yanlış şıklı ve veli puanlı eksik/kısmi açık uçlular; AI-only ve bekleyenler hariç.
- Ortak kaynak bütünlüğü, etkilenen/eklenen soru sayısı ayrımı, önceki yanıta geçiş ve mevcut sürümlü taslağa ekleme. Otomatik atama veya gelişim/başarı iddiası yok. En güncel 50 birim; aralıklı tekrar takvimi henüz yok.
- 27 yeni SQL kontrolü; izole veritabanında 44 dosya / 1.069 doğrulama. Gerçek web bileşeninde telefon/tablet seçme-kayıt ve yeniden seçme engeli kontrol edildi. Önceden eklenmiş seçeneklerin düşük kontrastı giderildi.
- Migration 060000 ve mobil değişiklikler henüz canlıda değil. Görseller ve akış sınırları: docs/design/screens/repeat-practice/.

## Takvimde kayıp yanıt, eşzamanlı düzenleme ve aile sınırı

- Odak/tekrar çalışması PR #81 dört CI kontrolü geçerek main'e birleşti (9964cdd); dağıtım değildir.
- Manuel takvim oluşturma/düzenleme/silme tek makbuzlu RPC'ye taşındı. Kayıp cevap cihazda saklanıp aynı anahtarla çözülür; revizyon eski ekranın yeni değişikliği ezmesini önler. Eski doğrudan düzenlemeler de revizyon artırır.
- Etkinlikte başka aileye ait çocuk seçilmesine ilişkin RLS açığı giderildi; RPC de ayrı doğrular. Ders programı yansımaları manuel RPC'den korunur.
- 24 yeni pgTAP, tüm 45 dosyada 1.093 doğrulama; dört gerçek eşzamanlı oturum yarışı. Web'de sunucu kaydından sonra yanıt kaybı + tam yeniden açılış: 2 aynı istek, 1 etkinlik, bekleyen komut temizlendi. Kanıt docs/design/screens/calendar-recovery/.
- 061000 ve yeni uygulama henüz dağıtılmadı. Sonraki plan asistanı → takvim işi bu güvenli yazma temelinden ilerlemeli; toplu plan uygulaması henüz yapılmadı.

## 3 Kasım — çalışma planından takvime açık veli onayı

Çalışma planının önceki “Onayla” düğmesi takvim kaydı üretmiyordu. Mevcut ekran artık önerilen günleri seçme/düzenleme → eklenecekleri ve çakışmaları görme → tek atomik işlemle takvime ekleme akışına sahip. Gözlem ile AI önerisi ayrıldı; onaylı ortak GINA görünümü kullanıldı. Kaynak plan ve gün bağlantısı korunur. Görev, yıldız ve önceki takvim kayıtları değişmez. Takvimde etkinlik açıklaması görünür.

062000 migration: veli/aile/çocuk sınırı, gün tekilliği, plan güncellik kontrolü, arşiv engeli, seçili kayıtların atomik eklenmesi ve aynı istekle kurtarma. 25 yeni SQL kontrolü, 46 dosyada toplam 1.118 kontrol; 100 çekirdek testi; üç gerçek paralel yarış; mobil typecheck/lint geçti. Telefon/tablet web görselleri ve açık sınırlar `docs/design/screens/study-plan-calendar/README.md` içinde. Kayıp yanıt + yeniden açılış kontrolünde aynı iki isteğin sonunda yalnız iki etkinlik var.

**Yayımlanmadı.** Fiziksel cihaz kontrolleri açık. Gün/gece/hava çalışması ertelenmiş kalır. Belge → görev/ödül/hedef, kütüphanenin kalan 1.500 taslağı ve alan incelemesi, müfredat bağlama, toplu Prova kabulü, sağlayıcı/operasyon ve son yayın kontrolleri bu çalışmayla tamamlanmış sayılmaz.

## 3 Kasım — Birlikte Prova kabulünde bulunan düzeltmeler

Katılım hatası açık pencerenin arkasında kalıyordu; görünür alana taşındı. Tek uygun çocuk seçili gelir, iki onay varsayılan kapalı kalır. Zaten katılan çocuğa tekrar katıl düğmesi kaldırıldı. Saatler aile saat diliminde; açık sonuç penceresi yenilenir. Kayıp katılım yanıtında sunucudaki katılım bulunur; sınırsız bekleme yerine 20 saniyelik sonuç kontrolü var.

Bildirim kontrolünde farklı Provaların bekleyen atama/bitiş bildirimleri tek tür altında bastırılıyordu. 063000 aynı bekleyen olayı birleştirip farklı Provaları korur. Görev/haftalık birleştirme kuralı değişmedi. Beş ek bildirim SQL kontrolüyle toplam 46 dosyada 1.123 kontrol geçti. Üç katılım/kota/iptal ve iki bildirim yarışı ayrı geçici DB’lerde geçti. Gerçek web ekranı telefon/tablet kabulü, iki kapalı onay, hata, kayıp yanıt, tek kayıt ve açık sonuç yenilemesini doğruladı.

Açık nokta netleştirildi: toplu Prova hâlâ eski görselsiz çoktan seçmeli koleksiyonları kullanıyor; yeni sürümlü/görselli/ortak kaynaklı paketlerden grup oluşturma bağlantısı yok. Fiziksel cihaz/push teslimi, yeni kütüphane bağı ve içerik kabulü bitmeden genel katılım açılmayacak. Üretim anahtarları değiştirilmedi; migration ve uygulama yayımlanmadı. Kanıt: `docs/design/screens/group-practice-acceptance/README.md`.


## 4 Kasım 2026 — görev/ödül kayıt kurtarma ve AI arıza kabulü

- PR #84 ana dala birleşti: grup katılımı ve ayrı Prova bildirimlerinin kaybı düzeltildi. PR #85 ana dala birleşti: geçersiz token sayısı ve boş/metinsiz sağlayıcı yanıtı reddedilir; 11 yeni arıza testi, toplam 101 Edge testi geçti. Gerçek sağlayıcı arızası veya yeni sağlayıcı adaptörü testi değildir.
- Görev/ödül elle veya çoklu AI seçimi aynı kalıcı kayıt yoluna alındı. Kayıp yanıt sonrası yeniden açılış, özgün komutu tekrarlar; belirsiz işlem çözülmeden seçim değiştirilmez. Hatalı yerel kayıt sessizce silinmez. Sıfır yıldızlı görev ve özgün başlangıç tarihi korunur; ödül en az bir yıldız ister.
- 064000, 12 ek SQL kontrolü (toplam 1.135), 9 yeni çekirdek testi (toplam 109), üç gerçek veritabanı yarışı, telefon/tablet web kabulü ve mobil typecheck/lint geçti. Kanıt: `docs/design/screens/setup-save-recovery/`.
- Üretim/TestFlight değişmedi. Fiziksel cihaz kabulü ve belge kaynaklı görev/ödül/hedef akışları hâlâ açık. Bu maddeler tamamlanan iş olarak sayılmadı.


## 4 Kasım 2026 — toplu Prova ve sürümlü/görselli kütüphane

- 065000: yeni paket kataloğu, yayın sürümü ve inceleme kontrolü, ortak kaynakları bölmeden seçme, medya ve cevap anahtarıyla sabit sürüm oluşturma. Kaynak paketin erişim planı aşılamaz; geri çekilen/incelemesi değişen kaynak yeni katılımı durdurur. Atanmış içerik korunur.
- Aile katılımı aynı görseli bir kez kopyalar; ortak metin/soru sırası korunur. Kütüphane kotası ikinci kez düşülmez. Açık uçlu sorular otomatik sıralamaya sokulmaz; bu ayrı puanlama politikası açık kalır.
- Yönetimde yayın isteği cihazda kalıcı; kayıp yanıt ve tam yeniden açılış aynı işlemle kurtarıldı. Ortak kaynağa bağlı üç soru + bağımsız soru = dört soru, açık uçlu ve izinsiz paket seçenekleri pasif. Kanıtlar: docs/design/screens/group-library-integration/.
- 42 yeni SQL kontrolü ve iki gerçek katılım/yayından kaldırma yarışı geçti; yönetim typecheck/lint/üretim derlemesi geçti. Üretime dağıtılmadı, özellik kapısı açılmadı, gerçek cihaz kabulü açık.

## 4 Kasım 2026 — mağaza bildiriminde doğrulama ve kesinti kurtarma

- PR #87 tüm CI kontrolleriyle main’e birleşti: görselli/ortak kaynaklı kütüphaneden çoktan seçmeli toplu Prova bağlantısı. Üretim hâlâ 17; bu birleşme dağıtım değildir.
- Apple doğrulanmamış bildirim kimliğinin gerçek olayı engellemesi ve Google audience tanımsızken kimliksiz isteğin işlenmesi kapatıldı. Google’da audience + beklenen servis hesabı e-postası zorunlu.
- 070000 migration: platform bazlı olay kimliği, beş dakikalık sahiplik, kesinti/hata sonrası yeniden alma ve eski işleyiciyi dışlayan tamamlanma. Günlük yazma hatası artık başarı sayılmaz; gerçek işlemi yeniden denemesi için sağlayıcıya hata döner.
- 29 taklit sağlayıcı Edge testi, 26 SQL kontrolü ve gerçek DB eşzamanlı teslim/süre dolumu testleri geçti. Gerçek mağaza/sandbox ödeme, canlı operasyon ve cihaz kabulü yapılmadı. Ayrı mağaza olayları ile istemci/uzlaştırmanın abonelik yazım sırası ayrıca ele alınacak; bu teslim tam ödeme sistemi kabulü değildir.

## 4 Kasım 2026 — atomik mağaza aboneliği ve aile eşlemesi

- Bildirim güvenliği PR #88 tüm CI kontrolleriyle main’e birleşti. Üretim/TestFlight değişmedi.
- 071000: satın alma doğrulama, bildirim ve uzlaştırma ortak tek yazma işlemine geçti. Aile sahipliği, canlı üyelik, ürün ve durum sürümü tek kilit altında kontrol edilir; iki aile aynı makbuzu yarışla alamaz.
- Apple imzalı durum tarihi kullanılır; Google API isteği başlangıcı yerel sıralama sağlar (resmî mağaza sürümü değildir). Gecikmiş Google iptal ipucu etkin API durumunu tek başına iptal edemez.
- Google plan değişiminde eski hakkı kapatma ve yeni hakkı açma atomiktir; eski token tekrar geldiğinde canlandırılmaz. Eski token kapatma hatası tüm işlemi geri alır.
- 10 Edge durum testi, 43 SQL kontrolü ve üç gerçek DB yarışı geçti. Canlı mağaza kurulumu, tarihî token uzlaştırması, iade operasyon ekranı, native kabul ve yayın açık.

## 4 Kasım 2026 — finans inceleme görünümü

- PR #89 tüm CI kontrolleriyle main’e birleşti; abonelik yazımları atomik. Henüz üretim/TestFlight dağıtımı yapılmadı.
- 072000 + `/billing`: canlı finans rolüyle aile paketi, mağaza aboneliği, beta/geçici hak kaynağı ve işlenemeyen bildirimler ayrı gösterilir. Aileler ekranındaki paket bağlantısı bu incelemeyi açar; yönetici mevcut geçici hak yönetimine geçebilir.
- Finans rolü tek başına destek/içerik/yönetici yetkisi almaz. Ham makbuz, satın alma tokenı, özel bildirim payload'ı ve ham hata iletilmez. Aile adı/kimliğiyle sınırlı arama; eşleşmeyen bildirimler genel kuyrukta.
- 22 SQL yetki/mahremiyet kontrolü; gerçek yerel Next ekranında masaüstü/tablet, arama/boş sonuç, ağ hatası ve oturum değişmeden yetki iptali kontrolü geçti. Kanıt: docs/design/screens/billing-operations.
- Bu teslim salt okunur incelemedir. Gerçek mağaza iadesi, geçmiş bildirim kurtarma, operatör uzlaştırma eylemi ve canlı kabul hâlâ açık.

## 4 Kasım 2026 — Expo güvenlik istisnasının kaldırılması

- Finans inceleme PR #90 tüm CI kontrolleriyle main’e birleşti.
- Expo 58.0.23 ve uyumlu mevcut modül sürümlerine geçildi; CLI 58.1.19 eski Zod 3 bağımlılığını kaldırıyor. Yüksek önem dereceli bulgu kalmadığı doğrulandı ve süreli istisna CI'dan çıkarıldı.
- iOS/Android/web paket dışa aktarımları, SDK uyumu, mobil/backoffice tip/lint ve 109 çekirdek testi geçti. Yeni yetenek paketi eklenmedi; var olan Metro runtime SDK sürümüne açıkça sabitlendi.
- Kalan orta/düşük araç zinciri bulguları ve native kabul sınırı docs/security/2026-11-04-audit.md içinde. Bu değişiklik yeni imzalı binary gerektirir; TestFlight/üretim dağıtılmadı.

## 4 Kasım 2026 — geçici paket hakkı kayıt kurtarma

- Expo güvenlik PR #91 bütün CI kontrolleriyle main’e birleşti; yüksek önem istisnası kaldırıldı. Üretim değişmedi.
- 073000: yönetici hak verme/sonlandırma aynı kalıcı işlem kimliğiyle tekrar edilebilir. İstek/yük/yönetici eşleşmesi ve canlı yönetici yetkisi denetlenir. Kayıtlar özel şemada; aileler operatör gerekçelerine bu kanaldan erişemez.
- Backoffice belirsiz gönderimi yeniden açılışta bulur; kesin ret dışındaki ağ/yanıt hatasında silmez. Sonlandırma gerekçesi ve mağaza aboneliğinden farkı açık formda. Tablet geniş tablo/tarih alanı kesilmesi giderildi; teknik “komp” metinleri sadeleştirildi.
- 23 yeni SQL, üç gerçek eşzamanlı DB yarışı, toplam 1291 SQL kontrolü ve gerçek Next sentetik kayıp yanıt/yeniden açılış kabulü geçti. Kanıt: docs/design/screens/override-recovery/README.md.
- Eski dağıtılmış istemcinin RPC'leri uyum için kalır; yeni arayüzün güvenli kayıt uç noktasını kullanması gerekir. Para iadesi, mağaza iptali veya canlı dağıtım yapılmadı.

## 4 Kasım 2026 — yönetimden mağaza durumu doğrulama

- Geçici hak güvenliği PR #92 tüm CI kontrolleriyle main’e birleşti.
- 074000 + `iap-operator-reconcile`: canlı finans rolü, gerekçeli/kalıcı istek, saatlik sınır, iki dakikalık iş sahipliği ve atomik durum/sonuç kaydı. Tamamlanmış isteğin tekrarı mağazayı tekrar sorgulamaz; süresi dolmuş eski işleyici yazamaz. Eski bitmemiş işi başka yetkili kişi yeniden kontrol edebilir.
- `/billing` seçilen abonelikte mağazadan kontrol ve geçmiş görünümü eklendi. Başarılı/güncel/değişmedi/başarısız durumlar ayrıdır; eksik mağaza ayarı başarı sayılmaz. Gerçek UI sentetik kayıp yanıt, yeniden açılış, hata ve rol iptali kabulü geçti.
- 31 yeni SQL + dört gerçek DB yarışı + 18 Edge testi; toplam 52 dosya/1322 SQL kontrolü. Backoffice tip/lint/üretim derlemesi ve 109 çekirdek testi geçti. Görseller: docs/design/screens/operator-reconciliation/.
- Bu mevcut bir aboneliğin kontrolüdür; gerçek iade/iptal, henüz bağlanmamış mağaza kaydını keşfetme veya bildirim geçmişini kurtarma değildir. Migration/Edge/UI henüz üretimde değil; TestFlight 17 değişmedi.

## 4 Kasım — belgeden görev/ödül taslakları ve kaynak bağı (075000)

- Görev ve ödül sihirbazları fotoğraf/PDF’den en fazla üç öneri alır; ayrı depolama/AI izinleri, düzenleme, çoklu seçim ve son veli onayı korunur. Hedef seçilen ödülün belgesini gösterir.
- Belge kaydı ve görev/ödül aynı işlemde bağlanır. Aile/durum kontrolü, kilit, tekrar makbuzu ve çocuk belge erişim yasağı test edildi.
- AI isteği gönderilmeden önce cihazda saklanır; sonuç kaybolursa aynı istek geri alınır. Ücretli çalışmanın lease’i bittiğinde yeniden üretim otomatik başlamaz; geç sonuç önceki durumu ezmez.
- 53 SQL dosyasında 1.355 kontrol, dört gerçek eşzamanlılık senaryosu, 116 core ve 23 ilgili Edge kontrolü geçti. Mobil lint/typecheck geçti. Telefon/tablet sentetik uygulama kanıtları: `docs/design/screens/document-setup/`.
- Gerçek belge/model doğruluğu ve fiziksel cihaz kabulü açık; birleşik ödev/ders/kurs planı bu artım değildir. 075000 üretimde yok; TestFlight 17 değişmedi.


## 4 Kasım — okul senaryosu hazırlama ve üretim kapsamı (076000)

- Belge akışı PR #94 CI kontrolleriyle ana dala birleşti; üretim değişmedi.
- Teknik konu/sayı metni, ortak tasarımlı üç adımlı çocuk/ders → dağılım → okul duyurusu kontrolüne dönüştü. Bilinen çocuk sınıfı korunur; yıl/dönem/yazılı kaydedilir. Veli girdisi resmî onay olarak etiketlenmez.
- Kalıcı kayıt komutu kayıp yanıt ve yeniden açılışta aynı kimlikle tekrar edilir. 27 SQL + üç gerçek DB yarışı; toplam 54 dosya/1382 kontrol. 122 core, 11 ilgili Edge, mobil lint/typecheck geçti.
- Birleşik Prova üretimi kaydedilmiş aile taslağına ve güncel çocuk sınıfına bağlanır. Senaryo satırları sessizce kırpılmaz; kapsam soru kökeninde korunur. Telefon/tablet gerçek web kanıtı: docs/design/screens/scenario-preparation/.
- Resmî katalog/alan editörü incelemesi, gerçek AI ve fiziksel cihaz kabulü açık. 076000 henüz dağıtılmadı; TestFlight 17 değişmedi.

## 4 Kasım — görselli/ortak kaynak katkısı

077000 + contribution-submit ile ayrı paylaşım kopyası, bütün grup aktarımı, açık kullanım/mahremiyet onayı, kalıcı gönderim ve yönetici karar kurtarma, soru bazında öğretmen alanları, bağımsız taslak ve ortak/tekil ödül eşikleri uygulandı. Eski görselsiz katkı akışı korundu. Kabul yayın değildir; özellik varsayılan kapalıdır.

Doğrulama: 55 SQL dosyasında 1.435 kontrol (53 yeni), dört gerçek DB yarış senaryosu, core 128 + katkı Edge 8 test; mobil/backoffice lint/tip kontrolü ve backoffice statik derleme geçti. Gerçek bileşenlerle telefon/tablet web kabulü ve kayıp yanıt/yenileme/geri çekme/ret/yetki kaybı kontrolleri `docs/design/screens/contribution-review/README.md` içinde. Bunlar fiziksel cihaz veya üretim kabulü değildir. Migration/Edge/istemciler henüz dağıtılmadı; TestFlight 17 değişmedi. Büyük birleşik fotoğraflar 512 KiB sınırında açıkça reddedilir; otomatik bulanıklaştırma yapılmaz.

## 4 Kasım — senaryo kaynağı inceleme ve katalog yayını

078000 ile 648 kaynak adayının kayıpsız içe alınması, gerekçeli program/okul kapsamı incelemesi, ayrı yayın/geri çekme ve aile çocuğunun sınıfına bağlı salt okuma API’si eklendi. Yeni kütüphane sekmesi onaylı ortak tasarımda; kalıcı karar kurtarma, çakışma uyarısı ve kaynak hücreleri vardır. Genel özellik varsayılan kapalı; hiçbir gerçek aday otomatik onaylanmadı veya yayımlanmadı. Aile seçim ekranı ve AI kapsam bağı sonraki artımdır.

56 SQL dosyasında 1.472 kontrol (37 yeni), üç DB yarışı, 135 core testi, dört hazırlama testi; mobil/backoffice lint/tip ve backoffice üretim derlemesi geçti. 648 taslak izole DB işleminde doğrulandı ve geri alındı. Gerçek bileşenlerle masaüstü/tablet, kayıt/yayın/geri çekme, kayıp yanıt ve eski sürüm/yetki kaybı kabulü: `docs/design/screens/curriculum-review/README.md`. TestFlight/üretim değişmedi; kaynak onayı veya fiziksel cihaz kabulü iddiası yok.


## 4 Kasım — aile katalog seçimi ve AI kaynak sürümü (079000)

İncelenmiş/yayımlanmış kaynaklar çocuk sınıfı, ders, yıl, dönem ve yazılıyla seçilir; veli okul duyurusuyla kapsamı açıkça doğrular. Her çocuk/kaynak sürümü için değiştirilemeyen aile kopyası ve özel sunucu bağı vardır. Genel JSON'a onay bilgisi yazmak kaynak doğrulaması sağlamaz. Bilinen ders adı eşdeğerleri aynı kapsamı bulur; başka ders/sınıf önerilmez.

AI'ya uzun öğrenme çıktıları eksiksiz ve ortak blok soru sayılarıyla gider. Yeni ücretli çağrıdan hemen önce yayımlanmış sürüm, çocuk/sınıf, yazılı taslağı, ders ve sayı kilit altında kontrol edilir. Geri çekme yeni çağrıyı engeller; zaten başlamış/sonucu kaydedilmiş işin kurtarılması ve eski Prova geçmişi korunur. Katalog seçimi tek başına AI hakkı harcamaz.

43 yeni SQL kontrolü (önceki 56 dosya/1472 ile toplam 57 dosya/1515), dört gerçek yarış, 142 core +15 ilgili Edge testi, mobil tip/lint kontrolleri geçti. Gerçek Expo web bileşeni telefon/tablet, kayıp yanıt/yeniden açılış ve kaynak geri çekme kanıtları: `docs/design/screens/catalogue-selection/README.md`. Gerçek kaynaklara editör onayı verilmedi; katalog özelliği kapalı, üretim/TestFlight değişmedi. Gerçek sağlayıcı ve fiziksel cihaz kabulü açık.


## 4 Kasım — kalıcı AI soru üretimi kurtarma (080000)

Ücretli üretimden önce istek cihazda, özgün model/istem/kaynak bağlamı sunucuda saklanır. Kayıp yanıtta veya yeniden açılışta aynı sonuç geri alınır. Kontrol isteği yeni üretim başlatamaz; başlamamış/kesin başarısız isteğin kapatılması sunucu makbuzuyla geç ulaşan çağrıyı da engeller. Çalışan veya sonucu belirsiz iş sessizce temizlenmez. Yeni rezervasyonda taslak sürümü ve güncel çocuk sınıfı kilit altında tekrar kontrol edilir.

Üç sorudan birini veya birkaçını seçmek yeni hak harcamaz; tamamlanan sonuç yeniden açılışta korunur. Tekrarlanan soru/cevap metinleri sadeleştirildi. 36 yeni SQL ile 58 dosyada 1.551 kontrol, dört gerçek DB yarışı, 150 core ve 13 Edge kontrolü, mobil/Edge tip ve mobil lint kabulü geçti. Telefon/tablet sentetik UI, kayıp yanıt/yeniden açılış/çoklu seçim ve başlamamış istek iptali kanıtları: `docs/design/screens/prova-generation-recovery/README.md`. Eski bağlamsız işler tahmin edilerek yeniden çalıştırılmaz; mevcut sorular kütüphanede kalır. Gerçek sağlayıcı/cihaz kabulü ve dağıtım açık; TestFlight 17 değişmedi.


## 4 Kasım — açık uçlu ortak Prova, merkezi inceleme ve özel itiraz (081000)

Yeni paketli ortak Provalar şıklı/açık uçlu soruları birlikte taşıyabilir. Puanlama ağırlıkları ve ayrı cevap inceleme onayı katılım öncesinde görünür. Sabit ölçütler, özgün cevap izi ve canlı yönetici yetkisiyle inceleme; büyütülebilen çözüm defteri; soru bazında özel veli itirazı; değiştirilemeyen inceleme olay geçmişi ve ayrı sonuç yayını uygulandı. Veli kişisel puanı/AI önerisi ortak sıralamayı değiştirmez. Okunamayan cevap puansız bekler; açık itiraz/eksik inceleme kesin sıralamayı durdurur. Eşit toplam puan eşit sıradır.

59 SQL dosyasında 1.609 kontrol (58 yeni), dört gerçek DB yarışı, core 157 test; mobil/backoffice tip/lint ve backoffice üretim derlemesi geçti. Telefon/tablet sentetik UI; kayıp inceleme/itiraz yanıtı, yeniden açılış, ayrı yayın, onay ve çizim büyütme kanıtları `docs/design/screens/cohort-written-review/README.md`. Gerçek aile verisi değiştirilmedi. Özellik/istemciler/migration henüz dağıtılmadı; TestFlight 17 aynı. Sonuç yayını push bağlantısı, gerçek editör/cihaz kabulü ve kontrollü açılış açık.


## 4 Kasım — ortak sonuç yayın bildirimi (082000)

081000 sonuç yayını aile başına tek veli bildirim olayına bağlandı. Bildirim puan/ad/cevap taşımaz; dokununca Birlikte Prova açılır. Prova tercihi ve aktif oturum denetlenir. Açık itiraz, iptal veya eski yayın sürümünün bekleyen bildirimi hedeflenmez. Aynı istek iki olay oluşturmaz; yeni yayın yeni olaydır.

17 yeni SQL (60 dosyada 1.626), iki gerçek yayın yarışı, dört Edge mesaj/mahremiyet testi, Edge tip ve mobil tip/lint geçti. Gerçek APNs/FCM teslimi ve mevcut göndericide cihaz başına kısmi hata kurtarması açık. Migration/Edge/istemci dağıtılmadı; TestFlight 17 değişmedi.


## 4 Kasım — cihaz bazında bildirim kurtarma (083000)

Kısmi başarı diğer cihazın geçici hatasını artık kapatmaz. Her cihaz makbuzu, süreli işlem kimliği, eski yanıt reddi, gecikmeli/en fazla beş tekrar, Retry-After ve yarıda kalmış işi uyandıran zamanlayıcı eklendi. Yeni cihaz anahtarı eski anahtarın hatasıyla silinmez; olay kimliği APNs birleştirmesi ve Android etiketi için kullanılır. Ağ istisnasında ham cihaz adresi/anahtarı kaydedilmez. Eski sahipliksiz göndericinin API/yazma yetkileri kapatıldı; migration ile Edge birlikte yayımlanmalıdır.

31 SQL kontrolü (61 dosya/1.657), üç gerçek DB yarışı ve 20 Edge testi geçti; Edge/core tip kontrolleri tamamlandı. Fiziksel teslim ve sağlayıcı kurulumu, operatörün gerekçeli başarısız gönderim kurtarma ekranı açık. Üretim/TestFlight değişmedi. Yayın sırası ve teslim sınırları: `docs/learning/PUSH-DELIVERY-ACCEPTANCE.md`.


## 4 Kasım — bildirim operasyonu (084000)

Canlı yayın rolüne özel bildirim kuyruğu, gerekçeli yeniden sıraya alma, kayıp yanıt/yeniden açılış kurtarması ve kabul edilmiş cihaz makbuzlarını koruyan işlem tamamlandı. Son 24 saat, kayıt başına iki kurtarma ve operatör başına saatte 20 işlem sınırları sunucudadır. Özel geçmişte önceki sonuç sayıları korunur; cihaz anahtarı ve aile/çocuk kimliği arayüze çıkmaz. Yayın rolü tek başına yönetim girişinde desteklenir.

28 yeni SQL ile 62 dosyada 1.685 kontrol, üç gerçek DB yarışı, 160 core testi, backoffice tip/lint ve 19 sayfalık üretim derlemesi geçti. Masaüstü/tablet/telefon sentetik ekran, kayıp yanıt ve rol iptali kanıtı: `docs/design/screens/push-operations/README.md`. Gerçek mesaj gönderimi, fiziksel teslim veya dağıtım yapılmadı; TestFlight 17 değişmedi.


## 4 Kasım — incelenmiş sorulardan tekrar günleri (085000)

Prova incelemesindeki mevcut çalışma planı alanından açılan soru seçimi → gün/saat/süre → önizleme → takvime ekleme tamamlandı. Güncel sınıf, son 90 gün, veli incelemesi ve daha yeni gözlem sınırı uygulanır. AI-only/boş cevap tekrar gereksinimi sayılmaz. Değiştirilebilir 1/3/7 gün önerisi hiçbir günü kendiliğinden seçmez. Yeni Prova veya puan oluşturulmaz.

Kalıcı kayıt, kaynak imzası, tek plan sınırı, seçilen özgün soru numaraları ve takvimden kaynağa dönüş vardır. Çocuk silme hatırlatmayı aile geneline dönüştürmez; başka çocuğa yeniden atanan etkinlik eski kaynaktan ayrılır. 40 yeni SQL ile 63 dosyada 1.725 kontrol, dört gerçek DB yarışı ve 164 core testi; mobil lint/tip ve core tip kabulü geçti. Gerçek Expo bileşeni telefon/tablet, kayıp yanıt/yeniden açılış, tarih/süre önizleme ve kaynak değişimi kontrolleri: `docs/design/screens/repeat-calendar/README.md`. Üretim/TestFlight değişmedi; fiziksel kabul ve diğer kapsam maddeleri açık.


## 4 Kasım — 6. sınıf Matematik ilk havuzu

Güncel MEB sayılar/istatistik sayfaları ile saklı 2026–2027 kaynak sürümüne bağlı 20 özgün açık uçlu taslak eklendi. Üç özgün şema, bir metin kaynağı, bağımsız cevap/ölçüt/yanılgı/sonraki adım ve öğrenciden gizli cevap alanları vardır. Eski kaynaklarda ters olan 6.1.7/6.1.8 eşlemesi güncel kaynak sırasıyla sabitlendi; okul senaryosu seçilmedi.

22 yeni teknik test, 20 Fen +18 Matematik +3 aktarım regresyonu; gerçek 20 sorunun geçici DB'ye eksiksiz alan/bayt aktarımı ve aynı istekte tek paket kontrolü geçti. Telefon tablo kırpılması giderildi; soru ve cevaplı editör önizlemesi görsel olarak incelendi. Kanıt: `library-pilot/grade-6-math/README.md`. Havuz 60 taslak oldu; 1480 henüz yazılmadı, 0 bağımsız onay/yayın. Gerçek aile verisi, ücretli sağlayıcı ve TestFlight değişmedi. Bu, yıllık müfredat veya fiziksel cihaz kabulü değildir.

## 4 Kasım — elle ders programında kayıp yanıt kurtarma (086000)

Elle kaydın sunucuya ulaşıp yanıtının kaybolması durumunda oluşan belirsiz revizyon çakışması düzeltildi. Veli/aktif çocuk için cihazda kapsamlı kalıcı istek ve sunucuda aynı işlem makbuzu vardır; tekrar kayıt dersleri çoğaltmaz. Yeni program eski makbuzla ezilmez; kullanıcıya güncel sürüm gösterilir. Çocuk takvimindeki üçüncü program eylemi ve çocuğun yapamayacağı etkinlik ekleme yönlendirmesi kaldırıldı. Mevcut onaylı tasarım korundu.

33 yeni SQL (64 dosya/1758), dört gerçek yarış ve 169 core testi; mobil/core tip ve mobil lint kontrolleri geçti. Telefon/tablet gerçek Expo bileşenlerinde sentetik kayıp yanıt, yeniden açılış, daha yeni sürüm ve kesin çakışma kontrolleri tamamlandı. Kanıt: `docs/design/screens/timetable-save-recovery/README.md`. Native/üretim kabulü açık; TestFlight 17 değişmedi. Bu artım tam ödev/ders/kurs planını tamamlamış sayılmaz.


## 4 Kasım — takvimde ortak çanta listesi (087000)

Veli ve aktif çocuk cihazı için çocuk/gün bazında liste eklendi. Program değişince yeniden kontrol, geçmiş günlerde saklı ders görüntüsü, kalıcı kayıt komutu ve aynı istek makbuzu vardır. Telefonda liste önce, tablette ders bağlamı yanında; başka cihazdaki değişiklik taslağı sessizce ezmez. Görev/yıldız/etkinlik oluşturulmaz.

47 yeni SQL (65 dosyada 1805), dört gerçek yarış, 174 core testi; mobil/core tip ve mobil lint kabulü geçti. Gerçek Expo bileşenleriyle sentetik telefon/tablet, kayıp yanıt/yeniden açılış/program değişimi/çakışma/veli kaldırma kontrolleri: `docs/design/screens/school-bag/README.md`. Gerçek aile verisi ve TestFlight 17 değişmedi. Haftalık aile değerlendirmesi, tam ödev/ders/kurs planı ve fiziksel kabul açık.


## 4 Kasım — haftalık AI özetinde aile sınırı ve ücretli işlem kurtarma (088000)

Eksik aile claim'ini hizmet hesabı sayan eski veri yolu kapatıldı; çocuk/başka aile/ayrılmış veli erişimi reddedilir. Model girdisi serbest görev metni/ad/doğum tarihi taşımayan durum sayımlarına indirildi. Aile saat diliminde tamamlanmış son sekiz hafta, sabit girdi/model/istem, ortak kota/işlem sahipliği, kesin sonuçtan tek özet ve belirsiz yanıt kurtarması vardır. Çocuk silme türetilmiş içeriği temizler; geç sonuç geri getiremez ve harcanmış kullanım sıfırlanmaz.

46 yeni SQL ile 66 dosya/1851; dört gerçek yarış ve 17 ilgili Edge testi, Edge/core/backoffice tip ve backoffice lint geçti. Kanıt/sınırlar/yayın sırası: `WEEKLY-SUMMARY-ACCEPTANCE.md`. Gerçek sağlayıcı/cihaz kullanılmadı. Güvenlik düzeltmesi dahil 088000/Edge henüz canlıda değil; TestFlight 17 değişmedi. Haftalık birlikte değerlendirme ekranı ve diğer kapsam açık.


## 4 Kasım — haftalık “Birlikte bakalım”

Veli ana ekranının mevcut özet alanına üç adımlı ortak konuşma akışı eklendi. Onay bekleyen görevler onaylananlardan ayrılır; en çok görev gününü yapan çocuğu seçen örtük sıralama kaldırıldı. Mevcut çocuk filtresi izlenir, sıfır kayıt başarısızlık sayılmaz. Son adım yalnız takvimi açar; otomatik yazma veya AI çağrısı yoktur. Konuşma kaydedilmez.

Core 179 (beş yeni sayım testi), mobil/core tip ve mobil lint; gerçek Expo bileşenlerinde sentetik telefon/tablet, çocuk filtresi/tek çocuk/boş kayıt/adımlar/takvim geçişi ve 48 dp kabulü geçti. Kanıt: `docs/design/screens/family-week-review/README.md`. Onaylı ana ekranın diğer alanları ve maskotu korundu. Native kabul/üretim/TestFlight değişmedi; bu haftalık AI özeti istemcisi veya tüm açık işlerin tamamlanması değildir.


## 4 Kasım — tekil ödev, çalışma ve kurs planı (089000)

Takvimde seçili çocuk için üç adımlı veli planı ve çocuğun küçük adımları işaretlemesi eklendi. Tekil çalışma, günlük tekrar görevlerinden ayrıdır; kendiliğinden onay/yıldız/etkinlik üretmez. Teslimi geçen açık iş korunur, eski işin yeni tamamlanması/arşivi güncel geçmişte bulunur. Kayıtlı özel belge bağlantısı ve kaynak silinince planı koruma vardır. AI ile yapılandırılmış ödev çıkarımı henüz bağlı değildir.

58 yeni SQL (önceki 1851 + 58 = 1909), dört gerçek yarış, core188, mobil/core tip ve mobil lint geçti. Gerçek Expo bileşenlerinde telefon/tablet, kayıp yanıt/yeniden açılış, tekil kayıt, uzak sürüm/taslak koruma ve yön değişimi kabulü tamamlandı. Kanıt: `docs/design/screens/learning-plan/README.md`. Gerçek aile/demo verisi ve TestFlight17 değişmedi; fiziksel kabul/dağıtım ve kalan kapsam açık.


## 4 Kasım — görev gönderiminde kapsam ve eski istek koruması (090000)

İşlem kimliğiyle başka aile satırını döndüren eski kısa yol izole testte doğrulandı ve kapatıldı. Aile/çocuk/görev/gün bağı, yeniden gönderimden sonra da korunan makbuzlar, geri alınmış kaydı geri oluşturmayan tekrar ve onay/geri alma satır kilidi eklendi. Planlanmamış hafta günü sunucuda da reddedilir. Migration eski sürümün önceden kaybettiği işlem kimliklerini yeniden oluşturamaz; eldeki son kimlikleri içeri alır.

27 yeni SQL, toplam 68 dosya/1936 kontrol; altı gerçek eşzamanlılık senaryosu geçti. Kanıt: `TASK-SUBMISSION-ACCEPTANCE.md`. Mobil tasarım, gerçek aile/demo kayıtları ve TestFlight17 değişmedi. Güvenlik düzeltmesi henüz üretimde değildir; yayın ve kalan kapsam kabulü açık.

## 4 Kasım — belgeden tekil çalışma planı (091000)

Fotoğraf/PDF veya kayıtlı özel belge → ayrı AI onayı → kaynak sayfası/uyarı → çoklu seçim → her işi düzenleme → veli kontrolü → atomik kayıt eklendi. Tam olmayan tarihler tamamlanmaz; AI önerisi kendiliğinden ödeve dönüşmez. Sunucudaki sınıf ve değişmez kaynak/model/istem bağlamı kullanılır. Aynı kayıtlı belge/çocuk/dil için ücretli sonuç tekrar kullanılır; seçilmiş madde ikinci kez eklenmez. Kaynak temizliği, ödeve bağlı dosyaları artık korur. Kaynak/çocuk silme geç sonucu engeller; onaylı plan kaynak silinse de kalır.

42 yeni SQL ile 69 dosya/1978 kontrol; beş gerçek DB yarışı, core195, ilgili Edge32, mobil/core tip ve mobil lint geçti. Telefon/tablet, çoklu seçim, yön değiştirme, kayıp yanıt/yeniden açılış ve kesin hata sonrasında taslak koruma kanıtı: `docs/design/screens/learning-plan-import/README.md`. Gerçek sağlayıcı/Storage/cihaz kabulü ve dağıtım açık; TestFlight17 değişmedi. Kütüphane 60 taslak/1480 yazılmamış/0 bağımsız onay/0 yayın; diğer kapsam kapanmış sayılmaz.

## 4 Kasım — tamamlanan haftanın veli AI özeti (092000)

Ana ekrandaki “Birlikte bakalım” alanına son sekiz tamamlanmış haftanın AI özeti bağlandı. Kayıtlı sayımlar/AI yorumları ayrılır; açık veli onayıyla ilk üretim, sonraki açılışlarda salt okuma vardır. Çocuk eşlemesi özel ve sabittir; sıra değişimi yorumu yanlış çocuğa bağlamaz, eski eşlemesiz kayıtlar için ad tahmin edilmez. Paket kapanınca veya son özet kaydı yanıtı kaybolunca hazır iş okunabilir; okuma hak kullanmaz.

34 yeni SQL, toplam 70 dosya/2012; beş gerçek yarış, core206, ilgili Edge18, mobil/core tip, mobil lint ve native metin kontrolü geçti. Telefon/tablet, kayıp yanıt, yeniden açılma, kapalı paket, belirsiz iş ve bağlantı hatası sentetik kabulü: `docs/design/screens/weekly-summary/README.md`. Gerçek AI/içerik/fiziksel cihaz kabulü ve dağıtım açık; TestFlight17 değişmedi. Kütüphane/müfredat, canlı mağaza/push/Storage ve diğer açık kabul işleri kapanmış sayılmaz.

## 4 Kasım — 6. sınıf Fen Bilimleri taslak havuzu

20 özgün açık uçlu soru, beş ortak kaynak, dört özgün SVG/sRGB PNG ve ayrı öğrenci/editör önizlemeleri eklendi. Gezegen sınıflama, tutulma, bileşke kuvvet, deney planı ve nitel sürat/hız karşılaştırması beş resmî çıktı adayına bağlandı. Güncel programın FB.6.2.3 hesabı/grafiği dışarıda bırakan sınırı korundu. Yazılı deney planı gerçek deney performansı sayılmadı.

27 yeni teknik test ile mevcut 22+20+18+3 içerik/aktarım testi, mobil tip/lint ve geçici DB’de tam alan/görsel karşılaştırması geçti. Aynı aktarım tek paket olarak kaldı; test işlemi geri alındı ve klon kaldırıldı. Telefon/doküman önizlemesi `docs/learning/library-pilot/grade-6-science/README.md`. Teknik test alan onayı değildir; fiziksel uygulama ve editör incelemesi açık. Güncel havuz 80 taslak/1460 yazılmamış/0 bağımsız onay/0 yayın. Üretim ve TestFlight17 değişmedi.

## 4 Kasım — 5. sınıf Türkçe taslak havuzu

20 özgün açık uçlu soru, üç kısa metin ve iki özgün SVG/sRGB PNG eklendi. İlk temanın beş çıktı adayına bağlı okuma, görsel yorumlama, söz varlığı, yazma ve noktalama/hece çalışmalarıdır. Aynı kaynaktan sorular birlikte tutulur; alternatif doğru anlatımlara açık puanlama ve yazılı/görsel kanıt sınırları kayıtlıdır. Resmî sınav veya yıllık ders kapsamı değildir.

28 yeni ve 90 mevcut içerik/aktarım kontrolü, mobil tip/lint ve geçici DB’de tam alan/görsel karşılaştırması geçti. İlk aktarımda yakalanan tanınmayan rubric alanları mevcut sözleşmeye uyarlandı; dosya doğrulayıcı aynı hatayı önceden yakalar. Tekrarlanan istek tek paket olarak kaldı; klon temizlendi, onay/yayın oluşturulmadı. Telefon/doküman önizlemeleri: `docs/learning/library-pilot/grade-5-turkish/README.md`. Bağımsız alan/dil ve fiziksel cihaz kabulü açık. Toplam 100 taslak/1440 yazılmamış/0 bağımsız onay/0 yayın. Üretim ve TestFlight17 değişmedi.

## 4 Kasım — kütüphaneyi sona alma ve Prova/görev yenilenmesi (093000)

Kullanıcı yeni kütüphane sorularını en sona aldı; 100 mevcut taslak korunuyor. Çocuk Prova listesi/sayacı yeni atama ve bitirme bildirimlerine bağlandı; mevcut RLS korumalı exams tablosu canlı yayın listesine eklendi. Aynı cihazdaki veli–çocuk liste geçişleri, günlük görev ve yıldız bakiyesi yenilemesi tamamlandı; açık cevap/değerlendirme taslağı ve başlatma RPC’si yenileme dışında tutuldu. Veli ana ekranı görev şablonu değişikliklerini dinler.

Dört gerçek QueryClient testi, izole klonda 71 SQL dosyası/2017 kontrol, mobil tip/lint ve telefon/tablet gerçek Expo bileşenlerinde sentetik WebSocket kabulü geçti. Yeni atama görünmesi, sayaç 1→0→1, görev onayı ve yıldız 0→2 doğrulandı. Kanıt: `docs/design/screens/projection-refresh/README.md`. Canlı bağlantı, fiziksel cihaz, tüm Prova uçtan uca akışları ve diğer yayın işleri açık; üretim/TestFlight17 değişmedi.

## 4 Kasım — Prova cevap ve değerlendirme taslağı denetimi

Gecikmiş cevap okumasının daha yeni kayıt yanıtını ezmesi, kaydedilmiş taslağın daha yeni sunucu cevabını örtmesi ve bağlantı geri geldiğinde açık veli değerlendirmesinin yeniden yüklenmesi düzeltildi. Revizyonlu cevap birleştirme ve yalnız onaylanan taslağı kaldırma eklendi; veli değerlendirmesi açılışta tazelenir, düzenleme sırasında sessizce başka revizyona taşınmaz. Telefon/tablette puanın `/ 100` eki taşmaz.

Altı yeni gerçek QueryClient/cevap durumu kontrolü, core206, mobil/core tip ve mobil lint geçti. Gerçek Expo web bileşenlerinde sentetik kayıp yanıt, iki cevabı yeniden açılışta kurtarma, aynı işlemle tekrar, bitirme, veli puan/geri bildirim kaydı ve çocuk geri bildirimi kabulü tamamlandı. Başka veli revizyonunda taslak korunarak çakışma gösterildi. Kanıt: `docs/design/screens/answer-recovery-audit/README.md`. Fiziksel cihaz/canlı akış ve uygulama tamamen kapandığında kaydedilmemiş veli taslağını kurtarma açık; üretim/TestFlight17 değişmedi. Kütüphane 100 taslak olarak sonda bekliyor.

## 4 Kasım — veli değerlendirmesinde kalıcı taslak ve kayıt kurtarma

Veli puanı, geri bildirimi, ayrı çizim katmanı ve uygulanmış AI kimliği cihazda veli/aile/deneme/soru kapsamında saklanır. Kayıt isteği ağdan önce kalıcılaşır; belirsiz yanıtta özgün işlem/revizyon/cevap imzası ve içerik korunur. Sunucu makbuzu ve cihaz temizliği doğrulanmadan başarı gösterilmez. Eski taslak güncel değerlendirmeye kendiliğinden taşınmaz; ayrı onayla yerel taslağı kaldırıp güncel kayıt açılır. “Taslağı sakla ve çık” ile ara verme ve ayrı silerek çıkma vardır. Hesaptan çıkışta kapsamlı temizlik vardır. Onaylı görünüm korunmuştur.

219 çekirdek testi (13 yeni), 19 ilgili Node kontrolü, mobil/core tip ve mobil lint geçti; gerçek web bileşenlerinde telefon/tablet, yazı/çizim kurtarma, sekmeyi kapatıp yeni sekmede açma, kayıp kayıt yanıtı/tek makbuz, başka veli revizyonu ve cihaz depolama hatası senaryoları geçti. Kanıt: `docs/design/screens/review-draft-recovery/README.md`. Fiziksel işletim sistemi kapanışı/Pencil/disk kabulü ve canlı uçtan uca kabul açık; üretim/TestFlight17 değişmedi. Taslak eşitlemesi veya bulut yedeği değildir. Kütüphane en sonda, 100 taslak korunuyor.


## 4 Kasım — native klavye ve büyük yazı denetimi

Defterde yatay iPad klavyesinin ekleme düğmesini gizlediği bulundu ve düzeltildi: başlık/kapatma ve ekleme sabit, metin/semboller kaydırılabilir. Büyük yazıda çizim alanının aşırı daralması, 1,4+ ölçek için soru/defter sekmeleriyle giderildi. iPad simülatöründe klavye+sembol girişi, modal açıkken yön geçişleri, diğer araçlardan sembole geçiş ve dikey çizim geçti. Kanıt: `docs/design/screens/notebook-keyboard-acceptance/README.md`. Telefonun sekme/sembol denemesi geçti, simülatör klavye menüsü devre dışı olduğundan telefon klavye kabulü açık. Fiziksel cihaz/Pencil, Android, VoiceOver ve canlı hizmet kabulü kapatılmadı. TestFlight değişmedi.


## 4 Kasım — gerçek yerel Auth/PostgREST kabulü ve cevap makbuzu

Boş audit kopyasında gerçek giriş, token hook, anonim cihaz eşleştirme/PIN, tek çocuğa erişim, karma Prova/ortak kaynak, çizimli cevap, veli incelemesi, gelişim raporu, görev onayı ve tekil yıldız akışı geçti. Başka aile erişimi ve iptal edilmiş cihazın eski JWT erişimi reddedildi. Geçici hizmetler/kopya kaldırıldı. Kanıt ve kapsam: `isolated-service-acceptance/README.md`. Fiziksel cihaz, Realtime, Storage/AI ve mağaza kabulü değildir.

Cevap kaydında geçersiz/eski sunucu revizyonunun yerel taslağı temizlemesi engellendi; özgün işlem kimliği tekrar için korunur. 11 yeni test ile core230, mobil/core tip ve mobil lint geçti. Üretim/TestFlight17 değişmedi; kütüphane en sonda bekliyor.


## 4 Kasım — gerçek dosya hizmeti ve canlı belge/AI kabulü

Ayrı bellek dosya sistemli Storage, gerçek Auth/REST ve değişmemiş learning-source Edge ile PNG/PDF özel yükleme, doğrulama, tekrar, erişim sınırları, silme/temizleme ve atanmış soru görseli zinciri geçti. Bozuk hash kabul edilmedi; çocuğa yalnız atanmış sorunun görseli açıldı. Genişletilmiş rapor: `isolated-service-acceptance/storage-verification.json`. Geçici hizmetler/veritabanı kaldırıldı.

Mevcut canlı sürümde yalnız geçici test ailesiyle gerçek PNG→AI→veli düzeltmesi→ders programı/takvim→özgün belge→normal hesap silme geçti. Tek kullanım (506 girdi/157 çıktı token); tekrar ikinci kullanım oluşturmadı, eksik saat uydurulmadı. Test kayıtlarının ve dosyasının kaldırıldığı doğrulandı. Genel özellik anahtarı artık test tarafından değiştirilmez. Kanıt: `isolated-service-acceptance/hosted-import-verification.json`. Bu, henüz yayımlanmamış çalışma planı/haftalık özet Edge sürümleri veya fiziksel cihaz kabulü değildir. TestFlight17/üretim kodu değişmedi; kütüphane sonda bekliyor.


## 4 Kasım — derleme araçlarında güvenlik düzeltmeleri

Glob iptali sonrası devam eden okuma ve minimatch desen çoğalması üreticinin dar düzeltmeleriyle mevcut sürümlere uyarlandı; deepmerge sonucunun prototipini değiştiren anahtar ataması açık veri özelliği yazımıyla kapatıldı. Yeni paket/ana sürüm yok. Ham/paketlenmiş CJS/ESM girişleri korunur; yamalar ve kaynakları `patches/README.md` içinde. Yamasız 7 kontrolün 6’sı başarısızdı; ESM desen testi eklenen yamalı koşum 8/8 geçti.

Dondurulmuş bağımlılık kurulumu, 230 core testi, yedi workspace tip/lint/test işi, Expo sürüm uyumu, iOS/Android/web export ve backoffice üretim derlemesi geçti. İlk public-env eksik export başarısızlığı, sentetik yerel yapılandırmayla düzeltilip yeniden denendi; yayın paketi değildir. Sürüme göre tarama hâlâ 1 düşük/3 orta, 0 yüksek/0 kritik raporlar; bulgular bastırılmadı. ESLint’in minimatch3 sürümünde bildirilen yeni optimizasyon kodu yok; uyumsuz ana sürüme zorlanmadı. Kanıt: `toolchain-security/verification.json`. Tüm güvenlik/performans veya fiziksel kabulün bittiği anlamına gelmez; üretim/TestFlight17 değişmedi.

## 4 Kasım — native süreç kapanışında çocuk/veli taslağı kurtarma

Gerçek mobil journal sarmalayıcıları ve SQLite depolamayla iPad Air M4 ve iPhone17Pro simülatörlerinde uygulama süreci tamamen kapatılıp yeniden açıldı. Çocuk çizim/yazısı, veli puan/not/ayrı çizim/AI kimliği, gönderilmemiş taslaklar ve belirsiz işlemlerin özgün kimlikleri korundu. Bekleyen çocuk isteğinden sonraki düzenleme doğru revizyon sırasıyla işlendi. Yalnız sentetik test kayıtları temizlendi. Kanıt/sınırlar: `docs/design/screens/native-journal-recovery/README.md`.

Veli makbuzunda sıfır ve güvenli tam sayı sınırı dışı revizyonun taslağı silmesi kapatıldı; önce iki hata veren sekiz yeni kontrol ve toplam238 core testi, mobil/core tip ve mobil lint geçti. Ağ yanıtları bu native testte sentetiktir; gerçek hizmet kabulü ayrı rapordadır. Fiziksel Pencil/avuç teması, Android ve gerçek işletim sistemi disk/bellek baskısı kabulü açık; üretim/TestFlight17 değişmedi. Kütüphane en sonda bekliyor.


## 4 Kasım — gerçek canlı yenileme kabulü (094000)

Realtime iç içe null kimliklerin UUID dönüşümünde bütün değişiklik grubunu durdurduğu gerçek hizmetlerle yeniden üretildi ve merkezi claim okumasında düzeltildi. Geçerli kimlik/rol, aile sınırı ve cihaz iptali korundu. Mobil abonelik, socket katılımı yerine veritabanı hazır olayını izler; aradaki kayıtları yeniden okur ve hata halinde yedek yenilemeyi sürdürür.

Auth/REST/Realtime/Storage/Edge birleşik koşumunda 134 kontrol; 72 SQL dosyasında 2035 kontrol; beş hook testi ve mobil tip/lint geçti. Başka aile ve iptal edilmiş cihazın açık bağlantısına satır gitmedi. Kanıt: `isolated-service-acceptance/realtime-verification.json`. Üretim ve TestFlight17 değişmedi; fiziksel cihaz/push/mağaza/diğer AI kabulü açık.


## 4 Kasım — yeni AI özelliklerinde gerçek sağlayıcı kabulü

Haftalık özet, PNG’den ödev/kurs, belgeden görev ve ödül için dört sabit sentetik gerçek üretim geçti; yanlış tarih ve kanıtsız çocuk zorluğu üretilmedi, belge kapsamı korundu. Üretim aile verisine dokunulmadı. Yalnız dar operatör preflight güncellendi; süreli erişim sonunda kaldırıldı. Kanıt/gerçek çıktılar: `ai-feature-acceptance/verification.json`. 34 ilgili Edge ve yedi workspace işi geçti. Yeni ürün uç noktalarının canlı kayıt/kota/yeniden açılışı, fiziksel cihaz ve koordineli yayın açık; TestFlight17 değişmedi.



## 4 Kasım — yönetim ve aile hizmetlerinin birlikte kabulü

Ayrı gerçek destek/içerik girişleriyle talep, özel ekip notu, aileye yanıt, takip, sürümlü SSS taslağı/inceleme/yayın/arşiv ve açık oturumda rol iptali/süre dolması doğrulandı. Önceki Prova/görev/Realtime/Storage zinciri ile tek koşumda toplam192 kontrol geçti. Kanıt: `isolated-service-acceptance/backoffice-verification.json`. Yalnız boş kopyada sentetik kullanıcı/roller; tüm geçici kaynaklar kaldırıldı. Cloudflare, canlı operasyon rolleri, mağaza/push ve fiziksel UI kabulü açık; ürün dağıtımı/TestFlight17 değişmedi.

## 4 Kasım — tarayıcı yayın başlıkları ve yapılandırma

Yönetim kütüphane dosyasındaki PNG doğrulamasını bozan CSP blob engeli gerçek tarayıcıda bulundu ve yalnız görsel izniyle düzeltildi. Web/backoffice derleyicileri public değişkenlere sunucu/oturum anahtarı ve yerel/geçersiz endpoint girmesini reddeder; sekiz kontrol geçti. İki gerçek public yapılandırmalı statik üretim derlemesi ve yayın başlıklarıyla Türkçe telefon/tablet giriş ekranı kontrolü geçti. Kanıt: `docs/release/browser-readiness/README.md`. Cloudflare yayını, oturumlu bütün ekranlar ve gerçek OAuth/e-posta teslimi bu kabulde tamamlanmış sayılmaz.



## 4 Kasım — Android native taslak kabulü ve yayın hazırlığı

Ayrı Expo Debug QA uygulaması Pixel 6 Pro/API33 emülatöründe derlendi. Gerçek SQLite
ile çocuk ve veli taslakları hazırlandı, işletim sistemi süreci kapatıldı ve yeni
süreçte aynı içerik/işlem kimlikleriyle kurtarıldı. Sonraki düzenleme sırası, hatalı
makbuzda koruma ve yalnız sentetik kayıt temizliği geçti. Ekransız emülatör nedeniyle
görsel, kalem, fiziksel cihaz veya mağaza kabulü değildir. Kanıt:
`docs/design/screens/native-journal-recovery/android-verification.json`.

Üretim migration envanteri tekrar okundu: 040000 sonrasında 32 güncelleme bekliyor;
094000'a kadar dry-run geçti, hiçbir migration uygulanmadı. Yayın otomasyonunda
eksik ayarla elle yayın/kısmi kurulum artık hata verir; 12 kontrol ve dört CI geçti.
Güncel kullanıcı adımları `docs/release/RELEASE-COMPLETION-2026-11-04.md` içinde;
eski hesap açma rehberi tarihî olarak işaretlendi. TestFlight17 değişmedi.


## 4 Kasım — AI sonucu ile aile kaydının birlikte kabulü

Gerçek yerel Auth/REST/Realtime/Storage ve değişmemiş ürün Edge işleyicileriyle
haftalık özet, belgeden çalışma planı, görev ve ödül kayıt zinciri tamamlandı.
Tek kota/tek makbuz, yeniden açılış, çoklu seçim, kaynak ilişkisi, çocuk/aile sınırı,
20 saniyelik üretim sınırı ve paket kapanınca hazır özeti okuma dahil toplam
254 kontrol geçti. Sağlayıcı sınırı deterministiktir: dört çağrı, dış bağlantı veya
ücret yok. Gerçek AI içerik kabulü ayrı rapordadır. Kanıt:
`isolated-service-acceptance/ai-pipeline-verification.json`. Tüm geçici kaynaklar
kaldırıldı. Canlı dağıtım/TestFlight17, fiziksel kabul ve diğer açık işler değişmedi.
