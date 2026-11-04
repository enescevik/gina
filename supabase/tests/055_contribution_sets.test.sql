begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000005501','contributor@test.local'),
('00000000-0000-4000-8000-000000005502','other-contributor@test.local'),
('00000000-0000-4000-8000-000000005503','editor@test.local'),
('00000000-0000-4000-8000-000000005504','coparent@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000005503');
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000005501','Contribution A','00000000-0000-4000-8000-000000005501'),
('10000000-0000-4000-8000-000000005502','Contribution B','00000000-0000-4000-8000-000000005502');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000005501','00000000-0000-4000-8000-000000005501'),
('10000000-0000-4000-8000-000000005502','00000000-0000-4000-8000-000000005502'),
('10000000-0000-4000-8000-000000005501','00000000-0000-4000-8000-000000005504');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
('40000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501',5,'Matematik','Çevre','open_ended','orta','Dikdörtgenin çevresi kaç metredir?','28','Kenar uzunlukları iki kez toplanır.'),
('40000000-0000-4000-8000-000000005502','10000000-0000-4000-8000-000000005501',5,'Matematik','Uzunluk','open_ended','orta','Bir telin uzunluğu kaç santimetredir?','12','Üç parça bir araya getirilir.');
insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent)
values('80000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','question_image','private-garden.png','image/png',69,'890c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8','private/path-5501','ready',1,1,'private-storage-v1');
insert into public.learning_source_links(source_id,question_id,alt) values('80000000-0000-4000-8000-000000005501','40000000-0000-4000-8000-000000005501','Dikdörtgen bahçe');
create function pg_temp.media() returns jsonb language sql as $$select '{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcHAAAAGEAMGDX2mUAAAAAElFTkSuQmCC","sha256":"890c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8","width":1,"height":1}'::jsonb$$;
create function pg_temp.teachers() returns jsonb language sql as $$select jsonb_build_object('q1',jsonb_build_object('correct_key',null,'expected_answer','28','solution','Kenarların toplamı 28 metredir.','explanation','Karşılıklı kenarların uzunlukları aynıdır.','common_misconception','Alan ile çevreyi karıştırmak.','next_step','Dört kenarı sırayla işaretle.','rubric',jsonb_build_object('max_points',1,'scoring','Eşdeğer açıklamalar kabul edilir.','criteria',jsonb_build_array(jsonb_build_object('id','c1','points',1,'criterion','Dört kenarı toplar.')),'missing_answer','Yanıt verilmedi.','review_required',true)))$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005501","role":"parent"}}',true);
select throws_ok($$select public.preview_question_contribution('40000000-0000-4000-8000-000000005501')$$,'P0001','contribution_disabled','feature closed until readiness');
reset role;update public.app_settings set value='true' where key='contribution_sets.enabled';set local role authenticated;
select is(jsonb_array_length(public.preview_question_contribution('40000000-0000-4000-8000-000000005501')->'images'),1,'preview retains required image');
select throws_ok($$select public.begin_question_contribution('60000000-0000-4000-8000-000000005501','40000000-0000-4000-8000-000000005501',false,true)$$,'P0001','consent_required','no sharing before rights consent');
select is(public.begin_question_contribution('60000000-0000-4000-8000-000000005501','40000000-0000-4000-8000-000000005501',true,true)->>'status','preparing','image copy required before moderation');
select is(public.begin_question_contribution('60000000-0000-4000-8000-000000005501','40000000-0000-4000-8000-000000005501',true,true)->>'id','60000000-0000-4000-8000-000000005501','same request replay');
select is(public.begin_question_contribution(gen_random_uuid(),'40000000-0000-4000-8000-000000005501',true,true)->>'id','60000000-0000-4000-8000-000000005501','same content returns existing copy');
select throws_ok($$select public.begin_question_contribution('60000000-0000-4000-8000-000000005501','40000000-0000-4000-8000-000000005502',true,true)$$,'P0001','request_conflict','same command cannot target another question');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005504","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005501","role":"parent"}}',true);
select throws_ok($$select public.begin_question_contribution(gen_random_uuid(),'40000000-0000-4000-8000-000000005501',true,true)$$,'P0001','contribution_in_progress','coparent is told which in-progress submission to complete');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005501","role":"parent"}}',true);
select throws_ok($$select public.admin_list_contribution_sets()$$,'42501','forbidden','parent cannot inspect review queue');
select throws_ok($$select public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',pg_temp.media())$$,'42501',null,'parent cannot forge copied bytes');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005502","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005502","role":"parent"}}',true);
select is(jsonb_array_length(public.list_question_contributions()),0,'foreign family cannot see contribution');
select throws_ok($$select public.preview_question_contribution('40000000-0000-4000-8000-000000005501')$$,'P0001','question_not_found','foreign question not readable');
select throws_ok($$select public.withdraw_question_contribution('60000000-0000-4000-8000-000000005501')$$,'P0001','contribution_not_found','foreign family cannot withdraw');
reset role;set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.finish_question_contribution('00000000-0000-4000-8000-000000005502','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',pg_temp.media())$$,'42501','forbidden','live membership required in service completion');
select throws_ok($$select public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',pg_temp.media()||jsonb_build_object('sha256',repeat('f',64)))$$,'P0001','contribution_media_invalid','copy digest enforced');
select is(public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',pg_temp.media())->>'status','pending','verified bytes become reviewable');
select lives_ok($$select public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',pg_temp.media())$$,'completion replay');
reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005503","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select is(jsonb_array_length(public.admin_list_contribution_sets()),1,'pending full copy is in queue');
select ok(public.admin_get_contribution_set('60000000-0000-4000-8000-000000005501')::text not like '%private/path%','private storage path not disclosed');
select ok(public.admin_get_contribution_set('60000000-0000-4000-8000-000000005501')->'snapshot'->'images' is null,'family source identifiers removed from moderator projection');
select throws_ok($$select public.admin_decide_contribution_set(gen_random_uuid(),'60000000-0000-4000-8000-000000005501',true,'İncelendi','{}',true)$$,'P0001','contribution_review_required','all question teaching details required');
select throws_ok($$select public.admin_decide_contribution_set(gen_random_uuid(),'60000000-0000-4000-8000-000000005501',true,'İncelendi',pg_temp.teachers(),false)$$,'P0001','contribution_review_required','explicit editorial consent required');
select set_config('test.result',public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',true,'İçerik, haklar ve yanıt incelendi.',pg_temp.teachers(),true)::text,true);
select is(current_setting('test.result')::jsonb->>'status','approved','acceptance creates separate draft');
select is(public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',true,'İçerik, haklar ve yanıt incelendi.',pg_temp.teachers(),true)::text,current_setting('test.result'),'lost acceptance response replays exact result');
select throws_ok($$select public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005501',false,'Different',pg_temp.teachers(),true)$$,'P0001','request_conflict','changed acceptance receipt denied');
reset role;
select is((select count(*)::int from gina.library_import_packages),1,'one library draft');
select is((select count(*)::int from gina.library_publications),0,'acceptance never publishes');
select is((select count(*)::int from gina.contribution_question_credits),1,'one original question credit');
select is((select count(*)::int from public.learning_credit_grants),0,'disabled reward policy gives no automatic grant');
select is((select encode(png,'base64') from gina.library_import_assets limit 1),encode(decode(pg_temp.media()->>'base64','base64'),'base64'),'draft owns independent media bytes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005501","role":"parent"}}',true);
select throws_ok($$select public.withdraw_question_contribution('60000000-0000-4000-8000-000000005501')$$,'P0001','contribution_already_accepted','accepted licence cannot silently retract published use');
select is(public.begin_question_contribution('60000000-0000-4000-8000-000000005502','40000000-0000-4000-8000-000000005502',true,true)->>'status','pending','text-only copy needs no media processing');
select lives_ok($$select public.withdraw_question_contribution('60000000-0000-4000-8000-000000005502')$$,'parent can withdraw pending copy');
select lives_ok($$select public.withdraw_question_contribution('60000000-0000-4000-8000-000000005502')$$,'withdraw replay safe');
reset role;
select is((select jsonb_array_length(snapshot->'questions') from gina.contribution_sets where id='60000000-0000-4000-8000-000000005502'),0,'withdraw removes private question payload');

update public.contribution_rewards set enabled=true,threshold=2;
update public.app_settings set value='true' where key='question_groups.enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000005501","role":"parent"}}',true);
select set_config('test.group',public.save_question_source_group('60000000-0000-4000-8000-000000005503','{"title":"Ortak bahçe planı","body":"Bahçenin iki kenarı 8 ve 6 metredir.","subject":"Matematik","grade":5}',(select jsonb_agg(jsonb_build_object('topic','Çevre','stem','Bahçenin çevresini hesapla, yöntem '||i,'expected_answer','28','solution','İki kenarın toplamının iki katı.','kind','open_ended','difficulty','orta')) from generate_series(1,3)i),'[{"source_id":"80000000-0000-4000-8000-000000005501","alt":"Ortak bahçe görseli"}]')::text,true);
select set_config('test.groupquestion',current_setting('test.group')::jsonb->'question_ids'->>1,true);
select is(jsonb_array_length(public.preview_question_contribution(current_setting('test.groupquestion')::uuid)->'questions'),3,'sharing a middle member includes whole ordered group');
select is(public.preview_question_contribution(current_setting('test.groupquestion')::uuid)->>'body','Bahçenin iki kenarı 8 ve 6 metredir.','common text retained separately');
select is(public.preview_question_contribution(current_setting('test.groupquestion')::uuid)->'questions'->0->>'stem','Bahçenin çevresini hesapla, yöntem 1','individual prompt does not repeat shared context');
select is(public.begin_question_contribution('60000000-0000-4000-8000-000000005504',current_setting('test.groupquestion')::uuid,true,true)->>'status','preparing','shared image copied once for full group');
reset role;set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','60000000-0000-4000-8000-000000005504',pg_temp.media())$$,'group media completes');
reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005503","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select throws_ok($$select public.admin_decide_contribution_set(gen_random_uuid(),'60000000-0000-4000-8000-000000005504',true,'İncelendi',pg_temp.teachers(),true)$$,'P0001','contribution_review_required','one reviewed member is not whole group acceptance');
select set_config('test.groupresult',public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005504','60000000-0000-4000-8000-000000005504',true,'Üç sorunun tamamı incelendi.',pg_temp.teachers()||jsonb_build_object('q2',pg_temp.teachers()->'q1','q3',pg_temp.teachers()->'q1'),true)::text,true);
select is(current_setting('test.groupresult')::jsonb->>'credited_questions','3','original members count individually');
reset role;
select is((select count(*)::int from public.learning_credit_grants),2,'one group crossing two milestones grants both exactly once');
select is((select count(*)::int from gina.library_import_questions where package_id=(current_setting('test.groupresult')::jsonb->>'package_id')::uuid),3,'draft contains all members');
select is((select count(*)::int from gina.library_import_sources where package_id=(current_setting('test.groupresult')::jsonb->>'package_id')::uuid),1,'one independent shared source, not three duplicates');
select is((select count(*)::int from gina.library_publications),0,'accepted group still not published');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005503","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select lives_ok($$select public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005504','60000000-0000-4000-8000-000000005504',true,'Üç sorunun tamamı incelendi.',pg_temp.teachers()||jsonb_build_object('q2',pg_temp.teachers()->'q1','q3',pg_temp.teachers()->'q1'),true)$$,'group acceptance receipt repeat');
reset role;
select is((select count(*)::int from public.learning_credit_grants),2,'acceptance retry never duplicates reward');
-- A second family may submit the same content, but acceptance must not mint another question credit.
insert into gina.contribution_sets(id,family_id,actor_id,question_id,snapshot,fingerprint,status,media,consent_version)
select '60000000-0000-4000-8000-000000005505','10000000-0000-4000-8000-000000005502','00000000-0000-4000-8000-000000005502',null,snapshot,fingerprint,'pending',media,consent_version
from gina.contribution_sets where id='60000000-0000-4000-8000-000000005501';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005503","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select is(public.admin_decide_contribution_set('70000000-0000-4000-8000-000000005505','60000000-0000-4000-8000-000000005505',true,'İkinci aile kopyası incelendi.',pg_temp.teachers(),true)->>'credited_questions','0','duplicate original across families earns no repeated credit');
reset role;
select is((select count(*)::int from public.learning_credit_grants where family_id='10000000-0000-4000-8000-000000005502'),0,'duplicate family receives no milestone grant');
select is((select count(*)::int from gina.contribution_question_credits),4,'global unique accepted questions unchanged');
update public.learning_sources set name='renamed-private-original.png' where id='80000000-0000-4000-8000-000000005501';
select is((select count(*)::int from gina.library_import_assets),1,'identical PNG bytes share one independent catalogue asset');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005503","role":"authenticated","gina":{"role":"parent","admin":true}}',true);
select is(public.admin_get_contribution_set('60000000-0000-4000-8000-000000005501')->'media'->>'sha256',pg_temp.media()->>'sha256','moderator copy does not depend on mutable original metadata');
reset role;
select * from finish();rollback;
