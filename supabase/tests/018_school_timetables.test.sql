-- Weekly timetable authorization, validation, atomicity and calendar projection.
begin;
select plan(17);

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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is(public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',0,'[{"id":"one","day":1,"title":"Matematik","start":"09:00","end":"09:40"}]','{"start":"09:00","duration":40,"break":10}'),1,'child saves own timetable');
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c2',0,'[]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_forbidden','child cannot edit sibling');
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',0,'[]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_conflict','stale revision cannot overwrite');
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',1,'[{"id":"a","day":1,"title":"A","start":"09:00","end":"09:40"},{"id":"b","day":1,"title":"B","start":"09:30","end":"10:00"}]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_overlap','overlap rejected');
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',1,'[{"id":"a","day":1,"title":"A","start":"25:00","end":"09:40"}]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_invalid','invalid clock rejected');
select is((select revision from public.school_timetables where child_id='20000000-0000-0000-0000-00000000e1c1'),1,'failed writes are atomic');
select is((select count(*)::int from public.events where timetable_entry_key is not null),1,'one calendar event projected');
select is((select rrule from public.events where timetable_entry_key='one'),'FREQ=WEEKLY;BYDAY=MO','weekly calendar recurrence');
select is((select (starts_at at time zone 'Europe/Istanbul')::time::text from public.events where timetable_entry_key='one'),'09:00:00','family timezone preserved');
select throws_ok($$ update public.school_timetables set revision=99 $$,'42501',null,'direct writes forbidden');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',1,'[]','{"start":"09:00","duration":40,"break":10}'),2,'parent edits same plan');
select is((select count(*)::int from public.events where child_id='20000000-0000-0000-0000-00000000e1c1'),1,'manual event survives removal of plan entries');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e2","role":"parent"}}',true);
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',2,'[]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_forbidden','other family denied');
select is((select count(*)::int from public.school_timetables),0,'other family cannot read plan');
reset role;
update public.devices set revoked_at=now() where id='30000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',2,'[]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_forbidden','revoked device cannot save');
select is((select count(*)::int from public.school_timetables),0,'revoked device cannot read');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1"}}',true);
select throws_ok($$ select public.save_school_timetable('20000000-0000-0000-0000-00000000e1c1',2,'[]','{"start":"09:00","duration":40,"break":10}') $$,'P0001','timetable_forbidden','missing role fails closed');
reset role;
select * from finish();
rollback;
