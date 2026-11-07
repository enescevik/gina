begin;
select plan(11);
insert into auth.users(id,email) values
('a1710000-0000-4000-8000-000000000001','daily-parent@example.invalid'),
('a1710000-0000-4000-8000-000000000002','daily-device@example.invalid');
insert into public.families(id,name,created_by,timezone) values
('b1710000-0000-4000-8000-000000000001','Daily','a1710000-0000-4000-8000-000000000001','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values
('b1710000-0000-4000-8000-000000000001','a1710000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values
('c1710000-0000-4000-8000-000000000001','b1710000-0000-4000-8000-000000000001','A',3),
('c1710000-0000-4000-8000-000000000002','b1710000-0000-4000-8000-000000000001','B',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('d1710000-0000-4000-8000-000000000001','b1710000-0000-4000-8000-000000000001','a1710000-0000-4000-8000-000000000002','c1710000-0000-4000-8000-000000000001');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem) values
('e1710000-0000-4000-8000-000000000001','b1710000-0000-4000-8000-000000000001',3,'Matematik','Toplama','open_ended','Question');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind,created_at)
select pg_temp_id::uuid,'b1710000-0000-4000-8000-000000000001','c1710000-0000-4000-8000-000000000001','Practice','Matematik',3,
array['e1710000-0000-4000-8000-000000000001']::uuid[],'assigned',kind,now()-interval '2 months'
from (values ('f1710000-0000-4000-8000-000000000001','practice'),('f1710000-0000-4000-8000-000000000002','practice'),('f1710000-0000-4000-8000-000000000003','level_test')) v(pg_temp_id,kind);

create function pg_temp.child() returns uuid language sql as $$select 'c1710000-0000-4000-8000-000000000001'::uuid$$;
create function pg_temp.exam() returns uuid language sql as $$select 'f1710000-0000-4000-8000-000000000001'::uuid$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1710000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1710000-0000-4000-8000-000000000001"}}',true);
select throws_ok($$select public.pin_daily_practice('f1710000-0000-4000-8000-000000000003')$$,'22023','daily_practice_ineligible','formal test rejected');
select is(public.pin_daily_practice(pg_temp.exam()),pg_temp.exam(),'parent highlights existing assignment');
select is(public.pin_daily_practice(pg_temp.exam()),pg_temp.exam(),'repeat pin is idempotent before attempt');
select throws_ok($$select public.pin_daily_practice('f1710000-0000-4000-8000-000000000002')$$,'23505','daily_practice_slot_unavailable','only one per child and local day');
select throws_ok('select * from gina.daily_practice_slots','42501',null,'no direct read');
select set_config('request.jwt.claims','{"sub":"a1710000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1710000-0000-4000-8000-000000000001","child_id":"c1710000-0000-4000-8000-000000000002"}}',true);
select is(public.get_daily_practice(pg_temp.child()),null::uuid,'sibling device cannot read');
select throws_ok('select public.pin_daily_practice(pg_temp.exam())','42501','forbidden','device cannot pin');
select set_config('request.jwt.claims','{"sub":"a1710000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1710000-0000-4000-8000-000000000001","child_id":"c1710000-0000-4000-8000-000000000001"}}',true);
select is(public.get_daily_practice(pg_temp.child()),pg_temp.exam(),'assigned device sees the question');
reset role;
with minute as (select extract(hour from now() at time zone 'Europe/Istanbul')::int*60+extract(minute from now() at time zone 'Europe/Istanbul')::int as value)
update public.children set evening_reminder_start=minute.value,evening_reminder_end=(minute.value+60)%1440 from minute where id=pg_temp.child();
set local role authenticated;
select is(public.get_daily_practice(pg_temp.child()),null::uuid,'quiet window hides the invitation');
reset role;
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
('f1710000-0000-4000-8000-000000000011','b1710000-0000-4000-8000-000000000001',pg_temp.exam(),pg_temp.child());
insert into public.exam_answers(attempt_id,question_id,answer_text) values
('f1710000-0000-4000-8000-000000000011','e1710000-0000-4000-8000-000000000001','Work');
update public.exam_attempts set status='submitted',finished_at=now() where id='f1710000-0000-4000-8000-000000000011';
select is((select count(*) from public.child_badge_awards where child_id=pg_temp.child() and badge_slug='daily-practice-first'),1::bigint,'submitted work earns one badge');
update public.exam_attempts set status='graded' where id='f1710000-0000-4000-8000-000000000011';
select is((select count(*) from public.child_badge_awards where child_id=pg_temp.child() and badge_slug='daily-practice-first'),1::bigint,'grading cannot award it again');
select * from finish();
rollback;
