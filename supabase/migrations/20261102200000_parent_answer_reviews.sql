-- Parent ink is separate from the immutable submitted child document.
alter table public.exam_answers add column review_document jsonb,
 add column review_revision int not null default 0,
 add column review_ai_id uuid;
create function gina.valid_review_document(d jsonb) returns boolean language sql immutable set search_path='' as $$
 select d is null or (gina.valid_answer_document(d) and not exists(select 1 from jsonb_array_elements(d->'elements') e where e->>'type'='source'));
$$;
grant execute on function gina.valid_review_document(jsonb) to authenticated,service_role;
alter table public.exam_answers add constraint review_document_valid check(gina.valid_review_document(review_document));
create function gina.bump_review_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.review_revision:=case when new.graded_by='parent' then 1 else 0 end;
 elsif (new.score,new.feedback,new.graded_by,new.review_document,new.review_ai_id) is distinct from (old.score,old.feedback,old.graded_by,old.review_document,old.review_ai_id)
 then new.review_revision:=old.review_revision+1;
 else new.review_revision:=old.review_revision; end if;
 return new;
end;$$;
create trigger review_revision before insert or update on public.exam_answers for each row execute function gina.bump_review_revision();
create function gina.answer_fingerprint(a public.exam_answers) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('key',a.answer_key,'text',a.answer_text,'document',a.answer_document,'revision',a.edit_revision)::text,'sha256'),'hex');
$$;
revoke all on function gina.answer_fingerprint(public.exam_answers),gina.bump_review_revision() from public,anon,authenticated;

create table public.answer_review_suggestions (
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 answer_hash text not null check(answer_hash ~ '^[a-f0-9]{64}$'),
 image_hash text, consent_version text not null,
 job_id uuid not null references public.ai_operation_jobs(id) on delete cascade,
 result jsonb not null,created_at timestamptz not null default now(),
 unique(attempt_id,question_id,answer_hash,actor_id)
);
alter table public.answer_review_suggestions enable row level security;
revoke all on public.answer_review_suggestions from anon,authenticated;
grant all on public.answer_review_suggestions to service_role;
grant select on public.answer_review_suggestions to authenticated;
create policy review_suggestion_parent on public.answer_review_suggestions for select to authenticated
 using(gina.is_parent() and family_id=gina.family_id());
alter table public.exam_answers add constraint review_ai_reference foreign key(review_ai_id) references public.answer_review_suggestions(id) on delete set null;

create function public.get_answer_review(p_attempt_id uuid,p_question_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.exam_attempts;ans public.exam_answers;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=gina.family_id();
 if a.id is null or not exists(select 1 from public.exams where id=a.exam_id and p_question_id=any(question_ids)) then raise exception 'attempt_not_found';end if;
 select * into ans from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
 return jsonb_build_object('score',ans.score,'feedback',ans.feedback,'document',ans.review_document,'revision',coalesce(ans.review_revision,0),'answer_hash',gina.answer_fingerprint(ans),'answer_revision',coalesce(ans.edit_revision,0));
end;$$;

create function public.save_answer_review(p_request_id uuid,p_attempt_id uuid,p_question_id uuid,p_revision int,p_answer_hash text,p_score smallint,p_feedback text,p_document jsonb,p_ai_id uuid default null)
returns int language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;ans public.exam_answers;r public.mutation_receipts;payload jsonb;kind public.question_kind;rev int;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision is null or p_revision<0 or coalesce(length(p_feedback),0)>4000 or not gina.valid_review_document(p_document) then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=gina.family_id() for update;
 if a.id is null then raise exception 'attempt_not_found';end if;
 payload:=jsonb_build_object('attempt',p_attempt_id,'question',p_question_id,'revision',p_revision,'hash',p_answer_hash,'score',p_score,'feedback',p_feedback,'document',p_document,'ai',p_ai_id);
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id is distinct from gina.family_id() or r.actor_id is distinct from auth.uid() or r.operation<>'answer_review' or r.payload<>payload then raise exception 'request_conflict';end if;
  return (r.result->>'revision')::int;
 end if;
 if a.status='in_progress' then raise exception 'attempt_not_finished';end if;
 select q.kind into kind from public.exams e join public.question_bank q on q.id=p_question_id where e.id=a.exam_id and q.id=any(e.question_ids);
 if kind is null then raise exception 'question_not_found';end if;
 select * into ans from public.exam_answers where attempt_id=a.id and question_id=p_question_id for update;
 if coalesce(ans.review_revision,0)<>p_revision then raise exception 'review_changed';end if;
 if gina.answer_fingerprint(ans) is distinct from p_answer_hash then raise exception 'answer_changed';end if;
 if p_ai_id is not null and not exists(select 1 from public.answer_review_suggestions where id=p_ai_id and family_id=a.family_id and attempt_id=a.id and question_id=p_question_id and answer_hash=p_answer_hash) then raise exception 'review_ai_mismatch';end if;
 if kind='open_ended' then
  perform public.score_open_answer(p_attempt_id,p_question_id,p_score,p_feedback);
 else
  if p_score is not null then raise exception 'review_mc_score';end if;
  insert into public.exam_answers(attempt_id,question_id,feedback) values(a.id,p_question_id,nullif(trim(p_feedback),''))
  on conflict(attempt_id,question_id) do update set feedback=excluded.feedback;
 end if;
 update public.exam_answers set review_document=p_document,review_ai_id=p_ai_id where attempt_id=a.id and question_id=p_question_id returning review_revision into rev;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,a.family_id,auth.uid(),'answer_review',payload,jsonb_build_object('revision',rev));
 return rev;
end;$$;

create function public.get_child_answer_reviews(p_attempt_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',ans.question_id,'position',array_position(e.question_ids,ans.question_id),'score',ans.score,'feedback',ans.feedback,'document',ans.review_document,'answer_document',ans.answer_document,'answer_text',ans.answer_text) order by array_position(e.question_ids,ans.question_id)),'[]'::jsonb)
 from public.exam_answers ans join public.exam_attempts a on a.id=ans.attempt_id join public.exams e on e.id=a.exam_id
 where a.id=p_attempt_id and a.family_id=gina.family_id() and a.status<>'in_progress'
 and (gina.is_parent() or (gina.is_device() and a.child_id=gina.child_id()))
 and ans.review_revision>0 and (ans.graded_by='parent' or ans.review_document is not null) and (ans.feedback is not null or ans.review_document is not null)
 and not exists(select 1 from public.group_exam_entries ge join public.group_exams g on g.id=ge.group_id where ge.exam_id=e.id and g.ends_at>now());
$$;
revoke all on function public.get_answer_review(uuid,uuid),public.save_answer_review(uuid,uuid,uuid,int,text,smallint,text,jsonb,uuid),public.get_child_answer_reviews(uuid) from public,anon;
grant execute on function public.get_answer_review(uuid,uuid),public.save_answer_review(uuid,uuid,uuid,int,text,smallint,text,jsonb,uuid),public.get_child_answer_reviews(uuid) to authenticated;

-- The Edge worker obtains the exact stored answer hash using service-only access.
create function public.review_answer_fingerprint(p_attempt_id uuid,p_question_id uuid) returns text language sql stable security definer set search_path='' as $$
 select gina.answer_fingerprint(a) from public.exam_answers a where attempt_id=p_attempt_id and question_id=p_question_id;
$$;
revoke all on function public.review_answer_fingerprint(uuid,uuid) from public,anon,authenticated;
grant execute on function public.review_answer_fingerprint(uuid,uuid) to service_role;
insert into public.app_settings(key,value) values('review_ai.enabled','false') on conflict do nothing;
create function public.get_review_ai_policy() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare plan public.plans;pol public.ai_operation_policies;used int;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 plan:=gina.family_plan_of(gina.family_id());
 select * into pol from public.ai_operation_policies where action='grade' and plan_code=plan.code;
 select count(*) into used from public.ai_operation_jobs where family_id=gina.family_id() and action='grade' and created_at>=gina.family_month_start(gina.family_id()) and status<>'failed';
 return jsonb_build_object('enabled',coalesce(plan.prova_ai_grading and pol.enabled,false) and exists(select 1 from public.app_settings where key='review_ai.enabled' and value='true'::jsonb),'remaining',greatest(0,coalesce(pol.monthly_limit,0)-used));
end;$$;
revoke all on function public.get_review_ai_policy() from public,anon;
grant execute on function public.get_review_ai_policy() to authenticated;

-- Consent remains auditable even when rendering/provider execution fails.
create table public.answer_review_consents (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 answer_hash text not null check(answer_hash ~ '^[a-f0-9]{64}$'),
 version text not null, created_at timestamptz not null default now(),
 unique(attempt_id,question_id,answer_hash,actor_id)
);
alter table public.answer_review_consents enable row level security;
revoke all on public.answer_review_consents from public,anon,authenticated;
grant all on public.answer_review_consents to service_role;
