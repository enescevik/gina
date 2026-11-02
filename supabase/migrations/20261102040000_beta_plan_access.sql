-- Expiring, individually granted beta access. Never inferred from client flags or email domains.
create table public.beta_test_access (
 user_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 expires_at timestamptz not null, reason text not null check(length(reason)>3),
 primary key(user_id,family_id)
);
create table public.beta_plan_selections (
 family_id uuid primary key references public.families(id) on delete cascade,
 selected_by uuid not null references auth.users(id) on delete cascade,
 plan public.plan_code not null, updated_at timestamptz not null default now()
);
create table public.beta_plan_events (
 id bigint generated always as identity primary key,
 family_id uuid references public.families(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 plan public.plan_code, created_at timestamptz not null default now()
);
alter table public.beta_test_access enable row level security;
alter table public.beta_plan_selections enable row level security;
alter table public.beta_plan_events enable row level security;
revoke all on public.beta_test_access,public.beta_plan_selections,public.beta_plan_events from anon,authenticated;
grant all on public.beta_test_access,public.beta_plan_selections,public.beta_plan_events to service_role;
grant usage,select on sequence public.beta_plan_events_id_seq to service_role;

create function gina.effective_entitlement(p_family uuid)
returns table(plan public.plan_code,source text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 with candidates as (
  select s.plan,'beta'::text source,a.expires_at,100 priority
  from public.beta_plan_selections s
  join public.beta_test_access a on a.user_id=s.selected_by and a.family_id=s.family_id
  join public.family_members m on m.user_id=a.user_id and m.family_id=a.family_id and m.role='parent'
  where s.family_id=p_family and a.expires_at>now()
  union all
  select s.plan,'store',s.expires_at,gina.plan_rank(s.plan)
  from public.store_subscriptions s where s.family_id=p_family and s.status in('active','grace') and s.expires_at>now()
  union all
  select o.plan,'comp',o.ends_at,gina.plan_rank(o.plan)
  from public.entitlement_overrides o where o.family_id=p_family and o.revoked_at is null and o.starts_at<=now() and o.ends_at>now()
  union all select 'free'::public.plan_code,'free',null,-1
 ) select plan,source,expires_at from candidates order by priority desc,expires_at desc limit 1;
$$;
revoke all on function gina.effective_entitlement(uuid) from public,anon,authenticated;

create or replace function public.get_family_entitlement(p_family_id uuid default null)
returns table(plan public.plan_code,source text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select e.* from gina.effective_entitlement(coalesce(p_family_id,gina.family_id())) e
 where coalesce(p_family_id,gina.family_id()) is not null
 and (gina.is_admin() or coalesce(p_family_id,gina.family_id())=gina.family_id() or auth.role()='service_role');
$$;
create or replace function gina.family_plan_of(p_family_id uuid) returns public.plans
language sql stable security definer set search_path='' as $$
 select p.* from public.plans p join gina.effective_entitlement(p_family_id) e on e.plan=p.code;
$$;
create function public.get_beta_test_access()
returns table(expires_at timestamptz,selected_plan public.plan_code)
language sql stable security definer set search_path='' as $$
 select a.expires_at,s.plan from public.beta_test_access a
 left join public.beta_plan_selections s on s.family_id=a.family_id
 where a.user_id=auth.uid() and a.family_id=gina.family_id() and a.expires_at>now() and gina.is_parent();
$$;
create function public.set_beta_test_plan(p_plan public.plan_code default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.beta_test_access where user_id=auth.uid() and family_id=gina.family_id() and expires_at>now() for update;
 if not found then raise exception 'beta_access_required' using errcode='42501'; end if;
 if p_plan is null then delete from public.beta_plan_selections where family_id=gina.family_id();
 else insert into public.beta_plan_selections(family_id,selected_by,plan) values(gina.family_id(),auth.uid(),p_plan)
 on conflict(family_id) do update set plan=excluded.plan,selected_by=excluded.selected_by,updated_at=now(); end if;
 insert into public.beta_plan_events(family_id,user_id,plan) values(gina.family_id(),auth.uid(),p_plan);
end; $$;
revoke all on function public.get_beta_test_access(),public.set_beta_test_plan(public.plan_code) from public,anon;
grant execute on function public.get_beta_test_access(),public.set_beta_test_plan(public.plan_code) to authenticated;
