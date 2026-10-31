# V5 pet ve hava · üretim ve kabul brief'i

31 Ekim 2026. Mevcut uygulama görsel olarak v5'e giydirildi; petler şeffaf **statik** WebP'dir. `game-materials-v4` modelleri ve animasyonları reddedilmiştir. Bu işin yerine tüm hayvanı büyütüp küçültmek veya ağzı açık tek kare göstermek kabul edilmez.

## Önce tek kedi örneği

Kaynak hedefler: `docs/design/screens/child/art-direction-v5/room-day.png`, `room-sunset.png`, `room-night-snow.png`; uygulamadaki kedi kimliği `packages/assets/rooms/v2/pet-cat.webp` ve portresi. Kompakt kıvrılmış beden, aynı yüz/kulak oranları, boyalı tüy ve sıcak ışık korunur. Sanatçıya yalnız metin değil bu kaynaklar verilir.

Teslim: düzenlenebilir kaynak (Blender veya seçilen 2D rig aracı), doku/atlaslar, rig, ayrı klipler, lisans/üretim kaynağı ve modelden alınmış gerçek uygulama boyutunda ön izleme. 3D seçilirse GLB ve PBR dokuları; 2D seçilirse kemik/deformasyon kaynağı ve runtime çıktısı gerekir. Runtime seçimi bu dosyayla yapılmış sayılmaz; mevcut Expo 58 / RN 0.88.1 üzerinde tek kedi teknik denemesi geçmelidir. Yeni uygulama bağımlılığı henüz eklenmemiştir.

| Klip | Süre hedefi | Kabul |
| --- | --- | --- |
| sleep | 6–10 sn döngü | Göğüs/kaburga bölgesinde çok küçük nefes; pati ve zemin sabit, tüm sprite ölçeklenmez |
| wake | 2–3 sn | Göz kapağı → baş → gövde sıralaması; zeminden kopma yok |
| idle / blink | 4–8 sn | Göz kapağı ve kulak hareketleri; düzenli metronom gibi tekrar etmez |
| yawn / stretch | 4–6 sn | Çene, kapak, omurga, ön pati ve ağırlık aktarımı birlikte; ağız açıp scale uygulama yok |
| play | 3–5 sn | Türüne uygun küçük oyun; pano/karakteri örtmez, oda dışına çıkmaz |
| settle_sleep | 3–4 sn | Doğal kıvrılma ve başın yerleşmesi; sleep başlangıcıyla kesintisiz birleşir |

Önce kedi 390×844 ve 1280×800 sahnede v5 hedefiyle yan yana onaylanır. Sonra köpek, maymun ve aslan yavrusu aynı kaliteye çıkarılır; aynı iskeleti ve aynı zamanlamayı körlemesine kopyalamak kabul değildir. Sesler ayrıca kullanım hakkı belgeli, kısa ve düşük yoğunluklu olmalıdır. Prova/okuma sırasında dikkat isteyen oyun/ses yok; arka planda hareket/ses durur; hareketi azalt ve sessiz kullanım desteklenir. Peti aç/üzgün göstererek geri çağırma yok.

## Pencere ve oda ışığı

Aynı kamera ve nesne konumları korunarak gün doğumu, gündüz, gün batımı, gece; açık, bulutlu, yağmur, kar, rüzgâr ve sis varyantları hazırlanır. Dış dünya cam arkasında kalır. Yağmur eğimi ve kar sürüklenmesi rüzgârla uyumludur. Gece tüm ekranın üstüne koyu katman koymakla bitmez: dış ışık soğur, iç ışık sıcak kalır, native metin kontrastı korunur. Tüm pano/bilet/dolap metinleri native kalır.

Üretim kaynakları piksel hizalı ayrı dış manzara, ışık/gölge ve gerekiyorsa cam katmanları olmalıdır. Ayrı ayrı imagegen konseptleri arasında nesne kaymaları olduğundan bunlar doğrudan animasyon kareleri değildir. Tarih/aile saat dilimi ve güneş olayları gerçek veriden hesaplanır. Hava kaynağı, ticari kullanım lisansı, önbellek süresi ve maliyeti seçilmeden canlı hava denmez. Tercih: veli şehir seçer; çocuğun GPS iznini istemek gerekmez. Veri gelmezse son bilinen durum/zamanı veya açıkça örnek atmosfer gösterilir; rastgele karı gerçek hava diye sunma.

## Enes'in yapacağı somut adımlar

1. İlk üç yayın hesabını kur; bu sanat işi onların kurulmasını beklemek zorunda değil.
2. Bir karakter sanatçısı/animatörle çalışılacaksa bu brief'i ve kaynakları ver; önce **yalnız tek kedi** için küçük örnek teslim ve teklif iste. Model/doku/ses ticari kullanım hakkı sözleşmede olsun. Bu tur kimseye mesaj gönderilmedi, hizmet satın alınmadı.
3. Teslimi GLB/rig kaynaklarıyla repoya alalım. Ben kamera/ankraj, native metin, etkileşim, arka plan durdurma ve cihaz performans denemesini yapayım. Beğenilmeyen örneği diğer üç hayvana çoğaltmayalım.
4. Geçen örneğin runtime ihtiyacı ve ölçülen cihaz maliyeti somutlaşınca yeni paket/renderer kararı verilir. İlk TestFlight'a statik sanatla erken teknik kurulum yapmak, bu animasyon hedefinden vazgeçmek değildir.

Kabul cihazı, build, kare süresi/GPU bellek ve animasyon videosu kaydedilmeden “oyun kalitesinde hazır” denmez. Etkileşimli eğitim içerikleri bu görünümün üstüne ayrıca görev/öğrenme kuralları, geri bildirim ve erişilebilirlik gerektirir; yalnız renderer seçimi eğitim altyapısını tamamlamaz.
