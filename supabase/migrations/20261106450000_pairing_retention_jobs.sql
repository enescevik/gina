-- D17 (D16 §4.2 / §4.3), 6 Nov 2026: make the code honour the retention the privacy texts promise.
--
-- 1) gina.prune_unused_devices(): a paired device that has not been used for 90 days is unpaired, exactly
--    like a parent's revoke_device (revoked_at = now(), active_child_id = null; the row and its history stay,
--    the access-token hook drops the role to 'none' on the next refresh, the tablet can request a new code).
--    "Used" is the most recent of every server-side signal the device leaves; there is no new client write:
--      * devices.paired_at (a fresh pairing is never pruned),
--      * devices.last_seen_at (child_pin_login / child selection on the device),
--      * auth.users.last_sign_in_at of the device's anonymous user,
--      * auth.sessions.refreshed_at / updated_at and auth.refresh_tokens.updated_at of that user (GoTrue writes
--        these on every token refresh, i.e. at least hourly while the app is open, so a tablet in daily use
--        always has a fresh signal even if the same child stays selected for months),
--      * push_tokens.updated_at of the device's own push token (re-registered on app start).
--    A device is removed only when ALL of them are older than 90 days (safest reading of "unused"). Each
--    parent of the family gets one in-app inbox note (kind 'device_unused_removed'); the note carries no
--    personal data (no device name, no child, no family name).
-- 2) gina.prune_pairing_records(): periodic cleanup of the pairing guard's server-only tables, so a parent who
--    never retries does not keep attempt rows until account deletion:
--      * device_pairing_attempts older than 1 day (the lock counts only the last 10 minutes, so the lockout
--        result is unchanged),
--      * device_pairing_locks whose locked_until has passed (an active lock is never touched),
--      * device_pairing_previews and device_pairings that expired more than 1 day ago (both live <= 10 minutes).
-- 3) pg_cron: both run daily (03:25 / 03:35 UTC). Locally pg_cron may be absent: then only a notice.
--
-- Both functions take p_now (default now()) only so tests can evaluate "as of" a fixed past instant; it is
-- clamped to least(p_now, now()), so a future p_now can never remove more than a run at the real clock would
-- (no fresh device, no attempt inside the 10-minute window, no running lock). They are executable by the owner
-- (cron runs as postgres) and nobody else: revoked from public, anon, authenticated and service_role.

-- Inbox kind ------------------------------------------------------------------------------------------
alter table gina.parent_inbox drop constraint parent_inbox_kind_check;
alter table gina.parent_inbox add constraint parent_inbox_kind_check
  check (kind in ('announcement', 'education_start', 'education_end', 'device_pairing_rejected', 'device_unused_removed'));

-- 1) Unused paired devices ----------------------------------------------------------------------------
create or replace function gina.device_last_used_at(p_device_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
           d.paired_at,
           d.last_seen_at,
           (select u.last_sign_in_at from auth.users u where u.id = d.auth_user_id),
           (select max(greatest(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at))
              from auth.sessions s where s.user_id = d.auth_user_id),
           (select max(coalesce(r.updated_at, r.created_at))
              from auth.refresh_tokens r where r.user_id = d.auth_user_id::text),
           (select max(t.updated_at) from public.push_tokens t where t.device_id = d.id))
    from public.devices d
   where d.id = p_device_id;
$$;
revoke all on function gina.device_last_used_at(uuid) from public, anon, authenticated, service_role;

create or replace function gina.prune_unused_devices(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_idle constant interval := interval '90 days';
  v_now timestamptz := least(coalesce(p_now, now()), now());
  v_count integer;
begin
  with stale as (
    select d.id
      from public.devices d
     where d.revoked_at is null
       and d.paired_at < v_now - c_idle                       -- cheap pre-filter
       and gina.device_last_used_at(d.id) < v_now - c_idle
       for update of d skip locked                            -- a pairing/login in flight wins
  ), removed as (
    update public.devices d
       set revoked_at = now(), active_child_id = null
      from stale
     where d.id = stale.id
       and d.revoked_at is null
       and gina.device_last_used_at(d.id) < v_now - c_idle   -- re-checked under the row lock
    returning d.id, d.family_id, d.paired_at
  ), noted as (
    insert into gina.parent_inbox (user_id, family_id, event_key, kind, title, body, expires_on)
    select m.user_id, r.family_id,
           'device_unused_removed:' || r.id || ':' || floor(extract(epoch from r.paired_at))::bigint,
           'device_unused_removed',
           'Kullanılmayan bir tablet kaldırıldı',
           'Ailene eşlenmiş bir tablet 90 gündür kullanılmadığı için eşleştirmesi kendiliğinden kaldırıldı. Tablet cihaz listenden çıktı ve ailenin hiçbir bilgisine erişemez. Tableti yeniden kullanmak istersen tablette yeni kod oluşturup yeniden eşleyebilirsin.',
           (now() at time zone 'Europe/Istanbul')::date + 30
      from removed r
      join public.family_members m on m.family_id = r.family_id
    on conflict (user_id, event_key) do nothing
    returning 1
  )
  select count(*)::int into v_count from removed;
  return v_count;
end;
$$;
revoke all on function gina.prune_unused_devices(timestamptz) from public, anon, authenticated, service_role;

-- 2) Pairing guard records ----------------------------------------------------------------------------
create or replace function gina.prune_pairing_records(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_locks integer;
  v_previews integer;
  v_codes integer;
  v_now timestamptz := least(coalesce(p_now, now()), now());
begin
  delete from public.device_pairing_attempts where tried_at < v_now - interval '1 day';
  get diagnostics v_attempts = row_count;
  delete from public.device_pairing_locks where locked_until <= v_now;
  get diagnostics v_locks = row_count;
  delete from public.device_pairing_previews where expires_at < v_now - interval '1 day';
  get diagnostics v_previews = row_count;
  delete from public.device_pairings where expires_at < v_now - interval '1 day';
  get diagnostics v_codes = row_count;
  return jsonb_build_object('attempts', v_attempts, 'locks', v_locks, 'previews', v_previews, 'codes', v_codes);
end;
$$;
revoke all on function gina.prune_pairing_records(timestamptz) from public, anon, authenticated, service_role;

-- 3) Schedules ----------------------------------------------------------------------------------------
do $job$
begin
  perform cron.schedule('prune-unused-devices', '25 3 * * *', $cmd$ select gina.prune_unused_devices() $cmd$);
  perform cron.schedule('prune-pairing-records', '35 3 * * *', $cmd$ select gina.prune_pairing_records() $cmd$);
exception when invalid_schema_name or undefined_function then
  raise notice 'pairing retention jobs require pg_cron at deployment';
end
$job$;
