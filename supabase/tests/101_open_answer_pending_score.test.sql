-- P04 puanlama kuralı: çizim-only / metin → puan bekliyor; boş → cevap yok (0 değil); şıklı etkilenmez;
-- eski graded kayıt değişmez; veli açıkça 0 verirse graded; score_pct yalnız puanlı maddelerden, provisional.
begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000010101','p04-parent@test.local'),
 ('00000000-0000-4000-8000-000000010102','p04-other@test.local'),
 ('00000000-0000-4000-8000-000000010103','p04-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000010101','P04 A','00000000-0000-4000-8000-000000010101'),
 ('10000000-0000-4000-8000-000000010102','P04 B','00000000-0000-4000-8000-000000010102');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010101','00000000-0000-4000-8000-000000010101'),
 ('10000000-0000-4000-8000-000000010102','00000000-0000-4000-8000-000000010102');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000010101','10000000-0000-4000-8000-000000010101','Cocuk',5);
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000010101','pro','test',now()+interval '1 day');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000010101','10000000-0000-4000-8000-000000010101','00000000-0000-4000-8000-000000010103','20000000-0000-4000-8000-000000010101');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key,expected_answer) values
 ('40000000-0000-4000-8000-000000010111','10000000-0000-4000-8000-000000010101',5,'Fen','Işık','multiple_choice','Işık kaynağı hangisi?','[{"key":"A","text":"Güneş"},{"key":"B","text":"Ay"}]'::jsonb,'A',null),
 ('40000000-0000-4000-8000-000000010121','10000000-0000-4000-8000-000000010101',5,'Fen','Güneş','open_ended','Güneş neden ışık kaynağıdır?',null,null,'Kendi ışığını üretir.'),
 ('40000000-0000-4000-8000-000000010122','10000000-0000-4000-8000-000000010101',5,'Fen','Güneş','open_ended','Ay neden ışık kaynağı değildir?',null,null,'Işığı yansıtır.');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('50000000-0000-4000-8000-000000010131','10000000-0000-4000-8000-000000010101','20000000-0000-4000-8000-000000010101','Karma','Fen',5,
   array['40000000-0000-4000-8000-000000010111','40000000-0000-4000-8000-000000010121','40000000-0000-4000-8000-000000010122']::uuid[],'assigned'),
 ('50000000-0000-4000-8000-000000010132','10000000-0000-4000-8000-000000010101','20000000-0000-4000-8000-000000010101','Şıklı','Fen',5,
   array['40000000-0000-4000-8000-000000010111']::uuid[],'assigned'),
 ('50000000-0000-4000-8000-000000010133','10000000-0000-4000-8000-000000010101','20000000-0000-4000-8000-000000010101','Eski','Fen',5,
   array['40000000-0000-4000-8000-000000010121','40000000-0000-4000-8000-000000010122']::uuid[],'completed'),
 ('50000000-0000-4000-8000-000000010134','10000000-0000-4000-8000-000000010101','20000000-0000-4000-8000-000000010101','Metin','Fen',5,
   array['40000000-0000-4000-8000-000000010121']::uuid[],'assigned');

create function pg_temp.stroke_doc() returns jsonb language sql as $$
 select '{"version":1,"width":1000,"height":1400,"elements":[{"id":"a0000000-0000-4000-8000-000000010101","type":"stroke","color":"#201951","size":4,"points":[[100,100],[200,220],[300,260]]}]}'::jsonb;
$$;
create function pg_temp.text_box_doc(t text) returns jsonb language sql as $$
 select jsonb_build_object('version',1,'width',1000,'height',1400,'elements',jsonb_build_array(jsonb_build_object(
  'id','a0000000-0000-4000-8000-000000010102','type','text','color','#201951','size',20,'x',100,'y',100,'width',300,'height',80,'text',t)));
$$;
create function pg_temp.source_only_doc() returns jsonb language sql as $$
 select '{"version":1,"width":1000,"height":1400,"elements":[{"id":"a0000000-0000-4000-8000-000000010103","type":"source","x":10,"y":10,"width":300,"height":200,"sourceId":"b0000000-0000-4000-8000-000000010101","questionId":"40000000-0000-4000-8000-000000010121","alt":"kaynak","crop":{"x":0,"y":0,"width":1,"height":1}}]}'::jsonb;
$$;

-- Yardımcı: cevap var mı? ------------------------------------------------------------
select ok(not gina.open_answer_present(null,null),'no text, no document → not present');
select ok(not gina.open_answer_present('   ',null),'whitespace text → not present');
select ok(gina.open_answer_present('Bir yıldızdır.',null),'text → present');
select ok(gina.open_answer_present(null,pg_temp.stroke_doc()),'stroke-only drawing → present');
select ok(gina.open_answer_present('',pg_temp.text_box_doc('cevap')),'notebook text box with content → present');
select ok(not gina.open_answer_present('',pg_temp.text_box_doc('  ')),'blank notebook text box → not present');
select ok(not gina.open_answer_present(null,pg_temp.source_only_doc()),'pasted source image alone is not an answer');
select ok(not gina.open_answer_present(null,'{"version":1,"width":1000,"height":1400,"elements":[]}'::jsonb),'empty notebook → not present');
select is(gina.open_answer_state(null,null,pg_temp.stroke_doc()),'pending','drawing without score → pending');
select is(gina.open_answer_state(0::smallint,null,null),'graded','explicit zero → graded');
select is(gina.open_answer_state(null,'',null),'unanswered','blank → unanswered');

-- Senaryo A: karma deneme; şıklı doğru, Q1 yalnız çizim (gerçek v3 yolu), Q2 boş -------------------------
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
 ('60000000-0000-4000-8000-000000010141','10000000-0000-4000-8000-000000010101','50000000-0000-4000-8000-000000010131','20000000-0000-4000-8000-000000010101');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"parent"}}',true);
select lives_ok($$select public.submit_exam_answer('60000000-0000-4000-8000-000000010141','40000000-0000-4000-8000-000000010111','A',null)$$,'mc answered correctly');
select lives_ok($$select public.submit_exam_answer_v3(gen_random_uuid(),'60000000-0000-4000-8000-000000010141','40000000-0000-4000-8000-000000010121',0,null,null,pg_temp.stroke_doc())$$,'drawing-only open answer saved through v3');
select is((select coalesce(answer_text,'') from public.exam_answers where attempt_id='60000000-0000-4000-8000-000000010141' and question_id='40000000-0000-4000-8000-000000010121'),'','drawing-only answer has empty text');

select is((select open_total from public.finish_exam_attempt('60000000-0000-4000-8000-000000010141')),2,'finish response already carries recomputed totals');
select results_eq(
 $$select status::text, open_total, open_graded, open_pending, open_unanswered, provisional, score_pct::int, mc_total, mc_correct from public.exam_attempts where id='60000000-0000-4000-8000-000000010141'$$,
 $$values ('submitted',2,0,1,1,true,100,1,1)$$,
 'A: drawing → pending, blank → unanswered (not 0), score_pct from MC only, provisional');
select is((select score from public.exam_answers where attempt_id='60000000-0000-4000-8000-000000010141' and question_id='40000000-0000-4000-8000-000000010122'),null,'blank open answer gets no automatic score row');
select is((select graded_at from public.exam_attempts where id='60000000-0000-4000-8000-000000010141'),null,'incomplete attempt has no graded_at');

-- Özet RPC (veli)
select is(public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'review_state','pending_review','summary: pending_review');
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'pending_open_count')::int,1,'summary: pending_open_count');
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'unanswered_open_count')::int,1,'summary: unanswered_open_count');
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'provisional')::boolean,true,'summary: provisional');
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'score_pct')::int,100,'summary: score_pct only from graded items');
select is((select jsonb_agg(x->>'state' order by (x->>'position')::int) from jsonb_array_elements(public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->'open_answers') x),'["pending","unanswered"]'::jsonb,'summary: per-question open states for parent');
select is((select x->>'has_document' from jsonb_array_elements(public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->'open_answers') x where (x->>'position')::int=2),'true','summary: drawing flagged has_document');
-- Konu istatistiği: boş açık uçlu 0 değil, bekliyor
select results_eq(
 $$select topic, total, pending, pct from public.get_attempt_topic_stats('60000000-0000-4000-8000-000000010141') order by topic$$,
 $$values ('Güneş',2,2,null::int),('Işık',1,0,100)$$,
 'topic stats: open topic pending 2, pct null; MC topic unaffected');

-- Diğer aile göremez
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010102","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010102","role":"parent"}}',true);
select throws_ok($$select public.get_attempt_summary('60000000-0000-4000-8000-000000010141')$$,'P0001','attempt_not_found','other family cannot read summary');
-- Çocuk cihazı: sayılar var, soru başına puan listesi yok
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010103","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"device","device_id":"30000000-0000-4000-8000-000000010101","child_id":"20000000-0000-4000-8000-000000010101"}}',true);
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'pending_open_count')::int,1,'device: pending count visible');
select is(public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'review_state','pending_review','device: pending_review (matches "ebeveynin inceleyecek")');
select ok(not (public.get_attempt_summary('60000000-0000-4000-8000-000000010141') ? 'open_answers'),'device: no per-question score list');

-- Veli boş soruya açıkça 0 verir → hâlâ ara sonuç (çizim bekliyor); sonra çizimi puanlar → graded
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"parent"}}',true);
select results_eq(
 $$select status::text, open_graded, open_pending, open_unanswered, provisional, score_pct::int from public.score_open_answer('60000000-0000-4000-8000-000000010141','40000000-0000-4000-8000-000000010122',0::smallint,'Boş bırakılmış')$$,
 $$values ('submitted',1,1,0,true,50)$$,
 'parent explicit 0 on unanswered: counted as graded, attempt still provisional');
select results_eq(
 $$select status::text, open_graded, open_pending, open_unanswered, provisional, score_pct::int, graded_at is not null from public.score_open_answer('60000000-0000-4000-8000-000000010141','40000000-0000-4000-8000-000000010121',80::smallint,null)$$,
 $$values ('graded',2,0,0,false,60,true)$$,
 'all open answers scored → graded, final score_pct');
select is(public.get_attempt_summary('60000000-0000-4000-8000-000000010141')->>'review_state','graded','summary: graded after parent review');

-- Senaryo B: yalnız metin cevap → bekliyor; AI puanı gelince graded ----------------------------------------
reset role;
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
 ('60000000-0000-4000-8000-000000010142','10000000-0000-4000-8000-000000010101','50000000-0000-4000-8000-000000010134','20000000-0000-4000-8000-000000010101');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"parent"}}',true);
select lives_ok($$select public.submit_exam_answer('60000000-0000-4000-8000-000000010142','40000000-0000-4000-8000-000000010121',null,'Kendi ışığını üretir.')$$,'text answer saved');
select lives_ok($$select public.finish_exam_attempt('60000000-0000-4000-8000-000000010142')$$,'finish text-only attempt');
select results_eq(
 $$select status::text, open_total, open_graded, open_pending, open_unanswered, provisional, score_pct from public.exam_attempts where id='60000000-0000-4000-8000-000000010142'$$,
 $$values ('submitted',1,0,1,0,true,null::smallint)$$,
 'B: text answer → pending, no score_pct yet (not 0)');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select results_eq(
 $$select status::text, open_graded, open_pending, provisional, score_pct::int from public.apply_ai_grades('60000000-0000-4000-8000-000000010142','[{"question_id":"40000000-0000-4000-8000-000000010121","score":70,"kisa_geri_bildirim":"İyi"}]'::jsonb,null)$$,
 $$values ('graded',1,0,false,70)$$,
 'B: AI score settles the attempt');
select results_eq(
 $$select status::text, open_graded, open_pending, provisional from public.apply_ai_grades('60000000-0000-4000-8000-000000010142','[]'::jsonb,'{"genel_oneri":"x"}'::jsonb)$$,
 $$values ('graded',1,0,false)$$,
 'B: AI summary without grades does not invent or reset scores');

-- Senaryo C: yalnız şıklı deneme etkilenmez ------------------------------------------------------------
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
 ('60000000-0000-4000-8000-000000010143','10000000-0000-4000-8000-000000010101','50000000-0000-4000-8000-000000010132','20000000-0000-4000-8000-000000010101');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"parent"}}',true);
select lives_ok($$select public.submit_exam_answer('60000000-0000-4000-8000-000000010143','40000000-0000-4000-8000-000000010111','B',null)$$,'mc answered wrong');
select lives_ok($$select public.finish_exam_attempt('60000000-0000-4000-8000-000000010143')$$,'finish mc-only');
select results_eq(
 $$select status::text, open_total, open_graded, open_pending, open_unanswered, provisional, score_pct::int, graded_at is not null from public.exam_attempts where id='60000000-0000-4000-8000-000000010143'$$,
 $$values ('graded',0,0,0,0,false,0,true)$$,
 'C: multiple-choice only attempt is graded immediately with a real 0');
select is(public.get_attempt_summary('60000000-0000-4000-8000-000000010143')->>'review_state','graded','C: summary graded');

-- Senaryo D: eski (migration öncesi kuralla) 'graded' kayıt değişmez ----------------------------------------
reset role;
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,started_at,finished_at,graded_at,mc_total,mc_correct,open_total,open_graded,score_pct) values
 ('60000000-0000-4000-8000-000000010144','10000000-0000-4000-8000-000000010101','50000000-0000-4000-8000-000000010133','20000000-0000-4000-8000-000000010101',
  'graded',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',0,0,2,2,0);
insert into public.exam_answers(attempt_id,question_id,answer_text) values
 ('60000000-0000-4000-8000-000000010144','40000000-0000-4000-8000-000000010121',''),
 ('60000000-0000-4000-8000-000000010144','40000000-0000-4000-8000-000000010122','');
update public.exam_attempts set ai_feedback='{"genel_oneri":"eski"}'::jsonb where id='60000000-0000-4000-8000-000000010144';
select results_eq(
 $$select status::text, open_graded, open_pending, open_unanswered, provisional, score_pct::int from public.exam_attempts where id='60000000-0000-4000-8000-000000010144'$$,
 $$values ('graded',2,null::int,null::int,null::boolean,0)$$,
 'D: legacy graded row untouched by migration/unrelated updates (new columns stay null)');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010101","role":"parent"}}',true);
select results_eq(
 $$select s->>'review_state', (s->>'pending_open_count')::int, (s->>'unanswered_open_count')::int, (s->>'provisional')::boolean, (s->>'score_pct')::int from public.get_attempt_summary('60000000-0000-4000-8000-000000010144') s$$,
 $$values ('graded',0,0,false,0)$$,
 'D: legacy graded summary reads as graded 0/100, not reinterpreted');
-- Eski kayıt üzerinde yeni veli puanı → recompute yeni kuralı uygular (bilinçli: yalnız yeni çağrılar)
select results_eq(
 $$select status::text, open_graded, open_pending, open_unanswered, provisional, score_pct::int from public.score_open_answer('60000000-0000-4000-8000-000000010144','40000000-0000-4000-8000-000000010121',40::smallint,null)$$,
 $$values ('submitted',1,0,1,true,40)$$,
 'D: a new parent score on a legacy attempt re-applies the new rule (other blank → unanswered)');
select results_eq(
 $$select status::text, open_graded, open_unanswered, provisional, score_pct::int from public.score_open_answer('60000000-0000-4000-8000-000000010144','40000000-0000-4000-8000-000000010122',0::smallint,null)$$,
 $$values ('graded',2,0,false,20)$$,
 'D: explicit parent 0 closes it again');

-- Yetki: çocuk/cihaz recompute ve apply_ai_grades çağıramaz
select throws_ok($$select gina.recompute_attempt_totals('60000000-0000-4000-8000-000000010141')$$,'42501',null,'parent cannot call recompute directly');
select throws_ok($$select public.apply_ai_grades('60000000-0000-4000-8000-000000010141','[]'::jsonb,null)$$,'42501',null,'parent cannot write AI grades');

select * from finish();
rollback;
