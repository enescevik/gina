-- Legacy internal tables had no client grants; RLS adds defense in depth without changing owner/service workers.
do $$declare t record;begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','gina') and c.relkind in ('r','p') and not c.relrowsecurity
 and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
 loop execute format('alter table %I.%I enable row level security',t.nspname,t.relname);end loop;
end;$$;
create function gina.security_schema_findings() returns table(code text,object_name text)
language sql stable security definer set search_path='' as $$
 with app_tables as (
 select c.oid,c.relname,c.relrowsecurity,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','gina') and c.relkind in ('r','p')
 and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
 )
 select 'rls_off'::text,format('%I.%I',t.nspname,t.relname) from app_tables t where not t.relrowsecurity
 union all
 select 'anon_table_grant',format('%I.%I',t.nspname,t.relname) from app_tables t
 where has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE')
 or has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE')
 union all
 select 'definer_search_path_missing',p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','gina') and p.prosecdef
 and not exists(select 1 from unnest(p.proconfig) config where config like 'search_path=%')
 union all
 select 'authenticated_grant_without_policy',format('%I.%I:%s',t.nspname,t.relname,priv.name)
 from app_tables t cross join (values('r','SELECT'),('a','INSERT'),('w','UPDATE'),('d','DELETE')) priv(cmd,name)
 where (has_table_privilege('authenticated',t.oid,priv.name)
 or case when priv.name<>'DELETE' then has_any_column_privilege('authenticated',t.oid,priv.name) else false end)
 and not exists(select 1 from pg_policy p where p.polrelid=t.oid and p.polcmd::text in (priv.cmd,'*')
 and (0=any(p.polroles) or (select oid from pg_roles where rolname='authenticated')=any(p.polroles)))
$$;
revoke all on function gina.security_schema_findings() from public,anon,authenticated;
grant execute on function gina.security_schema_findings() to service_role;
