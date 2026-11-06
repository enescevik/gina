-- C10 (S01/S02/B04): server support for the parent channel UI, the one-click unsubscribe endpoint,
-- operator retry and scoped announcement targeting. Builds on 20261106080000_notification_channels.
-- Rules kept: an address is never consent; marketing stays locked until legal review; acceptance is
-- not delivery; children never hold an address. No provider account exists (X01/X02 pending).

-- 1. Single-use unsubscribe tokens --------------------------------------------------------------------
-- A replayed link (mail scanner, double tap, RFC 8058 POST retried by the mail client) changes nothing
-- and writes no second consent/audit row. Keyed by the token signature, never by the address.
create table gina.unsubscribe_token_uses(
 signature text primary key check(signature ~ '^[a-f0-9]{40}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 channel text not null,purpose text not null,via text not null check(via in('link','one_click')),
 used_at timestamptz not null default now());
alter table gina.unsubscribe_token_uses enable row level security;
revoke all on gina.unsubscribe_token_uses from public,anon,authenticated,service_role;

-- Consent scope: which wording the parent saw when the change was made (null = unsubscribe link/legacy).
alter table gina.notification_consent_log add column policy_version text check(policy_version is null or policy_version ~ '^[a-z0-9.-]{1,40}$');

create function gina.apply_unsubscribe(p_token text,p_via text) returns jsonb language plpgsql security definer set search_path='' as $$
declare body text;parts text[];u uuid;ch text;pu text;exp bigint;sig text;used gina.unsubscribe_token_uses;begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{20,200}\.[a-f0-9]{40}$' then raise exception 'unsubscribe_invalid';end if;
 begin
  body:=convert_from(decode(rpad(translate(split_part(p_token,'.',1),'-_','+/'),(length(split_part(p_token,'.',1))+3)/4*4,'='),'base64'),'utf8');
 exception when others then raise exception 'unsubscribe_invalid';end;
 sig:=left(encode(extensions.hmac(convert_to(body,'utf8'),(select unsubscribe_secret from gina.channel_settings),'sha256'),'hex'),40);
 if sig<>split_part(p_token,'.',2) then raise exception 'unsubscribe_invalid';end if;
 parts:=string_to_array(body,':');
 if cardinality(parts)<>4 or parts[3] not in('announcement','marketing') or parts[2] not in('email','sms') or parts[4] !~ '^[0-9]{9,11}$' then raise exception 'unsubscribe_invalid';end if;
 u:=parts[1]::uuid;ch:=parts[2];pu:=parts[3];exp:=parts[4]::bigint;
 -- Serialize concurrent uses of the same link (one-click POST racing the page button).
 perform pg_advisory_xact_lock(hashtextextended('unsubscribe:'||sig,0));
 select * into used from gina.unsubscribe_token_uses where signature=sig;
 if found then
  return jsonb_build_object('channel',ch,'purpose',pu,'status','already_done','enabled',gina.channel_preference(u,ch,pu));
 end if;
 if to_timestamp(exp)<now() then raise exception 'unsubscribe_expired';end if;
 if not exists(select 1 from auth.users where id=u) then raise exception 'unsubscribe_invalid';end if;
 insert into gina.unsubscribe_token_uses(signature,user_id,channel,purpose,via) values(sig,u,ch,pu,p_via);
 insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values(u,ch,pu,false,'unsubscribe_link')
 on conflict(user_id,channel,purpose) do update set enabled=false,source='unsubscribe_link',updated_at=now();
 insert into gina.notification_consent_log(user_id,channel,purpose,enabled,source,token_issued_at) values(u,ch,pu,false,'unsubscribe_link',to_timestamp(exp)-interval '30 days');
 update gina.channel_outbox set status='skipped',skip_reason='preference_off',lease_id=null,payload=payload-'secret' where user_id=u and channel=ch and purpose=pu and status='pending';
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'notification.unsubscribe','notification_preferences',u::text,jsonb_build_object('channel',ch,'purpose',pu,'source','unsubscribe_link','via',p_via));
 return jsonb_build_object('channel',ch,'purpose',pu,'status','unsubscribed','enabled',false);
end;$$;
-- Same signature and grants as S02 (anon page button); now single-use and reports a status.
create or replace function public.unsubscribe_with_token(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 return gina.apply_unsubscribe(p_token,'link');end;$$;
-- RFC 8058 one-click POST, called only by the channel-unsubscribe Edge function (service role).
create function public.channel_one_click_unsubscribe(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 return gina.apply_unsubscribe(p_token,'one_click');end;$$;
revoke all on function gina.apply_unsubscribe(text,text) from public,anon,authenticated,service_role;
revoke all on function public.channel_one_click_unsubscribe(text) from public,anon,authenticated;
grant execute on function public.channel_one_click_unsubscribe(text) to service_role;

-- 2. Parent view and preferences -------------------------------------------------------------------
-- Adds what the UI needs to be honest: remaining code attempts, request limits, marketing lock and the
-- recent consent history. Existing keys and their meaning are unchanged.
create or replace function public.my_notification_channels() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object(
  'contacts',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'masked',gina.mask_contact(kind,value),'verified_at',verified_at) order by kind),'[]') from gina.contact_channels where user_id=auth.uid() and revoked_at is null),
  'pending',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'masked',gina.mask_contact(kind,value),'expires_at',expires_at,'created_at',created_at,'attempts_left',greatest(0,5-attempts)) order by kind),'[]') from gina.contact_verifications where user_id=auth.uid() and consumed_at is null and cancelled_at is null and expires_at>now()),
  'preferences',(select jsonb_object_agg(c,(select jsonb_object_agg(p,gina.channel_preference(auth.uid(),c,p)) from unnest(array['service','announcement','marketing'])p)) from unnest(array['in_app','push','email','sms'])c),
  'effective',(select jsonb_object_agg(c,(select jsonb_object_agg(p,coalesce(gina.channel_block_reason(auth.uid(),c,p),'allowed')) from unnest(array['service','announcement','marketing'])p)) from unnest(array['email','sms'])c),
  'readiness',(select jsonb_object_agg(k,v->'ready') from jsonb_each(gina.channel_readiness()) e(k,v) where k in('in_app','push','email','sms')),
  'marketing_allowed',gina.setting_text('channels.marketing.legal_review_done')='true',
  'limits',(select jsonb_object_agg(k,(select jsonb_build_object('requests_left',greatest(0,3-count(*)),'last_requested_at',max(created_at),
     'next_request_at',case when count(*)>=3 then min(created_at)+interval '1 hour' end)
    from gina.contact_verifications where user_id=auth.uid() and kind=k and created_at>now()-interval '1 hour')) from unnest(array['email','sms'])k),
  'consent_history',(select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'purpose',purpose,'enabled',enabled,'source',source,'at',created_at) order by created_at desc,id desc),'[]')
    from (select * from gina.notification_consent_log where user_id=auth.uid() order by created_at desc,id desc limit 10)h));
end;$$;
-- Email/SMS opt-in needs a verified address first: consent is given for a known, verified address.
-- Turning anything off is always possible. Marketing may be recorded but stays blocked by the legal gate.
create or replace function public.set_notification_preference(p_channel text,p_purpose text,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_channel='push' then raise exception 'use_push_preferences';end if;
 if p_channel not in('in_app','email','sms') or p_purpose not in('service','announcement','marketing') or p_enabled is null then raise exception 'invalid_input';end if;
 if p_channel='in_app' and p_purpose='service' and not p_enabled then raise exception 'service_in_app_required';end if;
 if p_enabled and p_channel in('email','sms') and not exists(select 1 from gina.contact_channels where user_id=auth.uid() and kind=p_channel and revoked_at is null) then raise exception 'address_unverified';end if;
 insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values(auth.uid(),p_channel,p_purpose,p_enabled,'user')
 on conflict(user_id,channel,purpose) do update set enabled=excluded.enabled,source='user',updated_at=now();
 insert into gina.notification_consent_log(user_id,channel,purpose,enabled,source,policy_version) values(auth.uid(),p_channel,p_purpose,p_enabled,'user','channels-2026-11-06');
 return public.my_notification_channels();
end;$$;
revoke all on function public.my_notification_channels(),public.set_notification_preference(text,text,boolean) from public,anon,service_role;
grant execute on function public.my_notification_channels(),public.set_notification_preference(text,text,boolean) to authenticated;

-- 3. One message per announcement x channel x recipient address -------------------------------------
-- Two parent accounts may verify the same address (shared family inbox/phone). The second row for the
-- same announcement and channel is skipped at claim time, so one address is never mailed/charged twice.
alter table gina.channel_outbox add column recipient_digest text check(recipient_digest is null or recipient_digest ~ '^[a-f0-9]{64}$');
create index channel_outbox_recipient on gina.channel_outbox((payload->>'announcement_id'),channel,recipient_digest) where recipient_digest is not null;
alter table gina.channel_outbox add column requeue_count int not null default 0 check(requeue_count between 0 and 3);
create or replace function public.channel_claim(p_limit int default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;recipient text;reason text;digest text;out jsonb:='[]'::jsonb;v gina.contact_verifications;begin
 update gina.channel_outbox set status='failed',last_error='retry_limit',lease_id=null,payload=payload-'secret'
 where attempts>=5 and (status='pending' or (status='sending' and claimed_at<now()-interval '5 minutes'));
 for r in update gina.channel_outbox o set status='sending',attempts=o.attempts+1,claimed_at=now(),lease_id=gen_random_uuid()
  where o.id in(select id from gina.channel_outbox where attempts<5 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes'))
  order by created_at limit greatest(1,least(coalesce(p_limit,5),50)) for update skip locked) returning o.* loop
  reason:=null;recipient:=null;digest:=null;
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
   if reason is null and r.kind='parent_announcement' then
    digest:=encode(extensions.digest(r.channel||':'||recipient,'sha256'),'hex');
    perform pg_advisory_xact_lock(hashtextextended('channel-recipient:'||coalesce(r.payload->>'announcement_id','')||':'||digest,0));
    if exists(select 1 from gina.channel_outbox o2 where o2.id<>r.id and o2.kind='parent_announcement' and o2.channel=r.channel
       and o2.payload->>'announcement_id'=r.payload->>'announcement_id' and o2.recipient_digest=digest and o2.status in('sending','accepted')) then
     reason:='duplicate_recipient';
    else
     update gina.channel_outbox set recipient_digest=digest where id=r.id;
    end if;
   end if;
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
revoke all on function public.channel_claim(int) from public,anon,authenticated;
grant execute on function public.channel_claim(int) to service_role;

-- 4. Operator: failed deliveries and an explicit, bounded retry -------------------------------------
-- Only announcement rows that ended failed or skipped because the provider was not configured can be
-- queued again; accepted rows never. The row keeps its dedupe key and idempotency key, so a retry can
-- never create a second provider message. Verification codes are never re-sent (the secret is gone).
create function public.release_channel_failures(p_limit int default 50) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(x order by (x->>'created_at') desc),'[]') from (
  select jsonb_build_object('id',o.id,'channel',o.channel,'kind',o.kind,'purpose',o.purpose,'status',o.status,'skip_reason',o.skip_reason,
   'last_error',o.last_error,'attempts',o.attempts,'requeue_count',o.requeue_count,'created_at',o.created_at,
   'announcement_id',o.payload->>'announcement_id','announcement_title',(select a.title from gina.parent_announcements a where a.id::text=o.payload->>'announcement_id'),
   'requeueable',o.kind='parent_announcement' and o.requeue_count<3 and (o.status='failed' or (o.status='skipped' and o.skip_reason='provider_unconfigured'))
     and exists(select 1 from gina.parent_announcements a where a.id::text=o.payload->>'announcement_id' and a.status='published' and a.expires_on>=current_date)) x
  from gina.channel_outbox o where (o.status='failed' or (o.status='skipped' and o.skip_reason in('provider_unconfigured','duplicate_recipient'))) and o.created_at>now()-interval '30 days'
  order by o.created_at desc limit greatest(1,least(coalesce(p_limit,50),200)))s),
  'readiness',gina.channel_readiness(),'note','accepted = provider accepted the message; not delivered, not read');
end;$$;
create function public.release_requeue_channel(p_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare o gina.channel_outbox;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 select * into o from gina.channel_outbox where id=p_id for update;
 if not found then raise exception 'not_found';end if;
 if o.status='accepted' then return jsonb_build_object('id',o.id,'status','already_accepted');end if;
 if o.status in('pending','sending') then return jsonb_build_object('id',o.id,'status','already_queued');end if;
 if o.kind<>'parent_announcement' or not (o.status='failed' or (o.status='skipped' and o.skip_reason='provider_unconfigured')) then raise exception 'channel_not_requeueable';end if;
 if o.requeue_count>=3 then raise exception 'channel_requeue_limit';end if;
 if not exists(select 1 from gina.parent_announcements a where a.id::text=o.payload->>'announcement_id' and a.status='published' and a.expires_on>=current_date) then raise exception 'announcement_not_current';end if;
 if not gina.channel_ready(o.channel) then raise exception 'channel_not_ready';end if;
 -- Recipient, preference and announcement currency are checked again at claim time.
 update gina.channel_outbox set status='pending',skip_reason=null,last_error=null,attempts=0,lease_id=null,next_attempt_at=now(),requeue_count=requeue_count+1 where id=o.id;
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'channel.requeue','channel_outbox',o.id::text,jsonb_build_object('channel',o.channel,'previous',o.status||coalesce(':'||o.skip_reason,'')));
 return jsonb_build_object('id',o.id,'status','queued');
end;$$;
revoke all on function public.release_channel_failures(int),public.release_requeue_channel(bigint) from public,anon,service_role;
grant execute on function public.release_channel_failures(int),public.release_requeue_channel(bigint) to authenticated;

-- 5. Scoped announcement targeting -------------------------------------------------------------------
-- A release operator with scope rows may only target places inside that scope (never "everyone").
-- Operators without scope rows keep today's global release authority; admins are unrestricted.
create table gina.operations_member_scopes(
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role='release'),
 place_id uuid not null references gina.education_places(id) on delete cascade,
 granted_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 primary key(user_id,role,place_id));
alter table gina.operations_member_scopes enable row level security;
revoke all on gina.operations_member_scopes from public,anon,authenticated,service_role;
create function gina.announcement_scope_allowed(p_place uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or coalesce(gina.is_admin_strict(),false)
  or not exists(select 1 from gina.operations_member_scopes where user_id=auth.uid() and role='release')
  or (p_place is not null and exists(select 1 from gina.operations_member_scopes s join gina.education_ancestors(p_place) a on a.id=s.place_id where s.user_id=auth.uid() and s.role='release'))$$;
create function gina.announcement_scope_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (tg_op='INSERT' or new.place_id is distinct from old.place_id or (new.status='published' and old.status is distinct from 'published'))
    and not gina.announcement_scope_allowed(new.place_id) then
  raise exception 'announcement_scope_forbidden' using errcode='42501';end if;
 return new;end;$$;
create trigger parent_announcements_scope before insert or update on gina.parent_announcements for each row execute function gina.announcement_scope_guard();
revoke all on function gina.announcement_scope_allowed(uuid),gina.announcement_scope_guard() from public,anon,authenticated,service_role;
