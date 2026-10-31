# V5 kedi · uyku ve esneme incelemesi

31 Ekim 2026. Kullanıcı Pro erişimini açtı ve önce yalnız kedinin uyku/esneme örneklerini istedi. Bu paket hareket incelemesidir; diğer petlerin veya uygulama entegrasyonunun onayı yerine geçmez.

## Referans ve yöntem

- Tek kimlik kaynağı: `packages/assets/rooms/v2/pet-cat.webp`. Orijinal kaynak değişmedi.
- Video girişinde kaynak 768×512 piksel aynen korunarak 1024×1024 siyah tuvale (128, 320) yerleştirildi. Bu, esneme için kadraj payı sağlar; kedi yeniden çizilmedi veya ölçeklenmedi.
- Her iki klip aynı başlangıç/bitiş görüntüsünü kullanır. İstenen hareket dışında kamera, ölçek, tasarım veya ışık değişikliği istenmedi.
- İki video üretimi: 10 saniyelik uyku ve 10 saniyelik esneme. Kaynak MP4'ler 1440×1440, 24 fps, 241 kare, sessizdir. 10,041667 saniyelik teknik dosya süresi 241/24 kareden gelir.
- Model, iş kimlikleri ve eksiksiz promptlar `manifest.json` içinde tutulur. Yetkili medya URL'leri repoya yazılmaz.
- Şeffaflaştırma ayrı takip/mat işlemiyle yapılır. Hareketi oluşturmak için CSS scale, tek kare şişirme, kareler arasında yapay dönüşüm veya zaman yavaşlatma kullanılmaz. Önizlemedeki 0,5× seçeneği yalnız inceleme içindir; varsayılan 1×'tir.

## Yerleşim

Önizleme uygulamanın `RoomScene` yerleşimini izler: pet görünür dinlenme yüksekliği sahne yüksekliğinin %11'i, yatay merkez %34,5, ayak çizgisi %86. Başlangıç tuvalindeki içerik merkezi x=522, içerik altı y=764. Bu sabit yerleşim esneme sırasında değiştirilmez; her kareyi ayrı yeniden merkezlemek veya ölçeklemek yasaktır.

Oda montajı mevcut `room-home-v5.webp` ve `character-girl-v5.webp` kaynaklarını kullanır. Bu bir sanat/ölçek incelemesidir; canlı uygulama ekran görüntüsü değildir.

## Kabul sınırları

İlk değerlendirme: Esnemede baş/çene, boyun/omuz ve ön pati hareketleri ayrı ayrı görülüyor; tüm görseli büyütme efekti değil. Turuncu-beyaz kimlik ve sabit kamera korunuyor. Esnemenin ağız açıklığı belirgin ve ifade stilize; kullanıcı bunu daha sakin isteyebilir. Uyku nefesine baş/kulak bölgesinde de çok hafif hareket eşlik ediyor; baş tamamen piksel sabit değil. Özellikle açık zeminde ince tüy/maske kenarları nihai üretim için ayrıca değerlendirilmeli.

Her şeffaf klibin 241 karesi çözümlendi. 256×256 kontrol ölçeğinde uykunun sol/sağ/alt sınırı sabit; üst sınır 95–98 arasında. Esnemede alt sınır 190–191 arasında. Hiçbir kare tuval kenarına değmiyor. Bunlar anatomi veya doğallık garantisi değildir; ayrıntılı sonuç `validation.json` içinde.

- Kullanıcı hareket ve kimlik onayı bekleniyor.
- Şeffaf WebM tarayıcı önizlemesi içindir; native iOS/Android format/performans kararı değildir. Bazı oynatıcılar alfa alanını siyah gösterebilir; önizlemenin krem/koyu/damalı zeminleriyle kontrol edilir.
- MP4 üretimi düzenlenebilir kemik/rig kaynağı sağlamaz. Bu dosyalar rig diye adlandırılmaz.
- Döngü birleşimi, klipler arası geçiş, kenar titreşimi, fiziksel cihaz bellek/kare süresi ve pil kabulü ayrı yapılmalıdır.
- Diğer petler üretilmedi. Uygulama koduna, `apps/mobile/assets` klasörüne ve veritabanına dokunulmadı.

## Doğrulama

`cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec expo lint` geçti. Medya ve tarayıcı kontrol sonuçları `validation.json` dosyasına kaydedilir.
