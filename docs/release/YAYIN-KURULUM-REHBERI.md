# Gina · TestFlight’tan mağazaya kurulum rehberi

31 Ekim 2026. İlk hedef iPhone/iPad TestFlight betası, ardından mağaza. Apple Developer üyeliğin aktif. Supabase, Expo/EAS ve App Store Connect uygulama kaydı henüz kurulmadı. Aşağıdaki hesap açma adımlarını sen, kod/şema/ortam bağlantısı ve derleme doğrulamasını ben tamamlayacağım.

**Şimdi yalnız 1, 2 ve 3. bölümleri yapman yeterli.** Sonunda proje adreslerini ve kimliklerini ilet; şifre veya özel anahtar gönderme. Hesapların açılması uygulamanın yayına hazır olduğu anlamına gelmez. Güncel denetim ve gerçek cihaz kabulü tamamlanınca build gönderilir.

## 1. Apple: mevcut üyeliğinle Gina kaydı

1. [App Store Connect](https://appstoreconnect.apple.com/) adresinde aktif Developer üyeliğinin bağlı olduğu Apple hesabıyla giriş yap. Birden fazla takım görünürse Gina’nın sahibi olacak takımı seç.
2. **Business** bölümünde bekleyen sözleşme varsa oku ve kabul et. Üyelik satın alma adımına ihtiyacın yok.
3. **Apps → + → New App** yolunu aç. Platform **iOS**, ad **Gina Aile**, ana dil **Turkish**, Bundle ID **com.enescevik.gina**, SKU **gina-2026** kullan. Uygulama adı uygun değilse kaydı zorlamak yerine bana görünen mesajı yaz.
4. Bundle ID listede yoksa [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers → + → App IDs → App**: açıklama Gina Aile, **Explicit Bundle ID** `com.enescevik.gina`. Kaydet, App Store Connect sayfasını yenile.
5. Uygulama oluştuktan sonra **App Information → Apple ID** alanındaki sayısal kimliği not et. Bu, Apple hesabının e-postası veya Team ID değildir.
6. Bana **sayısal Apple ID’yi ve takım adını** ilet. Ben `apps/mobile/eas.json` içindeki `APP_STORE_CONNECT_APP_ID` yer tutucusunu bu değerle değiştireceğim.

Başarı işareti: Apps listesinde Gina Aile görünür, durum **Prepare for Submission** olur. Apple’ın [uygulama kaydı yönergesi](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) bu adımları açıklar.

İlk yükleme için şimdi `.p8` üretmen zorunlu değil. EAS Submit’in yönlendirdiği kimlik doğrulamasını kullanabiliriz. API anahtarı tercih edersek **Users and Access → Integrations → App Store Connect API → Team Keys** üzerinden yetkili anahtar üretir, `.p8` dosyasını güvenli yerel klasörde saklarız. Dosyayı sohbete/repoya koyma. [EAS iOS gönderimi](https://docs.expo.dev/submit/ios/).

## 2. Supabase: üretim projesi

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

4. Yeni proje oluşturmayı seç; ad **gina**, sahibi kendi hesabın/organizasyonun olsun. Mevcut bir Gina projesi gösterirse ikinci kopyayı oluşturmadan doğru sahipliği kontrol et.
5. Expo Dashboard’da proje açılmalı. Bana **Expo kullanıcı/organizasyon adını ve proje bağlantısını** ilet. `eas init`, gerçek `extra.eas.projectId` değerini app yapılandırmasına ekler; bu yerel değişikliği koruyacağız.

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

Repo kararı gereği ilk imzalı build **Mac’te yerel** hazırlanır. Xcode, Command Line Tools, CocoaPods, fastlane, Node ve pnpm hazır olmalı. iOS signing adımında Apple hesabınla giriş/iki faktör doğrulamasını sen yapacaksın. Üretim ortamı yüklenmeden aşağıdaki komutları çalıştırma.

```sh
cd /Users/enes/Documents/projs/gina/apps/mobile
pnpm dlx eas-cli@latest build --platform ios --profile production --local
```

Başarılı build’in verdiği `.ipa` yoluyla:

```sh
pnpm dlx eas-cli@latest submit --platform ios --profile production --path /TAM/YOL/gina.ipa
```

Yerel EAS build, buluttaki “Secret” değişkenlerini otomatik getirmez; gerekli değerler yerel ortamda sağlanır. Bu aşamada `eas build --local` ile `expo export` farklıdır: export JavaScript/asset paketini sınar, imzalı `.ipa` oluşturmaz. [Yerel build gereksinimleri](https://docs.expo.dev/build-reference/local-builds/).

Yükleme işlendikten sonra **App Store Connect → Gina Aile → TestFlight → Internal Testing → +** ile “Gina iç beta” grubu oluştur; build’i ve kendi App Store Connect kullanıcını ekle. iPhone/iPad’e TestFlight kur, daveti kabul et, Gina’yı yükle. Harici test kullanıcıları için ayrıca Beta App Review süreci vardır. [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/), [iç test kullanıcıları](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers).

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

## Bana göndereceğin kısa durum mesajı

```text
Supabase: proje URL’si / reference ID / eu-central-1
Expo: kullanıcı veya organizasyon / proje bağlantısı
Apple: takım adı / uygulamanın sayısal Apple ID’si
Alan adı ve destek e-postası: seçildi / henüz seçilmedi
```

Parolalar, EXPO_TOKEN, service_role/secret anahtarları, veritabanı parolası ve `.p8` dosyası sende kalır. Bir adımda takılırsan bölüm ve adım numarasıyla görünen hata metnini yaz; gizli değerleri çıkar.

## 8. Hesap akışlarının üretim kurulumu ve kabulü

- Supabase Auth **URL Configuration → Redirect URLs** listesine `gina://reset-password` ve yayımlanmış web uygulamasının `https://GERCEK-ADRES/reset-password` adresini ekle. Yerel geliştirme için `http://localhost:8081/reset-password` ayrı kalır. Site URL gerçek web adresidir. Joker olarak her alan adına izin verme.
- Özel SMTP hazır olduktan sonra girişten **Şifremi unuttum** ile kendi test e-postana bağlantı gönder. İsteği yaptığın cihazda aç; iki şifre farklıyken Kaydet kapalı, eşleşince başarılı olmalı. Eski/kullanılmış bağlantı hata göstermeli. iPhone uygulaması kapalıyken ve açıkken ayrı dene. PKCE bağlantısını başka tarayıcıda açmak geçerli sayılmaz.
- Yeni `delete-account` Edge Function da deploy edilmeli. `verify_jwt=true` korunur; sunucu ortamındaki service role anahtarı mobil uygulamaya konmaz. Silme için kullan-at bir aile hesabı aç: yanlış şifre reddedilmeli, doğru şifreyle silinmeli; eski cihaz ve veli token'ları veri okuyamamalı. İki velili test ailesinde diğer velinin çocuk verisi kalmalı. Bu testleri mevcut demo ailesiyle yapma.
- E-posta/şifre beta girişidir. Apple/Google giriş düğmeleri sağlayıcılar kurulup test edilene kadar gösterilmiyor. Hesap silme aboneliği iptal etmez; mağaza yönetimi ayrıca test edilir.
- Yayımlanacak hukuki metinler hâlâ taslak: planlı silme, web silme talebi, saklama ve yedekten imha gibi yazılı vaatlerin bir bölümü uygulanmış değil. `docs/legal/hesap-ve-veri-silme.md` başındaki uygulama denetimini esas al; metin ile gerçek ürün uyuşmadan mağazaya gönderme.
