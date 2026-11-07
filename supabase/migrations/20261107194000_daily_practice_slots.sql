-- A parent highlights an existing assignment. This does not create an exam or consume AI quota.
create table gina.daily_practice_slots (
  child_id uuid not null references public.children(id) on delete cascade,
  study_day date not null,
  exam_id uuid not null references public.exams(id) on delete cascade,
  primary key (child_id, study_day),
  unique (exam_id)
);
alter table gina.daily_practice_slots enable row level security;
revoke all on gina.daily_practice_slots from public, anon, authenticated;

create function public.pin_daily_practice(p_exam_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_exam public.exams; v_day date; v_existing uuid;
begin
  if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
  select e.* into v_exam from public.exams e
    join public.children c on c.id=e.child_id and c.family_id=e.family_id
    where e.id=p_exam_id and e.family_id=gina.family_id() and c.archived_at is null
    for share of e,c;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if v_exam.kind<>'practice' or v_exam.timed or v_exam.status<>'assigned'
    or cardinality(v_exam.question_ids)<>1 or v_exam.blueprint_id is not null
    or v_exam.assessment_track is not null
    or coalesce(v_exam.preparation->>'purpose','practice')<>'practice'
    or exists(select 1 from public.exam_attempts a where a.exam_id=p_exam_id)
  then raise exception 'daily_practice_ineligible' using errcode='22023'; end if;
  select gina.local_day(f.timezone,now()) into v_day from public.families f where f.id=v_exam.family_id;
  insert into gina.daily_practice_slots(child_id,study_day,exam_id)
    values(v_exam.child_id,v_day,p_exam_id) on conflict do nothing;
  select s.exam_id into v_existing from gina.daily_practice_slots s
    where s.child_id=v_exam.child_id and s.study_day=v_day;
  if v_existing is distinct from p_exam_id then
    raise exception 'daily_practice_slot_unavailable' using errcode='23505';
  end if;
  return p_exam_id;
end; $$;

create function public.get_daily_practice(p_child_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select s.exam_id
  from gina.daily_practice_slots s
  join public.children c on c.id=s.child_id
  join public.families f on f.id=c.family_id
  join public.exams e on e.id=s.exam_id and e.child_id=c.id and e.family_id=f.id
  cross join lateral (
    select extract(hour from local_time)::int*60 + extract(minute from local_time)::int as minutes
    from (select now() at time zone f.timezone as local_time) clock
  ) wall
  where s.child_id=p_child_id and c.family_id=gina.family_id() and c.archived_at is null
    and (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id))
    and s.study_day=gina.local_day(f.timezone,now()) and e.status='assigned'
    and not exists(select 1 from public.exam_attempts a where a.exam_id=e.id and a.status in ('submitted','graded'))
    and (c.evening_reminder_start is null or not (
      case when c.evening_reminder_start<c.evening_reminder_end
        then wall.minutes>=c.evening_reminder_start and wall.minutes<c.evening_reminder_end
        else wall.minutes>=c.evening_reminder_start or wall.minutes<c.evening_reminder_end end
    ));
$$;
revoke all on function public.pin_daily_practice(uuid),public.get_daily_practice(uuid) from public,anon;
grant execute on function public.pin_daily_practice(uuid),public.get_daily_practice(uuid) to authenticated;

insert into public.badge_definitions(slug,title_i18n,icon,rule,sort_order)
values('daily-practice-first','{"tr":"Küçük Keşif","en":"Small Discovery"}',
  'badge-bookworm','{"kind":"daily_practice_completed"}',4);

create function gina.award_daily_practice_badge() returns trigger
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
        or (a.answer is not null and a.score_details->>'answer_state' is distinct from 'unanswered')
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
revoke all on function gina.award_daily_practice_badge() from public,anon,authenticated,service_role;
create trigger award_daily_practice_badge after update of status on public.exam_attempts
for each row execute function gina.award_daily_practice_badge();
