begin;
select plan(16);
insert into auth.users (id, email, is_anonymous) values
 ('00000000-0000-0000-0000-000000001501', 'owner@lifecycle.test', false),
 ('00000000-0000-0000-0000-000000001502', 'guardian@lifecycle.test', false),
 ('00000000-0000-0000-0000-000000001503', 'other@lifecycle.test', false),
 ('00000000-0000-0000-0000-000000001504', null, true),
 ('00000000-0000-0000-0000-000000001505', 'no-family@lifecycle.test', false);
insert into public.families (id, name, created_by) values
 ('10000000-0000-0000-0000-000000001501','A','00000000-0000-0000-0000-000000001501'),
 ('10000000-0000-0000-0000-000000001503','B','00000000-0000-0000-0000-000000001503');
insert into public.family_members (family_id, user_id) values
 ('10000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001501'),
 ('10000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001502'),
 ('10000000-0000-0000-0000-000000001503','00000000-0000-0000-0000-000000001503');
insert into public.children (id, family_id, name) values
 ('20000000-0000-0000-0000-000000001501','10000000-0000-0000-0000-000000001501','Child');
insert into public.devices (family_id, auth_user_id, active_child_id) values
 ('10000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001504','20000000-0000-0000-0000-000000001501');
insert into public.notes (family_id, author_user_id, body, visibility) values
 ('10000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001501','private text','private'),
 ('10000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001501','family text','family');
insert into public.admins(user_id) values ('00000000-0000-0000-0000-000000001501');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-0000-0000-000000001501","admin":true}}',true);
select ok(gina.is_parent(), 'live member accepted');
select ok(gina.is_admin(), 'live admin accepted');
delete from public.admins where user_id='00000000-0000-0000-0000-000000001501';
select ok(not gina.is_admin(), 'removed admin rejected with stale JWT');
-- Auth deletion normally runs as Auth's service connection without an end-user actor claim.
select set_config('request.jwt.claims','{}',true);
select lives_ok($$delete from auth.users where id='00000000-0000-0000-0000-000000001501'$$,'owner deletion succeeds despite notes author CHECK');
select is((select created_by::text from public.families where id='10000000-0000-0000-0000-000000001501'),'00000000-0000-0000-0000-000000001502','ownership transfers to remaining adult');
select is((select count(*)::int from public.notes where family_id='10000000-0000-0000-0000-000000001501'),0,'deleted author notes removed');
select is((select count(*)::int from public.children where family_id='10000000-0000-0000-0000-000000001501'),1,'shared child retained for remaining parent');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-0000-0000-000000001501","admin":true}}',true);
set local role authenticated;
select is((select count(*)::int from public.children),0,'deleted parent cannot read with stale JWT');
select throws_ok($$select public.set_parent_pin('1234')$$,'42501',null,'deleted parent cannot mutate with stale JWT');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000001504","role":"authenticated","gina":{"role":"device","family_id":"10000000-0000-0000-0000-000000001501","child_id":"20000000-0000-0000-0000-000000001501"}}',true);
select ok(gina.is_device(),'current device child accepted');
update public.devices set active_child_id=null where auth_user_id='00000000-0000-0000-0000-000000001504';
select ok(not gina.is_device(),'old child JWT rejected after device logout');
select set_config('request.jwt.claims','{}',true);
select lives_ok($$delete from auth.users where id='00000000-0000-0000-0000-000000001502'$$,'last parent deletion succeeds');
select is((select count(*)::int from public.families where id='10000000-0000-0000-0000-000000001501'),0,'last parent family deleted');
select is((select count(*)::int from auth.users where id='00000000-0000-0000-0000-000000001504'),0,'paired anonymous Auth account deleted');
select is((select count(*)::int from public.families where id='10000000-0000-0000-0000-000000001503'),1,'unrelated family untouched');
select lives_ok($$delete from auth.users where id='00000000-0000-0000-0000-000000001505'$$,'account without family can be deleted');
select * from finish();
rollback;
