-- QT10–QT21 istemci desteği: question_bank görünümleri QT00 öncesi `q.*` ile kurulmuştu; yeni sütunlar
-- (interaction_type, schema_version, payload) sona eklenir. Filtre ve security_invoker aynen korunur.
-- Özel anahtar bu görünümlerde YOK (question_answer_keys ayrı, yalnız RPC).
create or replace view public.standalone_question_bank with (security_invoker = true) as
select q.id, q.family_id, q.grade, q.subject, q.topic, q.scenario_code, q.kind, q.difficulty, q.stem, q.choices, q.correct_key,
  q.expected_answer, q.solution, q.explanation, q.source_urls, q.provenance, q.times_asked, q.created_by, q.created_at, q.updated_at,
  q.interaction_type, q.schema_version, q.payload
from public.question_bank q
where not exists (select 1 from public.question_source_members m where m.question_id = q.id);

create or replace view public.current_question_bank with (security_invoker = true) as
select q.id, q.family_id, q.grade, q.subject, q.topic, q.scenario_code, q.kind, q.difficulty, q.stem, q.choices, q.correct_key,
  q.expected_answer, q.solution, q.explanation, q.source_urls, q.provenance, q.times_asked, q.created_by, q.created_at, q.updated_at,
  q.interaction_type, q.schema_version, q.payload
from public.question_bank q
where not exists (
  select 1 from public.question_source_members m
  join public.question_source_groups g on g.id = m.group_id
  join public.question_source_groups newer on newer.family_id = g.family_id and newer.series_id = g.series_id and newer.version > g.version
  where m.question_id = q.id);
