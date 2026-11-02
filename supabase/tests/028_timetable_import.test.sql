begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000002801','source-parent@test.local'),
('00000000-0000-4000-8000-000000002802','source-other@test.local'),
('00000000-0000-4000-8000-000000002803',null);
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000002801','Sources','00000000-0000-4000-8000-000000002801'),
('10000000-0000-4000-8000-000000002802','Other','00000000-0000-4000-8000-000000002802');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801'),
('10000000-0000-4000-8000-000000002802','00000000-0000-4000-8000-000000002802');
insert into public.children(id,family_id,name) values
('20000000-0000-4000-8000-000000002801','10000000-0000-4000-8000-000000002801','Child');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('30000000-0000-4000-8000-000000002801','10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002803','20000000-0000-4000-8000-000000002801');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801','import',repeat('c',64),gen_random_uuid())->>'error','ai_disabled','Free import gate enforced');
reset role;
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000002801','plus','test',now()+interval '1 day');
set local role service_role;
select ok(public.reserve_ai_operation('10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801','import',repeat('c',64),'70000000-0000-4000-8000-000000002801') ? 'id','Plus import starts');
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801','import',repeat('c',64),gen_random_uuid())->>'error','generation_in_progress','repeated import waits instead of recharging');
select lives_ok($$select public.finish_ai_operation((select id from public.ai_operation_jobs where input_hash=repeat('c',64)),'70000000-0000-4000-8000-000000002801','{"output":{}}')$$,'paid import output persisted');
select ok(public.reserve_ai_operation('10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801','import',repeat('c',64),gen_random_uuid()) ? 'cached','completed import reuses paid result');
reset role;
insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,pages,storage_consent) values
('40000000-0000-4000-8000-000000002801','10000000-0000-4000-8000-000000002801','document','week.pdf','application/pdf',100,repeat('a',64),'import-test-1','ready',1,'v1'),
('40000000-0000-4000-8000-000000002802','10000000-0000-4000-8000-000000002802','document','other.pdf','application/pdf',100,repeat('b',64),'import-test-2','ready',1,'v1');
insert into public.ai_operation_jobs(id,family_id,requested_by,action,input_hash,lease,status,result) values
('50000000-0000-4000-8000-000000002801','10000000-0000-4000-8000-000000002801','00000000-0000-4000-8000-000000002801','import',repeat('a',64),gen_random_uuid(),'done','{"output":{"lessons":[{"day":1,"title":"Math","start":null,"end":null,"page":1,"note":""}],"warnings":[]}}');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.register_timetable_import('50000000-0000-4000-8000-000000002801','40000000-0000-4000-8000-000000002802','20000000-0000-4000-8000-000000002801')$$,'P0001','source_not_ready','cannot register another family source');
select lives_ok($$select public.register_timetable_import('50000000-0000-4000-8000-000000002801','40000000-0000-4000-8000-000000002801','20000000-0000-4000-8000-000000002801')$$,'register draft');
select lives_ok($$select public.register_timetable_import('50000000-0000-4000-8000-000000002801','40000000-0000-4000-8000-000000002801','20000000-0000-4000-8000-000000002801')$$,'register replay');
reset role;
select is((select count(*)::int from public.timetable_imports),1,'one draft on replay');
select is((select count(*)::int from public.school_timetables),0,'extraction does not save a program');
update public.learning_sources set created_at=now()-interval '2 days';
set local role service_role;
select is(public.expire_unlinked_learning_sources(),1,'cleanup deletes unused upload but keeps recent draft source');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002802","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002802","role":"parent"}}',true);
select is((select count(*)::int from public.timetable_imports),0,'other family cannot list draft');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',0,'[]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','source_not_ready','other family cannot apply draft');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002803","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002801","role":"device","device_id":"30000000-0000-4000-8000-000000002801","child_id":"20000000-0000-4000-8000-000000002801"}}',true);
select is((select count(*)::int from public.timetable_imports),0,'device cannot list private source drafts');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',0,'[]','{"start":"09:00","duration":40,"break":10}')$$,'42501','forbidden','device cannot apply AI draft');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002801","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002801","role":"parent"}}',true);
select throws_ok($$update public.timetable_imports set applied_revision=1$$,'42501',null,'client cannot bypass apply');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',0,'[{"id":"a","day":1,"title":"Math","start":"","end":""}]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','timetable_invalid','missing times cannot save');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',0,'[{"id":"a","day":1,"title":"Math","start":"09:00","end":"09:40"},{"id":"b","day":1,"title":"Science","start":"09:20","end":"10:00"}]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','timetable_overlap','overlap cannot save');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',1,'[]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','timetable_conflict','revision conflict preserves draft');
select is(jsonb_array_length(public.get_timetable_sources('20000000-0000-4000-8000-000000002801')),0,'failed save does not link source');
select is(public.apply_timetable_import('60000000-0000-4000-8000-000000002801','50000000-0000-4000-8000-000000002801',0,'[{"id":"a","day":1,"title":"Math","start":"09:00","end":"09:40"}]','{"start":"09:00","duration":40,"break":10}'),1,'reviewed program saves');
select is(public.apply_timetable_import('60000000-0000-4000-8000-000000002801','50000000-0000-4000-8000-000000002801',0,'[{"id":"a","day":1,"title":"Math","start":"09:00","end":"09:40"}]','{"start":"09:00","duration":40,"break":10}'),1,'lost response replay returns same revision');
select is((select count(*)::int from public.events where timetable_entry_key is not null),1,'replay creates no duplicate calendar event');
select is(jsonb_array_length(public.get_timetable_sources('20000000-0000-4000-8000-000000002801')),1,'one source link');
select throws_ok($$select public.apply_timetable_import('60000000-0000-4000-8000-000000002801','50000000-0000-4000-8000-000000002801',0,'[]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','request_conflict','same request cannot change payload');
select throws_ok($$select public.apply_timetable_import(gen_random_uuid(),'50000000-0000-4000-8000-000000002801',1,'[]','{"start":"09:00","duration":40,"break":10}')$$,'P0001','import_already_applied','new request cannot apply same extraction twice');
reset role;
update public.learning_sources set created_at=now()-interval '20 days';update public.timetable_imports set created_at=now()-interval '20 days';
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.expire_unlinked_learning_sources(),0,'applied source retained beyond draft expiry');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002802","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002802","role":"parent"}}',true);
select is(jsonb_array_length(public.get_timetable_sources('20000000-0000-4000-8000-000000002801')),0,'source list cannot reveal another family document name');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002801","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002801","role":"parent"}}',true);
select lives_ok($$select public.delete_learning_source('40000000-0000-4000-8000-000000002801')$$,'parent may delete original after saving');
select is((select revision from public.school_timetables where child_id='20000000-0000-4000-8000-000000002801'),1,'original deletion preserves approved timetable');
select is((select count(*)::int from public.events where timetable_entry_key is not null),1,'original deletion preserves calendar lesson');
reset role;
delete from public.families where id='10000000-0000-4000-8000-000000002801';
select is((select count(*)::int from public.timetable_imports),0,'family deletion removes private draft');
select is((select count(*)::int from public.source_deletion_queue where object_path='import-test-1'),1,'family deletion queues physical original');
select * from finish();rollback;
