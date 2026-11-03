# Takvim kaydını güvenle kurtarma

Mevcut onaylı etkinlik formunun yerleşimi korunur. Bağlantı sonucu belirsizse önceki işlemin adı, açıklaması ve tek **Kaydın sonucunu kontrol et** eylemi gösterilir. Pencere kapatılsa da işlem cihazda hesap/aile kapsamında saklanır; çözülmeden yeni etkinlik gönderilmez.

`phone.png` (390×844) ve `tablet.png` (1280×800) gerçek React Native Web bileşeninden, yalnız `qa-fixture.cjs` sahte veri/oturumuyla alındı. Sunucu kaydı aldıktan sonra yanıt kesildi, sayfa tamamen yenilendi ve aynı işlem kurtarıldı: **2 istek, 1 etkinlik; aynı request/event/payload; kurtarma sonrası bekleyen cihaz kaydı 0**. Belirsiz sonuç “kaydedilmedi” diye kesinleştirilmez. Native test değildir.

## Sözleşme

061000 migration manuel oluşturma, düzenleme ve silmeyi tek makbuzla gerçekleştirir. Aynı anahtarla farklı içerik/kullanıcı/aile reddedilir. Makbuz tekrarı yeni düzenlemeyi geri almaz. Her düzenleme `edit_revision` artırır; eski ekran yeni düzenlemeyi/silmeyi ezemez. Eski doğrudan düzenlemeler de revizyon artırır. Ders programının yansıtılan satırları manuel RPC'den değiştirilemez.

Çocuk aynı aileden olmalıdır: RPC ve doğrudan RLS yazma kuralı kontrol eder. Bilinmeyen alan, geçersiz tür, ters/sonsuz zaman ve desteklenmeyen yeni tekrar kuralı reddedilir. Eski tekrar kuralı değiştirilmeden korunabilir. SQL'in kesin geri aldığı hatalarda cihaz komutu temizlenir; ağ/zaman aşımında korunur. Çıkış eski yazıcıları geçersiz kılar.

## Kontroller ve yayın

24 yeni SQL kontrolü; izole veritabanında **45 dosya / 1.093 doğrulama** geçti. `scripts/test-calendar-command-races.py --template gina_completion_audit` dört geçici klonda gerçek paralel oturum yarışı çalıştırdı: aynı istek, farklı oluşturma istekleri, iki düzenleme, düzenleme/silme. Dördü geçti. Mobil typecheck/lint ve web kurtarma testi geçti.

Önce veritabanı, ardından yeni uygulama yayımlanmalı. Eski sürümün doğrudan oluşturma yoluna istemci kurtarması geriye dönük eklenmez. Henüz canlıya/TestFlight'a gönderilmedi; fiziksel cihaz kapanma/yeniden açılma kabulü açık. Normal yerel veritabanı ve aile kayıtları değiştirilmedi.
