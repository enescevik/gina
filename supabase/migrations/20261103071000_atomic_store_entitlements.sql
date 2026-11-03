-- All verified store writes share one ownership/version/linked-token transaction.
create table gina.store_replacements (
  old_store_key text primary key,
  new_store_key text not null,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  check(old_store_key<>new_store_key)
);
revoke all on gina.store_replacements from public,anon,authenticated;
grant all on gina.store_replacements to service_role;

create function gina.guard_store_subscription_identity() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.family_id is distinct from old.family_id or new.platform is distinct from old.platform
    or new.store_key is distinct from old.store_key then
    raise exception 'account_mismatch' using errcode='P0001';
  end if;
  if jsonb_typeof(old.raw->'version')='number' and (
    jsonb_typeof(new.raw->'version') is distinct from 'number'
    or (new.raw->>'version')::numeric < (old.raw->>'version')::numeric
  ) then raise exception 'stale_store_state' using errcode='P0001'; end if;
  return new;
end;
$$;
create trigger store_subscription_identity before update
  on public.store_subscriptions for each row execute function gina.guard_store_subscription_identity();

create function public.apply_verified_store_state(
  p_state jsonb, p_caller_family_id uuid default null, p_purchaser_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_key text := p_state->>'storeKey';
  v_link text := nullif(p_state->>'replacesStoreKey','');
  v_platform public.store_platform := (p_state->>'platform')::public.store_platform;
  v_status public.subscription_status := (p_state->>'status')::public.subscription_status;
  v_product public.plan_products;
  v_current public.store_subscriptions;
  v_old public.store_subscriptions;
  v_replacement gina.store_replacements;
  v_token uuid;
  v_family uuid;
  v_version numeric := (p_state->>'version')::numeric;
  v_previous numeric;
  v_expires timestamptz := (p_state->>'expiresAt')::timestamptz;
  v_lock text;
  v_skip text;
begin
  if v_key is null or length(v_key) not between 1 and 2048 or v_platform is null or v_status is null
    or v_expires is null or not isfinite(v_expires) or v_version is null or v_version<=0
    or v_version>9007199254740991 or trunc(v_version)<>v_version
    or jsonb_typeof(p_state->'autoRenewing') is distinct from 'boolean'
    or (p_state ? 'raw' and jsonb_typeof(p_state->'raw') not in ('object','null'))
    or (v_link is not null and (v_platform<>'google' or v_link=v_key or length(v_link)>2048)) then
    raise exception 'invalid_store_state' using errcode='22023';
  end if;
  -- Stable order prevents opposite linked-token calls deadlocking. Includes not-yet-inserted keys.
  for v_lock in select distinct k from unnest(array[v_key,v_link]) k where k is not null order by k loop
    perform pg_advisory_xact_lock(hashtextextended('gina.store:'||v_lock,0));
  end loop;
  select * into v_current from public.store_subscriptions where store_key=v_key for update;
  select * into v_old from public.store_subscriptions where store_key=v_link for update;
  select * into v_replacement from gina.store_replacements where old_store_key=v_key;
  if coalesce(p_state->>'accountToken','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_token := (p_state->>'accountToken')::uuid;
  end if;
  v_family := coalesce(p_caller_family_id,v_current.family_id,v_token,v_old.family_id,v_replacement.family_id);
  if v_family is null or not exists(select 1 from public.families where id=v_family) then
    raise exception 'family_not_found' using errcode='P0001';
  end if;
  if (v_token is not null and v_token<>v_family)
    or (v_current.id is not null and (v_current.family_id<>v_family or v_current.platform<>v_platform))
    or (v_old.id is not null and (v_old.family_id<>v_family or v_old.platform<>v_platform))
    or (v_replacement.old_store_key is not null and v_replacement.family_id<>v_family)
    or exists(select 1 from gina.store_replacements where old_store_key=v_link and (family_id<>v_family or new_store_key<>v_key)) then
    raise exception 'account_mismatch' using errcode='P0001';
  end if;
  if p_caller_family_id is not null or p_purchaser_user_id is not null then
    perform 1 from public.family_members where family_id=v_family and user_id=p_purchaser_user_id for key share;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
  end if;

  select * into v_product from public.plan_products
    where product_id=p_state->>'productId' and active and (platform is null or platform=v_platform) for share;
  if v_product.product_id is null then raise exception 'unknown_product' using errcode='P0001'; end if;
  if jsonb_typeof(v_current.raw->'version')='number' then v_previous := (v_current.raw->>'version')::numeric; end if;
  if v_replacement.old_store_key is not null then
    -- Replaced tokens cannot become an entitlement again, even if their old event arrives later.
    if v_current.id is null then
      return jsonb_build_object('familyId',v_family,'productId',v_product.product_id,'plan',v_product.plan,
        'status','expired','expiresAt',v_expires,'skipped','replaced');
    end if;
    v_skip := 'replaced';
  elsif v_previous is not null and v_version<=v_previous then v_skip := 'stale'; end if;
  if v_skip is not null then
    return jsonb_build_object('familyId',v_family,'productId',v_current.product_id,'plan',v_current.plan,
      'status',v_current.status,'expiresAt',v_current.expires_at,'skipped',v_skip);
  end if;

  insert into public.store_subscriptions(family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at,auto_renewing,raw)
    values(v_family,coalesce(p_purchaser_user_id,v_current.purchaser_user_id),v_platform,v_product.product_id,v_product.plan,v_key,v_status,
      v_expires,(p_state->>'autoRenewing')::boolean,coalesce(nullif(p_state->'raw','null'::jsonb),'{}'::jsonb)||jsonb_build_object('version',v_version))
    on conflict(store_key) do update set
      product_id=excluded.product_id,plan=excluded.plan,status=excluded.status,expires_at=excluded.expires_at,
      purchaser_user_id=excluded.purchaser_user_id,auto_renewing=excluded.auto_renewing,raw=excluded.raw;
  if v_link is not null then
    insert into gina.store_replacements(old_store_key,new_store_key,family_id) values(v_link,v_key,v_family)
      on conflict(old_store_key) do nothing;
    update public.store_subscriptions set status='expired',auto_renewing=false where store_key=v_link;
  end if;
  return jsonb_build_object('familyId',v_family,'productId',v_product.product_id,'plan',v_product.plan,
    'status',v_status,'expiresAt',v_expires);
end;
$$;
revoke all on function public.apply_verified_store_state(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_verified_store_state(jsonb,uuid,uuid) to service_role;
