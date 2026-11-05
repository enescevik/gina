begin;
select plan(2);
select ok(has_table_privilege('service_role','public.ai_operation_policies','select'), 'Timetable Edge can read its policy in a clean project');
select ok(not has_table_privilege('anon','public.ai_operation_policies','select'), 'Anonymous requests gain no policy access');
select * from finish();
rollback;
