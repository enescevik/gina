-- Report education identity is the immutable context saved with the evidence.
-- Older clients keep their bounded 7/30/90-day API unchanged.
create function gina.check_report_period(p_child_id uuid,p_period text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or gina.is_parent() is not true or gina.family_id() is null
 or not exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id())
 then raise exception 'forbidden' using errcode='42501'; end if;
 if p_period is null or (p_period not in('all','unknown') and not exists(
  select 1 from gina.child_education_periods where child_id=p_child_id and family_id=gina.family_id() and id::text=p_period
 )) then raise exception 'report_period_invalid'; end if;
end;$$;
revoke all on function gina.check_report_period(uuid,text) from public,anon,authenticated,service_role;

create function public.education_report_periods(p_child_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.check_report_period(p_child_id,'all');
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'academic_year',academic_year,
  'starts_on',starts_on,'ends_on',ends_on) order by starts_on desc,id)
 from gina.child_education_periods where child_id=p_child_id and family_id=gina.family_id()),'[]');
end;$$;
create function public.learning_progress_education(p_child_id uuid, p_days int default 30, p_subject text default null, p_grade int default null, p_period text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); tz text; first_day date; last_day date; result jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null or not exists(select 1 from public.children where id=p_child_id and family_id=f) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_days is null or p_days not in(0,7,30,90) or (p_grade is not null and p_grade not between 1 and 12) or coalesce(length(p_subject),0)>100 then
  raise exception 'invalid_input';
 end if;
 perform gina.check_report_period(p_child_id,p_period);
 select timezone into tz from public.families where id=f;
 last_day:=(now() at time zone tz)::date; first_day:=last_day-(p_days-1);
 if p_days=0 then
  -- Whole saved context, including work submitted after a school transfer.
  -- Never infer historical membership from today's class or finish date.
  select coalesce(min((a.finished_at at time zone tz)::date),last_day),
         coalesce(max((a.finished_at at time zone tz)::date),last_day)
  into first_day,last_day
  from public.exam_attempts a join public.exams e on e.id=a.exam_id and e.family_id=f
  where a.child_id=p_child_id and a.family_id=f and a.status in('submitted','graded')
   and a.finished_at<=now()
   and (p_period='all' or (p_period='unknown' and e.education_context->>'period_id' is null) or e.education_context->>'period_id'=p_period);
 end if;
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
   and (p_period='all' or (p_period='unknown' and e.education_context->>'period_id' is null) or e.education_context->>'period_id'=p_period)
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
  'education_period',p_period,'version',1,'from',first_day,'through',last_day,'timezone',tz,
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

create index exams_education_report on public.exams(child_id,(education_context->>'period_id'));
create index grades_education_report on public.grades(child_id,(education_context->>'period_id'),graded_on desc,id desc);

create function public.list_school_grades(p_child_id uuid,p_period text default 'all',p_before_date date default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform gina.check_report_period(p_child_id,p_period);
 if (p_before_date is null) <> (p_before_id is null) then raise exception 'invalid_cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(g) order by graded_on desc,id desc),'[]') into result from (
  select id,subject,kind,score,max_score,graded_on,note,education_context
  from public.grades where child_id=p_child_id and family_id=gina.family_id()
   and (p_period='all' or (p_period='unknown' and education_context->>'period_id' is null) or education_context->>'period_id'=p_period)
   and (p_before_id is null or (graded_on,id)<(p_before_date,p_before_id))
  order by graded_on desc,id desc limit 51
 ) g;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=50),'[]'),
  'has_more',jsonb_array_length(result)>50);
end;$$;
revoke all on function public.education_report_periods(uuid),public.learning_progress_education(uuid,int,text,int,text),public.list_school_grades(uuid,text,date,uuid) from public,anon,service_role;
grant execute on function public.education_report_periods(uuid),public.learning_progress_education(uuid,int,text,int,text),public.list_school_grades(uuid,text,date,uuid) to authenticated;
