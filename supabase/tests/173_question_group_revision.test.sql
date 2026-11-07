begin;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000017301','group-revision-parent@test.local'),
 ('00000000-0000-4000-8000-000000017302','group-revision-other@test.local'),
 ('00000000-0000-4000-8000-000000017303','group-revision-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000017301','QT A','00000000-0000-4000-8000-000000017301'),
 ('10000000-0000-4000-8000-000000017302','QT B','00000000-0000-4000-8000-000000017302');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000017301','00000000-0000-4000-8000-000000017301'),
 ('10000000-0000-4000-8000-000000017302','00000000-0000-4000-8000-000000017302');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000017301','10000000-0000-4000-8000-000000017301','Ada',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000017301','10000000-0000-4000-8000-000000017301','00000000-0000-4000-8000-000000017303','20000000-0000-4000-8000-000000017301');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('10000000-0000-4000-8000-000000017301','pro','test',now()+interval '1 day');

create function pg_temp.as_parent() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017301","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017301","role":"parent"}}',true);
$$;
create function pg_temp.as_other() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017302","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017302","role":"parent"}}',true);
$$;
create function pg_temp.as_device() returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000017303","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000017301","role":"device","child_id":"20000000-0000-4000-8000-000000017301"}}',true);
$$;
create function pg_temp.q(t text, payload jsonb, key jsonb, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('grade',3,'subject','Fen','topic','Canlılar','difficulty','orta','stem','Aşağıdaki ifadeleri değerlendir.',
  'interaction_type',t,'schema_version',1,'payload',payload,'answer_key',key) || extra;
$$;

set local role authenticated;
select pg_temp.as_parent();

reset role;
update public.app_settings set value='true' where key='question_groups.enabled';
set local role authenticated;
select pg_temp.as_parent();

create function pg_temp.make_group(group_id uuid) returns jsonb language sql as $$
 select public.save_question_source_group(group_id,'{"title":"Canlılar","body":"Aşağıdaki ortak metni okuyarak canlıları karşılaştır.","grade":3,"subject":"Fen"}',
 jsonb_build_array(pg_temp.q('true_false',
 '{"statements":[{"id":"s1","text":"Kedi bir memelidir."},{"id":"s2","text":"Balıklar akciğerle solur."},{"id":"s3","text":"Bitkiler fotosentez yapar."}]}',
 '{"answers":{"s1":true,"s2":false,"s3":true}}','{"solution":"İfadeleri sırayla kontrol et.","points":2}'),
 '{"stem":"Kediyi hangi gruba alırsın?","topic":"Canlılar","kind":"multiple_choice","difficulty":"orta",
 "choices":[{"key":"A","text":"Memeli"},{"key":"B","text":"Kuş"},{"key":"C","text":"Balık"},{"key":"D","text":"Sürüngen"}],
 "correct_key":"A","solution":"Kedi bir memelidir."}'::jsonb))
$$;
select pg_temp.make_group('50000000-0000-4000-8000-000000017311');
select pg_temp.make_group('50000000-0000-4000-8000-000000017312');
create function pg_temp.save_draft(draft_id uuid,group_id uuid,source text) returns jsonb language sql as $$
 select public.save_prova_draft(gen_random_uuid(),draft_id,0,
 '{"childId":"20000000-0000-4000-8000-000000017301","grade":3,"title":"Practice","purpose":"practice","format":"practice",
 "subjects":["Fen"],"topics":[],"target":2,"minutes":null,"difficulty":"orta","kind":"mixed","note":"","step":2}'::jsonb
 ||jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('kind','group','id',group_id,'source',source))))
$$;
select pg_temp.save_draft('60000000-0000-4000-8000-000000017311','50000000-0000-4000-8000-000000017311','manual');
select pg_temp.save_draft('60000000-0000-4000-8000-000000017312','50000000-0000-4000-8000-000000017312','ai');
reset role;
-- Group members are immutable after linking. This synthetic AI fixture is populated
-- as AI by the trusted test owner, independently of the parent RPC.
set constraints all immediate;
alter table public.question_bank disable trigger question_group_content_guard;
update public.question_bank q set provenance='{"generator":"ai","content_review":{"status":"needs_review","detector":"test","flags":[{"code":"person_name","names":["Elif"],"fields":["stem"],"suggestion":"Check"}]}}'
where exists(select 1 from public.question_source_members m where m.question_id=q.id and m.group_id='50000000-0000-4000-8000-000000017312');
alter table public.question_bank enable trigger question_group_content_guard;
set constraints all deferred;
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status)
select '70000000-0000-4000-8000-000000017311','10000000-0000-4000-8000-000000017301','20000000-0000-4000-8000-000000017301',
 'Assigned','Fen',3,array_agg(question_id order by position),'assigned'
from public.question_source_members where group_id='50000000-0000-4000-8000-000000017311';
create function pg_temp.changes(gid uuid) returns jsonb language sql as $$
 select jsonb_build_object('title','Yeni kaynak','body','Bu yeni ortak metne göre soruları yanıtla.',
 'prompts',jsonb_object_agg(question_id,'Yeni yönerge '||position))
 from public.question_source_members where group_id=gid
$$;
create function pg_temp.revise(req uuid, v int, changes jsonb) returns jsonb language sql as $$
 select public.revise_question_source_group(req,'50000000-0000-4000-8000-000000017311','60000000-0000-4000-8000-000000017311',v,changes)
$$;
create temp table group_input as select pg_temp.changes('50000000-0000-4000-8000-000000017311') manual,
 pg_temp.changes('50000000-0000-4000-8000-000000017312') ai;
grant select on group_input to authenticated;
set local role authenticated;
select pg_temp.as_other();
select throws_ok($$select pg_temp.revise(gen_random_uuid(),1,(select manual from group_input))$$,'P0001','prova_draft_not_found','cross-family caller rejected');
select pg_temp.as_device();
select throws_ok($$select pg_temp.revise(gen_random_uuid(),1,(select manual from group_input))$$,'42501','forbidden','child rejected');
select pg_temp.as_parent();
select throws_ok($$select pg_temp.revise(gen_random_uuid(),2,(select manual from group_input))$$,'P0001','prova_draft_changed','stale draft rejected');
select throws_ok($$select pg_temp.revise('50000000-0000-4000-8000-000000017399',1,
 (select manual||jsonb_build_object('prompts',(manual->'prompts')||'{"extra":"Extra prompt"}') from group_input))$$,
 'P0001','question_group_mismatch','unexpected member rolls back the complete transaction');
select is((select count(*) from public.question_source_groups where id='50000000-0000-4000-8000-000000017399'),0::bigint,'no partial group persisted');
select is(pg_temp.revise('50000000-0000-4000-8000-000000017321',1,(select manual from group_input))->>'version','2','parent group revised');
select is(pg_temp.revise('50000000-0000-4000-8000-000000017321',1,(select manual from group_input))->>'version','2','retry returns same receipt');
select throws_ok($$select pg_temp.revise('50000000-0000-4000-8000-000000017321',1,
 (select manual||'{"title":"Changed retry"}' from group_input))$$,'P0001','request_conflict','request cannot be reused for different content');
select is(public.get_prova_drafts('60000000-0000-4000-8000-000000017311')#>>'{0,content,blocks,0,id}',
 '50000000-0000-4000-8000-000000017321','open draft points to new group');
select is(public.revise_question_source_group('50000000-0000-4000-8000-000000017322','50000000-0000-4000-8000-000000017312',
 '60000000-0000-4000-8000-000000017312',1,(select ai from group_input))->>'version','2','AI group revised');
select lives_ok('set constraints all immediate','deferred keys and new hashes validate');
reset role;
select is((select question_ids from public.exams where id='70000000-0000-4000-8000-000000017311'),
 (select array_agg(question_id order by position) from public.question_source_members where group_id='50000000-0000-4000-8000-000000017311'),'assigned exam retains original members');
select is((select count(*) from public.question_source_members n join public.question_source_members o on o.position=n.position
 join public.question_answer_keys nk on nk.question_id=n.question_id join public.question_answer_keys ok on ok.question_id=o.question_id
 where n.group_id='50000000-0000-4000-8000-000000017321' and o.group_id='50000000-0000-4000-8000-000000017311'
 and nk.key=ok.key and nk.points=ok.points and nk.policy=ok.policy and nk.content_hash<>ok.content_hash),1::bigint,'structured answer and points copied with fresh hash');
select is((select q.correct_key from public.question_bank q join public.question_source_members m on m.question_id=q.id
 where m.group_id='50000000-0000-4000-8000-000000017321' and m.position=2),'A','legacy choice key copied');
select is((select count(*) from public.question_bank q join public.question_source_members m on m.question_id=q.id
 where m.group_id='50000000-0000-4000-8000-000000017322' and q.provenance->>'generator'='ai_edited'
 and q.provenance#>>'{content_review,status}'='needs_review'),2::bigint,'AI revision preserves warning and lineage');
set local role authenticated;
select pg_temp.as_device();
select is((select count(*) from public.get_attempt_questions_v2('70000000-0000-4000-8000-000000017311',array['true_false','multiple_choice'])
 where stem not like '%Yeni yönerge%'),2::bigint,'learner still sees both original prompts');
select is(jsonb_array_length(public.get_question_answer_keys(array(select question_id from public.question_source_members where group_id='50000000-0000-4000-8000-000000017321'))),0,'child cannot read revised keys');
select * from finish();
rollback;
