-- Read-only suggestions for a parent's existing Prova draft. No assignment,
-- automatic grade, entitlement charge or claim of mastery is made here.
create index if not exists exam_attempts_completed_child_idx on public.exam_attempts(family_id,child_id,finished_at desc) where status in('submitted','graded');

create function public.get_repeat_candidates(p_draft_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
   or (kind='open_ended' and graded_by='parent' and score>=0 and score<100))
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
end;$$;
revoke all on function public.get_repeat_candidates(uuid) from public,anon;
grant execute on function public.get_repeat_candidates(uuid) to authenticated;
