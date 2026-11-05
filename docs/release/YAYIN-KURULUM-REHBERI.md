# Gina · İlk kurulum rehberi — tarihî kayıt

> **4 Kasım güncellemesi:** Bu belgenin ilk hesap açma adımları artık güncel değildir. Supabase, Expo ve Apple kaydı mevcut; yeniden oluşturmayın. Güncel kalan işler ve kullanıcı adımları: [Yayın tamamlama rehberi](RELEASE-COMPLETION-2026-11-04.md). Aşağıdaki metin 31 Ekim tarihli kayıttır.

31 Ekim 2026. İlk hedef iPhone/iPad TestFlight betası, ardından mağaza. Apple Developer üyeliğin aktif; App Store Connect uygulama kaydı ve Supabase projesi oluşturuldu. Expo projesi oluşturuldu ve kodla eşleştirildi; EAS CLI girişi ve iOS imzalama bilgileri tamamlandı; imzalı IPA oluşturuldu ve App Store Connect’e yüklendi. Build 6 Apple işlemesini tamamladı ve iç test grubunda Ready to Test durumunda. Kurulumun tamamlanan ve bekleyen adımları aşağıdadır.

**İlk IPA TestFlight’a yüklendi; sıradaki adım son paketi test cihazına kurup 6. bölümdeki kabul kontrollerini yapmak.** Supabase bölgesi Frankfurt olarak doğrulandı. Tamamlanan hesapları yeniden oluşturma. Şifre veya özel anahtar gönderme. Hesapların açılması uygulamanın yayına hazır olduğu anlamına gelmez. Mağaza incelemesine göndermeden önce güncel denetim ve gerçek cihaz kabulü tamamlanmalıdır.

## Güncel kurulum durumu

- [x] App Store Connect kaydı oluşturuldu: **Gina Aile**, Apple ID **6829083239**. [Uygulama sayfası](https://appstoreconnect.apple.com/apps/6829083239/distribution/ios/version/inflight).
- [x] `apps/mobile/eas.json` → `submit.production.ios.ascAppId` gerçek Apple ID ile dolduruldu.
- [x] Bundle ID: `com.enescevik.gina`. Paylaşılan ekran görüntüsündeki takım: **Enes Cevik**, Team ID: `689ZS375S5`.
- [x] **Push Notifications** Apple Developer portalında açıldı (kullanıcı teyidi). Production APNs anahtarı oluşturuldu ve Supabase’e yüklendi; fiziksel cihaz testi bekliyor.
- [x] Supabase projesi oluşturuldu: `wixjxlxgyhgdacadsawo`.
- [x] Supabase kök adresi ve publishable key, Git'in yok saydığı `apps/mobile/.env.production.local` dosyasına kaydedildi. Geliştirme `.env` dosyası korunuyor.
- [x] Supabase bölgesi **Central EU (Frankfurt), `eu-central-1`** panel ve API üzerinden doğrulandı.
- [x] Expo projesi: [enescevik/gina-aile](https://expo.dev/accounts/enescevik/projects/gina-aile). `apps/mobile/app.json` içinde owner ve `extra.eas.projectId`: `8fc01433-eb6f-419e-a20b-edc30c8abe84`.
- [x] EAS CLI standart oturumu kullanıcı onayıyla tamamlandı. Hesapla sınırlandırılmış Release Manager ve Admin oturumları sertifika CREATE işleminde reddedildi; standart oturumla sorun çözüldü.
- [x] iOS distribution sertifikası (serial `4AD0AA86FCBF8447A36C35C563FDF9C0`) ve aktif provisioning profile `6PK4TZPY3C`, takım `689ZS375S5` için EAS’e kaydedildi. Son kullanma: 31 Ekim 2027. Başarısız kurulumdan kalan `6A24Q762H7` sertifikası kota açmak için iptal edildi.
- [x] EAS Submit için App Store Connect API anahtarı `79MVX4P6FL` (`APP_MANAGER`) oluşturulup Gina projesine atandı. Bu anahtar EAS kimlik bilgileri deposunda; Supabase’e/mobil ortama yüklenmedi.
- [x] İmzalı IPA: `.codex-setup/gina-production.ipa`, **0.1.0 (5)**, yaklaşık 63.7 MB. Codesign doğrulaması geçti; bundle/team doğru, `aps-environment=production`, gerçek Supabase adresi pakette doğrulandı.
- [x] IPA, EAS Submit üzerinden App Store Connect’e başarıyla yüklendi. [Gönderim kaydı](https://expo.dev/accounts/enescevik/projects/gina-aile/submissions/fd694dec-a96e-4ec5-b402-489bdcd4ab31). `Team (Expo)` iç test grubu oluşturuldu.
- [x] Build 5 Apple işlemesini tamamladı; TestFlight detay ekranı açıldı ve Türkçe beta notları kaydedildi. EAS Free plan `--what-to-test` parametresini kabul etmediği için notlar Apple panelinden eklendi.
- [x] `Team (Expo)` grubuna hesap sahibi eklendi; 31 Ekim 2026 tarihinde TestFlight daveti gönderildi (Invited). Build **0.1.0 (6)** grupta **Ready to Test**.
- [ ] iPhone’da daveti kabul edip build 6’yı kur; fiziksel cihaz kabulünü tamamla. Mağaza incelemesine gönderilmedi.
- [x] Web adresini içeren son IPA: `.codex-setup/gina-production-web.ipa`, **0.1.0 (6)**. Codesign doğrulandı; üretim Supabase ve `gina-aile-enescevik.expo.app` adresleri derlenmiş pakette doğrulandı. Test için eski build 5 yerine build 6 kullanılmalı. SHA-256: `3e1f741643957e32f60c147404d7557f2eb625707a751b8c83b6519aec3afd24`.
- [x] Build 6 App Store Connect’e başarıyla yüklendi. [EAS gönderim kaydı](https://expo.dev/accounts/enescevik/projects/gina-aile/submissions/adfe7d6f-e1dc-4660-bc58-55f26625a175). Apple işlemesi tamamlandı; iç test için build 6 kullanılabilir.
- [x] APNs `Gina Push Production`, Key ID `25K47N9C8T`: yalnız `com.enescevik.gina`, Production. Supabase secrets içine APNs anahtarı/kimlikleri yüklendi.
- [x] Apple IAP anahtarı `Gina IAP Server` (`Z8DQRUB8PU`) oluşturulup Supabase’e yüklendi; `iap-reconcile` HTTP 200 döndü (henüz kontrol edilecek abonelik yok).
- [x] Abonelik grubu `Gina Aile` (`22530720`) ve dört taslak ürün oluşturuldu: `gina_plus_monthly` (`6829096046`), `gina_plus_yearly` (`6829096195`), `gina_pro_monthly` (`6829095984`), `gina_pro_yearly` (`6829096222`). Pro ürünleri seviye 1, Plus ürünleri seviye 2; aylık/yıllık varyantlar aynı seviyede.
- [x] Abonelik başlangıç fiyatları (ABD / Türkiye): Plus aylık `$3.99 / ₺99,99`, yıllık `$39.99 / ₺999,99`; Pro aylık `$7.99 / ₺199,99`, yıllık `$79.99 / ₺1.999,99`. Türkiye fiyatları Apple otomatik kurundan ayrı ayarlandı.
- [x] Dört aboneliğin Türkçe görünen adı ve açıklaması kaydedildi.
- [x] Dört üründe 7 günlük ücretsiz deneme kaydedildi: 31 Ekim 2026 başlangıç, bitiş tarihi yok, 175 ülke için teklif. Ürünlerin satış kullanılabilirliği ayrıca açılmadı; teklif kaydı yayına çıkış anlamına gelmez.
- [ ] Abonelik kullanılabilirlik/inceleme bilgileri ve gerçek satın alma testi; Anthropic API bağlantısı.
- [ ] Apple **Business**: Free Apps Agreement aktif; **Paid Apps Agreement = New**. Apple, ücretli sözleşmeden önce yasal kişi bilgisinin güncellenmesini istiyor. AB için **DSA trader/non-trader** beyanı da bekliyor. Hesap sahibinin doğru yasal/finansal bilgileriyle tamamlaması gerekir; sözleşme kabul edilmedi, finansal bilgi girilmedi.
- [x] Üretimde **26 migration**, **10 Edge Function**, anonim oturum, `public.custom_access_token_hook` ve `gina://reset-password` yönlendirmesi kuruldu.
- [x] Push/IAP cron secret değerleri üretim Edge Function secrets ve Vault içine yerleştirildi.
- [x] Üretimde 44 tablonun tamamında RLS etkin; demo kullanıcı/aile taşınmadı.
- [x] Ücretsiz web yayını: https://gina-aile-enescevik.expo.app . Giriş ekranı tarayıcıda doğrulandı. Supabase Site URL bu adres; allowlist içinde hem `gina://reset-password` hem `https://gina-aile-enescevik.expo.app/reset-password` var.
- [ ] SMTP ve fiziksel cihaz kabulü. E-posta doğrulaması açık bırakıldı.
- [ ] Alan adı, destek e-postası, SMTP, tamamlanmış gizlilik adresleri ve mağaza görselleri. Kullanıcı henüz alan adı/destek e-postası olmadığını belirtti; ücretsiz Expo Hosting adresi kuruldu. Hukuki taslaklar yayımlanmadı; işletmeci iletişim bilgileri hâlâ eksik.
- [x] Supabase public URL/istemci anahtarı ve `EXPO_PUBLIC_WEB_URL` EAS projesinin `production` ortamına kaydedildi (Supabase ayarları `Sensitive`, web adresi `Plain text`). Sunucu secret’ları EAS’e yüklenmedi.

Son yerel kontrol: eksik beş yerel migration veriler sıfırlanmadan uygulandı; **16 dosyada 241 veritabanı testi geçti**. iOS export başarılı. Expo geliştirme sunucusu rota tiplerini yeniledikten sonra **typecheck geçti**; önceki hata eski üretilmiş rota tiplerinden kaynaklanıyordu. Lint ve typecheck geçti. SDK 58’in kaldırdığı `newArchEnabled` ayarı çıkarıldıktan sonra Expo Doctor **20/20** geçti. Statik TestFlight yapılandırma kontrolü geçti; web adresi bağlı, legal adresi bekliyor. Üretim API erişimi, migration geçmişi ve imzalı IPA doğrulandı; fiziksel cihaz kabulü yapılmadı.

Kurulum secret dosyaları Git tarafından yok sayılan `.codex-setup/` altında, dosya izni `600` ile tutulur: `.env.management` (yalnız Gina projesine scoped, 7 günlük Supabase token), `.env.server` (sunucu cron secret değerleri ve APNs özel anahtarı dahil Apple kimlikleri), `AuthKey_25K47N9C8T.p8` (APNs yedeği), `SubscriptionKey_Z8DQRUB8PU.p8` (IAP yedeği). IAP anahtarı hesap düzeyindedir ve süresizdir; mobil istemciye konmaz. Bu dosyaları mobil build ortamına yükleme. `.env.production.local` yalnız public istemci ayarları içindir. Supabase tokenı genel `supabase login` oturumuna aktarılmadı; işlemler proje kapsamı korunarak yapıldı.

Kullanıcı mevcut Expo hesabına giriş yaptı; `enescevik` hesabında Gina Aile projesi oluşturuldu. Chrome engeli giderildi ve EAS CLI oturumu tamamlandı. Apple parolası/iki faktör doğrulaması kullanıcı tarafından Terminal’de tamamlandı; sonraki işlemlerde EAS kayıtlı Apple oturumunu kullandı. Apple tarafında mevcut mağaza adı, alt başlık, kategoriler ve metinler doğrulandı; sürümün yayın şekli **manuel** yapıldı. Production/Sandbox App Store Server Notifications URL: `https://wixjxlxgyhgdacadsawo.supabase.co/functions/v1/apple-notifications`.

Veritabanı parolası dosyalara kaydedilmedi. Sohbette paylaşılan parolayı Supabase Dashboard'dan yenile ve yeni değeri yalnız parola yöneticinde sakla.

## 1. Apple: mevcut üyeliğinle Gina kaydı

1. [App Store Connect](https://appstoreconnect.apple.com/) adresinde aktif Developer üyeliğinin bağlı olduğu Apple hesabıyla giriş yap. Birden fazla takım görünürse Gina’nın sahibi olacak takımı seç.
2. **Business** bölümünde bekleyen sözleşme varsa oku ve kabul et. Üyelik satın alma adımına ihtiyacın yok.
3. **Apps → + → New App** yolunu aç. Platform **iOS**, ad **Gina Aile**, ana dil **Turkish**, Bundle ID **com.enescevik.gina**, SKU **gina-2026** kullan. Uygulama adı uygun değilse kaydı zorlamak yerine bana görünen mesajı yaz.
4. Bundle ID listede yoksa [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers → + → App IDs → App**: açıklama Gina Aile, **Explicit Bundle ID** `com.enescevik.gina`. Kaydet, App Store Connect sayfasını yenile.
5. Uygulama oluştuktan sonra **App Information → Apple ID** alanındaki sayısal kimliği not et. Bu, Apple hesabının e-postası veya Team ID değildir.
6. Bu proje için kayıt tamamlandı: **Apple ID `6829083239`**, takım **Enes Cevik**. `apps/mobile/eas.json` güncellendi; bu bilgileri yeniden göndermene gerek yok.

Başarı işareti: Apps listesinde Gina Aile görünür, durum **Prepare for Submission** olur. Apple’ın [uygulama kaydı yönergesi](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) bu adımları açıklar.

İlk yükleme için şimdi `.p8` üretmen zorunlu değil. EAS Submit’in yönlendirdiği kimlik doğrulamasını kullanabiliriz. API anahtarı tercih edersek **Users and Access → Integrations → App Store Connect API → Team Keys** üzerinden yetkili anahtar üretir, `.p8` dosyasını güvenli yerel klasörde saklarız. Dosyayı sohbete/repoya koyma. [EAS iOS gönderimi](https://docs.expo.dev/submit/ios/).

### 1.1. App ID Configuration: seçilecek capabilities

Apple Developer → **Certificates, Identifiers & Profiles → Identifiers → com.enescevik.gina → Capabilities**.

| Seçenek | Mevcut Gina sürümünde yapılacak |
| --- | --- |
| Push Notifications | **Açık**. Kullanıcı açtığını teyit etti. |
| In-App Purchase | Açık kalsın; Explicit App ID için varsayılan olarak etkindir. Gri/işaretli görünmesi normaldir. |
| Sign in with Apple | EAS capability sync, kurulu `expo-apple-authentication` eklentisi nedeniyle otomatik açtı. Bu, Supabase Apple girişinin kurulduğu anlamına gelmez; mevcut giriş e-posta/şifreyle. İmzalama sırasında portaldan elle kapatma. |
| Associated Domains | Şimdilik açma. `gina://` özel URL şeması bunu gerektirmez; HTTPS universal link kurulursa ayrıca değerlendirilir. |
| iCloud, App Groups, Apple Pay, Game Center | Mevcut sürüm için gerek yok. |
| Diğer seçenekler | Varsayılan durumlarında bırak. |

Değişiklikten sonra **Save** seçilir. Push kutusunu açmak tek başına yeterli değildir: build yetkileri, provisioning ve APNs kimlik bilgileri kurulup fiziksel cihazda doğrulanacak. Şimdi ayrıca sertifika üretmen gerekmiyor. Abonelik ürünleri App Store Connect'te ayrıca oluşturulur; Apple Pay seçeneği bunların yerine geçmez.

Bu ekrandaki **Description: Gina Aile** teknik kayıt etiketidir; mağaza açıklaması değildir. [Apple: capabilities](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/), [Explicit App ID ve varsayılan In-App Purchase](https://developer.apple.com/help/account/identifiers/register-an-app-id).

## 2. Supabase: üretim projesi

**Kayıt tamamlandı; yeni proje oluşturma.** Proje ID: `wixjxlxgyhgdacadsawo`. Mobil istemci için kullanılacak **kök URL**: `https://wixjxlxgyhgdacadsawo.supabase.co`. Paylaşılan `/rest/v1/` adresi REST uç noktasıdır; `EXPO_PUBLIC_SUPABASE_URL` değerine bu son ek yazılmaz.

Publishable key, mevcut istemcinin beklediği `EXPO_PUBLIC_SUPABASE_ANON_KEY` değişkenine yerel üretim dosyasında kaydedildi; değişkenin adı eski anon adlandırmasını taşısa da yapılandırma denetimi publishable key biçimini destekler. Anahtar rehbere veya Git'e eklenmez. Bu kayıt, canlı bağlantı ya da veritabanı şeması doğrulaması değildir. Aşağıdaki hesap oluşturma adımları referans olarak korunmuştur.

1. [Supabase Dashboard](https://supabase.com/dashboard) adresinde hesap aç ve giriş yap. Organizasyon oluştur; adını Gina olarak verebilirsin.
2. **New project** seç. Proje adı **gina-prod**. Veritabanı parolası oluştur ve parola yöneticine kaydet.
3. Bölge seçiminde genel “Europe” yerine **specific region → Central EU (Frankfurt), eu-central-1** seç. Bu projenin bölgesini sonradan bir düğmeyle değiştirmeyeceğiz. Genel bölge tercihi belirli Frankfurt konumunu garanti etmez. [Supabase bölgeleri](https://supabase.com/docs/guides/platform/regions).
4. Kurulum bitene kadar bekle. **Project Settings → General** içinden Project ID/Reference ID’yi; **Connect** veya **Settings → API** içinden Project URL’yi al.
5. **Settings → API Keys** içinden istemciye uygun **publishable key** veya eski projelerde **anon key** değerini kendi Mac’inde sakla. **secret/service_role** anahtarını mobil uygulama değişkenine koyma.
6. Bana **proje URL’si, reference ID ve seçilen bölgeyi** ilet. Anahtar değerini buraya yapıştırman gerekmiyor; yerel ortam dosyasına birlikte yerleştirebiliriz.

Şemayı ben hazırlayıp kontrol edeceğim. Yeni üretim projesine mevcut migration’lar uygulanacak; yerel demo veritabanı sıfırlanmayacak ve demo kayıtları üretime kopyalanmayacak. Üretim migration’ları tamamlanınca:

1. **Authentication → Sign In / Providers** altında Anonymous sign-ins açılır; eşleştirilen çocuk tableti bu oturumu kullanır. [Anonim oturumlar](https://supabase.com/docs/guides/auth/auth-anonymous).
2. **Authentication → Hooks → Custom Access Token** altında `public.custom_access_token_hook` seçilir. Listede henüz yoksa migration tamamlanmamıştır; başka bir fonksiyon seçme. [Token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).
3. İlk kapalı teknik beta için e-posta doğrulama ayarı repo kararıyla eşleştirilir. Gerçek ailelere açılmadan önce alan adı, SMTP, e-posta doğrulama ve şifre kurtarma uçtan uca çalışmalıdır. Supabase’in varsayılan e-posta servisi genel kullanıcı yayını için uygun değildir. [Özel SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
4. RLS, aile ayrımı, çocuk PIN’i, paylaşım süresi/iptali ve hesap silme üretim projesindeki ayrı test hesaplarıyla doğrulanır.

## 3. Expo/EAS: uygulamayı kendi hesabına bağla

**Proje oluşturma ve kod bağlantısı tamamlandı; yeni proje oluşturma.** Sahip `enescevik`, slug `gina-aile`, proje kimliği `8fc01433-eb6f-419e-a20b-edc30c8abe84`. Aşağıdaki adımlar yeniden kurulum için referanstır; mevcut kurulumda CLI girişinden devam edilir.

1. [Expo](https://expo.dev/signup) hesabını aç; e-postanı doğrula. Kullanıcı/organizasyon adını not et.
2. Mac’te Terminal aç. Projenin ana klasörüne git:

```sh
cd /Users/enes/Documents/projs/gina/apps/mobile
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest whoami
```

3. `whoami` doğru hesabı göstermeli. Sonra:

```sh
pnpm dlx eas-cli@latest init
```

4. Mevcut **gina-aile** projesini seç; sahibi **enescevik** olmalı. Mevcut bir Gina projesi gösterirse ikinci kopyayı oluşturmadan doğru sahipliği kontrol et.
5. Expo Dashboard’da proje açılmalı. Bana **Expo kullanıcı/organizasyon adını ve proje bağlantısını** ilet. `eas init` gerçek `extra.eas.projectId` değerini bağlar. Dinamik `app.config.js` nedeniyle otomatik yazamadığını söylerse verdiği proje kimliğini bana ilet; yapılandırmaya ben eklerim. Oluşan yerel değişiklikleri koruyacağız.

İlk etkileşimli kurulum için EXPO_TOKEN üretmek zorunda değilsin. Daha sonra otomasyon gerekirse token yalnız yerel güvenli ortamda/CI secret olarak tutulur. [Expo ilk proje ve build kurulumu](https://docs.expo.dev/build/setup/).

## 4. Benim tamamlayacağım ortam bağlantısı

Hesap bilgileri geldikten sonra şu işleri yapacağım:

- Yeni main’deki migration’ları üretim projesine uygulama ve Edge Functions’ı kurma.
- EAS project ID ve sayısal Apple ID’yi yapılandırma.
- Üretim Supabase adresini ve public istemci anahtarını yerel geliştirme `.env` dosyasını bozmadan ayrı, Git’in yok saydığı bir ortam dosyasına koyma.
- Web/legal adresleri, SMTP yönlendirmeleri ve etkin özelliklere ait sunucu secret’larını bağlama.
- Expo config, ikon, sürüm, izinler, iOS/Android/web export ve CI kontrolü.

Kontrol komutu (repo kökünde, üretim dosyası hazırlandıktan sonra):

```sh
node scripts/check-testflight.mjs --env-file apps/mobile/.env.production.local
```

Beklenen sonuç: “Yapılandırma kontrolü geçti”. `localhost`/`127.0.0.1` ile derlenen uygulama senin Mac’indeki servisi telefondan bulamaz. Bu komut yalnız dosya biçimlerini kontrol eder; gerçek bağlantı ve cihaz testinin yerine geçmez.

## 5. TestFlight build ve yükleme

Repo kararı gereği ilk imzalı build **Mac’te yerel** hazırlanır. Xcode, Command Line Tools, CocoaPods, fastlane, Node ve pnpm hazır olmalı. iOS signing adımında Apple hesabınla giriş/iki faktör doğrulamasını sen yapacaksın. Üretim ortamı yüklenmeden aşağıdaki komutları çalıştırma. Bu Mac için üretim ortamını yükleyen Git dışı başlatıcı hazır: `/Users/enes/Documents/projs/gina/.codex-setup/build-ios.command`. Terminal’de bu yolu çalıştırıp Apple hesabı girişini tamamla; parolayı sohbete veya repoya yazma. İlk derleme ve yükleme tamamlandı; bu komutlar sonraki paketleri üretmek içindir. Mevcut EAS imzalama bilgileri yeniden kullanılabilir.

```sh
cd /Users/enes/Documents/projs/gina/apps/mobile
pnpm dlx eas-cli@latest build --platform ios --profile production --local
```

Başarılı build’in verdiği `.ipa` yoluyla:

```sh
pnpm dlx eas-cli@latest submit --platform ios --profile production --path /TAM/YOL/gina.ipa
```

Yerel EAS build, buluttaki “Secret” değişkenlerini otomatik getirmez; gerekli değerler yerel ortamda sağlanır. Bu aşamada `eas build --local` ile `expo export` farklıdır: export JavaScript/asset paketini sınar, imzalı `.ipa` oluşturmaz. [Yerel build gereksinimleri](https://docs.expo.dev/build-reference/local-builds/).

Yükleme işlendikten sonra **App Store Connect → Gina Aile → TestFlight → Internal Testing → Team (Expo)** grubunu aç; son build’i ve kendi App Store Connect kullanıcını ekle. Grup mevcut; yeniden oluşturma. iPhone/iPad’e TestFlight kur, daveti kabul et, Gina’yı yükle. Harici test kullanıcıları için ayrıca Beta App Review süreci vardır. [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/), [iç test kullanıcıları](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers).

### iPad sürüm düzeltmesi — 2 Kasım 2026

İlk iPad kurulumunda eski **0.1.0 (6)** paketi kullanıldı; bu nedenle giriş ekranı ve logo güncel tasarımdan farklıydı. Bu paket güncel sürüm olarak kullanılmamalıdır. `init` sohbetinin **0.1.0 (16)** paketi (EAS `43136ef5-bb94-4097-9a04-0f9624373dbe`, commit `86c819dccdd2cd23db713163805d97defe8ff49f`) kaynak alınarak `.codex-setup/gina-ipad-16-adhoc.ipa` hazırlandı. Paket sürümü, imza ve kayıtlı iPad doğrulandı. iPad’de kurulu uygulama bilgisi `version=0.1.0`, `bundleVersion=16` olarak okundu ve uygulama başarıyla başlatıldı. Gelecek teslimlerde dosya adına/güncel olmayan kurulum notuna güvenmeden hedef build numarası ve kaynak commit doğrulanmalıdır.

Her sürümde USB zorunlu değildir: EAS `distribution: internal` ile üretilen Ad Hoc paket, kayıtlı iPad’de Safari üzerinden kurulum bağlantısıyla yüklenebilir. Telefon TestFlight sürümü ile iPad Ad Hoc sürümü ayrı dağıtılır; biri diğerini otomatik güncellemez. Son onaylı kaynak commit ve üretim ortamı kullanılarak iPad paketi de üretilmelidir. EAS `build:resign` mevcut **store** build 16’yı internal’a çevirmeyi reddetti; ilk teslim yerel yeniden imzalama ile yapıldı. Ardından aynı kaynak commit’inden internal build `1aca834a-742c-472f-9928-0e00b4f04455` tamamlandı; imzası, 0.1.0 (16) sürümü ve kayıtlı iPad profili doğrulandı. EAS’in yeniden imzalama komutu zaten internal olan paketler için kullanılabilir. [Expo internal dağıtım](https://docs.expo.dev/build/internal-distribution/).

**Sabit kablosuz kurulum bağlantısı:** https://gina-aile-enescevik--tablet.expo.app — iPad Safari’de aç → **Yükle / Güncelle** → Expo **Install** → iOS yükleme onayı. Mevcut Gina’yı silme. Sayfa ve paket doğrulandı; kablosuz kurulumun cihazdaki son onayı kullanıcıya aittir. Her yeni onaylı TestFlight sürümünde tablet paketi de aynı commit/sürümle hazırlanıp bu sayfa güncellenir; kurulum otomatik başlamaz. Ayrıntılı akış: [Tablet kablosuz dağıtım](TABLET-KABLOSUZ-DAGITIM.md).


Aşağıdaki build 6 kaydı geçmiş kurulum kaydıdır; güncel paket seçimi için kullanılmamalıdır.

### Çocuk iPad’inde TestFlight olmadan test — 2 Kasım 2026

TestFlight çocuk hesabında yaş sınırı nedeniyle açılamadığı için iPad Air (5. nesil), iPadOS 26.6.1, geliştirici hesabına test cihazı olarak kaydedildi. Kullanıcı Geliştirici Modu’nu açtı. Mevcut **0.1.0 (6)** IPA, yalnız bu iPad’i içeren Ad Hoc profil `59YXGHPYC3` ile yeniden imzalandı; kaynak kod yeniden derlenmedi. Profil son kullanma tarihi 31 Ekim 2027. TestFlight/mağaza profili korunuyor.

- [x] Paket: `.codex-setup/gina-ipad-adhoc.ipa`; kod imzası, cihazın profilde bulunması ve production APNs yetkisi doğrulandı.
- [x] USB üzerinden `com.enescevik.gina` kuruldu ve başlatıldı. Kurulum/başlatma sonuçları Git dışındaki `ipad-install.json` ve `ipad-launch.json` dosyalarında.
- [x] Lint ve typecheck geçti. Bu kontroller mevcut kaynak ağacına aittir; iPad’deki paket build 6’dır.
- [ ] Aile eşleştirme ve diğer gerçek cihaz kabul kontrolleri kullanıcıyla tamamlanacak.

Tablette **Bu cihaz çocuk tableti → Eşleştirme kodu al** seçilir. Veli telefonunda Gina hesabına girilip **Cihaz ekle** üzerinden tablet kodu girilir (10 dakika geçerli). Tablette ayrı çocuk e-posta hesabı oluşturmak gerekmez. Kurulum sonrasında kablo bağlantısı gerekmez; eşleştirme/senkronizasyon için internet gerekir.

Ad Hoc kimlik bilgileri EAS’te ve Git’in yok saydığı `apps/mobile/credentials.json` / `apps/mobile/credentials/ios/` altında, `600` dosya izniyle tutuluyor. Geçici imzalama keychain’i işlem sonunda silindi. IPA bu profile kayıtlı cihaz içindir; yeni cihaz eklendiğinde profil/paket yeniden hazırlanmalıdır.

## 6. Gerçek cihaz kabulü: seninle birlikte

Her madde iPhone ve iPad’de gerçek build üzerinde doğrulanacak:

- İlk kurulum, veli kayıt/giriş, e-posta doğrulama ve şifre kurtarma.
- Aile/çocuk ekleme, PIN, tablet eşleştirme; yanlış PIN ve yeniden açılışta çocuk modu kilidi.
- Görev tamamlama → veli onayı/geri gönderme → yıldız; iki cihazda güncelleme, tekrar dokunmada çift kayıt olmaması.
- Oda karakter/pet kaydı, hedef seçimi, ödül talebi/teslimi ve koleksiyon.
- Prova cevap kaydı, geri/ileri, süre sınırı, bağlantı kesilip geri gelmesi ve sonuçlar.
- Büyük yazı, VoiceOver, klavye açıkken form, safe area, tablet yön değişimi, hareketi azalt ayarı.
- Bildirim izni reddedilince kullanım; etkinse gerçek push, satın alma/geri yükleme ve AI akışları.
- Hesap silme; başka aileye erişememe; paylaşım linkinin süresi ve iptali.

Doğal pet esnemesi/oyunu/sesi ve canlı konuma bağlı hava henüz yalnız statik görsellerle karşılanamaz. Bunun için tutarlı animasyon kaynağı/rig, sesler, lisanslar, hava verisi, izin/çevrimdışı davranışı ve cihaz performans ölçümü ayrıca tamamlanmalı. Bu özelliklere “hazır” etiketi koymayacağız.

## 7. Mağazaya çıkmadan önce senden gerekenler

1. Alan adı ve destek e-postası seç; satın almayı kendi hesabından yap. Gizlilik ve destek sayfalarının kalıcı HTTPS adresleri gerekiyor.
2. Şirket/gerçek kişi yayıncı bilgilerini ve yasal iletişim adresini kesinleştir. `docs/legal` taslaklarını gerçek ürün davranışıyla birlikte yetkin danışmana kontrol ettir; taslak metinleri doldurmadan yayınlama.
3. App Store Connect’te yaş derecelendirmesi ve App Privacy sorularını kullanılan veri akışlarına göre cevapla. Çocuklara yönelik sınıflandırmayı yalnız görsel tarza göre seçme.
4. Ücretli özellik çıkacaksa sözleşme/banka/vergi ve abonelik ürünlerini hesabında tamamla; satın alma/geri yükleme ve sunucu doğrulaması çalışmadan paketleri satışa açma.
5. Nihai cihaz ekran görüntüleri, destek/gizlilik URL’leri, inceleme notları ve inceleme için ayrı test hesabı hazır olunca mağaza başvurusunu yapacağız. Apple inceleme sonucunu önceden garanti edemeyiz.

### 7.1. Mağaza adı, kategori ve hazır metinler

App Store Connect → **Gina Aile → App Information** alanlarını şu taslakla doldur. Kategori önerisi mevcut aile düzeni odağına dayanır; nihai ürün kapsamına göre doğrulanır.

| Alan | Önerilen değer |
| --- | --- |
| Name | Gina Aile |
| Subtitle | Ailenizin günlük düzeni |
| Primary Language | Turkish |
| Primary Category | Lifestyle / Yaşam Tarzı |
| Secondary Category | Education / Eğitim — isteğe bağlı |

Ad ve alt başlık en fazla 30 karakter olabilir. [Apple: uygulama bilgileri](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information).

**Distribution → iOS sürümü** sayfasında aşağıdaki taslağı kullan. Yayına gönderirken yalnız o build'de çalışan ve cihazda doğrulanmış özellikleri tut.

**Promotional Text:**

> Aile takvimini, günlük görevleri ve ödülleri tek yerde buluşturun. Gina ile günlük planları birlikte takip edin.

**Description:**

```text
Gina Aile, ebeveynlerin aile içindeki günlük planları, görevleri ve sorumlulukları tek yerde takip etmesine yardımcı olur.

Gününüzü birlikte planlayın
Aile takvimini ve günlük görevleri düzenleyin; yapılacakları kolayca takip edin.

Küçük adımları görünür kılın
Tamamlanan görevleri ebeveyn onayıyla değerlendirin. Yıldızlar, hedefler ve ödüllerle ilerlemeyi takip edin.

Aile düzenini birlikte yönetin
Çocuk profillerini yönetin ve eşleştirilen cihazdaki çocuk moduyla günlük görevlerin takip edilmesini sağlayın.

Gina Aile ile günlük sorumluluklara birlikte yer açın.
```

**Keywords:**

```text
takvim,görev,rutin,ebeveyn,ödül,sorumluluk,planlayıcı,okul
```

Henüz tamamlanmamış canlı hava, pet animasyonları veya doğrulanmamış AI özelliklerini açıklamada vaat etme. Abonelik yayınlanırsa ilgili ücretli kapsam ve koşullar nihai metne eklenir.

### 7.2. İkon ve ekran görüntüleri

İkon kaynağı `apps/mobile/assets/images/icon.png` (1024 × 1024 px). Açık/koyu/renklendirilmiş iOS ikonları `app.json` içinde tanımlı. **Mağaza ikonu build ile gelir**; ekran görüntüsü alanına yüklenmez. [Apple: ikon ekleme](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/).

Ekran görüntülerini **Distribution → iOS sürümü → App Previews and Screenshots** alanına yükle. Gina'nın `supportsTablet: true` ayarı nedeniyle iPad görselleri de gerekir. 31 Ekim 2026 tarihinde kontrol edilen Apple tablosuna göre kullanılabilecek ölçüler:

| Cihaz grubu | Önerilen çıktı ölçüsü |
| --- | --- |
| iPhone — Dynamic Island, orta ekran | 1206 × 2622 px dikey |
| iPad — 13 inç | 2064 × 2752 px dikey veya 2752 × 2064 px yatay |

Görseller şeffaflık/alfa kanalı içermemeli. Yüklemeden önce [Apple'ın güncel ölçü tablosunu](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) ve paneldeki cihaz alanını kontrol et.

Her cihaz grubu için önerilen beş görsel:

1. **Ailenizin günü tek yerde** — veli ana ekranı.
2. **Günlük görevleri birlikte takip edin** — görev listesi.
3. **Küçük adımlar, ortak hedefler** — yıldız ve ödüller.
4. **Haftanızı birlikte planlayın** — takvim.
5. **Çocuk modu ile kolay takip** — çocuk ekranı.

Son iOS build'inin gerçek ekranlarını örnek aile verileriyle çek. Repodaki tasarım/QA görselleri doğrudan mağaza teslimi sayılmaz. Üst başlık eklenebilir ama ekrandaki gerçek ürün davranışı korunmalı. İlk yayında tanıtım videosu isteğe bağlı; atlanabilir. Mağaza görsellerini tamamlamak ilk iç TestFlight testinin ön koşulu değildir.

### 7.3. Diğer App Store Connect alanları

- [ ] **Support URL:** çalışan HTTPS destek sayfası ve iletişim e-postası.
- [ ] **Privacy Policy URL:** gerçek veri kullanımını anlatan, yayına açık gizlilik sayfası. `docs/legal` taslaklarını tamamlamadan kullanma.
- [ ] **App Privacy:** hesap/aile verileri işlendiği için otomatik olarak “veri toplamıyoruz” seçme. Üretimdeki veri türlerini, amaçlarını, kullanıcıyla ilişkilendirmeyi ve varsa izlemeyi gerçek akışlara göre doldur.
- [ ] **Age Rating:** anketi gerçek özelliklere göre cevapla; yaş derecesini tahmin ederek seçme.
- [ ] **Made for Kids:** sırf çocuk ekranı bulunduğu için işaretleme. Hedef kitle, mağaza metinleri ve Kids kurallarını birlikte değerlendir. Bu sınıflandırma onaydan sonra değiştirilemez. [Apple: uygulama bilgileri ve Made for Kids](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information).
- [ ] **Pricing and Availability:** ücretsiz indirme + uygulama içi abonelik modeli seçilirse indirme fiyatı **Free** olur. Yayın ülkelerini seç; abonelikleri **Subscriptions** altında ayrıca kur. Ücretli kapsamı cihazda satın alma/geri yükleme ve sunucu doğrulaması geçmeden satışa açma.
- [ ] **App Review Information:** çalışan ayrı inceleme hesabı, iletişim bilgileri, çocuk modu/PIN/eşleştirme adımları ve varsa özel erişim talimatları. Gerçek aile hesabını verme.
- [ ] **Build:** yüklenen ve işlenmesi tamamlanan doğru sürümü seç. App Store sürüm kaydı ile build sürümünü eşleştir.
- [ ] **Copyright / Content Rights:** gerçek hak sahibini ve kullanılan içeriklerin lisans durumunu doğru belirt.
- [ ] **Version Release:** ilk yayın için **Manually release this version** önerilir; Apple onayından sonra yayın zamanını sen belirlersin.

## Bana göndereceğin kısa durum mesajı

```text
Supabase: seçilen gerçek bölge (proje ID ve URL kaydedildi)
Expo: kullanıcı veya organizasyon / proje bağlantısı
Apple: kayıt ve Push Notifications tamamlandı (kimlikler kaydedildi)
Alan adı ve destek e-postası: seçildi / henüz seçilmedi
```

Parolalar, EXPO_TOKEN, service_role/secret anahtarları, veritabanı parolası ve `.p8` dosyası sende kalır. Bir adımda takılırsan bölüm ve adım numarasıyla görünen hata metnini yaz; gizli değerleri çıkar.

## 8. Hesap akışlarının üretim kurulumu ve kabulü

- Supabase Auth **URL Configuration → Redirect URLs** listesine `gina://reset-password` ve yayımlanmış web uygulamasının `https://GERCEK-ADRES/reset-password` adresini ekle. Yerel geliştirme için `http://localhost:8081/reset-password` ayrı kalır. Site URL gerçek web adresidir. Joker olarak her alan adına izin verme.
- Özel SMTP hazır olduktan sonra girişten **Şifremi unuttum** ile kendi test e-postana bağlantı gönder. İsteği yaptığın cihazda aç; iki şifre farklıyken Kaydet kapalı, eşleşince başarılı olmalı. Eski/kullanılmış bağlantı hata göstermeli. iPhone uygulaması kapalıyken ve açıkken ayrı dene. PKCE bağlantısını başka tarayıcıda açmak geçerli sayılmaz.
- Yeni `delete-account` Edge Function da deploy edilmeli. `verify_jwt=true` korunur; sunucu ortamındaki service role anahtarı mobil uygulamaya konmaz. Silme için kullan-at bir aile hesabı aç: yanlış şifre reddedilmeli, doğru şifreyle silinmeli; eski cihaz ve veli token'ları veri okuyamamalı. İki velili test ailesinde diğer velinin çocuk verisi kalmalı. Bu testleri mevcut demo ailesiyle yapma.
- E-posta/şifre beta girişidir. Apple/Google giriş düğmeleri sağlayıcılar kurulup test edilene kadar gösterilmiyor. Hesap silme aboneliği iptal etmez; mağaza yönetimi ayrıca test edilir.
- Yayımlanacak hukuki metinler hâlâ taslak: planlı silme, web silme talebi, saklama ve yedekten imha gibi yazılı vaatlerin bir bölümü uygulanmış değil. `docs/legal/hesap-ve-veri-silme.md` başındaki uygulama denetimini esas al; metin ile gerçek ürün uyuşmadan mağazaya gönderme.

## 9. Animasyon, hava ve Android bildirimi için ayrı kabul

[Pet ve hava üretim brief'i](PET-VE-HAVA-URETIM-KABULU.md) kaynak görselleri, tek kedi örneğinin kliplerini, artist teslimini ve cihaz kabul ölçütlerini verir. V5 statik katmanlar hazır; organik esneme/oyun/ses ve canlı hava henüz tamamlanmadı. Önce tek kedi örneği; kaliteyi görmeden dört hayvanlık üretime girilmez.

Android FCM dosyası iOS TestFlight için gerekmez. Android bildirimi kurulunca gerçek `google-services.json` yerel/CI güvenli dosyası olarak sağlanır; `GOOGLE_SERVICES_JSON` dosya değişkeni veya `apps/mobile/google-services.json` kullanılabilir. Dosya yokken sahte Firebase yapılandırması üretilmez. İlgili APNs/FCM sunucu anahtarları da ayrıca kurulup fiziksel cihazda denenir. Uygulama v5'in açık paletini kullanır; oda içindeki gece atmosferi ayrı sanat/veri işidir.
