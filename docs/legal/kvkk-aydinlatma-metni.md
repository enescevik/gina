# Gina Aile – KVKK Aydınlatma Metni (Ebeveyn ve Çocuk Profili Verileri)

| | |
|---|---|
| Sürüm | 0.2 (taslak) |
| Tarih | 2026-10-30 |
| Yürürlük tarihi | [YÜRÜRLÜK TARİHİ] |
| Durum | **Taslak. Hukuk uzmanı incelemesi ve onayı yapılmadı (6 Kasım 2026); uzman onayı ve yazılı onay kaydı olmadan yayımlanmaz.** 0.2'de anılan "inceleme notları" uzman onayı yerine geçmez. |
| Yayın yeri | [WEB ADRESİ]/legal/kvkk-aydinlatma-metni (herkese açık HTML, TR/EN) · uygulama içi Ayarlar > Gizlilik ve Yasal (bu ekran uygulamada henüz yoktur) |
| Dil | Türkçe metin esastır; İngilizce çeviri yalnızca bilgi amaçlıdır ve sayfanın sonundadır. / The Turkish text prevails; an English version is at the end of this page. |

> **Uygulama denetimi (6 Kasım 2026, C11/S05):** Yapay zekâ özellikleri, gönderilen veriler, işlem bazlı onay ve yüklenen belgelerin saklanması için güncel ve esas anlatım Gizlilik Politikası Bölüm 5'tedir; bu metindeki ilgili bölümler ona göre kısaltıldı. Henüz uygulanmayanlar: "Ayarlar > Gizlilik ve Yasal", "Rızalarım", "Ayarlar > Yapay Zekâ Özeti" ve uygulama içi KVKK başvuru formu; kayıt ve çocuk ekleme ekranlarında bu metnin bağlantısı ve "okudum" kaydı; girişsiz web silme, planlı silme ve silme e-postaları; 18 yaş otomatik pasifleştirme; hesap silindikten sonra satın alma ve onay kayıtlarının saklanması (şu an aileyle birlikte silinir); Apple ile Giriş belirteç iptali. Karşılaştırma: `docs/release/c11-2026-11-06/legal-review.md`.

Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun ("KVKK") 10. maddesi ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca hazırlanmıştır. Gina Aile uygulamasını ("Gina") kullanan ebeveyn ve vasilere, hem kendi verileri hem de çocukları adına girdikleri veriler hakkında bilgi verir.

Bu metin onayınıza sunulmaz: kayıt ve çocuk ekleme ekranlarında bağlantı olarak gösterilir ve metni gördüğünüz ("okudum") bilgisi kaydedilir. Açık rıza veya özellik izni gerektiren işlemler için metinler bu metinden ayrı, önceden işaretlenmemiş kutucuklarla sunulur; bu metni okumanız rıza anlamına gelmez.

## Kısa özet (ilk katman)

- Veri sorumlusu: [VERİ SORUMLUSU UNVANI]. İletişim: [E-POSTA].
- Gina'da hesabı yalnızca 18 yaşını doldurmuş ebeveyn/vasi açar. Çocuk profillerini siz oluşturursunuz; çocuk için yalnızca ad/takma ad ve doğum yılı isteriz. Çocuğunuz e-posta, telefon veya şifre vermez.
- Verileriniz Almanya'daki (Frankfurt) sunucularda saklanır. Bildirim iletimi (doğrudan Apple APNs ve Google FCM), web barındırma (Cloudflare) ve yalnızca ücretli paketlerde, her işlemde onay verirseniz, yapay zekâ özellikleri (Anthropic) için ABD'deki sağlayıcılara aktarım yapılır.
- Yapay zekâ özellikleri ücretsiz pakette yoktur, yalnızca ebeveyn alanında başlatılır ve her işlemden önce ayrı onay ister. Çocuk yapay zekâ ile doğrudan etkileşmez; ancak sizin onayınızla çocuğun Prova cevabı ve çözüm defteri değerlendirme için gönderilebilir ve sizin incelediğiniz yapay zekâ üretimi sorular çocuğa atanabilir (Gizlilik Politikası Bölüm 5).
- Reklam, üçüncü taraf analitik veya takip aracı kullanmıyoruz; verilerinizi satmıyoruz.
- Hesabınızı ve çocuk profillerini uygulama içinden her an silebilirsiniz. Haklarınız için bkz. Bölüm 10.

## 1. Veri sorumlusu

| | |
|---|---|
| Unvan / ad soyad | [VERİ SORUMLUSU UNVANI] |
| Adres | [ADRES] |
| E-posta | [E-POSTA] |
| KEP adresi | [KEP ADRESİ – varsa] |
| MERSİS / VKN (veya TCKN) | [MERSİS/VKN] |
| Web | [WEB ADRESİ] |

Telefon veya SMS kanalımız yoktur; tüm iletişim e-posta, posta/KEP ve uygulama içi formlarla yapılır.

## 2. Bu metin kimleri kapsar?

- **Ebeveyn / vasi hesap sahipleri:** Gina'ya kayıt olan, 18 yaşını doldurmuş kanuni temsilciler. Gina mağazalarda 18 yaşını doldurmuş ebeveynlere yönelik bir uygulama olarak sunulur; çocuk modu yalnızca ebeveyn gözetiminde kullanılmak için tasarlanmıştır.
- **Davetle katılan aile üyeleri:** Hesap sahibinin (aile yöneticisinin) davet koduyla aileye eklediği, 18 yaşını doldurmuş diğer ebeveyn/vasi. Bu sürümde aileye yalnızca çocuğun diğer ebeveyni veya vasisi davet edilebilir. Davet kodu yalnızca aileye katılım içindir; cihaz eşleştirme kodu ayrıdır ve davet kodu hiçbir ücretli özellik açmaz. Katılan kişi ailenin çocuk profillerini ve kayıtlarını görür ve düzenler; kendi hesabı için bu metni okur ve çocuk profilleri üzerinde işlem yapmadan önce Veli Beyanı'nı kendisi onaylar. Davet kodunu yalnızca çocuğun diğer velisi/vasisi ile paylaşın.
- **Çocuk profilleri:** Ebeveynin oluşturduğu, 18 yaşından küçük çocuklara ait profiller. Çocuk Gina'ya kendi başına kaydolamaz; verilerini ebeveyn girer; çocuk, çocuk modunda görev işaretler, hedef ve oda tercihleri seçer ve atanan Prova denemelerini çözer. Çocuğa ait verileri çocuğun kendisinden değil, kanuni temsilcisi olarak sizden alırız; çocuk, haklarını kanuni temsilcisi aracılığıyla kullanan ilgili kişi olduğundan KVKK m.10 ve Aydınlatma Tebliği m.6 kapsamındaki aydınlatmayı çocuk adına size yaparız (TMK m.342). Çocuğu ise yaşına uygun dille yazılmış Çocuk Modu Bilgilendirmesi ile bilgilendiririz (Bölüm 11). [AVUKAT: kanuni temsilciye yapılan aydınlatmanın çocuk bakımından yeterliliği]
- **Destek talebinde bulunanlar** ve **web sitesi ziyaretçileri** (web için ayrıca Çerez Politikası geçerlidir).

## 3. İşlediğimiz kişisel veriler

### 3.1 Ebeveyn ve aile üyeleri

| Kategori | Veriler |
|---|---|
| Kimlik ve iletişim | Ad (girdiyseniz soyad), e-posta adresi; Apple/Google ile girişte sağlayıcının ilettiği ad ve e-posta (Apple'da gizlenmiş aktarma e-postası olabilir). Telefon numarası istenmez. |
| Hesap ve kimlik doğrulama | Kullanıcı kimliği, şifre özeti (şifrenizi göremeyiz), oturum ve giriş kayıtları, 4 haneli ebeveyn PIN'inin özeti (PIN'inizi göremeyiz), dil/bölge ve aile saat dilimi, aile, davet kodu ve üyelik kayıtları |
| Cihaz ve bildirim | Push bildirim token'ı, cihaz modeli, işletim sistemi ve uygulama sürümü, IP adresi ve sunucu günlükleri, bildirim tercihleri |
| Satın alma ve abonelik | Paket (Gina Başlangıç, Gina Plus veya Gina Pro), abonelik durumu, deneme ve yenileme tarihleri, Apple/Google işlem ve abonelik kimlikleri, mağaza ülkesi ve para birimi, kupon/teklif kodu kullanımı. Kart ve ödeme bilgileriniz Apple/Google'da kalır, bize ulaşmaz. |
| Rıza, özellik izni ve beyan kayıtları | Kabul edilen metin sürümü ve özeti, tarih, dil, kullanıcı kimliği, kaynak ekran, IP adresinin tuzlu özeti ve uygulama örneği kimliği (reklam kimliği değil) [AVUKAT: ispat için ip_hash/device_id tutulmasının gerekliliği] |
| Yapay zekâ özellikleri (ücretli paket, her işlemde onayınızla) | İşlem onayı kaydı, Anthropic'e gönderilen girdiler (özellik bazında Gizlilik Politikası Bölüm 5) ve üretilen çıktılar; adınız, e-postanız ve cihaz kimlikleriniz gönderilmez |
| Yüklenen belge ve görseller (Gina Plus/Pro, isteğe bağlı) | Seçtiğiniz görseller ve PDF'ler, dosya adı, boyutu ve özeti; saklama onayı ve ayrı yapay zekâ onayı kaydı |
| Öğretmenle paylaşım | Oluşturduğunuz bağlantının etiketi, kapsamı, süresi, görüntülenme sayısı ve zamanı (bağlantı belirtecinin yalnızca özeti) |
| Destek | Bize yazdığınız mesajlar ve ekleri |

**Toplamadıklarımız:** telefon numarası, konum (konum izni istemeyiz; IP adresi yalnızca güvenlik günlüklerinde tutulur; oda hava durumu için seçilen şehir konum değildir), kişi listesi, kamera ve fotoğraf (belge yükleme özelliklerinde sizin çekip seçtiğiniz dosyalar hariç, Bölüm 8), mikrofon, T.C. kimlik numarası, kart veya banka bilgileri, reklam kimlikleri (IDFA/AAID), tarama ve arama geçmişi.

### 3.2 Çocuk profilleri

| Kategori | Veriler |
|---|---|
| Kimlik | Ad veya takma ad, doğum yılı (doğum tarihi istenmez), seçilen hazır avatar; isteğe bağlı cinsiyet ve en fazla 6 hazır ilgi alanı. Soyad, T.C. kimlik numarası, fotoğraf, telefon, e-posta ve konum istenmez. |
| Eğitim dönemi | Öğretim yılı, sınıf ve isteğe bağlı okul adı |
| Çocuk modu girişi | İsteğe bağlı 4 haneli çocuk PIN'inin özeti (sunucuda, geri çevrilemez; PIN'i göremeyiz) |
| Prova (deneme) | Atanan denemeler, çocuğun cevap metni ve el yazısı/çizim içeren çözüm defteri, sonuçlar, ebeveynin ayrı katmandaki işaretleri ve onaylı geri bildirim |
| Çocuk modu tercihleri | Seçilen hedefler, oda/evcil hayvan tercihleri, oda hava durumu için seçilen şehir (GPS konumu değildir; şehir koordinatı hava durumu için sunucumuz üzerinden Norveç Meteoroloji Enstitüsü'ne (api.met.no) sorulur, kişisel veri gönderilmez) |
| Görev ve ödül | Görevler, tamamlama ve onay kayıtları, yıldız/puan ve ödül geçmişi |
| Takvim | Etkinlikler, tatiller, ders programı |
| Notlar ve okul | Ebeveynin yazdığı notlar, sınıf/ders düzeyi, not/puan kayıtları |
| Gelişim takibi | Ebeveynin yazdığı kilometre taşı ve gözlem notları (sağlık verisi içermez; boy-kilo dâhil) |
| Eşleştirilmiş cihaz | Eşleştirilen tabletin cihaz kimliği, 8 karakterli eşleştirme kodunun ve tek kullanımlık onay jetonunun kaydı, cihazı eşleyen ebeveyn, ebeveynin kod denemelerinin zamanı ve sonucu (deneme sınırı ve kötüye kullanımın önlenmesi için), anonim çocuk oturumu, eşleştirme iptal kaydı (tabletin "Bu benim ailem değil" ile iptali dâhil) ve çocuk modunda yapılan işlem kayıtları (görev işaretleme zamanı) |

### 3.3 Özel nitelikli veri işlemiyoruz

Gina'nın bu sürümü sağlık, din, etnik köken, biyometrik veri gibi özel nitelikli kişisel verileri (KVKK m.6) toplamaz. Gelişim takibi; boy-kilo, hastalık, alerji, ilaç gibi alanlar içermez. **Lütfen not, görev ve açıklama gibi serbest metin alanlarına çocuğunuz veya kendiniz hakkında sağlık bilgisi ya da başka özel nitelikli veri yazmayın.** Yine de yazılırsa bu bilgi yalnızca sizin kayıtlarınızda saklanır, yapay zekâya gönderilmez ve sizin tarafınızdan her zaman silinebilir.

## 4. Verileri nasıl topluyoruz?

- **Sizin girdiğiniz bilgiler:** Kayıt, aile kurma, çocuk ekleme, görev/takvim/not/gelişim girişleri ve destek mesajları (uygulama ve web formları).
- **Çocuğunuz adına girdiğiniz bilgiler:** Çocuk profilindeki tüm veriler, Veli Beyanı onaylanarak ebeveyn tarafından girilir; çocuktan doğrudan veri alınmaz. Çocuğun çocuk modunda yaptığı işlemler (görev işaretleme, hedef seçimi, oda/evcil hayvan tercihleri ve atanan Prova denemelerinin cevapları ile çözüm defteri) eşleştirilmiş cihazdan veya telefonunuzdaki çocuk modundan kaydedilir.
- **Apple/Google ile giriş:** Seçtiğiniz sağlayıcı bize ad ve e-posta bilgisini iletir (Apple'da e-postanızı gizleyebilirsiniz).
- **Otomatik olarak cihazdan ve sunuculardan:** Push token'ı, cihaz ve sürüm bilgileri, IP adresi, zaman damgası ve istek günlükleri; mağaza bildirimleri yoluyla abonelik durumu.

Veriler elektronik ortamda, kısmen otomatik yollarla işlenir.

## 5. İşleme amaçları ve hukuki sebepler

| Amaç | Hukuki sebep (KVKK) |
|---|---|
| Hesap açma, giriş, aile kurma ve davet; hizmetin sunulması | m.5/2-c – sözleşmenin kurulması ve ifası |
| Görev, yıldız, takvim, not ve gelişim takibi; çocuk modu ve eşleştirilmiş cihaz; çocuk profilinin yönetimi | m.5/2-c – ebeveynle kurulan sözleşmenin ifası; çocuk verisi için ayrıca Veli Beyanı ile belgelenen veli iradesi [AVUKAT: Kurul'un 2022/776 sayılı kararı karşısında velinin ayrı açık rızası gerekip gerekmediği] |
| İşlemsel bildirimler (onay bekleyen görev, abonelik yenileme ve deneme bitimi, ödeme sorunu, güvenlik uyarısı, yasal metin değişikliği) | m.5/2-c; m.5/2-f – meşru menfaat: hizmetin işlemesi için gerekli bilgileri (bekleyen onay, ödeme sorunu, yeni giriş gibi) size zamanında ulaştırmak. Bildirimler tanıtım içermez ve kişisel veri taşımaz; bildirim iznini cihazınızdan her an kapatabilirsiniz. |
| Yapay zekâ özellikleri (yalnızca ücretli paketler; her işlemde onayınızla): haftalık aile özeti, belgeden ders programı/öğrenme planı, soru üretimi, kurulum önerileri; Gina Pro'da ayrıca açık uçlu cevap değerlendirme önerisi ve çalışma planı (Gizlilik Politikası Bölüm 5) | Uzman incelemesi gerekir: bu satırdaki dayanak yalnız haftalık özet ve fotoğraftan takvim için yazılmıştı; çocuğun cevap/el yazısı aktarımı ve işlem bazlı onay için yeniden değerlendirilmelidir. m.5/2-c – seçtiğiniz ücretli paketin ifası. Özellik varsayılan olarak kapalıdır; yalnızca sizin ayrı "özellik izni"nizle çalışır ve izni geri aldığınızda kapanır. Verilerin Anthropic'e (ABD) aktarılmasının dayanağı Bölüm 7'dedir. |
| Abonelik yönetimi, satın alma doğrulama, kupon/teklif kodu, faturalama kayıtları | m.5/2-c; m.5/2-ç – vergi ve ticari mevzuattan doğan yükümlülükler |
| Güvenlik, kötüye kullanım ve dolandırıcılığın önlenmesi, hata ayıklama | m.5/2-f – meşru menfaat: hesapları, aile ve çocuk verilerini yetkisiz erişime, sahte hesaplara ve kötüye kullanıma karşı korumak ve hataları gidermek; m.5/2-ç – veri güvenliği yükümlülüğümüz (KVKK m.12) |
| Yasal yükümlülükler: KVKK başvuruları, yetkili kurum talepleri, veri ihlali bildirimi, kayıt saklama | m.5/2-ç; m.5/2-e – bir hakkın tesisi, kullanılması veya korunması |
| Rıza, özellik izni ve beyan kayıtlarının ispat amacıyla tutulması | m.5/2-ç – hukuki yükümlülük (ispat yükü bizdedir); m.5/2-e – bir hakkın tesisi, kullanılması veya korunması |
| Destek taleplerinin yanıtlanması | m.5/2-c; m.5/2-f – meşru menfaat: sorununuzu çözmek ve aynı sorunun tekrarını önlemek için yazışma geçmişini sınırlı süre tutmak |
| Kimliğinizle ilişkilendirilemeyen toplu istatistikler üretmek (ör. aktif aile sayısı, paket dağılımı) | m.5/2-f – meşru menfaat: hizmeti iyileştirmek ve kapasite planlamak. Veriler bu amaçla anonim hâle getirilir; anonim veri kişisel veri değildir (m.28/1-b) ve kimse hakkında profil çıkarmak için kullanılmaz. |
| Tanıtım ve pazarlama iletileri (bu sürümde yok) | m.5/1 – açık rıza (ayrı onay, İYS kaydı; yalnızca e-posta ve uygulama bildirimi, SMS yok) |
| Öğretmenle salt okunur paylaşım bağlantısı (bu sürümde çalışır; isteğe bağlı) | Uzman incelemesi gerekir (önceki taslak bunu "ileride, m.5/1 açık rıza" diye yazmıştı; özellik artık uygulamada var ve ayrı bir rıza kutusu yoktur) |
| İleride eklenecek isteğe bağlı özellikler (ör. grup denemeleri, kütüphane katkısı — kodda var, özellik bayrağı kapalı) | m.5/1 – açık rıza; devreye alınmadan önce bu metin güncellenir |

Verileriniz profilleme, reklam veya çocuğunuz hakkında otomatik karar verme amacıyla kullanılmaz. Bu sürümde çökme raporlama veya analitik aracı da kullanmıyoruz; eklenirse bu metin güncellenir.

## 6. Verileri kimlere ve hangi amaçla aktarıyoruz?

Verilerinizi satmayız. Aşağıdaki alıcılar dışında üçüncü kişilerle paylaşmayız; sağlayıcılar yalnızca belirtilen amaç için ve bizim talimatımızla işler.

| Alıcı | Yer | Amaç ve aktarılan veriler |
|---|---|---|
| Supabase Pte. Ltd. (alt işleyeni: Amazon Web Services) | Veriler ve yedekler AB – Frankfurt (eu-central-1) bölgesinde; şirket merkezi Singapur, destek ve operasyon amaçlı sınırlı erişim Frankfurt dışından yapılabilir [AVUKAT/ÜRÜN: Supabase veri işleme sözleşmesindeki destek erişimi hükmünün teyidi] | Veritabanı, kimlik doğrulama, dosya depolama ve sunucu fonksiyonları (barındırma). Tüm hesap ve çocuk profili verileri. |
| Anthropic, PBC | ABD | Yapay zekâ özelliklerinin üretilmesi. Yalnızca ücretli paketlerde ve her işlemdeki onayınızla, o işlemin girdileri (Bölüm 8; seçtiğiniz belgeler ve Gina Pro'da çocuğun Prova cevabı/çözüm defteri dâhil). |
| Öğretmen paylaşım bağlantısını gönderdiğiniz kişi | – | Hesap açmadan, bağlantıda seçtiğiniz kapsamı (çocuğun ilk adı ve sınıfı; puanlar, Prova sonuçları ve/veya görev özeti) salt okunur görür; bağlantı süreli ve iptal edilebilir. |
| Cloudflare, Inc. | ABD / küresel ağ | Web uygulamasının ve yasal sayfaların barındırılması, ağ güvenliği. Web kullanımında IP adresi, tarayıcı bilgisi ve istek günlükleri (kısa süreli). |
| Apple Inc. (ABD) ve Apple Distribution International Ltd. (İrlanda) | ABD / İrlanda | App Store, uygulama içi satın alma ve abonelik doğrulama, Apple ile Giriş, iOS bildirim iletimi (APNs). Satın alma işlem bilgileri, Apple ile giriş kimliği ve e-posta (gizlediyseniz Apple'ın aktarma adresi), push token'ı. Kendi hizmetleri için bağımsız veri sorumlusudur; Türkiye'de satıcı Apple Distribution International Ltd.'dir; ödeme bilgileriniz onlarda kalır. |
| Google LLC (ABD) ve Google Commerce Ltd. (İrlanda) | ABD / İrlanda | Google Play, Play faturalandırma ve abonelik doğrulama, Google ile Giriş, Android bildirim iletimi (FCM; uygulamada Firebase SDK'sı yoktur). Satın alma işlem bilgileri, Google ile giriş kimliği ve e-posta, push token'ı. Kendi hizmetleri için bağımsız veri sorumlusudur; Türkiye'de satıcı Google Commerce Ltd.'dir; ödeme bilgileriniz onlarda kalır. |
| [E-POSTA GÖNDERİM SAĞLAYICISI – varsa] | [ÜLKE] | Doğrulama, şifre sıfırlama ve işlemsel e-postaların iletilmesi; e-posta adresi ve e-posta içeriği. |
| Aile üyeleri | – | Davet koduyla aileye katılan, 18 yaşını doldurmuş diğer ebeveyn/vasi, ailenin çocuk profillerini ve kayıtlarını görür ve düzenler. |
| Yetkili kamu kurum ve kuruluşları | Türkiye | Mahkeme, savcılık, Kişisel Verileri Koruma Kurumu gibi kurumların hukuka uygun talepleri; yalnızca talep kapsamındaki veriler. |

Sağlayıcılar kendi alt işleyenlerini kullanabilir (Supabase için Amazon Web Services; Anthropic için bulut altyapısı sağlayıcıları); bu sonraki aktarımlar Bölüm 7'de açıklanır. Güncel alt işleyen listesini Gizlilik Politikamızda ([WEB ADRESİ]/legal/gizlilik-politikasi) tutarız; yeni bir alıcı eklenmeden önce bu metin güncellenir.

## 7. Yurt dışına aktarım

Bazı alıcılar Türkiye dışındadır; KVKK'ya göre Almanya dâhil Türkiye dışına her aktarım "yurt dışına aktarım"dır. Kişisel Verileri Koruma Kurulu, bu metnin tarihi itibarıyla hiçbir ülke için "yeterlilik kararı" vermemiştir. Bu nedenle aktarımları KVKK m.9/4-c'deki uygun güvenceyle, yani Kurul'un ilan ettiği **"Veri Sorumlusundan Veri İşleyene" standart sözleşmesini** her sağlayıcıyla imzalayarak yaparız; imzalanan her standart sözleşme beş iş günü içinde Kuruma bildirilir (m.9/5). Sağlayıcıların kendi alt işleyenlerine yaptığı sonraki aktarımlar için de aynı güvenceler aranır (m.9/8).

| Alıcı | Ülke | Mekanizma ve durum |
|---|---|---|
| Supabase Pte. Ltd. | Almanya (barındırma) / Singapur (sözleşme tarafı) | Standart sözleşme (m.9/4-c): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Supabase] |
| Amazon Web Services (Supabase'in alt işleyeni) | Almanya (Frankfurt veri merkezi) | Sonraki aktarım (m.9/8): Supabase ile imzalanan standart sözleşmede alt işleyen kullanımı ve aynı güvencelerin AWS'ye yansıtılması şartı; Supabase–AWS veri işleme sözleşmesi [SUPABASE–AWS ALT İŞLEYEN GÜVENCESİ – belge ve tarih] |
| Anthropic, PBC | ABD | Standart sözleşme (m.9/4-c): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Anthropic]. Standart sözleşme sağlanana kadar: aşağıdaki geçici yol. |
| 650 Industries, Inc. (Expo) | ABD | Kullanılmıyor (6 Kasım 2026): push bildirimleri doğrudan APNs/FCM ile gönderilir; uygulama yapılandırmasında EAS Update adresi yoktur. EAS Update veya Expo push devreye alınırsa satır standart sözleşme bilgisiyle geri eklenir. |
| Cloudflare, Inc. | ABD | Standart sözleşme (m.9/4-c): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Cloudflare] |

**Hizmetin kendisini oluşturan alıcılar (Supabase, Cloudflare; bildirim iletiminde Google FCM — rolü için uzman incelemesi gerekir):** Bu alıcılar için uygun güvence sağlanamazsa aktarım yapmayız; ilgili sağlayıcıyı uygun güvence veren bir sağlayıcıyla değiştirir veya Kurul'un kabul ettiği başka bir uygun güvenceyi (m.9/4) sağlarız. Bu alıcılar için açık rıza yoluna başvurmayız; çünkü hizmet onlarsız sunulamaz ve rıza hizmetin ön şartı yapılamaz. [AVUKAT: standart sözleşmeyi imzalamayan sağlayıcı için izlenecek yolun teyidi]

**Yalnızca Anthropic için geçici yol:** Anthropic ile standart sözleşme sağlanana kadar yapay zekâ özellikleri, yalnızca Kanun'un izin verdiği ölçüde (m.9/6-a), aşağıdaki muhtemel riskler hakkında bilgilendirilerek ve Açık Rıza Metni A ile ayrı olarak vereceğiniz açık rızanızla sunulur; rızanızı geri aldığınızda özellik kapanır ve yeni aktarım yapılmaz. Bu yol geçicidir: standart sözleşme imzalandığında kutucuk yalnızca "özellik izni" olarak kalır ve bu metin güncellenir. Rıza vermemeniz Gina'yı ve ücretli paketin diğer özelliklerini kullanmanızı engellemez. [AVUKAT: düzenli SaaS aktarımının m.9/6'daki "arızi" şartı karşısında bu geçici yolun savunulabilirliği]

Apple ve Google ile satın alma doğrulama, giriş ve bildirim iletimi için yapılan veri alışverişi, bu şirketlerin kendi hizmetlerini bağımsız veri sorumlusu olarak sunmasının parçasıdır. [AVUKAT: Apple/Google'a yapılan doğrulama ve giriş isteklerinin yurt dışına aktarım niteliği ve dayanağı]

**Muhtemel riskler:** Verinin gittiği ülkede KVKK ile eşdeğer bir koruma bulunmayabilir; o ülkenin kamu makamları kendi mevzuatına göre verilere erişebilir; haklarınızı yurt dışındaki alıcıya karşı kullanmanız Türkiye'dekinden zor olabilir (haklarınızı bize karşı kullanmaya devam edersiniz; talebinizi alıcıya biz iletiriz); alıcının kendi alt işleyenleri aynı riskleri taşır. Riskleri azaltmak için verileri iletimde şifreler, yapay zekâ girdilerini takma adlandırır ve en aza indirir, bildirim içeriklerine kişisel veri koymaz ve sağlayıcılarla veri işleme sözleşmeleri yaparız. Sağlayıcılarımızın sözleşmelerindeki AB Standart Sözleşme Hükümleri, KVKK m.9 anlamında güvence sayılmaz; yalnızca ek sözleşmesel tedbirdir.

## 8. Yapay zekâ özellikleri

- **Hangi paketlerde ve hangi özellikler:** Gina Başlangıç (ücretsiz) pakette yapay zekâ özelliği yoktur. Gina Plus ve Gina Pro'da haftalık aile özeti, belgeden ders programı ve öğrenme planı taslağı, soru üretimi ve kurulum önerileri; yalnız Gina Pro'da ayrıca açık uçlu cevap değerlendirme önerisi ve çalışma planı vardır. Aylık sınırlar ve ayrıntı Gizlilik Politikası Bölüm 5'tedir. Paketlerin çocuk sayısı sınırı 2 / 4 / 8'dir.
- **Onay her işlemde ayrı alınır.** Tek bir genel izin anahtarı yoktur; her işlemden önce neyin Anthropic'e (ABD) gönderileceği gösterilir ve ayrı, önceden işaretlenmemiş bir onay istenir. Onay vermezseniz o işlem yapılmaz; gönderilmiş bir işlem geri çağrılamaz. Ailedeki diğer ebeveynlere ayrıca bildirim gönderilmez. Uzman incelemesi gerekir: işlem bazlı onayın aktarım dayanağıyla (Bölüm 7) uyumu.
- **Çocuğunuz yapay zekâ ile doğrudan etkileşmez:** çocuk modunda sohbet yoktur ve çocuk cihazı yapay zekâ isteği başlatamaz. Ancak sizin incelediğiniz yapay zekâ üretimi sorular çocuğa atanabilir; Gina Pro'da sizin her inceleme için ayrı onayınızla çocuğun Prova cevabı ve çözüm defteri değerlendirme önerisi için gönderilir; değerlendirme çocuğa yalnızca sizin onayınızla gösterilir.
- **Gönderilen veriler özelliğe göre değişir ve en aza indirilir:** haftalık özette yalnızca "Çocuk A" gibi bir etiket, sınıf, görev durum sayımları ve yıldızlar ile ailenin dil/saat dilimi; kurulum önerilerinde sınıf, yaş aralığı ve ilgi alanları; soru üretimi ve çalışma planında ders/sınıf/konu bilgisi gönderilir. Belge kullanan işlemlerde seçtiğiniz görseller/PDF'ler, değerlendirme önerisinde çocuğun cevap metni ve çözüm defteri görüntüsü olduğu gibi gönderilir. Adınız, e-postanız ve cihaz kimlikleri gönderilmez.
- **Belgeler ve görseller otomatik maskelenmez.** Çocuğunuzun veya başka kişilerin yüzünün, adının veya iletişim bilgisinin göründüğü dosyaları yüklemeyin ya da önce kırpın. Yüklenen dosyaların Gina'da saklanması için ayrı bir saklama onayı istenir; saklama kuralı Gizlilik Politikası Bölüm 5'tedir (kayda bağlı kaldıkça; bağlanmayan dosya 24 saat, içe aktarmada kullanılan 7 gün sonra silinir).
- **Anthropic'te saklama:** Anthropic, Ticari Hizmet Şartları gereği verilerinizi kendi modellerini eğitmek için kullanmaz (uzman incelemesi gerekir: Anthropic sözleşmesi ve güncel şartlarla teyit). Uygulamada başka sağlayıcılar için yapılandırılmamış bağlantı iskeletleri vardır; kullanılmazlar ve devreye alınmadan önce bu metin güncellenir. Girdi ve çıktılar Anthropic sistemlerinde **kural olarak 30 gün içinde silinir;** kullanım politikası ihlali şüphesiyle işaretlenen içerik ise Anthropic tarafından güvenlik incelemesi için **2 yıla kadar** tutulabilir ve insan tarafından görülebilir. Kullandığımız model sınıfları için Anthropic 30 günlük saklamayı zorunlu tutar ve "sıfır veri saklama" seçeneği sunmaz; bu süre içinde silinmesini sağlayamayız. Anthropic kendi bulut alt işleyenlerini kullanabilir; bu sonraki aktarımlar için de aynı güvenceler aranır (Bölüm 7). Kullanılan model paket bazında belirlenir [MODEL/SAKLAMA DURUMU: paket başına model ve saklama rejimi]; saklama süresini etkileyen bir değişiklik olursa bu metin güncellenir.
- Çıktılar **öneri niteliğindedir;** hatalı veya eksik olabilir ve her çıktıda bunu hatırlatan bir uyarı gösterilir. Tıbbi, psikolojik, eğitimsel ya da hukuki bir değerlendirme değildir, çocuğunuz hakkında etiketleme veya teşhis içermez ve sizin kararınızın yerine geçmez. Çıktılar hakkınızda hukuki sonuç doğuran otomatik bir karar üretmez; yine de KVKK m.11/g kapsamında itiraz edebilirsiniz.
- Haftalık özetler Gina'da **12 ay** saklanır ve sonra otomatik silinir. Belgeden oluşturulan takvim, plan ve soru kayıtları ile değerlendirme önerileri siz silene veya hesap silinene kadar saklanır.

## 9. Saklama süreleri ve silme

Verilerinizi amaç için gerekli süre boyunca ve aşağıdaki tabloya göre saklarız. Süre dolduğunda veya talebiniz üzerine veriler silinir, yok edilir veya anonim hâle getirilir; periyodik imha en geç altı ayda bir otomatik olarak yapılır. Süreler Gizlilik Politikası, Hesap ve Veri Silme sayfası ve mağaza beyanlarımızla aynıdır.

| Veri | Saklama süresi |
|---|---|
| Hesap, aile ve profil bilgileri | Hesap silinene kadar; silme sonrası yedeklerden en geç [30 gün] içinde temizlenir |
| Çocuk profili verileri (görev, yıldız, takvim, not, gelişim, çocuk PIN özeti) | Profil veya hesap silinene kadar; profil silindiğinde tümü silinir |
| 18 yaşını dolduran çocuğun profili | Yalnızca doğum yılını tuttuğumuz için 18. yaş gününü bilemeyiz. Profil, doğum yılına 18 eklenerek bulunan yılın 31 Aralık tarihinde (bu tarihte çocuğun 18 yaşını doldurduğu kesindir) kendiliğinden pasife alınır [ÜRÜN KARARI: geçiş kuralı, Veli Beyanı §11 ile aynı]; pasife almadan [ÖN BİLDİRİM SÜRESİ, örn. 60 gün] önce ve pasife alındığında uygulama içi bildirim ve e-posta alırsınız. Pasif profil salt okunur olur; çocuk modu ve eşleştirilmiş cihazlar kapanır, bu profil için yeni yapay zekâ çıktısı üretilmez. Profil, pasife alınmasından itibaren [SİLME SÜRESİ, örn. 90 gün] içinde silinir. Reşit olan çocuk, kendi talebiyle verilerinin silinmesini veya bir kopyasını [E-POSTA] üzerinden isteyebilir; kimliğini doğrularız. [AVUKAT: 18 yaşında profilin devri, ebeveyn erişiminin kesilme anı ve kimlik doğrulama yöntemi] |
| Yapay zekâ girdileri ve çıktıları | Çıktılar Gina'da 12 ay veya daha önce silmenizle; Anthropic'te kural olarak 30 gün (ihlal şüphesiyle işaretlenen içerik 2 yıla kadar) |
| Push token'ları | Cihazdan çıkış, uygulamanın kaldırılması veya token'ın geçersiz olmasıyla; geçersiz token'lar [90 gün] içinde temizlenir; hesap silmeyle birlikte |
| Eşleştirilmiş cihaz ve anonim çocuk oturumu | Eşleştirme iptal edilene kadar (iptal anında etkilidir; cihaz bir sonraki istekte erişimi kaybeder) veya [90 gün] kullanılmayana kadar; profil veya hesap silmeyle birlikte |
| Güvenlik ve erişim günlükleri (IP, zaman damgası) | [12 ay] [AVUKAT: 5651 sayılı Kanun trafik verisi yükümlülüğü] |
| Satın alma ve abonelik doğrulama kayıtları | Yasal saklama süresi boyunca [10 yıl] (vergi ve ticari mevzuat); hesap silindikten sonra da erişimi kısıtlı tutulur |
| Rıza, özellik izni ve beyan kayıtları | Rızanın sona ermesinden veya hesabın silinmesinden itibaren [3 yıl] (ispat amacıyla); hesap silindiğinde kayıttaki kullanıcı kimliği takma kimliğe çevrilir, kayıt çocuğun adını içermez [AVUKAT: zamanaşımı] |
| Apple ile Giriş belirtecinin iptal edildiğine ilişkin kayıt | Hesap silindikten sonra [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] (Apple'ın iptal şartının yerine getirildiğinin ispatı) [AVUKAT] |
| Destek yazışmaları, KVKK başvuru ve veri ihlali kayıtları | Talebin kapanmasından itibaren [3 yıl] |
| Hesap silme bildirimi için e-posta adresiniz | Silme tamamlanana kadar; ardından silinir |

Hesabınızı **Ayarlar > Hesap > Hesabı Sil** yolundan, tek bir çocuk profilini **Ayarlar > Çocuklar > [Çocuk] > Profili Sil** yolundan silebilirsiniz; giriş yapamıyorsanız [WEB ADRESİ]/legal/hesap-ve-veri-silme sayfasından kayıtlı e-posta adresinizi doğrulayarak talep edebilirsiniz. Silme; aileyi, ebeveyn hesabını, çocuk profillerini, görev ve yıldız geçmişini, takvimi, notları, puanları, yapay zekâ çıktılarını, push token'larını, eşleştirilmiş cihazları ve Apple/Google giriş bağlantılarını (Apple ile Giriş belirteçlerinin iptali dâhil) kapsar. Silme talebinizi aldığımızda ve tamamladığımızda sizi e-posta ile bilgilendiririz; bu amaçla e-posta adresiniz silme tamamlanana kadar tutulur. Dilerseniz silmeyi geçerli abonelik döneminin sonuna planlayabilirsiniz; hemen silme seçeneği her zaman vardır. Hesap silme, mağaza aboneliğinizi iptal etmez; silme ekranında etkin abonelik uyarısı ve mağazanın iptal bağlantısı gösterilir, aboneliği App Store veya Google Play üzerinden ayrıca iptal etmeniz gerekir.

## 10. Haklarınız ve başvuru usulü

KVKK m.11 uyarınca: (a) verilerinizin işlenip işlenmediğini öğrenme, (b) işlenmişse bilgi talep etme, (c) işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, (ç) yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, (d) eksik veya yanlış işlenmişse düzeltilmesini isteme, (e) KVKK m.7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme, (f) düzeltme, silme ve yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme, (g) münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme, (ğ) kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.

Başvurunuzu, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak şu kanallardan yapabilirsiniz:

- Uygulama içi form: Ayarlar > Gizlilik ve Yasal > KVKK Başvurusu (henüz yok; şu an uygulama içinden Yardım > destek talebi), veya web formu: [WEB ADRESİ]/legal/kvkk-basvuru-formu
- Hesabınızda kayıtlı e-posta adresinizden [E-POSTA] adresine e-posta
- Yazılı olarak [ADRES] adresine (kimlik tespiti ile) veya KEP: [KEP ADRESİ – varsa]

Telefon, SMS veya sosyal medya üzerinden başvuru almıyoruz. Başvurunuzda ad-soyad, hesabınıza kayıtlı e-posta, tebligat adresi ve talep konunuz bulunmalıdır; güvenlik için kimliğinizi doğrulayabiliriz. Başvurular en kısa sürede ve **en geç 30 gün içinde ücretsiz** sonuçlandırılır; yazılı cevaplarda on sayfayı aşan kısım için Tebliğ'deki ücret alınabilir. Başvurunuzun reddedilmesi, cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (KVKK m.14).

Yapay zekâ onayı işlem bazındadır; sonraki işlemlerde onay vermeyerek aktarımı durdurursunuz ("Ayarlar > Yapay Zekâ Özeti" anahtarı uygulamada yoktur). Pazarlama onayını (ileride sunulursa) iletideki bağlantıdan veya Ayarlar > Bildirimler'den, bildirim iznini cihaz ayarlarından her zaman geri alabilirsiniz. Geri alma, önceki işlemeleri etkilemez; ilgili özellik kapanır.

## 11. Çocuğunuz adına haklar

Çocuk profillerine ilişkin haklar, çocuğun velisi veya vasisi tarafından kullanılır; başvuranın aile hesabındaki ebeveyn/vasi olduğunu doğrularız (Bölüm 2'de açıklandığı gibi aydınlatma da çocuk adına size yapılır). Çocuk profilindeki verileri uygulama içinden kendiniz görüntüleyebilir, düzeltebilir ve silebilirsiniz. Ayırt etme gücüne sahip çocuğunuz, verileriyle ilgili taleplerini size iletebilir; biz bu talepleri çocuğun kanuni temsilcisi olarak sizin üzerinizden karşılarız [AVUKAT: belirli bir yaştan sonra çocuğa doğrudan başvuru hakkı tanınıp tanınmayacağı]. Aile hesabındaki diğer ebeveyn/vasi de aynı kayıtları görür ve düzenleyebilir; velayet veya vesayet durumunuzda değişiklik olursa (örneğin mahkeme kararı) bize bildirmenizi rica ederiz, gerekli erişim değişikliğini yaparız. Çocuğunuz 18 yaşını doldurduğunda temsil yetkiniz sona erer; profilin akıbeti Bölüm 9'da açıklanmıştır. Çocuğunuzun yaşına uygun bilgilendirilmesi için çocuk modunun ilk açılışında ve "Hakkında" bölümünde kısa bir **Çocuk Modu Bilgilendirmesi** yer alır; bunu çocuğunuzla birlikte okumanızı öneririz.

## 12. Çerezler ve benzeri teknolojiler

Mobil uygulama çerez kullanmaz; takip, analitik veya çökme raporlama SDK'sı içermez. Web uygulamasında yalnızca oturum ve dil tercihi için zorunlu çerez/yerel depolama kullanılır; bu nedenle çerez bandı gösterilmez. Ayrıntılar Çerez Politikamızdadır: [WEB ADRESİ]/legal/cerez-politikasi.

## 13. Güvenlik

Veriler iletimde ve sunucuda şifrelenir; her ailenin verisine yalnızca o ailenin üyeleri erişebilecek şekilde satır düzeyinde erişim kontrolü uygulanır ve bu kontrol her istekte sunucuda yapılır. Şifreler ve PIN'ler yalnızca özet (hash) olarak saklanır. Ebeveyn alanı 4 haneli ebeveyn PIN'i ile korunur; biyometrik doğrulama eklenirse biyometrik veriler cihazınızda kalır, bize iletilmez. Çocuk modu, PIN istenen durumlarda 4 haneli çocuk PIN'i ile açılır (ebeveyn bir cihaz için PIN'i kapatabilir; o zaman cihazı kullanan herkes o cihaz için seçilmiş çocuk profillerine girebilir; ebeveyn telefonunda PIN'i belirlenmemiş çocuk profiline dokunarak girer) ve ayarlara, satın almaya, yapay zekâ isteği başlatmaya, dış bağlantılara ve diğer çocukların verilerine erişemez. Eşleştirilmiş cihazın oturumu anonim ve sınırlı yetkilidir; eşleştirmeyi iptal ettiğinizde cihazın erişimi anında kesilir. Eşleştirme kodu tahmine karşı korunur (8 karakter, 5 dakikalık tek kullanımlık onay jetonu, 10 dakikada ebeveyn başına 10 / aile başına 20 başarısız denemede 15 dakika durdurma). Yönetici erişimi en az yetki ilkesiyle sınırlı, çok faktörlü doğrulamalı ve kayıt altındadır [YAYIN ÖNCESİ: yönetici hesaplarında çok faktörlü doğrulama ve erişim günlüğü açık olmalı]. Bir veri ihlalinde durumu en geç 72 saat içinde Kurula ve en kısa sürede size (e-posta, uygulama içi bildirim veya web duyurusu ile) bildiririz.

## 14. Değişiklikler, sürüm ve dil

Bu metni mevzuat, hizmet veya alıcılar değiştiğinde güncelleriz. Önemli değişiklikleri (yeni alıcı, yeni amaç, yurt dışı aktarım veya veri bölgesi değişikliği, Anthropic saklama rejiminde değişiklik, çocuk verilerini etkileyen değişiklikler) yürürlükten en az [15 gün] önce uygulama içi bildirim ve e-posta ile duyururuz; açık rıza gerektiren değişiklikler için rızanızı yeniden isteriz. Güncel metin her zaman [WEB ADRESİ]/legal/kvkk-aydinlatma-metni adresinde ve Ayarlar > Gizlilik ve Yasal altında yer alır; önceki sürümleri [E-POSTA] adresinden isteyebilirsiniz. Bu metnin Türkçe sürümü esastır; İngilizce çevirisi yalnızca bilgilendirme amaçlıdır.

İlgili belgeler: Gizlilik Politikası ([WEB ADRESİ]/legal/gizlilik-politikasi) · Açık Rıza Metinleri (uygulama içinde) · Veli Beyanı (uygulama içinde) · Çocuk Modu Bilgilendirmesi (çocuk modunda) · Kullanım Koşulları ([WEB ADRESİ]/legal/kullanim-kosullari) · Abonelik Koşulları ([WEB ADRESİ]/legal/abonelik-kosullari) · Çerez Politikası ([WEB ADRESİ]/legal/cerez-politikasi) · Hesap ve Veri Silme ([WEB ADRESİ]/legal/hesap-ve-veri-silme) · KVKK Başvuru Formu ([WEB ADRESİ]/legal/kvkk-basvuru-formu).

## Değişiklik geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.1 | 2026-10-29 | İlk taslak (avukat incelemesi öncesi) |
| 0.2 (C11 teknik düzeltme) | 2026-11-06 | Uygulamayla teknik karşılaştırma: Expo kaldırıldı (doğrudan APNs/FCM), yapay zekâ özellikleri ve işlem bazlı onay, çocuk verisi (cinsiyet, ilgi alanı, okul adı, Prova cevapları), yüklenen belgeler, öğretmen paylaşımı, isteğe bağlı çocuk PIN'i; uygulanmamış vaatler başlıkta listelendi. Hukuki dayanaklar değiştirilmedi, "uzman incelemesi gerekir" ile işaretlendi. Hukuk uzmanı onayı yoktur. |
| 0.2 (D16 teknik düzeltme) | 2026-11-06 | §3 eşleştirilmiş cihaz satırı: 8 karakterli kod, onay jetonu, cihazı eşleyen ebeveyn, kod denemesi kayıtları, tablet tarafı iptal; §13 ebeveyn telefonunda PIN'siz giriş ve eşleştirme kodunun tahmine karşı korunması. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d16-2026-11-06/README.md`. |
| 0.2 | 2026-10-30 | İnceleme notları ve DECISIONS.md uygulandı. §5: yapay zekâ dayanağı m.5/2-c + ayrı, varsayılan kapalı özellik izni (aktarım dayanağı §7); rıza/beyan kayıtları m.5/2-ç ve m.5/2-e; her m.5/2-f satırında somut meşru menfaat; toplu istatistik satırı. §8/§9: yapay zekâ çıktıları Gina'da 12 ay; Anthropic'te kural olarak 30 gün, ihlal şüphesinde 2 yıla kadar, kullanılan model sınıfı için 30 gün zorunlu/ZDR yok; paketler (Başlangıç/Plus/Pro, 2/4/8 çocuk) ve Pro özellikleri. §3: çocuk verisi yalnızca ad/takma ad + doğum yılı; 4 haneli çocuk ve ebeveyn PIN özetleri; telefon istenmez. §2/§6: DECISIONS gereği aileye yalnızca 18+ ebeveyn/vasi davet edilir (incelemedeki "yetkili yetişkinler" modeli uygulanmadı); davet kodu yalnızca aileye katılım; eşleştirme iptali anında. §6: Apple/Google ABD ve İrlanda tüzel kişileri; Expo EAS Update koşullu cümle; AWS alt işleyen. §7: m.9/4-c standart sözleşme + m.9/5 bildirim; AWS sonraki aktarımı (m.9/8); güvence sağlanamayan hizmet sağlayıcılarında aktarım yok, açık rıza yolu yalnızca Anthropic için ve geçici; AB SCC'ler güvence değil. §9: 18 yaş satırı (Veli Beyanı §11 kuralı), "Ayarlar > Çocuklar > [Çocuk] > Profili Sil", Apple belirteç iptal kaydı ve silme e-postası satırları, dönem sonuna planlı silme; destek kayıtları [3 yıl]. §2/§11: aydınlatmanın kanuni temsilciye yapılmasının açıklaması (Tebliğ m.6); §14: Çocuk Modu Bilgilendirmesi ve /legal/ slug'ları. |
| 0.2 (D18 İngilizce sürüm) | 2026-11-06 | Belgenin sonuna güncel Türkçe metinden (D16/D17 sonrası) çevrilen bilgi amaçlı İngilizce bölüm eklendi; Türkçe metnin içeriği değiştirilmedi. Hukuk uzmanı onayı yoktur. Ayrıntı: `docs/release/d18-2026-11-06/README.md`. |

---

# Gina Aile – KVKK Privacy Notice (Parent and Child Profile Data) (English)

| | |
|---|---|
| Version | 0.2 (draft) |
| Date | 30 October 2026 |
| Effective date | [YÜRÜRLÜK TARİHİ] |
| Status | **Draft. No legal expert has reviewed or approved it (6 November 2026); it is not published without expert approval and a written approval record.** The "review notes" mentioned in 0.2 do not replace expert approval. |
| Published at | [WEB ADRESİ]/legal/kvkk-aydinlatma-metni (public HTML, TR/EN) · in the app under Settings > Privacy and Legal (this screen does not exist in the app yet) |
| Language | The Turkish text prevails; this English translation is for information only. It was translated from the Turkish text on 6 November 2026 (D18) and has the same content. Placeholders and Turkish lawyer/product notes in square brackets are shared with the Turkish text; an English gloss follows in parentheses. |

> **App audit (6 November 2026, C11/S05):** The current and primary description of the AI features, the data sent, per-operation confirmation and the retention of uploaded documents is in Section 5 of the Privacy Policy; the related sections of this text have been shortened accordingly. Not yet implemented: "Settings > Privacy and Legal", "My Consents", "Settings > AI Summary" and the in-app KVKK request form; the link to this text and the "I have read" record on the sign-up and add-child screens; no-sign-in web deletion, scheduled deletion and deletion emails; automatic deactivation at 18; keeping purchase and consent records after account deletion (at present they are deleted together with the family); Sign in with Apple token revocation. Comparison: `docs/release/c11-2026-11-06/legal-review.md`.

This text has been prepared under Article 10 of Turkey's Personal Data Protection Law No. 6698 ("KVKK") and the Communiqué on the Procedures and Principles for Fulfilling the Obligation to Inform. It informs the parents and guardians who use the Gina Aile app ("Gina") about both their own data and the data they enter on behalf of their children.

This text is not submitted for your approval: it is shown as a link on the sign-up and add-child screens, and the fact that you have seen it ("I have read") is recorded. For processing that requires explicit consent or a feature permission, the texts are presented separately from this text with unticked boxes; reading this text does not mean consent.

## Short summary (first layer)

- Data controller: [VERİ SORUMLUSU UNVANI]. Contact: [E-POSTA].
- In Gina, only a parent/guardian aged 18 or over opens an account. You create the child profiles; for a child we ask only for a name/nickname and birth year. Your child does not give an email address, phone number or password.
- Your data is stored on servers in Germany (Frankfurt). Data is transferred to providers in the USA for notification delivery (directly Apple APNs and Google FCM), web hosting (Cloudflare) and, only on paid plans and if you consent for each operation, AI features (Anthropic).
- AI features are not available on the free plan, are started only in the parent area and ask for a separate confirmation before each operation. The child does not interact with AI directly; however, with your consent the child's Prova answer and workbook can be sent for assessment, and AI-generated questions you have reviewed can be assigned to the child (Privacy Policy Section 5).
- We do not use advertising, third-party analytics or tracking tools; we do not sell your data.
- You can delete your account and child profiles from within the app at any time. For your rights see Section 10.

## 1. Data controller

| | |
|---|---|
| Title / full name | [VERİ SORUMLUSU UNVANI] |
| Address | [ADRES] |
| Email | [E-POSTA] |
| KEP address (registered electronic mail) | [KEP ADRESİ – varsa] (if any) |
| MERSİS / tax ID (or Turkish ID number) | [MERSİS/VKN] |
| Web | [WEB ADRESİ] |

We have no telephone or SMS channel; all communication is by email, post/KEP and in-app forms.

## 2. Who does this text cover?

- **Parent / guardian account holders:** Legal representatives aged 18 or over who sign up to Gina. Gina is offered on the stores as an app for parents aged 18 or over; child mode is designed to be used only under parental supervision.
- **Family members who join by invitation:** The other parent/guardian, aged 18 or over, whom the account holder (family admin) adds to the family with the invite code. In this release only the child's other parent or guardian can be invited to the family. The invite code is only for joining the family; the device pairing code is separate and the invite code does not unlock any paid feature. The person who joins sees and edits the family's child profiles and records; they read this text for their own account and confirm the Parent Declaration themselves before acting on the child profiles. Share the invite code only with the child's other parent/guardian.
- **Child profiles:** Profiles of children under 18 created by the parent. A child cannot sign up to Gina on their own; the parent enters their data; in child mode the child ticks off chores, chooses goals and room preferences, and solves assigned Prova practice tests. We obtain the child's data not from the child but from you as their legal representative; because the child is a data subject who exercises their rights through their legal representative, we give the information required by KVKK Art. 10 and Art. 6 of the Information Communiqué to you on the child's behalf (Turkish Civil Code (TMK) Art. 342, legal representation of the child by the parents). We inform the child with the Child Mode Notice written in age-appropriate language (Section 11). [AVUKAT: kanuni temsilciye yapılan aydınlatmanın çocuk bakımından yeterliliği] (Lawyer note: whether informing the legal representative is sufficient with respect to the child.)
- **People who make support requests** and **website visitors** (for the web, the Cookie Policy also applies).

## 3. Personal data we process

### 3.1 Parents and family members

| Category | Data |
|---|---|
| Identity and contact | Name (surname if you entered it), email address; when signing in with Apple/Google, the name and email passed on by the provider (with Apple this may be a hidden relay email). No phone number is requested. |
| Account and authentication | User ID, password hash (we cannot see your password), session and sign-in records, hash of the 4-digit parent PIN (we cannot see your PIN), language/region and family time zone, family, invite code and membership records |
| Device and notifications | Push notification token, device model, operating system and app version, IP address and server logs, notification preferences |
| Purchases and subscriptions | Plan (Gina Başlangıç, Gina Plus or Gina Pro), subscription status, trial and renewal dates, Apple/Google transaction and subscription IDs, store country and currency, use of coupon/offer codes. Your card and payment details stay with Apple/Google and do not reach us. |
| Consent, feature permission and declaration records | Version and hash of the accepted text, date, language, user ID, source screen, salted hash of the IP address and app instance ID (not an advertising ID) [AVUKAT: ispat için ip_hash/device_id tutulmasının gerekliliği] (Lawyer note: whether keeping ip_hash/device_id is necessary for evidence.) |
| AI features (paid plan, with your confirmation for each operation) | Operation confirmation record, inputs sent to Anthropic (per feature, Privacy Policy Section 5) and the outputs produced; your name, email and device IDs are not sent |
| Uploaded documents and images (Gina Plus/Pro, optional) | The images and PDFs you choose, file name, size and hash; record of the storage consent and the separate AI confirmation |
| Sharing with a teacher | Label, scope, duration, view count and time of the link you create (only a hash of the link token) |
| Support | Messages you write to us and their attachments |

**What we do not collect:** phone number, location (we do not ask for location permission; the IP address is kept only in security logs; the city chosen for the room weather is not a location), contact list, camera and photos (except files you take and choose in the document upload features, Section 8), microphone, Turkish ID number, card or bank details, advertising IDs (IDFA/AAID), browsing and search history.

### 3.2 Child profiles

| Category | Data |
|---|---|
| Identity | Name or nickname, birth year (date of birth is not requested), chosen ready-made avatar; optionally gender and up to 6 ready-made interests. Surname, Turkish ID number, photo, phone, email and location are not requested. |
| Education term | School year, grade and optionally school name |
| Child mode entry | Hash of the optional 4-digit child PIN (on the server, irreversible; we cannot see the PIN) |
| Prova (practice tests) | Assigned tests, the child's answer text and workbook containing handwriting/drawing, results, the parent's marks on a separate layer and approved feedback |
| Child mode preferences | Chosen goals, room/pet preferences, the city chosen for the room weather (not a GPS location; the city coordinate is queried for the weather through our server from the Norwegian Meteorological Institute (api.met.no), and no personal data is sent) |
| Chores and rewards | Chores, completion and approval records, stars/points and reward history |
| Calendar | Events, holidays, class schedule |
| Notes and school | Notes written by the parent, grade/class level, grade/score records |
| Development tracking | Milestones and observation notes written by the parent (contains no health data, including height and weight) |
| Paired device | Device ID of the paired tablet, record of the 8-character pairing code and the single-use confirmation token, the parent who paired the device, time and result of the parent's code attempts (for the attempt limit and to prevent abuse), anonymous child session, pairing revocation record (including cancellation from the tablet with "This is not my family") and records of actions taken in child mode (time a chore was ticked off) |

### 3.3 We do not process special categories of data

This version of Gina does not collect special categories of personal data (KVKK Art. 6) such as health, religion, ethnic origin or biometric data. Development tracking contains no fields such as height and weight, illness, allergy or medication. **Please do not write health information or other special category data about your child or yourself in free-text fields such as notes, chores and descriptions.** If it is written anyway, this information is kept only in your records, is not sent to AI and can always be deleted by you.

## 4. How do we collect data?

- **Information you enter:** Sign-up, setting up a family, adding a child, chore/calendar/note/development entries and support messages (app and web forms).
- **Information you enter on your child's behalf:** All data in the child profile is entered by the parent after confirming the Parent Declaration; no data is taken directly from the child. The actions the child takes in child mode (ticking off chores, choosing goals, room/pet preferences, and the answers and workbook of assigned Prova tests) are recorded from the paired device or from child mode on your phone.
- **Sign in with Apple/Google:** The provider you choose passes your name and email to us (with Apple you can hide your email).
- **Automatically from the device and servers:** Push token, device and version information, IP address, timestamp and request logs; subscription status through store notifications.

Data is processed electronically, partly by automated means.

## 5. Purposes and legal bases of processing

| Purpose | Legal basis (KVKK) |
|---|---|
| Opening an account, sign-in, setting up a family and invitations; providing the service | Art. 5(2)(c) – formation and performance of the contract |
| Chore, star, calendar, note and development tracking; child mode and paired device; managing the child profile | Art. 5(2)(c) – performance of the contract with the parent; for child data, additionally the parent's will documented with the Parent Declaration [AVUKAT: Kurul'un 2022/776 sayılı kararı karşısında velinin ayrı açık rızası gerekip gerekmediği] (Lawyer note: whether separate explicit consent of the parent is needed in light of Board decision 2022/776.) |
| Transactional notifications (chore awaiting approval, subscription renewal and end of trial, payment problem, security alert, change to legal texts) | Art. 5(2)(c); Art. 5(2)(f) – legitimate interest: getting you information needed for the service to work (pending approval, payment problem, new sign-in and the like) in time. Notifications contain no promotion and carry no personal data; you can turn off notification permission on your device at any time. |
| AI features (only paid plans; with your confirmation for each operation): weekly family summary, class schedule/learning plan from a document, question generation, setup suggestions; on Gina Pro also open-answer assessment suggestion and study plan (Privacy Policy Section 5) | Expert review is needed: the basis in this row was written only for the weekly summary and calendar from a photo; it must be reassessed for the transfer of the child's answers/handwriting and for per-operation confirmation. Art. 5(2)(c) – performance of the paid plan you chose. The feature is off by default; it works only with your separate "feature permission" and is turned off when you withdraw it. The basis for transferring data to Anthropic (USA) is in Section 7. |
| Subscription management, purchase verification, coupon/offer codes, billing records | Art. 5(2)(c); Art. 5(2)(ç) – obligations under tax and commercial legislation |
| Security, prevention of abuse and fraud, debugging | Art. 5(2)(f) – legitimate interest: protecting accounts, family and child data against unauthorised access, fake accounts and abuse, and fixing errors; Art. 5(2)(ç) – our data security obligation (KVKK Art. 12) |
| Legal obligations: KVKK requests, requests from competent authorities, data breach notification, record keeping | Art. 5(2)(ç); Art. 5(2)(e) – establishment, exercise or protection of a right |
| Keeping consent, feature permission and declaration records for evidence | Art. 5(2)(ç) – legal obligation (the burden of proof is on us); Art. 5(2)(e) – establishment, exercise or protection of a right |
| Answering support requests | Art. 5(2)(c); Art. 5(2)(f) – legitimate interest: keeping the correspondence history for a limited time to solve your problem and prevent the same problem from recurring |
| Producing aggregate statistics that cannot be linked to your identity (e.g. number of active families, plan distribution) | Art. 5(2)(f) – legitimate interest: improving the service and planning capacity. Data is anonymised for this purpose; anonymous data is not personal data (Art. 28(1)(b)) and is not used to profile anyone. |
| Promotional and marketing messages (not in this release) | Art. 5(1) – explicit consent (separate approval, İYS registration (Turkey's commercial message management system); only email and app notification, no SMS) |
| Read-only sharing link for a teacher (works in this release; optional) | Expert review is needed (the earlier draft described this as "later, Art. 5(1) explicit consent"; the feature now exists in the app and there is no separate consent box) |
| Optional features to be added later (e.g. group practice tests, library contributions — present in the code, feature flag off) | Art. 5(1) – explicit consent; this text is updated before they are turned on |

Your data is not used for profiling, advertising or automated decisions about your child. In this release we also use no crash reporting or analytics tool; if one is added, this text is updated.

## 6. To whom and for what purpose do we transfer data?

We do not sell your data. We do not share it with third parties other than the recipients below; providers process it only for the stated purpose and on our instructions.

| Recipient | Location | Purpose and data transferred |
|---|---|---|
| Supabase Pte. Ltd. (sub-processor: Amazon Web Services) | Data and backups in the EU – Frankfurt (eu-central-1) region; company headquarters in Singapore, limited access for support and operations may take place from outside Frankfurt [AVUKAT/ÜRÜN: Supabase veri işleme sözleşmesindeki destek erişimi hükmünün teyidi] (Lawyer/product note: confirm the support access clause in the Supabase data processing agreement.) | Database, authentication, file storage and server functions (hosting). All account and child profile data. |
| Anthropic, PBC | USA | Producing the AI features. Only on paid plans and with your confirmation for each operation, the inputs of that operation (Section 8; including the documents you choose and, on Gina Pro, the child's Prova answer/workbook). |
| The person to whom you send the teacher share link | – | Without opening an account, sees read-only the scope you chose in the link (the child's first name and grade; scores, Prova results and/or chore summary); the link is time-limited and revocable. |
| Cloudflare, Inc. | USA / global network | Hosting of the web app and legal pages, network security. For web use, IP address, browser information and request logs (short-term). |
| Apple Inc. (USA) and Apple Distribution International Ltd. (Ireland) | USA / Ireland | App Store, in-app purchase and subscription verification, Sign in with Apple, iOS notification delivery (APNs). Purchase transaction information, Sign in with Apple ID and email (Apple's relay address if you hid it), push token. An independent data controller for its own services; the seller in Turkey is Apple Distribution International Ltd.; your payment details stay with them. |
| Google LLC (USA) and Google Commerce Ltd. (Ireland) | USA / Ireland | Google Play, Play billing and subscription verification, Sign in with Google, Android notification delivery (FCM; there is no Firebase SDK in the app). Purchase transaction information, Sign in with Google ID and email, push token. An independent data controller for its own services; the seller in Turkey is Google Commerce Ltd.; your payment details stay with them. |
| [E-POSTA GÖNDERİM SAĞLAYICISI – varsa] (email sending provider, if any) | [ÜLKE] (country) | Delivering verification, password reset and transactional emails; email address and email content. |
| Family members | – | The other parent/guardian aged 18 or over who joined the family with the invite code sees and edits the family's child profiles and records. |
| Competent public institutions and organisations | Turkey | Lawful requests of institutions such as courts, prosecutors and the Personal Data Protection Authority; only the data within the scope of the request. |

Providers may use their own sub-processors (Amazon Web Services for Supabase; cloud infrastructure providers for Anthropic); these onward transfers are explained in Section 7. We keep the current list of sub-processors in our Privacy Policy ([WEB ADRESİ]/legal/gizlilik-politikasi); this text is updated before a new recipient is added.

## 7. Transfers abroad

Some recipients are outside Turkey; under KVKK, every transfer outside Turkey, including to Germany, is a "transfer abroad". As of the date of this text, the Personal Data Protection Board has not issued an "adequacy decision" for any country. We therefore make transfers with the appropriate safeguard in KVKK Art. 9(4)(c), that is, by signing with each provider the **"Data Controller to Data Processor" standard contract** announced by the Board; each signed standard contract is notified to the Authority within five business days (Art. 9(5)). The same safeguards are required for onward transfers by providers to their own sub-processors (Art. 9(8)).

| Recipient | Country | Mechanism and status |
|---|---|---|
| Supabase Pte. Ltd. | Germany (hosting) / Singapore (contracting party) | Standard contract (Art. 9(4)(c)): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Supabase] (standard contract signature date / Authority notification date) |
| Amazon Web Services (Supabase's sub-processor) | Germany (Frankfurt data centre) | Onward transfer (Art. 9(8)): the condition in the standard contract signed with Supabase on the use of sub-processors and on passing the same safeguards on to AWS; Supabase–AWS data processing agreement [SUPABASE–AWS ALT İŞLEYEN GÜVENCESİ – belge ve tarih] (sub-processor safeguard – document and date) |
| Anthropic, PBC | USA | Standard contract (Art. 9(4)(c)): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Anthropic]. Until the standard contract is in place: the temporary route below. |
| 650 Industries, Inc. (Expo) | USA | Not used (6 November 2026): push notifications are sent directly through APNs/FCM; there is no EAS Update address in the app configuration. If EAS Update or Expo push is introduced, the row is added back with the standard contract information. |
| Cloudflare, Inc. | USA | Standard contract (Art. 9(4)(c)): [STANDART SÖZLEŞME İMZA TARİHİ / KURUM BİLDİRİM TARİHİ – Cloudflare] |

**Recipients that make up the service itself (Supabase, Cloudflare; Google FCM for notification delivery — expert review is needed for its role):** If an appropriate safeguard cannot be provided for these recipients, we do not make the transfer; we replace the provider with one that gives an appropriate safeguard or provide another appropriate safeguard accepted by the Board (Art. 9(4)). We do not use the explicit consent route for these recipients, because the service cannot be provided without them and consent cannot be made a precondition of the service. [AVUKAT: standart sözleşmeyi imzalamayan sağlayıcı için izlenecek yolun teyidi] (Lawyer note: confirm the route to follow for a provider that does not sign the standard contract.)

**Temporary route for Anthropic only:** Until a standard contract with Anthropic is in place, the AI features are offered only to the extent the Law allows (Art. 9(6)(a)), after you have been informed of the possible risks below, and with the explicit consent you give separately with Explicit Consent Text A; when you withdraw your consent the feature is turned off and no new transfer takes place. This route is temporary: when the standard contract is signed, the box remains only a "feature permission" and this text is updated. Not giving consent does not prevent you from using Gina and the other features of the paid plan. [AVUKAT: düzenli SaaS aktarımının m.9/6'daki "arızi" şartı karşısında bu geçici yolun savunulabilirliği] (Lawyer note: whether this temporary route is defensible given the "incidental" condition in Art. 9(6) for a regular SaaS transfer.)

The data exchange with Apple and Google for purchase verification, sign-in and notification delivery is part of these companies providing their own services as independent data controllers. [AVUKAT: Apple/Google'a yapılan doğrulama ve giriş isteklerinin yurt dışına aktarım niteliği ve dayanağı] (Lawyer note: whether verification and sign-in requests to Apple/Google are transfers abroad and on what basis.)

**Possible risks:** The country the data goes to may not have protection equivalent to KVKK; that country's public authorities may access the data under their own legislation; exercising your rights against a recipient abroad may be harder than in Turkey (you continue to exercise your rights against us; we pass your request on to the recipient); the recipient's own sub-processors carry the same risks. To reduce the risks, we encrypt data in transit, pseudonymise and minimise AI inputs, put no personal data in notification content and make data processing agreements with providers. The EU Standard Contractual Clauses in our providers' contracts are not a safeguard within the meaning of KVKK Art. 9; they are only an additional contractual measure.

## 8. AI features

- **Which plans and which features:** There are no AI features on the Gina Başlangıç (free) plan. On Gina Plus and Gina Pro there are the weekly family summary, class schedule and learning plan draft from a document, question generation and setup suggestions; only on Gina Pro there is, in addition, an open-answer assessment suggestion and a study plan. Monthly limits and details are in Section 5 of the Privacy Policy. The plans' child limits are 2 / 4 / 8.
- **Confirmation is asked separately for each operation.** There is no single general permission switch; before each operation what will be sent to Anthropic (USA) is shown and a separate, unticked confirmation is asked for. If you do not confirm, that operation is not carried out; an operation already sent cannot be recalled. No separate notification is sent to the other parents in the family. Expert review is needed: consistency of per-operation confirmation with the transfer basis (Section 7).
- **Your child does not interact with AI directly:** there is no chat in child mode and the child's device cannot start an AI request. However, AI-generated questions you have reviewed can be assigned to the child; on Gina Pro, with your separate confirmation for each review, the child's Prova answer and workbook are sent for an assessment suggestion; the assessment is shown to the child only with your approval.
- **The data sent varies by feature and is minimised:** in the weekly summary only a label such as "Child A", the grade, chore status counts and stars, and the family's language/time zone; in setup suggestions the grade, age range and interests; in question generation and the study plan the subject/grade/topic information is sent. In operations that use documents, the images/PDFs you choose, and in the assessment suggestion the child's answer text and workbook image, are sent as they are. Your name, email and device IDs are not sent.
- **Documents and images are not masked automatically.** Do not upload files showing the face, name or contact details of your child or other people, or crop them first. A separate storage consent is asked for keeping uploaded files in Gina; the retention rule is in Section 5 of the Privacy Policy (as long as linked to a record; a file not linked is deleted after 24 hours, a file used in an import after 7 days).
- **Retention at Anthropic:** Under its Commercial Terms of Service, Anthropic does not use your data to train its own models (expert review is needed: confirm against the Anthropic agreement and current terms). The app contains connection skeletons for other providers that are not configured; they are not used, and this text is updated before they are introduced. Inputs and outputs are, **as a rule, deleted within 30 days** in Anthropic's systems; content flagged on suspicion of a usage policy violation may be kept by Anthropic for safety review for **up to 2 years** and may be seen by humans. For the model classes we use, Anthropic makes 30-day retention mandatory and does not offer a "zero data retention" option; we cannot have the data deleted within a shorter period. Anthropic may use its own cloud sub-processors; the same safeguards are required for these onward transfers (Section 7). The model used is set per plan [MODEL/SAKLAMA DURUMU: paket başına model ve saklama rejimi] (model/retention status: model and retention regime per plan); if a change affects the retention period, this text is updated.
- Outputs are **suggestions;** they may be wrong or incomplete and every output shows a warning saying so. They are not a medical, psychological, educational or legal assessment, contain no labelling or diagnosis of your child and do not replace your decision. Outputs do not produce an automated decision with legal effect on you; you can nevertheless object under KVKK Art. 11(g).
- Weekly summaries are kept in Gina for **12 months** and then deleted automatically. Calendar, plan and question records created from documents and assessment suggestions are kept until you delete them or the account is deleted.

## 9. Retention periods and deletion

We keep your data for as long as necessary for the purpose and according to the table below. When the period ends or on your request, data is deleted, destroyed or anonymised; periodic destruction runs automatically at least every six months. The periods are the same as in the Privacy Policy, the Account and Data Deletion page and our store declarations.

| Data | Retention period |
|---|---|
| Account, family and profile information | Until the account is deleted; after deletion, purged from backups within [30 gün] (30 days) at the latest |
| Child profile data (chores, stars, calendar, notes, development, child PIN hash) | Until the profile or account is deleted; all of it is deleted when the profile is deleted |
| Profile of a child who turns 18 | Because we keep only the birth year, we cannot know the 18th birthday. The profile is deactivated automatically on 31 December of the year found by adding 18 to the birth year (on that date the child has certainly turned 18) [ÜRÜN KARARI: geçiş kuralı, Veli Beyanı §11 ile aynı] (product decision: transition rule, same as Parent Declaration §11); you receive an in-app notification and an email [ÖN BİLDİRİM SÜRESİ, örn. 60 gün] (advance notice period, e.g. 60 days) before deactivation and when it happens. A deactivated profile becomes read-only; child mode and paired devices are turned off and no new AI output is produced for this profile. The profile is deleted within [SİLME SÜRESİ, örn. 90 gün] (deletion period, e.g. 90 days) of deactivation. A child who has come of age can, on their own request, ask via [E-POSTA] for their data to be deleted or for a copy; we verify their identity. [AVUKAT: 18 yaşında profilin devri, ebeveyn erişiminin kesilme anı ve kimlik doğrulama yöntemi] (Lawyer note: transfer of the profile at 18, when parent access ends, and the identity verification method.) |
| AI inputs and outputs | Outputs in Gina for 12 months or until you delete them earlier; at Anthropic, as a rule 30 days (content flagged on suspicion of a violation up to 2 years) |
| Push tokens | Until sign-out from the device, removal of the app or the token becoming invalid; invalid tokens are cleaned up within [90 gün] (90 days); together with account deletion |
| Paired device and anonymous child session | Until the pairing is revoked (effective immediately on revocation; the device loses access at its next request) or until it has not been used for [90 gün] (90 days); together with profile or account deletion |
| Security and access logs (IP, timestamp) | [12 ay] (12 months) [AVUKAT: 5651 sayılı Kanun trafik verisi yükümlülüğü] (Lawyer note: traffic data obligation under Turkey's Internet Law No. 5651.) |
| Purchase and subscription verification records | For the statutory retention period [10 yıl] (10 years; tax and commercial legislation); access is kept restricted after the account is deleted |
| Consent, feature permission and declaration records | [3 yıl] (3 years) from the end of the consent or the deletion of the account (for evidence); when the account is deleted, the user ID in the record is replaced with a pseudonymous ID, and the record does not contain the child's name [AVUKAT: zamanaşımı] (Lawyer note: limitation period.) |
| Record that the Sign in with Apple token was revoked | [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] (retention period of the Apple token revocation record) after the account is deleted (proof that Apple's revocation requirement was met) [AVUKAT] (Lawyer note.) |
| Support correspondence, KVKK request and data breach records | [3 yıl] (3 years) from the closing of the request |
| Your email address for the account deletion notice | Until the deletion is completed; then deleted |

You can delete your account via **Settings > Account > Delete Account** and a single child profile via **Settings > Children > [Child] > Delete Profile**; if you cannot sign in, you can make the request from the [WEB ADRESİ]/legal/hesap-ve-veri-silme page by verifying your registered email address. Deletion covers the family, the parent account, child profiles, chore and star history, the calendar, notes, scores, AI outputs, push tokens, paired devices and Apple/Google sign-in links (including revocation of Sign in with Apple tokens). We inform you by email when we receive and when we complete your deletion request; for this purpose your email address is kept until the deletion is completed. If you wish, you can schedule the deletion for the end of the current subscription period; the option to delete immediately is always available. Deleting the account does not cancel your store subscription; the deletion screen shows an active subscription warning and the store's cancellation link, and you must cancel the subscription separately through the App Store or Google Play.

## 10. Your rights and how to apply

Under KVKK Art. 11 you have the right to: (a) learn whether your data is processed, (b) request information if it has been processed, (c) learn the purpose of processing and whether it is used in line with that purpose, (ç) know the third parties in Turkey or abroad to whom it is transferred, (d) request rectification if it is incomplete or inaccurate, (e) request erasure or destruction under the conditions in KVKK Art. 7, (f) request that rectification, erasure and destruction be notified to the third parties to whom it was transferred, (g) object to a result to your detriment arising from analysis exclusively by automated systems, (ğ) claim compensation if you suffer damage due to unlawful processing.

You can apply through the following channels, in line with the Communiqué on the Procedures and Principles of Application to the Data Controller:

- In-app form: Settings > Privacy and Legal > Data Subject Request (not yet available; at present use Help > support request in the app), or the web form: [WEB ADRESİ]/legal/kvkk-basvuru-formu
- Email from the email address registered in your account to [E-POSTA]
- In writing to [ADRES] (with identity verification) or by KEP: [KEP ADRESİ – varsa] (if any)

We do not accept requests by phone, SMS or social media. Your request must contain your full name, the email registered to your account, an address for notification and the subject of your request; for security we may verify your identity. Requests are concluded as soon as possible and **free of charge within 30 days at the latest**; for written replies exceeding ten pages, the fee in the Communiqué may be charged. If your request is rejected, you find the reply insufficient or no reply is given in time, you can complain to the Personal Data Protection Board within 30 days of learning the reply and in any case within 60 days of the request date (KVKK Art. 14).

AI confirmation is per operation; you stop the transfer by not confirming later operations (the "Settings > AI Summary" switch does not exist in the app). You can always withdraw marketing consent (if offered in the future) from the link in the message or under Settings > Notifications, and notification permission from your device settings. Withdrawal does not affect earlier processing; the feature concerned is turned off.

## 11. Rights on your child's behalf

Rights regarding child profiles are exercised by the child's parent or guardian; we verify that the applicant is a parent/guardian in the family account (as explained in Section 2, information is also given to you on the child's behalf). You can view, correct and delete the data in the child profile yourself from within the app. Your child, if capable of judgement, can pass on requests about their data to you; we handle these requests through you as the child's legal representative [AVUKAT: belirli bir yaştan sonra çocuğa doğrudan başvuru hakkı tanınıp tanınmayacağı] (Lawyer note: whether the child should be given a direct right to apply after a certain age). The other parent/guardian in the family account also sees and can edit the same records; if your custody or guardianship status changes (for example by a court decision), please let us know and we will make the necessary change to access. When your child turns 18, your authority to represent them ends; what happens to the profile is explained in Section 9. To inform your child in an age-appropriate way, a short **Child Mode Notice** is shown when child mode is first opened and in the "About" section; we recommend reading it together with your child.

## 12. Cookies and similar technologies

The mobile app does not use cookies; it contains no tracking, analytics or crash reporting SDK. The web app uses only strictly necessary cookies/local storage for the session and language preference; therefore no cookie banner is shown. Details are in our Cookie Policy: [WEB ADRESİ]/legal/cerez-politikasi.

## 13. Security

Data is encrypted in transit and on the server; row-level access control is applied so that only members of a family can access that family's data, and this check is made on the server for every request. Passwords and PINs are stored only as hashes. The parent area is protected by the 4-digit parent PIN; if biometric authentication is added, biometric data stays on your device and is not sent to us. Child mode opens, where a PIN is required, with the 4-digit child PIN (the parent can turn off the PIN for a device; then anyone using the device can enter the child profiles selected for that device; on the parent's phone a child with no PIN set enters by tapping their profile) and cannot access settings, purchases, starting AI requests, external links or other children's data. The paired device's session is anonymous and has limited permissions; when you revoke the pairing, the device's access is cut off immediately. The pairing code is protected against guessing (8 characters, a 5-minute single-use confirmation token, a 15-minute stop after 10 failed attempts per parent / 20 per family within 10 minutes). Administrator access is limited by the principle of least privilege, protected by multi-factor authentication and logged [YAYIN ÖNCESİ: yönetici hesaplarında çok faktörlü doğrulama ve erişim günlüğü açık olmalı] (before publication: multi-factor authentication and access logging must be enabled on administrator accounts). In the event of a data breach, we notify the Board within 72 hours at the latest and you as soon as possible (by email, in-app notification or web announcement).

## 14. Changes, version and language

We update this text when the legislation, the service or the recipients change. We announce material changes (new recipient, new purpose, change of transfer abroad or data region, change in Anthropic's retention regime, changes affecting children's data) by in-app notification and email at least [15 gün] (15 days) before they take effect; for changes that require explicit consent, we ask for your consent again. The current text is always available at [WEB ADRESİ]/legal/kvkk-aydinlatma-metni and under Settings > Privacy and Legal; you can request earlier versions from [E-POSTA]. The Turkish version of this text prevails; the English translation is for information only.

Related documents: Privacy Policy ([WEB ADRESİ]/legal/gizlilik-politikasi) · Consent Texts (in the app) · Parent Declaration (in the app) · Child Mode Notice (in child mode) · Terms of Use ([WEB ADRESİ]/legal/kullanim-kosullari) · Subscription Terms ([WEB ADRESİ]/legal/abonelik-kosullari) · Cookie Policy ([WEB ADRESİ]/legal/cerez-politikasi) · Account and Data Deletion ([WEB ADRESİ]/legal/hesap-ve-veri-silme) · Data Subject Request Form ([WEB ADRESİ]/legal/kvkk-basvuru-formu).

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 29 October 2026 | First draft (before lawyer review) |
| 0.2 (C11 technical correction) | 6 November 2026 | Technical comparison with the app: Expo removed (direct APNs/FCM), AI features and per-operation confirmation, child data (gender, interests, school name, Prova answers), uploaded documents, teacher sharing, optional child PIN; unimplemented promises listed in the header. Legal bases not changed, marked "expert review is needed". No legal expert approval. |
| 0.2 (D16 technical correction) | 6 November 2026 | §3 paired device row: 8-character code, confirmation token, the parent who paired the device, code attempt records, cancellation on the tablet side; §13 entry without a PIN on the parent's phone and protection of the pairing code against guessing. No legal expert approval. Details: `docs/release/d16-2026-11-06/README.md`. |
| 0.2 | 30 October 2026 | Review notes and DECISIONS.md applied. §5: AI basis Art. 5(2)(c) + separate, off-by-default feature permission (transfer basis §7); consent/declaration records Art. 5(2)(ç) and Art. 5(2)(e); a concrete legitimate interest in each Art. 5(2)(f) row; aggregate statistics row. §8/§9: AI outputs 12 months in Gina; at Anthropic as a rule 30 days, up to 2 years on suspicion of a violation, 30 days mandatory for the model class used/no ZDR; plans (Başlangıç/Plus/Pro, 2/4/8 children) and Pro features. §3: child data only name/nickname + birth year; 4-digit child and parent PIN hashes; no phone requested. §2/§6: under DECISIONS only parents/guardians aged 18+ are invited to the family (the "authorised adults" model in the review was not applied); invite code only for joining the family; pairing revocation immediate. §6: Apple/Google US and Irish legal entities; conditional sentence on Expo EAS Update; AWS sub-processor. §7: Art. 9(4)(c) standard contract + Art. 9(5) notification; AWS onward transfer (Art. 9(8)); no transfer to service providers without a safeguard, explicit consent route only for Anthropic and temporary; EU SCCs are not a safeguard. §9: 18-year row (Parent Declaration §11 rule), "Settings > Children > [Child] > Delete Profile", rows for the Apple token revocation record and the deletion email, scheduled deletion at the end of the period; support records [3 yıl] (3 years). §2/§11: explanation of informing the legal representative (Communiqué Art. 6); §14: Child Mode Notice and /legal/ slugs. |
| 0.2 (D18 English version) | 6 November 2026 | This English section added, translated from the current Turkish text (after D16/D17); the content of the Turkish text was not changed. No legal expert approval. Details: `docs/release/d18-2026-11-06/README.md`. |
