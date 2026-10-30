-- Backoffice: admin RPC'leri, AI ayarları, komp + denetim izi, global soru bankası, eski claim koruması.
begin;
select plan(26);

-- Kullanıcılar: admin (admins satırı var), veli (admin değil), eski claim'li eski admin (satırı yok).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000ad001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000ad002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-bo@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000ad003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eski-admin@test.local', '', now(), '{}', '{}', now(), now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000ad001');

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000000b0', 'Backoffice Ailesi', '00000000-0000-0000-0000-0000000ad002');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000ad002');
insert into public.children (family_id, name) values
  ('10000000-0000-0000-0000-0000000000b0', 'Gizli Ad');

insert into public.question_bank (id, family_id, grade, subject, topic, kind, stem, choices, correct_key, provenance, times_asked)
values
  ('50000000-0000-0000-0000-0000000000b1', null, 6, 'Matematik', 'Kesirler', 'multiple_choice', '1/2 + 1/4 = ?',
   '[{"key":"A","text":"3/4"},{"key":"B","text":"2/6"}]', 'A', '{"generator": "seed"}', 3),
  ('50000000-0000-0000-0000-0000000000b2', null, 6, 'Matematik', 'Kesirler', 'open_ended', 'Kesir nedir?', null, null, '{}', 0);

-- Veli: admin RPC'leri ve tabloları kapalı ---------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000ad002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select throws_ok($$ select public.admin_dashboard() $$, '42501', 'forbidden', 'veli: admin_dashboard yasak');
select throws_ok($$ select * from public.admin_search_families(null) $$, '42501', 'forbidden', 'veli: aile arama yasak');
select throws_ok(
  $$ select public.admin_grant_override('10000000-0000-0000-0000-0000000000b0', 'pro', 'kendime komp', now() + interval '30 days') $$,
  '42501', 'forbidden', 'veli: kendine komp veremez');
select is((select count(*)::int from public.ai_settings), 0, 'veli: ai_settings görünmez');
select is((select count(*)::int from public.audit_log), 0, 'veli: audit_log görünmez');
select throws_ok($$ insert into public.audit_log (action) values ('sahte') $$, '42501', null, 'veli: audit_log yazamaz');
select is((select count(*)::int from public.question_bank where family_id is null), 2, 'veli: global sorular okunur');

-- Eski claim: admin=true ama admins satırı yok ------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000ad003", "role": "authenticated", "gina": {"family_id": null, "role": "none", "device_id": null, "child_id": null, "admin": true}}',
  true);

select throws_ok($$ select public.admin_dashboard() $$, '42501', 'forbidden', 'eski claim: RPC yasak');
select is((select count(*)::int from public.entitlement_overrides), 0, 'eski claim: kompları göremez');
update public.question_bank set stem = 'bozuldu' where id = '50000000-0000-0000-0000-0000000000b1';
reset role;
select is((select stem from public.question_bank where id = '50000000-0000-0000-0000-0000000000b1'), '1/2 + 1/4 = ?', 'eski claim: global soruyu değiştiremez');
set local role authenticated;

-- Admin ------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000ad001", "role": "authenticated", "gina": {"family_id": null, "role": "none", "device_id": null, "child_id": null, "admin": true}}',
  true);

select ok((public.admin_dashboard() ->> 'families')::int >= 1, 'admin: panel aile sayısını döndürür');
select ok(public.admin_dashboard() ? 'active_subscriptions', 'admin: panel paket bazlı abonelik içerir');

select is(
  (select child_count from public.admin_search_families('backoffice ailesi')),
  1, 'admin: aile adla bulunur, çocuk sayısı gelir');
select is(
  (select name from public.admin_search_families('VELI-BO@test.local')),
  'Backoffice Ailesi', 'admin: aile e-postayla (tam eşleşme) bulunur');

-- Komp: doğrulamalar
select throws_ok(
  $$ select public.admin_grant_override('10000000-0000-0000-0000-0000000000b0', 'plus', '  ', now() + interval '30 days') $$,
  'P0001', 'override_reason_required', 'admin: gerekçesiz komp olmaz');
select throws_ok(
  $$ select public.admin_grant_override('10000000-0000-0000-0000-0000000000b0', 'plus', 'beta testçisi', now() - interval '1 day') $$,
  'P0001', 'override_ends_at_invalid', 'admin: geçmiş bitiş tarihli komp olmaz');

select lives_ok(
  $$ select public.admin_grant_override('10000000-0000-0000-0000-0000000000b0', 'pro', 'beta testçisi', now() + interval '30 days') $$,
  'admin: komp verilir');
select results_eq(
  $$ select plan::text, source from public.get_family_entitlement('10000000-0000-0000-0000-0000000000b0') $$,
  $$ values ('pro', 'comp') $$, 'komp ile aile pro olur');
select is(
  (select count(*)::int from public.audit_log
    where action = 'entitlement_overrides.insert' and actor_id = '00000000-0000-0000-0000-0000000ad001' and reason = 'beta testçisi'),
  1, 'komp denetim izine gerekçe ve aktörle yazılır');

select lives_ok(
  $$ select public.admin_expire_override((select id from public.entitlement_overrides where family_id = '10000000-0000-0000-0000-0000000000b0'), 'beta bitti') $$,
  'admin: komp sonlandırılır');
select results_eq(
  $$ select plan::text from public.get_family_entitlement('10000000-0000-0000-0000-0000000000b0') $$,
  $$ values ('free') $$, 'sonlandırılan komp sonrası aile free');
select is(
  (select count(*)::int from public.audit_log where action = 'entitlement_overrides.expire' and reason = 'beta bitti'),
  1, 'sonlandırma gerekçesiyle denetim izinde');

-- AI ayarları: model değişimi plans.ai_model'e yansır ve denetlenir
update public.ai_settings set model_id = 'claude-sonnet-5-5', max_output_tokens = 2000, prompt_version = 'v2'
  where plan_code = 'plus';
select is((select ai_model from public.plans where code = 'plus'), 'claude-sonnet-5-5', 'ai_settings modeli plans.ai_model ile eşitlenir');
select ok(
  exists (select 1 from public.audit_log where action = 'ai_settings.update' and target_id = 'plus'
          and details -> 'changed' ? 'prompt_version'),
  'AI ayarı değişikliği denetim izinde');

-- Global soru: kullanılmayan silinir, denetlenir
select lives_ok($$ select public.admin_delete_global_question('50000000-0000-0000-0000-0000000000b2') $$, 'admin: kullanılmayan global soru silinir');
select ok(
  exists (select 1 from public.audit_log where action = 'question_bank.delete' and target_id = '50000000-0000-0000-0000-0000000000b2'),
  'soru silme denetim izinde');

select * from finish();
rollback;
