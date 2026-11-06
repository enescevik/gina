-- QT01 — sunucu puanlama otoritesi (SQL). Core ikinci bağımsız puan motoru değildir.
-- Genel formül: soru puanı = 100 × kazanılan alt madde ağırlığı / toplam ağırlık; tek final yuvarlama
-- (exam_answers.score_exact kesin değer; sınav toplamı soru ağırlığıyla ağırlıklı ve bir kez yuvarlanır).

-- 1) Cevap doğrulaması (kayıt sırasında). Boş dizi = geçerli. --------------------------------------
create function gina.qt_answer_errors(p_type text, p_payload jsonb, p_answer jsonb)
returns text[] language plpgsql immutable set search_path to '' as $$
declare ids text[]; ids2 text[]; k text; v jsonb; used text[] := '{}'; cnt jsonb := '{}'; e jsonb; field text;
begin
  if jsonb_typeof(p_answer) is distinct from 'object' or length(p_answer::text) > 8000 then return array['answer_invalid']; end if;
  if p_answer->>'type' is distinct from p_type then return array['answer_type_mismatch']; end if;
  if p_answer->>'v' is distinct from '1' then return array['answer_version_unsupported']; end if;
  field := case p_type when 'true_false' then 'items' when 'fill_blank' then 'blanks' when 'matching' then 'pairs'
    when 'classification' then 'placement' when 'ordering' then 'order' else null end;
  if p_type = 'numeric' then
    if not gina.qt_only_keys(p_answer, array['type', 'v', 'value', 'unit']) then return array['answer_unknown_field']; end if;
    if p_answer ? 'value' and (jsonb_typeof(p_answer->'value') <> 'string' or length(p_answer->>'value') > 40) then return array['answer_value_invalid']; end if;
    if p_answer ? 'unit' then
      if jsonb_typeof(p_answer->'unit') <> 'string'
         or not (p_answer->>'unit' = any(array(select x->>'id' from jsonb_array_elements(coalesce(p_payload->'units', '[]')) x)))
      then return array['answer_unknown_id']; end if;
    end if;
    return '{}';
  end if;
  if field is null then return array['type_unknown']; end if;
  if not gina.qt_only_keys(p_answer, array['type', 'v', field]) then return array['answer_unknown_field']; end if;
  if p_type = 'ordering' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'items') x);
    if jsonb_typeof(p_answer->'order') is distinct from 'array' or jsonb_array_length(p_answer->'order') <> cardinality(ids)
       or (select count(distinct x #>> '{}') from jsonb_array_elements(p_answer->'order') x where jsonb_typeof(x) = 'string' and x #>> '{}' = any(ids)) <> cardinality(ids)
    then return array['answer_order_invalid']; end if;
    return '{}';
  end if;
  if jsonb_typeof(p_answer->field) is distinct from 'object' then return array['answer_invalid']; end if;
  if p_type = 'true_false' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'statements') x);
    for k, v in select * from jsonb_each(p_answer->field) loop
      if not (k = any(ids)) then return array['answer_unknown_id']; end if;
      if jsonb_typeof(v) <> 'boolean' then return array['answer_value_invalid']; end if;
    end loop;
  elsif p_type = 'fill_blank' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x->>'type' = 'blank');
    ids2 := array(select x->>'id' from jsonb_array_elements(coalesce(p_payload->'bank', '[]')) x);
    for k, v in select * from jsonb_each(p_answer->field) loop
      if not (k = any(ids)) then return array['answer_unknown_id']; end if;
      if p_payload->>'input' = 'bank' then
        if not gina.qt_only_keys(v, array['token']) or jsonb_typeof(v->'token') <> 'string' or not (v->>'token' = any(ids2)) then return array['answer_value_invalid']; end if;
        if not coalesce((p_payload->>'bank_reuse')::boolean, false) and v->>'token' = any(used) then return array['answer_token_reused']; end if;
        used := array_append(used, v->>'token');
      else
        if not gina.qt_only_keys(v, array['text']) or jsonb_typeof(v->'text') <> 'string' or length(v->>'text') > 120 then return array['answer_value_invalid']; end if;
      end if;
    end loop;
  elsif p_type = 'matching' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'left') x);
    ids2 := array(select x->>'id' from jsonb_array_elements(p_payload->'right') x);
    for k, v in select * from jsonb_each(p_answer->field) loop
      if not (k = any(ids)) then return array['answer_unknown_id']; end if;
      if jsonb_typeof(v) <> 'string' or not (v #>> '{}' = any(ids2)) then return array['answer_value_invalid']; end if;
      if p_payload->>'policy' = 'one_to_one' and v #>> '{}' = any(used) then return array['answer_pair_reused']; end if;
      used := array_append(used, v #>> '{}');
    end loop;
  elsif p_type = 'classification' then
    ids := array(select x->>'id' from jsonb_array_elements(p_payload->'items') x);
    ids2 := array(select x->>'id' from jsonb_array_elements(p_payload->'categories') x);
    for k, v in select * from jsonb_each(p_answer->field) loop
      if not (k = any(ids)) then return array['answer_unknown_id']; end if;
      if jsonb_typeof(v) <> 'string' or not (v #>> '{}' = any(ids2)) then return array['answer_value_invalid']; end if;
      cnt := jsonb_set(cnt, array[v #>> '{}'], to_jsonb(coalesce((cnt->>(v #>> '{}'))::int, 0) + 1));
    end loop;
    for e in select value from jsonb_array_elements(p_payload->'categories') loop
      if e ? 'capacity' and coalesce((cnt->>(e->>'id'))::int, 0) > (e->>'capacity')::int then return array['answer_capacity_exceeded']; end if;
    end loop;
  end if;
  return '{}';
exception when others then return array['answer_invalid'];
end $$;

-- 2) Deterministik puanlama ---------------------------------------------------------------------
-- Dönen: {answer_state: unanswered|partial|complete, outcome: scored|pending_human|unanswered,
--         score: 0..100|null, earned, total, items: {alt_id: {answered, correct, weight}}, policy, policy_version}
create function gina.qt_score(p_type text, p_payload jsonb, p_key jsonb, p_answer jsonb)
returns jsonb language plpgsql immutable set search_path to '' as $$
declare
  ids text[]; i text; w numeric; earned numeric := 0; total numeric := 0; answered int := 0; n int := 0;
  items jsonb := '{}'; a jsonb; ok boolean; is_answered boolean; field text; ci boolean;
  nx numeric; ny numeric; f numeric; tol numeric; uw numeric; unit_ok boolean; val_ok boolean; has_val boolean; has_unit boolean;
  best numeric := 0; required numeric; o jsonb; c numeric; state text; outcome text; score numeric;
begin
  if p_answer is not null and cardinality(gina.qt_answer_errors(p_type, p_payload, p_answer)) > 0 then
    raise exception 'answer_invalid_for_scoring';
  end if;
  if p_type in ('true_false', 'fill_blank', 'matching', 'classification') then
    ids := case p_type
      when 'true_false' then array(select x->>'id' from jsonb_array_elements(p_payload->'statements') x)
      when 'fill_blank' then array(select x->>'id' from jsonb_array_elements(p_payload->'segments') x where x->>'type' = 'blank')
      when 'matching' then array(select x->>'id' from jsonb_array_elements(p_payload->'left') x)
      else array(select x->>'id' from jsonb_array_elements(p_payload->'items') x) end;
    field := case p_type when 'true_false' then 'items' when 'fill_blank' then 'blanks' when 'matching' then 'pairs' else 'placement' end;
    ci := coalesce((p_key->>'case_insensitive')::boolean, false);
    foreach i in array ids loop
      n := n + 1;
      w := coalesce((p_key->'weights'->>i)::numeric, 1);
      a := p_answer->field->i;
      is_answered := a is not null and jsonb_typeof(a) <> 'null';
      ok := false;
      if is_answered then
        if p_type = 'true_false' then ok := a = p_key->'answers'->i;
        elsif p_type = 'matching' then ok := a = p_key->'pairs'->i;
        elsif p_type = 'classification' then ok := a = p_key->'membership'->i;
        elsif p_payload->>'input' = 'bank' then ok := (p_key->'blanks'->i->'tokens') @> jsonb_build_array(a->>'token');
        else
          is_answered := length(gina.qt_norm_text(a->>'text', false)) > 0;
          ok := is_answered and exists (select 1 from jsonb_array_elements_text(p_key->'blanks'->i->'accepted') acc
                                        where gina.qt_norm_text(acc, ci) = gina.qt_norm_text(a->>'text', ci));
        end if;
      end if;
      if is_answered then answered := answered + 1; end if;
      total := total + w;
      if ok then earned := earned + w; end if;
      items := items || jsonb_build_object(i, jsonb_build_object('answered', is_answered, 'correct', ok, 'weight', w));
    end loop;
    state := case when answered = 0 then 'unanswered' when answered < n then 'partial' else 'complete' end;
    outcome := case when answered = 0 then 'unanswered' else 'scored' end;
    score := case when outcome = 'scored' then 100 * earned / total end;

  elsif p_type = 'numeric' then
    has_val := length(btrim(coalesce(p_answer->>'value', ''))) > 0;
    has_unit := p_answer ? 'unit';
    nx := gina.qt_parse_number(p_answer->>'value');
    ny := gina.qt_parse_number(p_key->>'value');
    if coalesce((p_payload->>'unit_required')::boolean, false) then
      f := case when has_unit then coalesce((p_key->'unit_factors'->>(p_answer->>'unit'))::numeric,
                                            case when p_answer->>'unit' = p_key->>'unit' then 1 end) end;
      unit_ok := f is not null;
      state := case when not has_val and not has_unit then 'unanswered' when has_val and has_unit then 'complete' else 'partial' end;
    else
      f := 1; unit_ok := true;
      state := case when has_val then 'complete' else 'unanswered' end;
    end if;
    tol := greatest(coalesce((p_key->>'abs_tolerance')::numeric, 0), coalesce((p_key->>'rel_tolerance')::numeric, 0) * abs(ny));
    val_ok := nx is not null and f is not null and abs(nx * f - ny) <= tol;
    uw := case when coalesce((p_payload->>'unit_required')::boolean, false) then coalesce((p_key->>'unit_weight')::numeric, 0) else 0 end;
    total := 1;
    earned := case when uw > 0 then (case when val_ok then 1 - uw else 0 end) + (case when unit_ok and has_unit then uw else 0 end)
                   else case when val_ok then 1 else 0 end end;
    items := jsonb_build_object('value', jsonb_build_object('answered', has_val, 'correct', val_ok, 'parsed', nx is not null, 'weight', 1 - uw));
    if uw > 0 then items := items || jsonb_build_object('unit', jsonb_build_object('answered', has_unit, 'correct', unit_ok and has_unit, 'weight', uw)); end if;
    if state = 'unanswered' then outcome := 'unanswered';
    elsif coalesce((p_key->>'process_required')::boolean, false) then outcome := 'pending_human';
    else outcome := 'scored'; end if;
    score := case when outcome = 'scored' then 100 * earned end;
    if outcome = 'pending_human' then items := items || jsonb_build_object('auto_result_score', 100 * earned); end if;

  elsif p_type = 'ordering' then
    n := jsonb_array_length(p_payload->'items');
    required := n * (n - 1) / 2;
    if p_answer is null or jsonb_typeof(p_answer->'order') is distinct from 'array' then
      state := 'unanswered'; outcome := 'unanswered'; score := null; total := required;
    else
      for o in select value from jsonb_array_elements(p_key->'orders') loop
        select count(*) into c
        from jsonb_array_elements_text(p_answer->'order') with ordinality a1(id, pos)
        join jsonb_array_elements_text(p_answer->'order') with ordinality a2(id, pos) on a1.pos < a2.pos
        join jsonb_array_elements_text(o) with ordinality k1(id, pos) on k1.id = a1.id
        join jsonb_array_elements_text(o) with ordinality k2(id, pos) on k2.id = a2.id
        where k1.pos < k2.pos;
        best := greatest(best, c);
      end loop;
      earned := best; total := required;
      state := 'complete'; outcome := 'scored'; score := 100 * best / required;
      items := jsonb_build_object('pairs_correct', best, 'pairs_required', required);
    end if;
  else
    raise exception 'type_unknown';
  end if;
  return jsonb_build_object('answer_state', state, 'outcome', outcome, 'score', score, 'earned', earned, 'total', total, 'items', items);
end $$;

-- 3) Öğrenci projeksiyonu: izin listesiyle yeniden kurulur (payload'tan alan silmek değil). -----------
-- Karıştırma deneme/sınav içinde sabittir (seed = exam id). Anahtar yalnız "çözülmüş sırada gösterme" için okunur.
create function gina.qt_student_payload(p_type text, p_payload jsonb, p_key jsonb, p_seed text)
returns jsonb language plpgsql immutable set search_path to '' as $$
declare items jsonb; ids jsonb; o jsonb; shift int := 0; n int;
begin
  if p_type = 'true_false' then
    return jsonb_build_object('statements', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by ord)
      from jsonb_array_elements(p_payload->'statements') with ordinality t(x, ord)));
  elsif p_type = 'fill_blank' then
    return jsonb_build_object(
      'segments', (select jsonb_agg(case when x->>'type' = 'blank' then jsonb_build_object('type', 'blank', 'id', x->>'id')
                                         else jsonb_build_object('type', 'text', 'text', x->>'text') end order by ord)
                   from jsonb_array_elements(p_payload->'segments') with ordinality t(x, ord)),
      'input', p_payload->>'input')
      || case when p_payload->>'input' = 'bank' then jsonb_build_object(
           'bank', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by md5(p_seed || ':' || (x->>'id')))
                    from jsonb_array_elements(p_payload->'bank') x),
           'bank_reuse', coalesce((p_payload->>'bank_reuse')::boolean, false)) else '{}'::jsonb end;
  elsif p_type = 'matching' then
    return jsonb_build_object(
      'left', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by ord)
               from jsonb_array_elements(p_payload->'left') with ordinality t(x, ord)),
      'right', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by md5(p_seed || ':' || (x->>'id')))
                from jsonb_array_elements(p_payload->'right') x),
      'policy', p_payload->>'policy');
  elsif p_type = 'numeric' then
    return jsonb_build_object(
      'units', coalesce((select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by ord)
                from jsonb_array_elements(p_payload->'units') with ordinality t(x, ord)), '[]'::jsonb),
      'unit_required', coalesce((p_payload->>'unit_required')::boolean, false));
  elsif p_type = 'ordering' then
    select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by md5(p_seed || ':' || (x->>'id'))) into items
    from jsonb_array_elements(p_payload->'items') x;
    n := jsonb_array_length(items);
    -- Kabul edilen bir sırayla aynı gösterilirse döndür (çözülmüş sıra gösterilmez).
    loop
      ids := (select jsonb_agg(items->(((ord - 1 + shift) % n)::int)->'id' order by ord) from generate_series(1, n) ord);
      exit when shift >= n or not exists (select 1 from jsonb_array_elements(p_key->'orders') o2 where o2.value = ids);
      shift := shift + 1;
    end loop;
    return jsonb_build_object('items', (select jsonb_agg(items->(((ord - 1 + shift) % n)::int) order by ord) from generate_series(1, n) ord),
      'mode', p_payload->>'mode');
  elsif p_type = 'classification' then
    return jsonb_build_object(
      'items', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text') order by md5(p_seed || ':' || (x->>'id')))
                from jsonb_array_elements(p_payload->'items') x),
      'categories', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'text', x->>'text')
                       || case when x ? 'capacity' then jsonb_build_object('capacity', (x->>'capacity')::int) else '{}'::jsonb end order by ord)
                     from jsonb_array_elements(p_payload->'categories') with ordinality t(x, ord)));
  end if;
  raise exception 'type_unknown';
end $$;

-- 4) Bitişte yapılandırılmış cevapları puanla (bir kez; veli puanı ezilmez) ---------------------------
create function gina.score_structured_answers(p_attempt_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare r record; res jsonb; cur text;
begin
  for r in
    select ans.question_id, ans.answer, q.payload, q.stem, q.interaction_type, q.schema_version, k.key, k.policy, k.policy_version, k.points,
           b.content_hash bound_hash, b.policy bound_policy, b.policy_version bound_policy_version
    from public.exam_attempts a
    join public.exam_answers ans on ans.attempt_id = a.id
    join public.question_bank q on q.id = ans.question_id and q.kind = 'structured'
    join public.question_answer_keys k on k.question_id = q.id
    left join gina.exam_item_bindings b on b.exam_id = a.exam_id and b.question_id = q.id
    where a.id = p_attempt_id and a.status <> 'in_progress' and ans.graded_by is null and ans.answer is not null
    for update of ans
  loop
    cur := gina.qt_content_hash(r.stem, r.interaction_type, r.schema_version, r.payload, r.key, r.policy, r.policy_version, r.points);
    if r.bound_hash is not null and r.bound_hash <> cur then raise exception 'question_version_changed'; end if;
    res := gina.qt_score(r.interaction_type, r.payload, r.key, r.answer)
           || jsonb_build_object('policy', coalesce(r.bound_policy, r.policy), 'policy_version', coalesce(r.bound_policy_version, r.policy_version));
    update public.exam_answers
       set score_details = res,
           scored_policy = coalesce(r.bound_policy, r.policy) || '@' || coalesce(r.bound_policy_version, r.policy_version),
           score_exact = case when res->>'outcome' = 'scored' then (res->>'score')::numeric end,
           score = case when res->>'outcome' = 'scored' then round((res->>'score')::numeric)::smallint end,
           graded_by = case when res->>'outcome' = 'scored' then 'auto' end,
           graded_at = case when res->>'outcome' = 'scored' then now() end
     where attempt_id = p_attempt_id and question_id = r.question_id;
  end loop;
end $$;
revoke all on function gina.score_structured_answers(uuid) from public, anon, authenticated;

-- 5) Toplamlar: tek projeksiyon; recompute bunu yazar. Eski (mc/open) alanların anlamı aynen korunur.
-- items_*: scored = kesin puanlı; pending = insan incelemesi bekleyen (açık uçlu cevaplı + yapılandırılmış
-- pending_human); unanswered = cevapsız (MC cevapsızı eski kuralla 0 puan alır ve 'scored' sayılır);
-- partial = yapılandırılmış alt maddeleri kısmen dolu.
create or replace function gina.attempt_totals_projection(p_attempt_id uuid) returns jsonb
language sql stable security definer set search_path to '' as $function$
 with items as (
  select q.kind,
   case when q.kind='multiple_choice' then case when coalesce(ans.is_correct,false) then 100 else 0 end
        when q.kind='structured' then case when ans.score is not null then coalesce(ans.score_exact, ans.score) end
        else ans.score::numeric end as value,
   coalesce(b.points, 1) as weight,
   case when q.kind='open_ended' then gina.open_answer_state(ans.score,ans.answer_text,ans.answer_document) end as open_state,
   case
     when q.kind='multiple_choice' then case when ans.answer_key is null then 'unanswered' else 'complete' end
     when q.kind='open_ended' then case when gina.open_answer_present(ans.answer_text,ans.answer_document) then 'complete' else 'unanswered' end
     else coalesce(ans.score_details->>'answer_state', case when ans.answer is null then 'unanswered' else 'complete' end) end as answer_state,
   case
     when q.kind='multiple_choice' then 'scored'
     when ans.score is not null then 'scored'
     when q.kind='open_ended' then case when gina.open_answer_present(ans.answer_text,ans.answer_document) then 'pending' else 'unscored' end
     when ans.score_details->>'outcome'='pending_human' then 'pending'
     when ans.answer is not null and ans.score_details is null then 'pending'
     else 'unscored' end as score_state
  from public.exam_attempts a
  join public.exams e on e.id=a.exam_id
  join unnest(e.question_ids) qid on true
  join public.question_bank q on q.id=qid
  left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
  left join gina.exam_item_bindings b on b.exam_id=e.id and b.question_id=q.id
  where a.id=p_attempt_id
 ), agg as (
  select count(*) filter (where kind='open_ended')::int open_total,
   count(*) filter (where open_state='graded')::int open_graded,
   count(*) filter (where open_state='pending')::int open_pending,
   count(*) filter (where open_state='unanswered')::int open_unanswered,
   count(*) filter (where kind='structured')::int structured_total,
   count(*) filter (where kind='structured' and value is not null)::int structured_graded,
   count(*)::int items_total,
   count(*) filter (where score_state='scored')::int items_scored,
   count(*) filter (where score_state='pending')::int items_pending,
   count(*) filter (where answer_state='unanswered')::int items_unanswered,
   count(*) filter (where answer_state='partial')::int items_partial,
   case when sum(weight) filter (where value is not null) > 0
     then round(sum(value*weight) filter (where value is not null) / sum(weight) filter (where value is not null))::smallint end score_pct
  from items
 )
 select jsonb_build_object(
  'status',case when a.status in('submitted','graded') and agg.open_graded=agg.open_total and agg.structured_graded=agg.structured_total then 'graded'
                when a.status='graded' then 'submitted' else a.status::text end,
  'score_pct',agg.score_pct,'open_total',agg.open_total,'open_graded',agg.open_graded,'open_pending',agg.open_pending,
  'open_unanswered',agg.open_unanswered,'provisional',agg.open_graded<agg.open_total or agg.structured_graded<agg.structured_total,
  'items_total',agg.items_total,'items_scored',agg.items_scored,'items_pending',agg.items_pending,
  'items_unanswered',agg.items_unanswered,'items_partial',agg.items_partial)
 from public.exam_attempts a,agg where a.id=p_attempt_id;
$function$;
revoke all on function gina.attempt_totals_projection(uuid) from public,anon,authenticated,service_role;

alter table public.exam_attempts
  add column items_total integer, add column items_scored integer, add column items_pending integer,
  add column items_unanswered integer, add column items_partial integer;
comment on column public.exam_attempts.items_pending is 'QT00: insan (veli) puanı bekleyen madde sayısı (açık uçlu + yapılandırılmış pending_human).';

create or replace function gina.recompute_attempt_totals(p_attempt_id uuid) returns public.exam_attempts
language plpgsql security definer set search_path to 'public' as $function$
declare v_row public.exam_attempts%rowtype; p jsonb;
begin
  perform gina.score_structured_answers(p_attempt_id);
  p := gina.attempt_totals_projection(p_attempt_id);
  update public.exam_attempts a
  set open_total = (p->>'open_total')::int,
      open_graded = (p->>'open_graded')::int,
      open_pending = (p->>'open_pending')::int,
      open_unanswered = (p->>'open_unanswered')::int,
      score_pct = (p->>'score_pct')::smallint,
      provisional = (p->>'provisional')::boolean,
      items_total = (p->>'items_total')::int,
      items_scored = (p->>'items_scored')::int,
      items_pending = (p->>'items_pending')::int,
      items_unanswered = (p->>'items_unanswered')::int,
      items_partial = (p->>'items_partial')::int,
      status = (p->>'status')::public.attempt_status,
      graded_at = case when p->>'status' = 'graded' then coalesce(a.graded_at, now()) else null end
  where a.id = p_attempt_id
  returning a.* into v_row;
  return v_row;
end;
$function$;

-- Eski düzeltme aracı (apply_legacy_open_zero_corrections) snapshot ile projeksiyonu karşılaştırır;
-- yeni items_* alanları ikisinde de bulunur.
create or replace function gina.attempt_totals_snapshot(a public.exam_attempts) returns jsonb
language sql immutable set search_path to '' as $function$
 select jsonb_build_object('status',a.status,'score_pct',a.score_pct,'open_total',a.open_total,'open_graded',a.open_graded,
  'open_pending',a.open_pending,'open_unanswered',a.open_unanswered,'provisional',a.provisional,'graded_at',a.graded_at,
  'items_total',a.items_total,'items_scored',a.items_scored,'items_pending',a.items_pending,
  'items_unanswered',a.items_unanswered,'items_partial',a.items_partial);
$function$;
revoke all on function gina.attempt_totals_snapshot(public.exam_attempts) from public,anon,authenticated,service_role;
