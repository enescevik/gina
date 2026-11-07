-- Fork a parent-authored question and replace just its block in an open draft atomically.
create function public.revise_structured_question(
  p_request_id uuid, p_source_id uuid, p_draft_id uuid, p_version integer, p_changes jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  f uuid:=gina.family_id(); receipt public.mutation_receipts; d public.prova_drafts;
  q public.question_bank; k public.question_answer_keys; media record;
  intent jsonb; next_content jsonb; block_position integer;
begin
  if gina.is_parent() is not true or f is null or auth.uid() is null then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_request_id is null or p_source_id is null or p_draft_id is null or p_version is null or p_version<1
     or jsonb_typeof(p_changes) is distinct from 'object' or octet_length(p_changes::text)>100000
     or p_changes-array['stem','topic','difficulty','solution','explanation','payload','answer_key','points']<>'{}'::jsonb
     or (p_changes ? 'payload') <> (p_changes ? 'answer_key')
     or exists(select 1 from jsonb_each(p_changes) e where e.key in ('stem','topic','difficulty','solution','explanation')
       and jsonb_typeof(e.value) not in ('string','null'))
     or (p_changes ? 'points' and jsonb_typeof(p_changes->'points')<>'number')
  then raise exception 'invalid_input'; end if;

  intent:=jsonb_build_object('source',p_source_id,'draft',p_draft_id,'version',p_version,'changes',p_changes);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
  select * into receipt from public.mutation_receipts where request_id=p_request_id;
  if found then
    if receipt.family_id<>f or receipt.actor_id<>auth.uid() or receipt.operation<>'revise_structured_question'
      or receipt.payload<>intent then raise exception 'request_conflict'; end if;
    return (receipt.result->>'id')::uuid;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,53));
  select * into d from public.prova_drafts where id=p_draft_id and family_id=f for update;
  if not found then raise exception 'prova_draft_not_found'; end if;
  if d.exam_id is not null or d.submitted_at is not null then raise exception 'prova_draft_submitted'; end if;
  if d.discarded_at is not null then raise exception 'prova_draft_removed'; end if;
  if d.version<>p_version then raise exception 'prova_draft_changed'; end if;
  select (ordinality-1)::int into block_position
    from jsonb_array_elements(d.content->'blocks') with ordinality b
    where b.value->>'kind'='question' and b.value->>'source'='manual' and b.value->>'id'=p_source_id::text;
  if not found then raise exception 'structured_revision_ineligible'; end if;

  select * into q from public.question_bank where id=p_source_id and family_id=f
    and kind='structured' and provenance->>'generator'='parent' for share;
  if not found or exists(select 1 from public.question_source_members where question_id=p_source_id) then
    raise exception 'structured_revision_ineligible';
  end if;
  select * into strict k from public.question_answer_keys where question_id=q.id;
  if length(btrim(coalesce(case when p_changes ? 'stem' then p_changes->>'stem' else q.stem end,''))) not between 5 and 10000
    or length(btrim(coalesce(case when p_changes ? 'topic' then p_changes->>'topic' else q.topic end,''))) not between 1 and 200
    or coalesce(case when p_changes ? 'difficulty' then p_changes->>'difficulty' else q.difficulty::text end,'') not in ('kolay','orta','orta_ustu','zor')
    or length(coalesce(p_changes->>'solution',''))>10000 or length(coalesce(p_changes->>'explanation',''))>10000
  then raise exception 'question_incomplete'; end if;
  perform gina.qt_insert_structured(p_request_id,f,
    jsonb_build_object('grade',q.grade,'subject',q.subject,'topic',q.topic,'scenario_code',q.scenario_code,
      'interaction_type',q.interaction_type,'schema_version',q.schema_version,'payload',q.payload,'answer_key',k.key,
      'points',k.points,'difficulty',q.difficulty,'stem',q.stem,'expected_answer',q.expected_answer,
      'solution',q.solution,'explanation',q.explanation,'source_urls',to_jsonb(q.source_urls))||p_changes,
    q.provenance||jsonb_build_object('revised_from',q.id),auth.uid());
  insert into gina.question_period_tags(question_id,family_id,term,program,source)
    select p_request_id,f,t.term,t.program,t.source from gina.question_period_tags t where t.question_id=q.id;
  for media in select source_id,alt from public.learning_source_links where question_id=q.id order by created_at,id loop
    perform public.attach_question_source(p_request_id,media.source_id,media.alt);
  end loop;
  next_content:=jsonb_set(d.content,array['blocks',block_position::text,'id'],to_jsonb(p_request_id));
  if next_content ? 'fitAccepted' then
    next_content:=jsonb_set(next_content,'{fitAccepted}',(next_content->'fitAccepted')-q.id::text);
  end if;
  perform gina.validate_prova_draft(f,next_content);
  update public.prova_drafts set content=next_content,version=version+1,updated_at=clock_timestamp() where id=d.id;
  insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
    values(p_request_id,f,auth.uid(),'revise_structured_question',intent,jsonb_build_object('id',p_request_id));
  return p_request_id;
end;
$$;
revoke all on function public.revise_structured_question(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.revise_structured_question(uuid,uuid,uuid,integer,jsonb) to authenticated;
