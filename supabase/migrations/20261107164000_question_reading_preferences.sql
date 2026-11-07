-- Reading aloud is an accessibility preference, not microphone consent or voice-answer storage.
alter table public.children add column question_reading_enabled boolean not null default true;
alter table public.exams add column question_reading_override text not null default 'inherit'
 check(question_reading_override in ('inherit','on','off'));
grant update(question_reading_enabled) on public.children to authenticated;
create function public.get_question_reading_permission(p_exam_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare e public.exams;c public.children;
begin
 if not(gina.is_parent() or gina.is_device()) then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.exams where id=p_exam_id and family_id=gina.family_id();
 if e.id is null or (gina.is_device() and (e.child_id is distinct from gina.child_id() or e.status not in ('assigned','completed'))) then
 raise exception 'forbidden' using errcode='42501';end if;
 select * into c from public.children where id=e.child_id and family_id=e.family_id;
 return case e.question_reading_override when 'on' then true when 'off' then false else coalesce(c.question_reading_enabled,false) end;
end;$$;
revoke all on function public.get_question_reading_permission(uuid) from public,anon;
grant execute on function public.get_question_reading_permission(uuid) to authenticated;
