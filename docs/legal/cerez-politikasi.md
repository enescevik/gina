# Gina Aile – Çerez ve Benzer Teknolojiler Politikası (Web)

| | |
|---|---|
| Sürüm | 0.2 (taslak) |
| Tarih | 2026-10-30 |
| Yürürlük tarihi | [YÜRÜRLÜK TARİHİ] |
| Durum | **Taslak. Hukuk uzmanı incelemesi ve onayı yapılmadı (6 Kasım 2026); uzman onayı ve yazılı onay kaydı olmadan yayımlanmaz.** Uygulama denetimi §2'de: web uygulaması tablodakinden fazla yerel depolama ögesi kullanıyor. |
| Veri sorumlusu | [VERİ SORUMLUSU UNVANI] · [ADRES] · [E-POSTA] · MERSİS/VKN: [MERSİS/VKN] · KEP: [KEP ADRESİ – varsa] |
| Yayın yeri | https://ginafamily.com/legal/cerez-politikasi (herkese açık HTML, TR/EN); web alt bilgisi; Gizlilik Politikası §16 ve Aydınlatma Metni §12 bağlantıları; rıza gerektiren öge eklenirse rıza bandı |
| İlgili belgeler | [Gizlilik Politikası](./gizlilik-politikasi.md) · [KVKK Aydınlatma Metni](./kvkk-aydinlatma-metni.md) · [Kullanım Koşulları](./kullanim-kosullari.md) · [Abonelik Koşulları](./abonelik-kosullari-ve-on-bilgilendirme.md) · [Hesap ve Veri Silme](./hesap-ve-veri-silme.md) · [KVKK Başvuru Formu](./kvkk-basvuru-formu.md) |
| Dil | Türkçe metin esastır (805 sayılı Kanun); İngilizce çeviri bilgi amaçlıdır ve sayfanın sonundadır. / The Turkish text prevails; an English version is at the end of this page. |

## Kısa özet

- Gina web uygulaması tarayıcınıza oturumunuzu sürdürmek, dil/bölge tercihinizi hatırlamak ve ağ kesildiğinde yarım kalan işlemleri (ör. cevap, takvim komutu, destek mesajı) kaybetmeden tekrar denemek için veri yazar (§2). Bunlar birinci taraf, işlevsel ögelerdir; açık rıza gerektirip gerektirmediği için uzman incelemesi gerekir.
- Analitik, reklam veya takip çerezi kullanmayız; bu yüzden çerez bandı göstermeyiz. Siteye girmeniz rıza sayılmaz.
- Rıza gerektiren bir öge eklersek önce bu Politika'yı güncelleriz ve reddedebileceğiniz, önceden işaretli olmayan bir rıza bandı gösteririz.
- Mobil uygulamalarımız çerez kullanmaz ve takip SDK'sı içermez.

## 1. Kapsam ve tanımlar

Bu Politika, [VERİ SORUMLUSU UNVANI] ("biz") tarafından https://ginafamily.com adresinde sunulan Gina ebeveyn web uygulamasını ve aynı adresteki yasal sayfaları kapsar. Hangi verileri hangi amaçla işlediğimizi KVKK Aydınlatma Metni ve Gizlilik Politikası anlatır; bu Politika yalnızca tarayıcınızda saklanan ögeleri ve web ziyaretinde kendiliğinden oluşan ağ kayıtlarını açıklar. Yalnızca ekibimizin eriştiği yönetim paneli kapsam dışındadır.

- **Çerez:** Web sitesinin tarayıcınıza yazdığı ve sonraki her istekte sunucuya geri gönderilen küçük metin dosyası.
- **Yerel depolama (local storage / session storage):** Tarayıcının web uygulamasına ayırdığı, sunucuya kendiliğinden gönderilmeyen alan; veriyi gerektiğinde uygulama gönderir.
- **Benzer teknolojiler:** Piksel, web işaretçisi, cihaz parmak izi gibi yöntemler. Gina bunları kullanmaz.

Kişisel Verileri Koruma Kurumu'nun Çerez Uygulamaları Hakkında Rehberi (Temmuz 2025) çerezleri esas alır; kullanıcı üzerindeki etkisi aynı olduğundan aynı ilkeleri (kategori, amaç, süre, taraf, rıza) yerel depolamaya da uygularız.

## 2. Kullandığımız ögeler

[TEKNİK DOĞRULAMA: tablo yayın öncesi üretim derlemesinde tarayıcı araçlarıyla doğrulanır; kullanılmayan satır silinir.]

| Öge | Tür | Amaç | Süre | Taraf | Kategori |
|---|---|---|---|---|---|
| `sb-[SUPABASE PROJE REFERANSI]-auth-token` | Yerel depolama | Oturum: girişten sonra sizi tanıyan erişim ve yenileme belirteci; yalnızca Frankfurt'taki (AB) Supabase projemize gönderilir | Çıkış yapana veya tarayıcı verisini silene kadar; süresi dolunca kendiliğinden yenilenir | Birinci taraf | Zorunlu |
| `sb-[SUPABASE PROJE REFERANSI]-auth-token-code-verifier` | Yerel depolama | Apple veya Google ile girişte güvenli akışın (PKCE) doğrulama değeri | Giriş tamamlanınca silinir | Birinci taraf | Zorunlu |
| `[DİL/BÖLGE TERCİHİ ANAHTARI]` | Yerel depolama | Seçtiğiniz dili (Türkçe/İngilizce) ve tarih-sayı biçimi bölge ayarını hatırlamak | Siz değiştirene veya tarayıcı verisini silene kadar | Birinci taraf | Zorunlu (talep ettiğiniz arayüz tercihi) |
| `__cf_bm`, `cf_clearance` | Çerez | Yalnızca Cloudflare bot koruması etkinse: otomatik trafiği insan ziyaretçiden ayırmak | `__cf_bm` en fazla 30 dakika; `cf_clearance` [CLOUDFLARE DOĞRULAMA SÜRESİ] | Cloudflare (barındırma sağlayıcımız); yalnızca güvenlik | Zorunlu [TEKNİK KARAR: koruma kapalıysa satır silinir] |

**Uygulama denetimi (6 Kasım 2026):** Web uygulaması yukarıdaki tabloya ek olarak tarayıcının yerel depolamasına (`localStorage`/`sessionStorage`) birinci taraf, işlevsel ögeler yazar: yarım kalan işlemlerin ağ kesilince tekrar denenmesi için kısa ömürlü kuyruklar (`gina:` ve `gina.` önekli anahtarlar; ör. çocuğun Prova cevap günlüğü `gina.answer-journal.v1:*`, ebeveyn inceleme günlüğü, destek mesajı kuyruğu `gina.help-outbox.v1:*`, takvim/plan/kurulum/kütüphane komutları), QR'dan okunan bekleyen eşleştirme kodu (`gina-pending-pairing`), çocuk modu ve eşleştirilmiş cihaz kaydı ile oda görünümü önbelleği. Bu ögeler kişisel veri (ör. çocuğun cevap taslağı) içerebilir, sunucuya yalnız işlem tamamlanırken gönderilir, işlem bitince veya çıkışta silinmesi hedeflenir; reklam veya takip için kullanılmaz. Tablo yayın öncesi üretim derlemesinde tarayıcı araçlarıyla bu ögelerle tamamlanmalı ve "zorunlu/işlevsel" sınıflandırması için uzman incelemesi gerekir. Giriş yapmadan yalnızca yasal sayfaları okuyorsanız (varsa Cloudflare güvenlik çerezleri dışında) hiçbir öge yazılmaz. Öğretmen paylaşım bağlantısıyla açılan salt okunur sayfa da bu Politika kapsamındadır. Web'de satın alma olmadığından ödeme veya mağaza çerezi yoktur. Hiçbir öge izleme, profil çıkarma veya reklam için kullanılmaz ya da paylaşılmaz.

## 3. Zorunlu ögelerin hukuki sebebi ve engellenmesinin etkisi

Rehber'e göre yalnızca iletişimin sağlanması veya açıkça talep ettiğiniz hizmetin sunulması için kesinlikle gerekli çerezler açık rıza gerektirmez; bunlar KVKK m.5/2'deki diğer işleme şartlarına dayanır. Ögeleri şu sebeplerle işleriz:

- **Oturum ve giriş doğrulama ögeleri:** Kullanım Koşulları kapsamındaki hizmetin ifası (m.5/2-c): oturum olmadan giriş yapmış kalamazsınız. Ayrıca meşru menfaatimiz (m.5/2-f): hesabınızın ele geçirilmesini ve sahte istekleri önlemek.
- **Dil/bölge tercihi:** Hizmetin ifası (m.5/2-c); yalnızca seçtiğiniz dili göstermek için yazılır.
- **Cloudflare güvenlik çerezleri:** Meşru menfaatimiz (m.5/2-f): saldırı ve bot trafiğine karşı hizmetin kesintisiz ve güvenli çalışması.

Bu ögeler için açık rıza istemeyiz; aydınlatma yükümlülüğümüzü bu Politika ve KVKK Aydınlatma Metni ile yerine getiririz. Ögeleri tarayıcınızdan silebilir veya engelleyebilirsiniz (§7); ancak oturum ögesi olmadan giriş yapamazsınız, dil tercihi silinirse tarayıcınızın dili kullanılır, Cloudflare çerezleri engellenirse güvenlik doğrulaması tekrarlanabilir.

## 4. Neden çerez bandı göstermiyoruz

Çerez bandı, açık rıza gerektiren çerezler için rıza alma yoludur. Gina web uygulamasında performans/analitik veya reklam/pazarlama kategorisinde hiçbir öge yoktur; §2'deki uygulama denetiminde sayılan birinci taraf işlevsel yerel depolama ögeleri ise yalnızca sizin başlattığınız işlemi (oturum, yarım kalan işlemin tekrar denenmesi, eşleştirme, çocuk modu) sürdürmek için yazılır ve takip veya reklam için kullanılmaz [AVUKAT: bu işlevsel ögelerin Rehber'e göre "kesinlikle gerekli" sayılıp sayılmadığı; sayılmıyorsa rıza bandı gerekip gerekmediği]; Cloudflare'ın çerezsiz Web Analytics özelliği dâhil hiçbir analitik aracı etkin değildir [TEKNİK DOĞRULAMA: Cloudflare Pages'te Web Analytics kapalı]. Bu ögeler için rıza gerekmediği değerlendirmesiyle (uzman onayı bekliyor) bant göstermiyoruz; siteye girmeniz veya kullanmaya devam etmeniz rıza sayılmaz. Bilgilendirme, alt bilgideki bu Politika bağlantısıyla yapılır.

## 5. Rıza gerektiren ögeler eklenirse

İleride performans/analitik veya rızaya tabi işlevsel bir öge eklersek şu kurallar uygulanır; reklam ve takip çerezi planımız yoktur:

1. Önce bu Politika, Gizlilik Politikası ve KVKK Aydınlatma Metni güncellenir; yeni ögenin adı, amacı, süresi, tarafı ve yurt dışına aktarım bilgisi §2 tablosuna eklenir.
2. İlk ziyaretinizde kategori bazında seçim sunan bir rıza bandı gösterilir. Kutucuklar önceden işaretli gelmez; "Reddet" seçeneği "Kabul et" ile aynı yerde ve kolaylıktadır; sayfayı kaydırmak, bandı kapatmak veya siteyi kullanmaya devam etmek rıza sayılmaz.
3. Rıza verilmeden öge yüklenmez. Reddetmeniz web uygulamasını kullanmanızı engellemez; rıza hizmetin ön şartı yapılmaz ("çerez duvarı" yoktur).
4. Rızanızı alt bilgideki "Çerez Tercihleri" bağlantısından, verdiğiniz kolaylıkla her an geri alabilirsiniz; öge kaldırılır ve yeni veri toplanmaz.
5. Tercihinizi hatırlamak için yalnızca tercihi, bu Politika'nın sürümünü ve zaman damgasını içeren birinci taraf bir öge tutulur; giriş yapmışsanız aynı kayıt hesabınızın rıza kayıtlarına da yazılır ve Gizlilik Politikası'ndaki süreye ([3 YIL]) tabidir.
6. Rızanız en geç [12 AY] sonra yeniden sorulur [AVUKAT: yenileme aralığı].

Çerezsiz, toplulaştırılmış bir analitik aracı da bu bölüm kapsamındadır [AVUKAT: çerezsiz ölçümün Rehber ve KVKK m.5 karşısındaki durumu].

## 6. Cloudflare ağ günlükleri ve IP adresi

Web uygulaması ve bu sayfalar Cloudflare, Inc. (ABD) altyapısında barındırılır. Her ziyarette Cloudflare, bağlantıyı kurmak ve saldırılara karşı korumak için IP adresinizi, istek zamanını, istenen adresi ve tarayıcı bilgilerinizi işler. Bu bir çerez değildir; ziyaretinizle kendiliğinden gerçekleştiği için burada açıklıyoruz.

- **Hukuki sebep:** Meşru menfaatimiz (m.5/2-f): hizmetin güvenli ve kesintisiz sunulması; saldırı ve kötüye kullanımın önlenmesi.
- **Yurt dışına aktarım:** Cloudflare'ın ağı ABD dâhil küresel çalışır. Aktarım, Kurul'un ilan ettiği standart sözleşmenin Cloudflare ile imzalanması (KVKK m.9/4-c) ve beş iş günü içinde Kurum'a bildirilmesiyle (m.9/5) yapılır: [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Cloudflare]. Cloudflare hizmetin kendisini oluşturduğundan açık rızanıza başvurmayız; uygun güvence sağlanamazsa sağlayıcıyı değiştiririz (Aydınlatma Metni §7). Sözleşmedeki AB Standart Sözleşme Hükümleri ek tedbirdir; KVKK m.9 kapsamında güvence sayılmaz.
- **Saklama:** Kendi sunucularımızdaki (Supabase, Frankfurt) güvenlik günlükleri IP adresi ve zaman damgasıyla [12 ay] saklanır [AVUKAT: 5651 sayılı Kanun trafik verisi yükümlülüğü]. Cloudflare'ın ağ günlüğü saklama süresi: [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ – veri işleme sözleşmesinden].

Cloudflare bu verileri reklam veya profil çıkarma için kullanmaz; yalnızca ağ güvenliği ve hizmetin sunulması için işler [AVUKAT: Cloudflare bu işlemede veri işleyen mi, ayrı veri sorumlusu mu].

## 7. Tarayıcı ayarlarından silme ve engelleme

- **Çıkış yapmak** oturum ögesini siler.
- **Site verisini silmek:** Tarayıcınızın gizlilik ayarlarındaki "site verileri" veya "web sitesi verileri" bölümünden (menü adları tarayıcıya ve sürüme göre değişir) https://ginafamily.com için saklanan çerez ve site verisini silebilirsiniz.
- **Engellemek:** Aynı ayarlardan https://ginafamily.com için çerez ve site verisini engelleyebilirsiniz; bu durumda web uygulamasına giriş yapılamaz. Gizli/özel pencere kapandığında ögeler kendiliğinden silinir.

Bunlar yalnızca tarayıcınızı etkiler; hesabınızdaki verileri silmek için Ayarlar > Hesap > Hesabı Sil yolunu veya [Hesap ve Veri Silme](./hesap-ve-veri-silme.md) sayfasını kullanın.

## 8. Mobil uygulama

iOS ve Android uygulamalarımız çerez kullanmaz. Oturum bilgisi cihazınızda uygulamanın korumalı alanında saklanır ve çıkışta silinir; bu Gizlilik Politikası kapsamındadır. Uygulamalarda üçüncü taraf analitik, reklam veya takip SDK'sı yoktur; reklam kimlikleri (IDFA/AAID) toplanmaz; ilk sürümde çökme raporlama da yoktur. Bildirim (expo-notifications; bildirimler doğrudan APNs/FCM ile gönderilir, Expo bildirim hizmeti kullanılmaz) ve mağaza SDK'ları yalnızca hizmet için gereken veriyi işler, takip amacıyla veri toplamaz; mağaza gizlilik beyanlarımızda "takip: hayır" bildirilir.

## 9. Haklarınız ve iletişim

Bu ögelerle bağlantılı kişisel verileriniz için KVKK m.11'deki haklarınızı (bilgi alma, düzeltme, silme, itiraz ve diğerleri) [KVKK Başvuru Formu](./kvkk-basvuru-formu.md) üzerinden, kayıtlı e-postanızdan [E-POSTA] adresine, [ADRES] adresine yazılı olarak veya varsa KEP ile kullanabilirsiniz. Başvurular en geç 30 gün içinde ücretsiz yanıtlanır; telefon kanalımız yoktur. Kişisel Verileri Koruma Kurulu'na şikâyet hakkınız saklıdır.

## 10. Değişiklikler

Güncel sürüm ve yürürlük tarihi sayfanın başındadır; değişiklik günlüğü aşağıdadır ve kaynak deposunda tutulur. Rıza gerektiren bir öge her zaman §5'teki rıza bandıyla duyurulur. Diğer önemli değişiklikler Gizlilik Politikası'ndaki bildirim kuralına (yürürlükten en az [15 GÜN] önce) tabidir [AVUKAT: tüm belgelerde tek bildirim süresi]. Küçük düzeltmeler yalnızca bu sayfada yayımlanır. Türkçe metin esastır.

## Değişiklik geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.2 | 2026-10-30 | İlk taslak (0.1 yayımlanmadı); belge setinin 0.2 revizyonuyla birlikte oluşturuldu. İnceleme notları ve DECISIONS.md ile hizalandı: m.9/4-c standart sözleşme + m.9/5 bildirim, AB SCC güvence sayılmaz, hizmeti oluşturan sağlayıcıda açık rıza yolu yok; güvenlik günlükleri [12 ay], rıza kayıtları [3 YIL], bildirim [15 GÜN]; telefon kanalı ve web'de satış yok; yer tutucular ve /legal/* slug'ları diğer belgelerle eşitlendi. |
| 0.2 (C11 teknik düzeltme) | 2026-11-06 | Durum satırı (uzman onayı yok); §2'ye web uygulamasının gerçek yerel depolama ögeleri (işlem kuyrukları, bekleyen eşleştirme, çocuk modu ve önbellek) ve öğretmen paylaşım sayfası eklendi; "tarayıcıya kalıcı yazılmaz" ifadesi düzeltildi. |
| 0.2 | 2026-10-30 | Belge seti tutarlılık kontrolü: ilgili belgeler listesine Abonelik Koşulları bağlantısı eklendi. İçerik değişmedi. |
| 0.2 (D18 İngilizce sürüm) | 2026-11-06 | Belgenin sonuna güncel Türkçe metinden çevrilen bilgi amaçlı İngilizce bölüm eklendi; Türkçe metnin içeriği değiştirilmedi. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d18-2026-11-06/README.md`. |
| 0.2 (D19 tutarlılık düzeltmesi) | 2026-11-06 | Koddan doğrulanan davranışa göre (TR ve EN birlikte): §4'teki "işlevsel kategoride hiçbir öge yoktur" ifadesi kısa özet ve §2 uygulama denetimiyle çelişiyordu; işlevsel yerel depolama ögeleri §4'te anıldı ve sınıflandırması [AVUKAT] notuyla işaretlendi. KVKK Aydınlatma Metni §12 aynı şekilde eşitlendi. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d19-2026-11-06/README.md`. |

---

# Gina Aile – Cookies and Similar Technologies Policy (Web) (English)

| | |
|---|---|
| Version | 0.2 (draft) |
| Date | 30 October 2026 |
| Effective date | [YÜRÜRLÜK TARİHİ] |
| Status | **Draft. No legal expert has reviewed or approved it (6 November 2026); it is not published without expert approval and a written approval record.** App audit in §2: the web app uses more local storage items than are in the table. |
| Data controller | [VERİ SORUMLUSU UNVANI] · [ADRES] · [E-POSTA] · MERSİS/tax ID: [MERSİS/VKN] · KEP (registered electronic mail): [KEP ADRESİ – varsa] (if any) |
| Published at | https://ginafamily.com/legal/cerez-politikasi (public HTML, TR/EN); web footer; links from Privacy Policy §16 and Privacy Notice §12; a consent banner if an item requiring consent is added |
| Related documents | [Privacy Policy](./gizlilik-politikasi.md) · [KVKK Privacy Notice](./kvkk-aydinlatma-metni.md) · [Terms of Use](./kullanim-kosullari.md) · [Subscription Terms](./abonelik-kosullari-ve-on-bilgilendirme.md) · [Account and Data Deletion](./hesap-ve-veri-silme.md) · [Data Subject Request Form](./kvkk-basvuru-formu.md) |
| Language | The Turkish text prevails (Law No. 805 on the Compulsory Use of Turkish); this English translation is for information only. It was translated from the Turkish text on 6 November 2026 (D18) and has the same content. Placeholders and Turkish lawyer/technical notes in square brackets are shared with the Turkish text; an English gloss follows in parentheses. |

## Short summary

- The Gina web app writes data to your browser to keep you signed in, remember your language/region preference and, when the network drops, retry unfinished actions (e.g. an answer, a calendar command, a support message) without losing them (§2). These are first-party, functional items; expert review is needed on whether they require explicit consent.
- We use no analytics, advertising or tracking cookies; that is why we show no cookie banner. Visiting the site does not count as consent.
- If we add an item that requires consent, we first update this Policy and show a consent banner that you can decline and that is not pre-ticked.
- Our mobile apps do not use cookies and contain no tracking SDK.

## 1. Scope and definitions

This Policy covers the Gina parent web app offered by [VERİ SORUMLUSU UNVANI] ("we") at https://ginafamily.com and the legal pages at the same address. What data we process for what purpose is described in the KVKK Privacy Notice and the Privacy Policy; this Policy only explains the items stored in your browser and the network records created automatically during a web visit. The admin panel accessed only by our team is out of scope.

- **Cookie:** A small text file that a website writes to your browser and that is sent back to the server with every following request.
- **Local storage (local storage / session storage):** An area that the browser sets aside for the web app and that is not sent to the server automatically; the app sends the data when needed.
- **Similar technologies:** Methods such as pixels, web beacons and device fingerprinting. Gina does not use them.

The Personal Data Protection Authority's Guidelines on Cookie Practices (July 2025) are based on cookies; because the effect on the user is the same, we also apply the same principles (category, purpose, duration, party, consent) to local storage.

## 2. Items we use

[TEKNİK DOĞRULAMA: tablo yayın öncesi üretim derlemesinde tarayıcı araçlarıyla doğrulanır; kullanılmayan satır silinir.] (Technical verification: the table is verified with browser tools on the production build before publication; unused rows are deleted.)

| Item | Type | Purpose | Duration | Party | Category |
|---|---|---|---|---|---|
| `sb-[SUPABASE PROJE REFERANSI]-auth-token` | Local storage | Session: the access and refresh token that recognises you after sign-in; sent only to our Supabase project in Frankfurt (EU) | Until you sign out or clear browser data; renewed automatically when it expires | First party | Strictly necessary |
| `sb-[SUPABASE PROJE REFERANSI]-auth-token-code-verifier` | Local storage | Verification value of the secure flow (PKCE) when signing in with Apple or Google | Deleted when sign-in is completed | First party | Strictly necessary |
| `[DİL/BÖLGE TERCİHİ ANAHTARI]` (language/region preference key) | Local storage | Remembering the language you chose (Turkish/English) and the region setting for date and number formats | Until you change it or clear browser data | First party | Strictly necessary (an interface preference you requested) |
| `__cf_bm`, `cf_clearance` | Cookie | Only if Cloudflare bot protection is on: telling automated traffic apart from human visitors | `__cf_bm` at most 30 minutes; `cf_clearance` [CLOUDFLARE DOĞRULAMA SÜRESİ] (Cloudflare clearance duration) | Cloudflare (our hosting provider); security only | Strictly necessary [TEKNİK KARAR: koruma kapalıysa satır silinir] (Technical decision: the row is deleted if the protection is off.) |

**App audit (6 November 2026):** In addition to the table above, the web app writes first-party, functional items to the browser's local storage (`localStorage`/`sessionStorage`): short-lived queues for retrying unfinished actions when the network drops (keys prefixed `gina:` and `gina.`; e.g. the child's Prova answer journal `gina.answer-journal.v1:*`, the parent review journal, the support message queue `gina.help-outbox.v1:*`, calendar/plan/setup/library commands), a pending pairing code read from a QR code (`gina-pending-pairing`), the child mode and paired device record, and a room view cache. These items may contain personal data (e.g. the child's draft answer), are sent to the server only when the action is completed, and are intended to be deleted when the action ends or on sign-out; they are not used for advertising or tracking. Before publication the table must be completed with these items using browser tools on the production build, and expert review is needed for the "strictly necessary/functional" classification. If you only read the legal pages without signing in, no item is written (apart from Cloudflare security cookies, if any). The read-only page opened through a teacher share link is also within the scope of this Policy. Because there are no purchases on the web, there are no payment or store cookies. No item is used or shared for tracking, profiling or advertising.

## 3. Legal basis of strictly necessary items and the effect of blocking them

According to the Guidelines, only cookies strictly necessary to carry out communication or to provide a service you expressly requested do not require explicit consent; they rely on the other processing conditions in KVKK Art. 5(2). We process the items on the following bases:

- **Session and sign-in verification items:** Performance of the service under the Terms of Use (Art. 5(2)(c)): without a session you cannot stay signed in. Also our legitimate interest (Art. 5(2)(f)): preventing your account from being taken over and preventing forged requests.
- **Language/region preference:** Performance of the service (Art. 5(2)(c)); written only to show the language you chose.
- **Cloudflare security cookies:** Our legitimate interest (Art. 5(2)(f)): keeping the service running without interruption and securely against attacks and bot traffic.

We do not ask for explicit consent for these items; we fulfil our information duty with this Policy and the KVKK Privacy Notice. You can delete or block the items in your browser (§7); however, without the session item you cannot sign in, if the language preference is deleted your browser's language is used, and if Cloudflare cookies are blocked the security check may be repeated.

## 4. Why we do not show a cookie banner

A cookie banner is a way to obtain consent for cookies that require explicit consent. The Gina web app has no item in the performance/analytics or advertising/marketing categories; the first-party functional local storage items listed in the app audit in §2 are written only to keep an operation you started going (session, retrying an unfinished operation, pairing, child mode) and are not used for tracking or advertising [AVUKAT: bu işlevsel ögelerin Rehber'e göre "kesinlikle gerekli" sayılıp sayılmadığı; sayılmıyorsa rıza bandı gerekip gerekmediği] (Lawyer note: whether these functional items count as "strictly necessary" under the Guide; if not, whether a consent banner is needed); no analytics tool is active, including Cloudflare's cookieless Web Analytics feature [TEKNİK DOĞRULAMA: Cloudflare Pages'te Web Analytics kapalı] (technical verification: Web Analytics off in Cloudflare Pages). On the assessment that these items do not require consent (awaiting expert approval), we show no banner; visiting the site or continuing to use it does not count as consent. Information is given through the link to this Policy in the footer.

## 5. If items requiring consent are added

If in the future we add a performance/analytics item or a functional item subject to consent, the following rules apply; we have no plans for advertising or tracking cookies:

1. First this Policy, the Privacy Policy and the KVKK Privacy Notice are updated; the new item's name, purpose, duration, party and information on transfers abroad are added to the §2 table.
2. On your first visit, a consent banner offering a choice by category is shown. Boxes are not pre-ticked; the "Decline" option is in the same place and as easy as "Accept"; scrolling the page, closing the banner or continuing to use the site does not count as consent.
3. No item is loaded before consent is given. Declining does not prevent you from using the web app; consent is not made a precondition of the service (there is no "cookie wall").
4. You can withdraw your consent at any time, as easily as you gave it, from the "Cookie Preferences" link in the footer; the item is removed and no new data is collected.
5. To remember your choice, only a first-party item containing the choice, the version of this Policy and a timestamp is kept; if you are signed in, the same record is also written to your account's consent records and is subject to the period in the Privacy Policy ([3 YIL] (3 years)).
6. Your consent is asked for again after [12 AY] (12 months) at the latest [AVUKAT: yenileme aralığı] (Lawyer note: renewal interval).

A cookieless, aggregated analytics tool is also covered by this section [AVUKAT: çerezsiz ölçümün Rehber ve KVKK m.5 karşısındaki durumu] (Lawyer note: status of cookieless measurement under the Guidelines and KVKK Art. 5).

## 6. Cloudflare network logs and IP address

The web app and these pages are hosted on the infrastructure of Cloudflare, Inc. (USA). On every visit Cloudflare processes your IP address, the time of the request, the requested address and your browser information to establish the connection and protect against attacks. This is not a cookie; we explain it here because it happens automatically with your visit.

- **Legal basis:** Our legitimate interest (Art. 5(2)(f)): providing the service securely and without interruption; preventing attacks and abuse.
- **Transfer abroad:** Cloudflare's network operates globally, including in the USA. The transfer is made by signing with Cloudflare the standard contract announced by the Board (KVKK Art. 9(4)(c)) and notifying it to the Authority within five business days (Art. 9(5)): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Cloudflare] (standard contract signature date / Authority notification date). Because Cloudflare is part of the service itself, we do not rely on your explicit consent; if an appropriate safeguard cannot be provided, we change the provider (Privacy Notice §7). The EU Standard Contractual Clauses in the contract are an additional measure; they are not a safeguard under KVKK Art. 9.
- **Retention:** Security logs on our own servers (Supabase, Frankfurt) are kept with IP address and timestamp for [12 ay] (12 months) [AVUKAT: 5651 sayılı Kanun trafik verisi yükümlülüğü] (Lawyer note: traffic data obligation under Turkey's Internet Law No. 5651). Cloudflare's network log retention period: [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ – veri işleme sözleşmesinden] (Cloudflare log retention period – from the data processing agreement).

Cloudflare does not use this data for advertising or profiling; it processes it only for network security and to provide the service [AVUKAT: Cloudflare bu işlemede veri işleyen mi, ayrı veri sorumlusu mu] (Lawyer note: whether Cloudflare is a processor or a separate controller for this processing).

## 7. Deleting and blocking from browser settings

- **Signing out** deletes the session item.
- **Clearing site data:** In the "site data" or "website data" section of your browser's privacy settings (menu names vary by browser and version), you can delete the cookies and site data stored for https://ginafamily.com.
- **Blocking:** In the same settings you can block cookies and site data for https://ginafamily.com; in that case you cannot sign in to the web app. When a private/incognito window is closed, the items are deleted automatically.

These affect only your browser; to delete the data in your account, use Settings > Account > Delete Account or the [Account and Data Deletion](./hesap-ve-veri-silme.md) page.

## 8. Mobile app

Our iOS and Android apps do not use cookies. Session information is stored on your device in the app's protected area and deleted on sign-out; this is covered by the Privacy Policy. The apps contain no third-party analytics, advertising or tracking SDK; advertising IDs (IDFA/AAID) are not collected; in the first release there is no crash reporting either. The notification library (expo-notifications; notifications are sent directly through APNs/FCM, the Expo notification service is not used) and the store SDKs process only the data needed for the service and do not collect data for tracking; our store privacy declarations state "tracking: no".

## 9. Your rights and contact

For your personal data linked to these items, you can exercise your rights under KVKK Art. 11 (information, rectification, erasure, objection and others) through the [Data Subject Request Form](./kvkk-basvuru-formu.md), from your registered email to [E-POSTA], in writing to [ADRES] or, if available, by KEP. Requests are answered free of charge within 30 days at the latest; we have no telephone channel. Your right to complain to the Personal Data Protection Board is reserved.

## 10. Changes

The current version and effective date are at the top of the page; the change log is below and kept in the source repository. An item requiring consent is always announced with the consent banner in §5. Other material changes are subject to the notice rule in the Privacy Policy (at least [15 GÜN] (15 days) before they take effect) [AVUKAT: tüm belgelerde tek bildirim süresi] (Lawyer note: a single notice period across all documents). Minor corrections are published only on this page. The Turkish text prevails.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.2 | 30 October 2026 | First draft (0.1 was not published); created together with the 0.2 revision of the document set. Aligned with the review notes and DECISIONS.md: Art. 9(4)(c) standard contract + Art. 9(5) notification, EU SCCs are not a safeguard, no explicit consent route for providers that make up the service; security logs [12 ay] (12 months), consent records [3 YIL] (3 years), notice [15 GÜN] (15 days); no telephone channel and no sales on the web; placeholders and /legal/* slugs aligned with the other documents. |
| 0.2 (C11 technical correction) | 6 November 2026 | Status row (no expert approval); the web app's actual local storage items (action queues, pending pairing, child mode and cache) and the teacher share page added to §2; the statement "nothing is written persistently to the browser" corrected. |
| 0.2 | 30 October 2026 | Consistency check across the document set: Subscription Terms link added to the list of related documents. Content unchanged. |
| 0.2 (D18 English version) | 6 November 2026 | This English section added, translated from the current Turkish text; the content of the Turkish text was not changed. No legal expert approval. Details: `docs/release/d18-2026-11-06/README.md`. |
| 0.2 (D19 consistency correction) | 6 November 2026 | Following behaviour verified in the code (TR and EN together): the statement in §4 that "there is no item in the functional category" contradicted the short summary and the §2 app audit; the functional local storage items are now mentioned in §4 and their classification marked with an [AVUKAT] note. KVKK Privacy Notice §12 aligned in the same way. No legal expert approval. Details: `docs/release/d19-2026-11-06/README.md`. |
