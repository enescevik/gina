begin;
select no_plan();
-- H04: the product e-mail language follows the account language (user_metadata.locale, also read by the
-- Auth templates), then the newest push token with a supported locale, then Turkish.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000013401','loc-a@test.local',false,'{"locale":"en"}'),
 ('00000000-0000-4000-8000-000000013402','loc-b@test.local',false,'{}'),
 ('00000000-0000-4000-8000-000000013403','loc-c@test.local',false,'{"locale":"de"}'),
 ('00000000-0000-4000-8000-000000013404','loc-d@test.local',false,'{"locale":"tr"}'),
 ('00000000-0000-4000-8000-000000013405','loc-e@test.local',false,null);
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000013401','L','00000000-0000-4000-8000-000000013401');
insert into public.family_members(family_id,user_id) select '10000000-0000-4000-8000-000000013401',id from auth.users where email like 'loc-%@test.local';
-- a: metadata en, device tr → en; b: no metadata, device en → en; c: unsupported metadata, no device → tr (push_tokens.locale is already constrained to tr/en);
-- d: metadata tr, device en → tr; e: nothing → tr.
insert into public.push_tokens(user_id,family_id,role,platform,token,token_type,locale) values
 ('00000000-0000-4000-8000-000000013401','10000000-0000-4000-8000-000000013401','parent','ios','qa-loc-a','apns','tr'),
 ('00000000-0000-4000-8000-000000013402','10000000-0000-4000-8000-000000013401','parent','ios','qa-loc-b','apns','en'),
 ('00000000-0000-4000-8000-000000013404','10000000-0000-4000-8000-000000013401','parent','ios','qa-loc-d','apns','en');
insert into gina.contact_verifications(id,user_id,kind,value,token_hash,expires_at)
 select ('40000000-0000-4000-8000-0000000134'||right(u.id::text,2))::uuid,u.id,'email',replace(u.email,'test.local','example.invalid'),repeat('a',64),now()+interval '1 hour'
 from auth.users u where u.email like 'loc-%@test.local';
insert into gina.channel_outbox(user_id,channel,purpose,kind,payload,dedupe_key)
 select v.user_id,'email','service','contact_verification',jsonb_build_object('verification_id',v.id,'secret','H04CODE1','expires_at',v.expires_at),'h04-loc-'||right(v.user_id::text,2)
 from gina.contact_verifications v where v.value like 'loc-%@example.invalid';

create temp table claimed(v jsonb); grant all on claimed to service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into claimed select e from jsonb_array_elements(public.channel_claim(50)) e;
reset role;

create function pg_temp.locale_of(suffix text) returns text language sql as $$
 select c.v->>'locale' from claimed c join gina.channel_outbox o on o.id=(c.v->>'id')::bigint where o.dedupe_key='h04-loc-'||suffix$$;
select is((select count(*)::int from claimed),5,'all five verification mails are claimed');
select is(pg_temp.locale_of('01'),'en','account language wins over the device language');
select is(pg_temp.locale_of('02'),'en','without an account language the newest device language is used (C10 behaviour kept)');
select is(pg_temp.locale_of('03'),'tr','an unsupported account language is ignored and falls back to Turkish');
select is(pg_temp.locale_of('04'),'tr','account Turkish wins over an English device');
select is(pg_temp.locale_of('05'),'tr','no language anywhere is Turkish');
select is((select count(*)::int from claimed where v->>'recipient' like 'loc-%@example.invalid'),5,'recipient still resolved from the verification');

-- Grants unchanged: worker only.
select ok(not has_function_privilege('anon','public.channel_claim(int)','execute'),'anon cannot claim');
select ok(not has_function_privilege('authenticated','public.channel_claim(int)','execute'),'authenticated cannot claim');
select ok(has_function_privilege('service_role','public.channel_claim(int)','execute'),'service_role claims');

-- Runbook (docs/release/h04-2026-11-06 §c): one announcement e-mail to exactly one opted-in parent, without the
-- publish fan-out. Same SQL as the runbook with <USER>/<FAMILY> filled in.
insert into gina.contact_channels(user_id,kind,value) values('00000000-0000-4000-8000-000000013401','email','loc-a@example.invalid');
insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values('00000000-0000-4000-8000-000000013401','email','announcement',true,'user');
insert into auth.sessions(id,user_id) values(gen_random_uuid(),'00000000-0000-4000-8000-000000013401');
with i as (
  insert into gina.parent_inbox(user_id,family_id,event_key,kind,title,body,expires_on)
  values('00000000-0000-4000-8000-000000013401','10000000-0000-4000-8000-000000013401','h04-acceptance:2026-11-06','announcement','GINA e-posta kanal testi',
         'Bu ileti yalnız kabul testi içindir; başka veliye gönderilmedi.',current_date+2)
  returning id)
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key)
select '00000000-0000-4000-8000-000000013401','10000000-0000-4000-8000-000000013401','email','announcement','parent_announcement',jsonb_build_object('inbox_id',i.id::text),'h04-acceptance:2026-11-06:email' from i;
select is((select count(*)::int from public.push_outbox),0,'runbook insert queues no push');
select throws_ok($$insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key) values('00000000-0000-4000-8000-000000013401','10000000-0000-4000-8000-000000013401','email','announcement','parent_announcement','{}','h04-acceptance:2026-11-06:email')$$,'23505',null,'re-running the runbook insert cannot queue a second copy');
delete from claimed;
set local role service_role;
insert into claimed select e from jsonb_array_elements(public.channel_claim(50)) e;
reset role;
select is((select count(*)::int from claimed),1,'exactly one row claimed');
select is((select v->>'recipient' from claimed),'loc-a@example.invalid','to the verified address of that parent');
select is((select v->'announcement'->>'title' from claimed),'GINA e-posta kanal testi','with the inbox copy');
select ok((select v->>'unsubscribe_token' from claimed) ~ '^[A-Za-z0-9_-]+\.[a-f0-9]{40}$','with a signed unsubscribe token');
select is((select v->>'locale' from claimed),'en','in the account language');
-- Opening the inbox item first makes the mail stale (runbook warning).
update gina.parent_inbox set read_at=now() where event_key='h04-acceptance:2026-11-06';
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key)
select user_id,family_id,'email','announcement','parent_announcement',jsonb_build_object('inbox_id',id::text),'h04-acceptance:2026-11-06:email-2' from gina.parent_inbox where event_key='h04-acceptance:2026-11-06';
set local role service_role;
select is(jsonb_array_length(public.channel_claim(50)),0,'a read inbox item is not mailed');
reset role;
select is((select skip_reason from gina.channel_outbox where dedupe_key='h04-acceptance:2026-11-06:email-2'),'announcement_not_current','skip reason recorded');

-- Heartbeat: a selected provider keeps its readiness report fresh even without due work.
delete from gina.channel_provider_status;
update public.app_settings set value='null' where key in('channels.email.provider','channels.sms.provider');
select ok(not gina.channel_heartbeat_due(),'no provider selected: the tick does not wake the worker');
update public.app_settings set value='"smtp"' where key='channels.email.provider';
select ok(gina.channel_heartbeat_due(),'provider selected and never reported: wake the worker');
select public.channel_report_provider_status('email','smtp',true,'{}');
select ok(not gina.channel_heartbeat_due(),'fresh report: no extra wake-up');
update gina.channel_provider_status set reported_at=now()-interval '13 hours' where channel='email';
select ok(gina.channel_heartbeat_due(),'report older than 12 h: wake the worker before readiness expires at 24 h');
select ok(not has_function_privilege('anon','gina.channel_heartbeat_due()','execute') and not has_function_privilege('authenticated','gina.channel_heartbeat_due()','execute') and not has_function_privilege('service_role','gina.channel_heartbeat_due()','execute'),'heartbeat helper is private');
select ok(not has_function_privilege('anon','gina.kick_push_send()','execute') and not has_function_privilege('authenticated','gina.kick_push_send()','execute'),'kick stays private');
select ok(pg_get_functiondef('gina.kick_push_send()'::regprocedure) ~ 'channel_heartbeat_due','the one-minute tick checks the heartbeat');
select * from finish();
rollback;
