# Ortak tasarım ve birleşik Prova — TestFlight 17

Mobil kaynak: `3a67eb6098fea052cd8a67be36e5da700a1c8288` (PR #77). Sürüm: **0.1.0 (17)**. **Apple: VALID / IN_BETA_TESTING.** TestFlight iç testte hazır, süresi dolmamış olarak doğrulandı. [Yayın kaydı](testflight-17-status.json). Apple paket doğrulaması ve yüklemesi hatasız geçti; geçici yükleme anahtarı silindi.

## Bu pakette

- Veli ve Prova ana ekranlarının onaylı yerleşimine dönüş; giriş, eşleştirme, ayarlar, çocuk alt ekranları ve görev/ödül sihirbazlarında ortak tasarımın uygulanması.
- Tek Prova hazırlama akışı: kapsam, farklı kaynaklardan sorular, önizleme ve atama; sürümlü taslak ve tekrar gönderime dayanıklı kayıt.
- iPad defterinin dikey yerleşimi, tam ekran sunumu, araç pencerelerindeki yön kararlılığı ve çizim sırasında kaydırma kilidi düzeltmeleri. Soru işlemleri ve deftere alınan parçaların görünür kalması.
- Kanıt sorularına bağlı Gelişim ekranı; aileye özel Yardım, destek görüşmesi ve fikir paylaşımı.

## İlk cihaz kontrolü

1. TestFlight → GINA Aile → **0.1.0 (17)** → Güncelle. Uygulamayı yeniden aç; eski 16 numaralı paketi karşılaştırma için kullanma.
2. Veli ana ekranını, Prova listesini, Ayarlar ve Yardım sayfalarını aç. Başlıklar, düğmeler ve alt alanlar çakışmamalı; tek çocuklu ailede gereksiz çocuk filtresi olmamalı.
3. Prova oluştur: kapsamı seç, farklı kaynaklardan sorular ekle, taslağı kaydet ve yeniden aç. Ortak metin/görsele bağlı sorular aynı Prova içinde kalmalı.
4. Çocuk iPad’inde açık uçlu soruyu hem dikey hem yatay aç. Deftere çiz; Yazı, Semboller ve üç nokta menüsünü açıp kapat. Ekran kendiliğinden yön değiştirmemeli, çizim sırasında sayfa kaymamalı. Genişlet ve geri dönüşte çizim korunmalı.
5. Soru görselini deftere al; eklenen parça görünür alanda olmalı. Uzun soruda soru işlemlerine, büyük yazıda araçlara erişilebilmeli.
6. Veli incelemesinde çoktan seçmeli soru ile çizimli cevabı ayrı ayrı aç. Soru içeriği ve gerçek cevap türü görünmeli; kaydedilen geri bildirim çocuk sonucuna yansımalı.
7. Gelişim ekranında tarih/ders kapsamını değiştir ve kanıt sorusunu aç. Yardım’da özel destek kaydı oluşturup yeniden aç.

Kayıtlı iPad için aynı sürüm ve kaynakla ayrı imzalanmış paket, [kablosuz kurulum sayfasında](https://gina-aile-enescevik--tablet.expo.app) sunulur. Mevcut uygulamayı silmeden güncelle; son yükleme onayı cihazda verilir.

## Doğrulama ve sınırlar

- Ana dal CI ve güvenlik kontrolleri başarılı. İzole yayın kopyasında mobil TypeScript ve Expo lint yeniden geçti.
- Üretim veritabanında `20261103040000` dahil 62 migration eşleşiyor. Bu yayında 10 yeni migration uygulandı; sıfırlama veya seed yapılmadı.
- `prova-generate` ve `library-media` güncellendi. Docker ile karşılaştırılan `prova-review` ve `prova-grade` zaten aynı içerikteydi; JWT koruması açık.
- [Sunucu kontrol kaydı](testflight-17-server-check.json): geçici kayıtları işlem sonunda geri alan kontrol, mevcut aile verilerine dokunmadan taslak/yardım kayıtlarının tekrar gönderimini, rapor okumayı ve veliye operatör erişiminin kapalı olmasını doğruladı. [Kontrol SQL’i](testflight-17-production-smoke.sql).
- [Telefon/tablet uyarlama kanıtları](../design/screens/shared-design-adaptation/index.html) sentetik verili Expo web görüntüleridir. Bu yayın sırasında fiziksel iPhone/iPad, Apple Pencil, VoiceOver veya Android kabul testi yapılmış sayılmaz.
- `sources.enabled`, `question_groups.enabled`, `review_ai.enabled` açık kaldı. Tamamlanmamış aile kütüphane paketi erişimi ve toplu sınav dağıtımı (`library_packages.enabled`, `cohorts.enabled`) kapalı kaldı. Taslak soru havuzu yayımlanmadı.
- Bu dağıtım yeni ücretli AI uçtan uca çağrısı içermiyor. Edge kontrolleri açılış ve beklenen yöntem reddini doğrular.
- Web ve backoffice Cloudflare yayın işleri gerekli bağlantı bilgileri eksik olduğu için atlandı. Başarılı iş durumu bu iki arayüzün yayımlandığı anlamına gelmez.
- Bu kayıt TestFlight betası içindir; halka açık App Store yayını veya App Review başvurusu değildir.
