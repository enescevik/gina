-- H01 (6 Nov 2026): Sign in with Apple token revocation on account deletion (App Store 5.1.1(v)).
--
-- 1) gina.apple_auth_tokens: one Apple token per account (refresh token preferred, access token as fallback),
--    obtained server-side by the `apple-token` / `delete-account` Edge functions from an Apple authorization
--    code (iOS native) or the provider refresh token Supabase returns after the web/Android OAuth flow.
--    The token is stored ONLY as AES-256-GCM ciphertext ("v1.<iv>.<ct>", base64url). The key lives in the Edge
--    secret APPLE_TOKEN_ENCRYPTION_KEY, never in the database, so a database dump alone does not reveal tokens.
--    (Vault is used in this repo only for a few deployment config values and is absent from the isolated test
--    template; per-user ciphertext + key outside the DB keeps the same "DB never holds plaintext" property and
--    stays testable.) Row is removed with the auth user (cascade).
-- 2) gina.apple_revocation_jobs: durable revocation job, created before the auth user is deleted and kept after
--    it (no FK), so an Apple outage never blocks deletion forever and never loses the revocation:
--      pending           token held (ciphertext), retried with exponential backoff by the worker
--      succeeded         Apple /auth/revoke returned 200; token erased
--      failed            Apple rejected the token (invalid_grant) or 12 attempts were exhausted; token erased
--      token_unavailable no token could be obtained (legacy account, Apple re-auth gave none); user is told to
--                        remove the app at appleid.apple.com (manual), nothing is claimed as revoked
--    request_id (client-generated per deletion attempt) makes the deletion idempotent: the same request never
--    creates a second job or revokes twice; another account can never reuse a request id.
-- 3) RPCs are service_role only (Edge functions); anon/authenticated have no access to tables or functions.
-- 4) pg_cron: worker every 15 min (Vault project_url + apple_revocation_secret, Edge APPLE_REVOCATION_SECRET),
--    terminal jobs purged after 12 months. Locally pg_cron may be absent: then only a notice.

create table gina.apple_auth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apple_sub text not null check (length(apple_sub) between 1 and 255),
  client_id text not null check (client_id ~ '^[A-Za-z0-9.-]{1,255}$'),
  token_type text not null check (token_type in ('refresh_token', 'access_token')),
  token_ciphertext text not null check (length(token_ciphertext) <= 8192 and token_ciphertext ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table gina.apple_auth_tokens enable row level security;
revoke all on gina.apple_auth_tokens from public, anon, authenticated, service_role;

create table gina.apple_revocation_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null,
  apple_sub text check (apple_sub is null or length(apple_sub) between 1 and 255),
  client_id text check (client_id is null or client_id ~ '^[A-Za-z0-9.-]{1,255}$'),
  token_type text check (token_type is null or token_type in ('refresh_token', 'access_token')),
  token_ciphertext text check (token_ciphertext is null or (length(token_ciphertext) <= 8192 and token_ciphertext ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$')),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'token_unavailable')),
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz,
  last_error text check (last_error is null or last_error ~ '^[a-z_]{1,64}$'),
  account_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint apple_revocation_pending_has_token check (
    (status = 'pending') = (token_ciphertext is not null and client_id is not null and token_type is not null and next_attempt_at is not null)),
  constraint apple_revocation_terminal_completed check ((status = 'pending') = (completed_at is null))
);
create index apple_revocation_jobs_due on gina.apple_revocation_jobs (next_attempt_at) where status = 'pending';
create index apple_revocation_jobs_user on gina.apple_revocation_jobs (user_id);
alter table gina.apple_revocation_jobs enable row level security;
revoke all on gina.apple_revocation_jobs from public, anon, authenticated, service_role;

-- Store (or replace) the account's Apple token ------------------------------------------------------------
create function public.apple_token_store(p_user_id uuid, p_apple_sub text, p_client_id text, p_token_type text, p_token_ciphertext text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into gina.apple_auth_tokens(user_id, apple_sub, client_id, token_type, token_ciphertext)
  values (p_user_id, p_apple_sub, p_client_id, p_token_type, p_token_ciphertext)
  on conflict (user_id) do update set apple_sub = excluded.apple_sub, client_id = excluded.client_id,
    token_type = excluded.token_type, token_ciphertext = excluded.token_ciphertext, updated_at = now();
end;
$$;

-- Start (or resume) the revocation of one deletion request ------------------------------------------------
-- A fresh token (p_token_ciphertext) wins over the stored one. Without any token: 'token_required' unless the
-- caller proved a fresh Apple re-authentication (p_allow_without_token), then a terminal token_unavailable job.
create function public.apple_revocation_begin(p_request_id uuid, p_user_id uuid, p_apple_sub text, p_client_id text default null,
  p_token_type text default null, p_token_ciphertext text default null, p_allow_without_token boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j gina.apple_revocation_jobs;
  t gina.apple_auth_tokens;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_request_id is null or p_user_id is null or p_apple_sub is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  if (p_token_ciphertext is null) <> (p_client_id is null) or (p_token_ciphertext is null) <> (p_token_type is null) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('apple_revocation:' || p_request_id::text, 0));
  select * into j from gina.apple_revocation_jobs where request_id = p_request_id for update;
  if found then
    if j.user_id <> p_user_id then return jsonb_build_object('status', 'request_conflict'); end if;
    if j.status = 'pending' and p_token_ciphertext is not null then
      update gina.apple_revocation_jobs set client_id = p_client_id, token_type = p_token_type, token_ciphertext = p_token_ciphertext,
        next_attempt_at = now(), updated_at = now() where id = j.id returning * into j;
    end if;
  else
    if p_token_ciphertext is null then
      select * into t from gina.apple_auth_tokens where user_id = p_user_id and apple_sub = p_apple_sub;
    end if;
    if p_token_ciphertext is null and t.user_id is null then
      if not coalesce(p_allow_without_token, false) then return jsonb_build_object('status', 'token_required'); end if;
      insert into gina.apple_revocation_jobs(request_id, user_id, status, last_error, completed_at)
      values (p_request_id, p_user_id, 'token_unavailable', 'no_token', now()) returning * into j;
    else
      insert into gina.apple_revocation_jobs(request_id, user_id, apple_sub, client_id, token_type, token_ciphertext, status, next_attempt_at)
      values (p_request_id, p_user_id, p_apple_sub, coalesce(p_client_id, t.client_id), coalesce(p_token_type, t.token_type),
              coalesce(p_token_ciphertext, t.token_ciphertext), 'pending', now())
      returning * into j;
    end if;
  end if;
  return jsonb_build_object('job_id', j.id, 'status', j.status, 'apple_sub', j.apple_sub, 'client_id', j.client_id,
    'token_type', j.token_type, 'token_ciphertext', j.token_ciphertext, 'attempts', j.attempts, 'last_error', j.last_error);
end;
$$;

-- Record one revocation attempt --------------------------------------------------------------------------
-- succeeded / failed are terminal and erase the token; retry backs off 5 min * 2^attempts (max 24 h) and turns
-- into failed after 12 attempts. A terminal job is never changed again (repeat calls return its status).
create function public.apple_revocation_record(p_job_id uuid, p_outcome text, p_error text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j gina.apple_revocation_jobs;
  v_error text := case when p_error ~ '^[a-z_]{1,64}$' then p_error else null end;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_outcome not in ('succeeded', 'retry', 'failed') then raise exception 'invalid_input' using errcode = '22023'; end if;
  select * into j from gina.apple_revocation_jobs where id = p_job_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if j.status <> 'pending' then return j.status; end if;
  if p_outcome = 'retry' and j.attempts + 1 < 12 then
    update gina.apple_revocation_jobs set attempts = attempts + 1, last_error = coalesce(v_error, 'apple_error'),
      next_attempt_at = now() + least(interval '5 minutes' * power(2, j.attempts), interval '24 hours'), updated_at = now()
     where id = j.id;
    return 'pending';
  end if;
  update gina.apple_revocation_jobs
     set status = case when p_outcome = 'succeeded' then 'succeeded' else 'failed' end,
         attempts = attempts + 1,
         last_error = case when p_outcome = 'succeeded' then null when p_outcome = 'retry' then 'max_attempts' else coalesce(v_error, 'apple_error') end,
         token_ciphertext = null, client_id = null, token_type = null, next_attempt_at = null, apple_sub = null,
         completed_at = now(), updated_at = now()
   where id = j.id returning * into j;
  -- The token is gone at Apple (or unusable): never keep a stored copy of it.
  delete from gina.apple_auth_tokens where user_id = j.user_id;
  return j.status;
end;
$$;

-- Worker claim: due pending jobs, leased for 10 minutes (concurrent workers skip locked rows) ---------------
create function public.apple_revocation_claim(p_limit integer default 20)
returns table(job_id uuid, client_id text, token_type text, token_ciphertext text, apple_sub text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with due as (
    select d.id from gina.apple_revocation_jobs d
     where d.status = 'pending' and d.next_attempt_at <= now()
     order by d.next_attempt_at
     limit least(greatest(coalesce(p_limit, 20), 1), 50)
     for update skip locked)
  update gina.apple_revocation_jobs j set next_attempt_at = now() + interval '10 minutes', updated_at = now()
    from due where j.id = due.id
  returning j.id, j.client_id, j.token_type, j.token_ciphertext, j.apple_sub, j.attempts;
end;
$$;

create function public.apple_revocation_mark_deleted(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  update gina.apple_revocation_jobs set account_deleted_at = coalesce(account_deleted_at, now()), updated_at = now() where id = p_job_id;
end;
$$;

revoke all on function public.apple_token_store(uuid, text, text, text, text),
  public.apple_revocation_begin(uuid, uuid, text, text, text, text, boolean),
  public.apple_revocation_record(uuid, text, text),
  public.apple_revocation_claim(integer),
  public.apple_revocation_mark_deleted(uuid)
  from public, anon, authenticated;
grant execute on function public.apple_token_store(uuid, text, text, text, text),
  public.apple_revocation_begin(uuid, uuid, text, text, text, text, boolean),
  public.apple_revocation_record(uuid, text, text),
  public.apple_revocation_claim(integer),
  public.apple_revocation_mark_deleted(uuid)
  to service_role;

-- Retention: terminal jobs (no token, no Apple subject) are kept 12 months as deletion evidence.
create function gina.purge_apple_revocation_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from gina.apple_revocation_jobs where status <> 'pending' and completed_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function gina.purge_apple_revocation_jobs() from public, anon, authenticated, service_role;

-- Deployment provisions Vault project_url + apple_revocation_secret and Edge APPLE_REVOCATION_SECRET.
do $$ begin
  perform cron.schedule('apple-revocation-worker', '*/15 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/apple-revocation-worker',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'apple_revocation_secret')),
      body := '{}'::jsonb)
    where exists (select 1 from gina.apple_revocation_jobs where status = 'pending' and next_attempt_at <= now())
      and exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'apple_revocation_secret');
  $job$);
  perform cron.schedule('purge-apple-revocation-jobs', '45 3 * * *', $cmd$ select gina.purge_apple_revocation_jobs() $cmd$);
exception when invalid_schema_name or undefined_function then
  raise notice 'apple revocation cron unavailable; provision pg_cron/pg_net before enabling Apple sign-in deletion retries';
end; $$;
