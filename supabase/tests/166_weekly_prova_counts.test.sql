begin;select no_plan();
insert into auth.users(id,email) values
('a1660000-0000-4000-8000-000000000001','outcome-parent@example.invalid'),
('a1660000-0000-4000-8000-000000000002','outcome-device@example.invalid'),
('a1660000-0000-4000-8000-000000000003','outcome-outsider@example.invalid');
insert into public.families(id,name,created_by) values('b1660000-0000-4000-8000-000000000001','Outcomes','a1660000-0000-4000-8000-000000000001');
insert into public.family_members(family_id,user_id) values('b1660000-0000-4000-8000-000000000001','a1660000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values('c1660000-0000-4000-8000-000000000001','b1660000-0000-4000-8000-000000000001','A',3);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,provenance)
select ('e1660000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1660000-0000-4000-8000-000000000001',3,'Matematik','Toplama','open_ended','Question '||n,
case when n=8 then '{}'::jsonb else '{"outcome_ids":["M.3.A","M.3.B"],"curriculum_version":"test"}'::jsonb end from generate_series(1,8)n;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind)
select 'f1660000-0000-4000-8000-000000000001','b1660000-0000-4000-8000-000000000001','c1660000-0000-4000-8000-000000000001','Practice','Matematik',3,array_agg(id order by id),'assigned','level_test' from public.question_bank where family_id='b1660000-0000-4000-8000-000000000001';
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,finished_at) values('f1660000-0000-4000-8000-000000000011','b1660000-0000-4000-8000-000000000001','f1660000-0000-4000-8000-000000000001','c1660000-0000-4000-8000-000000000001','submitted',(date_trunc('week',now() at time zone 'Europe/Istanbul')-interval '3 days') at time zone 'Europe/Istanbul');
insert into public.exam_answers(attempt_id,question_id,answer_text,score)
select 'f1660000-0000-4000-8000-000000000011',('e1660000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=7 then null else 'My work' end,case when n<=5 then 120-n*20 else null end from generate_series(1,8)n;

insert into public.question_child_signals(family_id,attempt_id,question_id,liked,struggled) values
('b1660000-0000-4000-8000-000000000001','f1660000-0000-4000-8000-000000000011','e1660000-0000-4000-8000-000000000001',true,false),
('b1660000-0000-4000-8000-000000000001','f1660000-0000-4000-8000-000000000011','e1660000-0000-4000-8000-000000000006',false,true);
create function pg_temp.data() returns jsonb language sql as $$select public.get_weekly_summary_data('b1660000-0000-4000-8000-000000000001',date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7)$$;
select set_config('request.jwt.claims','{"sub":"a1660000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1660000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select is(pg_temp.data()->'children'->0->'prova','{"attempts":1,"scored":5,"partial":4,"pending":2,"blank":1,"repeated_observations":0,"liked":1,"struggled":1}'::jsonb,'only numeric attempt, answer state and voluntary signal counts');
select ok(pg_temp.data()::text not like '%My work%' and pg_temp.data()::text not like '%Question 1%' and pg_temp.data()::text not like '%e1660000%' and pg_temp.data()::text not like '%c1660000%','no answer, question stem or identifiers in provider payload');
select is(public.get_family_weekly_review()->'children'->0->'prova',pg_temp.data()->'children'->0->'prova','parent sees the same safe counts');
select throws_ok($$select gina.weekly_prova_counts('b1660000-0000-4000-8000-000000000001','c1660000-0000-4000-8000-000000000001',now()-interval '7 days',now())$$,'42501',null,'internal aggregation cannot be called directly');
reset role;
select set_config('request.jwt.claims','{"sub":"a1660000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1660000-0000-4000-8000-000000000003"}}',true);
set local role authenticated;
select throws_ok('select pg_temp.data()','42501','weekly_forbidden','foreign parent cannot read the counts');
reset role;set local role anon;
select throws_ok('select pg_temp.data()','42501',null,'anonymous denied');
reset role;select * from finish();rollback;
