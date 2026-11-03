begin;
select no_plan();
update public.plans set prova_monthly_exams=null where code='free';
update public.app_settings set value='true' where key='question_groups.enabled';
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000003501','builder-parent@test.local'),
('00000000-0000-4000-8000-000000003502','builder-other@test.local');
insert into public.families(id,name,created_by) values
('10000000-0000-4000-8000-000000003501','A','00000000-0000-4000-8000-000000003501'),
('10000000-0000-4000-8000-000000003502','B','00000000-0000-4000-8000-000000003502');
insert into public.family_members(family_id,user_id) values
('10000000-0000-4000-8000-000000003501','00000000-0000-4000-8000-000000003501'),
('10000000-0000-4000-8000-000000003502','00000000-0000-4000-8000-000000003502');
insert into public.children(id,family_id,name,grade) values
('20000000-0000-4000-8000-000000003501','10000000-0000-4000-8000-000000003501','Child',5),
('20000000-0000-4000-8000-000000003502','10000000-0000-4000-8000-000000003502','Other child',5);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer) values
('40000000-0000-4000-8000-000000003501','10000000-0000-4000-8000-000000003501',5,'Fen','Güneş','open_ended','Güneş neden ışık kaynağıdır?','Kendi ışığını üretir.'),
('40000000-0000-4000-8000-000000003502','10000000-0000-4000-8000-000000003502',5,'Fen','Güneş','open_ended','Başka ailedeki soru','Gizli'),
('40000000-0000-4000-8000-000000003503','10000000-0000-4000-8000-000000003501',5,'Fen','Güneş','open_ended','Cevapsız soru',null);
create function pg_temp.content(blocks jsonb default '[]',target int default 3,grade int default 5) returns jsonb language sql as $$
 select jsonb_build_object('childId','20000000-0000-4000-8000-000000003501','grade',grade,'title','Karma Prova','purpose','written','format','school','subjects',jsonb_build_array('Fen','Matematik'),'topics',jsonb_build_array('Güneş','Çevre'),'target',target,'minutes',null,'difficulty','orta','kind','mixed','note','','step',2,'blocks',blocks);
$$;
create function pg_temp.save(content jsonb,ver int default 0,req uuid default gen_random_uuid(),id uuid default '50000000-0000-4000-8000-000000003501') returns jsonb language sql as $$
 select public.save_prova_draft(req,id,ver,content);
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003501","role":"parent"}}',true);
select lives_ok($$select public.save_question_source_group('60000000-0000-4000-8000-000000003501','{"title":"Okul bahçesi","body":"Dikdörtgen bahçenin kenarları 8 metre ve 6 metredir.","grade":5,"subject":"Matematik"}','[{"topic":"Çevre","kind":"open_ended","difficulty":"orta","stem":"Bahçenin çevresi kaç metredir?","expected_answer":"28","solution":"2 × (8 + 6)"},{"topic":"Alan","kind":"open_ended","difficulty":"orta","stem":"Bahçenin alanı kaç metrekaredir?","expected_answer":"48","solution":"8 × 6"}]','[]')$$,'create shared source for mixed practice');
select set_config('test.blocks','[{"kind":"question","id":"40000000-0000-4000-8000-000000003501","source":"library"},{"kind":"group","id":"60000000-0000-4000-8000-000000003501","source":"manual"}]',true);
select lives_ok($$select pg_temp.save(pg_temp.content(),'0','70000000-0000-4000-8000-000000003501')$$,'create recoverable empty draft');
select is(pg_temp.save(pg_temp.content(),0,'70000000-0000-4000-8000-000000003501')->>'version','1','same request replay returns same version');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.content(),'{title}','"Changed"'),0,'70000000-0000-4000-8000-000000003501')$$,'P0001','request_conflict','same request cannot change payload');
select throws_ok($$select pg_temp.save(pg_temp.content(),0)$$,'P0001','prova_draft_changed','stale screen cannot overwrite');
select lives_ok($$select pg_temp.save(pg_temp.content(current_setting('test.blocks')::jsonb),1)$$,'mix ordinary and complete shared group');
select is((public.get_prova_drafts('50000000-0000-4000-8000-000000003501')->0->'content'->'blocks'),current_setting('test.blocks')::jsonb,'saved order and source identities round trip');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.content(),'{childId}','"20000000-0000-4000-8000-000000003502"'),2)$$,'42501','forbidden','cannot use another family child');
select throws_ok($$select pg_temp.save(pg_temp.content('[{"kind":"question","id":"40000000-0000-4000-8000-000000003502","source":"library"}]'),2)$$,'P0001','prova_source_unavailable','cannot use another family question');
select throws_ok($$select pg_temp.save(pg_temp.content(jsonb_build_array(jsonb_build_object('kind','question','id',(select question_id from public.question_source_members limit 1),'source','library'))),2)$$,'P0001','prova_source_unavailable','shared member cannot be detached from source');
select throws_ok($$select pg_temp.save(pg_temp.content(current_setting('test.blocks')::jsonb||current_setting('test.blocks')::jsonb),2)$$,'P0001','prova_duplicate_question','duplicates rejected');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.content(),'{purpose}','null'),2)$$,'P0001','invalid_input','JSON null does not bypass enum validation');
select lives_ok($$select pg_temp.save(pg_temp.content(current_setting('test.blocks')::jsonb,2),2)$$,'target change saved without losing selected questions');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',3)$$,'P0001','prova_question_count','count mismatch does not assign partial exam');
select lives_ok($$select pg_temp.save(pg_temp.content(current_setting('test.blocks')::jsonb,3,6),3)$$,'different grade can be saved for correction');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',4)$$,'P0001','prova_child_grade_changed','publication validates current child profile');
select lives_ok($$select pg_temp.save(jsonb_set(pg_temp.content(current_setting('test.blocks')::jsonb),'{subjects}','["Fen"]'),4)$$,'scope change retained for review');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',5)$$,'P0001','prova_question_scope','mixed subject cannot silently lose scope');
select lives_ok($$select pg_temp.save(jsonb_set(pg_temp.content(current_setting('test.blocks')::jsonb),'{format}','"meb"'),5)$$,'requested official format retained');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',6)$$,'P0001','prova_verified_scope_required','unverified MEB claim blocked');
select lives_ok($$select pg_temp.save(pg_temp.content('[{"kind":"question","id":"40000000-0000-4000-8000-000000003503","source":"manual"}]',1),6)$$,'unfinished question can be kept in draft');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',7)$$,'P0001','prova_answer_required','answer key required before child receives exam');
select lives_ok($$select pg_temp.save(pg_temp.content(current_setting('test.blocks')::jsonb),7)$$,'restore reviewed scope');
select lives_ok($$select public.submit_prova_draft('70000000-0000-4000-8000-000000003502','50000000-0000-4000-8000-000000003501',8)$$,'assign mixed practice atomically');
select lives_ok($$select public.submit_prova_draft('70000000-0000-4000-8000-000000003502','50000000-0000-4000-8000-000000003501',8)$$,'lost response replay succeeds');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',8)$$,'different retry key still returns original exam');
select is((select count(*)::int from public.exams where id='50000000-0000-4000-8000-000000003501'),1,'exactly one assignment');
select is((select cardinality(question_ids) from public.exams where id='50000000-0000-4000-8000-000000003501'),3,'complete group flattened with ordinary question');
select is((select question_ids[1]::text from public.exams where id='50000000-0000-4000-8000-000000003501'),'40000000-0000-4000-8000-000000003501','chosen order preserved');
select throws_ok($$select pg_temp.save(pg_temp.content(),8)$$,'P0001','prova_draft_submitted','submitted draft cannot be changed');
select throws_ok($$update public.exams set preparation='{}' where id='50000000-0000-4000-8000-000000003501'$$,'P0001','exam_content_locked','assigned preparation metadata frozen');
select throws_ok($$update public.question_bank set stem='Overwrite' where id='40000000-0000-4000-8000-000000003501'$$,'P0001','question_in_use','published ordinary questions frozen too');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003502","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000003502","role":"parent"}}',true);
select is(public.get_prova_drafts('50000000-0000-4000-8000-000000003501'),'[]'::jsonb,'other family cannot read known draft');
select throws_ok($$select pg_temp.save(pg_temp.content(),8)$$,'42501','forbidden','other family cannot edit known draft');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000003501',8)$$,'P0001','prova_draft_not_found','other family cannot submit known draft');
reset role;
select ok(not has_table_privilege('authenticated','public.prova_drafts','UPDATE'),'no direct draft writes');
select ok(not has_function_privilege('anon','public.get_prova_drafts(uuid)','EXECUTE'),'anonymous cannot read drafts');
select ok(not has_function_privilege('authenticated','gina.prova_draft_questions(uuid,jsonb)','EXECUTE'),'internal resolver not exposed');
select * from finish();
rollback;
