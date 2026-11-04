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


create function pg_temp.day(offset_days int default 0) returns date language sql as $$select (now() at time zone 'Europe/Istanbul')::date+offset_days$$;
create function pg_temp.items() returns jsonb language sql as $$select '[{"id":"00000000-0000-4000-8000-000000008701","label":"Matematik defterim","checked":false},{"id":"00000000-0000-4000-8000-000000008702","label":"Kalemliğim","checked":true}]'::jsonb$$;
create function pg_temp.read(day date default pg_temp.day(),child uuid default '20000000-0000-0000-0000-00000000e1c1') returns jsonb language sql as $$select public.get_school_bag(child,day)$$;
create function pg_temp.save(req uuid default '00000000-0000-4000-8000-000000008711',revision int default 0,program int default 1,items jsonb default pg_temp.items(),day date default pg_temp.day(),child uuid default '20000000-0000-0000-0000-00000000e1c1') returns jsonb language sql as $$select public.save_school_bag(req,child,day,revision,program,items)$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.read()->>'revision','0','missing checklist is an editable empty list');
select is(jsonb_array_length(pg_temp.read()->'items'),0,'no invented materials from subject names');
select is(pg_temp.read()->>'editable','true','today is editable in family timezone');
select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',0,jsonb_build_array(jsonb_build_object('id','one','day',extract(isodow from pg_temp.day())::int,'title','Matematik','start','09:00','end','09:40')),'{"start":"09:00","duration":40,"break":10}');
select is(pg_temp.read()#>>'{lessons,0,title}','Matematik','selected weekday lessons are contextual only');
select is(jsonb_array_length(pg_temp.read(pg_temp.day(1))->'lessons'),0,'other weekday is not copied');
select throws_ok($$select pg_temp.read(pg_temp.day(8))$$,'P0001','bag_date','beyond next week rejected');
select throws_ok($$select pg_temp.read(pg_temp.day(-31))$$,'P0001','bag_date','history limited to 30 days');
select throws_ok($$select pg_temp.read('infinity')$$,'P0001','bag_date','infinite day rejected');
select throws_ok($$select pg_temp.save(program=>0)$$,'P0001','bag_program_changed','old timetable revision rejected');
select throws_ok($$select pg_temp.save(items=>null)$$,'P0001','bag_invalid','null items rejected');
select throws_ok($$select pg_temp.save(items=>'{}')$$,'P0001','bag_invalid','non-list rejected');
select throws_ok($$select pg_temp.save(items=>pg_temp.items()||pg_temp.items())$$,'P0001','bag_invalid','duplicate item ids rejected');
select throws_ok($$select pg_temp.save(items=>jsonb_set(pg_temp.items(),'{0,label}','"Kalemliğim"'))$$,'P0001','bag_invalid','duplicate labels rejected');
select throws_ok($$select pg_temp.save(items=>jsonb_set(pg_temp.items(),'{0,label}','" "'))$$,'P0001','bag_invalid','blank label rejected');
select throws_ok($$select pg_temp.save(items=>jsonb_set(pg_temp.items(),'{0,checked}','"true"'))$$,'P0001','bag_invalid','string is not a checked state');
select throws_ok($$select pg_temp.save(items=>jsonb_set(pg_temp.items(),'{0,points}','5'))$$,'P0001','bag_invalid','reward field cannot be injected');
select throws_ok($$select pg_temp.save(items=>jsonb_set(pg_temp.items(),'{0,id}','"wrong"'))$$,'P0001','bag_invalid','invalid item identity rejected');
select throws_ok($$select pg_temp.save(day=>pg_temp.day(-1))$$,'P0001','bag_date','past day cannot be rewritten');
select throws_ok($$select pg_temp.save(day=>pg_temp.day(8))$$,'P0001','bag_date','future bound enforced for writes');
select is(pg_temp.read()->>'revision','0','invalid batch leaves no list');
select is(pg_temp.save()->>'revision','1','parent saves first list');
select is(pg_temp.save()->>'request','00000000-0000-4000-8000-000000008711','lost reply recovers exact receipt');
select is(jsonb_array_length(pg_temp.read()->'items'),2,'replay does not duplicate items');
select throws_ok($$select pg_temp.save(items=>'[]')$$,'P0001','request_conflict','same request cannot clear list');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid())$$,'P0001','bag_changed','stale list cannot overwrite');
select throws_ok($$select * from gina.school_bags$$,'42501',null,'raw list not directly accessible');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is(pg_temp.read()#>>'{items,0,label}','Matematik defterim','active child reads own family checklist');
select is(pg_temp.save(req=>'00000000-0000-4000-8000-000000008712',revision=>1,items=>jsonb_set(pg_temp.items(),'{0,checked}','true'))->>'revision','2','child can check own list');
select throws_ok($$select pg_temp.read(child=>'20000000-0000-0000-0000-00000000e1c2')$$,'42501','bag_forbidden','child cannot read sibling list');
select throws_ok($$select pg_temp.save(child=>'20000000-0000-0000-0000-00000000e1c2')$$,'42501','bag_forbidden','child cannot save sibling list');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.save()->>'revision','1','old receipt stays exact after child edit');
select is(pg_temp.read()#>>'{items,0,checked}','true','old receipt does not undo child check');
select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',1,'[]','{"start":"09:00","duration":40,"break":10}');
select is(pg_temp.read()->>'program_revision','2','current timetable revision visible');
select is(pg_temp.read()->>'saved_program_revision','1','list records the version it was checked against');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>2)$$,'P0001','bag_program_changed','program change must be acknowledged with current version');
reset role;
savepoint historical;
update gina.school_bags set day=pg_temp.day(-1);
set local role authenticated;
select is(pg_temp.read(pg_temp.day(-1))->>'editable','false','history is read only');
select is(pg_temp.read(pg_temp.day(-1))#>>'{lessons,0,title}','Matematik','historical lessons keep the saved snapshot');
reset role;
rollback to historical;
select is((select count(*)::int from public.task_templates),0,'packing does not create tasks');
select is((select count(*)::int from public.events),1,'packing never creates calendar events');
set local role authenticated;
select is(pg_temp.save(req=>gen_random_uuid(),revision=>2,program=>2,items=>'[]')->>'revision','3','explicit empty list removes items safely');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e2","role":"parent"}}',true);
select throws_ok($$select pg_temp.read()$$,'42501','bag_forbidden','other family cannot read');
select throws_ok($$select pg_temp.save()$$,'42501','bag_forbidden','other family cannot recover receipt');
reset role;
update public.devices set revoked_at=now() where id='30000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.read()$$,'42501','bag_forbidden','revoked device cannot read');
select throws_ok($$select pg_temp.save(req=>'00000000-0000-4000-8000-000000008712',revision=>1,items=>jsonb_set(pg_temp.items(),'{0,checked}','true'))$$,'42501','bag_forbidden','revoked device cannot replay');
reset role;
delete from public.children where id='20000000-0000-0000-0000-00000000e1c1';
select is((select count(*)::int from gina.school_bags),0,'child deletion cascades to bag');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select throws_ok($$select pg_temp.save()$$,'42501','bag_forbidden','deleted child receipt is inaccessible');
reset role;
set local role anon;
select throws_ok($$select pg_temp.read()$$,'42501',null,'anonymous reads forbidden');
reset role;
select * from finish();
rollback;
