-- F2b: parent instruction, deliberately independent from question liking.
create table public.question_focus (
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 primary key(child_id,question_id)
);
alter table public.question_focus enable row level security;
revoke all on public.question_focus from public,anon,authenticated;
grant select on public.question_focus to authenticated;
create policy question_focus_parent_read on public.question_focus for select to authenticated
 using ((select gina.is_parent()) and family_id=(select gina.family_id()));
create index question_focus_family_child on public.question_focus(family_id,child_id,expires_at);
create function public.set_question_focus(p_child_id uuid,p_question_id uuid,p_selected boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_selected is null then raise exception 'invalid_input' using errcode='22023'; end if;
 if not exists(select 1 from public.children where id=p_child_id and family_id=f and archived_at is null)
 or not exists(select 1 from public.question_bank q join public.children c on c.id=p_child_id and c.grade=q.grade where q.id=p_question_id and q.family_id=f and c.family_id=f) then
  raise exception 'forbidden' using errcode='42501'; end if;
 if not p_selected then
  delete from public.question_focus where family_id=f and child_id=p_child_id and question_id=p_question_id;
 else
  -- The same selected=true retry does not extend an active period. Re-enable after expiry starts a new week.
  insert into public.question_focus(family_id,child_id,question_id,created_by,expires_at)
  values(f,p_child_id,p_question_id,auth.uid(),now()+interval '7 days')
  on conflict(child_id,question_id) do update set
   expires_at=case when question_focus.expires_at<=now() then excluded.expires_at else question_focus.expires_at end;
 end if;
end; $$;
revoke all on function public.set_question_focus(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_question_focus(uuid,uuid,boolean) to authenticated;

create table public.reinforcement_snoozes (
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 scope_key text not null check(length(scope_key) between 1 and 240),
 until_at timestamptz not null,
 primary key(child_id,scope_key)
);
alter table public.reinforcement_snoozes enable row level security;
revoke all on public.reinforcement_snoozes from public,anon,authenticated;
grant select on public.reinforcement_snoozes to authenticated;
create policy reinforcement_snoozes_parent_read on public.reinforcement_snoozes for select to authenticated
 using ((select gina.is_parent()) and family_id=(select gina.family_id()));
-- Canonical outcomes are source-bound. Without one, use question identity, never guess a MEB outcome from a topic.
create function gina.reinforcement_scope(p_question public.question_bank) returns text
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p_question.provenance->'outcome_ids')='array'
 and jsonb_array_length(case when jsonb_typeof(p_question.provenance->'outcome_ids')='array' then p_question.provenance->'outcome_ids' else '[]'::jsonb end)>0
 then left(p_question.grade::text||':'||p_question.subject||':'||coalesce(p_question.provenance->>'curriculum_version','unspecified')||':'||((p_question.provenance->'outcome_ids')->>0),240)
 else 'question:'||p_question.id::text end
$$;
revoke all on function gina.reinforcement_scope(public.question_bank) from public,anon,authenticated;
create function public.snooze_reinforcement(p_child_id uuid,p_question_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.question_bank;f uuid:=gina.family_id();
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into q from public.question_bank where id=p_question_id and family_id=f;
 if q.id is null or not exists(select 1 from public.children where id=p_child_id and family_id=f) then
 raise exception 'forbidden' using errcode='42501';end if;
 insert into public.reinforcement_snoozes values(f,p_child_id,gina.reinforcement_scope(q),now()+interval '7 days')
 on conflict(child_id,scope_key) do update set until_at=excluded.until_at;
end;$$;
revoke all on function public.snooze_reinforcement(uuid,uuid) from public,anon;
grant execute on function public.snooze_reinforcement(uuid,uuid) to authenticated;
create function public.get_reinforcement_suggestions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((with candidates as (
 select a.child_id,q.id as question_id,a.id as attempt_id,a.started_at as stamp,'struggled'::text as reason
 from public.question_child_signals s join public.exam_attempts a on a.id=s.attempt_id
 join public.question_bank q on q.id=s.question_id
 where s.family_id=gina.family_id() and a.family_id=gina.family_id() and s.struggled and a.status in ('submitted','graded')
 union all
 select f.child_id,f.question_id,null::uuid,f.expires_at,'focus'::text from public.question_focus f
 where f.family_id=gina.family_id() and f.expires_at>now()
 )select jsonb_agg(x) from (
 select distinct on(c.id,gina.reinforcement_scope(q)) c.id as child_id,c.name as child_name,
 q.id as question_id,q.subject,q.topic,q.stem,a.attempt_id,a.reason,
 case when gina.reinforcement_scope(q) like 'question:%' then false else true end as outcome_known
 from candidates a join public.children c on c.id=a.child_id join public.question_bank q on q.id=a.question_id
 where c.family_id=gina.family_id() and q.family_id=gina.family_id() and c.archived_at is null
 and not exists(select 1 from public.reinforcement_snoozes z where z.family_id=gina.family_id()
 and z.child_id=c.id and z.scope_key=gina.reinforcement_scope(q) and z.until_at>now())
 order by c.id,gina.reinforcement_scope(q),a.stamp desc limit 20
 )x),'[]'::jsonb);
end;$$;
revoke all on function public.get_reinforcement_suggestions() from public,anon;
grant execute on function public.get_reinforcement_suggestions() to authenticated;
-- Reuse already-acquired family questions; no library credit or paid AI call is made here.
create function public.get_reinforcement_questions(p_child_id uuid,p_question_id uuid) returns uuid[]
language plpgsql stable security definer set search_path='' as $$
declare q public.question_bank;f uuid:=gina.family_id();ids uuid[];
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into q from public.question_bank where id=p_question_id and family_id=f;
 if q.id is null or not exists(select 1 from public.children where id=p_child_id and family_id=f and archived_at is null and grade=q.grade) then
 raise exception 'forbidden' using errcode='42501';end if;
 -- Without verified outcome labels do not guess equivalence from topic text.
 if gina.reinforcement_scope(q) like 'question:%' then return array[]::uuid[];end if;
 select array_agg(x.id order by x.rank,x.created_at,x.id) into ids from (
 select other.id,other.created_at,case other.difficulty when 'kolay' then 0 when 'orta' then 1 when 'orta_ustu' then 2 else 3 end as rank
 from public.question_bank other where other.family_id=f and other.grade=q.grade and other.subject=q.subject
 and other.id<>q.id and gina.reinforcement_scope(other)=gina.reinforcement_scope(q)
 and (other.provenance->'outcome_ids') @> (q.provenance->'outcome_ids')
 and (q.provenance->'outcome_ids') @> (other.provenance->'outcome_ids')
 and other.difficulty<=q.difficulty
 and not exists(select 1 from public.question_source_members m where m.question_id=other.id)
 order by rank,other.created_at,other.id limit 4)x;
 if coalesce(array_length(ids,1),0)<2 then return array[]::uuid[];end if;
 return ids||q.id;
end;$$;
revoke all on function public.get_reinforcement_questions(uuid,uuid) from public,anon;
grant execute on function public.get_reinforcement_questions(uuid,uuid) to authenticated;
