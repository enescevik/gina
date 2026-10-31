-- Evcil hayvan seçimi: geçerli değerler, aile sınırı, varsayılan kedi.
begin;
select plan(18);

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

insert into public.family_room_settings(family_id) values ('10000000-0000-0000-0000-0000000000e1'),('10000000-0000-0000-0000-0000000000e2');
select is((select count(*)::integer from public.weather_cities),81,'81 city registry entries');
select is((select sound_enabled from public.family_room_settings limit 1),false,'sound defaults off');
select is((select motion_enabled from public.family_room_settings limit 1),true,'motion defaults on');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is((select count(*)::integer from public.family_room_settings),1,'parent reads own family only');
select lives_ok($$update public.family_room_settings set city_id='745044',sound_enabled=true where family_id='10000000-0000-0000-0000-0000000000e1'$$,'parent sets city and sound');
select throws_ok($$update public.family_room_settings set city_id='arbitrary-coordinates'$$,'23503',null,'city must exist in registry');
select throws_ok($$select * from public.room_weather_cache$$,'42501',null,'client cannot read provider cache');
select throws_ok($$select public.claim_room_weather_refresh('745044')$$,'42501',null,'client cannot claim provider requests');
update public.family_room_settings set sound_enabled=true where family_id='10000000-0000-0000-0000-0000000000e2';
reset role;
select is((select sound_enabled from public.family_room_settings where family_id='10000000-0000-0000-0000-0000000000e2'),false,'cross-family write has no effect');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e1d1","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"device","device_id":"30000000-0000-0000-0000-00000000e1c1","child_id":"20000000-0000-0000-0000-00000000e1c1"}}',true);
select is((select count(*)::integer from public.family_room_settings),1,'active child device reads family setting');
update public.family_room_settings set city_id=null;
select is((select city_id from public.family_room_settings),'745044','child cannot alter parent city');
reset role;
update public.devices set revoked_at=now() where auth_user_id='00000000-0000-0000-0000-00000000e1d1';
set local role authenticated;
select is((select count(*)::integer from public.family_room_settings),0,'revoked device sees nothing with stale JWT');
reset role;
set local role service_role;
select is(public.claim_room_weather_refresh('745044'),true,'first request claims city');
select is(public.claim_room_weather_refresh('745044'),false,'concurrent claim rejected');
update public.room_weather_cache set refresh_after=now()-interval '1 minute',expires_at=now()+interval '15 minutes';
select is(public.claim_room_weather_refresh('745044'),false,'fresh cache not refetched');
reset role;
set local role anon;
select throws_ok($$select * from public.family_room_settings$$,'42501',null,'unauthenticated user cannot read preferences');
reset role;
delete from public.family_members where user_id='00000000-0000-0000-0000-00000000e101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-0000000000e1","role":"parent"}}',true);
select is((select count(*)::integer from public.family_room_settings),0,'removed parent cannot use stale JWT');
reset role;
delete from public.families where id='10000000-0000-0000-0000-0000000000e1';
select is((select count(*)::integer from public.family_room_settings),1,'family deletion removes preferences');
select * from finish();
rollback;
