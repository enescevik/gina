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
| Dil | Türkçe metin esastır (805 sayılı Kanun); İngilizce çeviri bilgi amaçlıdır. |

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

Çerez bandı, açık rıza gerektiren çerezler için rıza alma yoludur. Gina web uygulamasında işlevsel, performans/analitik veya reklam/pazarlama kategorisinde hiçbir öge yoktur; Cloudflare'ın çerezsiz Web Analytics özelliği dâhil hiçbir analitik aracı etkin değildir [TEKNİK DOĞRULAMA: Cloudflare Pages'te Web Analytics kapalı]. Rıza alacak bir şey olmadığından bant göstermiyoruz; siteye girmeniz veya kullanmaya devam etmeniz rıza sayılmaz. Bilgilendirme, alt bilgideki bu Politika bağlantısıyla yapılır.

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
