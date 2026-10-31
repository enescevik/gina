# Son yayın denetimi · v5

31 Ekim 2026. Üretim web export'u üzerinde izole fixtures. HTTP/Supabase ve realtime yakalanır; demo veritabanına yazılmaz. Veli/günlük/Prova/hesap: 320×844 dar telefon, koyu işletim sistemi tercihi, hareketi azalt açık. Çocuk: 390×844 ve 1280×800, aynı erişilebilirlik tercihleri. Bunlar fiziksel cihaz kanıtı değildir.

`*-capture.js` düzen/görsel kontrollerini, `flows.js` çocuk silme onayı, PIN filtreleme ve AI sonrası puan alanının güncellenmesini kontrol eder. Sonuç JSON'ları ve ekran görüntüleri aynı klasördedir. V5 açık paleti koyu OS tercihinde de korunur; mevcut yıldız animasyonları reduced-motion ve görünürlük kurallarına uyar. Doğal pet animasyonu bu kanıtın kapsamında yoktur.

Ayrı kanıtlar: çocuk kilidi/tercih kaydı (PR22), veli formları (PR23/24), çocuk Prova kaydı/süre sonu (PR25), hesap/şifre kurtarma (PR26). Son native iOS/Android/web export'u JavaScript ve asset paketlemesini doğrular; imzalı IPA ve cihaz performansını doğrulamaz.

## Doğrulama kapsamı

- 37 ekran/boyut örneği: çocukta 10 telefon/tablet, veli günlükte 8, veli Prova'da 10, hesapta 9. Eksik görsel, yatay taşma ve kontrol edilen veli/hesap bağlantılarında 48 dp altı hedef bulunmadı.
- `flows-qa.json`: 10 davranış kontrolü. İstekler fixtures ile karşılanır; gerçek e-posta, ödeme ve cihaz testi değildir.
- `fonts.js`: font isteklerini bekletir; ilk içerik hazır olmadan düğmelerin gösterilmemesini ve Chromium'un gerçekten Nunito gliflerini kullandığını doğrular. Sadece CSS font adını okumak yeterli sayılmaz.
- Son dar ekran incelemesinde veli görev sayısının kırpılması da düzeltildi; onay sayısı o günün görevleriyle kesiştirilir.

Font başlangıcı kontrolü için Expo 58'in [font yükleyicisi](https://docs.expo.dev/versions/v58.0.0/sdk/font/) ve tarayıcının [FontFaceSet.load](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load) sözleşmesi kullanıldı. Native yükleyici değiştirilmedi.
