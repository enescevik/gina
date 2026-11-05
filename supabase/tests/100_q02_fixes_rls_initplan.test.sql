-- Q02 düzeltmeleri (20261106130000_rls_initplan_and_indexes): RLS yardımcı çağrıları InitPlan biçimine
-- alınırken politika envanteri ve yetki matrisi değişmedi; eksik indexler var; revoke_device yabancı/olmayan
-- cihazda açık hata verir. Kurallar: claim tek başına yetki vermez; üyelik, cihaz ataması ve aile sınırı
-- sunucuda yeniden denetlenir.
begin;
select no_plan();

-- 1. Politika envanteri: yeniden tanımlanan 101 politika aynı tablo/ad/komut/tür ile duruyor; hepsi `authenticated`.
select set_eq($$select tablename::text,policyname::text,cmd::text,permissive::text from pg_policies where schemaname='public'
 and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ '(gina\.(is_parent|is_device|family_id|child_id|is_admin|is_admin_strict|is_service|role|claims)\(\)|auth\.uid\(\))'$$,
 $$values
 ('admins','admins_select_self','SELECT','PERMISSIVE'),
 ('ai_feature_requirements','ai_feature_requirements_admin','SELECT','PERMISSIVE'),
 ('ai_models','ai_models_admin_all','ALL','PERMISSIVE'),
 ('ai_operation_policies','ai_policy_admin','ALL','PERMISSIVE'),
 ('ai_providers','ai_providers_admin','ALL','PERMISSIVE'),
 ('ai_settings','ai_settings_admin_all','ALL','PERMISSIVE'),
 ('ai_summaries','ai_summaries_parent_select','SELECT','PERMISSIVE'),
 ('answer_review_suggestions','review_suggestion_parent','SELECT','PERMISSIVE'),
 ('app_settings','app_settings_admin_strict','ALL','RESTRICTIVE'),
 ('app_settings','app_settings_admin_write','ALL','PERMISSIVE'),
 ('audit_log','audit_log_admin_select','SELECT','PERMISSIVE'),
 ('badge_definitions','badge_definitions_parent_write','ALL','PERMISSIVE'),
 ('badge_definitions','badge_definitions_select','SELECT','PERMISSIVE'),
 ('child_badge_awards','child_badge_awards_device_select','SELECT','PERMISSIVE'),
 ('child_badge_awards','child_badge_awards_parent_select','SELECT','PERMISSIVE'),
 ('child_goals','child_goals_device_select','SELECT','PERMISSIVE'),
 ('child_goals','child_goals_parent_select','SELECT','PERMISSIVE'),
 ('child_inventory','child_inventory_device_select','SELECT','PERMISSIVE'),
 ('child_inventory','child_inventory_parent_select','SELECT','PERMISSIVE'),
 ('child_room_preferences','child_room_preferences_device_select','SELECT','PERMISSIVE'),
 ('child_room_preferences','child_room_preferences_parent_all','ALL','PERMISSIVE'),
 ('child_shares','child_shares_parent_delete','DELETE','PERMISSIVE'),
 ('child_shares','child_shares_parent_select','SELECT','PERMISSIVE'),
 ('children','children_device_select','SELECT','PERMISSIVE'),
 ('children','children_parent_all','ALL','PERMISSIVE'),
 ('contribution_rewards','rewards_admin','ALL','PERMISSIVE'),
 ('devices','devices_parent_select','SELECT','PERMISSIVE'),
 ('devices','devices_parent_update','UPDATE','PERMISSIVE'),
 ('devices','devices_self_select','SELECT','PERMISSIVE'),
 ('entitlement_overrides','entitlement_overrides_admin_all','ALL','PERMISSIVE'),
 ('entitlement_overrides','entitlement_overrides_admin_strict','ALL','RESTRICTIVE'),
 ('entitlement_overrides','entitlement_overrides_parent_select','SELECT','PERMISSIVE'),
 ('event_exceptions','event_exceptions_device_select','SELECT','PERMISSIVE'),
 ('event_exceptions','event_exceptions_parent_all','ALL','PERMISSIVE'),
 ('events','events_device_select','SELECT','PERMISSIVE'),
 ('events','events_parent_all','ALL','PERMISSIVE'),
 ('exam_answers','exam_answers_parent_select','SELECT','PERMISSIVE'),
 ('exam_attempts','exam_attempts_device_select','SELECT','PERMISSIVE'),
 ('exam_attempts','exam_attempts_parent_select','SELECT','PERMISSIVE'),
 ('exam_blueprints','exam_blueprints_parent_all','ALL','PERMISSIVE'),
 ('exams','exams_device_select','SELECT','PERMISSIVE'),
 ('exams','exams_parent_all','ALL','PERMISSIVE'),
 ('families','families_select','SELECT','PERMISSIVE'),
 ('families','families_update_parent','UPDATE','PERMISSIVE'),
 ('family_members','family_members_delete_self','DELETE','PERMISSIVE'),
 ('family_members','family_members_select','SELECT','PERMISSIVE'),
 ('family_rewards','family_rewards_device_select','SELECT','PERMISSIVE'),
 ('family_rewards','family_rewards_parent_all','ALL','PERMISSIVE'),
 ('family_room_settings','family_room_settings_parent','ALL','PERMISSIVE'),
 ('family_room_settings','family_room_settings_read','SELECT','PERMISSIVE'),
 ('grades','grades_parent_context','UPDATE','PERMISSIVE'),
 ('grades','grades_parent_insert','INSERT','PERMISSIVE'),
 ('grades','grades_parent_read','SELECT','PERMISSIVE'),
 ('guided_input_options','guided_options_admin_read','SELECT','PERMISSIVE'),
 ('holidays','holidays_admin_strict','ALL','RESTRICTIVE'),
 ('holidays','holidays_admin_write','ALL','PERMISSIVE'),
 ('learning_credit_grants','credit_read','SELECT','PERMISSIVE'),
 ('learning_source_sets','source_sets_parent_read','SELECT','PERMISSIVE'),
 ('learning_sources','source_parent_read','SELECT','PERMISSIVE'),
 ('library_collections','catalog_admin','ALL','PERMISSIVE'),
 ('note_sync','note_sync_read','SELECT','PERMISSIVE'),
 ('notes','notes_device_insert','INSERT','PERMISSIVE'),
 ('notes','notes_device_select','SELECT','PERMISSIVE'),
 ('notes','notes_device_update_own','UPDATE','PERMISSIVE'),
 ('notes','notes_parent_insert','INSERT','PERMISSIVE'),
 ('notes','notes_parent_select','SELECT','PERMISSIVE'),
 ('plan_products','plan_products_admin_strict','ALL','RESTRICTIVE'),
 ('plan_products','plan_products_admin_write','ALL','PERMISSIVE'),
 ('plans','plans_admin_strict','ALL','RESTRICTIVE'),
 ('plans','plans_admin_write','ALL','PERMISSIVE'),
 ('prova_ai_usage','prova_ai_usage_admin_select','SELECT','PERMISSIVE'),
 ('prova_ai_usage','prova_ai_usage_parent_select','SELECT','PERMISSIVE'),
 ('prova_drafts','prova_draft_parent_read','SELECT','PERMISSIVE'),
 ('push_preferences','push_preferences_own','ALL','PERMISSIVE'),
 ('push_tokens','push_tokens_own_delete','DELETE','PERMISSIVE'),
 ('push_tokens','push_tokens_own_select','SELECT','PERMISSIVE'),
 ('question_bank','question_bank_admin_all','ALL','PERMISSIVE'),
 ('question_bank','question_bank_admin_strict','ALL','RESTRICTIVE'),
 ('question_bank','question_bank_global_select','SELECT','PERMISSIVE'),
 ('question_bank','question_bank_parent_all','ALL','PERMISSIVE'),
 ('question_contributions','contribution_read','SELECT','PERMISSIVE'),
 ('question_source_groups','question_group_parent_read','SELECT','PERMISSIVE'),
 ('question_source_members','question_member_parent_read','SELECT','PERMISSIVE'),
 ('reward_catalog_sync','reward_catalog_sync_read','SELECT','PERMISSIVE'),
 ('reward_requests','reward_requests_device_select','SELECT','PERMISSIVE'),
 ('reward_requests','reward_requests_parent_select','SELECT','PERMISSIVE'),
 ('school_grade_sync','school_grade_sync_parent','SELECT','PERMISSIVE'),
 ('school_timetables','school_timetables_read','SELECT','PERMISSIVE'),
 ('star_events','star_events_device_select','SELECT','PERMISSIVE'),
 ('star_events','star_events_parent_select','SELECT','PERMISSIVE'),
 ('store_notifications','store_notifications_admin_select','SELECT','PERMISSIVE'),
 ('store_subscriptions','store_subscriptions_parent_select','SELECT','PERMISSIVE'),
 ('study_plan_calendar_items','plan_calendar_parent_read','SELECT','PERMISSIVE'),
 ('study_plans','study_plans_parent_delete','DELETE','PERMISSIVE'),
 ('study_plans','study_plans_parent_select','SELECT','PERMISSIVE'),
 ('task_completions','task_completions_device_select','SELECT','PERMISSIVE'),
 ('task_completions','task_completions_parent_select','SELECT','PERMISSIVE'),
 ('task_routine_sync','task_routine_sync_read','SELECT','PERMISSIVE'),
 ('task_templates','task_templates_device_select','SELECT','PERMISSIVE'),
 ('task_templates','task_templates_parent_all','ALL','PERMISSIVE'),
 ('timetable_imports','timetable_import_parent','SELECT','PERMISSIVE')$$,'rewritten policy inventory unchanged (table, name, command, permissive/restrictive)');
select is((select count(*)::int from pg_policies where schemaname='public' and roles<>'{authenticated}'
 and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ '(gina\.(is_parent|is_device|family_id|child_id|is_admin|is_admin_strict|is_service|role|claims)\(\)|auth\.uid\(\))'),0,'helper-based policies still target authenticated only');
select is((select count(*)::int from pg_policies where schemaname='public'),110,'public policy count unchanged (110)');

-- 2. Satır başına değerlendirme kalmadı: her yardımcı çağrı `( SELECT f() AS ...)` skaler alt sorgu (InitPlan) içinde.
create function pg_temp.bare_calls() returns int language sql as $$
 select coalesce(sum((select count(*) from regexp_matches(coalesce(qual,'')||' '||coalesce(with_check,''),'(?<!SELECT )(gina\.(is_parent|is_device|family_id|child_id|is_admin|is_admin_strict|is_service|role|claims)\(\)|auth\.uid\(\))','g'))),0)::int
 from pg_policies where schemaname='public'$$;
create function pg_temp.wrapped_calls() returns int language sql as $$
 select coalesce(sum((select count(*) from regexp_matches(coalesce(qual,'')||' '||coalesce(with_check,''),'\( SELECT (gina\.(is_parent|is_device|family_id|child_id|is_admin|is_admin_strict|is_service|role|claims)\(\)|auth\.uid\(\)) AS \w+\)','g'))),0)::int
 from pg_policies where schemaname='public'$$;
select is(pg_temp.bare_calls(),0,'no per-row helper call remains in any public policy');
select ok(pg_temp.wrapped_calls()>=271,'every helper call is an InitPlan scalar subquery (271 at migration time)');

-- 3. Yardımcılar `stable` (InitPlan'ın anlamı korumasının ön koşulu).
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='gina' and p.pronargs=0
 and p.proname in ('claims','family_id','role','child_id','is_admin','is_admin_strict','is_parent','is_device','is_service') and p.provolatile<>'s'),0,'all claim helpers are STABLE');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='gina' and p.pronargs=0
 and p.proname in ('is_parent','is_device','is_admin','is_admin_strict') and not p.prosecdef),0,'membership/device/admin helpers stay SECURITY DEFINER');

-- 4. Indexler.
select has_index('public','star_events','star_events_family_idx',array['family_id'],'star_events(family_id) exists');
select has_index('public','task_templates','task_templates_family_idx',array['family_id'],'task_templates(family_id) exists');
select has_index('public','task_templates','task_templates_child_sort_idx',array['child_id','sort_order'],'task_templates(child_id,sort_order) exists');
select has_index('public','exams','exams_family_created_idx','exams(family_id,created_at desc) exists');
select is((select indexdef from pg_indexes where schemaname='public' and indexname='exams_family_created_idx'),
 'CREATE INDEX exams_family_created_idx ON public.exams USING btree (family_id, created_at DESC)','exams index definition');
select hasnt_index('public','task_templates','task_templates_child_idx','partial active-only child index replaced by the full one');
select is((select count(*)::int from pg_indexes where schemaname='public' and tablename='task_templates' and indexdef like '%(child_id)%'),0,'no duplicate child_id-only index on task_templates');

-- 5. Yetki matrisi: eskiyle aynı sonuçlar (veli / cihaz / yabancı aile / sahte claim).
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000010001','q02fix-parent-a@example.invalid',false),
 ('00000000-0000-4000-8000-000000010002','q02fix-parent-b@example.invalid',false),
 ('00000000-0000-4000-8000-000000010005',null,true),
 ('00000000-0000-4000-8000-000000010006',null,true);
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000010001','Q02fix A','00000000-0000-4000-8000-000000010001'),
 ('10000000-0000-4000-8000-000000010002','Q02fix B','00000000-0000-4000-8000-000000010002');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010001','00000000-0000-4000-8000-000000010001'),
 ('10000000-0000-4000-8000-000000010002','00000000-0000-4000-8000-000000010002');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000010001','10000000-0000-4000-8000-000000010001','A one',5),
 ('20000000-0000-4000-8000-000000010002','10000000-0000-4000-8000-000000010001','A two',3),
 ('20000000-0000-4000-8000-000000010003','10000000-0000-4000-8000-000000010002','B one',5);
insert into public.devices(id,family_id,auth_user_id,active_child_id,access_mode) values
 ('60000000-0000-4000-8000-000000010005','10000000-0000-4000-8000-000000010001','00000000-0000-4000-8000-000000010005','20000000-0000-4000-8000-000000010001','selected'),
 ('60000000-0000-4000-8000-000000010006','10000000-0000-4000-8000-000000010002','00000000-0000-4000-8000-000000010006','20000000-0000-4000-8000-000000010003','all');
insert into public.device_children(device_id,child_id) values('60000000-0000-4000-8000-000000010005','20000000-0000-4000-8000-000000010001');
insert into public.task_templates(id,family_id,child_id,title,stars,sort_order,active) values
 ('30000000-0000-4000-8000-000000010001','10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010001','A one active',2,1,true),
 ('30000000-0000-4000-8000-000000010002','10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010001','A one paused',1,2,false),
 ('30000000-0000-4000-8000-000000010003','10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010002','A two task',1,1,true),
 ('30000000-0000-4000-8000-000000010004','10000000-0000-4000-8000-000000010002','20000000-0000-4000-8000-000000010003','B one task',1,1,true);
insert into public.star_events(family_id,child_id,delta,reason,created_by) values
 ('10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010001',3,'bonus','00000000-0000-4000-8000-000000010001'),
 ('10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010002',1,'bonus','00000000-0000-4000-8000-000000010001'),
 ('10000000-0000-4000-8000-000000010002','20000000-0000-4000-8000-000000010003',5,'bonus','00000000-0000-4000-8000-000000010002');
insert into public.exams(id,family_id,child_id,title,subject,grade,kind,status) values
 ('70000000-0000-4000-8000-000000010001','10000000-0000-4000-8000-000000010001','20000000-0000-4000-8000-000000010001','A one exam','Matematik',5,'practice','assigned'),
 ('70000000-0000-4000-8000-000000010002','10000000-0000-4000-8000-000000010002','20000000-0000-4000-8000-000000010003','B one exam','Matematik',5,'practice','assigned');

create function pg_temp.actor(id text,role_name text,family text,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',role_name,
   'device_id',case when role_name='device' then replace(id,'00000000-0000-4000-8000','60000000-0000-4000-8000') else null end,
   'child_id',case id when '00000000-0000-4000-8000-000000010005' then '20000000-0000-4000-8000-000000010001' when '00000000-0000-4000-8000-000000010006' then '20000000-0000-4000-8000-000000010003' else null end)||extra)::text,true)$$;
create function pg_temp.a() returns text language sql as $$select '10000000-0000-4000-8000-000000010001'$$;
create function pg_temp.b() returns text language sql as $$select '10000000-0000-4000-8000-000000010002'$$;
create function pg_temp.plan_text(q text) returns text language plpgsql as $$declare j json; begin execute 'explain (format json) '||q into j; return j::text; end$$;

set local role authenticated;
-- 5a. Veli A kendi ailesini görür.
select pg_temp.actor('00000000-0000-4000-8000-000000010001','parent',pg_temp.a());
select is((select count(*)::int from public.children),2,'parent A sees two children');
select is((select count(*)::int from public.task_templates),3,'parent A sees all three family routines (paused included)');
select is((select coalesce(sum(delta),0)::int from public.star_events),4,'parent A sums own family stars only');
select is((select count(*)::int from public.exams),1,'parent A sees own exam only');
select is((select count(*)::int from public.devices),1,'parent A sees own device only');
select is((select count(*)::int from public.families),1,'parent A sees own family row');
select ok(pg_temp.plan_text('select delta from public.star_events')~'InitPlan','parent star ledger plan evaluates helpers as InitPlan, not per row');
select ok(pg_temp.plan_text('select id from public.task_templates where child_id=''20000000-0000-4000-8000-000000010001''')~'InitPlan','parent task list plan uses InitPlan');
-- 5b. Veli B, sahte aile-A claim'i ile: üyelik yok → hiçbir satır.
select pg_temp.actor('00000000-0000-4000-8000-000000010002','parent',pg_temp.a());
select is((select count(*)::int from public.children),0,'forged family claim reads no children');
select is((select count(*)::int from public.task_templates),0,'forged family claim reads no routines');
select is((select count(*)::int from public.star_events),0,'forged family claim reads no stars');
select is((select count(*)::int from public.exams),0,'forged family claim reads no exams');
select throws_ok($$select public.revoke_device('60000000-0000-4000-8000-000000010005')$$,'42501',null,'forged claim cannot revoke a device');
-- 5c. Veli B kendi claim'i ile yalnız kendi ailesi.
select pg_temp.actor('00000000-0000-4000-8000-000000010002','parent',pg_temp.b());
select is((select count(*)::int from public.children),1,'parent B sees own child only');
select is((select count(*)::int from public.task_templates),1,'parent B sees own routine only');
select is((select coalesce(sum(delta),0)::int from public.star_events),5,'parent B sums own stars only');
-- 5d. Cihaz A (çocuk A-bir): yalnız atanmış çocuğun satırları; duraklatılmış rutin tamamlanma yoksa görünmez.
select pg_temp.actor('00000000-0000-4000-8000-000000010005','device',pg_temp.a());
select is((select count(*)::int from public.children),1,'device sees its assigned child only');
select is((select count(*)::int from public.task_templates),1,'device sees active routines of its child only');
select is((select coalesce(sum(delta),0)::int from public.star_events),3,'device sums its child stars only');
select is((select count(*)::int from public.exams),1,'device sees its assigned exam');
select is((select count(*)::int from public.devices),1,'device sees its own device row');
select ok(pg_temp.plan_text('select delta from public.star_events where child_id=''20000000-0000-4000-8000-000000010001''')~'InitPlan','device star ledger plan uses InitPlan');
select throws_ok($$select public.revoke_device('60000000-0000-4000-8000-000000010005')$$,'42501',null,'device cannot revoke itself');
-- 5e. Cihaz B aile A'dan hiçbir şey görmez.
select pg_temp.actor('00000000-0000-4000-8000-000000010006','device',pg_temp.b());
select is((select count(*)::int from public.task_templates where family_id=pg_temp.a()::uuid),0,'foreign device reads no family-A routines');
select is((select count(*)::int from public.star_events where family_id=pg_temp.a()::uuid),0,'foreign device reads no family-A stars');
select is((select count(*)::int from public.children),1,'foreign device sees only its own child');

-- 6. revoke_device sözleşmesi (Q02-5): yabancı/olmayan cihaz → device_not_found; kendi cihazı → iptal, tekrar çağrı idempotent.
select pg_temp.actor('00000000-0000-4000-8000-000000010001','parent',pg_temp.a());
select throws_ok($$select public.revoke_device('60000000-0000-4000-8000-000000010006')$$,'P0001','device_not_found','foreign device revoke is refused explicitly');
select throws_ok($$select public.revoke_device('60000000-0000-4000-8000-00000001ffff')$$,'P0001','device_not_found','unknown device revoke is refused explicitly');
select lives_ok($$select public.revoke_device('60000000-0000-4000-8000-000000010005')$$,'own device revoked');
select lives_ok($$select public.revoke_device('60000000-0000-4000-8000-000000010005')$$,'repeated revoke of own device stays idempotent (double tap safe)');
select pg_temp.actor('00000000-0000-4000-8000-000000010005','device',pg_temp.a());
select is((select count(*)::int from public.children),0,'revoked device with an unexpired claim reads nothing');
reset role;
set local role postgres;
select set_config('request.jwt.claims','{}',true);
select ok((select revoked_at is not null from public.devices where id='60000000-0000-4000-8000-000000010005'),'device A revoked');
select ok((select revoked_at is null from public.devices where id='60000000-0000-4000-8000-000000010006'),'device B untouched by the refused foreign revoke');

select * from finish();
rollback;
