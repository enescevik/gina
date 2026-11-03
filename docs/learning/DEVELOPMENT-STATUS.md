# GINA öğrenme platformu — geliştirme durumu

2 Kasım 2026. Kullanıcı tüm kapsamın geliştirilmesini onayladı. Bu liste tamamlanma beyanı değil, devam eden işin kaydıdır. İlk bölümler tarihî geliştirme kaydıdır. Güncel durum belgenin sonundaki tarihli eklemelerdedir. TestFlight 0.1.0 (15) yayımlandı; sonraki ortak soru grubu artımı henüz dağıtılmadı.

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
