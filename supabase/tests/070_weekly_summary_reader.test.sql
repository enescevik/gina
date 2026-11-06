-- Weekly parent reader: identity, recovery and authorization.
begin;
select no_plan();
create function pg_temp.review(d date default null) returns jsonb language sql as $$select public.get_family_weekly_review(d)$$;

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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated"}',true);
select throws_ok($$select pg_temp.review()$$,'42501','weekly_forbidden','missing family claim rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.review()->>'week_start',pg_temp.week()::text,'default uses family closed week');
select is(jsonb_array_length(pg_temp.review()->'weeks'),8,'eight completed weeks');
select is(pg_temp.review()->>'state','empty','read does not start generation');
select is(pg_temp.review()->>'access','disabled','free plan sees facts');
select is(pg_temp.review()#>>'{children,0,name}','Çocuk P','fresh facts have live name');
select throws_ok($$select pg_temp.review(pg_temp.week(0))$$,'P0001','weekly_date','current week rejected');
select throws_ok($$select pg_temp.review(pg_temp.week(9))$$,'P0001','weekly_date','older week rejected');
select throws_ok($$select pg_temp.review('infinity')$$,'P0001','weekly_date','infinite date rejected');
select lives_ok($$select pg_temp.review(pg_temp.week(8))$$,'eighth week accepted');
select throws_ok($$select child_aliases from gina.weekly_summary_contexts$$,'42501',null,'identity map remains private');
reset role;
select is((select count(*)::int from gina.weekly_summary_contexts),0,'read creates no context');
select is((select count(*)::int from public.ai_operation_jobs),0,'read consumes no quota');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-0000-0000-0000000000e1','pro','test',now()+interval '1 day');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table context as select pg_temp.prepare() value;
create temporary table job as select pg_temp.reserve((select (value->>'id')::uuid from context)) value;
reset role;
select is((select child_aliases->>'Çocuk A' from gina.weekly_summary_contexts),'20000000-0000-0000-0000-00000000e1c1','frozen alias captures child id');
select ok((select context::text !~ 'Çocuk P|Kardeş|e1c1|e1c2' from gina.weekly_summary_contexts),'provider context has no names or ids');
update public.children set sort_order=-5,name='Yeni ad' where id='20000000-0000-0000-0000-00000000e1c2';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.review()#>>'{children,0,name}','Çocuk P','reordering does not swap frozen identities');
select is(pg_temp.review()#>>'{children,1,name}','Yeni ad','renamed sibling resolved by id');
select is(pg_temp.review()->>'state','working','active generation visible');
select is(pg_temp.review()->>'can_generate','false','working cannot generate again');
select ok(not(pg_temp.review() ?| array['context','config','child_aliases','lease']),'private execution details not exposed');
reset role;
update public.ai_operation_jobs set updated_at=now()-interval '4 minutes' where action='weekly';
set local role authenticated;
select is(pg_temp.review()->>'state','uncertain','stale working is uncertain');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.finish_ai_operation((select (value->>'id')::uuid from job),'00000000-0000-4000-8000-000000008811','{"output":{"haftanin_ozeti":"Synthetic saved output"},"inputTokens":10,"outputTokens":5}');
reset role;
delete from public.entitlement_overrides where family_id='10000000-0000-0000-0000-0000000000e1';
insert into public.app_settings(key,value) values('ai.enabled','false') on conflict (key) do update set value=excluded.value;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.review()->>'state','ready','saved job readable after plan downgrade and AI shutdown');
select is(pg_temp.review()#>>'{summary,haftanin_ozeti}','Synthetic saved output','lost final store recovers without provider');
select is(pg_temp.review()->>'can_generate','false','ready never requests generation');
reset role;
select is((select count(*)::int from public.ai_summaries),0,'recovery does not require final summary record');
select is((select count(*)::int from public.ai_operation_jobs),1,'repeated reads do not create jobs');
-- Existing contexts are deliberately not backfilled from a new child order.
update gina.weekly_summary_contexts set child_aliases=null;
set local role authenticated;
select is(pg_temp.review()#>>'{children,0,name}',null,'legacy identity remains unknown');
select is(pg_temp.review()#>>'{children,0,alias}','Çocuk A','legacy alias remains visible');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select throws_ok($$select pg_temp.review()$$,'42501','weekly_forbidden','foreign member with forged family claim rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select throws_ok($$select pg_temp.review()$$,'42501','weekly_forbidden','child cannot read family AI suggestions');
reset role;
delete from public.children where id='20000000-0000-0000-0000-00000000e1c1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is(pg_temp.review()->>'state','empty','child deletion removes derived result');
select is(pg_temp.review()->'summary','null'::jsonb,'deleted context output cannot be recovered');
reset role;
delete from public.children where family_id='10000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select is(pg_temp.review()->>'access','no_children','empty family gets useful state');
reset role;
delete from public.family_members where family_id='10000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select throws_ok($$select pg_temp.review()$$,'42501','weekly_forbidden','revoked parent cannot recover cached output');
reset role;
select * from finish();
rollback;
