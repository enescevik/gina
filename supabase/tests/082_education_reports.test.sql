begin;
select no_plan();
update public.plans set prova_monthly_exams=null where code='free';
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003601','progress-3601@test.local');
insert into public.families(id,name,created_by,timezone) values('00000000-0000-4000-8000-000000003611','Fixture','00000000-0000-4000-8000-000000003601','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003601');
insert into public.children(id,family_id,name,grade) values('00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','Fixture',5);
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003602','progress-3602@test.local');
insert into public.families(id,name,created_by,timezone) values('00000000-0000-4000-8000-000000003612','Fixture','00000000-0000-4000-8000-000000003602','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('00000000-0000-4000-8000-000000003612','00000000-0000-4000-8000-000000003602');
insert into public.children(id,family_id,name,grade) values('00000000-0000-4000-8000-000000003622','00000000-0000-4000-8000-000000003612','Fixture',5);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003701','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','multiple_choice','Q1','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003702','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','multiple_choice','Q2','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003703','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','open_ended','Q3',null,null,'Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003704','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','open_ended','Q4',null,null,'Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003705','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','open_ended','Q5',null,null,'Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003706','00000000-0000-4000-8000-000000003611',6,'Matematik','Kesirler','multiple_choice','Q6','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{"curriculum_version":"v1"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003707','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','multiple_choice','Q7','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{"curriculum_version":"v2"}');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,provenance) values('00000000-0000-4000-8000-000000003708','00000000-0000-4000-8000-000000003611',5,'Matematik','Kesirler','multiple_choice','Q8','[ {"key":"A","text":"First"},{"key":"B","text":"Second"},{"key":"C","text":"Third"},{"key":"D","text":"Fourth"}]','A','Expected','{}');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('00000000-0000-4000-8000-000000003801','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Report fixture','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid,'00000000-0000-4000-8000-000000003702'::uuid,'00000000-0000-4000-8000-000000003703'::uuid,'00000000-0000-4000-8000-000000003704'::uuid,'00000000-0000-4000-8000-000000003705'::uuid,'00000000-0000-4000-8000-000000003706'::uuid,'00000000-0000-4000-8000-000000003707'::uuid,'00000000-0000-4000-8000-000000003708'::uuid],'assigned');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003801','submitted',now());
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('00000000-0000-4000-8000-000000003802','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Report fixture','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid],'assigned');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at) values('00000000-0000-4000-8000-000000003902','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003802','submitted',now()-interval '1 day');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('00000000-0000-4000-8000-000000003803','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Report fixture','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid],'assigned');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at) values('00000000-0000-4000-8000-000000003903','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003803','submitted',now()-interval '91 days');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('00000000-0000-4000-8000-000000003804','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Report fixture','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid],'assigned');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at) values('00000000-0000-4000-8000-000000003904','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003804','in_progress',null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003701','A',null,true,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003702','B',null,false,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003703',null,'My working',null,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003704',null,'My working',null,50);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003706','A',null,true,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003707','A',null,true,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,answer_text,is_correct,score) values('00000000-0000-4000-8000-000000003901','00000000-0000-4000-8000-000000003708','A',null,true,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,is_correct) values('00000000-0000-4000-8000-000000003902','00000000-0000-4000-8000-000000003701','A',true);

-- Legacy evidence above predates period management and must stay unknown.
insert into gina.child_education_periods(id,child_id,family_id,academic_year,grade,school,starts_on,ends_on,reason) values
 ('00000000-0000-4000-8000-000000008201','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611',2025,5,'Old school',current_date-400,current_date-100,'initial'),
 ('00000000-0000-4000-8000-000000008202','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611',2026,6,'New school',current_date-100,null,'new_year');
insert into public.grades(child_id,family_id,subject,score,graded_on)
select '00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','Matematik',80,current_date-200 from generate_series(1,52);
insert into public.grades(child_id,family_id,subject,score,graded_on) values
('00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','Fen',90,current_date),
('00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','Türkçe',70,current_date-500);
-- Seed two frozen exam contexts before attempts; one old-period exam submitted later.
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
('00000000-0000-4000-8000-000000008211','00000000-0000-4000-8000-000000003611','00000000-0000-4000-8000-000000003621','Old context','Matematik',5,array['00000000-0000-4000-8000-000000003701'::uuid],'assigned');
-- Fixture-only trigger bypass models an exam actually assigned in the previous year.
alter table public.exams disable trigger exams_education_context;
update public.exams set education_context=jsonb_build_object('period_id','00000000-0000-4000-8000-000000008201','academic_year',2025,'grade',5,'school','Old school','starts_on',current_date-400)
where id='00000000-0000-4000-8000-000000008211';
alter table public.exams enable trigger exams_education_context;
insert into public.exam_attempts(id,exam_id,child_id,family_id,status,finished_at) values
('00000000-0000-4000-8000-000000008221','00000000-0000-4000-8000-000000008211','00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000003611','submitted',now());
-- A changed current class/school must not relabel previous evidence.
update gina.child_education_periods set grade=7,school='Corrected school' where id='00000000-0000-4000-8000-000000008202';
update public.children set grade=7 where id='00000000-0000-4000-8000-000000003621';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003601","role":"authenticated","gina":{"family_id":"00000000-0000-4000-8000-000000003611","role":"parent"}}',true);
create function pg_temp.scoped(period text default 'all',days int default 0) returns jsonb language sql as $$select public.learning_progress_education('00000000-0000-4000-8000-000000003621',days,null,null,period)$$;
create function pg_temp.scores(period text default 'all') returns jsonb language sql as $$select public.list_school_grades('00000000-0000-4000-8000-000000003621',period)$$;
select is(jsonb_array_length(public.education_report_periods('00000000-0000-4000-8000-000000003621')),2,'current and closed education records available');
select is(public.education_report_periods('00000000-0000-4000-8000-000000003621')->0->>'id','00000000-0000-4000-8000-000000008202','newest record first');
select is((pg_temp.scoped()->'summary'->>'total')::int,11,'all dates includes older than 90 days');
select is((pg_temp.scoped('all',90)->'summary'->>'total')::int,10,'90-day window remains explicit');
select is((pg_temp.scoped('unknown')->'summary'->>'total')::int,10,'legacy evidence stays unknown after period registration');
select is((pg_temp.scoped('00000000-0000-4000-8000-000000008201')->'summary'->>'total')::int,1,'late submission belongs to assignment context, not current school');
select is((pg_temp.scoped('00000000-0000-4000-8000-000000008202')->'summary'->>'total')::int,0,'new school cannot inherit old or unknown exams');
select is(pg_temp.scoped('00000000-0000-4000-8000-000000008201')->>'education_period','00000000-0000-4000-8000-000000008201','response records requested scope');
select is((select sum((w->>'total')::int)::int from jsonb_array_elements(pg_temp.scoped()->'weeks') w),11,'whole-history chart reconciles');
select is((select sum((w->>'total')::int)::int from jsonb_array_elements(pg_temp.scoped()->'topics') w),11,'whole-history topics reconcile');
select is((public.learning_progress_education('00000000-0000-4000-8000-000000003621',0,null,5)->'summary'->>'total')::int,10,'question-level filter is independent of current grade');
select is(pg_temp.scoped()->>'from',((now()-interval '91 days') at time zone 'Europe/Istanbul')::date::text,'whole history does not use today minus 90');
select is(jsonb_array_length(pg_temp.scores('unknown')->'rows'),1,'old school score without education context is accessible');
select is(jsonb_array_length(pg_temp.scores('00000000-0000-4000-8000-000000008201')->'rows'),50,'school score page is bounded');
select is((pg_temp.scores('00000000-0000-4000-8000-000000008201')->>'has_more')::boolean,true,'older scores are not silently truncated');
select is((pg_temp.scores('00000000-0000-4000-8000-000000008202')->'rows'->0->'education_context'->>'grade')::int,6,'score retains original grade after current grade correction');
select is(pg_temp.scores('00000000-0000-4000-8000-000000008202')->'rows'->0->'education_context'->>'school','New school','score retains original school after correction');
select is(jsonb_array_length(public.list_school_grades('00000000-0000-4000-8000-000000003621','00000000-0000-4000-8000-000000008201',
 (pg_temp.scores('00000000-0000-4000-8000-000000008201')->'rows'->49->>'graded_on')::date,
 (pg_temp.scores('00000000-0000-4000-8000-000000008201')->'rows'->49->>'id')::uuid)->'rows'),2,'cursor reaches remaining same-date scores without loss');
select throws_ok($$select public.list_school_grades('00000000-0000-4000-8000-000000003621','all',current_date,null)$$,'P0001','invalid_cursor','partial cursor rejected');
select throws_ok($$select pg_temp.scoped(null)$$,'P0001','report_period_invalid','null does not silently expand scope');
select throws_ok($$select pg_temp.scoped('not-a-period')$$,'P0001','report_period_invalid','invalid period rejected');
select throws_ok($$select pg_temp.scoped('all',365)$$,'P0001','invalid_input','arbitrary windows rejected');
select throws_ok($$select public.education_report_periods('00000000-0000-4000-8000-000000003622')$$,'42501','forbidden','foreign child context blocked');
select throws_ok($$select public.list_school_grades('00000000-0000-4000-8000-000000003622')$$,'42501','forbidden','foreign school scores blocked');
select throws_ok($$select public.learning_progress_education('00000000-0000-4000-8000-000000003622')$$,'42501','forbidden','foreign progress blocked');
select throws_ok($$select public.learning_progress_education('00000000-0000-4000-8000-000000003622',0,null,null,'00000000-0000-4000-8000-000000008201')$$,'42501','forbidden','period ID cannot authorize another child');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003601","role":"authenticated","gina":{"family_id":"00000000-0000-4000-8000-000000003611","role":"device","child_id":"00000000-0000-4000-8000-000000003621"}}',true);
select throws_ok($$select pg_temp.scoped()$$,'42501','forbidden','child device cannot access parent report');
select throws_ok($$select pg_temp.scores()$$,'42501','forbidden','child device cannot access school score list');
reset role;
select ok(not has_function_privilege('anon','public.learning_progress_education(uuid,int,text,int,text)','EXECUTE'),'anonymous progress denied');
select ok(not has_function_privilege('anon','public.education_report_periods(uuid)','EXECUTE'),'anonymous context denied');
select ok(not has_function_privilege('authenticated','gina.check_report_period(uuid,text)','EXECUTE'),'private validation not callable');
select * from finish();
rollback;
