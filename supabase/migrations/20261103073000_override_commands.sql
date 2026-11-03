-- Administrative receipts are private: family members must not see operator reasons.
create table gina.override_commands (
 request_id uuid primary key,
 actor_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
revoke all on gina.override_commands from public,anon,authenticated;

create function public.admin_save_override(p_request_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r gina.override_commands; action text; family uuid; target uuid; result jsonb; starts timestamptz; ends timestamptz;
begin
 perform gina.assert_admin();
 if p_request_id is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,73));
 select * into r from gina.override_commands where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.payload<>p_command then raise exception 'request_conflict';end if;
  return r.result;
 end if;
 action:=p_command->>'action';
 if jsonb_typeof(p_command->'reason') is distinct from 'string' or length(trim(p_command->>'reason')) not between 3 and 1000 then raise exception 'override_reason_required';end if;
 if action='grant' then
  if (select count(*) from jsonb_object_keys(p_command))<>6 or not(p_command ?& array['action','family_id','plan','reason','starts_at','ends_at'])
   or jsonb_typeof(p_command->'family_id') is distinct from 'string' or jsonb_typeof(p_command->'starts_at') is distinct from 'string'
   or jsonb_typeof(p_command->'ends_at') is distinct from 'string' or coalesce(p_command->>'plan','') not in('plus','pro') then raise exception 'invalid_input' using errcode='22023';end if;
  family:=(p_command->>'family_id')::uuid;starts:=(p_command->>'starts_at')::timestamptz;ends:=(p_command->>'ends_at')::timestamptz;
  if not isfinite(starts) or not isfinite(ends) or starts<now()-interval '1 day' then raise exception 'override_ends_at_invalid';end if;
  target:=public.admin_grant_override(family,(p_command->>'plan')::public.plan_code,p_command->>'reason',ends,starts);
 elsif action='expire' then
  if (select count(*) from jsonb_object_keys(p_command))<>3 or not(p_command ?& array['action','override_id','reason'])
   or jsonb_typeof(p_command->'override_id') is distinct from 'string' then raise exception 'invalid_input' using errcode='22023';end if;
  target:=(p_command->>'override_id')::uuid;
  select family_id into family from public.entitlement_overrides where id=target for update;
  if not found then raise exception 'override_not_found_or_revoked';end if;
  perform public.admin_expire_override(target,p_command->>'reason');
 else raise exception 'invalid_input' using errcode='22023';end if;
 result:=jsonb_build_object('request_id',p_request_id,'action',action,'override_id',target,'family_id',family);
 insert into gina.override_commands(request_id,actor_id,family_id,payload,result) values(p_request_id,auth.uid(),family,p_command,result);
 return result;
end;$$;
revoke all on function public.admin_save_override(uuid,jsonb) from public,anon;
grant execute on function public.admin_save_override(uuid,jsonb) to authenticated;
-- Legacy grant/expire RPCs remain for the deployed backoffice. New UI uses this
-- command endpoint; old clients do not gain replay guarantees retroactively.
