-- QT41/QT42 (Faz 2B) sunucu sözleşmesi: bölge seçme (şekil boyama, harita/şema bölgesi), saat,
-- ve bütün yapılandırılmış türlere eklenebilen tablo/grafik uyaran katmanı (stimulus).
-- Türler kapalı gelir (enabled=false). Dikte (QT43) ve sesli cevap (QT51) ses depolama + rıza kararı
-- gerektirdiği için burada YOK (bkz. PROGRESS: karar bekleyen). Problem kurma (QT44) açık uçlu rubrik ön ayarıdır.

insert into public.interaction_types(type, family, schema_version, policy, policy_version, auto_scorable, practice_only, phase, enabled) values
  ('region_select', 'structured', 1, 'balanced_selection', 1, true, true, '2B', false),
  ('clock', 'structured', 1, 'exact_time', 1, true, true, '2B', false);

alter function gina.qt_question_errors(text, int, jsonb, jsonb) rename to qt_question_errors_p2;
alter function gina.qt_answer_errors(text, jsonb, jsonb) rename to qt_answer_errors_p2;
alter function gina.qt_score(text, jsonb, jsonb, jsonb) rename to qt_score_p2;
alter function gina.qt_student_payload_v1(text, jsonb, jsonb, text) rename to qt_student_payload_p2;

-- Uyaran: {kind: table|bar_chart, caption, alt, ...}. Alternatif açıklama (alt) zorunlu; cevap anahtarı içermez
-- (pedagojik kontrol editör önizlemesinde; sunucu yalnız şekli/boyutu denetler).
create function gina.qt_stimulus_errors(s jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare r jsonb; ncol int;
begin
  if s is null then return '{}'; end if;
  if jsonb_typeof(s) <> 'object' or length(s::text) > 8000 then return array['stimulus_invalid']; end if;
  if jsonb_typeof(s->'alt') is distinct from 'string' or length(btrim(s->>'alt')) not between 5 and 1000
     or (s ? 'caption' and (jsonb_typeof(s->'caption') <> 'string' or length(s->>'caption') > 200)) then return array['stimulus_alt_invalid']; end if;
  if s->>'kind' = 'table' then
    if not gina.qt_only_keys(s, array['kind', 'caption', 'alt', 'columns', 'rows']) then return array['stimulus_invalid']; end if;
    if jsonb_typeof(s->'columns') <> 'array' or jsonb_array_length(s->'columns') not between 1 and 6
       or exists (select 1 from jsonb_array_elements(s->'columns') c where jsonb_typeof(c) <> 'string' or length(c #>> '{}') not between 1 and 60) then return array['stimulus_invalid']; end if;
    ncol := jsonb_array_length(s->'columns');
    if jsonb_typeof(s->'rows') <> 'array' or jsonb_array_length(s->'rows') not between 1 and 12 then return array['stimulus_invalid']; end if;
    for r in select value from jsonb_array_elements(s->'rows') loop
      if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> ncol
         or exists (select 1 from jsonb_array_elements(r) c where jsonb_typeof(c) not in ('string', 'number') or length(c #>> '{}') > 80) then return array['stimulus_invalid']; end if;
    end loop;
  elsif s->>'kind' = 'bar_chart' then
    if not gina.qt_only_keys(s, array['kind', 'caption', 'alt', 'x_label', 'y_label', 'bars', 'unit']) then return array['stimulus_invalid']; end if;
    if jsonb_typeof(s->'bars') <> 'array' or jsonb_array_length(s->'bars') not between 2 and 10 then return array['stimulus_invalid']; end if;
    if exists (select 1 from jsonb_array_elements(s->'bars') b where not gina.qt_only_keys(b, array['label', 'value'])
               or jsonb_typeof(b->'label') <> 'string' or length(b->>'label') not between 1 and 40
               or jsonb_typeof(b->'value') <> 'number' or (b->>'value')::numeric < 0 or (b->>'value')::numeric > 100000) then return array['stimulus_invalid']; end if;
    if exists (select 1 from unnest(array['x_label', 'y_label', 'unit']) f where s ? f and (jsonb_typeof(s->f) <> 'string' or length(s->>f) > 40)) then return array['stimulus_invalid']; end if;
  else
    return array['stimulus_invalid'];
  end if;
  return '{}';
exception when others then return array['stimulus_invalid'];
end $$;

-- HH:MM (00–23 / 00–59). Geçersizse NULL; dakika cinsinden.
create function gina.qt_parse_time(t text) returns int
language sql immutable set search_path to '' as $$
  select case when t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int end
$$;

create function gina.qt3_content_errors(p_type text, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare err text[] := '{}'; ids text[]; e jsonb; n int; p int; b jsonb;
begin
  if p_type = 'region_select' then
    if not gina.qt_only_keys(p_payload, array['figure', 'regions', 'max_select']) then return array['payload_unknown_field']; end if;
    if not gina.qt_only_keys(p_payload->'figure', array['kind', 'rows', 'cols', 'source']) or coalesce(p_payload->'figure'->>'kind', '') not in ('grid', 'sectors', 'image') then return array['figure_invalid']; end if;
    ids := gina.qt_entry_ids((select jsonb_agg(r - 'box') from jsonb_array_elements(p_payload->'regions') r), 48, 120);
    if ids is null or cardinality(ids) < 2 then return array['regions_invalid']; end if;
    n := cardinality(ids);
    if p_payload->'figure'->>'kind' = 'grid' and (jsonb_typeof(p_payload->'figure'->'rows') <> 'number' or jsonb_typeof(p_payload->'figure'->'cols') <> 'number'
       or (p_payload->'figure'->>'rows')::int * (p_payload->'figure'->>'cols')::int <> n or (p_payload->'figure'->>'rows')::int not between 1 and 8 or (p_payload->'figure'->>'cols')::int not between 1 and 8)
    then err := array_append(err, 'figure_invalid'); end if;
    if p_payload->'figure'->>'kind' = 'sectors' and n > 12 then err := array_append(err, 'figure_invalid'); end if;
    if p_payload->'figure'->>'kind' <> 'image' and (p_payload->'figure' ? 'source' or exists (select 1 from jsonb_array_elements(p_payload->'regions') r where r ? 'box')) then err := array_append(err, 'figure_invalid'); end if;
    if p_payload->'figure'->>'kind' = 'image' then
      -- Görsel, sorunun mevcut özel medya bağlantısıdır (question_image); bölgeler 0–1 normalize kutu.
      if coalesce(p_payload->'figure'->>'source', '') <> 'question_media' then err := array_append(err, 'figure_invalid'); end if;
      for e in select value from jsonb_array_elements(p_payload->'regions') loop
        b := e->'box';
        if jsonb_typeof(b) is distinct from 'array' or jsonb_array_length(b) <> 4
           or exists (select 1 from jsonb_array_elements(b) x where jsonb_typeof(x) <> 'number' or (x::text)::numeric < 0 or (x::text)::numeric > 1)
           or (b->>0)::numeric + (b->>2)::numeric > 1.000001 or (b->>1)::numeric + (b->>3)::numeric > 1.000001
           or (b->>2)::numeric < 0.03 or (b->>3)::numeric < 0.03 then err := array_append(err, 'region_box_invalid'); end if;
      end loop;
    end if;
    if p_payload ? 'max_select' and (jsonb_typeof(p_payload->'max_select') <> 'number' or (p_payload->>'max_select')::int not between 1 and n) then err := array_append(err, 'max_select_invalid'); end if;
    if gina.qt_only_keys(p_key, array['targets']) and jsonb_typeof(p_key->'targets') = 'array' then
      p := jsonb_array_length(p_key->'targets');
      if (select count(distinct x #>> '{}') from jsonb_array_elements(p_key->'targets') x where x #>> '{}' = any(ids)) <> p then err := array_append(err, 'key_value_invalid'); end if;
      if p < 1 or p >= n then err := array_append(err, 'selection_balance_invalid'); end if;
    elsif gina.qt_only_keys(p_key, array['count']) and jsonb_typeof(p_key->'count') = 'number' then
      -- "8 eş parçanın 3'ünü boya": hangi parça olduğu önemsiz, adet önemli (yalnız şekil türlerinde).
      if (p_key->>'count')::numeric <> trunc((p_key->>'count')::numeric) or (p_key->>'count')::int not between 1 and n - 1 then err := array_append(err, 'key_value_invalid'); end if;
      if p_payload->'figure'->>'kind' = 'image' then err := array_append(err, 'key_invalid'); end if;
    else return array_append(err, 'key_invalid');
    end if;
  elsif p_type = 'clock' then
    if not gina.qt_only_keys(p_payload, array['mode', 'display', 'step_minutes', 'shown_time']) then return array['payload_unknown_field']; end if;
    if coalesce(p_payload->>'mode', '') not in ('read', 'set') or coalesce(p_payload->>'display', '') not in ('analog', 'digital') then err := array_append(err, 'clock_invalid'); end if;
    if coalesce(p_payload->>'step_minutes', '') not in ('1', '5', '15', '30', '60') then err := array_append(err, 'clock_invalid'); end if;
    if not gina.qt_only_keys(p_key, array['time', 'accept_12h']) or gina.qt_parse_time(p_key->>'time') is null
       or (p_key ? 'accept_12h' and jsonb_typeof(p_key->'accept_12h') <> 'boolean') then return array_append(err, 'key_invalid'); end if;
    if gina.qt_parse_time(p_key->>'time') % coalesce((p_payload->>'step_minutes')::int, 1) <> 0 then err := array_append(err, 'key_not_on_step'); end if;
    -- Okuma modunda gösterilen saat sorunun kendisidir (çocuk analog/dijital saati okur); anahtarla aynı olmalı.
    if p_payload->>'mode' = 'read' and (gina.qt_parse_time(p_payload->>'shown_time') is null or p_payload->>'shown_time' <> p_key->>'time') then err := array_append(err, 'clock_invalid'); end if;
    if p_payload->>'mode' = 'set' and p_payload ? 'shown_time' then err := array_append(err, 'clock_invalid'); end if;
  else return array['type_unknown'];
  end if;
  return array(select distinct x from unnest(err) x order by 1);
exception when others then return array['content_invalid'];
end $$;

create function gina.qt_question_errors(p_type text, p_version int, p_payload jsonb, p_key jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare s text[];
begin
  if jsonb_typeof(p_payload) = 'object' and p_payload ? 'stimulus' then
    s := gina.qt_stimulus_errors(p_payload->'stimulus');
    if cardinality(s) > 0 then return s; end if;
    if length(p_payload::text) > 16000 then return array['payload_invalid']; end if;
    p_payload := p_payload - 'stimulus';
  end if;
  if p_type in ('region_select', 'clock') then
    if p_version is distinct from 1 then return array['schema_version_unsupported']; end if;
    if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text) > 16000 then return array['payload_invalid']; end if;
    if jsonb_typeof(p_key) is distinct from 'object' or length(p_key::text) > 16000 then return array['key_invalid']; end if;
    return gina.qt3_content_errors(p_type, p_payload, p_key);
  end if;
  return gina.qt_question_errors_p2(p_type, p_version, p_payload, p_key);
end $$;

create function gina.qt_answer_errors(p_type text, p_payload jsonb, p_answer jsonb) returns text[]
language plpgsql immutable set search_path to '' as $$
declare ids text[];
begin
  if jsonb_typeof(p_payload) = 'object' then p_payload := p_payload - 'stimulus'; end if;
  if p_type in ('region_select', 'clock') then
    if jsonb_typeof(p_answer) is distinct from 'object' or length(p_answer::text) > 8000 then return array['answer_invalid']; end if;
    if p_answer->>'type' is distinct from p_type then return array['answer_type_mismatch']; end if;
    if p_answer->>'v' is distinct from '1' then return array['answer_version_unsupported']; end if;
    if p_type = 'region_select' then
      if not gina.qt_only_keys(p_answer, array['type', 'v', 'selected']) or jsonb_typeof(p_answer->'selected') is distinct from 'array' then return array['answer_invalid']; end if;
      ids := array(select x->>'id' from jsonb_array_elements(p_payload->'regions') x);
      if exists (select 1 from jsonb_array_elements(p_answer->'selected') x where jsonb_typeof(x) <> 'string' or not (x #>> '{}' = any(ids))) then return array['answer_unknown_id']; end if;
      if (select count(distinct x) from jsonb_array_elements(p_answer->'selected') x) <> jsonb_array_length(p_answer->'selected') then return array['answer_value_invalid']; end if;
      if jsonb_array_length(p_answer->'selected') > coalesce((p_payload->>'max_select')::int, cardinality(ids)) then return array['answer_too_many']; end if;
    else
      if not gina.qt_only_keys(p_answer, array['type', 'v', 'time']) then return array['answer_unknown_field']; end if;
      if p_answer ? 'time' and (gina.qt_parse_time(p_answer->>'time') is null
         or gina.qt_parse_time(p_answer->>'time') % coalesce((p_payload->>'step_minutes')::int, 1) <> 0) then return array['answer_value_invalid']; end if;
    end if;
    return '{}';
  end if;
  return gina.qt_answer_errors_p2(p_type, p_payload, p_answer);
exception when others then return array['answer_invalid'];
end $$;

create function gina.qt_score(p_type text, p_payload jsonb, p_key jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $$
declare ids text[]; targets text[]; sel text[]; tp int; fp int; pn int; nn int; s numeric; a int; k int;
begin
  if jsonb_typeof(p_payload) = 'object' then p_payload := p_payload - 'stimulus'; end if;
  if p_type not in ('region_select', 'clock') then return gina.qt_score_p2(p_type, p_payload, p_key, p_answer); end if;
  if p_answer is not null and cardinality(gina.qt_answer_errors(p_type, p_payload, p_answer)) > 0 then raise exception 'answer_invalid_for_scoring'; end if;
  if p_type = 'region_select' then
    sel := coalesce(array(select jsonb_array_elements_text(p_answer->'selected')), '{}');
    if cardinality(sel) = 0 then
      return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', 1, 'items', '{}'::jsonb);
    end if;
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'regions') x);
    if p_key ? 'count' then
      s := case when cardinality(sel) = (p_key->>'count')::int then 1 else 0 end;
      return jsonb_build_object('answer_state', 'complete', 'outcome', 'scored', 'score', 100 * s, 'earned', s, 'total', 1,
        'items', jsonb_build_object('selected', cardinality(sel), 'required', (p_key->>'count')::int));
    end if;
    targets := array(select jsonb_array_elements_text(p_key->'targets'));
    pn := cardinality(targets); nn := cardinality(ids) - pn;
    tp := (select count(*) from unnest(sel) x where x = any(targets)); fp := cardinality(sel) - tp;
    s := greatest(0, tp::numeric / pn - fp::numeric / nn);
    return jsonb_build_object('answer_state', 'complete', 'outcome', 'scored', 'score', 100 * s, 'earned', s, 'total', 1,
      'items', jsonb_build_object('true_positive', tp, 'false_positive', fp, 'targets', pn, 'distractors', nn));
  end if;
  a := gina.qt_parse_time(p_answer->>'time');
  if a is null then
    return jsonb_build_object('answer_state', 'unanswered', 'outcome', 'unanswered', 'score', null, 'earned', 0, 'total', 1, 'items', '{}'::jsonb);
  end if;
  k := gina.qt_parse_time(p_key->>'time');
  s := case when a = k or (coalesce((p_key->>'accept_12h')::boolean, true) and a % 720 = k % 720) then 1 else 0 end;
  return jsonb_build_object('answer_state', 'complete', 'outcome', 'scored', 'score', 100 * s, 'earned', s, 'total', 1, 'items', jsonb_build_object('time', jsonb_build_object('correct', s = 1)));
end $$;

create function gina.qt_student_payload_v1(p_type text, p_payload jsonb, p_key jsonb, p_seed text) returns jsonb
language plpgsql immutable set search_path to '' as $$
declare st jsonb := p_payload->'stimulus'; base jsonb;
begin
  p_payload := p_payload - 'stimulus';
  if p_type = 'region_select' then
    base := jsonb_build_object('figure', jsonb_strip_nulls(jsonb_build_object('kind', p_payload->'figure'->>'kind', 'rows', p_payload->'figure'->'rows',
              'cols', p_payload->'figure'->'cols', 'source', p_payload->'figure'->>'source')),
      'regions', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x->>'id', 'text', x->>'text', 'box', x->'box')) order by o) from jsonb_array_elements(p_payload->'regions') with ordinality t(x, o)))
      || case when p_payload ? 'max_select' then jsonb_build_object('max_select', (p_payload->>'max_select')::int) else '{}'::jsonb end;
  elsif p_type = 'clock' then
    base := jsonb_build_object('mode', p_payload->>'mode', 'display', p_payload->>'display', 'step_minutes', (p_payload->>'step_minutes')::int)
      || case when p_payload->>'mode' = 'read' then jsonb_build_object('shown_time', p_payload->>'shown_time') else '{}'::jsonb end;
  else
    base := gina.qt_student_payload_p2(p_type, p_payload, p_key, p_seed);
  end if;
  -- Uyaran yeniden kurulur (izin listesi).
  if st is not null then
    base := base || jsonb_build_object('stimulus', case st->>'kind'
      when 'table' then jsonb_strip_nulls(jsonb_build_object('kind', 'table', 'caption', st->>'caption', 'alt', st->>'alt', 'columns', st->'columns', 'rows', st->'rows'))
      when 'bar_chart' then jsonb_strip_nulls(jsonb_build_object('kind', 'bar_chart', 'caption', st->>'caption', 'alt', st->>'alt', 'x_label', st->>'x_label', 'y_label', st->>'y_label', 'unit', st->>'unit',
        'bars', (select jsonb_agg(jsonb_build_object('label', b->>'label', 'value', b->'value') order by o) from jsonb_array_elements(st->'bars') with ordinality t(b, o))))
      end);
  end if;
  return base;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'gina' and p.proname in ('qt_stimulus_errors', 'qt_parse_time', 'qt3_content_errors', 'qt_question_errors', 'qt_answer_errors', 'qt_score',
      'qt_student_payload_v1', 'qt_question_errors_p2', 'qt_answer_errors_p2', 'qt_score_p2', 'qt_student_payload_p2')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
