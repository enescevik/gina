-- QT00 — sürümlü RPC sözleşmeleri. Eski v1/v2/v3 imzaları korunur; yapılandırılmış soruda
-- eski yol açık 'client_update_required' hatası verir (sessiz boş ekran / serbest metin fallback'i yok).

-- 0) Numerik soruda isteğe bağlı çalışma alanı (defter) bayrağı payload'a eklenir.
create or replace function gina.qt_numeric_payload_ok(p jsonb) returns boolean
language sql immutable set search_path to '' as $$
  select gina.qt_only_keys(p, array['units', 'unit_required', 'work_area'])
     and coalesce(jsonb_typeof(p->'work_area'), 'boolean') = 'boolean'
$$;
-- qt_content_errors numerik dalı 'work_area' alanını da kabul etsin: üst sarmalayıcı.
create function gina.qt_question_errors(p_type text, p_version int, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
begin
  if p_type = 'numeric' and jsonb_typeof(p_payload) = 'object' then
    if not gina.qt_numeric_payload_ok(p_payload) then return array['payload_unknown_field']; end if;
    return gina.qt_content_errors(p_type, p_version, p_payload - 'work_area', p_key);
  end if;
  return gina.qt_content_errors(p_type, p_version, p_payload, p_key);
end $$;

create or replace function gina.check_structured_question() returns trigger
language plpgsql security definer set search_path to '' as $$
declare qid uuid; q public.question_bank; k public.question_answer_keys; t public.interaction_types; errs text[];
begin
  if tg_table_name = 'question_bank' then qid := new.id; else qid := new.question_id; end if;
  select * into q from public.question_bank where id = qid;
  if q.id is null then return null; end if;
  select * into k from public.question_answer_keys where question_id = qid;
  if q.kind <> 'structured' then
    if k.question_id is not null then raise exception 'answer_key_for_legacy_question'; end if;
    return null;
  end if;
  if k.question_id is null then raise exception 'structured_key_missing'; end if;
  select * into t from public.interaction_types where type = q.interaction_type;
  if t.type is null or t.family <> 'structured' then raise exception 'interaction_type_unavailable'; end if;
  if k.interaction_type <> q.interaction_type or k.schema_version <> q.schema_version or q.schema_version <> t.schema_version
     or k.policy <> t.policy or k.policy_version <> t.policy_version or k.family_id is distinct from q.family_id then
    raise exception 'structured_key_mismatch';
  end if;
  errs := gina.qt_question_errors(q.interaction_type, q.schema_version, q.payload, k.key);
  if cardinality(errs) > 0 then raise exception 'question_structure_invalid' using detail = array_to_string(errs, ','); end if;
  if k.content_hash <> gina.qt_content_hash(q.stem, q.interaction_type, q.schema_version, q.payload, k.key, k.policy, k.policy_version, k.points) then
    raise exception 'structured_hash_mismatch';
  end if;
  return null;
end $$;

create or replace function gina.qt_student_payload_v1(p_type text, p_payload jsonb, p_key jsonb, p_seed text) returns jsonb
language sql immutable set search_path to '' as $$
  select gina.qt_student_payload(p_type, case when p_type = 'numeric' then p_payload - 'work_area' else p_payload end, p_key, p_seed)
    || case when p_type = 'numeric' then jsonb_build_object('work_area', coalesce((p_payload->>'work_area')::boolean, false)) else '{}'::jsonb end
$$;

-- 1) Yapılandırılmış soru + anahtar ekleme yardımcısı (tek yol: elle, AI, düzenleme) -----------------
create function gina.qt_insert_structured(p_id uuid, p_family uuid, p_row jsonb, p_provenance jsonb, p_actor uuid) returns uuid
language plpgsql security definer set search_path to '' as $$
declare t public.interaction_types; v int; payload jsonb; key jsonb; points numeric; errs text[]; stem text;
begin
  select * into t from public.interaction_types where type = p_row->>'interaction_type';
  if t.type is null or t.family <> 'structured' or not t.enabled then raise exception 'interaction_type_unavailable'; end if;
  v := coalesce((p_row->>'schema_version')::int, t.schema_version);
  if v <> t.schema_version then raise exception 'schema_version_unsupported'; end if;
  payload := p_row->'payload'; key := p_row->'answer_key';
  points := coalesce((p_row->>'points')::numeric, 1);
  if points <= 0 or points > 100 then raise exception 'question_points_invalid'; end if;
  errs := gina.qt_question_errors(t.type, v, payload, key);
  if cardinality(errs) > 0 then raise exception 'question_structure_invalid' using detail = array_to_string(errs, ','); end if;
  stem := btrim(p_row->>'stem');
  insert into public.question_answer_keys(question_id, family_id, interaction_type, schema_version, key, policy, policy_version, points, content_hash)
  values (p_id, p_family, t.type, v, key, t.policy, t.policy_version, points,
    gina.qt_content_hash(stem, t.type, v, payload, key, t.policy, t.policy_version, points));
  insert into public.question_bank(id, family_id, grade, subject, topic, scenario_code, kind, interaction_type, schema_version, payload,
    difficulty, stem, expected_answer, solution, explanation, source_urls, provenance, created_by)
  values (p_id, p_family, (p_row->>'grade')::smallint, btrim(p_row->>'subject'), btrim(p_row->>'topic'), nullif(btrim(coalesce(p_row->>'scenario_code', '')), ''),
    'structured', t.type, v, payload, (p_row->>'difficulty')::public.question_difficulty, stem,
    nullif(btrim(coalesce(p_row->>'expected_answer', '')), ''), nullif(btrim(coalesce(p_row->>'solution', '')), ''),
    nullif(btrim(coalesce(p_row->>'explanation', '')), ''),
    coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(p_row->'source_urls') = 'array' then p_row->'source_urls' else '[]' end)), '{}'),
    p_provenance, p_actor);
  return p_id;
end $$;
revoke all on function gina.qt_insert_structured(uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;

-- 2) Elle hazırlama: save_question_with_sources yapılandırılmış türleri de yazar (aynı makbuz/idempotency).
create or replace function public.save_question_with_sources(p_request_id uuid, p_question jsonb, p_images jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare f uuid:=gina.family_id();q public.question_bank;r public.mutation_receipts;payload jsonb;image jsonb;rubric jsonb;structured boolean;
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
 structured:=coalesce(p_question->>'interaction_type','') not in ('','multiple_choice','open_ended');
 if structured and (p_question ? 'choices' and jsonb_typeof(p_question->'choices')<>'null' or p_question ? 'correct_key' and jsonb_typeof(p_question->'correct_key')<>'null'
   or coalesce(p_question->>'kind','structured')<>'structured') then raise exception 'question_incomplete'; end if;
 if not structured and (p_question ? 'payload' and jsonb_typeof(p_question->'payload')<>'null' or p_question ? 'answer_key' and jsonb_typeof(p_question->'answer_key')<>'null')
 then raise exception 'question_incomplete'; end if;
 if not structured and p_question ? 'interaction_type' and p_question->>'interaction_type' is distinct from p_question->>'kind' then raise exception 'question_incomplete'; end if;
 q:=jsonb_populate_record(null::public.question_bank,(p_question-'interaction_type'-'schema_version'-'payload')||case when structured then jsonb_build_object('kind','structured') else '{}'::jsonb end);
 if q.grade is null or q.grade not between 1 and 12 or length(trim(coalesce(q.subject,''))) not between 1 and 80
 or length(trim(coalesce(q.topic,''))) not between 1 and 200 or length(trim(coalesce(q.stem,''))) not between 5 and 10000 or q.kind is null or q.difficulty is null
 or length(coalesce(q.expected_answer,''))>10000 or length(coalesce(q.solution,''))>10000 or length(coalesce(q.explanation,''))>10000 then raise exception 'question_incomplete'; end if;
 if q.kind='multiple_choice' and (jsonb_typeof(q.choices) is distinct from 'array' or jsonb_array_length(q.choices)<>4 or
 (select count(distinct c->>'key') from jsonb_array_elements(q.choices)c where c->>'key' in('A','B','C','D') and length(trim(coalesce(c->>'text',''))) between 1 and 5000)<>4 or coalesce(q.correct_key,'') not in('A','B','C','D')) then raise exception 'question_incomplete'; end if;
 if coalesce(jsonb_typeof(p_question->'term'),'null') not in('null','number') or ((p_question->>'term') is not null and (p_question->>'term') not in('1','2'))
 or coalesce(jsonb_typeof(p_question->'program'),'null') not in('null','string') or ((p_question->>'program') is not null and length(btrim(p_question->>'program')) not between 1 and 80)
 then raise exception 'question_period_invalid'; end if;
 rubric:=case when jsonb_typeof(p_question->'rubric')='null' then null else p_question->'rubric' end;
 if rubric is not null and (q.kind<>'open_ended' or not gina.valid_question_rubric(rubric)) then raise exception 'question_rubric_invalid'; end if;
 if rubric is not null and jsonb_array_length(rubric->'criteria')=0 and jsonb_array_length(rubric->'alternative_answers')=0 then rubric:=null; end if;
 if structured then
  perform gina.qt_insert_structured(p_request_id,f,p_question||jsonb_build_object('source_urls','[]'::jsonb),jsonb_build_object('generator','parent'),auth.uid());
 else
  insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
  values(p_request_id,f,q.grade,trim(q.subject),trim(q.topic),q.scenario_code,q.kind,q.difficulty,trim(q.stem),q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,
   jsonb_build_object('generator','parent')||case when rubric is null then '{}'::jsonb else jsonb_build_object('rubric',rubric) end,auth.uid());
 end if;
 perform gina.tag_question_period(p_request_id,f,(p_question->>'term')::int,p_question->>'program','parent');
 for image in select value from jsonb_array_elements(p_images) loop
  perform public.attach_question_source(p_request_id,(image->>'source_id')::uuid,image->>'alt');
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_question',payload,jsonb_build_object('id',p_request_id));
 return p_request_id;
end; $function$;

-- 3) AI üretimi: aynı şemaya yazar; anahtar özel tabloya ayrılır. Geçersiz yapı işlemin tamamını reddeder.
create or replace function public.complete_prova_generation(p_id uuid, p_rows jsonb, p_model text, p_prompt_version text, p_input integer, p_output integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare j public.prova_generation_jobs; v_result jsonb; questions jsonb:='[]'; ent jsonb; row jsonb; qid uuid; q public.question_bank;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.id is null then raise exception 'generation_not_found'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>j.items then raise exception 'invalid_generation'; end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  qid:=gen_random_uuid();
  if coalesce(row->>'interaction_type','') not in ('','multiple_choice','open_ended') then
   perform gina.qt_insert_structured(qid,j.family_id,row,coalesce(row->'provenance','{}'::jsonb),j.requested_by);
  else
   if row ? 'payload' or row ? 'answer_key' then raise exception 'invalid_generation'; end if;
   q:=jsonb_populate_record(null::public.question_bank,row-'interaction_type'-'schema_version');
   insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,source_urls,provenance,created_by)
   values(qid,j.family_id,q.grade,q.subject,q.topic,q.scenario_code,q.kind,q.difficulty,q.stem,q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,coalesce(q.source_urls,'{}'),coalesce(q.provenance,'{}'::jsonb),j.requested_by);
  end if;
  select * into q from public.question_bank where id=qid;
  -- Eski türlerde sonuç alanları birebir korunur; yapılandırılmışta tür/payload/anahtar eklenir (yalnız veliye dönen iş sonucu).
  questions:=questions||jsonb_build_array(jsonb_build_object('id',q.id,'topic',q.topic,'kind',q.kind,
   'difficulty',q.difficulty,'stem',q.stem,'choices',q.choices,'correct_key',q.correct_key,'expected_answer',q.expected_answer,
   'solution',q.solution,'explanation',q.explanation,'source_urls',q.source_urls)
   ||case when q.kind='structured' then jsonb_build_object('interaction_type',q.interaction_type,'schema_version',q.schema_version,'payload',q.payload,
       'answer_key',(select k.key from public.question_answer_keys k where k.question_id=q.id)) else '{}'::jsonb end);
 end loop;
 insert into public.prova_ai_usage(family_id,action,model,items,input_tokens,output_tokens,requested_by)
 values(j.family_id,'generate',p_model,jsonb_array_length(questions),p_input,p_output,j.requested_by);
 ent:=public.get_prova_entitlement(j.family_id);
 v_result:=jsonb_build_object('ok',true,'model',p_model,'prompt_version',p_prompt_version,'remaining',greatest(0,(ent->>'ai_generate_limit')::int-(ent->>'ai_generate_used')::int),'questions',questions);
 update public.prova_generation_jobs set status='done',result=v_result,updated_at=now() where id=j.id;
 return v_result;
end; $function$;

-- AI düzenleme (save_ai_question_edit) bu fazda yapılandırılmış soruyu açıkça reddeder (eksik alanla kopya yok).
create or replace function gina.ai_edit_question_fields(p jsonb, p_max_stem integer, p_need_solution boolean)
returns jsonb language plpgsql immutable set search_path to '' as $function$
declare q public.question_bank; rubric jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid_input'; end if;
 if p->>'kind'='structured' or coalesce(p->>'interaction_type','') not in ('','multiple_choice','open_ended') then raise exception 'ai_edit_structured_unsupported'; end if;
 q:=jsonb_populate_record(null::public.question_bank,p);
 if length(btrim(coalesce(q.topic,''))) not between 1 and 200 or length(btrim(coalesce(q.stem,''))) not between 5 and p_max_stem
 or q.kind is null or q.difficulty is null
 or length(coalesce(q.expected_answer,''))>10000 or length(coalesce(q.solution,''))>10000 or length(coalesce(q.explanation,''))>10000
 or length(coalesce(q.scenario_code,''))>80
 or (q.kind='open_ended' and length(btrim(coalesce(q.expected_answer,'')))=0)
 or (p_need_solution and length(btrim(coalesce(q.solution,'')))=0) then raise exception 'question_incomplete'; end if;
 if q.kind='multiple_choice' and (jsonb_typeof(q.choices) is distinct from 'array' or jsonb_array_length(q.choices)<>4 or
  (select count(distinct c->>'key') from jsonb_array_elements(q.choices)c where c->>'key' in('A','B','C','D') and length(btrim(coalesce(c->>'text',''))) between 1 and 5000)<>4
  or coalesce(q.correct_key,'') not in('A','B','C','D')) then raise exception 'question_incomplete'; end if;
 rubric:=case when jsonb_typeof(p->'rubric')='null' then null else p->'rubric' end;
 if rubric is not null and (q.kind<>'open_ended' or not gina.valid_question_rubric(rubric)) then raise exception 'question_rubric_invalid'; end if;
 if rubric is not null and jsonb_array_length(rubric->'criteria')=0 and jsonb_array_length(rubric->'alternative_answers')=0 then rubric:=null; end if;
 return jsonb_build_object(
  'topic',btrim(q.topic),'scenario_code',nullif(btrim(coalesce(q.scenario_code,'')),''),'kind',q.kind,'difficulty',q.difficulty,
  'stem',btrim(q.stem),
  'choices',case when q.kind='multiple_choice' then (select jsonb_agg(jsonb_build_object('key',k,'text',
     (select btrim(c->>'text') from jsonb_array_elements(q.choices)c where c->>'key'=k limit 1)) order by k)
     from unnest(array['A','B','C','D']) k) end,
  'correct_key',case when q.kind='multiple_choice' then q.correct_key end,
  'expected_answer',case when q.kind='open_ended' then btrim(q.expected_answer) end,
  'solution',nullif(btrim(coalesce(q.solution,'')),''),
  'explanation',nullif(btrim(coalesce(q.explanation,'')),''),
  'rubric',rubric);
end; $function$;

-- 4) Öğrenci soru listesi -----------------------------------------------------------------------
-- Eski istemci: yapılandırılmış soru varsa açık uyumsuzluk hatası.
create or replace function public.get_attempt_questions(p_exam_id uuid)
returns table(id uuid, kind public.question_kind, difficulty public.question_difficulty, stem text, choices jsonb, ord integer)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if exists(select 1 from public.exams e join public.question_bank q on q.id=any(e.question_ids)
   where e.id=p_exam_id and e.family_id=gina.family_id() and q.kind='structured') then
  raise exception 'client_update_required' using errcode='P0001', hint='get_attempt_questions_v2';
 end if;
 return query
 select q.id,q.kind,q.difficulty,q.stem,
 case when q.kind='multiple_choice' then (select jsonb_agg(jsonb_build_object('key',c->>'key','text',c->>'text')) from jsonb_array_elements(q.choices)c) else null end,u.ord::int
 from public.exams e join unnest(e.question_ids) with ordinality u(qid,ord) on true
 join public.question_bank q on q.id=u.qid and (q.family_id=e.family_id or q.family_id is null)
 join public.children ch on ch.id=e.child_id and ch.family_id=e.family_id
 where e.id=p_exam_id and e.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and e.child_id=gina.child_id())) and e.status in('assigned','completed') order by u.ord;
end;$function$;

-- Yeni istemci: desteklediği tür listesini bildirir; desteklenmeyen tür varsa açık hata.
create function public.get_attempt_questions_v2(p_exam_id uuid, p_supported text[])
returns table(id uuid, kind public.question_kind, interaction_type text, schema_version smallint, difficulty public.question_difficulty,
  stem text, choices jsonb, payload jsonb, ord integer)
language plpgsql security definer set search_path to '' as $function$
declare missing text[];
begin
 if p_supported is null or cardinality(p_supported)>40 then raise exception 'invalid_input'; end if;
 if gina.is_device() then
  update public.devices d set question_types=(select array_agg(distinct x order by x) from unnest(p_supported) x where x ~ '^[a-z_]{3,32}$'), question_types_at=now()
  where d.auth_user_id=auth.uid() and d.revoked_at is null and d.question_types is distinct from (select array_agg(distinct x order by x) from unnest(p_supported) x where x ~ '^[a-z_]{3,32}$');
 end if;
 select array_agg(distinct gina.question_interaction(q.kind,q.interaction_type)) into missing
 from public.exams e join public.question_bank q on q.id=any(e.question_ids)
 where e.id=p_exam_id and e.family_id=gina.family_id() and not (gina.question_interaction(q.kind,q.interaction_type)=any(p_supported));
 if missing is not null then raise exception 'client_update_required' using errcode='P0001', detail=array_to_string(missing,','); end if;
 return query
 select q.id,q.kind,gina.question_interaction(q.kind,q.interaction_type),coalesce(q.schema_version,1::smallint),q.difficulty,q.stem,
  case when q.kind='multiple_choice' then (select jsonb_agg(jsonb_build_object('key',c->>'key','text',c->>'text')) from jsonb_array_elements(q.choices)c) end,
  case when q.kind='structured' then gina.qt_student_payload_v1(q.interaction_type,q.payload,k.key,e.id::text||':'||q.id::text) end,
  u.ord::int
 from public.exams e join unnest(e.question_ids) with ordinality u(qid,ord) on true
 join public.question_bank q on q.id=u.qid and (q.family_id=e.family_id or q.family_id is null)
 left join public.question_answer_keys k on k.question_id=q.id
 join public.children ch on ch.id=e.child_id and ch.family_id=e.family_id
 where e.id=p_exam_id and e.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and e.child_id=gina.child_id())) and e.status in('assigned','completed') order by u.ord;
end;$function$;
revoke all on function public.get_attempt_questions_v2(uuid, text[]) from public, anon;
grant execute on function public.get_attempt_questions_v2(uuid, text[]) to authenticated;

-- 5) Cevap kaydı ----------------------------------------------------------------------------------
-- Temel yol: yapılandırılmış soruya yalnız v4 içinden yazılabilir (eski cihaz eksik alanla ezemez).
create or replace function public.submit_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer_key text default null, p_answer_text text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
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
  if v_question.kind = 'structured' then
    raise exception 'client_update_required' using errcode = 'P0001';
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
$function$;

create function public.submit_exam_answer_v4(p_request_id uuid, p_attempt_id uuid, p_question_id uuid, p_expected_revision integer,
  p_answer_key text default null, p_answer_text text default null, p_answer_document jsonb default null, p_answer jsonb default null)
returns integer language plpgsql security definer set search_path to '' as $function$
declare a public.exam_attempts;r public.mutation_receipts;body jsonb;revision int;f uuid:=gina.family_id();q public.question_bank;errs text[];
begin
 if f is null or not(gina.is_parent() or gina.is_device()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or coalesce(length(p_answer_text),0)>20000
  or not gina.valid_answer_document(p_answer_document) or coalesce(length(p_answer::text),0)>8000 then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=f for update;
 if a.id is null then raise exception 'attempt_not_found';end if;
 if gina.is_device() and a.child_id is distinct from gina.child_id() then raise exception 'forbidden' using errcode='42501';end if;
 body:=jsonb_build_object('attempt',p_attempt_id,'question',p_question_id,'revision',p_expected_revision,'key',p_answer_key,'text',p_answer_text,'document',p_answer_document,'answer',p_answer);
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'exam_answer_v4' or r.payload<>body then raise exception 'request_conflict';end if;
  select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
  if revision is distinct from (r.result->>'revision')::int then raise exception 'answer_changed';end if;
  return revision;
 end if;
 select qb.* into q from public.exams e join public.question_bank qb on qb.id=p_question_id where e.id=a.exam_id and qb.id=any(e.question_ids);
 if q.id is null then raise exception 'question_not_in_exam';end if;
 if q.kind='structured' then
  if p_answer_key is not null or p_answer_text is not null then raise exception 'answer_type_mismatch';end if;
  if p_answer_document is not null and not (q.interaction_type='numeric' and coalesce((q.payload->>'work_area')::boolean,false)) then raise exception 'answer_type_mismatch';end if;
  if p_answer is not null then
   errs:=gina.qt_answer_errors(q.interaction_type,case when q.interaction_type='numeric' then q.payload-'work_area' else q.payload end,p_answer);
   if cardinality(errs)>0 then raise exception 'invalid_answer' using detail=array_to_string(errs,',');end if;
  end if;
 elsif p_answer is not null then raise exception 'answer_type_mismatch';
 elsif q.kind='multiple_choice' and p_answer_key is not null and p_answer_key not in ('A','B','C','D') then raise exception 'invalid_input';
 end if;
 select coalesce((select edit_revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id),0) into revision;
 if revision<>p_expected_revision then raise exception 'answer_changed';end if;
 -- Tek yazım (tek revizyon artışı). Aktör/oturum/süre/üyelik denetimleri submit_exam_answer ile aynıdır;
 -- grup, arşiv, defter ve referans tetikleyicileri satırda aynen çalışır.
 if a.status<>'in_progress' then raise exception 'attempt_closed' using errcode='P0001';end if;
 if a.deadline_at is not null and now()>a.deadline_at then raise exception 'time_up' using errcode='P0001';end if;
 insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,answer_document,answer,is_correct)
 values(a.id,p_question_id,p_answer_key,p_answer_text,p_answer_document,p_answer,case when q.kind='multiple_choice' then p_answer_key=q.correct_key end)
 on conflict(attempt_id,question_id) do update set answer_key=excluded.answer_key,answer_text=excluded.answer_text,answer_document=excluded.answer_document,
  answer=excluded.answer,is_correct=excluded.is_correct,answered_at=now();
 select edit_revision into revision from public.exam_answers where attempt_id=a.id and question_id=p_question_id;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'exam_answer_v4',body,jsonb_build_object('revision',revision));
 return revision;
end;$function$;
revoke all on function public.submit_exam_answer_v4(uuid, uuid, uuid, integer, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.submit_exam_answer_v4(uuid, uuid, uuid, integer, text, text, jsonb, jsonb) to authenticated;

create function public.get_saved_exam_answers_v4(p_attempt_id uuid)
returns table(question_id uuid, answer_key text, answer_text text, answer_document jsonb, answer jsonb, revision integer)
language sql stable security definer set search_path to '' as $function$
 select ans.question_id,ans.answer_key,ans.answer_text,ans.answer_document,ans.answer,ans.edit_revision
 from public.exam_answers ans join public.exam_attempts a on a.id=ans.attempt_id
 where a.id=p_attempt_id and a.family_id=gina.family_id()
 and (gina.is_parent() or (gina.is_device() and a.child_id=gina.child_id()));
$function$;
revoke all on function public.get_saved_exam_answers_v4(uuid) from public, anon;
grant execute on function public.get_saved_exam_answers_v4(uuid) to authenticated;

-- 6) Veli puanı (yapılandırılmış): otomatik puanı değiştirme gerekçeli ve kayıtlı; AI önerisi ayrı kalır.
create table gina.answer_score_overrides (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  family_id uuid not null references public.families(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  auto_score numeric(7,4),
  previous_score smallint,
  parent_score smallint not null check (parent_score between 0 and 100),
  reason text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index answer_score_overrides_attempt_idx on gina.answer_score_overrides(attempt_id, question_id);
alter table gina.answer_score_overrides enable row level security;
revoke all on gina.answer_score_overrides from public, anon, authenticated;

create function public.set_structured_answer_score(p_request_id uuid, p_attempt_id uuid, p_question_id uuid, p_answer_hash text, p_score smallint, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare f uuid:=gina.family_id(); a public.exam_attempts; ans public.exam_answers; r public.mutation_receipts; payload jsonb; result jsonb; auto numeric; reason text:=nullif(btrim(coalesce(p_reason,'')),'');
 v public.exam_attempts;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_score is null or p_score not between 0 and 100 or coalesce(length(reason),0)>500 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('attempt',p_attempt_id,'question',p_question_id,'hash',p_answer_hash,'score',p_score,'reason',reason);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'structured_score' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 select * into a from public.exam_attempts where id=p_attempt_id and family_id=f for update;
 if a.id is null then raise exception 'attempt_not_found'; end if;
 if a.status='in_progress' then raise exception 'attempt_not_finished'; end if;
 if not exists(select 1 from public.exams e join public.question_bank q on q.id=p_question_id where e.id=a.exam_id and q.id=any(e.question_ids) and q.kind='structured') then
  raise exception 'question_not_structured'; end if;
 select * into ans from public.exam_answers where attempt_id=a.id and question_id=p_question_id for update;
 -- Cevap satırı yoksa beklenen hash NULL (hiç gönderilmemiş madde).
 if (case when ans.attempt_id is null then null else gina.answer_fingerprint(ans) end) is distinct from p_answer_hash then raise exception 'answer_changed'; end if;
 auto:=case when ans.score_details->>'outcome'='scored' then (ans.score_details->>'score')::numeric end;
 -- Otomatik puanı değiştiren veli kararı gerekçe ister.
 if auto is not null and round(auto)<>p_score and coalesce(length(reason),0)<3 then raise exception 'score_reason_required'; end if;
 insert into gina.answer_score_overrides(request_id,family_id,attempt_id,question_id,auto_score,previous_score,parent_score,reason,actor_id)
 values(p_request_id,f,a.id,p_question_id,auto,ans.score,p_score,reason,auth.uid());
 if ans.attempt_id is null then
  insert into public.exam_answers(attempt_id,question_id,score,score_exact,graded_by,graded_at) values(a.id,p_question_id,p_score,p_score,'parent',now());
 else
  update public.exam_answers set score=p_score,score_exact=p_score,graded_by='parent',graded_at=now() where attempt_id=a.id and question_id=p_question_id;
 end if;
 v:=gina.recompute_attempt_totals(a.id);
 result:=jsonb_build_object('score',p_score,'auto_score',auto,'score_pct',v.score_pct,'status',v.status,'provisional',v.provisional);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'structured_score',payload,result);
 return result;
end; $function$;
revoke all on function public.set_structured_answer_score(uuid, uuid, uuid, text, smallint, text) from public, anon;
grant execute on function public.set_structured_answer_score(uuid, uuid, uuid, text, smallint, text) to authenticated;

-- Veli için gerekçe kaydı (kendi ailesi).
create function public.get_structured_score_overrides(p_attempt_id uuid) returns jsonb
language sql stable security definer set search_path to '' as $function$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',o.question_id,'auto_score',o.auto_score,'previous_score',o.previous_score,
   'parent_score',o.parent_score,'reason',o.reason,'created_at',o.created_at) order by o.created_at),'[]'::jsonb)
 from gina.answer_score_overrides o where o.attempt_id=p_attempt_id and o.family_id=gina.family_id() and gina.is_parent();
$function$;
revoke all on function public.get_structured_score_overrides(uuid) from public, anon;
grant execute on function public.get_structured_score_overrides(uuid) to authenticated;

-- 7) Özet: eski alanlar aynen + yeni madde sayaçları + yapılandırılmış madde listesi (veli).
create or replace function public.get_attempt_summary(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  a public.exam_attempts%rowtype;
  v_full boolean;
  v_open_total int; v_open_graded int; v_pending int; v_unanswered int; v_provisional boolean;
  v_open_answers jsonb; v_structured jsonb;
begin
  select * into a from public.exam_attempts x
  where x.id = p_attempt_id
    and ((gina.is_parent() and x.family_id = gina.family_id())
      or (gina.is_device() and x.family_id = gina.family_id() and x.child_id = gina.child_id())
      or gina.is_service());
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0001'; end if;
  v_full := gina.is_parent() or gina.is_service();
  v_open_total := coalesce(a.open_total, 0);
  v_open_graded := coalesce(a.open_graded, 0);
  v_pending := coalesce(a.open_pending, greatest(v_open_total - v_open_graded, 0));
  v_unanswered := coalesce(a.open_unanswered, 0);
  v_provisional := coalesce(a.provisional, v_open_graded < v_open_total);
  if v_full then
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id', q.id, 'position', qid.ord,
             'state', gina.open_answer_state(ans.score, ans.answer_text, ans.answer_document),
             'score', ans.score, 'graded_by', ans.graded_by, 'ai_score', ans.ai_score,
             'ai_suggested', ans.ai_score is not null and ans.score is null,
             'legacy_ai', ans.graded_by = 'ai' and ans.score is not null,
             'has_text', nullif(trim(ans.answer_text), '') is not null,
             'has_document', coalesce(jsonb_array_length(ans.answer_document -> 'elements'), 0) > 0
           ) order by qid.ord), '[]'::jsonb)
    into v_open_answers
    from public.exams e
    join unnest(e.question_ids) with ordinality qid(id, ord) on true
    join public.question_bank q on q.id = qid.id
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where e.id = a.exam_id and q.kind = 'open_ended';
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id', q.id, 'position', qid.ord, 'interaction_type', q.interaction_type,
             'answer_state', coalesce(ans.score_details->>'answer_state', case when ans.answer is null then 'unanswered' else 'complete' end),
             'outcome', ans.score_details->>'outcome',
             'score', ans.score, 'score_exact', ans.score_exact, 'graded_by', ans.graded_by,
             'auto_score', coalesce((ans.score_details->>'score')::numeric, (ans.score_details->'items'->>'auto_result_score')::numeric),
             'answer_hash', case when ans.attempt_id is not null then gina.answer_fingerprint(ans) end
           ) order by qid.ord), '[]'::jsonb)
    into v_structured
    from public.exams e
    join unnest(e.question_ids) with ordinality qid(id, ord) on true
    join public.question_bank q on q.id = qid.id
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where e.id = a.exam_id and q.kind = 'structured';
  end if;
  return jsonb_build_object(
    'id', a.id, 'exam_id', a.exam_id, 'child_id', a.child_id, 'status', a.status,
    'review_state', case when a.status = 'in_progress' then 'in_progress' when a.status = 'graded' then 'graded' else 'pending_review' end,
    'mc_total', a.mc_total, 'mc_correct', a.mc_correct, 'open_total', a.open_total, 'open_graded', a.open_graded,
    'pending_open_count', v_pending, 'unanswered_open_count', v_unanswered, 'provisional', v_provisional,
    'score_pct', a.score_pct, 'started_at', a.started_at, 'finished_at', a.finished_at, 'graded_at', a.graded_at,
    'items_total', a.items_total, 'items_scored', a.items_scored, 'items_pending', a.items_pending,
    'items_unanswered', a.items_unanswered, 'items_partial', a.items_partial
  ) || case when v_full then jsonb_build_object(
    'open_answers', v_open_answers,
    'structured_answers', v_structured,
    'ai_suggestion_count', (select count(*) from jsonb_array_elements(v_open_answers) x where (x->>'ai_suggested')::boolean)
  ) else '{}'::jsonb end;
end;
$function$;

-- 8) Veli atama uyarısı: çocuğun cihazlarının bildirdiği tür desteği (yetki değil, bilgi).
create function public.get_child_question_type_support(p_child_id uuid) returns jsonb
language sql stable security definer set search_path to '' as $function$
 select coalesce(jsonb_agg(jsonb_build_object('device_id',d.id,'name',d.name,'question_types',d.question_types,'reported_at',d.question_types_at)
   order by d.last_seen_at desc nulls last),'[]'::jsonb)
 from public.devices d where d.family_id=gina.family_id() and gina.is_parent() and d.revoked_at is null
 and (d.active_child_id=p_child_id or d.active_child_id is null);
$function$;
revoke all on function public.get_child_question_type_support(uuid) from public, anon;
grant execute on function public.get_child_question_type_support(uuid) to authenticated;

revoke all on function gina.qt_score(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function gina.qt_student_payload(text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function gina.qt_student_payload_v1(text, jsonb, jsonb, text) from public, anon, authenticated;

-- 9) Okuma RPC'leri (tablo politikası yerine; yetki kuralı tek yerde) ------------------------------
create function public.get_interaction_types() returns jsonb
language sql stable security definer set search_path to '' as $function$
 select coalesce(jsonb_agg(jsonb_build_object('type',t.type,'family',t.family,'schema_version',t.schema_version,'policy',t.policy,
   'policy_version',t.policy_version,'auto_scorable',t.auto_scorable,'practice_only',t.practice_only,'phase',t.phase,'enabled',t.enabled) order by t.type),'[]'::jsonb)
 from public.interaction_types t where auth.uid() is not null;
$function$;
grant execute on function public.get_interaction_types() to authenticated;

-- Veli kendi ailesinin, veli/yönetici genel kütüphanenin anahtarını okur. Cihaz (çocuk) asla.
create function public.get_question_answer_keys(p_question_ids uuid[]) returns jsonb
language sql stable security definer set search_path to '' as $function$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',k.question_id,'interaction_type',k.interaction_type,'schema_version',k.schema_version,
   'key',k.key,'policy',k.policy,'policy_version',k.policy_version,'points',k.points,'content_hash',k.content_hash) order by k.question_id),'[]'::jsonb)
 from public.question_answer_keys k
 where k.question_id=any(p_question_ids) and cardinality(p_question_ids)<=200 and not gina.is_device()
 and ((k.family_id=gina.family_id() and gina.is_parent()) or (k.family_id is null and (gina.is_parent() or gina.is_admin_strict())));
$function$;
grant execute on function public.get_question_answer_keys(uuid[]) to authenticated;

-- 10) Yetki hijyeni: yeni fonksiyonlarda public/anon EXECUTE yok.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','gina') and p.proname in (
      'get_interaction_types','get_question_answer_keys','get_attempt_questions_v2','submit_exam_answer_v4','get_saved_exam_answers_v4',
      'set_structured_answer_score','get_structured_score_overrides','get_child_question_type_support',
      'question_interaction','qt_valid_id','qt_entry_ids','qt_only_keys','qt_weights_ok','qt_parse_number','qt_norm_text','qt_content_errors',
      'qt_content_hash','check_structured_question','guard_used_answer_key','qt_legacy_hash','bind_exam_items','guard_exam_interaction_types',
      'qt_answer_errors','qt_score','qt_student_payload','qt_student_payload_v1','score_structured_answers','qt_numeric_payload_ok',
      'qt_question_errors','qt_insert_structured')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
  end loop;
end $$;
