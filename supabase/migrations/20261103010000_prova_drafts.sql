-- One family-owned, versioned workspace for every question source.
create table public.prova_drafts (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 version int not null default 1 check(version>0), content jsonb not null,
 exam_id uuid references public.exams(id) on delete set null,
 submitted_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.prova_drafts enable row level security;
revoke all on public.prova_drafts from anon,authenticated;
grant select on public.prova_drafts to authenticated;
grant all on public.prova_drafts to service_role;
create policy prova_draft_parent_read on public.prova_drafts for select to authenticated using(gina.is_parent() and family_id=gina.family_id());
create index prova_drafts_family on public.prova_drafts(family_id,updated_at desc);

create function gina.prova_draft_questions(f uuid,c jsonb) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare b jsonb; ids uuid[]:='{}'; members uuid[]; qid uuid;
begin
 for b in select value from jsonb_array_elements(c->'blocks') loop
  qid:=(b->>'id')::uuid;
  if b->>'kind'='group' then
   if not exists(select 1 from public.question_source_groups where id=qid and family_id=f and finalized_at is not null) then raise exception 'prova_source_unavailable'; end if;
   select array_agg(question_id order by position) into members from public.question_source_members where group_id=qid;
   if coalesce(cardinality(members),0)<2 then raise exception 'prova_source_unavailable'; end if;
   ids:=ids||members;
  elsif b->>'kind'='question' then
   if not exists(select 1 from public.question_bank where id=qid and (family_id=f or family_id is null))
   or exists(select 1 from public.question_source_members where question_id=qid) then raise exception 'prova_source_unavailable'; end if;
   ids:=array_append(ids,qid);
  else raise exception 'invalid_input'; end if;
 end loop;
 if cardinality(ids)>200 or cardinality(ids)<>(select count(distinct v) from unnest(ids)v) then raise exception 'prova_duplicate_question'; end if;
 return ids;
end; $$;
revoke all on function gina.prova_draft_questions(uuid,jsonb) from public,anon,authenticated;

create function gina.validate_prova_draft(f uuid,c jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>100000
 or not(c ?& array['childId','grade','title','purpose','format','subjects','topics','target','minutes','difficulty','kind','note','step','blocks'])
 or c-array['childId','grade','title','purpose','format','subjects','topics','target','minutes','difficulty','kind','note','step','blocks']<>'{}'::jsonb
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
 perform gina.prova_draft_questions(f,c);
end; $$;
revoke all on function gina.validate_prova_draft(uuid,jsonb) from public,anon,authenticated;

create function public.save_prova_draft(p_request_id uuid,p_id uuid,p_version int,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;d public.prova_drafts;payload jsonb;result jsonb;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_id is null or p_version is null or p_version<0 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('id',p_id,'version',p_version,'content',p_content);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_prova_draft' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,53));
 select * into d from public.prova_drafts where id=p_id for update;
 if found then
  if d.family_id<>f then raise exception 'forbidden' using errcode='42501'; end if;
  if d.submitted_at is not null then raise exception 'prova_draft_submitted'; end if;
  if d.version<>p_version then raise exception 'prova_draft_changed'; end if;
 elsif p_version<>0 then raise exception 'prova_draft_changed'; end if;
 perform gina.validate_prova_draft(f,p_content);
 if d.id is null then
  insert into public.prova_drafts(id,family_id,created_by,content) values(p_id,f,auth.uid(),p_content) returning * into d;
 else
  update public.prova_drafts set content=p_content,version=version+1,updated_at=now() where id=p_id returning * into d;
 end if;
 result:=jsonb_build_object('id',d.id,'version',d.version,'content',d.content,'exam_id',d.exam_id,'submitted_at',d.submitted_at);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_prova_draft',payload,result);
 return result;
end; $$;
revoke all on function public.save_prova_draft(uuid,uuid,int,jsonb) from public,anon;
grant execute on function public.save_prova_draft(uuid,uuid,int,jsonb) to authenticated;

-- Scope is explicit data, not merely a title saying "mixed". Source question IDs
-- already retain subject/topic and freeze together with their images on assignment.
alter table public.exams add column preparation jsonb;
create function gina.guard_exam_preparation() returns trigger language plpgsql set search_path='' as $$
begin
 if old.content_locked_at is not null and new.preparation is distinct from old.preparation then raise exception 'exam_content_locked'; end if;
 return new;
end; $$;
revoke all on function gina.guard_exam_preparation() from public,anon,authenticated;
create trigger exam_preparation_guard before update on public.exams for each row execute function gina.guard_exam_preparation();

create function public.submit_prova_draft(p_request_id uuid,p_id uuid,p_version int) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;d public.prova_drafts;c jsonb;ids uuid[];subjects text[];payload jsonb;ch public.children;
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
 c:=d.content; perform gina.validate_prova_draft(f,c);
 select * into ch from public.children where id=(c->>'childId')::uuid and family_id=f for share;
 if ch.id is null or c->>'grade' is null or length(trim(c->>'title'))=0 then raise exception 'prova_scope_required'; end if;
 if ch.grade is not null and ch.grade<>(c->>'grade')::int then raise exception 'prova_child_grade_changed'; end if;
 -- No official-scope claim until the verified catalog has supplied a scenario.
 if c->>'format'='meb' then raise exception 'prova_verified_scope_required'; end if;
 ids:=gina.prova_draft_questions(f,c);
 if cardinality(ids)<>(c->>'target')::int then raise exception 'prova_question_count'; end if;
 select array_agg(v) into subjects from jsonb_array_elements_text(c->'subjects')v;
 if coalesce(cardinality(subjects),0)=0 then raise exception 'prova_scope_required'; end if;
 perform 1 from public.question_bank where id=any(ids) order by id for update;
 if exists(select 1 from public.question_bank where id=any(ids) and (grade<>(c->>'grade')::int or not(subject=any(subjects)))) then raise exception 'prova_question_scope'; end if;
 if exists(select 1 from public.question_bank where id=any(ids) and (length(trim(stem))=0 or (kind='open_ended' and length(trim(coalesce(expected_answer,'')))=0) or (kind='multiple_choice' and (correct_key is null or not exists(select 1 from jsonb_array_elements(choices)v where v->>'key'=correct_key))))) then raise exception 'prova_answer_required'; end if;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by,preparation)
 values(d.id,f,ch.id,trim(c->>'title'),array_to_string(subjects,' / '),(c->>'grade')::int,ids,c->>'minutes' is not null,(c->>'minutes')::int,'assigned',auth.uid(),c);
 update public.prova_drafts set exam_id=d.id,submitted_at=now(),updated_at=now() where id=d.id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'submit_prova_draft',payload,jsonb_build_object('id',d.id));
 return d.id;
end; $$;
revoke all on function public.submit_prova_draft(uuid,uuid,int) from public,anon;
grant execute on function public.submit_prova_draft(uuid,uuid,int) to authenticated;
create function public.get_prova_drafts(p_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc),'[]'::jsonb) from
 (select id,version,content,exam_id,submitted_at,updated_at from public.prova_drafts
 where family_id=gina.family_id() and gina.is_parent() and (p_id is null or id=p_id) and (p_id is not null or submitted_at is null) order by updated_at desc limit 100)d;
$$;
revoke all on function public.get_prova_drafts(uuid) from public,anon;
grant execute on function public.get_prova_drafts(uuid) to authenticated;

-- Separate documented consent for generating questions from private originals.
alter table public.learning_source_ai_consents drop constraint learning_source_ai_consents_purpose_check;
alter table public.learning_source_ai_consents add constraint learning_source_ai_consents_purpose_check check(purpose in('grade','import','generate'));
