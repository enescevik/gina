-- Selective period transfer: chosen routines and unfinished plan items continue in the
-- new education period as NEW records linked to their source. Submitted work, answers,
-- stars and rewards are never moved. Unselected records are paused/archived explicitly
-- (the existing pause/archive semantics) or kept running by explicit parent choice.
alter table public.task_templates add column source_routine_id uuid references public.task_templates(id) on delete set null;
alter table public.task_templates add column source_period_id uuid references gina.child_education_periods(id) on delete set null;
alter table public.task_templates add column period_id uuid references gina.child_education_periods(id) on delete set null;
-- L04 groundwork: the date from which this routine version is in effect. Not yet versioned.
alter table public.task_templates add column effective_from date;
create index task_templates_source_idx on public.task_templates(source_routine_id) where source_routine_id is not null;
alter table gina.learning_plan add column source_item_id uuid references gina.learning_plan(id) on delete set null;
alter table gina.learning_plan add column source_period_id uuid references gina.child_education_periods(id) on delete set null;
alter table gina.learning_plan add column period_id uuid references gina.child_education_periods(id) on delete set null;
alter table gina.learning_plan add column effective_from date;

-- Candidate rows belong to the closed source period and have not already continued in the target period.
create function gina.period_transfer_candidates(p_child_id uuid,p_to gina.child_education_periods) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'routines',coalesce((select jsonb_agg(jsonb_build_object(
    'id',t.id,'revision',t.revision,'title',t.title,'icon',t.icon,'stars',t.stars,'days_of_week',to_jsonb(t.days_of_week),
    'time_of_day',t.time_of_day,'requires_approval',t.requires_approval,'starts_on',t.starts_on,'ends_on',t.ends_on,
    'pending',(select count(*) from public.task_completions c where c.template_id=t.id and c.status='done'),
    'returned',(select count(*) from public.task_completions c where c.template_id=t.id and c.status='returned'),
    'approved',(select count(*) from public.task_completions c where c.template_id=t.id and c.status='approved'),
    'stars_earned',coalesce((select sum(e.delta) from public.star_events e join public.task_completions c on c.id=e.completion_id where c.template_id=t.id),0)
   ) order by t.sort_order,t.created_at,t.id)
   from public.task_templates t where t.child_id=p_child_id and t.active and t.archived_at is null and t.starts_on<p_to.starts_on
   and (t.period_id is null or t.period_id<>p_to.id)
   and not exists(select 1 from public.task_templates c where c.source_routine_id=t.id and c.period_id=p_to.id)),'[]'),
  'plans',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'revision',r.revision,'kind',r.content->>'kind','title',r.content->>'title','subject',r.content->>'subject',
    'planned_on',r.content->>'planned_on','due_on',r.content->'due_on','time',r.content->'time',
    'steps',jsonb_array_length(r.content->'steps'),
    'steps_checked',(select count(*) from jsonb_array_elements(r.content->'steps') s where (s->>'checked')::boolean)
   ) order by r.content->>'planned_on',r.id)
   from gina.learning_plan r where r.child_id=p_child_id and not (r.content->>'done')::boolean and not (r.content->>'archived')::boolean
   and (r.content->>'planned_on')::date<p_to.starts_on and (r.period_id is null or r.period_id<>p_to.id)
   and not exists(select 1 from gina.learning_plan c where c.source_item_id=r.id and c.period_id=p_to.id)),'[]'));
$$;
revoke all on function gina.period_transfer_candidates(uuid,gina.child_education_periods) from public,anon,authenticated,service_role;

-- Source must be a closed period of this child; target must be the current open period after it.
create function gina.period_transfer_pair(p_child_id uuid,p_family uuid,p_from uuid,p_to uuid,out o_from gina.child_education_periods,out o_to gina.child_education_periods)
returns record language plpgsql stable security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or p_from=p_to then raise exception 'transfer_period';end if;
 select * into o_from from gina.child_education_periods where id=p_from and child_id=p_child_id and family_id=p_family;
 select * into o_to from gina.child_education_periods where id=p_to and child_id=p_child_id and family_id=p_family;
 if o_from.id is null or o_to.id is null or o_from.ends_on is null or o_to.ends_on is not null or o_from.starts_on>=o_to.starts_on
 then raise exception 'transfer_period';end if;
end;$$;
revoke all on function gina.period_transfer_pair(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.preview_education_period_transfer(p_child_id uuid,p_from_period_id uuid,p_to_period_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();v_from gina.child_education_periods;v_to gina.child_education_periods;today date;pair record;
begin
 if auth.uid() is null or gina.is_parent() is not true or f is null
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'transfer_forbidden' using errcode='42501';end if;
 select (now() at time zone timezone)::date into today from public.families where id=f;
 select * into pair from gina.period_transfer_pair(p_child_id,f,p_from_period_id,p_to_period_id);v_from:=pair.o_from;v_to:=pair.o_to;
 return jsonb_build_object(
  'revision',coalesce((select revision from gina.child_education_state where child_id=p_child_id),0),
  'today',today,'from',to_jsonb(v_from)-'timetable_snapshot','to',to_jsonb(v_to)-'timetable_snapshot',
  'archived',(select archived_at is not null from public.children where id=p_child_id))
  ||gina.period_transfer_candidates(p_child_id,v_to);
end;$$;

create function public.transfer_education_period_items(
 p_request_id uuid,p_child_id uuid,p_from_period_id uuid,p_to_period_id uuid,p_revision integer,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();v_from gina.child_education_periods;v_to gina.child_education_periods;pair record;
 payload jsonb;result jsonb;candidates jsonb;today date;v_revision integer;item jsonb;action text;
 old_t public.task_templates;new_t public.task_templates;old_p gina.learning_plan;new_id uuid;
 v_title text;v_days smallint[];v_time public.time_of_day;v_stars integer;v_start date;v_end date;v_due date;v_clock text;v_content jsonb;
 created_routines jsonb:='[]';paused_routines jsonb:='[]';kept_routines jsonb:='[]';
 created_plans jsonb:='[]';archived_plans jsonb:='[]';kept_plans jsonb:='[]';
begin
 if auth.uid() is null or gina.is_parent() is not true or f is null
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'transfer_forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision is null or p_revision<0 or p_items is null or jsonb_typeof(p_items)<>'object'
 or jsonb_typeof(p_items->'routines') is distinct from 'array' or jsonb_typeof(p_items->'plans') is distinct from 'array'
 or p_items-array['routines','plans']<>'{}'::jsonb
 or jsonb_array_length(p_items->'routines')>200 or jsonb_array_length(p_items->'plans')>200
 then raise exception 'transfer_invalid';end if;
 payload:=jsonb_build_object('action','education.transfer_items','family',f,'child',p_child_id,'from',p_from_period_id,'to',p_to_period_id,'revision',p_revision,'items',p_items);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 perform gina.require_active_child(p_child_id);
 -- One transfer per child at a time; a concurrent education change or second parent waits here.
 perform 1 from public.children where id=p_child_id and family_id=f for update;
 if not found then raise exception 'transfer_forbidden' using errcode='42501';end if;
 select (now() at time zone timezone)::date into today from public.families where id=f;
 select * into pair from gina.period_transfer_pair(p_child_id,f,p_from_period_id,p_to_period_id);v_from:=pair.o_from;v_to:=pair.o_to;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 select s.revision into v_revision from gina.child_education_state s where child_id=p_child_id for update;
 if v_revision<>p_revision then raise exception 'education_changed';end if;
 candidates:=gina.period_transfer_candidates(p_child_id,v_to);
 -- Every current candidate needs an explicit decision; a stale or partial list is a conflict, not a silent default.
 if (select count(distinct x->>'id') from jsonb_array_elements(p_items->'routines') x)<>jsonb_array_length(p_items->'routines')
 or (select count(distinct x->>'id') from jsonb_array_elements(p_items->'plans') x)<>jsonb_array_length(p_items->'plans')
 then raise exception 'transfer_invalid';end if;
 if (select coalesce(array_agg(x->>'id' order by x->>'id'),'{}') from jsonb_array_elements(p_items->'routines') x)
   is distinct from (select coalesce(array_agg(x->>'id' order by x->>'id'),'{}') from jsonb_array_elements(candidates->'routines') x)
 or (select coalesce(array_agg(x->>'id' order by x->>'id'),'{}') from jsonb_array_elements(p_items->'plans') x)
   is distinct from (select coalesce(array_agg(x->>'id' order by x->>'id'),'{}') from jsonb_array_elements(candidates->'plans') x)
 then raise exception 'transfer_changed';end if;

 for item in select * from jsonb_array_elements(p_items->'routines') order by 1 loop
  action:=item->>'action';
  if jsonb_typeof(item)<>'object' or action is null or action not in('copy','pause','keep') or jsonb_typeof(item->'revision') is distinct from 'number'
  or item-array['id','revision','action','title','days_of_week','time_of_day','stars','starts_on','ends_on']<>'{}'::jsonb
  then raise exception 'transfer_invalid';end if;
  select * into old_t from public.task_templates where id=(item->>'id')::uuid and child_id=p_child_id and family_id=f for update;
  if old_t.id is null or old_t.revision<>(item->>'revision')::integer or not old_t.active or old_t.archived_at is not null then raise exception 'task_routine_changed';end if;
  if action='copy' then
   begin
    v_title:=coalesce(btrim(item->>'title'),old_t.title);
    v_time:=coalesce((item->>'time_of_day')::public.time_of_day,old_t.time_of_day);
    v_stars:=coalesce((item->>'stars')::integer,old_t.stars);
    v_start:=coalesce((item->>'starts_on')::date,greatest(today,v_to.starts_on));
    v_end:=(item->>'ends_on')::date;
    if item ? 'days_of_week' then
     if jsonb_typeof(item->'days_of_week')<>'array' then raise exception 'transfer_invalid';end if;
     select array_agg(d::text::smallint order by d::text::smallint) into v_days from jsonb_array_elements(item->'days_of_week') d;
    else v_days:=old_t.days_of_week;end if;
   exception when others then raise exception 'transfer_invalid';end;
   if length(v_title) not between 1 and 80 or v_stars not between 0 and 10
   or v_days is null or cardinality(v_days) not between 1 and 7 or not(v_days <@ array[1,2,3,4,5,6,7]::smallint[])
   or cardinality(v_days)<>(select count(distinct d) from unnest(v_days) d)
   or v_start<v_to.starts_on or v_start>today+365 or (v_end is not null and (v_end<v_start or v_end>today+730))
   then raise exception 'transfer_invalid';end if;
   insert into public.task_templates(family_id,child_id,title,icon,stars,days_of_week,time_of_day,starts_on,ends_on,requires_approval,active,sort_order,
    source_routine_id,source_period_id,period_id,effective_from)
   values(f,p_child_id,v_title,old_t.icon,v_stars,v_days,v_time,v_start,v_end,old_t.requires_approval,true,old_t.sort_order,
    old_t.id,v_from.id,v_to.id,v_start) returning * into new_t;
   created_routines:=created_routines||jsonb_build_object('id',new_t.id,'source_routine_id',old_t.id,'title',new_t.title,'starts_on',new_t.starts_on);
  end if;
  if action in('copy','pause') then
   -- Existing pause semantics: new submissions stop; submitted work, approvals and stars stay.
   update public.task_templates set active=false where id=old_t.id;
   paused_routines:=paused_routines||to_jsonb(old_t.id);
  else kept_routines:=kept_routines||to_jsonb(old_t.id);end if;
 end loop;

 for item in select * from jsonb_array_elements(p_items->'plans') order by 1 loop
  action:=item->>'action';
  if jsonb_typeof(item)<>'object' or action is null or action not in('copy','archive','keep') or jsonb_typeof(item->'revision') is distinct from 'number'
  or item-array['id','revision','action','planned_on','due_on','time']<>'{}'::jsonb
  then raise exception 'transfer_invalid';end if;
  perform pg_advisory_xact_lock(hashtextextended(item->>'id',89));
  select * into old_p from gina.learning_plan where id=(item->>'id')::uuid and child_id=p_child_id for update;
  if old_p.id is null or old_p.revision<>(item->>'revision')::integer or (old_p.content->>'done')::boolean or (old_p.content->>'archived')::boolean
  then raise exception 'plan_changed';end if;
  if action='copy' then
   begin
    v_start:=coalesce((item->>'planned_on')::date,greatest((old_p.content->>'planned_on')::date,v_to.starts_on));
    v_due:=case when item ? 'due_on' then (item->>'due_on')::date else case when (old_p.content->>'due_on')::date>=v_start then (old_p.content->>'due_on')::date end end;
    v_clock:=case when item ? 'time' then item->>'time' else old_p.content->>'time' end;
   exception when others then raise exception 'transfer_invalid';end;
   if v_start<v_to.starts_on or v_start>today+365 or (v_due is not null and (v_due<v_start or v_due>today+365))
   or (v_clock is not null and v_clock!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'transfer_invalid';end if;
   -- Fresh steps: the child's old checkmarks are evidence of the old period, not of the new one.
   v_content:=old_p.content||jsonb_build_object('planned_on',to_char(v_start,'YYYY-MM-DD'),'due_on',case when v_due is null then 'null'::jsonb else to_jsonb(to_char(v_due,'YYYY-MM-DD')) end,
    'time',coalesce(to_jsonb(v_clock),'null'::jsonb),'done',false,'archived',false,
    'steps',coalesce((select jsonb_agg(s||'{"checked":false}'::jsonb order by ord) from jsonb_array_elements(old_p.content->'steps') with ordinality a(s,ord)),'[]'::jsonb));
   new_id:=gen_random_uuid();
   insert into gina.learning_plan(id,child_id,revision,content,source_id,done_at,updated_by,source_item_id,source_period_id,period_id,effective_from)
   values(new_id,p_child_id,1,v_content,old_p.source_id,null,auth.uid(),old_p.id,v_from.id,v_to.id,v_start);
   created_plans:=created_plans||jsonb_build_object('id',new_id,'source_item_id',old_p.id,'title',v_content->>'title','planned_on',v_content->>'planned_on');
  end if;
  if action in('copy','archive') then
   -- Existing archive semantics for plan items: hidden from the open list, steps and history kept, reversible by the parent.
   update gina.learning_plan set revision=revision+1,content=content||'{"archived":true}'::jsonb,updated_by=auth.uid(),updated_at=now() where id=old_p.id;
   archived_plans:=archived_plans||to_jsonb(old_p.id);
  else kept_plans:=kept_plans||to_jsonb(old_p.id);end if;
 end loop;

 update gina.child_education_state set revision=v_revision+1 where child_id=p_child_id;
 result:=jsonb_build_object('child_id',p_child_id,'from_period_id',v_from.id,'to_period_id',v_to.id,'revision',v_revision+1,
  'created_routines',created_routines,'paused_routines',paused_routines,'kept_routines',kept_routines,
  'created_plans',created_plans,'archived_plans',archived_plans,'kept_plans',kept_plans);
 insert into gina.child_education_changes(child_id,family_id,action,before_value,after_value,actor)
 values(p_child_id,f,'transfer_items',jsonb_build_object('from',v_from.id,'to',v_to.id,'items',p_items),result,auth.uid());
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;
revoke all on function public.preview_education_period_transfer(uuid,uuid,uuid),public.transfer_education_period_items(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.preview_education_period_transfer(uuid,uuid,uuid),public.transfer_education_period_items(uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
