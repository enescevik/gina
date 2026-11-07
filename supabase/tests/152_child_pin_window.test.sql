begin;
select no_plan();
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
('a1450000-0000-4000-8000-000000000001','f1-a@example.invalid',false,'{}'),
('a1450000-0000-4000-8000-000000000002','f1-b@example.invalid',false,'{}');
insert into public.families(id,name,created_by) values
('b1450000-0000-4000-8000-000000000001','A','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','B','a1450000-0000-4000-8000-000000000002');
insert into public.family_members(family_id,user_id) values
('b1450000-0000-4000-8000-000000000001','a1450000-0000-4000-8000-000000000001'),
('b1450000-0000-4000-8000-000000000002','a1450000-0000-4000-8000-000000000002');

insert into public.children(id,family_id,name,grade) values('c1520000-0000-4000-8000-000000000001','b1450000-0000-4000-8000-000000000001','PIN test',3);
insert into public.child_pins(child_id,pin_hash) values('c1520000-0000-4000-8000-000000000001',extensions.crypt('1234',extensions.gen_salt('bf')));
select set_config('request.jwt.claims','{"sub":"a1450000-0000-4000-8000-000000000001","role":"authenticated","gina":{"family_id":"b1450000-0000-4000-8000-000000000001","role":"parent"}}',true);
set local role authenticated;
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','0000'),false,'wrong PIN false');
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','0000'),false,'second failure');
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','0000'),false,'third failure');
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','0000'),false,'fourth failure');
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','0000'),false,'fifth failure persists');
select throws_ok($$select public.verify_child_pin('c1520000-0000-4000-8000-000000000001','1234')$$,'P0001','pin_locked','correct PIN cannot bypass active lock');
reset role;
select is((select failed_count::int from public.child_pins where child_id='c1520000-0000-4000-8000-000000000001'),5,'persisted counter reaches cap');
update public.child_pins set locked_until=now()-interval '1 second' where child_id='c1520000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.verify_child_pin('c1520000-0000-4000-8000-000000000001',repeat('9',1000)),false,'invalid format counted without hashing unbounded input');
reset role;
select is((select failed_count::int from public.child_pins where child_id='c1520000-0000-4000-8000-000000000001'),1,'expired window restarts at one');
select ok((select locked_until is null from public.child_pins where child_id='c1520000-0000-4000-8000-000000000001'),'expired window is not immediately relocked');
set local role authenticated;
select ok(public.verify_child_pin('c1520000-0000-4000-8000-000000000001','1234'),'valid PIN recovers');
reset role;
select is((select failed_count::int from public.child_pins where child_id='c1520000-0000-4000-8000-000000000001'),0,'success resets counter');
select set_config('request.jwt.claims','{"sub":"a1450000-0000-4000-8000-000000000002","role":"authenticated","gina":{"family_id":"b1450000-0000-4000-8000-000000000002","role":"parent"}}',true);set local role authenticated;
select throws_ok($$select public.verify_child_pin('c1520000-0000-4000-8000-000000000001','1234')$$,'P0001','child_not_found','foreign family cannot test PIN');
reset role;select * from finish();rollback;
