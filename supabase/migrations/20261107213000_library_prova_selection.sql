create function gina.library_topic_label(p text) returns text
language sql immutable set search_path='' as $$
  select btrim(regexp_replace(lower(translate(coalesce(p,''),'İIıÇçŞşĞğÖöÜüÂâÎîÛûÉé','iiiccssggoouuaaiiuuee')),'[^a-z0-9]+',' ','g'));
$$;
revoke all on function gina.library_topic_label(text) from public,anon,authenticated,service_role;

-- Preview and acquire independent published questions with no model invocation.
create function public.prepare_library_prova(
  p_draft_id uuid, p_version int, p_types text[], p_request_id uuid default null, p_expected text default null, p_blueprint_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_family uuid := gina.family_id();
  actor uuid := auth.uid();
  draft public.prova_drafts;
  receipt public.mutation_receipts;
  plan public.plans;
  payload jsonb;
  picked jsonb;
  result jsonb;
  purchase record;
  used_count int;
  needed int;
  covered_count int;
  wanted_count int;
  missing_topics jsonb;
  missing_types jsonb;
  fingerprint text;
  scenario jsonb;
  scenario_blocks jsonb;
  scenario_title text;
begin
  if not coalesce(gina.is_parent(),false) or v_family is null or actor is null then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_draft_id is null or p_version is null or cardinality(p_types) not between 1 and 14
     or p_types is null or array_position(p_types,null) is not null or exists(
       select 1 from unnest(p_types) t where t not in ('open_ended','multiple_choice')
       and not exists(select 1 from public.interaction_types i where i.type=t and i.enabled)
     ) then raise exception 'invalid_input'; end if;
  select array_agg(distinct t order by t) into p_types from unnest(p_types) t;
  payload := jsonb_build_object('draft',p_draft_id,'version',p_version,'types',p_types,'expected',p_expected,'blueprint',p_blueprint_id);
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
    select * into receipt from public.mutation_receipts where request_id=p_request_id;
    if found then
      if receipt.family_id<>v_family or receipt.actor_id<>actor or receipt.operation<>'prepare_library_prova'
         or receipt.payload is distinct from payload then raise exception 'request_conflict'; end if;
      return receipt.result;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_family::text,32));
    perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,53));
  end if;
  select * into draft from public.prova_drafts where id=p_draft_id and family_id=v_family;
  if not found then raise exception 'prova_draft_not_found'; end if;
  if draft.submitted_at is not null then raise exception 'prova_draft_submitted'; end if;
  if draft.version<>p_version then raise exception 'prova_draft_changed'; end if;
  if draft.content->>'format'='meb' then raise exception 'prova_verified_scope_required'; end if;
  if not exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true') then
    raise exception 'library_unavailable';
  end if;
  used_count := cardinality(gina.prova_draft_questions(v_family,draft.content));
  needed := greatest(0,(draft.content->>'target')::int-used_count);
  if p_blueprint_id is not null then
    if used_count<>0 or draft.content->'context'->>'track' is distinct from 'meb_common'
       or p_types<>array['open_ended']::text[] or jsonb_array_length(draft.content->'subjects')<>1
       or not gina.curriculum_catalog_open(v_family) then raise exception 'curriculum_scope_mismatch'; end if;
    select c.candidate, c.candidate->>'label' into scenario,scenario_title
    from gina.catalog_blueprint_links l join gina.curriculum_candidates c on c.id=l.catalogue_id
    where l.blueprint_id=p_blueprint_id and l.family_id=v_family
      and l.child_id::text=draft.content->>'childId' and c.status='published' and c.revision=l.revision
      and c.candidate->>'grade'=draft.content->>'grade'
      and gina.curriculum_subject(c.candidate->>'subject')=draft.content->'subjects'->>0
      and c.candidate->>'term'=draft.content->'context'->>'term'
      and split_part(c.candidate->>'academic_year','-',1)=draft.content->'context'->>'academicYear'
      and exists(select 1 from gina.curriculum_source_revisions r where r.sha256=c.source_sha256 and r.status='approved');
    if scenario is null then raise exception 'curriculum_unavailable'; end if;
    scenario_blocks := scenario->'blocks';
    needed := (scenario->>'question_count')::int;
  end if;
  plan := gina.family_plan_of(v_family);
  with topics as materialized (
    select min(label) label, gina.library_topic_label(label) normalized, null::jsonb outcomes, needed quota
    from jsonb_array_elements_text(draft.content->'topics') x(label)
    where scenario is null and gina.library_topic_label(label)<>'' group by 2
    union all
    select 'Blok '||ord, '', block->'outcomes', (block->>'count')::int
    from jsonb_array_elements(scenario_blocks) with ordinality s(block,ord)
  ), packages as materialized (
    select r.package_id, r.version
    from gina.library_publications r join gina.library_import_packages p on p.id=r.package_id
    cross join lateral gina.library_publication_checks(p.id) c
    where r.status='published' and p.grade=(draft.content->>'grade')::int
      and draft.content->'subjects' ? p.subject and plan.code=any(r.plans)
      and r.review_fingerprint=c->>'review_fingerprint'
      and c->>'question_count'=c->>'suitable_count' and (c->>'missing_media')::int=0
  ), candidates as materialized (
    select p.package_id,p.version,case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end unit_key,
      q.student->>'topic' topic,
      coalesce(q.metadata->'interaction'->>'type',q.student->>'kind') kind,
      gina.library_topic_label(q.student->>'topic') normalized,
      gina.library_topic_label(q.metadata->'curriculum'->>'text') outcome,
      q.metadata->'curriculum'->>'code' outcome_code,
      q.metadata->'curriculum'->'evidence'->>'sha256' source_hash,
      case when a.id is null then 1 else 0 end cost
    from packages p join gina.library_import_questions q on q.package_id=p.package_id
    left join public.interaction_types i on i.type=q.metadata->'interaction'->>'type'
    left join gina.library_acquisitions a on a.family_id=v_family and a.package_id=p.package_id
      and a.unit_key=case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end
    where (q.source_key is null or not exists(select 1 from gina.library_import_questions peer
      where peer.package_id=q.package_id and peer.source_key=q.source_key and peer.question_key<>q.question_key))
      and coalesce(q.metadata->'interaction'->>'type',q.student->>'kind')=any(p_types)
      and (i.type is null or i.enabled)
      and (coalesce(draft.content->'context'->>'track','free')<>'meb_common'
        or (not coalesce(i.practice_only,false) and coalesce(q.metadata->>'assessment_track','')<>'free'
        and q.metadata->'interaction' is null and q.student->>'kind'='open_ended'))
      and (coalesce(draft.content->>'purpose','')<>'written'
        or (q.metadata->'interaction' is null and q.student->>'kind'='open_ended'))
      and (draft.content->>'kind'='mixed' or
        (q.metadata->'interaction' is null and q.student->>'kind'=draft.content->>'kind'))
      and not exists(select 1 from jsonb_array_elements(draft.content->'blocks') b where b->>'id'=a.block->>'id')
  ), ranked as (
    select c.*,m.label,m.quota,row_number() over(partition by m.label,c.kind order by c.cost,c.package_id,c.unit_key) variety
    from candidates c left join lateral (
      select t.label,t.quota from topics t
      where (scenario is null and (c.normalized=t.normalized
          or strpos(' '||c.normalized||' ',' '||t.normalized||' ')>0
          or strpos(' '||c.outcome||' ',' '||t.normalized||' ')>0))
        or (scenario is not null and c.source_hash=scenario->>'source_sha256' and exists(
          select 1 from jsonb_array_elements(t.outcomes) o where o->>'code'=c.outcome_code))
      order by (c.normalized=t.normalized) desc, length(t.normalized) desc, t.label limit 1
    ) m on true
    where m.label is not null or not exists(select 1 from topics)
  ), spread as (
    select r.*,row_number() over(partition by label order by variety,cost,kind,package_id,unit_key) topic_rank
    from ranked r
  ), ranked_by_type as (
    select s.*,row_number() over(partition by kind order by topic_rank,variety,cost,label,package_id,unit_key) type_rank
    from spread s where scenario is null or topic_rank<=quota
  ), chosen as materialized (
    select * from ranked_by_type
    order by (type_rank<>1),topic_rank,variety,cost,label,kind,package_id,unit_key limit needed
  )
  select coalesce((select jsonb_agg(to_jsonb(c) - 'normalized' - 'outcome' - 'variety' - 'topic_rank' - 'source_hash' - 'outcome_code' - 'quota' - 'type_rank'
    order by (c.type_rank<>1),c.topic_rank,c.variety,c.cost,c.label,c.kind,c.package_id,c.unit_key) from chosen c),'[]'),
    (select count(*) from topics),
    (select count(*) from topics t where (select count(*) from chosen c where c.label=t.label)>=case when scenario is null then 1 else t.quota end),
    coalesce((select jsonb_agg(t.label order by t.label) from topics t
      where (select count(*) from chosen c where c.label=t.label)<case when scenario is null then 1 else t.quota end),'[]'),
    coalesce((select jsonb_agg(t order by t) from unnest(p_types) t
      where not exists(select 1 from chosen c where c.kind=t)),'[]')
  into picked,wanted_count,covered_count,missing_topics,missing_types;

  fingerprint := md5(picked::text);

  result := jsonb_build_object('needed',needed,'matched',jsonb_array_length(picked),
    'credits',coalesce((select sum((v->>'cost')::int) from jsonb_array_elements(picked) v),0),
    'topics_requested',wanted_count,'topics_covered',covered_count,'uncovered_topics',missing_topics,
    'uncovered_types',missing_types,'fingerprint',fingerprint,'scenario',scenario_title,'items',picked);
  if p_request_id is null then return result; end if;
  if fingerprint is distinct from p_expected then raise exception 'library_selection_changed'; end if;
  if needed=0 or jsonb_array_length(picked)<>needed or jsonb_array_length(missing_types)>0 then raise exception 'library_selection_shortage'; end if;
  if scenario is not null then
    update public.prova_drafts set content=content||jsonb_build_object('target',needed,'purpose','written','kind','open_ended','topics',
      (select jsonb_agg(left('Blok '||ord||' · '||(select string_agg(coalesce(o->>'code',''),', ' order by o->>'code')
          from jsonb_array_elements(block->'outcomes') o),200) order by ord)
       from jsonb_array_elements(scenario_blocks) with ordinality s(block,ord))),
      version=version+1,updated_at=now() where id=draft.id;
  end if;
  for purchase in
    select (v->>'package_id')::uuid package_id,(v->>'version')::int version,array_agg(v->>'unit_key') keys
    from jsonb_array_elements(picked) v group by 1,2 order by 1
  loop
    perform public.acquire_library_units(gen_random_uuid(),purchase.package_id,purchase.version,purchase.keys,draft.id);
  end loop;
  if (select cardinality(gina.prova_draft_questions(v_family,d.content))
      from public.prova_drafts d where d.id=draft.id) <> used_count+needed then
    raise exception 'library_selection_shortage';
  end if;
  insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
  values(p_request_id,v_family,actor,'prepare_library_prova',payload,result);
  return result;
end;$$;
revoke all on function public.prepare_library_prova(uuid,int,text[],uuid,text,uuid) from public,anon,service_role;
grant execute on function public.prepare_library_prova(uuid,int,text[],uuid,text,uuid) to authenticated;
