# GINA: kalemli çözüm defteri, kaynak parçaları ve veli incelemesi

Araştırma tarihi: 2 Kasım 2026. Kapsam: mevcut Expo 58 uygulamasının koddan incelemesi ve resmî platform belgeleri. Uygulama kodu, paketler ve veritabanı değiştirilmedi; fiziksel cihaz testi yapılmadı. Aşağıdaki “Inferences” bölümleri öneridir, tamamlanmış özellik değildir.

## Bugün gerçekten ne var, hangi parçalar eksik?

### Takeaway
Mevcut çizim aracı profesyonel cevap defteri değil: veli soru görseli oluşturabiliyor, çocuk açık uçlu soruya yalnız metin yazabiliyor. Düzenlenebilir çizim cevabı, kalem özellikleri ve veli çizim katmanları yeni çalışma gerektiriyor.

### Cited Findings
- `DrawingPad` çizgileri yalnız yol ve renkle tutuyor; sabit kalınlık, dört renk ve son çizgiyi geri alma var. Hareket sırasında React durumu güncelleniyor; kaydetme 1000×600 PNG üretiyor, düzenlenebilir çizgi verisini teslim etmiyor. Basınç, eğim, araç türü, ileri alma ve çizgi seçimi yok. Çoklu dokunmayı atlamak avuç reddetme uygulaması değil. [DrawingPad](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/components/learning/drawing-pad.tsx)
- Çocuğun açık uçlu cevap alanı `TextInput`; cevap nesnesinde metin/seçenek ve kayıt revizyonu bulunuyor. Çizim cevabı ve kaynak parçası yerleştirme yok. [Çocuk prova ekranı](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/child/prova/[examId].tsx)
- Soru görselleri imzalı adresle gösteriliyor; mevcut bileşen resimden alan seçme veya büyütülmüş inceleme sunmuyor. [QuestionMedia](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/components/learning/question-media.tsx)
- Expo 58, React Native 0.88, Gesture Handler 3.3, Reanimated, SVG, ImageManipulator ve SQLite mevcut. Skia kurulu değil. [Paketler](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/package.json)

### Inferences
- Mevcut `DrawingPad` üzerinde yalnız görünüm değişikliği yapmak kullanıcının istediği akıcı, tekrar düzenlenebilir defteri sağlamaz. Çocuk cevapları için ayrı bir defter bileşeni ve kalıcı belge modeli kurulmalı.
- Telefon: “Soru / Defter” geçişi ve her zaman açılabilen küçük kaynak görünümü. Tablet: soru solda, defter sağda, ayarlanabilir bölme. Tek belirgin tamamla/gönder eylemi; araç çubuğunda Kalem, Silgi, Seç, Yazı, Sembol, Geri/İleri. Parmakla çizim ve sayfayı taşıma açıkça ayrılmalı.
- GINA’nın krem, mint ve mor dili korunmalı; hafif çizgili/kareli/boş kâğıt seçenekleri ve solak araç yerleşimi sunulmalı. İlkokulda az araç, ilerleyen düzeylerde geometri ve matematik araçları açılmalı. Bu yaş gruplaması pedagojik doğrulama gerektiren tasarım önerisidir.

### Gaps
- Kullanılan mevcut çizim aracının gerçek cihaz gecikmesi ölçülmedi. Kaynak kodu özellikleri gösteriyor; kullanılabilirlik veya fiziksel kalem kalitesi kanıtlamıyor.
- Erişilebilir araç etiketleri, ekran okuyucu alternatifleri, büyük yazı ve en az 48 dp etkileşim alanı ayrıca tasarlanıp test edilmeli.

## iPhone, iPad, Android ve web üzerinde doğal kalem deneyimi nasıl sağlanabilir?

### Takeaway
Parmakla çizmek ve tam kalem desteği aynı özellik değildir. Basınç, avuç reddetme, iptal edilen temasları temizleme ve düşük gecikme için cihaz yeteneklerini tanıyan bir çizim katmanı gerekir.

### Cited Findings
- Apple PencilKit düşük gecikmeli çizimi, araçları ve `PKDrawing` saklama/yeniden yüklemeyi destekliyor; çizimler ayrıca görüntüye çevrilebiliyor. `PKDrawing` çizgileri ve veri temsili sağlıyor. [PencilKit](https://developer.apple.com/documentation/pencilkit), [PKDrawing](https://developer.apple.com/documentation/pencilkit/pkdrawing-swift.struct)
- PencilKit çizim politikası kalemle sınırlı veya diğer girişlere açık seçilebiliyor. Bu, kalemle çizerken parmağı taşıma gibi ayrı davranışlara ayırmak için uygun bir temel. [Çizim politikası](https://developer.apple.com/documentation/pencilkit/pkcanvasviewdrawingpolicy/anyinput)
- Apple Pencil uyumluluğu cihaz ve kalem modeline bağlı. Kullanıcının belirttiği iPhone 14 Pro Max desteklenen cihaz listesinde bulunmuyor; o cihaz için Apple Pencil sözü verilmemeli. [Apple uyumluluk listesi](https://support.apple.com/en-us/108937)
- Android basınç, eğim ve araç türü gibi veriler sağlıyor. Avuç algılamasının iptal ettiği temasların çizime işlenmiş izleri geri alınmalı; yalnız ikinci parmağı yok saymak yeterli değil. [Android gelişmiş kalem özellikleri](https://developer.android.com/develop/ui/compose/touch-input/stylus-input/advanced-stylus-features)
- Android Ink, hareket girdisi, düşük gecikmeli sürmekte olan çizgiler, tamamlanan çizgiler ve saklanabilir giriş kümeleri için bileşenler sunuyor. [Android Ink modülleri](https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/ink-api-modules)
- Kurulu Gesture Handler’ın 3.x belgeleri `pointerType` ve `stylusData` basınç/eğim alanlarını açıklıyor; iptal olayları ayrıca ele alınabiliyor. Bunlar tek başına hazır bir defter veya avuç reddetme sistemi oluşturmuyor. [Pan gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pan-gesture/), [Olaylar](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/callbacks-events/)
- Web Pointer Events basınç/kalem bilgisi ve birleştirilmiş hareket olayları tanımlıyor; desteklenmeyen basınçta varsayılan değerler kullanılabiliyor. Tahmin edilen noktalar gerçek alınmış noktalarla aynı veri sayılmamalı. [W3C Pointer Events](https://www.w3.org/TR/pointerevents/)
- Expo 58’in Skia desteği Android, iOS ve web’i kapsıyor; bu bir çizim işleme kütüphanesi. Expo Modules API ile Swift/Kotlin görünümleri de eklenebilir; özel native modül için geliştirme derlemesi gerekir. [Expo Skia](https://docs.expo.dev/versions/v58.0.0/sdk/skia/), [Özel native kod](https://docs.expo.dev/workflow/customizing/)

### Inferences
- Kalite hedefi için iki yol ölçülmeli: PencilKit + Android Ink + web adaptörü veya ortak çizim işleyicisi + Gesture Handler. İlki doğal kalemde güçlü, ikincisi ortak nesne seçimi ve platformlar arası belge davranışında daha kolay olabilir. Nihai seçim küçük cihaz prototipiyle yapılmalı.
- Ortak uygulama sözleşmesi kullanılmalı; platforma özgü çizim verisi korunurken taşınabilir çizgi/nesne verisi ve görüntü önizlemesi ayrıca saklanmalı. Bir cihazdaki çizim diğer cihazda yalnız resme dönüşüp düzenlenemez olmamalı.
- Nokta başına React render veya ağ isteği olmamalı. Çizgi bitişinde kalıcı kayıt, yerel işlem günlüğü ve kontrollü toplu eşitleme uygulanmalı. Basınç desteği yoksa tutarlı sabit kalınlık tercih edilmeli.

### Gaps
- Yeni çizim motoru/modülü henüz seçilmedi veya ölçülmedi. Skia paketi kurulu olmadığı için mevcut özellik diye sunulmamalı; yeni bağımlılık ve cihaz derlemesi ayrı uygulama kararıdır.
- iPad/Apple Pencil, Android/S Pen, kullanıcının iPhone 14 Pro Max’i ve web üzerinde avuç, döndürme, yakınlaştırma, hızlı çizim ve erişilebilirlik testleri yapılmalı. Bütün cihazlarda eşit donanım özellikleri vaat edilemez.

## Sorudaki sembol ve görseller deftere güvenilir biçimde nasıl alınır?

### Takeaway
`|AB|`, `35°` ve tren/yol gibi parçalar gerçekten kaynaktan kopyalanmalı; AI yeniden çizimi veya tahmini kaynak kopyası gibi sunulmamalı. Metin ve görsel parçasının kaynak bağlantısı korunmalı.

### Cited Findings
- Kurulu Expo ImageManipulator, kaynak piksel koordinatlarıyla dikdörtgen kırpma sunuyor; Android, iOS ve web desteği var. Bu işlem için üretken AI gerekmiyor. [ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/)
- Mevcut dosya hazırlığı boyutlandırma, dosya özeti ve resim hazırlığı yapıyor; kaynak bölgesi, defter nesnesi veya kopyalanmış sembol modeli oluşturmuyor. [Learning files](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/lib/learning-files.ts)

### Inferences
- Metin seçiminden “Deftere al”: aynen kopyalanan metin düzenlenebilir nesneye dönüşür; kaynak soru/blok kimliği ve sürümü korunur. `|AB|` ve `35°` için soru yazarı isteğe bağlı hazır parça düğmeleri tanımlayabilir.
- Görselde “Alan seç”: kullanıcı dikdörtgen çizer; ekrandaki contain boşluğu, yakınlaştırma ve kaydırma ters dönüşümle gerçek piksel bölgesine çevrilir. Sonuç orijinalden kesilmiş resimdir. Serbest seçim ve nesne ayırma daha sonraki aşama olmalı.
- Sembol çekmecesi `± × ÷ ≤ ≥ ≠ ≈ √ π ∠ ° ⟂ ∥ →`, kesir ve üs şablonları sunabilir. Görsel gösterimin yanında okunabilir metin temsili korunmalı. OCR önerisi varsa doğrulanmamış öneri olarak gösterilmeli.
- Ortak metin/görsel birkaç soruya bağlanmalı; sürümlenmiş “kaynak bloğu” bir kez saklanmalı. Geçmiş cevaplar, öğretmenin daha sonra değiştirdiği kaynakla sessizce değişmemeli. Çocuğa çözüm anahtarı veya gizli değerlendirme alanı taşınmamalı.
- Defter belgesi: sayfa boyutu, katmanlar, çizgiler, metinler, kaynak nesneleri, dönüşümler ve revizyon. PNG yalnız önizleme/paylaşım çıktısı olmalı; tek asıl kayıt olmamalı.

### Gaps
- Ortak kaynak blokları, kaynak bölgesi nesneleri ve matematik metni erişilebilirliği henüz uygulanmış değil.
- Raster metinde seçilebilir gerçek karakter yoktur; OCR veya yazarın önceden tanımladığı doğrulanmış parçalar gerekir. OCR’ı kesin transkripsiyon gibi sunmak yanlış olur.

## Veli notu ve AI değerlendirmesi çocuğun cevabını bozmadan nasıl çalışmalı?

### Takeaway
Çocuğun gönderdiği cevap sabit sürüm olarak korunmalı. Veli işaretleri ve AI önerileri ayrı katmanlar olmalı; AI kararsız veya okunamayan cevabı otomatik yanlış saymamalı.

### Cited Findings
- Veli inceleme ekranında 0–100 puan ve metin geri bildirimi mevcut; çocuk cevabına çizim ekleme, ayrı özel not ve katman gösterimi bulunmuyor. [Veli incelemesi](/Users/enes/.codex/worktrees/gina-avatars/gina/apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx)
- Mevcut AI değerlendirme akışı açık uçlu cevapta `answer_text` arıyor. Kullanılan görüntüler soru görselleri; çocuğun çizdiği cevap görselleri değil. Veli tarafından puanlanmış cevabı yeniden AI ile ezmeme koruması bulunuyor. [Prova grade](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/functions/prova-grade/index.ts)
- Mevcut özel kaynak modeli belge/soru görseli ve soru/plan/görev/ödül/hedef bağlantılarını içeriyor; cevap veya inceleme çizimi bağlantısı yok. Yükleme işlemleri veliye ayrılmış; çocuk cihazına kendi atanmış sorusunun görselini okuma tanınıyor. [Kaynak sözleşmesi](/Users/enes/.codex/worktrees/gina-avatars/gina/supabase/migrations/20261102130000_learning_sources.sql)

### Inferences
- “Benim özel notum” ve “Çocuğa geri bildirim” ayrı görünmeli. Kalemle işaretleme, metin notu ve ölçüt bazlı puanlama çocuğun orijinal katmanından ayrılmalı; katman aç/kapat ve kaynakla yan yana inceleme sunulmalı.
- AI’ye soru metni, ortak kaynak, değerlendirme ölçütü ve çocuğun cevap görüntüsü/metni açık etiketlerle gönderilmeli. El yazısının dış sağlayıcıya gönderimi, yalnız soru görseli onayıyla aynı şey sayılmamalı; veliye açıkça anlatılan ayrı izin ve kapsam gerekir.
- AI çıktısı yalnız toplam puan olmamalı: doğru adımlar, eksik gerekçe, olası hata, ilgili cevap bölgesi, güven/okunabilirlik ve bir sonraki çalışma önerisi. Okunamayan bölümde insan kontrolü istenmeli. Özel veli notları ayrıca istenmedikçe modele gönderilmemeli.
- Yeni cevap dosyası yetkileri yalnız ilgili çocuğun aktif denemesine bağlı olmalı. Dosya türü/boyutu, aile sınırı, imzalı erişim, hesap silmede temizlik ve denetim kaydı tanımlanmalı; mevcut veli yükleme korumasını topluca kaldırmak uygun olmaz.
- Her kayıt için işlem kimliği ve beklenen revizyon; aynı isteğin tekrarında tek sonuç. Çevrimdışı çizim dayanıklı yerel kayıtla korunmalı; iki cihaz çatışması sessizce bir cevabı silmemeli. Gönderilmiş sürümün üzerine geç gelen otomatik kayıt yazamamalı.

### Gaps
- El yazısı doğruluğu, okunabilirlik eşiği, değerlendirme ölçütleri ve maliyet/limitler gerçek örneklerle ölçülmedi. AI değerlendirmesine “öğretmen doğruluğu” atfedilemez.
- Gerekli testler: yalnız çizim cevabı; metin+çizim; boş/okunamayan cevap; veli puanının korunması; kaynak değişikliği; izin iptali; yanlış aileden erişim; eşzamanlı kayıt; uygulamanın kapanıp açılması; tekrar gönderme; çevrimdışı geri dönüş.
