# İncelenmiş yanıtlardan tekrar çalışması

Onaylı birleşik Prova hazırlama ekranının ortak tasarımına uyarlanır. Yeni bir ana menü veya ayrı sınav sistemi yoktur: **Soru ekle → Kütüphane → Tekrar çalışması için seç**. Seçimler mevcut taslak yazıcısından geçer; inceleme ve çocuğa gönderme adımları korunur.

Telefon 390×844 ve tablet 1280×800 ekran görüntüleri gerçek React Native Web bileşeninden, `qa-fixture.cjs` içindeki sahte aile verileriyle alınmıştır. Gerçek hesaba/veritabanına yazılmamıştır. Native cihaz kanıtı değildir.

## Davranış ve sınırlar

- Taslak çocuğu, sınıfı ve dersleri sunucuda doğrulanır. Son 90 gündeki bitmiş denemelerde soru başına **en son yanıt** kullanılır. Devam eden sınavlar hesaba katılmaz.
- Yanlış şıklı cevaplar ile velinin 100'ün altında değerlendirdiği açık uçlular gelir. Bekleyen veya yalnız AI tarafından puanlanmış açık uçlular önerilmez. Boş şıklı yanıt “yanlış” sayılmaz.
- Bir ortak kaynak için yalnız bir seçim oluşturulur; doğru yanıtlanan kardeş sorular dahil bütün kaynak birlikte korunur. “Tekrar önerilen yanıt” ile “eklenecek soru” sayısı ayrı verilir.
- Önceki yanıtın incelemesine doğrudan gidilebilir. Seçilen bloklar mevcut sürümlü taslağa eklenir; tekrar seçilemez. Bu işlem sınavı otomatik atamaz, eski cevabı değiştirmez, AI çağrısı/kota harcaması yapmaz.
- En yeni 50 birim gösterilir. Aynı sorunun tekrarı bağımsız öğrenme/ustalık kanıtı değildir. Kendiliğinden aralıklı tekrar programı, bildirim veya gelişim puanı üretmez.
- Seçim gerekçesi açıklaması isteğe bağlı açılır. Geri ve önceki yanıt eylemleri bağlantı görünümündedir; dokunma alanı en az 48 dp'dir. Önceden eklenmiş sorular seçili ve okunaklı kalır.

## Doğrulama

27 yeni pgTAP kontrolü: aile/çocuk/anon sınırı, sınıf/ders, son doğru yanıt, AI/veli ayrımı, eski kayıt, değerlendirme düzeltmesi, ortak kaynak bütünlüğü, taslağa kayıt ve otomatik atama yapılmaması. İzole veritabanında tüm 44 test dosyası / 1.069 doğrulama geçti. Telefon/tablet akışında seçim, kaydetme isteğinin doğru blok kimliği ve yeniden seçim engeli gözlendi. Mobil typecheck/lint geçti.

Migration `20261103060000_repeat_candidates.sql` ve mobil değişiklik henüz üretime/TestFlight'a dağıtılmadı. Sorgu salt okunurdur; mevcut taslak/idempotency/atama sözleşmeleri kullanılır.
