-- Immutable source packages stay private. A release is a separately versioned
-- publication decision; editing/reviewing never silently publishes a package.
insert into public.app_settings(key,value) values('library_packages.enabled','false') on conflict do nothing;
create table gina.library_delivery_assets (
 source_hash text primary key references gina.library_import_assets(sha256),
 png bytea not null, sha256 text not null, width int not null,height int not null,
 validator text not null check(validator='png-rgb-v1'),created_at timestamptz not null default now()
);
create table gina.library_publications (
 package_id uuid primary key references gina.library_import_packages(id),version int not null check(version>0),
 title text not null,description text not null,plans public.plan_code[] not null,
 curriculum_label text not null,review_fingerprint text not null,
 status text not null check(status in('published','archived')),
 actor_id uuid not null,updated_at timestamptz not null default now()
);
create table gina.library_publication_requests (
 request_id uuid primary key,actor_id uuid not null,payload_hash text not null,result jsonb not null
);
do $$declare t text;begin
 foreach t in array array['library_delivery_assets','library_publications','library_publication_requests'] loop
 execute format('alter table gina.%I enable row level security',t);
 execute format('revoke all on gina.%I from public,anon,authenticated,service_role',t);
 end loop;
end;$$;
create trigger immutable before update or delete on gina.library_delivery_assets for each row execute function gina.guard_library_import();
create trigger immutable before update or delete on gina.library_publication_requests for each row execute function gina.guard_library_import();

create function gina.library_review_fingerprint(p_id uuid) returns text language sql stable set search_path='' as $$
 select encode(extensions.digest(jsonb_build_array(p.content_hash,
 (select coalesce(jsonb_agg(jsonb_build_array(q.question_key,r.request_id) order by q.question_key),'[]')
 from gina.library_import_questions q left join lateral
 (select request_id from gina.library_editorial_reviews where package_id=q.package_id and question_key=q.question_key order by review_revision desc limit 1)r on true
 where q.package_id=p.id))::text,'sha256'),'hex') from gina.library_import_packages p where p.id=p_id;
$$;
create function gina.library_publication_checks(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('question_count',count(*),'suitable_count',count(*) filter(where r.outcome='suitable'),
 'source_count',(select count(*) from gina.library_import_sources where package_id=p_id),
 'missing_media',(select count(*) from gina.library_import_sources s left join gina.library_delivery_assets a on a.source_hash=s.asset_hash where s.package_id=p_id and s.asset_hash is not null and a.source_hash is null),
 'review_fingerprint',gina.library_review_fingerprint(p_id))
 from gina.library_import_questions q left join lateral
 (select outcome from gina.library_editorial_reviews where package_id=q.package_id and question_key=q.question_key order by review_revision desc limit 1)r on true where q.package_id=p_id;
$$;
revoke all on function gina.library_review_fingerprint(uuid),gina.library_publication_checks(uuid) from public,anon,authenticated,service_role;

create function public.admin_library_publication(p_package_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p gina.library_import_packages;r gina.library_publications;c jsonb;begin
 perform gina.assert_admin();
 select * into p from gina.library_import_packages where id=p_package_id;
 if not found then raise exception 'library_review_not_found';end if;
 c:=gina.library_publication_checks(p.id);
 select * into r from gina.library_publications where package_id=p.id;
 return jsonb_build_object('package_id',p.id,'title',p.title,'grade',p.grade,'subject',p.subject,'revision',p.revision,
 'checks',c,'publication',case when r.package_id is null then null else to_jsonb(r)-'actor_id' end,
 'review_current',r.review_fingerprint is not distinct from c->>'review_fingerprint',
 'delivery_enabled',exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true'::jsonb));
end;$$;

-- Edge-only media preparation. JWT auth and live admin are also checked in Edge.
create function public.prepare_library_delivery_media(p_actor uuid,p_package_id uuid,p_assets jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a jsonb;src gina.library_import_assets;bytes bytea;dims int[];begin
 if not gina.is_service() or not exists(select 1 from public.admins where user_id=p_actor) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_assets) is distinct from 'array' or jsonb_array_length(p_assets)>100 or octet_length(p_assets::text)>6000000 then raise exception 'library_media_invalid';end if;
 if not exists(select 1 from gina.library_import_packages where id=p_package_id) then raise exception 'library_review_not_found';end if;
 for a in select value from jsonb_array_elements(p_assets) loop
  perform gina.import_keys(a,array['source_hash','base64']);
  select ia.* into src from gina.library_import_assets ia where ia.sha256=a->>'source_hash'
   and exists(select 1 from gina.library_import_sources s where s.package_id=p_package_id and s.asset_hash=ia.sha256);
  if not found then raise exception 'library_media_invalid';end if;
  bytes:=decode(a->>'base64','base64');dims:=gina.import_png(bytes);
  if dims<>array[src.width,src.height] then raise exception 'library_media_invalid';end if;
  insert into gina.library_delivery_assets(source_hash,png,sha256,width,height,validator)
  values(src.sha256,bytes,encode(extensions.digest(bytes,'sha256'),'hex'),src.width,src.height,'png-rgb-v1') on conflict do nothing;
 end loop;
end;$$;
revoke all on function public.prepare_library_delivery_media(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_library_delivery_media(uuid,uuid,jsonb) to service_role;

create function public.admin_set_library_publication(p_request_id uuid,p_package_id uuid,p_expected_version int,p_review_fingerprint text,p_title text,p_description text,p_plans public.plan_code[],p_curriculum_label text,p_confirmed boolean,p_status text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();h text;old gina.library_publication_requests;r gina.library_publications;c jsonb;k text;result jsonb;begin
 perform gina.assert_admin();
 if actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_package_id is null or p_expected_version is null or p_expected_version<0 or p_status is null or p_status not in('published','archived')
 or p_title is null or length(trim(p_title)) not between 3 and 160 or p_description is null or length(p_description)>1000
 or p_curriculum_label is null or length(trim(p_curriculum_label)) not between 3 and 200
 or p_plans is null or cardinality(p_plans) not between 1 and 3 or array_position(p_plans,null) is not null
 or cardinality(p_plans)<>(select count(distinct v) from unnest(p_plans)v)
 or p_confirmed is not true or p_reason is null or length(p_reason)>1000
 or (p_status='archived' and length(trim(p_reason))<3) then raise exception 'library_publication_input';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_package_id,p_expected_version,p_review_fingerprint,p_title,p_description,p_plans,p_curriculum_label,p_confirmed,p_status,p_reason)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,88));
 select * into old from gina.library_publication_requests where request_id=p_request_id;
 if found then
  if old.actor_id<>actor or old.payload_hash<>h then raise exception 'library_publication_request_conflict';end if;
  return old.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_package_id::text,89));
 if not exists(select 1 from gina.library_import_packages where id=p_package_id) then raise exception 'library_review_not_found';end if;
 select * into r from gina.library_publications where package_id=p_package_id for update;
 if coalesce(r.version,0)<>p_expected_version then raise exception 'library_publication_changed';end if;
 -- Serialize with per-question reviews, including first reviews with no row yet.
 for k in select question_key from gina.library_import_questions where package_id=p_package_id order by question_key loop
  perform pg_advisory_xact_lock(hashtextextended(p_package_id::text||':'||k,87));
 end loop;
 c:=gina.library_publication_checks(p_package_id);
 if p_status='published' then
  if p_review_fingerprint is distinct from c->>'review_fingerprint' then raise exception 'library_publication_review_changed';end if;
  if (c->>'question_count')::int=0 or (c->>'suitable_count')::int<>(c->>'question_count')::int then raise exception 'library_publication_review_required';end if;
  if (c->>'missing_media')::int>0 then raise exception 'library_publication_media_required';end if;
 elsif r.package_id is null then raise exception 'library_publication_not_found';end if;
 insert into gina.library_publications(package_id,version,title,description,plans,curriculum_label,review_fingerprint,status,actor_id)
 values(p_package_id,coalesce(r.version,0)+1,trim(p_title),trim(p_description),p_plans,trim(p_curriculum_label),c->>'review_fingerprint',p_status,actor)
 on conflict(package_id) do update set version=excluded.version,title=excluded.title,description=excluded.description,plans=excluded.plans,curriculum_label=excluded.curriculum_label,review_fingerprint=excluded.review_fingerprint,status=excluded.status,actor_id=excluded.actor_id,updated_at=now() returning * into r;
 result:=to_jsonb(r)-'actor_id';
 insert into gina.library_publication_requests values(p_request_id,actor,h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details)
 values(actor,'library_package.'||p_status,'gina.library_publications',p_package_id::text,trim(p_reason),jsonb_build_object('version',r.version,'review_fingerprint',r.review_fingerprint,'plans',p_plans));
 return result;
end;$$;
revoke all on function public.admin_library_publication(uuid),public.admin_set_library_publication(uuid,uuid,int,text,text,text,public.plan_code[],text,boolean,text,text) from public,anon,service_role;
grant execute on function public.admin_library_publication(uuid),public.admin_set_library_publication(uuid,uuid,int,text,text,text,public.plan_code[],text,boolean,text,text) to authenticated;

-- Safe catalogue projection for the next family-selection step. No raw source,
-- answer, editorial note or private metadata is included. Gate defaults off.
create function public.get_published_library_packages(p_grade int,p_subject text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare plan public.plan_code;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_grade is null or p_grade not between 1 and 12 or p_subject is null or length(trim(p_subject)) not between 1 and 80 then raise exception 'invalid_input';end if;
 if not exists(select 1 from public.app_settings where key='library_packages.enabled' and value='true'::jsonb) then return '[]'::jsonb;end if;
 plan:=(gina.family_plan_of(gina.family_id())).code;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',r.package_id,'version',r.version,'title',r.title,'description',r.description,'grade',p.grade,'subject',p.subject,'curriculum_label',r.curriculum_label,'accessible',plan=any(r.plans),'question_count',c->'question_count','source_count',c->'source_count') order by r.updated_at desc),'[]')
 from gina.library_publications r join gina.library_import_packages p on p.id=r.package_id cross join lateral gina.library_publication_checks(p.id)c
 where r.status='published' and p.grade=p_grade and p.subject=p_subject
 and r.review_fingerprint=c->>'review_fingerprint' and c->>'question_count'=c->>'suitable_count' and (c->>'missing_media')::int=0);
end;$$;
revoke all on function public.get_published_library_packages(int,text) from public,anon,service_role;
grant execute on function public.get_published_library_packages(int,text) to authenticated;
