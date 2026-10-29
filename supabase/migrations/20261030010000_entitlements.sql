-- Paket/yetki (entitlement) altyapısı: plans, store_subscriptions, entitlement_overrides.
-- Yetki ailenindir; tek kaynak bu tablolar + get_family_entitlement(). Mağaza doğrulaması
-- Faz 2'de Edge Function'larla yazar (service_role); istemci yalnız okur.

create type public.plan_code as enum ('free', 'plus', 'pro');
create type public.store_platform as enum ('apple', 'google');
create type public.subscription_status as enum ('active', 'grace', 'on_hold', 'expired', 'revoked');

-- Paket tanımları (backoffice'ten düzenlenir) ------------------------------------

create table public.plans (
  code public.plan_code primary key,
  name_i18n jsonb not null, -- {"tr": "...", "en": "..."}
  max_children smallint not null,
  max_devices smallint, -- null = sınırsız
  max_active_tasks_per_child smallint, -- null = sınırsız
  max_notes smallint, -- null = sınırsız
  history_days smallint, -- null = sınırsız geçmiş
  ai_weekly boolean not null default false,
  ai_model text,
  sort_order smallint not null default 0
);

insert into public.plans (code, name_i18n, max_children, max_devices, max_active_tasks_per_child, max_notes, history_days, ai_weekly, ai_model, sort_order) values
  ('free', '{"tr": "Gina Başlangıç", "en": "Gina Starter"}', 2, 1, 7, 20, 30, false, null, 0),
  ('plus', '{"tr": "Gina Plus", "en": "Gina Plus"}', 4, 3, null, null, 365, true, 'claude-haiku-5-5', 1),
  ('pro', '{"tr": "Gina Pro", "en": "Gina Pro"}', 8, null, null, null, null, true, 'claude-sonnet-5-5', 2);

-- Mağaza abonelikleri (Faz 2'de Edge Function'lar yazar) ---------------------------

create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  purchaser_user_id uuid references auth.users (id) on delete set null,
  platform public.store_platform not null,
  product_id text not null, -- gina_plus_monthly, gina_pro_yearly, ...
  plan public.plan_code not null,
  store_key text not null unique, -- Apple originalTransactionId / Google purchaseToken
  status public.subscription_status not null default 'active',
  expires_at timestamptz not null,
  auto_renewing boolean not null default true,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_subscriptions_family_idx on public.store_subscriptions (family_id, expires_at desc);
create trigger store_subscriptions_set_updated_at before update on public.store_subscriptions
  for each row execute function gina.set_updated_at();

-- İç komp'lar: yalnız backoffice'ten, gerekçe + bitiş tarihiyle --------------------------

create table public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  plan public.plan_code not null,
  reason text not null,
  granted_by uuid references auth.users (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index entitlement_overrides_family_idx on public.entitlement_overrides (family_id, ends_at desc);

-- Yetki hesabı -----------------------------------------------------------------

create or replace function gina.plan_rank(p public.plan_code)
returns int
language sql
immutable
as $$ select case p when 'pro' then 2 when 'plus' then 1 else 0 end; $$;

-- Ailenin etkin paketi: aktif mağaza aboneliği (grace dahil) > aktif komp > free.
create or replace function public.get_family_entitlement(p_family_id uuid default null)
returns table (plan public.plan_code, source text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_family_id, gina.family_id()) as family_id
  ),
  allowed as (
    select t.family_id from target t
    where t.family_id is not null
      and (gina.is_admin() or t.family_id = gina.family_id())
  ),
  subs as (
    select s.plan, 'store'::text as source, s.expires_at
    from public.store_subscriptions s, allowed a
    where s.family_id = a.family_id
      and s.status in ('active', 'grace')
      and s.expires_at > now()
  ),
  comps as (
    select o.plan, 'comp'::text as source, o.ends_at as expires_at
    from public.entitlement_overrides o, allowed a
    where o.family_id = a.family_id
      and o.revoked_at is null
      and o.starts_at <= now() and o.ends_at > now()
  ),
  pick as (
    select * from (select * from subs union all select * from comps) u
    order by gina.plan_rank(u.plan) desc, u.expires_at desc
    limit 1
  )
  select coalesce(p.plan, 'free'::public.plan_code), coalesce(p.source, 'free'), p.expires_at
  from allowed a left join pick p on true;
$$;

-- Satır döndürmeyen çağrı (aile yoksa) istemcide null olarak ele alınır.

create or replace function gina.family_plan()
returns public.plans
language sql
stable
security definer
set search_path = public
as $$
  select pl.* from public.get_family_entitlement() e join public.plans pl on pl.code = e.plan;
$$;

revoke execute on function public.get_family_entitlement(uuid), gina.family_plan(), gina.plan_rank(public.plan_code) from public, anon;
grant execute on function public.get_family_entitlement(uuid), gina.family_plan(), gina.plan_rank(public.plan_code) to authenticated, service_role;

-- RLS ------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.entitlement_overrides enable row level security;

create policy plans_select on public.plans for select to authenticated using (true);
create policy plans_admin_write on public.plans for all to authenticated
  using (gina.is_admin()) with check (gina.is_admin());

create policy store_subscriptions_parent_select on public.store_subscriptions
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());

create policy entitlement_overrides_parent_select on public.entitlement_overrides
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy entitlement_overrides_admin_all on public.entitlement_overrides
  for all to authenticated using (gina.is_admin()) with check (gina.is_admin());

-- Paket sınırlarının uygulanması -----------------------------------------------------

create or replace function gina.enforce_children_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
  v_count int;
begin
  select * into v_plan from public.plans pl
    join public.get_family_entitlement(new.family_id) e on pl.code = e.plan;
  select count(*) into v_count from public.children where family_id = new.family_id;
  if v_count >= v_plan.max_children then
    raise exception 'plan_limit_children' using errcode = 'P0001',
      detail = format('limit=%s', v_plan.max_children);
  end if;
  return new;
end;
$$;

create trigger children_plan_limit before insert on public.children
  for each row execute function gina.enforce_children_limit();

create or replace function gina.enforce_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
  v_count int;
begin
  if not new.active then
    return new;
  end if;
  select * into v_plan from public.plans pl
    join public.get_family_entitlement(new.family_id) e on pl.code = e.plan;
  if v_plan.max_active_tasks_per_child is null then
    return new;
  end if;
  select count(*) into v_count from public.task_templates
    where child_id = new.child_id and active and id is distinct from new.id;
  if v_count >= v_plan.max_active_tasks_per_child then
    raise exception 'plan_limit_tasks' using errcode = 'P0001',
      detail = format('limit=%s', v_plan.max_active_tasks_per_child);
  end if;
  return new;
end;
$$;

create trigger task_templates_plan_limit before insert or update of active on public.task_templates
  for each row execute function gina.enforce_task_limit();

create or replace function gina.enforce_notes_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
  v_count int;
begin
  select * into v_plan from public.plans pl
    join public.get_family_entitlement(new.family_id) e on pl.code = e.plan;
  if v_plan.max_notes is null then
    return new;
  end if;
  select count(*) into v_count from public.notes where family_id = new.family_id;
  if v_count >= v_plan.max_notes then
    raise exception 'plan_limit_notes' using errcode = 'P0001',
      detail = format('limit=%s', v_plan.max_notes);
  end if;
  return new;
end;
$$;

create trigger notes_plan_limit before insert on public.notes
  for each row execute function gina.enforce_notes_limit();

-- Cihaz sınırı pair_device içinde uygulanır.
create or replace function public.pair_device(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pairing public.device_pairings%rowtype;
  v_device_id uuid;
  v_plan public.plans;
  v_count int;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_pairing
  from public.device_pairings
  where code = trim(p_code) and consumed_at is null and expires_at >= now()
  for update;

  if v_pairing.code is null then
    raise exception 'invalid_or_expired_code' using errcode = 'P0001';
  end if;

  select pl.* into v_plan from public.plans pl
    join public.get_family_entitlement(gina.family_id()) e on pl.code = e.plan;
  if v_plan.max_devices is not null then
    select count(*) into v_count from public.devices
      where family_id = gina.family_id() and revoked_at is null;
    if v_count >= v_plan.max_devices then
      raise exception 'plan_limit_devices' using errcode = 'P0001',
        detail = format('limit=%s', v_plan.max_devices);
    end if;
  end if;

  insert into public.devices (family_id, auth_user_id, name)
    values (gina.family_id(), v_pairing.auth_user_id, v_pairing.device_name)
  on conflict (auth_user_id) do update
    set family_id = excluded.family_id, name = excluded.name, revoked_at = null, active_child_id = null, paired_at = now()
  returning id into v_device_id;

  update public.device_pairings set consumed_at = now() where code = v_pairing.code;
  return v_device_id;
end;
$$;
