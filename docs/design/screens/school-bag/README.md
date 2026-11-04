# Çantam hazır mı — uygulama kabulü

4 Kasım 2026. Onaylı ortak mint/mor/krem düzeni, Nunito metinleri ve mevcut takvim akışı kullanılır. Yeni ana menü veya yeni maskot yorumu yoktur. Takvimde seçili gün ve adı açıkça yazılan çocuk için açılır. Telefonda eşya listesi önce; tablette dersler ve liste yan yanadır.

## Davranış

- Veli ve aktif çocuk cihazı aynı çocuk/gün listesini düzenleyebilir. Ders adından malzeme uydurulmaz; okul duyurusu ve tatil kontrolü açıklanır. En fazla 30 eşya, eşya adı en fazla 80 karakter.
- Aile saat diliminde bugün ve sonraki yedi gün düzenlenebilir. Son 30 günün listesi salt okunur; kaydedilmiş ders görüntüsü sonraki program değişikliklerinden etkilenmez.
- Program sürümü değişince listeyi yeniden kontrol etme seçeneği gerekir. Kayıt anında liste ve program sürümü aynı çocuk kilidinde kontrol edilir. Diğer cihazın kaydı ezilmez.
- Kayıttan önce komut cihazda kullanıcı/aile/çocuk/gün kapsamında saklanır. Kayıp yanıt/yeniden açılış aynı istek kimliğiyle kurtarılır; ikinci liste veya puan oluşmaz. Oturum kapanınca yerel komut silinir.
- Ekran açıkken güncel veri 20 saniyede kontrol edilir. Yeni sürüm sessizce düzenleme taslağının üstüne yazılmaz; görünür yükleme eylemi ve taslağı bırakma onayı vardır. Gerçek zamanlı anlık senkron iddiası yoktur.
- Liste görev/etkinlik/yıldız üretmez. Çocuk silindiğinde liste silinir; ayrılmış veli/iptal edilmiş cihaz eski makbuza da erişemez.

## Kanıtlar

- [Telefon — kullanılabilir liste](list-phone.png), 390×844; eşya satırları üstte ve tek kayıt eylemi.
- [Tablet — veli kaydı](saved-tablet.png), 1280×800; ders bağlamı/listenin yan yana düzeni.
- `qa-fixture.cjs`: gerçek Expo bileşenleri, tüm API çağrıları yalnız sentetik hostta; gerçek aile kaydı değişmedi.
- Çocuk: iki eşya, işaretleme, sunucuda kayıt sonrası yanıt kaybı, sayfayı yeniden açma, aynı kimlikle tek revizyon kurtarıldı.
- Program 1→2 değişimi: yeniden kontrol seçeneği işaretlenene kadar kayıt kapalı; güncel derslerle kayıt geçti.
- Liste sürümü çakışması: yeni eşya taslağı korundu, yeniden yükleme açık bırakma onayı istedi. Onay sonrası güncel liste geldi.
- Veli: ekle/işaretle/kaydet, kaldır/kaydet akışı geçti. Sayfa yatay taşmıyor.

## Kontroller ve açık sınırlar

47 yeni SQL ile 65 dosyada 1.805 kontrol; dört gerçek DB yarışı (aynı istek, veli/çocuk, program değişimi, çocuk silme); 174 core testi geçti. Mobil/core tip kontrolü ve mobil lint geçti. SQL yalnız `gina_completion_audit`, yarışlar silinen geçici klonlardadır.

Bunlar fiziksel iPhone/iPad/Android veya üretim kabulü değildir. 087000 ve istemci dağıtılmadı; TestFlight 17 aynı. Haftalık aile değerlendirmesi ve tam ödev/ders/kurs ortak planı ayrı açık işlerdir.

Son kaynakla iOS/Android/web export başarılı (`/tmp/gina-bag-export`). Bu kontrol imzalı native binary veya fiziksel cihaz kabulü değildir.
