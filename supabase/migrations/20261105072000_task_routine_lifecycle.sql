-- Routines may change; submitted work and earned stars must not.
alter table public.task_templates add column revision integer not null default 1 check(revision>0);
alter table public.task_templates add column archived_at timestamptz;
alter table public.task_templates add constraint task_archive_inactive check(archived_at is null or not active);
alter table public.task_completions add column task_snapshot jsonb;
-- Legacy source values are only known as of migration, not the original submission.
update public.task_completions c set task_snapshot=jsonb_build_object('title',t.title,'icon',t.icon,'stars',coalesce((select sum(e.delta) from public.star_events e where e.completion_id=c.id and e.reason='task_approved'),t.stars),'origin','migration')
from public.task_templates t where t.id=c.template_id and exists(select 1 from public.children ch where ch.id=c.child_id and ch.archived_at is null);

create table gina.task_routine_changes (
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.task_templates(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision integer not null, action text not null,
 before_value jsonb, after_value jsonb not null,
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), unique(template_id,revision)
);
revoke all on gina.task_routine_changes from public,anon,authenticated,service_role;
-- Devices can read their own submitted work after its routine is paused. Unused
-- inactive routines remain hidden; a content-free signal invalidates cached plans.
drop policy task_templates_device_select on public.task_templates;
create policy task_templates_device_select on public.task_templates for select to authenticated
 using(family_id=gina.family_id() and gina.is_device() and child_id=gina.child_id()
 and (active or exists(select 1 from public.task_completions c where c.template_id=task_templates.id and c.child_id=gina.child_id())));
create table public.task_routine_sync (
 child_id uuid primary key references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision bigint not null default 1
);
alter table public.task_routine_sync enable row level security;
revoke all on public.task_routine_sync from public,anon,authenticated;
grant select on public.task_routine_sync to authenticated;
create policy task_routine_sync_read on public.task_routine_sync for select to authenticated
 using(family_id=gina.family_id() and (gina.is_parent() or (gina.is_device() and child_id=gina.child_id())));
alter publication supabase_realtime add table public.task_routine_sync;
create function gina.task_routine_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.child_id<>old.child_id or new.family_id<>old.family_id then raise exception 'task_owner_immutable';end if;
 if old.archived_at is not null and new.active then raise exception 'task_restore_paused';end if;
 -- Restored legacy profiles may have completions that could not be backfilled while archived.
 update public.task_completions set task_snapshot=null where template_id=old.id and task_snapshot is null;
 if (to_jsonb(new)-array['revision','updated_at']) is distinct from (to_jsonb(old)-array['revision','updated_at']) then new.revision:=old.revision+1;else new.revision:=old.revision;end if;
 return new;
end;$$;
create trigger task_routine_revision before update on public.task_templates for each row execute function gina.task_routine_revision();
create function gina.task_routine_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor)
 values(new.id,new.family_id,new.revision,
 case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end,
 case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid());
 insert into public.task_routine_sync(child_id,family_id) values(new.child_id,new.family_id) on conflict(child_id) do update set revision=public.task_routine_sync.revision+1;
 return new;
end;$$;
create trigger task_routine_audit after insert or update on public.task_templates for each row execute function gina.task_routine_audit();
create function gina.task_completion_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.task_templates;
begin
 if TG_OP='UPDATE' and old.task_snapshot is not null then new.task_snapshot:=old.task_snapshot;return new;end if;
 select * into t from public.task_templates where id=new.template_id for share;
 if t.family_id is distinct from new.family_id or t.child_id is distinct from new.child_id then raise exception 'wrong_child';end if;
 new.task_snapshot:=jsonb_build_object('title',t.title,'icon',t.icon,'stars',t.stars,'origin',case when TG_OP='INSERT' then 'submission' else 'migration' end);return new;
end;$$;
create trigger task_completion_snapshot before insert or update on public.task_completions for each row execute function gina.task_completion_snapshot();
revoke all on function gina.task_routine_revision(),gina.task_routine_audit(),gina.task_completion_snapshot() from public,anon,authenticated,service_role;
-- Existing clients can pause/resume. Destructive edits and identity changes are not supported.
revoke insert,update,delete on public.task_templates from authenticated;
grant insert(id,family_id,child_id,title,icon,stars,days_of_week,time_of_day,starts_on,ends_on,requires_approval,active,sort_order,created_at,updated_at) on public.task_templates to authenticated;
grant update(active) on public.task_templates to authenticated;

create function public.change_task_routine(p_request_id uuid,p_id uuid,p_revision integer,p_action text,p_value jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();old public.task_templates;row public.task_templates;payload jsonb;result jsonb;ch uuid;
 v_title text;v_icon text;v_stars int;v_days smallint[];v_time public.time_of_day;v_approval boolean;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 select child_id into ch from public.task_templates where id=p_id and family_id=f;
 if ch is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('save','pause','resume','archive','restore')
 or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'task_routine_invalid';end if;
 payload:=jsonb_build_object('action','task_routine.change','family',f,'id',p_id,'revision',p_revision,'kind',p_action,'value',p_value);
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
   update public.task_templates set title=v_title,icon=v_icon,stars=v_stars,days_of_week=v_days,time_of_day=v_time,requires_approval=v_approval where id=p_id returning * into row;
  else
   if p_value<>'{}'::jsonb or (p_action='pause' and not old.active) or (p_action='resume' and old.active) then raise exception 'task_routine_changed';end if;
   update public.task_templates set active=(p_action='resume'),archived_at=case when p_action='archive' then now() else null end where id=p_id returning * into row;
  end if;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'archived_at',row.archived_at,'active',row.active);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;

create function public.task_routine_history(p_id uuid,p_before_revision integer default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gina.is_parent() or not exists(select 1 from public.task_templates where id=p_id and family_id=gina.family_id()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_before_revision is not null and p_before_revision<1 then raise exception 'invalid_cursor';end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from (select revision,action,before_value,after_value,created_at from gina.task_routine_changes where template_id=p_id and (p_before_revision is null or revision<p_before_revision) order by revision desc limit 21)v;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=20),'[]'),'has_more',jsonb_array_length(result)>20,
 'pending',(select count(*) from public.task_completions where template_id=p_id and status='done'),
 'returned',(select count(*) from public.task_completions where template_id=p_id and status='returned'));
end;$$;
revoke all on function public.change_task_routine(uuid,uuid,integer,text,jsonb),public.task_routine_history(uuid,integer) from public,anon,service_role;
grant execute on function public.change_task_routine(uuid,uuid,integer,text,jsonb),public.task_routine_history(uuid,integer) to authenticated;

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


create or replace function public.review_task(p_completion_id uuid, p_approve boolean)
returns public.task_completions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.task_completions%rowtype;
  v_stars smallint;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.task_completions where id = p_completion_id and family_id = gina.family_id() for update;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.status <> 'done' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  update public.task_completions
    set status = (case when p_approve then 'approved' else 'returned' end)::public.completion_status,
        reviewed_at = now(), reviewed_by = v_uid
  where id = p_completion_id
  returning * into v_row;

  if p_approve then
    v_stars := (v_row.task_snapshot->>'stars')::smallint;
    if coalesce(v_stars, 0) > 0 then
      insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
        values (v_row.family_id, v_row.child_id, v_stars, 'task_approved', v_row.id, v_uid);
    end if;
    perform gina.award_badges_for_child(v_row.child_id, v_row.family_id);
  end if;

  return v_row;
end;
$$;


create or replace function gina.award_badges_for_child(p_child_id uuid, p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  v_count int;
begin
  for b in
    select * from public.badge_definitions
    where active and (family_id is null or family_id = p_family_id)
  loop
    continue when exists (
      select 1 from public.child_badge_awards a where a.child_id = p_child_id and a.badge_slug = b.slug
    );
    if b.rule ->> 'kind' = 'first_task' then
      if exists (select 1 from public.task_completions tc where tc.child_id = p_child_id and tc.status = 'approved') then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'first_task'))
        on conflict do nothing;
      end if;
    elsif b.rule ->> 'kind' = 'task_count' then
      select count(*) into v_count from public.task_completions tc
        where tc.child_id = p_child_id and tc.status = 'approved';
      if v_count >= coalesce((b.rule -> 'params' ->> 'count')::int, 999999) then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'task_count', 'count', v_count))
        on conflict do nothing;
      end if;
    elsif b.rule ->> 'kind' = 'planned_care' then
      -- Planlı bakım: o ikonlu görevin ONAYLI tamamlama sayısı (süre yarışı değil).
      select count(*) into v_count from public.task_completions tc
        join public.task_templates tt on tt.id = tc.template_id
        where tc.child_id = p_child_id and tc.status = 'approved'
          and coalesce(tc.task_snapshot->>'icon',tt.icon) = b.rule -> 'params' ->> 'icon';
      if v_count >= coalesce((b.rule -> 'params' ->> 'count')::int, 999999) then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'planned_care', 'count', v_count))
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;
