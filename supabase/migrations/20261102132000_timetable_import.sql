-- Paid extraction produces a reviewable draft. It never writes a child's schedule.
alter table public.ai_operation_policies drop constraint ai_operation_policies_action_check;
alter table public.ai_operation_policies add constraint ai_operation_policies_action_check check(action in('grade','plan','generate','import'));
alter table public.ai_operation_jobs drop constraint ai_operation_jobs_action_check;
alter table public.ai_operation_jobs add constraint ai_operation_jobs_action_check check(action in('grade','plan','import'));
alter table public.prova_ai_usage drop constraint prova_ai_usage_action_check;
alter table public.prova_ai_usage add constraint prova_ai_usage_action_check check(action in('generate','grade','plan','import'));
insert into public.ai_operation_policies(action,plan_code,enabled,monthly_limit)
 select 'import',code,code<>'free',case code when 'pro' then 20 when 'plus' then 5 else 0 end from public.plans;
create or replace function public.reserve_ai_operation(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_operation_jobs; pol public.ai_operation_policies; plan public.plans; used int;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action not in('grade','plan','import') or p_hash is null or length(p_hash)<>64 or p_lease is null then raise exception 'invalid_input'; end if;
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
create table public.timetable_imports (
 id uuid primary key references public.ai_operation_jobs(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 source_id uuid not null references public.learning_sources(id) on delete cascade,
 draft jsonb not null, applied_revision int, created_at timestamptz not null default now()
);
create index on public.timetable_imports(source_id,created_at);
alter table public.timetable_imports enable row level security;
revoke all on public.timetable_imports from anon,authenticated;
grant select on public.timetable_imports to authenticated;
grant all on public.timetable_imports to service_role;
create policy timetable_import_parent on public.timetable_imports for select to authenticated
 using(gina.is_parent() and family_id=gina.family_id());
create function public.register_timetable_import(p_job uuid,p_source uuid,p_child uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.ai_operation_jobs;s public.learning_sources;i public.timetable_imports;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 select * into s from public.learning_sources where id=p_source and status='ready' and kind='document' for update;
 select * into j from public.ai_operation_jobs where id=p_job and action='import' and status='done' and family_id=s.family_id;
 if j.id is null or not exists(select 1 from public.children where id=p_child and family_id=s.family_id) then raise exception 'source_not_ready';end if;
 insert into public.timetable_imports(id,family_id,child_id,source_id,draft) values(j.id,s.family_id,p_child,s.id,j.result->'output') on conflict(id) do nothing;
 select * into i from public.timetable_imports where id=p_job;
 if i.source_id<>p_source or i.child_id<>p_child then raise exception 'request_conflict';end if;
 return to_jsonb(i);
end;$$;
revoke all on function public.register_timetable_import(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_timetable_import(uuid,uuid,uuid) to service_role;

-- The request receipt, program revision, imported source and calendar rows commit together.
create function public.apply_timetable_import(p_request_id uuid,p_import_id uuid,p_revision int,p_lessons jsonb,p_settings jsonb)
returns int language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;i public.timetable_imports;payload jsonb;rev int;sid uuid;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('import',p_import_id,'revision',p_revision,'lessons',p_lessons,'settings',p_settings);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.family_id<>f or r.operation<>'apply_timetable_import' or r.payload<>payload then raise exception 'request_conflict';end if;
  return (r.result->>'revision')::int;
 end if;
 -- Source first, matching cleanup/registration order. Re-read after the lock.
 select source_id into sid from public.timetable_imports where id=p_import_id and family_id=f;
 perform 1 from public.learning_sources where id=sid and family_id=f and status='ready' for update;
 if not found then raise exception 'source_not_ready';end if;
 select * into i from public.timetable_imports where id=p_import_id and family_id=f for update;
 if i.id is null or i.created_at<now()-interval '7 days' then raise exception 'import_expired';end if;
 if i.applied_revision is not null then raise exception 'import_already_applied';end if;
 rev:=public.save_school_timetable(i.child_id,p_revision,p_lessons,p_settings);
 insert into public.learning_source_links(source_id,timetable_child_id) values(i.source_id,i.child_id) on conflict do nothing;
 update public.timetable_imports set applied_revision=rev where id=i.id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'apply_timetable_import',payload,jsonb_build_object('revision',rev));
 return rev;
end;$$;
revoke all on function public.apply_timetable_import(uuid,uuid,int,jsonb,jsonb) from public,anon;
grant execute on function public.apply_timetable_import(uuid,uuid,int,jsonb,jsonb) to authenticated;

create or replace function public.expire_unlinked_learning_sources() returns int language plpgsql security definer set search_path='' as $$
declare n int:=0;candidate record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 for candidate in select s.id from public.learning_sources s where s.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.learning_source_links where source_id=s.id)
 and not exists(select 1 from public.timetable_imports where source_id=s.id and created_at>now()-interval '7 days')
 limit 100 for update skip locked loop
  if not exists(select 1 from public.learning_source_links where source_id=candidate.id)
   and not exists(select 1 from public.timetable_imports where source_id=candidate.id and created_at>now()-interval '7 days') then
   delete from public.learning_sources where id=candidate.id;n:=n+1;
  end if;
 end loop;
 return n;
end;$$;
create function public.get_timetable_sources(p_child_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('source_id',s.id,'name',s.name) order by l.created_at desc),'[]'::jsonb)
 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id
 join public.children c on c.id=l.timetable_child_id
 where l.timetable_child_id=p_child_id and gina.is_parent() and s.family_id=gina.family_id() and c.family_id=gina.family_id();
$$;
revoke all on function public.get_timetable_sources(uuid) from public,anon;
grant execute on function public.get_timetable_sources(uuid) to authenticated;
