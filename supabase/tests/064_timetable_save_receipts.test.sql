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

create function pg_temp.lessons() returns jsonb language sql as $$select '[{"id":"one","day":1,"title":"Matematik","start":"09:00","end":"09:40"}]'::jsonb$$;
create function pg_temp.settings() returns jsonb language sql as $$select '{"start":"09:00","duration":40,"break":10}'::jsonb$$;
create function pg_temp.save(req uuid default '00000000-0000-4000-8000-000000006401',revision int default 0,lessons jsonb default pg_temp.lessons(),settings jsonb default pg_temp.settings(),child uuid default '20000000-0000-0000-0000-00000000e1c1') returns jsonb language sql as $$select public.save_school_timetable_request(req,child,revision,lessons,settings)$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.save()->>'revision','1','parent saves first revision');
select is(pg_temp.save()->>'request','00000000-0000-4000-8000-000000006401','receipt carries exact request');
select is(pg_temp.save()->>'child_id','20000000-0000-0000-0000-00000000e1c1','receipt binds child');
select is((select revision from public.school_timetables),1,'lost reply does not add a revision');
select is((select count(*)::int from public.events where timetable_entry_key is not null),1,'lost reply does not duplicate calendar lessons');
select throws_ok($$select pg_temp.save(lessons=>'[]')$$,'P0001','request_conflict','same command cannot change payload');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid())$$,'P0001','timetable_conflict','new key cannot overwrite a stale revision');
select throws_ok($$select pg_temp.save(req=>null,revision=>1)$$,'P0001','invalid_input','request key required');
select throws_ok($$select pg_temp.save(revision=>null)$$,'P0001','timetable_invalid','revision required');
select throws_ok($$select pg_temp.save(revision=>-1)$$,'P0001','timetable_invalid','negative revision rejected');
select throws_ok($$select pg_temp.save(lessons=>'null')$$,'P0001','timetable_invalid','null lessons rejected');
select throws_ok($$select pg_temp.save(lessons=>'{}')$$,'P0001','timetable_invalid','object cannot substitute list');
select throws_ok($$select pg_temp.save(lessons=>jsonb_set(pg_temp.lessons(),'{0,title}','12'))$$,'P0001','timetable_invalid','numeric title rejected');
select throws_ok($$select pg_temp.save(lessons=>jsonb_set(pg_temp.lessons(),'{0,day}','"1"'))$$,'P0001','timetable_invalid','string weekday rejected');
select throws_ok($$select pg_temp.save(lessons=>jsonb_set(pg_temp.lessons(),'{0,hidden}','true'))$$,'P0001','timetable_invalid','extra fields rejected');
select throws_ok($$select pg_temp.save(settings=>pg_temp.settings()||'{"timezone":"UTC"}')$$,'P0001','timetable_invalid','unowned timezone not silently persisted');
select throws_ok($$select pg_temp.save(settings=>jsonb_set(pg_temp.settings(),'{duration}','"40"'))$$,'P0001','timetable_invalid','string settings rejected');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>1,settings=>jsonb_set(pg_temp.settings(),'{duration}','40.5'))$$,'P0001','timetable_invalid','fractional duration rejected by canonical save');
select throws_ok($$select pg_temp.save(req=>gen_random_uuid(),revision=>1,lessons=>pg_temp.lessons()||jsonb_set(pg_temp.lessons(),'{0,id}','"two"'))$$,'P0001','timetable_overlap','overlap still atomically rejected');
select is((select revision from public.school_timetables),1,'invalid commands do not mutate program');
reset role;
select is((select count(*)::int from public.help_receipts where result ? 'child_id'),1,'failed commands leave no receipt');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is(pg_temp.save(req=>'00000000-0000-4000-8000-000000006402',revision=>1,lessons=>'[]')->>'revision','2','child can replace own timetable');
select is(pg_temp.save(req=>'00000000-0000-4000-8000-000000006402',revision=>1,lessons=>'[]')->>'revision','2','child recovers same receipt');
select throws_ok($$select pg_temp.save(child=>'20000000-0000-0000-0000-00000000e1c2')$$,'42501','timetable_forbidden','child cannot save sibling');
select is((select count(*)::int from public.events),1,'manual event preserved when lessons removed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.save()->>'revision','1','old parent receipt remains exact after child update');
select is((select revision from public.school_timetables),2,'old receipt never restores old program');
select is((select jsonb_array_length(lessons) from public.school_timetables),0,'child removal is not undone by replay');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e2","role":"parent"}}',true);
select throws_ok($$select pg_temp.save()$$,'42501','timetable_forbidden','other family cannot recover receipt');
reset role;
savepoint revoked_parent;
delete from public.family_members where user_id='00000000-0000-0000-0000-00000000e101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select throws_ok($$select pg_temp.save()$$,'42501','timetable_forbidden','removed parent cannot recover old receipt');
reset role;
rollback to revoked_parent;
update public.devices set revoked_at=now() where id='30000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.save(req=>'00000000-0000-4000-8000-000000006402',revision=>1,lessons=>'[]')$$,'42501','timetable_forbidden','revoked device cannot replay receipt');
reset role;
delete from public.children where id='20000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select throws_ok($$select pg_temp.save()$$,'42501','timetable_forbidden','deleted child receipt cannot be recovered');
reset role;
set local role anon;
select throws_ok($$select pg_temp.save()$$,'42501',null,'anonymous caller denied');
reset role;
select * from finish();
rollback;
