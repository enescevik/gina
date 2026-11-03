begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'operator-'||n||'@test.local',false from generate_series(3801,3804)n;
insert into public.families(id,name,created_by) values('00000000-0000-4000-8000-000000003810','Queue fixture','00000000-0000-4000-8000-000000003801');
insert into public.family_members(family_id,user_id) values('00000000-0000-4000-8000-000000003810','00000000-0000-4000-8000-000000003801');
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000003802','support',now()+interval '1 day'),('00000000-0000-4000-8000-000000003803','content',now()+interval '1 day');
insert into public.help_tickets(id,family_id,kind,category,subject,status,updated_at)
 select ('00000000-0000-4000-8000-'||lpad((3900+n)::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000003810','support',case when n=61 then 'device' else 'learning' end,'Queue example '||n,'open','2026-11-03T00:00:00Z'::timestamptz from generate_series(1,61)n;
insert into public.help_tickets(id,family_id,kind,category,subject,status) values
 ('00000000-0000-4000-8000-000000003970','00000000-0000-4000-8000-000000003810','idea','learning','Idea example','open'),
 ('00000000-0000-4000-8000-000000003971','00000000-0000-4000-8000-000000003810','support','account','Resolved example','resolved'),
 ('00000000-0000-4000-8000-000000003972','00000000-0000-4000-8000-000000003810','support','account','Closed example','closed');
create function pg_temp.login(n int,r text default 'none') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','gina',jsonb_build_object('role',r,'family_id','00000000-0000-4000-8000-000000003810','admin',false))::text,true)::void;
$$;
set local role authenticated;
select pg_temp.login(3801,'parent');
select throws_ok($$select public.list_operator_help_tickets()$$,'42501','forbidden','parent cannot read global support queue');
select pg_temp.login(3803);
select throws_ok($$select public.list_operator_help_tickets()$$,'42501','forbidden','content role cannot read private support queue');
select pg_temp.login(3802);
select is(jsonb_array_length(public.list_operator_help_tickets()),50,'first page bounded to 50');
select is(jsonb_array_length(public.list_operator_help_tickets(p_category=>'device')),1,'category applied before pagination; finds ticket beyond first 50');
select is(public.list_operator_help_tickets(p_category=>'device')->0->>'subject','Queue example 61','correct distant ticket returned');
select is(jsonb_array_length(public.list_operator_help_tickets(p_kind=>'idea')),1,'idea queue isolated');
select is(jsonb_array_length(public.list_operator_help_tickets(p_status=>'completed')),2,'completed includes closed and resolved');
select is(jsonb_array_length(public.list_operator_help_tickets(p_status=>'all',p_category=>'account')),2,'all status does not default to open');
select is(jsonb_array_length(public.list_operator_help_tickets(p_before_time=>'2026-11-03T00:00:00Z',p_before_id=>'00000000-0000-4000-8000-000000003950')),11,'timestamp ties paginate by id without overlap');
select is(public.list_operator_help_tickets(p_before_time=>'2026-11-03T00:00:00Z',p_before_id=>'00000000-0000-4000-8000-000000003950')->0->>'id','00000000-0000-4000-8000-000000003951','next page starts after cursor');
select throws_ok($$select public.list_operator_help_tickets(p_category=>'invented')$$,'P0001','invalid_input','invalid category rejected');
select throws_ok($$select public.list_operator_help_tickets(p_status=>'invented')$$,'P0001','invalid_input','invalid status rejected');
select throws_ok($$select public.list_operator_help_tickets(p_before_time=>now())$$,'P0001','invalid_input','partial cursor rejected');
select ok(not (public.list_operator_help_tickets()->0 ? 'family_id'),'queue omits family identifier');
select ok(not (public.list_operator_help_tickets()->0 ? 'created_by'),'queue omits parent identifier');
reset role;
update public.operations_members set expires_at=now()-interval '1 second' where user_id='00000000-0000-4000-8000-000000003802';
set local role authenticated;
select pg_temp.login(3802);
select throws_ok($$select public.list_operator_help_tickets()$$,'42501','forbidden','expiry effective without JWT refresh');
select is(public.my_operation_roles(),'[]'::jsonb,'live role report reflects expiry');
reset role;
update public.operations_members set expires_at=now()+interval '1 day',revoked_at=now() where user_id='00000000-0000-4000-8000-000000003802';
set local role authenticated;
select throws_ok($$select public.list_operator_help_tickets()$$,'42501','forbidden','revocation effective without JWT refresh');
select * from finish();rollback;
