-- H02: MEB source acquisition and extraction from the backoffice panel. The admin starts the first download from a
-- registered target and the per-revision extraction with their own session; the `curriculum-source-extract` Edge
-- Function (service role, Deno port of the Python extractor) does the work. No copied admin token, no synthetic
-- admin. Source approval and scenario publication stay separate; candidates stay draft/review-only; nothing is
-- deleted; `curriculum_catalog.enabled` is not touched.

-- 1. Visible attempt state. A claim is a short lease (3 min) so concurrent clicks do not run two extractions; a
-- transient failure (network/storage) is not an extraction verdict: the revision stays queued with a reason.
alter table gina.curriculum_source_revisions
 add column extraction_started_at timestamptz,
 add column extraction_started_by uuid,
 add column extraction_attempts int not null default 0 check(extraction_attempts>=0),
 add column extraction_last_error text check(extraction_last_error is null or length(extraction_last_error) between 1 and 300);

-- 2. The same official bytes are never a second source of the same year/term (e.g. a duplicate subject/level card).
create function gina.reject_duplicate_curriculum_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare dup text;begin
 select s.label into dup from gina.curriculum_source_revisions r join gina.curriculum_sources s on s.id=r.source_id
  join gina.curriculum_sources mine on mine.id=new.source_id
  where r.sha256=new.sha256 and r.source_id<>new.source_id and s.exam_family=mine.exam_family and s.school_year=mine.school_year and s.term=mine.term limit 1;
 if found then raise exception 'curriculum_source_duplicate' using detail=dup;end if;
 return new;
end;$$;
revoke all on function gina.reject_duplicate_curriculum_revision() from public,anon,authenticated,service_role;
create trigger reject_duplicate_curriculum_revision before insert on gina.curriculum_source_revisions for each row execute function gina.reject_duplicate_curriculum_revision();

-- 3. One implementation of "record an extraction" for both callers: the admin RPC (legacy operator tool) and the
-- service path (Edge on behalf of a live admin). Body = 20261106250000 admin_record_curriculum_extraction with the
-- actor passed in, plus clearing the attempt lease.
create function gina.curriculum_extraction_apply(p_actor uuid,p_request_id uuid,p_revision_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text;cmd gina.curriculum_fetch_commands;r gina.curriculum_source_revisions;s gina.curriculum_sources;c jsonb;existing gina.curriculum_candidates;ch text;
 added int:=0;kept int:=0;total int:=0;outcome text;bundle_hash text;summary jsonb;result jsonb;begin
 if p_actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision_id is null or octet_length(coalesce(p_result,'null')::text)>5000000 then raise exception 'curriculum_extraction_invalid';end if;
 begin
  perform gina.import_keys(p_result,array['outcome','extractor','scenarios','issues','error','bundle']);
  outcome:=gina.import_text(p_result->'outcome',4,6);perform gina.import_text(p_result->'extractor',1,80);
  perform gina.import_int(p_result->'scenarios',0,1000);perform gina.import_int(p_result->'issues',0,1000);
 exception when others then raise exception 'curriculum_extraction_invalid';end;
 if outcome not in('done','failed') then raise exception 'curriculum_extraction_invalid';end if;
 if outcome='failed' and (p_result->'bundle'<>'null'::jsonb or jsonb_typeof(p_result->'error') is distinct from 'string' or length(p_result->>'error') not between 1 and 300) then raise exception 'curriculum_extraction_invalid';end if;
 if outcome='done' and (p_result->'error'<>'null'::jsonb or jsonb_typeof(p_result->'bundle') is distinct from 'object') then raise exception 'curriculum_extraction_invalid';end if;
 h:=encode(extensions.digest(jsonb_build_array('extraction',p_revision_id,p_result)::text,'sha256'),'hex');
 select * into r from gina.curriculum_source_revisions where id=p_revision_id;
 if not found then raise exception 'curriculum_not_found';end if;
 select * into s from gina.curriculum_sources where id=r.source_id;
 perform pg_advisory_xact_lock(hashtextextended(s.source_key,61));
 perform pg_advisory_xact_lock(73491822);
 select * into cmd from gina.curriculum_fetch_commands where request_id=p_request_id;
 if found then
  if cmd.actor_id<>p_actor or cmd.payload_hash<>h then raise exception 'request_conflict';end if;return cmd.result;
 end if;
 select * into r from gina.curriculum_source_revisions where id=p_revision_id for update;
 if r.status in('withdrawn','superseded') then raise exception 'curriculum_revision_conflict';end if;
 if outcome='done' then
  bundle_hash:=encode(extensions.digest((p_result->'bundle')::text,'sha256'),'hex');
  if r.extraction_status='done' then
   -- Re-running the same extraction is a no-op; different output for the same bytes needs a human, not an overwrite.
   if r.extraction->>'bundle_sha256'=bundle_hash then
    update gina.curriculum_source_revisions set extraction_started_at=null,extraction_last_error=null where id=r.id returning * into r;
    result:=jsonb_build_object('request',p_request_id,'outcome','unchanged','revision_id',r.id,'extraction_status',r.extraction_status,'extraction',r.extraction);
    insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,p_actor,h,result);
    return result;
   end if;
   raise exception 'curriculum_extraction_conflict';
  end if;
  perform gina.import_keys(p_result->'bundle',array['schema','candidates']);
  if p_result->'bundle'->>'schema' is distinct from 'gina.curriculum-review.v1' or jsonb_typeof(p_result->'bundle'->'candidates') is distinct from 'array' then raise exception 'curriculum_extraction_invalid';end if;
  total:=jsonb_array_length(p_result->'bundle'->'candidates');
  if total<>(p_result->>'scenarios')::int or total>1000 then raise exception 'curriculum_count_mismatch';end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(p_result->'bundle'->'candidates'))<>total then raise exception 'curriculum_duplicate';end if;
  for c in select value from jsonb_array_elements(p_result->'bundle'->'candidates') loop
   perform gina.validate_curriculum_candidate(c);
   -- Every candidate must come from exactly these bytes and this source's year/term/subject: no cross-term reuse.
   if c->>'source_sha256'<>r.sha256 then raise exception 'curriculum_extraction_hash_mismatch';end if;
   if c->>'academic_year'<>s.school_year or (c->>'term')::int<>s.term then raise exception 'curriculum_term_mismatch';end if;
   if gina.curriculum_subject(c->>'subject')<>gina.curriculum_subject(s.label) then raise exception 'curriculum_scope_mismatch';end if;
   ch:=encode(extensions.digest(c::text,'sha256'),'hex');
   select * into existing from gina.curriculum_candidates where external_key=c->>'key' and source_sha256=c->>'source_sha256';
   if found then
    if existing.content_hash<>ch then raise exception 'curriculum_source_changed';end if;kept:=kept+1;
   else
    insert into gina.curriculum_candidates(external_key,source_sha256,candidate,content_hash,created_by) values(c->>'key',c->>'source_sha256',c,ch,p_actor);added:=added+1;
   end if;
  end loop;
  summary:=jsonb_build_object('outcome','done','extractor',p_result->'extractor','scenarios',total,'issues',p_result->'issues','created',added,'existing',kept,'bundle_sha256',bundle_hash,'at',now(),'by',p_actor);
  update gina.curriculum_source_revisions set extraction_status='done',extraction=summary,extraction_started_at=null,extraction_last_error=null where id=r.id returning * into r;
 else
  if r.extraction_status='done' then raise exception 'curriculum_extraction_conflict';end if;
  summary:=jsonb_build_object('outcome','failed','extractor',p_result->'extractor','error',p_result->'error','at',now(),'by',p_actor);
  update gina.curriculum_source_revisions set extraction_status='failed',extraction=summary,extraction_started_at=null,extraction_last_error=null where id=r.id returning * into r;
 end if;
 result:=jsonb_build_object('request',p_request_id,'outcome',outcome,'revision_id',r.id,'extraction_status',r.extraction_status,'extraction',r.extraction);
 insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,p_actor,h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(p_actor,'curriculum.extraction_'||outcome,'gina.curriculum_source_revisions',r.id::text,
  case when outcome='done' then 'Candidates from '||left(r.sha256,12)||': '||added||' new, '||kept||' existing; review-only' else 'Extraction failed: '||(p_result->>'error') end);
 return result;
end;$$;
revoke all on function gina.curriculum_extraction_apply(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

-- Same contract as before (full admin; legacy operator tool), now delegating to the shared implementation.
create or replace function public.admin_record_curriculum_extraction(p_request_id uuid,p_revision_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return gina.curriculum_extraction_apply(auth.uid(),p_request_id,p_revision_id,p_result);
end;$$;
revoke all on function public.admin_record_curriculum_extraction(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_record_curriculum_extraction(uuid,uuid,jsonb) to authenticated;

-- 4. Service path. Every call re-checks that the actor is a current admin (a revoked admin's still-valid JWT stops here).
create function gina.require_live_admin(p_actor uuid) returns void language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 if p_actor is null or not exists(select 1 from public.admins a where a.user_id=p_actor) then raise exception 'forbidden' using errcode='42501';end if;
end;$$;
revoke all on function gina.require_live_admin(uuid) from public,anon,authenticated,service_role;

-- claim: queued/failed → lease. Answers without a claim when the revision is closed, already extracted, or another
-- attempt holds a fresh lease. Returns what the worker needs: hash, stored object, official URL, scope.
create function public.begin_curriculum_extraction(p_actor_id uuid,p_revision_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r gina.curriculum_source_revisions;s gina.curriculum_sources;state text;begin
 perform gina.require_live_admin(p_actor_id);
 if p_revision_id is null then raise exception 'curriculum_extraction_invalid';end if;
 select * into r from gina.curriculum_source_revisions where id=p_revision_id;
 if not found then raise exception 'curriculum_not_found';end if;
 select * into s from gina.curriculum_sources where id=r.source_id;
 perform pg_advisory_xact_lock(hashtextextended(s.source_key,61));
 select * into r from gina.curriculum_source_revisions where id=p_revision_id for update;
 state:=case
  when r.status in('withdrawn','superseded') or r.extraction_status='skipped' then 'closed'
  when r.extraction_status='done' then 'already_done'
  when r.extraction_started_at is not null and r.extraction_started_at>now()-interval '3 minutes' then 'in_progress'
  else 'claimed' end;
 if state='claimed' then
  update gina.curriculum_source_revisions set extraction_started_at=now(),extraction_started_by=p_actor_id,extraction_attempts=extraction_attempts+1 where id=r.id returning * into r;
 end if;
 return jsonb_build_object('state',state,'revision_id',r.id,'source_id',s.id,'status',r.status,'extraction_status',r.extraction_status,'extraction',r.extraction,
  'extraction_started_at',r.extraction_started_at,'extraction_attempts',r.extraction_attempts)
  ||case when state='claimed' then jsonb_build_object('sha256',r.sha256,'bytes',r.bytes,'storage_path',r.storage_path,'resolved_url',r.resolved_url,
   'label',s.label,'school_year',s.school_year,'term',s.term,'index_url',s.index_url,'retrieved_at',r.retrieved_at) else '{}'::jsonb end;
end;$$;

create function public.record_curriculum_extraction_service(p_request_id uuid,p_actor_id uuid,p_revision_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform gina.require_live_admin(p_actor_id);
 return gina.curriculum_extraction_apply(p_actor_id,p_request_id,p_revision_id,p_result);
end;$$;

-- Transient failure (bytes unreachable, storage down, worker error): lease released, revision stays queued/failed
-- as it was, the reason is visible and the admin can retry. Never sets a verdict.
create function public.release_curriculum_extraction(p_actor_id uuid,p_revision_id uuid,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r gina.curriculum_source_revisions;begin
 perform gina.require_live_admin(p_actor_id);
 if p_revision_id is null or length(coalesce(p_error,'')) not between 1 and 300 then raise exception 'curriculum_extraction_invalid';end if;
 update gina.curriculum_source_revisions set extraction_started_at=null,extraction_last_error=p_error
  where id=p_revision_id and extraction_status in('queued','failed') returning * into r;
 if not found then
  select * into r from gina.curriculum_source_revisions where id=p_revision_id;
  if not found then raise exception 'curriculum_not_found';end if;
 end if;
 return jsonb_build_object('revision_id',r.id,'extraction_status',r.extraction_status,'extraction_last_error',r.extraction_last_error,'extraction_attempts',r.extraction_attempts);
end;$$;

revoke all on function public.begin_curriculum_extraction(uuid,uuid),public.record_curriculum_extraction_service(uuid,uuid,uuid,jsonb),
 public.release_curriculum_extraction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_curriculum_extraction(uuid,uuid),public.record_curriculum_extraction_service(uuid,uuid,uuid,jsonb),
 public.release_curriculum_extraction(uuid,uuid,text) to service_role;

-- 5. Panel read models gain the attempt state (lease, attempts, last transient error); the queue no longer
-- advertises a terminal command.
create or replace function gina.curriculum_source_projection(s gina.curriculum_sources) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'source_key',s.source_key,'exam_family',s.exam_family,'school_year',s.school_year,'term',s.term,'label',s.label,
  'index_url',s.index_url,'link_url',s.link_url,'freshness',s.freshness,'last_checked_at',s.last_checked_at,'last_check_error',s.last_check_error,
  'index_published_on',s.index_published_on,'index_updated_on',s.index_updated_on,
  'approved',(select jsonb_build_object('revision_id',r.id,'sha256',r.sha256,'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at) from gina.curriculum_source_revisions r where r.source_id=s.id and r.status='approved'),
  'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sha256',r.sha256,'bytes',r.bytes,'mime',r.mime,'resolved_url',r.resolved_url,'redirect_chain',r.redirect_chain,'inspection',r.inspection,
    'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at,'status',r.status,'extraction_status',r.extraction_status,'extraction',r.extraction,'review_note',r.review_note,'reviewed_at',r.reviewed_at,
    'extraction_running',r.extraction_started_at is not null and r.extraction_started_at>now()-interval '3 minutes',
    'extraction_started_at',r.extraction_started_at,'extraction_attempts',r.extraction_attempts,'extraction_last_error',r.extraction_last_error,'stored',r.storage_path is not null,
    'candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256),
    'draft_candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256 and c.status='draft'),
    'published_candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256 and c.status='published')) order by r.retrieved_at desc),'[]') from gina.curriculum_source_revisions r where r.source_id=s.id))
$$;
revoke all on function gina.curriculum_source_projection(gina.curriculum_sources) from public,anon,authenticated,service_role;

create or replace function public.admin_curriculum_pipeline() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'queue',(select coalesce(jsonb_agg(jsonb_build_object('revision_id',r.id,'source_id',s.id,'label',s.label,'school_year',s.school_year,'term',s.term,'sha256',r.sha256,
    'status',r.status,'extraction_status',r.extraction_status,'extraction',r.extraction,'resolved_url',r.resolved_url,'retrieved_at',r.retrieved_at,
    'extraction_running',r.extraction_started_at is not null and r.extraction_started_at>now()-interval '3 minutes',
    'extraction_started_at',r.extraction_started_at,'extraction_attempts',r.extraction_attempts,'extraction_last_error',r.extraction_last_error) order by r.retrieved_at),'[]')
   from gina.curriculum_source_revisions r join gina.curriculum_sources s on s.id=r.source_id where r.extraction_status in('queued','failed') and r.status not in('withdrawn','superseded')),
  'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'source_sha256',c.source_sha256,
    'source_status',coalesce((select v.status from gina.curriculum_source_revisions v where v.sha256=c.source_sha256 order by (v.status='approved') desc,v.retrieved_at desc limit 1),'manifest_only'),
    'prereview_status',(select p.prereview_status from gina.content_prereviews p where p.target_kind='curriculum_candidate' and p.target_id=c.id),
    'prereview_reason',(select p.prereview_verdict->>'decision_reason' from gina.content_prereviews p where p.target_kind='curriculum_candidate' and p.target_id=c.id))),'[]')
   from gina.curriculum_candidates c),
  'operator_step','panel:curriculum-source-extract');
end;$$;
revoke all on function public.admin_curriculum_pipeline() from public,anon,service_role;
grant execute on function public.admin_curriculum_pipeline() to authenticated;
