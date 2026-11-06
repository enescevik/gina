-- C10 (20261106300000_channel_ui_support): parent channel UI support, single-use + one-click
-- unsubscribe, one message per announcement x channel x address, operator retry, scoped targeting,
-- push token refresh / withdrawal cancel. Synthetic users only; rolled back.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000011601','c10-operator@test.local',false),
 ('00000000-0000-4000-8000-000000011602','c10-parent-a@test.local',false),
 ('00000000-0000-4000-8000-000000011603','c10-parent-b@test.local',false),
 ('00000000-0000-4000-8000-000000011604','c10-parent-c@test.local',false),
 ('00000000-0000-4000-8000-000000011605','c10-scoped@test.local',false);
insert into public.operations_members(user_id,role,expires_at) values
 ('00000000-0000-4000-8000-000000011601','release',now()+interval '1 day'),('00000000-0000-4000-8000-000000011605','release',now()+interval '1 day');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000011601','C10 F1','00000000-0000-4000-8000-000000011602'),('10000000-0000-4000-8000-000000011602','C10 F2','00000000-0000-4000-8000-000000011604');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000011601','00000000-0000-4000-8000-000000011602'),('10000000-0000-4000-8000-000000011601','00000000-0000-4000-8000-000000011603'),('10000000-0000-4000-8000-000000011602','00000000-0000-4000-8000-000000011604');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000011601','10000000-0000-4000-8000-000000011601','C10 Child',3),('20000000-0000-4000-8000-000000011602','10000000-0000-4000-8000-000000011602','C10 Child 2',4);
insert into gina.education_places(id,kind,parent_id,name) values
 ('ec000000-0000-4000-8000-000000011601','region','ec000000-0000-4000-8000-000000000001','C10 Bölge A'),
 ('ec000000-0000-4000-8000-000000011602','school','ec000000-0000-4000-8000-000000011601','C10 Okul A'),
 ('ec000000-0000-4000-8000-000000011603','region','ec000000-0000-4000-8000-000000000001','C10 Bölge B');
insert into gina.child_education_locations(child_id,place_id,stage) values('20000000-0000-4000-8000-000000011601','ec000000-0000-4000-8000-000000011602','primary'),('20000000-0000-4000-8000-000000011602','ec000000-0000-4000-8000-000000011603','primary');
insert into gina.operations_member_scopes(user_id,role,place_id) values('00000000-0000-4000-8000-000000011605','release','ec000000-0000-4000-8000-000000011601');
insert into auth.sessions(id,user_id) values(gen_random_uuid(),'00000000-0000-4000-8000-000000011602'),(gen_random_uuid(),'00000000-0000-4000-8000-000000011603'),(gen_random_uuid(),'00000000-0000-4000-8000-000000011604');
create function pg_temp.as_user(u text,f text) returns void language sql as $$select set_config('request.jwt.claims','{"sub":"'||u||'","role":"authenticated","gina":{"role":"parent"'||case when f is null then '' else ',"family_id":"'||f||'"' end||'}}',true)$$;
create function pg_temp.operator() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000011601',null)$$;
create function pg_temp.scoped() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000011605',null)$$;
create function pg_temp.parent_a() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000011602','10000000-0000-4000-8000-000000011601')$$;
create function pg_temp.parent_b() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000011603','10000000-0000-4000-8000-000000011601')$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
create function pg_temp.ann(n int) returns uuid language sql as $$select ('aa000000-0000-4000-8000-0000000116'||lpad(n::text,2,'0'))::uuid$$;
create function pg_temp.value(chs jsonb,place text default null) returns jsonb language sql as $$select jsonb_build_object('title','Service notice','body','Please read the family announcement.','push',true,'expires_on',current_date+7,'channels',chs,'place_id',place)$$;
-- Signs an arbitrary token body with the real secret (to build expired/foreign tokens).
create function pg_temp.sign(body text) returns text language sql as $$select translate(replace(encode(convert_to(body,'utf8'),'base64'),E'\n',''),'+/=','-_')||'.'||left(encode(extensions.hmac(convert_to(body,'utf8'),(select unsubscribe_secret from gina.channel_settings),'sha256'),'hex'),40)$$;
create function pg_temp.publish(n int,req int) returns jsonb language plpgsql as $$declare fp text;begin
 fp:=public.admin_preview_announcement(pg_temp.ann(n),1)->>'fingerprint';
 return public.admin_publish_announcement(('70000000-0000-4000-8000-0000000116'||lpad(req::text,2,'0'))::uuid,pg_temp.ann(n),1,fp,true);end$$;
create temp table kv(k text primary key,v text); grant all on kv to authenticated,service_role,anon;
grant execute on function pg_temp.publish(int,int),pg_temp.ann(int),pg_temp.value(jsonb,text) to authenticated;
update public.app_settings set value='"smtp"' where key='channels.email.provider';
update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
insert into gina.channel_provider_status(channel,provider,configured,missing) values('email','smtp',true,'{}') on conflict(channel) do update set configured=true,missing='{}',reported_at=now();

-- Grants: anon surface unchanged; one-click is service-role only; operator views need release -------
select is((select string_agg(n.nspname||'.'||p.proname,',' order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','gina') and p.prokind='f' and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'EXECUTE')),
  'public.get_shared_child_view,public.unsubscribe_with_token','anon may still only run the share view and the signed unsubscribe');
select ok(not has_function_privilege('authenticated','public.channel_one_click_unsubscribe(text)','EXECUTE') and has_function_privilege('service_role','public.channel_one_click_unsubscribe(text)','EXECUTE'),'one-click unsubscribe is callable only by the Edge function (service role)');
select ok(not has_function_privilege('service_role','public.release_requeue_channel(bigint)','EXECUTE'),'requeue is an operator action, not a worker action');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gina' and c.relname in('unsubscribe_token_uses','operations_member_scopes') and not c.relrowsecurity),'new tables have RLS');
set local role authenticated;select pg_temp.parent_a();
select throws_ok($$select public.release_channel_failures(10)$$,'42501','forbidden','parent cannot list failed deliveries');
select throws_ok($$select public.release_requeue_channel(1)$$,'42501','forbidden','parent cannot requeue');
select throws_ok($$select * from gina.unsubscribe_token_uses$$,'42501',null,'token use table is private');

-- Parent view: limits, attempts, marketing lock, consent history ------------------------------------
select is(public.my_notification_channels()->'limits'->'email'->>'requests_left','3','three verification requests per hour available');
select is(public.my_notification_channels()->>'marketing_allowed','false','marketing is reported locked');
select is(public.request_contact_verification('email','c10-a@example.com')->>'status','pending','verification requested');
select is(public.my_notification_channels()->'limits'->'email'->>'requests_left','2','request limit counts down');
select ok(public.my_notification_channels()->'limits'->'email'->>'last_requested_at' is not null,'last request time exposed for the resend cooldown');
select is(public.my_notification_channels()->'pending'->0->>'attempts_left','5','five code attempts available');
select is(public.confirm_contact_verification('WRONG123')->>'status','invalid','wrong code');
select is(public.my_notification_channels()->'pending'->0->>'attempts_left','4','attempts left shown after a wrong code');
select throws_ok($$select public.set_notification_preference('email','announcement',true)$$,'P0001','address_unverified','cannot opt in to email before the address is verified');
select throws_ok($$select public.set_notification_preference('sms','announcement',true)$$,'P0001','address_unverified','cannot opt in to SMS without a verified number');
select is(public.set_notification_preference('sms','announcement',false)->'preferences'->'sms'->>'announcement','false','turning a channel off never needs an address');
reset role;
insert into kv select 'code',payload->>'secret' from gina.channel_outbox where kind='contact_verification' and status='pending' and user_id='00000000-0000-4000-8000-000000011602';
set local role authenticated;select pg_temp.parent_a();
select is(public.confirm_contact_verification(lower((select v from kv where k='code')))->>'status','verified','code from the mail/deep link verifies (case-insensitive)');
select is(public.set_notification_preference('email','announcement',true)->'effective'->'email'->>'announcement','allowed','explicit opt-in after verification');
select is(public.set_notification_preference('email','marketing',true)->'effective'->'email'->>'marketing','marketing_legal_review_pending','marketing opt-in is recorded but never sendable without legal review');
select is(jsonb_array_length(public.my_notification_channels()->'consent_history'),3,'consent history lists the parent''s own changes');
select is(public.my_notification_channels()->'consent_history'->0->>'purpose','marketing','consent history is newest first');
reset role;
select is((select count(*)::int from gina.notification_consent_log where user_id='00000000-0000-4000-8000-000000011602' and policy_version='channels-2026-11-06'),3,'each user change records the consent wording version');
select is((select gina.channel_block_reason('00000000-0000-4000-8000-000000011602','email','marketing')),'marketing_legal_review_pending','marketing is blocked at send time');

-- Unverified address: never handed to the adapter -------------------------------------------------
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key) values('00000000-0000-4000-8000-000000011604','10000000-0000-4000-8000-000000011602','email','announcement','parent_announcement','{}','c10-unverified');
set local role service_role;select pg_temp.service();
select is(jsonb_array_length(public.channel_claim(5)),0,'row for a parent without a verified address is not claimed for sending');
reset role;
select is((select status||':'||skip_reason from gina.channel_outbox where dedupe_key='c10-unverified'),'skipped:address_unverified','unverified address skip is recorded');

-- Same address on two parent accounts: one message per announcement x channel x address -------------
insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000011603','email','c10-a@example.com');
insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values('00000000-0000-4000-8000-000000011603','email','announcement',true,'user');
set local role authenticated;select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(1),0,pg_temp.value('["email"]'))$$,'global announcement draft');
select is(pg_temp.publish(1,1)->'channels'->'email'->>'queued','2','two parents opted in: two outbox rows');
reset role;
set local role service_role;select pg_temp.service();
insert into kv select 'claim',public.channel_claim(5)::text;
select is(jsonb_array_length((select v::jsonb from kv where k='claim')),1,'only one row is handed to the adapter for the shared address');
reset role;
select is((select count(*)::int from gina.channel_outbox where payload->>'announcement_id'=pg_temp.ann(1)::text and skip_reason='duplicate_recipient'),1,'second row skipped as duplicate_recipient (no second message, no second charge)');
select is((select count(distinct recipient_digest)::int from gina.channel_outbox where recipient_digest is not null),1,'recipient stored only as a digest');
-- Retry of the same row is not a duplicate: it keeps its idempotency key.
set local role service_role;select pg_temp.service();
select is(public.channel_record_result((select (v::jsonb->0->>'id')::bigint from kv where k='claim'),(select (v::jsonb->0->>'lease_id')::uuid from kv where k='claim'),'retry','smtp',null,'smtp:rcpt_to_450',null),true,'transient failure recorded');
reset role;
update gina.channel_outbox set next_attempt_at=now()-interval '1 second' where id=(select (v::jsonb->0->>'id')::bigint from kv where k='claim');
set local role service_role;select pg_temp.service();
insert into kv select 'claim2',public.channel_claim(5)::text;
select is((select v::jsonb->0->>'id' from kv where k='claim2'),(select v::jsonb->0->>'id' from kv where k='claim'),'the retried row is the same row (same idempotency key)');
select is(public.channel_record_result((select (v::jsonb->0->>'id')::bigint from kv where k='claim2'),(select (v::jsonb->0->>'lease_id')::uuid from kv where k='claim2'),'failed','smtp',null,'smtp:rcpt_to_550',null),true,'permanent failure recorded');
reset role;

-- Operator: failed list and bounded requeue ------------------------------------------------------------
insert into kv select 'dup',id::text from gina.channel_outbox where skip_reason='duplicate_recipient';
insert into kv select 'ver',id::text from gina.channel_outbox where kind='contact_verification' limit 1;
set local role authenticated;select pg_temp.operator();
insert into kv select 'failures',public.release_channel_failures(50)::text;
select ok((select v::jsonb->'rows' from kv where k='failures') @> jsonb_build_array(jsonb_build_object('id',(select (v::jsonb->0->>'id')::bigint from kv where k='claim'),'status','failed','requeueable',true)),'failed row is listed as requeueable');
select ok((select v::jsonb from kv where k='failures')::text !~ 'c10-a@example','failure list never shows the address');
select ok((select v::jsonb->'rows' from kv where k='failures') @> '[{"skip_reason":"duplicate_recipient","requeueable":false}]','duplicate skip is visible and not requeueable');
select is(public.release_requeue_channel((select (v::jsonb->0->>'id')::bigint from kv where k='claim'))->>'status','queued','operator requeues the failed row');
select is(public.release_requeue_channel((select (v::jsonb->0->>'id')::bigint from kv where k='claim'))->>'status','already_queued','second requeue is a no-op');
select throws_ok($$select public.release_requeue_channel((select v::bigint from kv where k='dup'))$$,'P0001','channel_not_requeueable','duplicate skip cannot be requeued');
select throws_ok($$select public.release_requeue_channel((select v::bigint from kv where k='ver'))$$,'P0001','channel_not_requeueable','verification codes are never re-sent by an operator');
reset role;
select is((select status||':'||attempts||':'||requeue_count from gina.channel_outbox where id=(select (v::jsonb->0->>'id')::bigint from kv where k='claim')),'pending:0:1','requeued row is pending with a fresh attempt budget');
set local role service_role;select pg_temp.service();
insert into kv select 'claim3',public.channel_claim(5)::text;
select is((select v::jsonb->0->>'id' from kv where k='claim3'),(select v::jsonb->0->>'id' from kv where k='claim'),'requeued row is sent as the same row');
select is(public.channel_record_result((select (v::jsonb->0->>'id')::bigint from kv where k='claim3'),(select (v::jsonb->0->>'lease_id')::uuid from kv where k='claim3'),'accepted','smtp','Q1',null,null),true,'provider accepted after requeue');
reset role;
set local role authenticated;select pg_temp.operator();
select is(public.release_requeue_channel((select (v::jsonb->0->>'id')::bigint from kv where k='claim'))->>'status','already_accepted','accepted rows are never requeued');
reset role;
select is((select count(*)::int from public.audit_log where action='channel.requeue'),1,'requeue is audited once');
-- Requeue needs a ready channel and a bounded count.
update gina.channel_outbox set status='failed',requeue_count=3 where id=(select (v::jsonb->0->>'id')::bigint from kv where k='claim');
set local role authenticated;select pg_temp.operator();
select throws_ok($$select public.release_requeue_channel((select (v::jsonb->0->>'id')::bigint from kv where k='claim'))$$,'P0001','channel_requeue_limit','requeue count is bounded');
reset role;
update gina.channel_outbox set requeue_count=0 where id=(select (v::jsonb->0->>'id')::bigint from kv where k='claim');
update public.app_settings set value='false' where key='channels.email.sender_domain_verified';
set local role authenticated;select pg_temp.operator();
select throws_ok($$select public.release_requeue_channel((select (v::jsonb->0->>'id')::bigint from kv where k='claim'))$$,'P0001','channel_not_ready','no requeue while the channel is not ready');
reset role;
update public.app_settings set value='true' where key='channels.email.sender_domain_verified';

-- Unsubscribe: single use, replay-safe, one-click via service role, expiry ----------------------------
insert into kv values('tok',(select gina.unsubscribe_token('00000000-0000-4000-8000-000000011602','email','announcement')));
set local role anon;
select is(public.unsubscribe_with_token((select v from kv where k='tok'))->>'status','unsubscribed','signed link unsubscribes');
select is(public.unsubscribe_with_token((select v from kv where k='tok'))->>'status','already_done','replaying the link changes nothing');
reset role;
select is((select count(*)::int from gina.notification_consent_log where user_id='00000000-0000-4000-8000-000000011602' and source='unsubscribe_link'),1,'replay writes no second consent row');
select is((select count(*)::int from public.audit_log where action='notification.unsubscribe' and target_id='00000000-0000-4000-8000-000000011602'),1,'replay writes no second audit row');
set local role authenticated;select pg_temp.parent_a();
select is(public.set_notification_preference('email','announcement',true)->'effective'->'email'->>'announcement','allowed','parent opts back in from the app');
reset role;set local role anon;
select is(public.unsubscribe_with_token((select v from kv where k='tok'))->>'enabled','true','an already used link cannot override the newer opt-in');
reset role;
insert into kv values('tok_m',(select gina.unsubscribe_token('00000000-0000-4000-8000-000000011602','email','marketing')));
insert into kv values('tok_exp',pg_temp.sign('00000000-0000-4000-8000-000000011602:email:announcement:'||(extract(epoch from now()-interval '1 day')::bigint)::text));
insert into kv values('tok_srv',pg_temp.sign('00000000-0000-4000-8000-000000011602:email:service:'||(extract(epoch from now()+interval '1 day')::bigint)::text));
set local role anon;
select throws_ok($$select public.channel_one_click_unsubscribe((select v from kv where k='tok_m'))$$,'42501',null,'anon cannot call the one-click function directly');
reset role;set local role service_role;select pg_temp.service();
select is(public.channel_one_click_unsubscribe((select v from kv where k='tok_m'))->>'status','unsubscribed','RFC 8058 one-click POST unsubscribes (service role)');
select is(public.channel_one_click_unsubscribe((select v from kv where k='tok_m'))->>'status','already_done','mail client retry of the POST is a no-op');
select throws_ok($$select public.channel_one_click_unsubscribe((select v from kv where k='tok_exp'))$$,'P0001','unsubscribe_expired','expired link refused');
select throws_ok($$select public.channel_one_click_unsubscribe((select v from kv where k='tok_srv'))$$,'P0001','unsubscribe_invalid','service purpose cannot be unsubscribed by link');
select throws_ok($$select public.channel_one_click_unsubscribe(left((select v from kv where k='tok_m'),-2)||case when right((select v from kv where k='tok_m'),2)='00' then '11' else '00' end)$$,'P0001','unsubscribe_invalid','tampered signature refused');
select throws_ok($$select public.channel_one_click_unsubscribe('@@@@@@@@@@@@@@@@@@@@@@@@.'||repeat('a',40))$$,'P0001','unsubscribe_invalid','malformed token refused without a server error');
reset role;
select is((select string_agg(via,',' order by via) from gina.unsubscribe_token_uses),'link,one_click','each link use is recorded once with its path');

-- Scoped operator: only inside the authorised region ------------------------------------------------
set local role authenticated;select pg_temp.scoped();
select throws_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(2),0,pg_temp.value('["email"]'))$$,'42501','announcement_scope_forbidden','scoped operator cannot target everyone');
select throws_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(2),0,pg_temp.value('["email"]','ec000000-0000-4000-8000-000000011603'))$$,'42501','announcement_scope_forbidden','scoped operator cannot target another region');
select lives_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(2),0,pg_temp.value('[]','ec000000-0000-4000-8000-000000011602'))$$,'scoped operator may target a school inside the region');
select is(public.admin_preview_announcement(pg_temp.ann(2),1)->>'count','2','school target reaches only that school''s parents');
select is(pg_temp.publish(2,2)->>'recipients','2','scoped publish inside the region');
select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(3),0,pg_temp.value('[]'))$$,'global operator drafts a global announcement');
select pg_temp.scoped();
select throws_ok($$select pg_temp.publish(3,3)$$,'42501','announcement_scope_forbidden','scoped operator cannot publish a global draft written by someone else');
reset role;
select is((select count(*)::int from gina.parent_inbox where announcement_id=pg_temp.ann(2) and family_id='10000000-0000-4000-8000-000000011602'),0,'family outside the school receives nothing');

-- Push: token refresh replaces the old token; withdrawal cancels unsent push and email ----------------
set local role authenticated;select pg_temp.parent_a();
select lives_ok($$select public.register_push_token('c10-token-old','ios','tr')$$,'first device token');
select lives_ok($$select public.register_push_token('c10-token-new','ios','tr')$$,'refreshed device token');
select lives_ok($$select public.register_push_token('c10-token-new','ios','tr')$$,'re-registering the same token is idempotent');
reset role;
select is((select string_agg(token,',') from public.push_tokens where user_id='00000000-0000-4000-8000-000000011602'),'c10-token-new','only the refreshed token remains (no double push to one phone)');
set local role authenticated;select pg_temp.operator();
select lives_ok($$select public.admin_save_announcement(gen_random_uuid(),pg_temp.ann(4),0,pg_temp.value('["email"]'))$$,'announcement with push + email');
select is(pg_temp.publish(4,4)->'channels'->'email'->>'queued','2','email queued for both opted-in parents');
select lives_ok($$select public.admin_withdraw_announcement(gen_random_uuid(),pg_temp.ann(4),2)$$,'withdrawn before the worker ran');
reset role;
select is((select count(*)::int from public.push_outbox o where o.kind='parent_announcement' and o.status='no_targets' and o.payload->>'inbox_id' in(select id::text from gina.parent_inbox where announcement_id=pg_temp.ann(4))),3,'pending pushes are cancelled');
select is((select count(*)::int from gina.channel_outbox where payload->>'announcement_id'=pg_temp.ann(4)::text and skip_reason='announcement_withdrawn'),2,'pending emails are cancelled');
select is((select count(*)::int from public.push_outbox o where o.kind='parent_announcement' and o.payload::text ~ 'Service notice|example'),0,'push payload carries ids only, never announcement text or addresses');
select * from finish();
rollback;
