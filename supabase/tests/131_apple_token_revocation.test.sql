-- H01: Apple token storage + durable revocation jobs (20261106460000_apple_token_revocation).
-- Tables are server-only (RLS on, no grants); RPCs are service_role only; begin is idempotent per request id and
-- never reused by another account; retry/backoff/max attempts; terminal states erase the token; the job survives
-- account deletion while the stored token cascades away.
begin;
select no_plan();

create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"a1310000-0000-4000-8000-0000000000a1","role":"authenticated"}',true)$$;

insert into auth.users(id,email,is_anonymous) values
 ('a1310000-0000-4000-8000-0000000000a1','h01-a1@example.invalid',false),
 ('a1310000-0000-4000-8000-0000000000a2','h01-a2@example.invalid',false),
 ('a1310000-0000-4000-8000-0000000000a3','h01-a3@example.invalid',false);

-- Structure, RLS, grants ------------------------------------------------------------------------------
select has_table('gina','apple_auth_tokens','token table exists');
select has_table('gina','apple_revocation_jobs','job table exists');
select ok((select relrowsecurity from pg_class where oid='gina.apple_auth_tokens'::regclass),'RLS on token table');
select ok((select relrowsecurity from pg_class where oid='gina.apple_revocation_jobs'::regclass),'RLS on job table');
select ok(not has_table_privilege(r,'gina.apple_auth_tokens','select') and not has_table_privilege(r,'gina.apple_auth_tokens','insert')
  and not has_table_privilege(r,'gina.apple_revocation_jobs','select') and not has_table_privilege(r,'gina.apple_revocation_jobs','update'),
  'no direct table access for '||r) from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_function_privilege(r,f,'execute'),r||' cannot execute '||f)
  from unnest(array['anon','authenticated']) r,
       unnest(array['public.apple_token_store(uuid,text,text,text,text)','public.apple_revocation_begin(uuid,uuid,text,text,text,text,boolean)',
                     'public.apple_revocation_record(uuid,text,text)','public.apple_revocation_claim(integer)','public.apple_revocation_mark_deleted(uuid)']) f;
select ok(has_function_privilege('service_role',f,'execute'),'service_role executes '||f)
  from unnest(array['public.apple_token_store(uuid,text,text,text,text)','public.apple_revocation_begin(uuid,uuid,text,text,text,text,boolean)',
                    'public.apple_revocation_record(uuid,text,text)','public.apple_revocation_claim(integer)','public.apple_revocation_mark_deleted(uuid)']) f;
select ok(not has_function_privilege(r,'gina.purge_apple_revocation_jobs()','execute'),r||' cannot purge')
  from unnest(array['anon','authenticated','service_role']) r;

-- Defence in depth: a service_role grant is not enough without the service_role JWT role.
set local role service_role; select pg_temp.parent();
select throws_ok($$select public.apple_token_store('a1310000-0000-4000-8000-0000000000a1','sub-a1','com.enescevik.gina','refresh_token','v1.aaaa.bbbb')$$,'42501',null,'store rejects non-service JWT');
select throws_ok($$select public.apple_revocation_claim(5)$$,'42501',null,'claim rejects non-service JWT');
reset role;

-- Store / replace ---------------------------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select lives_ok($$select public.apple_token_store('a1310000-0000-4000-8000-0000000000a1','sub-a1','com.enescevik.gina','refresh_token','v1.aaaa.old0')$$,'store token');
select lives_ok($$select public.apple_token_store('a1310000-0000-4000-8000-0000000000a1','sub-a1','com.enescevik.gina.web','refresh_token','v1.aaaa.new0')$$,'replace token');
select throws_ok($$select public.apple_token_store('a1310000-0000-4000-8000-0000000000a2','sub-a2','com.enescevik.gina','refresh_token','plaintext-token')$$,'23514',null,'plaintext is rejected by the ciphertext format');
reset role;
select is((select token_ciphertext||'|'||client_id from gina.apple_auth_tokens where user_id='a1310000-0000-4000-8000-0000000000a1'),'v1.aaaa.new0|com.enescevik.gina.web','one row per account, replaced');

-- Begin: stored token, idempotent, conflict ---------------------------------------------------------------
set local role service_role; select pg_temp.service();
create temp table j131 as select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-0000000000a1','sub-a1') as r;
select is((select r->>'status' from j131),'pending','stored token starts a pending job');
select is((select r->>'token_ciphertext' from j131),'v1.aaaa.new0','job carries the stored ciphertext');
select is((select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-0000000000a1','sub-a1')->>'job_id'),
  (select r->>'job_id' from j131),'same request id returns the same job');
select is((select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-0000000000a2','sub-a2')->>'status'),
  'request_conflict','another account cannot reuse the request id');
select is((select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-0000000000a1','sub-a1','com.enescevik.gina','refresh_token','v1.ffff.fres')->>'token_ciphertext'),
  'v1.ffff.fres','a fresh token replaces the token of a pending job');
select throws_ok($$select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000009','a1310000-0000-4000-8000-0000000000a1','sub-a1','com.enescevik.gina',null,'v1.ffff.fres')$$,'22023',null,'partial token input rejected');
reset role;
select is((select count(*)::int from gina.apple_revocation_jobs where request_id='a1310000-0000-4000-8000-000000000001'),1,'still a single job');

-- Begin without any token ---------------------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select is((select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000002','a1310000-0000-4000-8000-0000000000a2','sub-a2')->>'status'),
  'token_required','no token and no fresh Apple re-auth: nothing created');
reset role;
select is((select count(*)::int from gina.apple_revocation_jobs where user_id='a1310000-0000-4000-8000-0000000000a2'),0,'token_required leaves no row');
set local role service_role; select pg_temp.service();
create temp table u131 as select public.apple_revocation_begin('a1310000-0000-4000-8000-000000000002','a1310000-0000-4000-8000-0000000000a2','sub-a2',null,null,null,true) as r;
select is((select r->>'status' from u131),'token_unavailable','after fresh Apple re-auth without token: terminal token_unavailable (manual)');
select is((select public.apple_revocation_record((select (r->>'job_id')::uuid from u131),'succeeded')),
  'token_unavailable','a terminal job never flips to succeeded');
reset role;
select ok((select token_ciphertext is null and completed_at is not null and last_error='no_token' from gina.apple_revocation_jobs where request_id='a1310000-0000-4000-8000-000000000002'),'token_unavailable has no token');

-- Retry / backoff / claim ---------------------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select is((select public.apple_revocation_record((select (r->>'job_id')::uuid from j131),'retry','timeout')),'pending','timeout keeps the job pending');
reset role;
select ok((select attempts=1 and last_error='timeout' and next_attempt_at > now() + interval '4 minutes' from gina.apple_revocation_jobs where id=(select (r->>'job_id')::uuid from j131)),'attempt counted, backoff set');
set local role service_role; select pg_temp.service();
select is((select count(*)::int from public.apple_revocation_claim(10)),0,'not due yet: nothing claimed');
reset role;
update gina.apple_revocation_jobs set next_attempt_at = now() - interval '1 minute' where id=(select (r->>'job_id')::uuid from j131);
set local role service_role; select pg_temp.service();
select is((select count(*)::int from public.apple_revocation_claim(10)),1,'due job claimed');
select is((select count(*)::int from public.apple_revocation_claim(10)),0,'claimed job is leased');
select throws_ok($$select public.apple_revocation_record('a1310000-0000-4000-8000-000000000099','succeeded')$$,'P0002',null,'unknown job');
select throws_ok($$select public.apple_revocation_record((select (r->>'job_id')::uuid from j131),'done')$$,'22023',null,'unknown outcome');
reset role;

-- Success erases token and the stored copy; repeat is a no-op ------------------------------------------------
set local role service_role; select pg_temp.service();
select is((select public.apple_revocation_record((select (r->>'job_id')::uuid from j131),'succeeded')),'succeeded','revoked');
select is((select public.apple_revocation_record((select (r->>'job_id')::uuid from j131),'retry','timeout')),'succeeded','repeat record does not reopen');
select lives_ok($$select public.apple_revocation_mark_deleted((select (r->>'job_id')::uuid from j131))$$,'mark deleted');
reset role;
select ok((select token_ciphertext is null and apple_sub is null and completed_at is not null and account_deleted_at is not null and attempts=2
  from gina.apple_revocation_jobs where id=(select (r->>'job_id')::uuid from j131)),'succeeded job keeps no token or Apple subject');
select is((select count(*)::int from gina.apple_auth_tokens where user_id='a1310000-0000-4000-8000-0000000000a1'),0,'stored token removed after revocation');

-- invalid_grant → failed; 12 attempts → failed(max_attempts) ----------------------------------------------
set local role service_role; select pg_temp.service();
select public.apple_token_store('a1310000-0000-4000-8000-0000000000a3','sub-a3','com.enescevik.gina','access_token','v1.cccc.dddd');
create temp table k131 as select (public.apple_revocation_begin('a1310000-0000-4000-8000-000000000003','a1310000-0000-4000-8000-0000000000a3','sub-a3')->>'job_id')::uuid as id;
select is((select public.apple_revocation_record((select id from k131),'failed','token_invalid')),'failed','invalid token is terminal');
create temp table m131 as select (public.apple_revocation_begin('a1310000-0000-4000-8000-000000000004','a1310000-0000-4000-8000-0000000000a3','sub-a3','com.enescevik.gina','refresh_token','v1.eeee.ffff')->>'job_id')::uuid as id;
select public.apple_revocation_record((select id from m131),'retry','apple_unavailable') from generate_series(1,11);
reset role;
select is((select status||'|'||attempts from gina.apple_revocation_jobs where id=(select id from m131)),'pending|11','11 retries still pending');
set local role service_role; select pg_temp.service();
select is((select public.apple_revocation_record((select id from m131),'retry','apple_unavailable')),'failed','12th attempt gives up');
reset role;
select ok((select last_error='max_attempts' and token_ciphertext is null from gina.apple_revocation_jobs where id=(select id from m131)),'max_attempts recorded, token erased');
select throws_ok($$insert into gina.apple_revocation_jobs(request_id,user_id,status,next_attempt_at) values ('a1310000-0000-4000-8000-000000000005','a1310000-0000-4000-8000-0000000000a3','pending',now())$$,
  '23514',null,'a pending job without token is impossible');

-- Account deletion: stored token cascades, job survives ---------------------------------------------------
set local role service_role; select pg_temp.service();
select public.apple_token_store('a1310000-0000-4000-8000-0000000000a2','sub-a2','com.enescevik.gina','refresh_token','v1.gggg.hhhh');
create temp table n131 as select (public.apple_revocation_begin('a1310000-0000-4000-8000-000000000006','a1310000-0000-4000-8000-0000000000a2','sub-a2')->>'job_id')::uuid as id;
reset role;
delete from auth.users where id='a1310000-0000-4000-8000-0000000000a2';
select is((select count(*)::int from gina.apple_auth_tokens where user_id='a1310000-0000-4000-8000-0000000000a2'),0,'stored token deleted with the user');
select is((select status||'|'||token_ciphertext from gina.apple_revocation_jobs where id=(select id from n131)),'pending|v1.gggg.hhhh','pending job keeps its token after deletion for retries');

-- Purge keeps pending and recent jobs ---------------------------------------------------------------------
update gina.apple_revocation_jobs set completed_at = now() - interval '13 months' where id=(select id from k131);
select is(gina.purge_apple_revocation_jobs(),1,'only old terminal job purged');
select ok(exists(select 1 from gina.apple_revocation_jobs where id=(select id from n131)),'pending job kept');

select * from finish();
rollback;
