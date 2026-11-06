-- D14: veli bir AI sorusunu (ya da AI ortak kaynak grubunu) düzenleyebilir.
-- Kural: özgün AI satırı yerinde DEĞİŞMEZ (başka taslak/sınav/raporda kullanılıyor olabilir). Düzenleme her zaman yeni bir
-- `question_bank` satırıdır: provenance özgünden kopyalanır (model, istem sürümü, taslak, katalog bağı…), üzerine
-- `generator:'ai_edited'`, `edited_from` (doğrudan kaynak), `edited_root` (ilk AI satırı), `edited_at`, `edited_by` yazılır.
-- Kişi adı uyarısı (D9/B6) yalnız özgünde işaretlenen adlar için sunucuda yeniden denetlenir (ucuz, deterministik):
-- ad hâlâ geçiyorsa `needs_review` (kalan adlar/alanlar), geçmiyorsa `status:'resolved', resolved_by:'parent_edit'`.
-- AI grubu: yeni grup SÜRÜMÜ (aynı seri, version+1, previous_id=özgün) ve her üye için yeni satır; eski sürüm ve üyeleri
-- değişmez, `guard_question_group_members` gövde sözleşmesi (başlık\nmetin\n\nsoru) aynen sağlanır.
-- Yeni AI çağrısı/ücret yok. Yalnız veli, yalnız kendi ailesi. Yeni public RPC'ler anon'a kapalı; yardımcılar hiçbir role açık
-- değil. C07 rol kontrollü admin RPC'lerine dokunulmaz.

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

-- Velinin gönderdiği soru alanlarını doğrular ve normalleştirir (kurallar save_question_with_sources ile aynı; açık uçluda
-- beklenen cevap, grup üyesinde çözüm zorunlu — AI kaynağında zaten vardır).
create function gina.ai_edit_question_fields(p jsonb,p_max_stem int,p_need_solution boolean) returns jsonb
language plpgsql immutable set search_path='' as $$
declare q public.question_bank; rubric jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid_input'; end if;
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
end; $$;
revoke all on function gina.ai_edit_question_fields(jsonb,int,boolean) from public,anon,authenticated,service_role;

-- D9 uyarısının düzenlenmiş metne göre yeniden denetimi. Yalnız özgünde işaretlenen adlar aranır (büyük/küçük harf duyarlı,
-- harf sınırıyla; "Elif'in" eşleşir, "Elifçe" eşleşmez). Türkçe harfler açıkça harf sayılır (veritabanı yerel ayarından bağımsız).
create function gina.ai_edit_content_review(p_old jsonb,p_texts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare s jsonb:=gina.question_content_review_summary(jsonb_build_object('content_review',p_old));
 f jsonb; n text; fld text; val text; names jsonb; fields jsonb; kept jsonb:='[]'; pat text;
 letter constant text:='[:alpha:]çğıöşüâîûÇĞİÖŞÜÂÎÛ';
begin
 if s is null then return null; end if;
 for f in select value from jsonb_array_elements(s->'flags') loop
  names:='[]'; fields:='[]';
  for n in select btrim(value) from jsonb_array_elements_text(f->'names') loop
   pat:='(^|[^'||letter||'])'||regexp_replace(n,'([^[:alnum:]])','\\\1','g')||'($|[^'||letter||'])';
   for fld,val in select key,value from jsonb_each_text(coalesce(p_texts,'{}'::jsonb)) order by key loop
    if val ~ pat then
     if not names ? n then names:=names||to_jsonb(n); end if;
     if not fields ? fld then fields:=fields||to_jsonb(fld); end if;
    end if;
   end loop;
  end loop;
  if jsonb_array_length(names)>0 then
   kept:=kept||jsonb_build_array(jsonb_build_object('code','person_name','names',names,'fields',fields,'suggestion',f->>'suggestion'));
  end if;
 end loop;
 if jsonb_array_length(kept)>0 then
  return jsonb_build_object('status','needs_review','detector',coalesce(p_old->>'detector',''),'flags',kept,'rechecked_by','parent_edit');
 end if;
 return jsonb_build_object('status','resolved','resolved_by','parent_edit','detector',coalesce(p_old->>'detector',''),'previous_flags',s->'flags');
end; $$;
revoke all on function gina.ai_edit_content_review(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Düzenlemenin provenance'ı: özgünün tamamı (istem/model/taslak/katalog) + düzenleme izi; eski rubrik ve uyarı atılır,
-- velinin gönderdiği rubrik (100'lük) ve yeniden denetlenen uyarı yazılır.
create function gina.ai_edit_provenance(p_src public.question_bank,p_fields jsonb,p_review jsonb,p_extra jsonb) returns jsonb
language sql stable set search_path='' as $$
 select (coalesce(p_src.provenance,'{}'::jsonb)-'rubric'-'content_review'-'rubric_scale')
  ||jsonb_build_object('generator','ai_edited','edited_from',p_src.id,
    'edited_root',coalesce(nullif(p_src.provenance->>'edited_root',''),p_src.id::text),
    'edited_at',now(),'edited_by',auth.uid())
  ||case when p_fields->'rubric' is null or jsonb_typeof(p_fields->'rubric')='null' then '{}'::jsonb else jsonb_build_object('rubric',p_fields->'rubric') end
  ||case when p_review is null then '{}'::jsonb else jsonb_build_object('content_review',p_review) end
  ||coalesce(p_extra,'{}'::jsonb)
$$;
revoke all on function gina.ai_edit_provenance(public.question_bank,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

create function gina.ai_edit_texts(p_fields jsonb,p_stem text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('stem',p_stem)||coalesce((select jsonb_object_agg('choice_'||(c->>'key'),c->>'text')
  from jsonb_array_elements(case when jsonb_typeof(p_fields->'choices')='array' then p_fields->'choices' else '[]'::jsonb end) c),'{}'::jsonb)
$$;
revoke all on function gina.ai_edit_texts(jsonb,text) from public,anon,authenticated,service_role;

create function gina.ai_edit_insert(p_family uuid,p_src public.question_bank,p_fields jsonb,p_stem text,p_provenance jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare qid uuid:=gen_random_uuid();
begin
 insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,
  solution,explanation,source_urls,provenance,created_by)
 values(qid,p_family,p_src.grade,p_src.subject,p_fields->>'topic',p_fields->>'scenario_code',(p_fields->>'kind')::public.question_kind,
  (p_fields->>'difficulty')::public.question_difficulty,p_stem,
  case when jsonb_typeof(p_fields->'choices')='array' then p_fields->'choices' end,p_fields->>'correct_key',p_fields->>'expected_answer',
  p_fields->>'solution',p_fields->>'explanation',p_src.source_urls,p_provenance,auth.uid());
 -- D1 soru düzeyinde dönem/program izi aynen taşınır (kaynağı dahil).
 insert into gina.question_period_tags(question_id,family_id,term,program,source)
 select qid,p_family,t.term,t.program,t.source from gina.question_period_tags t where t.question_id=p_src.id
 on conflict(question_id) do nothing;
 return qid;
end; $$;
revoke all on function gina.ai_edit_insert(uuid,public.question_bank,jsonb,text,jsonb) from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Tek AI sorusu
-- ---------------------------------------------------------------------------
create function public.save_ai_question_edit(p_request_id uuid,p_source_id uuid,p_question jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); r public.mutation_receipts; payload jsonb; src public.question_bank; fields jsonb; review jsonb;
 qid uuid; result jsonb;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_source_id is null or jsonb_typeof(p_question) is distinct from 'object' then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('source',p_source_id,'question',p_question);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_ai_question_edit' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 select * into src from public.question_bank where id=p_source_id and family_id=f for share;
 if not found then raise exception 'question_not_found'; end if;
 if coalesce(src.provenance->>'generator','') not in('ai','ai_edited') then raise exception 'ai_edit_not_ai'; end if;
 if exists(select 1 from public.question_source_members where question_id=src.id) then raise exception 'ai_edit_group_member'; end if;
 fields:=gina.ai_edit_question_fields(p_question,10000,false);
 review:=gina.ai_edit_content_review(src.provenance->'content_review',gina.ai_edit_texts(fields,fields->>'stem'));
 qid:=gina.ai_edit_insert(f,src,fields,fields->>'stem',gina.ai_edit_provenance(src,fields,review,null));
 result:=jsonb_build_object('id',qid,'edited_from',src.id,
  'content_review',gina.question_content_review_summary(jsonb_build_object('content_review',review)));
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'save_ai_question_edit',payload,result);
 return result;
end; $$;
revoke all on function public.save_ai_question_edit(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_ai_question_edit(uuid,uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- AI ortak kaynak grubu → yeni grup sürümü
-- p_group: {title, body}; p_questions: üyelerle aynı sırada [{source_id, stem(=üyenin kendi sorusu), kind, difficulty, topic,
-- choices, correct_key, expected_answer, solution, explanation, rubric}]. Üye ekleme/çıkarma yok (grup kapsamı aynı kalır).
-- ---------------------------------------------------------------------------
create function public.save_ai_group_edit(p_request_id uuid,p_group_id uuid,p_group jsonb,p_questions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); r public.mutation_receipts; payload jsonb; g public.question_source_groups; m record; src public.question_bank;
 item jsonb; fields jsonb; review jsonb; title text; body text; prompt text; stem text; prov jsonb; qid uuid; ids uuid[]:='{}'; n int:=0; result jsonb;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_group_id is null or jsonb_typeof(p_group) is distinct from 'object'
 or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 2 and 12 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('group_id',p_group_id,'group',p_group,'questions',p_questions);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_ai_group_edit' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 if not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb) then raise exception 'question_groups_unavailable'; end if;
 select * into g from public.question_source_groups where id=p_group_id and family_id=f and finalized_at is not null;
 if not found then raise exception 'question_group_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(g.series_id::text,52));
 if exists(select 1 from public.question_source_groups where family_id=f and series_id=g.series_id and version>g.version) then raise exception 'question_group_changed'; end if;
 if (select count(*) from public.question_source_members where group_id=g.id)<>jsonb_array_length(p_questions) then raise exception 'question_group_mismatch'; end if;
 if exists(select 1 from public.question_source_members x join public.question_bank q on q.id=x.question_id
   where x.group_id=g.id and coalesce(q.provenance->>'generator','') not in('ai','ai_edited')) then raise exception 'ai_edit_not_ai'; end if;
 title:=btrim(coalesce(p_group->>'title','')); body:=btrim(coalesce(p_group->>'body',''));
 if length(title) not between 1 and 160 or length(body) not between 1 and 6000 then raise exception 'question_group_incomplete'; end if;
 insert into public.question_source_groups(id,family_id,series_id,version,previous_id,title,body,grade,subject)
 values(p_request_id,f,g.series_id,g.version+1,g.id,title,body,g.grade,g.subject);
 for m in select x.question_id,x.position,x.prompt from public.question_source_members x where x.group_id=g.id order by x.position loop
  n:=n+1; item:=p_questions->(n-1);
  if jsonb_typeof(item) is distinct from 'object' or item->>'source_id' is distinct from m.question_id::text then raise exception 'question_group_mismatch'; end if;
  select * into src from public.question_bank where id=m.question_id for share;
  fields:=gina.ai_edit_question_fields(item,3500,true);
  prompt:=fields->>'stem'; stem:=title||E'\n'||body||E'\n\n'||prompt;
  review:=gina.ai_edit_content_review(src.provenance->'content_review',
   gina.ai_edit_texts(fields,prompt)||jsonb_build_object('shared_source',title||E'\n'||body));
  prov:=gina.ai_edit_provenance(src,fields,review,jsonb_build_object('edit_scope','group','shared_prompt',prompt,'shared_source_title',title));
  if jsonb_typeof(prov->'shared_source')='object' then prov:=jsonb_set(prov,'{shared_source,content}',to_jsonb(body)); end if;
  qid:=gina.ai_edit_insert(f,src,fields,stem,prov);
  insert into public.question_source_members(group_id,question_id,position,prompt) values(p_request_id,qid,n,prompt);
  ids:=array_append(ids,qid);
 end loop;
 update public.question_source_groups set finalized_at=now() where id=p_request_id;
 result:=jsonb_build_object('id',p_request_id,'series_id',g.series_id,'version',g.version+1,'previous_id',g.id,'question_ids',to_jsonb(ids));
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'save_ai_group_edit',payload,result);
 return result;
end; $$;
revoke all on function public.save_ai_group_edit(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_ai_group_edit(uuid,uuid,jsonb,jsonb) to authenticated;
