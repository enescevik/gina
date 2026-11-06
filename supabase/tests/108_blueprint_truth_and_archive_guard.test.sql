-- C01: 20261106220000_blueprint_truth_and_archive_guard
-- (1) senaryo kökeni: veli girişi / "bilmiyorum" okul onayı alamaz, resmî doğrulama ayrı, kişiselleştirme ayrı alan,
--     eski yanlış etiket düzeltmesi denetim izli ve tekrar çalıştırılabilir; (2) arşivli etkinlik normal düzenlemeyle
--     değişmez; (3) haftalık özet çocuk kapsamı = veri = takma ad eşlemesi; (4) P04 öncesi otomatik sıfırlar için
--     önizleme + onaylı, idempotent, denetim izli düzeltme. İki aile, iki çocuk, veli/cihaz/yönetici/anonim rolleri.
begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000010801','c01-parent-a@test.local'),
 ('00000000-0000-4000-8000-000000010802','c01-parent-a2@test.local'),
 ('00000000-0000-4000-8000-000000010803','c01-parent-b@test.local'),
 ('00000000-0000-4000-8000-000000010804','c01-device-a@test.local'),
 ('00000000-0000-4000-8000-000000010805','c01-admin@test.local'),
 ('00000000-0000-4000-8000-000000010806','c01-parent-w@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000010805');
insert into public.families(id,name,timezone,created_by) values
 ('10000000-0000-4000-8000-000000010801','C01 A','Europe/Istanbul','00000000-0000-4000-8000-000000010801'),
 ('10000000-0000-4000-8000-000000010802','C01 B','Europe/Istanbul','00000000-0000-4000-8000-000000010803'),
 ('10000000-0000-4000-8000-000000010803','C01 W','Europe/Istanbul','00000000-0000-4000-8000-000000010806');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010801','00000000-0000-4000-8000-000000010801'),
 ('10000000-0000-4000-8000-000000010801','00000000-0000-4000-8000-000000010802'),
 ('10000000-0000-4000-8000-000000010802','00000000-0000-4000-8000-000000010803'),
 ('10000000-0000-4000-8000-000000010803','00000000-0000-4000-8000-000000010806');
insert into public.children(id,family_id,name,grade,sort_order) values
 ('20000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801','Ada',5,0),
 ('20000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801','Can',5,1),
 ('20000000-0000-4000-8000-000000010803','10000000-0000-4000-8000-000000010802','Deniz',5,0),
 ('20000000-0000-4000-8000-000000010811','10000000-0000-4000-8000-000000010803','Arşivli',4,0),
 ('20000000-0000-4000-8000-000000010812','10000000-0000-4000-8000-000000010803','Bora',4,1),
 ('20000000-0000-4000-8000-000000010813','10000000-0000-4000-8000-000000010803','Cem',4,2);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801','00000000-0000-4000-8000-000000010804','20000000-0000-4000-8000-000000010801');

create function pg_temp.as_parent(uid text,fam text) returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated','gina',json_build_object('family_id',fam,'role','parent'))::text,true)$$;
create function pg_temp.as_a() returns void language sql as $$select pg_temp.as_parent('00000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801')$$;
create function pg_temp.as_b() returns void language sql as $$select pg_temp.as_parent('00000000-0000-4000-8000-000000010803','10000000-0000-4000-8000-000000010802')$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010804","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010801","role":"device","device_id":"30000000-0000-4000-8000-000000010801","child_id":"20000000-0000-4000-8000-000000010801"}}',true)$$;
create function pg_temp.as_admin() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010805","role":"authenticated","gina":{"role":"parent","admin":true}}',true)$$;
create function pg_temp.body(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('child_id','20000000-0000-4000-8000-000000010801','grade',5,'subject','Matematik','name','Ada çalışma','academic_year','2026-2027',
  'term',1,'exam',1,'rows',jsonb_build_array(jsonb_build_object('topic','Kesirler','count',3)),'source_url','','confirmed',true)||extra$$;
create function pg_temp.bp(id uuid) returns public.exam_blueprints language sql security definer as $$select * from public.exam_blueprints where exam_blueprints.id=$1$$;

-- 1. Şema ----------------------------------------------------------------------------------------------------------
select has_column('public','exam_blueprints','school_scenario','school statement column');
select has_column('public','exam_blueprints','distribution_kind','distribution kind column');
select has_column('public','exam_blueprints','school_confirmed','school confirmation column');
select has_column('public','exam_blueprints','official_source_verified','official verification column');
select has_column('public','exam_blueprints','personalization','personalization metadata column');
select ok(not has_function_privilege('anon','public.save_family_blueprint(uuid,jsonb)','execute'),'anon cannot save blueprints');
select ok(not has_function_privilege('anon','public.preview_legacy_open_zero_corrections(uuid)','execute'),'anon cannot preview corrections');
select ok(not has_function_privilege('anon','public.apply_legacy_open_zero_corrections(uuid,uuid[],uuid)','execute'),'anon cannot apply corrections');
select ok(not has_function_privilege('authenticated','gina.backfill_blueprint_provenance()','execute'),'clients cannot run the provenance backfill');

-- 2. Veli dağılımı RPC: beyan saklanır, okul onayı asla oluşmaz -----------------------------------------------------
set local role authenticated;
select pg_temp.as_a();
select set_config('t.legacy',public.save_family_blueprint('51000000-0000-4000-8000-000000010801',pg_temp.body())::text,true);
select results_eq($$select school_scenario,distribution_kind,school_confirmed,official_source_verified,personalization is null,source_context->>'school_confirmed',source_context->>'origin' from public.exam_blueprints where id=current_setting('t.legacy')::uuid$$,
 $$values ('unstated','parent_study',false,false,true,'false','parent_entered')$$,'old client payload: statement unstated, study distribution, no school confirmation');
select set_config('t.unknown',public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_scenario":"unknown","name":"Senaryo 1 · Çalışma senaryosu"}'))::text,true);
select results_eq($$select school_scenario,distribution_kind,school_confirmed,source_context->>'school_scenario' from public.exam_blueprints where id=current_setting('t.unknown')::uuid$$,
 $$values ('unknown','parent_study',false,'unknown')$$,'"bilmiyorum" stored as unknown, never school confirmed');
select set_config('t.known',public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_scenario":"known","name":"Okul dağılımı"}'))::text,true);
select results_eq($$select school_scenario,school_confirmed,official_source_verified from public.exam_blueprints where id=current_setting('t.known')::uuid$$,
 $$values ('known',false,false)$$,'"biliyorum" + parent entry is a statement only, not school confirmation');
select set_config('t.pers',public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_scenario":"known","name":"Senaryo 1 · Kişiselleştirilmiş çalışma","personalization":{"basis":"catalogue_seed","base_label":"Senaryo 1","base_total":5,"base_blocks":2}}'))::text,true);
select results_eq($$select distribution_kind,school_confirmed,personalization,name from public.exam_blueprints where id=current_setting('t.pers')::uuid$$,
 $$values ('personalized',false,'{"basis":"catalogue_seed","base_label":"Senaryo 1","base_total":5,"base_blocks":2}'::jsonb,'Senaryo 1 · Kişiselleştirilmiş çalışma')$$,'personalization kept in its own field; name untouched');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_scenario":"confirmed"}'))$$,'P0001','blueprint_invalid','unknown statement value rejected');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_confirmed":true}'))$$,'P0001','blueprint_invalid','client cannot send school_confirmed');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"officially_verified":true}'))$$,'P0001','blueprint_invalid','client cannot send official verification');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"personalization":{"basis":"school","base_label":"x","base_total":1,"base_blocks":1}}'))$$,'P0001','blueprint_invalid','personalization basis is closed');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"personalization":{"basis":"catalogue_seed","base_label":"x","base_total":31,"base_blocks":1}}'))$$,'P0001','blueprint_invalid','personalization totals bounded');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body('{"school_scenario":true}'))$$,'P0001','blueprint_invalid','statement must be a string');
-- idempotency
select is(public.save_family_blueprint('51000000-0000-4000-8000-000000010801',pg_temp.body())::text,current_setting('t.legacy'),'lost response replay returns same blueprint');
select is((select count(*)::int from public.exam_blueprints),4,'replay created nothing new');
select throws_ok($$select public.save_family_blueprint('51000000-0000-4000-8000-000000010801',pg_temp.body('{"school_scenario":"known"}'))$$,'P0001','request_conflict','same request with changed statement is a conflict');
-- second parent of the same family sees the same provenance
select pg_temp.as_parent('00000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801');
select is((select count(*)::int from public.exam_blueprints where school_confirmed),0,'second parent: no parent-entered blueprint is school confirmed');
select is((select school_scenario from public.exam_blueprints where id=current_setting('t.unknown')::uuid),'unknown','second parent reads the same statement');
-- other family / device
select pg_temp.as_b();
select is((select count(*)::int from public.exam_blueprints),0,'other family reads none');
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body())$$,'42501','forbidden','other family cannot save for A''s child');
select pg_temp.as_device();
select throws_ok($$select public.save_family_blueprint(gen_random_uuid(),pg_temp.body())$$,'42501','forbidden','device cannot save blueprints');

-- 3. Doğrudan REST yazımı köken kuramaz/değiştiremez ---------------------------------------------------------------
select pg_temp.as_a();
select throws_ok($$insert into public.exam_blueprints(family_id,grade,subject,name,rows,school_scenario,distribution_kind,school_confirmed) values('10000000-0000-4000-8000-000000010801',5,'Matematik','x','[]','known','school_catalogue',true)$$,'42501','blueprint_provenance_locked','direct insert cannot claim school confirmation');
select throws_ok($$insert into public.exam_blueprints(family_id,grade,subject,name,rows,source_context) values('10000000-0000-4000-8000-000000010801',5,'Matematik','x','[]','{"origin":"parent_entered","school_confirmed":true}')$$,'42501','blueprint_provenance_locked','direct insert cannot hide confirmation in JSON');
select throws_ok($$insert into public.exam_blueprints(family_id,grade,subject,name,rows,source_context) values('10000000-0000-4000-8000-000000010801',5,'Matematik','x','[]','{"origin":"reviewed_catalogue"}')$$,'42501','blueprint_provenance_locked','direct insert cannot impersonate catalogue origin');
select lives_ok($$insert into public.exam_blueprints(id,family_id,grade,subject,name,rows) values('52000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801',5,'Matematik','Elle','[]')$$,'plain direct insert still allowed');
select is((pg_temp.bp('52000000-0000-4000-8000-000000010801')).school_confirmed,false,'plain direct insert defaults to not confirmed');
select throws_ok($$update public.exam_blueprints set school_confirmed=true where id=current_setting('t.known')::uuid$$,'42501','blueprint_provenance_locked','direct update cannot confirm');
select throws_ok($$update public.exam_blueprints set school_scenario='unknown' where id=current_setting('t.known')::uuid$$,'42501','blueprint_provenance_locked','direct update cannot rewrite the statement');
select throws_ok($$update public.exam_blueprints set source_context=source_context||'{"school_confirmed":true}' where id=current_setting('t.known')::uuid$$,'42501','blueprint_provenance_locked','direct update cannot edit provenance JSON');
select lives_ok($$update public.exam_blueprints set name='Okul dağılımı (yeni ad)' where id=current_setting('t.known')::uuid$$,'rename keeps working');
select is((pg_temp.bp(current_setting('t.known')::uuid)).school_scenario,'known','rename keeps provenance');
reset role;
select throws_ok($$update public.exam_blueprints set school_confirmed=true where id='52000000-0000-4000-8000-000000010801'$$,'23514',null,'CHECK: parent study can never be school confirmed, even for the owner role');
select throws_ok($$update public.exam_blueprints set official_source_verified=true,official_verified_at=now() where id='52000000-0000-4000-8000-000000010801'$$,'42501','blueprint_provenance_locked','official verification only by service role');
set local role service_role;
select throws_ok($$update public.exam_blueprints set official_source_verified=true,official_verified_at=now() where id='52000000-0000-4000-8000-000000010801'$$,'23514',null,'CHECK: official verification only on a catalogue copy');
reset role;

-- 4. Katalog seçimi: tek okul onayı yolu; resmî doğrulama ayrı ------------------------------------------------------
create function pg_temp.bundle() returns jsonb language sql as $$select '
{"schema": "gina.curriculum-review.v1", "candidates": [{"key": "tr-2026-2027-t1-c01-g5", "academic_year": "2026-2027", "term": 1, "exam": 1, "grade": 5, "subject": "Türkçe", "source_url": "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx", "source_sha256": "6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee", "sheet": "5. Sınıf", "header_cell": "C6", "question_count": 3, "blocks": [{"count": 2, "count_cell": "C12", "outcomes": [{"cell": "B12", "text": "T.O.5.6. Metnin yüzey anlamını belirleyebilme", "code": "T.O.5.6"}]}, {"count": 1, "count_cell": "C13", "outcomes": [{"cell": "B13", "text": "T.O.5.7. Görselle iletilen anlamı belirleyebilme", "code": "T.O.5.7"}]}], "label": "Senaryo 1", "review_reasons": ["programme_and_school_scope_required", "source_review_required"]}]}
'::jsonb$$;
create function pg_temp.review() returns jsonb language sql as $$select '{"programme":"Test programme version","school_scope":"Synthetic scope for testing only","programme_url":"https://tymm.meb.gov.tr/ogretim-programlari","source_checked":true,"counts_checked":true,"applicability_checked":true,"issues_resolution":"Synthetic evidence reviewed for test only.","note":"Test source review, not real catalogue approval."}'::jsonb$$;
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000010801','plus','C01 synthetic',now()+interval '1 day'),('10000000-0000-4000-8000-000000010802','plus','C01 synthetic',now()+interval '1 day');
update public.app_settings set value='true' where key='curriculum_catalog.enabled';
set local role authenticated;
select pg_temp.as_admin();
select public.admin_import_curriculum_candidates(gen_random_uuid(),pg_temp.bundle());
select set_config('t.cat',(select x->>'id' from jsonb_array_elements(public.admin_list_curriculum_candidates()) x where x->'candidate'->>'key'='tr-2026-2027-t1-c01-g5' or x->>'external_key'='tr-2026-2027-t1-c01-g5' limit 1),true);
select set_config('t.cat',coalesce(nullif(current_setting('t.cat'),''),public.admin_list_curriculum_candidates()->0->>'id'),true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('t.cat')::uuid,0,'review',pg_temp.review(),'Test review',true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('t.cat')::uuid,1,'publish',null,'Test publication',true);
select pg_temp.as_a();
select set_config('t.catbp',public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000010801','catalogue_id',current_setting('t.cat'),'revision',2,'subject','Türkçe','confirmed',true))::text,true);
select results_eq($$select school_scenario,distribution_kind,school_confirmed,official_source_verified,source_context->>'origin' from public.exam_blueprints where id=current_setting('t.catbp')::uuid$$,
 $$values ('known','school_catalogue',true,false,'reviewed_catalogue')$$,'catalogue copy with school confirmation: confirmed, not officially verified');
select throws_ok($$update public.exam_blueprints set official_source_verified=true,official_verified_at=now() where id=current_setting('t.catbp')::uuid$$,'42501','blueprint_provenance_locked','parent cannot mark official verification');
reset role;
set local role service_role;
select lives_ok($$update public.exam_blueprints set official_source_verified=true,official_verified_at=now() where id=current_setting('t.catbp')::uuid$$,'service marks official verification separately');
reset role;
select is((pg_temp.bp(current_setting('t.catbp')::uuid)).official_source_verified,true,'official verification stored separately from school confirmation');

-- 5. Eski yanlış etiket düzeltmesi (köken + ad etiketi), denetim izi, tekrar çalıştırma, snapshot'lar sabit ---------
insert into public.exam_blueprints(id,family_id,grade,subject,name,rows,source_context) values
 ('53000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801',5,'Matematik','Eski giriş','[{"topic":"Kesirler","count":2}]',
  '{"origin":"parent_entered","academic_year":"2026-2027","term":1,"exam":1,"school_confirmed":true,"officially_verified":false}'),
 ('53000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801',5,'Matematik','Senaryo 1 · Çalışma senaryosu','[{"topic":"Blok 1","count":2}]',
  '{"origin":"parent_entered","academic_year":"2026-2027","term":1,"exam":1,"school_confirmed":true,"officially_verified":false}'),
 ('53000000-0000-4000-8000-000000010803','10000000-0000-4000-8000-000000010801',5,'Matematik','Senaryo 1 · Kişiselleştirilmiş çalışma','[{"topic":"Blok 1","count":3}]',
  '{"origin":"parent_entered","academic_year":"2026-2027","term":1,"exam":1,"school_confirmed":true,"officially_verified":false}'),
 ('53000000-0000-4000-8000-000000010804','10000000-0000-4000-8000-000000010802',5,'Matematik','Eski B','[{"topic":"Kesirler","count":2}]','{}');
insert into public.exams(id,family_id,child_id,title,subject,grade,blueprint_id) values
 ('54000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','Eski senaryo sınavı','Matematik',5,'53000000-0000-4000-8000-000000010801');
select set_config('t.exam_before',(select md5(to_jsonb(e)::text) from public.exams e where id='54000000-0000-4000-8000-000000010801'),true);
select set_config('t.corr_before',(select count(*)::text from gina.blueprint_provenance_corrections),true);
select is(gina.backfill_blueprint_provenance(),3,'three wrongly labelled parent entries corrected (B''s untagged {} row left alone)');
select results_eq($$select id::text,school_scenario,distribution_kind,school_confirmed,source_context->>'school_confirmed',personalization from public.exam_blueprints where id::text like '53000000-%' order by id$$,
 $$values ('53000000-0000-4000-8000-000000010801','unstated','parent_study',false,'false',null::jsonb),
         ('53000000-0000-4000-8000-000000010802','unknown','parent_study',false,'false',null::jsonb),
         ('53000000-0000-4000-8000-000000010803','unstated','personalized',false,'false','{"basis":"legacy_name_tag"}'::jsonb),
         ('53000000-0000-4000-8000-000000010804','unstated','parent_study',false,null,null::jsonb)$$,
 'corrected by origin and name tag; personalization moved to its own field');
select is((select name from public.exam_blueprints where id='53000000-0000-4000-8000-000000010803'),'Senaryo 1 · Kişiselleştirilmiş çalışma','name not rewritten');
select is((select rows from public.exam_blueprints where id='53000000-0000-4000-8000-000000010802'),'[{"topic":"Blok 1","count":2}]'::jsonb,'distribution rows not rewritten');
select is((select count(*)::int from gina.blueprint_provenance_corrections where blueprint_id::text like '53000000-%' and reason='parent_entry_marked_school_confirmed'),3,'audit row per corrected blueprint');
select is((select before->'source_context'->>'school_confirmed' from gina.blueprint_provenance_corrections where blueprint_id='53000000-0000-4000-8000-000000010801'),'true','audit keeps the wrong value as before');
select is((select md5(to_jsonb(e)::text) from public.exams e where id='54000000-0000-4000-8000-000000010801'),current_setting('t.exam_before'),'assigned exam snapshot untouched');
select is(gina.backfill_blueprint_provenance(),0,'second backfill run changes nothing');
select is((select count(*)::int from gina.blueprint_provenance_corrections),current_setting('t.corr_before')::int+3,'no duplicate audit rows');
select is((pg_temp.bp(current_setting('t.catbp')::uuid)).school_confirmed,true,'backfill never touches the catalogue copy');

-- 6. Takvim: arşivli kayıt normal düzenleme/silme ile değişmez ------------------------------------------------------
insert into public.events(id,family_id,child_id,type,title,starts_at,visible_to_child) values
 ('55000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','activity','Yüzme',now()+interval '1 day',true),
 ('55000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','activity','Eski kurs',now()+interval '2 day',true),
 ('55000000-0000-4000-8000-000000010803','10000000-0000-4000-8000-000000010802','20000000-0000-4000-8000-000000010803','activity','B etkinliği',now()+interval '1 day',true);
create function pg_temp.vals(t text) returns jsonb language sql as $$select jsonb_build_object('title',t,'type','activity','child_id','20000000-0000-4000-8000-000000010801','starts_at',now()+interval '2 day','ends_at',null,'all_day',false,'location',null,'rrule',null)$$;
create function pg_temp.ev(id uuid) returns public.events language sql security definer as $$select * from public.events where events.id=$1$$;
set local role authenticated;
select pg_temp.as_a();
select lives_ok($$select public.save_calendar_event('56000000-0000-4000-8000-000000010801','55000000-0000-4000-8000-000000010802',1,pg_temp.vals('Eski kurs 2'))$$,'live event edit works');
reset role;
update public.events set archived_at=now() where id='55000000-0000-4000-8000-000000010802';
select set_config('t.ev_before',md5(to_jsonb(pg_temp.ev('55000000-0000-4000-8000-000000010802'))::text),true);
set local role authenticated;
select pg_temp.as_a();
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010802',(pg_temp.ev('55000000-0000-4000-8000-000000010802')).edit_revision,pg_temp.vals('Gizli düzenleme'))$$,'P0001','event_archived','archived event cannot be edited with the current revision');
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010802',(pg_temp.ev('55000000-0000-4000-8000-000000010802')).edit_revision,null)$$,'P0001','event_archived','archived event cannot be deleted by the edit command');
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010802',0,pg_temp.vals('Yeniden oluştur'))$$,'P0001','event_archived','archived id cannot be recreated as new');
select is(md5(to_jsonb(pg_temp.ev('55000000-0000-4000-8000-000000010802'))::text),current_setting('t.ev_before'),'archived row byte-identical after rejected commands');
select is((public.save_calendar_event('56000000-0000-4000-8000-000000010801','55000000-0000-4000-8000-000000010802',1,pg_temp.vals('Eski kurs 2')))->>'revision','2','lost-response replay from before archive returns the stored result only');
select is(md5(to_jsonb(pg_temp.ev('55000000-0000-4000-8000-000000010802'))::text),current_setting('t.ev_before'),'replay does not touch the archived row');
select is((select r->'summary'->>'ok' from (select public.bulk_restore_apply(jsonb_build_array(jsonb_build_object('type','event','id','55000000-0000-4000-8000-000000010802','revision',(pg_temp.ev('55000000-0000-4000-8000-000000010802')).edit_revision)),'57000000-0000-4000-8000-000000010801') r) x),'1','explicit restore flow works');
select lives_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010802',(pg_temp.ev('55000000-0000-4000-8000-000000010802')).edit_revision,pg_temp.vals('Geri gelen kurs'))$$,'after restore the event is editable again');
select is((pg_temp.ev('55000000-0000-4000-8000-000000010802')).title,'Geri gelen kurs','edit applied after restore');
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010803',1,pg_temp.vals('Yabancı'))$$,'42501','forbidden','other family event still forbidden');
select pg_temp.as_device();
select throws_ok($$select public.save_calendar_event(gen_random_uuid(),'55000000-0000-4000-8000-000000010801',1,pg_temp.vals('Cihaz'))$$,'42501','forbidden','device cannot use the edit command');

-- 7. Haftalık özet: arşivli profil kapsam dışı; veri ve takma ad eşlemesi aynı küme -----------------------------------
reset role;
select set_config('t.week',(date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7)::text,true);
insert into public.task_templates(id,family_id,child_id,title,starts_on) values
 ('58000000-0000-4000-8000-000000010811','10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010811','Okuma',current_setting('t.week')::date),
 ('58000000-0000-4000-8000-000000010812','10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010812','Okuma',current_setting('t.week')::date),
 ('58000000-0000-4000-8000-000000010813','10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010812','Çanta',current_setting('t.week')::date),
 ('58000000-0000-4000-8000-000000010814','10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010813','Okuma',current_setting('t.week')::date);
insert into public.task_completions(family_id,child_id,template_id,due_date,status,client_id) values
 ('10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010811','58000000-0000-4000-8000-000000010811',current_setting('t.week')::date+1,'approved',gen_random_uuid()),
 ('10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010812','58000000-0000-4000-8000-000000010812',current_setting('t.week')::date+1,'approved',gen_random_uuid()),
 ('10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010812','58000000-0000-4000-8000-000000010813',current_setting('t.week')::date+2,'done',gen_random_uuid()),
 ('10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010813','58000000-0000-4000-8000-000000010814',current_setting('t.week')::date+3,'done',gen_random_uuid());
insert into public.events(id,family_id,child_id,type,title,starts_at,visible_to_child) values
 ('55000000-0000-4000-8000-000000010811','10000000-0000-4000-8000-000000010803','20000000-0000-4000-8000-000000010812','activity','Haftalık kurs',current_setting('t.week')::date+interval '1 day 10 hours',true);
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000010806','10000000-0000-4000-8000-000000010803');
select lives_ok($$select public.set_child_archived('59000000-0000-4000-8000-000000010811','20000000-0000-4000-8000-000000010811',0,true)$$,'first child archived through the archive action');
select set_config('t.wdata',public.get_weekly_summary_data('10000000-0000-4000-8000-000000010803',current_setting('t.week')::date)::text,true);
select is((select jsonb_agg(c->>'alias' order by c->>'alias') from jsonb_array_elements(current_setting('t.wdata')::jsonb->'children') c),'["Çocuk A","Çocuk B"]'::jsonb,'weekly data: archived profile excluded, aliases contiguous');
select is((select jsonb_agg(c->>'name' order by c->>'alias') from jsonb_array_elements(public.get_family_weekly_review(current_setting('t.week')::date)->'children') c),'["Bora","Cem"]'::jsonb,'weekly review names map to live children (archived profile does not shift aliases)');
select is((select sum((t->>'count')::int)::int from jsonb_array_elements(current_setting('t.wdata')::jsonb->'children') c,jsonb_array_elements(c->'tasks') t),
 (select count(*)::int from public.task_completions where family_id='10000000-0000-4000-8000-000000010803' and child_id in('20000000-0000-4000-8000-000000010812','20000000-0000-4000-8000-000000010813') and due_date>=current_setting('t.week')::date and due_date<current_setting('t.week')::date+7),
 'weekly task count equals the day-screen rows of live children (recorded work)');
select ok(not (current_setting('t.wdata')::jsonb->'children'->0 ? 'events'),'weekly data carries no event counts (nothing archived can leak)');
reset role;
update public.events set archived_at=now() where id='55000000-0000-4000-8000-000000010811';
update public.task_templates set active=false,archived_at=now() where id='58000000-0000-4000-8000-000000010813';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000010806','10000000-0000-4000-8000-000000010803');
select is(public.get_weekly_summary_data('10000000-0000-4000-8000-000000010803',current_setting('t.week')::date)::text,current_setting('t.wdata'),'archiving an event / routine afterwards does not change recorded weekly counts');
select pg_temp.as_a();
select throws_ok($$select public.get_weekly_summary_data('10000000-0000-4000-8000-000000010803',current_setting('t.week')::date)$$,'42501','weekly_forbidden','other family cannot read weekly data');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into gina.weekly_summary_contexts(family_id,week_start,context) values('10000000-0000-4000-8000-000000010803',current_setting('t.week')::date,'{"config":{},"system":"s","schema":{}}');
select is((select child_aliases from gina.weekly_summary_contexts where family_id='10000000-0000-4000-8000-000000010803'),
 '{"Çocuk A":"20000000-0000-4000-8000-000000010812","Çocuk B":"20000000-0000-4000-8000-000000010813"}'::jsonb,'stored alias map built from the same live-child set');

-- 8. P04 öncesi otomatik sıfırlar: önizleme, onaylı düzeltme, idempotency, denetim izi ------------------------------
create function pg_temp.stroke_doc() returns jsonb language sql as $$
 select '{"version":1,"width":1000,"height":1400,"elements":[{"id":"a0000000-0000-4000-8000-000000010801","type":"stroke","color":"#201951","size":4,"points":[[100,100],[200,220],[300,260]]}]}'::jsonb;$$;
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer) values
 ('40000000-0000-4000-8000-000000010801','10000000-0000-4000-8000-000000010801',5,'Fen','Işık','multiple_choice','Işık kaynağı?','[{"key":"A","text":"Güneş"},{"key":"B","text":"Ay"}]','A',null),
 ('40000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801',5,'Fen','Güneş','open_ended','Neden?',null,null,'Kendi ışığı.'),
 ('40000000-0000-4000-8000-000000010803','10000000-0000-4000-8000-000000010801',5,'Fen','Ay','open_ended','Ay neden değil?',null,null,'Yansıtır.'),
 ('40000000-0000-4000-8000-000000010804','10000000-0000-4000-8000-000000010802',5,'Fen','Ay','open_ended','B sorusu',null,null,'x');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('54000000-0000-4000-8000-000000010811','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','L1','Fen',5,array['40000000-0000-4000-8000-000000010801','40000000-0000-4000-8000-000000010802','40000000-0000-4000-8000-000000010803']::uuid[],'completed'),
 ('54000000-0000-4000-8000-000000010812','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','L2','Fen',5,array['40000000-0000-4000-8000-000000010801','40000000-0000-4000-8000-000000010802','40000000-0000-4000-8000-000000010803']::uuid[],'completed'),
 ('54000000-0000-4000-8000-000000010813','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','L3','Fen',5,array['40000000-0000-4000-8000-000000010802']::uuid[],'completed'),
 ('54000000-0000-4000-8000-000000010814','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010801','N1','Fen',5,array['40000000-0000-4000-8000-000000010803']::uuid[],'completed'),
 ('54000000-0000-4000-8000-000000010815','10000000-0000-4000-8000-000000010801','20000000-0000-4000-8000-000000010802','L4','Fen',5,array['40000000-0000-4000-8000-000000010803']::uuid[],'completed'),
 ('54000000-0000-4000-8000-000000010816','10000000-0000-4000-8000-000000010802','20000000-0000-4000-8000-000000010803','LB','Fen',5,array['40000000-0000-4000-8000-000000010804']::uuid[],'completed');
-- Eski kuralla kapanmış denemeler (P04 sütunları null): L1 çizim + boş → 33 graded; L2 veli 80 + boş → 60 graded;
-- L3 tamamen veli puanlı (aday değil); N1 P04 sonrası (provisional dolu); L4 arşivlenecek çocuk; LB başka aile.
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,started_at,finished_at,graded_at,mc_total,mc_correct,open_total,open_graded,score_pct,provisional) values
 ('60000000-0000-4000-8000-000000010811','10000000-0000-4000-8000-000000010801','54000000-0000-4000-8000-000000010811','20000000-0000-4000-8000-000000010801','in_progress',now()-interval '9 days',now()-interval '9 days',now()-interval '9 days',1,1,2,2,33,null),
 ('60000000-0000-4000-8000-000000010812','10000000-0000-4000-8000-000000010801','54000000-0000-4000-8000-000000010812','20000000-0000-4000-8000-000000010801','in_progress',now()-interval '8 days',now()-interval '8 days',now()-interval '8 days',1,1,2,2,60,null),
 ('60000000-0000-4000-8000-000000010813','10000000-0000-4000-8000-000000010801','54000000-0000-4000-8000-000000010813','20000000-0000-4000-8000-000000010801','in_progress',now()-interval '7 days',now()-interval '7 days',now()-interval '7 days',0,0,1,1,70,null),
 ('60000000-0000-4000-8000-000000010814','10000000-0000-4000-8000-000000010801','54000000-0000-4000-8000-000000010814','20000000-0000-4000-8000-000000010801','in_progress',now()-interval '6 days',now()-interval '6 days',null,0,0,1,0,null,true),
 ('60000000-0000-4000-8000-000000010815','10000000-0000-4000-8000-000000010801','54000000-0000-4000-8000-000000010815','20000000-0000-4000-8000-000000010802','in_progress',now()-interval '5 days',now()-interval '5 days',now()-interval '5 days',0,0,1,1,0,null),
 ('60000000-0000-4000-8000-000000010816','10000000-0000-4000-8000-000000010802','54000000-0000-4000-8000-000000010816','20000000-0000-4000-8000-000000010803','in_progress',now()-interval '4 days',now()-interval '4 days',now()-interval '4 days',0,0,1,1,0,null);
insert into public.exam_answers(attempt_id,question_id,answer_key,is_correct,answer_text,answer_document,score,graded_by,graded_at) values
 ('60000000-0000-4000-8000-000000010811','40000000-0000-4000-8000-000000010801','A',true,null,null,null,null,null),
 ('60000000-0000-4000-8000-000000010811','40000000-0000-4000-8000-000000010802',null,null,'',pg_temp.stroke_doc(),null,null,null),
 ('60000000-0000-4000-8000-000000010812','40000000-0000-4000-8000-000000010801','A',true,null,null,null,null,null),
 ('60000000-0000-4000-8000-000000010812','40000000-0000-4000-8000-000000010802',null,null,'Kendi ışığını üretir',null,80,'parent',now()-interval '8 days'),
 ('60000000-0000-4000-8000-000000010812','40000000-0000-4000-8000-000000010803',null,null,'',null,null,null,null),
 ('60000000-0000-4000-8000-000000010813','40000000-0000-4000-8000-000000010802',null,null,'Cevap',null,70,'parent',now()-interval '7 days'),
 ('60000000-0000-4000-8000-000000010815','40000000-0000-4000-8000-000000010803',null,null,'',null,null,null,null),
 ('60000000-0000-4000-8000-000000010816','40000000-0000-4000-8000-000000010804',null,null,'',null,null,null,null);
-- Eski kural kapanışı: saklı toplamlar korunur (in_progress → graded tetikleyici yeniden hesap yapmaz); N1 P04 yolu ile kapanır.
update public.exam_attempts set status='graded' where id::text like '60000000-0000-4000-8000-0000000108%' and id<>'60000000-0000-4000-8000-000000010814';
update public.exam_attempts set status='submitted' where id='60000000-0000-4000-8000-000000010814';
select results_eq($$select count(*)::int from public.exam_attempts where id::text like '60000000-0000-4000-8000-0000000108%' and provisional is null and status='graded'$$,$$values (5)$$,'fixture: five legacy-closed attempts with stored old totals');
create function pg_temp.answers_hash() returns text language sql security definer as $$select md5(string_agg(to_jsonb(a)::text,'|' order by a.attempt_id,a.question_id)) from public.exam_answers a$$;
create function pg_temp.att(id uuid) returns public.exam_attempts language sql security definer as $$select * from public.exam_attempts where exam_attempts.id=$1$$;
select set_config('t.answers',pg_temp.answers_hash(),true);
select set_config('t.n1',md5(to_jsonb(pg_temp.att('60000000-0000-4000-8000-000000010814'))::text),true);
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000010802','10000000-0000-4000-8000-000000010801');
select lives_ok($$select public.set_child_archived('59000000-0000-4000-8000-000000010812','20000000-0000-4000-8000-000000010802',0,true)$$,'second child of A archived (L4 becomes blocked)');
select pg_temp.as_a();
select set_config('t.preview',public.preview_legacy_open_zero_corrections()::text,true);
select results_eq($$select (p->>'eligible')::int,(p->>'blocked')::int,(p->>'already_corrected')::int from (select current_setting('t.preview')::jsonb p) x$$,$$values (2,1,0)$$,'preview: L1+L2 eligible, archived child blocked, nothing corrected yet');
select is((select jsonb_agg(a->>'attempt_id' order by a->>'finished_at') from jsonb_array_elements(current_setting('t.preview')::jsonb->'attempts') a),
 '["60000000-0000-4000-8000-000000010811","60000000-0000-4000-8000-000000010812","60000000-0000-4000-8000-000000010815"]'::jsonb,'preview lists only legacy auto-zero attempts of this family (fully parent-graded L3 and P04-era N1 excluded)');
select results_eq($$select a->'before'->>'score_pct',a->'after'->>'score_pct',a->'after'->>'status',(a->'after'->>'provisional')::boolean,(a->'after'->>'open_pending')::int,(a->'after'->>'open_unanswered')::int,jsonb_array_length(a->'items')
 from jsonb_array_elements(current_setting('t.preview')::jsonb->'attempts') a where a->>'attempt_id'='60000000-0000-4000-8000-000000010811'$$,
 $$values ('33','100','submitted',true,1,1,2)$$,'L1 impact: 33 graded → provisional 100 (MC only), drawing pending, blank unanswered');
select results_eq($$select a->'after'->>'score_pct',(a->'after'->>'open_graded')::int,(a->>'kept_scores')::int from jsonb_array_elements(current_setting('t.preview')::jsonb->'attempts') a where a->>'attempt_id'='60000000-0000-4000-8000-000000010812'$$,
 $$values ('90',1,1)$$,'L2 impact keeps the parent score 80 (90 = avg 100,80)');
select is((pg_temp.att('60000000-0000-4000-8000-000000010811')).score_pct::int,33,'preview writes nothing');
select throws_ok($$select public.preview_legacy_open_zero_corrections('10000000-0000-4000-8000-000000010802')$$,'42501','forbidden','parent cannot preview another family');
select pg_temp.as_device();
select throws_ok($$select public.preview_legacy_open_zero_corrections()$$,'42501','forbidden','device cannot preview');
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array['60000000-0000-4000-8000-000000010811']::uuid[])$$,'42501','forbidden','device cannot apply');
select pg_temp.as_a();
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array[]::uuid[])$$,'P0001','invalid_input','empty selection rejected');
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array['60000000-0000-4000-8000-000000010811','60000000-0000-4000-8000-000000010811']::uuid[])$$,'P0001','invalid_input','duplicate selection rejected');
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array['60000000-0000-4000-8000-000000010811']::uuid[],'10000000-0000-4000-8000-000000010802')$$,'42501','forbidden','parent cannot apply for another family');
select set_config('t.apply',public.apply_legacy_open_zero_corrections('61000000-0000-4000-8000-000000010801',array[
 '60000000-0000-4000-8000-000000010811','60000000-0000-4000-8000-000000010812','60000000-0000-4000-8000-000000010813',
 '60000000-0000-4000-8000-000000010814','60000000-0000-4000-8000-000000010815','60000000-0000-4000-8000-000000010816']::uuid[])::text,true);
select is((select jsonb_object_agg(r->>'attempt_id',r->>'result') from jsonb_array_elements(current_setting('t.apply')::jsonb->'results') r),
 '{"60000000-0000-4000-8000-000000010811":"corrected","60000000-0000-4000-8000-000000010812":"corrected","60000000-0000-4000-8000-000000010813":"not_eligible","60000000-0000-4000-8000-000000010814":"not_eligible","60000000-0000-4000-8000-000000010815":"child_archived","60000000-0000-4000-8000-000000010816":"not_found"}'::jsonb,
 'apply: only eligible own attempts corrected; archived/foreign/ineligible reported, untouched');
select results_eq($$select status::text,score_pct::int,open_graded,open_pending,open_unanswered,provisional,graded_at is null from public.exam_attempts where id in('60000000-0000-4000-8000-000000010811','60000000-0000-4000-8000-000000010812') order by id$$,
 $$values ('submitted',100,0,1,1,true,true),('submitted',90,1,0,1,true,true)$$,'corrected attempts follow the P04 rule and match the preview');
select is(pg_temp.answers_hash(),current_setting('t.answers'),'no answer, parent score or AI score changed');
select is(md5(to_jsonb(pg_temp.att('60000000-0000-4000-8000-000000010814'))::text),current_setting('t.n1'),'P04-era attempt untouched');
select results_eq($$select (pg_temp.att('60000000-0000-4000-8000-000000010813')).score_pct::int,(pg_temp.att('60000000-0000-4000-8000-000000010815')).score_pct::int$$,$$values (70,0)$$,'parent-graded and archived-child attempts keep their stored result');
select is((select jsonb_agg(c->>'attempt_id' order by c->>'attempt_id') from jsonb_array_elements(public.get_legacy_open_zero_corrections()) c),
 '["60000000-0000-4000-8000-000000010811","60000000-0000-4000-8000-000000010812"]'::jsonb,'audit trail lists both corrections');
select results_eq($$select c->'before'->>'score_pct',c->'after'->>'score_pct',c->>'applied_role' from jsonb_array_elements(public.get_legacy_open_zero_corrections()) c where c->>'attempt_id'='60000000-0000-4000-8000-000000010811'$$,
 $$values ('33','100','parent')$$,'audit keeps before/after and actor role');
select is(public.apply_legacy_open_zero_corrections('61000000-0000-4000-8000-000000010801',array[
 '60000000-0000-4000-8000-000000010816','60000000-0000-4000-8000-000000010815','60000000-0000-4000-8000-000000010814',
 '60000000-0000-4000-8000-000000010813','60000000-0000-4000-8000-000000010812','60000000-0000-4000-8000-000000010811']::uuid[])::text,current_setting('t.apply'),'same request (any order) returns the same result');
select is((public.apply_legacy_open_zero_corrections(gen_random_uuid(),array['60000000-0000-4000-8000-000000010811']::uuid[])->'results'->0->>'result'),'already_corrected','new request on a corrected attempt: already_corrected');
select is((pg_temp.att('60000000-0000-4000-8000-000000010811')).score_pct::int,100,'second call changed nothing');
select throws_ok($$select public.apply_legacy_open_zero_corrections('61000000-0000-4000-8000-000000010801',array['60000000-0000-4000-8000-000000010811']::uuid[])$$,'P0001','request_conflict','same request id with a different selection is a conflict');
select is((public.preview_legacy_open_zero_corrections()->>'eligible')::int,0,'after correction nothing left to apply for A');
select pg_temp.as_b();
select is((select jsonb_agg(a->>'attempt_id') from jsonb_array_elements(public.preview_legacy_open_zero_corrections()->'attempts') a),'["60000000-0000-4000-8000-000000010816"]'::jsonb,'family B previews only its own attempt');
select is(jsonb_array_length(public.get_legacy_open_zero_corrections()),0,'family B sees no A audit rows');
-- yönetici: aile başına sayı; belirli aile için onaylı uygulama
select pg_temp.as_admin();
select is((select (p->>'total')::int from (select public.preview_legacy_open_zero_corrections() p) x),2,'admin overview counts remaining candidates (A archived-child + B)');
select ok(not (public.preview_legacy_open_zero_corrections()::text ~ 'Deniz|Ada|Can'),'admin overview carries no child names');
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array['60000000-0000-4000-8000-000000010816']::uuid[])$$,'42501','forbidden','admin must name the family');
select is((public.apply_legacy_open_zero_corrections('61000000-0000-4000-8000-000000010802',array['60000000-0000-4000-8000-000000010816']::uuid[],'10000000-0000-4000-8000-000000010802')->>'corrected')::int,1,'admin applies for a named family');
select is((select c->>'applied_role' from jsonb_array_elements(public.get_legacy_open_zero_corrections('10000000-0000-4000-8000-000000010802')) c),'admin','admin correction audited with role');
reset role;
delete from public.admins where user_id='00000000-0000-4000-8000-000000010805';
set local role authenticated;
select pg_temp.as_admin();
select throws_ok($$select public.preview_legacy_open_zero_corrections()$$,'42501','forbidden','revoked admin cannot preview');
reset role;
set local role anon;
select throws_ok($$select public.preview_legacy_open_zero_corrections()$$,'42501',null,'anonymous rejected');
reset role;

select * from finish();
rollback;
