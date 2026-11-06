-- Explicit per-operation ordered fallback. Default off until Edge/UI rollout is verified.
insert into public.app_settings(key,value) values('ai.chains.enabled','false') on conflict do nothing;
create table public.ai_usage_kinds (
 key text primary key, label text not null
);
insert into public.ai_usage_kinds values
 ('question_generation','Soru üretimi'),('open_ended_grading','Açık uçlu değerlendirme'),
 ('notebook_review','Defter / görsel değerlendirme'),('study_plan','Çalışma planı'),
 ('timetable_import','Ders programı aktarımı'),('learning_plan_import','Öğrenme planı aktarımı'),
 ('weekly_summary','Haftalık özet'),('setup_suggestions','Kurulum önerileri'),('content_prereview','İçerik ön inceleme');
create table public.ai_chains (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 100),
 enabled boolean not null default true,
 on_rate_limit boolean not null default true,on_server_error boolean not null default true,on_timeout boolean not null default false,
 attempt_seconds int not null default 45 check(attempt_seconds between 10 and 90),
 total_seconds int not null default 120 check(total_seconds between 30 and 130),
 updated_at timestamptz not null default now(),check(attempt_seconds<=total_seconds)
);
create trigger ai_chains_updated before update on public.ai_chains for each row execute function gina.set_updated_at();
create table public.ai_chain_steps (
 chain_id uuid not null references public.ai_chains(id) on delete cascade,
 position int not null check(position between 1 and 5),model_id text not null references public.ai_models(id),
 primary key(chain_id,position),unique(chain_id,model_id)
);
create table public.ai_chain_assignments (
 usage_key text primary key references public.ai_usage_kinds(key),chain_id uuid not null references public.ai_chains(id),
 updated_at timestamptz not null default now()
);
create trigger ai_chain_assignments_updated before update on public.ai_chain_assignments for each row execute function gina.set_updated_at();
create table public.ai_chain_attempts (
 id uuid primary key default gen_random_uuid(),run_id uuid not null,chain_id uuid not null references public.ai_chains(id),
 usage_key text not null references public.ai_usage_kinds(key),lease uuid,model_id text not null references public.ai_models(id),
 provider text not null references public.ai_providers(id),position int not null check(position between 1 and 5),
 status text not null check(status in('running','succeeded','failed','skipped')),
 error_code text check(error_code ~ '^[a-z0-9_]{1,80}$'),uncertain boolean not null default false,
 input_tokens int check(input_tokens>=0),output_tokens int check(output_tokens>=0),
 created_at timestamptz not null default now(),finished_at timestamptz,
 unique(run_id,position)
);
create unique index ai_chain_attempts_lease on public.ai_chain_attempts(lease,position) where lease is not null;
create index ai_chain_attempts_recent on public.ai_chain_attempts(created_at desc);
-- No prompts, answers, credentials or personal data in the attempt journal.
DO $$ declare n text; begin
 foreach n in array array['ai_usage_kinds','ai_chains','ai_chain_steps','ai_chain_assignments','ai_chain_attempts'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);
  execute format('grant select on public.%I to authenticated,service_role',n);
  execute format('create policy admin_read on public.%I for select to authenticated using ((select gina.is_admin_strict()))',n);
 end loop;
end $$;
create trigger audit_ai_chains after insert or update or delete on public.ai_chains for each row execute function gina.audit_row('id');
create trigger audit_ai_chain_assignments after insert or update or delete on public.ai_chain_assignments for each row execute function gina.audit_row('usage_key');

create function public.admin_ai_chains() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
 'enabled',exists(select 1 from public.app_settings where key='ai.chains.enabled' and value='true'),
 'chains',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('steps',(
  select coalesce(jsonb_agg(jsonb_build_object('position',s.position,'model_id',s.model_id,'display_name',m.display_name,'active',m.active,'provider',m.provider) order by s.position),'[]')
  from public.ai_chain_steps s join public.ai_models m on m.id=s.model_id where s.chain_id=c.id)) order by c.name),'[]') from public.ai_chains c),
 'assignments',(select coalesce(jsonb_agg(jsonb_build_object('usage_key',u.key,'label',u.label,'chain_id',a.chain_id,'updated_at',a.updated_at) order by u.label),'[]')
  from public.ai_usage_kinds u left join public.ai_chain_assignments a on a.usage_key=u.key),
 'attempts',(select coalesce(jsonb_agg(to_jsonb(r)-'lease' order by r.created_at desc),'[]') from (select * from public.ai_chain_attempts order by created_at desc limit 50) r));
end $$;

create function public.admin_save_ai_chain(p_id uuid,p_name text,p_models text[],p_enabled boolean,p_on_rate_limit boolean,p_on_server_error boolean,p_on_timeout boolean,p_attempt_seconds int,p_total_seconds int,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ai_chains;v_id uuid:=coalesce(p_id,gen_random_uuid());begin
 perform gina.assert_admin();
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_models is null or cardinality(p_models) not between 1 and 5
  or (select count(distinct x) from unnest(p_models) x)<>cardinality(p_models) then raise exception 'invalid_chain';end if;
 if p_id is not null then
  select * into c from public.ai_chains where id=p_id for update;
  if not found or c.updated_at is distinct from p_expected_updated_at then raise exception 'stale_chain' using errcode='40001';end if;
 end if;
 if exists(select 1 from unnest(p_models) x left join public.ai_models m on m.id=x where m.id is null or
  (not m.active and not exists(select 1 from public.ai_chain_steps s where s.chain_id=p_id and s.model_id=x))) then raise exception 'inactive_chain_model';end if;
 if p_enabled and not exists(select 1 from public.ai_models m where m.id=any(p_models) and m.active and (gina.ai_model_support(m)->>'supported')::boolean) then raise exception 'chain_has_no_active_model';end if;
 insert into public.ai_chains(id,name,enabled,on_rate_limit,on_server_error,on_timeout,attempt_seconds,total_seconds)
 values(v_id,trim(p_name),p_enabled,p_on_rate_limit,p_on_server_error,p_on_timeout,p_attempt_seconds,p_total_seconds)
 on conflict(id) do update set name=excluded.name,enabled=excluded.enabled,on_rate_limit=excluded.on_rate_limit,on_server_error=excluded.on_server_error,on_timeout=excluded.on_timeout,attempt_seconds=excluded.attempt_seconds,total_seconds=excluded.total_seconds returning * into c;
 delete from public.ai_chain_steps where chain_id=v_id;
 insert into public.ai_chain_steps(chain_id,position,model_id) select v_id,ord::int,x from unnest(p_models) with ordinality t(x,ord);
 return to_jsonb(c);
end $$;

create function public.admin_assign_ai_chain(p_usage_key text,p_chain_id uuid,p_expected_updated_at timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare a public.ai_chain_assignments;begin
 perform gina.assert_admin();
 perform pg_advisory_xact_lock(hashtextextended('ai-chain-assignment:'||p_usage_key,91));
 select * into a from public.ai_chain_assignments where usage_key=p_usage_key for update;
 if a.updated_at is distinct from p_expected_updated_at then raise exception 'stale_chain' using errcode='40001';end if;
 if not exists(select 1 from public.ai_chains c where c.id=p_chain_id and c.enabled and exists(select 1 from public.ai_chain_steps s join public.ai_models m on m.id=s.model_id where s.chain_id=c.id and m.active)) then raise exception 'chain_has_no_active_model';end if;
 insert into public.ai_chain_assignments(usage_key,chain_id) values(p_usage_key,p_chain_id) on conflict(usage_key) do update set chain_id=excluded.chain_id;
end $$;

create function public.resolve_ai_chain(p_usage_key text,p_plan text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.ai_chains;begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='ai.chains.enabled' and value='true') then return null;end if;
 if exists(select 1 from public.app_settings where key='ai.enabled' and value='false') or exists(select 1 from public.ai_settings where plan_code::text=p_plan and not enabled) then return jsonb_build_object('error','ai_disabled');end if;
 select ch.* into c from public.ai_chain_assignments a join public.ai_chains ch on ch.id=a.chain_id where a.usage_key=p_usage_key;
 if not found then return jsonb_build_object('error','ai_chain_unassigned');end if;
 if not c.enabled then return jsonb_build_object('error','ai_chain_disabled');end if;
 return to_jsonb(c)||jsonb_build_object('usage_key',p_usage_key,'steps',(
  select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('position',s.position,'provider_record',to_jsonb(p),'paused',gina.ai_provider_paused(p.id)) order by s.position),'[]')
  from public.ai_chain_steps s join public.ai_models m on m.id=s.model_id join public.ai_providers p on p.id=m.provider where s.chain_id=c.id));
end $$;
revoke all on function public.admin_ai_chains(),public.admin_save_ai_chain(uuid,text,text[],boolean,boolean,boolean,boolean,int,int,timestamptz),public.admin_assign_ai_chain(text,uuid,timestamptz),public.resolve_ai_chain(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_ai_chains(),public.admin_save_ai_chain(uuid,text,text[],boolean,boolean,boolean,boolean,int,int,timestamptz),public.admin_assign_ai_chain(text,uuid,timestamptz) to authenticated;
grant execute on function public.resolve_ai_chain(text,text) to service_role;

alter table public.ai_operation_jobs add column chain_run_id uuid;
alter table public.prova_generation_jobs add column chain_run_id uuid;
alter table gina.content_prereview_calls add column chain_call_count int not null default 1 check(chain_call_count between 1 and 5);
create or replace function gina.content_prereview_calls_24h() returns int language sql stable security definer set search_path='' as $$
 select coalesce(sum(chain_call_count),0)::int from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' and outcome<>'not_called';
$$;
create or replace function gina.content_prereview_budget_calls_24h() returns int language sql stable security definer set search_path='' as $$
 select coalesce(sum(chain_call_count),0)::int from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' and outcome<>'not_called' and not gina.content_prereview_admin_exempt(requested_by);
$$;

create function public.ai_chain_start_attempt(p_run uuid,p_chain uuid,p_usage text,p_plan text,p_position int,p_model text,p_input_kind text,p_skip text default null,p_job_kind text default null,p_job_id uuid default null,p_lease uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.ai_models;c public.ai_chains;v_reason text:=p_skip;v_id uuid;paid int;owner_id uuid;begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_run is null or p_input_kind is null or p_input_kind not in('text','image','pdf') or p_skip is not null and p_skip not in('capability_missing','key_missing','input_too_large','time_budget_exhausted') then raise exception 'invalid_chain_attempt';end if;
 if not exists(select 1 from public.app_settings where key='ai.chains.enabled' and value='true') or exists(select 1 from public.app_settings where key='ai.enabled' and value='false') or exists(select 1 from public.ai_settings where plan_code::text=p_plan and not enabled) then return jsonb_build_object('stop','ai_disabled');end if;
 select * into c from public.ai_chains where id=p_chain;
 if c.id is null or not c.enabled or not exists(select 1 from public.ai_chain_assignments where usage_key=p_usage and chain_id=p_chain) then return jsonb_build_object('stop','ai_chain_disabled');end if;
 if not exists(select 1 from public.ai_chain_steps where chain_id=p_chain and position=p_position and model_id=p_model) then return jsonb_build_object('stop','ai_chain_changed');end if;
 select * into m from public.ai_models where id=p_model;
 if not m.active then v_reason:='model_inactive';
 elsif (gina.ai_model_support(m)->>'supported')::boolean is not true then v_reason:='model_unsupported';
 elsif gina.ai_provider_paused(m.provider) then v_reason:='provider_paused';
 elsif p_input_kind='image' and not m.supports_vision or p_input_kind='pdf' and not m.supports_pdf then v_reason:='capability_missing';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai-chain-run:'||p_run::text,91));
 if exists(select 1 from public.ai_chain_attempts where run_id=p_run and position=p_position) then raise exception 'chain_attempt_exists';end if;
 if v_reason is null and p_usage='content_prereview' then
  if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return jsonb_build_object('stop','prereview_disabled');end if;
  if p_lease is null then return jsonb_build_object('stop','prereview_lease_required');end if;
  perform pg_advisory_xact_lock(hashtextextended('content_prereview:budget',91));
  select requested_by into owner_id from gina.content_prereview_calls where lease=p_lease and outcome='claimed' for update;
  if not found or not exists(select 1 from gina.content_prereviews where lease=p_lease and prereview_status='pending' and claimed_at>now()-interval '3 minutes') then return jsonb_build_object('stop','lease_lost');end if;
  select count(*) into paid from public.ai_chain_attempts where run_id=p_run and status<>'skipped';
  if paid>0 then
   if not gina.content_prereview_admin_exempt(owner_id) and gina.content_prereview_budget_calls_24h()>=gina.content_prereview_daily_limit() then return jsonb_build_object('stop','daily_limit');end if;
   update gina.content_prereview_calls set chain_call_count=chain_call_count+1 where lease=p_lease and outcome='claimed';
  end if;
 end if;
 if v_reason is null and p_job_kind='operation' then
  update public.ai_operation_jobs set provider=m.provider,chain_run_id=p_run where id=p_job_id and lease=p_lease and status='working';
  if not found then return jsonb_build_object('stop','lease_lost');end if;
 elsif v_reason is null and p_job_kind='generation' then
  update public.prova_generation_jobs set provider=m.provider,chain_run_id=p_run where id=p_job_id and lease=p_lease and status='working' and provider_result is null;
  if not found then return jsonb_build_object('stop','lease_lost');end if;
 end if;
 insert into public.ai_chain_attempts(run_id,chain_id,usage_key,lease,model_id,provider,position,status,error_code,finished_at)
 values(p_run,p_chain,p_usage,p_lease,p_model,m.provider,p_position,case when v_reason is null then 'running' else 'skipped' end,v_reason,case when v_reason is null then null else now() end) returning id into v_id;
 return jsonb_build_object('id',v_id,'allowed',v_reason is null,'reason',v_reason);
end $$;

create function public.ai_chain_finish_attempt(p_id uuid,p_ok boolean,p_error text default null,p_uncertain boolean default false,p_input int default null,p_output int default null) returns void
language plpgsql security definer set search_path='' as $$
declare prov text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 update public.ai_chain_attempts set status=case when p_ok then 'succeeded' else 'failed' end,error_code=p_error,uncertain=p_uncertain,input_tokens=p_input,output_tokens=p_output,finished_at=now()
 where id=p_id and status='running' returning provider into prov;
 if not found then raise exception 'chain_attempt_finished';end if;
 perform gina.ai_provider_outcome(prov,p_ok,p_error,p_uncertain);
end $$;
revoke all on function public.ai_chain_start_attempt(uuid,uuid,text,text,int,text,text,text,text,uuid,uuid),public.ai_chain_finish_attempt(uuid,boolean,text,boolean,int,int) from public,anon,authenticated;
grant execute on function public.ai_chain_start_attempt(uuid,uuid,text,text,int,text,text,text,text,uuid,uuid),public.ai_chain_finish_attempt(uuid,boolean,text,boolean,int,int) to service_role;

create function public.reserve_child_ai_operation_routed(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid,p_child_id uuid,p_provider text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.children where id=p_child_id and family_id=p_family_id) then raise exception 'archive_forbidden' using errcode='42501';end if;
 perform gina.require_active_child(p_child_id);
 return public.reserve_ai_operation(p_family_id,p_user_id,p_action,p_hash,p_lease,p_provider);
end $$;
revoke all on function public.reserve_child_ai_operation_routed(uuid,uuid,text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_child_ai_operation_routed(uuid,uuid,text,text,uuid,uuid,text) to service_role;

create function gina.ai_usage_provider(p_usage text,p_fallback text) returns text language sql stable security definer set search_path='' as $$
 select case when not exists(select 1 from public.app_settings where key='ai.chains.enabled' and value='true') then p_fallback else (
  select m.provider from public.ai_chain_assignments a join public.ai_chains c on c.id=a.chain_id
  join public.ai_chain_steps s on s.chain_id=c.id join public.ai_models m on m.id=s.model_id
  where a.usage_key=p_usage and c.enabled and m.active and (gina.ai_model_support(m)->>'supported')::boolean and not gina.ai_provider_paused(m.provider)
  order by s.position limit 1) end;
$$;
revoke all on function gina.ai_usage_provider(text,text) from public,anon,authenticated,service_role;

create or replace function public.finish_ai_operation(p_id uuid,p_lease uuid,p_result jsonb,p_error text default null,p_uncertain boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare prov text;chain_run uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.ai_operation_jobs set status=case when p_uncertain then 'uncertain' when p_error is not null then 'failed' else 'done' end,
 result=p_result,error_code=left(p_error,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working' returning provider,chain_run_id into prov,chain_run;
 if not found then raise exception 'lease_lost'; end if;
 if chain_run is null then perform gina.ai_provider_outcome(prov, p_error is null, p_error, p_uncertain);end if;
end; $$;

create or replace function public.fail_prova_generation_v2(p_id uuid,p_lease uuid,p_code text,p_uncertain boolean) returns void language plpgsql security definer set search_path='' as $$
declare prov text;chain_run uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.prova_generation_jobs set status=case when p_uncertain then 'uncertain' else 'failed' end,error_code=left(p_code,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working' and provider_result is null returning provider,chain_run_id into prov,chain_run;
 if not found then raise exception 'lease_lost'; end if;
 -- Yalnız başarısızlık yönü: başarısız kod bu fonksiyonda sayacı sıfırlamaz.
 if chain_run is null and (p_uncertain or gina.ai_breaker_code(p_code)) then perform gina.ai_provider_outcome(prov, false, p_code, p_uncertain); end if;
end; $$;

create or replace function public.complete_prova_generation_v2(p_id uuid,p_lease uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input int,p_output int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; a record; remaining int; take int; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
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
 -- D1: bağlı sorular tek ortak kaynak grubu olur (aynı işlem; yarım grup kalmaz).
 v_result:=gina.link_ai_shared_sources(j.family_id,v_result);
 perform gina.tag_ai_generation_periods(j.family_id,v_result);
 -- D10: kişi adı uyarısı özeti (yalnız status + flags) veli yanıtına.
 v_result:=gina.attach_question_content_review(j.family_id,v_result);
 v_result:=jsonb_set(v_result,'{remaining}',to_jsonb((public.get_prova_entitlement(j.family_id)->>'ai_generate_remaining')::int));
 update public.prova_generation_jobs set result=v_result where id=p_id;
 if j.chain_run_id is null then perform gina.ai_provider_outcome(j.provider, true, null, false);end if;
 return v_result;
end; $$;

create or replace function public.reserve_prova_generation_v2(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; b jsonb; p public.plans; pol public.ai_operation_policies; take int; remaining int; g record; lease_id uuid:=gen_random_uuid(); prov text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
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
 prov:=gina.ai_usage_provider('question_generation',gina.ai_family_provider(p_family_id));
 select * into pol from public.ai_operation_policies where action='generate' and plan_code=p.code;
 if pol.action is null or not pol.enabled then return jsonb_build_object('error','ai_disabled'); end if;
 b:=gina.generation_balance(p_family_id);
 if p_items>(b->>'base_remaining')::int+(b->>'bonus_remaining')::int then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if not exists(select 1 from public.ai_providers where id=prov and status='active') then return jsonb_build_object('error','provider_unconfigured'); end if;
 if gina.ai_provider_paused(prov) then return jsonb_build_object('error','ai_temporarily_unavailable'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status<>'failed' and created_at>=gina.family_month_start(p_family_id))>=pol.monthly_limit then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if (select count(*) from public.ai_request_attempts where family_id=p_family_id and created_at>now()-interval '1 minute')>=pol.per_minute then return jsonb_build_object('error','ai_rate_limited'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '3 minutes')>=pol.max_concurrent then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.ai_request_attempts(family_id,action) values(p_family_id,'generate');
 insert into public.prova_generation_jobs(id,family_id,requested_by,prompt_hash,items,status,lease,provider)
 values(p_id,p_family_id,p_user_id,p_hash,p_items,'working',lease_id,prov)
 on conflict(id) do update set status='working',lease=lease_id,provider=prov,chain_run_id=null,provider_result=null,error_code=null,created_at=now(),updated_at=now();
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

create or replace function public.reserve_weekly_summary(p_family uuid,p_user uuid,p_context uuid,p_lease uuid,p_provider text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.weekly_summary_contexts; prov text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,28));
 select * into c from gina.weekly_summary_contexts where id=p_context and family_id=p_family;
 if c.id is null then raise exception 'weekly_context_unavailable';end if;
 prov:=case when c.context#>'{config,chain}' is not null then gina.ai_usage_provider('weekly_summary',null) else gina.ai_context_provider(c.context#>>'{config,model}',p_provider) end;
 if prov is null then return jsonb_build_object('error','ai_model_unavailable');end if;
 return public.reserve_ai_operation(p_family,p_user,'weekly',encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex'),p_lease,prov);
end;$$;

create or replace function public.reserve_learning_plan_import(p_family uuid,p_user uuid,p_context uuid,p_lease uuid,p_provider text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;r jsonb;plan public.plans;prov text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 select * into i from gina.learning_plan_imports where id=p_context and family_id=p_family;
 if i.id is null then raise exception 'plan_import_unavailable';end if;
 perform gina.learning_import_parent(p_family,p_user,i.child_id,i.source_id);
 if not exists(select 1 from public.learning_sources where id=i.source_id and sha256=i.context->>'sha256') then raise exception 'source_not_ready';end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then return jsonb_build_object('error','source_unavailable');end if;
 plan:=gina.family_plan_of(p_family);
 if exists(select 1 from public.app_settings where key='ai.enabled' and value='false') or exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled) then return jsonb_build_object('error','ai_disabled');end if;
 prov:=case when i.context#>'{config,chain}' is not null then gina.ai_usage_provider('learning_plan_import',null) else gina.ai_context_provider(i.context#>>'{config,model}',p_provider) end;
 if prov is null then return jsonb_build_object('error','ai_model_unavailable');end if;
 r:=public.reserve_ai_operation(p_family,p_user,'import',encode(extensions.digest('learning-plan/v1/'||i.id::text||i.context::text,'sha256'),'hex'),p_lease,prov);
 if r ? 'id' then update gina.learning_plan_imports set job_id=(r->>'id')::uuid where id=i.id;end if;
 return r;
end;$$;

create or replace function public.admin_model_disable_preview(p_model_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.ai_models; affected public.plan_code[];
begin
 perform gina.assert_admin();
 select * into m from public.ai_models where id=p_model_id;
 if m.id is null then raise exception 'model_not_found'; end if;
 select coalesce(array_agg(distinct b.plan_code::public.plan_code order by b.plan_code::public.plan_code),'{}') into affected from gina.ai_model_bindings() b where b.enabled and b.model_id=p_model_id;
 return jsonb_build_object(
  'model_id',p_model_id,'provider',m.provider,'active',m.active,
  'affected_chains',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'enabled',c.enabled,'position',s.position,
   'remaining_active',(select count(*) from public.ai_chain_steps x join public.ai_models mm on mm.id=x.model_id where x.chain_id=c.id and mm.id<>p_model_id and mm.active and (gina.ai_model_support(mm)->>'supported')::boolean),
   'usages',(select coalesce(jsonb_agg(u.label order by u.label),'[]') from public.ai_chain_assignments a join public.ai_usage_kinds u on u.key=a.usage_key where a.chain_id=c.id)) order by c.name),'[]') from public.ai_chain_steps s join public.ai_chains c on c.id=s.chain_id where s.model_id=p_model_id),
  'affected_plans',to_jsonb(affected),
  'affected_flows',(select coalesce(jsonb_agg(to_jsonb(b) order by b.flow_id),'[]') from gina.ai_model_bindings() b where b.model_id=p_model_id),
  'affected_features',(select coalesce(jsonb_agg(jsonb_build_object('feature',f,'inputs',inputs,'plans',ps) order by f),'[]') from (
    select e.feature f, jsonb_agg(distinct e.input_kind) inputs, to_jsonb(array_agg(distinct e.plan order by e.plan)) ps
    from (select r.feature, r.input_kind, p.plan from public.ai_feature_requirements r, unnest(r.plans) p(plan) where p.plan = any(affected)) e group by e.feature) q),
  'alternatives',(select coalesce(jsonb_agg(a.id order by a.id),'[]') from public.ai_models a
    where a.id<>p_model_id and a.active and a.provider=m.provider and (gina.ai_model_support(a)->>'supported')::boolean),
  'jobs_last_30d',(select coalesce(jsonb_object_agg(action,n),'{}') from (
    select action,count(*) n from public.ai_operation_jobs where created_at>now()-interval '30 days' group by action) j));
end; $$;
revoke all on function public.admin_model_disable_preview(text) from public, anon;
grant execute on function public.admin_model_disable_preview(text) to authenticated;


create function gina.clear_ai_chain_run() returns trigger language plpgsql set search_path='' as $$ begin
 if new.lease is distinct from old.lease then new.chain_run_id:=null;end if;return new;
end $$;
revoke all on function gina.clear_ai_chain_run() from public,anon,authenticated,service_role;
create trigger ai_operation_chain_lease before update on public.ai_operation_jobs for each row execute function gina.clear_ai_chain_run();
