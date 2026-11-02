# Veli çözüm incelemesi — TestFlight 16

**0.1.0 (16), TestFlight iç testte hazır.** Apple durumu `VALID / IN_BETA_TESTING`, süresi dolmamış olarak doğrulandı. Paket doğrulaması ve yüklemesi hatasız geçti. [Yayın kaydı](testflight-16-status.json).

- Mobil kaynak: `86c819dccdd2cd23db713163805d97defe8ff49f` (PR #51).
- EAS build: `43136ef5-bb94-4097-9a04-0f9624373dbe`.
- Sonraki değişiklikler yalnız sunucuda: sağlayıcı şema uyumluluğu (#52), boş geri bildirim/defter görünürlüğü (#53). Mobil paketle uyumludur.
- Üretim migration'ları `20261102203000_review_feedback_visibility` dahil uygulandı. `prova-review` WASM/font dosyalarıyla Docker üzerinden dağıtıldı; `prova-grade` güncellendi.
- `sources.enabled`, `question_groups.enabled`, `review_ai.enabled` başarılı canlı kontrol sonrası beta için açıldı. `cohorts.enabled` değiştirilmedi.

## Telefonda deneme

1. TestFlight → **GINA Aile** → **0.1.0 (16)** sürümünü yükle. Açık eski uygulamayı kapatıp yeniden aç.
2. Veli alanında Prova'dan tamamlanmış bir denemenin sonucunu aç; **Çözümleri incele** seçeneğine gir.
3. **Çözüm** sekmesinde kalem veya Not ile işaret ekle. Göz simgesi yalnız senin notlarını gizlemeli; çocuğun cevabı değişmemeli. Silgi, geri al/yinele işlemlerini dene.
4. **Değerlendirme** sekmesinde 0–100 puan ve geri bildirim gir. **Kaydet ve sonraki** ile ilerle; soru numarasından geri dönüp kaydı kontrol et. Çoktan seçmeli cevabın otomatik doğru/yanlış sonucu korunur.
5. Paketinde AI değerlendirmesi varsa **AI önerisi al** seçeneğini aç. Paylaşım onayını kendin işaretle. Sonuç geldiğinde mevcut puan değişmemeli. **Taslağa al** öneriyi düzenlenebilir alanlara taşır; ancak **Kaydet** ile çocuğa yayımlanır.
6. Çocuk modunda aynı Prova sonucuna dön; **Geri bildirimi göster** ile kaydedilmiş veli notlarını ve mesajını aç. Açık ekranda yeni geri bildirim en geç sonraki 30 saniyelik yenilemede alınır; ağı kesikse bu süre garanti değildir.

## Tablette deneme

Tableti yatay kullan. Sol bölümde soru/değerlendirme, sağda geniş defter olmalı. Genişlet düğmesi sol paneli kapatıp defteri büyütmeli; geri dönünce taslak korunmalı. İki panel ayrı kayar. Soru değiştirme veya özete dönme sırasında kaydedilmemiş değişiklik varsa uyarı çıkmalı.

Bu sürüm önceki ortak kaynaklı soru hazırlama akışını da içerir: tek metin/görselden birden çok soru hazırlayabilir, taslağı kontrol edip kaydedebilir ve çocuklara atayabilirsin. Atanmış kaynaklar sonradan sessizce değişmez; düzenleme yeni sürüm oluşturur.

## Kanıt ve sınırlar

- [Tablet](../design/screens/prova-parent-review/tablet-implemented-web.png), [telefon çözüm](../design/screens/prova-parent-review/phone-solution-web.png), [telefon değerlendirme](../design/screens/prova-parent-review/phone-assessment-web.png).
- [UI kontrol kaydı](../design/screens/prova-parent-review/implementation-review.json).
- [Gerçek AI hizmet kontrolü](../design/screens/prova-parent-review/production-service-check.json): sentetik yanlış cevap görselinden 35 puan önerisi, değişmeyen veli puanı/orijinal cevap, tek ücretli iş ve tekrar kullanım doğrulandı. Test hesabı/aile/dosya kaldırıldı; gerçek aile içeriği bu kontrolde paylaşılmadı.
- Workspace lint/typecheck/test (44 core testi), 7 yayın/native metin testi, 69 Edge testi ve CI pgTAP kontrolleri başarılı. İlk bütün DB koşusunda 684, son iki görünürlük kontrolüyle toplam 686 test bulunur.
- Görüntüler çalışan Expo web arayüzünden ve sentetik veriden alındı; fiziksel iPhone/iPad ekran görüntüsü değildir. iOS Hermes export, EAS derlemesi ve Apple paket doğrulaması geçti. Gerçek cihaz kalem gecikmesi, basınç/eğim/avuç içi reddi ayrıca denenmeli.
- Kalıcı çevrimdışı taslak yoktur. Kaydedilmemiş düzenlemede uygulamayı zorla kapatmak notu kaybettirebilir. Belirsiz kayıt yanıtında aynı isteği yeniden deneme gerekir; ekrandaki uyarı bu adımı gösterir.
- AI sonucu veliye öneridir; okunamayan/boş cevap için tahminî sıfır yazılmaz. Mevcut toplu AI yolu çizimli cevapları otomatik puanlamaz; yeni inceleme ekranından ilerlenir.

Mağaza yayını bu teslimin sonucu değildir. Bu kayıt yalnız belirtilen TestFlight sürümü ve inceleme akışının doğrulamalarını kapsar.

## Çocuk iPad’i için kablosuz kurulum

TestFlight kullanamayan kayıtlı çocuk iPad’i için ayrı dağıtım sohbeti, aynı `86c819d` kaynağından INTERNAL build `1aca834a-742c-472f-9928-0e00b4f04455` hazırlıyor. Bu sohbet ikinci bir tablet derlemesi başlatmadı. Kurulum bağlantısının yayını ve cihaz imza doğrulaması o sohbet tarafından tamamlanacak; bu kayıt iPad kurulumunun tamamlandığını iddia etmez.

Sonraki sürümler için [kablosuz dağıtım akışı](TABLET-KABLOSUZ-DAGITIM.md), `tablet` EAS profili ve `prepare-tablet-install.mjs` aynı repoya alındı. Sayfa üreticisi farklı commit/sürüm, eski build, yanlış uygulama ve simulator paketini reddeder. Ana web yayınına `--prod` ile dokunulmaz.
