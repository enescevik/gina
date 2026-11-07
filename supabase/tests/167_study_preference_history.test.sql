-- Parent-only preference audit.
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

insert into public.families(id,name,created_by) values('b1480000-0000-4000-8000-000000000002','Other','a1480000-0000-4000-8000-000000000003');
insert into public.family_members(family_id,user_id) values('b1480000-0000-4000-8000-000000000002','a1480000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
update public.children set question_reading_enabled=false,study_break_minutes=25 where id='c1480000-0000-4000-8000-000000000001';
update public.children set study_break_minutes=25 where id='c1480000-0000-4000-8000-000000000001';
update public.exams set question_reading_override='on' where id='f1480000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.get_study_preference_history('c1480000-0000-4000-8000-000000000001')),3,'only actual changes recorded');
select is((select actor from public.get_study_preference_history('c1480000-0000-4000-8000-000000000001') where setting='break'),'self','actor scoped without exposing identifier');
select is((select new_value from public.get_study_preference_history('c1480000-0000-4000-8000-000000000001') where setting='exam_reading'),'on','exam override audited');
select throws_ok('select * from gina.study_preference_history','42501',null,'no direct access');
select throws_ok($$select * from public.get_study_preference_history('c1480000-0000-4000-8000-000000000099')$$,'42501',null,'out of scope child denied');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1480000-0000-4000-8000-000000000001","child_id":"c1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select throws_ok($$select * from public.get_study_preference_history('c1480000-0000-4000-8000-000000000001')$$,'42501',null,'child cannot read audit history');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000002"}}',true);
set local role authenticated;
select throws_ok($$select * from public.get_study_preference_history('c1480000-0000-4000-8000-000000000001')$$,'42501',null,'foreign parent denied');
reset role;
select * from finish();rollback;
