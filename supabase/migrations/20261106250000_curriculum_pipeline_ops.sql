-- C05: operable curriculum pipeline (M01/P02/B02). Official index → fetched revision → extraction (queued → done |
-- failed) → idempotent candidate import → separate review/publication → family selection → generated question →
-- reasoned human content-fit review. Nothing here publishes, approves, picks a school's scenario or claims MEB
-- endorsement. A registered index target is evidence of where to look, not of what the school uses.

-- 1. Admin-managed official index targets (new year/term). Only MEB hosts; never guessed, never substituted.
create table gina.curriculum_source_targets (
 id uuid primary key default gen_random_uuid(),
 exam_family text not null check(exam_family in('oyss')),
 school_year text not null check(school_year ~ '^20[0-9]{2}-20[0-9]{2}$' and right(school_year,4)::int=left(school_year,4)::int+1),
 term int not null check(term in(1,2)),
 index_url text not null check(index_url ~ '^https://([a-z0-9-]+\.)*meb\.gov\.tr/[^[:space:]]*$' and length(index_url)<=500),
 status text not null default 'active' check(status in('active','retired')),
 note text not null check(length(trim(note)) between 1 and 1000),
 created_by uuid, created_at timestamptz not null default now(),
 updated_by uuid, updated_at timestamptz not null default now(),
 unique(exam_family,school_year,term)
);
alter table gina.curriculum_source_targets enable row level security;
revoke all on gina.curriculum_source_targets from public,anon,authenticated,service_role;
-- The single index that was live-checked on 2026-11-05 (M01). Term 2 and later years are added by an admin only
-- after the official page exists; until then fetch/freshness answer `unpublished` without substitution.
insert into gina.curriculum_source_targets(exam_family,school_year,term,index_url,note)
values('oyss','2026-2027',1,'https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','M01: resmî ÖDSGM dizini, yayın 07.09.2026, güncelleme 10.09.2026; 2026-11-05 canlı kontrol.')
on conflict do nothing;

-- A fetched source must belong to a registered target with the same index page (defence in depth for the Edge path).
create function gina.require_curriculum_target() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' or new.index_url is distinct from old.index_url then
  if not exists(select 1 from gina.curriculum_source_targets t where t.exam_family=new.exam_family and t.school_year=new.school_year and t.term=new.term and t.index_url=new.index_url) then
   raise exception 'curriculum_target_missing';
  end if;
 end if;
 return new;
end;$$;
revoke all on function gina.require_curriculum_target() from public,anon,authenticated,service_role;
create trigger require_curriculum_target before insert or update on gina.curriculum_sources for each row execute function gina.require_curriculum_target();

create function public.admin_save_curriculum_source_target(p_request_id uuid,p_target jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text;cmd gina.curriculum_fetch_commands;t gina.curriculum_source_targets;y text;v_url text;v_status text;v_note text;action text;result jsonb;begin
 perform gina.assert_admin();
 if p_request_id is null or octet_length(coalesce(p_target,'null')::text)>4000 then raise exception 'curriculum_target_invalid';end if;
 begin
  perform gina.import_keys(p_target,array['exam_family','school_year','term','index_url','status','note']);
  y:=gina.import_text(p_target->'school_year',9,9);v_url:=gina.import_text(p_target->'index_url',12,500);
  v_status:=gina.import_text(p_target->'status',6,7);v_note:=trim(gina.import_text(p_target->'note',1,1000));
  perform gina.import_int(p_target->'term',1,2);
 exception when others then raise exception 'curriculum_target_invalid';end;
 if p_target->>'exam_family' is distinct from 'oyss' or y !~ '^20[0-9]{2}-20[0-9]{2}$' or right(y,4)::int<>left(y,4)::int+1 or v_status not in('active','retired') then raise exception 'curriculum_target_invalid';end if;
 -- Index pages are official MEB pages. meb.ai/eba CDN are file hops, never an index.
 if v_url !~ '^https://([a-z0-9-]+\.)*meb\.gov\.tr/[^[:space:]]*$' then raise exception 'curriculum_target_host';end if;
 h:=encode(extensions.digest(jsonb_build_array('target',p_target)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('target:'||y||':'||(p_target->>'term'),61));
 select * into cmd from gina.curriculum_fetch_commands where request_id=p_request_id;
 if found then
  if cmd.actor_id<>auth.uid() or cmd.payload_hash<>h then raise exception 'request_conflict';end if;return cmd.result;
 end if;
 select * into t from gina.curriculum_source_targets where exam_family='oyss' and school_year=y and term=(p_target->>'term')::int for update;
 if not found then
  insert into gina.curriculum_source_targets(exam_family,school_year,term,index_url,status,note,created_by,updated_by)
  values('oyss',y,(p_target->>'term')::int,v_url,v_status,v_note,auth.uid(),auth.uid()) returning * into t;action:='created';
 elsif t.index_url=v_url and t.status=v_status and t.note=v_note then action:='unchanged';
 else
  -- Changing the page of a target that already has fetched sources would orphan their provenance.
  if t.index_url<>v_url and exists(select 1 from gina.curriculum_sources s where s.exam_family=t.exam_family and s.school_year=t.school_year and s.term=t.term) then raise exception 'curriculum_target_in_use';end if;
  update gina.curriculum_source_targets set index_url=v_url,status=v_status,note=v_note,updated_by=auth.uid(),updated_at=now() where id=t.id returning * into t;action:='updated';
 end if;
 result:=jsonb_build_object('request',p_request_id,'action',action,'target',jsonb_build_object('id',t.id,'exam_family',t.exam_family,'school_year',t.school_year,'term',t.term,'index_url',t.index_url,'status',t.status,'note',t.note));
 insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
 if action<>'unchanged' then
  insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.target_'||action,'gina.curriculum_source_targets',t.id::text,t.school_year||'/'||t.term||' '||t.status||': '||t.note);
 end if;
 return result;
end;$$;

create function public.admin_list_curriculum_source_targets() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'exam_family',t.exam_family,'school_year',t.school_year,'term',t.term,'index_url',t.index_url,'status',t.status,'note',t.note,
  'created_at',t.created_at,'updated_at',t.updated_at,'system_seed',t.created_by is null,
  'sources',(select count(*) from gina.curriculum_sources s where s.exam_family=t.exam_family and s.school_year=t.school_year and s.term=t.term),
  'last_checked_at',(select max(s.last_checked_at) from gina.curriculum_sources s where s.exam_family=t.exam_family and s.school_year=t.school_year and s.term=t.term))
  order by t.school_year desc,t.term desc),'[]') from gina.curriculum_source_targets t);
end;$$;

-- Edge (service role) resolves the index page from the registry; absent/retired → caller answers `unpublished`.
create function public.get_curriculum_source_target(p_exam_family text,p_year text,p_term int) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 return (select jsonb_build_object('id',t.id,'index_url',t.index_url,'status',t.status) from gina.curriculum_source_targets t
  where t.exam_family=p_exam_family and t.school_year=p_year and t.term=p_term and t.status='active');
end;$$;

-- 2. Extraction: queued → done | failed through a visible operator step (scripts/fetch-curriculum-sources.py
-- --process-queue). The bytes are re-verified by hash before extraction; the import is idempotent per (key, hash).
alter table gina.curriculum_source_revisions add column extraction jsonb;

create function public.admin_record_curriculum_extraction(p_request_id uuid,p_revision_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text;cmd gina.curriculum_fetch_commands;r gina.curriculum_source_revisions;s gina.curriculum_sources;c jsonb;existing gina.curriculum_candidates;ch text;
 added int:=0;kept int:=0;total int:=0;outcome text;bundle_hash text;summary jsonb;result jsonb;begin
 perform gina.assert_admin();
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
  if cmd.actor_id<>auth.uid() or cmd.payload_hash<>h then raise exception 'request_conflict';end if;return cmd.result;
 end if;
 select * into r from gina.curriculum_source_revisions where id=p_revision_id for update;
 if r.status in('withdrawn','superseded') then raise exception 'curriculum_revision_conflict';end if;
 if outcome='done' then
  bundle_hash:=encode(extensions.digest((p_result->'bundle')::text,'sha256'),'hex');
  if r.extraction_status='done' then
   -- Re-running the same extraction is a no-op; different output for the same bytes needs a human, not an overwrite.
   if r.extraction->>'bundle_sha256'=bundle_hash then
    result:=jsonb_build_object('request',p_request_id,'outcome','unchanged','revision_id',r.id,'extraction_status',r.extraction_status,'extraction',r.extraction);
    insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
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
    insert into gina.curriculum_candidates(external_key,source_sha256,candidate,content_hash,created_by) values(c->>'key',c->>'source_sha256',c,ch,auth.uid());added:=added+1;
   end if;
  end loop;
  summary:=jsonb_build_object('outcome','done','extractor',p_result->'extractor','scenarios',total,'issues',p_result->'issues','created',added,'existing',kept,'bundle_sha256',bundle_hash,'at',now(),'by',auth.uid());
  update gina.curriculum_source_revisions set extraction_status='done',extraction=summary where id=r.id returning * into r;
 else
  if r.extraction_status='done' then raise exception 'curriculum_extraction_conflict';end if;
  summary:=jsonb_build_object('outcome','failed','extractor',p_result->'extractor','error',p_result->'error','at',now(),'by',auth.uid());
  update gina.curriculum_source_revisions set extraction_status='failed',extraction=summary where id=r.id returning * into r;
 end if;
 result:=jsonb_build_object('request',p_request_id,'outcome',outcome,'revision_id',r.id,'extraction_status',r.extraction_status,'extraction',r.extraction);
 insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.extraction_'||outcome,'gina.curriculum_source_revisions',r.id::text,
  case when outcome='done' then 'Candidates from '||left(r.sha256,12)||': '||added||' new, '||kept||' existing; review-only' else 'Extraction failed: '||(p_result->>'error') end);
 return result;
end;$$;

-- Source projection gains the extraction summary (status machine stays queued|done|failed|skipped).
create or replace function gina.curriculum_source_projection(s gina.curriculum_sources) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'source_key',s.source_key,'exam_family',s.exam_family,'school_year',s.school_year,'term',s.term,'label',s.label,
  'index_url',s.index_url,'link_url',s.link_url,'freshness',s.freshness,'last_checked_at',s.last_checked_at,'last_check_error',s.last_check_error,
  'index_published_on',s.index_published_on,'index_updated_on',s.index_updated_on,
  'approved',(select jsonb_build_object('revision_id',r.id,'sha256',r.sha256,'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at) from gina.curriculum_source_revisions r where r.source_id=s.id and r.status='approved'),
  'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sha256',r.sha256,'bytes',r.bytes,'mime',r.mime,'resolved_url',r.resolved_url,'redirect_chain',r.redirect_chain,'inspection',r.inspection,
    'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at,'status',r.status,'extraction_status',r.extraction_status,'extraction',r.extraction,'review_note',r.review_note,'reviewed_at',r.reviewed_at,
    'candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256),
    'published_candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256 and c.status='published')) order by r.retrieved_at desc),'[]') from gina.curriculum_source_revisions r where r.source_id=s.id))
$$;

-- 3. Publication requires the candidate's fetched revision to be the approved copy (legacy manifest imports that
-- never had a server revision keep the previous rule). Publishing a candidate of a newer approved revision closes
-- the older revision's published candidate with the same key for NEW selections; frozen family copies stay.
create or replace function public.admin_change_curriculum_candidate(p_request_id uuid,p_id uuid,p_revision int,p_action text,p_review jsonb,p_note text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.curriculum_candidates;r gina.curriculum_commands;h text;result jsonb;replaced int:=0;begin
 perform gina.assert_admin();
 if p_request_id is null or p_id is null or p_revision is null or p_action is null or p_action not in('review','publish','withdraw') or p_confirmed is not true or length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'curriculum_review_required';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_id,p_revision,p_action,p_review,p_note,p_confirmed)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(73491822);
 select * into r from gina.curriculum_commands where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.payload_hash<>h then raise exception 'request_conflict';end if;return r.result;
 end if;
 select * into c from gina.curriculum_candidates where id=p_id for update;
 if not found then raise exception 'curriculum_not_found';end if;
 if c.revision<>p_revision then raise exception 'curriculum_revision_conflict';end if;
 if p_action='review' then
  if c.status='published' then raise exception 'curriculum_withdraw_first';end if;
  perform gina.import_keys(p_review,array['programme','school_scope','programme_url','source_checked','counts_checked','applicability_checked','issues_resolution','note']);
  perform gina.import_text(p_review->'programme',1,160);perform gina.import_text(p_review->'school_scope',1,500);
  perform gina.curriculum_url(p_review->'programme_url');perform gina.import_text(p_review->'issues_resolution',1,4000);perform gina.import_text(p_review->'note',1,2000);
  if p_review->'source_checked' is distinct from 'true'::jsonb or p_review->'counts_checked' is distinct from 'true'::jsonb or p_review->'applicability_checked' is distinct from 'true'::jsonb then raise exception 'curriculum_review_required';end if;
  update gina.curriculum_candidates set review=p_review,reviewed_by=auth.uid(),reviewed_at=now(),status='reviewed',revision=revision+1 where id=p_id returning * into c;
 elsif p_action='publish' then
  if c.status<>'reviewed' or c.review is null then raise exception 'curriculum_review_required';end if;
  if exists(select 1 from gina.curriculum_source_revisions v where v.sha256=c.source_sha256) and not exists(select 1 from gina.curriculum_source_revisions v where v.sha256=c.source_sha256 and v.status='approved') then raise exception 'curriculum_source_not_approved';end if;
  update gina.curriculum_candidates set status='published',revision=revision+1 where id=p_id returning * into c;
  update gina.curriculum_candidates o set status='withdrawn',revision=o.revision+1 where o.external_key=c.external_key and o.source_sha256<>c.source_sha256 and o.status='published';
  get diagnostics replaced=row_count;
 else
  if c.status<>'published' then raise exception 'curriculum_not_published';end if;
  update gina.curriculum_candidates set status='withdrawn',revision=revision+1 where id=p_id returning * into c;
 end if;
 result:=jsonb_build_object('request',p_request_id,'action',p_action,'id',c.id,'revision',c.revision,'status',c.status)||case when p_action='publish' then jsonb_build_object('replaced_previous',replaced) else '{}'::jsonb end;
 insert into gina.curriculum_commands values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.'||p_action,'gina.curriculum_candidates',c.id::text,trim(p_note));
 return result;
end;$$;

-- 4. Parent freshness v2: same facts as v1 plus whether an official index exists for exactly the requested
-- year/term and whether the last successful check is stale. Never falls back to another term or year.
create function public.get_curriculum_source_status(p_year text,p_term int,p_subject text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s gina.curriculum_sources;approved gina.curriculum_source_revisions;target boolean;stale_days int;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_year is null or p_year !~ '^20[0-9]{2}-20[0-9]{2}$' or p_term is null or p_term not in(1,2) then raise exception 'invalid_input';end if;
 target:=exists(select 1 from gina.curriculum_source_targets t where t.exam_family='oyss' and t.school_year=p_year and t.term=p_term and t.status='active');
 select * into s from gina.curriculum_sources where school_year=p_year and term=p_term and gina.curriculum_subject(label)=gina.curriculum_subject(coalesce(p_subject,'')) order by created_at limit 1;
 if not found then
  return jsonb_build_object('status','unpublished','alternative','free_study','officially_verified',false,'requested',jsonb_build_object('school_year',p_year,'term',p_term),
   'target_registered',target,'substituted',false,'stale',false,'reason',case when target then 'source_not_fetched' else 'no_official_index' end);
 end if;
 select * into approved from gina.curriculum_source_revisions where source_id=s.id and status='approved';
 stale_days:=case when s.last_checked_at is null then null else floor(extract(epoch from now()-s.last_checked_at)/86400)::int end;
 return jsonb_build_object('status',s.freshness,'last_checked_at',s.last_checked_at,'index_updated_on',s.index_updated_on,
  'last_approved_retrieved_at',approved.retrieved_at,'last_approved_sha256',approved.sha256,
  'alternative',case when approved.id is null or s.freshness='withdrawn' then 'free_study' else null end,'officially_verified',false,
  'requested',jsonb_build_object('school_year',p_year,'term',p_term),'target_registered',target,'substituted',false,
  'stale',s.last_checked_at is null or s.last_checked_at<now()-interval '7 days' or s.freshness='unverified','stale_days',stale_days);
end;$$;

-- 5. Reasoned content-fit review of scenario-bound generated questions. Provenance keeps
-- `content_fit: pending_human_review` forever (it is a fact about generation time); the decision lives here.
-- An AI suggestion (E01 verdict shape) is stored separately and never sets the human decision.
create table gina.scenario_question_fit (
 question_id uuid primary key references public.question_bank(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 catalogue_id uuid not null, catalogue_revision int not null, block_id text not null, outcome_ids jsonb not null,
 decision text not null default 'pending_human_review' check(decision in('pending_human_review','fit','not_fit','needs_revision')),
 measured_outcome_ids jsonb, reason text check(reason is null or length(reason) between 10 and 2000),
 reviewed_by uuid, reviewed_at timestamptz, revision int not null default 0,
 ai_suggestion jsonb, ai_suggested_at timestamptz,
 created_at timestamptz not null default now()
);
create index scenario_question_fit_family_idx on gina.scenario_question_fit(family_id,decision);
alter table gina.scenario_question_fit enable row level security;
revoke all on gina.scenario_question_fit from public,anon,authenticated,service_role;

create function gina.queue_scenario_question_fit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.family_id is not null and new.provenance->>'content_fit'='pending_human_review' and new.provenance ? 'catalogue_id' and new.provenance ? 'block_id' then
  insert into gina.scenario_question_fit(question_id,family_id,catalogue_id,catalogue_revision,block_id,outcome_ids)
  values(new.id,new.family_id,(new.provenance->>'catalogue_id')::uuid,coalesce((new.provenance->>'catalogue_revision')::int,0),new.provenance->>'block_id',coalesce(new.provenance->'outcome_ids','[]'::jsonb))
  on conflict(question_id) do nothing;
 end if;
 return new;
end;$$;
revoke all on function gina.queue_scenario_question_fit() from public,anon,authenticated,service_role;
create trigger queue_scenario_question_fit after insert on public.question_bank for each row execute function gina.queue_scenario_question_fit();

create function gina.scenario_fit_projection(f gina.scenario_question_fit) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('question_id',f.question_id,'catalogue_id',f.catalogue_id,'catalogue_revision',f.catalogue_revision,'block_id',f.block_id,'outcome_ids',f.outcome_ids,
  'decision',f.decision,'measured_outcome_ids',f.measured_outcome_ids,'reason',f.reason,'reviewed_at',f.reviewed_at,'revision',f.revision,
  'ai_suggestion',f.ai_suggestion,'ai_suggested_at',f.ai_suggested_at,'ai_is_decision',false)
$$;
revoke all on function gina.scenario_fit_projection(gina.scenario_question_fit) from public,anon,authenticated,service_role;

create function public.review_scenario_question_fit(p_request_id uuid,p_question_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare fam uuid:=gina.family_id();actor uuid:=auth.uid();receipt public.mutation_receipts;f gina.scenario_question_fit;d text;v_reason text;measured jsonb;result jsonb;begin
 if not gina.is_parent() or fam is null or actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_question_id is null then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>fam or receipt.actor_id<>actor or receipt.operation<>'scenario_question_fit' or receipt.payload is distinct from jsonb_build_object('q',p_question_id,'input',p_input) then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 begin
  perform gina.import_keys(p_input,array['decision','reason','measured_outcome_ids','revision','confirmed']);
  d:=gina.import_text(p_input->'decision',3,14);v_reason:=trim(gina.import_text(p_input->'reason',10,2000));perform gina.import_int(p_input->'revision',0,1000000);
 exception when others then raise exception 'content_fit_reason_required';end;
 if d not in('fit','not_fit','needs_revision') or p_input->'confirmed' is distinct from 'true'::jsonb then raise exception 'content_fit_reason_required';end if;
 select * into f from gina.scenario_question_fit where question_id=p_question_id and family_id=fam for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if f.revision<>(p_input->>'revision')::int then raise exception 'content_fit_revision_conflict';end if;
 measured:=p_input->'measured_outcome_ids';
 if jsonb_typeof(measured) is distinct from 'array' or jsonb_array_length(measured)>20
  or exists(select 1 from jsonb_array_elements(measured) m where jsonb_typeof(m)<>'string' or not(f.outcome_ids @> jsonb_build_array(m))) then raise exception 'content_fit_outcome_mismatch';end if;
 -- "Fit" needs at least one outcome the reviewer confirms the question actually measures; a code label alone is not enough.
 if d='fit' and jsonb_array_length(measured)=0 then raise exception 'content_fit_outcome_mismatch';end if;
 update gina.scenario_question_fit set decision=d,reason=v_reason,measured_outcome_ids=measured,reviewed_by=actor,reviewed_at=now(),revision=revision+1 where question_id=f.question_id returning * into f;
 result:=gina.scenario_fit_projection(f);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,fam,actor,'scenario_question_fit',jsonb_build_object('q',p_question_id,'input',p_input),result);
 return result;
end;$$;

create function public.get_scenario_question_fit(p_question_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam uuid:=gina.family_id();rows jsonb;begin
 if not gina.is_parent() or fam is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_question_ids is null or cardinality(p_question_ids) not between 1 and 200 then raise exception 'invalid_input';end if;
 select coalesce(jsonb_agg(gina.scenario_fit_projection(f) order by f.block_id,f.question_id),'[]') into rows from gina.scenario_question_fit f where f.family_id=fam and f.question_id=any(p_question_ids);
 return jsonb_build_object('items',rows,'summary',jsonb_build_object(
  'total',jsonb_array_length(rows),
  'fit',(select count(*) from jsonb_array_elements(rows) x where x->>'decision'='fit'),
  'not_fit',(select count(*) from jsonb_array_elements(rows) x where x->>'decision'='not_fit'),
  'needs_revision',(select count(*) from jsonb_array_elements(rows) x where x->>'decision'='needs_revision'),
  'pending_human_review',(select count(*) from jsonb_array_elements(rows) x where x->>'decision'='pending_human_review'),
  -- Accepted only when every requested question has a reasoned human "fit"; pending never counts as success.
  'accepted',jsonb_array_length(rows)=cardinality(p_question_ids) and not exists(select 1 from jsonb_array_elements(rows) x where x->>'decision'<>'fit')));
end;$$;

create function public.record_scenario_question_fit_suggestion(p_question_id uuid,p_verdict jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f gina.scenario_question_fit;begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_verdict) is distinct from 'object' or octet_length(p_verdict::text)>20000 or not(p_verdict ?& array['decision_reason','confidence','findings','recommendation'])
  or p_verdict->>'recommendation' not in('approve','admin_review','reject') then raise exception 'prereview_verdict_invalid';end if;
 update gina.scenario_question_fit set ai_suggestion=p_verdict,ai_suggested_at=now() where question_id=p_question_id returning * into f;
 if not found then raise exception 'not_found';end if;
 return gina.scenario_fit_projection(f);
end;$$;

-- 6. Backoffice pipeline view: targets, extraction queue, and per-candidate source + E01 AI pre-review state.
create function public.admin_curriculum_pipeline() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'queue',(select coalesce(jsonb_agg(jsonb_build_object('revision_id',r.id,'source_id',s.id,'label',s.label,'school_year',s.school_year,'term',s.term,'sha256',r.sha256,
    'status',r.status,'extraction_status',r.extraction_status,'extraction',r.extraction,'resolved_url',r.resolved_url,'retrieved_at',r.retrieved_at) order by r.retrieved_at),'[]')
   from gina.curriculum_source_revisions r join gina.curriculum_sources s on s.id=r.source_id where r.extraction_status in('queued','failed') and r.status not in('withdrawn','superseded')),
  'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'source_sha256',c.source_sha256,
    'source_status',coalesce((select v.status from gina.curriculum_source_revisions v where v.sha256=c.source_sha256 order by (v.status='approved') desc,v.retrieved_at desc limit 1),'manifest_only'),
    'prereview_status',(select p.prereview_status from gina.content_prereviews p where p.target_kind='curriculum_candidate' and p.target_id=c.id),
    'prereview_reason',(select p.prereview_verdict->>'decision_reason' from gina.content_prereviews p where p.target_kind='curriculum_candidate' and p.target_id=c.id))),'[]')
   from gina.curriculum_candidates c),
  'operator_step','python3 scripts/fetch-curriculum-sources.py --process-queue');
end;$$;

revoke all on function public.admin_save_curriculum_source_target(uuid,jsonb),public.admin_list_curriculum_source_targets(),public.admin_record_curriculum_extraction(uuid,uuid,jsonb),
 public.get_curriculum_source_status(text,int,text),public.review_scenario_question_fit(uuid,uuid,jsonb),public.get_scenario_question_fit(uuid[]),public.admin_curriculum_pipeline() from public,anon,service_role;
grant execute on function public.admin_save_curriculum_source_target(uuid,jsonb),public.admin_list_curriculum_source_targets(),public.admin_record_curriculum_extraction(uuid,uuid,jsonb),
 public.get_curriculum_source_status(text,int,text),public.review_scenario_question_fit(uuid,uuid,jsonb),public.get_scenario_question_fit(uuid[]),public.admin_curriculum_pipeline() to authenticated;
revoke all on function public.get_curriculum_source_target(text,text,int),public.record_scenario_question_fit_suggestion(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_curriculum_source_target(text,text,int),public.record_scenario_question_fit_suggestion(uuid,jsonb) to service_role;
