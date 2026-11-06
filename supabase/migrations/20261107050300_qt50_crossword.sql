-- QT50 (Faz 3, düşük öncelik): bulmaca. Kapalı gelir (enabled=false).
-- Hücre kimliği "rR_cC" (satır/sütun 1'den). Harfler TR büyük harf kuralıyla karşılaştırılır (i→İ, ı→I);
-- ASCII eşitleme yok. Puan = doğru tamamlanan ipucu ağırlığı / toplam; tamamlanma oranı ayrı raporlanır.
insert into public.interaction_types(type, family, schema_version, policy, policy_version, auto_scorable, practice_only, phase, enabled)
values ('crossword', 'structured', 1, 'per_clue', 1, true, true, '3', false);

alter function gina.qt_question_errors(text, int, jsonb, jsonb) rename to qt_question_errors_p3;
alter function gina.qt_answer_errors(text, jsonb, jsonb) rename to qt_answer_errors_p3;
alter function gina.qt_score(text, jsonb, jsonb, jsonb) rename to qt_score_p3;
alter function gina.qt_student_payload_v1(text, jsonb, jsonb, text) rename to qt_student_payload_p3;

create function gina.qt_tr_upper(t text) returns text
language sql immutable set search_path to '' as $$ select upper(btrim(normalize(coalesce(t, ''), NFC)) collate "tr-TR-x-icu") $$;

-- İpucunun hücreleri (sırayla).
create function gina.qt_clue_cells(c jsonb) returns text[]
language sql immutable set search_path to '' as $$
  select array(select 'r' || ((c->>'row')::int + case when c->>'dir' = 'down' then i else 0 end) || '_c' || ((c->>'col')::int + case when c->>'dir' = 'across' then i else 0 end)
               from generate_series(0, (c->>'length')::int - 1) i order by i)
$$;

create function gina.qt_crossword_errors(p jsonb, k jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare err text[] := '{}'; c jsonb; rows int; cols int; ids text[] := '{}'; cells text[]; ans text; letters jsonb := '{}'; i int; ch text; blocks text[];
begin
  if not gina.qt_only_keys(p, array['rows', 'cols', 'blocks', 'clues']) then return array['payload_unknown_field']; end if;
  rows := (p->>'rows')::int; cols := (p->>'cols')::int;
  if rows not between 2 and 12 or cols not between 2 and 12 then return array['grid_invalid']; end if;
  blocks := coalesce(array(select jsonb_array_elements_text(p->'blocks')), '{}');
  if exists (select 1 from unnest(blocks) b where b !~ '^r[0-9]+_c[0-9]+$') then return array['grid_invalid']; end if;
  if jsonb_typeof(p->'clues') is distinct from 'array' or jsonb_array_length(p->'clues') not between 1 and 20 then return array['clues_invalid']; end if;
  for c in select value from jsonb_array_elements(p->'clues') loop
    if not gina.qt_only_keys(c, array['id', 'dir', 'row', 'col', 'length', 'text']) or not gina.qt_valid_id(c->>'id') or c->>'id' = any(ids)
       or coalesce(c->>'dir', '') not in ('across', 'down') or jsonb_typeof(c->'text') <> 'string' or length(btrim(c->>'text')) not between 1 and 300
       or (c->>'length')::int not between 2 and 12 or (c->>'row')::int < 1 or (c->>'col')::int < 1
       or (c->>'dir' = 'across' and (c->>'col')::int + (c->>'length')::int - 1 > cols)
       or (c->>'dir' = 'down' and (c->>'row')::int + (c->>'length')::int - 1 > rows) or (c->>'row')::int > rows or (c->>'col')::int > cols
    then return array['clues_invalid']; end if;
    ids := array_append(ids, c->>'id');
    cells := gina.qt_clue_cells(c);
    if cells && blocks then err := array_append(err, 'clue_on_block'); end if;
    ans := gina.qt_tr_upper(k->'answers'->>(c->>'id'));
    if ans = '' then err := array_append(err, 'key_missing_id'); continue; end if;
    if char_length(ans) <> (c->>'length')::int or ans !~ '^[A-ZÇĞİIÖŞÜ]+$' then err := array_append(err, 'key_value_invalid'); continue; end if;
    -- Kesişen ipuçları aynı harfte buluşmalı.
    for i in 1..array_length(cells, 1) loop
      ch := substr(ans, i, 1);
      if letters ? cells[i] and letters->>cells[i] <> ch then err := array_append(err, 'crossing_mismatch'); end if;
      letters := letters || jsonb_build_object(cells[i], ch);
    end loop;
  end loop;
  if not gina.qt_only_keys(k, array['answers', 'weights']) or jsonb_typeof(k->'answers') is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(k->'answers') x where not (x = any(ids))) then err := array_append(err, 'key_unknown_id'); end if;
  if not gina.qt_weights_ok(k->'weights', ids) then err := array_append(err, 'weights_invalid'); end if;
  return array(select distinct x from unnest(err) x order by 1);
exception when others then return array['content_invalid'];
end $$;

create function gina.qt_question_errors(p_type text, p_version int, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
begin
  if p_type = 'crossword' then
    if p_version is distinct from 1 then return array['schema_version_unsupported']; end if;
    if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text) > 16000 then return array['payload_invalid']; end if;
    if jsonb_typeof(p_key) is distinct from 'object' or length(p_key::text) > 16000 then return array['key_invalid']; end if;
    return gina.qt_crossword_errors(p_payload, p_key);
  end if;
  return gina.qt_question_errors_p3(p_type, p_version, p_payload, p_key);
end $$;

create function gina.qt_answer_errors(p_type text, p_payload jsonb, p_answer jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare allowed text[]; k text; v jsonb;
begin
  if p_type <> 'crossword' then return gina.qt_answer_errors_p3(p_type, p_payload, p_answer); end if;
  if jsonb_typeof(p_answer) is distinct from 'object' or length(p_answer::text) > 8000 then return array['answer_invalid']; end if;
  if p_answer->>'type' is distinct from p_type then return array['answer_type_mismatch']; end if;
  if p_answer->>'v' is distinct from '1' then return array['answer_version_unsupported']; end if;
  if not gina.qt_only_keys(p_answer, array['type', 'v', 'cells']) or jsonb_typeof(p_answer->'cells') is distinct from 'object' then return array['answer_invalid']; end if;
  allowed := array(select distinct x from jsonb_array_elements(p_payload->'clues') c, unnest(gina.qt_clue_cells(c)) x);
  for k, v in select * from jsonb_each(p_answer->'cells') loop
    if not (k = any(allowed)) then return array['answer_unknown_id']; end if;
    if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') <> 1 or gina.qt_tr_upper(v #>> '{}') !~ '^[A-ZÇĞİIÖŞÜ]$' then return array['answer_value_invalid']; end if;
  end loop;
  return '{}';
exception when others then return array['answer_invalid'];
end $$;

create function gina.qt_score(p_type text, p_payload jsonb, p_key jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $$
declare c jsonb; cells text[]; w numeric; total numeric := 0; earned numeric := 0; all_cells text[]; filled int; items jsonb := '{}'; ok boolean; got text;
begin
  if p_type <> 'crossword' then return gina.qt_score_p3(p_type, p_payload, p_key, p_answer); end if;
  if p_answer is not null and cardinality(gina.qt_answer_errors(p_type, p_payload, p_answer)) > 0 then raise exception 'answer_invalid_for_scoring'; end if;
  all_cells := array(select distinct x from jsonb_array_elements(p_payload->'clues') c2, unnest(gina.qt_clue_cells(c2)) x);
  filled := coalesce((select count(*) from jsonb_object_keys(coalesce(p_answer->'cells', '{}')) x), 0);
  if filled = 0 then
    return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', 1, 'items', '{}'::jsonb);
  end if;
  for c in select value from jsonb_array_elements(p_payload->'clues') loop
    cells := gina.qt_clue_cells(c);
    w := coalesce((p_key->'weights'->>(c->>'id'))::numeric, 1);
    got := (select string_agg(coalesce(gina.qt_tr_upper(p_answer->'cells'->>x), '_'), '' order by o) from unnest(cells) with ordinality t(x, o));
    ok := got = gina.qt_tr_upper(p_key->'answers'->>(c->>'id'));
    total := total + w; if ok then earned := earned + w; end if;
    items := items || jsonb_build_object(c->>'id', jsonb_build_object('correct', ok, 'weight', w));
  end loop;
  -- Tamamlanma oranı (dolu hücre / toplam) yazım becerisinden ayrı raporlanır; puana girmez.
  items := items || jsonb_build_object('completion', round(filled::numeric / cardinality(all_cells), 4));
  return jsonb_build_object('answer_state', case when filled < cardinality(all_cells) then 'partial' else 'complete' end, 'outcome', 'scored',
    'score', 100 * earned / total, 'earned', earned, 'total', total, 'items', items);
end $$;

create function gina.qt_student_payload_v1(p_type text, p_payload jsonb, p_key jsonb, p_seed text) returns jsonb
language plpgsql immutable set search_path to '' as $$
begin
  if p_type <> 'crossword' then return gina.qt_student_payload_p3(p_type, p_payload, p_key, p_seed); end if;
  return jsonb_build_object('rows', (p_payload->>'rows')::int, 'cols', (p_payload->>'cols')::int, 'blocks', coalesce(p_payload->'blocks', '[]'::jsonb),
    'clues', (select jsonb_agg(jsonb_build_object('id', c->>'id', 'dir', c->>'dir', 'row', (c->>'row')::int, 'col', (c->>'col')::int, 'length', (c->>'length')::int, 'text', c->>'text') order by o)
              from jsonb_array_elements(p_payload->'clues') with ordinality t(c, o)));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'gina' and p.proname in ('qt_tr_upper', 'qt_clue_cells', 'qt_crossword_errors', 'qt_question_errors', 'qt_answer_errors', 'qt_score',
      'qt_student_payload_v1', 'qt_question_errors_p3', 'qt_answer_errors_p3', 'qt_score_p3', 'qt_student_payload_p3')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
