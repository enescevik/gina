begin;select no_plan();
insert into auth.users(id,email) values
('a1640000-0000-4000-8000-000000000001','outcome-parent@example.invalid'),
('a1640000-0000-4000-8000-000000000002','outcome-device@example.invalid'),
('a1640000-0000-4000-8000-000000000003','outcome-outsider@example.invalid');
insert into public.families(id,name,created_by) values('b1640000-0000-4000-8000-000000000001','Outcomes','a1640000-0000-4000-8000-000000000001');
insert into public.family_members(family_id,user_id) values('b1640000-0000-4000-8000-000000000001','a1640000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values('c1640000-0000-4000-8000-000000000001','b1640000-0000-4000-8000-000000000001','A',3);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,provenance)
select ('e1640000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1640000-0000-4000-8000-000000000001',3,'Matematik','Toplama','open_ended','Question '||n,
case when n=8 then '{}'::jsonb else '{"outcome_ids":["M.3.A","M.3.B"],"curriculum_version":"test"}'::jsonb end from generate_series(1,8)n;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind)
select 'f1640000-0000-4000-8000-000000000001','b1640000-0000-4000-8000-000000000001','c1640000-0000-4000-8000-000000000001','Practice','Matematik',3,array_agg(id order by id),'assigned','level_test' from public.question_bank where family_id='b1640000-0000-4000-8000-000000000001';
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,finished_at) values('f1640000-0000-4000-8000-000000000011','b1640000-0000-4000-8000-000000000001','f1640000-0000-4000-8000-000000000001','c1640000-0000-4000-8000-000000000001','submitted',now());
insert into public.exam_answers(attempt_id,question_id,answer_text,score)
select 'f1640000-0000-4000-8000-000000000011',('e1640000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=7 then null else 'My work' end,case when n<=5 then 120-n*20 else null end from generate_series(1,8)n;
select isnt(gina.reinforcement_scope(q),gina.reinforcement_scope(jsonb_populate_record(q,jsonb_build_object('provenance','{"outcome_ids":["M.3.A","M.3.C"],"curriculum_version":"test"}'::jsonb))),'same first outcome does not merge different full sets') from public.question_bank q where id='e1640000-0000-4000-8000-000000000001';
select is(gina.reinforcement_scope(q),gina.reinforcement_scope(jsonb_populate_record(q,jsonb_build_object('provenance','{"outcome_ids":["M.3.B","M.3.A","M.3.A"],"curriculum_version":"test"}'::jsonb))),'order and duplicate labels do not change scope') from public.question_bank q where id='e1640000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a1640000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1640000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select is(jsonb_array_length(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')),1,'one joint outcome set, missing labels not guessed');
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->>'mean_points','60.0','partial scores averaged, pending and blank excluded');
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->>'scored','5','five distinct scored questions');
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->>'pending','1','pending is not zero');
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->>'blank','1','blank not counted as zero');
select is(jsonb_array_length(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001',30,'Fen')),0,'subject filter respected');
select is(jsonb_array_length(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001',30,null,null,'unknown')),1,'unknown education period matches original report semantics');
reset role;
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,finished_at) values('f1640000-0000-4000-8000-000000000012','b1640000-0000-4000-8000-000000000001','f1640000-0000-4000-8000-000000000001','c1640000-0000-4000-8000-000000000001','submitted',now()+interval '1 second');
insert into public.exam_answers(attempt_id,question_id,answer_text,score) values('f1640000-0000-4000-8000-000000000012','e1640000-0000-4000-8000-000000000001','New work',100);
set local role authenticated;
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->>'scored','1','latest unanswered repetitions do not inflate independent evidence');
reset role;
-- Remove retry fixture so the independent-sample threshold test isolates the original attempt.
delete from public.exam_attempts where id='f1640000-0000-4000-8000-000000000012';
update public.exam_answers set score=null where question_id='e1640000-0000-4000-8000-000000000005';
set local role authenticated;
select is(public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')->0->'mean_points','null'::jsonb,'insufficient independent observations suppress numeric heat');
reset role;
select set_config('request.jwt.claims','{"sub":"a1640000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1640000-0000-4000-8000-000000000003"}}',true);
set local role authenticated;
select throws_ok($$select public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')$$,'42501',null,'foreign family denied');
reset role;
select set_config('request.jwt.claims','{"sub":"a1640000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1640000-0000-4000-8000-000000000001","child_id":"c1640000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select throws_ok($$select public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')$$,'42501',null,'children have no comparison or outcome endpoint');
reset role;set local role anon;
select throws_ok($$select public.learning_outcome_observations('c1640000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous denied');
reset role;select * from finish();rollback;
