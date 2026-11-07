-- A short-lived authoring pilot. The interaction registry remains closed.
create table gina.crossword_pilot_access (
  family_id uuid primary key references public.families(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table gina.crossword_pilot_access enable row level security;
revoke all on table gina.crossword_pilot_access from public, anon, authenticated;

create function gina.crossword_pilot_allowed(p_family uuid, p_parent uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from gina.crossword_pilot_access access
    where access.family_id = p_family and access.parent_id = p_parent
      and access.expires_at > now()
  )
$$;
revoke all on function gina.crossword_pilot_allowed(uuid, uuid) from public, anon, authenticated;

create or replace function gina.qt_insert_structured(p_id uuid, p_family uuid, p_row jsonb, p_provenance jsonb, p_actor uuid) returns uuid
language plpgsql security definer set search_path to '' as $$
declare t public.interaction_types; v int; payload jsonb; key jsonb; points numeric; errs text[]; stem text;
begin
  select * into t from public.interaction_types where type = p_row->>'interaction_type';
  if t.type is null or t.family <> 'structured' or (
    not t.enabled and not (t.type = 'crossword' and gina.crossword_pilot_allowed(p_family, p_actor))
  ) then raise exception 'interaction_type_unavailable'; end if;
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

create or replace function gina.guard_exam_interaction_types() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  -- Yalnız içerik/iz değişiminde veya atamaya geçişte; 'completed' geçişi (bitirme) engellenmez.
  if tg_op = 'UPDATE' and new.question_ids = old.question_ids and new.assessment_track is not distinct from old.assessment_track
     and not (new.status = 'assigned' and old.status is distinct from 'assigned') then return new; end if;
  if new.assessment_track = 'meb_common' and exists (
    select 1 from public.question_bank q join public.interaction_types t on t.type = gina.question_interaction(q.kind, q.interaction_type)
    where q.id = any(new.question_ids) and t.practice_only) then
    raise exception 'interaction_type_not_allowed_for_track' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.question_bank q join public.interaction_types t on t.type = gina.question_interaction(q.kind, q.interaction_type)
    where q.id = any(new.question_ids) and not t.enabled
      and not (t.type = 'crossword' and q.family_id = new.family_id
        and gina.crossword_pilot_allowed(new.family_id, auth.uid()))) then
    raise exception 'interaction_type_unavailable' using errcode = 'P0001';
  end if;
  return new;
end $$;
