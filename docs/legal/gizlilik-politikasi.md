<!--
docs/legal/gizlilik-politikasi.md — TASLAK v0.2 (2026-10-30), avukat incelemesi bekliyor.
Yayın yerleri: ASC "Privacy Policy URL", Play Console "App content > Privacy policy", web altbilgisi,
uygulama içi Ayarlar > Gizlilik ve Yasal, kayıt ekranı bağlantısı. Herkese açık HTTPS sayfası, giriş
veya coğrafi kısıt yok, PDF değil, URL sabit: /legal/gizlilik-politikasi. [...] alanları yayın öncesi
doldurulur; İngilizce sürüm aynı yer tutucuları kullanır. Göreli bağlantılar (./<slug>.md) web
derlemesinde /legal/<slug> sayfalarına çevrilir; dosya adı slug'dan farklı olan tek belge:
abonelik-kosullari-ve-on-bilgilendirme.md -> /legal/abonelik-kosullari. Açık Rıza Metinleri, Veli Beyanı
ve Çocuk Modu Bilgilendirmesi uygulama içi metinlerdir; web'de yayımlanmayacaklarsa bağlantı kaldırılıp
yalnızca adı bırakılır.
Bölüm 3, 6 ve 10 tabloları App Privacy / Data safety beyanları ve saklama-imha politikasıyla birebir
tutarlı tutulur (docs/legal/internal/magaza-gizlilik-beyanlari.md).
YAYIN ÖNCESİ KONTROL LİSTESİ (v0.2 incelemesinden):
 1. Bölüm 13'teki "yönetici erişimi çok faktörlü doğrulamalı ve kayıt altındadır" cümlesi, Supabase
    hesabında MFA ve erişim günlüğü açılmadan yayımlanmaz (metinde [YAYIN ÖNCESİ TEYİT] işareti var).
 2. Bölüm 8'deki [AKTARIM MEKANİZMASI DURUMU] her sağlayıcı için doldurulur; standart sözleşmeyi
    imzalamayan sağlayıcı için avukat kararı metne yansıtılır.
 3. Yapay zekâ çıktılarının Gina'da saklanma süresi DECISIONS.md gereği 12 aydır (inceleme notundaki
    "6 ay" uygulanmadı); KVKK Aydınlatma Metni 0.2 de 12 ay der — yayın öncesi tüm belgelerde teyit.
 4. Bağlantı slug'ları DECISIONS.md'deki listeye göre bu belgede esastır (/legal/hesap-ve-veri-silme,
    /legal/kvkk-basvuru-formu); Kullanım Koşulları 0.2'de buna göre düzeltildi — yayın öncesi teyit.
 5. EAS Update kullanılmaya başlanırsa Bölüm 6 Expo satırı ve Aydınlatma §6 birlikte güncellenir
    (bu sürümde EAS bulut hizmeti kullanılmadığı varsayımıyla ibare kaldırıldı — teknik teyit).
 6. Gina Pro "fotoğraftan takvim": ayrı izin metni (Açık Rıza Metinleri `feature_photo_calendar`),
    fotoğrafın saklanma kuralı ([ÜRÜN KARARI]) ve App Privacy / Data safety "Photos" beyanı netleştirilir.
 7. 18 yaş kuralı (31 Aralık pasife alma, [SİLME SÜRESİ]) Veli Beyanı §11, Aydınlatma §9 ve bu belgede
    aynı tutulur; Google Play hedef kitle kararı (18+ ebeveyn) Bölüm 9 ile uyumlu kalır.
-->

# Gina Gizlilik Politikası

**Sürüm:** 0.2 (taslak) · **Taslak tarihi:** 2026-10-30 · **Yürürlük tarihi:** [YÜRÜRLÜK TARİHİ]

> Bu metin taslaktır; yayın öncesi avukat incelemesi önerilir.

Türkçe metin esastır; bilgi amaçlı İngilizce sürüm sayfanın sonundadır. / The Turkish text prevails; an English version is at the end of this page.

## Kısa özet

- Gina, ebeveynlerin çocuklarının günlük görevlerini, takvimini, notlarını ve okul bilgilerini takip ettiği bir aile uygulamasıdır. Hesabı yalnızca 18 yaşını doldurmuş bir ebeveyn veya vasi açar; uygulama mağazalarda yetişkin ebeveynlere yönelik olarak sunulur.
- Çocuk profillerini ebeveyn oluşturur; çocuk için yalnızca ad veya takma ad ve doğum yılı gerekir. Çocuklardan doğrudan kayıt almayız; çocuklardan e-posta, telefon, şifre veya fotoğraf istemeyiz.
- Üçüncü taraf analitik, reklam veya takip aracı kullanmayız. Reklam göstermeyiz, verilerinizi satmayız.
- Verileriniz Almanya'daki (Frankfurt) sunucularda saklanır. Bildirim iletimi, web barındırma ve isteğe bağlı yapay zekâ özellikleri için ABD merkezli sağlayıcılar kullanırız.
- Yapay zekâ özellikleri (haftalık aile özeti; Gina Pro'da ayrıca ipuçları ve fotoğraftan takvim) yalnızca ücretli paketlerde, yalnızca siz açarsanız ve yalnızca ebeveyn alanında çalışır. İzin varsayılan olarak kapalıdır, her zaman geri alınabilir ve vermemeniz paketinizin diğer özelliklerini etkilemez. Çocuklar yapay zekâ ile hiçbir şekilde etkileşmez; gönderilen veriler takma adlandırılır.
- Ödemeler Apple App Store ve Google Play üzerinden alınır; kart bilgilerinizi hiçbir zaman görmeyiz.
- Hesabınızı ve tüm verilerinizi uygulama içinden veya web üzerinden her zaman silebilirsiniz.

## 1. Kapsam

Bu Gizlilik Politikası ("Politika"), [VERİ SORUMLUSU UNVANI] ("biz") tarafından "Gina" adıyla (mağazalarda "Gina Aile") sunulan iOS ve Android uygulamalarını, Gina web uygulamasını ve [WEB SİTESİ ADRESİ] adresindeki web sitesini (birlikte "Gina") kapsar. Politika yalnızca Gina'ya özgüdür; Apple, Google ve diğer üçüncü taraflar kendi hizmetlerindeki verileri kendi politikalarına göre işler.

Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamındaki aydınlatma yükümlülüğümüzü yerine getiren [KVKK Aydınlatma Metni](./kvkk-aydinlatma-metni.md) ile birlikte okunmalıdır. Politika'ya kayıt ekranından ve Ayarlar > Gizlilik ve Yasal bölümünden her zaman ulaşabilirsiniz. Aydınlatma Metni'ni okumanız rıza anlamına gelmez; açık rıza veya ayrı izin gerektiren işlemler için onayınızı ayrı ve önceden işaretlenmemiş kutucuklarla isteriz; bu onaylar hesap açmanın, girişin veya satın almanın ön şartı değildir.

İlgili belgeler: [Açık Rıza Metinleri](./acik-riza-metinleri.md) · [Veli Beyanı](./veli-beyani-ve-cocuk-profili-onayi.md) · [Kullanım Koşulları](./kullanim-kosullari.md) · [Abonelik Koşulları](./abonelik-kosullari-ve-on-bilgilendirme.md) · [Çerez Politikası](./cerez-politikasi.md) · [Hesap ve Veri Silme](./hesap-ve-veri-silme.md) · [KVKK Başvuru Formu](./kvkk-basvuru-formu.md)

## 2. Veri sorumlusu ve geliştirici

| Bilgi | Değer |
|---|---|
| Veri sorumlusu / geliştirici | [VERİ SORUMLUSU UNVANI] |
| Adres | [ADRES] |
| E-posta (destek ve gizlilik) | [E-POSTA] |
| KEP adresi | [KEP ADRESİ] |
| Vergi / kimlik numarası | [VKN/TCKN] |
| MERSİS numarası | [MERSİS] |

Telefon kanalımız yoktur; bize e-posta, KEP veya posta yoluyla ulaşabilirsiniz.

## 3. Hangi verileri topluyoruz

Son sütun, Apple App Store "Uygulama Gizliliği" etiketlerinde ve Google Play "Veri güvenliği" bölümünde kullandığımız sınıflandırmadır. Bu verilerin tümü hesabınızla bağlantılıdır; hiçbiri takip (tracking) veya reklam amacıyla kullanılmaz.

| Veri türü | Örnekler | Kaynak | Amaç | Mağaza sınıfı (Apple / Google) |
|---|---|---|---|---|
| Hesap bilgileri (ebeveyn) | E-posta, ad (isteğe bağlı), şifre (yalnızca özet/hash), Apple veya Google ile giriş kimliği, dil, bölge ve saat dilimi tercihi, 4 haneli ebeveyn PIN'i (yalnızca özet/hash) [TEKNİK TEYİT: ebeveyn PIN'inin sunucuda mı cihazda mı tutulduğu] | Siz; Apple/Google | Hesap açma, giriş, güvenlik, dil ve tarih biçimi, ebeveyn alanının korunması | Contact Info, Identifiers / Personal info |
| Aile ve çocuk profili | Aile adı, aile davet kodu, çocuğun adı veya takma adı, doğum yılı (doğum tarihi istenmez), isteğe bağlı sınıf düzeyi, seçilen hazır avatar (fotoğraf değil), çocuk modu girişi için 4 haneli çocuk PIN'i (yalnızca özet/hash) | Siz (çocuğunuz adına) | Aile ve çocuk modu işlevleri | User Content / App activity |
| Kullanım içerikleri | Görevler ve tamamlanma durumu, yıldız ve ödüller, takvim ve ders programı, notlar, not/puan kayıtları, gelişim takibi notları | Siz; çocuğunuz (çocuk modunda yalnızca görev tiki) | Uygulama işlevleri, haftalık özet | User Content / App activity |
| Çocuk modu ve eşleştirilmiş cihaz işlem kayıtları | Çocuk modunda "yaptım" işaretinin zamanı ve ait olduğu çocuk profili, eşleştirme ve eşleştirme iptali zamanı, eşleştirilmiş cihaz oturumunun son kullanım zamanı | Cihazınız veya eşleştirilmiş cihaz (otomatik) | Çocuk modu işlevleri, görev onayı, kötüye kullanımın önlenmesi | Usage Data (Product Interaction) / App activity (App interactions) |
| Yapay zekâ özellikleri verileri | Takma adlı görev ve takvim istatistikleri ile çıktının dili için yerel ayar tercihi (girdi); üretilen özet ve ipuçları (çıktı) | Hesabınızdaki verilerden türetilir | Haftalık aile özeti ve ipuçları (ücretli paket, izninizle) | User Content / App activity |
| Fotoğraftan takvim (yalnızca Gina Pro, isteğe bağlı, ayrı izinle) | Sizin çektiğiniz veya seçtiğiniz belge fotoğrafı (ders programı, okul takvimi) ve ondan çıkarılan takvim kayıtları | Siz | Takvim kayıtlarının otomatik oluşturulması (izninizle) | User Content (Photos or Videos) / Photos and videos |
| Cihaz ve bildirim verileri | Bildirim (push) belirteci, cihaz türü ve işletim sistemi sürümü, uygulama sürümü, eşleştirilmiş tablet kimliği (uygulamanın ürettiği rastgele kimlik; yalnızca cihaz eşleştirirseniz) | Cihazınız (otomatik) | Bildirimler, çocuk modu eşleştirme, uyumluluk | Identifiers / Device or other IDs |
| Satın alma ve abonelik | Mağaza işlem kimliği, paket kimliği, abonelik durumu ve yenileme tarihi, mağaza ülkesi ve para birimi, kullanılan mağaza teklif/promosyon kodu | Apple / Google | Paket yetkilendirme, destek, muhasebe | Purchases / Financial info (purchase history) |
| Güvenlik ve sunucu günlükleri | IP adresi, zaman damgası, istek türü, hata kayıtları | Sunucularımız (otomatik) | Güvenlik, kötüye kullanımın önlenmesi, hata ayıklama | Diagnostics / App info and performance |
| Rıza, izin ve beyan kayıtları | Onaylanan metin sürümü, dil, zaman damgası, kullanıcı kimliği [ve avukat kararına göre IP özeti / uygulama örneği kimliği] | Siz; sunucularımız | Yasal ispat | Other data / Personal info (other) |
| Destek yazışmaları | E-posta adresi, mesaj içeriği, ekler | Siz | Destek | Contact Info, User Content / Personal info |

**Zorunlu ve isteğe bağlı veriler:** Hesap için e-posta ve şifre (ya da Apple/Google ile giriş), çocuk profili için ad veya takma ad ve doğum yılı zorunludur. Ad, sınıf düzeyi, avatar, cihaz eşleştirme, çocuk ve ebeveyn PIN'leri (yalnızca çocuk modu kullanılırsa), yapay zekâ özellikleri, fotoğraftan takvim ve destek yazışmaları isteğe bağlıdır. Güvenlik günlükleri ve rıza kayıtları hizmetin çalışması ve yasal ispat için otomatik olarak tutulur.

**Üçüncü taraflara giden veriler:** Yalnızca Bölüm 6'da sayılan alıcılara, orada yazılı kapsamda: bildirim belirteci (Expo, Apple, Google), satın alma verileri (Apple/Google) ve izninizle yapay zekâ girdileri (Anthropic). Eşleştirilmiş tablet kimliği uygulamanın kendi ürettiği rastgele bir kimliktir (reklam kimliği veya donanım seri numarası değildir), yalnızca bir cihaz eşleştirirseniz oluşturulur ve hiçbir üçüncü tarafla paylaşılmaz.

**Toplamadığımız veriler:** konum (konum izni istemeyiz; IP adresi yalnızca güvenlik günlüklerinde tutulur), telefon numarası, kişi listesi, kamera ve fotoğraf kütüphanesi taraması (yalnızca Gina Pro'daki isteğe bağlı fotoğraftan takvim özelliğinde, siz seçtiğinizde, tek bir belge fotoğrafı iletilir), mikrofon, sağlık verileri (boy-kilo, hastalık, alerji, ilaç), T.C. kimlik numarası, kart veya banka bilgileri, reklam kimlikleri (IDFA/AAID), tarama ve arama geçmişi. Notlar ve gelişim takibi gibi serbest metin alanlarına sağlık bilgisi gibi özel nitelikli veri girmemenizi rica ederiz; bu alanlar yapay zekâya gönderilmez.

## 4. Verileri nasıl ve hangi hukuki sebeple kullanıyoruz

| Amaç | Veriler | KVKK hukuki sebebi |
|---|---|---|
| Hesap açma, giriş, hesap güvenliği, destek; hesap silme talebinin alındığına ve tamamlandığına ilişkin bilgilendirme | Hesap bilgileri, güvenlik günlükleri, destek yazışmaları | Sözleşmenin ifası (m.5/2-c); meşru menfaat (m.5/2-f: hesabınızın yetkisiz erişime karşı korunması) |
| Aile ve çocuk profilleri; görev, yıldız, takvim, not, puan ve gelişim takibi; çocuk modu ve eşleştirilmiş tablet | Aile ve çocuk profili, kullanım içerikleri, çocuk modu işlem kayıtları, cihaz kimliği | Ebeveynle kurulan sözleşmenin ifası (m.5/2-c); çocuk verileri için Veli Beyanı [AVUKAT: velinin ayrıca açık rızası alınacak mı] |
| Görev onayı, hatırlatma, abonelik ve güvenlik bildirimleri | Bildirim belirteci, cihaz bilgisi | Sözleşmenin ifası (m.5/2-c); meşru menfaat (m.5/2-f: hesap ve cihaz güvenliği uyarıları); bildirim izni cihazınızdan verilir |
| Yapay zekâ özellikleri: haftalık aile özeti, ipuçları ve fotoğraftan takvim (ücretli paket, isteğe bağlı) | Takma adlı görev ve takvim istatistikleri, yerel ayar tercihi; Gina Pro'da seçtiğiniz belge fotoğrafı | İşleme: seçtiğiniz ücretli paketin ifası (m.5/2-c). Yurt dışına aktarım: Kurul'un standart sözleşmesi (m.9/4-c) ile birlikte ayrı, varsayılan olarak kapalı ve her zaman geri alınabilir özellik izniniz; Anthropic ile standart sözleşme sağlanana kadar bu izin açık rıza (m.9/6-a) olarak alınır — Bölüm 5 ve 8 |
| Abonelik yönetimi ve faturalandırma kayıtları | Satın alma ve abonelik verileri | Sözleşmenin ifası (m.5/2-c); hukuki yükümlülük (m.5/2-ç) |
| Güvenlik, dolandırıcılık ve kötüye kullanımın önlenmesi, hata ayıklama | Güvenlik ve sunucu günlükleri | Meşru menfaat (m.5/2-f: sistemlerin ve kullanıcı verilerinin korunması) |
| Rıza, izin ve beyan kayıtlarının ispat amacıyla tutulması | Rıza, izin ve beyan kayıtları | Hukuki yükümlülük (m.5/2-ç; ispat yükü bizdedir); hakkın tesisi, kullanılması ve korunması (m.5/2-e) |
| Yasal yükümlülükler, resmi talepler, hakların korunması | İlgili kayıtlar | Hukuki yükümlülük (m.5/2-ç); hakkın tesisi, kullanılması ve korunması (m.5/2-e) |
| Ürün duyuruları ve pazarlama iletileri (ilk sürümde yok) | E-posta, bildirim belirteci (SMS kanalı yoktur) | Yalnızca ayrı açık rızanızla (m.5/1) ve İleti Yönetim Sistemi (İYS) kaydıyla |

Verilerinizi bu amaçlar dışında kullanmayız, satmayız, kiralamayız. Sizi veya çocuğunuzu önemli ölçüde etkileyen kararları yalnızca otomatik sistemlerle vermeyiz; profilleme yapmayız.

## 5. Yapay zekâ özellikleri: haftalık aile özeti, ipuçları ve fotoğraftan takvim

- **Ne yapar:** Gina Plus ve Gina Pro'da, haftada bir, ailenizin görev ve takvim verilerinden kısa bir özet ve öneriler üretir (haftalık aile özeti). Gina Pro'da ayrıca 7 günlük ipuçları ve "fotoğraftan takvim" özelliği (ders programı, okul takvimi gibi bir belgenin fotoğrafından takvim kayıtları çıkarma; ayda en fazla 20 fotoğraf) bulunur. Tümü yalnızca ebeveyn alanında gösterilir. Gina Başlangıç (ücretsiz) paketinde yapay zekâ özelliği yoktur.
- **Varsayılan olarak kapalıdır.** Açmadan önce verilerin ABD'deki sağlayıcıya gönderileceğini, orada kural olarak 30 gün saklanacağını ve muhtemel riskleri (Bölüm 8) açıklar; izninizi ayrı, önceden işaretlenmemiş bir kutucukla isteriz. Bu izin hesap açmanın, girişin veya satın almanın ön şartı değildir: vermezseniz ya da geri alırsanız yalnızca yapay zekâ özellikleri kapalı kalır, paketinizin diğer özellikleri çalışmaya devam eder. Ayarlar > Yapay Zekâ Özeti'nden tek dokunuşla kapatabilirsiniz; kapattığınızda yeni veri gönderilmez. İzni veren ebeveyn hesabı kaydedilir; ailedeki diğer ebeveynler özelliğin açıldığını uygulama içi bildirimle öğrenir ve her ebeveyn özelliği kapatabilir.
- **Ne gönderilir:** Çocuğunuz için yalnızca takma adı veya ilk adı (ya da "Çocuk A" gibi bir etiket), doğum yılından türetilen yaş aralığı ve görev, yıldız ve takvim istatistikleri. Soyadı, doğum tarihi ve doğum yılı, okul adı, fotoğraf, serbest metin notlar, not/puan ayrıntıları ve gelişim notları gönderilmez. Size ait verilerden yalnızca çıktının dili için yerel ayar tercihi gönderilir; adınız, e-postanız, aile adınız ve cihaz kimlikleriniz gönderilmez. İstekler Gina sunucuları üzerinden yapılır; sağlayıcı cihazınızla doğrudan iletişim kurmaz [TEKNİK TEYİT].
- **Fotoğraftan takvim (Gina Pro) ayrı izne bağlıdır.** Haftalık özet izni fotoğrafı kapsamaz; bu özellik için ayrı bir izin istenir ve yalnızca sizin çektiğiniz veya seçtiğiniz belge fotoğrafı gönderilir. Fotoğrafta çocuğunuzun adı veya okul adı gibi bilgiler görünüyorsa bunlar da iletilir; bu nedenle mümkünse yalnızca program bölümünü çekmenizi öneririz. Kişi fotoğrafı veya kişisel bilgi içeren belge yüklemeyin. [ÜRÜN KARARI / TEKNİK TEYİT: cihazda ön işleme ve fotoğrafın Gina'da saklanıp saklanmadığı]
- **Sağlayıcı:** Anthropic, PBC (ABD), Claude modelleri; kullanılan model pakete göre değişebilir. Anthropic, ticari hizmet şartları uyarınca verilerinizi model eğitiminde kullanmaz ve hizmeti sunarken kendi bulut alt işleyenlerini kullanabilir. Girdiler ve çıktılar Anthropic sistemlerinde kural olarak 30 gün saklanır ve silinir; kullandığımız modellerde bu 30 günlük saklama zorunludur, daha kısa veya sıfır saklama seçeneği yoktur ve bu süreyi kısaltamayız. Kullanım politikası ihlali şüphesiyle işaretlenen içerik Anthropic tarafından güvenlik incelemesi için 2 yıla kadar tutulabilir ve insan tarafından görülebilir. Sağlayıcı değişirse bu Politika'yı güncelleriz ve izninizi yeni sağlayıcı için yeniden isteriz; saklama süresi değişirse bu Politika güncellenir.
- **Çocuklar yapay zekâ ile etkileşmez.** Çocuk modunda ve eşleştirilmiş tablette hiçbir yapay zekâ özelliği veya çıktısı yoktur.
- **Çıktılar öneri niteliğindedir.** Özet, ipuçları ve fotoğraftan çıkarılan takvim kayıtları hata yapabilir; olgusal ifadelere güvenmeden önce uygulamadaki kayıtları ve kaynak belgeyi kontrol edin; her çıktıda bu uyarı gösterilir. Çıktılar tıbbi, psikolojik, eğitimsel veya hukuki tavsiye değildir; çocuğunuz hakkında teşhis veya etiketleme amacı taşımaz ve hakkınızda hukuki sonuç doğuran otomatik bir karar üretmez.
- **Saklama:** Üretilen özetler ve ipuçları hesabınızda 12 ay saklanır; istediğiniz zaman silebilirsiniz; çocuk profili veya hesabınız silindiğinde silinir. Fotoğraftan takvim için gönderilen görüntü [ÜRÜN KARARI: işlem tamamlandığında Gina'da silinir / [SÜRE] saklanır]; çıkarılan takvim kayıtları diğer takvim kayıtlarınız gibi saklanır.

## 6. Verileri kimlerle paylaşıyoruz

Kişisel verilerinizi satmayız. Gina'yı sunmak için aşağıdaki sağlayıcıları kullanırız; bunlar verileri yalnızca bizim talimatımızla ve bu Politika'daki amaçlarla işler. Her biriyle, verilerinizi en az bu Politika'da taahhüt ettiğimiz düzeyde koruyan yazılı veri işleme sözleşmeleri yaparız; aynı düzeyde koruma sağlamayan sağlayıcılarla çalışmayız.

| Sağlayıcı | Rol | Paylaşılan veriler | Konum |
|---|---|---|---|
| Supabase Pte. Ltd. (Singapur); alt işleyeni Amazon Web Services | Veritabanı, kimlik doğrulama, depolama, sunucu fonksiyonları | Bu Politika'daki tüm hesap, aile ve çocuk profili verileri | Almanya, Frankfurt (AB, eu-central-1); yedekler aynı bölgede. Supabase'in destek ve operasyon ekipleri, veri işleme sözleşmesi çerçevesinde ve yalnızca gerektiğinde, Frankfurt dışından (Singapur dâhil) uzaktan erişebilir (Bölüm 8) |
| Anthropic, PBC (ABD) | Yapay zekâ özellikleri (Bölüm 5) | Takma adlı görev ve takvim istatistikleri, yerel ayar tercihi; Gina Pro'da ayrı izinle fotoğraftan takvim için seçtiğiniz belge fotoğrafı; yalnızca ücretli paket ve izninizle | ABD; kural olarak 30 gün içinde silinir (kullanım politikası ihlali şüphesinde 2 yıla kadar tutulabilir) |
| 650 Industries, Inc. ("Expo") (ABD) | Bildirimlerin Apple ve Google servislerine iletilmesi | Bildirim belirteci, cihaz işletim sistemi, kişisel veri içermeyen bildirim metni | ABD; içerik yalnızca iletim sırasında bellekte |
| Cloudflare, Inc. (ABD) | Web uygulaması ve sitenin barındırılması, ağ güvenliği | IP adresi, tarayıcı bilgisi, ağ günlükleri (yalnızca web) | ABD ve küresel ağ; ağ günlüklerini saklama süresi [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ] |
| Apple Inc. (ABD) ve Apple Distribution International Ltd. (İrlanda) | App Store, uygulama içi satın alma ve abonelikler, Apple ile Giriş, bildirim iletimi (APNs) | Satın alma işlemleri, Apple ile giriş kimliği ve e-posta (gizlerseniz Apple'ın aktarma adresi), bildirim belirteci | Kendi hizmetleri için bağımsız veri sorumlusu ([Apple Gizlilik Politikası](https://www.apple.com/legal/privacy/)) |
| Google LLC (ABD) ve Google Commerce Ltd. (İrlanda) | Google Play, Play faturalandırma ve abonelikler, Google ile Giriş, Android bildirim iletimi (FCM; uygulamada Firebase SDK'sı yoktur) | Satın alma işlemleri, Google ile giriş kimliği ve e-posta, bildirim belirteci | Kendi hizmetleri için bağımsız veri sorumlusu ([Google Gizlilik Politikası](https://policies.google.com/privacy)) |
| [E-POSTA GÖNDERİM SAĞLAYICISI] ([ÜLKE]) | Hesap doğrulama, şifre sıfırlama ve işlem e-postaları | E-posta adresi ve e-posta içeriği | [ÜLKE] |
| Ailenize davet ettiğiniz diğer ebeveyn/vasi | Aile verilerinin ortak kullanımı | Ailenin çocuk profilleri ve kayıtları | Kendi hesabından erişir; davet kodunu yalnızca çocuğun diğer ebeveyni/vasisiyle paylaşın (Bölüm 9) |
| Yetkili kamu kurumları ve mahkemeler | Yasal yükümlülük veya yetkili makam talebi | Yalnızca talep kapsamındaki veriler | Türkiye |

Bunların dışında verilerinizi, açık rızanız, yasal bir yükümlülük ya da kullanıcılarımızı, çocukları ve haklarımızı korumak için zorunluluk bulunmadıkça kimseyle paylaşmayız. Gina'nın devri veya birleşme hâlinde verileriniz bu Politika'ya uymayı taahhüt eden devralana aktarılabilir; sizi önceden bilgilendiririz. Sağlayıcı değişikliklerini bu Politika'yı güncelleyerek duyururuz; yapay zekâ sağlayıcısı değişirse izninizi yeniden isteriz.

## 7. Analitik, reklam ve takip

- Üçüncü taraf analitik, reklam veya takip (tracking) SDK'sı kullanmayız; uygulamada Firebase Analytics, Crashlytics gibi araçlar yoktur.
- Reklam göstermeyiz; reklam ağları ve veri simsarlarıyla veri paylaşmayız. Çocuklara hiçbir şekilde reklam gösterilmez.
- Reklam kimliklerini (IDFA, AAID) toplamayız; iOS "Uygulama Takibi Şeffaflığı" izni istemeyiz; verilerinizi başka uygulama veya sitelerdeki verilerle eşleştirmeyiz.
- Hata ayıklama ve ürün geliştirme için yalnızca kendi sunucu günlüklerimizi kullanırız; bunlar analitik amacıyla üçüncü taraflara aktarılmaz. İlk sürümde çökme raporlama aracı yoktur; ileride eklenirse kişisel veri içermeyecek, çocuk modunda kapalı olacak ve bu Politika güncellenecektir.

## 8. Yurt dışına aktarım

Sunucularımız Türkiye dışındadır: verileriniz Almanya'da (Supabase/AWS, Frankfurt) saklanır; bildirim iletimi, web barındırma ve yapay zekâ özellikleri için ABD'deki sağlayıcılar kullanılır (Bölüm 6). Supabase'in merkezi Singapur'dadır; verileriniz Frankfurt'ta tutulsa da Supabase'in destek ve operasyon ekipleri, veri işleme sözleşmesi çerçevesinde ve yalnızca gerektiğinde sistemlere Frankfurt dışından (Singapur dâhil) uzaktan erişebilir. KVKK'ya göre Almanya dâhil Türkiye dışına her aktarım ve yurt dışından her erişim "yurt dışına aktarım"dır.

Kişisel Verileri Koruma Kurulu bugüne kadar hiçbir ülke için yeterlilik kararı vermemiştir. Bu nedenle aktarımlarımızı KVKK m.9/4-c'deki uygun güvenceye dayandırırız: sağlayıcılarla Kurul tarafından ilan edilen "Veri Sorumlusundan Veri İşleyene" standart sözleşmesini imzalar ve imzadan itibaren beş iş günü içinde Kuruma bildiririz (m.9/5). Sağlayıcılarımızın kendi alt işleyenlerine (örneğin Supabase'in AWS'ye, Anthropic'in bulut altyapısına) yaptığı sonraki aktarımlarda da aynı güvenceler aranır (m.9/8).

- **Hizmetin kendisini oluşturan sağlayıcılar** (Supabase, Expo, Cloudflare, e-posta sağlayıcısı): Gina bu sağlayıcılar olmadan çalışmadığından aktarım sizin ayrı rızanıza değil, yalnızca standart sözleşmeye dayanır; bu sağlayıcılar için açık rıza yoluna başvurmayız, çünkü rıza hizmetin ön şartı yapılamaz. Bir sağlayıcı için uygun güvence sağlanamazsa o sağlayıcıya aktarım yapmayız; sağlayıcıyı uygun güvence veren bir sağlayıcıyla değiştirir veya Kurul'un kabul ettiği başka bir uygun güvenceyi (m.9/4) sağlarız. [AKTARIM MEKANİZMASI DURUMU: her sağlayıcı için standart sözleşme imza ve Kurum bildirim tarihi; standart sözleşmeyi imzalamayan sağlayıcı için avukat kararı — yayın öncesi doldurulacak]
- **Yapay zekâ sağlayıcısı (Anthropic):** Bu aktarım hizmetin zorunlu parçası değildir; yalnızca ücretli paketlerde ve siz açarsanız yapılır. Yapay zekâ özelliklerini açarken verdiğiniz izin aynı zamanda yurt dışına aktarım izninizdir; varsayılan olarak kapalıdır ve Ayarlar'dan her zaman geri alınabilir. Anthropic ile standart sözleşme imzalanıp Kuruma bildirilene kadar bu izin, aşağıdaki muhtemel riskler hakkında bilgilendirilerek verdiğiniz açık rıza (KVKK m.9/6-a) olarak alınır; standart sözleşme sağlandığında kutucuk yalnızca özellik izni olarak kalır ve bu Politika güncellenir. [AVUKAT: düzenli SaaS aktarımında açık rıza yolunun "arızi olma" şartı karşısında savunulabilirliği]
- **Apple ve Google:** Satın alma doğrulama, giriş ve bildirim iletimi için Apple ve Google ile yapılan veri alışverişi, bu şirketlerin kendi hizmetlerini bağımsız veri sorumlusu olarak sunmasının parçasıdır (Bölüm 6). [AVUKAT: bu alışverişin yurt dışına aktarım niteliği ve dayanağı]

Sağlayıcılarımızın veri işleme sözleşmeleri AB Standart Sözleşme Hükümleri'ni de içerir; bu hükümler KVKK m.9 kapsamında bir aktarım güvencesi sayılmaz, yalnızca ek sözleşmesel tedbirdir. Ayrıca aktarılan verileri en aza indirir, takma adlandırır ve şifreleriz.

**Muhtemel riskler:** Türkiye dışındaki ülkelerde veri koruma kuralları farklı olabilir; o ülkelerin kamu makamları yasal yetkileri çerçevesinde verilere erişim isteyebilir; haklarınızı yabancı bir ülkede kullanmak daha güç olabilir (haklarınızı bize karşı kullanmaya devam edersiniz; talebinizi alıcıya biz iletiriz); alıcıların kendi alt işleyenleri aynı riskleri taşır; yapay zekâ sağlayıcısındaki 30 günlük saklama süresini kısaltamayız. Bu riskleri yukarıdaki sözleşmeler ve teknik önlemlerle azaltırız. Alıcılar için Bölüm 6'ya, haklarınız için Bölüm 12'ye bakınız.

## 9. Çocukların gizliliği

- **Hesap sahibi ebeveyndir.** Gina ebeveynler ve vasiler içindir; hesabı yalnızca 18 yaşını doldurmuş bir ebeveyn veya vasi açabilir. Çocuklar hesap açamaz; çocuklardan e-posta, telefon, şifre veya fotoğraf istemeyiz. Gina, App Store ve Google Play'de 18 yaşını doldurmuş ebeveynlere yönelik bir uygulama olarak sunulur; "Çocuklar" kategorisinde yer almaz ve çocuklara pazarlanmaz. Çocuk modu, çocuğun ebeveyn gözetiminde kullandığı sınırlı bir görünümdür.
- **Çocuk profilini ebeveyn oluşturur.** Çocuk eklerken ebeveyn, 18 yaşını doldurduğunu ve çocuğun velisi ya da vasisi olduğunu beyan eder ([Veli Beyanı](./veli-beyani-ve-cocuk-profili-onayi.md)). Çocuk için yalnızca ad veya takma ad ve doğum yılı gerekir (doğum tarihi istenmez); sınıf düzeyi ve hazır avatar isteğe bağlıdır. Soyadı, kimlik numarası, okul adı ve fotoğraf istenmez. Çocuk modu kullanılacaksa ebeveyn, çocuk için 4 haneli bir çocuk PIN'i belirler; PIN sunucuda yalnızca özet (hash) olarak saklanır.
- **Çocuk modu.** Çocuk, kendi görevlerini görür ve tamamlandı olarak işaretler; bu işlem yalnızca görev durumunu, zamanını ve hangi çocuk profiline ait olduğunu kaydeder. Çocuk modu iki şekilde çalışır: (1) **Eşleştirilmiş tablet:** ebeveyn hesabından üretilen 6 haneli, tek kullanımlık ve kısa süreli bir cihaz eşleştirme koduyla eşleştirilir; tabletteki oturum anonimdir, yalnızca seçilen çocuk profillerine sınırlı yetkiyle erişir ve tablete e-posta veya şifre girilmez. Eşleştirmeyi Ayarlar > Çocuklar > [Çocuk] > Cihazlar'dan iptal ettiğinizde iptal anında etkili olur; her istek sunucuda yeniden denetlenir. (2) **Ebeveyn telefonunda çocuk modu:** ebeveyn oturumu içinde kısıtlı bir görünümdür; çocuk 4 haneli çocuk PIN'i ile girer, ebeveyn alanına dönüş 4 haneli ebeveyn PIN'i ister. Her iki durumda çocuk modundan satın alma, ayarlar, yapay zekâ, dış bağlantılar, hesap silme ve diğer çocukların verilerine erişilemez. Çocuk modunun ilk açılışında çocuğa yaşına uygun kısa bir bilgilendirme gösterilir ([Çocuk Modu Bilgilendirmesi](./cocuk-modu-bilgilendirme.md)); ebeveynin bunu çocukla birlikte okumasını öneririz.
- **Yapay zekâ ve reklam yok.** Çocuklar yapay zekâ ile etkileşmez; çocuklara reklam gösterilmez; çocuk verileri pazarlama için kullanılmaz.
- **Aileye davet.** Aile davet koduyla aileye yalnızca 18 yaşını doldurmuş diğer ebeveyn/vasiler katılabilir; katılan her yetişkin kendi hesabını açar, Veli Beyanı'nı kendisi onaylar ve ailenin çocuk profillerini ve kayıtlarını görür. Davet kodu süreli olup yalnızca aileye katılım içindir; cihaz eşleştirmede kullanılamaz ve ücretli özellik açmaz. Kodu yalnızca çocuğun diğer ebeveyni/vasisiyle paylaşın; kodu yenilemek ve aile üyelerini yönetmek için Ayarlar > Aile'yi kullanabilirsiniz.
- **Ebeveyn kontrolü.** Ebeveyn, çocuk profilindeki tüm verileri her zaman görebilir, düzeltebilir ve silebilir; çocuk adına KVKK haklarını veli veya vasi kullanır (Bölüm 12).
- **Çocuğun büyümesi.** Çocuğunuz 18 yaşını doldurduğunda velayet sona erer ve çocuk verileri üzerindeki temsil yetkiniz biter. Yalnızca doğum yılını bildiğimiz için 18. yaş gününü bilemeyiz; profil, doğum yılına 18 eklenerek bulunan yılın 31 Aralık tarihinde kendiliğinden pasife alınır [AVUKAT/ÜRÜN KARARI: pasifleştirme kuralı; Veli Beyanı §11 ile aynı]. Pasife almadan [ÖN BİLDİRİM SÜRESİ, örn. 60 gün] önce ve pasife alındığında uygulama içi bildirim ve e-posta alırsınız; pasif profil salt okunur olur, çocuk modu ve eşleştirilmiş cihazlar kapanır, yeni yapay zekâ çıktısı üretilmez ve profil [SİLME SÜRESİ, örn. 90 gün] içinde silinir (Bölüm 10). Bu süre dolmadan profili kendiniz de silebilirsiniz; ilk sürümde profilin ayrı bir hesaba devri yoktur. Reşit olan çocuk, kimliğini doğrulayarak verilerinin silinmesini veya bir kopyasını [E-POSTA] üzerinden kendisi isteyebilir [AVUKAT: kimlik doğrulama yöntemi].
- **Diğer ülkeler.** 13 yaşından küçük (ABD) veya ülkeye göre 13–16 yaşından küçük (AB) çocuklardan bilerek doğrudan veri toplamayız; çocuk verilerini yalnızca velisinin hesabı üzerinden ve talimatıyla işleriz. Bir çocuğun bize doğrudan veri sağladığını öğrenirsek sileriz; lütfen [E-POSTA] adresine bildirin.

## 10. Saklama süreleri

| Veri | Saklama süresi |
|---|---|
| Hesap, aile ve çocuk profili verileri; görev, yıldız, takvim, not ve puan kayıtları; çocuk modu işlem kayıtları | Hesap silinene kadar. Sildiğinizde hemen silinir; yedeklerden en geç [30 GÜN] içinde temizlenir |
| Tek bir çocuk profili veya tek bir kayıt | Siz silene kadar; yedeklerden en geç [30 GÜN] içinde temizlenir |
| 18 yaşını dolduran çocuğun profili | Doğum yılına 18 eklenerek bulunan yılın 31 Aralık tarihinde pasife alınır [AVUKAT/ÜRÜN KARARI]; pasife alındıktan sonra [SİLME SÜRESİ, örn. 90 gün] içinde silinir; önceden ve süreç boyunca bildirim alırsınız (Bölüm 9; Veli Beyanı §11 ile aynı kural) |
| Yapay zekâ çıktıları (özet, ipuçları) | Gina'da 12 ay veya siz silene kadar; girdiler ve çıktılar Anthropic'te kural olarak 30 gün (kullanım politikası ihlali şüphesinde 2 yıla kadar) |
| Fotoğraftan takvim görüntüleri (Gina Pro) | Gina'da [ÜRÜN KARARI: işlem tamamlandığında silinir / [SÜRE]]; Anthropic'te kural olarak 30 gün |
| Bildirim belirteçleri ve eşleştirilmiş cihazlar | Çıkış yapana, bildirimi kapatana, eşleştirmeyi kaldırana, cihaz [90 GÜN] kullanılmayana veya hesap silinene kadar; iptal edilen eşleştirme anında geçersiz olur; geçersiz belirteçler [90 GÜN] içinde temizlenir |
| E-posta adresi (yalnızca silme bildirimi için) | Silme talebinizin alındığını ve tamamlandığını bildirmek için silme tamamlanana kadar; ardından silinir |
| Satın alma ve abonelik doğrulama kayıtları (işlem kimliği, paket, tarih) | Hesap silindikten sonra da vergi ve ticaret mevzuatı gereği [10 YIL] |
| Rıza, izin ve beyan kayıtları | Rızanın sona ermesinden veya hesabın silinmesinden itibaren takma kimlikle [3 YIL] (ispat; kayıt çocuğun adını içermez) [AVUKAT: zamanaşımı] |
| Apple ile Giriş belirtecinin iptal edildiğine ilişkin kayıt | [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] (Apple'ın iptal şartının yerine getirildiğinin ispatı) [AVUKAT] |
| Güvenlik ve sunucu günlükleri (IP, zaman damgası) | [12 AY] [AVUKAT: 5651 sayılı Kanun trafik verisi yükümlülüğü] |
| Destek yazışmaları; KVKK başvuru, hesap silme talebi ve veri ihlali kayıtları | [3 YIL] |

Süre dolduğunda verileri sileriz, yok ederiz veya anonim hâle getiririz; periyodik imha en geç altı ayda bir otomatik çalışır. Süreler, saklama ve imha politikamız, Hesap ve Veri Silme sayfası ile mağaza beyanlarımızda aynıdır.

## 11. Hesabınızı ve verilerinizi silme

- **Uygulama içinden:** Ayarlar > Hesap > Hesabı Sil. Hesap askıya alınmaz, tamamen silinir ve geri getirilemez. Tek bir çocuk profilini Ayarlar > Çocuklar > [Çocuk] > Profili Sil ile, tek tek görev, not ve özetleri ilgili ekranlardan silebilirsiniz.
- **Web üzerinden:** Giriş yapamıyorsanız [Hesap ve Veri Silme](./hesap-ve-veri-silme.md) sayfasından kayıtlı e-posta adresinizi doğrulayarak talep gönderebilirsiniz.
- **Hemen veya dönem sonunda:** Hesabınızı hemen silebilir ya da etkin bir aboneliğiniz varsa silmeyi geçerli abonelik döneminin sonuna planlayabilirsiniz; planlı silmeyi o tarihe kadar aynı ekrandan iptal edebilirsiniz. Hemen silme seçeneği her zaman vardır.
- **Silinenler:** Aile, ebeveyn hesabı, çocuk profilleri, görev ve yıldız geçmişi, takvim, notlar, puanlar, yapay zekâ çıktıları, bildirim belirteçleri, eşleştirilmiş cihazlar (eşleştirmeler anında geçersiz olur) ve Apple/Google giriş bağlantıları (Apple ile Giriş belirteçlerinin iptali dâhil).
- **Ailede başka ebeveyn/vasi varsa:** [ÜRÜN KARARI — avukat görüşüyle: (a) yalnızca sizin hesabınız ve aile üyeliğiniz silinir; aile, çocuk profilleri ve veriler diğer ebeveynde kalır; (b) son ebeveyn hesabı silindiğinde aile ve tüm çocuk profilleri silinir]. Silme ekranı geçerli durumu gösterir.
- **Yasal nedenlerle sınırlı süre tutulanlar:** Satın alma doğrulama kayıtları ([10 YIL], vergi mevzuatı), rıza, izin ve beyan kayıtları ([3 YIL], ispat, takma kimlikle), Apple ile Giriş belirteç iptal kaydı ([APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ]), güvenlik günlükleri ([12 AY]), silme talebinizin kaydı ([3 YIL]) ve devam eden bir hukuki uyuşmazlık veya resmi talep kapsamındaki veriler; erişimi kısıtlı ve mümkün olduğunda kimliksizleştirilmiş tutulur.
- **Süre ve bilgilendirme:** Silme en geç 30 gün içinde tamamlanır; yedekler [30 GÜN] içinde, Anthropic'teki girdiler kural olarak 30 gün içinde silinir. Silme talebinizi aldığımızda ve tamamladığımızda e-posta ile bilgilendiririz; bu amaçla e-posta adresiniz silme tamamlanana kadar tutulur ve ardından silinir.
- **Abonelik uyarısı:** Hesabınızı silmek mağaza aboneliğinizi iptal etmez. Önce App Store veya Google Play'den aboneliğinizi iptal edin; aksi hâlde mağaza faturalandırmaya devam edebilir. Silme ekranında etkin abonelik uyarısı ve mağazanın iptal bağlantısı gösterilir.
- **Veri kopyası:** Uygulamada toplu veri dışa aktarma özelliği yoktur; silmeden önce verilerinizin bir kopyasını KVKK başvurusuyla (Bölüm 12) isteyebilirsiniz.

## 12. Haklarınız ve rızanızı geri alma

KVKK m.11 kapsamında; kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, düzeltme ve silmenin aktarıldığı üçüncü kişilere bildirilmesini isteme, yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme haklarına sahipsiniz.

**Nasıl kullanırsınız:** Ayarlar > Gizlilik ve Yasal > KVKK Başvurusu; sistemimizde kayıtlı e-postanızdan [E-POSTA] adresine; [KEP ADRESİ] KEP adresine veya [ADRES] adresine yazılı olarak ([KVKK Başvuru Formu](./kvkk-basvuru-formu.md)); telefonla başvuru kanalı yoktur. Kimlik doğrulaması için ek bilgi isteyebiliriz; çocuk adına yalnızca veli veya vasi başvurabilir. Uygulamada toplu dışa aktarma özelliği bulunmaz; verilerinizin bir kopyasını bu başvuruyla isteyebilirsiniz. Başvurunuzu en geç 30 gün içinde ücretsiz sonuçlandırırız. Reddedilirse, yanıtı yetersiz bulursanız veya süresinde yanıt verilmezse, yanıtı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvurudan itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyet edebilirsiniz.

**Rızanızı ve izinlerinizi geri alma:** Yapay zekâ özellikleri iznini (ve varsa yurt dışına aktarım açık rızanızı) Ayarlar > Yapay Zekâ Özeti'nden veya Ayarlar > Gizlilik ve Yasal > Rızalarım'dan, pazarlama onayını (ileride sunulursa) iletideki bağlantıdan veya Ayarlar > Bildirimler'den, bildirim iznini cihaz ayarlarından her zaman geri alabilirsiniz. Geri alma, önceki işlemeleri etkilemez; ilgili özellik derhal kapanır.

**AEA ve Birleşik Krallık'taki kullanıcılar:** Gina ilk olarak Türkiye'de sunulmaktadır. Avrupa Ekonomik Alanı veya Birleşik Krallık'ta bulunuyorsanız GDPR/UK GDPR kapsamında erişim, düzeltme, silme, işlemenin kısıtlanması, veri taşınabilirliği, itiraz ve denetim makamına şikâyet haklarına sahipsiniz; dayanaklarımız GDPR m.6/1-b (sözleşme), m.6/1-f (meşru menfaat) ve m.6/1-a (rıza)'dır. [AB TEMSİLCİSİ — GDPR m.27 gerekiyorsa]. Diğer ülkelerdeki kullanıcıların yerel haklarını saklı tutarız; bu bölüm Gina o bölgelerde satışa sunulmadan önce genişletilecektir.

## 13. Güvenlik

- İletimde şifreleme (TLS/HTTPS) ve sunucuda şifreli depolama.
- Satır düzeyinde erişim kontrolü (Row Level Security): her aile yalnızca kendi verilerine erişir; çocuk oturumları yalnızca ebeveynin eşleştirdiği cihazda, sınırlı yetkiyle çalışır ve ebeveyn tarafından iptal edilebilir; iptal anında etkilidir ve her istekte denetlenir.
- Şifreler ile 4 haneli ebeveyn ve çocuk PIN'leri yalnızca özet (hash) olarak saklanır; ebeveyn alanı ebeveyn PIN'i ile korunur (biyometrik kilit sonraki sürümlerde eklenebilir; biyometrik veriler cihazınızda kalır).
- Yönetici erişimi en az yetki ilkesiyle sınırlı, çok faktörlü doğrulamalı ve kayıt altındadır; yönetim paneli ayrıca e-posta doğrulamalı ayrı bir erişim katmanının arkasındadır; verilerinize yalnızca destek ve güvenlik amacıyla erişilir. [YAYIN ÖNCESİ TEYİT: Supabase hesabında çok faktörlü doğrulama ve erişim günlüğü açılmadan bu cümle yayımlanmaz]
- Yedekler aynı bölgede ve şifreli tutulur; sağlayıcılarla veri işleme sözleşmeleri yapılır.
- **Veri ihlali:** Bir ihlal öğrendiğimizde en geç 72 saat içinde Kişisel Verileri Koruma Kurulu'na bildirir, etkilenen kullanıcıları e-posta, uygulama içi bildirim veya web duyurusuyla en kısa sürede bilgilendiririz.

Hiçbir sistem yüzde yüz güvenli değildir; güçlü şifre ve cihaz kilidi kullanmanızı, ebeveyn PIN'inizi çocuklarla paylaşmamanızı ve telefon kilidinizden farklı seçmenizi öneririz.

## 14. Bildirimler ve cihaz izinleri

- **Bildirimler:** Görev onayı, hatırlatma, abonelik ve güvenlik bildirimleri gönderebiliriz. İçerikleri kişisel veri içermez (örneğin "Onay bekleyen bir görev var") ve Expo üzerinden Apple ve Google servislerine iletilir. Bildirimleri uygulamada Ayarlar > Bildirimler'den tür bazında; cihazda iOS için Ayarlar > Bildirimler > Gina, Android için Ayarlar > Uygulamalar > Gina > Bildirimler yolundan kapatabilirsiniz.
- **Pazarlama bildirimi** ilk sürümde yoktur; ileride yalnızca ayrı onayınızla ve İYS kaydıyla, e-posta veya uygulama bildirimi olarak gönderilir (SMS yoktur).
- **Cihaz izinleri:** Gina ilk sürümde yalnızca bildirim izni ister. Gina Pro'daki fotoğraftan takvim özelliğini kullandığınızda, yalnızca o işlem için kamera izni (fotoğraf çekerseniz) veya sistemin fotoğraf seçicisi kullanılır; fotoğraf kütüphaneniz taranmaz, yalnızca seçtiğiniz görüntü iletilir. Tablet eşleştirme 6 haneli kodla yapılır; kamera gerekmez. Konum, kişiler ve mikrofon izinleri istenmez. İzinleri cihaz ayarlarından değiştirebilirsiniz; bildirim veya kamera iznini reddetmek Gina'yı kullanmanızı engellemez.
- **Biyometri:** Biyometrik kilit sunulduğunda yüz veya parmak izi doğrulaması cihazınızın işletim sistemince yapılır; biyometrik veriler bize iletilmez.

## 15. Abonelikler ve satın almalar

Paketler: Gina Başlangıç (ücretsiz; en fazla 2 çocuk profili), Gina Plus (en fazla 4) ve Gina Pro (en fazla 8). Ücretsiz paket yapay zekâ özelliği içermez; ücretli paketler ek özellikler ve daha yüksek limitler sunar; paket içerikleri ve fiyatlar satın alma ekranında ve Abonelik Koşulları'nda gösterilir. Satın almalar yalnızca Apple App Store (uygulama içi satın alma) ve Google Play (Play faturalandırma) üzerinden yapılır; web üzerinden satın alma yapılmaz, web uygulaması ve eşleştirilmiş cihazlar ailenin aboneliğini yalnızca yansıtır. Satıcı ve fatura düzenleyen Apple Distribution International Ltd. veya Google Commerce Ltd.'dir; kart bilgilerinizi hiçbir zaman görmeyiz. Mağazadan bize yalnızca işlem kimliği, paket kimliği, abonelik durumu ve yenileme tarihi, mağaza ülkesi ve para birimi ile varsa kullanılan teklif/promosyon kodu bilgisi gelir.

- **Otomatik yenileme:** Abonelikler, dönem bitiminden önce iptal edilmedikçe aynı süre ve fiyatla yenilenir.
- **İptal:** App Store'da Ayarlar > [Adınız] > Abonelikler, Google Play'de Ödemeler ve abonelikler > Abonelikler yolundan; dönem sonunda etkili olur. Uygulamadaki Ayarlar > Abonelik ekranı sizi mağazaya yönlendirir.
- **İade:** Mağazanın iade politikasına göre Apple veya Google üzerinden yapılır; iade için mağaza nezdinde size destek oluruz.
- **Fiyat değişiklikleri:** Satın aldığınız mağazanın kuralları çerçevesinde önceden bildirilir; mağaza kurallarının ötesinde ayrı bir bildirim süresi taahhüt etmiyoruz. Mağaza kurallarının onayınızı gerektirdiği artışlarda onay vermezseniz yeni fiyat uygulanmaz ve abonelik dönem sonunda sona erer; diğer artışlarda yeni fiyatı istemiyorsanız dönem bitiminden önce iptal edebilirsiniz.
- **Ücretsiz deneme ve kupon kodları:** Ücretli paketlerde 7 günlük ücretsiz deneme sunulur; deneme bitmeden iptal edilmezse abonelik ücreti alınır. Kupon ve teklif kodları yalnızca Apple ve Google'ın kampanya kodu sistemleri üzerinden çalışır; uygulama içinde başka bir kod girişi yoktur.
- **Aile ve mağaza aile grupları:** Gina'daki "aile", Apple Aile Paylaşımı ve Google Play aile grubundan bağımsızdır; abonelik Gina aile hesabına bağlıdır ve davetle katılan ebeveynler ile eşleştirilmiş cihazlar ondan yararlanır. Mağaza aile paylaşımıyla abonelik paylaşımı [ÜRÜN KARARI: v1'de sunulmaz / sunulur].
- **Yapay zekâ izni ve paket:** Ücretli paketlerdeki yapay zekâ özellikleri ayrıca Bölüm 5'teki izninize bağlıdır; izin vermezseniz paketin diğer özellikleri çalışır, yalnızca yapay zekâ özellikleri kapalı kalır. Bu bilgi satın alma ekranında da gösterilir; iade talepleri mağaza politikasına tabidir.
- **Tüketici bilgilendirmesi:** Dijital içerik ve anında ifa edilen hizmetlerde, ifaya başlandıktan sonra 14 günlük cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15). Satın alma öncesi ayrıntılı bilgiler, şikâyet kanalları ve Tüketici Hakem Heyeti/Tüketici Mahkemesi bilgileri [Abonelik Koşulları](./abonelik-kosullari-ve-on-bilgilendirme.md) belgesindedir.

## 16. Web uygulaması ve çerezler

Gina web uygulaması ve sitesi Cloudflare üzerinde barındırılır; Cloudflare ağ güvenliği için IP adresinizi ve istek bilgilerini kısa süreli işler (ağ günlüklerini saklama süresi: [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ]). Web'de yalnızca zorunlu çerezler ve yerel depolama ögeleri (oturum, dil ve bölge tercihi; varsa Cloudflare güvenlik çerezleri) kullanılır; analitik veya reklam çerezi yoktur, bu nedenle çerez bandı gösterilmez. Rıza gerektiren bir çerez eklenirse önce onayınızı isteriz. Mobil uygulamada çerez kullanılmaz. Ayrıntılar: [Çerez Politikası](./cerez-politikasi.md).

## 17. Politika değişiklikleri

Politika'yı mevzuat, sağlayıcılarımız veya özelliklerimiz değiştikçe güncelleriz; sürüm numarası ve yürürlük tarihi sayfanın başındadır. Yeni bir işleme amacı, yeni bir alıcı veya ülke ya da çocuk verilerini etkileyen önemli değişiklikleri, yürürlüğe girmeden en az [15 GÜN] önce uygulama içi bildirim ve kayıtlı e-postanıza mesajla duyururuz; açık rıza veya izin gerektiren değişiklikler için rızanızı yeniden isteriz. Küçük düzeltmeler yalnızca bu sayfada yayımlanır. Önceki sürümleri [E-POSTA] adresinden isteyebilirsiniz.

## 18. İletişim

- Gizlilik ve destek: [E-POSTA]
- Posta: [ADRES] · KEP: [KEP ADRESİ]
- Telefon kanalı yoktur.
- Hesap ve veri silme (Privacy Choices): [Hesap ve Veri Silme](./hesap-ve-veri-silme.md) — [WEB SİTESİ ADRESİ]/legal/hesap-ve-veri-silme
- KVKK başvurusu: [KVKK Başvuru Formu](./kvkk-basvuru-formu.md) — [WEB SİTESİ ADRESİ]/legal/kvkk-basvuru-formu
- Bu Politika'nın sabit adresi: [WEB SİTESİ ADRESİ]/legal/gizlilik-politikasi
- Kişisel Verileri Koruma Kurumu: [kvkk.gov.tr](https://www.kvkk.gov.tr)

## Değişiklik geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.1 | 2026-10-29 | İlk taslak (avukat incelemesi bekliyor) |
| 0.2 | 2026-10-30 | İnceleme notları ve DECISIONS.md uygulandı. Yapay zekâ için hukuki sebep "seçilen paketin ifası (m.5/2-c) + Kurul standart sözleşmesi (m.9/4-c) ve ayrı, varsayılan kapalı, geri alınabilir özellik izni; standart sözleşme sağlanana kadar açık rıza (m.9/6-a)" olarak tekleştirildi; çocuk verisi "doğum yılı"; Anthropic'te kural olarak 30 gün, ihlal şüphesinde 2 yıla kadar ve 30 günlük saklamanın zorunlu olduğu; çıktıların Gina'da 12 ay saklanması (DECISIONS; inceleme notundaki 6 ay uygulanmadı); Supabase'in Singapur merkezi ve Frankfurt dışından destek erişimi; AB Standart Sözleşme Hükümleri'nin KVKK m.9 güvencesi sayılmadığı; sağlayıcı türüne göre aktarım yolu (temel sağlayıcılar için açık rıza yolu yok); Expo EAS Update ibaresi kaldırıldı; çocuk modu işlem kayıtları (Usage Data), zorunlu/isteğe bağlı veriler ve tablet kimliğinin paylaşılmadığı; PIN'ler, 6 haneli eşleştirme ve anında iptal, veli telefonunda çocuk modu; davet kodunun yalnızca 18+ ebeveyn/vasi için olması; Gina Pro ipuçları ve ayrı izinli fotoğraftan takvim; paketler 2/4/8 çocuk, 7 günlük deneme, web'de satın alma yok; mağaza hedef kitlesi (18+ ebeveyn); silme bildirimi için e-posta tutma, hemen/dönem sonuna planlı silme, çoklu ebeveynde silme [ÜRÜN KARARI], 18 yaş kuralı, dışa aktarma özelliğinin olmaması; fiyat değişikliğinde yalnızca mağaza kurallarına atıf (30 gün taahhüdü yok); iadede mağaza nezdinde destek; telefon ve SMS kanalı yok; yönetici MFA cümlesine yayın öncesi teyit işareti; bağlantılar /legal slug'larıyla hizalandı; İngilizce sürüm paralel güncellendi. Avukat incelemesi bekliyor. |
| 0.2 | 2026-10-30 | Belge seti tutarlılık kontrolü: §6 ve §9'daki "yetkili yetişkinler" ifadesi, Aydınlatma §2 ve Kullanım Koşulları §4.4 ile aynı biçimde "yalnızca çocuğun diğer ebeveyni/vasisi" yapıldı (TR ve EN). |

---

# Gina Privacy Policy (English)

**Version:** 0.2 (draft) · **Draft date:** 30 October 2026 · **Effective date:** [YÜRÜRLÜK TARİHİ]

> Draft; legal review recommended before publication. This English version is for information only; the Turkish text above is binding. Placeholders in square brackets are shared with the Turkish text.

## Summary

- Gina is a family app in which parents track their children's chores, calendar, notes and school records. Only a parent or guardian aged 18 or over can open an account; the app is listed on the stores as an app for adult parents. Child profiles are created by the parent with only a name or nickname and a birth year, and we never take sign-ups from children.
- No third-party analytics, advertising or tracking; no ads; we never sell your data.
- Data is stored in Germany (Frankfurt); US-based providers handle notification delivery, web hosting and the optional AI features.
- AI features (weekly family summary; on Gina Pro also tips and photo-to-calendar) run only on paid plans, only if you turn them on, only in the parent area, with pseudonymised data. The permission is off by default, can be withdrawn at any time, and declining it does not affect the rest of your plan. Children never interact with AI.
- Payments go through the Apple App Store and Google Play; we never see your card details.
- You can delete your account and all data at any time, in the app or on the web.

## 1. Scope

This Policy covers the iOS and Android apps, the web app and the website at [WEB SİTESİ ADRESİ], offered under the name "Gina" (listed on the stores as "Gina Aile") by [VERİ SORUMLUSU UNVANI] ("we"). It is specific to Gina; Apple, Google and other third parties process data under their own policies. Read it together with our KVKK Privacy Notice (Turkish), which fulfils our information duty under Turkey's Personal Data Protection Law No. 6698 ("KVKK"). Reading the notice is not consent; where explicit consent or a separate permission is required we ask with a separate, unticked box, and no such consent is a condition of registering, signing in or purchasing. Related documents (Consent Texts, Parent Declaration, Terms of Use, Subscription Terms, Cookie Policy, Account and Data Deletion, Data Subject Request Form) are linked in the Turkish section.

## 2. Data controller and developer

[VERİ SORUMLUSU UNVANI] · [ADRES] · email [E-POSTA] · registered e-mail (KEP) [KEP ADRESİ] · tax/ID number [VKN/TCKN] · MERSİS [MERSİS]. There is no telephone channel; contact us by email, KEP or post.

## 3. Data we collect

All of this data is linked to your account; none is used for tracking or advertising. Store categories are those declared in Apple's App Privacy labels and Google Play's Data safety section.

| Data type | Examples and source | Apple / Google category |
|---|---|---|
| Account data (parent) | Email, optional name, password (hash only), Sign in with Apple/Google identifier, language, region and time zone, 4-digit parent PIN (hash only) [TECHNICAL CHECK: whether the parent PIN is stored on the server or the device]; from you or Apple/Google | Contact Info, Identifiers / Personal info |
| Family and child profile | Family name, family invite code, child's name or nickname, birth year (no date of birth), optional grade level, preset avatar (not a photo), 4-digit child PIN for child mode (hash only); entered by you for your child | User Content / App activity |
| Usage content | Chores and completion, stars and rewards, calendar and class schedule, notes, school grades, development notes; from you (your child only ticks chores in child mode) | User Content / App activity |
| Child mode and paired device activity | Time of a "done" tick in child mode and the child profile it belongs to, pairing and unpairing times, last use of a paired-device session; automatic | Usage Data (Product Interaction) / App activity (App interactions) |
| AI feature data | Pseudonymised chore and calendar statistics and the locale used for the output language (input), generated summary and tips (output); paid plans, with your permission | User Content / App activity |
| Photo to calendar (Gina Pro only, optional, separate permission) | A document photo you take or pick (class schedule, school calendar) and the calendar entries extracted from it | User Content (Photos or Videos) / Photos and videos |
| Device and notification data | Push token, device type and OS version, app version, paired tablet identifier (random ID generated by the app, only if you pair a device); automatic | Identifiers / Device or other IDs |
| Purchase and subscription data | Store transaction ID, plan ID, subscription status and renewal date, store country and currency, store offer/promo code used; from Apple/Google | Purchases / Financial info |
| Security and server logs | IP address, timestamp, request type, errors; automatic | Diagnostics / App info and performance |
| Consent, permission and declaration records | Accepted text version, language, timestamp, user ID [and, subject to legal advice, hashed IP / app instance ID] | Other data / Personal info (other) |
| Support correspondence | Email address, message content, attachments | Contact Info, User Content / Personal info |

**Required and optional:** email and password (or Apple/Google sign-in) for the account, and a name or nickname plus birth year for a child profile, are required. Name, grade level, avatar, device pairing, child and parent PINs (only if child mode is used), AI features, photo-to-calendar and support messages are optional. Security logs and consent records are kept automatically for operation and legal proof. **Data that reaches third parties:** only the recipients in Section 6, within the scope stated there: push token (Expo, Apple, Google), purchase data (Apple/Google) and, with your permission, AI inputs (Anthropic). The paired tablet identifier is a random ID generated by the app (not an advertising ID or hardware serial), exists only if you pair a device and is never shared with any third party.

**Not collected:** location (no location permission; IP only in security logs), phone number, contacts, camera or photo library scanning (only in Gina Pro's optional photo-to-calendar feature, when you choose to, a single document photo is sent), microphone, health data, national ID numbers, card or bank details, advertising identifiers (IDFA/AAID), browsing or search history. Please do not enter health or other sensitive information in free-text fields; they are never sent to the AI provider.

## 4. Purposes and legal bases (KVKK)

Account, sign-in, security, support and the emails confirming receipt and completion of a deletion request: performance of the contract (Art. 5/2-c) and legitimate interest (Art. 5/2-f, protecting your account against unauthorised access). Family and child profiles, chores, calendar, notes, grades, child-mode activity, child mode and paired tablet: performance of the contract with the parent, plus the Parent Declaration for child data [LAWYER: whether separate explicit parental consent is required]. Notifications: contract and legitimate interest (account and device security alerts), with permission granted on your device. AI features (weekly summary, tips, photo-to-calendar): processing rests on performance of the paid plan you chose (Art. 5/2-c); the transfer abroad rests on the Board's standard contract (Art. 9/4-c) together with your separate, off-by-default and revocable feature permission, which is taken as explicit consent (Art. 9/6-a) until a standard contract with Anthropic is in place — see Sections 5 and 8. Subscription management and billing records: contract and legal obligation (Art. 5/2-ç). Security and abuse prevention: legitimate interest (protecting systems and user data). Keeping consent, permission and declaration records as proof: legal obligation (Art. 5/2-ç; the burden of proof is ours) and establishment and protection of rights (Art. 5/2-e). Legal obligations and protection of rights: Art. 5/2-ç and 5/2-e. Marketing (not in the first release; email or push only, no SMS): only with separate consent and registration in Turkey's Message Management System (İYS). We do not use data for other purposes, do not sell or rent it, do not profile you, and do not make decisions that significantly affect you or your child by automated means alone.

## 5. AI features: weekly family summary, tips and photo-to-calendar

On Gina Plus and Gina Pro, once a week, Gina produces a short summary and suggestions from your family's chore and calendar data (weekly family summary). Gina Pro adds 7-day tips and "photo to calendar", which extracts calendar entries from a photo of a document such as a class schedule or school calendar (up to 20 photos a month). Everything is shown only in the parent area; the free plan (Gina Başlangıç) has no AI. The features are off by default: before you turn them on we explain that data goes to a provider in the United States, is normally kept there for 30 days, and the possible risks (Section 8), and we ask for your permission with a separate, unticked box. The permission is not a condition of registering, signing in or purchasing; if you decline or withdraw it, only the AI features stay off and the rest of your plan keeps working. Withdraw with one tap in Settings > AI Summary; no new data is sent afterwards. The parent who granted the permission is recorded, the other parents in the family are told in-app that the feature was switched on, and any parent can switch it off. For your child we send only a nickname or first name (or a label such as "Child A"), an age range derived from the birth year, and chore, star and calendar statistics; never surname, date or year of birth, school name, photos, free-text notes, grade details or development notes. Of your own data only the locale for the output language is sent; your name, email, family name and device identifiers are not. Requests go through Gina's servers; the provider does not communicate with your device directly [TECHNICAL CHECK]. **Photo-to-calendar (Gina Pro) needs its own permission:** the weekly-summary permission does not cover photos; only the document photo you take or pick is sent, and if it shows your child's name or school, that is transmitted too, so we suggest photographing only the schedule part and never uploading photos of people or documents with personal details [PRODUCT DECISION / TECHNICAL CHECK: on-device pre-processing and whether the photo is stored in Gina]. The provider is Anthropic, PBC (USA, Claude models; the model may vary by plan). Under its commercial terms Anthropic does not train on your data and may use its own cloud sub-processors. Inputs and outputs are normally kept for 30 days and then deleted; for the models we use this 30-day retention is mandatory, no shorter or zero-retention option exists and we cannot shorten it. Content flagged as a suspected usage-policy violation may be kept by Anthropic for up to 2 years for safety review and may be seen by a human. If the provider changes we update this Policy and ask for your permission again for the new provider; if the retention changes this Policy is updated. Children never interact with AI. Outputs are suggestions that can be wrong; check the records in the app and the source document before relying on them, and every output carries this warning. They are not medical, psychological, educational or legal advice, do not diagnose or label your child, and produce no automated decision with legal effect on you. Summaries and tips are kept in your account for 12 months, can be deleted at any time and are deleted with the child profile or account; the photo sent for photo-to-calendar is [ÜRÜN KARARI: deleted once processed / kept for [SÜRE]], and the extracted calendar entries are kept like your other calendar entries.

## 6. Who we share data with

We do not sell personal data. The providers below process data only on our instructions and under written data processing agreements that protect your data at least to the standard promised here; we do not work with providers that cannot offer the same level of protection.

| Provider | Role and data | Location |
|---|---|---|
| Supabase Pte. Ltd. (Singapore); sub-processor Amazon Web Services | Database, authentication, storage, server functions; all account, family and child data | Frankfurt, Germany (EU, eu-central-1), backups included; Supabase support and operations staff may access systems remotely from outside Frankfurt (including Singapore) under the data processing agreement and only when needed (Section 8) |
| Anthropic, PBC (USA) | AI features; pseudonymised statistics and locale, and on Gina Pro, with a separate permission, the document photo you pick; paid plans with permission only | USA; normally deleted within 30 days (content flagged for a suspected usage-policy violation may be kept up to 2 years) |
| 650 Industries, Inc. ("Expo") (USA) | Relaying notifications to Apple and Google; push token, device OS, notification text without personal data | USA; content held in memory only while relayed |
| Cloudflare, Inc. (USA) | Web hosting and network security; IP address, browser data, network logs (web only) | USA and global network; network log retention [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ] |
| Apple Inc. (USA) and Apple Distribution International Ltd. (Ireland) | App Store, in-app purchases, Sign in with Apple, APNs; purchase transactions, sign-in identifier and email (relay address if hidden), push token | Independent controller ([Apple Privacy Policy](https://www.apple.com/legal/privacy/)) |
| Google LLC (USA) and Google Commerce Ltd. (Ireland) | Google Play, Play billing, Google Sign-In, FCM for Android notifications (no Firebase SDK in the app); purchase transactions, sign-in identifier and email, push token | Independent controller ([Google Privacy Policy](https://policies.google.com/privacy)) |
| [E-POSTA GÖNDERİM SAĞLAYICISI] ([ÜLKE]) | Verification, password reset and transactional emails; email address and content | [ÜLKE] |
| Other parents/guardians you invite to your family | Shared use of the family's child profiles and records | Access from their own account; share the invite code only with the child's other parent or guardian (Section 9) |
| Public authorities and courts | Legal obligation or official request; only the data requested | Turkey |

Otherwise we share data with no one unless you consent, the law requires it, or it is necessary to protect users, children or our rights. On a transfer or merger of Gina, data may pass to a successor bound by this Policy, with prior notice. Provider changes are announced by updating this Policy; if the AI provider changes we ask for your permission again.

## 7. Analytics, advertising and tracking

No third-party analytics, advertising or tracking SDKs (no Firebase Analytics, Crashlytics or similar); no ads and no sharing with ad networks or data brokers; never any ads to children; no advertising identifiers (IDFA, AAID) and no App Tracking Transparency request; no linking of your data with data from other apps or sites. We use only our own server logs for debugging, and they are not passed to third parties. There is no crash-reporting tool in the first release; if one is added it will carry no personal data, stay off in child mode, and this Policy will be updated.

## 8. International transfers

Data is stored in Germany, and US providers handle notifications, web hosting and the AI features (Section 6). Supabase is headquartered in Singapore; although your data is kept in Frankfurt, Supabase support and operations staff may access systems remotely from outside Frankfurt (including Singapore) under the data processing agreement and only when needed. Under KVKK any transfer outside Turkey, including to Germany, and any access from abroad is an international transfer. The Turkish Personal Data Protection Board has issued no adequacy decision for any country, so we rely on the safeguard in KVKK Article 9/4-c: we sign the Board's "controller to processor" standard contract with our providers and notify the Authority within five business days of signature (Art. 9/5); onward transfers by providers to their own sub-processors (for example Supabase to AWS, Anthropic to its cloud infrastructure) require the same safeguards (Art. 9/8). For the providers that make up the service itself (Supabase, Expo, Cloudflare, the email provider) the transfer rests on the standard contract alone, not on your separate consent, and we do not use the consent route for them, because consent cannot be made a condition of the service; if an appropriate safeguard cannot be obtained for one of them we do not transfer to that provider, and we replace it with a provider that offers one or put in place another safeguard accepted by the Board (Art. 9/4). [AKTARIM MEKANİZMASI DURUMU: signature and notification date per provider; lawyer decision for a provider that does not sign]. The transfer to the AI provider (Anthropic) is not a necessary part of the service: it happens only on paid plans and only if you turn the AI features on; the permission you give then is also your permission for the transfer abroad, is off by default and can be withdrawn in Settings at any time. Until a standard contract with Anthropic is signed and notified, this permission is taken as explicit consent given after information on the possible risks below (KVKK Art. 9/6-a); once the standard contract is in place the box remains a feature permission only and this Policy is updated. [LAWYER: defensibility of the explicit-consent route for a regular SaaS transfer given the "occasional" condition]. The data exchanged with Apple and Google for purchase verification, sign-in and notification delivery is part of those companies' own services as independent controllers (Section 6) [LAWYER: nature and basis of that exchange as an international transfer]. Provider agreements also include the EU Standard Contractual Clauses; these do not count as a transfer safeguard under KVKK Article 9 and are only an additional contractual measure. Transferred data is minimised, pseudonymised and encrypted. **Possible risks:** data protection rules abroad may differ, foreign public authorities may request access within their legal powers, exercising your rights abroad may be harder (you keep exercising them against us, and we pass your request to the recipient), recipients' own sub-processors carry the same risks, and we cannot shorten the AI provider's 30-day retention; the agreements and technical measures above reduce these risks.

## 9. Children's privacy

Gina is for parents and guardians aged 18 or over; children cannot open accounts, and we never ask a child for an email address, phone number, password or photo. Gina is listed on the App Store and Google Play as an app for parents aged 18 or over, is not in the Kids category and is not marketed to children; child mode is a restricted view used under parental supervision. The parent creates the child profile and declares that they are 18 or over and the child's parent or legal guardian (Parent Declaration); only a name or nickname and a birth year (no date of birth) are needed, grade level and a preset avatar are optional, and a surname, ID number, school name or photo is never requested. If child mode is used, the parent sets a 4-digit child PIN, stored only as a hash. In child mode the child sees only their own chores and marks them done, which records only the chore status, time and child profile. Child mode runs either on a paired tablet (paired with a 6-digit, single-use, short-lived device pairing code generated from the parent account; the tablet session is anonymous, limited to the selected child profiles, needs no email or password, and unpairing in Settings > Children > [Child] > Devices takes effect immediately and is checked on every request) or on the parent's phone (a restricted view inside the parent session; the child enters with the child PIN and returning to the parent area requires the 4-digit parent PIN). In both cases child mode cannot reach purchases, settings, AI, external links, account deletion or other children's data; when it first opens, the child sees a short age-appropriate notice. Children never interact with AI, are never shown ads, and their data is never used for marketing. Only other parents or guardians aged 18 or over can join a family with the family invite code; each joining adult opens their own account, accepts the Parent Declaration and sees the family's child profiles; the invite code is time-limited, only joins a family, cannot pair a device and unlocks no paid feature; renew it and manage members under Settings > Family. The parent can view, correct and delete all child data at any time and exercises the child's KVKK rights (Section 12). When a child turns 18, parental authority ends; since only the birth year is known, the profile is deactivated automatically on 31 December of the year found by adding 18 to the birth year [LAWYER/PRODUCT: deactivation rule, same as Parent Declaration §11], with in-app notice and email [ÖN BİLDİRİM SÜRESİ, e.g. 60 days] beforehand and on deactivation; a deactivated profile is read-only, child mode and paired devices stop, no new AI output is produced, and the profile is deleted within [SİLME SÜRESİ, e.g. 90 days] (Section 10). You may delete it yourself before then; there is no transfer of the profile to a separate account in the first release. The adult child may request deletion or a copy of their data at [E-POSTA] after identity verification [LAWYER: verification method]. We do not knowingly collect data directly from children under 13 (USA) or under 13–16 depending on the country (EU); if we learn that a child has provided data directly, we delete it (tell us at [E-POSTA]).

## 10. Retention periods

| Data | Retention |
|---|---|
| Account, family, child profile and usage data, child-mode activity; single profiles or records | Until you delete them or the account; cleared from backups within [30 GÜN] (days) |
| Profile of a child who has turned 18 | Deactivated on 31 December of the birth year plus 18 [LAWYER/PRODUCT] and deleted within [SİLME SÜRESİ, e.g. 90 days] of deactivation, with notice beforehand and throughout (Section 9; same rule as the Parent Declaration §11) |
| AI outputs (summaries, tips) | 12 months or until deleted; inputs and outputs at Anthropic normally 30 days (up to 2 years if flagged for a suspected usage-policy violation) |
| Photo-to-calendar images (Gina Pro) | [ÜRÜN KARARI: deleted once processed / [SÜRE]]; normally 30 days at Anthropic |
| Push tokens and paired devices | Until sign-out, notifications off, unpairing, [90 GÜN] (days) of device inactivity or account deletion; a revoked pairing is invalid immediately; invalid tokens cleared within [90 GÜN] (days) |
| Email address (deletion notices only) | Until deletion completes, to confirm receipt and completion of your request; then deleted |
| Purchase and subscription verification records | [10 YIL] (years) after account deletion, as required by tax and commercial law |
| Consent, permission and declaration records | [3 YIL] (years) from withdrawal or account deletion, pseudonymised (proof; the record holds no child's name) [LAWYER: limitation period] |
| Record that the Sign in with Apple token was revoked | [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] (proof that Apple's revocation requirement was met) [LAWYER] |
| Security and server logs | [12 AY] (months) [LAWYER: traffic-data duty under Law No. 5651] |
| Support, data subject request, deletion request and breach records | [3 YIL] (years) |

Expired data is deleted, destroyed or anonymised; periodic destruction runs automatically at least every six months. The periods match our retention and destruction policy, the Account and Data Deletion page and our store declarations.

## 11. Deleting your account and data

In the app: Settings > Account > Delete Account (full deletion, not suspension, and irreversible); single child profiles under Settings > Children > [Child] > Delete Profile; individual chores, notes and summaries from their screens. On the web: the Account and Data Deletion page, after verifying your registered email, if you cannot sign in. You can delete immediately or, if you have an active subscription, schedule deletion for the end of the current subscription period and cancel the schedule until then; immediate deletion is always available. Deletion covers the family, parent account, child profiles, chore and star history, calendar, notes, grades, AI outputs, push tokens, paired devices (pairings become invalid immediately) and Apple/Google sign-in links (including Sign in with Apple token revocation). If another parent or guardian is in the family: [PRODUCT DECISION, with legal advice: (a) only your account and family membership are deleted and the family, child profiles and data stay with the other parent; (b) when the last parent account is deleted, the family and all child profiles are deleted]; the deletion screen shows which applies. Kept for a limited time for legal reasons, with restricted access and de-identified where possible: purchase verification records ([10 YIL] years), consent, permission and declaration records ([3 YIL] years, pseudonymised), the Sign in with Apple revocation record ([APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ]), security logs ([12 AY] months), the record of your deletion request ([3 YIL] years) and data covered by an ongoing dispute or official request. Deletion completes within 30 days (backups within [30 GÜN] days, Anthropic inputs normally within 30 days). We email you when we receive your request and when deletion is complete; for this purpose your email address is kept until deletion completes and is then deleted. **Deleting your account does not cancel your store subscription:** cancel it first in the App Store or Google Play, or the store may keep billing you; the deletion screen shows an active-subscription warning and the store's cancellation link. There is no bulk data export feature; before deleting, you can request a copy of your data through a data subject request (Section 12).

## 12. Your rights and withdrawing consent

Under KVKK Article 11 you may learn whether your data is processed and request information; learn the purpose and whether data is used accordingly; know the recipients in Turkey and abroad; request correction, erasure or destruction and notification of these to recipients; object to a result against you produced solely by automated analysis; and claim compensation for unlawful processing. Use Settings > Privacy and Legal > Data Subject Request, email from your registered address to [E-POSTA], KEP to [KEP ADRESİ], or a letter to [ADRES] (Data Subject Request Form); there is no telephone channel. We may verify your identity; requests for a child are accepted only from the parent or guardian. There is no bulk export feature in the app; request a copy of your data this way. We answer within 30 days, free of charge; if refused, insufficient or late, you may complain to the Personal Data Protection Board within 30 days of the answer and in any case within 60 days of the request. You can withdraw the AI features permission (and any explicit consent to the transfer abroad) in Settings > AI Summary or Settings > Privacy and Legal > My Consents, marketing consent (if offered) via the message link or Settings > Notifications, and notification permission in device settings; withdrawal does not affect earlier processing and switches the feature off immediately.

**EEA and UK users:** Gina is launched first in Turkey. In the EEA or the United Kingdom you have the GDPR/UK GDPR rights of access, rectification, erasure, restriction, portability, objection and complaint to a supervisory authority; our legal bases are GDPR Article 6(1)(b), 6(1)(f) and 6(1)(a). [AB TEMSİLCİSİ — EU representative under GDPR Article 27, if required]. Users elsewhere keep their local rights; this section will be expanded before Gina is sold in those regions.

## 13. Security

Encryption in transit (TLS/HTTPS) and at rest; Row Level Security so each family reaches only its own data; child sessions limited to parent-paired devices with restricted permissions and parental revocation that takes effect immediately and is checked on every request; passwords and the 4-digit parent and child PINs stored only as hashes; parent area behind the parent PIN (a biometric lock may be added in a later release; biometric data stays on your device); least-privilege, multi-factor, logged administrative access, with the admin panel behind a separate email-verified access layer, used only for support and security [PRE-PUBLICATION CHECK: not published until multi-factor authentication and access logging are enabled on the Supabase account]; encrypted backups in the same region; data processing agreements with providers. **Breaches:** we notify the Personal Data Protection Board within 72 hours of learning of a breach and inform affected users as soon as possible by email, in-app notice or website announcement. No system is completely secure; use a strong password and device lock, do not share your parent PIN with children, and choose it differently from your phone lock.

## 14. Notifications and device permissions

We may send chore-approval, reminder, subscription and security notifications; their text contains no personal data (for example "A chore is waiting for approval") and is relayed via Expo to Apple and Google. Turn them off by type in Settings > Notifications, or on your device under iOS Settings > Notifications > Gina or Android Settings > Apps > Gina > Notifications. Marketing notifications are not in the first release and would require your separate consent and İYS registration (email or push only, no SMS). Gina requests only notification permission in the first release; when you use photo-to-calendar on Gina Pro, camera permission (if you take a photo) or the system photo picker is used for that action only, your photo library is not scanned and only the image you pick is sent. Tablet pairing uses a 6-digit code and needs no camera. Location, contacts and microphone permissions are not requested, and refusing notification or camera permission does not prevent use. When a biometric lock is offered, face or fingerprint checks run on your device; biometric data is never sent to us.

## 15. Subscriptions and purchases

Plans: Gina Başlangıç (free; up to 2 child profiles), Gina Plus (up to 4) and Gina Pro (up to 8). The free plan has no AI; paid plans add features and higher limits, as shown on the purchase screen and in the Subscription Terms. Purchases run only through the Apple App Store (in-app purchase) and Google Play (Play billing); there are no purchases on the web, and the web app and paired devices only reflect the family's subscription. The seller and invoicing party is Apple Distribution International Ltd. or Google Commerce Ltd., and we never see card details. The store passes us only the transaction ID, plan ID, subscription status and renewal date, store country and currency, and any offer or promo code used. Subscriptions renew automatically for the same period and price unless cancelled before the period ends; cancel in the App Store (Settings > your name > Subscriptions) or Google Play (Payments and subscriptions > Subscriptions), effective at the end of the period; Settings > Subscription in the app takes you there. Refunds follow the store's refund policy, and we support you with the store if you need one. Price changes are announced in advance under the rules of the store you bought from; we promise no notice period beyond the store's rules. Where store rules require your consent to an increase, the new price does not apply without it and the subscription ends at the end of the period; for other increases, cancel before the period ends if you do not want the new price. Paid plans come with a 7-day free trial, which is charged if not cancelled before it ends; coupon and offer codes work only through Apple's and Google's promotional code systems, and there is no other code entry in the app. The Gina "family" is independent of Apple Family Sharing and Google Play family groups: the subscription is tied to the Gina family account, and invited parents and paired devices benefit from it; sharing through the stores' family sharing is [PRODUCT DECISION: not offered in v1 / offered]. The AI features of paid plans also depend on the permission in Section 5; without it the rest of the plan works and only the AI features stay off; this is shown on the purchase screen, and refund requests follow store policy. For digital content and services performed immediately, the 14-day right of withdrawal cannot be exercised once performance has begun (Turkish Distance Contracts Regulation, Article 15); full pre-contractual information and complaint channels are in the Subscription Terms.

## 16. Web app and cookies

The web app and website run on Cloudflare, which processes your IP address and request data briefly for network security (network log retention: [CLOUDFLARE GÜNLÜK SAKLAMA SÜRESİ]). Only strictly necessary cookies and local storage (session, language and region, and Cloudflare security cookies where present) are used; there are no analytics or advertising cookies, so no banner is shown, and we will ask first if a cookie requiring consent is ever added. The mobile app uses no cookies. See the Cookie Policy.

## 17. Changes

We update this Policy as laws, providers or features change; the version and effective date are at the top. Material changes (a new purpose, recipient or country, or anything affecting children's data) are announced at least [15 GÜN] days before they take effect by in-app notice and email; where consent or a permission is required we ask again. Minor corrections appear on this page only. Earlier versions are available from [E-POSTA].

## 18. Contact

Privacy and support: [E-POSTA] · Postal address: [ADRES] · KEP: [KEP ADRESİ] · No telephone channel · Account and data deletion (Privacy Choices): Account and Data Deletion page, [WEB SİTESİ ADRESİ]/legal/hesap-ve-veri-silme · Data subject requests: Data Subject Request Form, [WEB SİTESİ ADRESİ]/legal/kvkk-basvuru-formu · This Policy's permanent address: [WEB SİTESİ ADRESİ]/legal/gizlilik-politikasi · Personal Data Protection Authority of Turkey: [kvkk.gov.tr](https://www.kvkk.gov.tr)

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 29 October 2026 | First draft (pending legal review) |
| 0.2 | 30 October 2026 | Review notes and DECISIONS.md applied: AI legal basis set to performance of the chosen plan plus the Board's standard contract (Art. 9/4-c) and a separate, off-by-default, revocable feature permission (explicit consent under Art. 9/6-a until the standard contract is in place); birth year only; Anthropic retention (normally 30 days, up to 2 years if flagged, 30-day retention mandatory); outputs kept 12 months (DECISIONS; the review's 6 months not applied); Supabase Singapore HQ and remote support access; EU SCCs noted as an additional measure only; transfer route per provider type (no consent route for core providers); EAS Update wording removed; child-mode activity records, required/optional data and the unshared tablet ID; PINs, 6-digit pairing with immediate revocation, child mode on the parent's phone; invite code for 18+ parents/guardians only; Gina Pro tips and photo-to-calendar with its own permission; plans with 2/4/8 children, 7-day trial, no web purchases; store audience (parents 18+); email kept for deletion notices, immediate or scheduled deletion, multi-parent deletion [PRODUCT DECISION], 18-year rule, no export feature; price changes by store rules only (no 30-day promise); refund support; no phone or SMS channel; pre-publication check mark on the admin MFA sentence; links aligned with the published slugs. Pending legal review. |
