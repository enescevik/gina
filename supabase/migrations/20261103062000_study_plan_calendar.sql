-- Explicit parent-reviewed application of selected plan days. Never grants stars or completes tasks.
create table public.study_plan_calendar_items (
 plan_id uuid not null references public.study_plans(id) on delete cascade,
 day int not null check(day between 1 and 14),
 family_id uuid not null references public.families(id) on delete cascade,
 event_id uuid unique references public.events(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(plan_id,day)
);
alter table public.study_plan_calendar_items enable row level security;
create policy plan_calendar_parent_read on public.study_plan_calendar_items for select to authenticated
 using(family_id=gina.family_id() and gina.is_parent());
grant select on public.study_plan_calendar_items to authenticated;
revoke insert,update,delete on public.study_plan_calendar_items from authenticated,anon;
create function public.apply_study_plan_calendar(p_request_id uuid,p_plan_id uuid,p_updated_at timestamptz,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); plan public.study_plans; receipt public.mutation_receipts; payload jsonb; result jsonb:='[]'; item jsonb; d int; starts timestamptz; ends timestamptz; event uuid; tz text;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_plan_id is null or p_updated_at is null or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'invalid_input';end if;
 if jsonb_array_length(p_items) not between 1 and 14 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('plan',p_plan_id,'updated_at',p_updated_at,'items',p_items);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>auth.uid() or receipt.operation<>'apply_study_plan_calendar' or receipt.payload<>payload then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 select * into plan from public.study_plans where id=p_plan_id and family_id=f for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if plan.updated_at<>p_updated_at then raise exception 'plan_changed';end if;
 if plan.status='archived' then raise exception 'plan_archived';end if;
 if not exists(select 1 from public.children where id=plan.child_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
 select timezone into tz from public.families where id=f;
 if jsonb_typeof(plan.plan->'gunler') is distinct from 'array' then raise exception 'plan_invalid';end if;
 if (select count(distinct x->>'day') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'invalid_input';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['day','title','notes','starts_at','minutes'])
   or item-array['day','title','notes','starts_at','minutes']<>'{}'::jsonb
   or jsonb_typeof(item->'day')<>'number' or (item->>'day')!~ '^[0-9]+$'
   or jsonb_typeof(item->'minutes')<>'number' or (item->>'minutes')!~ '^[0-9]+$'
   or jsonb_typeof(item->'title')<>'string' or length(trim(item->>'title')) not between 1 and 120
   or jsonb_typeof(item->'notes')<>'string' or length(trim(item->>'notes')) not between 1 and 1200
   or jsonb_typeof(item->'starts_at')<>'string' then raise exception 'invalid_input';end if;
  d:=(item->>'day')::int;
  if d not between 1 and 14 or (item->>'minutes')::int not between 5 and 60 then raise exception 'invalid_input';end if;
  if (select count(*) from jsonb_array_elements(plan.plan->'gunler') g where g->>'gun'=d::text)<>1 then raise exception 'plan_invalid';end if;
  if exists(select 1 from public.study_plan_calendar_items where plan_id=p_plan_id and day=d) then raise exception 'plan_day_applied';end if;
  starts:=(item->>'starts_at')::timestamptz;
  if not isfinite(starts) or (starts at time zone tz)::date<(now() at time zone tz)::date or (starts at time zone tz)::date>(now() at time zone tz)::date+365 then raise exception 'invalid_input';end if;
  ends:=starts+make_interval(mins=>(item->>'minutes')::int);
  event:=gen_random_uuid();
  insert into public.events(id,family_id,child_id,title,type,starts_at,ends_at,notes,visible_to_child,created_by)
   values(event,f,plan.child_id,trim(item->>'title'),'activity',starts,ends,trim(item->>'notes'),true,auth.uid());
  insert into public.study_plan_calendar_items(plan_id,day,family_id,event_id) values(p_plan_id,d,f,event);
  result:=result||jsonb_build_array(jsonb_build_object('day',d,'event_id',event));
 end loop;
 -- No overlapping blocks within this request. Existing calendar overlaps are reviewed by the parent.
 if exists(select 1 from jsonb_array_elements(p_items) a cross join jsonb_array_elements(p_items) b
  where (a->>'day')::int<(b->>'day')::int
   and (a->>'starts_at')::timestamptz<(b->>'starts_at')::timestamptz+make_interval(mins=>(b->>'minutes')::int)
   and (b->>'starts_at')::timestamptz<(a->>'starts_at')::timestamptz+make_interval(mins=>(a->>'minutes')::int)) then raise exception 'plan_overlap';end if;
 update public.study_plans set status='approved' where id=p_plan_id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'apply_study_plan_calendar',payload,result);
 return result;
end;$$;
revoke all on function public.apply_study_plan_calendar(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.apply_study_plan_calendar(uuid,uuid,timestamptz,jsonb) to authenticated;
