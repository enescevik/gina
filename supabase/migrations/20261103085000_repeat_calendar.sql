-- Parent-reviewed reminders, never automatic exam assignment, grading or rewards.
create table gina.repeat_calendar_batches (
 id uuid primary key, attempt_id uuid not null unique references public.exam_attempts(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 question_ids uuid[] not null, source_hash text not null, created_at timestamptz not null default now()
);
create table gina.repeat_calendar_items (
 batch_id uuid not null references gina.repeat_calendar_batches(id) on delete cascade,
 step int not null check(step between 1 and 3), event_id uuid unique references public.events(id) on delete set null,
 primary key(batch_id,step)
);
alter table gina.repeat_calendar_batches enable row level security;
alter table gina.repeat_calendar_items enable row level security;
revoke all on gina.repeat_calendar_batches,gina.repeat_calendar_items from public,anon,authenticated,service_role;
create function gina.repeat_calendar_source(p_attempt uuid,p_family uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with source as (
 select a.id,a.child_id,a.status,a.finished_at,c.name,c.grade,f.timezone,e.question_ids
 from public.exam_attempts a join public.exams e on e.id=a.exam_id and e.family_id=a.family_id and e.child_id=a.child_id
 join public.children c on c.id=a.child_id and c.family_id=a.family_id join public.families f on f.id=a.family_id
 where a.id=p_attempt and a.family_id=p_family
 ), eligible as (
 select q.id,array_position(s.question_ids,q.id) position,q.stem,q.subject,q.topic,
 case when q.kind='multiple_choice' or ans.score=0 then 'wrong' else 'partial' end state,
 ans.edit_revision,ans.review_revision,ans.score,ans.graded_by
 from source s cross join lateral unnest(s.question_ids) qid
 join public.question_bank q on q.id=qid and (q.family_id=p_family or q.family_id is null) and q.grade=s.grade
 join public.exam_answers ans on ans.attempt_id=s.id and ans.question_id=q.id
 where s.status in('submitted','graded') and s.finished_at between now()-interval '90 days' and now()
 and ((q.kind='multiple_choice' and nullif(trim(ans.answer_key),'') is not null and ans.is_correct=false)
 or (q.kind='open_ended' and ans.graded_by='parent' and ans.score>=0 and ans.score<100))
 -- A newer completed observation supersedes this older attempt, including a blank answer.
 and not exists(select 1 from public.exam_attempts newer join public.exams ne on ne.id=newer.exam_id and ne.family_id=p_family
 where newer.family_id=p_family and newer.child_id=s.child_id and newer.status in('submitted','graded')
 and (newer.finished_at,newer.id)>(s.finished_at,s.id) and q.id=any(ne.question_ids))
 ), evidence as(select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]') qs from eligible x)
 select jsonb_build_object('attempt_id',s.id,'child_id',s.child_id,'child_name',s.name,'grade',s.grade,'timezone',s.timezone,'questions',e.qs,
 'hash',encode(extensions.digest(jsonb_build_object('attempt',s.id,'child',s.child_id,'grade',s.grade,'timezone',s.timezone,'questions',e.qs)::text,'sha256'),'hex')) from source s cross join evidence e;
$$;
revoke all on function gina.repeat_calendar_source(uuid,uuid) from public,anon,authenticated,service_role;
create function public.get_repeat_calendar(p_attempt_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();s jsonb;begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 s:=gina.repeat_calendar_source(p_attempt_id,f);if s is null then raise exception 'forbidden' using errcode='42501';end if;
 return s||jsonb_build_object('scheduled',(select case when b.id is null then null else jsonb_build_object('question_ids',b.question_ids,'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'position',array_position(e.question_ids,q.id),'stem',q.stem) order by array_position(e.question_ids,q.id)),'[]') from public.exam_attempts a join public.exams e on e.id=a.exam_id join public.question_bank q on q.id=any(b.question_ids) where a.id=b.attempt_id),'items',
 (select coalesce(jsonb_agg(jsonb_build_object('step',i.step,'event_id',i.event_id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at) order by i.step),'[]') from gina.repeat_calendar_items i left join public.events e on e.id=i.event_id where i.batch_id=b.id)) end from gina.repeat_calendar_batches b where b.attempt_id=p_attempt_id));
end;$$;
create function public.apply_repeat_calendar(p_request_id uuid,p_attempt_id uuid,p_source_hash text,p_question_ids uuid[],p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();a public.exam_attempts;s jsonb;payload jsonb;result jsonb;item jsonb;starts timestamptz;ends timestamptz;event uuid;tz text;ids uuid[];begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_attempt_id is null or p_source_hash is null or p_question_ids is null or coalesce(cardinality(p_question_ids),0) not between 1 and 100 or array_position(p_question_ids,null) is not null
 or (select count(distinct x) from unnest(p_question_ids)x)<>cardinality(p_question_ids)
 or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'invalid_input';end if;
 if jsonb_array_length(p_items) not between 1 and 3 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action','repeat.calendar','attempt',p_attempt_id,'hash',p_source_hash,'questions',p_question_ids,'items',p_items);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then
  if not exists(select 1 from public.exam_attempts where id=p_attempt_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
  return result;
 end if;
 perform 1 from public.families where id=f for key share;
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=f;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.children where id=a.child_id and family_id=f for share;
 perform 1 from public.exam_attempts where id=a.id for update;
 s:=gina.repeat_calendar_source(a.id,f);
 if s is null or s->>'hash'<>p_source_hash then raise exception 'repeat_changed';end if;
 if exists(select 1 from gina.repeat_calendar_batches where attempt_id=a.id) then raise exception 'repeat_applied';end if;
 select array_agg((q->>'id')::uuid) into ids from jsonb_array_elements(s->'questions')q;
 if ids is null or not(p_question_ids<@ids) then raise exception 'repeat_ineligible';end if;
 tz:=s->>'timezone';
 if (select count(distinct i->>'day') from jsonb_array_elements(p_items)i)<>jsonb_array_length(p_items) then raise exception 'invalid_input';end if;
 insert into gina.repeat_calendar_batches(id,attempt_id,family_id,child_id,question_ids,source_hash) values(p_request_id,a.id,f,a.child_id,p_question_ids,p_source_hash);
 result:='[]'::jsonb;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['day','title','notes','starts_at','minutes']) or item-array['day','title','notes','starts_at','minutes']<>'{}'::jsonb
   or jsonb_typeof(item->'day')<>'number' or item->>'day'!~ '^[1-3]$'
   or jsonb_typeof(item->'minutes')<>'number' or item->>'minutes'!~ '^[0-9]+$'
   or jsonb_typeof(item->'title')<>'string' or length(trim(item->>'title')) not between 1 and 120
   or jsonb_typeof(item->'notes')<>'string' or length(trim(item->>'notes')) not between 1 and 1200
   or jsonb_typeof(item->'starts_at')<>'string' then raise exception 'invalid_input';end if;
  if (item->>'minutes')::int not between 5 and 60 then raise exception 'invalid_input';end if;
  starts:=(item->>'starts_at')::timestamptz;
  if not isfinite(starts) or (starts at time zone tz)::date<(now() at time zone tz)::date or (starts at time zone tz)::date>(now() at time zone tz)::date+365 then raise exception 'invalid_input';end if;
  ends:=starts+make_interval(mins=>(item->>'minutes')::int);event:=gen_random_uuid();
  insert into public.events(id,family_id,child_id,title,type,starts_at,ends_at,notes,visible_to_child,created_by) values(event,f,a.child_id,trim(item->>'title'),'activity',starts,ends,trim(item->>'notes'),true,auth.uid());
  insert into gina.repeat_calendar_items(batch_id,step,event_id) values(p_request_id,(item->>'day')::int,event);
  result:=result||jsonb_build_array(jsonb_build_object('day',(item->>'day')::int,'event_id',event));
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items)x cross join jsonb_array_elements(p_items)y where (x->>'day')::int<(y->>'day')::int
 and (x->>'starts_at')::timestamptz<(y->>'starts_at')::timestamptz+make_interval(mins=>(y->>'minutes')::int)
 and (y->>'starts_at')::timestamptz<(x->>'starts_at')::timestamptz+make_interval(mins=>(x->>'minutes')::int)) then raise exception 'plan_overlap';end if;
 result:=jsonb_build_object('request',p_request_id,'attempt_id',a.id,'items',result);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;
revoke all on function public.get_repeat_calendar(uuid),public.apply_repeat_calendar(uuid,uuid,text,uuid[],jsonb) from public,anon,service_role;
grant execute on function public.get_repeat_calendar(uuid),public.apply_repeat_calendar(uuid,uuid,text,uuid[],jsonb) to authenticated;
-- Removing the source/child must not turn a private child's reminder into a family event.
create function gina.delete_repeat_calendar_events() returns trigger language plpgsql security definer set search_path='' as $$begin
 delete from public.events where id in(select event_id from gina.repeat_calendar_items where batch_id=old.id);return old;
end;$$;
revoke all on function gina.delete_repeat_calendar_events() from public,anon,authenticated,service_role;
create trigger repeat_calendar_cleanup before delete on gina.repeat_calendar_batches for each row execute function gina.delete_repeat_calendar_events();
create function public.get_repeat_calendar_event(p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not coalesce(gina.is_parent(),false) or gina.family_id() is null then raise exception 'forbidden' using errcode='42501';end if;
 return(select jsonb_build_object('attempt_id',b.attempt_id,'question_ids',b.question_ids) from gina.repeat_calendar_items i join gina.repeat_calendar_batches b on b.id=i.batch_id join public.events e on e.id=i.event_id and e.family_id=b.family_id where i.event_id=p_event_id and b.family_id=gina.family_id());
end;$$;
revoke all on function public.get_repeat_calendar_event(uuid) from public,anon,service_role;
grant execute on function public.get_repeat_calendar_event(uuid) to authenticated;

-- Explicit calendar reassignment detaches its old child's review link.
create function gina.detach_reassigned_repeat_event() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.children where id=old.child_id) then
  update gina.repeat_calendar_items set event_id=null where event_id=old.id;
 end if;return new;
end;$$;
revoke all on function gina.detach_reassigned_repeat_event() from public,anon,authenticated,service_role;
create trigger repeat_calendar_reassignment before update of child_id on public.events for each row when(old.child_id is distinct from new.child_id) execute function gina.detach_reassigned_repeat_event();
