# C04 — Tek Prova hazırlama ve inceleme akışı (P01–P05) · 6 Kasım 2026

C04 ajanı (Claude Opus 5.5). Dal `worktree-agent-a2cff95043ac81679`, taban main `fcfe8e5`. Çalışma 12:05–13:20 Europe/Istanbul.
**Main'e push edilmedi; üretime dokunulmadı; `db reset` yapılmadı; ücretli/gerçek AI çağrısı yapılmadı.** Tek migration:
`20261106240000_prova_draft_context.sql`; pgTAP `110`. i18n'e yalnız yeni anahtar eklendi (65 anahtar, tr+en; silinen/değişen yok).

| Alan | Durum |
|---|---|
| Kod | KOD HAZIR (bu dal) |
| Test | TEST EDİLDİ — izole servis + Playwright (web export), pgTAP iki saat dilimi, Deno, core, tsc/lint |
| Gerçek AI kabulü | **BEKLİYOR — C08'e bağlı** (aşağıda) |
| Native PDF / fiziksel cihaz | **Yapılmadı** (aşağıda) |
| Yayın | Yayımlanmadı |

## Commit'ler

| Commit | İçerik |
|---|---|
| `0c6e3a2` | Sunucu: taslak bağlamı (ders/karma, MEB Ortak Yazılı/LGS/serbest, dönem, program, eğitim yılı, dönem kaydı, okul, okul beyanı) + gönderimde sınav sütunları + dönem/okul değişim kontrolü; açık uçlu alternatif cevap + rubrik; Edge `prova-grade`/`prova-review` yüküne alternatif/rubrik; core yardımcıları; pgTAP 110 |
| `0a56eb9` | Mobil: merkez Hazırla/Gönderilenler/İncelenecekler; eski girişler açık taslağa; bağlam kartı; AI "kalanı tamamla / bütün sınav" + "önerilerin tümünü seç"; editörde alternatif/rubrik; incelemede şık gerekçesi/alternatif/rubrik ve AI önerisi ≠ veli puanı etiketi; izole Edge'e `prova-generate` |
| (bu rapor) | README, `ui/ui-check.cjs`, `ui/serve-export.cjs`, `ui/ui-checks.json`, 43 görüntü, `services.json`, `tz-istanbul/`, `tz-utc/` |

## Ne değişti

| Kart maddesi | Önce | Sonra |
|---|---|---|
| Merkez sadeleşmesi | Sekmeler Provalar / Sonuçlar / Kütüphane; aynı deneme hem "İncelemeni bekliyor" hem gönderilen kartında (Q00-A2-8) | `parent/prova/index.tsx`: **Hazırla** (açık taslaklar + soru/kaynak araçları), **Gönderilenler** (atanan sınavlar, durum; bekleyen çözümde "İncelenecekler'e git"), **İncelenecekler** (bekleyen tüm çözümler + gelişim + incelenenler). Sekme rozetleri: açık taslak / açık atama / bekleyen inceleme sayısı. `?tab=` ile derin bağlantı. |
| Eski girişler → mevcut taslak | `generate`/`exam` her zaman boş yeni hazırlayıcı | `components/learning/prova-draft-entry.tsx`: açık (gönderilmemiş) taslak varsa (çocuk verildiyse o çocuğun) onu açar; yoksa yeni. Taşınan ortak kaynak grubu otomatik yazılmaz; hazırlayıcıda "Taslağa ekle" onayıyla eklenir. Kütüphane paketlerindeki "başla" da bu yola alındı. |
| Tek sınavda elle + kütüphane + belge + AI + ortak metin/görsel | Mevcut (P01) | Korundu; kabul zincirinde gerçek servisle kanıtlandı (aşağıda). Ayrı "birlikte düşünülen sorular" ürünü açılmadı. |
| Kısmi/tam AI; tüm öneriler seçilebilir; seçim ikinci ücret yok | Öneriler tek tek seçiliyordu | Kaynak seçicide **"Kalan N soruyu AI ile tamamla"** / boş taslakta **"Bütün sınavı AI ile hazırla (N soru)"** (tek istek, en çok 30); **"Önerilerin tümünü seç (N)"** + "Aynı üretimden seçmek yeni üretim veya ek hak kullanmaz." Kabul zincirinde hak 270→268 (üretim), 268→268 (tümünü seç + ekle). |
| Ders/karma, MEB Ortak Yazılı/LGS/serbest, sınıf/program/dönem, okul beyanı | Yalnız "okulun kapsamı / MEB senaryosu" seçimi; dönem/okul hiçbir yerde | `components/learning/prova-context-card.tsx` (Başlangıç adımı): Tek ders / Karma; MEB Ortak Yazılı / LGS / Serbest çalışma; Dönem (belirtme/1/2); Program (isteğe bağlı, 80); okul + eğitim yılı çocuğun güncel eğitim kaydından (`get_child_education`); "Bu kapsam okulun duyurusuna dayanıyor" (okul beyanı; "Gina bu beyanı doğrulamaz"). Sınıf zaten çocuk/sınıf seçiminden. Özet sütununda sınav türü ve dönem/okul satırları. |
| Dönem/okul sunucu şemasında, eski taslak uyumu | — | Taslak `content.context` (isteğe bağlı, katı şema); gönderimde `exams.exam_scope/assessment_track/term/academic_year/education_period_id/school_declared` (+ `preparation.context`), içerik kilidiyle donar. Bağlamsız eski taslak aynen kaydedilir/gönderilir; hazırlayıcı ilk kayıtta (eğitim kaydı yüklendiyse) bağlamı ekler. |
| Uyuşmazlık anlaşılır, kullanıcı düzeltir | — | Sunucu: `prova_scope_subject_count` (tek ders + birden çok ders), `prova_track_grade` (LGS ≠ 8. sınıf), `prova_child_period_changed` (taslaktan sonra nakil/yeni yıl/okul düzeltmesi). Aynı kurallar core'da (`provaContextIssues`) — kartta ve Kontrol adımında Türkçe açıklama, "Güncel okulu kullan: …" düğmesi (`confirmProvaPeriod`). Çocuk değişince bağlam sıfırlanır. |
| Alternatif açık uçlu doğru cevaplar + rubrik | Yalnız AI üretiminde `provenance.rubric`; veli sorusunda yok; değerlendirmeye gönderilmiyordu | Editör 2. adım: "Kabul edilecek diğer doğru cevaplar" (satır başına) + "Puanlama ölçütleri" (`ölçüt \| puan`, toplam ≤100, ≤10 satır). `save_question_with_sources` `rubric`'i doğrular, `provenance.rubric`'e AI ile aynı şekilde yazar (boş → yok). `prova-grade` ve `prova-review` yüküne `alternatif_dogru_cevaplar` + `rubrik` (yalnız açık uçlu, ad maskeli), istem kuralı eklendi (`prova-grade/v3-answer-key`). Elle katkı paylaşımı isteğe bağlı kaldı. |
| İncelemede soru hep erişilebilir; şıklıda seçilen/doğru/gerekçe | Seçilen/doğru vardı; gerekçe (çeldirici notları/anlatım) gösterilmiyordu | Anahtar bölümünde **"Şıkların gerekçesi"** (şıklı) / "Anlatım" (açık uçlu) + **"Kabul edilen diğer cevaplar"** + **"Puanlama ölçütleri"**. Defterli cevapta telefonda soru+anahtar Değerlendirme sekmesindeki soru alanında, genişte kenar sütunda (kabulde kanıtlandı). |
| Açık uçluda defter + ayrı veli katmanı | Mevcut | Korundu (çocuk kalem çizimi → veli defter görünümü + ayrı not katmanı). |
| Boş cevap çizim yokluğundan 0 sayılmaz | Sunucu P04'te düzeltildi | Kabulde: 2 çizimli → `open_pending=2`, 2 boş → `open_unanswered=2`, `provisional=true`, otomatik 0 yok. |
| AI önerisi ≠ veli kesin puanı | AI'nın yazdığı puan "puanlandı" gibi görünüyordu | Özet listesinde puanın yanında **"AI önerisi"** / **"veli puanı"**; inceleme ekranında AI puanlı cevapta "AI önerisi: N/100. Bu öneri senin puanın değildir; kontrol edip kaydettiğinde veli puanı olur." Veli kaydı `graded_by=parent` (kabulde 80/parent). **Sunucu sınırı aşağıda.** |
| Gelişim/tekrar/plan aynı sınav sürümüne | Mevcut: deneme→atanmış sınav `question_ids` donuk | Kabulde atama sonrası soru düzenleme `question_in_use`, grup yeni sürümü sınavın `question_ids`'ini değiştirmedi; konu istatistiği aynı denemeden. |
| Öğrenci cevap anahtarını alamaz | Sunucu tarafı mevcut | pgTAP 110: cihaz `get_attempt_questions` yükünde anahtar/çözüm/rubrik/provenance/anlatım yok, aile soru satırlarını okuyamaz; Playwright: çocuk modunda 29 yanıtta anahtar/rubrik metni yok. |

## Testler (gerçekten çalıştırıldı)

```
pgTAP 110 (tek dosya, tek kullanımlık klon)                  → 47 ok, 0 not ok
Tam pgTAP, Europe/Istanbul  scripts/test-q02-sql.py --run-local --out docs/release/c04-2026-11-06/tz-istanbul
                                                             → 107 dosya, 4043 assertion, 0 hata
Tam pgTAP, UTC              scripts/test-q02-sql.py --run-local --timezone UTC --out docs/release/c04-2026-11-06/tz-utc
                                                             → 107 dosya, 4043 assertion, 0 hata
Yarışlar (yeni migration'lı tek kullanımlık klon; betik kopyası yalnız DB adını değiştirir)
  test-prova-draft-races.py                                  → PASS: concurrent save rejects stale version; concurrent submit creates exactly one exam
  test-assigned-question-races.py                            → passed: assignment_before_edit, edit_before_assignment, assignment_before_image, image_before_assignment
Deno (supabase/functions, tüm testler)                       → 419 passed, 0 failed (yeni: _shared/answer-key.test.ts 4)
deno check prova-grade, prova-review, scripts/isolated-source-edge.ts → temiz
pnpm --filter @gina/core test                                → 53 dosya, 372 test geçti (yeni: prova-context.test.ts 6)
apps/mobile npx tsc --noEmit                                 → exit 0
apps/mobile npx expo lint                                    → exit 0
expo export -p web (yer tutucu loopback backend)             → başarılı
scripts/test-isolated-services.py --run-local --with-storage --ui-hold (GINA_QA_UI_PLAN=pro, kendi fixture yolu)
                                                             → 274/274 servis kontrolü; storage/rest/auth konteynerleri ve geçici DB silindi (services.json)
docs/release/c04-2026-11-06/ui/ui-check.cjs (Playwright, Chrome headless, 390×844 · 768×1024 · 1280×800)
                                                             → {"ok":true,"count":17} (ui/ui-checks.json)
```

### Kabul zinciri (`ui/ui-checks.json`, 17/17)

Sentetik aile, `example.invalid` hesabı; izole Auth/REST/Storage/Edge. AI: izole Edge'de **değiştirilmemiş `prova-generate` handler'ı** + deterministik sağlayıcı (`scripts/isolated-ai-provider.ts`, yalnız loopback; içerik kalitesi testi değil).

1. Tohum: kütüphane şıklısı + **ortak görsele bağlı iki soru** (görsel gerçek `learning-source` Edge → Storage imzalı yükleme → finalize; `save_question_source_group` iki üyeye aynı görseli bağlar).
2. Merkez üç sekme (3 ölçü).
3. Hazırlayıcı: çocuk seç → Konu pekiştirme → Matematik + Fen Bilimleri → "Tek ders" seçilince "“Tek ders” seçtin ama 2 ders var" → Karma, MEB Ortak Yazılı, 1. dönem, okul beyanı; okul/yıl satırı "2026–2027 · Sentetik Ortaokulu".
4. Kapsam: konu "Kuvvet", 6 soru, Karışık → taslak sunucuda kaydedildi.
5. Kütüphane: şıklı + ortak görsel grubu (3/6). Elle: editörde alternatif "0,5 / yarım" + iki ölçüt (4/6; sunucuda `provenance.rubric` doğrulandı). AI: Fen Bilimleri/Kuvvet, "Kalan 2 soruyu AI ile tamamla" → üret → "Önerilerin tümünü seç (2)" → ekle (6/6); hak 270→268→268.
6. "Bu taslakta: Senin eklediğin 1 · AI önerisi 2 · Kütüphane 3 · 1 ortak kaynak grubu".
7. **Kaydet → sayfayı yeniden aç**: 5 blok (library, library-grup, manual, ai, ai) ve bağlam (`mixed/meb_common/1/okul beyanı/periodId`) korunmuş.
8. Kontrol → ad → onay → **Çocuğuma gönder**: `exams` 6 soru, `exam_scope=mixed, assessment_track=meb_common, term=1, education_period_id=<güncel>, school_declared=true`.
9. **Atanmış sürüm donuk**: atanmış elle soruyu doğrudan güncelleme → `question_in_use`; grubun yeni sürümü kaydedildi, sınavın `question_ids`'i aynı.
10. **Çocuk modu** (çocuk PIN'i): 6 soru; ortak görselli soruda "Ortak içerik" + görsel; iki açık uçluya defterde kalemle çizim, ikisi boş, şıklılar 2/2 doğru → "Deneme bitti!… Açık uçlu cevaplarını ebeveynin inceleyecek." Çocuk modundaki 29 REST/Edge yanıtında beklenen cevap, çözüm, rubrik, alternatif, `correct_key`/`expected_answer` alanı yok.
11. Deneme `submitted`, `provisional=true`, `open_pending=2`, `open_unanswered=2`.
12. Veli: İncelenecekler → özet → şıklı soruda seçilen/doğru + "Şıkların gerekçesi"; elle soruda (defterli) telefonda Değerlendirme sekmesinden soru + "Cevap anahtarı" + "Kabul edilen diğer cevaplar: 0,5 · yarım" + "• Ortak böleni bulur — 40 puan".
13. Veli puanı 80 → "Kaydet ve sonraki" → `score=80, graded_by=parent`.
14. Gelişim ekranı (3 ölçü) + aynı denemenin konu istatistiği (Kesirler, Kuvvet, Tablo okuma).
15. Bütün görüntülerde yatay taşma yok, çevrilmemiş `provaC04./provaBuilder./provaP0x./parentReview.` anahtarı yok, `pageerror` yok.

Yeniden çalıştırma: `GINA_QA_UI_FIXTURE=<yol> GINA_QA_UI_PLAN=pro python3 scripts/test-isolated-services.py --run-local --with-storage --ui-hold`;
export'u `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59321 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-c04 npx expo export -p web`;
`node ui/serve-export.cjs <export> 8494`; `GINA_QA_WEB=http://127.0.0.1:8494 GINA_QA_WEB_BACKEND=http://127.0.0.1:59321 GINA_QA_WEB_ANON=placeholder-anon-c04 GINA_QA_PLAYWRIGHT_PATH=… node ui/ui-check.cjs`; bitince holder sürecine `SIGUSR2`.

### pgTAP 110 kapsamı
Bağlamsız eski taslak kaydet/gönder ve sınavda uydurulmuş bağlam yok; bilinmeyen anahtar/iz, dönem 3, kesirli yıl, metin beyan, nesne olmayan bağlam reddi; başka ailenin eğitim dönemine referans `forbidden`; tek ders + iki ders → `prova_scope_subject_count`; LGS + 6. sınıf → `prova_track_grade`; okul düzeltmesi ve nakil sonrası → `prova_child_period_changed`, veli onayıyla geçer; bağlam sınav sütunlarına taşınır, kilitli sınavda değiştirilemez; rubrik/alternatif kaydı, boş rubrik = yok, rubriksiz eski şekil `{"generator":"parent"}`, puan toplamı >100 / boş alternatif / şıklıda rubrik / bilinmeyen anahtar reddi; atanmış soruda rubrik ve anahtar `question_in_use`; cihaz soru yükünde anahtar/rubrik/çözüm/anlatım yok, aile soru satırı ve taslak okunamaz/yazılamaz; başka aile sınav bağlamını ve rubriği göremez; iç doğrulayıcılar dışarı açık değil.

## Değişen dosyalar

- Sunucu: `supabase/migrations/20261106240000_prova_draft_context.sql` (yeni sütunlar + `gina.guard_exam_context`, `gina.validate_prova_context`, `gina.valid_question_rubric`; `gina.validate_prova_draft`, `public.submit_prova_draft`, `public.save_question_with_sources` yeniden tanımlandı — imzalar aynı), `supabase/tests/110_prova_draft_context.test.sql`.
- Edge: `supabase/functions/_shared/answer-key.ts` (+ test), `prova-grade/index.ts`, `prova-review/index.ts`, `_shared/grade-report.ts`, `_shared/review-report.ts` (istem kuralı).
- Core: `packages/core/src/prova-draft.ts` (`provaContextSchema`, `defaultProvaContext`, `provaContextIssues`, `confirmProvaPeriod`, `provaRemainingCount`, `readQuestionRubric`, `parseRubricInput`), `prova-context.test.ts`, `i18n/tr.json`, `i18n/en.json` (65 yeni anahtar).
- Mobil: `app/parent/prova/{index,generate,exam,question}.tsx`, `app/parent/prova/attempt/[attemptId].tsx`, `app/parent/prova/review/[attemptId].tsx`, `components/learning/{prova-builder,prova-source-picker,parent-review-workspace,library-packages}.tsx`, yeni `components/learning/{prova-context-card,prova-draft-entry}.tsx`. `catalog.tsx`/`blueprint.tsx` (C01/C05) değişmedi.
- Test altyapısı (eklemeli): `scripts/isolated-ai-provider.ts` (Prova üretim şeması), `scripts/isolated-source-edge.ts` (`/prova-generate`), `scripts/test-isolated-services.mjs` (`GINA_QA_UI_PLAN=pro` ile sentetik Pro override; varsayılan davranış değişmedi).

## Kalan sınır (yapılmadı / doğrulanmadı)

1. **Gerçek AI pilotu BEKLİYOR — C08'e bağlı.** Bu ortamda GINA üretim anahtarı izole Edge'e konmadı (talimat gereği). AI yolu yalnız gerçek handler + deterministik sağlayıcıyla sınandı; mock testinden ayrı gerçek sentetik pilot (birkaç çağrı) C08'in sağlayıcı/anahtar kurulumundan sonra yapılmalı. Gerçek modelin `rubric`/`alternative_answers`/`shared_sources` kalitesi doğrulanmadı.
2. **AI ortak kaynak ↔ soru grubu:** AI'nın `shared_sources` çıktısı hâlâ yalnız `provenance.shared_source` olarak saklanıyor; `question_source_groups` grubuna dönüşmüyor, çocuğa ortak metin olarak gösterilmiyor (sağlayıcı istemi soruların kendi başına çözülebilir olmasını istiyor). Elle/kütüphane ortak metin/görsel grupları tam çalışıyor. AI grubu için `complete_prova_generation_v2` + seçici değişikliği ayrı iş.
3. **AI önerisi ≠ veli puanı — sunucu tarafı:** `apply_ai_grades` (`prova-grade`, metin cevaplar) hâlâ AI puanını `score`'a `graded_by='ai'` olarak yazıyor ve deneme `graded` olabiliyor. Bu işte UI ayrımı (AI önerisi etiketi, veli kaydı `parent`) yapıldı; AI puanını yalnız `ai_score`'da tutup veli onayına kadar ara sonuç saymak 008/101 pgTAP'larını ve plan/rapor okuyucularını etkileyen bir **ürün kararı**dır, yapılmadı. Defterli cevapta (`prova-review`) öneri zaten puan yazmıyor.
4. **Dönem uyuşmazlığı soru düzeyinde değil:** `question_bank` dönem alanı taşımıyor; kontrol taslak/çocuk dönem-okul kaydı düzeyinde (nakil, yeni yıl, okul düzeltmesi). Soru başına dönem işareti ve `program`'ın soru/katalogla eşleşmesi yok (program serbest etiket).
5. **Okul beyanı ↔ katalog senaryosu:** `save_exam_blueprint`'in veli girişli dağılımda `school_confirmed=true` yazması (P01/P02 kalan sınırı 2) `catalog.tsx`/`blueprint.tsx` sahipliği (C01/C05) nedeniyle değiştirilmedi. Taslaktaki `schoolDeclared` bundan bağımsızdır; MEB `format='meb'` resmî kapsam kapısı aynen duruyor.
6. **Kitapçık native PDF yolu denenmedi** (expo-print / iOS-Android); fiziksel cihaz veya simülatör çalıştırılmadı. Yalnız web export.
7. Görsel kontrol: ekran görüntüleri tam sayfa değil, iç kaydırma alanının görünen kısmıdır; büyük yazı, klavye, ekran okuyucu ve yatay yönler bu turda ayrıca test edilmedi.
8. İzole zincirde tek çocuk modu oturumu veli JWT'siyle çalışır; gerçek cihaz (device JWT) cevap anahtarı sınırı pgTAP 110 ile sunucuda doğrulandı, cihaz uygulamasında ayrıca çalıştırılmadı.
9. Not: Bu oturumun paylaşılan scratchpad kökünde başka işe ait olabilecek `export-web.sh` ve `add_i18n.py` adlı iki yardımcı betik üzerine yazıldı (repo dışı); sonraki dosyalar `scratchpad/c04/` altında tutuldu.

## Temizlik
İzole servis koşusu: storage/rest/auth konteynerleri ve `gina_http_<hex>_audit` DB silindi (`services.json` `cleanup` hepsi `true`); sonradan `docker ps` ve `pg_database` ile `gina_http_*` = 0. pgTAP ve yarış klonları (`gina_q02sql_*`, `gina_c04race_*`) koşu sonunda düşürüldü (kalan 0). Statik web sunucusu kapatıldı. Paylaşılan `gina_prova_builder_audit` / `gina_completion_audit` DB'lerine yazılmadı.
