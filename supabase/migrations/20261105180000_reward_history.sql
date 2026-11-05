-- Catalogue changes must not rewrite a child's requested/earned reward.
alter table public.family_rewards add column revision integer not null default 1 check(revision>0);
alter table public.family_rewards add column archived_at timestamptz;
alter table public.family_rewards add constraint reward_archive_inactive check(archived_at is null or not active);
alter table public.reward_requests add column reward_snapshot jsonb;
-- Metadata only, including archived profiles: the original art was not recorded.
-- Mark these as migration observations, not original request evidence.
alter table public.reward_requests disable trigger archive_write_guard;
update public.reward_requests q set reward_snapshot=jsonb_build_object('title',r.title,'icon',r.icon,'origin','migration') from public.family_rewards r where r.id=q.reward_id;
alter table public.reward_requests enable trigger archive_write_guard;
create table gina.reward_changes (
 id uuid primary key default gen_random_uuid(), reward_id uuid not null references public.family_rewards(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade, revision integer not null,
 action text not null, before_value jsonb, after_value jsonb not null,
 actor uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(reward_id,revision)
);
revoke all on gina.reward_changes from public,anon,authenticated,service_role;
create function gina.reward_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.family_id<>old.family_id or new.id<>old.id then raise exception 'reward_owner_immutable';end if;
 if old.archived_at is not null and new.active then raise exception 'reward_restore_paused';end if;
 if (new.title,new.icon,new.cost_stars) is distinct from (old.title,old.icon,old.cost_stars)
 or (old.archived_at is null and new.archived_at is not null) then
  if exists(select 1 from public.child_goals where reward_id=old.id and status='active') then raise exception 'reward_has_goals';end if;
 end if;
 if (to_jsonb(new)-array['revision','updated_at']) is distinct from (to_jsonb(old)-array['revision','updated_at']) then new.revision:=old.revision+1;else new.revision:=old.revision;end if;
 return new;
end;$$;
create trigger reward_revision before update on public.family_rewards for each row execute function gina.reward_revision();
-- Pausing removes some catalogue rows from device RLS; send an empty family signal.
create table public.reward_catalog_sync (
 family_id uuid primary key references public.families(id) on delete cascade,
 revision bigint not null default 1
);
alter table public.reward_catalog_sync enable row level security;
revoke all on public.reward_catalog_sync from public,anon,authenticated;
grant select on public.reward_catalog_sync to authenticated;
create policy reward_catalog_sync_read on public.reward_catalog_sync for select to authenticated
 using(family_id=gina.family_id() and (gina.is_parent() or gina.is_device()));
alter publication supabase_realtime add table public.reward_catalog_sync;
create function gina.reward_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 insert into gina.reward_changes(reward_id,family_id,revision,action,before_value,after_value,actor)
 values(new.id,new.family_id,new.revision,
 case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end,
 case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid());
 insert into public.reward_catalog_sync(family_id) values(new.family_id) on conflict(family_id) do update set revision=public.reward_catalog_sync.revision+1;
 return new;
end;$$;
create trigger reward_audit after insert or update on public.family_rewards for each row execute function gina.reward_audit();
create function gina.freeze_reward_request() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.family_rewards;
begin
 if TG_OP='UPDATE' then
  if (new.family_id,new.child_id,new.reward_id,new.cost_snapshot,new.idempotency_key) is distinct from (old.family_id,old.child_id,old.reward_id,old.cost_snapshot,old.idempotency_key) then raise exception 'reward_request_immutable';end if;
  new.reward_snapshot:=old.reward_snapshot;return new;
 end if;
 select * into r from public.family_rewards where id=new.reward_id for share;
 if r.family_id is distinct from new.family_id or not exists(select 1 from public.children where id=new.child_id and family_id=new.family_id) then raise exception 'wrong_child';end if;
 if not r.active or r.archived_at is not null then raise exception 'reward_not_found';end if;
 new.cost_snapshot:=r.cost_stars;
 new.reward_snapshot:=jsonb_build_object('title',r.title,'icon',r.icon,'origin','request');return new;
end;$$;
create trigger freeze_reward_request before insert or update on public.reward_requests for each row execute function gina.freeze_reward_request();
-- An active goal keeps the catalogue identity stable, including during a concurrent edit.
create function gina.guard_reward_goal() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.family_rewards;
begin
 if TG_OP='UPDATE' and (new.family_id,new.child_id,new.reward_id) is distinct from (old.family_id,old.child_id,old.reward_id) then raise exception 'goal_owner_immutable';end if;
 if TG_OP='INSERT' or (new.status='active' and old.status<>'active') then
  select * into r from public.family_rewards where id=new.reward_id for share;
  if r.family_id is distinct from new.family_id or not exists(select 1 from public.children where id=new.child_id and family_id=new.family_id) then raise exception 'wrong_child';end if;
  if not r.active or r.archived_at is not null then raise exception 'reward_not_found';end if;
 end if;return new;
end;$$;
create trigger guard_reward_goal before insert or update on public.child_goals for each row execute function gina.guard_reward_goal();
revoke all on function gina.reward_revision(),gina.reward_audit(),gina.freeze_reward_request(),gina.guard_reward_goal() from public,anon,authenticated,service_role;
revoke insert,update,delete on public.family_rewards from authenticated;
grant insert(id,family_id,title,icon,cost_stars,active,created_by,created_at,updated_at) on public.family_rewards to authenticated;
grant update(active) on public.family_rewards to authenticated;
-- Existing paused goals remain readable to their child, without exposing unrelated paused items.
drop policy family_rewards_device_select on public.family_rewards;
create policy family_rewards_device_select on public.family_rewards for select to authenticated using(family_id=gina.family_id() and gina.is_device() and (active or exists(select 1 from public.child_goals g where g.reward_id=family_rewards.id and g.child_id=gina.child_id() and g.status='active')));

create function public.change_reward(p_request_id uuid,p_id uuid,p_revision integer,p_action text,p_value jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();old public.family_rewards;row public.family_rewards;payload jsonb;result jsonb;v_title text;v_cost int;
begin
 if not gina.is_parent() or f is null or not exists(select 1 from public.family_rewards where id=p_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('save','pause','resume','archive','restore') or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'reward_invalid';end if;
 payload:=jsonb_build_object('action','reward.change','family',f,'id',p_id,'revision',p_revision,'kind',p_action,'value',p_value);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into old from public.family_rewards where id=p_id and family_id=f for update;
 if old.id is null or old.revision<>p_revision then raise exception 'reward_changed';end if;
 if p_action='restore' then
  if old.archived_at is null or p_value<>'{}'::jsonb then raise exception 'reward_changed';end if;
  update public.family_rewards set archived_at=null,active=false where id=p_id returning * into row;
 else
  if old.archived_at is not null then raise exception 'reward_archived';end if;
  if p_action='save' then
   if (select count(*) from jsonb_object_keys(p_value))<>2 or not(p_value ?& array['title','cost_stars']) or jsonb_typeof(p_value->'title') is distinct from 'string' or jsonb_typeof(p_value->'cost_stars') is distinct from 'number' then raise exception 'reward_invalid';end if;
   begin v_title:=btrim(p_value->>'title');v_cost:=(p_value->>'cost_stars')::int;exception when others then raise exception 'reward_invalid';end;
   if length(v_title) not between 1 and 80 or v_cost not between 1 and 500 or (p_value->>'cost_stars')::numeric<>v_cost then raise exception 'reward_invalid';end if;
   update public.family_rewards set title=v_title,cost_stars=v_cost where id=p_id returning * into row;
  else
   if p_value<>'{}'::jsonb or (p_action='pause' and not old.active) or (p_action='resume' and old.active) then raise exception 'reward_changed';end if;
   update public.family_rewards set active=(p_action='resume'),archived_at=case when p_action='archive' then now() else null end where id=p_id returning * into row;
  end if;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'archived_at',row.archived_at,'active',row.active);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;
create function public.reward_history(p_id uuid,p_before_revision integer default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gina.is_parent() or not exists(select 1 from public.family_rewards where id=p_id and family_id=gina.family_id()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_before_revision is not null and p_before_revision<1 then raise exception 'invalid_cursor';end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from (select revision,action,before_value,after_value,created_at from gina.reward_changes where reward_id=p_id and (p_before_revision is null or revision<p_before_revision) order by revision desc limit 21)v;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=20),'[]'),'has_more',jsonb_array_length(result)>20,
 'pending',(select count(*) from public.reward_requests where reward_id=p_id and status='requested'),
 'approved',(select count(*) from public.reward_requests where reward_id=p_id and status='approved'),
 'goals',coalesce((select jsonb_agg(jsonb_build_object('child_id',c.id,'name',c.name,'archived',c.archived_at is not null) order by c.name,c.id) from public.child_goals g join public.children c on c.id=g.child_id where g.reward_id=p_id and g.status='active'),'[]'));
end;$$;
revoke all on function public.change_reward(uuid,uuid,integer,text,jsonb),public.reward_history(uuid,integer) from public,anon,service_role;
grant execute on function public.change_reward(uuid,uuid,integer,text,jsonb),public.reward_history(uuid,integer) to authenticated;

-- Serialize retries before balance checking and scope their result to this child/reward.
create or replace function public.request_reward(p_reward_id uuid,p_idempotency_key uuid,p_acting_child_id uuid default null)
returns public.reward_requests language plpgsql security definer set search_path='' as $$
declare ch uuid;f uuid:=gina.family_id();r public.family_rewards;q public.reward_requests;goal uuid;
begin
 if gina.is_device() then ch:=gina.child_id();elsif gina.is_parent() then ch:=p_acting_child_id;else raise exception 'forbidden' using errcode='42501';end if;
 if ch is null or f is null or not exists(select 1 from public.children where id=ch and family_id=f) then raise exception 'child_not_found' using errcode='42501';end if;
 if p_idempotency_key is null or p_reward_id is null then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtext('reward-request:'||p_idempotency_key::text));
 select * into q from public.reward_requests where idempotency_key=p_idempotency_key;
 if found then
  if q.family_id<>f or q.child_id<>ch or q.reward_id<>p_reward_id then raise exception 'request_conflict';end if;return q;
 end if;
 perform gina.require_active_child(ch);
 select * into r from public.family_rewards where id=p_reward_id and family_id=f and active and archived_at is null for share;
 if not found then raise exception 'reward_not_found';end if;
 perform pg_advisory_xact_lock(hashtext('stars:'||ch::text));
 if gina.child_star_balance(ch)<r.cost_stars then raise exception 'insufficient_stars';end if;
 select id into goal from public.child_goals where child_id=ch and reward_id=p_reward_id and status='active';
 insert into public.reward_requests(family_id,child_id,reward_id,goal_id,cost_snapshot,idempotency_key) values(f,ch,p_reward_id,goal,r.cost_stars,p_idempotency_key) returning * into q;return q;
end;$$;
