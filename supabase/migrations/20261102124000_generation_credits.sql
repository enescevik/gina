-- Paid generation: fenced provider result, conservative retry, atomic credit allocation.
alter table public.prova_generation_jobs drop constraint prova_generation_jobs_status_check;
alter table public.prova_generation_jobs add constraint prova_generation_jobs_status_check check(status in('working','done','failed','uncertain'));
alter table public.prova_generation_jobs add column lease uuid, add column provider_result jsonb, add column error_code text;
alter table public.ai_operation_policies drop constraint ai_operation_policies_action_check;
alter table public.ai_operation_policies add constraint ai_operation_policies_action_check check(action in('grade','plan','generate'));
insert into public.ai_operation_policies(action,plan_code,enabled,monthly_limit,per_minute,max_concurrent)
 select 'generate',code,true,300,3,1 from public.plans;
create table public.generation_credit_allocations (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.prova_generation_jobs(id) on delete cascade,
 grant_id uuid references public.learning_credit_grants(id),
 units int not null check(units>0),consumed int not null default 0 check(consumed>=0 and consumed<=units),
 unique nulls not distinct(job_id,grant_id)
);
alter table public.generation_credit_allocations enable row level security;
revoke all on public.generation_credit_allocations from anon,authenticated;
grant all on public.generation_credit_allocations to service_role;

create function gina.generation_balance(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.plans; used int; bonus int; reserved int;
begin
 p:=gina.family_plan_of(f);
 select coalesce(sum(u.items),0)::int-coalesce((select sum(a.consumed)::int from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id where j.family_id=f and j.status='done' and a.grant_id is not null and j.updated_at>=gina.family_month_start(f)),0)
 into used from public.prova_ai_usage u where u.family_id=f and u.action='generate' and u.created_at>=gina.family_month_start(f);
 select coalesce(sum(a.units),0)::int into reserved from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id
 where j.family_id=f and j.status in('working','uncertain') and a.grant_id is null and j.created_at>=gina.family_month_start(f);
 -- Jobs started by pre-upgrade servers also reserve their quota.
 select reserved+coalesce(sum(j.items),0)::int into reserved from public.prova_generation_jobs j where j.family_id=f and j.status in('working','uncertain') and j.created_at>=gina.family_month_start(f) and not exists(select 1 from public.generation_credit_allocations a where a.job_id=j.id);
 select coalesce(sum(greatest(0,g.amount-coalesce((select sum(case when j.status='done' then a.consumed when j.status in('working','uncertain') then a.units else 0 end) from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id where a.grant_id=g.id),0))),0)::int into bonus
 from public.learning_credit_grants g where g.family_id=f and g.kind='ai_questions' and g.starts_at<=now() and g.ends_at>now();
 return jsonb_build_object('base_limit',p.prova_ai_generate_monthly,'base_used',greatest(0,used),'base_remaining',greatest(0,p.prova_ai_generate_monthly-used-reserved),'bonus_remaining',bonus,'reserved',reserved);
end; $$;
revoke all on function gina.generation_balance(uuid) from public,anon,authenticated;

create or replace function public.get_prova_entitlement(p_family_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid; p public.plans; b jsonb;
begin
 if gina.is_parent() then f:=gina.family_id(); elsif gina.is_service() or gina.is_admin_strict() then f:=p_family_id; else raise exception 'forbidden' using errcode='42501'; end if;
 if f is null then raise exception 'family_required'; end if;
 p:=gina.family_plan_of(f);b:=gina.generation_balance(f);
 return jsonb_build_object('plan',p.code,'monthly_exams_limit',p.prova_monthly_exams,
 'monthly_exams_used',(select count(*) from public.exams where family_id=f and kind='practice' and created_at>=gina.family_month_start(f)),
 'scenarios',p.prova_scenarios,'ai_generate_limit',p.prova_ai_generate_monthly+(b->>'bonus_remaining')::int,
 'ai_generate_used',(b->>'base_used')::int+(b->>'reserved')::int,'ai_generate_bonus',(b->>'bonus_remaining')::int,
 'ai_generate_remaining',(b->>'base_remaining')::int+(b->>'bonus_remaining')::int,
 'ai_grading',p.prova_ai_grading,'study_plan',p.prova_study_plan,'booklet',p.prova_booklet);
end; $$;

create function public.reserve_prova_generation_v2(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; b jsonb; p public.plans; pol public.ai_operation_policies; take int; remaining int; g record; lease_id uuid:=gen_random_uuid();
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_items is null or p_items not between 1 and 30 or coalesce(length(p_hash),0)<>64 then raise exception 'invalid_input'; end if;
 if not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  if j.family_id<>p_family_id or j.requested_by is distinct from p_user_id or j.prompt_hash<>p_hash or j.items<>p_items then return jsonb_build_object('error','request_conflict'); end if;
  if j.status='done' then return jsonb_build_object('cached',j.result); end if;
  if j.provider_result is not null and j.status='working' then return jsonb_build_object('provider_result',j.provider_result,'lease',j.lease); end if;
  if j.status in('working','uncertain') then return jsonb_build_object('error',case when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'generation_in_progress' else 'ai_result_uncertain' end); end if;
 end if;
 p:=gina.family_plan_of(p_family_id);
 select * into pol from public.ai_operation_policies where action='generate' and plan_code=p.code;
 if pol.action is null or not pol.enabled then return jsonb_build_object('error','ai_disabled'); end if;
 b:=gina.generation_balance(p_family_id);
 if p_items>(b->>'base_remaining')::int+(b->>'bonus_remaining')::int then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if exists(select 1 from public.ai_provider_health where provider='anthropic' and open_until>now()) then return jsonb_build_object('error','ai_temporarily_unavailable'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status<>'failed' and created_at>=gina.family_month_start(p_family_id))>=pol.monthly_limit then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if (select count(*) from public.ai_request_attempts where family_id=p_family_id and created_at>now()-interval '1 minute')>=pol.per_minute then return jsonb_build_object('error','ai_rate_limited'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '3 minutes')>=pol.max_concurrent then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.ai_request_attempts(family_id,action) values(p_family_id,'generate');
 insert into public.prova_generation_jobs(id,family_id,requested_by,prompt_hash,items,status,lease)
 values(p_id,p_family_id,p_user_id,p_hash,p_items,'working',lease_id)
 on conflict(id) do update set status='working',lease=lease_id,provider_result=null,error_code=null,created_at=now(),updated_at=now();
 delete from public.generation_credit_allocations where job_id=p_id;
 remaining:=p_items; take:=least(remaining,(b->>'base_remaining')::int);
 if take>0 then insert into public.generation_credit_allocations(job_id,units) values(p_id,take);remaining:=remaining-take; end if;
 for g in select c.id,c.amount-coalesce((select sum(case when x.status='done' then a.consumed when x.status in('working','uncertain') then a.units else 0 end) from public.generation_credit_allocations a join public.prova_generation_jobs x on x.id=a.job_id where a.grant_id=c.id),0) available
 from public.learning_credit_grants c where c.family_id=p_family_id and c.kind='ai_questions' and c.starts_at<=now() and c.ends_at>now() order by c.ends_at,c.id for update loop
  exit when remaining=0;take:=least(remaining,g.available);
  if take>0 then insert into public.generation_credit_allocations(job_id,grant_id,units) values(p_id,g.id,take);remaining:=remaining-take; end if;
 end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 return jsonb_build_object('ok',true,'lease',lease_id);
end; $$;

create function public.save_prova_provider_result(p_id uuid,p_lease uuid,p_result jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_result is null or jsonb_typeof(p_result)<>'object' then raise exception 'invalid_result'; end if;
 update public.prova_generation_jobs set provider_result=p_result,updated_at=now() where id=p_id and lease=p_lease and status='working' and (provider_result is null or provider_result=p_result);
 if not found then raise exception 'lease_lost'; end if;
end; $$;
create function public.fail_prova_generation_v2(p_id uuid,p_lease uuid,p_code text,p_uncertain boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.prova_generation_jobs set status=case when p_uncertain then 'uncertain' else 'failed' end,error_code=left(p_code,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working' and provider_result is null;
 if not found then raise exception 'lease_lost'; end if;
 if p_uncertain or p_code ~ '^anthropic_(429|5[0-9][0-9]|529)$' then
 update public.ai_provider_health set failures=failures+1,open_until=case when failures+1>=3 then now()+interval '2 minutes' else open_until end,updated_at=now() where provider='anthropic'; end if;
end; $$;
create function public.complete_prova_generation_v2(p_id uuid,p_lease uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input int,p_output int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; a record; remaining int; take int; v_result jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 -- Serialize quota spending with the next reservation in the same family.
 select family_id into j.family_id from public.prova_generation_jobs where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(j.family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.lease is distinct from p_lease or p_lease is null then raise exception 'lease_lost'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or j.provider_result is null or coalesce(jsonb_typeof(p_rows),'null')<>'array' or jsonb_array_length(p_rows)<>j.items then raise exception 'invalid_generation'; end if;
 remaining:=jsonb_array_length(p_rows);
 for a in select * from public.generation_credit_allocations where job_id=p_id order by grant_id nulls first loop
 take:=least(remaining,a.units); update public.generation_credit_allocations set consumed=take where id=a.id; remaining:=remaining-take; end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 v_result:=public.complete_prova_generation(p_id,p_rows,p_model,p_prompt_version,p_input,p_output);
 -- Legacy completion reads entitlement before changing job status; reconcile after commit state.
 v_result:=jsonb_set(v_result,'{remaining}',to_jsonb((public.get_prova_entitlement(j.family_id)->>'ai_generate_remaining')::int));
 update public.prova_generation_jobs set result=v_result where id=p_id;
 update public.ai_provider_health set failures=0,open_until=null,updated_at=now() where provider='anthropic';
 return v_result;
end; $$;
create function public.admin_retry_prova_generation(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'reason_required'; end if;
 select family_id into f from public.prova_generation_jobs where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(f::text,13));
 update public.prova_generation_jobs set status='failed',lease=gen_random_uuid(),error_code='operator_retry_authorized',updated_at=now()
 where id=p_id and provider_result is null and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'));
 if not found then raise exception 'job_not_retryable'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason) values(auth.uid(),'prova_generation_retry_authorized','prova_generation_jobs',p_id::text,f,trim(p_reason));
end; $$;
revoke all on function public.reserve_prova_generation_v2(uuid,uuid,uuid,text,int),public.save_prova_provider_result(uuid,uuid,jsonb),public.fail_prova_generation_v2(uuid,uuid,text,boolean),public.complete_prova_generation_v2(uuid,uuid,jsonb,text,text,int,int) from public,anon,authenticated;
grant execute on function public.reserve_prova_generation_v2(uuid,uuid,uuid,text,int),public.save_prova_provider_result(uuid,uuid,jsonb),public.fail_prova_generation_v2(uuid,uuid,text,boolean),public.complete_prova_generation_v2(uuid,uuid,jsonb,text,text,int,int) to service_role;
revoke all on function public.admin_retry_prova_generation(uuid,text) from public,anon;
grant execute on function public.admin_retry_prova_generation(uuid,text) to authenticated;

create or replace function public.admin_ai_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.action,p.plan_code),'[]') from public.ai_operation_policies p),
 'health',(select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('paused',coalesce(h.open_until>now(),false))),'[]') from public.ai_provider_health h),
 'jobs',(select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]') from (
 select * from (
 select id,family_id,action,status,error_code,created_at,updated_at,(status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) retryable from public.ai_operation_jobs
 union all
 select id,family_id,'generate',status,error_code,created_at,updated_at,(provider_result is null and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'))) from public.prova_generation_jobs
 ) recent order by created_at desc limit 100) j));
end; $$;

create function public.admin_save_contribution_reward(p_id uuid,p_title text,p_threshold int,p_kind text,p_amount int,p_plan public.plan_code,p_days int,p_enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.contribution_rewards; v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_title,''))) not between 3 and 160 then raise exception 'invalid_title'; end if;
 -- Serialize review and policy changes; granted policies are immutable except title/enablement.
 perform pg_advisory_xact_lock(73491821);
 select * into existing from public.contribution_rewards where id=v_id for update;
 if found and exists(select 1 from public.learning_credit_grants where policy_id=v_id)
 and (existing.threshold<>p_threshold or existing.kind<>p_kind or existing.amount<>p_amount or existing.plan is distinct from p_plan or existing.valid_days<>p_days) then raise exception 'reward_policy_locked'; end if;
 insert into public.contribution_rewards(id,title,threshold,kind,amount,plan,valid_days,enabled)
 values(v_id,trim(p_title),p_threshold,p_kind,p_amount,p_plan,p_days,p_enabled)
 on conflict(id) do update set title=excluded.title,threshold=excluded.threshold,kind=excluded.kind,amount=excluded.amount,plan=excluded.plan,valid_days=excluded.valid_days,enabled=excluded.enabled;
 return v_id;
end; $$;
create function public.admin_set_library_quota(p_plan public.plan_code,p_monthly int) returns void language plpgsql security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 update public.plans set library_monthly=p_monthly where code=p_plan;
 if not found then raise exception 'plan_not_found'; end if;
end; $$;
revoke all on function public.admin_save_contribution_reward(uuid,text,int,text,int,public.plan_code,int,boolean),public.admin_set_library_quota(public.plan_code,int) from public,anon;
grant execute on function public.admin_save_contribution_reward(uuid,text,int,text,int,public.plan_code,int,boolean),public.admin_set_library_quota(public.plan_code,int) to authenticated;
