-- H04: product e-mail/SMS language follows the account language, like the Auth e-mails.
-- Before: only the newest push token's locale, so a parent without a push token (web, or push declined)
-- always got Turkish, and an unsupported token locale was passed through. Now: user_metadata.locale
-- (written at sign-up and synced on language change; the Auth templates read the same value), then the
-- newest push token with a supported locale, then Turkish. Signature, grants and every other part of
-- the C10 claim are unchanged.
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
    'locale',coalesce(
      (select u.raw_user_meta_data->>'locale' from auth.users u where u.id=r.user_id and u.raw_user_meta_data->>'locale' in('tr','en')),
      (select t.locale from public.push_tokens t where t.user_id=r.user_id and t.locale in('tr','en') order by t.updated_at desc limit 1),'tr'),
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

-- H04: readiness needs a worker report younger than 24 h, but the worker only ran when something was due.
-- After a quiet day the e-mail channel turned "not ready": the verification form disappeared and new
-- announcements skipped e-mail as channel_not_ready. Once a provider is selected, the existing one-minute
-- tick also wakes the worker when that channel's report is older than 12 h. No provider selected: no
-- extra calls.
create function gina.channel_heartbeat_due() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from (values('email'),('sms')) c(channel)
  where gina.setting_text('channels.'||c.channel||'.provider') is not null
  and not exists(select 1 from gina.channel_provider_status s where s.channel=c.channel and s.reported_at>now()-interval '12 hours'))$$;
revoke all on function gina.channel_heartbeat_due() from public,anon,authenticated,service_role;
create or replace function gina.kick_push_send() returns void language plpgsql security definer set search_path=public as $$
declare v_url text;v_secret text;begin
 if not (gina.push_delivery_due() or gina.channel_delivery_due() or gina.channel_heartbeat_due()) then return;end if;
 begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='push_send_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='push_send_secret';
  if v_url is null or v_secret is null then return;end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||v_secret),body:='{}'::jsonb);
 exception when others then raise notice 'push-send tetiklenemedi';end;
end;$$;
