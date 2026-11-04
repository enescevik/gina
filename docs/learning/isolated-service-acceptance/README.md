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


## 4 Kasım — gerçek Realtime ile birleşik kabul

`python3 scripts/test-isolated-services.py --run-local --with-storage --with-realtime`: gerçek Auth, REST, Realtime WebSocket, Storage ve kaynak Edge birlikte 134 kontrolü geçti. Sonuç `realtime-verification.json` içinde; bütün geçici hizmetler ve veritabanı kaldırıldı. Realtime görüntüsü mevcut yerel `supabase_realtime_gina` konteynerinden alınır, ayrı şema ve rastgele anahtarlarla yalnız boş kopyaya bağlanır. Yerel geçit resmi `/realtime/v1` → `/socket` eşlemesini kullanır; Node WebSocket ve mevcut Supabase SDK dışında paket eklenmedi.

Çocuk yeni Prova atamasını, veli bitirilen denemeyi, çocuk görev onayını ve yıldız değişimini gerçek bildirimle aldı. Diğer aile hiçbir satır almadı. İptal edilen cihazın açık bağlantısı/eski tokeni yeni satır alamazken veli aynı değişimi aldı.

Denetim, Realtime içindeki iç içe null kimliklerin `"null"` metnine dönüşerek UUID dönüşümünü ve bütün bildirim grubunu durdurduğunu yeniden üretti. 094000 yalnız üç isteğe bağlı GINA kimliğinin null/boş gösterimini normalleştirir; rol, geçerli kimlikler, aile üyeliği ve cihaz iptal kontrolleri korunur. 18 yeni SQL kontrolü ile toplam 72 dosya/2035 kontrol geçti. Mobil bağlantı artık socket katılımını veritabanı hazır olayıyla karıştırmaz; hazır olunca tekrar okur, veritabanı aboneliği başarısızsa yedek yenileme sürer. Gerçek hook için beş test ile mobil tip/lint geçti.

Bu kanıt yerel gerçek hizmet kabulüdür; üretim dağıtımı, fiziksel cihaz veya push teslimi değildir. Kaynaklar: [Supabase protokolü](https://supabase.com/docs/guides/realtime/protocol), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).


## 4 Kasım — aile, yönetim ve canlı dosya/bildirim zinciri

Aynı gerçek yerel hizmet koşumuna ayrı support/content operatörleri eklendi. `backoffice-verification.json` 192 başarılı kontrol içerir; önceki 134 kontrol de bu koşumda yeniden geçti. Yeni kullanıcılar ve bir saatlik dar roller yalnız boş test kopyasında oluşturuldu; gerçek yöneticilerin yetkileri değiştirilmedi.

Veli talebi → operatör kuyruğu → özel ekip notu → aileye yanıt → veli takip mesajı geçti. Başka aile, çocuk cihazı ve içerik operatörü özel desteğe erişemedi. Veliye yalnız aile görünürlüklü iki mesaj döndü; not yalnız destek operatörüne açıldı. Tekrarlı oluşturma/yanıt ikinci kayıt üretmedi, eski revizyonla yazma reddedildi.

SSS taslağı → inceleme zorunluluğu → yayın → iOS/Android/web hedefleri → yeni taslağın eski yayını koruması → arşiv zinciri geçti. Destek operatörü ve veli içerik düzenleyemedi. Rol iptali/süresi dolması mevcut token ile erişimi hemen kapattı.

Bu gerçek Auth/REST/RLS ve eşleşen ürün RPC kabulüdür; Cloudflare Access kurulumu, gerçek tarayıcı ekranı, Apple/Google ödeme-iade veya fiziksel bildirim teslimi değildir. Bütün geçici hizmetler ve veritabanı kaldırıldı.

## AI ürün uç noktaları ve kalıcı kayıt — 4 Kasım

Aynı birleşik koşum **254 kontrol** ile geçti. Gerçek yerel Auth, PostgREST,
Realtime, Storage ve değişmemiş üretim Edge işleyicileri kullanıldı. Yalnız Anthropic
sınırı deterministik sentetik yanıt döndürür; Deno ağ yetkisi 127.0.0.1 ile sınırlıdır.
Bu koşumda ücretli veya dış AI çağrısı yoktur. Gerçek sağlayıcı/içerik kabulü ayrı
`../ai-feature-acceptance/` raporundadır; iki kanıt tek bir canlı uçtan uca test olarak
sunulmaz.

- Haftalık özet → tek kota → aynı sonuçla tekrar → veritabanından yeniden açma;
  başka aile/çocuk erişiminin reddi ve paket kapanınca hazır sonucu okuyabilme.
- Gerçek özel PNG yükleme/doğrulama → ayrı AI onayı → belgeden ödev/kurs taslağı;
  eksik tarihin null kalması ve otomatik atama olmaması.
- Veli tarih düzeltmesi ve iki seçim → atomik kayıt → aynı makbuzla aynı kimlikler;
  yeniden seçimin reddi, çocuğun onaylanmış planı okuması, özel kaynak bilgisinin
  çocuğa açılmaması.
- Belgeden görev ve ödül önerisi → sunucunun doğruladığı kaynak kimliği → birden
  fazla seçim → yalnız iki kayıt ve özgün belge ilişkileri.
- Hızlı ikinci üretimin 20 saniyelik sınırda sağlayıcı çağırmadan reddi, süre
  dolduktan sonra devam. Dört ayrı üretim ve dört tokenizer çağrısı; tekrar/okuma
  ek çağrı yapmadı. İlk koşum bu bekleme kuralına takıldı; son koşum kuralı
  kaldırmadan hem reddi hem sonrasındaki başarıyı doğruladı.

Kanıt: `ai-pipeline-verification.json`. Geçici hizmetler/veritabanı kaldırıldı.
Gerçek aile/demo kayıtları ve üretim sürümü değiştirilmedi. TestFlight, fiziksel
UI, canlı quota/Edge kaydı ve üretim mağaza/push kabulü hâlâ ayrı adımlardır.
