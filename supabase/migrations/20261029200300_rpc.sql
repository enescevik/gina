-- RPC'ler: iş kuralları burada; istemciler tabloya doğrudan yazmak yerine bu fonksiyonları çağırır.
-- Hepsi SECURITY DEFINER; çağıranın kimliği auth.uid() ve gina.* claim'leriyle denetlenir.

-- Aile kurulumu ---------------------------------------------------------------------

create or replace function public.create_family(p_name text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.devices where auth_user_id = v_uid) then
    raise exception 'device_user' using errcode = 'P0001';
  end if;

  insert into public.families (name, created_by) values (p_name, v_uid) returning id into v_family_id;
  insert into public.family_members (family_id, user_id, role, display_name)
    values (v_family_id, v_uid, 'parent', p_display_name);
  return v_family_id;
end;
$$;

create or replace function public.join_family(p_invite_code text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  select id into v_family_id from public.families where invite_code = upper(trim(p_invite_code));
  if v_family_id is null then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
    values (v_family_id, v_uid, 'parent', p_display_name);
  return v_family_id;
end;
$$;

-- PIN'ler ------------------------------------------------------------------------------

create or replace function gina.assert_pin(p_pin text)
returns void
language plpgsql
immutable
as $$
begin
  if p_pin !~ '^\d{4}$' then
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.set_child_pin(p_child_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform gina.assert_pin(p_pin);
  if not exists (select 1 from public.children where id = p_child_id and family_id = gina.family_id()) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;

  insert into public.child_pins (child_id, pin_hash)
  values (p_child_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (child_id) do update
    set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null, updated_at = now();
end;
$$;

create or replace function public.set_parent_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform gina.assert_pin(p_pin);

  insert into public.parent_pins (family_id, pin_hash)
  values (gina.family_id(), extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (family_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.verify_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select pin_hash into v_hash from public.parent_pins where family_id = gina.family_id();
  if v_hash is null then
    return false;
  end if;
  return v_hash = extensions.crypt(p_pin, v_hash);
end;
$$;

-- Cihaz eşleştirme --------------------------------------------------------------------------

-- Tablet (anonim kullanıcı) çağırır: 6 haneli kod üretir, 10 dk geçerli.
create or replace function public.request_pairing(p_device_name text default 'Tablet')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'parent_user' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.devices where auth_user_id = v_uid and revoked_at is null) then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  delete from public.device_pairings where auth_user_id = v_uid or expires_at < now();

  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.device_pairings where code = v_code);
  end loop;

  insert into public.device_pairings (code, auth_user_id, device_name)
    values (v_code, v_uid, coalesce(nullif(trim(p_device_name), ''), 'Tablet'));
  return v_code;
end;
$$;

-- Veli telefonundan çağırır: kodu ailesine bağlar.
create or replace function public.pair_device(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pairing public.device_pairings%rowtype;
  v_device_id uuid;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_pairing
  from public.device_pairings
  where code = trim(p_code) and consumed_at is null and expires_at >= now()
  for update;

  if v_pairing.code is null then
    raise exception 'invalid_or_expired_code' using errcode = 'P0001';
  end if;

  insert into public.devices (family_id, auth_user_id, name)
    values (gina.family_id(), v_pairing.auth_user_id, v_pairing.device_name)
  on conflict (auth_user_id) do update
    set family_id = excluded.family_id, name = excluded.name, revoked_at = null, active_child_id = null, paired_at = now()
  returning id into v_device_id;

  update public.device_pairings set consumed_at = now() where code = v_pairing.code;
  return v_device_id;
end;
$$;

create or replace function public.revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.devices
    set revoked_at = now(), active_child_id = null
  where id = p_device_id and family_id = gina.family_id();
end;
$$;

-- Çocuk PIN girişi (cihaz): 5 hatada 60 sn kilit. Başarıda aktif çocuk yazılır; istemci refreshSession() çağırır.
create or replace function public.child_pin_login(p_child_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_device public.devices%rowtype;
  v_pin public.child_pins%rowtype;
begin
  select * into v_device from public.devices where auth_user_id = v_uid and revoked_at is null;
  if v_device.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children where id = p_child_id and family_id = v_device.family_id) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;

  select * into v_pin from public.child_pins where child_id = p_child_id for update;
  if v_pin.child_id is null then
    -- PIN tanımlanmamışsa profil seçimi yeterlidir.
    update public.devices set active_child_id = p_child_id, last_seen_at = now() where id = v_device.id;
    return true;
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = 'P0001';
  end if;

  if v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.child_pins set failed_count = 0, locked_until = null where child_id = p_child_id;
    update public.devices set active_child_id = p_child_id, last_seen_at = now() where id = v_device.id;
    return true;
  end if;

  update public.child_pins
    set failed_count = failed_count + 1,
        locked_until = case when failed_count + 1 >= 5 then now() + interval '60 seconds' else null end,
        updated_at = now()
  where child_id = p_child_id;
  return false;
end;
$$;

create or replace function public.child_logout()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.devices set active_child_id = null where auth_user_id = auth.uid();
end;
$$;

-- Görevler --------------------------------------------------------------------------------

-- Çocuk (cihaz) ya da ebeveyn (telefonda çocuk modu: p_acting_child_id) bir görevi "yaptım" olarak işaretler.
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

-- Onay bekleyen bir tiki geri alır (çocuk ya da ebeveyn).
create or replace function public.undo_complete(p_completion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.task_completions%rowtype;
begin
  select * into v_row from public.task_completions where id = p_completion_id;
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

-- Ebeveyn onaylar ya da geri gönderir; onayda yıldız defterine yazılır.
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
    select stars into v_stars from public.task_templates where id = v_row.template_id;
    if coalesce(v_stars, 0) > 0 then
      insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
        values (v_row.family_id, v_row.child_id, v_stars, 'task_approved', v_row.id, v_uid);
    end if;
  end if;

  return v_row;
end;
$$;

-- İzinler ------------------------------------------------------------------------------------

revoke execute on function
  public.create_family(text, text), public.join_family(text, text),
  public.set_child_pin(uuid, text), public.set_parent_pin(text), public.verify_parent_pin(text),
  public.request_pairing(text), public.pair_device(text), public.revoke_device(uuid),
  public.child_pin_login(uuid, text), public.child_logout(),
  public.complete_task(uuid, date, uuid, uuid), public.undo_complete(uuid), public.review_task(uuid, boolean),
  gina.assert_pin(text)
from public, anon;

grant execute on function
  public.create_family(text, text), public.join_family(text, text),
  public.set_child_pin(uuid, text), public.set_parent_pin(text), public.verify_parent_pin(text),
  public.request_pairing(text), public.pair_device(text), public.revoke_device(uuid),
  public.child_pin_login(uuid, text), public.child_logout(),
  public.complete_task(uuid, date, uuid, uuid), public.undo_complete(uuid), public.review_task(uuid, boolean)
to authenticated, service_role;
