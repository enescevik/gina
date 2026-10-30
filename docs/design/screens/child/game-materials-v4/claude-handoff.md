# Claude'a verilecek güncel ek

Gina'da çocuk odası yönü gerçek 3D nesneler ve kontrollü kamera olarak inceleniyor. Son inceleme paketi `docs/design/screens/child/game-materials-v4/`. Önce `README.md`, `manifest.json`, `qa-report.json`, `comparison.html` ve `viewer.html` içeriğini incele. V1/V2 tablet maketleri reddedildi; onları uygulama hedefi olarak kullanma. Bu v4 paketinin final sanat onayı da henüz yok; bu tur mobil kodu değiştirme.

Odanın anlamı değişmedi: sol görev panosu; ortada hava/saat gösteren pencere, kitaplık ve eğitim girişi; halıda seçilebilir çocuk ve pet; sağda hedef bileti, hafta takvimi ve ödül dolabı. Pano, bilet ve dolabı arka plan resmine gömme. Metin native ve i18n'de kalmalı. Çocuk bottom-nav yok.

20 ayrı GLB, iki düzenlenebilir Blender kaynağı, doku haritaları ve çalışır bir Three.js inceleme aracı hazır. Üç çocuk, dört pet, 13 ödül ayrı yüklenebilir. Animasyonlar gerçek kemik/nesne kanallarıdır; tüm görseli büyüten esneme yoktur. Ancak segmentli rig, yüz/saç sanatı ve hareketler hâlâ kalite incelemesinde. Dört pet klibi teslim edildi; wake/idle/settle_sleep, yüz rig'i, doğal ses ve tür bazlı animasyon rötuşu ayrıca gerekir.

Hava durumu 4 gün evresi × 6 hava seçeneği olarak manuel denenir. Güneş yüksekliği/yönü, ışık rengi, ufuk parıltısı, gece iç ışığı; dış yağış, damlalar, kar birikimi ve rüzgâr hareketleri var. Gerçek konum/saat/hava API'si yok. Üretim sözleşmesi `phase, weather, windStrength, visible, appActive, focusMode, reduceMotion, soundEnabled` girdilerini ayırmalı. Prova sırasında ortam hareketleri/sesleri durmalı; uygulama arka plandayken simülasyon çalışmamalı. Ses varsayılan kapalı olmalı. Çocuk için GPS şartı koyma; veli şehir tercihi ve çevrimdışı varsayılanı ayrıca tasarla.

Yeni paket kurma ve Three.js web önizlemesini doğrudan native çözüm diye gömme. Görsel onaydan sonra mevcut Expo sürümüyle renderer uygunluğunu test eden ayrı bir teknik deneme gerekir. 300+ draw call / yaklaşık 130 bin üçgen mevcut inceleme yüküdür; düşük cihaz bütçesi değildir. Atlas/mesh birleştirme/LOD ve gerçek cihaz raporu olmadan üretime alma.

Eğitim katmanı için kitap, görev, ödül, pet etkileşimleri ayrı sahne olayları olmalı; ödül/puan/başarı üretme yetkisi sahnede olmamalı. Mevcut veri, yetki, RPC, realtime ve yönlendirme kuralları korunur. Veri ya da iş kuralı gerektiren işleri sunum değişikliğine karıştırmadan ayrı öner. Nihai onaydan sonra maket/uygulama karşılaştırması ve ayrı giydirme PR'ı hazırlanacak.
