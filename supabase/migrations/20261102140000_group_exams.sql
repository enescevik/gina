-- Opt-in practice cohorts. These are not proctored exams or official school rankings.
insert into public.app_settings(key,value) values('cohorts.enabled','false') on conflict do nothing;
alter table public.plans add column cohort_monthly int not null default 0 check(cohort_monthly between 0 and 100);
update public.plans set cohort_monthly=case code when 'plus' then 1 when 'pro' then 4 else 0 end;
create table public.group_exams (
 id uuid primary key,title text not null check(length(trim(title)) between 3 and 160),
 collection_id uuid not null references public.library_collections(id),grade int not null,subject text not null,curriculum_version text not null,
 creation_intent jsonb not null,version_hash text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 duration_minutes smallint not null check(duration_minutes between 5 and 120),
 plans public.plan_code[] not null,status text not null default 'published' check(status in('published','cancelled')),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '31 days')
);
create table public.group_exam_questions (
 group_id uuid not null references public.group_exams(id) on delete cascade,ord int not null,content jsonb not null,
 primary key(group_id,ord)
);
create table public.group_exam_entries (
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.group_exams(id),
 family_id uuid not null references public.families(id) on delete cascade,child_id uuid not null references public.children(id) on delete cascade,
 exam_id uuid not null unique references public.exams(id) on delete cascade,
 alias text not null,ranking_consent boolean not null default false,consent_version text not null,
 enrolled_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 unique(group_id,child_id),unique(group_id,alias)
);
create index on public.group_exam_entries(family_id,created_at);
create table public.group_exam_entry_questions (
 entry_id uuid not null references public.group_exam_entries(id) on delete cascade,
 question_id uuid not null unique references public.question_bank(id) on delete cascade,ord int not null,
 primary key(entry_id,ord)
);
do $$declare t text;begin foreach t in array array['group_exams','group_exam_questions','group_exam_entries','group_exam_entry_questions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end;$$;
create function public.admin_create_group_exam(p_id uuid,p_collection uuid,p_title text,p_items uuid[],p_start timestamptz,p_end timestamptz,p_minutes int,p_plans public.plan_code[])
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.library_collections;payload jsonb;items jsonb;h text;
begin
 perform gina.assert_admin();
 if p_id is null or p_items is null or cardinality(p_items) not between 3 and 50 or array_position(p_items,null) is not null
 or cardinality(p_items)<>(select count(distinct x) from unnest(p_items)x) or coalesce(cardinality(p_plans),0)=0 or array_position(p_plans,null) is not null then raise exception 'group_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,44));
 payload:=jsonb_build_object('collection',p_collection,'title',p_title,'items',p_items,'start',p_start,'end',p_end,'minutes',p_minutes,'plans',p_plans);
 -- Admin receipts cannot use mutation_receipts (it requires a family). Store immutable intent in the group.
 if exists(select 1 from public.group_exams where id=p_id) then
  if not exists(select 1 from public.group_exams where id=p_id and created_by=auth.uid() and creation_intent=payload) then raise exception 'request_conflict';end if;
  return p_id;
 end if;
 select * into c from public.library_collections where id=p_collection and status='published' for share;
 if c.id is null or trim(c.curriculum_version)='' then raise exception 'group_collection_required';end if;
 select jsonb_agg(i.content order by u.ord) into items from unnest(p_items) with ordinality u(id,ord)
 join public.library_items i on i.id=u.id and i.collection_id=c.id and i.status='published' and i.content->>'kind'='multiple_choice';
 if coalesce(jsonb_array_length(items),0)<>cardinality(p_items) then raise exception 'group_questions_required';end if;
 if p_start is null or p_end is null or p_end<=now() then raise exception 'group_invalid';end if;
 h:=encode(extensions.digest(items::text,'sha256'),'hex');
 insert into public.group_exams(id,title,collection_id,grade,subject,curriculum_version,version_hash,starts_at,ends_at,duration_minutes,plans,created_by,creation_intent)
 values(p_id,trim(p_title),c.id,c.grade,c.subject,c.curriculum_version,h,p_start,p_end,p_minutes,p_plans,auth.uid(),payload);
 insert into public.group_exam_questions(group_id,ord,content) select p_id,ord,value from jsonb_array_elements(items) with ordinality x(value,ord);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'group_exam_create','group_exams',p_id::text,'Frozen published library question set');
 return p_id;
end;$$;
create function public.admin_group_exams() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform gina.assert_admin();return jsonb_build_object('groups',(
 select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('participants',(select count(*) from public.group_exam_entries where group_id=g.id)) order by g.created_at desc),'[]') from public.group_exams g),
 'enabled',(select value from public.app_settings where key='cohorts.enabled'),
 'quotas',(select jsonb_agg(jsonb_build_object('plan',code,'monthly',cohort_monthly)) from public.plans));end;$$;
create function public.admin_group_policy(p_enabled boolean,p_limits jsonb) returns void language plpgsql security definer set search_path='' as $$
begin perform gina.assert_admin();
 if p_enabled is null or jsonb_typeof(p_limits) is distinct from 'object' or not(p_limits ?& array['free','plus','pro'])
 or (select count(*) from jsonb_object_keys(p_limits))<>3 then raise exception 'invalid_input';end if;
 update public.plans set cohort_monthly=(p_limits->>code::text)::int;
 update public.app_settings set value=to_jsonb(p_enabled) where key='cohorts.enabled';
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'group_policy','app_settings','cohorts.enabled','enabled='||p_enabled||', limits='||p_limits::text);
end;$$;
create function public.admin_cancel_group_exam(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin perform gina.assert_admin();if length(trim(coalesce(p_reason,'')))<10 then raise exception 'reason_required';end if;
 update public.group_exams set status='cancelled' where id=p_id and status<>'cancelled';
 if found then insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'group_cancelled','group_exams',p_id::text,p_reason);end if;
end;$$;
create function public.enroll_group_exam(p_group uuid,p_child uuid,p_ranking boolean,p_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();g public.group_exams;e public.group_exam_entries;pl public.plans;ids uuid[]:=array[]::uuid[];qid uuid;x record;eid uuid:=gen_random_uuid();entry_id uuid:=gen_random_uuid();
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
 for x in select * from public.group_exam_questions where group_id=g.id order by ord loop
  qid:=gen_random_uuid();ids:=array_append(ids,qid);
  insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,solution,created_by,provenance)
  values(qid,f,g.grade,g.subject,x.content->>'topic','multiple_choice',(x.content->>'difficulty')::public.question_difficulty,x.content->>'stem',x.content->'choices',x.content->>'correct_key',x.content->>'solution',auth.uid(),jsonb_build_object('group',g.id,'version',g.version_hash));
 end loop;
 insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,timed,duration_minutes,status,created_by)
 values(eid,f,p_child,g.title,g.subject,g.grade,ids,true,g.duration_minutes,'assigned',auth.uid());
 insert into public.group_exam_entries(id,group_id,family_id,child_id,exam_id,alias,ranking_consent,consent_version,enrolled_by)
 values(entry_id,g.id,f,p_child,eid,'Kâşif '||left(entry_id::text,8),p_ranking,'group-practice-v1',auth.uid());
 insert into public.group_exam_entry_questions(entry_id,question_id,ord) select entry_id,q,ord from unnest(ids) with ordinality x(q,ord);
 return eid;
end;$$;
create function public.set_group_ranking_consent(p_group uuid,p_child uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare entry public.group_exam_entries;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_enabled is null then raise exception 'invalid_input';end if;
 select * into entry from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id() for update;
 if not found then raise exception 'not_found';end if;
 if entry.ranking_consent=p_enabled then return;end if;
 update public.group_exam_entries set ranking_consent=p_enabled where id=entry.id;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details)
 values(auth.uid(),'group_ranking_consent','group_exam_entries',entry.id::text,entry.family_id,'Parent changed optional ranking consent',jsonb_build_object('enabled',p_enabled,'version',entry.consent_version));
end;$$;
create function public.get_group_exams() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();pl public.plans;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 pl:=gina.family_plan_of(f);
 return jsonb_build_object('enabled',(select value from public.app_settings where key='cohorts.enabled'),
 'monthly',pl.cohort_monthly,'used',(select count(*) from public.group_exam_entries e join public.group_exams g on g.id=e.group_id where e.family_id=f and e.created_at>=gina.family_month_start(f) and g.status<>'cancelled'),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'subject',g.subject,'grade',g.grade,'curriculum',g.curriculum_version,'version',left(g.version_hash,10),'starts_at',g.starts_at,'ends_at',g.ends_at,'minutes',g.duration_minutes,'status',g.status,'included',pl.code=any(g.plans),'questions',(select count(*) from public.group_exam_questions where group_id=g.id)) order by g.starts_at desc),'[]')
 from public.group_exams g where (g.status='published' and g.ends_at>now()-interval '90 days') or exists(select 1 from public.group_exam_entries where group_id=g.id and family_id=f)),
 'entries',(select coalesce(jsonb_agg(jsonb_build_object('group_id',group_id,'child_id',child_id,'exam_id',exam_id,'alias',alias,'ranking',ranking_consent)),'[]') from public.group_exam_entries where family_id=f));
end;$$;
create function gina.guard_group_exam() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_exam_entries where exam_id=old.id) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if not exists(select 1 from public.families where id=old.family_id) or not exists(select 1 from public.children where id=old.child_id) then return old;end if;
 if tg_op='DELETE' then raise exception 'group_exam_locked';end if;
 if (new.family_id,new.child_id,new.question_ids,new.grade,new.subject,new.timed,new.duration_minutes,new.kind,new.blueprint_id)
 is distinct from(old.family_id,old.child_id,old.question_ids,old.grade,old.subject,old.timed,old.duration_minutes,old.kind,old.blueprint_id) then raise exception 'group_exam_locked';end if;
 if new.status<>old.status and not(new.status='completed' and exists(select 1 from public.exam_attempts where exam_id=old.id and status<>'in_progress')) then raise exception 'group_exam_locked';end if;
 return new;
end;$$;
create trigger group_exam_frozen before update or delete on public.exams for each row execute function gina.guard_group_exam();
create function gina.guard_group_question() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_exam_entry_questions where question_id=old.id) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if not exists(select 1 from public.families where id=old.family_id) then return old;end if;
 if tg_op='DELETE' then raise exception 'group_exam_locked';end if;
 if (new.family_id,new.grade,new.subject,new.topic,new.kind,new.stem,new.choices,new.correct_key,new.expected_answer,new.solution,new.explanation)
 is distinct from(old.family_id,old.grade,old.subject,old.topic,old.kind,old.stem,old.choices,old.correct_key,old.expected_answer,old.solution,old.explanation) then raise exception 'group_exam_locked';end if;
 return new;
end;$$;
create trigger group_question_frozen before update or delete on public.question_bank for each row execute function gina.guard_group_question();
create function gina.guard_group_attempt() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.group_exams;
begin
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=new.exam_id;
 if g.id is null then return new;end if;
 if tg_op='INSERT' then
  if g.status<>'published' or now()<g.starts_at or now()>=g.ends_at then raise exception 'group_not_open';end if;
  if exists(select 1 from public.exam_attempts where exam_id=new.exam_id) then raise exception 'group_one_attempt';end if;
  new.started_at:=now();new.deadline_at:=least(now()+make_interval(mins=>g.duration_minutes),g.ends_at);
 elsif(new.exam_id,new.child_id,new.family_id,new.started_at,new.deadline_at) is distinct from(old.exam_id,old.child_id,old.family_id,old.started_at,old.deadline_at) then raise exception 'group_exam_locked';
 end if;
 return new;
end;$$;
create trigger group_attempt_window before insert or update on public.exam_attempts for each row execute function gina.guard_group_attempt();
create function gina.guard_group_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.exam_attempts;g public.group_exams;key text;
begin
 select * into a from public.exam_attempts where id=new.attempt_id;
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=a.exam_id;
 if g.id is null then return new;end if;
 if tg_op='INSERT' or (new.answer_key,new.answer_text,new.question_id,new.attempt_id) is distinct from(old.answer_key,old.answer_text,old.question_id,old.attempt_id) then
  if g.status<>'published' or a.status<>'in_progress' or now()>a.deadline_at or now()>=g.ends_at then raise exception 'group_answer_closed';end if;
  if new.answer_key is not null and new.answer_key not in('A','B','C','D') then raise exception 'invalid_input';end if;
 end if;
 select q.content->>'correct_key' into key from public.group_exam_entries e join public.group_exam_entry_questions eq on eq.entry_id=e.id
 join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord where e.exam_id=a.exam_id and eq.question_id=new.question_id;
 if key is null then raise exception 'question_not_in_exam';end if;
 new.is_correct:=coalesce(new.answer_key=key,false);
 return new;
end;$$;
create trigger group_answer_frozen before insert or update on public.exam_answers for each row execute function gina.guard_group_answer();

-- Private scores use frozen question keys, never editable parent/AI feedback.
create function gina.group_scores(p_group uuid)
returns table(entry_id uuid,child_id uuid,family_id uuid,alias text,ranking boolean,correct int,total int,attempt_id uuid)
language sql stable security definer set search_path='' as $$
 select e.id,e.child_id,e.family_id,e.alias,e.ranking_consent,
 count(*) filter(where ans.answer_key=q.content->>'correct_key')::int,count(*)::int,a.id
 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 join public.group_exam_entry_questions eq on eq.entry_id=e.id join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
 left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=eq.question_id
 where e.group_id=p_group group by e.id,a.id;
$$;
create function public.get_group_result(p_group uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;me record;topics jsonb;board jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if e.id is null then raise exception 'not_found';end if;
 select * into g from public.group_exams where id=p_group;
 if now()<g.ends_at and g.status='published' then return jsonb_build_object('ready',false,'ends_at',g.ends_at);end if;
 select * into me from gina.group_scores(p_group) where entry_id=e.id;
 if me.entry_id is null then return jsonb_build_object('ready',true,'participated',false,'cancelled',g.status='cancelled');end if;
 select jsonb_agg(to_jsonb(t) order by t.topic) into topics from (
  select q.content->>'topic' topic,count(*)::int total,count(*) filter(where a.answer_key=q.content->>'correct_key')::int correct,
  count(*) filter(where a.answer_key is null)::int unanswered
  from public.group_exam_entry_questions eq join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
  left join public.exam_answers a on a.attempt_id=me.attempt_id and a.question_id=eq.question_id
  where eq.entry_id=e.id group by q.content->>'topic') t;
 if e.ranking_consent and g.status='published' then
  select coalesce(jsonb_agg(jsonb_build_object('alias',s.alias,'correct',s.correct,'total',s.total,'rank',s.rank,'mine',s.entry_id=e.id) order by s.rank,s.alias),'[]') into board
  from (select *,rank() over(order by correct desc) rank,row_number() over(order by correct desc,alias) pos from gina.group_scores(p_group) where ranking) s where s.pos<=50 or s.entry_id=e.id;
 end if;
 return jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled','correct',me.correct,'total',me.total,'attempt_id',me.attempt_id,'topics',topics,'ranking',coalesce(board,'[]'));
end;$$;
-- Close abandoned attempts once the window ends; existing exam-finished notifications
-- target only the family's parent recipients. No score/topic is put on the lock screen.
create function public.settle_group_attempts() returns int language plpgsql security definer set search_path='' as $$
declare a record;n int:=0;
begin
 if auth.role()<>'service_role' and current_user not in('postgres','supabase_admin') then raise exception 'forbidden' using errcode='42501';end if;
 for a in select at.id,at.exam_id,at.deadline_at from public.exam_attempts at join public.group_exam_entries e on e.exam_id=at.exam_id
 join public.group_exams g on g.id=e.group_id where at.status='in_progress' and (at.deadline_at<=now() or g.status='cancelled') limit 200 for update of at skip locked loop
  update public.exam_attempts set status='submitted',finished_at=least(now(),a.deadline_at),
   mc_total=(select count(*) from public.group_exam_entry_questions q join public.group_exam_entries e on e.id=q.entry_id where e.exam_id=a.exam_id),
   mc_correct=(select count(*) from public.exam_answers where attempt_id=a.id and is_correct) where id=a.id;
  update public.exams set status='completed' where id=a.exam_id;n:=n+1;
 end loop;return n;
end;$$;
revoke all on function gina.guard_group_exam(),gina.guard_group_question(),gina.guard_group_attempt(),gina.guard_group_answer(),gina.group_scores(uuid),public.settle_group_attempts() from public,anon,authenticated;
grant execute on function public.settle_group_attempts() to service_role;
revoke all on function public.admin_create_group_exam(uuid,uuid,text,uuid[],timestamptz,timestamptz,int,public.plan_code[]),public.admin_group_exams(),public.admin_group_policy(boolean,jsonb),public.admin_cancel_group_exam(uuid,text),public.enroll_group_exam(uuid,uuid,boolean,boolean),public.set_group_ranking_consent(uuid,uuid,boolean),public.get_group_exams(),public.get_group_result(uuid,uuid) from public,anon;
grant execute on function public.admin_create_group_exam(uuid,uuid,text,uuid[],timestamptz,timestamptz,int,public.plan_code[]),public.admin_group_exams(),public.admin_group_policy(boolean,jsonb),public.admin_cancel_group_exam(uuid,text),public.enroll_group_exam(uuid,uuid,boolean,boolean),public.set_group_ranking_consent(uuid,uuid,boolean),public.get_group_exams(),public.get_group_result(uuid,uuid) to authenticated;
do $$begin perform cron.schedule('settle-group-attempts','*/5 * * * *','select public.settle_group_attempts()');exception when invalid_schema_name or undefined_function then raise notice 'group settlement cron must be provisioned';end;$$;
