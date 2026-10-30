# Uygulama içi satın alma — Enes'in yapacağı kurulum

Kod hazır (istemci `apps/mobile/src/lib/iap.ts`, sunucu `supabase/functions/iap-verify`, `iap-reconcile`, `apple-notifications`, `google-rtdn`, ortak kod `_shared/iap.ts`, şema `20261030100000_iap.sql`). Mağaza hesapları ve anahtarlar açılınca aşağıdakiler yapılır. Kurallar [DECISIONS.md](./DECISIONS.md)'de: yalnız Apple IAP + Google Play Billing, uygulama içinde kendi kupon girişimiz yok, yetki ailenin, tek kaynak Supabase, webde satış yok.

## Nasıl çalışır (kısaca)

1. Veli uygulamada paketi seçer → `expo-iap` mağaza sayfasını açar. iOS'ta `appAccountToken`, Android'de `obfuscatedAccountId` = ailenin `family_id`'si.
2. Mağaza işlemi uygulamaya döner → uygulama işlemi `iap-verify`'a gönderir (iOS: imzalı JWS, Android: `purchaseToken`).
3. Sunucu doğrular, `store_subscriptions`'a yazar (Android'de satın almayı onaylar/acknowledge) → uygulama ancak bundan sonra `finishTransaction` çağırır.
4. Sonraki yenileme/iptal/iade olayları `apple-notifications` (ASSN V2) ve `google-rtdn` (Pub/Sub) ile gelir; `iap-reconcile` 6 saatte bir bitişi yaklaşan abonelikleri mağazadan yeniden sorgular (kaçan bildirime karşı).

## App Store Connect

1. **Small Business Program**'a ilk satıştan önce başvur (%15).
2. Agreements, Tax, and Banking → **Paid Apps** sözleşmesi + banka + vergi formları (yoksa ürünler sandbox'ta bile gelmez).
3. Uygulama → Monetization → Subscriptions → **abonelik grubu** oluştur: «Gina Aile». Grupta 4 ürün (aynı gruptaki ürünler arasında Apple yükseltme/düşürmeyi kendisi yönetir; seviye sırası: Pro üstte):
   | Product ID | Süre | Fiyat (baz ABD / TR elle) |
   | --- | --- | --- |
   | `gina_pro_yearly` | 1 yıl | $79.99 / ₺1.999,99 |
   | `gina_pro_monthly` | 1 ay | $7.99 / ₺199,99 |
   | `gina_plus_yearly` | 1 yıl | $39.99 / ₺999,99 |
   | `gina_plus_monthly` | 1 ay | $3.99 / ₺99,99 |
   Her ürüne TR + EN görünen ad/açıklama, inceleme ekran görüntüsü ve **Introductory Offer: 7 gün ücretsiz deneme** (tüm ülkeler).
4. **App Store Server Notifications**: App Information → Production ve Sandbox URL'si = `https://<proje>.supabase.co/functions/v1/apple-notifications`, sürüm **Version 2**.
5. **In-App Purchase anahtarı** (App Store Server API için): Users and Access → Integrations → In-App Purchase → anahtar oluştur; Key ID, Issuer ID ve `.p8` dosyası (bir kez indirilir) → secrets'a.
6. **Offer Codes** (kampanya/kupon): Subscriptions → ürün → Offer Codes → kampanya oluştur (tek kullanımlık veya özel kod). Kullanıcı kodu uygulamadaki «Kampanya kodu kullan» düğmesiyle sistem sayfasında ya da App Store'da girer. Uygulamada kendi kod alanımız yok.
7. Sandbox test kullanıcısı: Users and Access → Sandbox → Test Accounts. Test TestFlight/geliştirme build'iyle yapılır; Xcode StoreKit Configuration dosyasıyla imzalanan işlemler Apple kök sertifikasına bağlı olmadığı için sunucu tarafından reddedilir (beklenen davranış).

## Google Play Console

1. Ödeme profili + Play Console'da **Monetization setup**.
2. Monetize → Subscriptions → iki abonelik ürünü: `gina_plus`, `gina_pro`. Her birine iki **base plan**: `monthly` (1 ay, otomatik yenilenen), `yearly` (1 yıl). Her base plana **offer** `trial7`: 7 gün ücretsiz deneme, uygunluk «New customer acquisition — never had any subscription». Fiyatlar: Plus ₺99,99 / ₺999,99, Pro ₺199,99 / ₺1.999,99 (USD $3.99/$39.99, $7.99/$79.99). Grace period ve account hold açık kalsın (varsayılan).
   Eşleme `plan_products.android_product_id / android_base_plan_id / android_offer_id` sütunlarında; kimlik değişirse yalnız bu tablo güncellenir.
3. **Promo kodları**: Monetize → Promo codes → abonelik için kampanya. Kullanıcı Play Store'da ya da uygulamadaki «Google Play kodu kullan» bağlantısıyla (`play.google.com/redeem`) kullanır.
4. **Service account** (Play Developer API): Google Cloud'da (FCM ile aynı proje) Google Play Android Developer API'yi etkinleştir → service account oluştur → JSON anahtar indir. Play Console → Users and permissions → bu e-postayı davet et, uygulamaya **View financial data** + **Manage orders and subscriptions** izinleri. (İzinlerin etkinleşmesi 24 saati bulabilir.)
5. **RTDN**: Google Cloud Pub/Sub → topic `play-rtdn` → `google-play-developer-notifications@system.gserviceaccount.com`'a **Pub/Sub Publisher** rolü. Push subscription: endpoint `https://<proje>.supabase.co/functions/v1/google-rtdn`, **Enable authentication** açık (bir service account seç; audience = endpoint URL'si). Play Console → Monetization setup → Real-time developer notifications → topic adı, «Send test notification».
6. **License testers**: Settings → License testing → test Google hesapları (kapalı test kullanıcılarıyla aynı olabilir).

## Supabase

Deploy:

```sh
supabase functions deploy iap-verify
supabase functions deploy iap-reconcile --no-verify-jwt
supabase functions deploy apple-notifications --no-verify-jwt
supabase functions deploy google-rtdn --no-verify-jwt
```

Secrets (`supabase secrets set …`; yalnız adlar, değerleri sen girersin):

| Ad | Ne |
| --- | --- |
| `APPLE_IAP_KEY_ID` | In-App Purchase anahtarının Key ID'si |
| `APPLE_IAP_ISSUER_ID` | App Store Connect Issuer ID |
| `APPLE_IAP_KEY_P8` | `.p8` dosyasının içeriği (PEM) |
| `APPLE_BUNDLE_ID` | isteğe bağlı; varsayılan `com.enescevik.gina` |
| `GOOGLE_PLAY_SA_KEY` | Play service account JSON'unun tamamı |
| `GOOGLE_PLAY_PACKAGE_NAME` | isteğe bağlı; varsayılan `com.enescevik.gina` |
| `GOOGLE_RTDN_AUDIENCE` | Pub/Sub push aboneliğinin audience değeri (endpoint URL'si) |
| `GOOGLE_RTDN_SA_EMAIL` | isteğe bağlı; push aboneliğinde seçilen service account e-postası |
| `IAP_CRON_SECRET` | rastgele uzun bir dize; pg_cron `iap-reconcile`'ı bununla çağırır |

pg_cron için Vault'a iki kayıt (SQL editor):

```sql
select vault.create_secret('https://<proje>.supabase.co', 'project_url');
select vault.create_secret('<IAP_CRON_SECRET ile aynı değer>', 'iap_cron_secret');
```

(`project_url` başka işlerce zaten tanımlıysa tekrar ekleme.) Dashboard → Database → Extensions'da `pg_cron` ve `pg_net` açık olmalı; iş adı `iap-reconcile`, 6 saatte bir.

## Anahtarlar yokken davranış

- iOS: JWS zinciri gömülü Apple Root CA G3'e karşı çevrimdışı doğrulandığı için anahtarsız da yetki yazılır; `APPLE_IAP_KEY_*` gelince durum ayrıca App Store Server API'den tazelenir ve `iap-reconcile` Apple aboneliklerini de yeniler.
- Android: `GOOGLE_PLAY_SA_KEY` yoksa `iap-verify` girdiyi doğrulayıp `503 {"error":"store_not_configured"}` döner; uygulama işlemi bitirmez (kullanıcı sonra «Satın alımları geri yükle» der). Google 3 gün içinde onaylanmayan satın almayı iade eder; bu yüzden Android satışı service account hazır olmadan açılmamalı.
- Bildirimler her durumda `store_notifications`'a yazılır; işlenemeyenler `error` sütunuyla kalır.

## Kontrol listesi (ilk satıştan önce)

- [ ] iOS sandbox: satın al → paket açılıyor; iptal → `apple-notifications` olayı `store_notifications`'ta `processed_at` dolu.
- [ ] iOS: Offer Code sayfası açılıyor; kod kullanınca paket açılıyor.
- [ ] Android license tester: satın al → acknowledge (Play Console siparişinde «Acknowledged»); Plus → Pro geçişi tek abonelik bırakıyor.
- [ ] RTDN test bildirimi `store_notifications`'ta `test` türüyle görünüyor.
- [ ] `select * from cron.job where jobname = 'iap-reconcile'` bir satır; `net._http_response`'ta 200.
- [ ] Hukuki sayfalar yayında; `EXPO_PUBLIC_LEGAL_BASE_URL` build ortamına girildi (abonelik ekranındaki Abonelik Koşulları / Gizlilik bağlantıları).
