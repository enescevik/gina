-- Paket sınırları: free varsayılanı, çocuk/görev/not limitleri, komp ile yükseltme.
begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-c@test.local', '', now(), '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000c', 'Aile C', '00000000-0000-0000-0000-00000000c001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000c001');

-- Ebeveyn C claim'leri
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000c", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select results_eq(
  $$ select plan::text, source from public.get_family_entitlement() $$,
  $$ values ('free', 'free') $$,
  'abonelik yokken paket free'
);

select lives_ok($$ insert into public.children (id, family_id, name) values ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000c', 'Çocuk 1') $$, 'free: 1. çocuk eklenir');
select lives_ok($$ insert into public.children (id, family_id, name) values ('20000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000c', 'Çocuk 2') $$, 'free: 2. çocuk eklenir');
select throws_ok(
  $$ insert into public.children (family_id, name) values ('10000000-0000-0000-0000-00000000000c', 'Çocuk 3') $$,
  'P0001', 'plan_limit_children',
  'free: 3. çocuk paket sınırına takılır'
);

-- Görev sınırı: free planda çocuk başına 7 aktif şablon
select lives_ok(
  $$ insert into public.task_templates (family_id, child_id, title)
     select '10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-0000000000c1', 'Görev ' || g
     from generate_series(1, 7) g $$,
  'free: 7 aktif görev eklenir'
);
select throws_ok(
  $$ insert into public.task_templates (family_id, child_id, title) values ('10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-0000000000c1', 'Görev 8') $$,
  'P0001', 'plan_limit_tasks',
  'free: 8. aktif görev sınıra takılır'
);

-- Komp ile Plus'a yükselt (superuser olarak yazılır; backoffice senaryosu)
reset role;
insert into public.entitlement_overrides (family_id, plan, reason, ends_at)
  values ('10000000-0000-0000-0000-00000000000c', 'plus', 'test komp', now() + interval '30 days');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000c", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select results_eq(
  $$ select plan::text, source from public.get_family_entitlement() $$,
  $$ values ('plus', 'comp') $$,
  'komp ile paket plus olur'
);
select lives_ok(
  $$ insert into public.children (family_id, name) values ('10000000-0000-0000-0000-00000000000c', 'Çocuk 3') $$,
  'plus: 3. çocuk eklenir'
);
select lives_ok(
  $$ insert into public.task_templates (family_id, child_id, title) values ('10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-0000000000c1', 'Görev 8') $$,
  'plus: 8. görev eklenir (sınırsız)'
);

-- Plans tablosu istemciden okunur ama yazılamaz (RLS güncellemeyi 0 satıra süzer)
select lives_ok(
  $$ update public.plans set max_children = 99 where code = 'free' $$,
  'ebeveynin plans güncellemesi hata vermez'
);
select is(
  (select max_children::int from public.plans where code = 'free'),
  2,
  'RLS: plans satırı değişmeden kalır'
);

select * from finish();
rollback;
