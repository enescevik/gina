# F01 — Sosyal alan pilotu ve sonraki ürün önerileri (plan ve karar dosyası)

6 Kasım 2026, gece devri. Kaynak: main `de969c1`; dayanak belgeler [`ACADEMIC-CALENDAR-AND-ANNOUNCEMENTS.md`](ACADEMIC-CALENDAR-AND-ANNOUNCEMENTS.md) §"Gelecek: ebeveyn toplulukları", [`DECISIONS.md`](DECISIONS.md), [`CLAUDE-REMAINING-WORK.md`](CLAUDE-REMAINING-WORK.md) F01/S04/§3, `docs/legal/`.

**Bu belge uygulama değildir.** Hiçbir ekran, tablo, RPC, Edge işi veya yayın yapılmadı; tasarım/uygulama onayı varmış gibi okunmamalıdır. F01'in kapanışı bu planın teslimi ve §9'daki kararların Enes tarafından kaydıdır. Her başlıkta etiket:

- **MEVCUT** — bugünkü ürün kuralı/şemada zaten karşılığı var, yeni karar gerektirmez.
- **AYRI KARAR** — Enes'in açık kararı olmadan başlanmaz.
- **3B SONRASI** — sıralamada WORLD-01'in ve son yayın kabulünün (R02) arkasına gider.

---

## 1. Ebeveyn konu odaları pilotu

### 1.1 Amaç ve amaç olmayan — AYRI KARAR (açılış), MEVCUT (ilke)

Amaç: benzer günlük sorunu olan velilerin (okul değişikliği, ders rutini, ortak tablet, okula başlama, ekran süresi) **aranabilir deneyim ve işe yaramış çözüm** bulması. Başarı "ekranda geçirilen süre" değil, "soruya yararlı yanıt geldi mi".

Amaç olmayan: sınırsız akış, takipçi/beğeni ekonomisi, çocuk karşılaştırma, tanı/değerlendirme, reklam. Sağlık/gelişim yargısı üretmeme ilkesi (§3 kuralları) odalara da uygulanır.

İlk sürümde **olmayanlar** (her biri ayrı karar, §7): özel mesaj, okul/sınıf grupları, fotoğraf/video yükleme, konum, dış paylaşım bağlantısı, çocuk görünürlüğü.

### 1.2 Katılım kuralı — MEVCUT (18+ veli) + AYRI KARAR (doğrulama eşiği)

- Yalnız **18+ ebeveyn/vasi** hesabı (DECISIONS: hesap sahibi yalnız 18+). Çocuk profili, çocuk modu ve eşleştirilmiş tablet oturumu odaları hiçbir biçimde göremez; RLS'te `gina.is_parent()` + çocuk-modu dışı oturum şartı.
- **Doğrulanmış hesap** tanımı (karar): e-posta doğrulanmış **ve** en az bir aile üyeliği **ve** hesap yaşı ≥ 7 gün. Not: Supabase "Confirm email" alan adı/SMTP gelene kadar kapalı (X01); e-posta doğrulaması yokken pilot açılamaz → pilot X01'e bağımlıdır.
- Davetli pilot: ilk 50–100 veli, Enes'in elle onayladığı listeden; `entitlement_overrides` benzeri bir bayrak (`community_pilot`) ile, paketten bağımsız. Ücretli paket şartı yok (karar: §9-3).
- Katılım **isteğe bağlı ve açık onaylı**; aile verisinden (çocuk sınıfı/okulu) otomatik oda üyeliği türetilmez. Kullanıcı odasını kendisi seçer.

### 1.3 Takma ad ve görünürlük — AYRI KARAR

- Odalarda **zorunlu takma ad**; gerçek ad, e-posta, aile adı, çocuk adı hiçbir yerde görünmez. Takma ad hesap başına tek, 30 günde en çok bir kez değişir; eski takma ad geçmiş gönderilerde güncellenir (gönderi silinmez).
- Takma ad filtresi: gerçek-ad kalıpları engellenmez (tespit edilemez) ama çocuk profilindeki adla **birebir** eşleşen takma ad reddedilir ("çocuğunun adını kullanma" uyarısı).
- Profil sayfası yok: takma ad + katıldığı tarih ay/yıl + "yararlı bulunan yanıt" sayısı. Çocuk sayısı/yaş/sınıf/okul/il **gösterilmez**. Kullanıcı isterse "ilkokul velisi / ortaokul velisi" gibi kaba bir etiket seçer (serbest metin değil, sabit liste).
- Hesap silinince gönderiler "silinmiş veli" olarak anonimleşir veya tamamen silinir (karar: §9-6; hukuki değerlendirme `[AVUKAT]`).

### 1.4 Gönderi modeli — AYRI KARAR

- Oda → **soru/deneyim gönderisi** → yanıtlar → "bana yararlı oldu" işareti (sayısı gösterilir, kimin işaretlediği gösterilmez). Beğeni/puan/sıralama yok; yanıtlar kronolojik, "yararlı" olanlar üstte sabitlenebilir (yalnız gönderi sahibi en çok 1 yanıtı "çözüm" işaretler).
- Metin 2.000 karakter, yanıt 1.000; bağlantı yalnız `meb.gov.tr`, `e-okul`, `*.gov.tr`, `*.edu.tr` alan adlarına izinli (allowlist), diğerleri düz metin olarak kalır ve tıklanmaz.
- Arama: oda içi tam metin (Postgres `tsvector`, Türkçe stemming yok → `simple` + unaccent); kişisel veri içeren alanlar aranmaz çünkü yok.
- Gönderi düzenleme 15 dk; sonrası yalnız silme. Düzenleme geçmişi moderasyona görünür.

### 1.5 Çocuk verisi sınırları ve otomatik uyarı — MEVCUT (ilke) + AYRI KARAR (uygulama)

Yasak içerik: çocuğun adı/soyadı, okul adı, sınıf-şube, öğretmen adı, fotoğraf/video, konum, sağlık/tanı/ilaç, sınav puanı/not, aile içi ihtilaf ayrıntısı.

Otomatik ön uyarı (gönderim öncesi, istemci + sunucu):
1. Gönderen velinin **kendi** çocuk profillerindeki ad/takma adla birebir sözcük eşleşmesi → "çocuğunun adını paylaşmak üzeresin" engeli (sunucu karşılaştırır, çocuk adı istemciye başka hiçbir veriyle birlikte dönmez; eşleşme sayısı log'lanmaz).
2. Sözlük tabanlı kalıplar: "ilkokulu/ortaokulu/anadolu lisesi/koleji" + büyük harfli sözcük, "öğretmeni", "şube", "/A sınıfı", "LGS … puan", "tanı/otizm/DEHB/ilaç" → yumuşak uyarı ("okul veya sağlık bilgisi içeriyor olabilir; paylaşmadan önce çıkarmayı düşün"), gönderime izin verir ama **moderasyon kuyruğuna önceden işaret** düşer.
3. Fotoğraf/video/ses eki yok (uygulanmaz → kural tartışması yok).
4. Telefon/e-posta/IBAN kalıpları → sert engel.
5. AI tabanlı sınıflandırma **kullanılmaz** (DECISIONS: AI yalnız ebeveyn alanında ve ücretli paketlerde; topluluk gönderileri Anthropic'e gönderilmez). İleride değerlendirilirse ayrı rıza ve ayrı karar.

Bu kurallar [`veli-beyani-ve-cocuk-profili-onayi.md`](legal/veli-beyani-ve-cocuk-profili-onayi.md) §5 (asgari veri) ve [`gizlilik-politikasi.md`](legal/gizlilik-politikasi.md) §9 (çocukların gizliliği) ile uyumlu; topluluk için yeni bir madde gerekir (§1.9).

### 1.6 Raporla / engelle — AYRI KARAR

- Her gönderi/yanıt: **Şikâyet et** (neden: çocuk verisi, hakaret/taciz, sağlık/tanı iddiası, spam/reklam, şiddet-istismar-kendine zarar, diğer) + isteğe bağlı 300 karakter. Şikâyet eden kimliği yalnız moderasyona görünür; şikâyet edilen göremez.
- **Engelle**: engellenen kullanıcının gönderileri/yanıtları engelleyene gizlenir, engellenen bunu bilmez; iki yönlü değildir. Engel listesi hesap başına 200.
- **Odadan ayrıl**: üyelik silinir; gönderiler kalır (takma adla). Ayrılan kullanıcı isterse "tüm gönderilerimi sil" seçer (§1.8).
- Şikâyet eşiği: aynı içeriğe 3 bağımsız şikâyet → içerik **otomatik gizlenir** (silinmez), kuyruk önceliği yükselir. Şiddet/istismar/kendine zarar nedeniyle tek şikâyet → anında gizle + 2 saat SLA.

### 1.7 Moderasyon ve itiraz — AYRI KARAR (kim, SLA)

| Konu | Öneri |
|---|---|
| Kim | Pilotta tek moderatör: Enes veya atadığı kişi; backoffice `operation_roles` içinde yeni rol `community` (mevcut `content` rolünden ayrı; okul-rapor kuyruğunda olduğu gibi çocuk/aile kimliği gösterilmez). İkinci kişi olmadan **itiraz** incelenemez → pilot için en az 2 kişi gerekir ya da itiraz SLA'sı "7 gün, tek kişi, gerekçe yazılı" olarak kabul edilir (karar §9-5). |
| Kuyruk | Şikâyet + otomatik işaretler + yeni kullanıcıların ilk 3 gönderisi (ön inceleme). Öncelik: güvenlik > çocuk verisi > diğer. |
| SLA | Güvenlik 2 saat (gizleme otomatik, karar 24 saat); çocuk verisi 24 saat; diğer 72 saat. Pilotta bildirim: backoffice + e-posta (alan adı/SMTP gelince). |
| Kararlar | Kaldır (gerekçe kodu + metin), Düzenleterek geri aç (kullanıcıya hangi parçanın sorunlu olduğu söylenir), Uyarı (3 uyarı → 30 gün yazma yasağı), Askıya al (okuma kalır), Pilot'tan çıkar. Hesap silme **yapılmaz**; hesap aile uygulamasının hesabıdır. |
| Kayıt | `community_moderation_log` (ne, kim, ne zaman, gerekçe kodu, önce/sonra içerik hash'i); mevcut `audit_log` kalıbıyla. Şikâyet eden kimliği log'da **hash'li**. Saklama 24 ay, sonra anonimleştirme `[AVUKAT]`. |
| Şeffaflık | Kullanıcıya her karar bildirilir (uygulama içi bildirim; push metni genel: "Topluluk gönderin hakkında bir karar var", kişisel veri yok — PUSH ilkesi). |
| İtiraz | 14 gün içinde tek itiraz; farklı kişi inceler; 7 gün SLA; sonuç gerekçeli; itiraz sonucu kesindir (yargı yolu saklı, `[AVUKAT]`). |
| Yönlendirme | Şiddet/istismar/kendine zarar içeriğinde ekip klinik değildir; sabit yönlendirme metni: 112, ALO 183 (Sosyal Destek), Şiddet Önleme ve İzleme Merkezleri, okul rehberlik servisi. Metin psikolog/pedagog bakışıyla yazılır ama "uzman onaylı" denmez (§3 kuralı). |

Moderasyon kapasitesi hesabı: 100 veli × günde ~5 gönderi/yanıt = ~500 içerik/gün; %2 şikâyet → ~10 inceleme/gün → tek kişi için ~30–45 dk/gün. 1.000 veliye çıkınca ikinci moderatör şart.

### 1.8 İçerik silme ve saklama — AYRI KARAR, `[AVUKAT]`

- Kullanıcı silme: gönderi anında gizlenir; 30 gün "soft delete" (şikâyet incelemesi için), sonra kalıcı silme. Yanıtlar kalır, üst gönderi "silindi" görünür (iş parçacığı bütünlüğü) — alternatif: üst silinince tüm iş parçacığı silinir (karar §9-7).
- Hesap silme ([`hesap-ve-veri-silme.md`](legal/hesap-ve-veri-silme.md)): topluluk içeriği için iki seçenek sunulur — "anonimleştir (silinmiş veli)" veya "tamamen sil". Varsayılan öneri: **tamamen sil**, çünkü ürün ilkesi asgari veri. `[AVUKAT]` Anonimleştirilmiş içerik kişisel veri sayılır mı; takma adlı yazılar + yazım stili yeniden tanımlamaya yeter mi?
- Moderasyon kaldırması: içerik 90 gün karantina (itiraz + yasal talep), sonra silme; log 24 ay.
- Yedekler: Supabase PITR/yedek penceresi (7–30 gün) sonrası fiziksel silme; politikada zaten var (§7 hesap-ve-veri-silme).
- Şikâyet kayıtları: 24 ay; şikâyet eden kimliği 90 gün sonra hash'e indirgenir.
- Yetkili makam talebi: `[AVUKAT]` saklama süresi uzatma ve bildirim yükümlülüğü (5651 kapsamı — bkz. §1.9).

### 1.9 KVKK/GDPR ve mevzuat etkisi — AYRI KARAR, `[AVUKAT]`

Yeni işleme faaliyeti: "topluluk gönderileri ve şikâyet/moderasyon kayıtları". Belgelerde değişmesi gerekenler: Gizlilik Politikası §3/§4/§10, KVKK Aydınlatma §3.1/§5/§9, Kullanım Koşulları §6 (yasaklı kullanım) + yeni "Topluluk Kuralları" eki, Hesap ve Veri Silme §4/§5, Açık Rıza Metinleri §6 (yeni rıza türü şablonu).

Avukata sorular:
- `[AVUKAT]` Hukuki dayanak: topluluk katılımı için **açık rıza** mı (geri alınabilir, m.5/1) yoksa sözleşmenin ifası (m.5/2-c) mi? Katılım isteğe bağlı ek özellik olduğu için öneri: hizmete özel açık onay + Topluluk Kuralları kabulü; rıza geri alınırsa içerik ne olur?
- `[AVUKAT]` **5651 sayılı Kanun**: Gina, kullanıcı içeriği barındırdığı anda "yer sağlayıcı" sayılır mı; yer sağlayıcı bildirimi/faaliyet belgesi, trafik bilgisi saklama (1–2 yıl) ve uyar-kaldır yükümlülükleri bireysel geliştiriciye nasıl uygulanır? Bu, pilotun **en büyük hukuki belirsizliğidir**; cevapsız açılmamalı.
- `[AVUKAT]` 7499/sosyal ağ sağlayıcı eşikleri (1 milyon günlük erişim) uzak; ancak "sosyal ağ" tanımına girmemek için ürünü nasıl adlandırmalıyız ("destek odaları")?
- `[AVUKAT]` Çocuğa ilişkin kişisel verinin **üçüncü kişi (başka veli)** tarafından paylaşılması: Gina'nın sorumluluğu ve kaldırma süresi; çocuk adına KVKK başvurusunun topluluk içeriğine uygulanması (kvkk-basvuru-formu §5).
- `[AVUKAT]` Moderasyon kararlarının "otomatik karar" (KVKK m.11/g, GDPR 22) sayılmaması için insan onayı şartı yeterli mi? (Otomatik gizleme → insan kararı modeli.)
- `[AVUKAT]` GDPR (AB'de yaşayan TR veliler): DSA "çevrimiçi platform" yükümlülükleri çok küçük işletme muafiyeti; takma ad + yaş 18 beyanı yeterli mi?
- `[AVUKAT]` Apple App Store 1.2 (UGC): şikâyet, engelleme, filtre, iletişim bilgisi zorunlu — plan bunları karşılıyor; "Kids Category seçilmez" kararı korunur. Google Play UGC politikası aynı.
- `[AVUKAT]` Saklama süreleri §1.8.

Veri haritası (DPIA taslağı için): takma ad, oda üyelikleri, gönderi/yanıt metni, "yararlı" işaretleri (kimlik hash'li), şikâyetler, engel listesi, moderasyon log'u, uyarı sayacı. **Yok:** çocuk kimliği bağlantısı, okul/sınıf bağlantısı, konum, cihaz parmak izi, analitik SDK.

### 1.10 Yetişkin katılımı ve güvenlik — AYRI KARAR

- Odalar velilere özeldir; öğretmen/uzman "resmî" rolü pilotta yok (öğretmen paylaşımı mevcut TEACHER_SHARE akışıyla ayrı kalır). Uzman içeriği gerekiyorsa editoryal "yardımcı kaynak" kartı olarak ayrı etiketle yayımlanır; velilerin kişisel deneyimiyle karışmaz.
- Yetişkin–yetişkin taciz riski: takma ad, DM yok, engelle, şikâyet, 3-uyarı kuralı. Oda içinde kullanıcıya "@" ile seslenme yok (bildirim spam'i ve hedef gösterme riski).
- Çocuk oturumu sızıntısı: tablet/çocuk modu JWT'si (`gina` claim) topluluk RPC'lerinden kesin reddedilir; ebeveyn PIN'i çocuk modundan çıkış için şart (mevcut).

### 1.11 Ölçüm (kişisel veri içermeyen) — MEVCUT (ilke: analitik SDK yok)

Yalnız sunucu tarafı toplu sayaçlar, günlük granülerlikte, kullanıcı kimliği olmadan:
- Gönderi başına **yararlı yanıt oranı** (en az 1 "yararlı" yanıt alan soru yüzdesi) — hedef ≥ %60.
- **Çözüm işaretlenme oranı** (gönderi sahibi çözüm seçti) — hedef ≥ %40.
- **İlk yanıt süresi medyanı** — hedef ≤ 24 saat.
- **Şikâyet çözüm süresi** (SLA içinde kapanan oran) — hedef ≥ %90.
- **Güven hissi**: pilot sonunda isteğe bağlı, anonim 3 soruluk anket (1–5): "burada paylaşırken güvende hissettim", "yararlı buldum", "devam etsin". Yanıtlar kimliksiz, toplu.
- Çocuk verisi uyarısı tetiklenme sayısı (içerik saklanmaz, yalnız sayaç) — düşüş trendi beklenir.
- **Ölçülmeyen:** oturum süresi, açılış sayısı, kaydırma, kişi bazlı etkileşim. Push açılma oranı ölçülmez.

### 1.12 Pilot ölçütü ve durdurma koşulu — AYRI KARAR

Başlangıç şartları (hepsi): X01 (alan adı + SMTP + e-posta doğrulama) hazır; `[AVUKAT]` 5651 ve rıza soruları cevaplanmış; Topluluk Kuralları + güncellenmiş hukuk metinleri yayında; 2 moderatör; backoffice kuyruk ekranı; R02 bitmiş (F01 sırası).

Süre: 8 hafta, 3 oda ("Okula başlama", "Ders rutini ve ödev", "Ortak tablet ve ekran süresi"), 50–100 davetli veli.

Başarı (devam kararı için): yararlı yanıt oranı ≥ %60 **ve** şikâyet SLA ≥ %90 **ve** çocuk verisi kaldırması ≤ 1/hafta son 4 haftada **ve** anket "güvende hissettim" ortalaması ≥ 4,0.

**Durdurma (otomatik, Enes'e sorulmadan okuma moduna alma):** kapasite dışı güvenlik şikâyeti (2 saat SLA'yı 2 kez kaçırma); herhangi bir çocuk fotoğrafı/okul-ad-sınıf üçlüsü yayında 24 saatten uzun kalırsa; moderatör sayısı 1'e düşerse 7 günden uzun; `[AVUKAT]` cevabı "yer sağlayıcı yükümlülükleri karşılanamaz" ise. Okuma modu = yazma kapalı, mevcut içerik görünür, 30 gün sonra kullanıcıya "sil/anonimleştir" seçimi ile kapanış.

### 1.13 Teknik taslak (karar sonrası uygulanacak; şimdi yalnız kapsam tahmini)

Tablolar: `gina.community_rooms`, `community_memberships` (user, room, alias snapshot), `community_posts`, `community_replies`, `community_helpful` (hash'li), `community_reports`, `community_blocks`, `community_moderation_log`, `community_pilot_flags`. RLS: yalnız `is_parent()` + pilot bayrağı + çocuk modu dışı oturum. Yeni Edge işi yok (sözlük kontrolü SQL'de). Backoffice: `community-queue.tsx`, `community-rooms.tsx`. Mobil: 4 ekran (odalar, oda akışı, gönderi, yeni gönderi) + ayarlar bölümü. Tahmin: 3–4 hafta geliştirme + 1 hafta kabul; hukuk ve X01 beklemesi ayrı.

---

## 2. Ayrı öneri: QR ile cihaz eşleme — AYRI KARAR

| | |
|---|---|
| Bugün (MEVCUT) | Tablet anonim Auth + **6 haneli eşleştirme kodu**; iptal anında (`devices.revoked_at`); çocuk PIN'i. |
| Öneri | Veli telefonunda tek kullanımlık QR (kod + kısa imza, 2 dk TTL) → tablet kamerayla okur; aynı RPC'ye düşer. 6 hane **kalır** (kamera izni vermeyenler, web). |
| Kapsam | Mobil: QR üretimi (veli) + tarayıcı (çocuk cihazı) — `expo-camera`; sunucu: mevcut pairing RPC'ye `source: 'qr'` alanı; web'de QR yalnız gösterim. 2–3 gün. |
| Bağımlılık | Kamera izni metni (App Store/Play), erişilebilirlik (QR okunamazsa koda düşüş), fiziksel cihaz testi (X05). |
| Risk | QR'nin ekran görüntüsüyle paylaşılması → TTL 2 dk + tek kullanım + eşleşince veli cihazına bildirim ("yeni cihaz eşlendi") şart. Kamera izni çocuk modunda kalıcı kalmamalı (eşleme bitince iptal). |
| Etiket | AYRI KARAR; küçük iş; 3B'den önce yapılabilir ama R02'yi bloklamaz. |

## 3. Ayrı öneri: otomatik tatil yeniden planlama — AYRI KARAR

| | |
|---|---|
| Bugün (MEVCUT) | Takvim dönemleri dışındaki tarihler uyarı verir; tek günlük tatil **programı silmez**; duyuru programı değiştirmez (ürün kuralı, S04 README §kurallar). |
| Öneri | Yayımlanmış takvim/tatil günü ile çakışan **okul kaynaklı** öğeler (ders programı dersleri, "okula götür" çanta görevleri) için veliye **öneri kartı**: "16–20 Kasım ara tatil: bu haftanın ders rutinlerini duraklatalım mı?" Tek dokunuşla duraklat / geri al; otomatik silme yok. Ev görevleri ve ödüller dokunulmaz. |
| Kapsam | Veri: tatil günleri için yeni küçük tablo (`education_calendar_days`: place, stage, date, kind) — tohum verisi S04 `public_holidays` + `breaks`. Mantık: aile saat diliminde haftalık kontrol (mevcut `gina-education-reminders` zamanlayıcısı genişletilir). Mobil: öneri kartı + geri alma. 1–2 hafta. |
| Bağımlılık | S04 takvimlerinin yayımlanmış olması; L01/L04 rutin ve program geçmişi (duraklatma geri alınabilir olmalı); push metni genel. |
| Risk | Özel okul farklı tatil → yanlış öneri; bu yüzden **öneri**, otomatik değil; okul-özel takvim yoksa yalnız resmî tatiller için öner. Kardeşler farklı kademede → çocuk bazlı. |
| Etiket | AYRI KARAR; S04 yayınından sonra. |

## 4. Ayrı öneri: geleceğe planlı eğitim geçişi — AYRI KARAR

| | |
|---|---|
| Bugün (MEVCUT) | `change_child_education(_with_calendar)` geçişi bugün uygular; gelecekteki kaydı bugün etkinleştirme engellenir; yıl başı hatırlatması vardır (varsayılan kapalı). |
| Öneri | Veli "14 Eylül 2027'de 5. sınıfa geçecek, okul X" planını kaydeder; kayıt `scheduled` durumunda bekler, tarih gelince **aile saat diliminde** zamanlayıcı uygular ve "geçiş yapıldı, geri al (14 gün)" bildirimi gönderir. Yıl başı hatırlatması planlı kayıt varsa "onayla/düzenle"ye dönüşür. |
| Kapsam | Yeni tablo `child_education_schedules` (child, planned_grade/school/place/stage, apply_on, status, idempotency); zamanlayıcı günlük; geri alma mevcut CAS/revizyon mekanizmasıyla. Mobil sihirbaza "ileri tarih" adımı. 1–2 hafta + yarış testleri (iki cihaz, planlı + elle geçiş çakışması). |
| Bağımlılık | L01 dönem aktarımı (program/rutin kopyalama kuralları), S04 takvimi (tarih önerisi), hatırlatma zamanlayıcısı üretimde doğrulanmış. |
| Risk | Otomatik uygulama "otomatik sınıf yükseltme yok" kuralıyla çelişir gibi görünür; fark: **veli açıkça planladı**. Yine de uygulama anında geri alınabilir olmalı ve puan/kanıt yeniden etiketlenmemeli. |
| Etiket | AYRI KARAR; 3B'den önce makul ama R02 sonrası. |

## 5. Ayrı öneri: 5.000+ duyuru kapasitesi — AYRI KARAR (kapasite)

| | |
|---|---|
| Bugün (MEVCUT) | `admin_send_announcement` tek işlemde kitle parmak izi doğrular ve **1–5.000 alıcı** sınırı koyar (`parent_announcements` migration'ı); push `push_claim_v2` ile tek tek çekilir; sağlayıcıya verilmiş push geri çağrılamaz. |
| Öneri | Bölümlenmiş kuyruk: duyuru `approved` → `announcement_batches` (her biri ≤ 2.000 alıcı, sıralı) → zamanlayıcı/Edge iş parçaları `pg_cron` ile 1 dk aralıkla; kitle parmak izi **bölüm bazında** (bölüm arası üyelik değişimi tolere edilir, çift teslim `on conflict` ile zaten engelli). Yönetimde ilerleme ("3/9 bölüm gönderildi"), duraklat, geri çek (gönderilmemiş bölümler iptal; gönderilmişler mevcut geri çekme kuralı). |
| Sağlayıcı sınırı | APNs/FCM istek başına tek cihaz; Edge işi süre sınırı (Supabase 150 sn/çağrı, CPU süresi) → bölüm başına ~500–1.000 push gerçekçi; 50.000 veli ≈ 50–100 bölüm ≈ 1–2 saat. SMS/e-posta **hazır değil** (sağlayıcı, İYS, vazgeçme) — ayrı iş. |
| Kapsam | Migration (batches + durumlar), Edge/pg_cron sürücüsü, backoffice ilerleme ekranı, yarış testleri (bölüm sırasında geri çekme, üyelik değişimi, çift çalışan). 1–2 hafta. |
| Risk | Kısmi gönderim görünürlüğü ("yarım kaldı" durumu veliye değil yöneticiye gösterilir); gerçek velilere test gönderilmez — izole DB + sentetik aileler. |
| Etiket | AYRI KARAR; **5.000 veliye ulaşılmadan gerek yok**; tetik: aktif veli sayısı 3.000'i geçince başlanır. |

## 6. Ayrı öneri: büyük katalog için sunucu araması — AYRI KARAR

| | |
|---|---|
| Bugün (MEVCUT) | `get_guided_input_options(child, kind)` tüm aktif seçenekleri döner (yüzlerce satır → sorun yok); ÖDSGM term-1 kataloğu 648 senaryo / 708 kazanım JSON'u (~76k satır) depoda; `education_places` tüm aktif yerleri tek JSON'da döner. |
| Eşik | `education_places` okul listesi gerçek okullarla dolunca (Türkiye'de ~70.000 okul) tek JSON **çalışmaz**; kazanım/senaryo kataloğu 2. dönem + tüm sınıflar eklenince 2–3 bin kayda çıkar (istemci araması hâlâ mümkün). |
| Öneri (aşamalı) | (a) Yerler: `search_education_places(q, parent_id, kind, limit 20)` — `pg_trgm` + `unaccent`, il→ilçe→okul daraltmalı; istemci 2 karakterden sonra sorgular; sonuç yoksa "bölge seç + okul adını yaz" (mevcut kural; isim benzerliğiyle otomatik eşleme yok). (b) Kazanım/senaryo: `search_curriculum(q, grade, subject, year, term)` — `tsvector('simple')` + trgm, yalnız yayımlanmış adaylar; eşanlamlı dosyası (S04) ders filtresini besler. (c) Ders eşanlamlıları: istemcide kalır (küçük), sunucu `curriculum_subject()` normalizasyonuyla aynı sözlüğü kullanır. |
| Kapsam | 2 RPC + 2 GIN indeks + istemci arama alanı (gecikmeli sorgu, iptal, çevrimdışı mesaj) + backoffice'te aynı arama. 3–5 gün. Arama sorguları **log'lanmaz** (kişisel veri olabilir: okul adı). |
| Bağımlılık | Gerçek okul listesi kaynağı (MEB kurum listesi resmî/açık veri; lisans ve güncellik `[AVUKAT]` değil, veri kaynağı kararı) — **bu olmadan okul araması anlamsız**; S04 bunu üretmedi (uydurma liste yasağı). |
| Etiket | AYRI KARAR; (b) P02/K01 kataloğu büyüyünce; (a) okul listesi kaynağı kararıyla birlikte. |

## 7. Ayrı kararlar olarak işaretlenenler (bu planda yok)

- **Özel mesaj (DM)**: pilotta kapalı. Açılırsa yeni risk sınıfı (yetişkin–yetişkin taciz, çocuk verisinin birebir paylaşımı, moderasyonun göremediği alan). Ayrı plan + `[AVUKAT]` + en az 6 ay pilot verisi sonrası. **3B SONRASI** adayı.
- **Okul/sınıf grupları**: okul kimliği + veli = çocuğun okulu açığa çıkar; takma adın anlamı kalmaz. Yalnız isteğe bağlı, okul yöneticisi doğrulamalı, ayrı görünürlükle ve ayrı karar. **3B SONRASI** adayı.
- **Fotoğraf/medya**: pilotta yok; açılırsa yüz/üniforma/isim tespiti gerekir → ayrı karar.
- **Öğretmen/uzman rolü**: ayrı karar; TEACHER_SHARE akışıyla karışmaz.

## 8. Sıralama önerisi (Enes değiştirir)

R02 → (küçük, bağımsız) QR eşleme → S04 takvim yayını → otomatik tatil **önerisi** → geleceğe planlı geçiş → katalog araması (b) → **sosyal pilot** (X01 + avukat sonrası) → WORLD-01 (3B) → DM / okul grupları (3B sonrası) → 5.000+ duyuru (tetikli).

## 9. Enes'in vereceği kararlar

1. Sosyal pilot **açılsın mı, açılırsa hangi sırada** (R02 sonrası / 3B sonrası / hiç)?
2. Hukuki ön koşul: `[AVUKAT]` 5651 yer sağlayıcı ve rıza dayanağı cevabı gelmeden pilot başlamaz — kabul mü?
3. Pilota katılım paketten bağımsız (ücretsiz dâhil) mi, yalnız Plus/Pro mu?
4. Doğrulanmış hesap eşiği: e-posta doğrulanmış + aile üyeliği + 7 gün — kabul mü? (X01'e bağımlılık doğurur.)
5. Moderatör: 2 kişi şart mı, yoksa tek kişi + 7 gün itiraz SLA'sı kabul mü? İkinci kişi kim?
6. Hesap silinince topluluk içeriği: tamamen sil (öneri) mi, anonimleştir mi?
7. Üst gönderi silinince yanıtlar kalsın mı (öneri) yoksa iş parçacığı tümden silinsin mi?
8. Takvim dönem modeli: 4 parça (ara tatiller dönem dışı, öneri ve tohum verisi böyle) mi, 2 dönem (ara tatil dönem içi, uyarı yok) mi?
9. QR eşleme: onay? (küçük; kamera izni metni gerekir.)
10. Otomatik tatil **önerisi** (otomatik silme yok) — onay ve sıra?
11. Geleceğe planlı eğitim geçişi — onay ve sıra? Uygulama anında 14 gün geri alma kabul mü?
12. 5.000+ duyuru kuyruğu — "3.000 aktif veli" tetiğiyle ertelensin mi?
13. Okul listesi kaynağı (MEB kurum listesi) edinilsin mi; edinilmezse okul araması yapılmaz, "bölge + okul adı yaz" kalır — kabul mü?
14. Ders eşanlamlıları: 20 yeni `subject-*` kimliği migration ile eklensin mi; eşleme her zaman veli onaylı mı?
15. Hazırlık sınıfı: ayrı sınıf değeri mi, "9 + okul notu" mu?
16. DM ve okul grupları **3B sonrası** olarak kaydedilsin mi?
