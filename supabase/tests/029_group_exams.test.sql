begin;select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000002901','group-parent@test.local'),
('00000000-0000-4000-8000-000000002902','group-other@test.local'),
('00000000-0000-4000-8000-000000002903','group-admin@test.local'),
('00000000-0000-4000-8000-000000002904',null);
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000002903');
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000002901','One','00000000-0000-4000-8000-000000002901'),
('10000000-0000-4000-8000-000000002902','Two','00000000-0000-4000-8000-000000002902');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000002901','00000000-0000-4000-8000-000000002901'),
('10000000-0000-4000-8000-000000002902','00000000-0000-4000-8000-000000002901'),
('10000000-0000-4000-8000-000000002902','00000000-0000-4000-8000-000000002902');
insert into public.children(id,family_id,name,grade) values
('20000000-0000-4000-8000-000000002901','10000000-0000-4000-8000-000000002901','Private One',5),
('20000000-0000-4000-8000-000000002902','10000000-0000-4000-8000-000000002902','Private Two',5),
('20000000-0000-4000-8000-000000002903','10000000-0000-4000-8000-000000002901','Other Grade',2);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('30000000-0000-4000-8000-000000002901','10000000-0000-4000-8000-000000002901','00000000-0000-4000-8000-000000002904','20000000-0000-4000-8000-000000002901');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
('10000000-0000-4000-8000-000000002901','plus','test',now()+interval '1 day'),
('10000000-0000-4000-8000-000000002902','pro','test',now()+interval '1 day');
insert into public.library_collections(id,title,grade,subject,curriculum_version,status) values('40000000-0000-4000-8000-000000002901','Published',5,'Fen','2026 pilot','published');
insert into public.library_items(id,collection_id,content,content_hash,status)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'40000000-0000-4000-8000-000000002901',
jsonb_build_object('grade',5,'subject','Fen','topic',case when n=1 then 'Işık' else 'Isı' end,'kind','multiple_choice','difficulty','orta','stem','Örnek soru '||n,'choices','[{"key":"A","text":"a"},{"key":"B","text":"b"},{"key":"C","text":"c"},{"key":"D","text":"d"}]'::jsonb,'correct_key','A','solution','Açıklama'),'group-hash-'||n,'published' from generate_series(1,3)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002903","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select lives_ok($$select public.admin_create_group_exam('60000000-0000-4000-8000-000000002901','40000000-0000-4000-8000-000000002901','Birlikte Fen',array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003']::uuid[],now()-interval '1 hour',now()+interval '1 hour',30,array['plus','pro']::public.plan_code[])$$,'admin publishes frozen set');
select lives_ok($$select public.admin_create_group_exam('60000000-0000-4000-8000-000000002901','40000000-0000-4000-8000-000000002901','Birlikte Fen',array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003']::uuid[],now()-interval '1 hour',now()+interval '1 hour',30,array['plus','pro']::public.plan_code[])$$,'same admin intent replay succeeds');
select throws_ok($$select public.admin_create_group_exam('60000000-0000-4000-8000-000000002901','40000000-0000-4000-8000-000000002901','Changed',array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003']::uuid[],now()-interval '1 hour',now()+interval '1 hour',30,array['plus','pro']::public.plan_code[])$$,'P0001','request_conflict','same id cannot change group');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002901","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002901","role":"parent"}}',true);
select throws_ok($$select * from public.group_exam_questions$$,'42501',null,'cohort answer snapshots private');
select throws_ok($$select public.admin_group_exams()$$,'42501','forbidden','parent cannot access admin operations');
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901',false,false)$$,'P0001','group_consent_required','participation consent required');
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901',false,true)$$,'P0001','group_disabled','global flag enforced');
reset role;update public.app_settings set value='true' where key='cohorts.enabled';set local role authenticated;
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002903',false,true)$$,'P0001','group_grade_mismatch','different grade cannot join');
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902',false,true)$$,'P0001','group_grade_mismatch','another family child cannot join');
select set_config('test.group_exam',public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901',true,true)::text,true);
select is(public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901',true,true)::text,current_setting('test.group_exam'),'enrol retry does not duplicate exam');
select is((public.get_group_exams()->>'used')::int,1,'one monthly use');
select is(jsonb_array_length(public.get_group_exams()->'entries'),1,'only own family entries returned');
select throws_ok($$update public.question_bank set correct_key='B' where family_id='10000000-0000-4000-8000-000000002901'$$,'P0001','group_exam_locked','answers frozen before start');
select throws_ok($$update public.exams set duration_minutes=120 where id=current_setting('test.group_exam')::uuid$$,'P0001','group_exam_locked','time limit frozen');
select throws_ok($$delete from public.exams where id=current_setting('test.group_exam')::uuid$$,'P0001','group_exam_locked','cannot delete and re-enter to reset results');
select set_config('test.group_attempt',(public.start_exam_attempt(current_setting('test.group_exam')::uuid)).id::text,true);
select lives_ok($$select public.submit_exam_answer(current_setting('test.group_attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.group_exam')::uuid),'A')$$,'answer submitted');
select lives_ok($$select public.submit_exam_answer(current_setting('test.group_attempt')::uuid,(select question_ids[2] from public.exams where id=current_setting('test.group_exam')::uuid),'B')$$,'wrong answer submitted');
select lives_ok($$select public.finish_exam_attempt(current_setting('test.group_attempt')::uuid)$$,'finish cohort practice');
select is(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901')->>'ready','false','rank waits for end of shared window');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002904","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002901","role":"device","device_id":"30000000-0000-4000-8000-000000002901","child_id":"20000000-0000-4000-8000-000000002901"}}',true);
select is((select count(*)::int from public.exam_answers),0,'paired device cannot inspect correctness rows');
select is((select count(*)::int from public.get_saved_exam_answers(current_setting('test.group_attempt')::uuid)),2,'device can still resume entered choices');
select throws_ok($$select public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901')$$,'42501','forbidden','rank is a parent-controlled view');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002902","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002902","role":"parent"}}',true);
select set_config('test.other_exam',public.enroll_group_exam('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902',true,true)::text,true);
select set_config('test.other_attempt',(public.start_exam_attempt(current_setting('test.other_exam')::uuid)).id::text,true);
select public.submit_exam_answer(current_setting('test.other_attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.other_exam')::uuid),'A');
select public.finish_exam_attempt(current_setting('test.other_attempt')::uuid);
select throws_ok($$select public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901')$$,'P0001','not_found','other parent cannot read private topic report');
reset role;update public.group_exams set ends_at=now()-interval '1 minute';set local role authenticated;
select is(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->>'correct','1','frozen key scoring');
select is(jsonb_array_length(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking'),2,'only opted-in participants ranked');
select is(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking'->0->>'rank','1','equal correct counts tie regardless of speed');
select is(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking'->1->>'rank','1','second equal score has same rank');
select ok(not((public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking'->0)?'child_id'),'ranking never exposes child ID');
select ok((public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking')::text not like '%Private%','ranking never exposes child names');
select public.set_group_ranking_consent('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902',false);
select is(jsonb_array_length(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002902')->'ranking'),0,'withdrawing ranking hides own ranking access too');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002901","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002901","role":"parent"}}',true);
select is(jsonb_array_length(public.get_group_result('60000000-0000-4000-8000-000000002901','20000000-0000-4000-8000-000000002901')->'ranking'),1,'withdrawal removes entry from peers immediately');

-- Quota policy is atomic, and a second cohort cannot evade the family allowance.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002903","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select lives_ok($$select public.admin_group_policy(true,'{"free":0,"plus":1,"pro":4}')$$,'admin sets all quota limits atomically');
select throws_ok($$select public.admin_group_policy(false,'{"free":0,"plus":101,"pro":4}')$$,'23514',null,'out of range policy rejected');
select is(public.admin_group_exams()->>'enabled','true','failed policy does not disable existing access');
select throws_ok($$select public.admin_group_policy(true,'{"free":0,"plus":1}')$$,'P0001','invalid_input','partial policy rejected');
select lives_ok($$select public.admin_create_group_exam('60000000-0000-4000-8000-000000002902','40000000-0000-4000-8000-000000002901','Kısa pencere',array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003']::uuid[],now()-interval '1 minute',now()+interval '5 minutes',30,array['plus','pro']::public.plan_code[])$$,'create second group');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002901","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002901","role":"parent"}}',true);
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000002902','20000000-0000-4000-8000-000000002901',true,true)$$,'P0001','group_quota','second entry cannot exceed family monthly quota');
select throws_ok($$select public.settle_group_attempts()$$,'42501',null,'parent cannot invoke settlement');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002902","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002902","role":"parent"}}',true);
select set_config('test.short_exam',public.enroll_group_exam('60000000-0000-4000-8000-000000002902','20000000-0000-4000-8000-000000002902',false,true)::text,true);
select set_config('test.short_attempt',(public.start_exam_attempt(current_setting('test.short_exam')::uuid)).id::text,true);
select is((select deadline_at from public.exam_attempts where id=current_setting('test.short_attempt')::uuid),now()+interval '5 minutes','personal timer clamps to common end');
select public.submit_exam_answer(current_setting('test.short_attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.short_exam')::uuid),'A');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002903","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select lives_ok($$select public.admin_cancel_group_exam('60000000-0000-4000-8000-000000002902','İçerik kontrolü için iptal')$$,'admin cancellation succeeds');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002902","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002902","role":"parent"}}',true);
select throws_ok($$select public.submit_exam_answer(current_setting('test.short_attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.short_exam')::uuid),'B')$$,'P0001','group_answer_closed','cancellation immediately stops new answers');
select throws_ok($$select public.submit_exam_answer_v3('90000000-0000-4000-8000-000000002901',current_setting('test.short_attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.short_exam')::uuid),1,'A',null,'{"version":1,"width":1000,"height":1400,"elements":[]}')$$,'P0001','group_answer_closed','notebook-only writes also stop immediately on cancellation');
select is((public.get_group_exams()->>'used')::int,1,'cancelled participation restores allowance');
reset role;
select is(public.settle_group_attempts(),1,'cancelled in-progress attempt settled');
select is(public.settle_group_attempts(),0,'settlement retry does not repeat completion');
select is((select status::text from public.exam_attempts where id=current_setting('test.short_attempt')::uuid),'graded','multiple-choice attempt closes and existing grading trigger completes it');
select is((select count(*)::int from public.audit_log where action='group_ranking_consent' and target_id in(select id::text from public.group_exam_entries where child_id='20000000-0000-4000-8000-000000002902')),1,'ranking withdrawal recorded once');
reset role;
select gina.enqueue_push('10000000-0000-4000-8000-000000002902','parents','exam_finished',jsonb_build_object('exam_id',current_setting('test.short_exam')::uuid,'attempt_id',current_setting('test.short_attempt')::uuid));
-- Completion retries must not create duplicate or content-bearing notifications.
select is((select count(*)::int from public.push_outbox where kind='exam_assigned' and payload->>'exam_id'=current_setting('test.group_exam')),1,'enrollment replay creates one assignment notification');
select is((select count(*)::int from public.push_outbox where kind='exam_finished' and payload->>'attempt_id'=current_setting('test.short_attempt')),1,'settlement retry creates one completion notification');
select is((select audience from public.push_outbox where kind='exam_finished' and payload->>'attempt_id'=current_setting('test.short_attempt')),'parents','completion notification targets parents');
select is((select family_id::text from public.push_outbox where kind='exam_finished' and payload->>'attempt_id'=current_setting('test.short_attempt')),'10000000-0000-4000-8000-000000002902','notification belongs to the participating family');
select is((select payload-array['exam_id','attempt_id'] from public.push_outbox where kind='exam_finished' and payload->>'attempt_id'=current_setting('test.short_attempt')),'{}'::jsonb,'no name, score, topic or answer in notification payload');
select lives_ok($$delete from public.families where id='10000000-0000-4000-8000-000000002901'$$,'family deletion cascades frozen practice');
select is((select count(*)::int from public.group_exam_entries),2,'deleted family is removed from ranking data');
select * from finish();rollback;
