-- Revision guards survive transport timeouts and late requests from an older screen/device.
alter table public.exam_answers add column edit_revision int not null default 1 check(edit_revision>0);
create function gina.bump_answer_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.edit_revision:=1;
 elsif (new.answer_key,new.answer_text) is distinct from (old.answer_key,old.answer_text) then new.edit_revision:=old.edit_revision+1;
 else new.edit_revision:=old.edit_revision;end if;
 return new;
end;$$;
create trigger answer_revision before insert or update on public.exam_answers for each row execute function gina.bump_answer_revision();
revoke all on function gina.bump_answer_revision() from public,anon,authenticated;
create function public.get_saved_exam_answers_v2(p_attempt_id uuid)
returns table(question_id uuid,answer_key text,answer_text text,revision int)
language sql stable security definer set search_path='' as $$
 select ans.question_id,ans.answer_key,ans.answer_text,ans.edit_revision
 from public.exam_answers ans join public.exam_attempts a on a.id=ans.attempt_id
 where a.id=p_attempt_id and a.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and a.child_id=gina.child_id()));
$$;
create function public.submit_exam_answer_once(p_request_id uuid,p_attempt_id uuid,p_question_id uuid,p_expected_revision int,p_answer_key text default null,p_answer_text text default null)
returns int language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;r public.mutation_receipts;body jsonb;revision int;f uuid:=gina.family_id();
begin
 if f is null or not(gina.is_parent() or gina.is_device()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or coalesce(length(p_answer_text),0)>20000 then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=f for update;
 if a.id is null then raise exception 'attempt_not_found';end if;
 if gina.is_device() and a.child_id is distinct from gina.child_id() then raise exception 'forbidden' using errcode='42501';end if;
 body:=jsonb_build_object('attempt',p_attempt_id,'question',p_question_id,'revision',p_expected_revision,'key',p_answer_key,'text',p_answer_text);
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'exam_answer' or r.payload<>body then raise exception 'request_conflict';end if;
  select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
  if revision is distinct from (r.result->>'revision')::int then raise exception 'answer_changed';end if;
  return revision;
 end if;
 select coalesce((select edit_revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id),0) into revision;
 if revision<>p_expected_revision then raise exception 'answer_changed';end if;
 perform public.submit_exam_answer(p_attempt_id,p_question_id,p_answer_key,p_answer_text);
 select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'exam_answer',body,jsonb_build_object('revision',revision));
 return revision;
end;$$;
revoke all on function public.get_saved_exam_answers_v2(uuid),public.submit_exam_answer_once(uuid,uuid,uuid,int,text,text) from public,anon;
grant execute on function public.get_saved_exam_answers_v2(uuid),public.submit_exam_answer_once(uuid,uuid,uuid,int,text,text) to authenticated;
