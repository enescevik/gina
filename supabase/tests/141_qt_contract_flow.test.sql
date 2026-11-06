-- QT00/QT01 uçtan uca sözleşme: hazırlama (RPC) → anahtar ayrımı → atama sürüm bağı → çocuk v2 projeksiyonu
-- (sızıntı yok) → v4 kayıt (doğrulama/idempotency/revision/eski istemci ret) → bitişte SQL puanlama →
-- toplamlar → veli gerekçeli puan → hash zinciri → OYSS ayrımı → kullanılan anahtar değişmez → yetki.
begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000014101','qt-parent@test.local'),
 ('00000000-0000-4000-8000-000000014102','qt-other@test.local'),
 ('00000000-0000-4000-8000-000000014103','qt-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000014101','QT A','00000000-0000-4000-8000-000000014101'),
 ('10000000-0000-4000-8000-000000014102','QT B','00000000-0000-4000-8000-000000014102');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000014101','00000000-0000-4000-8000-000000014101'),
 ('10000000-0000-4000-8000-000000014102','00000000-0000-4000-8000-000000014102');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000014101','10000000-0000-4000-8000-000000014101','Ada',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000014101','10000000-0000-4000-8000-000000014101','00000000-0000-4000-8000-000000014103','20000000-0000-4000-8000-000000014101');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000014101','pro','test',now()+interval '1 day');

create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014101","role":"parent"}}',true);
$$;
create function pg_temp.as_other() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014102","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014102","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014103","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014101","role":"device","child_id":"20000000-0000-4000-8000-000000014101"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('grade',3,'subject','Fen','topic','Canlılar','difficulty','orta','stem','Aşağıdaki ifadeleri değerlendir.',
  'interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key) || extra;
$$;

set local role authenticated;
select pg_temp.as_parent();

-- 1) Hazırlama ---------------------------------------------------------------------------------
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014111', pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"Kedi bir memelidir."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]}',
  '{"answers":{"s1":true,"s2":false,"s3":true}}'))$$, 'parent creates true/false question via RPC');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014112', pg_temp.q('matching',
  '{"left":[{"id":"l1","text":"Kalp"},{"id":"l2","text":"Akciğer"}],"right":[{"id":"r1","text":"Kan pompalar"},{"id":"r2","text":"Solunum"},{"id":"r3","text":"Görme"}],"policy":"one_to_one"}',
  '{"pairs":{"l1":"r1","l2":"r2"}}', '{"points":2}'))$$, 'parent creates weighted matching question');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014113', pg_temp.q('numeric',
  '{"units":[{"id":"cm","text":"cm"},{"id":"m","text":"m"}],"unit_required":true}',
  '{"value":"150","unit":"cm","unit_factors":{"cm":1,"m":100}}'))$$, 'parent creates numeric question with units');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014114', pg_temp.q('ordering',
  '{"items":[{"id":"a","text":"Tohum"},{"id":"b","text":"Filiz"},{"id":"c","text":"Çiçek"}],"mode":"sequence"}',
  '{"orders":[["a","b","c"]]}'))$$, 'parent creates ordering question');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014115', pg_temp.q('numeric',
  '{"units":[],"unit_required":false,"work_area":true}', '{"value":"12","process_required":true}'))$$, 'numeric with process requirement + work area');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014116', pg_temp.q('classification',
  '{"items":[{"id":"i1","text":"Kedi"},{"id":"i2","text":"Gül"}],"categories":[{"id":"c1","text":"Hayvan"},{"id":"c2","text":"Bitki"}]}',
  '{"membership":{"i1":"c1","i2":"c2"}}'))$$, 'parent creates classification question');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014117',
  '{"grade":3,"subject":"Fen","topic":"Canlılar","kind":"multiple_choice","difficulty":"orta","stem":"Hangisi bir memelidir?","choices":[{"key":"A","text":"Kedi"},{"key":"B","text":"Balık"},{"key":"C","text":"Kurbağa"},{"key":"D","text":"Yılan"}],"correct_key":"A"}')$$,
  'legacy multiple choice still saved through the same RPC');
select lives_ok($$set constraints all immediate$$,'deferred structure/key/hash integrity checks pass for authored questions');
set constraints all deferred;
select is((select kind::text||'/'||interaction_type||'/'||schema_version from public.question_bank where id='40000000-0000-4000-8000-000000014111'),'structured/true_false/1','stored as structured + interaction_type + schema_version');
select is((select payload ? 'answers' from public.question_bank where id='40000000-0000-4000-8000-000000014111'),false,'public payload carries no answers');
select is((select interaction_type from public.question_bank where id='40000000-0000-4000-8000-000000014117'),null,'legacy row keeps NULL interaction_type (effective = kind)');
select is(public.save_question_with_sources('40000000-0000-4000-8000-000000014111', pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"Kedi bir memelidir."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]}',
  '{"answers":{"s1":true,"s2":false,"s3":true}}')),'40000000-0000-4000-8000-000000014111'::uuid,'same request replays idempotently');
select throws_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014111', pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"değişti"}]}','{"answers":{"s1":true}}'))$$,'request_conflict','same request id with different content conflicts');
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"a"},{"id":"s2","text":"b"}]}','{"answers":{"s1":true}}'))$$,'%question_structure_invalid%','missing key id rejected server-side');
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('drag_magic','{}','{}'))$$,'%interaction_type_unavailable%','unknown interaction type rejected');
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('true_false',
  jsonb_build_object('statements',(select jsonb_agg(jsonb_build_object('id','s'||g,'text','x')) from generate_series(1,11) g)),'{"answers":{}}'))$$,'%question_structure_invalid%','too many statements rejected');
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('true_false',
  jsonb_build_object('statements',jsonb_build_array(jsonb_build_object('id','s1','text',repeat('x',17000)))),'{"answers":{"s1":true}}'))$$,'%question_structure_invalid%','oversized payload rejected');
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"a"}]}','{"answers":{"s1":true}}','{"choices":[{"key":"A","text":"x"}]}'))$$,'%question_incomplete%','structured question cannot carry legacy choices');

-- Türler paketle kapanmaz: ücretsiz aile (B, override yok) de yapılandırılmış soru hazırlar.
select pg_temp.as_other();
select lives_ok($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('ordering',
  '{"items":[{"id":"a","text":"Bir"},{"id":"b","text":"İki"}],"mode":"sequence"}','{"orders":[["a","b"]]}'))$$,'free-plan family can author structured types (no package gate)');
select is(public.get_prova_entitlement()->>'plan','free','family B is on the free plan');
select pg_temp.as_parent();

-- 2) Anahtar erişimi -----------------------------------------------------------------------------
select is(jsonb_array_length(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000014111']::uuid[])),1,'parent reads own key via RPC');
select throws_ok($$select count(*) from public.question_answer_keys$$,'42501',null,'no direct table access to keys (even parent)');
select pg_temp.as_other();
select is(jsonb_array_length(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000014111']::uuid[])),0,'other family cannot read key');
select pg_temp.as_device();
select is(jsonb_array_length(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000014111']::uuid[])),0,'child device cannot read key');
select throws_ok($$select count(*) from public.question_answer_keys$$,'42501',null,'child device: no table access');
select is((select count(*)::int from public.question_bank where id='40000000-0000-4000-8000-000000014111'),0,'child device cannot select question_bank rows directly');

-- 3) Atama + sürüm bağı + OYSS ayrımı -----------------------------------------------------------------
select pg_temp.as_parent();
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('50000000-0000-4000-8000-000000014121','10000000-0000-4000-8000-000000014101','20000000-0000-4000-8000-000000014101','QT','Fen',3,
  array['40000000-0000-4000-8000-000000014111','40000000-0000-4000-8000-000000014112','40000000-0000-4000-8000-000000014113',
        '40000000-0000-4000-8000-000000014114','40000000-0000-4000-8000-000000014115','40000000-0000-4000-8000-000000014116',
        '40000000-0000-4000-8000-000000014117']::uuid[],'assigned');
reset role;
select is((select count(*)::int from gina.exam_item_bindings where exam_id='50000000-0000-4000-8000-000000014121'),7,'assignment binds every item (type/policy/points/hash)');
select is((select points from gina.exam_item_bindings where exam_id='50000000-0000-4000-8000-000000014121' and question_id='40000000-0000-4000-8000-000000014112'),2.00::numeric(6,2),'binding keeps question points');
select is((select interaction_type||'@'||policy from gina.exam_item_bindings where exam_id='50000000-0000-4000-8000-000000014121' and question_id='40000000-0000-4000-8000-000000014117'),'multiple_choice@legacy_choice','legacy item bound with legacy policy');
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade,question_ids,status,assessment_track) values
 ('10000000-0000-4000-8000-000000014101','20000000-0000-4000-8000-000000014101','OYSS','Fen',3,array['40000000-0000-4000-8000-000000014111']::uuid[],'assigned','meb_common')$$,
 'interaction_type_not_allowed_for_track','practice-only type not silently admitted to OYSS/common written track');
select lives_ok($$insert into public.exams(family_id,child_id,title,subject,grade,question_ids,status,assessment_track) values
 ('10000000-0000-4000-8000-000000014101','20000000-0000-4000-8000-000000014101','OYSS sayısal','Fen',3,array['40000000-0000-4000-8000-000000014113']::uuid[],'draft','meb_common')$$,
 'numeric (not practice-only) allowed on common written track');

-- 4) Çocuk projeksiyonu -------------------------------------------------------------------------
select pg_temp.as_device();
select throws_ok($$select * from public.get_attempt_questions('50000000-0000-4000-8000-000000014121')$$,'client_update_required','old client RPC fails explicitly (no blank screen / free-text fallback)');
select throws_like($$select * from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',array['multiple_choice','open_ended','true_false'])$$,'%client_update_required%','client missing a type gets explicit update error');
select is((select count(*)::int from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification'])),7,'capable client receives all items');
select is((select question_types from public.devices where id='30000000-0000-4000-8000-000000014101') @> array['matching','ordering'],true,'device capability recorded for assignment warning');
-- Sızıntı: öğrenci payload'ında anahtar alanları hiçbir derinlikte yok.
select is((select count(*)::int from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g
  where g.payload::text ~* '"(answers|pairs|membership|orders|accepted|tokens|unit_factors|value|abs_tolerance|rel_tolerance|weights|process_required|correct|key|rubric)"'),0,
  'no key/tolerance/weight/rubric fields anywhere in student payload');
select is((select jsonb_object_keys_agg from (select string_agg(k,',' order by k) jsonb_object_keys_agg from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g, jsonb_object_keys(g.payload) k where g.interaction_type='matching') x),
  'left,policy,right','matching projection = exact allow-list');
select is((select g.payload->'items' from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g where g.interaction_type='ordering')
  = '[{"id":"a","text":"Tohum"},{"id":"b","text":"Filiz"},{"id":"c","text":"Çiçek"}]'::jsonb, false, 'ordering never shown already solved');
select is((select string_agg(g.payload::text,'|') from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g),
  (select string_agg(g.payload::text,'|') from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g),'shuffle is stable across reloads');
select is((select payload->>'work_area' from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014121',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification']) g where g.id='40000000-0000-4000-8000-000000014115'),'true','work_area flag projected');

-- 5) Cevap kaydı ---------------------------------------------------------------------------------
select lives_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000014121')$$,'child starts attempt');
create temp table att as select id from public.exam_attempts where exam_id='50000000-0000-4000-8000-000000014121';
grant select on att to authenticated;
select is(public.submit_exam_answer_v4('70000000-0000-4000-8000-000000014101',(select id from att),'40000000-0000-4000-8000-000000014111',0,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":true,"s2":true}}'),1,'v4 saves structured answer (rev 1)');
select is(public.submit_exam_answer_v4('70000000-0000-4000-8000-000000014101',(select id from att),'40000000-0000-4000-8000-000000014111',0,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":true,"s2":true}}'),1,'duplicate request id replays same revision');
select throws_ok($$select public.submit_exam_answer_v4('70000000-0000-4000-8000-000000014101',(select id from att),'40000000-0000-4000-8000-000000014111',0,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":false}}')$$,'request_conflict','same request id, different answer → conflict');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',0,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":false}}')$$,'answer_changed','stale expected revision rejected');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',1,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":true,"s2":false}}'),2,'edit bumps revision');
select throws_ok($$select public.submit_exam_answer_v3(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',2,null,'doğru',null)$$,'client_update_required','old v3 device cannot overwrite structured answer');
select throws_ok($$select public.submit_exam_answer(( select id from att),'40000000-0000-4000-8000-000000014111',null,'x')$$,'client_update_required','old v1 path rejected too');
select is((select revision from public.get_saved_exam_answers_v4((select id from att)) where question_id='40000000-0000-4000-8000-000000014111'),2,'structured answer untouched by old clients');
select throws_like($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',2,null,null,null,
  '{"type":"true_false","v":1,"items":{"s9":true}}')$$,'%invalid_answer%','unknown item id rejected');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',2,null,'metin',null,
  '{"type":"true_false","v":1,"items":{}}')$$,'answer_type_mismatch','free text on structured question rejected');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014117',0,'A',null,null,
  '{"type":"true_false","v":1,"items":{}}')$$,'answer_type_mismatch','structured answer on legacy question rejected');
select throws_like($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014112',0,null,null,null,
  '{"type":"matching","v":1,"pairs":{"l1":"r1","l2":"r1"}}')$$,'%invalid_answer%','one-to-one reuse rejected');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014112',0,null,null,null,
  jsonb_build_object('type','matching','v',1,'pairs',jsonb_build_object('l1',repeat('r',9000))))$$,'invalid_input','oversized answer rejected');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014113',0,null,null,
  '{"version":1,"width":1000,"height":1400,"elements":[]}',null)$$,'answer_type_mismatch','notebook not allowed on numeric without work area');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014115',0,null,null,
  '{"version":1,"width":1000,"height":1400,"elements":[]}','{"type":"numeric","v":1,"value":"12"}'),1,'numeric with work area accepts notebook + value');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014112',0,null,null,null,
  '{"type":"matching","v":1,"pairs":{"l1":"r1","l2":"r3"}}'),1,'matching saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014113',0,null,null,null,
  '{"type":"numeric","v":1,"value":"1,5","unit":"m"}'),1,'numeric saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014114',0,null,null,null,
  '{"type":"ordering","v":1,"order":["b","a","c"]}'),1,'ordering saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014117',0,'A',null,null,null),1,'legacy MC via v4 still scored as before');
select is((select count(*)::int from public.get_saved_exam_answers_v4((select id from att)) where answer is not null),5,'get_saved v4 returns structured answers');
select is((select score from public.exam_answers where question_id='40000000-0000-4000-8000-000000014111'),null,'no score computed while in progress (no answer oracle)');
select is((public.get_attempt_summary((select id from att))->>'score_pct'),null,'child summary exposes no score mid-attempt');
-- Classification (i1,i2) never answered → unanswered (not auto 0).
select lives_ok($$select public.finish_exam_attempt((select id from att))$$,'child finishes');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',2,null,null,null,
  '{"type":"true_false","v":1,"items":{"s1":true,"s2":false,"s3":true}}')$$,'attempt_closed','no writes after finish');
select is((public.get_attempt_summary((select id from att)) ? 'structured_answers'),false,'child summary has no per-item detail');

-- 6) Puanlama + toplamlar --------------------------------------------------------------------------
select pg_temp.as_parent();
select results_eq($$select question_id::text, score_exact::numeric(7,4), graded_by from public.exam_answers where attempt_id=(select id from att) and question_id in
  ('40000000-0000-4000-8000-000000014111','40000000-0000-4000-8000-000000014112','40000000-0000-4000-8000-000000014113','40000000-0000-4000-8000-000000014114') order by 1$$,
  $$values ('40000000-0000-4000-8000-000000014111',66.6667::numeric(7,4),'auto'),('40000000-0000-4000-8000-000000014112',50.0000::numeric(7,4),'auto'),
          ('40000000-0000-4000-8000-000000014113',100.0000::numeric(7,4),'auto'),('40000000-0000-4000-8000-000000014114',66.6667::numeric(7,4),'auto')$$,
  'SQL scores at finish: TF 2/3 partial, matching 1/2, numeric unit-converted, ordering 2/3 pairs');
select is((select score_details->>'answer_state' from public.exam_answers where question_id='40000000-0000-4000-8000-000000014111' and attempt_id=(select id from att)),'partial','partial TF marked partial');
select is((select score_details->>'outcome' from public.exam_answers where question_id='40000000-0000-4000-8000-000000014115' and attempt_id=(select id from att)),'pending_human','process-required numeric waits for parent');
select results_eq($$select status::text, provisional, items_total, items_scored, items_pending, items_unanswered, items_partial, open_total, mc_total, mc_correct
  from public.exam_attempts where id=(select id from att)$$,
  $$values ('submitted',true,7,5,1,1,1,0,1,1)$$, 'totals: 5 scored, 1 pending human, 1 unanswered, 1 partial; provisional');
-- score_pct: weighted: TF 66.6667*1 + matching 50*2 + numeric 100 + ordering 66.6667 + MC 100 over weights 6 → 72.2222 → 72
select is((select score_pct::int from public.exam_attempts where id=(select id from att)),72,'score_pct weighted by bound points, single final rounding');
select is((select jsonb_array_length(public.get_attempt_summary((select id from att))->'structured_answers')),6,'parent summary lists structured items');

-- 7) Veli puanı ----------------------------------------------------------------------------------
reset role;
create temp table h as select question_id, gina.answer_fingerprint(a) fp from public.exam_answers a where attempt_id=(select id from att);
grant select on h to authenticated;
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111',
  (select fp from h where question_id='40000000-0000-4000-8000-000000014111'),100::smallint,null)$$,'score_reason_required','changing an auto score requires a reason');
select throws_ok($$select public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014111','stale',100::smallint,'Çocuk sözlü açıkladı.')$$,'answer_changed','stale answer hash rejected');
select is((public.set_structured_answer_score('70000000-0000-4000-8000-000000014191',(select id from att),'40000000-0000-4000-8000-000000014115',
  (select fp from h where question_id='40000000-0000-4000-8000-000000014115'),80::smallint,null))->>'score','80','parent scores pending process item (no auto score → no reason needed)');
select is((public.set_structured_answer_score('70000000-0000-4000-8000-000000014192',(select id from att),'40000000-0000-4000-8000-000000014116',
  null,0::smallint,null))->>'status','graded','parent scores unanswered item explicitly → attempt graded');
select is((public.set_structured_answer_score('70000000-0000-4000-8000-000000014192',(select id from att),'40000000-0000-4000-8000-000000014116',
  null,0::smallint,null))->>'status','graded','override request replays idempotently');
select is(jsonb_array_length(public.get_structured_score_overrides((select id from att))),2,'override audit trail recorded');
select throws_ok($$select public.score_open_answer((select id from att),'40000000-0000-4000-8000-000000014111',50::smallint)$$,'question_not_open_ended','open-ended grading path does not touch structured items');
select pg_temp.as_other();
select throws_ok($$select public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014115','x',1::smallint,'x')$$,'attempt_not_found','other family cannot score');
select pg_temp.as_device();
select throws_ok($$select public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014115','x',1::smallint,'x')$$,'42501',null,'child cannot score');

-- 7b) Gelişim raporu: yapılandırılmış maddeler doğru sınıflanır (cevaplı madde 'blank' sayılmaz).
select pg_temp.as_parent();
select results_eq($$select (s->>'correct')::int, (s->>'partial')::int, (s->>'wrong')::int, (s->>'blank')::int, (s->>'pending')::int
  from (select public.learning_progress('20000000-0000-4000-8000-000000014101',30)->'summary' s) x$$,
  $$values (2,4,1,0,0)$$, 'learning progress: MC+numeric correct, 4 partial, parent-0 wrong, none blank/pending');

-- 8) Hash zinciri + sürüm sabitliği --------------------------------------------------------------
reset role;
select is((select gina.answer_fingerprint(a) from public.exam_answers a where attempt_id=(select id from att) and question_id='40000000-0000-4000-8000-000000014117'),
  encode(extensions.digest(jsonb_build_object('key','A','text',null,'document',null,'revision',1)::text,'sha256'),'hex'),'legacy answer fingerprint unchanged (old review hashes stay valid)');
select isnt((select fp from h where question_id='40000000-0000-4000-8000-000000014111'),
  encode(extensions.digest(jsonb_build_object('key',null,'text',null,'document',null,'revision',2)::text,'sha256'),'hex'),'structured answer is part of the fingerprint');
select throws_ok($$update public.question_answer_keys set key='{"answers":{"s1":false,"s2":false,"s3":false}}' where question_id='40000000-0000-4000-8000-000000014111'$$,'question_in_use','key of a used question cannot change');
select throws_ok($$update public.question_bank set payload='{"statements":[{"id":"s1","text":"x"}]}' where id='40000000-0000-4000-8000-000000014111'$$,'question_in_use','payload of a used question cannot change');
select throws_ok($$delete from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000014111'$$,'question_in_use','key of a used question cannot be deleted');
-- Kötüye kullanım: anahtarsız yapılandırılmış satır işlem sonunda reddedilir.
select throws_like($$insert into public.question_bank(family_id,grade,subject,topic,kind,interaction_type,schema_version,payload,stem) values
  ('10000000-0000-4000-8000-000000014101',3,'Fen','x','structured','true_false',1,'{"statements":[{"id":"s1","text":"a"}]}','Soru kökü');
  set constraints all immediate$$,'%structured_key_missing%','structured question without key rejected');

select * from finish();
rollback;
