begin;
select no_plan();
-- U08: tek kaynaklı kaynak sınırı (ayar ∩ S06 politikası), sayı/süre aralıkları, tek işlem hakkı ve tekrar güvenliği.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009901','u08-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000009902','u08-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000009903',null);
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000009901');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000009902','Shared limits','00000000-0000-4000-8000-000000009902');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000009902','10000000-0000-4000-8000-000000009902','Child',5);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('30000000-0000-4000-8000-000000009902','10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009903','20000000-0000-4000-8000-000000009902');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000009902','pro','test',now()+interval '1 day');
-- H08a: ai.enabled seed.sql'den gelir, migration'dan değil; boş/taze DB'de satırı kendimiz kuruyoruz.
insert into public.app_settings(key,value) values('ai.enabled','true') on conflict (key) do update set value=excluded.value;
update public.app_settings set value='true' where key='sources.enabled';
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,pages)
select ('40000000-0000-4000-8000-00000000990'||n)::uuid,'10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','document','Page.png','image/png',1000,repeat('c',64),'private/u08/'||n,'ready','v1',1 from generate_series(1,9)n;
create function pg_temp.actor(id text, admin boolean default false, role_name text default 'parent') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id','10000000-0000-4000-8000-000000009902','role',role_name,'admin',admin,'child_id','20000000-0000-4000-8000-000000009902'))::text,true)::void$$;
create function pg_temp.ids(n int) returns uuid[] language sql as $$select array(select ('40000000-0000-4000-8000-00000000990'||g)::uuid from generate_series(1,n)g)$$;

-- S06 hizası: dokunulmamış tohum 10 MiB → 20 MiB; politika tavanı yayımlanmış toplamla aynı
select is((select count(*)::int from public.ai_operation_policies where action in('import','generate') and max_media_bytes=10485760),0,'S06 seed media bytes aligned to the published 20 MiB total');
select is((select max_media_bytes from public.ai_operation_policies where action='import' and plan_code='pro')::bigint,20971520::bigint,'pro import policy carries 20 MiB');
select is((select max_media_items from public.ai_operation_policies where action='import' and plan_code='pro'),5,'pro import policy carries 5 items');

-- Tek okuyucu: varsayılan değerler core SOURCE_LIMIT_DEFAULTS ile aynı
select is(public.shared_source_limits()-'source','{"max_files":5,"max_image_bytes":4194304,"max_pdf_bytes":10485760,"max_pdf_pages":5,"max_total_pages":20,"max_total_bytes":20971520,"analysis_cost":"per_operation"}'::jsonb,'defaults match core SOURCE_LIMIT_DEFAULTS');
select is(public.shared_source_limits()->>'source','app_settings','without action only the setting applies');

set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009902');
select is((public.get_learning_source_policy()->>'max_files')::int,5,'picker policy reads the shared default');
select is((public.get_learning_source_policy()->>'max_total_bytes')::bigint,20971520::bigint,'picker policy carries total bytes');
select is(public.get_learning_source_policy()->>'source','app_settings+policy','parent policy intersects the import policy row');
select is((public.shared_source_limits('import')->>'max_files')::int,5,'pro import: setting 5 ∩ policy 5 = 5');
select throws_ok($$select public.register_learning_source_set(pg_temp.ids(6))$$,'P0001','source_file_limit','six files exceed the shared default');
select is((select pg_temp.ids(6) is not null),true,'fixture sane');

-- Yönetici sınırı düşürür: tek yerden hem seçici hem sunucu değişir
select pg_temp.actor('00000000-0000-4000-8000-000000009901', true);
select lives_ok($$select public.admin_source_file_limit(3)$$,'admin lowers the managed limit to 3');
select pg_temp.actor('00000000-0000-4000-8000-000000009902');
select is((public.get_learning_source_policy()->>'max_files')::int,3,'picker sees 3 after the admin change');
select is((public.shared_source_limits('import')->>'max_files')::int,3,'server reader sees 3 for import');
select throws_ok($$select public.register_learning_source_set(pg_temp.ids(4))$$,'P0001','source_file_limit','four files rejected under limit 3');
select is(public.register_learning_source_set(pg_temp.ids(3)),'40000000-0000-4000-8000-000000009901'::uuid,'three files accepted under limit 3');
select is(public.register_learning_source_set(pg_temp.ids(3)),'40000000-0000-4000-8000-000000009901'::uuid,'replay returns the same anchor');

-- Politika satırı daha dar ise o kazanır (S06 medya politikası kesişimi)
reset role;
update public.ai_operation_policies set max_media_items=2,max_media_bytes=5242880 where action='import' and plan_code='pro';
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009902');
select is((public.shared_source_limits('import')->>'max_files')::int,2,'narrower policy items win over the setting');
select is((public.shared_source_limits('import')->>'max_total_bytes')::bigint,5242880::bigint,'narrower policy bytes win over the 20 MiB total');
select is((public.shared_source_limits('generate')->>'max_files')::int,3,'other action keeps the setting');
select is((public.shared_source_limits()->>'max_files')::int,3,'no action keeps the setting');
-- Cihaz (çocuk) kimliği aile sınırını okuyamaz: permission_denied ayrımı
select pg_temp.actor('00000000-0000-4000-8000-000000009903', false, 'device');
select throws_ok($$select public.register_learning_source_set(pg_temp.ids(1))$$,'42501','forbidden','device role is permission_denied, not validation');
reset role;
update public.ai_operation_policies set max_media_items=5,max_media_bytes=20971520 where action='import' and plan_code='pro';

-- Sayı/süre aralıkları: core INPUT_RANGES ile aynı anahtarlar ve DB kısıtlarıyla uyum
select is((select count(*)::int from jsonb_object_keys(public.shared_input_ranges())),12,'twelve shared input ranges');
select is(public.shared_input_ranges()->'prova_minutes','{"min":1,"max":180,"step":5,"presets":[10,15,20,30,45,60],"unit":"minutes"}'::jsonb,'prova minutes range');
select is((public.shared_input_ranges()->'reward_cost_stars'->>'max')::int,500,'reward cost max 500');
select ok(exists(select 1 from pg_constraint where pg_get_constraintdef(oid) ~ 'cost_stars >= 1.*cost_stars <= 500'),'rewards.cost_stars check matches the shared range');
select ok(exists(select 1 from pg_constraint where pg_get_constraintdef(oid) ~ 'stars >= 0.*stars <= 10'),'tasks.stars check matches the shared range');
select ok(exists(select 1 from pg_constraint where pg_get_constraintdef(oid) ~ 'duration_minutes >= 5.*duration_minutes <= 120'),'group exam minutes check matches the shared range');
select is(gina.check_input_range('prova_minutes',180),180,'boundary accepted');
select is(gina.check_input_range('task_stars',0),0,'zero stars accepted for tasks');
select throws_ok($$select gina.check_input_range('prova_minutes',181)$$,'P0001','invalid_input','above max rejected');
select throws_ok($$select gina.check_input_range('prova_minutes',0)$$,'P0001','invalid_input','below min rejected');
select throws_ok($$select gina.check_input_range('prova_minutes',12.5)$$,'P0001','invalid_input','fraction rejected');
select throws_ok($$select gina.check_input_range('unknown_field',1)$$,'P0001','invalid_input','unknown field rejected');
select ok(not has_function_privilege('authenticated','gina.check_input_range(text,numeric)','execute'),'client cannot call the server-only validator');
select ok(has_function_privilege('authenticated','public.shared_input_ranges()','execute'),'client reads the ranges');

-- Tek işlem hakkı: çoklu analiz tek iş; tekrar ücretli üretim yok; soru üretim kotası ayrı
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009902');
select set_config('u08.generate_before',(public.get_ai_usage()->'generate'->>'remaining'),true);
select is((select (o->>'used')::int from jsonb_array_elements(public.get_ai_usage()->'operations') o where o->>'action'='import'),0,'no import used yet');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('u08.lease1',gen_random_uuid()::text,true);
select set_config('u08.job1',(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('1',64),current_setting('u08.lease1')::uuid,'20000000-0000-4000-8000-000000009902')->>'id'),true);
select ok(current_setting('u08.job1') is not null and current_setting('u08.job1')<>'','multi-source import reserved as one job');
select is(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('1',64),gen_random_uuid(),'20000000-0000-4000-8000-000000009902')->>'error','generation_in_progress','same request while working does not start a second paid generation');
select lives_ok(format($$select public.finish_ai_operation(%L,%L,'{"output":{"ok":true},"inputTokens":10,"outputTokens":5}'::jsonb)$$,current_setting('u08.job1'),current_setting('u08.lease1')),'first generation finished');
select is(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('1',64),gen_random_uuid(),'20000000-0000-4000-8000-000000009902')->'cached'->'output','{"ok":true}'::jsonb,'replay returns the cached paid result');
select is(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('1',64),gen_random_uuid(),'20000000-0000-4000-8000-000000009902')->>'id',current_setting('u08.job1'),'replay keeps the same job id');
-- Kayıp yanıt: belirsiz biten iş tekrar sessizce çalışmaz
select set_config('u08.lease2',gen_random_uuid()::text,true);
select set_config('u08.job2',(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('2',64),current_setting('u08.lease2')::uuid,'20000000-0000-4000-8000-000000009902')->>'id'),true);
select lives_ok(format($$select public.finish_ai_operation(%L,%L,null,'anthropic_500',true)$$,current_setting('u08.job2'),current_setting('u08.lease2')),'second generation marked uncertain');
select is(public.reserve_child_ai_operation('10000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009902','import',repeat('2',64),gen_random_uuid(),'20000000-0000-4000-8000-000000009902')->>'error','ai_result_uncertain','uncertain job is never re-run implicitly');
reset role;
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009902');
select is((select (o->>'used')::int from jsonb_array_elements(public.get_ai_usage()->'operations') o where o->>'action'='import'),2,'two distinct analyses consumed two import operations, replays none');
select is(public.get_ai_usage()->'generate'->>'remaining',current_setting('u08.generate_before'),'question generation quota is separate and untouched');
reset role;
select finish();
rollback;
