create table gina.study_day_deferrals (
  family_id uuid not null references public.families on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  day date not null,
  task_count integer not null default 0,
  repeat_count integer not null default 0,
  primary key(child_id, day)
);
create table gina.study_task_deferrals (
  child_id uuid not null,
  day date not null,
  template_id uuid not null references public.task_templates on delete cascade,
  routine jsonb not null,
  primary key(child_id, day, template_id),
  foreign key(child_id, day) references gina.study_day_deferrals on delete cascade
);
alter table gina.study_day_deferrals enable row level security;
alter table gina.study_task_deferrals enable row level security;
revoke all on gina.study_day_deferrals, gina.study_task_deferrals from public, anon, authenticated, service_role;

alter function public.plan_for_day(uuid,date) set schema gina;
alter function gina.plan_for_day(uuid,date) rename to plan_for_day_before_deferral;
revoke all on function gina.plan_for_day_before_deferral(uuid,date) from public, anon, authenticated, service_role;

create function public.plan_for_day(p_child_id uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  plan jsonb := gina.plan_for_day_before_deferral(p_child_id,p_day);
  routines jsonb;
begin
  select coalesce(jsonb_agg(item order by priority, position, item->>'id'),'[]') into routines
  from (
    select r.item, 0 priority, r.position
    from jsonb_array_elements(plan->'routines') with ordinality r(item,position)
    where not exists (
      select 1 from gina.study_task_deferrals d
      where d.child_id=p_child_id and d.day=p_day and d.template_id=(r.item->>'id')::uuid
    )
    union all
    select d.routine || jsonb_build_object(
      'starts_on',p_day,'ends_on',p_day,'days_of_week',jsonb_build_array(extract(isodow from p_day)::integer)
    ), 1, 0
    from gina.study_task_deferrals d join public.task_templates t on t.id=d.template_id
    where d.child_id=p_child_id and d.day=p_day-1 and t.archived_at is null and t.active
      and not exists(select 1 from jsonb_array_elements(plan->'routines') r where r->>'id'=d.template_id::text)
      and not exists(select 1 from gina.study_task_deferrals next where next.child_id=p_child_id and next.day=p_day and next.template_id=d.template_id)
  ) projected;
  return jsonb_set(plan,'{routines}',routines);
end;$$;
revoke all on function public.plan_for_day(uuid,date) from public, anon, service_role;
grant execute on function public.plan_for_day(uuid,date) to authenticated;

create function public.defer_study_day(p_child_id uuid, p_day date)
returns table(task_count integer, repeat_count integer)
language plpgsql security definer set search_path='' as $$
declare
  family uuid := gina.family_id();
  zone text;
  plan jsonb;
  moved_tasks integer;
  moved_repeats integer;
begin
  if gina.is_parent() is not true or not exists(
    select 1 from public.children c where c.id=p_child_id and c.family_id=family
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  perform gina.require_active_child(p_child_id);
  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,191));
  return query select d.task_count,d.repeat_count
    from gina.study_day_deferrals d where d.child_id=p_child_id and d.day=p_day;
  if found then return; end if;
  if p_day is distinct from gina.family_today(family) then
    raise exception 'study_day_changed';
  end if;

  select timezone into zone from public.families where id=family;
  plan := public.plan_for_day(p_child_id,p_day);
  insert into gina.study_day_deferrals(family_id,child_id,day) values(family,p_child_id,p_day);
  insert into gina.study_task_deferrals(child_id,day,template_id,routine)
  select p_child_id,p_day,(r->>'id')::uuid,r
  from jsonb_array_elements(plan->'routines') r
  where not exists(
    select 1 from public.task_completions c where c.template_id=(r->>'id')::uuid and c.due_date=p_day
  );
  get diagnostics moved_tasks = row_count;

  with affected_batches as (
    select distinct i.batch_id
    from gina.repeat_calendar_items i
    join gina.repeat_calendar_batches b on b.id=i.batch_id
    join public.events e on e.id=i.event_id
    where b.family_id=family and b.child_id=p_child_id
      and e.family_id=family and e.child_id=p_child_id and e.archived_at is null and e.rrule is null
      and (e.starts_at at time zone zone)::date=p_day and coalesce(e.ends_at,e.starts_at)>now()
  )
  update public.events e
  set starts_at=((e.starts_at at time zone zone)+interval '1 day') at time zone zone,
      ends_at=case when e.ends_at is null then null else
        ((e.starts_at at time zone zone)+interval '1 day') at time zone zone + (e.ends_at-e.starts_at) end
  where e.family_id=family and e.child_id=p_child_id and e.archived_at is null and e.rrule is null
    and (e.starts_at at time zone zone)::date>=p_day
    and coalesce(e.ends_at,e.starts_at)>now()
    and e.id in(select i.event_id from gina.repeat_calendar_items i join affected_batches b on b.batch_id=i.batch_id);
  get diagnostics moved_repeats = row_count;

  if moved_tasks=0 and moved_repeats=0 then
    delete from gina.study_day_deferrals d where d.child_id=p_child_id and d.day=p_day;
  else
    update gina.study_day_deferrals d set task_count=moved_tasks, repeat_count=moved_repeats
      where d.child_id=p_child_id and d.day=p_day;
  end if;
  if moved_tasks>0 then
    insert into public.task_routine_sync(child_id,family_id) values(p_child_id,family)
    on conflict(child_id) do update set revision=public.task_routine_sync.revision+1;
  end if;
  return query select moved_tasks,moved_repeats;
end;$$;
revoke all on function public.defer_study_day(uuid,date) from public, anon, service_role;
grant execute on function public.defer_study_day(uuid,date) to authenticated;

create or replace function public.complete_task(
  p_template_id uuid,
  p_due_date date,
  p_client_id uuid,
  p_acting_child_id uuid default null
)
returns public.task_completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_template public.task_templates%rowtype;
  v_child_id uuid;
  v_row public.task_completions%rowtype;
  v_receipt gina.task_submission_receipts%rowtype;
  v_today date;
  v_version jsonb;
  v_deferred_routine jsonb;
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
  perform pg_advisory_xact_lock(hashtextextended(v_child_id::text,191));
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

  if exists(select 1 from gina.study_task_deferrals d
    where d.child_id=v_child_id and d.day=p_due_date and d.template_id=p_template_id) then
    raise exception 'task_deferred' using errcode='P0001';
  end if;
  if v_template.archived_at is not null or not v_template.active then
    raise exception 'template_inactive' using errcode='P0001';
  end if;
  if not (extract(isodow from p_due_date)::smallint = any(v_template.days_of_week)) or p_due_date < v_template.starts_on
     or (v_template.ends_on is not null and p_due_date > v_template.ends_on) then
    select d.routine into v_deferred_routine from gina.study_task_deferrals d
    where d.child_id=v_child_id and d.day=p_due_date-1 and d.template_id=p_template_id;
    if v_deferred_routine is null then
      raise exception 'template_inactive' using errcode='P0001';
    end if;
    v_template.requires_approval := (v_deferred_routine->>'requires_approval')::boolean;
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

create or replace function gina.task_completion_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.task_templates;today date;v jsonb;deferred jsonb;
begin
 if TG_OP='UPDATE' and old.task_snapshot is not null then new.task_snapshot:=old.task_snapshot;return new;end if;
 select * into t from public.task_templates where id=new.template_id for share;
 if t.family_id is distinct from new.family_id or t.child_id is distinct from new.child_id then raise exception 'wrong_child';end if;
 if TG_OP='INSERT' then
  select d.routine into deferred from gina.study_task_deferrals d
    where d.child_id=new.child_id and d.day=new.due_date-1 and d.template_id=new.template_id;
  if deferred is not null then
   v:=gina.task_routine_version_on(t.id,new.due_date);
   if not coalesce(
    (v->'value'->>'active')::boolean and v->'value'->>'archived_at' is null
    and (v->'value'->>'starts_on')::date<=new.due_date
    and (v->'value'->>'ends_on' is null or (v->'value'->>'ends_on')::date>=new.due_date)
    and exists(select 1 from jsonb_array_elements_text(v->'value'->'days_of_week') d where d::int=extract(isodow from new.due_date)),false
   ) then
    new.task_snapshot:=jsonb_build_object('title',deferred->>'title','icon',deferred->>'icon',
      'stars',(deferred->>'stars')::int,'origin','submission');
    return new;
   end if;
  end if;
 end if;
 select gina.local_day(timezone,now()) into today from public.families where id=t.family_id;
 if TG_OP='INSERT' and t.effective_from is not null and t.effective_from>greatest(new.due_date,today) then
  v:=gina.task_routine_version_on(t.id,new.due_date);
  if v->>'status'='known' then
   new.task_snapshot:=jsonb_build_object('title',v->'value'->>'title','icon',v->'value'->>'icon','stars',(v->'value'->>'stars')::int,'origin','submission');return new;
  end if;
 end if;
 new.task_snapshot:=jsonb_build_object('title',t.title,'icon',t.icon,'stars',t.stars,'origin',case when TG_OP='INSERT' then 'submission' else 'migration' end);return new;
end;$$;

create function public.get_study_day_deferral(p_child_id uuid)
returns table(day date, task_count integer, repeat_count integer, deferred boolean)
language plpgsql stable security definer set search_path='' as $$
declare
  family uuid := gina.family_id();
  local_day date;
begin
  if gina.is_parent() is not true or not exists(
    select 1 from public.children c where c.id=p_child_id and c.family_id=family and c.archived_at is null
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  local_day:=gina.family_today(family);
  return query select local_day,coalesce(d.task_count,0),coalesce(d.repeat_count,0),d.day is not null
  from (select 1) anchor left join gina.study_day_deferrals d on d.child_id=p_child_id and d.day=local_day;
end;$$;
revoke all on function public.get_study_day_deferral(uuid) from public, anon, service_role;
grant execute on function public.get_study_day_deferral(uuid) to authenticated;
