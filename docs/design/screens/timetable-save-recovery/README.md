# Ders programı — kayıt kurtarma kabulü

4 Kasım 2026. Onaylı mevcut ders programı düzeni, maskotu, renkleri ve telefon/tablet yerleşimi korunur. Yeni ana menü veya ayrı sihirbaz yoktur. Belirsiz kayıt için aynı yüzeyde tek açıklama ve “Kaydı kontrol et” eylemi eklenir.

## Düzeltilen durum

Eski elle kaydetme çağrısında sunucu programı yazdıktan sonra yanıt kaybolursa, yeniden kayıt eski revizyonla çakışıyordu. İstek yalnız bellekteydi. Yeni istemci önce özgün kaydı cihazda saklar; 086000 aynı aktör/istek/içerik için kesin sunucu makbuzunu geri verir. Veli ve aktif çocuk cihazı desteklenir. Başka çocuk/aile, iptal edilmiş cihaz veya aileden ayrılmış veli eski makbuza da erişemez.

- Aynı kayıt ders veya takvim etkinliği çoğaltmaz.
- Belirsiz kayıt varken yeni düzenleme/aktarım durur; kullanıcı ayrılıp geri dönebilir. Ayrılmak kaydı silmez.
- Kesin çakışma yanıtında bekleyen işlem kaldırılır, düzenleme taslağı kalır; güncel programı yüklemek kullanıcıya aittir.
- Kurtarılan eski makbuz, daha sonra değiştirilmiş programı geri getirmez. Güncel sürüm yüklenir ve bu durum açıkça belirtilir.
- Cihazdaki kayıt kullanıcı/aile/çocuk kapsamlıdır; oturum kapanınca temizlenir. Yanlış makbuz, farklı çocuk veya farklı revizyon başarı sayılmaz.
- Çocuk takviminde program düğmesinin fazladan üçüncü tekrarı kaldırıldı; boş durum metni çocuğun yapamadığı etkinlik eklemeyi önermiyor. Üst gezinme ile boş günün bağlamsal program eylemi korunur.
- Kurulu eski istemci ve belge içe aktarma eski API ile çalışabilir; yeni wrapper aynı kilit/revizyon/doğrulama yolunu kullanır. Eski API geriye dönük kaldırılmadı.

## Ekran kanıtları

- [Telefon — bekleyen kayıt](pending-phone.png): gerçek Expo bileşeni, 390×844, çocuk rolü; tek açıklama, düzenleme kilidi, geri dönüş ve kayıt kontrolü.
- [Tablet — güncel sürüm](recovered-tablet.png): 1280×800; kayıp yanıt sonrası yeniden açılış ve başka düzenleyicinin daha yeni sürümünün korunması.
- [Çocuk takvimi — boş gün](child-empty-phone.png): tekrarlanan eylem ve yanlış yönlendirme düzeltmesi.

`qa-fixture.cjs` tüm API çağrılarını ayrı sentetik hostta karşılar. Gerçek aile kaydı değişmez. Hem veli hem çocuk için düzenle → yanıtı kaybet → yeniden aç → aynı isteği kontrol et denendi. İlk kayıt revizyon 4, arada diğer düzenleme revizyon 5; yeniden deneme hâlâ ilk istek kimliğiyle revizyon 4 makbuzunu aldı ama ekranda revizyon 5 kaldı. Ayrıca kesin revizyon çakışması görünür ve bekleyen işlem temizlenir. Sayfa düzeyinde yatay taşma yoktur.

## Kontroller ve sınırlar

- 33 yeni SQL kontrolü; toplam 64 SQL dosyası / 1758 kontrol geçti.
- Dört gerçek eşzamanlı DB senaryosu: aynı istek, veli/çocuk, eski istemci/yeni istemci, çocuk silme. Yalnız geçici `gina_*_audit` klonlarında; klonlar silindi.
- Core 169 test, mobil lint/tip ve core tip kontrolü geçti.
- Bu tarayıcı kabulü fiziksel iPhone/iPad/Pencil veya üretim kabulü değildir. Migration ve yeni istemci henüz dağıtılmadı; TestFlight 17 değişmedi.

Son kaynakla iOS, Android ve web export başarılıdır (`/tmp/gina-timetable-export`). Bu derleme kontrolü imzalı native binary, cihaz testi veya TestFlight yayını değildir.
