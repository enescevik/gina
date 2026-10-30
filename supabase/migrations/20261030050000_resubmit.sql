-- Geri gönderilen (returned) görevin yeniden gönderilebilmesi (docs/design/room-v2 düzeltmesi).
-- Kurallar: yalnız 'returned' satır yeniden 'done' olur; onaylı satır değişmez; yıldız yalnız
-- review_task onayında yazıldığı için iade/yıldız geri alma durumu doğmaz.

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
begin
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
  if not v_template.active or p_due_date < v_template.starts_on
     or (v_template.ends_on is not null and p_due_date > v_template.ends_on) then
    raise exception 'template_inactive' using errcode = 'P0001';
  end if;
  if abs(p_due_date - current_date) > 7 then
    raise exception 'date_out_of_window' using errcode = 'P0001';
  end if;

  -- Aynı client_id tekrar gelirse (çevrimdışı kuyruk) mevcut satır döner.
  select * into v_row from public.task_completions where client_id = p_client_id;
  if v_row.id is not null then
    return v_row;
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
      return v_row;
    end if;
    return v_row; -- done ya da approved: olduğu gibi döner (UI zaten kilitler)
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
    return v_row;
  end if;

  if v_row.status = 'approved' and v_template.stars > 0 then
    insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
      values (v_row.family_id, v_row.child_id, v_template.stars, 'task_approved', v_row.id, v_uid);
  end if;

  return v_row;
end;
$$;
