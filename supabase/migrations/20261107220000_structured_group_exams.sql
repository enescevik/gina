-- Only deterministic structured variants can participate in a shared score.
create function gina.cohort_interaction(p_interaction jsonb) returns jsonb
language sql stable set search_path='' as $$
 select p_interaction || jsonb_build_object('policy',t.policy,'policy_version',t.policy_version,'points',1)
 from public.interaction_types t
 where t.type=p_interaction->>'type' and t.enabled and t.family='structured'
   and t.schema_version=(p_interaction->>'schema_version')::int
   and cardinality(gina.qt_question_errors(t.type,t.schema_version,p_interaction->'payload',p_interaction->'answer_key'))=0
   and case t.type
     when 'numeric' then coalesce(p_interaction#>>'{answer_key,process_required}','false')='false'
     when 'two_stage' then p_interaction#>>'{payload,stage2,mode}'='choice'
     when 'error_fix' then p_interaction#>>'{answer_key,fix_policy}'='closed'
     else t.type in ('true_false','fill_blank','matching','ordering','classification','multi_choice','mark_text','region_select','clock','crossword')
   end;
$$;
revoke all on function gina.cohort_interaction(jsonb) from public,anon,authenticated,service_role;


create or replace function public.admin_group_package_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_operation_role(array['content']);
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',r.title,'grade',p.grade,'subject',p.subject,'version',r.version,
  'curriculum',r.curriculum_label,'plans',r.plans,'units',(
   select coalesce(jsonb_agg(jsonb_build_object('key',u.key,'title',u.title,'count',u.n,'eligible',u.eligible,'has_media',u.has_media,'review_eligible',u.review_eligible,'max_points',u.max_points) order by u.pos),'[]') from (
    select case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end key,
    coalesce(s.title,min(q.student->>'topic')) title,count(*) n,min(q.position) pos,
    bool_and(case when q.metadata ? 'interaction' then i.snapshot is not null else q.student->>'kind'='multiple_choice' end) and count(*)<=12 eligible,
    bool_and(not(q.metadata ? 'interaction') or i.snapshot is not null) and count(*)<=12 review_eligible,bool_or(s.asset_hash is not null) has_media,sum(case when q.metadata ? 'interaction' or q.student->>'kind'='multiple_choice' then 1 else (a.teacher#>>'{rubric,max_points}')::int end) max_points
    from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
    cross join lateral (select gina.cohort_interaction(q.metadata->'interaction') snapshot) i
    where q.package_id=p.id group by 1,s.title)u)) order by r.updated_at desc),'[]')
  from gina.library_import_packages p join gina.library_publications r on r.package_id=p.id cross join lateral gina.library_publication_checks(p.id)c
  where r.status='published' and r.review_fingerprint=c->>'review_fingerprint' and c->>'question_count'=c->>'suitable_count' and (c->>'missing_media')::int=0);
end;$$;

create or replace function public.admin_create_reviewed_group_exam(p_id uuid,p_package_id uuid,p_publication_version int,p_title text,p_units text[],p_start timestamptz,p_end timestamptz,p_minutes int,p_plans public.plan_code[],p_review boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare p gina.library_import_packages;r gina.library_publications;payload jsonb;c jsonb;items jsonb;k text;keys text[];
begin
 perform gina.assert_operation_role(array['content']);
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
 select jsonb_agg(jsonb_build_object('topic',q.student->>'topic','kind',case when q.metadata ? 'interaction' then 'structured' else q.student->>'kind' end,'difficulty',q.student->>'difficulty','stem',q.student->>'stem','choices',q.student->'choices',
  'expected_answer',a.teacher->>'expected_answer','rubric',a.teacher->'rubric','correct_key',a.teacher->>'correct_key','solution',a.teacher->>'solution','explanation',a.teacher->>'explanation','question_key',q.question_key,
  'group_source',case when s.source_key is null then null else jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt,'asset_hash',s.asset_hash) end) || case when q.metadata ? 'interaction' then jsonb_build_object('interaction',gina.cohort_interaction(q.metadata->'interaction')) else '{}'::jsonb end order by q.position) into items
 from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key
 left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
 where q.package_id=p_package_id and (case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end)=any(keys);
 if coalesce(jsonb_array_length(items),0) not between 3 and 50 or (not p_review and exists(select 1 from jsonb_array_elements(items)x where x->>'kind' not in ('multiple_choice','structured'))) then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x->>'kind'='structured' and x->>'interaction' is null) then raise exception 'interaction_type_unavailable';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x->'group_source' is not null and (length(x#>>'{group_source,body}')>6000 or length(x#>>'{group_source,title}')>160)) then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x#>>'{group_source,key}' is not null group by x#>>'{group_source,key}' having count(*)>12) then raise exception 'group_questions_required';end if;
 if p_end<=now() or p_end<=p_start or p_end>p_start+interval '31 days' then raise exception 'group_invalid';end if;
 insert into public.group_exams(id,title,package_id,grade,subject,curriculum_version,version_hash,starts_at,ends_at,duration_minutes,plans,created_by,creation_intent,requires_review)
 values(p_id,trim(p_title),p.id,p.grade,p.subject,r.curriculum_label,encode(extensions.digest(items::text,'sha256'),'hex'),p_start,p_end,p_minutes,p_plans,auth.uid(),payload,p_review);
 insert into public.group_exam_questions(group_id,ord,content) select p_id,ord,value from jsonb_array_elements(items) with ordinality x(value,ord);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details) values(auth.uid(),'group_exam_create','group_exams',p_id::text,'Frozen reviewed package units',jsonb_build_object('package',p.id,'publication_version',r.version,'units',keys));
 return p_id;
end;$$;

create or replace function gina.enroll_reviewed_group(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean,p_review_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();g public.group_exams;e public.group_exam_entries;pl public.plans;ids uuid[]:=array[]::uuid[];qid uuid;x record;eid uuid:=gen_random_uuid();entry_id uuid:=gen_random_uuid();
 src jsonb;src_key text;media_id uuid;context_id uuid;contexts jsonb:='{}';media jsonb:='{}';positions jsonb:='{}';n int;pos int;asset gina.library_delivery_assets;publication gina.library_publications;checks jsonb;k text;typed jsonb;stem text;
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
  stem:=btrim(case when src_key is null then x.content->>'stem' else (src->>'title')||E'\n'||(src->>'body')||E'\n\n'||(x.content->>'stem') end);
  if x.content->>'kind'='structured' then
   typed:=x.content->'interaction';
   -- The package and the current policy registry cannot rewrite an existing cohort.
   insert into public.question_answer_keys(question_id,family_id,interaction_type,schema_version,key,policy,policy_version,points,content_hash)
   values(qid,f,typed->>'type',(typed->>'schema_version')::smallint,typed->'answer_key',typed->>'policy',
    (typed->>'policy_version')::smallint,(typed->>'points')::numeric,
    gina.qt_content_hash(stem,typed->>'type',(typed->>'schema_version')::int,typed->'payload',typed->'answer_key',
     typed->>'policy',(typed->>'policy_version')::int,(typed->>'points')::numeric));
   insert into public.question_bank(id,family_id,grade,subject,topic,kind,interaction_type,schema_version,payload,difficulty,stem,created_by,provenance)
   values(qid,f,g.grade,g.subject,x.content->>'topic','structured',typed->>'type',(typed->>'schema_version')::smallint,
    typed->'payload',(x.content->>'difficulty')::public.question_difficulty,stem,auth.uid(),
    jsonb_build_object('group',g.id,'version',g.version_hash,'package',g.package_id));
  else
  insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,created_by,provenance)
  values(qid,f,g.grade,g.subject,x.content->>'topic',(x.content->>'kind')::public.question_kind,(x.content->>'difficulty')::public.question_difficulty,
   case when src_key is null then x.content->>'stem' else (src->>'title')||E'\n'||(src->>'body')||E'\n\n'||(x.content->>'stem') end,
   x.content->'choices',x.content->>'correct_key',x.content->>'expected_answer',x.content->>'solution',x.content->>'explanation',auth.uid(),jsonb_build_object('group',g.id,'version',g.version_hash,'package',g.package_id));
  end if;
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

create or replace function gina.guard_group_answer() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare a public.exam_attempts;g public.group_exams;key text;kind text;
begin
 select * into a from public.exam_attempts where id=new.attempt_id;
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=a.exam_id;
 if g.id is null then return new;end if;
 if tg_op='INSERT' or (new.answer_key,new.answer_text,new.answer_document,new.answer,new.question_id,new.attempt_id) is distinct from(old.answer_key,old.answer_text,old.answer_document,old.answer,old.question_id,old.attempt_id) then
  if g.status<>'published' or a.status<>'in_progress' or now()>a.deadline_at or now()>=g.ends_at then raise exception 'group_answer_closed';end if;
  if new.answer_key is not null and new.answer_key not in('A','B','C','D') then raise exception 'invalid_input';end if;
 end if;
 select q.content->>'correct_key',q.content->>'kind' into key,kind from public.group_exam_entries e join public.group_exam_entry_questions eq on eq.entry_id=e.id
 join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord where e.exam_id=a.exam_id and eq.question_id=new.question_id;
 if new.answer is not null and kind is distinct from 'structured' then raise exception 'interaction_type_unavailable';end if;
 if kind is null then raise exception 'question_not_in_exam';end if;
 if kind='structured' and new.graded_by is not null and new.graded_by<>'auto' then
  raise exception 'group_review_automatic';
 end if;
 new.is_correct:=case when kind='multiple_choice' then coalesce(new.answer_key=key,false) else null end;
 return new;
end;$function$;

create or replace function gina.guard_group_question() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_exam_entry_questions where question_id=old.id) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if not exists(select 1 from public.families where id=old.family_id) then return old;end if;
 if tg_op='DELETE' then raise exception 'group_exam_locked';end if;
 if old.kind='structured' and (new.interaction_type,new.schema_version,new.payload)
    is distinct from (old.interaction_type,old.schema_version,old.payload) then raise exception 'group_exam_locked';end if;
 if (new.family_id,new.grade,new.subject,new.topic,new.kind,new.stem,new.choices,new.correct_key,new.expected_answer,new.solution,new.explanation)
 is distinct from(old.family_id,old.grade,old.subject,old.topic,old.kind,old.stem,old.choices,old.correct_key,old.expected_answer,old.solution,old.explanation) then raise exception 'group_exam_locked';end if;
 return new;
end;$$;

create or replace function public.get_group_exams() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();pl public.plans;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 pl:=gina.family_plan_of(f);
 return jsonb_build_object('enabled',(select value from public.app_settings where key='cohorts.enabled'),
 'monthly',pl.cohort_monthly,'used',(select count(*) from public.group_exam_entries e join public.group_exams g on g.id=e.group_id where e.family_id=f and e.created_at>=gina.family_month_start(f) and g.status<>'cancelled'),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'subject',g.subject,'grade',g.grade,'curriculum',g.curriculum_version,'version',left(g.version_hash,10),'starts_at',g.starts_at,'ends_at',g.ends_at,'minutes',g.duration_minutes,'status',g.status,'requires_review',g.requires_review,'max_points',(select sum(case when content->>'kind' in ('multiple_choice','structured') then 1 else (content#>>'{rubric,max_points}')::int end) from public.group_exam_questions where group_id=g.id),'included',pl.code=any(g.plans),'questions',(select count(*) from public.group_exam_questions where group_id=g.id)) order by g.starts_at desc),'[]')
 from public.group_exams g where (g.status='published' and g.ends_at>now()-interval '90 days') or exists(select 1 from public.group_exam_entries where group_id=g.id and family_id=f)),
 'entries',(select coalesce(jsonb_agg(jsonb_build_object('group_id',group_id,'child_id',child_id,'exam_id',exam_id,'alias',alias,'ranking',ranking_consent)),'[]') from public.group_exam_entries where family_id=f));
end;$$;

drop function gina.cohort_ranking_rows(uuid);
drop function gina.cohort_rows(uuid);

create or replace function gina.cohort_rows(p_group uuid)
returns table(entry_id uuid,family_id uuid,child_id uuid,alias text,ranking boolean,attempt_id uuid,attempt_status text,ord int,question_id uuid,content jsonb,answer_hash text,answer_text text,answer_document jsonb,answer_key text,maximum int,points numeric,reviewed boolean,review_revision int,outcome text,feedback text)
language sql stable security definer set search_path='' as $$
 select e.id,e.family_id,e.child_id,e.alias,e.ranking_consent,a.id,a.status::text,eq.ord,eq.question_id,q.content,gina.answer_fingerprint(ans),ans.answer_text,ans.answer_document,ans.answer_key,
 case when q.content->>'kind' in ('multiple_choice','structured') then 1 else (q.content#>>'{rubric,max_points}')::int end,
 case when q.content->>'kind'='multiple_choice' then case when ans.answer_key=q.content->>'correct_key' then 1 else 0 end
      when q.content->>'kind'='structured' then case when ans.answer is null or ans.score_details->>'outcome'='unanswered' then 0 when ans.graded_by='auto' then ans.score_exact / 100 end
      else r.points end,
 case when q.content->>'kind'='multiple_choice' then true when q.content->>'kind'='structured' then ans.answer is null or ans.score_details->>'outcome'='unanswered' or ans.graded_by='auto' and ans.score_exact is not null
      else r.answer_hash=gina.answer_fingerprint(ans) and r.outcome<>'unreadable' end,
 coalesce(r.revision,0),coalesce(r.outcome,case when q.content->>'kind' in ('multiple_choice','structured') then 'automatic' else 'pending' end),r.feedback
 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 join public.group_exam_entry_questions eq on eq.entry_id=e.id join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
 left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=eq.question_id
 left join gina.cohort_reviews r on r.entry_id=e.id and r.ord=eq.ord
 where e.group_id=p_group;
$$;

create or replace function gina.cohort_ranking_rows(p_group uuid) returns table(entry_id uuid,alias text,points numeric,maximum int,eligible boolean,reason text)
language sql stable security definer set search_path='' as $$
 with g as (select * from public.group_exams where id=p_group),
 s as (select gina.cohort_review_state(p_group) state from g where requires_review),
 rows as (select * from gina.cohort_rows(p_group))
 select e.id,e.alias,sum(rows.points),sum(rows.maximum)::int,
  bool_and(e.ranking_consent and rows.attempt_status<>'in_progress' and rows.reviewed and rows.outcome<>'unreadable' and rows.points is not null)
   and coalesce((select (state->>'published')::boolean from s),true),
  case when not e.ranking_consent then 'no_consent' when bool_or(rows.attempt_status='in_progress') then 'unfinished'
   when bool_or(rows.outcome='unreadable') then 'unreadable' when bool_or(not rows.reviewed or rows.points is null) then 'unscored'
   when exists(select 1 from s where (state->>'published')::boolean is not true) then 'results_not_published' else 'eligible' end
 from public.group_exam_entries e join rows on rows.entry_id=e.id where e.group_id=p_group group by e.id,e.alias,e.ranking_consent;
$$;

revoke all on function gina.cohort_rows(uuid),gina.cohort_ranking_rows(uuid) from public,anon,authenticated,service_role;

create or replace function gina.automatic_group_result(p_group uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;me record;topics jsonb;board jsonb;mine_eligible boolean;mine_reason text;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if e.id is null then raise exception 'not_found';end if;
 select * into g from public.group_exams where id=p_group;
 if now()<g.ends_at and g.status='published' then return jsonb_build_object('ready',false,'ends_at',g.ends_at);end if;
 select * into me from gina.group_scores(p_group) where entry_id=e.id;
 if me.entry_id is null then return jsonb_build_object('ready',true,'participated',false,'cancelled',g.status='cancelled');end if;
 select r.eligible,r.reason into mine_eligible,mine_reason from gina.cohort_ranking_rows(p_group) r where r.entry_id=e.id;
 select jsonb_agg(to_jsonb(t) order by t.topic) into topics from (
  select q.content->>'topic' topic,count(*)::int total,count(*) filter(where a.answer_key=q.content->>'correct_key')::int correct,
  count(*) filter(where a.answer_key is null)::int unanswered
  from public.group_exam_entry_questions eq join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
  left join public.exam_answers a on a.attempt_id=me.attempt_id and a.question_id=eq.question_id
  where eq.entry_id=e.id group by q.content->>'topic') t;
 if exists(select 1 from public.group_exam_questions where group_id=p_group and content->>'kind'='structured') then
  if e.ranking_consent and g.status='published' then
   select coalesce(jsonb_agg(jsonb_build_object('alias',s.alias,'points',s.points,'maximum',s.maximum,'rank',s.rank,'mine',s.entry_id=e.id) order by s.rank,s.alias),'[]') into board
   from (select r.*,rank() over(order by r.points desc) rank,row_number() over(order by r.points desc,r.alias) pos
    from gina.cohort_ranking_rows(p_group) r where r.eligible) s where s.pos<=50 or s.entry_id=e.id;
  end if;
  return (select jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled',
   'points',case when bool_and(attempt_status<>'in_progress' and reviewed) then sum(points) end,'maximum',sum(maximum),
   'attempt_id',me.attempt_id,'topics','[]'::jsonb,'ranking',coalesce(board,'[]'),'ranking_optional',true,
   'ranked',coalesce(mine_eligible,false),'ranking_reason',mine_reason,'interim',bool_or(attempt_status='in_progress'))
   from gina.cohort_rows(p_group) where entry_id=e.id);
 end if;
 if e.ranking_consent and g.status='published' then
  select coalesce(jsonb_agg(jsonb_build_object('alias',s.alias,'correct',s.correct,'total',s.total,'rank',s.rank,'mine',s.entry_id=e.id) order by s.rank,s.alias),'[]') into board
  from (select sc.*,rank() over(order by sc.correct desc) rank,row_number() over(order by sc.correct desc,sc.alias) pos
   from gina.group_scores(p_group) sc join gina.cohort_ranking_rows(p_group) el on el.entry_id=sc.entry_id where el.eligible) s where s.pos<=50 or s.entry_id=e.id;
 end if;
 return jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled','correct',me.correct,'total',me.total,'attempt_id',me.attempt_id,'topics',topics,
  'ranking',coalesce(board,'[]'),'ranking_optional',true,'ranked',coalesce(mine_eligible,false),'ranking_reason',mine_reason,
  'interim',exists(select 1 from public.exam_attempts a where a.id=me.attempt_id and a.status='in_progress'));
end;$$;

create or replace function public.admin_cohort_review_detail(p_entry uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;begin
 perform gina.assert_operation_role(array['content']);select * into e from public.group_exam_entries where id=p_entry;select * into g from public.group_exams where id=e.group_id;
 if e.review_consent_at is null or not coalesce(g.requires_review,false) then raise exception 'forbidden' using errcode='42501';end if;
 if g.ends_at>now() or exists(select 1 from public.exam_attempts where exam_id=e.exam_id and status='in_progress') then raise exception 'group_review_not_open';end if;
 return jsonb_build_object('entry',e.id,'alias',e.alias,'group',g.id,'images',(
 select coalesce(jsonb_agg(jsonb_build_object('source_id',src.source_id,'alt',src.alt,'width',asset.width,'height',asset.height,'png',replace(encode(asset.png,'base64'),E'\n',''))),'[]') from (
 select distinct l.source_id,l.alt from public.group_exam_entry_questions eq join public.learning_source_links l on l.question_id=eq.question_id where eq.entry_id=e.id
 )src join gina.library_source_copies cp on cp.source_id=src.source_id join gina.library_delivery_assets asset on asset.source_hash=cp.asset_hash), 'questions',(
 select coalesce(jsonb_agg(jsonb_build_object('ord',r.ord,'question_id',r.question_id,'question',r.content-'interaction','answer_hash',r.answer_hash,'answer_text',r.answer_text,'answer_document',r.answer_document,'answer_key',r.answer_key,
 'maximum',r.maximum,'points',r.points,'reviewed',coalesce(r.reviewed,false),'revision',r.review_revision,'outcome',r.outcome,'feedback',r.feedback,
 'criterion_points',(select criterion_points from gina.cohort_reviews where entry_id=e.id and ord=r.ord),
 'history',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'body',ev.body,'created_at',ev.created_at) order by ev.sequence),'[]') from gina.cohort_review_events ev where ev.entry_id=e.id and ev.ord=r.ord),
 'appeal',(select jsonb_build_object('revision',a.revision,'status',a.status,'reason',a.reason,'response',a.response) from gina.cohort_appeals a where entry_id=e.id and ord=r.ord),
 'images',(select coalesce(jsonb_agg(jsonb_build_object('source_id',l.source_id)),'[]') from public.learning_source_links l where l.question_id=r.question_id)
 ) order by r.ord),'[]') from gina.cohort_rows(g.id)r where r.entry_id=e.id));
end;$$;
