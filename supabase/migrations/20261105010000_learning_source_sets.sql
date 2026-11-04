-- Immutable ordered collections retain the existing source_id contract. The first
-- original is an anchor, not a merged or fabricated file; every member stays private.
insert into public.app_settings(key,value) values('sources.max_files','5') on conflict do nothing;
create table public.learning_source_sets (
 anchor_id uuid primary key references public.learning_sources(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 source_ids uuid[] not null check(cardinality(source_ids) between 1 and 10),
 pages int not null check(pages between 1 and 20),
 created_at timestamptz not null default now(),
 check(source_ids[1]=anchor_id)
);
alter table public.learning_source_sets enable row level security;
revoke all on public.learning_source_sets from anon,authenticated;
grant select on public.learning_source_sets to authenticated;
grant all on public.learning_source_sets to service_role;
create policy source_sets_parent_read on public.learning_source_sets for select to authenticated
using(gina.is_parent() and family_id=gina.family_id());
create function gina.source_file_limit() returns int language sql stable security definer set search_path='' as $$
 select coalesce((select least(10,greatest(1,(value#>>'{}')::int)) from public.app_settings where key='sources.max_files'),5)
$$;
revoke all on function gina.source_file_limit() from public,anon,authenticated;
create or replace function public.get_learning_source_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',gina.is_parent() and exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb),
 'max_files',gina.source_file_limit(),'max_images',3,'max_image_bytes',4194304,'max_pdf_pages',5,'max_total_pages',20,'max_total_bytes',20971520,'analysis_cost','per_operation');
$$;
create function public.admin_source_file_limit(p_max_files int) returns void language plpgsql security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_max_files is null or p_max_files not between 1 and 10 then raise exception 'invalid_input';end if;
 insert into public.app_settings(key,value) values('sources.max_files',to_jsonb(p_max_files))
 on conflict(key) do update set value=excluded.value,updated_at=now();
end;$$;
revoke all on function public.admin_source_file_limit(int) from public,anon;
grant execute on function public.admin_source_file_limit(int) to authenticated;
create function public.register_learning_source_set(p_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();existing public.learning_source_sets; n int; total_pages int;total_bytes bigint;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then raise exception 'source_unavailable';end if;
 if p_ids is null or array_ndims(p_ids)<>1 or array_lower(p_ids,1)<>1 or cardinality(p_ids) not between 1 and gina.source_file_limit()
 or exists(select 1 from unnest(p_ids) x where x is null) or (select count(distinct x) from unnest(p_ids)x)<>cardinality(p_ids) then raise exception 'source_file_limit';end if;
 -- A family lock also prevents two requests assigning an original to different sets.
 perform pg_advisory_xact_lock(hashtextextended(f::text,41));
 perform 1 from public.learning_sources where id=any(p_ids) order by id for update;
 select count(*),sum(coalesce(pages,1)),sum(bytes) into n,total_pages,total_bytes from public.learning_sources
 where id=any(p_ids) and family_id=f and kind='document' and status='ready' and uploaded_by=auth.uid();
 if n<>cardinality(p_ids) then raise exception 'source_not_ready';end if;
 if total_pages>20 or total_bytes>20971520 then raise exception 'source_size_or_type';end if;
 select * into existing from public.learning_source_sets where anchor_id=p_ids[1];
 if found then
  if existing.family_id<>f or existing.source_ids<>p_ids then raise exception 'request_conflict';end if;
  return existing.anchor_id;
 end if;
 if exists(select 1 from public.learning_source_sets where source_ids && p_ids)
 or exists(select 1 from public.learning_source_ai_consents where source_id=any(p_ids))
 or exists(select 1 from public.learning_source_links where source_id=any(p_ids)) then raise exception 'request_conflict';end if;
 insert into public.learning_source_sets(anchor_id,family_id,source_ids,pages) values(p_ids[1],f,p_ids,total_pages);
 return p_ids[1];
end;$$;
revoke all on function public.register_learning_source_set(uuid[]) from public,anon;
grant execute on function public.register_learning_source_set(uuid[]) to authenticated;
-- Retain original links for every document, so existing delete protection and source
-- attribution still work for tasks, goals, rewards and timetable imports.
create function gina.expand_source_set_links() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[]; member uuid;
begin
 select source_ids into ids from public.learning_source_sets where anchor_id=new.source_id;
 if ids is null then return new;end if;
 foreach member in array ids loop
  if member<>new.source_id then
   insert into public.learning_source_links(source_id,question_id,timetable_child_id,task_id,reward_id,goal_id,alt)
   values(member,new.question_id,new.timetable_child_id,new.task_id,new.reward_id,new.goal_id,new.alt) on conflict do nothing;
  end if;
 end loop;
 return new;
end;$$;
revoke all on function gina.expand_source_set_links() from public,anon,authenticated;
create trigger expand_source_set_links after insert on public.learning_source_links for each row execute function gina.expand_source_set_links();

create or replace function public.prepare_learning_plan_import(p_family uuid,p_user uuid,p_child uuid,p_source uuid,p_locale text,p_context jsonb) returns jsonb
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
  p_context||jsonb_build_object('input',jsonb_build_object('grade',grade,'locale',p_locale),'sha256',s.sha256,'pages',coalesce((select pages from public.learning_source_sets where anchor_id=p_source),s.pages,1))) returning * into i;
 return jsonb_build_object('id',i.id,'context',i.context,'view',gina.learning_import_view(i.id));
end;$$;

create or replace function public.expire_unlinked_learning_sources() returns int language plpgsql security definer set search_path='' as $$
declare n int:=0;candidate record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 for candidate in select s.id from public.learning_sources s where s.created_at<now()-interval '24 hours' and not exists(select 1 from public.learning_source_sets ss where s.id=any(ss.source_ids) and ss.anchor_id<>s.id)
 and not exists(select 1 from public.question_bank q where q.provenance->>'document_source_id'=s.id::text)
 and not exists(select 1 from public.learning_source_links where source_id=s.id)
 and not exists(select 1 from public.timetable_imports where source_id=s.id and created_at>now()-interval '7 days')
 and not exists(select 1 from gina.learning_plan where source_id=s.id)
 and not exists(select 1 from gina.learning_plan_imports where source_id=s.id and created_at>now()-interval '7 days')
 limit 100 for update skip locked loop
  if not exists(select 1 from public.learning_source_sets ss where candidate.id=any(ss.source_ids) and ss.anchor_id<>candidate.id)
   and not exists(select 1 from public.question_bank q where q.provenance->>'document_source_id'=candidate.id::text)
   and not exists(select 1 from public.learning_source_links where source_id=candidate.id)
   and not exists(select 1 from public.timetable_imports where source_id=candidate.id and created_at>now()-interval '7 days')
   and not exists(select 1 from gina.learning_plan where source_id=candidate.id)
   and not exists(select 1 from gina.learning_plan_imports where source_id=candidate.id and created_at>now()-interval '7 days') then
   delete from public.learning_sources where id=candidate.id;n:=n+1;
  end if;
 end loop;
 return n;
end;$$;
create function public.get_learning_source_set(p_source uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[]; result jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select source_ids into ids from public.learning_source_sets where anchor_id=p_source and family_id=gina.family_id();
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'mime',s.mime) order by array_position(ids,s.id)),'[]') into result
 from public.learning_sources s where s.id=any(coalesce(ids,array[p_source])) and s.family_id=gina.family_id() and s.status='ready';
 if ids is not null and jsonb_array_length(result)<>cardinality(ids) then raise exception 'source_not_ready';end if;
 return result;
end;$$;
revoke all on function public.get_learning_source_set(uuid) from public,anon;
grant execute on function public.get_learning_source_set(uuid) to authenticated;

create or replace function public.reserve_learning_source(p_id uuid,p_kind text,p_name text,p_mime text,p_bytes int,p_sha256 text,p_consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();s public.learning_sources;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb) then raise exception 'source_unavailable'; end if;
 if p_consent is not true then raise exception 'source_consent_required'; end if;
 if p_id is null or p_kind not in('document','question_image') or p_mime not in('image/png','image/jpeg','application/pdf') or (p_mime<>'application/pdf' and p_bytes>4194304) then raise exception 'source_size_or_type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,41));
 select * into s from public.learning_sources where id=p_id;
 if found then
  if s.family_id<>f or s.uploaded_by is distinct from auth.uid() or s.sha256<>p_sha256 or s.kind<>p_kind or s.bytes<>p_bytes or s.mime<>p_mime then raise exception 'request_conflict'; end if;
  return to_jsonb(s);
 end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 minute')>=greatest(5,gina.source_file_limit()) then raise exception 'source_rate_limited'; end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 day')>=100
 or (select coalesce(sum(bytes),0) from public.learning_sources where family_id=f)+p_bytes>536870912 then raise exception 'source_storage_limit'; end if;
 insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,storage_consent)
 values(p_id,f,auth.uid(),p_kind,trim(p_name),p_mime,p_bytes,p_sha256,f::text||'/'||p_id::text,'private-storage-v1') returning * into s;
 return to_jsonb(s);
end; $$;


-- Generated questions keep their private originals available for the parent.
create index if not exists question_bank_document_source on public.question_bank ((provenance->>'document_source_id')) where provenance ? 'document_source_id';
