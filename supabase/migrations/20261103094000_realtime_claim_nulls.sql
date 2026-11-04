-- Realtime may serialize nested JSON null claims as the literal string "null".
-- UUID casts in an RLS policy must not abort the entire replication batch.
-- Normalize only the three optional GINA identifiers. Do not change the token
-- hook's public contract, claim roles, membership checks, or device revocation.
create or replace function gina.claims()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with payload as (
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'gina' as value
  )
  select coalesce(jsonb_object_agg(e.key,
    case when e.key in ('family_id','child_id','device_id') and e.value in ('"null"'::jsonb,'""'::jsonb)
      then 'null'::jsonb else e.value end
  ), '{}'::jsonb)
  from payload p cross join lateral jsonb_each(
    case when jsonb_typeof(p.value)='object' then p.value else '{}'::jsonb end
  ) e;
$$;
