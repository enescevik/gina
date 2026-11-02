-- A failed/stale request retried in a later month consumes the current month allowance.
create or replace function public.reserve_setup_ai(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.setup_ai_jobs; ent jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,15));
 select * into j from public.setup_ai_jobs where id=p_id;
 if found then
  if j.family_id<>p_family_id or j.user_id<>p_user_id or j.prompt_hash<>p_hash then return jsonb_build_object('error','request_conflict'); end if;
  if j.status='done' then return jsonb_build_object('cached',j.result); end if;
  if j.status='working' and j.updated_at>now()-interval '3 minutes' then return jsonb_build_object('error','generation_in_progress'); end if;
 end if;
 ent:=public.get_setup_ai_entitlement(p_family_id);
 if (ent->>'remaining')::int<=0 then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if exists(select 1 from public.setup_ai_jobs where family_id=p_family_id and updated_at>now()-interval '20 seconds') then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.setup_ai_jobs(id,family_id,user_id,prompt_hash,status) values(p_id,p_family_id,p_user_id,p_hash,'working')
 on conflict(id) do update set status='working',created_at=now(),updated_at=now();
 return jsonb_build_object('ok',true);
end; $$;
