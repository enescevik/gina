-- Assigned content is immutable before the first answer, too. Keep using the
-- same question IDs for display, PDF export and grading: no display-only copy.
alter table public.exams add column content_locked_at timestamptz;
create index exams_question_ids_gin on public.exams using gin(question_ids);
update public.exams e set content_locked_at=e.created_at
where status in ('assigned','completed') or exists(select 1 from public.exam_attempts where exam_id=e.id);

create or replace function gina.guard_exam_references() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not gina.exam_references_valid(new.family_id,new.child_id,new.question_ids,new.blueprint_id) then
  raise exception 'exam_reference_forbidden' using errcode='42501';
 end if;
 -- Serialize assignment with question edits and media attachment. Sorted locks
 -- avoid opposite lock order when two exams share several questions.
 perform 1 from public.question_bank where id=any(new.question_ids) order by id for update;
 if not gina.exam_references_valid(new.family_id,new.child_id,new.question_ids,new.blueprint_id) then
  raise exception 'exam_reference_forbidden' using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  if exists(select 1 from public.exam_attempts where exam_id=old.id)
  and (new.family_id,new.child_id,new.question_ids,new.grade,new.subject,new.timed,new.duration_minutes)
  is distinct from (old.family_id,old.child_id,old.question_ids,old.grade,old.subject,old.timed,old.duration_minutes)
  then raise exception 'exam_already_started'; end if;
  if old.content_locked_at is not null then
   if (new.family_id,new.child_id,new.question_ids,new.grade,new.subject,new.timed,new.duration_minutes,new.kind,new.title)
   is distinct from (old.family_id,old.child_id,old.question_ids,old.grade,old.subject,old.timed,old.duration_minutes,old.kind,old.title)
   or new.status not in('assigned','completed') then
    if exists(select 1 from public.group_exam_entries where exam_id=old.id) then raise exception 'group_exam_locked'; end if;
    raise exception 'exam_content_locked';
   end if;
   -- The caller cannot clear or forge the lock timestamp.
   new.content_locked_at:=old.content_locked_at;
  else new.content_locked_at:=null;
  end if;
 else new.content_locked_at:=null;
 end if;
 if new.status in('assigned','completed') then new.content_locked_at:=coalesce(new.content_locked_at,now()); end if;
 return new;
end; $$;

create or replace function gina.guard_used_question() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.family_id is not null and not exists(select 1 from public.families where id=old.family_id) then return old; end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.exams where question_ids @> array[old.id]) then raise exception 'question_in_use'; end if;
  return old;
 end if;
 -- Counters, timestamps and nullable author bookkeeping remain writable.
 if (to_jsonb(new)-array['times_asked','updated_at','created_by'])
 is distinct from (to_jsonb(old)-array['times_asked','updated_at','created_by'])
 and exists(select 1 from public.exams e where e.question_ids @> array[old.id]
   and (e.content_locked_at is not null or exists(select 1 from public.exam_attempts where exam_id=e.id)))
 then raise exception 'question_in_use'; end if;
 return new;
end; $$;

-- Apply to direct service writes as well as the parent attachment RPC. The row
-- lock closes the race with concurrent assignment, rather than just checking it.
create function gina.guard_assigned_question_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; q public.question_bank;
begin
 if tg_op='INSERT' then ids:=array[new.question_id];
 elsif tg_op='DELETE' then ids:=array[old.question_id];
 else ids:=array[old.question_id,new.question_id]; end if;
 for q in select * from public.question_bank where id=any(ids) order by id for update loop
  if q.family_id is not null and not exists(select 1 from public.families where id=q.family_id) then continue; end if;
  if exists(select 1 from public.exams where question_ids @> array[q.id] and content_locked_at is not null)
  then raise exception 'question_in_use'; end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function gina.guard_assigned_question_media() from public,anon,authenticated;
create trigger assigned_question_media_guard before insert or update or delete on public.learning_source_links
for each row execute function gina.guard_assigned_question_media();

-- Verified bytes/dimensions/path cannot be replaced under the same source ID.
-- Delete remains an explicit, audited operation governed by reference guards.
create function gina.guard_verified_source() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='ready' and (new.id,new.family_id,new.kind,new.mime,new.bytes,new.sha256,new.object_path,new.status,new.width,new.height,new.pages)
 is distinct from (old.id,old.family_id,old.kind,old.mime,old.bytes,old.sha256,old.object_path,old.status,old.width,old.height,old.pages)
 then raise exception 'source_version_immutable'; end if;
 return new;
end; $$;
revoke all on function gina.guard_verified_source() from public,anon,authenticated;
create trigger verified_source_guard before update on public.learning_sources for each row execute function gina.guard_verified_source();
