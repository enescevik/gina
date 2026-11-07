-- Study preferences use existing parent-write and family-read boundaries.
begin;select no_plan();
insert into auth.users(id,email) values
('a1480000-0000-4000-8000-000000000001','solution-parent@example.invalid'),
('a1480000-0000-4000-8000-000000000002','solution-device@example.invalid'),
('a1480000-0000-4000-8000-000000000003','solution-outsider@example.invalid');
insert into public.families(id,name,created_by) values('b1480000-0000-4000-8000-000000000001','Solution','a1480000-0000-4000-8000-000000000001');
insert into public.family_members(family_id,user_id) values('b1480000-0000-4000-8000-000000000001','a1480000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,grade) values('c1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001','A',3),('c1480000-0000-4000-8000-000000000002','b1480000-0000-4000-8000-000000000001','B',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('d1480000-0000-4000-8000-000000000001','b1480000-0000-4000-8000-000000000001','a1480000-0000-4000-8000-000000000002','c1480000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000002","role":"authenticated","gina":{"role":"device","family_id":"b1480000-0000-4000-8000-000000000001","child_id":"c1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
select is((select break_minutes::integer from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),20,'break default is a preference, not an exam limit');
select is((select evening_start from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),null::smallint,'evening reminder is opt-in');
select throws_ok($$select public.get_study_preferences('c1480000-0000-4000-8000-000000000002')$$,'42501',null,'device cannot fetch sibling preferences');
update public.children set study_break_minutes=60 where id='c1480000-0000-4000-8000-000000000001';
select is((select break_minutes::integer from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),20,'child cannot change parent preference');
reset role;
select set_config('request.jwt.claims','{"sub":"a1480000-0000-4000-8000-000000000001","role":"authenticated","gina":{"role":"parent","family_id":"b1480000-0000-4000-8000-000000000001"}}',true);
set local role authenticated;
update public.children set study_break_minutes=25,evening_reminder_start=1260 where id='c1480000-0000-4000-8000-000000000001';
select is((select break_minutes::integer from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),25,'parent can choose interval');
select is((select evening_start::integer from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),1260,'parent can enable evening suggestion');
select throws_ok($$update public.children set study_break_minutes=0 where id='c1480000-0000-4000-8000-000000000001'$$,'23514',null,'invalid interval rejected');
select throws_ok($$update public.children set evening_reminder_start=420 where id='c1480000-0000-4000-8000-000000000001'$$,'23514',null,'empty quiet interval rejected');
select throws_ok($$update public.children set evening_reminder_end=1440 where id='c1480000-0000-4000-8000-000000000001'$$,'23514',null,'out of range clock rejected');
select is((select count(*)::integer from public.get_study_preferences('c1480000-0000-4000-8000-000000000009')),0,'missing or foreign child gives no data');
update public.children set evening_reminder_start=null where id='c1480000-0000-4000-8000-000000000001';
select is((select evening_start from public.get_study_preferences('c1480000-0000-4000-8000-000000000001')),null::smallint,'parent can revoke preference');
reset role;set local role anon;
select throws_ok($$select public.get_study_preferences('c1480000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous read denied');
reset role;select * from finish();rollback;
