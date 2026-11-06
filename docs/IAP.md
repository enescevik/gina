# Uygulama içi satın alma — Enes'in yapacağı kurulum

Satın alma temeli mevcut; canlı mağaza ve cihaz kabulü aşağıdaki açık kontroller tamamlanmadan bitmiş sayılmaz (istemci `apps/mobile/src/lib/iap.ts`, sunucu `supabase/functions/iap-verify`, `iap-reconcile`, `apple-notifications`, `google-rtdn`, ortak kod `_shared/iap.ts`, şema `20261030100000_iap.sql`). Mağaza hesapları ve anahtarlar açılınca aşağıdakiler yapılır. Kurallar [DECISIONS.md](./DECISIONS.md)'de: yalnız Apple IAP + Google Play Billing, uygulama içinde kendi kupon girişimiz yok, yetki ailenin, tek kaynak Supabase, webde satış yok.

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
| `GOOGLE_RTDN_SA_EMAIL` | zorunlu; push aboneliğinde seçilen service account e-postası |
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
- Yalnız kimliği doğrulanmış bildirimler `store_notifications`'a yazılır. Apple doğrulanmamış JWS kimliğini kaydetmez. Google audience ve gönderici e-postası eksikse 503, doğrulama başarısızsa 401 verir.
- `20261103070000_store_notification_recovery.sql` önce uygulanır, sonra iki alıcı birlikte dağıtılır. Olay kimliği `(platform,event_key)` olur; eski kimlikler değişmez. Yeni Edge eski şemada başarı vermez.
- Beş dakikalık işlem sahipliği aynı olayın eşzamanlı çalışmasını sınırlar. Kesinti sonrası süre dolunca tekrar alınır; eski işleyici yeni sahibin tamamlanma kaydını değiştiremez. Hata/yoğunluk/kayıt belirsizliğinde 503 döner. Başarı yalnız kalıcı tamamlanma kaydından sonra verilir.
- Eski doğrulanmamış günlük satırı doğrulanmış teslimatı engellemez. Bu değişiklik geçmişte yanlış verilmiş bir hakkı kendiliğinden düzeltmez; geçmiş şüpheli satırlar mağazadan ayrıca uzlaştırılmalıdır.
- Mağaza yeniden denemelerinin bir sınırı vardır. Bildirim geçmişinden kurtarma ve operasyon izleme ayrı kabul işidir; beş dakikalık sahiplik tam olarak bir kez yan etki garantisi değildir. 071000 ile abonelik yazımı da tek veritabanı işlemine taşındı; canlı mağaza kabulü hâlâ ayrıdır.

## Kontrol listesi (ilk satıştan önce)

- [ ] iOS sandbox: satın al → paket açılıyor; iptal → `apple-notifications` olayı `store_notifications`'ta `processed_at` dolu.
- [ ] iOS: Offer Code sayfası açılıyor; kod kullanınca paket açılıyor.
- [ ] Android license tester: satın al → acknowledge (Play Console siparişinde «Acknowledged»); Plus → Pro geçişi tek abonelik bırakıyor.
- [ ] RTDN test bildirimi `store_notifications`'ta `test` türüyle görünüyor.
- [ ] `select * from cron.job where jobname = 'iap-reconcile'` bir satır; `net._http_response`'ta 200.
- [ ] Hukuki sayfalar yayında; `EXPO_PUBLIC_LEGAL_BASE_URL` build ortamına girildi (abonelik ekranındaki Abonelik Koşulları / Gizlilik bağlantıları).

## Bildirim kurtarma kabulü — 4 Kasım 2026

Yerel izole veritabanı + taklit sağlayıcı testleri: 29 Edge testi, 26 SQL kontrolü; gerçek eşzamanlı iki teslim, süre dolmuş sahipliği alma, eski işleyiciyi reddetme ve tamamlanmış olayı yeniden gönderme. Gerçek ödeme/iade yapılmadı; üretim dağıtımı yapılmadı. Yönetim ekranı, mağaza iadesi ve GINA içindeki telafi hakkı farklı işlemlerdir; bu değişiklik bir iade ekranı değildir.

Kaynaklar: [Google imzalı push kimliği ve beklenen gönderici](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [Apple başarı/hata yanıtı ve bildirim tekrarları](https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications).

## Atomik abonelik kaydı — 4 Kasım 2026

071000 migration ve ortak `applyStoreState` artık aile eşlemesi, ürün/paket kontrolü, sürüm karşılaştırması ve Google eski token kapatmasını tek işlemde yapar. İlk kayıtta bile aynı mağaza anahtarı kilitlenir: iki aile aynı eski makbuzu eşzamanlı yüklediğinde yalnız biri eşleşebilir. Aile, mağaza ve işlem kimliği sonradan değiştirilemez. Aktif aile üyeliği kayıt sırasında yeniden kontrol edilir.

Apple sırası satın alma tarihinden değil imzalı durumun tarihinden hesaplanır. Aynı/eski sürüm yeni durumu değiştirmez. Google'da API isteğinin başlangıç zamanı yalnız yerel gözlem sırasıdır; Google'ın resmî olay sürümü olduğu iddia edilmez. Gecikmiş iptal bildirimi, API'nin hâlen etkin gördüğü aboneliği tek başına iptal edemez. Saat kayması ve sağlayıcı gecikmesi gerçek mağaza kabulünde kontrol edilmelidir.

Google plan değişiminde eski tokenın kapanması ile yeni hakkın kaydı birlikte gerçekleşir. Eski tokenın sonradan gelmesi yeni bir hak yaratmaz; bunun için aileye bağlı özel bir değiştirme kaydı tutulur. Eski tokenı kapatırken hata olursa yeni kayıt da geri alınır. Henüz farklı sağlayıcı/gerçek iade/mağaza hesabı kabulü yapılmadı.

Dağıtım: 071000 önce; ardından `iap-verify`, `iap-reconcile`, `apple-notifications`, `google-rtdn` aynı kaynaktan güncellenmeli. Eski çalışan kodun yeni sürümü ezmesini engelleyen veritabanı kontrolü vardır. Geçmiş Google plan geçişleri için eski token eşlemelerini mağazadan uzlaştırmak ayrı operasyon işidir.

Kanıt: 10 Edge durum testi, 43 SQL kontrolü; gerçek eşzamanlı DB testlerinde eski/yeni sürüm yarışı, iki ailenin ilk eşleştirmesi ve plan değişimiyle eski tokenın eşzamanlı dönüşü. Sentetik izole veriler; kullanıcı hesabında ödeme yapılmadı.

## Gerekçeli operatör kontrolü (074000, henüz canlı değil)

`/billing` içinde mevcut bir aile aboneliğinde **Mağazadan kontrol et** kullanılır. `iap-operator-reconcile`, gelen bearer tokenı PostgREST'e iletir; `finance_request_reconcile` canlı finans rolünü denetlemeden servis anahtarlı işlem başlamaz. Doğrulanan mağaza durumu ve işin tamamlanması aynı veritabanı işlemindedir. Eski işleyicinin iki dakikalık sahipliği bittiyse yazamaz. Yanıt kaybolursa aynı kalıcı istek sonucu bulunur; üç kesinti sonrası başarısız kapanır. Operatör başına 20/saat, abonelik başına 5/saat yeni istek sınırı vardır.

Kaynak `fetchAppleState` / Google `fetchGoogleSubscription` + `googleState` ortak istemcileridir; Google acknowledge/iade/iptal çağrısı yapılmaz. Mağazada kayıt bulunmaması mevcut aboneliği iptal etmez. Bilinmeyen hatalar/özel tokenlar ekrana çıkmaz. Geçmişin başarılı olması iade yapıldığı anlamına gelmez; bekleyen mağaza bildirimi ayrıca incelenir.

Dağıtım sırası: 074000 (071000 bağımlılığıyla) → `iap-operator-reconcile` → backoffice. İşlev gateway JWT kontrolünü kendi PostgREST canlı rol kontrolüyle tamamladığından config'te `verify_jwt=false`; kimliksiz işlem yoktur. Anahtarlar mevcut sunucu IAP ayarlarıdır, istemciye verilmez. Mevcut altı saatlik otomatik uzlaştırma değiştirilmedi; bu operatör akışı onun yerine geçmez. Canlı mağaza/gerçek cihaz kabulü ve geçmiş bildirim kurtarma açık.

Kanıt: `docs/design/screens/operator-reconciliation/README.md`; SQL 052, `scripts/test-operator-reconcile-races.py`, `iap-operator-reconcile/handler.test.ts`.

## Mağaza doğrulama sertleştirmesi — 6 Kasım 2026 (070000, gerçek mağaza yok)

Kanıt ve ayrıntı: [`docs/release/store-hardening-2026-11-06/README.md`](./release/store-hardening-2026-11-06/README.md). Gerçek Apple sandbox / Google license-tester testi **X02/X03 BEKLİYOR**; aşağıdakilerin hepsi sahte yüklerle, izole DB'de doğrulandı.

- **Kaynak ve doğrulama etiketi.** `store_subscriptions.last_source` (`client_verify` / `notification` / `reconcile` / `operator`), `notified_at` (ilk doğrulanmış ASSN/RTDN) ve `acknowledged_at` (Google). `gina.store_verification_label` → `unacknowledged` · `store_notified` · `store_checked` · `client_only` · `legacy`; `finance_workspace` abonelik satırlarında `verification` olarak gelir. Yalnız istemcinin sunduğu, mağazanın hiç bildirmediği hak `client_only` kalır; eski/stale bir bildirim bile `notified_at` damgalar.
- **Android acknowledge sırası.** `iap-verify` Google'da artık **oku → hak yaz → acknowledge → onay kaydı** yapar. Başka aileye bağlı token hak yazımında reddedilince acknowledge edilmez (Google 3 günde iade eder). Acknowledge başarısızsa yanıt `503 acknowledge_failed`: hak yazılmıştır ama istemci `finishTransaction` çağırmaz, yeniden doğrulama acknowledge'ı tekrar dener. `acknowledgeGoogle` tekrar güvenlidir: 409/400/5xx sonrası abonelik yeniden okunur, Google `ACKNOWLEDGED` diyorsa başarı sayılır. `iap_reconcile_candidates` PENDING görülmüş ve onaylanmamış Google satırlarını (7 gün) bitiş tarihine bakmadan kuyruğa alır; `refreshGoogle` orada acknowledge eder.
- **Aynı makbuz iki aile.** `apply_verified_store_state` zaten `account_mismatch` ile reddediyordu; `iap-verify` artık bu reddi `record_store_account_conflict` ile `audit_log`'a yazar (`store_subscription.account_mismatch`; ham anahtar yok, sha256 + uzunluk + uzun anahtarlarda 4 karakter ipucu; reddedilen aile ve sahip aile kimliği). Bildirim yolunda aynı ret inbox satırında `error=account_mismatch` olarak görünür. **Hak taşıma işlemi yok**: tetikleyici `family_id` güncellemesini engeller; operatör taşıma ekranı ayrı kabul işi.
- **Bildirim kalıcı ret.** `processStoreNotification`, kalıcı kodlarda (`account_mismatch`, `bundle_mismatch`, `not_a_subscription`, `unknown_product`, `invalid_purchase_token`, `invalid_store_state`, `invalid_jws`) satırı kodla kapatıp sağlayıcıya **200 `{ok:false,rejected}`** döner — Apple/Google aynı olayı yeniden göndermez, satır yönetimde "failed" olarak görünür ve yeni teslim yine alabilir. `family_not_found`, sağlayıcı 5xx ve yazma hatası 503 kalır (yeniden teslim). RTDN `eventTimeMillis` varsa ondalık dize olmalı.
- **iap-reconcile.** `handler.ts` ayrıldı ve test edildi: `x-cron-secret` sabit zamanlı karşılaştırma, hiçbir anahtar yokken 503, aday başına bağımsız hata, `unchanged` (stale) sayacı, hata raporunda yalnız kod (`unexpected_error`); ağ hata metni (URL'de token olabilir) artık yanıta yazılmaz.
- **Operatör kontrolü.** `reconcile_job_receipt.result_kind='store_check'`; kaynak `operator`; acknowledge/iade/iptal çağrısı yapılmaz; `no_data` → `unchanged`.
- **Hukuki URL kapısı (öneri, uygulanmadı).** Satın alma başlatma yalnız istemcide (`EXPO_PUBLIC_LEGAL_BASE_URL` yoksa `canBuy=false`). Sunucuda karşılığı yok ve `iap-verify`'da ret doğru yer değil: mağaza parayı almıştır, hak vermemek kullanıcıyı cezalandırır. Öneri: `app_settings` içinde `store_sales` (`{"open":false,"legal_base_url":...}`) anahtarı; istemci mağaza sayfasını açmadan önce bunu okur, build ortamı değişkeni ikinci kapı olarak kalır; `iap-verify` yalnız `raw.sales_closed_at_verify=true` etiketler. S05 hukuk sayfaları yayımlanınca Enes `open:true` yapar. UI işi bu pakette yapılmadı.

Dağıtım sırası: `20261106070000` → `iap-verify`, `iap-reconcile`, `apple-notifications`, `google-rtdn`, `iap-operator-reconcile` aynı kaynaktan. Eski Edge yeni şemada çalışır (sütunlar null kalır, etiket `legacy`); yeni Edge eski şemada `source` alanı nedeniyle `invalid_store_state` vermez (SQL eski sürümde alanı yok sayar) ama `record_store_account_conflict` bulunamaz — sıra korunmalı.

## C11 tekrar doğrulaması — 6 Kasım 2026 (gerçek mağaza yok)

- Sahte yüklerle zincir yeniden koştu: Deno mağaza testleri **107/107** (S03'ün 101 testi + yeni `iap-verify/c11-client-selection.test.ts` 6 test). Yeni testler istemcinin gövdeye eklediği `plan`/`familyId`/`expiresAt`/`status` alanlarının atıldığını, istemcinin "Pro" seçip mağazanın "Plus" dediği durumda yazım olmadığını, yazılan paket/bitişin yalnız mağaza durumundan geldiğini, süresi dolmuş ve iade edilmiş imzalı Apple işleminin aktif hak üretmediğini kanıtlar.
- pgTAP `117` §8: istemci `store_subscriptions`, `entitlement_overrides`, `beta_plan_selections` tablolarına yazamaz, `apply_verified_store_state` çağıramaz; beta erişimi olmadan `set_beta_test_plan` reddedilir; verilmiş beta seçimi yalnız beta süresi boyunca geçerlidir (kalıcı ücretli hak değil).
- Gerçek sandbox / Play lisans testi için adım adım rehber: [release/c11-2026-11-06/user-guides.md](release/c11-2026-11-06/user-guides.md) (X02/X03 BEKLİYOR).
