-- Official source acquisition and versioning (M01). A fetched file is evidence, not a published catalogue,
-- not a school's scenario choice and not MEB endorsement. Same hash → only last_checked_at moves. New hash →
-- new revision requiring a diff review. Published candidates and frozen family snapshots are never rewritten.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gina-curriculum-sources','gina-curriculum-sources',false,5242880,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;

create table gina.curriculum_sources (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique check(source_key ~ '^[a-z0-9]+:20[0-9]{2}-20[0-9]{2}:[12]:[a-z0-9_-]{1,60}$'),
 exam_family text not null check(exam_family in('oyss')),
 school_year text not null check(school_year ~ '^20[0-9]{2}-20[0-9]{2}$'),
 term int not null check(term in(1,2)),
 label text not null check(length(label) between 1 and 100),
 index_url text not null, link_url text not null,
 freshness text not null default 'unverified' check(freshness in('verified','unverified','pending_review','diff_review_required','withdrawn')),
 last_checked_at timestamptz, last_check_error text check(last_check_error is null or length(last_check_error)<=300),
 index_published_on date, index_updated_on date,
 created_by uuid not null, created_at timestamptz not null default now()
);
create table gina.curriculum_source_revisions (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references gina.curriculum_sources(id) on delete cascade,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 bytes int not null check(bytes between 1 and 5242880),
 mime text not null check(length(mime) between 1 and 120),
 resolved_url text not null, redirect_chain jsonb not null default '[]', inspection jsonb not null default '{}',
 storage_path text, retrieved_at timestamptz not null, last_checked_at timestamptz not null,
 status text not null check(status in('pending_review','approved','diff_review_required','superseded','withdrawn')),
 extraction_status text not null default 'queued' check(extraction_status in('queued','done','failed','skipped')),
 review_note text, reviewed_by uuid, reviewed_at timestamptz,
 created_by uuid not null, created_at timestamptz not null default now(),
 unique(source_id,sha256)
);
create table gina.curriculum_fetch_commands(request_id uuid primary key,actor_id uuid not null,payload_hash text not null,result jsonb not null,created_at timestamptz not null default now());
alter table gina.curriculum_sources enable row level security;
alter table gina.curriculum_source_revisions enable row level security;
alter table gina.curriculum_fetch_commands enable row level security;
revoke all on gina.curriculum_sources,gina.curriculum_source_revisions,gina.curriculum_fetch_commands from public,anon,authenticated,service_role;

create function gina.curriculum_fetch_url(p jsonb,p_final boolean) returns text language plpgsql immutable set search_path='' as $$
declare v text:=gina.import_text(p,1,2000);h text;begin
 if v !~ '^https://[^/?#@:]+(/[^[:space:]]*)?$' then raise exception 'curriculum_source_invalid';end if;
 h:=lower(split_part(split_part(substr(v,9),'/',1),'?',1));
 if h ~ '^([a-z0-9-]+\.)*(meb|eba)\.gov\.tr$' then return v;end if;
 if not p_final and h='meb.ai' then return v;end if;
 raise exception 'curriculum_source_invalid';
end;$$;
revoke all on function gina.curriculum_fetch_url(jsonb,boolean) from public,anon,authenticated,service_role;

create function gina.curriculum_source_projection(s gina.curriculum_sources) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'source_key',s.source_key,'exam_family',s.exam_family,'school_year',s.school_year,'term',s.term,'label',s.label,
  'index_url',s.index_url,'link_url',s.link_url,'freshness',s.freshness,'last_checked_at',s.last_checked_at,'last_check_error',s.last_check_error,
  'index_published_on',s.index_published_on,'index_updated_on',s.index_updated_on,
  'approved',(select jsonb_build_object('revision_id',r.id,'sha256',r.sha256,'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at) from gina.curriculum_source_revisions r where r.source_id=s.id and r.status='approved'),
  'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sha256',r.sha256,'bytes',r.bytes,'mime',r.mime,'resolved_url',r.resolved_url,'redirect_chain',r.redirect_chain,'inspection',r.inspection,
    'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at,'status',r.status,'extraction_status',r.extraction_status,'review_note',r.review_note,'reviewed_at',r.reviewed_at,
    'candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256),
    'published_candidates',(select count(*) from gina.curriculum_candidates c where c.source_sha256=r.sha256 and c.status='published')) order by r.retrieved_at desc),'[]') from gina.curriculum_source_revisions r where r.source_id=s.id))
$$;
revoke all on function gina.curriculum_source_projection(gina.curriculum_sources) from public,anon,authenticated,service_role;

-- Called only by the curriculum-source-fetch Edge Function (service role) on behalf of a verified admin.
-- p_revision null = network/policy failure: last approved copy stays, freshness becomes 'unverified'.
create function public.record_curriculum_source_fetch(p_request_id uuid,p_actor_id uuid,p_source jsonb,p_revision jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text;cmd gina.curriculum_fetch_commands;s gina.curriculum_sources;r gina.curriculum_source_revisions;approved gina.curriculum_source_revisions;result jsonb;key text;new_status text;now_at timestamptz:=now();begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 if p_actor_id is null or not exists(select 1 from public.admins a where a.user_id=p_actor_id) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or octet_length(p_source::text)>20000 or octet_length(coalesce(p_revision,'null')::text)>20000 then raise exception 'curriculum_source_invalid';end if;
 perform gina.import_keys(p_source,array['source_key','exam_family','school_year','term','label','index_url','link_url','index_published_on','index_updated_on','error']);
 key:=gina.import_text(p_source->'source_key',1,100);
 if key !~ '^[a-z0-9]+:20[0-9]{2}-20[0-9]{2}:[12]:[a-z0-9_-]{1,60}$' or p_source->>'exam_family' is distinct from 'oyss' then raise exception 'curriculum_source_invalid';end if;
 perform gina.import_text(p_source->'school_year',9,9);perform gina.import_int(p_source->'term',1,2);perform gina.import_text(p_source->'label',1,100);
 perform gina.curriculum_fetch_url(p_source->'index_url',true);perform gina.curriculum_fetch_url(p_source->'link_url',false);
 if p_source->'error' is distinct from 'null'::jsonb then perform gina.import_text(p_source->'error',1,300);end if;
 -- Exactly one of: a fetched revision, or a failure reason.
 if (p_revision is null or p_revision='null'::jsonb) <> (p_source->'error' is distinct from 'null'::jsonb) then raise exception 'curriculum_source_invalid';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_actor_id,p_source,p_revision)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(key,61));
 select * into cmd from gina.curriculum_fetch_commands where request_id=p_request_id;
 if found then
  if cmd.actor_id<>p_actor_id or cmd.payload_hash<>h then raise exception 'request_conflict';end if;return cmd.result;
 end if;
 select * into s from gina.curriculum_sources where source_key=key for update;
 if not found then
  insert into gina.curriculum_sources(source_key,exam_family,school_year,term,label,index_url,link_url,created_by)
  values(key,'oyss',p_source->>'school_year',(p_source->>'term')::int,p_source->>'label',p_source->>'index_url',p_source->>'link_url',p_actor_id) returning * into s;
 end if;
 update gina.curriculum_sources set index_published_on=coalesce((p_source->>'index_published_on')::date,index_published_on),index_updated_on=coalesce((p_source->>'index_updated_on')::date,index_updated_on),link_url=p_source->>'link_url' where id=s.id;
 select * into approved from gina.curriculum_source_revisions where source_id=s.id and status='approved';
 if p_revision is null or p_revision='null'::jsonb then
  update gina.curriculum_sources set freshness=case when freshness='withdrawn' then 'withdrawn' else 'unverified' end,last_checked_at=now_at,last_check_error=p_source->>'error' where id=s.id returning * into s;
  result:=jsonb_build_object('request',p_request_id,'outcome','unverified','source_id',s.id,'freshness',s.freshness,'error',p_source->>'error',
   'last_approved',case when approved.id is null then null else jsonb_build_object('revision_id',approved.id,'sha256',approved.sha256,'retrieved_at',approved.retrieved_at,'last_checked_at',approved.last_checked_at) end,
   'alternative',case when approved.id is null then 'free_study' else null end);
 else
  perform gina.import_keys(p_revision,array['sha256','bytes','mime','resolved_url','redirect_chain','inspection','storage_path']);
  if gina.import_text(p_revision->'sha256',64,64) !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_revision->'redirect_chain') is distinct from 'array' or jsonb_typeof(p_revision->'inspection') is distinct from 'object' then raise exception 'curriculum_source_invalid';end if;
  perform gina.import_int(p_revision->'bytes',1,5242880);perform gina.import_text(p_revision->'mime',1,120);perform gina.curriculum_fetch_url(p_revision->'resolved_url',true);
  if p_revision->'storage_path' is distinct from 'null'::jsonb then perform gina.import_text(p_revision->'storage_path',1,300);end if;
  select * into r from gina.curriculum_source_revisions where source_id=s.id and sha256=p_revision->>'sha256' for update;
  if found then
   -- Same bytes: no new revision, no extraction job, no quota. Only the check timestamp moves.
   update gina.curriculum_source_revisions set last_checked_at=now_at where id=r.id returning * into r;
   update gina.curriculum_sources set last_checked_at=now_at,last_check_error=null,
    freshness=case when r.status='approved' then 'verified' when r.status in('pending_review','diff_review_required') then r.status when freshness='withdrawn' then 'withdrawn' else 'unverified' end where id=s.id returning * into s;
   result:=jsonb_build_object('request',p_request_id,'outcome','unchanged','source_id',s.id,'revision_id',r.id,'sha256',r.sha256,'status',r.status,'freshness',s.freshness,'extraction_status',r.extraction_status,'retrieved_at',r.retrieved_at,'last_checked_at',r.last_checked_at);
  else
   new_status:=case when approved.id is null then 'pending_review' else 'diff_review_required' end;
   insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,redirect_chain,inspection,storage_path,retrieved_at,last_checked_at,status,created_by)
   values(s.id,p_revision->>'sha256',(p_revision->>'bytes')::int,p_revision->>'mime',p_revision->>'resolved_url',p_revision->'redirect_chain',p_revision->'inspection',p_revision->>'storage_path',now_at,now_at,new_status,p_actor_id) returning * into r;
   update gina.curriculum_sources set last_checked_at=now_at,last_check_error=null,freshness=case when freshness='withdrawn' and new_status='pending_review' then 'withdrawn' else new_status end where id=s.id returning * into s;
   insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(p_actor_id,'curriculum.source_revision','gina.curriculum_source_revisions',r.id::text,'New source revision '||left(r.sha256,12)||' ('||new_status||'); extraction queued');
   result:=jsonb_build_object('request',p_request_id,'outcome','new_revision','source_id',s.id,'revision_id',r.id,'sha256',r.sha256,'status',r.status,'freshness',s.freshness,'extraction_status',r.extraction_status,'retrieved_at',r.retrieved_at,
    'previous_approved',case when approved.id is null then null else jsonb_build_object('revision_id',approved.id,'sha256',approved.sha256,'retrieved_at',approved.retrieved_at) end);
  end if;
 end if;
 insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,p_actor_id,h,result);
 return result;
end;$$;

create function public.admin_list_curriculum_sources() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(gina.curriculum_source_projection(s) order by s.school_year desc,s.term desc,s.label),'[]') from gina.curriculum_sources s);
end;$$;

-- approve: this revision becomes the approved copy (previous approved → superseded). withdraw: stops new
-- selection/generation from candidates of that hash; existing family snapshots and questions stay. dismiss: a
-- fetched revision is set aside without changing the approved copy.
create function public.admin_review_curriculum_source_revision(p_request_id uuid,p_revision_id uuid,p_action text,p_note text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cmd gina.curriculum_fetch_commands;r gina.curriculum_source_revisions;s gina.curriculum_sources;h text;result jsonb;withdrawn int:=0;begin
 perform gina.assert_admin();
 if p_request_id is null or p_revision_id is null or p_action not in('approve','withdraw','dismiss') or p_confirmed is not true or length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'curriculum_review_required';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_revision_id,p_action,p_note,p_confirmed)::text,'sha256'),'hex');
 select * into r from gina.curriculum_source_revisions where id=p_revision_id;
 if not found then raise exception 'curriculum_not_found';end if;
 perform pg_advisory_xact_lock(hashtextextended((select source_key from gina.curriculum_sources where id=r.source_id),61));
 select * into cmd from gina.curriculum_fetch_commands where request_id=p_request_id;
 if found then
  if cmd.actor_id<>auth.uid() or cmd.payload_hash<>h then raise exception 'request_conflict';end if;return cmd.result;
 end if;
 select * into r from gina.curriculum_source_revisions where id=p_revision_id for update;
 select * into s from gina.curriculum_sources where id=r.source_id for update;
 if p_action='approve' then
  if r.status not in('pending_review','diff_review_required') then raise exception 'curriculum_revision_conflict';end if;
  update gina.curriculum_source_revisions set status='superseded',review_note=coalesce(review_note,'')||' superseded by '||left(r.sha256,12),reviewed_by=auth.uid(),reviewed_at=now() where source_id=s.id and status='approved';
  update gina.curriculum_source_revisions set status='approved',review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id returning * into r;
  update gina.curriculum_sources set freshness='verified' where id=s.id returning * into s;
 elsif p_action='withdraw' then
  if r.status='withdrawn' then raise exception 'curriculum_revision_conflict';end if;
  update gina.curriculum_source_revisions set status='withdrawn',review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id returning * into r;
  -- Published candidates of this hash stop being selectable. Frozen family copies are not touched.
  update gina.curriculum_candidates set status='withdrawn',revision=revision+1 where source_sha256=r.sha256 and status='published';
  get diagnostics withdrawn=row_count;
  if not exists(select 1 from gina.curriculum_source_revisions where source_id=s.id and status='approved') then update gina.curriculum_sources set freshness='withdrawn' where id=s.id returning * into s;end if;
 else
  if r.status not in('pending_review','diff_review_required') then raise exception 'curriculum_revision_conflict';end if;
  update gina.curriculum_source_revisions set status='superseded',extraction_status=case when extraction_status='queued' then 'skipped' else extraction_status end,review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id returning * into r;
  if exists(select 1 from gina.curriculum_source_revisions where source_id=s.id and status='approved') then update gina.curriculum_sources set freshness='verified' where id=s.id returning * into s;end if;
 end if;
 result:=jsonb_build_object('request',p_request_id,'action',p_action,'revision_id',r.id,'status',r.status,'freshness',s.freshness,'withdrawn_candidates',withdrawn);
 insert into gina.curriculum_fetch_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.source_'||p_action,'gina.curriculum_source_revisions',r.id::text,trim(p_note));
 return result;
end;$$;

-- Parents read freshness only: never a file, never a scenario choice. Unknown scope → explicit free-study alternative.
create function public.get_curriculum_source_freshness(p_year text,p_term int,p_subject text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s gina.curriculum_sources;approved gina.curriculum_source_revisions;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into s from gina.curriculum_sources where school_year=p_year and term=p_term and gina.curriculum_subject(label)=gina.curriculum_subject(coalesce(p_subject,'')) order by created_at limit 1;
 if not found then return jsonb_build_object('status','unpublished','alternative','free_study','officially_verified',false);end if;
 select * into approved from gina.curriculum_source_revisions where source_id=s.id and status='approved';
 return jsonb_build_object('status',s.freshness,'last_checked_at',s.last_checked_at,'index_updated_on',s.index_updated_on,
  'last_approved_retrieved_at',approved.retrieved_at,'last_approved_sha256',approved.sha256,
  'alternative',case when approved.id is null or s.freshness='withdrawn' then 'free_study' else null end,'officially_verified',false);
end;$$;

revoke all on function public.record_curriculum_source_fetch(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_curriculum_source_fetch(uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function public.admin_list_curriculum_sources(),public.admin_review_curriculum_source_revision(uuid,uuid,text,text,boolean),public.get_curriculum_source_freshness(text,int,text) from public,anon,service_role;
grant execute on function public.admin_list_curriculum_sources(),public.admin_review_curriculum_source_revision(uuid,uuid,text,text,boolean),public.get_curriculum_source_freshness(text,int,text) to authenticated;
