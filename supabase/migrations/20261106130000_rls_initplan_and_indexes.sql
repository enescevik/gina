-- Q02 düzeltmeleri (docs/release/q02-fixes-2026-11-06/README.md).
--
-- Q02-1 (Yüksek, performans): RLS politikaları `gina.is_parent()`, `gina.is_device()`,
-- `gina.family_id()`, `gina.child_id()`, `gina.is_admin()`, `gina.is_admin_strict()`,
-- `gina.claims()` ve `auth.uid()` çağrılarını satır başına değerlendiriyordu; `is_device()`
-- her satırda devices/device_allows alt sorgularını çalıştırıyordu. Aşağıda etkilenen 101
-- politika (110'dan; kalan 9'u `using (true)`) AYNI AD, AYNI ROL, AYNI KOMUT, AYNI
-- permissive/restrictive türü ve AYNI using/with check mantığıyla yeniden tanımlanır; tek fark
-- her yardımcı çağrının `(select f())` skaler alt sorguya alınmasıdır. Planlayıcı bu ifadeyi
-- InitPlan olarak istek başına BİR kez değerlendirir; yardımcılar zaten `stable` olduğu için
-- sonuç satırdan bağımsızdır ve politika anlamı değişmez. Metin, uygulanmış şemanın
-- pg_policies çıktısından (pg_get_expr) üretildi ve normalize edilerek eskisiyle birebir
-- karşılaştırıldı (pgTAP 100 + rapor).
--
-- Q02-2 (Orta): eksik indexler (star_events(family_id), task_templates(family_id),
-- task_templates(child_id, sort_order), exams(family_id, created_at desc)). Kısmi
-- `task_templates_child_idx (child_id) where active` yerine tam `(child_id, sort_order)`
-- geçer; aynı amaçlı çift index tutulmaz. Normal `create index` kullanılır: migration tek
-- transaction içinde koşar, `concurrently` orada çalışmaz; üretim tabloları küçüktür (kısa
-- kilit). Büyük tablolar için yayın notu: indexleri `concurrently` ile ayrı adımda oluştur.
--
-- Q02-5 (Düşük): `revoke_device` yabancı ya da olmayan cihazda sessiz `null` yerine açık
-- `device_not_found` hatası verir (configure_child_device ile aynı sözleşme). Zaten iptal
-- edilmiş kendi cihazı idempotent kalır (çift dokunma güvenli).

-- admins
drop policy admins_select_self on public.admins;
create policy admins_select_self on public.admins
  for select to authenticated
  using ((user_id = (select auth.uid())));

-- ai_feature_requirements
drop policy ai_feature_requirements_admin on public.ai_feature_requirements;
create policy ai_feature_requirements_admin on public.ai_feature_requirements
  for select to authenticated
  using ((select gina.is_admin_strict()));

-- ai_models
drop policy ai_models_admin_all on public.ai_models;
create policy ai_models_admin_all on public.ai_models
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- ai_operation_policies
drop policy ai_policy_admin on public.ai_operation_policies;
create policy ai_policy_admin on public.ai_operation_policies
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- ai_providers
drop policy ai_providers_admin on public.ai_providers;
create policy ai_providers_admin on public.ai_providers
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- ai_settings
drop policy ai_settings_admin_all on public.ai_settings;
create policy ai_settings_admin_all on public.ai_settings
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- ai_summaries
drop policy ai_summaries_parent_select on public.ai_summaries;
create policy ai_summaries_parent_select on public.ai_summaries
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- answer_review_suggestions
drop policy review_suggestion_parent on public.answer_review_suggestions;
create policy review_suggestion_parent on public.answer_review_suggestions
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- app_settings
drop policy app_settings_admin_strict on public.app_settings;
create policy app_settings_admin_strict on public.app_settings
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));

-- audit_log
drop policy audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using ((select gina.is_admin_strict()));

-- badge_definitions
drop policy badge_definitions_parent_write on public.badge_definitions;
create policy badge_definitions_parent_write on public.badge_definitions
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy badge_definitions_select on public.badge_definitions;
create policy badge_definitions_select on public.badge_definitions
  for select to authenticated
  using (((family_id IS NULL) OR (family_id = (select gina.family_id()))));

-- child_badge_awards
drop policy child_badge_awards_device_select on public.child_badge_awards;
create policy child_badge_awards_device_select on public.child_badge_awards
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy child_badge_awards_parent_select on public.child_badge_awards;
create policy child_badge_awards_parent_select on public.child_badge_awards
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- child_goals
drop policy child_goals_device_select on public.child_goals;
create policy child_goals_device_select on public.child_goals
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy child_goals_parent_select on public.child_goals;
create policy child_goals_parent_select on public.child_goals
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- child_inventory
drop policy child_inventory_device_select on public.child_inventory;
create policy child_inventory_device_select on public.child_inventory
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy child_inventory_parent_select on public.child_inventory;
create policy child_inventory_parent_select on public.child_inventory
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- child_room_preferences
drop policy child_room_preferences_device_select on public.child_room_preferences;
create policy child_room_preferences_device_select on public.child_room_preferences
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device())));
drop policy child_room_preferences_parent_all on public.child_room_preferences;
create policy child_room_preferences_parent_all on public.child_room_preferences
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- child_shares
drop policy child_shares_parent_delete on public.child_shares;
create policy child_shares_parent_delete on public.child_shares
  for delete to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy child_shares_parent_select on public.child_shares;
create policy child_shares_parent_select on public.child_shares
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- children
drop policy children_device_select on public.children;
create policy children_device_select on public.children
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND gina.device_allows((((select gina.claims()) ->> 'device_id'::text))::uuid, id)));
drop policy children_parent_all on public.children;
create policy children_parent_all on public.children
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- contribution_rewards
drop policy rewards_admin on public.contribution_rewards;
create policy rewards_admin on public.contribution_rewards
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- devices
drop policy devices_parent_select on public.devices;
create policy devices_parent_select on public.devices
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy devices_parent_update on public.devices;
create policy devices_parent_update on public.devices
  for update to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy devices_self_select on public.devices;
create policy devices_self_select on public.devices
  for select to authenticated
  using ((auth_user_id = (select auth.uid())));

-- entitlement_overrides
drop policy entitlement_overrides_admin_all on public.entitlement_overrides;
create policy entitlement_overrides_admin_all on public.entitlement_overrides
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));
drop policy entitlement_overrides_admin_strict on public.entitlement_overrides;
create policy entitlement_overrides_admin_strict on public.entitlement_overrides
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy entitlement_overrides_parent_select on public.entitlement_overrides;
create policy entitlement_overrides_parent_select on public.entitlement_overrides
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- event_exceptions
drop policy event_exceptions_device_select on public.event_exceptions;
create policy event_exceptions_device_select on public.event_exceptions
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_exceptions.event_id) AND (e.family_id = (select gina.family_id())) AND (select gina.is_device())))));
drop policy event_exceptions_parent_all on public.event_exceptions;
create policy event_exceptions_parent_all on public.event_exceptions
  for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_exceptions.event_id) AND (e.family_id = (select gina.family_id())) AND (select gina.is_parent())))))
  with check ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_exceptions.event_id) AND (e.family_id = (select gina.family_id())) AND (select gina.is_parent())))));

-- events
drop policy events_device_select on public.events;
create policy events_device_select on public.events
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND visible_to_child AND (archived_at IS NULL) AND ((child_id IS NULL) OR (child_id = (select gina.child_id())))));
drop policy events_parent_all on public.events;
create policy events_parent_all on public.events
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND ((child_id IS NULL) OR (EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.id = events.child_id) AND (c.family_id = (select gina.family_id()))))))));

-- exam_answers
drop policy exam_answers_parent_select on public.exam_answers;
create policy exam_answers_parent_select on public.exam_answers
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM exam_attempts a
  WHERE ((a.id = exam_answers.attempt_id) AND (a.family_id = (select gina.family_id())) AND (select gina.is_parent())))));

-- exam_attempts
drop policy exam_attempts_device_select on public.exam_attempts;
create policy exam_attempts_device_select on public.exam_attempts
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy exam_attempts_parent_select on public.exam_attempts;
create policy exam_attempts_parent_select on public.exam_attempts
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- exam_blueprints
drop policy exam_blueprints_parent_all on public.exam_blueprints;
create policy exam_blueprints_parent_all on public.exam_blueprints
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- exams
drop policy exams_device_select on public.exams;
create policy exams_device_select on public.exams
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id())) AND (status = ANY (ARRAY['assigned'::exam_status, 'completed'::exam_status]))));
drop policy exams_parent_all on public.exams;
create policy exams_parent_all on public.exams
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- families
drop policy families_select on public.families;
create policy families_select on public.families
  for select to authenticated
  using (((id = (select gina.family_id())) AND ((select gina.is_parent()) OR (select gina.is_device()))));
drop policy families_update_parent on public.families;
create policy families_update_parent on public.families
  for update to authenticated
  using (((id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((id = (select gina.family_id())) AND (select gina.is_parent())));

-- family_members
drop policy family_members_delete_self on public.family_members;
create policy family_members_delete_self on public.family_members
  for delete to authenticated
  using ((user_id = (select auth.uid())));
drop policy family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- family_rewards
drop policy family_rewards_device_select on public.family_rewards;
create policy family_rewards_device_select on public.family_rewards
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (active OR (EXISTS ( SELECT 1
   FROM child_goals g
  WHERE ((g.reward_id = family_rewards.id) AND (g.child_id = (select gina.child_id())) AND (g.status = 'active'::child_goal_status)))))));
drop policy family_rewards_parent_all on public.family_rewards;
create policy family_rewards_parent_all on public.family_rewards
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- family_room_settings
drop policy family_room_settings_parent on public.family_room_settings;
create policy family_room_settings_parent on public.family_room_settings
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy family_room_settings_read on public.family_room_settings;
create policy family_room_settings_read on public.family_room_settings
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND ((select gina.is_parent()) OR ((select gina.is_device()) AND ((select gina.child_id()) IS NOT NULL)))));

-- grades
drop policy grades_parent_context on public.grades;
create policy grades_parent_context on public.grades
  for update to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND (withdrawn_at IS NULL)))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND (withdrawn_at IS NULL)));
drop policy grades_parent_insert on public.grades;
create policy grades_parent_insert on public.grades
  for insert to authenticated
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND (withdrawn_at IS NULL) AND (revision = 1)));
drop policy grades_parent_read on public.grades;
create policy grades_parent_read on public.grades
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND (withdrawn_at IS NULL)));

-- guided_input_options
drop policy guided_options_admin_read on public.guided_input_options;
create policy guided_options_admin_read on public.guided_input_options
  for select to authenticated
  using ((select gina.is_admin_strict()));

-- holidays
drop policy holidays_admin_strict on public.holidays;
create policy holidays_admin_strict on public.holidays
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy holidays_admin_write on public.holidays;
create policy holidays_admin_write on public.holidays
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));

-- learning_credit_grants
drop policy credit_read on public.learning_credit_grants;
create policy credit_read on public.learning_credit_grants
  for select to authenticated
  using (((select gina.is_admin_strict()) OR ((select gina.is_parent()) AND (family_id = (select gina.family_id())))));

-- learning_source_sets
drop policy source_sets_parent_read on public.learning_source_sets;
create policy source_sets_parent_read on public.learning_source_sets
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- learning_sources
drop policy source_parent_read on public.learning_sources;
create policy source_parent_read on public.learning_sources
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- library_collections
drop policy catalog_admin on public.library_collections;
create policy catalog_admin on public.library_collections
  for all to authenticated
  using ((select gina.is_admin_strict()))
  with check ((select gina.is_admin_strict()));

-- note_sync
drop policy note_sync_read on public.note_sync;
create policy note_sync_read on public.note_sync
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id())) AND (user_id = (select auth.uid()))));

-- notes
drop policy notes_device_insert on public.notes;
create policy notes_device_insert on public.notes
  for insert to authenticated
  with check (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id())) AND (author_child_id = (select gina.child_id())) AND (author_user_id IS NULL) AND (visibility = ANY (ARRAY['child'::note_visibility, 'family'::note_visibility]))));
drop policy notes_device_select on public.notes;
create policy notes_device_select on public.notes
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id())) AND (archived_at IS NULL) AND ((visibility = 'child'::note_visibility) OR (author_child_id = (select gina.child_id())))));
drop policy notes_device_update_own on public.notes;
create policy notes_device_update_own on public.notes
  for update to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (author_child_id = (select gina.child_id())) AND (archived_at IS NULL)))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id())) AND (author_child_id = (select gina.child_id())) AND (author_user_id IS NULL) AND (archived_at IS NULL) AND (visibility = ANY (ARRAY['child'::note_visibility, 'family'::note_visibility]))));
drop policy notes_parent_insert on public.notes;
create policy notes_parent_insert on public.notes
  for insert to authenticated
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND (author_user_id = (select auth.uid())) AND (author_child_id IS NULL)));
drop policy notes_parent_select on public.notes;
create policy notes_parent_select on public.notes
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent()) AND ((author_user_id = (select auth.uid())) OR ((visibility <> 'private'::note_visibility) AND (archived_at IS NULL)))));

-- plan_products
drop policy plan_products_admin_strict on public.plan_products;
create policy plan_products_admin_strict on public.plan_products
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy plan_products_admin_write on public.plan_products;
create policy plan_products_admin_write on public.plan_products
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));

-- plans
drop policy plans_admin_strict on public.plans;
create policy plans_admin_strict on public.plans
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy plans_admin_write on public.plans;
create policy plans_admin_write on public.plans
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));

-- prova_ai_usage
drop policy prova_ai_usage_admin_select on public.prova_ai_usage;
create policy prova_ai_usage_admin_select on public.prova_ai_usage
  for select to authenticated
  using ((select gina.is_admin()));
drop policy prova_ai_usage_parent_select on public.prova_ai_usage;
create policy prova_ai_usage_parent_select on public.prova_ai_usage
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- prova_drafts
drop policy prova_draft_parent_read on public.prova_drafts;
create policy prova_draft_parent_read on public.prova_drafts
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- push_preferences
drop policy push_preferences_own on public.push_preferences;
create policy push_preferences_own on public.push_preferences
  for all to authenticated
  using (((user_id = (select auth.uid())) AND (select gina.is_parent()) AND (family_id = (select gina.family_id()))))
  with check (((user_id = (select auth.uid())) AND (select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- push_tokens
drop policy push_tokens_own_delete on public.push_tokens;
create policy push_tokens_own_delete on public.push_tokens
  for delete to authenticated
  using ((user_id = (select auth.uid())));
drop policy push_tokens_own_select on public.push_tokens;
create policy push_tokens_own_select on public.push_tokens
  for select to authenticated
  using ((user_id = (select auth.uid())));

-- question_bank
drop policy question_bank_admin_all on public.question_bank;
create policy question_bank_admin_all on public.question_bank
  for all to authenticated
  using ((select gina.is_admin()))
  with check ((select gina.is_admin()));
drop policy question_bank_admin_strict on public.question_bank;
create policy question_bank_admin_strict on public.question_bank
  as restrictive
  for all to authenticated
  using (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())))
  with check (((NOT (select gina.is_admin())) OR (select gina.is_admin_strict())));
drop policy question_bank_global_select on public.question_bank;
create policy question_bank_global_select on public.question_bank
  for select to authenticated
  using (((family_id IS NULL) AND ((select gina.is_parent()) OR (select gina.is_admin()))));
drop policy question_bank_parent_all on public.question_bank;
create policy question_bank_parent_all on public.question_bank
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- question_contributions
drop policy contribution_read on public.question_contributions;
create policy contribution_read on public.question_contributions
  for select to authenticated
  using (((select gina.is_admin_strict()) OR ((select gina.is_parent()) AND (family_id = (select gina.family_id())))));

-- question_source_groups
drop policy question_group_parent_read on public.question_source_groups;
create policy question_group_parent_read on public.question_source_groups
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- question_source_members
drop policy question_member_parent_read on public.question_source_members;
create policy question_member_parent_read on public.question_source_members
  for select to authenticated
  using (((select gina.is_parent()) AND (EXISTS ( SELECT 1
   FROM question_source_groups g
  WHERE ((g.id = question_source_members.group_id) AND (g.family_id = (select gina.family_id())))))));

-- reward_catalog_sync
drop policy reward_catalog_sync_read on public.reward_catalog_sync;
create policy reward_catalog_sync_read on public.reward_catalog_sync
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND ((select gina.is_parent()) OR (select gina.is_device()))));

-- reward_requests
drop policy reward_requests_device_select on public.reward_requests;
create policy reward_requests_device_select on public.reward_requests
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy reward_requests_parent_select on public.reward_requests;
create policy reward_requests_parent_select on public.reward_requests
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- school_grade_sync
drop policy school_grade_sync_parent on public.school_grade_sync;
create policy school_grade_sync_parent on public.school_grade_sync
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- school_timetables
drop policy school_timetables_read on public.school_timetables;
create policy school_timetables_read on public.school_timetables
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND ((select gina.is_parent()) OR ((select gina.is_device()) AND (child_id = (select gina.child_id()))))));

-- star_events
drop policy star_events_device_select on public.star_events;
create policy star_events_device_select on public.star_events
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy star_events_parent_select on public.star_events;
create policy star_events_parent_select on public.star_events
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- store_notifications
drop policy store_notifications_admin_select on public.store_notifications;
create policy store_notifications_admin_select on public.store_notifications
  for select to authenticated
  using ((select gina.is_admin()));

-- store_subscriptions
drop policy store_subscriptions_parent_select on public.store_subscriptions;
create policy store_subscriptions_parent_select on public.store_subscriptions
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- study_plan_calendar_items
drop policy plan_calendar_parent_read on public.study_plan_calendar_items;
create policy plan_calendar_parent_read on public.study_plan_calendar_items
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- study_plans
drop policy study_plans_parent_delete on public.study_plans;
create policy study_plans_parent_delete on public.study_plans
  for delete to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));
drop policy study_plans_parent_select on public.study_plans;
create policy study_plans_parent_select on public.study_plans
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- task_completions
drop policy task_completions_device_select on public.task_completions;
create policy task_completions_device_select on public.task_completions
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id()))));
drop policy task_completions_parent_select on public.task_completions;
create policy task_completions_parent_select on public.task_completions
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- task_routine_sync
drop policy task_routine_sync_read on public.task_routine_sync;
create policy task_routine_sync_read on public.task_routine_sync
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND ((select gina.is_parent()) OR ((select gina.is_device()) AND (child_id = (select gina.child_id()))))));

-- task_templates
drop policy task_templates_device_select on public.task_templates;
create policy task_templates_device_select on public.task_templates
  for select to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_device()) AND (child_id = (select gina.child_id())) AND (active OR (EXISTS ( SELECT 1
   FROM task_completions c
  WHERE ((c.template_id = task_templates.id) AND (c.child_id = (select gina.child_id()))))))));
drop policy task_templates_parent_all on public.task_templates;
create policy task_templates_parent_all on public.task_templates
  for all to authenticated
  using (((family_id = (select gina.family_id())) AND (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) AND (select gina.is_parent())));

-- timetable_imports
drop policy timetable_import_parent on public.timetable_imports;
create policy timetable_import_parent on public.timetable_imports
  for select to authenticated
  using (((select gina.is_parent()) AND (family_id = (select gina.family_id()))));

-- Q02-2: eksik indexler -----------------------------------------------------------------

-- Veli ana ekranı: star_events where family_id = ? (yalnız (child_id, created_at) vardı)
create index if not exists star_events_family_idx on public.star_events (family_id);
-- Veli ana ekranı: task_templates where family_id = ?
create index if not exists task_templates_family_idx on public.task_templates (family_id);
-- Görev ekranı (veli, duraklatılmışlar dahil) ve çocuk bugün ekranı: child_id = ? order by sort_order.
-- Kısmi `where active` index yalnız aktifleri kapsıyordu; tam index her iki ekranı kapsar.
create index if not exists task_templates_child_sort_idx on public.task_templates (child_id, sort_order);
drop index if exists public.task_templates_child_idx;
-- Prova listesi: exams (RLS family_id) order by created_at desc limit 100
create index if not exists exams_family_created_idx on public.exams (family_id, created_at desc);

-- Q02-5: revoke_device açık sözleşme -----------------------------------------------------

create or replace function public.revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.devices
    set revoked_at = now(), active_child_id = null
  where id = p_device_id and family_id = gina.family_id();
  if not found then
    -- yabancı aileye ait ya da hiç olmayan cihaz: etkisiz ama artık sessiz değil
    raise exception 'device_not_found';
  end if;
end;
$$;
