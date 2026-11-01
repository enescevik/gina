# Ödüller — onaylı tasarımın uygulaması

`proposal-v1.png` kullanıcı tarafından onaylandı. Veli ödüller ekranı ve yeni ödül formu uygulandı. Sıradaki Ailem tasarımı `../family-premium/proposal-v1.png`; bu ekranın kodu henüz değişmedi.

## Tasarım ve akış

- Onaylı krem, mint ve mor dil; mevcut logo, kitaplı maskot, Nunito ve Collectible görselleri korundu. Maketteki üretilmiş ikon/harfler yerine mevcut üretim varlıkları kullanıldı.
- Talepler ve Katalog sekmeleri. Talep kartında çocuk avatarı/adı, durum, ödül adı ve talep anındaki yıldız bedeli gösterilir. “Aktif” bilgi etiketidir, ikinci işlem düğmesi değildir.
- Telefonda tek, 900 dp ve üzerinde iki sütun. 320 px genişlikte talep düğmeleri alt alta geçer. Yeni ödül ve form kaydetme düğmeleri sabittir; uzun içerik kaydırılır. Kontroller en az 48 dp.
- Yeni ödül formunda ad, mevcut sekiz görsel, 1–999 tam sayı yıldız bedeli ve önizleme. Ailenin tüm çocuklarına açık katalog davranışı ve mevcut varsayılanlar korunur. Hata taslağı silmez; kaydedilmemiş çıkış uyarır.
- iOS modalı kendi safe-area sağlayıcısını kullanır. Uygulama metinleri tr/en sözlüklerindedir. Yeni bağımlılık/migration yok.

## Korunan iş kuralları ve hata davranışı

Onay/ret `decide_reward_request`, teslim `deliver_reward_request`, iptal/iade `cancel_reward_request` ile yapılır. Yıldız hesaplama ve iade sunucuda kalır. RPC'nin döndürdüğü durum beklenen durumla karşılaştırılır: başka cihazda önceden işlenmiş talep için yanlış başarı gösterilmez. Yetersiz yıldız ayrıca açıklanır. İşlem sırasında tekrarlı istekler engellenir, yalnız ilgili düğmede yükleme göstergesi çıkar.

Katalog sorgu/güncellemeleri aileyle sınırlandırılır; güncelleme etkilenen satırı doğrular. Katalog ve taleplerin gerçek zaman bildirimleri korunur. İşlemler sonrasında ilgili katalog, hedef ve yıldız sorguları güncellenir. Talepler yüklenemezse katalog kullanılabilir kalır.

## Doğrulama ve sınırlar

- `pnpm turbo run lint typecheck test`: 7/7 başarılı, 22 çekirdek testi geçti.
- Expo web export başarılı.
- `docs/release/evidence/rewards-premium/check.cjs`: oluşturma/hata/tekrar deneme, taslak koruma, yıldız doğrulama, duraklatma/sürdürme, onay/ret/teslim/iptal RPC eşlemesi, yetersiz yıldız, eski talep yanıtı, 320 px ve 48 dp kontrolleri geçti.
- `states-check.cjs`: yükleniyor, hata, talepler hatalıyken katalog, boş katalog, küçük telefonda form ve talep işlemleri kontrol edildi.
- Telefon 390×844 ve tablet 1280×800 görüntüleri çalışan web uygulamasındandır. Ece/Can ve ödüller yalıtılmış örnek kayıtlardır.
- Native iPhone 17 Pro/iOS 26.5 simülatöründe onaylama ve ödül kaydı doğrulandı; form güvenli alanı incelendi. Native görüntüler simülatör çerçevesi/geliştirme göstergelerini içerir. Android, gerçek iPhone ve native iPad bu turda test edilmedi.
- Ekran testleri sahte HTTP/RPC yanıtları kullanır; yıldız muhasebesinin veritabanı testlerinin yerine geçmez. Gerçek aile kayıtları değiştirilmedi. TestFlight'a gönderilmedi.

Tüm görüntüler, referans karşılaştırması ve sonraki öneri: `index.html`.
