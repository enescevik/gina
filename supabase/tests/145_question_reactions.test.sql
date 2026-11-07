begin;
select no_plan();
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
('a1450000-0000-4000-8000-000000000001','f1-a@example.invalid',false,'{}'),
('a1450000-0000-4000-8000-000000000002','f1-b@example.invalid',false,'{}');
insert into public.families(id,name,created_by) values
('b1450000-0000-4000-8000-000000000001','A','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','B','a1450000-0000-4000-8000-000000000002');
insert into public.family_members(family_id,user_id) values
('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','a1450000-0000-4000-8000-000000000002');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem) values
('c1450000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001',5,'Matematik','Toplama','open_ended','kolay','1+1'),
('c1450000-0000-4000-8000-000000000002','b1450000-0000-4000-8000-000000000002',5,'Matematik','Toplama','open_ended','kolay','2+2');
create function pg_temp.actor(n text, r text default 'parent') returns void language sql as $$
select set_config('request.jwt.claims',jsonb_build_object('sub','a1450000-0000-4000-8000-00000000000'||n,'role','authenticated','gina',jsonb_build_object('family_id','b1450000-0000-4000-8000-00000000000'||n,'role',r))::text,true)::void $$;
select pg_temp.actor('1');
set local role authenticated;
select lives_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001')$$,'parent can like owned question');
select lives_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001') on conflict do nothing$$,'retry is idempotent');
select is((select count(*)::int from public.question_reactions),1,'one like');
select throws_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000002')$$,'42501',null,'cannot reference foreign family question');
select throws_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000002','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000002')$$,'42501',null,'cannot forge family');
select throws_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000002','c1450000-0000-4000-8000-000000000001')$$,'42501',null,'cannot forge parent');
select throws_ok($$update public.question_reactions set created_at=now()$$,'42501',null,'immutable creation and ownership');
select throws_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id,created_at) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001',now()+interval '1 year') on conflict do nothing$$,'42501',null,'client cannot forge preference time');
reset role;
select pg_temp.actor('2');
set local role authenticated;
select is((select count(*)::int from public.question_reactions),0,'foreign parent cannot read likes');
delete from public.question_reactions;
reset role;
select is((select count(*)::int from public.question_reactions),1,'foreign delete had no effect');
select pg_temp.actor('1','device');
set local role authenticated;
select is((select count(*)::int from public.question_reactions),0,'child session cannot read parent preferences');
select throws_ok($$insert into public.question_reactions(family_id,parent_user_id,question_id) values('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001','c1450000-0000-4000-8000-000000000001')$$,'42501',null,'child cannot write parent preference');
reset role;
set local role anon;
select throws_ok($$select * from public.question_reactions$$,'42501',null,'anon denied');
reset role;
select pg_temp.actor('1');
set local role authenticated;
delete from public.question_reactions;
select is((select count(*)::int from public.question_reactions),0,'parent can remove preference');
reset role;
select ok((select relrowsecurity from pg_class where oid='public.question_reactions'::regclass),'RLS on');
select * from finish();
rollback;
