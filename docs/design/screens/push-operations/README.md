# Bildirim teslimi — 4 Kasım 2026

Onaylı ortak mint/mor/krem yönetim tasarımı mevcut bileşenlere uygulanmıştır. Yeni ekran için ayrı onaylı maket olduğu iddia edilmez. Aşağıdaki görüntüler gerçek Next ekranından, yalnız sentetik yayın operatörü ve sahte bildirim kayıtlarıyla alınmıştır. Gerçek aile verisi, cihaz anahtarı veya sağlayıcı çağrısı yoktur.

- `desktop.png`: 1440 × 1000 görünüm, tam sayfa kaydı; kısmi başarı, eksik hizmet ayarı ve tekrar sınırı.
- `tablet.png`: 1280 × 800 görünüm, tam sayfa kaydı; kurtarılmış istek ve korunan başarılı cihaz.
- `phone.png`: 390 × 844 görünüm, tam sayfa kaydı; yatay taşma yok.
- `pending.png`: sunucu işlemi tamamladıktan sonra yanıtın kaybolması.
- `revoked.png`: canlı yayın rolü kaldırıldığında veri/işlem görünümünün kapanması.
- `qa-fixture.cjs`: yalnız `ginaqa.supabase.co` sahte RPC’lerini karşılayan tekrar kullanılabilir örnek. Gerçek API anahtarı gerektirmez.

## Kabul

İlk yeniden sıraya alma yanıtı kesildi; sayfa yeniden açıldı; aynı istek kimliği ve yükle sonuç geri alındı. İki çağrı tek revizyon/tek kurtarma olayı oluşturdu; başarılı cihaz sayısı korundu. Sadece yayın rolü olan kullanıcı ana adresten bu ekrana yönlendi. Boş filtre ve rol iptalinde kontrollerin kapanması doğrulandı. Bunlar tarayıcı kabulüdür; fiziksel bildirim teslimi değildir.

`062_push_operations.test.sql`: 28 kontrol. Canlı rol, özel kayıtlar, anlamlı gerekçe/açık onay, tekrar kimliği, eski sürüm, başarı makbuzlarının korunması, kalan cihazın hedeflenmesi, 24 saat/en fazla iki kurtarma/saatte 20 işlem sınırı, tercih iptali ve aile silme kontrol edildi. Bütün 62 SQL dosyasında 1.685 kontrol geçti.

`test-push-operations-races.py --template gina_completion_audit`: yalnız ayrı atılabilir audit veritabanlarında aynı istek, iki operatör ve aile silme yarışları geçti. Çekirdek 160 test; backoffice tip/lint ve 19 sayfalık üretim derlemesi geçti.

## Teslim sınırı

Sağlayıcı kabulü, cihazda görülme değildir. Sağlayıcı kabulüyle sunucu makbuzu arasındaki kesintide tekrar olasılığı vardır; arayüz bunu açıklar. Son 24 saat içindeki uygun kayıtlar açık gerekçeyle tek tek kurtarılır; eski geçmiş topluca gönderilmez. Gönderim/yeniden gönderim güncel hedef ve izinleri tekrar denetler. Migration `084000`, yönetim ekranı ve önceki `083000` gönderici birlikte yayın planına dahildir; bu kabul sırasında dağıtılmadı.
