# C06 — Eşleştirme, PIN ve hesap kurtarma (U01/U02 devamı) — 6 Kasım 2026

**Durum: KOD HAZIR / izole serviste TEST EDİLDİ — yayımlanmadı.** Kabul (gerçek OAuth, kamera, fiziksel cihaz) C15'te.
Eski görev bağlantısı: U01 (giriş/kurtarma), U02 (eşler/aileler/cihaz/PIN/QR); kalan sınırlar [U01](../u01-2026-11-06/README.md), [U02](../u02-2026-11-06/README.md) raporlarından.
Dal: `worktree-agent-a7a287f08ccca55aa` (kaynak main `fcfe8e5`). Main'e push yok, üretime yazma yok (Supabase Auth URL ayarları dahil), `db reset` yok.

## Ne değişti

| U01/U02 kalan sınırı | Çözüm | Dosyalar |
|---|---|---|
| Menüde ikinci (eski) kod alanı | Menü → Cihazlar artık tek `NavigationCard` ile `/parent/pair-device`'a gider; menüde kod alanı ve `pair_child_device` çağrısı yok. "Tehlikeli işlemler" bölümüne dokunulmadı. | `app/parent/menu.tsx` |
| QR girişte (oturum kapalıyken) kod kayboluyor | Kod, yönlendirici korumalı `/parent/...` adresini giriş ekranına çevirmeden önce okunur (`captureLaunchUrl`, kök sağlayıcı modülü yüklenirken; native için `useLinkingURL` + `getInitialURL` yolu `index`/`(auth)` düzeninde). Saklanan yalnız `{code, savedAt}`; web'de yalnız bu sekme (`sessionStorage`), native'de uygulamanın yerel KV deposu. Ömür 10 dk (sunucu `expires_at` asıl otorite); kullanım, "Bu cihaz değil", iptal, geçersiz/süresi dolmuş yanıtında silinir. Girişten sonra `index` veliyi `/parent/pair-device?resume=1`'e götürür. | `components/device/pending-pairing.ts`, `app/index.tsx`, `app/(auth)/_layout.tsx`, `lib/child-mode.tsx` (yalnız tek satırlık yakalama çağrısı) |
| Girişten sonra otomatik eşleme yerine hedefi göster | Yeni salt-okunur RPC `preview_device_pairing(code)`: çocuk cihazında yazılan ad, bağlanacağı aile adı, kalan saniye. Kodu tüketmez, cihaz oluşturmaz; süresi dolmuş/kullanılmış/bilinmeyen kod aynı `invalid_or_expired` yanıtı (ad sızmaz). Ekran: kod → "Cihazı göster" → hedef kartı (cihaz + aile + geri sayım) → "Bu cihazı aileme bağla" veya "Bu cihaz değil". Elle yazılan kod da aynı önizleme adımından geçer. | migration `20261106260000_pairing_handoff.sql`, `app/parent/pair-device.tsx` |
| Veli çıkış PIN'i ortak kontrolde değil | Çocuk modundan çıkış `PinEntry` kullanır (güvenli giriş, 4 kutu, Enter ile gönder; yanlış/kilitli yanıtta kutular temizlenir). Sunucu kuralı çocuk PIN'iyle aynı yapıldı: `verify_parent_pin` 5 yanlıştan sonra 60 sn `pin_locked`; doğru PIN sayacı sıfırlar; `set_parent_pin` yeni PIN'de sayacı sıfırlar. Ekrandaki "5 yanlış → 1 dk" metni artık sunucuyla aynı. Menüdeki veli PIN'i belirleme ortak `PinSetup` (PIN + tekrar) oldu. Unutma yolu (şifre / e-posta doğrulamasıyla çıkış → Güvenlik) korundu. | migration, `components/room/child-mode-home.tsx`, `app/parent/menu.tsx` |
| İptal nedeni `/device/pair?revoked=1`'e taşınmıyor | `child/_layout` cihaz satırını göremediğinde (RLS: iptal) nedeni tutar ve `/device/pair?revoked=1`'e yönlendirir; profil seçici (`child/index`) `forbidden` yanıtında aynı sakin kartı gösterir. | `app/child/_layout.tsx`, `app/child/index.tsx` |
| Tek/ortak çocuk, PIN gerekli/isteğe bağlı = sunucu | Önceki (`pin_policy='existing'`) cihazlarda özet artık sunucunun gerçekte yaptığını yazar ("PIN'i olan PIN'le, olmayan dokunarak"); kaydedince seçilen kural geçerli. Diğer kurallar (PIN gerekliyken PIN'siz çocuk kaydedilemez, eşleme sonrası `selected`+`required`+çocuksuz) pgTAP 019/112 ile aynı. | `components/device/device-access-summary.tsx`, `app/parent/device-access.tsx` |
| "Yılmaz Ailesi ailesinde" tekrarı | Aile değiştir/katıl metinleri adı tırnakla kullanan yeni anahtarlara geçti (`c06.family.*`). | `components/family/family-hub.tsx` |

i18n: `packages/core/src/i18n/{tr,en}.json` içine yalnız 17 yeni `c06.*` anahtarı (TR 2565→2582, EN 2570→2587); mevcut değer değişmedi/silinmedi. Yeni paket yok.

Tasarım karşılaştırması: yeni ekran/öğe yok; hedef kartı ve çıkış PIN'i mevcut `ParentScreen`/`InfoCard`/`PinEntry`/`Button` bileşenleri ve onaylı mint/mor/krem paletiyle (U02 ekranlarıyla aynı dil). Görüntüler `screenshots/`.

## Üretim dönüş adresleri (salt okunur kontrol)

`supabase config diff --project-ref wixjxlxgyhgdacadsawo` (CLI, "Read-only: never modifies local or remote configuration"; Management API'den okur). Üretimde:

- `site_url` = `https://gina-aile-enescevik.expo.app`
- `additional_redirect_urls` = `gina://reset-password`, `https://gina-aile-enescevik.expo.app/reset-password`, `gina://auth-callback`, `https://gina-aile-enescevik.expo.app/auth-callback`, `https://gina-web.pages.dev/auth-callback`, `https://gina-web.pages.dev/reset-password`
- Google ve Apple sağlayıcısı açık; e-posta doğrulaması açık.

Uygulamanın kullandığı adresler (`Linking.createURL`): kayıt doğrulaması `/auth-callback`, Google/Apple (web ve native `openAuthSessionAsync`) `/auth-callback`, şifre sıfırlama `/reset-password`; native şema `gina` (`app.json`). **Hepsi listede**: web `gina-web.pages.dev` ve `…expo.app` için birebir yol, native `gina://…` birebir. Uygulama bu adreslere sorgu parametresi eklemiyor (yönetimden gelen `from=admin` giriş sayfasında kalır, dönüş adresine eklenmez), birebir eşleşme yeterli. iOS Apple girişi `signInWithIdToken` kullanır, dönüş adresi gerektirmez.

**Kullanıcı adımları (yazma yapılmadı):**
1. Google Cloud OAuth istemcisinde ve Apple Services ID "Return URL" alanında `https://wixjxlxgyhgdacadsawo.supabase.co/auth/v1/callback` olduğunu sağlayıcı konsolunda doğrulayın (Supabase dışı; buradan okunamaz).
2. X01 alan adı canlıya alınınca yeni web kökü için `…/auth-callback` ve `…/reset-password` Supabase izin listesine eklenmeli; `site_url` o zaman gözden geçirilmeli (şu an `expo.app`; `gina-web.pages.dev` yalnız iki birebir yol olarak izinli).
3. Expo Go / geliştirme derlemesi (`exp://…`) adresleri listede yok — yalnız geliştirme için; üretimi etkilemez.

## Testler (gerçekten çalıştırıldı)

| Test | Sonuç |
|---|---|
| pgTAP 112 tek başına (`python3 scripts/test-q02-sql.py --run-local --only 112`) | `{"files": 1, "assertions": 38, "failures": []}` |
| Tam pgTAP, Europe/Istanbul (`--out docs/release/c06-2026-11-06/tap-istanbul`) | `{"files": 107, "assertions": 4034, "failures": []}` — [tap-istanbul/sql-checks.json](tap-istanbul/sql-checks.json) |
| Tam pgTAP, UTC (`--timezone UTC --out …/tap-utc`) | `{"files": 107, "assertions": 4034, "failures": []}` — [tap-utc/sql-checks.json](tap-utc/sql-checks.json) |
| Mobil `pnpm exec tsc --noEmit` | çıkış 0 |
| Mobil `pnpm exec expo lint` | çıkış 0 (ara koşuda 1 `import/first` uyarısı düzeltildi) |
| İzole servis (`test-isolated-services.py --run-local --with-realtime --ui-hold`) | servis sözleşmesi 149/149; tek kullanımlık DB + Auth/REST/Realtime konteynerleri; `cleanup` hepsi `true`; kendi DB'm sonradan `pg_database`'te yok, fixture dosyası silindi, 8361 sunucusu durduruldu. Başka ajanların konteynerine dokunulmadı. |
| Playwright (Chrome, `tr-TR`), 390×844 / 768×1024 / 1280×800, `scripts/test-c06-pairing-pin-ui.cjs` | **16/16 geçti** — [ui-checks.json](ui-checks.json) |

pgTAP 112 (38): yetkiler (authenticated var/anon yok), tek imza, `stable`; canlı kodda ad + aile + kalan süre; süresi dolmuş/bilinmeyen/biçimsiz/null kod `invalid_or_expired` ve ad sızdırmaz; önizleme kodu tüketmez ve cihaz oluşturmaz; eşlenmemiş cihaz önizleyemez (42501); onay bir kez eşler, ikinci onay / başka aile / süresi dolmuş kod reddedilir; cihaz yalnız onaylayan ailede; eşlenen cihaz yapılandırmadan çocuk göremez; cihaz veli PIN'ini deneyemez; veli PIN'i 5 yanlış → kilit, kilitliyken doğru PIN de reddedilir, süre bitince doğru PIN açar ve sayacı sıfırlar, yeni PIN sayacı sıfırlar.

UI kontrolleri (sentetik `@example.invalid` hesaplar, gerçek GoTrue/PostgREST/Realtime):

1. Menü → Cihazlar: kod alanı yok, tek kart `/parent/pair-device`'a gider; veli PIN'i ortak `PinSetup` ile kaydedildi (DB'de hash doğrulandı).
2. Tablet QR'ı CoreImage ile çözüldü: yalnız `/parent/pair-device?code=<6 hane>`.
3. **QR → giriş → hedef → eşleme**: oturumsuz veli bağlantıyı açtı → giriş ekranı; sekmede yalnız `{code,savedAt}` tutuldu → girişten sonra `/parent/pair-device?resume=1`, kartta "Salon tableti" + "Yılmaz Ailesi"; bu anda DB'de kod tüketilmemiş, cihaz yok → onay → cihaz-erişim ekranı, cihaz `selected/required` ve doğru ailede, saklanan kod silindi.
4. Kullanılmış QR bağlantısı ve aynı kodun elle yazılması: "Kod geçersiz veya süresi dolmuş", ikinci cihaz yok.
5. Giriş sırasında sunucuda süresi dolan kod: girişten sonra hedef kartı yok, süresi doldu kartı; kod tüketilmedi.
6. 10 dk'dan eski saklanan kod (saat ileri alındı): girişten sonra normal `/parent`, depo boş, kod tüketilmedi.
7. Tablet tek çocuk + PIN gerekli kaydedildi, çocuk PIN'le girdi.
8. **Çocuk sınırı**: tablet `/parent/menu`, `/parent/pair-device?code=…`, `/parent/device-access` adreslerinde `/child` içinde kaldı; cihaz token'ıyla `preview_device_pairing`, `pair_child_device`, `verify_parent_pin`, kardeş için `child_pin_login`, `configure_child_device` → hepsi **403**.
9. **İptal**: çocuk `/child/today`'deyken veli iptal etti → ~2 sn'de `/device/pair?revoked=1` ve "Bu cihazın erişimi kaldırıldı" kartı; eski cihaz token'ı reddedildi.
10. **Veli çıkış PIN'i**: alan `type=password`, `maxlength=4`; 5 yanlışın her birinde "Ebeveyn PIN'i yanlış" ve kutular boş; 6.'da doğru PIN de "Çok fazla deneme…"; çocuk modunda kalındı; "Ebeveyn PIN'ini unuttum" yolu açıldı; kilit süresi bitince doğru PIN → `/parent`.
11. **Aile katıl/değiştir**: "Demir Ailesi"ne katılma ve "Yılmaz Ailesi"ne dönüş metinleri tekrarsız (`“Demir Ailesi”`), iki aile ve 3 çocuk korunuyor, aktif aile geri döndü.
12. **Şifre sıfırlama, gerçek GoTrue bağlantısı** (PKCE; bağlantı DB'deki `recovery_token`'dan kuruldu çünkü SMTP yok): başka tarayıcıda açılan bağlantı gerçek `?code=` ile geldi ama doğrulayıcı olmadığı için şifre formu açılmadı, yerinde yeni bağlantı formu; aynı bağlantı ikinci kez → Auth `otp_expired`, yeni bağlantı formu; 2 günlük bağlantı → `otp_expired`; aynı tarayıcıda yeni bağlantı → şifre değişti, yeni şifre çalışıyor, eski reddediliyor.
13. **Oturum iptali**: A tarayıcısı `logout?scope=global`; B'nin erişim token'ının süresi doldurulup sayfa açılınca yenileme reddedildi ve giriş ekranına döndü.
14. Hiçbir sayfada çalışma zamanı hatası, yatay taşma, ham i18n anahtarı veya "ailesi ailesi" yok.

Not (dürüstlük): UI betiği üç koşuda tamamlandı. 1. koşu: betikteki i18n okuyucusu iç içe anahtarı bulamadı (betik hatası). 2. koşu: **web'de oturumsuz QR kodu kayboldu** — ilk tasarımdaki `index`/`(auth)` kancası çalıştığında yönlendirici adresi `/sign-in`'e çevirmişti; düzeltme olarak yakalama kök sağlayıcı modülünün yüklenişine alındı (`captureLaunchUrl`) ve web yeniden derlendi. 3. koşu: kurtarma adımında `auth.users` güncellemesi `postgres` rolüyle reddedildi (betik; yalnız tek kullanımlık klonda `supabase_admin`'e geçti). Son tam koşu 16/16. UI koşusundan **sonra** tek satırlık değişiklik: çıkış PIN'i kilitli/başarısız yanıtta da kutuları temizliyor (`child-mode-home.tsx` catch dalı) — yalnız tsc/lint ile doğrulandı; ekran görüntüsünde kilitli durumda kutular dolu görünüyor.

## Kalan sınırlar

- **Yayımlanmadı.** Migration `20261106260000` üretime uygulanmadı (C14).
- Native QR/deep link: oturumsuz soğuk açılış `Linking.getInitialURL/useLinkingURL` ile kodlandı ama **iOS/Android'de denenmedi**; sistem kamerası ve `gina://` açılışı, gerçek Google/Apple girişi ve iptali C15 (web taklidi fiziksel sayılmaz).
- Gerçek e-posta teslimi yok (X01); sıfırlama bağlantısı GoTrue'nun kendi `verify` ucuyla ve DB'deki token'la kuruldu, e-posta içeriği/şablonu denenmedi.
- Eşleme kodu deneme sınırı yok (önceden de yoktu): `pair_device`/`pair_child_device` 6 haneli kod için kullanıcı başına deneme sınırı tutmuyor; önizleme aynı yüzeyi açar. Hata fırlatan bir RPC'de sayacı kalıcı yazmak aynı işlemde mümkün olmadığından ayrı bir tasarım (ör. sayaç tablosu + istemci sözleşmesi değişikliği) gerekir — öneri, bu kartta yapılmadı.
- Çocuk modundaki çocuk PIN'i (`parent/child-mode/index.tsx`, bu işin sahipliğinde değil): sunucu `verify_child_pin` PIN'siz çocukta `true` döner, istemci yine 4 hane ister — U02'den kalan küçük uyumsuzluk.
- Hedef kartındaki "ad ve kod aynı olmalı" metni kodu kartın içinde göstermiyor (kod giriş alanında/QR'da); küçük metin/öğe düzeltmesi önerilir.
- Cihaz rolündeki bir tablet `/parent/pair-device?code=…` açarsa kod sekmede 10 dk saklanır ama kullanılamaz (yalnız veli rolü yönlendirilir; sunucu cihaz rolüne 403 verir).
- Kişisel/ortak cihaz ayrımı sunucuda ayrı alan değil (yalnız seçili çocuk listesi); "kişisel" = istemcide tek seçim.

## Değişen dosyalar

`supabase/migrations/20261106260000_pairing_handoff.sql`, `supabase/tests/112_pairing_handoff.test.sql`, `apps/mobile/src/components/device/pending-pairing.ts` (yeni), `apps/mobile/src/app/{index,parent/pair-device,parent/menu,parent/device-access,child/_layout,child/index,(auth)/_layout}.tsx`, `apps/mobile/src/components/{device/device-access-summary,family/family-hub,room/child-mode-home}.tsx`, `apps/mobile/src/lib/child-mode.tsx`, `packages/core/src/i18n/{tr,en}.json`, `scripts/test-c06-pairing-pin-ui.cjs` (yeni), bu klasör.
