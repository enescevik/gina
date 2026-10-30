-- Odadaki evcil hayvan seçimi (BRIEF 13): kedi, köpek, maymun, aslan yavrusu ya da hiçbiri.
-- Seçim herkese açık; cinsiyet/karakterle bağlantılı değil. Görseller Codex'ten pet-{slug}.webp olarak gelir.
alter table public.child_room_preferences
  add column if not exists pet_key text not null default 'cat';
alter table public.child_room_preferences drop constraint if exists child_room_preferences_pet_key_check;
alter table public.child_room_preferences
  add constraint child_room_preferences_pet_key_check check (pet_key in ('none', 'cat', 'dog', 'monkey', 'lion'));

create or replace function public.set_room_pet(p_pet text, p_acting_child_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid;
begin
  if gina.is_device() then
    v_child := gina.child_id();
  elsif gina.is_parent() then
    v_child := p_acting_child_id;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_child is null
     or not exists (select 1 from public.children c where c.id = v_child and c.family_id = gina.family_id()) then
    raise exception 'no_child' using errcode = 'P0001';
  end if;
  if p_pet not in ('none', 'cat', 'dog', 'monkey', 'lion') then
    raise exception 'bad_pet' using errcode = 'P0001';
  end if;
  insert into public.child_room_preferences (child_id, family_id, pet_key)
    values (v_child, gina.family_id(), p_pet)
  on conflict (child_id) do update
    set pet_key = excluded.pet_key, updated_at = now();
end;
$$;

revoke execute on function public.set_room_pet(text, uuid) from public, anon;
grant execute on function public.set_room_pet(text, uuid) to authenticated;
