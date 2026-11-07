create table gina.study_preference_history (
 id bigint generated always as identity primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 exam_id uuid references public.exams(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 setting text not null check(setting in ('reading','exam_reading','break','evening_start','evening_end')),
 previous_value text,
 new_value text,
 changed_at timestamptz not null default now()
);
alter table gina.study_preference_history enable row level security;
revoke all on gina.study_preference_history from public,anon,authenticated;
create index study_preference_history_lookup on gina.study_preference_history(family_id,child_id,changed_at desc,id desc);

create function gina.record_study_preference_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='children' then
  insert into gina.study_preference_history(family_id,child_id,actor_id,setting,previous_value,new_value)
  select new.family_id,new.id,auth.uid(),v.setting,v.before,v.after from (values
   ('reading',old.question_reading_enabled::text,new.question_reading_enabled::text),
   ('break',old.study_break_minutes::text,new.study_break_minutes::text),
   ('evening_start',old.evening_reminder_start::text,new.evening_reminder_start::text),
   ('evening_end',old.evening_reminder_end::text,new.evening_reminder_end::text)
  ) v(setting,before,after) where v.before is distinct from v.after;
 elsif new.child_id is not null and old.question_reading_override is distinct from new.question_reading_override then
  insert into gina.study_preference_history(family_id,child_id,exam_id,actor_id,setting,previous_value,new_value)
  values(new.family_id,new.child_id,new.id,auth.uid(),'exam_reading',old.question_reading_override,new.question_reading_override);
 end if;
 return new;
end;$$;
revoke all on function gina.record_study_preference_change() from public,anon,authenticated;
create trigger record_child_study_preferences after update of question_reading_enabled,study_break_minutes,evening_reminder_start,evening_reminder_end on public.children
for each row execute function gina.record_study_preference_change();
create trigger record_exam_reading_preference after update of question_reading_override on public.exams
for each row execute function gina.record_study_preference_change();

create function public.get_study_preference_history(p_child_id uuid)
returns table(id bigint,setting text,new_value text,changed_at timestamptz,actor text)
language plpgsql stable security definer set search_path='' as $$
begin
 if gina.is_parent() is not true or not exists(select 1 from public.children c where c.id=p_child_id and c.family_id=gina.family_id()) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 return query select h.id,h.setting,h.new_value,h.changed_at,
 case when h.actor_id=auth.uid() then 'self' when h.actor_id is not null then 'parent' else 'unknown' end
 from gina.study_preference_history h
 where h.family_id=gina.family_id() and h.child_id=p_child_id
 order by h.changed_at desc,h.id desc limit 20;
end;$$;
revoke all on function public.get_study_preference_history(uuid) from public,anon;
grant execute on function public.get_study_preference_history(uuid) to authenticated;
