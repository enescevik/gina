# D8 — D4'ten devreden zorunlu düzeltmeler

6 Kasım 2026 · Dal `worktree-agent-a713939356941a162` · Taban main `695975e` (≥ `794e90b`; D1 ve D4 birleşmiş) · **Yayımlanmadı** (main'e push yok, migration yok, üretime dokunulmadı; i18n'e yalnız yeni `d8.*` anahtarları eklendi, mevcut anahtar değişmedi).

Tek takip matrisi güncellendi: [`../experience-review/SCREEN-REVIEW-MATRIX.md`](../experience-review/SCREEN-REVIEW-MATRIX.md) (`d8/` = `ui/`).

## Sonuç özeti

| Kalem | Önce | Sonra | Kanıt |
|---|---|---|---|
| Q00-C12-12 kalan `fade` | 8 sabit `animationType="fade"` | **DÜZ**: `parent-review-workspace.tsx` ×4, `app/parent/prova/groups.tsx` ×3, `question-media.tsx` ×1 → `const { animation } = useRouteMotion()`. `apps/mobile/src` içinde sabit `fade` **0**. Ölçüm (veli inceleme → “Çizimli not ekle” → “Soruyu göster”): reduce → çalışan animasyon `[0,0,0,0,0,0]`; normal → `[0,1,1,1,1,1]` | `ui/checks.json` → `c12_12_question_preview_respects_reduced_motion`; `ui/modal-question_preview-{reduce,no-preference}-phone.png` |
| D4-1 ortak kaynak “Sınıf” | serbest 2 haneli metin | **DÜZ**: 1–12 `radiogroup` (kitapçıktaki kalıp, “N. sınıf” adları, 48 pt dokunma, kilitliyken pasif). Metin kutusu 0, radyo 12; 7 seçildi → `question_source_groups.grade = 7` | `ui/shared-source-grade-{phone,tablet}.png`; `d4_1_shared_source_grade_choice` |
| D4-2 süre doldu sonucu | yalnız “Deneme bitti!” | **DÜZ**: çocuk sonucunda sakin not “⏱ Süre doldu — Süre bitti, deneme kendiliğinden kapandı. Kaydettiğin cevapların teslim edildi.”; veli sonuç ekranında “Süre dolunca deneme kendiliğinden bitti. Süre içinde kaydedilen cevaplar değerlendirildi.” Süresiz denemede görünmez | `ui/timeup-{child-client,child-server,parent}-{phone,tablet}.png`; `d4_2_*` (2 kontrol) |
| D4-3 tekrar takvimi tarih/saat | “Tarih (YYYY-AA-GG)”, “Saat (SS:DD)” serbest metin | **DÜZ**: ortak `DateChoice` (aile saat diliminde “bugün”) + `TimeChoice`; hızlı saat düğmeleri (16–19) korundu. Serbest metin 0; “Bir hafta sonra” + saat +1 + “:30” → etkinlik `2026-11-13 18:30` (Europe/Istanbul) | `ui/repeat-datetime-{phone,tablet}.png`; `d4_3_repeat_day_uses_date_time_choice` |
| D4-4 native PDF “i” → “!” | `pdftotext` 17 satırda “!” | **DÜZ (iOS simülatör)**: kök neden bulundu ve düzeltildi (aşağıda). iPhone 17 Pro'da yeni PDF: A4, 4 sayfa, 50 KB; yazı tipleri `Nunito-Regular`, `Baloo2-Bold` (gömülü); metin “Matematik 5. sınıf çalışma kitapçığı”, “Tarih:”, “Okul bahçesi”… — “!” **0**; öğrenci nüshasında “cevap anahtarı/çözüm” 0 | `ui/ios-booklet-student-copy-fonts.{pdf,txt}`, `ui/ios-booklet-student-copy-fonts-p-{1,2}.png`, `ui/ios-booklet-pdf-share-iphone17pro.png` |

### D4-4 kök neden

1. Kitapçık CSS'i `font-family: "Nunito", -apple-system, …` diyor ama `expo-print`'in WKWebView'unda Nunito/Baloo 2 **yüklü değil** → metin sistem fontuna (SF, değişken font) düşüyor.
2. Cihaz dili Türkçe (`tr-TR`, simülatör `AppleLanguages = tr-TR`) iken CoreText, SF'nin Türkçeye özel (`locl`) “i” glifini seçiyor. Bu glifin cmap'te Unicode karşılığı yok; CoreGraphics PDF yazıcısı onu ToUnicode'suz **MacRoman** alt küme fontuna (`pdffonts`: `.SFUI-… MacRoman … uni no`) 0x21 koduyla koyuyor → çıkarıcılar “!” okuyor. Görsel doğru, arama/kopyalama/ekran okuyucu bozuk.
3. macOS WKWebView ile yeniden üretildi (aynı HTML): `-AppleLanguages (tr-TR)` → `Matemat!k k!tapçığı`; `(en-US)` → doğru. `font-feature-settings: "locl" 0` **işe yaramadı**; `lang="en"` işe yarıyor ama yanlış dil bildirimi olurdu. Uygulamanın kendi yazı tiplerini `@font-face` (base64 TTF) ile gömmek, `lang="tr"` + `tr-TR` yerelinde bile doğru metin verdi.

Düzeltme: `packages/core/src/prova-booklet.ts` → `BookletFont`, `bookletFontFaceCss`, `withBookletFonts` (base64 doğrulanır, CSS'e kaçış yok); `apps/mobile/src/lib/prova-booklet.ts` → `loadBookletFonts()` (`expo-asset` + `expo-file-system` `File.base64()`; Nunito 400/700, Baloo 2 700; bir kez yüklenir, hata olursa PDF yine üretilir, sistem fontuna düşer ve sonraki denemede yeniden okunur). Yalnız native yol; web yazdırma değişmedi. Yan etki: native PDF artık onaylı marka yazı tiplerini (Baloo 2 başlık, Nunito gövde) görsel olarak da kullanıyor (eskiden SF).

## Değişen dosyalar

- `apps/mobile/src/components/learning/parent-review-workspace.tsx`, `apps/mobile/src/app/parent/prova/groups.tsx`, `apps/mobile/src/components/learning/question-media.tsx` — `useRouteMotion`
- `apps/mobile/src/components/learning/shared-question-wizard.tsx` — sınıf radyo grubu
- `apps/mobile/src/app/child/prova/[examId].tsx` — süre doldu notu (otomatik bitirme bu ekranda tetiklendiyse **veya** sunucu satırı `finished_at ≥ deadline_at − 5 sn`)
- `apps/mobile/src/app/parent/prova/attempt/[attemptId].tsx` — veli notu (`deadline_at` seçimi eklendi)
- `apps/mobile/src/components/learning/repeat-calendar.tsx` — `DateChoice`/`TimeChoice`
- `apps/mobile/src/lib/prova-booklet.ts` — gömülü yazı tipleri
- `packages/core/src/attempt-summary.ts` (+test) — `attemptEndedByTime`, `TIME_UP_TOLERANCE_MS`
- `packages/core/src/prova-booklet.ts` (+test) — `withBookletFonts`
- `packages/core/src/i18n/{tr,en}.json` — yeni: `d8.timeUpTitle`, `d8.timeUpChild`, `d8.timeUpParent`, `d8.repeatDate`, `d8.repeatTime`
- `apps/mobile/package.json`, `pnpm-lock.yaml` — `expo-asset ~58.0.20` doğrudan bağımlılık olarak bildirildi (zaten `expo`'nun bağımlılığıydı, aynı sürüm; kilit dosyasına yalnız importer satırı eklendi, `--frozen-lockfile` geçiyor). Native modül zaten derlemedeydi; yeni native derleme gerekmedi
- `scripts/test-d8-flows.cjs` — 5 kontrol (yeni)
- Belgeler: bu README, matris

## Test kanıtı (gerçek çıktılar)

| Test | Sonuç |
|---|---|
| `pnpm install --prefer-offline --frozen-lockfile` | Çıkış 0 (başta ve kilit güncellemesinden sonra) |
| Mobil `pnpm exec tsc --noEmit` | `TSC_EXIT 0` |
| Mobil `pnpm exec expo lint` | `LINT_EXIT 0` |
| `pnpm --filter @gina/core test` | 60 dosya, **430** test geçti (yeni: `attemptEndedByTime` ×4, `withBookletFonts` ×1) |
| İzole servis (`--run-local --with-storage --with-realtime --ui-hold`, `GINA_QA_UI_PLAN=pro`, D8'e özel fixture yolu, Metro 8093 / web 8581 / yönlendirme 59481) | 2 koşu, her biri **477/477** servis kontrolü; temizlik her ikisinde: storage, realtime, rest, auth, geçici DB kaldırıldı (`gina_http_44ed…`, `gina_http_0fc3…`). Bitişte `gina_http_*` kapsayıcısı 0 |
| `scripts/test-d8-flows.cjs` (son koşu, temiz fixture) | **5/5** → [`ui/checks.json`](ui/checks.json). Ölçüler 390×844 ve 768×1024; her görüntüde yatay taşma 0, çözülmemiş anahtar 0, `pageerror` 0. Reduced-motion `reducedMotion: 'reduce'` ile |
| iOS simülatör (iPhone 17 Pro, iOS 26.5, D4 dev-client derlemesi) | Metro (bu dal) → izole fixture (loopback). Giriş → `gina://parent/prova/booklet` → Matematik · 5 → “Öğrenci nüshasını oluştur” → PDF + paylaşım sayfası. `pdffonts`/`pdftotext` yukarıda |

İlk Playwright koşusunda 2 kontrol test betiği kaynaklı düştü (sihirbaz 2 soruyla başlıyor; radyo sayımı sayfa yüklenmeden yapıldı) — betik düzeltildi; aynı fixture'da ikinci koşu tekrar planı zaten kayıtlı olduğu için ayrıca düştü. Son sonuç yeni fixture'daki temiz koşudur.

**Test türü ayrımı**
- **Gerçek, izole:** Auth, REST, Realtime, Storage; Playwright Chrome headless, `tr-TR`, `Europe/Istanbul`; iOS simülatörde gerçek `Print.printToFileAsync`.
- **Taklit:** (A) süre dolumunda Playwright `clock.fastForward('10:05')` (sunucu saati değişmez; bu yolda veli notu beklenmez çünkü sunucuda `finished_at < deadline_at`); (B) sunucu yolu için geçici DB'de denemenin `started_at`/`deadline_at` değeri 11 dk geri alındı (çocuk süre bitmişken ekrana dönmüş gibi) → gerçek otomatik bitirme, `finished_at ≥ deadline_at` = `true`. Kök neden araştırması macOS WKWebView ile (aynı WebKit/CoreGraphics).
- **Yapılmadı:** fiziksel iPhone/iPad, iPad simülatörü, Android PDF yolu; VoiceOver; gerçek yazıcı. `groups.tsx` ve `question-media.tsx` pencereleri fixture'da açılamadı (grup/görsel verisi yok) — aynı tek satır değişiklik, ölçülmedi.

## Kalan sınır

- **D8-1 (P2):** D4-4 yalnız iPhone 17 Pro simülatöründe doğrulandı; fiziksel cihaz ve Android (C15). `groups`/`question-media` reduced-motion ölçümü yapılmadı.
- Süre doldu notu cihaz saati sunucudan 5 sn'den fazla ileride olup süreden önce gönderilen denemede yanlışlıkla görünebilir (pay `TIME_UP_TOLERANCE_MS`); süre sonu otomatik bitirmede not her zaman görünür.
- Simülatörde uygulamanın eski (D4 fixture'ına ait, artık geçersiz) oturum deposu `ExpoSQLiteStorage` scratchpad'e taşındı (silinmedi); simülatördeki uygulama şimdi kapanmış D8 fixture'ının oturumunu tutuyor — bir sonraki kullanımda yeniden giriş gerekir. iPhone 17 Pro açık bırakıldı.

## Yeniden çalıştırma

```
GINA_QA_UI_FIXTURE=<scratch>/d8_fixture.json GINA_QA_UI_PLAN=pro python3 scripts/test-isolated-services.py --run-local --with-storage --with-realtime --ui-hold
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59481 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-d8 npx expo export -p web --output-dir <scratch>/d8_web
node docs/release/c04-2026-11-06/ui/serve-export.cjs <scratch>/d8_web 8581
GINA_QA_UI_FIXTURE=… GINA_QA_WEB=http://127.0.0.1:8581 GINA_QA_WEB_BACKEND=http://127.0.0.1:59481 GINA_QA_WEB_ANON=placeholder-anon-d8 \
  GINA_QA_PLAYWRIGHT_PATH=<playwright> GINA_D8_DB=<yalnız bu koşunun gina_http_*_audit DB'si> GINA_D8_OUT=<out> node scripts/test-d8-flows.cjs
```

Bitince tutucu sürece `SIGUSR2` gönderilir. Görüntülerde yalnız sentetik `@example.invalid` hesaplar vardır; şifre ve anahtar dosyalara yazılmadı.
