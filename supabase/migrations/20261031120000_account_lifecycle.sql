-- Revoke stale JWT access immediately; account deletion is atomic with Auth's hard delete.
create or replace function gina.is_parent()
returns boolean language sql stable security definer set search_path = '' as $$
  select gina.role() = 'parent' and exists (
    select 1 from public.family_members m where m.user_id = auth.uid() and m.family_id = gina.family_id()
  );
$$;
create or replace function gina.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((gina.claims() ->> 'admin')::boolean, false)
    and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
create or replace function gina.is_device()
returns boolean language sql stable security definer set search_path = '' as $$
  select gina.role() = 'device' and exists (
    select 1 from public.devices d
    where d.auth_user_id = auth.uid() and d.revoked_at is null
      and d.family_id = gina.family_id()
      and d.active_child_id is not distinct from gina.child_id()
  );
$$;
revoke execute on function gina.is_parent(), gina.is_admin(), gina.is_device() from public, anon;
grant execute on function gina.is_parent(), gina.is_admin(), gina.is_device() to authenticated, service_role;

create or replace function gina.prepare_account_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  f record;
  successor uuid;
  device_users uuid[];
begin
  -- This also avoids notes' non-null author CHECK failing on ON DELETE SET NULL.
  delete from public.notes where author_user_id = old.id;
  delete from public.child_shares where created_by = old.id;
  for f in
    select families.id, families.created_by from public.families
    where families.created_by = old.id or exists (
      select 1 from public.family_members m where m.family_id = families.id and m.user_id = old.id
    ) order by families.id for update
  loop
    -- Serialise two parents deleting their accounts together.
    select m.user_id into successor from public.family_members m
      where m.family_id = f.id and m.user_id <> old.id order by m.created_at, m.user_id limit 1;
    if successor is not null then
      if f.created_by = old.id then
        update public.families set created_by = successor where id = f.id;
      end if;
      delete from public.family_members where family_id = f.id and user_id = old.id;
    else
      select array_agg(d.auth_user_id) into device_users from public.devices d where d.family_id = f.id;
      -- Remove all child data through declared foreign keys. Remove anonymous device Auth accounts too.
      delete from public.audit_log where family_id = f.id;
      delete from public.families where id = f.id;
      delete from auth.users where id = any(coalesce(device_users, '{}'::uuid[])) and is_anonymous = true;
      -- Cascades can generate audit rows with a null family FK but an old/new JSON snapshot.
      delete from public.audit_log where details::text like '%' || f.id::text || '%';
    end if;
  end loop;
  return old;
end;
$$;

create or replace function gina.finish_account_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- FK SET NULL updates may have created audit entries after the BEFORE trigger.
  delete from public.audit_log where actor_id = old.id or details::text like '%' || old.id::text || '%';
  return old;
end;
$$;
revoke execute on function gina.prepare_account_deletion(), gina.finish_account_deletion() from public, anon, authenticated, service_role;
create trigger gina_prepare_account_deletion before delete on auth.users for each row execute function gina.prepare_account_deletion();
create trigger gina_finish_account_deletion after delete on auth.users for each row execute function gina.finish_account_deletion();
