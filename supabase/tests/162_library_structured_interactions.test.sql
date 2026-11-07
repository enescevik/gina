begin;
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000004301','editor43@test.invalid'),('00000000-0000-4000-8000-000000004302','parent43@test.invalid'),('00000000-0000-4000-8000-000000004303','other43@test.invalid');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000004301');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000004302','Test family','00000000-0000-4000-8000-000000004302');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000004302','00000000-0000-4000-8000-000000004302');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000004303','Other test family','00000000-0000-4000-8000-000000004303');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000004303','00000000-0000-4000-8000-000000004303');
create temp table state(id uuid, result jsonb,request uuid default gen_random_uuid());grant all on state to authenticated,service_role;
create function pg_temp.legacy_bundle() returns jsonb language sql as $fn$ select $fixture${"schema": "gina.library-import.v1", "package_key": "test-library-intake", "revision": 1, "previous_hash": null, "title": "Test import package", "grade": 5, "subject": "Matematik", "provenance": {"locale": "tr", "curriculum_reference": {"programme_url": "https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3", "programme_page_updated": "2026-09-04", "checked_on": "2026-11-03", "distribution_index": "https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724", "candidate_scenario_id": "tr-2026-2027-t1-ilkmat2-g5-d6", "candidate_source_sha256": "d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf", "mapping_status": "proposed_pending_subject_review"}, "programme_version": "2026-09-04 web programme; implementation/school applicability pending review", "school_track_applicability": "pending_review", "assessment_notes": ["20 items form a pool, not a 20-question compulsory session or an official school exam.", "Questions sharing a source are related observations; do not count them as independent evidence of mastery.", "All difficulty labels are estimates; no empirical calibration or official approval.", "Schematic drawing/description does not certify compass, ruler or protractor manipulation.", "Do not grade drawing neatness, motor control, gender, handwriting style or response speed."], "private_note": "PRIVATE_PROVENANCE_SECRET"}, "assets": [{"key": "segments", "mime": "image/png", "sha256": "890c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8", "width": 1, "height": 1, "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcHAAAAGEAMGDX2mUAAAAAElFTkSuQmCC"}], "sources": [{"key": "segments", "title": "İki çizim", "body": "A ve B arasında iki ucu noktayla gösterilmiş bir çizim; C noktasından başlayıp D üzerinden sağa doğru devam eden, ucunda ok bulunan başka bir çizim var.", "alt": "AB çiziminde iki uç nokta var. CD çiziminde başlangıç C; D üzerinden sağa uzanan ok var.", "asset_key": "segments", "minimum_reading_width": 0, "provenance": {"origin": "original_gina_mathematical_diagram", "svg_sha256": "a7465f14b876c2ac11a84384c0082f5d16d5fee29cd75b927b8b3c2a1882709b", "color_space": "sRGB"}}], "questions": [{"key": "gina-g5-math-geometry-01", "revision": 1, "source_key": "segments", "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "open_ended", "difficulty": "kolay", "stem": "AB ve CD çizimlerinin geometrik adlarını yaz. Uç noktaları ve devam yönleri bakımından aralarındaki farkı açıkla.", "choices": []}, "teacher": {"correct_key": null, "expected_answer": "TEACHER_ANSWER_SECRET", "solution": "İki uçta nokta bulunan AB sınırlıdır. CD’de başlangıç C ve devamı gösteren bir ok vardır.", "explanation": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "AB’yi doğru parçası olarak adlandırır."}, {"id": "c2", "points": 1, "criterion": "CD’yi ışın olarak adlandırır."}, {"id": "c3", "points": 1, "criterion": "AB’nin iki uç noktayla sınırlı olduğunu belirtir."}, {"id": "c4", "points": 1, "criterion": "CD’nin C’den başlayıp D yönünde devam ettiğini belirtir."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "Ok ucunu ikinci uç nokta sanmak.", "next_step": "Nokta ile ok işaretlerini karşılaştır; bir çizimin devam edip etmediğine onlar karar verir."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.2", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "reasoning"}, "response": {"mode": "text_or_drawing", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Metin veya anlamı açık etiketli çizim kabul edilir; yazı güzelliği puanlanmaz."}, "evidence_unit": "segments", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical", "private_note": "PRIVATE_METADATA_SECRET"}}, {"key": "gina-g5-math-geometry-02", "revision": 1, "source_key": "segments", "student": {"grade": 5, "subject": "Matematik", "topic": "Geometrik şekiller", "kind": "open_ended", "difficulty": "orta", "stem": "Defterinde E ve F adlı iki farklı nokta göster. E’den başlayıp F yönünde devam eden bir ışını şematik çiz veya nasıl çizileceğini tarif et. Düz çizgiyi oluşturmak için hangi aracı seçerdin? Neden?", "choices": []}, "teacher": {"correct_key": null, "expected_answer": "E başlangıçtır; çizgi F’den geçer ve F yönünde bir okla devam eder. Düz çizgi için cetvel/çizgeç veya dijital ışın aracı seçilir.", "solution": "E ve F işaretlenir. Cetvel iki noktaya hizalanır. E’den başlayıp F’den geçen çizgi F yönüne uzatılır; devam yönü okla gösterilir.", "explanation": "Işının başlangıcını ve devam yönünü ayrı işaretle. Ekranda kusursuz düz çizmek gerekmiyor.", "rubric": {"max_points": 4, "scoring": "Her ölçüt ayrı değerlendirilir. Listelenen alt koşullar tamamlanınca o ölçütün puanı verilir; diğer ölçütler bundan bağımsızdır. Eşdeğer gerekçe ve gösterimler kabul edilir.", "criteria": [{"id": "c1", "points": 1, "criterion": "E başlangıç noktasını doğru belirler."}, {"id": "c2", "points": 1, "criterion": "Çizgi veya tarif F’den geçer."}, {"id": "c3", "points": 1, "criterion": "Devam yönünü F yönündeki okla veya eşdeğer sözle gösterir."}, {"id": "c4", "points": 1, "criterion": "Cetvel/çizgeç/dijital ışın aracını düz çizgi oluşturma gerekçesiyle seçer."}], "missing_answer": "not_answered; eksik öğrenme veya sıfır yeterlilik sonucu çıkarma", "review_required": true}, "common_misconception": "E’nin gerisine de ok ekleyerek ışını doğruya çevirmek.", "next_step": "Işının başlangıcını ve devam yönünü ayrı işaretle. Ekranda kusursuz düz çizmek gerekmiyor."}, "metadata": {"curriculum": {"candidate_code": "MAT.5.3.1", "mapping_status": "proposed_pending_subject_review", "evidence_scope": "tool_selection_and_schematic_representation_not_instrument_performance"}, "response": {"mode": "drawing_or_description", "precise_screen_measurement_required": false, "required_tools": [], "accommodation": "Kalem zorunlu değildir. Çizim istenen soruda şeklin uçlarını, ok yönünü ve bağlantılarını yazıyla açıkça tarif etmek de kabul edilir. Bu alternatif gerçek araç kullanma becerisi kanıtı sayılmaz."}, "evidence_unit": "question-02", "depends_on_question_ids": [], "provenance": {"authoring": "Codex-authored original draft, not copied from an exam", "created_on": "2026-11-03", "paid_provider_call": false}, "difficulty_calibration": "editorial_estimate_not_empirical"}}]}$fixture$::jsonb; $fn$;
create function pg_temp.bundle() returns jsonb language sql as $$
 select jsonb_set(jsonb_set(pg_temp.legacy_bundle(),'{questions,0,metadata,interaction}',
 '{"type":"true_false","schema_version":1,"payload":{"statements":[{"id":"a","text":"AB iki uçla sınırlıdır."},{"id":"b","text":"CD her iki yönde sonsuza gider."}]},"answer_key":{"answers":{"a":true,"b":false}}}'::jsonb),'{questions,1,metadata,interaction}',
 '{"type":"numeric","schema_version":1,"payload":{"units":[],"unit_required":false},"answer_key":{"value":"4"}}'::jsonb);
$$;
create function pg_temp.legacy_prereview_source(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin
 if p_kind='library_package' then
  select jsonb_build_object('kind','library_package','id',p.id,'package_key',p.package_key,'revision',p.revision,'title',p.title,'grade',p.grade,'subject',p.subject,
   'sources',(select coalesce(jsonb_agg(jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt) order by s.source_key),'[]') from gina.library_import_sources s where s.package_id=p.id),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'revision',q.revision,'source_key',q.source_key,'student',q.student,'teacher',a.teacher,'curriculum',q.metadata->'curriculum') order by q.position),'[]')
    from gina.library_import_questions q join gina.library_import_answers a on a.package_id=q.package_id and a.question_key=q.question_key where q.package_id=p.id))
  into v from gina.library_import_packages p where p.id=p_id;
 elsif p_kind='contribution_set' then
  select jsonb_build_object('kind','contribution_set','id',s.id,'snapshot',s.snapshot-'images','media_count',coalesce(jsonb_array_length(s.snapshot->'images'),0))
  into v from gina.contribution_sets s where s.id=p_id and s.status<>'preparing';
 elsif p_kind='curriculum_candidate' then
  select jsonb_build_object('kind','curriculum_candidate','id',c.id,'external_key',c.external_key,'candidate',c.candidate)
  into v from gina.curriculum_candidates c where c.id=p_id;
 else raise exception 'prereview_kind_invalid';end if;
 return v;
end;$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select throws_like($$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(pg_temp.bundle(),'{questions,0,metadata,interaction,answer_key}','{"answers":{"a":true}}'))$$,'%question_structure_invalid%','incomplete typed answer key rejected before import');
select throws_ok($$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(pg_temp.bundle(),'{questions,0,metadata,interaction,type}','"crossword"'))$$,'P0001','interaction_type_unavailable','disabled type cannot enter library');
select throws_ok($$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(pg_temp.bundle(),'{questions,0,metadata,interaction,schema_version}','9'))$$,'P0001','library_interaction_invalid','unsupported version rejected');
reset role;
savepoint all_types;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-true_false"'),'{questions,0,metadata,interaction}','{"type": "true_false", "schema_version": 1, "payload": {"statements": [{"id": "s1", "text": "Güneş bir yıldızdır."}, {"id": "s2", "text": "Ay kendi ışığını üretir."}, {"id": "s3", "text": "Dünya Güneş''in etrafında döner."}]}, "answer_key": {"answers": {"s1": true, "s2": false, "s3": true}}}'::jsonb))$test$,'canonical true_false contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-fill_blank"'),'{questions,0,metadata,interaction}','{"type": "fill_blank", "schema_version": 1, "payload": {"segments": [{"type": "text", "text": "Türkiye''nin başkenti "}, {"type": "blank", "id": "b1"}, {"type": "text", "text": " şehridir."}], "input": "keyboard"}, "answer_key": {"blanks": {"b1": {"accepted": ["Ankara"]}}}}'::jsonb))$test$,'canonical fill_blank contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-matching"'),'{questions,0,metadata,interaction}','{"type": "matching", "schema_version": 1, "payload": {"left": [{"id": "l1", "text": "Kalp"}, {"id": "l2", "text": "Akciğer"}, {"id": "l3", "text": "Mide"}], "right": [{"id": "r1", "text": "Kan pompalar"}, {"id": "r2", "text": "Solunum"}, {"id": "r3", "text": "Sindirim"}, {"id": "r4", "text": "Görme"}], "policy": "one_to_one"}, "answer_key": {"pairs": {"l1": "r1", "l2": "r2", "l3": "r3"}}}'::jsonb))$test$,'canonical matching contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-numeric"'),'{questions,0,metadata,interaction}','{"type": "numeric", "schema_version": 1, "payload": {"units": [], "unit_required": false}, "answer_key": {"value": "12.5"}}'::jsonb))$test$,'canonical numeric contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-ordering"'),'{questions,0,metadata,interaction}','{"type": "ordering", "schema_version": 1, "payload": {"items": [{"id": "a", "text": "Tohum ekilir"}, {"id": "b", "text": "Filiz çıkar"}, {"id": "c", "text": "Çiçek açar"}, {"id": "d", "text": "Meyve olur"}], "mode": "sequence"}, "answer_key": {"orders": [["a", "b", "c", "d"]]}}'::jsonb))$test$,'canonical ordering contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-classification"'),'{questions,0,metadata,interaction}','{"type": "classification", "schema_version": 1, "payload": {"items": [{"id": "i1", "text": "Kedi"}, {"id": "i2", "text": "Köpek"}, {"id": "i3", "text": "Gül"}, {"id": "i4", "text": "Lale"}], "categories": [{"id": "c1", "text": "Hayvan", "capacity": 2}, {"id": "c2", "text": "Bitki"}]}, "answer_key": {"membership": {"i1": "c1", "i2": "c1", "i3": "c2", "i4": "c2"}}}'::jsonb))$test$,'canonical classification contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-mark_text"'),'{questions,0,metadata,interaction}','{"type": "mark_text", "schema_version": 1, "payload": {"unit": "word", "segments": [{"id": "t1", "text": "Ali"}, {"text": " "}, {"id": "t2", "text": "topu"}, {"text": " "}, {"id": "t3", "text": "attı"}, {"text": " ve "}, {"id": "t4", "text": "koştu"}, {"text": "."}]}, "answer_key": {"targets": ["t3", "t4"]}}'::jsonb))$test$,'canonical mark_text contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-multi_choice"'),'{questions,0,metadata,interaction}','{"type": "multi_choice", "schema_version": 1, "payload": {"options": [{"id": "o1", "text": "Kedi"}, {"id": "o2", "text": "Gül"}, {"id": "o3", "text": "Köpek"}, {"id": "o4", "text": "Lale"}, {"id": "o5", "text": "Kuş"}]}, "answer_key": {"correct": ["o1", "o3", "o5"]}}'::jsonb))$test$,'canonical multi_choice contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-error_fix"'),'{questions,0,metadata,interaction}','{"type": "error_fix", "schema_version": 1, "payload": {"unit": "word", "segments": [{"id": "t1", "text": "Ben"}, {"text": " dün okula "}, {"id": "t2", "text": "gidiyorum"}, {"text": " ve "}, {"id": "t3", "text": "arkadaşlarımla"}, {"text": " "}, {"id": "t4", "text": "oynadık"}, {"text": "."}]}, "answer_key": {"errors": {"t2": {"accepted": ["gittim"]}}}}'::jsonb))$test$,'canonical error_fix contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-two_stage"'),'{questions,0,metadata,interaction}','{"type": "two_stage", "schema_version": 1, "payload": {"stage1": {"prompt": "Hangi madde iletkendir?", "options": [{"id": "a1", "text": "Bakır"}, {"id": "a2", "text": "Plastik"}]}, "stage2": {"prompt": "Neden?", "mode": "choice", "options": [{"id": "r1", "text": "Metal olduğu için"}, {"id": "r2", "text": "Renkli olduğu için"}]}}, "answer_key": {"stage1": "a1", "stage2": "r1"}}'::jsonb))$test$,'canonical two_stage contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-region_select"'),'{questions,0,metadata,interaction}','{"type": "region_select", "schema_version": 1, "payload": {"figure": {"kind": "grid", "rows": 2, "cols": 4}, "regions": [{"id": "g1", "text": "Parça 1"}, {"id": "g2", "text": "Parça 2"}, {"id": "g3", "text": "Parça 3"}, {"id": "g4", "text": "Parça 4"}, {"id": "g5", "text": "Parça 5"}, {"id": "g6", "text": "Parça 6"}, {"id": "g7", "text": "Parça 7"}, {"id": "g8", "text": "Parça 8"}]}, "answer_key": {"count": 3}}'::jsonb))$test$,'canonical region_select contract accepted');
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(jsonb_set(pg_temp.bundle(),'{package_key}','"typed-clock"'),'{questions,0,metadata,interaction}','{"type": "clock", "schema_version": 1, "payload": {"mode": "read", "display": "analog", "step_minutes": 5, "shown_time": "07:30"}, "answer_key": {"time": "07:30"}}'::jsonb))$test$,'canonical clock contract accepted');
rollback to all_types;
set local role authenticated;
reset role;savepoint legacy_source;
set local role authenticated;
select lives_ok($test$select public.admin_import_library_bundle(gen_random_uuid(),jsonb_set(pg_temp.legacy_bundle(),'{package_key}','"legacy-source-regression"'))$test$,'legacy package still imports');
reset role;
select is(gina.content_prereview_source('library_package',id),pg_temp.legacy_prereview_source('library_package',id),'legacy normalized JSON and review hash input unchanged') from gina.library_import_packages where package_key='legacy-source-regression';
rollback to legacy_source;
set local role authenticated;
insert into state(id) select (public.admin_import_library_bundle(gen_random_uuid(),pg_temp.bundle())->>'id')::uuid;
reset role;
select is(gina.content_prereview_source('library_package',(select id from state))#>>'{questions,0,interaction,type}','true_false','independent reviewer sees actual typed contract');
select is(gina.content_prereview_source('library_package',(select id from state))#>>'{questions,0,interaction,answer_key,answers,b}','false','authorized reviewer sees private key');
set local role authenticated;
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'gina-g5-math-geometry-01',1,0,'suitable','Test approval');
select public.admin_review_library_question(gen_random_uuid(),(select id from state),'gina-g5-math-geometry-02',1,0,'suitable','Test approval');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_library_delivery_media('00000000-0000-4000-8000-000000004301',(select id from state),jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{assets,0,sha256}','base64',pg_temp.bundle()#>>'{assets,0,base64}')));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004301","role":"authenticated","gina":{"admin":true}}',true);
select public.admin_set_library_publication(gen_random_uuid(),(select id from state),0,public.admin_library_publication((select id from state))#>>'{checks,review_fingerprint}','Test geometry','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004302","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
create function pg_temp.acquire(req uuid,keys text[] default array['source:segments'],v int default 1) returns jsonb language sql as $$select public.acquire_library_units(req,(select id from state),v,keys);$$;
select throws_ok($$select pg_temp.acquire(gen_random_uuid())$$,'P0001','library_unavailable','closed rollout denies acquisition');
reset role;update public.app_settings set value='true' where key in('library_packages.enabled','sources.enabled','question_groups.enabled');set local role authenticated;
savepoint meb_case;
select public.save_prova_draft('80000000-0000-4000-8000-000000004311','80000000-0000-4000-8000-000000004312',0,'{"childId":null,"grade":5,"title":"OYSS","purpose":"written","format":"meb","subjects":["Matematik"],"topics":[],"target":2,"minutes":null,"difficulty":"orta","kind":"mixed","note":"","step":1,"blocks":[],"context":{"scope":"subject","track":"meb_common","term":1,"program":null,"academicYear":2026,"periodId":null,"school":null,"schoolDeclared":false}}');
select throws_ok($$select public.acquire_library_units(gen_random_uuid(),(select id from state),1,array['source:segments'],'80000000-0000-4000-8000-000000004312')$$,'P0001','interaction_type_not_allowed_for_track','practice-only library question cannot enter an OYSS draft');
reset role;
select is((select count(*)::int from gina.library_acquisition_charges),0,'OYSS rejection spends no allowance');
rollback to meb_case;
set local role authenticated;
select is(jsonb_array_length(public.get_library_package_units((select id from state))),1,'shared source appears as one unit');
select is(public.get_library_package_units((select id from state))#>>'{0,count}','2','unit exposes exact charge');
select ok(public.get_library_package_units((select id from state))::text not like '%expected_answer%','no answer key in catalogue');
select throws_ok($$select pg_temp.acquire(gen_random_uuid(),array['source:segments'],2)$$,'P0001','library_publication_changed','stale publication rejected');
select throws_ok($$select pg_temp.acquire(gen_random_uuid(),array['question:missing'])$$,'P0001','library_unit_unavailable','unknown unit rejected');
reset role;update public.plans set library_monthly=1 where code='free';set local role authenticated;
select throws_ok($$select pg_temp.acquire(gen_random_uuid())$$,'P0001','library_quota_exceeded','partial group cannot spend remaining quota');
reset role;
select is((select count(*)::int from gina.library_acquisitions),0,'failed acquisition leaves no copy');
select is((select count(*)::int from public.learning_sources where family_id='10000000-0000-4000-8000-000000004302'),0,'failed acquisition leaves no media');
update public.plans set library_monthly=5 where code='free';set local role authenticated;
savepoint bonus_case;
reset role;
update public.plans set library_monthly=0 where code='free';
insert into public.learning_credit_grants(family_id,kind,amount,ends_at,reason) values('10000000-0000-4000-8000-000000004302','library',3,now()+interval '2 days','Test bonus');
set local role authenticated;
select is(pg_temp.acquire(gen_random_uuid())->>'charged','2','bonus credits can fund shared questions');
select is(public.get_learning_library()->>'bonus','1','package copies consume bonus allowance');
select is(public.get_learning_library()->>'remaining','0','bonus does not change monthly allowance');
rollback to bonus_case;
update state set result=pg_temp.acquire(request);
select is((select result->>'charged' from state),'2','two questions charged once');
select is((select result#>>'{blocks,0,kind}' from state),'group','shared context remains a group');
select is(pg_temp.acquire((select request from state)),(select result from state),'lost response replay returns original result');
select is(pg_temp.acquire(gen_random_uuid())->>'charged','0','new request for owned unit costs zero');
select throws_ok($$select pg_temp.acquire((select request from state),array['question:missing'])$$,'P0001','request_conflict','request cannot change meaning');
select is(public.get_learning_library()->>'remaining','3','legacy and package catalogue share remaining quota');
select is(public.get_library_package_units((select id from state))#>>'{0,owned}','true','owned unit is marked');
select is((select count(*)::int from public.question_source_members where group_id=(select (result#>>'{blocks,0,id}')::uuid from state)),2,'both members retained');
select is((select count(*)::int from public.question_bank where family_id='10000000-0000-4000-8000-000000004302' and provenance ? 'rubric'),2,'teacher rubric retained in parent copy');

reset role;
select is((select count(*)::int from public.question_bank where family_id='10000000-0000-4000-8000-000000004302' and kind='structured'),2,'acquisition creates real structured questions');
select is((select count(*)::int from public.question_answer_keys where family_id='10000000-0000-4000-8000-000000004302'),2,'scoring keys stored separately');
select ok(not exists(select 1 from public.question_bank where family_id='10000000-0000-4000-8000-000000004302' and (payload ? 'answer_key' or provenance ? 'interaction' or provenance ? 'answer_key')),'public payload and provenance never copy private metadata');
select lives_ok($$set constraints all immediate$$,'acquired keys satisfy native QT content hash');
set constraints all deferred;
set local role authenticated;
select public.save_prova_draft('80000000-0000-4000-8000-000000004301','80000000-0000-4000-8000-000000004302',0,'{"childId":null,"grade":5,"title":"Test practice","purpose":"practice","format":"practice","subjects":["Matematik"],"topics":[],"target":2,"minutes":null,"difficulty":"orta","kind":"mixed","note":"","step":1,"blocks":[]}');
select is(public.acquire_library_units(gen_random_uuid(),(select id from state),1,array['source:segments'],'80000000-0000-4000-8000-000000004302')->>'charged','0','owned unit adds to draft without charge');
select is(public.get_prova_drafts('80000000-0000-4000-8000-000000004302')#>>'{0,version}','2','atomic draft append advances revision');
select public.acquire_library_units(gen_random_uuid(),(select id from state),1,array['source:segments'],'80000000-0000-4000-8000-000000004302');
select is(public.get_prova_drafts('80000000-0000-4000-8000-000000004302')#>>'{0,version}','2','repeat append does not change revision');
select is(jsonb_array_length(public.get_prova_drafts('80000000-0000-4000-8000-000000004302')#>'{0,content,blocks}'),1,'repeat append creates one group');

select throws_ok($$select public.read_library_source_bytes(gen_random_uuid())$$,'42501',null,'browser cannot call service bytes reader');
reset role;
select is((select count(*)::int from gina.library_acquisition_charges),2,'retries do not duplicate charges');
select is((select count(*)::int from public.learning_source_links where question_id in(select question_id from gina.library_acquisition_charges)),2,'both members link to image');
select is((select count(*)::int from gina.library_source_copies),1,'one shared image copy');
select throws_ok($$delete from public.learning_sources where id=(select source_id from gina.library_source_copies limit 1)$$,'P0001','library_copy_immutable','required image cannot be removed');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.read_library_source_bytes((select source_id from gina.library_source_copies limit 1))->>'sha256',(select sha256 from public.learning_sources where id=(select source_id from gina.library_source_copies limit 1)),'service bytes match immutable copy');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004303","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000004303"}}',true);
select throws_ok($$select pg_temp.acquire((select request from state))$$,'P0001','request_conflict','another family cannot replay receipt');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004303","role":"authenticated","gina":{"role":"child","family_id":"10000000-0000-4000-8000-000000004302"}}',true);
select throws_ok($$select pg_temp.acquire((select request from state))$$,'42501','forbidden','child cannot replay acquisition');
reset role;
delete from public.families where id='10000000-0000-4000-8000-000000004302';
select is((select count(*)::int from gina.library_acquisitions),0,'family deletion clears owned copies');
select is((select count(*)::int from gina.library_acquisition_charges),0,'family deletion clears quota records');
select is((select count(*)::int from public.source_deletion_queue where object_path like 'library/%'),0,'canonical copies do not queue phantom storage objects');
select * from finish();rollback;
