# Canlı web yayını — 4 Kasım 2026

[GINA web](https://gina-web.pages.dev) Cloudflare Pages üzerinde doğrudan yüklendi.
491 dosya, üretim dalı `main`, dağıtım kimliği `f84ba5b6-d0d4-4bcb-a88e-3afbd5d69e59`.
Derleme ürün kaynağı `3b661c8`; sonraki #131 yalnız test/kayıt ekler.
Bu, backoffice veya yeni TestFlight yayını değildir.

## Gerçek tarayıcı kontrolleri

- Beş temel yol 200 döndü; CSP ve nosniff başlıkları mevcut. İlk Python/urllib isteği hata verdi; gerçek tarayıcı isteği ve curl ile yayımlanan adres doğrulandı.
- Açık kullanıcı onayıyla iki **kesin** dönüş adresi Supabase'e eklendi: `/auth-callback` ve `/reset-password`. Mobil/Expo dört eski adres ve mevcut varsayılan Site URL korundu. Joker alan adı açılmadı.
- Geçici sentetik aileyle gerçek parola girişi, tek çocukta Tümü seçicisinin olmaması, etkinlik kaydı ve yeniden yüklemede korunması geçti.
- Çocuk modu ebeveyn PIN'i yokken koruma kurulmasını istedi. Deneme PIN'i API fixture'ında tanımlandı; UI üzerinden çocuk girişi ve ebeveyn PIN'iyle çıkış denendi.
- Çocuk görev gönderdi → veli onayladı → çocuk alanına dönüşte **yenilemeden** tamamlandı/2 yıldız göründü. Hedef seçimi oda kartına yansıdı. Bu aynı tarayıcıdaki çocuk modudur; iki fiziksel cihazlı Realtime kabulü değildir.
- Telefon/tablette ekranlar ve taşma kontrol edildi. `verification.json` içindeki diğer sayfalar ziyaret edildi; her kontrolünün kullanıldığı iddia edilmez. Prova'nın kaydedilmemiş taslak uyarısı beklenen şekilde çıktı.
- Cihaz kimliği olmadan doğrudan açılan cihaz ayarı boş kalıyordu. Bu PR mevcut ortak görsel dille açıklama ve bağlı cihazlara dönüş ekler; geçersiz kimlik sorgulanmaz. İlk yayımlanmış pakette bu düzeltme henüz yoktur.

Görseller yalnız sentetik aileye aittir. Navigasyon sonrası ilk çocuk ekranı görüntüsü
geçiş sırasında boştu; gerçek başlık ve görev durumu beklendikten sonra tekrar alındı
ve görsel olarak incelendi. Boş kare kabul kanıtı olarak bırakılmadı.

## Açık yayın sınırı

Cloudflare hesabı açık ve alan adı listesi boş olarak görüldü. Backoffice Access için
Zero Trust Free seçildi; **$0/ay, 50 kullanıcı** ekranı hesap sahibi ödeme yöntemi ve
fatura bilgisi istiyor. Bu işlem tamamlanmadı; yönetim paneli korumasız yayımlanmadı.
GitHub CI yayın sırları eklenmedi; mevcut web yüklemesi otomatik CI yayını değildir.
Son TestFlight hâlâ **0.1.0 (17)**.

Google/Apple tam hesap dönüşü, e-posta teslimi, gerçek mağaza ve fiziksel bildirim
kabulü ayrıca yapılmalıdır. Kaynakların tamamlanma kaydı
[ana rehberde](../RELEASE-COMPLETION-2026-11-04.md) tutulur.
