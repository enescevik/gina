# Codex bağımsız canlı kabul — 7 Kasım 2026

İncelenen main: `d582bde6eafd3a1d4d3f61f389c6b9f909b41fe5`. Kontroller 6 Kasım 22:12–22:25 UTC / 7 Kasım 01:12–01:25 TR. H00–H08 kabul işlemleridir; ayrı Prova thread'ine, kütüphane üretimine ve 3B dünyaya müdahale edilmedi. Yerel değişiklikler korunarak ayrı worktree kullanıldı.

## Tamamlananlar

| Kalem | Bağımsız gözlem / işlem | Kabul sınırı |
|---|---|---|
| Son main CI / güvenlik | [CI](https://github.com/enescevik/gina/actions/runs/42302589849), [Security](https://github.com/enescevik/gina/actions/runs/42302590041): success, aynı `d582bde6` | Cihaz testi değildir |
| TestFlight 32 | Açık gerçek App Store Connect oturumunda build 32, Team (Expo), 2 tester; iki testçide de **Installed 0.1.0 (32), Nov 7 2026** görüldü. iPhone 14 Pro Max ve iPad testçi satırları mevcut | İşleme/grup erişimi/kurulum doğrulandı. C15 işlev kabulü değildir. Genel build sayfasındaki Ready to Submit dış beta incelemesi alanıdır; iç test kurulumunu engellemediği tester kayıtlarıyla görüldü |
| H02 gerçek yönetici akışı | `admin.ginafamily.com/library?tab=curriculum` üzerinde mevcut yetkili oturumla İlk indirme → resmî dizin → İlköğretim Matematik → indir → Adayları çıkar. **36 yeni taslak, 0 yayımlı**, extraction done, 1 attempt. Tekrar indirme aynı sürümü döndürdü, yeni sürüm oluşturmadı | Kaynak/senaryo onayı verilmedi. Genel katalog kapalı. Soru üretimi / ücretli AI yok |
| Resmî kaynak hash | Sunucu kaydı ve resmî EBA dosyasından bağımsız indirilen 23.454 bayt SHA-256 aynı: `d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf` | İçerik pedagojik onayı değildir |
| H01 Apple sunucu kurulumu | Daha önce onaylanarak oluşturulmuş GINA Sign In anahtarı kullanıldı. Apple team/key/client ID'leri, mevcut özel anahtar, yeni 32 bayt AES şifreleme anahtarı ve işçi sırrı Edge'e; eşleşen işçi sırrı Vault'a kaydedildi. Var olan şifreleme anahtarı döndürülmedi | Sırlar depoya/yazışmaya yazılmadı. Yeni Apple yetkisi/anahtarı oluşturulmadı |
| Apple işçisi kontrolü | Kimliksiz POST **403**; işçi sırrıyla POST **200**, ok=true, processed=0. Edge sırları ve Vault adı var | İş yokken 200 gerçek Apple token iptali kanıtı değildir. Gerçek test hesabıyla Apple girişi/silme açık |
| H04 İngilizce e-posta teslimi | Kullanıcının Gmail plus-alias'ında yeni EN test hesabı: confirm ve reset HTTP200. İki e-posta da **INBOX**; doğru İngilizce konu/gövde ve `GINA <noreply@ginafamily.com>`; **SPF/DKIM/DMARC pass** | Yalnız Gmail teslimi. Reset bağlantısıyla yeni parola belirleme veya başka sağlayıcı kabulü değildir. Test hesabı API'den doğrulandığı için bağlantıyla doğrulama iddiası yok |
| Test hesabı temizliği | E-posta test hesabı silindi, ardından kullanıcı sorgusu 404 | Gerçek veli hesabına/parolasına dokunulmadı |
| H01 şifreli hesap canlı regresyonu | Ayrı sentetik hesap+aile: yanlış parola 403 ve hesap kalıyor; doğru parola 200; kullanıcı 404, üyelik yok; yanlış Apple iptal iddiası yok. **7/7** | Yalnız sentetik kayıtlar oluşturulup silindi |
| Süresi dolmuş bağlantı | Canlı web, `otp_expired`: “This link has expired or was already used” + Request a new link + e-posta formu | Apple/Google gerçek giriş testinin yerine geçmez |
| Canlı sağlık | Web başlıkları, Access koruması, anonim REST erişim sınırı, Auth, etkin Edge fonksiyonları ve tablet32: geçti. Ledger **161**, son `20261107010000` (başka hattın AI katalog/quota migration'ı; bu tur migration uygulanmadı) | Sağlık endpoint'i bütün işlevlerin kabulü değildir |
| Ön inceleme / cron | Ön inceleme açık, alerts=[]; 24 saatte 1 çağrı. 13 cron etkin, son 3 saatte çalışmış işlerde başarısızlık 0 | Günlük işlerden bazıları 3 saatlik pencerede **hiç çalışmamış**. “Hepsi son 3 saatte başarılı çalıştı” ifadesi doğru değil; sıradaki zamanları gelmemiş olabilir |

## Kanıt dosyaları

- `health.json`, `server-readiness.json`: bağımsız canlı salt okunur sağlık ve sunucu özeti.
- `meb-acceptance.json`: gerçek yönetici akışından sonra SQL sayıları + resmî dosya hash eşleşmesi.
- `apple-provisioning.json`: yalnız sır adları ve işçi HTTP sonuçları; sır değerleri yok.
- `email-trigger.json`, `email-delivery.json`, `email-cleanup.json`: teslim sınırı, Gmail metadata ve temizlik.
- `password-delete-smoke.json`: yeni bağımsız sentetik silme testi.
- Tarayıcı ekran görüntüleri bu kontrolün yerel worktree'sinde tutuldu; testçi e-posta adreslerini gereksiz yere Git'e taşımamak için yayımlanmadı.

Önceki `h08-2026-11-06/live-smoke.json` referansı main'de gerçek bir dosyaya gitmiyordu (yalnız betik var). Önceki koşunun kanıtı varmış gibi sayılmadı; yukarıdaki yeni bağımsız test ve kayıtları onun yerine doğrulama sağlıyor.

## Gerçekten açık kalanlar ve sorumlu

1. **Ürün bildirim e-postası — kullanıcıdan tek erişim onayı, teknik kurulumu ajan yapar.** Brevo'da yalnız `GINA Supabase SMTP`, `GINA Gmail SMTP` ve başka ürün anahtarları var; GINA ürün kanalı için ayrı anahtar yok. `GINA product channel` / Standard / 1 yıl anahtarı oluşturma formu hazır. Yeni SMTP gönderim yetkisi oluşturma için tarayıcı kuralı gereği açık onay alınmadan Generate basılmadı. Anahtar mevcut hesap/diğer ürün anahtarlarının yerine kullanılmayacak. Onaydan sonra yalnız GINA Edge sırlarına kaydet; Brevo gönderen/alan adı doğrulamasını kontrol et; önce sahibiyle sınırlı test, ardından izin modeliyle ürün kanalı. Gerçek velilere test duyurusu gönderme. `channels.email.provider` hâlâ kapalı.
2. **C15 — kullanıcı fiziksel iPhone/iPad.** 32 zaten iki testçide kurulu; yeniden yükleme isteme. Kalem, yön değiştirme, VoiceOver, büyük yazı, push, Google/Apple dönüşü, defter/PDF için `../h06-2026-11-06/C15-DEVICE-CHECKLIST.md` adımlarını mevcut 32'de uygula. Eski B30/B31 etiketleri test matrisinin tarihidir; son sürümde koş.
3. **Gerçek Apple iptali — kullanıcı yalnız disposable Apple test hesabında; sunucu sonucunu ajan doğrular.** Kurulum artık eksik değil. Yeni sürümde Apple ile yeniden giriş → test hesabının silme akışı → Ayarlar / Apple ile Giriş'te kontrol. Gerçek aile/ana hesabı silme. Başarı için iş `succeeded` ve Apple erişimi iptal edilmiş olmalı; pending/manual_required başarı sayılmaz.
4. **Başka e-posta sağlayıcısı / bağlantı akışı — erişilen test gelen kutusu veya kullanıcı sonucu.** Gmail EN teslim kabulü kapandı; iCloud/Outlook vb. sahibi olunan test adresi ve gelen kutusu erişimi gerekir. Başkasının adresini test için kullanma. PKCE parola sıfırlamayı uygulamanın “Şifremi unuttum” akışından başlat; bu tur yalnız teslim testi yapıldı.
5. **H03 yeni pilot — ayrı tek çağrılık pilot kararı ve insan içerik onayı.** Paket betiği hazır; bu tur kütüphane/pilot sorusu üretilmedi veya yayımlanmadı. İnsan uygunluk onayı ajan testi yerine geçmez.
6. **Tam restore/PITR — ayrı ortam ve maliyet kararı.** Kullanıcı hedef/maliyet sınırını seçer; kurulum ve uygulamayı ajan yapabilir. Üretim üzerine restore yapılmaz.
7. **Hukuk/mağaza kararı — kullanıcı ve hukuk uzmanı.** Teknik test bu onayın yerine geçmez.

### SMTP için mevcut teknik sınırlama

H04 raporunda açıklanan, SMTP sağlayıcı kabulünden sonra DB makbuzunun üç denemede de yazılamadığı kesintide ikinci gönderim riski sürer. Bu rapor SMTP'yi exactly-once ilan etmez. Kanal açılırken bu sınırlama işletim kaydında korunmalı; ayrı arızaya dayanıklılık iyileştirmesinde kapatılmalıdır.

## Koordinasyon

Bu tur uygulama kodu, yeni Prova türleri veya istemci derlemesi yayımlanmadı. Canlı değişiklikler yalnız H02'nin inceleme bekleyen resmî kaynak/taslak kayıtları, H01'in eksik sır kurulumu ve tamamen temizlenen sentetik kabul hesaplarıdır. H00–H08 geliştirme teslimi ile bu açık kullanım kabulü ve Prova thread'i ayrı tutulur.
