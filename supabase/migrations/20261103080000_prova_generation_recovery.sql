-- Freeze the finishing context before calling a paid provider. Never store API credentials or document bytes here.
create table gina.prova_generation_contexts (
 job_id uuid primary key references public.prova_generation_jobs(id) on delete cascade,
 intent jsonb not null, context jsonb not null
);
alter table gina.prova_generation_contexts enable row level security;
revoke all on gina.prova_generation_contexts from public,anon,authenticated,service_role;

create table gina.prova_generation_cancellations (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade, intent jsonb not null
);
alter table gina.prova_generation_cancellations enable row level security;
revoke all on gina.prova_generation_cancellations from public,anon,authenticated,service_role;
create function public.cancel_unstarted_generation(p_id uuid,p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();actor uuid:=auth.uid();j public.prova_generation_jobs;c gina.prova_generation_contexts;x gina.prova_generation_cancellations;begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text)>50000 then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,28));perform pg_advisory_xact_lock(hashtextextended(f::text,13));
 select * into x from gina.prova_generation_cancellations where id=p_id;
 if found then
  if x.family_id<>f or x.actor_id<>actor or x.intent is distinct from p_intent then raise exception 'request_conflict';end if;
  return jsonb_build_object('request_id',p_id,'status','cancelled');
 end if;
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  if j.family_id<>f or j.requested_by is distinct from actor then raise exception 'forbidden' using errcode='42501';end if;
  select * into c from gina.prova_generation_contexts where job_id=p_id;
  if not found then raise exception 'generation_legacy_request';end if;
  if c.intent is distinct from p_intent then raise exception 'request_conflict';end if;
  if j.status<>'failed' or j.provider_result is not null then raise exception 'generation_cannot_cancel';end if;
 end if;
 insert into gina.prova_generation_cancellations values(p_id,f,actor,p_intent);
 return jsonb_build_object('request_id',p_id,'status','cancelled');
end;$$;
revoke all on function public.cancel_unstarted_generation(uuid,jsonb) from public,anon,service_role;
grant execute on function public.cancel_unstarted_generation(uuid,jsonb) to authenticated;

create function public.resume_prova_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_intent jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare j public.prova_generation_jobs;c gina.prova_generation_contexts;x gina.prova_generation_cancellations;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 select * into x from gina.prova_generation_cancellations where id=p_id;
 if found then
  if x.family_id<>p_family_id or x.actor_id<>p_user_id then raise exception 'forbidden' using errcode='42501';end if;
  if x.intent is distinct from p_intent then return jsonb_build_object('error','request_conflict');end if;
  return jsonb_build_object('error','generation_cancelled');
 end if;
 select * into j from public.prova_generation_jobs where id=p_id;
 if not found then return null;end if;
 if j.family_id<>p_family_id or j.requested_by is distinct from p_user_id then raise exception 'forbidden' using errcode='42501';end if;
 select * into c from gina.prova_generation_contexts where job_id=p_id;
 -- Do not guess the original intent or model for an old job.
 if not found then return jsonb_build_object('error','generation_legacy_request');end if;
 if c.intent is distinct from p_intent then return jsonb_build_object('error','request_conflict');end if;
 if j.status='done' then return jsonb_build_object('cached',j.result);end if;
 if j.status='failed' then return jsonb_build_object('error','generation_failed_safe');end if;
 if j.status='working' and j.provider_result is not null then return jsonb_build_object('context',c.context,'provider_result',j.provider_result,'lease',j.lease);end if;
 return jsonb_build_object('error',case when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'generation_in_progress' else 'ai_result_uncertain' end);
end;$$;

create function public.reserve_prova_generation_v3(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_intent jsonb,p_context jsonb) returns jsonb
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
  if not found or d.submitted_at is not null or d.version is distinct from (p_context#>>'{draftScope,version}')::int or d.id::text is distinct from p_context#>>'{draftScope,id}' or (d.content->>'grade')::int is distinct from (p_context->>'grade')::int or not coalesce(d.content->'subjects' ? (p_context->>'subject'),false) then raise exception 'prova_draft_changed';end if;
  select * into ch from public.children where id=(d.content->>'childId')::uuid and family_id=p_family_id for share;
  if not found or (ch.grade between 1 and 12 and ch.grade is distinct from (p_context->>'grade')::int) then raise exception 'prova_draft_changed';end if;
 end if;
 if p_context->'catalogueBound'='true' then
  result:=public.reserve_catalog_prova_generation(p_id,p_family_id,p_user_id,p_hash,p_items,(p_intent->>'blueprint_id')::uuid,(p_intent->>'draft_id')::uuid);
 else result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 if result->>'ok'='true' then insert into gina.prova_generation_contexts values(p_id,p_intent,p_context);end if;
 return result;
end;$$;
revoke all on function public.resume_prova_generation(uuid,uuid,uuid,jsonb),public.reserve_prova_generation_v3(uuid,uuid,uuid,text,int,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.resume_prova_generation(uuid,uuid,uuid,jsonb),public.reserve_prova_generation_v3(uuid,uuid,uuid,text,int,jsonb,jsonb) to service_role;

-- Older service endpoints must also respect a cancellation fence during a rolling deployment.
create function gina.protect_cancelled_generation() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='working' and exists(select 1 from gina.prova_generation_cancellations where id=new.id) then raise exception 'generation_cancelled';end if;
 return new;
end;$$;
create trigger protect_cancelled_generation before insert or update on public.prova_generation_jobs for each row execute function gina.protect_cancelled_generation();
revoke all on function gina.protect_cancelled_generation() from public,anon,authenticated,service_role;
