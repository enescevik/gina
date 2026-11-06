-- D7 (20261106390000_content_accept_and_role_admin): içerik operatörü katkıyı kabul eder (yalnız taslak; yayın
-- kararı yayın rolünde), genel içe aktarma yönetici yazması olarak kalır; operatör rol yönetimi (yalnız tam
-- yönetici, idempotent, denetimli, açık oturumda canlı iptal). Yalnız sentetik kullanıcılar; işlem geri alınır.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000012501','d7-admin@example.invalid',false),
 ('00000000-0000-4000-8000-000000012502','d7-content@example.invalid',false),
 ('00000000-0000-4000-8000-000000012503','d7-release@example.invalid',false),
 ('00000000-0000-4000-8000-000000012504','d7-finance@example.invalid',false),
 ('00000000-0000-4000-8000-000000012505','d7-support@example.invalid',false),
 ('00000000-0000-4000-8000-000000012506','d7-parent@example.invalid',false),
 ('00000000-0000-4000-8000-000000012507','d7-candidate@example.invalid',false),
 ('00000000-0000-4000-8000-000000012508','d7-expired@example.invalid',false),
 ('00000000-0000-4000-8000-000000012509',null,true),
 ('00000000-0000-4000-8000-000000012510','d7-content2@example.invalid',false);
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000012501');
insert into public.operations_members(user_id,role,expires_at) values
 ('00000000-0000-4000-8000-000000012502','content',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012503','release',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012504','finance',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012505','support',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012508','content',now()-interval '1 minute'),
 ('00000000-0000-4000-8000-000000012510','content',now()+interval '30 days');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000012501','D7 aile','00000000-0000-4000-8000-000000012506');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000012501','00000000-0000-4000-8000-000000012506');
create function pg_temp.as_user(u text,f text,admin boolean default false) returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"'||u||'","role":"authenticated","gina":{"role":"parent"'||case when admin then ',"admin":true' else '' end||case when f is null then '' else ',"family_id":"'||f||'"' end||'}}',true)$$;
create function pg_temp.admin() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012501',null,true)$$;
create function pg_temp.content() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012502',null)$$;
create function pg_temp.release() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012503',null)$$;
create function pg_temp.finance() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012504',null)$$;
create function pg_temp.support() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012505',null)$$;
create function pg_temp.parent() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012506','10000000-0000-4000-8000-000000012501')$$;
create function pg_temp.forged() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012507',null,true)$$;
create function pg_temp.r(n int) returns uuid language sql as $$select ('72000000-0000-4000-8000-0000000125'||lpad(n::text,2,'0'))::uuid$$;
create function pg_temp.q(stmt text) returns text language plpgsql security definer as $$declare v text;begin execute stmt into v;return v;end$$;
grant execute on function pg_temp.q(text),pg_temp.r(int) to authenticated;

-- 0. Yüzey ---------------------------------------------------------------------------------------
select is((select string_agg(n.nspname||'.'||p.proname,',' order by n.nspname||'.'||p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','gina') and p.prokind='f' and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'EXECUTE')),
  'public.get_shared_child_view,public.unsubscribe_with_token','anon EXECUTE surface unchanged');
select ok(not has_function_privilege('authenticated','gina.import_contribution_bundle(uuid,jsonb)','EXECUTE')
  and not has_function_privilege('service_role','gina.import_contribution_bundle(uuid,jsonb)','EXECUTE')
  and not has_function_privilege('anon','gina.import_contribution_bundle(uuid,jsonb)','EXECUTE'),'contribution import path is internal (no client grant)');
select ok((select prosecdef from pg_proc where oid='gina.import_contribution_bundle(uuid,jsonb)'::regprocedure),'contribution import path is security definer');
select ok(position('gina.assert_admin()' in pg_get_functiondef('public.admin_import_library_bundle(uuid,jsonb)'::regprocedure))>0,'general bundle import still gated by full admin (C07)');
select ok(position('gina.import_contribution_bundle(p_request_id,bundle)' in pg_get_functiondef('public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean)'::regprocedure))>0
  and position('admin_import_library_bundle' in pg_get_functiondef('public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean)'::regprocedure))=0,'acceptance uses the internal path only');
select ok(position('gina.assert_operation_role(array[''content''])' in pg_get_functiondef('public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean)'::regprocedure))>0,'decision keeps the C07 content gate');
select ok(position('gina.assert_operation_role(array[''release''])' in pg_get_functiondef('public.admin_set_library_publication(uuid,uuid,integer,text,text,text,public.plan_code[],text,boolean,text,text)'::regprocedure))>0,'publication keeps the C07 release gate');
select ok(not has_function_privilege('service_role','public.admin_set_operation_member(uuid,uuid,text,timestamp with time zone,boolean,text)','EXECUTE')
  and not has_function_privilege('service_role','public.admin_operation_members()','EXECUTE')
  and not has_function_privilege('service_role','public.admin_find_operator_account(text)','EXECUTE'),'role admin RPCs are not worker RPCs');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gina' and c.relname='operations_member_commands')
  and not has_table_privilege('authenticated','gina.operations_member_commands','SELECT'),'role command receipts are private with RLS');

-- 1. Katkı kabulü ----------------------------------------------------------------------------------
update public.app_settings set value='true' where key in('sources.enabled','question_groups.enabled','contribution_sets.enabled');
update public.contribution_rewards set enabled=false;
insert into public.contribution_rewards(id,title,threshold,kind,amount,valid_days,enabled,plan) values
 ('7c000000-0000-4000-8000-000000012501','D7: 2 soru → 5 hak',2,'library',5,30,true,null),
 ('7c000000-0000-4000-8000-000000012502','D7: 2 soru → Plus',2,'plan',7,30,true,'plus');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
 ('40000000-0000-4000-8000-000000012501','10000000-0000-4000-8000-000000012501',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\nSekiz dilimli pasta.\n\nİki dilim kaçta kaçtır?','2/8','İki bölü sekiz.'),
 ('40000000-0000-4000-8000-000000012502','10000000-0000-4000-8000-000000012501',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\nSekiz dilimli pasta.\n\nYarısı kaç dilimdir?','4','Sekizin yarısı.'),
 ('40000000-0000-4000-8000-000000012503','10000000-0000-4000-8000-000000012501',5,'Matematik','Çevre','open_ended','orta','D7 karenin bir kenarı 3 cm. Çevresi kaç cm?','12','Dört kenar toplanır.');
insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values
 ('50000000-0000-4000-8000-000000012501','10000000-0000-4000-8000-000000012501','50000000-0000-4000-8000-000000012501',1,'Pasta','Sekiz dilimli pasta.',5,'Matematik');
insert into public.question_source_members(group_id,question_id,position,prompt) values
 ('50000000-0000-4000-8000-000000012501','40000000-0000-4000-8000-000000012501',1,'İki dilim kaçta kaçtır?'),
 ('50000000-0000-4000-8000-000000012501','40000000-0000-4000-8000-000000012502',2,'Yarısı kaç dilimdir?');
update public.question_source_groups set finalized_at=now() where id='50000000-0000-4000-8000-000000012501';
create function pg_temp.teacher(ans text) returns jsonb language sql as $$select jsonb_build_object('correct_key',null,'expected_answer',ans,'solution','Çözüm: '||ans,'explanation','Açıklama.','common_misconception','Yanılgı.','next_step','Sonraki adım.','rubric',jsonb_build_object('max_points',2,'scoring','Ölçüt başına bir puan.','criteria',jsonb_build_array(jsonb_build_object('id','c1','points',1,'criterion','Sonuç doğru.'),jsonb_build_object('id','c2','points',1,'criterion','Gerekçe var.')),'missing_answer','not_answered','review_required',true))$$;
grant execute on function pg_temp.teacher(text) to authenticated;
create temp table counts as select (select count(*) from public.library_items) items,(select count(*) from gina.library_publications) pubs;
grant select on counts to authenticated;
set local role authenticated;select pg_temp.parent();
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012501','40000000-0000-4000-8000-000000012501',true,true)->>'status','pending','grouped copy (shared source) pending');
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012502','40000000-0000-4000-8000-000000012503',true,true)->>'status','pending','standalone copy pending');
create temp table g as select jsonb_build_object('q1',pg_temp.teacher('2/8'),'q2',pg_temp.teacher('4')) t;
reset role;grant select on g to authenticated;set local role authenticated;

-- Yetkisiz roller kabul edemez; hiçbir şey değişmez.
select pg_temp.parent();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','parent cannot accept');
select pg_temp.finance();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','finance operator cannot accept');
select pg_temp.support();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','support operator cannot accept');
select pg_temp.release();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','release operator cannot accept (decision is content work)');
select pg_temp.forged();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','forged admin claim cannot accept');
select pg_temp.as_user('00000000-0000-4000-8000-000000012508',null);
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(1),'61000000-0000-4000-8000-000000012501',true,'Kabul',(select t from g),true)$$,'42501','forbidden','expired content role cannot accept');
select is(pg_temp.q($$select status||':'||coalesce(package_id::text,'none') from gina.contribution_sets where id='61000000-0000-4000-8000-000000012501'$$),'pending:none','refused calls changed nothing');
select is(pg_temp.q($$select count(*) from gina.library_import_packages where package_key='contribution-61000000-0000-4000-8000-000000012501'$$),'0','no package from refused calls');

-- İçerik operatörü: iç yol istemciye kapalı; genel içe aktarma hâlâ yönetici.
select pg_temp.content();
select throws_ok($$select gina.import_contribution_bundle(pg_temp.r(2),'{}'::jsonb)$$,'42501',null,'content operator cannot call the internal import path directly');
select throws_ok($$select public.admin_import_library_bundle(pg_temp.r(2),jsonb_build_object('schema','gina.library-import.v1'))$$,'42501','forbidden','content operator still cannot run a general bundle import');
-- Ortak kaynaklı grupta kısmi kabul yok.
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(3),'61000000-0000-4000-8000-000000012501',true,'Yalnız ilk soru',jsonb_build_object('q1',pg_temp.teacher('2/8')),true)$$,'P0001','contribution_review_required','partial acceptance of a shared-source group refused');
select is(pg_temp.q($$select count(*) from gina.library_import_packages where package_key='contribution-61000000-0000-4000-8000-000000012501'$$),'0','partial attempt imported nothing');
-- Bütün grup kabulü.
create temp table accepted as select public.admin_decide_contribution_set(pg_temp.r(4),'61000000-0000-4000-8000-000000012501',true,'Grup doğru ve özgün.',(select t from g),true) v;
select is((select v->>'status' from accepted),'approved','content operator accepts the whole group');
select is((select v->>'credited_questions' from accepted),'2','both questions of the group credited');
select ok((select v->>'package_id' from accepted) is not null,'acceptance returns the draft package');
select is(pg_temp.q($$select status from gina.library_import_packages where id=(select (v->>'package_id')::uuid from accepted)$$),'draft','package is a draft');
select is(pg_temp.q($$select created_by::text from gina.library_import_packages where id=(select (v->>'package_id')::uuid from accepted)$$),'00000000-0000-4000-8000-000000012502','draft created by the content operator');
select is(pg_temp.q($$select count(*)||':'||count(distinct source_key)||':'||min(source_key) from gina.library_import_questions where package_id=(select (v->>'package_id')::uuid from accepted)$$),'2:1:context','both questions imported atomically on one shared source');
select is(pg_temp.q($$select count(*) from gina.library_import_answers where package_id=(select (v->>'package_id')::uuid from accepted)$$),'2','teacher fields for every question');
select is(pg_temp.q($$select count(*) from gina.library_publications where package_id=(select (v->>'package_id')::uuid from accepted)$$),'0','no publication row: acceptance does not publish');
select is(pg_temp.q($$select ((select count(*) from public.library_items)-(select items from counts))||':'||((select count(*) from gina.library_publications)-(select pubs from counts))$$),'0:0','no live library item and no publication created');
select is(pg_temp.q($$select status||':'||(package_id is not null)::text||':'||reviewed_by::text from gina.contribution_sets where id='61000000-0000-4000-8000-000000012501'$$),'approved:true:00000000-0000-4000-8000-000000012502','copy approved and linked to its draft');
select is(pg_temp.q($$select details->>'decided_as'||':'||(details->>'package_status') from public.audit_log where action='contribution_set.approved' and target_id='61000000-0000-4000-8000-000000012501'$$),'content:draft','approval audit records the content role and a draft package');
select is(pg_temp.q($$select count(*) from public.audit_log where action='library_bundle.imported' and target_id=(select v->>'package_id' from accepted)$$),'1','one import audit');
select is(pg_temp.q($$select count(*) from public.learning_credit_grants where family_id='10000000-0000-4000-8000-000000012501' and policy_id='7c000000-0000-4000-8000-000000012501'$$),'1','one library-credit milestone');
select is(pg_temp.q($$select count(*) from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000012501' and reason like 'Library contribution:%'$$),'1','one plan reward');
-- İdempotent: aynı istek aynı sonucu döndürür, yeni istek ikinci kabul yapamaz, çift hak/ödül yok.
select is(public.admin_decide_contribution_set(pg_temp.r(4),'61000000-0000-4000-8000-000000012501',true,'Grup doğru ve özgün.',(select t from g),true),(select v from accepted),'same request replays the exact result');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(4),'61000000-0000-4000-8000-000000012501',true,'Başka gerekçe',(select t from g),true)$$,'P0001','request_conflict','same request with different content is a conflict');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(5),'61000000-0000-4000-8000-000000012501',true,'Tekrar kabul',(select t from g),true)$$,'P0001','contribution_changed','no second acceptance');
select pg_temp.admin();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(6),'61000000-0000-4000-8000-000000012501',true,'Yönetici tekrar',(select t from g),true)$$,'P0001','contribution_changed','admin cannot accept it twice either');
select is(pg_temp.q($$select (select count(*) from gina.library_import_packages where package_key='contribution-61000000-0000-4000-8000-000000012501')||':'||
  (select count(*) from gina.contribution_question_credits where contribution_id='61000000-0000-4000-8000-000000012501')||':'||
  (select count(*) from public.learning_credit_grants where family_id='10000000-0000-4000-8000-000000012501')||':'||
  (select count(*) from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000012501' and reason like 'Library contribution:%')||':'||
  (select count(*) from public.audit_log where action='contribution_set.approved' and target_id='61000000-0000-4000-8000-000000012501')$$),'1:2:2:1:1','after replays: one package, two credits, two grants (library+plan), one plan override, one approval audit');
-- İç yolun kendi kapısı (yalnız bekleyen katkı paketi). Süper kullanıcı olarak çağrılır: istemcide yetki zaten yok.
reset role;select pg_temp.content();
select throws_ok($$select gina.import_contribution_bundle(pg_temp.r(7),jsonb_build_object('schema','gina.library-import.v1','package_key','editorial-pack','provenance',jsonb_build_object('origin','family_contribution')))$$,'P0001','contribution_import_only','internal path refuses a non-contribution package');
select throws_ok($$select gina.import_contribution_bundle(pg_temp.r(7),jsonb_build_object('schema','gina.library-import.v1','package_key','contribution-61000000-0000-4000-8000-000000012501','provenance',jsonb_build_object('origin','family_contribution')))$$,'P0001','contribution_import_only','internal path refuses an already decided copy');
select throws_ok($$select gina.import_contribution_bundle(pg_temp.r(7),jsonb_build_object('schema','gina.library-import.v1','package_key','contribution-61000000-0000-4000-8000-000000012502','provenance',jsonb_build_object('origin','editorial')))$$,'P0001','contribution_import_only','internal path refuses a non-family provenance');
select pg_temp.support();
select throws_ok($$select gina.import_contribution_bundle(pg_temp.r(7),jsonb_build_object('package_key','contribution-61000000-0000-4000-8000-000000012502','provenance',jsonb_build_object('origin','family_contribution')))$$,'42501','forbidden','internal path keeps the content role check');
set local role authenticated;
-- İçerik operatörü yayımlayamaz; yayın rolü önizleyip yayın kararını verir.
select pg_temp.content();
select throws_ok($$select public.admin_set_library_publication(pg_temp.r(8),(select (v->>'package_id')::uuid from accepted),0,'x','Pasta grubu','Açıklama',array['free']::public.plan_code[],'5. sınıf kesirler',true,'published')$$,'42501','forbidden','content operator cannot publish the draft');
select ok(public.admin_library_publication((select (v->>'package_id')::uuid from accepted)) is not null,'content operator can preview the draft publication state');
select pg_temp.release();
select ok(public.admin_library_publication((select (v->>'package_id')::uuid from accepted)) is not null,'release operator sees the draft for the publication decision');
select is(pg_temp.q($$select count(*) from gina.library_publications where package_id=(select (v->>'package_id')::uuid from accepted)$$),'0','still unpublished');
-- Yönetici kabulü değişmedi (tek soru).
select pg_temp.admin();
select is(public.admin_decide_contribution_set(pg_temp.r(9),'61000000-0000-4000-8000-000000012502',true,'Kabul.',jsonb_build_object('q1',pg_temp.teacher('12')),true)->>'status','approved','admin acceptance unchanged');
select is(pg_temp.q($$select details->>'decided_as' from public.audit_log where action='contribution_set.approved' and target_id='61000000-0000-4000-8000-000000012502'$$),'admin','admin decision recorded as admin');
-- İçerik ret yolu değişmedi.
reset role;
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
 ('40000000-0000-4000-8000-000000012504','10000000-0000-4000-8000-000000012501',5,'Matematik','Alan','open_ended','orta','D7 kenarı 2 cm olan karenin alanı?','4','Kenar çarpı kenar.');
set local role authenticated;select pg_temp.parent();
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012503','40000000-0000-4000-8000-000000012504',true,true)->>'status','pending','third copy pending');
select pg_temp.content();
select is(public.admin_decide_contribution_set(pg_temp.r(10),'61000000-0000-4000-8000-000000012503',false,'Birim eksik.','{}'::jsonb,true,'{"q1":"Cevapta cm² yazılmalı."}'::jsonb)->>'status','rejected','content rejection with question note unchanged');
select is(pg_temp.q($$select coalesce(details->>'package_status','null')||':'||(details->>'decided_as') from public.audit_log where action='contribution_set.rejected' and target_id='61000000-0000-4000-8000-000000012503'$$),'null:content','rejection audit has no package');

-- 2. Operatör rol yönetimi ------------------------------------------------------------------------
reset role;
insert into auth.sessions(id,user_id,created_at,updated_at) values('5e000000-0000-4000-8000-000000012510','00000000-0000-4000-8000-000000012510',now(),now());
set local role authenticated;
-- Yalnız tam yönetici.
select pg_temp.content();
select throws_ok($$select public.admin_operation_members()$$,'42501','forbidden','content operator cannot list roles');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(20),'00000000-0000-4000-8000-000000012507','content',now()+interval '30 days',false,'Kendine yardımcı')$$,'42501','forbidden','content operator cannot grant roles');
select pg_temp.release();
select throws_ok($$select public.admin_find_operator_account('d7-candidate@example.invalid')$$,'42501','forbidden','release operator cannot look up accounts');
select pg_temp.support();
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(20),'00000000-0000-4000-8000-000000012505','finance',now()+interval '30 days',false,'Kendime finans')$$,'42501','forbidden','support operator cannot widen own access');
select pg_temp.parent();
select throws_ok($$select public.admin_operation_members()$$,'42501','forbidden','parent cannot list roles');
select pg_temp.forged();
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(20),'00000000-0000-4000-8000-000000012507','content',now()+interval '30 days',false,'Sahte yönetici')$$,'42501','forbidden','forged admin claim without admins row refused');
select is(pg_temp.q($$select count(*) from public.operations_members where user_id='00000000-0000-4000-8000-000000012507'$$),'0','refused calls wrote no role');
-- Liste.
select pg_temp.admin();
select ok(not (public.admin_operation_members()->'members') @> '[{"user_id":"00000000-0000-4000-8000-000000012501"}]','full admins are not listed as operators');
select is((select m->'roles'->0->>'state' from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012508'),'expired','expired role shown as expired');
select is((select m->'roles'->0->>'state' from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012502'),'active','active content role listed');
select is((select m->>'open_sessions' from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012510'),'1','open session count shown');
select is((select m->'roles'->0->>'scope_count' from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012503'),'0','release role shows its scope count');
-- Hesap bulma.
select is(public.admin_find_operator_account('nobody@example.invalid')->>'found','false','unknown email');
select is(public.admin_find_operator_account('  D7-Candidate@Example.Invalid ')->>'user_id','00000000-0000-4000-8000-000000012507','exact email match, case-insensitive');
select is(public.admin_find_operator_account('d7-candidate@example.invalid')->>'eligible','true','regular account is eligible');
select is(public.admin_find_operator_account('d7-admin@example.invalid')->>'reason','operator_is_admin','full admin not eligible');
select throws_ok($$select public.admin_find_operator_account('x')$$,'P0001','invalid_input','too short lookup refused');
-- Ver → tekrar → çakışma → değişmedi.
create temp table granted as select public.admin_set_operation_member(pg_temp.r(21),'00000000-0000-4000-8000-000000012507','content',date_trunc('second',now())+interval '30 days',false,'  İçerik ekibine katıldı  ') v;
select is((select v->>'status' from granted),'granted','admin grants a role');
select is(pg_temp.q($$select count(*) from public.operations_members where user_id='00000000-0000-4000-8000-000000012507' and role='content' and revoked_at is null and expires_at>now()$$),'1','one active role row');
select is(public.admin_set_operation_member(pg_temp.r(21),'00000000-0000-4000-8000-000000012507','content',date_trunc('second',now())+interval '30 days',false,'İçerik ekibine katıldı')->>'replayed','true','same request replays');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(21),'00000000-0000-4000-8000-000000012507','finance',date_trunc('second',now())+interval '30 days',false,'İçerik ekibine katıldı')$$,'P0001','request_conflict','same request with different role is a conflict');
select is(public.admin_set_operation_member(pg_temp.r(22),'00000000-0000-4000-8000-000000012507','content',date_trunc('second',now())+interval '30 days',false,'Tekrar ver')->>'status','unchanged','same state again is unchanged');
select is(pg_temp.q($$select count(*)||':'||max(reason)||':'||max(actor_id::text) from public.audit_log where action='operations.member' and target_id='00000000-0000-4000-8000-000000012507'$$),'1:İçerik ekibine katıldı:00000000-0000-4000-8000-000000012501','one audit row with trimmed reason and actor');
-- Süre güncelleme ve sınırlar.
select is(public.admin_set_operation_member(pg_temp.r(23),'00000000-0000-4000-8000-000000012507','content',date_trunc('second',now())+interval '90 days',false,'Dönem boyunca uzatıldı')->>'status','updated','expiry updated');
select is(pg_temp.q($$select (expires_at>now()+interval '89 days')::text from public.operations_members where user_id='00000000-0000-4000-8000-000000012507' and role='content'$$),'true','new expiry stored');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','content',now()+interval '400 days',false,'Çok uzun süre')$$,'P0001','invalid_input','more than one year refused');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','content',now()-interval '1 day',false,'Geçmiş tarih')$$,'P0001','invalid_input','past expiry refused');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','content',null,false,'Süresiz')$$,'P0001','invalid_input','grant needs an expiry');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','content',null,true,'x')$$,'P0001','invalid_input','short reason refused');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','owner',now()+interval '1 day',false,'Bilinmeyen rol')$$,'P0001','invalid_input','unknown role refused');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(24),'00000000-0000-4000-8000-000000012507','content',now()+interval '1 day',true,'Kaldırırken tarih')$$,'P0001','invalid_input','revoke takes no expiry');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(25),'00000000-0000-4000-8000-000000012501','content',now()+interval '30 days',false,'Yöneticiye rol')$$,'P0001','operator_is_admin','full admin gets no operator role');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(26),'00000000-0000-4000-8000-000000012501','content',null,true,'Kendi rolüm')$$,'P0001','operator_self_change','admin cannot change own operator role here');
select throws_ok($$select public.admin_set_operation_member(pg_temp.r(27),'00000000-0000-4000-8000-000000012509','content',now()+interval '30 days',false,'Anonim hesap')$$,'P0001','operator_account_required','anonymous account refused');
-- Açık oturumda iptal: aynı JWT bir sonraki istekte reddedilir.
select pg_temp.as_user('00000000-0000-4000-8000-000000012510',null);
select ok(jsonb_typeof(public.admin_list_contribution_sets())='array','content operator works before revocation');
select is(public.my_operation_roles(),'["content"]'::jsonb,'role visible before revocation');
select pg_temp.admin();
create temp table revoked as select public.admin_set_operation_member(pg_temp.r(28),'00000000-0000-4000-8000-000000012510','content',null,true,'Ekipten ayrıldı') v;
select is((select v->>'status'||':'||(v->>'effect')||':'||(v->>'open_sessions') from revoked),'revoked:refused_on_next_request:1','revocation reports the open-session effect');
select pg_temp.as_user('00000000-0000-4000-8000-000000012510',null);
select throws_ok($$select public.admin_list_contribution_sets()$$,'42501','forbidden','same JWT refused right after revocation');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(29),'61000000-0000-4000-8000-000000012501',false,'İptal sonrası','{}'::jsonb,true)$$,'42501','forbidden','revoked operator cannot decide');
select is(public.my_operation_roles(),'[]'::jsonb,'role gone from the live role list');
select pg_temp.admin();
select is(public.admin_set_operation_member(pg_temp.r(30),'00000000-0000-4000-8000-000000012510','content',null,true,'Tekrar kaldır')->>'status','unchanged','revoking again is unchanged');
select is(public.admin_set_operation_member(pg_temp.r(31),'00000000-0000-4000-8000-000000012508','content',null,true,'Süresi dolmuş')->>'status','unchanged','revoking an expired role is unchanged');
select is(public.admin_set_operation_member(pg_temp.r(32),'00000000-0000-4000-8000-000000012508','content',date_trunc('second',now())+interval '7 days',false,'Yeniden başladı')->>'status','granted','expired role granted again');
select is(public.admin_set_operation_member(pg_temp.r(33),'00000000-0000-4000-8000-000000012510','content',date_trunc('second',now())+interval '7 days',false,'Geri döndü')->>'status','granted','revoked role granted again');
select pg_temp.as_user('00000000-0000-4000-8000-000000012510',null);
select is(public.my_operation_roles(),'["content"]'::jsonb,'re-granted role is live at once');
select pg_temp.admin();
select is(pg_temp.q($$select count(*) from public.audit_log where action='operations.member' and target_id='00000000-0000-4000-8000-000000012510'$$),'2','revoke + re-grant audited; unchanged wrote nothing');
select is((select jsonb_array_length(m->'history')||':'||(m->'history'->0->>'reason')||':'||(m->'history'->1->>'revoked') from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012510'),'2:Geri döndü:true','history newest first with reason and revoke flag');
select is((select m->'history'->0->>'actor' from jsonb_array_elements(public.admin_operation_members()->'members') m where m->>'user_id'='00000000-0000-4000-8000-000000012510'),'d7-admin@example.invalid','history names the admin');
-- Yayın rolü kaldırılınca kapsam satırları korunur ve sayısı bildirilir.
reset role;
insert into gina.education_places(id,kind,parent_id,name,active) values('ec000000-0000-4000-8000-000000012501','region','ec000000-0000-4000-8000-000000000001','D7 Bölge',true);
insert into gina.operations_member_scopes(user_id,role,place_id) values('00000000-0000-4000-8000-000000012503','release','ec000000-0000-4000-8000-000000012501');
set local role authenticated;select pg_temp.admin();
select is(public.admin_set_operation_member(pg_temp.r(34),'00000000-0000-4000-8000-000000012503','release',null,true,'Yayın ekibinden ayrıldı')->>'scope_count','1','release revoke reports kept scopes');
select pg_temp.release();
select throws_ok($$select public.admin_library_publication((select (v->>'package_id')::uuid from accepted))$$,'42501','forbidden','revoked release operator refused');
reset role;
select * from finish();
rollback;
