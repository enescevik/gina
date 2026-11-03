begin;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000004901','store-a@test.invalid'),
 ('00000000-0000-4000-8000-000000004902','store-b@test.invalid');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000004901','Store A','00000000-0000-4000-8000-000000004901'),
 ('10000000-0000-4000-8000-000000004902','Store B','00000000-0000-4000-8000-000000004902');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000004901','00000000-0000-4000-8000-000000004901'),
 ('10000000-0000-4000-8000-000000004902','00000000-0000-4000-8000-000000004902');
create function pg_temp.state(k text, version int default 100, platform text default 'apple', status text default 'active', token text default '10000000-0000-4000-8000-000000004901') returns jsonb language sql as $$
 select jsonb_build_object('platform',platform,'storeKey',k,'productId','gina_plus_monthly','status',status,
   'expiresAt','2027-01-01T00:00:00Z','autoRenewing',true,'version',version,'accountToken',token,'raw',jsonb_build_object('version',999999));
$$;
-- Tests
select ok(not has_function_privilege('authenticated','public.apply_verified_store_state(jsonb,uuid,uuid)','execute'),'client/admin cannot apply verified store state');
select ok(not has_function_privilege('anon','public.apply_verified_store_state(jsonb,uuid,uuid)','execute'),'anonymous cannot apply store state');
select ok(has_function_privilege('service_role','public.apply_verified_store_state(jsonb,uuid,uuid)','execute'),'service can apply verified store state');
set local role service_role;
select is(public.apply_verified_store_state(pg_temp.state('original'))->>'plan','plus','verified product maps to plan');
select is((select raw->>'version' from public.store_subscriptions where store_key='original'),'100','trusted version overrides raw body');
select is(public.apply_verified_store_state(pg_temp.state('original',200,'apple','revoked'))->>'status','revoked','new revocation applied');
select is(public.apply_verified_store_state(pg_temp.state('original',150))->>'skipped','stale','late earlier event skipped');
select is((select status::text from public.store_subscriptions where store_key='original'),'revoked','late event cannot reopen revoked subscription');
select is(public.apply_verified_store_state(pg_temp.state('original',200))->>'skipped','stale','same revision cannot replace richer stored result');
select is((select count(*)::int from public.store_subscriptions where store_key='original'),1,'replays do not duplicate subscription');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('original',300,'apple','active','10000000-0000-4000-8000-000000004902'))$$,'P0001','account_mismatch','signed token cannot move existing family');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('original',300,'google'))$$,'P0001','account_mismatch','platform collision cannot move subscription');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('new-forged'), '10000000-0000-4000-8000-000000004902','00000000-0000-4000-8000-000000004902')$$,'P0001','account_mismatch','caller cannot override signed family');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('no-family',100,'apple','active',null))$$,'P0001','family_not_found','unmapped notification waits for verification');
select is(public.apply_verified_store_state(pg_temp.state('legacy-restore',100,'apple','active',null),'10000000-0000-4000-8000-000000004901','00000000-0000-4000-8000-000000004901')->>'familyId','10000000-0000-4000-8000-000000004901','live parent can claim an unlinked legacy receipt');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('legacy-restore',200,'apple','active',null),'10000000-0000-4000-8000-000000004902','00000000-0000-4000-8000-000000004902')$$,'P0001','account_mismatch','restore cannot move claimed legacy receipt');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('invalid-member'), '10000000-0000-4000-8000-000000004901','00000000-0000-4000-8000-000000004902')$$,'42501','forbidden','live membership required at save');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('unknown')||'{"productId":"unknown"}')$$,'P0001','unknown_product','unknown product cannot grant access');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('invalid-version')-'version')$$,'22023','invalid_store_state','unversioned snapshot rejected');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('invalid-version')||'{"version":-1}')$$,'22023','invalid_store_state','negative version rejected');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('invalid-raw')||'{"raw":[]}')$$,'22023','invalid_store_state','raw must be an object');
select throws_ok($$update public.store_subscriptions set family_id='10000000-0000-4000-8000-000000004902' where store_key='original'$$,'P0001','account_mismatch','rolling old writer cannot reassign family');
select throws_ok($$update public.store_subscriptions set raw='{"version":50}' where store_key='original'$$,'P0001','stale_store_state','rolling old writer cannot overwrite newer revision');
select throws_ok($$update public.store_subscriptions set raw='{"version":null}' where store_key='original'$$,'P0001','stale_store_state','rolling unversioned writer cannot overwrite new revision');
select is(public.apply_verified_store_state(pg_temp.state('google-old',100,'google'))->>'status','active','old Google token established');
select is(public.apply_verified_store_state(pg_temp.state('google-new',200,'google')||'{"replacesStoreKey":"google-old","productId":"gina_pro_monthly"}')->>'plan','pro','upgrade grants new plan');
select is((select status::text from public.store_subscriptions where store_key='google-old'),'expired','upgrade expires old token in same transaction');
select is(public.apply_verified_store_state(pg_temp.state('google-old',999,'google'))->>'skipped','replaced','even a later old-token fetch cannot restore old entitlement');
select is((select count(*)::int from gina.store_replacements where old_store_key='google-old'),1,'replacement tombstone retained');
select is(public.apply_verified_store_state(pg_temp.state('google-before-old',300,'google')||'{"replacesStoreKey":"not-yet-seen"}')->>'status','active','replacement can precede old token arrival');
select is(public.apply_verified_store_state(pg_temp.state('not-yet-seen',400,'google'))->>'skipped','replaced','late first old token is suppressed');
select is((select count(*)::int from public.store_subscriptions where store_key='not-yet-seen'),0,'late first old token does not create a row');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('foreign-upgrade',500,'google','active','10000000-0000-4000-8000-000000004902')||'{"replacesStoreKey":"google-new"}')$$,'P0001','account_mismatch','linked token cannot cross family');
select is((select count(*)::int from public.store_subscriptions where store_key='foreign-upgrade'),0,'rejected replacement leaves no partial new subscription');
select is((select status::text from public.store_subscriptions where store_key='google-new'),'active','rejected replacement preserves old entitlement');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('self',400,'google')||'{"replacesStoreKey":"self"}')$$,'22023','invalid_store_state','self replacement rejected');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('fork',500,'google')||'{"replacesStoreKey":"google-old"}')$$,'P0001','account_mismatch','two successors cannot silently fork same old token');
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('apple-link',400)||'{"replacesStoreKey":"google-new"}')$$,'22023','invalid_store_state','Apple cannot use Google replacement linkage');
select is(public.apply_verified_store_state(pg_temp.state('google-final',600,'google','active',null)||'{"replacesStoreKey":"google-new"}')->>'familyId','10000000-0000-4000-8000-000000004901','verified Google linkage resolves existing family');
select public.apply_verified_store_state(pg_temp.state('rollback-old',100,'google'));
create function pg_temp.block_expiry() returns trigger language plpgsql as $$begin
 if new.store_key='rollback-old' and new.status='expired' then raise exception 'simulated_expiry_failure'; end if;
 return new; end;$$;
reset role;
create trigger test_block_expiry before update on public.store_subscriptions for each row execute function pg_temp.block_expiry();
set local role service_role;
select throws_ok($$select public.apply_verified_store_state(pg_temp.state('rollback-new',200,'google')||'{"replacesStoreKey":"rollback-old"}')$$,'P0001','simulated_expiry_failure','old-token failure rolls whole replacement back');
select is((select count(*)::int from public.store_subscriptions where store_key='rollback-new'),0,'failed replacement creates no partial subscription');
select is((select count(*)::int from gina.store_replacements where old_store_key='rollback-old'),0,'failed replacement creates no tombstone');
select is((select status::text from public.store_subscriptions where store_key='rollback-old'),'active','failed replacement preserves original access');
select * from finish();
rollback;
