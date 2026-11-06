# H06 — görsel/etkileşim kabul boşlukları

6 Kasım 2026 · Dal `worktree-agent-a0a6847cd6b17aa54` · Taban main `cdcc9c4` (H01, H03, H04, H05, H07 dahil) · **Yayımlanmadı** (main'e push yok, migration yok, üretime dokunulmadı, ücretli AI çağrısı yok). i18n'e yalnız yeni `h06.*` anahtarları (TR+EN) eklendi.

Takip matrisi güncellendi: [`../experience-review/SCREEN-REVIEW-MATRIX.md`](../experience-review/SCREEN-REVIEW-MATRIX.md) (Q00-C12-12, D8-1, yeni H06 satırları). Fiziksel cihaz listesi ayrı: [`C15-DEVICE-CHECKLIST.md`](C15-DEVICE-CHECKLIST.md).

## 1. D8-1: `groups` ve `question-media` pencereleri

Sentetik veri (yalnız geçici DB, `harness/h06-ui.cjs` → `seed()`): 098 pgTAP tarifindeki kütüphane paketi, görseli 320×200 sentetik PNG ile değiştirilerek içe aktarıldı → yönetici incelemesi → `prepare_library_delivery_media` → yayın → otomatik Birlikte Prova (`source:segments` ortak kaynaklı, 2 saat açık, 20 dk). Veli katılım penceresinden çocuğu kaydetti; çocuk modunda soruda ortak içerik + görsel göründü (aile kaynağı: 4 hazır `question_image`).

Ölçüm D8 ile aynı: açılış tıklamasından sonra 6 × 40 ms `document.getAnimations()` içinde çalışan sayısı.

| Pencere | reduce | normal | Düzen (390/360/768/1280) | Kanıt |
|---|---|---|---|---|
| `groups` katılım (“Çocuğum katılsın”) | `[0,0,0,0,0,0]` | `[1,1,1,1,1,1]` | taşma/örtüşme/isimsiz/küçük hedef 0 | `ui/modal-group_join-*.png` |
| `groups` sıralama onayı (“Sıralamaya katıl”) | `[0,0,0,0,0,0]` | `[1,1,1,1,1,1]` | temiz | `ui/modal-group_ranking-*.png` |
| `groups` sonuç (“Sonuca bak”) | `[0,0,0,0,0,0]` | `[0,1,1,1,1,1]` | temiz | `ui/modal-group_result-*.png` |
| `question-media` (“Görseli büyüt”) | `[0,0,0,0,0,0]` | `[1,1,1,1,1,0]` | temiz; “+” sonrası %200, yatay kaydırma pencere içinde | `ui/modal-question_media-*.png`, `ui/question-with-image-*-phone.png` |

Sonuç: `useRouteMotion` bağlantısı (D8) dört pencerede de çalışıyor. D8-1'in yalnız fiziksel PDF kısmı açık (C15-06).

## 2. H01/H04/H05/D14/H07 değişen ekranlar

Her ekran azaltılmış hareketle 4 ölçüde açıldı (390×844, 360×740, 768×1024, 1280×800); normal hareketle ayrıca çalışan animasyon sayıldı. Denetim (`audit()`): yatay taşma, kırpma hesaba katılarak etkileşimli öğe örtüşmesi, 48 px altı hedef, isimsiz eylem, görünür alan dışına taşan eylem, ham i18n anahtarı, `pageerror`. Birincil eylem görünür mü; gerekli alan doldurulunca etkin mi; 360 px'de Tab ile ulaşılıyor mu ve odaklanan her öğe görünür alanda mı.

| Ekran | Durum | Birincil eylem / klavye | Kanıt |
|---|---|---|---|
| Giriş (Apple düğmesi görünür — T1) | TE | “Giriş yap” alanlar dolunca etkin, Tab ile ulaşılır; Apple düğmesi yetişkin beyanı onaylanana kadar pasif (tasarım) | `ui/screen-sign-in-*.png` |
| `auth-callback` süresi dolmuş (sorgu ve `#` parça) | TE | “Doğrulama bağlantısını yeniden gönder” e-posta yazılınca etkin, alandan sonra ilk Tab durağı | `ui/screen-auth-callback-expired-*.png`, `…-fragment-expired-*.png` |
| `auth-callback` başka cihaz (sahte PKCE kodu) | TE | “Giriş ekranına dön” ilk Tab durağı | `ui/screen-auth-callback-other-device-*.png` |
| `reset-password` süresi dolmuş | TE | “Yenileme bağlantısı gönder” | `ui/screen-reset-password-expired-*.png` |
| Abonelik AI onay notu (H05) | TE | not görünür (`subscription-ai-consent-note`) | `ui/screen-subscription-ai-consent-*.png` |
| AI sorusunu düzenle (D14) | **DÜZ (H06-1)** | “Devam” 15. Tab durağı, sıra mantıklı | `ui/screen-ai-question-edit-*.png` |
| Hesap silme, Apple bağlı hesap (H01 — T2) | TE | “Apple ile doğrula” görünür ve etkin; “Kalıcı olarak sil” doğrulama + onay olmadan pasif | `ui/screen-account-deletion-apple-*.png`, `…-apple-button-{phone,narrow}.png` |
| Yönetim AI ön inceleme `retry_pending`/`daily_limit` (H07) 1280×800, 1440×900 | **DÜZ (H06-2)** | ileti satır içinde, taşma 0, ham kod yok | `ui/bo-prereview-daily-limit-*.png`, `ui/bo-prereview-daily-limit.json` |

Bütün ekranlarda: taşma 0, örtüşme 0, 48 px altı hedef 0, isimsiz eylem 0, ham anahtar 0, `pageerror` 0, reduce'ta çalışan animasyon 0 (`ui/checks.json`, 16/16).

### Bulunan ve düzeltilen kusurlar

- **H06-1 (P3, mobil):** D14 AI düzenlemesinde adım 1 “Soru ve görsel” ve yardım metni görsel istiyordu; bu düzenlemede görsel editörü yok. `apps/mobile/src/app/parent/prova/question.tsx`: yalnız `editFrom` iken `h06.aiEditStep0` (“Soru”) ve `h06.aiEditStep0Help`. Elle soru editörü aynı. Önce: ilk tur ekran görüntüsü (adım “1. Soru ve görsel”); sonra: Tab sırasında “1. Soru”.
- **H06-2 (P3, yönetim):** `retry_pending` iletisi “kayıt kuyrukta bekliyor (Günlük AI çağrı sınırı doldu; kayıt kuyrukta bekliyor, AI çağrılmadı)” diye tekrar ediyordu. `apps/backoffice/src/components/content-prereview.tsx`: neden etiketi zaten “kuyrukta bekliyor” içeriyorsa bir kez yazılır → “AI ön incelemesi şimdi yapılamadı: Günlük AI çağrı sınırı doldu; kayıt kuyrukta bekliyor, AI çağrılmadı. Yönetici kararı ve yayın değişmedi.” Tur, ifadenin bir kez geçtiğini doğruluyor.
- **H06-G1 (gözlem, değişmedi):** `auth-callback` hata durumlarında başlık “Giriş yap”, ikincil düğme de “Giriş yap”. Kapanmış H04 tasarımı, yeniden çizilmedi.

### Taklitler ve sınırlar

- **T1:** giriş ekranında `/auth/v1/settings` yanıtına `external.apple=true` eklendi; yalnız düğme yerleşimi için, Apple'a gidilmedi.
- **T2:** Apple kimliği geçici DB'de `auth.identities` satırı; “Apple ile doğrula”ya basılmadı (gerçek Apple akışı C15-13, B31+).
- **T3:** yönetimde Edge `content-prereview` yanıtı Playwright ile taklit (`retry_pending`, `daily_limit`); kuyruğa alma RPC'si gerçek. Bu ortamda Edge yok.
- Web'de güvenli alan 0'dır ve OS klavyesi yoktur. Klavye yalnız Tab sırası ve odak görünürlüğüyle ölçüldü; native klavye ve çentik C15-17'de. `reset-password` çevrimdışı “Tekrar dene” yolu yalnız native (PKCE değişimi), web'de ölçülmedi.
- Hiçbir web ölçümü fiziksel Pencil, VoiceOver/TalkBack, yazı ölçeği, döndürme ya da push testi olarak yazılmadı.

## 3. C15

[`C15-DEVICE-CHECKLIST.md`](C15-DEVICE-CHECKLIST.md): 18 satır (cihaz, OS, derleme, rol, adımlar, beklenen sonuç). **Derleme 30 (`bba2b01`) H01/H04/H05/H06 kodunu içermiyor.** C15-13 (Apple ile hesap silme) ve C15-15 (kullanılmış bağlantı ekranı) B31+ ister. Android satırı X02 nedeniyle ENG.

## 4. Test kanıtı

| Test | Sonuç |
|---|---|
| İzole servis `--run-local --with-storage --ui-hold` (`GINA_QA_UI_PLAN=pro`, H06'ya özel fixture yolu), 2 koşu | Her biri **465/465**; temizlik storage/rest/auth/DB `true` (`services.json`); bitişte `gina_http_*` kapsayıcı 0, DB 0 |
| `harness/h06-ui.cjs` (2. temiz fixture, düzeltmelerden sonraki web dışa aktarımı) | **16/16** → `ui/checks.json` |
| `scripts/test-content-review-ui.py --run-local` + `GINA_CQUI_H06_OUT` (düzeltme sonrası yönetim derlemesi) | **16/16** (mevcut 15 + `h06_daily_limit_retry_pending_message_desktop`); temizlik `true` → `ui/bo-content-review-ui-report.json`. Var olan content-prereview kanıt görüntüleri `GINA_CQUI_SHOTS` ile scratch'e yazıldı, üzerine yazılmadı |
| `pnpm --filter @gina/core test` | 66 dosya, **474** test geçti |
| Mobil `pnpm exec tsc --noEmit` / `pnpm exec expo lint` | 0 / 0 |
| Yönetim `typecheck` / `lint` / `build` (yer tutucu URL) | 0 / 0 / 0 |

## 5. Yeniden çalıştırma

```
GINA_QA_UI_FIXTURE=<scratch>/fixture.json GINA_QA_UI_PLAN=pro python3 scripts/test-isolated-services.py --run-local --with-storage --ui-hold
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59486 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-h06 npx expo export -p web --output-dir <scratch>/web
node docs/release/c04-2026-11-06/ui/serve-export.cjs <scratch>/web 8586
GINA_QA_UI_FIXTURE=… GINA_QA_WEB=http://127.0.0.1:8586 GINA_QA_WEB_BACKEND=http://127.0.0.1:59486 GINA_QA_WEB_ANON=placeholder-anon-h06 \
  GINA_QA_PLAYWRIGHT_PATH=<playwright> GINA_H06_DB=<yalnız bu koşunun gina_http_*_audit DB'si> node docs/release/h06-2026-11-06/harness/h06-ui.cjs
kill -USR2 <fixture pid>
NEXT_PUBLIC_SUPABASE_URL=http://gina-cqui.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=cqui-placeholder-anon pnpm --filter @gina/backoffice build
GINA_CQUI_SHOTS=<scratch>/cqui GINA_CQUI_H06_OUT=docs/release/h06-2026-11-06/ui GINA_QA_PLAYWRIGHT_PATH=<playwright> python3 scripts/test-content-review-ui.py --run-local
```

Akışlar ayrı ayrı `GINA_H06_ONLY=group_modals,question_media,screen_<ad>` ile çalışır. `group_modals` çocuğu kaydettiği için yeni bir fixture ister. Görüntülerde yalnız sentetik `@example.invalid` hesaplar var; şifre ve anahtar dosyalara yazılmadı.
