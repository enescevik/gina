-- S02: email/SMS announcement channels (server side only).
-- Rules: having an address is never consent; email/SMS deliver only to a verified address with an
-- explicit per-purpose preference; service and marketing are separate purposes; one-tap unsubscribe
-- is a signed, expiring token and every change is logged; children never get a contact address;
-- provider acceptance is recorded as "accepted", never as read/delivered. No provider account exists
-- yet (X01/X02): readiness is reported from configuration + worker heartbeat, never assumed.

-- Configuration (non-secret; secrets stay in Edge env/Vault) -----------------------------------
insert into public.app_settings(key,value) values
 ('channels.email.provider','null'),('channels.email.from_address','null'),('channels.email.sender_domain_verified','false'),
 ('channels.sms.provider','null'),('channels.sms.sender_id','null'),('channels.marketing.legal_review_done','false')
on conflict do nothing;
create table gina.channel_settings(singleton boolean primary key default true check(singleton),
 unsubscribe_secret bytea not null default extensions.gen_random_bytes(32),created_at timestamptz not null default now());
insert into gina.channel_settings default values;
create table gina.channel_provider_status(channel text primary key check(channel in('push','email','sms')),
 provider text,configured boolean not null,missing text[] not null default '{}',reported_at timestamptz not null default now());

-- Verified contact addresses -------------------------------------------------------------------
create table gina.contact_channels(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('email','sms')),
 value text not null,
 verified_at timestamptz not null default now(),revoked_at timestamptz,created_at timestamptz not null default now(),
 check((kind='email' and value ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(value)<=254) or (kind='sms' and value ~ '^\+[1-9][0-9]{7,14}$'))
);
create unique index contact_channels_active on gina.contact_channels(user_id,kind) where revoked_at is null;
create table gina.contact_verifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('email','sms')),
 value text not null,token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,consumed_at timestamptz,cancelled_at timestamptz,
 attempts int not null default 0,created_at timestamptz not null default now()
);
create index on gina.contact_verifications(user_id,kind,created_at desc);
-- Product rule: children and tablets never hold a contact address. Only a parent account may.
create function gina.contact_owner_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.devices d where d.auth_user_id=new.user_id) or coalesce((select is_anonymous from auth.users where id=new.user_id),true) then
  raise exception 'child_contact_forbidden';end if;
 if not exists(select 1 from public.family_members m where m.user_id=new.user_id) then raise exception 'parent_account_required';end if;
 return new;end;$$;
create trigger contact_channels_owner before insert or update of user_id on gina.contact_channels for each row execute function gina.contact_owner_guard();
create trigger contact_verifications_owner before insert or update of user_id on gina.contact_verifications for each row execute function gina.contact_owner_guard();

-- Preferences: channel x purpose; explicit rows only, every change logged -------------------------
create table gina.notification_preferences(
 user_id uuid not null references auth.users(id) on delete cascade,
 channel text not null check(channel in('in_app','push','email','sms')),
 purpose text not null check(purpose in('service','announcement','marketing')),
 enabled boolean not null,source text not null check(source in('user','unsubscribe_link')),updated_at timestamptz not null default now(),
 primary key(user_id,channel,purpose)
);
create table gina.notification_consent_log(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,
 channel text not null,purpose text not null,enabled boolean not null,source text not null,token_issued_at timestamptz,created_at timestamptz not null default now()
);
create index on gina.notification_consent_log(user_id,created_at);

-- Outbox for email/SMS: fenced leases, provider receipts, explicit skip reasons --------------------
create table gina.channel_outbox(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid references public.families(id) on delete cascade,
 channel text not null check(channel in('email','sms')),
 purpose text not null check(purpose in('service','announcement','marketing')),
 kind text not null check(kind in('contact_verification','parent_announcement')),
 payload jsonb not null default '{}'::jsonb,dedupe_key text not null unique,
 status text not null default 'pending' check(status in('pending','sending','accepted','failed','skipped')),
 skip_reason text,attempts int not null default 0,lease_id uuid,claimed_at timestamptz,next_attempt_at timestamptz not null default now(),
 provider text,provider_message_id text,accepted_at timestamptz,last_error text,created_at timestamptz not null default now()
);
create index channel_outbox_due on gina.channel_outbox(next_attempt_at) where status in('pending','sending');
create index channel_outbox_user on gina.channel_outbox(user_id,created_at desc);
alter table gina.parent_announcements add column channels text[] not null default '{}' check(channels<@array['email','sms']);
create table gina.announcement_channel_summary(announcement_id uuid not null references gina.parent_announcements(id) on delete cascade,
 channel text not null,outcome text not null,n int not null,primary key(announcement_id,channel,outcome));

alter table gina.channel_settings enable row level security;alter table gina.channel_provider_status enable row level security;
alter table gina.contact_channels enable row level security;alter table gina.contact_verifications enable row level security;
alter table gina.notification_preferences enable row level security;alter table gina.notification_consent_log enable row level security;
alter table gina.channel_outbox enable row level security;alter table gina.announcement_channel_summary enable row level security;
revoke all on gina.channel_settings,gina.channel_provider_status,gina.contact_channels,gina.contact_verifications,gina.notification_preferences,gina.notification_consent_log,gina.channel_outbox,gina.announcement_channel_summary from public,anon,authenticated,service_role;

-- Rules ------------------------------------------------------------------------------------------
-- Defaults without a row: service on (an address is verified for account purposes), announcement
-- only in_app/push, marketing never. Push announcement preference stays in push_preferences.
create function gina.channel_default(p_channel text,p_purpose text) returns boolean language sql immutable as $$
 select case p_purpose when 'marketing' then false when 'service' then true else p_channel in('in_app','push') end$$;
create function gina.channel_preference(p_user uuid,p_channel text,p_purpose text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from gina.notification_preferences where user_id=p_user and channel=p_channel and purpose=p_purpose),
  case when p_channel='push' and p_purpose='announcement' then coalesce((select announcements from public.push_preferences where user_id=p_user),true)
  else gina.channel_default(p_channel,p_purpose) end)$$;
create function gina.setting_text(p_key text) returns text language sql stable security definer set search_path='' as $$
 select nullif(trim(both '"' from value::text),'null') from public.app_settings where key=p_key$$;
create function gina.channel_readiness() returns jsonb language sql stable security definer set search_path='' as $$
 with s as (select channel,provider,configured,missing,reported_at from gina.channel_provider_status),
 email as (select array_remove(array[
  case when gina.setting_text('channels.email.provider') is null then 'provider_not_selected' end,
  case when gina.setting_text('channels.email.from_address') is null then 'from_address_missing' end,
  case when gina.setting_text('channels.email.sender_domain_verified') is distinct from 'true' then 'sender_domain_unverified' end,
  case when not exists(select 1 from s where channel='email' and reported_at>now()-interval '24 hours') then 'worker_report_missing' end,
  case when exists(select 1 from s where channel='email' and not configured) then 'provider_secret_missing' end],null)
  ||coalesce((select missing from s where channel='email'),'{}') m),
 sms as (select array_remove(array[
  case when gina.setting_text('channels.sms.provider') is null then 'provider_not_selected' end,
  case when gina.setting_text('channels.sms.sender_id') is null then 'sender_id_missing' end,
  case when not exists(select 1 from s where channel='sms' and reported_at>now()-interval '24 hours') then 'worker_report_missing' end,
  case when exists(select 1 from s where channel='sms' and not configured) then 'provider_secret_missing' end],null)
  ||coalesce((select missing from s where channel='sms'),'{}') m),
 push as (select array_remove(array[
  case when not exists(select 1 from s where channel='push' and reported_at>now()-interval '24 hours') then 'worker_report_missing' end,
  case when exists(select 1 from s where channel='push' and not configured) then 'provider_secret_missing' end],null)
  ||coalesce((select missing from s where channel='push'),'{}') m)
 select jsonb_build_object(
  'in_app',jsonb_build_object('ready',true,'missing','[]'::jsonb),
  'push',jsonb_build_object('ready',cardinality((select m from push))=0,'missing',to_jsonb((select m from push)),'reported_at',(select reported_at from s where channel='push')),
  'email',jsonb_build_object('ready',cardinality((select m from email))=0,'missing',to_jsonb((select m from email)),'provider',gina.setting_text('channels.email.provider'),'reported_at',(select reported_at from s where channel='email')),
  'sms',jsonb_build_object('ready',cardinality((select m from sms))=0,'missing',to_jsonb((select m from sms)),'provider',gina.setting_text('channels.sms.provider'),'reported_at',(select reported_at from s where channel='sms')),
  'marketing',jsonb_build_object('allowed',gina.setting_text('channels.marketing.legal_review_done')='true','missing',case when gina.setting_text('channels.marketing.legal_review_done')='true' then '[]'::jsonb else '["marketing_legal_review_pending"]'::jsonb end),
  'note','provider acceptance is not delivery or read');
$$;
create function gina.channel_ready(p_channel text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((gina.channel_readiness()->p_channel->>'ready')::boolean,false)$$;
-- null = allowed; otherwise the recorded skip reason. Re-evaluated at enqueue and again at claim.
create function gina.channel_block_reason(p_user uuid,p_channel text,p_purpose text) returns text language sql stable security definer set search_path='' as $$
 select case
  when p_channel not in('email','sms') then 'channel_unsupported'
  when p_purpose='marketing' and gina.setting_text('channels.marketing.legal_review_done') is distinct from 'true' then 'marketing_legal_review_pending'
  when not exists(select 1 from public.family_members where user_id=p_user) then 'not_a_parent'
  when not exists(select 1 from gina.contact_channels c where c.user_id=p_user and c.kind=p_channel and c.revoked_at is null) then 'address_unverified'
  when not gina.channel_preference(p_user,p_channel,p_purpose) then 'preference_off'
  when not exists(select 1 from auth.sessions where user_id=p_user) then 'no_active_session'
  else null end$$;
create function gina.mask_contact(p_kind text,p_value text) returns text language sql immutable as $$
 select case when p_kind='email' then left(p_value,1)||'***'||substring(p_value from position('@' in p_value)) else left(p_value,3)||repeat('*',greatest(0,length(p_value)-5))||right(p_value,2) end$$;
create function gina.normalize_contact(p_kind text,p_value text) returns text language sql immutable as $$
 select case when p_kind='email' then lower(trim(p_value)) else regexp_replace(trim(p_value),'[[:space:]().-]','','g') end$$;

-- Signed, expiring unsubscribe tokens (announcement/marketing only; service is not unsubscribable)
create function gina.unsubscribe_token(p_user uuid,p_channel text,p_purpose text) returns text language plpgsql stable security definer set search_path='' as $$
declare body text;sig text;begin
 if p_purpose not in('announcement','marketing') or p_channel not in('email','sms') then return null;end if;
 body:=p_user::text||':'||p_channel||':'||p_purpose||':'||extract(epoch from now()+interval '30 days')::bigint::text;
 sig:=encode(extensions.hmac(convert_to(body,'utf8'),(select unsubscribe_secret from gina.channel_settings),'sha256'),'hex');
 return translate(replace(encode(convert_to(body,'utf8'),'base64'),E'\n',''),'+/=','-_')||'.'||left(sig,40);
end;$$;
create function public.unsubscribe_with_token(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare body text;parts text[];u uuid;ch text;pu text;exp bigint;sig text;begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{20,200}\.[a-f0-9]{40}$' then raise exception 'unsubscribe_invalid';end if;
 body:=convert_from(decode(rpad(translate(split_part(p_token,'.',1),'-_','+/'),(length(split_part(p_token,'.',1))+3)/4*4,'='),'base64'),'utf8');
 sig:=left(encode(extensions.hmac(convert_to(body,'utf8'),(select unsubscribe_secret from gina.channel_settings),'sha256'),'hex'),40);
 if sig<>split_part(p_token,'.',2) then raise exception 'unsubscribe_invalid';end if;
 parts:=string_to_array(body,':');
 if cardinality(parts)<>4 or parts[3] not in('announcement','marketing') or parts[2] not in('email','sms') then raise exception 'unsubscribe_invalid';end if;
 u:=parts[1]::uuid;ch:=parts[2];pu:=parts[3];exp:=parts[4]::bigint;
 if to_timestamp(exp)<now() then raise exception 'unsubscribe_expired';end if;
 if not exists(select 1 from auth.users where id=u) then raise exception 'unsubscribe_invalid';end if;
 insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values(u,ch,pu,false,'unsubscribe_link')
 on conflict(user_id,channel,purpose) do update set enabled=false,source='unsubscribe_link',updated_at=now();
 insert into gina.notification_consent_log(user_id,channel,purpose,enabled,source,token_issued_at) values(u,ch,pu,false,'unsubscribe_link',to_timestamp(exp)-interval '30 days');
 update gina.channel_outbox set status='skipped',skip_reason='preference_off',lease_id=null,payload=payload-'secret' where user_id=u and channel=ch and purpose=pu and status='pending';
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'notification.unsubscribe','notification_preferences',u::text,jsonb_build_object('channel',ch,'purpose',pu,'source','unsubscribe_link'));
 return jsonb_build_object('channel',ch,'purpose',pu,'enabled',false);
end;$$;

-- Parent RPCs ------------------------------------------------------------------------------------
create function public.my_notification_channels() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object(
  'contacts',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'masked',gina.mask_contact(kind,value),'verified_at',verified_at) order by kind),'[]') from gina.contact_channels where user_id=auth.uid() and revoked_at is null),
  'pending',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'masked',gina.mask_contact(kind,value),'expires_at',expires_at) order by kind),'[]') from gina.contact_verifications where user_id=auth.uid() and consumed_at is null and cancelled_at is null and expires_at>now()),
  'preferences',(select jsonb_object_agg(c,(select jsonb_object_agg(p,gina.channel_preference(auth.uid(),c,p)) from unnest(array['service','announcement','marketing'])p)) from unnest(array['in_app','push','email','sms'])c),
  'effective',(select jsonb_object_agg(c,(select jsonb_object_agg(p,coalesce(gina.channel_block_reason(auth.uid(),c,p),'allowed')) from unnest(array['service','announcement','marketing'])p)) from unnest(array['email','sms'])c),
  'readiness',(select jsonb_object_agg(k,v->'ready') from jsonb_each(gina.channel_readiness()) e(k,v) where k in('in_app','push','email','sms')));
end;$$;
create function public.set_notification_preference(p_channel text,p_purpose text,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_channel='push' then raise exception 'use_push_preferences';end if;
 if p_channel not in('in_app','email','sms') or p_purpose not in('service','announcement','marketing') or p_enabled is null then raise exception 'invalid_input';end if;
 if p_channel='in_app' and p_purpose='service' and not p_enabled then raise exception 'service_in_app_required';end if;
 insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values(auth.uid(),p_channel,p_purpose,p_enabled,'user')
 on conflict(user_id,channel,purpose) do update set enabled=excluded.enabled,source='user',updated_at=now();
 insert into gina.notification_consent_log(user_id,channel,purpose,enabled,source) values(auth.uid(),p_channel,p_purpose,p_enabled,'user');
 return public.my_notification_channels();
end;$$;
create function public.request_contact_verification(p_kind text,p_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v text;token text;vid uuid;ttl interval;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind not in('email','sms') then raise exception 'invalid_input';end if;
 v:=gina.normalize_contact(p_kind,coalesce(p_value,''));
 if not ((p_kind='email' and v ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(v)<=254) or (p_kind='sms' and v ~ '^\+[1-9][0-9]{7,14}$')) then raise exception 'contact_invalid';end if;
 if not gina.channel_ready(p_kind) then raise exception 'channel_not_ready';end if;
 perform pg_advisory_xact_lock(hashtextextended('contact:'||auth.uid()::text,0));
 if exists(select 1 from gina.contact_channels where user_id=auth.uid() and kind=p_kind and value=v and revoked_at is null) then
  return jsonb_build_object('kind',p_kind,'status','already_verified');end if;
 if (select count(*) from gina.contact_verifications where user_id=auth.uid() and kind=p_kind and created_at>now()-interval '1 hour')>=3 then raise exception 'verification_rate_limited';end if;
 update gina.contact_verifications set cancelled_at=now() where user_id=auth.uid() and kind=p_kind and consumed_at is null and cancelled_at is null;
 update gina.channel_outbox set status='skipped',skip_reason='verification_superseded',lease_id=null,payload=payload-'secret' where user_id=auth.uid() and kind='contact_verification' and channel=p_kind and status='pending';
 token:=case when p_kind='email' then encode(extensions.gen_random_bytes(24),'hex')
  else lpad((((get_byte(extensions.gen_random_bytes(4),0)<<16)|(get_byte(extensions.gen_random_bytes(4),1)<<8)|get_byte(extensions.gen_random_bytes(4),2))%1000000)::text,6,'0') end;
 ttl:=case when p_kind='email' then interval '60 minutes' else interval '15 minutes' end;
 insert into gina.contact_verifications(user_id,kind,value,token_hash,expires_at) values(auth.uid(),p_kind,v,encode(extensions.digest(token,'sha256'),'hex'),now()+ttl) returning id into vid;
 -- The plaintext secret lives only in the outbox payload until the worker records a terminal result.
 insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key)
 values(auth.uid(),gina.family_id(),p_kind,'service','contact_verification',jsonb_build_object('verification_id',vid,'secret',token,'expires_at',now()+ttl),'verification:'||vid::text);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'contact.verification_requested','contact_verifications',vid::text,jsonb_build_object('kind',p_kind));
 return jsonb_build_object('kind',p_kind,'status','pending','masked',gina.mask_contact(p_kind,v),'expires_at',now()+ttl);
end;$$;
create function public.confirm_contact_verification(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r gina.contact_verifications;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('contact:'||auth.uid()::text,0));
 select * into r from gina.contact_verifications where user_id=auth.uid() and consumed_at is null and cancelled_at is null and expires_at>now()
  and token_hash=encode(extensions.digest(coalesce(trim(p_token),''),'sha256'),'hex') order by created_at desc limit 1 for update;
 if not found then
  -- Counted, not raised: a raised error would roll the attempt counter back with it.
  update gina.contact_verifications set attempts=attempts+1,cancelled_at=case when attempts+1>=5 then now() end
  where id in(select id from gina.contact_verifications where user_id=auth.uid() and consumed_at is null and cancelled_at is null and expires_at>now());
  update gina.channel_outbox set status='skipped',skip_reason='verification_superseded',lease_id=null,payload=payload-'secret'
  where status='pending' and kind='contact_verification' and payload->>'verification_id' in(select id::text from gina.contact_verifications where user_id=auth.uid() and cancelled_at is not null);
  return jsonb_build_object('status','invalid','remaining',(select coalesce(min(5-attempts),0) from gina.contact_verifications where user_id=auth.uid() and consumed_at is null and cancelled_at is null and expires_at>now()));
 end if;
 update gina.contact_verifications set consumed_at=now() where id=r.id;
 update gina.contact_channels set revoked_at=now() where user_id=auth.uid() and kind=r.kind and revoked_at is null;
 insert into gina.contact_channels(user_id,kind,value) values(auth.uid(),r.kind,r.value);
 update gina.channel_outbox set payload=payload-'secret',status=case when status='pending' then 'skipped' else status end,skip_reason=case when status='pending' then 'verification_consumed' else skip_reason end,lease_id=case when status='pending' then null else lease_id end
 where kind='contact_verification' and payload->>'verification_id'=r.id::text;
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'contact.verified','contact_channels',r.id::text,jsonb_build_object('kind',r.kind));
 return jsonb_build_object('kind',r.kind,'status','verified','masked',gina.mask_contact(r.kind,r.value));
end;$$;
create function public.revoke_contact_channel(p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind not in('email','sms') then raise exception 'invalid_input';end if;
 update gina.contact_channels set revoked_at=now() where user_id=auth.uid() and kind=p_kind and revoked_at is null;
 update gina.channel_outbox set status='skipped',skip_reason='address_revoked',lease_id=null,payload=payload-'secret' where user_id=auth.uid() and channel=p_kind and status='pending';
 insert into public.audit_log(actor_id,action,target_table,details) values(auth.uid(),'contact.revoked','contact_channels',jsonb_build_object('kind',p_kind));
 return public.my_notification_channels();
end;$$;
revoke all on function public.my_notification_channels(),public.set_notification_preference(text,text,boolean),public.request_contact_verification(text,text),public.confirm_contact_verification(text),public.revoke_contact_channel(text) from public,anon,service_role;
grant execute on function public.my_notification_channels(),public.set_notification_preference(text,text,boolean),public.request_contact_verification(text,text),public.confirm_contact_verification(text),public.revoke_contact_channel(text) to authenticated;
revoke all on function public.unsubscribe_with_token(text) from public,service_role;
grant execute on function public.unsubscribe_with_token(text) to anon,authenticated;

-- Worker RPCs (service_role; the Edge adapter never sees more than one recipient at a time) -----------
create function public.channel_claim(p_limit int default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;recipient text;reason text;out jsonb:='[]'::jsonb;v gina.contact_verifications;begin
 update gina.channel_outbox set status='failed',last_error='retry_limit',lease_id=null,payload=payload-'secret'
 where attempts>=5 and (status='pending' or (status='sending' and claimed_at<now()-interval '5 minutes'));
 for r in update gina.channel_outbox o set status='sending',attempts=o.attempts+1,claimed_at=now(),lease_id=gen_random_uuid()
  where o.id in(select id from gina.channel_outbox where attempts<5 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes'))
  order by created_at limit greatest(1,least(coalesce(p_limit,5),50)) for update skip locked) returning o.* loop
  reason:=null;recipient:=null;
  if r.kind='contact_verification' then
   select * into v from gina.contact_verifications where id=(r.payload->>'verification_id')::uuid;
   if not found or v.cancelled_at is not null then reason:='verification_superseded';
   elsif v.consumed_at is not null then reason:='verification_consumed';
   elsif v.expires_at<=now() then reason:='verification_expired';
   elsif r.payload->>'secret' is null then reason:='secret_scrubbed';
   else recipient:=v.value;end if;
  else
   reason:=gina.channel_block_reason(r.user_id,r.channel,r.purpose);
   if reason is null and r.kind='parent_announcement' and not gina.inbox_push_current(r.payload->>'inbox_id',r.user_id,r.family_id) then reason:='announcement_not_current';end if;
   if reason is null then select value into recipient from gina.contact_channels where user_id=r.user_id and kind=r.channel and revoked_at is null;end if;
  end if;
  if reason is not null then
   update gina.channel_outbox set status='skipped',skip_reason=reason,lease_id=null,payload=payload-'secret' where id=r.id;
  else
   out:=out||jsonb_build_object('id',r.id,'lease_id',r.lease_id,'channel',r.channel,'purpose',r.purpose,'kind',r.kind,'attempts',r.attempts,'recipient',recipient,
    'locale',coalesce((select locale from public.push_tokens where user_id=r.user_id order by updated_at desc limit 1),'tr'),
    'payload',r.payload,'provider',gina.setting_text('channels.'||r.channel||'.provider'),
    'sender',case when r.channel='email' then gina.setting_text('channels.email.from_address') else gina.setting_text('channels.sms.sender_id') end,
    'unsubscribe_token',gina.unsubscribe_token(r.user_id,r.channel,r.purpose),
    'announcement',case when r.kind='parent_announcement' then (select jsonb_build_object('title',i.title,'body',i.body,'expires_on',i.expires_on) from gina.parent_inbox i where i.id::text=r.payload->>'inbox_id') end);
  end if;
 end loop;
 return out;
end;$$;
create function public.channel_record_result(p_id bigint,p_lease uuid,p_status text,p_provider text default null,p_provider_message_id text default null,p_error text default null,p_retry_after int default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o gina.channel_outbox;begin
 select * into o from gina.channel_outbox where id=p_id for update;
 if not found then raise exception 'channel_lease_changed';end if;
 if o.status='accepted' then return true;end if; -- replayed receipt after a lost reply
 if p_lease is null or o.status<>'sending' or o.lease_id is distinct from p_lease or o.claimed_at<now()-interval '5 minutes' then raise exception 'channel_lease_changed';end if;
 if p_status is null or p_status not in('accepted','retry','failed','unconfigured') or length(coalesce(p_error,''))>160 or length(coalesce(p_provider_message_id,''))>200 or (p_retry_after is not null and p_retry_after not between 1 and 86400) then raise exception 'channel_receipt_invalid';end if;
 update gina.channel_outbox set
  status=case p_status when 'accepted' then 'accepted' when 'retry' then case when o.attempts>=5 then 'failed' else 'pending' end when 'failed' then 'failed' else 'skipped' end,
  skip_reason=case when p_status='unconfigured' then 'provider_unconfigured' end,
  lease_id=null,provider=coalesce(p_provider,provider),
  provider_message_id=case when p_status='accepted' then p_provider_message_id end,
  accepted_at=case when p_status='accepted' then now() end,
  last_error=case when p_status='accepted' then null when p_status='retry' and o.attempts>=5 then 'retry_limit' else left(p_error,160) end,
  next_attempt_at=case when p_status='retry' then greatest(now()+make_interval(secs=>least(900,60*power(2,o.attempts-1))::int),now()+make_interval(secs=>coalesce(p_retry_after,0))) else next_attempt_at end,
  payload=case when p_status='retry' then payload else payload-'secret' end
 where id=o.id;
 return true;
end;$$;
create function public.channel_report_provider_status(p_channel text,p_provider text,p_configured boolean,p_missing text[] default '{}') returns void language sql security definer set search_path='' as $$
 insert into gina.channel_provider_status(channel,provider,configured,missing) values(p_channel,p_provider,p_configured,coalesce(p_missing,'{}'))
 on conflict(channel) do update set provider=excluded.provider,configured=excluded.configured,missing=excluded.missing,reported_at=now();
$$;
create function gina.channel_delivery_due() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from gina.channel_outbox where (status='pending' and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes'));$$;
revoke all on function public.channel_claim(int),public.channel_record_result(bigint,uuid,text,text,text,text,int),public.channel_report_provider_status(text,text,boolean,text[]) from public,anon,authenticated;
grant execute on function public.channel_claim(int),public.channel_record_result(bigint,uuid,text,text,text,text,int),public.channel_report_provider_status(text,text,boolean,text[]) to service_role;
revoke all on function gina.channel_default(text,text),gina.channel_preference(uuid,text,text),gina.setting_text(text),gina.channel_readiness(),gina.channel_ready(text),gina.channel_block_reason(uuid,text,text),gina.mask_contact(text,text),gina.normalize_contact(text,text),gina.unsubscribe_token(uuid,text,text),gina.channel_delivery_due(),gina.contact_owner_guard() from public,anon,authenticated,service_role;
-- The existing push-send tick also wakes the channel outbox; one scheduler, one worker.
create or replace function gina.kick_push_send() returns void language plpgsql security definer set search_path=public as $$
declare v_url text;v_secret text;begin
 if not (gina.push_delivery_due() or gina.channel_delivery_due()) then return;end if;
 begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='push_send_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='push_send_secret';
  if v_url is null or v_secret is null then return;end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||v_secret),body:='{}'::jsonb);
 exception when others then raise notice 'push-send tetiklenemedi';end;
end;$$;

-- Release operator view ---------------------------------------------------------------------------
create function public.channel_readiness() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 return gina.channel_readiness();end;$$;
create function public.release_channel_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('readiness',gina.channel_readiness(),
  'summary',(select coalesce(jsonb_object_agg(channel,s),'{}') from(select channel,jsonb_object_agg(coalesce(status||case when skip_reason is null then '' else ':'||skip_reason end,status),n) s from(select channel,status,skip_reason,count(*) n from gina.channel_outbox where created_at>now()-interval '30 days' group by 1,2,3)c group by channel)d),
  'verified_contacts',(select jsonb_build_object('email',count(*) filter(where kind='email'),'sms',count(*) filter(where kind='sms')) from gina.contact_channels where revoked_at is null),
  'opt_in',(select jsonb_build_object('email_announcement',count(*) filter(where channel='email' and purpose='announcement' and enabled),'sms_announcement',count(*) filter(where channel='sms' and purpose='announcement' and enabled),'unsubscribed_via_link',count(*) filter(where source='unsubscribe_link')) from gina.notification_preferences));
end;$$;
revoke all on function public.channel_readiness(),public.release_channel_operations() from public,anon,service_role;
grant execute on function public.channel_readiness(),public.release_channel_operations() to authenticated;

-- Announcements: optional email/SMS channels chosen per announcement; every skip has a reason -------
create or replace function public.admin_save_announcement(p_request uuid,p_id uuid,p_revision int,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;old gina.parent_announcements;ch text[];begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','announcement.draft','id',p_id,'revision',p_revision,'value',p_value);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_id is null or p_revision is null or length(trim(coalesce(p_value->>'title',''))) not between 3 and 160 or length(trim(coalesce(p_value->>'body',''))) not between 10 and 4000
 or jsonb_typeof(p_value->'push') is distinct from 'boolean' or coalesce(p_value->>'expires_on','') !~ '^\d{4}-\d{2}-\d{2}$' or (p_value->>'expires_on')::date not between current_date and current_date+90
 or (p_value->>'stage' is not null and p_value->>'stage' not in('preschool','primary','middle','high','university'))
 or (p_value->>'place_id' is not null and not exists(select 1 from gina.education_places where id=(p_value->>'place_id')::uuid and active))
 or (p_value ? 'channels' and jsonb_typeof(p_value->'channels') is distinct from 'array') then raise exception 'announcement_invalid';end if;
 select coalesce(array_agg(distinct x),'{}') into ch from jsonb_array_elements_text(coalesce(p_value->'channels','[]'::jsonb))x;
 if not (ch<@array['email','sms']) then raise exception 'announcement_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('announcement:'||p_id::text,0));
 select * into old from gina.parent_announcements where id=p_id for update;
 if coalesce(old.revision,0)<>p_revision or (old.id is not null and old.status<>'draft') then raise exception 'announcement_changed';end if;
 insert into gina.parent_announcements(id,title,body,place_id,stage,push,channels,expires_on,created_by)
 values(p_id,trim(p_value->>'title'),trim(p_value->>'body'),(p_value->>'place_id')::uuid,p_value->>'stage',(p_value->>'push')::boolean,ch,(p_value->>'expires_on')::date,auth.uid())
 on conflict(id) do update set title=excluded.title,body=excluded.body,place_id=excluded.place_id,stage=excluded.stage,push=excluded.push,channels=excluded.channels,expires_on=excluded.expires_on,revision=parent_announcements.revision+1;
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request,payload,result,null);return result;
end;$$;
create function gina.announcement_channel_preview(p_place uuid,p_stage text,p_channels text[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(c,jsonb_build_object('ready',rd.ready,'missing',rd.readiness->c->'missing',
  'eligible',(select count(*) from gina.announcement_recipients(p_place,p_stage)r where rd.ready and gina.channel_block_reason(r.user_id,c,'announcement') is null),
  'blocked',(select coalesce(jsonb_object_agg(reason,n),'{}') from(select case when not rd.ready then 'channel_not_ready' else gina.channel_block_reason(r.user_id,c,'announcement') end reason,count(*) n from gina.announcement_recipients(p_place,p_stage)r group by 1)b where reason is not null))),'{}')
 from unnest(p_channels)c cross join lateral (select gina.channel_readiness() readiness,gina.channel_ready(c) ready) rd;
$$;
revoke all on function gina.announcement_channel_preview(uuid,text,text[]) from public,anon,authenticated,service_role;
create or replace function public.admin_preview_announcement(p_id uuid,p_revision int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from gina.parent_announcements where id=p_id and status='draft';
 if not found or a.revision is distinct from p_revision then raise exception 'announcement_changed';end if;
 return gina.announcement_audience(a.place_id,a.stage)||jsonb_build_object('id',a.id,'revision',a.revision,'push',a.push,'expires_on',a.expires_on,
  'channels',gina.announcement_channel_preview(a.place_id,a.stage,a.channels));
end;$$;
create or replace function public.admin_publish_announcement(p_request uuid,p_id uuid,p_revision int,p_fingerprint text,p_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;a gina.parent_announcements;audience jsonb;n int;c text;ready boolean;ch_summary jsonb:='{}'::jsonb;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_confirmed is distinct from true then raise exception 'announcement_confirmation';end if;
 payload:=jsonb_build_object('action','announcement.publish','id',p_id,'revision',p_revision,'fingerprint',p_fingerprint);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select * into a from gina.parent_announcements where id=p_id for update;
 if not found or a.status<>'draft' or a.revision is distinct from p_revision then raise exception 'announcement_changed';end if;
 if a.expires_on<current_date then raise exception 'announcement_expired';end if;
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
 -- Email/SMS: per channel, per recipient; a channel that is not ready or a parent without verified
 -- address + explicit preference is skipped with a counted reason. Nothing here claims delivery.
 foreach c in array a.channels loop
  ready:=gina.channel_ready(c);
  with decided as (select i.id,i.user_id,i.family_id,case when not ready then 'channel_not_ready' else gina.channel_block_reason(i.user_id,c,'announcement') end reason from gina.parent_inbox i where i.announcement_id=a.id),
  queued as (insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key)
   select user_id,family_id,c,'announcement','parent_announcement',jsonb_build_object('inbox_id',id,'announcement_id',a.id),'announcement:'||id::text||':'||c from decided where reason is null on conflict(dedupe_key) do nothing returning 1),
  counted as (insert into gina.announcement_channel_summary(announcement_id,channel,outcome,n)
   select a.id,c,coalesce(reason,'queued'),count(*) from decided group by reason returning outcome,announcement_channel_summary.n)
  select ch_summary||jsonb_build_object(c,(select coalesce(jsonb_object_agg(outcome,cnt.n),'{}') from counted cnt)) into ch_summary;
 end loop;
 update gina.parent_announcements set status='published',revision=revision+1,published_at=now(),recipient_count=n where id=a.id;
 result:=jsonb_build_object('id',a.id,'recipients',n,'status','published','channels',ch_summary);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'announcement.publish','parent_announcements',a.id::text,jsonb_build_object('recipients',n,'push',a.push,'channels',a.channels,'channel_summary',ch_summary,'scope',a.place_id,'stage',a.stage));
 return result;
end;$$;
create or replace function public.admin_withdraw_announcement(p_request uuid,p_id uuid,p_revision int) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;a gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','announcement.withdraw','id',p_id,'revision',p_revision);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 select * into a from gina.parent_announcements where id=p_id for update;
 if not found or a.revision is distinct from p_revision or a.status='withdrawn' then raise exception 'announcement_changed';end if;
 update gina.parent_announcements set status='withdrawn',revision=revision+1 where id=p_id;
 update public.push_outbox o set status='no_targets',lease_id=null,last_error='announcement_withdrawn' where status in('pending','sending') and exists(select 1 from gina.parent_inbox i where i.announcement_id=p_id and o.payload->>'inbox_id'=i.id::text);
 update gina.channel_outbox co set status='skipped',skip_reason='announcement_withdrawn',lease_id=null where co.status='pending' and co.kind='parent_announcement' and co.payload->>'announcement_id'=p_id::text;
 result:=jsonb_build_object('id',p_id,'status','withdrawn');perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id) values(auth.uid(),'announcement.withdraw','parent_announcements',p_id::text);return result;
end;$$;
create function public.admin_announcement_channels(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('planned',(select coalesce(jsonb_object_agg(channel,o),'{}') from(select channel,jsonb_object_agg(outcome,n) o from gina.announcement_channel_summary where announcement_id=p_id group by channel)s),
  'outbox',(select coalesce(jsonb_object_agg(channel,o),'{}') from(select channel,jsonb_object_agg(status||case when skip_reason is null then '' else ':'||skip_reason end,n) o from(select channel,status,skip_reason,count(*) n from gina.channel_outbox where kind='parent_announcement' and payload->>'announcement_id'=p_id::text group by 1,2,3)c group by channel)s),
  'note','accepted = provider accepted the message; not delivered, not read');
end;$$;
revoke all on function public.admin_announcement_channels(uuid) from public,anon,service_role;
grant execute on function public.admin_announcement_channels(uuid) to authenticated;
