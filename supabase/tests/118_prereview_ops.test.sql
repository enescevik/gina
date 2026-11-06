begin;
select no_plan();
-- C09: AI ön incelemesi işletimi — aile dışı yönetici/içerik operatörü bildirimi, görsel bayrağı, eski kaynak (C05),
-- yapılandırma kaynaklı yeniden kuyruk, C08 sağlayıcı devre kesicisi, duraklatılmış sağlayıcıda deneme iadesi,
-- aday kaynak bağlamı (C07 rol matrisi), zamanlanmış drain kapısı. C07 yeniden kapılaması korunur.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000011801','c09-admin-nofamily@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011802','c09-content@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011803','c09-content-expired@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011804','c09-finance@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011805','c09-release@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011806','c09-parent@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011807','c09-admin-parent@example.invalid',false,'{}');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000011801'),('00000000-0000-4000-8000-000000011807');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000011802','content',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011803','content',now()-interval '1 minute',null),
 ('00000000-0000-4000-8000-000000011804','finance',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011805','release',now()+interval '30 days',null);
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000011801','C09 veli ailesi','00000000-0000-4000-8000-000000011806'),
 ('10000000-0000-4000-8000-000000011802','C09 yönetici ailesi','00000000-0000-4000-8000-000000011807');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011801','00000000-0000-4000-8000-000000011806'),
 ('10000000-0000-4000-8000-000000011802','00000000-0000-4000-8000-000000011807');

-- Contribution with one image (bytes never reach the model).
insert into gina.contribution_sets(id,family_id,actor_id,snapshot,fingerprint,status,consent_version) values
 ('70000000-0000-4000-8000-000000011801','10000000-0000-4000-8000-000000011801','00000000-0000-4000-8000-000000011806',
 '{"title":"Görselli soru","body":"","grade":5,"subject":"Matematik","grouped":false,"images":[{"id":"80000000-0000-4000-8000-000000011801","sha256":"aa0c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8","alt":"Bir üçgen"}],"questions":[{"key":"q1","kind":"open_ended","stem":"Şekildeki üçgenin çevresi kaçtır?","choices":[],"topic":"Çevre","grade":5,"subject":"Matematik","difficulty":"orta","correct_key":null}]}'::jsonb,
 'fingerprint-11801','pending','contribution-v1'),
 ('70000000-0000-4000-8000-000000011802','10000000-0000-4000-8000-000000011801','00000000-0000-4000-8000-000000011806',
 '{"title":"Metin sorusu","body":"","grade":5,"subject":"Matematik","grouped":false,"images":[],"questions":[{"key":"q1","kind":"open_ended","stem":"12 + 30 kaçtır?","choices":[],"topic":"Toplama","grade":5,"subject":"Matematik","difficulty":"kolay","correct_key":null}]}'::jsonb,
 'fingerprint-11802','pending','contribution-v1');
-- Library package with two image-backed shared sources.
insert into gina.library_import_assets(sha256,png,width,height) values('bb0c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8','\x00'::bytea,1,1) on conflict do nothing;
insert into gina.library_import_packages(id,package_key,revision,content_hash,title,grade,subject,provenance,created_by) values
 ('60000000-0000-4000-8000-000000011801','c09-media-package',1,repeat('c',64),'C09 görselli paket',5,'Matematik','{}','00000000-0000-4000-8000-000000011801');
insert into gina.library_import_sources(package_id,source_key,title,body,alt,asset_hash,minimum_reading_width,provenance) values
 ('60000000-0000-4000-8000-000000011801','s1','Şekil 1','','Üçgen','bb0c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8',0,'{}'),
 ('60000000-0000-4000-8000-000000011801','s2','Şekil 2','','Kare','bb0c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8',0,'{}'),
 ('60000000-0000-4000-8000-000000011801','s3','Metin','Yalnız metin','',null,0,'{}');

-- Scenario candidates: approved source, superseded source, retired target, manifest only.
insert into gina.curriculum_source_targets(exam_family,school_year,term,index_url,note) values
 ('oyss','2027-2028',1,'https://odsgm.meb.gov.tr/www/c09-test-2027-2028/icerik/1','C09 test hedefi (sentetik)');
insert into gina.curriculum_sources(id,source_key,exam_family,school_year,term,label,index_url,link_url,freshness,last_checked_at,created_by) values
 ('40000000-0000-4000-8000-000000011801','oyss:2026-2027:1:c09-turkce','oyss','2026-2027',1,'C09 Türkçe','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','https://meb.ai/c09a','verified',now()-interval '10 days','00000000-0000-4000-8000-000000011801'),
 ('40000000-0000-4000-8000-000000011802','oyss:2027-2028:1:c09-turkce','oyss','2027-2028',1,'C09 Türkçe eski hedef','https://odsgm.meb.gov.tr/www/c09-test-2027-2028/icerik/1','https://meb.ai/c09b','verified',now(),'00000000-0000-4000-8000-000000011801');
insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,retrieved_at,last_checked_at,status,created_by) values
 ('40000000-0000-4000-8000-000000011801',repeat('1',64),10,'application/vnd.ms-excel','https://cdn.eba.gov.tr/c09/a.xlsx',now()-interval '2 days',now()-interval '2 days','approved','00000000-0000-4000-8000-000000011801'),
 ('40000000-0000-4000-8000-000000011801',repeat('2',64),10,'application/vnd.ms-excel','https://cdn.eba.gov.tr/c09/b.xlsx',now()-interval '20 days',now()-interval '20 days','superseded','00000000-0000-4000-8000-000000011801'),
 ('40000000-0000-4000-8000-000000011802',repeat('3',64),10,'application/vnd.ms-excel','https://cdn.eba.gov.tr/c09/c.xlsx',now(),now(),'approved','00000000-0000-4000-8000-000000011801');
update gina.curriculum_source_targets set status='retired' where school_year='2027-2028' and term=1 and index_url like '%c09-test%';
insert into gina.curriculum_candidates(id,external_key,source_sha256,candidate,content_hash,status,created_by) values
 ('50000000-0000-4000-8000-000000011801','c09-current',repeat('1',64),'{"label":"Güncel kaynak","question_count":2}',repeat('1',64),'draft','00000000-0000-4000-8000-000000011801'),
 ('50000000-0000-4000-8000-000000011802','c09-superseded',repeat('2',64),'{"label":"Eski sürüm","question_count":2}',repeat('2',64),'draft','00000000-0000-4000-8000-000000011801'),
 ('50000000-0000-4000-8000-000000011803','c09-retired',repeat('3',64),'{"label":"Emekli hedef","question_count":2}',repeat('3',64),'draft','00000000-0000-4000-8000-000000011801'),
 ('50000000-0000-4000-8000-000000011804','c09-manifest',repeat('4',64),'{"label":"Manifest","academic_year":"2026-2027","term":1}',repeat('4',64),'draft','00000000-0000-4000-8000-000000011801');
update public.app_settings set value='true' where key='content_prereview.enabled';

create function pg_temp.actor(id text, admin boolean default false, family text default null) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',case when family is null then null else 'parent' end,'admin',admin))::text,true)::void$$;
create function pg_temp.service() returns void language sql as $$ select set_config('request.jwt.claims','{"role":"service_role"}',true)::void $$;
create function pg_temp.q(stmt text) returns text language plpgsql security definer as $$declare v text;begin execute stmt into v;return v;end$$;
grant execute on function pg_temp.q(text) to authenticated,service_role;
create function pg_temp.allowed(sql text) returns text language plpgsql as $$
begin execute sql; return 'allowed';
exception when insufficient_privilege then return 'forbidden';
 when others then if sqlerrm='forbidden' then return 'forbidden'; end if; return 'allowed:'||sqlerrm; end$$;
create function pg_temp.gate(sql text) returns text language sql as $$ select split_part(pg_temp.allowed(sql),':',1) $$;
create function pg_temp.lease(n int) returns uuid language sql as $$select ('90000000-0000-4000-8000-0000000118'||lpad(n::text,2,'0'))::uuid$$;
create function pg_temp.verdict(conf numeric,reason text,media boolean default true) returns jsonb language sql as $$
 select jsonb_build_object('model','synthetic-model','provider','anthropic','confidence',conf,'decision_reason',reason,'findings','[]'::jsonb,'recommendation','approve')
  ||case when media then jsonb_build_object('media',jsonb_build_object('count',0,'reviewed',false)) else '{}'::jsonb end$$;

-- 1. C07 matrisi bozulmadı: içerik operatörü kuyruğu görür ve ister, finans/yayın istemez --------------
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select is(pg_temp.gate($$select public.admin_content_prereviews()$$),'allowed','content operator (no family) reads the AI queue');
select ok(pg_temp.q($$select count(*) from gina.content_prereviews$$)::int=0,'nothing queued before the operator acts');
select is((public.enqueue_content_prereview('all')->>'queued')::int,
 pg_temp.q($$select (select count(*) from gina.library_import_packages p where gina.content_prereview_awaiting('library_package',p.id))
  +(select count(*) from gina.contribution_sets where status='pending')+(select count(*) from gina.curriculum_candidates where status='draft')$$)::int,
 'content operator (no family) queues every record awaiting a decision');
select is(pg_temp.q($$select count(*) from gina.content_prereviews where target_id in('70000000-0000-4000-8000-000000011801','70000000-0000-4000-8000-000000011802','60000000-0000-4000-8000-000000011801','50000000-0000-4000-8000-000000011801','50000000-0000-4000-8000-000000011802','50000000-0000-4000-8000-000000011803','50000000-0000-4000-8000-000000011804')$$)::int,7,'all seven C09 fixtures are in the queue');
select pg_temp.actor('00000000-0000-4000-8000-000000011804');
select is(pg_temp.gate($$select public.admin_content_prereviews()$$),'forbidden','finance cannot read the AI queue');
select pg_temp.actor('00000000-0000-4000-8000-000000011805');
select is(pg_temp.gate($$select public.request_content_prereview('contribution_set','70000000-0000-4000-8000-000000011801')$$),'forbidden','release cannot request a pre-review');
select pg_temp.actor('00000000-0000-4000-8000-000000011803');
select is(pg_temp.gate($$select public.admin_content_prereviews()$$),'forbidden','expired content operator is refused');

-- 2. Görsel bayrağı --------------------------------------------------------------------------------
reset role;set local role service_role;select pg_temp.service();
create temp table claims(name text primary key,result jsonb);grant all on claims to service_role,authenticated;
insert into claims select 'img',public.content_prereview_claim('contribution_set','70000000-0000-4000-8000-000000011801',pg_temp.lease(1),'prereview-v2');
select is((select (result->>'media_count')::int from claims where name='img'),1,'claim reports the contribution image count');
select ok((select position('aa0c8dc04fe5' in (result->'content')::text)=0 from claims where name='img'),'image hashes/bytes are not in the model content');
select throws_ok($$select public.content_prereview_finish('contribution_set','70000000-0000-4000-8000-000000011801',pg_temp.lease(1),'ai_approved',pg_temp.verdict(0.95,'all_checks_passed'))$$,
 'P0001','prereview_media_unreviewed','C09 verdict cannot approve a record whose image was not reviewed');
select is(public.content_prereview_finish('contribution_set','70000000-0000-4000-8000-000000011801',pg_temp.lease(1),'needs_admin',pg_temp.verdict(0.95,'media_not_reviewed'))->>'prereview_status','needs_admin','image record goes to the admin queue');
select is(pg_temp.q($$select prereview_verdict->'media'->>'image_dependent_correctness' from gina.content_prereviews where target_id='70000000-0000-4000-8000-000000011801'$$),'not_proven','explicit flag: image-dependent correctness not proven');
select is(pg_temp.q($$select (prereview_verdict->'media'->>'count')::int from gina.content_prereviews where target_id='70000000-0000-4000-8000-000000011801'$$)::int,1,'database counts the image, not the caller');
insert into claims select 'pkg',public.content_prereview_claim('library_package','60000000-0000-4000-8000-000000011801',pg_temp.lease(2),'prereview-v2');
select is((select (result->>'media_count')::int from claims where name='pkg'),2,'package image count = image-backed sources only');
select lives_ok($$select public.content_prereview_finish('library_package','60000000-0000-4000-8000-000000011801',pg_temp.lease(2),'needs_admin',pg_temp.verdict(0.9,'media_not_reviewed'))$$,'package routed to the admin');
insert into claims select 'text',public.content_prereview_claim('contribution_set','70000000-0000-4000-8000-000000011802',pg_temp.lease(3),'prereview-v2');
select is((select (result->>'media_count')::int from claims where name='text'),0,'text-only record has no media');
select is(public.content_prereview_finish('contribution_set','70000000-0000-4000-8000-000000011802',pg_temp.lease(3),'ai_approved',pg_temp.verdict(0.93,'all_checks_passed'))->>'prereview_status','ai_approved','text-only record can be AI-approved');
select is(pg_temp.q($$select prereview_verdict->'media'->>'image_dependent_correctness' from gina.content_prereviews where target_id='70000000-0000-4000-8000-000000011802'$$),'not_applicable','flag says not applicable without images');

-- 3. AI onayı yönetici kararından ayrı kaydedilir ----------------------------------------------------
select is(pg_temp.q($$select status from gina.contribution_sets where id='70000000-0000-4000-8000-000000011802'$$),'pending','ai_approved leaves the contribution pending (no admin decision)');
select is(pg_temp.q($$select reviewed_by::text from gina.contribution_sets where id='70000000-0000-4000-8000-000000011802'$$),null,'no reviewer is forged');
select is(pg_temp.q($$select count(*) from public.audit_log where action='content_prereview.ai_approved' and actor_id is null and target_id='contribution_set:70000000-0000-4000-8000-000000011802' and details->>'provider'='anthropic' and details->'media'->>'image_dependent_correctness'='not_applicable'$$)::int,1,
 'AI approval is its own audit entry (system actor, provider, media flag)');

-- 4. Eski kaynak (C05) → modele gitmez ---------------------------------------------------------------
insert into claims select 'superseded',public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011802',pg_temp.lease(4),'prereview-v2');
select is((select result->>'error' from claims where name='superseded'),'source_obsolete','superseded source revision is not sent to the model');
select is((select result->>'reason' from claims where name='superseded'),'source_superseded','reason names the superseded revision');
select ok((select not (result ? 'content') from claims where name='superseded'),'no content handed to the caller');
select is(pg_temp.q($$select prereview_status||'/'||(prereview_verdict->>'decision_reason')||'/'||attempts from gina.content_prereviews where target_id='50000000-0000-4000-8000-000000011802'$$),'needs_admin/source_superseded/0','obsolete candidate waits for the admin, no attempt spent');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011803',pg_temp.lease(5),'prereview-v2')->>'reason','source_target_retired','retired target is obsolete too');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011802',pg_temp.lease(6),'prereview-v2')->>'cached','true','second claim is cached, still no model call');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(7),'prereview-v2')->>'claimed','true','approved source candidate is claimed normally');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011804',pg_temp.lease(8),'prereview-v2')->>'claimed','true','manifest-only candidate (no fetched revision) is claimed normally');

-- 5. Bildirim: aile dışı yönetici ve içerik operatörü ------------------------------------------------
select is(pg_temp.q($$select count(*) from gina.operator_prereview_notices where target_id='70000000-0000-4000-8000-000000011801' and user_id in('00000000-0000-4000-8000-000000011801','00000000-0000-4000-8000-000000011802','00000000-0000-4000-8000-000000011807')$$)::int,3,
 'non-family admin, family admin and content operator get an in-app notice');
select is(pg_temp.q($$select count(*) from gina.operator_prereview_notices where user_id in('00000000-0000-4000-8000-000000011803','00000000-0000-4000-8000-000000011804','00000000-0000-4000-8000-000000011805','00000000-0000-4000-8000-000000011806')$$)::int,0,
 'expired operator, finance, release and parents get no notice');
select is(pg_temp.q($$select count(*) from public.push_outbox where kind='content_prereview_needs_admin' and payload->>'target_id'='70000000-0000-4000-8000-000000011801'$$)::int,1,'push still targets only the family-member admin (E01 behaviour)');
select is(pg_temp.q($$select count(*) from public.push_outbox where kind='content_prereview_needs_admin' and target_user_id='00000000-0000-4000-8000-000000011801'$$)::int,0,'non-family admin has no push target');
select is(pg_temp.q($$select count(*) from gina.operator_prereview_notices where user_id='00000000-0000-4000-8000-000000011802'$$)::int,4,'operator notice per needs_admin record (image contribution, package, 2 obsolete candidates)');
select is(pg_temp.q($$select count(*) from gina.operator_prereview_notices where target_id='70000000-0000-4000-8000-000000011802'$$)::int,0,'ai_approved creates no notice');

reset role;set local role authenticated;select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select is((public.operator_prereview_notices()->>'unread')::int,4,'content operator sees 4 unread notices');
select is(public.operator_prereview_notices(true,10)->'items'->0->>'awaiting_admin','true','notice shows that the record still awaits a decision');
select ok((select bool_and(x ? 'reason') from jsonb_array_elements(public.operator_prereview_notices()->'items') x),'notice carries the AI reason');
create temp table nid(id uuid);grant all on nid to authenticated;
insert into nid select (x->>'id')::uuid from jsonb_array_elements(public.operator_prereview_notices()->'items') x where x->>'target_kind'='library_package';
select is((public.mark_operator_prereview_notices_read((select array_agg(id) from nid))->>'unread')::int,3,'marking one notice read');
select is((public.mark_operator_prereview_notices_read((select array_agg(id) from nid))->>'marked')::int,0,'marking again is idempotent');
select pg_temp.actor('00000000-0000-4000-8000-000000011801',true);
select is((public.operator_prereview_notices()->>'unread')::int,4,'non-family admin reads own notices; another user''s read state is separate');
select pg_temp.actor('00000000-0000-4000-8000-000000011804');
select is(pg_temp.gate($$select public.operator_prereview_notices()$$),'forbidden','finance cannot read prereview notices');
select is(pg_temp.gate($$select public.mark_operator_prereview_notices_read(null)$$),'forbidden','finance cannot mark notices');
reset role;update public.operations_members set revoked_at=now() where user_id='00000000-0000-4000-8000-000000011802';set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select is(pg_temp.gate($$select public.operator_prereview_notices()$$),'forbidden','revoked content operator loses the notices on the next call');
reset role;update public.operations_members set revoked_at=null where user_id='00000000-0000-4000-8000-000000011802';set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000011806','false','10000000-0000-4000-8000-000000011801');
select is(pg_temp.gate($$select public.operator_prereview_notices()$$),'forbidden','parent cannot read prereview notices');
reset role;set local role anon;
select throws_ok($$select public.operator_prereview_notices()$$,'42501',null,'anonymous refused');

-- 6. Aday kaynak bağlamı (rozetler) -----------------------------------------------------------------
reset role;set local role authenticated;select pg_temp.actor('00000000-0000-4000-8000-000000011805');
create temp table ctx(v jsonb);grant all on ctx to authenticated;
insert into ctx select public.admin_prereview_candidate_context(array['50000000-0000-4000-8000-000000011801','50000000-0000-4000-8000-000000011802','50000000-0000-4000-8000-000000011803','50000000-0000-4000-8000-000000011804']::uuid[]);
select is((select v->'50000000-0000-4000-8000-000000011801'->>'source_status' from ctx),'approved','release role sees the approved source of a current candidate');
select is((select v->'50000000-0000-4000-8000-000000011801'->>'stale' from ctx),'true','last check 10 days ago is stale (C05 7-day rule)');
select is((select v->'50000000-0000-4000-8000-000000011802'->>'obsolete_reason' from ctx),'source_superseded','superseded revision is flagged');
select is((select v->'50000000-0000-4000-8000-000000011803'->>'target_status' from ctx),'retired','retired target is shown');
select is((select v->'50000000-0000-4000-8000-000000011804'->>'source_status' from ctx),'manifest_only','manifest-only candidate labelled');
select is((select v->'50000000-0000-4000-8000-000000011802'->>'prereview_reason' from ctx),'source_superseded','AI reason travels with the badge');
select pg_temp.actor('00000000-0000-4000-8000-000000011804');
select is(pg_temp.gate($$select public.admin_prereview_candidate_context(array[gen_random_uuid()])$$),'forbidden','finance cannot read candidate context');
select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select throws_ok($$select public.admin_prereview_candidate_context(null)$$,'P0001','invalid_input','null id list rejected');

-- 7. Yapılandırma kaynaklı needs_admin açık istekle yeniden kuyruğa girer; model kararları girmez --------
reset role;set local role service_role;select pg_temp.service();
select is(public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(7),'needs_admin',pg_temp.verdict(0,'ai_disabled'))->>'prereview_status','needs_admin','kill switch verdict recorded');
select is(public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011804',pg_temp.lease(8),'needs_admin',pg_temp.verdict(0.5,'low_confidence'))->>'prereview_status','needs_admin','model low-confidence verdict recorded');
reset role;set local role authenticated;select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select is(public.request_content_prereview('curriculum_candidate','50000000-0000-4000-8000-000000011801')->>'outcome','requeued','ai_disabled verdict re-queued on explicit request after the switch reopens');
select is(public.request_content_prereview('curriculum_candidate','50000000-0000-4000-8000-000000011804')->>'outcome','unchanged','a real model verdict is not re-bought');
select is(public.request_content_prereview('contribution_set','70000000-0000-4000-8000-000000011801')->>'outcome','unchanged','media_not_reviewed is a decision for the admin, not re-queued');
select is(pg_temp.q($$select prereview_status||'/'||attempts from gina.content_prereviews where target_id='50000000-0000-4000-8000-000000011801'$$),'pending/0','re-queued record starts fresh');

-- 8. Retry sınırı ve duraklatılmış sağlayıcı iadesi -----------------------------------------------------
reset role;set local role service_role;select pg_temp.service();
select is((public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(9),'prereview-v2')->>'attempts')::int,1,'claim counts an attempt');
select is((public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(9),'pending',null,'ai_temporarily_unavailable')->>'attempts')::int,0,'paused provider: no call happened, attempt refunded');
select is((public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(10),'prereview-v2')->>'attempts')::int,1,'next claim is attempt 1 again');
select is((public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(10),'pending',null,'anthropic_503')->>'attempts')::int,1,'a real provider failure keeps the attempt');
select lives_ok($$select public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(11),'prereview-v2')$$,'attempt 2');
select lives_ok($$select public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(11),'pending',null,'anthropic_529')$$,'failure 2');
select lives_ok($$select public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(12),'prereview-v2')$$,'attempt 3');
select lives_ok($$select public.content_prereview_finish('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(12),'pending',null,'provider_outcome_unknown')$$,'failure 3');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(13),'prereview-v2')->>'error','retry_limit','fourth claim stops at the retry limit');
select is(public.content_prereview_claim('curriculum_candidate','50000000-0000-4000-8000-000000011801',pg_temp.lease(14),'prereview-v2')->>'cached','true','then cached: no endless retry');
reset role;set local role authenticated;select pg_temp.actor('00000000-0000-4000-8000-000000011802');
select is(public.request_content_prereview('curriculum_candidate','50000000-0000-4000-8000-000000011801')->>'outcome','unchanged','retry_limit is not re-queued by a request (no endless paid retry)');

-- 9. C08 devre kesicisi (sağlayıcı başına) ----------------------------------------------------------
select is(pg_temp.gate($$select public.content_prereview_provider('anthropic')$$),'forbidden','operators cannot touch provider health');
reset role;set local role service_role;select pg_temp.service();
select throws_ok($$select public.content_prereview_provider('nope')$$,'P0001','provider_unknown','unknown provider rejected');
select is(public.content_prereview_provider('anthropic')->>'paused','false','fresh provider is not paused');
select lives_ok($$select public.content_prereview_provider('openai_compatible',false,'openai_503',true)$$,'failure 1 recorded');
select lives_ok($$select public.content_prereview_provider('openai_compatible',false,'openai_503',true)$$,'failure 2 recorded');
select is(public.content_prereview_provider('openai_compatible',false,'openai_503',true)->>'paused','true','third uncertain failure pauses that provider');
select is(public.content_prereview_provider('anthropic')->>'paused','false','other provider keeps running');
select is(public.content_prereview_provider('openai_compatible',true)->>'paused','false','success closes the breaker');

-- 10. Zamanlanmış drain kapısı -----------------------------------------------------------------------
reset role;
select ok(not has_function_privilege('authenticated','gina.kick_content_prereview()','execute'),'clients cannot trigger the drain');
update public.app_settings set value='false' where key='content_prereview.enabled';
select lives_ok($$select gina.kick_content_prereview()$$,'drain kick is a no-op while the gate is closed');
update public.app_settings set value='true' where key='content_prereview.enabled';
select lives_ok($$select gina.kick_content_prereview()$$,'without Vault secrets the kick sends nothing and does not fail');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('admin_content_prereviews','request_content_prereview','enqueue_content_prereview')
  and pg_get_functiondef(p.oid) like '%assert_operation_role%'),3,'C07 role gate still in the three admin prereview functions');
select * from finish();
rollback;
