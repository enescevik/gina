-- Backoffice (statik Next.js admin): AI ayarları, denetim izi ve yalnız admin RPC'leri.
-- İstemci yalnız anon anahtarla çalışır; yetki JWT'deki `gina.admin` claim'i + public.admins satırıyla
-- (claim 1 saat yaşayabildiği için) burada, veritabanında uygulanır. service_role istemciye verilmez.
-- Dosya yeniden uygulanabilir yazılmıştır (if not exists / create or replace / drop ... if exists).

-- Admin doğrulaması --------------------------------------------------------------

-- Claim + hâlâ admins tablosunda olmak: admin yetkisi alındığında token süresini beklemeden düşer.
create or replace function gina.is_admin_strict()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select gina.is_admin()
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function gina.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not gina.is_admin_strict() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function gina.is_admin_strict(), gina.assert_admin() from public, anon;
grant execute on function gina.is_admin_strict(), gina.assert_admin() to authenticated, service_role;

-- Denetim izi ------------------------------------------------------------------

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null, -- null = service_role / sistem
  action text not null, -- ör. 'entitlement_overrides.insert', 'ai_settings.update'
  target_table text,
  target_id text,
  family_id uuid references public.families (id) on delete set null,
  reason text,
  details jsonb not null default '{}'::jsonb, -- {old, new} veya {changed: {...}}
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_table, target_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon;
-- Yazma yalnız aşağıdaki SECURITY DEFINER tetikleyici/RPC'lerden; istemci doğrudan yazamaz, silemez.
revoke insert, update, delete, truncate on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select to authenticated using (gina.is_admin_strict());

-- Satır değişikliklerini denetim izine yazan genel tetikleyici.
-- TG_ARGV[0] = birincil anahtar kolonu (varsayılan 'id').
create or replace function gina.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pk text := coalesce(tg_argv[0], 'id');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed jsonb;
  v_family uuid;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value)), '{}'::jsonb)
      into v_changed
    from jsonb_each(v_new) n
    where n.key not in ('updated_at', 'updated_by')
      and (v_old -> n.key) is distinct from n.value;
    if v_changed = '{}'::jsonb then
      return new;
    end if;
  end if;

  if v_row ? 'family_id' and exists (select 1 from public.families f where f.id = (v_row ->> 'family_id')::uuid) then
    v_family := (v_row ->> 'family_id')::uuid;
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, family_id, reason, details)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_row ->> v_pk,
    v_family,
    case when tg_op = 'INSERT' then v_new ->> 'reason' end,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', v_new)
      when 'UPDATE' then jsonb_build_object('changed', v_changed)
      else jsonb_build_object('old', v_old)
    end
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function gina.audit_row() from public, anon, authenticated;

-- AI modelleri ve paket bazlı AI ayarları ------------------------------------------
-- Edge Function'lar (ai-weekly-summary, prova-*) service_role ile okur: ai_settings.plan_code = ailenin paketi;
-- enabled = false → kill switch (503 ai_disabled). Genel kill switch: app_settings 'ai.enabled'.

create table if not exists public.ai_models (
  id text primary key, -- API model kimliği, ör. 'claude-haiku-5-5'
  provider text not null default 'anthropic',
  display_name text not null,
  input_usd_per_mtok numeric(10, 4), -- bilgi amaçlı; boş bırakılabilir
  output_usd_per_mtok numeric(10, 4),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_settings (
  plan_code public.plan_code primary key references public.plans (code) on delete cascade,
  model_id text references public.ai_models (id) on update cascade,
  max_input_tokens int not null default 8000 check (max_input_tokens between 1 and 1000000),
  max_output_tokens int not null default 1500 check (max_output_tokens between 1 and 128000),
  prompt_version text not null default 'v1' check (char_length(prompt_version) between 1 and 40),
  enabled boolean not null default false, -- false = bu pakette AI kapalı (kill switch)
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not enabled or model_id is not null)
);

insert into public.ai_models (id, display_name) values
  ('claude-haiku-5-5', 'Claude Haiku 5.5'),
  ('claude-sonnet-5-5', 'Claude Sonnet 5.5')
on conflict (id) do nothing;

insert into public.ai_settings (plan_code, model_id, enabled) values
  ('free', null, false),
  ('plus', 'claude-haiku-5-5', true),
  ('pro', 'claude-sonnet-5-5', true)
on conflict (plan_code) do nothing;

drop trigger if exists ai_models_set_updated_at on public.ai_models;
create trigger ai_models_set_updated_at before update on public.ai_models
  for each row execute function gina.set_updated_at();

create or replace function gina.ai_settings_stamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists ai_settings_stamp on public.ai_settings;
create trigger ai_settings_stamp before insert or update on public.ai_settings
  for each row execute function gina.ai_settings_stamp();

-- Geriye uyumluluk: plans.ai_model'i okuyan eski kod (ai-weekly-summary) aynı modeli görsün.
create or replace function gina.ai_settings_sync_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans set ai_model = new.model_id
  where code = new.plan_code and ai_model is distinct from new.model_id;
  return new;
end;
$$;

drop trigger if exists ai_settings_sync_plan on public.ai_settings;
create trigger ai_settings_sync_plan after insert or update of model_id on public.ai_settings
  for each row execute function gina.ai_settings_sync_plan();

alter table public.ai_models enable row level security;
alter table public.ai_settings enable row level security;
revoke all on public.ai_models, public.ai_settings from anon;
grant select, insert, update, delete on public.ai_models, public.ai_settings to authenticated;

drop policy if exists ai_models_admin_all on public.ai_models;
create policy ai_models_admin_all on public.ai_models
  for all to authenticated using (gina.is_admin_strict()) with check (gina.is_admin_strict());
drop policy if exists ai_settings_admin_all on public.ai_settings;
create policy ai_settings_admin_all on public.ai_settings
  for all to authenticated using (gina.is_admin_strict()) with check (gina.is_admin_strict());
-- Veli/cihaz AI ayarlarını okumaz; Edge Function'lar service_role ile (RLS dışı) okur.

-- Denetim tetikleyicileri ------------------------------------------------------------

drop trigger if exists audit_entitlement_overrides on public.entitlement_overrides;
create trigger audit_entitlement_overrides after insert or update or delete on public.entitlement_overrides
  for each row execute function gina.audit_row('id');

drop trigger if exists audit_ai_models on public.ai_models;
create trigger audit_ai_models after insert or update or delete on public.ai_models
  for each row execute function gina.audit_row('id');

drop trigger if exists audit_ai_settings on public.ai_settings;
create trigger audit_ai_settings after insert or update or delete on public.ai_settings
  for each row execute function gina.audit_row('plan_code');

drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function gina.audit_row('key');

drop trigger if exists audit_plans on public.plans;
create trigger audit_plans after update on public.plans
  for each row execute function gina.audit_row('code');

-- Global soru bankası (family_id null) değişiklikleri; aile içerikleri izlenmez (kişisel veri).
drop trigger if exists audit_question_bank_global on public.question_bank;
create trigger audit_question_bank_global after update or delete on public.question_bank
  for each row when (old.family_id is null)
  execute function gina.audit_row('id');

-- Eski admin politikaları yalnız claim'e bakar (gina.is_admin()). Kısıtlayıcı politika: admin claim'i
-- taşıyan biri admins tablosundan çıkarıldıysa bu tablolara yazamaz/okuyamaz. Admin olmayanları etkilemez.
do $do$
declare
  t text;
begin
  foreach t in array array['entitlement_overrides', 'question_bank', 'app_settings', 'plans', 'plan_products', 'holidays']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_strict', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using (not gina.is_admin() or gina.is_admin_strict()) '
      'with check (not gina.is_admin() or gina.is_admin_strict())',
      t || '_admin_strict', t);
  end loop;
end
$do$;

-- Admin RPC'leri ------------------------------------------------------------------

-- Gösterge paneli sayıları.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform gina.assert_admin();

  select jsonb_build_object(
    'families', (select count(*) from public.families),
    'children', (select count(*) from public.children),
    'parents', (select count(*) from public.family_members),
    'devices', (select count(*) from public.devices where revoked_at is null),
    'active_subscriptions', coalesce((
      select jsonb_object_agg(s.plan, s.cnt) from (
        select plan::text as plan, count(distinct family_id) as cnt
        from public.store_subscriptions
        where status in ('active', 'grace') and expires_at > now()
        group by plan
      ) s
    ), '{}'::jsonb),
    'active_comps', coalesce((
      select jsonb_object_agg(c.plan, c.cnt) from (
        select plan::text as plan, count(distinct family_id) as cnt
        from public.entitlement_overrides
        where revoked_at is null and starts_at <= now() and ends_at > now()
        group by plan
      ) c
    ), '{}'::jsonb),
    'families_by_plan', coalesce((
      select jsonb_object_agg(e.plan, e.cnt) from (
        select ent.plan::text as plan, count(*) as cnt
        from public.families f
        cross join lateral public.get_family_entitlement(f.id) ent
        group by ent.plan
      ) e
    ), '{}'::jsonb),
    'ai_last_30d', coalesce((
      select jsonb_agg(jsonb_build_object(
        'model', a.model, 'count', a.cnt, 'input_tokens', a.inp, 'output_tokens', a.outp) order by a.model)
      from (
        select model, count(*) as cnt,
               coalesce(sum(input_tokens), 0) as inp, coalesce(sum(output_tokens), 0) as outp
        from public.ai_summaries
        where created_at > now() - interval '30 days' and status = 'done'
        group by model
      ) a
    ), '[]'::jsonb),
    'global_questions', (select count(*) from public.question_bank where family_id is null)
  ) into v;

  return v;
end;
$$;

-- Aile arama: asgari veri (ad, oluşturulma, sayılar, paket). E-posta ile tam eşleşme aranabilir
-- ama e-posta, çocuk adları veya başka kişisel veri döndürülmez.
create or replace function public.admin_search_families(p_query text default null, p_limit int default 50)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  member_count int,
  child_count int,
  device_count int,
  plan public.plan_code,
  plan_source text,
  plan_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform gina.assert_admin();

  return query
  select f.id, f.name, f.created_at,
         (select count(*)::int from public.family_members m where m.family_id = f.id),
         (select count(*)::int from public.children c where c.family_id = f.id),
         (select count(*)::int from public.devices d where d.family_id = f.id and d.revoked_at is null),
         ent.plan, ent.source, ent.expires_at
  from public.families f
  cross join lateral public.get_family_entitlement(f.id) ent
  where v_q is null
     or f.id::text = v_q
     or f.invite_code = upper(v_q)
     or f.name ilike '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%'
     or exists (
       select 1 from public.family_members m join auth.users u on u.id = m.user_id
       where m.family_id = f.id and lower(u.email) = lower(v_q)
     )
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Komp listesi (aile adıyla).
create or replace function public.admin_list_overrides(p_family_id uuid default null, p_include_inactive boolean default true)
returns table (
  id uuid,
  family_id uuid,
  family_name text,
  plan public.plan_code,
  reason text,
  granted_by uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform gina.assert_admin();

  return query
  select o.id, o.family_id, f.name, o.plan, o.reason, o.granted_by, o.starts_at, o.ends_at, o.revoked_at, o.created_at,
         (o.revoked_at is null and o.starts_at <= now() and o.ends_at > now())
  from public.entitlement_overrides o
  join public.families f on f.id = o.family_id
  where (p_family_id is null or o.family_id = p_family_id)
    and (p_include_inactive or (o.revoked_at is null and o.ends_at > now()))
  order by o.created_at desc
  limit 500;
end;
$$;

-- Komp ver: gerekçe + bitiş tarihi zorunlu; denetim izine tetikleyici yazar.
create or replace function public.admin_grant_override(
  p_family_id uuid,
  p_plan public.plan_code,
  p_reason text,
  p_ends_at timestamptz,
  p_starts_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_starts timestamptz := coalesce(p_starts_at, now());
begin
  perform gina.assert_admin();

  if p_plan = 'free' then
    raise exception 'override_plan_free' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'override_reason_required' using errcode = 'P0001';
  end if;
  if p_ends_at is null or p_ends_at <= greatest(v_starts, now()) then
    raise exception 'override_ends_at_invalid' using errcode = 'P0001';
  end if;
  if p_ends_at > now() + interval '2 years' then
    raise exception 'override_too_long' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.families f where f.id = p_family_id) then
    raise exception 'family_not_found' using errcode = 'P0001';
  end if;

  insert into public.entitlement_overrides (family_id, plan, reason, granted_by, starts_at, ends_at)
  values (p_family_id, p_plan, trim(p_reason), auth.uid(), v_starts, p_ends_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- Komp'u sonlandır: satır silinmez, revoked_at yazılır; sonlandırma gerekçesi denetim izine eklenir.
create or replace function public.admin_expire_override(p_override_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  perform gina.assert_admin();

  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'override_reason_required' using errcode = 'P0001';
  end if;

  update public.entitlement_overrides
     set revoked_at = now()
   where id = p_override_id and revoked_at is null
  returning family_id into v_family;

  if v_family is null then
    raise exception 'override_not_found_or_revoked' using errcode = 'P0001';
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, family_id, reason)
  values (auth.uid(), 'entitlement_overrides.expire', 'entitlement_overrides', p_override_id::text, v_family, trim(p_reason));
end;
$$;

-- Genel AI kill switch (app_settings 'ai.enabled'); denetim izine app_settings tetikleyicisi yazar.
create or replace function public.admin_set_ai_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform gina.assert_admin();
  insert into public.app_settings (key, value, updated_at)
  values ('ai.enabled', to_jsonb(coalesce(p_enabled, false)), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- Global soruyu sil: denemelerde kullanılmışsa silinmez (exam_answers cascade ile çocuk cevapları giderdi).
create or replace function public.admin_delete_global_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform gina.assert_admin();

  if not exists (select 1 from public.question_bank q where q.id = p_question_id and q.family_id is null) then
    raise exception 'question_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.exam_answers a where a.question_id = p_question_id)
     or exists (select 1 from public.exams e where p_question_id = any (e.question_ids)) then
    raise exception 'question_in_use' using errcode = 'P0001';
  end if;

  delete from public.question_bank where id = p_question_id and family_id is null;
end;
$$;

-- Global soru bankası filtre seçenekleri (sınıf/ders/konu ve adetleri).
create or replace function public.admin_question_facets()
returns table (grade smallint, subject text, topic text, question_count int, times_asked_total bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform gina.assert_admin();
  return query
  select q.grade, q.subject, q.topic, count(*)::int, coalesce(sum(q.times_asked), 0)::bigint
  from public.question_bank q
  where q.family_id is null
  group by q.grade, q.subject, q.topic
  order by q.grade, q.subject, q.topic;
end;
$$;

revoke execute on function
  public.admin_dashboard(),
  public.admin_search_families(text, int),
  public.admin_list_overrides(uuid, boolean),
  public.admin_grant_override(uuid, public.plan_code, text, timestamptz, timestamptz),
  public.admin_expire_override(uuid, text),
  public.admin_set_ai_enabled(boolean),
  public.admin_delete_global_question(uuid),
  public.admin_question_facets()
from public, anon;

grant execute on function
  public.admin_dashboard(),
  public.admin_search_families(text, int),
  public.admin_list_overrides(uuid, boolean),
  public.admin_grant_override(uuid, public.plan_code, text, timestamptz, timestamptz),
  public.admin_expire_override(uuid, text),
  public.admin_set_ai_enabled(boolean),
  public.admin_delete_global_question(uuid),
  public.admin_question_facets()
to authenticated;
