# Güncel ek talimat — 30 Ekim 2026

Kullanıcı eski görev/ders/etkinlik/oyunlaştırma çizimlerini reddetti ve yeni premium, hikâye kitabı koleksiyon stilini onayladı. Kapsam: 66 görev, 19 ders, 20 etkinlik ve oyunlaştırma. Referans: docs/design/icon-refresh-v3/concepts/collectibles-direction.webp. Aynı klasördeki sekiz düz SVG önceki denemedir; seçilen yön değildir.

Eski SVG'leri görsel hedef olarak uygulama. Yeni resimli dosyalar ilgili kategori altındaki illustrated-v3/ dizininde WebP olacak. Küçük arayüz kullanımı için native SVG/Lucide, büyük görev kartları ve raf için resimli varlık ayrımı yap; karmaşık rozetleri 24 px'e küçültme. Yeni manifest hazır olmadan var olmayan dosya yollarına import ekleme. PNG kaynakları çalışma alanı dışında saklanır, teslim WebP'dir. Bu yeni resimli katman için onaylanan tonlama/doku önceki flat-only kurala istisnadır; temel renk aileleri ve ders/etkinlik renk eşlemesi korunur. SVG içine bitmap gömme.

Marka Yan Yana'dır. Ödül yıldızı simetrik beş kollu ayrı semboldür, eski yıldız-tik işareti hiçbir yeni görselde kullanılmaz. Seri/yükleme animasyonları aynı taban varlığı döndürme/ölçekleme/opaklık parametreleriyle çalıştırır; tutarsız AI kareleri üretme. Reduced motion sabit kareyi gösterir.

Yeni set üretim aşamasındadır; tüm manifestler doğrulanana kadar tamamlandı sayma. Kod değiştirmeden asset PR'ları kategori bazında gelecek. Yerel değişiklikleri koru. Önceki CI lockfile engeli main 28fa6cd ile giderilmiş görünüyor; güncel CI'ı yeniden kontrol et. Prova modülü ve sonradan gelen kodu koru.

---

# Claude'a tek seferde verilecek prompt

Gina projesinde tasarım yönünü değiştirdik. Önce `docs/design/room-v2/README.md`, `DESIGN-DECISIONS.md`, `IMPLEMENTATION.md`, `ART-HANDOFF.md`, `PRODUCT-EXTENSIONS.md`, `ACCEPTANCE.md`, `docs/DECISIONS.md` ve `apps/mobile/AGENTS.md` dosyalarını oku. `references/child-home-approved.png` ve `parent-home-approved.png` son onaylanan ana ekranlardır. Yeni main'i incele; paket inceleme tabanı 5d20850, sonraki değişiklikleri koru. Teslim sırasında bb390aa güncellemesindeki mevcut Haftam ve AI özet altyapısı da incelendi; bunları yeniden yaratma. Yerel pnpm-lock.yaml gibi kullanıcı değişikliklerini sıfırlama.

Çocuk ekranı artık oyun odası gibi: sol mobilya panosu görevler, sağ bilet hedef, duvar takvimi hafta, raf/çekmece başarılar ve ödüller. Alt bottom-nav ve odayı örten bağımsız beyaz dashboard butonları istemiyoruz. Görev, başarı, bakiye ve hedefe kalan ilk bakışta görünmeli. Onaylı resmi tek arka plan yapıp koordinatlarla buton koyma; sanat, gerçek i18n metin, veri ve erişilebilir kontroller ayrı katmanlar olsun. `scene-layout.json` yalnız başlangıç koordinatıdır; responsive ve büyük yazıda düzen yeniden akmalı.

Logo kararı 2 numaralı Yan Yana; iki kemerli yeni kaynak `packages/assets/brand/yan-yana/`. Eski yıldız-tik markasını artık tasarım yönü sayma, yıldız ödül simgesi olarak kalır. Yeni logo platform dosyalarına henüz bağlanmadı; bütün varyantları tek marka migration'ında ele al.

Kız/erkek/belirtmeyen başlangıç görünümü, herkesin tüm oda ve karakterleri seçebildiği ayrı tercihler olarak eklenecek; zorunlu gender alanı istemiyoruz. Üç oda aynı yerleşim/ankorları paylaşır, dekor ve karakter değişir. Yeni karakter ve boş oda görselleri `art-candidates` içinde konsept kaynaklarıdır, palet sertifikalı üretim asset'i değildir. Mevcut README ile raster/illüstrasyon çelişkisini gizleme; üretime alırken oda sanatı için palet uyumlu teslim veya açık stil istisnasını tasarım turunda çöz. İkonların SVG ve exact palet kuralları devam ediyor.

Hazinem: sinema bileti çekmecede, bisiklet/konsol gibi ödüller küçük simgeyle envanterde; odada en fazla üç seçili nesne. İlk sürüm sabit sergi yuvaları; serbest sürükle-bırak ve ayrı ödül odası ileride. Koleksiyonum: görev/seri ile kazanılan rozetler. Diş Parlatan rozetini en uzun fırçalama veya süre yarışı olarak yapma; planlanan bakımı tamamlama. Seri planlı gün/aile saat dilimi ve onay gecikmesini doğru yönetmeli. Zorlayıcı kullanım, loot box, leaderboard yok.

İleride Yeni Yıl, yerel kurtuluş günü, Ramazan Bayramı gibi günler ayrı açılıp kapanan dekor katmanları olacak. Aile tercihi ve doğru tarih/yerel takvimle çalışsın; dini tercih çıkarımı yapma, bayramı sabit Gregoryen güne kodlama.

Codex 4–6 kategorilerini ayrı PR'larda hazırladı: 19 ders × renkli/mono, 20 etkinlik × renkli/mono, ayrıntılı BRIEF listesine göre 38 oyunlaştırma + 10 mono yıldız. Her klasörde manifest/contact-sheet var. Bunları yeniden üretme; mevcut statik SVG import/fallback düzeniyle bağla. Görev MVP30/18 avatar/marka ilk teslimi zaten mevcut. Kalan 36 görev ve 7–11 kategorilerin tümü hazır varsayılmamalı.

Önce mevcut/yeni durum tespitini kısaca yaz ve yalnız çocuk + ebeveyn ana ekranının uygulanabilir prototipini geliştir. Mevcut TodayView query/RPC, child JWT, parent child-mode PIN, realtime, abonelik yetkilerini koru. `complete_task` done/approved ayrımını, `review_task` yıldız ledger'ını bozma; istemcide ödül yıldızı yazma. Returned yeniden gönderme ve DEFAULT_TIMEZONE farkını açık ele al. Yeni envanter/rozet/oda alanları mevcut değil: migration+RLS+idempotent RPC olmadan varmış gibi sorgulama.

İlk teslimde iki ana ekranı cihaz boyutları ve durum senaryolarıyla göster; sonra birlikte alt ekranlara geçeceğiz. Yeni veri modellerini sonraki ayrı değişikliklerde, gerçek yetki ve yarış koşulu testleriyle uygula. Tüm maddelerin tamamlandığını kanıt olmadan söyleme; tasarım adaylarını onaylı mockup diye etiketleme. TestFlight/hesap kurulumunu `OWNER-SETUP.md` durumuna göre ayrı yürüt; gizli anahtar isteme veya repoya yazma.

Bilinen CI engeli: ana dalda react-native-svg-transformer package.json kaydı lock dosyasına işlenmemiş. Frozen install duruyor; mevcut yerel lock değişikliğini inceleyip kendi geliştirme akışında çöz. Codex asset tesliminde kod/lock dosyasını değiştirmedi.
