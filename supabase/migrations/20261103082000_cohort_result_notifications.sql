-- Only published, current reviewed cohort results notify parents. No answer/score in push.
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check(kind in('task_awaiting_approval','task_approved','task_returned','exam_assigned','exam_finished','weekly_summary','cohort_results'));

create function gina.cohort_notification_current(p_payload jsonb,p_family uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from gina.cohort_publications p join public.group_exams g on g.id=p.group_id
 where p.group_id::text=p_payload->>'group_id' and p.version::text=p_payload->>'publication_version'
 and g.requires_review and g.status='published' and gina.cohort_review_state(g.id)->>'published'='true'
 and exists(select 1 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 where e.group_id=g.id and e.family_id=p_family and e.review_consent_at is not null and a.status<>'in_progress'));
$$;
revoke all on function gina.cohort_notification_current(jsonb,uuid) from public,anon,authenticated,service_role;

create function gina.notify_cohort_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.version=old.version then return new;end if;
 -- One family event per new publication. Same request receipt never updates the publication again.
 -- No creator exclusion: an administrator who is also a participating parent still receives it.
 insert into public.push_outbox(family_id,audience,kind,payload)
 select distinct e.family_id,'parents','cohort_results',jsonb_build_object('group_id',new.group_id,'publication_version',new.version)
 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 where e.group_id=new.group_id and e.review_consent_at is not null and a.status<>'in_progress';
 return new;
end;$$;
revoke all on function gina.notify_cohort_publication() from public,anon,authenticated,service_role;
create trigger notify_cohort_publication after insert or update on gina.cohort_publications
 for each row execute function gina.notify_cohort_publication();

create or replace function public.push_targets(p_outbox_id bigint)
returns table (token_id uuid, token text, token_type text, platform text, locale text)
language sql
stable
security definer
set search_path = public
as $$
  with o as (select * from public.push_outbox where id = p_outbox_id and (kind <> 'cohort_results' or gina.cohort_notification_current(payload,family_id)))
  select t.id, t.token, t.token_type, t.platform, t.locale
  from o
  join public.push_tokens t on t.family_id = o.family_id and t.role = 'parent'
  join public.family_members m on m.family_id = o.family_id and m.user_id = t.user_id
  left join public.push_preferences p on p.user_id = t.user_id
  where o.audience = 'parents'
    and t.user_id is distinct from o.exclude_user_id
    and exists (select 1 from auth.sessions s where s.user_id = t.user_id)
    and case o.kind
          when 'task_awaiting_approval' then coalesce(p.approvals, true)
          when 'exam_finished' then coalesce(p.exams, true)
          when 'cohort_results' then coalesce(p.exams, true)
          when 'weekly_summary' then coalesce(p.weekly_summary, true)
          else true
        end
  union all
  select t.id, t.token, t.token_type, t.platform, t.locale
  from o
  join public.push_tokens t on t.family_id = o.family_id and t.role = 'device'
  join public.devices d on d.id = t.device_id and d.family_id = o.family_id and d.revoked_at is null
  where o.audience = 'device'
    and (o.target_child_id is null or d.active_child_id = o.target_child_id);
$$;

revoke execute on function public.push_claim_batch(int), public.push_targets(bigint) from public, anon, authenticated;
grant execute on function public.push_claim_batch(int), public.push_targets(bigint) to service_role;

