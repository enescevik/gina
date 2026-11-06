# Gina Aile – Hesap ve Veri Silme

| | |
|---|---|
| Sürüm | 0.2 (taslak) |
| Tarih | 2026-10-30 |
| Yürürlük tarihi | [YÜRÜRLÜK TARİHİ] |
| Durum | **Taslak. Hukuk uzmanı incelemesi ve onayı yapılmadı (6 Kasım 2026); uzman onayı ve yazılı onay kaydı olmadan yayımlanmaz.** Türkçe metin esastır; İngilizce çeviri bilgi amaçlıdır ve sayfanın sonundadır. / The Turkish text prevails; an English version is at the end of this page. |
| Veri sorumlusu | [VERİ SORUMLUSU UNVANI] · [ADRES] · [E-POSTA] · MERSİS/VKN: [MERSİS/VKN] |
| Yayın yeri | [WEB ADRESİ]/legal/hesap-ve-veri-silme; Google Play "Veri güvenliği" ve App Store Connect "Privacy Choices" bağlantısı; uygulamada Ayarlar > Hesap > Hesabı Sil |
| İlgili belgeler | [Gizlilik Politikası](./gizlilik-politikasi.md) · [KVKK Aydınlatma Metni](./kvkk-aydinlatma-metni.md) · [Kullanım Koşulları](./kullanim-kosullari.md) · [Abonelik Koşulları](./abonelik-kosullari-ve-on-bilgilendirme.md) · [Çerez Politikası](./cerez-politikasi.md) · [KVKK Başvuru Formu](./kvkk-basvuru-formu.md) |

## 31 Ekim 2026 uygulama denetimi (6 Kasım 2026'da yeniden doğrulandı) — yayımlamadan önce güncellenmeli

Bu belgenin aşağıdaki bölümleri hedef davranışı anlatan **hukuki taslaktır**, çalışan özelliğin kanıtı değildir. Mevcut uygulama (`supabase/functions/delete-account/handler.ts`, `supabase/migrations/20261106040000_deletion_preview.sql`): veli menüsünde ve aile kurulum ekranında **Hesabımı sil** → etki önizlemesi (15 dakika geçerli, hedef değişirse silme yapılmaz) → mevcut şifre veya son 5 dakika içinde e-posta tek kullanımlık koduyla yeniden doğrulama + geri alınamaz işlem onayı → hemen silme. Hesap üyesi olduğu her aileden ayrı ayrı çıkarılır. Başka veli varsa ortak çocuk kayıtları korunur ve aile sahipliği devredilir; son veli silinirse aile/çocuk verisi ve eşlenmiş anonim cihaz hesapları silinir. Silinen kullanıcının yazdığı notlar, oluşturduğu paylaşım bağlantıları, push tercihleri ve oturumları kaldırılır. Sunucu RLS/Edge üyelik kontrolü eski JWT erişimini de kapatır. Mağaza aboneliği iptal edilmez. Tek çocuk profili veli menüsündeki çocuk kartından, etki önizlemesi ve veri kapsamını açıklayan ikinci onayla (`confirm_child_deletion`) silinir; diğer çocuklar korunur, başka bir ebeveynin o çocuk hakkındaki kişisel notu silinmez, aileye bağlı içerik (yüklenen dosyalar, soru bankası, ödüller) korunur. Silmeden farklı olarak çocuk profili **arşivlenebilir** (geri alınabilir duraklatma; kazanılmış kayıtlar korunur, eşleştirilmiş cihazlar engellenir) ve kayıtlar toplu arşivlenip geri yüklenebilir; arşiv silme değildir ve süre sınırı yoktur. Yüklenen belge/görseller aile silinince silinir; depolama nesnesi saatlik temizlik işiyle kaldırılır.

**Henüz uygulanmayan taslak vaatleri:** dönem sonuna planlı silme; girişsiz e-posta doğrulamalı web silme formu; silme alındı/tamamlandı e-postası (e-posta sağlayıcısı bağlı değil); 18 yaşında otomatik pasifleştirme; Apple ile Giriş belirteç iptali (sosyal giriş uygulamada sağlayıcı ayarı açıksa görünür; silmede Apple'a iptal isteği gönderilmez); hukuki saklama süresi (satın alma, onay ve denetim kayıtları şu an aileyle birlikte hemen silinir) ve yedekten silme otomasyonu. Etkin abonelik varsa silme önizlemesinde uyarı ve uygulamadaki Abonelik ekranına (oradan mağazanın yönetim sayfasına) giden bağlantı gösterilir; silme ekranı ayrıca "aboneliği önce mağazadan iptal edin" uyarısını gösterir. Bunları varmış gibi yayımlamayın. Supabase/mağaza hizmet günlükleri ve yedekleri uygulama transaction'ıyla silinmez; saklama/imha politikası gerçek üretim ayarlarıyla ayrıca doğrulanmalıdır. Yayın metni uygulamadaki yol ve davranışla eşleştirilmeli; sorumlu unvanı, iletişim, saklama süreleri ve web başvuru yolu tamamlanmalıdır.

## Kısa özet (bağlayıcı değildir)

- Hesabınızı uygulama içinden **Ayarlar > Hesap > Hesabı Sil** yoluyla silebilirsiniz; giriş yapamıyorsanız bu sayfadaki formla, kayıtlı e-postanızı doğrulayarak talep gönderirsiniz. Hesap askıya alınmaz, tamamen silinir.
- Veriler canlı sistemden hemen, yedeklerden en geç [30 gün] içinde silinir; yalnızca yasal nedenle tutulan kayıtlar (satın alma kayıtları [10 yıl], güvenlik günlükleri [12 ay]) sınırlı süre kalır.
- **Hesabı silmek aboneliğinizi iptal etmez;** aboneliği önce App Store veya Google Play'den iptal edin.

## 1. Bu sayfa ne içindir

Bu sayfa, Gina Aile ("Gina") hesabınızı ve verilerinizi nasıl sileceğinizi, nelerin silindiğini ve nelerin ne kadar tutulduğunu açıklar (KVKK m.7, m.11/e; Silme Yönetmeliği m.12; Apple 5.1.1(v); Google Play hesap silme politikası); süreler Gizlilik Politikası, Aydınlatma Metni ve mağaza beyanlarımızla aynıdır.

Hesabı yalnızca 18 yaşını doldurmuş ebeveyn veya vasi açar ve siler. Çocukların hesabı yoktur; çocuk modundan ve eşleştirilmiş tabletten hesap silinemez.

## 2. Uygulama içinden hesabınızı silme

1. Ebeveyn alanına geçin (çocuk modundan çıkış 4 haneli ebeveyn PIN'i ister).
2. **Ayarlar > Hesap > Hesabı Sil** seçin.
3. Etkin aboneliğiniz varsa uyarı ve mağazanın iptal bağlantısı gösterilir (Bölüm 8); iptal etmezseniz faturalandırma mağazada sürer.
4. **Hemen sil** veya **abonelik dönemi sonunda sil** seçin. Planlı silmede hesabınız dönem sonunda kendiliğinden silinir; planı o tarihe kadar aynı ekrandan iptal edebilirsiniz. Hemen silme seçeneği her zaman vardır. [ÜRÜN KARARI: abonelik yenilenirse planlı tarih]
5. Onaylayın; güvenlik için yeniden giriş isteyebiliriz.

Onay anında (planlı silmede tarih gelince) erişim kapanır; oturumlar ve tablet eşleştirmeleri anında geçersiz olur. Destek ekibine yazmanız gerekmez; silinen hesap geri getirilemez. Toplu veri dışa aktarma özelliği yoktur; silmeden önce verilerinizin bir kopyasını KVKK Başvuru Formu ile isteyebilirsiniz (m.11/b; Bölüm 10).

## 3. Giriş yapmadan web üzerinden silme talebi

Uygulamaya giremiyorsanız bu sayfadaki **Silme talebi** formunu kullanın:

1. Hesabınıza kayıtlı e-posta adresinizi girin. Apple ile Giriş'te "E-postamı gizle" kullandıysanız Apple'ın verdiği aktarma (relay) adresini girin.
2. Bu adrese [DOĞRULAMA BAĞLANTISI SÜRESİ, örn. 24 saat] geçerli, tek kullanımlık bir doğrulama bağlantısı göndeririz; adresin bir hesaba bağlı olup olmadığını güvenlik nedeniyle ekranda göstermeyiz.
3. Bağlantıya tıklayıp talebi onaylayın; hesap Bölüm 2'deki gibi silinir. Etkin aboneliğiniz varsa e-postada mağaza iptal bağlantısıyla uyarırız. [ÜRÜN KARARI: web talebinde "dönem sonunda sil" seçeneği]

Formda e-posta adresi dışında bilgi istemeyiz. Kayıtlı adresinize erişemiyorsanız talebinizi KVKK Başvuru Formu'ndaki bilgilerle posta ([ADRES]) veya KEP ([KEP ADRESİ – varsa]) ile iletin; kimlik kartı kopyası istemeyiz. Web formu hesabın tamamını siler; tek bir çocuk profili için uygulamaya girin.

## 4. Hesabı silmeden tek bir çocuk profilini veya belirli verileri silme

- **Çocuk profili:** Ayarlar > Çocuklar > [Çocuk] > Profili Sil. Profil (ad/takma ad, doğum yılı, çocuk PIN'i), görev ve yıldız geçmişi, takvim, notlar, not/puan ve gelişim kayıtları, o çocuğa ait yapay zekâ çıktıları ve eşleştirilmiş cihaz oturumları silinir; aile ve diğer çocuklar etkilenmez. Silinen profil ailedeki herkes için silinir.
- **Tek tek kayıtlar:** Görev, not, takvim kaydı ve yapay zekâ özetleri ilgili ekranlardan silinir (özetler en geç 12 ay sonra kendiliğinden silinir).
- **Cihaz eşleştirmesi:** Ayarlar > Çocuklar > [Çocuk] > Cihazlar'dan kaldırılır; iptal anında etkilidir, cihaz bir daha veriye erişemez.

Bu silmeler de canlı sistemden hemen, yedeklerden en geç [30 gün] içinde kaldırılır.

## 5. Hesap silindiğinde neler silinir

| Veri | Kapsam |
|---|---|
| Ebeveyn hesabı | E-posta, ad, şifre özeti (hash), dil/bölge tercihi, ebeveyn PIN'i, ayarlar ve izinler |
| Aile | Aile adı, aile davet kodları, üyelikler, saat dilimi |
| Çocuk profilleri | Ad/takma ad, doğum yılı, varsa avatar ve sınıf düzeyi, çocuk PIN'i |
| Görevler ve puanlar | Görevler, tamamlama/onay geçmişi, çocuk modu işlem kayıtları, yıldızlar, ödüller, not/puan bilgileri |
| Takvim, notlar, gelişim | Takvim ve ders programı, notlar, gelişim (kilometre taşı) kayıtları |
| Yüklenen belge ve görseller, Prova kayıtları | Aileye yüklenen görseller/PDF'ler (aile silinince; depolama nesnesi saatlik temizlikle), soru bankası, denemeler, çocuğun cevapları ve çözüm defterleri, yapay zekâ onay kayıtları ve değerlendirme önerileri; oluşturduğunuz öğretmen paylaşım bağlantıları |
| Yapay zekâ çıktıları | Gina'daki tüm yapay zekâ özetleri ve çıktıları (Anthropic için Bölüm 7) |
| Cihaz eşleştirmeleri | Eşleştirilmiş tabletler, anonim çocuk oturumları, eşleştirme kodları; anında geçersiz olur |
| Bildirim belirteçleri | Push belirteçleri ve bildirim tercihleri (APNs/FCM için Bölüm 7; Expo kullanılmaz) |
| Giriş bağlantıları | Apple ile Giriş (Apple'a belirteç iptali bildirimi hedeflenir, uygulamada henüz yapılmaz; bkz. başlıktaki denetim notu), Google ile Giriş, e-posta/şifre girişi |

## 6. Yasal veya meşru nedenle sınırlı süre tutulanlar

Aşağıdaki kayıtlar silmeden sonra da tutulur; erişimleri kısıtlıdır, mümkün olduğunda takma kimliğe çevrilir, başka amaçla kullanılmaz ve süre dolunca periyodik imhayla (en geç altı ayda bir) silinir.

| Kayıt | Süre | Neden |
|---|---|---|
| Satın alma ve abonelik doğrulama kayıtları (işlem kimliği, paket, tarihler) | [10 yıl] | Vergi ve ticaret mevzuatı (KVKK m.5/2-ç) |
| Güvenlik ve sunucu günlükleri (IP, zaman damgası) | [12 ay] | Güvenlik, kötüye kullanımın önlenmesi (m.5/2-f) [AVUKAT: 5651 sayılı Kanun] |
| Rıza, özellik izni, veli beyanı ve ön bilgilendirme kayıtları (takma kimlikle; çocuk adı içermez) | [3 yıl] | İspat; hukuki yükümlülük (m.5/2-ç) ve bir hakkın tesisi, kullanılması veya korunması (m.5/2-e) [AVUKAT: zamanaşımı] |
| Silme talebinizin kaydı, KVKK başvuru ve destek yazışmaları | [3 yıl] | Talebin yerine getirildiğinin ispatı |
| Kayıtlı e-posta adresiniz | Silme tamamlanana kadar | Alındı ve tamamlandı bildirimleri; sonra silinir |
| Apple ile Giriş belirtecinin iptal kaydı | [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] | Apple'ın iptal şartının ispatı [AVUKAT] |
| Devam eden uyuşmazlık veya yetkili makam talebi kapsamındaki veriler | Sonuçlanana kadar | Hukuki yükümlülük, hakların korunması |

## 7. Süreler, yedekler ve hizmet sağlayıcılar

- **Canlı sistem:** Onay anında erişim kapanır ve veriler veritabanımızdan (Supabase, Frankfurt/AB) silinir.
- **Yedekler:** Şifreli yedekler aynı bölgede tutulur ve en geç [30 gün] içinde döngüden çıkar; bir yedek geri yüklenirse silinen hesaplar yeniden silinir.
- **Yapay zekâ (Anthropic, ABD):** Yalnızca ücretli pakette ve izninizle gönderilen takma adlı girdiler ve çıktılar Anthropic'te kural olarak 30 gün içinde silinir; kullandığımız modellerde bu saklama zorunludur, silme talebiyle kısaltılamaz. Kullanım politikası ihlali şüphesiyle işaretlenen içerik Anthropic tarafından 2 yıla kadar tutulabilir.
- **Bildirim iletimi (Apple APNs, Google FCM):** Bildirimler Expo üzerinden değil doğrudan APNs ve FCM ile gönderilir; bildirim metni çocuk adı, not veya puan içermez. Belirteç kaydımız hesapla birlikte hemen silinir; APNs/FCM'in geçersiz saydığı belirteçler gönderim sırasında otomatik silinir; gönderim kuyruğu kayıtları 30 gün sonra temizlenir. Önceki taslaktaki "Expo'daki belirteç silme süresi" yer tutucusu bu nedenle kaldırıldı.
- **Süre ve bilgilendirme:** Talebinizi aldığımızda ve tamamladığımızda kayıtlı e-postanıza bilgi gönderir, işlemi en geç 30 gün içinde tamamlarız (KVKK m.13; Silme Yönetmeliği m.12).

## 8. Abonelik uyarısı: önce mağazadan iptal edin

Gina Plus ve Gina Pro abonelikleri yalnızca App Store (satıcı Apple Distribution International Ltd.) veya Google Play (Google Commerce Ltd.) üzerinden satılır; kart bilgileriniz ve mağazadaki satın alma geçmişiniz bize ulaşmaz. **Hesabı silmek veya uygulamayı kaldırmak aboneliği iptal etmez;** siz iptal edene kadar mağaza ücret almaya devam eder.

- **App Store:** Ayarlar > [Adınız] > Abonelikler > Gina > Aboneliği İptal Et.
- **Google Play:** Play Store > Profil > Ödemeler ve abonelikler > Abonelikler > Gina > Aboneliği iptal et.
- Silme ekranındaki uyarı ve Ayarlar > Abonelik > Aboneliği yönet bağlantısı sizi bu ekranlara götürür.

İptal dönem sonunda etkili olur; o tarihe kadar Plus/Pro özelliklerini kullanmak için "abonelik dönemi sonunda sil" seçeneği vardır. İade, satıcı mağazanın iade politikasına tabidir (App Store'da reportaproblem.apple.com); gerekirse mağaza nezdinde size destek oluruz (Abonelik Koşulları Bölüm 8–10).

## 9. Birden fazla ebeveyn, 18 yaş ve çocuk adına talepler

- **Ailede başka ebeveyn/vasi varsa (uygulamadaki güncel davranış):** yalnızca sizin hesabınız, aile üyeliğiniz ve size ait kişisel kayıtlar (yazdığınız notlar, oluşturduğunuz paylaşım bağlantıları, bildirim tercihleri) silinir; aile sahipliği diğer ebeveyne geçer, çocuk profilleri ve ortak kayıtlar onda kalır. Son ebeveyn hesabı silinince aile, tüm çocuk profilleri ve eşleştirilmiş cihazların anonim oturumları silinir. Uzman incelemesi gerekir: bu kuralın Veli Beyanı ve KVKK silme yükümlülüğüyle uyumu.
- **18 yaşını dolduran çocuk:** Profil, doğum yılına 18 eklenen yılın 31 Aralık'ında pasife alınır ve [SİLME SÜRESİ, örn. 90 gün] içinde kendiliğinden silinir; öncesinde bildirim alırsınız (Veli Beyanı Bölüm 11). Reşit olan çocuğunuz kimliğini doğrulayarak [E-POSTA] üzerinden silme isteyebilir. [AVUKAT: kimlik doğrulama yöntemi]
- **Çocuk adına talepler:** Yalnızca aile hesabındaki veli/vasi yapabilir; diğer durumlar için KVKK Başvuru Formu Bölüm 5 uygulanır.

## 10. İletişim ve KVKK başvurusu

- E-posta: [E-POSTA] (kayıtlı adresinizden) · Posta: [ADRES] · KEP: [KEP ADRESİ – varsa]. Telefon kanalımız yoktur.
- KVKK Başvuru Formu: [WEB ADRESİ]/legal/kvkk-basvuru-formu (uygulamada Ayarlar > Gizlilik ve Yasal > KVKK Başvurusu; bu ekran henüz yoktur, şu an uygulama içinden Yardım > destek talebi açılabilir).
- Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır; yanıtı yetersiz bulursanız Kişisel Verileri Koruma Kurulu'na (kvkk.gov.tr) şikâyet edebilirsiniz; süreler KVKK Başvuru Formu'ndadır.

## Değişiklik geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.2 | 2026-10-30 | İlk taslak; belge ailesinin 0.2 revizyonuyla birlikte envanter maddesi ve inceleme notlarına göre yazıldı (0.1 yayımlanmadı). Slug'lar ve süreler DECISIONS.md ile hizalandı; e-posta doğrulamalı web silme, hemen/dönem sonunda silme, bildirim için e-posta adresinin tutulması, Apple belirteç iptali, anında eşleştirme iptali, yalnızca doğum yılı, 18 yaş kuralı, telefon kanalı ve dışa aktarma yokluğu yazıldı. Çok ebeveynli silme [ÜRÜN KARARI]. |
| 0.2 (C11 teknik düzeltme) | 2026-11-06 | Uygulama denetimi 6 Kasım koduyla yeniden doğrulandı: etki önizlemesi, yeniden doğrulama (şifre veya e-posta kodu), çok ebeveynli silme davranışı, arşiv ≠ silme, yüklenen dosyalar, Expo yerine doğrudan APNs/FCM; uygulanmamış vaatler güncellendi. Hukuk uzmanı onayı yoktur. |
| 0.2 | 2026-10-30 | Belge seti tutarlılık kontrolü: cihaz eşleştirme ekran yolu "Ayarlar > Çocuklar > [Çocuk] > Cihazlar" olarak eşitlendi; rıza/beyan kayıtlarının hukuki sebebi Aydınlatma §5 ile aynı biçimde "m.5/2-ç ve m.5/2-e" yazıldı. |
| 0.2 (D18 İngilizce sürüm) | 2026-11-06 | Belgenin sonuna güncel Türkçe metinden çevrilen bilgi amaçlı İngilizce bölüm eklendi; Türkçe metnin içeriği değiştirilmedi. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d18-2026-11-06/README.md`. |
| 0.2 (D19 tutarlılık düzeltmesi) | 2026-11-06 | Koddan doğrulanan davranışa göre (TR ve EN birlikte): §5 "Giriş bağlantıları" satırında Apple belirteç iptalinin henüz uygulanmadığı (başlıktaki denetim notuyla aynı); §10'da uygulama içi KVKK Başvurusu ekranının henüz olmadığı. §9 çok ebeveynli silme anlatımı koddan doğrulandı (`20261031120000_account_lifecycle.sql`); Veli Beyanı §10 buna eşitlendi. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d19-2026-11-06/README.md`. |

---

# Gina Aile – Account and Data Deletion (English)

| | |
|---|---|
| Version | 0.2 (draft) |
| Date | 30 October 2026 |
| Effective date | [YÜRÜRLÜK TARİHİ] |
| Status | **Draft. No legal expert has reviewed or approved it (6 November 2026); it is not published without expert approval and a written approval record.** The Turkish text prevails; this English translation is for information only. It was translated from the Turkish text on 6 November 2026 (D18) and has the same content. Placeholders and Turkish lawyer/product notes in square brackets are shared with the Turkish text; an English gloss follows in parentheses. |
| Data controller | [VERİ SORUMLUSU UNVANI] · [ADRES] · [E-POSTA] · MERSİS/tax ID: [MERSİS/VKN] |
| Published at | [WEB ADRESİ]/legal/hesap-ve-veri-silme; Google Play "Data safety" and App Store Connect "Privacy Choices" link; in the app, Settings > Account > Delete Account |
| Related documents | [Privacy Policy](./gizlilik-politikasi.md) · [KVKK Privacy Notice](./kvkk-aydinlatma-metni.md) · [Terms of Use](./kullanim-kosullari.md) · [Subscription Terms](./abonelik-kosullari-ve-on-bilgilendirme.md) · [Cookie Policy](./cerez-politikasi.md) · [Data Subject Request Form](./kvkk-basvuru-formu.md) |

## App audit of 31 October 2026 (re-verified on 6 November 2026) — must be updated before publication

The sections of this document below are a **legal draft** describing the target behaviour, not evidence of a working feature. The current app (`supabase/functions/delete-account/handler.ts`, `supabase/migrations/20261106040000_deletion_preview.sql`): **Delete my account** in the parent menu and on the family set-up screen → impact preview (valid for 15 minutes; if the target changes, no deletion takes place) → re-verification with the current password or a single-use email code from the last 5 minutes + confirmation of the irreversible action → immediate deletion. The account is removed separately from each family it is a member of. If there is another parent, shared child records are kept and family ownership is transferred; if the last parent is deleted, the family/child data and the paired anonymous device accounts are deleted. Notes written by the deleted user, share links they created, push preferences and sessions are removed. The server's RLS/Edge membership check also closes access with an old JWT. The store subscription is not cancelled. A single child profile is deleted from the child card in the parent menu, with an impact preview and a second confirmation explaining the data scope (`confirm_child_deletion`); other children are kept, another parent's personal note about that child is not deleted, and family-linked content (uploaded files, question bank, rewards) is kept. Unlike deletion, a child profile can be **archived** (a reversible pause; earned records are kept, paired devices are blocked) and records can be archived and restored in bulk; archiving is not deletion and has no time limit. Uploaded documents/images are deleted when the family is deleted; the storage object is removed by an hourly cleanup job.

**Draft promises not yet implemented:** deletion scheduled for the end of the period; the no-sign-in web deletion form with email verification; deletion received/completed emails (no email provider is connected); automatic deactivation at 18; Sign in with Apple token revocation (social sign-in appears in the app if the provider setting is on; no revocation request is sent to Apple on deletion); statutory retention periods (purchase, consent and audit records are currently deleted at once together with the family) and automation of deletion from backups. If there is an active subscription, the deletion preview shows a warning and a link to the Subscription screen in the app (and from there to the store's management page); the deletion screen also shows the warning "cancel the subscription in the store first". Do not publish these as if they existed. Supabase/store service logs and backups are not deleted by the app transaction; the retention/destruction policy must be verified separately against the real production settings. The published text must be matched to the path and behaviour in the app; the controller's name, contact details, retention periods and the web request route must be completed.

## Short summary (not binding)

- You can delete your account from within the app via **Settings > Account > Delete Account**; if you cannot sign in, you send a request with the form on this page by verifying your registered email. The account is not suspended; it is deleted completely.
- Data is deleted from the live system immediately and from backups within [30 gün] (30 days) at the latest; only records kept for legal reasons (purchase records [10 yıl] (10 years), security logs [12 ay] (12 months)) remain for a limited time.
- **Deleting the account does not cancel your subscription;** cancel the subscription in the App Store or Google Play first.

## 1. What this page is for

This page explains how to delete your Gina Aile ("Gina") account and data, what is deleted and what is kept for how long (KVKK Art. 7, Art. 11(e); Regulation on the Deletion, Destruction or Anonymisation of Personal Data Art. 12; Apple 5.1.1(v); Google Play account deletion policy); the periods are the same as in the Privacy Policy, the Privacy Notice and our store declarations.

Only a parent or guardian aged 18 or over opens and deletes the account. Children have no account; an account cannot be deleted from child mode or from a paired tablet.

## 2. Deleting your account from within the app

1. Go to the parent area (leaving child mode asks for the 4-digit parent PIN).
2. Select **Settings > Account > Delete Account**.
3. If you have an active subscription, a warning and the store's cancellation link are shown (Section 8); if you do not cancel, billing continues in the store.
4. Choose **Delete now** or **Delete at the end of the subscription period**. With scheduled deletion, your account is deleted automatically at the end of the period; you can cancel the schedule from the same screen until that date. The option to delete immediately is always available. [ÜRÜN KARARI: abonelik yenilenirse planlı tarih] (Product decision: the scheduled date if the subscription renews.)
5. Confirm; for security we may ask you to sign in again.

At the moment of confirmation (with scheduled deletion, when the date arrives), access is closed; sessions and tablet pairings become invalid immediately. You do not need to write to the support team; a deleted account cannot be restored. There is no bulk data export feature; before deleting, you can request a copy of your data with the Data Subject Request Form (Art. 11(b); Section 10).

## 3. Deletion request via the web without signing in

If you cannot get into the app, use the **Deletion request** form on this page:

1. Enter the email address registered to your account. If you used "Hide My Email" with Sign in with Apple, enter the relay address Apple gave you.
2. We send to this address a single-use verification link valid for [DOĞRULAMA BAĞLANTISI SÜRESİ, örn. 24 saat] (verification link validity, e.g. 24 hours); for security reasons we do not show on screen whether the address is linked to an account.
3. Click the link and confirm the request; the account is deleted as in Section 2. If you have an active subscription, we warn you in the email with the store's cancellation link. [ÜRÜN KARARI: web talebinde "dönem sonunda sil" seçeneği] (Product decision: a "delete at the end of the period" option for web requests.)

The form asks for no information other than the email address. If you cannot access your registered address, send your request with the information in the Data Subject Request Form by post ([ADRES]) or KEP (registered electronic mail; [KEP ADRESİ – varsa], if any); we do not ask for a copy of an identity card. The web form deletes the entire account; for a single child profile, use the app.

## 4. Deleting a single child profile or specific data without deleting the account

- **Child profile:** Settings > Children > [Child] > Delete Profile. The profile (name/nickname, birth year, child PIN), chore and star history, calendar, notes, grade/score and development records, AI outputs for that child and paired device sessions are deleted; the family and other children are not affected. A deleted profile is deleted for everyone in the family.
- **Individual records:** Chores, notes, calendar entries and AI summaries are deleted from the relevant screens (summaries are deleted automatically after 12 months at the latest).
- **Device pairing:** removed under Settings > Children > [Child] > Devices; revocation is effective immediately, and the device can no longer access data.

These deletions are also removed from the live system immediately and from backups within [30 gün] (30 days) at the latest.

## 5. What is deleted when the account is deleted

| Data | Scope |
|---|---|
| Parent account | Email, name, password hash, language/region preference, parent PIN, settings and permissions |
| Family | Family name, family invite codes, memberships, time zone |
| Child profiles | Name/nickname, birth year, avatar and grade level if any, child PIN |
| Chores and points | Chores, completion/approval history, child mode activity records, stars, rewards, grade/score information |
| Calendar, notes, development | Calendar and class schedule, notes, development (milestone) records |
| Uploaded documents and images, Prova records | Images/PDFs uploaded to the family (when the family is deleted; the storage object by the hourly cleanup), question bank, practice tests, the child's answers and workbooks, AI confirmation records and assessment suggestions; teacher share links you created |
| AI outputs | All AI summaries and outputs in Gina (for Anthropic, Section 7) |
| Device pairings | Paired tablets, anonymous child sessions, pairing codes; become invalid immediately |
| Notification tokens | Push tokens and notification preferences (for APNs/FCM, Section 7; Expo is not used) |
| Sign-in links | Sign in with Apple (notifying Apple of token revocation is intended but not yet carried out by the app; see the audit note at the top), Sign in with Google, email/password sign-in |

## 6. What is kept for a limited time for legal or legitimate reasons

The following records are kept after deletion too; access to them is restricted, they are pseudonymised where possible, not used for any other purpose, and deleted by periodic destruction (at least every six months) when the period ends.

| Record | Period | Reason |
|---|---|---|
| Purchase and subscription verification records (transaction ID, plan, dates) | [10 yıl] (10 years) | Tax and commercial legislation (KVKK Art. 5(2)(ç)) |
| Security and server logs (IP, timestamp) | [12 ay] (12 months) | Security, prevention of abuse (Art. 5(2)(f)) [AVUKAT: 5651 sayılı Kanun] (Lawyer note: Turkey's Internet Law No. 5651.) |
| Consent, feature permission, parent declaration and pre-purchase information records (under a pseudonymous ID; no child name) | [3 yıl] (3 years) | Evidence; legal obligation (Art. 5(2)(ç)) and establishment, exercise or protection of a right (Art. 5(2)(e)) [AVUKAT: zamanaşımı] (Lawyer note: limitation period.) |
| Record of your deletion request, KVKK requests and support correspondence | [3 yıl] (3 years) | Proof that the request was fulfilled |
| Your registered email address | Until the deletion is completed | Received and completed notices; deleted afterwards |
| Record of revocation of the Sign in with Apple token | [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] (retention period of the Apple token revocation record) | Proof of Apple's revocation requirement [AVUKAT] (Lawyer note.) |
| Data covered by an ongoing dispute or a request from a competent authority | Until concluded | Legal obligation, protection of rights |

## 7. Periods, backups and service providers

- **Live system:** Access is closed at the moment of confirmation and the data is deleted from our database (Supabase, Frankfurt/EU).
- **Backups:** Encrypted backups are kept in the same region and drop out of the rotation within [30 gün] (30 days) at the latest; if a backup is restored, deleted accounts are deleted again.
- **AI (Anthropic, USA):** Pseudonymised inputs and outputs sent only on a paid plan and with your permission are, as a rule, deleted at Anthropic within 30 days; for the models we use, this retention is mandatory and cannot be shortened by a deletion request. Content flagged on suspicion of a usage policy violation may be kept by Anthropic for up to 2 years.
- **Notification delivery (Apple APNs, Google FCM):** Notifications are sent directly through APNs and FCM, not through Expo; notification text contains no child name, note or score. Our token record is deleted immediately together with the account; tokens that APNs/FCM consider invalid are deleted automatically during sending; send queue records are cleaned up after 30 days. The placeholder "token deletion period at Expo" in the earlier draft was therefore removed.
- **Period and notification:** We send information to your registered email when we receive and when we complete your request, and complete the process within 30 days at the latest (KVKK Art. 13; Deletion Regulation Art. 12).

## 8. Subscription warning: cancel in the store first

Gina Plus and Gina Pro subscriptions are sold only through the App Store (seller Apple Distribution International Ltd.) or Google Play (Google Commerce Ltd.); your card details and your purchase history in the store do not reach us. **Deleting the account or removing the app does not cancel the subscription;** the store keeps charging until you cancel.

- **App Store:** Settings > [Your name] > Subscriptions > Gina > Cancel Subscription.
- **Google Play:** Play Store > Profile > Payments & subscriptions > Subscriptions > Gina > Cancel subscription.
- The warning on the deletion screen and the Settings > Subscription > Manage subscription link take you to these screens.

Cancellation takes effect at the end of the period; to use the Plus/Pro features until that date, there is the "delete at the end of the subscription period" option. Refunds are subject to the refund policy of the selling store (on the App Store, reportaproblem.apple.com); if necessary, we support you with the store (Subscription Terms Sections 8–10).

## 9. More than one parent, age 18 and requests on a child's behalf

- **If there is another parent/guardian in the family (current behaviour in the app):** only your account, your family membership and personal records belonging to you (notes you wrote, share links you created, notification preferences) are deleted; family ownership passes to the other parent, and the child profiles and shared records stay with them. When the last parent account is deleted, the family, all child profiles and the anonymous sessions of paired devices are deleted. Expert review is needed: consistency of this rule with the Parent Declaration and the KVKK deletion obligation.
- **A child who turns 18:** The profile is deactivated on 31 December of the year found by adding 18 to the birth year and is deleted automatically within [SİLME SÜRESİ, örn. 90 gün] (deletion period, e.g. 90 days); you receive a notice beforehand (Parent Declaration Section 11). Your child who has come of age can request deletion via [E-POSTA] by verifying their identity. [AVUKAT: kimlik doğrulama yöntemi] (Lawyer note: identity verification method.)
- **Requests on a child's behalf:** Only a parent/guardian in the family account can make them; for other cases, Section 5 of the Data Subject Request Form applies.

## 10. Contact and KVKK requests

- Email: [E-POSTA] (from your registered address) · Post: [ADRES] · KEP: [KEP ADRESİ – varsa] (if any). We have no telephone channel.
- Data Subject Request Form: [WEB ADRESİ]/legal/kvkk-basvuru-formu (in the app, Settings > Privacy and Legal > Data Subject Request; this screen does not exist yet, at present you can open a support request from Help in the app).
- Requests are concluded free of charge within 30 days at the latest; if you find the reply insufficient, you can complain to the Personal Data Protection Board (kvkk.gov.tr); the deadlines are in the Data Subject Request Form.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.2 | 30 October 2026 | First draft; written together with the 0.2 revision of the document family according to the inventory item and the review notes (0.1 was not published). Slugs and periods aligned with DECISIONS.md; web deletion with email verification, deletion now/at the end of the period, keeping the email address for notices, Apple token revocation, immediate pairing revocation, birth year only, 18-year rule, no telephone channel and no data export written. Deletion with several parents [ÜRÜN KARARI] (product decision). |
| 0.2 (C11 technical correction) | 6 November 2026 | App audit re-verified against the 6 November code: impact preview, re-verification (password or email code), deletion behaviour with several parents, archive ≠ deletion, uploaded files, direct APNs/FCM instead of Expo; unimplemented promises updated. No legal expert approval. |
| 0.2 | 30 October 2026 | Consistency check across the document set: device pairing screen path aligned as "Settings > Children > [Child] > Devices"; legal basis of consent/declaration records written as "Art. 5(2)(ç) and Art. 5(2)(e)", the same as Privacy Notice §5. |
| 0.2 (D18 English version) | 6 November 2026 | This English section added, translated from the current Turkish text; the content of the Turkish text was not changed. No legal expert approval. Details: `docs/release/d18-2026-11-06/README.md`. |
| 0.2 (D19 consistency correction) | 6 November 2026 | Following behaviour verified in the code (TR and EN together): in the §5 "Sign-in links" row, Apple token revocation not yet implemented (same as the audit note at the top); in §10, the in-app Data Subject Request screen does not exist yet. The §9 multi-parent deletion description verified in the code (`20261031120000_account_lifecycle.sql`); Parent Declaration §10 aligned with it. No legal expert approval. Details: `docs/release/d19-2026-11-06/README.md`. |
