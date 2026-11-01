# GINA — özgün mint tasarımının uygulama kontrolü

Tarih: 1 Kasım 2026. Uygulama kaynak commit’i: `8bd785e`.

## Uygulanan tasarım

Çocuk odası, kullanıcının ZIP içinden görüp “evet bu” diye onayladığı özgün kaynaktan gösterilir: `packages/assets/rooms/mint-home/layered-v1/approved-original.png`. SHA-256: `dd0ac7c3f8fc56ea3da328325c1ddebf1cc7c34573583d1c3748e564d960610f`.

1536 × 1024 panonun oda alanı x=46, y=193, 729 × 641 pikseldir. Bu kaynak yüksek çözünürlüklü yeni bir oda gibi sunulmaz. Görsel orantılı ölçeklenir; kısa yatay telefonda üstten kırpılarak maskot ve kitap görünür kalır. Yazılar, görevler ve ilerleme uygulamada gerçek verilerle çizilir. Tablette sağ panelin yalnız sahneye bakan köşeleri yuvarlaktır; alt menü ekran boyunca uzanır.

Yeni oda veya maskot üretilmedi. Kontrolden geçmeyen parça adayları uygulamaya ve EAS paketine alınmadı. Saat/hava değişimleri ve bağımsız maskot hareketleri bu sürümde yoktur. Eski karakter/pet tercihleri korunur; sabit sahneyi değiştirmedikleri seçim ekranında açıklanır.

## Ekran kapsamı

| Grup | Kontrol edilen ekranlar |
| --- | --- |
| Çocuk | Dünyam, profil seçimi, PIN, haftam, takvim, hedef seçimi, koleksiyon, oda tercihleri, Prova listesi, soru çözümü |
| Veli | Ana ekran, görevler, ödüller, takvim, puanlar, notlar, aile/menü, çocuk modu seçimi |
| Veli Prova | Özet, deneme hazırlama, soru, senaryo, AI soru üretimi, seviye tespiti, konu ilerlemesi, kitapçık, sonuç/puanlama, çalışma planı |
| Hesap/diğer | Giriş, aile oluşturma/katılma, cihaz eşleştirme, bildirimler, öğretmenle paylaşma, paylaşılan rapor, paketler, şifre sıfırlama, hesap silme onayı |

Ortak yüzeyler krem, koyu mor metin, mor ana eylem ve mint başarı vurgularına taşındı. Eski logo alt ekran başlıklarından çıkarıldı. Çocuk ekleme ayrı ve görünür bir alan; PIN ve profil silme ise çocuğun ayarları altında. Veri sorguları, yetki ve kayıt kuralları korunur.

## Bulunan ve düzeltilen native farklar

- NativeWind’in native stil işleyicisi, Pressable stil fonksiyonlarını değerlendirmediği için bazı butonlar dolgusuz ve alt menü sola yığılmış görünüyordu. Ortak Pressable bu fonksiyonu native stile çevirmeden önce çözer; basılı/üzerine gelme durumları ve erişilebilirlik özellikleri korunur.
- Çocuk özet kartları telefonda tam genişlikte gösterilir.
- Koleksiyon kartlarındaki yüzde yüksekliği iOS’ta çok uzun kartlar oluşturuyordu; içerik ve minimum yükseklik kullanılır.
- Telefon dikey/yatay geçişi desteklenir; görev penceresi iki yönde açılır.

## Doğrulama ve kanıt

[Ekran galerisi](evidence/mint-complete/index.html) uygulamadan alınmış görüntüleri içerir; yeni tasarım maketi değildir.

- TypeScript ve Expo lint geçti; web export başarılı.
- Core testleri: 4 dosyada 18/18 başarılı.
- Çocuk ana ekranı: 17 akış kontrolü; veli ana ekranı: 13 kontrol; ek kritik akışlar: 10/10 başarılı. Sonuç JSON dosyaları galerinin klasöründedir.
- Telefon 320/390 ve tablet 1280 × 800 ölçülerinde ekranlar; çocuk ana ekranında ayrıca 4:3 tablet ve yatay telefon. Kontrol edilen ekranlarda yatay taşma ve eksik görsel yok. Ölçülen etkileşim alanlarında 48 dp altı hedef bulunmadı.
- iPhone 17 Pro / iOS 26.5 simülatöründe native uygulama derlendi: giriş, veli ana ekranı, takvim açma/hafta değiştirme/etkinlik formu, çocuk seçimi/PIN, çocuk ana ekranı, görev penceresi, koleksiyon ve veliye dönüş gözlendi. Native görüntüler `native/` klasöründedir. Ayrıca iPad Pro 11 (M5) / iOS 26.5 simülatöründe veli ve çocuk yatay ana ekranları, çocuk seçimi ve PIN girişi doğrulandı (sistem dili İngilizce). Bu, kullanıcının fiziksel iPhone 14 Pro Max’inde yapılmış test değildir.
- Akışlar izole HTTP/WebSocket test verileriyle çalıştırıldı. Mevcut yerel veya üretim aile kayıtları değiştirilmedi. Üretim auth sağlık yanıtı HTTP 200.
- Statik web test sunucusunda bazı ilk açılışlar boş yükleme görünümünde kalabildi; sayfa yenilemesiyle açıldı. Ekran kanıtları veri ve fontlar yüklenince alındı. Bu kontrol, canlı web dağıtımını doğruladığımız anlamına gelmez.

## Beta ile mağaza yayınının ayrımı

Bu teslim TestFlight betasıdır. Fiziksel iPhone/iPad kabulü, gerçek üretim hesabında uçtan uca işlem, push teslimi ve StoreKit satın alma/geri yükleme bu tasarım kontrolüyle doğrulanmış sayılmaz. Hesap silme ve AI üretimi gibi dış etkili işlemler gerçek kullanıcı verisine uygulanmadı.

Yayın ön kontrolünde `EXPO_PUBLIC_LEGAL_BASE_URL` eksikliği uyarı olarak kalır. Halka açık App Store yayını öncesinde gizlilik/abonelik sayfaları ve gerçek cihaz kabulü ayrıca tamamlanmalıdır. TestFlight gönderimi ve Apple işleme sonucu ayrı sürüm kaydında belgelenir.
