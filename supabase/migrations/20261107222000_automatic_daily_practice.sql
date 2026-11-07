alter table gina.daily_practice_slots add column automatic boolean not null default false;

-- The offer is read-only; only opening it creates a one-question assignment.
create function gina.daily_practice_day(p_child uuid) returns date
language sql stable security definer set search_path='' as $$
 select gina.local_day(f.timezone,now())
 from public.children c join public.families f on f.id=c.family_id
 cross join lateral (select extract(hour from now() at time zone f.timezone)::int*60
   + extract(minute from now() at time zone f.timezone)::int as minute) wall
 where c.id=p_child and c.family_id=gina.family_id() and c.archived_at is null
 and (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child))
 and (c.evening_reminder_start is null or not (
   case when c.evening_reminder_start<c.evening_reminder_end
     then wall.minute>=c.evening_reminder_start and wall.minute<c.evening_reminder_end
     else wall.minute>=c.evening_reminder_start or wall.minute<c.evening_reminder_end end
 ));
$$;

create or replace function public.get_daily_practice(p_child_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select s.exam_id
 from gina.daily_practice_slots s
 join public.exams e on e.id=s.exam_id and e.child_id=s.child_id and e.family_id=gina.family_id()
 where s.child_id=p_child_id and s.study_day=gina.daily_practice_day(p_child_id) and e.status='assigned'
 and not exists(select 1 from public.exam_attempts a where a.exam_id=e.id and a.status in ('submitted','graded'));
$$;

create function gina.daily_practice_candidate(p_child uuid,p_day date) returns uuid
language sql stable security definer set search_path='' as $$
 with child as (
   select c.* from public.children c where c.id=p_child and c.family_id=gina.family_id() and p_day is not null
     and exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true'::jsonb)
 ), signals as (
   select q.id,q.subject,q.topic,gina.reinforcement_scope(q) scope,0 priority,f.selected_at stamp
   from child c join public.question_focus f on f.child_id=c.id and f.family_id=c.family_id
   join public.question_bank q on q.id=f.question_id and q.family_id=c.family_id and q.grade=c.grade
   where f.expires_at>now()
   union all
   select q.id,q.subject,q.topic,gina.reinforcement_scope(q),1,a.finished_at
   from child c join public.exam_attempts a on a.child_id=c.id and a.family_id=c.family_id
   join public.question_child_signals s on s.attempt_id=a.id and s.family_id=c.family_id and s.liked
   join public.question_bank q on q.id=s.question_id and q.grade=c.grade
   where a.status in ('submitted','graded') and a.finished_at>=now()-interval '90 days'
 ), matching as (
   select q.id, ac.package_id, min(s.priority) priority,max(s.stamp) stamp
   from child c
   join gina.library_acquisitions ac on ac.family_id=c.family_id and ac.question_count=1
   join gina.library_acquisition_charges ch on ch.acquisition_id=ac.id and ch.family_id=c.family_id
   join gina.library_publications p on p.package_id=ac.package_id and p.status='published'
   join public.question_bank q on q.id=ch.question_id and q.family_id=c.family_id and q.grade=c.grade
   join signals s on s.subject=q.subject and (s.id=q.id or s.scope=gina.reinforcement_scope(q)
      or (length(trim(s.topic))>0 and lower(trim(s.topic))=lower(trim(q.topic))))
   left join public.question_answer_keys k on k.question_id=q.id
   where (q.kind='multiple_choice' or (q.kind='structured'
      and gina.cohort_interaction(jsonb_build_object('type',q.interaction_type,'schema_version',q.schema_version,
       'payload',q.payload,'answer_key',k.key)) is not null))
    and not exists(select 1 from public.question_reports r where r.question_id=q.id and r.status<>'dismissed')
    and not exists(select 1 from gina.daily_practice_slots slot join public.exams e on e.id=slot.exam_id
     where slot.child_id=c.id and slot.study_day>=p_day-7 and e.question_ids @> array[q.id])
   group by q.id,ac.package_id
 )
 select m.id
 from matching m join gina.library_publications p on p.package_id=m.package_id
 cross join lateral gina.library_publication_checks(m.package_id) checks
 where p.review_fingerprint=checks->>'review_fingerprint' and checks->>'question_count'=checks->>'suitable_count'
   and (checks->>'missing_media')::int=0
 order by m.priority,m.stamp desc,m.id limit 1;
$$;

create function public.daily_practice_offer(p_child_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d date:=gina.daily_practice_day(p_child_id); e uuid; f uuid:=gina.family_id(); cap int;
begin
 if d is null then return null;end if;
 e:=public.get_daily_practice(p_child_id);
 if e is not null then return jsonb_build_object('exam_id',e);end if;
 if exists(select 1 from gina.daily_practice_slots where child_id=p_child_id and study_day=d) then return null;end if;
 select prova_monthly_exams into cap from gina.family_plan_of(f);
 if cap is not null and (select count(*) from public.exams where family_id=f and kind='practice'
    and created_at>=gina.family_month_start(f))>=cap then return null;end if;
 if gina.daily_practice_candidate(p_child_id,d) is not null then return '{"automatic":true}'::jsonb;end if;
 return null;
end;$$;

create function public.open_daily_practice(p_child_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); d date; e uuid; q public.question_bank; label text;
begin
 if gina.daily_practice_day(p_child_id) is null then return null;end if;
 -- The manual pin RPC takes a SHARE lock on this same child.
 perform pg_advisory_xact_lock(hashtextextended(f::text, 119));
 perform 1 from public.children where id=p_child_id and family_id=f for update;
 d:=gina.daily_practice_day(p_child_id);
 if d is null then return null;end if;
 e:=public.get_daily_practice(p_child_id);
 if e is not null then return e;end if;
 if exists(select 1 from gina.daily_practice_slots where child_id=p_child_id and study_day=d) then return null;end if;
 select * into q from public.question_bank where id=gina.daily_practice_candidate(p_child_id,d) and family_id=f;
 if q.id is null then return null;end if;
 select case when split_part(lower(locale),'-',1)='en' then 'Question of the day' else 'Günün Sorusu' end
 into label from public.families where id=f;
 begin
   insert into public.exams(family_id,child_id,title,subject,grade,question_ids,status)
   values(f,p_child_id,label,q.subject,q.grade,array[q.id],'ready') returning id into e;
   insert into gina.daily_practice_slots(child_id,study_day,exam_id,automatic) values(p_child_id,d,e,true);
   update public.exams set status='assigned' where id=e;
 exception when sqlstate 'P0001' then
   if sqlerrm='plan_limit_prova_exams' then return null;end if;
   raise;
 end;
 return e;
end;$$;

revoke all on function gina.daily_practice_day(uuid),gina.daily_practice_candidate(uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.daily_practice_offer(uuid),public.open_daily_practice(uuid) from public,anon,service_role;
grant execute on function public.daily_practice_offer(uuid),public.open_daily_practice(uuid) to authenticated;

create or replace function gina.push_on_exam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists(select 1 from gina.daily_practice_slots where exam_id=new.id and automatic) then return null;end if;
  if new.status = 'assigned' and (tg_op = 'INSERT' or old.status is distinct from 'assigned') then
    perform gina.enqueue_push(new.family_id, 'device', 'exam_assigned',
      jsonb_build_object('exam_id', new.id), new.child_id);
  end if;
  return null;
end;
$$;

create or replace function gina.push_on_exam_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists(select 1 from gina.daily_practice_slots where exam_id=new.exam_id and automatic) then return null;end if;
  if old.status = 'in_progress' and new.status in ('submitted', 'graded') then
    perform gina.enqueue_push(new.family_id, 'parents', 'exam_finished',
      jsonb_build_object('exam_id', new.exam_id, 'attempt_id', new.id));
  end if;
  return null;
end;
$$;

-- Read structured answer_state after the existing attempt recomputation trigger.
create or replace function gina.award_daily_practice_badge() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status<>'in_progress' or new.status not in ('submitted','graded') or new.finished_at is null then
    return new;
  end if;
  if exists (
    select 1 from gina.daily_practice_slots s
    join public.families f on f.id=new.family_id
    join public.exams e on e.id=s.exam_id and e.child_id=s.child_id and e.family_id=f.id
    join public.exam_answers a on a.attempt_id=new.id and a.question_id=any(e.question_ids)
    where s.exam_id=new.exam_id and s.child_id=new.child_id
      and s.study_day=gina.local_day(f.timezone,new.finished_at)
      and (
        nullif(trim(a.answer_key),'') is not null or nullif(trim(a.answer_text),'') is not null
        or (a.answer is not null and a.score_details->>'answer_state' in ('partial','complete'))
        or exists (
          select 1 from jsonb_array_elements(a.answer_document->'elements') element
          where element->>'type'='stroke'
             or (element->>'type'='text' and nullif(trim(element->>'text'),'') is not null)
        )
      )
  ) then
    insert into public.child_badge_awards(child_id,badge_slug,family_id)
      values(new.child_id,'daily-practice-first',new.family_id) on conflict do nothing;
  end if;
  return new;
end; $$;
alter trigger award_daily_practice_badge on public.exam_attempts rename to exam_attempts_reward_daily_practice;
