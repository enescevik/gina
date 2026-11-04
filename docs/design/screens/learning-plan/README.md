# Ödev, çalışma ve kurs oturumu — 089000 kabulü

4 Kasım 2026. Mevcut takvim içinde, seçili çocuk adına bağlı bir bölüm. Onaylı mint/mor/krem, mevcut Nunito yazıları, ders ikonları ve SetupWizard kullanılır. Yeni ana menü veya yeni maskot yorumu yoktur.

## Davranış

- Veli üç adımda tür/başlık/ders/konu → gün/isteğe bağlı teslim/saat/küçük adımlar → son kontrol ile kaydeder. En fazla 12 adım; çocuk başına 100 açık plan. Çalışma gününe hızlı gün seçenekleri ve elle tarih düzenleme eşlik eder. Kaynakta olmayan teslim tarihi zorunlu kılınmaz.
- Ödev, ders çalışması ve tek kurs oturumu aynı kayıt türünün seçenekleridir. Tekrarlayan kurslar mevcut takvim etkinliklerinin tekrar kuralıyla eklenir; bu kayıt kendiliğinden etkinlik, günlük görev, onay veya yıldız yaratmaz.
- Aktif çocuk yalnız kendi planındaki adımları ve tamamlanma işaretini değiştirebilir. Başlık/tarih/adım tanımı/arşiv veliye aittir. İşaret kişisel takiptir, öğretmen değerlendirmesi diye sunulmaz.
- Devam eden iş teslim gününden sonra kaybolmaz veya her gün yeni örneğe dönüşmez. Tamamlanan/arşivlenen eski işler, o haftada yapılan işlem olarak geçmişte bulunabilir. Takvimde ders/etkinlik sayısı ile açık çalışma sayısı ayrı gösterilir.
- Veli son 30 kayıtlı özel belgeden birini bağlayabilir ve mevcut güvenli kaynak görüntüleme yoluyla açabilir. Bağlama AI çağrısı değildir; çocuğa dosya açma/metadata erişimi verilmez. Kaynak silinince plan korunur. **Belgeden yapılandırılmış ders/konu/tarih/adım çıkarımı bu artımda yoktur.**
- İstek gönderilmeden cihazda kullanıcı/aile/çocuk kapsamında saklanır. Kayıp yanıt veya yeniden açılma aynı istekle kurtarılır. Kesin ret ile belirsiz sonuç ayrılır. Oturum çıkışında komutlar silinir.
- 20 saniyelik sorgu güncel sürümü denetler. Başka cihazdaki değişiklik yazılmakta olan taslağı ezmez; açık yükleme eylemi taslağın bırakılacağını belirtir. Gün başka haftaya taşınsa da ayrı kayıt okuması güncel sürümü bulur. Bu, anlık realtime iddiası değildir.
- Telefon/tablet geçişinde takvim ağacı korunur; açık pencere ve taslak sıfırlanmaz. Yeni paket yoktur.

## Görsel ve işlev kanıtı

Gerçek Expo bileşenleri, yalnız sentetik API yanıtları; hiçbir aile kaydı değiştirilmedi. `qa-fixture.cjs` tekrar kullanılabilir test kaynağıdır. Bunlar çizilmiş maket veya fiziksel cihaz görüntüsü değildir.

| Kullanıcı | Telefon 390×844 | Tablet 1280×800 |
|---|---|---|
| Veli son kontrol | [Telefon](review-phone.png) | [Tablet](review-tablet.png) |
| Çocuk küçük adımları | [Telefon](child-phone.png) | [Tablet](child-tablet.png) |

- Oluşturma, üç küçük adım, isteğe bağlı teslim tarihi, önizleme geçti.
- Sunucuda kayıt sonrası yanıt kesildi; sayfa yeniden açıldı; aynı komut/kimlikle iki gönderim yalnız tek satır/revizyon oluşturdu.
- Veli yerel başlığı düzenlerken uzak sürüm değişti: yerel taslak korundu, güncel plan yalnız açık yükleme eylemiyle geldi.
- Çocuk tek adımı işaretleyip kaydetti; başlık/tarih korunurken bütün plan kendiliğinden tamamlanmadı. Veliye ait oluşturma düğmesi çocukta yoktur.
- Dikey/yatay geçişte açık adım korundu, yatay taşma yok. Uzun veli önizlemesi mevcut sihirbazın iç kaydırma alanını kullanır; kayıt düğmesi sabittir. Boş hata metninin View içinde ham metne dönüşmesi önlendi.

## Kontroller / sınırlar

58 yeni SQL; daha önceki 66 dosyadaki 1851 kontrol ile toplam **1909**. Dört gerçek eşzamanlılık testi: aynı istek, veli/çocuk, iki çocuğun aynı kayıt kimliğini kullanması, çocuk silme. Core **188** test (9 yeni); mobil/core tip, mobil lint ve ham native metin kontrolü geçti.

Yalnız `gina_completion_audit` ve silinen geçici klonlar kullanıldı. Gerçek aile ve demo kayıtlarına dokunulmadı. Üretim/Edge/TestFlight değişmedi. Fiziksel iPhone/iPad/Android, ekran okuyucu/klavye ve canlı kaynak kabulü açıktır. Belgeden AI çıkarımı, kütüphane kapsamı ve diğer yayın maddeleri devam eder.

Son kaynakla iOS/Android/web paket dışa aktarımı başarılı (`/tmp/gina-learning-plan-export`). Bu kontrol imzalı binary veya fiziksel cihaz kabulü değildir.
