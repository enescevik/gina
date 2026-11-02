begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000002401','libraryparent@test.local'),
('00000000-0000-4000-8000-000000002402','libraryadmin@test.local'),
('00000000-0000-4000-8000-000000002403','libraryother@test.local');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000002402');
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000002401','Library','00000000-0000-4000-8000-000000002401'),
('10000000-0000-4000-8000-000000002403','Other','00000000-0000-4000-8000-000000002403');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000002401','00000000-0000-4000-8000-000000002401'),
('10000000-0000-4000-8000-000000002403','00000000-0000-4000-8000-000000002403');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution,provenance) values
('20000000-0000-4000-8000-000000002401','10000000-0000-4000-8000-000000002401',5,'Fen','Isı','open_ended','orta','Isı nedir?','Enerji aktarımı','Isı bir enerji aktarımıdır.','{"private_source":"do not share"}'),
('20000000-0000-4000-8000-000000002403','10000000-0000-4000-8000-000000002403',5,'Fen','Isı','open_ended','orta','Isı nedir?','Enerji aktarımı','Isı bir enerji aktarımıdır.','{}');
update public.plans set library_monthly=1 where code='free';
update public.contribution_rewards set enabled=true,threshold=1,amount=2 where kind='library';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002402","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select lives_ok($$select public.admin_save_library_collection('30000000-0000-4000-8000-000000002401','Fen keşfi','Açıklama',5,'Fen','Test programı 2026',array['free','plus','pro']::public.plan_code[],'published')$$,'admin creates collection');
select lives_ok($$select public.admin_add_library_item('30000000-0000-4000-8000-000000002401','{"grade":5,"subject":"Fen","topic":"Işık","kind":"open_ended","difficulty":"orta","stem":"Işık nasıl yayılır?","expected_answer":"Doğrusal","solution":"Homojen ortamda doğrusal yayılır."}',true)$$,'admin creates original item');
select throws_ok($$select public.admin_add_library_item('30000000-0000-4000-8000-000000002401','{"grade":5,"subject":"Fen","topic":"Işık","kind":"multiple_choice","difficulty":"orta","stem":"Eksik soru?","solution":"Eksik."}')$$,'P0001','question_incomplete','missing choices rejected');
select throws_ok($$select public.admin_save_library_collection('30000000-0000-4000-8000-000000002401','Fen keşfi','Açıklama',6,'Fen','Test programı 2026',array['free']::public.plan_code[],'published')$$,'P0001','collection_identity_locked','cannot move existing questions to another grade');
select throws_ok($$update public.library_collections set grade=6$$,'42501',null,'direct writes cannot bypass collection validation');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002401","role":"parent"}}',true);
select throws_ok($$select * from public.library_items$$,'42501',null,'parent cannot download paid answers directly');
select throws_ok($$select public.admin_learning_library()$$,'42501','forbidden','parent cannot inspect contributions of other families');
select throws_ok($$select public.submit_question_contribution(gen_random_uuid(),'20000000-0000-4000-8000-000000002401',false,true)$$,'P0001','consent_required','both consents required');
select throws_ok($$select public.submit_question_contribution(gen_random_uuid(),'20000000-0000-4000-8000-000000002403',true,true)$$,'P0001','question_not_found','cannot contribute another family question');
select is(public.submit_question_contribution('40000000-0000-4000-8000-000000002401','20000000-0000-4000-8000-000000002401',true,true),'40000000-0000-4000-8000-000000002401'::uuid,'parent contributes snapshot');
select is(public.submit_question_contribution(gen_random_uuid(),'20000000-0000-4000-8000-000000002401',true,true),'40000000-0000-4000-8000-000000002401'::uuid,'new request same content is not a new contribution');
select ok(not((select content from public.question_contributions limit 1)?'provenance'),'private provenance not copied');
select ok(not((public.get_library_items('30000000-0000-4000-8000-000000002401')->0)?'expected_answer'),'catalogue does not expose answer');
select is((public.get_learning_library()->>'remaining')::int,1,'base allowance');
select lives_ok($$select public.redeem_library_item((public.get_library_items('30000000-0000-4000-8000-000000002401')->0->>'id')::uuid)$$,'redemption succeeds');
select is((public.get_learning_library()->>'remaining')::int,0,'one redemption spends one credit');
select is(public.redeem_library_item((public.get_library_items('30000000-0000-4000-8000-000000002401')->0->>'id')::uuid),(public.get_library_items('30000000-0000-4000-8000-000000002401')->0->>'owned')::uuid,'retry returns same question even after quota exhausted');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002402","role":"authenticated","gina":{"role":"none","admin":true}}',true);
select is(public.admin_review_contribution('40000000-0000-4000-8000-000000002401',true,'30000000-0000-4000-8000-000000002401','İçerik ve haklar kontrol edildi')->>'status','approved','admin accepts as draft');
select is(public.admin_review_contribution('40000000-0000-4000-8000-000000002401',true,'30000000-0000-4000-8000-000000002401','Tekrar istek')->>'status','approved','lost review response safe');
select is((select count(*)::int from public.learning_credit_grants),1,'one accepted contribution grants one milestone once');
select lives_ok($$select public.admin_publish_library_item((select library_item_id from public.question_contributions where id='40000000-0000-4000-8000-000000002401'),true)$$,'accepted draft can be published separately');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002401","role":"parent"}}',true);
select is((public.get_learning_library()->>'bonus')::int,2,'contribution bonus usable');
select lives_ok($$select public.redeem_library_item((select library_item_id from public.question_contributions where id='40000000-0000-4000-8000-000000002401'))$$,'bonus covers exhausted monthly quota');
select is((public.get_learning_library()->>'bonus')::int,1,'bonus consumed exactly once');
select throws_ok($$insert into public.learning_credit_grants(family_id,kind,amount,ends_at,reason) values('10000000-0000-4000-8000-000000002401','library',100,now()+interval '1 day','self')$$,'42501',null,'parent cannot grant own credits');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002403","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002403","role":"parent"}}',true);
select is((select count(*)::int from public.question_contributions),0,'other family cannot see contributions');
select is((select count(*)::int from public.learning_credit_grants),0,'other family cannot see credits');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000002401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002401","role":"device"}}',true);
select throws_ok($$select public.get_learning_library()$$,'42501','forbidden','child cannot spend parent library quota');
reset role;
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000002401'; set constraints all immediate;$$,'account deletion cascades library receipts without blocking');
select is((select count(*)::int from public.library_items),2,'consented published library copies survive family deletion');
select * from finish();
rollback;
