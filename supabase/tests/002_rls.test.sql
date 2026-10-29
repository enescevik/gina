-- RLS senaryoları: iki aile, bir ebeveyn ve bir cihaz; JWT claim'leri request.jwt.claims ile taklit edilir.
begin;
select plan(14);

-- Test kullanıcıları (yerel auth.users) ---------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-a@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-b@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

-- Aile A ve Aile B (superuser olarak doğrudan) ------------------------------------------
insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000a', 'Aile A', '00000000-0000-0000-0000-00000000a001'),
  ('10000000-0000-0000-0000-00000000000b', 'Aile B', '00000000-0000-0000-0000-00000000b001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a001'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000b001');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Çocuk A1'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Çocuk A2'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Çocuk B1');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000d001', '20000000-0000-0000-0000-0000000000a1');
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', 'Dişlerini fırçala', 2, current_date - 30),
  ('40000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', 'Odanı topla', 1, current_date - 30),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-0000000000b1', 'Kitap oku', 1, current_date - 30);
insert into public.grades (family_id, child_id, subject, score) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', 'Matematik', 90);

-- Auth hook claim'leri doğru üretiyor ----------------------------------------------------
select is(
  (public.custom_access_token_hook('{"user_id": "00000000-0000-0000-0000-00000000a001", "claims": {}}'::jsonb) -> 'claims' -> 'gina' ->> 'role'),
  'parent',
  'hook: aile üyesi parent rolü alır'
);
select is(
  (public.custom_access_token_hook('{"user_id": "00000000-0000-0000-0000-00000000d001", "claims": {}}'::jsonb) -> 'claims' -> 'gina' ->> 'child_id'),
  '20000000-0000-0000-0000-0000000000a1',
  'hook: cihaz aktif çocuğu claim olarak taşır'
);

-- Ebeveyn A olarak ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000a", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select is((select count(*)::int from public.children), 2, 'ebeveyn A yalnız kendi çocuklarını görür');
select is((select count(*)::int from public.task_templates), 2, 'ebeveyn A yalnız kendi şablonlarını görür');
select is((select count(*)::int from public.grades), 1, 'ebeveyn A puanları görür');
select throws_ok(
  $$ insert into public.children (family_id, name) values ('10000000-0000-0000-0000-00000000000b', 'Sızma') $$,
  '42501',
  null,
  'ebeveyn A başka aileye çocuk ekleyemez'
);

-- Cihaz (Aile A, aktif çocuk A1) olarak ---------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000d001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000a", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000d1", "child_id": "20000000-0000-0000-0000-0000000000a1", "admin": false}}',
  true);

select is((select count(*)::int from public.children), 2, 'cihaz ailesinin çocuk listesini görür (profil seçimi)');
select is((select count(*)::int from public.task_templates), 1, 'cihaz yalnız aktif çocuğun şablonlarını görür');
select is((select count(*)::int from public.grades), 0, 'cihaz puanları göremez');

select lives_ok(
  $$ select public.complete_task('40000000-0000-0000-0000-0000000000a1', current_date, '50000000-0000-0000-0000-000000000001') $$,
  'cihaz kendi çocuğunun görevini tikler'
);
select throws_ok(
  $$ select public.complete_task('40000000-0000-0000-0000-0000000000a2', current_date, '50000000-0000-0000-0000-000000000002') $$,
  'P0001',
  'wrong_child',
  'cihaz başka çocuğun görevini tikleyemez'
);
select throws_ok(
  $$ select public.review_task((select id from public.task_completions limit 1), true) $$,
  '42501',
  'forbidden',
  'cihaz onay veremez'
);

-- Ebeveyn A onaylar, yıldız yazılır ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000a", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok(
  $$ select public.review_task((select id from public.task_completions where client_id = '50000000-0000-0000-0000-000000000001'), true) $$,
  'ebeveyn onaylar'
);
select is((select coalesce(sum(delta), 0)::int from public.star_events where child_id = '20000000-0000-0000-0000-0000000000a1'), 2, 'onay yıldız defterine 2 yıldız yazar');

select * from finish();
rollback;
