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
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent) values('80000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000003001','question_image','triangle.png','image/png',100,repeat('a',64),'notebook-test/triangle','ready',600,360,'private-storage-v1');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003001","role":"parent"}}',true);

-- Finish authoring before assignment freezes the question and its images.
select public.attach_question_source('30000000-0000-4000-8000-000000003001','80000000-0000-4000-8000-000000000002','ABC triangle');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('50000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000003001','20000000-0000-4000-8000-000000003001','Receipt practice','Fen',5,array['30000000-0000-4000-8000-000000003001']::uuid[],'assigned');
select set_config('test.answer_attempt',(public.start_exam_attempt('50000000-0000-4000-8000-000000003001')).id::text,true);

select set_config('test.doc','{"version":1,"width":1000,"height":1400,"elements":[{"id":"70000000-0000-4000-8000-000000000001","type":"stroke","color":"#201951","size":4,"points":[[20,30],[80,90]]}]}',true);
select ok(gina.valid_answer_document(current_setting('test.doc')::jsonb),'accepts bounded editable strokes');
select ok(not gina.valid_answer_document('{"version":"1","width":1000,"height":1400,"elements":[]}'),'rejects a string version');
select ok(not gina.valid_answer_document('{"version":1.1,"width":1000,"height":1400,"elements":[]}'),'rejects an unknown fractional version');
select ok(not gina.valid_answer_document(jsonb_set(current_setting('test.doc')::jsonb,'{elements,0,points}','[[1001,0]]')),'rejects coordinates outside page');
select ok(not gina.valid_answer_document(current_setting('test.doc')::jsonb||'{"script":"alert(1)"}'::jsonb),'rejects arbitrary markup');
select is(public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,null,current_setting('test.doc')::jsonb),2,'writes ink without answer text');
select is(public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003001',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,null,current_setting('test.doc')::jsonb),2,'lost reply replays same drawing receipt');
select is((select answer_document from public.get_saved_exam_answers_v3(current_setting('test.answer_attempt')::uuid)),current_setting('test.doc')::jsonb,'resume returns editable coordinates');
select throws_ok($$select public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003002',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',0,null,null,current_setting('test.doc')::jsonb)$$,'P0001','answer_changed','stale device cannot erase new ink');
select throws_ok($$select public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003003',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',2,null,null,'{"version":1,"width":1000,"height":1400,"elements":[{"id":"70000000-0000-4000-8000-000000000002","type":"source","sourceId":"80000000-0000-4000-8000-000000000001","questionId":"30000000-0000-4000-8000-000000003001","x":0,"y":0,"width":200,"height":200,"crop":{"x":0,"y":0,"width":1,"height":1},"alt":"Foreign image"}]}')$$,'42501','notebook_source_forbidden','cannot forge a foreign source reference');
select set_config('test.source_doc',jsonb_set(current_setting('test.doc')::jsonb,'{elements}',(current_setting('test.doc')::jsonb->'elements')||'[{"id":"70000000-0000-4000-8000-000000000002","type":"source","sourceId":"80000000-0000-4000-8000-000000000002","questionId":"30000000-0000-4000-8000-000000003001","x":80,"y":100,"width":200,"height":200,"crop":{"x":0.1,"y":0.1,"width":0.5,"height":0.5},"alt":"ABC triangle"}]')::text,true);
select is(public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003005',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',2,null,null,current_setting('test.source_doc')::jsonb),3,'accepts crop of a question-owned source');
select public.finish_exam_attempt(current_setting('test.answer_attempt')::uuid);
select is(public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003005',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',2,null,null,current_setting('test.source_doc')::jsonb),3,'receipt replay works after finish');
select throws_ok($$select public.submit_exam_answer_v3('60000000-0000-4000-8000-000000003004',current_setting('test.answer_attempt')::uuid,'30000000-0000-4000-8000-000000003001',3,null,null,null)$$,'P0001','attempt_closed','cannot erase finished notebook');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003002","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003002","role":"parent"}}',true);
select is((select count(*)::int from public.get_saved_exam_answers_v3(current_setting('test.answer_attempt')::uuid)),0,'other family cannot read notebook');
select * from finish();rollback;
