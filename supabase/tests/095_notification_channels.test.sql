begin;
select no_plan();
-- Fixtures: release operator, family F1 (parent A with session + push token, parent B without session),
-- family F2 (parent C), a paired tablet (anonymous auth user) and a user without any family.
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000009501','ch-operator@test.local',false),('00000000-0000-4000-8000-000000009502','ch-parent-a@test.local',false),
 ('00000000-0000-4000-8000-000000009503','ch-parent-b@test.local',false),('00000000-0000-4000-8000-000000009504','ch-parent-c@test.local',false),
 ('00000000-0000-4000-8000-000000009505',null,true),('00000000-0000-4000-8000-000000009506','ch-nofamily@test.local',false);
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000009501','release',now()+interval '1 day');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000009501','F1','00000000-0000-4000-8000-000000009502'),('10000000-0000-4000-8000-000000009502','F2','00000000-0000-4000-8000-000000009504');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000009501','00000000-0000-4000-8000-000000009502'),('10000000-0000-4000-8000-000000009501','00000000-0000-4000-8000-000000009503'),('10000000-0000-4000-8000-000000009502','00000000-0000-4000-8000-000000009504');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000009501','10000000-0000-4000-8000-000000009501','Child',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('30000000-0000-4000-8000-000000009501','10000000-0000-4000-8000-000000009501','00000000-0000-4000-8000-000000009505','20000000-0000-4000-8000-000000009501');
insert into auth.sessions(id,user_id) values(gen_random_uuid(),'00000000-0000-4000-8000-000000009502'),(gen_random_uuid(),'00000000-0000-4000-8000-000000009504');
insert into public.push_tokens(user_id,family_id,role,platform,token,token_type,locale) values('00000000-0000-4000-8000-000000009502','10000000-0000-4000-8000-000000009501','parent','ios','qa-channel-token-a','apns','en');
create function pg_temp.q(stmt text) returns text language plpgsql security definer as $$declare v text;begin execute stmt into v;return v;end$$;
grant execute on function pg_temp.q(text) to authenticated,service_role,anon;
create function pg_temp.as_user(u text,f text) returns void language sql as $$select set_config('request.jwt.claims','{"sub":"'||u||'","role":"authenticated","gina":{"role":"parent"'||case when f is null then '' else ',"family_id":"'||f||'"' end||'}}',true)$$;
create function pg_temp.operator() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000009501',null)$$;
create function pg_temp.parent_a() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000009502','10000000-0000-4000-8000-000000009501')$$;
create function pg_temp.parent_b() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000009503','10000000-0000-4000-8000-000000009501')$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
create function pg_temp.ann(n int) returns uuid language sql as $$select ('aa000000-0000-4000-8000-00000000950'||n)::uuid$$;
create function pg_temp.value(chs jsonb) returns jsonb language sql as $$select jsonb_build_object('title','Service notice','body','Please read the family announcement.','push',true,'expires_on',current_date+7,'channels',chs)$$;
create temp table kv(k text primary key,v text); grant all on kv to authenticated,service_role,anon;

-- Authority ---------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.request_contact_verification('email','x@example.com')$$,'42501',null,'anonymous cannot request verification');
select throws_ok($$select public.channel_claim(1)$$,'42501',null,'anonymous cannot claim outbox');
reset role;set local role authenticated;select pg_temp.parent_a();
select throws_ok($$select public.channel_claim(1)$$,'42501',null,'parent cannot run the worker');
select throws_ok($$select public.channel_record_result(1,gen_random_uuid(),'accepted')$$,'42501',null,'parent cannot record receipts');
select throws_ok($$select public.channel_readiness()$$,'42501','forbidden','parent cannot read operator readiness');
select throws_ok($$select public.release_channel_operations()$$,'42501','forbidden','parent cannot read operator summary');
select throws_ok($$select * from gina.contact_channels$$,'42501',null,'contact table is private');
select throws_ok($$select * from gina.channel_outbox$$,'42501',null,'outbox table is private');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009505","role":"authenticated","is_anonymous":true,"gina":{"role":"device","family_id":"10000000-0000-4000-8000-000000009501"}}',true);
select throws_ok($$select public.request_contact_verification('email','tablet@example.com')$$,'42501','forbidden','tablet session cannot register a contact address');
select throws_ok($$select public.set_notification_preference('email','announcement',true)$$,'42501','forbidden','tablet session has no preferences');

-- Readiness gates every send ----------------------------------------------------------------------
select pg_temp.operator();
select is(public.channel_readiness()->'email'->>'ready','false','email not ready without provider/domain/worker');
select ok((public.channel_readiness()->'email'->'missing') @> '["provider_not_selected","sender_domain_unverified","from_address_missing","worker_report_missing"]','email readiness names every missing piece');
select is(public.channel_readiness()->'sms'->>'ready','false','sms not ready');
select is(public.channel_readiness()->'push'->>'ready','false','push readiness unknown until the worker reports');
select is(public.channel_readiness()->'marketing'->>'allowed','false','marketing blocked until legal review');
select pg_temp.parent_a();
select throws_ok($$select public.request_contact_verification('email','parent-a@example.com')$$,'P0001','channel_not_ready','no verification mail is promised while email is not ready');
reset role;
update public.app_settings set value='"resend"' where key='channels.email.provider';
update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
set local role service_role;select pg_temp.service();
select lives_ok($$select public.channel_report_provider_status('email','resend',true,'{}')$$,'worker reports email provider configured');
select lives_ok($$select public.channel_report_provider_status('push','apns+fcm',false,'{}')$$,'worker reports push secrets missing');
reset role;set local role authenticated;select pg_temp.operator();
select is(public.channel_readiness()->'email'->>'ready','true','email ready after configuration + worker heartbeat');
select is(public.channel_readiness()->'push'->'missing','["provider_secret_missing"]'::jsonb,'push readiness reflects the worker report');
reset role;set local role service_role;select pg_temp.service();
select lives_ok($$select public.channel_report_provider_status('email','resend',false,'{unsubscribe_url_missing}')$$,'worker can report a missing secret');
reset role;set local role authenticated;select pg_temp.operator();
select ok((public.channel_readiness()->'email'->'missing') @> '["provider_secret_missing","unsubscribe_url_missing"]','missing secret flips email back to not ready');
reset role;set local role service_role;select pg_temp.service();
select lives_ok($$select public.channel_report_provider_status('email','resend',true,'{}')$$,'worker restores email readiness');

-- Verification -----------------------------------------------------------------------------------
reset role;set local role authenticated;select pg_temp.parent_a();
select throws_ok($$select public.request_contact_verification('email','not-an-address')$$,'P0001','contact_invalid','malformed address rejected');
select throws_ok($$select public.request_contact_verification('sms','+905551112233')$$,'P0001','channel_not_ready','sms verification refused while sms is not ready');
select is(public.request_contact_verification('email','  Parent-A@Example.com ')->>'status','pending','verification requested');
select is(public.request_contact_verification('email','parent-a@example.com')->>'masked','p***@example.com','address is masked in responses');
select is(jsonb_array_length(public.my_notification_channels()->'pending'),1,'one pending verification per kind');
select is(public.my_notification_channels()->'effective'->'email'->>'announcement','address_unverified','unverified address blocks announcements');
reset role;
select is((select count(*)::int from gina.channel_outbox where kind='contact_verification'),2,'each request writes one outbox row');
select is((select count(*)::int from gina.channel_outbox where kind='contact_verification' and status='skipped' and skip_reason='verification_superseded'),1,'previous verification message is superseded, not sent twice');
select is((select count(*)::int from gina.channel_outbox where kind='contact_verification' and status='pending' and payload ? 'secret'),1,'only the live verification carries the secret');
insert into kv select 'secret',payload->>'secret' from gina.channel_outbox where kind='contact_verification' and status='pending';
select is((select count(*)::int from gina.contact_verifications where token_hash=encode(extensions.digest((select v from kv where k='secret'),'sha256'),'hex') and consumed_at is null),1,'only the hash of the token is stored');
set local role authenticated;select pg_temp.parent_a();
select is(public.confirm_contact_verification('wrong-token')->>'status','invalid','wrong token rejected');
select pg_temp.parent_b();
select is(public.confirm_contact_verification((select v from kv where k='secret'))->>'status','invalid','another parent cannot consume the token');
select pg_temp.parent_a();
select is(public.confirm_contact_verification((select v from kv where k='secret'))->>'status','verified','correct token verifies the address');
select is(public.confirm_contact_verification((select v from kv where k='secret'))->>'status','invalid','token is single use');
select is(public.request_contact_verification('email','parent-a@example.com')->>'status','already_verified','re-requesting a verified address is a no-op');
reset role;
select is((select count(*)::int from gina.contact_channels where user_id='00000000-0000-4000-8000-000000009502' and kind='email' and revoked_at is null and value='parent-a@example.com'),1,'verified address stored normalized');
select is((select count(*)::int from gina.channel_outbox where kind='contact_verification' and payload ? 'secret'),0,'secret scrubbed once the verification is consumed');
select is((select skip_reason from gina.channel_outbox where kind='contact_verification' order by id desc limit 1),'verification_consumed','unsent verification row closed on confirm');
select is((select attempts from gina.contact_verifications where consumed_at is not null),1,'wrong attempt counted');
set local role authenticated;select pg_temp.parent_a();
select lives_ok($$select public.request_contact_verification('email','second@example.com')$$,'third request within the hour');
select throws_ok($$select public.request_contact_verification('email','third@example.com')$$,'P0001','verification_rate_limited','fourth request within the hour is limited');
-- Five wrong confirmations cancel the pending verification.
select is(public.confirm_contact_verification('bad-1')->>'remaining','4','wrong 1: remaining attempts reported');
select is(public.confirm_contact_verification('bad-2')->>'remaining','3','wrong 2: remaining attempts reported');
select is(public.confirm_contact_verification('bad-3')->>'remaining','2','wrong 3: remaining attempts reported');
select is(public.confirm_contact_verification('bad-4')->>'remaining','1','wrong 4: remaining attempts reported');
select is(public.confirm_contact_verification('bad-5')->>'remaining','0','wrong 5: remaining attempts reported');
reset role;
select is((select count(*)::int from gina.contact_verifications where value='second@example.com' and cancelled_at is not null),1,'pending verification cancelled after five wrong attempts');
set local role service_role;select pg_temp.service();
select is(jsonb_array_length(public.channel_claim(5)),0,'cancelled verification is never handed to the adapter');
reset role;
select is((select skip_reason from gina.channel_outbox where payload->>'verification_id'=(select id::text from gina.contact_verifications where value='second@example.com')),'verification_superseded','cancelled verification row is skipped with a reason');

-- Child rule --------------------------------------------------------------------------------------
select throws_ok($$insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000009505','email','tablet@example.com')$$,'P0001','child_contact_forbidden','tablet account never holds an address');
select throws_ok($$insert into gina.contact_verifications(user_id,kind,value,token_hash,expires_at) values('00000000-0000-4000-8000-000000009505','sms','+905551112233',repeat('a',64),now())$$,'P0001','child_contact_forbidden','tablet account never holds a verification');
select throws_ok($$insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000009506','email','nofamily@example.com')$$,'P0001','parent_account_required','accounts outside a family hold no address');
select throws_ok($$insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000009503','email','bad address')$$,'23514',null,'malformed stored address rejected by constraint');

-- Preferences: an address is not consent --------------------------------------------------------
set local role authenticated;select pg_temp.parent_a();
select is(public.my_notification_channels()->'effective'->'email'->>'announcement','preference_off','verified address alone does not enable announcements');
select is(public.my_notification_channels()->'effective'->'email'->>'service','allowed','service messages may use the verified address');
select is(public.my_notification_channels()->'preferences'->'push'->>'announcement','true','push announcement preference read from push_preferences');
select throws_ok($$select public.set_notification_preference('push','announcement',false)$$,'P0001','use_push_preferences','push stays in push_preferences');
select throws_ok($$select public.set_notification_preference('in_app','service',false)$$,'P0001','service_in_app_required','in-app service notices cannot be disabled');
select throws_ok($$select public.set_notification_preference('fax','service',true)$$,'P0001','invalid_input','unknown channel rejected');
select is(public.set_notification_preference('email','announcement',true)->'effective'->'email'->>'announcement','allowed','explicit opt-in enables email announcements');
select is(public.set_notification_preference('email','marketing',true)->'effective'->'email'->>'marketing','marketing_legal_review_pending','marketing stays blocked without legal review even when opted in');
reset role;
select is((select count(*)::int from gina.notification_consent_log where user_id='00000000-0000-4000-8000-000000009502'),2,'every preference change is logged');
insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000009503','email','parent-b@example.com');

-- Announcement fan-out -----------------------------------------------------------------------------
set local role authenticated;select pg_temp.operator();
select throws_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(1),0,pg_temp.value('["fax"]'))$$,'P0001','announcement_invalid','unknown channel rejected in draft');
select lives_ok($$select public.admin_save_announcement('70000000-0000-4000-8000-000000009501',pg_temp.ann(1),0,pg_temp.value('["email","sms"]'))$$,'draft with email + sms saved');
select is(public.admin_preview_announcement(pg_temp.ann(1),1)->>'count','3','three parents in the audience');
select is(public.admin_preview_announcement(pg_temp.ann(1),1)->'channels'->'email'->>'eligible','1','only the verified + opted-in parent is eligible for email');
select is(public.admin_preview_announcement(pg_temp.ann(1),1)->'channels'->'email'->'blocked','{"preference_off":1,"address_unverified":1}'::jsonb,'email skips are explained per reason');
select is(public.admin_preview_announcement(pg_temp.ann(1),1)->'channels'->'sms'->'blocked','{"channel_not_ready":3}'::jsonb,'sms is not ready: nobody is promised an SMS');
insert into kv values('fp',public.admin_preview_announcement(pg_temp.ann(1),1)->>'fingerprint');
insert into kv values('publish',public.admin_publish_announcement('70000000-0000-4000-8000-000000009502',pg_temp.ann(1),1,(select v from kv where k='fp'),true)::text);
select is((select v::jsonb->'channels'->'email' from kv where k='publish'),'{"queued":1,"preference_off":1,"address_unverified":1}'::jsonb,'publish result separates email outcomes');
select is((select v::jsonb->'channels'->'sms' from kv where k='publish'),'{"channel_not_ready":3}'::jsonb,'publish result separates sms outcomes');
select is(public.admin_announcement_channels(pg_temp.ann(1))->'planned'->'email'->>'queued','1','operator view shows planned outcomes');
reset role;
select is((select count(*)::int from gina.parent_inbox where announcement_id=pg_temp.ann(1)),3,'in-app inbox unchanged by channel fan-out');
select is((select count(*)::int from public.push_outbox where kind='parent_announcement'),3,'push outbox unchanged by channel fan-out');
select is((select count(*)::int from gina.channel_outbox where kind='parent_announcement'),1,'one email outbox row for the eligible parent');
select is((select count(*)::int from gina.announcement_channel_summary where announcement_id=pg_temp.ann(1)),4,'summary rows per channel/outcome');

-- Worker: fenced lease, receipts, retry, no double send -----------------------------------------------
set local role service_role;select pg_temp.service();
insert into kv select 'claim',(public.channel_claim(5)->0)::text;
select is((select v::jsonb->>'recipient' from kv where k='claim'),'parent-a@example.com','claim resolves the verified address at send time');
select is((select v::jsonb->>'locale' from kv where k='claim'),'en','locale follows the parent device');
select is((select v::jsonb->'announcement'->>'title' from kv where k='claim'),'Service notice','announcement text comes from the inbox copy');
select ok((select v::jsonb->>'unsubscribe_token' from kv where k='claim') ~ '^[A-Za-z0-9_-]+\.[a-f0-9]{40}$','signed unsubscribe token issued for announcements');
select is((select v::jsonb->>'provider' from kv where k='claim'),'resend','provider selected from configuration');
select is(jsonb_array_length(public.channel_claim(5)),0,'leased row is not claimed twice');
select throws_ok($$select public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim'),gen_random_uuid(),'accepted','resend','msg')$$,'P0001','channel_lease_changed','wrong lease cannot record a receipt');
select throws_ok($$select public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim'),'delivered')$$,'P0001','channel_receipt_invalid','there is no delivered status: provider acceptance only');
select is(public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim'),'retry','resend','','http_429',3600),true,'429 recorded as retry');
reset role;
select is((select status from gina.channel_outbox where kind='parent_announcement'),'pending','retry returns the row to pending');
select ok((select next_attempt_at>=now()+interval '59 minutes' from gina.channel_outbox where kind='parent_announcement'),'provider retry-after honored');
update gina.channel_outbox set next_attempt_at=now()-interval '1 second' where kind='parent_announcement';
set local role service_role;select pg_temp.service();
insert into kv select 'claim2',(public.channel_claim(5)->0)::text;
select is((select v::jsonb->>'attempts' from kv where k='claim2'),'2','second attempt counted');
select throws_ok($$select public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim'),'accepted','resend','msg')$$,'P0001','channel_lease_changed','old worker cannot acknowledge a newer claim');
select is(public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim2'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim2'),'accepted','resend','re_123'),true,'provider acceptance recorded');
select is(public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim2'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim2'),'accepted','resend','re_123'),true,'lost reply is replayable');
select is(public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim2'),gen_random_uuid(),'failed','resend',null,'late'),true,'acceptance is sticky against late contradicting results');
select is(jsonb_array_length(public.channel_claim(5)),0,'accepted row is never sent again');
reset role;
select is((select status||':'||provider_message_id from gina.channel_outbox where kind='parent_announcement'),'accepted:re_123','receipt stored with provider id');
select ok((select accepted_at is not null and last_error is null from gina.channel_outbox where kind='parent_announcement'),'accepted_at set, error cleared');

-- One-tap unsubscribe -----------------------------------------------------------------------------------
set local role anon;
select is(public.unsubscribe_with_token((select v::jsonb->>'unsubscribe_token' from kv where k='claim'))->>'enabled','false','signed link unsubscribes without a session');
select throws_ok($$select public.unsubscribe_with_token(left((select v::jsonb->>'unsubscribe_token' from kv where k='claim'),-1)||'0')$$,'P0001','unsubscribe_invalid','tampered signature rejected');
select throws_ok($$select public.unsubscribe_with_token('garbage')$$,'P0001','unsubscribe_invalid','garbage rejected');
reset role;
select is((select source from gina.notification_preferences where user_id='00000000-0000-4000-8000-000000009502' and channel='email' and purpose='announcement'),'unsubscribe_link','unsubscribe recorded with its source');
select is((select count(*)::int from gina.notification_consent_log where source='unsubscribe_link' and token_issued_at is not null),1,'unsubscribe is auditable');
select is((select count(*)::int from public.audit_log where action='notification.unsubscribe'),1,'unsubscribe audited');
set local role authenticated;select pg_temp.parent_a();
select is(public.my_notification_channels()->'effective'->'email'->>'announcement','preference_off','after unsubscribe announcements are off');
select is(public.my_notification_channels()->'effective'->'email'->>'service','allowed','service purpose is unaffected by an announcement unsubscribe');

-- Skips recorded at publish, revoke, withdraw and claim time ---------------------------------------------
select is(public.set_notification_preference('email','announcement',true)->'effective'->'email'->>'announcement','allowed','parent re-enables explicitly');
select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement('70000000-0000-4000-8000-000000009503',pg_temp.ann(2),0,pg_temp.value('["email"]'))$$,'second draft');
insert into kv values('fp2',public.admin_preview_announcement(pg_temp.ann(2),1)->>'fingerprint');
select is(public.admin_publish_announcement('70000000-0000-4000-8000-000000009504',pg_temp.ann(2),1,(select v from kv where k='fp2'),true)->'channels'->'email'->>'queued','1','second announcement queued for email');
select lives_ok($$select public.admin_withdraw_announcement('70000000-0000-4000-8000-000000009505',pg_temp.ann(2),2)$$,'withdrawn before send');
reset role;
select is((select skip_reason from gina.channel_outbox where payload->>'announcement_id'=pg_temp.ann(2)::text),'announcement_withdrawn','withdrawal closes the unsent email with a reason');
set local role authenticated;select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement('70000000-0000-4000-8000-000000009506',pg_temp.ann(3),0,pg_temp.value('["email"]'))$$,'third draft');
insert into kv values('fp3',public.admin_preview_announcement(pg_temp.ann(3),1)->>'fingerprint');
select is(public.admin_publish_announcement('70000000-0000-4000-8000-000000009507',pg_temp.ann(3),1,(select v from kv where k='fp3'),true)->'channels'->'email'->>'queued','1','third announcement queued');
reset role;
delete from auth.sessions where user_id='00000000-0000-4000-8000-000000009502';
set local role service_role;select pg_temp.service();
select is(jsonb_array_length(public.channel_claim(5)),0,'signed-out parent is re-checked at claim time');
reset role;
select is((select skip_reason from gina.channel_outbox where payload->>'announcement_id'=pg_temp.ann(3)::text),'no_active_session','claim-time skip reason recorded');
insert into auth.sessions(id,user_id) values(gen_random_uuid(),'00000000-0000-4000-8000-000000009502');
set local role authenticated;select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement('70000000-0000-4000-8000-000000009508',pg_temp.ann(4),0,pg_temp.value('["email"]'))$$,'fourth draft');
insert into kv values('fp4',public.admin_preview_announcement(pg_temp.ann(4),1)->>'fingerprint');
select is(public.admin_publish_announcement('70000000-0000-4000-8000-000000009509',pg_temp.ann(4),1,(select v from kv where k='fp4'),true)->'channels'->'email'->>'queued','1','fourth announcement queued');
select pg_temp.parent_a();
select is(jsonb_array_length(public.revoke_contact_channel('email')->'contacts'),0,'parent revokes the address');
reset role;
select is((select skip_reason from gina.channel_outbox where payload->>'announcement_id'=pg_temp.ann(4)::text),'address_revoked','revocation closes unsent email');
-- Retry limit and unconfigured provider are terminal, never silent.
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,attempts) values('00000000-0000-4000-8000-000000009503','10000000-0000-4000-8000-000000009501','email','announcement','parent_announcement','{}','limit-test',5);
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key) values('00000000-0000-4000-8000-000000009503','10000000-0000-4000-8000-000000009501','email','service','contact_verification','{"verification_id":"00000000-0000-4000-8000-000000000000","secret":"x"}','unconfigured-test');
insert into gina.contact_verifications(id,user_id,kind,value,token_hash,expires_at) values('00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000009503','email','parent-b@example.com',repeat('a',64),now()+interval '10 minutes');
set local role service_role;select pg_temp.service();
insert into kv select 'claim5',(public.channel_claim(5)->0)::text;
select is((select v::jsonb->>'recipient' from kv where k='claim5'),'parent-b@example.com','verification goes to the address being verified');
select is(public.channel_record_result((select (v::jsonb->>'id')::bigint from kv where k='claim5'),(select (v::jsonb->>'lease_id')::uuid from kv where k='claim5'),'unconfigured','resend',null,'provider_unconfigured'),true,'unconfigured provider recorded');
reset role;
select is((select status||':'||last_error from gina.channel_outbox where dedupe_key='limit-test'),'failed:retry_limit','retry limit is terminal');
select is((select status||':'||skip_reason from gina.channel_outbox where dedupe_key='unconfigured-test'),'skipped:provider_unconfigured','unconfigured provider is a terminal skip, not a retry loop');
select is((select payload ? 'secret' from gina.channel_outbox where dedupe_key='unconfigured-test'),false,'secret scrubbed on terminal skip');
set local role authenticated;select pg_temp.operator();
select ok(public.release_channel_operations()->'summary'->'email' ? 'accepted','operator summary counts accepted (not delivered) messages');
select is(public.release_channel_operations()->'readiness'->>'note','provider acceptance is not delivery or read','summary labels provider acceptance honestly');
reset role;
select is((select count(*)::int from public.audit_log where action in('contact.verification_requested','contact.verified','contact.revoked')),5,'contact lifecycle audited without addresses');
select is((select count(*)::int from public.audit_log where action like 'contact.%' and details::text like '%example.com%'),0,'audit log never stores the address');
select * from finish();
rollback;
