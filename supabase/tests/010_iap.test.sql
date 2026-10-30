-- Uygulama içi satın alma: Android ürün eşlemesi, uzlaştırma adayları, yetki, pg_cron işi.
begin;
select plan(10);

-- Android eşlemesi: (abonelik, base plan) → kanonik ürün kimliği
select results_eq(
  $$ select product_id from public.plan_products where android_product_id = 'gina_plus' and android_base_plan_id = 'monthly' $$,
  $$ values ('gina_plus_monthly') $$,
  'gina_plus + monthly → gina_plus_monthly'
);
select results_eq(
  $$ select product_id from public.plan_products where android_product_id = 'gina_pro' and android_base_plan_id = 'yearly' $$,
  $$ values ('gina_pro_yearly') $$,
  'gina_pro + yearly → gina_pro_yearly'
);
select is(
  (select count(*)::int from public.plan_products where android_offer_id = 'trial7'),
  4,
  'tüm SKU''larda 7 gün deneme teklifi'
);
select throws_ok(
  $$ insert into public.plan_products (product_id, plan, period, android_product_id) values ('x_test', 'plus', 'monthly', 'gina_x') $$,
  '23514', null,
  'android_product_id base plan olmadan yazılamaz'
);

-- Uzlaştırma adayları
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000a1001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-iap@test.local', '', now(), '{}', '{}', now(), now());
insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000a1000', 'Aile IAP', '00000000-0000-0000-0000-0000000a1001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000a1000', '00000000-0000-0000-0000-0000000a1001');

insert into public.store_subscriptions (family_id, platform, product_id, plan, store_key, status, expires_at, updated_at) values
  ('10000000-0000-0000-0000-0000000a1000', 'apple', 'gina_plus_monthly', 'plus', 'iap-test-near', 'active', now() + interval '1 day', now() - interval '1 day'),
  ('10000000-0000-0000-0000-0000000a1000', 'google', 'gina_pro_yearly', 'pro', 'iap-test-far', 'active', now() + interval '200 days', now() - interval '1 day'),
  ('10000000-0000-0000-0000-0000000a1000', 'apple', 'gina_plus_yearly', 'plus', 'iap-test-fresh', 'active', now() + interval '1 day', now()),
  ('10000000-0000-0000-0000-0000000a1000', 'google', 'gina_plus_monthly', 'plus', 'iap-test-hold', 'on_hold', now() - interval '3 days', now() - interval '1 day'),
  ('10000000-0000-0000-0000-0000000a1000', 'apple', 'gina_pro_monthly', 'pro', 'iap-test-expired', 'expired', now() - interval '3 days', now() - interval '1 day');

select results_eq(
  $$ select store_key from public.iap_reconcile_candidates() where store_key like 'iap-test-%' order by store_key $$,
  $$ values ('iap-test-hold'), ('iap-test-near') $$,
  'adaylar: bitişi yakın + askıdaki; uzak, yeni yazılmış ve bitmiş olanlar hariç'
);
select results_eq(
  $$ select count(*)::int from public.iap_reconcile_candidates(p_window => interval '365 days') where store_key like 'iap-test-%' $$,
  $$ values (3) $$,
  'pencere genişleyince uzak abonelik de aday'
);

-- Yetki: veli istemcisi aday listesini çağıramaz, kendi aboneliklerini okuyabilir
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000a1001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000a1000", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select throws_ok(
  $$ select * from public.iap_reconcile_candidates() $$,
  '42501', null,
  'authenticated iap_reconcile_candidates çağıramaz'
);
select is(
  (select count(*)::int from public.store_subscriptions where store_key like 'iap-test-%'),
  5,
  'veli kendi ailesinin aboneliklerini okur'
);
select is(
  (select plan::text from public.get_family_entitlement()),
  'pro',
  'aktif pro abonelik etkin paketi belirler'
);
reset role;

-- pg_cron varsa iş tanımlı olmalı (yerelde yoksa geçer)
create function pg_temp.iap_cron_ok() returns boolean language plpgsql as $f$
declare v int;
begin
  if to_regclass('cron.job') is null then
    return true;
  end if;
  execute $q$ select count(*) from cron.job where jobname = 'iap-reconcile' $q$ into v;
  return v = 1;
end
$f$;
select ok(pg_temp.iap_cron_ok(), 'pg_cron: iap-reconcile işi zamanlanmış');

select * from finish();
rollback;
