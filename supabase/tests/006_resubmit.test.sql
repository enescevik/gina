-- Geri gönderilen görevin yeniden gönderilmesi: returned → done; onaylıda değişiklik yok;
-- yıldız yalnız onayda yazılır (iade senaryosunda çift yıldız oluşmaz).
begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-f@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000f', 'Aile F', '00000000-0000-0000-0000-00000000f001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f001');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', 'Çocuk F');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f0d1', '20000000-0000-0000-0000-0000000000f1');
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-0000000000f1', 'Odanı topla', 3, current_date - 10);

-- Cihaz tikler
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f1", "child_id": "20000000-0000-0000-0000-0000000000f1", "admin": false}}',
  true);
select lives_ok(
  $$ select public.complete_task('40000000-0000-0000-0000-0000000000f1', current_date, '70000000-0000-0000-0000-000000000001') $$,
  'cihaz görevi tikler'
);

-- Ebeveyn geri gönderir
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok(
  $$ select public.review_task((select id from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000f1'), false) $$,
  'ebeveyn geri gönderir'
);
select is(
  (select status::text from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000f1'),
  'returned', 'durum returned'
);

-- Cihaz yeniden gönderir (yeni client_id)
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f1", "child_id": "20000000-0000-0000-0000-0000000000f1", "admin": false}}',
  true);
select is(
  (select status::text from public.complete_task('40000000-0000-0000-0000-0000000000f1', current_date, '70000000-0000-0000-0000-000000000002')),
  'done', 'returned görev yeniden done olur'
);
select is(
  (select count(*)::int from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000f1'),
  1, 'aynı gün için tek satır kalır'
);

-- Ebeveyn bu kez onaylar; yıldız bir kez yazılır
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok(
  $$ select public.review_task((select id from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000f1'), true) $$,
  'ebeveyn onaylar'
);
select is(
  (select coalesce(sum(delta), 0)::int from public.star_events where child_id = '20000000-0000-0000-0000-0000000000f1'),
  3, 'yıldız yalnız bir kez yazılır'
);

-- Onaylı satıra yeniden gönderim durumu değiştirmez
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f1", "child_id": "20000000-0000-0000-0000-0000000000f1", "admin": false}}',
  true);
select is(
  (select status::text from public.complete_task('40000000-0000-0000-0000-0000000000f1', current_date, '70000000-0000-0000-0000-000000000003')),
  'approved', 'onaylı satır olduğu gibi döner'
);

select * from finish();
rollback;
