-- Weekly timetable authorization, validation, atomicity and calendar projection.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-pet@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000e1d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-pet2@test.local', '', now(), '{}', '{}', now(), now());
insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000000e1', 'Aile P', '00000000-0000-0000-0000-00000000e101'),
  ('10000000-0000-0000-0000-0000000000e2', 'Aile Q', '00000000-0000-0000-0000-00000000e201');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e101'),
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000e201');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-00000000e1c1', '10000000-0000-0000-0000-0000000000e1', 'Çocuk P');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-00000000e1c1', '10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000e1d1', '20000000-0000-0000-0000-00000000e1c1');


insert into public.children(id,family_id,name) values ('20000000-0000-0000-0000-00000000e1c2','10000000-0000-0000-0000-0000000000e1','Kardeş');
insert into public.events(family_id,child_id,title,starts_at) values('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1','Mevcut etkinlik',now());



create function pg_temp.week(offset_weeks int default 1) returns date language sql as $$select date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7*offset_weeks$$;
create function pg_temp.read(f uuid default '10000000-0000-0000-0000-0000000000e1',d date default pg_temp.week()) returns jsonb language sql as $$select public.get_weekly_summary_data(f,d)$$;
create function pg_temp.prepare(d date default pg_temp.week(),config jsonb default '{"config":{"model":"claude-sonnet-5-5","maxOutputTokens":1500,"promptVersion":"v2"},"system":"synthetic","schema":{"type":"object"}}') returns jsonb language sql as $$select public.prepare_weekly_summary('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e101',d,config)$$;
create function pg_temp.reserve(c uuid,lease uuid default '00000000-0000-4000-8000-000000008811') returns jsonb language sql as $$select public.reserve_weekly_summary('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e101',c,lease)$$;
create function pg_temp.store(c uuid,j uuid) returns jsonb language sql as $$select public.store_weekly_summary('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e101',c,j)$$;
insert into public.task_templates(id,family_id,child_id,title,stars,starts_on) values('40000000-0000-4000-8000-000000008801','10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1','PRIVATE school medical note',3,pg_temp.week());
insert into public.task_completions(family_id,child_id,template_id,due_date,status,client_id) values('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1','40000000-0000-4000-8000-000000008801',pg_temp.week(),'done',gen_random_uuid());
insert into public.star_events(family_id,child_id,delta,reason,created_at) values
 ('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1',3,'task_approved',pg_temp.week()::timestamp at time zone 'Europe/Istanbul'),
 ('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1',9,'task_approved',pg_temp.week()::timestamp at time zone 'Europe/Istanbul'-interval '1 second'),
 ('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1',15,'task_approved',(pg_temp.week()+7)::timestamp at time zone 'Europe/Istanbul'),
 ('10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-00000000e1c1',-2,'reward',pg_temp.week()::timestamp at time zone 'Europe/Istanbul');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated"}',true);
select throws_ok($$select pg_temp.read()$$,'42501','weekly_forbidden','missing family claim never means service role');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select pg_temp.read()$$,'42501','weekly_forbidden','null auth also rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.read()#>>'{children,0,alias}','Çocuk A','own parent reads aliases');
select is(pg_temp.read()#>>'{children,0,stars_earned}','3','family timezone boundaries and no reward spending subtraction');
select is(pg_temp.read()#>>'{children,0,tasks,0,count}','1','only recorded status count');
select is(pg_temp.read()#>>'{children,0,tasks,0,status}','done','pending not approved');
select ok(pg_temp.read()::text !~ 'PRIVATE|Çocuk P|Kardeş|e1c1|birth_date|title','no names identifiers birth dates or free task text');
select ok(not(pg_temp.read() ? 'next_week_events'),'no misleading unexpanded future recurrence');
select throws_ok($$select pg_temp.read(d=>pg_temp.week(0))$$,'P0001','weekly_date','unfinished current week not summarized');
select throws_ok($$select pg_temp.read(d=>pg_temp.week(9))$$,'P0001','weekly_date','older than eight weeks rejected');
select throws_ok($$select pg_temp.read(d=>pg_temp.week()+1)$$,'P0001','weekly_date','not Monday rejected');
select throws_ok($$select pg_temp.read(d=>'infinity')$$,'P0001','weekly_date','infinite dates rejected');
select throws_ok($$select pg_temp.read(d=>null)$$,'P0001','weekly_date','null dates rejected');
select lives_ok($$select pg_temp.read(d=>pg_temp.week(8))$$,'eighth closed week allowed');
select throws_ok($$select pg_temp.read(f=>'10000000-0000-0000-0000-0000000000e2')$$,'42501','weekly_forbidden','parent cannot read another family');
select throws_ok($$select pg_temp.prepare()$$,'42501',null,'parent cannot freeze paid server context');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.read()$$,'42501','weekly_forbidden','child device cannot obtain siblings summary input');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select pg_temp.prepare()$$,'P0001','plan_has_no_ai','free plan cannot prepare');
reset role;
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-0000-0000-0000000000e1','pro','test',now()+interval '1 day');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$update public.ai_summaries set output_json='{}'$$,'42501',null,'legacy direct service writer cannot bypass result binding');
create temporary table context as select pg_temp.prepare() value;
select is(pg_temp.prepare(),(select value from context),'same week freezes exact context');
select is(pg_temp.prepare(config=>'{"config":{"model":"changed"},"system":"changed","schema":{}}'),(select value from context),'model or prompt change does not change saved generation');
select throws_ok($$select pg_temp.prepare(pg_temp.week(2),'{}')$$,'P0001','weekly_context_invalid','new invalid context rejected');
create temporary table job as select pg_temp.reserve((select (value->>'id')::uuid from context)) value;
select ok((select value ? 'id' from job),'first operation reserved');
select is(pg_temp.reserve((select (value->>'id')::uuid from context))->>'error','generation_in_progress','second caller cannot generate');
select lives_ok($$select public.finish_ai_operation((select (value->>'id')::uuid from job),'00000000-0000-4000-8000-000000008811','{"output":{"synthetic":true},"inputTokens":10,"outputTokens":5}')$$,'one provider result stored');
select ok(pg_temp.reserve((select (value->>'id')::uuid from context)) ? 'cached','lost reply reuses stored output');
select is(pg_temp.store((select (value->>'id')::uuid from context),(select (value->>'id')::uuid from job)),'{"synthetic":true}'::jsonb,'publish summary from completed matching job');
select is(pg_temp.store((select (value->>'id')::uuid from context),(select (value->>'id')::uuid from job)),'{"synthetic":true}'::jsonb,'same completion stores one summary');
select is((select count(*)::int from public.ai_summaries),1,'no duplicate summary');
create temporary table other_context as select pg_temp.prepare(pg_temp.week(2)) value;
select throws_ok($$select pg_temp.store((select (value->>'id')::uuid from other_context),(select (value->>'id')::uuid from job))$$,'P0001','weekly_result_unavailable','a result cannot attach to another week');
select throws_ok($$select public.prepare_weekly_summary('10000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000e201',pg_temp.week(),'{}')$$,'42501','weekly_forbidden','foreign parent rejected even through service');
reset role;
insert into public.app_settings(key,value) values('ai.enabled','false') on conflict (key) do update set value=excluded.value;
set local role service_role;
select is(pg_temp.reserve((select (value->>'id')::uuid from other_context))->>'error','ai_disabled','global pause prevents provider reservation');
reset role;
insert into public.app_settings(key,value) values('ai.enabled','true') on conflict (key) do update set value=excluded.value;
update public.ai_operation_policies set monthly_limit=1 where action='weekly' and plan_code='pro';
set local role service_role;
select is(pg_temp.reserve((select (value->>'id')::uuid from other_context))->>'error','ai_quota_exceeded','monthly quota before second week provider');
reset role;
update public.ai_operation_policies set monthly_limit=5 where action='weekly' and plan_code='pro';
set local role service_role;
create temporary table job2 as select pg_temp.reserve((select (value->>'id')::uuid from other_context),'00000000-0000-4000-8000-000000008812') value;
select lives_ok($$select public.finish_ai_operation((select (value->>'id')::uuid from job2),'00000000-0000-4000-8000-000000008812',null,'provider_outcome_unknown',true)$$,'uncertain provider outcome recorded');
select is(pg_temp.reserve((select (value->>'id')::uuid from other_context))->>'error','ai_result_uncertain','uncertain request not automatically recharged');
reset role;
delete from public.children where id='20000000-0000-0000-0000-00000000e1c1';
select is((select count(*)::int from gina.weekly_summary_contexts),0,'child deletion clears shared anonymized contexts');
select is((select count(*)::int from public.ai_summaries),0,'child deletion clears derived summaries');
select is((select count(*)::int from public.ai_operation_jobs where action='weekly' and result is not null),0,'derived results removed but usage retained');
select is((select count(*)::int from public.ai_operation_jobs where action='weekly'),2,'deletion does not reset charged usage');
set local role service_role;
select throws_ok($$select pg_temp.reserve((select (value->>'id')::uuid from context))$$,'P0001','weekly_context_unavailable','deleted context cannot restart');
select throws_ok($$select public.finish_ai_operation((select (value->>'id')::uuid from job2),'00000000-0000-4000-8000-000000008812','{"output":{}}')$$,'P0001','lease_lost','late provider cannot restore deleted child information');
reset role;
insert into public.admins(user_id) values('00000000-0000-0000-0000-00000000e101');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent","admin":true}}',true);
select throws_ok($$select public.admin_retry_ai_operation((select id from public.ai_operation_jobs limit 1),'Checked provider context deleted')$$,'42501',null,'raw private job table remains unavailable to admin client');
reset role;
create temporary table retry_id as select id from public.ai_operation_jobs where action='weekly' limit 1;
grant select on retry_id to authenticated;
set local role authenticated;
select throws_ok($$select public.admin_retry_ai_operation((select id from retry_id),'Checked provider context deleted')$$,'P0001','job_not_retryable','deleted context cannot be operator recharged');
select ok(not exists(select 1 from jsonb_array_elements(public.admin_ai_operations()->'jobs')j where j->>'action'='weekly' and (j->>'retryable')::boolean),'operator view hides retry for removed source');
reset role;
delete from public.family_members where user_id='00000000-0000-0000-0000-00000000e101';
set local role authenticated;
select throws_ok($$select pg_temp.read()$$,'42501','weekly_forbidden','removed parent stale claim cannot read');
reset role;
set local role anon;
select throws_ok($$select pg_temp.read()$$,'42501',null,'anonymous cannot call input RPC');
reset role;
select * from finish();rollback;
