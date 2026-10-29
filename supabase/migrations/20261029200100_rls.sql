-- RLS: deny-by-default. Yetki JWT'deki `gina` claim'inden okunur (20261029200200_auth_hook.sql üretir).
-- Roller: parent (aile üyesi), device (eşleştirilmiş çocuk tableti), none (henüz eşleşmemiş anonim kullanıcı).

-- Claim yardımcıları -----------------------------------------------------------

create or replace function gina.claims()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'gina', '{}'::jsonb);
$$;

create or replace function gina.family_id()
returns uuid
language sql
stable
as $$
  select nullif(gina.claims() ->> 'family_id', '')::uuid;
$$;

create or replace function gina.role()
returns text
language sql
stable
as $$
  select coalesce(gina.claims() ->> 'role', 'none');
$$;

create or replace function gina.child_id()
returns uuid
language sql
stable
as $$
  select nullif(gina.claims() ->> 'child_id', '')::uuid;
$$;

create or replace function gina.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((gina.claims() ->> 'admin')::boolean, false);
$$;

create or replace function gina.is_parent()
returns boolean
language sql
stable
as $$
  select gina.role() = 'parent' and gina.family_id() is not null;
$$;

-- Cihaz: claim'e ek olarak satırın hâlâ iptal edilmemiş olması aranır (token 1 saat yaşayabilir).
create or replace function gina.is_device()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select gina.role() = 'device'
     and exists (
       select 1 from public.devices d
       where d.auth_user_id = auth.uid() and d.revoked_at is null
     );
$$;

revoke execute on function gina.is_device() from public, anon;
grant execute on function gina.claims(), gina.family_id(), gina.role(), gina.child_id(), gina.is_admin(), gina.is_parent(), gina.is_device() to authenticated, service_role;

-- Varsayılan izinler --------------------------------------------------------------

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Hash tabloları yalnız SECURITY DEFINER fonksiyonlarca okunur.
revoke all on public.parent_pins, public.child_pins, public.device_pairings from authenticated, anon;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.parent_pins enable row level security;
alter table public.children enable row level security;
alter table public.child_pins enable row level security;
alter table public.devices enable row level security;
alter table public.device_pairings enable row level security;
alter table public.events enable row level security;
alter table public.event_exceptions enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_completions enable row level security;
alter table public.star_events enable row level security;
alter table public.notes enable row level security;
alter table public.grades enable row level security;
alter table public.admins enable row level security;
alter table public.holidays enable row level security;
alter table public.app_settings enable row level security;

-- families ------------------------------------------------------------------------

create policy families_select on public.families
  for select to authenticated
  using (id = gina.family_id() and (gina.is_parent() or gina.is_device()));

create policy families_update_parent on public.families
  for update to authenticated
  using (id = gina.family_id() and gina.is_parent())
  with check (id = gina.family_id() and gina.is_parent());

-- family_members ----------------------------------------------------------------

create policy family_members_select on public.family_members
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

create policy family_members_delete_self on public.family_members
  for delete to authenticated
  using (user_id = auth.uid());

-- children ------------------------------------------------------------------------

create policy children_parent_all on public.children
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy children_device_select on public.children
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_device());

-- devices -------------------------------------------------------------------------

create policy devices_parent_select on public.devices
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

create policy devices_parent_update on public.devices
  for update to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy devices_self_select on public.devices
  for select to authenticated
  using (auth_user_id = auth.uid());

-- events --------------------------------------------------------------------------

create policy events_parent_all on public.events
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy events_device_select on public.events
  for select to authenticated
  using (
    family_id = gina.family_id()
    and gina.is_device()
    and visible_to_child
    and (child_id is null or child_id = gina.child_id())
  );

create policy event_exceptions_parent_all on public.event_exceptions
  for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.family_id = gina.family_id() and gina.is_parent()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.family_id = gina.family_id() and gina.is_parent()));

create policy event_exceptions_device_select on public.event_exceptions
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.family_id = gina.family_id() and gina.is_device()));

-- task_templates -----------------------------------------------------------------

create policy task_templates_parent_all on public.task_templates
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy task_templates_device_select on public.task_templates
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id() and active);

-- task_completions: yazma yalnız RPC ile (complete_task, undo_complete, review_task) -------

create policy task_completions_parent_select on public.task_completions
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

create policy task_completions_device_select on public.task_completions
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

-- star_events: yazma yalnız RPC ile ------------------------------------------------

create policy star_events_parent_select on public.star_events
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

create policy star_events_device_select on public.star_events
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

-- notes ---------------------------------------------------------------------------

create policy notes_parent_all on public.notes
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy notes_device_select on public.notes
  for select to authenticated
  using (
    family_id = gina.family_id()
    and gina.is_device()
    and child_id = gina.child_id()
    and (visibility = 'child' or author_child_id = gina.child_id())
  );

create policy notes_device_insert on public.notes
  for insert to authenticated
  with check (
    family_id = gina.family_id()
    and gina.is_device()
    and child_id = gina.child_id()
    and author_child_id = gina.child_id()
    and author_user_id is null
    and visibility in ('child', 'family')
  );

create policy notes_device_update_own on public.notes
  for update to authenticated
  using (family_id = gina.family_id() and gina.is_device() and author_child_id = gina.child_id())
  with check (family_id = gina.family_id() and gina.is_device() and author_child_id = gina.child_id() and visibility in ('child', 'family'));

-- grades: yalnız ebeveyn --------------------------------------------------------------

create policy grades_parent_all on public.grades
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

-- admins: herkes yalnız kendi satırını görür ------------------------------------------

create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- holidays ve app_settings: okuma herkese (giriş yapmış), yazma yalnız admin --------------

create policy holidays_select on public.holidays
  for select to authenticated
  using (true);

create policy holidays_admin_write on public.holidays
  for all to authenticated
  using (gina.is_admin())
  with check (gina.is_admin());

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (gina.is_admin())
  with check (gina.is_admin());
