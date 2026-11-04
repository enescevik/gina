begin;
select plan(5);
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='exams'),'new assignments emit exam metadata changes');
select ok((select relrowsecurity from pg_class where oid='public.exams'::regclass),'exam metadata remains RLS protected');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='exam_attempts'),'attempt status notifications retained');
select ok(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='exam_answers'),'answer bodies not added to broadcast publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_completions'),'task approval notifications retained');
select * from finish();
rollback;
