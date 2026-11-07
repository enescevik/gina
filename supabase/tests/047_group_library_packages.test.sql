begin;
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000004301','editor43@test.invalid'),('00000000-0000-4000-8000-000000004302','parent43@test.invalid'),('00000000-0000-4000-8000-000000004303','other43@test.invalid');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000004301');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000004302','Test family','00000000-0000-4000-8000-000000004302');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000004302','00000000-0000-4000-8000-000000004302');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000004303','Other test family','00000000-0000-4000-8000-000000004303');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000004303','00000000-0000-4000-8000-000000004303');
create temp table state(id uuid, result jsonb,request uuid default gen_random_uuid());grant all on state to authenticated,service_role;
create function pg_temp.bundle() returns jsonb language sql as $fn$ select $fixture${"schema": "gina.library-import.v1", "package_key": "test-library-intake", "revision": 1, "previous_hash": null, "title": "Test import package", "grade": 5, "subject": "Matematik", "provenance": {"locale": "tr", "curriculum_reference": {"programme_url": "https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3", "programme_page_updated": "2026-09-04", "checked_on": "2026-11-03", "distribution_index": "https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724", "candidate_scenario_id": "tr-2026-2027-t1-ilkmat2-g5-d6", "candidate_source_sha256": "d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf", "mapping_status": "proposed_pending_subject_review"}, "programme_version": "2026-09-04 web programme; implementation/school applicability pending review", "school_track_applicability": "pending_review", "assessment_notes": ["20 items form a pool, not a 20-question compulsory session or an official school exam.", "Questions sharing a source are related observations; do not count them as independent evidence of mastery.", "All difficulty labels are estimates; no empirical calibration or official approval.", "Schematic drawing/description does not certify compass, ruler or protractor manipulation.", "Do not grade drawing neatness, motor control, gender, handwriting style or response speed."], "private_note": "PRIVATE_PROVENANCE_SECRET"}, "assets": [{"key": "segments", "mime": "image/png", "sha256": "890c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8", "width": 1, "height": 1, "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcHAAAAGEAMGDX2mUAAAAAElFTkSuQmCC"}], "sources": [{"key": "segments", "title": "İki çizim", "body": "A ve B arasında iki ucu noktayla gösterilmiş bir çizim; C noktasından başlayıp D üzerinden sağa doğru devam eden, ucunda ok bulunan başka bir çizim var.", "alt": "AB çiziminde iki uç nokta var. CD çiziminde başlangıç C; D üzerinden sağa uzanan ok var.", "asset_key": "segments", "minimum_reading_width": 0, "provenance": {"origin": "original_gina_mathematical_diagram", "svg_sha256": "a7465f14b876c2ac11a84384c0082f5d16d5fee29cd75b927b8b3c2a1882709b", "color_space": "sRGB"}}], "questions": [{"key": "question-1", "revision": 1, "source_key": "segments", "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "multiple_choice", "difficulty": "kolay", "stem": "Test question 1", "choices": [{"key": "A", "text": "A seçeneği"}, {"key": "B", "text": "B seçeneği"}, {"key": "C", "text": "C seçeneği"}, {"key": "D", "text": "D seçeneği"}]}, "teacher": {"correct_key": "A", "expected_answer": "PRIVATE_EXPECTED", "solution": "PRIVATE_SOLUTION", "explanation": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "AB’yi doğru parçası olarak adlandırır."}, {"id": "c2", "points": 1, "criterion": "CD’yi ışın olarak adlandırır."}, {"id": "c3", "points": 1, "criterion": "AB’nin iki uç noktayla sınırlı olduğunu belirtir."}, {"id": "c4", "points": 1, "criterion": "CD’nin C’den başlayıp D yönünde devam ettiğini belirtir."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "Ok ucunu ikinci uç nokta sanmak.", "next_step": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.2", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "reasoning"}, "response": {"mode": "text_or_drawing", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Metin veya anlamı açık etiketli çizim kabul edilir; yazı güzelliği puanlanmaz."}, "evidence_unit": "segments", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical", "private_note": "PRIVATE_METADATA_SECRET"}}, {"key": "question-2", "revision": 1, "source_key": "segments", "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "multiple_choice", "difficulty": "kolay", "stem": "Test question 2", "choices": [{"key": "A", "text": "A seçeneği"}, {"key": "B", "text": "B seçeneği"}, {"key": "C", "text": "C seçeneği"}, {"key": "D", "text": "D seçeneği"}]}, "teacher": {"correct_key": "A", "expected_answer": "PRIVATE_EXPECTED", "solution": "PRIVATE_SOLUTION", "explanation": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "AB’yi doğru parçası olarak adlandırır."}, {"id": "c2", "points": 1, "criterion": "CD’yi ışın olarak adlandırır."}, {"id": "c3", "points": 1, "criterion": "AB’nin iki uç noktayla sınırlı olduğunu belirtir."}, {"id": "c4", "points": 1, "criterion": "CD’nin C’den başlayıp D yönünde devam ettiğini belirtir."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "Ok ucunu ikinci uç nokta sanmak.", "next_step": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.2", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "reasoning"}, "response": {"mode": "text_or_drawing", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Metin veya anlamı açık etiketli çizim kabul edilir; yazı güzelliği puanlanmaz."}, "evidence_unit": "segments", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical", "private_note": "PRIVATE_METADATA_SECRET"}}, {"key": "question-3", "revision": 1, "source_key": "segments", "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "multiple_choice", "difficulty": "kolay", "stem": "Test question 3", "choices": [{"key": "A", "text": "A seçeneği"}, {"key": "B", "text": "B seçeneği"}, {"key": "C", "text": "C seçeneği"}, {"key": "D", "text": "D seçeneği"}]}, "teacher": {"correct_key": "A", "expected_answer": "PRIVATE_EXPECTED", "solution": "PRIVATE_SOLUTION", "explanation": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "AB’yi doğru parçası olarak adlandırır."}, {"id": "c2", "points": 1, "criterion": "CD’yi ışın olarak adlandırır."}, {"id": "c3", "points": 1, "criterion": "AB’nin iki uç noktayla sınırlı olduğunu belirtir."}, {"id": "c4", "points": 1, "criterion": "CD’nin C’den başlayıp D yönünde devam ettiğini belirtir."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "Ok ucunu ikinci uç nokta sanmak.", "next_step": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.2", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "reasoning"}, "response": {"mode": "text_or_drawing", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Metin veya anlamı açık etiketli çizim kabul edilir; yazı güzelliği puanlanmaz."}, "evidence_unit": "segments", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical", "private_note": "PRIVATE_METADATA_SECRET"}}, {"key": "question-4", "revision": 1, "source_key": null, "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "multiple_choice", "difficulty": "kolay", "stem": "Test question 4", "choices": [{"key": "A", "text": "A seçeneği"}, {"key": "B", "text": "B seçeneği"}, {"key": "C", "text": "C seçeneği"}, {"key": "D", "text": "D seçeneği"}]}, "teacher": {"correct_key": "A", "expected_answer": "PRIVATE_EXPECTED", "solution": "PRIVATE_SOLUTION", "explanation": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "AB’yi doğru parçası olarak adlandırır."}, {"id": "c2", "points": 1, "criterion": "CD’yi ışın olarak adlandırır."}, {"id": "c3", "points": 1, "criterion": "AB’nin iki uç noktayla sınırlı olduğunu belirtir."}, {"id": "c4", "points": 1, "criterion": "CD’nin C’den başlayıp D yönünde devam ettiğini belirtir."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "Ok ucunu ikinci uç nokta sanmak.", "next_step": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.2", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "reasoning"}, "response": {"mode": "text_or_drawing", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Metin veya anlamı açık etiketli çizim kabul edilir; yazı güzelliği puanlanmaz."}, "evidence_unit": "segments", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical", "private_note": "PRIVATE_METADATA_SECRET"}}]}$fixture$::jsonb; $fn$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
insert into state(id) select (public.admin_import_library_bundle(gen_random_uuid(),pg_temp.bundle())->>'id')::uuid;
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'question-1',1,0,'suitable','Synthetic test only');
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'question-2',1,0,'suitable','Synthetic test only');
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'question-3',1,0,'suitable','Synthetic test only');
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'question-4',1,0,'suitable','Synthetic test only');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_library_delivery_media('00000000-0000-4000-8000-000000004301',(select id from state),jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{assets,0,sha256}','base64',pg_temp.bundle()#>>'{assets,0,base64}')));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),0,public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Test geometry','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');

create function pg_temp.make_group(g uuid default '60000000-0000-4000-8000-000000004701',units text[] default array['source:segments','question:question-4'],v int default 1,plans public.plan_code[] default array['free']::public.plan_code[]) returns uuid language sql as $$select public.admin_create_package_group_exam(g,(select id from state),v,'Test cohort',units,now()-interval '1 hour',now()+interval '1 hour',20,plans);$$;
select is(public.admin_group_package_catalog()#>>'{0,units,0,count}','3','shared context is a single three-question unit');
select ok(public.admin_group_package_catalog()::text not like '%PRIVATE_SOLUTION%','catalog excludes answer key');
select throws_ok($$select pg_temp.make_group(v=>2)$$,'P0001','library_publication_changed','stale publication rejected');
select throws_ok($$select pg_temp.make_group(plans=>array['pro']::public.plan_code[])$$,'P0001','group_package_plans','cannot widen package access');
select throws_ok($$select pg_temp.make_group(units=>array['question:question-1','question:question-2','question:question-3'])$$,'P0001','group_questions_required','cannot split shared source by selecting members');
select lives_ok($$select pg_temp.make_group()$$,'published package freezes cohort');
select is(pg_temp.make_group()::text,'60000000-0000-4000-8000-000000004701','same creation replays after response loss');
select throws_ok($$select pg_temp.make_group(units=>array['source:segments'])$$,'P0001','request_conflict','same ID cannot change selected units');
savepoint mixed_package;
update state set id=(public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"test-cohort-open"'),'{questions,3,student,kind}','"open_ended"'),'{questions,3,student,choices}','[]'),'{questions,3,teacher,correct_key}','null'))->>'id')::uuid;
select public.admin_review_library_question(gen_random_uuid(),(select id from state),key,1,0,'suitable','Synthetic test only') from unnest(array['question-1','question-2','question-3','question-4'])key;
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),0,public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Mixed test','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');
select throws_ok($$select pg_temp.make_group(gen_random_uuid())$$,'P0001','group_questions_required','open-ended question cannot enter automatic ranking');
rollback to mixed_package;
reset role;
select is((select count(*)::int from public.group_exam_questions),4,'all selected questions frozen');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000004702','10000000-0000-4000-8000-000000004302','Child',5),('20000000-0000-4000-8000-000000004703','10000000-0000-4000-8000-000000004303','Other child',5);
update public.plans set cohort_monthly=5,prova_monthly_exams=null,library_monthly=0 where code='free';
update public.app_settings set value='true' where key in('cohorts.enabled','sources.enabled','question_groups.enabled');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004302","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
savepoint automatic_daily;
reset role;
update public.plans set library_monthly=5 where code='free';
update public.app_settings set value='true' where key='library_packages.enabled';
set local role authenticated;
select public.acquire_library_units(gen_random_uuid(),(select id from state),1,array['question:question-4']);
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004702'),null::jsonb,'without a signal there is no automatic offer');
select set_config('test.auto_q',(select id::text from public.question_bank where family_id=gina.family_id()),true);
select public.set_question_focus('20000000-0000-4000-8000-000000004702',current_setting('test.auto_q')::uuid,true);
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004702'),'{"automatic":true}'::jsonb,'an active parent focus makes an acquired question eligible');
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004703'),null::jsonb,'cannot see another family offer');
reset role;
select is((select count(*) from gina.daily_practice_slots),0::bigint,'preview does not create any slot');
set local role authenticated;
select public.set_question_focus('20000000-0000-4000-8000-000000004702',current_setting('test.auto_q')::uuid,false);
reset role;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind)
 values('60000000-0000-4000-8000-000000004720','10000000-0000-4000-8000-000000004302',
 '20000000-0000-4000-8000-000000004702','Earlier practice','Matematik',5,array[current_setting('test.auto_q')::uuid],'completed','level_test');
insert into public.exam_attempts(id,family_id,child_id,exam_id,status,finished_at)
 values('60000000-0000-4000-8000-000000004721','10000000-0000-4000-8000-000000004302',
 '20000000-0000-4000-8000-000000004702','60000000-0000-4000-8000-000000004720','graded',now());
insert into public.question_child_signals(family_id,attempt_id,question_id,liked)
 values('10000000-0000-4000-8000-000000004302','60000000-0000-4000-8000-000000004721',current_setting('test.auto_q')::uuid,true);
set local role authenticated;
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004702'),'{"automatic":true}'::jsonb,'a child like also selects an acquired question');
reset role;
savepoint quiet_daily;
with wall as (select extract(hour from now() at time zone f.timezone)::int*60
  + extract(minute from now() at time zone f.timezone)::int as minute_of_day from public.families f where id='10000000-0000-4000-8000-000000004302')
update public.children set evening_reminder_start=wall.minute_of_day,evening_reminder_end=(wall.minute_of_day+60)%1440
 from wall where id='20000000-0000-4000-8000-000000004702';
set local role authenticated;
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004702'),null::jsonb,'quiet hours suppress the automatic offer');
select is(public.open_daily_practice('20000000-0000-4000-8000-000000004702'),null::uuid,'quiet hours also prevent direct open');
rollback to quiet_daily;
set local role authenticated;
select set_config('test.auto_exam',public.open_daily_practice('20000000-0000-4000-8000-000000004702')::text,true);
select ok(current_setting('test.auto_exam')<>'' ,'opening creates the selected exam');
select is(public.open_daily_practice('20000000-0000-4000-8000-000000004702')::text,current_setting('test.auto_exam'),'retries reuse today’s assignment');
reset role;
select is((select question_ids[1]::text from public.exams where id=current_setting('test.auto_exam')::uuid),current_setting('test.auto_q'),'assignment contains the acquired question');
select is((select count(*) from public.push_outbox where payload->>'exam_id'=current_setting('test.auto_exam')),0::bigint,'automatic invitation sends no push');
select is((select count(*) from gina.library_acquisition_charges),1::bigint,'opening creates no additional library charge');
insert into public.exam_attempts(id,family_id,child_id,exam_id)
 values('60000000-0000-4000-8000-000000004722','10000000-0000-4000-8000-000000004302',
 '20000000-0000-4000-8000-000000004702',current_setting('test.auto_exam')::uuid);
insert into public.exam_answers(attempt_id,question_id,answer_key)
 values('60000000-0000-4000-8000-000000004722',current_setting('test.auto_q')::uuid,'A');
update public.exam_attempts set status='submitted',finished_at=now() where id='60000000-0000-4000-8000-000000004722';
select is((select count(*) from public.child_badge_awards where child_id='20000000-0000-4000-8000-000000004702'
 and badge_slug='daily-practice-first'),1::bigint,'automatic completion uses the same single badge');
set local role authenticated;
select is(public.daily_practice_offer('20000000-0000-4000-8000-000000004702'),null::jsonb,'completion suppresses any second offer today');
reset role;
rollback to automatic_daily;
set local role authenticated;
select throws_ok($$select public.admin_group_package_catalog()$$,'42501','forbidden','parent cannot read operator catalog');
reset role;update public.app_settings set value='false' where key='sources.enabled';set local role authenticated;
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702',false,true)$$,'P0001','source_not_ready','media rollout gate rejects new enrollment');
reset role;
select is((select count(*)::int from public.question_source_groups),0,'failed media gate rolls back context');
select is((select count(*)::int from public.question_bank),0,'failed media gate creates no questions');
update public.app_settings set value='true' where key='sources.enabled';set local role authenticated;
select set_config('test.exam',public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702',false,true)::text,true);
select is(public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702',false,true)::text,current_setting('test.exam'),'enrollment replay returns original exam');
select is((select count(*)::int from public.question_source_members),3,'shared source membership preserved');
select is((select count(*)::int from public.question_bank),4,'no duplicate question copies');
reset role;
select is((select count(*)::int from public.learning_source_links),3,'one image attached to each source member');
select is((select count(*)::int from public.learning_sources),1,'shared image stored only once per enrollment');
select is((select count(*)::int from public.question_source_groups where finalized_at is not null),1,'context finalized');
select ok((select bool_and(stem like 'İki çizim%') from public.question_bank where id in (select question_id from public.question_source_members)),'source text present in question fallback');
set local role authenticated;
select is((public.get_group_exams()->>'used')::int,1,'one cohort use');
reset role;
select is((select count(*)::int from gina.library_acquisition_charges),0,'cohort copy does not charge library quota');
select is((select count(*)::int from gina.library_source_copies),1,'existing canonical media delivery reused');
select throws_ok($$delete from public.learning_sources where id=(select source_id from gina.library_source_copies limit 1)$$,'P0001','library_copy_immutable','required image cannot be removed');
select throws_ok($$insert into public.learning_source_links(source_id,question_id) select (select source_id from gina.library_source_copies limit 1),id from public.question_bank where stem='Test question 4'$$,'P0001','question_in_use','cannot add media after cohort publication');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.read_library_source_bytes((select source_id from gina.library_source_copies limit 1))->>'sha256',(select sha256 from public.learning_sources limit 1),'canonical image bytes remain readable');
-- Paired child receives student context and media, never teacher content.
reset role;
insert into auth.users(id) values('00000000-0000-4000-8000-000000004704');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('30000000-0000-4000-8000-000000004704','10000000-0000-4000-8000-000000004302','00000000-0000-4000-8000-000000004704','20000000-0000-4000-8000-000000004702');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004704","role":"authenticated","gina":{"role":"device","family_id":"10000000-0000-4000-8000-000000004302","device_id":"30000000-0000-4000-8000-000000004704","child_id":"20000000-0000-4000-8000-000000004702"}}',true);
select is(jsonb_array_length(public.get_question_context((select question_ids from public.exams where id=current_setting('test.exam')::uuid))),3,'child can see common context for three questions');
select is(jsonb_array_length(public.get_question_media((select question_ids from public.exams where id=current_setting('test.exam')::uuid))),3,'child can resolve image links');
select ok(public.get_question_context((select question_ids from public.exams where id=current_setting('test.exam')::uuid))::text not like '%PRIVATE_%','child context has no teacher or metadata leakage');
select throws_ok($$select * from public.group_exam_questions$$,'42501',null,'child cannot query frozen answer snapshots');
select set_config('test.attempt',(public.start_exam_attempt(current_setting('test.exam')::uuid)).id::text,true);
select lives_ok($$select public.submit_exam_answer(current_setting('test.attempt')::uuid,(select question_ids[1] from public.exams where id=current_setting('test.exam')::uuid),'A')$$,'child can answer shared question');
select lives_ok($$select public.finish_exam_attempt(current_setting('test.attempt')::uuid)$$,'child can finish media cohort');
reset role;
select is((select count(*)::int from public.exam_answers where is_correct=true),1,'frozen answer key grades shared question');
savepoint review_changed;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'question-1',1,1,'changes_requested','Correction needed');
select is(jsonb_array_length(public.admin_group_package_catalog()),0,'invalidated publication disappears from operator choices');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004303","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004303"}}',true);
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004703',false,true)$$,'P0001','group_package_unavailable','review withdrawal stops new admission even before archiving');
rollback to review_changed;
-- Withdraw the source after enrollment: existing assigned copies stay intact; new families cannot enroll.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),1,public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Test geometry','Test',array['free']::public.plan_code[],'Test curriculum',true,'archived','Test withdrawal');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004303","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004303"}}',true);
select throws_ok($$select public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004703',false,true)$$,'P0001','group_package_unavailable','withdrawn package prevents new enrollment');
select is(jsonb_array_length(public.get_group_exams()->'entries'),0,'failed enrollment leaves no entry');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004302","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
select is(public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702',false,true)::text,current_setting('test.exam'),'existing enrollment recovers after withdrawal');
reset role;
-- A mixed cohort preserves a structured question with its source and private key.
savepoint structured_cohort;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
update state set id=(public.admin_import_library_bundle(gen_random_uuid(),
 jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.bundle(),
 '{package_key}','"test-cohort-typed"'),'{questions,0,student,kind}','"open_ended"'),
 '{questions,0,student,choices}','[]'),'{questions,0,teacher,correct_key}','null'),'{questions,0,metadata,interaction}',
 '{"type":"true_false","schema_version":1,"payload":{"statements":[{"id":"a","text":"First"},{"id":"b","text":"Second"}]},"answer_key":{"answers":{"a":true,"b":false}}}'))->>'id')::uuid;
select public.admin_review_library_question(gen_random_uuid(),(select id from state),key,1,0,'suitable','Synthetic test only')
 from unnest(array['question-1','question-2','question-3','question-4'])key;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_library_delivery_media('00000000-0000-4000-8000-000000004301',(select id from state),
 jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{assets,0,sha256}','base64',pg_temp.bundle()#>>'{assets,0,base64}')));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),0,
 public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Typed cohort','Test',
 array['free']::public.plan_code[],'Test curriculum',true,'published');
select is(public.admin_group_package_catalog()#>>'{0,units,0,eligible}','true','structured common source remains eligible for automatic scoring');
select ok(public.admin_group_package_catalog()::text not like '%answer_key%','typed catalog never exposes the key');
select lives_ok($$select pg_temp.make_group('60000000-0000-4000-8000-000000004711')$$,'mixed cohort creation freezes the private interaction');
reset role;
select is((select content#>>'{interaction,answer_key,answers,b}' from public.group_exam_questions
 where group_id='60000000-0000-4000-8000-000000004711' and ord=1),'false','frozen snapshot stores the original key');
select is((select content#>>'{interaction,policy}' from public.group_exam_questions
 where group_id='60000000-0000-4000-8000-000000004711' and ord=1),'per_item','frozen snapshot stores scoring policy');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004302","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
select set_config('test.typed_exam',public.enroll_group_exam('60000000-0000-4000-8000-000000004711','20000000-0000-4000-8000-000000004702',true,true)::text,true);
reset role;
select lives_ok($$set constraints all immediate$$,'frozen typed question and its private key satisfy the content hash');
select is((select count(*)::int from gina.exam_item_bindings where exam_id=current_setting('test.typed_exam')::uuid),4,'all assigned items are bound to immutable hashes');
select throws_ok($$update public.question_answer_keys set key='{"answers":{"a":false,"b":false}}'
 where question_id=(select question_ids[1] from public.exams where id=current_setting('test.typed_exam')::uuid)$$,
 'P0001','question_in_use','assigned key cannot be changed');
-- Withdrawing the immutable source revision does not invalidate the assigned snapshot.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),1,
 public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Typed cohort','Test',
 array['free']::public.plan_code[],'Test curriculum',true,'archived','Test withdrawal');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004704","role":"authenticated","gina":{"role":"device","family_id":"10000000-0000-4000-8000-000000004302","device_id":"30000000-0000-4000-8000-000000004704","child_id":"20000000-0000-4000-8000-000000004702"}}',true);
select set_config('test.typed_question',(select question_ids[1]::text from public.exams where id=current_setting('test.typed_exam')::uuid),true);
select is(public.get_question_answer_keys(array[current_setting('test.typed_question')::uuid]),'[]'::jsonb,'paired child cannot retrieve typed answer keys');
select set_config('test.typed_attempt',(public.start_exam_attempt(current_setting('test.typed_exam')::uuid)).id::text,true);
select is(public.submit_exam_answer_v4(gen_random_uuid(),current_setting('test.typed_attempt')::uuid,current_setting('test.typed_question')::uuid,
 0,null,null,null,'{"type":"true_false","v":1,"items":{"a":true}}'),1,'child can submit a partial structured answer');
-- The scheduled settlement uses the same submitted-status scoring trigger.
savepoint typed_settlement;
reset role;
update public.group_exams set status='cancelled' where id='60000000-0000-4000-8000-000000004711';
select is(public.settle_group_attempts(),1,'settlement submits the open typed attempt');
select is((select score_exact from public.exam_answers where attempt_id=current_setting('test.typed_attempt')::uuid),
 50::numeric,'settlement also records fractional credit');
rollback to typed_settlement;
select lives_ok($$select public.finish_exam_attempt(current_setting('test.typed_attempt')::uuid)$$,'child can finish a typed cohort');
reset role;
select is((select score_exact from public.exam_answers where attempt_id=current_setting('test.typed_attempt')::uuid
 and question_id=current_setting('test.typed_question')::uuid),50::numeric,'shared scorer preserves partial credit');
select throws_ok($$update public.exam_answers set graded_by='parent',score=100 where attempt_id=current_setting('test.typed_attempt')::uuid
 and question_id=current_setting('test.typed_question')::uuid$$,'P0001','group_review_automatic','parent grade cannot replace shared partial credit');
update public.group_exams set ends_at=now()-interval '1 minute' where id in('60000000-0000-4000-8000-000000004711','60000000-0000-4000-8000-000000004701');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004302","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
select is((public.get_group_result('60000000-0000-4000-8000-000000004711','20000000-0000-4000-8000-000000004702')->>'points')::numeric,0.5::numeric,'fractional credit reaches family result');
select is((public.get_group_result('60000000-0000-4000-8000-000000004711','20000000-0000-4000-8000-000000004702')#>>'{ranking,0,points}')::numeric,0.5::numeric,'ranking uses the same fractional credit');
select is(public.get_group_result('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702')->>'correct','1','legacy cohort retains its original whole answer count');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004303","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004303"}}',true);
select throws_ok($$select public.get_group_result('60000000-0000-4000-8000-000000004711','20000000-0000-4000-8000-000000004702')$$,'P0001','not_found','another family cannot read the typed result');
rollback to structured_cohort;
delete from public.families where id='10000000-0000-4000-8000-000000004302';
select is((select count(*)::int from gina.library_source_copies),0,'family deletion cleans cohort image copies');
select is((select count(*)::int from public.question_source_groups),0,'family deletion cleans shared context');
select is((select count(*)::int from public.source_deletion_queue where object_path like 'library/%'),0,'no phantom object deletion');
select * from finish();rollback;
