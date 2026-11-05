begin;
select no_plan();
update public.plans set prova_monthly_exams=null;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009601','history-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000009602','history-second-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000009603','history-other@example.invalid'),
 ('00000000-0000-4000-8000-000000009604','history-device@example.invalid'),
 ('00000000-0000-4000-8000-000000009605','history-sibling-device@example.invalid');
insert into public.families(id,name,timezone,created_by) values
 ('10000000-0000-4000-8000-000000009601','Synthetic','Europe/Istanbul','00000000-0000-4000-8000-000000009601'),
 ('10000000-0000-4000-8000-000000009602','Other','Europe/Istanbul','00000000-0000-4000-8000-000000009603');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000009601','00000000-0000-4000-8000-000000009601'),
 ('10000000-0000-4000-8000-000000009601','00000000-0000-4000-8000-000000009602'),
 ('10000000-0000-4000-8000-000000009602','00000000-0000-4000-8000-000000009603');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000009601','10000000-0000-4000-8000-000000009601','Synthetic',4),
 ('20000000-0000-4000-8000-000000009602','10000000-0000-4000-8000-000000009601','Sibling',6);
insert into public.devices(id,family_id,auth_user_id,active_child_id,name) values
 ('70000000-0000-4000-8000-000000009604','10000000-0000-4000-8000-000000009601','00000000-0000-4000-8000-000000009604','20000000-0000-4000-8000-000000009601','Tablet'),
 ('70000000-0000-4000-8000-000000009605','10000000-0000-4000-8000-000000009601','00000000-0000-4000-8000-000000009605','20000000-0000-4000-8000-000000009602','Sibling tablet');
create function pg_temp.fam() returns uuid language sql as $$select '10000000-0000-4000-8000-000000009601'::uuid$$;
create function pg_temp.ch() returns uuid language sql as $$select '20000000-0000-4000-8000-000000009601'::uuid$$;
create function pg_temp.r1() returns uuid language sql as $$select '30000000-0000-4000-8000-000000009601'::uuid$$;
create function pg_temp.r2() returns uuid language sql as $$select '30000000-0000-4000-8000-000000009602'::uuid$$;
create function pg_temp.r3() returns uuid language sql as $$select '30000000-0000-4000-8000-000000009603'::uuid$$;
create function pg_temp.p1() returns uuid language sql as $$select '60000000-0000-4000-8000-000000009601'::uuid$$;
-- Family-local today; the database clock may already be on another UTC day.
create function pg_temp.t() returns date language sql security definer as $$select gina.family_today(pg_temp.fam())$$;
create function pg_temp.d(text) returns text language sql as $$select to_char(pg_temp.t()+$1::int,'YYYY-MM-DD')$$;
create function pg_temp.dow(int) returns int language sql as $$select extract(isodow from pg_temp.t()+$1)::int$$;
create function pg_temp.plan(int) returns jsonb language sql as $$select public.plan_for_day(pg_temp.ch(),pg_temp.t()+$1)$$;
create function pg_temp.routine(int,uuid) returns jsonb language sql as $$select x from jsonb_array_elements(pg_temp.plan($1)->'routines') x where x->>'id'=$2::text$$;
create function pg_temp.value(stars int,days jsonb default '[1,2,3,4,5,6,7]') returns jsonb language sql as $$select jsonb_build_object('title','Birlikte kitap oku','icon','task-custom','stars',stars,'days_of_week',days,'time_of_day','evening','requires_approval',true)$$;
create function pg_temp.lessons(title text) returns jsonb language sql as $$select jsonb_build_array(jsonb_build_object('id','l1','day',pg_temp.dow(0),'title',title,'start','09:00','end','09:40'),jsonb_build_object('id','l2','day',pg_temp.dow(3),'title',title||' 2','start','10:00','end','10:40'))$$;
create function pg_temp.q(text) returns text language plpgsql security definer as $$declare r text;begin execute $1 into r;return r;end$$;
create function pg_temp.year() returns integer language sql as $$select extract(year from pg_temp.t())::int$$;
insert into public.task_templates(id,family_id,child_id,title,icon,stars,days_of_week,starts_on) values
 (pg_temp.r1(),pg_temp.fam(),pg_temp.ch(),'Kitap oku','read-book',2,'{1,2,3,4,5,6,7}',pg_temp.t()-30),
 (pg_temp.r2(),pg_temp.fam(),pg_temp.ch(),'Eski rutin','task-custom',1,'{1,2,3,4,5,6,7}',pg_temp.t()-30),
 (pg_temp.r3(),pg_temp.fam(),pg_temp.ch(),'Geçişte bilinen','task-custom',1,'{1,2,3,4,5,6,7}',pg_temp.t()-30);
-- Simulated legacy rows, exactly as the migration leaves them: r2 known since five days ago with no start day;
-- r3 has a change log whose first entry only shows the settings that were already there (known at migration).
update gina.task_routine_changes set effective_from=null,known_since=pg_temp.t()-5 where template_id=pg_temp.r2();
delete from gina.task_routine_changes where template_id=pg_temp.r3();

-- Timezone: the family day flips at local midnight, not UTC midnight.
select is(gina.local_day('Europe/Istanbul','2026-11-05T20:30:00Z'),'2026-11-05'::date,'23:30 local stays on the same day');
select is(gina.local_day('Europe/Istanbul','2026-11-05T21:30:00Z'),'2026-11-06'::date,'00:30 local is already the next day');
select is(gina.local_day('America/New_York','2026-11-05T21:30:00Z'),'2026-11-05'::date,'another family zone keeps its own day');
select is(gina.family_today(pg_temp.fam()),(now() at time zone 'Europe/Istanbul')::date,'family today follows families.timezone');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009601","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009601","role":"parent"}}',true);
-- Evidence from before any edit: one submission yesterday (pending), one approved with stars.
select lives_ok($$select public.complete_task(pg_temp.r1(),pg_temp.t()-1,'40000000-0000-4000-8000-000000009601',pg_temp.ch())$$,'yesterday submitted at 2 stars');
select lives_ok($$select public.complete_task(pg_temp.r1(),pg_temp.t()-2,'40000000-0000-4000-8000-000000009602',pg_temp.ch())$$,'day before submitted');
select lives_ok($$select public.review_task((select id from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()-2),true)$$,'older work approved');
select is((select sum(delta)::int from public.star_events where child_id=pg_temp.ch()),2,'two stars earned before any edit');
-- Legacy r3: build its log like the migration does (a save with the pre-history settings in before_value, then the migration row).
select lives_ok($$select public.change_task_routine(gen_random_uuid(),pg_temp.r3(),1,'save',jsonb_build_object('title','Geçişte bilinen, yeni','icon','task-custom','stars',3,'days_of_week','[1,2,3,4,5,6,7]'::jsonb,'time_of_day','any','requires_approval',true))$$,'legacy routine edited today');
reset role;
insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,created_at,effective_from,known_since)
select c.template_id,c.family_id,(c.before_value->>'revision')::int,'migration',null,c.before_value,null,c.created_at,null,null
from gina.task_routine_changes c where c.template_id=pg_temp.r3() and c.before_value is not null;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009601","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009601","role":"parent"}}',true);

-- Creation is dated from the routine's start day.
select is(pg_temp.q('select effective_from from gina.task_routine_changes where template_id='''||pg_temp.r1()||''' and revision=1'),pg_temp.d('-30'),'create version applies from starts_on');
select is(pg_temp.q('select known_since from gina.task_routine_changes where template_id='''||pg_temp.r1()||''' and revision=1'),pg_temp.d('0'),'create version known today');
select is(pg_temp.routine(-10,pg_temp.r1())->>'status','known','a day inside the known range is known');
select is(pg_temp.routine(-40,pg_temp.r1()),null,'before its start the routine is not part of the day');

-- Legacy: known since migration, unknown before.
select is(pg_temp.routine(-3,pg_temp.r2())->>'status','known','legacy version known from its known_since day');
select is(pg_temp.routine(-3,pg_temp.r2())->'effective_from','null'::jsonb,'legacy version has no start day');
select is(pg_temp.routine(-3,pg_temp.r2())->>'known_since',pg_temp.d('-5'),'legacy version carries known_since');
select is(pg_temp.routine(-8,pg_temp.r2())->>'status','unknown_before','a day before the first known version is flagged');
select is(pg_temp.routine(-8,pg_temp.r2())->>'unknown_before',pg_temp.d('-5'),'flag names the first known day');
select is(pg_temp.routine(-8,pg_temp.r2())->>'title','Eski rutin','flagged content is the oldest known version, not an invented one');
select is(pg_temp.routine(-2,pg_temp.r3())->>'status','unknown_before','settings known only at migration are flagged for earlier days');
select is(pg_temp.routine(-2,pg_temp.r3())->>'title','Geçişte bilinen','flagged day shows the pre-history settings');
select is(pg_temp.routine(-2,pg_temp.r3())->>'unknown_before',pg_temp.d('0'),'unknown until the first dated change');
select is(pg_temp.routine(0,pg_temp.r3())->>'title','Geçişte bilinen, yeni','today shows the dated change');

-- Immediate edit (old client signature, no effective day): applies today.
select is((public.change_task_routine('50000000-0000-4000-8000-000000009601',pg_temp.r1(),1,'save',pg_temp.value(5))->>'effective_from'),pg_temp.d('0'),'edit without a date applies today');
select is((select effective_from from public.task_templates where id=pg_temp.r1()),pg_temp.t(),'row remembers the current version start');
select is(pg_temp.routine(-1,pg_temp.r1())->>'stars','2','yesterday keeps the old settings');
select is(pg_temp.routine(-1,pg_temp.r1())->>'title','Kitap oku','yesterday keeps the old title');
select is(pg_temp.routine(0,pg_temp.r1())->>'stars','5','today uses the new settings');
select is(pg_temp.routine(0,pg_temp.r1())->>'revision','2','today resolves to revision 2');
select is(pg_temp.routine(0,pg_temp.r1())->>'effective_from',pg_temp.d('0'),'effective day returned');
select is(pg_temp.routine(-1,pg_temp.r1())->>'current_revision','2','past day still tells the current revision');

-- Effective day rules.
select throws_ok($$select public.change_task_routine(gen_random_uuid(),pg_temp.r1(),2,'save',pg_temp.value(6),pg_temp.t()-1)$$,'P0001','plan_effective_past','past effective day rejected: realized days do not change');
select throws_ok($$select public.change_task_routine(gen_random_uuid(),pg_temp.r1(),2,'save',pg_temp.value(6),pg_temp.t()+366)$$,'P0001','plan_effective_invalid','more than a year ahead rejected');
select throws_ok($$select public.change_task_routine(gen_random_uuid(),pg_temp.r1(),2,'pause','{}',pg_temp.t()+3)$$,'P0001','task_routine_invalid','pause cannot be scheduled');
select is((select revision from public.task_templates where id=pg_temp.r1()),2,'rejected attempts changed nothing');

-- Scheduled edit: from +7 only weekday of tomorrow, 9 stars.
select is((public.change_task_routine('50000000-0000-4000-8000-000000009602',pg_temp.r1(),2,'save',pg_temp.value(9,to_jsonb(array[pg_temp.dow(1)])),pg_temp.t()+7)->>'effective_from'),pg_temp.d('7'),'scheduled edit records its day');
select is((select stars::int from public.task_templates where id=pg_temp.r1()),9,'live row carries the scheduled settings (known boundary for direct readers)');
select is(pg_temp.routine(0,pg_temp.r1())->>'stars','5','today still resolves to the current version');
select is(pg_temp.routine(6,pg_temp.r1())->>'stars','5','the day before the schedule keeps current settings');
select is(pg_temp.routine(8,pg_temp.r1())->>'stars','9','a day in the scheduled range uses the scheduled settings');
select is(pg_temp.routine(8,pg_temp.r1())->>'status','known','scheduled version is known');
select is(pg_temp.routine(7,pg_temp.r1()),null,'scheduled weekdays decide which days list the routine');
-- Today's submission follows today's version even though the row already shows the scheduled one.
select lives_ok($$select public.complete_task(pg_temp.r1(),pg_temp.t(),'40000000-0000-4000-8000-000000009603',pg_temp.ch())$$,'today still accepts the routine on a day the scheduled version excludes');
select is((select task_snapshot->>'stars' from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()),'5','today''s submission freezes today''s stars, not the scheduled ones');
select is((select task_snapshot->>'origin' from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()),'submission','snapshot provenance unchanged');
-- Replay and conflicting replay.
select is((public.change_task_routine('50000000-0000-4000-8000-000000009602',pg_temp.r1(),2,'save',pg_temp.value(9,to_jsonb(array[pg_temp.dow(1)])),pg_temp.t()+7)->>'revision'),'3','same request replays the same result');
select throws_ok($$select public.change_task_routine('50000000-0000-4000-8000-000000009602',pg_temp.r1(),2,'save',pg_temp.value(9,to_jsonb(array[pg_temp.dow(1)])),pg_temp.t()+8)$$,'P0001','request_conflict','same request with another effective day rejected');
select is(pg_temp.q('select count(*) from gina.task_routine_changes where template_id='''||pg_temp.r1()||''''),'3','replay added no version');
-- A newer edit starting earlier supersedes the pending scheduled one.
select is((public.change_task_routine(gen_random_uuid(),pg_temp.r1(),3,'save',pg_temp.value(7))->>'revision'),'4','edit after a schedule');
select is(pg_temp.q('select superseded_by from gina.task_routine_changes where template_id='''||pg_temp.r1()||''' and revision=3'),'4','pending scheduled version marked superseded');
select is(pg_temp.routine(8,pg_temp.r1())->>'stars','7','superseded schedule no longer governs later days');
select is(pg_temp.routine(0,pg_temp.r1())->>'stars','7','today uses the latest immediate edit');
select is(pg_temp.routine(-1,pg_temp.r1())->>'stars','2','yesterday unchanged by all of this');
select is(public.task_routine_history(pg_temp.r1())->'rows'->1->>'superseded_by','4','history exposes superseded versions');
select is(public.task_routine_history(pg_temp.r1())->'rows'->1->>'effective_from',pg_temp.d('7'),'history exposes effective days');
select is(public.task_routine_history(pg_temp.r1())->'rows'->0->>'known_since',pg_temp.d('0'),'history exposes known_since');

-- Evidence is untouched by every edit above.
select is((select task_snapshot->>'stars' from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()-1),'2','pending submission keeps original stars');
select is((select task_snapshot->>'title' from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()-1),'Kitap oku','pending submission keeps original title');
select is((select sum(delta)::int from public.star_events where child_id=pg_temp.ch()),2,'earned stars unchanged');
select lives_ok($$select public.review_task((select id from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()-1),true)$$,'old pending work approved later');
select is((select delta from public.star_events e join public.task_completions c on c.id=e.completion_id where c.due_date=pg_temp.t()-1),2,'late approval pays the original stars');

-- Timetable: old client signature saves for today; the period boundary keeps the closed period''s snapshot.
select is((public.save_school_timetable_request('50000000-0000-4000-8000-000000009611',pg_temp.ch(),0,pg_temp.lessons('Matematik'),'{"start":"09:00","duration":40,"break":10}')->>'effective_from'),pg_temp.d('0'),'timetable save without a date applies today');
select is(pg_temp.plan(0)->'timetable'->>'status','known','today''s timetable known');
select is(jsonb_array_length(pg_temp.plan(0)->'timetable'->'day_lessons'),1,'today lists its own lessons');
select is(pg_temp.plan(0)->'timetable'->'day_lessons'->0->>'title','Matematik','lesson of the day');
select is(pg_temp.plan(-1)->'timetable'->>'status','unknown_before','before the first saved version the timetable is unknown');
select is(pg_temp.plan(-1)->'timetable'->>'unknown_before',pg_temp.d('0'),'unknown until the first save');
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),0,'initial',pg_temp.year()-1,4,'İlk Okul',make_date(pg_temp.year()-1,9,1),1,true)$$,'initial period');
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),1,'new_year',pg_temp.year(),5,'İlk Okul',pg_temp.t(),1,false)$$,'new year today, empty timetable');
select is(pg_temp.plan(0)->'period'->>'academic_year',pg_temp.year()::text,'boundary day belongs to the new period');
select is(pg_temp.plan(-1)->'period'->>'academic_year',(pg_temp.year()-1)::text,'day before belongs to the closed period');
select is(jsonb_array_length(pg_temp.plan(0)->'timetable'->'lessons'),0,'new period starts with the emptied timetable');
select is(pg_temp.plan(0)->'timetable'->>'revision','2','emptying is a dated version');
select is(pg_temp.plan(-1)->'timetable'->>'status','period_snapshot','a day in the closed period before any kept version uses the period snapshot');
select is(pg_temp.plan(-1)->'timetable'->>'source','period_snapshot','snapshot source named');
select is(jsonb_array_length(pg_temp.plan(-1)->'timetable'->'lessons'),2,'snapshot carries the closed period''s lessons');
select is(pg_temp.plan(-1)->'timetable'->>'unknown_before',pg_temp.d('0'),'snapshot is known as of the close day');
select is(pg_temp.plan(-1)->'timetable'->'settings'->>'duration','40','snapshot carries the bell schedule');
-- Scheduled timetable change: cells and bell schedule from +3.
select is((public.save_school_timetable_request('50000000-0000-4000-8000-000000009612',pg_temp.ch(),2,pg_temp.lessons('Türkçe'),'{"start":"08:30","duration":45,"break":15}',pg_temp.t()+3)->>'effective_from'),pg_temp.d('3'),'scheduled timetable save');
select is(jsonb_array_length(pg_temp.plan(0)->'timetable'->'lessons'),0,'today keeps the current timetable');
select is(pg_temp.plan(0)->'timetable'->'settings'->>'start','09:00','today keeps the current bell schedule');
select is(pg_temp.plan(3)->'timetable'->'day_lessons'->0->>'title','Türkçe 2','scheduled day shows the scheduled cells');
select is(pg_temp.plan(3)->'timetable'->'settings'->>'start','08:30','scheduled day shows the scheduled bell schedule');
select is(pg_temp.plan(30)->'timetable'->>'revision','3','far future resolves to the latest scheduled version');
select throws_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),3,pg_temp.lessons('Fen'),'{"start":"09:00","duration":40,"break":10}',pg_temp.t()-1)$$,'P0001','plan_effective_past','past timetable day rejected');
select throws_ok($$select public.save_school_timetable_request('50000000-0000-4000-8000-000000009612',pg_temp.ch(),2,pg_temp.lessons('Türkçe'),'{"start":"08:30","duration":45,"break":15}',pg_temp.t()+4)$$,'P0001','request_conflict','same timetable request with another day rejected');
select is(pg_temp.q('select count(*) from gina.school_timetable_versions where child_id='''||pg_temp.ch()||''''),'3','three timetable versions kept');

-- Learning plan: versions are dated; moving an item changes later days only.
select lives_ok($$select public.save_learning_plan(gen_random_uuid(),pg_temp.ch(),pg_temp.p1(),0,jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','','planned_on',pg_temp.d('-2'),'due_on',pg_temp.d('2'),'time',null,'steps','[]'::jsonb,'done',false,'archived',false,'source_id',null))$$,'plan item saved');
select is(jsonb_array_length(pg_temp.plan(0)->'plans'),1,'item spans today');
select is(pg_temp.plan(0)->'plans'->0->>'status','known','item version known today');
select is(pg_temp.plan(-1)->'plans'->0->>'status','unknown_before','a day before the item was recorded is flagged, not asserted');
select lives_ok($$select public.save_learning_plan(gen_random_uuid(),pg_temp.ch(),pg_temp.p1(),1,jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','','planned_on',pg_temp.d('1'),'due_on',pg_temp.d('2'),'time',null,'steps','[]'::jsonb,'done',false,'archived',false,'source_id',null))$$,'item moved to tomorrow');
select is(jsonb_array_length(pg_temp.plan(0)->'plans'),0,'today no longer lists the moved item');
select is(pg_temp.plan(1)->'plans'->0->>'revision','2','tomorrow lists the moved version');
select is(pg_temp.q('select count(*) from gina.learning_plan_changes where item_id='''||pg_temp.p1()||''''),'2','plan versions kept');

-- Authority and family boundary.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009603","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009602","role":"parent"}}',true);
select throws_ok($$select pg_temp.plan(0)$$,'42501','plan_forbidden','other family cannot read the day plan');
select throws_ok($$select public.change_task_routine(gen_random_uuid(),pg_temp.r1(),4,'save',pg_temp.value(1),pg_temp.t()+1)$$,'42501',null,'other family cannot schedule an edit');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009604","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009601","role":"device","child_id":"20000000-0000-4000-8000-000000009601"}}',true);
select lives_ok($$select pg_temp.plan(0)$$,'the child''s own device reads its day plan');
select is(pg_temp.routine(0,pg_temp.r1())->>'stars','7','device sees today''s version');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009605","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009601","role":"device","child_id":"20000000-0000-4000-8000-000000009602"}}',true);
select throws_ok($$select pg_temp.plan(0)$$,'42501','plan_forbidden','a sibling''s device cannot read another child''s plan');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000009602","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000009601","role":"parent"}}',true);
select is(pg_temp.routine(-1,pg_temp.r1())->>'stars','2','second parent reads the same history');
select throws_ok($$select public.plan_for_day(pg_temp.ch(),null)$$,'P0001','plan_day_invalid','missing day rejected');
reset role;
select ok(not has_function_privilege('anon','public.plan_for_day(uuid,date)','execute'),'anonymous day plan denied');
select ok(not has_function_privilege('anon','public.change_task_routine(uuid,uuid,integer,text,jsonb,date)','execute'),'anonymous routine edit denied');
select ok(not has_function_privilege('authenticated','gina.plan_version_on(jsonb,date)','execute'),'resolver private');
select ok(not has_table_privilege('authenticated','gina.school_timetable_versions','select'),'timetable versions server-owned');
select ok(not has_table_privilege('authenticated','gina.learning_plan_changes','select'),'plan versions server-owned');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='change_task_routine' and p.pronargs=5),'single routine RPC signature: old clients bind by name and get today');
select * from finish();
rollback;
