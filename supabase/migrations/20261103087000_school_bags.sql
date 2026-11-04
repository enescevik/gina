-- Family-owned daily packing lists, separate from rewards or task completion.
create table gina.school_bags (
 child_id uuid not null references public.children(id) on delete cascade,
 day date not null check(isfinite(day)),
 revision integer not null check(revision>0),
 program_revision integer not null check(program_revision>=0),
 lessons_snapshot jsonb not null check(jsonb_typeof(lessons_snapshot)='array'),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=30),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(child_id,day)
);
alter table gina.school_bags enable row level security;
revoke all on gina.school_bags from public,anon,authenticated,service_role;
create function gina.school_bag_access(p_child uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare tz text;begin
 if auth.uid() is null or gina.family_id() is null or
  (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child)) is not true
 then raise exception 'bag_forbidden' using errcode='42501';end if;
 select f.timezone into tz from public.children c join public.families f on f.id=c.family_id where c.id=p_child and c.family_id=gina.family_id();
 if tz is null then raise exception 'bag_forbidden' using errcode='42501';end if;
 return tz;
end;$$;
revoke all on function gina.school_bag_access(uuid) from public,anon,authenticated,service_role;
create function public.get_school_bag(p_child_id uuid,p_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text:=gina.school_bag_access(p_child_id);today date;program public.school_timetables;bag gina.school_bags;begin
 today:=(now() at time zone tz)::date;
 if p_day is null or not isfinite(p_day) or p_day<today-30 or p_day>today+7 then raise exception 'bag_date';end if;
 select * into program from public.school_timetables where child_id=p_child_id;
 select * into bag from gina.school_bags where child_id=p_child_id and day=p_day;
 return jsonb_build_object('child_id',p_child_id,'day',p_day,'today',today,'timezone',tz,'editable',p_day>=today,
  'revision',coalesce(bag.revision,0),'program_revision',case when p_day<today then coalesce(bag.program_revision,0) else coalesce(program.revision,0) end,'saved_program_revision',bag.program_revision,
  'items',coalesce(bag.items,'[]'),
  'lessons',case when p_day<today then coalesce(bag.lessons_snapshot,'[]') else (select coalesce(jsonb_agg(jsonb_build_object('id',l->>'id','title',l->>'title','start',l->>'start','end',l->>'end') order by l->>'start'),'[]')
   from jsonb_array_elements(coalesce(program.lessons,'[]'))l where (l->>'day')::int=extract(isodow from p_day)::int) end);
end;$$;
create function public.save_school_bag(p_request_id uuid,p_child_id uuid,p_day date,p_revision integer,p_program_revision integer,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text:=gina.school_bag_access(p_child_id);today date;payload jsonb;result jsonb;revision integer;program_revision integer;item jsonb;begin
 if p_day is null or not isfinite(p_day) or p_revision is null or p_revision<0 or p_program_revision is null or p_program_revision<0
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'bag_invalid';end if;
 if jsonb_array_length(p_items)>30 or octet_length(p_items::text)>15000 then raise exception 'bag_invalid';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['id','label','checked']) or item-array['id','label','checked']<>'{}'::jsonb
  or jsonb_typeof(item->'id')<>'string' or item->>'id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(item->'label')<>'string' or length(trim(item->>'label')) not between 1 and 80 or trim(item->>'label')<>item->>'label'
  or jsonb_typeof(item->'checked')<>'boolean' then raise exception 'bag_invalid';end if;
 end loop;
 if (select count(distinct i->>'id') from jsonb_array_elements(p_items)i)<>jsonb_array_length(p_items)
 or (select count(distinct i->>'label') from jsonb_array_elements(p_items)i)<>jsonb_array_length(p_items) then raise exception 'bag_invalid';end if;
 payload:=jsonb_build_object('action','school.bag','child',p_child_id,'day',p_day,'revision',p_revision,'program',p_program_revision,'items',p_items);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 -- Same lock as timetable saves: no stale program acknowledgement between check and write.
 perform 1 from public.children where id=p_child_id and family_id=gina.family_id() for update;
 if not found then raise exception 'bag_forbidden' using errcode='42501';end if;
 today:=(now() at time zone tz)::date;
 if p_day<today or p_day>today+7 then raise exception 'bag_date';end if;
 select coalesce((select t.revision from public.school_timetables t where t.child_id=p_child_id),0) into program_revision;
 if p_program_revision<>program_revision then raise exception 'bag_program_changed';end if;
 select coalesce((select b.revision from gina.school_bags b where b.child_id=p_child_id and b.day=p_day),0) into revision;
 if p_revision<>revision then raise exception 'bag_changed';end if;
 insert into gina.school_bags(child_id,day,revision,program_revision,items,lessons_snapshot,updated_by)
 values(p_child_id,p_day,revision+1,program_revision,p_items,public.get_school_bag(p_child_id,p_day)->'lessons',auth.uid())
 on conflict(child_id,day) do update set revision=excluded.revision,program_revision=excluded.program_revision,items=excluded.items,lessons_snapshot=excluded.lessons_snapshot,updated_by=excluded.updated_by,updated_at=now();
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'day',p_day,'revision',revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;
revoke all on function public.get_school_bag(uuid,date),public.save_school_bag(uuid,uuid,date,integer,integer,jsonb) from public,anon,service_role;
grant execute on function public.get_school_bag(uuid,date),public.save_school_bag(uuid,uuid,date,integer,integer,jsonb) to authenticated;
