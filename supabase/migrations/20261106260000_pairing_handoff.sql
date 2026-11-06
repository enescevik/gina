-- C06 (U01/U02): pairing hand-off and the parent exit PIN.
--
-- 1) preview_device_pairing: a parent who opened a child device's QR link (possibly before
--    signing in) sees which device and which family the code will connect BEFORE anything is
--    paired. Read-only: it never consumes the code, never creates a device row and never shows
--    another family's data. Consumed/expired codes look the same as unknown ones.
-- 2) Parent exit PIN gets the same wrong-attempt policy as child PINs (5 wrong -> 60 s wait),
--    so the shared PIN control and its recovery text describe what the server really does.
--    A new PIN resets the counter. Existing PIN hashes are unchanged.

create or replace function public.preview_device_pairing(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pairing public.device_pairings%rowtype;
  v_family text;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_code is null or trim(p_code) !~ '^\d{6}$' then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;
  select * into v_pairing from public.device_pairings
   where code = trim(p_code) and consumed_at is null and expires_at >= now();
  if v_pairing.code is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;
  select name into v_family from public.families where id = gina.family_id();
  return jsonb_build_object(
    'status', 'ok',
    'device_name', v_pairing.device_name,
    'expires_at', v_pairing.expires_at,
    'seconds_left', greatest(0, floor(extract(epoch from (v_pairing.expires_at - now())))::int),
    'family_name', v_family
  );
end;
$$;
revoke all on function public.preview_device_pairing(text) from public, anon;
grant execute on function public.preview_device_pairing(text) to authenticated;

alter table public.parent_pins
  add column if not exists failed_count smallint not null default 0,
  add column if not exists locked_until timestamptz;

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
    set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null, updated_at = now();
end;
$$;

-- Wrong PIN returns false (so the counter is kept); a locked PIN raises pin_locked without
-- checking the value, exactly like child_pin_login / verify_child_pin.
create or replace function public.verify_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin public.parent_pins%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_pin from public.parent_pins where family_id = gina.family_id() for update;
  if v_pin.family_id is null then
    return false;
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = 'P0001';
  end if;
  if p_pin is not null and p_pin ~ '^\d{4}$' and v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.parent_pins set failed_count = 0, locked_until = null where family_id = v_pin.family_id;
    return true;
  end if;
  update public.parent_pins
     set failed_count = case when v_pin.locked_until is not null and v_pin.locked_until <= now() then 1 else least(v_pin.failed_count + 1, 5) end,
         locked_until = case
           when v_pin.locked_until is not null and v_pin.locked_until <= now() then null
           when v_pin.failed_count + 1 >= 5 then now() + interval '60 seconds'
           else null end
   where family_id = v_pin.family_id;
  return false;
end;
$$;
