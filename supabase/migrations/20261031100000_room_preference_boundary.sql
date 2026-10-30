-- SECURITY DEFINER must verify the target family before its upsert bypasses RLS.
create or replace function public.set_room_preference(p_character text, p_theme text default 'default', p_acting_child_id uuid default null)
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
  if v_child is null or not exists (select 1 from public.children c where c.id = v_child and c.family_id = gina.family_id()) then
    raise exception 'no_child' using errcode = 'P0001';
  end if;
  if p_character not in ('unspecified', 'girl', 'boy') then
    raise exception 'bad_character' using errcode = 'P0001';
  end if;
  insert into public.child_room_preferences (child_id, family_id, character_key, theme_key)
    values (v_child, gina.family_id(), p_character, p_theme)
  on conflict (child_id) do update
    set character_key = excluded.character_key, theme_key = excluded.theme_key, updated_at = now();
end;
$$;
