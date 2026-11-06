-- D1 — C04/C05 kalanları.
--
-- 1) AI ortak kaynağı → gerçek ortak kaynak soru grubu. `prova-generate` (v6) bağlı soruların gövdesini
--    `başlık\nortak metin\n\nsoru` biçiminde kendi başına okunur yazar ve provenance'a `shared_prompt` +
--    `shared_source_title` koyar. complete_prova_generation_v2 aynı işlemde, elle/kütüphane gruplarının
--    sözleşmesiyle (question_source_groups/members, guard_question_group_members, sonlandırma) grubu kurar.
--    Grup açılamıyorsa (bayrak kapalı, tek bağlı soru, sınır dışı uzunluk) sorular bağımsız kalır ama
--    gövdeleri ortak metni taşıdığı için çocuk eksik soru görmez. Atanmış/grup sürümü değişmez kuralları aynen.
-- 2) Soru düzeyinde dönem/program izi (gina.question_period_tags; question_bank satırı değişmez, mevcut
--    sabitlik/özet kurallarına dokunulmaz). Gönderimde taslak bağlamıyla uyumsuz soru `prova_question_period_mismatch`
--    ile durur; veli soruyu çıkarır, taslağın dönem/programını düzeltir ya da soruyu açıkça kabul eder
--    (`content.fitAccepted`). Prova ders metni C02'nin veli onaylı çocuk ders bağına (child_subject_links) çözülür;
--    gönderilen sınav `subject_links` anlık görüntüsünü taşır. Ders metni hiçbir yerde değişmez.
-- 3) C05 soru-kazanım uygunluğu için veli inceleme listesi (list_scenario_question_fit); karar RPC'si aynen
--    review_scenario_question_fit, AI önerisi ayrı alan ve karar değildir.

-- ---------------------------------------------------------------------------
-- 1) AI ortak kaynak grupları
-- ---------------------------------------------------------------------------
create function gina.link_ai_shared_sources(p_family uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s record; gid uuid; i int; groups jsonb:='[]'::jsonb; members jsonb:='{}'::jsonb; qs jsonb:=p_result->'questions';
begin
 if jsonb_typeof(qs) is distinct from 'array'
 or not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb) then return p_result; end if;
 for s in
  select q.provenance->>'shared_source_id' sid,
   min(q.grade) grade, min(q.subject) subject, count(distinct q.grade) n_grade, count(distinct q.subject) n_subject,
   min(q.provenance->>'shared_source_title') title, min(btrim(q.provenance#>>'{shared_source,content}')) body,
   count(distinct btrim(q.provenance#>>'{shared_source,content}')) n_body,
   min(q.provenance#>>'{shared_source,kind}') kind,
   array_agg(q.id order by x.ord) ids, array_agg(q.provenance->>'shared_prompt' order by x.ord) prompts,
   bool_and(length(coalesce(q.provenance->>'shared_prompt','')) between 5 and 3500
    and q.stem=(q.provenance->>'shared_source_title')||E'\n'||btrim(q.provenance#>>'{shared_source,content}')||E'\n\n'||(q.provenance->>'shared_prompt')) shaped
  from jsonb_array_elements(qs) with ordinality x(v,ord)
  join public.question_bank q on q.id=(x.v->>'id')::uuid and q.family_id=p_family
  where q.provenance ? 'shared_prompt' and q.provenance ? 'shared_source_id'
   and not exists(select 1 from public.question_source_members m where m.question_id=q.id)
  group by 1
 loop
  if not s.shaped or s.n_grade<>1 or s.n_subject<>1 or s.n_body<>1 or cardinality(s.ids) not between 2 and 12
  or length(coalesce(s.title,'')) not between 1 and 160 or length(coalesce(s.body,'')) not between 1 and 6000 then continue; end if;
  gid:=gen_random_uuid();
  insert into public.question_source_groups(id,family_id,series_id,version,previous_id,title,body,grade,subject)
  values(gid,p_family,gid,1,null,s.title,s.body,s.grade,s.subject);
  for i in 1..cardinality(s.ids) loop
   insert into public.question_source_members(group_id,question_id,position,prompt) values(gid,s.ids[i],i,s.prompts[i]);
   members:=members||jsonb_build_object(s.ids[i]::text,jsonb_build_object('group_id',gid,'prompt',s.prompts[i],'position',i));
  end loop;
  update public.question_source_groups set finalized_at=now() where id=gid;
  groups:=groups||jsonb_build_array(jsonb_build_object('id',gid,'title',s.title,'body',s.body,'kind',s.kind,
   'shared_source_id',s.sid,'question_ids',to_jsonb(s.ids)));
 end loop;
 if jsonb_array_length(groups)=0 then return p_result; end if;
 return p_result||jsonb_build_object('groups',groups,'questions',(select jsonb_agg(case when members ? (x.v->>'id') then x.v||(members->(x.v->>'id')) else x.v end order by x.ord)
  from jsonb_array_elements(qs) with ordinality x(v,ord)));
end; $$;
revoke all on function gina.link_ai_shared_sources(uuid,jsonb) from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 2a) Soru düzeyinde dönem/program izi (yalnız sunucu yazar; bir kez yazılır)
-- ---------------------------------------------------------------------------
create table gina.question_period_tags (
 question_id uuid primary key references public.question_bank(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 term smallint check(term between 1 and 2),
 program text check(program is null or length(btrim(program)) between 1 and 80),
 source text not null check(source in('draft','catalogue','parent')),
 created_at timestamptz not null default now(),
 check(term is not null or program is not null)
);
create index question_period_tags_family on gina.question_period_tags(family_id);
alter table gina.question_period_tags enable row level security;
revoke all on gina.question_period_tags from public,anon,authenticated,service_role;
create function gina.guard_question_period_tag() returns trigger language plpgsql set search_path='' as $$
begin
 -- Yalnız soru ya da aile silinirken (kademeli silme) düşer; iz sonradan değiştirilmez.
 if tg_op='DELETE' and (not exists(select 1 from public.question_bank where id=old.question_id)
  or not exists(select 1 from public.families where id=old.family_id)) then return old; end if;
 raise exception 'question_period_immutable';
end; $$;
revoke all on function gina.guard_question_period_tag() from public,anon,authenticated,service_role;
create trigger question_period_tag_guard before update or delete on gina.question_period_tags
for each row execute function gina.guard_question_period_tag();

create function gina.tag_question_period(p_question uuid,p_family uuid,p_term int,p_program text,p_source text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_term is not null and p_term not in(1,2) then p_term:=null; end if;
 p_program:=nullif(btrim(coalesce(p_program,'')),'');
 if p_program is not null and length(p_program)>80 then p_program:=null; end if;
 if p_term is null and p_program is null then return; end if;
 insert into gina.question_period_tags(question_id,family_id,term,program,source) values(p_question,p_family,p_term,p_program,p_source)
 on conflict(question_id) do nothing;
end; $$;
revoke all on function gina.tag_question_period(uuid,uuid,int,text,text) from public,anon,authenticated,service_role;

-- AI satırları: katalog adayının dönemi (varsa), yoksa üretimin bağlı olduğu taslağın dönem/programı.
create function gina.tag_ai_generation_periods(p_family uuid,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in
  select q.id,
   case when q.provenance#>>'{blueprint,candidate,term}' in('1','2') then (q.provenance#>>'{blueprint,candidate,term}')::int
        when d.content#>>'{context,term}' in('1','2') then (d.content#>>'{context,term}')::int end term,
   d.content#>>'{context,program}' program,
   case when q.provenance#>>'{blueprint,candidate,term}' in('1','2') then 'catalogue' else 'draft' end src
  from jsonb_array_elements(coalesce(p_result->'questions','[]'::jsonb)) x(v)
  join public.question_bank q on q.id=(x.v->>'id')::uuid and q.family_id=p_family
  left join public.prova_drafts d on d.family_id=p_family
   and d.id=case when q.provenance->>'draft_id' ~ '^[0-9a-fA-F-]{36}$' then (q.provenance->>'draft_id')::uuid end
 loop
  perform gina.tag_question_period(r.id,p_family,r.term,r.program,r.src);
 end loop;
end; $$;
revoke all on function gina.tag_ai_generation_periods(uuid,jsonb) from public,anon,authenticated,service_role;

-- Gövde 20261106290000 ile aynı; tamamlanan sonuç ortak kaynak grubuna bağlanır ve dönem izi yazılır.
create or replace function public.complete_prova_generation_v2(p_id uuid,p_lease uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input int,p_output int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; a record; remaining int; take int; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into j.family_id from public.prova_generation_jobs where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(j.family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.lease is distinct from p_lease or p_lease is null then raise exception 'lease_lost'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or j.provider_result is null or coalesce(jsonb_typeof(p_rows),'null')<>'array' or jsonb_array_length(p_rows)<>j.items then raise exception 'invalid_generation'; end if;
 remaining:=jsonb_array_length(p_rows);
 for a in select * from public.generation_credit_allocations where job_id=p_id order by grant_id nulls first loop
 take:=least(remaining,a.units); update public.generation_credit_allocations set consumed=take where id=a.id; remaining:=remaining-take; end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 v_result:=public.complete_prova_generation(p_id,p_rows,p_model,p_prompt_version,p_input,p_output);
 -- D1: bağlı sorular tek ortak kaynak grubu olur (aynı işlem; yarım grup kalmaz).
 v_result:=gina.link_ai_shared_sources(j.family_id,v_result);
 perform gina.tag_ai_generation_periods(j.family_id,v_result);
 v_result:=jsonb_set(v_result,'{remaining}',to_jsonb((public.get_prova_entitlement(j.family_id)->>'ai_generate_remaining')::int));
 update public.prova_generation_jobs set result=v_result where id=p_id;
 perform gina.ai_provider_outcome(j.provider, true, null, false);
 return v_result;
end; $$;

-- Elle yazılan soru: isteğe bağlı `term` (1|2|null) ve `program` (metin|null). Gövde 20261106240000 ile aynı.
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
 -- D1: dönem/program yalnız bilinen şekilde (aksi halde ret; sessizce yok sayılmaz).
 if coalesce(jsonb_typeof(p_question->'term'),'null') not in('null','number') or ((p_question->>'term') is not null and (p_question->>'term') not in('1','2'))
 or coalesce(jsonb_typeof(p_question->'program'),'null') not in('null','string') or ((p_question->>'program') is not null and length(btrim(p_question->>'program')) not between 1 and 80)
 then raise exception 'question_period_invalid'; end if;
 rubric:=case when jsonb_typeof(p_question->'rubric')='null' then null else p_question->'rubric' end;
 if rubric is not null and (q.kind<>'open_ended' or not gina.valid_question_rubric(rubric)) then raise exception 'question_rubric_invalid'; end if;
 if rubric is not null and jsonb_array_length(rubric->'criteria')=0 and jsonb_array_length(rubric->'alternative_answers')=0 then rubric:=null; end if;
 insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
 values(p_request_id,f,q.grade,trim(q.subject),trim(q.topic),q.scenario_code,q.kind,q.difficulty,trim(q.stem),q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,
  jsonb_build_object('generator','parent')||case when rubric is null then '{}'::jsonb else jsonb_build_object('rubric',rubric) end,auth.uid());
 perform gina.tag_question_period(p_request_id,f,(p_question->>'term')::int,p_question->>'program','parent');
 for image in select value from jsonb_array_elements(p_images) loop
  perform public.attach_question_source(p_request_id,(image->>'source_id')::uuid,image->>'alt');
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_question',payload,jsonb_build_object('id',p_request_id));
 return p_request_id;
end; $$;
revoke all on function public.save_question_with_sources(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_question_with_sources(uuid,jsonb,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b) Taslak: isteğe bağlı `fitAccepted` (velinin dönem/program farkını açıkça kabul ettiği soru kimlikleri)
-- ---------------------------------------------------------------------------
create or replace function gina.validate_prova_draft(f uuid,c jsonb) returns void language plpgsql security definer set search_path='' as $$
declare req text[]:=array['childId','grade','title','purpose','format','subjects','topics','target','minutes','difficulty','kind','note','step','blocks'];
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>100000
 or not(c ?& req)
 or c-req-'context'-'fitAccepted'<>'{}'::jsonb
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
 if c ? 'fitAccepted' and (jsonb_typeof(c->'fitAccepted')<>'array' or jsonb_array_length(c->'fitAccepted')>200
  or exists(select 1 from jsonb_array_elements(c->'fitAccepted') v where jsonb_typeof(v)<>'string'
    or (v#>>'{}') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
  or jsonb_array_length(c->'fitAccepted')<>(select count(distinct v#>>'{}') from jsonb_array_elements(c->'fitAccepted') v))
 then raise exception 'invalid_input'; end if;
 if c->>'childId' is not null and not exists(select 1 from public.children where id=(c->>'childId')::uuid and family_id=f) then raise exception 'forbidden' using errcode='42501'; end if;
 perform gina.validate_prova_context(f,c);
 perform gina.prova_draft_questions(f,c);
end; $$;
revoke all on function gina.validate_prova_draft(uuid,jsonb) from public,anon,authenticated;

-- Taslak bağlamıyla uyuşmayan sorular (kabul edilenler hariç). İstemci aynı kuralı core'da gösterir.
create function gina.prova_period_mismatches(c jsonb,ids uuid[]) returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(t.question_id order by t.question_id),'{}'::uuid[])
 from gina.question_period_tags t
 where t.question_id=any(ids) and c->'context' is not null
  and not (coalesce(c->'fitAccepted','[]'::jsonb) ? t.question_id::text)
  and ((t.term is not null and (c#>>'{context,term}') is not null and t.term<>(c#>>'{context,term}')::int)
   or (t.program is not null and (c#>>'{context,program}') is not null
       and gina.normalize_subject_alias(t.program)<>gina.normalize_subject_alias(c#>>'{context,program}')))
$$;
revoke all on function gina.prova_period_mismatches(jsonb,uuid[]) from public,anon,authenticated,service_role;

alter table public.exams add column subject_links jsonb;
comment on column public.exams.subject_links is 'D1: gönderim anındaki ders metni → veli onaylı katalog kimliği (C02 child_subject_links); metin aynen, kimlik yoksa null.';
create function gina.guard_exam_subject_links() returns trigger language plpgsql set search_path='' as $$
begin
 if old.content_locked_at is not null and new.subject_links is distinct from old.subject_links then raise exception 'exam_content_locked'; end if;
 return new;
end; $$;
revoke all on function gina.guard_exam_subject_links() from public,anon,authenticated;
create trigger exam_subject_links_guard before update on public.exams for each row execute function gina.guard_exam_subject_links();

-- Gövde 20261106240000 ile aynı; dönem/program uyuşmazlığı ve ders kimliği anlık görüntüsü eklendi.
create or replace function public.submit_prova_draft(p_request_id uuid,p_id uuid,p_version int) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;d public.prova_drafts;c jsonb;x jsonb;ids uuid[];subjects text[];payload jsonb;ch public.children;
 cur gina.child_education_periods; links jsonb;
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
 if c->>'format'='meb' then raise exception 'prova_verified_scope_required'; end if;
 ids:=gina.prova_draft_questions(f,c);
 if cardinality(ids)<>(c->>'target')::int then raise exception 'prova_question_count'; end if;
 select array_agg(v) into subjects from jsonb_array_elements_text(c->'subjects')v;
 if coalesce(cardinality(subjects),0)=0 then raise exception 'prova_scope_required'; end if;
 if x is not null then
  if x->>'scope'='subject' and cardinality(subjects)<>1 then raise exception 'prova_scope_subject_count'; end if;
  if x->>'track'='lgs' and (c->>'grade')::int<>8 then raise exception 'prova_track_grade'; end if;
  select * into cur from gina.child_education_periods where child_id=ch.id and ends_on is null;
  if (x->>'periodId') is not null and (cur.id is null or cur.id<>(x->>'periodId')::uuid
     or coalesce(cur.school,'')<>coalesce(x->>'school','')
     or ((x->>'academicYear') is not null and cur.academic_year<>(x->>'academicYear')::int))
  then raise exception 'prova_child_period_changed'; end if;
  -- D1: soru düzeyinde dönem/program; veli kabul etmediyse gönderim durur.
  if cardinality(gina.prova_period_mismatches(c,ids))>0 then raise exception 'prova_question_period_mismatch'; end if;
 end if;
 perform 1 from public.question_bank where id=any(ids) order by id for update;
 if exists(select 1 from public.question_bank where id=any(ids) and (grade<>(c->>'grade')::int or not(subject=any(subjects)))) then raise exception 'prova_question_scope'; end if;
 if exists(select 1 from public.question_bank where id=any(ids) and (length(trim(stem))=0 or (kind='open_ended' and length(trim(coalesce(expected_answer,'')))=0) or (kind='multiple_choice' and (correct_key is null or not exists(select 1 from jsonb_array_elements(choices)v where v->>'key'=correct_key))))) then raise exception 'prova_answer_required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('title',s,'subject_id',k.subject_id) order by o),'[]'::jsonb) into links
 from unnest(subjects) with ordinality u(s,o)
 left join gina.child_subject_links k on k.child_id=ch.id and k.alias_normalized=gina.normalize_subject_alias(s);
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by,preparation,
  exam_scope,assessment_track,term,academic_year,education_period_id,school_declared,subject_links)
 values(d.id,f,ch.id,trim(c->>'title'),array_to_string(subjects,' / '),(c->>'grade')::int,ids,c->>'minutes' is not null,(c->>'minutes')::int,'assigned',auth.uid(),c,
  x->>'scope',x->>'track',(x->>'term')::smallint,(x->>'academicYear')::int,(x->>'periodId')::uuid,(x->>'schoolDeclared')::boolean,links);
 update public.prova_drafts set exam_id=d.id,submitted_at=now(),updated_at=now() where id=d.id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'submit_prova_draft',payload,jsonb_build_object('id',d.id));
 return d.id;
end; $$;
revoke all on function public.submit_prova_draft(uuid,uuid,int) from public,anon;
grant execute on function public.submit_prova_draft(uuid,uuid,int) to authenticated;

-- Hazırlayıcı okuması: soruların dönem/program izi + ders metninin çocuğun veli onaylı katalog kimliği.
create function public.get_prova_question_fit(p_child_id uuid,p_question_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true
 or p_child_id is null or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'forbidden' using errcode='42501'; end if;
 if p_question_ids is null or cardinality(p_question_ids)>200 then raise exception 'invalid_input'; end if;
 return jsonb_build_object('child_id',p_child_id,'subjects',gina.subject_links_json(p_child_id),
  'questions',(select coalesce(jsonb_agg(jsonb_build_object('question_id',q.id,'subject',q.subject,
     'subject_id',o.id,'subject_label_tr',o.label_tr,'subject_label_en',o.label_en,
     'term',t.term,'program',t.program,'period_source',t.source) order by q.id),'[]'::jsonb)
   from public.question_bank q
   left join gina.question_period_tags t on t.question_id=q.id
   left join gina.child_subject_links k on k.child_id=p_child_id and k.alias_normalized=gina.normalize_subject_alias(q.subject)
   left join public.guided_input_options o on o.id=k.subject_id and o.kind='subject'
   where q.id=any(p_question_ids) and (q.family_id=f or q.family_id is null)));
end; $$;
revoke all on function public.get_prova_question_fit(uuid,uuid[]) from public,anon;
grant execute on function public.get_prova_question_fit(uuid,uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) C05 soru-kazanım uygunluğu: veli inceleme listesi
-- ---------------------------------------------------------------------------
create function public.list_scenario_question_fit(p_state text default 'pending',p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam uuid:=gina.family_id(); rows jsonb;
begin
 if not gina.is_parent() or fam is null or auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_state is null or p_state not in('pending','reviewed','all') or p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_input'; end if;
 select coalesce(jsonb_agg(item order by created_at, qid),'[]'::jsonb) into rows from (
  select f.created_at, f.question_id qid, gina.scenario_fit_projection(f)||jsonb_build_object(
   'stem',coalesce(m.prompt,q.stem),'topic',q.topic,'subject',q.subject,'grade',q.grade,'kind',q.kind,'choices',q.choices,
   'shared',case when g.id is null then null else jsonb_build_object('group_id',g.id,'title',g.title,'body',g.body,'position',m.position) end,
   'scenario_version',q.provenance->>'scenario_version',
   'outcomes',(select coalesce(jsonb_agg(jsonb_build_object('id',oid.v,'text',
       (select o->>'text' from jsonb_array_elements(q.provenance#>'{blueprint,learning_blocks}') b
          cross join jsonb_array_elements(b->'outcomes') o
         where jsonb_typeof(q.provenance#>'{blueprint,learning_blocks}')='array' and b->>'block_id'=f.block_id
           and coalesce(nullif(btrim(o->>'code'),''),'cell:'||(o->>'cell'))=oid.v limit 1)) order by oid.ord),'[]'::jsonb)
     from jsonb_array_elements_text(f.outcome_ids) with ordinality oid(v,ord)),
   'exams',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'status',e.status) order by e.created_at desc),'[]'::jsonb)
     from (select e.id,e.title,e.status,e.created_at from public.exams e where e.family_id=fam and f.question_id=any(e.question_ids) order by e.created_at desc limit 3) e)
  ) item
  from gina.scenario_question_fit f
  join public.question_bank q on q.id=f.question_id
  left join public.question_source_members m on m.question_id=q.id
  left join public.question_source_groups g on g.id=m.group_id
  where f.family_id=fam and (p_state='all' or (p_state='pending')=(f.decision='pending_human_review'))
  order by f.created_at, f.question_id limit p_limit
 ) x;
 return jsonb_build_object('items',rows,'summary',(select jsonb_build_object(
   'total',count(*),'pending_human_review',count(*) filter(where decision='pending_human_review'),
   'fit',count(*) filter(where decision='fit'),'not_fit',count(*) filter(where decision='not_fit'),
   'needs_revision',count(*) filter(where decision='needs_revision'))
  from gina.scenario_question_fit where family_id=fam));
end; $$;
revoke all on function public.list_scenario_question_fit(text,int) from public,anon,service_role;
grant execute on function public.list_scenario_question_fit(text,int) to authenticated;
