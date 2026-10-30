-- Uygulama içi satın alma (Apple StoreKit 2 + Google Play Billing) için sunucu tarafı ekleri.
-- Yazan: iap-verify / iap-reconcile / apple-notifications / google-rtdn (service_role).
-- İstemci yalnız okur: plan_products (ürün eşlemesi) ve kendi ailesinin store_subscriptions satırları.

-- Android eşlemesi ------------------------------------------------------------------
-- iOS'ta her (paket, dönem) ayrı ürün: gina_plus_monthly ... Android'de abonelik başına tek ürün
-- (gina_plus, gina_pro) + base plan (monthly/yearly) + deneme teklifi (trial7). Kanonik kimlik
-- product_id kalır; store_subscriptions.product_id her iki mağazada da kanonik kimliği tutar.

alter table public.plan_products
  add column android_product_id text,
  add column android_base_plan_id text,
  add column android_offer_id text, -- null = teklifsiz base plan
  add constraint plan_products_android_pair check ((android_product_id is null) = (android_base_plan_id is null));

update public.plan_products
  set android_product_id = 'gina_' || plan::text,
      android_base_plan_id = period::text,
      android_offer_id = 'trial7'
  where product_id in ('gina_plus_monthly', 'gina_plus_yearly', 'gina_pro_monthly', 'gina_pro_yearly');

create unique index plan_products_android_idx on public.plan_products (android_product_id, android_base_plan_id)
  where android_product_id is not null;

-- Uzlaştırma (iap-reconcile) -------------------------------------------------------------

create index store_subscriptions_reconcile_idx on public.store_subscriptions (expires_at)
  where status in ('active', 'grace', 'on_hold');

-- Bitişi yaklaşan / askıdaki abonelikler: mağazadan yeniden sorgulanacak adaylar.
-- p_min_age: son yazımdan bu kadar süre geçmeyen satır atlanır (bildirim zaten tazelemiştir).
-- Askıdaki (on_hold/billing retry) aboneliklere 60 gün boyunca bakılır (Apple retry süresi).
create or replace function public.iap_reconcile_candidates(
  p_window interval default interval '2 days',
  p_min_age interval default interval '6 hours',
  p_limit int default 200
)
returns table (
  id uuid,
  family_id uuid,
  platform public.store_platform,
  product_id text,
  store_key text,
  status public.subscription_status,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.family_id, s.platform, s.product_id, s.store_key, s.status, s.expires_at
  from public.store_subscriptions s
  where s.status in ('active', 'grace', 'on_hold')
    and s.expires_at < now() + p_window
    and s.expires_at > now() - interval '60 days'
    and s.updated_at < now() - p_min_age
  order by s.expires_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function public.iap_reconcile_candidates(interval, interval, int) from public, anon, authenticated;
grant execute on function public.iap_reconcile_candidates(interval, interval, int) to service_role;

-- pg_cron: 6 saatte bir iap-reconcile'ı çağırır (pg_net). Vault'ta `project_url` ve
-- `iap_cron_secret` tanımlı değilse iş boş döner. Yerelde pg_cron/pg_net olmayabilir: atla.
do $do$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.schedule('iap-reconcile', '17 */6 * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/iap-reconcile',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'iap_cron_secret')
      ),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'iap_cron_secret')
      and exists (select 1 from vault.decrypted_secrets where name = 'project_url')
  $job$);
exception when others then
  raise notice 'pg_cron/pg_net yok, iap-reconcile zamanlanmadı: %', sqlerrm;
end
$do$;
