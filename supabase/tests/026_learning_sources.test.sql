begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000002601','source-parent@test.local'),
('00000000-0000-4000-8000-000000002602','source-other@test.local'),
('00000000-0000-4000-8000-000000002603',null);
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000002601','Sources','00000000-0000-4000-8000-000000002601'),
('10000000-0000-4000-8000-000000002602','Other','00000000-0000-4000-8000-000000002602');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000002601','00000000-0000-4000-8000-000000002601'),
('10000000-0000-4000-8000-000000002602','00000000-0000-4000-8000-000000002602');
insert into public.children(id,family_id,name) values
('20000000-0000-4000-8000-000000002601','10000000-0000-4000-8000-000000002601','Child');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
('30000000-0000-4000-8000-000000002601','10000000-0000-4000-8000-000000002601','00000000-0000-4000-8000-000000002603','20000000-0000-4000-8000-000000002601');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002601","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002601","role":"parent"}}',true);
select is(public.get_learning_source_policy()->>'enabled','false','uploads disabled until deployment preflight');
select throws_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000002601','question_image','image.png','image/png',100,repeat('a',64),true)$$,'P0001','source_unavailable','feature flag enforced on server');
reset role;update public.app_settings set value='true' where key='sources.enabled';set local role authenticated;
select throws_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000002601','question_image','image.png','image/png',100,repeat('a',64),false)$$,'P0001','source_consent_required','storage consent required');
select lives_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000002601','question_image','image.png','image/png',100,repeat('a',64),true)$$,'reserve own upload');
select lives_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000002601','question_image','image.png','image/png',100,repeat('a',64),true)$$,'reserve retry is idempotent');
select is((select count(*)::int from public.learning_sources),1,'one source after repeat');
select throws_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000002601','question_image','image.png','image/png',100,repeat('b',64),true)$$,'P0001','request_conflict','cannot replace bytes at same identity');
select throws_ok($$update public.learning_sources set status='ready'$$,'42501',null,'parent cannot bypass verification');
select throws_ok($$select public.get_learning_source_access('40000000-0000-4000-8000-000000002601')$$,'P0001','source_not_ready','pending source cannot be viewed');
select throws_ok($$select public.save_question_with_sources('50000000-0000-4000-8000-000000002601','{"grade":5,"subject":"Fen","topic":"Işık","stem":"Şekilde ne görüyorsun?","kind":"open_ended","difficulty":"orta","expected_answer":"Işın","solution":"Işık doğrusal yayılır."}','[{"source_id":"40000000-0000-4000-8000-000000002601","alt":"Bir ışın çizimi"}]')$$,'P0001','source_not_ready','atomic save fails if image not ready');
select is((select count(*)::int from public.question_bank),0,'failed attachment leaves no partial question');
reset role;update public.learning_sources set status='ready',width=800,height=600,verified_at=now();set local role authenticated;
select lives_ok($$select public.save_question_with_sources('50000000-0000-4000-8000-000000002601','{"grade":5,"subject":"Fen","topic":"Işık","stem":"Şekilde ne görüyorsun?","kind":"open_ended","difficulty":"orta","expected_answer":"Işın","solution":"Işık doğrusal yayılır."}','[{"source_id":"40000000-0000-4000-8000-000000002601","alt":"Bir ışın çizimi"}]')$$,'question and image saved together');
select lives_ok($$select public.save_question_with_sources('50000000-0000-4000-8000-000000002601','{"grade":5,"subject":"Fen","topic":"Işık","stem":"Şekilde ne görüyorsun?","kind":"open_ended","difficulty":"orta","expected_answer":"Işın","solution":"Işık doğrusal yayılır."}','[{"source_id":"40000000-0000-4000-8000-000000002601","alt":"Bir ışın çizimi"}]')$$,'lost save response retry returns same question');
select is((select count(*)::int from public.question_bank),1,'exactly one saved question');
select throws_ok($$select public.save_question_with_sources('50000000-0000-4000-8000-000000002601','{"grade":6}','[]')$$,'P0001','request_conflict','same request cannot change content');
select is(jsonb_array_length(public.get_question_media(array['50000000-0000-4000-8000-000000002601']::uuid[])),1,'parent sees linked media');
select throws_ok($$select public.submit_question_contribution(gen_random_uuid(),'50000000-0000-4000-8000-000000002601',true,true)$$,'P0001','source_contribution_not_ready','cannot silently contribute without required image');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002602","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002602","role":"parent"}}',true);
select is((select count(*)::int from public.learning_sources),0,'other family cannot list sources');
select is(jsonb_array_length(public.get_question_media(array['50000000-0000-4000-8000-000000002601']::uuid[])),0,'other family cannot see question images');
select throws_ok($$select public.get_learning_source_access('40000000-0000-4000-8000-000000002601')$$,'42501','forbidden','other family cannot sign a URL');
reset role;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,created_by) values
('60000000-0000-4000-8000-000000002601','10000000-0000-4000-8000-000000002601','20000000-0000-4000-8000-000000002601','Image exam','Fen',5,array['50000000-0000-4000-8000-000000002601']::uuid[],'assigned','00000000-0000-4000-8000-000000002601');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002603","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002601","role":"device","device_id":"30000000-0000-4000-8000-000000002601","child_id":"20000000-0000-4000-8000-000000002601"}}',true);
select is((select count(*)::int from public.learning_sources),0,'child cannot browse family documents');
select is(jsonb_array_length(public.get_question_media(array['50000000-0000-4000-8000-000000002601']::uuid[])),1,'assigned child can load question image');
select lives_ok($$select public.get_learning_source_access('40000000-0000-4000-8000-000000002601','50000000-0000-4000-8000-000000002601')$$,'child signs only assigned image');
select throws_ok($$select public.get_learning_source_access('40000000-0000-4000-8000-000000002601')$$,'42501','forbidden','child must name an authorized linked question');
select throws_ok($$select public.reserve_learning_source(gen_random_uuid(),'question_image','x.png','image/png',100,repeat('a',64),true)$$,'42501','forbidden','child cannot upload');
select lives_ok($$select public.start_exam_attempt('60000000-0000-4000-8000-000000002601')$$,'start exam');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002601","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002601","role":"parent"}}',true);
select throws_ok($$select public.attach_question_source('50000000-0000-4000-8000-000000002601','40000000-0000-4000-8000-000000002601','Changed description')$$,'P0001','question_in_use','image immutable after child starts');
select throws_ok($$select public.delete_learning_source('40000000-0000-4000-8000-000000002601')$$,'P0001','question_in_use','cannot remove exam image');
select throws_ok($$select public.record_source_cleanup('path',true)$$,'42501',null,'client cannot erase cleanup tombstones');
reset role;
delete from public.exams where id='60000000-0000-4000-8000-000000002601';
set local role authenticated;
select lives_ok($$select public.delete_learning_source('40000000-0000-4000-8000-000000002601')$$,'parent can remove unreferenced source');
reset role;
select is((select count(*)::int from public.source_deletion_queue),1,'physical object durably queued');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.record_source_cleanup('10000000-0000-4000-8000-000000002601/40000000-0000-4000-8000-000000002601',true)$$,'storage deletion acknowledged');
reset role;
select is((select count(*)::int from public.source_deletion_queue),1,'tombstone retained through signed upload expiry');
update public.source_deletion_queue set created_at=now()-interval '4 hours';
set local role service_role;
select public.record_source_cleanup('10000000-0000-4000-8000-000000002601/40000000-0000-4000-8000-000000002601',true);
reset role;
select is((select count(*)::int from public.source_deletion_queue),0,'expired tombstone removed after successful second sweep');
select * from finish();
rollback;
