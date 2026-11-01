# Veli ana ekranı — uygulama teslimi

Kullanıcının “devam” onayıyla telefon ve tablet maketleri uygulandı. Değişiklik `/parent` sunumuyla sınırlıdır; Prova, aile yönetimi ve diğer ekranların yeniden tasarımı sonraki teslimlerdir. [Maket / uygulama galerisi](index.html).

## Değişen görünüm ve düzen

- Krem/mor/mint planlayıcı paleti, saten butonlar, özgün logo ve kitap okuyan mint maskot. Nunito'nun kurulu paketteki 800 ağırlığı başlıklar için yüklendi; yeni bağımlılık yok. Diğer ekranların font seçimi değişmedi.
- Üstte selamlama ve açık etiketli Çocuk modu; çocuk filtresi, bekleyen onay ve günün planı öncelikli.
- Çocuk başına görev ilerlemesi ve yıldız bakiyesi; hedefler tek bölümde. Telefonda tek sütun, 1000 dp ve uygun yazı ölçeğinde iki sütun. Alt gezinme tablette de tam genişlikte.
- İlk iki onay görünür; fazlası “Tüm onayları göster” ile aynı ekranda açılır. Onay yoksa kısa durum satırı. Her kayıt ayrı onaylanır/geri gönderilir; başarısız işlem ilgili satırda görünür.
- Haftalık gün değiştirme kaldırılmadı; “Haftaya bakış” ile açılır. Görevler, Prova, haftalık özet, notlar, puanlar ve paylaşım aşağı kaydırılan devam bölümünde erişilebilir.
- Çocuk olmayan ailede büyük “Çocuk ekle” başlangıcı; yüklemede iskelet satırlar; veri yükleme ve hedef hatasında tekrar deneme.
- Hareket, mevcut saten butonların basma tepkisiyle sınırlı. Maskot sabit; doğal animasyon tamamlandı iddiası yok. Ortak saten yüzeyin native SVG uyarısı veren `.3` renk durağı eşdeğer `30%` biçimine düzeltildi.

## Korunan veri ve sınırlar

Ana ekranın sorguları, `review_task` RPC'si, önbellek yenilemeleri, yetkiler ve gerçek yıldız/hedef hesapları değiştirilmedi. `done`/`approved` tamamlanma sayımı ve bekleyen onay ayrımı korunur. Yeni migration, paket veya `apps/mobile/assets` değişikliği yok.

Üretim ve yerel Supabase kayıtlarına dokunulmadı. Test ekranlarındaki Deniz, Ece, Can, görevler ve bakiyeler izole örnek yanıtlardır. Bunlar gerçek ailenin bilgileri değildir. Bildirimde veriye dayanmayan kırmızı nokta gösterilmez.

Maketlerde üretilen harfler/ikonlar kesilip kullanılmadı: özgün marka dosyası, mevcut avatarlar ve TaskIcon/SubjectIcon/EventIcon/Collectible bileşenleri kullanıldı. Bu nedenle ikon çizimi ve harf konturları raster maketten farklıdır. iOS güvenli alanları, uzun içerik ve büyük yazı için sayfa kayar; bütün içeriğin her telefonda tek kareye sığacağı iddia edilmez.

## Doğrulama

- TypeScript, Expo lint ve web export başarılı.
- `pnpm turbo run lint typecheck test`: 7/7 iş, 22/22 çekirdek testi geçti.
- `../../../release/evidence/parent-home-premium/check.cjs`: 15 kontrol; ayrı çocuk ilerlemesi/filtreleri, onay/geri gönderme, hata/yeniden deneme, ilk çocuk yönlendirmesi ve altı gezinme hedefi.
- `states-check.cjs`: 5 kontrol; çoklu onay aç/kapat, haftalık gün seçimi, hedef hatası/tekrar deneme, 320 px uzun isimler ve boş gün/görev/onay durumları.
- Denetlenen web düğme ve bağlantılarında 48 dp altı dokunma alanı, 320 px yatay taşma, eksik görsel veya yakalanmamış JavaScript hatası yok. İlerleme çubuklarının erişilebilir sayısal değerleri de doğrulandı.
- iPhone 17 Pro / iOS 26.5 simülatöründe yeni görünüm ve görev onayı doğrulandı. Ayrı yerel örnek yanıt sunucusu kullanıldı. Native kanıt simülatör çerçevesini ve geliştirme düğmesini içerir.
- 430×932 telefon, 1280×800 tablet, boş/yükleniyor/hata ve 320 px görselleri çalışan uygulamanın web çıktısıdır. Native iPad, fiziksel iPhone 14 Pro Max, Android veya üretim oturumunda bu turda kabul testi yapılmadı.
- [Makine okunur kontrol sonucu](../../../release/evidence/parent-home-premium/validation.json).

TestFlight **0.1.0 (11)** bu ana ekran değişikliğini içermez. Bu teslim henüz yeni TestFlight paketi olarak yayınlanmadı.
