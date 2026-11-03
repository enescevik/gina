# Çözüm defteri — cihaz doğrulama kaydı

3 Kasım 2026. Bu paket yeni tasarım maketi değildir. Üretimde kullanılan
`NotebookWorkspace` ve `NotebookEditor`, sentetik bir soru ve yerel defter durumuyla
çalıştırıldı. Gerçek çocuk/aile kaydı kullanılmadı veya değiştirilmedi.

## Bulunan ve düzeltilen sorun

Yeni yazı/görsel boş yere yerleşirken görünen sayfanın altında kalabiliyordu.
Eklemeden sonra gerçek yerleşim sınırlarıyla yalnız gereken kadar kaydırılıyor;
seçim araç çubuğunun yüksekliği değişince hedef yeniden görünür tutuluyor.
Kalem/seçim hareketi veya elle kaydırma bu davranışı sonlandırır. Çizim sırasında
otomatik kaydırma yapılmaz. Nesnenin kayıtlı koordinatları değişmez.

## Kanıtlar

| Dosya | Ortam ve içerik |
| --- | --- |
| `ipad-landscape-native.png` | iPad Air M4 simülatörü; çizgi, yazı ve kopyalanan soru görseli; yerel 5 öğe |
| `ipad-portrait-native.png` | Aynı defter dikey iPad; soru ve defter birlikte |
| `ipad-expanded-native.png` | Dikey iPad'de defter genişletildi; aynı 5 öğe korunuyor |
| `phone-native.png` | iPhone 17 Pro simülatörü; görsel, çözüm metni ve kalem çizgisi |
| `phone-insertion-web.png` | 390×844 web; ekranın altına eklenen yazının görünürlük kontrolü |
| `tablet-portrait-web.png`, `tablet-expanded-web.png`, `phone-web.png` | İlk mevcut davranış kontrolleri; görünür alana getirme düzeltmesinden önce |

Başlıktaki iki “Matematik · 1 / 3” alanı test örneğinin `progress` vermeyip
`title` kullanmasından kaynaklanır. Gerçek sınav ekranı başlık ve ilerlemeyi ayrı
geçer. “Yerel test” sayacı kayıt/senkronizasyon göstergesi değildir. Alt düğme ve
geri işlemi bu örnekte etkisizdir; sınav bitirme doğrulaması yapılmış sayılmaz.

Yerel, imzasız Debug derlemesi başarıyla üretildi (Expo 58, RN 0.88.1, iOS 26.5).
Eski simülatör derlemesinde eksik `ExpoDocumentPicker` vardı; güncel derleme bu
modülü içeriyor. İmzasız simülatördeki bildirim/keychain yetkisi uyarısı incelenip
kapatıldı; bildirim, giriş veya keychain testi geçtiği iddia edilmiyor.

## Tekrar çalıştırma

1. Depo kökünden, yalnız geçici test için `fixture.tsx` dosyasını
   `apps/mobile/src/app/qa-notebook.tsx` konumuna kopyala. Var olan dosyanın üzerine
   yazma. Bu rota hiçbir dağıtıma dahil edilmemeli.
2. Depo kökünden `node docs/design/screens/notebook-device-acceptance/qa-server.cjs`
   çalıştır. Yalnız `127.0.0.1:54369` üzerinde sentetik yanıt verir; veritabanına
   bağlanmaz. Gerçek anahtar kullanma.
3. İzole Metro başlat:
   `EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54369 EXPO_PUBLIC_SUPABASE_ANON_KEY=synthetic-qa-only pnpm --filter @gina/mobile exec expo start --dev-client --localhost --port 8097`.
4. Web: `http://localhost:8097/qa-notebook`. Native: güncel geliştirme derlemesini
   bu Metro'ya bağla; ardından `gina://qa-notebook` bağlantısını aç.
5. Dikey iPad'de çiz; yazı ve ° ekle; dört yönde döndür; yazı/sembol/diğer araçlar
   pencerelerini aç-kapat. Pencere açıkken de döndür. Sorudan görsel al; defteri
   genişlet ve geri dön. Telefonda Soru/Defter sekmelerini, görsel alma ve kalemi dene.
6. Eklenen yazı/görselin görünür alan altında kaldığı örneği oluştur. Eklemeden
   sonra görünür olduğunu, kaleme geçip çizince sayfanın kaymadığını kontrol et.
7. Test rotasını kaldır; yalnız kendi sunucularını durdur. Gerçek ortam
   yapılandırmasını, eski test verisini veya başka sunucuları değiştirme.

Makinece okunabilir sonuçlar ve açık kontroller: [verification.json](verification.json).
`node --test scripts/check-notebook-layout.test.mjs`: 8 kontrol geçti.
Mobil `tsc --noEmit` ve `expo lint` geçti.

## Henüz kapanmayan kabul

- Fiziksel iPad/Pencil, avuç teması ve işletim sisteminin pencere boyutlandırması.
- Android native, VoiceOver ve büyük sistem yazısı.
- Gerçek sınavda kalıcı cevap, çevrimdışı tekrar ve özel kaynak erişimi.

Fiziksel iPad'de okunan sürüm hâlâ 0.1.0 (16). Cihaza yeni sürüm kurulmadı.
Üretim, TestFlight ve tablet dağıtımı yapılmadı; tüm işler tamamlanınca yayın
kararı korunuyor.
