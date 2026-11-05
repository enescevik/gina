-- Calendars describe schools; dated education records describe a child. A term is
-- never a grade promotion. Parent reports are private evidence, not publications.
create table gina.education_places (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in('country','region','school')),
 parent_id uuid references gina.education_places(id), name text not null check(length(trim(name)) between 2 and 120),
 revision int not null default 1, active boolean not null default true,
 check((kind='country')=(parent_id is null))
);
create unique index education_place_name on gina.education_places(coalesce(parent_id,'00000000-0000-0000-0000-000000000000'),lower(name));
insert into gina.education_places(id,kind,name) values('ec000000-0000-4000-8000-000000000001','country','Türkiye');
create table gina.education_calendars (
 id uuid primary key default gen_random_uuid(), place_id uuid not null references gina.education_places(id),
 stage text not null check(stage in('preschool','primary','middle','high','university')),
 academic_year int not null check(academic_year between 2000 and 2100),
 draft jsonb not null, published jsonb, revision int not null default 1, published_revision int,
 published_at timestamptz, updated_at timestamptz not null default now(),
 unique(place_id,stage,academic_year)
);
create table gina.child_education_locations (
 child_id uuid primary key references public.children(id) on delete cascade,
 place_id uuid not null references gina.education_places(id),
 stage text not null check(stage in('preschool','primary','middle','high','university')),
 updated_at timestamptz not null default now()
);
create table gina.education_calendar_reports (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, place_id uuid not null references gina.education_places(id),
 calendar_id uuid references gina.education_calendars(id), academic_year int not null, stage text not null,
 proposed_start date not null, reason text not null check(reason in('school_calendar','personal','correction','calendar_missing')),
 detail text not null, status text not null default 'open' check(status in('open','verified','dismissed')),
 revision int not null default 1, review_note text, reviewed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index education_calendar_report_queue on gina.education_calendar_reports(status,created_at desc);
create index child_education_place on gina.child_education_locations(place_id,stage);
revoke all on gina.education_places,gina.education_calendars,gina.child_education_locations,gina.education_calendar_reports from public,anon,authenticated,service_role;
alter table gina.education_places enable row level security;
alter table gina.education_calendars enable row level security;
alter table gina.child_education_locations enable row level security;
alter table gina.education_calendar_reports enable row level security;

create function gina.education_ancestors(p_place uuid) returns table(id uuid,depth int) language sql stable security definer set search_path='' as $$
 with recursive path as (
 select id,parent_id,0 depth from gina.education_places where id=p_place and active
 union all select p.id,p.parent_id,a.depth+1 from gina.education_places p join path a on a.parent_id=p.id where p.active and a.depth<5
 ) select id,depth from path;
$$;
create function gina.education_calendar_match(p_place uuid,p_stage text,p_year int) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'revision',c.published_revision,'place_id',c.place_id,'place_name',p.name,'stage',c.stage,'academic_year',c.academic_year,'value',c.published)
 from gina.education_calendars c join gina.education_ancestors(p_place) a on a.id=c.place_id join gina.education_places p on p.id=c.place_id
 where c.stage=p_stage and c.academic_year=p_year and c.published is not null order by a.depth limit 1;
$$;
create function gina.education_calendar_warning(p_match jsonb,p_action text,p_date date) returns text language sql immutable set search_path='' as $$
 select case when p_match is null then 'calendar_missing'
 when p_date<(p_match->'value'->>'starts_on')::date or p_date>(p_match->'value'->>'ends_on')::date then 'outside_year'
 when not exists(select 1 from jsonb_array_elements(p_match->'value'->'terms') t where p_date between (t->>'starts_on')::date and (t->>'ends_on')::date) then 'outside_term'
 when p_action='new_year' and p_date>(p_match->'value'->>'starts_on')::date+14 then 'outside_transition'
 else null end;
$$;
create function gina.validate_education_calendar(v jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; first_day date;last_day date;previous_end date;begin
 if jsonb_typeof(v) is distinct from 'object' or v - array['title','source_url','verified_on','starts_on','ends_on','terms'] <> '{}'::jsonb or length(trim(coalesce(v->>'title',''))) not between 3 and 160
 or coalesce(v->>'source_url','') !~ '^https://[^[:space:]]+$' or length(v->>'source_url')>1000
 or coalesce(v->>'starts_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v->>'ends_on','') !~ '^\d{4}-\d{2}-\d{2}$'
 or coalesce(v->>'verified_on','') !~ '^\d{4}-\d{2}-\d{2}$'
 or jsonb_typeof(v->'terms') is distinct from 'array' or jsonb_array_length(v->'terms') not between 1 and 8 then raise exception 'calendar_invalid';end if;
 first_day:=(v->>'starts_on')::date;last_day:=(v->>'ends_on')::date;
 if last_day<=first_day or last_day-first_day>550 or (v->>'verified_on')::date>current_date then raise exception 'calendar_invalid';end if;
 for item in select value from jsonb_array_elements(v->'terms') loop
  if item - array['title','starts_on','ends_on'] <> '{}'::jsonb or length(trim(coalesce(item->>'title',''))) not between 2 and 80
  or coalesce(item->>'starts_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'ends_on','') !~ '^\d{4}-\d{2}-\d{2}$'
  or (item->>'starts_on')::date<first_day or (item->>'ends_on')::date>last_day
  or (item->>'ends_on')::date<(item->>'starts_on')::date
  or (previous_end is not null and (item->>'starts_on')::date<=previous_end) then raise exception 'calendar_invalid';end if;
  previous_end:=(item->>'ends_on')::date;
 end loop;
end;$$;

create function public.education_calendar_catalog(p_child_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (gina.has_operation_role('content') or (gina.is_parent() and (p_child_id is null or exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id())))) then raise exception 'education_forbidden' using errcode='42501';end if;
 return jsonb_build_object('places',(select coalesce(jsonb_agg(to_jsonb(p) order by kind,name,id),'[]') from gina.education_places p where active),
 'location',(select to_jsonb(l) from gina.child_education_locations l where child_id=p_child_id and exists(select 1 from public.children c where c.id=l.child_id and c.family_id=gina.family_id())));
end;$$;
create function public.preview_education_calendar(p_child_id uuid,p_place_id uuid,p_stage text,p_academic_year int,p_action text,p_starts_on date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare matched jsonb;begin
 if not gina.is_parent() or not exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id()) then raise exception 'education_forbidden' using errcode='42501';end if;
 if p_stage is null or p_stage not in('preschool','primary','middle','high','university') or not exists(select 1 from gina.education_places where id=p_place_id and active) then raise exception 'calendar_invalid';end if;
 matched:=gina.education_calendar_match(p_place_id,p_stage,p_academic_year);
 return jsonb_build_object('calendar',matched,'warning',gina.education_calendar_warning(matched,p_action,p_starts_on));
end;$$;

create function public.admin_education_calendars() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('places',(select coalesce(jsonb_agg(to_jsonb(p) order by kind,name,id),'[]') from gina.education_places p),
 'calendars',(select coalesce(jsonb_agg(to_jsonb(c) order by academic_year desc,updated_at desc),'[]') from gina.education_calendars c),
 'reports',(select coalesce(jsonb_agg(to_jsonb(r) - 'actor_id' - 'child_id' - 'family_id' order by created_at desc),'[]') from(select * from gina.education_calendar_reports where reason='school_calendar' and status='open' order by created_at,id limit 100)r),
 'open_reports',(select count(*) from gina.education_calendar_reports where reason='school_calendar' and status='open'));
end;$$;
create function public.admin_save_education_place(p_request uuid,p_id uuid,p_revision int,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;old gina.education_places;parent gina.education_places;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.place','id',p_id,'revision',p_revision,'value',p_value);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_id is null or p_revision is null or length(trim(coalesce(p_value->>'name',''))) not between 2 and 120 or p_value->>'kind' is null or p_value->>'kind' not in('country','region','school') or jsonb_typeof(p_value->'active') is distinct from 'boolean' then raise exception 'calendar_invalid';end if;
 perform pg_advisory_xact_lock(608005);
 perform pg_advisory_xact_lock(hashtextextended('education.place:'||p_id::text,0));
 select * into old from gina.education_places where id=p_id for update;
 if coalesce(old.revision,0)<>p_revision then raise exception 'calendar_changed';end if;
 if old.id is not null and (old.kind is distinct from p_value->>'kind' or old.parent_id is distinct from (p_value->>'parent_id')::uuid) then raise exception 'calendar_scope_immutable';end if;
 if p_value->>'kind'<>'country' then
  select * into parent from gina.education_places where id=(p_value->>'parent_id')::uuid and active;
  if parent.id is null or parent.kind='school' or parent.id=p_id or (select max(depth) from gina.education_ancestors(parent.id))>=3 then raise exception 'calendar_invalid';end if;
 elsif p_value->>'parent_id' is not null then raise exception 'calendar_invalid';end if;
 -- A used location cannot be hidden out from under its schools and families.
 if not (p_value->>'active')::boolean and (exists(select 1 from gina.education_places where parent_id=p_id and active) or exists(select 1 from gina.child_education_locations where place_id=p_id) or exists(select 1 from gina.education_calendars where place_id=p_id and published is not null)) then raise exception 'calendar_place_in_use';end if;
 insert into gina.education_places(id,kind,parent_id,name,active) values(p_id,p_value->>'kind',(p_value->>'parent_id')::uuid,trim(p_value->>'name'),(p_value->>'active')::boolean)
 on conflict(id) do update set name=excluded.name,active=excluded.active,revision=education_places.revision+1;
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.place','education_places',p_id::text,payload);
 return result;
end;$$;
create function public.admin_save_education_calendar(p_request uuid,p_id uuid,p_revision int,p_place_id uuid,p_stage text,p_academic_year int,p_value jsonb,p_publish boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;old gina.education_calendars;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.calendar','id',p_id,'revision',p_revision,'place',p_place_id,'stage',p_stage,'year',p_academic_year,'value',p_value,'publish',p_publish);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_id is null or p_revision is null or p_stage is null or p_stage not in('preschool','primary','middle','high','university') or p_academic_year is null or p_academic_year not between 2000 and 2100 or p_publish is null or not exists(select 1 from gina.education_places where id=p_place_id and active) then raise exception 'calendar_invalid';end if;
 perform gina.validate_education_calendar(p_value);
 if extract(year from (p_value->>'starts_on')::date)::int<>p_academic_year then raise exception 'calendar_invalid';end if;
 -- Serializes publish with parent preview/save and reminder resolution.
 perform pg_advisory_xact_lock(608005);
 select * into old from gina.education_calendars where id=p_id for update;
 if coalesce(old.revision,0)<>p_revision then raise exception 'calendar_changed';end if;
 if old.id is not null and (old.place_id<>p_place_id or old.stage<>p_stage or old.academic_year<>p_academic_year) then raise exception 'calendar_scope_immutable';end if;
 -- Publishing is a separate operation on an already saved, unchanged draft.
 if p_publish and (old.id is null or old.draft<>p_value) then raise exception 'calendar_save_first';end if;
 insert into gina.education_calendars(id,place_id,stage,academic_year,draft) values(p_id,p_place_id,p_stage,p_academic_year,p_value)
 on conflict(id) do update set draft=excluded.draft,revision=education_calendars.revision+1,updated_at=now();
 if p_publish then update gina.education_calendars set published=draft,published_revision=revision,published_at=now() where id=p_id;end if;
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1,'published',p_publish);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),case when p_publish then 'education.calendar.publish' else 'education.calendar.draft' end,'education_calendars',p_id::text,payload);
 return result;
end;$$;
create function public.admin_review_education_report(p_request uuid,p_id uuid,p_revision int,p_status text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;r gina.education_calendar_reports;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.report.review','id',p_id,'revision',p_revision,'status',p_status,'note',p_note);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_status is null or p_status not in('verified','dismissed') or length(trim(coalesce(p_note,''))) not between 10 and 2000 then raise exception 'calendar_invalid';end if;
 select * into r from gina.education_calendar_reports where id=p_id and reason='school_calendar' for update;
 if not found or r.revision is distinct from p_revision or r.status<>'open' then raise exception 'calendar_changed';end if;
 update gina.education_calendar_reports set status=p_status,review_note=trim(p_note),revision=revision+1,reviewed_by=auth.uid() where id=p_id;
 result:=jsonb_build_object('id',p_id,'status',p_status);
 perform gina.save_help_receipt(p_request,payload,result,r.family_id);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.report.review','education_calendar_reports',p_id::text,payload);
 return result;
end;$$;

-- Retain the original transaction and its CAS/history guarantees behind a private
-- function. Old clients still work until a child has a managed calendar location.
alter function public.change_child_education(uuid,uuid,int,text,int,int,text,date,int,boolean) set schema gina;
revoke all on function gina.change_child_education(uuid,uuid,int,text,int,int,text,date,int,boolean) from public,anon,authenticated,service_role;
create function public.change_child_education(p_request_id uuid,p_child_id uuid,p_revision int,p_action text,p_academic_year int,p_grade int,p_school text,p_starts_on date,p_timetable_revision int,p_keep_timetable boolean) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not gina.is_parent() or not exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id()) then raise exception 'education_forbidden' using errcode='42501';end if;
 perform 1 from public.children where id=p_child_id for update;
 if exists(select 1 from gina.child_education_locations where child_id=p_child_id) then raise exception 'calendar_review_required';end if;
 return gina.change_child_education(p_request_id,p_child_id,p_revision,p_action,p_academic_year,p_grade,p_school,p_starts_on,p_timetable_revision,p_keep_timetable);
end;$$;
create function public.change_child_education_with_calendar(p_request_id uuid,p_child_id uuid,p_revision int,p_action text,p_academic_year int,p_grade int,p_school text,p_starts_on date,p_timetable_revision int,p_keep_timetable boolean,p_place_id uuid,p_stage text,p_calendar_id uuid,p_calendar_revision int,p_reason text,p_detail text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;matched jsonb;warning text;place gina.education_places;expected_stage text;begin
 if not gina.is_parent() or not exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id()) then raise exception 'education_forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.calendar.change','child',p_child_id,'revision',p_revision,'kind',p_action,'year',p_academic_year,'grade',p_grade,'school',p_school,'date',p_starts_on,'timetableRevision',p_timetable_revision,'keep',p_keep_timetable,'place',p_place_id,'stage',p_stage,'calendar',p_calendar_id,'calendarRevision',p_calendar_revision,'reason',p_reason,'detail',p_detail);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock_shared(608005);
 select * into place from gina.education_places where id=p_place_id and active;
 if place.id is null or p_stage is null or p_stage not in('preschool','primary','middle','high','university') then raise exception 'calendar_invalid';end if;
 expected_stage:=case when p_grade=0 then 'preschool' when p_grade between 1 and 4 then 'primary' when p_grade between 5 and 8 then 'middle' when p_grade between 9 and 12 then 'high' else null end;
 if expected_stage is not null and expected_stage<>p_stage then raise exception 'calendar_grade_mismatch';end if;
 if place.kind='school' and trim(coalesce(p_school,''))<>place.name then raise exception 'calendar_school_mismatch';end if;
 matched:=gina.education_calendar_match(p_place_id,p_stage,p_academic_year);
 if (matched->>'id')::uuid is distinct from p_calendar_id or (matched->>'revision')::int is distinct from p_calendar_revision then raise exception 'calendar_changed';end if;
 warning:=gina.education_calendar_warning(matched,p_action,p_starts_on);
 if warning is not null and (p_reason is null or p_reason not in('school_calendar','personal','correction','calendar_missing')) then raise exception 'calendar_reason_required';end if;
 if p_reason is not null and p_reason not in('school_calendar','personal','correction','calendar_missing') then raise exception 'calendar_invalid';end if;
 if length(coalesce(p_detail,''))>2000 or (p_reason='school_calendar' and length(trim(coalesce(p_detail,'')))<10) then raise exception 'calendar_detail_required';end if;
 -- The inner receipt is separate and unreachable by clients. Outer receipt keeps
 -- calendar selection, reason and report atomic and prevents replay duplication.
 result:=gina.change_child_education(gen_random_uuid(),p_child_id,p_revision,p_action,p_academic_year,p_grade,p_school,p_starts_on,p_timetable_revision,p_keep_timetable);
 insert into gina.child_education_locations(child_id,place_id,stage) values(p_child_id,p_place_id,p_stage)
 on conflict(child_id) do update set place_id=excluded.place_id,stage=excluded.stage,updated_at=now();
 if p_reason is not null then
  insert into gina.education_calendar_reports(child_id,family_id,actor_id,place_id,calendar_id,academic_year,stage,proposed_start,reason,detail)
  values(p_child_id,gina.family_id(),auth.uid(),p_place_id,p_calendar_id,p_academic_year,p_stage,p_starts_on,p_reason,coalesce(trim(p_detail),''));
 end if;
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;

revoke all on function gina.education_ancestors(uuid),gina.education_calendar_match(uuid,text,int),gina.education_calendar_warning(jsonb,text,date),gina.validate_education_calendar(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.education_calendar_catalog(uuid),public.preview_education_calendar(uuid,uuid,text,int,text,date),public.admin_education_calendars(),public.admin_save_education_place(uuid,uuid,int,jsonb),public.admin_save_education_calendar(uuid,uuid,int,uuid,text,int,jsonb,boolean),public.admin_review_education_report(uuid,uuid,int,text,text),public.change_child_education(uuid,uuid,int,text,int,int,text,date,int,boolean),public.change_child_education_with_calendar(uuid,uuid,int,text,int,int,text,date,int,boolean,uuid,text,uuid,int,text,text) from public,anon,service_role;
grant execute on function public.education_calendar_catalog(uuid),public.preview_education_calendar(uuid,uuid,text,int,text,date),public.admin_education_calendars(),public.admin_save_education_place(uuid,uuid,int,jsonb),public.admin_save_education_calendar(uuid,uuid,int,uuid,text,int,jsonb,boolean),public.admin_review_education_report(uuid,uuid,int,text,text),public.change_child_education(uuid,uuid,int,text,int,int,text,date,int,boolean),public.change_child_education_with_calendar(uuid,uuid,int,text,int,int,text,date,int,boolean,uuid,text,uuid,int,text,text) to authenticated;
