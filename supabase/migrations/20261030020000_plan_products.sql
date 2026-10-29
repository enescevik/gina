-- Mağaza ürün kimlikleri → paket eşlemesi. Edge Function'lar (iap-verify, apple-notifications,
-- google-rtdn) doğruladıkları işlemde product_id'yi bu tablodan pakete çevirir.

create type public.billing_period as enum ('monthly', 'yearly');

create table public.plan_products (
  product_id text primary key, -- iOS ve Android'de aynı kimlikler kullanılır
  platform public.store_platform, -- null = her iki mağaza
  plan public.plan_code not null references public.plans (code),
  period public.billing_period not null,
  active boolean not null default true
);

insert into public.plan_products (product_id, plan, period) values
  ('gina_plus_monthly', 'plus', 'monthly'),
  ('gina_plus_yearly', 'plus', 'yearly'),
  ('gina_pro_monthly', 'pro', 'monthly'),
  ('gina_pro_yearly', 'pro', 'yearly');

alter table public.plan_products enable row level security;
create policy plan_products_select on public.plan_products for select to authenticated using (true);
create policy plan_products_admin_write on public.plan_products for all to authenticated
  using (gina.is_admin()) with check (gina.is_admin());

-- Mağaza bildirim günlüğü: her gelen olay işlenmeden önce ham hâliyle yazılır (idempotency + hata ayıklama).
create table public.store_notifications (
  id uuid primary key default gen_random_uuid(),
  platform public.store_platform not null,
  event_key text not null unique, -- Apple notificationUUID / Google messageId
  event_type text,
  store_key text, -- originalTransactionId / purchaseToken (eşleşince)
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);
create index store_notifications_unprocessed_idx on public.store_notifications (received_at) where processed_at is null;

alter table public.store_notifications enable row level security;
-- Yalnız service_role yazar/okur; admin inceleyebilir.
create policy store_notifications_admin_select on public.store_notifications
  for select to authenticated using (gina.is_admin());
