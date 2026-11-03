# Görev ve ödül kayıt kurtarma — 4 Kasım 2026

Mevcut onaylı sihirbazın ortak tasarımı korunur. Yeni alternatif ekran değildir. Tek adımlı kurtarmada gereksiz adım çubuğu gösterilmez; kaç kaydın kontrol edileceği açıkça yazılır.

## Yapılan kontroller

- Telefon 390×844, tablet 1280×800; gerçek React Native Web bileşenleri, tamamen sentetik aile ve ağ yanıtları (`qa-fixture.cjs`). Gerçek aile verisi değiştirilmedi.
- Elle görev: sıfır yıldız seçildi, kayıt sunucuda gerçekleşmiş gibi davranıldıktan sonra yanıt kesildi, sayfa tamamen yeniden açıldı. İki istek aynı gövde/kimlikle gönderildi; yalnız bir görev oluştu. Başlangıç günü korundu; AI çağrısı yok.
- AI ödülleri: üç önerinin tamamı seçildi, bir arada kaydedildi, yanıt kesildi, sayfa yeniden açıldı. İki kayıt isteği aynı kimlikle gönderildi; yalnız üç ödül oluştu. Öneri üretimi bir kez çağrıldı, kurtarma ek AI çağrısı yapmadı. Bu test gerçek ücretli sağlayıcıyı çağırmaz.
- 9 yeni çekirdek testi: yeniden açılış, kayıt değişikliğini engelleme, kullanıcı/çocuk ayrımı, bozuk/depolanamayan kayıt, oturum kapanışı, kesin ve belirsiz hata ayrımı, tarih/yıldız/gün doğrulaması. Toplam 109 çekirdek testi geçti.
- 12 ek SQL kontrolü; toplam 46 dosya / 1.135 kontrol geçti. Eski istemci, aile/çocuk yetkisi, kota, atomik toplu kayıt korunur.
- Gerçek PostgreSQL eşzamanlı istekleri: aynı görev ve aynı ödül birer kez oluşturuldu; son görev kotasına iki farklı istekten yalnız biri kabul edildi (`scripts/test-setup-save-races.py`). Yalnız atılabilir denetim veritabanı kopyaları kullanıldı.
- Mobil typecheck ve lint geçti.

## Dosyalar

- `task-phone.png`: tam yeniden açılış sonrası görev kurtarma.
- `task-tablet.png`: aynı bileşenin tablet görünümü.
- `rewards-tablet.png`: üç önerinin kurtarma özeti.

## Sınırlar

064000 sunucu göçü yeni istemciden önce dağıtılmalıdır. Henüz üretime veya TestFlight’a dağıtılmadı. Fiziksel iPhone/iPad depolama ve uygulama kapatma/açma kabulü açık. Gönderilmemiş form alanları otomatik taslak değildir; yalnız kullanıcının Kaydet dediği komut kalıcıdır. Oturum kapatıldığında bu cihazdaki kayıt içeriği temizlenir. Farklı cihazlardan bağımsız yeni kayıt niyeti aynı işlem sayılmaz. Bu artım belge → görev/ödül/hedef aktarma özelliğini tamamlamaz.
