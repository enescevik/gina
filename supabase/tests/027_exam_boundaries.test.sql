begin;
select no_plan();
update public.plans set prova_monthly_exams=null,prova_scenarios=true where code='free';
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000002701','scope-a@test.local'),('00000000-0000-4000-8000-000000002702','scope-b@test.local');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000002701','A','00000000-0000-4000-8000-000000002701'),('10000000-0000-4000-8000-000000002702','B','00000000-0000-4000-8000-000000002702');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000002701','00000000-0000-4000-8000-000000002701'),('10000000-0000-4000-8000-000000002702','00000000-0000-4000-8000-000000002702');
insert into public.children(id,family_id,name) values('20000000-0000-4000-8000-000000002701','10000000-0000-4000-8000-000000002701','A child'),('20000000-0000-4000-8000-000000002702','10000000-0000-4000-8000-000000002702','B child');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem) values
('30000000-0000-4000-8000-000000002701','10000000-0000-4000-8000-000000002701',5,'Fen','Işık','open_ended','orta','A private question'),
('30000000-0000-4000-8000-000000002702','10000000-0000-4000-8000-000000002702',5,'Fen','Işık','open_ended','orta','B private question'),
('30000000-0000-4000-8000-000000002703',null,5,'Fen','Işık','open_ended','orta','Shared question');
insert into public.exam_blueprints(id,family_id,grade,subject,name) values('40000000-0000-4000-8000-000000002702','10000000-0000-4000-8000-000000002702',5,'Fen','B private scenario');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002701","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002701","role":"parent"}}',true);
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade,question_ids) values('10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002701','Attack','Fen',5,array['30000000-0000-4000-8000-000000002701','30000000-0000-4000-8000-000000002702']::uuid[])$$,'42501','exam_reference_forbidden','cannot mix a foreign question into own exam');
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade) values('10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002702','Attack','Fen',5)$$,'42501','exam_reference_forbidden','foreign child rejected');
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade,blueprint_id) values('10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002701','Attack','Fen',5,'40000000-0000-4000-8000-000000002702')$$,'42501','exam_reference_forbidden','foreign scenario rejected');
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade,question_ids) values('10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002701','Duplicate','Fen',5,array['30000000-0000-4000-8000-000000002701','30000000-0000-4000-8000-000000002701']::uuid[])$$,'42501','exam_reference_forbidden','duplicate question cannot count twice');
select lives_ok($$insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('50000000-0000-4000-8000-000000002701','10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002701','Valid','Fen',5,array['30000000-0000-4000-8000-000000002701','30000000-0000-4000-8000-000000002703']::uuid[],'assigned')$$,'own and shared questions allowed');
select is((select count(*)::int from public.get_attempt_questions('50000000-0000-4000-8000-000000002701')),2,'safe questions readable');
select lives_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000002701')$$,'valid exam starts');
select throws_ok($$update public.exams set question_ids=array['30000000-0000-4000-8000-000000002703']::uuid[] where id='50000000-0000-4000-8000-000000002701'$$,'P0001','exam_already_started','cannot change questions beneath an attempt');
select throws_ok($$select public.submit_exam_answer((select id from public.exam_attempts limit 1),'30000000-0000-4000-8000-000000002702',null,'x')$$,'P0001','question_not_in_exam','foreign answer rejected');
select throws_ok($$update public.question_bank set stem='Changed after answer' where id='30000000-0000-4000-8000-000000002701'$$,'P0001','question_in_use','used question content cannot change under results');
select throws_ok($$delete from public.question_bank where id='30000000-0000-4000-8000-000000002701'$$,'P0001','question_in_use','cannot erase question from existing exam');
-- Simulate a malformed historical row using a test-only disabled trigger.
reset role;
alter table public.exams disable trigger exams_reference_guard;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('50000000-0000-4000-8000-000000002702','10000000-0000-4000-8000-000000002701','20000000-0000-4000-8000-000000002701','Legacy invalid','Fen',5,array['30000000-0000-4000-8000-000000002702']::uuid[],'assigned');
alter table public.exams enable trigger exams_reference_guard;
set local role authenticated;
select is((select count(*)::int from public.get_attempt_questions('50000000-0000-4000-8000-000000002702')),0,'legacy malformed row cannot leak foreign question text');
select throws_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000002702')$$,'42501','exam_reference_forbidden','legacy invalid exam cannot start');
reset role;
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000002701';set constraints all immediate;$$,'account deletion still cascades even with malformed legacy exam');
select * from finish();
rollback;
