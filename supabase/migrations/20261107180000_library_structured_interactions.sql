-- Typed library content stays in private immutable metadata. The family receives a real QT question,
-- never a free-text approximation; scoring keys remain in question_answer_keys.
create function gina.library_validate_interaction() returns trigger language plpgsql security definer set search_path='' as $$
declare i jsonb;t public.interaction_types;errors text[];begin
 if not(new.metadata ? 'interaction') then return new;end if;
 i:=new.metadata->'interaction';perform gina.import_keys(i,array['type','schema_version','payload','answer_key']);
 select * into t from public.interaction_types where type=i->>'type';
 if t.type is null or t.family<>'structured' or not t.enabled then raise exception 'interaction_type_unavailable';end if;
 if new.student->>'kind' is distinct from 'open_ended' or (i->>'schema_version')::int is distinct from t.schema_version then raise exception 'library_interaction_invalid';end if;
 errors:=gina.qt_question_errors(t.type,t.schema_version,i->'payload',i->'answer_key');
 if cardinality(errors)>0 then raise exception 'question_structure_invalid' using detail=array_to_string(errors,',');end if;
 if t.type='region_select' and i->'payload'->'figure'->>'kind'='image' and not exists(select 1 from gina.library_import_sources where package_id=new.package_id and source_key=new.source_key and asset_hash is not null) then raise exception 'library_import_missing_asset';end if;
 return new;
end $$;
revoke all on function gina.library_validate_interaction() from public,anon,authenticated,service_role;
create trigger library_interaction_check before insert on gina.library_import_questions for each row execute function gina.library_validate_interaction();

create or replace function gina.content_prereview_source(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin
 if p_kind='library_package' then
  select jsonb_build_object('kind','library_package','id',p.id,'package_key',p.package_key,'revision',p.revision,'title',p.title,'grade',p.grade,'subject',p.subject,
   'sources',(select coalesce(jsonb_agg(jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt) order by s.source_key),'[]') from gina.library_import_sources s where s.package_id=p.id),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'revision',q.revision,'source_key',q.source_key,'student',q.student,'teacher',a.teacher,'curriculum',q.metadata->'curriculum')||case when q.metadata ? 'interaction' then jsonb_build_object('interaction',q.metadata->'interaction') else '{}'::jsonb end order by q.position),'[]')
    from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key where q.package_id=p.id))
  into v from gina.library_import_packages p where p.id=p_id;
 elsif p_kind='contribution_set' then
  select jsonb_build_object('kind','contribution_set','id',s.id,'snapshot',s.snapshot-'images','media_count',coalesce(jsonb_array_length(s.snapshot->'images'),0))
  into v from gina.contribution_sets s where s.id=p_id and s.status<>'preparing';
 elsif p_kind='curriculum_candidate' then
  select jsonb_build_object('kind','curriculum_candidate','id',c.id,'external_key',c.external_key,'candidate',c.candidate)
  into v from gina.curriculum_candidates c where c.id=p_id;
 else raise exception 'prereview_kind_invalid';end if;
 return v;
end;$$;

create or replace function public.acquire_library_units(p_request_id uuid,p_package_id uuid,p_publication_version int,p_unit_keys text[],p_draft_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();actor uuid:=auth.uid();receipt public.mutation_receipts;payload jsonb;result jsonb;
 keys text[];k text;r gina.library_publications;p gina.library_import_packages;c jsonb;plan public.plans;
 a gina.library_acquisitions;src gina.library_import_sources;asset gina.library_delivery_assets;
 q record;teacher jsonb;sid uuid;gid uuid;qid uuid;aid uuid;position int;n int;used int;grant_id uuid;
 blocks jsonb:='[]';charged int:=0;draft public.prova_drafts;new_content jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null or actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_package_id is null or p_publication_version is null or p_unit_keys is null or cardinality(p_unit_keys) not between 1 and 100
 or array_position(p_unit_keys,null) is not null or exists(select 1 from unnest(p_unit_keys)v where length(v)>120) then raise exception 'invalid_input';end if;
 select array_agg(distinct v order by v) into keys from unnest(p_unit_keys)v;
 payload:=jsonb_build_object('package',p_package_id,'version',p_publication_version,'keys',keys,'draft',p_draft_id);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>actor or receipt.operation<>'acquire_library_units' or receipt.payload<>payload then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 if not exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true') then raise exception 'library_unavailable';end if;
 -- Same family quota lock as legacy redemptions; same publication/review locks as publishers.
 perform pg_advisory_xact_lock(hashtextextended(f::text,32));
 perform pg_advisory_xact_lock(hashtextextended(p_package_id::text,89));
 select * into r from gina.library_publications where package_id=p_package_id;
 select * into p from gina.library_import_packages where id=p_package_id;
 if r.package_id is null or r.status<>'published' then raise exception 'library_unavailable';end if;
 if r.version<>p_publication_version then raise exception 'library_publication_changed';end if;
 for k in select question_key from gina.library_import_questions where package_id=p_package_id order by question_key loop
  perform pg_advisory_xact_lock(hashtextextended(p_package_id::text||':'||k,87));
 end loop;
 c:=gina.library_publication_checks(p_package_id);
 if r.review_fingerprint is distinct from c->>'review_fingerprint' or c->>'question_count'<>c->>'suitable_count' or (c->>'missing_media')::int<>0 then raise exception 'library_unavailable';end if;
 plan:=gina.family_plan_of(f);
 if not coalesce(plan.code=any(r.plans),false) then raise exception 'library_plan_required';end if;
 if p_draft_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,53));
  select * into draft from public.prova_drafts where id=p_draft_id and family_id=f for update;
  if draft.id is null then raise exception 'prova_draft_not_found';end if;
  if draft.submitted_at is not null then raise exception 'prova_draft_submitted';end if;
  if exists(select 1 from public.children where id=(draft.content->>'childId')::uuid and family_id=f and grade is not null and grade<>p.grade) then raise exception 'prova_child_grade_changed';end if;
  if (draft.content->>'grade')::int is distinct from p.grade or not(draft.content->'subjects' ? p.subject) then raise exception 'prova_question_scope';end if;
 end if;
 -- Reject practice-only selections before copying or charging the family allowance.
 if draft.id is not null and draft.content->'context'->>'track'='meb_common' and exists(
  select 1 from gina.library_import_questions iq left join public.interaction_types t on t.type=iq.metadata->'interaction'->>'type'
  where iq.package_id=p.id and (case when iq.source_key is null then 'question:'||iq.question_key else 'source:'||iq.source_key end)=any(keys)
  and (coalesce(t.practice_only,false) or iq.metadata->>'assessment_track'='free')) then raise exception 'interaction_type_not_allowed_for_track';end if;
 used:=gina.library_month_used(f);
 for k in select value from unnest(keys) chosen(value) order by (select min(iq.position) from gina.library_import_questions iq where iq.package_id=p_package_id and (case when iq.source_key is null then 'question:'||iq.question_key else 'source:'||iq.source_key end)=chosen.value),value loop
  select * into a from gina.library_acquisitions where family_id=f and package_id=p_package_id and unit_key=k;
  if found then blocks:=blocks||jsonb_build_array(a.block);continue;end if;
  select count(*) into n from gina.library_import_questions iq where iq.package_id=p_package_id and
   (case when iq.source_key is null then 'question:'||iq.question_key else 'source:'||iq.source_key end)=k;
  if n not between 1 and 12 then raise exception 'library_unit_unavailable';end if;
  src:=null;sid:=null;gid:=null;
  if left(k,7)='source:' then
   select * into src from gina.library_import_sources where package_id=p_package_id and source_key=substr(k,8);
   if length(src.body)>6000 or length(src.title)>160 then raise exception 'library_unit_unavailable';end if;
   if n>1 and not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true') then raise exception 'library_unavailable';end if;
   if src.asset_hash is not null then
    if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then raise exception 'library_unavailable';end if;
    select * into asset from gina.library_delivery_assets where source_hash=src.asset_hash;
    sid:=gen_random_uuid();
    insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent,verified_at)
    values(sid,f,actor,'question_image',src.title,'image/png',octet_length(asset.png),asset.sha256,'library/'||f::text||'/'||sid::text,'ready',asset.width,asset.height,'library-acquisition-v1',now());
    insert into gina.library_source_copies values(sid,src.asset_hash);
   end if;
   if n>1 then
    gid:=gen_random_uuid();
    insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject)
    values(gid,f,gid,1,src.title,src.body,p.grade,p.subject);
   end if;
  end if;
  aid:=gen_random_uuid();position:=0;
  -- Acquisition is inserted before charges but the transaction is all-or-nothing.
  insert into gina.library_acquisitions(id,family_id,package_id,unit_key,block,question_count)
  values(aid,f,p_package_id,k,'{}',n);
  for q in select * from gina.library_import_questions iq where iq.package_id=p_package_id and
   (case when iq.source_key is null then 'question:'||iq.question_key else 'source:'||iq.source_key end)=k order by iq.position loop
   grant_id:=null;
   if used>=plan.library_monthly then
    select g.id into grant_id from public.learning_credit_grants g where g.family_id=f and g.kind='library' and g.starts_at<=now() and g.ends_at>now()
    and g.amount>gina.library_grant_used(g.id) order by g.ends_at,g.id limit 1 for update;
    if grant_id is null then raise exception 'library_quota_exceeded';end if;
   else used:=used+1;end if;
   select ia.teacher into teacher from gina.library_import_answers ia where ia.package_id=p_package_id and ia.question_key=q.question_key;
   qid:=gen_random_uuid();position:=position+1;
   if q.metadata ? 'interaction' then
    perform gina.qt_insert_structured(qid,f,
     q.student||teacher||jsonb_build_object('interaction_type',q.metadata->'interaction'->>'type','schema_version',q.metadata->'interaction'->'schema_version','payload',q.metadata->'interaction'->'payload','answer_key',q.metadata->'interaction'->'answer_key','points',100,'source_urls','[]'::jsonb,
      'stem',case when src.source_key is null then q.student->>'stem' else src.title||E'\n'||src.body||E'\n\n'||(q.student->>'stem') end),
     jsonb_build_object('generator','gina-library','item_id',p.id::text||':'||q.question_key,'package_id',p.id,'question_key',q.question_key,'curriculum_version',r.curriculum_label,'rubric',teacher->'rubric','common_misconception',teacher->'common_misconception','next_step',teacher->'next_step'),actor);
   else
   insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
   values(qid,f,p.grade,p.subject,q.student->>'topic',(q.student->>'kind')::public.question_kind,(q.student->>'difficulty')::public.question_difficulty,
    case when src.source_key is null then q.student->>'stem' else src.title||E'\n'||src.body||E'\n\n'||(q.student->>'stem') end,
    q.student->'choices',teacher->>'correct_key',teacher->>'expected_answer',teacher->>'solution',teacher->>'explanation',
    jsonb_build_object('generator','gina-library','item_id',p.id::text||':'||q.question_key,'package_id',p.id,'question_key',q.question_key,'curriculum_version',r.curriculum_label,'rubric',teacher->'rubric','common_misconception',teacher->'common_misconception','next_step',teacher->'next_step'),actor);
   end if;
   if sid is not null then insert into public.learning_source_links(source_id,question_id,alt) values(sid,qid,src.alt);end if;
   if gid is not null then insert into public.question_source_members(group_id,question_id,position,prompt) values(gid,qid,position,q.student->>'stem');end if;
   insert into gina.library_acquisition_charges(acquisition_id,family_id,question_id,credit_grant_id) values(aid,f,qid,grant_id);
   charged:=charged+1;
  end loop;
  if gid is not null then update public.question_source_groups set finalized_at=now() where id=gid;end if;
  c:=jsonb_build_object('kind',case when gid is null then 'question' else 'group' end,'id',coalesce(gid,qid),'source','library');
  update gina.library_acquisitions set block=c where id=aid;
  blocks:=blocks||jsonb_build_array(c);
 end loop;
 if draft.id is not null then
  new_content:=draft.content;
  select coalesce(jsonb_agg(v order by ord),'[]') into c from jsonb_array_elements(blocks) with ordinality b(v,ord)
  where not exists(select 1 from jsonb_array_elements(new_content->'blocks') old where old->>'id'=v->>'id');
  new_content:=jsonb_set(new_content,'{blocks}',(new_content->'blocks')||c);
  perform gina.validate_prova_draft(f,new_content);
  if new_content<>draft.content then
   update public.prova_drafts set content=new_content,version=version+1,updated_at=now() where id=draft.id;
  end if;
 end if;
 result:=jsonb_build_object('blocks',blocks,'charged',charged,'draft_id',p_draft_id);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,actor,'acquire_library_units',payload,result);
 return result;
end;$$;
