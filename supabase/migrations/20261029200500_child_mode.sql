-- Veli telefonunda "çocuk modu": veli oturumu içinde, çocuk PIN'iyle girilen kısıtlı görünüm.
-- RLS değişmez (veli kapsamı); eylemler complete_task(p_acting_child_id) ile çocuğa yazılır.

-- Veli, çocuk PIN'ini doğrular (cihaz girişiyle aynı kilit kuralı: 5 hatada 60 sn).
create or replace function public.verify_child_pin(p_child_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
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

  select * into v_pin from public.child_pins where child_id = p_child_id for update;
  if v_pin.child_id is null then
    return true; -- PIN tanımlanmamışsa profil seçimi yeterlidir
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = 'P0001';
  end if;
  if v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.child_pins set failed_count = 0, locked_until = null where child_id = p_child_id;
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

-- Ailenin veli PIN'i tanımlı mı (çocuk moduna girmeden önce kontrol edilir).
create or replace function public.parent_pin_set()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.parent_pins where family_id = gina.family_id());
$$;

revoke execute on function public.verify_child_pin(uuid, text), public.parent_pin_set() from public, anon;
grant execute on function public.verify_child_pin(uuid, text), public.parent_pin_set() to authenticated, service_role;
