# GINA — Claude için kalan işler ve kabul ölçütleri

6 Kasım 2026 · İnceleme tabanı: `origin/main 7cefeff`. Bu belge güncel yürütme kapsamıdır; [kapanış tablosu](release/CLOSING-STATUS.md) gerçekleşen kod/yayın/kabul durumunu tutar. Yeni commit varsa önce farkını incele.

Önceki liste [tarihsel arşive](CLAUDE-REMAINING-WORK-ARCHIVE-2026-11-06.md) taşındı. Eski C/D/K/R/WORLD kartları bu kapsamı genişletmez. Eski gece saati ve kota hedefi geçerli değildir.

## 1. Son kullanıcı kararı ve sınırlar

- **Kütüphane içerik üretimi Claude kapsamından çıkarıldı.** Kullanıcı kütüphaneyi backoffice üzerinden yönetecek. K01 toplu soru üretimi, havuzu doldurma, soru onayı/yayını ve X06 editör organizasyonu bu teslimde yok.
- **3B dünya Claude kapsamından tamamen çıkarıldı.** Kullanıcı bunu Codex ile ayrı çalışacak. Model, rig, atmosfer, motor seçimi veya 3B planlama başlatma.
- Mevcut backoffice araçlarının aşağıda açıkça belirtilen yazılım eksikleri kapsamda kalır. Araç geliştirmek içerik üretme/yayımlama izni değildir.
- Bu teslim ve düzeltme yayını **K01, WORLD-01 veya eski R02 sırasını beklemez**. Mağaza satışı/hukuk onayı, mevcut beta ve web düzeltme yayınından ayrıdır.
- Onaylı mint/mor/krem, logo, peluş maskot ve Nunito/Baloo 2 korunur. Psikoloji, pedagoji, eğitmen, UX, mimari/güvenlik ve erişilebilirlik bakışları kullanım ölçütüdür; uzman onayı iddiası değildir.

## 2. Devralma ve çalışma kuralları

1. Güncel main'i getir; yerel değişiklikleri, worktree'leri ve bu devir dosyasını koru. Reset/clean, gerçek/demo DB sıfırlama veya yeniden tohumlama yapma. `.claude/`, `docs/secrets/`, özel hukuk taslakları, font denemeleri ve ilgisiz dosyaları commit etme. Sırları çıktıya dökme.
2. Bu belgeyi, `docs/DECISIONS.md`, `docs/release/CLOSING-STATUS.md`, `docs/release/domain-email-2026-11-06/STATUS.md`, `docs/release/experience-review/SCREEN-REVIEW-MATRIX.md` ve ilgili uygulamanın AGENTS.md dosyasını oku.
3. Geçmiş rapor başlığı yüzünden kapanmış işi tekrar açma. D15 teknik pilotu ve temizliği tamamlandı; yeni koşu gerekiyorsa ayrı doğrulama olarak adlandır. Mock testi gerçek sağlayıcı/cihaz testi sayma.
4. Mevcut izinler içinde otonom ilerle. Bağımsız işleri alt ajanlara bölebilirsin; dosya sahipliği, migration sırası, birleştirme ve yayın tek koordinatörde olsun. Dış engel bağımsız işi durdurmasın.
5. Kart durumları: AÇIK / YAPILIYOR / KOD HAZIR / YAYINDA / KABUL TAMAM / DIŞ ENGEL. Kod, test, yayın ve cihaz kabulünü ayrı kaydet. Kanıtsız tamam deme.
6. Yeni ücretli hizmet, kalıcı dış hesap yetkisi, hukuk/ürün kararı veya cihaz erişimi gerektiğinde hazırlığı yapıp somut ihtiyacı bildir. İnceleme/onay beyanını uydurma. Testleri sentetik veriye ve izinli test alıcısına sınırla.

## 3. Öncelik ve sıra

| Kart | Öncelik | Konu | Bağımlılık |
|---|---|---|---|
| H00 | P1 · ilk | Durum/yayın kayıtlarını uzlaştır | Yok |
| H01 | P1 | Apple hesabı silme ve belirteç iptali | H00, Apple erişimi |
| H02 | P1 | MEB panelden indirme/çıkarma | H00, mevcut yetki/çıkarıcı sözleşmesi |
| H03 | P1 | Eksiksiz insan incelemesi paketi | H02 ile paralel |
| H04 | P1 | E-posta kanal kabulü | Mevcut SMTP/kanal erişimi |
| H05 | P2 | Satın alma açıklaması ve belge tutarlılığı | Hukuki kararı ayrı bırak |
| H06 | P2 | Görsel/etkileşim kabul boşlukları | İlgili ekranlar + sentetik veri |
| H07 | P2 | AI ön inceleme işletim hazırlığı | Mevcut E01/C09; içerik üretimi yok |
| H08 | P1 · son | Regresyon, düzeltme yayını, rapor | Hazır kartlar; dış engeller açık raporlanır |

H00'dan sonra bağımsız işler paralel ilerleyebilir. P1 kapsam içindeki önceliktir; tek başına güvenlik açığı derecesi değildir.

## 4. İş kartları

### H00 — Kapanış kayıtlarını uzlaştır

**Bulgu:** C14c planında eski “çalıştırılmadı/onay bekliyor”; kapanışta tamamlanmış destek yönlendirmesi/göndericisi hâlâ bekliyor. Ekran matrisinde D12 ile kapanmış K1/K2 karar listesinde.

**Yap:** CLOSING-STATUS, C14c planı, ekran matrisi ve D19 raporunun tarihsel dal durumunu uzlaştır. K3/K4/K5 ertelenmiş kararlarını ayır. Alan adı için son STATUS kaydı esas alınır. Eski R02'nin K01 bağımlılığı bu teslimde kullanılmaz.

**Kabul:** Aktif her satırda tek durum, commit/test/yayın kanıtı ve sorumlu var. C14c kaynak `bba2b01`, ledger 151 ve mobil 30 kayıtları korunuyor. iOS gönderimi, Apple işleme/tester erişimi ve cihaz kurulumu ayrı. Kütüphane/3B Claude'un açık işi olarak görünmüyor.

### H01 — Apple ile girişte hesap silme zinciri

**Kaynak:** `supabase/functions/delete-account/handler.ts`, `apps/mobile/src/lib/social-auth.ts`. Mevcut silme yalnız Supabase hesabını kaldırıyor; Apple iptali yok. Native giriş yalnız identityToken kullanıyor.

**Yap:** Canlı Apple giriş durumunu doğrula. Native/web için gerekli yetkilendirme kodu ve belirteç edinme, güvenli sunucu saklama ve iptal yaşam döngüsünü uygula. Eski kullanıcıda token yoksa yeniden doğrulama yolu kur. Başarısız iptal, tekrar ve yarıda kalan silme için güvenilir iş kaydı olsun; yanlış başarı dönme. Sırlar istemciye/loga çıkmasın. Sahiplik aktarımı ve son veli silinmesi korunsun.

**Kabul:** Apple giriş → taze doğrulama → silme → sağlayıcı iptal kanıtı. Eksik/eski token, timeout, tekrar istek ve kısmi hata testleri; şifreli hesap ve çok velili aile regresyonu geçiyor. Gerçek Apple kabulü erişim yüzünden yapılamazsa ayrı açık kalıyor. Apple canlıda açıksa “ileride açılacak” varsayımıyla erteleme.

### H02 — MEB kaynağını panelden edinme ve çıkarma

**Kaynak:** `apps/backoffice/src/components/curriculum-sources.tsx`, `curriculum-pipeline.tsx`, `scripts/fetch-curriculum-sources.py`.

**Bulgu:** İlk indirme mevcut kaynak kartına bağlı; boş katalogda başlangıç yolu eksik. Çıkarma ekranında yönetici token'ı isteyen terminal komutu var.

**Yap:** Kayıtlı hedeften yıl/dönem/ders seçimiyle ilk indirme; sürüm bazlı çıkarma, durum, yeniden deneme ve hata mesajı. Panel oturumuyla yetkili iş başlat; uzun işlem gerekiyorsa sunucu kuyruğu/worker kullan. Token kopyalama veya sentetik yönetici gerektirme. Mevcut host/DNS/SSRF, hash, ZIP/boyut ve rol denetimleri zayıflamasın. Kaynak onayı ve senaryo yayını ayrı kalsın.

**Kabul:** İzole boş katalogdan indirme → çıkarma → taslak inceleme panelden tamamlanıyor. Yetkisiz/geri alınmış rol, eşzamanlı tıklama, aynı hash, değişen kaynak, ağ/çıkarma hatası testli. Mükerrer kayıt ve otomatik yayın yok. Masaüstü/tablet kanıtı var. Mevcut üretim kayıtları silinmiyor; genel katalog açılmıyor.

### H03 — İnsan incelemesi paketini tamamla

**Kaynak:** `docs/release/d15-2026-11-06/run-meb-pilot.mjs`, `live/questions-for-human-review.json`.

**Bulgu:** İnceleme dosyasında cevap/rubrik var; soru kökü, ortak kaynak ve görseller yok. D15 sentetik kayıtları temizlendiğinden bu dosyayla tam içerik incelemesi yapılamaz.

**Yap:** Tam soru metni, tür/seçenekler, ortak kaynak metni/kimliği, gereken görseller, cevap, rubrik, kazanım ve kaynak ilişkisini taşınabilir pakete ekle. Görseller süresi dolan URL'lere bağımlı olmasın. Yetkisiz içerik/kişisel veri dışa aktarılmasın. Önce mevcut güvenli artefaktlardan kurtarma olanağını incele; eksik içeriği tahmin ederek yeniden oluşturma.

**Kabul:** İnceleyen kişi üretim DB'si/oturum olmadan soruyu eksiksiz okuyup çözebiliyor. Üç sorulu ortak kaynak ve görsel örneği testli; temizlik sonrası paket açılıyor. Kurtarılamayan eski içerik açıkça belirtiliyor; yeni pilot gerekirse ayrı kapsam/maliyet kaydı var. İnsan içerik onayı yapılmadıysa kabul sayılmıyor. **Bu kart kütüphane havuzu üretimi değildir.**

### H04 — Hesap ve ürün e-postası kabulü

**Başlangıç:** Alan adı, Brevo Auth SMTP, Türkçe reset, destek yönlendirmesi ve Gmail destek göndericisi kurulmuş. Yeniden hesap/alan adı isteme. Auth SMTP, ürün bildirimi kanalı ve destek kutusu farklı akışlardır.

**Yap:** İngilizce doğrulama/reset ve yeni hesap doğrulamasını izinli test hesabıyla dene. Ürün bildirim kanalının kendi SMTP/adapter, izin, kuyruk ve sonuç kayıtlarını doğrula; mevcut Auth ayarını bozma. Destek gönderme/alma için farklı sağlayıcı teslimatını doğrula. Gerçek velilere toplu test iletisi gönderme.

**Kabul:** TR/EN doğru konu/içerik, çalışan bağlantı, doğru gönderen/teslimat kanıtı; kullanılmış/süresi geçmiş bağlantıda anlaşılır hata. Ürün bildiriminde çift gönderim yok; geçici/kalıcı hata ve izin kaldırma davranışı testli. Test alıcısı/erişim eksikse yalnız o kabul dış engel olarak kalıyor. Sırları sohbete isteme.

### H05 — Arayüz açıklaması ve belge tutarlılığı

**Yap:** `subscription.tsx` içinde AI işlemleri için ayrıca onay istendiğini açıklayan kısa TR/EN metin ekle. Açık Rıza metnindeki fotoğraf saklama yer tutucusunu gerçek bağlı/bağsız dosya yaşam döngüsüyle eşitle; Gizlilik Politikası ve TR/EN tutarlı olsun. Hukuki rıza modeli veya sürelerin hukuken yeterliliğini kendin onaylama. Özel hukuk kopyalarının güncelleme ihtiyacını bildir; kimlik/adresi repoya taşıma.

**Kabul:** Telefon/tablette okunur, taşmayan açıklama; i18n anahtarları korunmuş. Bağlı dosya, bağlanmamış 24 saat, içe aktarmada kullanılmış bağsız son işten 7 gün ve depolama temizliği davranışı güncel kodla doğrulanmış. Uzman onayı bekleyen belgeler yayımlanmamış taslak kalıyor.

### H06 — Görsel/etkileşim kabul boşlukları

**Yap:** Ekran matrisindeki `groups` ve `question-media` pencereleri için sentetik ortak kaynak/görsel verisi kur; normal ve azaltılmış hareket ölçümlerini tamamla. H01–H05 değişen ekranlarını onaylı tasarımla karşılaştır. Kapanmış bütün tasarımları yeniden çizme; yeni somut kusura ID/kanıt ekle.

**Kabul:** 390×844 ve dar telefon, 768×1024/1280×800 tablet, yönetim masaüstü; taşma/örtüşme/klavye/güvenli alan sorunu yok. En az 48 dp hedef, anlamlı etiket ve anlaşılır birincil eylem. Reduced-motion açıkken ilgili animasyonlar kapalı. Web zoom/döndürme testi fiziksel Pencil/VoiceOver/TalkBack yerine yazılmıyor. C15 adımları cihaz/sürüm/beklenen sonuçla ayrı listeleniyor.

### H07 — Backoffice AI ön inceleme işletim hazırlığı

**Sınır:** Mevcut E01/C09 yazılımını tamamla/doğrula; kütüphane sorusu üretme, toplu inceleme veya yayın başlatma.

**Yap:** Kuyruk, worker yetkisi, zamanlama, sağlayıcı, kota, tekrar ve durdurma mekanizmasını kontrol et. Eksik işletim adımlarını hazırla. Üretimde özelliği açma/gerçek içerik işleme kararını ayrı tut; teknik hazırlığı izole/sentetik testle kanıtla.

**Kabul:** Aynı iş bir kez ücretleniyor; hatalı/AI sonucu insan onayı sayılmıyor; insan incelemesi ve yayın ayrı. Yetkisiz iş çalışmıyor, durdurma/hata izleme testli. Eksik sır/hesap adları kayıtlı, değerleri yok. Kapı kapalıysa “teknik hazırlık tamam, aktivasyon bekliyor”; “canlı tamam” değil.

### H08 — Regresyon, yayın ve teslim

**Yap:** Uygun core testleri, mobil typecheck/lint, backoffice typecheck/lint/build, ilgili Edge/SQL/pgTAP ve yarış/tekrar istek kontrollerini çalıştır. SQL için izole DB kullan. Yayın sırası migration → Edge → web/yönetim → imzalı mobil; eski istemci uyumluluğunu kaydet. Mevcut yetki içinde hazır düzeltmeleri yayımla; dış engelli özelliği sessizce açma. Yeni ücretli altyapı ve mağaza satış başvurusu ayrı karar kalır.

**Kabul:** Commit, migration, Edge/hosting sürümleri, iOS build/gönderim/TestFlight işleme/tester erişimi, tablet adresi/IPA hash ayrı doğrulanmış. Cihaz kurulmadıysa açık. H00–H07 kanıtlı kapalı veya somut dış engelli; kanıtsız tamam yok. Kullanıcıya değişenler, çalışan linkler, sürümler ve hesap sahibinin sıralı adımları veriliyor. Yayın **kütüphane veya 3B'yi beklemiyor**.

## 5. Dış kararlar ve kapsamı genişletmeyen işler

| Konu | Bu tur Claude'un sorumluluğu | Bekleyen taraf/kapı |
|---|---|---|
| C15 fiziksel cihaz | Test adımları, erişebildiğini doğrulama, gelen hatayı düzeltme | Cihaz/izin ve gerçek kullanıcı sonucu |
| Android/Firebase/Play/SMS | Mevcut durum, eksik kurulum, hazır hesapta izinli teknik kontrol | Hesap/sözleşme/ücret gereken adım |
| Ek AI sağlayıcıları | Adapter/test durumu ve eksik anahtar adını bildirme | Güvenli sağlayıcı kurulumu |
| Hukuk ve mağaza satışı | Kod/metin olgularını eşitleme, açık karar listesi | Hukuk uzmanı/hesap sahibi; rıza modeli |
| Barındırılan tam restore/PITR | İzole hedef, maliyet, veri erişimi ve kabul adımlarını hazırlama; üretimin üzerine restore yok | Ayrı ortam/maliyet/erişim; yapılmadıysa açık |
| Rubrik sonuç/süreç seçici; D11 K3/K4/K5 | Ertelenmiş ürün kararı olarak tutma | Yeni kapsam olmadan zorunlu işe dönüştürme |
| Kütüphane üretimi/onayı, X06 | **Claude kapsamı dışında; backoffice üzerinden yönetilecek** | Kullanıcının ayrı içerik operasyonu |
| WORLD-01 | **Claude kapsamı dışında** | Kullanıcı + Codex, ayrı çalışma |

## 6. Claude başlangıç promptu

> Güncel main'i yerel değişiklikleri koruyarak al. `docs/CLAUDE-REMAINING-WORK.md` dosyasındaki güncel H00–H08 kapsamını, öncelikleri ve kabul ölçütlerini uygula. Kapanış tablosunu, alan adı/e-posta STATUS kaydını, ekran matrisini, DECISIONS ve ilgili AGENTS dosyalarını oku. Eski listeler tarihsel kanıt; kapanmış işi tekrar yapma. H00'dan başlayıp bağımsız işleri yararlı alt ajanlara bölerek mevcut yetkiler içinde otonom ilerle; migration, merge ve yayını tek koordinatörde tut. Kod/test/yayın/kabul durumlarını kanıtla. Dış erişim veya cihaz bekleyen adımda bağımsız işe devam et; benden gereken somut adımı bildir. Onaylı tasarımı koru. Kütüphane içerik üretimi ve 3B dünya tamamen kapsam dışında; bunları başlatma veya düzeltme yayınını bunlara bağlama. MEB ve AI ön inceleme yönetim araçlarının yazılı işleri kapsamda, otomatik içerik yayını değil. Hazır düzeltmeleri mevcut yayın yetkisi ve kontroller çerçevesinde yayımla. Sonunda sürümleri, kanıtları, açık dış engelleri ve benim adımlarımı sun; doğrulamadığın işi tamamlandı sayma.
