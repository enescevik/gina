# Prova yapılandırılmış soru türleri — veri ve RPC sözleşmesi (QT00/QT01)

7 Kasım 2026 · Plan: [PROVA-QUESTION-TYPES-PLAN.md](PROVA-QUESTION-TYPES-PLAN.md) · İlerleme: [docs/release/qt-2026-11-07/PROGRESS.md](../release/qt-2026-11-07/PROGRESS.md)

Migration'lar: `20261107000000_qt00_structured_kind`, `20261107000100_qt00_question_contract`, `20261107000200_qt01_scoring`, `20261107000300_qt00_rpcs`. Testler: `supabase/tests/140_qt_scoring_golden.test.sql` (core `fixtures.json`'dan üretilir: `node scripts/gen-qt-golden-sql.mjs`), `141_qt_contract_flow.test.sql`. Core: `packages/core/src/question-types/`.

## 1. Kavramlar

| Kavram | Yer | Not |
|---|---|---|
| Soru ailesi | `question_bank.kind` | Eski `multiple_choice`, `open_ended` aynen; yeni türlerin hepsi `structured` |
| Etkileşim türü | `question_bank.interaction_type` → `public.interaction_types` | Eski satırlarda NULL; etkin tür = `coalesce(interaction_type, kind)` |
| Şema sürümü | `question_bank.schema_version` | Şu an 1; bilinmeyen sürüm ret |
| Öğrenci içeriği | `question_bank.payload` | Doğru cevap YOK; çocuğa yine de izin listesiyle **yeniden kurulmuş** projeksiyon gider |
| Özel anahtar | `public.question_answer_keys` | Politika yok → doğrudan erişim yok. Veli/yönetici `get_question_answer_keys(ids)` |
| Puan politikası | `interaction_types.policy/policy_version` | `per_item@1`, `numeric@1`, `pairwise_order@1` |
| Atama bağı | `gina.exam_item_bindings` | Atanınca (content_locked_at) tür/şema/politika/ağırlık/hash sabitlenir |
| Cevap | `exam_answers.answer` | `{type, v:1, ...}`; eski `answer_key/text/document` korunur |
| Kesin puan | `exam_answers.score_exact` (0–100, 4 hane) + `score` (yuvarlanmış) | `graded_by`: `auto` / `parent` / eski `ai` |

Türler (1A/1B): `true_false`, `fill_blank`, `matching`, `numeric` (1A); `ordering`, `classification` (1B). Hepsi bütün paketlerde açık (paket kapısı yok). `practice_only` = `true_false, fill_blank, matching, ordering, classification`: `assessment_track='meb_common'` sınavına eklenemez (`interaction_type_not_allowed_for_track`), sessizce açık uçluya çevrilmez. `numeric` alıştırma-dışı sayılır ama bu “OYSS uyumlu” iddiası değildir.

Kimlikler: `^[a-z][a-z0-9_]{0,23}$`, soru içinde benzersiz. Cevaplar kimliğe bağlıdır; ekran sırası/indeksi kullanılmaz.

## 2. Tür örnekleri (payload / anahtar / cevap)

**true_false** (1–10 ifade; önerilen 3–5)
```json
payload {"statements":[{"id":"s1","text":"Güneş bir yıldızdır."},{"id":"s2","text":"Ay kendi ışığını üretir."}]}
key     {"answers":{"s1":true,"s2":false},"weights":{"s1":2}}
answer  {"type":"true_false","v":1,"items":{"s1":true}}
```
**fill_blank** (1–10 boşluk; `input`: `bank` | `keyboard`)
```json
payload {"segments":[{"type":"text","text":"Su donunca "},{"type":"blank","id":"b1"},{"type":"text","text":" olur."}],
         "input":"bank","bank":[{"id":"w1","text":"katı"},{"id":"w2","text":"buhar"}],"bank_reuse":false}
key     {"blanks":{"b1":{"tokens":["w1"]}}}                  // klavye: {"b1":{"accepted":["Ankara"]}}, "case_insensitive":false
answer  {"type":"fill_blank","v":1,"blanks":{"b1":{"token":"w1"}}}   // klavye: {"b1":{"text":"Ankara"}}
```
Kelime havuzu 1–3 boşluk için öneri, 4+ için yazı önerisi (katı değil). `bank_reuse=false` ise aynı kelime iki boşlukta kullanılamaz.
**matching** (sol 2–8, sağ 2–10; `policy`: `one_to_one` | `many_to_one`; çeldirici serbest)
```json
payload {"left":[{"id":"l1","text":"Kalp"}],"right":[{"id":"r1","text":"Kan pompalar"},{"id":"r4","text":"Görme"}],"policy":"one_to_one"}
key     {"pairs":{"l1":"r1"}}
answer  {"type":"matching","v":1,"pairs":{"l1":"r1"}}
```
**numeric**
```json
payload {"units":[{"id":"cm","text":"cm"},{"id":"m","text":"m"}],"unit_required":true,"work_area":false}
key     {"value":"150","unit":"cm","unit_factors":{"cm":1,"m":100},"abs_tolerance":0,"rel_tolerance":0,"unit_weight":0,"process_required":false}
answer  {"type":"numeric","v":1,"value":"1,5","unit":"m"}
```
Birim gerekmeyen soruda birim alanı yok. `work_area=true` ise çocuk deftere işlem yazabilir (`answer_document`). `process_required=true` → veli puanlar.
**ordering** (2–10 öğe; `mode`: `sequence` | `sentence`; en çok 5 kabul edilen sıra)
```json
payload {"items":[{"id":"a","text":"Tohum"},{"id":"b","text":"Filiz"}],"mode":"sequence"}
key     {"orders":[["a","b"]]}
answer  {"type":"ordering","v":1,"order":["b","a"]}        // tüm öğelerin permütasyonu
```
Aynı görünen kelimeler farklı kimlik taşır; cümle kurmada kabul edilen alternatif sıralar anahtarda listelenir. Serbest ifade gerekiyorsa açık uçlu tür kullanılır.
**classification** (öğe 2–16, kategori 2–5, isteğe bağlı `capacity`; tek üyelik)
```json
payload {"items":[{"id":"i1","text":"Kedi"}],"categories":[{"id":"c1","text":"Hayvan","capacity":2},{"id":"c2","text":"Bitki"}]}
key     {"membership":{"i1":"c1"}}
answer  {"type":"classification","v":1,"placement":{"i1":"c1"}}
```

Hata kodları (sunucu `question_structure_invalid` DETAIL'inde virgüllü; core `questionContentErrors` aynı kodları döndürür): `statements_invalid, key_missing_id, key_unknown_id, key_value_invalid, weights_invalid, segments_invalid, blanks_count, bank_invalid, bank_not_allowed, bank_unsolvable, sides_invalid, duplicate_id, right_too_few, key_not_one_to_one, key_value_invalid, unit_not_required, unit_factors_invalid, tolerance_invalid, items_invalid, order_invalid, order_duplicate, categories_invalid, capacity_invalid, capacity_exceeded, payload_unknown_field, payload_invalid, key_invalid, schema_version_unsupported, type_unknown`. Cevap: `answer_type_mismatch, answer_version_unsupported, answer_unknown_field, answer_unknown_id, answer_value_invalid, answer_token_reused, answer_pair_reused, answer_order_invalid, answer_capacity_exceeded`. Boyut: payload/anahtar ≤ 16 KB, cevap ≤ 8 KB.

## 3. Puanlama (QT01; SQL `gina.qt_score`)

- Soru puanı = `100 × kazanılan ağırlık / toplam ağırlık`; ağırlık `0 < w ≤ 10` (varsayılan 1). Gönderilmiş boş alt madde 0 kazanır.
- Sınav: `score_pct = round(Σ score_exact·points / Σ points)` yalnız puanlı maddeler üzerinden; tek final yuvarlama. Eski sınavlarda points=1 → eski ortalamayla aynı.
- Puanlama yalnız **bitişte** (`finish_exam_attempt` / süre sonu) yapılır; deneme sürerken puan/doğruluk hesaplanmaz ve çocuk okuyamaz (oracle yok). Bir kez yapılır; veli puanı ezilmez; atanmış sürüm hash'i değişmişse `question_version_changed` (koruma tetikleyicileri bunu engeller).
- Durumlar: `answer_state` = `unanswered | partial | complete`; `outcome` = `scored | pending_human | unanswered`. Hiç gönderilmemiş veya tamamen boş cevap **otomatik 0 değildir**: madde cevapsız kalır, deneme `provisional`, veli `set_structured_answer_score` ile puanlar.
- Sayısal: kontrollü ayrıştırıcı (`1,5` `1.5` `3/4` `1 3/4` `1.250,5`; `1.500` = 1500; ifade/üs/artı işareti yok). `|x·f − y| ≤ max(abs, rel·|y|)`; birim dönüşümü `unit_factors`; `unit_weight > 0` ise birim ayrı puanlanır. `process_required` → `pending_human` (otomatik sonuç `items.auto_result_score` veliye ipucu).
- Sıralama: kabul edilen her sıra için doğru ikili öncelik / `n(n−1)/2`, en yükseği.
- Türkçe metin: NFC + kırp + boşluk sadeleştirme; büyük/küçük harf yalnız `case_insensitive` ile ve `tr-TR` kuralıyla. `ı/i, ş/s, ğ/g` eşitlenmez; fuzzy yok.
- Toplam alanları (`exam_attempts`): eski `mc_* / open_*` aynen; yeni `items_total, items_scored, items_pending` (veli/insan puanı bekleyen), `items_unanswered`, `items_partial`. Eski şıklı cevapsız = 0 puan kuralı korunur (`scored` + `unanswered`).
- Veli: `set_structured_answer_score(request, attempt, question, answer_hash, score, reason)`; otomatik puanı değiştirirken gerekçe (≥3 karakter) zorunlu; `gina.answer_score_overrides` kaydı; `get_structured_score_overrides(attempt)`. AI önerisi bu fazda yapılandırılmış türlerde yok; veli yolu paket/kota bağımsız.

## 4. RPC etki listesi

| RPC | Değişiklik | Eski istemci |
|---|---|---|
| `get_attempt_questions(exam)` | Yapılandırılmış soru varsa `client_update_required` | Açık hata; eski sınavlar aynen |
| `get_attempt_questions_v2(exam, supported[])` | **Yeni**: `interaction_type, schema_version, payload` (öğrenci projeksiyonu, sınav içinde sabit karışık sıra; sıralama çözülmüş gösterilmez). Desteklenmeyen tür → `client_update_required` (DETAIL türler). Cihaz destek listesi `devices.question_types`'a yazılır | — |
| `submit_exam_answer` / `_once` / `_v3` | Yapılandırılmış soruya `client_update_required` | Yeni cevabı ezemez |
| `submit_exam_answer_v4(request, attempt, question, expected_rev, key, text, document, answer)` | **Yeni**: tek yazım, idempotency (`exam_answer_v4` makbuzu, gövdede `answer`), revizyon, tür/şema doğrulaması, metin/şık–tür uyuşmazlığı reddi | — |
| `get_saved_exam_answers_v4(attempt)` | **Yeni**: `answer` dahil | v3 aynen |
| `finish_exam_attempt` / `recompute_attempt_totals` | Bitişte yapılandırılmış puanlama + yeni sayaçlar | Alan anlamları aynı |
| `get_attempt_summary` | `items_*` + veliye `structured_answers[]` (durum, puan, otomatik puan, `answer_hash`) | Eski alanlar aynen |
| `save_question_with_sources` | `interaction_type` + `schema_version` + `payload` + `answer_key` (+ `points`) ile yapılandırılmış soru; aynı makbuz/idempotency | Eski çağrılar aynen |
| `complete_prova_generation[_v2]` | AI satırı `interaction_type/payload/answer_key` taşıyabilir; geçersiz yapı işin tamamını reddeder; eski türlerde sonuç alanları birebir | — |
| `save_ai_question_edit` | Yapılandırılmışta `ai_edit_structured_unsupported` (eksik kopya yok) | — |
| `set_structured_answer_score`, `get_structured_score_overrides`, `get_question_answer_keys`, `get_interaction_types`, `get_child_question_type_support` | **Yeni** | — |
| `answer_fingerprint` / `bump_answer_revision` | `answer` dahil; `answer` NULL ise eski hash birebir | Eski inceleme hash'leri geçerli |
| Grup (toplu) sınav | Yapılandırılmış cevap reddedilir (bu faz dışı) | — |

Cevap hash'i: `sha256({key,text,document,revision} [+ answer])`. Veli puanı/inceleme `answer_hash` ister; cevap değişmişse `answer_changed`.

## 5. Geçiş ve geri dönüş

- Geçiş yalnız sütun/tablo ekler; mevcut satır güncellenmez (backfill yok), eski hash ve toplamlar değişmez. Eski soru tahminle yeni etkileşime dönüştürülmez.
- Yayın sırası: migration → Edge (AI şeması) → web/yönetim → imzalı mobil. Migration önce yayınlanabilir: eski istemciler yapılandırılmış soru görmediği sürece etkilenmez; yeni tür ancak yeni hazırlama ekranı (veli) yayınlanınca oluşur.
- Geri dönüş: istemci geri alınırsa yapılandırılmış sorulu sınavlar eski istemcide açık `client_update_required` ile durur; cevap kaybı yok. `interaction_types.enabled=false` yeni hazırlamayı/atamayı durdurur, mevcut cevap/puanları silmez. Şema geri alma (sütun düşürme) **öğrenci verisini kaybettireceği için yapılmaz**.

## 6. Bilinen sınırlar (bu sözleşme sürümü)

- Yapılandırılmış türlerde AI puan önerisi yok (otomatik puan + veli). AI düzenleme yapılandırılmış soruda kapalı.
- Kütüphane içe aktarma/yayın ve toplu grup sınavı yapılandırılmış tür taşımaz (kapsam dışı/sonraki faz).
- Cihaz yeteneği atamada **uyarıdır** (veli `get_child_question_type_support`); kesin engel cevap/soru RPC'sindeki açık hatadır.

## 7. Faz 2A / 2B / 3 ekleri (sunucu + core)

Migration'lar: `20261107050100_qt30_phase2a_types`, `20261107050200_qt40_phase2b_types`, `20261107050300_qt50_crossword` (hepsi `enabled=false` gelir), açma: `20261107050400_qt_enable_phase2` (2A+2B; crossword kapalı). 1A/1B fonksiyonları `_p1/_p2/_p3` olarak yeniden adlandırılıp dağıtıcılarla sarıldı; eski davranış aynı (golden testler).

| Tür | payload | anahtar | cevap | Politika |
|---|---|---|---|---|
| `mark_text` | `{unit: word\|sentence, segments:[{id?,text}], max_select?}` | `{targets:[id]}` (1 ≤ P < seçilebilir) | `{selected:[id]}` | `max(0, TP/P − FP/N)` |
| `multi_choice` | `{options:[{id,text}] 3–8, select_count?}` | `{correct:[id]}` (P≥1, N≥1; select_count = P) | `{selected:[id]}` | aynı |
| `error_fix` | `{unit, segments}` | `{errors:{id:{accepted:[..]}}, find_weight=0.5, fix_policy: review_unmatched\|closed, case_insensitive}` | `{marks:{id:{text?}}}` | `fw·max(0,found/P − FP/N) + (1−fw)·fixed/P`; anahtarda olmayan anlamlı düzeltme → veli (`pending_human`) |
| `two_stage` | `{stage1:{prompt,options}, stage2:{prompt, mode: choice\|text, options?}}` | `{stage1:id, stage2?:id, weights?}` | `{stage1?:id, stage2?: id \| {text}}` | ağırlıklı; metin gerekçe → veli |
| `region_select` | `{figure:{kind: grid\|sectors\|image, rows?, cols?, source?:"question_media"}, regions:[{id,text,box?}], max_select?}` | `{targets:[id]}` veya şekilde `{count:n}` | `{selected:[id]}` | dengeli seçim / tam adet |
| `clock` | `{mode: read\|set, display, step_minutes, shown_time? (read)}` | `{time:"HH:MM", accept_12h=true}` | `{time}` | tam eşleşme (12 saat denkliği isteğe bağlı) |
| `stimulus` (her yapılandırılmış türe) | `{kind: table\|bar_chart, alt (zorunlu), caption?, …}` | — | — | puanı etkilemez; izin listesiyle yeniden kurulur |
| `crossword` (Faz 3, kapalı) | `{rows, cols, blocks?, clues:[{id,dir,row,col,length,text}]}` | `{answers:{id:"KELİME"}}` | `{cells:{"rR_cC":"A"}}` | ipucu bazlı; TR büyük harf; tamamlanma ayrı |

Bütün 2A/2B türleri `practice_only` (OYSS/`meb_common` izinde reddedilir). Görsel bölgede görsel, sorunun mevcut özel medya bağlantısıdır; AI görsel bölge üretmez. Dikte (QT43) ve sesli cevap (QT51) ses depolama + rıza kararı beklediği için tanımlı değildir; problem kurma (QT44) açık uçlu + rubrik ön ayarıdır.
