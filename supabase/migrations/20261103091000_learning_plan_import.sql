-- Stable, private document extraction; generation is separate from parent-approved application.
create table gina.learning_plan_imports (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 source_id uuid not null references public.learning_sources(id) on delete cascade,
 locale text not null check(locale in ('tr','en')),
 context jsonb not null,
 job_id uuid references public.ai_operation_jobs(id) on delete set null,
 applied jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(child_id,source_id,locale)
);
create index learning_plan_import_family on gina.learning_plan_imports(family_id);
create index learning_plan_import_source on gina.learning_plan_imports(source_id);
create index learning_plan_import_job on gina.learning_plan_imports(job_id) where job_id is not null;
alter table gina.learning_plan_imports enable row level security;
revoke all on gina.learning_plan_imports from public,anon,authenticated,service_role;
create function gina.learning_import_parent(p_family uuid,p_user uuid,p_child uuid,p_source uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where family_id=p_family and user_id=p_user) then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform 1 from public.children where id=p_child and family_id=p_family for key share;
 if not found then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform 1 from public.learning_sources where id=p_source and family_id=p_family and kind='document' and status='ready' for key share;
 if not found then raise exception 'source_not_ready';end if;
end;$$;
revoke all on function gina.learning_import_parent(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function gina.learning_import_view(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'child_id',i.child_id,'source_id',i.source_id,'locale',i.locale,'grade',i.context#>'{input,grade}',
 'status',coalesce(j.status,'new'),'draft',case when j.status='done' then j.result->'output' else null end,'applied',i.applied)
 from gina.learning_plan_imports i left join public.ai_operation_jobs j on j.id=i.job_id where i.id=p_id
$$;
revoke all on function gina.learning_import_view(uuid) from public,anon,authenticated,service_role;
create function public.get_learning_plan_import(p_child_id uuid,p_source_id uuid,p_locale text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not gina.is_parent() then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform gina.learning_import_parent(gina.family_id(),auth.uid(),p_child_id,p_source_id);
 return (select gina.learning_import_view(id) from gina.learning_plan_imports where child_id=p_child_id and source_id=p_source_id and locale=p_locale);
end;$$;
revoke all on function public.get_learning_plan_import(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.get_learning_plan_import(uuid,uuid,text) to authenticated;
create function public.prepare_learning_plan_import(p_family uuid,p_user uuid,p_child uuid,p_source uuid,p_locale text,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;s public.learning_sources;grade int;begin
 if auth.role() is distinct from 'service_role' then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform gina.learning_import_parent(p_family,p_user,p_child,p_source);
 if p_locale is null or p_locale not in('tr','en') then raise exception 'plan_import_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_child::text||p_source::text||p_locale,91));
 select * into i from gina.learning_plan_imports where child_id=p_child and source_id=p_source and locale=p_locale;
 if i.id is not null then return jsonb_build_object('id',i.id,'context',i.context,'view',gina.learning_import_view(i.id));end if;
 if p_context is null then raise exception 'plan_import_context_needed';end if;
 if jsonb_typeof(p_context)<>'object' or not(p_context ?& array['config','system','schema']) or p_context-array['config','system','schema']<>'{}'
 or octet_length(p_context::text)>16000 or jsonb_typeof(p_context->'config')<>'object' or jsonb_typeof(p_context->'system')<>'string' or jsonb_typeof(p_context->'schema')<>'object' then raise exception 'plan_import_invalid';end if;
 select * into s from public.learning_sources where id=p_source;
 select c.grade into grade from public.children c where id=p_child;
 insert into gina.learning_plan_imports(family_id,child_id,source_id,locale,context) values(p_family,p_child,p_source,p_locale,
  p_context||jsonb_build_object('input',jsonb_build_object('grade',grade,'locale',p_locale),'sha256',s.sha256,'pages',coalesce(s.pages,1))) returning * into i;
 return jsonb_build_object('id',i.id,'context',i.context,'view',gina.learning_import_view(i.id));
end;$$;
create function public.reserve_learning_plan_import(p_family uuid,p_user uuid,p_context uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;r jsonb;plan public.plans;begin
 if auth.role() is distinct from 'service_role' then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 select * into i from gina.learning_plan_imports where id=p_context and family_id=p_family;
 if i.id is null then raise exception 'plan_import_unavailable';end if;
 perform gina.learning_import_parent(p_family,p_user,i.child_id,i.source_id);
 -- Fresh source/model/policy checks are immediately before any new paid operation.
 if not exists(select 1 from public.learning_sources where id=i.source_id and sha256=i.context->>'sha256') then raise exception 'source_not_ready';end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then return jsonb_build_object('error','source_unavailable');end if;
 plan:=gina.family_plan_of(p_family);
 if exists(select 1 from public.app_settings where key='ai.enabled' and value='false') or exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled) then return jsonb_build_object('error','ai_disabled');end if;
 if not exists(select 1 from public.ai_models where id=i.context#>>'{config,model}' and active and provider='anthropic') then return jsonb_build_object('error','ai_model_unavailable');end if;
 r:=public.reserve_ai_operation(p_family,p_user,'import',encode(extensions.digest('learning-plan/v1/'||i.id::text||i.context::text,'sha256'),'hex'),p_lease);
 if r ? 'id' then update gina.learning_plan_imports set job_id=(r->>'id')::uuid where id=i.id;end if;
 return r;
end;$$;
revoke all on function public.prepare_learning_plan_import(uuid,uuid,uuid,uuid,text,jsonb),public.reserve_learning_plan_import(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_learning_plan_import(uuid,uuid,uuid,uuid,text,jsonb),public.reserve_learning_plan_import(uuid,uuid,uuid,uuid) to service_role;
create function public.apply_learning_plan_import(p_request_id uuid,p_child_id uuid,p_import_id uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;output jsonb;payload jsonb;result jsonb;x jsonb;position int;body jsonb;ids jsonb:='[]';begin
 if not gina.is_parent() then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform gina.learning_plan_access(p_child_id);
 payload:=jsonb_build_object('action','learning.plan.import','child',p_child_id,'import',p_import_id,'items',p_items);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 if p_import_id is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 12 or octet_length(p_items::text)>100000 then raise exception 'plan_import_invalid';end if;
 -- Match regular plan edits: serialize all changes for this child first.
 perform 1 from public.children where id=p_child_id and family_id=gina.family_id() for update;
 if not found then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 select * into i from gina.learning_plan_imports where id=p_import_id and child_id=p_child_id and family_id=gina.family_id();
 if i.id is null then raise exception 'plan_import_unavailable';end if;
 perform gina.learning_import_parent(gina.family_id(),auth.uid(),p_child_id,i.source_id);
 select * into i from gina.learning_plan_imports where id=p_import_id for update;
 select j.result->'output' into output from public.ai_operation_jobs j where j.id=i.job_id and j.status='done' and j.family_id=i.family_id and j.action='import';
 if output is null or jsonb_typeof(output->'items') is distinct from 'array' then raise exception 'plan_import_unavailable';end if;
 for x in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(x)<>'object' or not(x ?& array['index','id','content']) or x-array['index','id','content']<>'{}'
   or jsonb_typeof(x->'index')<>'number' or x->>'index'!~ '^[0-9]{1,2}$'
   or jsonb_typeof(x->'id')<>'string' or x->>'id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(x->'content')<>'object' then raise exception 'plan_import_invalid';end if;
  position:=(x->>'index')::int;
  if position<0 or position>=jsonb_array_length(output->'items') then raise exception 'plan_import_invalid';end if;
  if i.applied ? position::text then raise exception 'plan_import_already_applied';end if;
  body:=x->'content';
  if body->>'source_id' is distinct from i.source_id::text then raise exception 'source_not_ready';end if;
  perform public.save_learning_plan(gen_random_uuid(),p_child_id,(x->>'id')::uuid,0,body);
  i.applied:=i.applied||jsonb_build_object(position::text,x->>'id');
  ids:=ids||jsonb_build_array(x->>'id');
 end loop;
 update gina.learning_plan_imports set applied=i.applied where id=i.id;
 result:=jsonb_build_object('request',p_request_id,'import',i.id,'child',p_child_id,'ids',ids);
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;
revoke all on function public.apply_learning_plan_import(uuid,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.apply_learning_plan_import(uuid,uuid,uuid,jsonb) to authenticated;
-- Source/child deletion revokes a paid job lease as well as deleting the private context.
-- Usage is retained; a late provider response cannot restore deleted source content.
create function gina.revoke_learning_import() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.ai_operation_jobs set status='uncertain',result=null,lease=gen_random_uuid(),error_code='learning_source_removed',updated_at=now() where id=old.job_id;
 return old;
end;$$;
revoke all on function gina.revoke_learning_import() from public,anon,authenticated,service_role;
create trigger revoke_learning_import after delete on gina.learning_plan_imports for each row execute function gina.revoke_learning_import();

create index learning_plan_source on gina.learning_plan(source_id) where source_id is not null;
create or replace function public.expire_unlinked_learning_sources() returns int language plpgsql security definer set search_path='' as $$
declare n int:=0;candidate record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 for candidate in select s.id from public.learning_sources s where s.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.learning_source_links where source_id=s.id)
 and not exists(select 1 from public.timetable_imports where source_id=s.id and created_at>now()-interval '7 days')
 and not exists(select 1 from gina.learning_plan where source_id=s.id)
 and not exists(select 1 from gina.learning_plan_imports where source_id=s.id and created_at>now()-interval '7 days')
 limit 100 for update skip locked loop
  if not exists(select 1 from public.learning_source_links where source_id=candidate.id)
   and not exists(select 1 from public.timetable_imports where source_id=candidate.id and created_at>now()-interval '7 days')
   and not exists(select 1 from gina.learning_plan where source_id=candidate.id)
   and not exists(select 1 from gina.learning_plan_imports where source_id=candidate.id and created_at>now()-interval '7 days') then
   delete from public.learning_sources where id=candidate.id;n:=n+1;
  end if;
 end loop;
 return n;
end;$$;

create or replace function public.admin_retry_ai_operation(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'reason_required'; end if;
 update public.ai_operation_jobs set status='failed',lease=gen_random_uuid(),updated_at=now(),error_code='operator_retry_authorized'
 where id=p_id and coalesce(error_code,'') not in ('weekly_context_removed','learning_source_removed') and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) returning family_id into f;
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
 select id,family_id,action,status,error_code,created_at,updated_at,(coalesce(error_code,'') not in ('weekly_context_removed','learning_source_removed') and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'))) retryable from public.ai_operation_jobs
 union all
 select id,family_id,'generate',status,error_code,created_at,updated_at,(provider_result is null and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes'))) from public.prova_generation_jobs
 ) recent order by created_at desc limit 100) j));
end; $$;

-- Confirmed token usage and the result commit together; cached reads do not add cost rows.
create function gina.record_learning_import_usage() returns trigger language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;begin
 if new.action='import' and new.status='done' and old.status is distinct from 'done' then
  select * into i from gina.learning_plan_imports where job_id=new.id;
  if i.id is not null then
   insert into public.prova_ai_usage(family_id,action,model,items,input_tokens,output_tokens,requested_by,operation_id)
   values(i.family_id,'import',i.context#>>'{config,model}',jsonb_array_length(new.result#>'{output,items}'),(new.result->>'inputTokens')::int,(new.result->>'outputTokens')::int,new.requested_by,new.id)
   on conflict(operation_id) do nothing;
  end if;
 end if;
 return new;
end;$$;
revoke all on function gina.record_learning_import_usage() from public,anon,authenticated,service_role;
create trigger record_learning_import_usage after update on public.ai_operation_jobs for each row execute function gina.record_learning_import_usage();
