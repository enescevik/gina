# U08 — Ortak kontroller ve durumlar (sunucu + core) — 6 Kasım 2026

Durum: **KISMEN KOD HAZIR, TEST EDİLDİ (izole), YAYIMLANMADI. UI bağlanmadı.** Koordinatörün kota nedeniyle erken toparlanma talimatıyla (00:35 civarı) iş güvenli noktada kesildi. Aşağıda yapılan ve **yapılmayan** açıkça ayrılmıştır. Gerçek ücretli AI çağrısı yapılmadı; üretim Supabase'e dokunulmadı.

Dal: `worktree-agent-af28078e7b609e82c` (main'e push edilmedi). Migration: `supabase/migrations/20261106120000_shared_limits.sql`. pgTAP: `supabase/tests/099_shared_limits.test.sql`.

## Yapılanlar

| Alan | Dosya | İçerik |
|---|---|---|
| Core (tek kaynak) | `packages/core/src/shared-limits.ts` (+ `.test.ts`, `sql-raw.d.ts`, `index.ts` tek satır export) | `ERROR_CATEGORIES`, `ServerErrorBody`, `ERROR_CODE_RULES` (kod → kategori/retryable/retry_after_s), `classifyServerError()`, `errorBody()`, `sanitizeDetails()`; `SOURCE_LIMIT_DEFAULTS`, `readSourceLimits()`, `checkSourceSelection()` (limit aşımında `validation` + `remaining`); `INPUT_RANGES` (12 alan), `checkInputRange()`, `presetsWithin()` |
| Edge | `supabase/functions/_shared/error-contract.ts` | `fail(code, status?, {details, retry_after_s})` → `{error, code, category, retryable, retry_after_s?, details?}`; `error` eski alan olarak korunur; güvensiz kod `server_error`; `sanitizedCode()`, `isContractBody()` |
| Edge | `supabase/functions/_shared/auth.ts` (+ `auth-access.test.ts`) | `readParentAccess()` → `session_expired` (JWT `exp` geçmiş; Auth'a gitmeden) / `unauthorized` (token yok, doğrulanamadı, sub uyuşmaz) / `forbidden` (anonim, rol, aile üyeliği, aktif aile) ; `accessResponse()` 401/401/403 sözleşmeli gövde; `parentOrResponse()`. Eski `readParent()` imzası ve davranışı aynı (mevcut `auth.test.ts` geçti) |
| DB | `20261106120000_shared_limits.sql` | `public.shared_source_limits(p_action, p_family)`: `sources.max_files` (1–10, varsayılan 5) ∩ ailenin paketine ait `ai_operation_policies.max_media_items/max_media_bytes` (S06); `get_learning_source_policy()` ve `register_learning_source_set()` bu okuyucuyu kullanır (mobil seçici değişmeden aynı `max_files` alanını okur); S06 tohumundaki dokunulmamış 10 MiB medya baytı yayımlanmış 20 MiB toplamla hizalandı; `public.shared_input_ranges()` (core `INPUT_RANGES` ile birebir literal); `gina.check_input_range()` yalnız service_role |
| Test | pgTAP 099, core vitest, Deno `auth-access.test.ts` | Aşağıda |

### Hata sınıflandırma sözleşmesi

Gövde: `{ error, code, category, retryable, retry_after_s?, details? }`. `error === code` (eski istemciler `error` okur). Kategoriler: `permission_denied | offline | unauthorized | session_expired | service_unavailable | rate_limited | validation | conflict`. Kod `^[a-z][a-z0-9_]{0,63}$` desenine uymazsa `server_error`; `details` yalnız sonlu sayı/boolean/null/kısa sabit metin (UUID ve ham mesaj atılır). Gateway `verify_jwt` reddi (401, gövdede sözleşme yok) istemcide `session_expired` sayılır; fonksiyon düzeyindeki ayrım `readParentAccess` ile yapılır (izole koşucuda gateway yoktur, orada doğrudan görünür).

| Kategori | Kodlar (özet) | retryable |
|---|---|---|
| unauthorized | `unauthorized` | hayır |
| session_expired | `session_expired` | hayır (oturum yenilenir) |
| permission_denied | `forbidden`, `source_not_available`, `plan_has_no_ai` | hayır |
| validation | `invalid_input`, `source_size_or_type`, `source_file_limit`, `source_*_consent_required`, `ai_input_too_large`, `library_media_invalid`, … | hayır |
| conflict | `request_conflict`, `child_archived`, `question_in_use`, `source_not_ready`, `source_upload_incomplete`, `plan_import_unavailable`, `generation_in_progress` (20 s) | çoğu hayır |
| rate_limited | `ai_rate_limited` (60 s), `source_rate_limited` (60 s), `ai_quota_exceeded` | 60 s / kota: hayır |
| service_unavailable | `ai_disabled`, `ai_not_configured`, `provider_unconfigured`, `ai_model_unsupported`, `ai_result_uncertain`, `*_failed`, `source_unavailable`, `server_error` | geçici olanlar evet; belirsiz üretim hayır |
| offline | yalnız istemci (ağ hatası) | evet |

### Yönetilen varsayılan 5 sınırı — tek kaynak

| Değer | DB | Core |
|---|---|---|
| max_files | `app_settings.sources.max_files` (1–10, varsayılan 5) ∩ politika `max_media_items` | `SOURCE_LIMIT_DEFAULTS.max_files = 5`, `readSourceLimits()` 1–10'a kırpar |
| max_total_bytes | `least(20971520, politika max_media_bytes)` | 20 971 520 |
| max_image_bytes / max_pdf_bytes / max_pdf_pages / max_total_pages | 4 MiB / 10 MiB / 5 / 20 | aynı |

### Sayı/süre aralıkları (`shared_input_ranges()` = `INPUT_RANGES`)

`prova_minutes 1–180 [10,15,20,30,45,60]`, `prova_target 1–100 [5,10,15,20]`, `source_question_count 1–30`, `task_stars 0–10`, `reward_cost_stars 1–500`, `timetable_lesson_minutes 5–180 [30,35,40,45,50]`, `timetable_break_minutes 0–120`, `study_item_minutes 5–60`, `group_exam_minutes 5–120`, `school_max_score 1–9999`, `setup_task_stars 1–5`, `setup_reward_stars 1–100`. pgTAP mevcut check kısıtlarıyla (ödül 1–500, görev 0–10, grup sınavı 5–120) eşleşmeyi doğrular.

## Testler (gerçekten çalıştırıldı)

Ortam: izole DB (`gina_completion_audit` şablonundan `gina_u08_*_audit` klonu, 20261103093000+ migration'lar uygulandı, test sonrası düşürüldü). Deno 2.9.8, pnpm 10.33.2.

```
pgTAP 099_shared_limits (izole DB)                      → 1..46, 46 ok
pgTAP 073_learning_source_sets (regresyon)              → 1..17, 17 ok
pgTAP 092_ai_provider_matrix (regresyon)                → 1..53, 53 ok
pnpm --filter @gina/core exec vitest run                → 46 files, 306 tests passed (14 yeni)
tsc --noEmit (core)                                     → shared-limits temiz; main'den gelen period-transfer.test.ts TS2532 hataları bu işten bağımsız
deno check (error-contract, auth, 5 Edge giriş noktası) → temiz
deno test auth.test + auth-access.test                  → 3 passed
deno test ai-operation, prova-document, setup-suggestions, learning-plan-import, auth → 46 passed
```

pgTAP 099 kapsamı: S06 medya baytı hizası; varsayılanların core ile eşitliği; seçici politikasının paylaşılan okuyucudan gelmesi; 6 dosya reddi; yönetici 3'e düşürünce seçici ve sunucunun aynı anda 3 görmesi, 4 dosya reddi, 3 kabul ve tekrar aynı anchor; daha dar politika satırının (2 öğe / 5 MiB) ayarı ezmesi; cihaz rolünün `42501 forbidden` (permission_denied) alması; 12 aralık + DB check kısıtlarıyla uyum; `check_input_range` sınır/kesir/bilinmeyen alan; **tek işlem hakkı**: çoklu import tek iş, çalışırken aynı istek `generation_in_progress`, bitince aynı hash `cached` + aynı iş kimliği, belirsiz biten iş `ai_result_uncertain` (tekrar çalışmaz), iki ayrı analiz = 2 import hakkı, **soru üretim (`generate`) kotası değişmez**.

## Yapılmayanlar (açık)

- **Edge fonksiyonlarına bağlama yapılmadı:** `learning-source`, `timetable-import`, `learning-plan-import`, `setup-suggestions`, `library-media`, `ai-operation.ts`, `prova-document.ts`, `prova.ts` hâlâ `json({error})` ve `readParent` kullanır; `fail()`/`parentOrResponse()` ve `shared_source_limits` okuyucusu bu uçlara **takılmadı**. Sözleşme gövdesi şu an yalnız `accessResponse()` üzerinden üretilir. Sonraki adım: her uçta `json({error:x},s)` → `fail(x,s)`, `readParent` → `parentOrResponse`, `provaDocument` sınırını `shared_source_limits(purpose)` ile okuyup `source_file_limit` + `details.remaining` döndürmek.
- Her fonksiyon için Deno hata-sözleşmesi/limit-aşımı/tek-hak testleri yazılmadı (yalnız auth ayrımı ve mevcut regresyonlar koştu). `timetable-import`/`learning-source` handler ayrıştırması yapılmadı.
- `scripts/isolated-source-contract.mjs` genişletilmedi ve `scripts/test-isolated-services.py --run-local --with-storage` **bu dalda çalıştırılmadı** (süre). Migration'ın gerçek PostgREST/Edge yolu yalnız pgTAP ile doğrulandı.
- `apps/mobile`, `apps/backoffice` ve `components/ui/` dokunulmadı (kapsam gereği); istemci `classifyServerError`/`readSourceLimits`/`INPUT_RANGES`'i henüz kullanmıyor.
- `DB check` kısıtları değiştirilmedi; `gina.check_input_range()` tanımlandı ama hiçbir RPC onu henüz çağırmıyor.
- Üretime migration uygulanmadı; yayın koordinatöründe. Migration geriye uyumludur (yeni fonksiyonlar + mevcut iki RPC'nin gövdesi; dönüş şekilleri değişmedi, `get_learning_source_policy` yalnız alan ekler).

## Bağlama (6 Kasım gecesi, ikinci tur)

Durum: **KOD HAZIR, İZOLE TEST EDİLDİ, YAYIMLANMADI.** Dal `worktree-agent-af50f629d5929ec48` (main `eeb57af` üzerinde; main'e push edilmedi). Üretim Supabase'e dokunulmadı; gerçek ücretli AI çağrısı yok (sahte sağlayıcı/fetch).

### Ne bağlandı

| Dosya | Değişiklik |
|---|---|
| `_shared/error-contract.ts` | `fail(..., { legacy })`: eski gövdelerdeki sunucu tanımlı sabit üst düzey alanlar (`plan`, `provider`, `reasons`, `unsupported_features`) korunur; sözleşme alanlarını ezemez. `auth.ts`'e `jwtExpired()` eklendi. |
| `_shared/ai-operation.ts`, `_shared/prova.ts` | Tüm `json({error})` → `fail()`. Rezervasyon kodu (`job.error`) sözleşmeden geçer: bilinmeyen/ham metin `server_error`. HTTP durum kodları eskisiyle aynı. `prova.ts` artık `parentOrResponse`'u da dışa verir. |
| `_shared/prova-document.ts` | Sınırlar `shared_source_limits(p_action, p_family)`'den (`sourceLimits()` + core `readSourceLimits`). Amaç → politika eylemi: `generate→generate`, `import→import`, `setup→null` (ayrı politika satırı yok, genel sınır). Set adedi aşımı → 400 `source_file_limit`, `details {max_files, selected, remaining:0}`; yapı/sayfa aşımı da `source_file_limit` + `remaining`; bayt/PDF sayfa → `source_size_or_type` + sınır ayrıntısı; okuyucu hatası → 503 `data_failed` (indirmeden önce). Görsel başına sınır artık `max_image_bytes` (rezervasyondaki 4 MiB ile aynı), PDF `max_pdf_bytes`. |
| `learning-source/` | `handler.ts`'e ayrıldı (`index.ts` yalnız `Deno.serve`). Veli eylemleri `parentOrResponse`. `view` (veli+cihaz): belirteç yok → 401 `unauthorized`, süresi dolmuş → 401 `session_expired`, erişim reddi → 403 `source_not_available`. RPC mesajları `sanitizedCode` izin listesinden geçer. |
| `timetable-import/` | `handler.ts`'e ayrıldı, bağımlılıklar enjekte edilebilir; `parentOrResponse` + `fail`. |
| `learning-plan-import/` | `parent` bağımlılığı `parentOrResponse` (Response aynen döner; eski `null` → 403 `forbidden`). |
| `setup-suggestions/` | `readParent` → `parentOrResponse`; rezervasyon kodu sözleşmeden geçer. |
| `library-media/` (yönetici) | Belirteç yok → 401 `unauthorized` (önce 403'tü), süresi dolmuş → 401 `session_expired`, yönetici değil → 403 `forbidden`. |
| CI | `deno test` adımına `auth-access`, `learning-source/handler`, `timetable-import/handler` testleri eklendi. |

Eski istemci uyumu: her hata gövdesinde `error === code` korunur; durum kodları değişmedi, **tek bilinçli değişiklik**: kimliksiz `library-media` ve kimliksiz/süresi dolmuş `learning-source view` artık 403 yerine 401 döner (backoffice/mobil `error` alanını okur, durum koduna dallanmıyor — grep ile bakıldı).

### Testler (gerçekten çalıştırıldı, Deno 2.9.8)

```
CI deno check (satır 51, 22 giriş noktası)                         → exit 0
deno check library-media/index.ts + tüm */handler.test.ts + _shared/*.test.ts → exit 0
CI deno test satır 52                                                → 232 passed, 0 failed
CI deno test satır 54 / 55 / 56 / 57 / 58                            → 28 / 54 / 10 / 13 / 23 passed, 0 failed
  (55: prova-document 16, auth-access, learning-source 4, timetable-import 4, push-send)
```

Yeni/güncellenen kapsam: her uçta `session_expired` / `unauthorized` (yok + doğrulanamayan) / `forbidden` (cihaz rolü, üyelik yok) gerçek `parentOrResponse` + sahte Auth ile, hiçbir veri/RPC/indirme/ücretli çağrı yapılmadan (`_shared/contract-fixtures.ts`); hata gövdesi `isContractBody`; limit aşımı (`shared_source_limits` max 3 → 4 dosya `source_file_limit`, `remaining:0`, indirme 0; dar politika bayt tavanı; 6 sayfalı PDF; okuyucu kesintisi); **tek ücretli iş**: `ai-operation` durumlu rezervasyonla aynı istek eşzamanlı (biri `generation_in_progress` 409 + `retry_after_s:20`) ve sonra tekrar (`cached`, aynı `job-1`) → sağlayıcıya 1 mesaj çağrısı; `timetable-import` gerçek `runAiOperation` + sahte fetch ile iki istek → 1 ücretli çağrı, 1 iş; `setup-suggestions` aynı `request_id` iki kez → 1 ücretli çağrı, aynı yanıt; `learning-plan-import` iki istek → 1 `run`, 1 belge indirme; `learning-source` aynı kimlikle iki rezervasyon → tek kayıt.

İzole servis regresyonu: `python3 scripts/test-isolated-services.py --run-local --with-storage` → exit 0, **275/275 kontrol true**, kendi `gina_http_<rastgele>_audit` DB'si + auth/rest/storage container'ları kuruldu ve kaldırıldı (`cleanup` hepsi true). `scripts/isolated-source-contract.mjs`'e 3 U08 kontrolü eklendi: `u08_foreign_view_contract_body` (403 `source_not_available`/`permission_denied`), `u08_device_parent_action_forbidden` (cihazla `delete` → 403 `forbidden`), `u08_consent_contract_body` (400 `validation`). Gerçek Edge yolu bu koşucuda kendi Deno sunucusundan (`scripts/isolated-source-edge.ts`), gateway `verify_jwt` olmadan.

### Kalan sınır

- İstemciler (`apps/mobile`, `apps/backoffice`) `code/category/retryable` alanlarını henüz okumuyor (`classifyServerError` bağlanmadı; ekran dosyaları bu işin kapsamı dışında).
- `prova-generate`, `prova-grade`, `prova-plan`, `ai-weekly-summary` vb. bu beş uç dışındaki fonksiyonlar hâlâ `readParent`/`json({error})`; yalnız ortak `_shared` yolları (`ai-operation`, `prova`, `prova-document`) üzerinden sözleşmeli gövde alırlar.
- `gina.check_input_range()` hâlâ hiçbir RPC tarafından çağrılmıyor.
- Hosted gateway'de süresi dolmuş JWT fonksiyona ulaşmadan 401 alır (gövdesiz); istemci bunu `session_expired` saymalı (core `classifyServerError` zaten öyle yapar).
