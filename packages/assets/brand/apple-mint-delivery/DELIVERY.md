# GINA · Apple/TestFlight görsel teslimi

1 Kasım 2026. Onaylı panonun sol altındaki uygulama ikonu esas alındı. Mint gövde, krem beyaz iki yaprak, koyu mor yüz ve mor zemin korundu. Yatay logo ve peluş ayrı kullanım olarak incelendi; ikon kaynağı olarak kullanılmadı.

- `app-icon.png`: 1024×1024, opak RGB PNG, gömülü sRGB profili; tam kare mor zemin. Yazı, yuvarlatılmış köşe, cihaz çerçevesi veya dış gölge yok.
- `app-icon-dark.png`: aynı maskot ve yerleşim; yalnız zemin koyu mora uyarlanmıştır.
- `app-icon-tinted.png`: aynı maskot ve yerleşim; iOS renklendirmesi için gri tonlu teknik uyarlama. 1024×1024 opak RGB; üç kanal eşittir.
- `mascot-mark.png`: 2048×2048 RGBA, sRGB, temiz dış alfa sınırı.
- `mascot-mark-mono.png`: aynı dış alfa maskesi; tek koyu mor dolgu. Bu dosya yüz detayları olmayan siluettir.
- `contact-sheet.png`: onaylı ikon kırpımı ve beş üretim dosyası yan yana. Şeffaf dosyaların arkasındaki açık gri yalnız önizlemeye aittir.

## Üretim ve sınırlamalar

Yerleşik image_gen ile referanslı düzenleme kullanıldı. İlk iki şeffaf üretimde yaprak çevresinde beyaz artıklar görüldüğü için kullanılmadı. Son opak 1254×1254 üretim `references/imagegen-master.png` içinde saklandı. Sharp ile dört renk normalizasyonu, dış zemin ayrıştırması, iç alfa boşluklarının kapatılması, tek renk/gri ton dönüşümleri, ölçekleme ve sRGB dışa aktarımı yapıldı. `build.cjs` işlemi yeniden üretir.

**Bu dosyalar birebir vektör aktarımı değildir.** Referans raster panodur; uygulama ikonu yaklaşık 225×218 pikseldir. Üretken yeniden çizimde yaprak eğrileri, gövde/ayak boşluğu ve göz-ağız oranlarında küçük farklar kaldı. Düz renkler referansın hafif ton/doku değişimlerini kaldırır. 2048 tuval, 1254 piksel üretimin yeniden örneklenmesidir; doğal 2048 ayrıntı veya vektör kalitesi iddia edilmez. Katı geometrik eşleşme gerekiyorsa bu paket yerine onaylı özgün vektör kaynağından dışa aktarım gerekir. Yeni marka için gerçek vektör bulunmadığından SVG eklenmedi.

## Apple ve Expo kontrolü

Okunan yerel yapılandırma: `apps/mobile/app.json` zaten `ios.icon.light`, `dark`, `tinted` yollarını tanımlıyor; Expo bağımlılığı `~58.0.21`. `app.config.js` iOS ikon alanını değiştirmiyor. Bu nedenle üç PNG hazırlandı. Koyu ve tinted yeni konsept veya ayrı marka onayı değil, aynı maskotun teknik türevleridir.

[Expo ikon rehberi](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) mevcut PNG yaklaşımının desteklendiğini, kare 1024 tuvali, köşelerin sistem tarafından maskelenmesini ve opak çıktı kullanımını belirtir. [Expo yapılandırma referansı](https://docs.expo.dev/versions/latest/config/app/) üç görünüm alanını belgelendirir. [Apple App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) PNG ve Icon Composer biçimlerini, sistem maskelemesini ve sRGB desteğini açıklar; güncel rehber katmanlı Icon Composer biçimini daha fazla görünüm kontrolü için önerir. Bu teslim mevcut PNG yapılandırmasına yöneliktir; katmanlı `.icon` veya özel clear görünümü içermez.

Teknik dosya kontrolü ve görsel yan yana inceleme yapıldı. Gerçek iOS cihazında, Icon Composer'da veya TestFlight derlemesinde doğrulanmadı; iOS'un Liquid Glass/tint işlemleri görünümü değiştirebilir. Uygulama varlıklarına ve yapılandırmasına dokunulmadı. Apple yüklemesi, derleme, commit ve push yapılmadı. Entegrasyon ana sohbete aittir.
