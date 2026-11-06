-- D17: pairing retention jobs (20261106450000_pairing_retention_jobs).
-- gina.prune_unused_devices(): a device unused for 90 days by every server-side signal is unpaired like a
-- parent revoke, each parent gets one inbox note, every used/fresh/active device stays. gina.prune_pairing_records():
-- attempts > 1 day, expired locks, previews/codes expired > 1 day; the lockout keeps working.
-- Functions are called directly "as of" a fixed past instant T; p_now is clamped to now(), so a future p_now
-- cannot remove anything a real-clock run would keep.
begin;
select no_plan();

create temp table t130(k text primary key, v timestamptz) on commit drop;
insert into t130 values ('T', '2026-06-01 12:00:00+00');   -- cutoff = 2026-03-03 12:00 UTC

-- Personas -----------------------------------------------------------------------------------------
insert into auth.users(id,email,is_anonymous,last_sign_in_at) values
 ('d1700000-0000-4000-8000-0000000000a1','d17-a1@example.invalid',false,null),
 ('d1700000-0000-4000-8000-0000000000a2','d17-a2@example.invalid',false,null),
 ('d1700000-0000-4000-8000-0000000000b1','d17-b1@example.invalid',false,null),
 ('d1700000-0000-4000-8000-000000000001',null,true,null),
 ('d1700000-0000-4000-8000-000000000002',null,true,null),
 ('d1700000-0000-4000-8000-000000000003',null,true,null),
 ('d1700000-0000-4000-8000-000000000004',null,true,null),
 ('d1700000-0000-4000-8000-000000000005',null,true,null),
 ('d1700000-0000-4000-8000-000000000006',null,true,'2026-05-01 00:00+00'),
 ('d1700000-0000-4000-8000-000000000007',null,true,null),
 ('d1700000-0000-4000-8000-000000000008',null,true,null),
 ('d1700000-0000-4000-8000-000000000009',null,true,null),
 ('d1700000-0000-4000-8000-000000000010',null,true,null),
 ('d1700000-0000-4000-8000-000000000011',null,true,null),
 ('d1700000-0000-4000-8000-000000000012',null,true,null);
insert into public.families(id,name,created_by) values
 ('d1700000-0000-4000-8000-0000000000fa','Aile A','d1700000-0000-4000-8000-0000000000a1'),
 ('d1700000-0000-4000-8000-0000000000fb','Aile B','d1700000-0000-4000-8000-0000000000b1');
insert into public.family_members(family_id,user_id) values
 ('d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-0000000000a1'),
 ('d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-0000000000a2'),
 ('d1700000-0000-4000-8000-0000000000fb','d1700000-0000-4000-8000-0000000000b1');
insert into public.children(id,family_id,name,sort_order) values
 ('d1700000-0000-4000-8000-0000000000c1','d1700000-0000-4000-8000-0000000000fa','Ece',1);

-- Devices (dv = d1700000-...-0000000001NN, user ...0000000000NN) -----------------------------------
insert into public.devices(id,family_id,auth_user_id,name,paired_at,last_seen_at,revoked_at,active_child_id) values
 -- 01 stale: paired and last child login long ago, nothing since → removed
 ('d1700000-0000-4000-8000-000000000101','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000001','Eski tablet','2026-01-01 10:00+00','2026-02-01 10:00+00',null,'d1700000-0000-4000-8000-0000000000c1'),
 -- 02 session refreshed recently (refreshed_at is UTC without time zone) → kept
 ('d1700000-0000-4000-8000-000000000102','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000002','Tablet 2','2026-01-01 10:00+00',null,null,null),
 -- 03 active child device: child selected/logged in 2 days before T → kept
 ('d1700000-0000-4000-8000-000000000103','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000003','Tablet 3','2026-01-01 10:00+00','2026-05-30 10:00+00',null,'d1700000-0000-4000-8000-0000000000c1'),
 -- 04 refresh token rotated in April → kept
 ('d1700000-0000-4000-8000-000000000104','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000004','Tablet 4','2026-01-01 10:00+00',null,null,null),
 -- 05 push token re-registered in May → kept
 ('d1700000-0000-4000-8000-000000000105','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000005','Tablet 5','2026-01-01 10:00+00',null,null,null),
 -- 06 anonymous user signed in on 1 May → kept
 ('d1700000-0000-4000-8000-000000000106','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000006','Tablet 6','2026-01-01 10:00+00',null,null,null),
 -- 07 paired 1 April, never used since → still within 90 days → kept
 ('d1700000-0000-4000-8000-000000000107','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000007','Tablet 7','2026-04-01 10:00+00',null,null,null),
 -- 08 already revoked by a parent → untouched
 ('d1700000-0000-4000-8000-000000000108','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000008','Tablet 8','2026-01-01 10:00+00',null,'2026-02-01 10:00+00',null),
 -- 09 stale in family B → removed, only B's parent is told
 ('d1700000-0000-4000-8000-000000000109','d1700000-0000-4000-8000-0000000000fb','d1700000-0000-4000-8000-000000000009','B tablet','2026-01-01 10:00+00',null,null,null),
 -- 10 boundary: last session refresh 2026-03-03 11:00 UTC (1 h before cutoff) → removed
 ('d1700000-0000-4000-8000-000000000110','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000010','Tablet 10','2026-01-01 10:00+00',null,null,null),
 -- 11 boundary: last session refresh 2026-03-03 13:00 UTC (1 h after cutoff) → kept
 ('d1700000-0000-4000-8000-000000000111','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000011','Tablet 11','2026-01-01 10:00+00',null,null,null),
 -- 12 real clock: paired 10 days ago (used by the clamp check)
 ('d1700000-0000-4000-8000-000000000112','d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-000000000012','Tablet 12',now()-interval '10 days',null,null,null);

insert into auth.sessions(id,user_id,created_at,updated_at,refreshed_at) values
 (gen_random_uuid(),'d1700000-0000-4000-8000-000000000002','2026-01-01 10:00+00','2026-01-01 10:00+00','2026-05-20 08:00:00'),
 (gen_random_uuid(),'d1700000-0000-4000-8000-000000000010','2026-01-01 10:00+00','2026-01-01 10:00+00','2026-03-03 11:00:00'),
 (gen_random_uuid(),'d1700000-0000-4000-8000-000000000011','2026-01-01 10:00+00','2026-01-01 10:00+00','2026-03-03 13:00:00');
insert into auth.refresh_tokens(token,user_id,revoked,created_at,updated_at) values
 ('d17-rt-4','d1700000-0000-4000-8000-000000000004',false,'2026-01-01 10:00+00','2026-04-01 10:00+00');
insert into public.push_tokens(user_id,family_id,role,device_id,platform,token,token_type,created_at,updated_at) values
 ('d1700000-0000-4000-8000-000000000005','d1700000-0000-4000-8000-0000000000fa','device','d1700000-0000-4000-8000-000000000105','ios','d17-push-token-5','apns','2026-01-01 10:00+00','2026-05-01 10:00+00');

-- Contract -----------------------------------------------------------------------------------------
select ok(not has_function_privilege(r, f, 'execute'), format('%s cannot execute %s', r, f))
  from (values ('anon'),('authenticated'),('service_role')) roles(r)
  cross join (values ('gina.prune_unused_devices(timestamptz)'),('gina.prune_pairing_records(timestamptz)'),('gina.device_last_used_at(uuid)')) fns(f);
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='gina' and p.proname in ('prune_unused_devices','prune_pairing_records','device_last_used_at')
              and p.prosecdef and p.proconfig @> array['search_path=""']),
  3, 'all three are security definer with an empty search_path');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='gina' and p.proname in ('prune_unused_devices','prune_pairing_records','device_last_used_at')
              and has_function_privilege('anon', p.oid, 'execute')),
  0, 'no anon-executable retention function (pgTAP 102 rule)');

-- Last-use signal ---------------------------------------------------------------------------------
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000101'), '2026-02-01 10:00+00'::timestamptz, 'last use = last child login');
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000102'), '2026-05-20 08:00+00'::timestamptz, 'session refreshed_at is read as UTC whatever the session time zone');
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000104'), '2026-04-01 10:00+00'::timestamptz, 'refresh-token rotation counts as use');
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000105'), '2026-05-01 10:00+00'::timestamptz, 'push-token re-registration counts as use');
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000106'), '2026-05-01 00:00+00'::timestamptz, 'anonymous sign-in counts as use');
select is(gina.device_last_used_at('d1700000-0000-4000-8000-000000000107'), '2026-04-01 10:00+00'::timestamptz, 'never-used device falls back to paired_at');

-- Run "as of" T ----------------------------------------------------------------------------------
select is(gina.prune_unused_devices((select v from t130 where k='T')), 3, 'three devices unused for 90 days at T are unpaired');
select is((select string_agg(right(id::text,3), ',' order by id) from public.devices
            where family_id in ('d1700000-0000-4000-8000-0000000000fa','d1700000-0000-4000-8000-0000000000fb')
              and revoked_at is not null and id <> 'd1700000-0000-4000-8000-000000000108'),
  '101,109,110', 'removed: stale (01), stale in family B (09), last refresh 1 h before the cutoff (10)');
select is((select count(*)::int from public.devices where id in (
            'd1700000-0000-4000-8000-000000000102','d1700000-0000-4000-8000-000000000103','d1700000-0000-4000-8000-000000000104',
            'd1700000-0000-4000-8000-000000000105','d1700000-0000-4000-8000-000000000106','d1700000-0000-4000-8000-000000000107',
            'd1700000-0000-4000-8000-000000000111','d1700000-0000-4000-8000-000000000112') and revoked_at is null),
  8, 'kept: recent refresh, active child device, refresh token, push token, sign-in, fresh pairing, refresh 1 h after cutoff, real-clock device');
select is((select active_child_id from public.devices where id='d1700000-0000-4000-8000-000000000103'),
  'd1700000-0000-4000-8000-0000000000c1'::uuid, 'active child device keeps its selected child');
select ok((select revoked_at > now() - interval '1 minute' and active_child_id is null from public.devices where id='d1700000-0000-4000-8000-000000000101'),
  'removed like revoke_device: revoked_at = now(), active child cleared');
select is((select revoked_at from public.devices where id='d1700000-0000-4000-8000-000000000108'),
  '2026-02-01 10:00+00'::timestamptz, 'an already revoked device is not touched');
select is((select count(*)::int from public.devices where id='d1700000-0000-4000-8000-000000000101'), 1, 'the device row (history) stays');
select is(public.custom_access_token_hook(jsonb_build_object('user_id','d1700000-0000-4000-8000-000000000001','claims','{}'::jsonb))#>>'{claims,gina,role}',
  'none', 'access-token hook drops the removed tablet to role none');
select is(public.custom_access_token_hook(jsonb_build_object('user_id','d1700000-0000-4000-8000-000000000003','claims','{}'::jsonb))#>>'{claims,gina,role}',
  'device', 'the active child device keeps role device');

-- Parent notes ------------------------------------------------------------------------------------
select is((select count(*)::int from gina.parent_inbox where kind='device_unused_removed' and family_id='d1700000-0000-4000-8000-0000000000fa'),
  4, 'family A: each of the two parents gets one note per removed device (2 x 2)');
select is((select string_agg(user_id::text, ',') from gina.parent_inbox where kind='device_unused_removed' and family_id='d1700000-0000-4000-8000-0000000000fb'),
  'd1700000-0000-4000-8000-0000000000b1', 'family B: only its own parent is told');
select is((select count(*)::int from gina.parent_inbox where kind='device_unused_removed'
            and (body ilike '%tablet 10%' or body ilike '%Eski tablet%' or body ilike '%Aile A%' or body ilike '%Aile B%' or title ilike '%tablet 1%' or body ilike '%Ece%')),
  0, 'notes carry no device name, family name or child');
select ok((select bool_and(expires_on > current_date) from gina.parent_inbox where kind='device_unused_removed'), 'notes are not born expired');

select is(gina.prune_unused_devices((select v from t130 where k='T')), 0, 'second run removes nothing');
select is((select count(*)::int from gina.parent_inbox where kind='device_unused_removed'), 5, 'and writes no duplicate note');

-- Re-pairing after removal works ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1700000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
select matches(public.request_pairing('Eski tablet'), '^[ACDEFHJKMNPRTUVWXY3479]{8}$', 'the removed tablet can request a new code');
reset role;

-- Clamp: a future p_now behaves like the real clock ------------------------------------------------
select ok(gina.prune_unused_devices(now() + interval '400 days') >= 0, 'future p_now runs');
select is((select revoked_at from public.devices where id='d1700000-0000-4000-8000-000000000112'), null,
  'future p_now is clamped to now(): a device paired 10 days ago stays');

-- 2) Pairing records -------------------------------------------------------------------------------
delete from public.device_pairing_attempts; delete from public.device_pairing_locks;
insert into public.device_pairing_attempts(user_id,family_id,ok,tried_at) values
 ('d1700000-0000-4000-8000-0000000000a1','d1700000-0000-4000-8000-0000000000fa',false,'2026-05-30 11:00+00'),  -- > 1 day before T
 ('d1700000-0000-4000-8000-0000000000a1','d1700000-0000-4000-8000-0000000000fa',true ,'2026-05-31 11:00+00'),  -- > 1 day before T
 ('d1700000-0000-4000-8000-0000000000a1','d1700000-0000-4000-8000-0000000000fa',false,'2026-06-01 00:00+00');  -- 12 h before T
insert into public.device_pairing_attempts(user_id,family_id,ok,tried_at)
 select 'd1700000-0000-4000-8000-0000000000a2','d1700000-0000-4000-8000-0000000000fa',false,now()-interval '1 minute' from generate_series(1,10);
insert into public.device_pairing_locks values
 ('user','d1700000-0000-4000-8000-0000000000a2',now()+interval '14 minutes'),
 ('user','d1700000-0000-4000-8000-0000000000a1',now()-interval '1 second'),
 ('family','d1700000-0000-4000-8000-0000000000fb','2026-05-01 00:00+00');
delete from public.device_pairings where auth_user_id in ('d1700000-0000-4000-8000-000000000011','d1700000-0000-4000-8000-000000000012');
insert into public.device_pairings(code,auth_user_id,device_name,expires_at) values
 ('ACDEFHJK','d1700000-0000-4000-8000-000000000011','Eski kod','2026-05-01 00:00+00'),
 ('MNPRTUVW','d1700000-0000-4000-8000-000000000012','Bekleyen',now()+interval '9 minutes');
insert into public.device_pairing_previews(code,user_id,family_id,expires_at) values
 ('ACDEFHJK','d1700000-0000-4000-8000-0000000000a1','d1700000-0000-4000-8000-0000000000fa','2026-05-01 00:05+00'),
 ('MNPRTUVW','d1700000-0000-4000-8000-0000000000b1','d1700000-0000-4000-8000-0000000000fb',now()+interval '4 minutes');

select is(gina.prune_pairing_records((select v from t130 where k='T')),
  '{"attempts": 2, "locks": 1, "previews": 1, "codes": 1}'::jsonb, 'as of T: 2 old attempts, the lock that had ended by T, 1 old preview, 1 old code');
select is((select count(*)::int from public.device_pairing_attempts where user_id='d1700000-0000-4000-8000-0000000000a1'), 1, 'attempt younger than 1 day kept');
select is((select count(*)::int from public.device_pairing_locks where subject='d1700000-0000-4000-8000-0000000000a2'), 1, 'running lock kept');
select is((select count(*)::int from public.device_pairings where code='MNPRTUVW'), 1, 'pending code kept');
select is((select count(*)::int from public.device_pairing_previews where code='MNPRTUVW'), 1, 'live preview token kept');

select is(gina.prune_pairing_records(now() + interval '1 year'),
  '{"attempts": 1, "locks": 1, "previews": 0, "codes": 0}'::jsonb, 'future p_now clamped to now(): the attempt now > 1 day old and the lock that ended 1 s ago go, nothing live');
select is((select count(*)::int from public.device_pairing_attempts where user_id='d1700000-0000-4000-8000-0000000000a2' and not ok), 10,
  'failures inside the 10-minute window survive any run');

-- Lockout still correct after cleanup
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1700000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"d1700000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('MNPRTUVW')->>'status', 'pairing_locked', 'locked parent is still locked after the cleanup (correct code refused)');
select set_config('request.jwt.claims','{"sub":"d1700000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"d1700000-0000-4000-8000-0000000000fa"}}',true);
select is(public.preview_device_pairing('ACDEFHJK')->>'status', 'invalid_or_expired', 'unlocked parent: deleted code reads as invalid and is counted');
reset role;
select is((select count(*)::int from public.device_pairing_attempts where user_id='d1700000-0000-4000-8000-0000000000a1' and not ok), 1, 'new failure recorded after cleanup');

-- 3) Schedule: pg_cron is not installed in the local test template; the migration only raises a notice there.
--    The cron.schedule calls are verified on a pg_cron database (see docs/release/d17-2026-11-06/README.md).

select * from finish();
rollback;
