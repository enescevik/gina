-- C04 — Prova draft context (ders/karma, sınav türü, dönem/okul) in the server schema,
-- open-ended alternative correct answers + rubric for parent-written questions.
--
-- * prova_drafts.content may carry an optional `context` object. Drafts saved before this
--   migration (no `context`) stay valid and submittable exactly as before.
-- * submit_prova_draft copies the context into explicit exam columns; the child's education
--   period/school snapshot is checked at submit so a stale draft cannot silently claim the
--   wrong term/school (`prova_child_period_changed`, user re-confirms in the builder).
-- * Exam context columns are frozen with the exam content lock (same rule as preparation).
-- * save_question_with_sources accepts `rubric` = {criteria[], alternative_answers[]} for
--   open-ended questions and stores it in provenance.rubric (same shape AI generation uses).
--   The used-question guard already freezes the whole row (provenance included) once assigned.

alter table public.exams
 add column exam_scope text check(exam_scope in('subject','mixed')),
 add column assessment_track text check(assessment_track in('meb_common','lgs','free')),
 add column term smallint check(term between 1 and 2),
 add column academic_year int check(academic_year between 2000 and 2100),
 add column education_period_id uuid,
 add column school_declared boolean;

create function gina.guard_exam_context() returns trigger language plpgsql set search_path='' as $$
begin
 if old.content_locked_at is not null and (new.exam_scope,new.assessment_track,new.term,new.academic_year,new.education_period_id,new.school_declared)
  is distinct from (old.exam_scope,old.assessment_track,old.term,old.academic_year,old.education_period_id,old.school_declared)
 then raise exception 'exam_content_locked'; end if;
 return new;
end; $$;
revoke all on function gina.guard_exam_context() from public,anon,authenticated;
create trigger exam_context_guard before update on public.exams for each row execute function gina.guard_exam_context();

-- Shape-only validation of the optional context (save time). Ownership of the period is
-- checked here too, so a draft can never reference another family's education record.
create function gina.validate_prova_context(f uuid,c jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x jsonb:=c->'context';
 k text[]:=array['scope','track','term','program','academicYear','periodId','school','schoolDeclared'];
begin
 if x is null then return; end if;
 if jsonb_typeof(x)<>'object' or not(x ?& k) or x-k<>'{}'::jsonb then raise exception 'invalid_input'; end if;
 if coalesce(x->>'scope','') not in('subject','mixed') or coalesce(x->>'track','') not in('meb_common','lgs','free')
 or jsonb_typeof(x->'schoolDeclared')<>'boolean'
 or jsonb_typeof(x->'term') not in('number','null') or ((x->>'term') is not null and (x->>'term') not in('1','2'))
 or jsonb_typeof(x->'academicYear') not in('number','null') or ((x->>'academicYear') is not null and ((x->>'academicYear') !~ '^[0-9]{4}$' or (x->>'academicYear')::int not between 2000 and 2100))
 or jsonb_typeof(x->'program') not in('string','null') or ((x->>'program') is not null and length(trim(x->>'program')) not between 1 and 80)
 or jsonb_typeof(x->'school') not in('string','null') or ((x->>'school') is not null and length(x->>'school')>120)
 or jsonb_typeof(x->'periodId') not in('string','null')
 or ((x->>'periodId') is not null and (x->>'periodId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
 then raise exception 'invalid_input'; end if;
 if (x->>'periodId') is not null and not exists(select 1 from gina.child_education_periods where id=(x->>'periodId')::uuid and family_id=f
   and child_id=nullif(c->>'childId','')::uuid) then raise exception 'forbidden' using errcode='42501'; end if;
end; $$;
revoke all on function gina.validate_prova_context(uuid,jsonb) from public,anon,authenticated;

create or replace function gina.validate_prova_draft(f uuid,c jsonb) returns void language plpgsql security definer set search_path='' as $$
declare req text[]:=array['childId','grade','title','purpose','format','subjects','topics','target','minutes','difficulty','kind','note','step','blocks'];
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>100000
 or not(c ?& req)
 or c-req-'context'<>'{}'::jsonb
 then raise exception 'invalid_input'; end if;
 if jsonb_typeof(c->'subjects')<>'array' or jsonb_typeof(c->'topics')<>'array' or jsonb_typeof(c->'blocks')<>'array'
 or jsonb_typeof(c->'title')<>'string' or length(c->>'title')>160 or jsonb_typeof(c->'note')<>'string' or length(c->>'note')>1500
 or coalesce(c->>'purpose','') not in('practice','written','trial') or coalesce(c->>'format','') not in('school','meb','practice')
 or coalesce(c->>'kind','') not in('mixed','multiple_choice','open_ended') or coalesce(c->>'difficulty','') not in('kolay','orta','orta_ustu','zor')
 or jsonb_typeof(c->'target')<>'number' or jsonb_typeof(c->'step')<>'number'
 or (c->>'target')::int not between 1 and 100 or (c->>'step')::int not between 0 and 3
 or jsonb_typeof(c->'grade') not in('number','null') or jsonb_typeof(c->'minutes') not in('number','null')
 or ((c->>'grade') is not null and (c->>'grade')::int not between 1 and 12)
 or ((c->>'minutes') is not null and (c->>'minutes')::int not between 1 and 180)
 then raise exception 'invalid_input'; end if;
 if jsonb_array_length(c->'subjects')>12 or jsonb_array_length(c->'topics')>30 or jsonb_array_length(c->'blocks')>100
 or exists(select 1 from jsonb_array_elements(c->'subjects') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 80)
 or exists(select 1 from jsonb_array_elements(c->'topics') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 200)
 or exists(select 1 from jsonb_array_elements(c->'blocks') b where not(b ?& array['kind','id','source']) or b-array['kind','id','source']<>'{}'::jsonb or coalesce(b->>'source','') not in('library','ai','manual','document'))
 then raise exception 'invalid_input'; end if;
 if c->>'childId' is not null and not exists(select 1 from public.children where id=(c->>'childId')::uuid and family_id=f) then raise exception 'forbidden' using errcode='42501'; end if;
 perform gina.validate_prova_context(f,c);
 perform gina.prova_draft_questions(f,c);
end; $$;
revoke all on function gina.validate_prova_draft(uuid,jsonb) from public,anon,authenticated;

create or replace function public.submit_prova_draft(p_request_id uuid,p_id uuid,p_version int) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;d public.prova_drafts;c jsonb;x jsonb;ids uuid[];subjects text[];payload jsonb;ch public.children;
 cur gina.child_education_periods;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_id is null or p_version is null then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('id',p_id,'version',p_version);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'submit_prova_draft' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return (r.result->>'id')::uuid;
 end if;
 select * into d from public.prova_drafts where id=p_id and family_id=f for update;
 if not found then raise exception 'prova_draft_not_found'; end if;
 if d.version<>p_version then raise exception 'prova_draft_changed'; end if;
 if d.submitted_at is not null then return d.exam_id; end if;
 c:=d.content; x:=c->'context'; perform gina.validate_prova_draft(f,c);
 select * into ch from public.children where id=(c->>'childId')::uuid and family_id=f for share;
 if ch.id is null or c->>'grade' is null or length(trim(c->>'title'))=0 then raise exception 'prova_scope_required'; end if;
 if ch.grade is not null and ch.grade<>(c->>'grade')::int then raise exception 'prova_child_grade_changed'; end if;
 -- No official-scope claim until the verified catalog has supplied a scenario.
 if c->>'format'='meb' then raise exception 'prova_verified_scope_required'; end if;
 ids:=gina.prova_draft_questions(f,c);
 if cardinality(ids)<>(c->>'target')::int then raise exception 'prova_question_count'; end if;
 select array_agg(v) into subjects from jsonb_array_elements_text(c->'subjects')v;
 if coalesce(cardinality(subjects),0)=0 then raise exception 'prova_scope_required'; end if;
 if x is not null then
  if x->>'scope'='subject' and cardinality(subjects)<>1 then raise exception 'prova_scope_subject_count'; end if;
  if x->>'track'='lgs' and (c->>'grade')::int<>8 then raise exception 'prova_track_grade'; end if;
  -- The draft remembers which education period/school it was prepared for. A transfer,
  -- new school year or school correction since then must be confirmed again by the parent.
  select * into cur from gina.child_education_periods where child_id=ch.id and ends_on is null;
  if (x->>'periodId') is not null and (cur.id is null or cur.id<>(x->>'periodId')::uuid
     or coalesce(cur.school,'')<>coalesce(x->>'school','')
     or ((x->>'academicYear') is not null and cur.academic_year<>(x->>'academicYear')::int))
  then raise exception 'prova_child_period_changed'; end if;
 end if;
 perform 1 from public.question_bank where id=any(ids) order by id for update;
 if exists(select 1 from public.question_bank where id=any(ids) and (grade<>(c->>'grade')::int or not(subject=any(subjects)))) then raise exception 'prova_question_scope'; end if;
 if exists(select 1 from public.question_bank where id=any(ids) and (length(trim(stem))=0 or (kind='open_ended' and length(trim(coalesce(expected_answer,'')))=0) or (kind='multiple_choice' and (correct_key is null or not exists(select 1 from jsonb_array_elements(choices)v where v->>'key'=correct_key))))) then raise exception 'prova_answer_required'; end if;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by,preparation,
  exam_scope,assessment_track,term,academic_year,education_period_id,school_declared)
 values(d.id,f,ch.id,trim(c->>'title'),array_to_string(subjects,' / '),(c->>'grade')::int,ids,c->>'minutes' is not null,(c->>'minutes')::int,'assigned',auth.uid(),c,
  x->>'scope',x->>'track',(x->>'term')::smallint,(x->>'academicYear')::int,(x->>'periodId')::uuid,(x->>'schoolDeclared')::boolean);
 update public.prova_drafts set exam_id=d.id,submitted_at=now(),updated_at=now() where id=d.id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'submit_prova_draft',payload,jsonb_build_object('id',d.id));
 return d.id;
end; $$;
revoke all on function public.submit_prova_draft(uuid,uuid,int) from public,anon;
grant execute on function public.submit_prova_draft(uuid,uuid,int) to authenticated;

-- Open-ended answer key: alternatives + rubric for parent-written questions. Same shape as
-- AI generation (provenance.rubric); never returned by get_attempt_questions (child).
create function gina.valid_question_rubric(r jsonb) returns boolean language sql immutable set search_path='' as $$
 select r is null or (
  jsonb_typeof(r)='object' and r ?& array['criteria','alternative_answers'] and r-array['criteria','alternative_answers']='{}'::jsonb
  and jsonb_typeof(r->'criteria')='array' and jsonb_array_length(r->'criteria')<=10
  and jsonb_typeof(r->'alternative_answers')='array' and jsonb_array_length(r->'alternative_answers')<=10
  and not exists(select 1 from jsonb_array_elements(r->'criteria') v where jsonb_typeof(v)<>'object' or not(v ?& array['text','points'])
    or v-array['text','points']<>'{}'::jsonb or jsonb_typeof(v->'text')<>'string' or length(trim(v->>'text')) not between 1 and 500
    or jsonb_typeof(v->'points')<>'number' or (v->>'points')::numeric not between 0 and 100)
  and not exists(select 1 from jsonb_array_elements(r->'alternative_answers') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 500)
  and coalesce((select sum((v->>'points')::numeric) from jsonb_array_elements(r->'criteria') v),0)<=100
 );
$$;
revoke all on function gina.valid_question_rubric(jsonb) from public,anon,authenticated;

create or replace function public.save_question_with_sources(p_request_id uuid,p_question jsonb,p_images jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();q public.question_bank;r public.mutation_receipts;payload jsonb;image jsonb;rubric jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_question) is distinct from 'object' or jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>3 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('question',p_question,'images',p_images);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_question' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return (r.result->>'id')::uuid;
 end if;
 q:=jsonb_populate_record(null::public.question_bank,p_question);
 if q.grade is null or q.grade not between 1 and 12 or length(trim(coalesce(q.subject,''))) not between 1 and 80
 or length(trim(coalesce(q.topic,''))) not between 1 and 200 or length(trim(coalesce(q.stem,''))) not between 5 and 10000 or q.kind is null or q.difficulty is null
 or length(coalesce(q.expected_answer,''))>10000 or length(coalesce(q.solution,''))>10000 or length(coalesce(q.explanation,''))>10000 then raise exception 'question_incomplete'; end if;
 if q.kind='multiple_choice' and (jsonb_typeof(q.choices) is distinct from 'array' or jsonb_array_length(q.choices)<>4 or
 (select count(distinct c->>'key') from jsonb_array_elements(q.choices)c where c->>'key' in('A','B','C','D') and length(trim(coalesce(c->>'text',''))) between 1 and 5000)<>4 or coalesce(q.correct_key,'') not in('A','B','C','D')) then raise exception 'question_incomplete'; end if;
 rubric:=case when jsonb_typeof(p_question->'rubric')='null' then null else p_question->'rubric' end;
 if rubric is not null and (q.kind<>'open_ended' or not gina.valid_question_rubric(rubric)) then raise exception 'question_rubric_invalid'; end if;
 -- An empty rubric (no criteria, no alternatives) is the same as none.
 if rubric is not null and jsonb_array_length(rubric->'criteria')=0 and jsonb_array_length(rubric->'alternative_answers')=0 then rubric:=null; end if;
 insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
 values(p_request_id,f,q.grade,trim(q.subject),trim(q.topic),q.scenario_code,q.kind,q.difficulty,trim(q.stem),q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,
  jsonb_build_object('generator','parent')||case when rubric is null then '{}'::jsonb else jsonb_build_object('rubric',rubric) end,auth.uid());
 for image in select value from jsonb_array_elements(p_images) loop
  perform public.attach_question_source(p_request_id,(image->>'source_id')::uuid,image->>'alt');
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_question',payload,jsonb_build_object('id',p_request_id));
 return p_request_id;
end; $$;
revoke all on function public.save_question_with_sources(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_question_with_sources(uuid,jsonb,jsonb) to authenticated;
