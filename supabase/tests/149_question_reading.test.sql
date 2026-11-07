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
select ok(public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'reading defaults on for own assigned exam');
select throws_ok($$select public.get_question_reading_permission('f1480000-0000-4000-8000-000000000002')$$,'42501',null,'sibling preference denied');
update public.children set question_reading_enabled=false where id='c1480000-0000-4000-8000-000000000001';
select ok(public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'child cannot alter parent setting');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
update public.children set question_reading_enabled=false where id='c1480000-0000-4000-8000-000000000001';
select ok(not public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'parent can disable child setting');
update public.exams set question_reading_override='on' where id='f1480000-0000-4000-8000-000000000001';
select ok(public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'exam on overrides child off');
update public.children set question_reading_enabled=true where id='c1480000-0000-4000-8000-000000000001';
update public.exams set question_reading_override='off' where id='f1480000-0000-4000-8000-000000000001';
select ok(not public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'exam off overrides child on');
update public.exams set question_reading_override='inherit' where id='f1480000-0000-4000-8000-000000000001';
select ok(public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001'),'inherit restores child preference');
select throws_ok($$update public.exams set question_reading_override='maybe' where id='f1480000-0000-4000-8000-000000000001'$$,'23514',null,'invalid override rejected');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select throws_ok($$select public.get_question_reading_permission('f1480000-0000-4000-8000-000000000001')$$,'42501',null,'forged family claim rejected');
reset role;set local role anon;
select throws_ok($$select public.get_question_reading_permission(null)$$,'42501',null,'anon denied');
reset role;select * from finish();rollback;
