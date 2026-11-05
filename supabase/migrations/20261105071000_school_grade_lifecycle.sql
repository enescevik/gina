-- Recoverable correction/removal for school scores. No earned stars or exam answers are touched.
alter table public.grades add column revision integer not null default 1 check(revision>0);
alter table public.grades add column withdrawn_at timestamptz;
alter table public.grades add constraint school_grade_score_bounds check(score<=max_score) not valid;
create table gina.school_grade_changes (
 id uuid primary key default gen_random_uuid(),
 grade_id uuid not null references public.grades(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision integer not null, action text not null check(action in('create','correct','withdraw','restore')),
 before_value jsonb, after_value jsonb not null, actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),unique(grade_id,revision)
);
revoke all on gina.school_grade_changes from public,anon,authenticated,service_role;
-- Withdrawal hides the score via RLS, so a separate content-free signal must
-- remain visible to the owning parent to invalidate other devices immediately.
create table public.school_grade_sync (
 child_id uuid primary key references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 revision bigint not null default 1
);
alter table public.school_grade_sync enable row level security;
revoke all on public.school_grade_sync from public,anon,authenticated;
grant select on public.school_grade_sync to authenticated;
create policy school_grade_sync_parent on public.school_grade_sync for select to authenticated
 using(family_id=gina.family_id() and gina.is_parent());
alter publication supabase_realtime add table public.school_grade_sync;
create function gina.school_grade_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (to_jsonb(new)-array['revision','education_context']) is distinct from (to_jsonb(old)-array['revision','education_context']) then new.revision:=old.revision+1;
 else new.revision:=old.revision;end if;
 return new;
end;$$;
create trigger school_grade_revision before update on public.grades for each row execute function gina.school_grade_revision();
create function gina.school_grade_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 insert into gina.school_grade_changes(grade_id,family_id,revision,action,before_value,after_value,actor)
 values(new.id,new.family_id,new.revision,case when TG_OP='INSERT' then 'create' when old.withdrawn_at is null and new.withdrawn_at is not null then 'withdraw' when old.withdrawn_at is not null and new.withdrawn_at is null then 'restore' else 'correct' end,
 case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid());
 insert into public.school_grade_sync(child_id,family_id) values(new.child_id,new.family_id)
 on conflict(child_id) do update set revision=public.school_grade_sync.revision+1;
 return new;
end;$$;
create trigger school_grade_audit after insert or update on public.grades for each row execute function gina.school_grade_audit();
revoke all on function gina.school_grade_revision(),gina.school_grade_audit() from public,anon,authenticated,service_role;
-- Keep legacy inserts; new metadata and destructive edits are command-only.
revoke insert,update,delete on public.grades from authenticated;
grant insert(id,family_id,child_id,subject,kind,score,max_score,graded_on,note,created_at) on public.grades to authenticated;
-- Compatibility: the existing context trigger discards attempted context rewrites.
grant update(education_context) on public.grades to authenticated;
drop policy grades_parent_all on public.grades;
create policy grades_parent_read on public.grades for select to authenticated
 using(family_id=gina.family_id() and gina.is_parent() and withdrawn_at is null);
create policy grades_parent_insert on public.grades for insert to authenticated
 with check(family_id=gina.family_id() and gina.is_parent() and withdrawn_at is null and revision=1);
create policy grades_parent_context on public.grades for update to authenticated
 using(family_id=gina.family_id() and gina.is_parent() and withdrawn_at is null)
 with check(family_id=gina.family_id() and gina.is_parent() and withdrawn_at is null);

create function public.change_school_grade(p_request_id uuid,p_id uuid,p_child_id uuid,p_revision integer,p_action text,p_value jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();old public.grades;row public.grades;payload jsonb;result jsonb;
 v_subject text;v_kind public.grade_kind;v_score numeric;v_max numeric;v_date date;v_note text;date_period text;
begin
 perform gina.check_report_period(p_child_id,'all');
 if p_request_id is null or p_id is null or p_revision is null or p_revision<0 or p_action is null or p_action not in('save','withdraw','restore')
 or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'school_grade_invalid';end if;
 payload:=jsonb_build_object('action','school_grade.change','family',f,'id',p_id,'child',p_child_id,'revision',p_revision,'kind',p_action,'value',p_value);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform gina.require_active_child(p_child_id);
 perform pg_advisory_xact_lock(hashtextextended('school_grade:'||p_id::text,0));
 select * into old from public.grades where id=p_id for update;
 if found and (old.family_id<>f or old.child_id<>p_child_id) then raise exception 'forbidden' using errcode='42501';end if;
 if (old.id is null and (p_revision<>0 or p_action<>'save')) or (old.id is not null and old.revision<>p_revision) then raise exception 'school_grade_changed';end if;
 if p_action='save' then
  if old.withdrawn_at is not null then raise exception 'school_grade_withdrawn';end if;
  if exists(select 1 from jsonb_object_keys(p_value) k where k not in('subject','kind','score','max_score','graded_on','note'))
   or jsonb_typeof(p_value->'subject') is distinct from 'string' or jsonb_typeof(p_value->'kind') is distinct from 'string'
   or jsonb_typeof(p_value->'score') is distinct from 'number' or jsonb_typeof(p_value->'max_score') is distinct from 'number'
   or jsonb_typeof(p_value->'graded_on') is distinct from 'string'
   or (p_value->'note' is not null and jsonb_typeof(p_value->'note') not in('string','null'))
  then raise exception 'school_grade_invalid';end if;
  begin
   v_subject:=btrim(p_value->>'subject');v_kind:=(p_value->>'kind')::public.grade_kind;
   v_score:=(p_value->>'score')::numeric;v_max:=(p_value->>'max_score')::numeric;v_date:=(p_value->>'graded_on')::date;v_note:=nullif(btrim(p_value->>'note'),'');
  exception when others then raise exception 'school_grade_invalid';end;
  if length(v_subject) not between 1 and 100 or v_score<0 or v_score>v_max or v_max<=0 or v_max>9999
   or scale(v_score)>2 or scale(v_max)>2 or length(v_note)>2000 or v_date::text<>p_value->>'graded_on'
   or v_date>(select (now() at time zone timezone)::date from public.families where id=f)
  then raise exception 'school_grade_invalid';end if;
  if old.id is null then
   insert into public.grades(id,family_id,child_id,subject,kind,score,max_score,graded_on,note)
   values(p_id,f,p_child_id,v_subject,v_kind,v_score,v_max,v_date,v_note) returning * into row;
  else
   if old.education_context->>'period_id' is not null and v_date<>old.graded_on then
    select id::text into date_period from gina.child_education_periods where child_id=p_child_id and starts_on<=v_date and (ends_on is null or v_date<ends_on);
    if date_period is distinct from old.education_context->>'period_id' then raise exception 'school_grade_period_change';end if;
   end if;
   update public.grades set subject=v_subject,kind=v_kind,score=v_score,max_score=v_max,graded_on=v_date,note=v_note where id=p_id returning * into row;
  end if;
 else
  if p_value<>'{}'::jsonb or (p_action='withdraw' and old.withdrawn_at is not null) or (p_action='restore' and old.withdrawn_at is null)
  then raise exception 'school_grade_changed';end if;
  update public.grades set withdrawn_at=case when p_action='withdraw' then now() else null end where id=p_id returning * into row;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'withdrawn_at',row.withdrawn_at);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;

create function public.school_grade_history(p_id uuid,p_before_revision integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ch uuid;result jsonb;
begin
 select child_id into ch from public.grades where id=p_id and family_id=gina.family_id();
 perform gina.check_report_period(ch,'all');
 if p_before_revision is not null and p_before_revision<1 then raise exception 'invalid_cursor';end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from (
 select revision,action,before_value,after_value,created_at from gina.school_grade_changes
 where grade_id=p_id and family_id=gina.family_id() and (p_before_revision is null or revision<p_before_revision)
 order by revision desc limit 21) v;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=20),'[]'),'has_more',jsonb_array_length(result)>20);
end;$$;
revoke all on function public.change_school_grade(uuid,uuid,uuid,integer,text,jsonb),public.school_grade_history(uuid,integer) from public,anon,service_role;
grant execute on function public.change_school_grade(uuid,uuid,uuid,integer,text,jsonb),public.school_grade_history(uuid,integer) to authenticated;
create or replace function public.list_school_grades(p_child_id uuid,p_period text default 'all',p_before_date date default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform gina.check_report_period(p_child_id,p_period);
 if (p_before_date is null) <> (p_before_id is null) then raise exception 'invalid_cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(g) order by graded_on desc,id desc),'[]') into result from (
  select id,subject,kind,score,max_score,graded_on,note,education_context
  from public.grades where child_id=p_child_id and family_id=gina.family_id() and withdrawn_at is null
   and (p_period='all' or (p_period='unknown' and education_context->>'period_id' is null) or education_context->>'period_id'=p_period)
   and (p_before_id is null or (graded_on,id)<(p_before_date,p_before_id))
  order by graded_on desc,id desc limit 51
 ) g;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=50),'[]'),
  'has_more',jsonb_array_length(result)>50);
end;$$;
create function public.school_grade_records(p_child_id uuid,p_period text default 'all',p_before_date date default null,p_before_id uuid default null,p_withdrawn boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform gina.check_report_period(p_child_id,p_period);
 if p_withdrawn is null then raise exception 'school_grade_invalid';end if;
 if (p_before_date is null) <> (p_before_id is null) then raise exception 'invalid_cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(g) order by graded_on desc,id desc),'[]') into result from (
  select id,subject,kind,score,max_score,graded_on,note,education_context,revision,withdrawn_at
  from public.grades where child_id=p_child_id and family_id=gina.family_id() and (withdrawn_at is not null)=p_withdrawn
   and (p_period='all' or (p_period='unknown' and education_context->>'period_id' is null) or education_context->>'period_id'=p_period)
   and (p_before_id is null or (graded_on,id)<(p_before_date,p_before_id))
  order by graded_on desc,id desc limit 51
 ) g;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=50),'[]'),
  'has_more',jsonb_array_length(result)>50);
end;$$;
revoke all on function public.school_grade_records(uuid,text,date,uuid,boolean) from public,anon,service_role;
grant execute on function public.school_grade_records(uuid,text,date,uuid,boolean) to authenticated;

create or replace function public.get_shared_child_view(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_share public.child_shares%rowtype;
  v_child record;
  v_tz text;
  v_result jsonb;
begin
  -- Biçim kontrolü sorgudan önce; özet her durumda hesaplanır (zamanlama farkı küçük kalsın).
  if p_token is not null and p_token ~ '^[A-Za-z0-9_-]{43}$' then
    select * into v_share from public.child_shares s
     where s.token_hash = extensions.digest(p_token, 'sha256')
       and s.revoked_at is null
       and s.expires_at > now();
  else
    perform extensions.digest(coalesce(p_token, ''), 'sha256');
  end if;

  if v_share.id is null then
    perform pg_sleep(0.15 + random() * 0.1);
    raise exception 'invalid_share' using errcode = 'P0001';
  end if;

  update public.child_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_share.id;

  select split_part(btrim(c.name), ' ', 1) as first_name, c.grade into v_child
    from public.children c where c.id = v_share.child_id;
  select f.timezone into v_tz from public.families f where f.id = v_share.family_id;

  v_result := jsonb_build_object(
    'child', jsonb_build_object('first_name', v_child.first_name, 'grade', v_child.grade),
    'label', v_share.label,
    'scopes', to_jsonb(v_share.scopes),
    'expires_at', v_share.expires_at,
    'generated_at', now()
  );

  if 'grades' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('grades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'subject', g.subject, 'score', g.score, 'max_score', g.max_score, 'date', g.graded_on)
             order by g.graded_on desc, g.created_at desc)
        from (select * from public.grades
               where child_id = v_share.child_id and withdrawn_at is null
               order by graded_on desc, created_at desc
               limit 100) g
    ), '[]'::jsonb));
  end if;

  if 'prova' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('prova', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', a.title, 'subject', a.subject, 'date', a.finished_on,
               'mc_correct', a.mc_correct, 'mc_total', a.mc_total, 'topics', a.topics)
             order by a.finished_at desc)
        from (
          select e.title, e.subject, at.finished_at,
                 (at.finished_at at time zone coalesce(v_tz, 'Europe/Istanbul'))::date as finished_on,
                 at.mc_correct, at.mc_total,
                 coalesce((
                   select jsonb_agg(jsonb_build_object('topic', t.topic, 'correct', t.correct, 'total', t.total) order by t.topic)
                     from (
                       select q.topic,
                              count(*) filter (where ans.is_correct)::int as correct,
                              count(*)::int as total
                         from public.exam_answers ans
                         join public.question_bank q on q.id = ans.question_id
                        where ans.attempt_id = at.id and q.kind = 'multiple_choice'
                        group by q.topic
                     ) t
                 ), '[]'::jsonb) as topics
            from public.exam_attempts at
            join public.exams e on e.id = at.exam_id
           where at.child_id = v_share.child_id
             and at.status in ('submitted', 'graded')
             and at.finished_at is not null
           order by at.finished_at desc
           limit 30
        ) a
    ), '[]'::jsonb));
  end if;

  if 'tasks_summary' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('tasks_summary', (
      select jsonb_build_object(
               'days', 30,
               'completed', count(*) filter (where tc.status in ('done', 'approved'))::int,
               'approved', count(*) filter (where tc.status = 'approved')::int,
               'returned', count(*) filter (where tc.status = 'returned')::int)
        from public.task_completions tc
       where tc.child_id = v_share.child_id
         and tc.due_date > (now() at time zone coalesce(v_tz, 'Europe/Istanbul'))::date - 30
    ));
  end if;

  return v_result;
end;
$$;

revoke execute on function public.get_shared_child_view(text) from public;
grant execute on function public.get_shared_child_view(text) to anon, authenticated;
