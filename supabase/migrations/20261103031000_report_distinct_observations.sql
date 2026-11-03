-- Repeating one question does not provide independent evidence about a topic.
-- Evidence-based reporting. No ability/diagnostic score and no cross-grade averaging.
create or replace function public.learning_progress(p_child_id uuid, p_days int default 30, p_subject text default null, p_grade int default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); tz text; first_day date; last_day date; result jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null or not exists(select 1 from public.children where id=p_child_id and family_id=f) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_days is null or p_days not in(7,30,90) or (p_grade is not null and p_grade not between 1 and 12) or coalesce(length(p_subject),0)>100 then
  raise exception 'invalid_input';
 end if;
 select timezone into tz from public.families where id=f;
 last_day:=(now() at time zone tz)::date; first_day:=last_day-(p_days-1);
 with raw as (
  select a.id attempt_id,q.id question_id,q.grade,q.subject,q.topic,
   nullif(q.provenance->>'curriculum_version','') curriculum,
   -- Repeated library redemptions retain the original item identity.
   case when q.provenance->>'generator'='gina-library' and nullif(q.provenance->>'item_id','') is not null
     then 'library:'||(q.provenance->>'item_id') else q.id::text end identity,
   a.finished_at, (a.finished_at at time zone tz)::date study_day,
   case
    when q.kind='multiple_choice' and nullif(trim(ans.answer_key),'') is null then 'blank'
    when q.kind='multiple_choice' then case when ans.is_correct is null then 'pending' when ans.is_correct then 'correct' else 'wrong' end
    when nullif(trim(ans.answer_text),'') is null and not exists(
      select 1 from jsonb_array_elements(ans.answer_document->'elements') element
      where element->>'type'='stroke' or (element->>'type'='text' and nullif(trim(element->>'text'),'') is not null)
    ) then 'blank'
    when ans.score is null then 'pending'
    when ans.score=100 then 'correct'
    when ans.score=0 then 'wrong'
    else 'partial' end state
  from public.exam_attempts a join public.exams e on e.id=a.exam_id and e.family_id=f
  cross join lateral unnest(e.question_ids) qid
  join public.question_bank q on q.id=qid and (q.family_id=f or q.family_id is null)
  left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
  where a.child_id=p_child_id and a.family_id=f and a.status in('submitted','graded')
   and a.finished_at >= (first_day::timestamp at time zone tz)
   and a.finished_at < ((last_day+1)::timestamp at time zone tz)
   and (p_subject is null or q.subject=p_subject) and (p_grade is null or q.grade=p_grade)
 ), summary as (
  select count(*) total, count(distinct (identity,grade,subject,curriculum)) unique_questions,
   count(distinct attempt_id) attempts,
   count(*) filter(where state='pending') pending,
   count(*) filter(where state='correct') correct,
   count(*) filter(where state='partial') partial,
   count(*) filter(where state='wrong') wrong,
   count(*) filter(where state='blank') blank from raw
 ), topic_rows as (
  select grade,subject,topic,curriculum,count(*) total,count(distinct identity) unique_questions,
   count(*) filter(where state='pending') pending,count(*) filter(where state='correct') correct,
   count(*) filter(where state='partial') partial,count(*) filter(where state='wrong') wrong,
   count(*) filter(where state='blank') blank,max(finished_at) last_at,
   (count(distinct identity) filter(where state<>'pending') < 5) limited_observation
  from raw group by grade,subject,topic,curriculum
 ), weeks as (
  select d::date week_start from generate_series(date_trunc('week',first_day::timestamp),date_trunc('week',last_day::timestamp),interval '1 week') d
 ), weekly as (
  select w.week_start,count(r.question_id) total,count(*) filter(where r.state='pending') pending,
   count(*) filter(where r.state='correct') correct,count(*) filter(where r.state='partial') partial,
   count(*) filter(where r.state='wrong') wrong,count(*) filter(where r.state='blank') blank
  from weeks w left join raw r on r.study_day>=w.week_start and r.study_day<w.week_start+7 group by w.week_start
 )
 select jsonb_build_object(
  'version',1,'from',first_day,'through',last_day,'timezone',tz,
  'summary',(select to_jsonb(s)||jsonb_build_object('repeats',s.total-s.unique_questions) from summary s),
  'weeks',(select coalesce(jsonb_agg(to_jsonb(w) order by w.week_start),'[]') from weekly w),
  'topics',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('evidence',(
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select r.attempt_id,r.question_id,r.state,r.finished_at from raw r
    where r.grade=t.grade and r.subject=t.subject and r.topic=t.topic and r.curriculum is not distinct from t.curriculum
    order by case when r.state='pending' then 0 when r.state in('wrong','partial') then 1 when r.state='blank' then 2 else 3 end,r.finished_at desc,r.attempt_id,r.question_id limit 5
   ) x)) order by t.grade,t.subject,t.topic,t.curriculum),'[]') from topic_rows t)
 ) into result;
 return result;
end;$$;
revoke all on function public.learning_progress(uuid,int,text,int) from public,anon;
grant execute on function public.learning_progress(uuid,int,text,int) to authenticated;
