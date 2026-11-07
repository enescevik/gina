-- Recognize a later return to an answered question, not opening a reminder or a streak.
insert into public.badge_definitions(slug,title_i18n,icon,rule,sort_order)
values ('practice-return','{"tr":"Bir Kez Daha","en":"One More Try"}',
  'badge-bookworm','{"kind":"practice_return_completed"}',5);

create function gina.has_repeat_practice_work(a public.exam_answers) returns boolean
language sql immutable set search_path='' as $$
  select nullif(trim(a.answer_key),'') is not null or nullif(trim(a.answer_text),'') is not null
    or (a.answer is not null and coalesce(a.score_details->>'answer_state' in ('partial','complete'),false))
    or exists (
      select from jsonb_array_elements(case when jsonb_typeof(a.answer_document->'elements')='array'
        then a.answer_document->'elements' else '[]'::jsonb end) as item
      where item->>'type'='stroke'
        or (item->>'type'='text' and nullif(trim(item->>'text'),'') is not null)
    );
$$;
revoke all on function gina.has_repeat_practice_work(public.exam_answers) from public,anon,authenticated;

create function gina.award_repeat_practice_badge() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status <> 'in_progress' or new.status not in ('submitted','graded') or new.finished_at is null
    or exists (select from public.child_badge_awards
      where child_id=new.child_id and badge_slug='practice-return')
  then return null; end if;

  if exists (
    select from public.families f
    join public.exams e on e.id=new.exam_id and e.family_id=f.id and e.child_id=new.child_id and e.kind='practice'
    join public.exam_answers a on a.attempt_id=new.id and a.question_id=any(e.question_ids)
    join public.exam_attempts p on p.family_id=f.id and p.child_id=new.child_id and p.exam_id<>e.id
      and p.status in ('submitted','graded') and p.finished_at<new.finished_at
    join public.exams pe on pe.id=p.exam_id and pe.family_id=f.id and pe.child_id=new.child_id
      and pe.kind='practice' and a.question_id=any(pe.question_ids)
    join public.exam_answers pa on pa.attempt_id=p.id and pa.question_id=a.question_id
    where f.id=new.family_id
      and gina.local_day(f.timezone,p.finished_at)<gina.local_day(f.timezone,new.finished_at)
      and gina.has_repeat_practice_work(a) and gina.has_repeat_practice_work(pa)
  ) then
    insert into public.child_badge_awards(child_id,badge_slug,family_id)
    values(new.child_id,'practice-return',new.family_id) on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function gina.award_repeat_practice_badge() from public,anon,authenticated;
-- Named after the existing attempt recompute trigger so score_details is available.
create trigger exam_attempts_reward_repeat_practice after update of status on public.exam_attempts
for each row when (old.status is distinct from new.status)
execute function gina.award_repeat_practice_badge();
