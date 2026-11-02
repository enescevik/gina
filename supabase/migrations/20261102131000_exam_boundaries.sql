-- A family-owned exam must not act as a service-role bridge to another family's
-- questions, child or scenario. RLS on the exam row alone cannot validate arrays.
create function gina.exam_references_valid(f uuid,c uuid,ids uuid[],blueprint uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.children where id=c and family_id=f)
 and ids is not null and cardinality(ids)<=200 and array_position(ids,null) is null
 and cardinality(ids)=(select count(distinct id) from unnest(ids) id)
 and not exists(select 1 from unnest(ids) u(qid) where not exists(select 1 from public.question_bank q where q.id=u.qid and (q.family_id=f or q.family_id is null)))
 and (blueprint is null or exists(select 1 from public.exam_blueprints where id=blueprint and (family_id=f or family_id is null)));
$$;
revoke all on function gina.exam_references_valid(uuid,uuid,uuid[],uuid) from public,anon,authenticated;
create function gina.guard_exam_references() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not gina.exam_references_valid(new.family_id,new.child_id,new.question_ids,new.blueprint_id) then raise exception 'exam_reference_forbidden' using errcode='42501'; end if;
 if tg_op='UPDATE' and exists(select 1 from public.exam_attempts where exam_id=old.id)
 and (new.family_id,new.child_id,new.question_ids,new.grade,new.subject,new.timed,new.duration_minutes) is distinct from (old.family_id,old.child_id,old.question_ids,old.grade,old.subject,old.timed,old.duration_minutes) then raise exception 'exam_already_started'; end if;
 return new;
end; $$;
revoke all on function gina.guard_exam_references() from public,anon,authenticated;
create trigger exams_reference_guard before insert or update on public.exams for each row execute function gina.guard_exam_references();

create function gina.guard_attempt_references() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.exams;
begin
 select * into e from public.exams where id=new.exam_id;
 if e.id is null or e.family_id<>new.family_id or e.child_id<>new.child_id
 or not gina.exam_references_valid(e.family_id,e.child_id,e.question_ids,e.blueprint_id) then raise exception 'exam_reference_forbidden' using errcode='42501'; end if;
 return new;
end; $$;
revoke all on function gina.guard_attempt_references() from public,anon,authenticated;
create trigger attempts_reference_guard before insert or update on public.exam_attempts for each row execute function gina.guard_attempt_references();

create function gina.guard_answer_references() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.exam_attempts a join public.exams e on e.id=a.exam_id join public.question_bank q on q.id=new.question_id
 where a.id=new.attempt_id and a.family_id=e.family_id and a.child_id=e.child_id and q.id=any(e.question_ids) and (q.family_id=a.family_id or q.family_id is null)) then raise exception 'question_not_in_exam'; end if;
 return new;
end; $$;
revoke all on function gina.guard_answer_references() from public,anon,authenticated;
create trigger answers_reference_guard before insert or update on public.exam_answers for each row execute function gina.guard_answer_references();

-- Read-side defence also protects any malformed historical exam rows.
create or replace function public.get_attempt_questions(p_exam_id uuid)
returns table(id uuid,kind public.question_kind,difficulty public.question_difficulty,stem text,choices jsonb,ord int)
language sql stable security definer set search_path='' as $$
 select q.id,q.kind,q.difficulty,q.stem,
 case when q.kind='multiple_choice' then (select jsonb_agg(jsonb_build_object('key',c->>'key','text',c->>'text')) from jsonb_array_elements(q.choices)c) else null end,u.ord::int
 from public.exams e join unnest(e.question_ids) with ordinality u(qid,ord) on true
 join public.question_bank q on q.id=u.qid and (q.family_id=e.family_id or q.family_id is null)
 join public.children ch on ch.id=e.child_id and ch.family_id=e.family_id
 where e.id=p_exam_id and e.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and e.child_id=gina.child_id())) and e.status in('assigned','completed') order by u.ord;
$$;

create function gina.guard_used_question() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Family deletion must be able to remove its own retained question material.
 if old.family_id is not null and not exists(select 1 from public.families where id=old.family_id) then return old; end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.exams where old.id=any(question_ids)) then raise exception 'question_in_use'; end if;
  return old;
 end if;
 if (new.family_id,new.grade,new.subject,new.topic,new.kind,new.stem,new.choices,new.correct_key,new.expected_answer,new.solution)
 is distinct from (old.family_id,old.grade,old.subject,old.topic,old.kind,old.stem,old.choices,old.correct_key,old.expected_answer,old.solution)
 and exists(select 1 from public.exam_attempts a join public.exams e on e.id=a.exam_id where old.id=any(e.question_ids)) then raise exception 'question_in_use'; end if;
 return new;
end; $$;
revoke all on function gina.guard_used_question() from public,anon,authenticated;
create trigger used_question_guard before update or delete on public.question_bank for each row execute function gina.guard_used_question();
