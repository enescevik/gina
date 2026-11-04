-- Keep submission identity after resubmission; revoked children/families cannot recover it.
create table gina.task_submission_receipts (
 client_id uuid primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 template_id uuid not null references public.task_templates(id) on delete cascade,
 due_date date not null,
 completion_id uuid references public.task_completions(id) on delete set null,
 created_at timestamptz not null default now()
);
create index task_submission_family_idx on gina.task_submission_receipts(family_id);
create index task_submission_child_idx on gina.task_submission_receipts(child_id);
create index task_submission_template_idx on gina.task_submission_receipts(template_id);
create index task_submission_completion_idx on gina.task_submission_receipts(completion_id) where completion_id is not null;
alter table gina.task_submission_receipts enable row level security;
revoke all on gina.task_submission_receipts from public,anon,authenticated,service_role;
insert into gina.task_submission_receipts(client_id,family_id,child_id,template_id,due_date,completion_id)
select client_id,family_id,child_id,template_id,due_date,id from public.task_completions;
create function gina.remember_task_submission(p_client uuid,p_row public.task_completions) returns public.task_completions
language plpgsql security definer set search_path='' as $$
begin
 insert into gina.task_submission_receipts(client_id,family_id,child_id,template_id,due_date,completion_id)
 values(p_client,p_row.family_id,p_row.child_id,p_row.template_id,p_row.due_date,p_row.id);
 return p_row;
end;$$;
revoke all on function gina.remember_task_submission(uuid,public.task_completions) from public,anon,authenticated,service_role;

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
  if not v_template.active or not (extract(isodow from p_due_date)::smallint = any(v_template.days_of_week)) or p_due_date < v_template.starts_on
     or (v_template.ends_on is not null and p_due_date > v_template.ends_on) then
    raise exception 'template_inactive' using errcode = 'P0001';
  end if;
  if abs(p_due_date - current_date) > 7 then
    raise exception 'date_out_of_window' using errcode = 'P0001';
  end if;

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

  if v_row.status = 'approved' and v_template.stars > 0 then
    insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
      values (v_row.family_id, v_row.child_id, v_template.stars, 'task_approved', v_row.id, v_uid);
  end if;

  return gina.remember_task_submission(p_client_id,v_row);
end;
$$;

-- Approval and undo share the same completion row lock.
create or replace function public.undo_complete(p_completion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.task_completions%rowtype;
begin
  select * into v_row from public.task_completions where id = p_completion_id and family_id = gina.family_id() for update;
  if v_row.id is null or v_row.family_id is distinct from gina.family_id() then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if gina.is_device() and v_row.child_id <> gina.child_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (gina.is_device() or gina.is_parent()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.status <> 'done' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  delete from public.task_completions where id = p_completion_id;
end;
$$;

