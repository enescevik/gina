-- QT30–QT33 (Faz 2A): türler istemci hazır olana kadar kapalı; açılınca hazırlama → öğrenci projeksiyonu
-- (anahtar sızmaz) → v4 kayıt → bitişte puan (dengeli seçim, bul/düzelt, iki aşama) → veli yolu.
begin;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000014201','qt2-parent@test.local'),('00000000-0000-4000-8000-000000014203','qt2-device@test.local');
insert into public.families(id,name,created_by) values ('10000000-0000-4000-8000-000000014201','QT2','00000000-0000-4000-8000-000000014201');
insert into public.family_members(family_id,user_id) values ('10000000-0000-4000-8000-000000014201','00000000-0000-4000-8000-000000014201');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000014201','10000000-0000-4000-8000-000000014201','Ece',4);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000014201','10000000-0000-4000-8000-000000014201','00000000-0000-4000-8000-000000014203','20000000-0000-4000-8000-000000014201');
create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014201","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014201","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014203","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014201","role":"device","child_id":"20000000-0000-4000-8000-000000014201"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb) returns jsonb language sql as $$
 select jsonb_build_object('grade',4,'subject','Türkçe','topic','Fiiller','difficulty','orta','stem','Yönergeyi uygula.','interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key);
$$;
create temp table qs(t text, id uuid, payload jsonb, key jsonb);
insert into qs values
 ('mark_text','40000000-0000-4000-8000-000000014211','{"unit":"word","segments":[{"id":"t1","text":"Ali"},{"text":" "},{"id":"t2","text":"topu"},{"text":" "},{"id":"t3","text":"attı"},{"text":"."}]}','{"targets":["t3"]}'),
 ('multi_choice','40000000-0000-4000-8000-000000014212','{"options":[{"id":"o1","text":"Kedi"},{"id":"o2","text":"Gül"},{"id":"o3","text":"Kuş"}],"select_count":2}','{"correct":["o1","o3"]}'),
 ('error_fix','40000000-0000-4000-8000-000000014213','{"unit":"word","segments":[{"id":"t1","text":"Dün"},{"text":" okula "},{"id":"t2","text":"gidiyorum"},{"text":"."}]}','{"errors":{"t2":{"accepted":["gittim"]}}}'),
 ('two_stage','40000000-0000-4000-8000-000000014214','{"stage1":{"prompt":"Hangisi iletkendir?","options":[{"id":"a1","text":"Bakır"},{"id":"a2","text":"Plastik"}]},"stage2":{"prompt":"Neden?","mode":"text"}}','{"stage1":"a1"}');
grant select on qs to authenticated;

-- Yayın anahtarı (20261107050400) türleri açar; kapalıyken davranış burada açıkça kapatılarak denenir.
update public.interaction_types set enabled=false where phase='2A';
set local role authenticated;
select pg_temp.as_parent();
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q(t,payload,key)) from qs where t='mark_text'$$,'%interaction_type_unavailable%','2A types disabled until clients ship: authoring rejected');
reset role;
update public.interaction_types set enabled=true where phase='2A';
set local role authenticated;
select pg_temp.as_parent();
select is((select count(*)::int from qs, lateral (select public.save_question_with_sources(qs.id, pg_temp.q(qs.t,qs.payload,qs.key))) x),4,'all four 2A types authored once enabled');
select lives_ok($$set constraints all immediate$$,'deferred integrity checks pass');
set constraints all deferred;
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('multi_choice','{"options":[{"id":"o1","text":"a"},{"id":"o2","text":"b"},{"id":"o3","text":"c"}]}','{"correct":["o1","o2","o3"]}'))$$,
  '%question_structure_invalid%','all-correct multi choice rejected (select-all exploit structure)');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('50000000-0000-4000-8000-000000014221','10000000-0000-4000-8000-000000014201','20000000-0000-4000-8000-000000014201','2A','Türkçe',4,
  (select array_agg(id order by id) from qs),'assigned');

select pg_temp.as_device();
select throws_like($$select * from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014221',array['multiple_choice','open_ended','true_false'])$$,'%client_update_required%','1A/1B-only client gets explicit update error for 2A exam');
create temp table proj as select * from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014221',
  array['multiple_choice','open_ended','true_false','fill_blank','matching','numeric','ordering','classification','mark_text','error_fix','multi_choice','two_stage']);
select is((select count(*)::int from proj where payload::text ~* '"(targets|correct|errors|accepted|find_weight|fix_policy|weights)"'),0,'no key fields in 2A student payloads');
select is((select payload->'stage2' from proj where interaction_type='two_stage'),'{"mode":"text","prompt":"Neden?"}'::jsonb,'stage 2 projected without stage 1 key');
select lives_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000014221')$$,'attempt started');
create temp table att as select id from public.exam_attempts where exam_id='50000000-0000-4000-8000-000000014221';
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014212',0,null,null,null,'{"type":"multi_choice","v":1,"selected":["o1","o2","o3"]}')$$,'invalid_answer','selection limit from select_count enforced (detail answer_too_many)');
select throws_ok($$select gina.qt_answer_errors('multi_choice','{}','{}')$$,'42501',null,'internal validators not callable by clients');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014211',0,null,null,null,'{"type":"mark_text","v":1,"selected":["t3","t1"]}'),1,'mark saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014212',0,null,null,null,'{"type":"multi_choice","v":1,"selected":["o1","o3"]}'),1,'multi saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014213',0,null,null,null,'{"type":"error_fix","v":1,"marks":{"t2":{"text":"gitmiştim"}}}'),1,'error fix saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014214',0,null,null,null,'{"type":"two_stage","v":1,"stage1":"a1","stage2":{"text":"Metal olduğu için."}}'),1,'two stage saved');
select lives_ok($$select public.finish_exam_attempt((select id from att))$$,'finished');

reset role;
select is(gina.qt_answer_errors('multi_choice',(select payload from qs where t='multi_choice'),'{"type":"multi_choice","v":1,"selected":["o1","o2","o3"]}'),array['answer_too_many'],'error code answer_too_many');
select results_eq($$select q.interaction_type, a.score_exact::numeric(7,4), a.score_details->>'outcome' from public.exam_answers a join public.question_bank q on q.id=a.question_id
  where a.attempt_id=(select id from att) order by q.interaction_type$$,
  $$values ('error_fix',null::numeric(7,4),'pending_human'),('mark_text',50.0000::numeric(7,4),'scored'),('multi_choice',100.0000::numeric(7,4),'scored'),('two_stage',null::numeric(7,4),'pending_human')$$,
  'mark: 1 target + 1 of 2 distractors → 1 − 1/2 = 50; multi exact → 100; unmatched fix and text reason → parent');
select results_eq($$select items_scored, items_pending, provisional from public.exam_attempts where id=(select id from att)$$,$$values (2,2,true)$$,'two items wait for parent');
select is((select (score_details->'items'->>'auto_result_score')::numeric(7,4) from public.exam_answers where attempt_id=(select id from att) and question_id='40000000-0000-4000-8000-000000014214'),50.0000::numeric(7,4),'two-stage auto part shown to parent as hint (stage 1 correct = 50)');
reset role;
create temp table h as select question_id, gina.answer_fingerprint(a) fp from public.exam_answers a where attempt_id=(select id from att);
grant select on h, att to authenticated;
set local role authenticated;
select pg_temp.as_parent();
select is((public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014213',(select fp from h where question_id='40000000-0000-4000-8000-000000014213'),100::smallint,null)->>'score'),'100','parent accepts meaningful alternative fix');
select is((public.set_structured_answer_score(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014214',(select fp from h where question_id='40000000-0000-4000-8000-000000014214'),100::smallint,null)->>'status'),'graded','parent scores reason → graded');
select * from finish();
rollback;
