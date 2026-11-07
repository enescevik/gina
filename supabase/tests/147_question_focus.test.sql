begin;
select no_plan();
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
('a1450000-0000-4000-8000-000000000001','f1-a@example.invalid',false,'{}'),
('a1450000-0000-4000-8000-000000000002','f1-b@example.invalid',false,'{}'),('a1450000-0000-4000-8000-000000000003','f2-device@example.invalid',true,'{}');
insert into public.families(id,name,created_by) values
('b1450000-0000-4000-8000-000000000001','A','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','B','a1450000-0000-4000-8000-000000000002');
insert into public.family_members(family_id,user_id) values
('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','a1450000-0000-4000-8000-000000000002');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem) values
('c1450000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001',5,'Matematik','Toplama','open_ended','kolay','1+1'),
('c1450000-0000-4000-8000-000000000002','b1450000-0000-4000-8000-000000000002',5,'Matematik','Toplama','open_ended','kolay','2+2');

insert into public.children(id,family_id,name,grade) values
('d1450000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001','A1',3),
('d1450000-0000-4000-8000-000000000002','b1450000-0000-4000-8000-000000000001','A2',3),
('d1450000-0000-4000-8000-000000000003','b1450000-0000-4000-8000-000000000002','B',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('d1450000-0000-4000-8000-000000000004','b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000003','d1450000-0000-4000-8000-000000000001');
update public.question_bank set provenance='{"outcome_ids":["test.outcome"],"curriculum_version":"test"}' where id='c1450000-0000-4000-8000-000000000001';
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind) values
('e1450000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001','d1450000-0000-4000-8000-000000000001','Practice','Matematik',3,array['c1450000-0000-4000-8000-000000000001']::uuid[],'assigned','level_test'),
('e1450000-0000-4000-8000-000000000002','b1450000-0000-4000-8000-000000000001','d1450000-0000-4000-8000-000000000002','Practice','Matematik',3,array['c1450000-0000-4000-8000-000000000001']::uuid[],'assigned','level_test');
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
('f1450000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001','e1450000-0000-4000-8000-000000000001','d1450000-0000-4000-8000-000000000001'),
('f1450000-0000-4000-8000-000000000002','b1450000-0000-4000-8000-000000000001','e1450000-0000-4000-8000-000000000002','d1450000-0000-4000-8000-000000000002');
create function pg_temp.device() returns void language sql as $$
select set_config('request.jwt.claims','{"sub":"a1450000-0000-4000-8000-000000000003","role":"authenticated","gina":{"family_id":"b1450000-0000-4000-8000-000000000001","role":"device","child_id":"d1450000-0000-4000-8000-000000000001"}}',true)::void $$;
create function pg_temp.parent(n text) returns void language sql as $$
select set_config('request.jwt.claims',jsonb_build_object('sub','a1450000-0000-4000-8000-00000000000'||n,'role','authenticated','gina',jsonb_build_object('family_id','b1450000-0000-4000-8000-00000000000'||n,'role','parent'))::text,true)::void $$;

update public.children set grade=5;
update public.children set grade=6 where id='d1450000-0000-4000-8000-000000000002';
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,provenance) values
('c1450000-0000-4000-8000-000000000003','b1450000-0000-4000-8000-000000000001',5,'Matematik','Toplama','open_ended','kolay','3+3','{"outcome_ids":["test.outcome"],"curriculum_version":"test"}'),
('c1450000-0000-4000-8000-000000000004','b1450000-0000-4000-8000-000000000001',5,'Matematik','Toplama','open_ended','kolay','4+4','{"outcome_ids":["test.outcome"],"curriculum_version":"test"}');
insert into public.question_child_signals values('b1450000-0000-4000-8000-000000000001','f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',false,true);
update public.exam_attempts set status='submitted';
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,provenance) values
('c1450000-0000-4000-8000-000000000006','b1450000-0000-4000-8000-000000000001',5,'Matematik','Toplama','open_ended','kolay','Malformed label','{"outcome_ids":{}}');
select pg_temp.parent('1');set local role authenticated;
select lives_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',true)$$,'parent selects one child');
select is((select count(*)::int from public.question_focus),1,'single focus');
select throws_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000002','c1450000-0000-4000-8000-000000000001',true)$$,'42501',null,'different grade rejected');
select ok((select expires_at>now() and expires_at<=now()+interval '7 days' from public.question_focus),'bounded server expiry');
select lives_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',true)$$,'retry creates no duplicate');
select is((select count(*)::int from public.question_focus),1,'focus remains single');
select throws_ok($$update public.question_focus set expires_at=now()+interval '1 year'$$,'42501',null,'client cannot extend period directly');
select throws_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000003','c1450000-0000-4000-8000-000000000001',true)$$,'42501',null,'foreign child rejected');
select throws_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000002',true)$$,'42501',null,'foreign question rejected');
select is(jsonb_array_length(public.get_reinforcement_suggestions()),1,'difficulty appears only in parent suggestions');
select is(cardinality(public.get_reinforcement_questions('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000006')),0,'malformed label fails closed without crashing recommendations');
select is(array_length(public.get_reinforcement_questions('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001'),1),3,'short practice uses matching acquired questions');
select is((public.get_reinforcement_questions('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001'))[3],'c1450000-0000-4000-8000-000000000001'::uuid,'original challenge goes last');
select lives_ok($$select public.snooze_reinforcement('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001')$$,'parent can snooze');
select is(jsonb_array_length(public.get_reinforcement_suggestions()),0,'seven day cooldown hides suggestion');
select lives_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',false)$$,'parent can undo');
select is((select count(*)::int from public.question_focus),0,'focus removed');
reset role;select pg_temp.parent('2');set local role authenticated;
select is(jsonb_array_length(public.get_reinforcement_suggestions()),0,'foreign parent sees no suggestion');
select is((select count(*)::int from public.reinforcement_snoozes),0,'foreign parent sees no snooze');
select throws_ok($$select public.get_reinforcement_questions('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001')$$,'42501',null,'foreign parent cannot read source');
reset role;select pg_temp.device();set local role authenticated;
select throws_ok($$select public.get_reinforcement_suggestions()$$,'42501',null,'child has no suggestion/upsell endpoint');
select throws_ok($$select public.set_question_focus('d1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',true)$$,'42501',null,'child cannot instruct focus');
reset role;set local role anon;
select throws_ok($$select public.get_reinforcement_suggestions()$$,'42501',null,'anon RPC denied');
reset role;
select * from finish();rollback;
