# Takvim ve haftalık ders programı — 1 Kasım 2026

Kullanıcının bu sohbette onayladığı takvim/program görseli `approved-reference.png` olarak korunur. Krem zemin, mor ışıklı butonlar, mint çocuk seçimi, mevcut peluş maskot ve okunaklı Nunito yazı sistemi uygulandı. Günlük liste telefonda; haftalık özet ve seçili gün yan yana tablette. Program tablette beş günlük sütunlar, telefonda gün seçimi kullanır. Hafta sonu ayrıca açılabilir. Uzun içerik kaydırılır; fontlar küçük ekrana sığdırmak için küçültülmez.

## Çalışan akış
- Veli kendi ailesindeki çocukların programlarını, eşleşmiş çocuk cihazı yalnız aktif çocuğun programını düzenler. Velinin telefondaki çocuk modunda da yalnız seçilen çocuk görünür.
- Ders ekleme/düzenleme/çıkarma, gün kopyalama, ders/teneffüs saati önerileri, hafta sonu.
- Saat çakışması, geçersiz saat ve 112 ders sınırı hem istemcide hem sunucuda kontrol edilir.
- Değişiklikler “Programı kaydet” ile atomik yazılır. Kaydetme hatası veya eşzamanlı değişiklik taslağı silmez. Kaydedilmemiş taslaktan ayrılma onay ister.
- Program kaydedildiği haftadan itibaren haftalık okul etkinlikleri üretir. Eski program sürümlerinin tarihsel arşivi bu teslimin kapsamında değildir. Saat ayarları mevcut dersleri taşımadan yeni derslerin saat önerisini belirler.
- Takvimde çocuk filtresi, haftalar arasında gezinme, bugün, boş/hata durumları. Veli aile etkinliği ekler, düzenler, siler; çocuk aile etkinliklerini görür. Program dersleri program düzenleyicisinden değiştirilir.
- Elle girilmiş eski ders ve etkinlikler program kaydında silinmez. Var olan etkinliğin tekrar kuralı değiştirilmediyse aynen korunur.

## Kanıt ve sınırlar
`index.html` görsel galeridir. `../../../release/evidence/planner/` test betikleri ve ekran görüntülerini içerir.

- TypeScript, Expo lint ve web export başarılı.
- Core: 22/22 test. Yerel veritabanı: 276/276 pgTAP, yeni program kapsamı 17 test.
- Web: kayıt, saat çakışması, ağ hatası, revizyon çakışması, gün kopyalama, taslak koruması, çocuk kapsamı, boş gün, hata/yeniden deneme, çocuk olmayan aile. 320 px yatay taşma yok. Kontrol edilen düğmelerde 48 dp altı hedef yok.
- iOS 26.5 iPhone 17 Pro ve iPad Pro 11 M5 simülatörlerinde ders düzenleme/kaydetme ve görünüm kontrol edildi. iOS SVG buton yüzeyinin eksik kaplama sorunu giderildi. Fiziksel cihaz veya Android native kabul testi yapılmadı.
- Görsel ve istemci akış testleri yakalanmış HTTP/WebSocket yanıtlarıyla, native testler ayrı yerel örnek veri sunucusuyla yapıldı. Sunucu yetki ve atomiklik kontrolleri gerçek yerel Postgres pgTAP testlerinde doğrulandı; tüm test kayıtları işlem sonunda geri alındı. Gerçek aile/demo kayıtları değişmedi.

## Yayın durumu
Bu çalışma mevcut TestFlight 0.1.0 (10)'a gönderilmedi. Yeni uygulama paketi yayınlanmadan **önce** `20261101170000_school_timetables.sql` üretime uygulanmalı: etkinlik sorgusu yeni `timetable_entry_key` sütununu kullanıyor. Migration geriye uyumlu eklemeler içerir; mevcut sürümün etkinliklerini değiştirmez.

Bu oturumda Supabase CLI üretim bağlantısı ve erişim oturumu bulunamadı (`ProjectRefNotLinkedError`, `AccessTokenRequiredError`). Üretime migration uygulanmadı. Yetkili oturumda `pnpm exec supabase login`, doğru proje için `pnpm exec supabase link --project-ref <GINA_PROJE_REF>`, ardından `pnpm exec supabase db push --dry-run` ile bekleyen migration listesi incelenmeli. Yalnız doğrulanan GINA migration'ları uygulanıp gerçek veli/çocuk oturumunda kontrol edildikten sonra TestFlight paketi hazırlanmalı. Anahtarları sohbetle paylaşmayın; yerel DB reset veya demo verisi taşıma gerekmiyor.

## Sonraki tasarım
`../tasks-premium/proposal-v1.png` onay bekleyen Görevler / Yeni görev görselidir. Görev listesi ve ekleme formu ayrılır; çocuk seçimi, simge, yıldız, tekrar günleri ve duraklat/devam işlevleri korunur. Görselde üç yıldız gösterimi örnek veridir, yeni bir üst sınır önermez. Tüm mevcut ikon seçenekleri uygulamada erişilebilir kalacak; makette yalnız ilk beşi gösterilir. Ardından Ödüller, Aile/çocuk yönetimi ve Prova ekranları aynı dilde tek tek ele alınacak. Takvim dışındaki ekranların kodu bu teslimde değiştirilmedi.
