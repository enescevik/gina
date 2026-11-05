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

- ~~**UI bağlanmadı:** backoffice'te kuyruk, verdict ve «AI ile ön incele» düğmesi yok (B02/A3 kapsamı); mobil etkilenmez.~~ [Güncelleme: backoffice bağlandı, aşağıdaki «UI bağlama» bölümü; mobil yine etkilenmez.]
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

## UI bağlama (backoffice, 6 Kasım 2026 gece)

Dal: `worktree-agent-a7eca8d5ab9cbb879` (kaynak main `eeb57af`). **Main'e push edilmedi, migration eklenmedi, sunucu kodu değişmedi, gerçek ücretli AI çağrısı yapılmadı.** Yalnız `apps/backoffice` bağlandı; panel/aile/ödeme/geçici hak sayfalarına dokunulmadı; `lib/i18n.ts` değişmedi (yeni metinler bileşen dosyalarında, mevcut sayfa düzeniyle aynı).

### Ne bağlandı

| Yüz | Dosya | Sunucu | Davranış |
|---|---|---|---|
| Kütüphane → **Tüm içerik · AI ön inceleme** sekmesi (`/library?tab=items`) | `components/library-content-items.tsx`, `components/content-prereview.tsx` | `admin_library_content_items`, `admin_content_prereviews`, `request_content_prereview`, `enqueue_content_prereview`, Edge `content-prereview` | Tek liste; sunucu filtresi (yönetici durumu, tür) + AI durumu filtresi. **Yönetici kararı** sütunu (durum, editoryal karar, «Ailelere açık/değil») ile **AI ön inceleme (ayrı kayıt)** sütunu ayrı; rozet «AI ön inceleme · karar değildir», durum etiketi core `prereviewStatusLabel`, güven %, karar nedeni, bulgular (engelleyici/danışma). Tek kayıt «AI ön incelemesi iste» = önce `request_content_prereview` (kuyruk), sonra Edge; Edge yoksa «kuyruğa alındı ama hizmete ulaşılamadı» der. Toplu: seçilenler için kuyruk + «Karar bekleyen tümünü kuyruğa al» (`enqueue`, yeni/yeniden/değişmedi sayıları). Kapı kapalıysa (`content_prereview.enabled` ≠ true) veya genel AI anahtarı kapalıysa istek düğmeleri kapalı ve **neden açıkça yazılı**. |
| Aynı sekme → iz | aynı | `contribution_review_trail`, `admin_library_package_trail` | Katkıda ret → düzeltme → yeniden inceleme zinciri (kopya sırası, karar, ret notu, güncel kopya, düzeltme bağı, ayrı AI durumu); pakette sürümler, canlılık, yayın sürümü, editör sonuçları. |
| Kütüphane → Haklar ve ödüller | `components/library-policy-preview.tsx` | `library_policy_preview` | Kabul sayısına göre toplam hak, kural tablosu, sıradaki kilometre taşı, yığılma uyarısı. Hak vermez. |
| Kütüphane → Senaryo kaynakları | `components/curriculum-sources.tsx` (eski salt-okunur panel yerine) | `admin_list_curriculum_sources`, `admin_review_curriculum_source_revision`, Edge `curriculum-source-fetch` | Kaynak başına sürüm tablosu (SHA-256, bayt, indirildi, son kontrol, durum, çıkarma, aday/yayımlı senaryo), «Yeni sürüm — fark incelemesi gerekli», **stale uyarısı** (son başarılı kontrol ≥ 7 gün veya `unverified`), onayla / reddet (kenara koy) / geri çek — not + «Resmî dosyayı ve özeti kontrol ettim» onayı + kalıcı `request_id`. «Resmî dizini kontrol et» Edge'i çağırır; belirsiz ders bağlantısında adayları gösterir (tahmin yok); Edge yoksa açık hata ve «kaynak kaydı değişmedi». |
| AI ayarları | `components/ai-policy.tsx`, `pages/ai.tsx` | `admin_ai_policy_matrix`, `admin_model_disable_preview`, `admin_provider_change_impact` | Salt okunur politika matrisi (paket × işlem: aylık/dakika/eşzamanlı/medya; model/token/prompt; özellik → girdi → yetenek → paket → uç nokta; model desteği ve nedenleri). Model satırında «Kapatma etkisi»; pasifleştirme onayı da sunucu önizlemesini kullanır. Sağlayıcı değişim etkisi: engel nedenleri, etkilenen özellikler, boşluklar, yeni işleyen/izin/yurt dışı/bölge/maliyet, anahtar **adı**, aday modeller. |
| AI işlemleri | `components/ai-failure-queue.tsx`, `pages/operations.tsx` | `admin_ai_failed_operations` | Arıza kuyruğu sunucuda filtrelenir (durum görünümü, işlem türü, gün aralığı) ve 25'lik sayfalanır, toplam sayı ile; «İncele → yeniden denemeye izin ver» akışı aynen kaldı. İstemci tarafı «son 100 kayıt» süzgeci kaldırıldı. |

Ortak: `components/review-rpc.ts` — `database.types.ts`'e henüz girmemiş RPC'ler için ince çağrı (yetki DB'de) ve Edge hata sınıflandırması (ham gövde ekrana yazılmaz).

### Testler (gerçekten çalıştırıldı)

- `pnpm --filter @gina/backoffice typecheck` → çıkış 0 (`next typegen && tsc --noEmit`).
- `pnpm --filter @gina/backoffice lint` → çıkış 0 (eslint, uyarı yok).
- `pnpm --filter @gina/backoffice build` (yer tutucu `NEXT_PUBLIC_SUPABASE_URL=http://gina-cqui.invalid`) → çıkış 0, 22 statik sayfa.
- **İzole servis + Playwright 1280×800**: `GINA_QA_PLAYWRIGHT_PATH=… python3 scripts/test-content-review-ui.py --run-local` → [ui/ui-checks.json](ui/ui-checks.json): **15/15 kontrol geçti**. Ortam: boş `gina_completion_audit` şablonundan klonlanan tek kullanımlık `gina_cqui_<hex>_audit` (≥ `20261103093000` migration'lar), kendi Auth + PostgREST konteynerleri, kendi fixture yolu (`/tmp/gina-cqui-<db>.json`, 0600, bitince silinir), sentetik `example.invalid` yönetici. **Edge çalışmıyor** (yerel ağ geçidi `/functions/v1` için 404): ekran bunu açık hata olarak gösteriyor. AI kararları sahte değil sunucunun kendi `content_prereview_claim/finish` RPC'leriyle (service_role) yazıldı; sağlayıcı çağrısı yok. Konteynerler ve DB silindi (`cleanup` hepsi `true`; sonradan `docker ps`/`pg_database` ile `gina_cqui_*` = 0 doğrulandı). Başka ajanların DB/konteynerlerine dokunulmadı.
  - Kontroller: `prereview_badge_separate_from_admin_decision` (AI uygun paket: yönetici hücresi «Taslak · yönetici kararı bekliyor / Ailelere açık değil», AI kelimesi yok, rozet hücre dışında), `ai_reject_suggestion_does_not_reject`, `gate_closed_explains_reason_and_disables_requests`, `rejection_correction_trail_visible`, `request_without_edge_shows_explicit_error_and_keeps_verdict` (kapı geçici açıldı, Edge çağrısı 1 kez denendi, mevcut AI sonucu değişmedi, kapı geri kapatıldı), `policy_preview_visible`, `source_revisions_hash_last_check_diff_and_stale_visible`, `official_index_check_without_edge_explicit_error`, `revision_approve_with_note_and_confirmation` (fark sürümü onaylandı, eski onaylı kopya `superseded`, kaynak `verified`), `ai_policy_matrix_read_only_table`, `model_disable_impact_preview`, `provider_change_impact_blocked_with_reasons` (Gemini: «sağlayıcı yapılandırılmadı», `GEMINI_API_KEY`), `failure_queue_server_side_filter_and_pagination` (27 kayıt → 1–25, 26–27; `plan` 13; `done` 7), `no_page_exceptions_or_horizontal_overflow`.
- Görüntüler `ui/01…12-*.png` (1280×800).
- Deneme geçmişi: 1. koşu fixture yetki hatası (service_role `gina` tablosunu okuyamıyor → doğrulama tablosu sahiple kuruldu), 2. koşu select etiketi bulucusu (sarmalayan `label` erişilebilir adı seçili seçeneği içeriyor → testte `combobox` + ad deseni); ürün davranışı değiştirilmedi. 3. ve son koşu temiz.

### Kalan sınır

- Gerçek Edge (`content-prereview`, `curriculum-source-fetch`) ile uçtan uca **denenmedi**; yalnız «Edge yok» yolu doğrulandı. Edge dağıtılınca bir kez gerçek tıklama ile doğrulanmalı (ücretli çağrı olacağı için kapı ve sağlayıcı kararı yöneticide).
- Senaryo adaylarının (curriculum_candidate) AI rozeti bu turda adaylar listesine eklenmedi; aday AI kaydı sunucuda var, «Karar bekleyen tümünü kuyruğa al» onları da kuyruğa alır.
- Stale eşiği (7 gün) istemci sabitidir (`SOURCE_STALE_DAYS`); ürün kararı gerekirse değiştirilir. Yeni bir kaynak hedefi (yıl/dönem/ders) eklemek için form yok; mevcut kaynaklar yeniden kontrol edilebilir.
- İçerik listesi tek istekte en çok 200 kayıt getirir (RPC `p_limit` ≤ 500, sayfalama yok); dolarsa ekran «ilk 200; filtreyi daraltın» der.
- Model pasifleştirme onayı hâlâ `window.confirm` (A3 S06-a P2); önizleme metni artık sunucudan.
- Senaryo kaynakları sekmesinde mevcut geniş çalışma alanı 1280'de kenar menüyü daraltıyor (yatay taşma yok; önceden var olan düzen).
- `database.types.ts` yeniden üretilmedi (paket sahipliği dışında); RPC'ler `review-rpc.ts` üzerinden tipsiz çağrılıyor.
