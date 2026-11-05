-- Q02-8 → Q03 kontrol listesi: hesap silme zinciri `auth.users` üzerinde DELETE yetkisine dayanır.
-- gina.prepare_account_deletion() (SECURITY DEFINER, sahibi postgres) anonim cihaz kullanıcılarını
-- auth.users'tan siler; sahibin DELETE yetkisi yoksa Auth "Database error deleting user" döndürür.
-- Bu betik SALT OKUNUR'dur: hiçbir satır/ayar değiştirmez. Üretimde SQL Editor'da ya da
--   psql "$PROD_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/check-auth-delete-privilege.sql
-- ile çalıştır; her satırda `ok` beklenir. `FAIL` görülen satır Q03'te düzeltme işi açar.
-- Çıktıya kişisel veri yazılmaz (yalnız katalog bilgisi).
begin read only;

with checks(label, ok, detail) as (
  select 'postgres has DELETE on auth.users',
         has_table_privilege('postgres', 'auth.users', 'DELETE'),
         'gina.prepare_account_deletion anonim cihaz kullanıcılarını siler'
  union all
  select 'postgres has SELECT on auth.users',
         has_table_privilege('postgres', 'auth.users', 'SELECT'),
         'tetikleyici silinen satırı okur'
  union all
  select 'supabase_auth_admin has DELETE on auth.users',
         has_table_privilege('supabase_auth_admin', 'auth.users', 'DELETE'),
         'Auth servisi silme isteğini bu rolle yürütür'
  union all
  select 'prepare_account_deletion is SECURITY DEFINER owned by postgres',
         coalesce((select p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'gina' and p.proname = 'prepare_account_deletion'), false),
         'fonksiyon sahibinin yetkisiyle çalışır'
  union all
  select 'finish_account_deletion is SECURITY DEFINER owned by postgres',
         coalesce((select p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'gina' and p.proname = 'finish_account_deletion'), false),
         'aile/cihaz temizliği aynı transaction içinde biter'
  union all
  select 'before-delete trigger present on auth.users',
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'gina_prepare_account_deletion' and not t.tgisinternal and t.tgenabled <> 'D'),
         'tetikleyici kurulu ve etkin'
  union all
  select 'after-delete trigger present on auth.users',
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'gina_finish_account_deletion' and not t.tgisinternal and t.tgenabled <> 'D'),
         'tetikleyici kurulu ve etkin'
  union all
  select 'deletion functions not executable by app roles',
         not has_function_privilege('authenticated', 'gina.prepare_account_deletion()', 'EXECUTE')
         and not has_function_privilege('anon', 'gina.prepare_account_deletion()', 'EXECUTE')
         and not has_function_privilege('service_role', 'gina.prepare_account_deletion()', 'EXECUTE'),
         'yalnız tetikleyici çağırır'
)
select case when ok then 'ok  ' else 'FAIL' end as status, label, detail from checks order by ok, label;

commit;
