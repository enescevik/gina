-- Q02: cross-family / cross-role authorization matrix and last-parent deletion with
-- reward, inventory, receipts and archive state. Claims alone never grant access:
-- membership, admins row, operations role and device assignment are re-checked per request.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000009301','q02-parent-a@example.invalid',false),
 ('00000000-0000-4000-8000-000000009302','q02-parent-b@example.invalid',false),
 ('00000000-0000-4000-8000-000000009303','q02-admin@example.invalid',false),
 ('00000000-0000-4000-8000-000000009304','q02-support@example.invalid',false),
 ('00000000-0000-4000-8000-000000009305',null,true),
 ('00000000-0000-4000-8000-000000009306',null,true);
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000009301','Q02 A','00000000-0000-4000-8000-000000009301'),
 ('10000000-0000-4000-8000-000000009302','Q02 B','00000000-0000-4000-8000-000000009302');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000009301','00000000-0000-4000-8000-000000009301'),
 ('10000000-0000-4000-8000-000000009302','00000000-0000-4000-8000-000000009302');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000009301','10000000-0000-4000-8000-000000009301','A one',5),
 ('20000000-0000-4000-8000-000000009302','10000000-0000-4000-8000-000000009301','A two',3),
 ('20000000-0000-4000-8000-000000009303','10000000-0000-4000-8000-000000009302','B one',5);
insert into public.devices(id,family_id,auth_user_id,active_child_id,access_mode) values
 ('60000000-0000-4000-8000-000000009305','10000000-0000-4000-8000-000000009301','00000000-0000-4000-8000-000000009305','20000000-0000-4000-8000-000000009301','selected'),
 ('60000000-0000-4000-8000-000000009306','10000000-0000-4000-8000-000000009302','00000000-0000-4000-8000-000000009306','20000000-0000-4000-8000-000000009303','all');
insert into public.device_children(device_id,child_id) values('60000000-0000-4000-8000-000000009305','20000000-0000-4000-8000-000000009301');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000009303');
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000009304','support',now()+interval '1 hour');
insert into public.task_templates(id,family_id,child_id,title,stars) values
 ('30000000-0000-4000-8000-000000009301','10000000-0000-4000-8000-000000009301','20000000-0000-4000-8000-000000009301','A one task',2),
 ('30000000-0000-4000-8000-000000009302','10000000-0000-4000-8000-000000009301','20000000-0000-4000-8000-000000009302','A two task',1);
insert into public.family_rewards(id,family_id,title,cost_stars) values('40000000-0000-4000-8000-000000009301','10000000-0000-4000-8000-000000009301','Cinema',2);
insert into public.star_events(family_id,child_id,delta,reason,created_by) values('10000000-0000-4000-8000-000000009301','20000000-0000-4000-8000-000000009301',3,'bonus','00000000-0000-4000-8000-000000009301');
insert into public.notes(family_id,child_id,author_user_id,body,visibility) values('10000000-0000-4000-8000-000000009301','20000000-0000-4000-8000-000000009301','00000000-0000-4000-8000-000000009301','private text','private');

create function pg_temp.actor(id text,role_name text,family text,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',role_name,
   'device_id',case when role_name='device' then replace(id,'00000000-0000-4000-8000','60000000-0000-4000-8000') else null end,
   'child_id',case id when '00000000-0000-4000-8000-000000009305' then '20000000-0000-4000-8000-000000009301' when '00000000-0000-4000-8000-000000009306' then '20000000-0000-4000-8000-000000009303' else null end)||extra)::text,true)$$;
create function pg_temp.a() returns text language sql as $$select '10000000-0000-4000-8000-000000009301'$$;
create function pg_temp.b() returns text language sql as $$select '10000000-0000-4000-8000-000000009302'$$;

set local role authenticated;
-- 1. Parent of B carrying a forged family-A claim (valid signature is assumed; membership is what counts).
select pg_temp.actor('00000000-0000-4000-8000-000000009302','parent',pg_temp.a());
select is((select count(*)::int from public.children),0,'forged family claim without membership reads no children');
select is((select count(*)::int from public.task_templates),0,'forged family claim reads no tasks');
select is((select count(*)::int from public.notes),0,'forged family claim reads no notes');
select throws_ok($$select public.save_parent_note(gen_random_uuid(),null,null,'save','20000000-0000-4000-8000-000000009301',jsonb_build_object('title','x','body','y','subject','','visibility','private'))$$,'42501',null,'forged claim cannot write a note');
select throws_ok($$select public.set_child_archived(gen_random_uuid(),'20000000-0000-4000-8000-000000009301',0,true)$$,'42501',null,'forged claim cannot archive');
select throws_ok($$select public.change_task_routine(gen_random_uuid(),'30000000-0000-4000-8000-000000009301',1,'pause')$$,'42501',null,'forged claim cannot change a routine');
select throws_ok($$select public.request_reward('40000000-0000-4000-8000-000000009301',gen_random_uuid(),'20000000-0000-4000-8000-000000009301')$$,'42501',null,'forged claim cannot request a reward for a foreign child');
select throws_ok($$select public.education_report_periods('20000000-0000-4000-8000-000000009301')$$,'42501',null,'forged claim cannot read report periods');
select throws_ok($$select public.complete_task('30000000-0000-4000-8000-000000009301',current_date,gen_random_uuid(),'20000000-0000-4000-8000-000000009301')$$,null,null,'forged claim cannot complete a foreign task');

-- 2. Real parent of B with its own claim sees only its own family.
select pg_temp.actor('00000000-0000-4000-8000-000000009302','parent',pg_temp.b());
select is((select count(*)::int from public.children),1,'own family sees own child only');
select throws_ok($$select public.review_task(gen_random_uuid(),true)$$,null,null,'foreign completion review is refused');

-- 3. Admin without family membership: operator functions work, family content stays closed.
select pg_temp.actor('00000000-0000-4000-8000-000000009303','none',null,'{"admin":true}');
select ok((select count(*) from public.admin_search_families('Q02'))>=2,'admin search lists families');
select is((select count(*)::int from public.children),0,'admin reads no children rows');
select is((select count(*)::int from public.notes),0,'admin reads no notes rows');
select throws_ok($$select public.education_report_periods('20000000-0000-4000-8000-000000009301')$$,'42501',null,'admin cannot read a family report');
select throws_ok($$select public.set_child_archived(gen_random_uuid(),'20000000-0000-4000-8000-000000009301',0,true)$$,'42501',null,'admin cannot archive a child');
select throws_ok($$select public.decide_reward_request(gen_random_uuid(),true)$$,'42501',null,'admin cannot decide rewards');
-- 4. Forged admin flag without an admins row.
select pg_temp.actor('00000000-0000-4000-8000-000000009302','parent',pg_temp.b(),'{"admin":true}');
select throws_ok($$select * from public.admin_search_families('Q02')$$,null,null,'forged admin claim without admins row is refused');
select throws_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000009302','support',now()+interval '1 day',false,'self grant')$$,null,null,'forged admin claim cannot grant operator roles');
-- 5. Support operator.
select pg_temp.actor('00000000-0000-4000-8000-000000009304','none',null);
select is(public.my_operation_roles(),'["support"]'::jsonb,'support role is live');
select is((select count(*)::int from public.children),0,'support reads no children');
select is((select count(*)::int from public.task_templates),0,'support reads no tasks');
select is((select count(*)::int from public.reward_requests),0,'support reads no reward requests');
select throws_ok($$select * from public.admin_search_families('Q02')$$,null,null,'support is not admin');

-- 6. Device of A assigned to child one: sibling content closed; own reward request idempotent.
select pg_temp.actor('00000000-0000-4000-8000-000000009305','device',pg_temp.a());
select ok(gina.is_device(),'assigned device is live');
select is((select count(*)::int from public.children),1,'selected-mode device sees one child');
select throws_ok($$select public.complete_task('30000000-0000-4000-8000-000000009302',current_date,gen_random_uuid())$$,null,null,'device cannot complete the sibling task');
create function pg_temp.key() returns uuid language sql as $$select '50000000-0000-4000-8000-000000009301'::uuid$$;
select is((public.request_reward('40000000-0000-4000-8000-000000009301',pg_temp.key())).status::text,'requested','device requests reward');
select is((public.request_reward('40000000-0000-4000-8000-000000009301',pg_temp.key())).id,(select id from public.reward_requests where idempotency_key=pg_temp.key()),'same key returns the same request');
select is((select count(*)::int from public.reward_requests),1,'double tap created one request');
-- 7. Device of B with a forged family-A claim is not a device of A.
select pg_temp.actor('00000000-0000-4000-8000-000000009306','device',pg_temp.a());
select ok(not gina.is_device(),'foreign device with forged claim is not live');
select is((select count(*)::int from public.children),0,'foreign device reads no children');
select throws_ok($$select public.complete_task('30000000-0000-4000-8000-000000009301',current_date,gen_random_uuid())$$,null,null,'foreign device cannot complete A task');

-- 8. Parent A approves the reward (inventory + debit), archives child two, then deletes the account.
select pg_temp.actor('00000000-0000-4000-8000-000000009301','parent',pg_temp.a());
select is((public.decide_reward_request((select id from public.reward_requests where idempotency_key=pg_temp.key()),true)).status::text,'approved','parent approves');
select is((select coalesce(sum(delta),0)::int from public.star_events where child_id='20000000-0000-4000-8000-000000009301'),1,'reward debited once');
select is((select count(*)::int from public.child_inventory),1,'inventory row exists');
select is((public.set_child_archived(gen_random_uuid(),'20000000-0000-4000-8000-000000009302',0,true)->>'archived')::boolean,true,'child two archived');
reset role;
set local role postgres;
select set_config('request.jwt.claims','{}',true);
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000009301'$$,'last parent deletion with reward, inventory, archive state and receipts succeeds');
select is((select count(*)::int from public.families where id=pg_temp.a()::uuid),0,'family A removed');
select is((select count(*)::int from public.children where family_id=pg_temp.a()::uuid),0,'children removed');
select is((select count(*)::int from public.reward_requests where family_id=pg_temp.a()::uuid),0,'reward requests removed');
select is((select count(*)::int from public.child_inventory where family_id=pg_temp.a()::uuid),0,'inventory removed');
select is((select count(*)::int from public.help_receipts where family_id=pg_temp.a()::uuid),0,'receipts removed');
select is((select count(*)::int from gina.child_archive_state s where not exists(select 1 from public.children c where c.id=s.child_id)),0,'archive state removed with child');
select is((select count(*)::int from auth.users where id='00000000-0000-4000-8000-000000009305'),0,'anonymous device user removed');
select is((select count(*)::int from public.children where family_id=pg_temp.b()::uuid),1,'family B untouched');
select is((select count(*)::int from auth.users where id='00000000-0000-4000-8000-000000009306'),1,'family B device user untouched');
select * from finish();
rollback;
