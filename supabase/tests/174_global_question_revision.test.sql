begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000017401','global-revision-parent@test.local'),
 ('00000000-0000-4000-8000-000000017402','global-revision-other@test.local'),
 ('00000000-0000-4000-8000-000000017403','global-revision-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000017401','QT A','00000000-0000-4000-8000-000000017401'),
 ('10000000-0000-4000-8000-000000017402','QT B','00000000-0000-4000-8000-000000017402');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000017401','00000000-0000-4000-8000-000000017401'),
 ('10000000-0000-4000-8000-000000017402','00000000-0000-4000-8000-000000017402');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000017401','10000000-0000-4000-8000-000000017401','Ada',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000017401','10000000-0000-4000-8000-000000017401','00000000-0000-4000-8000-000000017403','20000000-0000-4000-8000-000000017401');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000017401','pro','test',now()+interval '1 day');

create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017401","role":"parent"}}',true);
$$;
create function pg_temp.as_other() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017402","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017402","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017403","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017401","role":"device","child_id":"20000000-0000-4000-8000-000000017401"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('grade',3,'subject','Fen','topic','Canlılar','difficulty','orta','stem','Aşağıdaki ifadeleri değerlendir.',
  'interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key) || extra;
$$;

insert into public.admins(user_id) values('00000000-0000-4000-8000-000000017402');
create function pg_temp.admin_claim() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017402","role":"authenticated","gina":{"role":"none","admin":true}}',true)
$$;
select gina.qt_insert_structured('40000000-0000-4000-8000-000000017411',null,pg_temp.q('true_false',
 '{"statements":[{"id":"s1","text":"Kedi bir memelidir."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]}',
 '{"answers":{"s1":true,"s2":false,"s3":true}}'),'{}',null);
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status)
values('50000000-0000-4000-8000-000000017411','10000000-0000-4000-8000-000000017401','20000000-0000-4000-8000-000000017401',
 'Assigned','Fen',3,array['40000000-0000-4000-8000-000000017411']::uuid[],'assigned');
create function pg_temp.revise(req uuid, changes jsonb) returns uuid language sql as $$
 select public.admin_revise_global_question(req,'40000000-0000-4000-8000-000000017411',changes)
$$;
create function pg_temp.changes() returns jsonb language sql as $$
 select '{"stem":"Yeni sürümde ifadeleri değerlendir.","payload":{"statements":[{"id":"s1","text":"Kedi bir kuştur."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]},"answer_key":{"answers":{"s1":false,"s2":false,"s3":true}}}'::jsonb
$$;
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select pg_temp.revise(gen_random_uuid(),pg_temp.changes())$$,'42501','forbidden','parent cannot revise global question');
select throws_ok('delete from public.global_question_revisions','42501',null,'parent cannot alter global lineage');
select pg_temp.admin_claim();
select throws_ok($$select pg_temp.revise(gen_random_uuid(),'{"payload":{},"answer_key":{}}')$$,'P0001','question_structure_invalid','invalid pair fails');
select is(pg_temp.revise('40000000-0000-4000-8000-000000017412',pg_temp.changes()),'40000000-0000-4000-8000-000000017412'::uuid,'admin creates new identity');
select is(pg_temp.revise('40000000-0000-4000-8000-000000017412',pg_temp.changes()),'40000000-0000-4000-8000-000000017412'::uuid,'same request is idempotent');
select throws_ok($$select pg_temp.revise('40000000-0000-4000-8000-000000017412','{"stem":"Different request"}')$$,'P0001','request_conflict','changed retry rejected');
select throws_ok($$select pg_temp.revise(gen_random_uuid(),pg_temp.changes())$$,'P0001','question_revision_changed','stale source rejected');
select is((select count(*) from public.audit_log where action='question_bank.revise_global'
 and target_id='40000000-0000-4000-8000-000000017412'
 and details->>'previous_id'='40000000-0000-4000-8000-000000017411'
 and details->>'question_id'='40000000-0000-4000-8000-000000017412' and not details ? 'answer_key'),1::bigint,'audit records both IDs once without key');
select is(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000017412']::uuid[])#>>'{0,key,answers,s1}','false','revised key distinct');
select lives_ok('set constraints all immediate','new hash validates');
reset role;
select is((select content_hash from gina.exam_item_bindings where exam_id='50000000-0000-4000-8000-000000017411'),
 (select content_hash from public.question_answer_keys where question_id='40000000-0000-4000-8000-000000017411'),'assigned hash stays on original key');
set local role authenticated;
select pg_temp.as_parent();
select is((select count(*) from public.standalone_question_bank where id='40000000-0000-4000-8000-000000017411'),0::bigint,'old revision absent from new selection');
select is((select count(*) from public.current_question_bank where id='40000000-0000-4000-8000-000000017412'),1::bigint,'new revision available');
select pg_temp.as_device();
select is((select stem from public.get_attempt_questions_v2('50000000-0000-4000-8000-000000017411',array['true_false'])),
 'Aşağıdaki ifadeleri değerlendir.','assigned learner sees original');
select is(jsonb_array_length(public.get_question_answer_keys(array['40000000-0000-4000-8000-000000017412']::uuid[])),0,'child cannot read private key');
select * from finish();
rollback;
