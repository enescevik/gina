# Claude gece çalışma protokolü

> **6 Kasım devam notu:** 5–6 Kasım gece çalışması tamamlandı; bu protokolün N00/Fable başlangıcını veya eski 07.00/kota hedefini yeni oturumda tekrar başlatma. Güncel işler, öncelikler ve kapanış ölçütleri [ana listenin §4A bölümündedir](CLAUDE-REMAINING-WORK.md#4a--6-kasım-sonrası-devam-planı). Mevcut başlangıç cevaplarını `release/overnight-2026-11-06/FABLE-PREFLIGHT.md` ve `DECISIONS.md` üzerinden koru. Aşağıdaki genel alt ajan/checkpoint ilkeleri sürer; yeni tarihli gece hedefi ancak gerçekten belirlenirse geçerlidir.

5 Kasım 2026 · Ana iş [N00](CLAUDE-REMAINING-WORK.md). Bu dosya gelecek Claude oturumunun talimatıdır; bu dokümantasyon çalışmasında Fable çalıştırılmadı, hesap kotası görülmedi veya gece otomasyonu başlatılmadı.

## Önce Fable ile incele ve başlangıç sorularını bitir

1. Çalışan yüzeyi/sürümü, Fable model erişimini, abonelik oturumunu ve gerçek kullanım ekranını kontrol et. Claude Code destekliyorsa `/model fable` ile ilk incelemeyi çalıştır; kullanılan gerçek model/sürüm ve kaynak commit'i kaydet. Erişim yoksa başka modeli Fable diye sunma; kullanıcı ayrılmadan izinli alternatif veya erişim adımını netleştir. [Resmî model seçimi](https://code.claude.com/docs/en/model-config).
2. Fable güncel repo/yerel değişiklikleri, ana yapılacaklar listesini, Q00 ekran kapsamını, M01 araştırmasını, açık PR ve yayın durumunu incelesin. Çıktısı: yapılmış/açık ayrımı, bulgular, öneriler, gerekçeli teknik/ürün kararları, bağımlılıklar, gece için gerçekçi iş dağılımı ve başta sorulacak konular. Kodlanmış temeli yeniden kurmasın.
3. Önce kendin git/GitHub, Supabase, Cloudflare, Expo/Apple ve bu gece gerekecek diğer oturumları, izole test DB'sini, tarayıcı/simülatörü ve araç izinlerini kontrol et. Sır değerlerini yazdırma veya sohbette isteme. GINA üretim API anahtarını Claude aboneliği kontrolü için silme/değiştirme.
4. Aşağıdaki sorulardan yalnız gerçekten cevap/eylem gerekenleri **tek başlangıç mesajında** kullanıcıya sun. Eski kapsam, PR/merge/yayın ve alt ajan izinlerini tekrar isteme. Yeni finansal/hesap sahibi kararlarını mevcut izin gibi yorumlama.

| Başlangıç konusu | Claude'un netleştireceği |
|---|---|
| Tarih ve kullanım | Bu çalışmanın `[tarih] 07.00 Europe/Istanbul` bitişi; kullanım ekranında hangi limitin ne zaman yenilendiği. Görebiliyorsan kullanıcıya tekrar sorma. |
| Fable ve harcama | Fable erişiminin gerçek durumu; erişim yoksa izinli alternatif. Abonelik dışı yeni ücretli tüketim için varsayılan 0; gerekiyorsa somut gerekçe/üst sınırı başta sor. |
| Geceyi engelleyecek erişim | Hizmet, gerekli işlem ve kullanıcının tamamlayacağı giriş/2FA adımı. Parola/anahtar/kod sohbete istenmez. |
| Çalışma ortamı | Makine güçte, ağ ve uygulama/oturum açık kalacak mı; gereken cihaz/izin erişilebilir mi? Eksikse hangi fiziksel testlerin bekleyeceğini yaz. |
| Yeni ürün kararı | Fable'ın bulduğu, dosyalarda cevabı olmayan birkaç somut tercih; öneri ve etkisiyle sor. Cevap yoksa ilgili işi beklet, mevcut kuralı koru ve bağımsız işe geç. |

`docs/release/overnight-YYYY-MM-DD/FABLE-PREFLIGHT.md` içinde inceleme, gerçek model/commit, sorular/cevaplar, tarihli süre, izin/harcama sınırları ve iş dağılımını kaydet. Kullanıcının “yüzde 55 hakkım var, 07.00'de yenileniyor” beyanını doğrulanmış kullanım verisi veya harcanabilir API bakiyesi sayma. Abonelik ve API ücretlendirmesi ayrıdır; otomatik API/ek kullanım faturası açma. [Resmî abonelik açıklaması](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan).

## Hazır olunca otonom ve paralel ilerle

- Kullanıcı başlangıçta gerekli cevapları verdikten sonra her rutin adımda tekrar bekleme. N00 → R01 acil gizlilik yayını → Q00 ilk inceleme ve hazır L/U/P/B/S/M01 işleri. R01'i geniş araştırma veya bütün envanterin bitmesi için bekletme. Kütüphane toplu üretimi yazılım işlerinden sonra; 3B yalnız bütün işler ve R02 bittikten sonra.
- Ortamın desteklediği kadar **yararlı bağımsız alt ajan** kullan. Başlangıç için 2–4 işçi düşünülebilir; kapasite ve hazır iş oldukça artır. Bu sayı zorunlu tavan değildir. Boş ajan veya sırf kota tüketmek için tekrar iş üretme. Alt ajanlar da aynı kullanım sınırlarını tüketir. [Alt ajan dokümanı](https://code.claude.com/docs/en/sub-agents).
- Her görevde ID, kaynak commit, amaç, yazılabilir dosyalar, dokunulmayacak alanlar ve kabul testlerini belirt. Kod işçileri ayrı worktree/dalda; ortak i18n, lockfile, migration numarası ve şema değişiklikleri tek koordinatörde sıraya girsin. Canlı DB/Edge dağıtımı, merge ve yayın tek koordinatörün işi; alt ajanlar izole test ortamı kullanır.
- Başka bir ajan/ana koordinatör değişikliği bağımsız gözle incelesin; kontrolü geçmeyen PR merge edilmesin. Q00 çok yönlü ekran incelemesi ve gerçek telefon/tablet kanıtı süreç boyunca devam eder. Yeni işlev/silme/geçmiş değişikliği gizlice yapılmaz.
- Aynı engelde en fazla üç anlamlı teşhis/düzeltme denemesi veya 15 dakikalık etkin teşhis sonrası nedeni/kanıtı/sonraki adımı kaydet ve bağımsız işe geç. Normal çalışan derleme/CI bekleyişi hata değildir; tekrar başlatmak yerine başka işe ilerle. Yetki/ödeme/uzman/cihaz engeli aşılmaz, açık kutu kapanmaz; 3B bu yüzden öne çekilmez.
- İzinleri mevcut güvenli otomatik mod veya dar repo/test/yayın kapsamıyla önceden hazırla; prompt araç izninin yerine geçmez. `bypassPermissions` veya güvenlik denetimini kapatma çözüm olarak kullanılmaz. Yeni zorunlu onay çıkarsa ilgili iş bekler. [İzinler](https://code.claude.com/docs/en/permissions).

## Süre, kota ve devam kaydı

Her paket bitiminde, bağlam sıkıştırma öncesinde ve kota düşerken `docs/release/overnight-YYYY-MM-DD/PROGRESS.md` güncelle: tarih/saat dilimi, ID, ajan/dal/worktree/commit, değişen dosyalar, test, PR, yayın, engel ve sıradaki somut adım. Ana liste kutularını yalnız kabul sağlanınca kapat. Oturum devamında bu kayıt okunur; baştan araştırma/tekrar üretim yapılmaz.

Başlangıçta belirlenen tarihin **06.30** saatinde yeni geniş iş açmayı bırak, aktif işleri güvenli kayıt/test/PR noktasına getir. **07.00** için tamamlanan–test edilen–yayımlanan ayrımı, sürümler/linkler, ekran kanıtı, engeller, kullanıcı adımları ve devam talimatını ver. Başka gün başlatılan işte eski tarih kullanılmaz; tüm backlog'un bir gecede bitmesi vaat edilmez.

Kota/oturum durursa ancak çalışan sürümün izinli bekleme/devam desteği gerçekten varsa ve başlangıçta seçildiyse kullan. Aksi hâlde checkpoint bırak; çalışmıyorken “arka planda devam” deme. Yeni hesap, izinsiz ücretli API veya denetim atlama ile limit aşma yok. Prompt tek başına zamanlayıcı değildir; bu belge yeni otomasyon kurmaz. Amaç kotayı boş yere tüketmek değil, mevcut haklarla mümkün olan en çok kabul edilmiş işi tamamlamaktır. [Kullanım yönetimi](https://code.claude.com/docs/en/costs).
