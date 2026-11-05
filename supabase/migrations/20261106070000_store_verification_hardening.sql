-- S03 store verification hardening (no live store calls in this migration).
-- 1. Every verified write records its source; the first verified store notification for a key
--    stamps notified_at, so a receipt that only the client has ever presented stays visibly
--    "client_only" until Apple/Google confirm it. Google acknowledgement is recorded separately.
-- 2. A receipt bound to one family cannot be claimed by another; the refusal itself is now
--    audited (service_role RPC, called by iap-verify after the atomic write rejects).
-- 3. Reconcile candidates include Google purchases the server last saw as ACKNOWLEDGEMENT_STATE_PENDING
--    and has not confirmed as acknowledged (Google refunds unacknowledged purchases after 3 days).
-- 4. Operator reconcile receipts carry result_kind='store_check': a store check is never a refund.

alter table public.store_subscriptions
  add column last_source text check (last_source in ('client_verify','notification','reconcile','operator')),
  add column notified_at timestamptz,
  add column acknowledged_at timestamptz;

comment on column public.store_subscriptions.last_source is 'Which verified path wrote the current state.';
comment on column public.store_subscriptions.notified_at is 'First verified Apple/Google server notification for this key; null = store has not confirmed yet.';
comment on column public.store_subscriptions.acknowledged_at is 'Google acknowledge confirmed by the server (null for Apple).';

-- Verification label for operators: never a refund/cancel statement.
create function gina.store_verification_label(s public.store_subscriptions) returns text
language sql immutable set search_path='' as $$
  select case
    when s.platform='google' and s.acknowledged_at is null and s.status in ('active','grace')
      and s.raw->'subscription'->>'acknowledgementState' = 'ACKNOWLEDGEMENT_STATE_PENDING' then 'unacknowledged'
    when s.notified_at is not null then 'store_notified'
    when s.last_source in ('reconcile','operator') then 'store_checked'
    when s.last_source='client_verify' then 'client_only'
    else 'legacy'
  end;
$$;
revoke all on function gina.store_verification_label(public.store_subscriptions) from public,anon,authenticated;
grant execute on function gina.store_verification_label(public.store_subscriptions) to service_role;

create or replace function public.apply_verified_store_state(
  p_state jsonb, p_caller_family_id uuid default null, p_purchaser_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_key text := p_state->>'storeKey';
  v_link text := nullif(p_state->>'replacesStoreKey','');
  v_platform public.store_platform := (p_state->>'platform')::public.store_platform;
  v_status public.subscription_status := (p_state->>'status')::public.subscription_status;
  v_source text := nullif(p_state->>'source','');
  v_acknowledged boolean := (p_state->>'acknowledged')::boolean;
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
    or (v_link is not null and (v_platform<>'google' or v_link=v_key or length(v_link)>2048))
    or (v_source is not null and v_source not in ('client_verify','notification','reconcile','operator'))
    or (p_state ? 'acknowledged' and jsonb_typeof(p_state->'acknowledged') not in ('boolean','null'))
    or (v_acknowledged and v_platform<>'google') then
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
    -- A stale or replaced event still proves the store knows this key / the purchase is acknowledged.
    if v_current.id is not null and ((v_source='notification' and v_current.notified_at is null)
        or (v_acknowledged and v_current.acknowledged_at is null)) then
      update public.store_subscriptions set
        notified_at=coalesce(notified_at,case when v_source='notification' then now() end),
        acknowledged_at=coalesce(acknowledged_at,case when v_acknowledged then now() end)
        where id=v_current.id;
    end if;
    return jsonb_build_object('familyId',v_family,'productId',v_current.product_id,'plan',v_current.plan,
      'status',v_current.status,'expiresAt',v_current.expires_at,'skipped',v_skip);
  end if;

  insert into public.store_subscriptions(family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at,auto_renewing,raw,
      last_source,notified_at,acknowledged_at)
    values(v_family,coalesce(p_purchaser_user_id,v_current.purchaser_user_id),v_platform,v_product.product_id,v_product.plan,v_key,v_status,
      v_expires,(p_state->>'autoRenewing')::boolean,coalesce(nullif(p_state->'raw','null'::jsonb),'{}'::jsonb)||jsonb_build_object('version',v_version),
      v_source,case when v_source='notification' then now() end,case when v_acknowledged then now() end)
    on conflict(store_key) do update set
      product_id=excluded.product_id,plan=excluded.plan,status=excluded.status,expires_at=excluded.expires_at,
      purchaser_user_id=excluded.purchaser_user_id,auto_renewing=excluded.auto_renewing,raw=excluded.raw,
      last_source=coalesce(excluded.last_source,public.store_subscriptions.last_source),
      notified_at=coalesce(public.store_subscriptions.notified_at,excluded.notified_at),
      acknowledged_at=coalesce(public.store_subscriptions.acknowledged_at,excluded.acknowledged_at);
  if v_link is not null then
    insert into gina.store_replacements(old_store_key,new_store_key,family_id) values(v_link,v_key,v_family)
      on conflict(old_store_key) do nothing;
    update public.store_subscriptions set status='expired',auto_renewing=false where store_key=v_link;
  end if;
  return jsonb_build_object('familyId',v_family,'productId',v_product.product_id,'plan',v_product.plan,
    'status',v_status,'expiresAt',v_expires);
end;
$$;

-- Audited refusal: another family presented a receipt that is already bound (or signed) elsewhere.
-- The write RPC raises and rolls back, so the record is a separate service_role call. No raw token
-- is stored: a hash (correlation), the length and a 4-character hint for long tokens only.
create function public.record_store_account_conflict(
  p_platform public.store_platform, p_store_key text, p_caller_family_id uuid, p_user_id uuid default null,
  p_source text default 'client_verify'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner public.store_subscriptions; v_id bigint;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_platform is null or p_store_key is null or length(p_store_key) not between 1 and 2048 or p_caller_family_id is null
    or p_source is null or p_source not in ('client_verify','notification','reconcile','operator') then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  select * into v_owner from public.store_subscriptions where store_key=p_store_key and platform=p_platform;
  insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details)
    values(p_user_id,'store_subscription.account_mismatch','store_subscriptions',v_owner.id::text,
      case when exists(select 1 from public.families where id=p_caller_family_id) then p_caller_family_id end,
      'receipt bound to another family',
      jsonb_build_object('platform',p_platform,'source',p_source,'caller_family_id',p_caller_family_id,
        'owner_family_id',v_owner.family_id,'store_key_hash',encode(sha256(convert_to(p_store_key,'UTF8')),'hex'),
        'store_key_length',length(p_store_key),
        'store_key_hint',case when length(p_store_key)>=16 then left(p_store_key,4)||'…' end))
    returning id into v_id;
  return v_owner.id;
end;
$$;
revoke all on function public.record_store_account_conflict(public.store_platform,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_store_account_conflict(public.store_platform,text,uuid,uuid,text) to service_role;

-- Reconcile candidates: near-expiry/on-hold rows as before, plus Google purchases the server has
-- not confirmed as acknowledged (Google refunds unacknowledged purchases after 3 days).
create or replace function public.iap_reconcile_candidates(
  p_window interval default interval '2 days',
  p_min_age interval default interval '6 hours',
  p_limit int default 200
)
returns table (
  id uuid, family_id uuid, platform public.store_platform, product_id text, store_key text,
  status public.subscription_status, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.family_id, s.platform, s.product_id, s.store_key, s.status, s.expires_at
  from public.store_subscriptions s
  where s.updated_at < now() - p_min_age
    and (
      (s.status in ('active', 'grace', 'on_hold')
        and s.expires_at < now() + p_window
        and s.expires_at > now() - interval '60 days')
      or (s.platform = 'google' and s.status in ('active', 'grace') and s.acknowledged_at is null
        and s.raw->'subscription'->>'acknowledgementState' = 'ACKNOWLEDGEMENT_STATE_PENDING'
        and s.created_at > now() - interval '7 days')
    )
  order by (s.platform = 'google' and s.acknowledged_at is null) desc, s.expires_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Operator store check is labelled as such; it is never a refund, cancellation or compensation.
create or replace function gina.reconcile_job_receipt(j gina.store_reconcile_jobs) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',j.id,'family_id',j.family_id,'subscription_id',j.subscription_id,'reason',j.reason,'status',j.status,'code',j.code,'attempts',j.attempts,'created_at',j.created_at,'completed_at',j.completed_at,'retry_after',j.lease_until,'result_kind','store_check');
$$;

-- Finance workspace exposes the verification label (read-only; no raw receipts).
create or replace function public.finance_workspace(p_query text default '',p_family_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_families jsonb;v_detail jsonb;v_notifications jsonb;v_summary jsonb;
begin
 if not gina.has_operation_role('finance') then raise exception 'forbidden' using errcode='42501';end if;
 if length(coalesce(p_query,''))>120 then raise exception 'invalid_input' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_families from (
   select f.id,f.name,e.plan,e.source,e.expires_at from public.families f
   cross join lateral gina.effective_entitlement(f.id) e
   where coalesce(trim(p_query),'')='' or position(lower(trim(p_query)) in lower(f.name))>0 or f.id::text=trim(p_query)
   order by f.name,f.id limit 50
 )x;
 if p_family_id is not null then
   select jsonb_build_object('id',f.id,'name',f.name,'effective',to_jsonb(e),
     'subscriptions',coalesce((select jsonb_agg(jsonb_build_object(
       'id',s.id,'platform',s.platform,'plan',s.plan,'product_id',s.product_id,'status',s.status,
       'expires_at',s.expires_at,'auto_renewing',s.auto_renewing,'updated_at',s.updated_at,
       'last_source',s.last_source,'notified_at',s.notified_at,'acknowledged_at',s.acknowledged_at,
       'verification',gina.store_verification_label(s)
     ) order by s.updated_at desc,s.id) from public.store_subscriptions s where s.family_id=f.id),'[]'),
     'overrides',coalesce((select jsonb_agg(jsonb_build_object(
       'id',o.id,'plan',o.plan,'reason',o.reason,'starts_at',o.starts_at,'ends_at',o.ends_at,'revoked_at',o.revoked_at
     ) order by o.created_at desc,o.id) from public.entitlement_overrides o where o.family_id=f.id),'[]')
   ) into v_detail from public.families f cross join lateral gina.effective_entitlement(f.id) e where f.id=p_family_id;
   if v_detail is null then raise exception 'family_not_found' using errcode='P0001';end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_notifications from (
   select n.id,n.platform,n.received_at,n.attempts,n.processed_at,
     case when n.lease_until>now() then 'processing'
       when n.processed_at is not null and n.error is null then 'done'
       when n.error is not null then 'failed' else 'waiting' end as status,
     case when n.error is null then null
       when n.error in ('family_not_found','store_not_configured','pending','invalid_jws','processing_failed',
         'account_mismatch','bundle_mismatch','not_a_subscription','unknown_product','invalid_purchase_token','invalid_store_state') then n.error
       else 'processing_failed' end as error_code,
     s.family_id,f.name as family_name
   from public.store_notifications n
   left join public.store_subscriptions s on s.store_key=n.store_key and s.platform=n.platform
   left join public.families f on f.id=s.family_id
   where (n.processed_at is null or n.error is not null)
     and (p_family_id is null or s.family_id=p_family_id)
   order by n.received_at desc,n.id limit 50
 )x;
 select jsonb_build_object(
   'unprocessed',(select count(*) from public.store_notifications where processed_at is null or error is not null),
   'active_store_families',(select count(distinct family_id) from public.store_subscriptions where status in ('active','grace') and expires_at>now()),
   'active_overrides',(select count(*) from public.entitlement_overrides where revoked_at is null and starts_at<=now() and ends_at>now()),
   'as_of',now()
 ) into v_summary;
 return jsonb_build_object('families',v_families,'detail',v_detail,'notifications',v_notifications,'summary',v_summary);
end;$$;
