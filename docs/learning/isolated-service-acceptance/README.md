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

## 4 Kasım — gerçek Storage ve kaynak Edge hizmeti

Ek koşum: `python3 scripts/test-isolated-services.py --run-local --with-storage`. Deno 2.9.6 PATH'te bulunmalı; alternatif olarak `GINA_QA_DENO_PATH` kullanılabilir. Deno bağımlılıkları mevcut kilit dosyasından önceden önbelleğe alınmış olmalıdır; çalıştırıcı paket indirmez. Üretim `learning-source` işleyicisi değişmeden, rastgele yerel portla çalışır. Deno ağ yetkisi yalnız 127.0.0.1'dir; dış AI çağrısı yoktur. Geçici Storage konteynerinin dosyaları ayrı 64 MB bellek dosya sistemindedir; mevcut dosya hacmi bağlanmaz. Yalnız Storage migration metadatası kopyalanır, nesne kayıtları alınmaz.

`storage-verification.json` ilk 66 kontrolü de içeren genişletilmiş kabul kaydıdır. PNG ve tek sayfalık PDF için gerçek özel yükleme, dosya doğrulama, aynı istek tekrarı, bayt/hash eşitliği, süreli erişim ve başka aile/anonim/atanmamış çocuk reddi geçti. Silme sonrasında yeni erişim reddedildi ve başarılı temizliğin ardından önceki süreli URL de dosyayı döndürmedi. Gerçek Storage kesintisinde mevcut ürün davranışı farklıdır: metadata erişimi kapanır, fiziksel temizleme kuyrukta tekrar edilir; önceden verilmiş süreli bağlantı ömrü dolana kadar geçerli olabilir.

Yanlış hash ile yüklenen dosya `invalid` kaldı ve temizlik kuyruğuna girdi. Soruya bağlı görsel, atama öncesi çocuğa kapalıydı; birleşik Prova atamasından sonra aynı özgün dosya açıldı. Yanlış soru kimliği erişim vermedi; atanmış sorunun görselini silme reddedildi. Depolama onayı olmadan rezervasyon reddedildi. Geçici Auth/REST/Storage, Deno ve veritabanı temizlendi. Bu, telefon kamerası/dosya seçicisi veya fiziksel cihaz kabulü değildir.

## 4 Kasım — mevcut canlı sürümde tek ücretli belge kabulü

`hosted-import-verification.json`: `gina-prod` üzerinde yalnız bu test için oluşturulan geçici veli/aile/çocukla gerçek özel PNG yükleme → AI çıkarımı → veli düzeltmesi → program/takvim kaydı → özgün belgeyi açma → normal hesap silme akışı geçti. 506 girdi / 157 çıktı token'lı tek kullanım kaydı oluştu. Aynı belge isteğinin tekrarı aynı sonucu kullandı; ikinci kullanım oluşturmadı. Belgedeki bilinmeyen bitiş saati boş bırakıldı, testin veli düzenleme adımında tamamlandı. Program, takvim ve özgün belge bağı aynı anda doğrulandı.

`learning-service-smoke.mjs` artık global kaynak anahtarını açıp kapatmaz; önceden açık olmasını şart koşar. Mevcut aileler ve global yayın ayarları değiştirilmedi. Test hesabı normal silme akışıyla kaldırıldı; kullanıcı, aile, kaynak ve yüklenen nesnenin kalmadığı doğrulandı. Bu kabul mevcut dağıtılmış sürüme aittir: henüz dağıtılmamış çalışma planı/haftalık özet/görselli katkı Edge sürümlerini doğrulamaz. Yeni migration, Edge veya TestFlight yayını yapılmadı.
