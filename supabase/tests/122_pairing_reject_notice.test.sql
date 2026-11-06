-- D2 (C06/AUTH-1 remainder): 20261106360000_pairing_reject_notice.
-- child_mode_pin_status (parent phone child mode follows verify_child_pin) · who paired a tablet is kept
-- server-side only · "not my family" on the tablet leaves an inbox note for that parent (no personal data)
-- · legacy pairing (pairer unknown) notifies every parent of the family · no note outside the window.
begin;
select no_plan();

-- a1/a2 parents of A, b1 parent of B; d1/d2 anonymous tablets; d0 a device paired with no known pairer.
insert into auth.users(id,email,is_anonymous) values
 ('c1220000-0000-4000-8000-0000000000a1','c122-a1@example.invalid',false),
 ('c1220000-0000-4000-8000-0000000000a2','c122-a2@example.invalid',false),
 ('c1220000-0000-4000-8000-0000000000b1','c122-b1@example.invalid',false),
 ('c1220000-0000-4000-8000-0000000000d0',null,true),
 ('c1220000-0000-4000-8000-0000000000d1',null,true),
 ('c1220000-0000-4000-8000-0000000000d2',null,true);
insert into public.families(id,name,created_by) values
 ('c1220000-0000-4000-8000-0000000000fa','Aile A','c1220000-0000-4000-8000-0000000000a1'),
 ('c1220000-0000-4000-8000-0000000000fb','Aile B','c1220000-0000-4000-8000-0000000000b1');
insert into public.family_members(family_id,user_id) values
 ('c1220000-0000-4000-8000-0000000000fa','c1220000-0000-4000-8000-0000000000a1'),
 ('c1220000-0000-4000-8000-0000000000fa','c1220000-0000-4000-8000-0000000000a2'),
 ('c1220000-0000-4000-8000-0000000000fb','c1220000-0000-4000-8000-0000000000b1');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
 ('c1220000-0000-4000-8000-0000000000fa','pro','c122 test',now()+interval '30 days'),
 ('c1220000-0000-4000-8000-0000000000fb','pro','c122 test',now()+interval '30 days');
insert into public.children(id,family_id,name,sort_order) values
 ('c1220000-0000-4000-8000-0000000000c1','c1220000-0000-4000-8000-0000000000fa','Ece',1),
 ('c1220000-0000-4000-8000-0000000000c2','c1220000-0000-4000-8000-0000000000fa','Can',2),
 ('c1220000-0000-4000-8000-0000000000c3','c1220000-0000-4000-8000-0000000000fa','Arşiv',3);
insert into gina.child_archive_state(child_id,revision,archived_at) values('c1220000-0000-4000-8000-0000000000c3',1,'2026-11-01 10:00+00');
update public.children set archived_at='2026-11-01 10:00+00',archive_revision=1 where id='c1220000-0000-4000-8000-0000000000c3';
insert into public.child_pins(child_id,pin_hash) values ('c1220000-0000-4000-8000-0000000000c1',extensions.crypt('1234',extensions.gen_salt('bf')));
insert into public.devices(id,family_id,auth_user_id,name,paired_at) values
 ('c1220000-0000-4000-8000-0000000001d0','c1220000-0000-4000-8000-0000000000fa','c1220000-0000-4000-8000-0000000000d0','Eski tablet',now()-interval '1 minute');

create temp table c122 (k text primary key, v text);
grant all on c122 to authenticated;

-- 1. Contract --------------------------------------------------------------------------------------
select has_function('public','child_mode_pin_status',array[]::text[],'child_mode_pin_status() exists');
select ok(not has_function_privilege('anon','public.child_mode_pin_status()','execute'),'anon cannot read PIN status');
select ok(has_function_privilege('authenticated','public.child_mode_pin_status()','execute'),'authenticated may call PIN status (parent only inside)');
select ok(not has_function_privilege('anon','public.reject_device_pairing()','execute'),'anon still cannot reject');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','gina')
  and p.proname in ('child_mode_pin_status','reject_device_pairing','remember_device_pairer')
  and p.prosecdef and not exists(select 1 from unnest(p.proconfig) c where c like 'search_path=%')),0,'new/changed security definers pin search_path');
select ok(not has_table_privilege('authenticated','gina.device_pairers','select'),'pairer table is not readable by clients');
select ok((select relrowsecurity from pg_class where oid='gina.device_pairers'::regclass),'RLS is on for device_pairers');
select lives_ok($$insert into gina.parent_inbox(user_id,family_id,event_key,kind,title,body,expires_on) values('c1220000-0000-4000-8000-0000000000b1','c1220000-0000-4000-8000-0000000000fb','probe','device_pairing_rejected','t','b',current_date)$$,'inbox accepts the new kind');
select throws_ok($$insert into gina.parent_inbox(user_id,family_id,event_key,kind,title,body,expires_on) values('c1220000-0000-4000-8000-0000000000b1','c1220000-0000-4000-8000-0000000000fb','probe2','marketing','t','b',current_date)$$,'23514',null,'inbox still refuses unknown kinds');
delete from gina.parent_inbox where event_key='probe';

-- 2. PIN status for child mode on the parent's phone ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
select is(public.child_mode_pin_status(),
  '[{"child_id":"c1220000-0000-4000-8000-0000000000c1","pin_set":true},{"child_id":"c1220000-0000-4000-8000-0000000000c2","pin_set":false}]'::jsonb,
  'parent sees one boolean per active child (archived child left out)');
select ok(not (public.child_mode_pin_status()->0 ?| array['pin_hash','failed_count','locked_until','name']),'only child_id and pin_set are returned');
select ok(public.verify_child_pin('c1220000-0000-4000-8000-0000000000c2',null),'server rule: a child without a PIN enters without one');
select ok(not public.verify_child_pin('c1220000-0000-4000-8000-0000000000c1',null),'a child with a PIN still needs it');
select ok(public.verify_child_pin('c1220000-0000-4000-8000-0000000000c1','1234'),'correct PIN enters');
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fb"}}',true);
select is(public.child_mode_pin_status(),'[]'::jsonb,'another family sees none of these children');
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
select throws_ok($$select public.child_mode_pin_status()$$,'42501','forbidden','forged family claim is refused');
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000d0","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1220000-0000-4000-8000-0000000000fa","device_id":"c1220000-0000-4000-8000-0000000001d0"}}',true);
select throws_ok($$select public.child_mode_pin_status()$$,'42501','forbidden','a device session cannot read PIN status');
reset role;

-- 3. Pairing remembers the parent ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000d1","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
insert into c122 values('code1', public.request_pairing('Ece tablet'));
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
insert into c122 values('prev1', public.preview_device_pairing((select v from c122 where k='code1'))->>'preview_token');
insert into c122 values('dev1', public.pair_child_device((select v from c122 where k='code1'),(select v from c122 where k='prev1'))::text);
select is((select count(*)::int from public.devices where id=(select v from c122 where k='dev1')::uuid),1,'parent a2 paired the tablet');
reset role;
select is((select paired_by from gina.device_pairers where device_id=(select v from c122 where k='dev1')::uuid),'c1220000-0000-4000-8000-0000000000a2'::uuid,'pairer is remembered server-side');
select is((select paired_by from gina.device_pairers where device_id='c1220000-0000-4000-8000-0000000001d0'),null::uuid,'a device inserted without a parent session has no known pairer');

-- 4. "Not my family" → note for the parent who paired ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',format('{"sub":"c1220000-0000-4000-8000-0000000000d1","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1220000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c122 where k='dev1')),true);
select is(public.reject_device_pairing()->>'status','rejected','tablet rejects within the window');
select throws_ok($$select count(*) from gina.parent_inbox$$,'42501',null,'the tablet cannot read any inbox');
reset role;
select is((select count(*)::int from gina.parent_inbox where kind='device_pairing_rejected' and family_id='c1220000-0000-4000-8000-0000000000fa'),1,'exactly one note');
select is((select user_id from gina.parent_inbox where kind='device_pairing_rejected' and family_id='c1220000-0000-4000-8000-0000000000fa'),'c1220000-0000-4000-8000-0000000000a2'::uuid,'the note goes to the parent who paired');
select is((select count(*)::int from gina.parent_inbox where kind='device_pairing_rejected' and (title||body) ~* '(Ece|Aile A|tablet adı|c1220000)'),0,'note carries no device name, family name or id');
select is((select child_id from gina.parent_inbox where kind='device_pairing_rejected' limit 1),null::uuid,'note is not about a child');
select ok((select expires_on=current_date+30 from gina.parent_inbox where kind='device_pairing_rejected' limit 1),'note expires in 30 days');
select isnt((select revoked_at from public.devices where id=(select v from c122 where k='dev1')::uuid),null,'the device is revoked as before');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000a2","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
select is((public.parent_inbox()->>'unread')::int,1,'pairer sees one unread note');
select is(public.parent_inbox()#>>'{rows,0,kind}','device_pairing_rejected','pairer''s inbox lists the note');
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
select is((public.parent_inbox()->>'unread')::int,0,'the other parent gets no note for a2''s pairing');
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fb"}}',true);
select is((public.parent_inbox()->>'unread')::int,0,'another family gets nothing');
reset role;

-- 5. Pairer unknown (paired before this migration) → every parent of the family --------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000d0","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1220000-0000-4000-8000-0000000000fa","device_id":"c1220000-0000-4000-8000-0000000001d0"}}',true);
select is(public.reject_device_pairing()->>'status','rejected','legacy-paired tablet rejects within the window');
reset role;
select is((select array_agg(user_id::text order by user_id) from gina.parent_inbox where kind='device_pairing_rejected' and event_key like 'device_pairing_rejected:c1220000-0000-4000-8000-0000000001d0:%'),
  array['c1220000-0000-4000-8000-0000000000a1','c1220000-0000-4000-8000-0000000000a2'],'unknown pairer → every parent of that family');

-- 6. Re-pair keeps the pairer row in step; outside the window → no note ------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000d2","role":"authenticated","is_anonymous":true,"gina":{"role":"none"}}',true);
insert into c122 values('code2', public.request_pairing('Can tablet'));
select set_config('request.jwt.claims','{"sub":"c1220000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"role":"parent","family_id":"c1220000-0000-4000-8000-0000000000fa"}}',true);
insert into c122 values('prev2', public.preview_device_pairing((select v from c122 where k='code2'))->>'preview_token');
insert into c122 values('dev2', public.pair_child_device((select v from c122 where k='code2'),(select v from c122 where k='prev2'))::text);
reset role;
select is((select paired_by from gina.device_pairers where device_id=(select v from c122 where k='dev2')::uuid),'c1220000-0000-4000-8000-0000000000a1'::uuid,'a1 recorded as pairer');
update public.devices set paired_at=now()-interval '16 minutes' where id=(select v from c122 where k='dev2')::uuid;
select is((select paired_at from gina.device_pairers where device_id=(select v from c122 where k='dev2')::uuid),now()-interval '16 minutes','pairer row follows paired_at');
set local role authenticated;
select set_config('request.jwt.claims',format('{"sub":"c1220000-0000-4000-8000-0000000000d2","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"c1220000-0000-4000-8000-0000000000fa","device_id":"%s"}}',(select v from c122 where k='dev2')),true);
select throws_ok($$select public.reject_device_pairing()$$,'P0001','pairing_undo_expired','outside 15 min the tablet cannot reject');
reset role;
select is((select count(*)::int from gina.parent_inbox where event_key like 'device_pairing_rejected:'||(select v from c122 where k='dev2')||':%'),0,'no note when the reject is refused');
select is((select revoked_at from public.devices where id=(select v from c122 where k='dev2')::uuid),null,'device stays paired');

select * from finish();
rollback;
