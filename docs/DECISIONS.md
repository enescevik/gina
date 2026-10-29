# Gina — ürün ve teknik kararlar

Son güncelleme: 2026-10-30. Kaynak: proje dokümanı (Claude Docs) ve 29-30 Ekim 2026 araştırma akışları (kaynaklarla doğrulandı). Bu dosya kodu yazan herkesin (Claude, Codex, Enes) uyacağı kararları tek yerde tutar.

## Ürün

- Gina Aile satılacak bir üründür: iOS + Android (telefon + tablet), veli webi (Expo web export), backoffice (önce Supabase Studio, sonra statik Next.js admin). Türkçe + İngilizce; tarih/sayı/para birimi yerel ayara göre.
- Hesap sahibi yalnızca 18+ ebeveyn/vasi. Çocuk hesap açmaz, e-posta/telefon vermez; çocuk profili ebeveyn tarafından veli beyanıyla oluşturulur; çocuk için asgari veri: ad/takma ad + doğum yılı.
- Çocuklar AI ile hiçbir zaman doğrudan etkileşmez; AI özeti yalnız ebeveyn alanında ve yalnız ücretli paketlerde; AI girdileri takma adlandırılır (soyad, doğum tarihi, okul, fotoğraf, sağlık/gelişim notu gönderilmez).
- v1'de sağlık benzeri veri yok (boy/kilo dâhil); gelişim takibi kilometre taşlarıyla başlar.
- Üçüncü taraf analitik/reklam/takip SDK'sı yok; çökme raporlama lansmana kadar yok (sonra PII temizlemeli, çocuk modunda kapalı).
- Push içerikleri kişisel veri içermez (çocuk adı, not, puan yok).

## Paketler ve ödeme

- Paketler: **Gina Başlangıç** (ücretsiz), **Gina Plus**, **Gina Pro**. Çocuk sayısı 2 / 4 / 8 (teknik tavan 10). AI: ücretsizde yok; Plus haftalık özet (claude-haiku-5-5); Pro haftalık özet + 7 günlük ipucu (claude-sonnet-5-5) + fotoğraftan takvim (20/ay). Model, token limiti, prompt sürümü ve kill switch backoffice'ten (`ai_models`, `ai_settings`).
- Fiyat önerisi (yıllık ≈ 10 ay): Plus ₺99,99/ay – ₺999,99/yıl ($3.99 / $39.99); Pro ₺199,99/ay – ₺1.999,99/yıl ($7.99 / $79.99). Apple'da baz mağaza ABD, TR fiyatı elle; 7 gün ücretsiz deneme tüm SKU'larda.
- Ödeme yalnız Apple In-App Purchase (StoreKit 2) ve Google Play Billing; üçüncü taraf ödeme sağlayıcısı yok. İstemci: `expo-iap` (OpenIAP; Play Billing Library 9.1.0). Sunucu: Supabase Edge Functions — `apple-notifications` (ASSN V2), `google-rtdn` (Pub/Sub push), `iap-verify`, `iap-reconcile` (pg_cron). Yetki (entitlement) ailenindir, tek kaynak Supabase; web ve çocuk cihazları yalnız yansıtır. Web'de satış yok.
- Ürün kimlikleri: iOS `gina_plus_monthly`, `gina_plus_yearly`, `gina_pro_monthly`, `gina_pro_yearly`; Android abonelikler `gina_plus`, `gina_pro` + base plan `monthly`/`yearly` + offer `trial7`.
- Kuponlar yalnız mağaza-yerel: Apple Offer Codes, Google Play promo kodları. Uygulama içinde ücretli özellik açan kendi kod girişimiz **yok** (Apple 3.1.1). İç komp'lar (aile, beta testçileri, basın) backoffice'ten `entitlement_overrides` ile, gerekçe + bitiş tarihi + denetim iziyle. Davet kodu yalnız aileye katılım içindir.
- Apple Small Business Program'a (%15) ilk satıştan önce kayıt; Google aboneliklerde %15.

## Teknik

- Backend Supabase (Postgres + RLS + RPC + Auth + Realtime + pg_cron + Edge Functions + Vault), proje bölgesi **Central EU (Frankfurt) eu-central-1**. Firebase yalnız Android push için FCM kimlik bilgisi veren boş bir proje (uygulamaya Firebase SDK girmez); aynı GCP projesi Google OAuth client + Play API service account + Pub/Sub için kullanılır.
- Kimlik: veli = Supabase Auth (e-posta/şifre + Apple + Google; Google sunulduğu için Sign in with Apple zorunlu; Google girişi Faz 1'de Supabase OAuth PKCE). Çocuk = `children` satırı + 4 haneli PIN (bcrypt, sunucuda). Tablet = anonim Auth kullanıcısı + 6 haneli eşleştirme; JWT `gina` claim'i. Eşleştirme iptali anında etkilidir (RLS/RPC her istekte `devices.revoked_at`'i kontrol eder).
- Veli telefonunda çocuk modu: aynı oturum içinde kısıtlı görünüm; giriş çocuk PIN'i, çıkış 4 haneli veli PIN'i (biyometri Faz 2). Eylemler `complete_task(p_acting_child_id)` ile çocuğa yazılır.
- i18n: i18next + react-i18next + expo-localization; çoğullar JSON v4 (`key_one`/`key_other`) + `intl-pluralrules` polyfill'i; tarih/sayı Hermes Intl; göreli zaman date-fns; aile saat dilimi `families.timezone` (varsayılan Europe/Istanbul), tüm zaman damgaları UTC, `due_date` aile-yerel; hafta Pazartesi başlar; fiyatlar yalnız mağazanın yerelleştirilmiş metniyle gösterilir. DB içeriği jsonb `*_i18n` kolonları.
- Realtime yalnız geçersizleme sinyali; çevrimdışı outbox Faz 2 (MVP online + açılışta yenileme).
- Hosting: web ve admin Cloudflare Pages (private GitHub repo; `expo export -p web`, `dist/`, SPA fallback `_redirects`); admin Cloudflare Access (e-posta OTP) arkasında. Supabase Pro'ya (25 $/ay) kapalı beta başlamadan önce geçilir.
- E-posta: Supabase dahili SMTP yalnız ekip üyelerine gönderir; şifre sıfırlama/doğrulama için özel SMTP (Resend/Brevo) + ucuz bir alan adı gerekir (kapalı betadan önce). Alan adı alınmazsa beta e-posta doğrulamasız ve «şifremi unuttum»suz tasarlanır.
- iOS build Mac'te (`eas build --local`, Xcode 26, CocoaPods `LANG=en_US.UTF-8`), `eas submit` ile TestFlight; EAS bulut kotası harcanmaz. Android: APK sideload, Play kapalı test (12 kişi × 14 gün) lansmandan önce.

## Hukuk

- Belgeler `docs/legal/` altında taslaktır (Sürüm 0.1); yayın öncesi avukat incelemesi gerekir. Yayın: Cloudflare'da herkese açık HTML (TR + EN), URL'ler ASC/Play'e girilir: `/legal/gizlilik-politikasi`, `/legal/kvkk-aydinlatma-metni`, `/legal/kullanim-kosullari`, `/legal/abonelik-kosullari`, `/legal/cerez-politikasi`, `/legal/hesap-ve-veri-silme`, `/legal/kvkk-basvuru-formu`.
- Apple standart EULA + kendi Kullanım Koşulları; özel EULA yok. Fiyat artışında mağaza kuralları geçerli (Apple onay kuralı), ek «30 gün» taahhüdü yok; iadeler mağaza üzerinden, biz destek oluruz.
- AI özeti: işleme dayanağı sözleşmenin ifası (m.5/2-c), yurt dışı aktarım için ayrı açık rıza/özellik izni (varsayılan kapalı, ayarlardan geri alınabilir) — avukat onayına tabi. Üretilen özetler 12 ay saklanır; Anthropic'te kural olarak 30 gün (politika ihlali şüphesinde 2 yıla kadar).
- Kids Category seçilmez; Play hedef kitlesi 18+ ebeveyn; metadata «çocuklar için» demez.
## Kesinleşen kararlar (30 Ekim 2026; Enes karar yetkisini devretti)

- **Hukuki kimlik:** şahıs (bireysel geliştirici) olarak başlanır; mağazada satıcı adı olarak yasal ad görünür, GVK mük. 20/B stopaj istisnası muhasebeciyle teyit edilir; ileride şirkete devir mümkündür. Belgelerdeki kimlik yer tutucuları Enes'in bilgileriyle dolacak.
- **Paketler:** önerildiği gibi onaylandı — Başlangıç (ücretsiz, 2 çocuk, AI yok) / Plus ₺99,99-ay, ₺999,99-yıl (4 çocuk, haftalık Haiku özeti) / Pro ₺199,99-ay, ₺1.999,99-yıl (8 çocuk, Sonnet + fotoğraftan takvim 20/ay); 7 gün deneme, yıllık ≈ 10 ay.
- **Alan adı:** kapalı betadan önce ucuz bir alan adı alınır (ör. `ginaaile.app`; satın alma Enes'te). O güne kadar yerel/TestFlight betası e-posta doğrulamasız ve «şifremi unuttum»suz çalışır (Supabase'de Confirm email kapalı); domain + Resend SMTP gelince açılır.
- **Android:** Play kapalı testi (12 Google hesabı × 14 gün) ticari katman haftalarında paralel başlar; Play lansmanı iOS'tan 2-3 hafta sonra; hedef kitle beyanı «18+ ebeveyn».
- **Boy/kilo:** v1'de yok; gelişim takibi kilometre taşlarıyla.
- **Avukat:** `docs/legal` yayına girmeden önce avukat incelemesinden geçer; belgelerdeki [AVUKAT] işaretli sorular o görüşmeye taşınır.
