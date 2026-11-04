begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000005301','document-parent@test.local'),
('00000000-0000-4000-8000-000000005302','document-other@test.local'),
('00000000-0000-4000-8000-000000005303',null);
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000005301','Sources','00000000-0000-4000-8000-000000005301'),
('10000000-0000-4000-8000-000000005302','Other','00000000-0000-4000-8000-000000005302');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301'),
('10000000-0000-4000-8000-000000005302','00000000-0000-4000-8000-000000005302');
insert into public.children(id,family_id,name) values
('20000000-0000-4000-8000-000000005301','10000000-0000-4000-8000-000000005301','Child');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('30000000-0000-4000-8000-000000005301','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005303','20000000-0000-4000-8000-000000005301');
update public.plans set max_active_tasks_per_child=20 where code='free';
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000005301','plus','test',now()+interval '1 day');
update public.plans set setup_ai_monthly=3 where code='plus';
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,pages,created_at) values
('40000000-0000-4000-8000-000000005301','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301','document','Plan.pdf','application/pdf',100,repeat('a',64),'private/test/1','ready','v1',1,now()-interval '2 days'),
('40000000-0000-4000-8000-000000005302','10000000-0000-4000-8000-000000005302','00000000-0000-4000-8000-000000005302','document','Other.pdf','application/pdf',100,repeat('a',64),'private/test/2','ready','v1',1,now()),
('40000000-0000-4000-8000-000000005303','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301','document','Pending.pdf','application/pdf',100,repeat('a',64),'private/test/3','awaiting_upload','v1',1,now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"parent"}}',true);
select ok(jsonb_array_length(public.get_guided_input_options('20000000-0000-4000-8000-000000005301','bag'))>0,'family can read bag options');
select is((select count(*)::int from public.guided_input_options),0,'family cannot access admin catalog');
select throws_ok($$select public.admin_save_guided_input('bag-pencil',1,'{}')$$,'42501',null,'parent cannot edit global catalog');
select throws_ok($$select public.get_guided_input_options(gen_random_uuid(),'bag')$$,'42501','bag_forbidden','foreign child cannot be queried');
reset role;
update public.children set grade=2 where id='20000000-0000-4000-8000-000000005301';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(public.get_guided_input_options('20000000-0000-4000-8000-000000005301','subject'))x where x->>'id'='subject-physics'),'grade filter comes from child record');
reset role;
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000005301');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"parent","admin":true}}',true);
select set_config('test.option','{"kind":"bag","label_tr":"Test eşya","label_en":"Test item","subject":"","min_grade":1,"max_grade":12,"position":99,"active":true}',true);
select is(public.admin_save_guided_input('bag-test',0,current_setting('test.option')::jsonb),1,'admin creates option');
select throws_ok($$select public.admin_save_guided_input('bag-test',0,current_setting('test.option')::jsonb)$$,'P0001','catalog_changed','stale revision cannot overwrite');
select is(public.admin_save_guided_input('bag-test',1,current_setting('test.option')::jsonb||'{"active":false}'),2,'admin can hide option');
select ok(not exists(select 1 from jsonb_array_elements(public.get_guided_input_options('20000000-0000-4000-8000-000000005301','bag'))x where x->>'id'='bag-test'),'hidden option not suggested');
select throws_ok($$select public.admin_save_guided_input('bag-test',2,current_setting('test.option')::jsonb||'{"kind":"study"}')$$,'P0001','catalog_kind_immutable','semantic category cannot change');
reset role;
select is((select count(*)::int from public.audit_log where action='guided_input.saved' and target_id='bag-test'),2,'catalog writes audited');
delete from public.admins where user_id='00000000-0000-4000-8000-000000005301';
set local role authenticated;
select is((select count(*)::int from public.guided_input_options),0,'revoked admin cannot read catalog with stale admin claim');
select throws_ok($$select public.admin_save_guided_input('bag-test',2,current_setting('test.option')::jsonb)$$,'42501',null,'revoked admin cannot write with stale claim');
reset role;
select * from finish();rollback;
