-- Empty annotation documents must not publish a blank notebook to the child.
create or replace function public.get_child_answer_reviews(p_attempt_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',ans.question_id,'position',array_position(e.question_ids,ans.question_id),'score',ans.score,'feedback',ans.feedback,'document',case when jsonb_array_length(ans.review_document->'elements')>0 then ans.review_document else null end,'answer_document',ans.answer_document,'answer_text',ans.answer_text) order by array_position(e.question_ids,ans.question_id)),'[]'::jsonb)
 from public.exam_answers ans join public.exam_attempts a on a.id=ans.attempt_id join public.exams e on e.id=a.exam_id
 where a.id=p_attempt_id and a.family_id=gina.family_id() and a.status<>'in_progress'
 and (gina.is_parent() or (gina.is_device() and a.child_id=gina.child_id()))
 and ans.review_revision>0 and (ans.graded_by='parent' or ans.review_document is not null) and (nullif(trim(ans.feedback),'') is not null or coalesce(jsonb_array_length(ans.review_document->'elements'),0)>0)
 and not exists(select 1 from public.group_exam_entries ge join public.group_exams g on g.id=ge.group_id where ge.exam_id=e.id and g.ends_at>now());
$$;
