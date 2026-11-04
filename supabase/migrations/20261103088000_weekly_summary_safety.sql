-- Weekly summaries: strict family boundary, minimal input, immutable paid context.
create or replace function public.get_weekly_summary_data(p_family_id uuid,p_week_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.families; monday date;begin
 if auth.role() is distinct from 'service_role' and
  (auth.uid() is not null and gina.is_parent() and gina.family_id()=p_family_id) is not true
 then raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 if p_week_start is null or not isfinite(p_week_start) or extract(isodow from p_week_start)<>1 or p_week_start<monday-56 or p_week_start>monday-7 then raise exception 'weekly_date';end if;
 return jsonb_build_object('week_start',p_week_start,'locale',f.locale,'timezone',f.timezone,'data_version','v2',
 'children',(select coalesce(jsonb_agg(jsonb_build_object('alias',k.alias,'grade',k.grade,
 'stars_earned',(select coalesce(sum(delta),0) from public.star_events where family_id=f.id and child_id=k.id and reason='task_approved' and delta>0 and created_at>=p_week_start::timestamp at time zone f.timezone and created_at<(p_week_start+7)::timestamp at time zone f.timezone),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_object('status',c.status,'count',c.n) order by c.status),'[]') from (select status,count(*) n from public.task_completions where family_id=f.id and child_id=k.id and due_date>=p_week_start and due_date<p_week_start+7 group by status)c)
 ) order by k.position),'[]') from (select id,grade,row_number() over(order by sort_order,created_at,id) position,'Çocuk '||chr(64+row_number() over(order by sort_order,created_at,id)::int) alias from public.children where family_id=f.id)k));
end;$$;
revoke all on function public.get_weekly_summary_data(uuid,date) from public,anon;
grant execute on function public.get_weekly_summary_data(uuid,date) to authenticated,service_role;

alter table public.ai_operation_policies drop constraint ai_operation_policies_action_check;
alter table public.ai_operation_policies add constraint ai_operation_policies_action_check check(action in('grade','plan','generate','import','weekly'));
alter table public.ai_operation_jobs drop constraint ai_operation_jobs_action_check;
alter table public.ai_operation_jobs add constraint ai_operation_jobs_action_check check(action in('grade','plan','import','weekly'));
insert into public.ai_operation_policies(action,plan_code,enabled,monthly_limit,per_minute,max_concurrent)
 select 'weekly',code,ai_weekly,case when ai_weekly then 5 else 0 end,3,1 from public.plans;
create or replace function public.reserve_ai_operation(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_operation_jobs; pol public.ai_operation_policies; plan public.plans; used int;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action not in('grade','plan','import','weekly') or p_hash is null or length(p_hash)<>64 or p_lease is null then raise exception 'invalid_input'; end if;
 if not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 plan:=gina.family_plan_of(p_family_id);
 if p_action='weekly' and (not plan.ai_weekly or exists(select 1 from public.app_settings where key='ai.enabled' and value='false'::jsonb) or exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled)) then return jsonb_build_object('error','ai_disabled'); end if;
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

create table gina.weekly_summary_contexts(
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 week_start date not null,
 context jsonb not null,
 created_at timestamptz not null default now(),
 unique(family_id,week_start)
);
alter table gina.weekly_summary_contexts enable row level security;
revoke all on gina.weekly_summary_contexts from public,anon,authenticated,service_role;
create function public.prepare_weekly_summary(p_family uuid,p_user uuid,p_week date,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.weekly_summary_contexts;data jsonb;plan public.plans;begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.family_members where family_id=p_family and user_id=p_user) then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,28));
 -- Always recheck family/week, even for an existing snapshot.
 data:=public.get_weekly_summary_data(p_family,p_week);
 plan:=gina.family_plan_of(p_family);
 if not plan.ai_weekly then raise exception 'plan_has_no_ai';end if;
 if jsonb_array_length(data->'children')=0 then raise exception 'weekly_no_children';end if;
 select * into c from gina.weekly_summary_contexts where family_id=p_family and week_start=p_week;
 if c.id is not null then return jsonb_build_object('id',c.id,'context',c.context);end if;
 if p_context is null or jsonb_typeof(p_context)<>'object' or not(p_context ?& array['config','system','schema']) or p_context-array['config','system','schema']<>'{}'::jsonb or octet_length(p_context::text)>16000 or jsonb_typeof(p_context->'config')<>'object' or jsonb_typeof(p_context->'system')<>'string' or jsonb_typeof(p_context->'schema')<>'object' then raise exception 'weekly_context_invalid';end if;
 insert into gina.weekly_summary_contexts(family_id,week_start,context) values(p_family,p_week,p_context||jsonb_build_object('input',data)) returning * into c;
 return jsonb_build_object('id',c.id,'context',c.context);
end;$$;
create function public.reserve_weekly_summary(p_family uuid,p_user uuid,p_context uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.weekly_summary_contexts;begin
 if auth.role() is distinct from 'service_role' then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,28));
 select * into c from gina.weekly_summary_contexts where id=p_context and family_id=p_family;
 if c.id is null then raise exception 'weekly_context_unavailable';end if;
 if not exists(select 1 from public.ai_models where id=c.context#>>'{config,model}' and active and provider='anthropic') then return jsonb_build_object('error','ai_model_unavailable');end if;
 return public.reserve_ai_operation(p_family,p_user,'weekly',encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex'),p_lease);
end;$$;
revoke all on function public.reserve_weekly_summary(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_weekly_summary(uuid,uuid,uuid,uuid) to service_role;
create function public.store_weekly_summary(p_family uuid,p_user uuid,p_context uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.weekly_summary_contexts;j public.ai_operation_jobs;r public.ai_summaries;begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.family_members where family_id=p_family and user_id=p_user) then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,28));
 select * into c from gina.weekly_summary_contexts where id=p_context and family_id=p_family;
 select * into j from public.ai_operation_jobs where id=p_job and family_id=p_family and action='weekly' and status='done';
 if c.id is null or j.id is null or j.result->'output' is null or j.input_hash<>encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex') then raise exception 'weekly_result_unavailable';end if;
 insert into public.ai_summaries(family_id,week_start,model,prompt_version,input_hash,output_json,status,input_tokens,output_tokens,requested_by)
 values(p_family,c.week_start,c.context#>>'{config,model}','v2',j.input_hash,j.result->'output','done',(j.result->>'inputTokens')::int,(j.result->>'outputTokens')::int,p_user)
 on conflict(family_id,week_start,prompt_version) do nothing;
 select * into r from public.ai_summaries where family_id=p_family and week_start=c.week_start and prompt_version='v2';
 if r.input_hash<>j.input_hash then raise exception 'weekly_result_conflict';end if;
 return r.output_json;
end;$$;
revoke all on function public.prepare_weekly_summary(uuid,uuid,date,jsonb),public.store_weekly_summary(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_weekly_summary(uuid,uuid,date,jsonb),public.store_weekly_summary(uuid,uuid,uuid,uuid) to service_role;
-- Deleting a child also removes derived weekly summaries; late provider completions cannot restore them.
create function gina.clear_child_weekly_summaries() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(old.family_id::text,28));
 delete from gina.weekly_summary_contexts where family_id=old.family_id;
 delete from public.ai_summaries where family_id=old.family_id;
 update public.ai_operation_jobs set result=null,status='uncertain',lease=gen_random_uuid(),error_code='weekly_context_removed',updated_at=now() where family_id=old.family_id and action='weekly';
 return old;
end;$$;
revoke all on function gina.clear_child_weekly_summaries() from public,anon,authenticated,service_role;
create trigger clear_child_weekly_summaries after delete on public.children for each row execute function gina.clear_child_weekly_summaries();
-- Match the existing 12-month summary retention without logging input or provider credentials.
do $$begin
 perform cron.schedule('purge-weekly-summary-contexts','20 3 * * *',$job$delete from gina.weekly_summary_contexts where created_at<now()-interval '12 months';delete from public.ai_operation_jobs where action='weekly' and created_at<now()-interval '12 months';$job$);
exception when invalid_schema_name or undefined_function then raise notice 'Weekly context retention requires pg_cron at deployment';end$$;

-- A deleted source is not eligible for operator paid retry.
create or replace function public.admin_retry_ai_operation(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'reason_required'; end if;
 update public.ai_operation_jobs set status='failed',lease=gen_random_uuid(),updated_at=now(),error_code='operator_retry_authorized'
 where id=p_id and error_code is distinct from 'weekly_context_removed' and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) returning family_id into f;
 if f is null then raise exception 'job_not_retryable'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason)
 values(auth.uid(),'ai_operation_retry_authorized','ai_operation_jobs',p_id::text,f,trim(p_reason));
end; $$;
create or replace function public.admin_ai_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.action,p.plan_code),'[]') from public.ai_operation_policies p),
 'health',(select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('paused',coalesce(h.open_until>now(),false))),'[]') from public.ai_provider_health h),
 'jobs',(select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]') from (
 select * from (
 select id,family_id,action,status,error_code,created_at,updated_at,(error_code is distinct from 'weekly_context_removed' and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'))) retryable from public.ai_operation_jobs
 union all
 select id,family_id,'generate',status,error_code,created_at,updated_at,(provider_result is null and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'))) from public.prova_generation_jobs
 ) recent order by created_at desc limit 100) j));
end; $$;


-- A still-draining old Edge worker must not bypass the new result binding.
revoke insert,update,delete on public.ai_summaries from service_role;
