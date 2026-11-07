begin;
select plan(4);
select is((select value::text from public.app_settings where key='content_prereview.max_output_tokens'),'24000','review-specific output headroom');
select lives_ok($q$insert into public.ai_chains(id,name,attempt_seconds,total_seconds) values('b9000000-0000-4000-8000-000000000001','output budget test',120,130)$q$,'120-second attempt fits runtime total ceiling');
select throws_ok($q$insert into public.ai_chains(id,name,attempt_seconds,total_seconds) values('b9000000-0000-4000-8000-000000000002','too long',121,130)$q$,'23514',null,'step ceiling remains bounded');
select throws_ok($q$insert into public.ai_chains(id,name,attempt_seconds,total_seconds) values('b9000000-0000-4000-8000-000000000003','over total',120,110)$q$,'23514',null,'step cannot exceed total');
select * from finish();
rollback;
