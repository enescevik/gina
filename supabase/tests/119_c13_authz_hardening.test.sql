-- C13: C01–C11 uçlarının bütünleşik yetki matrisi + 20261106330000_c13_hardening.
-- Personalar: A velisi, B velisi, sahte A claim'li B velisi, A çocuğu 1 cihazı, kardeş (çocuk 2) cihazı,
-- kardeş cihazı + sahte çocuk claim'i, iptal edilmiş cihaz, B cihazı, dar operatör rolleri (destek/içerik/finans/
-- yayın), süresi dolmuş ve geri alınmış operatör rolü, sahte admin claim'i, tam admin. Claim tek başına yetmez:
-- üyelik, cihaz ataması, operations_members ve admins satırı her istekte yeniden okunur.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('c1190000-0000-4000-8000-0000000000a1','c119-a1@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000b1','c119-b1@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000d1',null,true),
 ('c1190000-0000-4000-8000-0000000000d2',null,true),
 ('c1190000-0000-4000-8000-0000000000d3',null,true),
 ('c1190000-0000-4000-8000-0000000000e1','c119-support@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e2','c119-content@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e3','c119-finance@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e4','c119-release@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e5','c119-admin@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e6','c119-expired@example.invalid',false),
 ('c1190000-0000-4000-8000-0000000000e7','c119-revoked@example.invalid',false);
insert into public.families(id,name,created_by) values
 ('c1190000-0000-4000-8000-0000000000f1','C119 A','c1190000-0000-4000-8000-0000000000a1'),
 ('c1190000-0000-4000-8000-0000000000f2','C119 B','c1190000-0000-4000-8000-0000000000b1');
insert into public.family_members(family_id,user_id) values
 ('c1190000-0000-4000-8000-0000000000f1','c1190000-0000-4000-8000-0000000000a1'),
 ('c1190000-0000-4000-8000-0000000000f2','c1190000-0000-4000-8000-0000000000b1');
insert into public.children(id,family_id,name,grade) values
 ('c1190000-0000-4000-8000-0000000000c1','c1190000-0000-4000-8000-0000000000f1','A one',5),
 ('c1190000-0000-4000-8000-0000000000c2','c1190000-0000-4000-8000-0000000000f1','A two',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id,access_mode,revoked_at) values
 ('c1190000-0000-4000-8000-0000000001d1','c1190000-0000-4000-8000-0000000000f1','c1190000-0000-4000-8000-0000000000d1','c1190000-0000-4000-8000-0000000000c1','selected',null),
 ('c1190000-0000-4000-8000-0000000001d2','c1190000-0000-4000-8000-0000000000f1','c1190000-0000-4000-8000-0000000000d2','c1190000-0000-4000-8000-0000000000c2','selected',null),
 ('c1190000-0000-4000-8000-0000000001d3','c1190000-0000-4000-8000-0000000000f1','c1190000-0000-4000-8000-0000000000d3','c1190000-0000-4000-8000-0000000000c1','selected',now());
insert into public.device_children(device_id,child_id) values
 ('c1190000-0000-4000-8000-0000000001d1','c1190000-0000-4000-8000-0000000000c1'),
 ('c1190000-0000-4000-8000-0000000001d2','c1190000-0000-4000-8000-0000000000c2'),
 ('c1190000-0000-4000-8000-0000000001d3','c1190000-0000-4000-8000-0000000000c1');
insert into public.admins(user_id) values('c1190000-0000-4000-8000-0000000000e5');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('c1190000-0000-4000-8000-0000000000e1','support',now()+interval '1 day',null),
 ('c1190000-0000-4000-8000-0000000000e2','content',now()+interval '1 day',null),
 ('c1190000-0000-4000-8000-0000000000e3','finance',now()+interval '1 day',null),
 ('c1190000-0000-4000-8000-0000000000e4','release',now()+interval '1 day',null),
 ('c1190000-0000-4000-8000-0000000000e6','content',now()-interval '1 minute',null),
 ('c1190000-0000-4000-8000-0000000000e7','support',now()+interval '1 day',now());
insert into public.task_templates(id,family_id,child_id,title,stars) values
 ('c1190000-0000-4000-8000-0000000000b1','c1190000-0000-4000-8000-0000000000f1','c1190000-0000-4000-8000-0000000000c1','A one task',2);
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key) values
 ('c1190000-0000-4000-8000-0000000001a1','c1190000-0000-4000-8000-0000000000f1',5,'math','family topic','multiple_choice','family-private stem','[{"key":"A","text":"1"},{"key":"B","text":"2"}]','A'),
 ('c1190000-0000-4000-8000-0000000001a2',null,5,'math','global topic','multiple_choice','global stem','[{"key":"A","text":"1"},{"key":"B","text":"2"}]','A');

create function pg_temp.actor(p text) returns text language sql as $$
 select set_config('request.jwt.claims', case p
  when 'a' then '{"sub":"c1190000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"parent"}}'
  when 'b' then '{"sub":"c1190000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f2","role":"parent"}}'
  when 'b_forged' then '{"sub":"c1190000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"parent"}}'
  when 'dev1' then '{"sub":"c1190000-0000-4000-8000-0000000000d1","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"device","device_id":"c1190000-0000-4000-8000-0000000001d1","child_id":"c1190000-0000-4000-8000-0000000000c1"}}'
  when 'sibling' then '{"sub":"c1190000-0000-4000-8000-0000000000d2","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"device","device_id":"c1190000-0000-4000-8000-0000000001d2","child_id":"c1190000-0000-4000-8000-0000000000c2"}}'
  when 'sibling_forged' then '{"sub":"c1190000-0000-4000-8000-0000000000d2","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"device","device_id":"c1190000-0000-4000-8000-0000000001d2","child_id":"c1190000-0000-4000-8000-0000000000c1"}}'
  when 'revoked' then '{"sub":"c1190000-0000-4000-8000-0000000000d3","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f1","role":"device","device_id":"c1190000-0000-4000-8000-0000000001d3","child_id":"c1190000-0000-4000-8000-0000000000c1"}}'
  when 'support' then '{"sub":"c1190000-0000-4000-8000-0000000000e1","role":"authenticated","gina":{"role":"none"}}'
  when 'content' then '{"sub":"c1190000-0000-4000-8000-0000000000e2","role":"authenticated","gina":{"role":"none"}}'
  when 'finance' then '{"sub":"c1190000-0000-4000-8000-0000000000e3","role":"authenticated","gina":{"role":"none"}}'
  when 'release' then '{"sub":"c1190000-0000-4000-8000-0000000000e4","role":"authenticated","gina":{"role":"none"}}'
  when 'expired' then '{"sub":"c1190000-0000-4000-8000-0000000000e6","role":"authenticated","gina":{"role":"none"}}'
  when 'revoked_op' then '{"sub":"c1190000-0000-4000-8000-0000000000e7","role":"authenticated","gina":{"role":"none"}}'
  when 'admin_forged' then '{"sub":"c1190000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c1190000-0000-4000-8000-0000000000f2","role":"parent","admin":true}}'
  when 'admin' then '{"sub":"c1190000-0000-4000-8000-0000000000e5","role":"authenticated","gina":{"role":"none","admin":true}}'
 end, true) $$;

-- 0. Katalog bekçileri (yeni uçlar eklendikçe düşer).
select is((select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','gina') and p.prokind='f' and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'execute')),
  'get_shared_child_view,unsubscribe_with_token','anon yalnız paylaşım görünümü ve imzalı vazgeçmeyi çalıştırır');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','gina') and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')),
  0,'her security definer fonksiyonun search_path değeri sabit');
select is((select string_agg(x, ',' order by x) from unnest(array[
  'public.reserve_ai_operation(uuid,uuid,text,text,uuid,text)','public.reserve_weekly_summary(uuid,uuid,uuid,uuid,text)',
  'public.reserve_learning_plan_import(uuid,uuid,uuid,uuid,text)','public.channel_claim(integer)','public.channel_one_click_unsubscribe(text)',
  'public.get_curriculum_source_target(text,text,integer)','public.record_scenario_question_fit_suggestion(uuid,jsonb)',
  'public.content_prereview_claim(text,uuid,uuid,text)','public.content_prereview_finish(text,uuid,uuid,text,jsonb,text)',
  'gina.ai_family_provider(uuid)','gina.ai_provider_outcome(text,boolean,text,boolean)']) x
  where has_function_privilege('authenticated', x::regprocedure, 'execute') or has_function_privilege('anon', x::regprocedure, 'execute')),
  null,'servis rolüne ayrılmış C08/C09/C10 fonksiyonları authenticated/anon tarafından çağrılamaz');
select ok((select bool_and(has_function_privilege('service_role', x::regprocedure, 'execute')) from unnest(array[
  'public.reserve_ai_operation(uuid,uuid,text,text,uuid,text)','public.channel_claim(integer)','public.content_prereview_claim(text,uuid,uuid,text)']) x),
  'servis rolü kendi fonksiyonlarını çağırabilir');
select is((select count(*)::int from pg_policies p where p.schemaname in ('public','gina','storage')
  and (coalesce(p.qual,'')||' '||coalesce(p.with_check,'')) ~ '(?<!SELECT )(gina\.(is_parent|is_device|family_id|child_id|is_admin|is_admin_strict|claims|role)|auth\.uid)\(\)'),
  0,'hiçbir politika yardımcıyı satır başına çıplak çağırmaz (InitPlan, C01–C11 dahil)');

set local role authenticated;
-- 1. plan_for_days / plan_for_day / routines_for_day (C02 + C13 performans gövdesi).
select pg_temp.actor('a');
select is(jsonb_array_length(public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+41)),42,'veli 42 günlük planı okur');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+42)$$,'P0001','plan_day_invalid','43 gün reddedilir');
select is(jsonb_array_length(public.routines_for_day('c1190000-0000-4000-8000-0000000000c1',current_date)->'routines'),1,'veli rutin listesini okur');
select pg_temp.actor('dev1');
select is(jsonb_array_length(public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)),7,'çocuğun kendi cihazı haftayı okur');
select is(public.routines_for_day('c1190000-0000-4000-8000-0000000000c1',current_date)->'routines'->0->>'id','c1190000-0000-4000-8000-0000000000b1','cihaz kendi rutinini görür');
select pg_temp.actor('sibling');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'kardeş cihazı diğer çocuğun haftasını okuyamaz');
select throws_ok($$select public.routines_for_day('c1190000-0000-4000-8000-0000000000c1',current_date)$$,'42501',null,'kardeş cihazı diğer çocuğun rutinlerini okuyamaz');
select pg_temp.actor('sibling_forged');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'kardeş cihazı sahte child_id claim ile okuyamaz');
select pg_temp.actor('revoked');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'iptal edilmiş cihaz eski jetonla okuyamaz');
select pg_temp.actor('b');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'başka aile velisi okuyamaz');
select throws_ok($$select public.routines_for_day('c1190000-0000-4000-8000-0000000000c1',current_date)$$,'42501',null,'başka aile rutinleri okuyamaz');
select pg_temp.actor('b_forged');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'üyeliksiz sahte aile claim okuyamaz');
select pg_temp.actor('admin');
select throws_ok($$select public.plan_for_days('c1190000-0000-4000-8000-0000000000c1',current_date,current_date+6)$$,'42501',null,'tam admin aile planını okuyamaz');

-- 2. Ders bağlantıları (C02), eğitim değişimi/tatil önerileri (C02/C11), AI notu kabulü/kullanım (C08), haftalık inceleme (C04).
select pg_temp.actor('b');
select throws_ok($$select public.child_subject_links('c1190000-0000-4000-8000-0000000000c1')$$,'42501',null,'yabancı veli ders bağlantılarını okuyamaz');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),'c1190000-0000-4000-8000-0000000000c1','[]','manual')$$,'42501',null,'yabancı veli ders bağlantısı yazamaz');
select throws_ok($$select public.education_change_state('c1190000-0000-4000-8000-0000000000c1')$$,'42501',null,'yabancı veli eğitim değişim durumunu okuyamaz');
select throws_ok($$select public.education_holiday_suggestions('c1190000-0000-4000-8000-0000000000c1')$$,'42501',null,'yabancı veli tatil önerisi okuyamaz');
select throws_ok($$select public.accept_ai_grade(gen_random_uuid(),gen_random_uuid(),1::smallint)$$,null,null,'yabancı/olmayan deneme AI notu kabul edilemez');
select pg_temp.actor('sibling');
select throws_ok($$select public.child_subject_links('c1190000-0000-4000-8000-0000000000c1')$$,'42501',null,'kardeş cihazı diğer çocuğun ders bağlantılarını okuyamaz');
select pg_temp.actor('dev1');
select throws_ok($$select public.set_child_subject_links(gen_random_uuid(),'c1190000-0000-4000-8000-0000000000c1','[]','manual')$$,'42501',null,'çocuk cihazı ders bağlantısı yazamaz');
select throws_ok($$select public.accept_ai_grade(gen_random_uuid(),gen_random_uuid(),1::smallint)$$,'42501',null,'çocuk cihazı AI notunu kabul edemez');
select throws_ok($$select public.get_ai_usage()$$,'42501',null,'çocuk cihazı AI kullanımını okuyamaz');
select throws_ok($$select public.weekly_review_children(current_date)$$,'42501',null,'çocuk cihazı haftalık incelemeyi okuyamaz');
select throws_ok($$select public.my_notification_channels()$$,'42501',null,'çocuk cihazı veli bildirim kanallarını okuyamaz');
select throws_ok($$select public.preview_device_pairing('123456')$$,'42501',null,'çocuk cihazı eşleme önizlemesi yapamaz');
select pg_temp.actor('revoked');
select throws_ok($$select public.child_subject_links('c1190000-0000-4000-8000-0000000000c1')$$,'42501',null,'iptal edilmiş cihaz ders bağlantısı okuyamaz');

-- 3. Eski açık-soru düzeltmesi (C01): yalnız kendi ailesi veya tam admin.
select pg_temp.actor('b');
select throws_ok($$select public.preview_legacy_open_zero_corrections('c1190000-0000-4000-8000-0000000000f1')$$,'42501',null,'yabancı veli A ailesinin düzeltme önizlemesini açamaz');
select throws_ok($$select public.apply_legacy_open_zero_corrections(gen_random_uuid(),array[]::uuid[],'c1190000-0000-4000-8000-0000000000f1')$$,'42501',null,'yabancı veli A ailesine düzeltme uygulayamaz');
select pg_temp.actor('support');
select throws_ok($$select public.preview_legacy_open_zero_corrections('c1190000-0000-4000-8000-0000000000f1')$$,'42501',null,'destek rolü düzeltme önizlemesi açamaz (yalnız tam admin)');
select pg_temp.actor('admin_forged');
select throws_ok($$select public.preview_legacy_open_zero_corrections('c1190000-0000-4000-8000-0000000000f1')$$,'42501',null,'admins satırı olmayan sahte admin claim reddedilir');

-- 4. Dar operatör rolleri (C07/C09/C10/C11).
select pg_temp.actor('content');
select lives_ok($$select public.admin_library_content_page(null,null,null,null,20)$$,'içerik rolü kütüphane içerik listesini okur');
select lives_ok($$select public.operator_prereview_notices(false,20)$$,'içerik rolü ön inceleme bildirimlerini okur');
select lives_ok($$select public.admin_subject_synonyms()$$,'içerik rolü eş anlamlı ders listesini okur');
select throws_ok($$select public.support_canned_replies('tr',null,false)$$,null,null,'içerik rolü destek hazır cevaplarını okuyamaz');
select throws_ok($$select public.list_help_attachments(gen_random_uuid())$$,null,null,'içerik rolü destek eklerini listeleyemez');
select throws_ok($$select public.admin_announcement_push_audience(gen_random_uuid(),1)$$,null,null,'içerik rolü duyuru push kitlesini göremez (yayın rolü)');
select throws_ok($$select public.release_channel_failures(10)$$,null,null,'içerik rolü kanal hatalarını yeniden kuyruğa alamaz');
select throws_ok($$select public.admin_curriculum_pipeline()$$,null,null,'içerik rolü müfredat hattı özetini açamaz (tam admin)');
select pg_temp.actor('support');
select lives_ok($$select public.support_canned_replies('tr',null,false)$$,'destek rolü hazır cevapları okur');
select throws_ok($$select public.admin_library_content_page(null,null,null,null,20)$$,null,null,'destek rolü kütüphane içeriğini okuyamaz');
select throws_ok($$select public.operator_prereview_notices(false,20)$$,null,null,'destek rolü ön inceleme bildirimlerini okuyamaz');
select throws_ok($$select public.admin_subject_synonyms()$$,null,null,'destek rolü ders eş anlamlılarını okuyamaz');
select throws_ok($$select public.admin_education_holidays(null)$$,null,null,'destek rolü tatil yönetimini açamaz');
select pg_temp.actor('finance');
select throws_ok($$select public.admin_library_content_page(null,null,null,null,20)$$,null,null,'finans rolü kütüphane içeriğini okuyamaz');
select throws_ok($$select public.support_canned_replies('tr',null,false)$$,null,null,'finans rolü destek cevaplarını okuyamaz');
select throws_ok($$select public.release_channel_failures(10)$$,null,null,'finans rolü kanal işlemlerine erişemez');
select pg_temp.actor('release');
select lives_ok($$select public.release_channel_failures(10)$$,'yayın rolü kanal hatalarını yönetir');
select throws_ok($$select public.support_canned_replies('tr',null,false)$$,null,null,'yayın rolü destek cevaplarını okuyamaz');
select throws_ok($$select public.operator_prereview_notices(false,20)$$,null,null,'yayın rolü içerik bildirimlerini okuyamaz');
select pg_temp.actor('expired');
select throws_ok($$select public.admin_library_content_page(null,null,null,null,20)$$,null,null,'süresi dolmuş içerik rolü reddedilir');
select pg_temp.actor('revoked_op');
select throws_ok($$select public.support_canned_replies('tr',null,false)$$,null,null,'geri alınmış destek rolü reddedilir');
select pg_temp.actor('admin_forged');
select throws_ok($$select public.admin_library_content_page(null,null,null,null,20)$$,null,null,'sahte admin claim içerik listesini açamaz');
select pg_temp.actor('admin');
select lives_ok($$select public.admin_curriculum_pipeline()$$,'tam admin müfredat hattını açar');

-- 5. C13-AUTH-2: tam admin aileye özel soruları REST'ten okuyamaz/yazamaz; global bankayı yönetmeye devam eder.
select pg_temp.actor('admin');
select is((select count(*)::int from public.question_bank where id='c1190000-0000-4000-8000-0000000001a1'),0,'tam admin aile sorusunu okuyamaz');
select is((select count(*)::int from public.question_bank where id='c1190000-0000-4000-8000-0000000001a2'),1,'tam admin global soruyu okur');
update public.question_bank set topic='admin edit' where id in ('c1190000-0000-4000-8000-0000000001a1','c1190000-0000-4000-8000-0000000001a2');
select throws_ok($$insert into public.question_bank(family_id,grade,subject,topic,kind,stem,choices,correct_key) values('c1190000-0000-4000-8000-0000000000f2',5,'math','t','multiple_choice','s','[{"key":"A","text":"1"}]','A')$$,'42501',null,'tam admin bir aileye soru ekleyemez');
select pg_temp.actor('a');
select is((select count(*)::int from public.question_bank where id='c1190000-0000-4000-8000-0000000001a1'),1,'veli kendi aile sorusunu okumaya devam eder');
select pg_temp.actor('b');
select is((select count(*)::int from public.question_bank where id='c1190000-0000-4000-8000-0000000001a1'),0,'başka aile velisi aile sorusunu okuyamaz');

reset role;
select is((select topic from public.question_bank where id='c1190000-0000-4000-8000-0000000001a1'),'family topic','tam admin aile sorusunu güncelleyemedi');
select is((select topic from public.question_bank where id='c1190000-0000-4000-8000-0000000001a2'),'admin edit','tam admin global soruyu güncelledi');
-- 6. C13-PERF-1: plan_version_on anlamı (kenar durumları; tam eşdeğerlik perf/ kanıtında).
select is(gina.plan_version_on('[]'::jsonb,current_date),null,'boş geçmiş null');
select is(gina.plan_version_on(null,current_date),null,'null geçmiş null');
select is(gina.plan_version_on('[{"revision":1,"effective_from":"2026-01-01"},{"revision":2,"effective_from":"2026-03-01"}]','2026-02-01')->>'revision','1','gün öncesindeki en son sürüm');
select is(gina.plan_version_on('[{"revision":1,"effective_from":"2026-01-01"},{"revision":2,"effective_from":"2026-03-01"}]','2026-03-01')->>'revision','2','aynı gün başlayan sürüm geçerli');
select is(gina.plan_version_on('[{"revision":1,"effective_from":"2026-01-01"},{"revision":2,"effective_from":"2026-01-01"}]','2026-02-01')->>'revision','2','aynı günde yüksek revizyon kazanır');
select is(gina.plan_version_on('[{"revision":3,"effective_from":"2026-05-01"},{"revision":2,"effective_from":"2026-04-01"}]','2026-02-01'),
  '{"revision":2,"effective_from":"2026-04-01","status":"unknown_before","unknown_before":"2026-04-01"}'::jsonb,'ilk sürümden önce: en erken sürüm, unknown_before');
select is(gina.plan_version_on('[{"revision":null},{"revision":4,"effective_from":"2026-04-01"}]','2026-02-01'),
  '{"revision":null,"status":"unknown_before","unknown_before":"2026-04-01"}'::jsonb,'başlangıcı bilinmeyen sürüm: unknown_before = ilk bilinen başlangıç');
select is(gina.plan_version_on('[{"revision":null},{"revision":4,"effective_from":"2026-04-01"}]','2026-05-01')->>'status','known','bilinen sürüm sonrası known');
select ok(not has_function_privilege('authenticated','gina.plan_version_on(jsonb,date)','execute'),'plan_version_on istemciye kapalı kalır');
select * from finish();
rollback;
