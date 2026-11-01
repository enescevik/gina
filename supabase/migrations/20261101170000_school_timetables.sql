-- Weekly school plans are edited atomically; other family events remain parent-only.
create table public.school_timetables (
 child_id uuid primary key references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision integer not null default 0,
 lessons jsonb not null default '[]',
 settings jsonb not null default '{"start":"09:00","duration":40,"break":10}',
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.school_timetables enable row level security;
revoke all on public.school_timetables from public, anon, authenticated;
grant select on public.school_timetables to authenticated;
grant all on public.school_timetables to service_role;
create policy school_timetables_read on public.school_timetables for select to authenticated
 using (family_id=gina.family_id() and (gina.is_parent() or (gina.is_device() and child_id=gina.child_id())));

alter table public.events add column timetable_entry_key text;
create unique index events_timetable_entry on public.events(child_id,timetable_entry_key);

create function public.save_school_timetable(p_child_id uuid,p_revision integer,p_lessons jsonb,p_settings jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare
 f uuid; tz text; current_revision integer; entry jsonb; dow integer;
 start_time time; end_time time; monday date; keys text[] := '{}';
begin
 if auth.uid() is null or (gina.is_parent() or (gina.is_device() and p_child_id=gina.child_id())) is not true then
  raise exception 'timetable_forbidden';
 end if;
 -- Serializes initial creation as well as concurrent edits, including child deletion.
 select c.family_id into f from public.children c
 where c.id=p_child_id and c.family_id=gina.family_id() for update;
 if f is null then raise exception 'timetable_forbidden'; end if;
 select coalesce(revision,0) into current_revision from public.school_timetables where child_id=p_child_id;
 current_revision := coalesce(current_revision,0);
 if p_revision is distinct from current_revision then raise exception 'timetable_conflict'; end if;
 if p_lessons is null or jsonb_typeof(p_lessons) <> 'array' then raise exception 'timetable_invalid'; end if;
 if jsonb_array_length(p_lessons)>112 then raise exception 'timetable_invalid'; end if;
 if p_settings is null or jsonb_typeof(p_settings)<>'object'
   or coalesce(p_settings->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or coalesce(p_settings->>'duration','') !~ '^[0-9]{1,3}$'
   or coalesce(p_settings->>'break','') !~ '^[0-9]{1,3}$' then raise exception 'timetable_invalid'; end if;
 if (p_settings->>'duration')::int not between 5 and 180 or (p_settings->>'break')::int not between 0 and 120 then raise exception 'timetable_invalid'; end if;
 for entry in select value from jsonb_array_elements(p_lessons) loop
  if jsonb_typeof(entry)<>'object' or coalesce(entry->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$'
    or coalesce(entry->>'day','') !~ '^[1-7]$'
    or char_length(btrim(coalesce(entry->>'title',''))) not between 1 and 120
    or coalesce(entry->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(entry->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then raise exception 'timetable_invalid'; end if;
  if entry->>'id'=any(keys) then raise exception 'timetable_invalid'; end if;
  keys := array_append(keys,entry->>'id');
  if (entry->>'end')::time <= (entry->>'start')::time then raise exception 'timetable_invalid'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_lessons) a, jsonb_array_elements(p_lessons) b
  where a->>'id'<b->>'id' and a->>'day'=b->>'day'
    and a->>'start'<b->>'end' and b->>'start'<a->>'end') then raise exception 'timetable_overlap'; end if;
 select timezone into tz from public.families where id=f;
 monday := date_trunc('week',now() at time zone tz)::date;
 insert into public.school_timetables(child_id,family_id,revision,lessons,settings,updated_by)
 values(p_child_id,f,current_revision+1,p_lessons,p_settings,auth.uid())
 on conflict(child_id) do update set revision=excluded.revision,lessons=excluded.lessons,
 settings=excluded.settings,updated_at=now(),updated_by=auth.uid();
 -- Only timetable-owned rows are reconciled. Existing manually entered lessons/events are untouched.
 delete from public.events where child_id=p_child_id and family_id=f and timetable_entry_key is not null
   and not (timetable_entry_key=any(keys));
 for entry in select value from jsonb_array_elements(p_lessons) loop
  dow := (entry->>'day')::int; start_time := (entry->>'start')::time; end_time := (entry->>'end')::time;
  insert into public.events(family_id,child_id,type,title,starts_at,ends_at,rrule,visible_to_child,created_by,timetable_entry_key)
  values(f,p_child_id,'school',btrim(entry->>'title'),(monday+dow-1+start_time) at time zone tz,
    (monday+dow-1+end_time) at time zone tz,'FREQ=WEEKLY;BYDAY='||(array['MO','TU','WE','TH','FR','SA','SU'])[dow],true,auth.uid(),entry->>'id')
  on conflict(child_id,timetable_entry_key) do update set title=excluded.title,starts_at=excluded.starts_at,
    ends_at=excluded.ends_at,rrule=excluded.rrule;
 end loop;
 return current_revision+1;
end;
$$;
revoke all on function public.save_school_timetable(uuid,integer,jsonb,jsonb) from public, anon;
grant execute on function public.save_school_timetable(uuid,integer,jsonb,jsonb) to authenticated;
alter publication supabase_realtime add table public.school_timetables;
