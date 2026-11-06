-- C13-AUTH-1: pairing code brute-force guard (20261106340000_pairing_bruteforce_guard).
-- 8-char look-alike-free code · counted preview attempts + user/family lock · single-use, short-lived,
-- user/family/code-bound preview token · legacy token-less signatures refused · existing paired devices
-- and parent revoke untouched · device-side "not my family" undo window (own session only).
begin;
select no_plan();

-- Personas -----------------------------------------------------------------------------------------
-- a1/a2/a3 parents of family A (pro plan via comp), b1 parent of B, c1 attacker with own family C.
-- t1..t5 anonymous tablets; t0 a device paired long before this migration (legacy pairing).
insert into auth.users(id,email,is_anonymous) values
 ('c1200000-0000-4000-8000-0000000000a1','c120-a1@example.invalid',false),
 ('c1200000-0000-4000-8000-0000000000a2','c120-a2@example.invalid',false),
 ('c1200000-0000-4000-8000-0000000000a3','c120-a3@example.invalid',false),
 ('c1200000-0000-4000-8000-0000000000b1','c120-b1@example.invalid',false),
 ('c1200000-0000-4000-8000-0000000000c1','c120-c1@example.invalid',false),
 ('c1200000-0000-4000-8000-0000000000d0',null,true),
 ('c1200000-0000-4000-8000-0000000000d1',null,true),
 ('c1200000-0000-4000-8000-0000000000d2',null,true),
 ('c1200000-0000-4000-8000-0000000000d3',null,true),
 ('c1200000-0000-4000-8000-0000000000d4',null,true),
 ('c1200000-0000-4000-8000-0000000000d5',null,true);
insert into public.families(id,name,created_by) values
 ('c1200000-0000-4000-8000-0000000000fa','Aile A','c1200000-0000-4000-8000-0000000000a1'),
 ('c1200000-0000-4000-8000-0000000000fb','Aile B','c1200000-0000-4000-8000-0000000000b1'),
 ('c1200000-0000-4000-8000-0000000000fc','Aile C','c1200000-0000-4000-8000-0000000000c1');
insert into public.family_members(family_id,user_id) values
 ('c1200000-0000-4000-8000-0000000000fa','c1200000-0000-4000-8000-0000000000a1'),
 ('c1200000-0000-4000-8000-0000000000fa','c1200000-0000-4000-8000-0000000000a2'),
 ('c1200000-0000-4000-8000-0000000000fa','c1200000-0000-4000-8000-0000000000a3'),
 ('c1200000-0000-4000-8000-0000000000fb','c1200000-0000-4000-8000-0000000000b1'),
 ('c1200000-0000-4000-8000-0000000000fc','c1200000-0000-4000-8000-0000000000c1');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
 ('c1200000-0000-4000-8000-0000000000fa','pro','c120 test',now()+interval '30 days'),
 ('c1200000-0000-4000-8000-0000000000fb','pro','c120 test',now()+interval '30 days'),
 ('c1200000-0000-4000-8000-0000000000fc','pro','c120 test',now()+interval '30 days');
insert into public.devices(id,family_id,auth_user_id,name,paired_at,access_mode,pin_policy) values
 ('c1200000-0000-4000-8000-0000000001d0','c1200000-0000-4000-8000-0000000000fa','c1200000-0000-4000-8000-0000000000d0','Eski tablet',now()-interval '20 days','all','existing');
insert into public.device_pairings(code,auth_user_id,device_name,expires_at) values
 ('ACDEFHJK','c1200000-0000-4000-8000-0000000000d2','Ece tablet',now()+interval '9 minutes'),
 ('MNPRTUVW','c1200000-0000-4000-8000-0000000000d3','Can tablet',now()+interval '9 minutes'),
 ('XY3479AC','c1200000-0000-4000-8000-0000000000d4','Eski kod',now()-interval '1 second'),
 ('KMNP3479','c1200000-0000-4000-8000-0000000000d5','Kısa ömür',now()+interval '2 minutes');

create temp table c120 (k text primary key, v text);
grant all on c120 to authenticated;

-- 1. Contract, grants, storage ---------------------------------------------------------------------
select has_function('public','pair_device',array['text','text'],'pair_device(p_code, p_preview_token) exists');
select has_function('public','pair_child_device',array['text','text'],'pair_child_device(p_code, p_preview_token) exists');
select has_function('public','pair_device',array['text'],'legacy pair_device(text) still resolves (to refuse)');
select is((select provolatile::text from pg_proc where oid='public.preview_device_pairing(text)'::regprocedure),'v','preview is volatile: its failed attempt is written');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('preview_device_pairing','pair_device','pair_child_device','device_pairing_status','reject_device_pairing','request_pairing')
    and has_function_privilege('anon',p.oid,'execute')),null,'anon executes none of the pairing functions');
select ok(has_function_privilege('authenticated','public.pair_child_device(text,text)','execute'),'authenticated may call the token signature');
select ok(has_function_privilege('authenticated','public.device_pairing_status()','execute'),'authenticated may read device pairing status');
select ok(has_function_privilege('authenticated','public.reject_device_pairing()','execute'),'authenticated may call reject (own device only)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('preview_device_pairing','pair_device','pair_child_device','device_pairing_status','reject_device_pairing','request_pairing')
  and p.prosecdef and not exists(select 1 from unnest(p.proconfig) c where c like 'search_path=%')),0,'every pairing security definer pins search_path');
select ok(not has_table_privilege('authenticated','public.device_pairing_previews','select'),'tokens are not readable by clients');
select ok(not has_table_privilege('authenticated','public.device_pairing_attempts','select'),'attempt log is not readable by clients');
select ok(not has_table_privilege('authenticated','public.device_pairing_locks','insert'),'locks are not writable by clients');
select is((select count(*)::int from pg_class where oid in ('public.device_pairing_previews'::regclass,'public.device_pairing_attempts'::regclass,'public.device_pairing_locks'::regclass) and relrowsecurity),3,'RLS is on for the three new tables');
select throws_ok($$insert into public.device_pairings(code,auth_user_id) values('123456','c1200000-0000-4000-8000-0000000000d1')$$,'23514',null,'a 6-digit code cannot be stored any more');
select is((select count(*)::int from public.device_pairings where code !~ '^[ACDEFHJKMNPRTUVWXY3479]{8}$'),0,'no legacy-format code is left');

-- 2. Code space ------------------------------------------------------------------------------------
insert into c120 select 'gen'||g, gina.new_pairing_code() from generate_series(1,1000) g;
select is((select count(*)::int from c120 where k like 'gen%' and v ~ '^[ACDEFHJKMNPRTUVWXY3479]{8}$'),1000,'1000 generated codes are 8 chars from the alphabet');
select ok((select count(distinct v) from c120 where k like 'gen%')>=999,'generated codes do not repeat');
select is((select count(distinct ch)::int from c120, regexp_split_to_table(v,'') ch where k like 'gen%'),22,'all 22 symbols are used');
select is((select count(*)::int from c120, regexp_split_to_table(v,'') ch where k like 'gen%' and ch in ('0','O','1','I','L','2','Z','5','S','6','G','8','B')),0,'no look-alike symbol ever appears');
select is(gina.normalize_pairing_code(' acde-fhjk '),'ACDEFHJK','input is normalised (case, spaces, dash)');
select is(gina.normalize_pairing_code('ACDE FHJK'),'ACDEFHJK','4+4 display grouping is accepted');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000d1","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
insert into c120 values('t1code', public.request_pairing('Deneme tablet'));
reset role;
select matches((select v from c120 where k='t1code'),'^[ACDEFHJKMNPRTUVWXY3479]{8}$','request_pairing returns an 8-char code');
select ok((select expires_at between now()+interval '9 minutes' and now()+interval '10 minutes' from public.device_pairings where code=(select v from c120 where k='t1code')),'code lives 10 minutes');

-- 3. Preview: counted failures and lock ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
insert into c120 values('pA', public.preview_device_pairing('acde-fhjk')::text);
select is((select v::jsonb->>'status' from c120 where k='pA'),'ok','live code previews (lower case + dash)');
select is((select v::jsonb->>'family_name' from c120 where k='pA'),'Aile A','preview names the caller''s own family');
select is((select v::jsonb->>'device_name' from c120 where k='pA'),'Ece tablet','preview names the tablet');
select matches((select v::jsonb->>'preview_token' from c120 where k='pA'),'^[0-9a-f-]{36}$','successful preview returns a preview token');
select ok((select (v::jsonb->>'token_seconds_left')::int between 1 and 300 from c120 where k='pA'),'token lives at most 5 minutes');
select ok((public.preview_device_pairing('KMNP3479')->>'token_seconds_left')::int<=120,'token never outlives the code');
select is((public.preview_device_pairing('XY3479AC')),'{"status":"invalid_or_expired","attempts_left":9}'::jsonb,'expired code: failure counted, no device name, 9 left');
select is(public.preview_device_pairing('ZZZZZZZZ')->>'attempts_left','8','unknown code counts');
select is(public.preview_device_pairing('123456')->>'status','invalid_or_expired','legacy 6-digit code is just a failure');
select is(public.preview_device_pairing(null)->>'attempts_left','6','null counts too');
reset role;
select is((select count(*)::int from public.device_pairing_attempts where user_id='c1200000-0000-4000-8000-0000000000a1' and not ok),4,'failures are stored (preview does not raise, so they commit)');
select is((select count(*)::int from public.device_pairing_previews where user_id='c1200000-0000-4000-8000-0000000000a1' and used_at is null),1,'one live token per user (new preview replaced the old)');
select is((select consumed_at from public.device_pairings where code='ACDEFHJK'),null,'preview never consumes the code');
select is((select count(*)::int from public.devices where auth_user_id='c1200000-0000-4000-8000-0000000000d2'),0,'preview never creates a device');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is((select count(*)::int from generate_series(1,5) g, lateral public.preview_device_pairing('ZZZZZZZ'||g) r where r->>'status'='invalid_or_expired'),5,'five more failures');
select is(public.preview_device_pairing('YYYYYYYY'),jsonb_build_object('status','pairing_locked','locked_until',now()+interval '15 minutes','retry_after_seconds',900),'10th failure in 10 min locks for 15 min');
select is(public.preview_device_pairing('ACDEFHJK')->>'status','pairing_locked','while locked even the right code is refused');
select ok(not (public.preview_device_pairing('ACDEFHJK') ? 'preview_token'),'locked preview hands out no token');
select is((public.preview_device_pairing('ACDEFHJK')->>'retry_after_seconds')::int,900,'lock reports seconds left');
reset role;
select is((select count(*)::int from public.device_pairing_attempts where user_id='c1200000-0000-4000-8000-0000000000a1' and not ok),10,'locked calls are not looked up nor counted');
select is((select count(*)::int from public.device_pairing_locks where scope='user' and subject='c1200000-0000-4000-8000-0000000000a1'),1,'user lock row written');
select is((select count(*)::int from public.device_pairing_previews where user_id='c1200000-0000-4000-8000-0000000000a1' and used_at is null),1,'no new token while locked');
-- Other parent of the same family: own counter (family limit 20 not reached), not locked.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('ACDEFHJK')->>'status','ok','second parent of the family is not locked by the first');
-- Other family is untouched.
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fb"}}',true);
select is(public.preview_device_pairing('ZZZZZZZZ'),'{"status":"invalid_or_expired","attempts_left":9}'::jsonb,'other family has its own counter');
reset role;
-- Lock expiry: after the lock and the window pass, the parent can preview again.
update public.device_pairing_locks set locked_until=now()-interval '1 second' where subject='c1200000-0000-4000-8000-0000000000a1';
update public.device_pairing_attempts set tried_at=now()-interval '16 minutes' where user_id='c1200000-0000-4000-8000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('ACDEFHJK')->>'status','ok','expired lock is lifted');
reset role;
select is((select count(*)::int from public.device_pairing_locks where subject='c1200000-0000-4000-8000-0000000000a1'),0,'expired lock row removed');

-- Family lock: three parents of A, 9 + 9 + 2 failures = 20 in the window.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is((select count(*)::int from generate_series(1,9) g, lateral public.preview_device_pairing('ZZZZZZZ'||g) r where r->>'status'='invalid_or_expired'),9,'a2: 9 failures, not locked');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a3","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is((select count(*)::int from generate_series(1,9) g, lateral public.preview_device_pairing('ZZZZZZZ'||g) r where r->>'status'='invalid_or_expired'),9,'a3: 9 failures, not locked');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('ZZZZZZZZ')->>'attempts_left','1','family budget nearly used (min of user/family left)');
select is(public.preview_device_pairing('ZZZZZZZZ')->>'status','pairing_locked','20th family failure locks the family');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('ACDEFHJK')->>'status','pairing_locked','family lock covers every parent of the family');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000c1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fc"}}',true);
select is(public.preview_device_pairing('ACDEFHJK')->>'status','ok','family lock does not spill into another family');
-- A successful preview does not reset the failure counter (attacker's own tablet cannot launder attempts).
select is((select count(*)::int from generate_series(1,5) g, lateral public.preview_device_pairing('ZZZZZZZ'||g) r where r->>'status'='invalid_or_expired'),5,'attacker: 5 failures');
select is(public.preview_device_pairing('MNPRTUVW')->>'status','ok','attacker: one success');
select is(public.preview_device_pairing('ZZZZZZZZ')->>'attempts_left','4','success did not reset the counter');
reset role;
select is((select count(*)::int from public.device_pairing_locks where scope='family' and subject='c1200000-0000-4000-8000-0000000000fa'),1,'family lock row written');
delete from public.device_pairing_locks;
delete from public.device_pairing_attempts;
delete from public.device_pairing_previews;

-- 4. Pairing needs a valid token -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok($$select public.pair_device('ACDEFHJK')$$,'P0001','client_update_required','legacy pair_device(p_code) is refused');
select throws_ok($$select public.pair_child_device('ACDEFHJK')$$,'P0001','client_update_required','legacy pair_child_device(p_code) is refused');
select throws_ok($$select public.pair_child_device('ACDEFHJK',null)$$,'P0001','invalid_preview_token','no token → refused');
select throws_ok($$select public.pair_child_device('ACDEFHJK','not-a-token')$$,'P0001','invalid_preview_token','malformed token → refused');
select throws_ok($$select public.pair_child_device('ACDEFHJK',gen_random_uuid()::text)$$,'P0001','invalid_preview_token','unknown token → refused');
insert into c120 values('tokA1', public.preview_device_pairing('ACDEFHJK')->>'preview_token');
select throws_ok(format('select public.pair_child_device(%L,%L)','MNPRTUVW',(select v from c120 where k='tokA1')),'P0001','invalid_preview_token','token is bound to its code');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fb"}}',true);
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokA1')),'P0001','invalid_preview_token','another family''s parent cannot use the token');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokA1')),'P0001','invalid_preview_token','token is bound to the user, even inside the same family');
reset role;
insert into public.family_members(family_id,user_id) values('c1200000-0000-4000-8000-0000000000fc','c1200000-0000-4000-8000-0000000000a1');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fc"}}',true);
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokA1')),'P0001','invalid_preview_token','token is bound to the family shown in the preview');
reset role;
delete from public.family_members where family_id='c1200000-0000-4000-8000-0000000000fc' and user_id='c1200000-0000-4000-8000-0000000000a1';
update public.device_pairing_previews set expires_at=now()-interval '1 second' where token=(select v from c120 where k='tokA1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokA1')),'P0001','invalid_preview_token','expired token → refused');
insert into c120 values('tokA2', public.preview_device_pairing('ACDEFHJK')->>'preview_token');
-- Another parent (family B) holds a token for the same code; A pairs first.
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fb"}}',true);
insert into c120 values('tokB1', public.preview_device_pairing('ACDEFHJK')->>'preview_token');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
insert into c120 values('devT2', public.pair_child_device(' acde fhjk ',(select v from c120 where k='tokA2'))::text);
select isnt((select v from c120 where k='devT2'),null,'valid token pairs the device');
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokA2')),'P0001','invalid_preview_token','token is single-use (replay refused)');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fb"}}',true);
select throws_ok(format('select public.pair_child_device(%L,%L)','ACDEFHJK',(select v from c120 where k='tokB1')),'P0001','invalid_preview_token','the other family''s token died with the code');
select is(public.preview_device_pairing('ACDEFHJK')->>'status','invalid_or_expired','used code no longer previews');
reset role;
select ok((select used_at is not null from public.device_pairing_previews where token=(select v from c120 where k='tokA2')::uuid),'token marked used');
select ok((select consumed_at is not null from public.device_pairings where code='ACDEFHJK'),'code consumed');
select is((select family_id::text||'/'||access_mode::text||'/'||pin_policy::text from public.devices where id=(select v from c120 where k='devT2')::uuid),
  'c1200000-0000-4000-8000-0000000000fa/selected/required','tablet belongs to the confirming family, closed until access is set');

-- Old token-less path through pair_device(text,text) also works for pair_device directly (no access reset).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
insert into c120 values('tokA3', public.preview_device_pairing('MNPRTUVW')->>'preview_token');
insert into c120 values('devT3', public.pair_device('MNPRTUVW',(select v from c120 where k='tokA3'))::text);
select isnt((select v from c120 where k='devT3'),null,'pair_device(p_code, p_preview_token) pairs too');
-- Devices / anonymous users cannot preview or pair.
select set_config('request.jwt.claims',format('{"sub":"c1200000-0000-4000-8000-0000000000d2","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1200000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c120 where k='devT2')),true);
select throws_ok($$select public.preview_device_pairing('KMNP3479')$$,'42501','forbidden','a child device cannot preview');
select throws_ok(format('select public.pair_child_device(%L,%L)','KMNP3479',gen_random_uuid()),'42501','forbidden','a child device cannot pair');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000d1","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
select throws_ok($$select public.pair_device('KMNP3479')$$,'42501','forbidden','unpaired tablet cannot call legacy pair either');
select throws_ok($$select * from public.device_pairing_previews$$,'42501',null,'token table is closed to clients');
reset role;

-- 5. Existing paired devices and parent revoke are untouched ---------------------------------------
select is((select revoked_at from public.devices where id='c1200000-0000-4000-8000-0000000001d0'),null,'legacy device stays paired');
select is((select access_mode::text||'/'||pin_policy::text from public.devices where id='c1200000-0000-4000-8000-0000000001d0'),'all/existing','legacy device access settings unchanged');
select is(public.custom_access_token_hook(jsonb_build_object('user_id','c1200000-0000-4000-8000-0000000000d0','claims','{}'::jsonb))#>>'{claims,gina,role}','device','legacy device still gets a device token');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000d0","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1200000-0000-4000-8000-0000000000fa","device_id":"c1200000-0000-4000-8000-0000000001d0"}}',true);
select is(public.device_pairing_status()->>'family_name','Aile A','legacy device sees its family');
select is((public.device_pairing_status()->>'undo_seconds_left')::int,0,'undo window long closed for the legacy device');
select throws_ok($$select public.reject_device_pairing()$$,'P0001','pairing_undo_expired','legacy device cannot self-unpair');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select lives_ok($$select public.revoke_device('c1200000-0000-4000-8000-0000000001d0')$$,'parent revoke still works');
reset role;
select isnt((select revoked_at from public.devices where id='c1200000-0000-4000-8000-0000000001d0'),null,'parent revoke applied');
select is(public.custom_access_token_hook(jsonb_build_object('user_id','c1200000-0000-4000-8000-0000000000d0','claims','{}'::jsonb))#>>'{claims,gina,role}','none','revoked device token loses its role');

-- 6. Device-side "not my family" -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',format('{"sub":"c1200000-0000-4000-8000-0000000000d2","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1200000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c120 where k='devT2')),true);
select is(public.device_pairing_status()->>'status','paired','tablet sees it is paired');
select is(public.device_pairing_status()->>'family_name','Aile A','tablet sees which family received it');
select is(public.device_pairing_status()->>'device_name','Ece tablet','tablet sees its own name');
select ok((public.device_pairing_status()->>'undo_seconds_left')::int between 1 and 900,'undo window open (≤ 15 min)');
select ok(not (public.device_pairing_status() ?| array['children','family_id','members']),'status reveals nothing but the family name');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok($$select public.reject_device_pairing()$$,'42501','forbidden','a parent session cannot use the device undo');
select is(public.device_pairing_status()->>'status','not_paired','a parent session has no device status');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000d1","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
select throws_ok($$select public.reject_device_pairing()$$,'42501','forbidden','an unpaired tablet cannot undo anything');
select set_config('request.jwt.claims',format('{"sub":"c1200000-0000-4000-8000-0000000000d2","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1200000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c120 where k='devT2')),true);
select is(public.reject_device_pairing()->>'status','rejected','tablet undoes the pairing with its own session');
select is(public.device_pairing_status()->>'status','not_paired','after undo the tablet is no longer paired');
select throws_ok($$select public.reject_device_pairing()$$,'42501','forbidden','undo is one-shot');
select matches(public.request_pairing('Ece tablet'),'^[ACDEFHJKMNPRTUVWXY3479]{8}$','tablet can ask for a new code right away');
reset role;
select isnt((select revoked_at from public.devices where id=(select v from c120 where k='devT2')::uuid),null,'undo revoked only that device');
select is((select revoked_at from public.devices where id=(select v from c120 where k='devT3')::uuid),null,'the other new tablet is untouched');
select is(public.custom_access_token_hook(jsonb_build_object('user_id','c1200000-0000-4000-8000-0000000000d2','claims','{}'::jsonb))#>>'{claims,gina,role}','none','undone tablet gets no device role');
-- Window closes after 15 minutes.
update public.devices set paired_at=now()-interval '16 minutes' where id=(select v from c120 where k='devT3')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',format('{"sub":"c1200000-0000-4000-8000-0000000000d3","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1200000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c120 where k='devT3')),true);
select is((public.device_pairing_status()->>'undo_seconds_left')::int,0,'after 15 min no undo is offered');
select throws_ok($$select public.reject_device_pairing()$$,'P0001','pairing_undo_expired','after 15 min the tablet cannot self-unpair');
reset role;
select is((select revoked_at from public.devices where id=(select v from c120 where k='devT3')::uuid),null,'expired undo leaves the device paired');

-- 7. Foreign family can never see or reach another family through pairing --------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fb"}}',true);
select is(public.preview_device_pairing('KMNP3479')->>'family_name','Aile B','preview only ever names the caller''s own family');
select is((select count(*)::int from public.devices),0,'family B sees no device of family A');
select set_config('request.jwt.claims','{"sub":"c1200000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1200000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok($$select public.preview_device_pairing('KMNP3479')$$,'42501','forbidden','forged family claim cannot preview');
select throws_ok(format('select public.pair_child_device(%L,%L)','KMNP3479',gen_random_uuid()),'42501','forbidden','forged family claim cannot pair');
reset role;

select * from finish();
rollback;
