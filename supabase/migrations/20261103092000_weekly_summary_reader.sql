-- Display identities never enter the provider input or change an existing paid hash.
alter table gina.weekly_summary_contexts add column child_aliases jsonb;
create function gina.capture_weekly_aliases() returns trigger
language plpgsql security definer set search_path='' as $$
declare data jsonb; aliases jsonb;
begin
 -- One statement snapshot: concurrent child reorder cannot mismatch data and identity.
 select public.get_weekly_summary_data(new.family_id,new.week_start),
  (select coalesce(jsonb_object_agg(k.alias,k.id),'{}') from
   (select id,'Çocuk '||chr(64+row_number() over(order by sort_order,created_at,id)::int) alias
    from public.children where family_id=new.family_id) k)
 into data,aliases;
 new.context:=jsonb_set(new.context,'{input}',data);
 new.child_aliases:=aliases;
 return new;
end;$$;
revoke all on function gina.capture_weekly_aliases() from public,anon,authenticated,service_role;
create trigger capture_weekly_aliases before insert on gina.weekly_summary_contexts
 for each row execute function gina.capture_weekly_aliases();

-- A read never reserves quota or calls a provider. Even after plan downgrade, the
-- completed job remains readable if the final ai_summaries write/response was lost.
create function public.get_family_weekly_review(p_week date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.families; monday date; chosen date; c gina.weekly_summary_contexts;
 j public.ai_operation_jobs; plan public.plans; pol public.ai_operation_policies;
 data jsonb; aliases jsonb; kids jsonb; output jsonb; state text:='empty'; used int; allowed boolean;
begin
 if auth.uid() is null or not gina.is_parent() or gina.family_id() is null then
  raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=gina.family_id();
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.id::text,28));
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 chosen:=coalesce(p_week,monday-7);
 if not isfinite(chosen) or extract(isodow from chosen)<>1 or chosen<monday-56 or chosen>monday-7 then raise exception 'weekly_date';end if;
 select * into c from gina.weekly_summary_contexts where family_id=f.id and week_start=chosen;
 if c.id is not null then
  data:=c.context->'input'; aliases:=c.child_aliases;
  select * into j from public.ai_operation_jobs where family_id=f.id and action='weekly'
   and input_hash=encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex');
  state:=case when j.status='done' then 'ready'
   when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'working'
   when j.status in('working','uncertain') then 'uncertain'
   when j.status='failed' then 'failed' else 'empty' end;
  if state='ready' then output:=j.result->'output';end if;
 else
  select public.get_weekly_summary_data(f.id,chosen),
   (select coalesce(jsonb_object_agg(k.alias,k.id),'{}') from
    (select id,'Çocuk '||chr(64+row_number() over(order by sort_order,created_at,id)::int) alias
     from public.children where family_id=f.id) k)
  into data,aliases;
 end if;
 -- Old contexts deliberately keep aliases. Never infer their names from today's order.
 select coalesce(jsonb_agg(e.value||jsonb_build_object('name',ch.name) order by e.ordinality),'[]') into kids
 from jsonb_array_elements(data->'children') with ordinality e(value,ordinality)
 left join public.children ch on ch.family_id=f.id and ch.id::text=aliases->>(e.value->>'alias');
 plan:=gina.family_plan_of(f.id);
 select * into pol from public.ai_operation_policies where action='weekly' and plan_code=plan.code;
 select count(*) into used from public.ai_operation_jobs where family_id=f.id and action='weekly'
  and status<>'failed' and created_at>=gina.family_month_start(f.id);
 allowed:=coalesce(plan.ai_weekly and pol.enabled,false)
  and not exists(select 1 from public.app_settings where key='ai.enabled' and value='false'::jsonb)
  and not exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled);
 return jsonb_build_object('week_start',chosen,'weeks',(select jsonb_agg(monday-7*i order by i) from generate_series(1,8)i),
  'timezone',f.timezone,'state',state,'snapshot_at',c.created_at,'children',kids,'summary',output,
  'remaining',greatest(0,coalesce(pol.monthly_limit,0)-used),
  'can_generate',allowed and used<coalesce(pol.monthly_limit,0) and jsonb_array_length(kids)>0 and state in('empty','failed'),
  'access',case when jsonb_array_length(kids)=0 then 'no_children' when not allowed then 'disabled'
   when used>=coalesce(pol.monthly_limit,0) then 'quota' else 'available' end);
end;$$;
revoke all on function public.get_family_weekly_review(date) from public,anon,service_role;
grant execute on function public.get_family_weekly_review(date) to authenticated;
