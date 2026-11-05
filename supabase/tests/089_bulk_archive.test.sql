begin;
select no_plan();
-- Two families, a co-parent, a paired device, an archived profile. All data synthetic.
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000008901','bulk-parent@example.invalid'),('00000000-0000-4000-8000-000000008902','bulk-partner@example.invalid'),('00000000-0000-4000-8000-000000008903','bulk-other@example.invalid'),('00000000-0000-4000-8000-000000008904','bulk-device@example.invalid');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000008901','Synthetic','00000000-0000-4000-8000-000000008901'),('10000000-0000-4000-8000-000000008903','Other','00000000-0000-4000-8000-000000008903');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000008901','00000000-0000-4000-8000-000000008901'),('10000000-0000-4000-8000-000000008901','00000000-0000-4000-8000-000000008902'),('10000000-0000-4000-8000-000000008903','00000000-0000-4000-8000-000000008903');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000008901','10000000-0000-4000-8000-000000008901','Ece',5),('20000000-0000-4000-8000-000000008905','10000000-0000-4000-8000-000000008901','Paused',7),('20000000-0000-4000-8000-000000008903','10000000-0000-4000-8000-000000008903','Other',5);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values('60000000-0000-4000-8000-000000008904','10000000-0000-4000-8000-000000008901','00000000-0000-4000-8000-000000008904','20000000-0000-4000-8000-000000008901');
create function pg_temp.fam() returns uuid language sql as $$select '10000000-0000-4000-8000-000000008901'::uuid$$;
create function pg_temp.ch() returns uuid language sql as $$select '20000000-0000-4000-8000-000000008901'::uuid$$;
create function pg_temp.paused() returns uuid language sql as $$select '20000000-0000-4000-8000-000000008905'::uuid$$;
create function pg_temp.today() returns date language sql as $$select (now() at time zone (select timezone from public.families where id=pg_temp.fam()))::date$$;
create function pg_temp.actor(id text,role_name text default 'parent') returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',jsonb_build_object('family_id',case when id like '%8903' then '10000000-0000-4000-8000-000000008903' else '10000000-0000-4000-8000-000000008901' end,'role',role_name,'device_id',case when role_name='device' then '60000000-0000-4000-8000-000000008904' else null end,'child_id',case when role_name='device' then pg_temp.ch() else null end))::text,true)$$;
create function pg_temp.item(t text,id text,rev int default null) returns jsonb language sql as $$select jsonb_strip_nulls(jsonb_build_object('type',t,'id',id,'revision',rev))$$;
create function pg_temp.outcome(r jsonb,t text,id text) returns jsonb language sql as $$select i from jsonb_array_elements(r->'items') i where i->>'type'=t and i->'key'->>'id'=id limit 1$$;
-- Rewards: plain, with active goal, with pending request, other family's.
insert into public.family_rewards(id,family_id,title,icon,cost_stars) values
 ('30000000-0000-4000-8000-000000008901',pg_temp.fam(),'Sinema','reward-movie-night',20),
 ('30000000-0000-4000-8000-000000008902',pg_temp.fam(),'Hedefli','reward-book',30),
 ('30000000-0000-4000-8000-000000008903',pg_temp.fam(),'Bekleyen','reward-book',10),
 ('30000000-0000-4000-8000-000000008909','10000000-0000-4000-8000-000000008903','Yabancı','reward-book',10);
insert into public.child_goals(family_id,child_id,reward_id) values(pg_temp.fam(),pg_temp.ch(),'30000000-0000-4000-8000-000000008902');
insert into public.star_events(family_id,child_id,delta,reason) values(pg_temp.fam(),pg_temp.ch(),100,'adjust');
insert into public.reward_requests(family_id,child_id,reward_id,cost_snapshot,idempotency_key) values(pg_temp.fam(),pg_temp.ch(),'30000000-0000-4000-8000-000000008903',10,'40000000-0000-4000-8000-000000008901');
-- Routines: plain, with work awaiting review, and one of a profile that will be archived.
insert into public.task_templates(id,family_id,child_id,title,stars) values
 ('31000000-0000-4000-8000-000000008901',pg_temp.fam(),pg_temp.ch(),'Diş fırçala',2),
 ('31000000-0000-4000-8000-000000008902',pg_temp.fam(),pg_temp.ch(),'Ödev',3),
 ('31000000-0000-4000-8000-000000008903',pg_temp.fam(),pg_temp.paused(),'Duraklatılmış profil',1);
insert into public.task_completions(family_id,child_id,template_id,due_date,client_id) values(pg_temp.fam(),pg_temp.ch(),'31000000-0000-4000-8000-000000008902',pg_temp.today(),'41000000-0000-4000-8000-000000008901');
-- Notes: own, co-parent's shared, own already archived.
insert into public.notes(id,family_id,child_id,author_user_id,title,body,visibility) values
 ('32000000-0000-4000-8000-000000008901',pg_temp.fam(),pg_temp.ch(),'00000000-0000-4000-8000-000000008901','Kendi','Özel gözlem','family'),
 ('32000000-0000-4000-8000-000000008902',pg_temp.fam(),pg_temp.ch(),'00000000-0000-4000-8000-000000008902','Eşin','Paylaşılan not','family'),
 ('32000000-0000-4000-8000-000000008903',pg_temp.fam(),null,'00000000-0000-4000-8000-000000008901','Eski','Arşivde','private');
update public.notes set archived_at=now() where id='32000000-0000-4000-8000-000000008903';
-- Prova drafts: open, assigned with answers, submitted without answers, other family's.
insert into public.exams(id,family_id,child_id,title,subject,grade,status) values('33000000-0000-4000-8000-000000008911',pg_temp.fam(),pg_temp.ch(),'Atanmış','Fen',5,'assigned');
insert into public.exam_attempts(family_id,exam_id,child_id) values(pg_temp.fam(),'33000000-0000-4000-8000-000000008911',pg_temp.ch());
insert into public.prova_drafts(id,family_id,created_by,content,exam_id,submitted_at) values
 ('33000000-0000-4000-8000-000000008901',pg_temp.fam(),'00000000-0000-4000-8000-000000008901',jsonb_build_object('childId',pg_temp.ch(),'title','Açık taslak'),null,null),
 ('33000000-0000-4000-8000-000000008902',pg_temp.fam(),'00000000-0000-4000-8000-000000008901',jsonb_build_object('childId',pg_temp.ch(),'title','Cevaplı'),'33000000-0000-4000-8000-000000008911',now()),
 ('33000000-0000-4000-8000-000000008903',pg_temp.fam(),'00000000-0000-4000-8000-000000008901',jsonb_build_object('childId',pg_temp.ch(),'title','Gönderilmiş'),null,now()),
 ('33000000-0000-4000-8000-000000008909','10000000-0000-4000-8000-000000008903','00000000-0000-4000-8000-000000008903',jsonb_build_object('childId','20000000-0000-4000-8000-000000008903','title','Yabancı'),null,null);
-- Learning plan items: open and already archived.
insert into gina.learning_plan(id,child_id,revision,content) values
 ('34000000-0000-4000-8000-000000008901',pg_temp.ch(),1,jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','','planned_on',pg_temp.today()::text,'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',false)),
 ('34000000-0000-4000-8000-000000008902',pg_temp.ch(),2,jsonb_build_object('kind','study','title','Eski','subject','Fen','topic','','planned_on',(pg_temp.today()-20)::text,'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',true));
-- Calendar: one-off, weekly series, timetable-derived lesson.
insert into public.events(id,family_id,child_id,type,title,starts_at,rrule,timetable_entry_key) values
 ('35000000-0000-4000-8000-000000008901',pg_temp.fam(),pg_temp.ch(),'activity','Tek seferlik',pg_temp.today()::timestamp at time zone 'Europe/Istanbul'+interval '15 hours',null,null),
 ('35000000-0000-4000-8000-000000008902',pg_temp.fam(),pg_temp.ch(),'activity','Haftalık kurs',(pg_temp.today()-14)::timestamp at time zone 'Europe/Istanbul'+interval '16 hours','FREQ=WEEKLY',null),
 ('35000000-0000-4000-8000-000000008903',pg_temp.fam(),pg_temp.ch(),'school','Matematik',pg_temp.today()::timestamp at time zone 'Europe/Istanbul'+interval '9 hours','FREQ=WEEKLY','mon-1');
-- School bags: today with ticks, yesterday (read-only), tomorrow without ticks.
insert into gina.school_bags(child_id,day,revision,program_revision,lessons_snapshot,items) values
 (pg_temp.ch(),pg_temp.today(),1,0,'[]',jsonb_build_array(jsonb_build_object('id','36000000-0000-4000-8000-000000008901','label','Defter','checked',true),jsonb_build_object('id','36000000-0000-4000-8000-000000008902','label','Kalem','checked',false))),
 (pg_temp.ch(),pg_temp.today()-1,1,0,'[]',jsonb_build_array(jsonb_build_object('id','36000000-0000-4000-8000-000000008903','label','Kitap','checked',true))),
 (pg_temp.ch(),pg_temp.today()+1,1,0,'[]',jsonb_build_array(jsonb_build_object('id','36000000-0000-4000-8000-000000008904','label','Beden','checked',false)));

-- Owner-privileged read views: the test inspects private ledgers while acting as a parent.
create view pg_temp.learning_plan as select * from gina.learning_plan;grant select on pg_temp.learning_plan to authenticated;
create view pg_temp.school_bags as select * from gina.school_bags;grant select on pg_temp.school_bags to authenticated;
create view pg_temp.reward_changes as select * from gina.reward_changes;grant select on pg_temp.reward_changes to authenticated;
create view pg_temp.task_routine_changes as select * from gina.task_routine_changes;grant select on pg_temp.task_routine_changes to authenticated;
create view pg_temp.note_changes as select * from gina.note_changes;grant select on pg_temp.note_changes to authenticated;
create view pg_temp.bulk_archive_items as select * from gina.bulk_archive_items;grant select on pg_temp.bulk_archive_items to authenticated;
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000008901');
select lives_ok($$select public.set_child_archived(gen_random_uuid(),pg_temp.paused(),0,true)$$,'second profile archived through the existing action');

-- Preview -----------------------------------------------------------------------------
create temp table preview as select public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('reward','task_routine','note','prova_draft','learning_plan','event'))) p;
select is((select (p->'summary'->>'total')::int from preview),13,'preview lists every family record of the chosen types once');
select is((select count(*)::int from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id' like '%8909'),0,'other family records are never listed');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='30000000-0000-4000-8000-000000008902'),'reward_has_goals','active goal blocks reward');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='30000000-0000-4000-8000-000000008903'),'reward_pending_request','pending request blocks reward');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='31000000-0000-4000-8000-000000008902'),'task_pending_review','work awaiting review blocks routine');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='31000000-0000-4000-8000-000000008903'),'child_archived','archived profile blocks routine');
select is((select count(*)::int from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='32000000-0000-4000-8000-000000008902'),0,'co-parent note is not a candidate');
select is((select count(*)::int from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='32000000-0000-4000-8000-000000008903'),0,'already archived note is not listed among active ones');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='33000000-0000-4000-8000-000000008902'),'prova_has_answers','answers block draft');
select is((select i->>'blocked' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='33000000-0000-4000-8000-000000008903'),'prova_draft_assigned','submitted draft blocked');
select is((select count(*)::int from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='35000000-0000-4000-8000-000000008903'),0,'timetable lesson not listed');
select is((select i->>'scope' from preview,jsonb_array_elements(p->'items') i where i->'key'->>'id'='35000000-0000-4000-8000-000000008902'),'series','a series without a day is offered whole');
select is((select (p->'summary'->>'archivable')::int from preview),7,'archivable count');
select is((select p->'summary'->'blocked_reasons'->>'reward_has_goals' from preview),'1','blocked reasons are summarised');
select is((public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('event'),'from',pg_temp.today(),'to',pg_temp.today(),'event_scope','occurrence'))->'items'->0->'key'->>'occurrence_date'),pg_temp.today()::text,'single day scope targets one occurrence of the series');
select is((select count(*)::int from jsonb_array_elements(public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('event'),'from',pg_temp.today()-7,'to',pg_temp.today()-1))->'items') i where i->>'scope'='single'),0,'date range excludes one-off outside range while the running series stays offered whole');
select is(jsonb_array_length(public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('school_bag'),'child_id',pg_temp.ch(),'from',pg_temp.today()-1,'to',pg_temp.today()+1,'bag_mode','reset_checks'))->'items'),3,'bag preview lists each day');
select is((select i->>'blocked' from jsonb_array_elements(public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('school_bag'),'child_id',pg_temp.ch(),'from',pg_temp.today()-1,'to',pg_temp.today()+1))->'items') i where i->>'day'=(pg_temp.today()-1)::text),'bag_day_past','yesterday bag cannot change');
select is((select i->>'blocked' from jsonb_array_elements(public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('school_bag'),'child_id',pg_temp.ch(),'from',pg_temp.today()-1,'to',pg_temp.today()+1))->'items') i where i->>'day'=(pg_temp.today()+1)::text),'nothing_to_change','reset without ticks changes nothing');
select is((select i->>'blocked' from jsonb_array_elements(public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('school_bag'),'child_id',pg_temp.ch(),'from',pg_temp.today()+1,'to',pg_temp.today()+1,'bag_mode','clear_day'))->'items') i),null,'clear day is offered even without ticks');
select throws_ok($$select public.bulk_archive_preview('{"types":["reward"],"child_id":"20000000-0000-4000-8000-000000008903"}')$$,'42501','forbidden','foreign child filter rejected');
select throws_ok($$select public.bulk_archive_preview('{"types":["school_bag"]}')$$,'P0001','scope_invalid','bag scope requires child and day range');
select throws_ok($$select public.bulk_archive_preview('{"types":["event"],"event_scope":"occurrence"}')$$,'P0001','scope_invalid','occurrence scope requires one day');
select throws_ok($$select public.bulk_archive_preview('{"types":[],"foo":1}')$$,'P0001','scope_invalid','unknown scope key rejected');

-- Apply: partial success, per-record reasons ------------------------------------------------
create function pg_temp.batch() returns jsonb language sql as $$select jsonb_build_array(
 pg_temp.item('reward','30000000-0000-4000-8000-000000008901',1),
 pg_temp.item('reward','30000000-0000-4000-8000-000000008902',1),
 pg_temp.item('reward','30000000-0000-4000-8000-000000008903',1),
 pg_temp.item('reward','30000000-0000-4000-8000-000000008909',1),
 pg_temp.item('task_routine','31000000-0000-4000-8000-000000008901',1),
 pg_temp.item('task_routine','31000000-0000-4000-8000-000000008902',1),
 pg_temp.item('task_routine','31000000-0000-4000-8000-000000008903',1),
 pg_temp.item('note','32000000-0000-4000-8000-000000008901',1),
 pg_temp.item('note','32000000-0000-4000-8000-000000008902',1),
 pg_temp.item('note','32000000-0000-4000-8000-000000008903',2),
 pg_temp.item('prova_draft','33000000-0000-4000-8000-000000008901',1),
 pg_temp.item('prova_draft','33000000-0000-4000-8000-000000008902',1),
 pg_temp.item('prova_draft','33000000-0000-4000-8000-000000008909',1),
 pg_temp.item('learning_plan','34000000-0000-4000-8000-000000008901',1),
 pg_temp.item('learning_plan','34000000-0000-4000-8000-000000008902',2),
 pg_temp.item('event','35000000-0000-4000-8000-000000008901',1),
 jsonb_build_object('type','event','id','35000000-0000-4000-8000-000000008902','revision',1,'occurrence_date',pg_temp.today()),
 pg_temp.item('event','35000000-0000-4000-8000-000000008903',1),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today(),'mode','reset_checks','revision',1,'program_revision',0),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today()-1,'mode','reset_checks','revision',1),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today()+1,'mode','clear_day','revision',1),
 jsonb_build_object('type','exam','id','33000000-0000-4000-8000-000000008911')
)$$;
create temp table applied as select public.bulk_archive_apply(pg_temp.batch(),'50000000-0000-4000-8000-000000008901') r;
select is((select (r->'summary'->>'ok')::int from applied),9,'nine records archived');
select is((select (r->'summary'->>'skipped')::int from applied),13,'thirteen skipped with reasons');
select is((select pg_temp.outcome(r,'reward','30000000-0000-4000-8000-000000008901')->>'status' from applied),'ok','plain reward archived');
select is((select pg_temp.outcome(r,'reward','30000000-0000-4000-8000-000000008902')->>'reason' from applied),'reward_has_goals','goal reward skipped');
select is((select pg_temp.outcome(r,'reward','30000000-0000-4000-8000-000000008903')->>'reason' from applied),'reward_pending_request','pending reward skipped');
select is((select pg_temp.outcome(r,'reward','30000000-0000-4000-8000-000000008909')->>'reason' from applied),'not_found','foreign reward reported as not found');
select is((select pg_temp.outcome(r,'task_routine','31000000-0000-4000-8000-000000008902')->>'reason' from applied),'task_pending_review','pending review routine skipped');
select is((select pg_temp.outcome(r,'task_routine','31000000-0000-4000-8000-000000008903')->>'reason' from applied),'child_archived','archived profile routine skipped');
select is((select pg_temp.outcome(r,'note','32000000-0000-4000-8000-000000008902')->>'reason' from applied),'note_not_author','co-parent note skipped');
select is((select pg_temp.outcome(r,'note','32000000-0000-4000-8000-000000008903')->>'reason' from applied),'already_archived','archived note skipped');
select is((select pg_temp.outcome(r,'prova_draft','33000000-0000-4000-8000-000000008902')->>'reason' from applied),'prova_has_answers','answered draft skipped');
select is((select pg_temp.outcome(r,'prova_draft','33000000-0000-4000-8000-000000008909')->>'reason' from applied),'not_found','foreign draft not found');
select is((select pg_temp.outcome(r,'learning_plan','34000000-0000-4000-8000-000000008902')->>'reason' from applied),'already_archived','archived plan item skipped');
select is((select pg_temp.outcome(r,'event','35000000-0000-4000-8000-000000008903')->>'reason' from applied),'event_is_timetable','timetable lesson skipped');
select is((select pg_temp.outcome(r,'event','35000000-0000-4000-8000-000000008902')->>'status' from applied),'ok','series occurrence hidden');
select is((select i->>'reason' from applied,jsonb_array_elements(r->'items') i where i->>'type'='school_bag' and i->'key'->>'day'=(pg_temp.today()-1)::text),'bag_day_past','past bag skipped');
select is((select i->>'status' from applied,jsonb_array_elements(r->'items') i where i->>'type'='school_bag' and i->'key'->>'day'=pg_temp.today()::text),'ok','today bag ticks reset');
select is((select i->>'status' from applied,jsonb_array_elements(r->'items') i where i->>'type'='school_bag' and i->'key'->>'day'=(pg_temp.today()+1)::text),'ok','tomorrow bag cleared');
select is((select i->>'reason' from applied,jsonb_array_elements(r->'items') i where i->>'type'='exam'),'type_invalid','unknown type skipped, never applied');
-- Effects
select is((select archived_at is not null and not active from public.family_rewards where id='30000000-0000-4000-8000-000000008901'),true,'reward archived and inactive');
select is((select archived_at from public.family_rewards where id='30000000-0000-4000-8000-000000008902'),null,'goal reward untouched');
select is((select archived_at is not null from public.task_templates where id='31000000-0000-4000-8000-000000008901'),true,'routine archived');
select is((select count(*)::int from public.task_completions where template_id='31000000-0000-4000-8000-000000008902' and status='done'),1,'pending submission untouched');
select is((select archived_at is not null from public.notes where id='32000000-0000-4000-8000-000000008901'),true,'own note archived');
select is((select discarded_at is not null from public.prova_drafts where id='33000000-0000-4000-8000-000000008901'),true,'draft discarded');
select is((select count(*)::int from public.exam_attempts),1,'answers preserved');
select is((select (content->>'archived')::boolean from pg_temp.learning_plan where id='34000000-0000-4000-8000-000000008901'),true,'plan item archived');
-- 20261106200000: veli okuması arşivli etkinliği artık görmez; arşiv sonucu 106'da sahip rolüyle doğrulanır.
select is((select count(*)::int from public.events where id='35000000-0000-4000-8000-000000008901'),0,'one-off archived (hidden from parent read)');
select is((select cancelled from public.event_exceptions where event_id='35000000-0000-4000-8000-000000008902' and occurrence_date=pg_temp.today()),true,'occurrence hidden through exception');
select is((select archived_at from public.events where id='35000000-0000-4000-8000-000000008902'),null,'series itself stays');
select is((select count(*)::int from jsonb_array_elements((select items from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today())) i where (i->>'checked')::boolean),0,'ticks reset');
select is((select jsonb_array_length(items) from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today()),2,'reset keeps the list');
select is((select items from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today()+1),'[]','clear day empties the list');
select is((select items->0->>'checked' from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today()-1),'true','past bag unchanged');
-- History origin
select is((select origin from pg_temp.reward_changes where reward_id='30000000-0000-4000-8000-000000008901' and action='archive'),'bulk','reward history records bulk origin');
select is((select origin from pg_temp.task_routine_changes where template_id='31000000-0000-4000-8000-000000008901' and action='archive'),'bulk','routine history records bulk origin');
select is((select origin from pg_temp.note_changes where note_id='32000000-0000-4000-8000-000000008901' and action='archive'),'bulk','note history records bulk origin');
select is((select count(*)::int from pg_temp.bulk_archive_items where run_id='50000000-0000-4000-8000-000000008901'),22,'every item has a stored outcome');
select is(public.reward_history('30000000-0000-4000-8000-000000008901')->'rows'->0->>'action','archive','existing history RPC shows bulk archive');
-- Idempotency
select is(public.bulk_archive_apply(pg_temp.batch(),'50000000-0000-4000-8000-000000008901'),(select r from applied),'same key with same payload replays stored result');
select is((select revision from public.family_rewards where id='30000000-0000-4000-8000-000000008901'),2,'replay does not touch the record');
select throws_ok($$select public.bulk_archive_apply('[{"type":"reward","id":"30000000-0000-4000-8000-000000008902","revision":1}]','50000000-0000-4000-8000-000000008901')$$,'P0001','request_conflict','same key with different payload rejected');
select is(public.bulk_archive_apply(jsonb_build_array(pg_temp.item('reward','30000000-0000-4000-8000-000000008901',2)),gen_random_uuid())->'items'->0->>'reason','already_archived','new key: archived record is skipped');
select is(public.bulk_archive_apply(jsonb_build_array(pg_temp.item('task_routine','31000000-0000-4000-8000-000000008902',1)),gen_random_uuid())->'items'->0->>'reason','task_pending_review','blocked record stays blocked');
select is(public.bulk_archive_apply(jsonb_build_array(pg_temp.item('event','35000000-0000-4000-8000-000000008902',7)),gen_random_uuid())->'items'->0->>'reason','changed','stale calendar revision skipped');
select throws_ok($$select public.bulk_archive_apply('[]',gen_random_uuid())$$,'P0001','bulk_invalid','empty list rejected');
-- Authority
select pg_temp.actor('00000000-0000-4000-8000-000000008902');
select is(public.bulk_archive_apply(jsonb_build_array(pg_temp.item('note','32000000-0000-4000-8000-000000008901',2)),gen_random_uuid())->'items'->0->>'reason','note_not_author','co-parent cannot restore or archive author note');
select throws_ok($$select public.bulk_archive_apply('[{"type":"reward","id":"30000000-0000-4000-8000-000000008903","revision":1}]','50000000-0000-4000-8000-000000008901')$$,'P0001','request_conflict','co-parent cannot replay another actor key');
select pg_temp.actor('00000000-0000-4000-8000-000000008903');
select is(public.bulk_archive_apply(jsonb_build_array(pg_temp.item('reward','30000000-0000-4000-8000-000000008903',1),pg_temp.item('task_routine','31000000-0000-4000-8000-000000008902',1)),gen_random_uuid())->'summary'->>'ok','0','other family archives nothing');
select is((select archived_at from public.family_rewards where id='30000000-0000-4000-8000-000000008903'),null,'other family left the reward untouched');
select pg_temp.actor('00000000-0000-4000-8000-000000008904','device');
select throws_ok($$select public.bulk_archive_preview('{"types":["reward"]}')$$,'42501','forbidden','device cannot preview');
select throws_ok($$select public.bulk_archive_apply('[{"type":"reward","id":"30000000-0000-4000-8000-000000008903","revision":1}]',gen_random_uuid())$$,'42501','forbidden','device cannot archive');
select is((select count(*)::int from public.events),2,'device sees the live series and lesson, not the archived one-off');

-- Restore -----------------------------------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000008901');
create function pg_temp.restore_batch() returns jsonb language sql as $$select jsonb_build_array(
 pg_temp.item('reward','30000000-0000-4000-8000-000000008901',2),
 pg_temp.item('reward','30000000-0000-4000-8000-000000008902',1),
 pg_temp.item('task_routine','31000000-0000-4000-8000-000000008901',2),
 pg_temp.item('note','32000000-0000-4000-8000-000000008901',2),
 pg_temp.item('prova_draft','33000000-0000-4000-8000-000000008901',2),
 pg_temp.item('learning_plan','34000000-0000-4000-8000-000000008901',2),
 pg_temp.item('event','35000000-0000-4000-8000-000000008901',2),
 jsonb_build_object('type','event','id','35000000-0000-4000-8000-000000008902','occurrence_date',pg_temp.today()),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today()),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today()+1),
 jsonb_build_object('type','school_bag','child_id',pg_temp.ch(),'day',pg_temp.today()-1)
)$$;
create temp table restored as select public.bulk_restore_apply(pg_temp.restore_batch(),'50000000-0000-4000-8000-000000008902') r;
select is((select (r->'summary'->>'ok')::int from restored),9,'nine records restored');
select is((select pg_temp.outcome(r,'reward','30000000-0000-4000-8000-000000008902')->>'reason' from restored),'not_archived','live record is not restored');
select is((select i->>'reason' from restored,jsonb_array_elements(r->'items') i where i->>'type'='school_bag' and i->'key'->>'day'=(pg_temp.today()-1)::text),'not_archived','bag without bulk history not restored');
select is((select archived_at is null and not active from public.family_rewards where id='30000000-0000-4000-8000-000000008901'),true,'reward returns paused');
select is((select archived_at is null and not active from public.task_templates where id='31000000-0000-4000-8000-000000008901'),true,'routine returns paused');
select is((select archived_at is null and visibility='private' from public.notes where id='32000000-0000-4000-8000-000000008901'),true,'note returns private');
select is((select discarded_at from public.prova_drafts where id='33000000-0000-4000-8000-000000008901'),null,'draft returns');
select is((select (content->>'archived')::boolean from pg_temp.learning_plan where id='34000000-0000-4000-8000-000000008901'),false,'plan item returns');
select is((select archived_at from public.events where id='35000000-0000-4000-8000-000000008901'),null,'one-off returns');
select is((select count(*)::int from public.event_exceptions where event_id='35000000-0000-4000-8000-000000008902'),0,'occurrence returns');
select is((select items->0->>'checked' from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today()),'true','bag ticks restored from snapshot');
select is((select jsonb_array_length(items) from pg_temp.school_bags where child_id=pg_temp.ch() and day=pg_temp.today()+1),1,'cleared bag list restored');
select is((select origin from pg_temp.reward_changes where reward_id='30000000-0000-4000-8000-000000008901' and action='restore'),'bulk','restore history records bulk origin');
select is((select count(*)::int from pg_temp.reward_changes where reward_id='30000000-0000-4000-8000-000000008901'),3,'create, archive, restore: no extra history rows');
select is((select count(*)::int from public.exam_attempts),1,'answers still preserved');
select is((select count(*)::int from public.task_completions),1,'submissions still preserved');
select is(jsonb_array_length(public.bulk_archive_history()),6,'family sees every run, including the co-parent attempt');
select is((select count(*)::int from jsonb_array_elements(public.bulk_archive_history()) r where (r->>'mine')::boolean),5,'runs name whether this parent made them');
select is(public.bulk_restore_apply(pg_temp.restore_batch(),'50000000-0000-4000-8000-000000008902'),(select r from restored),'restore replay returns the stored result');
select throws_ok($$select public.bulk_restore_apply('[{"type":"reward","id":"30000000-0000-4000-8000-000000008901","revision":2}]','50000000-0000-4000-8000-000000008902')$$,'P0001','request_conflict','restore key cannot be reused with another payload');
reset role;
select ok(not has_function_privilege('anon','public.bulk_archive_apply(jsonb,uuid)','execute'),'anonymous bulk denied');
select ok(not has_function_privilege('service_role','public.bulk_archive_preview(jsonb)','execute'),'service role not granted');
select ok(not has_table_privilege('authenticated','gina.bulk_archive_items','select'),'bulk ledger private');
select * from finish();rollback;
