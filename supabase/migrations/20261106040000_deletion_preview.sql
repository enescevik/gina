-- L03: impact preview before permanent child/account deletion. The preview is a short-lived,
-- fingerprinted token; the real deletion rejects a preview whose target has changed since.
-- Existing deletion mechanics (RLS child delete, auth.users triggers, Edge delete-account) stay.

create table gina.deletion_previews (
 token uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 target_kind text not null check (target_kind in ('child','account')),
 child_id uuid references public.children(id) on delete cascade,
 fingerprint text not null,
 summary jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check ((target_kind='child') = (child_id is not null))
);
create index deletion_previews_actor_idx on gina.deletion_previews(actor_id, created_at);
revoke all on gina.deletion_previews from public,anon,authenticated,service_role;

-- Another parent's personal note is never deleted with a child the author did not delete.
-- It survives detached at family level; the author keeps it. Only a direct child deletion
-- (not a family/account cascade, where the note is removed with the whole family) does this.
create or replace function gina.note_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  -- Detach-only update issued by gina.detach_co_parent_private_notes() during a child deletion.
  if pg_trigger_depth()>1 and old.child_id is not null and new.child_id is null and old.visibility='private'
   and (to_jsonb(new)-array['child_id','revision','updated_at'])=(to_jsonb(old)-array['child_id','revision','updated_at'])
  then new.revision:=old.revision+1;return new;end if;
  -- FK author cleanup is handled by existing account/child deletion functions.
  if (new.id,new.family_id,new.child_id,new.author_user_id,new.author_child_id) is distinct from (old.id,old.family_id,old.child_id,old.author_user_id,old.author_child_id) then raise exception 'note_owner_immutable';end if;
  if old.archived_at is not null and (new.title,new.body,new.subject,new.visibility) is distinct from (old.title,old.body,old.subject,old.visibility) and not(new.archived_at is null and new.visibility='private' and (new.title,new.body,new.subject) is not distinct from (old.title,old.body,old.subject)) then raise exception 'note_archived';end if;
  if (to_jsonb(new)-array['revision','updated_at']) is distinct from (to_jsonb(old)-array['revision','updated_at']) then new.revision:=old.revision+1;else new.revision:=old.revision;end if;
 end if;
 if TG_OP='INSERT' or (new.title,new.body,new.subject) is distinct from (old.title,old.body,old.subject) then
  if length(btrim(new.body)) not between 1 and 4000 or length(coalesce(new.title,''))>120 or length(coalesce(new.subject,''))>80 then raise exception 'note_invalid';end if;
  if new.child_id is not null and not exists(select 1 from public.children where id=new.child_id and family_id=new.family_id) then raise exception 'wrong_child';end if;
  if new.author_child_id is not null and not exists(select 1 from public.children where id=new.author_child_id and family_id=new.family_id) then raise exception 'wrong_child';end if;
 end if;
 if new.visibility='child' and new.child_id is null then raise exception 'note_child_required';end if;
 return new;
end;$$;

create or replace function gina.guard_archived_child_write() returns trigger language plpgsql security definer set search_path='' as $$
declare row_value jsonb;ch uuid;old_ch uuid;actor_keys text[]:=array['created_by','updated_by','completed_by','reviewed_by','author_user_id'];
begin
 -- Keep explicit account/family/child cascades functional; direct record deletion stays blocked.
 if TG_OP='DELETE' and pg_trigger_depth()>1 then return old;end if;
 -- A personal note detached from a deleted (possibly archived) child keeps its content.
 if TG_OP='UPDATE' and pg_trigger_depth()>1 and TG_TABLE_NAME='notes'
 and (to_jsonb(old)->>'child_id') is not null and (to_jsonb(new)->>'child_id') is null and (to_jsonb(old)->>'visibility')='private'
 and (to_jsonb(new)-array['child_id','revision','updated_at'])=(to_jsonb(old)-array['child_id','revision','updated_at'])
 then return new;end if;
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

create function gina.detach_co_parent_private_notes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Family/account cascades remove the whole family; nothing to preserve there.
 if pg_trigger_depth()>1 then return old;end if;
 update public.notes set child_id=null
 where child_id=old.id and visibility='private' and author_user_id is not null and author_user_id is distinct from auth.uid();
 return old;
end;$$;
revoke all on function gina.detach_co_parent_private_notes() from public,anon,authenticated,service_role;
create trigger gina_detach_co_parent_private_notes before delete on public.children
 for each row execute function gina.detach_co_parent_private_notes();

-- Record-type counts for one child. Family-level content (files, questions, rewards, drafts,
-- usage receipts) is not child data and is reported as preserved, never as deleted.
create function gina.deletion_child_counts(p_child uuid,p_actor uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'task_routines',(select count(*) from public.task_templates where child_id=p_child),
 'task_completions',(select count(*) from public.task_completions where child_id=p_child),
 'pending_task_reviews',(select count(*) from public.task_completions where child_id=p_child and status='done'),
 'stars',jsonb_build_object('events',(select count(*) from public.star_events where child_id=p_child),'balance',(select coalesce(sum(delta),0) from public.star_events where child_id=p_child)),
 'badges',(select count(*) from public.child_badge_awards where child_id=p_child),
 'rewards',jsonb_build_object('requests',(select count(*) from public.reward_requests where child_id=p_child),
  'pending',(select count(*) from public.reward_requests where child_id=p_child and status in('requested','approved')),
  'goals',(select count(*) from public.child_goals where child_id=p_child)),
 'notes',jsonb_build_object(
  'own',(select count(*) from public.notes where child_id=p_child and author_user_id=p_actor),
  'shared',(select count(*) from public.notes where child_id=p_child and author_user_id is not null and author_user_id is distinct from p_actor and visibility<>'private'),
  'child_authored',(select count(*) from public.notes where author_child_id=p_child)),
 'co_parent_private_notes',(select count(*) from public.notes where child_id=p_child and author_user_id is not null and author_user_id is distinct from p_actor and visibility='private'),
 'prova',jsonb_build_object('exams',(select count(*) from public.exams where child_id=p_child),
  'attempts',(select count(*) from public.exam_attempts where child_id=p_child),
  'in_progress',(select count(*) from public.exam_attempts where child_id=p_child and status='in_progress'),
  'answers',(select count(*) from public.exam_answers a join public.exam_attempts t on t.id=a.attempt_id where t.child_id=p_child),
  'study_plans',(select count(*) from public.study_plans where child_id=p_child)),
 'calendar',jsonb_build_object('events',(select count(*) from public.events where child_id=p_child),
  'timetables',(select count(*) from public.school_timetables where child_id=p_child),
  'education_periods',(select count(*) from gina.child_education_periods where child_id=p_child)),
 'grades',(select count(*) from public.grades where child_id=p_child),
 'shares',jsonb_build_object('total',(select count(*) from public.child_shares where child_id=p_child),
  'open',(select count(*) from public.child_shares where child_id=p_child and revoked_at is null)),
 'devices',jsonb_build_object(
  'allowed',(select count(*) from public.devices d join public.children c on c.id=p_child where d.family_id=c.family_id and d.revoked_at is null and (d.active_child_id=p_child or gina.device_allows(d.id,p_child))),
  'active_sessions',(select count(*) from public.devices where active_child_id=p_child and revoked_at is null)),
 'ai',jsonb_build_object('timetable_imports',(select count(*) from public.timetable_imports where child_id=p_child),
  'answer_reviews',(select count(*) from public.answer_review_suggestions s join public.exam_attempts t on t.id=s.attempt_id where t.child_id=p_child),
  'inbox',(select count(*) from gina.parent_inbox where child_id=p_child)),
 'files',jsonb_build_object('count',0,'bytes',0,
  'linked_family_files',(select count(distinct l.source_id) from public.learning_source_links l
   left join public.task_templates tt on tt.id=l.task_id left join public.child_goals g on g.id=l.goal_id
   where l.timetable_child_id=p_child or tt.child_id=p_child or g.child_id=p_child)),
 'prova_drafts_referencing',(select count(*) from public.prova_drafts where content->>'childId'=p_child::text and discarded_at is null)
);$$;
revoke all on function gina.deletion_child_counts(uuid,uuid) from public,anon,authenticated,service_role;

-- Fingerprint covers the facts a parent decided on; warnings and clock-dependent values are added after.
create function gina.deletion_child_state(p_child uuid,p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.children;counts jsonb;state jsonb;warnings jsonb:='[]';
begin
 select * into c from public.children where id=p_child;
 if not found then return null;end if;
 counts:=gina.deletion_child_counts(c.id,p_actor);
 state:=jsonb_build_object('kind','child',
  'child',jsonb_build_object('id',c.id,'name',c.name,'avatar',c.avatar,'grade',c.grade,'family_id',c.family_id,'archived',c.archived_at is not null,'archive_revision',c.archive_revision),
  'deletes',counts-'co_parent_private_notes'-'prova_drafts_referencing',
  'preserved',jsonb_build_object(
   'co_parent_private_notes',counts->'co_parent_private_notes',
   'family_notes',(select count(*) from public.notes where family_id=c.family_id and child_id is null),
   'family_files',jsonb_build_object('count',(select count(*) from public.learning_sources where family_id=c.family_id),'bytes',(select coalesce(sum(bytes),0) from public.learning_sources where family_id=c.family_id)),
   'family_questions',(select count(*) from public.question_bank where family_id=c.family_id),
   'family_rewards',(select count(*) from public.family_rewards where family_id=c.family_id),
   'prova_drafts_referencing',counts->'prova_drafts_referencing',
   'other_children',(select count(*) from public.children where family_id=c.family_id and id<>c.id),
   'usage_receipts',true));
 if c.archived_at is null and (counts#>>'{devices,allowed}')::int>0 then warnings:=warnings||'"active_device_sessions"'::jsonb;end if;
 if (counts#>>'{shares,open}')::int>0 then warnings:=warnings||'"open_shares_revoked"'::jsonb;end if;
 if (counts#>>'{prova,in_progress}')::int>0 then warnings:=warnings||'"in_progress_attempts"'::jsonb;end if;
 if (counts->>'pending_task_reviews')::int>0 then warnings:=warnings||'"pending_task_reviews"'::jsonb;end if;
 if (counts#>>'{rewards,pending}')::int>0 then warnings:=warnings||'"pending_reward_requests"'::jsonb;end if;
 if (counts->>'co_parent_private_notes')::int>0 then warnings:=warnings||'"co_parent_private_notes_kept"'::jsonb;end if;
 if (counts->>'prova_drafts_referencing')::int>0 then warnings:=warnings||'"prova_drafts_keep_reference"'::jsonb;end if;
 return jsonb_build_object('fingerprint',encode(extensions.digest(state::text,'sha256'),'hex'),
  'summary',state||jsonb_build_object('warnings',warnings,
   'alternatives',jsonb_build_object('archive_available',c.archived_at is null,'already_archived',c.archived_at is not null),
   'subscription',jsonb_build_object('affected',false,'cancelled_by_deletion',false,'managed_in_store',true),
   'shares_active',(select count(*) from public.child_shares where child_id=c.id and revoked_at is null and expires_at>now())));
end;$$;
revoke all on function gina.deletion_child_state(uuid,uuid) from public,anon,authenticated,service_role;

-- Account deletion follows gina.prepare_account_deletion(): a family with another parent is
-- transferred (only personal rows go), the last parent's family is removed entirely.
create function gina.deletion_account_state(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam record;families jsonb:='[]';subs jsonb;state jsonb;warnings jsonb:='[]';others int;kids jsonb;mode text;
 fam_deletes jsonb;fam_preserved jsonb;billing_busy boolean:=false;archivable int:=0;
begin
 for fam in select f.* from public.families f where f.created_by=p_actor
  or exists(select 1 from public.family_members m where m.family_id=f.id and m.user_id=p_actor) order by f.id loop
  select count(*) into others from public.family_members m where m.family_id=fam.id and m.user_id<>p_actor;
  mode:=case when others>0 then 'transfer' else 'cascade' end;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'archived',c.archived_at is not null,
   'counts',case when others=0 then gina.deletion_child_counts(c.id,p_actor)-'co_parent_private_notes'-'prova_drafts_referencing' end) order by c.name,c.id),'[]') into kids
  from public.children c where c.family_id=fam.id;
  if mode='cascade' then
   fam_deletes:=jsonb_build_object(
    'children',(select count(*) from public.children where family_id=fam.id),
    'files',jsonb_build_object('count',(select count(*) from public.learning_sources where family_id=fam.id),'bytes',(select coalesce(sum(bytes),0) from public.learning_sources where family_id=fam.id),'storage_cleanup','queued'),
    'questions',(select count(*) from public.question_bank where family_id=fam.id),
    'rewards',(select count(*) from public.family_rewards where family_id=fam.id),
    'notes',(select count(*) from public.notes where family_id=fam.id),
    'prova_drafts',(select count(*) from public.prova_drafts where family_id=fam.id),
    'devices',(select count(*) from public.devices where family_id=fam.id and revoked_at is null),
    'anonymous_device_accounts',(select count(*) from public.devices d join auth.users u on u.id=d.auth_user_id where d.family_id=fam.id and u.is_anonymous),
    'shares_open',(select count(*) from public.child_shares where family_id=fam.id and revoked_at is null),
    'subscription_records',(select count(*) from public.store_subscriptions where family_id=fam.id),
    'ai_summaries',(select count(*) from public.ai_summaries where family_id=fam.id),
    'push_tokens',(select count(*) from public.push_tokens where family_id=fam.id));
   fam_preserved:=jsonb_build_object('store_billing_records',true,'usage_receipts_anonymised',true);
   warnings:=warnings||'"family_deleted"'::jsonb;
   archivable:=archivable+(select count(*) from public.children where family_id=fam.id and archived_at is null);
  else
   fam_deletes:=jsonb_build_object(
    'own_notes',(select count(*) from public.notes where family_id=fam.id and author_user_id=p_actor),
    'own_shares',(select count(*) from public.child_shares where family_id=fam.id and created_by=p_actor),
    'push_tokens',(select count(*) from public.push_tokens where family_id=fam.id and user_id=p_actor),
    'membership',1);
   fam_preserved:=jsonb_build_object('children',(select count(*) from public.children where family_id=fam.id),
    'co_parent_data',true,'family_content',true,'ownership_transferred',fam.created_by=p_actor);
   if fam.created_by=p_actor then warnings:=warnings||'"ownership_transferred"'::jsonb;end if;
  end if;
  if exists(select 1 from public.store_subscriptions s where s.family_id=fam.id and (s.status in('grace','on_hold')
    or exists(select 1 from public.store_notifications n where n.store_key=s.store_key and n.processed_at is null)))
   or exists(select 1 from gina.store_reconcile_jobs j where j.family_id=fam.id and j.status in('queued','processing')) then billing_busy:=true;end if;
  families:=families||jsonb_build_object('id',fam.id,'name',fam.name,'mode',mode,'other_parents',others,'children',kids,'deletes',fam_deletes,'preserved',fam_preserved);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'family_id',s.family_id,'platform',s.platform,'plan',s.plan,'status',s.status,'expires_at',s.expires_at,
  'auto_renewing',s.auto_renewing,'purchased_by_me',s.purchaser_user_id=p_actor,'cancelled_by_deletion',false,'managed_in_store',true) order by s.expires_at desc,s.id),'[]') into subs
 from public.store_subscriptions s where s.status in('active','grace','on_hold')
  and exists(select 1 from jsonb_array_elements(families) f where (f->>'id')::uuid=s.family_id);
 if jsonb_array_length(subs)>0 then warnings:=warnings||'"subscription_not_cancelled"'::jsonb;end if;
 if billing_busy then warnings:=warnings||'"billing_in_progress"'::jsonb;end if;
 state:=jsonb_build_object('kind','account','families',families,'subscriptions',subs);
 return jsonb_build_object('fingerprint',encode(extensions.digest(state::text,'sha256'),'hex'),
  'summary',state||jsonb_build_object('warnings',warnings,
   'alternatives',jsonb_build_object('archive_available',false,'archivable_children',archivable),
   'subscription',jsonb_build_object('affected',false,'cancelled_by_deletion',false,'managed_in_store',true,'active',jsonb_array_length(subs)>0)));
end;$$;
revoke all on function gina.deletion_account_state(uuid) from public,anon,authenticated,service_role;

-- Parent preview. p_target: {"kind":"child","child_id":"..."} or {"kind":"account"}.
create function public.deletion_preview(p_target jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();kind text;ch uuid;st jsonb;tok uuid;exp timestamptz;
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_target) is distinct from 'object' then raise exception 'deletion_target_invalid';end if;
 kind:=p_target->>'kind';
 if kind='child' then
  begin ch:=(p_target->>'child_id')::uuid;exception when others then raise exception 'deletion_target_invalid';end;
  if ch is null then raise exception 'deletion_target_invalid';end if;
  -- Share lock serialises the preview with a concurrent deletion of the same child.
  perform 1 from public.children where id=ch and family_id=f for share;
  if not found then raise exception 'forbidden' using errcode='42501';end if;
  st:=gina.deletion_child_state(ch,auth.uid());
 elsif kind='account' then
  st:=gina.deletion_account_state(auth.uid());
 else raise exception 'deletion_target_invalid';end if;
 delete from gina.deletion_previews where actor_id=auth.uid() and expires_at<now()-interval '1 day';
 if (select count(*) from gina.deletion_previews where actor_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'deletion_preview_rate_limited';end if;
 insert into gina.deletion_previews(actor_id,family_id,target_kind,child_id,fingerprint,summary,expires_at)
 values(auth.uid(),f,kind,ch,st->>'fingerprint',st->'summary',now()+interval '15 minutes') returning token,expires_at into tok,exp;
 return (st->'summary')||jsonb_build_object('preview_token',tok,'expires_at',exp,'generated_at',now(),'ttl_seconds',900);
end;$$;

-- Child deletion through a preview. Same request id repeats the same result; a stale, expired,
-- used or foreign preview never deletes. The delete itself is the existing RLS/cascade path.
create function public.confirm_child_deletion(p_request_id uuid,p_child_id uuid,p_preview_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();pv gina.deletion_previews;c public.children;payload jsonb;result jsonb;st jsonb;
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_child_id is null or p_preview_token is null then raise exception 'deletion_invalid';end if;
 payload:=jsonb_build_object('action','child.delete','family',f,'child',p_child_id,'token',p_preview_token);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into pv from gina.deletion_previews where token=p_preview_token for update;
 if not found or pv.actor_id<>auth.uid() or pv.target_kind<>'child' or pv.child_id is distinct from p_child_id or pv.family_id<>f then raise exception 'deletion_preview_not_found';end if;
 if pv.consumed_at is not null then raise exception 'deletion_preview_used';end if;
 if pv.expires_at<=now() then raise exception 'deletion_preview_expired';end if;
 select * into c from public.children where id=p_child_id and family_id=f for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 st:=gina.deletion_child_state(c.id,auth.uid());
 if st->>'fingerprint' is distinct from pv.fingerprint then raise exception 'deletion_preview_stale';end if;
 update gina.deletion_previews set consumed_at=now() where token=pv.token;
 delete from public.children where id=c.id;
 result:=jsonb_build_object('kind','child','deleted',true,'child_id',c.id,'name',c.name,'preserved',st#>'{summary,preserved}');
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- Service check used by the delete-account Edge function before auth.admin.deleteUser.
-- Not consumed here: a failed deletion keeps the token valid until expiry; success cascades it.
create function public.check_deletion_preview(p_token uuid,p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pv gina.deletion_previews;st jsonb;
begin
 if not gina.is_service() then raise exception 'forbidden' using errcode='42501';end if;
 if p_token is null or p_user_id is null then return jsonb_build_object('status','not_found');end if;
 select * into pv from gina.deletion_previews where token=p_token;
 if not found or pv.actor_id<>p_user_id or pv.target_kind<>'account' then return jsonb_build_object('status','not_found');end if;
 if pv.consumed_at is not null then return jsonb_build_object('status','used');end if;
 if pv.expires_at<=now() then return jsonb_build_object('status','expired','expires_at',pv.expires_at);end if;
 st:=gina.deletion_account_state(p_user_id);
 if st->>'fingerprint' is distinct from pv.fingerprint then return jsonb_build_object('status','stale');end if;
 return jsonb_build_object('status','ok','token',pv.token,'expires_at',pv.expires_at);
end;$$;

revoke all on function public.deletion_preview(jsonb),public.confirm_child_deletion(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.deletion_preview(jsonb),public.confirm_child_deletion(uuid,uuid,uuid) to authenticated;
revoke all on function public.check_deletion_preview(uuid,uuid) from public,anon,authenticated;
grant execute on function public.check_deletion_preview(uuid,uuid) to service_role;
