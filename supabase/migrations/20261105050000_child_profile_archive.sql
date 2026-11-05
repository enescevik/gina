-- Recoverable profile pause. Earned data stays; permissions never revive implicitly.
alter table public.children add column archived_at timestamptz;
alter table public.children add column archive_revision integer not null default 0;
create table gina.child_archive_state (
 child_id uuid primary key references public.children(id) on delete cascade,
 revision integer not null, archived_at timestamptz
);
create table gina.child_archive_device_blocks (
 child_id uuid references public.children(id) on delete cascade,
 device_id uuid references public.devices(id) on delete cascade,
 primary key(child_id,device_id)
);
revoke all on gina.child_archive_state,gina.child_archive_device_blocks from public,anon,authenticated,service_role;

create function gina.require_active_child(p_child uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Share lock serializes a new write/reservation with an archive transaction.
 perform 1 from public.children where id=p_child and archived_at is not null for share;
 if found then raise exception 'child_archived';end if;
 perform 1 from public.children where id=p_child for share;
 -- Recheck after waiting for a concurrent archive to commit.
 if exists(select 1 from public.children where id=p_child and archived_at is not null) then raise exception 'child_archived';end if;
end;$$;
revoke all on function gina.require_active_child(uuid) from public,anon,authenticated,service_role;

create function gina.protect_child_archive_projection() returns trigger
language plpgsql security definer set search_path='' as $$
declare state gina.child_archive_state;
begin
 if TG_OP='INSERT' then
  if new.archived_at is not null or new.archive_revision<>0 then raise exception 'child_archive_use_action';end if;
  return new;
 end if;
 if new.archived_at is distinct from old.archived_at or new.archive_revision is distinct from old.archive_revision then
  select * into state from gina.child_archive_state where child_id=new.id;
  if not found or new.archive_revision<>state.revision or new.archived_at is distinct from state.archived_at then raise exception 'child_archive_use_action';end if;
  if (to_jsonb(new)-array['archived_at','archive_revision','updated_at']) is distinct from (to_jsonb(old)-array['archived_at','archive_revision','updated_at']) then raise exception 'child_archive_use_action';end if;
 elsif old.archived_at is not null and new is distinct from old then raise exception 'child_archived';end if;
 return new;
end;$$;
create trigger a_child_archive_projection before insert or update on public.children for each row execute function gina.protect_child_archive_projection();

create function gina.guard_archived_child_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_value jsonb;ch uuid;old_ch uuid;actor_keys text[]:=array['created_by','updated_by','completed_by','reviewed_by','author_user_id'];
begin
 -- Keep explicit account/family/child cascades functional; direct record deletion stays blocked.
 if TG_OP='DELETE' and pg_trigger_depth()>1 then return old;end if;
 -- FK SET NULL during account deletion may remove actor attribution, never the
 -- earned evidence itself. A direct client update or any content edit still fails.
 if TG_OP='UPDATE' and pg_trigger_depth()>1
 and (to_jsonb(new)-actor_keys)=(to_jsonb(old)-actor_keys)
 and not exists(select 1 from unnest(actor_keys) k where to_jsonb(new)->k is distinct from to_jsonb(old)->k and to_jsonb(new)->k is distinct from 'null'::jsonb)
 then return new;end if;
 row_value:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='exam_answers' then
  select child_id into ch from public.exam_attempts where id=(row_value->>'attempt_id')::uuid;
 elsif TG_TABLE_NAME='prova_drafts' then ch:=(row_value#>>'{content,childId}')::uuid;
 else ch:=(row_value->>'child_id')::uuid;end if;
 if ch is not null then perform gina.require_active_child(ch);end if;
 if TG_OP='UPDATE' then
  if TG_TABLE_NAME='prova_drafts' then old_ch:=(to_jsonb(old)#>>'{content,childId}')::uuid;
  elsif TG_TABLE_NAME='exam_answers' then select child_id into old_ch from public.exam_attempts where id=(to_jsonb(old)->>'attempt_id')::uuid;
  else old_ch:=(to_jsonb(old)->>'child_id')::uuid;end if;
  if old_ch is distinct from ch then perform gina.require_active_child(old_ch);end if;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
create trigger archive_write_guard before insert or update or delete on public.child_shares for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.task_templates for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.task_completions for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.star_events for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.child_goals for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.reward_requests for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.events for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.grades for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.notes for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.exams for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.exam_attempts for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.exam_answers for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.school_timetables for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.child_room_preferences for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.child_inventory for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.child_badge_awards for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.group_exam_entries for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.study_plans for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on public.prova_drafts for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on gina.learning_plan for each row execute function gina.guard_archived_child_write();
create trigger archive_write_guard before insert or update or delete on gina.school_bags for each row execute function gina.guard_archived_child_write();

create function gina.push_for_child(p_target uuid,p_payload jsonb,p_child uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(p_target=p_child,false) or coalesce(p_payload->>'child_id'=p_child::text,false)
 or exists(select 1 from public.task_completions where child_id=p_child and id::text=p_payload->>'completion_id')
 or exists(select 1 from public.exams where child_id=p_child and id::text=p_payload->>'exam_id')
 or exists(select 1 from public.exam_attempts where child_id=p_child and id::text=p_payload->>'attempt_id');
$$;
revoke all on function gina.push_for_child(uuid,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.get_child_archive_preview(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.children;begin
 if auth.uid() is null or gina.is_parent() is not true then raise exception 'archive_forbidden' using errcode='42501';end if;
 select * into c from public.children where id=p_child_id and family_id=gina.family_id();
 if not found then raise exception 'archive_forbidden' using errcode='42501';end if;
 return jsonb_build_object('id',c.id,'name',c.name,'avatar',c.avatar,'grade',c.grade,'archived_at',c.archived_at,'revision',c.archive_revision,
 'routines',(select count(*) from public.task_templates where child_id=c.id and active),
 'devices',(select count(*) from public.devices d where d.family_id=c.family_id and d.revoked_at is null and gina.device_allows(d.id,c.id)),
 'links',(select count(*) from public.child_shares where child_id=c.id and revoked_at is null and expires_at>now()),
 'pending_tasks',(select count(*) from public.task_completions where child_id=c.id and status='done'),
 'active_attempts',(select count(*) from public.exam_attempts where child_id=c.id and status='in_progress'),
 'exams',(select count(*) from public.exams where child_id=c.id),
 'stars',(select coalesce(sum(delta),0) from public.star_events where child_id=c.id),
 'badges',(select count(*) from public.child_badge_awards where child_id=c.id));
end;$$;
create function public.set_child_archived(p_request_id uuid,p_child_id uuid,p_revision integer,p_archived boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.children;f uuid:=gina.family_id();payload jsonb;result jsonb;stamp timestamptz;begin
 if auth.uid() is null or f is null or gina.is_parent() is not true then raise exception 'archive_forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_archived is null then raise exception 'archive_invalid';end if;
 if not exists(select 1 from public.children where id=p_child_id and family_id=f) then raise exception 'archive_forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','child.archive','family',f,'child',p_child_id,'revision',p_revision,'archived',p_archived);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into c from public.children where id=p_child_id and family_id=f for no key update;
 if not found then raise exception 'archive_forbidden' using errcode='42501';end if;
 if c.archive_revision<>p_revision or (c.archived_at is not null)=p_archived then raise exception 'archive_changed';end if;
 -- Pause before changing the projection: these rows remain readable after archive.
 if p_archived then
  update public.task_templates set active=false where child_id=c.id and active;
  update public.child_shares set revoked_at=now() where child_id=c.id and revoked_at is null;
 end if;
 -- Block all currently paired devices on archive AND restore. Explicit device
 -- configuration is required even if the device previously allowed all children.
 insert into gina.child_archive_device_blocks(child_id,device_id)
 select c.id,id from public.devices where family_id=f and revoked_at is null on conflict do nothing;
 delete from public.device_children where child_id=c.id;
 update public.devices set active_child_id=null where family_id=f and active_child_id=c.id;
 stamp:=case when p_archived then now() else null end;
 insert into gina.child_archive_state values(c.id,c.archive_revision+1,stamp)
 on conflict(child_id) do update set revision=excluded.revision,archived_at=excluded.archived_at;
 update public.children set archived_at=stamp,archive_revision=c.archive_revision+1 where id=c.id;
 -- A queued or leased push must not be revived by restoring a profile later.
 update public.push_outbox o set status='no_targets',lease_id=null,last_error='child_archived'
 where o.family_id=f and (gina.push_for_child(o.target_child_id,o.payload,c.id) or (o.kind='cohort_results' and not gina.cohort_notification_current(o.payload,f))) and o.status in('pending','sending') and p_archived;
 result:=jsonb_build_object('id',c.id,'revision',c.archive_revision+1,'archived',p_archived);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;

create or replace function gina.device_allows(p_device_id uuid,p_child_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.devices d join public.children c on c.family_id=d.family_id
 where d.id=p_device_id and c.id=p_child_id and c.archived_at is null and d.revoked_at is null
 and not exists(select 1 from gina.child_archive_device_blocks b where b.device_id=d.id and b.child_id=c.id)
 and (d.access_mode='all' or exists(select 1 from public.device_children dc where dc.device_id=d.id and dc.child_id=c.id)));
$$;
create or replace function public.configure_child_device(p_device_id uuid,p_name text,p_child_ids uuid[],p_pin_required boolean)
returns void language plpgsql security definer set search_path='' as $$
declare d public.devices; n integer;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.devices where id=p_device_id and family_id=gina.family_id() and revoked_at is null for update;
 if d.id is null then raise exception 'device_not_found'; end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 60 or p_pin_required is null or coalesce(cardinality(p_child_ids),0)=0 then raise exception 'invalid_device_config'; end if;
 select count(distinct id) into n from public.children where id=any(p_child_ids) and family_id=d.family_id and archived_at is null;
 if n<>cardinality(p_child_ids) then raise exception 'child_not_found'; end if;
 if p_pin_required and exists(select 1 from unnest(p_child_ids) id where not exists(select 1 from public.child_pins p where p.child_id=id)) then raise exception 'child_pin_required'; end if;
 update public.devices set name=trim(p_name),access_mode='selected',pin_policy=case when p_pin_required then 'required' else 'none' end, active_child_id=null where id=d.id;
 delete from public.device_children where device_id=d.id;
 delete from gina.child_archive_device_blocks where device_id=d.id and child_id=any(p_child_ids);
 insert into public.device_children select d.id,unnest(p_child_ids);
end; $$;

create or replace function public.verify_child_pin(p_child_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin public.child_pins%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children where id = p_child_id and family_id = gina.family_id()) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;

  perform gina.require_active_child(p_child_id);
  select * into v_pin from public.child_pins where child_id = p_child_id for update;
  if v_pin.child_id is null then
    return true; -- PIN tanımlanmamışsa profil seçimi yeterlidir
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = 'P0001';
  end if;
  if v_pin.pin_hash = extensions.crypt(p_pin, v_pin.pin_hash) then
    update public.child_pins set failed_count = 0, locked_until = null where child_id = p_child_id;
    return true;
  end if;
  update public.child_pins
    set failed_count = failed_count + 1,
        locked_until = case when failed_count + 1 >= 5 then now() + interval '60 seconds' else null end,
        updated_at = now()
  where child_id = p_child_id;
  return false;
end;
$$;


create function public.reserve_child_ai_operation(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid,p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.children where id=p_child_id and family_id=p_family_id)
 then raise exception 'archive_forbidden' using errcode='42501';end if;
 perform gina.require_active_child(p_child_id);
 return public.reserve_ai_operation(p_family_id,p_user_id,p_action,p_hash,p_lease);
end;$$;
create or replace function public.reserve_prova_generation_v3(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_intent jsonb,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;existing gina.prova_generation_contexts;d public.prova_drafts;ch public.children;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text)>50000 or jsonb_typeof(p_context) is distinct from 'object' or octet_length(p_context::text)>5000000 or p_context->>'schema' is distinct from 'gina.generation-context.v1' or p_context->>'promptHash' is distinct from p_hash or (p_context->>'total')::int is distinct from p_items or jsonb_typeof(p_context->'catalogueBound') is distinct from 'boolean' then raise exception 'invalid_generation_context';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 if exists(select 1 from gina.prova_generation_cancellations where id=p_id) then return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);end if;
 select * into existing from gina.prova_generation_contexts where job_id=p_id;
 if found then
  if existing.intent is distinct from p_intent then return jsonb_build_object('error','request_conflict');end if;
  -- All repeat paths use the original finishing context. This function never restarts a failed/uncertain paid intent.
  return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);
 end if;
 if exists(select 1 from public.prova_generation_jobs where id=p_id) then return public.resume_prova_generation(p_id,p_family_id,p_user_id,p_intent);end if;
 if p_intent->>'draft_id' is not null then
  select * into d from public.prova_drafts where id=(p_intent->>'draft_id')::uuid and family_id=p_family_id for share;
  if not found or d.discarded_at is not null or d.submitted_at is not null or d.version is distinct from (p_context#>>'{draftScope,version}')::int or d.id::text is distinct from p_context#>>'{draftScope,id}' or (d.content->>'grade')::int is distinct from (p_context->>'grade')::int or not coalesce(d.content->'subjects' ? (p_context->>'subject'),false) then raise exception 'prova_draft_changed';end if;
  select * into ch from public.children where id=(d.content->>'childId')::uuid and family_id=p_family_id for share;
  if found then perform gina.require_active_child(ch.id);end if;
  if ch.id is null or (ch.grade between 1 and 12 and ch.grade is distinct from (p_context->>'grade')::int) then raise exception 'prova_draft_changed';end if;
 end if;
 if p_context->'catalogueBound'='true' then
  result:=public.reserve_catalog_prova_generation(p_id,p_family_id,p_user_id,p_hash,p_items,(p_intent->>'blueprint_id')::uuid,(p_intent->>'draft_id')::uuid);
 else result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 if result->>'ok'='true' then insert into gina.prova_generation_contexts values(p_id,p_intent,p_context);end if;
 return result;
end;$$;
create or replace function gina.learning_import_parent(p_family uuid,p_user uuid,p_child uuid,p_source uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where family_id=p_family and user_id=p_user) then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform 1 from public.children where id=p_child and family_id=p_family for key share;
 if not found then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 perform gina.require_active_child(p_child);
 perform 1 from public.learning_sources where id=p_source and family_id=p_family and kind='document' and status='ready' for key share;
 if not found then raise exception 'source_not_ready';end if;
end;$$;
create or replace function public.get_weekly_summary_data(p_family_id uuid,p_week_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.families; monday date;begin
 if auth.role() is distinct from 'service_role' and
  (auth.uid() is not null and gina.is_parent() and gina.family_id()=p_family_id) is not true
 then raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 if p_week_start is null or not isfinite(p_week_start) or extract(isodow from p_week_start)<>1 or p_week_start<monday-56 or p_week_start>monday-7 then raise exception 'weekly_date';end if;
 return jsonb_build_object('week_start',p_week_start,'locale',f.locale,'timezone',f.timezone,'data_version','v2',
 'children',(select coalesce(jsonb_agg(jsonb_build_object('alias',k.alias,'grade',k.grade,
 'stars_earned',(select coalesce(sum(delta),0) from public.star_events where family_id=f.id and child_id=k.id and reason='task_approved' and delta>0 and created_at>=p_week_start::timestamp at time zone f.timezone and created_at<(p_week_start+7)::timestamp at time zone f.timezone),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_object('status',c.status,'count',c.n) order by c.status),'[]') from (select status,count(*) n from public.task_completions where family_id=f.id and child_id=k.id and due_date>=p_week_start and due_date<p_week_start+7 group by status)c)
 ) order by k.position),'[]') from (select id,grade,row_number() over(order by sort_order,created_at,id) position,'Çocuk '||chr(64+row_number() over(order by sort_order,created_at,id)::int) alias from public.children where family_id=f.id and archived_at is null)k));
end;$$;
create or replace function public.push_targets(p_outbox_id bigint)
returns table (token_id uuid, token text, token_type text, platform text, locale text)
language sql
stable
security definer
set search_path = public
as $$
  with o as (select * from public.push_outbox where id = p_outbox_id and not exists(select 1 from public.children c where c.archived_at is not null and gina.push_for_child(target_child_id,payload,c.id)) and (kind <> 'cohort_results' or gina.cohort_notification_current(payload,family_id)))
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
    and d.active_child_id is not null and gina.device_allows(d.id,d.active_child_id) and (o.target_child_id is null or d.active_child_id = o.target_child_id);
$$;

revoke all on function public.get_child_archive_preview(uuid),public.set_child_archived(uuid,uuid,integer,boolean) from public,anon,service_role;
grant execute on function public.get_child_archive_preview(uuid),public.set_child_archived(uuid,uuid,integer,boolean) to authenticated;
revoke all on function public.reserve_child_ai_operation(uuid,uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_child_ai_operation(uuid,uuid,text,text,uuid,uuid) to service_role;
revoke all on function gina.protect_child_archive_projection(),gina.guard_archived_child_write() from public,anon,authenticated,service_role;

create or replace function public.reserve_catalog_prova_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int,p_blueprint_id uuid,p_draft_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link gina.catalog_blueprint_links;bound gina.catalog_generation_links;j public.prova_generation_jobs;c gina.curriculum_candidates;d public.prova_drafts;ch public.children;bp public.exam_blueprints;result jsonb;plan public.plans;begin
 if not gina.is_service() or not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_draft_id is null or p_blueprint_id is null then raise exception 'curriculum_scope_mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  select * into bound from gina.catalog_generation_links where job_id=p_id;
  if not found or bound.blueprint_id<>p_blueprint_id or bound.draft_id<>p_draft_id then return jsonb_build_object('error','request_conflict');end if;
  -- A withdrawal prevents new provider work, not retrieval/finishing of an already paid result.
  if j.status<>'failed' then return public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);end if;
 end if;
 select * into link from gina.catalog_blueprint_links where blueprint_id=p_blueprint_id and family_id=p_family_id for share;
 if not found or link.child_id is null then raise exception 'curriculum_scope_mismatch';end if;
 select * into d from public.prova_drafts where id=p_draft_id and family_id=p_family_id for share;
 if not found or d.discarded_at is not null or d.submitted_at is not null or d.content->>'childId' is distinct from link.child_id::text or d.content->>'purpose' is distinct from 'written' then raise exception 'curriculum_scope_mismatch';end if;
 select * into ch from public.children where id=link.child_id and family_id=p_family_id for share;
 perform gina.require_active_child(ch.id);
 select * into bp from public.exam_blueprints where id=p_blueprint_id and family_id=p_family_id for share;
 if ch.id is null or bp.id is null or ch.grade is distinct from bp.grade or (d.content->>'grade')::int is distinct from bp.grade or not exists(select 1 from jsonb_array_elements_text(d.content->'subjects') s where gina.curriculum_subject(s.value)=gina.curriculum_subject(bp.subject)) or p_items is distinct from (link.snapshot->'candidate'->>'question_count')::int then raise exception 'curriculum_scope_mismatch';end if;
 select * into c from gina.curriculum_candidates where id=link.catalogue_id for share;
 if c.status<>'published' or c.revision<>link.revision or not exists(select 1 from public.app_settings where key='curriculum_catalog.enabled' and value='true') then return jsonb_build_object('error','curriculum_unavailable');end if;
 plan:=gina.family_plan_of(p_family_id);
 if not plan.prova_scenarios then return jsonb_build_object('error','plan_limit_prova_scenarios');end if;
 result:=public.reserve_prova_generation_v2(p_id,p_family_id,p_user_id,p_hash,p_items);
 if result->>'ok'='true' then insert into gina.catalog_generation_links values(p_id,p_blueprint_id,p_draft_id) on conflict(job_id) do nothing;end if;
 return result;
end;$$;

-- Different Provas must not suppress each other. Keep the existing task/weekly batching policy.
-- Only identical pending Prova payloads coalesce; normal trigger transitions decide when to notify.
create or replace function gina.enqueue_push(
 p_family_id uuid,p_audience text,p_kind text,p_payload jsonb,p_target_child_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare body jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
 if exists(select 1 from public.children c where c.family_id=p_family_id and c.archived_at is not null and gina.push_for_child(p_target_child_id,body,c.id)) then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_family_id,p_audience,p_kind,p_target_child_id,case when p_kind in('exam_assigned','exam_finished') then body else '{}'::jsonb end)::text,63));
 if exists(select 1 from public.push_outbox o where o.family_id=p_family_id and o.audience=p_audience and o.kind=p_kind
   and o.target_child_id is not distinct from p_target_child_id and (p_kind not in('exam_assigned','exam_finished') or o.payload=body) and o.status='pending') then return;end if;
 insert into public.push_outbox(family_id,audience,target_child_id,exclude_user_id,kind,payload)
 values(p_family_id,p_audience,p_target_child_id,auth.uid(),p_kind,body);
end;$$;
revoke execute on function gina.enqueue_push(uuid,text,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.get_child_device_access(p_device_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.devices;
begin
 select * into d from public.devices where revoked_at is null and
 ((p_device_id is not null and id=p_device_id and family_id=gina.family_id() and gina.is_parent()) or (p_device_id is null and auth_user_id=auth.uid()));
 if d.id is null then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('id',d.id,'name',d.name,'pin_policy',d.pin_policy,'access_mode',d.access_mode,
 'children',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'avatar',c.avatar,'grade',c.grade,
 'allowed',gina.device_allows(d.id,c.id),'pin_set',exists(select 1 from public.child_pins p where p.child_id=c.id),
 'needs_pin',d.pin_policy='required' or (d.pin_policy='existing' and exists(select 1 from public.child_pins p where p.child_id=c.id))) order by c.sort_order),'[]'::jsonb)
 from public.children c where c.family_id=d.family_id and c.archived_at is null and (gina.is_parent() or gina.device_allows(d.id,c.id))));
end; $$;


-- Keep cohort evidence intact; only active participants receive new notifications.
create or replace function gina.cohort_notification_current(p_payload jsonb,p_family uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from gina.cohort_publications p join public.group_exams g on g.id=p.group_id
 where p.group_id::text=p_payload->>'group_id' and p.version::text=p_payload->>'publication_version'
 and g.requires_review and g.status='published' and gina.cohort_review_state(g.id)->>'published'='true'
 and exists(select 1 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 where exists(select 1 from public.children c where c.id=e.child_id and c.archived_at is null) and e.group_id=g.id and e.family_id=p_family and e.review_consent_at is not null and a.status<>'in_progress'));
$$;
revoke all on function gina.cohort_notification_current(jsonb,uuid) from public,anon,authenticated,service_role;

create or replace function gina.notify_cohort_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.version=old.version then return new;end if;
 -- One family event per new publication. Same request receipt never updates the publication again.
 -- No creator exclusion: an administrator who is also a participating parent still receives it.
 insert into public.push_outbox(family_id,audience,kind,payload)
 select distinct e.family_id,'parents','cohort_results',jsonb_build_object('group_id',new.group_id,'publication_version',new.version)
 from public.group_exam_entries e join public.exam_attempts a on a.exam_id=e.exam_id
 where exists(select 1 from public.children c where c.id=e.child_id and c.archived_at is null) and e.group_id=new.group_id and e.review_consent_at is not null and a.status<>'in_progress';
 return new;
end;$$;
revoke all on function gina.notify_cohort_publication() from public,anon,authenticated,service_role;
