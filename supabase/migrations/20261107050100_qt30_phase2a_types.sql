-- QT30–QT33 (Faz 2A): metin işaretleme, hata bulma–düzeltme, çoklu doğru seçenek, iki aşamalı soru.
-- 1A/1B fonksiyonları yeniden adlandırılıp (…_p1) aynen korunur; aynı adlı dağıtıcılar 2A türlerini
-- ayrı fonksiyonlara yönlendirir. Böylece mevcut türlerin davranışı değişmez.

-- İstemci çizicileri yayınlanana kadar kapalı (enabled=false): hazırlama/atama reddedilir, eski istemci etkilenmez.
-- Açma ayrı migration ile yapılır (çocuk/veli/PDF/AI istemcileri hazır olduğunda).
insert into public.interaction_types(type, family, schema_version, policy, policy_version, auto_scorable, practice_only, phase, enabled) values
  ('mark_text', 'structured', 1, 'balanced_selection', 1, true, true, '2A', false),
  ('error_fix', 'structured', 1, 'find_fix', 1, true, true, '2A', false),
  ('multi_choice', 'structured', 1, 'balanced_selection', 1, true, true, '2A', false),
  ('two_stage', 'structured', 1, 'staged', 1, true, true, '2A', false);

alter function gina.qt_question_errors(text, int, jsonb, jsonb) rename to qt_question_errors_p1;
alter function gina.qt_answer_errors(text, jsonb, jsonb) rename to qt_answer_errors_p1;
alter function gina.qt_score(text, jsonb, jsonb, jsonb) rename to qt_score_p1;
alter function gina.qt_student_payload_v1(text, jsonb, jsonb, text) rename to qt_student_payload_p1;

-- Seçilebilir parça listesi: [{text}] veya [{id,text}]; ≥2 seçilebilir. Geçersizse NULL, aksi halde id dizisi.
create function gina.qt_segment_ids(arr jsonb, max_count int) returns text[]
language plpgsql immutable set search_path to '' as $$
declare e jsonb; ids text[] := '{}';
begin
  if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr) not between 2 and max_count then return null; end if;
  for e in select value from jsonb_array_elements(arr) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'text') is distinct from 'string' or length(e->>'text') not between 1 and 500 then return null; end if;
    if e ? 'id' then
      if not gina.qt_only_keys(e, array['id', 'text']) or not gina.qt_valid_id(e->>'id') or e->>'id' = any(ids) or length(btrim(e->>'text')) = 0 then return null; end if;
      ids := array_append(ids, e->>'id');
    elsif not gina.qt_only_keys(e, array['text']) then return null;
    end if;
  end loop;
  return ids;
end $$;

create function gina.qt2_content_errors(p_type text, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare err text[] := '{}'; ids text[]; k text; v jsonb; n int; p int;
begin
  if p_type in ('mark_text', 'error_fix') then
    if not gina.qt_only_keys(p_payload, case when p_type = 'mark_text' then array['unit', 'segments', 'max_select'] else array['unit', 'segments'] end) then return array['payload_unknown_field']; end if;
    if coalesce(p_payload->>'unit', '') not in ('word', 'sentence') then err := array_append(err, 'unit_invalid'); end if;
    ids := gina.qt_segment_ids(p_payload->'segments', 300);
    if ids is null or cardinality(ids) < 2 then return array_append(err, 'segments_invalid'); end if;
    if p_payload ? 'max_select' and (jsonb_typeof(p_payload->'max_select') <> 'number' or (p_payload->>'max_select')::numeric <> trunc((p_payload->>'max_select')::numeric)
       or (p_payload->>'max_select')::int not between 1 and cardinality(ids)) then err := array_append(err, 'max_select_invalid'); end if;
    if p_type = 'mark_text' then
      if not gina.qt_only_keys(p_key, array['targets']) or jsonb_typeof(p_key->'targets') is distinct from 'array' then return array_append(err, 'key_invalid'); end if;
      p := jsonb_array_length(p_key->'targets');
      if (select count(distinct x #>> '{}') from jsonb_array_elements(p_key->'targets') x where x #>> '{}' = any(ids)) <> p then err := array_append(err, 'key_value_invalid'); end if;
      -- Dengeli politika P ≥ 1 ve N ≥ 1 ister (hepsi-hedef / hiç-hedef yapı reddedilir).
      if p < 1 or p >= cardinality(ids) then err := array_append(err, 'selection_balance_invalid'); end if;
      if p_payload ? 'max_select' and (p_payload->>'max_select')::int < p then err := array_append(err, 'max_select_invalid'); end if;
    else
      if not gina.qt_only_keys(p_key, array['errors', 'find_weight', 'fix_policy', 'case_insensitive']) or jsonb_typeof(p_key->'errors') is distinct from 'object' then return array_append(err, 'key_invalid'); end if;
      n := 0;
      for k, v in select * from jsonb_each(p_key->'errors') loop
        n := n + 1;
        if not (k = any(ids)) then err := array_append(err, 'key_unknown_id');
        elsif not gina.qt_only_keys(v, array['accepted']) or jsonb_typeof(v->'accepted') <> 'array' or jsonb_array_length(v->'accepted') not between 1 and 8
          or exists (select 1 from jsonb_array_elements(v->'accepted') x where jsonb_typeof(x) <> 'string' or length(btrim(x #>> '{}')) not between 1 and 120)
        then err := array_append(err, 'key_value_invalid'); end if;
      end loop;
      if n < 1 or n >= cardinality(ids) then err := array_append(err, 'selection_balance_invalid'); end if;
      if p_key ? 'find_weight' and (jsonb_typeof(p_key->'find_weight') <> 'number' or (p_key->>'find_weight')::numeric not between 0.1 and 0.9) then err := array_append(err, 'weights_invalid'); end if;
      if coalesce(p_key->>'fix_policy', 'review_unmatched') not in ('review_unmatched', 'closed') then err := array_append(err, 'key_invalid'); end if;
      if p_key ? 'case_insensitive' and jsonb_typeof(p_key->'case_insensitive') <> 'boolean' then err := array_append(err, 'key_invalid'); end if;
    end if;

  elsif p_type = 'multi_choice' then
    if not gina.qt_only_keys(p_payload, array['options', 'select_count']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(p_payload->'options', 8, 500);
    if ids is null or cardinality(ids) < 3 then return array['options_invalid']; end if;
    if not gina.qt_only_keys(p_key, array['correct']) or jsonb_typeof(p_key->'correct') is distinct from 'array' then return array_append(err, 'key_invalid'); end if;
    p := jsonb_array_length(p_key->'correct');
    if (select count(distinct x #>> '{}') from jsonb_array_elements(p_key->'correct') x where x #>> '{}' = any(ids)) <> p then err := array_append(err, 'key_value_invalid'); end if;
    if p < 1 or p >= cardinality(ids) then err := array_append(err, 'selection_balance_invalid'); end if;
    if p_payload ? 'select_count' and (jsonb_typeof(p_payload->'select_count') <> 'number' or (p_payload->>'select_count')::numeric <> p) then err := array_append(err, 'select_count_mismatch'); end if;

  elsif p_type = 'two_stage' then
    if not gina.qt_only_keys(p_payload, array['stage1', 'stage2']) then return array['payload_unknown_field']; end if;
    if not gina.qt_only_keys(p_payload->'stage1', array['prompt', 'options']) or jsonb_typeof(p_payload->'stage1'->'prompt') is distinct from 'string'
       or length(btrim(p_payload->'stage1'->>'prompt')) not between 1 and 1000 then return array['stage_invalid']; end if;
    ids := gina.qt_entry_ids(p_payload->'stage1'->'options', 6, 300);
    if ids is null or cardinality(ids) < 2 then return array['stage_invalid']; end if;
    if not gina.qt_only_keys(p_payload->'stage2', array['prompt', 'mode', 'options']) or jsonb_typeof(p_payload->'stage2'->'prompt') is distinct from 'string'
       or length(btrim(p_payload->'stage2'->>'prompt')) not between 1 and 1000 or coalesce(p_payload->'stage2'->>'mode', '') not in ('choice', 'text') then return array['stage_invalid']; end if;
    if p_payload->'stage2'->>'mode' = 'choice' then
      if gina.qt_entry_ids(p_payload->'stage2'->'options', 6, 300) is null or jsonb_array_length(p_payload->'stage2'->'options') < 2
         or gina.qt_entry_ids(p_payload->'stage2'->'options', 6, 300) && ids then return array['stage_invalid']; end if;
    elsif p_payload->'stage2' ? 'options' then return array['stage_invalid']; end if;
    if not gina.qt_only_keys(p_key, array['stage1', 'stage2', 'weights']) or jsonb_typeof(p_key->'stage1') is distinct from 'string' then return array_append(err, 'key_invalid'); end if;
    if not (p_key->>'stage1' = any(ids)) then err := array_append(err, 'key_value_invalid'); end if;
    if p_payload->'stage2'->>'mode' = 'choice' then
      if jsonb_typeof(p_key->'stage2') is distinct from 'string'
         or not (p_key->>'stage2' = any(gina.qt_entry_ids(p_payload->'stage2'->'options', 6, 300))) then err := array_append(err, 'key_value_invalid'); end if;
    elsif p_key ? 'stage2' and jsonb_typeof(p_key->'stage2') <> 'null' then err := array_append(err, 'key_value_invalid');
    end if;
    if not gina.qt_weights_ok(p_key->'weights', array['stage1', 'stage2']) then err := array_append(err, 'weights_invalid'); end if;
  else
    return array['type_unknown'];
  end if;
  return array(select distinct x from unnest(err) x order by 1);
exception when others then return array['content_invalid'];
end $$;

create function gina.qt_question_errors(p_type text, p_version int, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
begin
  if p_type in ('mark_text', 'error_fix', 'multi_choice', 'two_stage') then
    if p_version is distinct from 1 then return array['schema_version_unsupported']; end if;
    if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text) > 16000 then return array['payload_invalid']; end if;
    if jsonb_typeof(p_key) is distinct from 'object' or length(p_key::text) > 16000 then return array['key_invalid']; end if;
    return gina.qt2_content_errors(p_type, p_payload, p_key);
  end if;
  return gina.qt_question_errors_p1(p_type, p_version, p_payload, p_key);
end $$;

create function gina.qt2_answer_errors(p_type text, p_payload jsonb, p_answer jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare ids text[]; k text; v jsonb;
begin
  if p_type in ('mark_text', 'multi_choice') then
    if not gina.qt_only_keys(p_answer, array['type', 'v', 'selected']) then return array['answer_unknown_field']; end if;
    ids := case when p_type = 'mark_text' then array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x ? 'id')
                else array(select x->>'id' from jsonb_array_elements(p_payload->'options') x) end;
    if jsonb_typeof(p_answer->'selected') is distinct from 'array' then return array['answer_invalid']; end if;
    if exists (select 1 from jsonb_array_elements(p_answer->'selected') x where jsonb_typeof(x) <> 'string' or not (x #>> '{}' = any(ids))) then return array['answer_unknown_id']; end if;
    if (select count(distinct x) from jsonb_array_elements(p_answer->'selected') x) <> jsonb_array_length(p_answer->'selected') then return array['answer_value_invalid']; end if;
    if jsonb_array_length(p_answer->'selected') > coalesce((p_payload->>'max_select')::int, (p_payload->>'select_count')::int, cardinality(ids)) then return array['answer_too_many']; end if;
  elsif p_type = 'error_fix' then
    if not gina.qt_only_keys(p_answer, array['type', 'v', 'marks']) or jsonb_typeof(p_answer->'marks') is distinct from 'object' then return array['answer_invalid']; end if;
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x ? 'id');
    for k, v in select * from jsonb_each(p_answer->'marks') loop
      if not (k = any(ids)) then return array['answer_unknown_id']; end if;
      if not gina.qt_only_keys(v, array['text']) or (v ? 'text' and (jsonb_typeof(v->'text') <> 'string' or length(v->>'text') > 120)) then return array['answer_value_invalid']; end if;
    end loop;
  elsif p_type = 'two_stage' then
    if not gina.qt_only_keys(p_answer, array['type', 'v', 'stage1', 'stage2']) then return array['answer_unknown_field']; end if;
    if p_answer ? 'stage1' and (jsonb_typeof(p_answer->'stage1') <> 'string'
       or not (p_answer->>'stage1' = any(array(select x->>'id' from jsonb_array_elements(p_payload->'stage1'->'options') x)))) then return array['answer_unknown_id']; end if;
    if p_answer ? 'stage2' then
      if p_payload->'stage2'->>'mode' = 'choice' then
        if jsonb_typeof(p_answer->'stage2') <> 'string'
           or not (p_answer->>'stage2' = any(array(select x->>'id' from jsonb_array_elements(p_payload->'stage2'->'options') x))) then return array['answer_unknown_id']; end if;
      elsif not gina.qt_only_keys(p_answer->'stage2', array['text']) or jsonb_typeof(p_answer->'stage2'->'text') is distinct from 'string'
            or length(p_answer->'stage2'->>'text') > 2000 then return array['answer_value_invalid']; end if;
    end if;
  else return array['type_unknown'];
  end if;
  return '{}';
exception when others then return array['answer_invalid'];
end $$;

create function gina.qt_answer_errors(p_type text, p_payload jsonb, p_answer jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
begin
  if p_type in ('mark_text', 'error_fix', 'multi_choice', 'two_stage') then
    if jsonb_typeof(p_answer) is distinct from 'object' or length(p_answer::text) > 8000 then return array['answer_invalid']; end if;
    if p_answer->>'type' is distinct from p_type then return array['answer_type_mismatch']; end if;
    if p_answer->>'v' is distinct from '1' then return array['answer_version_unsupported']; end if;
    return gina.qt2_answer_errors(p_type, p_payload, p_answer);
  end if;
  return gina.qt_answer_errors_p1(p_type, p_payload, p_answer);
end $$;

-- Dengeli seçim: max(0, TP/P − FP/N). Her şeyi seçmek 0 verir; hiçbir şey seçmemek cevapsızdır.
create function gina.qt2_score(p_type text, p_payload jsonb, p_key jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $$
declare ids text[]; targets text[]; sel text[]; tp int; fp int; pn int; nn int; s numeric; fw numeric; ci boolean;
  found int := 0; fixed int := 0; unmatched int := 0; lacking int := 0; k text; v jsonb; items jsonb := '{}'; w1 numeric; w2 numeric;
  s1 numeric; s2 numeric; st text; oc text; acc boolean;
begin
  if p_answer is not null and cardinality(gina.qt_answer_errors(p_type, p_payload, p_answer)) > 0 then raise exception 'answer_invalid_for_scoring'; end if;
  if p_type in ('mark_text', 'multi_choice') then
    ids := case when p_type = 'mark_text' then array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x ? 'id')
                else array(select x->>'id' from jsonb_array_elements(p_payload->'options') x) end;
    targets := array(select jsonb_array_elements_text(case when p_type = 'mark_text' then p_key->'targets' else p_key->'correct' end));
    sel := coalesce(array(select jsonb_array_elements_text(p_answer->'selected')), '{}');
    pn := cardinality(targets); nn := cardinality(ids) - pn;
    tp := (select count(*) from unnest(sel) x where x = any(targets)); fp := cardinality(sel) - tp;
    if cardinality(sel) = 0 then
      return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', 1, 'items', '{}'::jsonb);
    end if;
    s := greatest(0, tp::numeric / pn - fp::numeric / nn);
    return jsonb_build_object('answer_state', 'complete', 'outcome', 'scored', 'score', 100 * s, 'earned', s, 'total', 1,
      'items', jsonb_build_object('true_positive', tp, 'false_positive', fp, 'targets', pn, 'distractors', nn));
  elsif p_type = 'error_fix' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x ? 'id');
    pn := (select count(*) from jsonb_object_keys(p_key->'errors')); nn := cardinality(ids) - pn;
    fw := coalesce((p_key->>'find_weight')::numeric, 0.5);
    ci := coalesce((p_key->>'case_insensitive')::boolean, false);
    if p_answer is null or (select count(*) from jsonb_object_keys(p_answer->'marks')) = 0 then
      return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', 1, 'items', '{}'::jsonb);
    end if;
    fp := 0;
    for k, v in select * from jsonb_each(p_answer->'marks') loop
      if p_key->'errors' ? k then
        found := found + 1;
        acc := exists (select 1 from jsonb_array_elements_text(p_key->'errors'->k->'accepted') a
                       where gina.qt_norm_text(a, ci) = gina.qt_norm_text(v->>'text', ci));
        if acc then fixed := fixed + 1;
        elsif length(gina.qt_norm_text(v->>'text', false)) = 0 then lacking := lacking + 1;
        else unmatched := unmatched + 1; end if;
        items := items || jsonb_build_object(k, jsonb_build_object('error', true, 'fixed', acc));
      else
        fp := fp + 1;
        -- Doluluk çocuğun bakışıyla: düzeltmesi boş her işaret 'kısmi' sayılır (istemci de aynı kuralı bilir).
        if length(gina.qt_norm_text(v->>'text', false)) = 0 then lacking := lacking + 1; end if;
        items := items || jsonb_build_object(k, jsonb_build_object('error', false));
      end if;
    end loop;
    s := fw * greatest(0, found::numeric / pn - fp::numeric / nn) + (1 - fw) * fixed::numeric / pn;
    st := case when lacking > 0 then 'partial' else 'complete' end;
    -- Anahtarda olmayan anlamlı düzeltme: kapalı politikada 0; varsayılanda veliye yönlenir (AI tek başına kesinleştirmez).
    oc := case when unmatched > 0 and coalesce(p_key->>'fix_policy', 'review_unmatched') = 'review_unmatched' then 'pending_human' else 'scored' end;
    items := items || jsonb_build_object('found', found, 'fixed', fixed, 'unmatched_fixes', unmatched, 'false_marks', fp, 'errors', pn);
    if oc = 'pending_human' then items := items || jsonb_build_object('auto_result_score', 100 * s); end if;
    return jsonb_build_object('answer_state', st, 'outcome', oc, 'score', case when oc = 'scored' then 100 * s end, 'earned', s, 'total', 1, 'items', items);
  elsif p_type = 'two_stage' then
    w1 := coalesce((p_key->'weights'->>'stage1')::numeric, 1); w2 := coalesce((p_key->'weights'->>'stage2')::numeric, 1);
    if p_answer is null or (not p_answer ? 'stage1' and not p_answer ? 'stage2') then
      return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', w1 + w2, 'items', '{}'::jsonb);
    end if;
    s1 := case when p_answer->>'stage1' = p_key->>'stage1' then w1 else 0 end;
    if p_payload->'stage2'->>'mode' = 'choice' then
      s2 := case when p_answer->>'stage2' = p_key->>'stage2' then w2 else 0 end;
      oc := 'scored';
      st := case when p_answer ? 'stage1' and p_answer ? 'stage2' then 'complete' else 'partial' end;
    else
      st := case when p_answer ? 'stage1' and length(btrim(coalesce(p_answer->'stage2'->>'text', ''))) > 0 then 'complete' else 'partial' end;
      oc := case when length(btrim(coalesce(p_answer->'stage2'->>'text', ''))) > 0 then 'pending_human' else 'scored' end;
      s2 := 0;
    end if;
    items := jsonb_build_object('stage1', jsonb_build_object('answered', p_answer ? 'stage1', 'correct', s1 > 0, 'weight', w1),
                                'stage2', jsonb_build_object('answered', p_answer ? 'stage2', 'correct', case when oc = 'scored' then s2 > 0 end, 'weight', w2));
    if oc = 'pending_human' then items := items || jsonb_build_object('auto_result_score', 100 * s1 / (w1 + w2)); end if;
    return jsonb_build_object('answer_state', st, 'outcome', oc, 'score', case when oc = 'scored' then 100 * (s1 + s2) / (w1 + w2) end,
      'earned', s1 + s2, 'total', w1 + w2, 'items', items);
  end if;
  raise exception 'type_unknown';
end $$;

create function gina.qt_score(p_type text, p_payload jsonb, p_key jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $$
begin
  if p_type in ('mark_text', 'error_fix', 'multi_choice', 'two_stage') then return gina.qt2_score(p_type, p_payload, p_key, p_answer); end if;
  return gina.qt_score_p1(p_type, p_payload, p_key, p_answer);
end $$;

create function gina.qt2_student_payload(p_type text, p_payload jsonb) returns jsonb
language sql immutable set search_path to '' as $$
  select case p_type
    when 'mark_text' then jsonb_build_object('unit', p_payload->>'unit',
      'segments', (select jsonb_agg(case when x ? 'id' then jsonb_build_object('id', x->>'id', 'text', x->>'text') else jsonb_build_object('text', x->>'text') end order by o)
                   from jsonb_array_elements(p_payload->'segments') with ordinality t(x, o)))
      || case when p_payload ? 'max_select' then jsonb_build_object('max_select', (p_payload->>'max_select')::int) else '{}'::jsonb end
    when 'error_fix' then jsonb_build_object('unit', p_payload->>'unit',
      'segments', (select jsonb_agg(case when x ? 'id' then jsonb_build_object('id', x->>'id', 'text', x->>'text') else jsonb_build_object('text', x->>'text') end order by o)
                   from jsonb_array_elements(p_payload->'segments') with ordinality t(x, o)))
    when 'multi_choice' then jsonb_build_object(
      'options', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by o) from jsonb_array_elements(p_payload->'options') with ordinality t(x, o)))
      || case when p_payload ? 'select_count' then jsonb_build_object('select_count', (p_payload->>'select_count')::int) else '{}'::jsonb end
    when 'two_stage' then jsonb_build_object(
      'stage1', jsonb_build_object('prompt', p_payload->'stage1'->>'prompt',
        'options', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by o) from jsonb_array_elements(p_payload->'stage1'->'options') with ordinality t(x, o))),
      'stage2', jsonb_build_object('prompt', p_payload->'stage2'->>'prompt', 'mode', p_payload->'stage2'->>'mode')
        || case when p_payload->'stage2'->>'mode' = 'choice' then jsonb_build_object('options',
             (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by o) from jsonb_array_elements(p_payload->'stage2'->'options') with ordinality t(x, o)))
           else '{}'::jsonb end)
  end
$$;

create function gina.qt_student_payload_v1(p_type text, p_payload jsonb, p_key jsonb, p_seed text) returns jsonb
language plpgsql immutable set search_path to '' as $$
begin
  if p_type in ('mark_text', 'error_fix', 'multi_choice', 'two_stage') then return gina.qt2_student_payload(p_type, p_payload); end if;
  return gina.qt_student_payload_p1(p_type, p_payload, p_key, p_seed);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'gina' and p.proname in ('qt_segment_ids', 'qt2_content_errors', 'qt_question_errors', 'qt2_answer_errors', 'qt_answer_errors',
      'qt2_score', 'qt_score', 'qt2_student_payload', 'qt_student_payload_v1', 'qt_question_errors_p1', 'qt_answer_errors_p1', 'qt_score_p1', 'qt_student_payload_p1')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
