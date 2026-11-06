-- C04: taslak bağlamı (ders/karma, MEB Ortak Yazılı/LGS/serbest, dönem/okul) sunucu şemasında; eski taslak uyumu;
-- dönem/okul değişince gönderim durur; alternatif açık uçlu cevap + rubrik; atanmış sürüm donuk; çocuk anahtar alamaz.
begin;
select no_plan();
update public.plans set prova_monthly_exams=null where code='free';
update public.app_settings set value='true' where key='question_groups.enabled';
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000011001','c04-parent@test.local'),
 ('00000000-0000-4000-8000-000000011002','c04-other@test.local'),
 ('00000000-0000-4000-8000-000000011003','c04-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000011001','C04 A','00000000-0000-4000-8000-000000011001'),
 ('10000000-0000-4000-8000-000000011002','C04 B','00000000-0000-4000-8000-000000011002');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011001','00000000-0000-4000-8000-000000011001'),
 ('10000000-0000-4000-8000-000000011002','00000000-0000-4000-8000-000000011002');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000011001','10000000-0000-4000-8000-000000011001','Cocuk',6),
 ('20000000-0000-4000-8000-000000011002','10000000-0000-4000-8000-000000011002','Diger',6);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000011001','10000000-0000-4000-8000-000000011001','00000000-0000-4000-8000-000000011003','20000000-0000-4000-8000-000000011001');
insert into gina.child_education_periods(id,child_id,family_id,academic_year,grade,school,starts_on,reason) values
 ('80000000-0000-4000-8000-000000011001','20000000-0000-4000-8000-000000011001','10000000-0000-4000-8000-000000011001',2026,6,'Sentetik Ortaokulu',date '2026-09-01','initial'),
 ('80000000-0000-4000-8000-000000011002','20000000-0000-4000-8000-000000011002','10000000-0000-4000-8000-000000011002',2026,6,'Baska Okul',date '2026-09-01','initial');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer,solution,explanation) values
 ('40000000-0000-4000-8000-000000011001','10000000-0000-4000-8000-000000011001',6,'Matematik','Kesirler','multiple_choice','Hangisi 1/2 ye eşittir?','[{"key":"A","text":"2/4"},{"key":"B","text":"1/3"},{"key":"C","text":"3/4"},{"key":"D","text":"2/3"}]','A',null,'2/4 sadeleşir.','B) 1/3 yarımdan küçük.'),
 ('40000000-0000-4000-8000-000000011002','10000000-0000-4000-8000-000000011001',6,'Fen Bilimleri','Kuvvet','open_ended','Sürtünmeye örnek yaz.',null,null,'Fren yapan bisiklet','Yüzeyler arasındaki direnç.',null);

create function pg_temp.ctx(scope text default 'mixed',track text default 'free',period text default '80000000-0000-4000-8000-000000011001',school text default 'Sentetik Ortaokulu') returns jsonb language sql as $$
 select jsonb_build_object('scope',scope,'track',track,'term',1,'program','Maarif','academicYear',2026,'periodId',period,'school',school,'schoolDeclared',false);
$$;
create function pg_temp.content(blocks jsonb,subjects jsonb default '["Matematik","Fen Bilimleri"]',ctx jsonb default null,target int default 2) returns jsonb language sql as $$
 select jsonb_build_object('childId','20000000-0000-4000-8000-000000011001','grade',6,'title','Karma çalışma','purpose','practice','format','school',
  'subjects',subjects,'topics','[]'::jsonb,'target',target,'minutes',null,'difficulty','orta','kind','mixed','note','','step',3,'blocks',blocks)
  || case when ctx is null then '{}'::jsonb else jsonb_build_object('context',ctx) end;
$$;
select set_config('test.blocks','[{"kind":"question","id":"40000000-0000-4000-8000-000000011001","source":"library"},{"kind":"question","id":"40000000-0000-4000-8000-000000011002","source":"manual"}]',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011001","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000011001","role":"parent"}}',true);

-- 1) Eski taslak (context yok) aynen kaydedilir ve gönderilir.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011001',0,pg_temp.content(current_setting('test.blocks')::jsonb))$$,'legacy draft without context saves');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011001',1)$$,'legacy draft without context submits');
select results_eq($$select exam_scope,assessment_track,term,education_period_id from public.exams where id='50000000-0000-4000-8000-000000011001'$$,
 $$values (null::text,null::text,null::smallint,null::uuid)$$,'legacy exam has no invented context');

-- 2) Bağlam şekli sunucuda doğrulanır.
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>pg_temp.ctx()||'{"extra":1}'))$$,'P0001','invalid_input','unknown context key rejected');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>pg_temp.ctx(track=>'official')))$$,'P0001','invalid_input','unknown track rejected');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>jsonb_set(pg_temp.ctx(),'{term}','3')))$$,'P0001','invalid_input','term must be 1 or 2');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>jsonb_set(pg_temp.ctx(),'{academicYear}','2026.5')))$$,'P0001','invalid_input','academic year must be an integer');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>jsonb_set(pg_temp.ctx(),'{schoolDeclared}','"yes"')))$$,'P0001','invalid_input','school declaration is boolean');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>pg_temp.ctx(period=>'80000000-0000-4000-8000-000000011002')))$$,'42501','forbidden','other family education period cannot be referenced');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content('[]',ctx=>'"mixed"'::jsonb))$$,'P0001','invalid_input','context must be an object');

-- 3) Tek ders seçildi ama iki ders var → gönderilmez; LGS yalnız 8. sınıf.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',0,pg_temp.content(current_setting('test.blocks')::jsonb,ctx=>pg_temp.ctx('subject')))$$,'single-subject context with two subjects can be kept for correction');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',1)$$,'P0001','prova_scope_subject_count','single-subject exam with two subjects blocked');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',1,pg_temp.content(current_setting('test.blocks')::jsonb,ctx=>pg_temp.ctx('mixed','lgs')))$$,'lgs track saved for a 6th grader');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',2)$$,'P0001','prova_track_grade','LGS claim needs 8th grade');

-- 4) Okul değişti (düzeltme) → taslak eski okul beyanıyla gönderilmez; kullanıcı düzeltir.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',2,pg_temp.content(current_setting('test.blocks')::jsonb,ctx=>pg_temp.ctx('mixed','meb_common')))$$,'mixed MEB common written context saved');
reset role;
update gina.child_education_periods set school='Yeni Okul' where id='80000000-0000-4000-8000-000000011001';
set local role authenticated;
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',3)$$,'P0001','prova_child_period_changed','school changed since draft: parent must confirm');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',3,pg_temp.content(current_setting('test.blocks')::jsonb,ctx=>pg_temp.ctx('mixed','meb_common',school=>'Yeni Okul')))$$,'parent re-confirms the new school');
-- Yeni dönem (nakil): eski periodId artık güncel değil.
reset role;
update gina.child_education_periods set ends_on=date '2026-11-01' where id='80000000-0000-4000-8000-000000011001';
insert into gina.child_education_periods(id,child_id,family_id,academic_year,grade,school,starts_on,reason) values
 ('80000000-0000-4000-8000-000000011003','20000000-0000-4000-8000-000000011001','10000000-0000-4000-8000-000000011001',2026,6,'Yeni Okul',date '2026-11-01','transfer');
set local role authenticated;
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',4)$$,'P0001','prova_child_period_changed','transfer since draft: parent must confirm');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011002',4,pg_temp.content(current_setting('test.blocks')::jsonb,ctx=>pg_temp.ctx('mixed','meb_common','80000000-0000-4000-8000-000000011003','Yeni Okul')))$$,'parent re-confirms the current period');
select lives_ok($$select public.submit_prova_draft('70000000-0000-4000-8000-000000011002','50000000-0000-4000-8000-000000011002',5)$$,'context exam assigned');
select results_eq($$select exam_scope,assessment_track,term::int,academic_year,education_period_id,school_declared,preparation->'context'->>'school' from public.exams where id='50000000-0000-4000-8000-000000011002'$$,
 $$values ('mixed'::text,'meb_common'::text,1,2026,'80000000-0000-4000-8000-000000011003'::uuid,false,'Yeni Okul'::text)$$,'term/school context carried into exam columns');
select throws_ok($$update public.exams set term=2 where id='50000000-0000-4000-8000-000000011002'$$,'P0001','exam_content_locked','assigned exam context frozen');

-- 5) Alternatif cevap + rubrik (veli sorusu).
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000011010','{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"3/6 kesrini sadeleştir.","expected_answer":"1/2","solution":"3 ile böl.","rubric":{"criteria":[{"text":"Ortak böleni bulur","points":40},{"text":"Sonucu doğru yazar","points":60}],"alternative_answers":["0,5","yarım"]}}','[]')$$,'open question with alternatives and rubric saved');
select is((select provenance->'rubric'->'alternative_answers' from public.question_bank where id='40000000-0000-4000-8000-000000011010'),'["0,5","yarım"]'::jsonb,'alternatives stored');
select is((select jsonb_array_length(provenance->'rubric'->'criteria') from public.question_bank where id='40000000-0000-4000-8000-000000011010'),2,'rubric criteria stored');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000011011','{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"2/4 kesrini sadeleştir.","expected_answer":"1/2","rubric":{"criteria":[],"alternative_answers":[]}}','[]')$$,'empty rubric accepted');
select ok((select not(provenance ? 'rubric') from public.question_bank where id='40000000-0000-4000-8000-000000011011'),'empty rubric stored as none');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000011012','{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"4/8 kesrini sadeleştir.","expected_answer":"1/2"}','[]')$$,'question without rubric unchanged');
select is((select provenance from public.question_bank where id='40000000-0000-4000-8000-000000011012'),'{"generator":"parent"}'::jsonb,'legacy provenance shape kept');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"5/10 kesrini sadeleştir.","expected_answer":"1/2","rubric":{"criteria":[{"text":"x","points":80},{"text":"y","points":40}],"alternative_answers":[]}}','[]')$$,'P0001','question_rubric_invalid','rubric points cannot exceed 100');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"6/12 kesrini sadeleştir.","expected_answer":"1/2","rubric":{"criteria":[],"alternative_answers":[""]}}','[]')$$,'P0001','question_rubric_invalid','blank alternative rejected');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"multiple_choice","difficulty":"orta","stem":"Hangisi yarım?","choices":[{"key":"A","text":"1/2"},{"key":"B","text":"1/3"},{"key":"C","text":"1/4"},{"key":"D","text":"1/5"}],"correct_key":"A","rubric":{"criteria":[],"alternative_answers":["A"]}}','[]')$$,'P0001','question_rubric_invalid','rubric only for open-ended');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Matematik","topic":"Kesirler","kind":"open_ended","difficulty":"orta","stem":"7/14 kesrini sadeleştir.","expected_answer":"1/2","rubric":{"criteria":[],"alternative_answers":[],"secret":1}}','[]')$$,'P0001','question_rubric_invalid','unknown rubric key rejected');

-- 6) Rubrikli soruyla sınav; atanmış sürüm düzenlemeden etkilenmez; çocuk anahtar alamaz.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011003',0,pg_temp.content('[{"kind":"question","id":"40000000-0000-4000-8000-000000011010","source":"manual"}]','["Matematik"]',pg_temp.ctx('subject','free','80000000-0000-4000-8000-000000011003','Yeni Okul'),1))$$,'single-subject draft with rubric question');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011003',1)$$,'single-subject exam assigned');
select throws_ok($$update public.question_bank set provenance=jsonb_set(provenance,'{rubric,alternative_answers}','["her şey"]') where id='40000000-0000-4000-8000-000000011010'$$,'P0001','question_in_use','assigned rubric frozen');
select throws_ok($$update public.question_bank set expected_answer='2/4' where id='40000000-0000-4000-8000-000000011010'$$,'P0001','question_in_use','assigned answer key frozen');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011003","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000011001","role":"device","device_id":"30000000-0000-4000-8000-000000011001","child_id":"20000000-0000-4000-8000-000000011001"}}',true);
select is((select count(*)::int from public.get_attempt_questions('50000000-0000-4000-8000-000000011003')),1,'device sees the assigned question');
select ok(not exists(select 1 from public.get_attempt_questions('50000000-0000-4000-8000-000000011003') q where to_jsonb(q) ?| array['expected_answer','solution','correct_key','provenance','explanation']),'device question payload has no answer key, rubric or explanation');
select ok(not exists(select 1 from public.get_attempt_questions('50000000-0000-4000-8000-000000011002') q where q.choices::text like '%correct%' or q.choices::text like '%why%'),'device choices carry only key/text');
select is((select count(*)::int from public.question_bank where id in('40000000-0000-4000-8000-000000011010','40000000-0000-4000-8000-000000011001')),0,'device cannot read family question rows (answer key)');
select is(public.get_prova_drafts(null),'[]'::jsonb,'device cannot read drafts');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000011004',0,pg_temp.content('[]'))$$,'42501','forbidden','device cannot save drafts');

-- 7) Başka aile taslağı/sınav bağlamını göremez.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011002","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000011002","role":"parent"}}',true);
select is((select count(*)::int from public.exams where id='50000000-0000-4000-8000-000000011002'),0,'other family cannot read exam context');
select is((select count(*)::int from public.question_bank where id='40000000-0000-4000-8000-000000011010'),0,'other family cannot read rubric');
reset role;
select ok(not has_function_privilege('authenticated','gina.validate_prova_context(uuid,jsonb)','EXECUTE'),'context validator internal');
select ok(not has_function_privilege('authenticated','gina.valid_question_rubric(jsonb)','EXECUTE'),'rubric validator internal');
select * from finish();
rollback;
