-- C06: QR/deep-link pairing hand-off preview and the parent exit PIN lockout.
begin;
select plan(38);

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000011201','p112a@test.local'),
 ('00000000-0000-4000-8000-000000011202','p112b@test.local'),
 ('00000000-0000-4000-8000-000000011203',null),
 ('00000000-0000-4000-8000-000000011204',null);
insert into public.families(id,name,created_by,invite_code) values
 ('10000000-0000-4000-8000-000000011201','Aile A','00000000-0000-4000-8000-000000011201','FA112A01'),
 ('10000000-0000-4000-8000-000000011202','Aile B','00000000-0000-4000-8000-000000011202','FA112A02');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011201','00000000-0000-4000-8000-000000011201'),
 ('10000000-0000-4000-8000-000000011202','00000000-0000-4000-8000-000000011202');
insert into public.children(id,family_id,name) values
 ('20000000-0000-4000-8000-000000011201','10000000-0000-4000-8000-000000011201','Ece'),
 ('20000000-0000-4000-8000-000000011202','10000000-0000-4000-8000-000000011201','Can');
insert into public.device_pairings(code,auth_user_id,device_name,expires_at) values
 ('CDEFHJKM','00000000-0000-4000-8000-000000011203','Ece tablet',now()+interval '9 minutes'),
 ('CDEFHJKN','00000000-0000-4000-8000-000000011204','Eski kod',now()-interval '1 second');

-- Contract and grants.
select ok(has_function_privilege('authenticated','public.preview_device_pairing(text)','execute'),'signed-in users may call preview');
select ok(not has_function_privilege('anon','public.preview_device_pairing(text)','execute'),'anon cannot preview pairing codes');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='preview_device_pairing'),1,'single preview signature');
select is((select provolatile from pg_proc where oid='public.preview_device_pairing(text)'::regprocedure),'v','preview is volatile: failed attempts are counted (C13-AUTH-1)');
select has_column('public','parent_pins','failed_count','parent PIN keeps a failure counter');
select col_not_null('public','parent_pins','failed_count','failed_count is not null');
select has_column('public','parent_pins','locked_until','parent PIN has a lock time');

set local role authenticated;
-- Parent A previews a live code: device + own family shown; nothing consumed or created.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011201","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011201"}}',true);
select is(public.preview_device_pairing('CDEFHJKM')->>'status','ok','live code previews');
select is(public.preview_device_pairing(' cdef-hjkm ')->>'device_name','Ece tablet','preview shows the name typed on the child device');
select is(public.preview_device_pairing('CDEFHJKM')->>'family_name','Aile A','preview names the family that will receive the device');
select ok((public.preview_device_pairing('CDEFHJKM')->>'seconds_left')::int between 1 and 540,'preview reports remaining seconds');
select is(public.preview_device_pairing('CDEFHJKN')->>'status','invalid_or_expired','expired code is not previewable');
select is(public.preview_device_pairing('CDEFHJKP')->>'status','invalid_or_expired','unknown code is not previewable');
select is(public.preview_device_pairing('12ab56')->>'status','invalid_or_expired','malformed code rejected without lookup');
select is(public.preview_device_pairing(null)->>'status','invalid_or_expired','null code rejected');
select ok(not (public.preview_device_pairing('CDEFHJKN') ? 'device_name'),'expired preview leaks no device name');
reset role;
select is((select consumed_at from public.device_pairings where code='CDEFHJKM'),null,'preview never consumes the code');
select is((select count(*)::int from public.devices where auth_user_id='00000000-0000-4000-8000-000000011203'),0,'preview never creates a device');

-- Child device and anonymous (unpaired) users cannot preview.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011204","role":"authenticated","is_anonymous":true,"gina":{"role":null,"family_id":null}}',true);
select throws_ok($$select public.preview_device_pairing('CDEFHJKM')$$,'42501','forbidden','unpaired device cannot preview another code');

-- Confirm pairs exactly once; a second confirm (replay/double tap/other parent) fails.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011201","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011201"}}',true);
select isnt(public.pair_child_device('CDEFHJKM',public.preview_device_pairing('CDEFHJKM')->>'preview_token'),null,'confirmed preview pairs the device');
select throws_ok($$select public.pair_child_device('CDEFHJKM',public.preview_device_pairing('CDEFHJKM')->>'preview_token')$$,'P0001','invalid_preview_token','used code cannot be reused');
select is(public.preview_device_pairing('CDEFHJKM')->>'status','invalid_or_expired','used code no longer previews');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011202","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011202"}}',true);
select throws_ok($$select public.pair_child_device('CDEFHJKM',public.preview_device_pairing('CDEFHJKM')->>'preview_token')$$,'P0001','invalid_preview_token','other family cannot take over a used code');
select throws_ok($$select public.pair_child_device('CDEFHJKN',public.preview_device_pairing('CDEFHJKN')->>'preview_token')$$,'P0001','invalid_preview_token','expired code cannot pair');
reset role;
select is((select family_id from public.devices where auth_user_id='00000000-0000-4000-8000-000000011203'),'10000000-0000-4000-8000-000000011201'::uuid,'device belongs to the confirming family only');

-- Newly paired device: no profile until the parent saves access (server rule the UI mirrors).
set local role authenticated;
select set_config('request.jwt.claims',format('{"sub":"00000000-0000-4000-8000-000000011203","role":"authenticated","gina":{"role":"device","family_id":"10000000-0000-4000-8000-000000011201","device_id":"%s","child_id":null}}',(select id from public.devices where auth_user_id='00000000-0000-4000-8000-000000011203')),true);
select is((select count(*)::int from public.children),0,'paired device sees no child before configuration');
select throws_ok($$select public.verify_parent_pin('1234')$$,'42501','forbidden','child device cannot check the parent PIN');

-- Parent exit PIN: 5 wrong -> locked 60 s, even the right PIN waits; new PIN resets.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011201","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011201"}}',true);
select is(public.verify_parent_pin('1234'),false,'no parent PIN yet -> false');
select public.set_parent_pin('2468');
select is(public.verify_parent_pin('2468'),true,'right parent PIN accepted');
select is(public.verify_parent_pin('0000'),false,'wrong 1');
select is(public.verify_parent_pin('0001'),false,'wrong 2');
select is(public.verify_parent_pin('0002'),false,'wrong 3');
select is(public.verify_parent_pin('0003'),false,'wrong 4');
select is(public.verify_parent_pin('0004'),false,'wrong 5 locks');
select throws_ok($$select public.verify_parent_pin('2468')$$,'P0001','pin_locked','locked PIN refuses even the right value');
reset role;
update public.parent_pins set locked_until=now()-interval '1 second' where family_id='10000000-0000-4000-8000-000000011201';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011201","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011201"}}',true);
select is(public.verify_parent_pin('2468'),true,'after the wait the right PIN works and resets');
select is(public.verify_parent_pin('0000'),false,'counter restarted');
select public.set_parent_pin('1357');
reset role;
select is((select failed_count::int from public.parent_pins where family_id='10000000-0000-4000-8000-000000011201'),0,'new PIN resets failures');

select * from finish();
rollback;
