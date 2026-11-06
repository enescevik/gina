-- QT00 rapor uyumu: yapılandırılmış maddeler gelişim raporu ve tekrar adaylarında doğru sınıflanır.
-- 'blank' yalnız gerçekten cevapsızsa; kısmi puan 'partial'; insan puanı bekleyen 'pending'.
-- Fonksiyon gövdeleri en son tanımlardan alınmış, yalnız aşağıdaki dallar eklenmiştir.

CREATE OR REPLACE FUNCTION public.learning_progress(p_child_id uuid, p_days integer DEFAULT 30, p_subject text DEFAULT NULL::text, p_grade integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    when q.kind='structured' and ans.score is null and (ans.answer is null or ans.score_details->>'answer_state'='unanswered') then 'blank'
    when q.kind='structured' and ans.score is null then 'pending'
    when q.kind='structured' then case when coalesce(ans.score_exact,ans.score)=100 then 'correct' when coalesce(ans.score_exact,ans.score)=0 then 'wrong' else 'partial' end
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
end;$function$
;

CREATE OR REPLACE FUNCTION public.learning_progress_education(p_child_id uuid, p_days integer DEFAULT 30, p_subject text DEFAULT NULL::text, p_grade integer DEFAULT NULL::integer, p_period text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    when q.kind='structured' and ans.score is null and (ans.answer is null or ans.score_details->>'answer_state'='unanswered') then 'blank'
    when q.kind='structured' and ans.score is null then 'pending'
    when q.kind='structured' then case when coalesce(ans.score_exact,ans.score)=100 then 'correct' when coalesce(ans.score_exact,ans.score)=0 then 'wrong' else 'partial' end
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
end;$function$
;

CREATE OR REPLACE FUNCTION public.get_repeat_candidates(p_draft_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f uuid:=gina.family_id(); d public.prova_drafts; result jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.prova_drafts where id=p_draft_id and family_id=f;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if d.submitted_at is not null then raise exception 'prova_draft_submitted'; end if;
 if d.content->>'childId' is null or d.content->>'grade' is null or jsonb_array_length(d.content->'subjects')=0 then return '[]'::jsonb; end if;
 with observations as (
  select q.id question_id,q.stem,q.topic,q.subject,a.id attempt_id,a.finished_at,
   q.kind,ans.answer_key,ans.is_correct,ans.score,ans.graded_by,
   row_number() over(partition by q.id order by a.finished_at desc,a.id desc) rank
  from public.exam_attempts a
  join public.exams e on e.id=a.exam_id and e.family_id=f and e.child_id=a.child_id
  cross join lateral unnest(e.question_ids) qid
  join public.question_bank q on q.id=qid and (q.family_id=f or q.family_id is null)
  left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
  where a.family_id=f and a.child_id=(d.content->>'childId')::uuid
   and a.status in('submitted','graded') and a.finished_at>=now()-interval '90 days' and a.finished_at<=now()
   and q.grade=(d.content->>'grade')::int and (d.content->'subjects') ? q.subject
 ), eligible as (
  select * from observations where rank=1 and (
   (kind='multiple_choice' and nullif(trim(answer_key),'') is not null and is_correct=false)
   or (kind='open_ended' and graded_by='parent' and score>=0 and score<100)
   or (kind='structured' and graded_by in('auto','parent') and score>=0 and score<100))
 ), units as (
  select case when m.group_id is null then 'question' else 'group' end kind,
   coalesce(m.group_id,x.question_id) id,
   coalesce(g.title,x.stem) title,x.subject,
   x.question_id,x.attempt_id,x.finished_at,
   case when x.kind='multiple_choice' or x.score=0 then 'wrong' else 'partial' end state
  from eligible x left join public.question_source_members m on m.question_id=x.question_id
  left join public.question_source_groups g on g.id=m.group_id and g.family_id=f and g.finalized_at is not null
  where m.group_id is null or (g.id is not null and g.grade=(d.content->>'grade')::int and (d.content->'subjects') ? g.subject)
 ), grouped as (
  select u.kind,u.id,u.title,u.subject,count(*) affected,
   case when u.kind='group' then (select count(*) from public.question_source_members where group_id=u.id) else 1 end question_count,
   max(u.finished_at) last_at,
   jsonb_agg(jsonb_build_object('attempt_id',u.attempt_id,'question_id',u.question_id,'state',u.state) order by u.finished_at desc,u.question_id) evidence
  from units u group by u.kind,u.id,u.title,u.subject
  order by max(u.finished_at) desc,u.id limit 50
 )
 select coalesce(jsonb_agg(to_jsonb(g) order by last_at desc,id),'[]'::jsonb) into result from grouped g;
 return result;
end;$function$
;

CREATE OR REPLACE FUNCTION gina.repeat_calendar_source(p_attempt uuid, p_family uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 or (q.kind='open_ended' and ans.graded_by='parent' and ans.score>=0 and ans.score<100)
or (q.kind='structured' and ans.graded_by in('auto','parent') and ans.score>=0 and ans.score<100))
 -- A newer completed observation supersedes this older attempt, including a blank answer.
 and not exists(select 1 from public.exam_attempts newer join public.exams ne on ne.id=newer.exam_id and ne.family_id=p_family
 where newer.family_id=p_family and newer.child_id=s.child_id and newer.status in('submitted','graded')
 and (newer.finished_at,newer.id)>(s.finished_at,s.id) and q.id=any(ne.question_ids))
 ), evidence as(select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]') qs from eligible x)
 select jsonb_build_object('attempt_id',s.id,'child_id',s.child_id,'child_name',s.name,'grade',s.grade,'timezone',s.timezone,'questions',e.qs,
 'hash',encode(extensions.digest(jsonb_build_object('attempt',s.id,'child',s.child_id,'grade',s.grade,'timezone',s.timezone,'questions',e.qs)::text,'sha256'),'hex')) from source s cross join evidence e;
$function$
;
