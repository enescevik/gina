-- Include editable notebook changes in the frozen cohort boundary.
create or replace function gina.guard_group_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;g public.group_exams;key text;
begin
 select * into a from public.exam_attempts where id=new.attempt_id;
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=a.exam_id;
 if g.id is null then return new;end if;
 if tg_op='INSERT' or (new.answer_key,new.answer_text,new.answer_document,new.question_id,new.attempt_id) is distinct from(old.answer_key,old.answer_text,old.answer_document,old.question_id,old.attempt_id) then
  if g.status<>'published' or a.status<>'in_progress' or now()>a.deadline_at or now()>=g.ends_at then raise exception 'group_answer_closed';end if;
  if new.answer_key is not null and new.answer_key not in('A','B','C','D') then raise exception 'invalid_input';end if;
 end if;
 select q.content->>'correct_key' into key from public.group_exam_entries e join public.group_exam_entry_questions eq on eq.entry_id=e.id
 join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord where e.exam_id=a.exam_id and eq.question_id=new.question_id;
 if key is null then raise exception 'question_not_in_exam';end if;
 new.is_correct:=coalesce(new.answer_key=key,false);
 return new;
end;$$;
