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
select set_config('test.batch','[{"title":"Oku","icon":"read-book","stars":1,"days":[1,3],"source_id":"40000000-0000-4000-8000-000000005301"}]',true);
select set_config('test.result',public.save_setup_batch('60000000-0000-4000-8000-000000005301','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000005301')::text,true);
select is(public.save_setup_batch('60000000-0000-4000-8000-000000005301','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000005301')::text,current_setting('test.result'),'linked task replay returns original IDs');
select set_config('test.task',(current_setting('test.result')::jsonb->>0),true);
select is(jsonb_array_length(public.get_setup_sources('task',array[current_setting('test.task')::uuid])),1,'parent sees linked source');
select is(public.get_setup_sources('task',array[current_setting('test.task')::uuid])->0->>'name','Plan.pdf','source filename retained');
select ok(not (public.get_setup_sources('task',array[current_setting('test.task')::uuid])->0 ? 'object_path'),'no private storage path leaked');
select throws_ok($$select public.save_setup_batch(gen_random_uuid(),'task',jsonb_set(current_setting('test.batch')::jsonb,'{0,source_id}','"40000000-0000-4000-8000-000000005302"'),'20000000-0000-4000-8000-000000005301')$$,'P0001','source_not_ready','foreign document rejected');
select throws_ok($$select public.save_setup_batch(gen_random_uuid(),'task',jsonb_set(current_setting('test.batch')::jsonb,'{0,source_id}','"40000000-0000-4000-8000-000000005303"'),'20000000-0000-4000-8000-000000005301')$$,'P0001','source_not_ready','unverified source rejected');
select throws_ok($$select public.save_setup_batch(gen_random_uuid(),'task',jsonb_set(current_setting('test.batch')::jsonb,'{0,source_id}','null'),'20000000-0000-4000-8000-000000005301')$$,'P0001','source_not_ready','null source rejected');
select throws_ok($$select public.save_setup_batch(gen_random_uuid(),'task',current_setting('test.batch')::jsonb||'[{"title":"Invalid","icon":"read-book","stars":1,"days":[]}]'::jsonb,'20000000-0000-4000-8000-000000005301')$$,'P0001','invalid_input','bad second item rolls back source links and task');
select is((select count(*)::int from public.task_templates),1,'no extra task after failures');
select set_config('test.reward',(public.save_setup_batch('60000000-0000-4000-8000-000000005302','reward','[{"title":"Birlikte kitap","icon":"reward-book","stars":20,"source_id":"40000000-0000-4000-8000-000000005301"}]')->>0),true);
select is(jsonb_array_length(public.get_setup_sources('reward',array[current_setting('test.reward')::uuid])),1,'reward has source');
select set_config('test.goal',(public.set_child_goal(current_setting('test.reward')::uuid,'20000000-0000-4000-8000-000000005301')).id::text,true);
select is(jsonb_array_length(public.get_setup_sources('goal',array[current_setting('test.goal')::uuid])),1,'goal resolves reward source');
select throws_ok($$select public.get_setup_sources('task',array_fill(gen_random_uuid(),array[101]))$$,'P0001','invalid_input','batch bounded');
select throws_ok($$select public.reserve_setup_generation(gen_random_uuid(),'10000000-0000-4000-8000-000000005301',auth.uid(),repeat('a',64),gen_random_uuid())$$,'42501',null,'client cannot reserve paid generation');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005302","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005302","role":"parent"}}',true);
select is(jsonb_array_length(public.get_setup_sources('task',array[current_setting('test.task')::uuid])),0,'other family sees no provenance');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005303","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005301","role":"device","device_id":"30000000-0000-4000-8000-000000005301","child_id":"20000000-0000-4000-8000-000000005301"}}',true);
select throws_ok($$select public.get_setup_sources('task',array[current_setting('test.task')::uuid])$$,'42501','forbidden','child cannot browse original documents');
select throws_ok($$select public.get_learning_source_access('40000000-0000-4000-8000-000000005301')$$,'42501','forbidden','child cannot sign original document');
reset role;
select is((select count(*)::int from public.learning_source_links),2,'one link per saved item despite replays and failures');
set local role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.expire_unlinked_learning_sources();
select is((select count(*)::int from public.learning_sources where id='40000000-0000-4000-8000-000000005301'),1,'cleanup retains linked old document');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000001')->>'ok','true','first worker reserves');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000001')->>'error','generation_in_progress','same request cannot start second paid worker');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('b',64),'80000000-0000-4000-8000-000000000001')->>'error','request_conflict','payload identity fixed');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000002')->>'error','generation_in_progress','new request rate limited');
select is(public.finish_setup_generation('70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000009','{"suggestions":[]}',false),false,'wrong lease cannot finish');
select is(public.finish_setup_generation('70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','{"suggestions":[]}',false),true,'valid lease commits');
select is(public.finish_setup_generation('70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','{"suggestions":[]}',false),false,'finished lease cannot overwrite');
select ok(public.reserve_setup_generation('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000001') ? 'cached','lost reply returns cached output');
update public.setup_ai_jobs set updated_at=now()-interval '25 seconds';
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000002')->>'ok','true','second request reserves after interval');
update public.setup_ai_jobs set updated_at=now()-interval '4 minutes' where id='70000000-0000-4000-8000-000000000002';
select is(public.finish_setup_generation('70000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000002','{"suggestions":[]}',false),false,'expired worker cannot write');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000002')->>'error','ai_result_uncertain','expired paid request not rerun');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000002')->>'error','ai_result_uncertain','unknown outcome remains fenced');
update public.setup_ai_jobs set updated_at=now()-interval '25 seconds' where status='done';
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000003')->>'ok','true','new explicit request allowed');
select is(public.finish_setup_generation('70000000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000003',null,true),true,'provider uncertainty recorded');
select is(public.reserve_setup_generation('70000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000005301','00000000-0000-4000-8000-000000005301',repeat('a',64),'80000000-0000-4000-8000-000000000003')->>'error','ai_result_uncertain','known uncertainty blocks replay');
reset role;select * from finish();rollback;
