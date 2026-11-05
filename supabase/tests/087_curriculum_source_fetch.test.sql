begin;
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000008701','fetch-parent@test.local'),('00000000-0000-4000-8000-000000008702','fetch-editor@test.local'),('00000000-0000-4000-8000-000000008703','fetch-editor-two@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000008702'),('00000000-0000-4000-8000-000000008703');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000008701','Fetch test','00000000-0000-4000-8000-000000008701');
insert into public.family_members(user_id,family_id) values('00000000-0000-4000-8000-000000008701','10000000-0000-4000-8000-000000008701');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000008701','10000000-0000-4000-8000-000000008701','Test child',5);
create function pg_temp.bundle() returns jsonb language sql as $$select '
{"schema": "gina.curriculum-review.v1", "candidates": [{"key": "tr-2026-2027-t1-turkce2-g5-c6", "academic_year": "2026-2027", "term": 1, "exam": 1, "grade": 5, "subject": "Türkçe", "source_url": "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx", "source_sha256": "6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee", "sheet": "5. Sınıf", "header_cell": "C6", "question_count": 3, "blocks": [{"count": 2, "count_cell": "C12", "outcomes": [{"cell": "B12", "text": "T.O.5.6. Metnin yüzey anlamını belirleyebilme", "code": "T.O.5.6"},{"cell": "B13", "text": "T.O.5.7. Görselle iletilen anlamı belirleyebilme", "code": "T.O.5.7"}]}, {"count": 1, "count_cell": "C21", "outcomes": [{"cell": "B21", "text": "T.O.5.20. Metinden hareketle söz varlığını geliştirmeye yönelik çözümleme yapabilme", "code": "T.O.5.20"}]}], "label": "Senaryo 1", "review_reasons": ["programme_and_school_scope_required", "source_review_required"]}]}
'::jsonb$$;
create function pg_temp.review() returns jsonb language sql as $$select '{"programme":"Test programme version","school_scope":"Synthetic scope for testing only","programme_url":"https://tymm.meb.gov.tr/ogretim-programlari","source_checked":true,"counts_checked":true,"applicability_checked":true,"issues_resolution":"Synthetic evidence reviewed for test only.","note":"Test source review, not real catalogue approval."}'::jsonb$$;
create function pg_temp.source(err text default null) returns jsonb language sql as $$select jsonb_build_object('source_key','oyss:2026-2027:1:turkce2','exam_family','oyss','school_year','2026-2027','term',1,'label','Türkçe','index_url','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','link_url','https://meb.ai/ankmeb4','index_published_on','2026-09-07','index_updated_on','2026-09-10','error',err)$$;
create function pg_temp.rev(sha text) returns jsonb language sql as $$select jsonb_build_object('sha256',sha,'bytes',31410,'mime','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','resolved_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','redirect_chain','[{"url":"https://meb.ai/ankmeb4","status":302},{"url":"https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx","status":200}]'::jsonb,'inspection','{"entries":12,"flags":[]}'::jsonb,'storage_path','curriculum/2026-2027-t1/'||sha||'.xlsx')$$;
update public.app_settings set value='true' where key='curriculum_catalog.enabled';

-- Existing chain: import → review → publish → family selects a frozen copy.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008702","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select public.admin_import_curriculum_candidates(gen_random_uuid(),pg_temp.bundle());
select set_config('test.cid',public.admin_list_curriculum_candidates()->0->>'id',true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.cid')::uuid,0,'review',pg_temp.review(),'Test review',true);
select public.admin_change_curriculum_candidate(gen_random_uuid(),current_setting('test.cid')::uuid,1,'publish',null,'Test publication',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008701","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000008701"}}',true);
select set_config('test.bp',public.save_catalog_blueprint(gen_random_uuid(),jsonb_build_object('child_id','20000000-0000-4000-8000-000000008701','catalogue_id',current_setting('test.cid'),'revision',2,'subject','Türkçe','confirmed',true))::text,true);

-- Acceptance 5/6: roles. Parent and anonymous callers cannot record fetches or read the admin queue.
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('a',64)))$$,'42501',null,'parent cannot record a source fetch');
select throws_ok($$select public.admin_list_curriculum_sources()$$,'42501','forbidden','parent cannot read source queue');
select throws_ok($$select * from gina.curriculum_sources$$,'42501',null,'no direct table access');
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe'),'{"status":"unpublished","alternative":"free_study","officially_verified":false}'::jsonb,'no fetched source yet: explicit free-study alternative, no other year chosen');

-- Acceptance 1/6: service role on behalf of a verified admin only.
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008701',pg_temp.source(),pg_temp.rev(repeat('a',64)))$$,'42501','forbidden','non-admin actor rejected even via service role');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source()||'{"link_url":"http://meb.ai/ankmeb4"}',pg_temp.rev(repeat('a',64)))$$,'P0001','curriculum_source_invalid','plain http link rejected');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('a',64))||'{"resolved_url":"https://meb.ai/ankmeb4"}')$$,'P0001','curriculum_source_invalid','meb.ai cannot be a final file host');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('a',64))||'{"resolved_url":"https://cdn.eba.gov.tr.evil.invalid/x.xlsx"}')$$,'P0001','curriculum_source_invalid','official-looking foreign host rejected');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('a',64))||'{"bytes":6000000}')$$,'P0001',null,'oversized file rejected');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source('timeout'),pg_temp.rev(repeat('a',64)))$$,'P0001','curriculum_source_invalid','a result cannot carry both a revision and a failure');
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source()||'{"approved":true}',pg_temp.rev(repeat('a',64)))$$,'P0001',null,'approval cannot be supplied by the fetch');

-- First fetch of the hash already published from the manifest: pending review, nothing approved yet.
select set_config('test.r1',public.record_curriculum_source_fetch('60000000-0000-4000-8000-000000008701','00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev('6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee'))::text,true);
select is(current_setting('test.r1')::jsonb->>'outcome','new_revision','first fetch records a revision');
select is(current_setting('test.r1')::jsonb->>'status','pending_review','fetch never approves');
select is(current_setting('test.r1')::jsonb->>'extraction_status','queued','extraction job queued once');
select is(public.record_curriculum_source_fetch('60000000-0000-4000-8000-000000008701','00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev('6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee'))::text,current_setting('test.r1'),'lost response replays exactly');
select throws_ok($$select public.record_curriculum_source_fetch('60000000-0000-4000-8000-000000008701','00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('b',64)))$$,'P0001','request_conflict','same request different bytes rejected');
select throws_ok($$select public.record_curriculum_source_fetch('60000000-0000-4000-8000-000000008701','00000000-0000-4000-8000-000000008703',pg_temp.source(),pg_temp.rev('6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee'))$$,'P0001','request_conflict','receipt scoped to initiating admin');

-- Acceptance 6: repeat with same hash → no new revision, no second job, only last_checked_at moves.
select set_config('test.r2',public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev('6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee'))::text,true);
select is(current_setting('test.r2')::jsonb->>'outcome','unchanged','same hash is not new work');
select is(current_setting('test.r2')::jsonb->>'revision_id',current_setting('test.r1')::jsonb->>'revision_id','same revision row');
reset role;
select is((select count(*)::int from gina.curriculum_source_revisions),1,'single revision after repeat');
select is((select count(*)::int from public.audit_log where action='curriculum.source_revision'),1,'one audit entry, repeat logged nothing new');
select ok((select last_checked_at>=retrieved_at from gina.curriculum_source_revisions),'last_checked_at tracked');

-- Admin approves the fetched copy; parent sees verified freshness.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008702","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select throws_ok($$select public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.r1')::jsonb->>'revision_id')::uuid,'approve','Approve',false)$$,'P0001','curriculum_review_required','explicit confirmation required');
select set_config('test.a1',public.admin_review_curriculum_source_revision('60000000-0000-4000-8000-000000008702',(current_setting('test.r1')::jsonb->>'revision_id')::uuid,'approve','Hash matches manifest; cells reviewed',true)::text,true);
select is(current_setting('test.a1')::jsonb->>'status','approved','approval is a separate admin action');
select is(public.admin_review_curriculum_source_revision('60000000-0000-4000-8000-000000008702',(current_setting('test.r1')::jsonb->>'revision_id')::uuid,'approve','Hash matches manifest; cells reviewed',true)::text,current_setting('test.a1'),'approval replay exact');
select throws_ok($$select public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.r1')::jsonb->>'revision_id')::uuid,'approve','Again',true)$$,'P0001','curriculum_revision_conflict','already approved cannot be re-approved');
select is(public.admin_list_curriculum_sources()->0->>'freshness','verified','queue shows verified after approval');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008701","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000008701"}}',true);
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'status','verified','parent reads verified freshness');
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'officially_verified','false','freshness is not endorsement');
select is(public.get_curriculum_source_freshness('2026-2027',2,'Türkçe')->>'status','unpublished','unpublished term is not substituted by another');

-- Acceptance 2: new hash → diff review required; published scenario and the family's frozen copy stay identical.
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('test.r3',public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source(),pg_temp.rev(repeat('c',64)))::text,true);
select is(current_setting('test.r3')::jsonb->>'outcome','new_revision','changed bytes create a revision');
select is(current_setting('test.r3')::jsonb->>'status','diff_review_required','changed source needs human diff review');
select is(current_setting('test.r3')::jsonb->'previous_approved'->>'sha256','6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee','previous approved copy referenced, not replaced');
reset role;
select is((select status||':'||revision from gina.curriculum_candidates),'published:2','published candidate untouched by new source revision');
select is((select snapshot->'candidate' from gina.catalog_blueprint_links),pg_temp.bundle()->'candidates'->0,'assigned family snapshot untouched');
select is((select status from gina.curriculum_source_revisions where sha256='6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee'),'approved','approved copy still approved until a human decides');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008701","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000008701"}}',true);
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'status','diff_review_required','parent sees review-pending state');
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'last_approved_sha256','6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee','last approved copy still named');

-- Acceptance 2: network failure → unverified with last approved date; nothing else changes.
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('test.r4',public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000008702',pg_temp.source('dns_failed:cdn.eba.gov.tr'),null)::text,true);
select is(current_setting('test.r4')::jsonb->>'outcome','unverified','network failure recorded as unverified');
select is(current_setting('test.r4')::jsonb->'last_approved'->>'sha256','6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee','last approved copy reported');
select is(current_setting('test.r4')::jsonb->>'alternative',null,'approved copy exists: no free-study fallback forced');
reset role;
select is((select count(*)::int from gina.curriculum_source_revisions),2,'failure creates no revision');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008701","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000008701"}}',true);
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'status','unverified','parent sees freshness could not be verified');
select ok((public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'last_approved_retrieved_at') is not null,'date of last approved copy visible');

-- Admin dismisses the diff; then withdraws the approved copy: new selection stops, frozen copy kept.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008703","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select is(public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.r3')::jsonb->>'revision_id')::uuid,'dismiss','Formatting-only change; keep approved copy',true)->>'status','superseded','dismissed diff set aside');
reset role;
select is((select extraction_status from gina.curriculum_source_revisions where sha256=repeat('c',64)),'skipped','dismissed revision is not extracted');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008703","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select set_config('test.w',public.admin_review_curriculum_source_revision(gen_random_uuid(),(current_setting('test.r1')::jsonb->>'revision_id')::uuid,'withdraw','Source retracted by publisher',true)::text,true);
select is(current_setting('test.w')::jsonb->>'withdrawn_candidates','1','published candidates of the hash withdrawn');
select is(current_setting('test.w')::jsonb->>'freshness','withdrawn','source marked withdrawn');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008701","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000008701"}}',true);
select is(public.get_curriculum_scenarios('20000000-0000-4000-8000-000000008701','2026-2027',1,1,'Türkçe'),'[]'::jsonb,'withdrawn source no longer selectable');
select is(public.get_curriculum_source_freshness('2026-2027',1,'Türkçe')->>'alternative','free_study','withdrawn source offers explicit free-study alternative');
reset role;
select is((select count(*)::int from public.exam_blueprints),1,'assigned family copy survives withdrawal');
select is((select snapshot->'candidate' from gina.catalog_blueprint_links),pg_temp.bundle()->'candidates'->0,'frozen snapshot unchanged after withdrawal');
select is((select count(*)::int from public.question_bank),0,'source acquisition never creates questions');
select is((select count(*)::int from public.prova_generation_jobs),0,'source acquisition never uses AI');
select * from finish();rollback;
