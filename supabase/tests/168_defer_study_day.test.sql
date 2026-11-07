begin;
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003601','progress-3601@test.local');
insert into public.families(id,name,created_by,timezone) values('00000000-0000-4000-8000-000000003611','Fixture','00000000-0000-4000-8000-000000003601','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003601');
insert into public.children(id,family_id,name,grade) values('00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','Fixture',5);
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003602','progress-3602@test.local');
insert into public.families(id,name,created_by,timezone) values('00000000-0000-4000-8000-000000003612','Fixture','00000000-0000-4000-8000-000000003602','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('00000000-0000-4000-8000-000000003612','00000000-0000-4000-8000-000000003602');
insert into public.children(id,family_id,name,grade) values('00000000-0000-4000-8000-000000003622','00000000-0000-4000-8000-000000003612','Fixture',5);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003701','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','multiple_choice','Q1','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{"curriculum_version":"v1"}');

insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status)
values('00000000-0000-4000-8000-000000003801','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Review','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid],'assigned');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at)
values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003801','submitted',now());
create function pg_temp.today() returns date language sql as $$select (now() at time zone 'Europe/Istanbul')::date$$;
create function pg_temp.child() returns uuid language sql as $$select '00000000-0000-4000-8000-000000003621'::uuid$$;
create function pg_temp.family() returns uuid language sql as $$select '00000000-0000-4000-8000-000000003611'::uuid$$;
insert into public.task_templates(id,family_id,child_id,title,starts_on,ends_on,requires_approval)
values
 ('00000000-0000-4000-8000-000000007001',pg_temp.family(),pg_temp.child(),'One-time',pg_temp.today(),pg_temp.today(),false),
 ('00000000-0000-4000-8000-000000007002',pg_temp.family(),pg_temp.child(),'Daily',pg_temp.today(),null,false),
 ('00000000-0000-4000-8000-000000007003',pg_temp.family(),pg_temp.child(),'Already done',pg_temp.today(),pg_temp.today(),false);
insert into public.events(id,family_id,child_id,title,type,starts_at,ends_at,visible_to_child)
values
 ('00000000-0000-4000-8000-000000007011',pg_temp.family(),pg_temp.child(),'Review 1','activity',now(),now()+interval '15 minutes',true),
 ('00000000-0000-4000-8000-000000007012',pg_temp.family(),pg_temp.child(),'Review 2','activity',now()+interval '2 days',now()+interval '2 days 15 minutes',true),
 ('00000000-0000-4000-8000-000000007013',pg_temp.family(),pg_temp.child(),'Other','activity',now(),now()+interval '15 minutes',true);
insert into gina.repeat_calendar_batches(id,attempt_id,family_id,child_id,question_ids,source_hash)
values('00000000-0000-4000-8000-000000007021','00000000-0000-4000-8000-000000003901',pg_temp.family(),pg_temp.child(),array['00000000-0000-4000-8000-000000003701'::uuid],'test');
insert into gina.repeat_calendar_items(batch_id,step,event_id)
values
 ('00000000-0000-4000-8000-000000007021',1,'00000000-0000-4000-8000-000000007011'),
 ('00000000-0000-4000-8000-000000007021',2,'00000000-0000-4000-8000-000000007012');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003601","role":"authenticated","gina":{"family_id":"00000000-0000-4000-8000-000000003611","role":"parent"}}',true);
select is((public.complete_task('00000000-0000-4000-8000-000000007003',pg_temp.today(),gen_random_uuid(),pg_temp.child())).status::text,'approved','fixture earned its original stars');
select is((select deferred from public.get_study_day_deferral(pg_temp.child())),false,'today initially available');
select results_eq('select task_count,repeat_count from public.defer_study_day(pg_temp.child(),pg_temp.today())','values (2,2)','unsubmitted tasks and repeat sequence move together');
select results_eq('select task_count,repeat_count from public.defer_study_day(pg_temp.child(),pg_temp.today())','values (2,2)','same day retry returns original counts');
select is(jsonb_array_length(public.plan_for_day(pg_temp.child(),pg_temp.today())->'routines'),1,'completed task stays on original date');
select is(jsonb_array_length(public.plan_for_day(pg_temp.child(),pg_temp.today()+1)->'routines'),2,'one-time task carries and daily routine remains singular');
select is(jsonb_array_length(public.plan_for_days(pg_temp.child(),pg_temp.today()+1,pg_temp.today()+1)->0->'routines'),2,'week contract sees the same tasks');
select throws_ok($$select public.complete_task('00000000-0000-4000-8000-000000007001',pg_temp.today(),gen_random_uuid(),pg_temp.child())$$,'P0001','task_deferred','stale client cannot submit on original date');
select is((select sum(delta)::int from public.star_events where child_id=pg_temp.child()),1,'deferral itself does not award stars');
select is((public.complete_task('00000000-0000-4000-8000-000000007001',pg_temp.today()+1,gen_random_uuid(),pg_temp.child())).due_date,pg_temp.today()+1,'existing completion entry accepts the carried one-time task');
select is((select (starts_at at time zone 'Europe/Istanbul')::date from public.events where title='Review 1'),pg_temp.today()+1,'today review moved exactly once');
select is((select (starts_at at time zone 'Europe/Istanbul')::date from public.events where title='Review 2'),pg_temp.today()+3,'following review retains spacing');
select is((select starts_at from public.events where title='Other'),now(),'ordinary calendar event unchanged');
select throws_ok('select public.defer_study_day(pg_temp.child(),pg_temp.today()+1)','P0001','study_day_changed','future date rejected');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003602","role":"authenticated","gina":{"family_id":"00000000-0000-4000-8000-000000003612","role":"parent"}}',true);
select throws_ok('select public.defer_study_day(pg_temp.child(),pg_temp.today())','42501','forbidden','foreign family cannot defer');
select throws_ok('select public.get_study_day_deferral(pg_temp.child())','42501','forbidden','foreign family cannot read receipt');
reset role;
select * from finish();
rollback;
