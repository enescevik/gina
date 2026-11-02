-- Server-owned operation receipts, budgets and leases for grading and study plans.
create table public.ai_operation_policies (
 action text not null check(action in('grade','plan')),
 plan_code public.plan_code not null references public.plans(code),
 enabled boolean not null default false,
 monthly_limit int not null check(monthly_limit between 0 and 10000),
 per_minute int not null default 3 check(per_minute between 1 and 60),
 max_concurrent int not null default 1 check(max_concurrent between 1 and 10),
 primary key(action,plan_code)
);
insert into public.ai_operation_policies(action,plan_code,enabled,monthly_limit)
 select a, p.code,p.code='pro',case when p.code='pro' then 30 else 0 end
 from public.plans p cross join unnest(array['grade','plan']) a;
alter table public.ai_operation_policies enable row level security;
grant select,update on public.ai_operation_policies to authenticated;
create policy ai_policy_admin on public.ai_operation_policies for all to authenticated
 using(gina.is_admin_strict()) with check(gina.is_admin_strict());
create trigger audit_ai_operation_policies after update on public.ai_operation_policies for each row execute function gina.audit_row('action');
create table public.ai_operation_jobs (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 requested_by uuid references auth.users(id) on delete set null,
 action text not null check(action in('grade','plan')),
 input_hash text not null, lease uuid not null,
 status text not null check(status in('working','done','failed','uncertain')),
 result jsonb, error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(family_id,action,input_hash)
);
create index on public.ai_operation_jobs(family_id,action,created_at);
alter table public.ai_operation_jobs enable row level security;
revoke all on public.ai_operation_jobs from anon,authenticated;
grant all on public.ai_operation_jobs to service_role;
create table public.ai_provider_health (
 provider text primary key, failures int not null default 0, open_until timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.ai_provider_health(provider) values('anthropic');
alter table public.ai_provider_health enable row level security;
revoke all on public.ai_provider_health from anon,authenticated;
grant all on public.ai_provider_health to service_role;
create table public.ai_request_attempts (
 id bigint generated always as identity primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 action text not null, created_at timestamptz not null default now()
);
create index on public.ai_request_attempts(family_id,created_at);
alter table public.ai_request_attempts enable row level security;
revoke all on public.ai_request_attempts from anon,authenticated;
grant all on public.ai_request_attempts to service_role;
create function public.reserve_ai_operation(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_operation_jobs; pol public.ai_operation_policies; plan public.plans; used int;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action not in('grade','plan') or p_hash is null or length(p_hash)<>64 or p_lease is null then raise exception 'invalid_input'; end if;
 if not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 plan:=gina.family_plan_of(p_family_id);
 select * into pol from public.ai_operation_policies where action=p_action and plan_code=plan.code;
 if pol.action is null or not pol.enabled then return jsonb_build_object('error','ai_disabled'); end if;
 select * into j from public.ai_operation_jobs where family_id=p_family_id and action=p_action and input_hash=p_hash for update;
 if found then
  if j.status='done' then return jsonb_build_object('cached',j.result,'id',j.id); end if;
  -- A stale in-flight call may already have incurred cost. Do not silently re-run it.
  if j.status in('working','uncertain') then return jsonb_build_object('error',case when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'generation_in_progress' else 'ai_result_uncertain' end); end if;
 end if;
 if exists(select 1 from public.ai_provider_health where provider='anthropic' and open_until>now()) then return jsonb_build_object('error','ai_temporarily_unavailable'); end if;
 select count(*) into used from public.ai_operation_jobs where family_id=p_family_id and action=p_action and created_at>=gina.family_month_start(p_family_id) and status<>'failed';
 if used>=pol.monthly_limit then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if (select count(*) from public.ai_request_attempts where family_id=p_family_id and created_at>now()-interval '1 minute')>=pol.per_minute then return jsonb_build_object('error','ai_rate_limited'); end if;
 if (select count(*) from public.ai_operation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '3 minutes')>=pol.max_concurrent then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.ai_request_attempts(family_id,action) values(p_family_id,p_action);
 insert into public.ai_operation_jobs(family_id,requested_by,action,input_hash,lease,status)
 values(p_family_id,p_user_id,p_action,p_hash,p_lease,'working')
 on conflict(family_id,action,input_hash) do update set status='working',lease=p_lease,created_at=now(),updated_at=now(),error_code=null
 returning * into j;
 return jsonb_build_object('id',j.id,'lease',p_lease);
end; $$;
create function public.finish_ai_operation(p_id uuid,p_lease uuid,p_result jsonb,p_error text default null,p_uncertain boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.ai_operation_jobs set status=case when p_uncertain then 'uncertain' when p_error is not null then 'failed' else 'done' end,
 result=p_result,error_code=left(p_error,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working';
 if not found then raise exception 'lease_lost'; end if;
 if p_error is null then
  update public.ai_provider_health set failures=0,open_until=null,updated_at=now() where provider='anthropic';
 elsif p_uncertain or p_error ~ '^anthropic_(429|5[0-9][0-9]|529)$' then
  update public.ai_provider_health set failures=failures+1,
  open_until=case when failures+1>=3 then now()+interval '2 minutes' else open_until end,updated_at=now() where provider='anthropic';
 end if;
end; $$;
revoke all on function public.reserve_ai_operation(uuid,uuid,text,text,uuid),public.finish_ai_operation(uuid,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_ai_operation(uuid,uuid,text,text,uuid),public.finish_ai_operation(uuid,uuid,jsonb,text,boolean) to service_role;
-- Same input may be replayed after a lost save response: keep one plan per input.
alter table public.study_plans add column ai_job_id uuid unique references public.ai_operation_jobs(id) on delete set null;
alter table public.prova_ai_usage add column operation_id uuid unique references public.ai_operation_jobs(id) on delete set null;
create function public.admin_ai_operations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.action,p.plan_code),'[]') from public.ai_operation_policies p),
 'health',(select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('paused',coalesce(h.open_until>now(),false))),'[]') from public.ai_provider_health h),
 'jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (
 select id,family_id,action,status,error_code,created_at,updated_at,(status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) retryable from public.ai_operation_jobs order by created_at desc limit 100) j));
end; $$;
create function public.admin_retry_ai_operation(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'reason_required'; end if;
 update public.ai_operation_jobs set status='failed',lease=gen_random_uuid(),updated_at=now(),error_code='operator_retry_authorized'
 where id=p_id and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) returning family_id into f;
 if f is null then raise exception 'job_not_retryable'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason)
 values(auth.uid(),'ai_operation_retry_authorized','ai_operation_jobs',p_id::text,f,trim(p_reason));
end; $$;
revoke all on function public.admin_ai_operations(), public.admin_retry_ai_operation(uuid,text) from public,anon;
grant execute on function public.admin_ai_operations(), public.admin_retry_ai_operation(uuid,text) to authenticated;
create function public.admin_set_ai_operation_policy(p_action text,p_plan public.plan_code,p_enabled boolean,p_monthly int,p_per_minute int,p_concurrent int) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 update public.ai_operation_policies set enabled=p_enabled,monthly_limit=p_monthly,per_minute=p_per_minute,max_concurrent=p_concurrent
 where action=p_action and plan_code=p_plan;
 if not found then raise exception 'policy_not_found'; end if;
end; $$;
revoke all on function public.admin_set_ai_operation_policy(text,public.plan_code,boolean,int,int,int) from public,anon;
grant execute on function public.admin_set_ai_operation_policy(text,public.plan_code,boolean,int,int,int) to authenticated;
