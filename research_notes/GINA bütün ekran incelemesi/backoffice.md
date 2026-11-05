# GINA yönetim paneli — kapsamlı deneyim incelemesi

## Yönetim paneli aynı ürünün olgun, anlaşılır ve güvenli işletim alanı mı?

### Takeaway
Hayır; bazı yeni inceleme/yayın ve destek akışlarında iyi korumalar var, fakat panel aynı anda eski veri tablosu editörleri ile yeni kontrollü çalışma alanlarını taşıyor. Sorun yalnız renk veya font değil: hangi işin nereden yapılacağı, değiştirdiğinin kimi etkileyeceği ve sonraki adım tutarsız.

Bu değerlendirme psikolojik güven, bilişsel yük, öğrenme/ölçme adaleti, mimari güvenilirlik ve görsel kullanılabilirlik açısından yapılan ürün incelemesidir; kullanıcı araştırması veya uzman klinik/pedagojik sertifikasyon iddiası değildir. Uygulama kodu ve üretim verisi değiştirilmedi.

### Cited Findings
- Ortak kabukta genel yönetim, AI, kütüphane, aileler ve rol bazlı destek/finans/yayın bağlantıları tek düzeyde sıralanıyor. İş kümesi gruplaması yok. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/Layout.tsx:11)
- Eski soru editörü şıkları JSON olarak düzenletiyor ve doğrudan question_bank satırını güncelliyor. Yeni paket hattı öğrenci/öğretmen görünümü, inceleme kaydı ve ayrı yayın aşamaları içeriyor. Bu iki yol aynı zihinsel modeli sunmuyor. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/questions.tsx:33) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/library-drafts.tsx:780) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/library-publication.tsx:659)
- İşlem güvenliği bazı ekranlarda güçlü: geçici hakta kalıcı komut kimliği/aynı isteği yeniden kontrol; destekte aile mesajı/ekip notu ayrımı ve sürüm çatışması; ortak Prova incelemesinde özgün cevap korunması ve ayrı sonuç yayını. Bunlar sadeleştirme uğruna kaldırılmamalı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/overrides.tsx:148) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/support/help-center.tsx:745) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/cohort-review.tsx:449)

### Inferences
Önerilen bilgi mimarisi: **Bugünkü işler**; **Aileler ve erişim** (aile, paket, geçici hak, mağaza kontrolü); **İçerik** (tek soru/paket yaşam döngüsü, kaynak-kapsam, katkılar, yayınlar); **Ölçme** (Birlikte Prova, cevap inceleme, itiraz); **Destek** (görüşmeler, fikirler, yardım yazıları); **Sistem** (AI modelleri/politikaları, iş kuyruğu, bildirim teslimi, hazır seçenekler). Bu yeni ekran tasarımı değil, uygulanacak değişiklik önerisidir.

Her çalışma alanında ilk görünüm “hangi iş bekliyor, ne kadar acil, ne yapabilirim?” sorularını yanıtlamalı. Ayarlar uzun işlem kuyruklarının üstüne konmamalı. Aynı yetki, taslak, yayın ve bekleyen komut davranışı bütün yüzeylere yayılmalı.

### Gaps
Aşağıdaki envanter kaynak koddan doğrulanan ekran ve durumları listeler; erişilmeyen canlı durumlar ayrıca işaretlenir. RLS/RPC sınırlarının hepsine saldırı testi yapılmadı; istemci korumaları tek başına “güvenlik açığı yok” kanıtı değildir. Finansal sağlayıcı, push cihazı ve gerçek öğrenci yüküyle uçtan uca test bu incelemede tamamlanmış sayılmaz. Kontrollerin çocuk üzerindeki gerçek etkisi kullanıcı çalışması gerektirir.

## Ekran ekran ne değişmeli?

### Takeaway
P0 düzeyinde doğrulanmış bir açık bu kaynak incelemesinden çıkarılmadı. P1, yanlış yayın/yanlış paket/puan kararı veya temel işin anlaşılmasını etkileyen sorunlar; P2 erişilebilirlik, yönlendirme, yoğunluk ve iş verimi; P3 son görsel inceliktir.

### Cited Findings

#### BO-01 · P2 · / — Rolüne uygun girişe yönlendirme

**Kanıt türü:** Kaynak incelemesi; giriş yönlendirmesi ayrıca gözlendi. **Durumlar:** Oturum yükleniyor, Rol yönlendirmesi. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/index.tsx:1)

**Değişiklik:** Yönlendirmede rol eksikliği ile oturum yükleme ayrı gösterilmeli. Rolün yoksa oturumdan çık dışında doğru hesabı seçme ve yetki isteme yolu sunulmalı.

**Kabul ölçütü:** Oturumsuz, yetkisiz ve her operasyon rolü doğru başlangıca ulaşır; sonsuz yüklenme olmaz.

#### BO-02 · P2 · /sign-in — Yetkili operatörün giriş yapması

**Kanıt türü:** Kaynak incelemesi; giriş yönlendirmesi ayrıca gözlendi. **Durumlar:** Boş giriş, Gönderiliyor, Hatalı kimlik bilgisi, Yetkisiz mevcut oturum, Harici şifre yenileme. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/sign-in.tsx:31)

**Değişiklik:** Parola görünürlüğü yok; gönderimde düğme yazısı değişmiyor. Şifre yenileme genel aile web girişini yeni sekmede açıyor. Başarılı yenilemeden yönetim alanına geri dönüş açık olmalı; Cloudflare ve GINA girişinin neden ayrı olduğu kısa anlatılmalı.

**Kabul ölçütü:** Klavye ile giriş ve parola yenileme tamamlanır; yüklenme sesli duyurulur; ikinci kimlik adımı kullanıcıyı döngüye sokmaz.

#### BO-03 · P1 · /dashboard — Operatörün bugün yapılacak işi görmesi

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Sayaçlar, Paket dağılımı, AI tüketimi, Boş/hata/yükleme. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/dashboard.tsx:51)

**Değişiklik:** Aile/çocuk sayıları ve token toplamları ana içeriği kaplıyor; bekleyen destek, incelenecek sorular, başarısız AI/bildirim, yayın riski yok. Rol bazlı iş kuyruğu öne; kullanım sayıları ikincil özet olmalı.

**Kabul ölçütü:** Operatör tek ekranda en acil 3 işi, nedenini, bekleme süresini ve doğrudan açma eylemini görür. Hata varsa yükleniyor sonsuza kadar kalmaz.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-dashboard-1440.png>)

#### BO-04 · P2 · /families — Aileyi bulup erişimini inceleme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Arama, 100 satır liste, Boş sonuç, Paket/ödeme bağlantısı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/families.tsx:14)

**Değişiklik:** En fazla 100 sonuç; liste bu sınıra ulaşıldığını söylemiyor. UUID her satırda baskın, 9 sütun yatay kayıyor. Arama alanının görünür/bağlı etiketi yok. Aile özeti, paket ve son etkinlik grupları; ID kopyalama ayrıntıda; sonuç sayısı ve sayfalama.

**Kabul ölçütü:** 101 ailede ilk 100 tüm kayıt gibi sunulmaz. 768px görünümde aile adı/paket/eylem kaybolmaz; arama ekran okuyucuda adlandırılır.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-families-1440.png>)

#### BO-05 · P2 · /billing — Ailenin paket kaynağı ve mağaza durumunu açıklama

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Aile erişimi, Bildirim takibi, Aile seçimi, Mağazadan kontrol, Bekleyen kontrol, Geçmiş, İade açıklaması. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/billing.tsx:26)

**Değişiklik:** Aile listesi50, olay listesi50 sınırı açıklanıyor fakat sonraki sayfaya geçiş yok. Aile seçimi ile bildirim filtresi aynı URL durumuna bağlı; bekleyen kontrol geri yüklenince aile adı yerine UUID. Aile bağlamı sabit özet ve kaynak farkları zaman çizelgesiyle sunulmalı.

**Kabul ölçütü:** 50 üzeri kayıt tarih/arama/sayfalama ile bulunur; geri yüklenen kontrol doğru aile adını gösterir; mağaza iptali, iade ve geçici hak karışmaz.

**Görsel sınır:** Mağaza kontrolü veya finansal değişiklik yapılmadı.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-billing-1440.png>)

#### BO-06 · P1 · /overrides — Geçici paket hakkı verme/sonlandırma

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Aile arama, Hak verme, Hak sonlandırma, Belirsiz işlem, Aktif/pasif liste, Son30 işlem geçmişi. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/overrides.tsx:23)

**Değişiklik:** Aramayla aile seçildikten sonra serbest UUID alanı isteniyor; varsayılan 90 gün, gerekçe tek satır; aile önce/sonra erişim önizlemesi yok. Aile kimliği saltokunur özet; 7/30/90gün+özel; gerekçe şablonu+not; etkili paket farkı onay öncesi gösterilmeli.

**Kabul ölçütü:** Yanlış aileye hak verme riski isim+ikinci bağlamla azaltılır. Süre, ücretsiz olduğu, mevcut mağaza hakkına etkisi açıkça doğrulanır; retry aynı işlem kimliğini korur.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-overrides-1440.png>)

#### BO-07 · P1 · /ai — AI sağlayıcı/model ve paket davranışını yönetme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Genel durdur/aç, Kaynak dosya limiti, Paket başına model/token, Model listesi, Yeni model. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/ai.tsx:29)

**Değişiklik:** Model/paket satırları doğrudan update; meşgul bayrağı ve taslak ayrılma koruması yok. Model durdurma sadece Evet/Hayır düğmesi; etkilenen paket gösterilmiyor. Yeni model yalnız ID/ad ile ekleniyor; görüntü/PDF desteği, maliyet, model testi, sürüm ve fallback sözleşmesi açıklanmıyor.

**Kabul ölçütü:** Model kapatmadan etkilenen akışlar/paketler listelenir; yeni sağlayıcı doğrulanmadan etkinleştirilmez; çift tıklama tek mantıksal değişiklik olur; alanlar etiketli, değişiklik geçmişi görünür.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-ai-1440.png>)

#### BO-08 · P1 · /operations — AI hatalarını ve kota davranışını yönetme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Sağlayıcı sağlık, Kota matrisi, Son100işlem, Yeniden denemeye izin. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/operations.tsx:80)

**Değişiklik:** En acil hatalar yerine kota düzenleme tablosu ilk sırada; son100işlem filtre/arama yok; UUID+ham hata kodu baskın; İncele formu üstte açılıyor ama fokus/kaydırma yok. Kuyruk durum/işlem / aile / tarih filtresiyle öne, politika ayrı ayarlar sekmesi; seçili işlem ayrıntısı bağlam içinde.

**Kabul ölçütü:** 100 üzeri arızada kayıt bulunur; İncele sonrasında fokus seçiliolay başlığına gider; yeniden ücret riski+önceki istek durumu+son kontrol görünür; hiçbir çocuk cevabı gereksiz açılmaz.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-operations-1440.png>)

#### BO-09 · P1 · /input-catalog — Ailelerin seçerek doldurduğu seçenekleri yönetme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Tür/arama, Kart listesi, Yeni seçenek, Düzenleme, Çakışma, Taslağı kapat. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/input-catalog.tsx:107)

**Değişiklik:** Sabit kimlik elle zorunlu; yeni seçenekte sınıf 1–12 varsayılan; etkin/gizli, sınıf ve ders filtreleri eksik. Taslağı kapat onaysız setDraft(null); beforeunload iç gezinmeyi korumuyor. Kimliği üret; yaş / sınıf kapsamı bilinçli seçim; ders eşanlamlıları ve MAT/İNG gibi kısaltmalar ayrı kanonik ilişki olmalı.

**Kabul ölçütü:** Çanta/ödev/ders seçeneğinin mobil önizlemesi ve hangi sınıflarda görüleceği gösterilir; kayıpsız çıkış; Türkçe/İngilizce ve kanonik ders doğrulanır.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-input-catalog-1440.png>)

#### BO-10 · P1 · /questions — Eski genel soru bankasını düzenleme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Sınıf / ders / konu filtre, 50artarakliste, Soru editörü, Sil onayı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/questions.tsx:16)

**Değişiklik:** Şıklar JSON textarea, doğru yanıt serbest metin; ders/konu serbest; global soruya doğrudanupdate ve kayıpsız çıkış koruması yok. Yeni kütüphane görsel / ortak kaynak/ölçüt/yayın akışından ayrı eski yönetim. Tek içerik editörüne geçir; eskileri saltokunur ve sürümletilerek düzenle.

**Kabul ölçütü:** JSON editörü yerine şık kontrolleri; öğrenci/öğretmen önizleme; ders/sınıf/kazanım seçimi; canlı/atanmış içerik etkisi fark görünümü; kapatınca taslak kaybolmaz.

**Görsel sınır:** Yerel test listesi boş; dolu düzenleme ekranları yalnız kaynak kodundan incelendi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-questions-1440.png>)

#### BO-11 · P1 · /library — Koleksiyon/taslak/katkı/kapsam/hak yönetme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Koleksiyonlar, Taslak paketler, Katkılar, Haklar ve ödüller, Senaryo kaynakları, Koleksiyon editörü, Tekilsoruekleyici, Tekilsoruyayınla, Eski katkı inceleme. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/library.tsx:118)

**Değişiklik:** Üç farklı içerik yolu var: Soru bankası, Koleksiyonlar tekil soru ve Taslak paket. Koleksiyon durumdropdownundan yayımlama, soru için tek tuş İnceledim yayımla; yeni paket çok adımlı kontrollerinden farklı. Varsayılansekme eski Koleksiyonlar. Tek içerik yaşam döngüsü ve tek ana Hazırla → İncele → Yayımla yolu olmalı; legacy içerik göç aracıyla korunmalı.

**Kabul ölçütü:** Aynı soru nereden açılırsa açılsın sürüm, düzey, ortak kaynak, inceleme, etki ve yayın kontrolleri aynı; kaydet hiçbir yol üzerinden yanlışlıkla yayınlamaz.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-1440.png>)

#### BO-12 · P2 · /library?tab=drafts — Soru paketini kaynak/öğrenci/cevap/ölçüt olarak inceleme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Paket dosyası yükle, Paket listesi / sayfalama, Soru seçimi, Öğrenci görünümü, Cevap/puanlama, İnceleme notu, Çakışma, Görsel büyüt, Kaydedilmemiş taslakla çıkış diyaloğu. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/library-drafts.tsx:780)

**Değişiklik:** İnceleme view=review iken öğrenci/ortak kaynak gizleniyor; Soruyu aç linkiyle görünüm değiştiriliyor. Puanlama kararı sırasında kanıtın kaybolması geri/ileri yükü yaratır. Genişekranda kaynak+soru+rubrik solda sabit, inceleme kararı sağda; tablette kaynak çekmecesi kontrollü.

**Kabul ölçütü:** Öğrenci sorusu ve ortakgörseli not yazarken erişilebilir; soru değiştirmede taslak koruması; incelemenin yayın olmadığı belirgin; görsel hatası sıfır puan/uygun kararına dönüşmez.

**Görsel sınır:** Dosya önizlemesi yapıldı; veritabanına içe aktarma, inceleme kaydı veya yayın yapılmadı.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-tab-drafts-1440.png>)

#### BO-13 · P2 · /library-publication — İncelenmiş paketi belirli aile paketlerine yayınlama

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Eksik kimlik, Yayın kontrolleri, Aile bilgileri, Paket erişimi, Önizleme, Yayın onayı, Sürüm değişmesi, Yayından kaldır, Kaydedilmemiş taslakla çıkış diyaloğu. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/library-publication.tsx:583)

**Değişiklik:** Kısa açıklama rows=1 ve1.000 karakter; program/dönem serbest metin, kaynakla ilişki elle kuruluyor. Önizleme ailekartını gösteriyor fakat telefon/tablet akış ve kotanın etkisi kontrollu önizleme değil. Kaynak/kapsam kayıt seçimi, yeterli metin alanı ve yayımdan önce açık erişim özeti.

**Kabul ölçütü:** Bozukmedya/eksikinceleme yayınlayamaz; konu pratiği resmî MEB uygunluğu diye etiketlenmez; 1.000 karakter açıklama taşmaz; aile önizleme erişim / harcanan hak gerçeğini yansıtır.

**Görsel sınır:** Yalnız paket seçilmemiş giriş durumu gözlendi; dolu yayın editörü kaynak kodundan incelendi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-publication-1440.png>)

#### BO-14 · P1 · /library?tab=policy — Kütüphane kotası ve katkı ödüllerini yönetme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Paket kotaları, Ödül kuralları, Yeni kural / kuralı düzenle, Kazanılmış hak kilidi. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/LibraryPolicy.tsx:56)

**Değişiklik:** Açık kurallar birlikte ödül veriyor; yöneticiye paragrafla bildiriliyor ama somut hesap önizleme yok. Ödül süresi ve geçerlilik iki ayrı sayı; örnek/simülasyon yok. 5, 10 ve 20 kabul senaryosu, toplam kazanılacak hak ve çakışan kurallar gösterilmeli.

**Kabul ölçütü:** Aynı katkının iki kuraldan kazandıracağı tutar görülebilir; eski haklar korunur; değişiklik önce/sonra ve tarih kapsamı gösterilir.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-tab-policy-1440.png>)

#### BO-15 · P1 · /library?tab=review — Ailelerin gönüllü soru katkılarını inceleme

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Katkı kuyruğu, Ortak kaynak/görsel büyüt, Soru / öğretmen cevabı, Rubrikdüzenle, Kabul / geri gönder, Kaydedilmemiş taslakla çıkış diyaloğu, Eski metinkatkıları. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/contribution-sets.tsx:661)

**Değişiklik:** Kabul bütün gruba işliyor; bir soru problemi bütün katkıyı geri göndermeyi gerektiriyor. Uzunöğretmenalanları soru/görselden aşağı kopuyor; ölçüt ekle var silme/yeniden sıralama kontrolü görünmüyor. Ortak kaynaktutarlılığınıkoruyarak soru bazlı karar/düzeltme işaretleri; katkı sahibine somut kanıt ve sonraki adım.

**Kabul ölçütü:** Kabul edilen/grupta bekleyen / reddedilen soru ayrılır; ödül yalnız onaylanan özgün soru sayısıyla; kişisel bilgi / telif kontrolü ve veliye giden metin ayrı; kısmi kabul iş kuralı ayrıca tasarlanır.

**Görsel sınır:** Yerel test listesi boş; dolu düzenleme ekranları yalnız kaynak kodundan incelendi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-tab-review-1440.png>)

#### BO-16 · P1 · /library?tab=curriculum — Resmî senaryo kaynaklarını doğrulama

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** JSON kaynak dosyası, Sınıf/ders/durum filtre, 15 kayıtlık aday listesi, Özgün kaynak, Dağılım hücreleri, Kapsam incelemesi, Kataloğa aç / geri çek, Kaydedilmemiş taslakla çıkış diyaloğu. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/curriculum-review.tsx:662)

**Değişiklik:** Program, okul türü / kapsam, resmî URL serbest metin; belgeyle hücre karşılaştırması ayrı sekme ve uzun alt form. Kaynak-hücre-kazanım-soru adedi yan yana karşılaştırılmalı; okul türü/program/yıl kanonik seçenekler ve belirsizlik başına çözüm.

**Kabul ölçütü:** Dosya uyumu ile pedagojik onay karışmaz; MEB senaryosu ile okulun seçim onayı ayrı; tüm uyarılar karar+kanıt ile kapanır; aynı kaynak tekrar incelemede sürüm farkı görülebilir.

**Görsel sınır:** Yerel test listesi boş; dolu düzenleme ekranları yalnız kaynak kodundan incelendi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-tab-curriculum-1440.png>)

#### BO-17 · P1 · /groups — Aynı düzeye ortak Prova yayımlama

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Yayın / paket hakları, Yeni Prova başlığı, Kaynak/soru seti, Tarihler/süre, Açık uçlu inceleme, Yayınla, İptal gerekçesi, Bekleyen yayın. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/groups.tsx:358)

**Değişiklik:** Politika ve yeni sınav aynıuzun sayfa; süre sayısal giriş alanı; yayın geri alınamayan içerik sabitlemesiyle tek son buton; ayrı aile / çocuk önizleme ve iş yükü tahmini yok. Üç adım: Kapsam→Sorular / süre→Önizleme/yayın. Öğretmen incelemesi gerektiren soru sayısı×katılımcı tahmini görünmeli.

**Kabul ölçütü:** Başlangıç/bitiş/saat dilimi/kişisel süre ayrımı örnekle net; ortak kaynağa bağlısorular blok korunur; benzer sınıfın program uygunluğu doğrulanır; sıralama rızası ve sonuç yayın durumu anlaşılır.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-groups-1440.png>)

#### BO-18 · P1 · /cohort-review — Anonim cevapları ölçütle puanlama ve sonuç yayınlama

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Katılımcı kuyruğu, Soru seçimi, Defter/görsel büyüt, Şıklı otomatik puan, Açık uçlu rubrik, Okunamadı / beklet, Veli itirazı, Sonuç yayını. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/cohort-review.tsx:362)

**Değişiklik:** Katılımcılar ve bütün soru butonları uzuyor; filtre Sonraki incelenmemiş/itirazlı yok; dirty iken gezinme disabled ama niye açıklaması eksik. Kanıt defteri ile rubrik uzun sayfa; puan çoğusıfır varsayılan. Yalnızrastgele kıyas yerine soru bazlı değerlendirme kuyruğu ve seçilmemiş ölçüt durumunu ayırma.

**Kabul ölçütü:** Defter görünmezse boşyanıt sayılmaz; kanıt+ölçüt aynı anda; 50 soru ve 1.000 katılımcıda hedef kayıt bulunur; not verilmemiş ile 0 puan farklı; sıralama açık itiraz varken kesinleşmez.

**Görsel sınır:** Ortak sınav verisi bulunmadı; puanlama editörü yalnız kaynak kodundan incelendi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-cohort-review-1440.png>)

#### BO-19 · P2 · /support — Aileye yanıt ve özel ekip notu

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Durum/konu filtre, Sayfalı kuyruk, Görüşme, Eski 100 mesaj, Aile yanıtı/ekip notu, Durum değiştir, Yeniden aç, Taslakla ayrılma, Belirsiz gönderim. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/support/help-center.tsx:196)

**Değişiklik:** Kuyrukta metin / ID arama, sorumlu operatör, öncelik / yaş bilgisi bulunmuyor; aynı anda inceleyen kişiler görünmüyor. Bunlar ölçeklendiğinde uzun bekleyen sorunun kaçmasına neden olabilir. Konuya göre hazır cevap, yazıyı öner ve sonraki bekleyen; ekip notu ile aile mesajı renk/başlık ayrımı korunmalı.

**Kabul ölçütü:** Özel not aile önizlemesinde görünmez; 100 üzeri mesaj ulaşılır; taslaklı geçiş korunur; kişi değişiminde yanlışgörüşmeye gönderim olmaz; süre/sorumlu iş yükü görünür.

**Görsel sınır:** Dışarıya mesaj gönderilmedi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-support-1440.png>)

#### BO-20 · P2 · /ideas — Aile fikirlerini değerlendirme ve geri dönüş

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Destekle ortak kuyruk, Görüşme, Ekip notu, Yanıt/durum. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/support/help-center.tsx:196)

**Değişiklik:** Destekteki aynı durumlar fikrin yaşamını açıklamıyor: Veli yanıtı/Tamamlanan, planlandı/yapılıyor/yayınlandı durumlarına karşılık gelmiyor. Fikri ürün kararı / benzer fikirler / sürüm bağıyla ilişkilendir; özel görüşmeyi kamu oylamasına otomatik çevirmeden.

**Kabul ölçütü:** Aileye düşünülen/planlanan/yapılan ayrılır; taahhüt edilmemiş tarih vaat edilmez; mükerrer fikirler kişisel veri ifşa etmeden birleştirilir.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-ideas-1440.png>)

#### BO-21 · P2 · /help-articles — SSS taslağı, inceleme ve yayın

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** Dil / platform listesi, Yeni yazı / yazıyı düzenle, Önizleme, Taslak, İncele, Yayın/geriçek, Karar gerekçesi, Sürüm çatışması. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/help-articles.tsx:609)

**Değişiklik:** Yeni yazı kodu elle;20.000 karakter yanıt tek metin alanı; başlık/paragraf/liste/adım türü rehberi ve uygulama akış bağı yok. Başlıktan kod öner; kısa yanıt+adımlar+ilgili güvenli bağlantılar; sürüm farkı ve telefon/desktop önizleme.

**Kabul ölçütü:** Taslak yayınlanmış yanıtı değiştirmez; kullanıcı hangi ekranın hangi adımını yapacağını anlar; link hedefleri yetkiyi aşmaz; İngilizce / Türkçe eşdeğerlik bekleyeni görünür.

**Görsel sınır:** İnceleme veya yayın onayı gönderilmedi.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-help-articles-1440.png>)

#### BO-22 · P2 · /notifications — Push teslim hatalarını izleme ve kurtarma

**Kanıt türü:** Kaynak + yerel gerçek arayüzün başlangıç durumu. **Durumlar:** İşlem gereken / tümü / durum, Sayfalama, Cihaz makbuz özeti, Hata ayrıntısı, Tekrar sıraya al, Gerekçe/onay, Belirsiz gönderim. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/notifications.tsx:237)

**Değişiklik:** Sağlayıcı kabulü cihazda görülmesini garanti etmez ayrımı korunuyor. Kuyruk yalnız durum filtreli; seçili yeniden dene eylemi öncesinde neden/etkilenen adedi ve önerilen çözümü tek olay özetinde görmeli; teknik makbuzlar ikinci katmanda.

**Kabul ölçütü:** “Sent”, okundu anlamına gelmez; yanlış aile hedefi gösterilmez; başarılı makbuz yeniden yollanmaz; aynı komut retry tekrar hak/işlem yaratmaz; 24 saat / 2 kurtarma sınırı devre dışı bırakılma nedeninde görünür.

[1440 px başlangıç görünümü](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-notifications-1440.png>)

### Inferences
- Ortak model ilkesi: aile/çocuk kimliği, sınıf, ders, konu, öğrenme çıktısı, kaynak ve sürüm aynı kanonik seçeneklerle yönetilmeli. Serbest metin açıklama içindir; ilişkilendirme alanında son çaredir. Örneğin MAT/İNG eşanlamlıları aile ekranı ve backoffice aynı ders kaydına bağlanmalı; yalnız başlık biçimi değiştirmek yeterli değildir.
- Bilinçli karar ilkesi: anında etkinleşen kota/model/paket değişiminde önce–sonra farkı, etkilenecek kapsam ve geri dönüş yolu gösterilmeli. Çok etkili işlemde gerekçe/denetim kaydı; rutin taslak kaydında fazladan onay değil.
- Pedagojik kalite: “bu metin dolu” ile “bu soru ilgili sınıfa, programa ve ölçme amacına uygun” ayrı. Kaynak belge incelemesi, soru alan uzmanı incelemesi ve aile/okul kapsam seçimi aynı onay kutusuna sıkıştırılmamalı.
- Sıralama: ölçütlü inceleme ve itiraz bitmeden kesinlik vermeme korunmalı. Puanlar kişilik/yeterlilik etiketi yapmamalı; çocuğa doğrudan kıyas yerine kanıt ve sonraki öğrenme adımı. Farklı program veya süre koşulları aynı grupta karşılaştırılıyorsa açıkça kapsamlandırılmalı.
- Marka: yeni maskot/oda çizimi gerekmiyor. Yönetici ekranlarında krem zemin, mint durumlar ve mor ana eylem korunmalı; peluş maskotu her yoğun tabloya koymak yerine onboarding/başarılı boş kuyrukta küçük ve anlamlı kullanmak yeterli. Dekor yerine okunur iş hiyerarşisi kalite hissi oluşturur.

### Gaps
Bu öneriler henüz uygulanmadı. Kısmi katkı kabulü, iş atama, ortak sınav uygunluğu ve yayın sürümleme birleşimi veri/iş kuralı tasarımı gerektirir; yalnız CSS değişikliği değildir. Her rota için satır numarası temel kanıta işaret eder; tüm olası kayıt kombinasyonları denenmiş değildir.

## Ortak bileşenlerde hangi güvenilirlik ve erişilebilirlik kararları gerekiyor?

### Takeaway
Yeni çalışma alanlarının korumaları, eski AI/soru/katalog editörlerine eşit uygulanmalı. Ortak bileşen standardı yalnız buton rengi değil, yükleme/hata/boşluk, klavye, ekran okuyucu, kaydetme ve geri dönüş sözleşmesi olmalı.

### Cited Findings
- Notice bileşeni görsel div üretir, role=status/alert yok; bu yüzden dinamik mesajın ekran okuyucuya duyurulması ortak sözleşmede garanti değil. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/components/Layout.tsx:275)
- useAdminQuery hata sonrasında eski veriyi tutar; dashboard/questions gibi !data durumunda “yükleniyor” gösteren tüketiciler hata ve yüklemeyi birlikte bırakabilir. Ortak son başarılı okuma/yenileme sözleşmesi her ekranda yok. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/lib/use-async.ts:23) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/dashboard.tsx:51)
- AI satırı ve soru editörü etiketlerinde label/htmlFor bağlantısı yok; tablo sütunu görsel bağlamdır, kontrolün erişilebilir adı garantisi değildir. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/ai.tsx:51) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/questions.tsx:71)
- Ortak CSS 48px buton/input hedefi, focus-visible ve reduced-motion içeriyor. Bunlar iyi temeller; menü taşması, dialog fokus dönüşü, yüzde 200 yakınlaştırma ve uzun Türkçe içerik yine ayrı denenmeli. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/styles/globals.css:10)
- Rol katmanında sunucu RPC/RLS yetkilendirmesinin istemci UI kararından ayrı olduğu açık; operasyon yetkisi 30 saniyede/fokusta yenileniyor. Yetki başarısızlığında taslak koruma amaçlanmış. Güvenlik denetimi bu davranışı bozmadan yapılmalı. [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/lib/supabase.ts:3) [Kaynak](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/lib/auth.tsx:98)

### Inferences
Ortak kabul paketi: 768/1280/1440 genişlik, 800/900/1000 yükseklik; yüzde 200 zoom; klavye tab/shift-tab/Escape ve fokus dönüşü; boş,1,50,100+ kayıt; uzun başlık; ağ gecikmesi/yanıt kaybı; çift tıklama; başka operatörün revizyonu; rol kaybı; sekme/route geri dönüşü. Kritik eylem hiçbir görünümde yalnız hover ile erişilir veya diğer panelin altında kalır olmamalı. Gerçek veri kaydetmeden taslak ve önizleme akışları kontrol edilmeli.

### Gaps
Klavye/ekran okuyucu, bütün renk kontrastı kombinasyonları ve gerçek cihaz dokunma testlerinin tümü bu kaynak incelemesinden doğrulanamaz. “Bütün ekranlar kusursuz” denemez; gözlenen ölçüm sonuçları aşağıda ayrı verilmiştir.

## Gerçek arayüzde ne gördüm, hangi bulgular doğrulandı?

### Takeaway
18 fiziksel sayfa rotası kaynakta tarandı; kütüphanenin ayrı sekmeleriyle envanter 22 girdidir. Gerçek yerel servis ve yalnız sentetik verilerle 20 başlangıç görünümü 1440 px, bunların 10'u ayrıca 1280 ve 768 px genişlikte açıldı. 11 ek düzenleme/önizleme görüntüsüyle toplam 51 ekran görüntüsü alındı. Bu sayılar bütün kayıt, hata ve mutasyon kombinasyonlarının test edildiği anlamına gelmez.

### Cited Findings
- **P1 — AI model seçimi tablette okunmuyor.** 768 px görünümde paket tablosunun model seçicisi yalnız aşağı ok görülecek kadar daralıyor; seçili model adı kayboluyor. Sağdaki kaydetme eylemi de tabloyu yatay kaydırmayı gerektiriyor. Operatör hangi model üzerinde işlem yaptığını göremediği için bu yalnız estetik sorun değil. Paket başına açılan düzenleme paneli, görünür model adı ve kapsam özeti gerekir. Kabul: 768 px ve %200 yakınlaştırmada seçili model adı ve kaydetme eylemi aynı düzenleme bağlamında okunur. [Gerçek ekran — 768 px](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-ai-768.png>)
- **P1 — Hazır seçenek taslağı uyarısız kayboluyor.** “Seçenek ekle” açıldı, Türkçe metne örnek girildi, “Taslağı kapat” tıklandı. Form onay istemeden kapandı; yeni formda önceki metni kurtarma sunulmuyor. Veritabanına kayıt gönderilmedi. Kabul: kirli taslakta “Düzenlemeye devam et / Değişiklikleri bırak” veya geri alınabilir yerel taslak sunulmalı. [Form](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-catalog-new-1280.png>), [uyarı vermeden kapatan kod](/Users/enes/.codex/worktrees/gina-library-access/gina/apps/backoffice/src/pages/input-catalog.tsx:249)
- **P2 — Tüm rollü yönetici menüsü ekran yüksekliğini aşıyor.** 1280×800 görünümde 14 bağlantıdan oluşan sol menü 800 px yüksekliğinde; çıkış düğmesinin üstü yaklaşık 1052 px, altı 1100 px. Kütüphanede menü 195 px'e daralıp satırlar daha çok sarılıyor; çıkış yaklaşık 1232 px'e iniyor. Bu, bütün rol türleri için kanıt değildir; test hesabı tüm rollere sahipti. Menüde iş grupları, iç kaydırma ve sabit hesap alanı gerekir. Kabul: 1280×800'de temel gezinme/hesap eylemi keşfedilebilir; menü metni gereksiz çift satıra bölünmez. [Panel](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-dashboard-1280.png>), [kütüphane](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-tab-drafts-1280.png>)
- **P1 — İşlem merkezinde iş kuyruğu, ayar matrisinin altında kayboluyor.** 15 kota satırı bittikten sonra son işlemler geliyor; 1440 px görüntünün yaklaşık 1600 px aşağısında başlıyor. Arıza çözmek için gelen operatör önce onlarca değiştirilebilir sayı görüyor. İş kuyruğunu başlangıca taşı, politika düzenlemeyi ayrı sekmeye ayır. [Gerçek ekran](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-operations-1440.png>)
- **P2 — Açık/kapalı metni yanıltıcı.** İşlem politikalarında kapalı kutunun yanında da “Açık” yazıyor; checkbox teknik olarak durumu taşıyor ama hızlı taramada ters okunuyor. Durumu “Kapalı / Açık” olarak metinle birlikte güncelle. Aynı ekranda free/plus/pro; ana panelde “Aktif komp'lar”; AI ekranında “kill switch” ve app_settings iç ayrıntıları var. Operatör dili “Başlangıç / Plus / Pro”, “Geçici hak”, “Tüm AI işlemlerini durdur” olmalı. [İşlem tablosu](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-operations-1440.png>), [panel](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-dashboard-768.png>)
- **P2 — Aile listesinde karar için gerekli eylem, kimlik metninin gerisine düşüyor.** 768 px görünümde UUID beş satıra kırılıyor; paket/ödeme eylemi sağ kenarda kesiliyor ve yatay kaydırma istiyor. Küçük ekranda aile adı, etkin paket ve tek “Aileyi aç” eylemi; sayılar ve kimlik ayrıntıda olmalı. [Gerçek ekran](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-families-768.png>)
- **İyi temel — destek gizlilik ayrımı çalışıyor.** Sentetik görüşmede ekip notu amber zeminde “Aileye görünmez”, aile yanıtı ayrı biçimde gösteriliyor. Ekip notu taslağına örnek yazıp “Aileye yanıt” sekmesine geçildiğinde aile metin alanı boş kaldı; özel taslak otomatik dış mesaja taşınmadı. Dışarıya mesaj gönderilmedi. Bu ayrım korunmalı; iyileştirme arama, iş atama ve bekleme yaşı etrafında olmalı. [Görüşme](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-support-thread-1280.png>), [özel not taslağı](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-support-internal-draft-1280.png>)
- **İyi temel — yardım yazısında taslak ve yayın ayrımı anlaşılır.** Mevcut sentetik taslak açılıp önizleme yapıldı; “Taslak · Ailelere görünmez” ve “Önce kayıtlı sürümü inceleyin” ifadeleri var. Yayın düğmesi inceleme olmadan etkin değil. Bunun yerine yeni bir genel form kurmak gereksiz; içerik yazım rehberi, arama ve sürüm karşılaştırması eklenmeli. [Düzenleme](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-help-article-editor-1280.png>), [önizleme](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-help-article-preview-1280.png>)
- **P2 — Paket dosyasının türü operatöre yeterince öğretilmiyor.** Depodaki ham pilot.json yüklenince genel “geçerli GINA soru paketi değil” hatası geldi. Mevcut hazırlama aracıyla üretilen taşınabilir paket doğru açıldı. Bu format ayrımı beklenen olabilir; hata açıklaması hangi dosyanın gerektiğini ve örnek paketi sunmalı. “JSON” demek tek başına yeterli değil. [Hatalı biçim sonucu](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-pilot-local-preview-1280.png>), [hazırlayıcı sözleşmesi](/Users/enes/.codex/worktrees/gina-library-access/gina/scripts/prepare-library-import.py:49)
- **İyi temel ve iyileştirme — kaynak/soru/cevap ayrımı korunmuş.** Geometri pilotunun 20 soru, 8 ortak kaynak içeren taşınabilir paketi yalnız yerel önizlemede açıldı. Öğrenci görünümü, cevap ve rubrik 1280/768 px'te okundu. Ortak kaynağın üstte kalması güçlü; 1280×800'de cevap/rubrik ilk ekranın aşağısına kaydığı için yan yana kanıt ve karar görünümü önerisi hâlâ geçerli. Paketi veritabanına kaydetmedim, onaylamadım ve yayımlamadım. [Öğrenci](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-valid-local-student-1280.png>), [cevap](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-valid-local-teacher-1280.png>), [tablet](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-valid-local-teacher-768.png>)
- **P2 — Eksik bağlam sayfaları zayıf.** Paket kimliği olmadan yayına hazırlama yalnız “Kütüphaneden bir taslak paket seç” metni; ortak sınav seçilmeden inceleme yalnız “Prova seç” düğmesi veriyor. Bağlam yokluğunu açıklayan kısa kart, ne seçileceği ve doğrudan ilgili listeye eylem eklenmeli. [Yayın giriş durumu](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-library-publication-1440.png>), [inceleme giriş durumu](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/screenshots/admin-cohort-review-1440.png>)

### Inferences
Önce model seçimi ve taslak kaybı düzeltilmeli. Ardından eski ve yeni içerik yolları aynı yayın sözleşmesine bağlanmalı; ana panel iş kuyruğuna, sistem ayarları etki önizlemesine dönüşmeli. Bu yön, mevcut GINA renklerini ve yeni destek/kütüphane görsel dilini değiştirmeden daha profesyonel ve güvenilir bir yönetim deneyimi sağlar.

### Gaps
Dolu global soru bankası, katkı kararı, resmî senaryo detay incelemesi, gerçek ortak sınav cevap/itiraz kuyruğu, abonelikli ailenin mağaza kontrolü ve nihai paket yayını fixture verisi olmadığı için canlı denenmedi. Bunlar kaynak kodu üzerinden incelendi; başlangıç ekranını açmak bu derin akışların işlendiği anlamına gelmez. Mobil Safari, iPad, ekran okuyucu ve tüm rol kombinasyonları bu alt çalışmada test edilmedi. Gerçek model adları ve sağlayıcı kullanılabilirliği doğrulanmadı; görünen modeller test veritabanının kayıtlarıdır.

Envanter: [backoffice-inventory.json](</Users/enes/.codex/worktrees/gina-library-access/gina/research_notes/GINA bütün ekran incelemesi/backoffice-inventory.json>). Bu dosyada rota, alt durumlar, kaynak satırı, öncelik, değişiklik, kabul ölçütü, gözlenen durum ve kapsam sınırları ayrı tutulur.
