-- Custom Access Token Hook: her token üretiminde JWT'ye `gina` claim'ini yazar.
-- Supabase Dashboard / config.toml'da hook etkinleştirilir: pg-functions://postgres/public/custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_family_id uuid;
  v_role text := 'none';
  v_device_id uuid;
  v_child_id uuid;
  v_admin boolean := false;
begin
  select m.family_id into v_family_id
  from public.family_members m
  where m.user_id = v_user_id;

  if v_family_id is not null then
    v_role := 'parent';
  else
    select d.family_id, d.id, d.active_child_id
      into v_family_id, v_device_id, v_child_id
    from public.devices d
    where d.auth_user_id = v_user_id and d.revoked_at is null;

    if v_family_id is not null then
      v_role := 'device';
    end if;
  end if;

  select exists (select 1 from public.admins a where a.user_id = v_user_id) into v_admin;

  v_claims := jsonb_set(
    v_claims,
    '{gina}',
    jsonb_build_object(
      'family_id', v_family_id,
      'role', v_role,
      'device_id', v_device_id,
      'child_id', v_child_id,
      'admin', v_admin
    )
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.family_members, public.devices, public.admins to supabase_auth_admin;

create policy family_members_auth_admin_read on public.family_members
  for select to supabase_auth_admin using (true);

create policy devices_auth_admin_read on public.devices
  for select to supabase_auth_admin using (true);

create policy admins_auth_admin_read on public.admins
  for select to supabase_auth_admin using (true);
