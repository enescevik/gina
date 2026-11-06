-- QT41/QT42 (Faz 2B): bölge seçme, saat, tablo/grafik uyaranı — kapalı gelir; açılınca projeksiyon izin listesi,
-- uyaran yeniden kurulur, bitişte SQL puanı.
begin;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000014301','qt3-parent@test.local'),('00000000-0000-4000-8000-000000014303','qt3-device@test.local');
insert into public.families(id,name,created_by) values ('10000000-0000-4000-8000-000000014301','QT3','00000000-0000-4000-8000-000000014301');
insert into public.family_members(family_id,user_id) values ('10000000-0000-4000-8000-000000014301','00000000-0000-4000-8000-000000014301');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000014301','10000000-0000-4000-8000-000000014301','Can',2);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000014301','10000000-0000-4000-8000-000000014301','00000000-0000-4000-8000-000000014303','20000000-0000-4000-8000-000000014301');
create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014301","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000014303","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000014301","role":"device","child_id":"20000000-0000-4000-8000-000000014301"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb) returns jsonb language sql as $$
 select jsonb_build_object('grade',2,'subject','Matematik','topic','Kesirler','difficulty','kolay','stem','Yönergeyi uygula.','interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key);
$$;
-- Yayın anahtarı (20261107040000) türleri açar; kapalıyken davranış burada açıkça kapatılarak denenir.
update public.interaction_types set enabled=false where phase='2B';
set local role authenticated;
select pg_temp.as_parent();
select throws_like($$select public.save_question_with_sources(gen_random_uuid(), pg_temp.q('clock','{"mode":"set","display":"analog","step_minutes":5}','{"time":"07:30"}'))$$,'%interaction_type_unavailable%','2B disabled by default');
reset role;
update public.interaction_types set enabled=true where phase='2B';
set local role authenticated;
select pg_temp.as_parent();
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014311', pg_temp.q('region_select',
  '{"figure":{"kind":"grid","rows":2,"cols":2},"regions":[{"id":"g1","text":"Sol üst"},{"id":"g2","text":"Sağ üst"},{"id":"g3","text":"Sol alt"},{"id":"g4","text":"Sağ alt"}]}','{"count":1}'))$$,'shape colouring: colour 1 of 4');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014312', pg_temp.q('clock','{"mode":"set","display":"analog","step_minutes":5}','{"time":"07:30"}'))$$,'clock set');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000014313', pg_temp.q('true_false',
  '{"statements":[{"id":"s1","text":"Salı günü en çok sayfa okundu."}],"stimulus":{"kind":"bar_chart","alt":"Pazartesi 10, Salı 15 sayfa okunan grafik","x_label":"Gün","y_label":"Sayfa","bars":[{"label":"Pzt","value":10},{"label":"Sal","value":15}]}}',
  '{"answers":{"s1":true}}'))$$,'true/false with bar chart stimulus');
select lives_ok($$set constraints all immediate$$,'deferred integrity checks pass');
set constraints all deferred;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('50000000-0000-4000-8000-000000014321','10000000-0000-4000-8000-000000014301','20000000-0000-4000-8000-000000014301','2B','Matematik',2,
  array['40000000-0000-4000-8000-000000014311','40000000-0000-4000-8000-000000014312','40000000-0000-4000-8000-000000014313']::uuid[],'assigned');
select pg_temp.as_device();
create temp table proj as select * from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000014321',
  array['multiple_choice','open_ended','true_false','region_select','clock']);
select is((select count(*)::int from proj where payload::text ~* '"(count|targets|time|answers|accept_12h)"'),0,'no key fields (count/targets/time) in 2B projections');
select is((select payload->'stimulus'->>'kind' from proj where interaction_type='true_false'),'bar_chart','stimulus projected');
select is((select payload->'stimulus'->>'alt' from proj where interaction_type='true_false'),'Pazartesi 10, Salı 15 sayfa okunan grafik','alt text kept for accessibility');
select lives_ok($$select public.start_exam_attempt('50000000-0000-4000-8000-000000014321')$$,'start');
create temp table att as select id from public.exam_attempts where exam_id='50000000-0000-4000-8000-000000014321';
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014312',0,null,null,null,'{"type":"clock","v":1,"time":"07:32"}')$$,'invalid_answer','clock answer must respect minute step');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014311',0,null,null,null,'{"type":"region_select","v":1,"selected":["g4"]}'),1,'region saved');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014312',0,null,null,null,'{"type":"clock","v":1,"time":"19:30"}'),1,'clock saved (24h form)');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000014313',0,null,null,null,'{"type":"true_false","v":1,"items":{"s1":true}}'),1,'tf saved');
select lives_ok($$select public.finish_exam_attempt((select id from att))$$,'finished');
reset role;
select results_eq($$select q.interaction_type, a.score_exact::numeric(7,4) from public.exam_answers a join public.question_bank q on q.id=a.question_id where a.attempt_id=(select id from att) order by 1$$,
  $$values ('clock',100.0000::numeric(7,4)),('region_select',100.0000::numeric(7,4)),('true_false',100.0000::numeric(7,4))$$,'any one region of four, 12h-equivalent time and chart-read statement all scored');
select is((select status::text from public.exam_attempts where id=(select id from att)),'graded','fully auto-scored attempt is graded');
select * from finish();
rollback;
