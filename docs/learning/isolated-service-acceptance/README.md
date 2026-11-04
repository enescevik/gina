# Gerçek yerel giriş ve Prova zinciri

4 Kasım 2026. Bu kabul, sahte HTTP yanıtları yerine gerçek GoTrue/Auth ve PostgREST ile çalıştı. `gina_completion_audit` boş şema şablonundan tek kullanımlık veritabanı oluşturuldu; iki sentetik veli ailesi ve anonim çocuk cihazı yalnız bu kopyada oluşturuldu. Üretim, mevcut yerel aileler, AI sağlayıcısı, Storage ve TestFlight değişmedi.

## Doğrulanan akış

- Parolayla gerçek giriş ve `custom_access_token_hook` üzerinden veli/aile claim'i; çocuk kurulumu makbuz tekrarı.
- Anonim cihaz eşleştirme; henüz yapılandırılmamış cihazın çocuk görmemesi; seçilmiş tek çocuğa erişim; yanlış/doğru PIN ve kardeş erişiminin reddi.
- Tek Prova'da bir elle yazılmış şıklı soru ve ortak metne bağlı iki açık uçlu soru; taslak ve atama tekrarı.
- Çocuğa cevap anahtarı gönderilmemesi; çizimli cevap kaydı, aynı istekle tekrar ve bitirme.
- Veli puan/geri bildirim kaydı; tekrar makbuzu; eski değerlendirme revizyonunun reddi; çocuğun özgün çiziminin korunması.
- Şıklı soruda puan değişikliğinin reddi; geri bildirimin otomatik doğru/yanlış sonucunu değiştirmemesi; çocuğun geri bildirimi okuyabilmesi.
- Gelişim raporunda üç soru: bir doğru, bir kısmi, bir bekleyen; ayrı ders/konu kanıtları ve sınırlı gözlem bilgisi.
- Çocuk görevi tamamlar → veli onaylar → çocuk aynı isteği tekrarlar: onaylı durum okunur. İkinci onay reddedilir, çocuk hesabına yalnız iki yıldız yazılır.
- İkinci ailenin çocuk/inceleme kayıtlarına erişememesi; cihaz iptali sonrasında eski JWT ile dahi okuma ve yazmanın reddi.

Sonuçların tamamı `verification.json` içinde. Geçici iki konteyner ve veritabanı sonunda kaldırıldı.

## Kayıt güvenliği düzeltmesi

Denetimde `AnswerJournal` bir HTTP başarı yanıtındaki revizyonu doğrulamadan yerel taslağı temizleyebiliyordu. Artık boş, metin, kesirli, güvensiz sayı veya beklenen sürümden eski yanıt taslağı ve özgün işlem kimliğini korur. Geçerli tekrar aynı makbuzla uzlaştırılır. Aynı içerik için sunucunun değişmeyen geçerli revizyonu kabul edilir. On bir yeni testle çekirdek toplamı 230 oldu.

## Yeniden çalıştırma ve sınırlar

`python3 scripts/test-isolated-services.py --run-local`

Gerekenler: yerel `supabase_db_gina`, `supabase_auth_gina`, `supabase_rest_gina`, `supabase_network_gina`; 092000'e kadar uygulanmış, aile ve Auth kullanıcısı içermeyen `gina_completion_audit`; kurulu çalışma alanı bağımlılıkları. Çalıştırıcı 093000 ve sonraki migration'ları yalnız kendi kopyasına uygular. Auth tablo kolonlarını mevcut yerel Auth şemasıyla karşılaştırır ve yalnız migration sürüm metadatasını alır; kullanıcı/oturum verisini kopyalamaz. Auth nesne sahipliği yalnız kopyada düzenlenir; küme rolleri değiştirilmez. Anahtarlar her çalıştırmada rastgele üretilir ve rapora yazılmaz. Hizmet portları yalnız 127.0.0.1'e açılır.

Bu, gerçek yerel HTTP/SQL kabulüdür; fiziksel cihaz, arayüz, Realtime WebSocket, dosya/Storage/AI, APNs/FCM veya mağaza kabulü değildir. Bu alanların açık işleri kapanmış sayılmaz. Başka AI sağlayıcıları, son görsel denetim, kütüphane üretimi ve koordineli yayın ayrıca sürer.
