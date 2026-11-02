-- Small, parent-reviewed drafts. Separate monthly allowance from Prova questions.
alter table public.plans add column setup_ai_monthly integer not null default 0 check(setup_ai_monthly between 0 and 500);
update public.plans set setup_ai_monthly=case code when 'plus' then 10 when 'pro' then 30 else 0 end;
create table public.setup_ai_jobs (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, prompt_hash text not null,
 status text not null check(status in('working','done','failed')), result jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.setup_ai_jobs enable row level security;
revoke all on public.setup_ai_jobs from anon,authenticated;
grant all on public.setup_ai_jobs to service_role;
create index on public.setup_ai_jobs(family_id,created_at);
create function public.get_setup_ai_entitlement(p_family_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=coalesce(p_family_id,gina.family_id()); p public.plans; used int;
begin
 if f is null or not(auth.role()='service_role' or (gina.is_parent() and f=gina.family_id())) then raise exception 'forbidden' using errcode='42501'; end if;
 p:=gina.family_plan_of(f);
 select count(*) into used from public.setup_ai_jobs where family_id=f and created_at>=gina.family_month_start(f) and (status='done' or (status='working' and updated_at>now()-interval '3 minutes'));
 return jsonb_build_object('plan',p.code,'limit',p.setup_ai_monthly,'remaining',greatest(0,p.setup_ai_monthly-used));
end; $$;
create function public.reserve_setup_ai(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text) returns jsonb
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
 on conflict(id) do update set status='working',updated_at=now();
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.get_setup_ai_entitlement(uuid),public.reserve_setup_ai(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_setup_ai_entitlement(uuid) to authenticated,service_role;
grant execute on function public.reserve_setup_ai(uuid,uuid,uuid,text) to service_role;
