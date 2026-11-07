-- Public lineage contains global IDs only. Private answer keys and request receipts stay separate.
create table public.global_question_revisions (
  previous_id uuid primary key references public.question_bank(id) on delete restrict,
  question_id uuid not null unique references public.question_bank(id) on delete restrict,
  check (previous_id<>question_id)
);
alter table public.global_question_revisions enable row level security;
revoke all on public.global_question_revisions from public,anon,authenticated;
grant select on public.global_question_revisions to authenticated,service_role;
create policy global_question_revisions_read on public.global_question_revisions for select to authenticated using (true);

create function public.admin_revise_global_question(
  p_request_id uuid,p_source_id uuid,p_changes jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  q public.question_bank; k public.question_answer_keys; previous public.audit_log;
  body jsonb; fingerprint text;
begin
  perform gina.assert_admin();
  if auth.uid() is null or p_request_id is null or p_source_id is null or p_request_id=p_source_id
    or jsonb_typeof(p_changes) is distinct from 'object' or octet_length(p_changes::text)>100000
    or p_changes-array['grade','subject','topic','difficulty','stem','solution','explanation','source_urls','payload','answer_key']<>'{}'::jsonb
    or (p_changes ? 'payload') <> (p_changes ? 'answer_key')
  then raise exception 'invalid_input'; end if;
  fingerprint:=encode(extensions.digest(p_changes::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
  select * into previous from public.audit_log
    where action='question_bank.revise_global' and target_table='question_bank' and target_id=p_request_id::text;
  if found then
    if previous.actor_id is distinct from auth.uid() or previous.details->>'previous_id' is distinct from p_source_id::text
      or previous.details->>'request_hash' is distinct from fingerprint then raise exception 'request_conflict'; end if;
    return p_request_id;
  end if;
  select * into q from public.question_bank where id=p_source_id and family_id is null and kind='structured' for update;
  if not found then raise exception 'question_not_found'; end if;
  if exists(select 1 from public.global_question_revisions where previous_id=q.id) then raise exception 'question_revision_changed'; end if;
  select * into strict k from public.question_answer_keys where question_id=q.id;
  body:=jsonb_build_object('grade',q.grade,'subject',q.subject,'topic',q.topic,'difficulty',q.difficulty,
    'stem',q.stem,'solution',q.solution,'explanation',q.explanation,'source_urls',to_jsonb(q.source_urls),
    'interaction_type',q.interaction_type,'schema_version',q.schema_version,'payload',q.payload,'answer_key',k.key,
    'points',k.points,'scenario_code',q.scenario_code,'expected_answer',q.expected_answer)||p_changes;
  if coalesce((body->>'grade')::integer,0) not between 1 and 12
    or length(btrim(coalesce(body->>'subject',''))) not between 1 and 80
    or length(btrim(coalesce(body->>'topic',''))) not between 1 and 200
    or length(btrim(coalesce(body->>'stem',''))) not between 5 and 10000
    or coalesce(body->>'difficulty','') not in ('kolay','orta','orta_ustu','zor')
    or length(coalesce(body->>'solution',''))>10000 or length(coalesce(body->>'explanation',''))>10000
    or jsonb_typeof(body->'source_urls') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(body->'source_urls') u where jsonb_typeof(u)<>'string')
  then raise exception 'question_incomplete'; end if;

  perform gina.qt_insert_structured(p_request_id,null,body,q.provenance||jsonb_build_object('revised_from',q.id),auth.uid());
  insert into public.global_question_revisions(previous_id,question_id) values(q.id,p_request_id);
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'question_bank.revise_global','question_bank',p_request_id::text,
      jsonb_build_object('previous_id',q.id,'question_id',p_request_id,'request_hash',fingerprint));
  return p_request_id;
end;
$$;
revoke all on function public.admin_revise_global_question(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_revise_global_question(uuid,uuid,jsonb) to authenticated;

create or replace view public.standalone_question_bank with (security_invoker = true) as
select q.id, q.family_id, q.grade, q.subject, q.topic, q.scenario_code, q.kind, q.difficulty, q.stem, q.choices, q.correct_key,
  q.expected_answer, q.solution, q.explanation, q.source_urls, q.provenance, q.times_asked, q.created_by, q.created_at, q.updated_at,
  q.interaction_type, q.schema_version, q.payload
from public.question_bank q
where not exists (select 1 from public.question_source_members m where m.question_id = q.id)
and not exists (select 1 from public.global_question_revisions r where r.previous_id=q.id);

create or replace view public.current_question_bank with (security_invoker = true) as
select q.id, q.family_id, q.grade, q.subject, q.topic, q.scenario_code, q.kind, q.difficulty, q.stem, q.choices, q.correct_key,
  q.expected_answer, q.solution, q.explanation, q.source_urls, q.provenance, q.times_asked, q.created_by, q.created_at, q.updated_at,
  q.interaction_type, q.schema_version, q.payload
from public.question_bank q
where not exists (
  select 1 from public.question_source_members m
  join public.question_source_groups g on g.id = m.group_id
  join public.question_source_groups newer on newer.family_id = g.family_id and newer.series_id = g.series_id and newer.version > g.version
  where m.question_id = q.id)
and not exists (select 1 from public.global_question_revisions r where r.previous_id=q.id);

create or replace function public.admin_question_facets()
returns table (grade smallint, subject text, topic text, question_count int, times_asked_total bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  perform gina.assert_admin();
  return query
  select q.grade,q.subject,q.topic,count(*)::int,coalesce(sum(q.times_asked),0)::bigint
  from public.current_question_bank q where q.family_id is null
  group by q.grade,q.subject,q.topic order by q.grade,q.subject,q.topic;
end;
$$;
