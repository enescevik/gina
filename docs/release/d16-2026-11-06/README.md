# D16 — kullanıcıya dönük teknik/hukuki metinlerin ürün davranışıyla eşitlenmesi (6 Kasım 2026)

> **Hukuk uzmanı onayı YOK.** Bu çalışma yalnız taslakların teknik doğruluğunu düzeltir; hukuki dayanak seçimleri, `[AVUKAT …]` soruları ve yer tutucu süreler değiştirilmedi. Hiçbir metin yayımlanmadı, mağaza kaydı değiştirilmedi, üretime dokunulmadı.

Kapsam: (1) Gizlilik Politikası İngilizce bölümünün Türkçe metinle eşitlenmesi; (2) eski 6 haneli eşleştirme anlatımının C13-AUTH-1 davranışına çekilmesi; (3) koddan doğrulanabilen diğer sapmalar (PIN'siz çocuk modu, AI puanının öneri olması, ortak kaynak grupları, kişi adı uyarısı, silme/dışa aktarma, AI sağlayıcıları); (4) "şirket kurmak" ön şartı gibi okunan ifadelerin bireysel geliştirici kararına göre düzeltilmesi.

Kaynak davranış: [`../c13-2026-11-06/AUTH-1-FIX.md`](../c13-2026-11-06/AUTH-1-FIX.md), `supabase/migrations/20261106340000_pairing_bruteforce_guard.sql`, `20261106360000_pairing_reject_notice.sql`, [`../../DECISIONS.md`](../../DECISIONS.md) ("Hukuki kimlik").

## 1. İngilizce gizlilik/koşul taslakları

- `docs/legal/` altında İngilizce bölümü olan **tek** belge Gizlilik Politikası'dır (`gizlilik-politikasi.md`, "Gina Privacy Policy (English)"). Kullanım Koşulları ve diğer 8 belge yalnız Türkçedir; **İngilizce Kullanım Koşulları taslağı yoktur** (DECISIONS.md yayının TR + EN olacağını söylüyor; bu açık kalem aşağıda "Belirsiz/açık").
- İngilizce bölüm C11'de "senkron değil" notuyla bırakılmıştı. D16'da Türkçe metinden (D16 düzeltmeleri dâhil) **bölüm bölüm yeniden çevrildi**; yapı (18 bölüm, tablolar, maddeler) Türkçeyle aynıdır. Yer tutucular Türkçeyle aynı anahtarları kullanır; yalnız `[AVUKAT …]` → `[LAWYER …]`, `[ÜRÜN KARARI …]` → `[PRODUCT DECISION …]`, `[YAYIN ÖNCESİ TEYİT …]` → `[PRE-PUBLICATION CHECK …]` olarak İngilizce etiketlendi (eski EN de böyleydi).

Uzlaştırılan farklar (eski EN → yeni EN = TR):

| # | Bölüm | Eski İngilizce | Yeni (TR ile aynı) |
|---|---|---|---|
| E1 | Başlık notu | "Not yet synchronised…"; 5 maddelik uygulama denetimi notu yoktu | Eşitlendiği yazıldı; TR'deki 5 maddelik "uygulamada olmayanlar" notu çevrildi |
| E2 | Özet | AI = haftalık özet + Pro fotoğraftan takvim (20/ay), "only if you turn them on", "Children never interact with AI"; silme "in the app or on the web" | Tam özellik listesi, işlem bazlı onay, çocuk cevabı/atanan soru istisnası; silme uygulama içinden (web formu yok notu); çocuk verisi maddesi ayrı |
| E3 | §1 | Kayıt ekranı / Ayarlar > Gizlilik ve Yasal erişim cümlesi yoktu | Eklendi |
| E4 | §2 | Düz metin, MERSİS yer tutucusu | Tablo; MERSİS "uygulanmaz (bireysel geliştirici)" |
| E5 | §3 tablo | Veli PIN'i için `[TECHNICAL CHECK: server or device]`; çocuk profilinde cinsiyet/ilgi alanı/okul yok; "çocuk yalnız görev işaretler"; "Photo to calendar (Gina Pro only)" satırı | PIN sunucuda, aile başına tek özet; cinsiyet, 6 ilgi alanı, eğitim dönemi/okul adı, isteğe bağlı çocuk PIN'i; hedef/oda/Prova; yeni satırlar: çocuğun Prova cevapları ve çözüm defteri, öğretmen paylaşım bağlantıları, yüklenen belge ve görseller (4 MB/10 MB/5 sayfa/5 dosya); eşleştirme kayıtları (D16) |
| E6 | §3 zorunlu/isteğe bağlı | Cinsiyet, ilgi alanı, okul adı, belge yükleme, öğretmen paylaşımı yoktu | Eklendi |
| E7 | §3 üçüncü taraflar | "push token (Expo, Apple, Google)" | Doğrudan APNs/FCM, Expo yok; öğretmen bağlantısı alıcısı |
| E8 | §3 toplanmayanlar | Kamera yalnız Pro fotoğraftan takvimde tek fotoğraf | Belge yükleme özelliklerinde yalnız seçilen dosyalar; sağlık verisi örnekleri |
| E9 | §4 | Düz metin; AI = "weekly summary, tips, photo-to-calendar" | Tablo; AI satırı Bölüm 5 listesi + "uzman incelemesi gerekir"; öğretmen paylaşımı satırı |
| E10 | §5 | Varsayılan kapalı tek izin, "Settings > AI Summary" anahtarı, diğer velilere bildirim, fotoğraf saklama `[ÜRÜN KARARI]` | İşlem bazlı ayrı onay, genel anahtar yok, diğer velilere bildirim yok; özellik başına gönderilen veri; maskeleme yok; OpenAI/Gemini iskeletleri kullanılmıyor; çocuk istisnaları; çıktılar öneri (+ D16: AI puanı öneri, kişi adı uyarısı, ortak kaynak grupları); yüklemelerde 24 saat / 7 gün kuralı |
| E11 | §6 | "650 Industries (Expo)" satırı; Anthropic = istatistik + Pro fotoğraf | Expo satırı kaldırıldı; Anthropic güncel girdi listesi + başka etkin sağlayıcı yok; öğretmen bağlantısı alıcısı satırı |
| E12 | §8 | Temel sağlayıcılarda Expo | Expo yok, doğrudan APNs/FCM; Google FCM rolü uzmana; işlem bazlı onay denetim notu |
| E13 | §9 | Kod "veli hesabından üretilen 6 haneli kod"; "okul adı istenmez"; çocuk PIN'i zorunlu gibi | Kod/QR çocuk cihazında, veli önizler ve onaylar; 8 karakter, 5 dk jeton, deneme sınırı, tablet tarafı 15 dk iptal (D16); okul adı isteğe bağlı; PIN isteğe bağlı ve veli telefonunda PIN'siz giriş (D16); öğretmen paylaşımı; grup denemeleri/katkı kapalı |
| E14 | §10 | Fotoğraftan takvim görselleri `[ÜRÜN KARARI]`; öğretmen bağlantısı yok | Yüklenen belge kuralı; öğretmen bağlantıları; tek profil satırı; eşleştirme kod/deneme satırı ve otomatik kaldırma işinin olmadığı notu (D16) |
| E15 | §11 | Çok ebeveynli silme `[PRODUCT DECISION (a)/(b)]`; yeniden doğrulama yok | Gerçek davranış (sahiplik devri / son ebeveynde aile silinir); şifre veya 5 dk içinde e-posta kodu; etki önizlemesi; "Hesabımı sil" yolu; silinenlere belgeler, Prova, paylaşım bağlantıları; web formu, planlı silme, Apple iptali ve silme e-postalarının uygulanmadığı notları |
| E16 | §12 | "Settings > Privacy and Legal > Data Subject Request", "My Consents" ile geri alma | Bu ekranların olmadığı, şimdilik Yardım > destek talebi; AI onayı işlem bazlı |
| E17 | §13 | Grup denemesi maddesi yok | Eklendi; eşleştirme kodunun tahmine karşı korunması (D16) |
| E18 | §14 | "relayed via Expo"; "6-digit code, needs no camera"; duyuru/e-posta/SMS kanalı yok | Doğrudan APNs/FCM; GINA duyuruları; e-posta/SMS altyapısı hazır ama bağlı değil; belge yüklemede kamera izni; 8 karakterli kod veya QR, telefonun kendi kamerası |
| E19 | §4 başlığı, §15–§18 | "Purposes and legal bases (KVKK)"; düz paragraflar | TR başlığı ve madde yapısı; içerik değişmedi |
| E20 | Değişiklik geçmişi | 0.1 + 0.2 | TR'deki tutarlılık satırı, C11 ve D16 satırları eklendi |

## 2. Değişiklik tablosu

| Dosya | Eski iddia | Yeni iddia | Kod kanıtı |
|---|---|---|---|
| `docs/legal/gizlilik-politikasi.md` §9 (TR+EN) | Çocuk cihazında 10 dk geçerli, tek kullanımlık **6 haneli** kod; veli görüp onaylar | **8 karakter** (harf+rakam, 4+4), veli önizler ve **≤5 dk** içinde onaylar (tek kullanımlık, veliye/aileye/koda bağlı jeton); **10 dk'da veli başına 10 / aile başına 20** hata → **15 dk** durdurma; tablet aile adını gösterir, **15 dk** içinde "Bu benim ailem değil" ile iptal eder, eşleyen veliye not | `20261106340000_pairing_bruteforce_guard.sql` (`request_pairing`, alfabe `ACDEFHJKMNPRTUVWXY3479`, `c_window`/`c_lock`, `preview_device_pairing` jeton `least(now()+5 min, expires_at)`, `reject_device_pairing` `c_undo 15 min`); `20261106360000_pairing_reject_notice.sql` (`gina.device_pairers`, `device_pairing_rejected` gelen kutusu notu) |
| aynı, §14 (TR+EN) | "6 haneli kod veya QR" | "8 karakterli kod veya QR" | aynı |
| aynı, §13 (TR+EN) | Eşleştirme kodu koruması anılmıyordu | 22 sembol, 8 karakter, 5 dk jeton, deneme kilidi, tablet tarafı iptal | aynı |
| aynı, §3 tablo (TR+EN) | Eşleştirme kayıtları: eşleştirme/iptal zamanı, son kullanım | + tabletin iptali, cihazı eşleyen veli, kod denemelerinin zamanı/sonucu | `device_pairing_attempts(user_id,family_id,ok,tried_at)`, `gina.device_pairers` |
| aynı, §10 (TR+EN) | Kod/deneme kayıtları için süre yok; "[90 GÜN] kullanılmayan cihaz" kaldırılır | Kod ≤10 dk, jeton ≤5 dk; deneme kayıtları aynı veli yeniden denediğinde 1 günden eskiyse silinir, hesap/aile silinince silinir, periyodik temizlik yok; kullanılmayan eşleştirmeyi kaldıran iş **yok** (denetim notu) | `delete from public.device_pairing_attempts … tried_at < now() - interval '1 day'` (yalnız `preview_device_pairing` içinde), `on delete cascade`; `devices` için süreye bağlı `revoked_at` yazan iş yok (migration taraması) |
| aynı, §9 (TR+EN) | Veli telefonunda çocuk modu: "çocuk 4 haneli çocuk PIN'i ile girer" | PIN'i olan çocuk PIN ile, PIN'i olmayan profile dokunarak girer; çıkış veli PIN'i | `verify_child_pin`: PIN satırı yoksa `return true` (`20261105050000_child_profile_archive.sql`); `child_mode_pin_status()` (`20261106360000`); `tr.json` `d2.childMode.intro` |
| aynı, §5 (TR+EN) | "Değerlendirme önerisi verdiğiniz puanı kendiliğinden değiştirmez" | AI değerlendirmesi yalnız öneri; kesin puan veli öneriyi kabul ettiğinde veya kendisi puan verdiğinde oluşur | `20261106290000_ai_routing_and_grade_split.sql` §4: `apply_ai_grades` yalnız `ai_score/ai_feedback/ai_details`, kesin `score` yalnız `score_open_answer`/`save_answer_review`/`accept_ai_grade` |
| aynı, §5 (TR+EN) | Ortak kaynak anılmıyordu | Birden çok soru aynı ortak metne dayanabilir; soru grupları açıksa "ortak kaynak grubu" olarak kaydedilir, kapalıysa her soru metni kendi gövdesinde taşır | `20261106350000_prova_shared_ai_and_subject_fit.sql` `gina.link_ai_shared_sources` (`question_groups.enabled` kontrolü); bayrak tohumu `false` (`20261102181000_shared_question_sources.sql`) |
| aynı, §5 (TR+EN) | Kişi adı uyarısı anılmıyordu | Çocuğun göreceği metinde kişi adı tespit edilirse "İçerik notu" + rol ifadesi önerisi; otomatik, kesin değil, engellemez | `supabase/functions/_shared/generation-result.ts` `detectPersonNames`/`personNameReview` (`needs_review`, `person-name/v1`); `20261106400000_question_content_review_surface.sql`; `tr.json` `d10.contentReview.*` ("seçmeden geçebilir") |
| aynı, §6 Anthropic satırı (TR+EN) | "Takma adlı görev/takvim istatistikleri, yerel ayar; Pro'da fotoğraf" | §5'teki güncel girdi listesi; her işlemde ayrı onay; **başka etkin AI sağlayıcısı yok** | `20261106060000_ai_provider_matrix.sql` (anthropic `active`, openai_compatible/gemini `unconfigured`); `packages/core/src/ai-capabilities.ts` `PROVIDER_DEFAULTS` |
| aynı, Özet + §11 (TR+EN) | Web'den silme, dönem sonuna planlı silme, Apple belirteç iptali, silme e-postaları vaat ediliyordu (başlıkta işaretli) | Vaatler korunup yerinde "uygulama denetimi: henüz yok" notu; silinenlere belgeler, Prova, paylaşım bağlantıları eklendi; dışa aktarma yok (değişmedi) | `supabase/functions/delete-account/handler.ts` (yalnız hemen silme, Apple revoke yok); e-posta sağlayıcısı bağlı değil (`docs/release/notification-channels-2026-11-06/README.md`); kodda dışa aktarma RPC/uç noktası yok (`grep export` boş) |
| aynı, §2 (TR+EN) | "MERSİS numarası: [MERSİS]" | "Uygulanmaz: bireysel geliştirici (şahıs); şirkete devirde eklenir" | `docs/DECISIONS.md` "Hukuki kimlik: şahıs (bireysel geliştirici) olarak başlanır" |
| aynı, EN bölümü | C11 TR düzeltmeleriyle senkron değil | Tamamen yeniden çevrildi (§1 tablo E1–E20) | — |
| `docs/legal/cocuk-modu-bilgilendirme.md` B.3 | Giriş: çocuğun 4 haneli PIN'i | PIN'i olan PIN ile, olmayan profile dokunarak | `verify_child_pin` |
| aynı, B.4 | 6 haneli kod; "QR yalnızca 6 haneli kodu taşır" | 8 karakter, 5 dk onay, deneme sınırı maddesi, tablet tarafı kontrol maddesi; kaydedilenlere eşleyen veli ve kod denemeleri | `20261106340000`, `20261106360000` |
| `docs/legal/kullanim-kosullari.md` §2 tanımlar | "tek kullanımlık 6 haneli kod"; PIN yalnız eşleştirilmiş cihazda kapatılabilir | 8 karakter, 5 dk onay, deneme sınırı, 15 dk tablet iptali; veli telefonunda PIN'siz giriş | aynı + `verify_child_pin` |
| `docs/legal/kvkk-aydinlatma-metni.md` §3 tablo, §13 | "6 haneli eşleştirme kodunun kaydı"; PIN'siz giriş yalnız cihazda | 8 karakterli kod + onay jetonu, eşleyen veli, kod denemesi kayıtları, tablet iptali; veli telefonunda PIN'siz giriş; kod tahmin koruması | aynı |
| `docs/legal/veli-beyani-ve-cocuk-profili-onayi.md` tanımlar, §6 | 6 haneli kod; "giriş çocuğun 4 haneli Çocuk PIN'i ile"; "[90 gün] kullanılmayan eşleştirme kendiliğinden kaldırılır" | 8 karakter, 5 dk onay, deneme sınırı, tablet iptali + veliye not; PIN'siz giriş; 90 gün cümlesine "uygulanmadı" notu | aynı; `devices` için otomatik kaldırma işi yok |
| `docs/legal/abonelik-kosullari-ve-on-bilgilendirme.md` taslak notu | "Hukuki kimlik (şahıs/şirket) kararı verilene kadar…" | Karar verildi: bireysel geliştirici; şirket kurmak ön şart değil; MERSİS uygulanmaz, VKN/TCKN | `docs/DECISIONS.md` |
| `docs/release/c11-2026-11-06/legal-review.md` | X03 adım 1 "Hukuki kimlik kararı (şahıs/şirket)"; yer tutucu notları "Şahıs/şirket kararı", "şirket ise MERSİS"; "EN senkron değil" | Karar verildi (bireysel geliştirici), adım yalnız değer girişi; MERSİS uygulanmaz; EN D16'da eşitlendi; başa D16 notu | `docs/DECISIONS.md` |
| `docs/release/c11-2026-11-06/user-guides.md` X03 adım 1 | "veri sorumlusu unvanı, adres, MERSİS/VKN…" | Bireysel geliştirici kararı; yasal ad soyad, VKN/TCKN, MERSİS uygulanmaz | `docs/DECISIONS.md` |
| `docs/release/YAYIN-KURULUM-REHBERI.md` §5, §7 madde 2, §7.3 App Review | "Şirket/gerçek kişi yayıncı bilgilerini kesinleştir"; "Cihaz ekle üzerinden tablet kodu girilir (10 dk)"; inceleme notunda eşleştirme ayrıntısı yok | Bireysel geliştirici, şirket ön şart değil; 8 karakter/QR, 5 dk onay, kilit, tablet iptali (yeni sürüm + migration ile); App Review notu için güncel eşleştirme, isteğe bağlı çocuk PIN'i, işlem bazlı AI onayı, tek sağlayıcı Anthropic | `20261106340000`, `verify_child_pin`, `ai_providers` |
| `docs/DECISIONS.md` mimari "Kimlik" satırı | "Tablet = anonim Auth + 6 haneli eşleştirme" | İlk karar 6 haneydi; C13-AUTH-1 ile 8 karakter + jeton + kilit + tablet iptali (bağlantılı) | `AUTH-1-FIX.md` |
| `docs/F01-SOCIAL-AND-NEXT-PROPOSALS.md` QR tablosu | "Bugün (MEVCUT): 6 haneli eşleştirme kodu" | Satır korunup "güncel durum" notu (QR çocuk cihazında, 8 karakter) | `AUTH-1-FIX.md`, U02 |
| `docs/PROVA.md` | "Açık uçlular AI değerlendirmesine düşer (puan…)"; "0-100 puanlar" | Veli onayıyla gönderilebilir; AI puanı öneri, kesin puan veli kabulüyle | `20261106290000` §4 |
| `packages/core/src/i18n/tr.json` + `en.json` | 9 anahtar × 2 dil "6 haneli"/"6-digit" eşleştirme kodu | "8 karakterli"/"8-character"; davet kodu yardımında "6 haneli eşleştirme kodundan" → "çocuk cihazında görünen eşleştirme kodundan" | `pairing-code.ts`; `auth1.*` anahtarlarıyla aynı ifade |

### i18n değer değişiklikleri (yalnız eşleştirme konusunda olgusal olarak yanlış olanlar)

Anahtar eklenmedi/silinmedi; TR ve EN'de aynı 9 anahtarın yalnız değeri değişti (betik anahtar kümesinin aynı kaldığını ve yalnız bu 9 değerin değiştiğini denetledi). Bu anahtarlar C13-AUTH-1'den beri ekranlarda `auth1.*` eşleriyle değiştirilmiş durumda (kodda doğrudan kullanılmıyor), ama yeniden kullanılırsa yanlış bilgi vermesinler diye düzeltildi:

| Anahtar | Eski (TR) | Yeni (TR) |
|---|---|---|
| `parent.pairCodeLabel` | Tabletteki 6 haneli kod | Tabletteki 8 karakterli kod |
| `unified.pairStep2` | … Orada görünen 6 haneli kodu aşağıya yazın. | … Orada görünen 8 karakterli kodu aşağıya yazın. |
| `unified.pairCode` | Çocuk cihazındaki 6 haneli kod | Çocuk cihazındaki 8 karakterli kod |
| `experience.family.codeHelp` | … çocuk cihazının 6 haneli eşleştirme kodundan farklıdır. | … çocuk cihazında görünen eşleştirme kodundan farklıdır. |
| `experience.family.codeHelpPath` | aynı | aynı (`auth1.family.codeHelpPath` ile aynı metin) |
| `u02.steps.step2` | QR kod ve 6 haneli kod … | QR kod ve 8 karakterli kod … |
| `u02.steps.step3` | … 6 haneli kodu yazın. | … 8 karakterli kodu yazın. |
| `u02.pair.qrPrivacy` | QR yalnız bu 6 haneli kodu taşır … | QR yalnız bu 8 karakterli kodu taşır … |
| `u02.parentPair.body` | … veya 6 haneli kodu yazacaksınız. | … veya 8 karakterli kodu yazacaksınız. |

EN karşılıkları aynı biçimde "6-digit" → "8-character" (davet kodu yardımında "the pairing code shown on the child device"). `channels.*.sms` anahtarlarındaki "6 haneli/6-digit" SMS doğrulama kodudur (`notification-channels.ts`: SMS 6 rakam) ve doğrudur; değiştirilmedi.

## 3. Bilerek değiştirilmeyenler

- Tarihli rapor ve kanıt dosyaları o günkü durumu anlatır, düzeltilmedi: `docs/release/TESTFLIGHT-12-2026-11-02.md` (build 12 test notu), `u02-2026-11-06/README.md`, `c06-2026-11-06/README.md`, `c13-2026-11-06/README.md`, `evidence/unified-premium/`, `experience-review/SCREEN-REVIEW-MATRIX-A1.md`, `docs/design/screens/**` maketleri ve `research_notes/`.
- Belgelerdeki değişiklik geçmişi satırlarında geçen "6 haneli eşleştirme" (0.2, 30 Ekim) tarihsel kayıttır.
- `[MERSİS/VKN]` birleşik yer tutucuları (abonelik, açık rıza, çerez, çocuk modu, hesap silme, KVKK başvuru, veli beyanı, kullanım, aydınlatma) korundu: değer şahısta VKN/TCKN olarak girilir; yer tutucu sayısı değişmesin diye ad değiştirilmedi.
- C11'de "uygulama işi" olarak işaretlenen vaatler (Gizlilik ve Yasal menüsü, Rızalarım, KVKK formu, web silme, planlı silme, silme e-postaları, Apple iptali, 18 yaş) metinden çıkarılmadı; yalnız ilgili cümlelere yerinde not düşüldü. Çıkarma/uygulama kararı işletme sahibinde (legal-review §C adım 2).
- Hukuki dayanaklar, `[AVUKAT]` soruları, saklama süresi yer tutucuları.

## 4. Belirsiz / açık kalemler (koddan doğrulanamadı veya karar gerekir)

1. **İngilizce Kullanım Koşulları taslağı yok** (diğer 8 belge de yalnız TR). DECISIONS.md yayının TR + EN olacağını söylüyor; çeviri ayrı iş.
2. **Kullanılmayan eşleştirmeyi kaldırma:** Gizlilik §10 ve Veli Beyanı §6 "[90 gün] kullanılmayan cihaz kaldırılır" diyor; kodda böyle bir iş bulunamadı (migration taramasında `devices.revoked_at`'ı süreye göre yazan cron/fonksiyon yok). Not düşüldü; uygulamak mı, cümleyi çıkarmak mı kararı gerekir.
3. **Eşleştirme deneme kayıtlarının saklaması:** yalnız aynı veli yeniden denediğinde 1 günden eski kayıtlar siliniyor; periyodik temizlik yok, yani hiç yeniden denemeyen velinin kaydı hesap silinene kadar kalabilir. Metin bunu olduğu gibi anlatıyor; hukuki uygunluk uzmana.
4. **Soru grupları bayrağı:** `question_groups.enabled` tohumu `false`; üretimdeki değeri bu daldan doğrulanamaz. Metin "açıksa / kapalıysa" iki durumu da anlatıyor.
5. **`ai_providers` durumu yönetimden değiştirilebilir** (`grant update … to authenticated`, rol denetimli RPC'ler). Metin bugünkü tohum durumunu (yalnız Anthropic `active`) anlatıyor; üretimdeki satır bu daldan doğrulanamaz.
6. **Veli PIN'i kilidi (5 yanlış / 60 sn)** Kullanım Koşulları'nda "her iki PIN için" yazıyor; yalnız çocuk PIN'i kilidi doğrulandı, veli PIN'i kilidi bu çalışmada kontrol edilmedi.
7. **Çocuk Modu Bilgilendirmesi A bölümü** (çocuğa yönelik) "çıkmak için annenin ya da babanın PIN'i gerekir" diyor; eşleştirilmiş tablette ebeveyn alanı olmadığı için bu cümle yalnız veli telefonundaki çocuk modu için doğrudur. Çocuk diline dokunmak uzman/ürün kararı; değiştirilmedi.
8. **Kullanılmayan i18n değeri:** `u02.childMode.noPairing` "çocuk kendi 4 haneli PIN'iyle girer" diyor (PIN'siz giriş anılmıyor). Eşleştirme konusu olmadığından kurala göre değiştirilmedi; ekranda kullanılmıyor (`d2.childMode.intro` kullanılıyor).
9. **Eski UI testleri:** `scripts/test-screen-review-a1-ui.cjs` (`\d{6}` ve "Çocuk cihazındaki 6 haneli kod" etiketi) ve `scripts/test-u02-device-family-ui.cjs` (AUTH-1-FIX §4) hâlâ eski 6 haneli akışı bekliyor; bu iş kapsamında koşulmadı/güncellenmedi.
10. **Abonelik Koşulları taslak notu** hâlâ "Plus: haftalık özet; Pro: haftalık özet + fotoğraftan takvim (ayda 20)" diyor (C11 öncesi özet; metnin kendisi C11'de düzeltildi). İç not olduğu için dokunulmadı.

## 5. Doğrulama (gerçekten koşuldu, 6 Kasım 2026, bu worktree)

| Komut | Sonuç |
|---|---|
| `pnpm --filter @gina/core test` (vitest) | 63 dosya, **443/443** geçti |
| `pnpm --filter @gina/core typecheck` (tsc --noEmit) | hata yok |
| `node --test scripts/*.test.mjs` | **104/104** geçti |
| i18n betiği (TR/EN JSON ayrıştırma, anahtar kümesi aynı, yalnız 9 değer değişti) | geçti |
| Değişen belgelerdeki göreli Markdown bağlantıları (betikle dosya varlığı) | kırık bağlantı yok |

Repoda ayrı bir belge bağlantı denetimi betiği yoktur.
