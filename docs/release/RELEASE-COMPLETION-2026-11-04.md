# GINA — yayını tamamlama ve kullanıcı adımları

4 Kasım 2026. Bu belge bir tamamlanma ilanı değildir. Hazır kod, doğrulanmış hizmet
ve yayımlanmış sürüm ayrı izlenir. Son doğrulanmış TestFlight sürümü **0.1.0 (17)**;
sonraki değişiklikler henüz o derlemede yoktur.

## Yeniden kurmayacağın şeyler

Apple Developer üyeliği, App Store Connect **Gina Aile** kaydı, Expo projesi ve
Supabase **gina-prod** mevcut. Bunları tekrar oluşturma. Apple/Google giriş
sağlayıcıları yapılandırılmış; mevcut sunucu Anthropic bağlantısı gerçek sentetik
üretimle doğrulandı. Bu, bütün giriş ve AI ekranlarının canlı kabulünün tamamlandığı
anlamına gelmez.

## Benden tamamlanacak işler

| İş | Şu anki kanıt / kalan sınır |
|---|---|
| Web, mobil ve yönetim panelinin ortak veri akışı | İzole gerçek Auth/REST/Realtime/Storage/Edge koşumunda 192 kontrol geçti. Görev, Prova, cihaz iptali, aile ayrımı, destek ve SSS dahil. Canlı sürüm kabulü ayrı yapılacak. |
| Yeni AI özellikleri | Haftalık özet, belgeden ödev/kurs, görev ve ödül gerçek sağlayıcıyla geçti. Yeni ürün uç noktalarının kayıt/kota/yeniden açılış kabulü tamamlanacak. |
| Native taslak güvenliği | iPhone/iPad simülatörlerinde gerçek SQLite ve süreç kapanışı geçti. Android ve fiziksel kalem/klavye kabulü ayrıca kaydedilecek. |
| Eşgüdümlü yayın | Üretim DB kaydı 20261103040000'a kadar; 20261103094000 dahil sonraki migration'lar, ilgili Edge sürümleri ve istemciler birlikte yayımlanacak. Yedek/geri dönüş ve yetki kontrolleri atlanmayacak. |
| Web ve backoffice hosting | İki üretim derlemesi ve gerçek yayın başlıklarıyla telefon/tablet giriş ekranları geçti. Cloudflare yüklemesi ve Access koruması henüz kabul edilmedi. Yeşil ama atlanmış Actions işi yayın kanıtı değildir. |
| Mağaza ve bildirim | Sunucu kontrolleri mevcut; gerçek satın alma/yenileme/iade ve APNs/FCM teslimi için mağaza/cihaz kabulü gerekiyor. |
| Ek AI sağlayıcıları | Mevcut çalışan sağlayıcı Anthropic. Diğer sağlayıcılar yalnız modele ad yazarak etkinleşmez; adapter, doğrulama ve ayrı anahtar gerekir. |
| Kütüphane | Kullanıcı kararıyla en son. 100 taslak korunuyor; 1.540 ilk havuz hedefinde 1.440 taslak eksik. Bağımsız onay/yayın: 0. Teknik doğrulama editör onayı değildir. |

Gündüz/gece ve genişletilmiş maskot/atmosfer üretimi ilk sürüm için ertelenmiştir.
Web'de yeni bir ödeme sistemi kurulmayacak; mevcut ürün kararında satın alma
Apple/Google mağazasında, kazanılan erişim aileye bağlı ve web'de görünürdür.

## Senden gerekebilecekler — sırayla

### 1. Cloudflare oturumunu hazır tut

Bu adımı sonraya bırakmıştın; **4 Kasım saat 17.00 İstanbul** için hatırlatıcı mevcut.
Yeni hesap açmana gerek yok.

1. [Cloudflare](https://dash.cloudflare.com/) içinde GINA'yı barındıracak hesabı aç.
2. Giriş veya iki aşamalı doğrulama isteniyorsa kendin tamamla.
3. Hesap açık olduğunda haber vermen yeterli; Pages projeleri, yükleme, alan adı
   eşlemesi ve yönetim panelinin Access politikası teknik iş olarak bende.
4. Yönetim paneline girecek ekip varsa yalnız onların e-posta adreslerini belirle.
   Destek ve içerik personeline tam yönetici yetkisi vermeyeceğiz.

Başarı ölçütü: veli webi açılır; yönetim paneli üretim/önizleme/özel alan adlarının
tamamında yetkisiz kişiyi durdurur. Access kapısından geçmek uygulamada yönetici
yetkisi kazandırmaz. Cloudflare'ın yalnız önizlemeyi koruyan ayarı üretimi otomatik
korumaz; [Pages Access kapsamı](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
ayrıca doğrulanacak.

### 2. Alan adı ve e-posta gönderimini kesinleştir

Son bildirdiğin durumda alan adı/SMTP yoktu; sonradan satın aldıysan yeniden alma.
Bu belgenin tarihi itibarıyla yeni bir alan adı veya SMTP kurulumu doğrulanmadı.

1. Aldığın alan adı varsa yalnız adını bildir. Yoksa marka için kullanacağın alan
   adını satın al; hesabın ve alan adının sahibi sen ol.
2. Tercih ettiğin e-posta hizmetinde (örneğin Resend) hesabını aç ve giriş yap.
3. Alan adı doğrulamasının verdiği DNS kayıtlarını, gönderici adresini ve Supabase
   bağlantısını birlikte kurabiliriz; gizli SMTP parolasını sohbete yapıştırma.
4. Kurulumdan sonra kendi test adresinde doğrulama ve şifre sıfırlama e-postasını
   aç; telefon ve web'de doğru uygulamaya dönüldüğünü kontrol edeceğiz.

Başarı ölçütü yalnız "e-posta gönderildi" mesajı değildir: posta gerçekten ulaşır,
bağlantı açılır ve süresi dolmuş/tekrar kullanılmış bağlantı anlaşılır biçimde
reddedilir. Supabase'in varsayılan servisi genel kullanıcı dağıtımı için değildir;
[özel SMTP yönergesi](https://supabase.com/docs/guides/auth/auth-smtp).

### 3. Android için Firebase ve Play erişimini hazırla

Son sır-adı denetiminde Android bildirim ve mağaza sunucu kimlik bilgileri yoktu.
Bu, Google hesabının veya Play Console hesabının kesinlikle olmadığı anlamına gelmez.

1. Varsa mevcut GINA Google/Firebase/Play hesaplarında oturum aç. GINA projesini
   tekrar oluşturmadan mevcut projeyi seçeceğiz.
2. Firebase'de Android uygulama kimliği **com.enescevik.gina** olmalı. Proje
   ayarlarından uygulama yapılandırması ve yalnız bildirim gönderimine uygun hizmet
   hesabı kurulacak. Özel anahtarı sohbet veya Git'e koymayacağız.
3. Play Console'da GINA kaydı ve iç test erişimini hazırla. Satın alma ürünleri,
   mağaza bildirimleri ve sunucu hesabının dar yetkileri teknik kurulumda eşleştirilecek.
4. Deneme yapacağın Google hesabını **lisans test kullanıcısı** olarak ekle; yalnız
   iç test grubuna girmek ücretsiz deneme satın alması garantisi değildir.

GINA doğrudan FCM/APNs gönderir; Expo push hizmetine taşınmaz. Firebase kimlik
bilgisi açıklaması: [Expo FCM rehberi](https://docs.expo.dev/push-notifications/fcm-credentials/).
Satın alma denemesi: [Google Play lisans testleri](https://developer.android.com/google/play/billing/test).

### 4. Gerçek cihazda birlikte kısa kabul turu yap

Yeni derleme yayımlandığında sürüm numarasını önce eşleştireceğiz. Eski 17 numaralı
derleme ile yeni kodu karşılaştırmayacağız.

1. iPhone ve iPad'de giriş yap; tek çocukta gereksiz çocuk seçici çıkmadığını kontrol et.
2. Tableti eşleştir; izinli çocuğu seç, PIN tercihini ve veliye dönüşü dene.
3. Çocuk bir görev göndersin, veli onaylasın; ikinci cihazda görev ve yıldız
   uygulamayı kapatmadan yenilensin.
4. Prova'da seçenekli ve açık uçlu birer soru çöz. Dikey/yatay geçişte soru ve çizim
   korunsun; yazı/sembol menüsü dönüş döngüsüne girmesin.
5. Pencil varsa avuç içi ekrandayken çiz; kalem gecikmesini ve sayfa kaymasını dene.
   Bu fiziksel deneyi tarayıcı/simülatör testinden çıkaramayız.
6. Cevap yazarken uygulamayı kapatıp aç; taslak geri gelsin. Veli değerlendirmesinde
   de aynı deneyi yap. Başka sorunun taslağı kaybolmasın.
7. Bildirim iznini ver; uygulama arka plandayken gerçek test bildiriminin geldiğini
   ve dokununca doğru alana açıldığını doğrulayalım.
8. Test mağazasında satın al → aile cihazında hak → geri yükle → iptal/iade sonrası
   doğru hak akışını kontrol edelim. TestFlight satın almaları Apple sandbox ortamındadır;
   [Apple test açıklaması](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/).

Sorun bildirirken ekran adı, sürüm, cihaz ve yaptığın son adım yeterli; gerçek
çocuk bilgilerini ekran görüntüsünde gizleyebilirsin.

### 5. Mağaza ve içerik için senin kararını gerektiren işler

- Mağaza hesabında bekleyen sözleşme/kimlik/ödeme bilgisi görünürse hesap sahibi
  olarak tamamla. Bu alanların güncel durumu burada doğrulanmadı; eksik oldukları
  varsayılmıyor. Teknik yayın kurulumu hesabı yeniden açmanı gerektirmez.
- Hukuk ve gizlilik taslaklarının işletme bilgileri/uzman incelemesi tamamlanmalı.
  Geliştirme testi, hukuki veya pedagojik onay yerine geçmez.
- Kütüphane taslaklarını bağımsız alan/dil incelemesinden geçirecek kişiyi belirle.
  Yönetim panelinde öğrenci görünümü, cevap/rubrik ve ortak kaynak birlikte
  incelenir; gerekçeli onaydan sonra ayrı yayın işlemi yapılır.
- Anthropic dışındaki sağlayıcıları kullanmak istersen hangi hesabın hazır olduğunu
  bildir. Mevcut çalışan sağlayıcıyla yapılan testler bu hesapları zorunlu kılmaz;
  çok sağlayıcılı özelliği kapatmış veya tamamlamış saymıyoruz.

## Kanıtlar ve yayın sırası

1. [Birleşik hizmet kabulü](../learning/isolated-service-acceptance/README.md)
   ve `backoffice-verification.json`: 192 kontrol.
2. [Gerçek AI içerik kabulü](../learning/ai-feature-acceptance/README.md).
3. [Tarayıcı yayın kabulü](browser-readiness/README.md): üretim başlıkları, telefon/tablet.
4. [Native taslak kabulü](../design/screens/native-journal-recovery/README.md).
5. DB/Edge yayını → web/backoffice yüklemesi ve erişim kontrolü → gerçek hesapla
   birleşik kabul → imzalı mobil derleme → TestFlight → fiziksel cihaz kabulü.

Her basamakta açık kalan iş ayrıca yazılacak. "Derlendi", "test geçti" ve
"kullanıcılara yayımlandı" aynı durum değildir.
