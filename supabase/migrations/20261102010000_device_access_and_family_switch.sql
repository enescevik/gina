-- Explicit device access. Existing paired devices keep their previous PIN behaviour.
alter table public.devices add column access_mode text not null default 'all' check(access_mode in ('all','selected'));
alter table public.devices add column pin_policy text not null default 'existing' check(pin_policy in ('existing','required','none'));
create table public.device_children (
 device_id uuid references public.devices(id) on delete cascade,
 child_id uuid references public.children(id) on delete cascade,
 primary key(device_id, child_id)
);
alter table public.device_children enable row level security;
revoke all on public.device_children from anon, authenticated;
revoke update on public.devices from authenticated;

create function gina.device_allows(p_device_id uuid, p_child_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.devices d join public.children c on c.family_id=d.family_id
 where d.id=p_device_id and c.id=p_child_id and d.revoked_at is null
 and (d.access_mode='all' or exists(select 1 from public.device_children dc where dc.device_id=d.id and dc.child_id=c.id)));
$$;
revoke all on function gina.device_allows(uuid,uuid) from public,anon;
grant execute on function gina.device_allows(uuid,uuid) to authenticated,service_role;

create or replace function gina.is_device() returns boolean
language sql stable security definer set search_path='' as $$
 select gina.role()='device' and exists(select 1 from public.devices d
 where d.auth_user_id=auth.uid() and d.revoked_at is null and d.family_id=gina.family_id()
 and d.active_child_id is not distinct from gina.child_id()
 and (d.active_child_id is null or gina.device_allows(d.id,d.active_child_id)));
$$;
drop policy children_device_select on public.children;
create policy children_device_select on public.children for select to authenticated using (
 family_id=gina.family_id() and gina.is_device() and gina.device_allows((gina.claims()->>'device_id')::uuid,id)
);

create function public.configure_child_device(p_device_id uuid,p_name text,p_child_ids uuid[],p_pin_required boolean)
returns void language plpgsql security definer set search_path='' as $$
declare d public.devices; n integer;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.devices where id=p_device_id and family_id=gina.family_id() and revoked_at is null for update;
 if d.id is null then raise exception 'device_not_found'; end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 60 or p_pin_required is null or coalesce(cardinality(p_child_ids),0)=0 then raise exception 'invalid_device_config'; end if;
 select count(distinct id) into n from public.children where id=any(p_child_ids) and family_id=d.family_id;
 if n<>cardinality(p_child_ids) then raise exception 'child_not_found'; end if;
 if p_pin_required and exists(select 1 from unnest(p_child_ids) id where not exists(select 1 from public.child_pins p where p.child_id=id)) then raise exception 'child_pin_required'; end if;
 update public.devices set name=trim(p_name),access_mode='selected',pin_policy=case when p_pin_required then 'required' else 'none' end, active_child_id=null where id=d.id;
 delete from public.device_children where device_id=d.id;
 insert into public.device_children select d.id,unnest(p_child_ids);
end; $$;

create function public.get_child_device_access(p_device_id uuid default null) returns jsonb
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
 from public.children c where c.family_id=d.family_id and (gina.is_parent() or gina.device_allows(d.id,c.id))));
end; $$;

create or replace function public.child_pin_login(p_child_id uuid,p_pin text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.devices; p public.child_pins; needs_pin boolean;
begin
 select * into d from public.devices where auth_user_id=auth.uid() and revoked_at is null for update;
 if d.id is null or not gina.device_allows(d.id,p_child_id) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into p from public.child_pins where child_id=p_child_id for update;
 needs_pin:=d.pin_policy='required' or (d.pin_policy='existing' and p.child_id is not null);
 if needs_pin then
  if p.child_id is null then raise exception 'child_pin_required'; end if;
  if p.locked_until>now() then raise exception 'pin_locked'; end if;
  if p_pin is null or p_pin !~ '^\d{4}$' or p.pin_hash<>extensions.crypt(p_pin,p.pin_hash) then
   update public.child_pins set failed_count=case when locked_until<=now() then 1 else least(failed_count+1,5) end,
    locked_until=case when locked_until<=now() then null when failed_count+1>=5 then now()+interval '60 seconds' else null end,updated_at=now() where child_id=p_child_id;
   return false;
  end if;
  update public.child_pins set failed_count=0,locked_until=null where child_id=p_child_id;
 end if;
 update public.devices set active_child_id=p_child_id,last_seen_at=now() where id=d.id;
 return true;
end; $$;

-- Re-pairing must never inherit the former family's selected children or PIN exemption.
create function gina.reset_device_access_on_pair() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.paired_at is distinct from old.paired_at or new.family_id is distinct from old.family_id or (old.revoked_at is not null and new.revoked_at is null) then
  new.access_mode:='all'; new.pin_policy:='existing'; new.active_child_id:=null;
  delete from public.device_children where device_id=old.id;
 end if;
 return new;
end; $$;
create trigger reset_device_access before update on public.devices for each row execute function gina.reset_device_access_on_pair();

-- Family choice preserves both families and every child's history. No implicit merge/deletion.
drop index public.family_members_user_idx;
create index family_members_user_idx on public.family_members(user_id);
create table public.active_families (
 user_id uuid primary key references auth.users(id) on delete cascade,
 family_id uuid not null,
 foreign key(family_id,user_id) references public.family_members(family_id,user_id) on delete cascade
);
alter table public.active_families enable row level security;
revoke all on public.active_families from anon,authenticated;
grant select on public.active_families to supabase_auth_admin;
grant select on public.active_families to service_role;
create policy active_families_hook on public.active_families for select to supabase_auth_admin using(true);

create function public.list_my_families() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'children',
 (select count(*) from public.children c where c.family_id=f.id),'active',f.id=gina.family_id()) order by m.created_at),'[]'::jsonb)
 from public.family_members m join public.families f on f.id=m.family_id where m.user_id=auth.uid();
$$;
create function public.select_family(p_family_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where user_id=auth.uid() and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 insert into public.active_families values(auth.uid(),p_family_id) on conflict(user_id) do update set family_id=excluded.family_id;
end; $$;
-- Revoke old active-family JWTs immediately after switching, not just after token expiry.
create or replace function gina.is_parent() returns boolean language sql stable security definer set search_path='' as $$
 select gina.role()='parent' and exists(select 1 from public.family_members m where m.user_id=auth.uid() and m.family_id=gina.family_id())
 and not exists(select 1 from public.active_families a where a.user_id=auth.uid() and a.family_id<>gina.family_id());
$$;

create table public.family_invite_attempts (user_id uuid references auth.users(id) on delete cascade, tried_at timestamptz not null default now());
create index on public.family_invite_attempts(user_id,tried_at);
alter table public.family_invite_attempts enable row level security;
revoke all on public.family_invite_attempts from anon,authenticated;
create function public.preview_family_invite(p_invite_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.families;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or exists(select 1 from public.devices where auth_user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7));
 delete from public.family_invite_attempts where user_id=auth.uid() and tried_at<now()-interval '10 minutes';
 if (select count(*) from public.family_invite_attempts where user_id=auth.uid())>=10 then return jsonb_build_object('error','invite_rate_limited'); end if;
 insert into public.family_invite_attempts(user_id) values(auth.uid());
 select * into f from public.families where invite_code=upper(trim(p_invite_code));
 if f.id is null then return jsonb_build_object('error','invalid_invite_code'); end if;
 return jsonb_build_object('id',f.id,'name',f.name,'children',(select count(*) from public.children where family_id=f.id),
 'already_member',exists(select 1 from public.family_members where user_id=auth.uid() and family_id=f.id));
end; $$;
create or replace function public.join_family(p_invite_code text,p_display_name text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare target jsonb; fid uuid;
begin
 target:=public.preview_family_invite(p_invite_code);
 -- Return null for invalid/rate limited attempts so the rate-limit record is committed.
 if target ? 'error' then return null; end if;
 fid:=(target->>'id')::uuid;
 if (select count(*) from public.family_members where user_id=auth.uid())>=5 and not exists(select 1 from public.family_members where user_id=auth.uid() and family_id=fid) then raise exception 'family_limit'; end if;
 insert into public.family_members(family_id,user_id,role,display_name) values(fid,auth.uid(),'parent',p_display_name) on conflict(family_id,user_id) do nothing;
 perform public.select_family(fid);
 return fid;
end; $$;

revoke all on function public.configure_child_device(uuid,text,uuid[],boolean),public.get_child_device_access(uuid),public.list_my_families(),public.select_family(uuid),public.preview_family_invite(text) from public,anon;
grant execute on function public.configure_child_device(uuid,text,uuid[],boolean),public.get_child_device_access(uuid),public.list_my_families(),public.select_family(uuid),public.preview_family_invite(text) to authenticated;

-- Custom Access Token Hook: her token üretiminde JWT'ye `gina` claim'ini yazar.
-- Supabase Dashboard / config.toml'da hook etkinleştirilir: pg-functions://postgres/public/custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_family_id uuid;
  v_role text := 'none';
  v_device_id uuid;
  v_child_id uuid;
  v_admin boolean := false;
begin
  select m.family_id into v_family_id
  from public.family_members m
  where m.user_id = v_user_id
  order by exists(select 1 from public.active_families a where a.user_id=v_user_id and a.family_id=m.family_id) desc, m.created_at, m.family_id
  limit 1;

  if v_family_id is not null then
    v_role := 'parent';
  else
    select d.family_id, d.id, d.active_child_id
      into v_family_id, v_device_id, v_child_id
    from public.devices d
    where d.auth_user_id = v_user_id and d.revoked_at is null;

    if v_family_id is not null then
      v_role := 'device';
    end if;
  end if;

  select exists (select 1 from public.admins a where a.user_id = v_user_id) into v_admin;

  v_claims := jsonb_set(
    v_claims,
    '{gina}',
    jsonb_build_object(
      'family_id', v_family_id,
      'role', v_role,
      'device_id', v_device_id,
      'child_id', v_child_id,
      'admin', v_admin
    )
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;


-- Preserve the legacy pairing RPC for installed clients. New clients explicitly
-- request selection-before-entry; both pairing and the restriction commit together.
create function public.pair_child_device(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_device_id uuid;
begin
 v_device_id:=public.pair_device(p_code);
 update public.devices set access_mode='selected',pin_policy='required',active_child_id=null where id=v_device_id;
 delete from public.device_children where device_children.device_id=v_device_id;
 return v_device_id;
end; $$;
revoke all on function public.pair_child_device(text) from public,anon;
grant execute on function public.pair_child_device(text) to authenticated;
