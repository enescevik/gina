# Native taslak kurtarma kabulü — 4 Kasım 2026

Bu bir ürün ekranı veya yeni tasarım değildir. Gerçek mobil `createAnswerJournal`,
`createReviewJournal` ve `expo-sqlite/kv-store` ile ayrı sentetik kapsamda çalıştırılan
geçici kabul rotasıdır. Gerçek aile/demo kaydı kullanılmadı.

## Sonuç

- iPad Air 11-inch M4 / iOS 26.5 simülatörü: geçti.
- iPhone 17 Pro / iOS 26.5 simülatörü: geçti.
- Pixel 6 Pro / Android API 33 arm64 ekransız emülatörü: geçti (aşağıdaki ek kabul).
- Her cihazda çocuk için biri gönderilmemiş, diğeri yanıtı kaybolmuş iki kayıt;
  veli için aynı iki durum ayrı ayrı saklandı.
- Geliştirme uygulamasının işletim sistemi süreci `simctl terminate` ile kapatıldı.
  Yeni süreç başlatıldı; yalnız ekran yeniden bağlanması veya React remount değildir.
- Çizgi noktaları, yazı, puan, geri bildirim, ayrı veli çizim katmanı ve uygulanmış
  AI kimliği JSON karşılaştırmasıyla aynen geri geldi.
- Belirsiz kayıtların özgün istek kimlikleri korundu. Çocuğun bekleyen isteğin
  ardından yaptığı düzenleme de korundu; önce eski istek, ardından yeni düzenleme
  doğru revizyon sırasıyla işlendi.
- Geçersiz veli makbuzu yerel kaydı silmedi. Başarılı yanıt yalnız kendi kaydını
  kaldırdı; diğer gönderilmemiş taslaklar korundu.
- Test sonunda yalnız bu kabulün sentetik kapsamındaki kayıtlar temizlendi.
  Uygulamanın tüm kayıtlarını temizleyen çıkış/clear işlevleri kullanılmadı.

Her iki cihazda `GEÇTİ` sonucu erişilebilirlik ağacında görüldü, iPad sonucu ayrıca
CUA ekran görüntüsüyle incelendi. Simulator'ın Save Screen menüsü devre dışıydı;
bu teslimde yeni PNG dosyası yoktur. `verification.json` gözlemi ve sınırları kaydeder.
Simülatörün imzasız Debug derlemesindeki bildirim/keychain yetkisi uyarısı devam etti;
bu test bildirim veya gerçek oturum kabulü değildir.

## Düzeltme

Veli journal makbuzu sıfır veya güvenli tam sayı sınırını aşan revizyonu kabul edip
taslağı kaldırabiliyordu. Sekiz yeni kontrolden ikisi düzeltme öncesinde başarısızdı.
Artık pozitif güvenli tam sayı ve taban revizyonu denetlenir; aynı geçerli revizyonlu
tekrar kabul edilir. 238 core testi, mobil/core tip ve mobil lint geçti.

## Yeniden çalıştırma

1. `fixture.tsx` dosyasını yalnız geçici test için
   `apps/mobile/src/app/qa-journal.tsx` konumuna, mevcut dosyanın üzerine yazmadan kopyala.
2. `docs/design/screens/notebook-device-acceptance/qa-server.cjs` ile sentetik
   127.0.0.1:54369 uç noktasını başlat; gerçek URL/anahtar kullanma.
3. İzole Metro: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54369 EXPO_PUBLIC_SUPABASE_ANON_KEY=synthetic-qa-only pnpm --filter @gina/mobile exec expo start --dev-client --localhost --port 8097`.
4. Geliştirme uygulamasını bu Metro'ya bağla ve `gina://qa-journal` rotasını aç.
5. Hazırla düğmesine bas; HAZIR sonucunu gör. Uygulama sürecini tamamen kapat.
   Yeniden aç, aynı rotaya git ve doğrula düğmesine bas; GEÇTİ sonucunu kontrol et.
6. Geçici uygulama rotasını kaldır; yalnız bu testin başlattığı sunucuları durdur.

Ağ yanıtları test callback'leridir; gerçek sunucu kabulünün yerine geçmez. Gerçek
Auth/REST/Storage kanıtı `docs/learning/isolated-service-acceptance/` altındadır.
Fiziksel iPad/Pencil, avuç teması, Android görsel/kalem kabulü, işletim sistemi bellek baskısı/disk
arızası ve kaldırıp yeniden kurma bu testte doğrulanmadı. Taslak bulut yedeği değildir.

## Android ek kabulü

Aynı üretim journal/SQLite modülleri ayrı geçici worktree'de **com.enescevik.gina.qa**
kimlikli Expo Debug derlemesiyle sınandı. Ürün kimliği, uygulama kodu ve mevcut
uygulama verileri değiştirilmedi. İlk derleme 17 dakika 28 saniyede geçti; yeni
bağımlılık eklenmedi. Expo'nun ürettiği Android kaynakları elle değiştirilmedi.

Emülatör ekransız olduğundan ekran görüntüsü veya kullanıcı etkileşimi kabulü
iddia edilmez. Kabul rotasının açık `phase=prepare` / `phase=recover` parametreleri
gerçek journal işlemlerini başlattı. İlk süreç 6685, `am force-stop` sonrasında
yeni süreç 7004 idi. Ayrı süreç nonce kontrolü de geçti. Logcat yalnız QA uygulama
sürecine filtrelendi; uygulama depolaması temizlenerek test kolaylaştırılmadı.

`android-verification.json`, başarılı yedi kontrolü ve yalnız sentetik kayıt
temizliğini içerir. Çocuk isteğinin makbuzu korunarak 3, ardından sonraki düzenleme
4 revizyonuyla işlendi; geçersiz veli makbuzu taslağı korudu. Gerçek ağ/oturum
kabulü ayrı hizmet raporundadır. Debug APK bir mağaza yayını değildir.

Yeniden çalıştırmak için geçici kopyada QA package/scheme kullan; Metro'nun boş
bir portunu seç (bu çalışmada 8099). Yalnız bu testin portlarını emülatöre yönlendir.
Geliştirme istemcisini Metro'ya bağladıktan sonra `gina-qa://qa-journal?phase=prepare`
aç; `NATIVE_JOURNAL_RECOVERY_READY` kaydını bekle. QA sürecini kapat, yeniden Metro'ya
bağla, `gina-qa://qa-journal?phase=recover` aç ve `NATIVE_JOURNAL_RECOVERY_PASS`
kaydını doğrula. Aynı işlem sırasında uygulamayı yeniden kurma veya verilerini silme.
QA rotası, bu parametreler ve sentetik anahtar ürün derlemesine girmemelidir.
