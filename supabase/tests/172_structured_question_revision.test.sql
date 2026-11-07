begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000017201','revision-parent@test.local'),
 ('00000000-0000-4000-8000-000000017202','revision-other@test.local'),
 ('00000000-0000-4000-8000-000000017203','revision-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000017201','QT A','00000000-0000-4000-8000-000000017201'),
 ('10000000-0000-4000-8000-000000017202','QT B','00000000-0000-4000-8000-000000017202');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000017201','00000000-0000-4000-8000-000000017201'),
 ('10000000-0000-4000-8000-000000017202','00000000-0000-4000-8000-000000017202');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000017201','10000000-0000-4000-8000-000000017201','Ada',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000017201','10000000-0000-4000-8000-000000017201','00000000-0000-4000-8000-000000017203','20000000-0000-4000-8000-000000017201');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000017201','pro','test',now()+interval '1 day');

create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017201","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017201","role":"parent"}}',true);
$$;
create function pg_temp.as_other() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017202","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017202","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017203","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017201","role":"device","child_id":"20000000-0000-4000-8000-000000017201"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('grade',3,'subject','Fen','topic','Canlılar','difficulty','orta','stem','Aşağıdaki ifadeleri değerlendir.',
  'interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key) || extra;
$$;

set local role authenticated;
select pg_temp.as_parent();

select public.save_question_with_sources('40000000-0000-4000-8000-000000017211', pg_temp.q('true_false',
 '{"statements":[{"id":"s1","text":"Kedi bir memelidir."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]}',
 '{"answers":{"s1":true,"s2":false,"s3":true}}'));
select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000017211',0,
 '{"childId":"20000000-0000-4000-8000-000000017201","grade":3,"title":"Practice","purpose":"practice","format":"practice",
 "subjects":["Fen"],"topics":[],"target":1,"minutes":null,"difficulty":"orta","kind":"mixed","note":"","step":2,
 "blocks":[{"kind":"question","id":"40000000-0000-4000-8000-000000017211","source":"manual"}]}');
reset role;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind)
values('50000000-0000-4000-8000-000000017221','10000000-0000-4000-8000-000000017201','20000000-0000-4000-8000-000000017201','Assigned','Fen',3,
 array['40000000-0000-4000-8000-000000017211']::uuid[],'assigned','practice');
create temp table original_hash as select content_hash from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000017211';
create function pg_temp.revise(v int, request uuid, changes jsonb) returns uuid language sql as $$
 select public.revise_structured_question(request,'40000000-0000-4000-8000-000000017211','50000000-0000-4000-8000-000000017211',v,changes)
$$;
set local role authenticated;
select throws_ok($$select pg_temp.revise(2,gen_random_uuid(),'{"stem":"Stale revision"}')$$,'P0001','prova_draft_changed','stale revision refused');
select pg_temp.as_other();
select throws_ok($$select pg_temp.revise(1,gen_random_uuid(),'{"stem":"Outside family"}')$$,'P0001','prova_draft_not_found','outside family refused');
select pg_temp.as_device();
select throws_ok($$select pg_temp.revise(1,gen_random_uuid(),'{"stem":"From child"}')$$,'42501','forbidden','child cannot edit');
select pg_temp.as_parent();
select throws_ok($$select pg_temp.revise(1,gen_random_uuid(),'{"payload":{},"answer_key":{}}')$$,'P0001','question_structure_invalid','payload and private key validated');
select is(pg_temp.revise(1,'40000000-0000-4000-8000-000000017212','{"stem":"Yenilenmiş yönerge"}'),
 '40000000-0000-4000-8000-000000017212'::uuid,'revision forks the question');
select is(pg_temp.revise(1,'40000000-0000-4000-8000-000000017212','{"stem":"Yenilenmiş yönerge"}'),
 '40000000-0000-4000-8000-000000017212'::uuid,'retry returns original receipt');
select throws_ok($$select pg_temp.revise(1,'40000000-0000-4000-8000-000000017212','{"stem":"Different"}')$$,'P0001','request_conflict','request cannot be reused for different content');
select is(public.get_prova_drafts('50000000-0000-4000-8000-000000017211')#>>'{0,content,blocks,0,id}',
 '40000000-0000-4000-8000-000000017212','open draft now points to new id');
select is(public.get_prova_drafts('50000000-0000-4000-8000-000000017211')#>>'{0,version}','2','draft revision advanced exactly once');
select lives_ok('set constraints all immediate','new and original keys satisfy deferred hash validation');
set constraints all deferred;
reset role;
select is((select question_ids[1] from public.exams where id='50000000-0000-4000-8000-000000017221'),
 '40000000-0000-4000-8000-000000017211'::uuid,'assigned exam stays on old question');
select is((select content_hash from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000017211'),
 (select content_hash from original_hash),'original scoring hash unchanged');
select is((select key from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000017212'),
 (select key from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000017211'),'unchanged key copied into a private new row');
set local role authenticated;
select pg_temp.as_parent();
select is(public.revise_structured_question('40000000-0000-4000-8000-000000017213','40000000-0000-4000-8000-000000017212',
 '50000000-0000-4000-8000-000000017211',2,
 '{"stem":"Shared source\n\n\nEvaluate the statements.","payload":{"statements":[{"id":"s1","text":"Kedi bir kuştur."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]},"answer_key":{"answers":{"s1":false,"s2":false,"s3":true}}}'),
 '40000000-0000-4000-8000-000000017213'::uuid,'interactive fields and answer can be changed together');
select is(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000017213']::uuid[])#>>'{0,key,answers,s1}',
 'false','new revision carries changed scoring key');
reset role;
insert into public.question_source_groups(id,family_id,series_id,version,title,grade,subject)
values('60000000-0000-4000-8000-000000017211','10000000-0000-4000-8000-000000017201',
 '60000000-0000-4000-8000-000000017211',1,'Shared source',3,'Fen');
insert into public.question_source_members(group_id,question_id,prompt,position)
values('60000000-0000-4000-8000-000000017211','40000000-0000-4000-8000-000000017213','Evaluate the statements.',1);
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select public.revise_structured_question(gen_random_uuid(),'40000000-0000-4000-8000-000000017213',
 '50000000-0000-4000-8000-000000017211',3,'{"stem":"Separate group member"}')$$,
 'P0001','structured_revision_ineligible','a group member cannot be forked as an independent question');
reset role;
update public.prova_drafts set submitted_at=now(),exam_id='50000000-0000-4000-8000-000000017221' where id='50000000-0000-4000-8000-000000017211';
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select pg_temp.revise(2,gen_random_uuid(),'{"stem":"Closed draft"}')$$,'P0001','prova_draft_submitted','submitted draft cannot be changed');
select pg_temp.as_device();
select is((select stem from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000017221',array['true_false'])),
 'Aşağıdaki ifadeleri değerlendir.','assigned learner still receives original stem');
select is(jsonb_array_length(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000017212']::uuid[])),0,'child cannot obtain the revised key');
select * from finish();
rollback;
