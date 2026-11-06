-- D15: test-scoped catalogue visibility for the MEB acceptance pilot (20261106440000).
begin;
select no_plan();

-- ACL: table closed, helper closed, RPCs service-only; nothing anon/authenticated-executable added.
select ok(not has_table_privilege('authenticated','gina.curriculum_pilot_families','SELECT') and not has_table_privilege('service_role','gina.curriculum_pilot_families','SELECT')
  and not has_table_privilege('anon','gina.curriculum_pilot_families','INSERT'),'pilot table has no client/service grants');
select ok((select relrowsecurity from pg_class where oid='gina.curriculum_pilot_families'::regclass),'pilot table RLS on');
select ok(not has_function_privilege('authenticated','gina.curriculum_catalog_open(uuid)','EXECUTE') and not has_function_privilege('anon','gina.curriculum_catalog_open(uuid)','EXECUTE')
  and not has_function_privilege('service_role','gina.curriculum_catalog_open(uuid)','EXECUTE'),'gate helper is internal');
select ok(not has_function_privilege('anon','public.set_curriculum_pilot_family(uuid,text,int)','EXECUTE') and not has_function_privilege('authenticated','public.set_curriculum_pilot_family(uuid,text,int)','EXECUTE')
  and has_function_privilege('service_role','public.set_curriculum_pilot_family(uuid,text,int)','EXECUTE'),'set is service-only');
select ok(not has_function_privilege('anon','public.clear_curriculum_pilot_family(uuid)','EXECUTE') and not has_function_privilege('authenticated','public.clear_curriculum_pilot_family(uuid)','EXECUTE')
  and has_function_privilege('service_role','public.clear_curriculum_pilot_family(uuid)','EXECUTE'),'clear is service-only');
select ok(not has_function_privilege('anon','public.get_curriculum_pilot_family(uuid)','EXECUTE') and not has_function_privilege('authenticated','public.get_curriculum_pilot_family(uuid)','EXECUTE')
  and has_function_privilege('service_role','public.get_curriculum_pilot_family(uuid)','EXECUTE'),'read is service-only');
select ok(has_function_privilege('authenticated','public.get_curriculum_scenarios(uuid,text,int,int,text)','EXECUTE') and not has_function_privilege('anon','public.get_curriculum_scenarios(uuid,text,int,int,text)','EXECUTE')
  and has_function_privilege('authenticated','public.save_catalog_blueprint(uuid,jsonb)','EXECUTE') and not has_function_privilege('anon','public.save_catalog_blueprint(uuid,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.reserve_catalog_prova_generation(uuid,uuid,uuid,text,int,uuid,uuid)','EXECUTE')
  and has_function_privilege('service_role','public.reserve_catalog_prova_generation(uuid,uuid,uuid,text,int,uuid,uuid)','EXECUTE'),'replaced gates keep their ACLs');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','gina')
  and p.proname in('get_curriculum_scenarios','save_catalog_blueprint','reserve_catalog_prova_generation')
  and pg_get_functiondef(p.oid) like '%curriculum_catalog_open%' and pg_get_functiondef(p.oid) not like '%curriculum_catalog.enabled%'),3,'all three gates use the scoped helper');

-- Fixture: pilot family (synthetic @example.invalid), non-pilot family (synthetic), real-looking family, editor.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000012901','d15-pilot-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000012902','d15-other-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000012903','real.parent@gmail.com'),
 ('00000000-0000-4000-8000-000000012904','d15-editor@example.invalid'),
 ('00000000-0000-4000-8000-000000012905','d15-second-parent@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000012904');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000012901','Pilot','00000000-0000-4000-8000-000000012901'),
 ('10000000-0000-4000-8000-000000012902','Other','00000000-0000-4000-8000-000000012902'),
 ('10000000-0000-4000-8000-000000012903','Real','00000000-0000-4000-8000-000000012903'),
 ('10000000-0000-4000-8000-000000012904','Empty','00000000-0000-4000-8000-000000012901');
insert into public.family_members(user_id,family_id) values
 ('00000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901'),
 ('00000000-0000-4000-8000-000000012902','10000000-0000-4000-8000-000000012902'),
 ('00000000-0000-4000-8000-000000012903','10000000-0000-4000-8000-000000012903');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901','Pilot child',5),
 ('20000000-0000-4000-8000-000000012902','10000000-0000-4000-8000-000000012902','Other child',5);
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
 ('10000000-0000-4000-8000-000000012901','pro','D15 pilot scope test',now()+interval '1 day'),
 ('10000000-0000-4000-8000-000000012902','pro','D15 pilot scope test',now()+interval '1 day');
select is((select value::text from public.app_settings where key='curriculum_catalog.enabled'),'false','global switch stays off in this test');

create function pg_temp.bundle() returns jsonb language sql as $$select '{"schema":"gina.curriculum-review.v1","candidates":[{"key":"tr-2026-2027-t1-turkce2-g5-c6","academic_year":"2026-2027","term":1,"exam":1,"grade":5,"subject":"Türkçe","label":"Türkçe 5 · 1. yazılı · Senaryo 1","source_url":"https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx","source_sha256":"6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee","sheet":"5. Sınıf","header_cell":"C6","question_count":3,"blocks":[{"count":2,"count_cell":"C12","outcomes":[{"cell":"B12","text":"T.O.5.6. Metnin yüzey anlamını belirleyebilme","code":"T.O.5.6"}]},{"count":1,"count_cell":"C13","outcomes":[{"cell":"B13","text":"T.O.5.7. Görselle iletilen anlamı belirleyebilme","code":"T.O.5.7"}]}],"review_reasons":["Test candidate"]}]}'::jsonb$$;
create function pg_temp.review() returns jsonb language sql as $$select '{"programme":"Test programme version","school_scope":"Synthetic scope for testing only","programme_url":"https://tymm.meb.gov.tr/ogretim-programlari","source_checked":true,"counts_checked":true,"applicability_checked":true,"issues_resolution":"Synthetic evidence reviewed for test only.","note":"Test source review, not real catalogue approval."}'::jsonb$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012904","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select public.admin_import_curriculum_candidates(gen_random_uuid(),pg_temp.bundle());
select set_config('test.id',public.admin_list_curriculum_candidates()->0->>'id',true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.id')::uuid,0,'review',pg_temp.review(),'Test review',true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.id')::uuid,1,'publish',null,'Test publication',true);
reset role;
select is((select status from gina.curriculum_candidates where id=current_setting('test.id')::uuid),'published','candidate published (global)');

create function pg_temp.as_parent(u text,f text) returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','gina',jsonb_build_object('role','parent','family_id',f))::text,true)$$;
create function pg_temp.as_service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;

-- Before any scope: switch off → nobody sees or selects the published scenario.
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012901','2026-2027',1,1,'Türkçe'),'[]'::jsonb,'no scope + switch off: pilot family sees nothing');
select throws_ok($$select public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000012901','catalogue_id',current_setting('test.id'),'revision',2,'subject','Türkçe','confirmed',true))$$,'P0001','curriculum_unavailable','no scope: selection refused');

-- Clients cannot scope themselves.
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','Parent tries to self scope',1)$$,'42501',null,'parent cannot call set');
select throws_ok($$select gina.curriculum_catalog_open('10000000-0000-4000-8000-000000012901')$$,'42501',null,'parent cannot call helper');
select throws_ok($$insert into gina.curriculum_pilot_families(family_id,reason,ends_at) values('10000000-0000-4000-8000-000000012901','self scoped row here',now()+interval '1 hour')$$,'42501',null,'parent cannot insert pilot row');
reset role;
set local role anon;select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select public.get_curriculum_pilot_family('10000000-0000-4000-8000-000000012901')$$,'42501',null,'anon cannot read scope');
reset role;

-- Service: validation and the synthetic-only rule.
set local role service_role;select pg_temp.as_service();
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','short',1)$$,'P0001','invalid_input','reason required');
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','D15 pilot window too long',7)$$,'P0001','invalid_input','max 6 hours');
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','D15 pilot window zero',0)$$,'P0001','invalid_input','min 1 hour');
select throws_ok($$select public.set_curriculum_pilot_family(gen_random_uuid(),'D15 pilot unknown family',1)$$,'P0001','not_found','unknown family');
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012903','D15 pilot real family attempt',1)$$,'P0001','curriculum_pilot_family_not_synthetic','real family never qualifies');
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012904','D15 pilot family without members',1)$$,'P0001','curriculum_pilot_family_not_synthetic','memberless family does not qualify');
select ok((public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','D15 MEB acceptance pilot (synthetic family)',3)->>'ends_at') is not null,'synthetic family scoped');
select ok((public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012901','D15 MEB acceptance pilot (synthetic family)',3)->>'family_id')='10000000-0000-4000-8000-000000012901','re-scope is idempotent (one row)');
select is((public.get_curriculum_pilot_family('10000000-0000-4000-8000-000000012901')->>'open')::boolean,true,'scoped family open');
select is((public.get_curriculum_pilot_family('10000000-0000-4000-8000-000000012902')->>'open')::boolean,false,'other family closed');
select is((public.get_curriculum_pilot_family('10000000-0000-4000-8000-000000012902')->'scope'),'null'::jsonb,'other family has no scope');
reset role;
select is((select count(*)::int from gina.curriculum_pilot_families),1,'single pilot row');
select is((select count(*)::int from public.audit_log where action='curriculum.pilot_scope_set' and family_id='10000000-0000-4000-8000-000000012901'),2,'each scope write audited');

-- A second (non-synthetic) member makes the family ineligible for a new scope.
insert into public.family_members(user_id,family_id) values('00000000-0000-4000-8000-000000012905','10000000-0000-4000-8000-000000012902');
set local role service_role;select pg_temp.as_service();
select throws_ok($$select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012902','D15 pilot mixed family attempt',1)$$,'P0001','curriculum_pilot_family_not_synthetic','one real member disqualifies');
reset role;
delete from public.family_members where user_id='00000000-0000-4000-8000-000000012905';

-- Scoped family sees and selects; the other family still sees nothing (switch remains off).
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901');
select is(jsonb_array_length(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012901','2026-2027',1,1,'Türkçe')),1,'pilot family sees the published scenario');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012901','2026-2027',2,1,'Türkçe'),'[]'::jsonb,'pilot does not substitute another term');
select set_config('test.bp',public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000012901','catalogue_id',current_setting('test.id'),'revision',2,'subject','Türkçe','confirmed',true))::text,true);
select ok(current_setting('test.bp') ~ '^[0-9a-f-]{36}$','pilot family selects a frozen copy');
select throws_ok($$select public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012902','2026-2027',1,1,'Türkçe')$$,'42501','forbidden','pilot parent cannot read other family child');
select pg_temp.as_parent('00000000-0000-4000-8000-000000012902','10000000-0000-4000-8000-000000012902');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012902','2026-2027',1,1,'Türkçe'),'[]'::jsonb,'non-pilot family still sees nothing');
select throws_ok($$select public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000012902','catalogue_id',current_setting('test.id'),'revision',2,'subject','Türkçe','confirmed',true))$$,'P0001','curriculum_unavailable','non-pilot family cannot select');
reset role;

-- Server reservation honours the scope (and only the scope).
insert into public.prova_drafts(id,family_id,created_by,content) values('30000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901','00000000-0000-4000-8000-000000012901','{"childId":"20000000-0000-4000-8000-000000012901","grade":5,"subjects":["Türkçe"],"purpose":"written"}');
set local role service_role;select pg_temp.as_service();
select ok(public.reserve_catalog_prova_generation('70000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901','00000000-0000-4000-8000-000000012901',repeat('a',64),3,current_setting('test.bp')::uuid,'30000000-0000-4000-8000-000000012901')?'lease','scoped family reserves catalogue generation');
reset role;

-- Expired scope closes everything again (an already reserved job can still be retrieved, as with withdrawal).
update gina.curriculum_pilot_families set starts_at=now()-interval '4 hours',ends_at=now()-interval '1 minute';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012901','2026-2027',1,1,'Türkçe'),'[]'::jsonb,'expired scope: nothing visible');
reset role;
set local role service_role;select pg_temp.as_service();
select is(public.reserve_catalog_prova_generation('70000000-0000-4000-8000-000000012902','10000000-0000-4000-8000-000000012901','00000000-0000-4000-8000-000000012901',repeat('b',64),3,current_setting('test.bp')::uuid,'30000000-0000-4000-8000-000000012901')->>'error','curriculum_unavailable','expired scope: new generation refused before charging');
select ok(public.reserve_catalog_prova_generation('70000000-0000-4000-8000-000000012901','10000000-0000-4000-8000-000000012901','00000000-0000-4000-8000-000000012901',repeat('a',64),3,current_setting('test.bp')::uuid,'30000000-0000-4000-8000-000000012901') is not null,'existing job lookup unaffected');
select is((public.clear_curriculum_pilot_family('10000000-0000-4000-8000-000000012901')->>'removed')::boolean,true,'clear removes scope');
select is((public.clear_curriculum_pilot_family('10000000-0000-4000-8000-000000012901')->>'removed')::boolean,false,'clear is idempotent');
select is((public.get_curriculum_pilot_family('10000000-0000-4000-8000-000000012901')->>'open')::boolean,false,'cleared family closed');
reset role;
select is((select count(*)::int from public.audit_log where action='curriculum.pilot_scope_cleared'),1,'clear audited once');
select is((select count(*)::int from gina.curriculum_pilot_families),0,'no pilot rows remain');

-- Global switch still opens for every family (existing behaviour unchanged).
update public.app_settings set value='true' where key='curriculum_catalog.enabled';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000012902','10000000-0000-4000-8000-000000012902');
select is(jsonb_array_length(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000012902','2026-2027',1,1,'Türkçe')),1,'global switch: every family sees published');
reset role;
update public.app_settings set value='false' where key='curriculum_catalog.enabled';

-- Family deletion cascades the scope row.
set local role service_role;select pg_temp.as_service();
select public.set_curriculum_pilot_family('10000000-0000-4000-8000-000000012902','D15 pilot cascade check',1);
reset role;
delete from public.families where id='10000000-0000-4000-8000-000000012902';
select is((select count(*)::int from gina.curriculum_pilot_families),0,'scope row removed with family');

select * from finish();
rollback;
