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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(jsonb_array_length(pg_temp.read()->'items'),0,'empty list does not invent homework');
select throws_ok($$select pg_temp.read(start_day=>'infinity')$$,'P0001','plan_range','infinite range rejected');
select throws_ok($$select pg_temp.read(end_day=>pg_temp.day(94))$$,'P0001','plan_range','unbounded range rejected');
select throws_ok($$select pg_temp.save(body=>null)$$,'P0001','plan_invalid','null body rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"stars":5}')$$,'P0001','plan_invalid','reward field rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"title":" "}')$$,'P0001','plan_invalid','blank title rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"time":"24:00"}')$$,'P0001','plan_invalid','invalid time rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"done":"true"}')$$,'P0001','plan_invalid','string boolean rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"kind":null}')$$,'P0001','plan_invalid','null kind rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||jsonb_build_object('due_on',pg_temp.day(-1)))$$,'P0001','plan_invalid','deadline cannot precede planned day');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||jsonb_build_object('planned_on',pg_temp.day(-31)))$$,'P0001','plan_date','new plan cannot rewrite old history');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||jsonb_build_object('due_on',pg_temp.day(366)))$$,'P0001','plan_date','new deadline bounded');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||jsonb_build_object('steps',(pg_temp.body()->'steps')||(pg_temp.body()->'steps')))$$,'P0001','plan_invalid','duplicate step ids rejected');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"done":true}')$$,'P0001','plan_invalid','new plan cannot fabricate completion');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"source_id":"00000000-0000-4000-8000-000000009999"}')$$,'P0001','source_not_ready','unknown private document rejected');
select is(pg_temp.save()->>'revision','1','parent creates one dated plan');
select is(pg_temp.save()->>'revision','1','lost reply returns same receipt');
select is(jsonb_array_length(pg_temp.read()->'items'),1,'replay does not duplicate plan');
select is(public.get_learning_plan_item('20000000-0000-0000-0000-00000000e1c1','00000000-0000-4000-8000-000000008900')->>'revision','1','detail read independent of visible calendar range');
select is(public.get_learning_plan_item('20000000-0000-0000-0000-00000000e1c2','00000000-0000-4000-8000-000000008900'),null,'detail cannot mix a sibling item and target child');
select throws_ok($$select pg_temp.save(body=>pg_temp.body()||'{"title":"Başka"}')$$,'P0001','request_conflict','command body immutable');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid())$$,'P0001','plan_changed','stale revision cannot overwrite');
select throws_ok($$select * from gina.learning_plan$$,'42501',null,'direct reads forbidden');
select is(jsonb_array_length(pg_temp.read(start_day=>pg_temp.day(40),end_day=>pg_temp.day(41))->'items'),1,'unfinished work stays visible long after deadline');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is(pg_temp.read()#>>'{items,0,content,title}','Kesirler','active child sees own plan');
select throws_ok($$select public.get_learning_plan_item('20000000-0000-0000-0000-00000000e1c2','00000000-0000-4000-8000-000000008900')$$,'42501','plan_forbidden','child detail access cannot target sibling');
select throws_ok($$select pg_temp.read(child=>'20000000-0000-0000-0000-00000000e1c2')$$,'42501','plan_forbidden','sibling plan denied');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),id=>gen_random_uuid())$$,'42501','plan_parent_required','child cannot create');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>1,body=>pg_temp.body()||'{"title":"New"}')$$,'42501','plan_parent_required','child cannot change assignment');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>1,body=>pg_temp.body()||'{"steps":[]}')$$,'42501','plan_parent_required','child cannot remove steps');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>1,body=>pg_temp.body()||'{"archived":true}')$$,'42501','plan_parent_required','child cannot archive');
select is(pg_temp.save(req=>'00000000-0000-4000-8000-000000008912',revision=>1,body=>jsonb_set(pg_temp.body(),'{steps,0,checked}','true'))->>'revision','2','child checks a small step');
select is(pg_temp.read()#>>'{items,0,content,done}','false','last step does not complete whole plan automatically');
select is(pg_temp.save(req=>'00000000-0000-4000-8000-000000008913',revision=>2,body=>jsonb_set(pg_temp.body(),'{steps,0,checked}','true')||'{"done":true}')->>'revision','3','child explicitly marks completion');
select isnt(pg_temp.read()#>>'{items,0,done_at}',null,'completion timestamp retained');
select is(jsonb_array_length(pg_temp.read(start_day=>pg_temp.day(40),end_day=>pg_temp.day(41))->'items'),0,'completed item no longer spills into future');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);

savepoint completed_history;
reset role;
update gina.learning_plan set content=content||jsonb_build_object('planned_on',pg_temp.day(-40),'due_on',null,'done',true),done_at=now();
set local role authenticated;
select is(jsonb_array_length(pg_temp.read()->'items'),1,'old homework completed today stays in current history');
reset role;
update gina.learning_plan set content=content||'{"done":false,"archived":true}',done_at=null,updated_at=now();
set local role authenticated;
select is(jsonb_array_length(pg_temp.read()->'items'),1,'old homework archived today stays in current history');
reset role;
rollback to completed_history;
savepoint source_checks;
reset role;
insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,storage_consent,pages) values
('40000000-0000-4000-8000-000000008901','10000000-0000-0000-0000-0000000000e1','document','Ödev.pdf','application/pdf',100,repeat('a',64),'audit/plan/source1','ready','v1',1),
('40000000-0000-4000-8000-000000008902','10000000-0000-0000-0000-0000000000e2','document','Other.pdf','application/pdf',100,repeat('b',64),'audit/plan/source2','ready','v1',1);
set local role authenticated;
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>3,body=>pg_temp.body()||'{"source_id":"40000000-0000-4000-8000-000000008902"}')$$,'P0001','source_not_ready','other family private source cannot be linked');
select is(pg_temp.save(req=>gen_random_uuid(),revision=>3,body=>pg_temp.body()||'{"source_id":"40000000-0000-4000-8000-000000008901"}')->>'revision','4','own saved document can be linked without AI');
select is(pg_temp.read()#>>'{items,0,source,name}','Ödev.pdf','parent can view linked document metadata');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is(pg_temp.read()#>'{items,0,source}','null'::jsonb,'private document metadata not exposed to child');
reset role;
delete from public.learning_sources where id='40000000-0000-4000-8000-000000008901';
set local role authenticated;
select is(pg_temp.read()#>'{items,0,content,source_id}','null'::jsonb,'source deletion clears link');
select is(pg_temp.read()#>>'{items,0,content,title}','Kesirler','source deletion preserves planned work');
reset role;
rollback to source_checks;
select is(pg_temp.save()->>'revision','1','old parent receipt remains exact after child edit');
select is(pg_temp.read()#>>'{items,0,revision}','3','old receipt does not undo child progress');
select is(pg_temp.save(req=>gen_random_uuid(),revision=>3,body=>pg_temp.body()||'{"archived":true}')->>'revision','4','parent can archive without deletion');
savepoint quota_check;
reset role;
insert into gina.learning_plan(id,child_id,revision,content) select gen_random_uuid(),'20000000-0000-0000-0000-00000000e1c1',1,pg_temp.body()-'source_id' from generate_series(1,100);
set local role authenticated;
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),id=>gen_random_uuid())$$,'P0001','plan_limit','100-open-plan limit enforced');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>4)$$,'P0001','plan_limit','reopening archived work cannot bypass limit');
reset role;
rollback to quota_check;
reset role;
select is((select count(*)::int from public.task_templates),0,'learning plan never creates recurring tasks');
select is((select count(*)::int from public.star_events),0,'learning plan never awards stars');
select is((select count(*)::int from public.events),1,'existing calendar event untouched');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e2","role":"parent"}}',true);
select throws_ok($$select pg_temp.read()$$,'42501','plan_forbidden','other family read denied');
select throws_ok($$select pg_temp.save()$$,'42501','plan_forbidden','other family replay denied');
reset role;
update public.devices set revoked_at=now() where id='30000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.read()$$,'42501','plan_forbidden','revoked device denied');
reset role;
delete from public.children where id='20000000-0000-0000-0000-00000000e1c1';
select is((select count(*)::int from gina.learning_plan),0,'child deletion removes learning plan');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select throws_ok($$select pg_temp.save()$$,'42501','plan_forbidden','deleted child receipt inaccessible');
reset role;set local role anon;
select throws_ok($$select pg_temp.read()$$,'42501',null,'anonymous cannot read');
reset role;
select * from finish();
rollback;
