begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000005401','blueprint-parent@test.local'),
('00000000-0000-4000-8000-000000005402','blueprint-other@test.local'),
('00000000-0000-4000-8000-000000005403',null);
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000005401','Sources','00000000-0000-4000-8000-000000005401'),
('10000000-0000-4000-8000-000000005402','Other','00000000-0000-4000-8000-000000005402');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000005401','00000000-0000-4000-8000-000000005401'),
('10000000-0000-4000-8000-000000005402','00000000-0000-4000-8000-000000005402');
insert into public.children(id,family_id,name) values
('20000000-0000-4000-8000-000000005401','10000000-0000-4000-8000-000000005401','Child');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('30000000-0000-4000-8000-000000005401','10000000-0000-4000-8000-000000005401','00000000-0000-4000-8000-000000005403','20000000-0000-4000-8000-000000005401');
update public.children set grade=5;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005401","role":"parent"}}',true);
select set_config('test.body','{"child_id":"20000000-0000-4000-8000-000000005401","grade":5,"subject":"Matematik","name":"Senaryo 2","academic_year":"2026-2027","term":1,"exam":1,"rows":[{"topic":"Açılar ve ölçme","count":3},{"topic":"Üçgenler","count":2}],"source_url":"","confirmed":true}',true);
select set_config('test.result',public.save_family_blueprint('60000000-0000-4000-8000-000000005401',current_setting('test.body')::jsonb)::text,true);
select is(public.save_family_blueprint('60000000-0000-4000-8000-000000005401',current_setting('test.body')::jsonb)::text,current_setting('test.result'),'same receipt gives original scenario');
select is((select count(*)::int from public.exam_blueprints),1,'replay creates no duplicate');
select is((select source_context->>'origin' from public.exam_blueprints),'parent_entered','manual source identity explicit');
select is((select source_context->>'officially_verified' from public.exam_blueprints),'false','manual entry not officially verified');
select is((select source_context->>'academic_year' from public.exam_blueprints),'2026-2027','academic scope retained');
select is((select jsonb_array_length(rows) from public.exam_blueprints),2,'joint outcomes remain one question-count row');
select throws_ok($$select public.save_family_blueprint('60000000-0000-4000-8000-000000005401',jsonb_set(current_setting('test.body')::jsonb,'{name}','"Changed"'))$$,'P0001','request_conflict','changed receipt rejected');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{grade}','6'))$$,'P0001','blueprint_grade_mismatch','child grade enforced');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{academic_year}','"2026-2029"'))$$,'P0001','blueprint_invalid','nonconsecutive year');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{confirmed}','false'))$$,'P0001','blueprint_invalid','explicit review required');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{term}','3'))$$,'P0001','blueprint_invalid','term bounded');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{exam}','0'))$$,'P0001','blueprint_invalid','exam bounded');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{source_url}','"javascript:alert(1)"'))$$,'P0001','blueprint_invalid','non-HTTPS rejected');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{grade}','"5"'))$$,'P0001','blueprint_invalid','grade type strict');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[{"topic":"A","count":31}]'))$$,'P0001','blueprint_invalid','excessive question count');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[{"topic":"A","count":20},{"topic":"B","count":20}]'))$$,'P0001','blueprint_invalid','total count bounded');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[{"topic":"A","count":1},{"topic":" A ","count":2}]'))$$,'P0001','blueprint_invalid','duplicate topics normalized');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[{"topic":"A","count":"2"}]'))$$,'P0001','blueprint_invalid','count type strict');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[]'))$$,'P0001','blueprint_invalid','empty distribution rejected');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),current_setting('test.body')::jsonb||'{"officially_verified":true}')$$,'P0001','blueprint_invalid','cannot import official approval claim');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{subject}','123'))$$,'P0001','blueprint_invalid','subject must be text');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{name}','123'))$$,'P0001','blueprint_invalid','name must be text');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),jsonb_set(current_setting('test.body')::jsonb,'{rows}','[{"topic":123,"count":2}]'))$$,'P0001','blueprint_invalid','topic must be text');
select is((select count(*)::int from public.exam_blueprints),1,'failed saves leave no partial entries');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005402","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005402","role":"parent"}}',true);
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),current_setting('test.body')::jsonb)$$,'42501','forbidden','foreign child rejected');
select throws_ok($$select public.save_family_blueprint('60000000-0000-4000-8000-000000005401',current_setting('test.body')::jsonb)$$,'P0001','request_conflict','foreign replay rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005403","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005401","role":"device","device_id":"30000000-0000-4000-8000-000000005401","child_id":"20000000-0000-4000-8000-000000005401"}}',true);
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),current_setting('test.body')::jsonb)$$,'42501','forbidden','child cannot save parent scenario');
reset role;select * from finish();rollback;
