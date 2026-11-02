# GINA fotoğraf ve belgeden AI içe aktarma — teknik araştırma

Araştırma tarihi: 2 Kasım 2026. Yalnızca resmî Expo, Anthropic, Supabase ve PostgreSQL belgeleri kullanıldı. Bu bir tasarım önerisidir; uygulama kodu, gerçek aile/okul dosyaları, kimlik bilgileri veya uzak uygulama durumu değiştirilmedi. API sınırları bu tarihteki belgelerdir; ürünün kendi sınırları aşağıda ayrıca önerilir.

## 1. Hangi dosyalar alınabilir; kaynakla ilişkilendirme nasıl güvenilir yapılır?

### Takeaway

Fotoğraf ve PDF üzerinden ders programı, ödev/görev ve soru taslağı çıkarmak teknik olarak mümkün. Ancak Claude yerleşik alıntıları ile sıkı JSON çıktısı aynı çağrıda birlikte çalışmıyor; taranmış PDF/fotoğraf için görüntüden doğrudan doğrulanmış alıntı garantisi de yok. MVP, her taslağı kendi belge/sayfa kaydıyla ilişkilendirip ebeveyne kaynak önizlemesi sunmalıdır. [Claude citations](https://platform.claude.com/docs/en/build-with-claude/citations)

### Cited Findings

- Expo SDK 58 `expo-image-picker`, sistem fotoğraf seçicisini ve kamerayı açar; `mediaTypes: ['images']` ile video dışarıda bırakılabilir. Kamera için kullanıcı izni gerekir. Eklenti Android'de varsayılan mikrofon izni eklediğinden fotoğraf senaryosunda `microphonePermission: false` gerekir. Seçicinin orijinal HEIC/AVIF döndürebilmesi nedeniyle her seçilen dosyanın Claude'a doğrudan uygun olduğu varsayılmamalıdır. [Expo 58 ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/)
- `expo-document-picker` sistemdeki belge sağlayıcılarından dosya seçer; MIME filtresi, tek/çoklu seçim ve iptal sonucu vardır. `mimeType` ve `size` opsiyoneldir; dosyayı hemen okumak için `copyToCacheDirectory: true` kullanılmalıdır. [Expo 58 DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/)
- Yeni FileSystem API'si `File`, `Directory`, `Paths`, boyut/tür bilgileri, akış okuma ve `expo/fetch` ile dosya gönderimini destekler. `File.preview()` iOS'ta Quick Look, Android'de dosya tipini destekleyen uygulamayla açar; bu özellik uygulama içinde kesin sayfaya atlama garantisi değildir. [Expo 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)
- ImageManipulator kırpma, boyut değiştirme, çevirme/döndürme ve JPEG/PNG/WebP kaydetme API'leri sağlar. [Expo 58 ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/)
- Claude API görüntü biçimleri JPEG, PNG, GIF ve WebP'dir; animasyonun ilk karesi kullanılır. Güncel Claude API sınırı görüntü başına **base64 kodlanmış 10 MB**, 8000×8000 piksel; 200k bağlamlı modellerde istek başına 100, diğerlerinde 600 görüntüdür. 20'den fazla görüntüde daha katı boyut sınırı vardır; belgeler platformlar arası güvenli seçenek olarak 3000 pikseli aşmamayı veya 20 blok altında kalmayı söyler. Düşük kaliteli/dönük/küçük görüntüler hata doğurabilir; konum tahminleri yaklaşıktır. [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- Claude PDF işlemede sayfa metnini ve sayfanın görüntüsünü birlikte kullanır. Şifresiz standart PDF; tüm istek için 32 MB; 1M altında bağlamda 100, diğer durumda 600 sayfa sınırı belirtilir. Yoğun içerik daha önce bağlam sınırına ulaşabilir. `.docx`/`.xlsx` belge bloklarında doğrudan desteklenmez; metin veya PDF'ye dönüşüm gerekir. [Claude PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- Yerleşik PDF citations çıkarılabilir metne dayanır; metinsiz taramalar alıntılanamaz. PDF sayfaları 1 tabanlıdır ve bitiş sayfası hariçtir. `citations.enabled` ile `output_config.format` birlikte 400 verir. Resmî alternatif, alan başına bir satır ürettirip alıntılı blokları uygulamada yapılandırılmış veriye çevirmektir. [Claude citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- JSON çıktısının güncel alanı `output_config.format: {type: 'json_schema', schema: ...}`. Nesnelerde `additionalProperties: false` gerekir; bazı sayısal/uzunluk kısıtları desteklenmez. `stop_reason: refusal` veya `max_tokens` çıktısı beklenen şemaya uymayabilir; HTTP 200 tek başına başarı ölçütü değildir. [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

### Inferences

**Önerilen ilk sürüm sınırı:** tek içe aktarmada bir belge, en çok 5 sayfa/fotoğraf, fotoğraf başına 4 MB ham veri, PDF başına 10 MB; bunlar sağlayıcı sınırı değil, mobil hız/maliyet/inceleme yükü için başlangıç ürün kararıdır. JPEG/PNG ve PDF kullanıcıya açık seçenekler olsun. HEIC/AVIF cihazda JPEG'e normalize edilsin; orijinal otomatik yüklenmesin. Sunucuda gerçek MIME/magic bytes, boyut, sayfa sayısı, şifreli/bozuk PDF ve çözümlenen piksel miktarı kontrol edilsin. Sadece uzantıya güvenilmesin. Bu öneri yukarıdaki dosya ve API sınırlarından türetilmiştir.

**Kaynak bağlantısı modeli:** sunucu `source_id` ve sayfa listesini oluşturur; modele kalıcı URL, aile bilgileri veya erişim anahtarı üretme görevi verilmez. Model yalnızca sağlanan sayfa kimliklerinden seçim yapar. `source_ref = {source_id, page_number, region?, short_excerpt?, evidence_kind}` olsun; `evidence_kind` değerleri `native_text_citation`, `visual_extraction`, `user_corrected`. Fotoğraf tek sayfadır. Sayfa aralığı sunucuda doğrulanır; crop/resize uygulanmışsa koordinat dönüşümü saklanır. Görüntü tahmini, doğrulanmış alıntı gibi etiketlenmez. Kaynak silinince bağlantı açıkça “Kaynak dosya silindi” gösterir; çıkarılan kaydın köken metadatası kalabilir. [Kaynak dayanağı: Claude citations](https://platform.claude.com/docs/en/build-with-claude/citations)

**İki yol:** MVP'de sıkı JSON + uygulama tarafından doğrulanan belge/sayfa referansı. Sonraki sürümde metinli PDF için ayrı alıntılı çıkarım çağrısı, uygulama tarafından verilen değişmez evidence kimlikleri ve ikinci JSON normalleştirme çağrısı düşünülebilir. İkinci model kaynak alıntılarını yeniden icat etmemeli; sunucunun evidence kimliği listesine bağlanmalıdır. Taranmış belgeye sonradan OCR eklenmesi de OCR doğruluğunu garanti etmez; kaynak görüntü görünür kalmalıdır.

### Gaps

- Türkçe el yazısı, farklı okul çizelgeleri, saat tabloları, matematik sembolleri ve kötü ışıkta başarı oranı için GINA'ya özgü güvenilir ölçüm yok. “%95 doğruluk” gibi sayı vaat edilmemeli; izinli/sentetik değerlendirme kümesi gerekir.
- Expo yerleşik dosya önizleme belgeleri uygulama içinde PDF sayfasına sabit bağlantıyı garanti etmiyor. GINA'nın kendi sayfa görüntüleyicisi veya ayrıca değerlendirilecek bir PDF bileşeni gerekebilir.
- Tüm cihazlarda HEIC/AVIF dönüşümü, EXIF/GPS temizliği ve PDF karartma davranışı bu araştırmayla doğrulanmadı. Sadece `exif: false` ayarı dosyadan bütün metadatanın temizlendiği kanıtı sayılmamalı.

## 2. Ebeveyn onayı, mahremiyet ve güvenli işleme nasıl tasarlanmalı?

### Takeaway

Görev gereği okul fotoğrafları **ebeveynin o belgeye özel açık onayından önce hiçbir sunucuya veya AI sağlayıcısına gönderilmemelidir**. Çocuk doğrudan AI başlatamaz; import oluşturma, işleme ve uygulama uçları ebeveyn rolü gerektirir. Dosya seçme/kamera izni AI yükleme onayı değildir. Yerel önizleme, kırpma/karartma ve alıcı bilgisi; sonrasında özel depolama ve yetkili sunucu çağrısı önerilir.

### Cited Findings

- Supabase private bucket indirmeleri dahil RLS'ye tabidir; erişim kullanıcı JWT'si veya süreli imzalı URL ile sağlanır. Public bucket dosya sunumunda erişim kontrolünü atlar. [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- Storage `storage.objects` politikaları üzerinden yetkilendirilir ve uygun politika yoksa varsayılan olarak yüklemeyi kabul etmez. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- Kullanıcıya açık Edge Functions kullanıcı JWT'sini doğrulamalı; kullanıcı kapsamındaki istemci RLS uygular, admin istemci RLS'yi atlar. Güncel belgeler kullanıcı uçlarında JWT doğrulamasını açık tutmayı önerir. [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- Anthropic ticari API girdileri/çıktıları varsayılan olarak model eğitiminde kullanılmaz; açık geri bildirim/veri kullanımına izin verme farklılık yaratabilir. [Anthropic training policy](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training)
- API girdileri/çıktıları genel olarak 30 gün içinde silinir; Files API, ayrı anlaşmalar, kullanım politikası veya hukuk kaynaklı istisnalar vardır. ZDR uygunluğu, hesabın gerçekten sıfır saklama sözleşmesine sahip olduğu anlamına gelmez. [Anthropic retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
- Files API dosyaları silinene veya belirlenen süre dolana kadar kalır; workspace içinde başka isteklerce referans verilebilir. Güncel üst sınır dosya başına 500 MB, organizasyon başına 1 TB; bu, Messages bağlam sınırını kaldırmaz. Süreli yükleme 1 saat–90 gün aralığını destekler. [Claude Files API](https://platform.claude.com/docs/en/build-with-claude/files)
- Anthropic, üçüncü taraf belge içindeki komutları dolaylı prompt injection olarak tanımlar; sistem mesajında bu içeriğin güvenilmeyen veri olduğu belirtilmeli, belgedeki talimatların sistem/hedefi değiştirmesine izin verilmemelidir. [Prompt injection mitigations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Özel depolama için önbellek/JWT veya imzalı URL süresi, çıkış veya erişim kaldırma sonrasında erişimin hemen kesilmesini etkileyebilir. [Supabase private file caching](https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout)

### Inferences

Önerilen onay akışı: (1) Belge ve hedef çocuk cihazda seçilir. (2) Yerel önizlemede yalnız ilgili sayfa/alan bırakılır; sınıf listesi, diğer çocukların adları/yüzleri, kimlik, telefon, adres ve konum verileri çıkarılır. (3) “Bu dosyanın seçili bölümleri, taslak hazırlamak için GINA sunucusuna ve Anthropic'e gönderilecek” açıklaması dosya adı/önizleme ve saklama seçeneğiyle gösterilir. (4) Ebeveyn “Bu belgeyi AI ile işle” der. Ancak bundan sonra upload/AI çalışır. Belge, sayfa seti, kırpılmış içerik, sağlayıcı veya amaç değişirse yeni onay gerekir. Bu, görevdeki onay koşulunu uygular; hukuki yeterlilik iddiası değildir.

Onay kaydı `actor_user_id`, belge sürümü/hash'i, amaç, sağlayıcı, sayfa kapsamı, açıklama sürümü ve zaman içersin. Çocuğun tam adı AI'a gönderilmesin; modele `child_ref` yerine yalnız gerekli yaş/sınıf aralığı aktarılabilir. Çocuğun gerçek eşleştirmesi sunucuda kalsın. Dosya isimleri UUID olsun; orijinal dosya adı loglara yazılmasın. Belge metni, görsel base64, signed URL ve prompt gövdesi hata/analitik kayıtlarına düşmesin. Bunlar mahremiyeti azaltan ürün tasarımı önerileridir.

Özel `import-sources` bucket ve aile üyeliğine bağlı RLS önerilir. Sadece path'teki `family_id` veya istemcinin gönderdiği `child_id` yeterli sayılmasın; üyelik ve ebeveyn rolü sunucudan doğrulansın. Belgeye erişim ayrıca kaynak kaydı ile bağlansın. AI isteği sunucudan kontrollü bytes ile gönderilsin; model kaynak URL'si seçmesin. Files API ilk MVP'de gerekli değil; kullanılırsa sağlayıcı dosya kimliğini istemciden serbestçe kabul etmeme, expiry ve silme takibi gerekir. [Dayanak: Edge auth](https://supabase.com/docs/guides/functions/auth), [Files lifecycle](https://platform.claude.com/docs/en/build-with-claude/files)

Çıkarım çağrısına ağ, e-posta, veri yazma veya ödül verme araçları tanımlanmasın. Belge metni sistem mesajına eklenmesin; belge/image bloklarında güvenilmeyen girdi olarak kalsın. “Tüm ödülleri ver”, “şu URL'ye gönder”, “onayı atla” gibi belge talimatları veri kabul edilsin ve gerekirse uyarı üretilsin. Çıktı allowlist şeması + sunucu iş kuralları + insan incelemesi katmanlarından geçsin. Prompt tek başına güvenlik sınırı değildir. [Dayanak: injection mitigations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)

Saklama önerisi: kaynak varsayılan kısa süreli (ör. 7 gün; ürün kararı), “Kaynağı sakla” ayrı seçenek; terk edilen yüklemeler kısa TTL ile temizlensin. Ebeveyn kaynak ve taslağı ayrı ayrı silebilsin. Kaynak erişiminde kısa süreli URL ya da anlık yetki kontrolü; uygulama loglarında URL saklamama. GINA'dan silmenin sağlayıcıdaki yasal/operasyonel saklamayı anında sıfırladığı söylenmesin.

Silme davranışı somut olmalı: “Kaynağı sil” depolanan dosya, sayfa önizlemeleri, OCR metni ve türetilmiş crop'ları temizler; onaylanmış ders/görev kayıtları açıkça belirtilerek korunur. “Taslağı sil” henüz uygulanmamış önerileri siler ve başka kullanım yoksa geçici kaynağı temizlemeye alır. “İçe aktarılan kayıtları kaldır” ayrı işlemdir; sonradan düzenlenmiş kayıtlar önce gösterilir. Metadata'da silinen kaynak için yalnız hassas olmayan köken bilgisi ve tombstone tutulur; canlı kayıt içindeki kısa alıntı da kişisel veri içeriyorsa silme kapsamına dahil edilir. Kaynak bağlantısının kalıcı olması istenirse kullanıcı saklamayı seçmelidir; süreli kaynakla sınırsız süre görüntülenebilir kaynak vaadi bir arada verilmemelidir.

### Gaps

- GINA'nın Anthropic sözleşmesi, ZDR, sunucu bölgesi, yedek saklama süresi ve çocuk verisi işlemeye ilişkin hukuki dayanağı incelenmedi; kimlik bilgilerine veya hesaplara erişilmedi. KVKK/GDPR/COPPA uyumluluğu sonucu çıkarılamaz.
- PDF'de güvenilir yerel karartma hazır değilse ilk sürüm PDF'yi otomatik yüklememeli: ilgili sayfaların kırpılmış ekran görüntüsünü seçme veya hassas bilgi içermeyen belge kullanma yolu sunulmalı.

## 3. Düzenlenebilir taslak, atomik kaydetme, kota ve aşamalı MVP nasıl kurulmalı?

### Takeaway

AI çıktısı canlı ders/görev/ödül/soru kaydı değil, revizyonlu bir taslak olmalıdır. Ebeveynin seçtiği geçerli öğeler tek veritabanı işlemiyle uygulanmalı; kaynak yükleme, AI çağrısı ve veritabanı commit'i ayrı yaşam döngüleri olarak ele alınmalıdır.

### Cited Findings

- PostgreSQL transaction birden çok adımı bütünüyle başarılı veya bütünüyle başarısız hale getirir; ara durumlar diğer işlemlere görünmez. [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- Supabase veritabanı fonksiyonlarında varsayılan `security invoker` önerilir. `security definer` kullanımı sahiplik kontrolü, daraltılmış execute yetkisi ve sabit `search_path` gerektirir; RLS'nin otomatik koruyacağı varsayılamaz. [Database functions](https://supabase.com/docs/guides/database/functions)
- Supabase Edge Functions için 256 MB bellek, istek başına 2 saniye CPU, ücretsiz/plana göre 150/400 saniye çalışma süresi ve 150 saniye boşta istek zaman aşımı vardır. Çok iş parçacığı gerektiren `sharp`/libvips gibi kütüphaneler desteklenmez. [Edge limits](https://supabase.com/docs/guides/functions/limits)
- Supabase 6 MB üstü dosyalarda daha güvenilir aktarım için TUS resumable upload önerir. Dosyayı aynı yola overwrite etmek yerine yeni path kullanılması önerilir. [Standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- Claude rate limits istek/girdi/çıktı tokenları üzerinden uygulanır; `retry-after` varsa beklenmelidir. Harcama limiti aşılan bazı 429'larda bu başlık yoktur ve tekrar denemek çözüm olmaz. [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits)

### Inferences

**Önerilen aşamalar:**

1. M0: Yerel seçme/önizleme/onay ve manuel taslak; gerçek çocuk verisi kullanmadan UI, RLS ve parser değerlendirmesi.
2. M1: Tek hedefli ders programı ve ödev/görev çıkarımı. Tarih, hafta günü, saat, süre, ders ve çocuk eşleşmesi kullanıcıya görünür. Belirsiz tarih/saat `null` + “Kontrol gerekli”; model bugünden tarih uydurmasın. Program saat çakışması ve tekrar kayıt uyarıları sunucu hesaplasın.
3. M2: Ödül/hedef belgesinden **tanım taslağı**; puan, kazanılmışlık ve tamamlandı durumu otomatik uygulanmasın. Mevcut puan bakiyesi veya görev tamamlama geçmişi değişmesin.
4. M3: Prova'ya soru aktarımı. Kaynaktaki soru/şıklar ile AI tarafından eklenen açıklama/üretilen benzer soru ayrı alanlar olsun. Kaynakta cevap anahtarı yoksa doğru cevap “kaynakta var” sayılmasın; `answer_status: unknown | source_provided | ai_suggested | parent_verified`. Görsel soru için görsel kaynak bağı korunmalı; eksik diyagramla soru yayımlanmamalı.

**Önerilen asgari veri şeması (tasarımdır; migration değildir):**

| Varlık | Temel alanlar ve kural |
|---|---|
| `import_sources` | `id`, `family_id`, `created_by`, `storage_path`, `content_hash`, `mime_type`, `byte_size`, `page_count`, `sanitization_version`, `retention_until`, `deleted_at`; gerçek içerik adı/log yerine UUID |
| `import_consents` | `id`, `source_id`, `source_hash`, `actor_id`, `purpose`, `provider`, `selected_pages`, `notice_version`, `confirmed_at`; hash değişince geçersiz |
| `import_jobs` | `id`, `source_id`, `consent_id`, `family_id`, `target_child_id`, `target_kind`, `status`, `idempotency_key`, `model_id`, `schema_version`, `prompt_version`, `attempt`, `lease_until`, `provider_request_id`, `usage`, `error_code` |
| `import_drafts` | `id`, `job_id`, `revision`, `status`, `created_at`, `updated_at`; review / applied / discarded |
| `import_draft_items` | `id`, `draft_id`, `kind`, `payload`, `source_refs`, `warnings`, `review_status`, `selected`, `user_edited_fields`; tür başına ayrı payload doğrulayıcısı |
| `import_commits` | `id`, `draft_id`, `revision`, `actor_id`, `idempotency_key`, `applied_at`, `created_entity_ids`; aynı commit anahtarı unique |
| `import_entity_links` | `source_id`, `draft_item_id`, `entity_type`, `entity_id`, `source_refs`; sonradan kaynak görüntüleme/izlenebilirlik |
| `import_usage_ledger` | `family_id`, `job_id`, `period`, `reserved_units`, `charged_units`, `state`; rezervasyon/harcama tekilleştirilir |

`payload` türleri: `timetable_entry {weekday, start_time, end_time, subject, location?, effective_from?, effective_until?}`; `task {title, subject?, due_date?, recurrence?, note?}`; `reward_goal {kind, title, target?, unit?, points?, criteria?}`; `prova_question {stem, options[], answer?, answer_status, explanation?, topic?, difficulty?, media_refs[]}`. Saat dilimi aile ayarından gelir; eksik alanlara sessiz varsayım yapılmaz. Modelin bildirdiği confidence kalibre edilmiş doğruluk yüzdesi gibi gösterilmez; kullanıcıya belirsizliğin nedeni gösterilir. Şema önerisi mevcut uygulama tabloları doğrulanmadan uygulanmamalıdır.

**Akış:** `local_selected → consented → uploaded → queued → processing → needs_review → applied`; ayrıca `rejected`, `failed`, `expired`, `discarded`. Yerel seçimin onay öncesi sunucu kaydı gerektirmemesi tercih edilir. AI tamamlandığında yalnız taslak yazılır. İnceleme ekranı kaynak ve aday kaydı yan yana/ardışık gösterir; alan düzenleme, öğe çıkarma, bölme, hedef seçme ve “Seçilenleri kaydet” sağlar. Taslak revizyonu commit sırasında eşleşmiyorsa kaydetme reddedilip güncel sürüm gösterilir.

**Atomik uygulama:** `apply_import(draft_id, revision, selected_item_ids, commit_key)` tek veritabanı çağrısı; ebeveyn/aile/çocuk yetkisi, taslak durumu, tüm payload'lar ve çakışmalar sunucuda tekrar doğrulanır. Seçili öğeler, source linkleri ve commit kaydı aynı transaction içinde oluşur; bir öğe başarısızsa tamamı geri alınır. Client'tan ayrı ayrı INSERT döngüsü kullanılmaz. Storage ve harici AI veritabanı transaction'ına dahil değildir: hata sonrası yetim kaynak temizleme ve iş durum onarımı gerekir. [Dayanak: PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

**Tekilleştirme ve maliyet:** istemcinin ürettiği sabit işlem anahtarı, aile kapsamında unique; yeniden tıklamada aynı job/draft döner. Dosya hash'i aile/çocuk/hedef/schema sürümü ile karşılaştırılarak tekrar içe aktarma uyarılır; farklı amaçtaki meşru aktarım engellenmez. Commit anahtarı unique olduğundan ağ yanıtı kaybolup yeniden kaydetme durumunda aynı entity listesi döner. Kaynak yolu immutable tutulur. Sağlayıcı çağrısında kesin “exactly once” garantisi varsayılmamalı: ağ kesilince çağrı ücretlenmiş olabilir; otomatik sınırsız tekrar yok.

Aile başına aylık sayfa/token bütçesi, tek belge boyutu, eşzamanlı iş sayısı ve yeniden deneme sınırı sunucuda uygulansın. AI öncesi atomik kota rezervasyonu; başarı sonrası kullanım kesinleştirme, AI'a gitmeden hata olursa rezervasyon iadesi. Sağlayıcıya gönderilmiş belirsiz timeout'lar ayrı `unknown` maliyet durumu olsun. En fazla sınırlı, gecikmeli retry; 429 harcama tavanı ve geçersiz dosya tekrar denenmesin. Uzun işlem job/queue üzerinden yürüsün; mobil bağlantı kapanması işi çoğaltmasın. Ağır PDF rasterizasyon/OCR işinin Edge CPU sınırına sığdığı varsayılmasın; ayrı işçi veya cihaz ön işlemesi değerlendirilsin. [Dayanak: Edge limits](https://supabase.com/docs/guides/functions/limits), [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits)

### Gaps

- Mevcut GINA tabloları ve kota/AI gateway kodu bu alt araştırmada okunmadı; önerilen alanlar isimlendirme ve mevcut transaction/RLS düzenine uyarlanmalıdır.
- Sürüm/model seçimi, gerçek maliyet ve Türkçe belge başarımı ölçülmedi. Seçilecek model sürümü yapılandırmada sabitlenmeli; schema, model, prompt ve sanitization sürümü her job'da kaydedilmelidir.
- Kabul testleri uygulama aşaması için önerilir: onay öncesi sıfır upload; aileler arası erişim reddi; bozuk/MIME taklitli dosya reddi; belgedeki saldırı komutlarının eyleme dönüşmemesi; yanlış sayfa referansının reddi; çift tıklamada tek job/tek commit; eşzamanlı taslak düzenleme çakışması; transaction ortası hatada sıfır canlı kayıt; kayıp yanıt sonrası aynı sonucu döndürme; kota yarışında aşım olmaması. Bunlar bu araştırmada çalıştırılmış testler değildir.
