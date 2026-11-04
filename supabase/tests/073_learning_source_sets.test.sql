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

update public.app_settings set value='true' where key='sources.enabled';
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,pages)
select ('40000000-0000-4000-8000-00000000530'||n)::uuid,'10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301','document','Page.png','image/png',100,repeat('b',64),'private/set/'||n,'ready','v1',1 from generate_series(4,9)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"parent"}}',true);
select is((public.get_learning_source_policy()->>'max_files')::int,5,'default five files');
select throws_ok($$select public.admin_source_file_limit(10)$$,'42501',null,'parent cannot change global policy');
select throws_ok($$select public.register_learning_source_set(array['40000000-0000-4000-8000-000000005301','40000000-0000-4000-8000-000000005302']::uuid[])$$,'P0001','source_not_ready','foreign original denied');
select throws_ok($$select public.register_learning_source_set(array['40000000-0000-4000-8000-000000005301','40000000-0000-4000-8000-000000005301']::uuid[])$$,'P0001','source_file_limit','duplicates denied');
select throws_ok($$select public.register_learning_source_set(array(select ('40000000-0000-4000-8000-00000000530'||n)::uuid from generate_series(4,9)n))$$,'P0001','source_file_limit','six files denied by default');
select is(public.register_learning_source_set(array['40000000-0000-4000-8000-000000005301','40000000-0000-4000-8000-000000005304']::uuid[]),'40000000-0000-4000-8000-000000005301'::uuid,'ordered set registered');
select is(public.register_learning_source_set(array['40000000-0000-4000-8000-000000005301','40000000-0000-4000-8000-000000005304']::uuid[]),'40000000-0000-4000-8000-000000005301'::uuid,'lost response replay stable');
select throws_ok($$select public.register_learning_source_set(array['40000000-0000-4000-8000-000000005301','40000000-0000-4000-8000-000000005305']::uuid[])$$,'P0001','request_conflict','existing group cannot change');
select throws_ok($$select public.register_learning_source_set(array['40000000-0000-4000-8000-000000005304','40000000-0000-4000-8000-000000005305']::uuid[])$$,'P0001','request_conflict','member cannot become new anchor');
select is((select pages from public.learning_source_sets),2,'combined page count');
select set_config('test.task',(public.save_setup_batch(gen_random_uuid(),'task','[{"title":"Oku","icon":"read-book","stars":1,"days":[1,3],"source_id":"40000000-0000-4000-8000-000000005301"}]','20000000-0000-4000-8000-000000005301')->>0),true);
select is(jsonb_array_length(public.get_setup_sources('task',array[current_setting('test.task')::uuid])),2,'all original links retained');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005302","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005302","role":"parent"}}',true);
select is((select count(*)::int from public.learning_source_sets),0,'sets isolated by family');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005303","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"device","child_id":"20000000-0000-4000-8000-000000005301"}}',true);
select throws_ok($$select public.register_learning_source_set(array['40000000-0000-4000-8000-000000005305']::uuid[])$$,'42501','forbidden','child cannot register source set');
select is((select count(*)::int from public.learning_source_sets),0,'child cannot read originals');
reset role;
insert into public.question_bank(family_id,grade,subject,topic,kind,stem,provenance,created_by) values
('10000000-0000-4000-8000-000000005301',2,'Matematik','Sayılar','open_ended','Test soru','{"document_source_id":"40000000-0000-4000-8000-000000005305"}','00000000-0000-4000-8000-000000005301');
update public.learning_sources set created_at=now()-interval '2 days' where id='40000000-0000-4000-8000-000000005305';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.expire_unlinked_learning_sources();
select ok(exists(select 1 from public.learning_sources where id='40000000-0000-4000-8000-000000005305'),'generated question keeps its private original');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"parent"}}',true);
set local role authenticated;
select is(jsonb_array_length(public.get_learning_source_set('40000000-0000-4000-8000-000000005301')),2,'parent can resolve all originals');
reset role;
delete from public.learning_sources where id='40000000-0000-4000-8000-000000005304';
set local role authenticated;
select throws_ok($$select public.get_learning_source_set('40000000-0000-4000-8000-000000005301')$$,'P0001','source_not_ready','missing original does not silently present an incomplete set');
reset role;
select * from finish();rollback;
