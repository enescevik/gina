-- Family-owned copies and a common question allowance with the legacy catalogue.
-- No publication flag is opened by this migration.
create table gina.library_acquisitions (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 package_id uuid not null references gina.library_import_packages(id), unit_key text not null,
 block jsonb not null, question_count int not null check(question_count between 1 and 12),
 created_at timestamptz not null default now(),unique(family_id,package_id,unit_key)
);
create table gina.library_acquisition_charges (
 acquisition_id uuid not null references gina.library_acquisitions(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) deferrable initially deferred,
 credit_grant_id uuid references public.learning_credit_grants(id) deferrable initially deferred,
 created_at timestamptz not null default now(),primary key(acquisition_id,question_id)
);
create table gina.library_source_copies (
 source_id uuid primary key references public.learning_sources(id) on delete cascade,
 asset_hash text not null references gina.library_delivery_assets(source_hash)
);
do $$declare t text;begin
 foreach t in array array['library_acquisitions','library_acquisition_charges','library_source_copies'] loop
 execute format('alter table gina.%I enable row level security',t);
 execute format('revoke all on gina.%I from public,anon,authenticated,service_role',t);
 end loop;
end;$$;
create function gina.library_month_used(f uuid) returns int language sql stable set search_path='' as $$
 select ((select count(*) from public.library_redemptions where family_id=f and credit_grant_id is null and created_at>=gina.family_month_start(f))+
 (select count(*) from gina.library_acquisition_charges where family_id=f and credit_grant_id is null and created_at>=gina.family_month_start(f)))::int;
$$;
create function gina.library_grant_used(g uuid) returns int language sql stable set search_path='' as $$
 select ((select count(*) from public.library_redemptions where credit_grant_id=g)+
 (select count(*) from gina.library_acquisition_charges where credit_grant_id=g))::int;
$$;
revoke all on function gina.library_month_used(uuid),gina.library_grant_used(uuid) from public,anon,authenticated,service_role;

-- A single immutable unit is either one independent question or all members of
-- one common source. No paid answer, private provenance or PNG is in this list.
create function public.get_library_package_units(p_package_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();r gina.library_publications;c jsonb;begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true') then raise exception 'library_unavailable';end if;
 select * into r from gina.library_publications where package_id=p_package_id and status='published';
 c:=gina.library_publication_checks(p_package_id);
 if r.package_id is null or r.review_fingerprint is distinct from c->>'review_fingerprint' or c->>'suitable_count'<>c->>'question_count' or (c->>'missing_media')::int<>0 then raise exception 'library_unavailable';end if;
 if not coalesce((gina.family_plan_of(f)).code=any(r.plans),false) then raise exception 'library_plan_required';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('key',u.key,'title',u.title,'count',u.n,'owned',a.block is not null,'block',a.block) order by u.pos),'[]') from (
 select case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end key,
 coalesce(s.title,min(q.student->>'topic')) title,count(*) n,min(q.position) pos
 from gina.library_import_questions q left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
 where q.package_id=p_package_id group by 1,s.title
 )u left join gina.library_acquisitions a on a.family_id=f and a.package_id=p_package_id and a.unit_key=u.key);
end;$$;
revoke all on function public.get_library_package_units(uuid) from public,anon,service_role;
grant execute on function public.get_library_package_units(uuid) to authenticated;

-- Only the service may fetch bytes, after the existing caller access check.
-- Copy references use an internal namespace, never a user-controlled fetch URL.
create function public.read_library_source_bytes(p_source_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object('base64',encode(a.png,'base64'),'bytes',octet_length(a.png),'sha256',a.sha256) into result
 from gina.library_source_copies c join public.learning_sources s on s.id=c.source_id
 join gina.library_delivery_assets a on a.source_hash=c.asset_hash
 where c.source_id=p_source_id and s.status='ready' and s.sha256=a.sha256;
 if result is null then raise exception 'source_not_ready';end if;return result;
end;$$;
revoke all on function public.read_library_source_bytes(uuid) from public,anon,authenticated;
grant execute on function public.read_library_source_bytes(uuid) to service_role;

create function public.acquire_library_units(p_request_id uuid,p_package_id uuid,p_publication_version int,p_unit_keys text[],p_draft_id uuid default null)
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
   insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
   values(qid,f,p.grade,p.subject,q.student->>'topic',(q.student->>'kind')::public.question_kind,(q.student->>'difficulty')::public.question_difficulty,
    case when src.source_key is null then q.student->>'stem' else src.title||E'\n'||src.body||E'\n\n'||(q.student->>'stem') end,
    q.student->'choices',teacher->>'correct_key',teacher->>'expected_answer',teacher->>'solution',teacher->>'explanation',
    jsonb_build_object('generator','gina-library','item_id',p.id::text||':'||q.question_key,'package_id',p.id,'question_key',q.question_key,'curriculum_version',r.curriculum_label,'rubric',teacher->'rubric','common_misconception',teacher->'common_misconception','next_step',teacher->'next_step'),actor);
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
revoke all on function public.acquire_library_units(uuid,uuid,int,text[],uuid) from public,anon,service_role;
grant execute on function public.acquire_library_units(uuid,uuid,int,text[],uuid) to authenticated;

-- Legacy catalogue and package catalogue draw from the same allowance.
create or replace function public.get_learning_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); p public.plans; used int; credits int;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 p:=gina.family_plan_of(f);
 used:=gina.library_month_used(f);
 select coalesce(sum(greatest(0,g.amount-gina.library_grant_used(g.id))),0)::int into credits
 from public.learning_credit_grants g where g.family_id=f and kind='library' and starts_at<=now() and ends_at>now();
 return jsonb_build_object('limit',p.library_monthly,'remaining',greatest(0,p.library_monthly-used),'bonus',credits,
 'contributions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') from(select id,status,review_note,created_at,content->>'topic' topic from public.question_contributions where family_id=f order by created_at desc limit 50)s),
 'grants',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'amount',amount,'ends_at',ends_at) order by ends_at),'[]') from public.learning_credit_grants where family_id=f and starts_at<=now() and ends_at>now()),
 'rewards',(select coalesce(jsonb_agg(jsonb_build_object('title',title,'threshold',threshold,'kind',kind,'amount',amount,'valid_days',valid_days)),'[]') from public.contribution_rewards where enabled),
 'collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from(
  select c.id,c.title,c.description,c.grade,c.subject,c.curriculum_version,(p.code=any(c.plans)) accessible,
  (select count(*) from public.library_items i where i.collection_id=c.id and i.status='published') item_count
  from public.library_collections c where c.status='published' order by c.grade,c.title)c));
end; $$;

-- Legacy catalogue and package catalogue draw from the same allowance.
create or replace function public.redeem_library_item(p_item_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); p public.plans; i public.library_items; c public.library_collections; q uuid; v public.question_bank; used int; bonus uuid;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,32));
 select question_id into q from public.library_redemptions where family_id=f and item_id=p_item_id;
 if found then return q; end if;
 p:=gina.family_plan_of(f);
 select * into i from public.library_items where id=p_item_id and status='published';
 select * into c from public.library_collections where id=i.collection_id and status='published';
 if i.id is null or c.id is null or not(p.code=any(c.plans)) then raise exception 'library_plan_required'; end if;
 used:=gina.library_month_used(f);
 if used>=p.library_monthly then
  select g.id into bonus from public.learning_credit_grants g where family_id=f and kind='library' and starts_at<=now() and ends_at>now()
  and g.amount>gina.library_grant_used(g.id) order by ends_at,id limit 1 for update;
  if bonus is null then raise exception 'library_quota_exceeded'; end if;
 end if;
 v:=jsonb_populate_record(null::public.question_bank,i.content);
 insert into public.question_bank(family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
 values(f,v.grade,v.subject,v.topic,v.kind,v.difficulty,v.stem,v.choices,v.correct_key,v.expected_answer,v.solution,v.explanation,jsonb_build_object('generator','gina-library','item_id',i.id,'curriculum_version',c.curriculum_version),auth.uid()) returning id into q;
 insert into public.library_redemptions(family_id,item_id,question_id,credit_grant_id) values(f,i.id,q,bonus);
 return q;
end; $$;

-- Acquired material is a stable copy. Family/account deletion still cascades.
create function gina.guard_library_copy() returns trigger language plpgsql security definer set search_path='' as $$
declare f uuid;locked boolean:=false;begin
 if tg_table_name='question_bank' then
  f:=old.family_id;
  locked:=exists(select 1 from gina.library_acquisition_charges where question_id=old.id);
  if tg_op='UPDATE' and (to_jsonb(new)-array['times_asked','updated_at','created_by'])=(to_jsonb(old)-array['times_asked','updated_at','created_by']) then return new;end if;
 elsif tg_table_name='learning_sources' then
  f:=old.family_id;locked:=exists(select 1 from gina.library_source_copies where source_id=old.id);
  if tg_op='UPDATE' and (to_jsonb(new)-'uploaded_by')=(to_jsonb(old)-'uploaded_by') then return new;end if;
 else
  select family_id into f from public.question_bank where id=case when tg_op='INSERT' then new.question_id else old.question_id end;
  locked:=exists(select 1 from gina.library_acquisition_charges where question_id=case when tg_op='INSERT' then new.question_id else old.question_id end);
 end if;
 if locked and exists(select 1 from public.families where id=f) then raise exception 'library_copy_immutable';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function gina.guard_library_copy() from public,anon,authenticated,service_role;
create trigger library_copy_guard before update or delete on public.question_bank for each row execute function gina.guard_library_copy();
create trigger library_copy_guard before update or delete on public.learning_sources for each row execute function gina.guard_library_copy();
create trigger library_copy_guard before insert or update or delete on public.learning_source_links for each row execute function gina.guard_library_copy();

-- Canonical library media lives in the database; it has no Storage object to delete.
create or replace function gina.queue_source_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if left(old.object_path,8)<>'library/' then
  insert into public.source_deletion_queue(object_path) values(old.object_path) on conflict do nothing;
 end if;
 return old;
end;$$;
