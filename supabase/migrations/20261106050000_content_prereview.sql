-- E01: AI pre-review of library drafts, contribution sets and MEB scenario candidates.
-- The AI verdict is an advisory record kept apart from the admin decision columns
-- (library_editorial_reviews / library_publications, contribution_sets.status/reviewed_by,
-- curriculum_candidates.status/review). `ai_approved` never publishes, never consumes a
-- quota and never replaces the independent educator review (X06). The library package
-- table is immutable, so the pre-review state lives in one side table for all three kinds.
insert into public.app_settings(key,value) values('content_prereview.enabled','false') on conflict do nothing;
insert into public.app_settings(key,value) values('content_prereview.plan','"pro"') on conflict do nothing;

create table gina.content_prereviews (
 target_kind text not null check(target_kind in('library_package','contribution_set','curriculum_candidate')),
 target_id uuid not null,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 prompt_version text not null default 'unassigned' check(length(prompt_version) between 1 and 40),
 prereview_status text not null default 'pending' check(prereview_status in('pending','ai_approved','needs_admin','ai_rejected_suggestion')),
 prereview_verdict jsonb,
 prereview_at timestamptz,
 attempts int not null default 0 check(attempts between 0 and 10),
 last_error text check(length(last_error)<=160),
 lease uuid, claimed_at timestamptz,
 requested_by uuid,
 queued_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(target_kind,target_id)
);
create index content_prereviews_pending on gina.content_prereviews(queued_at) where prereview_status='pending';
-- One admin notice per (record, content, prompt version): a replayed finish never spams the queue.
create table gina.content_prereview_notices (
 target_kind text not null, target_id uuid not null, content_hash text not null, prompt_version text not null,
 prereview_status text not null, recipient_count int not null, created_at timestamptz not null default now(),
 primary key(target_kind,target_id,content_hash,prompt_version)
);
alter table gina.content_prereviews enable row level security;
alter table gina.content_prereview_notices enable row level security;
revoke all on gina.content_prereviews,gina.content_prereview_notices from public,anon,authenticated,service_role;

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check(kind in('task_awaiting_approval','task_approved','task_returned','exam_assigned','exam_finished','weekly_summary','cohort_results','parent_announcement','education_reminder','content_prereview_needs_admin'));

-- Normalized content given to the model. Private provenance notes, family ids, actor ids and
-- image bytes are excluded; outcome texts, stems, answers, rubrics and scenario blocks are included in full.
create function gina.content_prereview_source(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin
 if p_kind='library_package' then
  select jsonb_build_object('kind','library_package','id',p.id,'package_key',p.package_key,'revision',p.revision,'title',p.title,'grade',p.grade,'subject',p.subject,
   'sources',(select coalesce(jsonb_agg(jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt) order by s.source_key),'[]') from gina.library_import_sources s where s.package_id=p.id),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'revision',q.revision,'source_key',q.source_key,'student',q.student,'teacher',a.teacher,'curriculum',q.metadata->'curriculum') order by q.position),'[]')
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
create function gina.content_prereview_hash(p jsonb) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(p::text,'sha256'),'hex');
$$;
-- Awaiting an admin decision: these are the records a bulk run queues.
create function gina.content_prereview_awaiting(p_kind text,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind
  when 'library_package' then exists(select 1 from gina.library_import_packages p where p.id=p_id) and not exists(select 1 from gina.library_publications r where r.package_id=p_id)
  when 'contribution_set' then exists(select 1 from gina.contribution_sets s where s.id=p_id and s.status='pending')
  when 'curriculum_candidate' then exists(select 1 from gina.curriculum_candidates c where c.id=p_id and c.status='draft')
  else false end;
$$;
-- Queue or re-queue one record. Unchanged content with an existing verdict is left alone.
create function gina.content_prereview_queue(p_kind text,p_id uuid,p_actor uuid) returns text
language plpgsql security definer set search_path='' as $$
declare src jsonb;h text;row gina.content_prereviews;begin
 src:=gina.content_prereview_source(p_kind,p_id);
 if src is null then raise exception 'prereview_not_found';end if;
 h:=gina.content_prereview_hash(src);
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id::text,91));
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id;
 if not found then
  insert into gina.content_prereviews(target_kind,target_id,content_hash,requested_by) values(p_kind,p_id,h,p_actor);return 'queued';
 end if;
 if row.content_hash<>h then
  update gina.content_prereviews set content_hash=h,prereview_status='pending',prereview_verdict=null,prereview_at=null,attempts=0,last_error=null,lease=null,claimed_at=null,requested_by=p_actor,queued_at=now(),updated_at=now()
  where target_kind=p_kind and target_id=p_id;return 'requeued';
 end if;
 return 'unchanged';
end;$$;
revoke all on function gina.content_prereview_source(text,uuid),gina.content_prereview_hash(jsonb),gina.content_prereview_awaiting(text,uuid),gina.content_prereview_queue(text,uuid,uuid) from public,anon,authenticated,service_role;

-- Admin: bulk queue. Idempotent; a second call with the same content queues nothing.
create function public.enqueue_content_prereview(p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record;outcome text;queued int:=0;requeued int:=0;unchanged int:=0;begin
 perform gina.assert_admin();
 if p_scope is null or p_scope not in('library_packages','contribution_sets','curriculum_candidates','all') then raise exception 'prereview_scope_invalid';end if;
 for r in
  select 'library_package' kind,p.id from gina.library_import_packages p where p_scope in('library_packages','all') and gina.content_prereview_awaiting('library_package',p.id)
  union all select 'contribution_set',s.id from gina.contribution_sets s where p_scope in('contribution_sets','all') and gina.content_prereview_awaiting('contribution_set',s.id)
  union all select 'curriculum_candidate',c.id from gina.curriculum_candidates c where p_scope in('curriculum_candidates','all') and gina.content_prereview_awaiting('curriculum_candidate',c.id)
 loop
  outcome:=gina.content_prereview_queue(r.kind,r.id,auth.uid());
  if outcome='queued' then queued:=queued+1;elsif outcome='requeued' then requeued:=requeued+1;else unchanged:=unchanged+1;end if;
 end loop;
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'content_prereview.enqueue','gina.content_prereviews',p_scope,jsonb_build_object('queued',queued,'requeued',requeued,'unchanged',unchanged));
 return jsonb_build_object('scope',p_scope,'queued',queued,'requeued',requeued,'unchanged',unchanged);
end;$$;
-- Admin: queue a single record (also the admin's proof of authority for the Edge Function).
create function public.request_content_prereview(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare outcome text;row gina.content_prereviews;begin
 perform gina.assert_admin();
 if p_kind is null or p_kind not in('library_package','contribution_set','curriculum_candidate') or p_id is null then raise exception 'prereview_kind_invalid';end if;
 outcome:=gina.content_prereview_queue(p_kind,p_id,auth.uid());
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id;
 return jsonb_build_object('outcome',outcome,'kind',p_kind,'id',p_id,'prereview_status',row.prereview_status,'content_hash',row.content_hash,'attempts',row.attempts);
end;$$;
create function public.admin_content_prereviews(p_status text default null,p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_status is not null and p_status not in('pending','ai_approved','needs_admin','ai_rejected_suggestion') then raise exception 'prereview_status_invalid';end if;
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)-'lease'),'[]') from (
  select target_kind,target_id,content_hash,prompt_version,prereview_status,prereview_verdict,prereview_at,attempts,last_error,requested_by,queued_at,updated_at,claimed_at,lease,
   gina.content_prereview_awaiting(target_kind,target_id) awaiting_admin
  from gina.content_prereviews where p_status is null or prereview_status=p_status
  order by (prereview_status='needs_admin') desc,(prereview_status='ai_rejected_suggestion') desc,queued_at desc limit p_limit)r);
end;$$;
revoke all on function public.enqueue_content_prereview(text),public.request_content_prereview(text,uuid),public.admin_content_prereviews(text,int) from public,anon,service_role;
grant execute on function public.enqueue_content_prereview(text),public.request_content_prereview(text,uuid),public.admin_content_prereviews(text,int) to authenticated;

-- Admin notification through the existing push outbox (admins who are also family members
-- receive it; the backoffice list RPC above is the queue of record). Deduplicated per content.
create function gina.content_prereview_notify(p_kind text,p_id uuid,p_hash text,p_prompt_version text,p_status text) returns int
language plpgsql security definer set search_path='' as $$
declare n int;begin
 if exists(select 1 from gina.content_prereview_notices where target_kind=p_kind and target_id=p_id and content_hash=p_hash and prompt_version=p_prompt_version) then return -1;end if;
 with recipients as(
  select distinct on(a.user_id) a.user_id,m.family_id from public.admins a join public.family_members m on m.user_id=a.user_id
  left join public.active_families af on af.user_id=a.user_id
  order by a.user_id,(m.family_id=af.family_id) desc nulls last,m.family_id),
 queued as(
  insert into public.push_outbox(family_id,audience,target_user_id,kind,payload)
  select family_id,'parents',user_id,'content_prereview_needs_admin',jsonb_build_object('target_id',p_id,'target_kind',p_kind,'prereview_status',p_status) from recipients returning 1)
 select count(*) into n from queued;
 insert into gina.content_prereview_notices(target_kind,target_id,content_hash,prompt_version,prereview_status,recipient_count) values(p_kind,p_id,p_hash,p_prompt_version,p_status,n);
 return n;
end;$$;
revoke all on function gina.content_prereview_notify(text,uuid,text,text,text) from public,anon,authenticated,service_role;

-- Service (Edge Function): claim one record with a lease. Same content + same prompt version with a
-- verdict → cached, no provider call. Changed content or prompt version → fresh run.
create function public.content_prereview_claim(p_kind text,p_id uuid,p_lease uuid,p_prompt_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare src jsonb;h text;row gina.content_prereviews;begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('library_package','contribution_set','curriculum_candidate') or p_id is null or p_lease is null or p_prompt_version is null or length(p_prompt_version) not between 1 and 40 then raise exception 'prereview_kind_invalid';end if;
 if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return jsonb_build_object('error','prereview_disabled');end if;
 src:=gina.content_prereview_source(p_kind,p_id);
 if src is null then return jsonb_build_object('error','not_found');end if;
 h:=gina.content_prereview_hash(src);
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id::text,91));
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id for update;
 if found and row.content_hash=h and row.prompt_version=p_prompt_version and row.prereview_status<>'pending' then
  return jsonb_build_object('cached',true,'prereview_status',row.prereview_status,'prereview_verdict',row.prereview_verdict,'content_hash',h);
 end if;
 if found and row.content_hash=h and row.prompt_version=p_prompt_version and row.lease is not null and row.claimed_at>now()-interval '3 minutes' then
  return jsonb_build_object('error','in_progress');
 end if;
 if found and (row.content_hash<>h or row.prompt_version<>p_prompt_version) then
  update gina.content_prereviews set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',prereview_verdict=null,prereview_at=null,attempts=0,last_error=null,lease=null,claimed_at=null,queued_at=now(),updated_at=now()
  where target_kind=p_kind and target_id=p_id returning * into row;
 end if;
 if found and row.attempts>=3 then
  update gina.content_prereviews set prereview_status='needs_admin',prereview_at=now(),lease=null,claimed_at=null,updated_at=now(),
   prereview_verdict=jsonb_build_object('decision_reason','retry_limit','last_error',row.last_error,'attempts',row.attempts,'content_hash',h,'prompt_version',p_prompt_version)
  where target_kind=p_kind and target_id=p_id;
  perform gina.content_prereview_notify(p_kind,p_id,h,p_prompt_version,'needs_admin');
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.needs_admin','gina.content_prereviews',p_kind||':'||p_id::text,jsonb_build_object('reason','retry_limit'));
  return jsonb_build_object('error','retry_limit','prereview_status','needs_admin');
 end if;
 insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,attempts,lease,claimed_at,updated_at)
 values(p_kind,p_id,h,p_prompt_version,1,p_lease,now(),now())
 on conflict(target_kind,target_id) do update set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',attempts=gina.content_prereviews.attempts+1,lease=p_lease,claimed_at=now(),updated_at=now()
 returning * into row;
 return jsonb_build_object('claimed',true,'content',src,'content_hash',h,'prompt_version',p_prompt_version,'attempts',row.attempts);
end;$$;
-- Service: record the outcome under the lease. 'pending' = transient failure, attempt kept for the retry limit.
create function public.content_prereview_finish(p_kind text,p_id uuid,p_lease uuid,p_status text,p_verdict jsonb,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row gina.content_prereviews;notified int:=0;begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in('pending','ai_approved','needs_admin','ai_rejected_suggestion') or (p_status<>'pending' and jsonb_typeof(p_verdict) is distinct from 'object') then raise exception 'prereview_status_invalid';end if;
 if p_status<>'pending' and not(p_verdict ?& array['decision_reason','confidence','findings']) then raise exception 'prereview_verdict_invalid';end if;
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id for update;
 if not found or row.lease is distinct from p_lease or row.prereview_status<>'pending' then raise exception 'lease_lost';end if;
 update gina.content_prereviews set prereview_status=p_status,
  prereview_verdict=case when p_status='pending' then prereview_verdict else p_verdict||jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version) end,
  prereview_at=case when p_status='pending' then prereview_at else now() end,
  last_error=left(p_error,160),lease=null,claimed_at=null,updated_at=now()
 where target_kind=p_kind and target_id=p_id returning * into row;
 if p_status in('needs_admin','ai_rejected_suggestion') then notified:=gina.content_prereview_notify(p_kind,p_id,row.content_hash,row.prompt_version,p_status);end if;
 if p_status<>'pending' then
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.'||p_status,'gina.content_prereviews',p_kind||':'||p_id::text,
   jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version,'confidence',p_verdict->'confidence','decision_reason',p_verdict->'decision_reason','notified',notified));
 end if;
 return jsonb_build_object('prereview_status',row.prereview_status,'attempts',row.attempts,'notified',notified);
end;$$;
-- Service: next pending records for the scheduled worker.
create function public.content_prereview_next(p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('kind',target_kind,'id',target_id)),'[]') from (
  select target_kind,target_id from gina.content_prereviews where prereview_status='pending' and attempts<3 and (lease is null or claimed_at<now()-interval '3 minutes')
  order by queued_at limit greatest(1,least(coalesce(p_limit,5),25)))r);
end;$$;
revoke all on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),public.content_prereview_next(int) from public,anon,authenticated;
grant execute on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),public.content_prereview_next(int) to service_role;
