-- Parent-controlled, non-medical study reminders. Never alter exam deadlines or safety notifications.
alter table public.children
 add column study_break_minutes smallint not null default 20 check(study_break_minutes between 10 and 60),
 add column evening_reminder_start smallint check(evening_reminder_start between 0 and 1439),
 add column evening_reminder_end smallint not null default 420 check(evening_reminder_end between 0 and 1439),
 add constraint evening_reminder_nonempty check(evening_reminder_start is null or evening_reminder_start<>evening_reminder_end);
grant update(study_break_minutes,evening_reminder_start,evening_reminder_end) on public.children to authenticated;
create function public.get_study_preferences(p_child_id uuid)
 returns table(break_minutes smallint,evening_start smallint,evening_end smallint,timezone text)
 language plpgsql stable security definer set search_path='' as $$
begin
 if not(gina.is_parent() or gina.is_device()) or (gina.is_device() and p_child_id is distinct from gina.child_id()) then
 raise exception 'forbidden' using errcode='42501';end if;
 return query select c.study_break_minutes,c.evening_reminder_start,c.evening_reminder_end,f.timezone
 from public.children c join public.families f on f.id=c.family_id
 where c.id=p_child_id and c.family_id=gina.family_id() and c.archived_at is null;
end;$$;
revoke all on function public.get_study_preferences(uuid) from public,anon;
grant execute on function public.get_study_preferences(uuid) to authenticated;
