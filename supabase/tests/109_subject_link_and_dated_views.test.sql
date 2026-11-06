begin;
select no_plan();
update public.plans set prova_monthly_exams=null;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000010901','c02-parent-a@example.invalid'),
 ('00000000-0000-4000-8000-000000010902','c02-parent-b@example.invalid'),
 ('00000000-0000-4000-8000-000000010903','c02-other@example.invalid'),
 ('00000000-0000-4000-8000-000000010904','c02-device@example.invalid'),
 ('00000000-0000-4000-8000-000000010905','c02-sibling-device@example.invalid');
insert into public.families(id,name,timezone,created_by) values
 ('10000000-0000-4000-8000-000000010901','Synthetic','Europe/Istanbul','00000000-0000-4000-8000-000000010901'),
 ('10000000-0000-4000-8000-000000010902','Other','UTC','00000000-0000-4000-8000-000000010903');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010901','00000000-0000-4000-8000-000000010901'),
 ('10000000-0000-4000-8000-000000010901','00000000-0000-4000-8000-000000010902'),
 ('10000000-0000-4000-8000-000000010902','00000000-0000-4000-8000-000000010903');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000010901','10000000-0000-4000-8000-000000010901','Synthetic',4),
 ('20000000-0000-4000-8000-000000010902','10000000-0000-4000-8000-000000010901','Sibling',6),
 ('20000000-0000-4000-8000-000000010903','10000000-0000-4000-8000-000000010902','Other child',4);
insert into public.devices(id,family_id,auth_user_id,active_child_id,name) values
 ('70000000-0000-4000-8000-000000010904','10000000-0000-4000-8000-000000010901','00000000-0000-4000-8000-000000010904','20000000-0000-4000-8000-000000010901','Tablet'),
 ('70000000-0000-4000-8000-000000010905','10000000-0000-4000-8000-000000010901','00000000-0000-4000-8000-000000010905','20000000-0000-4000-8000-000000010902','Sibling tablet');
insert into public.guided_input_options(id,kind,label_tr,label_en,min_grade,max_grade,position) values
 ('subject-c02-temp','subject','Robotik Kodlama','Robot Coding',1,12,999);
create function pg_temp.fam() returns uuid language sql as $$select '10000000-0000-4000-8000-000000010901'::uuid$$;
create function pg_temp.ch() returns uuid language sql as $$select '20000000-0000-4000-8000-000000010901'::uuid$$;
create function pg_temp.sib() returns uuid language sql as $$select '20000000-0000-4000-8000-000000010902'::uuid$$;
create function pg_temp.r1() returns uuid language sql as $$select '30000000-0000-4000-8000-000000010901'::uuid$$;
create function pg_temp.t() returns date language sql security definer as $$select gina.family_today(pg_temp.fam())$$;
create function pg_temp.dow(int) returns int language sql as $$select extract(isodow from pg_temp.t()+$1)::int$$;
create function pg_temp.year() returns integer language sql as $$select extract(year from pg_temp.t())::int$$;
create function pg_temp.as_parent_a() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010901","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010901","role":"parent"}}',true)$$;
create function pg_temp.as_parent_b() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010902","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010901","role":"parent"}}',true)$$;
create function pg_temp.as_other() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010903","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010902","role":"parent"}}',true)$$;
create function pg_temp.as_device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010904","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010901","role":"device","child_id":"20000000-0000-4000-8000-000000010901"}}',true)$$;
create function pg_temp.as_sibling_device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010905","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010901","role":"device","child_id":"20000000-0000-4000-8000-000000010902"}}',true)$$;
create function pg_temp.lessons() returns jsonb language sql as $$select jsonb_build_array(
 jsonb_build_object('id','l1','day',pg_temp.dow(0),'title','MAT','start','09:00','end','09:40'),
 jsonb_build_object('id','l2','day',pg_temp.dow(0),'title','Robotik','start','10:00','end','10:40'),
 jsonb_build_object('id','l3','day',pg_temp.dow(1),'title','mat','start','09:00','end','09:40'))$$;
create function pg_temp.tt_rev() returns int language sql security definer as $$select coalesce((select revision from public.school_timetables where child_id=pg_temp.ch()),0)$$;
create function pg_temp.stored(text) returns text language sql security definer as $$select l->>'subject_id' from public.school_timetables t,jsonb_array_elements(t.lessons) l where t.child_id=pg_temp.ch() and l->>'id'=$1$$;
create function pg_temp.lesson(int,text) returns jsonb language sql as $$select l from jsonb_array_elements(public.plan_for_day(pg_temp.ch(),pg_temp.t()+$1)->'timetable'->'day_lessons') l where l->>'id'=$2$$;
create function pg_temp.edu_rev() returns int language sql security definer as $$select coalesce((select revision from gina.child_education_state where child_id=pg_temp.ch()),0)$$;
create function pg_temp.q(text) returns text language plpgsql security definer as $$declare r text;begin execute $1 into r;return r;end$$;
insert into public.task_templates(id,family_id,child_id,title,icon,stars,days_of_week,starts_on) values
 (pg_temp.r1(),pg_temp.fam(),pg_temp.ch(),'Kitap oku','read-book',2,'{1,2,3,4,5,6,7}',pg_temp.t()-30);

-- =========================================================================================
-- A) Ders kimliği: veli A bağlar, veli B ve çocuğun cihazı aynı kimliği görür; yabancı aile erişemez.
-- =========================================================================================
set local role authenticated;
select pg_temp.as_parent_a();
select lives_ok($$select public.save_school_timetable_request('50000000-0000-4000-8000-000000010901',pg_temp.ch(),0,pg_temp.lessons(),'{"start":"09:00","duration":40,"break":10}')$$,'timetable saved before any link (old client shape)');
select is(pg_temp.stored('l1'),null,'no link yet → no subject id stored');
select is((select (public.suggest_subject('MAT',4)->>'requires_confirmation')::boolean),true,'catalog suggestion still requires confirmation');
select is(pg_temp.lesson(0,'l1')->'subject_id','null'::jsonb,'suggestion alone never binds');
select lives_ok($$select public.set_child_subject_links('50000000-0000-4000-8000-000000010902',pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math","expected":null}]')$$,'parent A confirms MAT → Matematik');
select is((public.child_subject_links(pg_temp.ch())->'links'->0->>'subject_id'),'subject-math','parent A reads the link');
select is((public.child_subject_links(pg_temp.ch())->'links'->0->>'title'),'MAT','original document text kept as provenance');
select is((public.child_subject_links(pg_temp.ch())->'links'->0->>'label_tr'),'Matematik','Turkish catalogue title returned');
select is(pg_temp.lesson(0,'l1')->>'title','MAT','lesson keeps its own name');
select is(pg_temp.lesson(0,'l1')->>'subject_id','subject-math','plan_for_day lesson carries the bound id');
select is(pg_temp.lesson(0,'l1')->>'subject_label_tr','Matematik','plan_for_day lesson carries the catalogue title');
select is(pg_temp.lesson(0,'l1')->>'subject_source','link','id comes from the link until the next save');
select is(pg_temp.lesson(1,'l3')->>'subject_id','subject-math','another spelling of the same name ("mat") shares the id');
select is(pg_temp.lesson(0,'l2')->'subject_id','null'::jsonb,'unlinked free name stays unlinked');

select pg_temp.as_parent_b();
select is((public.child_subject_links(pg_temp.ch())->'links'->0->>'subject_id'),'subject-math','parent B sees the same id');
select is(pg_temp.lesson(0,'l1')->>'subject_id','subject-math','parent B plan_for_day same id');
-- Two sessions: B confirms the same subject without having seen A's link → no-op, not a conflict.
select is((public.set_child_subject_links('50000000-0000-4000-8000-000000010903',pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math","expected":null}]')->>'changed')::int,0,'same confirmation from a second session is idempotent');
select throws_ok($$select public.set_child_subject_links('50000000-0000-4000-8000-000000010904',pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-physics","expected":null}]')$$,'P0001','subject_link_changed','stale second session cannot overwrite a different link');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-nope","expected":"subject-math"}]')$$,'P0001','subject_unknown','unknown catalogue id rejected');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math"},{"title":"mat","subject_id":"subject-math"}]')$$,'P0001','subject_link_invalid','duplicate names in one request rejected');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"!!!","subject_id":"subject-math"}]')$$,'P0001','subject_link_invalid','name without letters rejected');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math","extra":1}]')$$,'P0001','subject_link_invalid','unknown keys rejected');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math"}]','auto')$$,'P0001','subject_link_invalid','unknown source rejected');
-- Device import (explicit parent confirmation in the app): Robotik → temporary catalogue entry.
select lives_ok($$select public.set_child_subject_links('50000000-0000-4000-8000-000000010905',pg_temp.ch(),'[{"title":"Robotik","subject_id":"subject-c02-temp","expected":null}]','device_import')$$,'device-local binding imported with parent confirmation');
select is((public.set_child_subject_links('50000000-0000-4000-8000-000000010905',pg_temp.ch(),'[{"title":"Robotik","subject_id":"subject-c02-temp","expected":null}]','device_import')->>'changed')::int,1,'replayed import returns the first result');
select throws_ok($$select public.set_child_subject_links('50000000-0000-4000-8000-000000010905',pg_temp.ch(),'[{"title":"Robotik","subject_id":null,"expected":"subject-c02-temp"}]','device_import')$$,'P0001','request_conflict','same request id with another payload conflicts');
select is((select count(*)::int from jsonb_array_elements(public.child_subject_links(pg_temp.ch())->'links')),2,'two links for the child');
select is((select count(*)::int from jsonb_array_elements(public.child_subject_links(pg_temp.sib())->'links')),0,'sibling has its own (empty) link set');

select pg_temp.as_device();
select is((public.child_subject_links(pg_temp.ch())->'links'->0->>'subject_id'),'subject-math','child device sees the same id');
select is(pg_temp.lesson(0,'l1')->>'subject_label_tr','Matematik','child device plan_for_day carries the title');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":null,"expected":"subject-math"}]')$$,'42501','subject_forbidden','child device cannot change links');
-- Device saves the timetable in the old client shape: the server stamps the bound id.
select lives_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),pg_temp.lessons(),'{"start":"09:00","duration":40,"break":10}')$$,'old-shape save from the child device');
select is(pg_temp.stored('l1'),'subject-math','stored lesson stamped with the parent-confirmed id');
select is(pg_temp.stored('l3'),'subject-math','other spelling stamped too');
select is(pg_temp.stored('l2'),'subject-c02-temp','imported link stamped');
select is(pg_temp.lesson(0,'l1')->>'subject_source','lesson','id now read from the saved lesson');
select is((select l->>'title' from public.school_timetables t,jsonb_array_elements(t.lessons) l where t.child_id=pg_temp.ch() and l->>'id'='l1'),'MAT','saved title unchanged');

select pg_temp.as_sibling_device();
select throws_ok($$select public.child_subject_links(pg_temp.ch())$$,'42501','subject_forbidden','sibling device cannot read another child''s links');
select pg_temp.as_other();
select throws_ok($$select public.child_subject_links(pg_temp.ch())$$,'42501','subject_forbidden','other family cannot read');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":null,"expected":"subject-math"}]')$$,'42501','subject_forbidden','other family cannot write');
select throws_ok($$select public.plan_for_day(pg_temp.ch(),pg_temp.t())$$,'42501','plan_forbidden','other family cannot read the day plan');
select throws_ok($$select public.plan_for_days(pg_temp.ch(),pg_temp.t(),pg_temp.t()+6)$$,'42501','plan_forbidden','other family cannot read the week');

-- Timetable contract: a client-sent subject_id must equal the confirmed link.
select pg_temp.as_parent_a();
select throws_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),jsonb_set(pg_temp.lessons(),'{0,subject_id}','"subject-physics"'),'{"start":"09:00","duration":40,"break":10}')$$,'P0001','timetable_subject_unconfirmed','client cannot bind a lesson the parent did not confirm');
select throws_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),jsonb_set(pg_temp.lessons(),'{0,subject_id}','3'),'{"start":"09:00","duration":40,"break":10}')$$,'P0001','timetable_invalid','non-string subject id rejected');
select lives_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),jsonb_set(pg_temp.lessons(),'{0,subject_id}','"subject-math"'),'{"start":"09:00","duration":40,"break":10}')$$,'new client shape with the confirmed id');
select is(pg_temp.stored('l1'),'subject-math','new shape stored');
-- Unlink: free name stays, id removed on the next save; audit keeps both ids.
select lives_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"mat","subject_id":null,"expected":"subject-math"}]')$$,'parent unlinks');
select is(pg_temp.lesson(0,'l1')->>'subject_source','lesson','until the next save the version still carries its stamped id');
select lives_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),pg_temp.lessons(),'{"start":"09:00","duration":40,"break":10}')$$,'save after unlink');
select is(pg_temp.stored('l1'),null,'stamp removed once the link is gone');
select is(pg_temp.lesson(0,'l1')->>'title','MAT','name unchanged after unlink');
select lives_ok($$select public.set_child_subject_links(gen_random_uuid(),pg_temp.ch(),'[{"title":"MAT","subject_id":"subject-math","expected":null}]')$$,'relinked');
select lives_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),pg_temp.tt_rev(),pg_temp.lessons(),'{"start":"09:00","duration":40,"break":10}')$$,'save after relink');
reset role;
select is((select count(*)::int from gina.child_subject_link_changes where child_id=pg_temp.ch()),4,'every real change audited (no-ops are not)');

-- Deleted catalogue entry: the link falls away, the lesson text and older versions stay readable.
delete from public.guided_input_options where id='subject-c02-temp';
set local role authenticated;
select pg_temp.as_parent_a();
select is(pg_temp.lesson(0,'l2')->>'title','Robotik','lesson text survives catalogue deletion');
select is(pg_temp.lesson(0,'l2')->'subject_id','null'::jsonb,'dangling id is not exposed');
select is(pg_temp.lesson(0,'l1')->>'subject_id','subject-math','other links unaffected');
select is((select count(*)::int from jsonb_array_elements(public.child_subject_links(pg_temp.ch())->'links')),1,'deleted entry no longer listed');
reset role;
select is((select count(*)::int from gina.child_subject_link_changes where child_id=pg_temp.ch() and after_subject_id='subject-c02-temp'),1,'audit keeps the deleted id as text');
set local role authenticated;
select pg_temp.as_parent_a();

-- =========================================================================================
-- B) Tarihli okuma: plan_for_days aynı sözleşme, aile-yerel gün sınırı (İstanbul/UTC)
-- =========================================================================================
select is(jsonb_array_length(public.plan_for_days(pg_temp.ch(),pg_temp.t()-3,pg_temp.t()+3)),7,'seven days returned');
select is((public.plan_for_days(pg_temp.ch(),pg_temp.t()-3,pg_temp.t()+3)->3->>'day'),pg_temp.t()::text,'middle day is family today');
select is((public.plan_for_days(pg_temp.ch(),pg_temp.t(),pg_temp.t())->0),public.plan_for_day(pg_temp.ch(),pg_temp.t()),'range item equals the single-day contract');
select is((public.plan_for_days(pg_temp.ch(),pg_temp.t()-3,pg_temp.t()+3)->0->'timetable'->>'status'),'unknown_before','a past day before the first known timetable is not filled with today''s program');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t())->>'today'),(now() at time zone 'Europe/Istanbul')::date::text,'today follows the Istanbul family day, not the session/UTC day');
select throws_ok($$select public.plan_for_days(pg_temp.ch(),pg_temp.t(),pg_temp.t()-1)$$,'P0001','plan_day_invalid','reversed range rejected');
select throws_ok($$select public.plan_for_days(pg_temp.ch(),pg_temp.t(),pg_temp.t()+42)$$,'P0001','plan_day_invalid','more than 42 days rejected');
reset role;
select is(gina.family_today('10000000-0000-4000-8000-000000010902'),(now() at time zone 'UTC')::date,'a UTC family keeps its own day');
select is(gina.local_day('Europe/Istanbul','2026-11-06T20:59:00Z'),'2026-11-06'::date,'23:59 Istanbul is still the same day');
select is(gina.local_day('Europe/Istanbul','2026-11-06T21:00:00Z'),'2026-11-07'::date,'00:00 Istanbul is the next day while UTC is still 21:00');
set local role authenticated;
select pg_temp.as_parent_a();

-- =========================================================================================
-- C) Geleceğe planlı eğitim geçişi + 14 gün geri alma
-- =========================================================================================
select lives_ok($$select public.complete_task(pg_temp.r1(),pg_temp.t()-1,'40000000-0000-4000-8000-000000010901',pg_temp.ch())$$,'work submitted before the transition');
select lives_ok($$select public.review_task((select id from public.task_completions where template_id=pg_temp.r1() and due_date=pg_temp.t()-1),true)$$,'work approved with stars');
create temp table evidence as select (select coalesce(sum(delta),0)::int from public.star_events where child_id=pg_temp.ch()) stars,
 (select count(*)::int from public.task_completions where child_id=pg_temp.ch()) completions,
 (select string_agg(task_snapshot::text,'|') from public.task_completions where child_id=pg_temp.ch()) snapshots;
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),0,'initial',pg_temp.year()-1,4,'İlk Okul',make_date(pg_temp.year()-1,9,1),pg_temp.tt_rev(),true)$$,'initial period');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t(),false)$$,'P0001','education_date','today is not a scheduled change');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t()-1,false)$$,'P0001','education_date','past day rejected');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+400)::int,5,'İlk Okul',pg_temp.t()+400,false)$$,'P0001','education_date','more than a year ahead rejected');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev()+5,'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t()+3,false)$$,'P0001','education_changed','stale education revision rejected');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'correct',pg_temp.year(),5,'İlk Okul',pg_temp.t()+3,false)$$,'P0001','education_invalid','only new year / transfer can be scheduled');
select lives_ok($$select public.schedule_child_education_change('50000000-0000-4000-8000-000000010911',pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t()+3,false)$$,'new year scheduled three days ahead');
select is((public.schedule_child_education_change('50000000-0000-4000-8000-000000010911',pg_temp.ch(),pg_temp.edu_rev()-1,'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t()+3,false)->>'starts_on'),(pg_temp.t()+3)::text,'replay returns the same schedule');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+5)::int,5,'İlk Okul',pg_temp.t()+5,false)$$,'P0001','education_scheduled','one open schedule per child');
select is((select grade from public.children where id=pg_temp.ch())::int,4,'grade unchanged until the day');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t())->'period'->>'reason'),'initial','today still in the current period');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.t())->'timetable'->'lessons'),3,'today keeps the program');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'period'->>'scheduled'),'true','the planned day shows the new period');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'period'->>'grade'),'5','the planned day shows the new grade');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'timetable'->'lessons'),0,'the planned day starts with an empty program');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'timetable'->>'source'),'scheduled_change','empty program marked as a scheduled change');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t())->'scheduled_education'->>'starts_on'),(pg_temp.t()+3)::text,'every day carries the pending change');
select is((public.education_change_state(pg_temp.ch())->'scheduled'->>'status'),'scheduled','state lists the schedule');
select is((public.apply_due_education_changes(pg_temp.ch())->>'applied')::boolean,false,'nothing applied before the day');
select pg_temp.as_device();
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'period'->>'scheduled'),'true','child device sees the same planned day');
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',pg_temp.year(),5,null,pg_temp.t()+3,false)$$,'42501','education_forbidden','device cannot schedule');
select throws_ok($$select public.apply_due_education_changes(pg_temp.ch())$$,'42501','education_forbidden','device cannot apply');
select pg_temp.as_other();
select throws_ok($$select public.education_change_state(pg_temp.ch())$$,'42501','education_forbidden','other family cannot read the state');
select throws_ok($$select public.undo_child_education_change(gen_random_uuid(),pg_temp.ch(),0)$$,'42501','education_forbidden','other family cannot undo');
-- Cancel and reschedule; cancel replay is idempotent.
select pg_temp.as_parent_b();
create temp table sched as select (public.education_change_state(pg_temp.ch())->'scheduled'->>'id')::uuid id;
select lives_ok($$select public.cancel_child_education_schedule('50000000-0000-4000-8000-000000010912',pg_temp.ch(),(select id from sched))$$,'second parent cancels');
select is((public.cancel_child_education_schedule('50000000-0000-4000-8000-000000010912',pg_temp.ch(),(select id from sched))->>'status'),'cancelled','cancel replay returns the same result');
select throws_ok($$select public.cancel_child_education_schedule(gen_random_uuid(),pg_temp.ch(),(select id from sched))$$,'P0001','education_changed','a new cancel of a cancelled plan is refused');
select is((public.education_change_state(pg_temp.ch())->'scheduled'),'null'::jsonb,'no open schedule after cancel');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()+3)->'period'->>'reason'),'initial','cancelled plan no longer shows');
select lives_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',extract(year from pg_temp.t()+3)::int,5,'İlk Okul',pg_temp.t()+3,false)$$,'rescheduled');
-- Two sessions: parent A holds the old revision.
select pg_temp.as_parent_a();
select throws_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev()-1,'correct',pg_temp.year()-1,4,'İlk Okul',make_date(pg_temp.year()-1,9,1),pg_temp.tt_rev(),true)$$,'P0001','education_changed','an open wizard with the old revision is stopped');

-- The day arrives (simulated by moving the planned day to today): the parent's next open applies it.
reset role;
update gina.child_education_schedules set starts_on=gina.family_today('10000000-0000-4000-8000-000000010901'),academic_year=extract(year from gina.family_today('10000000-0000-4000-8000-000000010901'))::int where child_id='20000000-0000-4000-8000-000000010901' and status='scheduled';
set local role authenticated;
select pg_temp.as_parent_a();
select is((public.apply_due_education_changes(pg_temp.ch())->>'applied')::boolean,true,'due change applied');
select is((public.apply_due_education_changes(pg_temp.ch())->>'applied')::boolean,false,'second apply does nothing');
select is((select grade from public.children where id=pg_temp.ch())::int,5,'grade projection updated on the day');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t())->'period'->>'reason'),'new_year','today is in the new period');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.t())->'timetable'->'lessons'),0,'program empty from the day');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.t()-1)->'timetable'->'lessons'),3,'yesterday keeps the old program');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t()-1)->'period'->>'reason'),'initial','yesterday stays in the old period');
select is((public.education_change_state(pg_temp.ch())->'undo'->>'until'),(pg_temp.t()+14)::text,'undo offered for 14 days');
select is((select stars from evidence),(select coalesce(sum(delta),0)::int from public.star_events where child_id=pg_temp.ch()),'stars unchanged by the transition');

-- Period transfer into the new period blocks undo; replaying the transfer is idempotent.
select lives_ok($$select public.transfer_education_period_items('50000000-0000-4000-8000-000000010921',pg_temp.ch(),
 (select (x->>'id')::uuid from jsonb_array_elements(public.get_child_education(pg_temp.ch())->'history') x limit 1),
 (public.get_child_education(pg_temp.ch())->'current'->>'id')::uuid,pg_temp.edu_rev(),
 jsonb_build_object('routines',jsonb_build_array(jsonb_build_object('id',pg_temp.r1(),'revision',(select revision from public.task_templates where id=pg_temp.r1()),'action','copy')),'plans','[]'::jsonb))$$,'routine copied into the new period');
create temp table transfer_once as select public.transfer_education_period_items('50000000-0000-4000-8000-000000010921',pg_temp.ch(),
 (select (x->>'id')::uuid from jsonb_array_elements(public.get_child_education(pg_temp.ch())->'history') x limit 1),
 (public.get_child_education(pg_temp.ch())->'current'->>'id')::uuid,pg_temp.edu_rev()-1,
 jsonb_build_object('routines',jsonb_build_array(jsonb_build_object('id',pg_temp.r1(),'revision',(select revision from public.task_templates where id=pg_temp.r1())-1,'action','copy')),'plans','[]'::jsonb)) r;
reset role;
select is((select count(*)::int from public.task_templates where source_routine_id=pg_temp.r1()),1,'transfer replay created no second copy');
set local role authenticated;
select pg_temp.as_parent_a();
select is((public.education_change_state(pg_temp.ch())->'undo'->>'blocked'),'transfer','undo blocked while transferred records exist');
select throws_ok($$select public.undo_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev())$$,'P0001','education_undo_transfer','undo refused after a transfer');
-- Remove the transfer link (as if the parent archived the copy and its period link) to test undo itself.
reset role;
update public.task_templates set period_id=null,source_period_id=null where source_routine_id=pg_temp.r1();
delete from gina.child_education_changes where child_id=pg_temp.ch() and action='transfer_items';
set local role authenticated;
select pg_temp.as_parent_a();
select throws_ok($$select public.undo_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev()+1)$$,'P0001','education_changed','stale undo rejected');
select lives_ok($$select public.undo_child_education_change('50000000-0000-4000-8000-000000010931',pg_temp.ch(),pg_temp.edu_rev())$$,'undo within 14 days');
select is((public.undo_child_education_change('50000000-0000-4000-8000-000000010931',pg_temp.ch(),pg_temp.edu_rev()-1)->>'timetable_restored')::boolean,true,'undo replay returns the same result (program restored)');
select is((select grade from public.children where id=pg_temp.ch())::int,4,'grade restored');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.t())->'period'->>'reason'),'initial','old period current again');
select is((public.get_child_education(pg_temp.ch())->'current'->>'ends_on'),null,'old period reopened');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.t())->'timetable'->'lessons'),3,'program restored');
select is(pg_temp.lesson(0,'l1')->>'subject_id','subject-math','restored lessons keep the subject id');
select throws_ok($$select public.undo_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev())$$,'P0001','education_undo_unavailable','nothing left to undo');
reset role;
select is((select stars from evidence),(select coalesce(sum(delta),0)::int from public.star_events where child_id=pg_temp.ch()),'stars unchanged after undo');
select is((select completions from evidence),(select count(*)::int from public.task_completions where child_id=pg_temp.ch()),'completions unchanged');
select is((select snapshots from evidence),(select string_agg(task_snapshot::text,'|') from public.task_completions where child_id=pg_temp.ch()),'submission snapshots unchanged');
select is((select undone_at is not null from gina.child_education_schedules where child_id=pg_temp.ch() and status='applied'),true,'applied schedule marked undone');
select is((select count(*)::int from gina.child_education_changes where child_id=pg_temp.ch() and action='undo'),1,'one undo audit row');
set local role authenticated;
select pg_temp.as_parent_a();

-- Expired: a transition older than 14 days cannot be undone.
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'new_year',pg_temp.year(),5,'İlk Okul',pg_temp.t(),pg_temp.tt_rev(),true)$$,'immediate new year');
reset role;
update gina.child_education_changes set created_at=now()-interval '20 days' where child_id=pg_temp.ch() and action='new_year';
set local role authenticated;
select pg_temp.as_parent_a();
select is((public.education_change_state(pg_temp.ch())->'undo'->>'expired')::boolean,true,'state reports the expired window');
select throws_ok($$select public.undo_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev())$$,'P0001','education_undo_expired','undo refused after 14 days');

-- A schedule that can no longer apply fails cleanly (no half transition).
select lives_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.edu_rev(),'transfer',pg_temp.year(),5,'Yeni Okul',pg_temp.t()+2,true)$$,'transfer scheduled');
reset role;
update gina.child_education_schedules set starts_on=gina.family_today('10000000-0000-4000-8000-000000010901')-400 where child_id='20000000-0000-4000-8000-000000010901' and status='scheduled';
set local role authenticated;
select pg_temp.as_parent_a();
select is((public.apply_due_education_changes(pg_temp.ch())->>'failed') is not null,true,'invalid due change fails');
select is((public.education_change_state(pg_temp.ch())->'last_failed'->>'action'),'transfer','failure surfaced to the parent');
select is((public.get_child_education(pg_temp.ch())->'current'->>'reason'),'new_year','current period untouched by the failed apply');

-- Grants: new functions are not callable anonymously; private helpers are not callable at all.
reset role;
select ok(not has_function_privilege('anon','public.set_child_subject_links(uuid,uuid,jsonb,text)','execute'),'anon cannot set links');
select ok(not has_function_privilege('anon','public.plan_for_days(uuid,date,date)','execute'),'anon cannot read days');
select ok(not has_function_privilege('authenticated','gina.plan_for_day_base(uuid,date)','execute'),'private base plan not exposed');
select ok(not has_function_privilege('authenticated','gina.education_undo_info(uuid)','execute'),'private undo info not exposed');
select ok(not has_table_privilege('authenticated','gina.child_subject_links','select'),'link table not directly readable');
select ok(not has_table_privilege('authenticated','gina.child_education_schedules','select'),'schedule table not directly readable');
select * from finish();
rollback;
