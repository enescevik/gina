-- Resume only the child's own entered answers; never return correctness, keys or AI/parent feedback.
drop policy if exists question_bank_global_select on public.question_bank;
create policy question_bank_global_select on public.question_bank
  for select to authenticated using (family_id is null and (gina.is_parent() or gina.is_admin()));

create or replace function public.get_saved_exam_answers(p_attempt_id uuid)
returns table(question_id uuid, answer_key text, answer_text text)
language sql stable security definer set search_path = public
as $$
  select ans.question_id, ans.answer_key, ans.answer_text
  from public.exam_answers ans join public.exam_attempts a on a.id = ans.attempt_id
  where a.id = p_attempt_id and a.family_id = gina.family_id()
    and (gina.is_parent() or (gina.is_device() and a.child_id = gina.child_id()));
$$;
revoke execute on function public.get_saved_exam_answers(uuid) from public, anon;
grant execute on function public.get_saved_exam_answers(uuid) to authenticated;

-- Lock the exam while starting; lock the attempt while saving or finishing.
-- This serializes concurrent requests and keeps answer totals consistent.
create or replace function public.start_exam_attempt(p_exam_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.exams%rowtype;
  v_child uuid;
  v_row public.exam_attempts%rowtype;
begin
  select * into v_exam from public.exams where id = p_exam_id and family_id = gina.family_id() for update;
  if v_exam.id is null or v_exam.status not in ('assigned', 'completed') then
    raise exception 'exam_not_assigned' using errcode = 'P0001';
  end if;
  if gina.is_device() then
    v_child := gina.child_id();
  elsif gina.is_parent() then
    v_child := v_exam.child_id; -- telefonda çocuk modu
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_child is distinct from v_exam.child_id then
    raise exception 'wrong_child' using errcode = 'P0001';
  end if;

  select * into v_row from public.exam_attempts
    where exam_id = p_exam_id and child_id = v_child and (status = 'in_progress' or v_exam.status = 'completed')
    order by started_at desc limit 1;
  if v_row.id is not null then
    return v_row; -- devam eden deneme
  end if;

  if v_exam.status = 'completed' then raise exception 'attempt_not_found' using errcode = 'P0001'; end if;

  insert into public.exam_attempts (family_id, exam_id, child_id, deadline_at)
  values (
    v_exam.family_id, v_exam.id, v_child,
    case when v_exam.timed then now() + make_interval(mins => v_exam.duration_minutes) end
  )
  returning * into v_row;
  update public.question_bank set times_asked = times_asked + 1 where id = any (v_exam.question_ids);
  return v_row;
end;
$$;

create or replace function public.submit_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer_key text default null, p_answer_text text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_question public.question_bank%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id() for update;
  if v_attempt.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if gina.is_device() and v_attempt.child_id <> gina.child_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (gina.is_device() or gina.is_parent()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;
  if v_attempt.deadline_at is not null and now() > v_attempt.deadline_at then
    update public.exam_attempts set status = 'submitted', finished_at = v_attempt.deadline_at where id = p_attempt_id;
    raise exception 'time_up' using errcode = 'P0001';
  end if;

  select * into v_question from public.question_bank where id = p_question_id;
  if v_question.id is null or not exists (
    select 1 from public.exams e where e.id = v_attempt.exam_id and p_question_id = any (e.question_ids)
  ) then
    raise exception 'question_not_in_exam' using errcode = 'P0001';
  end if;

  insert into public.exam_answers (attempt_id, question_id, answer_key, answer_text, is_correct)
  values (
    p_attempt_id, p_question_id, p_answer_key, p_answer_text,
    case when v_question.kind = 'multiple_choice' then p_answer_key = v_question.correct_key end
  )
  on conflict (attempt_id, question_id) do update
    set answer_key = excluded.answer_key,
        answer_text = excluded.answer_text,
        is_correct = excluded.is_correct,
        answered_at = now();
end;
$$;

create or replace function public.finish_exam_attempt(p_attempt_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id() for update;
  if v_attempt.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if gina.is_device() and v_attempt.child_id <> gina.child_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (gina.is_device() or gina.is_parent()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    return v_attempt;
  end if;

  update public.exam_attempts a
  set status = 'submitted',
      finished_at = now(),
      mc_total = (
        select count(*) from public.exams e
        join unnest(e.question_ids) qid on true
        join public.question_bank q on q.id = qid
        where e.id = a.exam_id and q.kind = 'multiple_choice'
      ),
      mc_correct = (
        select count(*) from public.exam_answers ans
        where ans.attempt_id = a.id and ans.is_correct
      )
  where a.id = p_attempt_id
  returning * into v_attempt;

  update public.exams set status = 'completed' where id = v_attempt.exam_id;
  return v_attempt;
end;
$$;
