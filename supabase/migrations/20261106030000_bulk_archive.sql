-- L02: bulk archive/restore on the server. Single-record rules are reused by
-- calling the existing RPCs per item; every item reports ok or skipped+reason.
-- Nothing here deletes: reports, submissions, stars and answers are untouched.

-- History rows record how a change was made. Existing rows were single edits.
alter table gina.reward_changes add column origin text not null default 'single' check(origin in('single','bulk'));
alter table gina.note_changes add column origin text not null default 'single' check(origin in('single','bulk'));
alter table gina.task_routine_changes add column origin text not null default 'single' check(origin in('single','bulk'));
create function gina.change_origin() returns text language sql stable set search_path='' as $$
 select case when current_setting('gina.change_origin',true)='bulk' then 'bulk' else 'single' end
$$;
revoke all on function gina.change_origin() from public,anon,authenticated,service_role;

create or replace function gina.reward_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 insert into gina.reward_changes(reward_id,family_id,revision,action,before_value,after_value,actor,origin)
 values(new.id,new.family_id,new.revision,
 case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end,
 case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid(),gina.change_origin());
 insert into public.reward_catalog_sync(family_id) values(new.family_id) on conflict(family_id) do update set revision=public.reward_catalog_sync.revision+1;
 return new;
end;$$;
create or replace function gina.task_routine_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,origin)
 values(new.id,new.family_id,new.revision,
 case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end,
 case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid(),gina.change_origin());
 insert into public.task_routine_sync(child_id,family_id) values(new.child_id,new.family_id) on conflict(child_id) do update set revision=public.task_routine_sync.revision+1;
 return new;
end;$$;
create or replace function gina.note_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare fam uuid;owner_id uuid;shared boolean;
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 if TG_OP='DELETE' then fam:=old.family_id;owner_id:=old.author_user_id;shared:=old.visibility<>'private';
 else
  fam:=new.family_id;owner_id:=new.author_user_id;shared:=new.visibility<>'private' or (TG_OP='UPDATE' and old.visibility<>'private');
  insert into gina.note_changes(note_id,family_id,revision,action,before_value,after_value,actor,origin)
  values(new.id,new.family_id,new.revision,case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' else 'save' end,case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid(),gina.change_origin());
 end if;
 insert into public.note_sync(family_id,user_id) select m.family_id,m.user_id from public.family_members m join public.families ff on ff.id=m.family_id join auth.users u on u.id=m.user_id where m.family_id=fam and (shared or m.user_id=owner_id)
 on conflict(family_id,user_id) do update set revision=public.note_sync.revision+1;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;

-- Calendar entries get a recoverable archive. Children never see archived entries;
-- a single occurrence of a series is hidden through the existing exception table.
alter table public.events add column archived_at timestamptz;
create index events_archived_idx on public.events(family_id,archived_at) where archived_at is not null;
drop policy events_device_select on public.events;
create policy events_device_select on public.events for select to authenticated
 using(family_id=gina.family_id() and gina.is_device() and visible_to_child and archived_at is null and (child_id is null or child_id=gina.child_id()));

-- One run per idempotency key; items keep the per-record outcome and the snapshot
-- needed to restore list-type records (school bag) that have no history table.
create table gina.bulk_archive_runs (
 id uuid primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 actor uuid references auth.users(id) on delete set null,
 operation text not null check(operation in('archive','restore')),
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
create table gina.bulk_archive_items (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references gina.bulk_archive_runs(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 operation text not null,
 item_type text not null,
 item_key jsonb not null,
 status text not null check(status in('ok','skipped')),
 reason text,
 before_value jsonb,
 after_value jsonb,
 created_at timestamptz not null default now()
);
create index bulk_archive_items_key on gina.bulk_archive_items(family_id,item_type,item_key,created_at desc);
revoke all on gina.bulk_archive_runs,gina.bulk_archive_items from public,anon,authenticated,service_role;

create function gina.bulk_item_result(p_type text,p_key jsonb,p_status text,p_reason text,p_extra jsonb default '{}') returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('type',p_type,'key',p_key,'status',p_status,'reason',p_reason)||coalesce(p_extra,'{}')
$$;
revoke all on function gina.bulk_item_result(text,jsonb,text,text,jsonb) from public,anon,authenticated,service_role;

-- Blocking reasons are computed once, shared by preview and apply. Null = archivable.
create function gina.bulk_archive_block(p_type text,p_id uuid,p_family uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare ch uuid;
begin
 if p_type='reward' then
  if not exists(select 1 from public.family_rewards where id=p_id and family_id=p_family) then return 'not_found';end if;
  if exists(select 1 from public.family_rewards where id=p_id and archived_at is not null) then return 'already_archived';end if;
  if exists(select 1 from public.child_goals where reward_id=p_id and status='active') then return 'reward_has_goals';end if;
  if exists(select 1 from public.reward_requests where reward_id=p_id and status='requested') then return 'reward_pending_request';end if;
  return null;
 elsif p_type='task_routine' then
  select child_id into ch from public.task_templates where id=p_id and family_id=p_family;
  if ch is null then return 'not_found';end if;
  if exists(select 1 from public.children where id=ch and archived_at is not null) then return 'child_archived';end if;
  if exists(select 1 from public.task_templates where id=p_id and archived_at is not null) then return 'already_archived';end if;
  if exists(select 1 from public.task_completions where template_id=p_id and status='done') then return 'task_pending_review';end if;
  return null;
 elsif p_type='note' then
  if not exists(select 1 from public.notes where id=p_id and family_id=p_family) then return 'not_found';end if;
  if not exists(select 1 from public.notes where id=p_id and author_user_id=auth.uid()) then return 'note_not_author';end if;
  select child_id into ch from public.notes where id=p_id;
  if ch is not null and exists(select 1 from public.children where id=ch and archived_at is not null) then return 'child_archived';end if;
  if exists(select 1 from public.notes where id=p_id and archived_at is not null) then return 'already_archived';end if;
  return null;
 elsif p_type='prova_draft' then
  if not exists(select 1 from public.prova_drafts where id=p_id and family_id=p_family) then return 'not_found';end if;
  if exists(select 1 from public.prova_drafts d where d.id=p_id and d.exam_id is not null and exists(select 1 from public.exam_attempts a where a.exam_id=d.exam_id)) then return 'prova_has_answers';end if;
  if exists(select 1 from public.prova_drafts where id=p_id and (exam_id is not null or submitted_at is not null)) then return 'prova_draft_assigned';end if;
  select (content->>'childId')::uuid into ch from public.prova_drafts where id=p_id and content->>'childId' ~ '^[0-9a-f-]{36}$';
  if ch is not null and exists(select 1 from public.children where id=ch and archived_at is not null) then return 'child_archived';end if;
  if exists(select 1 from public.prova_drafts where id=p_id and discarded_at is not null) then return 'already_archived';end if;
  return null;
 elsif p_type='learning_plan' then
  select r.child_id into ch from gina.learning_plan r join public.children c on c.id=r.child_id where r.id=p_id and c.family_id=p_family;
  if ch is null then return 'not_found';end if;
  if exists(select 1 from public.children where id=ch and archived_at is not null) then return 'child_archived';end if;
  if exists(select 1 from gina.learning_plan where id=p_id and (content->>'archived')::boolean) then return 'already_archived';end if;
  return null;
 elsif p_type='event' then
  if not exists(select 1 from public.events where id=p_id and family_id=p_family) then return 'not_found';end if;
  if exists(select 1 from public.events where id=p_id and timetable_entry_key is not null) then return 'event_is_timetable';end if;
  select child_id into ch from public.events where id=p_id;
  if ch is not null and exists(select 1 from public.children where id=ch and archived_at is not null) then return 'child_archived';end if;
  if exists(select 1 from public.events where id=p_id and archived_at is not null) then return 'already_archived';end if;
  return null;
 end if;
 return 'type_invalid';
end;$$;
revoke all on function gina.bulk_archive_block(text,uuid,uuid) from public,anon,authenticated,service_role;

-- Scope: {"types":[...],"child_id","period_id","from","to","status","event_scope","bag_mode","archived"}
-- Lists only this family's records; a record of another family is never returned.
create function public.bulk_archive_preview(p_scope jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();tz text;today date;types text[];ch uuid;period gina.child_education_periods;d_from date;d_to date;
 status text;event_scope text;bag_mode text;want_archived boolean;items jsonb:='[]';row_count int;truncated boolean:=false;k text;
begin
 if not coalesce(gina.is_parent(),false) or f is null or auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_scope is null or jsonb_typeof(p_scope)<>'object' or jsonb_typeof(p_scope->'types')<>'array' or jsonb_array_length(p_scope->'types')=0 then raise exception 'scope_invalid';end if;
 for k in select jsonb_object_keys(p_scope) loop
  if k not in('types','child_id','period_id','from','to','status','event_scope','bag_mode','archived') then raise exception 'scope_invalid';end if;
 end loop;
 select array_agg(distinct t) into types from jsonb_array_elements_text(p_scope->'types') t;
 if not(types <@ array['task_routine','reward','note','prova_draft','learning_plan','event','school_bag']) then raise exception 'scope_invalid';end if;
 select timezone into tz from public.families where id=f;today:=(now() at time zone tz)::date;
 begin
  ch:=(p_scope->>'child_id')::uuid;d_from:=(p_scope->>'from')::date;d_to:=(p_scope->>'to')::date;
 exception when others then raise exception 'scope_invalid';end;
 status:=coalesce(p_scope->>'status','all');event_scope:=coalesce(p_scope->>'event_scope','series');bag_mode:=coalesce(p_scope->>'bag_mode','reset_checks');
 want_archived:=coalesce((p_scope->>'archived')::boolean,false);
 if status not in('all','active','paused') or event_scope not in('series','occurrence') or bag_mode not in('reset_checks','clear_day') then raise exception 'scope_invalid';end if;
 if ch is not null and not exists(select 1 from public.children where id=ch and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
 if p_scope->>'period_id' is not null then
  select * into period from gina.child_education_periods where id=(p_scope->>'period_id')::uuid and family_id=f and (ch is null or child_id=ch);
  if not found then raise exception 'forbidden' using errcode='42501';end if;
  ch:=period.child_id;d_from:=coalesce(d_from,period.starts_on);d_to:=coalesce(d_to,period.ends_on);
 end if;
 if (d_from is not null and not isfinite(d_from)) or (d_to is not null and not isfinite(d_to)) or (d_from is not null and d_to is not null and d_to<d_from) then raise exception 'scope_invalid';end if;
 if event_scope='occurrence' and (d_from is null or d_to is null or d_from<>d_to) then raise exception 'scope_invalid';end if;
 if 'school_bag'=any(types) and (ch is null or d_from is null or d_to is null or d_to-d_from>31) then raise exception 'scope_invalid';end if;

 if 'task_routine'=any(types) then
  select coalesce(jsonb_agg(x order by x->>'title',x->>'id'),'[]'),count(*) into items,row_count from(
   select jsonb_build_object('type','task_routine','id',t.id,'key',jsonb_build_object('id',t.id),'title',t.title,'child_id',t.child_id,'revision',t.revision,'active',t.active,
    'archived',t.archived_at is not null,'blocked',case when want_archived then null else gina.bulk_archive_block('task_routine',t.id,f) end) x
   from public.task_templates t where t.family_id=f and (ch is null or t.child_id=ch) and (t.archived_at is not null)=want_archived
   and (status='all' or t.archived_at is not null or t.active=(status='active'))
   and (d_from is null or coalesce(t.starts_on,(t.created_at at time zone tz)::date)>=d_from) and (d_to is null or coalesce(t.starts_on,(t.created_at at time zone tz)::date)<=d_to) limit 301) s;
  truncated:=truncated or row_count>300;
 end if;
 if 'reward'=any(types) and ch is null then
  items:=items||(select coalesce(jsonb_agg(x order by x->>'title',x->>'id'),'[]') from(
   select jsonb_build_object('type','reward','id',r.id,'key',jsonb_build_object('id',r.id),'title',r.title,'child_id',null,'revision',r.revision,'active',r.active,
    'archived',r.archived_at is not null,'blocked',case when want_archived then null else gina.bulk_archive_block('reward',r.id,f) end,
    'pending_requests',(select count(*) from public.reward_requests q where q.reward_id=r.id and q.status='requested'),
    'active_goals',(select count(*) from public.child_goals g where g.reward_id=r.id and g.status='active')) x
   from public.family_rewards r where r.family_id=f and (r.archived_at is not null)=want_archived and (status='all' or r.archived_at is not null or r.active=(status='active'))
   and (d_from is null or (r.created_at at time zone tz)::date>=d_from) and (d_to is null or (r.created_at at time zone tz)::date<=d_to) limit 300) s);
 end if;
 if 'note'=any(types) then
  -- Only the author's own notes are listed; a co-parent's note is never a bulk candidate.
  items:=items||(select coalesce(jsonb_agg(x order by x->>'updated_at' desc,x->>'id'),'[]') from(
   select jsonb_build_object('type','note','id',n.id,'key',jsonb_build_object('id',n.id),'title',coalesce(n.title,left(n.body,60)),'child_id',n.child_id,'revision',n.revision,'visibility',n.visibility,'updated_at',n.updated_at,
    'archived',n.archived_at is not null,'blocked',case when want_archived then null else gina.bulk_archive_block('note',n.id,f) end) x
   from public.notes n where n.family_id=f and n.author_user_id=auth.uid() and (ch is null or n.child_id=ch) and (n.archived_at is not null)=want_archived
   and (d_from is null or (n.updated_at at time zone tz)::date>=d_from) and (d_to is null or (n.updated_at at time zone tz)::date<=d_to) limit 300) s);
 end if;
 if 'prova_draft'=any(types) then
  items:=items||(select coalesce(jsonb_agg(x order by x->>'updated_at' desc,x->>'id'),'[]') from(
   select jsonb_build_object('type','prova_draft','id',d.id,'key',jsonb_build_object('id',d.id),'title',d.content->>'title','child_id',nullif(d.content->>'childId','')::uuid,'revision',d.version,'updated_at',d.updated_at,
    'assigned',d.exam_id is not null or d.submitted_at is not null,'archived',d.discarded_at is not null,'blocked',case when want_archived then null else gina.bulk_archive_block('prova_draft',d.id,f) end) x
   from public.prova_drafts d where d.family_id=f and (ch is null or d.content->>'childId'=ch::text) and (d.discarded_at is not null)=want_archived
   and (d_from is null or (d.updated_at at time zone tz)::date>=d_from) and (d_to is null or (d.updated_at at time zone tz)::date<=d_to) limit 300) s);
 end if;
 if 'learning_plan'=any(types) then
  items:=items||(select coalesce(jsonb_agg(x order by x->>'planned_on',x->>'id'),'[]') from(
   select jsonb_build_object('type','learning_plan','id',r.id,'key',jsonb_build_object('id',r.id),'title',r.content->>'title','child_id',r.child_id,'revision',r.revision,'planned_on',r.content->>'planned_on','done',(r.content->>'done')::boolean,
    'archived',(r.content->>'archived')::boolean,'blocked',case when want_archived then null else gina.bulk_archive_block('learning_plan',r.id,f) end) x
   from gina.learning_plan r join public.children c on c.id=r.child_id where c.family_id=f and (ch is null or r.child_id=ch) and (r.content->>'archived')::boolean=want_archived
   and (d_from is null or (r.content->>'planned_on')::date>=d_from) and (d_to is null or (r.content->>'planned_on')::date<=d_to) limit 300) s);
 end if;
 if 'event'=any(types) then
  -- One-off entries by date; a series is offered whole unless a single day is chosen.
  -- Series membership in a range is approximated by its start date (no RRULE expansion here).
  items:=items||(select coalesce(jsonb_agg(x order by x->>'starts_at',x->>'id'),'[]') from(
   select jsonb_build_object('type','event','id',e.id,'key',case when e.rrule is not null and event_scope='occurrence' then jsonb_build_object('id',e.id,'occurrence_date',d_from) else jsonb_build_object('id',e.id) end,
    'title',e.title,'child_id',e.child_id,'revision',e.edit_revision,'starts_at',e.starts_at,'series',e.rrule is not null,
    'scope',case when e.rrule is not null and event_scope='occurrence' then 'occurrence' when e.rrule is not null then 'series' else 'single' end,
    'archived',e.archived_at is not null,
    'blocked',case when want_archived then null when e.rrule is not null and event_scope='occurrence' and exists(select 1 from public.event_exceptions ex where ex.event_id=e.id and ex.occurrence_date=d_from and ex.cancelled) then 'already_archived' else gina.bulk_archive_block('event',e.id,f) end) x
   from public.events e where e.family_id=f and e.timetable_entry_key is null and (ch is null or e.child_id=ch) and (e.archived_at is not null)=want_archived
   and (d_from is null or e.rrule is not null or (e.starts_at at time zone tz)::date>=d_from) and (d_to is null or (e.starts_at at time zone tz)::date<=d_to)
   and (event_scope='series' or e.rrule is null or (e.starts_at at time zone tz)::date<=d_from) limit 300) s);
 end if;
 if 'school_bag'=any(types) and not want_archived then
  items:=items||(select coalesce(jsonb_agg(x order by x->>'day'),'[]') from(
   select jsonb_build_object('type','school_bag','id',null,'key',jsonb_build_object('child_id',b.child_id,'day',b.day,'mode',bag_mode),'title',b.day::text,'child_id',b.child_id,'revision',b.revision,
    'program_revision',coalesce((select t.revision from public.school_timetables t where t.child_id=b.child_id),0),'day',b.day,'mode',bag_mode,
    'item_count',jsonb_array_length(b.items),'checked_count',(select count(*) from jsonb_array_elements(b.items) i where (i->>'checked')::boolean),'archived',false,
    'blocked',case when exists(select 1 from public.children where id=b.child_id and archived_at is not null) then 'child_archived' when b.day<today then 'bag_day_past'
     when bag_mode='clear_day' and jsonb_array_length(b.items)=0 then 'nothing_to_change'
     when bag_mode='reset_checks' and not exists(select 1 from jsonb_array_elements(b.items) i where (i->>'checked')::boolean) then 'nothing_to_change' else null end) x
   from gina.school_bags b where b.child_id=ch and b.day between d_from and d_to limit 300) s);
 end if;
 return jsonb_build_object('family_id',f,'today',today,'generated_at',now(),'scope',p_scope||jsonb_build_object('child_id',ch,'from',d_from,'to',d_to,'status',status,'event_scope',event_scope,'bag_mode',bag_mode,'archived',want_archived),
  'truncated',truncated or jsonb_array_length(items)>=300,'items',items,
  'summary',jsonb_build_object('total',jsonb_array_length(items),
   'archivable',(select count(*) from jsonb_array_elements(items) i where i->'blocked'='null'::jsonb),
   'blocked',(select count(*) from jsonb_array_elements(items) i where i->'blocked'<>'null'::jsonb),
   'by_type',coalesce((select jsonb_object_agg(t,c) from(select i->>'type' t,count(*) c from jsonb_array_elements(items) i group by 1)g),'{}'),
   'blocked_reasons',coalesce((select jsonb_object_agg(r,c) from(select i->>'blocked' r,count(*) c from jsonb_array_elements(items) i where i->'blocked'<>'null'::jsonb group by 1)g),'{}')));
end;$$;

-- Shared item loop. Each item runs in its own subtransaction: one failure never
-- rolls back its neighbours, and the response names what happened to each record.
create function gina.bulk_archive_run(p_operation text,p_items jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();run gina.bulk_archive_runs;h text;item jsonb;n int:=0;t text;v_id uuid;v_rev int;req uuid;key jsonb;blk text;
 outcome jsonb;results jsonb:='[]';before jsonb;after jsonb;r jsonb;v_ch uuid;v_day date;mode text;occ date;content jsonb;new_items jsonb;prog int;e public.events;rec record;bag gina.school_bags;
begin
 if not coalesce(gina.is_parent(),false) or f is null or auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_key is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'bulk_invalid';end if;
 h:=encode(extensions.digest(p_operation||':'||p_items::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('bulk-archive:'||p_key::text,0));
 select * into run from gina.bulk_archive_runs where id=p_key;
 if found then
  if run.family_id<>f or run.actor is distinct from auth.uid() or run.operation<>p_operation or run.payload_hash<>h then raise exception 'request_conflict';end if;
  return run.result;
 end if;
 insert into gina.bulk_archive_runs(id,family_id,actor,operation,payload_hash,result) values(p_key,f,auth.uid(),p_operation,h,'{}');
 perform set_config('gina.change_origin','bulk',true);
 for item in select * from jsonb_array_elements(p_items) loop
  n:=n+1;before:=null;after:=null;outcome:=null;key:=null;r:=null;
  t:=case when jsonb_typeof(item)='object' then item->>'type' end;req:=md5(p_key::text||':'||p_operation||':'||n::text)::uuid;
  if t is null then outcome:=gina.bulk_item_result('?',coalesce(item,'null'),'skipped','item_invalid');
  else
   begin
    v_id:=nullif(item->>'id','')::uuid;v_rev:=(item->>'revision')::int;v_ch:=nullif(item->>'child_id','')::uuid;v_day:=(item->>'day')::date;occ:=(item->>'occurrence_date')::date;mode:=item->>'mode';
    key:=case when t='school_bag' then jsonb_build_object('child_id',v_ch,'day',v_day,'mode',mode) when t='event' and occ is not null then jsonb_build_object('id',v_id,'occurrence_date',occ) else jsonb_build_object('id',v_id) end;
    if t not in('task_routine','reward','note','prova_draft','learning_plan','event','school_bag') then raise exception 'type_invalid';end if;
    if t<>'school_bag' and v_id is null then raise exception 'item_invalid';end if;
    if p_operation='archive' then
     if t='reward' then
      -- Lock before judging: a request/submission committing meanwhile must be seen.
      perform 1 from public.family_rewards where id=v_id and family_id=f for update;
      blk:=gina.bulk_archive_block('reward',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select to_jsonb(x) into before from public.family_rewards x where x.id=v_id;
      r:=public.change_reward(req,v_id,v_rev,'archive','{}');
     elsif t='task_routine' then
      perform 1 from public.task_templates where id=v_id and family_id=f for update;
      blk:=gina.bulk_archive_block('task_routine',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select to_jsonb(x) into before from public.task_templates x where x.id=v_id;
      r:=public.change_task_routine(req,v_id,v_rev,'archive','{}');
     elsif t='note' then
      perform 1 from public.notes where id=v_id and family_id=f for update;
      blk:=gina.bulk_archive_block('note',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select to_jsonb(x) into before from public.notes x where x.id=v_id;
      r:=public.save_parent_note(req,v_id,v_rev,'archive',(before->>'child_id')::uuid,'{}');
     elsif t='prova_draft' then
      perform 1 from public.prova_drafts where id=v_id and family_id=f for update;
      blk:=gina.bulk_archive_block('prova_draft',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select jsonb_build_object('id',x.id,'version',x.version,'title',x.content->>'title') into before from public.prova_drafts x where x.id=v_id;
      r:=public.set_prova_draft_discarded(req,v_id,v_rev,true);
     elsif t='learning_plan' then
      perform 1 from gina.learning_plan x join public.children c on c.id=x.child_id where x.id=v_id and c.family_id=f for update of x;
      blk:=gina.bulk_archive_block('learning_plan',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select to_jsonb(x) into before from gina.learning_plan x where x.id=v_id;
      content:=(before->'content')||jsonb_build_object('archived',true,'source_id',before->'source_id');
      r:=public.save_learning_plan(req,(before->>'child_id')::uuid,v_id,v_rev,content);
     elsif t='event' then
      blk:=gina.bulk_archive_block('event',v_id,f);if blk is not null then raise exception '%',blk;end if;
      select * into e from public.events where id=v_id and family_id=f for update;
      if v_rev is not null and e.edit_revision<>v_rev then raise exception 'changed';end if;
      before:=to_jsonb(e);
      if occ is not null then
       if e.rrule is null then raise exception 'event_not_recurring';end if;
       if exists(select 1 from public.event_exceptions where event_id=e.id and occurrence_date=occ and cancelled) then raise exception 'already_archived';end if;
       insert into public.event_exceptions(event_id,occurrence_date,cancelled) values(e.id,occ,true) on conflict(event_id,occurrence_date) do update set cancelled=true;
       r:=jsonb_build_object('id',e.id,'occurrence_date',occ,'revision',e.edit_revision);
      else
       update public.events set archived_at=now() where id=e.id returning to_jsonb(events.*) into after;
       r:=jsonb_build_object('id',e.id,'revision',after->'edit_revision','archived_at',after->'archived_at');
      end if;
     elsif t='school_bag' then
      if v_ch is null or v_day is null or mode is null or mode not in('reset_checks','clear_day') then raise exception 'item_invalid';end if;
      if not exists(select 1 from public.children where id=v_ch and family_id=f) then raise exception 'not_found';end if;
      select * into bag from gina.school_bags where child_id=v_ch and day=v_day for update;
      if not found then raise exception 'nothing_to_change';end if;
      before:=to_jsonb(bag);
      new_items:=case when mode='clear_day' then '[]'::jsonb else (select coalesce(jsonb_agg(i||'{"checked":false}'),'[]') from jsonb_array_elements(bag.items) i) end;
      if new_items=bag.items then raise exception 'nothing_to_change';end if;
      prog:=coalesce((select x.revision from public.school_timetables x where x.child_id=v_ch),0);
      if item ? 'program_revision' and (item->>'program_revision')::int<>prog then raise exception 'changed';end if;
      r:=public.save_school_bag(req,v_ch,v_day,coalesce(v_rev,bag.revision),prog,new_items);
     end if;
    else
     if t='reward' then
      if not exists(select 1 from public.family_rewards where id=v_id and family_id=f) then raise exception 'not_found';end if;
      if exists(select 1 from public.family_rewards where id=v_id and archived_at is null) then raise exception 'not_archived';end if;
      select to_jsonb(x) into before from public.family_rewards x where x.id=v_id;
      r:=public.change_reward(req,v_id,v_rev,'restore','{}');
     elsif t='task_routine' then
      if not exists(select 1 from public.task_templates where id=v_id and family_id=f) then raise exception 'not_found';end if;
      if exists(select 1 from public.task_templates where id=v_id and archived_at is null) then raise exception 'not_archived';end if;
      select to_jsonb(x) into before from public.task_templates x where x.id=v_id;
      r:=public.change_task_routine(req,v_id,v_rev,'restore','{}');
     elsif t='note' then
      if not exists(select 1 from public.notes where id=v_id and family_id=f) then raise exception 'not_found';end if;
      if not exists(select 1 from public.notes where id=v_id and author_user_id=auth.uid()) then raise exception 'note_not_author';end if;
      if exists(select 1 from public.notes where id=v_id and archived_at is null) then raise exception 'not_archived';end if;
      select to_jsonb(x) into before from public.notes x where x.id=v_id;
      r:=public.save_parent_note(req,v_id,v_rev,'restore',(before->>'child_id')::uuid,'{}');
     elsif t='prova_draft' then
      if not exists(select 1 from public.prova_drafts where id=v_id and family_id=f) then raise exception 'not_found';end if;
      if exists(select 1 from public.prova_drafts where id=v_id and discarded_at is null) then raise exception 'not_archived';end if;
      select jsonb_build_object('id',x.id,'version',x.version,'title',x.content->>'title') into before from public.prova_drafts x where x.id=v_id;
      r:=public.set_prova_draft_discarded(req,v_id,v_rev,false);
     elsif t='learning_plan' then
      select to_jsonb(x) into before from gina.learning_plan x join public.children c on c.id=x.child_id where x.id=v_id and c.family_id=f;
      if before is null then raise exception 'not_found';end if;
      if not (before->'content'->>'archived')::boolean then raise exception 'not_archived';end if;
      content:=(before->'content')||jsonb_build_object('archived',false,'source_id',before->'source_id');
      r:=public.save_learning_plan(req,(before->>'child_id')::uuid,v_id,v_rev,content);
     elsif t='event' then
      select * into e from public.events where id=v_id and family_id=f for update;
      if not found then raise exception 'not_found';end if;
      if v_rev is not null and e.edit_revision<>v_rev then raise exception 'changed';end if;
      before:=to_jsonb(e);
      if occ is not null then
       -- Only an occurrence hidden by a bulk run is restored; a manual cancellation stays.
       if not exists(select 1 from public.event_exceptions where event_id=e.id and occurrence_date=occ and cancelled)
        or not exists(select 1 from gina.bulk_archive_items i where i.family_id=f and i.operation='archive' and i.status='ok' and i.item_type='event' and i.item_key=jsonb_build_object('id',e.id,'occurrence_date',occ)) then raise exception 'not_archived';end if;
       delete from public.event_exceptions where event_id=e.id and occurrence_date=occ;
       r:=jsonb_build_object('id',e.id,'occurrence_date',occ,'revision',e.edit_revision);
      else
       if e.archived_at is null then raise exception 'not_archived';end if;
       update public.events set archived_at=null where id=e.id returning to_jsonb(events.*) into after;
       r:=jsonb_build_object('id',e.id,'revision',after->'edit_revision','archived_at',null);
      end if;
     elsif t='school_bag' then
      if v_ch is null or v_day is null then raise exception 'item_invalid';end if;
      if not exists(select 1 from public.children where id=v_ch and family_id=f) then raise exception 'not_found';end if;
      select * into rec from gina.bulk_archive_items i where i.family_id=f and i.operation='archive' and i.status='ok' and i.item_type='school_bag'
       and i.item_key->>'child_id'=v_ch::text and i.item_key->>'day'=v_day::text order by i.created_at desc limit 1;
      if not found then raise exception 'not_archived';end if;
      select * into bag from gina.school_bags where child_id=v_ch and day=v_day for update;
      if not found or bag.revision<>(rec.after_value->>'revision')::int then raise exception 'changed';end if;
      before:=to_jsonb(bag);
      prog:=coalesce((select x.revision from public.school_timetables x where x.child_id=v_ch),0);
      r:=public.save_school_bag(req,v_ch,v_day,bag.revision,prog,rec.before_value->'items');
     end if;
    end if;
    outcome:=gina.bulk_item_result(t,key,'ok',null,jsonb_build_object('result',r));
   exception when others then
    outcome:=gina.bulk_item_result(t,coalesce(key,jsonb_build_object('id',item->>'id')),'skipped',
     case when SQLSTATE='42501' then 'not_found'
      when SQLERRM in('reward_changed','task_routine_changed','note_changed','prova_draft_changed','plan_changed','bag_changed','bag_program_changed','event_changed') then 'changed'
      when SQLERRM in('reward_archived','task_routine_archived','note_archived','prova_draft_removed') then 'already_archived'
      when SQLERRM='prova_draft_submitted' then 'prova_draft_assigned'
      when SQLERRM='bag_date' then 'bag_day_past'
      when SQLERRM in('prova_draft_not_found','bag_forbidden','plan_forbidden') then 'not_found'
      when SQLERRM ~ '^[a-z_]+$' then SQLERRM else 'failed' end);
   end;
  end if;
  insert into gina.bulk_archive_items(run_id,family_id,operation,item_type,item_key,status,reason,before_value,after_value)
  values(p_key,f,p_operation,outcome->>'type',outcome->'key',outcome->>'status',outcome->>'reason',before,case when outcome->>'status'='ok' then coalesce(after,outcome->'result') end);
  results:=results||jsonb_build_object('type',outcome->>'type','key',outcome->'key','status',outcome->>'status','reason',outcome->'reason','result',case when outcome->>'status'='ok' then outcome->'result' end);
 end loop;
 outcome:=jsonb_build_object('run_id',p_key,'operation',p_operation,'items',results,
  'summary',jsonb_build_object('ok',(select count(*) from jsonb_array_elements(results) i where i->>'status'='ok'),'skipped',(select count(*) from jsonb_array_elements(results) i where i->>'status'='skipped'),
   'reasons',coalesce((select jsonb_object_agg(rr,c) from(select i->>'reason' rr,count(*) c from jsonb_array_elements(results) i where i->>'status'='skipped' group by 1)g),'{}')));
 update gina.bulk_archive_runs set result=outcome where id=p_key;
 return outcome;
end;$$;
revoke all on function gina.bulk_archive_run(text,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.bulk_archive_apply(p_items jsonb,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin return gina.bulk_archive_run('archive',p_items,p_idempotency_key);end;$$;
create function public.bulk_restore_apply(p_items jsonb,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin return gina.bulk_archive_run('restore',p_items,p_idempotency_key);end;$$;
create function public.bulk_archive_history(p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(gina.is_parent(),false) or gina.family_id() is null then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('run_id',r.id,'operation',r.operation,'created_at',r.created_at,'mine',r.actor=auth.uid(),'summary',r.result->'summary') order by r.created_at desc)
  from(select * from gina.bulk_archive_runs where family_id=gina.family_id() and (p_before is null or created_at<p_before) order by created_at desc limit 20)r),'[]');
end;$$;
revoke all on function public.bulk_archive_preview(jsonb),public.bulk_archive_apply(jsonb,uuid),public.bulk_restore_apply(jsonb,uuid),public.bulk_archive_history(timestamptz) from public,anon,service_role;
grant execute on function public.bulk_archive_preview(jsonb),public.bulk_archive_apply(jsonb,uuid),public.bulk_restore_apply(jsonb,uuid),public.bulk_archive_history(timestamptz) to authenticated;
