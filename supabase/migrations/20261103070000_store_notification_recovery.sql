-- Only verified store events may enter this inbox (Edge verifies before claim).
-- Existing event IDs stay unchanged; platform is part of the identity.
alter table public.store_notifications
  drop constraint store_notifications_event_key_key,
  add constraint store_notifications_platform_event_key_key unique(platform, event_key),
  add column lease_token uuid,
  add column lease_until timestamptz,
  add column attempts integer not null default 0;

create function public.claim_store_notification(
  p_platform public.store_platform, p_event_key text, p_event_type text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.store_notifications; v_token uuid := gen_random_uuid();
begin
  if p_event_key is null or length(p_event_key) not between 1 and 256
    or p_payload is null or p_payload->'verified' is distinct from 'true'::jsonb then
    raise exception 'invalid_verified_notification' using errcode = '22023';
  end if;
  insert into public.store_notifications(platform,event_key,event_type,payload)
    values(p_platform,p_event_key,p_event_type,p_payload)
    on conflict(platform,event_key) do nothing;
  select * into strict v from public.store_notifications
    where platform=p_platform and event_key=p_event_key for update;
  -- A previous crash (no completion), or an error, must be recoverable.
  -- Legacy unverified rows never suppress a genuine verified event.
  if v.processed_at is not null and v.error is null and v.payload->'verified' = 'true'::jsonb then
    return jsonb_build_object('status','done');
  end if;
  if v.lease_until > clock_timestamp() then
    return jsonb_build_object('status','busy');
  end if;
  update public.store_notifications set
    lease_token=v_token, lease_until=clock_timestamp()+interval '5 minutes',
    attempts=attempts+1, processed_at=null, error=null, payload=p_payload, event_type=p_event_type
    where id=v.id;
  return jsonb_build_object('status','claimed','token',v_token);
end;
$$;

create function public.finish_store_notification(
  p_platform public.store_platform, p_event_key text, p_token uuid,
  p_error text default null, p_store_key text default null
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.store_notifications set
    processed_at=case when p_error is null then clock_timestamp() else null end,
    error=p_error, store_key=coalesce(p_store_key,store_key), lease_token=null, lease_until=null
    where platform=p_platform and event_key=p_event_key and lease_token=p_token
      and lease_until > clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;
revoke all on function public.claim_store_notification(public.store_platform,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.finish_store_notification(public.store_platform,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_store_notification(public.store_platform,text,text,jsonb) to service_role;
grant execute on function public.finish_store_notification(public.store_platform,text,uuid,text,text) to service_role;
