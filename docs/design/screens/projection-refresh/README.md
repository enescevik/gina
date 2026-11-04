# Prova ve görev ekranlarında yenilenme — 4 Kasım 2026

Kütüphane üretimi kullanıcının kararıyla sona alındı. Bu artım, mevcut onaylı ekranları yeniden tasarlamadan atama/onay/sonuç bilgilerinin güncellenmesini düzeltir.

## Bulunan ve düzeltilen sorunlar

- Çocuk Prova listesi yalnız deneme girişimlerini dinliyordu; yeni atamada henüz girişim olmadığı için açık ekrana bildirim ulaşmıyordu. Liste artık `exams` değişikliklerini de dinler.
- Oda/dar akıştaki Prova sayacı canlı değişikliklere bağlı değildi. Çocuk kimliğine göre atama/bitirme değişikliklerinde ve ekrana dönüşte yeniden okunur.
- `exams` tablosu canlı yayın listesinde yoktu. 093000 yalnız mevcut RLS korumalı Prova metadatasını ekler. Cevap tabloları yayına eklenmez, yetki politikaları değiştirilmez.
- Aynı telefonda hazırlama/bitirme/değerlendirme sonrasında veli listesi, çocuk listesi ve sayaç birlikte eski sayılır; görünür olanlar hemen yenilenir. Başlatma RPC’sini kullanan `attempt` sorgusu ve açık cevap/değerlendirme taslakları bu yenilemeye dahil edilmez.
- Ortak görev yenilemesinde eksik kalan günlük `task_completions` ve sayısal `star_balance` eklendi. Eski dar Bugün akışı da aynı yenilemeyi kullanır. Veli ana ekranı görev şablonu değişikliklerini dinler.

## Kanıt ve sınır

`qa-fixture.cjs` gerçek Expo web bileşenlerine sentetik REST/WebSocket sağlar. Gerçek Supabase, aile, cihaz veya AI hizmetine yazmaz. Bu, canlı WebSocket teslimi veya fiziksel cihaz testi değildir.

- [Yeni atama / telefon](assigned-phone.png): açık ve boş çocuk Prova ekranı, sahte atama olayıyla yeni kartı gösterdi.
- [Atama sayacı / tablet](assigned-room-tablet.png): sayacın 1 → 0 → 1 değişimi, ekranı kapatmadan doğrulandı.
- [Onay / tablet](approved-tablet.png), [onay / telefon](approved-phone.png): bekleyen görev tamamlandı durumuna geçti; yıldız 0 → 2, onayda 1 → 0.
- Telefon 390×844, tablet 1280×800; sayfa JavaScript hatası yok, testte mutasyon çağrısı yok. Tasarım/yerleşim değiştirilmedi.

Dört gerçek QueryClient testi: görünür ve gizli görev gösterimleri, rol değiştirmeden önce Prova listelerinin eskimesi, geciken eski yanıtın yeni sonucu ezmemesi, başlatma RPC’sinin ve kaydedilmemiş cevap/değerlendirme taslaklarının yeniden çalıştırılmaması. `scripts/check-projection-refresh.test.mjs` CI’ya bağlıdır.

İzole audit klonunda **71 SQL dosyası / 2017 kontrol** geçti. Beş yeni kontrol yayın üyeliği/RLS/cevap tablosu sınırını doğrular; mevcut aile/çocuk erişim testleri de çalıştı. Audit şablonunda publication bulunmadığı için yalnız geçici klonda mevcut migration’lardaki publication listesi kuruldu, ardından 093000 uygulandı. Klon temizlendi; gerçek/demo veritabanı değiştirilmedi. Mobil tip ve lint kontrolü, defter/native metin/önbellek toplam 13 Node testi ve iOS/Android/web JS export geçti. Export yalnız sentetik Supabase adresi/anahtarıyla yapıldı; yayınlanabilir üretim derlemesi veya native cihaz çalıştırması değildir.

## Açık kabul ve yayın

Fiziksel iPhone/iPad/Android, gerçek canlı bağlantı ve yeniden bağlanma; Prova hazırlama/cevap kaydı/değerlendirme akışlarının tümünün uçtan uca kabulü henüz bitmedi. Bu düzeltme bütün yayın işlerini kapatmaz. 093000 ve mobil değişiklikler henüz dağıtılmadı; TestFlight 0.1.0 (17) değişmedi. Yeni soru üretimi durduruldu; mevcut 100 taslak korunur.
