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

create function pg_temp.child() returns uuid language sql as $$select 'c1640000-0000-4000-8000-000000000001'::uuid$$;
create function pg_temp.parent_claim() returns void language sql as $$
select set_config('request.jwt.claims','{"sub":"a1640000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1640000-0000-4000-8000-000000000001"}}',true)::void
$$;
set local role authenticated;
select pg_temp.parent_claim();
select is(public.preview_teacher_outcome_share(pg_temp.child())->'subjects','["Matematik"]'::jsonb,'parent selects from observed subjects');
select is(public.preview_teacher_outcome_share(pg_temp.child(),'Matematik')#>>'{snapshot,rows,0,scored}','5','preview counts distinct scored questions');
select throws_ok($$select public.create_child_share(pg_temp.child(),'Teacher',array['learning_outcomes'],7)$$,'P0001','invalid_scopes','legacy path cannot bypass preview');
select throws_ok($$select public.create_child_outcome_share(pg_temp.child(),'Teacher',array['learning_outcomes'],7,'Matematik','stale')$$,'P0001','outcome_preview_changed','stale hash rejected');
select throws_ok('select outcome_snapshot from public.child_shares','42501',null,'snapshot column not readable directly');
select set_config('test.share_id',id::text,true), set_config('test.share_token',token,true)
from public.create_child_outcome_share(pg_temp.child(),'Teacher',array['learning_outcomes'],7,'Matematik',
  public.preview_teacher_outcome_share(pg_temp.child(),'Matematik')->>'hash');
reset role;

update public.exam_answers set score=100 where question_id='e1640000-0000-4000-8000-000000000005';
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select public.preview_teacher_outcome_share(pg_temp.child())$$,'42501',null,'anon cannot preview without a link');
select is(public.get_shared_child_view(current_setting('test.share_token'))#>>'{learning_outcomes,rows,0,mean_points}','60.0','link contains reviewed immutable snapshot');
select is(public.get_shared_child_view(current_setting('test.share_token'))#>>'{learning_outcomes,subject}','Matematik','one selected subject');
select ok(not (public.get_shared_child_view(current_setting('test.share_token')) ?| array['grades','prova','tasks_summary']),'other scopes absent');
select ok(public.get_shared_child_view(current_setting('test.share_token'))::text not like '%My work%' and public.get_shared_child_view(current_setting('test.share_token'))::text not like '%Question 1%','raw question and answer omitted');
reset role;

set local role authenticated;
select pg_temp.parent_claim();
select lives_ok($$select public.revoke_child_share(current_setting('test.share_id')::uuid)$$,'existing revoke path works');
reset role;
set local role anon;
select throws_ok($$select public.get_shared_child_view(current_setting('test.share_token'))$$,'P0001','invalid_share','revoked link cannot read snapshot');
reset role;
select * from finish();
rollback;
