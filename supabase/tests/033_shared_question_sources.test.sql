begin;
select no_plan();
update public.plans set prova_monthly_exams=null where code='free';
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000003301','shared-parent@test.local'),
('00000000-0000-4000-8000-000000003302','shared-other@test.local'),
('00000000-0000-4000-8000-000000003303',null);
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000003301','A','00000000-0000-4000-8000-000000003301'),
('10000000-0000-4000-8000-000000003302','B','00000000-0000-4000-8000-000000003302');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000003301','00000000-0000-4000-8000-000000003301'),
('10000000-0000-4000-8000-000000003302','00000000-0000-4000-8000-000000003302');
insert into public.children(id,family_id,name) values('20000000-0000-4000-8000-000000003301','10000000-0000-4000-8000-000000003301','Child');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('30000000-0000-4000-8000-000000003301','10000000-0000-4000-8000-000000003301','00000000-0000-4000-8000-000000003303','20000000-0000-4000-8000-000000003301');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer) values
('40000000-0000-4000-8000-000000003301','10000000-0000-4000-8000-000000003301',5,'Matematik','Çevre','open_ended','Bahçenin çevresi kaç metredir?','28'),
('40000000-0000-4000-8000-000000003302','10000000-0000-4000-8000-000000003301',5,'Matematik','Çevre','open_ended','Diğer soru metni','32');
insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent)
values('80000000-0000-4000-8000-000000003301','10000000-0000-4000-8000-000000003301','question_image','garden.png','image/png',100,repeat('a',64),'test/garden-3301','ready',800,600,'private-storage-v1');
insert into public.learning_source_links(source_id,question_id,alt) values('80000000-0000-4000-8000-000000003301','40000000-0000-4000-8000-000000003301','Dikdörtgen okul bahçesi');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003301","role":"parent"}}',true);
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status)
values('50000000-0000-4000-8000-000000003301','10000000-0000-4000-8000-000000003301','20000000-0000-4000-8000-000000003301','Garden','Matematik',5,array['40000000-0000-4000-8000-000000003301']::uuid[],'assigned');
select is((select count(*)::int from public.exam_attempts),0,'no child has started yet');
select throws_ok($$update public.question_bank set stem='Changed before first answer' where id='40000000-0000-4000-8000-000000003301'$$,'P0001','question_in_use','assigned unstarted question cannot change');
select throws_ok($$update public.question_bank set expected_answer='wrong' where id='40000000-0000-4000-8000-000000003301'$$,'P0001','question_in_use','grading answer frozen alongside visible question');
select throws_ok($$update public.question_bank set explanation='Replacement explanation',difficulty='zor' where id='40000000-0000-4000-8000-000000003301'$$,'P0001','question_in_use','explanation and difficulty are part of retained content');
select lives_ok($$update public.question_bank set times_asked=times_asked+1 where id='40000000-0000-4000-8000-000000003301'$$,'usage counter still writable');
select lives_ok($$update public.question_bank set stem='Editable unassigned question' where id='40000000-0000-4000-8000-000000003302'$$,'unassigned ordinary questions remain editable');
select throws_ok($$select public.attach_question_source('40000000-0000-4000-8000-000000003301','80000000-0000-4000-8000-000000003301','Changed alt text')$$,'P0001','question_in_use','attachment RPC cannot change unstarted assigned question');
select throws_ok($$update public.exams set question_ids=array['40000000-0000-4000-8000-000000003302']::uuid[] where id='50000000-0000-4000-8000-000000003301'$$,'P0001','exam_content_locked','cannot swap assigned questions');
select throws_ok($$update public.exams set status='draft',content_locked_at=null where id='50000000-0000-4000-8000-000000003301'$$,'P0001','exam_content_locked','cannot unassign to bypass content freeze');
update public.exams set content_locked_at=null where id='50000000-0000-4000-8000-000000003301';
select ok((select content_locked_at is not null from public.exams where id='50000000-0000-4000-8000-000000003301'),'cannot clear server lock timestamp');
reset role;
select throws_ok($$delete from public.learning_source_links where question_id='40000000-0000-4000-8000-000000003301'$$,'P0001','question_in_use','direct media deletion blocked');
select throws_ok($$update public.learning_sources set sha256=repeat('b',64) where id='80000000-0000-4000-8000-000000003301'$$,'P0001','source_version_immutable','verified source bytes cannot be replaced');

create function pg_temp.save_group(id uuid,prev uuid default null,body text default 'Okulun dikdörtgen bahçesi 8 metre uzunluğunda, 6 metre genişliğindedir.',bad_last boolean default false) returns jsonb language sql as $$
 select public.save_question_source_group(id,jsonb_build_object('title','Okul bahçesi','body',body,'grade',5,'subject','Matematik'),
 jsonb_build_array(jsonb_build_object('topic','Çevre','kind','open_ended','difficulty','orta','stem','Bahçenin çevresi kaç metredir?','expected_answer','28','solution','2 × (8 + 6) = 28 m'),
 jsonb_build_object('topic','Alan','kind','open_ended','difficulty','orta','stem',case when bad_last then 'x' else 'Bahçenin alanı kaç metrekaredir?' end,'expected_answer','48','solution','8 × 6 = 48 m²')),
 '[{"source_id":"80000000-0000-4000-8000-000000003301","alt":"8 metre ve 6 metre kenarlı bahçe"}]',prev);
$$;
set local role authenticated;
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003301')$$,'P0001','question_groups_unavailable','new authoring disabled until screen integration');
reset role;update public.app_settings set value='true' where key='question_groups.enabled';set local role authenticated;
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003399',null,'A sufficiently long common source.',true)$$,'P0001','question_group_mismatch','invalid final member rolls back group');
select is((select count(*)::int from public.question_source_groups),0,'no orphan group on partial save failure');
select is((select count(*)::int from public.question_bank),2,'no orphan member on partial save failure');
select lives_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003301')$$,'create common source and members atomically');
select is(pg_temp.save_group('60000000-0000-4000-8000-000000003301'),pg_temp.save_group('60000000-0000-4000-8000-000000003301'),'identical retry returns identical IDs');
select is((select count(*)::int from public.question_bank),4,'retry creates no extra questions');
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003301',null,'Changed body with the same request key')$$,'P0001','request_conflict','cannot reuse receipt for altered payload');
select is(jsonb_array_length(public.get_question_context((select array_agg(question_id) from public.question_source_members))),2,'parent receives context for each authorized member');
select ok(not ((public.get_question_context((select array_agg(question_id) from public.question_source_members))->0) ?| array['expected_answer','solution','question_ids','object_path']),'context contains no answers, siblings or storage paths');
select is(jsonb_array_length(public.get_question_media((select array_agg(question_id) from public.question_source_members))),2,'same verified image linked to both members');
select throws_ok($$update public.question_bank set stem='Edit published version' where id in(select question_id from public.question_source_members)$$,'P0001','question_group_immutable','versioned member cannot be edited in place');
select throws_ok($$select public.submit_question_contribution(gen_random_uuid(),(select question_id from public.question_source_members limit 1),true,true)$$,'P0001','source_contribution_not_ready','cannot share one question without its common source');
select lives_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003302','60000000-0000-4000-8000-000000003301','Bahçe ölçüleri aynı, yeni sürümde açıklama daha ayrıntılı.')$$,'revision creates new immutable member IDs');
select is((select version from public.question_source_groups where id='60000000-0000-4000-8000-000000003302'),2,'version increments');
select is((select body from public.question_source_groups where id='60000000-0000-4000-8000-000000003301'),'Okulun dikdörtgen bahçesi 8 metre uzunluğunda, 6 metre genişliğindedir.','previous source unchanged');
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003303','60000000-0000-4000-8000-000000003301')$$,'P0001','question_group_changed','stale editor cannot branch silently over latest version');
reset role;update public.app_settings set value='false' where key='question_groups.enabled';set local role authenticated;
select throws_ok($$insert into public.exams(family_id,child_id,title,grade,subject,question_ids,status) values('10000000-0000-4000-8000-000000003301','20000000-0000-4000-8000-000000003301','Unsafe old reader',5,'Matematik',(select array_agg(question_id) from public.question_source_members where group_id='60000000-0000-4000-8000-000000003301'),'assigned')$$,'P0001','question_group_delivery_not_ready','disabled group delivery stays unavailable');
reset role;update public.app_settings set value='true' where key='question_groups.enabled';set local role authenticated;
select lives_ok($$select public.assign_question_source_group('50000000-0000-4000-8000-000000003302','60000000-0000-4000-8000-000000003301','20000000-0000-4000-8000-000000003301','Shared practice')$$,'assign chosen immutable version');
select lives_ok($$select public.assign_question_source_group('50000000-0000-4000-8000-000000003302','60000000-0000-4000-8000-000000003301','20000000-0000-4000-8000-000000003301','Shared practice')$$,'lost assignment response retry is idempotent');
select is((select count(*)::int from public.exams),2,'no duplicate assignment');
select ok((select bool_and(stem like '%8 metre%') from public.get_attempt_questions('50000000-0000-4000-8000-000000003302')),'legacy child readers retain shared text in every stem');
select set_config('test.groupids',(select question_ids::text from public.exams where id='50000000-0000-4000-8000-000000003302'),true);
reset role;
select throws_ok($$update public.question_source_groups set body='Edited by service' where id='60000000-0000-4000-8000-000000003301'$$,'P0001','question_group_immutable','service cannot mutate version');
select throws_ok($$delete from public.question_source_members where group_id='60000000-0000-4000-8000-000000003301'$$,'P0001','question_group_immutable','membership cannot be removed to bypass version freeze');
select throws_ok($$insert into public.question_source_members(group_id,question_id,position) values('60000000-0000-4000-8000-000000003301','40000000-0000-4000-8000-000000003302',3)$$,'P0001','question_group_immutable','cannot append to finalized version');
select throws_ok($$delete from public.learning_source_links where question_id in(select question_id from public.question_source_members)$$,'P0001','question_in_use','versioned media references cannot disappear');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003302","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003302","role":"parent"}}',true);
select is((select count(*)::int from public.question_source_groups),0,'other family cannot list groups');
select is((select count(*)::int from public.question_source_members),0,'other family cannot list members');
select is(public.get_question_context(current_setting('test.groupids')::uuid[]),'[]'::jsonb,'other family cannot fetch known member context');
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003301')$$,'P0001','request_conflict','other family cannot replay receipt');
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003304','60000000-0000-4000-8000-000000003302')$$,'P0001','question_group_not_found','other family cannot create revision');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003303","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003301","role":"device","device_id":"30000000-0000-4000-8000-000000003301","child_id":"20000000-0000-4000-8000-000000003301"}}',true);
select is((select count(*)::int from public.question_source_groups),0,'child cannot browse private source library');
select is(jsonb_array_length(public.get_question_context(current_setting('test.groupids')::uuid[])),2,'assigned child receives authorized common context');
select is(jsonb_array_length(public.get_question_context((current_setting('test.groupids')::uuid[])[1:1])),1,'single requested member never discloses siblings');
select throws_ok($$select pg_temp.save_group('60000000-0000-4000-8000-000000003305')$$,'42501','forbidden','child cannot author groups');
reset role;update public.app_settings set value='false' where key='question_groups.enabled';set local role authenticated;
select lives_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000003302')$$,'disabled rollout does not stop an already assigned child');
select lives_ok($$select public.finish_exam_attempt((select id from public.exam_attempts where exam_id='50000000-0000-4000-8000-000000003302'))$$,'already assigned practice can still finish after gate closes');
reset role;
select ok(not has_function_privilege('anon','public.save_question_source_group(uuid,jsonb,jsonb,jsonb,uuid)','EXECUTE'),'anonymous cannot create groups');
select ok(not has_function_privilege('anon','public.get_question_context(uuid[])','EXECUTE'),'anonymous cannot read context');
select ok(not has_table_privilege('authenticated','public.question_source_members','UPDATE'),'clients cannot unlink member versions');
select is((select count(*)::int from public.standalone_question_bank),2,'ordinary selection excludes grouped members');
select is((select count(*)::int from public.current_question_bank),4,'library browsing excludes superseded versions');
-- Account deletion remains available: immutable is not permanent retention.
reset role;
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000003301';set constraints all immediate;$$,'account deletion cascades through immutable versions and images');
select is((select count(*)::int from public.question_source_groups),0,'family source versions removed');
select is((select count(*)::int from public.learning_sources),0,'private source metadata removed');
select * from finish();
rollback;
