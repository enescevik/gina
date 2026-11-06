# U01 — Giriş ve kurtarma akışları (2026-11-06)

Durum: **KOD HAZIR / web'de TEST EDİLDİ**, yayımlanmadı. Dal: `u01-auth-recovery` (kaynak `304f303`, main ≥ `e4bc2dc`). Migration yok, üretime dokunulmadı.

## Yapılanlar

| Kabul maddesi | Değişiklik | Dosya |
|---|---|---|
| Giriş/kayıt niyeti ayrımı | Başta "Hesabım var / Yeni hesap" seçimi (`aria-pressed`, grup etiketi); kayıt ve giriş gereklilikleri ayrı. | `apps/mobile/src/app/(auth)/sign-in.tsx` |
| Devre dışı sosyal girişin nedeni | Sağlayıcılar kapalıysa "bu sürümde henüz açık değil", ayarlar yüklenemediyse "şu anda yüklenemedi" + yeniden dene; beyan yoksa düğmelerin neden pasif olduğu yazıyor. Önceden bileşen sessizce boş dönüyordu. | `components/social-sign-in.tsx` |
| Çocuk cihazı alternatifi açık | "Bu cihazı çocuğunuz mu kullanacak?" kartı artık kayıt modunda da var. | `sign-in.tsx` |
| Tek yetişkin onayı (Q00-A1-11) | Kayıt modunda tek beyan (`accountV5.adult`, metin korunur) sosyal ve e-posta için ortak; sosyal bloğun ikinci anahtarı yok. Giriş modunda sosyal blok kendi beyanını korur (sosyal giriş hesap açabilir). | `sign-in.tsx`, `social-sign-in.tsx` |
| İptal / süresi dolmuş / ağ / oturum bitmesi | `classifyAuthIssue`: Supabase Auth hatası ve yönlendirme parametrelerini (`error`, `error_code`) önce U08 `classifyServerError` kategorisine (offline, rate_limited, session_expired, service_unavailable), sonra auth nedenine çevirir. `/auth-callback`: iptal ayrı başlık + "Giriş ekranına dön"; `otp_expired` → aynı ekranda yeniden gönderme; başka tarayıcı/cihazda açılan PKCE kodu → "şifrenizle giriş yapın"; çevrimdışı → yeniden dene. Yanlış şifrede "Şifremi unuttum" ikincil düğme. `?reason=session_expired` girişte açıklanır; aile kurulumunda oturum bitince "Yeniden giriş yap" (yalnız yerel çıkış). Native'de Apple/Google sayfası kapatılınca "Giriş iptal edildi; hesabınızda değişiklik olmadı". | `social-sign-in.tsx`, `auth-callback.tsx`, `sign-in.tsx`, `(auth)/family.tsx` |
| Süresi dolan bağlantıdan yeniden isteme | `AuthLinkResend` (kayıt doğrulama veya şifre yenileme); yanıt hesabın varlığını ele vermez. `/reset-password` süresi dolmuşta yerinde istek formu; web'de şifre ekranı oturum yüklenirken "süresi dolmuş" metnini yanlışlıkla göstermiyor. Kök adrese düşen `#error=…&error_code=otp_expired` girişe taşınıp açıklanıyor. Kayıt `emailRedirectTo` → `/auth-callback`. | `email-verification.tsx`, `reset-password.tsx`, `index.tsx`, `sign-in.tsx` |
| Aile kur/katıl başta ayrı niyet; silme ana eylem değil (Q00-A1-17) | "Nasıl başlamak istersiniz?" + iki niyet kartı; seçimden sonra "Seçimi değiştir". Hesap silme "Hesap seçenekleri" kartında kapalı açılır bölüm; çıkış ikincil. | `(auth)/family.tsx` |
| Gerçek soyad içermeyen örnek (Q00-A1-14) | Yeni `u01.familyNamePlaceholder` = "Örn. Yılmaz Ailesi". Eski `family.namePlaceholder` değeri kurala uyularak değiştirilmedi. | `(auth)/family.tsx`, i18n |
| Yönetici kurtarmadan panele dönüş | Backoffice "Şifremi unuttum" tıklanınca "yeni sekmede açıldı… bu sekmeye dönüp yeni şifrenizle giriş yapın" bildirimi, şifre alanı temizlenir; bağlantı `&from=admin` taşır. Aile web'inde bu modda yönetim metni; aynı tarayıcıda şifre değişince "yönetim paneli sekmesine dönün" (web `localStorage`'da yalnız zaman damgası, e-posta/token yok). | `apps/backoffice/src/pages/sign-in.tsx`, `sign-in.tsx`, `reset-password.tsx` |
| Çocuk kilidi URL/geri/OAuth ile aşılmaz | Kök `_layout` `Stack.Protected` zaten koruyor; değişiklik gerekmedi, testle doğrulandı (aşağıda). | — |

i18n: `packages/core/src/i18n/{tr,en}.json` içine yalnız 37 yeni `u01.*` anahtarı (`experience.social.noCode` sonrasına); mevcut değer değişmedi. Backoffice metni, i18n dosyası bu işin sahipliğinde olmadığından `sign-in.tsx` içinde yerel sabit (backoffice zaten yalnız Türkçe).

## Testler (gerçek çıktılar)

- Mobil `pnpm exec tsc --noEmit`: çıkış 0, çıktı yok.
- Mobil `pnpm exec expo lint`: ilk koşuda 1 hata (`auth-callback.tsx` efekt içinde senkron `setState`) → düzeltildi; yeniden koşu çıkış 0, çıktı yok.
- Backoffice `pnpm run typecheck` (`next typegen && tsc --noEmit`): "Types generated successfully", hata yok. `pnpm run lint` (`eslint .`): hata yok.
- İzole servis: `GINA_QA_UI_FIXTURE=<scratchpad>/u01-fixture.json python3 scripts/test-isolated-services.py --run-local --ui-hold` (iki koşu); bu dalın `expo export -p web` paketi o fixture URL'siyle, harness içindeki statik sunucuda rastgele portta.
- Playwright (Chrome kanalı, `tr-TR`), 390×844 ve 1280×800: [`u01-ui.cjs`](u01-ui.cjs) → [`ui-checks.json`](ui-checks.json) **85/85 geçti, sayfa hatası 0**. Senaryolar: giriş ekranı, yanlış şifre, kayıt (tek beyan), yeni aile kur (masaüstü) ve davet koduyla katıl (telefon: geçersiz kod, önizleme, katıl → `/parent`), `/auth-callback` iptal/süresi dolmuş/yabancı kod, yerinde doğrulama bağlantısı yeniden gönderme ("gönderildi"), `/reset-password` süresi dolmuş + yerinde istek ("gönderildi"), kök adreste süresi dolmuş bağlantı, oturum bitti bildirimi, yönetimden şifre yenileme metni, çevrimdışı giriş, çocuk kilidi.
  - Not (dürüstlük): ilk fixture ile iki koşuda 3 kontrol başarısız göründü (sosyal neden metni ×2, iptalden sonra girişe dönüş, yeniden istek sonucu "error_shown:" boş); ekran görüntülerinde bildirimler görünüyordu. Kontroller bekleyen `waitFor`'a çevrildi ve yeni fixture + yeni exportla tam koşu 85/85 geçti; ilk koşulardaki farkın kesin nedeni (fixture'ın hold süresinin sonuna yaklaşması olası) belirlenmedi.
- Çocuk kilidi: veli girişi → kilit, ekranın yaptığı aynı depolama yazımıyla (`gina-child-mode:<user>`) kuruldu → `/parent/child-mode/today`. `/sign-in`, `/sign-in?mode=up`, `/auth-callback?code=…`, `/reset-password`, `/family`, `/`, `/parent/menu` ve iki "geri" adımı hep `/parent/child-mode/*` içinde kaldı.
- Temizlik: kendi auth/rest konteynerleri ve tek kullanımlık DB her iki koşuda `cleanup: true` (rapor `u01-services*.log`, scratchpad); başka ajanların konteynerine dokunulmadı.

Görüntüler bu klasörde: `sign-in-*.png`, `sign-in-wrong-password-*.png`, `sign-up-*.png`, `family-*.png`, `callback-*.png`, `reset-*.png`, `root-expired-link-phone.png`, `session-expired-phone.png`, `sign-in-offline-phone.png`, `child-lock-*.png`. Görüntülerdeki e-postalar sentetik `@example.invalid`.

Q00 matrisi: `docs/release/experience-review/SCREEN-REVIEW-MATRIX-A1.md` → Q00-A1-11, -14, -17 satırlarına ve yeni "U01 sonrası yeniden doğrulama" bölümüne "sonra" kanıtı eklendi.

## Kalan sınırlar

- Gerçek Apple/Google girişi ve iptali, iOS Apple sayfası, native `openAuthSessionAsync` iptali: sentetik Auth'ta sağlayıcı yok → **görülmedi** (S01, fiziksel cihaz).
- Gerçek e-posta teslimi/SMTP yok; "süresi dolmuş/kullanılmış bağlantı" GoTrue'nun yönlendirme parametreleri (`error=access_denied&error_code=otp_expired`) elle verilerek denendi. İki farklı tarayıcı/cihaz dönüşü yalnız yabancı PKCE koduyla web'de denendi; gerçek e-posta bağlantısıyla değil.
- `emailRedirectTo` = `/auth-callback`: üretimde bu adresin Supabase izinli yönlendirme listesinde olması gerekir (OAuth için zaten kullanılıyor; alan adı/SMTP canlıya alınırken S01 ile doğrulanmalı).
- Backoffice metni yalnız typecheck/lint ile doğrulandı; backoffice UI'ı bu koşuda tarayıcıda açılmadı. Aile web'indeki "panele dönün" metni yalnız aynı tarayıcıda çalışır (localStorage).
- `family.namePlaceholder` ("Çevik Ailesi") anahtarı i18n dosyalarında duruyor ama mobil/backoffice kodunda artık kullanılmıyor (grep: 0 kullanım); silinmesi/değer düzeltmesi ayrı karar.
- Native (iOS/Android) çalıştırma, ekran okuyucu ve büyük yazı denenmedi.
