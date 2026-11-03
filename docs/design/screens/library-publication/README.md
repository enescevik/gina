# Kütüphane · Yayına hazırla

3 Kasım 2026. Masaüstü/tablet maketi kullanıcı tarafından **“Evet, bu tasarımı uygula”** yanıtıyla onaylandı. Bu klasördeki uygulama görüntüleri gerçek Next/React bileşenlerinden, yalnız sentetik ağ yanıtlarıyla alınmıştır. Gerçek pilot incelenmiş veya yayımlanmış değildir.

[Onaylı maket ve uygulama karşılaştırması](comparison.html) · [Kontrol kaydı](verification.json)

## Uygulanan akış

Kütüphane → Taslak paketler → paket → **Yayın ayarlarını aç**. Dönüş aynı paketi açar. Soru incelemesi ve yayın kararı ayrı kalır. Başlık, açıklama, kontrol edilen program/dönem, Ücretsiz/Plus/Pro erişimi, aile katalog kartı önizlemesi ve açık yayın onayı tek çalışma alanındadır. Arşiv ayrı gerekçeli işlemdir.

- Bütün soruların son incelemesi uygun olmalı; tüm kaynak PNG'ler sunucuda doğrulanmalıdır. Program alanı editörün kullanım kapsamı beyanıdır, resmi müfredat uygunluk sertifikası değildir.
- Yeni sürüm eski onayı devralmaz. İnceleme değişince eski yayın katalogdan düşer; tekrar yayın açık onay gerektirir. Aynı operatör inceleyip yayımlayabilir; iki kişili onay şartı yoktur.
- Komut kullanıcıya özel cihaz deposuna yazıldıktan sonra gönderilir. Kaybolan cevapta aynı kimlikle tekrar; sunucuda tek karar/denetim kaydı. Çakışmada yerel düzenleme korunur, yeni kayıt açıkça kabul edilir.
- Erişim 30 saniye/odak dönüşüyle yenilenir; her sunucu işlemi yeniden yetki kontrolü yapar. Geçici hatada özel form gizlenir; yetki iptalinde temizlenir. Gönderilmemiş form yalnız bellekte tutulur, ayrılma uyarısı vardır.
- `library_packages.enabled` varsayılan **kapalıdır**. Bu ekranın yayın kararı tek başına aile erişimini açmaz, kota harcamaz. Katalog yalnız başlık/kapsam/sayı/erişim bilgilerini döndürür; kaynak görseli, cevap, rubrik ve editör notunu döndürmez.

## Görsel hazırlama sınırı

`library-media` yalnız doğrulanmış canlı yönetici oturumundan paket kimliği alır. Orijinal dosyayı özel kaynaktan okur; hash, PNG CRC, boyut ve gerçek sıkıştırılmış piksel içeriğini kontrol eder. Statik, non-interlaced 8-bit RGB/RGBA PNG desteklenir. Boyut, toplam içerik ve açılmış veri limitleri vardır; istemciden görsel URL'si veya aktör kabul etmez. Paket içindeki tüm hazırlamalar başarılı olmadan kaydetmez. Servis anahtarı tarayıcıya çıkmaz.

Çıktı yeniden kodlanmış, sRGB etiketli ayrı ve değiştirilemez PNG'dir. Orijinal kaynak korunur. Bilinmeyen renk profilleri reddedilir. Pilotun gömülü 480 baytlık sRGB-v4 ICC profili yalnız SHA-256 eşleşmesiyle tanınır: `c56e1685d888f5edb92fe07f2750f387f8fe8e91b32ff8fb0b56bfbbb9458353`. Profil [Compact ICC Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles) projesinin CC0 sRGB-v4.icc dosyasıyla aynı baytlardır. Test fikstürü bu profili içerir. Keyfi ICC profili dönüştürücüsü değildir; farklı ekranlarda mutlak renk eşitliği iddiası yoktur.

Gerçek pilotun sekiz PNG'si bu hattan geçirildi; bağımsız Pillow çözümlemesinde boyutları ve tüm RGBA piksel değerleri kaynakla aynı çıktı. Orijinaller değiştirilmedi; geçici çıktılar uygulama paketi değildir.

## Kabul ve açık işler

38 SQL testi, 11 Edge testi, sekiz gerçek eşzamanlı veritabanı yarışı; 81 core testi, workspace kontrolleri ve 16 rotalı üretim derlemesi geçti. 22 yayın ekranı kontrolü, 19 eski inceleme ekranı regresyonu, iki ekran arasındaki aynı paketle dönüş ayrıca doğrulandı. Dört boyutta yatay taşma yok; ölçülen görünür buton/link/özet kontrolleri en az 48 CSS px.

Bu kabul fiziksel iPad/Safari veya gerçek üretim PostgREST/Edge uçtan uca kabulü değildir. Ailenin paketi edinmesi, kalan aylık hakkın atomik tüketimi, ortak kaynağı koruyarak Prova'ya seçmesi ve mevcut atamalardaki sürümün korunması **sonraki iş**. Gerçek alan editörü incelemesi ve kalan 1.520 taslak açık. Canlı migration, Edge, hosting ve TestFlight yayını yapılmadı.


## Görsel sadakat düzeltmesi

Kullanıcının birebir eşleşme uyarısından sonra ilk uygulama yeniden incelendi: ilk teslim, maketin görsel kabulünü karşılamıyordu. Başlık/geri düğmesi sırası, kontrol satırlarının çerçeveleri ve ikonları, sütun/form boşlukları, paket seçimleri ve birincil düğme görünümü düzeltildi. Eski görüntüler `desktop-before-fidelity.png` ve `tablet-before-fidelity.png` olarak saklandı. Güncel uygulama görüntüleri aynı klasörde yenilendi; ayrıca 1036×882 masaüstü ölçüsünde kontrol yapıldı.

Görsel eşleşme, işlev testlerinin geçmesinden ayrı kabul edilir. Yeni tasarım alternatifi üretilmedi. Onaylı logo ve mevcut Baloo/Nunito dosyaları kullanıldı; raster maketten birebir font dosyası elde edilmiş gibi bir iddia yoktur. Açık inceleme onayı, gerçek kapalı erişim bilgisi, oturum bilgileri ve diğer yönetim bölümlerine erişim korunur. Maketin dış sunum çerçevesi ve “tasarım önerisi / örnek veri” etiketi uygulama kontrolü değildir. Bu farklılıklar ekran görüntülerinde gizlenmez. Tüm iş akışındaki 22 kontrol tekrar geçti; dört ölçüde görünür kontroller en az 48 CSS px ve taşma yok. Diğer bölümlere erişim ve kirli form ayrılma uyarısı da tekrar doğrulandı.
