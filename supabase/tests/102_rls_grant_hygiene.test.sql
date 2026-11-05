-- Q03 düzeltme (20261106150000_rls_grant_hygiene): gina.* tablolarında RLS açık, politika karşılığı olmayan
-- authenticated yazma grant'i yok, anon yalnız bilinçli paylaşım fonksiyonunu çalıştırabilir; veli ve cihaz akışları
-- (RPC üzerinden gina.* geçmişi yazma, görev tikleme) eskisi gibi çalışır.
begin;
select plan(16);

-- Katalog kontrolleri ------------------------------------------------------------------------
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='gina' and c.relkind in ('r','p') and not c.relrowsecurity),
  0, 'gina şemasında RLS kapalı tablo yok');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname in ('public','gina') and c.relkind in ('r','p') and not c.relrowsecurity),
  0, 'public/gina şemalarında RLS kapalı tablo yok');

-- authenticated için INSERT/UPDATE/DELETE yetkisi olan her tabloda aynı komut (veya ALL) için en az bir politika olmalı.
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
            cross join (values ('INSERT','a'),('UPDATE','w'),('DELETE','d')) cmd(priv,pol)
            where n.nspname in ('public','gina') and c.relkind in ('r','p')
              and has_table_privilege('authenticated', c.oid, cmd.priv)
              and not exists (select 1 from pg_policy p where p.polrelid=c.oid and p.polcmd in (cmd.pol,'*'))),
  0, 'authenticated için politika karşılığı olmayan yazma grant''i yok');

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='gina' and c.relkind in ('r','p')
              and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT'))),
  0, 'gina.* tablolarında anon/authenticated select grant''i yok');

-- anon EXECUTE: yalnız öğretmen paylaşım görünümü (tetikleyici fonksiyonları çağrılamaz; dışarıda).
select is((select coalesce(string_agg(n.nspname||'.'||p.proname, ',' order by 1),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname in ('public','gina') and p.prokind='f' and p.prorettype <> 'trigger'::regtype
              and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'public.get_shared_child_view,public.unsubscribe_with_token', 'anon yalnız öğretmen paylaşım görünümü ve imzalı vazgeçme fonksiyonunu çalıştırabilir (S02)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='gina' and p.proname in ('claims','role','family_id','child_id','valid_review_document')
              and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  5, 'gina yardımcı fonksiyonlarında authenticated EXECUTE korunur');

-- Sentetik aile ------------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000001a201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q03-veli@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000001d201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());
insert into public.families (id, name, created_by) values ('10000000-0000-0000-0000-000000010201', 'Q03 Aile', '00000000-0000-0000-0000-00000001a201');
insert into public.family_members (family_id, user_id) values ('10000000-0000-0000-0000-000000010201', '00000000-0000-0000-0000-00000001a201');
insert into public.children (id, family_id, name) values ('20000000-0000-0000-0000-000000010201', '10000000-0000-0000-0000-000000010201', 'Q03 Çocuk');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-000000010201', '10000000-0000-0000-0000-000000010201', '00000000-0000-0000-0000-00000001d201', '20000000-0000-0000-0000-000000010201');
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-000000010201', '10000000-0000-0000-0000-000000010201', '20000000-0000-0000-0000-000000010201', 'Q03 görev', 2, current_date - 30);

-- Veli -----------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000001a201", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-000000010201", "role": "parent", "device_id": null, "child_id": null, "admin": false}}', true);
select is((select count(*)::int from public.children), 1, 'veli kendi çocuğunu görür');
select lives_ok(
  $$ select public.save_parent_note('50000000-0000-0000-0000-000000010201', null, null, 'save', null, '{"title":"Q03","body":"not","subject":"","visibility":"private"}'::jsonb) $$,
  'veli RPC ile not kaydeder (gina.note_changes RLS açıkken security definer yazar)');
select throws_ok($$ select count(*) from gina.note_changes $$, '42501', null, 'veli gina.note_changes tablosunu doğrudan okuyamaz');
select throws_ok($$ insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000001a201') $$, '42501', null, 'veli admins tablosuna doğrudan yazamaz');
select throws_ok($$ insert into public.families (name, created_by) values ('Sızma', '00000000-0000-0000-0000-00000001a201') $$, '42501', null, 'veli families tablosuna doğrudan satır ekleyemez');
select lives_ok($$ update public.families set name = 'Q03 Aile 2' where id = '10000000-0000-0000-0000-000000010201' $$, 'veli kendi ailesinin adını politika ile günceller');
select is((select name from public.families where id = '10000000-0000-0000-0000-000000010201'), 'Q03 Aile 2', 'aile adı güncellendi');

-- Cihaz ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000001d201", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-000000010201", "role": "device", "device_id": "30000000-0000-0000-0000-000000010201", "child_id": "20000000-0000-0000-0000-000000010201", "admin": false}}', true);
select is((select count(*)::int from public.task_templates), 1, 'cihaz aktif çocuğun şablonunu görür');
select lives_ok(
  $$ select public.complete_task('40000000-0000-0000-0000-000000010201', current_date, '50000000-0000-0000-0000-000000010202') $$,
  'cihaz RPC ile görevi tikler (task_completions doğrudan insert grant''i olmadan)');
select throws_ok($$ insert into public.task_completions (family_id, child_id, template_id, due_date, client_id)
  values ('10000000-0000-0000-0000-000000010201', '20000000-0000-0000-0000-000000010201', '40000000-0000-0000-0000-000000010201', current_date + 1, '50000000-0000-0000-0000-000000010203') $$,
  '42501', null, 'cihaz task_completions tablosuna doğrudan yazamaz');

select * from finish();
rollback;
