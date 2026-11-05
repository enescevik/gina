# GINA — kalan işler ve Claude devir listesi

5 Kasım 2026 · Durum tabanı: main `4de387e28a5c3c2faad339fc44c5e26ac5eeb313` / PR #147.
Bu dosya **kalan işlerin yürütme sırası ve kapanış ölçütleri için ana listedir**. [Ekran envanteri](EXPERIENCE-IMPLEMENTATION.md) rota/alt akış ayrıntılarını tamamlar; oradaki tarihsel notlar yeni durumun önüne geçmez.

## 1. Devralırken

**Son ek talep:** Önce N00 kapsamında Fable ile proje incelemesi ve başlangıç soru paketi; ardından tarihli 07.00 hedefine kadar yararlı alt ajanlarla otonom ilerleme. OYSS için M01 güncel resmî kaynak edinme ve soru ilişkisi zorunludur. Ayrıntılar: [gece protokolü](CLAUDE-NIGHT-RUN.md), [MEB senaryo protokolü](learning/MEB-SCENARIO-PROTOCOL.md), [araştırma ve kaynaklar](../reports/MEB%20senaryoları%20ve%20gece%20devri.md).

1. Güncel main'i getir; `git status` ve worktree'leri incele. Yerel değişiklikleri koru; reset/clean, demo DB sıfırlama veya yeniden tohumlama yapma. Bu devir hazırlanırken aktif repo `/Users/enes/.codex/worktrees/gina-library-access/gina` idi; yeni ortamda yol farklı olabilir.
2. Önce bu belge, `docs/EXPERIENCE-IMPLEMENTATION.md`, `docs/DECISIONS.md`, `apps/mobile/AGENTS.md`, `apps/backoffice/AGENTS.md` ve aşağıdaki yayın raporlarını oku. Ürün kurallarındaki eski metinle son kullanıcı kararı çelişirse son karar geçerlidir; değişikliği karar kaydına işle.
3. Kodda uygulanmış işleri yeniden kurma. Rota envanterindeki “yeniden doğrulanacak” ifadesi mevcut ekranın bozuk veya hiç yapılmamış olduğu anlamına gelmez. Önce gerçek davranışı dene, farkı kaydet, yalnız gereken kısmı değiştir.
4. Her pakette küçük `codex/…` dalı + PR + test kanıtı kullan. Önceki kullanıcı onayı PR'ların başarılı kontrollerden sonra birleştirilmesine ve hazır yayınların yapılmasına izin verir. Tasarımın ortak dilini mevcut ekranlara uyarlamak için tekrar genel onay isteme. Hesap sahibine ait zorunlu işlemleri veya geri döndürülemez yeni kararları tamamlanmış varsayma.
5. Dış engeli olan işi `BEKLİYOR` olarak, gerekli kişi/işlemle işaretle; bağımsız işe geç. Bir engeli atlamak o işi tamamlamak değildir. Yalnız yazılı plan çıkarıp bütün kapsamı bitmiş sayma.

**Son kullanıcı kararı:** 3B dünya, diğer bütün işler bittikten sonra başlayacak. Kütüphane üretimi yazılım/kullanım işlerinden sonra, **3B dünyadan önce** yapılacak. Sosyal alanın mevcut yetkili kapsamı plan/pilot hazırlığıdır; doğrudan sosyal ağ yayınına dönüştürülmeyecek.

## 2. Başlangıç durumu — yeniden yapma

| Kapsam | Kanıtlı durum | Kalan sınır |
|---|---|---|
| Web, korumalı yönetim, iOS ve kayıtlı çocuk iPad'i | Son yayın kaydı 0.1.0 (26). Web/yönetim/sunucu paketi yayımlandı; TestFlight iç grupta, Ad Hoc tablet paketi ayrıca yayımlandı. | Fiziksel cihaz kabulü bütün özellikler için tamamlanmış değil. Canlı durumu devralırken yeniden doğrula. |
| Program tablosu, açıklamalı belge aktarımı, kısaltma eşleme, zil/saat düzeni, dolu hücre takası | Uygulandı. [Program raporu](release/timetable-2026-11-05/README.md). | Boş hücreye sürükleme, dışarı kaydırma, katalog bağlantısının ve fiziksel kullanımın tamamlanması. |
| Dosya/galeri/kamera, çoklu kaynak; yönetilen seçenekler; süre/puan/tarih/saat kontrolleri | Temel uygulama ve yayın mevcut. [Deneyim raporu](release/experience-2026-11-05/README.md). | Tüm kullanım yerlerinde tutarlılık ve fiziksel izin/çekim testleri. Baştan yeni bir dosya sistemi kurma. |
| Prova taslak kaldırma/geri alma; ders programını temizleme | Uygulandı. [Kayıt yaşam döngüsü](release/content-lifecycle-2026-11-05/README.md). | Diğer içeriklerde toplu işlemler, silme etkisi ve daha kapsamlı geçmiş. |
| Çocuk eğitim yılı/okul geçmişi, profil arşivi, dönem raporları, okul puanı geçmişi | Uygulandı ve 26 paketine dahil. [Yayın kapsamı](release/foundation-2026-11-05/README.md). | Seçerek görev/ödev aktarımı, gerçek takvim içeriği, kalan UX/kabul. |
| Görev rutini geçmişi, arşiv ve gönderim anındaki bilgiyi koruma | Uygulandı ve 26 paketine dahil. [Rutin raporu](release/task-routines-2026-11-05/README.md). | Yeni görev sihirbazı, eski planın tarihli gösterimi, toplu işlemler. |
| Ödül düzenleme/geçmiş/arşiv; eski talebin adı ve bedeli | PR #146 main'de; henüz 26 üzerine dağıtılmadı. [Kanıt](release/reward-history-2026-11-05/README.md). | R01 yayın, U04 talep/teslim/oluşturma kullanımı, fiziksel kabul. |
| Özel not düzenleme/geçmiş/arşiv ve kişisel not RLS düzeltmesi | PR #147 main'de; henüz üretime dağıtılmadı. [Kanıt](release/note-history-2026-11-05/README.md). | R01 yayın. “Sadece ben” erişim düzeltmesi migration uygulanmadan canlıda etkin değil. |
| Yönetilen eğitim takvimleri, okul istisna kuyruğu, uygulama içi duyurular | Altyapı 26'da; yıl sınırı hatırlatması varsayılan kapalı. | Gerçek takvimler, fiziksel push, e-posta/SMS kanalları. |
| Defter, ortak kaynak, veli çizim katmanı, cevap/taslak kurtarma | Mevcut çalışan temel; web/native simülatör ve yerel servis kanıtları var. | Kullanım sadeleştirmeleri ve fiziksel Pencil/klavye kabulü; yeniden yazma gerekçesi değil. |
| MEB senaryo bağı | Katalog inceleme/yayın, aile seçimi, sunucuda sabit senaryo ve AI toplam/blok sayısı kontrolü kodda mevcut. 648 senaryo/708 çıktı kaydı henüz inceleme bekleyen adaydır. | M01: güncel dosya edinme/revizyon, soru başına çıktı ve içerik uygunluğu; canlı veri/yayın durumunu devralırken doğrula. Eski OUTCOME-INDEX entegrasyon notunu kod yokluğu sayma. |
| AI | Anthropic gerçek üretim/kayıt/kota akışında test edildi. | Ek sağlayıcı adapterleri, özellik/model yetenek matrisi ve yeni kullanım kontrolleri. |
| Kütüphane | `docs/learning/library-pilot/coverage.json`: 77 sınıf/ders, hedef 1.540; 100 taslak, 1.440 eksik, 0 bağımsız onay, 0 yayın. | K01. Bu 77 hücre bütün seçmeli/alan derslerinin ve yıllık kazanımların tam kapsamı değildir. |

Yayın kaynakları: [26 ana paket](release/foundation-2026-11-05/README.md), [26 çocuk tableti](release/tablet-26-2026-11-05/README.md), [yönetim koruması](release/backoffice-2026-11-05/README.md). Eski belgelerde geçen 17/18/20/22/25 numaralarını güncel sürüm sanma.

## 3. Bütün paketlerde korunacak kurallar

- Onaylı mint/mor/krem, mevcut Nunito/Baloo 2, özgün `gina` yazısı ve mint peluş maskot korunacak. Yeni logo, oda mimarisi veya tasarım yönü üretme. Kaynaklar: `docs/design/screens/parent-home-mint/`, `child-home-mint/`, `home-fidelity-restoration/`, `calendar-premium/`, `prova-notebook/` ve `fidelity-completion/`. Bir dosyanın yeni tarihli olması tek başına tasarım onayı değildir.
- Çocuk telefon dikey ve yatay, tablet dikey ve yatay kullanılabilir; oda hissi korunur. Native metin, en az 48 dp hedef, safe area, klavye, büyük yazı ve azaltılmış hareket tercihi gözetilir. Yapılacak işi animasyonun bitmesi engellemez. Statik görsele gömülü buton/metinle etkileşim taklit edilmez.
- Veliye birincil iş ve açık sonuç; çocuğa somut sıradaki adım ve sakin hata. Puan, tanı/zekâ/kişilik yargısı değildir. Sıralama isteğe bağlı/ikincil; cezalandırıcı veya utandırıcı dil yok. Psikolog/pedagog bakışı ürün ilkesi olarak uygulanır, uzman/klinik onay gibi sunulmaz.
- Sorgu/RPC/sunucu değişiklikleri kullanıcı tarafından yetkilendirildi; yalnız JSX sınırı artık yok. Buna rağmen aile/çocuk/cihaz/yönetici sınırları sunucuda korunur. Yayımlanmış/atanmış soru ve eski yıldız/bedel/cevap/puan kanıtı sessizce değişmez.
- Kaydet, yayımla, gönder, sil, arşivle ve satın al farklı işlemlerdir. Kaydetmek yan etkili yayın/gönderim yapmaz. Kayıp yanıt, çift dokunma, eski revizyon ve iki oturum test edilir; “başarılı” ancak kalıcı sonuç doğrulanınca gösterilir.
- Hesap/aile değişiminde özel önbellek ve taslak kapsamını koru. Realtime ipucu olarak kullanılır; yeniden bağlanınca/focus'ta doğrula. Aktif çizim/metin taslağı gelen okumayla ezilmez. Başka veliye özel geçmiş veya destek ekip notu açılmaz.
- TR/EN metinler `packages/core/src/i18n/tr.json`, `en.json` ve yönetimin mevcut i18n düzeniyle tutulur; mevcut anahtarlar sessizce silinmez. Ham sunucu hatası, UUID veya JSON düzenleme sıradan kullanıcı akışı olmaz.
- Mevcut bileşenleri, bağımlılıkları ve sözleşmeleri önce kullan. Geçmiş “yeni paket ekleme” sınırını topluca kaldırılmış sayma; zorunlu yeni paket ihtiyacında gerekçeyi belirt. `expo-audio` ve sunucu `@resvg/resvg-wasm` için önceki izin yeniden istenmez.
- Hiçbir şifre, API anahtarı, cihaz token'ı, özel kullanıcı belgesi veya kişisel test kaydı Git/rapor/PR'a yazılmaz. Sentetik veriyi ayrı test ortamında kullan; mevcut demo veya üretim ailesini sıfırlama.

Mobil kaynaklarda `components/…` kısaltması `apps/mobile/src/components/…`, uygulama yolları `apps/mobile/src/app/…`, yalın migration adları `supabase/migrations/…` altında çözülür. Süslü parantezli listeler aynı klasördeki ayrı dosyaları belirtir.

## 4. İş sırası ve durum yöntemi

Sıra: **N00 → R01 → Q00 ilk inceleme → L01–L04 → U01–U09 → M01 → P01–P05 → B01–B04 → S01–S06 → Q01–Q04 → K01 → F01 → R02 → WORLD-01**.
N00 başlangıç hazırlığıdır; R01 acil yayını geniş Fable/Q00 araştırmasının bütün ayrıntılarının kapanmasını beklemez. M01 bağımsız teknik hazırlığı öne alınabilir; toplu kütüphane üretimi K01 sırasını korur. Bu, geliştirme önceliğidir; ileri aşamadaki servis/entegrasyon kabulü erken UI işini durdurmaz. Aşağıda “son kabul” olarak belirtilen bağlar geliştirmeye başlama koşulu değildir. Ortak sözleşmeyi mevcut koddan sabitle, iki tarafı ayrı uygula, birleşik testi sonra kapat. Bağımsız işler öne alınabilir; R01 gizlilik yayını diğer kapsam için bekletilmez. S01/S02/S03/S05 hesap sahibi veya uzman adımları erkenden başlatılır. Ara TestFlight yayınları yapılabilir. R02 tüm kapsamın son yayın/kabulü; 3B bundan sonradır. Q00 ilk incelemesi iyileştirmelerin öncesinde başlar, her pakette düzeltme sonrası tekrarlanır; yalnız en sondaki cihaz testine bırakılmaz.

Durumlar: `AÇIK`, `YAPILIYOR`, `KOD HAZIR`, `TEST EDİLDİ`, `YAYINLANDI`, `BEKLİYOR`. Kutucuk ancak işin kabul ölçütleri kapandığında işaretlenir. Her işte sonuç notu şu alanları taşımalı: **commit/PR; değişen dosyalar; test/ekran kanıtı; yayın sürümü veya yayımlanmadı; kalan sınır**. Başlangıçta aşağıdaki bütün kutular açıktır; “temeli var” yeniden geliştirme talimatı değildir.

### N00 — önce Fable incelemesi, başlangıç soruları ve gece çalışma düzeni
- [ ] **N00 / Gece devrini hazırla ve kanıtla.** Bağımlılık: çalışan Claude yüzeyi, gerçek model/kota/araç erişimi; kullanıcı ayrılmadan gerekli başlangıç cevapları.
  - Kaynak: [Claude gece protokolü](CLAUDE-NIGHT-RUN.md), bu liste, Q00 ekran envanteri, M01 araştırması, mevcut kod/açık PR/yayın raporları.
  - Yap: Fable erişimini doğrula ve projeyi önce onunla incele; gerçek model/commit, öneriler, kararlar ve bağımlılıkları kaydet. Önce kendin erişim kontrollerini yap, sonra yalnız mevcut kararlarda cevabı olmayan ürün/izin/hesap/süre sorularını tek başlangıç paketinde sor. Fable yoksa kullanıcı ayrılmadan izinli alternatifi netleştir; yapılmamış incelemeyi Fable raporu diye yazma.
  - Çalışma: hedef tarih ve Europe/Istanbul 07.00 bitişi; 06.30 toparlama. Yararlı bağımsız işleri ortamın izin verdiği alt ajanlara dağıt; ayrı worktree/dosya sahipliği, tek migration/merge/yayın koordinatörü, bağımsız kontrol ve checkpoint. Aynı engelde üç anlamlı deneme veya 15 dakika etkin teşhis sonrası kaydet ve bağımsız işe geç. Rutin onayları tekrar isteme; yeni zorunlu onayı atlama.
  - Kabul: `FABLE-PREFLIGHT.md` ve `PROGRESS.md` içinde gerçek model, başlangıç cevapları, iş/ajan dağılımı, test/PR/yayın ve sabah devam kaydı. Yüzde 55/07.00 kullanıcı beyanı doğrulanmadan gerçek kota sayılmaz; abonelik dışı yeni ücretli tüketim varsayılan 0. Bu belge oturum sürekliliği garantisi veya otomasyon kurulumu değildir; kütüphane ve 3B sırası korunur.

### R01 — hazır düzeltmelerin öncelikli yayını
- [ ] **R01 / P0 / Kod hazır, yayın açık.** Bağımlılık: güncel canlı sürüm/env ve yetkili yayın oturumları.
  - Kaynak: `supabase/migrations/20261105180000_reward_history.sql`, `20261105190000_note_history.sql`, ilgili iki release raporu; `.github/workflows/`, `scripts/deploy-preflight.mjs`.
  - Yap: canlı migration envanterini oku; uygun yedek ve eski istemci uyumunu kontrol et; bekleyen migration'ları sırasıyla uygula; web/mobil/tablet istemcilerini aynı kaynaktan yayımla. Yönetim bu paketten etkileniyorsa aynı kaynakla güncelle. Eski istemcinin kalıcı not silmesinin artık reddedileceğini sürüm notuna yaz.
  - Kabul: iki veli + çocuk + yabancı aileyle özel/paylaşılan not sınırı; paylaşım iptalinin açık ekranda görünmesi; eski ödül talebinde özgün bedel/ad; yeni web ve gerçek TestFlight/Ad Hoc sürüm kanıtı. Sadece PR merge, derleme veya atlanmış Actions işi yayın değildir.

### Q00 — ZORUNLU: bütün uygulamalarda ekran ve süreçleri çok yönlü incele, düzelt, yeniden doğrula
- [ ] **Q00 / Tüm ekranların deneyim incelemesi ve iyileştirilmesi.** Başlangıç: R01 acil yayını geciktirmeden, U/P/B düzenlemelerinden önce ilk envanter ve inceleme. Son kapanış: ilgili düzeltmeler ve Q01/Q02 kanıtları tamamlanınca. Bu görev yalnız rapor yazmak veya mevcut görünümü onaylamak değildir.
  - Kaynak: `docs/EXPERIENCE-IMPLEMENTATION.md`, mevcut rota/bileşen ağacı, çalışan mobil/web/yönetim uygulamaları, son onaylı ekran referansları. Önceki inceleme planı devam eder; mevcut iş paketleri bulunabilecek sorunlara üst sınır değildir.
  - **Kapsam:** iOS/Android mobil, aile web uygulaması, bağımsız çocuk cihazı, veli cihazındaki çocuk modu ve backoffice. Giriş/kayıt/kurtarma/OAuth, aile/eşleme/PIN, ana ekranlar, takvim/program, görev/ödül/hedef, Prova hazırlama–cevaplama–inceleme, gelişim, not/puan, kütüphane, paket/ödeme, bildirim/paylaşım/yardım, ayarlar/arşiv/silme ve tüm yönetim ekranları. Modal, sihirbaz adımı, menü, alt panel, boş/yükleniyor/hata/izin durumu da ayrı inceleme birimidir. Kaynak koddan yeni/eksik rotaları bularak envantere ekle; mevcut listeyle yetinme.

  Her ekran ve bağlı akış şu bakış açılarının **tamamıyla**, kullanıcı türüne uygun biçimde değerlendirilecek:

  | Bakış açısı | Somut inceleme soruları |
  |---|---|
  | Psikoloji | Seçenek yükü, belirsizlik, hata kaygısı ve karar yorgunluğu azaltılıyor mu? Çocuk dili utandırmadan/karşılaştırmayla baskı kurmadan yönlendiriyor mu? Veli ve çocuk ne olacağını öngörüp gerektiğinde geri dönebiliyor mu? |
  | Pedagoji / çocuk gelişimi | Yaş, okuma ve motor becerilerine uygun mu? Rehberlik kademeli mi; özerklik, yetişkin yardımı ve ortak cihaz güvenliği dengeli mi? Ödül/rozet ve süre çocuğu zorlayıcı bir baskıya dönüşüyor mu? |
  | Eğitmen / ölçme-değerlendirme | Okul/sınıf/program/dönem bağlamı doğru mu? Soru, ortak kaynak, cevap, rubrik ve geri bildirim birlikte anlaşılabiliyor mu? Eksik/inceleme bekleyen veri başarısızlık diye gösteriliyor mu; öneri uygulanabilir bir sonraki adıma dönüşüyor mu? |
  | UX / bilgi mimarisi | Kullanıcı bu ekrana neden geliyor, ana işi ne ve sonraki adımı biliyor mu? Yinelenen bağlantı, gereksiz seçim, uzun form veya çıkmaz var mı? Seçmeli katalog/şablon, kolay düzeltme ve deneyimli kullanıcı kısa yolu yeterli mi? |
  | Görsel / etkileşim tasarımı | Onaylı kimliğe ve yerleşim kararlarına sadık mı? Başlık, yazı, ikon, maskot, renk, buton, boşluk ve animasyon birbiriyle tutarlı mı? Hangi eylemin öncelikli olduğu açık mı; görsel süs içeriği/okunabilirliği engelliyor mu? |
  | Yazılım mimarisi / güvenlik | Rol/aile/çocuk/cihaz sınırı, taslak ömrü, hata kurtarma, senkronizasyon, eski sürüm, eşzamanlı işlem, idempotency ve performans doğru mu? Kontrol yalnız UI'da mı; sunucu da aynı kuralı uyguluyor mu? |
  | Erişilebilirlik / cihaz kullanımı | Küçük/büyük ekran, iki yön, safe area, klavye, büyük yazı, ekran okuyucu, kalem/parmak ve azaltılmış harekette kullanılabilir mi? Taşma, örtülme, sığmama, küçük hedef ve yanlış odak var mı? |

  - **Yöntem:** her akışı gerçek uygulamada, yeni ve deneyimli kullanıcı senaryosuyla dolaş. 0/1/çok çocuk ve kayıt, farklı izinler, ilk/tekrar kullanım, ağ/hata durumlarını uygula. Sadece kaynak kod okumayı veya bir ana ekran görüntüsünü bütün ekranların incelenmesi sayma. Erişilemeyen ekranı `GÖRÜLEMEDİ` ve nedeni ile kaydet; uzman bakışını gerçek psikolog/pedagog veya çocuk kullanıcı araştırması yapılmış gibi sunma.
  - **Teslim:** `docs/release/experience-review/SCREEN-REVIEW-MATRIX.md` içinde ekran/alt akış, platform/rol/ekran boyu, senaryo, her bakış açısına ait bulgu (veya gerekçeli sorun görülmedi/uygulanmaz), öncelik, ilgili iş kimliği, önerilen değişiklik, önce/sonra kanıtı, test ve kalan sınır. Bir sorunu birden fazla rolde tekrarlamak yerine gerekçelerini ilişkilendir.
  - **Düzeltme:** bulguları U/P/B/S/L işlerine bağla; kapsam dışı kalan gerçek kusura yeni ID ekle. Onaylı ortak dili koruyarak gereken işleyiş, metin, kontrol ve yerleşim düzeltmelerini uygula. İşlev veya temel ürün kuralı değişecekse etkisini ayrı kaydet; sessizce özellik kaldırma. Sonra aynı senaryoyu yeniden dene ve onaylı referansla karşılaştır.
  - **Kabul:** bütün mevcut rotalar ve alt akışlar matriste yer alır; görülmeyen/test edilmeyen alan açıkça ayrılır. Engelleyici/yüksek öncelikli kullanılabilirlik, erişilebilirlik ve yetki kusurları kapanır; diğer her bulgu ya düzeltilir ya gerekçeli, açık takip işidir. Q00 yalnız raporla kapanmaz; açık zorunlu bulgu varken R02 ve WORLD-01 başlamaz. Telefon/tablet/web/yönetim önce–sonra kanıtı gerekir; “tüm ekranlar incelendi” ancak kapsam matrisi bunu destekliyorsa yazılır.

### L — dönem ve içerik yaşam döngüsü
- [x] **L01 / Seçerek dönem aktarımı.** Bağımlılık: R01, mevcut eğitim dönemi ve rutin geçmişi. Kod ve yerel kanıt 6 Kasım gece dalında: [period-transfer-2026-11-06](release/period-transfer-2026-11-06/README.md) (yayımlanmadı; kalan sınır orada).
  - Kaynak: `apps/mobile/src/components/education/education-period.tsx`, `apps/mobile/src/components/tasks/routine-editor.tsx`, `apps/mobile/src/components/planner/learning-plan.tsx`; `20261105040000_child_education_periods.sql` ve ilgili sonraki migration'lar.
  - Yap: yeni yıl/okul geçişinde eski rutin ve tamamlanmamış ödevleri listele; her birini seçip bırakabilme, tarih/gün/süre düzeltme ve önce/sonra özeti ekle. Eski gerçekleşme/cevap/ödül taşınmasın. Kopya ile devam eden aynı rutinin farkını görünür kıl; kaynak/dönem bağı tut. Seçilmemiş aktif eski kayıtların ne olacağı açıkça gösterilsin, sessizce çalışmaya devam etmesin veya silinmesin.
  - Kabul: boş seçim, kısmi/tüm seçim, eski dönem, arşivli çocuk, iki veli yarışı ve aynı isteği tekrar deneme; geçmiş raporlar değişmez, yeni işler tek kez oluşur. Takvim dışı gerekçeli geçiş kuralı korunur.
- [ ] **L02 / Toplu arşiv ve geri alma.** Bağımlılık: L01; tek kayıt arşivlerinin mevcut kuralları.
  - Kaynak: görev/ödül/not/Prova/öğrenme planı listeleri; mevcut arşiv RPC'leri ve `docs/CHILD-AND-CONTENT-LIFECYCLE.md`.
  - Yap: tür/çocuk/dönem/durum filtresiyle çoklu seçim, etki önizlemesi, engellenen kayıt nedenleri ve sonuç özeti. Çanta listesinde yalnız işaretleri sıfırlama ile seçili günün listesini temizlemeyi ayır; takvimde tarih aralığı ve tek gün/seri kapsamını göster. Bekleyen ödül, aktif hedef, atanmış sınav ve cevap bağları için mevcut korumaları genişlet. Toplu işlem semantiğini (tümü veya kayıt bazında sonuç) açık seç ve sunucuda uygula.
  - Kabul: görünmeyen/başka aile kaydı eklenemez; yarım hata ve tekrar çift işlem yapmaz; geri alma notu özel, rutini/ödülü mevcut güvenli durumuyla döndürür. Raporlar ve geçmiş korunur.
- [ ] **L03 / Kalıcı silmenin etki önizlemesi.** Bağımlılık: L02, mevcut hesap/çocuk silme fonksiyonları.
  - Kaynak: aile/hesap ekranları, `supabase/functions/delete-account/`, `20261031120000_account_lifecycle.sql`, `20261031130000_child_deletion.sql`.
  - Yap: silinecek çocuk/ad/kayıt türleri, paylaşımlar, dosyalar, korunması gereken geçmiş ve mağaza aboneliği etkisini göster; arşivi ayrı geri döndürülebilir seçenek olarak sun. Yeniden doğrulama, bekleme/başarısızlık ve güvenli tekrar açıklansın. Her içerik türüne sınırsız silme düğmesi ekleme; korunması gereken kaydı reddet.
  - Kabul: yanlış aile/çocuk, eski önizleme, işlem ortasında hata, hesap silme sonrası özel dosya/bağlantı erişimi. Üretimde gerçek aile üzerinde deneme yapma; abonelik iptalini veri silmeyle yapılmış gösterme.
  - Durum 06.11 gece: sunucu/core/Edge kısmı main'e aday — `deletion_preview`, `confirm_child_deletion`, `check_deletion_preview`, delete-account `preview_token`, `packages/core/src/deletion-preview.ts`, i18n `deletionPreview.*`; pgTAP 090 + yarış betiği geçti. **UI bağlanmadı, yayımlanmadı.** [Rapor](release/deletion-preview-2026-11-06/README.md).
- [ ] **L04 / Tarihli plan geçmişi.** Bağımlılık: L01–L02.
  - Kaynak: görev rutini geçmişi, ders programı kayıt/temizleme, eğitim dönemi program snapshot'ları ve dönem raporları.
  - Yap: ad/gün/saat/başlangıç-bitiş değişikliklerinin hangi tarihten itibaren geçerli olduğunu tut; geçmiş gün görünümü o günün planını kullansın. Kaynakta bulunmayan eski sürümleri “bilinmiyor/geçişte bilinen” ayır; geriye dönük uydurma yapma.
  - Kabul: geçmiş gün, bugün, gelecek tarih, dönem sınırı ve saat dilimi; gönderilmiş görev, kazanılan yıldız ve eski Prova/puan aynı kalır.

### U — veli, aile ve çocuk deneyimi
- [ ] **U01 / Giriş ve kurtarma akışları.** Bağımlılık: S01 gerçek e-posta kabulü; UI işi önceden yapılabilir.
  - Kaynak: `apps/mobile/src/app/(auth)/`, `auth-callback`, `reset-password`, giriş başlangıcı; `apps/backoffice/src/pages/sign-in.tsx`.
  - Yap: giriş/kayıt niyeti, sosyal giriş devre dışı nedeni, çocuk cihazı alternatifi; iptal/expired/network/oturum bitmesi için doğru eylem. Aile kur/katıl başta ayrı niyet; hesap silme kurulumun ana eylemi olmasın. Süresi dolan bağlantıdan yeniden isteme, yönetici kurtarmadan panele dönüş.
  - Kabul: Apple/Google/parola giriş ve iptal, eski/tekrar kullanılan bağlantı, iki farklı tarayıcı/cihaz dönüşü; çocuk kilidi URL/geri tuşu/OAuth dönüşüyle aşılmaz.
- [ ] **U02 / Eşler, aileler, cihaz ve PIN.** Bağımlılık: U01.
  - Kaynak: `/parent/families`, `/parent/device-access`, `/device/pair`, `/child/pin`, `/parent/child-mode`; `components/ui/pin-entry.tsx`, `pin-setup.tsx`; `20261102010000_device_access_and_family_switch.sql`.
  - Yap: aile katılma/değiştirme ve cihaz eşlemeyi ayır; iki eşin ayrı aile kurduğu durumda mevcut içerik/sayı/etkiyi göster. Mevcut aile seçimini “birleştirme” diye adlandırma; veri birleştirme istenirse çocuk/üyelik/ödeme/kanıt çakışması için ayrı öneri ve karar kaydı hazırla, otomatik birleştirme yapma. Tek/ortak cihaz, izinli çocuklar, PIN gerekli/isteğe bağlı özeti; bütün PIN ekranlarında aynı kontrol ve kurtarma yolu.
  - Kabul: tek/çok çocuk, iki aile, tek ve ortak tablet; süresi dolan kod, yanlış PIN, erişim iptali açık oturumda; kaydedilmemiş izin taslağı korunur. Mevcut cihaz erişimi iyileştirmelerini tekrar yazma.
- [ ] **U03 / Veli Bugün, takvim ve menü.** Bağımlılık: U02, L01.
  - Kaynak: `components/parent-home/home-view.tsx`, `family-week-review.tsx`, `components/planner/calendar-screen.tsx`; `/parent/menu`, `/parent/notifications` ve mevcut gelen kutusu.
  - Yap: bekleyen onay + sıradaki işi öne çıkar; selamlama/maskotu ölçülü tut; aynı Görev/Ödül/Prova bağlantılarını tekrar tekrar koyma. Ders/ödev/etkinlik/görev anlamları gün altında net; bugün sayılarıyla seçili gün karışmasın. Zil mevcut gelen kutusuna, tercihler ayarlara; menü hesap/aile/cihaz/öğrenme/yardım grupları.
  - Kabul: 0/1/çok çocuk, 0/çok iş, geri gönderilmiş görev, dolu takvim, tek sorgu hatası; doğru çocuk/gün/kayda açılış. Boş durumda tek anlamlı eylem ve bağlama uygun görsel; bütün ekran sırf bir kart hatasıyla kapanmaz.
- [ ] **U04 / Çocuk, görev, ödül ve hedef sihirbazları.** Bağımlılık: mevcut setup + ödül/rutin geçmişi.
  - Kaynak: `components/setup/child-setup.tsx`, `templates.ts`, `goal-setup.tsx`, `ai-suggestions.tsx`, `suggestion-batch.tsx`, `components/rewards/` ve görev oluşturma akışı.
  - Yap: rahat yaş/sınıf/okul, kademeli avatar; isteğe bağlı kimlikten bağımsız öğrenme kapsamı. Şablon/rutin günleri son kontrolde; okul günü/hafta sonu/tek sefer ve sık kullanım kısa yolu. Ödül bedeli hazır değer/adım + elle; mevcut hedef/birikim/kalan ve talep/teslim geçmişi açık. Yanlış ret/iptal öncesi sonucu açıkla; geçmiş hedefleri erişilebilir tut, hedefi bırakma/değiştirmenin birikimi silmediğini göster.
  - Kabul: yeni kullanıcı rehberliği ve deneyimli kısa yol, yaş/sınıf uyuşmazlığı, çoklu AI önerisi seçimi, eski ödül talepleri. Hedef seçmek yıldız harcamaz; cinsiyet ders veya başarı beklentisini belirlemez.
- [ ] **U05 / Program, etkinlik, ödev ve çanta.** Bağımlılık: L01/L04; mevcut tablo/zil editörü.
  - Kaynak: `components/planner/{timetable-editor,timetable-board,timetable-import,event-editor,learning-plan,learning-plan-import,school-bag}.tsx`.
  - Yap: boş hücreye taşıma ve gerekiyorsa sürüklerken kaydırma; erişilebilir dokunarak taşıma alternatifi; gün kopyalama önce/sonra ve geri al. Ders adı katalog kimliğiyle bağlı, özgün kaynak adı korunur. Belirsizlik hücre üstünde; eksik saat veli zil düzeniyle, AI uydurmasıyla değil. Etkinlik başlık önerileri/tekrar kapsamı; ödevleri günlere toplu dağıtım; çanta için yarınki derslerden düzenlenebilir öneri.
  - Kabul: 40 ders/çok çocuk, saat/öğle arası kayması, çakışma/gün sonu, dolu/boş hücre, program kaydı ile taslağa uygulamanın ayrılığı. Dosyayı kaldırmak dersleri silmez; okuldan gelmeyen çanta önerisi zorunlu talep diye görünmez.
- [ ] **U06 / Çocuk ana akışları ve güvenli devir.** Bağımlılık: U02–U05. Prova bağlantısının son kabulü P01 ile birlikte.
  - Kaynak: `/child/*`, `/parent/child-mode/*`, `components/room/{child-home,child-mode-home}.tsx`, `components/child-home/approved-scene.tsx`, `components/tasks/task-focus.tsx`.
  - Yap: görev/ödev/Prova'yı birlikte ele alan sıradaki adım; geri gönderme nedeni ve yeniden deneme; bugün/yarın çanta; hedef seçimi ve kişisel rozet ilerlemesi. Mevcut odak sayacının ara verme/çıkış davranışını dene, yeni sayaç kurma. Sahneyi değiştirmeyen oda seçimini değiştirmiş gibi gösterme; tercih kapsamını dürüstçe açıkla. Sabit onaylı oda görseli korunur.
  - Kabul: dikey/yatay telefon/tablet; izinli profil yok/tek/çok, görev bitmiş ama Prova bekliyor, sıfır ve dolu koleksiyon; veliye dönüş kilitli. Dönüş döngüsü, çizimde scroll ve altta kullanılmayan boşluk yok; 3B çalışması başlamaz.
- [ ] **U07 / Paylaşım, yardım ve haftalık özet.** Bağımlılık: U03 ve mevcut paylaşım/destek servisleri. Plan dönüşümünün son kabulü P04; destek yanıtının son kabulü B04 ile.
  - Kaynak: `/parent/share`, `/s/[token]`, `/parent/help`, `/parent/weekly-review`, `/parent/room-credits`.
  - Yap: alıcı görünümü/veri/süre önizlemesi ve eski paylaşım araması; iptal edilmiş bağlantıyla geçici ağı ayır. Yardımda ilgili SSS/arama, isteğe bağlı kişisel verisi gizlenmiş görsel, taslak koruma ve yanıt takibi. Özetin dönem/kapsamı ve seçilip düzenlenerek plana dönüşmesi; gerçek eser adıyla kaynak linkleri.
  - Kabul: öğretmen/alıcı özel notları göremez; bağlantı iptali/ağ kesintisi, destek yazarken hata, AI önerisini seçmeme/düzeltme; AI kendiliğinden atama yapmaz.
- [ ] **U08 / Ortak kontroller ve durumlar.** Bağımlılık: U01–U07 boyunca uygulanır.
  - Kaynak: `components/ui/`, `components/setup/wizard.tsx`, `components/learning/source-files-picker.tsx`, core i18n, yönetim ortak Layout/formları.
  - Yap: izin reddi, çevrimdışı, yetkisiz, oturum süresi ve geçici servis hatasını ayır; dar input yerine çok satırlı örnekli AI açıklaması; sayı/süre hazır seçim+elle; gereksiz alt alta düğmeleri birincil/ikincil eyleme ayır. Dosya/galeri/tekrar çekimle birikimli seçim, sıra/kaldır/önizleme; yönetilen varsayılan 5 sınırının istemci ve sunucuda tutarlılığı.
  - Kabul: dokunma/klavye/büyük yazı, çoklu PDF+görsel, reddedilen kamera/galeri izni, limit aşımı; bir çoklu analiz tek işlem hakkı, soru üretim kotası ayrı; tekrar ikinci ücretli üretim yapmaz. Yeni paket ancak gerçekten zorunluysa.
- [ ] **U09 / Not, okul puanı, paket ve arama son kabulü.** Bağımlılık: R01. Gerçek mağaza haklarının son kabulü S03 ile.
  - Kaynak: `/parent/notes`, `/parent/grades`, `/parent/subscription`; `components/notes/`, `education/school-grade-editor.tsx`, `setup/beta-plans.tsx`.
  - Yap: tamamlanan not/puan/ödül geçmişini koru; okul puanında metin araması; uzun listede doğru filtre/sayfalama; gerçek AI/belge/kütüphane kullanım hakları ve yenilenme zamanı. Deneme hakkı/operatör telafisi/mağaza aboneliğini açık ayır.
  - Kabul: geçmiş dönem ve 200+ kayıt, iki veli/kişisel not, arşivdeki kota; test paketini değiştirmek gerçek satın alma değildir. Çocuk için yeni not ekranı mevcut pakette yok; gerektiğinde ayrı kapsam kaydı olmadan varmış gibi anlatma.

### M01 — güncel MEB senaryosunu edin, doğrula ve özgün sorulara bağla
- [ ] **M01 / OYSS kaynak ve soru uygunluğu.** Bağımlılık: mevcut katalog/blueprint/AI bağı; güncel kamuya açık resmî kaynak. P02 ve K01'in senaryo kabulü M01'e bağlıdır; mevcut akış yeniden kurulmaz.
  - Kaynak: [MEB uygulama sözleşmesi](learning/MEB-SCENARIO-PROTOCOL.md); `scripts/extract-meb-scenarios.py`, `packages/core/src/{curriculum-review,catalog-blueprint}.ts`, yönetim `components/curriculum-review.tsx`, mobil `parent/prova/{catalog,blueprint}.tsx`, `supabase/functions/_shared/{catalogue-plan,generation-result}.ts`; 078000/079000 katalog migration'ları.
  - Yap: hedef yıl/dönem/yazılı/sınıf/ders/program için güncel resmî dizinden uygun dosyayı gerçekten indir; URL zinciri, tarih, hash ve kaynak hücrelerini tut. Aynı hash tekrar iş/kota doğurmasın; değişen kaynak yeni revizyon ve insan incelemesi açsın. Eski atanmış sınav sabit kalsın. Kaynak güvenliği, eksik/ağ/stale durumları ve güncel merkezî/yerel yetki kuralları protokoldeki gibi uygulanır.
  - Yap: okulun seçtiği senaryo ile velinin çalışma tercihini ayır. Mevcut toplam/blok denetimini koruyup soru başına blok/çıktı/rubrik ve anlamsal uygunluk kanıtını tamamla. AI'ya yalnız URL değil gerçek normalize kaynak metni ver. Özgün soru üret; öğretmen EBA havuzu/gizli sınav sorularını kopyalama. Sırf senaryolu diye her soruya hikâye/görsel dayatma.
  - Kabul: protokoldeki kaynak/revizyon/SSRF/tekrar/dağılım/rol ve telefon–tablet testleri; soru→çıktı→blok→kaynak sürümü izi. Eksik veya değiştirilmiş dağılım “tam senaryo uyumlu” sayılmaz. 20 soruluk havuzdan gerçek senaryo adediyle doğru seçme; okul tercihi bilinmiyor ve kapsam dışı sınıf açık. 648 adayın teknik importu editoryal yayın onayı değildir.

### P — birleşik Prova, çözüm ve değerlendirme
- [ ] **P01 / Tek Prova merkezi ve hazırlayıcı.** Bağımlılık: U04/U05 ve mevcut eğitim kapsamı.
  - Kaynak: `/parent/prova`, `components/learning/prova-builder*.tsx`, `prova-builder-data.ts`, `prova-source-picker.tsx`; `/parent/prova/{builder,shared-source,exam,generate}`.
  - Yap: Hazırla/Gönderilenler/İncelenecekler ayrımı; tek taslak ve tek soru sırası içinde elle, AI, kütüphane ve ortak kaynak blokları. Ders listesini boş soru bankasına bağımlı bırakma. Çocuk/sınıf/okul/program/dönem değişince uygunsuz soruyu işaretle; kaynak grubunu bölmeden taşı. Eski giriş yolları doğru taslağa yönlensin.
  - Kabul: boş bankada ders seçilir; tek ders/karma, kısmen veya tamamen AI, aynı metin/görselden birden çok soru; taslak tekrar kaydı çoğalmaz, atanmış sınavın sabit sürümü değişmez.
- [ ] **P02 / Soru editörü, senaryo ve kitapçık.** Bağımlılık: P01 ve mevcut kapsam kataloğu. Güncel senaryo ve soru ilişkisi M01; doğrulanmış katalog içeriğinin son kabulü S04 ile.
  - Kaynak: `/parent/prova/{question,catalog,blueprint,level,booklet}`, öğrenme bileşenleri ve `docs/learning/catalog/`.
  - Yap: soru/görsel → yanıt/ölçüt → öğrenci önizleme; doğru şık başlangıçta boş kalır. MEB Ortak Yazılı, LGS/diğer ve serbest çalışma ayrımı; yıl/sınıf/dönem/yazılı ve okulun seçtiği senaryo. M01 protokolüyle güncel resmî dosyayı edinip okul seçimi/çalışma tercihini açık göster; mevcut kaynak bağını koru. Kazanım/sayı dağılımı şablonunu soru üretiminden ayır. Başlangıç çalışmasını standart tanı gibi etiketleme. Öğrenci kitapçığı ve cevap anahtarı ayrı.
  - Kabul: ortak kaynak/çizim/görsel, alternatif açık uçlu doğru cevaplar, okunur telefon/tablet ve çıktıda doğru sayfalama. Kaynak yoksa resmî müfredata uygunluk iddia edilmez; telifli sorular kopyalanmaz.
- [ ] **P03 / Çözüm defteri ve soru türleri.** Bağımlılık: P01/P02. Fiziksel kabul kanıtı Q01 matrisine işlenir.
  - Kaynak: `components/learning/notebook-*.tsx`, `notebook-layout.ts`, child/child-mode Prova çözücüleri, `docs/design/screens/prova-notebook/`.
  - Yap: onaylı düzeni koruyarak soruyu/ortak görseli okunur tut; açık uçluya çizim-yazı-sembol, şıklıya uygun kısa kontrol. Araç rehberliği ilk kullanımda; kalem ve parmak, görüntüden parça/etiket alırken anlaşılır durum. Süreli/tahmini süre ve teslim kontrolü.
  - Kabul: dikey tablette defter görünür, çizimde üst ekran scroll olmaz; yazı/sembol/üç nokta yön döngüsü oluşturmaz. Soru/defter dönüşü, klavye, süreç kapanışı, offline/retry ve iki cihaz; doğru sorunun taslağı kurtarılır, başka soruya taşınmaz.
- [ ] **P04 / Veli inceleme, gelişim, tekrar ve plan.** Bağımlılık: P03, L04.
  - Kaynak: `/parent/prova/{attempt,review,repeat,plan,progress}`, `components/prova-question-review.tsx`, `components/learning/review-notes.tsx`, `supabase/functions/{prova-review,prova-grade,prova-plan,ai-weekly-summary}/`.
  - Yap: soru/kaynak/cevap/ölçüt birlikte; tek inceleme girişi; ayrı veli not katmanı. AI açıklaması kanıta/ölçüte dayansın, öneriyi veli onaylasın; yetersiz görselde kesin puan uydurmasın. Gelişim konu filtresi ve kanıt sorusu; az veride ölçülü yorum. Tekrar sorular→gün/süre→önizleme; plan mevcut takvim yükünü göstersin.
  - Kabul: şıklı/açık/karma, cevap yok/okunamıyor/inceleme bekliyor ayrımı; eksik puan “ara sonuç”, sıfır değil. Eski puan/taslak korunur; onaysız AI takvime kayıt yapmaz; ortak kaynak grubu ve tekrar güvenliği korunur.
- [ ] **P05 / Kütüphane edinme, katkı ve Birlikte Prova.** Bağımlılık: P01/P02 ve mevcut edinme/katkı/grup servisleri. B02/B03 tamamlanınca aile–yönetim uçtan uca son kabulü yapılır; geniş soru üretimi K01'de.
  - Kaynak: `/parent/prova/{library,share,groups}`, yönetim kütüphane/grup/inceleme akışları.
  - Yap: uygun içerik/ailedeki içerik/katkı ayrımı; hak ne zaman tüketilir açıklığı; kaydetme sonrası ayrı katkı paylaşımı, gizlilik ve kazanılacak hak özeti. Ret→düzeltme yolu; ortak sınavın uygunluk/katılım/sonuç adımları; sıralama ikincil/isteğe bağlı.
  - Kabul: tekrar edinim ve katkı onayı çift hak üretmez; kaynaklı soru grubu dağılmaz; katılım penceresi/çocuğun süresi/inceleme bekleme ayrılır. Taslak onayı yayın değildir; kısmi katkı kabulü mevcut iş kuralında yoksa önce açık etki önerisi çıkar.
  - Sunucu tarafı yapıldı (6 Kasım gece dalı, yayımlanmadı): `20261106110000_library_credit_safety.sql` — `family_library_credits`, `library_policy_preview`, `admin_library_group_integrity`, katkı düzeltme zinciri (`begin_question_contribution(...,p_supersedes)`, `contribution_review_trail`), `group_exam_phases` ve sıralama sınırı; pgTAP 098 + `scripts/test-library-credit-races.py`. Rapor: [library-lifecycle-2026-11-06](release/library-lifecycle-2026-11-06/README.md). Kısmi katkı kabulü uygulanmadı; etki önerisi raporda. Mobil `parent/prova/{library,share,groups}` bağlanması kaldı.

### B — yönetim çalışma alanları
- [ ] **B01 / Ana iş kuyruğu, aile, ödeme ve haklar.** Bağımlılık: mevcut ödeme/hak servisleri; Access ve rol modeli korunur. U09/S03 ile gerçek ödeme ve aile ekranı son kabulü.
  - Kaynak: `apps/backoffice/src/pages/{index,dashboard,families,billing,overrides}.tsx` ve ilgili lib komutları.
  - Yap: role göre bekleyen destek/inceleme/hata/yayın işleri; aile adı/paket/son durum, arama/gerçek sayfalama. Sabit aile bağlamında mağaza/geçici hak zaman çizgisi; süre hazır seçimi ve önce/sonra etki.
  - Kabul: ilk 100 sonrasına ulaşılır; yanlış ailede işlem önizlemede görünür; iade/iptal/telafi aynı şey diye sunulmaz. Rol iptali/süre bitimi açık sekmede ve sunucu yazmasında engellenir.
- [ ] **B02 / İçerik yaşam döngüsü ve yayın.** Bağımlılık: P02, mevcut katkı/edinme veri sözleşmesi. P05 ile ortak kabul B02 sonrasında tamamlanır.
  - Kaynak: yönetim `pages/{questions,library,library-publication}.tsx`, `components/{library-drafts,library-publication,contribution-sets,LibraryPolicy}.tsx`.
  - Yap: JSON şık alanı yerine ortak editör; eski soru/koleksiyon/taslak ilişkisini kaybetmeden tek içerik akışı. Kaynak/soru/rubrik incelemede erişilebilir; alan bazlı hata ve dosya örneği. Kapsam/paket/hak ve gerçek aile önizlemesi; kabul sayısından hak hesabı, çakışan kural etkisi.
  - Kabul: eski atanmış/yayımlanmış sürüm değişmez; taslak kayıt canlıyı değiştirmez; onay/yayın ayrı; aynı kabul/yayın çift hak vermez. Ret ve düzeltilmiş sürümün yeniden incelemesi izlenebilir.
  - Sunucu tarafı yapıldı (6 Kasım gece dalı, yayımlanmadı): `gina.library_content_items` görünümü + `admin_library_content_items`, yayın/eski öğe/kohort sorusu/edinim değişmezlik tetikleyicileri, `admin_library_package_trail`; pgTAP 098 kanıtı. Rapor: [library-lifecycle-2026-11-06](release/library-lifecycle-2026-11-06/README.md). Backoffice `pages/{questions,library,library-publication}` ortak editör ve ekran bağlantısı kaldı.
- [ ] **E01 / AI ön inceleme ve yönetici kuyruğu (sunucu + core).** Karar: `docs/DECISIONS.md` «Gece devri başlangıç kararları (5 Kasım 2026)». Bağımlılık: mevcut kütüphane taslak / katkı / senaryo adayı tabloları, `_shared` AI katmanı ve kill switch, push outbox. B02 yönetim ekranı bu kuyruğu bağlar; K01 toplu üretimi bu ön incelemeden geçer.
  - Kaynak: `20261106050000_content_prereview.sql`, `supabase/functions/content-prereview/`, `supabase/functions/_shared/prereview.ts`, `packages/core/src/content-prereview.ts`, `supabase/tests/091_content_prereview.test.sql`; rapor [content-prereview-2026-11-06](release/content-prereview-2026-11-06/README.md).
  - Yapıldı (dal, yayımlanmadı): `gina.content_prereviews` (`prereview_status pending|ai_approved|needs_admin|ai_rejected_suggestion`, `prereview_verdict`, `prereview_at`, içerik hash'i, prompt sürümü, deneme sayısı) — yönetici karar sütunlarından ayrı; `ai_approved` yayın değildir. `enqueue_content_prereview(p_scope)` ve `request_content_prereview` (yalnız yönetici, idempotent), `content_prereview_claim/finish/next` (service_role, kira). Edge `content-prereview`: normalize içerik (soru, çözüm, rubrik, kaynak metni, senaryo blokları; URL değil), şema doğrulama, eşik güven ≥ 0,85 + engelleyici bulgu yok; aynı içerik+prompt sürümü tekrar AI çağrısı yapmaz; kill switch/model pasif/429/5xx/zaman aşımı/bozuk çıktı → 3 denemeden sonra `needs_admin` ve neden kaydı. `needs_admin`/`ai_rejected_suggestion` mevcut outbox'a `content_prereview_needs_admin` bildirimi düşürür (içerik başına tek).
  - Kalan: backoffice'te kuyruk/verdict görünümü ve «AI çalıştır» düğmesi (B02 ile; mobil etkilenmez); `content_prereview.enabled` kapısını ve `CONTENT_PREREVIEW_SECRET` sırrını üretimde açma; pg_cron ile `drain` zamanlaması; gerçek sağlayıcı ile sentetik pilot (bu dalda yalnız deterministik sahte sağlayıcı denendi); aile üyesi olmayan yöneticiye push ulaşmaz (kuyruk kaydı `admin_content_prereviews` ile görünür). Bağımsız eğitimci incelemesi (X06) ayrı kademedir; AI onayı onun yerine geçmez.
  - Kabul: pgTAP 091 (yetki, idempotent kuyruk, kira/tekrar, hash ve prompt sürümü değişimi, yönetici kararı ile AI kararının ayrılığı, `ai_approved` sonrası yayının hâlâ editoryal inceleme istemesi, bildirim tekilliği, deneme sınırı); Deno `content-prereview/handler.test.ts` + `_shared/prereview.test.ts`; `pnpm --filter @gina/core test`.
- [ ] **B03 / Toplu Prova ve ortak inceleme.** Bağımlılık: B02 ve mevcut grup servisleri. P05 ile karşılıklı son kabul; P05 kutusunun önceden kapanması gerekmez.
  - Kaynak: yönetim `pages/{groups,cohort-review}.tsx`, `components/cohort-notebook.tsx` ve `lib/group-command.ts`.
  - Yap: kapsam→soru/süre→aile/çocuk önizleme; inceleme iş yükü; sonraki incelenmemiş/itirazlı kayıt kuyruğu ve arama. Sıralama tercihi, sonuç yayımlama ve yeniden değerlendirme etkisi açıklansın.
  - Kabul: çok katılımda kayıt bulunur; okunamayan defter boş/sıfır sayılmaz; puanlanmamış sonuç kesin sıralamaya girmez; çocuk/aile/inceleme rolü sınırları korunur.
  - Sunucu alt kısmı yapıldı (6 Kasım gece dalı, yayımlanmadı): `group_exam_phases`, `gina.cohort_ranking_rows`; `get_group_result` → `ranked / ranking_reason / ranking_optional / interim`; bitmemiş, puanlanmamış, okunamayan veya yayımlanmamış kayıt kesin tabloya girmez (pgTAP 098). Yönetim `pages/{groups,cohort-review}` kuyruk/arama ve açıklama ekranları kaldı.
- [ ] **B04 / Destek, fikirler, yardım ve gönderim operasyonları.** Bağımlılık: mevcut destek/yardım/bildirim servisleri. U07 ile aile yanıtı kabulü; yeni kanalların son kabulü S02 ile.
  - Kaynak: yönetim `pages/{support,ideas,help-articles,notifications}.tsx`, `components/support/`, `components/help-articles.tsx`.
  - Yap: sorumlu/bekleme/arama/hazır yanıt ve ilgili yardım yazısı; fikir durumları ve benzer fikir bağı. Yardım yazısında kısa cevap/adımlar/linkler, dil ve cihaz önizleme. Bildirimde olay/çözüm öne; teknik makbuz ikinci düzey.
  - Kabul: ekip notu aileye gitmez; taslak yanlış görüşmeye taşınmaz; özel destek kamu fikrine dönüşmez; taslak yardım canlı cevabı değiştirmez; yeniden deneme başarılı cihazı tekrar göndermez, sağlayıcı kabulü “okundu” değildir.

### S — sağlayıcılar, içerik katalogları ve işletim
- [ ] **S01 / Alan adı, e-posta ve gerçek giriş kabulü.** Bağımlılık: hesap sahibi X01.
  - Kaynak: `docs/release/RELEASE-COMPLETION-2026-11-04.md`, Supabase Auth yapılandırması, U01 ve korumalı yönetim.
  - Yap: mevcut hesapları tekrar kurmadan alan adı/gönderici/SMTP doğrulaması; gerekli kesin dönüş adresleri; gönderim/kota/hata bilgisi. Yeni domain varsa Access kapsamı ve önizlemeler yeniden kontrol edilir.
  - Kabul: doğrulama/sıfırlama e-postası gerçekten ulaşır; mobil/web dönüş, eski/tekrar link, spam/teslim hatası; “gönderildi” ekranı tek başına kanıt değil. Şifre/API anahtarlarını dokümana yazma.
- [ ] **S02 / Push, e-posta ve SMS duyuru kanalları.** Bağımlılık: S01, X02 kanal hesapları, mevcut U03/B04 gönderim sözleşmeleri. Kanal uçtan uca kabulü bu ekranlarla birlikte.
  - Kaynak: `docs/PUSH.md`, `docs/learning/PUSH-DELIVERY-ACCEPTANCE.md`, `docs/ACADEMIC-CALENDAR-AND-ANNOUNCEMENTS.md`, `supabase/functions/push-send/`, yönetim duyuruları.
  - Yap: mevcut in-app/push altyapısını koru; APNs/FCM eksik ayarlarını doğrula. E-posta/SMS için doğrulanmış adres/numara, amaç/kanal tercihleri ve vazgeçme, sağlayıcı adapteri, gönderim makbuzu/limit/tekrar yönetimi ekle. İletişim adresi varlığını izin sayma; hizmet ile pazarlamayı ayrı değerlendir.
  - Kabul: iki cihaz, tercih kapalı/oturum kapalı/eski token, kısmi sağlayıcı hatası, kanal başarısı/başarısızlığı; uygulama kapalıyken fiziksel teslim ve doğru ekrana açılış. Gerçek velilere toplu test gönderme; hesap/izin yokken hazır veya gönderildi yazma.
- [ ] **S03 / Mağaza satın alma, iade ve paket doğrulaması.** Bağımlılık: X02/X03; S05 hukuk URL'leri.
  - Kaynak: `docs/IAP.md`, `supabase/functions/{iap-verify,iap-reconcile,iap-operator-reconcile,apple-notifications,google-rtdn}/`, paket ekranı ve B01.
  - Yap: gerçek ürün/fiyat/paket eşlemesi, Apple sandbox/Google lisans testi, RTDN audience/gönderici ve zamanlayıcı. Satın al→yenile→yükselt/düşür→geri yükle→iptal/iade sonrası aile erişimi. Operatör “mağazadan kontrol” iade gibi sunulmaz; mağazanın izin verdiği iade/yönlendirme yolunu doğru uygula.
  - Kabul: eski/sırasız/çift bildirim tek hak doğurur; iki aile aynı makbuzu kullanamaz; başka cihaz hakkı güncellenir; Android acknowledge ve bildirim doğrulanır. Hukuki URL yokken satışın kapalı kalması korunur. Gerçek kullanıcıdan deneme ücreti alma.
- [ ] **S04 / Eğitim ve seçenek katalogları.** Bağımlılık: gerçek resmî kaynak erişimi ve mevcut eğitim/katalog şeması. U05/P02 ile seçim ve kapsam kabulü birlikte yapılır.
  - Kaynak: yönetim `education-calendars`, `input-catalog`, `components/curriculum-review.tsx`; `docs/learning/catalog/`, `docs/ACADEMIC-CALENDAR-AND-ANNOUNCEMENTS.md`.
  - Yap: yıl/kademe/ülke/bölge/okul kapsamıyla doğrulanmış başlangıç takvimleri; kaynak ve kontrol tarihi. Ders eşanlamlılarını kanonik ders kimliğine bağla; çocuk sınıfına uygun ders/kazanım ve seçenek kapsamı. Okul istisnasını incele, ortak takvimi ancak ayrı yayınla değiştir. Büyük katalog için sunucu araması.
  - Kabul: özel okul/bölge önceliği, bilinmeyen okul, tarih dışı gerekçeli seçim, yıl sınırı hatırlatması bir kez; otomatik sınıf yükseltme yok. Tek günlük tatil duyurusu programı otomatik silmez. Geleceğe planlı eğitim değişimi, otomatik tatil yeniden planlama ve 5.000+ gönderim ayrı kapasite/ürün maddesi olarak kaydedilir; mevcut uygulanmış özellik diye sunulmaz.
- [ ] **S05 / Hukuk, mağaza içeriği ve hesap sahibi bilgileri.** Bağımlılık: X03 uzman/işletme bilgileri.
  - Kaynak: `docs/legal/`, `docs/DECISIONS.md`, `docs/IAP.md`, mağaza kaydı ve mevcut onaylı marka varlıkları.
  - Yap: yer tutucuları gerçek bilgilerle tamamla; güncel AI/belge/çocuk/paylaşım/kanal davranışını metinlerle eşleştir; uzman incelemesiyle sonuçlandır. Onaylı sayfaları yayımla ve `EXPO_PUBLIC_LEGAL_BASE_URL` bağla. Mağaza ekran görüntüleri gerçek son uygulamadan; gizlilik/yaş/veri beyanları ve inceleme hesabı mevcut davranışa uygun.
  - Kabul: bozuk/yer tutucu hukuk linki yok; satın alma öncesi okunabilir; uygulama, destek adresi ve mağaza beyanı çelişmez. Hukuki onayı AI'nın kendisi verdi diye kapatma.
- [ ] **S06 / Çok sağlayıcılı AI ve işletim politikaları.** Bağımlılık: X04 sağlayıcı hesapları; B01/B02 altyapısı.
  - Kaynak: yönetim `pages/{ai,operations}.tsx`, `supabase/functions/_shared/` AI katmanı, `docs/learning/AI-RESILIENCE-ACCEPTANCE.md`.
  - Yap: özellik→girdi türü→model yeteneği matrisi; desteklenen sağlayıcı için adapter/çıktı doğrulama ve küçük test. Paket bazlı işlem/token/medya sınırları, kullanım/yenilenme bilgisi, arıza kuyruğu ve filtre/sayfalama. Model kapatmanın etkilenen özelliklerini önizle. Sağlayıcı değiştirmede gizlilik/izin/maliyet etkisini göster.
  - Kabul: 429/5xx/timeout/bozuk çıktı/yanıt kaybı/iki aynı istek; çift ücretli üretim veya kota aşımı yok. Belirsiz ücretli işlem sessiz fallback ile ikinci kez çalışmaz. Sadece model adı ekleyerek destek varmış gibi gösterme; Anthropic yolu bozulmaz.

### Q — bütünleşik kalite, güvenlik ve işletim kabulü
- [ ] **Q01 / Tüm ekranların cihaz ve erişilebilirlik matrisi.** Bağımlılık: U/P/B tamamlanmış paketleri, X05 fiziksel cihaz.
  - Kaynak: Q00 inceleme matrisi ve ekran envanteri; `docs/design/screens/fidelity-completion/`, `notebook-keyboard-acceptance/`, `native-journal-recovery/` ve yeni ekran kanıtları.
  - Yap: telefon dar/geniş, tablet iki yön, masaüstü; 0/1/çok veri, loading/empty/error/offline, klavye, büyük yazı, ekran okuyucu, azaltılmış hareket. Her ekran/alt akış için görülen kusur→düzeltme→kanıt kaydı. iPhone/iPad/Pencil/Android gerçek testini web screenshot'ından ayrı tut.
  - Kabul: taşma, arkada kalma, kesilmiş eylem, çizimde scroll/yön döngüsü yok; metin/dokunma erişimi; onaylı referansla yan yana görüntüler. Fiziksel cihaz denenmediyse kutu kapanmaz.
- [ ] **Q02 / Uçtan uca işlev, yetki, performans.** Bağımlılık: tüm uygulama paketleri.
  - Kaynak: `scripts/test-isolated-services.py`, `isolated-*.mjs`, SQL/Edge/core testleri ve yeni özelliklerin yarış testleri.
  - Yap: ayrı aileler, iki veli, tek/ortak çocuk cihazı, farklı admin rolleriyle kayıt→senkron→rapor→arşiv/silme zinciri. Yavaş/kopuk ağ, token süresi, rol iptali, çift dokunma, aynı anda düzenleme. Uzun liste/çok dosya/çizimli Prova için açılma, dokunma tepkisi, bellek ve sorgu ölçümleri; ölçüye göre düzeltme ve tekrar ölçüm.
  - Kabul: veri/puan/kota iki kez tüketilmez, yetki aşılmaz, taslak kaybolmaz; yük altında sayfalama/yenileme kullanılabilir. Test sayısı tek başına “hiç açık yok” garantisi sayılmaz; kalan risk açık yazılır.
- [ ] **Q03 / Güvenlik ve geri dönüş tatbikatı.** Bağımlılık: uygun yedek erişimi; gerçek sırlar X04 ile yenilenir.
  - Kaynak: `scripts/security-audit.mjs`, `docs/security/`, `patches/README.md`, deployment kontrolleri ve mevcut Supabase yedekleri.
  - Yap: bağımlılık/uygulama erişim taraması, RLS/Storage/signed URL/özel geçmiş/CSP/Access denetimi; yüksek etkili bulguyu kapat. Auth/Storage dahil geri yükleme planını izole ortamda dene; yalnız public/gina dökümünü tam yedek diye sunma. Günlük/raporlarda sır ve çocuk verisi sızıntısını kontrol et.
  - Kabul: gerçek geri yükleme kanıtı, çalışır hesap/dosya ilişkisi, geri dönüş adımları; çözülmeyen bulguya gerekçe ve sorumlu. Yama kanıtı olmayan sürüm uyarısını bastırma; üretim reseti yapma.
- [ ] **Q04 / Yayın otomasyonu ve izleme.** Bağımlılık: yetkili hesap oturumları, X04 dar kapsamlı yayın yetkileri.
  - Kaynak: `.github/workflows/`, `scripts/deploy-preflight.mjs`, `scripts/check-testflight.mjs`, `scripts/prepare-tablet-install.mjs`, backoffice Access denetimi.
  - Yap: eksik GitHub yayın ayarlarını güvenli kur veya yerel yayın yolunu açık işletim kılavuzuyla koru; build/env/commit/sürüm eşlemesi ve sağlık kontrolleri. Eski `newArchEnabled` ayarını SDK58 belgesine göre temizle; Expo Doctor tekrar. Hata/kota/başarısız iş alarmları ve rollback, kişisel veri içermeyen izleme.
  - Kabul: atlanan iş başarı sayılmaz; yanlış/yerel/sunucu anahtarlı public env reddedilir; yönetim ana/önizleme domaini korumalı; web/mobil/tablet aynı kaynak ve doğru manifest/IPA; otomatik yayın çalıştığı gerçek kanıtla gösterilir.

### K01 — kütüphane içerikleri: yazılım işlerinden sonra, 3B'den önce
- [ ] **K01 / Özgün ilk soru havuzu ve yayın.** Bağımlılık: M01/P02/P05/B02/B03/S04/Q02 ve X06 bağımsız eğitimci.
  - Kaynak: `docs/learning/library-pilot/coverage.json`, mevcut beş pilot paket; `scripts/{build-library-coverage,validate-library-draft,prepare-library-import}.py`, `docs/learning/catalog/`.
  - Yap: 100 mevcut taslağı koru, 1.440 eksik taslağı sınıf/ders başına 20 hedefiyle sırala. Her pakette güncel program/yıl/kazanım, uygun soru türü, özgün görsel/metin, ortak kaynak grubu, cevap/açıklama/rubrik, öğrenci ve editör önizlemesi. Uygun resmî örnekleri araştır; MEB Ortak Yazılı ile LGS/diğer biçimleri karıştırma. Telifli soruları aynen çoğaltma. OYSS alt havuzunu M01 ile edinilmiş güncel, incelenmiş senaryo/çıktı haritasına göre özgün üret; her soruyu uygun senaryo sürümlerine bağla. 20 havuz hedefidir, sınav soru sayısı değildir; eksik çıktı/adedi açık göster, OYSS dışı kapsamı bu etiketle yayımlama.
  - Kabul: otomatik şema/çözüm/tekrar/görsel/aktarım testleri; bağımsız alan ve dil incelemesi; yönetimde gerekçeli onay, ardından ayrı yayın; aynı import/edinim/onay tek hak. Sayacı gerçek dosyalardan güncelle. 20 soruluk ünite havuzunu tüm yıllık müfredat veya tüm dersler tamamlandı diye adlandırma; seçmeli/alan dersleri kapsam farkını raporla.
  - Dış engel: editör yoksa teknik olarak hazır taslak diye teslim et; onay/yayın sayılarını artırma, iş `BEKLİYOR` kalır.

### F01 — sosyal alan ve sonraki ürün önerileri
- [ ] **F01 / Plan ve karar dosyası; sosyal ağ uygulaması değil.** Bağımlılık: önce temel ürün işleri; `docs/ACADEMIC-CALENDAR-AND-ANNOUNCEMENTS.md`.
  - Yap: ebeveyn konu odaları, takma ad/görünürlük, raporla/engelle, moderasyon/itiraz, içerik silme/saklama, yetişkin katılımı ve çocuk verisi sınırlarını uygulanabilir pilot planına dönüştür. Özel mesaj/okul grupları ayrı karar. QR eşleme, otomatik tatil planlama, geleceğe planlı eğitim geçişi, 5.000+ duyuru ve büyük katalog kapasitesini de ayrı öneriler olarak kapsam/maliyet/bağımlılıklarıyla kaydet.
  - Kabul: neyin mevcut ürüne dahil/neye ayrıca karar gerektiği açık; tasarım/uygulama/yayın onayı varmış gibi davranılmaz. Bu işin mevcut kapanışı plan teslimi ve kullanıcı kararı kaydıdır. Kullanıcı kapsamı genişletirse yeni iş kimlikleri ekle; 3B bunların da arkasına gider.

### R02 — son bütünleşik yayın ve devir
- [ ] **R02 / Tüm tamamlanan kapsamı yayımla ve raporla.** Bağımlılık: N00 çalışma kaydı, M01, R01, Q00 düzeltme ve tekrar kontrolleri, L/U/P/B/S/Q/K ve F01 planı; gereken dış onaylar. Ara yayınlar bu kapının yerine geçmez.
  - Yap: migration/Edge→web/yönetim→canlı kabul→imzalı mobil→TestFlight→kayıtlı tablet Ad Hoc→fiziksel kabul. Android hedefi için Play iç test; mağaza başvurusu yalnız ilgili işletme/hukuk/ödeme kapıları tamamlanınca. Gerçek aileleri testle değiştirme.
  - Kabul: kaynak commit, migration seviyesi, Edge ve hosting sürümü, Apple işleme/grup erişimi, tablet canlı manifest ve IPA hash, Android durumu, gerçek cihaz kanıtı. Kullanıcıya çalışan linkler, değişenler, açık sınırlamalar ve hesap sahibinin adım adım işleri verilir. “Her şey bitti” ancak bütün zorunlu işlerin kanıtı varsa söylenir.

### WORLD-01 — EN SON: gerçek 3B dünya, atmosfer ve geniş maskot davranışları
- [ ] **WORLD-01 / ERTELENDİ — başlama kapısı R02.** Başka iş/engel açıkken bu fazı öne alma. Engel beklerken 3B üretmek de sırayı ihlal eder.
  - Kaynak: son açıkça onaylı oda/logo/mint peluş; eski room-v2 ve katmanlı varlık sözleşmeleri yalnız ilgili kısmıyla. Onaylanmamış eski 3B/peluş denemeleri referansın yerini alamaz.
  - R02 kapandıktan sonra yap: hedef cihaz performans bütçesi, motor/renderer ve gerçek 3B vs katmanlı sahne kararı; özgün karakter/model/malzeme/rig; mimari, pencere, masa, kitaplık, Prova kapısı; ayrı kitap/eşya/gölge/ön plan. Aynı kamera/perspektif/ölçek ve alfa kökeni kayıtlı; yalnız teslim parçalarıyla yeniden kurulum karşılaştırması.
  - Ardından: doğal rig hareketleri, maskot/pet bekleme–göz kırpma–esneme pilotu, onay sonrası davranışlar/ses; gün doğumu/gündüz/gün batımı/gece ve saatten bağımsız yağmur/kar/rüzgâr; birlikte ışık/gölge uyumu. Gövde büyütme/küçültme hareket taklidi değil. Çocuğun ruh hâli maskot mimiklerinden çıkarılmaz.
  - Kabul: önce görsel/pilot onayı, sonra entegrasyon; düşük cihazda akıcı ve erişilebilir fallback; metin/işlemler native; özel gün temaları temel kimliği bozmaz. Statik katman/video gerçek 3B diye sunulmaz. İnteraktif eğitim dünyası ayrı ölçülebilir pilotla, ana uygulama tamamlandıktan sonra.

## 5. Kullanıcı/dış taraf bağımlılıkları

Bunlar geliştirmeyi bütünüyle durdurmaz. Teknik hazırlığı önce yap, kullanıcıdan yalnız gerçekten gerekli adımı iste. Hiçbir gizli değer sohbete istenmez.

| Kimlik | Gerekli adım | Claude'un yapacağı | Kapanış kanıtı |
|---|---|---|---|
| X01 | Alan adı sahipliği ve gönderici hizmetinde hesap/oturum | Mevcut olup olmadığını kontrol, DNS/SMTP/URL bağlantısı | Teslim edilen gerçek test e-postası ve doğru dönüş |
| X02 | Firebase/Play ve mesaj hizmeti hesap sahibi adımları; gerekirse ücret/sözleşme | Mevcut projeyi kullan; dar yetki/ürün/kanal ayarı, teknik test | Android mağaza ve fiziksel bildirim/kanal teslimi |
| X03 | İşletme bilgisi, fiyat/ürün kararı, hukuk uzmanı incelemesi; mağaza sahibine ait doğrulamalar | Metin/ürün eşlemesi ve eksik alan listesi; onaylı metinleri yayımlama | Gerçek bilgiler, uzman/onay kaydı, çalışan hukuk URL'leri |
| X04 | Gerekli sağlayıcı/yayın hesabına erişim; sohbette paylaşılmış eski şifre ve API anahtarlarını yenileme | Güvenli sunucu bağlantısı, dar kapsam, eski anahtarın devreden çıktığını sınama | Sırlar Git/istemcide yok; yeni bağlantı testli; eski erişim kapalı |
| X05 | Fiziksel iPhone/iPad/Pencil/Android erişimi ve işletim sistemi izinleri | Kısa test adımları, uzaktan mümkün kontroller ve hata düzeltmesi | Cihaz/sürüm/işlem bazlı gerçek sonuç |
| X06 | Bağımsız ders/dil editörü | İnceleme paketleri, örnek cevap/rubrik, düzeltme ve yönetim kuyruğu | Teknik testten ayrı gerekçeli içerik onayı |

Apple Developer, App Store Connect, Expo, Supabase ve Cloudflare hesapları zaten kuruldu. Yönetim Access ve GINA girişi daha önce doğrulandı. Bunları yeni hesap açılması gereken işler gibi kullanıcıya tekrar verme; yalnız süresi dolmuş oturum/eksik gerçek yetkiyi iste.

## 6. Paket kapatma ve test reçetesi

- Uygun kapsamda `pnpm --filter @gina/core test`, mobil `pnpm exec tsc --noEmit && pnpm exec expo lint`, backoffice typecheck/lint/build; ilgili Edge kontrolleri ve CI. Expo/Next API değiştirmeden paket sürümüne uygun AGENTS belgelerini oku.
- SQL değişikliğinde ayrı boş/izole DB'ye migration ve tüm ilgili pgTAP; aynı istek ve farklı istek yarışları. Var olan demo/üretim DB'sinde `db reset` çalıştırma. `scripts/test-note-history.py --run-local` gibi örnekler test şablonunun boş olduğunu doğrular; o şablon yoksa izole ortam kur, gerçek DB'yi yerine koyma.
- Gerçek yerel Auth/REST/Realtime/Storage/Edge testi için `scripts/test-isolated-services.py` kullanımını oku. Dış AI taklidi kullanılan testi gerçek sağlayıcı testi diye yazma. Geçici servis/DB/dosya ve sentetik aileleri temizle.
- Her değişen görünümde telefon 390×844, dar telefon, tablet 768×1024 ve 1280×800; yönetimde masaüstü. Görseller çalışan uygulamadan ve onaylı referansla karşılaştırmalı olmalı; oluşturulmuş maketi uygulama kanıtı sayma.
- `docs/release/<paket-tarih>/` içinde test sonuçları, ekranlar, kaynak commit, yayın durumu ve açık sınır. PR açıklamasında problem→son davranış→test→risk/bağımlılık. Kontroller tamamlanmadan merge/publish başarılı diye raporlama.
- İş kapanınca bu listedeki kutuyu, ekran envanterinin ilgili satırını ve `docs/learning/DEVELOPMENT-STATUS.md` güncel kaydını birlikte güncelle. Yeni bulguya ID ver; eski kapsamı sessizce düşürme.

## 7. Süre ve teslim sınırı

Planlama tahmini: hazır yayın ½–1 iş günü; dönem/temizlik 3–5; mevcut ilk sürümün kalan geliştirme+kabulü toplam 20–30 odaklı iş günü; SMS/e-posta/ek sağlayıcılarla 25–40; kütüphane taslak/teknik üretimi ek 10–20 gün, bağımsız editör süresi ayrıca. Bunlar ölçülmüş tamamlanma tarihi veya garanti değildir; ilk iki paket sonrası gerçek iş yüküyle yeniden hesaplanır. Mağaza/hesap/editör beklemeleri ve 3B bu tahmine dahil değildir. Bu liste arka planda kendiliğinden çalışma veya belirli tarihte teslim sözü değildir.

## 8. Claude'a verilecek başlangıç talimatı

“GINA'da güncel main'i yerel değişiklikleri koruyarak al. `docs/CLAUDE-REMAINING-WORK.md`, `docs/CLAUDE-NIGHT-RUN.md`, `docs/learning/MEB-SCENARIO-PROTOCOL.md` ve `docs/EXPERIENCE-IMPLEMENTATION.md` dosyalarını oku. Önce N00 gereği Fable ile projeyi ve kalan işleri incele; kullanılan gerçek modeli ve kaynak commit'i kaydet. Önerilerini, gerekçeli kararlarını ve bu geceki iş dağılımını çıkar. Kendin kontrol edebileceğin erişimleri kontrol et; benden gerçekten gereken soruları/işlemleri ben ayrılmadan tek başlangıç paketinde iste. Fable erişimin yoksa bunu başta belirt ve izinli alternatifi netleştir.

Gerekli cevaplardan sonra belirlediğimiz tarihli 07.00 Europe/Istanbul hedefine kadar bağımsız işleri ortamın desteklediği kadar yararlı alt ajana bölerek otonom ilerle. Önce R01 acil yayını, sonra listedeki bağımlılıklar; tamamlanmış işleri yeniden yapma. Ortak dosya/migration/merge/yayını tek koordinatör yönetsin. Engellenen işi kanıtıyla açık bırakıp bağımsız işe geç; checkpoint tut, 06.30'da toparlan ve 07.00'de gerçek ilerleme raporu ver. Yüzde 55 hakkım/07.00 yenilenme beyanımı kullanım ekranından doğrula; sırf tüketim için iş üretme, abonelik dışında izinsiz ücretli API'ye geçme.

Q00 gereği bütün uygulamalardaki her ekran ve alt akışı psikoloji, pedagoji, eğitmen, UX/görsel tasarım, mimari/güvenlik ve erişilebilirlik açısından gerçek kullanımda incele; yalnız raporlama, düzelt ve tekrar doğrula. M01 gereği OYSS için ilgili güncel resmî senaryoyu indir, okul seçimini varsayma, özgün soruları çıktı/blok/kaynak sürümüne bağla; K01 OYSS havuzunu da bu temelden üret. Onaylı tasarım/marka/maskotu koru. Her işte kod, test ve yayını ayrı raporla. Kütüphane toplu üretimi yazılım işlerinden sonra; bütün işler ve R02 tamamlanmadan 3B dünya/atmosfer üretimine başlama.”
