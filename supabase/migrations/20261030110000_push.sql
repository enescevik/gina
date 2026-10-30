-- Push bildirimleri: cihaz token'ları, veli tercihleri, outbox ve kuyruğa alma tetikleyicileri.
-- Kurallar (docs/DECISIONS.md): push içeriği kişisel veri taşımaz (çocuk adı, not, puan yok);
-- outbox payload'ı yalnız kimlik (uuid) taşır, metin push-send içinde dile göre seçilir.
-- Gönderim: supabase/functions/push-send (APNs + FCM HTTP v1). Firebase SDK uygulamaya girmez.
-- Dosya yeniden uygulanabilir (if not exists / or replace / drop if exists).

-- Token'lar --------------------------------------------------------------------------------

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('parent', 'device')),
  device_id uuid references public.devices (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique check (char_length(token) between 8 and 4096),
  token_type text not null check (token_type in ('apns', 'fcm')),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'device') = (device_id is not null)),
  check ((platform = 'ios' and token_type = 'apns') or (platform = 'android' and token_type = 'fcm'))
);
create index if not exists push_tokens_family_idx on public.push_tokens (family_id, role);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at before update on public.push_tokens
  for each row execute function gina.set_updated_at();

-- Veli bildirim tercihleri (satır yoksa hepsi açık sayılır) ---------------------------------

create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  approvals boolean not null default true, -- onay bekleyen görev
  exams boolean not null default true, -- deneme bitti
  weekly_summary boolean not null default true, -- haftalık özet hazır (pg_cron, Faz 2)
  updated_at timestamptz not null default now()
);
drop trigger if exists push_preferences_set_updated_at on public.push_preferences;
create trigger push_preferences_set_updated_at before update on public.push_preferences
  for each row execute function gina.set_updated_at();

-- Outbox: yalnız service_role (push-send) okur/yazar ------------------------------------------

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  audience text not null check (audience in ('parents', 'device')),
  target_child_id uuid references public.children (id) on delete cascade, -- device: hangi çocuğun tableti
  exclude_user_id uuid, -- eylemi yapan kullanıcıya kendi bildirimi gitmez
  kind text not null check (kind in ('task_awaiting_approval', 'task_approved', 'task_returned', 'exam_assigned', 'exam_finished', 'weekly_summary')),
  payload jsonb not null default '{}'::jsonb, -- yalnız kimlikler: completion_id, exam_id, attempt_id
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'no_targets', 'skipped_unconfigured', 'failed')),
  attempts smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
create index if not exists push_outbox_pending_idx on public.push_outbox (created_at) where status in ('pending', 'sending');

-- RLS ------------------------------------------------------------------------------------

alter table public.push_tokens enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_outbox enable row level security;

revoke all on public.push_tokens, public.push_preferences, public.push_outbox from anon, authenticated;
grant select, delete on public.push_tokens to authenticated; -- yazma register_push_token RPC'siyle
grant select, insert, update on public.push_preferences to authenticated;
grant all on public.push_tokens, public.push_preferences, public.push_outbox to service_role;

drop policy if exists push_tokens_own_select on public.push_tokens;
create policy push_tokens_own_select on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_tokens_own_delete on public.push_tokens;
create policy push_tokens_own_delete on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists push_preferences_own on public.push_preferences;
create policy push_preferences_own on public.push_preferences
  for all to authenticated
  using (user_id = auth.uid() and gina.is_parent() and family_id = gina.family_id())
  with check (user_id = auth.uid() and gina.is_parent() and family_id = gina.family_id());

-- push_outbox: politika yok = authenticated için tamamen kapalı.

-- İstemci RPC'leri -------------------------------------------------------------------------

-- Token'ı çağıranın kimliğine bağlar. Aynı token başka kullanıcıdaysa (cihazda hesap değişti) devralınır.
create or replace function public.register_push_token(p_token text, p_platform text, p_locale text default 'tr')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_device_id uuid;
  v_family_id uuid := gina.family_id();
  v_locale text := case when p_locale like 'en%' then 'en' else 'tr' end;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if gina.is_parent() then
    v_role := 'parent';
  elsif gina.is_device() then
    v_role := 'device';
    select d.id into v_device_id from public.devices d where d.auth_user_id = v_uid and d.revoked_at is null;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid_platform' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (user_id, family_id, role, device_id, platform, token, token_type, locale)
  values (v_uid, v_family_id, v_role, v_device_id, p_platform, p_token,
          case when p_platform = 'ios' then 'apns' else 'fcm' end, v_locale)
  on conflict (token) do update
    set user_id = excluded.user_id, family_id = excluded.family_id, role = excluded.role,
        device_id = excluded.device_id, platform = excluded.platform, token_type = excluded.token_type,
        locale = excluded.locale, updated_at = now();

  -- Aynı kullanıcı + platformda eski token'lar (yenilenen token) temizlenir.
  delete from public.push_tokens
  where user_id = v_uid and platform = p_platform and token <> p_token;
end;
$$;

-- Çıkıştan önce çağrılır (oturum hâlâ geçerliyken).
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text), public.unregister_push_token(text) to authenticated, service_role;

-- Kuyruğa alma ---------------------------------------------------------------------------------

-- Aynı aile/kitle/tür için gönderilmemiş satır varsa yenisi eklenmez (art arda tiklerde tek bildirim).
create or replace function gina.enqueue_push(
  p_family_id uuid,
  p_audience text,
  p_kind text,
  p_payload jsonb,
  p_target_child_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.push_outbox o
    where o.family_id = p_family_id and o.audience = p_audience and o.kind = p_kind
      and o.target_child_id is not distinct from p_target_child_id
      and o.status = 'pending'
  ) then
    return;
  end if;
  insert into public.push_outbox (family_id, audience, target_child_id, exclude_user_id, kind, payload)
  values (p_family_id, p_audience, p_target_child_id, auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke execute on function gina.enqueue_push(uuid, text, text, jsonb, uuid) from public, anon, authenticated;

-- Görev: done → velilere; done → approved/returned → çocuğun tabletine.
create or replace function gina.push_on_task_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    perform gina.enqueue_push(new.family_id, 'parents', 'task_awaiting_approval',
      jsonb_build_object('completion_id', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'done' and new.status in ('approved', 'returned') then
    perform gina.enqueue_push(new.family_id, 'device',
      case when new.status = 'approved' then 'task_approved' else 'task_returned' end,
      jsonb_build_object('completion_id', new.id), new.child_id);
  end if;
  return null;
end;
$$;

drop trigger if exists task_completions_push on public.task_completions;
create trigger task_completions_push after insert or update of status on public.task_completions
  for each row execute function gina.push_on_task_completion();

-- Deneme atandı → çocuğun tabletine.
create or replace function gina.push_on_exam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'assigned' and (tg_op = 'INSERT' or old.status is distinct from 'assigned') then
    perform gina.enqueue_push(new.family_id, 'device', 'exam_assigned',
      jsonb_build_object('exam_id', new.id), new.child_id);
  end if;
  return null;
end;
$$;

drop trigger if exists exams_push on public.exams;
create trigger exams_push after insert or update of status on public.exams
  for each row execute function gina.push_on_exam();

-- Deneme bitti (in_progress → submitted/graded) → velilere.
create or replace function gina.push_on_exam_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'in_progress' and new.status in ('submitted', 'graded') then
    perform gina.enqueue_push(new.family_id, 'parents', 'exam_finished',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id));
  end if;
  return null;
end;
$$;

drop trigger if exists exam_attempts_push on public.exam_attempts;
create trigger exam_attempts_push after update of status on public.exam_attempts
  for each row execute function gina.push_on_exam_attempt();

revoke execute on function gina.push_on_task_completion(), gina.push_on_exam(), gina.push_on_exam_attempt() from public, anon, authenticated;

-- push-send RPC'leri (yalnız service_role) ------------------------------------------------------

-- Gönderilecek satırları kilitleyip 'sending' yapar; 5 dk'dan uzun 'sending' kalanlar yeniden alınır.
create or replace function public.push_claim_batch(p_limit int default 50)
returns setof public.push_outbox
language sql
security definer
set search_path = public
as $$
  update public.push_outbox o
  set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
  where o.id in (
    select id from public.push_outbox
    where status = 'pending'
       or (status = 'sending' and claimed_at < now() - interval '5 minutes')
    order by created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  returning o.*;
$$;

-- Bir outbox satırının hedef token'ları: tercih, eylemi yapan kullanıcı, iptal edilmiş cihaz ve
-- oturumu kapanmış kullanıcı (global çıkış) elenir.
create or replace function public.push_targets(p_outbox_id bigint)
returns table (token_id uuid, token text, token_type text, platform text, locale text)
language sql
stable
security definer
set search_path = public
as $$
  with o as (select * from public.push_outbox where id = p_outbox_id)
  select t.id, t.token, t.token_type, t.platform, t.locale
  from o
  join public.push_tokens t on t.family_id = o.family_id and t.role = 'parent'
  join public.family_members m on m.family_id = o.family_id and m.user_id = t.user_id
  left join public.push_preferences p on p.user_id = t.user_id
  where o.audience = 'parents'
    and t.user_id is distinct from o.exclude_user_id
    and exists (select 1 from auth.sessions s where s.user_id = t.user_id)
    and case o.kind
          when 'task_awaiting_approval' then coalesce(p.approvals, true)
          when 'exam_finished' then coalesce(p.exams, true)
          when 'weekly_summary' then coalesce(p.weekly_summary, true)
          else true
        end
  union all
  select t.id, t.token, t.token_type, t.platform, t.locale
  from o
  join public.push_tokens t on t.family_id = o.family_id and t.role = 'device'
  join public.devices d on d.id = t.device_id and d.family_id = o.family_id and d.revoked_at is null
  where o.audience = 'device'
    and (o.target_child_id is null or d.active_child_id = o.target_child_id);
$$;

revoke execute on function public.push_claim_batch(int), public.push_targets(bigint) from public, anon, authenticated;
grant execute on function public.push_claim_batch(int), public.push_targets(bigint) to service_role;

-- Zamanlama: pg_cron her dakika bekleyen satır varsa push-send'i pg_net ile tetikler.
-- URL ve gizli anahtar Vault'tan okunur (push_send_url, push_send_secret); yoksa sessizce atlanır.
create or replace function gina.kick_push_send()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_outbox where status = 'pending') then
    return;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_send_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_send_secret';
    if v_url is null or v_secret is null then
      return;
    end if;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_secret),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'push-send tetiklenemedi: %', sqlerrm;
  end;
end;
$$;

revoke execute on function gina.kick_push_send() from public, anon, authenticated;

do $do$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net yok: %', sqlerrm;
end
$do$;

do $do$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('push-send', '* * * * *', $job$ select gina.kick_push_send() $job$);
exception when others then
  raise notice 'pg_cron yok, push-send zamanlanmadı: %', sqlerrm;
end
$do$;

-- 30 günden eski işlenmiş outbox satırları temizlenir.
do $do$
begin
  perform cron.schedule('purge-push-outbox', '30 3 * * *',
    $job$ delete from public.push_outbox where status not in ('pending', 'sending') and created_at < now() - interval '30 days' $job$);
exception when others then
  raise notice 'pg_cron yok, purge-push-outbox zamanlanmadı: %', sqlerrm;
end
$do$;
