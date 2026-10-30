-- Ödül akışı: hedef, harcama isteği (idempotent), onayda düşüm, iptalde tek iade, rozetler.
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-g@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000a1d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000000a1', 'Aile G', '00000000-0000-0000-0000-00000000a101');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a101');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-00000000a1c1', '10000000-0000-0000-0000-0000000000a1', 'Çocuk G');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-00000000a1c1', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a1d1', '20000000-0000-0000-0000-00000000a1c1');
-- 10 yıldız bakiye
insert into public.star_events (family_id, child_id, delta, reason) values
  ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000a1c1', 10, 'bonus');

-- Veli ödül tanımlar
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000a101", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000a1", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
insert into public.family_rewards (id, family_id, title, icon, cost_stars, created_by) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1', 'Sinema bileti', 'reward-movie-night', 8, '00000000-0000-0000-0000-00000000a101'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1', 'Pahalı oyuncak', 'reward-toy', 50, '00000000-0000-0000-0000-00000000a101');

-- Cihaz (çocuk): hedef + istek
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000a1d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000a1", "role": "device", "device_id": "30000000-0000-0000-0000-00000000a1c1", "child_id": "20000000-0000-0000-0000-00000000a1c1", "admin": false}}',
  true);

select is(
  (select status::text from public.set_child_goal('80000000-0000-0000-0000-000000000001')),
  'active', 'çocuk hedef seçer'
);
select is(
  (select count(*)::int from public.family_rewards), 2, 'cihaz aktif ödülleri görür'
);
select throws_ok(
  $$ select public.request_reward('80000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000009') $$,
  'P0001', 'insufficient_stars', 'bakiye yetmeyince istek reddedilir'
);
select lives_ok(
  $$ select public.request_reward('80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001') $$,
  'çocuk harcama isteği açar'
);
select is(
  (select id from public.request_reward('80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001')),
  (select id from public.reward_requests where idempotency_key = '90000000-0000-0000-0000-000000000001'),
  'aynı idempotency key aynı isteği döndürür'
);
select throws_ok(
  $$ select public.decide_reward_request((select id from public.reward_requests limit 1), true) $$,
  '42501', 'forbidden', 'cihaz karar veremez'
);

-- Veli onaylar
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000a101", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000a1", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select is(
  (select status::text from public.decide_reward_request((select id from public.reward_requests limit 1), true)),
  'approved', 'veli onaylar'
);
select is(gina.child_star_balance('20000000-0000-0000-0000-00000000a1c1'), 2, 'yıldız düşer (10-8=2)');
select is(
  (select status::text from public.decide_reward_request((select id from public.reward_requests limit 1), true)),
  'approved', 'ikinci karar çağrısı idempotent'
);
select is(gina.child_star_balance('20000000-0000-0000-0000-00000000a1c1'), 2, 'çift düşüm olmaz');
select is(
  (select count(*)::int from public.child_inventory where child_id = '20000000-0000-0000-0000-00000000a1c1'),
  1, 'envantere girer'
);
select is(
  (select status::text from public.child_goals where child_id = '20000000-0000-0000-0000-00000000a1c1' order by created_at desc limit 1),
  'redeemed', 'hedef redeemed olur'
);

-- İptal + iade (tek sefer)
select lives_ok(
  $$ select public.cancel_reward_request((select id from public.reward_requests limit 1)) $$,
  'onaylı istek iptal edilir'
);
select is(gina.child_star_balance('20000000-0000-0000-0000-00000000a1c1'), 10, 'iade tek kez yazılır (bakiye 10)');

select * from finish();
rollback;
