-- Weekly timetable authorization, validation, atomicity and calendar projection.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-pet@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000e1d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-pet2@test.local', '', now(), '{}', '{}', now(), now());
insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000000e1', 'Aile P', '00000000-0000-0000-0000-00000000e101'),
  ('10000000-0000-0000-0000-0000000000e2', 'Aile Q', '00000000-0000-0000-0000-00000000e201');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e101'),
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000e201');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-00000000e1c1', '10000000-0000-0000-0000-0000000000e1', 'Çocuk P');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-00000000e1c1', '10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e1d1', '20000000-0000-0000-0000-00000000e1c1');


insert into public.children(id,family_id,name) values ('20000000-0000-0000-0000-00000000e1c2','10000000-0000-0000-0000-0000000000e1','Kardeş');
insert into public.events(family_id,child_id,title,starts_at) values('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1','Mevcut etkinlik',now());



create function pg_temp.day(n int default 0) returns date language sql as $$select (now() at time zone 'Europe/Istanbul')::date+n$$;
create function pg_temp.body() returns jsonb language sql as $$select jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','Birim kesir','planned_on',pg_temp.day(),'due_on',pg_temp.day(2),'time',null,'steps','[{"id":"00000000-0000-4000-8000-000000008901","label":"İki örnek çöz","checked":false}]'::jsonb,'done',false,'archived',false,'source_id',null)$$;
create function pg_temp.save(req uuid default '00000000-0000-4000-8000-000000008911',revision int default 0,body jsonb default pg_temp.body(),id uuid default '00000000-0000-4000-8000-000000008900',child uuid default '20000000-0000-0000-0000-00000000e1c1') returns jsonb language sql as $$select public.save_learning_plan(req,child,id,revision,body)$$;
create function pg_temp.read(child uuid default '20000000-0000-0000-0000-00000000e1c1',start_day date default pg_temp.day(),end_day date default pg_temp.day(7)) returns jsonb language sql as $$select public.get_learning_plan(child,start_day,end_day)$$;

insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,storage_consent,pages,created_at) values
('40000000-0000-4000-8000-000000009101','10000000-0000-0000-0000-0000000000e1','document','Ödev.pdf','application/pdf',100,repeat('a',64),'audit/import/source1','ready','v1',1,now()-interval '2 days'),
('40000000-0000-4000-8000-000000009102','10000000-0000-0000-0000-0000000000e2','document','Other.pdf','application/pdf',100,repeat('b',64),'audit/import/source2','ready','v1',1,now());
update public.children set grade=5 where id='20000000-0000-0000-0000-00000000e1c1';
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-0000-0000-0000000000e1','pro','test',now()+interval '1 day');
update public.app_settings set value='true' where key in ('ai.enabled','sources.enabled');
create function pg_temp.prepare(source uuid default '40000000-0000-4000-8000-000000009101',context jsonb default '{"config":{"model":"claude-sonnet-5-5","maxOutputTokens":4000,"promptVersion":"v1"},"system":"synthetic","schema":{}}') returns jsonb language sql as $$select public.prepare_learning_plan_import('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e101','20000000-0000-0000-0000-00000000e1c1',source,'tr',context)$$;
create function pg_temp.reserve(c uuid,lease uuid default '00000000-0000-4000-8000-000000009111') returns jsonb language sql as $$select public.reserve_learning_plan_import('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e101',c,lease)$$;
create function pg_temp.view() returns jsonb language sql as $$select public.get_learning_plan_import('20000000-0000-0000-0000-00000000e1c1','40000000-0000-4000-8000-000000009101','tr')$$;
create function pg_temp.items() returns jsonb language sql as $$select jsonb_build_array(jsonb_build_object('index',0,'id','00000000-0000-4000-8000-000000009121','content',pg_temp.body()||'{"source_id":"40000000-0000-4000-8000-000000009101"}'))$$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select pg_temp.prepare(context=>null)$$,'P0001','plan_import_context_needed','lookup cannot start a generation');
select throws_ok($$select pg_temp.prepare(source=>'40000000-0000-4000-8000-000000009102')$$,'P0001','source_not_ready','foreign document denied');
create temporary table context as select pg_temp.prepare() value;
select is(pg_temp.prepare(context=>'{"config":{},"system":"new","schema":{}}'),(select value from context),'saved context survives prompt/model change');
select is(pg_temp.prepare()#>>'{context,input,grade}','5','grade comes from child, not request');
select ok(pg_temp.prepare()::text !~ 'Çocuk P|Ödev.pdf|birth_date','private names excluded from model context');
reset role;
update public.app_settings set value='false' where key='sources.enabled';
set local role service_role;
select is(pg_temp.reserve((select (value->>'id')::uuid from context))->>'error','source_unavailable','source flag is checked at reservation');
reset role;
update public.app_settings set value='true' where key='sources.enabled';
update public.app_settings set value='false' where key='ai.enabled';
set local role service_role;
select is(pg_temp.reserve((select (value->>'id')::uuid from context))->>'error','ai_disabled','AI pause prevents paid call');
reset role;
update public.app_settings set value='true' where key='ai.enabled';
update public.ai_models set active=false where id='claude-sonnet-5-5';
set local role service_role;
select is(pg_temp.reserve((select (value->>'id')::uuid from context))->>'error','ai_model_unavailable','disabled original model is not replaced silently');
reset role;
update public.ai_models set active=true where id='claude-sonnet-5-5';
set local role service_role;
create temporary table job as select pg_temp.reserve((select (value->>'id')::uuid from context)) value;
select ok((select value ? 'id' from job),'paid job reserved once');
select is(pg_temp.reserve((select (value->>'id')::uuid from context))->>'error','generation_in_progress','parallel request does not start second generation');
select lives_ok($$select public.finish_ai_operation((select (value->>'id')::uuid from job),'00000000-0000-4000-8000-000000009111','{"output":{"items":[{"title":"Kesirler"},{"title":"Fen"}],"warnings":[]},"inputTokens":10,"outputTokens":8}')$$,'result stored');
select ok(pg_temp.reserve((select (value->>'id')::uuid from context)) ? 'cached','paid retry reuses result');
select is((select count(*)::int from public.prova_ai_usage where action='import'),1,'one usage row after replay');
select is((select input_tokens from public.prova_ai_usage where action='import'),10,'confirmed input token count retained');
select is((select items from public.prova_ai_usage where action='import'),2,'extracted items are not quota requests');
select is(public.expire_unlinked_learning_sources(),0,'recent import protects otherwise orphan source');
reset role;
grant select on context,job to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.view()->>'status','done','parent gets completed draft');
select ok(not(pg_temp.view() ? 'context'),'model internals stay private');
select throws_ok($$select pg_temp.prepare()$$,'42501',null,'client cannot forge paid context');
select throws_ok($$select * from gina.learning_plan_imports$$,'42501',null,'direct table access blocked');
create function pg_temp.apply(req uuid default '00000000-0000-4000-8000-000000009131',items jsonb default pg_temp.items()) returns jsonb language sql as $$select public.apply_learning_plan_import(req,'20000000-0000-0000-0000-00000000e1c1',(select (value->>'id')::uuid from context),items)$$;
select throws_ok($$select pg_temp.apply(items=>jsonb_set(pg_temp.items(),'{0,index}','9'))$$,'P0001','plan_import_invalid','invented source position rejected');
select throws_ok($$select pg_temp.apply(items=>jsonb_set(pg_temp.items(),'{0,content,source_id}','null'))$$,'P0001','source_not_ready','source cannot be stripped');
select throws_ok($$select pg_temp.apply(items=>pg_temp.items()||jsonb_build_array(jsonb_build_object('index',1,'id','00000000-0000-4000-8000-000000009122','content',pg_temp.body()||'{"title":"","source_id":"40000000-0000-4000-8000-000000009101"}')))$$,'P0001','plan_invalid','invalid second selection aborts entire batch');
select is(jsonb_array_length(pg_temp.read()->'items'),0,'first selection rolled back too');
select throws_ok($$select pg_temp.apply(items=>pg_temp.items()||pg_temp.items())$$,'P0001','plan_import_already_applied','repeated selection in one command rejected');
select is(jsonb_array_length(pg_temp.read()->'items'),0,'duplicate batch leaves no partial save');
create temporary table receipt as select pg_temp.apply() value;
select is(pg_temp.apply(),(select value from receipt),'same lost response returns same receipt');
select is(jsonb_array_length(pg_temp.read()->'items'),1,'retry creates only one plan');
select is(pg_temp.view()#>>'{applied,0}','00000000-0000-4000-8000-000000009121','selection marked applied');
select throws_ok($$select pg_temp.apply(req=>gen_random_uuid())$$,'P0001','plan_import_already_applied','another request cannot apply same selection');
select throws_ok($$select pg_temp.apply(items=>jsonb_set(pg_temp.items(),'{0,content,title}','"Other"'))$$,'P0001','request_conflict','receipt immutable');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.view()$$,'42501','plan_import_forbidden','child cannot read private extraction');
select throws_ok($$select pg_temp.apply()$$,'42501','plan_import_forbidden','child cannot apply extraction');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e2","role":"parent"}}',true);
select throws_ok($$select pg_temp.view()$$,'42501','plan_import_forbidden','other family cannot read extraction');
reset role;
update gina.learning_plan_imports set created_at=now()-interval '8 days';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.expire_unlinked_learning_sources(),0,'saved plan protects original even after draft retention');
reset role;
delete from public.learning_sources where id='40000000-0000-4000-8000-000000009101';
select is((select count(*)::int from gina.learning_plan_imports),0,'source deletion removes extraction');
select is((select count(*)::int from gina.learning_plan),1,'source deletion preserves parent-confirmed work');
select is((select source_id from gina.learning_plan),null,'deleted source unlinked');
select is((select status from public.ai_operation_jobs where id=(select (value->>'id')::uuid from job)),'uncertain','deleted source invalidates paid lease');
select is((select result from public.ai_operation_jobs where id=(select (value->>'id')::uuid from job)),null,'deleted source purges raw derived result');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.finish_ai_operation((select (value->>'id')::uuid from job),'00000000-0000-4000-8000-000000009111','{"output":{"resurrect":true}}')$$,'P0001','lease_lost','late response cannot restore deleted content');
select throws_ok($$select pg_temp.prepare(context=>null)$$,'P0001','source_not_ready','deleted source cannot restart production');
reset role;
select * from finish();
rollback;
