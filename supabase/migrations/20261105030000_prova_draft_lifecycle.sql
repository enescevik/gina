-- Recoverable removal of unassigned workspaces. Questions, paid generation jobs,
-- source files and assigned exams have independent lifecycles and are not deleted.
alter table public.prova_drafts add column discarded_at timestamptz;
create index prova_drafts_discarded on public.prova_drafts(family_id,updated_at desc,id desc) where discarded_at is not null;

create function gina.protect_discarded_prova_draft() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if old.discarded_at is not null and new.discarded_at is not distinct from old.discarded_at then
  raise exception 'prova_draft_removed';
 end if;
 return new;
end;$$;
revoke all on function gina.protect_discarded_prova_draft() from public,anon,authenticated,service_role;
create trigger protect_discarded_prova_draft before update on public.prova_drafts
for each row execute function gina.protect_discarded_prova_draft();

create function public.set_prova_draft_discarded(p_request_id uuid,p_id uuid,p_version integer,p_discarded boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); r public.mutation_receipts; d public.prova_drafts; payload jsonb; result jsonb;
begin
 if gina.is_parent() is not true or auth.uid() is null or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_id is null or p_version is null or p_version<1 or p_discarded is null then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('id',p_id,'version',p_version,'discarded',p_discarded);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'set_prova_draft_discarded' or r.payload<>payload then raise exception 'request_conflict';end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,53));
 select * into d from public.prova_drafts where id=p_id and family_id=f for update;
 if not found then raise exception 'prova_draft_not_found';end if;
 if d.submitted_at is not null or d.exam_id is not null then raise exception 'prova_draft_submitted';end if;
 if d.version<>p_version then raise exception 'prova_draft_changed';end if;
 if (d.discarded_at is not null) is distinct from p_discarded then
  update public.prova_drafts set discarded_at=case when p_discarded then clock_timestamp() else null end,
   version=version+1,updated_at=clock_timestamp() where id=p_id returning * into d;
 end if;
 result:=jsonb_build_object('id',d.id,'version',d.version,'discarded_at',d.discarded_at);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'set_prova_draft_discarded',payload,result);
 return result;
end;$$;
revoke all on function public.set_prova_draft_discarded(uuid,uuid,integer,boolean) from public,anon,service_role;
grant execute on function public.set_prova_draft_discarded(uuid,uuid,integer,boolean) to authenticated;

create or replace function public.get_prova_drafts(p_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc,d.id desc),'[]'::jsonb) from
 (select id,version,content,exam_id,submitted_at,updated_at from public.prova_drafts
 where family_id=gina.family_id() and gina.is_parent() and discarded_at is null
 and (p_id is null or id=p_id) and (p_id is not null or submitted_at is null)
 order by updated_at desc,id desc limit 100)d;
$$;

create function public.get_discarded_prova_drafts(p_child_id uuid default null,p_before_updated timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if gina.is_parent() is not true then raise exception 'forbidden' using errcode='42501';end if;
 if (p_before_updated is null) is distinct from (p_before_id is null) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc,d.id desc),'[]'::jsonb) from
 (select id,version,content,exam_id,submitted_at,updated_at,discarded_at from public.prova_drafts
 where family_id=gina.family_id() and discarded_at is not null and submitted_at is null
 and (p_child_id is null or content->>'childId'=p_child_id::text)
 and (p_before_updated is null or (updated_at,id)<(p_before_updated,p_before_id))
 order by updated_at desc,id desc limit 30)d);
end;$$;
revoke all on function public.get_discarded_prova_drafts(uuid,timestamptz,uuid) from public,anon,service_role;
grant execute on function public.get_discarded_prova_drafts(uuid,timestamptz,uuid) to authenticated;

-- Reject new paid work on a removed draft; existing paid-result recovery remains valid.
create or replace function public.reserve_prova_generation_v3(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_intent jsonb,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;existing gina.prova_generation_contexts;d public.prova_drafts;ch public.children;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text)>50000 or jsonb_typeof(p_context) is distinct from 'object' or octet_length(p_context::text)>5000000 or p_context->>'schema' is distinct from 'gina.generation-context.v1' or p_context->>'promptHash' is distinct from p_hash or (p_context->>'total')::int is distinct from p_items or jsonb_typeof(p_context->'catalogueBound') is distinct from 'boolean' then raise exception 'invalid_generation_context';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 if exists(select 1 from gina.prova_generation_cancellations where id=p_id) then return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);end if;
 select * into existing from gina.prova_generation_contexts where job_id=p_id;
 if found then
  if existing.intent is distinct from p_intent then return jsonb_build_object('error','request_conflict');end if;
  -- All repeat paths use the original finishing context. This function never restarts a failed/uncertain paid intent.
  return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);
 end if;
 if exists(select 1 from public.prova_generation_jobs where id=p_id) then return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);end if;
 if p_intent->>'draft_id' is not null then
  select * into d from public.prova_drafts where id=(p_intent->>'draft_id')::uuid and family_id=p_family_id for share;
  if not found or d.discarded_at is not null or d.submitted_at is not null or d.version is distinct from (p_context#>>'{draftScope,version}')::int or d.id::text is distinct from p_context#>>'{draftScope,id}' or (d.content->>'grade')::int is distinct from (p_context->>'grade')::int or not coalesce(d.content->'subjects' ? (p_context->>'subject'),false) then raise exception 'prova_draft_changed';end if;
  select * into ch from public.children where id=(d.content->>'childId')::uuid and family_id=p_family_id for share;
  if not found or (ch.grade between 1 and 12 and ch.grade is distinct from (p_context->>'grade')::int) then raise exception 'prova_draft_changed';end if;
 end if;
 if p_context->'catalogueBound'='true' then
  result:=public.reserve_catalog_prova_generation(p_id,p_family_id,p_user_id,p_hash,p_items,(p_intent->>'blueprint_id')::uuid,(p_intent->>'draft_id')::uuid);
 else result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 if result->>'ok'='true' then insert into gina.prova_generation_contexts values(p_id,p_intent,p_context);end if;
 return result;
end;$$;

create or replace function public.reserve_catalog_prova_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_blueprint_id uuid,p_draft_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link gina.catalog_blueprint_links;bound gina.catalog_generation_links;j public.prova_generation_jobs;c gina.curriculum_candidates;d public.prova_drafts;ch public.children;bp public.exam_blueprints;result jsonb;plan public.plans;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_draft_id is null or p_blueprint_id is null then raise exception 'curriculum_scope_mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  select * into bound from gina.catalog_generation_links where job_id=p_id;
  if not found or bound.blueprint_id<>p_blueprint_id or bound.draft_id<>p_draft_id then return jsonb_build_object('error','request_conflict');end if;
  -- A withdrawal prevents new provider work, not retrieval/finishing of an already paid result.
  if j.status<>'failed' then return public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 end if;
 select * into link from gina.catalog_blueprint_links where blueprint_id=p_blueprint_id and family_id=p_family_id for share;
 if not found or link.child_id is null then raise exception 'curriculum_scope_mismatch';end if;
 select * into d from public.prova_drafts where id=p_draft_id and family_id=p_family_id for share;
 if not found or d.discarded_at is not null or d.submitted_at is not null or d.content->>'childId' is distinct from link.child_id::text or d.content->>'purpose' is distinct from 'written' then raise exception 'curriculum_scope_mismatch';end if;
 select * into ch from public.children where id=link.child_id and family_id=p_family_id for share;
 select * into bp from public.exam_blueprints where id=p_blueprint_id and family_id=p_family_id for share;
 if ch.id is null or bp.id is null or ch.grade is distinct from bp.grade or (d.content->>'grade')::int is distinct from bp.grade or not exists(select 1 from jsonb_array_elements_text(d.content->'subjects') s where gina.curriculum_subject(s.value)=gina.curriculum_subject(bp.subject)) or p_items is distinct from (link.snapshot->'candidate'->>'question_count')::int then raise exception 'curriculum_scope_mismatch';end if;
 select * into c from gina.curriculum_candidates where id=link.catalogue_id for share;
 if c.status<>'published' or c.revision<>link.revision or not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then return jsonb_build_object('error','curriculum_unavailable');end if;
 plan:=gina.family_plan_of(p_family_id);
 if not plan.prova_scenarios then return jsonb_build_object('error','plan_limit_prova_scenarios');end if;
 result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);
 if result->>'ok'='true' then insert into gina.catalog_generation_links values(p_id,p_blueprint_id,p_draft_id) on conflict(job_id) do nothing;end if;
 return result;
end;$$;

