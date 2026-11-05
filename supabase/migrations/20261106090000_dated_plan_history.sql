-- Dated plan history (L04). Every routine, timetable and learning-plan version records the
-- family-local day from which it applies (effective_from) and the day it became known
-- (known_since). Versions that predate this history keep effective_from null; nothing older
-- than the source is invented, a day before the first known version is reported as unknown.
-- Submitted work, earned stars and old exam/grade evidence are never touched.

create function gina.local_day(p_timezone text,p_at timestamptz default now()) returns date
language sql stable set search_path='' as $$ select (p_at at time zone coalesce(p_timezone,'UTC'))::date $$;
create function gina.family_today(p_family uuid) returns date language sql stable security definer set search_path='' as $$
 select (now() at time zone timezone)::date from public.families where id=p_family $$;
-- Parent choice: default today, never the past (past realizations do not change), at most a year ahead.
create function gina.plan_effective_from(p_family uuid,p_requested date) returns date
language plpgsql stable security definer set search_path='' as $$
declare today date:=gina.family_today(p_family);
begin
 if today is null then raise exception 'plan_forbidden' using errcode='42501';end if;
 if p_requested is null then return today;end if;
 if not isfinite(p_requested) or p_requested>today+365 then raise exception 'plan_effective_invalid';end if;
 if p_requested<today then raise exception 'plan_effective_past';end if;
 return p_requested;
end;$$;
-- The requested effective day travels from the RPC to the history triggers inside one transaction.
create function gina.requested_effective_from() returns date language sql stable set search_path='' as $$
 select nullif(current_setting('gina.plan_effective_from',true),'')::date $$;
revoke all on function gina.local_day(text,timestamptz),gina.family_today(uuid),gina.plan_effective_from(uuid,date),gina.requested_effective_from() from public,anon,authenticated,service_role;

-- Resolution shared by all three sources. p_versions: [{revision,value,effective_from,known_since}],
-- superseded versions already excluded. The version in effect on a day is the latest one whose
-- start (effective_from, else known_since) is not after that day. Earlier days are unknown.
create function gina.plan_version_on(p_versions jsonb,p_day date) returns jsonb
language sql immutable set search_path='' as $$
 with v as (
  select x,(x->>'revision')::int as rev,
   coalesce((x->>'effective_from')::date,(x->>'known_since')::date,'-infinity'::date) as eff,
   coalesce((x->>'effective_from')::date,(x->>'known_since')::date) as start
  from jsonb_array_elements(coalesce(p_versions,'[]'::jsonb)) x),
 known as (select * from v where eff<=p_day order by eff desc,rev desc limit 1),
 earliest as (select * from v order by eff,rev limit 1),
 next_known as (select min(start) as day from v where start is not null)
 select case
  when exists(select 1 from known) then
   (select x||jsonb_build_object('status',case when start is null then 'unknown_before' else 'known' end,
    'unknown_before',case when start is null then (select day from next_known) end) from known)
  when exists(select 1 from earliest) then
   (select x||jsonb_build_object('status','unknown_before','unknown_before',coalesce(start,(select day from next_known))) from earliest)
  else null end;
$$;
revoke all on function gina.plan_version_on(jsonb,date) from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Task routines: the existing change log becomes dated.
alter table gina.task_routine_changes add column effective_from date, add column known_since date, add column superseded_by integer;
-- Legacy versions applied immediately when recorded: known since that family-local day, start date unknown.
update gina.task_routine_changes c set known_since=gina.local_day(f.timezone,c.created_at) from public.families f where f.id=c.family_id;
-- Settings that were already in place when the log began: kept as "known at migration", no start day at all.
insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,created_at,effective_from,known_since)
select c.template_id,c.family_id,(c.before_value->>'revision')::int,'migration',null,c.before_value,null,c.created_at,null,null
from gina.task_routine_changes c
where c.before_value is not null and jsonb_typeof(c.before_value->'revision')='number'
and c.revision=(select min(x.revision) from gina.task_routine_changes x where x.template_id=c.template_id)
and not exists(select 1 from gina.task_routine_changes x where x.template_id=c.template_id and x.revision=(c.before_value->>'revision')::int);
-- Routines without any log: the current row is known as of this migration.
insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,effective_from,known_since)
select t.id,t.family_id,t.revision,'migration',null,to_jsonb(t),null,null,gina.local_day(f.timezone,now())
from public.task_templates t join public.families f on f.id=t.family_id
where not exists(select 1 from gina.task_routine_changes x where x.template_id=t.id);

create or replace function gina.task_routine_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare today date;eff date;act text;
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 select gina.local_day(timezone,now()) into today from public.families where id=new.family_id;
 act:=case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end;
 -- A new routine applies from its start day; a settings edit from the requested day (default today); state changes now.
 eff:=case when TG_OP='INSERT' then coalesce(gina.requested_effective_from(),new.effective_from,new.starts_on)
  when act='save' then coalesce(gina.requested_effective_from(),today) else today end;
 -- A newer version that starts earlier replaces any still-pending later-dated version.
 update gina.task_routine_changes set superseded_by=new.revision where template_id=new.id and superseded_by is null and effective_from is not null and effective_from>eff;
 insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,effective_from,known_since)
 values(new.id,new.family_id,new.revision,act,case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid(),eff,today);
 insert into public.task_routine_sync(child_id,family_id) values(new.child_id,new.family_id) on conflict(child_id) do update set revision=public.task_routine_sync.revision+1;
 return new;
end;$$;

create function gina.task_routine_versions(p_template uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'action',action,'value',after_value,'effective_from',effective_from,'known_since',known_since) order by revision),'[]')
 from gina.task_routine_changes where template_id=p_template and superseded_by is null $$;
create function gina.task_routine_version_on(p_template uuid,p_day date) returns jsonb language sql stable security definer set search_path='' as $$
 select gina.plan_version_on(gina.task_routine_versions(p_template),p_day) $$;
revoke all on function gina.task_routine_versions(uuid),gina.task_routine_version_on(uuid,date) from public,anon,authenticated,service_role;

-- A submission freezes the version in effect on its day. A change scheduled for a later day
-- must not leak into today's work; an immediate edit keeps its existing behaviour.
create or replace function gina.task_completion_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.task_templates;today date;v jsonb;
begin
 if TG_OP='UPDATE' and old.task_snapshot is not null then new.task_snapshot:=old.task_snapshot;return new;end if;
 select * into t from public.task_templates where id=new.template_id for share;
 if t.family_id is distinct from new.family_id or t.child_id is distinct from new.child_id then raise exception 'wrong_child';end if;
 select gina.local_day(timezone,now()) into today from public.families where id=t.family_id;
 if TG_OP='INSERT' and t.effective_from is not null and t.effective_from>greatest(new.due_date,today) then
  v:=gina.task_routine_version_on(t.id,new.due_date);
  if v->>'status'='known' then
   new.task_snapshot:=jsonb_build_object('title',v->'value'->>'title','icon',v->'value'->>'icon','stars',(v->'value'->>'stars')::int,'origin','submission');return new;
  end if;
 end if;
 new.task_snapshot:=jsonb_build_object('title',t.title,'icon',t.icon,'stars',t.stars,'origin',case when TG_OP='INSERT' then 'submission' else 'migration' end);return new;
end;$$;

create or replace function public.complete_task(
  p_template_id uuid,
  p_due_date date,
  p_client_id uuid,
  p_acting_child_id uuid default null
)
returns public.task_completions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_template public.task_templates%rowtype;
  v_child_id uuid;
  v_row public.task_completions%rowtype;
  v_receipt gina.task_submission_receipts%rowtype;
  v_today date;
  v_version jsonb;
begin
  if p_client_id is null or p_due_date is null or not isfinite(p_due_date) then
    raise exception 'invalid_completion' using errcode='P0001';
  end if;
  select * into v_template from public.task_templates where id = p_template_id;
  if v_template.id is null or v_template.family_id is distinct from gina.family_id() then
    raise exception 'template_not_found' using errcode = 'P0001';
  end if;

  if gina.is_device() then
    v_child_id := gina.child_id();
  elsif gina.is_parent() then
    v_child_id := p_acting_child_id;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_child_id is null or v_child_id <> v_template.child_id then
    raise exception 'wrong_child' using errcode = 'P0001';
  end if;
  perform gina.require_active_child(v_child_id);
  select * into v_template from public.task_templates where id=p_template_id for share;
  -- One immutable request identity, including after returned/resubmitted/undone work.
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,90));
  select * into v_receipt from gina.task_submission_receipts where client_id=p_client_id;
  if found then
    if v_receipt.family_id is distinct from v_template.family_id or v_receipt.child_id is distinct from v_child_id
      or v_receipt.template_id is distinct from p_template_id or v_receipt.due_date is distinct from p_due_date then
      raise exception 'completion_request_conflict' using errcode='P0001';
    end if;
    if v_receipt.completion_id is null then raise exception 'completion_withdrawn' using errcode='P0001';end if;
    select * into v_row from public.task_completions where id=v_receipt.completion_id;
    if v_row.id is null then raise exception 'completion_withdrawn' using errcode='P0001';end if;
    return v_row; -- Current status, but never another submission transition.
  end if;
  -- Existing/manual imported rows still require the same family, child, task and day.

  select * into v_row from public.task_completions where client_id = p_client_id;
  if v_row.id is not null then
    if v_row.family_id is distinct from v_template.family_id or v_row.child_id is distinct from v_child_id
      or v_row.template_id is distinct from p_template_id or v_row.due_date is distinct from p_due_date then
      raise exception 'completion_request_conflict' using errcode='P0001';
    end if;
    return gina.remember_task_submission(p_client_id,v_row);
  end if;

  -- Dated history: settings scheduled for a later day do not govern this day's submission.
  select gina.local_day(timezone,now()) into v_today from public.families where id=v_template.family_id;
  if v_template.effective_from is not null and v_template.effective_from>greatest(p_due_date,v_today) then
    v_version:=gina.task_routine_version_on(v_template.id,p_due_date);
    if v_version->>'status'='known' then
      v_template.days_of_week:=(select coalesce(array_agg(d::text::smallint),'{}') from jsonb_array_elements(v_version->'value'->'days_of_week') d);
      v_template.requires_approval:=(v_version->'value'->>'requires_approval')::boolean;
      v_template.starts_on:=(v_version->'value'->>'starts_on')::date;
      v_template.ends_on:=(v_version->'value'->>'ends_on')::date;
    end if;
  end if;

  if v_template.archived_at is not null or not v_template.active or not (extract(isodow from p_due_date)::smallint = any(v_template.days_of_week)) or p_due_date < v_template.starts_on
     or (v_template.ends_on is not null and p_due_date > v_template.ends_on) then
    raise exception 'template_inactive' using errcode = 'P0001';
  end if;
  if abs(p_due_date - current_date) > 7 then
    raise exception 'date_out_of_window' using errcode = 'P0001';
  end if;


  -- Gün için satır var mı? (returned ise yeniden gönderime çevrilir)
  select * into v_row from public.task_completions
    where template_id = v_template.id and due_date = p_due_date
    for update;

  if v_row.id is not null then
    if v_row.status = 'returned' then
      update public.task_completions
        set status = 'done',
            client_id = p_client_id,
            completed_at = now(),
            completed_by = v_uid,
            reviewed_at = null,
            reviewed_by = null
      where id = v_row.id
      returning * into v_row;
      return gina.remember_task_submission(p_client_id,v_row);
    end if;
    return gina.remember_task_submission(p_client_id,v_row); -- done ya da approved: olduğu gibi döner (UI zaten kilitler)
  end if;

  insert into public.task_completions (family_id, child_id, template_id, due_date, status, client_id, completed_by)
  values (
    v_template.family_id, v_child_id, v_template.id, p_due_date,
    (case when v_template.requires_approval then 'done' else 'approved' end)::public.completion_status,
    p_client_id, v_uid
  )
  on conflict (template_id, due_date) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.task_completions where template_id = v_template.id and due_date = p_due_date;
    return gina.remember_task_submission(p_client_id,v_row);
  end if;

  if v_row.status = 'approved' and (v_row.task_snapshot->>'stars')::int > 0 then
    insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
      values (v_row.family_id, v_row.child_id, (v_row.task_snapshot->>'stars')::int, 'task_approved', v_row.id, v_uid);
  end if;

  if v_row.status='approved' then perform gina.award_badges_for_child(v_row.child_id,v_row.family_id);end if;
  return gina.remember_task_submission(p_client_id,v_row);
end;
$$;

-- Same contract plus an optional effective day. Old clients omit it and get today.
drop function public.change_task_routine(uuid,uuid,integer,text,jsonb);
create function public.change_task_routine(p_request_id uuid,p_id uuid,p_revision integer,p_action text,p_value jsonb default '{}',p_effective_from date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();old public.task_templates;row public.task_templates;payload jsonb;result jsonb;ch uuid;eff date;
 v_title text;v_icon text;v_stars int;v_days smallint[];v_time public.time_of_day;v_approval boolean;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 select child_id into ch from public.task_templates where id=p_id and family_id=f;
 if ch is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('save','pause','resume','archive','restore')
 or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'task_routine_invalid';end if;
 -- Only settings edits can be dated; pause/resume/archive apply now.
 if p_effective_from is not null and p_action<>'save' then raise exception 'task_routine_invalid';end if;
 eff:=gina.plan_effective_from(f,p_effective_from);
 payload:=jsonb_build_object('action','task_routine.change','family',f,'id',p_id,'revision',p_revision,'kind',p_action,'value',p_value)
  ||case when p_effective_from is null then '{}'::jsonb else jsonb_build_object('effective_from',p_effective_from) end;
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform gina.require_active_child(ch);
 select * into old from public.task_templates where id=p_id and family_id=f for update;
 if old.id is null or old.revision<>p_revision then raise exception 'task_routine_changed';end if;
 if p_action='restore' then
  if old.archived_at is null or p_value<>'{}'::jsonb then raise exception 'task_routine_changed';end if;
  update public.task_templates set archived_at=null,active=false where id=p_id returning * into row;
 else
  if old.archived_at is not null then raise exception 'task_routine_archived';end if;
  if p_action='save' then
   if (select count(*) from jsonb_object_keys(p_value))<>6 or exists(select 1 from jsonb_object_keys(p_value) k where k not in('title','icon','stars','days_of_week','time_of_day','requires_approval'))
    or jsonb_typeof(p_value->'title') is distinct from 'string' or jsonb_typeof(p_value->'icon') is distinct from 'string'
    or jsonb_typeof(p_value->'stars') is distinct from 'number' or jsonb_typeof(p_value->'days_of_week') is distinct from 'array'
    or jsonb_typeof(p_value->'time_of_day') is distinct from 'string' or jsonb_typeof(p_value->'requires_approval') is distinct from 'boolean'
    then raise exception 'task_routine_invalid';end if;
   begin
    v_title:=btrim(p_value->>'title');v_icon:=p_value->>'icon';v_stars:=(p_value->>'stars')::integer;v_time:=(p_value->>'time_of_day')::public.time_of_day;v_approval:=(p_value->>'requires_approval')::boolean;
    select array_agg(d::text::smallint order by d::text::smallint) into v_days from jsonb_array_elements(p_value->'days_of_week') d;
   exception when others then raise exception 'task_routine_invalid';end;
   if length(v_title) not between 1 and 80 or v_icon !~ '^[a-z0-9][a-z0-9-]{0,79}$' or v_stars not between 0 and 10 or (p_value->>'stars')::numeric<>v_stars
    or v_days is null or cardinality(v_days) not between 1 and 7 or not(v_days <@ array[1,2,3,4,5,6,7]::smallint[]) or cardinality(v_days)<>(select count(distinct d) from unnest(v_days)d)
    then raise exception 'task_routine_invalid';end if;
   perform set_config('gina.plan_effective_from',eff::text,true);
   update public.task_templates set title=v_title,icon=v_icon,stars=v_stars,days_of_week=v_days,time_of_day=v_time,requires_approval=v_approval,effective_from=eff where id=p_id returning * into row;
   perform set_config('gina.plan_effective_from','',true);
  else
   if p_value<>'{}'::jsonb or (p_action='pause' and not old.active) or (p_action='resume' and old.active) then raise exception 'task_routine_changed';end if;
   update public.task_templates set active=(p_action='resume'),archived_at=case when p_action='archive' then now() else null end where id=p_id returning * into row;
  end if;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'archived_at',row.archived_at,'active',row.active,'effective_from',case when p_action='save' then eff end);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;
revoke all on function public.change_task_routine(uuid,uuid,integer,text,jsonb,date) from public,anon,service_role;
grant execute on function public.change_task_routine(uuid,uuid,integer,text,jsonb,date) to authenticated;

create or replace function public.task_routine_history(p_id uuid,p_before_revision integer default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gina.is_parent() or not exists(select 1 from public.task_templates where id=p_id and family_id=gina.family_id()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_before_revision is not null and p_before_revision<1 then raise exception 'invalid_cursor';end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from (select revision,action,before_value,after_value,created_at,effective_from,known_since,superseded_by from gina.task_routine_changes where template_id=p_id and (p_before_revision is null or revision<p_before_revision) order by revision desc limit 21)v;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=20),'[]'),'has_more',jsonb_array_length(result)>20,
 'pending',(select count(*) from public.task_completions where template_id=p_id and status='done'),
 'returned',(select count(*) from public.task_completions where template_id=p_id and status='returned'));
end;$$;

-- ---------------------------------------------------------------------------
-- School timetable (cells and bell schedule): every saved revision is kept and dated.
create table gina.school_timetable_versions (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision integer not null, lessons jsonb not null, settings jsonb not null,
 effective_from date, known_since date, superseded_by integer,
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), unique(child_id,revision)
);
revoke all on gina.school_timetable_versions from public,anon,authenticated,service_role;
-- Legacy: the current table is known since its last save; earlier revisions were not kept.
insert into gina.school_timetable_versions(child_id,family_id,revision,lessons,settings,effective_from,known_since,actor,created_at)
select t.child_id,t.family_id,t.revision,t.lessons,t.settings,null,gina.local_day(f.timezone,t.updated_at),t.updated_by,t.updated_at
from public.school_timetables t join public.families f on f.id=t.family_id;
create function gina.school_timetable_version() returns trigger language plpgsql security definer set search_path='' as $$
declare today date;eff date;
begin
 if TG_OP='UPDATE' and new.revision=old.revision and new.lessons=old.lessons and new.settings=old.settings then return new;end if;
 select gina.local_day(timezone,now()) into today from public.families where id=new.family_id;
 eff:=coalesce(gina.requested_effective_from(),today);
 update gina.school_timetable_versions set superseded_by=new.revision where child_id=new.child_id and superseded_by is null and effective_from is not null and effective_from>eff;
 insert into gina.school_timetable_versions(child_id,family_id,revision,lessons,settings,effective_from,known_since,actor)
 values(new.child_id,new.family_id,new.revision,new.lessons,new.settings,eff,today,auth.uid())
 on conflict(child_id,revision) do update set lessons=excluded.lessons,settings=excluded.settings,effective_from=excluded.effective_from,known_since=excluded.known_since,actor=excluded.actor,created_at=now();
 return new;
end;$$;
create trigger school_timetable_version after insert or update on public.school_timetables for each row execute function gina.school_timetable_version();
revoke all on function gina.school_timetable_version() from public,anon,authenticated,service_role;

create function gina.timetable_versions(p_child uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'value',jsonb_build_object('lessons',lessons,'settings',settings),'effective_from',effective_from,'known_since',known_since) order by revision),'[]')
 from gina.school_timetable_versions where child_id=p_child and superseded_by is null $$;
-- At a period boundary the closed period's own snapshot stands in for versions the log never had.
create function gina.timetable_version_on(p_child uuid,p_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;period gina.child_education_periods;
begin
 v:=gina.plan_version_on(gina.timetable_versions(p_child),p_day);
 if v is not null and v->>'status'='known' then return v||'{"source":"history"}'::jsonb;end if;
 select * into period from gina.child_education_periods where child_id=p_child and ends_on is not null and starts_on<=p_day and p_day<ends_on and timetable_snapshot is not null order by starts_on desc limit 1;
 if period.id is not null then
  return jsonb_build_object('revision',(period.timetable_snapshot->>'revision')::int,'value',jsonb_build_object('lessons',coalesce(period.timetable_snapshot->'lessons','[]'::jsonb),'settings',coalesce(period.timetable_snapshot->'settings','{"start":"09:00","duration":40,"break":10}'::jsonb)),
   'effective_from',null,'known_since',period.ends_on,'status','period_snapshot','unknown_before',period.ends_on,'source','period_snapshot','period_id',period.id);
 end if;
 if v is not null then return v||'{"source":"history"}'::jsonb;end if;
 return jsonb_build_object('revision',0,'value',jsonb_build_object('lessons','[]'::jsonb,'settings','{"start":"09:00","duration":40,"break":10}'::jsonb),'effective_from',null,'known_since',null,'status','none','unknown_before',null,'source','none');
end;$$;
revoke all on function gina.timetable_versions(uuid),gina.timetable_version_on(uuid,date) from public,anon,authenticated,service_role;

-- Dated save: validates the effective day, then reuses the existing save (same locks, same calendar sync).
create function public.save_school_timetable(p_child_id uuid,p_revision integer,p_lessons jsonb,p_settings jsonb,p_effective_from date)
returns integer language plpgsql security definer set search_path='' as $$
declare f uuid;eff date;rev integer;
begin
 if auth.uid() is null or (gina.is_parent() or (gina.is_device() and p_child_id=gina.child_id())) is not true then raise exception 'timetable_forbidden';end if;
 select c.family_id into f from public.children c where c.id=p_child_id and c.family_id=gina.family_id();
 if f is null then raise exception 'timetable_forbidden';end if;
 eff:=gina.plan_effective_from(f,p_effective_from);
 perform set_config('gina.plan_effective_from',eff::text,true);
 rev:=public.save_school_timetable(p_child_id,p_revision,p_lessons,p_settings);
 perform set_config('gina.plan_effective_from','',true);
 return rev;
end;$$;
revoke all on function public.save_school_timetable(uuid,integer,jsonb,jsonb,date) from public,anon;
grant execute on function public.save_school_timetable(uuid,integer,jsonb,jsonb,date) to authenticated;

drop function public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb);
create function public.save_school_timetable_request(
 p_request_id uuid,p_child_id uuid,p_revision integer,p_lessons jsonb,p_settings jsonb,p_effective_from date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();payload jsonb;result jsonb;entry jsonb;revision integer;eff date;
begin
 if auth.uid() is null or f is null or
  (gina.is_parent() or (gina.is_device() and p_child_id=gina.child_id())) is not true
  or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'timetable_forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_lessons is null or jsonb_typeof(p_lessons)<>'array'
 or p_settings is null or jsonb_typeof(p_settings)<>'object' then raise exception 'timetable_invalid';end if;
 if jsonb_array_length(p_lessons)>112 or octet_length(p_lessons::text)>100000
 or not(p_settings ?& array['start','duration','break']) or p_settings-array['start','duration','break']<>'{}'::jsonb
 or jsonb_typeof(p_settings->'start')<>'string' or jsonb_typeof(p_settings->'duration')<>'number'
 or jsonb_typeof(p_settings->'break')<>'number' then raise exception 'timetable_invalid';end if;
 for entry in select * from jsonb_array_elements(p_lessons) loop
  if jsonb_typeof(entry)<>'object' or not(entry ?& array['id','day','title','start','end'])
  or entry-array['id','day','title','start','end']<>'{}'::jsonb or jsonb_typeof(entry->'id')<>'string'
  or jsonb_typeof(entry->'day')<>'number' or jsonb_typeof(entry->'title')<>'string'
  or jsonb_typeof(entry->'start')<>'string' or jsonb_typeof(entry->'end')<>'string'
  then raise exception 'timetable_invalid';end if;
 end loop;
 eff:=gina.plan_effective_from(f,p_effective_from);
 payload:=jsonb_build_object('action','timetable.save','child',p_child_id,'revision',p_revision,'lessons',p_lessons,'settings',p_settings)
  ||case when p_effective_from is null then '{}'::jsonb else jsonb_build_object('effective_from',p_effective_from) end;
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 -- Existing child-row lock serializes manual edits, imports and child deletion.
 revision:=public.save_school_timetable(p_child_id,p_revision,p_lessons,p_settings,eff);
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'revision',revision,'effective_from',eff);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;
revoke all on function public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb,date) from public,anon,service_role;
grant execute on function public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb,date) to authenticated;

-- ---------------------------------------------------------------------------
-- Learning plan items: every saved revision is kept and dated (no client parameter yet).
create table gina.learning_plan_changes (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references gina.learning_plan(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 revision integer not null, content jsonb not null, source_id uuid, done_at timestamptz,
 effective_from date, known_since date, superseded_by integer,
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), unique(item_id,revision)
);
revoke all on gina.learning_plan_changes from public,anon,authenticated,service_role;
insert into gina.learning_plan_changes(item_id,child_id,revision,content,source_id,done_at,effective_from,known_since,actor,created_at)
select r.id,r.child_id,r.revision,r.content,r.source_id,r.done_at,r.effective_from,gina.local_day(f.timezone,r.updated_at),r.updated_by,r.updated_at
from gina.learning_plan r join public.children c on c.id=r.child_id join public.families f on f.id=c.family_id;
create function gina.learning_plan_version() returns trigger language plpgsql security definer set search_path='' as $$
declare today date;eff date;
begin
 if TG_OP='UPDATE' and new.revision=old.revision and new.content=old.content and new.done_at is not distinct from old.done_at then return new;end if;
 select gina.local_day(f.timezone,now()) into today from public.children c join public.families f on f.id=c.family_id where c.id=new.child_id;
 eff:=coalesce(gina.requested_effective_from(),case when TG_OP='INSERT' then new.effective_from end,today);
 update gina.learning_plan_changes set superseded_by=new.revision where item_id=new.id and superseded_by is null and effective_from is not null and effective_from>eff;
 insert into gina.learning_plan_changes(item_id,child_id,revision,content,source_id,done_at,effective_from,known_since,actor)
 values(new.id,new.child_id,new.revision,new.content,new.source_id,new.done_at,eff,today,auth.uid())
 on conflict(item_id,revision) do update set content=excluded.content,source_id=excluded.source_id,done_at=excluded.done_at,effective_from=excluded.effective_from,known_since=excluded.known_since,actor=excluded.actor,created_at=now();
 return new;
end;$$;
create trigger learning_plan_version after insert or update on gina.learning_plan for each row execute function gina.learning_plan_version();
revoke all on function gina.learning_plan_version() from public,anon,authenticated,service_role;
create function gina.learning_plan_versions(p_item uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'value',jsonb_build_object('content',content,'source_id',source_id,'done_at',done_at),'effective_from',effective_from,'known_since',known_since) order by revision),'[]')
 from gina.learning_plan_changes where item_id=p_item and superseded_by is null $$;
create function gina.learning_plan_version_on(p_item uuid,p_day date) returns jsonb language sql stable security definer set search_path='' as $$
 select gina.plan_version_on(gina.learning_plan_versions(p_item),p_day) $$;
revoke all on function gina.learning_plan_versions(uuid),gina.learning_plan_version_on(uuid,date) from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- The plan of one family-local day: routines, timetable and plan items as they applied that day.
-- Past days use the version in effect then; today and later use the version scheduled for them.
create function public.plan_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();tz text;today date;period gina.child_education_periods;dow int;tt jsonb;routines jsonb;plans jsonb;
begin
 if auth.uid() is null or f is null or (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id)) is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'plan_forbidden' using errcode='42501';end if;
 if p_day is null or not isfinite(p_day) then raise exception 'plan_day_invalid';end if;
 select timezone,gina.local_day(timezone,now()) into tz,today from public.families where id=f;
 dow:=extract(isodow from p_day)::int;
 select * into period from gina.child_education_periods where child_id=p_child_id and starts_on<=p_day and (ends_on is null or p_day<ends_on) order by starts_on desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',t.id,'revision',(v->>'revision')::int,'title',v->'value'->>'title','icon',v->'value'->>'icon','stars',(v->'value'->>'stars')::int,
   'days_of_week',v->'value'->'days_of_week','time_of_day',v->'value'->>'time_of_day','requires_approval',(v->'value'->>'requires_approval')::boolean,
   'starts_on',v->'value'->>'starts_on','ends_on',v->'value'->'ends_on',
   'effective_from',v->'effective_from','known_since',v->'known_since','status',v->>'status','unknown_before',v->'unknown_before',
   'source_routine_id',v->'value'->'source_routine_id','current_revision',t.revision
  ) order by (v->'value'->>'sort_order')::int,t.created_at,t.id),'[]') into routines
 from public.task_templates t cross join lateral gina.task_routine_version_on(t.id,p_day) v
 where t.child_id=p_child_id and t.family_id=f and v is not null
 and (v->'value'->>'active')::boolean and v->'value'->>'archived_at' is null
 and (v->'value'->>'starts_on')::date<=p_day and (v->'value'->>'ends_on' is null or (v->'value'->>'ends_on')::date>=p_day)
 and exists(select 1 from jsonb_array_elements_text(v->'value'->'days_of_week') d where d::int=dow);
 tt:=gina.timetable_version_on(p_child_id,p_day);
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'revision',(v->>'revision')::int,'content',v->'value'->'content','source_id',v->'value'->'source_id','done_at',v->'value'->'done_at',
   'effective_from',v->'effective_from','known_since',v->'known_since','status',v->>'status','unknown_before',v->'unknown_before','current_revision',r.revision
  ) order by v->'value'->'content'->>'planned_on',r.id),'[]') into plans
 from gina.learning_plan r cross join lateral gina.learning_plan_version_on(r.id,p_day) v
 where r.child_id=p_child_id and v is not null and not (v->'value'->'content'->>'archived')::boolean
 and (v->'value'->'content'->>'planned_on')::date<=p_day
 and coalesce((v->'value'->'content'->>'due_on')::date,(v->'value'->'content'->>'planned_on')::date)>=p_day;
 return jsonb_build_object('child_id',p_child_id,'day',p_day,'today',today,'timezone',tz,'weekday',dow,
  'period',case when period.id is null then null else to_jsonb(period)-'timetable_snapshot' end,
  'routines',routines,
  'timetable',jsonb_build_object('revision',(tt->>'revision')::int,'lessons',tt->'value'->'lessons','settings',tt->'value'->'settings',
   'day_lessons',coalesce((select jsonb_agg(l order by l->>'start') from jsonb_array_elements(tt->'value'->'lessons') l where (l->>'day')::int=dow),'[]'::jsonb),
   'effective_from',tt->'effective_from','known_since',tt->'known_since','status',tt->>'status','unknown_before',tt->'unknown_before','source',tt->>'source','period_id',tt->'period_id'),
  'plans',plans);
end;$$;
revoke all on function public.plan_for_day(uuid,date) from public,anon,service_role;
grant execute on function public.plan_for_day(uuid,date) to authenticated;
