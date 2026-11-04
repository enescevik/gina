-- Device-level acknowledgements and fenced leases. Provider acceptance is not device delivery.
alter table public.push_outbox add column lease_id uuid, add column next_attempt_at timestamptz not null default now();
create table gina.push_deliveries (
 outbox_id bigint not null references public.push_outbox(id) on delete cascade,
 token_id uuid not null, token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 status text not null check(status in('sent','retry','failed','gone','unconfigured')),
 retry_after timestamptz, last_lease uuid not null, attempts int not null default 1, last_error text, updated_at timestamptz not null default now(),
 primary key(outbox_id,token_id)
);
alter table gina.push_deliveries enable row level security;
revoke all on gina.push_deliveries from public,anon,authenticated,service_role;

-- Old workers must fail closed during the migration -> Edge deployment interval.
revoke execute on function public.push_claim_batch(int),public.push_targets(bigint) from service_role;
revoke insert,update,delete on public.push_outbox from service_role;
create function public.push_claim_v2(p_limit int default 10) returns setof public.push_outbox
language plpgsql security definer set search_path='' as $$begin
 update public.push_outbox set status='failed',last_error='retry_limit',lease_id=null
 where attempts>=5 and (status='pending' or (status='sending' and claimed_at<now()-interval '5 minutes'));
 return query update public.push_outbox o set status='sending',attempts=o.attempts+1,claimed_at=now(),lease_id=gen_random_uuid()
 where o.id in(select id from public.push_outbox where attempts<5 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes')) order by created_at limit greatest(1,least(coalesce(p_limit,10),50)) for update skip locked)
 returning o.*;
end;$$;

create function public.push_delivery_targets(p_outbox_id bigint,p_lease uuid)
returns table(token_id uuid,token text,token_type text,platform text,locale text,token_hash text)
language plpgsql security definer set search_path='' as $$
declare o public.push_outbox;begin
 select * into o from public.push_outbox where id=p_outbox_id for share;
 if p_lease is null or not found or o.status<>'sending' or o.lease_id is distinct from p_lease or o.claimed_at<now()-interval '5 minutes' then raise exception 'push_lease_changed';end if;
 return query select t.*,encode(extensions.digest(t.token,'sha256'),'hex') from public.push_targets(o.id)t
 where not exists(select 1 from gina.push_deliveries d where d.outbox_id=o.id and d.token_id=t.token_id
 and (d.status='sent' or (d.token_hash=encode(extensions.digest(t.token,'sha256'),'hex') and d.status in('failed','gone','unconfigured'))));
end;$$;

create function public.push_record_delivery(p_outbox_id bigint,p_lease uuid,p_token_id uuid,p_token_hash text,p_status text,p_error text default null,p_retry_after int default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.push_outbox;d gina.push_deliveries;begin
 select * into o from public.push_outbox where id=p_outbox_id for update;
 if p_lease is null or not found or o.status<>'sending' or o.lease_id is distinct from p_lease or o.claimed_at<now()-interval '5 minutes' then raise exception 'push_lease_changed';end if;
 if p_token_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_status is null or p_status not in('sent','retry','failed','gone','unconfigured') or length(coalesce(p_error,''))>160 or (p_retry_after is not null and p_retry_after not between 1 and 86400) then raise exception 'push_receipt_invalid';end if;
 select * into d from gina.push_deliveries where outbox_id=o.id and token_id=p_token_id;
 if d.status='sent' then return true;end if;
 if d.last_lease=p_lease and d.token_hash=p_token_hash then
  if d.status is distinct from p_status or d.last_error is distinct from p_error then raise exception 'push_receipt_changed';end if;return true;
 end if;
 insert into gina.push_deliveries(outbox_id,token_id,token_hash,status,last_lease,last_error,retry_after)
 values(o.id,p_token_id,p_token_hash,p_status,p_lease,p_error,case when p_status='retry' and p_retry_after is not null then now()+make_interval(secs=>p_retry_after) end)
 on conflict(outbox_id,token_id) do update set token_hash=excluded.token_hash,status=excluded.status,last_lease=excluded.last_lease,last_error=excluded.last_error,retry_after=excluded.retry_after,attempts=gina.push_deliveries.attempts+1,updated_at=now();
 if p_status='gone' then
  delete from public.push_tokens where id=p_token_id and family_id=o.family_id and encode(extensions.digest(token,'sha256'),'hex')=p_token_hash;
 end if;
 return true;
end;$$;

create function public.push_finish_delivery(p_outbox_id bigint,p_lease uuid) returns text
language plpgsql security definer set search_path='' as $$
declare o public.push_outbox;remaining int;sent int;bad int;unconfigured int;result text;begin
 select * into o from public.push_outbox where id=p_outbox_id for update;
 if p_lease is null or not found or o.status<>'sending' or o.lease_id is distinct from p_lease or o.claimed_at<now()-interval '5 minutes' then raise exception 'push_lease_changed';end if;
 select count(*) into remaining from public.push_delivery_targets(o.id,p_lease);
 select count(*) filter(where status='sent'),count(*) filter(where status in('failed','gone')),count(*) filter(where status='unconfigured') into sent,bad,unconfigured from gina.push_deliveries where outbox_id=o.id;
 result:=case when remaining>0 and o.attempts<5 then 'pending' when remaining>0 or bad>0 then 'failed' when unconfigured>0 then 'skipped_unconfigured' when sent>0 then 'sent' else 'no_targets' end;
 update public.push_outbox set status=result,lease_id=null,next_attempt_at=greatest(now()+make_interval(secs=>least(900,60*power(2,o.attempts-1))::int),(select max(retry_after) from gina.push_deliveries where outbox_id=o.id and status='retry')),
 sent_at=case when sent>0 then now() else null end,
 last_error=case when result='pending' then 'device_retry_pending' when result='failed' then 'device_delivery_failed' when result='skipped_unconfigured' then 'provider_not_configured' else null end where id=o.id;
 return result;
end;$$;
revoke all on function public.push_claim_v2(int),public.push_delivery_targets(bigint,uuid),public.push_record_delivery(bigint,uuid,uuid,text,text,text,int),public.push_finish_delivery(bigint,uuid) from public,anon,authenticated;
grant execute on function public.push_claim_v2(int),public.push_delivery_targets(bigint,uuid),public.push_record_delivery(bigint,uuid,uuid,text,text,text,int),public.push_finish_delivery(bigint,uuid) to service_role;

create function gina.push_delivery_due() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.push_outbox where (status='pending' and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes'));
$$;
revoke all on function gina.push_delivery_due() from public,anon,authenticated,service_role;

-- Wake abandoned sending rows even when no new event arrives.
create or replace function gina.kick_push_send()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not gina.push_delivery_due() then
    return;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_send_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_send_secret';
    if v_url is null or v_secret is null then
      return;
    end if;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_secret),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'push-send tetiklenemedi';
  end;
end;
$$;

