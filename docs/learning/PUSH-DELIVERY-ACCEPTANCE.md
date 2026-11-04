# Bildirim gönderimi — 083000 kabul ve yayın sırası

4 Kasım 2026. Üretime uygulanmadı; TestFlight 17 değişmedi. Bu belge sağlayıcı kabulünü cihazda görülmüş bildirim olarak saymaz.

## Düzeltme

Önceki gönderici, ilk başarılı cihazdan sonra diğer cihazların geçici hatalarını tekrar denemiyordu. Artık her olay/cihaz için özel gönderim makbuzu vardır; başarılı cihaz tekrar gönderilmez, yalnız kalan cihazlar yeniden denenir. İşlem kimliği ve beş dakikalık sahiplik süresi eski göndericinin yeni denemeyi sonlandırmasını engeller. Kayıp makbuz yanıtında iş durur; sunucuda saklanmış başarı yeniden gönderilmez.

Yeni olay gelmese bile yarıda kalmış gönderimler zamanlayıcıyla ele alınır. En fazla beş deneme, artan bekleme aralığı ve sağlayıcının `Retry-After` süresi (1 saniye–24 saat) vardır. Her ağ isteği 15 saniyede kesilir. Çalışan görev yeni satırları 45 saniyelik bütçe içinde tek tek alır; yarım kalan satır yeniden ele alınabilir.

Her cihazdan önce canlı oturum, aile/cihaz üyeliği, bildirim tercihi ve ortak sonuç sürümü yeniden okunur. Kayıt yenilenmişse eski cihaz anahtarına gelen geçersizlik yanıtı yeni anahtarı silmez. Genel FCM proje 404'ü veya APNs ortam/konu uyumsuzluğu cihaz kaydı silme gerekçesi değildir. Hata kayıtlarına ağ istisnasındaki ham adres/cihaz anahtarı yazılmaz.

APNs birleştirme kimliği olay kimliğine bağlandı: farklı Provalar sırf aynı türde oldukları için tek bildirime indirgenmez. Aynı olayın tekrar denemesi aynı kimliği taşır. Android görüntülenen bildirimin etiketi de olay kimliğidir.

## Sınırlar

- APNs/FCM kabulü kesin cihaz teslimi değildir. Sağlayıcı kabulü ile makbuzun sunucuya kaydı arasındaki bağlantı kaybında tam olarak bir kez teslim garantisi yoktur. Sabit olay kimliği tekrarları azaltır; veri uygulamada yeniden okunur.
- FCM bildirim mesajları sağlayıcıda birleştirilebilir. Android etiketi, çevrimdışı bütün olayların ayrı ayrı teslim edileceği garantisi değildir. Bkz. [Firebase birleştirme kuralları](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types).
- Anahtarı eksik sağlayıcı `skipped_unconfigured`, kalıcı hata/deneme sınırı `failed` olur. Bu kayıtlar kendiliğinden sonsuz tekrar etmez. Yapılandırma sonrası gerekçeli operatör yeniden deneme ekranı ayrı iştir.
- Fiziksel iPhone/iPad ve Android, gerçek APNs/FCM anahtarları ve kapalı uygulamadan açılış kabulü henüz yapılmadı. Gerçek kullanıcıya test bildirimi gönderilmedi.

## Doğrulama

- 31 yeni SQL kontrolü; önceki 60 dosya/1.626 ile toplam 61 dosya/1.657. Eski push yetki ve tercih kontrolleri korunur; eski sahipliksiz claim yöntemi artık reddedilir.
- Üç gerçek eşzamanlı DB senaryosu: aynı olayın iki kez alınması, aynı cihaz makbuzu, süresi geçmiş gönderici. Yalnız geçici audit klonları.
- 20 Edge testi: kısmi hata, saklanmış kayıp yanıt, eski işlem kimliği, tercih değişimi, eksik sağlayıcı, süre bütçesi, Retry-After, özel içerik, APNs olay kimliği ve FCM hata ayrımı.
- Edge ve core tip kontrolü. Ağ testlerinde bütün fetch çağrıları sentetiktir; geçici test anahtarları yalnız test belleğinde üretilir.

## Son yayın için sıralama

1. Yeni sürümü dağıtmadan önce bildirim zamanlayıcısını geçici durdur; eski Edge görevlerinin tamamlandığını doğrula. Gerçek aile veya bildirim kayıtlarını sıfırlama.
2. 083000 migration uygula. Eski `push_claim_batch`, eski hedef okuma ve doğrudan outbox yazımı service_role için kapanır; bu sırada eski worker sessizce başarılı sayılmamalıdır.
3. Aynı commit'ten `push-send` dağıt. V2 claim/hedef/makbuz/sonlandırma çağrıları bu Edge sürümüyle birlikte gerekir. Eski Edge sürümüne tek başına geri dönüş çalışmaz.
4. Sağlayıcı ve Vault yapılandırmasının mevcut olduğunu değerlerini açığa çıkarmadan doğrula; TestFlight için APNs production ortamını kullan.
5. İzinli test ailesinde iki veli/iki platform, tercihi kapalı cihaz, oturum kapatma, geçersiz eski token, kısmi hata ve tekrar denemeyi doğrula. Sağlayıcı kabulü, outbox/makbuz ve cihazda görünümü ayrı kaydet.
6. Zamanlayıcıyı yeniden etkinleştir; bekleyen/süresi dolmuş/kalıcı başarısız kayıtları kontrol et. İnceleme tamamlanmadan gerçek kullanıcıya toplu geçmiş bildirim gönderme.

Kaynaklar: [Apple bildirim istekleri](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns), [Apple hata yanıtları](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns), [Firebase hata kodları](https://firebase.google.com/docs/cloud-messaging/error-codes).
