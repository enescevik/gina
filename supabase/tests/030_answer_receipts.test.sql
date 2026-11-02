begin;
select no_plan();
update public.plans set prova_monthly_exams=null,prova_scenarios=true where code='free';
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003001','scope-a@test.local'),('00000000-0000-4000-8000-000000003002','scope-b@test.local');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000003001','A','00000000-0000-4000-8000-000000003001'),('10000000-0000-4000-8000-000000003002','B','00000000-0000-4000-8000-000000003002');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000003001'),('10000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000003002');
insert into public.children(id,family_id,name) values('20000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000003001','A child'),('20000000-0000-4000-8000-000000003002','10000000-0000-4000-8000-000000003002','B child');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem) values
('30000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000003001',5,'Fen','Işık','open_ended','orta','A private question'),
('30000000-0000-4000-8000-000000003002','10000000-0000-4000-8000-000000003002',5,'Fen','Işık','open_ended','orta','B private question'),
('30000000-0000-4000-8000-000000003003',null,5,'Fen','Işık','open_ended','orta','Shared question');
insert into public.exam_blueprints(id,family_id,grade,subject,name) values('40000000-0000-4000-8000-000000003002','10000000-0000-4000-8000-000000003002',5,'Fen','B private scenario');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003001","role":"parent"}}',true);

insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('50000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000003001','20000000-0000-4000-8000-000000003001','Receipt practice','Fen',5,array['30000000-0000-4000-8000-000000003001']::uuid[],'assigned');
select set_config('test.answer_attempt',(public.start_exam_attempt('50000000-0000-4000-8000-000000003001')).id::text,true);
select is(public.submit_exam_answer_once('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,'First'),1,'first edit returns revision one');
select is(public.submit_exam_answer_once('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,'First'),1,'lost response replays same receipt');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,'Changed')$$,'P0001','request_conflict','same request cannot mutate content');
select is(public.submit_exam_answer_once('60000000-0000-4000-8000-000000003002',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',1,null,'Newest'),2,'second edit increments revision');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,'First')$$,'P0001','answer_changed','old receipt cannot mark a subsequently changed answer as current');
select is((select answer_text from public.get_saved_exam_answers_v2(current_setting('test.answer_attempt')::uuid)),'Newest','newest answer retained');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003003',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',1,null,'Old screen')$$,'P0001','answer_changed','old screen revision rejected');
select public.submit_exam_answer(current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',null,'Old app edit');
select is((select revision from public.get_saved_exam_answers_v2(current_setting('test.answer_attempt')::uuid)),3,'older client writes also increment revision');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003004',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',2,null,'Late after old client')$$,'P0001','answer_changed','new client cannot overwrite unseen old-client edit');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003005',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003002',0,null,'Foreign')$$,'P0001','question_not_in_exam','receipt endpoint keeps question scope checks');
select is(public.submit_exam_answer_once('60000000-0000-4000-8000-000000003007',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',3,null,'Final'),4,'final receipt saved');
select public.finish_exam_attempt(current_setting('test.answer_attempt')::uuid);
select is(public.submit_exam_answer_once('60000000-0000-4000-8000-000000003007',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',3,null,'Final'),4,'latest receipt remains replayable after finish');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003006',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',4,null,'After finish')$$,'P0001','attempt_closed','new writes cannot reopen finished exam');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003002","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003002","role":"parent"}}',true);
select is((select count(*)::int from public.get_saved_exam_answers_v2(current_setting('test.answer_attempt')::uuid)),0,'other family cannot read revision or answer');
select throws_ok($$select public.submit_exam_answer_once('60000000-0000-4000-8000-000000003002',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',1,null,'Newest')$$,'P0001','attempt_not_found','other family cannot replay receipt');
select * from finish();rollback;
