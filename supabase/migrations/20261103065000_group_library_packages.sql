-- Reviewed, published package units may be frozen into a cohort. Shared sources
-- are indivisible; automatic ranking still accepts multiple-choice questions only.
alter table public.group_exams alter column collection_id drop not null;
alter table public.group_exams add column package_id uuid references gina.library_import_packages(id);
alter table public.group_exams add constraint group_one_source check ((collection_id is null) <> (package_id is null));

create function public.admin_group_package_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',r.title,'grade',p.grade,'subject',p.subject,'version',r.version,
  'curriculum',r.curriculum_label,'plans',r.plans,'units',(
   select coalesce(jsonb_agg(jsonb_build_object('key',u.key,'title',u.title,'count',u.n,'eligible',u.eligible,'has_media',u.has_media) order by u.pos),'[]') from (
    select case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end key,
    coalesce(s.title,min(q.student->>'topic')) title,count(*) n,min(q.position) pos,
    bool_and(q.student->>'kind'='multiple_choice') and count(*)<=12 eligible,bool_or(s.asset_hash is not null) has_media
    from gina.library_import_questions q left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
    where q.package_id=p.id group by 1,s.title)u)) order by r.updated_at desc),'[]')
  from gina.library_import_packages p join gina.library_publications r on r.package_id=p.id cross join lateral gina.library_publication_checks(p.id)c
  where r.status='published' and r.review_fingerprint=c->>'review_fingerprint' and c->>'question_count'=c->>'suitable_count' and (c->>'missing_media')::int=0);
end;$$;

create function public.admin_create_package_group_exam(p_id uuid,p_package_id uuid,p_publication_version int,p_title text,p_units text[],p_start timestamptz,p_end timestamptz,p_minutes int,p_plans public.plan_code[])
returns uuid language plpgsql security definer set search_path='' as $$
declare p gina.library_import_packages;r gina.library_publications;payload jsonb;c jsonb;items jsonb;k text;keys text[];
begin
 perform gina.assert_admin();
 if p_id is null or p_package_id is null or p_publication_version is null or p_units is null or cardinality(p_units) not between 1 and 50
 or array_position(p_units,null) is not null or cardinality(p_units)<>(select count(distinct x) from unnest(p_units)x)
 or p_start is null or p_end is null or p_minutes is null or p_minutes not between 5 and 120
 or coalesce(length(trim(p_title)),0) not between 3 and 160 or coalesce(cardinality(p_plans),0)=0 or array_position(p_plans,null) is not null then raise exception 'group_invalid';end if;
 select array_agg(v order by v) into keys from unnest(p_units)v;
 payload:=jsonb_build_object('package',p_package_id,'version',p_publication_version,'title',trim(p_title),'units',keys,'start',p_start,'end',p_end,'minutes',p_minutes,'plans',p_plans);
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
  'correct_key',a.teacher->>'correct_key','solution',a.teacher->>'solution','explanation',a.teacher->>'explanation','question_key',q.question_key,
  'group_source',case when s.source_key is null then null else jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt,'asset_hash',s.asset_hash) end) order by q.position) into items
 from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key
 left join gina.library_import_sources s on s.package_id=q.package_id and s.source_key=q.source_key
 where q.package_id=p_package_id and (case when q.source_key is null then 'question:'||q.question_key else 'source:'||q.source_key end)=any(keys);
 if coalesce(jsonb_array_length(items),0) not between 3 and 50 or exists(select 1 from jsonb_array_elements(items)x where x->>'kind'<>'multiple_choice') then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x->'group_source' is not null and (length(x#>>'{group_source,body}')>6000 or length(x#>>'{group_source,title}')>160)) then raise exception 'group_questions_required';end if;
 if exists(select 1 from jsonb_array_elements(items)x where x#>>'{group_source,key}' is not null group by x#>>'{group_source,key}' having count(*)>12) then raise exception 'group_questions_required';end if;
 if p_end<=now() or p_end<=p_start or p_end>p_start+interval '31 days' then raise exception 'group_invalid';end if;
 insert into public.group_exams(id,title,package_id,grade,subject,curriculum_version,version_hash,starts_at,ends_at,duration_minutes,plans,created_by,creation_intent)
 values(p_id,trim(p_title),p.id,p.grade,p.subject,r.curriculum_label,encode(extensions.digest(items::text,'sha256'),'hex'),p_start,p_end,p_minutes,p_plans,auth.uid(),payload);
 insert into public.group_exam_questions(group_id,ord,content) select p_id,ord,value from jsonb_array_elements(items) with ordinality x(value,ord);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details) values(auth.uid(),'group_exam_create','group_exams',p_id::text,'Frozen reviewed package units',jsonb_build_object('package',p.id,'publication_version',r.version,'units',keys));
 return p_id;
end;$$;
revoke all on function public.admin_group_package_catalog(),public.admin_create_package_group_exam(uuid,uuid,int,text,text[],timestamptz,timestamptz,int,public.plan_code[]) from public,anon,service_role;
grant execute on function public.admin_group_package_catalog(),public.admin_create_package_group_exam(uuid,uuid,int,text,text[],timestamptz,timestamptz,int,public.plan_code[]) to authenticated;

create or replace function public.enroll_group_exam(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean)
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
  insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,solution,explanation,created_by,provenance)
  values(qid,f,g.grade,g.subject,x.content->>'topic','multiple_choice',(x.content->>'difficulty')::public.question_difficulty,
   case when src_key is null then x.content->>'stem' else (src->>'title')||E'\n'||(src->>'body')||E'\n\n'||(x.content->>'stem') end,
   x.content->'choices',x.content->>'correct_key',x.content->>'solution',x.content->>'explanation',auth.uid(),jsonb_build_object('group',g.id,'version',g.version_hash,'package',g.package_id));
  if media_id is not null then insert into public.learning_source_links(source_id,question_id,alt) values(media_id,qid,src->>'alt');end if;
  if context_id is not null then insert into public.question_source_members(group_id,question_id,position,prompt) values(context_id,qid,pos,x.content->>'stem');end if;
 end loop;
 for k in select value from jsonb_each_text(contexts) loop
  update public.question_source_groups set finalized_at=now() where id=k::uuid;
 end loop;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by)
 values(eid,f,p_child,g.title,g.subject,g.grade,ids,true,g.duration_minutes,'assigned',auth.uid());
 insert into public.group_exam_entries(id,group_id,family_id,child_id,exam_id,alias,ranking_consent,consent_version,enrolled_by)
 values(entry_id,g.id,f,p_child,eid,'Kâşif '||left(entry_id::text,8),p_ranking,'group-practice-v1',auth.uid());
 insert into public.group_exam_entry_questions(entry_id,question_id,ord) select entry_id,q,ord from unnest(ids) with ordinality x(q,ord);
 return eid;
end;$$;
