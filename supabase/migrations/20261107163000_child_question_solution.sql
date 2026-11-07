-- F3a: expose only the stored explanation, only after grading. No model invocation.
create function public.get_child_question_solution(p_attempt_id uuid,p_question_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.exam_attempts;q public.question_bank;
begin
 if not(gina.is_parent() or gina.is_device()) then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=gina.family_id();
 if a.id is null or (gina.is_device() and a.child_id is distinct from gina.child_id()) then
 raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.exams e where e.id=a.exam_id and p_question_id=any(e.question_ids)) then
 raise exception 'forbidden' using errcode='42501';end if;
 if a.status<>'graded' then return null;end if;
 select * into q from public.question_bank where id=p_question_id and family_id=a.family_id;
 if q.id is null then return null;end if;
 return jsonb_build_object('solution',q.solution,'explanation',q.explanation);
end;$$;
revoke all on function public.get_child_question_solution(uuid,uuid) from public,anon;
grant execute on function public.get_child_question_solution(uuid,uuid) to authenticated;
