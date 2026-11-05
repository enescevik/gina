-- Service announcements only. No marketing, email or SMS delivery is inferred
-- from having a contact address. Push remains a separate, opt-out channel.
create table gina.parent_announcements (
 id uuid primary key default gen_random_uuid(), title text not null, body text not null,
 place_id uuid references gina.education_places(id), stage text check(stage in('preschool','primary','middle','high','university')),
 push boolean not null default true, expires_on date not null,
 status text not null default 'draft' check(status in('draft','published','withdrawn')),
 revision int not null default 1, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),published_at timestamptz, recipient_count int,
 check(length(trim(title)) between 3 and 160), check(length(trim(body)) between 10 and 4000)
);
create table gina.parent_inbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 announcement_id uuid references gina.parent_announcements(id), child_id uuid references public.children(id) on delete cascade,
 event_key text not null, kind text not null check(kind in('announcement','education_start','education_end')),
 title text not null, body text not null, expires_on date not null,
 read_at timestamptz, archived_at timestamptz, created_at timestamptz not null default now(),
 unique(user_id,event_key)
);
create index parent_inbox_owner on gina.parent_inbox(user_id,family_id,created_at desc,id);
create table gina.education_notification_settings (singleton boolean primary key default true check(singleton),reminders_enabled boolean not null default false,revision int not null default 1);
insert into gina.education_notification_settings default values;
revoke all on gina.parent_announcements,gina.parent_inbox,gina.education_notification_settings from public,anon,authenticated,service_role;
alter table gina.parent_announcements enable row level security;
alter table gina.parent_inbox enable row level security;
alter table gina.education_notification_settings enable row level security;
alter table public.push_preferences add column announcements boolean not null default true, add column education_reminders boolean not null default true;
alter table public.push_outbox add column target_user_id uuid references auth.users(id) on delete cascade;
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check(kind in('task_awaiting_approval','task_approved','task_returned','exam_assigned','exam_finished','weekly_summary','cohort_results','parent_announcement','education_reminder'));

create function gina.announcement_family_matches(p_family uuid,p_place uuid,p_stage text) returns boolean language sql stable security definer set search_path='' as $$
 select (p_place is null and p_stage is null) or exists(
 select 1 from public.children c join gina.child_education_locations l on l.child_id=c.id
 where c.family_id=p_family and c.archived_at is null and (p_stage is null or l.stage=p_stage)
 and (p_place is null or exists(select 1 from gina.education_ancestors(l.place_id) a where a.id=p_place)));
$$;
create function gina.announcement_recipients(p_place uuid,p_stage text) returns table(user_id uuid,family_id uuid) language sql stable security definer set search_path='' as $$
 select distinct on(m.user_id) m.user_id,m.family_id from public.family_members m
 left join public.active_families af on af.user_id=m.user_id
 where gina.announcement_family_matches(m.family_id,p_place,p_stage)
 order by m.user_id,(m.family_id=af.family_id) desc nulls last,m.family_id;
$$;
create function gina.announcement_audience(p_place uuid,p_stage text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(user_id::text||':'||family_id::text,',' order by user_id),''))) from gina.announcement_recipients(p_place,p_stage);
$$;
create function public.admin_announcements(p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc,id desc),'[]') from(select * from gina.parent_announcements where p_before is null or (created_at,id)<(p_before,p_before_id) order by created_at desc,id desc limit 30)a),
 'total',(select count(*) from gina.parent_announcements),
 'places',(select coalesce(jsonb_agg(to_jsonb(p) order by name),'[]') from gina.education_places p where active),
 'settings',(select to_jsonb(s)||jsonb_build_object('scheduler_available',to_regnamespace('cron') is not null) from gina.education_notification_settings s));
end;$$;
create function public.admin_save_announcement(p_request uuid,p_id uuid,p_revision int,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;old gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','announcement.draft','id',p_id,'revision',p_revision,'value',p_value);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_id is null or p_revision is null or length(trim(coalesce(p_value->>'title',''))) not between 3 and 160 or length(trim(coalesce(p_value->>'body',''))) not between 10 and 4000
 or jsonb_typeof(p_value->'push') is distinct from 'boolean' or coalesce(p_value->>'expires_on','') !~ '^\d{4}-\d{2}-\d{2}$' or (p_value->>'expires_on')::date not between current_date and current_date+90
 or (p_value->>'stage' is not null and p_value->>'stage' not in('preschool','primary','middle','high','university'))
 or (p_value->>'place_id' is not null and not exists(select 1 from gina.education_places where id=(p_value->>'place_id')::uuid and active)) then raise exception 'announcement_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('announcement:'||p_id::text,0));
 select * into old from gina.parent_announcements where id=p_id for update;
 if coalesce(old.revision,0)<>p_revision or (old.id is not null and old.status<>'draft') then raise exception 'announcement_changed';end if;
 insert into gina.parent_announcements(id,title,body,place_id,stage,push,expires_on,created_by)
 values(p_id,trim(p_value->>'title'),trim(p_value->>'body'),(p_value->>'place_id')::uuid,p_value->>'stage',(p_value->>'push')::boolean,(p_value->>'expires_on')::date,auth.uid())
 on conflict(id) do update set title=excluded.title,body=excluded.body,place_id=excluded.place_id,stage=excluded.stage,push=excluded.push,expires_on=excluded.expires_on,revision=parent_announcements.revision+1;
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request,payload,result,null);return result;
end;$$;
create function public.admin_preview_announcement(p_id uuid,p_revision int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from gina.parent_announcements where id=p_id and status='draft';
 if not found or a.revision is distinct from p_revision then raise exception 'announcement_changed';end if;
 return gina.announcement_audience(a.place_id,a.stage)||jsonb_build_object('id',a.id,'revision',a.revision,'push',a.push,'expires_on',a.expires_on);
end;$$;
create function public.admin_publish_announcement(p_request uuid,p_id uuid,p_revision int,p_fingerprint text,p_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;a gina.parent_announcements;audience jsonb;n int;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_confirmed is distinct from true then raise exception 'announcement_confirmation';end if;
 payload:=jsonb_build_object('action','announcement.publish','id',p_id,'revision',p_revision,'fingerprint',p_fingerprint);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select * into a from gina.parent_announcements where id=p_id for update;
 if not found or a.status<>'draft' or a.revision is distinct from p_revision then raise exception 'announcement_changed';end if;
 if a.expires_on<current_date then raise exception 'announcement_expired';end if;
 -- Audience and insert use one statement snapshot; membership is rechecked at
 -- inbox reads and at device delivery. No preview from the browser is trusted.
 with recipients as materialized (select * from gina.announcement_recipients(a.place_id,a.stage)),
 summary as (select count(*) n,md5(coalesce(string_agg(user_id::text||':'||family_id::text,',' order by user_id),'')) fingerprint from recipients),
 inserted as (insert into gina.parent_inbox(user_id,family_id,announcement_id,event_key,kind,title,body,expires_on)
 select r.user_id,r.family_id,a.id,'announcement:'||a.id,'announcement',a.title,a.body,a.expires_on from recipients r cross join summary s
 where s.fingerprint=p_fingerprint and s.n between 1 and 5000 on conflict(user_id,event_key) do nothing returning *)
 select jsonb_build_object('fingerprint',s.fingerprint,'count',s.n,'inserted',(select count(*) from inserted)) into audience from summary s;
 n:=(audience->>'count')::int;
 if audience->>'fingerprint' is distinct from p_fingerprint then raise exception 'announcement_audience_changed';end if;
 if n not between 1 and 5000 then raise exception 'announcement_audience_limit';end if;
 if a.push then
  insert into public.push_outbox(family_id,audience,target_user_id,kind,payload)
  select i.family_id,'parents',i.user_id,'parent_announcement',jsonb_build_object('inbox_id',i.id) from gina.parent_inbox i where announcement_id=a.id;
 end if;
 update gina.parent_announcements set status='published',revision=revision+1,published_at=now(),recipient_count=n where id=a.id;
 result:=jsonb_build_object('id',a.id,'recipients',n,'status','published');
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'announcement.publish','parent_announcements',a.id::text,jsonb_build_object('recipients',n,'push',a.push,'scope',a.place_id,'stage',a.stage));
 return result;
end;$$;
create function public.admin_withdraw_announcement(p_request uuid,p_id uuid,p_revision int) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;a gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','announcement.withdraw','id',p_id,'revision',p_revision);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select * into a from gina.parent_announcements where id=p_id for update;
 if not found or a.revision is distinct from p_revision or a.status='withdrawn' then raise exception 'announcement_changed';end if;
 update gina.parent_announcements set status='withdrawn',revision=revision+1 where id=p_id;
 update public.push_outbox o set status='no_targets',lease_id=null,last_error='announcement_withdrawn' where status in('pending','sending') and exists(select 1 from gina.parent_inbox i where i.announcement_id=p_id and o.payload->>'inbox_id'=i.id::text);
 result:=jsonb_build_object('id',p_id,'status','withdrawn');perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id) values(auth.uid(),'announcement.withdraw','parent_announcements',p_id::text);return result;
end;$$;
create function public.parent_inbox(p_before timestamptz default null,p_before_id uuid default null,p_archived boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if (p_before is null)<>(p_before_id is null) or p_archived is null then raise exception 'invalid_input';end if;
 return jsonb_build_object('unread',(select count(*) from gina.parent_inbox i where user_id=auth.uid() and family_id=gina.family_id() and read_at is null and archived_at is null and expires_on>=current_date and (announcement_id is null or exists(select 1 from gina.parent_announcements a where a.id=i.announcement_id and status='published'))),
 'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,id desc),'[]') from(
 select id,kind,title,body,created_at,read_at,archived_at,expires_on,child_id from gina.parent_inbox i where user_id=auth.uid() and family_id=gina.family_id() and (archived_at is not null)=p_archived and expires_on>=current_date
 and (p_before is null or (created_at,id)<(p_before,p_before_id))
 and (announcement_id is null or exists(select 1 from gina.parent_announcements a where a.id=i.announcement_id and status='published'))
 order by created_at desc,id desc limit 30)r));
end;$$;
create function public.mark_parent_inbox(p_id uuid,p_archived boolean default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 update gina.parent_inbox set read_at=coalesce(read_at,now()),archived_at=case when p_archived is null then archived_at when p_archived then coalesce(archived_at,now()) else null end
 where id=p_id and user_id=auth.uid() and family_id=gina.family_id();
 if not found then raise exception 'not_found';end if;
end;$$;
create function gina.inbox_push_current(p_id text,p_user uuid,p_family uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from gina.parent_inbox i where i.id::text=p_id and i.user_id=p_user and i.family_id=p_family and i.expires_on>=current_date and i.read_at is null and i.archived_at is null
 and exists(select 1 from public.family_members where family_id=p_family and user_id=p_user)
 and (i.child_id is null or exists(select 1 from public.children where id=i.child_id and archived_at is null))
 and (i.kind<>'education_start' or not exists(select 1 from gina.child_education_periods e where e.child_id=i.child_id and e.ends_on is null and e.academic_year>=nullif(split_part(i.event_key,':',3),'')::int))
 and (i.kind<>'education_end' or exists(select 1 from gina.child_education_periods e where e.child_id=i.child_id and e.ends_on is null and e.academic_year=nullif(split_part(i.event_key,':',3),'')::int))
 and (i.announcement_id is null or exists(select 1 from gina.parent_announcements a where a.id=i.announcement_id and a.status='published' and gina.announcement_family_matches(p_family,a.place_id,a.stage))));
$$;
create function public.admin_education_reminder_settings(p_request uuid,p_revision int,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;r int;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_enabled is null then raise exception 'invalid_input';end if;
 if p_enabled and to_regnamespace('cron') is null then raise exception 'scheduler_unavailable';end if;
 payload:=jsonb_build_object('action','education.reminders','revision',p_revision,'enabled',p_enabled);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select revision into r from gina.education_notification_settings for update;
 if r is distinct from p_revision then raise exception 'calendar_changed';end if;
 update gina.education_notification_settings set reminders_enabled=p_enabled,revision=revision+1;
 if not p_enabled then update public.push_outbox set status='no_targets',lease_id=null,last_error='reminders_disabled' where kind='education_reminder' and status in('pending','sending');end if;
 result:=jsonb_build_object('revision',r+1,'reminders_enabled',p_enabled);perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,details) values(auth.uid(),'education.reminders','education_notification_settings',payload);return result;
end;$$;
create function gina.enqueue_education_reminders() returns int language plpgsql security definer set search_path='' as $$
declare n int;begin
 if not (select reminders_enabled from gina.education_notification_settings) then return 0;end if;
 perform pg_advisory_xact_lock_shared(608005);
 with matching as materialized (
 select c.id child_id,c.family_id,l.stage,(now() at time zone f.timezone)::date today,y.year,gina.education_calendar_match(l.place_id,l.stage,y.year) cal,e.academic_year active_year
 from public.children c join gina.child_education_locations l on l.child_id=c.id join public.families f on f.id=c.family_id
 left join gina.child_education_periods e on e.child_id=c.id and e.ends_on is null
 cross join lateral (values(extract(year from now() at time zone f.timezone)::int),(extract(year from now() at time zone f.timezone)::int-1))y(year)
 where c.archived_at is null for share of c
 ),events as (
 select *,case when today between (cal->'value'->>'starts_on')::date and (cal->'value'->>'starts_on')::date+7 and (active_year is null or active_year<year) then 'education_start'
 when today between (cal->'value'->>'ends_on')::date and (cal->'value'->>'ends_on')::date+7 and active_year=year then 'education_end' end kind from matching where cal is not null
 ), inserted as (
 insert into gina.parent_inbox(user_id,family_id,child_id,event_key,kind,title,body,expires_on)
 select m.user_id,e.family_id,e.child_id,e.kind||':'||e.child_id||':'||e.year,e.kind,
 case when e.kind='education_start' then 'Yeni eğitim yılı başladı' else 'Eğitim yılı tamamlanıyor' end,
 case when e.kind='education_start' then 'Okul takvimine göre yeni eğitim yılı başladı. Çocuğunun sınıf ve okul kaydını birlikte kontrol edebilirsin. Bilgileri yalnız sen onayladığında değiştiririz.' else 'Okul takvimindeki yıl sonuna geldik. Geçmiş çalışmalar korunur; sınıfı şimdi değiştirmen gerekmez. Yeni yıl kaydını okulun başlangıcında kontrol edebilirsin.' end,e.today+30
 from events e join public.family_members m on m.family_id=e.family_id where e.kind is not null
 on conflict(user_id,event_key) do nothing returning *
 ), queued as (
 insert into public.push_outbox(family_id,audience,target_user_id,target_child_id,kind,payload)
 select family_id,'parents',user_id,child_id,'education_reminder',jsonb_build_object('inbox_id',id,'child_id',child_id) from inserted returning id)
 select count(*) into n from queued;return n;
end;$$;
-- Disabled by default until a release operator activates the reviewed calendars.
do $job$ begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('gina-education-reminders','0 8 * * *','select gina.enqueue_education_reminders();');
 else raise notice 'education reminders scheduler unavailable; activation remains disabled';end if;
end $job$;
revoke all on function gina.announcement_family_matches(uuid,uuid,text),gina.announcement_recipients(uuid,text),gina.announcement_audience(uuid,text),gina.inbox_push_current(text,uuid,uuid),gina.enqueue_education_reminders() from public,anon,authenticated,service_role;
revoke all on function public.admin_announcements(timestamptz,uuid),public.admin_save_announcement(uuid,uuid,int,jsonb),public.admin_preview_announcement(uuid,int),public.admin_publish_announcement(uuid,uuid,int,text,boolean),public.admin_withdraw_announcement(uuid,uuid,int),public.parent_inbox(timestamptz,uuid,boolean),public.mark_parent_inbox(uuid,boolean),public.admin_education_reminder_settings(uuid,int,boolean) from public,anon,service_role;
grant execute on function public.admin_announcements(timestamptz,uuid),public.admin_save_announcement(uuid,uuid,int,jsonb),public.admin_preview_announcement(uuid,int),public.admin_publish_announcement(uuid,uuid,int,text,boolean),public.admin_withdraw_announcement(uuid,uuid,int),public.parent_inbox(timestamptz,uuid,boolean),public.mark_parent_inbox(uuid,boolean),public.admin_education_reminder_settings(uuid,int,boolean) to authenticated;

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
    and (o.target_user_id is null or t.user_id=o.target_user_id)
    and (o.kind not in('parent_announcement','education_reminder') or gina.inbox_push_current(o.payload->>'inbox_id',t.user_id,o.family_id))
    and (o.kind<>'education_reminder' or (select reminders_enabled from gina.education_notification_settings))
    and exists (select 1 from auth.sessions s where s.user_id = t.user_id)
    and case o.kind
          when 'task_awaiting_approval' then coalesce(p.approvals, true)
          when 'exam_finished' then coalesce(p.exams, true)
          when 'cohort_results' then coalesce(p.exams, true)
          when 'weekly_summary' then coalesce(p.weekly_summary, true)
          when 'parent_announcement' then coalesce(p.announcements,true)
          when 'education_reminder' then coalesce(p.education_reminders,true)
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
