-- Editable page data, never an arbitrary SVG/HTML payload or a persisted signed URL.
alter table public.exam_answers add column answer_document jsonb;
create function gina.valid_answer_document(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare e jsonb;p jsonb;c jsonb;ids text[]:='{}';x numeric;y numeric;w numeric;h numeric;
begin
 if d is null then return true;end if;
 if jsonb_typeof(d)<>'object' or jsonb_typeof(d->'version') is distinct from 'number' or jsonb_typeof(d->'width') is distinct from 'number' or jsonb_typeof(d->'height') is distinct from 'number' or (d->>'version')::numeric<>1 or (d->>'width')::numeric<>1000 or (d->>'height')::numeric<>1400
 or jsonb_typeof(d->'elements') is distinct from 'array' or length(d::text)>600000
 or (select count(*) from jsonb_object_keys(d))<>4 then return false;end if;
 if not(d ?& array['version','width','height','elements']) or jsonb_array_length(d->'elements')>300 then return false;end if;
 for e in select value from jsonb_array_elements(d->'elements') loop
  if jsonb_typeof(e)<>'object' or not(e ?& array['id','type']) or (e->>'id')::uuid is null or e->>'id'=any(ids) then return false;end if;
  ids:=array_append(ids,e->>'id');
  if e->>'type' in ('stroke','text') then
   if not(e ?& array['color','size']) or coalesce(e->>'color','') not in ('#201951','#6042DE','#227D73','#BA5348') or jsonb_typeof(e->'size')<>'number' then return false;end if;
  end if;
  if e->>'type'='stroke' then
   if (select count(*) from jsonb_object_keys(e))<>5 or not(e ? 'points') or (e->>'size')::numeric not between 1 and 20 or jsonb_typeof(e->'points')<>'array' then return false;end if;
   if jsonb_array_length(e->'points') not between 1 and 2000 then return false;end if;
   for p in select value from jsonb_array_elements(e->'points') loop
    if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or (p->>0)::numeric not between 0 and 1000 or (p->>1)::numeric not between 0 and 1400 then return false;end if;
   end loop;
  elsif e->>'type' in ('text','source') then
   if not(e ?& array['x','y','width','height']) or jsonb_typeof(e->'x')<>'number' or jsonb_typeof(e->'y')<>'number' or jsonb_typeof(e->'width')<>'number' or jsonb_typeof(e->'height')<>'number' then return false;end if;
   x:=(e->>'x')::numeric;y:=(e->>'y')::numeric;w:=(e->>'width')::numeric;h:=(e->>'height')::numeric;
   if x not between 0 and 950 or y not between 0 and 1350 or w<40 or h<40 or x+w>1000 or y+h>1400 then return false;end if;
   if e->>'type'='text' then
    if (select count(*) from jsonb_object_keys(e))<>9 or jsonb_typeof(e->'text') is distinct from 'string' or length(e->>'text')>2000 or (e->>'size')::numeric not between 16 and 64 then return false;end if;
   else
    if (select count(*) from jsonb_object_keys(e))<>10 or not(e ?& array['sourceId','questionId','alt','crop']) or (e->>'sourceId')::uuid is null or (e->>'questionId')::uuid is null or jsonb_typeof(e->'alt')<>'string' or length(e->>'alt')>500 then return false;end if;
    c:=e->'crop';
    if jsonb_typeof(c)<>'object' or not(c ?& array['x','y','width','height']) or (select count(*) from jsonb_object_keys(c))<>4 then return false;end if;
    if jsonb_typeof(c->'x')<>'number' or jsonb_typeof(c->'y')<>'number' or jsonb_typeof(c->'width')<>'number' or jsonb_typeof(c->'height')<>'number' then return false;end if;
    x:=(c->>'x')::numeric;y:=(c->>'y')::numeric;w:=(c->>'width')::numeric;h:=(c->>'height')::numeric;
    if x<0 or y<0 or w<=0 or h<=0 or x+w>1.000001 or y+h>1.000001 then return false;end if;
   end if;
  else return false;end if;
 end loop;
 return true;
exception when others then return false;
end;$$;
alter table public.exam_answers add constraint answer_document_valid check(gina.valid_answer_document(answer_document));
create or replace function gina.bump_answer_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.edit_revision:=1;
 elsif (new.answer_key,new.answer_text,new.answer_document) is distinct from (old.answer_key,old.answer_text,old.answer_document) then new.edit_revision:=old.edit_revision+1;
 else new.edit_revision:=old.edit_revision;end if;
 return new;
end;$$;
create function gina.guard_answer_document() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;e jsonb;
begin
 if tg_op='UPDATE' and new.answer_document is not distinct from old.answer_document then return new;end if;
 if new.answer_document is null and tg_op='INSERT' then return new;end if;
 if not gina.valid_answer_document(new.answer_document) then raise exception 'invalid_notebook';end if;
 select * into a from public.exam_attempts where id=new.attempt_id for update;
 if a.status<>'in_progress' or (a.deadline_at is not null and now()>a.deadline_at) then raise exception 'attempt_closed';end if;
 for e in select value from jsonb_array_elements(new.answer_document->'elements') where value->>'type'='source' loop
  if e->>'questionId'<>new.question_id::text or not exists(
   select 1 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id
   where l.question_id=new.question_id and l.source_id=(e->>'sourceId')::uuid and s.family_id=a.family_id and s.status='ready'
  ) then raise exception 'notebook_source_forbidden' using errcode='42501';end if;
 end loop;
 return new;
end;$$;
create trigger notebook_guard before insert or update on public.exam_answers for each row execute function gina.guard_answer_document();
create function public.get_saved_exam_answers_v3(p_attempt_id uuid)
returns table(question_id uuid,answer_key text,answer_text text,answer_document jsonb,revision int)
language sql stable security definer set search_path='' as $$
 select ans.question_id,ans.answer_key,ans.answer_text,ans.answer_document,ans.edit_revision
 from public.exam_answers ans join public.exam_attempts a on a.id=ans.attempt_id
 where a.id=p_attempt_id and a.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and a.child_id=gina.child_id()));
$$;
create function public.submit_exam_answer_v3(p_request_id uuid,p_attempt_id uuid,p_question_id uuid,p_expected_revision int,p_answer_key text default null,p_answer_text text default null,p_answer_document jsonb default null)
returns int language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;r public.mutation_receipts;body jsonb;revision int;f uuid:=gina.family_id();
begin
 if f is null or not(gina.is_parent() or gina.is_device()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or coalesce(length(p_answer_text),0)>20000 or not gina.valid_answer_document(p_answer_document) then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=f for update;
 if a.id is null then raise exception 'attempt_not_found';end if;
 if gina.is_device() and a.child_id is distinct from gina.child_id() then raise exception 'forbidden' using errcode='42501';end if;
 body:=jsonb_build_object('attempt',p_attempt_id,'question',p_question_id,'revision',p_expected_revision,'key',p_answer_key,'text',p_answer_text,'document',p_answer_document);
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'exam_answer_v3' or r.payload<>body then raise exception 'request_conflict';end if;
  select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
  if revision is distinct from (r.result->>'revision')::int then raise exception 'answer_changed';end if;
  return revision;
 end if;
 select coalesce((select edit_revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id),0) into revision;
 if revision<>p_expected_revision then raise exception 'answer_changed';end if;
 -- Reuse the established actor, question, deadline, completion and group-exam checks.
 perform public.submit_exam_answer(p_attempt_id,p_question_id,p_answer_key,p_answer_text);
 update public.exam_answers set answer_document=p_answer_document where attempt_id=a.id and question_id=p_question_id;
 select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'exam_answer_v3',body,jsonb_build_object('revision',revision));
 return revision;
end;$$;
revoke all on function gina.valid_answer_document(jsonb),gina.guard_answer_document() from public,anon,authenticated;
-- CHECK constraints need validation permission for existing parent grading updates.
grant execute on function gina.valid_answer_document(jsonb) to authenticated,service_role;
revoke all on function public.get_saved_exam_answers_v3(uuid),public.submit_exam_answer_v3(uuid,uuid,uuid,int,text,text,jsonb) from public,anon;
grant execute on function public.get_saved_exam_answers_v3(uuid),public.submit_exam_answer_v3(uuid,uuid,uuid,int,text,text,jsonb) to authenticated;
