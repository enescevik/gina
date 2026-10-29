-- get_weekly_summary_data: takma adlama ve veri minimizasyonu.
begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-d@test.local', '', now(), '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000d', 'Aile D', '00000000-0000-0000-0000-00000000d001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000d001');
insert into public.children (id, family_id, name, birth_date, grade, sort_order) values
  ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000d', 'GizliAd Kız', '2019-03-15', 2, 0),
  ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-00000000000d', 'GizliAd Oğlan', '2017-06-10', 5, 1);
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-0000000000d1', 'Kitap oku', 2, date '2026-10-26');
insert into public.task_completions (family_id, child_id, template_id, due_date, status, client_id) values
  ('10000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-0000000000d1', date '2026-10-27', 'approved', gen_random_uuid());

select is(
  (select jsonb_array_length(public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26') -> 'children')),
  2,
  'iki çocuk döner'
);
select is(
  (select public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26') -> 'children' -> 0 ->> 'alias'),
  'Çocuk A',
  'ilk çocuk Çocuk A olarak etiketlenir'
);
select ok(
  (select position('GizliAd' in public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26')::text) = 0),
  'çocuk adı çıktıda geçmez (takma adlama)'
);
select ok(
  (select position('birth_date' in public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26')::text) = 0),
  'doğum tarihi alanı çıktıda yok'
);
select is(
  (select jsonb_array_length(public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26') -> 'children' -> 0 -> 'tasks')),
  1,
  'tamamlanan görev listelenir'
);

-- Başka ailenin velisi veri çekemez
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000ff", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select is(
  (select public.get_weekly_summary_data('10000000-0000-0000-0000-00000000000d', date '2026-10-26')),
  null,
  'başka aile için null döner'
);

select * from finish();
rollback;
