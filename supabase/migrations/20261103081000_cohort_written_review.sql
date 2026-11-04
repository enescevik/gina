-- Explicitly consented written cohorts. Parent feedback never changes shared scores.
alter table public.group_exams add column requires_review boolean not null default false;
alter table public.group_exam_entries add column review_consent_at timestamptz;
create table gina.cohort_reviews (
 entry_id uuid not null references public.group_exam_entries(id) on delete cascade, ord int not null,
 revision int not null default 1, answer_hash text not null, criterion_points jsonb not null,
 points int, outcome text not null check(outcome in('scored','not_answered','unreadable')),
 feedback text not null, reviewer uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(),
 primary key(entry_id,ord)
);
create table gina.cohort_appeals (
 entry_id uuid not null references public.group_exam_entries(id) on delete cascade, ord int not null,
 revision int not null default 1, review_revision int not null, reason text not null,
 status text not null default 'open' check(status in('open','resolved')), response text,
 created_by uuid references auth.users(id) on delete set null, resolved_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),primary key(entry_id,ord)
);
create table gina.cohort_publications (
 group_id uuid primary key references public.group_exams(id) on delete cascade,
 version int not null, fingerprint text not null, published_by uuid references auth.users(id) on delete set null,
 published_at timestamptz not null default now()
);
create table gina.cohort_review_events (
 sequence bigint generated always as identity primary key,
 entry_id uuid not null references public.group_exam_entries(id) on delete cascade,ord int not null,
 kind text not null check(kind in('review','appeal')),body jsonb not null,
 actor_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create index on gina.cohort_review_events(entry_id,ord,sequence);
do $$declare n text;begin foreach n in array array['cohort_reviews','cohort_appeals','cohort_publications','cohort_review_events'] loop
 execute format('alter table gina.%I enable row level security',n);
 execute format('revoke all on gina.%I from public,anon,authenticated,service_role',n);
end loop;end;$$;
create or replace function public.admin_group_package_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',r.title,'grade',p.grade,'subject',p.subject,'version',r.version,
  'curriculum',r.curriculum_label,'plans',r.plans,'units',(
   select coalesce(jsonb_agg(jsonb_build_object('key',u.key,'title',u.title,'count',u.n,'eligible',u.eligible,'has_media',u.has_media,'review_eligible',u.n<=12,'max_points',u.max_points) order by u.pos),'[]') from (
    select case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end key,
    coalesce(s.title,min(q.student->>'topic')) title,count(*) n,min(q.position) pos,
    bool_and(q.student->>'kind'='multiple_choice') and count(*)<=12 eligible,bool_or(s.asset_hash is not null) has_media,sum(case when q.student->>'kind'='multiple_choice' then 1 else (a.teacher#>>'{rubric,max_points}')::int end) max_points
    from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
    where q.package_id=p.id group by 1,s.title)u)) order by r.updated_at desc),'[]')
  from gina.library_import_packages p join gina.library_publications r on r.package_id=p.id cross join lateral gina.library_publication_checks(p.id)c
  where r.status='published' and r.review_fingerprint=c->>'review_fingerprint' and c->>'question_count'=c->>'suitable_count' and (c->>'missing_media')::int=0);
end;$$;

create function public.admin_create_reviewed_group_exam(p_id uuid,p_package_id uuid,p_publication_version int,p_title text,p_units text[],p_start timestamptz,p_end timestamptz,p_minutes int,p_plans public.plan_code[],p_review boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare p gina.library_import_packages;r gina.library_publications;payload jsonb;c jsonb;items jsonb;k text;keys text[];
begin
 perform gina.assert_admin();
 if p_review is null or p_id is null or p_package_id is null or p_publication_version is null or p_units is null or cardinality(p_units) not between 1 and 50
 or array_position(p_units,null) is not null or cardinality(p_units)<>(select count(distinct x) from unnest(p_units)x)
 or p_start is null or p_end is null or p_minutes is null or p_minutes not between 5 and 120
 or coalesce(length(trim(p_title)),0) not between 3 and 160 or coalesce(cardinality(p_plans),0)=0 or array_position(p_plans,null) is not null then raise exception 'group_invalid';end if;
 select array_agg(v order by v) into keys from unnest(p_units)v;
 payload:=jsonb_build_object('package',p_package_id,'version',p_publication_version,'title',trim(p_title),'units',keys,'start',p_start,'end',p_end,'minutes',p_minutes,'plans',p_plans)||case when p_review then '{"review":true}'::jsonb else '{}'::jsonb end;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,44));
 if exists(select 1 from public.group_exams where id=p_id) then
  if not exists(select 1 from public.group_exams where id=p_id and created_by=auth.uid() and creation_intent=payload) then raise exception 'request_conflict';end if;
  return p_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_package_id::text,89));
 select * into p from gina.library_import_packages where id=p_package_id;
 select * into r from gina.library_publications where package_id=p_package_id;
 if r.package_id is null or r.status<>'published' then raise exception 'group_package_unavailable';end if;
 if r.version<>p_publication_version then raise exception 'library_publication_changed';end if;
 if not(p_plans <@ r.plans) then raise exception 'group_package_plans';end if;
 for k in select question_key from gina.library_import_questions where package_id=p_package_id order by question_key loop
  perform pg_advisory_xact_lock(hashtextextended(p_package_id::text||':'||k,87));
 end loop;
 c:=gina.library_publication_checks(p_package_id);
 if r.review_fingerprint is distinct from c->>'review_fingerprint' or c->>'question_count'<>c->>'suitable_count' or (c->>'missing_media')::int<>0 then raise exception 'group_package_unavailable';end if;
 foreach k in array keys loop
  if not exists(select 1 from gina.library_import_questions q where q.package_id=p_package_id and (case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end)=k) then raise exception 'group_questions_required';end if;
 end loop;
 select jsonb_agg(jsonb_build_object('topic',q.student->>'topic','kind',q.student->>'kind','difficulty',q.student->>'difficulty','stem',q.student->>'stem','choices',q.student->'choices',
  'expected_answer',a.teacher->>'expected_answer','rubric',a.teacher->'rubric','correct_key',a.teacher->>'correct_key','solution',a.teacher->>'solution','explanation',a.teacher->>'explanation','question_key',q.question_key,
  'group_source',case when s.source_key is null then null else jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt,'asset_hash',s.asset_hash) end) order by q.position) into items
 from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key
 left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
 where q.package_id=p_package_id and (case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end)=any(keys);
 if coalesce(jsonb_array_length(items),0) not between 3 and 50 or (not p_review and exists(select 1 from jsonb_array_elements(items)x where x->>'kind'<>'multiple_choice')) then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x->'group_source' is not null and (length(x#>>'{group_source,body}')>6000 or length(x#>>'{group_source,title}')>160)) then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x#>>'{group_source,key}' is not null group by x#>>'{group_source,key}' having count(*)>12) then raise exception 'group_questions_required';end if;
 if p_end<=now() or p_end<=p_start or p_end>p_start+interval '31 days' then raise exception 'group_invalid';end if;
 insert into public.group_exams(id,title,package_id,grade,subject,curriculum_version,version_hash,starts_at,ends_at,duration_minutes,plans,created_by,creation_intent,requires_review)
 values(p_id,trim(p_title),p.id,p.grade,p.subject,r.curriculum_label,encode(extensions.digest(items::text,'sha256'),'hex'),p_start,p_end,p_minutes,p_plans,auth.uid(),payload,p_review);
 insert into public.group_exam_questions(group_id,ord,content) select p_id,ord,value from jsonb_array_elements(items) with ordinality x(value,ord);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details) values(auth.uid(),'group_exam_create','group_exams',p_id::text,'Frozen reviewed package units',jsonb_build_object('package',p.id,'publication_version',r.version,'units',keys));
 return p_id;
end;$$;
create or replace function public.admin_create_package_group_exam(p_id uuid,p_package_id uuid,p_publication_version int,p_title text,p_units text[],p_start timestamptz,p_end timestamptz,p_minutes int,p_plans public.plan_code[]) returns uuid language sql security definer set search_path='' as $$select public.admin_create_reviewed_group_exam(p_id,p_package_id,p_publication_version,p_title,p_units,p_start,p_end,p_minutes,p_plans,false);$$;
revoke all on function public.admin_create_reviewed_group_exam(uuid,uuid,int,text,text[],timestamptz,timestamptz,int,public.plan_code[],boolean) from public,anon,service_role;
grant execute on function public.admin_create_reviewed_group_exam(uuid,uuid,int,text,text[],timestamptz,timestamptz,int,public.plan_code[],boolean) to authenticated;
create or replace function gina.enroll_reviewed_group(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean,p_review_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();g public.group_exams;e public.group_exam_entries;pl public.plans;ids uuid[]:=array[]::uuid[];qid uuid;x record;eid uuid:=gen_random_uuid();entry_id uuid:=gen_random_uuid();
 src jsonb;src_key text;media_id uuid;context_id uuid;contexts jsonb:='{}';media jsonb:='{}';positions jsonb:='{}';n int;pos int;asset gina.library_delivery_assets;publication gina.library_publications;checks jsonb;k text;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_consent is distinct from true or p_ranking is null then raise exception 'group_consent_required';end if;
 -- Family lock protects the monthly allowance, group lock orders cancel/enrolment.
 perform pg_advisory_xact_lock(hashtextextended(f::text,45));
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=f;
 if found then return e.exam_id;end if;
 if not exists(select 1 from public.app_settings where key='cohorts.enabled' and value='true'::jsonb) then raise exception 'group_disabled';end if;
 select * into g from public.group_exams where id=p_group for update;
 if g.requires_review and p_review_consent is distinct from true then raise exception 'group_review_consent_required';end if;
 if g.id is null or g.status<>'published' or now()<g.starts_at or now()>=g.ends_at then raise exception 'group_not_open';end if;
 perform 1 from public.children where id=p_child and family_id=f and grade=g.grade for update;
 if not found then raise exception 'group_grade_mismatch';end if;
 if (select count(*) from public.group_exam_entries where group_id=g.id)>=1000 then raise exception 'group_full';end if;
 pl:=gina.family_plan_of(f);
 if not(pl.code=any(g.plans)) then raise exception 'group_plan_required';end if;
 if (select count(*) from public.group_exam_entries used join public.group_exams gr on gr.id=used.group_id where used.family_id=f and used.created_at>=gina.family_month_start(f) and gr.status<>'cancelled')>=pl.cohort_monthly then raise exception 'group_quota';end if;
 if g.package_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(g.package_id::text,89));
  select * into publication from gina.library_publications where package_id=g.package_id;
  for k in select question_key from gina.library_import_questions where package_id=g.package_id order by question_key loop
   perform pg_advisory_xact_lock(hashtextextended(g.package_id::text||':'||k,87));
  end loop;
  checks:=gina.library_publication_checks(g.package_id);
  if publication.status is distinct from 'published' or publication.review_fingerprint is distinct from checks->>'review_fingerprint'
   or checks->>'question_count'<>checks->>'suitable_count' or (checks->>'missing_media')::int<>0 or not(pl.code=any(publication.plans)) then raise exception 'group_package_unavailable';end if;
 end if;
 for x in select * from public.group_exam_questions where group_id=g.id order by ord loop
  qid:=gen_random_uuid();ids:=array_append(ids,qid);
  src:=x.content->'group_source';src_key:=src->>'key';media_id:=null;context_id:=null;
  if src_key is not null then
   if not(positions ? src_key) then
    select count(*) into n from public.group_exam_questions where group_id=g.id and content#>>'{group_source,key}'=src_key;
    if n>1 then
     if not exists(select 1 from public.app_settings where key='question_groups.enabled' and value='true') then raise exception 'question_group_delivery_not_ready';end if;
     context_id:=gen_random_uuid();
     insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values(context_id,f,context_id,1,src->>'title',src->>'body',g.grade,g.subject);
     contexts:=contexts||jsonb_build_object(src_key,context_id);
    end if;
    if src->>'asset_hash' is not null then
     if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then raise exception 'source_not_ready';end if;
     select * into asset from gina.library_delivery_assets where source_hash=src->>'asset_hash';
     if not found then raise exception 'source_not_ready';end if;
     media_id:=gen_random_uuid();
     insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent,verified_at)
     values(media_id,f,auth.uid(),'question_image',src->>'title','image/png',octet_length(asset.png),asset.sha256,'library/'||f::text||'/'||media_id::text,'ready',asset.width,asset.height,'group-practice-v1',now());
     insert into gina.library_source_copies values(media_id,src->>'asset_hash');
     media:=media||jsonb_build_object(src_key,media_id);
    end if;
    positions:=positions||jsonb_build_object(src_key,0);
   end if;
   context_id:=(contexts->>src_key)::uuid;media_id:=(media->>src_key)::uuid;
   pos:=(positions->>src_key)::int+1;positions:=positions||jsonb_build_object(src_key,pos);
  end if;
  insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,created_by,provenance)
  values(qid,f,g.grade,g.subject,x.content->>'topic',(x.content->>'kind')::public.question_kind,(x.content->>'difficulty')::public.question_difficulty,
   case when src_key is null then x.content->>'stem' else (src->>'title')||E'\n'||(src->>'body')||E'\n\n'||(x.content->>'stem') end,
   x.content->'choices',x.content->>'correct_key',x.content->>'expected_answer',x.content->>'solution',x.content->>'explanation',auth.uid(),jsonb_build_object('group',g.id,'version',g.version_hash,'package',g.package_id));
  if media_id is not null then insert into public.learning_source_links(source_id,question_id,alt) values(media_id,qid,src->>'alt');end if;
  if context_id is not null then insert into public.question_source_members(group_id,question_id,position,prompt) values(context_id,qid,pos,x.content->>'stem');end if;
 end loop;
 for k in select value from jsonb_each_text(contexts) loop
  update public.question_source_groups set finalized_at=now() where id=k::uuid;
 end loop;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by)
 values(eid,f,p_child,g.title,g.subject,g.grade,ids,true,g.duration_minutes,'assigned',auth.uid());
 insert into public.group_exam_entries(id,group_id,family_id,child_id,exam_id,alias,ranking_consent,consent_version,enrolled_by,review_consent_at)
 values(entry_id,g.id,f,p_child,eid,'Kâşif '||left(entry_id::text,8),p_ranking,case when g.requires_review then 'group-review-v1' else 'group-practice-v1' end,auth.uid(),case when g.requires_review then now() end);
 insert into public.group_exam_entry_questions(entry_id,question_id,ord) select entry_id,q,ord from unnest(ids) with ordinality x(q,ord);
 return eid;
end;$$;
revoke all on function gina.enroll_reviewed_group(uuid,uuid,boolean,boolean,boolean) from public,anon,authenticated,service_role;
create or replace function public.enroll_group_exam(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean) returns uuid language sql security definer set search_path='' as $$select gina.enroll_reviewed_group(p_group,p_child,p_ranking,p_consent,false);$$;
create function public.enroll_reviewed_group_exam(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean,p_review_consent boolean) returns uuid language sql security definer set search_path='' as $$select gina.enroll_reviewed_group(p_group,p_child,p_ranking,p_consent,p_review_consent);$$;
revoke all on function public.enroll_reviewed_group_exam(uuid,uuid,boolean,boolean,boolean) from public,anon,service_role;
grant execute on function public.enroll_reviewed_group_exam(uuid,uuid,boolean,boolean,boolean) to authenticated;
-- Include editable notebook changes in the frozen cohort boundary.
create or replace function gina.guard_group_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;g public.group_exams;key text;kind text;
begin
 select * into a from public.exam_attempts where id=new.attempt_id;
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=a.exam_id;
 if g.id is null then return new;end if;
 if tg_op='INSERT' or (new.answer_key,new.answer_text,new.answer_document,new.question_id,new.attempt_id) is distinct from(old.answer_key,old.answer_text,old.answer_document,old.question_id,old.attempt_id) then
  if g.status<>'published' or a.status<>'in_progress' or now()>a.deadline_at or now()>=g.ends_at then raise exception 'group_answer_closed';end if;
  if new.answer_key is not null and new.answer_key not in('A','B','C','D') then raise exception 'invalid_input';end if;
 end if;
 select q.content->>'correct_key',q.content->>'kind' into key,kind from public.group_exam_entries e join public.group_exam_entry_questions eq on eq.entry_id=e.id
 join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord where e.exam_id=a.exam_id and eq.question_id=new.question_id;
 if kind is null then raise exception 'question_not_in_exam';end if;
 new.is_correct:=case when kind='multiple_choice' then coalesce(new.answer_key=key,false) else null end;
 return new;
end;$$;
create or replace function public.get_group_exams() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();pl public.plans;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 pl:=gina.family_plan_of(f);
 return jsonb_build_object('enabled',(select value from public.app_settings where key='cohorts.enabled'),
 'monthly',pl.cohort_monthly,'used',(select count(*) from public.group_exam_entries e join public.group_exams g on g.id=e.group_id where e.family_id=f and e.created_at>=gina.family_month_start(f) and g.status<>'cancelled'),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'subject',g.subject,'grade',g.grade,'curriculum',g.curriculum_version,'version',left(g.version_hash,10),'starts_at',g.starts_at,'ends_at',g.ends_at,'minutes',g.duration_minutes,'status',g.status,'requires_review',g.requires_review,'max_points',(select sum(case when content->>'kind'='multiple_choice' then 1 else (content#>>'{rubric,max_points}')::int end) from public.group_exam_questions where group_id=g.id),'included',pl.code=any(g.plans),'questions',(select count(*) from public.group_exam_questions where group_id=g.id)) order by g.starts_at desc),'[]')
 from public.group_exams g where (g.status='published' and g.ends_at>now()-interval '90 days') or exists(select 1 from public.group_exam_entries where group_id=g.id and family_id=f)),
 'entries',(select coalesce(jsonb_agg(jsonb_build_object('group_id',group_id,'child_id',child_id,'exam_id',exam_id,'alias',alias,'ranking',ranking_consent)),'[]') from public.group_exam_entries where family_id=f));
end;$$;

-- Shared results use frozen rubrics and central reviews, never parent/AI score fields.
create function gina.cohort_rows(p_group uuid)
returns table(entry_id uuid,family_id uuid,child_id uuid,alias text,ranking boolean,attempt_id uuid,attempt_status text,ord int,question_id uuid,content jsonb,answer_hash text,answer_text text,answer_document jsonb,answer_key text,maximum int,points int,reviewed boolean,review_revision int,outcome text,feedback text)
language sql stable security definer set search_path='' as $$
 select e.id,e.family_id,e.child_id,e.alias,e.ranking_consent,a.id,a.status::text,eq.ord,eq.question_id,q.content,gina.answer_fingerprint(ans),ans.answer_text,ans.answer_document,ans.answer_key,
 case when q.content->>'kind'='multiple_choice' then 1 else (q.content#>>'{rubric,max_points}')::int end,
 case when q.content->>'kind'='multiple_choice' then case when ans.answer_key=q.content->>'correct_key' then 1 else 0 end else r.points end,
 case when q.content->>'kind'='multiple_choice' then true else r.answer_hash=gina.answer_fingerprint(ans) and r.outcome<>'unreadable' end,
 coalesce(r.revision,0),coalesce(r.outcome,case when q.content->>'kind'='multiple_choice' then 'automatic' else 'pending' end),r.feedback
 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 join public.group_exam_entry_questions eq on eq.entry_id=e.id join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
 left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=eq.question_id
 left join gina.cohort_reviews r on r.entry_id=e.id and r.ord=eq.ord
 where e.group_id=p_group;
$$;
create function gina.cohort_review_state(p_group uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with rows as (select * from gina.cohort_rows(p_group)), tally as (
 select count(distinct entry_id)::int participants,count(*) filter(where not coalesce(reviewed,false))::int pending,
 count(distinct entry_id) filter(where attempt_status='in_progress')::int unfinished,
 encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(entry_id,ord,answer_hash,review_revision,outcome) order by entry_id,ord),'[]')::text,'sha256'),'hex') fingerprint from rows
 ), appeals as (select count(*)::int n from gina.cohort_appeals a join public.group_exam_entries e on e.id=a.entry_id where e.group_id=p_group and a.status='open')
 select to_jsonb(tally)||jsonb_build_object('appeals',appeals.n,'version',coalesce(p.version,0),'published',coalesce(p.fingerprint=tally.fingerprint and appeals.n=0 and tally.pending=0 and tally.unfinished=0,false))
 from tally cross join appeals left join gina.cohort_publications p on p.group_id=p_group;
$$;

create function public.admin_cohort_review_queue(p_group uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g public.group_exams;begin
 perform gina.assert_admin();select * into g from public.group_exams where id=p_group and requires_review;
 if not found then raise exception 'not_found';end if;
 return jsonb_build_object('group',jsonb_build_object('id',g.id,'title',g.title,'grade',g.grade,'subject',g.subject,'ends_at',g.ends_at,'status',g.status),
 'review_open',g.status='published' and g.ends_at<=now(),'state',gina.cohort_review_state(g.id),'entries',(select coalesce(jsonb_agg(to_jsonb(v) order by alias),'[]') from (
 select r.entry_id,r.alias,max(r.attempt_status) attempt_status,count(*)::int total,count(*) filter(where not coalesce(r.reviewed,false))::int pending,
 (select count(*) from gina.cohort_appeals a where a.entry_id=r.entry_id and a.status='open') appeals
 from gina.cohort_rows(g.id)r group by r.entry_id,r.alias)v));
end;$$;
create function public.admin_cohort_review_detail(p_entry uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;begin
 perform gina.assert_admin();select * into e from public.group_exam_entries where id=p_entry;select * into g from public.group_exams where id=e.group_id;
 if e.review_consent_at is null or not coalesce(g.requires_review,false) then raise exception 'forbidden' using errcode='42501';end if;
 if g.ends_at>now() or exists(select 1 from public.exam_attempts where exam_id=e.exam_id and status='in_progress') then raise exception 'group_review_not_open';end if;
 return jsonb_build_object('entry',e.id,'alias',e.alias,'group',g.id,'images',(
 select coalesce(jsonb_agg(jsonb_build_object('source_id',src.source_id,'alt',src.alt,'width',asset.width,'height',asset.height,'png',replace(encode(asset.png,'base64'),E'\n',''))),'[]') from (
 select distinct l.source_id,l.alt from public.group_exam_entry_questions eq join public.learning_source_links l on l.question_id=eq.question_id where eq.entry_id=e.id
 )src join gina.library_source_copies cp on cp.source_id=src.source_id join gina.library_delivery_assets asset on asset.source_hash=cp.asset_hash), 'questions',(
 select coalesce(jsonb_agg(jsonb_build_object('ord',r.ord,'question_id',r.question_id,'question',r.content,'answer_hash',r.answer_hash,'answer_text',r.answer_text,'answer_document',r.answer_document,'answer_key',r.answer_key,
 'maximum',r.maximum,'points',r.points,'reviewed',coalesce(r.reviewed,false),'revision',r.review_revision,'outcome',r.outcome,'feedback',r.feedback,
 'criterion_points',(select criterion_points from gina.cohort_reviews where entry_id=e.id and ord=r.ord),
 'history',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'body',ev.body,'created_at',ev.created_at) order by ev.sequence),'[]') from gina.cohort_review_events ev where ev.entry_id=e.id and ev.ord=r.ord),
 'appeal',(select jsonb_build_object('revision',a.revision,'status',a.status,'reason',a.reason,'response',a.response) from gina.cohort_appeals a where entry_id=e.id and ord=r.ord),
 'images',(select coalesce(jsonb_agg(jsonb_build_object('source_id',l.source_id)),'[]') from public.learning_source_links l where l.question_id=r.question_id)
 ) order by r.ord),'[]') from gina.cohort_rows(g.id)r where r.entry_id=e.id));
end;$$;

create function public.admin_save_cohort_review(p_request uuid,p_entry uuid,p_ord int,p_revision int,p_answer_hash text,p_points jsonb,p_outcome text,p_feedback text,p_appeal_revision int default null,p_response text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;r record;c jsonb;total int:=0;v int;payload jsonb;result jsonb;ap gina.cohort_appeals;begin
 perform gina.assert_admin();select * into e from public.group_exam_entries where id=p_entry;
 if e.review_consent_at is null then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','cohort.review','entry',p_entry,'ord',p_ord,'revision',p_revision,'hash',p_answer_hash,'points',p_points,'outcome',p_outcome,'feedback',p_feedback,'appeal_revision',p_appeal_revision,'response',p_response);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(e.group_id::text,91));
 select * into g from public.group_exams where id=e.group_id for share;
 if not g.requires_review or g.status<>'published' or g.ends_at>now() then raise exception 'group_review_not_open';end if;
 select * into r from gina.cohort_rows(g.id) where entry_id=e.id and ord=p_ord;
 if not found or r.attempt_status='in_progress' then raise exception 'group_review_not_open';end if;
 if r.content->>'kind'<>'open_ended' then raise exception 'group_review_automatic';end if;
 if p_revision is distinct from r.review_revision or p_answer_hash is distinct from r.answer_hash then raise exception 'group_review_changed';end if;
 if p_outcome is null or p_outcome not in('scored','not_answered','unreadable') or length(trim(coalesce(p_feedback,''))) not between 10 and 4000 or jsonb_typeof(p_points) is distinct from 'object' then raise exception 'group_review_invalid';end if;
 if p_outcome='not_answered' and (length(trim(coalesce(r.answer_text,'')))>0 or exists(select 1 from jsonb_array_elements(r.answer_document->'elements')x where x->>'type'='stroke' or (x->>'type'='text' and length(trim(x->>'text'))>0))) then raise exception 'group_answer_present';end if;
 if (select count(*) from jsonb_object_keys(p_points))<>jsonb_array_length(r.content#>'{rubric,criteria}') then raise exception 'group_review_points';end if;
 for c in select value from jsonb_array_elements(r.content#>'{rubric,criteria}') loop
  if jsonb_typeof(p_points->(c->>'id')) is distinct from 'number' or (p_points->>(c->>'id'))::numeric<>trunc((p_points->>(c->>'id'))::numeric) then raise exception 'group_review_points';end if;
  v:=(p_points->>(c->>'id'))::int;
  if v<0 or v>(c->>'points')::int or (p_outcome<>'scored' and v<>0) then raise exception 'group_review_points';end if;total:=total+v;
 end loop;
 select * into ap from gina.cohort_appeals where entry_id=e.id and ord=p_ord for update;
 if ap.status='open' then
  if p_appeal_revision is distinct from ap.revision or length(trim(coalesce(p_response,''))) not between 10 and 4000 then raise exception 'group_appeal_response_required';end if;
  update gina.cohort_appeals set revision=revision+1,status='resolved',response=trim(p_response),resolved_by=auth.uid(),updated_at=now() where entry_id=e.id and ord=p_ord;
 elsif p_appeal_revision is not null then raise exception 'group_review_changed';end if;
 insert into gina.cohort_reviews(entry_id,ord,revision,answer_hash,criterion_points,points,outcome,feedback,reviewer)
 values(e.id,p_ord,r.review_revision+1,r.answer_hash,p_points,case when p_outcome='unreadable' then null else total end,p_outcome,trim(p_feedback),auth.uid())
 on conflict(entry_id,ord) do update set revision=excluded.revision,answer_hash=excluded.answer_hash,criterion_points=excluded.criterion_points,points=excluded.points,outcome=excluded.outcome,feedback=excluded.feedback,reviewer=excluded.reviewer,updated_at=now();
 insert into gina.cohort_review_events(entry_id,ord,kind,body,actor_id) values(e.id,p_ord,'review',jsonb_build_object('revision',r.review_revision+1,'points',case when p_outcome='unreadable' then null else total end,'criteria',p_points,'outcome',p_outcome,'feedback',trim(p_feedback),'response',case when ap.status='open' then trim(p_response) end),auth.uid());
 result:=jsonb_build_object('entry',e.id,'ord',p_ord,'revision',r.review_revision+1);
 perform gina.save_help_receipt(p_request,payload,result,e.family_id);
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,details) values(auth.uid(),'cohort.review','group_exam_entries',e.id::text,e.family_id,jsonb_build_object('ord',p_ord,'revision',r.review_revision+1,'outcome',p_outcome,'appeal_resolved',ap.status='open'));
 return result;
end;$$;

create function public.admin_publish_cohort_results(p_request uuid,p_group uuid,p_fingerprint text,p_version int) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.group_exams;s jsonb;payload jsonb;result jsonb;begin
 perform gina.assert_admin();payload:=jsonb_build_object('action','cohort.publish','group',p_group,'fingerprint',p_fingerprint,'version',p_version);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_group::text,91));select * into g from public.group_exams where id=p_group for share;
 if not found or not g.requires_review or g.status<>'published' or g.ends_at>now() then raise exception 'group_review_not_open';end if;
 s:=gina.cohort_review_state(g.id);
 if (s->>'pending')::int<>0 or (s->>'unfinished')::int<>0 or (s->>'appeals')::int<>0 or (s->>'participants')::int=0 then raise exception 'group_review_incomplete';end if;
 if s->>'fingerprint' is distinct from p_fingerprint or (s->>'version')::int is distinct from p_version then raise exception 'group_review_changed';end if;
 insert into gina.cohort_publications(group_id,version,fingerprint,published_by) values(g.id,p_version+1,p_fingerprint,auth.uid())
 on conflict(group_id) do update set version=excluded.version,fingerprint=excluded.fingerprint,published_by=excluded.published_by,published_at=now();
 result:=jsonb_build_object('group',g.id,'version',p_version+1);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'cohort.publish','group_exams',g.id::text,jsonb_build_object('version',p_version+1));return result;
end;$$;

create function public.appeal_cohort_review(p_request uuid,p_group uuid,p_child uuid,p_ord int,p_review_revision int,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;r gina.cohort_reviews;a gina.cohort_appeals;payload jsonb;result jsonb;begin
 if not coalesce(gina.is_parent(),false) then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if not found or e.review_consent_at is null then raise exception 'forbidden' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'group_appeal_reason';end if;
 payload:=jsonb_build_object('action','cohort.appeal','entry',e.id,'ord',p_ord,'review_revision',p_review_revision,'reason',trim(p_reason));
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(e.family_id::text,92));perform pg_advisory_xact_lock(hashtextextended(p_group::text,91));select * into g from public.group_exams where id=p_group for share;
 if g.status<>'published' or not g.requires_review or g.ends_at>now() then raise exception 'group_review_not_open';end if;
 select * into r from gina.cohort_reviews where entry_id=e.id and ord=p_ord;
 if not found or r.revision is distinct from p_review_revision then raise exception 'group_review_changed';end if;
 select * into a from gina.cohort_appeals where entry_id=e.id and ord=p_ord;
 if a.status='open' then raise exception 'group_appeal_open';end if;
 if a.review_revision=p_review_revision then raise exception 'group_appeal_closed';end if;
 if (select count(*) from gina.cohort_review_events ca join public.group_exam_entries ce on ce.id=ca.entry_id where ce.family_id=e.family_id and ca.kind='appeal' and ca.created_at>now()-interval '1 day')>=20 then raise exception 'group_appeal_limited';end if;
 insert into gina.cohort_appeals(entry_id,ord,revision,review_revision,reason,created_by) values(e.id,p_ord,coalesce(a.revision,0)+1,p_review_revision,trim(p_reason),auth.uid())
 on conflict(entry_id,ord) do update set revision=excluded.revision,review_revision=excluded.review_revision,reason=excluded.reason,status='open',response=null,resolved_by=null,created_by=excluded.created_by,updated_at=now();
 insert into gina.cohort_review_events(entry_id,ord,kind,body,actor_id) values(e.id,p_ord,'appeal',jsonb_build_object('revision',coalesce(a.revision,0)+1,'review_revision',p_review_revision,'reason',trim(p_reason)),auth.uid());
 result:=jsonb_build_object('entry',e.id,'ord',p_ord,'revision',coalesce(a.revision,0)+1,'status','open');
 perform gina.save_help_receipt(p_request,payload,result,e.family_id);return result;
end;$$;

alter function public.get_group_result(uuid,uuid) set schema gina;
alter function gina.get_group_result(uuid,uuid) rename to automatic_group_result;
revoke all on function gina.automatic_group_result(uuid,uuid) from public,anon,authenticated,service_role;
create function public.get_group_result(p_group uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;s jsonb;me record;board jsonb:='[]';begin
 if not coalesce(gina.is_parent(),false) then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if not found then raise exception 'not_found';end if;select * into g from public.group_exams where id=p_group;
 if not g.requires_review then return gina.automatic_group_result(p_group,p_child);end if;
 if now()<g.ends_at and g.status='published' then return jsonb_build_object('ready',false,'requires_review',true,'ends_at',g.ends_at);end if;
 s:=gina.cohort_review_state(g.id);
 select min(attempt_id::text)::uuid attempt_id,sum(points) points,sum(maximum) maximum,count(*) total,count(*) filter(where points=maximum and reviewed) correct from gina.cohort_rows(g.id) where entry_id=e.id into me;
 if me.attempt_id is null then return jsonb_build_object('ready',true,'participated',false,'cancelled',g.status='cancelled','requires_review',true);end if;
 if e.ranking_consent and g.status='published' and s->>'published'='true' then
  select coalesce(jsonb_agg(jsonb_build_object('alias',v.alias,'points',v.points,'maximum',v.maximum,'rank',v.rank,'mine',v.entry_id=e.id) order by v.rank,v.alias),'[]') into board from (
   select *,rank() over(order by points desc) rank,row_number() over(order by points desc,alias) position from (
    select entry_id,alias,sum(points) points,sum(maximum) maximum from gina.cohort_rows(g.id) where ranking group by entry_id,alias)scored
  )v where v.position<=50 or v.entry_id=e.id;
 end if;
 return jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled','requires_review',true,'published',s->'published','publication_version',s->'version',
 'points',case when s->>'published'='true' then me.points end,'maximum',me.maximum,'total',me.total,'correct',me.correct,'attempt_id',me.attempt_id,'ranking',board,'topics','[]'::jsonb,
 'reviews',(select coalesce(jsonb_agg(jsonb_build_object('ord',r.ord,'stem',r.content->>'stem','kind',r.content->>'kind','topic',r.content->>'topic','maximum',r.maximum,'points',r.points,'outcome',r.outcome,'feedback',r.feedback,'revision',r.review_revision,
 'criteria',r.content#>'{rubric,criteria}','criterion_points',(select criterion_points from gina.cohort_reviews where entry_id=e.id and ord=r.ord),
 'appeal',(select jsonb_build_object('status',a.status,'reason',a.reason,'response',a.response) from gina.cohort_appeals a where entry_id=e.id and ord=r.ord)) order by r.ord),'[]') from gina.cohort_rows(g.id)r where r.entry_id=e.id));
end;$$;
revoke all on function gina.cohort_rows(uuid),gina.cohort_review_state(uuid) from public,anon,authenticated,service_role;
revoke all on function public.admin_cohort_review_queue(uuid),public.admin_cohort_review_detail(uuid),public.admin_save_cohort_review(uuid,uuid,int,int,text,jsonb,text,text,int,text),public.admin_publish_cohort_results(uuid,uuid,text,int),public.appeal_cohort_review(uuid,uuid,uuid,int,int,text),public.get_group_result(uuid,uuid) from public,anon,service_role;
grant execute on function public.admin_cohort_review_queue(uuid),public.admin_cohort_review_detail(uuid),public.admin_save_cohort_review(uuid,uuid,int,int,text,jsonb,text,text,int,text),public.admin_publish_cohort_results(uuid,uuid,text,int),public.appeal_cohort_review(uuid,uuid,uuid,int,int,text),public.get_group_result(uuid,uuid) to authenticated;

create or replace function public.settle_group_attempts() returns int language plpgsql security definer set search_path='' as $$
declare a record;n int:=0;
begin
 if auth.role()<>'service_role' and current_user not in('postgres','supabase_admin') then raise exception 'forbidden' using errcode='42501';end if;
 for a in select at.id,at.exam_id,at.deadline_at from public.exam_attempts at join public.group_exam_entries e on e.exam_id=at.exam_id
 join public.group_exams g on g.id=e.group_id where at.status='in_progress' and (at.deadline_at<=now() or g.status='cancelled') limit 200 for update of at skip locked loop
  update public.exam_attempts set status='submitted',finished_at=least(now(),a.deadline_at),
   mc_total=(select count(*) from public.group_exam_entry_questions q join public.group_exam_entries e on e.id=q.entry_id join public.group_exam_questions frozen on frozen.group_id=e.group_id and frozen.ord=q.ord where e.exam_id=a.exam_id and frozen.content->>'kind'='multiple_choice'),
   mc_correct=(select count(*) from public.exam_answers where attempt_id=a.id and is_correct) where id=a.id;
  update public.exams set status='completed' where id=a.exam_id;n:=n+1;
 end loop;return n;
end;$$;
