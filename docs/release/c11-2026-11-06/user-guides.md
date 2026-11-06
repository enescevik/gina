# C11 — kullanıcı rehberleri (X01 alan adı/SMTP, X02/X03 mağaza sandbox ve Play testi, X03 hukuk)

6 Kasım 2026. Bu adımları **yalnız hesap sahibi (Enes)** yapabilir: hesap oturumu, sözleşme kabulü, ödeme profili, gerçek alan adı satın alma, gizli anahtar üretimi. Claude bu adımların hiçbirini yapmadı; teknik hazırlık (kod, testler, sahte yüklerle zincir doğrulaması) bu dalda tamamlandı. **Hiçbir gizli değeri sohbete, Git'e veya rapora yazma**; anahtarlar yalnız `supabase secrets set` ve Vault'a girer.

Biçim: **hizmet → sayfa → adım → başarı işareti**. Bir adımın başarı işareti görünmezse sonraki adıma geçme; ekranda gördüğün hata metnini (gizli değer olmadan) ilet.

---

## X01 — alan adı, gönderici ve SMTP (giriş e-postaları + bildirim kanalı)

Önkoşul kararı (DECISIONS.md): alan adı Enes'te satın alınır (öneri `ginaaile.app`), DNS Cloudflare'da, gönderici Resend. Uygulamada e-posta kanalı kodu hazır (`supabase/functions/_shared/channels/email.ts`, Resend ve SMTP), sağlayıcı bağlı değil.

| # | Hizmet → sayfa | Adım | Başarı işareti |
|---|---|---|---|
| 1 | Alan adı kayıt firması (ör. Cloudflare Registrar) → Register domain | `ginaaile.app` (veya seçtiğin ad) satın al. | Hesabında alan adı "Active". |
| 2 | Cloudflare → Websites → Add a site | Alan adını ekle; kayıt firması başka ise nameserver'ları Cloudflare'ın verdiği iki adrese çevir. | Cloudflare'da durum **Active** (yayılma 1–24 saat). |
| 3 | Resend → Domains → Add Domain | Gönderim için alt alan kullan: `mail.ginaaile.app` (bölge: EU). | Resend size SPF (TXT), DKIM (TXT/CNAME) ve MX kayıtlarını listeler. |
| 4 | Cloudflare → alan adı → DNS → Records | Resend'in verdiği her kaydı **birebir** ekle (proxy kapalı, "DNS only"). Ayrıca `_dmarc.ginaaile.app` TXT: `v=DMARC1; p=none; rua=mailto:<destek adresin>`. | Resend → Domains'de durum **Verified** (SPF+DKIM yeşil). |
| 5 | Resend → API Keys → Create | Ad: `gina-supabase-smtp`, izin: **Sending access**, alan: `mail.ginaaile.app`. Anahtarı yalnız bir kez görürsün; hiçbir yere yapıştırma, doğrudan adım 6'ya gir. | Anahtar listede görünür. |
| 6 | Supabase Dashboard → Project Settings → Authentication → SMTP Settings | Enable custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = adım 5'teki anahtar, sender `Gina <giris@mail.ginaaile.app>`. | "Saved"; Authentication → Rate limits'te e-posta limiti artık özelleştirilebilir. |
| 7 | Supabase → Authentication → URL Configuration | Site URL: `https://app.ginaaile.app`; Redirect URLs: `https://app.ginaaile.app/**`, `gina://**` (mobil şema `gina`), `https://admin.ginaaile.app/**`. | Liste kaydedildi. |
| 8 | Supabase → Authentication → Providers → Email | **Confirm email** aç (DECISIONS: alan adı gelince açılır). Secure email change açık. | Ayar kaydedildi. |
| 9 | Cloudflare → Pages → `gina-web` / `gina-backoffice` → Custom domains | `app.ginaaile.app` → gina-web, `admin.ginaaile.app` → gina-backoffice (DEPLOY.md). Zero Trust → Access uygulamasına `admin.ginaaile.app` alanını da ekle. | Her iki alan "Active", admin alanı Access girişine yönlendiriyor. |
| 10 | Telefonda Gina → Kayıt ol | Kendi ikinci e-posta adresinle yeni hesap aç (gerçek veli verisi değil). | **Gerçek posta kutusuna** doğrulama e-postası gelir, gönderen `giris@mail.ginaaile.app`, bağlantı uygulamayı/`app.ginaaile.app`'i açar ve hesap doğrulanır. "Gönderildi" ekranı tek başına kanıt değildir. |
| 11 | Gina → Şifremi unuttum | Aynı hesapla sıfırlama iste; bağlantıyı iki kez aç. | İlk açılış şifre değiştirir; ikinci açılış "bağlantı kullanıldı/süresi doldu" der. Spam klasörüne düşmediğini not et. |
| 12 | (Kanal) Supabase → Edge Functions → Secrets | Bildirim e-postası için ayrı Resend anahtarı (`RESEND_API_KEY`) ve `CHANNEL_UNSUBSCRIBE_URL`, `CHANNEL_CONFIRM_URL` adlarını gir; değerleri C10 raporundaki tabloya göre. Kanal açma kararı C10/X02 kapsamındadır. | `channel_readiness()` e-posta için `sender_domain_unverified` artık dönmez. |

**Kapanış kanıtı (X01):** adım 10–11'deki gerçek e-postaların gönderen/alan/zaman bilgisi ve doğru dönüş (ekran görüntüsü; e-posta adresini karartarak).

---

## X02/X03 — App Store sandbox ve Google Play lisans testi (S03)

Sunucu zinciri bu dalda sahte yüklerle yeniden doğrulandı (Deno 107/107; pgTAP 117 mağaza bölümü). Gerçek mağaza kabulü aşağıdaki adımlarla ve **yalnız test hesaplarıyla** yapılır; gerçek kullanıcıdan ücret alınmaz. Kurulum ayrıntısı `docs/IAP.md` (ürün kimlikleri, secrets, Vault, RTDN). Önkoşul: hukuk URL'leri yayında ve `EXPO_PUBLIC_LEGAL_BASE_URL` build'de; yoksa uygulama satın almayı **kapalı** tutar (doğru davranış).

### A. Hazırlık (bir kez)

| # | Hizmet → sayfa | Adım | Başarı işareti |
|---|---|---|---|
| A1 | App Store Connect → Business (Agreements, Tax, and Banking) | Paid Apps sözleşmesi, banka, vergi formları. | Durum **Active**. Bu olmadan sandbox'ta ürün gelmez. |
| A2 | App Store Connect → Uygulama → Subscriptions | "Gina Aile" grubu ve 4 ürün (`gina_plus_monthly`, `gina_plus_yearly`, `gina_pro_monthly`, `gina_pro_yearly`), fiyatlar ve 7 gün deneme (IAP.md tablosu). **Pro "7 günlük ipucu" yazma** (6 Kasım kararı: Pro = haftalık özet + fotoğraftan takvim 20/ay). | Ürünler "Ready to Submit". |
| A3 | App Store Connect → App Information → App Store Server Notifications | Production + Sandbox URL: `https://<proje>.supabase.co/functions/v1/apple-notifications`, Version 2. | "Send Test Notification" sonrası `store_notifications`'ta yeni satır (Supabase → Table editor). |
| A4 | App Store Connect → Users and Access → Integrations → In-App Purchase | Anahtar oluştur; Key ID, Issuer ID, `.p8` → `supabase secrets set APPLE_IAP_KEY_ID=… APPLE_IAP_ISSUER_ID=… APPLE_IAP_KEY_P8=…` (değerleri terminalde gir). | `supabase secrets list` üç adı gösterir. |
| A5 | App Store Connect → Users and Access → Sandbox → Test Accounts | Yeni sandbox Apple hesabı (gerçek Apple Kimliğin değil). iPhone → Ayarlar → App Store → Sandbox Hesabı ile giriş. | Ayarlar'da sandbox hesabı görünür. |
| A6 | Play Console → Ayarlar → Ödeme profili; Monetize → Subscriptions | `gina_plus`, `gina_pro`; base plan `monthly`/`yearly`; offer `trial7` (IAP.md). | Ürünler **Active**. |
| A7 | Google Cloud (FCM ile aynı proje) → IAM → Service accounts | Play Developer API'yi etkinleştir, service account + JSON anahtar; Play Console → Users and permissions'ta davet, "View financial data" + "Manage orders and subscriptions". JSON'u `supabase secrets set GOOGLE_PLAY_SA_KEY=…` ile gir. | İzin etkinleşince (≤24 saat) `iap-verify` Android'de `store_not_configured` dönmez. |
| A8 | Google Cloud → Pub/Sub | Topic `play-rtdn`; `google-play-developer-notifications@system.gserviceaccount.com`'a Publisher; push subscription → `…/functions/v1/google-rtdn`, Enable authentication, audience = endpoint URL. `GOOGLE_RTDN_AUDIENCE`, `GOOGLE_RTDN_SA_EMAIL` secrets. | Play Console → Monetization setup → RTDN → "Send test notification" → `store_notifications`'ta `test` olayı, 200. |
| A9 | Play Console → Settings → License testing | Test Google hesabını ekle; Internal testing kanalına aynı hesabı tester yap, AAB yükle. | Test cihazında Play ödeme sayfası "Test card, always approves" seçeneği gösterir. |
| A10 | Supabase SQL editor | `select jobname from cron.job where jobname='iap-reconcile';` ve Vault'ta `project_url`, `iap_cron_secret`. | Bir satır; 6 saat içinde `net._http_response`'ta 200. |

### B. Senaryolar (her biri sentetik test ailesinde)

Her senaryodan sonra kontrol: uygulamada Abonelik ekranındaki paket + Supabase SQL `select plan,source,expires_at from public.get_family_entitlement('<aile id>')` (servis rolüyle SQL editor'da) ve `store_subscriptions` satırının `status`, `last_source`, `acknowledged_at`.

| # | Platform | Adım | Başarı işareti |
|---|---|---|---|
| B1 | iOS | Abonelik → Plus aylık → sandbox hesabıyla satın al. | Uygulama "Plus" gösterir; satır `status=active`, `source=store`. İkinci cihazda (aynı aile, farklı veli) paket birkaç saniyede Plus. |
| B2 | iOS | Sandbox'ta yenileme hızlıdır (aylık ≈ 5 dk). 10 dk bekle. | `apple-notifications` DID_RENEW olayı `processed_at` dolu; `expires_at` ileri gitti; tek satır. |
| B3 | iOS | Pro aylığa yükselt. | Hemen Pro; aynı `store_key` (originalTransactionId) satırı, ürün `gina_pro_monthly`. |
| B4 | iOS | Uygulamayı sil, yeniden kur, aynı aile hesabıyla gir → "Satın alımları geri yükle". | Aynı satır, yeni satır **yok**; paket korunur. |
| B5 | iOS | Başka bir test ailesiyle giriş yap, aynı sandbox Apple hesabıyla "geri yükle". | `409 account_mismatch`; ikinci aile **ücretsiz** kalır; `audit_log`'da `store_subscription.account_mismatch` (ham anahtar yok). |
| B6 | iOS | Ayarlar → Sandbox hesabı → Abonelikleri yönet → İptal. | `auto_renewing=false`, dönem sonuna kadar Pro sürer; sonra `expired` ve ücretsiz. İptal ≠ iade. |
| B7 | iOS (iade) | App Store Connect sandbox'ta iade testi (Xcode/TestFlight "Request a refund" veya sandbox REFUND test bildirimi). | `status=revoked`, aile hakkı **hemen** kalkar; sonradan gelen eski yenileme hakkı geri açmaz. |
| B8 | Android | Internal testing build → Plus aylık → test kartı. | Play Console → Order management'ta sipariş **Acknowledged**; satır `acknowledged_at` dolu. |
| B9 | Android | Plus → Pro geçişi. | Yeni token Pro aktif, eski token `expired`; ailede tek aktif hak. |
| B10 | Android | Play Store → Abonelikler → İptal; sonra "Test kartı, reddet" ile yenileme hatası (account hold). | İptal: dönem sonuna kadar hak; hold: `on_hold`, hak yok. |
| B11 | Android | Play Console → Order management → Refund + Revoke. | RTDN `SUBSCRIPTION_REVOKED` → `revoked`, hak hemen kalkar. |
| B12 | Her ikisi | Yönetim → Faturalama → aile → "Mağazadan kontrol et". | Makbuz `store_check`; operatör işlemi **iade değildir**, mağaza satırını iade gibi değiştirmez. |
| B13 | Her ikisi | Uygulamada paket seçip mağaza sayfasında **iptal et** (ödeme yapma). | Hiçbir hak yazılmaz; paket ücretsiz kalır (istemci seçimi hak üretmez — bu dalda pgTAP 117 §8 ve Deno `c11-client-selection` ile sahte yüklerle kanıtlandı). |

**Kapanış kanıtı (S03/X02/X03):** B1–B13'ün tarih/saat, cihaz/sürüm, beklenen/gerçek sonuç tablosu ve ilgili `store_notifications`/`store_subscriptions` satırlarının (anahtarlar karartılmış) ekran görüntüleri. Gerçek kullanıcıdan deneme ücreti alınmaz.

---

## X03 — hukuk metinleri ve mağaza beyanları

Ayrıntılı eksik listesi ve çelişki tablosu: [legal-review.md](legal-review.md). Özet sıra:

1. **İşletme bilgileri** (veri sorumlusu unvanı, adres, MERSİS/VKN, KEP, destek e-postası, yürürlük tarihi, fiyat/ürün kararı) → Enes doldurur.
2. **Hukuk uzmanı incelemesi** → `[AVUKAT …]` işaretli sorular (69 ayrı soru) ve "Uzman incelemesi gerekir" notları; onay kaydı (kim, tarih, hangi sürüm) `docs/legal/` değişiklik geçmişine.
3. **Yayın** → onaylı sürüm `https://<alan adı>/legal/…` altında (uygulama `/legal/abonelik-kosullari` ve `/legal/gizlilik-politikasi` yollarını kullanıyor).
4. **Bağlama** → EAS build ortamına `EXPO_PUBLIC_LEGAL_BASE_URL=https://<alan adı>`; bu olmadan satın alma kapalı kalır.
5. **Mağaza beyanları** → App Store "App Privacy", yaş derecelendirmesi, Kids/aile kategorisi beyanları ve Google Play "Data safety" formu, gizlilik politikasıyla aynı içerikte; inceleme hesabı sentetik aile.

**Başarı işareti:** uygulamadaki iki hukuk bağlantısı gerçek sayfayı açar, metinlerde `[` ile başlayan yer tutucu kalmaz, uzman onay kaydı vardır. **Bu dalda uzman onayı yapılmadı; metinler taslaktır.**
