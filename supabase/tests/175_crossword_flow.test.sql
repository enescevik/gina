begin;
select no_plan();
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000017501','crossword-parent@test.local'),('00000000-0000-4000-8000-000000017503','crossword-device@test.local');
insert into public.families(id,name,created_by) values ('10000000-0000-4000-8000-000000017501','QT3','00000000-0000-4000-8000-000000017501');
insert into public.family_members(family_id,user_id) values ('10000000-0000-4000-8000-000000017501','00000000-0000-4000-8000-000000017501');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000017501','10000000-0000-4000-8000-000000017501','Can',2);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000017501','10000000-0000-4000-8000-000000017501','00000000-0000-4000-8000-000000017503','20000000-0000-4000-8000-000000017501');
create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017501","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017501","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017503","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017501","role":"device","child_id":"20000000-0000-4000-8000-000000017501"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb) returns jsonb language sql as $$
 select jsonb_build_object('grade',2,'subject','Matematik','topic','Kesirler','difficulty','kolay','stem','Yönergeyi uygula.','interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key);
$$;
create function pg_temp.puzzle() returns jsonb language sql as $$
  select pg_temp.q('crossword',
    '{"rows":3,"cols":3,"clues":[{"id":"a","dir":"across","row":1,"col":1,"length":3,"text":"Kışın gökten yağan beyaz taneler."},{"id":"b","dir":"down","row":1,"col":1,"length":3,"text":"Bir kişiye karşı duyulan güçlü öfke."}]}',
    '{"answers":{"a":"KAR","b":"KİN"}}')
$$;
set local role authenticated;
select pg_temp.as_parent();
select throws_like($$select public.save_question_with_sources(gen_random_uuid(),pg_temp.puzzle())$$,
 '%interaction_type_unavailable%','production gate defaults closed');
reset role;
insert into gina.crossword_pilot_access values (
 '10000000-0000-4000-8000-000000017501', '00000000-0000-4000-8000-000000017501', now()+interval '1 day'
);
select ok(not (select enabled from public.interaction_types where type='crossword'),'registry remains closed');
select ok(not gina.crossword_pilot_allowed('10000000-0000-4000-8000-000000017501','00000000-0000-4000-8000-000000017503'),'another account cannot use the family grant');
select ok(not gina.crossword_pilot_allowed(gen_random_uuid(),'00000000-0000-4000-8000-000000017501'),'the granted account cannot use another family');
select ok(not has_function_privilege('authenticated','gina.crossword_pilot_allowed(uuid,uuid)','execute'),'grant lookup is private');
set local role authenticated;
select pg_temp.as_parent();
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000017511',pg_temp.puzzle())$$,'parent saves a crossword when enabled');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status)
values('50000000-0000-4000-8000-000000017511','10000000-0000-4000-8000-000000017501','20000000-0000-4000-8000-000000017501','Bulmaca','Matematik',2,
 array['40000000-0000-4000-8000-000000017511']::uuid[],'assigned');
select pg_temp.as_device();
select throws_like($$select * from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000017511',array['true_false'])$$,
 '%client_update_required%','old reader explicitly requests an update');
select is((select jsonb_array_length(payload->'clues') from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000017511',array['crossword'])),2,'student receives both clues');
select ok((select payload::text !~ 'KİN|KAR|answer' from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000017511',array['crossword'])),'student payload excludes private words');
create temp table att as select id from public.start_exam_attempt('50000000-0000-4000-8000-000000017511');
select throws_ok($$select public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000017511',0,null,null,null,
 '{"type":"crossword","v":1,"cells":{"r3_c3":"A"}}')$$,'P0001','invalid_answer','unplayable cell refused');
select is(public.submit_exam_answer_v4(gen_random_uuid(),(select id from att),'40000000-0000-4000-8000-000000017511',0,null,null,null,
 '{"type":"crossword","v":1,"cells":{"r1_c1":"K","r1_c2":"A","r1_c3":"R","r2_c1":"i","r3_c1":"M"}}'),1,'Turkish cells saved');
select lives_ok($$select public.finish_exam_attempt((select id from att))$$,'finish applies per-clue grading');
reset role;
select is((select score_exact::numeric(7,4) from public.exam_answers where attempt_id=(select id from att)),50.0000::numeric(7,4),'one of two clues scores half');
update gina.crossword_pilot_access set expires_at=now();
set local role authenticated;
select pg_temp.as_parent();
select throws_like($$select public.save_question_with_sources(gen_random_uuid(),pg_temp.puzzle())$$,
 '%interaction_type_unavailable%','expired pilot cannot create questions');
reset role;
select * from finish();
rollback;
