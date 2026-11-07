-- Full outcome set identity, not just the first label or a truncated concatenation.
create or replace function gina.reinforcement_scope(p_question public.question_bank) returns text
language plpgsql immutable set search_path='' as $$
declare labels jsonb; items jsonb:=p_question.provenance->'outcome_ids';
begin
 if jsonb_typeof(items) is distinct from 'array' then return 'question:'||p_question.id::text;end if;
 if jsonb_array_length(items)=0 or jsonb_array_length(items)>20 or exists(
 select 1 from jsonb_array_elements(items) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 200
 ) then return 'question:'||p_question.id::text;end if;
 select jsonb_agg(label order by label collate "C") into labels from(select distinct v#>>'{}' label from jsonb_array_elements(items) v)x;
 return 'outcomes:'||encode(extensions.digest(jsonb_build_array(p_question.grade,p_question.subject,p_question.provenance->>'curriculum_version',labels)::text,'sha256'),'hex');
end;$$;
-- Carries over existing seven-day snoozes: never silently re-enable a dismissed card after this fix.
insert into public.reinforcement_snoozes(family_id,child_id,scope_key,until_at)
 select z.family_id,z.child_id,gina.reinforcement_scope(q),max(z.until_at)
 from public.reinforcement_snoozes z join public.question_bank q on q.family_id=z.family_id
 where z.scope_key=left(q.grade::text||':'||q.subject||':'||coalesce(q.provenance->>'curriculum_version','unspecified')||':'||((q.provenance->'outcome_ids')->>0),240)
 group by z.family_id,z.child_id,gina.reinforcement_scope(q)
 on conflict(child_id,scope_key) do update set until_at=greatest(public.reinforcement_snoozes.until_at,excluded.until_at);
create function public.learning_outcome_observations(p_child_id uuid,p_days int default 30,p_subject text default null,p_grade int default null,p_period text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare baseline jsonb;tz text;first_day date;last_day date;
begin
 -- Reuse exact existing authorization, education-period and filter validation.
 baseline:=public.learning_progress_education(p_child_id,p_days,p_subject,p_grade,p_period);
 tz:=baseline->>'timezone';first_day:=(baseline->>'from')::date;last_day:=(baseline->>'through')::date;
 return coalesce((with raw as (
 select q.id,q.grade,q.subject,q.provenance->>'curriculum_version' curriculum,q.provenance->'outcome_ids' outcomes,
 gina.reinforcement_scope(q) scope,a.finished_at,a.id attempt_id,
 case when q.provenance->>'generator'='gina-library' and nullif(q.provenance->>'item_id','') is not null then 'library:'||(q.provenance->>'item_id') else q.id::text end identity,
 case
 when q.kind='multiple_choice' then case when nullif(trim(ans.answer_key),'') is null then 'blank' when ans.is_correct is null then 'pending' else 'scored' end
 when q.kind='structured' then case when ans.score is null and (ans.answer is null or ans.score_details->>'answer_state'='unanswered') then 'blank' when ans.score is null then 'pending' else 'scored' end
 when nullif(trim(ans.answer_text),'') is null and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(ans.answer_document->'elements')='array' then ans.answer_document->'elements' else '[]'::jsonb end) e where e->>'type'='stroke' or(e->>'type'='text' and nullif(trim(e->>'text'),'') is not null)) then 'blank'
 when ans.score is null then 'pending' else 'scored' end state,
 case when q.kind='multiple_choice' then case when ans.is_correct then 100 else 0 end else coalesce(ans.score_exact,ans.score) end points
 from public.exam_attempts a join public.exams ex on ex.id=a.exam_id and ex.family_id=gina.family_id()
 cross join lateral unnest(ex.question_ids) qid
 join public.question_bank q on q.id=qid and(q.family_id=gina.family_id() or q.family_id is null)
 left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
 where a.family_id=gina.family_id() and a.child_id=p_child_id and a.status in('submitted','graded')
 and a.finished_at >=(first_day::timestamp at time zone tz) and a.finished_at<((last_day+1)::timestamp at time zone tz)
 and(p_subject is null or q.subject=p_subject) and(p_grade is null or q.grade=p_grade)
 and(p_period='all' or(p_period='unknown' and ex.education_context->>'period_id' is null) or ex.education_context->>'period_id'=p_period)
 ), latest as (
 select distinct on(scope,identity) * from raw where scope like 'outcomes:%' order by scope,identity,finished_at desc,attempt_id desc
 ), groups as (
 select scope,grade,subject,curriculum,min(outcomes::text)::jsonb outcomes,count(*) observations,
 count(*) filter(where state='scored') scored,count(*) filter(where state='pending') pending,count(*) filter(where state='blank') blank,
 case when count(*) filter(where state='scored')>=5 then round(avg(points) filter(where state='scored'),1) else null end mean_points,
 count(*) filter(where state='scored')<5 limited_observation,max(finished_at) last_at
 from latest group by scope,grade,subject,curriculum
 )select jsonb_agg(to_jsonb(g) order by grade,subject,scope) from groups g),'[]'::jsonb);
end;$$;
revoke all on function public.learning_outcome_observations(uuid,int,text,int,text) from public,anon;
grant execute on function public.learning_outcome_observations(uuid,int,text,int,text) to authenticated;
