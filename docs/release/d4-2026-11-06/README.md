# D4 — C12 mobil kalanları (T1 alt akışları + açık P2'ler)

6 Kasım 2026 · Dal `worktree-agent-acfddf199a7436ed5` · Taban main `88b31be` · **Yayımlanmadı** (main'e push yok, migration yok, üretime dokunulmadı; i18n'e anahtar eklenmedi).

Tek takip matrisi güncellendi: [`../experience-review/SCREEN-REVIEW-MATRIX.md`](../experience-review/SCREEN-REVIEW-MATRIX.md) (`d4/` = `ui/`).

## Sonuç özeti

| Kalem | Önce | Sonra | Kanıt |
|---|---|---|---|
| T1 · Ortak kaynak adım 2–3 | GÖRÜLEMEDİ | **TE**: içerik → 2 soru (boş soruyla önizlemeye geçilemedi) → önizleme → kayıt; DB'de grup v1, 2 üye | `ui/shared-source-step2-*`, `step3-*`, `saved-*` (4 ölçü) |
| T1 · Dolu tekrar planı kaydı | GÖRÜLEMEDİ | **TE**: 2 soru + 3 buluşma seçildi, 1. buluşma saati 18:30'a düzenlendi → kontrol → takvime ekle; 3 etkinlik (18:30, 17:00, 17:00); yeniden açınca kayıtlı özet, ikinci plan yok | `ui/repeat-{choose,filled,preview,saved}-*` |
| T1 · Plan gün onayı / çakışma | GÖRÜLEMEDİ | **TE**: 2 gün seçildi → “Seçilen 2 günü gözden geçir” → “2 etkinliği takvime ekle”; `study_plan_calendar_items` 2 satır, plan `draft → approved`. Çakışma uyarısı (“Bu saatlerde başka planlar var”) **yineleme koşusunda** görüldü (o fixture'da aynı saatte etkinlik vardı); son koşuda çakışan etkinlik yoktu | `ui/plan-days-*`, `ui/plan-days-preview-overlap-iteration-phone.png`, `ui/checks-iteration-plan-overlap.json` |
| T1 · “Belgeden yararlan” | GÖRÜLEMEDİ | **TE**: hazırlayıcı → Soru ekle → Belgeden yararlan → PNG dosya seçici → onaysız “Soruları hazırla” kapalı → onay → izole Edge `prova-generate` (deterministik sağlayıcı) 3 öneri → tümünü seç → taslak: “Belgeden üretildi 3”; kaynak `document/ready` | `ui/document-{open,ready,proposals,added}-*` |
| T1 · 10 dk süre dolumu | GÖRÜLEMEDİ | **TE**: süreli (10 dk) Prova, sunucu `deadline_at − started_at = 10 dk`; 1 cevap verildi; **tarayıcı saati 10:05 ileri alındı** → otomatik bitirme, deneme `in_progress → submitted`, sonuç “1 / 1 doğru” (cevap kaybı yok), `pageerror` 0. Bulgu D4-2 | `ui/timer-{running,timeup-moment,ended}-*` |
| T1 · Veli PIN'i tanımsız kartı | GÖRÜLEMEDİ | **Gözlendi (D2 alanı, değişiklik yok)**: yeni sentetik aile + 1 çocuk, PIN yok → “Önce ebeveyn alanını koruyalım” kartı, çocuk seçimi gizli, tek eylem “Ebeveyn PIN’i belirle” → `/parent/menu?section=security`. 4 ölçüde taşma 0. Kusur görülmedi | `ui/parent-pin-missing-*` |
| Q00-C12-12 pencere solması | A | **DÜZ (kısmi)**: `DecisionSheet` ve `timetable-import` `useRouteMotion` kullanıyor. Ölçüm (çocuk Prova “gönder” onayı): reduce → çalışan animasyon 0/6 örnek; normal → 4/6 | `ui/checks.json`, `ui/modal-{reduce,no-preference}-phone.png` |
| Q00-C12-13 giriş odak halkası | A | **DÜZ**: Ölçüm, son öğeden sonraki durağın `BODY` (sekme dizisinin sonu) olduğunu gösterdi — kaydırma kabı sekme dizisinde değil. Kap Chrome'da yine odaklanabilir; `data-gina-scroll` + `:focus-visible` 3 px halka eklendi, klavye kipinde ölçüldü (`solid 3px rgb(96,66,222)`) | `ui/sign-in-scroll-focus-phone.png` |
| Q00-C12-T3 kitapçık sınıfı | A | **DÜZ**: serbest 2 haneli alan → 1–12 radyo grubu (`radiogroup`, “N. sınıf” adları); metin kutusu 0, radyo 12 | `ui/booklet-grade-*` (4 ölçü), `ui/ios-booklet-grade-iphone17pro.png` |
| Prova kitapçığı native PDF | yalnız web | **TE (iOS simülatör)**: iPhone 17 Pro, yerel dev-client derlemesi; `Print.printToFileAsync` → A4 (595×842 pt) 4 sayfa PDF, 65 KB, paylaşım sayfası açıldı; öğrenci nüshasında “cevap anahtarı/çözüm” metni 0. Bulgu D4-4 | `ui/ios-booklet-pdf-share-iphone17pro.png`, `ui/ios-booklet-student-copy.pdf`, `ui/ios-booklet-student-copy-p-1.png` |

## Değişen dosyalar

- `apps/mobile/src/components/ui/decision-sheet.tsx` — `animationType={animation}` (`useRouteMotion`)
- `apps/mobile/src/components/planner/timetable-import.tsx` — aynı
- `apps/mobile/src/components/ui/screen.tsx` — `SCROLL_FOCUS` (`dataSet.ginaScroll`), `Screen` kaydırma kabında
- `apps/mobile/src/components/ui/parent-screen.tsx` — `ParentScreen` kaydırma kabında `SCROLL_FOCUS`
- `apps/mobile/src/global.css` — `[data-gina-scroll]:focus-visible` halkası (yalnız web)
- `apps/mobile/src/app/parent/prova/booklet.tsx` — sınıf: radyo grubu (D1 Prova alanı; yalnız kitapçık ekranı, izinli kapsam)
- `scripts/test-d4-flows.cjs` — 9 akış/kontrol (yeni)
- Belgeler: bu README, matris

## Test kanıtı (gerçek çıktılar)

| Test | Sonuç |
|---|---|
| `pnpm install --prefer-offline --frozen-lockfile` | Çıkış 0 |
| Mobil `pnpm exec tsc --noEmit` | Çıkış 0 |
| Mobil `pnpm exec expo lint` | `LINT_EXIT 0` |
| `pnpm --filter @gina/core test` | 58 dosya, 415 test geçti |
| İzole servis (`--run-local --with-storage --with-realtime --ui-hold`, `GINA_QA_UI_PLAN=pro`, D4'e özel fixture yolu) | 2 koşu, her biri **477/477** servis kontrolü; temizlik: storage, realtime, rest, auth, geçici DB kaldırıldı (D4'ün `gina_http_daab…`, `gina_http_79e8…` kalmadı). Başka ajanın `gina_http_7c38…` kümesine dokunulmadı |
| `scripts/test-d4-flows.cjs` (son koşu, temiz fixture) | **10/10** kontrol geçti → [`ui/checks.json`](ui/checks.json). Ölçüler 390×844, 360×640, 768×1024, 1280×800; her ekran görüntüsünde yatay taşma 0, çözülmemiş anahtar 0 |
| iOS simülatör (iPhone 17 Pro, iOS 26.5) | `expo prebuild -p ios` (yok sayılan `ios/`) + `pod install` + headless xcodebuild **BUILD SUCCEEDED** (772 s); Metro → izole fixture (loopback). Giriş → `gina://parent/prova/booklet` → Matematik · 5 → “Öğrenci nüshasını oluştur” → PDF + paylaşım sayfası |

**Test türü ayrımı**
- **Gerçek, izole:** Auth, REST, Realtime, Storage, Edge (`learning-source`, `prova-generate`); Playwright Chrome headless, `tr-TR`, `Europe/Istanbul`.
- **Taklit:** süre dolumu için Playwright `clock.fastForward('10:05')` (sunucu saati değişmedi; bitiş `finish_exam_attempt` ile istemciden). Çalışma planı satırı geçici DB'ye `psql` ile eklendi (izole AI sağlayıcısı `prova-plan` şemasını üretmiyor); onay/takvim yolu gerçek RPC. AI çıktısı deterministik sağlayıcı.
- **Yapılmadı:** iPad Air'de native PDF (süre); fiziksel cihaz; VoiceOver; gerçek yazıcı.

## Yeni bulgular (P2, açık; hepsi başka sahibin dosyası)

- **D4-2 (D1):** süre dolunca sonuç ekranı yalnız “Deneme bitti!” diyor; “Süre doldu” durumu ekranda görülmeden sonuç açılıyor (`timeUpMomentShowsSüreDoldu: false`). Cevap kaybı yok. `app/child/prova/[examId].tsx`.
- **D4-1 (D1):** ortak kaynak sihirbazında “Sınıf” hâlâ serbest 2 haneli alan (kitapçıktaki radyo kalıbı uygulanabilir).
- **D4-3 (Prova):** tekrar takvimi gün düzenlemede tarih/saat serbest metin (“Tarih (YYYY-AA-GG)”, “Saat (SS:DD)”); `DateTimeChoice` kalıbı önerilir.
- **D4-4 (kitapçık):** native PDF metin katmanında SF UI alt kümesi Unicode eşlemesiz; `pdftotext` “i”yi “!” çıkarıyor (görsel doğru). PDF içi arama/kopyalama/erişilebilirlik etkilenir. Web yazdırmada görülmedi. Bu turda düzeltilmedi (cihazda doğrulama gerekir).
- **Q00-C12-12 kalan (D1):** `parent-review-workspace.tsx` ×4, `prova/groups.tsx` ×3, `question-media.tsx` ×1 sabit `fade`. Düzeltme aynı tek satır (`const { animation } = useRouteMotion()`); D1 dosyaları olduğu için dokunulmadı.

## Kalan sınır

- C15 fiziksel kabul (VoiceOver/TalkBack, sistem yazı ölçeği, gerçek yazdırma) değişmedi.
- Native PDF yalnız iPhone 17 Pro simülatöründe; iPad Air ve Android yok.
- `ios/` klasörü worktree'de yerel derleme için kaldı (git yok sayar); simülatörde yeni dev-client yüklü, iPhone 17 Pro açık bırakıldı.
- Çakışma uyarısı son koşuda değil yineleme koşusunda kanıtlandı.

## Yeniden çalıştırma

```
GINA_QA_UI_FIXTURE=<scratch>/d4_fixture.json GINA_QA_UI_PLAN=pro python3 scripts/test-isolated-services.py --run-local --with-storage --with-realtime --ui-hold
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59471 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-d4 npx expo export -p web --output-dir <scratch>/d4_web
node docs/release/c04-2026-11-06/ui/serve-export.cjs <scratch>/d4_web 8571
GINA_QA_UI_FIXTURE=… GINA_QA_WEB=http://127.0.0.1:8571 GINA_QA_WEB_BACKEND=http://127.0.0.1:59471 GINA_QA_WEB_ANON=placeholder-anon-d4 \
  GINA_QA_PLAYWRIGHT_PATH=<playwright> GINA_D4_DB=<yalnız bu koşunun gina_http_*_audit DB'si> GINA_D4_OUT=<out> node scripts/test-d4-flows.cjs
```

Bitince tutucu sürece `SIGUSR2` gönderilir. Görüntülerde yalnız sentetik `@example.invalid` hesaplar vardır; şifre ve anahtar dosyalara yazılmadı.
