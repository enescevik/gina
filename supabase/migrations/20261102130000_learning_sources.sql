insert into public.app_settings(key,value) values('sources.enabled','false') on conflict do nothing;
-- Family originals are never public objects. Views use short-lived server-issued URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gina-private-sources','gina-private-sources',false,10485760,array['image/png','image/jpeg','application/pdf'])
on conflict(id) do nothing;
create table public.learning_sources (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 uploaded_by uuid references auth.users(id) on delete set null,
 kind text not null check(kind in('document','question_image')),
 name text not null check(length(name) between 1 and 160), mime text not null check(mime in('image/png','image/jpeg','application/pdf')),
 bytes int not null check(bytes between 24 and 10485760),sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 object_path text not null unique,status text not null default 'awaiting_upload' check(status in('awaiting_upload','ready','invalid')),
 width int,height int,pages int check(pages between 1 and 5),
 storage_consent text not null, created_at timestamptz not null default now(),verified_at timestamptz,
 check(kind<>'question_image' or mime<>'application/pdf')
);
create index on public.learning_sources(family_id,created_at);
create table public.learning_source_links (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.learning_sources(id) on delete cascade,
 question_id uuid references public.question_bank(id) on delete cascade,
 timetable_child_id uuid references public.school_timetables(child_id) on delete cascade,
 task_id uuid references public.task_templates(id) on delete cascade,
 reward_id uuid references public.family_rewards(id) on delete cascade,
 goal_id uuid references public.child_goals(id) on delete cascade,
 alt text not null default '' check(length(alt)<=1000),created_at timestamptz not null default now(),
 check(num_nonnulls(question_id,timetable_child_id,task_id,reward_id,goal_id)=1),
 unique nulls not distinct(source_id,question_id,timetable_child_id,task_id,reward_id,goal_id)
);
create table public.source_deletion_queue (
 object_path text primary key,created_at timestamptz not null default now(),attempts int not null default 0,last_error text,last_attempt_at timestamptz
);
create function gina.queue_source_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.source_deletion_queue(object_path) values(old.object_path) on conflict do nothing;
 return old;
end; $$;
create trigger queue_source_deletion after delete on public.learning_sources for each row execute function gina.queue_source_deletion();
revoke all on function gina.queue_source_deletion() from public,anon,authenticated;
alter table public.learning_sources enable row level security;
alter table public.learning_source_links enable row level security;
alter table public.source_deletion_queue enable row level security;
revoke all on public.learning_sources,public.learning_source_links,public.source_deletion_queue from anon,authenticated;
grant all on public.learning_sources,public.learning_source_links,public.source_deletion_queue to service_role;
grant select on public.learning_sources to authenticated;
create policy source_parent_read on public.learning_sources for select to authenticated using(gina.is_parent() and family_id=gina.family_id());
-- No Storage SELECT/INSERT policy: all blobs pass through verified, bounded Edge operations.

create function public.reserve_learning_source(p_id uuid,p_kind text,p_name text,p_mime text,p_bytes int,p_sha256 text,p_consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();s public.learning_sources;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb) then raise exception 'source_unavailable'; end if;
 if p_consent is not true then raise exception 'source_consent_required'; end if;
 if p_id is null or p_kind not in('document','question_image') or p_mime not in('image/png','image/jpeg','application/pdf') or (p_mime<>'application/pdf' and p_bytes>4194304) then raise exception 'source_size_or_type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,41));
 select * into s from public.learning_sources where id=p_id;
 if found then
  if s.family_id<>f or s.uploaded_by is distinct from auth.uid() or s.sha256<>p_sha256 or s.kind<>p_kind or s.bytes<>p_bytes or s.mime<>p_mime then raise exception 'request_conflict'; end if;
  return to_jsonb(s);
 end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 minute')>=5 then raise exception 'source_rate_limited'; end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 day')>=100
 or (select coalesce(sum(bytes),0) from public.learning_sources where family_id=f)+p_bytes>536870912 then raise exception 'source_storage_limit'; end if;
 insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,storage_consent)
 values(p_id,f,auth.uid(),p_kind,trim(p_name),p_mime,p_bytes,p_sha256,f::text||'/'||p_id::text,'private-storage-v1') returning * into s;
 return to_jsonb(s);
end; $$;

create function public.attach_question_source(p_question_id uuid,p_source_id uuid,p_alt text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.question_bank where id=p_question_id and family_id=f for update;
 if not found then raise exception 'question_not_found'; end if;
 if length(trim(coalesce(p_alt,''))) not between 3 and 1000 then raise exception 'source_alt_required'; end if;
 if exists(select 1 from public.exam_attempts a join public.exams e on e.id=a.exam_id where p_question_id=any(e.question_ids)) then raise exception 'question_in_use'; end if;
 perform 1 from public.learning_sources where id=p_source_id and family_id=f and kind='question_image' and status='ready' for update;
 if not found then raise exception 'source_not_ready'; end if;
 if (select count(*) from public.learning_source_links where question_id=p_question_id)>=3 and not exists(select 1 from public.learning_source_links where question_id=p_question_id and source_id=p_source_id) then raise exception 'source_image_limit'; end if;
 insert into public.learning_source_links(source_id,question_id,alt) values(p_source_id,p_question_id,trim(p_alt))
 on conflict(source_id,question_id,timetable_child_id,task_id,reward_id,goal_id) do update set alt=excluded.alt;
end; $$;
create function gina.can_read_question_media(q uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (gina.is_parent() and exists(select 1 from public.question_bank where id=q and family_id=gina.family_id())) or
 (gina.is_device() and exists(select 1 from public.exams where family_id=gina.family_id() and child_id=gina.child_id() and status in('assigned','completed') and q=any(question_ids)));
$$;
revoke all on function gina.can_read_question_media(uuid) from public,anon,authenticated;
create function public.get_question_media(p_question_ids uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',l.question_id,'source_id',s.id,'alt',l.alt,'width',s.width,'height',s.height) order by l.created_at),'[]')
 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id
 where s.family_id=gina.family_id() and l.question_id=any(p_question_ids[1:100]) and s.kind='question_image' and s.status='ready' and gina.can_read_question_media(l.question_id);
$$;
create function public.get_learning_source_access(p_source_id uuid,p_question_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.learning_sources;
begin
 select * into s from public.learning_sources where id=p_source_id and status='ready';
 if s.id is null then raise exception 'source_not_ready'; end if;
 if s.family_id is distinct from gina.family_id() then raise exception 'forbidden' using errcode='42501'; end if;
 if not ((gina.is_parent() and s.family_id=gina.family_id()) or (s.kind='question_image' and exists(select 1 from public.learning_source_links where source_id=s.id and question_id=p_question_id) and gina.can_read_question_media(p_question_id))) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('id',s.id,'object_path',s.object_path,'mime',s.mime,'name',s.name);
end; $$;
create function public.delete_learning_source(p_source_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 -- A required question image cannot disappear from a live or completed exam.
 if exists(select 1 from public.learning_source_links l join public.exams e on l.question_id=any(e.question_ids) where l.source_id=p_source_id and e.family_id=gina.family_id()) then raise exception 'question_in_use'; end if;
 delete from public.learning_sources where id=p_source_id and family_id=gina.family_id();
end; $$;
revoke all on function public.reserve_learning_source(uuid,text,text,text,int,text,boolean),public.attach_question_source(uuid,uuid,text),public.get_question_media(uuid[]),public.get_learning_source_access(uuid,uuid),public.delete_learning_source(uuid) from public,anon;
grant execute on function public.reserve_learning_source(uuid,text,text,text,int,text,boolean),public.attach_question_source(uuid,uuid,text),public.get_question_media(uuid[]),public.get_learning_source_access(uuid,uuid),public.delete_learning_source(uuid) to authenticated;

create function public.expire_unlinked_learning_sources() returns int language plpgsql security definer set search_path='' as $$
declare n int:=0; candidate record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 for candidate in select s.id from public.learning_sources s where s.created_at<now()-interval '24 hours' and not exists(select 1 from public.learning_source_links where source_id=s.id) limit 100 for update skip locked loop
  if not exists(select 1 from public.learning_source_links where source_id=candidate.id) then delete from public.learning_sources where id=candidate.id;n:=n+1;end if;
 end loop;
 return n;
end; $$;
create function public.record_source_cleanup(p_path text,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 -- Signed upload tokens may remain valid for two hours after metadata deletion.
 -- Keep tombstones for three hours and sweep repeatedly, preventing late orphan uploads.
 if p_success then delete from public.source_deletion_queue where object_path=p_path and created_at<now()-interval '3 hours'; end if;
 update public.source_deletion_queue set attempts=attempts+1,last_attempt_at=now(),last_error=case when p_success then null else 'storage_delete_failed' end where object_path=p_path;
end; $$;
revoke all on function public.expire_unlinked_learning_sources(),public.record_source_cleanup(text,boolean) from public,anon,authenticated;
grant execute on function public.expire_unlinked_learning_sources(),public.record_source_cleanup(text,boolean) to service_role;
-- Deployment must provision source_cleanup_secret in Vault and SOURCE_CLEANUP_SECRET in Edge.
do $$ begin
 perform cron.schedule('source-cleanup','43 * * * *',$job$
  select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='project_url')||'/functions/v1/source-cleanup',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='source_cleanup_secret')),
   body:='{}'::jsonb)
  where exists(select 1 from vault.decrypted_secrets where name='project_url') and exists(select 1 from vault.decrypted_secrets where name='source_cleanup_secret');
 $job$);
exception when invalid_schema_name or undefined_function then raise notice 'source-cleanup scheduler unavailable; provision before enabling uploads';end; $$;

create function public.save_question_with_sources(p_request_id uuid,p_question jsonb,p_images jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();q public.question_bank;r public.mutation_receipts;payload jsonb;image jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_question) is distinct from 'object' or jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>3 then raise exception 'invalid_input'; end if;
 payload:=jsonb_build_object('question',p_question,'images',p_images);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'save_question' or r.payload<>payload then raise exception 'request_conflict'; end if;
  return (r.result->>'id')::uuid;
 end if;
 q:=jsonb_populate_record(null::public.question_bank,p_question);
 if q.grade is null or q.grade not between 1 and 12 or length(trim(coalesce(q.subject,''))) not between 1 and 80
 or length(trim(coalesce(q.topic,''))) not between 1 and 200 or length(trim(coalesce(q.stem,''))) not between 5 and 10000 or q.kind is null or q.difficulty is null
 or length(coalesce(q.expected_answer,''))>10000 or length(coalesce(q.solution,''))>10000 or length(coalesce(q.explanation,''))>10000 then raise exception 'question_incomplete'; end if;
 if q.kind='multiple_choice' and (jsonb_typeof(q.choices) is distinct from 'array' or jsonb_array_length(q.choices)<>4 or
 (select count(distinct c->>'key') from jsonb_array_elements(q.choices)c where c->>'key' in('A','B','C','D') and length(trim(coalesce(c->>'text',''))) between 1 and 5000)<>4 or coalesce(q.correct_key,'') not in('A','B','C','D')) then raise exception 'question_incomplete'; end if;
 insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
 values(p_request_id,f,q.grade,trim(q.subject),trim(q.topic),q.scenario_code,q.kind,q.difficulty,trim(q.stem),q.choices,q.correct_key,q.expected_answer,q.solution,q.explanation,jsonb_build_object('generator','parent'),auth.uid());
 for image in select value from jsonb_array_elements(p_images) loop
  perform public.attach_question_source(p_request_id,(image->>'source_id')::uuid,image->>'alt');
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_question',payload,jsonb_build_object('id',p_request_id));
 return p_request_id;
end; $$;
revoke all on function public.save_question_with_sources(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_question_with_sources(uuid,jsonb,jsonb) to authenticated;

-- Explicit per-source AI processing consent is distinct from private storage consent.
create table public.learning_source_ai_consents (
 source_id uuid not null references public.learning_sources(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null, purpose text not null check(purpose in('grade','import')),
 version text not null,created_at timestamptz not null default now(),
 primary key(source_id,actor_id,scope_id,purpose)
);
alter table public.learning_source_ai_consents enable row level security;
revoke all on public.learning_source_ai_consents from anon,authenticated;
grant all on public.learning_source_ai_consents to service_role;

-- Until library media copying/moderation is implemented, never silently publish
-- a text-only version of a question that depends on a private image.
create function gina.guard_contribution_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_bank where id=new.source_question_id for update;
 if exists(select 1 from public.learning_source_links where question_id=new.source_question_id) then raise exception 'source_contribution_not_ready'; end if;
 return new;
end; $$;
revoke all on function gina.guard_contribution_media() from public,anon,authenticated;
create trigger contribution_media_guard before insert on public.question_contributions for each row execute function gina.guard_contribution_media();

create function public.get_learning_source_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',gina.is_parent() and exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb),'max_images',3,'max_image_bytes',4194304,'max_pdf_pages',5);
$$;
revoke all on function public.get_learning_source_policy() from public,anon;
grant execute on function public.get_learning_source_policy() to authenticated;
