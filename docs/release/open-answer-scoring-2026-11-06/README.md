# Açık uçlu puanlama kuralı düzeltmesi (P04) — 2026-11-06

Kaynak bulgular: `docs/release/experience-review/SCREEN-REVIEW-MATRIX-A2.md` **Q00-A2-1 (P0)** ve **Q00-A2-2 (P1)**.
Ürün kuralı: `docs/CLAUDE-REMAINING-WORK.md` P04 kabul — "cevap yok / okunamıyor / inceleme bekliyor ayrımı; eksik puan ara sonuç, sıfır değil".

Dal: `worktree-agent-a4c74d72d839d3d8d` (main'e push edilmedi). Üretim Supabase'e dokunulmadı; `db reset` yapılmadı.

## Sorun

`gina.recompute_attempt_totals` (`20261030080000_prova_ai.sql`) açık uçlu cevapta yalnız `answer_text`'e bakıyordu:
`trim(answer_text)=''` → **0 puan** ve "puanlandı". Defter çizimiyle (`answer_document`) verilen cevap boş sayılıyor, deneme
`graded` oluyor; veli "Puan: 0 / 100 · Açık uçlu: 2 / 2 puanlandı" görürken çocuk ekranı "ebeveynin inceleyecek" diyordu.
Hiç cevaplanmamış açık uçlu da finish anında otomatik 0 alıyordu.

## Kural (yeni)

| Açık uçlu cevap | Eski | Yeni |
|---|---|---|
| Yalnız çizim (`answer_document` dolu, metin boş) | 0 puan, "puanlandı", deneme `graded` | **puan bekliyor** (`score null`, `open_pending`), deneme `submitted` + `provisional=true` (türetilmiş `review_state='pending_review'`) |
| Metin | puan bekliyor | puan bekliyor (değişmedi) |
| Boş (ne metin ne çizim) | 0 puan, "puanlandı" | **cevap yok** (`score null`, `open_unanswered`); otomatik 0 **yok**; veli incelemede açıkça 0 verebilir (`score_open_answer` / `save_answer_review`) |
| Yalnız yapıştırılmış kaynak görseli (`source` öğesi) | — | cevap yok (education_reports ile aynı kural) |
| Boş defter metin kutusu | — | cevap yok |
| Şıklı | 100/0 | değişmedi |
| `score_pct` | boşlar 0 olarak ortalamaya giriyordu | **yalnız puanlı maddelerden** (şıklı + puanlı açık uçlu); hiç puanlı madde yoksa `null`; `provisional=true` ise ara sonuç |
| Deneme `graded` | tüm açık uçlular puanlı **veya boş** | yalnız tüm açık uçlular **gerçekten puanlı** |
| `graded_at` | her recompute'ta `now()` | ilk kapanışta set, sonraki recompute'ta korunur |
| Geçmiş `graded` kayıtlar | — | **yeniden hesaplanmaz** (migration'da backfill döngüsü yok) |

`attempt_status` enum'u değişmedi (`in_progress | submitted | graded`); "pending_review" türetilmiş durumdur
(`status='submitted'`, `provisional=true`). Mevcut okuyucular (`status in ('submitted','graded')` filtreleri: öğrenme ilerlemesi,
raporlar, tekrar adayları, push tetikleyicisi) etkilenmez.

## Değişen sunucu yüzeyi — `supabase/migrations/20261106140000_open_answer_pending_score.sql`

- `exam_attempts` yeni sütunlar: `open_pending int`, `open_unanswered int`, `provisional boolean` (eski satırlarda `null`).
- `gina.open_answer_present(text, jsonb)`, `gina.open_answer_state(smallint, text, jsonb)` → `graded|pending|unanswered`.
- `gina.recompute_attempt_totals` yeni kural (yukarıdaki tablo).
- `public.finish_exam_attempt` yanıtı artık yeniden hesaplanmış toplamları taşır (AFTER tetikleyici de aynı sonucu üretir; idempotent).
- `public.get_attempt_topic_stats` imzası aynı; boş açık uçlu artık `pct`'ye 0 olarak girmez, `pending` sayılır.
- **Yeni** `public.get_attempt_summary(p_attempt_id) → jsonb` (veli: kendi ailesi; cihaz: kendi çocuğu; servis):
  `id, exam_id, child_id, status, review_state, mc_total, mc_correct, open_total, open_graded, pending_open_count,
  unanswered_open_count, provisional, score_pct, started_at, finished_at, graded_at` + yalnız veli/servis için
  `open_answers: [{question_id, position, state, score, graded_by, has_text, has_document}]`.
  Eski satırlarda saklı değer yorumlanır, yeniden hesap yapılmaz: legacy `graded` → `graded`, `provisional=false`, `0/100` aynen.
- `score_open_answer`, `apply_ai_grades`, `save_answer_review`: değişmedi; recompute üzerinden yeni kuralı uygular.

### Core — `packages/core/src/attempt-summary.ts`
`attemptSummary()` geriye uyumlu genişledi (`pendingReview` korunur): `openTotal, openGraded, pendingOpenCount,
unansweredOpenCount, provisional, scorePct, reviewState`. Yeni: `openAnswerPresent`, `openAnswerState` (sunucu kuralının
birebir karşılığı), `attemptSummaryRpcSchema` / `parseAttemptSummary` (zod).

### Edge — `prova-grade` / `prova-review` (davranış kontrolü)
- `prova-grade`: çizimli (defter) cevap varsa zaten `409 notebook_review_required`; boş cevap `puanlama_gerekli=false` gönderiliyor,
  doğrulayıcı (`validateGradeReport`) istenmeyen ref'e puan — 0 bile — kabul etmiyor, `puan=null` kabul ediliyor. Bu kural
  `_shared/answer-notebook.ts` içine `aiGradableOpenAnswer(kind, answer)` olarak taşındı ve test edildi; davranış değişmedi.
- `prova-review`: `validateReviewReport` `readable=false` için `score=null` zorunlu kılıyor ("yetersiz görselde kesin puan yok");
  sonuç yalnız öneri, puan yazmaz. Değişiklik gerekmedi.
- Yeni Deno testleri: boş/çizim/veli-puanlı/şıklı asla AI-puanlanabilir değil; boş madde için 0 bile reddedilir.

### i18n (eklendi, silinmedi; UI bağlanmadı)
`prova.ai.attemptStatus.pending_review`, `prova.ai.openPending`, `prova.ai.openUnanswered`, `prova.ai.openBreakdown`,
`prova.ai.provisionalNote`, `prova.ai.noScoreYet`, `prova.ai.answerState.{graded,pending,unanswered}`,
`prova.ai.unansweredHint`, `prova.ai.giveZero`, `prova.ai.drawingPendingHint`; çocuk: `prova.openEndedPending`,
`prova.openEndedUnanswered`, `prova.provisionalResult` (tr + en).

## Önce / sonra (A2 kanıt senaryosu: şıklı doğru, Q1 yalnız çizim, Q2 boş)

| Alan | Önce | Sonra |
|---|---|---|
| `status` | `graded` | `submitted` (`review_state=pending_review`) |
| `open_graded / open_total` | 2 / 2 | 0 / 2 |
| `open_pending`, `open_unanswered` | — | 1, 1 |
| `score_pct` | 0 | 100 (yalnız şıklı), `provisional=true` |
| Veli özeti (RPC alanları) | "0/100 · 2/2 puanlandı" | ara sonuç 100 · 1 bekliyor · 1 cevap yok |
| Çocuk ekranı | "ebeveynin inceleyecek" | aynı — artık sunucuyla tutarlı |
| Veli boşa açıkça 0 verir | — | `open_graded=1`, hâlâ `provisional` (çizim bekliyor), `score_pct=50` |
| Veli çizime 80 verir | — | `graded`, `provisional=false`, `score_pct=60`, `graded_at` set |

## Testler (gerçekten çalıştırıldı)

Ortam: izole DB `gina_p04_pgtap_audit` (boş `gina_completion_audit` şablonundan klon; `>=20261103093000` migration'lar + yeni
migration uygulandı; `scripts/test-isolated-services.py` tarifi). Yarış betikleri DB adı bu izole DB'ye yönlendirilmiş
kopyalarıyla koşturuldu; mevcut audit DB'lerine dokunulmadı. Deno 2.9.8, Node 22, pnpm 10.33.

```
migration 20261106140000 izole DB'de           → temiz (23 migration uygulandı, son: yeni dosya)
pgTAP 101_open_answer_pending_score            → 48 ok, 0 not ok
pgTAP Prova regresyonu (15 dosya: 005, 008, 009, 027, 029, 030, 032, 034, 035, 059, 060, 071, 077, 082, 090)
                                               → 461 ok, 0 not ok
scripts/test-prova-draft-races.py (izole kopya)→ PASS: concurrent save rejects stale version; concurrent submit creates exactly one exam
scripts/test-assigned-question-races.py (izole)→ passed: assignment_before_edit, edit_before_assignment, assignment_before_image, image_before_assignment
deno test _shared/{answer-notebook,grade-report,review-report}.test.ts prova-review/handler.test.ts
                                               → ok | 21 passed | 0 failed
deno check prova-grade/index.ts prova-review/index.ts → temiz
pnpm --filter @gina/core test                  → 45 files, 304 tests passed (14 yeni/güncel)
pnpm --filter @gina/core typecheck             → attempt-summary.ts temiz; 19 ÖNCEDEN VAR OLAN hata (period-transfer.test.ts vb., bu işle ilgisiz, dokunulmadı)
apps/mobile tsc --noEmit                       → temiz (0 hata, exit 0; tipler attemptSummary genişlemesiyle uyumlu)
```

pgTAP 101 kapsamı: `open_answer_present` tablosu (metin/çizim/boş metin kutusu/kaynak-only/boş defter); gerçek `submit_exam_answer_v3`
yoluyla çizim-only cevap → pending; boş → unanswered, puan satırı yok; finish yanıtı toplamları taşır; `score_pct` yalnız şıklıdan;
`get_attempt_summary` veli (soru başına durum) / cihaz (sayılar var, liste yok) / diğer aile (`attempt_not_found`); konu istatistiği
boşu 0 saymaz; veli açık 0 → graded zinciri; metin cevap → pending → AI puanı → graded, puansız AI özeti puan uydurmaz; yalnız şıklı
deneme gerçek 0 ile hemen graded; **legacy graded kayıt** yeni sütunlar null kalır, özet `graded 0/100 provisional=false`; legacy
kayıt üzerinde yeni veli puanı yeni kuralı uygular (bilinçli); veli `recompute`/`apply_ai_grades` çağıramaz.

## Yapılmayanlar ve kalan sınır

- **UI bağlanmadı / yayımlanmadı.** Mobil `parent/prova/attempt/[attemptId].tsx`, `child/prova/*`, backoffice değişmedi. Ekranlar
  hâlâ `exam_attempts` sütunlarını doğrudan okur; `attemptSummary()` eski alanlarla aynı davranır, yeni alanlar (`open_pending`,
  `open_unanswered`, `provisional`) ve `get_attempt_summary` RPC'si sabah bağlanacak. i18n anahtarları hazır.
- **Geçmiş kayıt yeniden hesaplanmadı.** Eski kuralla `graded` olmuş denemeler (ör. A2 kanıtındaki `919fda86…`) 0/100 kalır.
  Geriye dönük düzeltme isteniyorsa ayrı karar: tek seferlik `select gina.recompute_attempt_totals(id) from exam_attempts where
  status='graded' and open_total>0` bu kayıtları `submitted/provisional`'a döndürür ve veli incelemesine düşürür — bu bilinçli olarak
  yapılmadı.
- Legacy `graded` kayıtta `get_attempt_summary.open_answers` soru başına durumu canlı türetir (boş cevap `unanswered` görünür) ama
  sayaçlar saklı değeri (0 bekliyor/0 cevapsız) korur; UI legacy kayıt için sayaçlara güvenmeli (`provisional=false`).
- Legacy kayıt üzerinde **yeni** bir veli/AI puanı recompute'u tetikler ve yeni kural uygulanır (diğer boşlar `unanswered` olur,
  deneme `provisional`'a döner). Spesifikasyona uygun ("yalnız yeni finish/recompute çağrıları"), ama veliye görünür bir değişimdir.
- `save_answer_review` açık uçluda puansız (yalnız not) kaydı hâlâ `invalid_score` ile reddeder (mevcut davranış); "cevap yok"
  kutusu için tek dokunuş 0 UI'da `score_open_answer(…, 0)` ile verilir, ayrı RPC gerekmedi.
- `get_attempt_topic_stats.pending` artık "bekliyor + cevap yok" toplamıdır (imza korunduğu için ayrı sütun yok).
- `database.types.ts` elle güncellenmedi (dosya `exam_attempts` tablosunu zaten içermiyor; mobil doğrudan tipliyor).
- `@gina/core typecheck` içindeki 19 hata önceden vardı (`period-transfer.test.ts` vb.), bu işten bağımsız.
- tr/en anahtar farkı (`provaHub.*_one/_other`) önceden vardı; dokunulmadı.
