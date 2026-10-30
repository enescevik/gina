-- Edge Function'lar (service_role, JWT'de gina claim'i yok) bir ailenin paketini okuyabilsin.
-- Önceden allowed boş dönüyordu; ai-weekly-summary her aileyi free görüp 402 veriyordu.

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
      and (gina.is_admin() or t.family_id = gina.family_id() or auth.role() = 'service_role')
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
