-- QT yayın anahtarı (1A/1B + 2A + 2B toplu yayın, Enes kararı 6 Kasım 2026): Faz 2A ve 2B türlerini açar.
-- Bu migration YALNIZ istemci anahtarları (support.ts PHASE2A/PHASE2B) açık yapı ve 2A/2B'yi bilen Edge
-- prova-generate ile aynı yayında uygulanır. Faz 3 (crossword) kapalı kalır. Geri alma: enabled=false
-- (mevcut soru/cevap/puan silinmez; yeni hazırlama/atama durur).
update public.interaction_types set enabled = true where phase in ('2A', '2B');

-- 1–4. sınıf saat sorusunda 12 saat denkliği zorunlu (çocuk 1–12 görür).
CREATE OR REPLACE FUNCTION gina.check_structured_question()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Karar (7 Kasım 2026): 1–4. sınıfta çocuk saati 1–12 ile girer; 12 saat denkliği kapatılamaz.
  if q.interaction_type = 'clock' and q.grade <= 4 and (k.key->>'accept_12h')::boolean is false then
    raise exception 'question_structure_invalid' using detail = 'clock_12h_required';
  end if;
  if k.content_hash <> gina.qt_content_hash(q.stem, q.interaction_type, q.schema_version, q.payload, k.key, k.policy, k.policy_version, k.points) then
    raise exception 'structured_hash_mismatch';
  end if;
  return null;
end $function$;
