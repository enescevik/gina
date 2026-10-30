# Odam kaplamaları — BRIEF 13

Boyalı kaplamaların üretim kaynağı manifest `file` alanındaki `png/*@3x.png` dosyasıdır. Eski SVG çizimleri görsel olarak bu PNG’leri üretmez; `legacyVectorFallback` yalnız önceki sürüm uyumluluğu içindir. Yeni basit kontrollerde `vectorSource` gerçek SVG kaynağıdır.

- Insets/contentRegions: kaynak @3x piksel; dp için üçe böl.
- `stretch: both`: dokuz dilim; köşeler sabit, orta şeritler esner.
- `stretch: horizontal`: yüksekliği orantılı ölçekle, sol/sağ kapakların tüm yüksekliğini koru; yalnız yatay orta şerit uzar. Sol kapaktaki yıldız/kilit/artı dikey orta şeritte kesilmemeli.
- `stretch: none`: orantılı çiz, esnetme.
- `minimumLogicalSize` altına inme. Metinler native; makette boş bırakıldı.
- Pressed/disabled: aynı alfa ve boyut, yalnız renk modülasyonu. `supersedes` eski dosyayı ve hash’ini gösterir.
- Birleşik `cabinet-display` kullanılırken eski raf/çekmeceyi ayrıca çizme.
- `contact-sheet.html` ve `contact-sheet.webp` güncel üretim setidir; eski `contact-sheet.svg` yalnız eski vektör setini gösterir.

Tam eşleme ve yan yana montaj: `docs/design/room-v2/references/preview-note.md` ve `brief-13-montage.html`.
