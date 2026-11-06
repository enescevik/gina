-- C11: eşanlamlı yönetimi, takvim yayın kapısı, tatil önerisi, planlı geçiş + takvim gerekçesi, dönem hatırlatması,
-- okul istisna özeti ve istemci paket seçiminin kalıcı ücretli hak üretmediği.
begin;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000011701','c11-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000011702','c11-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000011703','c11-parent-b@example.invalid'),
 ('00000000-0000-4000-8000-000000011704','c11-other@example.invalid'),
 ('00000000-0000-4000-8000-000000011705','c11-device@example.invalid');
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000011701','content',now()+interval '1 day');
insert into public.families(id,name,timezone,created_by) values
 ('10000000-0000-4000-8000-000000011701','C11 family','Europe/Istanbul','00000000-0000-4000-8000-000000011702'),
 ('10000000-0000-4000-8000-000000011702','C11 other','UTC','00000000-0000-4000-8000-000000011704');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011701','00000000-0000-4000-8000-000000011702'),
 ('10000000-0000-4000-8000-000000011701','00000000-0000-4000-8000-000000011703'),
 ('10000000-0000-4000-8000-000000011702','00000000-0000-4000-8000-000000011704');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000011701','10000000-0000-4000-8000-000000011701','Synthetic',4),
 ('20000000-0000-4000-8000-000000011702','10000000-0000-4000-8000-000000011701','Sibling',4),
 ('20000000-0000-4000-8000-000000011703','10000000-0000-4000-8000-000000011702','Other',4);
insert into public.devices(id,family_id,auth_user_id,active_child_id,name) values
 ('70000000-0000-4000-8000-000000011705','10000000-0000-4000-8000-000000011701','00000000-0000-4000-8000-000000011705','20000000-0000-4000-8000-000000011701','Tablet');
create function pg_temp.ch() returns uuid language sql as $$select '20000000-0000-4000-8000-000000011701'::uuid$$;
create function pg_temp.sib() returns uuid language sql as $$select '20000000-0000-4000-8000-000000011702'::uuid$$;
create function pg_temp.fam() returns uuid language sql as $$select '10000000-0000-4000-8000-000000011701'::uuid$$;
create function pg_temp.country() returns uuid language sql as $$select 'ec000000-0000-4000-8000-000000000001'::uuid$$;
create function pg_temp.t() returns date language sql security definer as $$select gina.family_today(pg_temp.fam())$$;
-- İlk hafta içi gün (yarından itibaren); ara tatil penceresi wd..wd+4.
create function pg_temp.wd() returns date language sql security definer as $$select min(d)::date from generate_series(pg_temp.t()+1,pg_temp.t()+7,interval '1 day') d where extract(isodow from d) between 1 and 5$$;
create function pg_temp.as_admin() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011701","role":"authenticated","gina":{"role":"parent"}}',true)$$;
create function pg_temp.as_parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011702","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011701"}}',true)$$;
create function pg_temp.as_parent_b() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011703","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011701"}}',true)$$;
create function pg_temp.as_other() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011704","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-4000-8000-000000011702"}}',true)$$;
create function pg_temp.as_device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011705","role":"authenticated","gina":{"role":"device","family_id":"10000000-0000-4000-8000-000000011701","child_id":"20000000-0000-4000-8000-000000011701","device_id":"70000000-0000-4000-8000-000000011705"}}',true)$$;
create function pg_temp.math_key() returns jsonb language sql security definer as $$select jsonb_build_object('alias_normalized',alias_normalized,'subject_id',subject_id,'grade_min',grade_min) from gina.subject_synonyms where subject_id='subject-math' and alias_normalized='mat' order by grade_min limit 1$$;
create function pg_temp.math_rev() returns int language sql security definer as $$select revision from gina.subject_synonyms where subject_id='subject-math' and alias_normalized='mat' order by grade_min limit 1$$;
create function pg_temp.ids(j jsonb) returns text language sql immutable as $$select coalesce(string_agg(x->>'subject_id',',' order by x->>'subject_id'),'') from jsonb_array_elements(j->'candidates') x$$;
grant execute on all functions in schema pg_temp to authenticated;

-- ===========================================================================
-- 1) Ders eşanlamlıları: kontrollü düzenleme + audit
-- ===========================================================================
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-math','Mat Uyg',5,8,null,null,'Okul belgesinde böyle yazıyor')$$,'42501','forbidden','parent cannot edit synonyms');
select throws_ok($$select public.admin_subject_synonym_changes(null)$$,'42501','forbidden','parent cannot read synonym history');
select is(pg_temp.ids(public.suggest_subject('Mat Uyg',6)),'','before admin edit: unknown alias has no candidate');
select pg_temp.as_admin();
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-math','Mat Uyg',5,8,null,null,'kısa')$$,'P0001','synonym_invalid','note under 10 chars rejected');
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-nope','Mat Uyg',5,8,null,null,'Okul belgesinde böyle yazıyor')$$,'P0001','subject_unknown','unknown subject rejected');
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-math','!!!',5,8,null,null,'Okul belgesinde böyle yazıyor')$$,'P0001','synonym_invalid','alias normalizing to empty rejected');
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-math','Mat Uyg',8,5,null,null,'Okul belgesinde böyle yazıyor')$$,'P0001','synonym_invalid','inverted grade range rejected');
select is(public.admin_save_subject_synonym('51000000-0000-4000-8000-000000011701','add','subject-math','Mat Uyg',5,8,null,null,'Okul belgesinde böyle yazıyor')->>'revision','1','admin adds synonym');
select is(public.admin_save_subject_synonym('51000000-0000-4000-8000-000000011701','add','subject-math','Mat Uyg',5,8,null,null,'Okul belgesinde böyle yazıyor')->>'alias_normalized','matuyg','same request replays receipt');
select throws_ok($$select public.admin_save_subject_synonym('51000000-0000-4000-8000-000000011701','add','subject-math','Mat Uyg',5,9,null,null,'Okul belgesinde böyle yazıyor')$$,'P0001','request_conflict','same request id with different payload rejected');
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-math','MAT-UYG',7,10,null,null,'Okul belgesinde böyle yazıyor')$$,'P0001','synonym_exists','overlapping range for same subject rejected');
select is(pg_temp.ids(public.suggest_subject('mat uyg',6)),'subject-math','new synonym suggests the subject');
select is(public.suggest_subject('mat uyg',6)->>'requires_confirmation','true','admin synonym still needs parent confirmation');
select is(public.admin_save_subject_synonym(gen_random_uuid(),'add','subject-science','Mat Uyg',5,8,null,null,'Bazı okullar fen uygulamasını da böyle kısaltıyor')->'shared_with','["subject-math"]'::jsonb,'shared alias is reported to the admin');
select is(public.suggest_subject('mat uyg',6)->>'match','ambiguous','shared alias makes the parent choose');
-- Kaynak satırı: düzenlenemez, yalnız pasifleştirilir.
select throws_ok(format($$select public.admin_save_subject_synonym(gen_random_uuid(),'update','subject-math','MAT',1,4,%L,%s,'Kapsamı daraltmak istiyorum burada')$$,pg_temp.math_key(),pg_temp.math_rev()),'P0001','synonym_source_locked','catalog row cannot be edited');
select throws_ok(format($$select public.admin_save_subject_synonym(gen_random_uuid(),'deactivate','subject-math',null,null,null,%L,%s,'Eski sürümle pasifleştirme denemesi')$$,pg_temp.math_key(),pg_temp.math_rev()+5),'P0001','synonym_changed','stale revision rejected');
select lives_ok(format($$select public.admin_save_subject_synonym(gen_random_uuid(),'deactivate','subject-math',null,null,null,%L,%s,'Bu kısaltma okulda başka anlam taşıyor')$$,pg_temp.math_key(),pg_temp.math_rev()),'catalog row deactivated with note');
select throws_ok(format($$select public.admin_save_subject_synonym(gen_random_uuid(),'deactivate','subject-math',null,null,null,%L,%s,'İkinci kez pasifleştirme denemesi')$$,pg_temp.math_key(),pg_temp.math_rev()),'P0001','synonym_changed','deactivating an inactive row is a conflict');
select is(pg_temp.ids(public.suggest_subject('MAT',2)),'','inactive synonym produces no suggestion');
select lives_ok(format($$select public.admin_save_subject_synonym(gen_random_uuid(),'reactivate','subject-math',null,null,null,%L,%s,'Okul geri bildirimi sonrası geri açıldı')$$,pg_temp.math_key(),pg_temp.math_rev()),'catalog row reactivated');
select is(pg_temp.ids(public.suggest_subject('MAT',2)),'subject-math','reactivated synonym suggests again');
-- Yönetici satırı: görünen ad ve aralık değişebilir, normalize ad değişemez.
select throws_ok($$select public.admin_save_subject_synonym(gen_random_uuid(),'update','subject-math','Matematik Uyg',5,8,'{"alias_normalized":"matuyg","subject_id":"subject-math","grade_min":5}',1,'Adı değiştirmeyi deniyorum')$$,'P0001','synonym_invalid','normalized alias is immutable on update');
select is(public.admin_save_subject_synonym(gen_random_uuid(),'update','subject-math','Mat. Uyg.',5,6,'{"alias_normalized":"matuyg","subject_id":"subject-math","grade_min":5}',1,'Yalnız 5-6. sınıfta okutuluyor')->>'grade_max','6','admin row range narrowed');
select is((public.admin_subject_synonym_changes('subject-math')->0->>'action'),'update','history lists the latest change first');
select is(jsonb_array_length(public.admin_subject_synonym_changes('subject-math')),4,'math history: add, deactivate, reactivate, update');
reset role;
select is((select count(*)::int from public.audit_log where action like 'subject.synonym.%'),5,'every synonym change audited (replay adds none)');
select is((select count(*)::int from gina.subject_synonyms where source='admin'),2,'two admin rows');
select is((select count(*)::int from gina.subject_synonyms where source<>'admin'),279,'seed rows never deleted');
select ok(not has_table_privilege('authenticated','gina.subject_synonym_changes','select'),'history table closed to clients');

-- ===========================================================================
-- 2) Takvim yayın kapısı
-- ===========================================================================
insert into gina.education_places(id,kind,parent_id,name,active) values
 ('ec000000-0000-4000-8000-000000011701','region','ec000000-0000-4000-8000-000000000001','C11 İli',true),
 ('ec000000-0000-4000-8000-000000011702','school','ec000000-0000-4000-8000-000000011701','C11 Okulu',true);
create function pg_temp.cal_value(p_title text,p_verified date) returns jsonb language sql security definer as $$
 select jsonb_build_object('title',p_title,'source_url','https://example.invalid/takvim','verified_on',p_verified,'starts_on',pg_temp.t()-30,'ends_on',pg_temp.t()+200,
  'terms',jsonb_build_array(jsonb_build_object('title','1. parça','starts_on',pg_temp.t()-30,'ends_on',pg_temp.wd()-1),
   jsonb_build_object('title','2. parça','starts_on',pg_temp.wd()+5,'ends_on',pg_temp.t()+200)))$$;
create function pg_temp.yr() returns int language sql security definer as $$select extract(year from pg_temp.t()-30)::int$$;
-- Tohumdan gelmiş gibi taslaklar: köken kaydı S04 içe aktarmasının yazdığı biçimde.
insert into gina.education_calendars(id,place_id,stage,academic_year,draft) values
 ('ca000000-0000-4000-8000-000000011701',pg_temp.country(),'primary',pg_temp.yr(),pg_temp.cal_value('Ülke takvimi',current_date)),
 ('ca000000-0000-4000-8000-000000011702','ec000000-0000-4000-8000-000000011701','primary',pg_temp.yr(),pg_temp.cal_value('İl takvimi (orta güven)',current_date)),
 ('ca000000-0000-4000-8000-000000011703','ec000000-0000-4000-8000-000000011701','middle',pg_temp.yr(),pg_temp.cal_value('İl ortaokul (düşük güven)',current_date)),
 ('ca000000-0000-4000-8000-000000011704','ec000000-0000-4000-8000-000000011701','high',pg_temp.yr(),pg_temp.cal_value('İl lise (eski kaynak)',current_date) || jsonb_build_object('verified_on',pg_temp.t()-30-400));
insert into public.audit_log(actor_id,action,target_table,target_id,details) values
 (null,'education.calendar.draft','education_calendars','ca000000-0000-4000-8000-000000011701','{"source":"seed","seed_id":"c11-country","confidence":"high","checked_at":"2026-11-05"}'),
 (null,'education.calendar.draft','education_calendars','ca000000-0000-4000-8000-000000011702','{"source":"seed","seed_id":"c11-region","confidence":"medium","checked_at":"2026-11-05"}'),
 (null,'education.calendar.draft','education_calendars','ca000000-0000-4000-8000-000000011703','{"source":"seed","seed_id":"c11-region-low","confidence":"low","checked_at":"2026-11-05"}');
create temp table pubq as select c.id,format('select public.admin_save_education_calendar(gen_random_uuid(),%L,1,%L,%L,%s,%L,true)',c.id,c.place_id,c.stage,c.academic_year,c.draft) q from gina.education_calendars c where c.id::text like 'ca000000-0000-4000-8000-0000000117%';
grant select on pubq to authenticated;
set local role authenticated;
select pg_temp.as_admin();
select is((select jsonb_agg(x->'blocks' order by x->>'calendar_id') from jsonb_array_elements(public.admin_education_calendar_checks()) x where x->>'calendar_id' like 'ca000000-0000-4000-8000-0000000117%'),
 '[[], [], ["low_confidence"], ["source_stale"]]'::jsonb,'checks: low confidence and stale source block publishing');
select ok((select x->'warnings' ? 'review_required' from jsonb_array_elements(public.admin_education_calendar_checks()) x where x->>'calendar_id'='ca000000-0000-4000-8000-000000011702'),'medium confidence needs recorded review');
select lives_ok((select q from pubq where id='ca000000-0000-4000-8000-000000011701'),'high-confidence fresh draft publishes through the existing path');
select throws_ok((select q from pubq where id='ca000000-0000-4000-8000-000000011702'),'P0001','calendar_publish_review_required','medium-confidence draft cannot be published without review');
select throws_ok((select q from pubq where id='ca000000-0000-4000-8000-000000011703'),'P0001','calendar_publish_blocked','low-confidence draft is never published');
select throws_ok((select q from pubq where id='ca000000-0000-4000-8000-000000011704'),'P0001','calendar_publish_blocked','stale source is never published');
select throws_ok($$select public.admin_publish_education_calendar(gen_random_uuid(),'ca000000-0000-4000-8000-000000011702',1,'{"source_opened":true,"dates_match":false,"scope_match":true}','Kaynak açıldı, tarihler kontrol edildi')$$,'P0001','calendar_review_incomplete','incomplete checklist rejected');
select throws_ok($$select public.admin_publish_education_calendar(gen_random_uuid(),'ca000000-0000-4000-8000-000000011702',1,'{"source_opened":true,"dates_match":true,"scope_match":true}','kısa')$$,'P0001','calendar_detail_required','review note required');
select throws_ok($$select public.admin_publish_education_calendar(gen_random_uuid(),'ca000000-0000-4000-8000-000000011703',1,'{"source_opened":true,"dates_match":true,"scope_match":true}','İnceledim ama güven düşük')$$,'P0001','calendar_publish_blocked','review cannot override low confidence');
select ok((select x->'warnings' ? 'same_as_parent' from jsonb_array_elements(public.admin_education_calendar_checks()) x where x->>'calendar_id'='ca000000-0000-4000-8000-000000011702'),'region identical to published country calendar is flagged as unnecessary');
select is(public.admin_publish_education_calendar('52000000-0000-4000-8000-000000011701','ca000000-0000-4000-8000-000000011702',1,'{"source_opened":true,"dates_match":true,"scope_match":true}','İl MEM PDF açıldı, dönem tarihleri satır satır karşılaştırıldı')->>'reviewed','true','reviewed medium draft publishes');
select is(public.admin_publish_education_calendar('52000000-0000-4000-8000-000000011701','ca000000-0000-4000-8000-000000011702',1,'{"source_opened":true,"dates_match":true,"scope_match":true}','İl MEM PDF açıldı, dönem tarihleri satır satır karşılaştırıldı')->>'published','true','review replay returns the same receipt');
reset role;
select is((select count(*)::int from gina.education_calendar_reviews where calendar_id='ca000000-0000-4000-8000-000000011702'),1,'one review recorded');
select is((select count(*)::int from gina.education_calendars where published is not null and id::text like 'ca000000-0000-4000-8000-0000000117%'),2,'only country + reviewed region published');
select is(gina.education_calendar_match('ec000000-0000-4000-8000-000000011702','primary',pg_temp.yr())->>'id','ca000000-0000-4000-8000-000000011702','school falls back to the most specific published (region) calendar');
select is(gina.education_calendar_match('ec000000-0000-4000-8000-000000011702','middle',pg_temp.yr()),null::jsonb,'unpublished low-confidence middle calendar is never matched');
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select public.admin_publish_education_calendar(gen_random_uuid(),'ca000000-0000-4000-8000-000000011703',1,'{"source_opened":true,"dates_match":true,"scope_match":true}','Veli yayımlamayı deniyor')$$,'42501','forbidden','parent cannot publish');
select throws_ok($$select public.admin_education_calendar_checks()$$,'42501','forbidden','parent cannot read checks');

-- ===========================================================================
-- 3) Tatil günleri: içe aktarma (taslak) → ayrı yayın
-- ===========================================================================
create function pg_temp.hseed() returns jsonb language sql security definer as $$select jsonb_build_object('schema','gina.education-calendar-seed.v1','country','Türkiye','academic_year',pg_temp.yr(),'checked_at',current_date,
 'sources',jsonb_build_array(jsonb_build_object('id','src-h','url','https://example.invalid/tatil')),
 'public_holidays',jsonb_build_object('sources',jsonb_build_array('src-h'),'items',jsonb_build_array(
  jsonb_build_object('id','h-c11','title','C11 Bayramı','starts_on',pg_temp.wd()+7,'ends_on',pg_temp.wd()+7,'within_school_year',true),
  jsonb_build_object('id','h-c11-summer','title','Yaz günü','starts_on',pg_temp.t()+300,'ends_on',pg_temp.t()+300,'within_school_year',false),
  jsonb_build_object('id','h-bad','title','X','starts_on','2026-13-01','ends_on','2026-13-01','within_school_year',true))))$$;
select pg_temp.as_admin();
select is(public.admin_import_education_holidays(null,pg_temp.hseed(),false)->'counts','{"create":1,"exists":0,"skipped":2}'::jsonb,'holiday preview: 1 create, out-of-year and invalid skipped');
reset role;
select is((select count(*)::int from gina.education_holidays),0,'preview wrote nothing');
set local role authenticated;
select pg_temp.as_admin();
select is(public.admin_import_education_holidays('53000000-0000-4000-8000-000000011701',pg_temp.hseed(),true)->'counts'->>'create','1','holiday import creates a draft');
select is(public.admin_import_education_holidays('53000000-0000-4000-8000-000000011701',pg_temp.hseed(),true)->'counts'->>'create','1','same request replays');
select is(public.admin_import_education_holidays(gen_random_uuid(),pg_temp.hseed(),true)->'counts'->>'exists','1','new request is idempotent');
reset role;
select is((select status from gina.education_holidays where seed_key='h-c11'),'draft','imported holiday is a draft');
create function pg_temp.hid() returns uuid language sql security definer as $$select id from gina.education_holidays where seed_key='h-c11'$$;

-- ===========================================================================
-- 4) Tatil önerisi
-- ===========================================================================
set local role authenticated;
select pg_temp.as_parent();
select lives_ok($$select public.save_school_timetable_request(gen_random_uuid(),pg_temp.ch(),0,(select jsonb_agg(jsonb_build_object('id','l'||d,'day',d,'title','MAT','start','09:00','end','09:40')) from generate_series(1,5) d),'{"start":"09:00","duration":40,"break":10}')$$,'weekday lessons saved');
select is(jsonb_array_length(public.education_holiday_suggestions(pg_temp.ch())->'items'),0,'no location: no suggestion');
select is(public.education_holiday_suggestions(pg_temp.ch())->>'has_location','false','no location reported');
reset role;
insert into gina.child_education_locations(child_id,place_id,stage) values(pg_temp.ch(),'ec000000-0000-4000-8000-000000011702','primary');
set local role authenticated;
select pg_temp.as_parent();
create temp table sug as select public.education_holiday_suggestions(pg_temp.ch()) j;
select is((select jsonb_agg(x->>'kind') from sug,jsonb_array_elements(j->'items') x),'["break"]'::jsonb,'only the published calendar break is suggested; draft holiday is not');
select is((select (x->>'starts_on')::date from sug,jsonb_array_elements(j->'items') x),pg_temp.wd(),'break window starts after the first term part');
select is((select (x->>'lesson_days')::int from sug,jsonb_array_elements(j->'items') x),5,'five weekday lesson days affected');
select is((select x->>'decision' from sug,jsonb_array_elements(j->'items') x),null,'no decision yet');
create function pg_temp.bkey() returns text language sql security definer as $$select 'b:ca000000-0000-4000-8000-000000011702:'||pg_temp.wd()$$;
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'holiday'->>'decision'),null,'plan shows the break without decision');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'timetable'->'day_lessons'),1,'lesson visible before acceptance');
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),'b:nope','accept',0)$$,'P0001','holiday_unknown','unknown window rejected');
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'accept',3)$$,'P0001','holiday_changed','stale revision rejected');
select is(public.decide_education_holiday('54000000-0000-4000-8000-000000011701',pg_temp.ch(),pg_temp.bkey(),'accept',0)->>'decision','accepted','parent accepts the break suggestion');
select is(public.decide_education_holiday('54000000-0000-4000-8000-000000011701',pg_temp.ch(),pg_temp.bkey(),'accept',0)->>'revision','1','replay returns same result');
select pg_temp.as_parent_b();
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'dismiss',0)$$,'P0001','holiday_changed','second parent with stale view gets a conflict');
select pg_temp.as_parent();
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'holiday'->>'decision'),'accepted','plan carries the accepted holiday');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'timetable'->'day_lessons'->0->>'paused'),'true','lesson is marked paused, not removed');
select is(jsonb_array_length(public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'timetable'->'day_lessons'),1,'lesson row kept');
select is(jsonb_array_length(public.plan_for_days(pg_temp.ch(),pg_temp.wd(),pg_temp.wd()+6)),7,'plan_for_days uses the same contract');
select is((public.plan_for_days(pg_temp.ch(),pg_temp.wd(),pg_temp.wd())->0->'holiday'->>'decision'),'accepted','plan_for_days carries the holiday');
select is(public.plan_for_day(pg_temp.sib(),pg_temp.wd())->'holiday','null'::jsonb,'sibling without location gets no holiday');
reset role;
select is((select jsonb_array_length(lessons) from public.school_timetables where child_id=pg_temp.ch()),5,'timetable rows unchanged by acceptance');
select is((select grade::int from public.children where id=pg_temp.ch()),4,'no grade promotion');
set local role authenticated;
select pg_temp.as_device();
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'holiday'->>'decision'),'accepted','child device reads the same mark');
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'undo',1)$$,'42501','education_forbidden','device cannot decide');
select throws_ok($$select public.education_holiday_suggestions(pg_temp.ch())$$,'42501','education_forbidden','device cannot list suggestions');
select pg_temp.as_other();
select throws_ok($$select public.education_holiday_suggestions(pg_temp.ch())$$,'42501','education_forbidden','other family cannot list');
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'undo',1)$$,'42501','education_forbidden','other family cannot decide');
select pg_temp.as_parent();
select is(public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'undo',1)->>'revision','0','undo clears the decision');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd())->'timetable'->'day_lessons'->0->>'paused'),null,'undo removes the pause mark');
select throws_ok($$select public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),pg_temp.bkey(),'undo',0)$$,'P0001','holiday_changed','undo without decision is a conflict');
-- Yayımlanan resmî tatil öneriye girer; geri çekilince çıkar.
select pg_temp.as_admin();
select is(public.admin_set_education_holiday_status(gen_random_uuid(),pg_temp.hid(),1,'published')->>'status','published','holiday published separately');
select throws_ok($$select public.admin_set_education_holiday_status(gen_random_uuid(),pg_temp.hid(),1,'withdrawn')$$,'P0001','calendar_changed','stale holiday revision rejected');
select pg_temp.as_parent();
select is((select count(*)::int from jsonb_array_elements(public.education_holiday_suggestions(pg_temp.ch())->'items') x where x->>'kind'='public_holiday'),1,'published public holiday suggested');
select is(public.decide_education_holiday(gen_random_uuid(),pg_temp.ch(),'h:'||pg_temp.hid(),'dismiss',0)->>'decision','dismissed','parent dismisses the holiday suggestion');
select is((public.plan_for_day(pg_temp.ch(),pg_temp.wd()+7)->'timetable'->'day_lessons'->0->>'paused'),null,'dismissed holiday pauses nothing');
select pg_temp.as_admin();
select lives_ok($$select public.admin_set_education_holiday_status(gen_random_uuid(),pg_temp.hid(),2,'withdrawn')$$,'holiday withdrawn');
select pg_temp.as_parent();
select is((select count(*)::int from jsonb_array_elements(public.education_holiday_suggestions(pg_temp.ch())->'items') x where x->>'kind'='public_holiday'),0,'withdrawn holiday no longer suggested');
select is(public.plan_for_day(pg_temp.ch(),pg_temp.wd()+7)->'holiday','null'::jsonb,'withdrawn holiday leaves no plan mark');
reset role;
select is((select count(*)::int from gina.child_holiday_decision_changes where child_id=pg_temp.ch()),3,'decision history: accept, undo, dismiss');

-- ===========================================================================
-- 5) Planlı geçiş + takvim gerekçesi
-- ===========================================================================
insert into gina.child_education_state(child_id) values(pg_temp.ch()),(pg_temp.sib()) on conflict do nothing;
insert into gina.child_education_periods(child_id,family_id,academic_year,grade,school,starts_on,reason)
 values(pg_temp.ch(),pg_temp.fam(),pg_temp.yr()-1,3,'C11 Okulu',pg_temp.t()-400,'initial'),(pg_temp.sib(),pg_temp.fam(),pg_temp.yr()-1,3,null,pg_temp.t()-400,'initial');
create function pg_temp.rev(uuid) returns int language sql security definer as $$select revision from gina.child_education_state where child_id=$1$$;
set local role authenticated;
select pg_temp.as_parent();
select throws_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'C11 Okulu',pg_temp.wd(),true)$$,'P0001','calendar_review_required','managed location cannot schedule without calendar context');
-- wd() ara tatilde: outside_term uyarısı → gerekçe zorunlu.
select throws_ok($$select public.schedule_child_education_change_with_calendar(gen_random_uuid(),pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'C11 Okulu',pg_temp.wd(),true,'ec000000-0000-4000-8000-000000011702','primary','ca000000-0000-4000-8000-000000011702',2,null,null)$$,'P0001','calendar_reason_required','date in a break needs a reason');
select throws_ok($$select public.schedule_child_education_change_with_calendar(gen_random_uuid(),pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'C11 Okulu',pg_temp.wd(),true,'ec000000-0000-4000-8000-000000011702','primary','ca000000-0000-4000-8000-000000011702',2,'school_calendar','kısa')$$,'P0001','calendar_detail_required','school calendar reason needs detail');
select throws_ok($$select public.schedule_child_education_change_with_calendar(gen_random_uuid(),pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'C11 Okulu',pg_temp.wd(),true,'ec000000-0000-4000-8000-000000011702','primary','ca000000-0000-4000-8000-000000011702',1,'personal',null)$$,'P0001','calendar_changed','stale calendar revision rejected');
select throws_ok($$select public.schedule_child_education_change_with_calendar(gen_random_uuid(),pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'Başka Okul',pg_temp.wd(),true,'ec000000-0000-4000-8000-000000011702','primary','ca000000-0000-4000-8000-000000011702',2,'personal',null)$$,'P0001','calendar_school_mismatch','school place must match the school name');
select is(public.schedule_child_education_change_with_calendar('55000000-0000-4000-8000-000000011701',pg_temp.ch(),pg_temp.rev(pg_temp.ch()),'new_year',pg_temp.yr(),4,'C11 Okulu',pg_temp.wd(),true,'ec000000-0000-4000-8000-000000011702','primary','ca000000-0000-4000-8000-000000011702',2,'school_calendar','Okulumuz ara tatilden önce yeni yıla geçiyor')->>'warning','outside_term','scheduled with reason; warning echoed');
reset role;
select is((select calendar_reason||':'||place_id from gina.child_education_schedules where child_id=pg_temp.ch() and status='scheduled'),'school_calendar:ec000000-0000-4000-8000-000000011702','reason stored with the plan');
select is((select count(*)::int from gina.education_calendar_reports where child_id=pg_temp.ch()),0,'no report before the plan is applied');
set local role authenticated;
select pg_temp.as_parent();
select is(public.apply_due_education_changes(pg_temp.ch())->>'applied','false','not applied before its day');
reset role;
update gina.child_education_schedules set starts_on=pg_temp.t() where child_id=pg_temp.ch() and status='scheduled';
set local role authenticated;
select pg_temp.as_parent();
select is(public.apply_due_education_changes(pg_temp.ch())->>'applied','true','applied on its day');
select is(public.apply_due_education_changes(pg_temp.ch())->>'applied','false','second apply is empty');
reset role;
select is((select reason||':'||status||':'||proposed_start from gina.education_calendar_reports where child_id=pg_temp.ch()),'school_calendar:open:'||pg_temp.t(),'school exception report written once on apply');
select is((select place_id from gina.child_education_locations where child_id=pg_temp.ch()),'ec000000-0000-4000-8000-000000011702'::uuid,'location kept');
select is((select academic_year from gina.child_education_periods where child_id=pg_temp.ch() and ends_on is null),pg_temp.yr(),'new period open');
-- Konumu olmayan çocuk eski yolla planlayabilir; iptal edilen plan bildirim yazmaz.
set local role authenticated;
select pg_temp.as_parent();
select lives_ok($$select public.schedule_child_education_change(gen_random_uuid(),pg_temp.sib(),pg_temp.rev(pg_temp.sib()),'new_year',pg_temp.yr(),4,null,pg_temp.wd(),true)$$,'unmanaged child still schedules with the old signature');

-- ===========================================================================
-- 6) Dönem hatırlatması
-- ===========================================================================
reset role;
update gina.education_notification_settings set reminders_enabled=true;
insert into gina.child_education_locations(child_id,place_id,stage) values(pg_temp.sib(),pg_temp.country(),'primary');
-- Kardeşin planlı geçişi var → yıl başı hatırlatması yok. Ülke takvimi başlangıcı (t-30) +7 penceresi dışında olabilir;
-- pencereyi bugüne çekmek için ülke takviminin yayımlanmış başlangıcını bugüne alıyoruz (yalnız bu işlem içinde).
update gina.education_calendars set published=jsonb_set(jsonb_set(published,'{starts_on}',to_jsonb(pg_temp.t()-2)),'{terms,0,starts_on}',to_jsonb(pg_temp.t()-2)) where id='ca000000-0000-4000-8000-000000011701';
select is(gina.enqueue_education_reminders(),0,'scheduled transition suppresses the reminder');
update gina.child_education_schedules set status='cancelled',cancelled_at=now() where child_id=pg_temp.sib() and status='scheduled';
select is(gina.enqueue_education_reminders(),2,'after cancel: one reminder per parent (2 parents)');
select is(gina.enqueue_education_reminders(),0,'second run sends nothing (once per parent/child/year/kind)');
select is((select count(*)::int from gina.parent_inbox where child_id=pg_temp.sib() and kind='education_start'),2,'two inbox rows');
select ok((select bool_and(gina.inbox_push_current(i.id::text,i.user_id,i.family_id)) from gina.parent_inbox i where i.child_id=pg_temp.sib()),'pending reminders are current');
insert into gina.child_education_schedules(child_id,family_id,action,academic_year,grade,starts_on,keep_timetable)
 values(pg_temp.sib(),pg_temp.fam(),'new_year',pg_temp.yr(),4,pg_temp.t()+3,true);
select ok((select not bool_or(gina.inbox_push_current(i.id::text,i.user_id,i.family_id)) from gina.parent_inbox i where i.child_id=pg_temp.sib()),'a new plan makes queued reminders stale at delivery');
select is(gina.enqueue_education_reminders(),0,'no new reminder while a plan is open');

-- ===========================================================================
-- 7) Okul istisna özeti ve velinin kendi bildirimleri
-- ===========================================================================
set local role authenticated;
select pg_temp.as_admin();
select ok((select bool_or(x->>'reason'='school_calendar' and (x->>'open')::int=1 and not x ? 'family_id' and not x ? 'child_id') from jsonb_array_elements(public.admin_education_report_summary()) x),'summary counts without family or child ids');
select pg_temp.as_parent();
select is((public.child_education_reports(pg_temp.ch())->0->>'status'),'open','parent sees own report status');
select throws_ok($$select public.admin_education_report_summary()$$,'42501','forbidden','parent cannot read the summary');
select pg_temp.as_other();
select throws_ok($$select public.child_education_reports(pg_temp.ch())$$,'42501','education_forbidden','other family cannot read reports');

-- ===========================================================================
-- 8) Mağaza: istemci paket seçimi kalıcı ücretli hak üretmez
-- ===========================================================================
select pg_temp.as_parent();
select is((select plan::text||':'||source from public.get_family_entitlement()),'free:free','family starts free');
select throws_ok($$select public.set_beta_test_plan('pro')$$,'42501','beta_access_required','plan selection without granted beta access is refused');
select throws_ok($$insert into public.store_subscriptions(family_id,platform,product_id,plan,store_key,expires_at) values(pg_temp.fam(),'apple','gina_pro_yearly','pro','client-made-key',now()+interval '1 year')$$,'42501',null,'client cannot write a store subscription');
select throws_ok($$insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values(pg_temp.fam(),'pro','client',now()+interval '1 year')$$,'42501',null,'client cannot write an override');
select throws_ok($$select public.apply_verified_store_state('{}'::jsonb,pg_temp.fam(),'00000000-0000-4000-8000-000000011702')$$,'42501',null,'client cannot call the verified-state writer');
select throws_ok($$insert into public.beta_plan_selections(family_id,selected_by,plan) values(pg_temp.fam(),'00000000-0000-4000-8000-000000011702','pro')$$,'42501',null,'client cannot write a beta selection row');
select is((select plan::text from public.get_family_entitlement()),'free','still free after all client attempts');
-- Bireysel, süreli beta erişimi verilmişse seçim yalnız o süre için geçerlidir; kalıcı hak değildir.
reset role;
insert into public.beta_test_access(user_id,family_id,expires_at,reason) values('00000000-0000-4000-8000-000000011702',pg_temp.fam(),now()+interval '1 hour','C11 sentetik beta');
set local role authenticated;
select pg_temp.as_parent();
select lives_ok($$select public.set_beta_test_plan('pro')$$,'granted beta tester selects a plan');
select is((select plan::text||':'||source||':'||(expires_at<=now()+interval '1 hour')::text from public.get_family_entitlement()),'pro:beta:true','selection is time-boxed beta, not store/paid');
reset role;
update public.beta_test_access set expires_at=now()-interval '1 second' where family_id=pg_temp.fam();
set local role authenticated;
select pg_temp.as_parent();
select is((select plan::text from public.get_family_entitlement()),'free','expired beta access: selection grants nothing');
reset role;
select is((select count(*)::int from public.store_subscriptions where family_id=pg_temp.fam()),0,'no store row was created by any client action');

-- Yetki yüzeyi
select ok(not has_function_privilege('anon','public.education_holiday_suggestions(uuid)','execute'),'anon cannot list suggestions');
select ok(not has_function_privilege('anon','public.admin_save_subject_synonym(uuid,text,text,text,int,int,jsonb,int,text)','execute'),'anon cannot edit synonyms');
select ok(not has_function_privilege('authenticated','gina.child_holiday_windows(uuid,date,date)','execute'),'window helper closed');
select ok(not has_function_privilege('authenticated','gina.plan_for_day_dated(uuid,date)','execute'),'renamed inner plan closed');
select ok(not has_function_privilege('authenticated','gina.schedule_child_education_change_base(uuid,uuid,integer,text,integer,integer,text,date,boolean)','execute'),'renamed inner schedule closed');
select ok(not has_table_privilege('authenticated','gina.education_holidays','select'),'holiday table closed');
select ok(not has_table_privilege('authenticated','gina.child_holiday_decisions','select'),'decision table closed');
select * from finish();rollback;
