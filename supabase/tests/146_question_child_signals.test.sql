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
select pg_temp.device();
set local role authenticated;
select lives_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','struggled',true)$$,'child can report difficulty for assigned question');
select lives_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','struggled',true)$$,'retry keeps same state');
select is((select count(*)::int from public.question_child_signals),1,'no duplicate signal');
select lives_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','liked',true)$$,'can independently like question');
select ok((select liked and struggled from public.question_child_signals),'one field does not erase the other');
select lives_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','struggled',false)$$,'can undo difficulty');
select ok((select liked and not struggled from public.question_child_signals),'undo preserves like');
select throws_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000002','c1450000-0000-4000-8000-000000000001','liked',true)$$,'42501',null,'cannot signal for sibling attempt');
select throws_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000002','liked',true)$$,'42501',null,'cannot signal unrelated question');
select throws_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','score',true)$$,'22023',null,'unsupported field rejected');
select is((select mc_correct from public.exam_attempts limit 1),null::integer,'signal does not grade attempt');
reset role;
select pg_temp.parent('2');
set local role authenticated;
select is((select count(*)::int from public.question_child_signals),0,'foreign parent reads nothing');
select throws_ok($$select public.set_question_child_signal('f1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001','liked',false)$$,'42501',null,'foreign parent cannot change signal');
reset role;
select pg_temp.parent('1');
set local role authenticated;
select is((select count(*)::int from public.question_child_signals),1,'own parent can see child report');
reset role;
set local role anon;
select throws_ok($$select * from public.question_child_signals$$,'42501',null,'anon reads no signal');
select throws_ok($$select public.set_question_child_signal(null,null,'liked',true)$$,'42501',null,'anon RPC denied');
reset role;
select ok((select relrowsecurity from pg_class where oid='public.question_child_signals'::regclass),'RLS enabled');
select * from finish();
rollback;
