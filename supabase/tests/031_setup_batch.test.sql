begin;
select no_plan();
update public.plans set prova_monthly_exams=null,prova_scenarios=true where code='free';
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000003101','scope-a@test.local'),('00000000-0000-4000-8000-000000003102','scope-b@test.local');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000003101','A','00000000-0000-4000-8000-000000003101'),('10000000-0000-4000-8000-000000003102','B','00000000-0000-4000-8000-000000003102');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000003101','00000000-0000-4000-8000-000000003101'),('10000000-0000-4000-8000-000000003102','00000000-0000-4000-8000-000000003102');
insert into public.children(id,family_id,name) values('20000000-0000-4000-8000-000000003101','10000000-0000-4000-8000-000000003101','A child'),('20000000-0000-4000-8000-000000003102','10000000-0000-4000-8000-000000003102','B child');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem) values
('30000000-0000-4000-8000-000000003101','10000000-0000-4000-8000-000000003101',5,'Fen','Işık','open_ended','orta','A private question'),
('30000000-0000-4000-8000-000000003102','10000000-0000-4000-8000-000000003102',5,'Fen','Işık','open_ended','orta','B private question'),
('30000000-0000-4000-8000-000000003103',null,5,'Fen','Işık','open_ended','orta','Shared question');
insert into public.exam_blueprints(id,family_id,grade,subject,name) values('40000000-0000-4000-8000-000000003102','10000000-0000-4000-8000-000000003102',5,'Fen','B private scenario');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003101","role":"parent"}}',true);


select set_config('test.batch', '[{"title":"Oku","icon":"read-book","stars":2,"days":[1,3]},{"title":"Bitkileri sula","icon":"water-plants","stars":1,"days":[6]},{"title":"Çantanı hazırla","icon":"pack-school-bag","stars":1,"days":[1,2,3,4,5]}]',true);
select set_config('test.result', public.save_setup_batch('60000000-0000-4000-8000-000000003101','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000003101')::text,true);
select is(jsonb_array_length(current_setting('test.result')::jsonb),3,'all three ideas can be saved');
select is(public.save_setup_batch('60000000-0000-4000-8000-000000003101','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000003101')::text,current_setting('test.result'),'lost response reuses the same batch');
select is((select count(*)::int from public.task_templates),3,'retry creates no duplicate tasks');
select throws_ok($$select public.save_setup_batch('60000000-0000-4000-8000-000000003101','reward',current_setting('test.batch')::jsonb)$$,'P0001','request_conflict','request cannot change purpose');
select throws_ok($$select public.save_setup_batch('60000000-0000-4000-8000-000000003102','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000003102')$$,'42501','forbidden','another family child is rejected');
select throws_ok($$select public.save_setup_batch('60000000-0000-4000-8000-000000003103','reward','[{"title":"Birlikte oyun","icon":"reward-game-with-parent","stars":10},{"title":"Bozuk","icon":"reward-book","stars":0}]')$$,'P0001','invalid_input','invalid second item rolls back entire batch');
select is((select count(*)::int from public.family_rewards),0,'no partially saved reward');
select is(jsonb_array_length(public.save_setup_batch('60000000-0000-4000-8000-000000003104','reward','[{"title":"Birlikte oyun","icon":"reward-game-with-parent","stars":10},{"title":"Kitap zamanı","icon":"reward-book","stars":20}]')),2,'multiple reward definitions saved');
select throws_ok($$select public.save_setup_batch('60000000-0000-4000-8000-000000003105','task','[{"title":"Tekrar","icon":"read-book","stars":1,"days":[1,1]}]','20000000-0000-4000-8000-000000003101')$$,'P0001','invalid_input','duplicate days rejected');
reset role;
select is((select count(*)::int from public.setup_ai_jobs),0,'selection does not create or consume an AI generation');
update public.plans set max_active_tasks_per_child=4 where code='free';
set local role authenticated;
select throws_ok($$select public.save_setup_batch('60000000-0000-4000-8000-000000003106','task',current_setting('test.batch')::jsonb,'20000000-0000-4000-8000-000000003101')$$,'P0001','plan_limit_tasks','batch respects task plan allowance');
select is((select count(*)::int from public.task_templates),3,'quota failure rolls back earlier items too');
select * from finish();rollback;
