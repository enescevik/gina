begin;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000005001','finance@test.invalid'),
 ('00000000-0000-4000-8000-000000005002','support@test.invalid'),
 ('00000000-0000-4000-8000-000000005003','parent@test.invalid'),
 ('00000000-0000-4000-8000-000000005004','admin@test.invalid');
insert into public.operations_members(user_id,role,expires_at) values
 ('00000000-0000-4000-8000-000000005001','finance',now()+interval '1 day'),
 ('00000000-0000-4000-8000-000000005002','support',now()+interval '1 day');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000005004');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000005001','Finans Ailesi','00000000-0000-4000-8000-000000005003');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000005001','00000000-0000-4000-8000-000000005003');
insert into public.store_subscriptions(family_id,platform,product_id,plan,store_key,status,expires_at,raw) values
 ('10000000-0000-4000-8000-000000005001','apple','gina_plus_monthly','plus','PRIVATE_STORE_TOKEN','active',now()+interval '3 days','{"private_receipt":"PRIVATE_RECEIPT"}');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
 ('10000000-0000-4000-8000-000000005001','pro','Test support allowance',now()+interval '2 days');
insert into public.store_notifications(platform,event_key,event_type,store_key,payload,error) values
 ('apple','PRIVATE_EVENT_UUID','DID_RENEW','PRIVATE_STORE_TOKEN','{"private_receipt":"PRIVATE_NOTIFICATION"}','PRIVATE_PROVIDER_ERROR'),
 ('google','PRIVATE_UNMAPPED_ID','subscription:2',null,'{"purchaseToken":"PRIVATE_TOKEN"}','family_not_found');
select ok(not has_function_privilege('anon','public.finance_workspace(text,uuid)','execute'),'anonymous cannot read finance');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005003","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005001","role":"parent"}}',true);
select throws_ok($$select public.finance_workspace()$$,'42501','forbidden','parent cannot access finance workspace');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005002","role":"authenticated","gina":{"role":"none"}}',true);
select throws_ok($$select public.finance_workspace()$$,'42501','forbidden','support role alone cannot read finance');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005001","role":"authenticated","gina":{"role":"none"}}',true);
select is(jsonb_array_length(public.finance_workspace('Finans')->'families'),1,'finance can search family by name');
select is(jsonb_array_length(public.finance_workspace('%')->'families'),0,'search wildcard treated as literal');
select is(public.finance_workspace('', '10000000-0000-4000-8000-000000005001')#>>'{detail,effective,plan}','pro','effective plan includes real higher temporary entitlement');
select is(public.finance_workspace('', '10000000-0000-4000-8000-000000005001')#>>'{detail,effective,source}','comp','temporary right distinct from store purchase');
select is(public.finance_workspace('', '10000000-0000-4000-8000-000000005001')#>>'{detail,subscriptions,0,plan}','plus','actual store plan shown separately');
select is(jsonb_array_length(public.finance_workspace('', '10000000-0000-4000-8000-000000005001')->'notifications'),1,'family filter excludes unlinked notification');
select is(jsonb_array_length(public.finance_workspace()->'notifications'),2,'general queue includes unmatched notification');
select ok(position('PRIVATE' in public.finance_workspace('', '10000000-0000-4000-8000-000000005001')::text)=0,'no raw receipt, event UUID, purchase token, provider error or private payload leaked');
select is(public.finance_workspace('', '10000000-0000-4000-8000-000000005001')#>>'{notifications,0,error_code}','processing_failed','raw provider error redacted');
select is(public.finance_workspace()#>>'{summary,active_store_families}','1','store metric counts only real active store families');
select is(public.finance_workspace()#>>'{summary,active_overrides}','1','temporary rights counted separately');
select is((select count(*)::int from public.store_subscriptions),0,'finance role has no direct raw subscription read');
select is((select count(*)::int from public.store_notifications),0,'finance role has no direct raw notification read');
select throws_ok($$select public.finance_workspace(repeat('x',121))$$,'22023','invalid_input','search input bounded');
select throws_ok($$select public.finance_workspace('', '10000000-0000-4000-8000-000000005999')$$,'P0001','family_not_found','missing family is not a fabricated empty account');
reset role;
update public.operations_members set revoked_at=now() where user_id='00000000-0000-4000-8000-000000005001';
set local role authenticated;
select throws_ok($$select public.finance_workspace()$$,'42501','forbidden','revocation effective with same JWT');
reset role;
update public.operations_members set revoked_at=null,expires_at=now()-interval '1 second' where user_id='00000000-0000-4000-8000-000000005001';
set local role authenticated;
select throws_ok($$select public.finance_workspace()$$,'42501','forbidden','expired finance role denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005004","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select lives_ok($$select public.finance_workspace()$$,'live strict admin can open finance');
reset role;
delete from public.admins where user_id='00000000-0000-4000-8000-000000005004';
set local role authenticated;
select throws_ok($$select public.finance_workspace()$$,'42501','forbidden','stale admin claim denied');
select * from finish();rollback;
