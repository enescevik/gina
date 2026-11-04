-- Published source selection is a frozen, child-specific family copy, not MEB endorsement.
create function gina.curriculum_subject(p text) returns text language sql immutable set search_path='' as $$
 select case trim(p) when 'İlköğretim Matematik' then 'Matematik' when 'Fen' then 'Fen Bilimleri' else trim(p) end
$$;
revoke all on function gina.curriculum_subject(text) from public,anon,authenticated,service_role;
create table gina.catalog_blueprint_links (
 blueprint_id uuid primary key references public.exam_blueprints(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid references public.children(id) on delete set null,
 catalogue_id uuid not null references gina.curriculum_candidates(id),
 revision int not null, snapshot jsonb not null,
 unique(family_id,child_id,catalogue_id,revision)
);
create table gina.catalog_generation_links (
 job_id uuid primary key references public.prova_generation_jobs(id) on delete cascade,
 blueprint_id uuid not null, draft_id uuid not null
);
alter table gina.catalog_blueprint_links enable row level security;
alter table gina.catalog_generation_links enable row level security;
revoke all on gina.catalog_blueprint_links,gina.catalog_generation_links from public,anon,authenticated,service_role;

create or replace function public.get_curriculum_scenarios(p_child_id uuid,p_year text,p_term int,p_exam int,p_subject text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare grade int;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select ch.grade into grade from public.children ch where ch.id=p_child_id and ch.family_id=gina.family_id();
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then return '[]';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'revision',c.revision,'content_hash',c.content_hash,'candidate',c.candidate,'programme',c.review->'programme','school_scope',c.review->'school_scope','programme_url',c.review->'programme_url') order by c.external_key),'[]')
 from gina.curriculum_candidates c where c.status='published' and (c.candidate->>'grade')::int=grade and c.candidate->>'academic_year'=p_year and (c.candidate->>'term')::int=p_term and (c.candidate->>'exam')::int=p_exam and gina.curriculum_subject(c.candidate->>'subject')=gina.curriculum_subject(p_subject));
end;$$;

create function public.save_catalog_blueprint(p_request_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();actor uuid:=auth.uid();receipt public.mutation_receipts;c gina.curriculum_candidates;ch public.children;result uuid;rows jsonb;snapshot jsonb;subject text;begin
 if not gina.is_parent() or f is null or actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null then raise exception 'curriculum_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>actor or receipt.operation<>'catalog_blueprint' or receipt.payload is distinct from p_input then raise exception 'request_conflict';end if;
  return (receipt.result#>>'{}')::uuid;
 end if;
 perform gina.import_keys(p_input,array['child_id','catalogue_id','revision','subject','confirmed']);
 if p_input->'confirmed' is distinct from 'true'::jsonb then raise exception 'curriculum_school_confirmation_required';end if;
 subject:=gina.curriculum_subject(gina.import_text(p_input->'subject',1,80));
 perform gina.import_int(p_input->'revision',1,2147483647);
 -- Family lock deduplicates two devices selecting the same published version.
 perform pg_advisory_xact_lock(hashtextextended(f::text,79));
 select * into ch from public.children where id=(p_input->>'child_id')::uuid and family_id=f for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 select * into c from gina.curriculum_candidates where id=(p_input->>'catalogue_id')::uuid for share;
 if not found or c.status<>'published' or not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then raise exception 'curriculum_unavailable';end if;
 if c.revision<>(p_input->>'revision')::int then raise exception 'curriculum_revision_conflict';end if;
 if ch.grade is distinct from (c.candidate->>'grade')::int or gina.curriculum_subject(subject)<>gina.curriculum_subject(c.candidate->>'subject') then raise exception 'curriculum_scope_mismatch';end if;
 select blueprint_id into result from gina.catalog_blueprint_links where family_id=f and child_id=ch.id and catalogue_id=c.id and revision=c.revision;
 if not found then
  -- Short topic keys map to complete learning outcomes in the private snapshot. No output text is truncated.
  select jsonb_agg(jsonb_build_object('topic','Blok '||ordinality,'count',value->'count') order by ordinality) into rows from jsonb_array_elements(c.candidate->'blocks') with ordinality;
  snapshot:=jsonb_build_object('origin','reviewed_catalogue','catalogue_id',c.id,'revision',c.revision,'content_hash',c.content_hash,'candidate',c.candidate,'programme',c.review->'programme','school_scope',c.review->'school_scope','programme_url',c.review->'programme_url','school_confirmed',true,'officially_verified',false);
  insert into public.exam_blueprints(family_id,grade,subject,name,rows,source_url,created_by,source_context)
  values(f,ch.grade,subject,c.candidate->>'label',rows,c.candidate->>'source_url',actor,jsonb_build_object('origin','reviewed_catalogue','child_id',ch.id,'catalogue_id',c.id,'revision',c.revision,'academic_year',c.candidate->'academic_year','term',c.candidate->'term','exam',c.candidate->'exam','school_confirmed',true,'officially_verified',false)) returning id into result;
  insert into gina.catalog_blueprint_links values(result,f,ch.id,c.id,c.revision,snapshot);
 end if;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,actor,'catalog_blueprint',p_input,to_jsonb(result));
 return result;
end;$$;

create function gina.protect_catalog_blueprint() returns trigger language plpgsql security definer set search_path='' as $$begin
 if row(new.id,new.family_id,new.grade,new.subject,new.name,new.rows,new.source_url,new.source_context) is distinct from row(old.id,old.family_id,old.grade,old.subject,old.name,old.rows,old.source_url,old.source_context) and exists(select 1 from gina.catalog_blueprint_links where blueprint_id=old.id) then raise exception 'curriculum_copy_immutable';end if;
 return new;
end;$$;
create trigger protect_catalog_blueprint before update on public.exam_blueprints for each row execute function gina.protect_catalog_blueprint();
revoke all on function gina.protect_catalog_blueprint() from public,anon,authenticated,service_role;

-- Only this server-owned binding establishes reviewed provenance; editable JSON cannot impersonate it.
create function public.get_catalog_blueprint_context(p_family_id uuid,p_blueprint_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 return (select snapshot from gina.catalog_blueprint_links where blueprint_id=p_blueprint_id and family_id=p_family_id);
end;$$;

create function public.reserve_catalog_prova_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_blueprint_id uuid,p_draft_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link gina.catalog_blueprint_links;bound gina.catalog_generation_links;j public.prova_generation_jobs;c gina.curriculum_candidates;d public.prova_drafts;ch public.children;bp public.exam_blueprints;result jsonb;plan public.plans;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_draft_id is null or p_blueprint_id is null then raise exception 'curriculum_scope_mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  select * into bound from gina.catalog_generation_links where job_id=p_id;
  if not found or bound.blueprint_id<>p_blueprint_id or bound.draft_id<>p_draft_id then return jsonb_build_object('error','request_conflict');end if;
  -- A withdrawal prevents new provider work, not retrieval/finishing of an already paid result.
  if j.status<>'failed' then return public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 end if;
 select * into link from gina.catalog_blueprint_links where blueprint_id=p_blueprint_id and family_id=p_family_id for share;
 if not found or link.child_id is null then raise exception 'curriculum_scope_mismatch';end if;
 select * into d from public.prova_drafts where id=p_draft_id and family_id=p_family_id for share;
 if not found or d.submitted_at is not null or d.content->>'childId' is distinct from link.child_id::text or d.content->>'purpose' is distinct from 'written' then raise exception 'curriculum_scope_mismatch';end if;
 select * into ch from public.children where id=link.child_id and family_id=p_family_id for share;
 select * into bp from public.exam_blueprints where id=p_blueprint_id and family_id=p_family_id for share;
 if ch.id is null or bp.id is null or ch.grade is distinct from bp.grade or (d.content->>'grade')::int is distinct from bp.grade or not exists(select 1 from jsonb_array_elements_text(d.content->'subjects') s where gina.curriculum_subject(s.value)=gina.curriculum_subject(bp.subject)) or p_items is distinct from (link.snapshot->'candidate'->>'question_count')::int then raise exception 'curriculum_scope_mismatch';end if;
 select * into c from gina.curriculum_candidates where id=link.catalogue_id for share;
 if c.status<>'published' or c.revision<>link.revision or not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then return jsonb_build_object('error','curriculum_unavailable');end if;
 plan:=gina.family_plan_of(p_family_id);
 if not plan.prova_scenarios then return jsonb_build_object('error','plan_limit_prova_scenarios');end if;
 result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);
 if result->>'ok'='true' then insert into gina.catalog_generation_links values(p_id,p_blueprint_id,p_draft_id) on conflict(job_id) do nothing;end if;
 return result;
end;$$;
revoke all on function public.save_catalog_blueprint(uuid,jsonb) from public,anon,service_role;
grant execute on function public.save_catalog_blueprint(uuid,jsonb) to authenticated;
revoke all on function public.get_catalog_blueprint_context(uuid,uuid),public.reserve_catalog_prova_generation(uuid,uuid,uuid,text,int,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_catalog_blueprint_context(uuid,uuid),public.reserve_catalog_prova_generation(uuid,uuid,uuid,text,int,uuid,uuid) to service_role;
