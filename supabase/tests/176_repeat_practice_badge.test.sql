begin;
select plan(7);
insert into auth.users(id,email) values
('a1760000-0000-4000-8000-000000000001','daily-parent@example.invalid'),
('a1760000-0000-4000-8000-000000000002','daily-device@example.invalid');
insert into public.families(id,name,created_by,timezone) values
('b1760000-0000-4000-8000-000000000001','Daily','a1760000-0000-4000-8000-000000000001','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values
('b1760000-0000-4000-8000-000000000001','a1760000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values
('c1760000-0000-4000-8000-000000000001','b1760000-0000-4000-8000-000000000001','A',3),
('c1760000-0000-4000-8000-000000000002','b1760000-0000-4000-8000-000000000001','B',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('d1760000-0000-4000-8000-000000000001','b1760000-0000-4000-8000-000000000001','a1760000-0000-4000-8000-000000000002','c1760000-0000-4000-8000-000000000001');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem) values
('e1760000-0000-4000-8000-000000000001','b1760000-0000-4000-8000-000000000001',3,'Matematik','Toplama','open_ended','Question');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind,created_at)
select pg_temp_id::uuid,'b1760000-0000-4000-8000-000000000001',case when pg_temp_id like '%000004' then 'c1760000-0000-4000-8000-000000000002'::uuid else 'c1760000-0000-4000-8000-000000000001'::uuid end,'Practice','Matematik',3,
array['e1760000-0000-4000-8000-000000000001']::uuid[],'assigned',kind,now()-interval '2 months'
from (values ('f1760000-0000-4000-8000-000000000001','practice'),('f1760000-0000-4000-8000-000000000002','practice'),('f1760000-0000-4000-8000-000000000003','practice'),('f1760000-0000-4000-8000-000000000004','practice'),('f1760000-0000-4000-8000-000000000005','practice')) v(pg_temp_id,kind);

create function pg_temp.submit(i integer, at_time timestamptz, work text) returns void language plpgsql as $$
declare
  attempt uuid := ('f1760000-0000-4000-8000-' || lpad((i+10)::text,12,'0'))::uuid;
  exam uuid := ('f1760000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
begin
  insert into public.exam_attempts(id,family_id,exam_id,child_id)
  select attempt,family_id,id,child_id from public.exams where id=exam;
  insert into public.exam_answers(attempt_id,question_id,answer_text)
  values(attempt,'e1760000-0000-4000-8000-000000000001',work);
  update public.exam_attempts set status='submitted',finished_at=at_time where id=attempt;
end;
$$;
create function pg_temp.awards() returns bigint language sql as $$
  select count(*) from public.child_badge_awards where badge_slug='practice-return';
$$;
select pg_temp.submit(1,'2026-10-01 21:01+00','First answer');
select is(pg_temp.awards(),0::bigint,'first practice does not earn a return badge');
select pg_temp.submit(2,'2026-10-02 20:59+00','Same Istanbul date');
select is(pg_temp.awards(),0::bigint,'same family local day does not count');
select pg_temp.submit(3,'2026-10-02 21:00+00','   ');
select is(pg_temp.awards(),0::bigint,'blank answer does not count');
select pg_temp.submit(4,'2026-10-02 21:02+00','Sibling answer');
select is(pg_temp.awards(),0::bigint,'sibling cannot borrow an earlier answer');
select pg_temp.submit(5,'2026-10-02 21:03+00','Returned to the same question');
select is(pg_temp.awards(),1::bigint,'answered return across family midnight earns one badge');
update public.exam_attempts set status='graded' where id='f1760000-0000-4000-8000-000000000015';
select is(pg_temp.awards(),1::bigint,'grading does not award a duplicate');
select ok(not has_function_privilege('authenticated','gina.award_repeat_practice_badge()','execute'),'clients cannot call reward trigger');
select * from finish();
rollback;
