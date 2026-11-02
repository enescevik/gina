-- Minimum child profile data: birth year, optional gender and coarse interests, no school name.
alter table public.children add column birth_year smallint check(birth_year between 2000 and 2100);
alter table public.children add column gender text not null default 'unspecified' check(gender in('unspecified','girl','boy'));
alter table public.children add column interests text[] not null default '{}' check(cardinality(interests)<=6 and interests <@ array['reading','science','art','music','sports','nature']);
create table public.child_setup_requests (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 payload jsonb not null, created_at timestamptz not null default now()
);
alter table public.child_setup_requests enable row level security;
revoke all on public.child_setup_requests from anon,authenticated;
grant all on public.child_setup_requests to service_role;
create function public.save_child_setup(p_request_id uuid,p_profile jsonb,p_tasks jsonb default '[]',p_child_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_child uuid; v_old public.child_setup_requests; v_task jsonb; v_year int; v_grade int;
 v_payload jsonb:=jsonb_build_object('profile',p_profile,'tasks',p_tasks,'child_id',p_child_id);
 v_family uuid:=gina.family_id(); v_today date;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_family::text,14));
 select * into v_old from public.child_setup_requests where id=p_request_id;
 if found then
  if v_old.user_id<>auth.uid() or v_old.family_id<>v_family or v_old.payload<>v_payload then raise exception 'request_conflict'; end if;
  return v_old.child_id;
 end if;
 v_year:=(p_profile->>'birth_year')::int; v_grade:=(p_profile->>'grade')::int;
 if nullif(trim(p_profile->>'name'),'') is null or length(trim(p_profile->>'name'))>40
  or v_year is null or v_year<extract(year from now())::int-18 or v_year>extract(year from now())::int-2
  or (v_grade is not null and v_grade not between 0 and 12)
  or jsonb_typeof(p_tasks) is distinct from 'array' then raise exception 'invalid_profile'; end if;
 if jsonb_array_length(p_tasks)>5 then raise exception 'too_many_starters'; end if;
 if p_child_id is null then
  insert into public.children(family_id,name,birth_year,grade,avatar,gender,interests)
  values(v_family,trim(p_profile->>'name'),v_year,v_grade,coalesce(p_profile->>'avatar','avatar-default'),coalesce(p_profile->>'gender','unspecified'),array(select jsonb_array_elements_text(coalesce(p_profile->'interests','[]')))) returning id into v_child;
 else
  if jsonb_array_length(p_tasks)>0 then raise exception 'edit_starters_not_allowed'; end if;
  update public.children set name=trim(p_profile->>'name'),birth_year=v_year,grade=v_grade,
   avatar=coalesce(p_profile->>'avatar','avatar-default'),gender=coalesce(p_profile->>'gender','unspecified'),interests=array(select jsonb_array_elements_text(coalesce(p_profile->'interests','[]')))
  where id=p_child_id and family_id=v_family returning id into v_child;
  if not found then raise exception 'child_not_found' using errcode='42501'; end if;
 end if;
 select (now() at time zone timezone)::date into v_today from public.families where id=v_family;
 for v_task in select value from jsonb_array_elements(p_tasks) loop
  insert into public.task_templates(family_id,child_id,title,icon,stars,days_of_week,starts_on)
  values(v_family,v_child,trim(v_task->>'title'),coalesce(v_task->>'icon','task-custom'),(v_task->>'stars')::smallint,
   array(select jsonb_array_elements_text(v_task->'days')::smallint),v_today);
 end loop;
 insert into public.child_setup_requests(id,user_id,family_id,child_id,payload) values(p_request_id,auth.uid(),v_family,v_child,v_payload);
 return v_child;
end; $$;
revoke all on function public.save_child_setup(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.save_child_setup(uuid,jsonb,jsonb,uuid) to authenticated;
