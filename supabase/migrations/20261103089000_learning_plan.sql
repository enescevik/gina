-- A dated learning item is not a recurring reward task. One item survives its due day.
create table gina.learning_plan (
 id uuid primary key,
 child_id uuid not null references public.children(id) on delete cascade,
 revision integer not null check(revision>0),
 content jsonb not null,
 source_id uuid references public.learning_sources(id) on delete set null,
 done_at timestamptz,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create index learning_plan_child_idx on gina.learning_plan(child_id);
alter table gina.learning_plan enable row level security;
revoke all on gina.learning_plan from public,anon,authenticated,service_role;
create function gina.learning_plan_access(p_child uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare tz text;begin
 if auth.uid() is null or gina.family_id() is null or
  (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child)) is not true
 then raise exception 'plan_forbidden' using errcode='42501';end if;
 select f.timezone into tz from public.children c join public.families f on f.id=c.family_id where c.id=p_child and c.family_id=gina.family_id();
 if tz is null then raise exception 'plan_forbidden' using errcode='42501';end if;
 return tz;
end;$$;
revoke all on function gina.learning_plan_access(uuid) from public,anon,authenticated,service_role;
create function public.get_learning_plan(p_child_id uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text:=gina.learning_plan_access(p_child_id);begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from or p_to-p_from>93 then raise exception 'plan_range';end if;
 return jsonb_build_object('today',(now() at time zone tz)::date,'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',r.id,'child_id',r.child_id,'revision',r.revision,
  'content',r.content||jsonb_build_object('source_id',r.source_id),
  'updated_at',r.updated_at,'done_at',r.done_at,
  'source',case when gina.is_parent() and s.id is not null then jsonb_build_object('id',s.id,'name',s.name,'mime',s.mime) else null end
 ) order by r.content->>'planned_on',r.id)
 from gina.learning_plan r left join public.learning_sources s on s.id=r.source_id and s.status='ready' and s.family_id=gina.family_id()
 where r.child_id=p_child_id and (r.content->>'planned_on')::date<=p_to and
  ((not (r.content->>'done')::boolean and not (r.content->>'archived')::boolean)
    or (r.content->>'planned_on')::date>=p_from or (r.content->>'due_on')::date>=p_from
    or (r.done_at at time zone tz)::date between p_from and p_to
    or ((r.content->>'archived')::boolean and (r.updated_at at time zone tz)::date between p_from and p_to))),'[]'));
end;$$;
create function public.save_learning_plan(p_request_id uuid,p_child_id uuid,p_id uuid,p_revision integer,p_content jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text:=gina.learning_plan_access(p_child_id);today date:=(now() at time zone tz)::date;
 payload jsonb;result jsonb;old gina.learning_plan;step jsonb;source uuid;start_day date;due_day date;begin
 if p_id is null or p_revision is null or p_revision<0 or p_content is null or jsonb_typeof(p_content)<>'object' then raise exception 'plan_invalid';end if;
 if octet_length(p_content::text)>10000 or not(p_content ?& array['kind','title','subject','topic','planned_on','due_on','time','steps','done','archived','source_id'])
 or p_content-array['kind','title','subject','topic','planned_on','due_on','time','steps','done','archived','source_id']<>'{}' then raise exception 'plan_invalid';end if;
 if p_content->>'kind' not in ('homework','study','course') or jsonb_typeof(p_content->'kind')<>'string'
 or jsonb_typeof(p_content->'title')<>'string' or length(trim(p_content->>'title')) not between 1 and 120
 or trim(p_content->>'title')<>p_content->>'title'
 or jsonb_typeof(p_content->'subject')<>'string' or length(p_content->>'subject')>80 or trim(p_content->>'subject')<>p_content->>'subject'
 or jsonb_typeof(p_content->'topic')<>'string' or length(p_content->>'topic')>200 or trim(p_content->>'topic')<>p_content->>'topic'
 or jsonb_typeof(p_content->'done')<>'boolean' or jsonb_typeof(p_content->'archived')<>'boolean'
 or jsonb_typeof(p_content->'planned_on')<>'string' or p_content->>'planned_on'!~ '^\d{4}-\d{2}-\d{2}$'
 or (p_content->'due_on'<>'null' and (jsonb_typeof(p_content->'due_on')<>'string' or p_content->>'due_on'!~ '^\d{4}-\d{2}-\d{2}$'))
 or (p_content->'time'<>'null' and (jsonb_typeof(p_content->'time')<>'string' or p_content->>'time'!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
 or (p_content->'source_id'<>'null' and (jsonb_typeof(p_content->'source_id')<>'string' or p_content->>'source_id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 or jsonb_typeof(p_content->'steps')<>'array' then raise exception 'plan_invalid';end if;
 start_day:=(p_content->>'planned_on')::date;due_day:=(p_content->>'due_on')::date;source:=(p_content->>'source_id')::uuid;
 if not isfinite(start_day) or (due_day is not null and (not isfinite(due_day) or due_day<start_day)) then raise exception 'plan_invalid';end if;
 if jsonb_array_length(p_content->'steps')>12 then raise exception 'plan_invalid';end if;
 for step in select * from jsonb_array_elements(p_content->'steps') loop
  if jsonb_typeof(step)<>'object' or not(step ?& array['id','label','checked']) or step-array['id','label','checked']<>'{}'
  or jsonb_typeof(step->'id')<>'string' or step->>'id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(step->'label')<>'string' or length(trim(step->>'label')) not between 1 and 120 or trim(step->>'label')<>step->>'label'
  or jsonb_typeof(step->'checked')<>'boolean' then raise exception 'plan_invalid';end if;
 end loop;
 if (select count(distinct s->>'id') from jsonb_array_elements(p_content->'steps')s)<>jsonb_array_length(p_content->'steps') then raise exception 'plan_invalid';end if;
 payload:=jsonb_build_object('action','learning.plan','child',p_child_id,'id',p_id,'revision',p_revision,'content',p_content);
 -- Reauthorize before recovering a receipt. Parent and active device never cross families.
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id and family_id=gina.family_id() for update;
 if not found then raise exception 'plan_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,89));
 select * into old from gina.learning_plan where id=p_id for update;
 if old.id is not null and old.child_id<>p_child_id then raise exception 'plan_forbidden' using errcode='42501';end if;
 if coalesce(old.revision,0)<>p_revision then raise exception 'plan_changed';end if;
 if not gina.is_parent() then
  if old.id is null or (old.content->>'archived')::boolean or
   p_content-array['steps','done','source_id']<>old.content-array['steps','done','source_id'] or source is distinct from old.source_id
   or (select coalesce(jsonb_agg(s-'checked' order by ord),'[]') from jsonb_array_elements(p_content->'steps') with ordinality a(s,ord))
      <>(select coalesce(jsonb_agg(s-'checked' order by ord),'[]') from jsonb_array_elements(old.content->'steps') with ordinality a(s,ord))
  then raise exception 'plan_parent_required' using errcode='42501';end if;
 end if;
 -- Old unfinished work remains editable. Only newly selected dates are bounded.
 if (old.id is null or old.content->>'planned_on'<>p_content->>'planned_on') and (start_day<today-30 or start_day>today+365) then raise exception 'plan_date';end if;
 if due_day is not null and (old.id is null or old.content->>'due_on' is distinct from p_content->>'due_on') and due_day>today+365 then raise exception 'plan_date';end if;
 if old.id is null and (p_content->>'done')::boolean then raise exception 'plan_invalid';end if;
 if old.id is null and (p_content->>'archived')::boolean then raise exception 'plan_invalid';end if;
 if (old.id is null or ((old.content->>'done')::boolean or (old.content->>'archived')::boolean)) and not (p_content->>'done')::boolean and not (p_content->>'archived')::boolean
 and (select count(*) from gina.learning_plan where child_id=p_child_id and not (content->>'done')::boolean and not (content->>'archived')::boolean)>=100 then raise exception 'plan_limit';end if;
 if source is not null and source is distinct from old.source_id then
  perform 1 from public.learning_sources where id=source and family_id=gina.family_id() and kind='document' and status='ready' for update;
  if not found then raise exception 'source_not_ready';end if;
 end if;
 insert into gina.learning_plan(id,child_id,revision,content,source_id,done_at,updated_by)
 values(p_id,p_child_id,p_revision+1,p_content-'source_id',source,
  case when (p_content->>'done')::boolean then coalesce(old.done_at,now()) else null end,auth.uid())
 on conflict(id) do update set revision=excluded.revision,content=excluded.content,source_id=excluded.source_id,done_at=excluded.done_at,updated_by=excluded.updated_by,updated_at=now();
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;
revoke all on function public.get_learning_plan(uuid,date,date),public.save_learning_plan(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.get_learning_plan(uuid,date,date),public.save_learning_plan(uuid,uuid,uuid,integer,jsonb) to authenticated;
create function public.get_learning_plan_item(p_child_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.learning_plan_access(p_child_id);
 return (select jsonb_build_object('id',r.id,'child_id',r.child_id,'revision',r.revision,
 'content',r.content||jsonb_build_object('source_id',r.source_id),'updated_at',r.updated_at,'done_at',r.done_at,
 'source',case when gina.is_parent() and s.id is not null then jsonb_build_object('id',s.id,'name',s.name,'mime',s.mime) else null end)
 from gina.learning_plan r left join public.learning_sources s on s.id=r.source_id and s.status='ready' and s.family_id=gina.family_id()
 where r.id=p_id and r.child_id=p_child_id);
end;$$;
revoke all on function public.get_learning_plan_item(uuid,uuid) from public,anon,service_role;
grant execute on function public.get_learning_plan_item(uuid,uuid) to authenticated;
