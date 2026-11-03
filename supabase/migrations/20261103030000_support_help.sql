-- Dedicated operators never receive the broad admins claim. All access checks
-- consult live membership; revocation works before the JWT expires.
create table public.operations_members (
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in('support','content','finance','release')),
 granted_by uuid references auth.users(id) on delete set null,
 expires_at timestamptz not null, revoked_at timestamptz,
 primary key(user_id,role)
);
create function gina.has_operation_role(p_role text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(gina.role(),'none')<>'device'
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and (coalesce(gina.is_admin_strict(),false) or exists(select 1 from public.operations_members
   where user_id=auth.uid() and role=p_role and revoked_at is null and expires_at>now()));
$$;
revoke all on function gina.has_operation_role(text) from public,anon;
grant execute on function gina.has_operation_role(text) to authenticated,service_role;

create table public.help_tickets (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 kind text not null check(kind in('support','idea')),
 category text not null check(category in('account','device','learning','billing','other')),
 subject text not null check(length(trim(subject)) between 3 and 160),
 status text not null default 'open' check(status in('open','in_progress','waiting_parent','resolved','closed')),
 revision int not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.help_tickets(family_id,updated_at desc);
create index on public.help_tickets(kind,status,updated_at desc);
create table public.help_messages (
 sequence bigint generated always as identity primary key,
 ticket_id uuid not null references public.help_tickets(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,
 author_role text not null check(author_role in('parent','support')),
 visibility text not null check(visibility in('family','internal')),
 body text not null check(length(trim(body)) between 1 and 6000),
 created_at timestamptz not null default now(),
 check(author_role='support' or visibility='family')
);
create index on public.help_messages(ticket_id,sequence);
create index on public.help_messages(author_id,created_at);
create table public.help_receipts (
 actor_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 family_id uuid references public.families(id) on delete cascade,
 payload_hash text not null, result jsonb not null,
 primary key(actor_id,request_id)
);
-- No private message text, names or attachments are duplicated in audit logs.
create function gina.help_receipt(p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.help_receipts; h text;
begin
 if p_request is null or auth.uid() is null then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,81));
 h:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 select * into old from public.help_receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if old.payload_hash<>h then raise exception 'request_conflict';end if;
  return old.result;
 end if;
 return null;
end;$$;
create function gina.save_help_receipt(p_request uuid,p_payload jsonb,p_result jsonb,p_family uuid) returns void
language sql security definer set search_path='' as $$
 insert into public.help_receipts values(auth.uid(),p_request,p_family,encode(extensions.digest(p_payload::text,'sha256'),'hex'),p_result);
$$;
revoke all on function gina.help_receipt(uuid,jsonb),gina.save_help_receipt(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;

create function public.create_help_ticket(p_request_id uuid,p_kind text,p_category text,p_subject text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); payload jsonb; result jsonb; ticket uuid;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('support','idea') or p_category is null or p_category not in('account','device','learning','billing','other')
 or length(trim(coalesce(p_subject,''))) not between 3 and 160 or length(trim(coalesce(p_body,''))) not between 1 and 6000 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action','create','family',f,'kind',p_kind,'category',p_category,'subject',trim(p_subject),'body',trim(p_body));
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 if (select count(*) from public.help_tickets where created_by=auth.uid() and created_at>now()-interval '1 day')>=15 then raise exception 'help_rate_limited';end if;
 insert into public.help_tickets(family_id,created_by,kind,category,subject) values(f,auth.uid(),p_kind,p_category,trim(p_subject)) returning id into ticket;
 insert into public.help_messages(ticket_id,author_id,author_role,visibility,body) values(ticket,auth.uid(),'parent','family',trim(p_body));
 result:=jsonb_build_object('id',ticket,'revision',1,'status','open');
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- Explicit expected revision protects status changes and two simultaneous replies.
-- A retry replays the receipt before checking revision; no duplicate reply/event.
create function public.reply_help_ticket(p_request_id uuid,p_ticket_id uuid,p_revision int,p_body text,p_internal boolean default false,p_status text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.help_tickets; operator boolean:=gina.has_operation_role('support'); payload jsonb; result jsonb; next_status text;
begin
 select * into t from public.help_tickets where id=p_ticket_id;
 if t.id is null or not (operator or (coalesce(gina.is_parent(),false) and t.family_id=gina.family_id())) then raise exception 'forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<1 or p_internal is null or (not operator and p_internal) then raise exception 'invalid_input';end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 6000 then raise exception 'invalid_input';end if;
 if p_status is not null and ((operator and p_status not in('open','in_progress','waiting_parent','resolved','closed')) or (not operator and p_status not in('open','closed'))) then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action','reply','ticket',t.id,'revision',p_revision,'body',trim(p_body),'internal',p_internal,'status',p_status);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into t from public.help_tickets where id=p_ticket_id for update;
 if t.revision<>p_revision then raise exception 'help_changed';end if;
 if t.status in('resolved','closed') and p_status is distinct from 'open' then raise exception 'help_reopen_required';end if;
 if not operator and (select count(*) from public.help_messages where author_id=auth.uid() and created_at>now()-interval '1 day')>=100 then raise exception 'help_rate_limited';end if;
 next_status:=coalesce(p_status,case when not operator and t.status='waiting_parent' then 'open' else t.status end);
 insert into public.help_messages(ticket_id,author_id,author_role,visibility,body)
 values(t.id,auth.uid(),case when operator then 'support' else 'parent' end,case when p_internal then 'internal' else 'family' end,trim(p_body));
 update public.help_tickets set revision=revision+1,status=next_status,updated_at=now() where id=t.id;
 if operator then
  insert into public.audit_log(actor_id,action,target_table,target_id,family_id,details)
  values(auth.uid(),'help.reply','help_tickets',t.id::text,t.family_id,jsonb_build_object('internal',p_internal,'from',t.status,'to',next_status,'revision',t.revision+1));
 end if;
 result:=jsonb_build_object('id',t.id,'revision',t.revision+1,'status',next_status);
 perform gina.save_help_receipt(p_request_id,payload,result,t.family_id);
 return result;
end;$$;

create function public.list_help_tickets(p_operator boolean default false,p_kind text default null,p_status text default null,p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_operator is null or (p_operator and not gina.has_operation_role('support')) or (not p_operator and not coalesce(gina.is_parent(),false)) then raise exception 'forbidden' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or (p_kind is not null and p_kind not in('support','idea')) or (p_status is not null and p_status not in('open','in_progress','waiting_parent','resolved','closed')) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
  select id,kind,category,subject,status,revision,created_at,updated_at from public.help_tickets
  where (p_operator or family_id=gina.family_id()) and (p_kind is null or kind=p_kind) and (p_status is null or status=p_status)
  order by updated_at desc,id limit 50 offset p_offset
 )t);
end;$$;
create function public.get_help_ticket(p_ticket_id uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.help_tickets; operator boolean:=gina.has_operation_role('support');
begin
 select * into t from public.help_tickets where id=p_ticket_id;
 if t.id is null or not (operator or (coalesce(gina.is_parent(),false) and t.family_id=gina.family_id())) then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('id',t.id,'kind',t.kind,'category',t.category,'subject',t.subject,'status',t.status,'revision',t.revision,
 'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence),'[]') from (
  select sequence,author_role,visibility,body,created_at from public.help_messages
  where ticket_id=t.id and (operator or visibility='family') and (p_before is null or sequence<p_before)
  order by sequence desc limit 100
 )m));
end;$$;

-- Editing a draft never replaces the currently published revision.
create table public.help_articles (
 id uuid primary key, slug text not null, locale text not null check(locale in('tr','en')),
 platform text not null check(platform in('all','ios','android','web')),
 revision int not null, published_revision int, unique(slug,locale,platform),
 check(slug ~ '^[a-z0-9][a-z0-9-]{1,79}$')
);
create table public.help_article_versions (
 article_id uuid not null references public.help_articles(id) on delete cascade,
 revision int not null, title text not null check(length(trim(title)) between 3 and 160),
 body text not null check(length(trim(body)) between 10 and 20000),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,
 primary key(article_id,revision)
);
alter table public.help_articles add foreign key(id,published_revision) references public.help_article_versions(article_id,revision) deferrable initially deferred;
create function public.save_help_article(p_request_id uuid,p_id uuid,p_revision int,p_slug text,p_locale text,p_platform text,p_title text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.help_articles; payload jsonb; result jsonb;
begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_revision is null or p_revision<0 or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$'
 or p_locale is null or p_locale not in('tr','en') or p_platform is null or p_platform not in('all','ios','android','web')
 or length(trim(coalesce(p_title,''))) not between 3 and 160 or length(trim(coalesce(p_body,''))) not between 10 and 20000 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action','article','id',p_id,'revision',p_revision,'slug',p_slug,'locale',p_locale,'platform',p_platform,'title',trim(p_title),'body',trim(p_body));
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,82));
 select * into a from public.help_articles where id=p_id for update;
 if coalesce(a.revision,0)<>p_revision then raise exception 'help_changed';end if;
 if a.id is not null and (a.slug<>p_slug or a.locale<>p_locale or a.platform<>p_platform) then raise exception 'article_identity_changed';end if;
 if a.id is null then insert into public.help_articles(id,slug,locale,platform,revision) values(p_id,p_slug,p_locale,p_platform,1);
 else update public.help_articles set revision=revision+1 where id=p_id;end if;
 insert into public.help_article_versions(article_id,revision,title,body,created_by) values(p_id,p_revision+1,trim(p_title),trim(p_body),auth.uid());
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'help.article_saved','help_articles',p_id::text,result);
 return result;
end;$$;

create function public.review_help_article(p_request_id uuid,p_id uuid,p_revision int,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.help_articles; payload jsonb; result jsonb;
begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 if p_action is null or p_action not in('review','publish','archive') or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('action',p_action,'id',p_id,'revision',p_revision,'reason',trim(p_reason));
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into a from public.help_articles where id=p_id for update;
 if a.id is null then raise exception 'article_not_found';end if;
 if p_revision is null or a.revision<>p_revision then raise exception 'help_changed';end if;
 if p_action='review' then
  update public.help_article_versions set reviewed_by=auth.uid(),reviewed_at=now() where article_id=p_id and revision=p_revision;
 elsif p_action='publish' then
  if not exists(select 1 from public.help_article_versions where article_id=p_id and revision=p_revision and reviewed_at is not null) then raise exception 'article_review_required';end if;
  update public.help_articles set published_revision=p_revision where id=p_id;
 else update public.help_articles set published_revision=null where id=p_id;end if;
 result:=jsonb_build_object('id',p_id,'revision',p_revision,'action',p_action);
 perform gina.save_help_receipt(p_request_id,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details) values(auth.uid(),'help.article_'||p_action,'help_articles',p_id::text,trim(p_reason),result);
 return result;
end;$$;
create function public.get_help_articles(p_locale text default 'tr',p_platform text default 'all',p_editor boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or (p_editor and not gina.has_operation_role('content')) then raise exception 'forbidden' using errcode='42501';end if;
 if p_editor is null or p_locale is null or p_locale not in('tr','en') or p_platform is null or p_platform not in('all','ios','android','web') then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'slug',a.slug,'locale',a.locale,'platform',a.platform,'revision',v.revision,
 'published_revision',a.published_revision,'title',v.title,'body',v.body,'reviewed_at',v.reviewed_at) order by a.slug,a.platform),'[]')
 from public.help_articles a join public.help_article_versions v on v.article_id=a.id and v.revision=case when p_editor then a.revision else a.published_revision end
 where a.locale=p_locale and a.platform in('all',p_platform));
end;$$;

create function public.set_operation_member(p_user_id uuid,p_role text,p_expires_at timestamptz,p_revoke boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_user_id is null or p_role is null or p_role not in('support','content','finance','release') or p_revoke is null or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_input';end if;
 if not p_revoke and (p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '1 year') then raise exception 'invalid_input';end if;
 if p_revoke then update public.operations_members set revoked_at=now() where user_id=p_user_id and role=p_role;
 else
  if exists(select 1 from public.devices where auth_user_id=p_user_id) or not exists(select 1 from auth.users where id=p_user_id and not is_anonymous) then raise exception 'operator_account_required';end if;
  insert into public.operations_members(user_id,role,granted_by,expires_at) values(p_user_id,p_role,auth.uid(),p_expires_at)
  on conflict(user_id,role) do update set granted_by=auth.uid(),expires_at=excluded.expires_at,revoked_at=null;
 end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,reason,details) values(auth.uid(),'operations.member','operations_members',p_user_id::text,trim(p_reason),jsonb_build_object('role',p_role,'revoked',p_revoke,'expires_at',p_expires_at));
end;$$;
create function public.my_operation_roles() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]') from unnest(array['support','content','finance','release']) r where gina.has_operation_role(r);
$$;

do $$declare t text;begin
 foreach t in array array['operations_members','help_tickets','help_messages','help_receipts','help_articles','help_article_versions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end;$$;
revoke all on function public.create_help_ticket(uuid,text,text,text,text),public.reply_help_ticket(uuid,uuid,int,text,boolean,text),public.list_help_tickets(boolean,text,text,int),public.get_help_ticket(uuid,bigint),public.save_help_article(uuid,uuid,int,text,text,text,text,text),public.review_help_article(uuid,uuid,int,text,text),public.get_help_articles(text,text,boolean),public.set_operation_member(uuid,text,timestamptz,boolean,text),public.my_operation_roles() from public,anon;
grant execute on function public.create_help_ticket(uuid,text,text,text,text),public.reply_help_ticket(uuid,uuid,int,text,boolean,text),public.list_help_tickets(boolean,text,text,int),public.get_help_ticket(uuid,bigint),public.save_help_article(uuid,uuid,int,text,text,text,text,text),public.review_help_article(uuid,uuid,int,text,text),public.get_help_articles(text,text,boolean),public.set_operation_member(uuid,text,timestamptz,boolean,text),public.my_operation_roles() to authenticated;
