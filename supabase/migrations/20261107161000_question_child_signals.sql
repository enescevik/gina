-- F2a: child self-report; never changes score, reward or AI jobs.
create table public.question_child_signals (
 family_id uuid not null references public.families(id) on delete cascade,
 attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 liked boolean not null default false,
 struggled boolean not null default false,
 primary key(attempt_id,question_id)
);
alter table public.question_child_signals enable row level security;
revoke all on public.question_child_signals from public,anon,authenticated;
grant select,delete on public.question_child_signals to authenticated;
grant insert(family_id,attempt_id,question_id,liked,struggled),update(liked,struggled) on public.question_child_signals to authenticated;
create policy question_child_signals_access on public.question_child_signals for all to authenticated
 using (family_id=(select gina.family_id()) and exists (
 select 1 from public.exam_attempts a join public.exams e on e.id=a.exam_id
 where a.id=attempt_id and a.family_id=(select gina.family_id()) and question_id=any(e.question_ids)
 and ((select gina.is_parent()) or ((select gina.is_device()) and a.child_id=(select gina.child_id())))))
 with check (family_id=(select gina.family_id()) and exists (
 select 1 from public.exam_attempts a join public.exams e on e.id=a.exam_id
 where a.id=attempt_id and a.family_id=(select gina.family_id()) and question_id=any(e.question_ids)
 and ((select gina.is_parent()) or ((select gina.is_device()) and a.child_id=(select gina.child_id())))));
create function public.set_question_child_signal(p_attempt_id uuid,p_question_id uuid,p_field text,p_selected boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_field is null or p_field not in ('liked','struggled') or p_selected is null then
  raise exception 'invalid_input' using errcode='22023';
 end if;
 insert into public.question_child_signals(family_id,attempt_id,question_id,liked,struggled)
 values(gina.family_id(),p_attempt_id,p_question_id,p_field='liked' and p_selected,p_field='struggled' and p_selected)
 on conflict(attempt_id,question_id) do update set
 liked=case when p_field='liked' then p_selected else question_child_signals.liked end,
 struggled=case when p_field='struggled' then p_selected else question_child_signals.struggled end;
end; $$;
revoke all on function public.set_question_child_signal(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.set_question_child_signal(uuid,uuid,text,boolean) to authenticated;
