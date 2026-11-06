-- D2 (C06 / C13-AUTH-1 remainder), 6 Nov 2026.
--
-- 1) child_mode_pin_status(): the parent's phone needs to know which child has a PIN so child mode can
--    follow the server rule (verify_child_pin returns true for a child without a PIN). Only a boolean per
--    child of the caller's active family; no hash, no counters.
-- 2) The parent who paired a tablet is remembered server-side (gina.device_pairers, never exposed to
--    clients) so that when the tablet says "this is not my family" (reject_device_pairing) that parent gets
--    an in-app inbox note. The note carries no personal data: no device name (typed on the tablet), no
--    family name, no child.
-- 3) gina.parent_inbox accepts the new kind 'device_pairing_rejected'.

-- 1) PIN status for child mode on the parent's phone ------------------------------------------------
create or replace function public.child_mode_pin_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'child_id', c.id,
             'pin_set', exists (select 1 from public.child_pins p where p.child_id = c.id))
           order by c.sort_order, c.id)
      from public.children c
     where c.family_id = gina.family_id() and c.archived_at is null), '[]'::jsonb);
end;
$$;
revoke all on function public.child_mode_pin_status() from public, anon;
grant execute on function public.child_mode_pin_status() to authenticated;

-- 2) Who paired the device --------------------------------------------------------------------------
create table gina.device_pairers (
  device_id uuid primary key references public.devices (id) on delete cascade,
  paired_by uuid references auth.users (id) on delete set null,
  paired_at timestamptz not null
);
revoke all on gina.device_pairers from public, anon, authenticated;
alter table gina.device_pairers enable row level security;

create or replace function gina.remember_device_pairer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' or new.paired_at is distinct from old.paired_at or new.family_id is distinct from old.family_id then
    insert into gina.device_pairers (device_id, paired_by, paired_at)
    values (new.id,
            case when exists (select 1 from public.family_members m where m.family_id = new.family_id and m.user_id = v_uid)
                 then v_uid end,
            new.paired_at)
    on conflict (device_id) do update set paired_by = excluded.paired_by, paired_at = excluded.paired_at;
  end if;
  return null;
end;
$$;
revoke all on function gina.remember_device_pairer() from public, anon, authenticated;
create trigger remember_device_pairer
  after insert or update of paired_at, family_id on public.devices
  for each row execute function gina.remember_device_pairer();

-- 3) Inbox kind -------------------------------------------------------------------------------------
alter table gina.parent_inbox drop constraint parent_inbox_kind_check;
alter table gina.parent_inbox add constraint parent_inbox_kind_check
  check (kind in ('announcement', 'education_start', 'education_end', 'device_pairing_rejected'));

-- 4) reject_device_pairing: same contract as 20261106340000, plus the parent's inbox note ------------
create or replace function public.reject_device_pairing()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_undo constant interval := interval '15 minutes';
  v_device public.devices%rowtype;
  v_pairer uuid;
begin
  select * into v_device from public.devices
   where auth_user_id = auth.uid() and revoked_at is null
   for update;
  if v_device.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_device.paired_at + c_undo < now() then
    raise exception 'pairing_undo_expired' using errcode = 'P0001';
  end if;
  update public.devices set revoked_at = now(), active_child_id = null where id = v_device.id;

  -- The parent who paired it (still in that family); unknown (paired before this migration) → every
  -- parent of the family, so the removal never goes unnoticed.
  select p.paired_by into v_pairer from gina.device_pairers p
   where p.device_id = v_device.id and p.paired_at = v_device.paired_at
     and exists (select 1 from public.family_members m where m.family_id = v_device.family_id and m.user_id = p.paired_by);
  insert into gina.parent_inbox (user_id, family_id, event_key, kind, title, body, expires_on)
  select m.user_id, v_device.family_id,
         'device_pairing_rejected:' || v_device.id || ':' || floor(extract(epoch from v_device.paired_at))::bigint,
         'device_pairing_rejected',
         'Bir tablet eşlemeyi geri aldı',
         'Eşlediğin bir tablet bu ailenin kendi ailesi olmadığını bildirdi ve bağlantıyı kaldırdı. Tablet cihaz listenden çıktı ve ailenin hiçbir bilgisine erişemez. Kendi tabletini eşlemek istediysen tablette yeni kod oluşturup kodu yeniden kontrol ederek tekrar dene.',
         current_date + 30
    from public.family_members m
   where m.family_id = v_device.family_id and (v_pairer is null or m.user_id = v_pairer)
  on conflict (user_id, event_key) do nothing;

  return jsonb_build_object('status', 'rejected', 'device_id', v_device.id);
end;
$$;
revoke all on function public.reject_device_pairing() from public, anon;
grant execute on function public.reject_device_pairing() to authenticated;
