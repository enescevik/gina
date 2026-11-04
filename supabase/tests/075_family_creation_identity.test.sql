begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
('00000000-0000-4000-8000-000000007501',null,true),
('00000000-0000-4000-8000-000000007502','parent@test.local',false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000007501","role":"authenticated","is_anonymous":true}',true);
select throws_ok($$select public.create_family('Test family')$$,'42501','parent_account_required','anonymous session cannot create family');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000007501","role":"authenticated"}',true);
select throws_ok($$select public.create_family('Test family')$$,'42501','parent_account_required','database identity protects against absent anonymous claim');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000007502","role":"authenticated","is_anonymous":false}',true);
select throws_ok($$select public.create_family('   ')$$,'P0001','invalid_input','blank family name denied');
select lives_ok($$select public.create_family('Test family')$$,'registered parent can create family');
select throws_ok($$select public.create_family('Second family')$$,'P0001','already_member','repeated creation cannot duplicate family');
reset role;
select is((select count(*)::int from public.family_members where user_id='00000000-0000-4000-8000-000000007501'),0,'anonymous user acquired no parent membership');
select * from finish();rollback;
