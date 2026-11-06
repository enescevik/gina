-- C13 aday geri alma: orijinal tanimlar (20261106090000 plan_version_on, 20261106230000 routines_for_day) birebir; yalniz A-B-A olcumu icin.
create or replace function gina.plan_version_on(p_versions jsonb,p_day date) returns jsonb
language sql immutable set search_path='' as $$
 with v as (
  select x,(x->>'revision')::int as rev,
   coalesce((x->>'effective_from')::date,(x->>'known_since')::date,'-infinity'::date) as eff,
   coalesce((x->>'effective_from')::date,(x->>'known_since')::date) as start
  from jsonb_array_elements(coalesce(p_versions,'[]'::jsonb)) x),
 known as (select * from v where eff<=p_day order by eff desc,rev desc limit 1),
 earliest as (select * from v order by eff,rev limit 1),
 next_known as (select min(start) as day from v where start is not null)
 select case
  when exists(select 1 from known) then
   (select x||jsonb_build_object('status',case when start is null then 'unknown_before' else 'known' end,
    'unknown_before',case when start is null then (select day from next_known) end) from known)
  when exists(select 1 from earliest) then
   (select x||jsonb_build_object('status','unknown_before','unknown_before',coalesce(start,(select day from next_known))) from earliest)
  else null end;
$$;
create or replace function public.routines_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or f is null or (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id)) is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'plan_forbidden' using errcode='42501';end if;
 if p_day is null or not isfinite(p_day) then raise exception 'plan_day_invalid';end if;
 return jsonb_build_object('child_id',p_child_id,'day',p_day,'routines',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'current_revision',t.revision,
   'version',case when v is null then null else jsonb_build_object('revision',(v->>'revision')::int,'title',v->'value'->>'title','icon',v->'value'->>'icon',
     'stars',(v->'value'->>'stars')::int,'days_of_week',v->'value'->'days_of_week','time_of_day',v->'value'->>'time_of_day',
     'requires_approval',(v->'value'->>'requires_approval')::boolean,'effective_from',v->'effective_from','known_since',v->'known_since',
     'status',v->>'status','unknown_before',v->'unknown_before') end,
   'next',(select jsonb_build_object('revision',c.revision,'effective_from',c.effective_from,'title',c.after_value->>'title','icon',c.after_value->>'icon',
     'stars',(c.after_value->>'stars')::int,'days_of_week',c.after_value->'days_of_week')
    from gina.task_routine_changes c where c.template_id=t.id and c.superseded_by is null and c.effective_from>p_day order by c.effective_from,c.revision limit 1)
  ) order by t.sort_order,t.created_at,t.id) from public.task_templates t cross join lateral (select gina.task_routine_version_on(t.id,p_day) v) x
  where t.child_id=p_child_id and t.family_id=f),'[]'::jsonb));
end;$$;
