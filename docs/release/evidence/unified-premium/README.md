# Ortak premium arayüz ve hesap akışları

[Telefon/tablet galerisi](index.html) · [Kontrol sonuçları](validation.json)

Onaylı mint maskot, özgün logo, krem zemin, mor saten işlem düğmeleri ve Nunito tipografisi korunur. Bu çalışma mevcut takvim/görev/ödül tasarımlarının yerine yeni bir konsept üretmez; kalan sayfaları aynı bileşen diline taşır.

## Kullanım kararları

- Ayarlar dört bölüme ayrılır: Ailem, Çocuk cihazları, Güvenlik, Hesabım. Çocuk yoksa ekleme formu açık gelir. PIN kaydetme ve cihaz bağlama işlemleri görünür sonuç bildirir.
- Aile daveti: diğer ebeveynin hesabını aileye katmak için **8 karakter**.
- Cihaz eşleştirme: ayrı çocuk cihazını aileye bağlamak için çocuk cihazında üretilen **6 rakam**, 10 dakika geçerli. Ebeveyn kendi cihazındaki Ayarlar → Çocuk cihazları alanına yazar.
- Çocuk PIN’i: kendi profilini açmak için **4 rakam**; ebeveyn profil ayarlarından belirler/yeniler.
- Ebeveyn PIN’i: aynı telefondaki çocuk modundan çıkış için **4 rakam**; çocukla paylaşılmaz. Unutulursa mevcut ebeveyn hesabının şifresi yeniden doğrulanır; dönen kullanıcı kimliği mevcut kimlikle aynıysa kilit kaldırılır ve Güvenlik açılır. Yanlış şifre kilidi kaldırmaz. Sunucu RLS ve PIN deneme sınırları değişmez.
- Aynı telefonda çocuk modu için cihaz eşleştirmesi gerekmez.
- Giriş, kayıt ve şifre yenileme farklı açıklamalar kullanır. Şifre yenileme yanıtı e-posta adresinin kayıtlı olup olmadığını açıklamaz. Süresi dolan bağlantı yeni bağlantı istemeye yönlendirir.
- Prova seçenekleri yalnız başlık olarak değil, ne yaptıklarını açıklayan kartlarla sunulur. Çocuk profili olmayan deneme/seviye/ilerleme/paylaşım/puan ekranlarında aileye yönlendirme bulunur.
- Oda hâlâ onaylı sabit görseldir. Oda ayarları önce gerçek oda önizlemesini açar; saklanan eski karakter/pet tercihleri için mevcut “ana ekranı değiştirmez” açıklaması korunur. Atmosfer ve yeni animasyon teslimi iddia edilmez.

## Ekran envanteri ve kapsam

| Grup | Açılıp kontrol edilen ekranlar |
|---|---|
| Giriş/hesap | Ebeveyn girişi, aile oluşturma/katılma, çocuk cihazı bağlama, süresi dolmuş şifre yenileme, bildirimler, öğretmen paylaşımı, paketler, paylaşılan rapor, hesap silme onayı |
| Veli | Yeni ana ekran, takvim, görevler, ödüller, puanlar, notlar, aile ayarları, aynı telefonda çocuk moduna giriş |
| Prova | Genel bakış, deneme hazırlama, soru ekleme, senaryo ekleme, soru üretimi, seviye tespiti, konu ilerlemesi, kitapçık, deneme değerlendirme, çalışma planı |
| Çocuk | Onaylı oda/ana ekran, haftam, takvim, hedef seçimi, koleksiyon, profil seçimi, PIN, Prova listesi, soru çözme, oda önizlemesi |

Aynı çocuk bileşenlerini kullanan `/parent/child-mode/*` yönlendirmeleri ayrıca giriş/kilit akışında doğrulanır. Başlangıç/yönlendirme/layout dosyaları bağımsız ekran değildir. Ses kaynakları sayfası ortak ParentScreen yüzeyini alır; dış lisans sayfaları bu testte ziyaret edilmedi.

## Doğrulama ve sınırlar

- 37 ekran/durum × telefon ve tablet = **74** başarılı arayüz kontrolü. Yatay taşma, eksik görsel veya JavaScript ekran hatası yok. Hesap/veli/Prova gruplarında 48 dp altı düğme yok.
- **14 işlem kontrolü:** şifre yenileme, eşleştirme doğrulama/hata/başarı, cihaz adı, ebeveyn PIN kaydı, eksik PIN yönlendirmesi, yanlış/doğru çocuk PIN’i, yanlış/doğru hesap şifresiyle kilit davranışı, ilk çocuk formu, 320 px ayarlar.
- Tamamı izole HTTP/realtime örnek yanıtlarıyla; üretim veya demo aile kayıtları değiştirilmedi. Gerçek e-posta gönderimi veya gerçek hesap silme yapılmadı.
- iPhone 17 Pro / iOS 26.5 Simulator: yeni ayarlar, cihaz açıklamaları, güvenlik, Prova, takvim ve ders programı açıldı. `native-*.png` dosyaları bu uygulamadan alınmıştır; web görüntüsü değildir. Simülatör izole 54329 servisine bağlıdır.
- Native kontrolde takvimde iki ham boş metin ifadesi bulundu ve kaldırıldı. Bu ifadeler web’de görünmezken React Native hata veriyordu. Yeniden açılışta hata tekrarlanmadı. `scripts/check-native-text.test.mjs` bu sınıftaki hatayı CI’da engeller.
- Lint, TypeScript, 22 alan testi ve 7 yayın/native metin testi geçti.
- Gerçek iPhone 14 Pro Max kabulü, Apple/Google ödeme/satın alma, gerçek push teslimi ve gerçek şifre yenileme e-postası bu izole kontrollerin kapsamı değildir. Bunların geçtiği iddia edilmez.
- Hukuki sayfa adresi eksik olduğundan satın alma mevcut koruma gereği kapalı kalır. Bu durum iç TestFlight betasını engellemez; App Store ticari yayını ayrıca hazırlanmalıdır.
