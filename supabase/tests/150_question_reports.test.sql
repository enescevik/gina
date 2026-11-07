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
select lives_ok($$select public.report_question('a1500000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011')$$,'assigned child can report');
select lives_ok($$select public.report_question('a1500000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011')$$,'retry is idempotent');
select is((select count(*)::int from public.question_reports),1,'one report');
reset role;update public.devices set active_child_id='c1480000-0000-4000-8000-000000000002' where id='d1480000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1480000-0000-4000-8000-000000000001","child_id":"c1480000-0000-4000-8000-000000000002"}}',true);set local role authenticated;
select is((select count(*)::int from public.question_reports),0,'shared tablet does not reveal sibling report');
select throws_ok($$select public.report_question('a1500000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011')$$,'42501',null,'shared tablet cannot replay sibling receipt');
reset role;update public.devices set active_child_id='c1480000-0000-4000-8000-000000000001' where id='d1480000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1480000-0000-4000-8000-000000000001","child_id":"c1480000-0000-4000-8000-000000000001"}}',true);set local role authenticated;

select throws_ok($$select public.report_question('a1500000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','incorrect','f1480000-0000-4000-8000-000000000011')$$,'22023',null,'request body reuse conflict');
select throws_ok($$select public.report_question(gen_random_uuid(),'e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000012')$$,'42501',null,'sibling report denied');
select throws_ok($$select public.report_question(gen_random_uuid(),'e1480000-0000-4000-8000-000000000001','unclear')$$,'42501',null,'child must prove assigned attempt');
select throws_ok($$select public.report_question(gen_random_uuid(),gen_random_uuid(),'unclear','f1480000-0000-4000-8000-000000000011')$$,'42501',null,'unrelated question denied');
select throws_ok($$select public.report_question(gen_random_uuid(),'e1480000-0000-4000-8000-000000000001','free text','f1480000-0000-4000-8000-000000000011')$$,'22023',null,'reason allowlist');
select throws_ok($$insert into public.question_reports(id,family_id,question_id,reporter_id,reason) values(gen_random_uuid(),'b1480000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','a1480000-0000-4000-8000-000000000002','unclear')$$,'42501',null,'no direct insert bypass');
select throws_ok($$select public.resolve_question_report('a1500000-0000-4000-8000-000000000001','reviewed')$$,'42501',null,'child cannot moderate');
select lives_ok($$select public.report_question(gen_random_uuid(),'e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011') from generate_series(1,9)$$,'bounded allowance');
select throws_ok($$select public.report_question(gen_random_uuid(),'e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011')$$,'P0001','question_report_rate_limited','rate limit enforced');
select lives_ok($$select public.report_question('a1500000-0000-4000-8000-000000000001','e1480000-0000-4000-8000-000000000001','unclear','f1480000-0000-4000-8000-000000000011')$$,'retry does not spend allowance');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000003","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);set local role authenticated;
select is((select count(*)::int from public.question_reports),0,'forged parent cannot read reports');
reset role;insert into public.admins(user_id) values('a1480000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","admin":true,"family_id":"b1480000-0000-4000-8000-000000000001"}}',true);set local role authenticated;
select is((select count(*)::int from public.question_reports),10,'admin can read queue');
select lives_ok($$select public.resolve_question_report('a1500000-0000-4000-8000-000000000001','reviewed')$$,'admin can mark reviewed');
select lives_ok($$select public.resolve_question_report('a1500000-0000-4000-8000-000000000001','reviewed')$$,'resolve retry is idempotent');
select is((select count(*)::int from public.audit_log where action='question_report.reviewed'),1,'one audit event');
select is((select status::text from public.exam_attempts where id='f1480000-0000-4000-8000-000000000011'),'in_progress','report does not end or grade attempt');
reset role;set local role anon;
select throws_ok($$select public.report_question(null,null,'unclear')$$,'42501',null,'anon RPC denied');
reset role;select * from finish();rollback;
