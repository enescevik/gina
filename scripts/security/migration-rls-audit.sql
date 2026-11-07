-- Run after applying all migrations, never against an unaudited partial schema.
-- psql -v ON_ERROR_STOP=1 -f scripts/security/migration-rls-audit.sql
begin read only;
select code,object_name from gina.security_schema_findings() order by code,object_name;
do $$begin
 if exists(select 1 from gina.security_schema_findings()) then
  raise exception 'schema_security_audit_failed';
 end if;
end;$$;
rollback;
