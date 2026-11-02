-- Disabled until release readiness. Materialize common text into each member
-- stem for older readers, PDF export and AI grading; current readers also receive
-- structured context plus the original prompt, so it is shown only once.
insert into public.app_settings(key,value) values('question_groups.enabled','false') on conflict do nothing;
create table public.question_source_groups (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 series_id uuid not null, version int not null check(version>0), previous_id uuid,
 title text not null check(length(title) between 1 and 160),
 body text not null default '' check(length(body)<=6000),
 grade smallint not null check(grade between 1 and 12), subject text not null check(length(subject) between 1 and 80),
 created_at timestamptz not null default now(), finalized_at timestamptz,
 unique(family_id,series_id,version)
);
create table public.question_source_members (
 group_id uuid not null references public.question_source_groups(id) on delete cascade,
 question_id uuid primary key references public.question_bank(id) on delete cascade,
 prompt text not null check(length(prompt) between 5 and 3500),
 position int not null check(position between 1 and 12), unique(group_id,position)
);
alter table public.question_source_groups enable row level security;
alter table public.question_source_members enable row level security;
revoke all on public.question_source_groups,public.question_source_members from anon,authenticated;
grant all on public.question_source_groups,public.question_source_members to service_role;
grant select on public.question_source_groups,public.question_source_members to authenticated;
create policy question_group_parent_read on public.question_source_groups for select to authenticated
using(gina.is_parent() and family_id=gina.family_id());
create policy question_member_parent_read on public.question_source_members for select to authenticated
using(gina.is_parent() and exists(select 1 from public.question_source_groups g where g.id=group_id and g.family_id=gina.family_id()));

create function gina.guard_question_group_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.families where id=old.family_id) then return old; end if;
 if tg_op='UPDATE' and old.finalized_at is null and new.finalized_at is not null
 and (to_jsonb(new)-'finalized_at')=(to_jsonb(old)-'finalized_at')
 and (select count(*) from public.question_source_members where group_id=old.id) between 2 and 12 then return new; end if;
 raise exception 'question_group_immutable';
end; $$;
revoke all on function gina.guard_question_group_version() from public,anon,authenticated;
create trigger question_group_version_guard before update or delete on public.question_source_groups
for each row execute function gina.guard_question_group_version();

create function gina.guard_question_group_members() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.question_source_groups;
begin
 if tg_op<>'INSERT' then
  if exists(select 1 from public.question_source_groups saved join public.families f on f.id=saved.family_id where saved.id=old.group_id)
  then raise exception 'question_group_immutable'; end if;
  return old;
 end if;
 select * into g from public.question_source_groups where id=new.group_id for update;
 if g.id is null or g.finalized_at is not null then raise exception 'question_group_immutable'; end if;
 perform 1 from public.question_bank q where q.id=new.question_id and q.family_id=g.family_id and q.grade=g.grade and q.subject=g.subject and q.stem=g.title||E'\n'||g.body||E'\n\n'||new.prompt for update;
 if not found then raise exception 'question_group_mismatch'; end if;
 return new;
end; $$;
revoke all on function gina.guard_question_group_members() from public,anon,authenticated;
create trigger question_group_members_guard before insert or update or delete on public.question_source_members
for each row execute function gina.guard_question_group_members();

create function gina.guard_question_group_content() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.family_id is not null and not exists(select 1 from public.families where id=old.family_id) then return old; end if;
 if exists(select 1 from public.question_source_members where question_id=old.id) then
  if tg_op='DELETE' then raise exception 'question_group_immutable'; end if;
  if (to_jsonb(new)-array['times_asked','updated_at','created_by'])
  is distinct from (to_jsonb(old)-array['times_asked','updated_at','created_by'])
  then raise exception 'question_group_immutable'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function gina.guard_question_group_content() from public,anon,authenticated;
create trigger question_group_content_guard before update or delete on public.question_bank
for each row execute function gina.guard_question_group_content();

create function gina.guard_question_group_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if tg_op='INSERT' then ids:=array[new.question_id];
 elsif tg_op='DELETE' then ids:=array[old.question_id];
 else ids:=array[old.question_id,new.question_id]; end if;
 if exists(select 1 from public.question_source_members m join public.question_bank q on q.id=m.question_id
   join public.families f on f.id=q.family_id where m.question_id=any(ids))
 then raise exception 'question_group_immutable'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function gina.guard_question_group_media() from public,anon,authenticated;
create trigger question_group_media_guard before insert or update or delete on public.learning_source_links
for each row execute function gina.guard_question_group_media();

create function public.save_question_source_group(p_request_id uuid,p_group jsonb,p_questions jsonb,p_images jsonb default '[]',p_previous_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;payload jsonb;result jsonb;prev public.question_source_groups;
 series uuid;v int:=1;item jsonb;qid uuid;ids uuid[]:='{}';n int:=0;gr int;subj text;body text;title text;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_group) is distinct from 'object'
 or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 2 and 12
 or jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>3 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('group',p_group,'questions',p_questions,'images',p_images,'previous_id',p_previous_id);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_question_group' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 if not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb) then raise exception 'question_groups_unavailable'; end if;
 gr:=(p_group->>'grade')::int;subj:=trim(p_group->>'subject');body:=trim(coalesce(p_group->>'body',''));title:=trim(p_group->>'title');
 if gr is null or gr not between 1 and 12 or coalesce(length(subj),0) not between 1 and 80
 or coalesce(length(title),0) not between 1 and 160 or length(body)>6000
 or (length(body)<20 and jsonb_array_length(p_images)=0) then raise exception 'question_group_incomplete'; end if;
 series:=p_request_id;
 if p_previous_id is not null then
  select * into prev from public.question_source_groups where id=p_previous_id and family_id=f and finalized_at is not null;
  if not found then raise exception 'question_group_not_found'; end if;
  series:=prev.series_id;
  perform pg_advisory_xact_lock(hashtextextended(series::text,52));
  if exists(select 1 from public.question_source_groups where family_id=f and series_id=series and version>prev.version) then raise exception 'question_group_changed'; end if;
  v:=prev.version+1;
 end if;
 insert into public.question_source_groups(id,family_id,series_id,version,previous_id,title,body,grade,subject)
 values(p_request_id,f,series,v,p_previous_id,title,body,gr,subj);
 for item in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(item) is distinct from 'object'
  or (item ? 'grade' and (item->>'grade')::int is distinct from gr)
  or (item ? 'subject' and item->>'subject' is distinct from subj)
  or length(trim(coalesce(item->>'stem',''))) not between 5 and 3500
  or length(trim(coalesce(item->>'solution',''))) not between 1 and 10000
  or (item->>'kind'='open_ended' and length(trim(coalesce(item->>'expected_answer',''))) not between 1 and 10000) then raise exception 'question_group_mismatch'; end if;
  qid:=gen_random_uuid();n:=n+1;
  -- Images are actual links on every member, retaining the existing private
  -- URL, notebook-crop and per-question access checks without new public URLs.
  perform public.save_question_with_sources(qid,item||jsonb_build_object('grade',gr,'subject',subj,'stem',title||E'\n'||body||E'\n\n'||trim(item->>'stem')),p_images);
  insert into public.question_source_members(group_id,question_id,position,prompt) values(p_request_id,qid,n,trim(item->>'stem'));
  ids:=array_append(ids,qid);
 end loop;
 update public.question_source_groups set finalized_at=now() where id=p_request_id;
 result:=jsonb_build_object('id',p_request_id,'series_id',series,'version',v,'question_ids',ids);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'save_question_group',payload,result);
 return result;
end; $$;
revoke all on function public.save_question_source_group(uuid,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.save_question_source_group(uuid,jsonb,jsonb,jsonb,uuid) to authenticated;

-- Never return siblings, answers, solutions, uploader identity or file paths.
-- The caller supplies individual IDs and receives context only for allowed IDs.
create function public.get_question_context(p_question_ids uuid[]) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',m.question_id,'group_id',g.id,
  'version',g.version,'title',g.title,'body',g.body,'position',m.position,'prompt',m.prompt) order by m.position),'[]'::jsonb)
 from public.question_source_members m join public.question_source_groups g on g.id=m.group_id
 where g.family_id=gina.family_id() and m.question_id=any(p_question_ids[1:100]) and gina.can_read_question_media(m.question_id);
$$;
revoke all on function public.get_question_context(uuid[]) from public,anon;
grant execute on function public.get_question_context(uuid[]) to authenticated;

create function gina.guard_question_group_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Closing the rollout gate must not interrupt already assigned practices.
 if tg_op='UPDATE' and old.content_locked_at is not null then return new; end if;
 if not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb)
 and new.status in('assigned','completed') and exists(select 1 from public.question_source_members where question_id=any(new.question_ids))
 then raise exception 'question_group_delivery_not_ready'; end if;
 return new;
end; $$;
revoke all on function gina.guard_question_group_delivery() from public,anon,authenticated;
create trigger question_group_delivery_guard before insert or update on public.exams
for each row execute function gina.guard_question_group_delivery();

-- Sharing one member without its common text would silently lose the question.
create or replace function gina.guard_contribution_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_bank where id=new.source_question_id for update;
 if exists(select 1 from public.learning_source_links where question_id=new.source_question_id)
 or exists(select 1 from public.question_source_members where question_id=new.source_question_id)
 then raise exception 'source_contribution_not_ready'; end if;
 return new;
end; $$;

-- Ordinary automatic question selection excludes groups; explicit group assignment
-- preserves the author's member order and version. Existing exams keep bank IDs.
create view public.standalone_question_bank with(security_invoker=true) as
select q.* from public.question_bank q where not exists(select 1 from public.question_source_members m where m.question_id=q.id);
grant select on public.standalone_question_bank to authenticated,service_role;
create function public.get_question_group_policy() returns boolean language sql stable security definer set search_path='' as $$
 select gina.is_parent() and exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb);
$$;
revoke all on function public.get_question_group_policy() from public,anon;
grant execute on function public.get_question_group_policy() to authenticated;

create function public.assign_question_source_group(p_request_id uuid,p_group_id uuid,p_child_id uuid,p_title text,p_timed boolean default false,p_minutes int default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;payload jsonb;g public.question_source_groups;ids uuid[];
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_timed is null or length(trim(coalesce(p_title,''))) not between 1 and 160
 or (p_timed and (p_minutes is null or p_minutes not between 1 and 180)) then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('group',p_group_id,'child',p_child_id,'title',trim(p_title),'timed',p_timed,'minutes',p_minutes);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'assign_question_group' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return (r.result->>'id')::uuid;
 end if;
 select * into g from public.question_source_groups where id=p_group_id and family_id=f and finalized_at is not null;
 if not found then raise exception 'question_group_not_found'; end if;
 select array_agg(question_id order by position) into ids from public.question_source_members where group_id=g.id;
 if coalesce(cardinality(ids),0) not between 2 and 12 then raise exception 'question_group_incomplete'; end if;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by)
 values(p_request_id,f,p_child_id,trim(p_title),g.subject,g.grade,ids,p_timed,case when p_timed then p_minutes else null end,'assigned',auth.uid());
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'assign_question_group',payload,jsonb_build_object('id',p_request_id));
 return p_request_id;
end; $$;
revoke all on function public.assign_question_source_group(uuid,uuid,uuid,text,boolean,int) from public,anon;
grant execute on function public.assign_question_source_group(uuid,uuid,uuid,text,boolean,int) to authenticated;

-- Browsing/printing the library shows current versions; past exam/review reads
-- continue to use question_bank and their retained IDs.
create view public.current_question_bank with(security_invoker=true) as
select q.* from public.question_bank q where not exists(
 select 1 from public.question_source_members m join public.question_source_groups g on g.id=m.group_id
 join public.question_source_groups newer on newer.family_id=g.family_id and newer.series_id=g.series_id and newer.version>g.version
 where m.question_id=q.id
);
grant select on public.current_question_bank to authenticated,service_role;
