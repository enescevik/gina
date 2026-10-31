# V5 oda atmosferi ve ses · 31 Ekim 2026

V5 kompozisyonu korunur: pencere, kitaplık, çocuk, pet, pano ve ödül alanları aynı ankrajlardadır. Bu paket **hava/ses uygulamasıdır; doğal pet animasyonu teslimi değildir.**

## Eşleme

| Parça | Kaynak | Uygulama |
| --- | --- | --- |
| Gündüz | `rooms/v2/room-home-v5.webp`, `room-study-v5.webp` | Var olan onaylı sanat |
| Kapalı hava | `atmosphere/room-overcast.webp`, `study-overcast.webp` | Yaygın gün ışığı; sert güneş gölgeleri azalır |
| Gün doğumu / batımı | `atmosphere/room-golden.webp`, `study-golden.webp` | Güneş yüksekliğiyle gün/gece arasına karışır |
| Gece | `atmosphere/room-night.webp`, `study-night.webp` | Soğuk dış ışık, sıcak iç ışık; native metinlere karartma uygulanmaz |
| Bulut | `atmosphere/cloud-bank.webp` | Camın üst bölgesine kırpılan alfa katmanı |
| Yağmur / kar / karla karışık yağmur | Runtime parçacıkları | Aynı cam sınırı; rüzgâr yönü ve hızına göre yatay hareket |
| Sis | Runtime cam içi yarı saydam katman | Eşyaları ve metinleri örtmez |
| Sağanak | Yağmur | Çakan ışık veya ani gök gürültüsü yok |
| Yağmur / rüzgâr | `audio/rain.mp3`, `wind.mp3` | Gerçek kayıt, filtrelenmiş düşük seviye ve döngü |
| Kedi mırıltısı | `audio/cat-purr.mp3` | Ses açıkken kediye dokununca; en az 12 saniye aralık |

Dosya adları `packages/assets/rooms/v2/` altına göredir. Tam ölçü, kaynak, dönüşüm, lisans ve SHA-256 ilgili manifestlerde. [Katman contact-sheet](../../../../../packages/assets/rooms/v2/atmosphere/contact-sheet.html), [ses dinleme sayfası](../../../../../packages/assets/rooms/v2/audio/contact-sheet.html).

Pencere kırpma geometrisi `AtmosphereBackdrop` içinde sahne koordinatlarıdır; dağıtılan bir SVG görseli değildir. Yeni SVG varlığı, SVG filtre/gradient veya görsele gömülü metin yok. Kaplama, çocuk ve petler ayrı katman olarak kalır. Işık kaynakları aynı kompozisyondan üretilmiş boyalı varyantlardır; bir 3B fiziksel ışık simülasyonu değildir.

## Veri ve davranış

Veli menüsünde Türkiye'nin 81 il merkezinden şehir seçilir. GPS, cihaz konumu veya çocuğun kimliği hava sağlayıcısına gönderilmez. Edge Function canlı oturum/aile üyeliğini doğrular, kayıtlı şehirden MET Norway tahminini alır. İstemcinin yolladığı şehir/koordinat/aile kimliğine güvenmez. Şehir önbelleği ortaktır; Expires / If-Modified-Since kullanılır, aynı şehirde eşzamanlı istekler kilitlenir ve hata sonrası 60 saniye beklenir.

Ekran **tahmin** ve üretim zamanını gösterir. Başarısız istekte eldeki geçerli önbellek “Son tahmin” olarak görünür. 24 saatten eski alınmış veya 30 saatten eski üretilmiş veri güncel hava olarak gösterilmez. Şehir seçilmediyse “Örnek atmosfer”; şehir var, kullanılabilir tahmin yoksa “Hava bekleniyor”. Şehir seçimi dakika başına, tahmin 15 dakikada bir yalnız açık ekranda yenilenir.

NOAA güneş konumu yaklaşımı UTC, tarih ve şehir merkezine göre hesaplanır; cihazın saat dilimi gökyüzünü değiştirmez. Pencerenin pusula yönü bilinmediği için rüzgârın yatay izdüşümü görsel bir temsildir. Bu bir meteoroloji ölçümü veya fiziksel hava simülatörü değildir.

Ses varsayılan kapalıdır. Veli izin verdikten sonra çocuk ses düğmesiyle başlatır. Prova/masa ekranlarında, görünmeyen rotada ve uygulama arka planındayken ses/hareket durur. Sistem “hareketi azalt” ayarı üstün gelir. Mikrofon, konum ve arka plan ses izni eklenmez.

## Dürüst sınırlar

- Bu hava/ses teslimindeki uygulama petleri statik. Sonraki kedi hareket adayları aşağıdaki ayrı inceleme paketinde; uygulamaya henüz bağlanmadı.
- Bu hava/ses teslimi sırasında Runway ücretsiz planındaydı ve pet klibi üretilmemişti. 31 Ekim'deki sonraki çalışmada Enes Pro'yu etkinleştirdi; ilk kedi uyku/esneme adayları [ayrı inceleme paketine](../cat-motion-v5/index.html) eklendi. Henüz kullanıcı kabulü veya native entegrasyon yapılmadı.
- Köpek, maymun ve aslan için bu tur ses kaydı teslim edilmedi. Kedi kaydı bu türlere kopyalanmaz.
- Kar parçacıkları vardır; dış manzarada kar örtüsü birikimi ve camda fiziksel damla akışı yok.
- Web fixture kayıtları gerçek uygulama render'ıdır; gerçek Supabase oturumu veya iPhone/Android performans kanıtı değildir. Demo veritabanına yazılmadı.
- Üretim Supabase projesi ve native build hazır olduğunda migration/Edge deploy ve fiziksel cihaz ses/performance kabulü yapılacak.

## Kaynaklar

[Expo 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/), [MET Norway koşulları](https://api.met.no/doc/TermsOfService), [MET lisansı](https://api.met.no/doc/License), [GeoNames](https://www.geonames.org/about.html), [NOAA güneş hesabı](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). Ses kaynak/lisans/değişiklikleri `packages/assets/rooms/v2/audio/LICENSES.md` ve uygulamadaki veli → ses kaynakları sayfasında.
