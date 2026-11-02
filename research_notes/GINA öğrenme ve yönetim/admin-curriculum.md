# GINA yönetim, destek ve müfredat araştırması

Araştırma tarihi: 2 Kasım 2026. Kapsam: kamuya açık birincil kaynaklar; üretim verisi veya dış sistem değişikliği yok. Aşağıdaki öneriler ürün tasarımı çıkarımlarıdır; hukuki görüş veya GINA’nın mevcut uygulamasına ilişkin doğrulanmış durum tespiti değildir.

## 1. Yönetici hangi abonelik ve erişim işlemlerini yapabilmeli?

### Takeaway

Mağaza ödemesi, mağaza abonelik durumu ve GINA erişim hakkı üç ayrı kayıt olmalı. Apple için yöneticiye doğrudan para iade eden bir düğme vaat edilmemeli; Google’da iade, yenilemeyi durdurma ve erişimi geri alma ayrı sonuçları olan işlemlerdir. [Apple API](https://developer.apple.com/documentation/appstoreserverapi), [Google yönetim rehberi](https://developer.android.com/google/play/billing/manage-purchases)

### Cited Findings

- Apple StoreKit `beginRefundRequest` müşteriye satın alma ve gerekçe seçeneklerini içeren talep ekranını açar; iadeyi App Store kabul veya reddeder. Bu bir yöneticinin iadeyi onaylama API’si değildir. [StoreKit](https://developer.apple.com/documentation/storekit/transaction/beginrefundrequest%28for%3Ain%3A%29-65tph?changes=_4)
- Apple müşterisi `reportaproblem.apple.com` üzerinden talep açabilir; Apple’ın onayı ile para dönüşü farklı aşamalardır. Uygunluk ülkeye/bölgeye göre değişebilir. [Apple Support](https://support.apple.com/en-ie/118223)
- Apple Server API abonelik durumunu ve iade geçmişini sorgular; tüketim bilgisi iade kararını desteklemek içindir. Geçerli kullanıcı izni olmadan müşteriden toplanan tüketim verisinin gönderilmemesi gerekir. Kararı Apple verir. [Server API](https://developer.apple.com/documentation/appstoreserverapi), [Send Consumption Information](https://developer.apple.com/documentation/appstoreserverapi/send-consumption-information?changes=_3)
- Google `orders.refund` sipariş numarasıyla iade yapar; üç yıldan eski siparişler kapsam dışıdır. `revoke=true` erişimi ve tekrar eden abonelikte sonraki ödemeleri sonlandırır; tüketilmiş uygulama içi ürünler geliştiricinin uygulamasında ele alınır. [orders.refund](https://developers.google.com/android-publisher/api-ref/rest/v3/orders/refund)
- Google sipariş iadesinde eski bir yenileme siparişine `revoke` vermek para iadesi oluşturabilir fakat güncel aboneliği kapatmayabilir. Aktif abonelik erişimini kaldırmak için satın alma token’ı ile `subscriptionsv2.revoke` tercih edilir. [Yönetim rehberi](https://developer.android.com/google/play/billing/manage-purchases)
- `subscriptionsv2.revoke` tam, kalan süreyle orantılı veya eklentili abonelikte belirli kalem iadesi bağlamını kabul eder. Tam iade, her kalemin son tahsilatına ilişkindir; aboneliğin tüm tarihî tahsilatları demek değildir. [Revoke API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/revoke)
- Google’ın eski `purchases.subscriptions.cancel` yöntemi artık deprecated olarak işaretlidir; yeni uygulama için v2 kullanılmalıdır. V2, `cancellationContext.cancellationType` ister: kullanıcı isteğiyle yenilemeyi durdurma ile geliştiricinin sonraki ödemeleri durdurması farklıdır. [Eski API uyarısı](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/cancel), [V2 cancel](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/cancel)
- İptal tek başına para iadesi değildir; mevcut dönem bitimine kadar erişim devam eder. Google olay bildirimi geldikten sonra `purchases.subscriptionsv2.get` ile güncel durum alınmalı; bu uç nokta abonelik yönetiminin doğruluk kaynağıdır. [Yönetim rehberi](https://developer.android.com/google/play/billing/manage-purchases), [Yaşam döngüsü](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- OWASP en az yetki, varsayılan ret ve her istekte sunucu tarafı izin denetimini önerir. Loglarda erişim token’ları, parolalar ve hassas kişisel veriler doğrudan tutulmamalı; log okuma izinleri de sınırlandırılmalıdır. [Yetkilendirme](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Loglama](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Inferences

Önerilen operasyon matrisi; roller GINA’ya öneridir, mağazaların hazır rol sistemi değildir:

| İşlem | Operatör rolü önerisi | Üründe gerçek sonuç ve koruma |
|---|---|---|
| Abonelik durumunu görüntüle / yeniden doğrula | Destek | Sağlayıcı, ürün, bitiş, yenileme, son doğrulama zamanı; durum sorgulama erişim hediye etmez. |
| Apple iade yardımı | Destek | Veliye Apple talep akışını göster; talep ile onaylanmış iadeyi ayrı durumlar yap. GINA’da “İadeyi onayla” eylemi sunma. |
| Apple tüketim bilgisi yanıtı | Ödeme servisi; kısıtlı inceleme | İzin kaydı ve veri kapsamı kontrolü; “iade reddet” gibi yanlış isimlendirme kullanma. |
| Google sipariş iadesi | Finans | Sipariş, para birimi, tutar, tarih ve erişim etkisini önizle; tekrar denemeden önce sağlayıcıyla uzlaştır. |
| Google abonelik iade + erişimi sonlandırma | Finans; yüksek etkide ikinci onay | Token bazlı v2 revoke; tam/orantılı seçimi açık; kalıcı finansal etkiyi gerekçeyle kaydet. |
| Google yenilemeyi durdurma | Yetkili destek/finans | V2 cancel; iptal türünü açıkça seç; kalan süre/taahhüt etkisini göster. |
| Geçici GINA erişimi tanımla | Destek yöneticisi | Süreli `support_grant`, gerekçe ve bitiş zorunlu; mağaza aboneliğinin active/paid durumunu değiştirme. |
| GINA erişim hediyesini geri al | Destek yöneticisi | Sadece belirli grant kaydını sonlandır; kullanıcının başka geçerli mağaza hakkını iptal etme. |
| Özellik aç/kapat | Ürün/yayın yöneticisi | Ortam + özellik + kohort + süre; erişim yetkisinin yerine geçmez; önizleme ve geri dönüş planı. |
| Finansal işlem / izin / özellik kaydını incele | Denetçi | Salt okunur; operatör kendi geçmişini silemez. |

Bu matrisin API sınırları yukarıdaki Apple/Google kaynaklarına; izin ve log yaklaşımı OWASP’a dayanır. İkinci onay, süre sınırı ve rol isimleri önerilen GINA politikalarıdır.

Önerilen veri ayrımı: `store_subscription` sağlayıcıdan doğrulanmış gerçeği; `entitlement_grant` mağaza/promo/destek kaynaklı erişimleri; `effective_entitlement` zaman ve kapsamı dikkate alan sonucu tutar. Ekran “Apple aboneliği sona erdi; destek erişimi 12 Kasım’a kadar” diyebilmelidir. Feature flag, ücretli hak sağlamaz; rollout seçimi ile satın alınmış hakkın geçerliliği ayrı değerlendirilir. Bu mimari, sağlayıcı doğruluk kaynağının elle bozulmasını önleme çıkarımıdır. [Google durum doğruluğu](https://developer.android.com/google/play/billing/lifecycle/subscriptions)

Her önemli komutta önerilen kayıt: `action_id`, operatör, rol, hedef hesap, eylem, kodlanmış gerekçe, destek kaydı bağlantısı, zaman, maskeli önce/sonra farkı, ortam, sağlayıcı korelasyonu, istek/sonuç durumu. İşlem durumları `hazırlandı → gönderildi → sağlayıcı doğrulandı / başarısız / sonucu belirsiz` olsun. “Sonucu belirsiz” işlem körlemesine yeniden gönderilmesin. Ham çocuk konuşmaları ve erişim sırları bu loga yazılmasın. Bu ayrıntılı şema GINA tasarım önerisidir. [OWASP loglama](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Gaps

- GINA’nın gerçek sağlayıcısı, mağaza SKU’ları, bölge kapsamı, mevcut sunucu bildirimleri ve erişim öncelik kuralları bu alt araştırmada incelenmedi. Matris entegrasyon öncesi eşleştirilmeli.
- Apple’da yönetici tarafından doğrudan iade başlatan genel bir Server API doğrulanamadı. Gözlenen resmî model müşteri talebi ve Apple kararıdır; özel ticari veya mağaza dışı ödeme modellerine genellenmemeli.
- Apple StoreKit sayfası tüketim bildirimi açıklamasında consumable örneği verirken güncel Server API sayfası tüm ürün türlerini sayıyor; uygulamada güncel Server API sözleşmesi esas alınmalı, eski örnek kapsamı sınır sanılmamalı.
- Google genel yönetim rehberi hâlâ eski cancel adını kullanırken yöntem referansı v2’ye yönlendiriyor. Yeni geliştirmede yöntem referansı ve kullanılan kütüphanenin sürümü ayrıca doğrulanmalı.

## 2. Veli destek, fikir kutusu ve SSS nasıl yönetilmeli?

### Takeaway

Öneri: çocuk deneyiminden ayrı veli destek alanı, üç farklı iş akışı ve yayımlanmadan önce insan incelemesi. Destek talebi, ürün fikri ve SSS değişikliği aynı serbest metin kuyruğunda kaybolmamalı.

### Cited Findings

- Apple Kids Category uygulamalarında dış bağlantılar, satın alma fırsatları ve benzeri dikkat dağıtıcı unsurlar ebeveyn kapısı arkasındaki ayrılmış alana konulmalıdır. Ebeveyn kapısı kişisel veri toplamaya ilişkin ebeveyn onayıyla aynı şey değildir. Bu kategoriye özgü şart GINA’nın mağaza konumlandırmasına göre uygulanır. [App Review 1.3 ve 5.1.4](https://developer.apple.com/app-store/review/guidelines/)
- Apple ebeveyn kapısını yetişkinin tamamlayacağı bir görev olarak tanımlar; amacı çocuğun ebeveynden habersiz alışveriş veya dış bağlantıya geçmesini önlemektir. [Çocuk deneyimi rehberi](https://developer.apple.com/kids/)
- OWASP kullanıcı kimliğinin doğrulanmasının her kayda erişme hakkı vermediğini vurgular; kaynak erişimi ayrıca yetkilendirilmelidir. [Yetkilendirme](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### Inferences

Önerilen ürün davranışı:

- **Destek:** Veli alanında konu seçimi: teknik sorun, satın alma/erişim, hesap, içerik hatası. Başlangıçta yalnız uygulama sürümü, platform, dil ve hata bağlamı; konuşma veya ödev eki yalnız gerektiğinde bilinçli seçimle. Durumlar: alındı, inceleniyor, veli yanıtı bekliyor, çözüldü, yeniden açıldı. Hesap sahipliği kontrol edilmeden çocuk verisi açılmasın.
- **Fikir kutusu:** Fikir türü, kısa açıklama, isteğe bağlı geri dönüş izni. Durumlar: yeni, benzer fikirle birleştirildi, değerlendiriliyor, planlandı, yayımlandı, şimdilik yapılmayacak. “Planlandı” tarihi garanti etmesin. Destek bileti fikre dönüştürülürken özel yazışma otomatik yayımlanmasın.
- **SSS:** Taslak → editör kontrolü → yayımlandı → kullanım dışı. Her madde için sahibi, hedef kitle, platform, ürün sürümü, son gözden geçirme ve destekleyici kaynak. Satın alma/iade yanıtları Apple ve Google için ayrı; mağaza koşulları değiştiğinde yeniden inceleme tetiklensin.
- **Yetkiler:** Destek çalışanı kendi kapsamındaki bileti görür; içerik editörü anonimleştirilmiş içerik sorununu görür; finans yalnız satın alma kimliklerini görür. Dış yanıt taslağı üretilebilir ancak otomatik gönderim ve SSS’ye otomatik yayın MVP kapsamına alınmasın.
- **Kullanıcıya verilen söz:** “Talebini aldık” ile “çözüldü” ayrımı; otomatik teşekkür, finansal işlem veya teşhis sonucu gibi sunulmasın. SSS, satın alma eylemleri ve dış bağlantılar veli alanında bulunmalı.

Bunlar hazır bir resmî destek standardı iddiası değildir; Apple’ın veli alanı sınırları ve OWASP kaynak yetkilendirme ilkelerinden türetilen GINA işletim tasarımıdır. [Apple](https://developer.apple.com/app-store/review/guidelines/), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### Gaps

- Destek saatleri, yanıt hedefi, saklama süresi, veri sorumlusu ve ekip kapasitesi bilinmiyor; araştırmadan kesin SLA veya otomatik silme süresi çıkarılamaz.
- GINA’nın Kids Category’de yayımlanıp yayımlanmayacağı doğrulanmadı. Ebeveyn kapısı ile veri izninin ayrılması yine de ürün modelinde açık tutulmalı.

## 3. MEB sınıf, ders, öğrenme çıktısı sürümleri ve aşamalı uygulama nasıl kurulmalı?

### Takeaway

2026 tarihli program güncellemeleri ve kademeli geçiş nedeniyle yalnız “sınıf + ders” anahtarı yeterli değildir. Program sürümü ve eğitim yılı seçilerek doğrulanmış çıktılar eşleştirilmeli; GINA etkinliğinden çocuk hakkında tanısal yetenek veya kişilik hükmü çıkarılmamalı.

### Cited Findings

- TTKB canlı öğretim programı kataloğu 2026 İlkokul Matematik, İlkokul Türkçe, Hayat Bilgisi, Fen Bilimleri ve başka dersleri ayrı listeler; aynı katalogda örneğin 2024 ve 2026 Ortaokul Türkçe sürümleri birlikte bulunur. [Resmî katalog](https://mufredat.meb.gov.tr/Programlar.aspx)
- Güncel ilkokul Matematik 1–4 detay kaydı `PID=2339`, Türkçe 1–4 kaydı `PID=2351`; başlıklar 2026 sürümünü açıkça belirtir. [Matematik 2026](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=2339), [Türkçe 2026](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=2351)
- MEB’in 3 Eylül 2026 duyurusuna göre 2026–2027’de TYMM ilkokul 1, 2, 3 ve ortaokul 5, 6, 7 sınıflarında uygulanır. Bu, yayımlanmış tüm sınıf programlarının o yıl bütün sınıflarda yürürlükte olduğu anlamına gelmez. [Temel Eğitim Genel Müdürlüğü](https://tegm.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-taslak-cerceve-planlar-yayinlandi/icerik/1316)
- Ortaöğretim duyurusu hazırlık, 9, 10, 11 için TYMM; 12 için önceki programların sürdüğünü söyler. [Ortaöğretim Genel Müdürlüğü](https://ogm.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-turkiye-yuzyili-maarif-modeli-taslak-cerceve-planlar-yayimlandi/icerik/2633/tr)
- MEB’in çevrim içi 1. sınıf Matematik teması ders, sınıf, tema, öğrenme çıktısı kodu, süreç bileşenleri, içerik çerçevesi ve öğrenme kanıtlarını ayrı gösterir. Örnek `MAT.1.1.1`, sayıları nicelikleri temsil etmekte kullanmayla ilgilidir; süreç bileşenleri ayrıdır. [Resmî tema örneği](https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/45)
- TTKB 16 Ekim 2026’da elektronik içerik tablosunu güncellemiş; değişen 2026 programlarının çıktı, süreç bileşeni ve öğretim uygulamalarını yeniden ele aldığını açıklamıştır. Bu tablo dijital içerik geliştirmede referans olarak tanımlanır. [E-içerik duyurusu](https://ttkb.meb.gov.tr/www/ders-kitaplari-ve-egitim-araclari-e-icerik-tablosu-guncellendi/icerik/931/tr?rand=145)
- TTKB’nin İGYS e-içerik değerlendirme çerçevesi ölçme etkinliklerini öğrenme çıktısı ve süreç bileşenleriyle uyumlu tutar; bu belirli çerçevenin GINA için kendiliğinden yasal zorunluluk veya MEB onayı oluşturduğu ileri sürülemez. [Kriterler](https://ttkb.meb.gov.tr/kriter/)

### Inferences

Önerilen taksonomi: ülke → program ailesi → program sürümü → eğitim yılına göre uygulanabilir sınıf → ders → ünite/tema/öğrenme alanı → resmî öğrenme çıktısı → varsa süreç bileşeni. “Kazanım” ve “öğrenme çıktısı” geçmiş/yeni programın özgün terimi olarak korunmalı; tek etiketle tüm kaynaklar yeniden yazılmamalı. Bu şema resmî katalog ve tema yapısından türetilmiştir. [Katalog](https://mufredat.meb.gov.tr/Programlar.aspx), [Tema](https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/45)

Önerilen kayıt alanları: `curriculum_version_id`, `academic_year`, `grade`, `subject_id`, `unit_id`, `official_outcome_code`, özgün çıktı metni, süreç bileşeni, kaynak URL, kaynak tarihi, alınma tarihi, belge özeti/hash, yürürlük aralığı, inceleyen uzman, yayımlama durumu. Öğrenci etkinliğiyle çıktı eşleşmesi ayrı, sürümlü ve geri alınabilir kayıt olmalı. Resmî kod kalıcı sürümler arası tekil kimlik varsayılmamalı.

İçerik editörü çıktı eşlemesi önerebilir; eğitim uzmanı metni ve sürümü doğrulayıp yayımlar. AI bir çıktı kodu veya kaynak uyduramaz; doğrulanmamış eşleşme “müfredatla uyumlu” diye kullanıcıya sunulamaz. Kaynak değişince mevcut öğrenci geçmişi silinmez; önceki sürüm görünür tutulur ve yeni eşleme ayrı yayımlanır. Bunlar GINA için önerilen yayın kontrolüdür.

Öğrenme analitiği için ürün sınırı: gözlenen etkinlik, tarih aralığı, görev sayısı, ipucu kullanımı ve doğrulanmış çıktı eşleşmesi gösterilsin. “Bu etkinlikte 5 sorunun 3’ünü yardımsız tamamladı” bir gözlem örneğidir; “matematik yeteneği düşük”, “dikkat bozukluğu var”, “yaşıtlarından geri” gibi tanısal veya normatif sonuçlar üretilmesin. Sohbet katılımı tüm sınıf müfredatına hâkimiyet kanıtı sayılmasın. Bu güvenli yorum sınırı araştırma görevinin ürün şartı ve değerlendirme geçerliği önerisidir; MEB’in GINA’yı doğruladığı anlamına gelmez.

Önerilen aşamalı yol haritası — süre tahmini değildir:

| Aşama | Teslim | Bir sonraki aşamaya geçiş ölçütü |
|---|---|---|
| 0 — Temel kontrol | Salt okunur mağaza durumu; destek/fikir ayrımı; kaynaklı müfredat kataloğu; roller ve denetim kaydı | Hedef hesap/veli sınırları doğrulanmış; sağlayıcı durumları ve kaynak sürümleri test ortamında izlenebilir. |
| 1 — Sınırlı pilot | Süreli destek erişimi; SSS yayın akışı; bir sınıf ve bir ders için uzman doğrulamalı çıktı eşleme | Yanlış hesaba erişim verilemediği, sürenin bittiği, geçmişin korunduğu ve kaynak sürümünün görüldüğü doğrulanmış. |
| 2 — Kontrollü finans | Google refund/cancel/revoke; Apple talep yönlendirmesi ve durum takibi; önizleme ve belirsiz sonuç uzlaştırması | Tekrarlanan komut/bildirim, zaman aşımı, eski sipariş, yanlış ortam ve yetkisiz operatör senaryoları denenmiş. |
| 3 — Öğrenme kanıtı | Veliye etkinlik bazlı rapor; çıktı kapsamı ve veri yetersizliği; müfredat sürüm geçişleri | Eğitim uzmanı örneklemi; uydurma çıktı ve teşhis dilini engelleyen kalite incelemesi; ölçümün temsil sınırları görünür. |
| 4 — Ölçek | Kademeli özellik yayını, kaynak değişiklik takibi, sınıf/ders genişlemesi | Her yeni program için kaynak incelemesi; destek yükü, yanlış eşleşme ve erişim hatası sinyalleri kabul edilmiş hedeflerde. |

En çok tekrar kullanılacak kalıplar: sağlayıcı gerçeği ile uygulama erişimini ayırmak; hazırlanmış komutu sonucundan ayırmak; izinleri eylem ve hedef kaynak bazında denetlemek; yayımlanan içerikle taslağı ayırmak; öğrenme gözlemi ile yorumu ayırmak; resmî metni sürümlü kaynak kaydıyla taşımak.

### Gaps

- Güncel 2026 detay sayfaları doğrulandı; bütün 2026 program PDF’leri indirip satır satır 2024 sürümleriyle karşılaştırılmadı. Çevrim içi tema örneği güncel PDF ile aynı sürüm olduğu doğrulanmadan üretime aktarılmamalı.
- Bu araştırma 4. ve 8. sınıfların her ders için yürürlükteki tam program belgesini tek tek doğrulamadı. Sadece geçiş duyurusundan tüm dersler için uygulanabilirlik kaydı otomatik üretilmemeli.
- “Taslak çerçeve planı”, onaylı öğretim programı ve sınıf bazlı uygulama yılı ayrı kaynak türleridir; birbirinin yerine kullanılamaz.
- Programların ticari ürün içinde toplu yeniden kullanım/lisans koşulları incelenmedi. Kaynak gösterme, içerik çoğaltma hakkı veya MEB ortaklığı sağlamaz.
- GINA etkinliklerinin geçerliği, güvenilirliği ve çocukların beceri düzeyine ilişkin sonuç üretme yeterliliği bu araştırmayla kanıtlanmadı; tanısal çıkarım için dayanak oluşturmaz.
