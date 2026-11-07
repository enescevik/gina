-- The old group, its members and exam bindings remain immutable. Only this open draft advances.
create function public.revise_question_source_group(
  p_request_id uuid,p_group_id uuid,p_draft_id uuid,p_version integer,p_changes jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  f uuid:=gina.family_id(); r public.mutation_receipts; d public.prova_drafts;
  g public.question_source_groups; m record; q public.question_bank; k public.question_answer_keys; media record;
  intent jsonb; result jsonb; next_content jsonb; prov jsonb; review jsonb;
  position_in_draft integer; ids uuid[]:='{}'; old_ids text[]:='{}'; member_count integer:=0;
  title text; body text; prompt text; stem text; qid uuid;
begin
  if gina.is_parent() is not true or f is null or auth.uid() is null then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_request_id is null or p_group_id is null or p_draft_id is null or coalesce(p_version,0)<1
    or jsonb_typeof(p_changes) is distinct from 'object' or octet_length(p_changes::text)>60000
    or p_changes-array['title','body','prompts']<>'{}'::jsonb
    or jsonb_typeof(p_changes->'title') is distinct from 'string'
    or jsonb_typeof(p_changes->'body') is distinct from 'string'
    or jsonb_typeof(p_changes->'prompts') is distinct from 'object'
  then raise exception 'invalid_input'; end if;
  title:=btrim(p_changes->>'title'); body:=btrim(p_changes->>'body');
  if length(title) not between 1 and 160 or length(body)>6000 then raise exception 'question_group_incomplete'; end if;

  intent:=jsonb_build_object('group',p_group_id,'draft',p_draft_id,'version',p_version,'changes',p_changes);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
  select * into r from public.mutation_receipts where request_id=p_request_id;
  if found then
    if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'revise_question_source_group' or r.payload<>intent then
      raise exception 'request_conflict';
    end if;
    return r.result;
  end if;
  if not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true'::jsonb) then
    raise exception 'question_groups_unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,53));
  select * into d from public.prova_drafts where id=p_draft_id and family_id=f for update;
  if not found then raise exception 'prova_draft_not_found'; end if;
  if d.submitted_at is not null or d.exam_id is not null then raise exception 'prova_draft_submitted'; end if;
  if d.discarded_at is not null then raise exception 'prova_draft_removed'; end if;
  if d.version<>p_version then raise exception 'prova_draft_changed'; end if;
  select (ordinality-1)::integer into position_in_draft
  from jsonb_array_elements(d.content->'blocks') with ordinality b
  where b.value->>'kind'='group' and b.value->>'source' in ('ai','manual') and b.value->>'id'=p_group_id::text;
  if not found then raise exception 'question_group_revision_ineligible'; end if;

  select * into g from public.question_source_groups where id=p_group_id and family_id=f and finalized_at is not null;
  if not found then raise exception 'question_group_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(g.series_id::text,52));
  if exists(select 1 from public.question_source_groups where family_id=f and series_id=g.series_id and version>g.version) then
    raise exception 'question_group_changed';
  end if;
  if length(body)<20 and not exists(
    select 1 from public.question_source_members a
    join public.learning_source_links l on l.question_id=a.question_id
    join public.learning_sources s on s.id=l.source_id and s.family_id=f and s.status='ready'
    where a.group_id=g.id
  ) then raise exception 'question_group_incomplete'; end if;

  insert into public.question_source_groups(id,family_id,series_id,version,previous_id,title,body,grade,subject)
    values(p_request_id,f,g.series_id,g.version+1,g.id,title,body,g.grade,g.subject);
  for m in select question_id,position from public.question_source_members where group_id=g.id order by position loop
    select * into strict q from public.question_bank where id=m.question_id and family_id=f;
    if coalesce(q.provenance->>'generator','') not in ('parent','ai','ai_edited') then
      raise exception 'question_group_revision_ineligible';
    end if;
    prompt:=btrim(p_changes#>>array['prompts',q.id::text]);
    if jsonb_typeof(p_changes#>array['prompts',q.id::text]) is distinct from 'string'
      or length(prompt) not between 5 and 3500 then raise exception 'question_group_mismatch'; end if;
    stem:=title||E'\n'||body||E'\n\n'||prompt;
    prov:=q.provenance||jsonb_build_object('revised_from',q.id);
    if q.provenance->>'generator' in ('ai','ai_edited') then
      -- Preserve review flags for retained structured content and shared images.
      -- A text-only revision does not certify those other inputs.
      review:=q.provenance->'content_review';
      prov:=gina.ai_edit_provenance(q,q.provenance,review,
        jsonb_build_object('edit_scope','group','shared_prompt',prompt,'shared_source_title',title,'revised_from',q.id));
      if jsonb_typeof(prov->'shared_source')='object' then
        prov:=jsonb_set(prov,'{shared_source,content}',to_jsonb(body));
      end if;
    end if;
    qid:=gen_random_uuid();
    if q.kind='structured' then
      select * into strict k from public.question_answer_keys where question_id=q.id;
      -- Preserve the original scoring policy/version alongside its key; the deferred
      -- question constraint rejects unsupported schema/policy combinations atomically.
      insert into public.question_answer_keys(question_id,family_id,interaction_type,schema_version,key,policy,policy_version,points,content_hash)
        values(qid,f,k.interaction_type,k.schema_version,k.key,k.policy,k.policy_version,k.points,
          gina.qt_content_hash(stem,k.interaction_type,k.schema_version,q.payload,k.key,k.policy,k.policy_version,k.points));
    end if;
    insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,interaction_type,schema_version,payload,
      difficulty,stem,choices,correct_key,expected_answer,solution,explanation,source_urls,provenance,created_by)
      values(qid,f,q.grade,q.subject,q.topic,q.scenario_code,q.kind,q.interaction_type,q.schema_version,q.payload,
      q.difficulty,stem,q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,q.source_urls,prov,auth.uid());
    insert into gina.question_period_tags(question_id,family_id,term,program,source)
      select qid,f,t.term,t.program,t.source from gina.question_period_tags t where t.question_id=q.id;
    for media in select source_id,alt from public.learning_source_links where question_id=q.id order by created_at,id loop
      perform public.attach_question_source(qid,media.source_id,media.alt);
    end loop;
    insert into public.question_source_members(group_id,question_id,position,prompt) values(p_request_id,qid,m.position,prompt);
    ids:=array_append(ids,qid);
    old_ids:=array_append(old_ids,q.id::text);
    member_count:=member_count+1;
  end loop;
  if member_count<2 or (p_changes->'prompts')-old_ids<>'{}'::jsonb then raise exception 'question_group_mismatch'; end if;

  update public.question_source_groups set finalized_at=now() where id=p_request_id;
  next_content:=jsonb_set(d.content,array['blocks',position_in_draft::text,'id'],to_jsonb(p_request_id));
  if next_content ? 'fitAccepted' then
    next_content:=jsonb_set(next_content,'{fitAccepted}',(next_content->'fitAccepted')-old_ids);
  end if;
  perform gina.validate_prova_draft(f,next_content);
  update public.prova_drafts set content=next_content,version=version+1,updated_at=clock_timestamp() where id=d.id;
  result:=jsonb_build_object('id',p_request_id,'version',g.version+1,'question_ids',ids);
  insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
    values(p_request_id,f,auth.uid(),'revise_question_source_group',intent,result);
  return result;
end;
$$;
revoke all on function public.revise_question_source_group(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.revise_question_source_group(uuid,uuid,uuid,integer,jsonb) to authenticated;
