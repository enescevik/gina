-- One bounded operator run. No family, entitlements, publication or editorial decision is touched.
begin;
create table gina.library_generation_runs (
 id uuid primary key, requested_by uuid not null references auth.users(id),
 scope jsonb not null, status text not null check(status in ('ready','working','done','uncertain')),
 lease uuid, result jsonb, error_code text, created_at timestamptz not null default now(), finished_at timestamptz
);
alter table gina.library_generation_runs enable row level security;
revoke all on gina.library_generation_runs from public,anon,authenticated,service_role;
create function public.library_batch_claim(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j gina.library_generation_runs;begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 select * into j from gina.library_generation_runs where id=p_id for update;
 if not found or not exists(select 1 from public.admins where user_id=j.requested_by) then raise exception 'forbidden';end if;
 if j.status<>'ready' then return jsonb_build_object('status',j.status,'result',j.result);end if;
 update gina.library_generation_runs set status='working',lease=gen_random_uuid() where id=p_id returning * into j;
 return jsonb_build_object('status','claimed','lease',j.lease,'scope',j.scope);
end $$;
create function public.library_batch_finish(p_id uuid,p_lease uuid,p_result jsonb,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden';end if;
 update gina.library_generation_runs set status=case when p_result is null then 'uncertain' else 'done' end,result=p_result,error_code=p_error,finished_at=now()
 where id=p_id and lease=p_lease and status='working';
 if not found then raise exception 'lease_lost';end if;
end $$;
revoke all on function public.library_batch_claim(uuid),public.library_batch_finish(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.library_batch_claim(uuid),public.library_batch_finish(uuid,uuid,jsonb,text) to service_role;
commit;
