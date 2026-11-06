-- C13-AUTH-1 (P0): device pairing codes could be brute-forced.
--
-- Before: 6-digit numeric code (10^6), 10 min life, no attempt limit on preview_device_pairing /
-- pair_device / pair_child_device. Any signed-up parent could enumerate codes and attach a stranger's
-- waiting tablet to their own family. pair_device raises on a wrong code, so the failed attempt was
-- rolled back and could not be counted.
--
-- After:
-- 1) request_pairing returns an 8-character code from a 22-symbol alphabet without look-alikes
--    (ACDEFHJKMNPRTUVWXY3479; 22^8 ≈ 5.5·10^10), drawn from gen_random_bytes with rejection sampling.
--    Clients show it as 4+4 groups; input is normalised (case, spaces, dashes).
-- 2) preview_device_pairing no longer raises for a wrong code: it returns a status, so a failed attempt
--    is committed. Sliding window: 10 failed previews in 10 min per user → 15 min lock; 20 per family
--    (all parents together) → 15 min family lock. A locked caller gets `pairing_locked` + seconds left
--    and no lookup happens. A successful preview returns a single-use `preview_token`, valid for 5 min
--    (never past the code's own expiry), bound to the user, the active family and the code. Successful
--    previews do not reset the failure counter (an attacker's own tablet cannot launder attempts).
-- 3) pair_device / pair_child_device need (p_code, p_preview_token). The legacy one-argument
--    signatures (installed 26/27 clients) raise `client_update_required`: no new pairing from an old
--    client, already paired devices are untouched (no device row is modified by this migration).
-- 4) The paired tablet can see which family received it (device_pairing_status) and, with its own
--    session only and only within 15 minutes after pairing, undo it (reject_device_pairing) and ask for
--    a new code.

-- 0) Code format ------------------------------------------------------------------------------------
-- Outstanding 6-digit codes (≤ 10 min old) are dropped; the tablet simply asks for a new code.
delete from public.device_pairings where code !~ '^[ACDEFHJKMNPRTUVWXY3479]{8}$';
alter table public.device_pairings
  add constraint device_pairings_code_format check (code ~ '^[ACDEFHJKMNPRTUVWXY3479]{8}$');

create or replace function gina.pairing_code_alphabet() returns text
language sql immutable set search_path = '' as $$ select 'ACDEFHJKMNPRTUVWXY3479'::text $$;

-- Upper-case, drop whitespace and dashes ("acde-fh34", "ACDE FH34" → "ACDEFH34").
create or replace function gina.normalize_pairing_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'))
$$;

create or replace function gina.new_pairing_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := gina.pairing_code_alphabet();
  v_n constant int := length(gina.pairing_code_alphabet());   -- 22
  v_limit constant int := 256 - (256 % length(gina.pairing_code_alphabet())); -- 242: no modulo bias
  v_bytes bytea;
  v_code text := '';
  v_byte int;
begin
  while length(v_code) < 8 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v_byte := get_byte(v_bytes, i);
      if v_byte < v_limit and length(v_code) < 8 then
        v_code := v_code || substr(v_alphabet, (v_byte % v_n) + 1, 1);
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;
revoke all on function gina.pairing_code_alphabet(), gina.normalize_pairing_code(text), gina.new_pairing_code() from public, anon, authenticated;

-- Tablet (anonymous user): unchanged contract (returns the code text), new code space.
create or replace function public.request_pairing(p_device_name text default 'Tablet')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'parent_user' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.devices where auth_user_id = v_uid and revoked_at is null) then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  delete from public.device_pairings where auth_user_id = v_uid or expires_at < now();

  loop
    v_code := gina.new_pairing_code();
    exit when not exists (select 1 from public.device_pairings where code = v_code);
  end loop;

  insert into public.device_pairings (code, auth_user_id, device_name)
    values (v_code, v_uid, left(coalesce(nullif(trim(p_device_name), ''), 'Tablet'), 60));
  return v_code;
end;
$$;
revoke all on function public.request_pairing(text) from public, anon;
grant execute on function public.request_pairing(text) to authenticated;

-- 1) Attempt log, locks, preview tokens (server-only tables) ---------------------------------------
create table public.device_pairing_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid references public.families (id) on delete cascade,
  ok boolean not null,
  tried_at timestamptz not null default now()
);
create index device_pairing_attempts_user_idx on public.device_pairing_attempts (user_id, tried_at) where not ok;
create index device_pairing_attempts_family_idx on public.device_pairing_attempts (family_id, tried_at) where not ok;

create table public.device_pairing_locks (
  scope text not null check (scope in ('user', 'family')),
  subject uuid not null,
  locked_until timestamptz not null,
  primary key (scope, subject)
);

create table public.device_pairing_previews (
  token uuid primary key default gen_random_uuid(),
  code text not null references public.device_pairings (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index device_pairing_previews_user_idx on public.device_pairing_previews (user_id);
create index device_pairing_previews_code_idx on public.device_pairing_previews (code);

alter table public.device_pairing_attempts enable row level security;
alter table public.device_pairing_locks enable row level security;
alter table public.device_pairing_previews enable row level security;
revoke all on public.device_pairing_attempts, public.device_pairing_locks, public.device_pairing_previews from public, anon, authenticated;

-- 2) Preview: counted attempts, lock, single-use token ---------------------------------------------
create or replace function public.preview_device_pairing(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_window constant interval := interval '10 minutes';
  c_lock constant interval := interval '15 minutes';
  c_user_limit constant int := 10;
  c_family_limit constant int := 20;
  v_uid uuid := auth.uid();
  v_family uuid := gina.family_id();
  v_code text := gina.normalize_pairing_code(p_code);
  v_locked_until timestamptz;
  v_pairing public.device_pairings%rowtype;
  v_user_fails int;
  v_family_fails int;
  v_token uuid;
  v_token_expires timestamptz;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Serialise one user's (and one family's) attempts so parallel requests cannot overrun the count.
  perform pg_advisory_xact_lock(hashtextextended('pairing:user:' || v_uid::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('pairing:family:' || v_family::text, 0));

  delete from public.device_pairing_attempts where user_id = v_uid and tried_at < now() - interval '1 day';
  delete from public.device_pairing_locks where locked_until <= now()
    and ((scope = 'user' and subject = v_uid) or (scope = 'family' and subject = v_family));

  select max(locked_until) into v_locked_until from public.device_pairing_locks
   where (scope = 'user' and subject = v_uid) or (scope = 'family' and subject = v_family);
  if v_locked_until is not null then
    return jsonb_build_object('status', 'pairing_locked', 'locked_until', v_locked_until,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_locked_until - now()))))::int);
  end if;

  if v_code ~ ('^[' || gina.pairing_code_alphabet() || ']{8}$') then
    select * into v_pairing from public.device_pairings
     where code = v_code and consumed_at is null and expires_at >= now();
  end if;

  if v_pairing.code is null then
    insert into public.device_pairing_attempts (user_id, family_id, ok) values (v_uid, v_family, false);
    select count(*) into v_user_fails from public.device_pairing_attempts
     where user_id = v_uid and not ok and tried_at > now() - c_window;
    select count(*) into v_family_fails from public.device_pairing_attempts
     where family_id = v_family and not ok and tried_at > now() - c_window;
    if v_user_fails >= c_user_limit then
      insert into public.device_pairing_locks values ('user', v_uid, now() + c_lock)
        on conflict (scope, subject) do update set locked_until = excluded.locked_until;
    end if;
    if v_family_fails >= c_family_limit then
      insert into public.device_pairing_locks values ('family', v_family, now() + c_lock)
        on conflict (scope, subject) do update set locked_until = excluded.locked_until;
    end if;
    if v_user_fails >= c_user_limit or v_family_fails >= c_family_limit then
      return jsonb_build_object('status', 'pairing_locked', 'locked_until', now() + c_lock,
        'retry_after_seconds', extract(epoch from c_lock)::int);
    end if;
    return jsonb_build_object('status', 'invalid_or_expired',
      'attempts_left', least(c_user_limit - v_user_fails, c_family_limit - v_family_fails));
  end if;

  insert into public.device_pairing_attempts (user_id, family_id, ok) values (v_uid, v_family, true);
  -- One live token per user: a new preview replaces the previous unused one.
  delete from public.device_pairing_previews where user_id = v_uid and used_at is null;
  v_token_expires := least(now() + interval '5 minutes', v_pairing.expires_at);
  insert into public.device_pairing_previews (code, user_id, family_id, expires_at)
    values (v_pairing.code, v_uid, v_family, v_token_expires)
    returning token into v_token;

  return jsonb_build_object(
    'status', 'ok',
    'device_name', v_pairing.device_name,
    'expires_at', v_pairing.expires_at,
    'seconds_left', greatest(0, floor(extract(epoch from (v_pairing.expires_at - now())))::int),
    'family_name', (select name from public.families where id = v_family),
    'preview_token', v_token,
    'token_expires_at', v_token_expires,
    'token_seconds_left', greatest(0, floor(extract(epoch from (v_token_expires - now())))::int)
  );
end;
$$;
revoke all on function public.preview_device_pairing(text) from public, anon;
grant execute on function public.preview_device_pairing(text) to authenticated;

-- 3) Pairing only with a preview token -------------------------------------------------------------
create or replace function public.pair_device(p_code text, p_preview_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid := gina.family_id();
  v_preview public.device_pairing_previews%rowtype;
  v_pairing public.device_pairings%rowtype;
  v_device_id uuid;
  v_plan public.plans;
  v_count int;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_preview_token is null
     or p_preview_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_preview_token' using errcode = 'P0001';
  end if;

  select * into v_preview from public.device_pairing_previews
   where token = p_preview_token::uuid
   for update;
  if v_preview.token is null
     or v_preview.user_id <> v_uid
     or v_preview.family_id is distinct from v_family
     or v_preview.used_at is not null
     or v_preview.expires_at < now()
     or v_preview.code <> gina.normalize_pairing_code(p_code) then
    raise exception 'invalid_preview_token' using errcode = 'P0001';
  end if;

  select * into v_pairing from public.device_pairings
   where code = v_preview.code and consumed_at is null and expires_at >= now()
   for update;
  if v_pairing.code is null then
    raise exception 'invalid_or_expired_code' using errcode = 'P0001';
  end if;

  select pl.* into v_plan from public.plans pl
    join public.get_family_entitlement(v_family) e on pl.code = e.plan;
  if v_plan.max_devices is not null then
    select count(*) into v_count from public.devices
      where family_id = v_family and revoked_at is null;
    if v_count >= v_plan.max_devices then
      raise exception 'plan_limit_devices' using errcode = 'P0001',
        detail = format('limit=%s', v_plan.max_devices);
    end if;
  end if;

  insert into public.devices (family_id, auth_user_id, name)
    values (v_family, v_pairing.auth_user_id, v_pairing.device_name)
  on conflict (auth_user_id) do update
    set family_id = excluded.family_id, name = excluded.name, revoked_at = null, active_child_id = null, paired_at = now()
  returning id into v_device_id;

  update public.device_pairings set consumed_at = now() where code = v_pairing.code;
  update public.device_pairing_previews set used_at = now() where token = v_preview.token;
  -- Other parents' tokens for this code are dead (code consumed); drop them.
  delete from public.device_pairing_previews where code = v_pairing.code and token <> v_preview.token;
  return v_device_id;
end;
$$;

create or replace function public.pair_child_device(p_code text, p_preview_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_device_id uuid;
begin
  v_device_id := public.pair_device(p_code, p_preview_token);
  update public.devices set access_mode = 'selected', pin_policy = 'required', active_child_id = null where id = v_device_id;
  delete from public.device_children where device_children.device_id = v_device_id;
  return v_device_id;
end;
$$;

-- Legacy signatures (26/27 clients): no token → no new pairing. Existing devices are not touched.
create or replace function public.pair_device(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  raise exception 'client_update_required' using errcode = 'P0001',
    hint = 'Pairing needs preview_device_pairing + pair_child_device(p_code, p_preview_token).';
end;
$$;
create or replace function public.pair_child_device(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  raise exception 'client_update_required' using errcode = 'P0001',
    hint = 'Pairing needs preview_device_pairing + pair_child_device(p_code, p_preview_token).';
end;
$$;

revoke all on function public.pair_device(text), public.pair_device(text, text),
  public.pair_child_device(text), public.pair_child_device(text, text) from public, anon;
grant execute on function public.pair_device(text), public.pair_device(text, text),
  public.pair_child_device(text), public.pair_child_device(text, text) to authenticated;

-- 4) Device-side visibility and undo ---------------------------------------------------------------
-- Called by the tablet's own (anonymous) session right after pairing: which family received it and
-- whether the "not my family" undo is still open. Nothing about the family beyond its name.
create or replace function public.device_pairing_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_undo constant interval := interval '15 minutes';
  v_device public.devices%rowtype;
begin
  select * into v_device from public.devices where auth_user_id = auth.uid() and revoked_at is null;
  if v_device.id is null then
    return jsonb_build_object('status', 'not_paired');
  end if;
  return jsonb_build_object(
    'status', 'paired',
    'family_name', (select name from public.families where id = v_device.family_id),
    'device_name', v_device.name,
    'paired_at', v_device.paired_at,
    'undo_seconds_left', greatest(0, floor(extract(epoch from (v_device.paired_at + c_undo - now())))::int)
  );
end;
$$;

-- "Bu benim ailem değil": only the paired tablet itself, only within 15 minutes after pairing.
-- The device is revoked (same state as a parent removing it); the tablet then requests a new code.
create or replace function public.reject_device_pairing()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_undo constant interval := interval '15 minutes';
  v_device public.devices%rowtype;
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
  return jsonb_build_object('status', 'rejected', 'device_id', v_device.id);
end;
$$;
revoke all on function public.device_pairing_status(), public.reject_device_pairing() from public, anon;
grant execute on function public.device_pairing_status(), public.reject_device_pairing() to authenticated;
