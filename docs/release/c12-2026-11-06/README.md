# C12 — bütün ekranların son deneyim düzeltmesi (Q00/U01–U09/P/B)

6 Kasım 2026 · Dal `worktree-agent-a2e5216e406538887` · Taban main `6bdb564`, sonra main `cf391d8` (C09 + C11) birleştirildi (`3ce0bac`) · **Yayımlanmadı** (main'e push yok, üretime dokunulmadı, migration yok).

Tek takip matrisi: [`docs/release/experience-review/SCREEN-REVIEW-MATRIX.md`](../experience-review/SCREEN-REVIEW-MATRIX.md).

## Eski görev kimlikleriyle bağlantı

Q00 (yedi bakış açısı, tek matris), U01–U09 (veli/çocuk ekranları), P01–P05 (Prova zinciri), B01–B04 (yönetim), C11 devri (tatil gösterimi). A1/A2/A3 bulguları tek listede uzlaştırıldı. Sonradan düzelmiş olanlar kanıtla kapatıldı, yeniden açılmadı.

## Durum

- **KOD HAZIR + İZOLE TEST EDİLDİ (web).**
- Fiziksel cihaz kabulü **yapılmadı**, C15'e kalır: VoiceOver/TalkBack, sistem `fontScale`, safe area, dokunmatik defter, native yön.
- Açık P0/P1 yok. P2'ler matris §5'te takip kimliğiyle duruyor.

## Sayılar

| Ölçüt | Değer |
|---|---|
| Envanter | Mobil 62 rota dosyası; yönetimde 21 sayfa ve 5 kütüphane sekmesi; modal/sihirbaz/durum birimleri. Matriste toplam 86 birim. |
| Bu turda gerçek uygulamada dolaşılan | 76 mobil rota/durum ziyareti; ölçüler: 390×844, 360×640, 768×1024, 1280×800. Ayrıca 7 ekran %135 ölçekte. |
| Defter | 4 ölçüde sınandı. |
| Yönetim | 23 sayfa/sekme, 1280×800 ve 768×1024'te sınandı. |
| Tatil gösterimi | 3 ekran × 2 ölçü. |
| Yeni bulgu (Q00-C12-n) | 14: P1 ×2 (ikisi düzeltildi); P2 ×12 (9 düzeltildi, 2 açık takip, 1 gerekçeli “sorun yok”). |
| Bu turda kapatılan eski bulgu | Q00-A2-9, -10, -11, -13; Q00-A3-5; B02 ortak soru editörü (P1). |
| Önceki raporlarla kapalı sayılan | A1'in 19 bulgusunun tamamı; A2'nin P0/P1'leri ve -6, -8, -12; A3'ün P1'leri ve B01/B03/B04. Kanıtları matris §1b–1d'de. |
| Engelli (dış bağımlılık) | 4: sosyal giriş sağlayıcısı; e-posta/hesap silme Edge başarı yolu; push/izin durumları; gerçek AI ile “hazır” haftalık özet. |
| GÖRÜLEMEDİ | 6 alt akış (T1): ortak kaynak adım 2–3, dolu tekrar planı kaydı, plan gün onayı, “Belgeden yararlan”, 10 dakikalık süre dolumu, veli PIN'i tanımsız kartı. |

## Commit'ler (bu dalda)

| Commit | Ekran / kapsam |
|---|---|
| `4143cdd` | Prova hazırlayıcı “Hedefi N soru yap” (Q00-A2-9); çocuk takvimi boş gün metni (Q00-A2-11, i18n **değer düzeltmesi**: `planner.childEmptyBody` tr/en) |
| `4e2b33c` | Veli incelemesi “Çizimli not ekle” görünür düğme (Q00-A2-10) |
| `e3d69cc` | `ErrorText`: sınıflandırılmış AI/Edge hata metni (Q00-A2-13) |
| `1f72f77` | Menü/ana ekran/profil arşivi/ses kaynakları ayırt edici ekran okuyucu adları; tek çocukta `ChildPicker` (Q00-C12-3, -8) |
| `aeec266` | Yönetim girişi: rol hatası ≠ yetkisiz (Q00-A3-5); `/operations` hedef ve etiketler (Q00-C12-11) |
| `77720b8` | Seviye tespiti sayıları `NumberChoice` ile (Q00-C12-5) |
| `e6e5a1a` | 27 çip/sekmede `aria-pressed` / `aria-selected` / `aria-current` (Q00-C12-4) |
| `2a0e998` | Yönetim iş kuyruğu hedefleri; soru bankası filtre etiketleri (Q00-C12-9, -10) |
| `4e39032` | Prova merkez sekmeleri büyük yazıda (Q00-C12-1, **P1**) |
| `039fce2` | Tekrar günleri, sonuç özeti, toplu arşiv, inceleme soru seçicisi (Q00-C12-3, -6) |
| `dc595e6` | Takvim şeridi “?” → “–” (Q00-C12-7) |
| `3ce0bac` | main (C09, C11) birleştirme; i18n çakışması iki bloğu koruyarak çözüldü |
| `5d2f790` | Okul tatili “program duraklatıldı” gösterimi (Q00-C12-2, **P1**, C11 devri) + çekirdek şema/test |
| `1d351b0` | Soru bankası düzenleyicisinde şıklar alan alan (B02, **P1**) |
| (bu commit) | Tek matris, rapor, `scripts/test-c12-*.cjs`, kanıtlar |

## Değişen dosyalar

**Mobil**
- `app/parent/{menu,profile-archive,room-credits}.tsx`
- `app/parent/prova/{index,level,booklet,question}.tsx`, `app/parent/prova/attempt/[attemptId].tsx`
- `components/learning/{prova-builder,parent-review-workspace,repeat-calendar,notebook-editor,notebook-workspace,drawing-pad,learning-progress-view,prova-draft-overview,shared-question-wizard}.tsx`
- `components/planner/{ui,calendar-screen,bulk-scope-sheet,plan-history-note}.tsx`, `components/planner/week-plans.ts`
- `components/calendar/day-plan.tsx`
- `components/parent-home/home-view.tsx`, `app/parent/index.tsx`
- `components/room/{child-home,atmosphere-controls}.tsx`, `lib/use-child-today.ts`
- `components/ui/{screen,parent-screen}.tsx`
- `components/setup/{child-setup,beta-plans}.tsx`, `components/rewards/rewards-screen.tsx`

**Yönetim**
- `pages/{sign-in,operations,questions}.tsx`
- `components/workqueue.tsx`
- `lib/i18n.ts` (yalnız yeni anahtar)

**Çekirdek**
- `plan-history.ts`: `holiday`, `paused`, `pausedHoliday`
- `plan-history.test.ts`
- `i18n/{tr,en}.json`: yeni `c12.*` anahtarları ve 1 değer düzeltmesi

**Betikler:** `scripts/test-c12-tour.cjs`, `test-c12-backoffice-tour.cjs`, `test-c12-holiday-ui.cjs`, `test-c12-summary.cjs`

## Test kanıtı (gerçek çıktılar)

| Test | Sonuç |
|---|---|
| `pnpm --filter @gina/core test` | 58 dosya, 415 test geçti (yeni tatil testi dahil) |
| Mobil `pnpm exec tsc --noEmit`, `pnpm exec expo lint` | Çıkış 0 (son değişiklikten sonra) |
| Backoffice `pnpm typecheck`, `pnpm lint`, `pnpm build` | Çıkış 0; statik çıktı 3 kez yeniden derlendi |
| İzole servis (`test-isolated-services.py --run-local --with-storage --with-realtime --ui-hold`, `GINA_QA_UI_PLAN=pro`, kendi fixture yolu) | 476/476 servis kontrolü geçti. Temizlik: storage, realtime, rest ve auth kaldırıldı, geçici DB silindi. `gina_http_*` DB ve konteyner kalmadı. |
| `test-c12-tour.cjs` önce (main) | 62 ziyaret; 3/3 kontrol geçti. [`ui/before/metrics.json`](ui/before/metrics.json) |
| `test-c12-tour.cjs` sonra | 76 ziyaret, hata 0. Kontroller: klavye, ilk aile + tek çocuk, reduced motion, defter: 4/4 geçti. [`ui/after/metrics.json`](ui/after/metrics.json), [`ui/after/checks.json`](ui/after/checks.json) |
| Ölçüm (sonra) | Bütün ölçülerde yatay taşma 0, çözülmemiş anahtar 0, isimsiz eylem 0, kesilen düğme metni 0, `pageerror` 0. %135'te 44 px altı hedef: 1 → 0. Tekrar eden ad: yalnız gerekçeli olanlar (Q00-C12-14). |
| `test-c12-backoffice-tour.cjs` | 23 sayfa × 2 ölçü, hata 0. 4/4 kontrol geçti: yapılandırılmış şık editörü (gerçek global soruyla), rol hatası metni, rolsüz hesap metni, `pageerror` yok. [`ui/backoffice/bo-checks.json`](ui/backoffice/bo-checks.json) |
| `test-c12-holiday-ui.cjs` | 4/4 geçti. **Taklit:** `plan_for_day(s)` yanıtına tarayıcıda kabul edilmiş tatil ve duraklatılmış ders eklendi; sunucuda tatil üretilmedi. [`ui/holiday/holiday-checks.json`](ui/holiday/holiday-checks.json) |

**Test türü ayrımı**
- **Gerçek, izole:** Auth, REST, Realtime, Storage ve Edge; Playwright Chrome headless, `tr-TR`, `Europe/Istanbul`.
- **Taklit:**
  - Tatil RPC yanıtı.
  - Yönetimde rol RPC'sinin 503 dönmesi.
  - %135 büyük yazı yaklaşımı. Bu, tarayıcı ölçeğidir; `fontScale` değildir.
- **Yapılmadı:** gerçek AI, gerçek e-posta/SMS/push, fiziksel cihaz.

**Negatif, yetki ve idempotency senaryoları**
- Rolsüz yönetim hesabı “yetki yok” görür.
- Rol RPC'si hata verirse “kontrol edilemedi” görünür, “yetki yok” denmez.
- Anonim oturum veli rotasına giremez (`/child` → `/device/pair`).
- Geçersiz paylaşım, abonelikten çıkma ve doğrulama bağlantıları denendi.
- Bekleyen veya kapatılmış tatil önerisi hiçbir şeyi duraklatmaz (çekirdek testi).
- Boş şık kaydedilmez. Kullanılmış soruda sunucu kuralı değişmedi.
- Sunucu tarafında yeni yazma yolu yok; idempotency sözleşmeleri önceki C raporlarında.

## Onaylı referansla karşılaştırma

- Mint/mor/krem, Nunito/Baloo 2 ve maskot korundu.
- Yeni görsel bileşen yok. Tatil notu mevcut nane bilgi kartı dilinde (`#E7F5EE`). “Çizimli not ekle” mevcut ikincil düğme dilinde.
- Ekranlar çalışan uygulamadan alındı; maket yok. Karşılaştırma `docs/design/screens/{parent-home-mint,child-home-mint,calendar-premium,prova-notebook}` düzenine göre yapıldı: yerleşim değişmedi, yalnız etiket, hedef ve metin düzeltmeleri var.

## C11 devri: tatil

Gösterim yalnız veli kararı `accepted` iken çıkar. Görünüm:
- Takvim gün kartı: “Okul tatili — program duraklatıldı”. Çok çocukta notun başında çocuk adı yazar.
- Veli ana ekranı plan kartı: “Ad: okul tatili — ders programı duraklatıldı”.
- Çocuk Bugün: tatil adı ve “Bugün okul tatili. Ders yok; dinlenebilirsin.”

Davranış:
- Duraklatılan dersler o günün programı olarak listelenmez. Ders programı silinmez; not bunu söyler.
- Çanta ve görevler sunucunun döndürdüğü gibi kalır: sunucu yalnız ders satırlarını `paused` yapıyor (C11 README).
- `plan_for_days`, `public.plan_for_day`'i çağırdığı için hafta görünümleri de aynı işareti alır.

## Kalan sınır

- **C15 fiziksel kabul:**
  - VoiceOver/TalkBack ve sistem büyük yazı
  - Safe area ve çentik (kodda `insets`/`SafeAreaView` var)
  - Native modal yön (bütün `Modal`'larda `supportedOrientations` var, kodla tarandı)
  - Dokunmatik defterde dış kaydırma ve kalem/parmak ayrımı
  - Push izinleri
- **T1 GÖRÜLEMEDİ listesi:** 6 alt akış (Sayılar tablosunda). Bilinen kusur yok; sentetik veri veya süre gerekiyor.
- **Açık P2'ler:**
  - T2: `window.confirm` (`/ai`, `/questions`)
  - T3: kitapçık sınıf alanı serbest metin
  - Q00-C12-12: modal solması reduced motion'a bakmıyor
  - Q00-C12-13: giriş kaydırma kabında odak halkası yok
  - Q00-A3-4: kenar menü kaydırma çubuğu
  - Q00-A3-7: yönetici yetki iptali bildirimi (yönetici kısmı)
- **Yalnız kodla doğrulananlar:**
  - Q00-A2-9: hazırlayıcı kontrol adımına kadar sürülmedi.
  - Q00-A2-13: gerçek Edge hata ekranı üretilmedi.
- **C09 ön inceleme bileşenleri:** bu turda yalnız sayfa açılışı görüldü. Ayrıntısı C09 raporunda.
- **Eşlenmiş çocuk cihazı:** JWT yolu bu turda koşulmadı. Aynı bileşenler veli telefonundaki çocuk modunda sınandı.
- **Belgeler:** `docs/learning/DEVELOPMENT-STATUS.md` güncellenmedi, çünkü kart C15 olmadan kapanmıyor. C12 satırına durum notu eklendi.

## Yeniden çalıştırma

```
GINA_QA_UI_FIXTURE=<scratch>/c12_fixture.json GINA_QA_UI_PLAN=pro python3 scripts/test-isolated-services.py --run-local --with-storage --with-realtime --ui-hold
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59412 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-c12 npx expo export -p web --output-dir <scratch>/web
node docs/release/c04-2026-11-06/ui/serve-export.cjs <scratch>/web 8513
GINA_QA_UI_FIXTURE=… GINA_QA_WEB=http://127.0.0.1:8513 GINA_QA_WEB_BACKEND=http://127.0.0.1:59412 GINA_QA_WEB_ANON=placeholder-anon-c12 \
  GINA_QA_PLAYWRIGHT_PATH=<playwright> GINA_C12_OUT=<out> node scripts/test-c12-tour.cjs   # aynı ortamla test-c12-holiday-ui.cjs
cd apps/backoffice && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59413 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-c12bo pnpm build
node docs/release/c04-2026-11-06/ui/serve-export.cjs apps/backoffice/out 8514
GINA_QA_UI_FIXTURE=… GINA_BO_WEB=http://127.0.0.1:8514 GINA_BO_BACKEND=http://127.0.0.1:59413 GINA_BO_ANON=placeholder-anon-c12bo GINA_C12_OUT=<out> node scripts/test-c12-backoffice-tour.cjs
node scripts/test-c12-summary.cjs <out>/metrics.json
```

Bitince tutucu sürece `SIGUSR2` gönderilir. Görüntülerde yalnız sentetik `@example.invalid` hesaplar vardır; şifre ve anahtar dosyalara yazılmadı.
