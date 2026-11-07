-- F7: an explicit choice is separate from the legacy seven-day toggle.
alter table public.question_focus
 add column duration_mode text not null default 'week',
 add column selected_at timestamptz not null default now(),
 add column attempts_left smallint,
 add column event_id uuid references public.events(id) on delete cascade,
 add constraint question_focus_duration_shape check (
  (duration_mode='week' and attempts_left is null and event_id is null)
  or (duration_mode='attempts' and attempts_left is not null and attempts_left between 0 and 3 and event_id is null)
  or (duration_mode='event' and attempts_left is null and event_id is not null)
 );
create index question_focus_event_idx on public.question_focus(event_id) where event_id is not null;

create or replace function public.set_question_focus(p_child_id uuid,p_question_id uuid,p_selected boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_selected is null then raise exception 'invalid_input' using errcode='22023'; end if;
 if not exists(select 1 from public.children where id=p_child_id and family_id=f and archived_at is null)
 or not exists(select 1 from public.question_bank q join public.children c on c.id=p_child_id and c.grade=q.grade where q.id=p_question_id and q.family_id=f and c.family_id=f) then
  raise exception 'forbidden' using errcode='42501'; end if;
 if not p_selected then
  delete from public.question_focus where family_id=f and child_id=p_child_id and question_id=p_question_id;
 else
  -- The same selected=true retry does not extend an active period. Re-enable after expiry starts a new week.
  insert into public.question_focus(family_id,child_id,question_id,created_by,expires_at)
  values(f,p_child_id,p_question_id,auth.uid(),now()+interval '7 days')
  on conflict(child_id,question_id) do update set
   expires_at=excluded.expires_at,duration_mode='week',selected_at=now(),attempts_left=null,event_id=null
   where question_focus.expires_at<=now();
 end if;
end; $$;

create function public.set_question_focus_window(p_request uuid,p_child uuid,p_question uuid,p_mode text,p_event uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); deadline timestamptz; payload jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_mode is null or p_mode not in ('week','attempts','event') or (p_mode='event')<>(p_event is not null) then
  raise exception 'invalid_input' using errcode='22023';
 end if;
 if not exists(select 1 from public.question_bank q join public.children c on c.id=p_child and c.grade=q.grade
  where q.id=p_question and q.family_id=f and c.family_id=f and c.archived_at is null) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 payload:=jsonb_build_object('action','focus.window','family',f,'child',p_child,'question',p_question,'mode',p_mode,'event',p_event);
 if gina.help_receipt(p_request,payload) is not null then return;end if;
 if p_mode='event' then
  select starts_at into deadline from public.events where id=p_event and family_id=f and (child_id is null or child_id=p_child)
    and type='exam' and rrule is null and archived_at is null and starts_at>now() for share;
  if deadline is null then raise exception 'focus_event_unavailable';end if;
 elsif p_mode='attempts' then
  deadline:='infinity';
 else
  deadline:=now()+interval '7 days';
 end if;
 insert into public.question_focus(family_id,child_id,question_id,created_by,expires_at,duration_mode,selected_at,attempts_left,event_id)
 values(f,p_child,p_question,auth.uid(),deadline,p_mode,now(),case when p_mode='attempts' then 3 end,p_event)
 on conflict(child_id,question_id) do update set expires_at=excluded.expires_at,duration_mode=excluded.duration_mode,
  selected_at=excluded.selected_at,attempts_left=excluded.attempts_left,event_id=excluded.event_id,created_by=excluded.created_by;
 perform gina.save_help_receipt(p_request,payload,'true'::jsonb,f);
end;$$;
revoke all on function public.set_question_focus_window(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.set_question_focus_window(uuid,uuid,uuid,text,uuid) to authenticated;

-- Consume one use per finished attempt in the same child's subject, excluding shared cohorts.
-- Updating the focus row serializes simultaneous completions; a repeated submit never changes status again.
create function gina.consume_question_focus_attempt() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.group_exam_entries where exam_id=new.exam_id) then return null;end if;
 update public.question_focus f
 set attempts_left=f.attempts_left-1,
     expires_at=case when f.attempts_left=1 then now() else f.expires_at end
 from public.exams e,public.question_bank q
 where e.id=new.exam_id and q.id=f.question_id and q.grade=e.grade and q.subject=e.subject
  and f.family_id=new.family_id and f.child_id=new.child_id and f.duration_mode='attempts'
  and f.attempts_left>0 and new.started_at>=f.selected_at;
 return null;
end;$$;
revoke all on function gina.consume_question_focus_attempt() from public,anon,authenticated,service_role;
create trigger question_focus_consume_attempt after update of status on public.exam_attempts
 for each row when (old.status='in_progress' and new.status in ('submitted','graded'))
 execute function gina.consume_question_focus_attempt();

create function gina.sync_question_focus_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.question_focus f where f.event_id=new.id
  and (new.type<>'exam' or new.rrule is not null or new.archived_at is not null
    or new.family_id<>f.family_id or (new.child_id is not null and new.child_id<>f.child_id));
 update public.question_focus set expires_at=new.starts_at
  where event_id=new.id and expires_at>now();
 return null;
end;$$;
revoke all on function gina.sync_question_focus_event() from public,anon,authenticated,service_role;
create trigger question_focus_event_change after update of starts_at,type,rrule,archived_at,child_id,family_id on public.events
 for each row execute function gina.sync_question_focus_event();
