begin;
select no_plan();
-- H07: AI ön inceleme aktivasyon hazırlığı — kapı kapalı varsayılan, ücretli çağrı defteri (aynı iş bir kez),
-- günlük kota (yarışsız, deneme harcamaz), çağrısız sonuçların iadesi, tükenmiş denemenin ücretsiz yöneticiye
-- taşınması, drain tetikleyici kaydı, sağlık okuması ve uyarılar, yetkisiz erişim reddi, AI sonucu ≠ insan onayı.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000013301','h07-admin@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000013302','h07-content@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000013303','h07-finance@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000013304','h07-parent@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000013305','h07-release@example.invalid',false,'{}');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000013301');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000013302','content',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000013303','finance',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000013305','release',now()+interval '30 days',null);
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000013301','H07 ailesi','00000000-0000-4000-8000-000000013304');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000013301','00000000-0000-4000-8000-000000013304');
-- Dört sentetik, görselsiz katkı (A..D).
insert into gina.contribution_sets(id,family_id,actor_id,snapshot,fingerprint,status,consent_version)
select ('70000000-0000-4000-8000-00000001330'||n)::uuid,'10000000-0000-4000-8000-000000013301','00000000-0000-4000-8000-000000013304',
 jsonb_build_object('title','H07 sentetik '||n,'body','','grade',5,'subject','Matematik','grouped',false,'images','[]'::jsonb,
  'questions',jsonb_build_array(jsonb_build_object('key','q1','kind','open_ended','stem',n||' + 1 kaçtır?','choices','[]'::jsonb,'topic','Toplama','grade',5,'subject','Matematik','difficulty','kolay','correct_key',null))),
 'fingerprint-h07-'||n,'pending','contribution-v1'
from generate_series(1,4) n;

create function pg_temp.actor(id text, admin boolean default false, family text default null) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',case when family is null then null else 'parent' end,'admin',admin))::text,true)::void$$;
create function pg_temp.service() returns void language sql as $$ select set_config('request.jwt.claims','{"role":"service_role"}',true)::void $$;
create function pg_temp.c(n int) returns uuid language sql as $$ select ('70000000-0000-4000-8000-00000001330'||n)::uuid $$;
create function pg_temp.lease(n int) returns uuid language sql as $$ select ('90000000-0000-4000-8000-0000000133'||lpad(n::text,2,'0'))::uuid $$;
create function pg_temp.claim(n int,l int) returns jsonb language sql as $$ select public.content_prereview_claim('contribution_set',pg_temp.c(n),pg_temp.lease(l),'prereview-v2') $$;
create function pg_temp.verdict() returns jsonb language sql as $$
 select jsonb_build_object('model','synthetic-model','provider','anthropic','confidence',0.95,'decision_reason','all_checks_passed','findings','[]'::jsonb,'recommendation','approve',
  'media',jsonb_build_object('count',0,'reviewed',false))$$;
-- Defter (RLS'li gina tablosu) testte sahip olarak okunur.
create function pg_temp.calls(n int default null) returns int language sql security definer as $$
 select count(*)::int from gina.content_prereview_calls where n is null or target_id=pg_temp.c(n) $$;
create function pg_temp.outcome(l int) returns text language sql security definer as $$ select outcome from gina.content_prereview_calls where lease=pg_temp.lease(l) $$;
create function pg_temp.row_of(n int) returns gina.content_prereviews language sql security definer as $$ select * from gina.content_prereviews where target_kind='contribution_set' and target_id=pg_temp.c(n) $$;
create function pg_temp.allowed(sql text) returns text language plpgsql as $$
begin execute sql; return 'allowed';
exception when insufficient_privilege then return 'forbidden';
 when others then if sqlerrm='forbidden' then return 'forbidden'; end if; return 'error:'||sqlerrm; end$$;
grant execute on function pg_temp.c(int),pg_temp.lease(int),pg_temp.claim(int,int),pg_temp.verdict(),pg_temp.allowed(text) to authenticated,service_role,anon;


select ok(not gina.content_prereview_admin_exempt('00000000-0000-4000-8000-000000013301'),'admin exemption defaults off');
update public.app_settings set value='true' where key in ('content_prereview.enabled','content_prereview.admin_daily_limit_exempt');
update public.app_settings set value='0' where key='content_prereview.daily_call_limit';
select ok(gina.content_prereview_admin_exempt('00000000-0000-4000-8000-000000013301'),'full admin exempt');
select ok(not gina.content_prereview_admin_exempt('00000000-0000-4000-8000-000000013302'),'content operator not exempt');
select ok(not gina.content_prereview_admin_exempt(null),'system job not exempt');
select gina.content_prereview_queue('contribution_set',pg_temp.c(1),'00000000-0000-4000-8000-000000013302');
select gina.content_prereview_queue('contribution_set',pg_temp.c(2),'00000000-0000-4000-8000-000000013301');
select gina.content_prereview_queue('contribution_set',pg_temp.c(3),'00000000-0000-4000-8000-000000013301');
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(1,1)->>'error','daily_limit','ordinary caller capped');
select is(jsonb_array_length(public.content_prereview_next(5)),2,'capped ordinary work does not starve admin queue');
select is(pg_temp.claim(2,2)->>'claimed','true','admin can claim beyond daily cap');
reset role;
select is(gina.content_prereview_calls_24h(),1,'admin call remains in total accounting');
select is(gina.content_prereview_budget_calls_24h(),0,'admin call does not consume ordinary budget');
select is((select requested_by from gina.content_prereview_calls where lease=pg_temp.lease(2)),'00000000-0000-4000-8000-000000013301'::uuid,'ledger snapshots trusted requester');
update public.app_settings set value='false' where key='content_prereview.enabled';
set local role service_role;
select is(pg_temp.claim(3,3)->>'error','prereview_disabled','admin cannot bypass kill switch');
reset role;
update public.app_settings set value='true' where key='content_prereview.enabled';
delete from public.admins where user_id='00000000-0000-4000-8000-000000013301';
select ok(not gina.content_prereview_admin_exempt('00000000-0000-4000-8000-000000013301'),'revoked admin immediately loses exemption');
set local role service_role;
select is(pg_temp.claim(3,3)->>'error','daily_limit','revoked admin cannot claim beyond cap');
reset role;
select ok(not has_function_privilege('authenticated','gina.content_prereview_admin_exempt(uuid)','execute'),'exemption helper private');
select is(gina.content_prereview_health()->>'budget_calls_24h','1','health counts revoked admin call against normal budget');
select is(gina.content_prereview_health()->>'calls_24h','1','health retains all paid calls');
select * from finish();
rollback;
