# E01 — AI ön inceleme ve yönetici kuyruğu (sunucu + core)

6 Kasım 2026, gece devri. Dal: `worktree-agent-aef33741002d7a66c` (kaynak main `5ef5cd3`). **Main'e push edilmedi, üretime migration/fonksiyon dağıtılmadı, backoffice/mobil UI bağlanmadı, gerçek ücretli sağlayıcı çağrısı yapılmadı.** Bu rapor yalnız sunucu + core teslimini ve gerçekten koşan testleri anlatır.

## Karar

`docs/DECISIONS.md` → «Gece devri başlangıç kararları (5 Kasım 2026, 23:06)»: AI, kütüphane taslakları ve MEB senaryo adayları için içeriğe bakıp güvenle karar verebildiğinde otomatik onay verebilir; karar veremediği kayıt `BEKLİYOR` kalır, yönetici kuyruğuna düşer, bildirim üretir; son kararı yönetici verir. AI onayı ile yönetici onayı kayıtta ayrı tutulur; bağımsız eğitimci incelemesi (X06) ayrı kalite kademesidir ve AI onayı onun yerine geçtiği iddia edilmez.

Uygulamadaki karşılığı: AI kararı **yalnız** `gina.content_prereviews` tablosuna yazılır. Yönetici kararı eski yerlerinde kalır (`gina.library_editorial_reviews` + `gina.library_publications`, `gina.contribution_sets.status/reviewed_by`, `gina.curriculum_candidates.status/review`). Hiçbir AI sonucu bu sütunlara dokunmaz; `ai_approved` yayın adımı değildir, yayın RPC'si editoryal incelemeyi aynen istemeye devam eder (pgTAP'ta kanıtlandı). Otomatik ret yoktur; en sert sonuç `ai_rejected_suggestion` olup yine yönetici kararı bekler.

## Sözleşme

### Veri — `20261106050000_content_prereview.sql`

- `gina.content_prereviews(target_kind, target_id)`; `target_kind ∈ library_package | contribution_set | curriculum_candidate`. Alanlar: `prereview_status pending | ai_approved | needs_admin | ai_rejected_suggestion`, `prereview_verdict jsonb`, `prereview_at`, `content_hash` (normalize içeriğin SHA-256'sı), `prompt_version`, `attempts` (0–10), `last_error`, `lease/claimed_at`, `requested_by`, `queued_at`. RLS açık, bütün API rollerinden erişim kapalı; yalnız SECURITY DEFINER RPC'ler okur/yazar.
- Neden ayrı tablo: `gina.library_import_packages` değiştirilemez (immutable tetikleyici), bu yüzden paket satırına sütun eklenemezdi; üç tür için tek yan tablo, yönetici karar sütunlarıyla yapısal ayrımı da garanti eder.
- `gina.content_prereview_notices`: (kayıt, içerik hash'i, prompt sürümü) başına tek yönetici bildirimi; tekrar `finish` kuyruğu şişirmez.
- `public.push_outbox.kind` listesine `content_prereview_needs_admin` eklendi; `push-send/messages.ts` metin + `target_id` beyaz listesi. Bildirim, aile üyesi olan yöneticilere mevcut outbox → push-send hattından gider; aile üyesi olmayan yöneticiye push ulaşmaz (kuyruk kaydı `admin_content_prereviews` ile görünür).
- `app_settings`: `content_prereview.enabled` (varsayılan `false`, AI işleme kapısı), `content_prereview.plan` (varsayılan `"pro"`; `ai_settings`/`ai_models` hangi modelin kullanılacağını belirler).

### RPC'ler

| RPC | Rol | İş |
|---|---|---|
| `enqueue_content_prereview(p_scope)` | yönetici | `library_packages / contribution_sets / curriculum_candidates / all`. Yönetici kararı bekleyen kayıtları (yayımlanmamış paket, `pending` katkı, `draft` aday) kuyruğa alır. İdempotent: aynı içerik ikinci çağrıda `unchanged`; içerik değişmişse `requeued`. `audit_log` kaydı. |
| `request_content_prereview(p_kind,p_id)` | yönetici | Tek kaydı kuyruğa alır; Edge fonksiyonunun yönetici yetki kanıtıdır. |
| `admin_content_prereviews(p_status,p_limit)` | yönetici | Kuyruk/verdict listesi (`needs_admin` ve `ai_rejected_suggestion` önce), `awaiting_admin` bayrağıyla; kira alanı dışarı verilmez. |
| `content_prereview_claim(p_kind,p_id,p_lease,p_prompt_version)` | service_role | Kapı kapalıysa `prereview_disabled`. Aynı içerik + aynı prompt sürümü + mevcut verdict → `cached` (AI çağrısı yok). Başka kira 3 dk içinde → `in_progress`. Hash veya prompt sürümü değişti → sıfırdan. `attempts ≥ 3` → `needs_admin` + `retry_limit` nedeni + bildirim. Aksi `claimed` + normalize içerik. |
| `content_prereview_finish(p_kind,p_id,p_lease,p_status,p_verdict,p_error)` | service_role | Kira ve `pending` durumu şart (`lease_lost`). Verdict `decision_reason/confidence/findings` içermeli. `pending` = geçici hata (deneme sayılır). `needs_admin`/`ai_rejected_suggestion` bildirim üretir. `audit_log`. |
| `content_prereview_next(p_limit)` | service_role | Zamanlayıcı için bekleyen, kirası düşmüş, `attempts<3` kayıtlar. |

### Normalize içerik (`gina.content_prereview_source`)

Modele URL değil metin gider: kütüphane paketinde başlık/sınıf/ders, ortak kaynak `title/body/alt`, her sorunun `student` (kök, şıklar, tür, güçlük), `teacher` (beklenen cevap, çözüm, açıklama, rubrik), `metadata.curriculum`; katkı kopyasında `snapshot - images`; senaryo adayında bloklar, sayılar ve tam kazanım metinleri. **Dışarıda kalanlar:** `provenance.private_note`, `metadata.private_note`, görüntü baytları, aile/çocuk/aktör kimlikleri (pgTAP ile doğrulandı).

### Edge `content-prereview`

- Yetki: `x-cron-secret: CONTENT_PREREVIEW_SECRET` (sistem; `{"drain":true,"limit":n}` kuyruğu boşaltır) veya yönetici JWT (`{"kind","id"}`; Edge, kullanıcı istemcisiyle `request_content_prereview` çağırır — veritabanı `assert_admin` ile yetkiyi doğrular, yönetici `drain` yapamaz).
- Akış: claim → (`cached`/`in_progress`/`retry_limit` ise AI yok) → `resolveAi` (`ai.enabled`, `ai_settings.enabled`, `ai_models.active`) → `ANTHROPIC_API_KEY` → `callClaude` (JSON şema çıktı) → `validateOutput` → `decide` → finish.
- Kill switch / model pasif / anahtar yok: AI çağrısı yapılmadan `needs_admin`, verdict `decision_reason = ai_disabled | ai_model_unavailable | ai_not_configured`.
- 429/5xx/zaman aşımı/ret/`max_tokens`/bozuk çıktı: `finish('pending', hata_kodu)`; üçüncü başarısızlık `needs_admin` + `retry_limit`. Dört numaralı çağrı tekrar denemez (`cached`).

## Rubrik ve çıktı şeması (`_shared/prereview.ts`, prompt sürümü `prereview-v1`)

Modelden istenen JSON: `confidence 0–1`, `recommendation approve|admin_review|reject`, `rubric` (beş soru, `yes|no|unsure`), `findings[] {code, severity blocking|advisory, detail, item}`, `summary ≤ 600`. Rubrik soruları:

| Anahtar | Soru | Geçer |
|---|---|---|
| `solution_correct` | Öğretmen cevabı/çözümü doğru ve beklenen cevapla tutarlı mı | `yes` |
| `measures_target_skill` | Soru iddia edilen kazanımı ölçüyor mu; senaryoda blok/çıktı tutarlı mı | `yes` |
| `age_language_appropriate` | Sınıf/yaş/Türkçe uygun, utandırıcı dil yok mu | `yes` |
| `copyright_or_copy_suspicion` | Telifli kaynağın kopyası şüphesi | `no` |
| `leaked_exam_suspicion` | Okul yazılısı / EBA havuzu / gizli sınav paylaşımı şüphesi | `no` |

Bulgu kodları: `solution_incorrect, answer_key_mismatch, rubric_incomplete, skill_mismatch, age_or_language, copyright_or_copy, leaked_exam, scenario_count_mismatch, outcome_mismatch, personal_data, unsafe_content, other`. Şema dışı her şey (`ai_result_invalid`) deneme sayılır.

## Eşik ve gerekçesi

`decide()`: güven ≥ **0,85** **ve** beş rubrik cevabı geçer değerinde **ve** `blocking` bulgu yok **ve** `recommendation=approve` → `ai_approved`. `recommendation=reject` + en az bir `blocking` bulgu + güven ≥ 0,85 → `ai_rejected_suggestion`. Diğer her durum → `needs_admin` (neden: `low_confidence`, `rubric_<anahtar>`, `blocking_finding`, `model_requested_review`).

Neden 0,85: karar metni «güvenle karar verebildiğinde» diyor; `unsure` tek bir rubrikte bile onayı düşürür, bu yüzden eşik tek başına değil beş sorunun hepsinin net geçmesiyle birlikte çalışır. Danışma (advisory) bulgular onayı engellemez; yalnız yayını engelleyecek sorun `blocking` sayılır. 0,85 kalibre edilmiş bir değer değildir; gerçek sağlayıcı pilotu ile gözden geçirilmelidir (aşağıda «kalan»). Eşik tek yerde sabittir (`PREREVIEW_CONFIDENCE_THRESHOLD`), `packages/core` aynı kuralı testle aynalar.

## Idempotency

Anahtar = kayıt + normalize içerik hash'i + prompt sürümü. Aynı üçlü için verdict varsa `claim` `cached` döner ve sağlayıcı çağrılmaz (pgTAP ve Deno'da sayaçla doğrulandı). İçerik değişirse (ör. aday metni) veya prompt sürümü yükselirse deneme sayacı sıfırlanır, verdict silinir ve yeniden incelenir; eski verdict yeni içeriğe taşınmaz.

## Testler (gerçekten çalıştırıldı)

- **pgTAP, izole DB** `gina_e01_prereview_audit` (şablon `gina_completion_audit`, 0 aile/0 kullanıcı; ≥ `20261103093000` migration'lar + yeni migration uygulandı; demo/üretim DB'ye dokunulmadı, `db reset` yok): **87 dosya / 2.594 kontrol, 0 başarısız** — [sql-checks.json](sql-checks.json). Yeni `091_content_prereview.test.sql`: **84 kontrol** — anon/veli/service_role yetki ayrımı; kapalı kapı; idempotent toplu kuyruk (3 → 0); özel notların ve görüntü baytlarının modele gitmemesi; kira çakışması ve `lease_lost`; verdict şema reddi; `cached`; prompt sürümü değişimi; `ai_approved` sonrası yayın yok, editoryal inceleme yok, `admin_set_library_publication` hâlâ `library_publication_review_required`; `needs_admin` tek outbox satırı (yalnız aile üyesi yönetici), oturumsuz yöneticiye hedef yok; ret önerisinin katkıyı reddetmemesi; içerik değişiminde yeniden inceleme ve yeni bildirim; yönetici kararının AI kaydını değiştirmemesi ve kuyruktan düşmesi; 3 deneme sonrası `retry_limit → needs_admin`; denetim izi sayısı.
- **Deno** (`deno test --frozen-lockfile --config supabase/functions/deno.json`): `_shared/prereview.test.ts` 5 test + `content-prereview/handler.test.ts` 8 test = **13 geçti**; `push-send` 23 test geçti (yeni bildirim türü dâhil). Sağlayıcı sahtedir (`call` bağımlılığı); ağ yok, ücret yok. Kapsam: 20 şema reddi, eşik sınırı (0,85 dâhil / 0,849 hariç), `unsure`/engelleyici/danışma bulgu matrisi, ret önerisi koşulları, idempotent tekrar, içerik/prompt sürümü değişiminde tek yeni çağrı, kill switch/model pasif/anahtar yok → `needs_admin` + neden (AI çağrısı 0), 429→529→bozuk çıktı → `retry_limit`, zaman aşımı benzeri bilinmeyen hata, sistem `drain`. `deno check content-prereview/index.ts` geçti.
- **Core**: `pnpm --filter @gina/core test` → **41 dosya / 261 test geçti** (yeni `content-prereview.test.ts` 4 test); `pnpm --filter @gina/core typecheck` geçti.

## Yapılmayanlar / sınırlar

- **UI bağlanmadı:** backoffice'te kuyruk, verdict ve «AI ile ön incele» düğmesi yok (B02/A3 kapsamı); mobil etkilenmez. Yönetici kuyruğu bugün yalnız `admin_content_prereviews` RPC'si ve push bildirimiyle görünür.
- **Yayımlanmadı:** migration üretime uygulanmadı, Edge fonksiyonu dağıtılmadı, `CONTENT_PREREVIEW_SECRET` ve `content_prereview.enabled=true` ayarlanmadı, pg_cron `drain` zamanlaması eklenmedi (mevcut `source-cleanup` örüntüsüyle eklenebilir).
- **Gerçek sağlayıcı denenmedi:** bütün testler deterministik sahte sağlayıcıyla koştu. Eşik ve rubrik gerçek modelle sentetik pilotta gözden geçirilmelidir; `prereview-v1` değişirse `PREREVIEW_PROMPT_VERSION` yükseltilir ve kayıtlar kendiliğinden yeniden incelenir.
- Aile üyesi olmayan yöneticiye push ulaşmaz; backoffice içi bildirim tablosu bu kapsamda kurulmadı («yeni kanal kurma» sınırı).
- Bağımsız eğitimci incelemesi (X06) bu işle sağlanmadı ve AI onayı onun yerine geçmez. Katkı kopyaları için `contribution_sets.enabled` ve kütüphane yayını için `library_packages.enabled` kapıları değişmedi.
- `ai_operation_jobs` kullanılmadı: o tablo aile kapsamlı (`family_id not null`, `action grade|plan`); içerik ön incelemesi ailesizdir, bu yüzden kuyruk `gina.content_prereviews` içinde tutuldu.

## Commit'ler (dal)

- `3242ca9` feat(db): content pre-review records, queue RPCs and admin outbox notice (E01)
- `8efc491` feat(edge): content-prereview function with rubric, output contract and threshold (E01)
- `7abb8ab` feat(push): admin notice text for content pre-review queue (E01)
- `59d9b89` feat(core): content pre-review types, verdict schema and status labels (E01)
- docs commit: bu rapor, `docs/CLAUDE-REMAINING-WORK.md` E01 maddesi, `supabase/functions/README.md` satırı.
