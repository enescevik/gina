# Claude ile gece çalışma protokolü

Araştırma tarihi: 5 Kasım 2026. Bu not bir çalışma önerisidir; Claude/Fable oturumu açılmadı, kullanıcı kotası görülmedi ve otomasyon kurulmadı. Aşağıdaki öneriler mevcut `docs/CLAUDE-REMAINING-WORK.md` devrini tamamlar.

## Fable ve abonelik hakkında ne doğrulandı?

### Takeaway
Fable güncel resmî Claude model ailesidir. İlk proje incelemesini Fable ile yapmak mümkündür ancak o hesaptaki erişim ve gerçek çalıştırılan model başlangıçta doğrulanmalıdır; %55 ve 07.00 kullanıcı beyanıdır, doğrulanmış kullanım verisi değildir.

### Cited Findings
- Fable varsayılan model değildir; resmî doküman `/model fable` ile açıkça seçmeyi anlatır. Model seçicide bazı hesaplarda kullanım kredisi gereksinimi gösterilebilir. Alias sağlayıcı ve sürüme göre çözüldüğünden çalıştırılan model kaydedilmeli. — [Model configuration](https://code.claude.com/docs/en/model-config)
- Pro/Max kullanımında oturum ve haftalık limitler; Max/Ultra için ayrı Fable haftalık sınırı bulunabilir. Claude ve Claude Code tüketimi paylaşılır. `ANTHROPIC_API_KEY` ile kimlik doğrulama abonelik yerine API ücretlendirmesine neden olabilir. Dahil aylık API kredileri ile Claude Code uygulama kullanım hakları aynı havuz değildir. — [Use Claude Code with your Pro, Max, or Ultra plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)
- `/usage` abonelik kullanım çubuklarını gösterir. Oturum tokenlarından hesaplanan dolar tahmini abonelik faturası veya kalan dolar karşılığı değildir. Limit mesajı yenilenme zamanını belirtir; genel oturum/hafta limiti ile model ailesi limiti farklıdır. Doküman bazı güncel sürümlerde limit sonrası bekleyip devam etme desteğini de belirtir; erişilen sürümde doğrulanmalıdır. — [Manage costs effectively](https://code.claude.com/docs/en/costs)

### Inferences
- **Öneri:** gece hedefi “%55'i rastgele tüketmek” değil, mevcut abonelik hakkıyla en fazla doğrulanmış iş ve bağımsız kontrol çıkarmak olmalı. Sırf tüketim için tekrar araştırma/test, boş ajan veya düşük değerli dosya üretimi yapılmamalı.
- İlk iş Fable ana incelemesi: güncel repo, devir listesi, Q00 kapsamı, açık PR'lar, üretim durumu, MEB araştırması ve riskleri incelesin. Çıktı: önceki işlerle farklar, önerilen değişiklikler, teknik kararlar, bağımlılık ağı, bu gece gerçekçi hedefler ve başlangıçta sorulacaklar. Erişim varsa bu adım atlanmamalı.
- **Öneri:** Fable incelemesinin gerçekten Fable'dan geldiği, kullanılan model adı/sürümü ve dosya/commit bağlamı ile kaydedilmeli. Başka modelin raporu Fable raporu diye etiketlenmemeli. Erişim yoksa başlangıçta kullanıcıya durum ve izinli alternatif sorulmalı.
- Claude abonelik erişimi için API anahtarının varlığını/değerinin kullanılma durumunu yalnız gizli değer göstermeden kontrol etsin; GINA uygulamasının üretim AI anahtarını silmesin veya değiştirmesin. Abonelik bittiğinde otomatik API/ek kullanım faturası açmasın.

### Gaps
- Kullanıcının planı, gerçek kalan genel/model/oturum kotası ve yenilenme tarihi bu görevde doğrulanmadı. “$200 planın %55'i = $110 harcanabilir API” sonucu çıkarılamaz.
- Başlangıç ortamı Claude masaüstü sohbeti, Claude Code terminali veya başka çalışma yüzeyi olabilir. Araç, arka plan, izin ve oturum sürekliliği yetenekleri başlamadan görülmeli. Prompt tek başına uygulamanın kapalıyken çalışmasını veya kendiliğinden uyanmasını sağlamaz.

## Gece otonom çalışmayı hangi kurallar güvenilir kılar?

### Takeaway
Bağımsız işleri alt ajanlara dağıtmak yararlıdır; izinler, ortak dosya/veritabanı sahipliği, checkpoint ve bütünleştirme sorumluluğu önceden tanımlanmadığında daha fazla ajan ilerlemeyi yavaşlatabilir. Çalışmayı sessizce sürdürmek, bir onay veya erişim engelini aşmak demek değildir.

### Cited Findings
- Alt ajanlar kendi bağlamları ve araç kapsamlarıyla çalışır; kendi istekleri aynı kullanım sınırlarına sayılır. Worktree izolasyonu ve sınırlı araç seçimi desteklenir. Arka plan ajanının izin isteği ana oturuma gelebilir. Resmî dokümandaki eşzamanlılık varsayılanı sürüme bağlıdır; çalışan ortamı kontrol etmeden sınırsız ajan varsayılmamalıdır. — [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- Claude Code izinleri prompt metninden bağımsız uygulanır. Kapsamlı izin kuralları ve mevcutsa `auto` modu kullanılabilir; bu da tüm işlemleri otomatik kabul etmez. `bypassPermissions` üretim hesabına bağlı olağan çalışma ortamı için genel çözüm olarak önerilmez. — [Configure permissions](https://code.claude.com/docs/en/permissions)
- Ajan sayısı ve çalışma süresi token tüketimini artırır; sınırlı ekip, odaklı görev ve biten ajanı durdurma önerilir. — [Manage costs effectively](https://code.claude.com/docs/en/costs)

### Inferences
Aşağıdaki maddeler **GINA'ya özel önerilen protokoldür**, Claude ürününün garanti ettiği davranışlar değildir:

1. **Tek koordinatör:** iş listesi, bağımlılıklar, merge, üretim migration/Edge dağıtımı, yayın sürümleri ve sabah raporu tek ana ajan tarafından yönetilsin. Alt ajanlar aynı canlı veri tabanına paralel yazmasın; sentetik/izole test ortamı kullansın.
2. **Dosya sahipliği:** her görevde ID, kaynak commit, kapsam, yazılabilir dosyalar, dokunulmayacak alanlar ve kabul testleri tanımlansın. Kod yazanlar ayrı worktree/dalda; okuma/araştırma/denetim ajanları salt okunur olabilir. Ortak i18n, şema, lockfile ve migration numaralarını koordinatör sıraya koysun. Ana dal değişirse ilgili ajan yeniden tabanını doğrulasın.
3. **Paralellik:** bağımsız hazır işler oldukça ve ortamın kota/RAM/CPU/CI kapasitesi elverdiği sürece artırılsın. Başlangıç için 2–4 bağımsız işçi makul bir işletim önerisi; bu sayı kullanıcı limiti değildir. Birbirini bekleyen işler veya aynı dosyada çakışma varsa sıraya alınsın. Boşta ajan sırf kota tüketmek için açık kalmasın.
4. **Bağımsız kalite kontrolü:** yazan ajanın dışında bir göz değişiklikleri Q00, yetki, veri korunması ve kabul ölçütleriyle incelesin. Kontrolleri geçmeyen PR merge edilmesin. Onaylı görsel kimlik ve tarihsel veriler korunmalı; değiştirilen UI gerçek uygulamadan telefon/tablet kanıtıyla karşılaştırılmalı.
5. **Takılma sınırı:** aynı engelde örneğin iki anlamlı teşhis/düzeltme denemesinden sonra kanıtı ve sonraki eylemi kaydet; bağımsız sıradaki işe geç. Erişim, ödeme, gerçek cihaz veya içerik uzmanı engelini tekrar tekrar zorlamasın. Açık işin kutusunu kapatmasın. 3B, başka iş bloke diye öne çekilmesin.
6. **Her pakette checkpoint:** `docs/release/overnight-YYYY-MM-DD/PROGRESS.md` önerisi: zaman ve saat dilimi, iş ID'si, dal/worktree/commit, değişen dosyalar, test sonuçları, PR, yayın durumu, açık engeller ve bir sonraki somut adım. Her tamamlanan paket, compaction öncesi ve kota düşerken güncelle; başlıkta tamamlanmamış işlerin tamamlandığı iddiası olmasın.
7. **Süre penceresi:** başlangıçta Europe/Istanbul için tarihli hedefi doğrula. 5 Kasım akşamı başlanıyorsa önerilen pencere 6 Kasım 2026 07.00'a kadardır; kullanıcı başka tarihte başlatırsa otomatik bu tarihi kullanma. 06.30 yeni geniş iş açmayı bırak; çalışan işleri güvenli checkpoint'e getir, test/PR/raporla. 07.00'a kadar ulaşılabilen kapsamı teslim et; bütün backlog'un bir gecede biteceğini vaat etme.
8. **Kota/oturum durursa:** izinli mevcut özelliğin otomatik bekleme/devam desteği başlangıçta doğrulanıp seçilmişse onu kullan. Yoksa checkpoint ve tek satırlık devam talimatı bırak; “arka planda devam ediyorum” deme. API/ücretli ek kullanıma sessiz geçme, güvenlik denetimlerini kapatma veya yeni hesaplarla kota aşma yoluna gitme.
9. **İş sırası:** Fable ön inceleme + başlangıç soruları; R01 acil gizlilik yayını; Q00 inceleme ve bağımsız L/U/P/B/S işleri; uygun test/ara yayın. MEB senaryo entegrasyonu içerik üretiminden ayrı teknik iş olarak öne alınabilir. Kitlesel kütüphane yazılım işlerinden sonra; 3B tüm kalan işlerden ve R02'den sonra.
10. **Sabah çıktısı:** tamamlandı/test edildi/yayımlandı ayrı sütunlar; açık PR ve linkler, gerçek sürümler, görsel kanıtlar, engeller, kullanıcı adımları ve sıradaki öneri. Gerçek kullanıcıya toplu duyuru, satın alma veya yeni ücretli hizmet gibi gece kapsamı dışında kalabilecek işlemler önceden açıklanmadıkça yapılmasın.

### Gaps
- Repo ve alt ajan worktree'leri ayrı olsa da aynı Supabase projesi, CI kotası, dosya servisleri veya işletim sistemi simülatörü paylaşılabilir; bunlar için ayrıca koordinasyon gerekir.
- Uzak cihaz ve yayın sağlayıcılarının gece boyunca erişilebilir olacağı veya oturum/2FA'nın süresinin dolmayacağı garanti edilemez.

## Başlangıçta kullanıcıdan ne istenmeli?

### Takeaway
Fable incelemesi ve yerel erişim kontrolleri bittikten sonra yalnız cevapları gerçekten gerekli bir başlangıç paketi sorulmalı. Önceki kapsam/merge/yayın/alt ajan izinleri yeniden sorulmamalı; önemli yeni harcama veya erişim gerektiğinde kullanıcı daha ayrılmadan somutlaştırılmalı.

### Cited Findings
- İncelenen repo devri; yerel değişiklikleri koruma, mevcut uygulamaları baştan kurmama, PR/test kanıtı, mevcut merge/yayın yetkisi, X01–X06 dış bağımlılıkları ve WORLD-01 en son kuralını zaten içeriyor. — [Mevcut devir listesi](../../docs/CLAUDE-REMAINING-WORK.md)
- Claude Code'da izin ayarları işin hangi araçlarla otomatik ilerleyebileceğini belirler; prompttaki otonomi talimatı tek başına araç izni vermez. — [Configure permissions](https://code.claude.com/docs/en/permissions)

### Inferences
**Claude'un önce kendisinin kontrol edeceği hazırlık:** çalışan uygulama/CLI sürümü ve Fable erişimi; abonelikle oturum, `/usage`; git/main/yerel değişiklikler; GitHub/Cloudflare/Supabase/Expo/Apple oturumlarının ihtiyaç duyulan işlemler için erişimi; yerel izole DB, test araçları, tarayıcı/simülatör; mevcut sırların yalnız güvenli konumu; makinenin güç/ağ/uyku durumu. Hesapları yeniden açmayı önerme ve gizli anahtarları sohbetten isteme.

**Gerekliyse tek başlangıç mesajında sorulacak en az soru kümesi:**

1. “Hedef bitişi **[tarih] 07.00 Europe/Istanbul** olarak kaydediyorum. `/usage` ekranındaki %55 hangi sınırın kalanı ve hangi tarih/saatte yenileniyor? Ekranı kendim görebiliyorsam bunu tekrar sormayacağım.”
2. “Fable başlangıç incelemesi için [gerçekte görülen erişim durumu]. Erişim yoksa mevcut [izinli model] ile devam seçeneği; ek ücret gerekiyorsa tutar/üst sınır. Yeni ücretli tüketim için varsayılan **0**, sırf kotayı bitirmek için API'ye geçiş yok.”
3. “Gece ilerlemeyi gerçekten engelleyecek [somut erişim/2FA/araç izni] adımlarını şimdi tamamlayabilir misin? [Hizmet, neden, kullanıcı işlemi]. Parola/kod/anahtar göndermene gerek yok.” Araç izinlerinde mevcut güvenli otomatik mod veya dar repo/test/yayın izinlerini kur; tüm korumaları atlamayı şart koşma.
4. “Yerel çalışacaksak bilgisayar güçte, uygulama/oturum açık ve gece erişilebilir kalabilecek mi? Gerçek cihaz testi için [somut cihaz/izin] var mı?” Bunlar mümkün değilse yapılabilecek yerel/sunucu işleri ve fiziksel kabul bekleyecekler başta ayrı yazılır.
5. “Fable incelemesinde çıkan ve mevcut kararlarca yanıtlanmayan [en fazla birkaç somut ürün kararı] için tercihlerin?” Karar soruları genel tasarım onayı tekrarına dönüşmez; öneri, etkisi ve güvenli varsayılanı sunulur. Cevap yoksa mevcut iş kuralları korunur; gerekli kararın bağımlısı olan iş bekler, diğerleri devam eder.

Başlangıç çıktısı önerisi: `FABLE-PREFLIGHT.md` içinde kullanılan gerçek model/commit, bulgular, teknik kararlar, gereken soruların cevapları, gece iş/ajan dağılımı, izin/bütçe/süre sınırları. Cevaplar geldikten sonra aynı soruları tekrar sormadan çalışma başlasın. Yeni ve gerçekten zorunlu bir engel doğmayacağı garanti edilmesin.

### Gaps
- Kullanıcının mevcut cihaz/uyku/oturum ayarları ve şimdiki Fable hakkı görülmediği için hazır oldukları söylenemez. Bu araştırma kullanıcıya yeniden izin sordurmaz; Claude için başlangıç kontrol listesi sağlar.
