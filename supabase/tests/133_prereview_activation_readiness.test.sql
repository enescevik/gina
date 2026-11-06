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

-- 1. Varsayılanlar: kapı kapalı, kota 25; migration kapıyı açmaz ---------------------------------------------
select is((select value from public.app_settings where key='content_prereview.enabled'),'false'::jsonb,'gate stays closed by default (H07 does not enable it)');
select is((select value from public.app_settings where key='content_prereview.daily_call_limit'),'25'::jsonb,'daily paid-call limit default 25');
select is(gina.content_prereview_daily_limit(),25,'limit helper reads the setting');

-- 2. Yetki yüzeyi: istemci claim/finish/next/sağlık-iç çağıramaz; anon hiçbir şey -------------------------------
select ok(not has_function_privilege('anon','public.admin_content_prereview_health()','execute'),'anon cannot read prereview health');
select ok(not has_function_privilege('service_role','public.admin_content_prereview_health()','execute'),'service_role is not an operator');
select ok(has_function_privilege('authenticated','public.admin_content_prereview_health()','execute'),'operators call it as authenticated (role checked inside)');
select ok(not has_function_privilege('authenticated','gina.content_prereview_health()','execute') and not has_function_privilege('service_role','gina.content_prereview_health()','execute')
 and not has_function_privilege('anon','gina.content_prereview_health()','execute'),'internal health is owner-only (SQL editor)');
select ok(not has_function_privilege('authenticated','public.content_prereview_claim(text,uuid,uuid,text)','execute')
 and not has_function_privilege('authenticated','public.content_prereview_finish(text,uuid,uuid,text,jsonb,text)','execute')
 and not has_function_privilege('authenticated','public.content_prereview_next(integer)','execute')
 and not has_function_privilege('anon','public.content_prereview_claim(text,uuid,uuid,text)','execute'),'worker RPCs are service-only');
select ok(not has_function_privilege('authenticated','gina.kick_content_prereview()','execute') and not has_function_privilege('anon','gina.kick_content_prereview()','execute'),'clients cannot kick the drain');
select ok(not has_table_privilege('authenticated','gina.content_prereview_calls','select') and not has_table_privilege('service_role','gina.content_prereview_calls','select')
 and not has_table_privilege('authenticated','gina.content_prereview_kicks','select'),'ledger and kick log are not client readable');

-- 3. Kapı kapalı: claim reddedilir, defter boş, tetikleyici istek atmaz ------------------------------------------
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(1,1)->>'error','prereview_disabled','gate closed: claim refused (no paid call possible)');
reset role;
select gina.kick_content_prereview();
select is(pg_temp.calls(),0,'gate closed: ledger empty');
select is((select count(*)::int from gina.content_prereview_kicks),0,'gate closed: drain kick records nothing (no request)');

-- 4. Kapı açık, kota 2: aynı iş bir kez ücretlenir ----------------------------------------------------------
update public.app_settings set value='true' where key='content_prereview.enabled';
update public.app_settings set value='2' where key='content_prereview.daily_call_limit';
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(1,1)->>'claimed','true','A claimed');
select is(pg_temp.claim(1,2)->>'error','in_progress','A in flight: second claim does not create a second paid attempt');
reset role;
select is(pg_temp.calls(1),1,'A: one ledger row while in flight');
select is(pg_temp.outcome(1),'claimed','ledger row is open until finish');
set local role service_role;
select pg_temp.service();
select is(public.content_prereview_finish('contribution_set',pg_temp.c(1),pg_temp.lease(1),'ai_approved',pg_temp.verdict(),null)->>'prereview_status','ai_approved','A finished ai_approved');
select is(pg_temp.claim(1,3)->>'cached','true','A replay is cached');
select throws_ok($$select public.content_prereview_finish('contribution_set',pg_temp.c(1),pg_temp.lease(1),'ai_approved',pg_temp.verdict(),null)$$,'lease_lost','a replayed finish cannot be recorded twice');
reset role;
select is(pg_temp.calls(1),1,'A: still exactly one ledger row (charged once)');
select is(pg_temp.outcome(1),'ai_approved','ledger carries the outcome');

-- 5. AI onayı insan onayı değildir; insan kararı ve yayın ayrı kalır ------------------------------------------
select is((select status from gina.contribution_sets where id=pg_temp.c(1)),'pending','ai_approved leaves the contribution pending');
select ok((select reviewed_by is null and reviewed_at is null from gina.contribution_sets where id=pg_temp.c(1)),'no human reviewer recorded by the AI');
select ok(gina.content_prereview_awaiting('contribution_set',pg_temp.c(1)),'record still awaits the admin decision');
select is((select actor_id from public.audit_log where action='content_prereview.ai_approved' and target_id='contribution_set:'||pg_temp.c(1)::text),null::uuid,'AI audit row has a null (system) actor, apart from human decisions');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','gina') and p.prokind='f' and p.proname like '%prereview%'
  and pg_get_functiondef(p.oid) ~* '(update|insert into)\s+(gina\.contribution_sets|gina\.library_publications|gina\.library_editorial_reviews|gina\.curriculum_candidates|gina\.library_content_items)'),0,
 'no pre-review function writes a human decision / publication table');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','gina') and p.prokind='f' and p.proname not like '%prereview%'
  and pg_get_functiondef(p.oid) ~* '(update|insert into)\s+gina\.content_prereviews'),0,
 'only pre-review functions write the AI record');

-- 6. Kota: ikinci iş alınır, üçüncüsü daily_limit (kayıt oluşmaz, deneme harcanmaz) ------------------------------
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(2,4)->>'claimed','true','B claimed (2/2)');
select is(pg_temp.claim(3,5)->>'error','daily_limit','C refused: daily limit reached');
reset role;
select is((pg_temp.row_of(3)).target_id,null::uuid,'C: no pre-review row created by a refused claim');
select is(pg_temp.calls(3),0,'C: no ledger row');
select ok((gina.content_prereview_health()->'alerts') ? 'daily_limit_reached','health alerts daily_limit_reached');
select is((gina.content_prereview_health()->>'remaining_24h')::int,0,'health: remaining 0');

-- 7. Çağrısız sonuç (duraklatılmış sağlayıcı / sağlık okunamadı): not_called, deneme ve kota iadesi --------------
set local role service_role;
select pg_temp.service();
select is((public.content_prereview_finish('contribution_set',pg_temp.c(2),pg_temp.lease(4),'pending',null,'provider_health_unavailable')->>'attempts')::int,0,'B: attempt refunded (no call)');
reset role;
select is(pg_temp.outcome(4),'not_called','B ledger: not_called');
select is(gina.content_prereview_calls_24h(),1,'not_called does not count toward the quota');
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(3,6)->>'claimed','true','C claimed once budget is free again');
select is((public.content_prereview_finish('contribution_set',pg_temp.c(3),pg_temp.lease(6),'pending',null,'anthropic_503')->>'attempts')::int,1,'C: transient provider failure keeps the attempt');
reset role;
select is(pg_temp.outcome(6),'retry','C ledger: retry (counted as paid)');
select is(gina.content_prereview_calls_24h(),2,'retry counts toward the quota');

-- 8. Tükenmiş deneme hakkı pending kalmışsa drain alır, claim ücretsiz needs_admin yapar --------------------------
insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,attempts,last_error,lease,claimed_at)
select 'contribution_set',pg_temp.c(4),gina.content_prereview_hash(gina.content_prereview_source('contribution_set',pg_temp.c(4))),'prereview-v2',3,'edge_crashed',pg_temp.lease(99),now()-interval '10 minutes';
select ok((gina.content_prereview_health()->'alerts') ? 'retry_exhausted_pending','health alerts the stuck record');
set local role service_role;
select pg_temp.service();
select is((public.content_prereview_next(5)->0->>'id')::uuid,pg_temp.c(4),'next lists the exhausted record first');
select is(pg_temp.claim(4,7)->>'error','retry_limit','claim moves it to retry_limit (even with the quota exhausted)');
reset role;
select is((pg_temp.row_of(4)).prereview_status,'needs_admin','D now waits for the admin');
select is(pg_temp.calls(4),0,'D: no paid call recorded');
select is((select count(*)::int from gina.content_prereview_calls where outcome not in('not_called')),2,'total paid attempts so far: A + C');

-- 9. Bitmemiş çağrı (lease kayboldu) ve drain tetikleyici izlemede görünür ----------------------------------------
update public.app_settings set value='10' where key='content_prereview.daily_call_limit';
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(2,8)->>'claimed','true','B re-claimed');
reset role;
update gina.content_prereview_calls set claimed_at=now()-interval '5 minutes' where lease=pg_temp.lease(8);
update gina.content_prereviews set claimed_at=now()-interval '5 minutes' where target_kind='contribution_set' and target_id=pg_temp.c(2);
select is((gina.content_prereview_health()->>'unfinished_calls')::int,1,'health counts the unfinished (lease lost) call');
select ok((gina.content_prereview_health()->'alerts') ? 'unfinished_calls','alert unfinished_calls');
select lives_ok($$select gina.kick_content_prereview()$$,'kick with gate open and no Vault secrets does not fail');
select is((select note from gina.content_prereview_kicks order by id desc limit 1),'vault_secret_missing','kick records the missing Vault secret instead of posting');
select ok((gina.content_prereview_health()->'alerts') ? 'vault_secret_missing','health alerts vault_secret_missing');
select ok(jsonb_typeof(gina.content_prereview_health()->'cron') in('object','null'),'health reports the pg_cron job (or its absence)');

-- 10. Kill switch: kapı kapanınca bekleyen kayıt alınamaz ve tetikleyici sessiz kalır -----------------------------
update public.app_settings set value='false' where key='content_prereview.enabled';
set local role service_role;
select pg_temp.service();
select is(pg_temp.claim(3,9)->>'error','prereview_disabled','kill switch: claim refused immediately');
reset role;
select gina.kick_content_prereview();
select is((select count(*)::int from gina.content_prereview_kicks),1,'kill switch: kick adds nothing');

-- 11. Rol kapılı sağlık okuması ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000013301',true);
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'allowed','full admin reads health');
select ok((public.admin_content_prereview_health() ?& array['enabled','daily_call_limit','calls_24h','queue','providers','cron','kicks','alerts']),'health shape');
select pg_temp.actor('00000000-0000-4000-8000-000000013302');
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'allowed','content operator reads health');
select pg_temp.actor('00000000-0000-4000-8000-000000013303');
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'forbidden','finance refused');
select pg_temp.actor('00000000-0000-4000-8000-000000013305');
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'forbidden','release refused');
select pg_temp.actor('00000000-0000-4000-8000-000000013304',false,'10000000-0000-4000-8000-000000013301');
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'forbidden','parent refused');
select is(pg_temp.allowed($$select public.content_prereview_claim('contribution_set','70000000-0000-4000-8000-000000013301','90000000-0000-4000-8000-000000013300','prereview-v2')$$),'forbidden','parent cannot claim');
reset role;
set local role anon;
select is(pg_temp.allowed($$select public.admin_content_prereview_health()$$),'forbidden','anon refused');
reset role;

-- 12. C07 kapıları korunur (pgTAP 113) ------------------------------------------------------------------
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in('admin_content_prereviews','request_content_prereview','enqueue_content_prereview')
 and pg_get_functiondef(p.oid) like '%assert_operation_role%'),3,'C07 role gate still on the three queue RPCs');

select * from finish();
rollback;
