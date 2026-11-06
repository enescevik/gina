begin;
select no_plan();
-- H02: panel-started extraction (service path on behalf of a live admin), lease against concurrent clicks, retry
-- after a verdict or a transient failure, revoked admin, closed revisions, duplicate bytes across sources, the
-- legacy admin RPC unchanged, review-only import (no approval, no publication), panel read models.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000013201','h02-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000013202','h02-admin2@example.invalid'),
 ('00000000-0000-4000-8000-000000013203','h02-parent@example.invalid');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000013201'),('00000000-0000-4000-8000-000000013202');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000013201','H02 aile','00000000-0000-4000-8000-000000013203');
insert into public.family_members(user_id,family_id) values('00000000-0000-4000-8000-000000013203','10000000-0000-4000-8000-000000013201');

create function pg_temp.admin(id text default '00000000-0000-4000-8000-000000013201') returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',jsonb_build_object('admin',true))::text,true)::void$$;
create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000013203","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000013201"}}',true)::void$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)::void$$;
create function pg_temp.src(label text,slug text,term int default 1) returns jsonb language sql as $$select jsonb_build_object('source_key','oyss:2026-2027:'||term||':'||slug,'exam_family','oyss','school_year','2026-2027','term',term,'label',label,
 'index_url','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','link_url','https://meb.ai/ankmeb4','index_published_on',null,'index_updated_on',null,'error',null)$$;
create function pg_temp.rev(sha text) returns jsonb language sql as $$select jsonb_build_object('sha256',sha,'bytes',31410,'mime','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'resolved_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','redirect_chain','[]'::jsonb,'inspection','{"entries":12,"flags":[]}'::jsonb,'storage_path','oyss/2026-2027-t1/'||sha||'.xlsx')$$;
create function pg_temp.cand(sha text,k text default 'tr-2026-2027-t1-turkce2-g5-c6') returns jsonb language sql as $$select jsonb_build_object('key',k,'academic_year','2026-2027','term',1,'exam',1,'grade',5,'subject','Türkçe','label','Senaryo 1',
 'source_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','source_sha256',sha,'sheet','5. Sınıf','header_cell','C6','question_count',2,
 'blocks',jsonb_build_array(jsonb_build_object('count',2,'count_cell','C12','outcomes',jsonb_build_array(jsonb_build_object('cell','B12','text','T.O.5.6. Metnin yüzey anlamını belirleyebilme','code','T.O.5.6')))),
 'review_reasons',jsonb_build_array('programme_and_school_scope_required','source_review_required'))$$;
create function pg_temp.result(cands jsonb,outcome text default 'done',err text default null) returns jsonb language sql as $$select jsonb_build_object('outcome',outcome,'extractor','extract-meb-scenarios@h02-deno','scenarios',coalesce(jsonb_array_length(cands),0),'issues',0,'error',err,
 'bundle',case when cands is null then null else jsonb_build_object('schema','gina.curriculum-review.v1','candidates',cands) end)$$;
create temp table ids(name text primary key, id uuid);
grant all on ids to authenticated,service_role;

-- 0. Hygiene: the three service functions are not callable by anon/authenticated; helpers are not callable at all.
select ok(not has_function_privilege('anon','public.begin_curriculum_extraction(uuid,uuid)','execute') and not has_function_privilege('authenticated','public.begin_curriculum_extraction(uuid,uuid)','execute'),'begin: service only');
select ok(not has_function_privilege('authenticated','public.record_curriculum_extraction_service(uuid,uuid,uuid,jsonb)','execute') and has_function_privilege('service_role','public.record_curriculum_extraction_service(uuid,uuid,uuid,jsonb)','execute'),'record (service): service only');
select ok(not has_function_privilege('authenticated','public.release_curriculum_extraction(uuid,uuid,text)','execute') and not has_function_privilege('anon','public.release_curriculum_extraction(uuid,uuid,text)','execute'),'release: service only');
select ok(not has_function_privilege('authenticated','gina.curriculum_extraction_apply(uuid,uuid,uuid,jsonb)','execute') and not has_function_privilege('service_role','gina.curriculum_extraction_apply(uuid,uuid,uuid,jsonb)','execute'),'shared implementation not directly callable');
select ok(not has_function_privilege('anon','public.admin_record_curriculum_extraction(uuid,uuid,jsonb)','execute'),'legacy admin RPC still not anon');

-- 1. Empty catalogue → first download (Edge receipt) → queued revision.
select is((select count(*) from gina.curriculum_sources),0::bigint,'isolated catalogue starts empty');
set local role service_role;select pg_temp.service();
insert into ids select 'rev',(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',pg_temp.src('Türkçe','turkce'),pg_temp.rev(repeat('a',64)))->>'revision_id')::uuid;
reset role;
select is((select extraction_status||'/'||status from gina.curriculum_source_revisions where id=(select id from ids where name='rev')),'queued/pending_review','first download is a queued, unreviewed revision');

-- 2. Authorization: parent, non-service caller, unknown actor, revoked admin.
set local role authenticated;select pg_temp.parent();
select throws_ok($$select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013203',(select id from ids where name='rev'))$$,'42501',null,'parent cannot claim');
select pg_temp.admin();
select throws_ok($$select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))$$,'42501',null,'an admin JWT cannot call the service path directly');
reset role;
set local role service_role;select pg_temp.service();
select throws_ok($$select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013203',(select id from ids where name='rev'))$$,'42501',null,'service refuses a non-admin actor');
select throws_ok($$select public.begin_curriculum_extraction(null,(select id from ids where name='rev'))$$,'42501',null,'service refuses a missing actor');
select throws_ok($$select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',gen_random_uuid())$$,'P0001','curriculum_not_found','unknown revision');

-- 3. Claim + lease: a concurrent second click gets in_progress, not a second job.
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'state','claimed','first click claims');
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013202',(select id from ids where name='rev'))->>'state','in_progress','second click (other admin) sees the lease');
select is((public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'extraction_attempts')::int,1,'no extra attempt while leased');
select ok((select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev')) ? 'storage_path') is false,'in_progress answer carries no file details');

-- 4. Transient failure: lease released with a reason; no verdict; retry claims again.
select is(public.release_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),'source_unreachable:http_status:503')->>'extraction_status','queued','network error is not a verdict');
reset role;
select is((select extraction_last_error from gina.curriculum_source_revisions where id=(select id from ids where name='rev')),'source_unreachable:http_status:503','reason is visible');
select is((select extraction_started_at from gina.curriculum_source_revisions where id=(select id from ids where name='rev')),null,'lease released');
set local role service_role;select pg_temp.service();
select throws_ok($$select public.release_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),'')$$,'P0001','curriculum_extraction_invalid','release needs a reason');
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'extraction_attempts','2','retry claims again (attempt 2)');
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'state','in_progress','still leased');
reset role;
update gina.curriculum_source_revisions set extraction_started_at=now()-interval '4 minutes' where id=(select id from ids where name='rev');
set local role service_role;select pg_temp.service();
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'state','claimed','an expired lease (crashed worker) can be claimed again');

-- 5. Extraction verdict failed → retry → done. Review-only import, no approval, no publication.
select is(public.record_curriculum_extraction_service('a0000000-0000-4000-8000-000000013201','00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),pg_temp.result(null,'failed','hash_changed_since_fetch'))->>'extraction_status','failed','changed source: failed verdict recorded');
reset role;
select is((select extraction_started_at from gina.curriculum_source_revisions where id=(select id from ids where name='rev')),null,'verdict clears the lease');
select is((select actor_id from public.audit_log where action='curriculum.extraction_failed' order by created_at desc limit 1),'00000000-0000-4000-8000-000000013201'::uuid,'audit names the admin, not the service');
set local role service_role;select pg_temp.service();
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013202',(select id from ids where name='rev'))->>'state','claimed','failed revision can be retried');
select throws_ok($$select public.record_curriculum_extraction_service('a0000000-0000-4000-8000-000000013202','00000000-0000-4000-8000-000000013202',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('b',64)))))$$,'P0001','curriculum_extraction_hash_mismatch','candidate from other bytes refused');
select is(public.record_curriculum_extraction_service('a0000000-0000-4000-8000-000000013203','00000000-0000-4000-8000-000000013202',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-c7'))))->'extraction'->>'created','2','done: two draft candidates');
reset role;
select is((select string_agg(distinct status,',') from gina.curriculum_candidates where source_sha256=repeat('a',64)),'draft','candidates stay draft (no auto-publish)');
select is((select status from gina.curriculum_source_revisions where id=(select id from ids where name='rev')),'pending_review','source approval is still a separate admin decision');
select is((select value from public.app_settings where key='curriculum_catalog.enabled'),'false','global catalogue stays off');
set local role service_role;select pg_temp.service();
select is(public.record_curriculum_extraction_service('a0000000-0000-4000-8000-000000013203','00000000-0000-4000-8000-000000013202',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-c7'))))->'extraction'->>'created','2','lost response replay returns the receipt');
select throws_ok($$select public.record_curriculum_extraction_service('a0000000-0000-4000-8000-000000013203','00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('a',64)))))$$,'P0001','request_conflict','same request id, different actor/payload');
select is(public.record_curriculum_extraction_service(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('a',64)),pg_temp.cand(repeat('a',64),'tr-2026-2027-t1-turkce2-g5-c7'))))->>'outcome','unchanged','same bundle again: unchanged');
reset role;
select is((select count(*) from gina.curriculum_candidates where source_sha256=repeat('a',64)),2::bigint,'no duplicate candidates');
set local role service_role;select pg_temp.service();
select throws_ok($$select public.record_curriculum_extraction_service(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('a',64)))))$$,'P0001','curriculum_extraction_conflict','different output for the same bytes is a conflict, not an overwrite');
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev'))->>'state','already_done','click after done: nothing to do');

-- 6. Same hash from the panel again: no new revision, no new job.
select is(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',pg_temp.src('Türkçe','turkce'),pg_temp.rev(repeat('a',64)))->>'outcome','unchanged','same hash: unchanged');
reset role;
select is((select count(*) from gina.curriculum_source_revisions),1::bigint,'still one revision');

-- 7. Duplicate bytes under another source card of the same term are refused; the source row is not left behind.
set local role service_role;select pg_temp.service();
select throws_ok($$select public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',pg_temp.src('Türkçe','turkce-ortaokul'),pg_temp.rev(repeat('a',64)))$$,'P0001','curriculum_source_duplicate','same bytes as another source of this term');
reset role;
select is((select count(*) from gina.curriculum_sources),1::bigint,'no duplicate source card left behind');
select is((select count(*) from gina.curriculum_source_revisions),1::bigint,'no duplicate revision');

-- 8. Changed source: a new hash is a new queued revision needing diff review; earlier candidates untouched.
set local role service_role;select pg_temp.service();
insert into ids select 'rev2',(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',pg_temp.src('Türkçe','turkce'),pg_temp.rev(repeat('c',64)))->>'revision_id')::uuid;
reset role;
select is((select extraction_status||'/'||status from gina.curriculum_source_revisions where id=(select id from ids where name='rev2')),'queued/pending_review','changed bytes: separate queued revision (no approved copy yet → pending review)');

-- 9. Closed revisions are never extracted: dismissed (superseded/skipped).
set local role authenticated;select pg_temp.admin();
select is(public.admin_review_curriculum_source_revision(gen_random_uuid(),(select id from ids where name='rev2'),'dismiss','H02 test: kenara kondu',true)->>'status','superseded','admin dismisses the new revision');
reset role;
set local role service_role;select pg_temp.service();
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev2'))->>'state','closed','dismissed revision: closed');
reset role;

-- 10. Panel read models: attempts, last error, running flag, draft counts; no terminal command.
set local role authenticated;select pg_temp.admin();
select is((select (r->>'extraction_attempts')::int from jsonb_array_elements(public.admin_list_curriculum_sources()->0->'revisions') r where r->>'id'=(select id::text from ids where name='rev')),4,'attempt count visible');
select is((select (r->>'draft_candidates')::int from jsonb_array_elements(public.admin_list_curriculum_sources()->0->'revisions') r where r->>'id'=(select id::text from ids where name='rev')),2,'draft candidates visible');
select is((select (r->>'extraction_running')::boolean from jsonb_array_elements(public.admin_list_curriculum_sources()->0->'revisions') r where r->>'id'=(select id::text from ids where name='rev')),false,'not running after the verdict');
select is((select (r->>'stored')::boolean from jsonb_array_elements(public.admin_list_curriculum_sources()->0->'revisions') r where r->>'id'=(select id::text from ids where name='rev')),true,'stored original flag');
select is(public.admin_curriculum_pipeline()->>'operator_step','panel:curriculum-source-extract','no copied-token operator command');
select is(jsonb_array_length(public.admin_curriculum_pipeline()->'queue'),0,'queue empty after done + dismissed');
select pg_temp.parent();
select throws_ok($$select public.admin_curriculum_pipeline()$$,'42501',null,'parent cannot read the pipeline');
reset role;

-- 11. Legacy admin RPC (operator tool) keeps its contract through the shared implementation.
set local role service_role;select pg_temp.service();
insert into ids select 'rev3',(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013201',pg_temp.src('Türkçe','turkce'),pg_temp.rev(repeat('d',64)))->>'revision_id')::uuid;
select is(public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013201',(select id from ids where name='rev3'))->>'state','claimed','panel claim on rev3');
reset role;
set local role authenticated;select pg_temp.parent();
select throws_ok($$select public.admin_record_curriculum_extraction(gen_random_uuid(),(select id from ids where name='rev3'),pg_temp.result(null,'failed','x'))$$,'42501',null,'parent cannot record');
select pg_temp.admin();
select is(public.admin_record_curriculum_extraction(gen_random_uuid(),(select id from ids where name='rev3'),pg_temp.result(jsonb_build_array(pg_temp.cand(repeat('d',64)))))->>'extraction_status','done','legacy admin RPC records');
reset role;
select is((select extraction_started_at from gina.curriculum_source_revisions where id=(select id from ids where name='rev3')),null,'legacy record also clears the panel lease');

-- 12. Revoked admin: the row is removed while their JWT is still valid → every service call refuses them.
set local role service_role;select pg_temp.service();
insert into ids select 'rev4',(public.record_curriculum_source_fetch(gen_random_uuid(),'00000000-0000-4000-8000-000000013202',pg_temp.src('Fizik','fizik'),pg_temp.rev(repeat('e',64)))->>'revision_id')::uuid;
reset role;
delete from public.admins where user_id='00000000-0000-4000-8000-000000013202';
set local role service_role;select pg_temp.service();
select throws_ok($$select public.begin_curriculum_extraction('00000000-0000-4000-8000-000000013202',(select id from ids where name='rev4'))$$,'42501',null,'revoked admin cannot claim');
select throws_ok($$select public.record_curriculum_extraction_service(gen_random_uuid(),'00000000-0000-4000-8000-000000013202',(select id from ids where name='rev4'),pg_temp.result(null,'failed','x'))$$,'42501',null,'revoked admin cannot record');
select throws_ok($$select public.release_curriculum_extraction('00000000-0000-4000-8000-000000013202',(select id from ids where name='rev4'),'x')$$,'42501',null,'revoked admin cannot release');
reset role;
set local role authenticated;select pg_temp.admin('00000000-0000-4000-8000-000000013202');
select throws_ok($$select public.admin_list_curriculum_sources()$$,'42501',null,'revoked admin cannot read the panel');
reset role;
select is((select extraction_status from gina.curriculum_source_revisions where id=(select id from ids where name='rev4')),'queued','revoked admin left no state');

-- 13. Nothing deleted: every revision and candidate created above still exists.
select is((select count(*) from gina.curriculum_source_revisions),4::bigint,'all revisions kept (dismissed included)');
select is((select count(*) from gina.curriculum_candidates),3::bigint,'all candidates kept');

select * from finish();
rollback;
