begin;
select no_plan();
-- Synthetic fixtures only; isolated database.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009401','hard-a@test.invalid'),
 ('00000000-0000-4000-8000-000000009402','hard-b@test.invalid'),
 ('00000000-0000-4000-8000-000000009403','hard-finance@test.invalid');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000009401','Hardening A','00000000-0000-4000-8000-000000009401'),
 ('10000000-0000-4000-8000-000000009402','Hardening B','00000000-0000-4000-8000-000000009402');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000009401','00000000-0000-4000-8000-000000009401'),
 ('10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402');
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000009403','finance',now()+interval '1 day');
create function pg_temp.state(k text, version int, status text default 'active', product text default 'gina_plus_monthly',
  expires timestamptz default now()+interval '30 days', platform text default 'apple', source text default null,
  auto_renew boolean default true, token text default '10000000-0000-4000-8000-000000009401', ack text default null) returns jsonb language sql as $$
 select jsonb_strip_nulls(jsonb_build_object('platform',platform,'storeKey',k,'productId',product,'status',status,
   'expiresAt',expires,'autoRenewing',auto_renew,'version',version,'accountToken',token,'source',source,
   'raw',case when ack is null then '{}'::jsonb else jsonb_build_object('subscription',jsonb_build_object('acknowledgementState',ack)) end));
$$;
create function pg_temp.plan(f uuid) returns text language sql as $$
 select plan::text||'/'||source from public.get_family_entitlement(f);
$$;
create function pg_temp.label(k text) returns text language sql as $$
 select gina.store_verification_label(s) from public.store_subscriptions s where store_key=k;
$$;
-- Privileges ---------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated','public.record_store_account_conflict(public.store_platform,text,uuid,uuid,text)','execute'),'client cannot write conflict audit');
select ok(not has_function_privilege('anon','public.record_store_account_conflict(public.store_platform,text,uuid,uuid,text)','execute'),'anonymous cannot write conflict audit');
select ok(has_function_privilege('service_role','public.record_store_account_conflict(public.store_platform,text,uuid,uuid,text)','execute'),'service writes conflict audit');
select ok(not has_function_privilege('authenticated','public.apply_verified_store_state(jsonb,uuid,uuid)','execute'),'write RPC signature unchanged and still service-only');
select ok(not has_function_privilege('authenticated','gina.store_verification_label(public.store_subscriptions)','execute'),'label helper not callable by clients');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
-- Source tagging and verification label ------------------------------------------------------
select is(public.apply_verified_store_state(pg_temp.state('tag',100,source=>'client_verify'),'10000000-0000-4000-8000-000000009401','00000000-0000-4000-8000-000000009401')->>'plan','plus','client verify writes entitlement');
select is((select last_source from public.store_subscriptions where store_key='tag'),'client_verify','source recorded');
select is((select notified_at from public.store_subscriptions where store_key='tag'),null,'no notification yet');
select is(pg_temp.label('tag'),'client_only','client-only receipt is labelled, not trusted as store-confirmed');
select is(public.apply_verified_store_state(pg_temp.state('tag',200,source=>'notification'))->>'status','active','notification applies newer state');
select isnt((select notified_at from public.store_subscriptions where store_key='tag'),null,'first notification stamps notified_at');
select is(pg_temp.label('tag'),'store_notified','store-confirmed label');
select is(public.apply_verified_store_state(pg_temp.state('tag',150,source=>'notification'))->>'skipped','stale','old notification is still deduplicated');
select is((select last_source from public.store_subscriptions where store_key='tag'),'notification','stale event does not change source');
select is(public.apply_verified_store_state(pg_temp.state('client2',100,source=>'client_verify'))->>'plan','plus','second client-only row');
select is(public.apply_verified_store_state(pg_temp.state('client2',50,source=>'notification'))->>'skipped','stale','late (stale) notification skipped');
select isnt((select notified_at from public.store_subscriptions where store_key='client2'),null,'even a stale notification proves the store knows the key');
select is(public.apply_verified_store_state(pg_temp.state('client3',100,source=>'reconcile'))->>'plan','plus','reconcile source accepted');
select is(pg_temp.label('client3'),'store_checked','reconcile without notification is store_checked, not store_notified');
select is(public.apply_verified_store_state(pg_temp.state('legacy',100))->>'plan','plus','legacy call without source still works');
select is(pg_temp.label('legacy'),'legacy','unsourced legacy row labelled legacy');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('bad-src',100,source=>'refund'))$$,'22023','invalid_store_state','unknown source rejected');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('bad-ack',100)||'{"acknowledged":true}')$$,'22023','invalid_store_state','Apple cannot be marked acknowledged');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('bad-ack2',100,platform=>'google')||'{"acknowledged":"yes"}')$$,'22023','invalid_store_state','acknowledged must be boolean');
-- Google acknowledgement -------------------------------------------------------------------
select is(public.apply_verified_store_state(pg_temp.state('g-ack',100,platform=>'google',source=>'client_verify',ack=>'ACKNOWLEDGEMENT_STATE_PENDING'))->>'plan','plus','Google purchase written before acknowledge');
select is(pg_temp.label('g-ack'),'unacknowledged','unacknowledged Google purchase is labelled');
select ok(exists(select 1 from public.iap_reconcile_candidates(interval '2 days',interval '-1 second',200) where store_key='g-ack'),'unacknowledged Google purchase is a reconcile candidate even far from expiry');
select is(public.apply_verified_store_state(pg_temp.state('g-ack',100,platform=>'google',source=>'client_verify',ack=>'ACKNOWLEDGEMENT_STATE_PENDING')||'{"acknowledged":true}')->>'skipped','stale','acknowledge confirmation with same version is a no-op write');
select is(public.apply_verified_store_state(pg_temp.state('g-legacy',100,platform=>'google'))->>'plan','plus','Google row without observed pending state');
select is(pg_temp.label('g-legacy'),'legacy','no pending observation: not flagged unacknowledged');
select ok(not exists(select 1 from public.iap_reconcile_candidates(interval '2 days',interval '-1 second',200) where store_key='g-legacy'),'not queued for acknowledge without observed pending state');
select isnt((select acknowledged_at from public.store_subscriptions where store_key='g-ack'),null,'acknowledged_at stamped by stale confirmation');
select is(pg_temp.label('g-ack'),'client_only','acknowledged client-only Google purchase');
select ok(not exists(select 1 from public.iap_reconcile_candidates(interval '2 days',interval '-1 second',200) where store_key='g-ack'),'acknowledged purchase leaves the acknowledge queue');
select is(public.apply_verified_store_state(pg_temp.state('g-ack2',100,platform=>'google',source=>'notification')||'{"acknowledged":true}')->>'plan','plus','RTDN-confirmed acknowledged purchase');
select is(pg_temp.label('g-ack2'),'store_notified','notified and acknowledged');
select is((select acknowledged_at from public.store_subscriptions where store_key='g-ack2') is not null,true,'acknowledged_at written on insert');
select is(public.apply_verified_store_state(pg_temp.state('g-ack2',200,platform=>'google',source=>'reconcile'))->>'status','active','later unflagged write');
select isnt((select acknowledged_at from public.store_subscriptions where store_key='g-ack2'),null,'acknowledged_at is never cleared');
-- Two families, one receipt: refusal plus audit ---------------------------------------------
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('tag',300,source=>'client_verify'),'10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402')$$,'P0001','account_mismatch','second family cannot claim bound receipt');
select is(public.record_store_account_conflict('apple','tag','10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402','client_verify'),(select id from public.store_subscriptions where store_key='tag'),'conflict audit resolves owner subscription');
select is((select count(*)::int from public.audit_log where action='store_subscription.account_mismatch'),1,'one audit row');
select is((select family_id from public.audit_log where action='store_subscription.account_mismatch'),'10000000-0000-4000-8000-000000009402','audit attributed to the refused family');
select is((select actor_id from public.audit_log where action='store_subscription.account_mismatch'),'00000000-0000-4000-8000-000000009402','audit names the refused parent');
select is((select details->>'owner_family_id' from public.audit_log where action='store_subscription.account_mismatch'),'10000000-0000-4000-8000-000000009401','audit records owning family for operator review');
select is((select details->>'store_key_hash' from public.audit_log where action='store_subscription.account_mismatch'),encode(sha256('tag'::bytea),'hex'),'hash allows correlation without the raw key');
select is(public.record_store_account_conflict('google','unknown-token-xyz','10000000-0000-4000-8000-000000009402',null,'notification'),null,'conflict on unknown key still recorded');
select is((select count(*)::int from public.audit_log where action='store_subscription.account_mismatch'),2,'second audit row');
select ok((select position('unknown-token-xyz' in details::text)=0 from public.audit_log where action='store_subscription.account_mismatch' and details->>'platform'='google'),'raw token not stored in audit');
select throws_ok($$select public.record_store_account_conflict('apple','tag','10000000-0000-4000-8000-000000009402',null,'refund')$$,'22023','invalid_input','audit source constrained');
select throws_ok($$update public.store_subscriptions set family_id='10000000-0000-4000-8000-000000009402' where store_key='tag'$$,'P0001','account_mismatch','entitlement transfer is not possible by plain update (operator transfer not implemented)');
-- Lifecycle state machine: purchase → renew → upgrade → downgrade → restore → cancel → retry → grace → refund → resubscribe
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'free/free','family B starts free');
select is(public.apply_verified_store_state(pg_temp.state('life',1000,token=>'10000000-0000-4000-8000-000000009402',source=>'client_verify'),'10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402')->>'status','active','purchase');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/store','purchase grants plus');
select is(public.apply_verified_store_state(pg_temp.state('life',2000,expires=>now()+interval '60 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'status','active','renew');
select is((select expires_at>now()+interval '59 days' from public.store_subscriptions where store_key='life'),true,'renewal extends expiry');
select is(public.apply_verified_store_state(pg_temp.state('life',3000,product=>'gina_pro_monthly',expires=>now()+interval '60 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'plan','pro','upgrade (same original transaction, new product)');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'pro/store','upgrade grants pro immediately');
select is(public.apply_verified_store_state(pg_temp.state('life',4000,product=>'gina_pro_monthly',expires=>now()+interval '60 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification',auto_renew=>true))->>'plan','pro','downgrade scheduled: pro stays until period end');
select is(public.apply_verified_store_state(pg_temp.state('life',5000,product=>'gina_plus_monthly',expires=>now()+interval '90 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'plan','plus','downgrade takes effect at renewal');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/store','downgrade applied');
select is(public.apply_verified_store_state(pg_temp.state('life',5000,product=>'gina_plus_monthly',expires=>now()+interval '90 days',token=>'10000000-0000-4000-8000-000000009402',source=>'client_verify'),'10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402')->>'skipped','stale','restore replays the same signed state without change');
select is((select count(*)::int from public.store_subscriptions where family_id='10000000-0000-4000-8000-000000009402'),1,'restore does not duplicate');
select is(public.apply_verified_store_state(pg_temp.state('life',6000,product=>'gina_plus_monthly',expires=>now()+interval '90 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification',auto_renew=>false))->>'status','active','cancel = auto-renew off');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/store','cancel keeps access until expiry (cancel is not refund)');
select is((select auto_renewing from public.store_subscriptions where store_key='life'),false,'cancel recorded as auto_renewing=false');
select is(public.apply_verified_store_state(pg_temp.state('life',7000,status=>'on_hold',expires=>now()-interval '1 hour',token=>'10000000-0000-4000-8000-000000009402',source=>'notification',auto_renew=>true))->>'status','on_hold','billing retry after period end');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'free/free','billing retry without grace closes access');
select is(public.apply_verified_store_state(pg_temp.state('life',8000,status=>'grace',expires=>now()+interval '16 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'status','grace','grace period');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/store','grace keeps access');
select is(public.apply_verified_store_state(pg_temp.state('life',9000,status=>'active',expires=>now()+interval '30 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'status','active','recovered from grace');
select is(public.apply_verified_store_state(pg_temp.state('life',10000,status=>'revoked',expires=>now()+interval '30 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'status','revoked','refund');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'free/free','refund closes family access even before expiry');
select is(public.apply_verified_store_state(pg_temp.state('life',9500,status=>'active',expires=>now()+interval '30 days',token=>'10000000-0000-4000-8000-000000009402',source=>'notification'))->>'skipped','stale','late renewal cannot reopen refunded subscription');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'free/free','still free after late renewal');
select is(public.apply_verified_store_state(pg_temp.state('life2',100,token=>'10000000-0000-4000-8000-000000009402',source=>'client_verify'),'10000000-0000-4000-8000-000000009402','00000000-0000-4000-8000-000000009402')->>'status','active','resubscribe = new original transaction');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/store','resubscribe grants again');
select is(public.apply_verified_store_state(pg_temp.state('life2',200,status=>'expired',expires=>now()-interval '1 second',token=>'10000000-0000-4000-8000-000000009402',source=>'notification',auto_renew=>false))->>'status','expired','expiry');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'free/free','expired closes access');
-- Operator compensation is a different source from store state
insert into public.entitlement_overrides(family_id,plan,reason,granted_by,ends_at) values('10000000-0000-4000-8000-000000009402','plus','S03 synthetic compensation','00000000-0000-4000-8000-000000009403',now()+interval '7 days');
select is(pg_temp.plan('10000000-0000-4000-8000-000000009402'),'plus/comp','compensation is labelled comp, not store');
select is((select status::text from public.store_subscriptions where store_key='life'),'revoked','compensation does not rewrite the refunded store row');
-- Operator store check receipt --------------------------------------------------------------
select set_config('test.tag_sub',(select id::text from public.store_subscriptions where store_key='tag'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009403","role":"authenticated","gina":{"role":"none"}}',true);
select is(public.finance_request_reconcile('30000000-0000-4000-8000-000000009401','10000000-0000-4000-8000-000000009401',current_setting('test.tag_sub')::uuid,'Support asked for a store check')->>'result_kind','store_check','operator receipt is a store check');
select ok((select jsonb_path_exists(public.finance_workspace('',  '10000000-0000-4000-8000-000000009401'),'$.detail.subscriptions[*] ? (@.verification == "store_notified")')),'finance workspace exposes verification label');
select ok(position('"storeKey"' in public.finance_workspace('','10000000-0000-4000-8000-000000009401')::text)=0,'finance workspace still has no raw receipts');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('test.claim',public.claim_operator_reconcile('30000000-0000-4000-8000-000000009401')::text,true);
select is(public.finish_operator_reconcile('30000000-0000-4000-8000-000000009401',(current_setting('test.claim')::jsonb->>'token')::uuid,null,'no_data')->>'result_kind','store_check','finished receipt keeps store_check label');
reset role;
select is((select code from gina.store_reconcile_jobs where id='30000000-0000-4000-8000-000000009401'),'no_data','no store record is unchanged, not refund');
select is((select status from gina.store_reconcile_jobs where id='30000000-0000-4000-8000-000000009401'),'unchanged','store check without data never changes entitlement');
select * from finish();
rollback;
