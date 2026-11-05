-- Child identity and earned progress survive education transitions.
-- Historical dates are never inferred for existing children or existing exams.
create table gina.child_education_state (
 child_id uuid primary key references public.children(id) on delete cascade,
 revision integer not null default 0 check(revision>=0)
);
create table gina.child_education_periods (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 academic_year integer not null check(academic_year between 2000 and 2100),
 grade smallint check(grade between 0 and 12), school text check(length(school)<=120),
 starts_on date not null, ends_on date,
 reason text not null check(reason in('initial','new_year','transfer')),
 timetable_snapshot jsonb,
 created_at timestamptz not null default now(),
 check(ends_on is null or ends_on>starts_on)
);
create unique index child_education_current on gina.child_education_periods(child_id) where ends_on is null;
create index child_education_history on gina.child_education_periods(child_id,starts_on desc);
create table gina.child_education_changes (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 action text not null, before_value jsonb, after_value jsonb not null,
 actor uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
revoke all on gina.child_education_state,gina.child_education_periods,gina.child_education_changes from public,anon,authenticated;

create function public.get_child_education(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();result jsonb;
begin
 if auth.uid() is null or gina.is_parent() is not true or f is null
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'education_forbidden' using errcode='42501';end if;
 select jsonb_build_object(
  'revision',coalesce((select revision from gina.child_education_state where child_id=p_child_id),0),
  'today',(now() at time zone fa.timezone)::date,
  'current',(select to_jsonb(e) from gina.child_education_periods e where child_id=p_child_id and ends_on is null),
  'history',coalesce((select jsonb_agg(to_jsonb(e) order by starts_on desc,id) from gina.child_education_periods e where child_id=p_child_id and ends_on is not null),'[]'),
  'corrections',coalesce((select jsonb_agg(jsonb_build_object('before',before_value,'after',after_value,'at',created_at) order by created_at desc,id) from gina.child_education_changes where child_id=p_child_id and action='correct'),'[]'),
  'timetable',coalesce((select jsonb_build_object('revision',revision,'lessons',lessons,'settings',settings) from public.school_timetables where child_id=p_child_id),'{"revision":0,"lessons":[],"settings":{"start":"09:00","duration":40,"break":10}}'::jsonb)
 ) into result from public.families fa where fa.id=f;
 return result;
end;$$;

create function public.change_child_education(
 p_request_id uuid,p_child_id uuid,p_revision integer,p_action text,
 p_academic_year integer,p_grade integer,p_school text,p_starts_on date,
 p_timetable_revision integer,p_keep_timetable boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();ch public.children;old gina.child_education_periods;
 v_revision integer;payload jsonb;result jsonb;program jsonb;today date;v_id uuid;v_school text:=nullif(btrim(p_school),'');
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true then raise exception 'education_forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_action is null or p_action not in('initial','new_year','transfer','correct')
 or p_academic_year is null or p_academic_year not between 2000 and 2100
 or (p_grade is not null and p_grade not between 0 and 12) or length(v_school)>120
 or p_starts_on is null or p_timetable_revision is null or p_timetable_revision<0 or p_keep_timetable is null
 then raise exception 'education_invalid';end if;
 if not exists(select 1 from public.children where id=p_child_id and family_id=f) then raise exception 'education_forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.change','family',f,'child',p_child_id,'revision',p_revision,'kind',p_action,
 'year',p_academic_year,'grade',p_grade,'school',v_school,'starts',p_starts_on,'timetableRevision',p_timetable_revision,'keep',p_keep_timetable);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 select * into ch from public.children where id=p_child_id and family_id=f for update;
 if not found then raise exception 'education_forbidden' using errcode='42501';end if;
 select (now() at time zone timezone)::date into today from public.families where id=f;
 -- Immediate changes only. Scheduling a future change needs a separate workflow.
 if p_starts_on>today or extract(year from p_starts_on)::int not between p_academic_year and p_academic_year+1
 then raise exception 'education_date';end if;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 select s.revision into v_revision from gina.child_education_state s where child_id=p_child_id;
 if v_revision<>p_revision then raise exception 'education_changed';end if;
 select * into old from gina.child_education_periods where child_id=p_child_id and ends_on is null;
 if (old.id is null and p_action<>'initial') or (old.id is not null and p_action='initial') then raise exception 'education_changed';end if;
 program:=public.get_child_education(p_child_id)->'timetable';
 if (program->>'revision')::integer<>p_timetable_revision then raise exception 'timetable_conflict';end if;
 if p_action='new_year' and (p_academic_year<=old.academic_year or p_starts_on<=old.starts_on) then raise exception 'education_date';end if;
 if p_action='transfer' and (p_academic_year<>old.academic_year or p_grade is distinct from old.grade
  or v_school is null or v_school is not distinct from old.school or p_starts_on<=old.starts_on) then raise exception 'education_transfer';end if;
 if p_action='initial' and not p_keep_timetable then raise exception 'education_invalid';end if;
 if p_action='correct' then
  if not p_keep_timetable then raise exception 'education_invalid';end if;
  -- Correction is not a transition; preserve its boundary and existing evidence.
  if p_starts_on<>old.starts_on or p_academic_year<>old.academic_year then raise exception 'education_date';end if;
  update gina.child_education_periods set grade=p_grade,school=v_school where child_id=p_child_id and ends_on is null returning child_education_periods.id into v_id;
 else
  if old.id is not null then
   update gina.child_education_periods set ends_on=p_starts_on,timetable_snapshot=program where child_education_periods.id=old.id;
  end if;
  insert into gina.child_education_periods(child_id,family_id,academic_year,grade,school,starts_on,reason)
  values(p_child_id,f,p_academic_year,p_grade,v_school,p_starts_on,p_action) returning child_education_periods.id into v_id;
 end if;
 -- Grade projection remains compatible with existing AI and curriculum selection.
 update public.children set grade=p_grade where children.id=p_child_id;
 if not p_keep_timetable then
  perform public.save_school_timetable(p_child_id,p_timetable_revision,'[]',program->'settings');
 end if;
 update gina.child_education_state set revision=v_revision+1 where child_id=p_child_id;
 insert into gina.child_education_changes(child_id,family_id,action,before_value,after_value,actor)
 select p_child_id,f,p_action,case when old.id is null then jsonb_build_object('grade',ch.grade,'period','unknown','timetable',program) else to_jsonb(old) end,to_jsonb(e),auth.uid()
 from gina.child_education_periods e where e.id=v_id;
 result:=jsonb_build_object('child_id',p_child_id,'period_id',v_id,'revision',v_revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- Once a parent starts period management, old clients cannot silently bypass it.
create function gina.guard_child_education_grade() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.grade is distinct from old.grade and exists(select 1 from gina.child_education_periods where child_id=new.id and ends_on is null and grade is distinct from new.grade)
 then raise exception 'education_use_transition';end if;
 return new;
end;$$;
create trigger child_education_grade before update of grade on public.children for each row execute function gina.guard_child_education_grade();

-- New evidence freezes its education context. Existing evidence stays unknown.
alter table public.exams add column education_context jsonb;
alter table public.grades add column education_context jsonb;
create function gina.snapshot_education_context() returns trigger language plpgsql security definer set search_path='' as $$
declare day date;context jsonb;
begin
 if TG_OP='UPDATE' then
  -- An update cannot relabel old evidence under today's class.
  new.education_context:=old.education_context;return new;
 end if;
 if TG_TABLE_NAME='grades' then day:=new.graded_on;
 else select (now() at time zone f.timezone)::date into day from public.families f where f.id=new.family_id;end if;
 select jsonb_build_object('period_id',id,'academic_year',academic_year,'grade',grade,'school',school,'starts_on',starts_on)
 into context from gina.child_education_periods where child_id=new.child_id and family_id=new.family_id
 and starts_on<=day and (ends_on is null or day<ends_on) order by starts_on desc limit 1;
 new.education_context:=context;return new;
end;$$;
create trigger exams_education_context before insert or update on public.exams for each row execute function gina.snapshot_education_context();
create trigger grades_education_context before insert or update on public.grades for each row execute function gina.snapshot_education_context();
revoke all on function public.get_child_education(uuid) from public,anon,service_role;
revoke all on function public.change_child_education(uuid,uuid,integer,text,integer,integer,text,date,integer,boolean) from public,anon,service_role;
grant execute on function public.get_child_education(uuid) to authenticated;
grant execute on function public.change_child_education(uuid,uuid,integer,text,integer,integer,text,date,integer,boolean) to authenticated;

revoke all on function gina.guard_child_education_grade(),gina.snapshot_education_context() from public,anon,authenticated;
