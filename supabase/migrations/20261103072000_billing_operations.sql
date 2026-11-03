-- Read-only finance workspace. No raw receipts, account tokens, email or child data.
create index store_notifications_open_received_idx on public.store_notifications(received_at desc,id)
  where processed_at is null or error is not null;
create function public.finance_workspace(p_query text default '',p_family_id uuid default null)
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
       'expires_at',s.expires_at,'auto_renewing',s.auto_renewing,'updated_at',s.updated_at
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
       when n.error in ('family_not_found','store_not_configured','pending','invalid_jws','processing_failed') then n.error
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
revoke all on function public.finance_workspace(text,uuid) from public,anon;
grant execute on function public.finance_workspace(text,uuid) to authenticated;
