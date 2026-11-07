create table public.question_reports (
 id uuid primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 attempt_id uuid references public.exam_attempts(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('incorrect','unclear','image','inappropriate')),
 status text not null default 'open' check(status in ('open','reviewed','dismissed')),
 created_at timestamptz not null default now()
);
alter table public.question_reports enable row level security;
revoke all on public.question_reports from public,anon,authenticated;
grant select on public.question_reports to authenticated;
create policy question_reports_family_read on public.question_reports for select to authenticated
 using (family_id=(select gina.family_id()) and ((select gina.is_parent()) or ((select gina.is_device()) and reporter_id=(select auth.uid()) and exists(select 1 from public.exam_attempts a where a.id=attempt_id and a.child_id=(select gina.child_id()) and a.family_id=(select gina.family_id())))));
create policy question_reports_admin_read on public.question_reports for select to authenticated
 using ((select gina.is_admin_strict()));
create index question_reports_actor_time on public.question_reports(reporter_id,created_at desc);
create index question_reports_queue on public.question_reports(status,created_at);
create function public.report_question(p_request_id uuid,p_question_id uuid,p_reason text,p_attempt_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.question_reports;a public.exam_attempts;
begin
 if not(gina.is_parent() or gina.is_device()) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_reason is null or p_reason not in ('incorrect','unclear','image','inappropriate') then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,165));
 if not exists(select 1 from public.question_bank where id=p_question_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
 if p_attempt_id is not null then
  select * into a from public.exam_attempts where id=p_attempt_id and family_id=f;
  if a.id is null or (gina.is_device() and a.child_id is distinct from gina.child_id())
  or not exists(select 1 from public.exams e where e.id=a.exam_id and p_question_id=any(e.question_ids)) then
   raise exception 'forbidden' using errcode='42501';end if;
 elsif gina.is_device() then raise exception 'forbidden' using errcode='42501';end if;
 select * into r from public.question_reports where id=p_request_id;
 if r.id is not null then
  if r.family_id<>f or r.reporter_id<>auth.uid() or r.question_id<>p_question_id or r.reason<>p_reason or r.attempt_id is distinct from p_attempt_id then
   raise exception 'request_conflict' using errcode='22023';end if;
  return r.id;
 end if;
 if (select count(*) from public.question_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then
  raise exception 'question_report_rate_limited' using errcode='P0001';end if;
 insert into public.question_reports(id,family_id,question_id,attempt_id,reporter_id,reason)
 values(p_request_id,f,p_question_id,p_attempt_id,auth.uid(),p_reason);
 return p_request_id;
end;$$;
revoke all on function public.report_question(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.report_question(uuid,uuid,text,uuid) to authenticated;
create function public.resolve_question_report(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.question_reports;
begin
 if not gina.is_admin_strict() then raise exception 'forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in ('reviewed','dismissed') then raise exception 'invalid_input' using errcode='22023';end if;
 select * into r from public.question_reports where id=p_id for update;
 if r.id is null then raise exception 'report_not_found';end if;
 if r.status=p_status then return;end if;
 if r.status<>'open' then raise exception 'stale_record';end if;
 update public.question_reports set status=p_status where id=p_id;
 insert into public.audit_log(actor_id,action,target_table,target_id,details)
 values(auth.uid(),'question_report.'||p_status,'question_reports',p_id::text,jsonb_build_object('reason',r.reason));
end;$$;
revoke all on function public.resolve_question_report(uuid,text) from public,anon;
grant execute on function public.resolve_question_report(uuid,text) to authenticated;
