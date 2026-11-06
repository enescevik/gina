begin;
select no_plan();
-- C05: target registry, extraction queue → done, publish gating on the approved revision, no cross-term reuse,
-- changed source vs assigned exam, freshness v2 without substitution, reasoned content-fit review.
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000011101','pipe-parent@test.local'),('00000000-0000-4000-8000-000000011102','pipe-editor@test.local'),('00000000-0000-4000-8000-000000011103','pipe-other-parent@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000011102');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000011101','Pipeline test','00000000-0000-4000-8000-000000011101'),('10000000-0000-4000-8000-000000011103','Other family','00000000-0000-4000-8000-000000011103');
insert into public.family_members(user_id,family_id) values('00000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101'),('00000000-0000-4000-8000-000000011103','10000000-0000-4000-8000-000000011103');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101','Test child',5);
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000011101','plus','Synthetic pipeline test',now()+interval '1 day');
insert into public.prova_drafts(id,family_id,created_by,content) values('30000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101','00000000-0000-4000-8000-000000011101','{"childId":"20000000-0000-4000-8000-000000011101","grade":5,"subjects":["Türkçe"],"purpose":"written"}');
update public.app_settings set value='true' where key='curriculum_catalog.enabled';

create function pg_temp.admin() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011102","role":"authenticated","gina":{"role":"parent","admin":true}}',true)$$;
create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011101","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011101"}}',true)$$;
create function pg_temp.other() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011103","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011103"}}',true)$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
create function pg_temp.target(y text,t int,url text,st text default 'active') returns jsonb language sql as $$select jsonb_build_object('exam_family','oyss','school_year',y,'term',t,'index_url',url,'status',st,'note','Resmî dizin sayfası test için')$$;
create function pg_temp.source(y text default '2026-2027',t int default 1,url text default 'https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724') returns jsonb language sql as $$select jsonb_build_object('source_key','oyss:'||y||':'||t||':turkce','exam_family','oyss','school_year',y,'term',t,'label','Türkçe','index_url',url,'link_url','https://meb.ai/ankmeb4','index_published_on','2026-09-07','index_updated_on','2026-09-10','error',null)$$;
create function pg_temp.rev(sha text) returns jsonb language sql as $$select jsonb_build_object('sha256',sha,'bytes',31410,'mime','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','resolved_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','redirect_chain','[]'::jsonb,'inspection','{"entries":12,"flags":[]}'::jsonb,'storage_path',null)$$;
create function pg_temp.cand(sha text,k text default 'tr-2026-2027-t1-turkce2-g5-c6',term int default 1,subject text default 'Türkçe',text2 text default 'T.O.5.7. Görselle iletilen anlamı belirleyebilme') returns jsonb language sql as $$select jsonb_build_object('key',k,'academic_year','2026-2027','term',term,'exam',1,'grade',5,'subject',subject,'label','Senaryo 1',
 'source_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','source_sha256',sha,'sheet','5. Sınıf','header_cell','C6','question_count',3,
 'blocks',jsonb_build_array(jsonb_build_object('count',2,'count_cell','C12','outcomes',jsonb_build_array(jsonb_build_object('cell','B12','text','T.O.5.6. Metnin yüzey anlamını belirleyebilme','code','T.O.5.6'),jsonb_build_object('cell','B13','text',text2,'code','T.O.5.7'))),
  jsonb_build_object('count',1,'count_cell','C21','outcomes',jsonb_build_array(jsonb_build_object('cell','B21','text','T.O.5.20. Söz varlığı çözümlemesi','code','T.O.5.20')))),
 'review_reasons',jsonb_build_array('programme_and_school_scope_required','source_review_required'))$$;
create function pg_temp.extraction(cands jsonb,outcome text default 'done',err text default null) returns jsonb language sql as $$select jsonb_build_object('outcome',outcome,'extractor','extract-meb-scenarios@c05','scenarios',coalesce(jsonb_array_length(cands),0),'issues',0,'error',err,
 'bundle',case when cands is null then null else jsonb_build_object('schema','gina.curriculum-review.v1','candidates',cands) end)$$;
create function pg_temp.review() returns jsonb language sql as $$select '{"programme":"Test programme version","school_scope":"Synthetic scope for testing only","programme_url":"https://tymm.meb.gov.tr/ogretim-programlari","source_checked":true,"counts_checked":true,"applicability_checked":true,"issues_resolution":"Synthetic evidence reviewed for test only.","note":"Test source review, not real catalogue approval."}'::jsonb$$;
create function pg_temp.fit(d text,reason text,ids jsonb,rev int,ok boolean default true) returns jsonb language sql as $$select jsonb_build_object('decision',d,'reason',reason,'measured_outcome_ids',ids,'revision',rev,'confirmed',ok)$$;

-- 1. Target registry. The live-checked 2026–27/1 index is seeded; anything else is an explicit admin action.
set local role authenticated;select pg_temp.parent();
select throws_ok($$select public.admin_list_curriculum_source_targets()$$,'42501',null,'parent cannot read target registry');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/x'))$$,'42501',null,'parent cannot add a target');
select throws_ok($$select public.get_curriculum_source_target('oyss','2026-2027',1)$$,'42501',null,'registry lookup is service-only');
select pg_temp.admin();
select is(jsonb_array_length(public.admin_list_curriculum_source_targets()),1,'one seeded target');
select is(public.admin_list_curriculum_source_targets()->0->>'school_year'||'/'||(public.admin_list_curriculum_source_targets()->0->>'term'),'2026-2027/1','seed is the live-checked term');
select is((public.admin_list_curriculum_source_targets()->0->>'system_seed')::boolean,true,'seed is marked as system seed');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://example.com/odsgm'))$$,'P0001','curriculum_target_host','foreign host rejected');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'http://odsgm.meb.gov.tr/x'))$$,'P0001','curriculum_target_host','plain http rejected');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://meb.ai/abc'))$$,'P0001','curriculum_target_host','shortener cannot be an index page');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://cdn.eba.gov.tr/x'))$$,'P0001','curriculum_target_host','file CDN cannot be an index page');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr.evil.invalid/x'))$$,'P0001','curriculum_target_host','lookalike host rejected');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2028',2,'https://odsgm.meb.gov.tr/x'))$$,'P0001','curriculum_target_invalid','non-consecutive school year rejected');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',3,'https://odsgm.meb.gov.tr/x'))$$,'P0001','curriculum_target_invalid','term must be 1 or 2');
select throws_ok($$select public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/x')||'{"approved":true}')$$,'P0001','curriculum_target_invalid','unknown keys rejected');
select set_config('test.t2',public.admin_save_curriculum_source_target('61100000-0000-4000-8000-000000000001',pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/www/2donem-test/icerik/1'))::text,true);
select is(current_setting('test.t2')::jsonb->>'action','created','new term target created by admin');
select is(public.admin_save_curriculum_source_target('61100000-0000-4000-8000-000000000001',pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/www/2donem-test/icerik/1'))::text,current_setting('test.t2'),'replay returns the same receipt');
select throws_ok($$select public.admin_save_curriculum_source_target('61100000-0000-4000-8000-000000000001',pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/www/other'))$$,'P0001','request_conflict','same request with different target rejected');
select is(public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/www/2donem-test/icerik/1'))->>'action','unchanged','same target again is not new work');
reset role;
select is((select count(*)::int from public.audit_log where action like 'curriculum.target_%'),1,'one audit entry for the new target');
set local role service_role;select pg_temp.service();
select is(public.get_curriculum_source_target('oyss','2026-2027',2)->>'index_url','https://odsgm.meb.gov.tr/www/2donem-test/icerik/1','Edge resolves the registered term-2 page');
select is(public.get_curriculum_source_target('oyss','2027-2028',1),null,'unknown year has no page: nothing guessed');
-- A fetch for a year/term without a registered index cannot be recorded (defence in depth behind the Edge check).
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000011102',pg_temp.source('2027-2028',1,'https://odsgm.meb.gov.tr/www/guess/1'),pg_temp.rev(repeat('a',64)))$$,'P0001','curriculum_target_missing','unregistered year/term cannot be recorded');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000011102',pg_temp.source('2026-2027',2,'https://odsgm.meb.gov.tr/www/not-the-registered-page'),pg_temp.rev(repeat('a',64)))$$,'P0001','curriculum_target_missing','index page must be the registered one');
set local role authenticated;select pg_temp.admin();
select is(public.admin_save_curriculum_source_target(gen_random_uuid(),pg_temp.target('2026-2027',2,'https://odsgm.meb.gov.tr/www/2donem-test/icerik/1','retired'))->>'action','updated','target can be retired');
set local role service_role;select pg_temp.service();
select is(public.get_curriculum_source_target('oyss','2026-2027',2),null,'retired target is not used for new fetches');

-- 2. Freshness v2 (parent): exact year/term only; reasons are explicit; nothing substituted.
set local role authenticated;select pg_temp.parent();
select is(public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'reason','source_not_fetched','registered index, no fetched source yet');
select is(public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'status','unpublished','v1-compatible status');
select is(public.get_curriculum_source_status('2027-2028',1,'Türkçe')->>'reason','no_official_index','future year without index');
select is((public.get_curriculum_source_status('2027-2028',1,'Türkçe')->>'substituted')::boolean,false,'no other year substituted');
select is(public.get_curriculum_source_status('2026-2027',2,'Türkçe')->>'reason','no_official_index','retired term-2 target is not a source');
select is(public.get_curriculum_source_status('2026-2027',2,'Türkçe')->'requested'->>'term','2','requested term echoed, not replaced by term 1');
select throws_ok($$select public.get_curriculum_source_status('2026',1,'Türkçe')$$,'P0001','invalid_input','malformed year rejected');
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe'),'{"status":"unpublished","alternative":"free_study","officially_verified":false}'::jsonb,'v1 contract unchanged');

-- 3. Fetch → extraction queue → done (idempotent import, hash/term/subject bound).
set local role service_role;select pg_temp.service();
select set_config('test.rx',public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000011102',pg_temp.source(),pg_temp.rev(repeat('a',64)))::text,true);
select is(current_setting('test.rx')::jsonb->>'extraction_status','queued','new revision queues extraction');
set local role authenticated;select pg_temp.parent();
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64)))))$$,'42501',null,'parent cannot complete extraction');
select pg_temp.admin();
select is(jsonb_array_length(public.admin_curriculum_pipeline()->'queue'),1,'pipeline view lists the queued revision');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('b',64)))))$$,'P0001','curriculum_extraction_hash_mismatch','candidates from other bytes rejected');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64),'tr-2026-2027-t2-turkce2-g5-c6',2))))$$,'P0001','curriculum_term_mismatch','term-2 candidate cannot come from a term-1 source');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64),'tr-x',1,'Fen Bilimleri'))))$$,'P0001','curriculum_scope_mismatch','other subject rejected');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64))))||'{"scenarios":2}')$$,'P0001','curriculum_count_mismatch','declared count must match the bundle');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64))||'{"question_count":4}')))$$,'P0001','curriculum_count_mismatch','block total must match question count');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(null,'failed',null))$$,'P0001','curriculum_extraction_invalid','failure needs a reason');
select set_config('test.ex',public.admin_record_curriculum_extraction('61100000-0000-4000-8000-000000000002',(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-d6'))))::text,true);
select is(current_setting('test.ex')::jsonb->>'extraction_status','done','queued → done');
select is((current_setting('test.ex')::jsonb->'extraction'->>'created')::int,2,'two candidates imported');
select is(public.admin_record_curriculum_extraction('61100000-0000-4000-8000-000000000002',(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-d6'))))::text,current_setting('test.ex'),'lost response replays exactly');
select is(public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-d6'))))->>'outcome','unchanged','same extraction again: no duplicate candidates');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('a',64)))))$$,'P0001','curriculum_extraction_conflict','different output for the same bytes is not silently overwritten');
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,pg_temp.extraction(null,'failed','late failure'))$$,'P0001','curriculum_extraction_conflict','done extraction cannot be marked failed');
select is(jsonb_array_length(public.admin_curriculum_pipeline()->'queue'),0,'queue drained');
reset role;
select is((select count(*)::int from gina.curriculum_candidates),2,'exactly two candidates after repeats');
select is((select count(*)::int from public.audit_log where action='curriculum.extraction_done'),1,'one extraction audit entry');
set local role authenticated;select pg_temp.admin();
select is(public.admin_list_curriculum_sources()->0->'revisions'->0->'extraction'->>'outcome','done','extraction summary visible on the source');
select is((select count(*)::int from jsonb_array_elements(public.admin_curriculum_pipeline()->'candidates') x where x->>'source_status'='pending_review'),2,'candidates show their source is still pending review');

-- 4. Review + publish gated on the approved revision.
select set_config('test.c1',(select x->>'id' from jsonb_array_elements(public.admin_list_curriculum_candidates()) x where x->>'key'='tr-2026-2027-t1-turkce2-g5-c6'),true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c1')::uuid,0,'review',pg_temp.review(),'Reviewed cells',true);
select throws_ok($$select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c1')::uuid,1,'publish',null,'Publish',true)$$,'P0001','curriculum_source_not_approved','cannot publish from an unapproved source revision');
select is(public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.rx')::jsonb->>'revision_id')::uuid,'approve','Hash and cells reviewed',true)->>'status','approved','admin approves the source revision separately');
select is(public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c1')::uuid,1,'publish',null,'Publish',true)->>'replaced_previous','0','publication after approval; nothing replaced');
select pg_temp.parent();
select is(public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'status','verified','parent sees verified');
select is((public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'stale')::boolean,false,'fresh check is not stale');
select set_config('test.bp',public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000011101','catalogue_id',current_setting('test.c1'),'revision',2,'subject','Türkçe','confirmed',true))::text,true);
reset role;
update gina.curriculum_sources set last_checked_at=now()-interval '10 days';
set local role authenticated;select pg_temp.parent();
select is((public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'stale')::boolean,true,'10-day-old check is stale');
select is((public.get_curriculum_source_status('2026-2027',1,'Türkçe')->>'stale_days')::int,10,'stale age shown');
reset role;
update gina.curriculum_sources set last_checked_at=now();

-- Generated questions (shape written by finishGeneration) and an assigned exam built from them.
insert into public.question_bank(id,family_id,grade,subject,topic,scenario_code,kind,stem,expected_answer,solution,provenance,created_by) values
 ('40000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101',5,'Türkçe','Blok 1','Senaryo 1','open_ended','Soru 1','Cevap 1','Çözüm 1',jsonb_build_object('generator','ai','catalogue_id',current_setting('test.c1'),'catalogue_revision',2,'block_id','B1','outcome_ids','["T.O.5.6","T.O.5.7"]'::jsonb,'content_fit','pending_human_review'),'00000000-0000-4000-8000-000000011101'),
 ('40000000-0000-4000-8000-000000011102','10000000-0000-4000-8000-000000011101',5,'Türkçe','Blok 1','Senaryo 1','open_ended','Soru 2','Cevap 2','Çözüm 2',jsonb_build_object('generator','ai','catalogue_id',current_setting('test.c1'),'catalogue_revision',2,'block_id','B1','outcome_ids','["T.O.5.6"]'::jsonb,'content_fit','pending_human_review'),'00000000-0000-4000-8000-000000011101'),
 ('40000000-0000-4000-8000-000000011103','10000000-0000-4000-8000-000000011101',5,'Türkçe','Blok 2','Senaryo 1','open_ended','Soru 3','Cevap 3','Çözüm 3',jsonb_build_object('generator','ai','catalogue_id',current_setting('test.c1'),'catalogue_revision',2,'block_id','B2','outcome_ids','["T.O.5.20"]'::jsonb,'content_fit','pending_human_review'),'00000000-0000-4000-8000-000000011101'),
 ('40000000-0000-4000-8000-000000011104','10000000-0000-4000-8000-000000011101',5,'Türkçe','Serbest','','open_ended','Serbest soru','Cevap','Çözüm','{"generator":"ai"}','00000000-0000-4000-8000-000000011101');
insert into public.exams(id,family_id,child_id,blueprint_id,title,subject,grade,question_ids,status,created_by) values('50000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101','20000000-0000-4000-8000-000000011101',current_setting('test.bp')::uuid,'Senaryo provası','Türkçe',5,
 array['40000000-0000-4000-8000-000000011101','40000000-0000-4000-8000-000000011102','40000000-0000-4000-8000-000000011103']::uuid[],'assigned','00000000-0000-4000-8000-000000011101');
select is((select count(*)::int from gina.scenario_question_fit),3,'scenario-bound questions queue a pending fit review; free questions do not');
create temp table frozen as select (select to_jsonb(e) from public.exams e where e.id='50000000-0000-4000-8000-000000011101') exam,(select snapshot from gina.catalog_blueprint_links) snap,(select jsonb_agg(to_jsonb(q) order by id) from public.question_bank q) qs,(select to_jsonb(b)-'updated_at' from public.exam_blueprints b) bp;
grant select on frozen to authenticated,service_role;

-- 5. Changed source: new hash → diff review → new extraction → publication replaces the old candidate for NEW
-- selections only; the assigned exam, its questions and the family's frozen copy are byte-identical.
set local role service_role;select pg_temp.service();
select set_config('test.rz',public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000011102',pg_temp.source(),pg_temp.rev(repeat('c',64)))::text,true);
select is(current_setting('test.rz')::jsonb->>'status','diff_review_required','changed bytes need diff review');
select is(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000011102',pg_temp.source(),pg_temp.rev(repeat('c',64)))->>'outcome','unchanged','same changed file again: no duplicate revision');
set local role authenticated;select pg_temp.admin();
select is(public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rz')::jsonb->>'revision_id')::uuid,pg_temp.extraction(null,'failed','worksheet_path'))->>'extraction_status','failed','failed extraction recorded with reason');
select is(jsonb_array_length(public.admin_curriculum_pipeline()->'queue'),1,'failed extraction stays visible for retry');
select is(public.admin_record_curriculum_extraction(gen_random_uuid(),(current_setting('test.rz')::jsonb->>'revision_id')::uuid,pg_temp.extraction(jsonb_build_array(pg_temp.cand(repeat('c',64),'tr-2026-2027-t1-turkce2-g5-c6',1,'Türkçe','T.O.5.7. Görselle iletilen anlamı belirleyebilme (güncellendi)'))))->>'extraction_status','done','retry after failure completes');
select set_config('test.c2',(select x->>'id' from jsonb_array_elements(public.admin_list_curriculum_candidates()) x where x->>'key'='tr-2026-2027-t1-turkce2-g5-c6' and x->>'status'='draft'),true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c2')::uuid,0,'review',pg_temp.review(),'Diff reviewed',true);
select throws_ok($$select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c2')::uuid,1,'publish',null,'Publish new',true)$$,'P0001','curriculum_source_not_approved','diff revision must be approved first');
select is(public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.rz')::jsonb->>'revision_id')::uuid,'approve','Outcome wording changed in B13',true)->>'status','approved','new revision approved');
select is(public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.c2')::uuid,1,'publish',null,'Publish new',true)->>'replaced_previous','1','old published candidate with the same key closed for new selections');
reset role;
select is((select status from gina.curriculum_candidates where id=current_setting('test.c1')::uuid),'withdrawn','old candidate withdrawn, not deleted');
select is((select to_jsonb(e) from public.exams e where e.id='50000000-0000-4000-8000-000000011101'),(select exam from frozen),'assigned exam unchanged');
select is((select jsonb_agg(to_jsonb(q) order by id) from public.question_bank q),(select qs from frozen),'generated questions unchanged');
select is((select snapshot from gina.catalog_blueprint_links),(select snap from frozen),'family frozen snapshot unchanged');
select is((select to_jsonb(b)-'updated_at' from public.exam_blueprints b),(select bp from frozen),'family blueprint unchanged');
set local role authenticated;select pg_temp.parent();
select is(jsonb_array_length(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000011101','2026-2027',1,1,'Türkçe')),1,'one selectable scenario');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000011101','2026-2027',1,1,'Türkçe')->0->'candidate'->>'source_sha256',repeat('c',64),'new selections use the new approved revision');
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000011101','2026-2027',2,1,'Türkçe'),'[]'::jsonb,'term 2 does not borrow term-1 scenarios');
set local role service_role;select pg_temp.service();
select is(public.reserve_catalog_prova_generation('70000000-0000-4000-8000-000000011101','10000000-0000-4000-8000-000000011101','00000000-0000-4000-8000-000000011101',repeat('a',64),3,current_setting('test.bp')::uuid,'30000000-0000-4000-8000-000000011101')->>'error','curriculum_unavailable','new generation from the superseded copy stops without charging');
reset role;
select is((select count(*)::int from public.prova_generation_jobs),0,'no job reserved for the superseded copy');

-- 6. Reasoned content-fit review. Pending is never success; AI suggestion is separate from the human decision.
set local role authenticated;select pg_temp.parent();
select set_config('test.ids','{40000000-0000-4000-8000-000000011101,40000000-0000-4000-8000-000000011102,40000000-0000-4000-8000-000000011103}',true);
select is((public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'summary'->>'pending_human_review')::int,3,'all three pending');
select is((public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'summary'->>'accepted')::boolean,false,'pending is not accepted');
select is(jsonb_array_length(public.get_scenario_question_fit('{40000000-0000-4000-8000-000000011104}')->'items'),0,'free question has no scenario fit record');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','kısa','["T.O.5.6"]',0))$$,'P0001','content_fit_reason_required','reason must be substantive');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ölçüyor.','["T.O.5.6"]',0,false))$$,'P0001','content_fit_reason_required','explicit confirmation required');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ölçüyor.','[]',0))$$,'P0001','content_fit_outcome_mismatch','fit needs a measured outcome');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ölçüyor.','["T.O.5.20"]',0))$$,'P0001','content_fit_outcome_mismatch','outcome outside the question block rejected');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('approved','Soru metnin yüzey anlamını ölçüyor.','["T.O.5.6"]',0))$$,'P0001','content_fit_reason_required','unknown decision rejected');
select pg_temp.other();
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ölçüyor.','["T.O.5.6"]',0))$$,'42501',null,'other family cannot review');
select is(jsonb_array_length(public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'items'),0,'other family sees nothing');
select throws_ok($$select public.record_scenario_question_fit_suggestion('40000000-0000-4000-8000-000000011101','{"decision_reason":"all_checks_passed","confidence":0.9,"findings":[],"recommendation":"approve"}')$$,'42501',null,'parent cannot write AI suggestion');
set local role service_role;select pg_temp.service();
select throws_ok($$select public.record_scenario_question_fit_suggestion('40000000-0000-4000-8000-000000011101','{"confidence":0.9}')$$,'P0001','prereview_verdict_invalid','AI suggestion needs the E01 verdict shape');
select is(public.record_scenario_question_fit_suggestion('40000000-0000-4000-8000-000000011101','{"decision_reason":"all_checks_passed","confidence":0.93,"findings":[],"recommendation":"approve","rubric":{"measures_target_skill":"yes"}}')->>'decision','pending_human_review','AI approve suggestion does not decide');
set local role authenticated;select pg_temp.parent();
select set_config('test.f1',public.review_scenario_question_fit('61100000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ve görsel anlamı birlikte ölçüyor.','["T.O.5.6","T.O.5.7"]',0))::text,true);
select is(current_setting('test.f1')::jsonb->>'decision','fit','reasoned fit recorded');
select is((current_setting('test.f1')::jsonb->>'ai_is_decision')::boolean,false,'projection says AI is not the decision');
select is(public.review_scenario_question_fit('61100000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000011101',pg_temp.fit('fit','Soru metnin yüzey anlamını ve görsel anlamı birlikte ölçüyor.','["T.O.5.6","T.O.5.7"]',0))::text,current_setting('test.f1'),'replay returns the same decision');
select throws_ok($$select public.review_scenario_question_fit('61100000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000011101',pg_temp.fit('not_fit','Soru metnin yüzey anlamını ölçmüyor aslında.','[]',0))$$,'P0001','request_conflict','same request different decision rejected');
select throws_ok($$select public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011101',pg_temp.fit('not_fit','Soru metnin yüzey anlamını ölçmüyor aslında.','[]',0))$$,'P0001','content_fit_revision_conflict','stale revision rejected');
select is(public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011102',pg_temp.fit('not_fit','Soru çıktıyı değil yazım kuralını ölçüyor; uygun değil.','[]',0))->>'decision','not_fit','reasoned not_fit recorded');
select is(public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011103',pg_temp.fit('fit','Söz varlığı çözümlemesi isteniyor; çıktı ile uyumlu.','["T.O.5.20"]',0))->>'decision','fit','third fit');
select is((public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'summary'->>'accepted')::boolean,false,'one not_fit keeps the set unaccepted');
select is(public.review_scenario_question_fit(gen_random_uuid(),'40000000-0000-4000-8000-000000011102',pg_temp.fit('fit','Revize edilen soru artık yüzey anlamını ölçüyor.','["T.O.5.6"]',1))->>'decision','fit','re-review after revision');
select is((public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'summary'->>'accepted')::boolean,true,'accepted only when every question has a reasoned fit');
select is((public.get_scenario_question_fit(current_setting('test.ids')::uuid[])->'summary'->>'fit')::int,3,'three fit');
reset role;
select is((select count(*)::int from public.question_bank where provenance->>'content_fit'='pending_human_review'),3,'generation-time provenance label is not rewritten');
select is((select ai_suggestion->>'recommendation' from gina.scenario_question_fit where question_id='40000000-0000-4000-8000-000000011101'),'approve','AI suggestion kept beside the human decision');
set local role authenticated;
select throws_ok($$select * from gina.scenario_question_fit$$,'42501',null,'no direct table access for API roles');
reset role;
select * from finish();rollback;
