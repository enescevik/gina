-- A manually requested verification is not a refund/cancellation. Only verified
-- store state may change entitlement; operator clients never receive store keys.
create table gina.store_reconcile_jobs (
 id uuid primary key,
 actor_id uuid references auth.users(id) on delete set null,
 family_id uuid not null references public.families(id) on delete cascade,
 subscription_id uuid not null references public.store_subscriptions(id) on delete cascade,
 reason text not null check(length(reason) between 3 and 1000),
 status text not null default 'queued' check(status in('queued','processing','succeeded','unchanged','failed')),
 code text,
 attempts int not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index store_reconcile_jobs_subscription_idx on gina.store_reconcile_jobs(subscription_id,created_at desc);
create index store_reconcile_jobs_actor_idx on gina.store_reconcile_jobs(actor_id,created_at desc);
create index store_reconcile_jobs_family_idx on gina.store_reconcile_jobs(family_id,created_at desc);
revoke all on gina.store_reconcile_jobs from public,anon,authenticated;
create function gina.reconcile_job_receipt(j gina.store_reconcile_jobs) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',j.id,'family_id',j.family_id,'subscription_id',j.subscription_id,'reason',j.reason,'status',j.status,'code',j.code,'attempts',j.attempts,'created_at',j.created_at,'completed_at',j.completed_at,'retry_after',j.lease_until);
$$;
revoke all on function gina.reconcile_job_receipt(gina.store_reconcile_jobs) from public,anon,authenticated;

create function public.finance_request_reconcile(p_id uuid,p_family_id uuid,p_subscription_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j gina.store_reconcile_jobs;
begin
 if not gina.has_operation_role('finance') then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_family_id is null or p_subscription_id is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'invalid_input' using errcode='22023';end if;
 -- Actor lock serializes the global operator rate limit; request and subscription
 -- locks serialize exact replay and two operators checking the same purchase.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,74));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,75));
 select * into j from gina.store_reconcile_jobs where id=p_id;
 if found then
  if j.actor_id is distinct from auth.uid() or j.family_id<>p_family_id or j.subscription_id<>p_subscription_id or j.reason<>trim(p_reason) then raise exception 'request_conflict';end if;
  return gina.reconcile_job_receipt(j);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_subscription_id::text,76));
 perform 1 from public.store_subscriptions where id=p_subscription_id and family_id=p_family_id;
 if not found then raise exception 'subscription_not_found';end if;
 -- Another authorized operator may recover an abandoned job after its lease.
 -- No subscription row lock is held while taking a job lock (finish uses job→store).
 update gina.store_reconcile_jobs set status='failed',code='interrupted',lease_token=null,lease_until=null,completed_at=now()
 where subscription_id=p_subscription_id and ((status='queued' and created_at<now()-interval '2 minutes') or (status='processing' and lease_until<=now()));
 if exists(select 1 from gina.store_reconcile_jobs where subscription_id=p_subscription_id and status in('queued','processing')) then raise exception 'reconcile_pending';end if;
 if (select count(*) from gina.store_reconcile_jobs where actor_id=auth.uid() and created_at>now()-interval '1 hour')>=20
  or (select count(*) from gina.store_reconcile_jobs where subscription_id=p_subscription_id and created_at>now()-interval '1 hour')>=5 then raise exception 'reconcile_rate_limit';end if;
 insert into gina.store_reconcile_jobs(id,actor_id,family_id,subscription_id,reason) values(p_id,auth.uid(),p_family_id,p_subscription_id,trim(p_reason)) returning * into j;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason) values(auth.uid(),'store_reconcile.request','store_subscriptions',p_subscription_id::text,p_family_id,trim(p_reason));
 return gina.reconcile_job_receipt(j);
end;$$;

create function public.finance_reconcile_jobs(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.has_operation_role('finance') then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(gina.reconcile_job_receipt(j) order by j.created_at desc,j.id) from (select * from gina.store_reconcile_jobs where family_id=p_family_id order by created_at desc,id limit 20)j),'[]');
end;$$;

create function public.claim_operator_reconcile(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j gina.store_reconcile_jobs;s public.store_subscriptions;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 select * into j from gina.store_reconcile_jobs where id=p_id for update;
 if not found then raise exception 'reconcile_not_found';end if;
 if j.status in('succeeded','unchanged','failed') then return jsonb_build_object('status','done','receipt',gina.reconcile_job_receipt(j));end if;
 if j.status='processing' and j.lease_until>now() then return jsonb_build_object('status','busy','receipt',gina.reconcile_job_receipt(j));end if;
 if j.attempts>=3 then
  update gina.store_reconcile_jobs set status='failed',code='interrupted',lease_token=null,lease_until=null,completed_at=now() where id=p_id returning * into j;
  return jsonb_build_object('status','done','receipt',gina.reconcile_job_receipt(j));
 end if;
 select * into strict s from public.store_subscriptions where id=j.subscription_id;
 update gina.store_reconcile_jobs set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=p_id returning * into j;
 return jsonb_build_object('status','claimed','token',j.lease_token,'platform',s.platform,'store_key',s.store_key,'family_id',s.family_id);
end;$$;

create function public.finish_operator_reconcile(p_id uuid,p_token uuid,p_state jsonb default null,p_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j gina.store_reconcile_jobs;s public.store_subscriptions;r jsonb;v_code text;v_status text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 select * into j from gina.store_reconcile_jobs where id=p_id for update;
 if not found or j.status<>'processing' or j.lease_token is distinct from p_token or j.lease_until<=now() then raise exception 'reconcile_lease_lost';end if;
 if p_state is not null then
  if p_code is not null then raise exception 'invalid_input' using errcode='22023';end if;
  select * into strict s from public.store_subscriptions where id=j.subscription_id;
  if p_state->>'platform' is distinct from s.platform::text or p_state->>'storeKey' is distinct from s.store_key then raise exception 'account_mismatch';end if;
  -- The lease check, entitlement write and job completion share one transaction.
  r:=public.apply_verified_store_state(p_state);
  if r->>'familyId' is distinct from j.family_id::text then raise exception 'account_mismatch';end if;
  v_code:=r->>'skipped';v_status:=case when v_code is null then 'succeeded' else 'unchanged' end;
 else
  if p_code is null or p_code not in('no_data','store_not_configured','provider_failed','verification_failed','account_mismatch','state_write_failed') then raise exception 'invalid_input' using errcode='22023';end if;
  v_code:=p_code;v_status:=case when p_code='no_data' then 'unchanged' else 'failed' end;
 end if;
 update gina.store_reconcile_jobs set status=v_status,code=v_code,lease_token=null,lease_until=null,completed_at=now() where id=p_id returning * into j;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason) values(j.actor_id,'store_reconcile.'||j.status,'store_subscriptions',j.subscription_id::text,j.family_id,coalesce(j.code,'verified'));
 return gina.reconcile_job_receipt(j);
end;$$;
revoke all on function public.finance_request_reconcile(uuid,uuid,uuid,text),public.finance_reconcile_jobs(uuid),public.claim_operator_reconcile(uuid),public.finish_operator_reconcile(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.finance_request_reconcile(uuid,uuid,uuid,text),public.finance_reconcile_jobs(uuid) to authenticated;
grant execute on function public.claim_operator_reconcile(uuid),public.finish_operator_reconcile(uuid,uuid,jsonb,text) to service_role;
