-- F5: align parent-phone child PIN window with the existing device/parent PIN limiter.
create or replace function public.verify_child_pin(p_child_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.child_pins%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children where id = p_child_id and family_id = gina.family_id()) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;

  perform gina.require_active_child(p_child_id);
  select * into v_pin from public.child_pins where child_id = p_child_id for update;
  if v_pin.child_id is null then
    return true; -- PIN tanımlanmamışsa profil seçimi yeterlidir
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = 'P0001';
  end if;
  if p_pin is not null and p_pin ~ '^\d{4}$' and v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.child_pins set failed_count = 0, locked_until = null where child_id = p_child_id;
    return true;
  end if;
  update public.child_pins
    set failed_count = case when v_pin.locked_until is not null and v_pin.locked_until <= now() then 1 else least(v_pin.failed_count+1,5) end,
        locked_until = case when v_pin.locked_until is not null and v_pin.locked_until <= now() then null when v_pin.failed_count+1>=5 then now()+interval '60 seconds' else null end,
        updated_at = now()
  where child_id = p_child_id;
  return false;
end;
$$;
