# Gina iPad kablosuz test dağıtımı

Bu akış çocuk hesabının kullanamadığı TestFlight yerine, geliştirici hesabına kaydedilmiş iPad için Ad Hoc paket üretir. Telefon ve tablet aynı onaylı kaynak commit’inden ve aynı sürüm numarasıyla teslim edilir. Kullanıcı 2 Kasım 2026’da bundan sonraki `init` sürümlerinin tablet için de bu şekilde yayımlanmasını istedi.

## Canlı bağlantı

https://gina-aile-enescevik--tablet.expo.app

**6 Kasım 2026 güncel (C14b):** **0.1.0 (29)**, canlı dağıtım `b9q067lwk9`, kaynak `8fb2eef`, IPA SHA-256 `d2d254c663c3…`; önceki 28 dağıtımı `m8aeavsrur` (geri dönüş: `eas deploy:alias --alias tablet --id m8aeavsrur`). Canlı alias doğrulaması dağıtımdan hemen sonra CDN gecikmesiyle bir kez düştü, ardından `verify --target tablet` temiz.

**6 Kasım 2026 (C14):** **0.1.0 (28)**, canlı dağıtım `m8aeavsrur`, IPA SHA-256 `116a7fad02a3…`, tek kayıtlı cihaz; önceki 27 dağıtımı `7hteqzifmy`.

**6 Kasım 2026 (önceki):** **0.1.0 (27)**, TestFlight 27 ile aynı uygulama kodundan Ad Hoc paket; [yayın raporu](tablet-27-2026-11-06/README.md), canlı dağıtım `7hteqzifmy`; fiziksel iPad kurulum onayı kullanıcıda.

**5 Kasım 2026 (önceki):** **0.1.0 (26)**, TestFlight 26 ile aynı `1f1b505b9b8e9d8491554f22c1ff194142956a32` kaynağından Ad Hoc paket. [Yayın ve imza/cihaz kontrolü](tablet-26-2026-11-05/README.md). Canlı dağıtım `sbfnt5ls4x`; fiziksel iPad kurulum onayı kullanıcıda.

İlk kayıt (tarihsel), 2 Kasım 2026: 0.1.0 (16), kaynak `86c819dccdd2cd23db713163805d97defe8ff49f`, internal build `1aca834a-742c-472f-9928-0e00b4f04455`, Hosting deployment `ni9xihgvnv`. İmza, kayıtlı iPad, sürüm ve canlı `release.json` doğrulandı. Kablosuz kurulumun cihazdaki son onayı henüz kullanıcı tarafından denenmedi.

## Yayın kontrolü: iki ayrı kurulum yolu

- Telefon/uygun Apple hesabı için TestFlight; kayıtlı çocuk iPad’i için bu kablosuz kurulum sayfası ayrı yayımlanır. TestFlight’ın tamamlanması tablet bağlantısının güncellendiği anlamına gelmez.
- Çocuk tableti sorulduğunda önce bu sayfanın canlı `release.json` kaydı okunur; yalnız başka bir TestFlight hesabında görülen iPad kurulumundan çocuğun tabletinin sürümü çıkarılmaz.
- Her iki yolun da sürüm/kaynak eşleşmesi yayın raporuna yazılmadan “telefon ve tablet yayımlandı” denmez. Kurulum sayfasında sürüm güncellenmeden kullanıcı eski pakete yönlendirilmez.
- TestFlight hesabı veya veli Apple hesabı bu Ad Hoc yolunda gerekli değildir. Cihaz, paket profilindeki kayıtlı cihazlardan biri olmalıdır.

## Yerel EAS paketi kullanıldığında

Bulut kota sınırında aynı kaynak commit'inden `eas build --platform ios --profile tablet --local --non-interactive --output ...` ile gerçek Ad Hoc IPA hazırlanabilir. `autoIncrement: false` ve EAS uzaktaki sürüm numarası, tamamlanan TestFlight sürümüyle eşleşmeli. Store IPA yeniden etiketlenmez; `prepare-tablet-install.mjs` için sahte bulut build JSON'u oluşturulmaz.

1. Gerçek IPA imzasını, bundle kimliği/sürümünü, üretim adreslerini ve gömülü profilin kayıtlı cihaz listesini doğrula. Yeni cihaz eklenmediyse önceki çalışan Ad Hoc paketiyle cihaz listesi aynı olmalı. Rapora UDID, özel anahtar veya kullanıcı verisi koyma.
2. Yerel IPA, aynı kaynaktaki ikon, `index.html`, `release.json` ve iOS `manifest.plist` ile ayrı bir statik kurulum klasörü hazırla. Manifest pakete HTTPS URL ile yönlenir; düğme `itms-services` ile manifesti açar. Safari önbelleğine karşı hem IPA hem manifest dosya adı sürüm içermeli (`gina-26.ipa`, `manifest-26.plist` gibi).
3. Önce EAS Hosting önizlemesine yükle. İndirilen paketin SHA-256 değerini yerel doğrulanmış IPA ile karşılaştır; sayfa/manifest sürümünü kontrol et.
4. Kontrol geçince yalnız `tablet` alias'ını yeni dağıtıma bağla; `--prod` kullanma. Canlı alias'tan IPA hash'ini, manifesti ve `release.json` kaydını tekrar doğrula. Önceki dağıtım kimliğini ve yayın kaydını geri dönüş için koru.
5. Sonuç, web sayfası ve paket yayınıdır. iPad'deki kurulum onayı kullanıcı tarafından verilmeden cihaz kurulumu tamamlanmış sayılmaz.

## Bulut build kullanıldığında, her sürümde

1. `init` sohbetinde onaylanmış TestFlight build ID, sürüm numarası ve kaynak commit’i belirle. Eski yerel IPA’yı veya başka worktree’nin HEAD’ini güncel sayma.
2. Aynı kaynak snapshot’ında `apps/mobile/eas.json` içine `tablet` profilini ekle: `extends: production`, `distribution: internal`, `autoIncrement: false`, `environment: production`, `channel: production`. Üretim Supabase/web ayarları kullanılmalı. Profil kayıtlı iPad’i içermeli.
3. TestFlight build numarasının henüz değişmediğini doğrulayarak `eas build -p ios --profile tablet --non-interactive --no-wait --json` çalıştır. Başka sürüm numarası çıkarsa yayımlama. Yeni cihaz eklenirse Ad Hoc profilini yenile.
4. Canlı sayfanın `release.json` dosyasını alıp OUTPUT_DIR içindeki önceki kayıt olarak sakla; yeni bir worktree’de de eski sürüme dönüş kontrolü çalışsın. İki build’in tamamlanmış JSON kaydını `eas build:view ID --json` ile al. `node scripts/prepare-tablet-install.mjs STORE_JSON TABLET_JSON ICON_PNG OUTPUT_DIR` çalıştır. İkon aynı kaynak snapshot’ından gelmeli. Script proje kimliği, bundle ID, fiziksel iOS, bitmiş durum, Store/Internal türü, sürüm ve commit eşitliğini doğrular; daha eski sürüme dönüşü reddeder.
5. Ad Hoc IPA’nın imzasını, sürümünü ve `embedded.mobileprovision` içindeki kayıtlı cihazı doğrula. `expo.dev/.../builds/ID` kurulum sayfasının gerçekten Install düğmesi sunduğunu kontrol et.
6. Gina EAS projesinin mobil dizininden `eas deploy --export-dir OUTPUT_DIR --alias tablet --environment production --non-interactive` çalıştır. OUTPUT_DIR mobil dizine göre göreli yol olmalı (bu çalışma alanında `../../.codex-setup/tablet-install`). **`--prod` kullanma:** bu sayfa ana web uygulamasını değiştirmemeli. Aynı `tablet` alias’ını her sürümde yeni sayfaya bağla.
7. Canlı sayfanın `release.json` dosyasındaki build/commit/URL’yi doğrula ve iPad Safari kurulum bağlantısını kullanıcıya ver. Apple’ın kurulum onayı cihazda kullanıcı tarafından verilir. Cihaz kurulumu denenmediyse “kurulum tamamlandı” deme.

## Davranış ve sınırlar

- Kablo her güncellemede gerekmez. Kayıtlı iPad’de Safari üzerinden sayfa → Expo Install → iOS yükleme onayı kullanılır.
- Yeni sürüm otomatik kurulmaz; kullanıcı sayfayı açıp günceller. Uygulamayı silmesine gerek yoktur.
- TestFlight sürümü kendiliğinden bu sayfaya yansımaz. Her onaylı sürümde tablet build + sayfa yayını da yapılmalıdır.
- EAS `build:resign` Store build’i Internal’a çevirmeyi reddeder. Önceden internal hazırlanmış build’in cihaz listesi/imzasını yenilemek için kullanılabilir.
- Ad Hoc paket yalnız profilindeki cihazlarda çalışır; yeni tablet için yeniden kayıt/profil/paket gerekir. Mevcut profil 31 Ekim 2027’de sona eriyor.
- EAS kurulum URL’sini bilen biri paketi indirebilir; kurulum cihaz profiliyle sınırlıdır. Sayfada UDID, e-posta, özel anahtar veya kullanıcı verisi yayımlanmaz.
- Secret’lar, p12, provisioning ve özel anahtarlar bu statik yayın klasörüne konmaz.

Kaynak: https://docs.expo.dev/build/internal-distribution/
