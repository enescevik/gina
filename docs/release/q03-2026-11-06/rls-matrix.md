# RLS / RPC matrisi — empty-disposable-database-fresh-public-schema-all-migrations

Migration sayısı: 108. Tablolar: 150. Fonksiyonlar: 409 (security definer: 371). Kaynak: `rls-matrix-fresh.json`.

## Tablolar

`anon` için hiçbir tabloda SELECT/INSERT/UPDATE/DELETE yetkisi yoktur (matris sütunlarında yalnız `authenticated` gösterilir; `anon` sütunu tüm satırlarda boş çıktığı için atlandı).

| Tablo | RLS | Zorla | auth S | auth I | auth U | auth D | Politika (komut:adet) |
|---|---|---|---|---|---|---|---|
| `gina.catalog_blueprint_links` | ✓ | — | — | — | — | — | — |
| `gina.catalog_generation_links` | ✓ | — | — | — | — | — | — |
| `gina.child_archive_device_blocks` | — | — | — | — | — | — | — |
| `gina.child_archive_state` | — | — | — | — | — | — | — |
| `gina.child_education_changes` | — | — | — | — | — | — | — |
| `gina.child_education_locations` | ✓ | — | — | — | — | — | — |
| `gina.child_education_periods` | — | — | — | — | — | — | — |
| `gina.child_education_state` | — | — | — | — | — | — | — |
| `gina.cohort_appeals` | ✓ | — | — | — | — | — | — |
| `gina.cohort_publications` | ✓ | — | — | — | — | — | — |
| `gina.cohort_review_events` | ✓ | — | — | — | — | — | — |
| `gina.cohort_reviews` | ✓ | — | — | — | — | — | — |
| `gina.contribution_commands` | ✓ | — | — | — | — | — | — |
| `gina.contribution_question_credits` | ✓ | — | — | — | — | — | — |
| `gina.contribution_sets` | ✓ | — | — | — | — | — | — |
| `gina.curriculum_candidates` | ✓ | — | — | — | — | — | — |
| `gina.curriculum_commands` | ✓ | — | — | — | — | — | — |
| `gina.education_calendar_reports` | ✓ | — | — | — | — | — | — |
| `gina.education_calendars` | ✓ | — | — | — | — | — | — |
| `gina.education_notification_settings` | ✓ | — | — | — | — | — | — |
| `gina.education_places` | ✓ | — | — | — | — | — | — |
| `gina.learning_plan` | ✓ | — | — | — | — | — | — |
| `gina.learning_plan_imports` | ✓ | — | — | — | — | — | — |
| `gina.library_acquisition_charges` | ✓ | — | — | — | — | — | — |
| `gina.library_acquisitions` | ✓ | — | — | — | — | — | — |
| `gina.library_delivery_assets` | ✓ | — | — | — | — | — | — |
| `gina.library_editorial_reviews` | ✓ | — | — | — | — | — | — |
| `gina.library_import_answers` | ✓ | — | — | — | — | — | — |
| `gina.library_import_assets` | ✓ | — | — | — | — | — | — |
| `gina.library_import_packages` | ✓ | — | — | — | — | — | — |
| `gina.library_import_questions` | ✓ | — | — | — | — | — | — |
| `gina.library_import_requests` | ✓ | — | — | — | — | — | — |
| `gina.library_import_sources` | ✓ | — | — | — | — | — | — |
| `gina.library_publication_requests` | ✓ | — | — | — | — | — | — |
| `gina.library_publications` | ✓ | — | — | — | — | — | — |
| `gina.library_source_copies` | ✓ | — | — | — | — | — | — |
| `gina.note_changes` | — | — | — | — | — | — | — |
| `gina.override_commands` | — | — | — | — | — | — | — |
| `gina.parent_announcements` | ✓ | — | — | — | — | — | — |
| `gina.parent_inbox` | ✓ | — | — | — | — | — | — |
| `gina.prova_generation_cancellations` | ✓ | — | — | — | — | — | — |
| `gina.prova_generation_contexts` | ✓ | — | — | — | — | — | — |
| `gina.push_deliveries` | ✓ | — | — | — | — | — | — |
| `gina.push_recoveries` | ✓ | — | — | — | — | — | — |
| `gina.repeat_calendar_batches` | ✓ | — | — | — | — | — | — |
| `gina.repeat_calendar_items` | ✓ | — | — | — | — | — | — |
| `gina.reward_changes` | — | — | — | — | — | — | — |
| `gina.school_bags` | ✓ | — | — | — | — | — | — |
| `gina.school_grade_changes` | — | — | — | — | — | — | — |
| `gina.store_reconcile_jobs` | — | — | — | — | — | — | — |
| `gina.store_replacements` | — | — | — | — | — | — | — |
| `gina.task_routine_changes` | — | — | — | — | — | — | — |
| `gina.task_submission_receipts` | ✓ | — | — | — | — | — | — |
| `gina.weekly_summary_contexts` | ✓ | — | — | — | — | — | — |
| `public.active_families` | ✓ | — | — | — | — | — | select:1 |
| `public.admins` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.ai_models` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1 |
| `public.ai_operation_jobs` | ✓ | — | — | — | — | — | — |
| `public.ai_operation_policies` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1 |
| `public.ai_provider_health` | ✓ | — | — | — | — | — | — |
| `public.ai_request_attempts` | ✓ | — | — | — | — | — | — |
| `public.ai_settings` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1 |
| `public.ai_summaries` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:1 |
| `public.answer_review_consents` | ✓ | — | — | — | — | — | — |
| `public.answer_review_suggestions` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.app_settings` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:2, select:1 |
| `public.audit_log` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.badge_definitions` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.beta_plan_events` | ✓ | — | — | — | — | — | — |
| `public.beta_plan_selections` | ✓ | — | — | — | — | — | — |
| `public.beta_test_access` | ✓ | — | — | — | — | — | — |
| `public.child_badge_awards` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.child_goals` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.child_inventory` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.child_pins` | ✓ | — | — | — | — | — | — |
| `public.child_room_preferences` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.child_setup_requests` | ✓ | — | — | — | — | — | — |
| `public.child_shares` | ✓ | — | — | — | — | ✓ | delete:1, select:1 |
| `public.children` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.contribution_rewards` | ✓ | — | ✓ | — | — | — | all:1 |
| `public.device_children` | ✓ | — | — | — | — | — | — |
| `public.device_pairings` | ✓ | — | — | — | — | — | — |
| `public.devices` | ✓ | — | ✓ | ✓ | — | ✓ | select:3, update:1 |
| `public.entitlement_overrides` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:2, select:1 |
| `public.event_exceptions` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.events` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.exam_answers` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:1 |
| `public.exam_attempts` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.exam_blueprints` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1 |
| `public.exams` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.families` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:1, update:1 |
| `public.family_invite_attempts` | ✓ | — | — | — | — | — | — |
| `public.family_members` | ✓ | — | ✓ | ✓ | ✓ | ✓ | delete:1, select:2 |
| `public.family_rewards` | ✓ | — | ✓ | — | — | — | all:1, select:1 |
| `public.family_room_settings` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:1, select:1 |
| `public.generation_credit_allocations` | ✓ | — | — | — | — | — | — |
| `public.grades` | ✓ | — | ✓ | — | — | — | insert:1, select:1, update:1 |
| `public.group_exam_entries` | ✓ | — | — | — | — | — | — |
| `public.group_exam_entry_questions` | ✓ | — | — | — | — | — | — |
| `public.group_exam_questions` | ✓ | — | — | — | — | — | — |
| `public.group_exams` | ✓ | — | — | — | — | — | — |
| `public.guided_input_options` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.help_article_versions` | ✓ | — | — | — | — | — | — |
| `public.help_articles` | ✓ | — | — | — | — | — | — |
| `public.help_messages` | ✓ | — | — | — | — | — | — |
| `public.help_receipts` | ✓ | — | — | — | — | — | — |
| `public.help_tickets` | ✓ | — | — | — | — | — | — |
| `public.holidays` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:2, select:1 |
| `public.learning_credit_grants` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.learning_source_ai_consents` | ✓ | — | — | — | — | — | — |
| `public.learning_source_links` | ✓ | — | — | — | — | — | — |
| `public.learning_source_sets` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.learning_sources` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.library_collections` | ✓ | — | ✓ | — | — | — | all:1 |
| `public.library_items` | ✓ | — | — | — | — | — | — |
| `public.library_redemptions` | ✓ | — | — | — | — | — | — |
| `public.mutation_receipts` | ✓ | — | — | — | — | — | — |
| `public.note_sync` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.notes` | ✓ | — | ✓ | — | — | — | insert:2, select:2, update:1 |
| `public.operations_members` | ✓ | — | — | — | — | — | — |
| `public.parent_pins` | ✓ | — | — | — | — | — | — |
| `public.plan_products` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:2, select:1 |
| `public.plans` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:2, select:1 |
| `public.prova_ai_usage` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.prova_drafts` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.prova_generation_jobs` | ✓ | — | — | — | — | — | — |
| `public.push_outbox` | ✓ | — | — | — | — | — | — |
| `public.push_preferences` | ✓ | — | ✓ | ✓ | ✓ | — | all:1 |
| `public.push_tokens` | ✓ | — | ✓ | — | — | ✓ | delete:1, select:1 |
| `public.question_bank` | ✓ | — | ✓ | ✓ | ✓ | ✓ | all:3, select:1 |
| `public.question_contributions` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.question_source_groups` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.question_source_members` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.reward_catalog_sync` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.reward_requests` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.room_weather_cache` | ✓ | — | — | — | — | — | — |
| `public.school_grade_sync` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.school_timetables` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.setup_ai_jobs` | ✓ | — | — | — | — | — | — |
| `public.source_deletion_queue` | ✓ | — | — | — | — | — | — |
| `public.star_events` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.store_notifications` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:1 |
| `public.store_subscriptions` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:1 |
| `public.study_plan_calendar_items` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.study_plans` | ✓ | — | ✓ | ✓ | ✓ | ✓ | delete:1, select:1 |
| `public.task_completions` | ✓ | — | ✓ | ✓ | ✓ | ✓ | select:2 |
| `public.task_routine_sync` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.task_templates` | ✓ | — | ✓ | — | — | — | all:1, select:1 |
| `public.timetable_imports` | ✓ | — | ✓ | — | — | — | select:1 |
| `public.weather_cities` | ✓ | — | ✓ | — | — | — | select:1 |

## Görünümler

| Görünüm | security_invoker | anon SELECT | authenticated SELECT |
|---|---|---|---|
| `public.current_question_bank` | ✓ | — | ✓ |
| `public.standalone_question_bank` | ✓ | — | ✓ |

## Fonksiyonlar (tetikleyici fonksiyonları hariç)

Sütunlar: SD = security definer, SP = `search_path` sabit, anon/auth = EXECUTE yetkisi, is_device = gövde `gina.is_device()` kullanır (cihaz iptali `devices.revoked_at` burada denetlenir), çağıran = gövdede çağıran kimliği/rol denetimi deseni bulundu (heuristik).

| Fonksiyon | SD | SP | anon | auth | is_device | çağıran |
|---|---|---|---|---|---|---|
| `gina.announcement_audience(p_place uuid, p_stage text)` | ✓ | ✓ | — | — | — | — |
| `gina.announcement_family_matches(p_family uuid, p_place uuid, p_stage text)` | ✓ | ✓ | — | — | — | — |
| `gina.announcement_recipients(p_place uuid, p_stage text)` | ✓ | ✓ | — | — | — | — |
| `gina.answer_fingerprint(a exam_answers)` | — | ✓ | — | — | — | — |
| `gina.assert_admin()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.assert_pin(p_pin text)` | — | — | — | — | — | — |
| `gina.automatic_group_result(p_group uuid, p_child uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.award_badges_for_child(p_child_id uuid, p_family_id uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.award_contribution_milestones(p_family uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.can_read_question_media(q uuid)` | ✓ | ✓ | — | — | ✓ | ✓ |
| `gina.change_child_education(p_request_id uuid, p_child_id uuid, p_revision integer, p_action text, p_academic_year integer, p_grade integer, p_school text, p_starts_on date, p_timetable_revision integer, p_keep_timetable boolean)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.check_report_period(p_child_id uuid, p_period text)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.child_id()` | — | — | ✓ | ✓ | — | — |
| `gina.child_star_balance(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `gina.claims()` | — | ✓ | ✓ | ✓ | — | — |
| `gina.cohort_notification_current(p_payload jsonb, p_family uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.cohort_review_state(p_group uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.cohort_rows(p_group uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.contribution_snapshot(p_question_id uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.curriculum_projection(c gina.curriculum_candidates)` | — | ✓ | — | — | — | — |
| `gina.curriculum_subject(p text)` | — | ✓ | — | — | — | — |
| `gina.curriculum_url(p jsonb)` | — | ✓ | — | — | — | — |
| `gina.device_allows(p_device_id uuid, p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `gina.difficulty_ord(p question_difficulty)` | — | — | — | ✓ | — | — |
| `gina.education_ancestors(p_place uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.education_calendar_match(p_place uuid, p_stage text, p_year integer)` | ✓ | ✓ | — | — | — | — |
| `gina.education_calendar_warning(p_match jsonb, p_action text, p_date date)` | — | ✓ | — | — | — | — |
| `gina.effective_entitlement(p_family uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.enqueue_education_reminders()` | ✓ | ✓ | — | — | — | — |
| `gina.enqueue_push(p_family_id uuid, p_audience text, p_kind text, p_payload jsonb, p_target_child_id uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.enroll_reviewed_group(p_group uuid, p_child uuid, p_ranking boolean, p_consent boolean, p_review_consent boolean)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.exam_references_valid(f uuid, c uuid, ids uuid[], blueprint uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.family_id()` | — | — | ✓ | ✓ | — | — |
| `gina.family_month_start(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `gina.family_plan()` | ✓ | ✓ | — | ✓ | — | — |
| `gina.family_plan_of(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `gina.generation_balance(f uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.group_scores(p_group uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.has_operation_role(p_role text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.help_receipt(p_request uuid, p_payload jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.import_int(p jsonb, min_value integer, max_value integer)` | — | ✓ | — | — | — | — |
| `gina.import_key(p jsonb)` | — | ✓ | — | — | — | — |
| `gina.import_keys(p jsonb, keys text[])` | — | ✓ | — | — | — | — |
| `gina.import_png(p bytea)` | — | ✓ | — | — | — | — |
| `gina.import_text(p jsonb, min_length integer, max_length integer)` | — | ✓ | — | — | — | — |
| `gina.inbox_push_current(p_id text, p_user uuid, p_family uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.is_admin()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.is_admin_strict()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.is_device()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.is_parent()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `gina.is_service()` | — | — | — | ✓ | — | — |
| `gina.kick_push_send()` | ✓ | ✓ | — | — | — | — |
| `gina.learning_import_parent(p_family uuid, p_user uuid, p_child uuid, p_source uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.learning_import_view(p_id uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.learning_plan_access(p_child uuid)` | ✓ | ✓ | — | — | ✓ | ✓ |
| `gina.library_grant_used(g uuid)` | — | ✓ | — | — | — | — |
| `gina.library_hash(p jsonb)` | — | ✓ | — | — | — | — |
| `gina.library_month_used(f uuid)` | — | ✓ | — | — | — | — |
| `gina.library_publication_checks(p_id uuid)` | — | ✓ | — | — | — | — |
| `gina.library_question(p jsonb)` | — | ✓ | — | — | — | — |
| `gina.library_review_fingerprint(p_id uuid)` | — | ✓ | — | — | — | — |
| `gina.plan_rank(p plan_code)` | — | — | — | ✓ | — | — |
| `gina.prova_draft_questions(f uuid, c jsonb)` | ✓ | ✓ | — | — | — | — |
| `gina.push_delivery_due()` | ✓ | ✓ | — | — | — | — |
| `gina.push_for_child(p_target uuid, p_payload jsonb, p_child uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.push_recovery_available(o push_outbox)` | ✓ | ✓ | — | — | — | — |
| `gina.recompute_attempt_totals(p_attempt_id uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.reconcile_job_receipt(j gina.store_reconcile_jobs)` | — | ✓ | — | — | — | — |
| `gina.remember_task_submission(p_client uuid, p_row task_completions)` | ✓ | ✓ | — | — | — | — |
| `gina.repeat_calendar_source(p_attempt uuid, p_family uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.require_active_child(p_child uuid)` | ✓ | ✓ | — | — | — | — |
| `gina.role()` | — | — | ✓ | ✓ | — | — |
| `gina.save_help_receipt(p_request uuid, p_payload jsonb, p_result jsonb, p_family uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.school_bag_access(p_child uuid)` | ✓ | ✓ | — | — | ✓ | ✓ |
| `gina.share_audit(p_action text, p_share_id uuid, p_family_id uuid, p_details jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `gina.source_file_limit()` | ✓ | ✓ | — | — | — | — |
| `gina.valid_answer_document(d jsonb)` | — | ✓ | — | ✓ | — | — |
| `gina.valid_review_document(d jsonb)` | — | ✓ | ✓ | ✓ | — | — |
| `gina.validate_curriculum_candidate(p jsonb)` | — | ✓ | — | — | — | — |
| `gina.validate_education_calendar(v jsonb)` | — | ✓ | — | — | — | — |
| `gina.validate_prova_draft(f uuid, c jsonb)` | ✓ | ✓ | — | — | — | — |
| `public.acquire_library_units(p_request_id uuid, p_package_id uuid, p_publication_version integer, p_unit_keys text[], p_draft_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_add_library_item(p_collection_id uuid, p_content jsonb, p_publish boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_ai_operations()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_announcements(p_before timestamp with time zone, p_before_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.admin_cancel_group_exam(p_id uuid, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_change_curriculum_candidate(p_request_id uuid, p_id uuid, p_revision integer, p_action text, p_review jsonb, p_note text, p_confirmed boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_cohort_review_detail(p_entry uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_cohort_review_queue(p_group uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_create_group_exam(p_id uuid, p_collection uuid, p_title text, p_items uuid[], p_start timestamp with time zone, p_end timestamp with time zone, p_minutes integer, p_plans plan_code[])` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_create_package_group_exam(p_id uuid, p_package_id uuid, p_publication_version integer, p_title text, p_units text[], p_start timestamp with time zone, p_end timestamp with time zone, p_minutes integer, p_plans plan_code[])` | ✓ | ✓ | — | ✓ | — | — |
| `public.admin_create_reviewed_group_exam(p_id uuid, p_package_id uuid, p_publication_version integer, p_title text, p_units text[], p_start timestamp with time zone, p_end timestamp with time zone, p_minutes integer, p_plans plan_code[], p_review boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_dashboard()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_decide_contribution_set(p_request_id uuid, p_id uuid, p_approve boolean, p_note text, p_teachers jsonb, p_confirmed boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_delete_global_question(p_question_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_education_calendars()` | ✓ | ✓ | — | ✓ | — | — |
| `public.admin_education_reminder_settings(p_request uuid, p_revision integer, p_enabled boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_expire_override(p_override_id uuid, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_get_contribution_set(p_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_get_curriculum_candidate(p_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_get_library_import(p_id uuid, p_include_answers boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_get_library_reviews(p_package_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_grant_override(p_family_id uuid, p_plan plan_code, p_reason text, p_ends_at timestamp with time zone, p_starts_at timestamp with time zone)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_group_exams()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_group_package_catalog()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_group_policy(p_enabled boolean, p_limits jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_import_curriculum_candidates(p_request_id uuid, p_bundle jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_import_library_bundle(p_request_id uuid, p_bundle jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_learning_library()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_library_publication(p_package_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_list_contribution_sets()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_list_curriculum_candidates()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_list_library_draft_packages(p_before_created_at timestamp with time zone, p_before_id uuid, p_limit integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_list_library_imports(p_limit integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_list_overrides(p_family_id uuid, p_include_inactive boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_preview_announcement(p_id uuid, p_revision integer)` | ✓ | ✓ | — | ✓ | — | — |
| `public.admin_publish_announcement(p_request uuid, p_id uuid, p_revision integer, p_fingerprint text, p_confirmed boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_publish_cohort_results(p_request uuid, p_group uuid, p_fingerprint text, p_version integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_publish_library_item(p_id uuid, p_published boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_question_facets()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_retry_ai_operation(p_id uuid, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_retry_prova_generation(p_id uuid, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_review_contribution(p_id uuid, p_approve boolean, p_collection_id uuid, p_note text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_review_education_report(p_request uuid, p_id uuid, p_revision integer, p_status text, p_note text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_review_library_question(p_request_id uuid, p_package_id uuid, p_question_key text, p_question_revision integer, p_expected_review_revision integer, p_outcome text, p_note text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_announcement(p_request uuid, p_id uuid, p_revision integer, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_cohort_review(p_request uuid, p_entry uuid, p_ord integer, p_revision integer, p_answer_hash text, p_points jsonb, p_outcome text, p_feedback text, p_appeal_revision integer, p_response text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_contribution_reward(p_id uuid, p_title text, p_threshold integer, p_kind text, p_amount integer, p_plan plan_code, p_days integer, p_enabled boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_education_calendar(p_request uuid, p_id uuid, p_revision integer, p_place_id uuid, p_stage text, p_academic_year integer, p_value jsonb, p_publish boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_education_place(p_request uuid, p_id uuid, p_revision integer, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_guided_input(p_id text, p_revision integer, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_library_collection(p_id uuid, p_title text, p_description text, p_grade integer, p_subject text, p_curriculum text, p_plans plan_code[], p_status text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_save_override(p_request_id uuid, p_command jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_search_families(p_query text, p_limit integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_set_ai_enabled(p_enabled boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_set_ai_operation_policy(p_action text, p_plan plan_code, p_enabled boolean, p_monthly integer, p_per_minute integer, p_concurrent integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_set_library_publication(p_request_id uuid, p_package_id uuid, p_expected_version integer, p_review_fingerprint text, p_title text, p_description text, p_plans plan_code[], p_curriculum_label text, p_confirmed boolean, p_status text, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_set_library_quota(p_plan plan_code, p_monthly integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_source_file_limit(p_max_files integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.admin_withdraw_announcement(p_request uuid, p_id uuid, p_revision integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.appeal_cohort_review(p_request uuid, p_group uuid, p_child uuid, p_ord integer, p_review_revision integer, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.apply_ai_grades(p_attempt_id uuid, p_grades jsonb, p_summary jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `public.apply_learning_plan_import(p_request_id uuid, p_child_id uuid, p_import_id uuid, p_items jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.apply_repeat_calendar(p_request_id uuid, p_attempt_id uuid, p_source_hash text, p_question_ids uuid[], p_items jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.apply_study_plan_calendar(p_request_id uuid, p_plan_id uuid, p_updated_at timestamp with time zone, p_items jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.apply_timetable_import(p_request_id uuid, p_import_id uuid, p_revision integer, p_lessons jsonb, p_settings jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.apply_verified_store_state(p_state jsonb, p_caller_family_id uuid, p_purchaser_user_id uuid)` | ✓ | ✓ | — | — | — | — |
| `public.assign_question_source_group(p_request_id uuid, p_group_id uuid, p_child_id uuid, p_title text, p_timed boolean, p_minutes integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.attach_question_source(p_question_id uuid, p_source_id uuid, p_alt text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.begin_question_contribution(p_id uuid, p_question_id uuid, p_rights boolean, p_no_personal_data boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.cancel_reward_request(p_request_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.cancel_unstarted_generation(p_id uuid, p_intent jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.change_child_education(p_request_id uuid, p_child_id uuid, p_revision integer, p_action text, p_academic_year integer, p_grade integer, p_school text, p_starts_on date, p_timetable_revision integer, p_keep_timetable boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.change_child_education_with_calendar(p_request_id uuid, p_child_id uuid, p_revision integer, p_action text, p_academic_year integer, p_grade integer, p_school text, p_starts_on date, p_timetable_revision integer, p_keep_timetable boolean, p_place_id uuid, p_stage text, p_calendar_id uuid, p_calendar_revision integer, p_reason text, p_detail text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.change_reward(p_request_id uuid, p_id uuid, p_revision integer, p_action text, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.change_school_grade(p_request_id uuid, p_id uuid, p_child_id uuid, p_revision integer, p_action text, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.change_task_routine(p_request_id uuid, p_id uuid, p_revision integer, p_action text, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.child_logout()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.child_pin_login(p_child_id uuid, p_pin text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.child_topic_mastery(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.claim_operator_reconcile(p_id uuid)` | ✓ | ✓ | — | — | — | — |
| `public.claim_room_weather_refresh(p_city_id text)` | ✓ | ✓ | — | — | — | — |
| `public.claim_store_notification(p_platform store_platform, p_event_key text, p_event_type text, p_payload jsonb)` | ✓ | ✓ | — | — | — | — |
| `public.complete_prova_generation(p_id uuid, p_rows jsonb, p_model text, p_prompt_version text, p_input integer, p_output integer)` | ✓ | ✓ | — | — | — | — |
| `public.complete_prova_generation_v2(p_id uuid, p_lease uuid, p_rows jsonb, p_model text, p_prompt_version text, p_input integer, p_output integer)` | ✓ | ✓ | — | — | — | — |
| `public.complete_task(p_template_id uuid, p_due_date date, p_client_id uuid, p_acting_child_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.configure_child_device(p_device_id uuid, p_name text, p_child_ids uuid[], p_pin_required boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.create_child_share(p_child_id uuid, p_label text, p_scopes text[], p_expires_in_days integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.create_family(p_name text, p_display_name text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.create_help_ticket(p_request_id uuid, p_kind text, p_category text, p_subject text, p_body text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.create_level_test(p_child_id uuid, p_subject text, p_grade smallint, p_blueprint_id uuid, p_per_topic integer, p_max_questions integer, p_title text, p_timed boolean, p_duration_minutes smallint)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.custom_access_token_hook(event jsonb)` | — | ✓ | — | — | — | — |
| `public.decide_reward_request(p_request_id uuid, p_approve boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.delete_learning_source(p_source_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.deliver_reward_request(p_request_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.education_calendar_catalog(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.education_report_periods(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.enroll_group_exam(p_group uuid, p_child uuid, p_ranking boolean, p_consent boolean)` | ✓ | ✓ | — | ✓ | — | — |
| `public.enroll_reviewed_group_exam(p_group uuid, p_child uuid, p_ranking boolean, p_consent boolean, p_review_consent boolean)` | ✓ | ✓ | — | ✓ | — | — |
| `public.expire_unlinked_learning_sources()` | ✓ | ✓ | — | — | — | — |
| `public.fail_prova_generation_v2(p_id uuid, p_lease uuid, p_code text, p_uncertain boolean)` | ✓ | ✓ | — | — | — | — |
| `public.finance_reconcile_jobs(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.finance_request_reconcile(p_id uuid, p_family_id uuid, p_subscription_id uuid, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.finance_workspace(p_query text, p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.finish_ai_operation(p_id uuid, p_lease uuid, p_result jsonb, p_error text, p_uncertain boolean)` | ✓ | ✓ | — | — | — | — |
| `public.finish_exam_attempt(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.finish_operator_reconcile(p_id uuid, p_token uuid, p_state jsonb, p_code text)` | ✓ | ✓ | — | — | — | — |
| `public.finish_question_contribution(p_actor uuid, p_family uuid, p_id uuid, p_media jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `public.finish_setup_generation(p_id uuid, p_lease uuid, p_result jsonb, p_unknown boolean)` | ✓ | ✓ | — | — | — | — |
| `public.finish_store_notification(p_platform store_platform, p_event_key text, p_token uuid, p_error text, p_store_key text)` | ✓ | ✓ | — | — | — | — |
| `public.get_answer_review(p_attempt_id uuid, p_question_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_attempt_questions(p_exam_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.get_attempt_topic_stats(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_beta_test_access()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_catalog_blueprint_context(p_family_id uuid, p_blueprint_id uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `public.get_child_answer_reviews(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.get_child_archive_preview(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_child_device_access(p_device_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_child_education(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_curriculum_scenarios(p_child_id uuid, p_year text, p_term integer, p_exam integer, p_subject text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_discarded_prova_drafts(p_child_id uuid, p_before_updated timestamp with time zone, p_before_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_family_entitlement(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_family_weekly_review(p_week date)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_group_exams()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_group_result(p_group uuid, p_child uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_guided_input_options(p_child uuid, p_kind text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_help_articles(p_locale text, p_platform text, p_editor boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_help_editor_article(p_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.get_help_ticket(p_ticket_id uuid, p_before bigint)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_library()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_plan(p_child_id uuid, p_from date, p_to date)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_plan_import(p_child_id uuid, p_source_id uuid, p_locale text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_plan_item(p_child_id uuid, p_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_source_access(p_source_id uuid, p_question_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_source_policy()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_learning_source_set(p_source uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_library_items(p_collection_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_library_package_units(p_package_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_prova_drafts(p_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_prova_entitlement(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_published_library_packages(p_grade integer, p_subject text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_question_context(p_question_ids uuid[])` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_question_group_policy()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_question_media(p_question_ids uuid[])` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_repeat_calendar(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_repeat_calendar_event(p_event_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_repeat_candidates(p_draft_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_review_ai_policy()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_saved_exam_answers(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.get_saved_exam_answers_v2(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.get_saved_exam_answers_v3(p_attempt_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.get_school_bag(p_child_id uuid, p_day date)` | ✓ | ✓ | — | ✓ | — | — |
| `public.get_setup_ai_entitlement(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_setup_sources(p_kind text, p_ids uuid[])` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_shared_child_view(p_token text)` | ✓ | ✓ | ✓ | ✓ | — | — |
| `public.get_timetable_sources(p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.get_weekly_summary_data(p_family_id uuid, p_week_start date)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.iap_reconcile_candidates(p_window interval, p_min_age interval, p_limit integer)` | ✓ | ✓ | — | — | — | — |
| `public.join_family(p_invite_code text, p_display_name text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.learning_progress(p_child_id uuid, p_days integer, p_subject text, p_grade integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.learning_progress_education(p_child_id uuid, p_days integer, p_subject text, p_grade integer, p_period text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.list_help_editor_articles(p_locale text, p_platform text, p_after_slug text, p_after_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.list_help_tickets(p_operator boolean, p_kind text, p_status text, p_offset integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.list_my_families()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.list_operator_help_tickets(p_kind text, p_status text, p_category text, p_before_time timestamp with time zone, p_before_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.list_question_contributions()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.list_school_grades(p_child_id uuid, p_period text, p_before_date date, p_before_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.mark_parent_inbox(p_id uuid, p_archived boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.my_operation_roles()` | ✓ | ✓ | — | ✓ | — | — |
| `public.note_history(p_id uuid, p_before_revision integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.pair_child_device(p_code text)` | ✓ | ✓ | — | ✓ | — | — |
| `public.pair_device(p_code text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.parent_inbox(p_before timestamp with time zone, p_before_id uuid, p_archived boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.parent_pin_set()` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.pick_level_questions(p_subject text, p_grade smallint, p_blueprint_id uuid, p_per_topic integer, p_max_questions integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.prepare_learning_plan_import(p_family uuid, p_user uuid, p_child uuid, p_source uuid, p_locale text, p_context jsonb)` | ✓ | ✓ | — | — | — | — |
| `public.prepare_library_delivery_media(p_actor uuid, p_package_id uuid, p_assets jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `public.prepare_weekly_summary(p_family uuid, p_user uuid, p_week date, p_context jsonb)` | ✓ | ✓ | — | — | — | — |
| `public.preview_education_calendar(p_child_id uuid, p_place_id uuid, p_stage text, p_academic_year integer, p_action text, p_starts_on date)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.preview_family_invite(p_invite_code text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.preview_question_contribution(p_question_id uuid)` | ✓ | ✓ | — | ✓ | — | — |
| `public.push_claim_batch(p_limit integer)` | ✓ | ✓ | — | — | — | — |
| `public.push_claim_v2(p_limit integer)` | ✓ | ✓ | — | — | — | — |
| `public.push_delivery_targets(p_outbox_id bigint, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.push_finish_delivery(p_outbox_id bigint, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.push_record_delivery(p_outbox_id bigint, p_lease uuid, p_token_id uuid, p_token_hash text, p_status text, p_error text, p_retry_after integer)` | ✓ | ✓ | — | — | — | — |
| `public.push_targets(p_outbox_id bigint)` | ✓ | ✓ | — | — | — | — |
| `public.read_library_source_bytes(p_source_id uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `public.record_source_cleanup(p_path text, p_success boolean)` | ✓ | ✓ | — | — | — | — |
| `public.redeem_library_item(p_item_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.register_learning_source_set(p_ids uuid[])` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.register_push_token(p_token text, p_platform text, p_locale text)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.register_timetable_import(p_job uuid, p_source uuid, p_child uuid)` | ✓ | ✓ | — | — | — | — |
| `public.release_push_operations(p_status text, p_before bigint, p_limit integer)` | ✓ | ✓ | — | ✓ | — | — |
| `public.release_retry_push(p_request uuid, p_outbox_id bigint, p_revision integer, p_reason text, p_confirmed boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.reply_help_ticket(p_request_id uuid, p_ticket_id uuid, p_revision integer, p_body text, p_internal boolean, p_status text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.request_pairing(p_device_name text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.request_reward(p_reward_id uuid, p_idempotency_key uuid, p_acting_child_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.reserve_ai_operation(p_family_id uuid, p_user_id uuid, p_action text, p_hash text, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_catalog_prova_generation(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text, p_items integer, p_blueprint_id uuid, p_draft_id uuid)` | ✓ | ✓ | — | — | — | ✓ |
| `public.reserve_child_ai_operation(p_family_id uuid, p_user_id uuid, p_action text, p_hash text, p_lease uuid, p_child_id uuid)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_learning_plan_import(p_family uuid, p_user uuid, p_context uuid, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_learning_source(p_id uuid, p_kind text, p_name text, p_mime text, p_bytes integer, p_sha256 text, p_consent boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.reserve_prova_generation(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text, p_items integer)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_prova_generation_v2(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text, p_items integer)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_prova_generation_v3(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text, p_items integer, p_intent jsonb, p_context jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `public.reserve_setup_ai(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_setup_generation(p_id uuid, p_family_id uuid, p_user_id uuid, p_hash text, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.reserve_weekly_summary(p_family uuid, p_user uuid, p_context uuid, p_lease uuid)` | ✓ | ✓ | — | — | — | — |
| `public.resume_prova_generation(p_id uuid, p_family_id uuid, p_user_id uuid, p_intent jsonb)` | ✓ | ✓ | — | — | — | ✓ |
| `public.review_answer_fingerprint(p_attempt_id uuid, p_question_id uuid)` | ✓ | ✓ | — | — | — | — |
| `public.review_help_article(p_request_id uuid, p_id uuid, p_revision integer, p_action text, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.review_task(p_completion_id uuid, p_approve boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.review_task_once(p_request_id uuid, p_completion_id uuid, p_approve boolean, p_expected_completed_at timestamp with time zone)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.revoke_child_share(p_share_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.revoke_device(p_device_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.reward_history(p_id uuid, p_before_revision integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_answer_review(p_request_id uuid, p_attempt_id uuid, p_question_id uuid, p_revision integer, p_answer_hash text, p_score smallint, p_feedback text, p_document jsonb, p_ai_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_calendar_event(p_request_id uuid, p_event_id uuid, p_revision integer, p_values jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_catalog_blueprint(p_request_id uuid, p_input jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_child_setup(p_request_id uuid, p_profile jsonb, p_tasks jsonb, p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_family_blueprint(p_request_id uuid, p_input jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_help_article(p_request_id uuid, p_id uuid, p_revision integer, p_slug text, p_locale text, p_platform text, p_title text, p_body text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_learning_plan(p_request_id uuid, p_child_id uuid, p_id uuid, p_revision integer, p_content jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_parent_note(p_request_id uuid, p_id uuid, p_revision integer, p_action text, p_child_id uuid, p_value jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_prova_draft(p_request_id uuid, p_id uuid, p_version integer, p_content jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_prova_provider_result(p_id uuid, p_lease uuid, p_result jsonb)` | ✓ | ✓ | — | — | — | — |
| `public.save_question_source_group(p_request_id uuid, p_group jsonb, p_questions jsonb, p_images jsonb, p_previous_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_question_with_sources(p_request_id uuid, p_question jsonb, p_images jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_school_bag(p_request_id uuid, p_child_id uuid, p_day date, p_revision integer, p_program_revision integer, p_items jsonb)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.save_school_timetable(p_child_id uuid, p_revision integer, p_lessons jsonb, p_settings jsonb)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.save_school_timetable_request(p_request_id uuid, p_child_id uuid, p_revision integer, p_lessons jsonb, p_settings jsonb)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.save_setup_batch(p_request_id uuid, p_kind text, p_items jsonb, p_child_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.school_grade_history(p_id uuid, p_before_revision integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.school_grade_records(p_child_id uuid, p_period text, p_before_date date, p_before_id uuid, p_withdrawn boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.score_open_answer(p_attempt_id uuid, p_question_id uuid, p_score smallint, p_feedback text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.select_family(p_family_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_beta_test_plan(p_plan plan_code)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_child_archived(p_request_id uuid, p_child_id uuid, p_revision integer, p_archived boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_child_goal(p_reward_id uuid, p_acting_child_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.set_child_pin(p_child_id uuid, p_pin text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_group_ranking_consent(p_group uuid, p_child uuid, p_enabled boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_operation_member(p_user_id uuid, p_role text, p_expires_at timestamp with time zone, p_revoke boolean, p_reason text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_parent_pin(p_pin text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_prova_draft_discarded(p_request_id uuid, p_id uuid, p_version integer, p_discarded boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.set_room_pet(p_pet text, p_acting_child_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.set_room_preference(p_character text, p_theme text, p_acting_child_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.set_study_plan_status(p_plan_id uuid, p_status text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.settle_group_attempts()` | ✓ | ✓ | — | — | — | — |
| `public.start_exam_attempt(p_exam_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.store_weekly_summary(p_family uuid, p_user uuid, p_context uuid, p_job uuid)` | ✓ | ✓ | — | — | — | — |
| `public.submit_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer_key text, p_answer_text text)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.submit_exam_answer_once(p_request_id uuid, p_attempt_id uuid, p_question_id uuid, p_expected_revision integer, p_answer_key text, p_answer_text text)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.submit_exam_answer_v3(p_request_id uuid, p_attempt_id uuid, p_question_id uuid, p_expected_revision integer, p_answer_key text, p_answer_text text, p_answer_document jsonb)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.submit_prova_draft(p_request_id uuid, p_id uuid, p_version integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.submit_question_contribution(p_request_id uuid, p_question_id uuid, p_rights_confirmed boolean, p_no_personal_data boolean)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.task_routine_history(p_id uuid, p_before_revision integer)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.undo_complete(p_completion_id uuid)` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `public.unregister_push_token(p_token text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.verify_child_pin(p_child_id uuid, p_pin text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.verify_parent_pin(p_pin text)` | ✓ | ✓ | — | ✓ | — | ✓ |
| `public.withdraw_question_contribution(p_id uuid)` | ✓ | ✓ | — | ✓ | — | ✓ |

Tetikleyici fonksiyonları: 67 (doğrudan çağrılamaz; 59 tanesi security definer, hepsinde search_path sabit: ✓).

## Storage

```json
{
 "buckets": [
  {
   "id": "gina-private-sources",
   "public": false,
   "file_size_limit": 10485760,
   "allowed_mime_types": [
    "image/png",
    "image/jpeg",
    "application/pdf"
   ]
  }
 ],
 "object_policies": [],
 "objects_rls": true,
 "grants": [
  {
   "role": "anon",
   "delete": true,
   "insert": true,
   "select": true,
   "update": true
  },
  {
   "role": "authenticated",
   "delete": true,
   "insert": true,
   "select": true,
   "update": true
  }
 ],
 "signed_url_seconds": {
  "supabase/functions/learning-source/index.ts": 120
 }
}
```

## Sentetik aile ile çalıştırmalı kontroller

| Kontrol | Sonuç | Ayrıntı |
|---|---|---|
| `anon_cannot_read_any_public_table` | geçti | `[]` |
| `authenticated_cannot_read_gina_schema_tables` | geçti | `[]` |
| `cross_family_children_hidden` | geçti | `{"other_family": "0", "own_family": "1"}` |
| `revoked_device_loses_row_access_with_stale_claims` | geçti | `{"before": "1", "after": "0"}` |
| `revoked_device_zero_arg_rpcs_denied` | geçti | `{}` |
| `anon_executable_functions_listed` | geçti | `["gina.child_id()", "gina.claims()", "gina.family_id()", "gina.role()", "gina.valid_review_document(d jsonb)", "public.get_shared_child_view(p_token text)"]` |
| `authenticated_write_grants_without_matching_policy` | BULGU | `["public.admins:insert", "public.admins:update", "public.admins:delete", "public.ai_summaries:insert", "public.ai_summaries:update", "public.ai_summaries:delete", "public.child_badge_awards:insert", "public.child_badge_awards:update", "public.child_badge_awards:delete", "public.child_goals:insert", "public.child_goals:update", "public.child_goals:delete", "public.child_inventory:insert", "public.c…` |
| `security_definer_without_search_path` | geçti | `[]` |
| `security_definer_authenticated_without_caller_check_heuristic` | geçti | `["gina.child_star_balance(p_child_id uuid)", "gina.device_allows(p_device_id uuid, p_child_id uuid)", "gina.family_month_start(p_family_id uuid)", "gina.family_plan()", "gina.family_plan_of(p_family_id uuid)", "public.admin_announcements(p_before timestamp with time zone, p_before_id uuid)", "public.admin_create_package_group_exam(p_id uuid, p_package_id uuid, p_publication_version integer, p_titl…` |
| `tables_without_rls` | BULGU | `["gina.child_archive_device_blocks", "gina.child_archive_state", "gina.child_education_changes", "gina.child_education_periods", "gina.child_education_state", "gina.note_changes", "gina.override_commands", "gina.reward_changes", "gina.school_grade_changes", "gina.store_reconcile_jobs", "gina.store_replacements", "gina.task_routine_changes"]` |
