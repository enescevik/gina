begin;
select plan(20);

select has_table('public', 'families', 'families tablosu var');
select has_table('public', 'family_members', 'family_members tablosu var');
select has_table('public', 'children', 'children tablosu var');
select has_table('public', 'child_pins', 'child_pins tablosu var');
select has_table('public', 'devices', 'devices tablosu var');
select has_table('public', 'device_pairings', 'device_pairings tablosu var');
select has_table('public', 'events', 'events tablosu var');
select has_table('public', 'task_templates', 'task_templates tablosu var');
select has_table('public', 'task_completions', 'task_completions tablosu var');
select has_table('public', 'star_events', 'star_events tablosu var');
select has_table('public', 'notes', 'notes tablosu var');
select has_table('public', 'grades', 'grades tablosu var');

-- Her public tabloda RLS açık olmalı.
select is(
  (select count(*)::int from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
   where t.schemaname = 'public' and not c.relrowsecurity),
  0,
  'public şemasında RLS kapalı tablo yok'
);

select has_function('public', 'custom_access_token_hook', array['jsonb'], 'auth hook fonksiyonu var');
select has_function('public', 'create_family', array['text', 'text'], 'create_family var');
select has_function('public', 'complete_task', array['uuid', 'date', 'uuid', 'uuid'], 'complete_task var');
select has_function('public', 'child_pin_login', array['uuid', 'text'], 'child_pin_login var');
select has_function('public', 'pair_device', array['text'], 'pair_device var');

-- anon rolü hiçbir tabloya erişemez.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'),
  0,
  'anon rolünün public tablolarda izni yok'
);

-- Hash tabloları authenticated rolüne kapalı.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
      and table_name in ('child_pins', 'parent_pins', 'device_pairings')),
  0,
  'authenticated rolü hash tablolarını göremez'
);

select * from finish();
rollback;
