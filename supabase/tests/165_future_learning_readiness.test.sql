begin;select plan(2);
set local role anon;
select throws_ok('select public.future_learning_ready()','42501',null,'anonymous schema capability denied');
reset role;set local role authenticated;
select ok(public.future_learning_ready(),'coordinated schema declares readiness to signed in clients');
reset role;select * from finish();rollback;
