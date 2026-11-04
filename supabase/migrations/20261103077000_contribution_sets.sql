-- An explicit, immutable sharing copy. Family originals and student answers are
-- never used as public catalogue assets. Acceptance creates a draft, not a release.
insert into public.app_settings(key,value) values('contribution_sets.enabled','false') on conflict do nothing;
create table gina.contribution_sets (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, question_id uuid,
 snapshot jsonb not null, fingerprint text not null,
 status text not null check(status in('preparing','pending','approved','rejected','withdrawn')),
 media jsonb, consent_version text not null, created_at timestamptz not null default now(),
 package_id uuid references gina.library_import_packages(id), reviewed_by uuid,
 review_note text, reviewed_at timestamptz
);
create unique index contribution_active_copy on gina.contribution_sets(family_id,fingerprint) where status<>'withdrawn';
create table gina.contribution_question_credits (
 fingerprint text primary key, contribution_id uuid references gina.contribution_sets(id) on delete set null,
 family_id uuid references public.families(id) on delete set null, created_at timestamptz not null default now()
);
create table gina.contribution_commands (
 request_id uuid primary key,actor_id uuid not null,payload_hash text not null,result jsonb not null
);
do $$declare tab text;begin
 foreach tab in array array['contribution_sets','contribution_question_credits','contribution_commands'] loop
 execute format('alter table gina.%I enable row level security',tab);
 execute format('revoke all on gina.%I from public,anon,authenticated,service_role',tab);
 end loop;
end;$$;

create function gina.contribution_snapshot(p_question_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();q public.question_bank;g public.question_source_groups;
 ids uuid[];questions jsonb:='[]';images jsonb;row record;n int:=0;result jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into q from public.question_bank where id=p_question_id and family_id=f for share;
 if not found then raise exception 'question_not_found';end if;
 -- Redeemed/assigned catalogue content is not an original family contribution.
 if exists(select 1 from public.library_redemptions where question_id=q.id)
 or exists(select 1 from gina.library_acquisition_charges where question_id=q.id)
 or exists(select 1 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id where l.question_id=q.id and s.object_path like 'library/%')
 then raise exception 'contribution_not_original';end if;
 select src.* into g from public.question_source_groups src join public.question_source_members m on m.group_id=src.id where m.question_id=q.id;
 if found then
  if g.family_id<>f or g.finalized_at is null then raise exception 'question_group_incomplete';end if;
  select array_agg(question_id order by position) into ids from public.question_source_members where group_id=g.id;
 else ids:=array[q.id];end if;
 for row in select bank.*,m.prompt from unnest(ids) with ordinality chosen(id,position)
 join public.question_bank bank on bank.id=chosen.id left join public.question_source_members m on m.question_id=bank.id order by chosen.position loop
  if row.family_id<>f or row.grade<>q.grade or row.subject<>q.subject then raise exception 'contribution_scope';end if;
  if length(coalesce(row.prompt,row.stem))>3500 then raise exception 'contribution_size';end if;
  n:=n+1;
  questions:=questions||jsonb_build_array((gina.library_question(to_jsonb(row))||jsonb_build_object('stem',coalesce(row.prompt,row.stem),'key','q'||n)));
 end loop;
 if n not between 1 and 12 then raise exception 'contribution_size';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sha256',s.sha256,'mime',s.mime,'bytes',s.bytes,'width',s.width,'height',s.height,'alt',l.alt) order by l.created_at,l.id),'[]') into images
 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id where l.question_id=ids[1] and s.kind='question_image' and s.status='ready' and s.family_id=f;
 if jsonb_array_length(images)>3 or (select count(*) from public.learning_source_links where question_id=ids[1])<>jsonb_array_length(images) then raise exception 'source_not_ready';end if;
 -- Shared groups must really have the same images/alt text, not just the same title.
 if exists(select 1 from unnest(ids) chosen(question) where
  (select coalesce(jsonb_agg(jsonb_build_array(source_id,alt) order by source_id),'[]') from public.learning_source_links where question_id=chosen.question)
  is distinct from (select coalesce(jsonb_agg(jsonb_build_array(source_id,alt) order by source_id),'[]') from public.learning_source_links where question_id=ids[1])) then raise exception 'contribution_scope';end if;
 result:=jsonb_build_object('title',case when length(coalesce(g.title,q.topic))<3 then 'Soru: '||coalesce(g.title,q.topic) else coalesce(g.title,q.topic) end,'body',coalesce(g.body,''),'grade',q.grade,'subject',q.subject,'questions',questions,'images',images,'grouped',g.id is not null);
 if octet_length(result::text)>200000 then raise exception 'contribution_size';end if;
 return result;
end;$$;
revoke all on function gina.contribution_snapshot(uuid) from public,anon,authenticated,service_role;

create function public.preview_question_contribution(p_question_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.app_settings where key='contribution_sets.enabled' and value='true') then raise exception 'contribution_disabled';end if;
 return gina.contribution_snapshot(p_question_id);
end;$$;

create function public.begin_question_contribution(p_id uuid,p_question_id uuid,p_rights boolean,p_no_personal_data boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;v jsonb;h text;f uuid:=gina.family_id();begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_question_id is null or p_rights is not true or p_no_personal_data is not true then raise exception 'consent_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,31));
 select * into s from gina.contribution_sets where id=p_id for update;
 if found then
  if s.family_id<>f or s.actor_id is distinct from auth.uid() or s.question_id is distinct from p_question_id then raise exception 'request_conflict';end if;
 else
  if not exists(select 1 from public.app_settings where key='contribution_sets.enabled' and value='true') then raise exception 'contribution_disabled';end if;
  if (select count(*) from gina.contribution_sets where family_id=f and created_at>now()-interval '1 day')>=20 then raise exception 'contribution_daily_limit';end if;
  v:=gina.contribution_snapshot(p_question_id);
  h:=encode(extensions.digest((v||jsonb_build_object('images',(select coalesce(jsonb_agg(value-'id'),'[]') from jsonb_array_elements(v->'images'))))::text,'sha256'),'hex');
  select * into s from gina.contribution_sets where family_id=f and fingerprint=h and status<>'withdrawn';
  if not found then
   insert into gina.contribution_sets(id,family_id,actor_id,question_id,snapshot,fingerprint,status,consent_version)
   values(p_id,f,auth.uid(),p_question_id,v,h,case when jsonb_array_length(v->'images')=0 then 'pending' else 'preparing' end,'library-sharing-v2') returning * into s;
  end if;
 end if;
 if s.status='preparing' and s.actor_id is distinct from auth.uid() then raise exception 'contribution_in_progress';end if;
 return jsonb_build_object('id',s.id,'status',s.status,'snapshot',s.snapshot);
end;$$;

-- Only the authenticated Edge handler can commit independent, decoded image bytes.
create function public.finish_question_contribution(p_actor uuid,p_family uuid,p_id uuid,p_media jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;bytes bytea;dims int[];begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_actor and family_id=p_family)
 or exists(select 1 from public.active_families where user_id=p_actor and family_id<>p_family) then raise exception 'forbidden' using errcode='42501';end if;
 select * into s from gina.contribution_sets where id=p_id and family_id=p_family for update;
 if not found or s.actor_id is distinct from p_actor then raise exception 'forbidden' using errcode='42501';end if;
 if s.status='pending' then return jsonb_build_object('id',s.id,'status',s.status);end if;
 if s.status<>'preparing' then raise exception 'contribution_changed';end if;
 perform gina.import_keys(p_media,array['base64','width','height','sha256']);
 if octet_length(p_media::text)>720000 then raise exception 'contribution_size';end if;
 bytes:=decode(gina.import_text(p_media->'base64',1,700000),'base64');dims:=gina.import_png(bytes);
 if dims<>array[gina.import_int(p_media->'width',1,4096),gina.import_int(p_media->'height',1,4096)]
 or encode(extensions.digest(bytes,'sha256'),'hex') is distinct from p_media->>'sha256' then raise exception 'contribution_media_invalid';end if;
 update gina.contribution_sets set media=p_media,status='pending' where id=s.id;
 return jsonb_build_object('id',s.id,'status','pending');
end;$$;

create function public.list_question_contributions() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (select id,question_id,status,snapshot->>'title' title,snapshot->>'subject' subject,snapshot->'grade' grade,jsonb_array_length(snapshot->'questions') question_count,review_note,created_at from gina.contribution_sets where family_id=gina.family_id() order by created_at desc limit 100)v);
end;$$;
create function public.withdraw_question_contribution(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into s from gina.contribution_sets where id=p_id and family_id=gina.family_id() for update;
 if not found then raise exception 'contribution_not_found';end if;
 if s.status='approved' then raise exception 'contribution_already_accepted';end if;
 update gina.contribution_sets set status='withdrawn',media=null,snapshot=jsonb_build_object('title',s.snapshot->'title','subject',s.snapshot->'subject','grade',s.snapshot->'grade','questions','[]'::jsonb) where id=s.id;
end;$$;

create function public.admin_list_contribution_sets() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (select id,status,snapshot->>'title' title,snapshot->>'subject' subject,snapshot->'grade' grade,jsonb_array_length(snapshot->'questions') question_count,created_at,package_id,review_note from gina.contribution_sets where status in('pending','approved','rejected') order by created_at desc limit 100)v);
end;$$;
create function public.admin_get_contribution_set(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s gina.contribution_sets;begin
 perform gina.assert_admin();select * into s from gina.contribution_sets where id=p_id and status in('pending','approved','rejected');
 if not found then raise exception 'contribution_not_found';end if;
 return jsonb_build_object('id',s.id,'status',s.status,'package_id',s.package_id,'review_note',s.review_note,'media',s.media,'snapshot',s.snapshot-'images'||jsonb_build_object('image_alts',(select coalesce(jsonb_agg(value->'alt'),'[]') from jsonb_array_elements(s.snapshot->'images'))));
end;$$;

create function gina.award_contribution_milestones(p_family uuid) returns void language plpgsql security definer set search_path='' as $$
declare n int;m int;pol public.contribution_rewards;grant_id uuid;begin
 perform pg_advisory_xact_lock(73491821);
 select (select count(*) from public.question_contributions where family_id=p_family and status='approved')+(select count(*) from gina.contribution_question_credits where family_id=p_family) into n;
 for pol in select * from public.contribution_rewards where enabled loop
  -- A group may cross several thresholds in one acceptance. Never lose one or grant twice.
  for m in 1..(n/pol.threshold) loop
   insert into public.learning_credit_grants(family_id,policy_id,milestone,kind,amount,ends_at,reason)
   values(p_family,pol.id,m,pol.kind,pol.amount,now()+make_interval(days=>pol.valid_days),'Accepted library contribution milestone')
   on conflict(family_id,policy_id,milestone) do nothing returning id into grant_id;
   if grant_id is not null and pol.kind='plan' then
    insert into public.entitlement_overrides(family_id,plan,reason,granted_by,ends_at)
    values(p_family,pol.plan,'Library contribution: '||grant_id::text,auth.uid(),now()+make_interval(days=>least(pol.amount,pol.valid_days)));
   end if;
  end loop;
 end loop;
end;$$;
revoke all on function gina.award_contribution_milestones(uuid) from public,anon,authenticated,service_role;

create function public.admin_decide_contribution_set(p_request_id uuid,p_id uuid,p_approve boolean,p_note text,p_teachers jsonb,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;r gina.contribution_commands;h text;bundle jsonb;qs jsonb:='[]';q jsonb;teacher jsonb;source jsonb;assets jsonb:='[]';imported jsonb;result jsonb;fingerprint text;begin
 perform gina.assert_admin();
 if p_request_id is null or p_approve is null or p_confirmed is not true or length(trim(coalesce(p_note,''))) not between 3 and 2000
 or p_teachers is null or octet_length(p_teachers::text)>250000 then raise exception 'contribution_review_required';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_id,p_approve,p_note,p_teachers,p_confirmed)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,93));
 select * into r from gina.contribution_commands where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.payload_hash<>h then raise exception 'request_conflict';end if;return r.result;
 end if;
 select * into s from gina.contribution_sets where id=p_id;
 if not found then raise exception 'contribution_not_found';end if;
 perform pg_advisory_xact_lock(hashtextextended(s.family_id::text,31));
 select * into s from gina.contribution_sets where id=p_id for update;
 if s.status<>'pending' then raise exception 'contribution_changed';end if;
 if p_approve then
  if jsonb_typeof(p_teachers) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_teachers))<>jsonb_array_length(s.snapshot->'questions') then raise exception 'contribution_review_required';end if;
  if s.media is not null then assets:=jsonb_build_array(s.media||jsonb_build_object('key','image','mime','image/png'));end if;
  source:=case when s.snapshot->>'body'<>'' or s.media is not null then jsonb_build_array(jsonb_build_object('key','context','title',s.snapshot->'title','body',s.snapshot->'body','alt',coalesce((select string_agg(value->>'alt',E'\n' order by n) from jsonb_array_elements(s.snapshot->'images') with ordinality x(value,n)),''),'asset_key',case when s.media is null then null else 'image' end,'minimum_reading_width',case when s.media is null then 0 else least(1000,(s.media->>'width')::int) end,'provenance',jsonb_build_object('origin','family_contribution'))) else '[]'::jsonb end;
  for q in select value from jsonb_array_elements(s.snapshot->'questions') loop
   teacher:=p_teachers->(q->>'key');
   if teacher is null then raise exception 'contribution_review_required';end if;
   qs:=qs||jsonb_build_array(jsonb_build_object('key',q->'key','revision',1,'source_key',case when jsonb_array_length(source)>0 then 'context' else null end,
    'student',(q-array['key','correct_key','expected_answer','solution','explanation'])||jsonb_build_object('choices',coalesce(nullif(q->'choices','null'),'[]'::jsonb)),
    'teacher',teacher,'metadata',jsonb_build_object('origin','family_contribution','review_required',true)));
  end loop;
  bundle:=jsonb_build_object('schema','gina.library-import.v1','package_key','contribution-'||s.id,'revision',1,'previous_hash',null,'title',s.snapshot->'title','grade',s.snapshot->'grade','subject',s.snapshot->'subject','provenance',jsonb_build_object('origin','family_contribution','consent_version',s.consent_version),'assets',assets,'sources',source,'questions',qs);
  imported:=public.admin_import_library_bundle(p_request_id,bundle);
  perform pg_advisory_xact_lock(73491821);
  -- Fingerprints exclude family IDs, question IDs and numbering. Same content cannot earn duplicate credit.
  for q in select value from jsonb_array_elements(s.snapshot->'questions') order by value->>'stem' loop
   fingerprint:=encode(extensions.digest(jsonb_build_array(gina.library_hash(q),s.snapshot->'body',(select coalesce(jsonb_agg(value->>'sha256' order by value->>'sha256'),'[]') from jsonb_array_elements(s.snapshot->'images')))::text,'sha256'),'hex');
   if not exists(select 1 from public.library_items where content_hash=gina.library_hash(q)) then
    insert into gina.contribution_question_credits(fingerprint,contribution_id,family_id) values(fingerprint,s.id,s.family_id) on conflict do nothing;
   end if;
  end loop;
 end if;
 update gina.contribution_sets set status=case when p_approve then 'approved' else 'rejected' end,package_id=(imported->>'id')::uuid,reviewed_by=auth.uid(),review_note=trim(p_note),reviewed_at=now() where id=s.id;
 if p_approve then perform gina.award_contribution_milestones(s.family_id);end if;
 result:=jsonb_build_object('id',s.id,'status',case when p_approve then 'approved' else 'rejected' end,'package_id',imported->'id','credited_questions',(select count(*) from gina.contribution_question_credits where contribution_id=s.id));
 insert into gina.contribution_commands values(p_request_id,auth.uid(),h,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason) values(auth.uid(),'contribution_set.'||case when p_approve then 'approved' else 'rejected' end,'gina.contribution_sets',s.id::text,s.family_id,trim(p_note));
 return result;
end;$$;

revoke all on function public.preview_question_contribution(uuid),public.begin_question_contribution(uuid,uuid,boolean,boolean),public.list_question_contributions(),public.withdraw_question_contribution(uuid),public.admin_list_contribution_sets(),public.admin_get_contribution_set(uuid),public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean) from public,anon,service_role;
grant execute on function public.preview_question_contribution(uuid),public.begin_question_contribution(uuid,uuid,boolean,boolean),public.list_question_contributions(),public.withdraw_question_contribution(uuid),public.admin_list_contribution_sets(),public.admin_get_contribution_set(uuid),public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean) to authenticated;
revoke all on function public.finish_question_contribution(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_question_contribution(uuid,uuid,uuid,jsonb) to service_role;

-- Legacy text contributions share the same cumulative reward milestones.
create or replace function public.admin_review_contribution(p_id uuid,p_approve boolean,p_collection_id uuid,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.question_contributions; item uuid; pol public.contribution_rewards; n int; m int; grant_id uuid;
begin
 perform gina.assert_admin();
 if p_approve is null or length(trim(coalesce(p_note,'')))<3 then raise exception 'review_note_required'; end if;
 select * into s from public.question_contributions where id=p_id for update;
 if s.id is null then raise exception 'not_found'; end if;
 if s.status<>'pending' then
  if (s.status='approved' and p_approve) or (s.status='rejected' and not p_approve) then return jsonb_build_object('status',s.status,'item_id',s.library_item_id); end if;
  raise exception 'already_reviewed';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(s.family_id::text,31));
 if p_approve then
  perform pg_advisory_xact_lock(73491821);
  if exists(select 1 from gina.contribution_question_credits where fingerprint=encode(extensions.digest(jsonb_build_array(gina.library_hash(s.content),''::text,'[]'::jsonb)::text,'sha256'),'hex')) then raise exception 'duplicate_question';end if;
  perform pg_advisory_xact_lock(hashtextextended(s.content_hash,40));
  if exists(select 1 from public.library_items where content_hash=s.content_hash) then raise exception 'duplicate_question'; end if;
  -- Only a new original content item can earn a contribution reward.
  item:=public.admin_add_library_item(p_collection_id,s.content,false);
 end if;
 update public.question_contributions set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),review_note=trim(p_note),reviewed_at=now(),library_item_id=item where id=s.id;
 if p_approve then
  perform gina.award_contribution_milestones(s.family_id);
 end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason)
 values(auth.uid(),'contribution.'||case when p_approve then 'approved' else 'rejected' end,'question_contributions',s.id::text,s.family_id,trim(p_note));
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,'item_id',item);
end; $$;
