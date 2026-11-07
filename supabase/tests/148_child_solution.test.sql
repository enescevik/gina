-- Solution is a post-review learning surface, never an active-exam answer oracle.
begin;select no_plan();
insert into auth.users(id,email) values
('a1480000-0000-4000-8000-000000000001','solution-parent@example.invalid'),
('a1480000-0000-4000-8000-000000000002','solution-device@example.invalid'),
('a1480000-0000-4000-8000-000000000003','solution-outsider@example.invalid');
insert into public.families(id,name,created_by) values('b1480000-0000-4000-8000-000000000001','Solution','a1480000-0000-4000-8000-000000000001');
insert into public.family_members(family_id,user_id) values('b1480000-0000-4000-8000-000000000001','a1480000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values('c1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001','A',3),('c1480000-0000-4000-8000-000000000002','b1480000-0000-4000-8000-000000000001','B',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('d1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001','a1480000-0000-4000-8000-000000000002','c1480000-0000-4000-8000-000000000001');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,solution,explanation) values('e1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001',3,'Matematik','Toplama','open_ended','1+1','Add one and one.','Two units.');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind) values
('f1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001','c1480000-0000-4000-8000-000000000001','Practice','Matematik',3,array['e1480000-0000-4000-8000-000000000001']::uuid[],'assigned','level_test'),
('f1480000-0000-4000-8000-000000000002','b1480000-0000-4000-8000-000000000001','c1480000-0000-4000-8000-000000000002','Practice','Matematik',3,array['e1480000-0000-4000-8000-000000000001']::uuid[],'assigned','level_test');
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
('f1480000-0000-4000-8000-000000000011','b1480000-0000-4000-8000-000000000001','f1480000-0000-4000-8000-000000000001','c1480000-0000-4000-8000-000000000001'),
('f1480000-0000-4000-8000-000000000012','b1480000-0000-4000-8000-000000000001','f1480000-0000-4000-8000-000000000002','c1480000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1480000-0000-4000-8000-000000000001","child_id":"c1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select is(public.get_child_question_solution('f1480000-0000-4000-8000-000000000011','e1480000-0000-4000-8000-000000000001'),null::jsonb,'active attempt has no solution');
select throws_ok($$select public.get_child_question_solution('f1480000-0000-4000-8000-000000000012','e1480000-0000-4000-8000-000000000001')$$,'42501',null,'sibling denied');
select throws_ok($$select public.get_child_question_solution('f1480000-0000-4000-8000-000000000011',gen_random_uuid())$$,'42501',null,'unassigned question denied');
reset role;update public.exam_attempts set status='submitted';set local role authenticated;
select is(public.get_child_question_solution('f1480000-0000-4000-8000-000000000011','e1480000-0000-4000-8000-000000000001'),null::jsonb,'submission without grading has no solution');
reset role;update public.exam_attempts set status='graded';set local role authenticated;
select is(public.get_child_question_solution('f1480000-0000-4000-8000-000000000011','e1480000-0000-4000-8000-000000000001')->>'solution','Add one and one.','graded solution available');
select is((select count(*)::int from jsonb_object_keys(public.get_child_question_solution('f1480000-0000-4000-8000-000000000011','e1480000-0000-4000-8000-000000000001'))),2,'strict two-field projection');
reset role;select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);set local role authenticated;
select throws_ok($$select public.get_child_question_solution('f1480000-0000-4000-8000-000000000011','e1480000-0000-4000-8000-000000000001')$$,'42501',null,'forged parent family has no access');
reset role;set local role anon;
select throws_ok($$select public.get_child_question_solution(null,null)$$,'42501',null,'anon denied');
reset role;select * from finish();rollback;
