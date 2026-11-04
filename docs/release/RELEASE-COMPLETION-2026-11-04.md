# GINA — yayını tamamlama ve kullanıcı adımları

4 Kasım 2026. Bu belge bir tamamlanma ilanı değildir. Hazır kod, doğrulanmış hizmet
ve yayımlanmış sürüm ayrı izlenir. Son doğrulanmış TestFlight sürümü **0.1.0 (20)**;
bu sürümden sonraki değişiklikler ayrı kabul ve yayın kaydı gerektirir.
[Güncel sürüm ve gerçek AI arayüz kabulü](CLIENT-20-2026-11-04.md).

## Yeniden kurmayacağın şeyler

Apple Developer üyeliği, App Store Connect **Gina Aile** kaydı, Expo projesi ve
Supabase **gina-prod** mevcut. Bunları tekrar oluşturma. Apple/Google giriş
sağlayıcıları yapılandırılmış; mevcut sunucu Anthropic bağlantısı gerçek sentetik
üretimle doğrulandı. Bu, bütün giriş ve AI ekranlarının canlı kabulünün tamamlandığı
anlamına gelmez.

## Benden tamamlanacak işler

| İş | Şu anki kanıt / kalan sınır |
|---|---|
| Web, mobil ve yönetim panelinin ortak veri akışı | İzole gerçek Auth/REST/Realtime/Storage/Edge koşumunda 254 kontrol geçti. Görev, Prova, cihaz iptali, aile ayrımı, destek ve SSS dahil. Canlı AI/kayıt zincirinde ayrıca 29 kontrol geçti; ekran/cihaz kabulü ayrı. |
| Yeni AI özellikleri | Haftalık özet, belgeden ödev/kurs, görev ve ödül gerçek sağlayıcıyla geçti. Yeni ürün uç noktalarının kayıt/kota/yeniden açılışı yerel gerçek hizmetler ve deterministik sağlayıcı sınırıyla geçti. Canlı ürün uçlarında da 29 kontrol ve 6 temizleme doğrulaması geçti; beş gerçek ücretli üretim yapıldı. |
| Native taslak güvenliği | iPhone/iPad simülatörleri ve Android API33 emülatöründe gerçek SQLite ve süreç kapanışı geçti. Fiziksel kalem/klavye ve Android görsel kabulü ayrıca yapılacak. |
| Eşgüdümlü yayın | Üretim DB 20261103094000'a güncellendi (32 migration), 19 Edge function dağıtıldı. public/gina yerel yedeği alındı; Auth/Storage tam yedeği veya geri dönüş tatbikatı değildir. Web ve TestFlight20 yayımlandı; korumalı backoffice 5 Kasım’da yayımlandı. Canlı yönetici ekran kabulü ayrıca izlenir. |
| Web ve backoffice hosting | İki üretim derlemesi ve gerçek yayın başlıklarıyla telefon/tablet giriş ekranları geçti. Veli webi https://gina-web.pages.dev üzerinde yayımlandı ve gerçek sentetik aileyle görev/onay/hedef/etkinlik akışları geçti. Backoffice 5 Kasım’da Access korumasıyla yayımlandı; aktivasyon beklemiyor. Yeşil ama atlanmış Actions işi yayın kanıtı değildir. |
| Mağaza ve bildirim | Sunucu kontrolleri mevcut; gerçek satın alma/yenileme/iade ve APNs/FCM teslimi için mağaza/cihaz kabulü gerekiyor. |
| Ek AI sağlayıcıları | Mevcut çalışan sağlayıcı Anthropic. Diğer sağlayıcılar yalnız modele ad yazarak etkinleşmez; adapter, doğrulama ve ayrı anahtar gerekir. |
| Kütüphane | Kullanıcı kararıyla en son. 100 taslak korunuyor; 1.540 ilk havuz hedefinde 1.440 taslak eksik. Bağımsız onay/yayın: 0. Teknik doğrulama editör onayı değildir. |

Gündüz/gece ve genişletilmiş maskot/atmosfer üretimi ilk sürüm için ertelenmiştir.
Web'de yeni bir ödeme sistemi kurulmayacak; mevcut ürün kararında satın alma
Apple/Google mağazasında, kazanılan erişim aileye bağlı ve web'de görünürdür.

## Senden gerekebilecekler — sırayla

### 1. Yönetim paneli — Cloudflare aktivasyonu tamamlandı

**5 Kasım 2026 güncellemesi:** Zero Trust Free hesap sahibi tarafından etkinleştirildi;
ekip alanı `gina-family.cloudflareaccess.com`. Bu adımı yeniden yapma.

[Yönetim panelini aç](https://gina-backoffice.pages.dev).

1. Cloudflare girişinde `enescevik@gmail.com` adresini kullan; e-postana gelen tek
   kullanımlık kodu Cloudflare sayfasına gir.
2. Ardından GINA'nın **Yönetici girişi** ekranında aynı e-posta ve mevcut GINA
   şifrenle giriş yap. Hatırlamıyorsan **Şifremi unuttum** bağlantısını kullan;
   açılan GINA web sayfasında sıfırlama e-postası iste ve bağlantıyı aynı tarayıcıda aç.
   Yeni şifreyi belirledikten sonra yönetim paneline dön.
   Cloudflare kodu, GINA şifresi değildir. Şifreni veya kodunu
   sohbete gönderme.
3. Mevcut GINA hesabına, 5 Kasım'daki açık onayınla tam yönetici yetkisi verildi;
   işlem denetim kaydına yazıldı. Eski GINA oturumu açıksa çıkıp yeniden giriş yap.
4. Başka ekip üyesi eklenecekse hem Cloudflare izin listesi hem GINA'daki uygun
   görev yetkisi ayrıca tanımlanacak. Destek/içerik personeline tam yönetici
   yetkisi varsayılan olarak verilmeyecek.

Ana adres ve `*.gina-backoffice.pages.dev` aynı Access uygulamasıyla korunuyor;
yalnız hesap sahibinin kesin e-posta adresine izin veriliyor. WARP gerekmiyor.
Üretim ve gerçek dağıtım adresindeki 12 oturumsuz kontrol Access girişine yönlendi.
Özel alan adı henüz yok; eklendiğinde ayrı koruma doğrulanmadan açılmayacak.
Sonraki otomatik yayın akışına yükleme öncesi/sonrası Access kontrolü eklendi;
GitHub yayın anahtarı henüz kurulmadığı için mevcut yayın Wrangler ile yapıldı.

[Yayın kanıtları ve kalan kabul sınırı](backoffice-2026-11-05/README.md).

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
   Canlı bildirim alıcısı şu anda güvenli biçimde 503 dönüyor: Pub/Sub push hedefi
   `GOOGLE_RTDN_AUDIENCE` ve doğrulanacak gönderici `GOOGLE_RTDN_SA_EMAIL` eksik.
4. Deneme yapacağın Google hesabını **lisans test kullanıcısı** olarak ekle; yalnız
   iç test grubuna girmek ücretsiz deneme satın alması garantisi değildir.

GINA doğrudan FCM/APNs gönderir; Expo push hizmetine taşınmaz. Firebase kimlik
bilgisi açıklaması: [Expo FCM rehberi](https://docs.expo.dev/push-notifications/fcm-credentials/).
Satın alma denemesi: [Google Play lisans testleri](https://developer.android.com/google/play/billing/test).

### 4. Gerçek cihazda birlikte kısa kabul turu yap

TestFlight’ta **0.1.0 (20)** seçip güncelle. Eski 18 numaralı derleme ile yeni kodu
karşılaştırma. Uygulamayı silmeden güncelle; çizim/cevap taslaklarını koruyalım.

1. iPhone ve iPad'de giriş yap; tek çocukta gereksiz çocuk seçici çıkmadığını kontrol et.
2. Tableti eşleştir; izinli çocuğu seç, PIN tercihini ve veliye dönüşü dene.
3. Çocuk bir görev göndersin, veli onaylasın; ikinci cihazda görev ve yıldız
   uygulamayı kapatmadan yenilensin.
4. Prova'da seçenekli ve açık uçlu birer soru çöz. Dikey/yatay geçişte soru ve çizim
   korunsun; yazı/sembol menüsü dönüş döngüsüne girmesin. iPad pencere modundaysa
   işletim sisteminin pencere kontrolünden büyüt; uygulama kullanılabilir alanı
   doldurmalı. Pencereyi zorla büyüten bir sistem yetkisi varmış gibi sunulmuyor.
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
- Hukuk ve gizlilik taslaklarında sağlayıcı unvanı/adı, iş adresi, destek e-postası,
  varsa MERSİS/vergi bilgisi ve yürürlük tarihi henüz yer tutucudur. Bunları işletmenin
  gerçek bilgileriyle tamamlayıp uzman incelemesinden geçir. Eski taslakların AI
  özellikleri ve veri işleme açıklamaları da bugünkü ürünle eşleştirilmeli.
- Onaylanan metinleri `/legal/gizlilik-politikasi` ve
  `/legal/abonelik-kosullari` adreslerine yayımlayıp mobilin
  `EXPO_PUBLIC_LEGAL_BASE_URL` ayarını bağlamak teknik iş olarak bende.
  **Bu ayar yokken gerçek satın alma düğmesi bilerek kapalıdır.** TestFlight 20 için
  de hazır ödeme/mağaza kabulü iddia edilmeyecek; paket deneme hakları gerçek satın
  alma testinin yerine geçmez. App Store ürün/fiyatları ayrıca eşleştirilmeli.
- Kütüphane taslaklarını bağımsız alan/dil incelemesinden geçirecek kişiyi belirle.
  Yönetim panelinde öğrenci görünümü, cevap/rubrik ve ortak kaynak birlikte
  incelenir; gerekçeli onaydan sonra ayrı yayın işlemi yapılır.
- Anthropic dışındaki sağlayıcıları kullanmak istersen hangi hesabın hazır olduğunu
  bildir. Mevcut çalışan sağlayıcıyla yapılan testler bu hesapları zorunlu kılmaz;
  çok sağlayıcılı özelliği kapatmış veya tamamlamış saymıyoruz.

## Kanıtlar ve yayın sırası

1. [Birleşik hizmet kabulü](../learning/isolated-service-acceptance/README.md)
   ve `ai-pipeline-verification.json`: 254 kontrol.
2. [Canlı sunucu dağıtımı ve 29 kontrol](hosted-services-2026-11-04/README.md).
   [Gerçek AI içerik kabulü](../learning/ai-feature-acceptance/README.md).
3. [Canlı Cloudflare web kabulü](cloudflare-web-2026-11-04/README.md).
   [Tarayıcı yayın kabulü](browser-readiness/README.md): üretim başlıkları, telefon/tablet.
4. [Native taslak kabulü](../design/screens/native-journal-recovery/README.md).
5. DB/Edge yayını → web/backoffice yüklemesi ve erişim kontrolü → gerçek hesapla
   birleşik kabul → imzalı mobil derleme → TestFlight → fiziksel cihaz kabulü.

Her basamakta açık kalan iş ayrıca yazılacak. "Derlendi", "test geçti" ve
"kullanıcılara yayımlandı" aynı durum değildir.

## EAS derleme kotası

Bu tur ücretsiz aylık iOS bulut derleme kotası doldu. TestFlight20 önceden
tamamlanan imzalı paketle yayımlandı. Yeni ücretli plan satın alınmadı. Mac
üzerinde EAS yerel derlemeyle kayıtlı iPad’in 20 paketi de üretildi ve mevcut
kurulum bağlantısında yayımlandı. Bulutta daha
hızlı/ek derleme istersen plan kararı sana ait. Bu, Anthropic AI bakiyenden ayrı
bir hizmet kotasıdır.
