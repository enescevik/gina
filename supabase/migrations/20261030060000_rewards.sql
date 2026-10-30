-- Hazinem / Koleksiyonum: ödül kataloğu, çocuk hedefi, yıldız harcama (idempotent), envanter,
-- oda tercihi ve rozetler. Kurallar (docs/design/room-v2):
--  * Bakiye sunucuda doğrulanır; eşzamanlı harcama advisory kilitle serileşir; idempotency key şart.
--  * Çocuk maliyet belirleyemez, delivered yazamaz; yalnız kendi envanterini görür.
--  * Yıldız düşümü ve iadesi star_events'e benzersiz bağla (en fazla 1 düşüm + 1 iade / istek).
--  * Rozet: planlı bakımı tamamlama (en uzun süre yarışı değil); geçmişe toplu backfill yok —
--    kurallar değerlendirme anındaki duruma bakar, ödül tek seferliktir (PK).

create type public.reward_request_status as enum ('requested', 'approved', 'declined', 'delivered', 'cancelled');
create type public.child_goal_status as enum ('active', 'reached', 'redeemed', 'cancelled');

-- Katalog ---------------------------------------------------------------------

create table public.family_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  icon text not null default 'reward-mystery-box',
  cost_stars smallint not null check (cost_stars between 1 and 500),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index family_rewards_family_idx on public.family_rewards (family_id) where active;
create trigger family_rewards_set_updated_at before update on public.family_rewards
  for each row execute function gina.set_updated_at();

-- Hedef: çocuk başına tek aktif -------------------------------------------------

create table public.child_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  reward_id uuid not null references public.family_rewards (id) on delete cascade,
  status public.child_goal_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index child_goals_one_active_idx on public.child_goals (child_id) where status = 'active';
create index child_goals_child_idx on public.child_goals (child_id, created_at desc);

-- Harcama istekleri ---------------------------------------------------------------

create table public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  reward_id uuid not null references public.family_rewards (id) on delete restrict,
  goal_id uuid references public.child_goals (id) on delete set null,
  cost_snapshot smallint not null,
  status public.reward_request_status not null default 'requested',
  idempotency_key uuid not null unique,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  delivered_at timestamptz
);
create index reward_requests_family_idx on public.reward_requests (family_id, status);

-- Yıldız düşümü/iadesi istek başına en fazla birer kez (benzersiz bağ).
alter table public.star_events
  add column reward_request_id uuid references public.reward_requests (id) on delete set null,
  add column refund_request_id uuid references public.reward_requests (id) on delete set null;
create unique index star_events_reward_debit_idx on public.star_events (reward_request_id) where reward_request_id is not null;
create unique index star_events_reward_refund_idx on public.star_events (refund_request_id) where refund_request_id is not null;

-- Envanter --------------------------------------------------------------------

create table public.child_inventory (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  reward_id uuid not null references public.family_rewards (id) on delete restrict,
  request_id uuid not null unique references public.reward_requests (id) on delete cascade,
  display_slot smallint check (display_slot between 0 and 2),
  acquired_at timestamptz not null default now()
);
create unique index child_inventory_slot_idx on public.child_inventory (child_id, display_slot) where display_slot is not null;
create index child_inventory_child_idx on public.child_inventory (child_id, acquired_at desc);

-- Oda tercihi ------------------------------------------------------------------

create table public.child_room_preferences (
  child_id uuid primary key references public.children (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  character_key text not null default 'unspecified' check (character_key in ('unspecified', 'girl', 'boy')),
  theme_key text not null default 'default',
  updated_at timestamptz not null default now()
);

-- Rozetler ---------------------------------------------------------------------

create table public.badge_definitions (
  slug text primary key,
  family_id uuid references public.families (id) on delete cascade, -- null = global
  title_i18n jsonb not null,
  icon text not null,
  -- rule.kind: 'first_task' | 'task_count' (params.count) | 'planned_care' (params.icon, params.count)
  rule jsonb not null,
  active boolean not null default true,
  sort_order smallint not null default 0
);

insert into public.badge_definitions (slug, title_i18n, icon, rule, sort_order) values
  ('first-task', '{"tr": "İlk Görev", "en": "First Task"}', 'badge-first-task', '{"kind": "first_task"}', 0),
  ('task-25', '{"tr": "25 Görev", "en": "25 Tasks"}', 'badge-week-hero', '{"kind": "task_count", "params": {"count": 25}}', 1),
  ('dis-parlatan', '{"tr": "Diş Parlatan", "en": "Tooth Polisher"}', 'badge-first-task', '{"kind": "planned_care", "params": {"icon": "brush-teeth", "count": 14}}', 2),
  ('kitap-kurdu', '{"tr": "Kitap Kurdu", "en": "Bookworm"}', 'badge-bookworm', '{"kind": "planned_care", "params": {"icon": "read-book", "count": 10}}', 3);

create table public.child_badge_awards (
  child_id uuid not null references public.children (id) on delete cascade,
  badge_slug text not null references public.badge_definitions (slug) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  source jsonb,
  primary key (child_id, badge_slug)
);

-- RLS ------------------------------------------------------------------------

alter table public.family_rewards enable row level security;
alter table public.child_goals enable row level security;
alter table public.reward_requests enable row level security;
alter table public.child_inventory enable row level security;
alter table public.child_room_preferences enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.child_badge_awards enable row level security;

create policy family_rewards_parent_all on public.family_rewards
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());
create policy family_rewards_device_select on public.family_rewards
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and active);

create policy child_goals_parent_select on public.child_goals
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy child_goals_device_select on public.child_goals
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

create policy reward_requests_parent_select on public.reward_requests
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy reward_requests_device_select on public.reward_requests
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

create policy child_inventory_parent_select on public.child_inventory
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy child_inventory_device_select on public.child_inventory
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

create policy child_room_preferences_parent_all on public.child_room_preferences
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());
create policy child_room_preferences_device_select on public.child_room_preferences
  for select to authenticated using (family_id = gina.family_id() and gina.is_device());

create policy badge_definitions_select on public.badge_definitions
  for select to authenticated using (family_id is null or family_id = gina.family_id());
create policy badge_definitions_parent_write on public.badge_definitions
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy child_badge_awards_parent_select on public.child_badge_awards
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy child_badge_awards_device_select on public.child_badge_awards
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());

-- Yardımcı: çocuğun güncel bakiyesi (ledger toplamı) -----------------------------------

create or replace function gina.child_star_balance(p_child_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$ select coalesce(sum(delta), 0)::int from public.star_events where child_id = p_child_id; $$;

-- RPC'ler ----------------------------------------------------------------------

-- Çocuk (cihaz ya da telefonda çocuk modu) hedef seçer.
create or replace function public.set_child_goal(p_reward_id uuid, p_acting_child_id uuid default null)
returns public.child_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid;
  v_reward public.family_rewards%rowtype;
  v_row public.child_goals%rowtype;
begin
  if gina.is_device() then
    v_child := gina.child_id();
  elsif gina.is_parent() then
    v_child := p_acting_child_id;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_child is null then
    raise exception 'no_child' using errcode = 'P0001';
  end if;

  select * into v_reward from public.family_rewards
    where id = p_reward_id and family_id = gina.family_id() and active;
  if v_reward.id is null then
    raise exception 'reward_not_found' using errcode = 'P0001';
  end if;

  update public.child_goals set status = 'cancelled', decided_at = now()
    where child_id = v_child and status = 'active';
  insert into public.child_goals (family_id, child_id, reward_id, created_by)
    values (gina.family_id(), v_child, p_reward_id, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- Çocuk yıldız harcamak ister (bakiye kontrolü anlıktır; kesin düşüm veli onayında).
create or replace function public.request_reward(p_reward_id uuid, p_idempotency_key uuid, p_acting_child_id uuid default null)
returns public.reward_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid;
  v_reward public.family_rewards%rowtype;
  v_row public.reward_requests%rowtype;
  v_goal uuid;
begin
  if gina.is_device() then
    v_child := gina.child_id();
  elsif gina.is_parent() then
    v_child := p_acting_child_id;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_child is null then
    raise exception 'no_child' using errcode = 'P0001';
  end if;

  select * into v_row from public.reward_requests where idempotency_key = p_idempotency_key;
  if v_row.id is not null then
    return v_row; -- ağ tekrarı
  end if;

  select * into v_reward from public.family_rewards
    where id = p_reward_id and family_id = gina.family_id() and active;
  if v_reward.id is null then
    raise exception 'reward_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('stars:' || v_child::text));
  if gina.child_star_balance(v_child) < v_reward.cost_stars then
    raise exception 'insufficient_stars' using errcode = 'P0001',
      detail = format('balance=%s cost=%s', gina.child_star_balance(v_child), v_reward.cost_stars);
  end if;

  select id into v_goal from public.child_goals
    where child_id = v_child and reward_id = p_reward_id and status = 'active';

  insert into public.reward_requests (family_id, child_id, reward_id, goal_id, cost_snapshot, idempotency_key)
    values (gina.family_id(), v_child, p_reward_id, v_goal, v_reward.cost_stars, p_idempotency_key)
  returning * into v_row;
  return v_row;
end;
$$;

-- Veli karar verir: onayda yıldız düşer (benzersiz bağ), envantere girer, hedef güncellenir.
create or replace function public.decide_reward_request(p_request_id uuid, p_approve boolean)
returns public.reward_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reward_requests%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.reward_requests
    where id = p_request_id and family_id = gina.family_id()
    for update;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.status <> 'requested' then
    return v_row; -- idempotent: karar verilmiş isteği olduğu gibi döndür
  end if;

  if not p_approve then
    update public.reward_requests set status = 'declined', decided_at = now(), decided_by = auth.uid()
      where id = p_request_id returning * into v_row;
    return v_row;
  end if;

  perform pg_advisory_xact_lock(hashtext('stars:' || v_row.child_id::text));
  if gina.child_star_balance(v_row.child_id) < v_row.cost_snapshot then
    raise exception 'insufficient_stars' using errcode = 'P0001';
  end if;

  insert into public.star_events (family_id, child_id, delta, reason, created_by, reward_request_id)
    values (v_row.family_id, v_row.child_id, -v_row.cost_snapshot, 'reward', auth.uid(), v_row.id);

  insert into public.child_inventory (family_id, child_id, reward_id, request_id)
    values (v_row.family_id, v_row.child_id, v_row.reward_id, v_row.id);

  if v_row.goal_id is not null then
    update public.child_goals set status = 'redeemed', decided_at = now() where id = v_row.goal_id;
  end if;

  update public.reward_requests set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id returning * into v_row;
  return v_row;
end;
$$;

-- Teslim ve (onaylıdan) iptal + iade; ikisi de idempotent.
create or replace function public.deliver_reward_request(p_request_id uuid)
returns public.reward_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reward_requests%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.reward_requests
    set status = 'delivered', delivered_at = coalesce(delivered_at, now())
  where id = p_request_id and family_id = gina.family_id() and status in ('approved', 'delivered')
  returning * into v_row;
  if v_row.id is null then
    raise exception 'not_approvable' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

create or replace function public.cancel_reward_request(p_request_id uuid)
returns public.reward_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reward_requests%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.reward_requests
    where id = p_request_id and family_id = gina.family_id() for update;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.status = 'cancelled' then
    return v_row;
  end if;
  if v_row.status not in ('requested', 'approved') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;

  if v_row.status = 'approved' then
    -- İade: benzersiz refund bağı sayesinde en fazla bir kez yazılır.
    insert into public.star_events (family_id, child_id, delta, reason, created_by, refund_request_id)
      values (v_row.family_id, v_row.child_id, v_row.cost_snapshot, 'adjust', auth.uid(), v_row.id)
    on conflict do nothing;
    delete from public.child_inventory where request_id = v_row.id;
  end if;

  update public.reward_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id returning * into v_row;
  return v_row;
end;
$$;

-- Oda tercihi (cihaz kendi çocuğu için; veli hepsi için).
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
  if v_child is null then
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

-- Rozet değerlendirme: onay anında çağrılır; kurallar o anki duruma bakar, PK tekrarı engeller.
create or replace function gina.award_badges_for_child(p_child_id uuid, p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  v_count int;
begin
  for b in
    select * from public.badge_definitions
    where active and (family_id is null or family_id = p_family_id)
  loop
    continue when exists (
      select 1 from public.child_badge_awards a where a.child_id = p_child_id and a.badge_slug = b.slug
    );
    if b.rule ->> 'kind' = 'first_task' then
      if exists (select 1 from public.task_completions tc where tc.child_id = p_child_id and tc.status = 'approved') then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'first_task'))
        on conflict do nothing;
      end if;
    elsif b.rule ->> 'kind' = 'task_count' then
      select count(*) into v_count from public.task_completions tc
        where tc.child_id = p_child_id and tc.status = 'approved';
      if v_count >= coalesce((b.rule -> 'params' ->> 'count')::int, 999999) then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'task_count', 'count', v_count))
        on conflict do nothing;
      end if;
    elsif b.rule ->> 'kind' = 'planned_care' then
      -- Planlı bakım: o ikonlu görevin ONAYLI tamamlama sayısı (süre yarışı değil).
      select count(*) into v_count from public.task_completions tc
        join public.task_templates tt on tt.id = tc.template_id
        where tc.child_id = p_child_id and tc.status = 'approved'
          and tt.icon = b.rule -> 'params' ->> 'icon';
      if v_count >= coalesce((b.rule -> 'params' ->> 'count')::int, 999999) then
        insert into public.child_badge_awards (child_id, badge_slug, family_id, source)
          values (p_child_id, b.slug, p_family_id, jsonb_build_object('kind', 'planned_care', 'count', v_count))
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

-- review_task onayına rozet değerlendirmesi eklenir (sözleşme değişmez).
create or replace function public.review_task(p_completion_id uuid, p_approve boolean)
returns public.task_completions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.task_completions%rowtype;
  v_stars smallint;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.task_completions where id = p_completion_id and family_id = gina.family_id() for update;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.status <> 'done' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  update public.task_completions
    set status = (case when p_approve then 'approved' else 'returned' end)::public.completion_status,
        reviewed_at = now(), reviewed_by = v_uid
  where id = p_completion_id
  returning * into v_row;

  if p_approve then
    select stars into v_stars from public.task_templates where id = v_row.template_id;
    if coalesce(v_stars, 0) > 0 then
      insert into public.star_events (family_id, child_id, delta, reason, completion_id, created_by)
        values (v_row.family_id, v_row.child_id, v_stars, 'task_approved', v_row.id, v_uid);
    end if;
    perform gina.award_badges_for_child(v_row.child_id, v_row.family_id);
  end if;

  return v_row;
end;
$$;

revoke execute on function
  public.set_child_goal(uuid, uuid), public.request_reward(uuid, uuid, uuid),
  public.decide_reward_request(uuid, boolean), public.deliver_reward_request(uuid),
  public.cancel_reward_request(uuid), public.set_room_preference(text, text, uuid),
  gina.child_star_balance(uuid), gina.award_badges_for_child(uuid, uuid)
from public, anon;
grant execute on function
  public.set_child_goal(uuid, uuid), public.request_reward(uuid, uuid, uuid),
  public.decide_reward_request(uuid, boolean), public.deliver_reward_request(uuid),
  public.cancel_reward_request(uuid), public.set_room_preference(text, text, uuid),
  gina.child_star_balance(uuid)
to authenticated, service_role;
grant execute on function gina.award_badges_for_child(uuid, uuid) to service_role;

alter publication supabase_realtime add table public.reward_requests;
alter publication supabase_realtime add table public.child_badge_awards;
