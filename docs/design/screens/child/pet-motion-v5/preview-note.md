# V5 · köpek, maymun ve aslan yavrusu hareketleri

31 Ekim 2026. Kullanıcı kedinin uyku/esneme örneklerini onayladı ve aynı V5 yaklaşımını diğer üç hayvana uygulamamızı istedi. Bu paket her hayvan için **uyku + esneme**, toplam altı klip içerir. Uyanma, bekleme/göz kırpma, oyun ve bağımsız uykuya yerleşme klipleri tamamlanmış sayılmaz.

## Kimlik ve hareket

| Hayvan | Uyku | Esneme |
| --- | --- | --- |
| Köpek | Hafif nefes ve kısa kuyruk ucu tepkisi | Sarkık kulakların başı takip etmesi, köpek çenesiyle esneme ve ön ayakların öne uzanması |
| Maymun | Kıvrılmış beden, el/bilek ve kuyrukta küçük yerleşme hareketleri | Kolun omuz-dirsek-bilekle açılması, diğer elin yanağa gelmesi ve yeniden kıvrılma |
| Aslan yavrusu | Yavaş nefes, geniş patilerin üzerinde dinlenme | Omuzların daha ağır ilerlemesi, geniş patilerin uzanıp geri alınması ve küçük yavru esnemesi |

Kaynaklar `packages/assets/rooms/v2/pet-{dog,monkey,lion}.webp`. Her 768×512 kaynak, piksel boyutu değiştirilmeden (128,320) konumuyla 1024×1024 tuvale yerleştirildi; giriş çizimleri yeniden üretilmedi. Başlangıç ve bitiş hedefleri aynı kaynak. Sabit kamera, sabit sahne ölçeği, türüne özgü eklem sıralaması istendi. Kaynak görsellerin SHA-256 değerleri manifestte.

## Dosyalar

- `{pet}-{sleep,yawn-stretch}.mp4`: orijinal üretilen video; prompt/model/iş kimlikleri manifestte.
- `{pet}-{sleep,yawn-stretch}-alpha.webm`: ayrı şeffaflaştırma işleminin çıktısı. Kaynak hareket yeniden çizilmedi.
- `{pet}-{sleep,yawn-stretch}-contact.webp`: 0–9. saniyelerin kareleri; `contact-sheet.html` altında altı şerit.
- `{pet}-reference-stage.webp` ve `-reference-poster.webp`: video giriş tuvali ve şeffaf poster.
- `comparison.mp4`: üstte üç uyku, altta üç esneme; soldan sağa köpek, maymun, aslan. Yazısız, sessiz, orijinal 1× hız.
- `index.html`: hayvan seçimi, iki klibi oynatma/durdurma, 0,5× inceleme, krem/koyu/damalı zemin ve V5 oda yerleşimi.
- `media-validation.json`, `browser-validation.json`: medya bütünlüğü ve önizleme kontrolleri.

Video üretiminde CSS scale, tek kare şişirme veya yapay ara kare kullanılmadı. FFmpeg yalnız tuval hazırlama, kare çıkarma ve şeffaf klipleri karşılaştırma zeminine yerleştirme için kullanıldı. Orijinal videolar korunuyor.

## İlk eleştirel değerlendirme

Hayvanlar aynı zamanlamanın kopyası değil. Köpek kısa bir ön ayak uzanışı yaparken maymun yana yaslanıp kolunu açıyor; aslan daha ağır bir pati uzanışı yapıyor. Kaynakların yüz/renk/lekeleri korunuyor. Köpek ve maymunun uyku kliplerinde tarif edilen sakin nefese kuyruk/el hareketi de eşlik ediyor; tamamen hareketsiz bir uyku döngüsü olarak sunulmuyor. Maymunun esnemesi yerde destek alan el yerine yanağa gelen el içeriyor; çıkan hareket ve ilk prompt farkı saklanmıyor.

İnce tüy, bıyık ve parmak kenarları şeffaflaştırma nedeniyle özellikle açık zeminde ayrıca değerlendirilmeli. Kliplerin kaynak başlangıç/bitişleri çok yakın olsa da her durum geçişinin native uygulamada kesintisiz olacağı henüz kabul edilmedi.

Aslanın ilk iki metin isteği sağlayıcının CHARACTER filtresi tarafından reddedildi; çıktı oluşmadı. Özgün Gina hayvanı olduğu açıkça belirtilen daha kısa hareket tarifleriyle aynı kaynak üzerinden üretildi. İlk başarısız işler ve kullanılan yeni promptlar manifestte ayrı kaydedildi.

## Yerleşim ve kabul

Oda montajı `RoomScene` ile aynı dinlenme boyutunu kullanır: görünür içerik yüksekliği oda yüksekliğinin %11'i, yatay merkez %34,5, içerik altı %86. Her klibin tuvali bu ilk dinlenme sınırından bir kez hizalanır; hareket sırasında yeniden merkezleme veya ölçekleme yapılmaz. `room-home-v5.webp` ve `character-girl-v5.webp` kaynakları aynıdır. Bu sanat montajı canlı uygulama kaydı değildir.

Kaynak MP4 ve şeffaf WebM teslimleri hareket incelemesi içindir. WebM'yi bazı oynatıcılar siyah zeminle gösterebilir; önizleme sayfasında gerçek alfa farklı zeminlerde görülür. Henüz native iOS/Android runtime seçimi, rig/kemik kaynağı, cihaz bellek/pil/kare süresi kabulü veya türlere özel ses teslimi değildir. Üretilen video rig diye adlandırılmaz.

Uygulama kodu, `apps/mobile/assets` ve veritabanı değiştirilmedi. `cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec expo lint` geçti. Tam medya ve tarayıcı sonuçları yan dosyalardadır.

Yerel önizleme: repo kökünde `python3 docs/design/screens/child/cat-motion-v5/serve.py`, sonra `http://127.0.0.1:8772/docs/design/screens/child/pet-motion-v5/index.html`. Sunucu zaten açıksa ikinci kez başlatma.

## Kontrolde düzeltilenler

- Maymunun ilk şeffaflaştırma çıktıları alfa etiketi taşımasına rağmen tamamen opaktı. İki klip de yeniden ayrıldı; başarısız işler manifestte korunuyor, hatalı dosyalar teslim kaynaklarına dahil edilmiyor.
- Köpeğin ilk esneme klibinde kuyruk 181–184. karelerde sol kadraj sınırına değdi. Kaynak hareket daha kısa esneme tarifiyle yeniden üretildi; ilk sürüm nihai karşılaştırmada kullanılmıyor. Yeni sonuçta kuyruk yine az miktarda açılıyor; hedef, kuyruğun tüm karelerde kadraj içinde kalması.
- Köpek uyku maskesinde hayvandan uzakta görülen küçük artıklara, tüm kaynak karelerindeki içerik sınırlarının birleşimi + 24 piksel güvenli pay dışında şeffaflık uygulanıyor. Hayvanın içindeki RGB/maske, tuval ve zamanlama korunuyor. Sağlayıcı çıktısı ve temizleme dikdörtgeni teslimde mevcut.

Son kabul kontrolü: altı son klibin toplam 1.446 karesi çözüldü; boş katman, tamamen opak kare veya tuval kenarına temas yok. Tarayıcıda üç hayvan için 1280/390 px genişlikte taşma, eksik görsel ve JavaScript hatası yok; seek, oynatma/durdurma, koyu/damalı zemin ve oda seçimi geçti.
