-- Evcil hayvan seçimi: geçerli değerler, aile sınırı, varsayılan kedi.
begin;
select plan(7);

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

set local role authenticated;
-- Çocuk cihazı köpeği seçer
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000e1d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000e1", "role": "device", "device_id": "30000000-0000-0000-0000-00000000e1c1", "child_id": "20000000-0000-0000-0000-00000000e1c1", "admin": false}}',
  true);
select lives_ok($$ select public.set_room_pet('dog') $$, 'çocuk evcil hayvan seçer');
select throws_ok($$ select public.set_room_pet('dragon') $$, 'P0001', 'bad_pet', 'listede olmayan hayvan reddedilir');

-- Veli telefonda çocuk modu: maymun
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000e101", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000e1", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok($$ select public.set_room_pet('monkey', '20000000-0000-0000-0000-00000000e1c1') $$, 'veli çocuk adına seçer');

-- Başka ailenin velisi bu çocuğa yazamaz
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000e201", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000e2", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select throws_ok($$ select public.set_room_pet('lion', '20000000-0000-0000-0000-00000000e1c1') $$, 'P0001', 'no_child', 'başka aile çocuğu reddedilir');

reset role;
select is((select pet_key from public.child_room_preferences where child_id = '20000000-0000-0000-0000-00000000e1c1'), 'monkey', 'son geçerli seçim kalır');
select is((select column_default from information_schema.columns where table_name = 'child_room_preferences' and column_name = 'pet_key'), '''cat''::text', 'varsayılan referanstaki kedi');

set local role authenticated;
select throws_ok($$ select public.set_room_preference('boy', 'default', '20000000-0000-0000-0000-00000000e1c1') $$, 'P0001', 'no_child', 'room preference rejects a child from another family');
reset role;
select * from finish();
rollback;
