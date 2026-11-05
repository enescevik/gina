# Çocuk iPad'i kablosuz kurulum — 0.1.0 (27)

6 Kasım 2026 (gece, R01). TestFlight 27 ile aynı uygulama kodundan yerel EAS `tablet` (Ad Hoc) paketi. Store IPA yeniden etiketlenmedi; bulut build kaydı taklit edilmedi.

## Kullanıcı adımı

iPad'de Safari ile [kurulum sayfasını aç](https://gina-aile-enescevik--tablet.expo.app/?v=27), **0.1.0 (27)** yazdığını kontrol et, **Yükle / Güncelle** düğmesine dokun ve iOS kurulum onayını ver. Mevcut GINA silinmez; TestFlight veya Apple hesabı gerekmez.

## Doğrulama

- IPA `com.enescevik.gina` 0.1.0 (27); codesign geçerli; `get-task-allow` kapalı; iPhone+iPad aileleri; üretim Supabase adresi pakette doğrulandı. SHA-256 `12cb54eedfe6e7b3a1d060a10078819ae8a0012367274946ea310fd381d0eeb0`, 61077472 bayt.
- Gömülü Ad Hoc profilinde önceki paketle **aynı tek kayıtlı cihaz**; yeni cihaz eklenmedi; UDID yazılmadı. Profil bitişi 31 Ekim 2027.
- Önce önizleme dağıtımına (`7hteqzifmy`) yüklendi; indirilen IPA hash'i yerel paketle aynı; manifest ve sayfa 27. Sonra yalnız `tablet` alias'ı bu dağıtıma bağlandı (`--prod` kullanılmadı). Canlı alias'tan tekrar indirilen IPA hash'i, `manifest-27.plist` ve `release.json` doğrulandı. Önceki dağıtım `sbfnt5ls4x` ve kaydı korunuyor (`previous-release.json`).
- Store ve tablet paketleri aynı uygulama kodundan ayrı derlemelerdir; aralarındaki commit farkı yalnız `docs/`. Byte düzeyinde aynı JS iddia edilmez.

**Sınır:** Fiziksel iPad'de kurulum/açılış bu turda yapılmadı; iOS kurulum onayı kullanıcıda. TestFlight 27 gönderimi ayrı izlenir.
