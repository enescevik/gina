# Gina iPad kablosuz test dağıtımı

Bu akış çocuk hesabının kullanamadığı TestFlight yerine, geliştirici hesabına kaydedilmiş iPad için Ad Hoc paket üretir. Telefon ve tablet aynı onaylı kaynak commit’inden ve aynı sürüm numarasıyla teslim edilir. Kullanıcı 2 Kasım 2026’da bundan sonraki `init` sürümlerinin tablet için de bu şekilde yayımlanmasını istedi.

## Canlı bağlantı

https://gina-aile-enescevik--tablet.expo.app

2 Kasım 2026: 0.1.0 (16), kaynak `86c819dccdd2cd23db713163805d97defe8ff49f`, internal build `1aca834a-742c-472f-9928-0e00b4f04455`, Hosting deployment `ni9xihgvnv`. İmza, kayıtlı iPad, sürüm ve canlı `release.json` doğrulandı. Kablosuz kurulumun cihazdaki son onayı henüz kullanıcı tarafından denenmedi.

## Her sürümde

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
