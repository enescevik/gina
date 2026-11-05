-- Personal notes are author-only, including previous revisions after sharing.
alter table public.notes add column revision integer not null default 1 check(revision>0);
alter table public.notes add column archived_at timestamptz;
create index notes_active_page on public.notes(family_id, updated_at desc, id desc) where archived_at is null;
create index notes_archive_page on public.notes(family_id, author_user_id, updated_at desc, id desc) where archived_at is not null;
create table gina.note_changes (
 id uuid primary key default gen_random_uuid(), note_id uuid not null references public.notes(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade, revision integer not null,
 action text not null, before_value jsonb, after_value jsonb not null,
 actor uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(note_id,revision)
);
revoke all on gina.note_changes from public,anon,authenticated,service_role;
-- Per-parent, content-free invalidations. Private changes do not even signal co-parents.
create table public.note_sync (
 family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 1, primary key(family_id,user_id)
);
alter table public.note_sync enable row level security;
revoke all on public.note_sync from public,anon,authenticated;
grant select on public.note_sync to authenticated;
create policy note_sync_read on public.note_sync for select to authenticated using(gina.is_parent() and family_id=gina.family_id() and user_id=auth.uid());
alter publication supabase_realtime add table public.note_sync;

drop policy notes_parent_all on public.notes;
create policy notes_parent_select on public.notes for select to authenticated using(family_id=gina.family_id() and gina.is_parent() and (author_user_id=auth.uid() or (visibility<>'private' and archived_at is null)));
create policy notes_parent_insert on public.notes for insert to authenticated with check(family_id=gina.family_id() and gina.is_parent() and author_user_id=auth.uid() and author_child_id is null);
drop policy notes_device_select on public.notes;
create policy notes_device_select on public.notes for select to authenticated using(family_id=gina.family_id() and gina.is_device() and child_id=gina.child_id() and archived_at is null and (visibility='child' or author_child_id=gina.child_id()));
drop policy notes_device_update_own on public.notes;
create policy notes_device_update_own on public.notes for update to authenticated using(family_id=gina.family_id() and gina.is_device() and author_child_id=gina.child_id() and archived_at is null) with check(family_id=gina.family_id() and gina.is_device() and child_id=gina.child_id() and author_child_id=gina.child_id() and author_user_id is null and archived_at is null and visibility in('child','family'));
revoke insert,update,delete on public.notes from authenticated;
grant insert(id,family_id,child_id,author_user_id,author_child_id,subject,title,body,visibility,created_at,updated_at) on public.notes to authenticated;
grant update(title,body,subject,visibility) on public.notes to authenticated;

create function gina.note_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
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
create trigger note_revision before insert or update on public.notes for each row execute function gina.note_revision();
create function gina.note_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare fam uuid;owner_id uuid;shared boolean;
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 if TG_OP='DELETE' then fam:=old.family_id;owner_id:=old.author_user_id;shared:=old.visibility<>'private';
 else
  fam:=new.family_id;owner_id:=new.author_user_id;shared:=new.visibility<>'private' or (TG_OP='UPDATE' and old.visibility<>'private');
  insert into gina.note_changes(note_id,family_id,revision,action,before_value,after_value,actor)
  values(new.id,new.family_id,new.revision,case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' else 'save' end,case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid());
 end if;
 insert into public.note_sync(family_id,user_id) select m.family_id,m.user_id from public.family_members m join public.families ff on ff.id=m.family_id join auth.users u on u.id=m.user_id where m.family_id=fam and (shared or m.user_id=owner_id)
 on conflict(family_id,user_id) do update set revision=public.note_sync.revision+1;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
create trigger note_audit after insert or update or delete on public.notes for each row execute function gina.note_audit();
revoke all on function gina.note_revision(),gina.note_audit() from public,anon,authenticated,service_role;

-- Parallel requests must not both consume the last available plan slot.
create or replace function gina.enforce_notes_limit() returns trigger language plpgsql security definer set search_path='' as $$
declare limit_count integer; used_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('notes.quota:'||new.family_id::text,0));
 select pl.max_notes into limit_count from public.plans pl join public.get_family_entitlement(new.family_id) e on pl.code=e.plan;
 if limit_count is not null then
  select count(*) into used_count from public.notes where family_id=new.family_id;
  if used_count>=limit_count then raise exception 'plan_limit_notes' using detail=format('limit=%s',limit_count);end if;
 end if;
 return new;
end;$$;

create function public.save_parent_note(p_request_id uuid,p_id uuid default null,p_revision integer default null,p_action text default 'save',p_child_id uuid default null,p_value jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();old public.notes;row public.notes;payload jsonb;result jsonb;v_title text;v_body text;v_subject text;v_visibility public.note_visibility;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is not null and not exists(select 1 from public.notes where id=p_id and family_id=f and author_user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_action is null or p_action not in('save','archive','restore') or p_value is null or jsonb_typeof(p_value)<>'object' or (p_id is null and (p_revision is not null or p_action<>'save')) or (p_id is not null and (p_revision is null or p_revision<1)) then raise exception 'note_invalid';end if;
 payload:=jsonb_build_object('action','note.change','family',f,'id',p_id,'revision',p_revision,'kind',p_action,'child',p_child_id,'value',p_value);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 if p_child_id is not null then
  if not exists(select 1 from public.children where id=p_child_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
  perform gina.require_active_child(p_child_id);
 end if;
 if p_id is not null then
  select * into old from public.notes where id=p_id and family_id=f and author_user_id=auth.uid() for update;
  if old.id is null or old.revision<>p_revision then raise exception 'note_changed';end if;
  if old.child_id is distinct from p_child_id then raise exception 'note_owner_immutable';end if;
 end if;
 if p_action='save' then
  if old.archived_at is not null then raise exception 'note_archived';end if;
  if not(p_value ?& array['title','body','subject','visibility']) or (select count(*) from jsonb_object_keys(p_value))<>4 or exists(select 1 from jsonb_each(p_value) x where jsonb_typeof(x.value)<>'string') then raise exception 'note_invalid';end if;
  v_title:=nullif(btrim(p_value->>'title'),'');v_body:=btrim(p_value->>'body');v_subject:=nullif(btrim(p_value->>'subject'),'');
  if p_value->>'visibility' not in('private','family','child') or length(coalesce(v_title,''))>120 or length(v_body) not between 1 and 4000 or length(coalesce(v_subject,''))>80 then raise exception 'note_invalid';end if;
  v_visibility:=(p_value->>'visibility')::public.note_visibility;
  if v_visibility='child' and p_child_id is null then raise exception 'note_child_required';end if;
  if p_id is null then
   insert into public.notes(family_id,child_id,author_user_id,title,body,subject,visibility) values(f,p_child_id,auth.uid(),v_title,v_body,v_subject,v_visibility) returning * into row;
  else
   update public.notes set title=v_title,body=v_body,subject=v_subject,visibility=v_visibility where id=p_id returning * into row;
  end if;
 else
  if p_value<>'{}'::jsonb or (p_action='archive' and old.archived_at is not null) or (p_action='restore' and old.archived_at is null) then raise exception 'note_changed';end if;
  -- Restoring a shared note always comes back private, to avoid unintentional re-sharing.
  if p_action='restore' then
   update public.notes set archived_at=null,visibility='private' where id=p_id returning * into row;
  else update public.notes set archived_at=now() where id=p_id returning * into row;end if;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision,'archived_at',row.archived_at,'visibility',row.visibility);
 perform gina.save_help_receipt(p_request_id,payload,result,f);return result;
end;$$;
create function public.note_history(p_id uuid,p_before_revision integer default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gina.is_parent() or not exists(select 1 from public.notes where id=p_id and family_id=gina.family_id() and author_user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
 if p_before_revision is not null and p_before_revision<1 then raise exception 'invalid_cursor';end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from(select revision,action,before_value,after_value,created_at from gina.note_changes where note_id=p_id and (p_before_revision is null or revision<p_before_revision) order by revision desc limit 21)v;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result) with ordinality r(v,n) where n<=20),'[]'),'has_more',jsonb_array_length(result)>20);
end;$$;
revoke all on function public.save_parent_note(uuid,uuid,integer,text,uuid,jsonb),public.note_history(uuid,integer) from public,anon,service_role;
grant execute on function public.save_parent_note(uuid,uuid,integer,text,uuid,jsonb),public.note_history(uuid,integer) to authenticated;
