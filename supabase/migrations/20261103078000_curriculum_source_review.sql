-- Source review is separate from publication and from a school's scenario choice.
insert into public.app_settings(key,value) values('curriculum_catalog.enabled','false') on conflict do nothing;
create table gina.curriculum_candidates (
 id uuid primary key default gen_random_uuid(), external_key text not null, source_sha256 text not null,
 candidate jsonb not null, content_hash text not null, status text not null default 'draft' check(status in('draft','reviewed','published','withdrawn')),
 revision int not null default 0, review jsonb, reviewed_by uuid, reviewed_at timestamptz,
 created_by uuid not null, created_at timestamptz not null default now(), unique(external_key,source_sha256)
);
create table gina.curriculum_commands(request_id uuid primary key,actor_id uuid not null,payload_hash text not null,result jsonb not null);
alter table gina.curriculum_candidates enable row level security;
alter table gina.curriculum_commands enable row level security;
revoke all on gina.curriculum_candidates,gina.curriculum_commands from public,anon,authenticated,service_role;

create function gina.curriculum_url(p jsonb) returns text language plpgsql immutable set search_path='' as $$
declare v text:=gina.import_text(p,1,2000);begin
 if v !~ '^https://([a-zA-Z0-9-]+\.)*(meb|eba)\.gov\.tr(/[^[:space:]]*)?$' then raise exception 'curriculum_source_invalid';end if;
 return v;
end;$$;
create function gina.validate_curriculum_candidate(p jsonb) returns void language plpgsql immutable set search_path='' as $$
declare b jsonb;o jsonb;r jsonb;n int:=0;y text;begin
 perform gina.import_keys(p,array['key','academic_year','term','exam','grade','subject','label','source_url','source_sha256','sheet','header_cell','question_count','blocks','review_reasons']);
 if gina.import_text(p->'key',1,100) !~ '^[a-zA-Z0-9_-]+$' or gina.import_text(p->'source_sha256',64,64) !~ '^[a-f0-9]{64}$'
 or gina.import_text(p->'header_cell',2,30) !~ '^[A-Z]+[1-9][0-9]*$' then raise exception 'curriculum_invalid';end if;
 y:=gina.import_text(p->'academic_year',9,9);
 if y !~ '^20[0-9]{2}-20[0-9]{2}$' then raise exception 'curriculum_invalid';end if;
 if right(y,4)::int<>left(y,4)::int+1 then raise exception 'curriculum_invalid';end if;
 perform gina.import_int(p->'term',1,2);perform gina.import_int(p->'exam',1,2);perform gina.import_int(p->'grade',5,12);
 perform gina.import_text(p->'subject',1,80);perform gina.import_text(p->'label',1,100);perform gina.import_text(p->'sheet',1,160);
 perform gina.curriculum_url(p->'source_url');
 if jsonb_typeof(p->'blocks') is distinct from 'array' or jsonb_typeof(p->'review_reasons') is distinct from 'array' then raise exception 'curriculum_invalid';end if;
 if jsonb_array_length(p->'blocks') not between 1 and 30 or jsonb_array_length(p->'review_reasons') not between 1 and 50 then raise exception 'curriculum_invalid';end if;
 for r in select value from jsonb_array_elements(p->'review_reasons') loop perform gina.import_text(r,1,500);end loop;
 for b in select value from jsonb_array_elements(p->'blocks') loop
  perform gina.import_keys(b,array['count','count_cell','outcomes']);
  n:=n+gina.import_int(b->'count',1,30);
  if gina.import_text(b->'count_cell',2,30) !~ '^[A-Z]+[1-9][0-9]*$' or jsonb_typeof(b->'outcomes') is distinct from 'array' then raise exception 'curriculum_invalid';end if;
  if jsonb_array_length(b->'outcomes') not between 1 and 20 then raise exception 'curriculum_invalid';end if;
  for o in select value from jsonb_array_elements(b->'outcomes') loop
   perform gina.import_keys(o,array['cell','text','code']);
   if gina.import_text(o->'cell',2,30) !~ '^[A-Z]+[1-9][0-9]*$' then raise exception 'curriculum_invalid';end if;
   perform gina.import_text(o->'text',1,2000);
   if o->'code' is distinct from 'null'::jsonb then perform gina.import_text(o->'code',1,100);end if;
  end loop;
 end loop;
 if n<>gina.import_int(p->'question_count',1,30) then raise exception 'curriculum_count_mismatch';end if;
end;$$;
revoke all on function gina.curriculum_url(jsonb),gina.validate_curriculum_candidate(jsonb) from public,anon,authenticated,service_role;

create function public.admin_import_curriculum_candidates(p_request_id uuid,p_bundle jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text;r gina.curriculum_commands;c jsonb;existing gina.curriculum_candidates;ch text;added int:=0;total int;result jsonb;begin
 perform gina.assert_admin();
 if p_request_id is null or octet_length(p_bundle::text)>5000000 then raise exception 'curriculum_invalid';end if;
 perform gina.import_keys(p_bundle,array['schema','candidates']);
 if p_bundle->>'schema' is distinct from 'gina.curriculum-review.v1' or jsonb_typeof(p_bundle->'candidates') is distinct from 'array' then raise exception 'curriculum_invalid';end if;
 total:=jsonb_array_length(p_bundle->'candidates');
 if total not between 1 and 1000 then raise exception 'curriculum_invalid';end if;
 h:=encode(extensions.digest(p_bundle::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(73491822);
 select * into r from gina.curriculum_commands where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.payload_hash<>h then raise exception 'request_conflict';end if;return r.result;
 end if;
 if (select count(distinct jsonb_build_array(value->'key',value->'source_sha256')) from jsonb_array_elements(p_bundle->'candidates'))<>total then raise exception 'curriculum_duplicate';end if;
 for c in select value from jsonb_array_elements(p_bundle->'candidates') loop
  perform gina.validate_curriculum_candidate(c);
  ch:=encode(extensions.digest(c::text,'sha256'),'hex');
  select * into existing from gina.curriculum_candidates where external_key=c->>'key' and source_sha256=c->>'source_sha256';
  if found then
   if existing.content_hash<>ch then raise exception 'curriculum_source_changed';end if;
  else
   insert into gina.curriculum_candidates(external_key,source_sha256,candidate,content_hash,created_by) values(c->>'key',c->>'source_sha256',c,ch,auth.uid());
   added:=added+1;
  end if;
 end loop;
 result:=jsonb_build_object('request',p_request_id,'action','import','created',added,'existing',total-added,'total',total);
 insert into gina.curriculum_commands values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.imported','gina.curriculum_candidates',p_request_id::text,'Source-review candidates only: '||added);
 return result;
end;$$;

create function gina.curriculum_projection(c gina.curriculum_candidates) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',c.id,'key',c.external_key,'academic_year',c.candidate->'academic_year','term',c.candidate->'term','exam',c.candidate->'exam','grade',c.candidate->'grade','subject',c.candidate->'subject','label',c.candidate->'label','question_count',c.candidate->'question_count','status',c.status,'revision',c.revision,'content_hash',c.content_hash,'review_reasons',c.candidate->'review_reasons')
$$;
revoke all on function gina.curriculum_projection(gina.curriculum_candidates) from public,anon,authenticated,service_role;
create function public.admin_list_curriculum_candidates() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(gina.curriculum_projection(c) order by c.created_at,c.external_key),'[]') from gina.curriculum_candidates c);
end;$$;
create function public.admin_get_curriculum_candidate(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c gina.curriculum_candidates;begin
 perform gina.assert_admin();select * into c from gina.curriculum_candidates where id=p_id;
 if not found then raise exception 'curriculum_not_found';end if;
 return gina.curriculum_projection(c)||jsonb_build_object('candidate',c.candidate,'review',c.review,'reviewed_at',c.reviewed_at);
end;$$;

create function public.admin_change_curriculum_candidate(p_request_id uuid,p_id uuid,p_revision int,p_action text,p_review jsonb,p_note text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.curriculum_candidates;r gina.curriculum_commands;h text;result jsonb;begin
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
  update gina.curriculum_candidates set status='published',revision=revision+1 where id=p_id returning * into c;
 else
  if c.status<>'published' then raise exception 'curriculum_not_published';end if;
  update gina.curriculum_candidates set status='withdrawn',revision=revision+1 where id=p_id returning * into c;
 end if;
 result:=jsonb_build_object('request',p_request_id,'action',p_action,'id',c.id,'revision',c.revision,'status',c.status);
 insert into gina.curriculum_commands values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'curriculum.'||p_action,'gina.curriculum_candidates',c.id::text,trim(p_note));
 return result;
end;$$;

-- Read-only catalogue. Does not choose a scenario or create/alter a family's exam.
create function public.get_curriculum_scenarios(p_child_id uuid,p_year text,p_term int,p_exam int,p_subject text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare grade int;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select ch.grade into grade from public.children ch where ch.id=p_child_id and ch.family_id=gina.family_id();
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then return '[]';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'revision',c.revision,'content_hash',c.content_hash,'candidate',c.candidate,'programme',c.review->'programme','school_scope',c.review->'school_scope','programme_url',c.review->'programme_url') order by c.external_key),'[]')
 from gina.curriculum_candidates c where c.status='published' and (c.candidate->>'grade')::int=grade and c.candidate->>'academic_year'=p_year and (c.candidate->>'term')::int=p_term and (c.candidate->>'exam')::int=p_exam and c.candidate->>'subject'=p_subject);
end;$$;
revoke all on function public.admin_import_curriculum_candidates(uuid,jsonb),public.admin_list_curriculum_candidates(),public.admin_get_curriculum_candidate(uuid),public.admin_change_curriculum_candidate(uuid,uuid,int,text,jsonb,text,boolean),public.get_curriculum_scenarios(uuid,text,int,int,text) from public,anon,service_role;
grant execute on function public.admin_import_curriculum_candidates(uuid,jsonb),public.admin_list_curriculum_candidates(),public.admin_get_curriculum_candidate(uuid),public.admin_change_curriculum_candidate(uuid,uuid,int,text,jsonb,text,boolean),public.get_curriculum_scenarios(uuid,text,int,int,text) to authenticated;
