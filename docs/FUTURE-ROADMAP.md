# GINA gelecek özellikleri — yürütme planı

7 Kasım 2026. Kaynak main `694f4759`; kaynaklar FUTURE-IDEAS §1–§8, DECISIONS, PROVA, QT planı ve güvenlik kayıtlarıdır. Kullanıcı doğrudan main'e küçük commit, yeşil yerel lint/tip/test ve fazlar arasında otonom ilerleme istedi. İki aktif dal (`codex/library-batch-review`, `codex/content-review-calibration`) değiştirilmeyecek. İzole çalışma ağacı kullanılır; main ilerlerse push öncesi uzlaştırılır.

## Kesin kapılar ve kararlar

- Çocuk AI ile konuşmaz; AI yalnız veli başlatır, mevcut izin/hak/kota/idempotency kullanılır. Push kişisel veri içermez. Reklam/analitik SDK yok.
- [AVUKAT]/[DOĞRULA] işaretleri onay değildir: ses saklama, ses aktarımı, Öğretsen verisi/ödeme yönlendirmesi, meet kaydı **hukuk onayı bekliyor**; uygulama yok. Sağlık/tanı çıkarımı yok.
- Her güvenlik bulgusu düzeltme + olumsuz test + tarihli `docs/security/` kaydı olur (§6.1). Yeni tablo RLS + aile sınırı pgTAP; özel anahtar yalnız izinli sonuç kapısından. Çocuk hata dili güvenli ve kıyassız; bütün metinler TR/EN.
- ❤️ kalite/kişisel tercih, ➕ çocuğa özel süreli öğretim kararıdır. İkisi otomatik puan veya ödül üretmez. “Zorlandım” dürüst bir beyan olarak kalır; davranışa rozet vermiyoruz (kaynak içindeki çelişki bu yönde çözüldü).
- S/M/L göreli efordur; saat veya bitiş garantisi değildir. KOD HAZIR, YAYINDA ve CİHAZ KABUL ayrı durumlardır. Dış kapı için sahte başarı yazılmaz.

## Kod envanteri: olan / eksik

| Kaynak | Kodda olan | Eksik |
|---|---|---|
| §1–2 | `question_bank`, çocuk/deneme bağı, veli hazırlama/inceleme, sürümlü QT anahtarları | Reaksiyon/odak tabloları, favori listesi, çocuk sinyali ve öneri sessizliği |
| §3/3a | Cevap metni/defteri, veli puanlama, mevcut izin/kanal ayarları | Sesli cevap, cihaz TR desteği; güven/mola/erteleme tercihlerinin yeni akışla birleşimi |
| §4 | `parent/prova/repeat`, plan ve progress; kitapçık/PDF, kaynak/katkı inceleme | Sinyal temelli ısı haritası/tekrar; soru bildirimi, TTS, favori PDF ve günün sorusu |
| §6 | `.github/workflows/security.yml`, audit, bilgi amaçlı leak scan; `scripts/security/post-restore-acl-check.sql`, izole pgTAP/Edge testleri; PIN/eşleştirme sunucu yolları | Dependabot/CodeQL; engelleyici sır taraması; genel migration kuralı, sistematik TR/EN enjeksiyon seti; oran sınırı kapsamının olumsuz testlerle doğrulanması |
| §7 | Takvim/görev, öğretmen paylaşımı altyapısı | Öğretsen hesap sözleşmesi, aktarım rızası, eğitmen uygunluğu, meet/ödeme doğrulaması |
| §8 | 14 tür Faz 0–2B, `question_answer_keys`, v4 kayıt/idempotency; crossword sunucu/core kapalı | Sürümlü düzenleme, grup/kütüphane yeni türler, global save RPC, gerçek sağlayıcı×tür ve fiziksel kabul; QT43/QT51 |

Envanter “eski fikir belgesinde yok yazıyor” diye mevcut kodu yeniden yapmak için kullanılmaz. F1 uygulama öncesi somut ekran: `prova-builder-ui.tsx` soru önizlemesi; başlangıçta burada beğeni, Prova'da ayrı favori listesi. AI ile benzer üretim F2'de mevcut üretim akışına bağlanır.

## Fazlar ve kabul

Durum geçişi: PLANLANDI → YAPILIYOR → KOD HAZIR → YAYINDA → KABUL TAMAM. Her faz test kanıtı ve açık sınırla güncellenir. Önce F1–F4 küçük veri/erişilebilirlik işleri; sonra F5 güvenlik, F6–F9 kişiselleştirme; ses/Öğretsen/QT Faz 3 en son. B1/B3 güvenlik ve işletim bağımlılıkları F5 ile birlikte alınır; B2/B4 fiziksel/dış kapı bekler.

### F1 — Veli ❤️, geri alma ve beğenilen sorular listesi

- Kaynak: §1, §2. Durum: KOD HAZIR (yerel kontroller; üretim/cihaz kabulü ayrı). Efor: **S**.
- Kapsam: Veli ❤️, geri alma ve beğenilen sorular listesi.
- Bağımlılık: Soru bankası, aile oturumu.
- Paket kapısı: Tüm paketler.
- Kabul: Yalnız veli kendi beğenisini yazar; tekrar istek mükerrer değildir; soru silinirse beğeni silinir; liste aile/veli sınırında.
- Test planı: pgTAP: yabancı aile/soru, cihaz, anon, sahte kullanıcı, tekrar/geri alma; mobil tip/lint.

### F2 — Çocuk ❤️/zorlandım; veli ➕ süreli tercih; pekiştirme kartı ve mini deneme

- Kaynak: §1, §1.1–1.2, §4.1–2. Durum: KOD HAZIR (ilk teslim; aşağıdaki kapsam kararları geçerli). Efor: **M**.
- Kapsam: Çocuk ❤️/zorlandım; veli ➕ süreli tercih; pekiştirme kartı ve mini deneme.
- Bağımlılık: F1, atanmış soru erişimi, sonuç/tekrar RPC.
- Paket kapısı: Sinyaller ve kütüphane tüm paketler; AI mevcut hak ve izinle.
- Kabul: ➕ çocuk başına, süreli; aynı kazanıma geç sonrası 7 gün sessizlik; çocuk puanı etkilenmez; kart yalnız veliye; kolaydan asıl düzeye 3–5 soru.
- Test planı: Aile/kardeş/atanmamış soru reddi; idempotency; süre ve gün sınırı; kart ret/tekrar senaryosu.

### F3 — Sonuçta kayıtlı çözüm yolunu aç; cihaz TTS

- Kaynak: §4.5–6. Durum: KOD HAZIR (iOS/web; Android yerel motor kapısı ve fiziksel kabul açık). Efor: **M**.
- Kapsam: Sonuçta kayıtlı çözüm yolunu aç; cihaz TTS.
- Bağımlılık: Sonuç yetkisi, Expo 58 TTS dokümanı.
- Paket kapısı: Tüm paketler.
- Kabul: Aktif denemede cevap anahtarı sızmaz; çözüm yalnız sunucu sonuç kapısı izin verirse; TTS genel+deneme override, durdurma; çocuk AI çağrısı yok.
- Test planı: Devam eden deneme olumsuz testi; TTS arka plan/ekran değişimi/döndürme ve cihaz offline doğrulama.

### F4 — Çocuk/veli soruyu bildir; yönetimde kalite kuyruğu

- Kaynak: §4.13. Durum: KOD HAZIR (yönetici kuyruğu; otomatik kaldırma yok). Efor: **M**.
- Kapsam: Çocuk/veli soruyu bildir; yönetimde kalite kuyruğu.
- Bağımlılık: Atanmış soru erişimi, backoffice rolü.
- Paket kapısı: Tüm paketler.
- Kabul: Sabit neden seçimi; aile başına sınır; bildirim otomatik suçlama/geri çekme yapmaz; yönetici gerekçeyle karar verir.
- Test planı: Başka aile, yetkisiz moderasyon, mükerrer bildirim ve oran sınırı; çocuk güvenli hata.

### F5 — Güvenlik temelleri: bulgu→test kuralı, Dependabot, CodeQL, engelleyici sır taraması, migration RLS denetimi, PIN/giriş oran sınırı, enjeksiyon seti

- Kaynak: §6.1–6.4. Durum: KOD HAZIR; GÜVENLİK KABULÜ AÇIK (ilk CodeQL 205 bulgu; triyaj ve canlı sağlayıcı red-team bekliyor). Efor: **L**.
- Kapsam: Güvenlik temelleri: bulgu→test kuralı, Dependabot, CodeQL, engelleyici sır taraması, migration RLS denetimi, PIN/giriş oran sınırı, enjeksiyon seti.
- Bağımlılık: Mevcut security.yml, ACL betiği, PIN/Auth/Edge yolları.
- Paket kapısı: Paket bağımsız.
- Kabul: Her somut açık düzeltme+olumsuz test+kayıt; CI başarısızlığı push öncesi engel; 30–50 TR/EN enjeksiyon vakası; istemci yanıtına güven yok.
- Test planı: Bilerek kusurlu migration/secret fixture reddi; eşzamanlı PIN, hesabı kilitleyerek saldırı, token sızıntısı, sahte AI çıktısı; canlı ücretli test ayrı.

### F6 — Hata güvenli/kıyassız dil; mola/akşam tercihleri; izin ve denetim görünümü

- Kaynak: §3a, §4.7. Durum: KISMEN KOD HAZIR (mola/akşam/okuma ve çocuk hata dili; çalışma tercihi geçmişi, gün ertele ve mevcut izin ekranlarına erişim hazır). Efor: **M**.
- Kapsam: Hata güvenli/kıyassız dil; mola/akşam tercihleri; izin ve denetim görünümü.
- Bağımlılık: Mevcut izinler, bildirim sessiz saatleri.
- Paket kapısı: Tüm paketler.
- Kabul: Sağlık etiketi depolamadan bugün ertele; beğeni/zorlanma puanı yok; yaş süreleri öneri, tıbbi iddia değil; tercihler geri alınır.
- Test planı: TR/EN metin; gece/timezone; izin iptali; kardeş kıyası bulunmaması; ekran okuyucu/büyük yazı.

### F7 — Veli kazanım ısı haritası, 1–3–7 tekrar ve haftalık özet

- Kaynak: §4.3–4, §4.10, §3a. Durum: KISMEN KOD HAZIR (mevcut 1–3–7 ve haftalık özet korundu, yeni kazanım gözlemleri ve isteğe bağlı favori biçimi; odak süresi seçenekleri açık). Efor: **L**.
- Kapsam: Veli kazanım ısı haritası, 1–3–7 tekrar ve haftalık özet.
- Bağımlılık: F2 sinyalleri, tamamlanmış puanlar, mevcut plan üretimi.
- Paket kapısı: Harita/manuel tekrar tüm paketler; AI özet mevcut ücretli hak.
- Kabul: Cevapsız/puan bekliyor 0 başarı sayılmaz; yetersiz örnek belirtilir; çocuklar arası kıyas yok; tekrar tekil, iptal/erteleme mümkün.
- Test planı: Kısmi puan/eksik veri, DST/timezone, çift cron, silinen çocuk, plan iptal ve tekrar dağılımı.

### F8 — Öğretmene kazanım özeti; favori PDF; uyarlanabilir zorluk

- Kaynak: §4.1, §4.9, §4.14–15. Durum: KISMEN KOD HAZIR (favoriden taslak ve kitapçık, tarayıcı kabulü ve veli onaylı zorluk önerisi). Efor: **L**.
- Kapsam: Öğretmene kazanım özeti; favori PDF; uyarlanabilir zorluk.
- Bağımlılık: F7, veli onayı, soru sürümü.
- Paket kapısı: Mevcut paylaşım/PDF hakları; tür kapısı yok.
- Kabul: Ham cevap aktarılmaz; paylaşım kapsamı/süresi/iptali; zorluk önerisi veli onaylı ve açıklanabilir; sabit şema dengesi.
- Test planı: Paylaşım iptali/başka aile, PDF anahtar sızıntısı, küçük örneklem ve aşırı tek konu önerisi.

### F9 — Günün sorusu ve öğrenme odaklı rozetler

- Kaynak: §4.11–12. Durum: KOD HAZIR (veli seçimi ve ilk tamamlama rozeti). Efor: **M**.
- Kapsam: Günün sorusu ve öğrenme odaklı rozetler.
- Bağımlılık: F7; görev/rozet idempotency.
- Paket kapısı: Tüm paketler, erişilebilir içerikle.
- Kabul: Çocuğun beğenisine puan yok; yalnız öğrenme tamamlamasına; gece baskısı ve seri kaybı yok.
- Test planı: Aynı soruyu yeniden açma ödül çoğaltmaz; mola/akşam; çevrimdışı tekrar.

### F10 — Cihaz üstü ses→metin cevap ve veli metin düzeltme/silme

- Kaynak: §3, §4.8. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Cihaz üstü ses→metin cevap ve veli metin düzeltme/silme.
- Bağımlılık: F6; mikrofon/yerel TR desteği; hukuk değerlendirmesi.
- Paket kapısı: Metne çevirme erişilebilirlik; AI puanlama mevcut hak.
- Kabul: HUKUK ONAYI BEKLİYOR: ses işleme çerçevesi netleşene kadar uygulama yok. Onay sonrası yalnız cihaz içi; destek yoksa klavye; ses saklama/buluta aktarım yok.
- Test planı: Onay sonrası ağsız cihaz ve izin iptali; yanlış tanıma düzeltme; metin yaşam döngüsü.

### F11 — Öğretsen bağlantısı, veli araması, randevu/not, görüşme

- Kaynak: §7.1–7.8. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Öğretsen bağlantısı, veli araması, randevu/not, görüşme.
- Bağımlılık: Hukuk, iki ürün sözleşmesi, eğitmen doğrulama.
- Paket kapısı: Öneri sıklığı paket bağımsız; ödeme Öğretsen tarafında doğrulanacak.
- Kabul: HUKUK ONAYI BEKLİYOR: [AVUKAT]/[DOĞRULA] aktarım, ödeme yönlendirmesi ve meet kaydı uygulanmaz. Çocukta ilan/mesaj yok; uzman otomatik önerilmez.
- Test planı: Onay sonrası kapsamlı rıza/iptal, çocuk engeli, imzalı randevu ve eğitmen uygunluğu; kayıt ayrı tüm veli rızası.

### F12 — Sürümlü yapılandırılmış soru düzenleme; grup/kütüphane taşıma; global yönetici düzenleme

- Kaynak: §8. Durum: KISMEN KOD HAZIR (F12a ve ortak grup sürümleme). Efor: **L**.
- Kapsam: Sürümlü yapılandırılmış soru düzenleme; grup/kütüphane taşıma; global yönetici düzenleme.
- Bağımlılık: QT sözleşmesi, atanmış sürüm/hash, aktif kütüphane dallarıyla koordinasyon.
- Paket kapısı: Türler tüm paketler; AI ayrı hak.
- Kabul: Başlamış deneme değişmez; payload+özel anahtar birlikte sürümlenir; çocuk projeksiyonu izinli alanlardan; toplu kütüphane üretimi kapsam dışı.
- Test planı: Eski istemci/atanmış deneme, revision/idempotency yarışları, grup puanlama ve özel anahtar/PDF sızıntı testleri.
- Uygulama sırası: (F12a) velinin kendi bağımsız sorusunu yeni kimlikle kaydetmesi ve seçili açık taslakta yeni sürümü kullanması. (F12b) AI destekli düzenleme, içerik denetimi ve ortak kaynak grubunun bütün halinde sürümlenmesi. (F12c) global yönetici sürümü, denetim izi ve grup sınavı kabulü. Kütüphane için yalnız taşıma sözleşmesi ve sentetik örnekler; içerik üretimi ayrı.
- Mevcut kod: `gina.qt_insert_structured` öğrenci payload'ını, özel anahtarı ve içerik hash'ini aynı işlemde doğrular. `save_ai_question_edit` yapılandırılmış türü reddeder. Atanmış denemeler `exam_items` ile mevcut kimlik ve hash'e bağlıdır. İlk aşamada bu zinciri değiştirmeden yeni satır oluştur; yeni kimliğe geçişi yalnız açık taslağın mevcut revizyon kontrolünden geçir. Kilitli veya gönderilmiş taslakta değiştirme denemesini reddet. Ortak kaynak üyesinde tekil düzenleme sunma.
- F12a kabul kanıtı: geçerli düzenleme yeni kimlik ve ayrı özel anahtar üretir; eski sınavın içerik hash'i, puanlaması ve öğrenci projeksiyonu aynı kalır. Aynı istek bir kimlik döndürür; değişmiş istek verisi, eski taslak revizyonu, aile dışı kaynak, çocuk oturumu ve grup üyesi olumsuz testlerde reddedilir. Veli ekranda hangi taslağa uyguladığını görür.
- F12a uygulaması: Prova önizlemesinden velinin aileye ait tekil sorusu düzenlenir. Kayıt ve açık taslak bloğunun değişimi atomiktir. Yanıt formu eski payload ve anahtarı kayıpsız temsil edebildiğinde açılır. Diğer biçimlerde metin düzenlenir, özgün yanıt kuralları aynen taşınır. Mevcut görseller ve dönem etiketi yeni sürüme bağlanır. Üretim ve cihaz kabulü açık.
- F12b incelemesi: kütüphaneden aileye yapılandırılmış soru ve ortak kaynak grubu edinme yolu son migration'larda zaten var. Eksik yol, AI veya veli kaynaklı mevcut bir ortak grubu tüm üyeleriyle atomik biçimde sürümlemek. AI düzenlemesinde ayrıca mevcut içerik uyarısı, özel anahtar ve değişmeyen eski atama birlikte doğrulanmalı.
- F12b ortak grup teslimi: açık taslakta AI veya veli kaynaklı grupta başlık, ortak metin ve bütün soru yönergeleri düzenlenebilir. Her üye yeni kimlik alır. Yapılandırılmış anahtar, puan, puanlama politikası, görsel ve dönem etiketi taşınır. Eski tip cevap alanları ve AI içerik uyarıları korunur. Tek işlemde taslak bloğu değişir. Geçersiz üye, sürüm yarışı veya yetkisiz çağrı işlemin tamamını reddeder. Eski sınav özgün üyeleri kullanır. Bu işlem cevap anahtarını yeniden yazmaz ve yeni bir AI üretimi başlatmaz. Üretim ve cihaz kabulü açık.
- F12c ilk inceleme: yönetim soru sayfası yapılandırılmış soruda üst bilgiyi doğrudan güncelliyor. Yapı ve anahtar ayrı salt okunur önizlemede. Yeni yönetici kaydı için tam yönetici yetkili bir RPC, ayrı soru kimliği ve eski/yeni kimliği içeren denetim izi gerekir. Önce global sürüm, ardından grup sınavı kabulü.
- F12c global sürüm: tam yönetici yapılandırılmış sorunun yeni kimliğini oluşturur. Öğrenci içeriği ve özel anahtar birlikte doğrulanır. Denetim kaydı eski/yeni kimlik ve işlem özeti taşır. Soru seçiminde güncel kimlik sunulur. Atanmış sınav özgün içerik ve anahtara bağlı kalır. Grup sınavı mevcut kütüphane snapshot'ını kullanır. Yapılandırılmış toplu sınav puanlaması ayrı kapsam olarak açık kalır.

### F13 — Gerçek sağlayıcı pilotu, bulmaca; dikte/sesli cevap ayrı kapılı

- Kaynak: §8 Faz 3. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Gerçek sağlayıcı pilotu, bulmaca; dikte/sesli cevap ayrı kapılı.
- Bulmaca uygulaması: veli hazırlama, çocuk ızgarası ve ipucu bazında erişilebilir kelime girişi, veli incelemesi, öğrenci ve cevap anahtarı PDF'leri, AI şeması ve Türkçe kesişim denetimi. Açılış için istemci yapısında `EXPO_PUBLIC_QT_CROSSWORD=1` ve sunucu tür anahtarı aynı yayında kullanılır. Üretim anahtarı ve fiziksel cihaz kabulü açık.
- Bağımlılık: F12, 14 tür fiziksel kabul, hukuk kapıları.
- Paket kapısı: Tür kapısı yok; AI mevcut hak/kota.
- Kabul: Bulmaca kapalı kalır: UI+PDF+AI+erişilebilir alternatif ve aynı yayın anahtarı tamamlanınca açılır. Ses/dikte hukuk onayına bağlı.
- Test planı: Sağlayıcı×tür sınırlı sentetik pilot; anyOf/additionalProperties; TR kesişim; fiziksel klavye/Pencil/PDF.

### B1 — DB ve Storage yedekleme/geri dönüş

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **M**.
- Kapsam: DB ve Storage yedekleme/geri dönüş.
- Bağımlılık: Mevcut RESTORE-RUNBOOK, ayrı ortam/maliyet.
- Paket kapısı: İşletim.
- Kabul: DB yedeği Storage dosyası sayılmaz; hash/envanter; ayrı ortamda geri dönüş; kullanıcı verisiyle canlı sıfırlama yok.
- Test planı: İzole geri dönüş + ACL/RLS; tam barındırılan tatbikat DIŞ ENGEL (ortam/maliyet).

### B2 — iPhone/iPad push ve gerçek Apple giriş/hesap silme kabulü

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **M**.
- Kapsam: iPhone/iPad push ve gerçek Apple giriş/hesap silme kabulü.
- Bağımlılık: APNs kurulu; gerçek test cihazı/hesabı.
- Paket kapısı: İşletim.
- Kabul: FİZİKSEL KABUL BEKLİYOR; ana kullanıcı hesabı silinmez; push kişisel veri içermez.
- Test planı: C15, gerçek teslimat/izin iptali/Apple token iptali.

### B3 — Otomatik sağlık/kesinti ve haftalık güvenlik fark uyarıları

- Kaynak: brand son liste, §6.2. Durum: KOD HAZIR (zamanlanmış Edge ve public kontroller, kesinti tekilleştirme, haftalık CodeQL farkı). Efor: **M**.
- Kapsam: Otomatik sağlık/kesinti ve haftalık güvenlik fark uyarıları.
- Bağımlılık: health-check, Access kontrolü, sırlar ve bildirim alıcısı.
- Paket kapısı: İşletim.
- Kabul: Zamanlanmış salt okunur kontrol; tekrarlı alarm birleştirme; hassas log/çocuk verisi bildirimde yok.
- Test planı: Kesinti/iyileşme fixture; sır redaksiyonu; gönderim olmadan dry-run; gerçek alıcı kurulumu dış kapı.

### B4 — Android FCM/Play ve satışa hazırlık

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Android FCM/Play ve satışa hazırlık.
- Bağımlılık: Dış hesaplar/sırlar, hukuk ve satın alma kabulü.
- Paket kapısı: Satış mevcut IAP.
- Kabul: DIŞ ENGEL: FCM_SERVICE_ACCOUNT_JSON/Play hesabı; mobil Firebase SDK eklenmez. Hukuk/IAP kabulü olmadan satış açılmaz.
- Test planı: Android iç test, push, satın alma/geri yükleme/iade; farklı e-posta sağlayıcısı teslimatı.

### S1 — Semgrep/MobSF, MFA, şüpheli giriş, veri çekme alarmı, phishing/olay müdahale/rotasyon

- Kaynak: §6.2, §6.4–6.6. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Semgrep/MobSF, MFA, şüpheli giriş, veri çekme alarmı, phishing/olay müdahale/rotasyon.
- Bağımlılık: F5, B3; sağlayıcı ve hukuk.
- Paket kapısı: Güvenlik tüm paketler.
- Kabul: Kaynak düzeyi kurallar önce dry-run; MFA kurtarma; `security@` gerçek teslimatı doğrulanır; yasal bildirim süreleri hukuk onayı olmadan kesin iddia edilmez.
- Test planı: Rol yükseltme, oturum iptali, yanlış alarm, kaynak/rapor sırrı ve rotasyon tatbikatı.

## Brand chat'inin son listesi ve ek öneriler

Kaynak: **brand**, `01a1a6d8-8ada-7762-a00b-775181ddaa8d`, son tamamlanan kurulum değerlendirmesi (7 Kasım). DB+Storage geri dönüş B1 → gerçek cihaz bildirim B2 → otomatik uyarı B3 → Android/FCM B4. Auth/ürün SMTP ve alan adı zaten kurulu; yeniden servis satın alınmayacak. Gerçek Apple hesap silme, ayrı e-posta sağlayıcısı teslimatı, hukuk/IAP kabulü açık. Chat'in önerisi, kurulum yapılmış kanıtı olarak sunulmaz.

Ek kararlar: sinyal kayıtları silinebilir ve yaşlandırılabilir olsun; zorluk önerisi nedenini veli görsün; küçük örneklemde kesin “zayıf” etiketi gösterilmesin; öneri kartı geri alınabilir/susturulabilir olsun. Erişilebilirlik/TTS ücretsiz; güvenlik hiçbir pakete bağlanmaz. İçerik sürümü değişirse geçmiş sinyal yeni soruya otomatik taşınmaz.

3B dünya bu planın dışında ve en sonda, kullanıcıyla ayrı yürütülür. Kütüphane toplu içerik üretimi aktif library chat'inin işidir; bu plan yalnız uygulama yetenekleri ve veri sözleşmelerini kapsar.

## Yürütme kaydı

- 7 Kasım: izole çalışma ağacı oluşturuldu, yerel WIP korundu; brand chat'inin doğru son listesi alındı. F1 ebeveyn beğeni temeliyle başlandı. Henüz üretim migration/istemci yayını yok.

- F1: izole taze DB 15/15 olumsuz/işlev kontrolü; root turbo lint/typecheck/test ve 749 core testi geçti. Kod: ebeveyn önizleme beğenisi, geri alma ve 30 satırlık sayfalı favori listesi. Liste ilk aşamada ders/konu ve soru metnini gösterir; toplu deneme oluşturma ve ayrıntılı kaynak filtresi F2 kapsamındadır. Kanıt: `release/future-f1-2026-11-07/`.

- F1 push sonrası genel CI InitPlan kuralını reddetti; düzeltme ayrı migration ile, mevcut güvenlik testi korunarak yapıldı. Tüm taze DB regresyonu 144 dosya/6.939 kontrol geçti. Yalnız yeni tablo testleri genel şema testinin yerine sayılmayacak.
- F2a: çocuk soru üzerinde geri alınabilir ❤️/zorlandım; RPC alan izin listesi ve sunucu RLS. 17 işlev/yetki kontrolü geçti. F2 henüz bitmedi: sonuç/veli kartı, ➕ süresi, öneri sessizliği ve mini deneme açık.

- F2b uygulama kararı: ilk süre **7 gün**; 3 deneme sayacı ve sınava-kadar tercihi sonraki kişiselleştirme işinde atomik deneme tüketimiyle eklenir. Süre istemciden alınmaz; aynı true isteği aktif tercihin süresini uzatmaz. Pekiştirme kartı yalnız bitmiş denemede çocuğun beyanından doğar; otomatik tanı veya başarısızlık yorumu yok. Kazanım etiketi olmayan soruda konu başlığından tahmin yapılmaz. Etiket bulunması içerik/MEB onayı anlamına gelmez. Mini set edinilmiş aile sorularından aynı sınıf/ders/kazanım etiket **kümesi** ile 3–5 sorudur, özgün soru sondadır; yetersizse açıklama + mevcut tekrar planı. Henüz AI benzer üretime otomatik bağlanmadı; ücretli çağrı yapılmadı.

- F2 ilk teslim: çocukta sınav sırasında ve sonuçta geri alınabilir sinyal; veliye gerekçesi ayrı ➕/zorlanma kartı; 7 günlük odak ve aynı kazanıma 7 günlük sessizlik; 3–5 soruluk aile içi taslak ve mevcut tekrar planına geçiş. Tam taze DB **145 dosya/6.962 kontrol**, turbo lint/tip/test **7/7**, core **749**, Node betikleri **109/109** temiz. Test kanıtı `release/future-f2-2026-11-07/`. Üretim ve fiziksel kabul henüz yok.
- F2 kapsam kararı: AI benzer üretimde tercihi/few-shot örneği kullanma **F7'ye** alındı; F5 enjeksiyon ve çıktı kontrollerini beklemesi daha güvenli. Sonraki 3 deneme/sınava-kadar tüketim politikası da F7. Karma sınıf içerebilen favori listesinden toplu set/PDF için sınıf/çocuk kapsamı F8'de kurulacak; sessizce yanlış sınıf ataması yapılmayacak. Mini set burada yalnız doğrulanmış aile erişimi ve açık kazanım etiketleriyle çalışır; MEB onayı iddiası yok.

- F3a: çözüm/açıklama yalnız `graded` denemede, atanmış soruda ve geçerli aile/çocukta iki alanlı projeksiyonla açılır; aktif veya yalnız gönderilmiş denemede kapalıdır. Taze DB **146 dosya/6.970 kontrol**, turbo 7/7 geçti; 8 yeni çözüm kapısı testi var. TTS henüz tamamlanmadı; Expo 58 Speech API Android ses motorunun ağ gereksinimi bilgisini sunmadığı için cihaz-içi garanti ayrıca ele alınacak.

- F3b: çocuk genel tercihi ve deneme `inherit/on/off` önceliği; veli tercih ekranı; soru/defterde isteğe bağlı okuma ve durdurma; soru değişimi/arka plan/izin okunamama durumunda durma. Expo 58'in resmi `expo-speech ~58.0.3` modülü eklendi. iOS kullanılabilir sistem sesi, web yalnız `localService=true`; Android ağ gereksinimi bilgisi API'de bulunmadığından düğme gizli/kapalı. Sessiz mod/kurulu TR sesi/gerçek offline ses davranışı fiziksel kabul gerektirir. İlk kapsam soru yönergesidir; görsel/matematik alternatif anlatımını veya VoiceOver'ı ikame etmez. **Yeni native derleme gerektirir; 34 için OTA uyumlu olduğu varsayılmaz.** Mikrofon/sesli cevap/ses saklama yok.
- F3 doğrulama: taze DB **148 dosya/6.988 kontrol**, okuma tercihi 10 + çözüm 8 olumsuz/işlev testi; core **754** (5 yerel ses seçim/gizlilik testi dahil). SDK uyumluluk, lint ve tip kontrolleri push öncesi tamamlanır. Gerçek sesin cihazda kabulü kapatılmadı.

- F4: çocuk atanmış sorudan veya veli aile soru önizlemesinden 4 seçmeli nedenle bildirir; idempotent request ID, kullanıcı başına 10/saat sınırı. Sunucu yalnız soru ID/neden/bağlamı tutar, cevap/çizim/ses kopyalamaz. Tam yönetici Soru Bankası içindeki ayrı kuyruktan incelendi işaretler; denetim izi tekil. Kullanılmış soruyu veya çocuğun puanını otomatik değiştirmez; yayın geri çekme mevcut içerik yayın akışında insan kararıdır. Paylaşılan cihazda aktif çocuk sınırı yeniden doğrulanır; eski kardeş isteğinin replay'i reddedilir. Taze DB **149 dosya/7.010 kontrol**, turbo 7/7 ve core 754 temiz. Backoffice mevcut TR altyapısında, yeni metinlerin EN karşılığı ortak i18n'de hazır; genel BO dil değiştirme uyarlaması F6'da izlenecek.

- F5: Dependabot npm/pnpm + Actions haftalık yapılandırması; GitHub Dependabot güvenlik düzeltmeleri etkinleştirildi. Repo API'de public, secret scanning/push protection açık görüldü; görünürlük değiştirilmedi. CodeQL JS/TS security-extended iş akışı resmi v4 commit'ine sabitlendi; ilk gerçek koşu sonucu ayrıca kontrol edilecek. Özel depo için lisans/uygunluk otomatik varsayılmaz ([GitHub koşulları](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning)).
- Sır taraması engelleyici: CI'da continue-on-error kaldırıldı; `.env.example` de taranır, gerçek sır dosyası değer okunmadan engellenir, symlink döngüsü izlenmez. Çalışma anında üretilen test PEM şablonları ve sentetik alan adları yalnız **tam kaynak satırı SHA-256** istisnasıyla geçer; aynı dosyaya eklenen yeni anahtar engellenir. 8 olumsuz test. Bilgi amaçlı telefon/e-posta/hash desenleri gerçek sır bulgusu diye sunulmaz; engelleyici anahtar bulgusu 0. Push öncesi `.githooks/pre-push` bu taramayı çalıştırır; ajan komutu `git -c core.hooksPath=.githooks push origin HEAD:main`. Diğer çalışma ağaçlarının git ayarı değiştirilmedi.
- DB: `gina.security_schema_findings()` + `scripts/security/migration-rls-audit.sql` CI'da migration sonrası çalışır. Eski iç tablolara da RLS eklendi; owner/service işçileri korunur. RLS-off, anon grant, politikasız authenticated grant, search_path eksikliği 9 olumsuz/pozitif testle sabit. Yeni açığa yeni test kuralı güvenlik kaydında zorunlu.
- PIN: veli telefonundaki çocuk PIN sayacı 5'te sınırlı; kilit bitiminde yeni pencere; biçimsiz giriş de sayılır. 13 test. Eşleştirme ve veli PIN'inin mevcut olumsuz testleri tam regresyonda geçti. Canlı Supabase Auth oran ayarları salt okunur kontrol edildi; gerçek kullanıcı/IP üzerinde yanlış giriş bombardımanı yapılmadı, sağlayıcı 429 uçtan uca kabulü ayrı açık.
- Prompt sınırı: üretim/değerlendirme v12/v8 olarak sürümlendi, JSON girdi veri olarak etiketlendi. 30 TR/EN saldırı örneği + yetkisiz ref testi, mevcut çıktı şeması ve özel anahtar testleri geçti. Bu çevrimdışı test **modelin saldırılara direncini kanıtlamaz**; sınırlı gerçek sağlayıcı pilotu F13'te açık. Yeni ücretli çağrı yapılmadı.
- F5 kanıt: **151 DB dosyası/7.032 kontrol**, ilgili Edge 130, Node 117, turbo lint/typecheck/test 7/7. CI ve CodeQL son baş commit'inde doğrulanmadan YAYINDA/KABUL TAMAM yazılmayacak.

- Uzlaştırma: başka sahibin #172 (`300328e8`) çalışması main'e alındı. Yapılandırılmış kütüphane **içe aktarma/edinme** 12 açık türde artık mevcut; özel anahtar ayrı kalıyor, OYSS için uygun olmayan türler reddediliyor. F12'de bu alt iş yeniden uygulanmayacak. Kaydedilmiş soru düzenleme, global yönetici kaydetme ve grup sınavı desteği ayrı açık kalemlerdir. Aktif iki dalın pointer veya dosyaları değiştirilmedi. Birleşik taze DB **152 dosya/7.093 kontrol**, turbo 7/7, Node 117/117 temiz.

- CodeQL ilk çalışma `42340592737` başarılı, fakat **205 açık uyarı** var. Yeşil analiz sıfır açık anlamına gelmez. Çoğu test/yayın betiği; core regex, HTML kitapçık ve kaynak ayrıştırıcı uyarıları da var. Hiçbiri otomatik bastırılmadı. Tam metadata: `release/future-f5-2026-11-07/codeql-initial-findings.json`. F5 kabulü bu triyaj tamamlanmadan kapanmaz. İlk düzeltme: HTML entity yalnız bir kez çözülür; geçersiz workbook sayılarının hata metni satır/kontrol karakteri kaçışını korur; olumsuz testler eklendi.

- F6a: mevcut okuma ayarları ekranı “Çalışma ve Okuma Tercihleri” olarak genişletildi; yeni ikinci tercih ekranı yok. Veli çocuk başına 10–60 dk mola aralığı, varsayılan kapalı akşam hatırlatma penceresi seçer. Aile timezone kullanılır; saat aralığı uyarıdır, kilit değildir. Prova ekranının ön planda geçen süresi soru türü/sekme değişiminde korunur, arka planda sayılmaz; sayaç/deadline/puan/ödül ve güvenlik bildirimleri değiştirilmez. Hatırlatma çocuğun davranışından sağlık sonucu çıkarmaz. RLS mevcut çocuk tablosu ebeveyn güncelleme sınırını kullanır; çocuğa yalnız kendi tercih projeksiyonu verilir. 12 yeni pgTAP, 7 core zaman/sınır testi; tüm taze DB 7.107 kontrol, lint/typecheck/core yeşil. Kanıt: `release/future-f6-2026-11-07/`. Henüz üretim yayını/fiziksel kabul yok. F6 kalan: uygulama geneli kıyassız dil, izin denetimi ve mevcut gün-ertele akışının birleştirilmiş kabulü.

- F5 izleme: core uzun girdi yolları güçlendirildi; üç boşluk ayrıştırıcısı doğrusal tarama, e-posta/saat/rubrik erken sınırı, defter ölçü aramasında sayı ortası yeniden tarama engeli. 1.500 semantik eşdeğerlik örneği ve 100–200 bin karakterli olumsuz girdiler; 768 core testi, lint/typecheck yeşil. Uyarıların tamamı kapandı iddiası yok; yeni CodeQL sonucu ve betik triyajı sürüyor.

- F7a: mevcut Gelişim ekranına ortak kazanım kümesi gözlemleri eklendi. Mevcut 1–3–7 tekrar (`makeRepeatCalendarDrafts`) ve haftalık rapor yeniden yapılmadı. Son cevap soru kimliği başına bir kez sayılır; kütüphaneden tekrar edinilen aynı item bağımsız kanıtı artırmaz. 5 farklı puanlanmış sorudan azsa sayısal ortalama/renk kuvveti gösterilmez; bekleyen/boş cevaplar paydada değildir, kısmi puan korunur. Aynı sorudaki çoklu kazanım ayrı ayrı ölçülmüş gibi parçalanmaz. Aile/çocuk/eğitim dönemi/sınıf/ders/tarih kapsamı mevcut raporla aynıdır. Pekiştirme kapsamı ilk kazanım yerine tam sıralanmış kümeye taşındı; eski sessize alma süreleri taşınır. 14 yeni SQL, 4 şema testi; tüm DB 7.121, core 772, lint/typecheck yeşil. F7 açık: AI üretiminde tercih/few-shot entegrasyonu, “3 deneme/sınava kadar” atomik tüketim ve fiziksel/görsel kabul.

- Yayın ayrımı düzeltmesi: GitHub iş akışları main push'ta **dağıtım denetimini tetikler**. Gerçek adım kayıtları kontrol edildi: bu depoda dağıtım sırları tanımlı olmadığı için Cloudflare yükleme adımları **atlandı**. Yeşil “Deploy” işi yeni canlı paket değildir. Bu tur DB/Edge/web/BO/native üretim yayını yapılmadı. Yeni DB tablolarına bağlı yeteneklerin uçtan uca kabulü eşleme tamamlanmadan yapılmış sayılmaz.

- F8a: favorilerde aynı sınıf ve açıkça seçilen çocukla en fazla 10 seçim; ortak metin/görsel grubu bütün olarak tek blok, toplam 100 soru üst sınırı. Veli mevcut Prova düzenleyicisinde kontrol eder; otomatik atama, AI çağrısı veya kota yok. Tek dokunuş kilidi ve aynı taslak/istek kimliği tekrarları sınırlar. Sentetik gerçek web uygulamasında 390×844/1280×800; tercih kaydı, az veri, iki sorulu ortak kaynak taslağı ve yatay taşma testi geçti. Kanıt: `release/future-f8-2026-11-07/`. Favori PDF, öğretmen özet kapsamı, zorluk önerisi ve fiziksel kabul hâlâ açık.

- F8b: kitapçığın “Favorilerim” kaynağı aile/veli RLS'iyle yalnız kendi favorilerini alır; sınıf/ders/konu filtresi, 500 kaynak/100 baskı sınırı. Öğrenci nüshasında anahtar ve çocuk adı yok; ortak kaynak ayrı bağlam olarak korunur. Sentetik tarayıcı yazdırma kontrolü geçti; fiziksel PDF/yazıcı kabulü açık.
- Dağıtım uyumu: prod ledger salt okunur denetlendi; son sürüm `20261107180500`, F1–F8 SQL henüz uygulanmadı. Otomatik web/BO dağıtımı nedeniyle UI eski şemada yeni butonları sunmuyor. `future_learning_ready` yalnız imzalı istemciye açık; release sırasında bu migration en son, diğer migration/Edge kontrollerinden sonra etkinleşir. Eski sunucu simülasyonu geçti. Yeni native binary ve DB/Edge yayın sırası açık. Yeni taze DB: 155 dosya/7.123 kontrol; 12 web kabulü, 772 core, lint/typecheck yeşil.

- B3a: `Public production health` iki saatte bir ve elle çalışır. Veli webi, BO Access, tablet manifesti ve yapılandırılmışsa anon Auth/REST; yalnız açık istemci yapılandırması, yönetim tokenı/oturum/çocuk verisi yok. Mevcut fixture'larla 26/26 probe ve public env testi. Edge envanteri yetkisiz olduğundan açıkça atlanır; bu strict yayın doğrulaması değildir. GitHub başarısız iş durumu kullanılır; yeni alıcıya mesaj gönderilmez. Tekilleştirilmiş kesinti/iyileşme alarmı ve haftalık güvenlik farkı ayrı B3b kabulü.

- B3 ilk elle çalıştırmada (`42343912727`) public istemci yapılandırmasının da GitHub'da bulunmadığı görüldü. İkisi yoksa anon Auth/REST açıkça atlanır; kısmi/yanlış yapılandırma hâlâ başarısız olur. Hiçbir yönetim anahtarı eklenmedi. Çalışan mevcut yayınların public kontrolleri, yeni bir dağıtım kanıtı değildir.

- B3a manuel canlı çalışma [`42344138835`](https://github.com/enescevik/gina/actions/runs/42344138835) geçti. Public web, Access ve tablet alias erişildi; Auth/REST/Edge yapılandırmasız olduğu için atlandı. CI `42344066986` yeşil.
- F6b: çocuk ekranlarının ortak hata bileşeni yalnız kısa TR/EN bağlantı/PIN/yeniden deneme metni sunar; ham sağlayıcı hatası ve paket yükseltme gösterilmez. Prova mola sayacı zaman farkını React güncellemesinden önce alır; arka plan/saat geri kayması ve uzun donma kontrolü eklendi. Üç hata dili ve bir süre testi. Veli hata ayrıntıları değişmedi.
- F7b: tamamlanmış haftanın özetine takma adlı Prova sayımları eklendi (puanlı/kısmi/bekleyen/boş, isteğe bağlı çocuk işaretleri, tekrar karşılaşma). Çocuk/okul adı, ham soru/cevap, kaynak ve veli özel favorileri AI'ya gitmez. Mevcut haftalık AI paket/kota, veli tetiklemesi ve dondurulmuş bağlam korunur; eski snapshot tekrar ücretlendirilmez. Konu ustalığı veya sağlık yorumu yok. 6 SQL sınır/çıktı, 37 Edge, 776 core; tüm taze DB 156 dosya/7.129 kontrol. Ücretli model çağrısı, canlı migration veya native yayın yok. F7 tercihle soru üretimi ve süre seçenekleri açık.
- Güvenlik izleme: ilk 10 ayrıştırma uyarısının CodeQL açık listesinden kalktığı doğrulandı. Gözlem 195 açık uyarı (32 yüksek, 163 orta); tüm depo güvenlik kabulü hâlâ açık. IPA incelemesindeki shell zincirleri kaldırıldı; 118 Node kontrolü ve sentetik IPA denetimi geçti.

- F6c: çalışma ve sesli okuma tercihleri için veliye son 20 değişikliği gösteren geçmiş eklendi. Yalnız gerçek değer değişiklikleri kayda girer; doğrudan tablo erişimi yoktur. Çocuk, anonim ve başka aile kapsamı kapalı; istemciye aktör kimliği yerine “siz / aileden bir veli / bilinmiyor” döner. 157 dosya/7.135 taze DB kontrolü ve son eklenen gerçek yabancı aile testiyle hedefli 7/7; 776 core ve lint/typecheck geçti. Bu kayıt mikrofon, AI özeti veya öğretmen paylaşımı için izin toplamaz. Gün ertele ve diğer izinlerin tek görünümde birleştirilmesi açık.

- F6d: Veli, çalışma tercihleri ekranından aile saat dilimindeki bugünü erteleyebilir. Henüz gönderilmemiş görev yarına taşınır. Yarın zaten planlı olan rutin bir kez görünür. Bugüne kalan Prova tekrarları ve aynı dizideki sonraki oturumlar yerel saatlerini ve aralıklarını koruyarak bir gün kayar. Tamamlanmış veya gönderilmiş işler ve yıldızlar korunur. Sağlık gerekçesi toplanmaz. Aynı güne ait tekrar çağrı ilk sonucu döndürür. Çocuk Bugün ve Haftam ekranları tarihli plandan okur. 158 dosya ve 7.152 SQL kontrolü, 776 core testi, lint ve tip denetimi geçti. Üretim ve fiziksel kabul bekliyor.

- F6e: Veli çalışma ayarlarından mevcut haftalık AI özeti onayına ve iptal edilebilir öğretmen bağlantılarına ulaşabilir. TTS ve mola geçmişi aynı ekranda. Yapay zekâ onayı işlem bazında kalır, ses kaydı izni hukuk kapısında kalır.
- F7c: Veli, serbest Prova üretiminde kendi favorilerinin biçim örüntülerini isteğe bağlı kullanabilir. Aynı sınıf ve ders, son 12 favoriden en fazla üç sabit tür/zorluk/düşünme düzeyi örüntüsü. Başka velinin tercihi, soru metni, cevap, kimlik ve serbest kaynak alanı sağlayıcıya gitmez. Yazılı, senaryo ve belge yollarında kontrol kapalıdır. Makbuz ve istemci günlüğü seçimi dondurur. Önceki SQL regresyonu 158 dosya ve 7.152 kontrol yeşil. Yeni aile/veli/alan sınırı testleri 5/5, 32 Edge güven sınırı testi ve 776 core geçti. Üretim ve gerçek sağlayıcı kabulü açık.

- F8b: Serbest, tek dersli pratikte veliye son 30 günün aynı kazanım grubundan en az beş farklı puanlı sorusuyla zorluk önerisi gösterilir. Birden çok grup, bekleyen puan, az veri ve 60–84,9 arası ortalamada öneri çıkmaz. 60 altı kolay, 85 ve üzeri orta bir başlangıç önerir. Bu eşikler ürün tercihi, ölçüm sonucu değildir. Yazılı/senaryo kapsamı dışarıda kalır. Zorluk ancak veli düğmeye dokununca değişir. 778 core, lint ve tip denetimi geçti. Öğretmene ders bazlı kazanım paylaşımı açık.

- F8c: Veli tek ders seçerek son 30 günün puanlanmış kazanım özetini önizler ve süreli öğretmen bağlantısı oluşturur. En az beş puanlı yanıt içeren satırlar paylaşılır. Bağlantı yalnız onaylanan anlık özeti taşır. Veri önizleme ile kayıt arasında değişirse yeni onay gerekir. Mevcut süre sonu ve geri çekme geçerlidir. Taze yerel SQL: 160 dosya, 7.169 kontrol, sıfır hata. Lint, tip denetimi ve çekirdek testleri geçti. Üretim ve cihaz kabulü açık.

- F9: Veli mevcut, başlanmamış, süresiz ve tek soruluk bir pratik atamasını ailenin yerel günü için öne çıkarabilir. Çocuk odasında öncelikli görev/ödev yoksa isteğe bağlı kart görünür; yapılandırılan sakin saatlerde ve gönderimden sonra gizlenir. Yanıt gönderildiğinde ilk tamamlama rozeti bir kez verilir. Boş gönderim, beğeni, seri, ek yıldız, AI çağrısı ve push yok. Otomatik kütüphane seçimi, diğer tekrar rozetleri ve fiziksel cihaz kabulü açık.

- B3b: Web kök kontrolü artık Pages yönlendirmesinin hedefi olan ginafamily.com güvenlik başlıklarını denetler. İki saatlik kontrolde REST/Auth yalnız yayımlanabilir istemci anahtarıyla çalışır. Yedi özel Edge rotasında kimliksiz OPTIONS 204 ve GET 401 beklenir. Bu kontrol girişli iş akışlarını doğrulamaz. GitHub durum anlık görüntüleri kesinti ve iyileşme geçişlerini saklar. Haftalık CodeQL karşılaştırması ilk çalışmada taban çizgisi kurar. Yeni bulgular GitHub çalışmasında bir kez işaretlenir. Harici bildirim alıcısı yapılandırılmadı.
