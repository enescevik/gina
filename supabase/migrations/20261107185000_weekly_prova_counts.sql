-- Numeric evidence only. Never include question text, answers, notes, IDs or parent-private favorites in AI input.
create function gina.weekly_prova_counts(p_family uuid,p_child uuid,p_from timestamptz,p_until timestamptz) returns jsonb
 language sql stable set search_path='' as $$
 with completed as (
 select a.id,e.question_ids from public.exam_attempts a join public.exams e on e.id=a.exam_id and e.family_id=p_family
 where a.family_id=p_family and a.child_id=p_child and a.status in('submitted','graded') and a.finished_at>=p_from and a.finished_at<p_until
 ), evidence as (
 select c.id attempt_id,q.id question_id,
 case when q.provenance->>'generator'='gina-library' and nullif(q.provenance->>'item_id','') is not null then 'library:'||(q.provenance->>'item_id') else q.id::text end identity,
 case
 when q.kind='multiple_choice' then case when nullif(trim(a.answer_key),'') is null then 'blank' when a.is_correct is null then 'pending' else 'scored' end
 when q.kind='structured' then case when a.answer is null or a.score_details->>'answer_state'='unanswered' then 'blank' when a.score is null then 'pending' else 'scored' end
 when nullif(trim(a.answer_text),'') is null and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(a.answer_document->'elements')='array' then a.answer_document->'elements' else '[]'::jsonb end) v where v->>'type'='stroke' or(v->>'type'='text' and nullif(trim(v->>'text'),'') is not null)) then 'blank'
 when a.score is null then 'pending' else 'scored' end state,
 coalesce(a.score_exact,a.score) points
 from completed c cross join lateral unnest(c.question_ids) qid
 join public.question_bank q on q.id=qid and(q.family_id=p_family or q.family_id is null)
 left join public.exam_answers a on a.attempt_id=c.id and a.question_id=q.id
 )select jsonb_build_object('attempts',(select count(*) from completed),
 'scored',count(*) filter(where state='scored'),
 'partial',count(*) filter(where state='scored' and points>0 and points<100),
 'pending',count(*) filter(where state='pending'),'blank',count(*) filter(where state='blank'),
 'repeated_observations',count(*) filter(where state<>'blank')-count(distinct identity) filter(where state<>'blank'),
 'liked',count(distinct e.question_id) filter(where s.liked),'struggled',count(distinct e.question_id) filter(where s.struggled))
 from evidence e left join public.question_child_signals s on s.family_id=p_family and s.attempt_id=e.attempt_id and s.question_id=e.question_id
$$;
revoke all on function gina.weekly_prova_counts(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.get_weekly_summary_data(p_family_id uuid,p_week_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.families; monday date;begin
 if auth.role() is distinct from 'service_role' and
  (auth.uid() is not null and gina.is_parent() and gina.family_id()=p_family_id) is not true
 then raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 if p_week_start is null or not isfinite(p_week_start) or extract(isodow from p_week_start)<>1 or p_week_start<monday-56 or p_week_start>monday-7 then raise exception 'weekly_date';end if;
 return jsonb_build_object('week_start',p_week_start,'locale',f.locale,'timezone',f.timezone,'data_version','v2',
 'children',(select coalesce(jsonb_agg(jsonb_build_object('alias',k.alias,'grade',k.grade,
 'prova',gina.weekly_prova_counts(f.id,k.id,p_week_start::timestamp at time zone f.timezone,(p_week_start+7)::timestamp at time zone f.timezone),
 'stars_earned',(select coalesce(sum(delta),0) from public.star_events where family_id=f.id and child_id=k.id and reason='task_approved' and delta>0 and created_at>=p_week_start::timestamp at time zone f.timezone and created_at<(p_week_start+7)::timestamp at time zone f.timezone),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_object('status',c.status,'count',c.n) order by c.status),'[]') from (select status,count(*) n from public.task_completions where family_id=f.id and child_id=k.id and due_date>=p_week_start and due_date<p_week_start+7 group by status)c)
 ) order by k.ord),'[]') from gina.weekly_children(f.id) k));
end;$$;
revoke all on function public.get_weekly_summary_data(uuid,date) from public,anon;
grant execute on function public.get_weekly_summary_data(uuid,date) to authenticated,service_role;
