# Veli ve Prova ana ekranlarının onaylı düzene dönüşü

3 Kasım 2026. Önceki 15 referans grubunu kapsayan denetimin ardından kullanıcının “ok 👍” onayıyla ilk iki ekran düzeltildi. Diğer ekranlarda bu teslimde değişiklik yok.

## Referans ve sonuç

- Veli: `../parent-home-premium/phone-proposal-v1.png` ve `tablet-proposal-v1.png`.
- Prova: `../prova-simplification/proposal-phone-v1.png` ve `proposal-tablet-v1.png`.
- [Yan yana karşılaştırma](index.html). Onaylı özgün dosyalar değiştirilmedi.

Veli ekranında onay kartı artık tabletin bütün genişliğini kaplamıyor. Onay/gün planı solda, çocuk ilerlemesi/hedefler/kısa işlemler sağda. Telefonda onay → gün planı → ilerleme → kısa işlemler sırası geri geldi. Günlük görev ayrıntıları ve haftalık gün seçimi devam bölümünde kaldı. Kısa işlem görev oluşturma ve Prova hazırlama akışına seçili çocuğu taşır; ödül kataloğu mevcut yoluyla açılır. Tek çocukta filtre gösterilmez. Tablet üst düğmeleri maskotun üstünde kalır.

Prova başlığı ve hazırlama işlemi tablette aynı satırda; sekmeler içerikleri kadar geniş. Solda kaydedilmiş taslaklar ve incelemeler, sağda seçili taslağın içeriği bulunur. Ortak kaynaklı sorular grubun içinde numaralı gösterilir. Aynı konu/kaynakta art arda gelen tekil sorular aralık halinde özetlenir. Kartın kaynak dağılımı gerçek sorulardan hesaplanır; hedef soru sayısı tamamlanmış sayı gibi sunulmaz. Eksik materyalde uyarı verilir; yükleme hatası tekrar denenebilir. Birden fazla taslakta sağdaki içerik seçilebilir. Telefonda taslak devamı mevcut hazırlama akışına gider. Gönderilmiş Provalar, sonuçlar, kütüphane ve diğer araçlar korunur.

## Korunan sonraki kararlar / eşitlik sınırı

Piksel eşitliği iddiası yok. Veli referansı raster konsepttir: çizilmiş harfler ve ikonlar uygulamanın native yazı/ikonları değildir. Daha sonra istenen ekrana özel aile maskotu, mevcut avatar/ikonlar, gerçek durum/hesaplamalar ve 48 dp kontroller korunur. Bildirimlerde sahte kırmızı nokta eklenmez. Örnek veri gerçek aile bilgisi değildir; metin uzunluğu, tarih, sayı ve güvenli alan görüntüyü etkiler. Telefonda bütün içerik tek kareye zorla küçültülmez. Prova onay maketindeki 10 yerine örnekte 5 gerçek soru ve 1/3/1 kaynak dağılımı kullanıldı; hedef yine 10'dur. Bu fark özellikle yanlış sayım kontrolüdür.

## Doğrulama

- `cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec expo lint`: başarılı.
- 320×700, 390×844, 834×1194, 1280×800: iki ekranda yatay sayfa taşması yok.
- Tek çocuk, çocuksuz aile, Prova sonuç/kütüphane sekmeleri, birden fazla taslak seçimi, boş taslak, taslaksız durum, materyal hatası/yeniden deneme ve eksik soru uyarısı denendi.
- Taslak hedefi 10 / yüklenmiş soru 5: gösterilen gerçek sayı 5. Bir ortak grup 3 soruyu kapsıyor; kaynak dağılımı 1 kütüphane / 3 AI / 1 elle eklenen.
- Tarayıcıdan `ginaqa.supabase.co` istekleri izole yanıtlarla karşılandı; diğer uzak istekler engellendi. Gerçek Supabase verisi değiştirilmedi. Görüntüler gerçek React Native Web bileşenlerinden alındı; maket HTML'i uygulama yerine kullanılmadı.
- Metro geliştirme sunucusunda yalnız test belge yanıtı doğrudan web bundle'ını yükler; SSR önizleme sorunu için üretim kodu değiştirilmedi.
- Native iPhone/iPad, Android, büyük sistem yazısı ve üretim oturumu bu turda test edilmedi. Bunlar cihaz kabulü için açıktır. TestFlight sürümü değişmedi.

Migration, yeni bağımlılık, üretim yayını veya iş kuralı değişikliği yok. Taslak içeriği mevcut `loadBuilderMaterial` okumasını kullanır; cevap/atanmış Prova mutasyonu yok.
