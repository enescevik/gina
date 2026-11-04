-- Explicit, limited recovery after fixing delivery configuration; accepted devices stay accepted.
alter table public.push_outbox add column recovery_revision int not null default 0;
create table gina.push_recoveries (
 request_id uuid primary key,outbox_id bigint not null references public.push_outbox(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,reason text not null,outcomes jsonb not null,revision int not null,created_at timestamptz not null default now()
);
alter table gina.push_recoveries enable row level security;
revoke all on gina.push_recoveries from public,anon,authenticated,service_role;
create index on gina.push_recoveries(actor_id,created_at);
create function gina.push_recovery_available(o public.push_outbox) returns boolean language sql stable security definer set search_path='' as $$
 select o.status in('failed','skipped_unconfigured') and o.created_at>now()-interval '24 hours' and o.recovery_revision<2
 and exists(select 1 from public.push_targets(o.id)t where not exists(select 1 from gina.push_deliveries d where d.outbox_id=o.id and d.token_id=t.token_id and d.status='sent'));
$$;
revoke all on function gina.push_recovery_available(public.push_outbox) from public,anon,authenticated,service_role;
create function public.release_push_operations(p_status text default 'attention',p_before bigint default null,p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in('attention','all','pending','sending','sent','failed','skipped_unconfigured','no_targets') then raise exception 'invalid_input';end if;
 return jsonb_build_object('summary',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.push_outbox where created_at>now()-interval '30 days' group by status)c),
 'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'status',o.status,'attempts',o.attempts,'created_at',o.created_at,'next_attempt_at',o.next_attempt_at,'revision',o.recovery_revision,'retryable',gina.push_recovery_available(o),
 'receipts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from gina.push_deliveries where outbox_id=o.id group by status)d),
 'recoveries',(select coalesce(jsonb_agg(jsonb_build_object('revision',r.revision,'reason',r.reason,'created_at',r.created_at) order by r.revision),'[]') from gina.push_recoveries r where r.outbox_id=o.id)) order by o.id desc),'[]')
 from(select * from public.push_outbox where created_at>now()-interval '30 days' and (p_before is null or id<p_before) and (p_status='all' or (p_status='attention' and status in('failed','skipped_unconfigured')) or status=p_status) order by id desc limit greatest(1,least(coalesce(p_limit,30),100)))o));
end;$$;
create function public.release_retry_push(p_request uuid,p_outbox_id bigint,p_revision int,p_reason text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.push_outbox;f uuid;payload jsonb;result jsonb;previous jsonb;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_outbox_id is null or p_revision is null or p_revision<0 or p_confirmed is distinct from true or length(trim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action','push.recover','outbox',p_outbox_id,'revision',p_revision,'reason',trim(p_reason),'confirmed',p_confirmed);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select family_id into f from public.push_outbox where id=p_outbox_id;
 perform 1 from public.families where id=f for key share;
 select * into o from public.push_outbox where id=p_outbox_id for update;
 if not found then raise exception 'not_found';end if;
 if o.recovery_revision is distinct from p_revision then raise exception 'push_recovery_changed';end if;
 if not gina.push_recovery_available(o) then raise exception 'push_recovery_unavailable';end if;
 if (select count(*) from gina.push_recoveries where actor_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'push_recovery_limited';end if;
 -- Every accepted device remains excluded. Only failed/unconfigured/uncertain outcomes are cleared.
 select coalesce(jsonb_object_agg(status,n),'{}') into previous from(select status,count(*) n from gina.push_deliveries where outbox_id=o.id group by status)c;
 delete from gina.push_deliveries where outbox_id=o.id and status<>'sent';
 update public.push_outbox set status='pending',attempts=0,lease_id=null,claimed_at=null,next_attempt_at=now(),last_error=null,recovery_revision=recovery_revision+1 where id=o.id;
 insert into gina.push_recoveries(request_id,outbox_id,actor_id,reason,outcomes,revision) values(p_request,o.id,auth.uid(),trim(p_reason),previous,p_revision+1);
 result:=jsonb_build_object('request',p_request,'id',o.id,'revision',p_revision+1,'status','pending');
 perform gina.save_help_receipt(p_request,payload,result,o.family_id);
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details) values(auth.uid(),'push.recover','push_outbox',o.id::text,o.family_id,trim(p_reason),jsonb_build_object('revision',p_revision+1));
 return result;
end;$$;
revoke all on function public.release_push_operations(text,bigint,int),public.release_retry_push(uuid,bigint,int,text,boolean) from public,anon,service_role;
grant execute on function public.release_push_operations(text,bigint,int),public.release_retry_push(uuid,bigint,int,text,boolean) to authenticated;
