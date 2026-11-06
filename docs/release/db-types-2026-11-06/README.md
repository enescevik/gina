# database.types.ts yeniden üretimi — 2026-11-06

Kaynak: main `304f303` (≥ `e4bc2dc`), 126 migration (bu gece eklenen 18 tanesi `20261106*`).

## Komut

```bash
scripts/gen-db-types-isolated.sh --run-local
```

- `supabase_db_gina` container'ında boş `gina_completion_audit` şablonundan benzersiz adlı geçici DB
  (`gina_dbtypes_<10 hex>_audit`) klonlanır; şablonun boş olduğu doğrulanır (`families`/`auth.users` = 0).
- Varsayılan "fresh" mod: şablondaki `public`/`gina` şeması düşürülür, **126 migration'ın tamamı** sıfırdan
  uygulanır (`scripts/test-q02-sql.py --fresh` ile aynı hazırlık). `--legacy` q02'nin varsayılan modunu taklit eder.
- Tipler: `pnpm exec supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/<geçici_db> --schema public`
  (CLI 2.122.0). Çıktı biçimi mevcut dosyayla aynı (CLI'nin biçimlendirilmemiş çıktısı; ek başlık yok).
- Geçici DB `trap` ile her durumda `drop database ... with (force)` edilir (çalıştırmada: `gina_dbtypes_8a63a9d4b5_audit` silindi).
- Uygulama/demo DB'sine `db reset` yapılmadı, `pnpm db:types` kullanılmadı, üretime bağlanılmadı.

## Fark özeti (eski → yeni, TypeScript AST ile sayıldı)

| Bölüm | Eski | Yeni | Eklenen | Kaldırılan |
|---|---|---|---|---|
| Tables | 96 | 98 | 2 | 0 |
| Views | 2 | 2 | 0 | 0 |
| Functions | 259 | 320 | 61 | 0 |
| Enums | 16 | 16 | 0 | 0 |

**Hiçbir tablo, görünüm, RPC veya enum kaldırılmadı.**

### Eklenen tablolar
`ai_feature_requirements`, `ai_providers`

### Eklenen RPC'ler (61)
admin_ai_failed_operations, admin_ai_policy_matrix, admin_announcement_channels, admin_content_prereviews,
admin_families_search, admin_family_entitlement_timeline, admin_import_education_calendar_seed,
admin_library_content_items, admin_library_group_integrity, admin_library_package_trail,
admin_model_disable_preview, admin_override_apply, admin_override_preview, admin_provider_change_impact,
admin_subject_synonyms, admin_workqueue, ai_model_support, apply_verified_store_state, bulk_archive_apply,
bulk_archive_history, bulk_archive_preview, bulk_restore_apply, channel_claim, channel_readiness,
channel_record_result, channel_report_provider_status, check_deletion_preview, claim_operator_reconcile,
claim_store_notification, confirm_child_deletion, confirm_contact_verification, content_prereview_claim,
content_prereview_finish, content_prereview_next, contribution_review_trail, deletion_preview,
enqueue_content_prereview, family_library_credits, finish_operator_reconcile, finish_question_contribution,
finish_setup_generation, finish_store_notification, get_ai_usage, get_attempt_summary, group_exam_phases,
library_policy_preview, my_notification_channels, prepare_learning_plan_import, record_store_account_conflict,
release_channel_operations, request_contact_verification, request_content_prereview, reserve_child_ai_operation,
reserve_learning_plan_import, reserve_setup_generation, revoke_contact_channel, set_notification_preference,
shared_input_ranges, shared_source_limits, suggest_subject, unsubscribe_with_token

Not: bunların bir kısmı (ör. `get_ai_usage`, `reserve_setup_generation`) önceki günlerin migration'larından gelir;
eski dosya elle bakılıyordu ve onları hiç içermiyordu.

### Değişen mevcut girdiler
- 26 tabloda yeni sütun/ilişki (ör. `ai_models`: adapter, cost_class, supports_* ...; `task_templates`, `store_notifications`,
  `study_plan_calendar_items`, `*_sync` tablolarına FK ilişkileri). Elle yazılmış kısa girdiler (`task_routine_sync`,
  `school_grade_sync`, `guided_input_options`) artık üretilmiş tam biçimde.
- 89 RPC'de anlamlı fark: çoğu argüman sırası/opsiyonellik, yeni argüman (ör. `save_school_timetable` artık
  `p_effective_from`'lu ikinci overload'a sahip), `push_claim_v2` dönüşünün `SetofOptions` biçimi,
  `Record<string, never>` → `Record<PropertyKey, never>`.
- **Beklenmedik daralma:** `supabase gen types` Postgres fonksiyon argümanlarına `| null` yazmaz. Eski elle
  yazılmış tipte `| null` olan 17 argüman bu yüzden zorunlu-non-null oldu ve 4 ekran kırıldı (aşağıda).

## Tip uyumu düzeltmesi (yalnız `packages/core/src`)

- `packages/core/src/database.overrides.ts` (yeni): üretilmiş `Database` tipini sarar ve yalnız şu argümanlara
  `| null` geri ekler (eski tipte olduğu gibi):
  `admin_save_contribution_reward.p_plan`, `change_child_education.{p_grade,p_school}`,
  `change_child_education_with_calendar.{p_grade,p_school,p_calendar_id,p_calendar_revision,p_reason,p_detail}`,
  `mark_parent_inbox.p_archived`, `push_record_delivery.{p_error,p_retry_after}`,
  `record_curriculum_source_fetch.p_revision`, `save_answer_review.p_score`, `save_calendar_event.p_values`,
  `score_open_answer.p_score`, `set_operation_member.p_expires_at`.
- `packages/core/src/index.ts`: `Database` artık `./database.overrides`'tan; `Json/Tables/...` yine `./database.types`'tan.
- `database.types.ts` elle düzenlenmez; tekrar üretimde yalnız betik çalıştırılır, override listesi korunur.

Override'sız (salt üretilmiş tip) ilk denemede kırılanlar (bilgi için):
- `apps/mobile/src/app/parent/inbox.tsx(52)` — `mark_parent_inbox.p_archived` null
- `apps/mobile/src/components/education/education-period.tsx(204)` — `change_child_education_with_calendar` null'lar
- `apps/mobile/src/components/learning/parent-review-workspace.tsx(215)` — `save_answer_review.p_score` null
- `apps/backoffice/src/components/LibraryPolicy.tsx(37)` — `admin_save_contribution_reward.p_plan` null

## Test çıktıları (override ile, son durum)

| Komut | Sonuç |
|---|---|
| `pnpm --filter @gina/core typecheck` | exit 0 |
| `pnpm --filter @gina/core test` | 52 dosya / 365 test geçti |
| `pnpm --filter @gina/mobile exec tsc --noEmit` | exit 0, çıktı yok |
| `pnpm --filter @gina/backoffice typecheck` | exit 0 (`next typegen && tsc --noEmit`) |

Baseline (eski dosya ile): mobil ve backoffice typecheck hatasız.

## Ekranlarda artık kaldırılabilecek tipsiz çağrılar (değiştirilmedi)

Arama: `git grep -lE 'adminRpc|UntypedRpc|LooseRpc|BulkRpc|as unknown as .*[Rr]pc|untyped call|predate' -- apps packages`
ve dosyalardaki `rpc("ad")` adları yeni `Functions` listesiyle karşılaştırıldı. Hepsi artık tipli:

Mobil:
- `apps/mobile/src/components/ui/bulk-archive-sheet.tsx:33-34,79,112` — `BulkRpc` sarmalı: `bulk_archive_preview`, `bulk_archive_apply`, `bulk_restore_apply`
- `apps/mobile/src/components/deletion-preview-sheet.tsx:31,70` — `deletion_preview`
- `apps/mobile/src/app/parent/menu.tsx:56-62` — `confirm_child_deletion` (dosyadaki `rpc` bind'ı)

Backoffice (`adminRpc` = `apps/backoffice/src/components/review-rpc.ts`, `s04Rpc` = `apps/backoffice/src/components/s04-rpc.ts`):
- `s04-rpc.ts` tümüyle: `suggest_subject`, `admin_subject_synonyms`, `admin_import_education_calendar_seed`
  (çağıranlar: `calendar-seed-import.tsx:101`, `subject-synonyms.tsx:17,85`)
- `ai-failure-queue.tsx:60` admin_ai_failed_operations
- `ai-policy.tsx:58,163,199` admin_ai_policy_matrix, admin_model_disable_preview, admin_provider_change_impact
- `pages/ai.tsx:148` admin_model_disable_preview
- `content-prereview.tsx:35,161` admin_content_prereviews, request_content_prereview
- `entitlement-timeline.tsx:37` admin_family_entitlement_timeline
- `library-content-items.tsx:118,147,166,186,187` admin_library_content_items, request_content_prereview,
  enqueue_content_prereview, contribution_review_trail, admin_library_package_trail
- `library-policy-preview.tsx:21` library_policy_preview
- `workqueue.tsx:25` admin_workqueue
- `lib/override-apply.ts:20,26` admin_override_preview, admin_override_apply
- `pages/families.tsx:33,57`, `pages/overrides.tsx:42` admin_families_search
- `adminRpc` üzerinden zaten eskiden de tipli olan RPC'ler: `curriculum-sources.tsx:56,152`
  (admin_list_curriculum_sources, admin_review_curriculum_source_revision), `pages/ai.tsx:140` admin_set_ai_enabled,
  `pages/overrides.tsx:94` admin_list_overrides

Dönüş tipleri çoğu `Json` olduğundan çağıran taraftaki core şeması doğrulaması yine gerekir.

## Sınırlar
- Yalnız `public` şeması üretildi (mevcut dosya ile aynı). `gina` şeması kapsam dışı.
- Fonksiyon argümanı nullability'si SQL'den çıkarılamaz; yeni RPC'lerde null gönderilmesi gerekirse
  `database.overrides.ts` listesine eklenmeli.
- Supabase CLI 3.0.0 mevcut; 2.122.0 ile üretildi (lockfile sürümü).
