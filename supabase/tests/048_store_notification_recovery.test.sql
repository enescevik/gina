begin;
select no_plan();
select ok(not has_function_privilege('anon','public.claim_store_notification(public.store_platform,text,text,jsonb)','execute'),'anonymous cannot claim');
select ok(not has_function_privilege('authenticated','public.claim_store_notification(public.store_platform,text,text,jsonb)','execute'),'parent/admin cannot claim');
select ok(not has_function_privilege('authenticated','public.finish_store_notification(public.store_platform,text,uuid,text,text)','execute'),'parent/admin cannot finish');
select ok(has_function_privilege('service_role','public.claim_store_notification(public.store_platform,text,text,jsonb)','execute'),'service can claim');
create temp table state(name text primary key, value jsonb); grant all on state to service_role;
set local role service_role;
select throws_ok($$select public.claim_store_notification('apple','bad',null,'{"verified":false}')$$,'22023','invalid_verified_notification','cannot log unverified event');
insert into state values('first',public.claim_store_notification('apple','same-id','TEST','{"verified":true}'));
select is((select value->>'status' from state where name='first'),'claimed','first delivery claimed');
select is(public.claim_store_notification('apple','same-id','TEST','{"verified":true}')->>'status','busy','in-flight retry not acknowledged');
select is(public.claim_store_notification('google','same-id','test','{"verified":true}')->>'status','claimed','platforms do not collide');
select is(public.finish_store_notification('apple','same-id',gen_random_uuid()),false,'wrong worker cannot finish');
select is(public.finish_store_notification('apple','same-id',(select (value->>'token')::uuid from state where name='first'),null,'original-id'),true,'owner records success');
select is(public.claim_store_notification('apple','same-id','TEST','{"verified":true}')->>'status','done','completed event dedupes');
select is((select store_key from public.store_notifications where platform='apple' and event_key='same-id'),'original-id','store mapping saved with completion');
select is((select attempts from public.store_notifications where platform='apple' and event_key='same-id'),1,'busy and done do not add attempts');
insert into state values('retry',public.claim_store_notification('apple','retry',null,'{"verified":true}'));
select is(public.finish_store_notification('apple','retry',(select (value->>'token')::uuid from state where name='retry'),'processing_failed'),true,'failure releases lease');
select ok((select processed_at is null and error='processing_failed' from public.store_notifications where event_key='retry'),'error is visibly unprocessed');
select is(public.claim_store_notification('apple','retry',null,'{"verified":true}')->>'status','claimed','failure is retryable');
-- Simulate runtime death and lease expiry, without sleeping or changing family data.
insert into state values('crash',public.claim_store_notification('apple','crash',null,'{"verified":true}'));
update public.store_notifications set lease_until=clock_timestamp()-interval '1 second' where event_key='crash';
select is(public.finish_store_notification('apple','crash',(select (value->>'token')::uuid from state where name='crash')),false,'expired worker cannot mark complete');
insert into state values('reclaimed',public.claim_store_notification('apple','crash',null,'{"verified":true}'));
select is((select value->>'status' from state where name='reclaimed'),'claimed','crashed delivery reclaimed');
select isnt((select value->>'token' from state where name='crash'),(select value->>'token' from state where name='reclaimed'),'new worker has new fencing token');
select is(public.finish_store_notification('apple','crash',(select (value->>'token')::uuid from state where name='crash')),false,'old worker cannot release new lease');
select is(public.finish_store_notification('apple','crash',(select (value->>'token')::uuid from state where name='reclaimed')),true,'new owner completes');
-- Legacy rows: preserve trusted completions, recover interrupted/error/unverified records.
insert into public.store_notifications(platform,event_key,payload,processed_at,error) values
 ('apple','legacy-done','{"verified":true}',now(),null),
 ('apple','legacy-crash','{"verified":true}',null,null),
 ('apple','legacy-error','{"verified":true}',now(),'family_not_found'),
 ('apple','legacy-poison','{"verified":false}',now(),'invalid_jws'),
 ('google','legacy-unauth','{"verified":false}',now(),null);
select is(public.claim_store_notification('apple','legacy-done',null,'{"verified":true}')->>'status','done','legacy genuine completed receipt preserved');
select is(public.claim_store_notification('apple','legacy-crash',null,'{"verified":true}')->>'status','claimed','legacy interrupted event retried');
select is(public.claim_store_notification('apple','legacy-error',null,'{"verified":true}')->>'status','claimed','legacy failed event retried');
select is(public.claim_store_notification('apple','legacy-poison',null,'{"verified":true}')->>'status','claimed','unverified UUID cannot poison genuine event');
select is(public.claim_store_notification('google','legacy-unauth',null,'{"verified":true}')->>'status','claimed','unauthenticated old receipt does not suppress authentic delivery');
select * from finish();
rollback;
