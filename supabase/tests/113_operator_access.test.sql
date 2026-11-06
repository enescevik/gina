begin;
select no_plan();
-- C07: operatör rol matrisi (UI'nın kullandığı RPC'ler), açık oturumda rol iptali, iş kuyruğu sorumlusuz tanımı,
-- hazır yanıtlar (TR/EN, sürüm, idempotency), içerik keyset sayfalama (>200) ve aday AI durumu, duyuru push hedefi.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000011301','c07-admin@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011302','c07-support@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011303','c07-content@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011304','c07-finance@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011305','c07-release@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011306','c07-content-old@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011307','c07-parent@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011308','c07-parent2@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000011309','c07-parent3@example.invalid',false,'{}');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000011301');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000011302','support',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011303','content',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011304','finance',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011305','release',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000011306','content',now()-interval '1 minute',null);
insert into public.families(id,name,created_by,timezone,locale) values
 ('10000000-0000-4000-8000-000000011301','Ilgaz ailesi','00000000-0000-4000-8000-000000011307','Europe/Istanbul','en'),
 ('10000000-0000-4000-8000-000000011302','Kuzey ailesi','00000000-0000-4000-8000-000000011308','Europe/Istanbul','tr');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011301','00000000-0000-4000-8000-000000011307'),
 ('10000000-0000-4000-8000-000000011302','00000000-0000-4000-8000-000000011308'),
 ('10000000-0000-4000-8000-000000011302','00000000-0000-4000-8000-000000011309');
insert into public.help_tickets(id,family_id,created_by,kind,category,subject,status,created_at,updated_at,assignee_id) values
 ('70000000-0000-4000-8000-000000011301','10000000-0000-4000-8000-000000011301','00000000-0000-4000-8000-000000011307','support','device','Tablet code fails','open',now()-interval '3 days',now()-interval '1 hour',null),
 ('70000000-0000-4000-8000-000000011302','10000000-0000-4000-8000-000000011302','00000000-0000-4000-8000-000000011308','support','billing','Paket görünmüyor','in_progress',now()-interval '2 days',now()-interval '2 hours','00000000-0000-4000-8000-000000011302'),
 ('70000000-0000-4000-8000-000000011303','10000000-0000-4000-8000-000000011302','00000000-0000-4000-8000-000000011308','support','other','Cevaplandı ama sorumlusuz','open',now()-interval '1 day',now()-interval '1 hour',null);
-- 3. talepte operatör cevabı var ama sorumlu yok: eski tanımda sorumlusuz sayılmazdı.
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body,created_at) values
 ('70000000-0000-4000-8000-000000011303','00000000-0000-4000-8000-000000011302','support','family','Bakıyoruz',now()-interval '20 hours'),
 ('70000000-0000-4000-8000-000000011302','00000000-0000-4000-8000-000000011302','support','internal','c07 ekip notu gizli',now()-interval '1 hour');
-- 230 koleksiyon + 3 senaryo adayı (biri AI 'needs_admin').
insert into public.library_collections(id,title,grade,subject,status,created_at)
select ('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'C07 koleksiyon '||g,5,'math','draft',now()-g*interval '1 minute' from generate_series(1,230) g;
insert into gina.curriculum_candidates(id,external_key,source_sha256,candidate,content_hash,status,created_by,created_at) values
 ('40000000-0000-4000-8000-000000011301','c07-a','x','{"label":"Senaryo A","grade":6,"subject":"math"}','h1','draft','00000000-0000-4000-8000-000000011301',now()+interval '1 minute'),
 ('40000000-0000-4000-8000-000000011302','c07-b','x','{"label":"Senaryo B","grade":"?","subject":"science"}','h2','reviewed','00000000-0000-4000-8000-000000011301',now()+interval '2 minutes');
insert into gina.content_prereviews(target_kind,target_id,content_hash,prereview_status) values('curriculum_candidate','40000000-0000-4000-8000-000000011301',md5('c07')||md5('c07'),'needs_admin');
insert into gina.parent_announcements(id,title,body,expires_on,created_by) values
 ('50000000-0000-4000-8000-000000011301','C07 duyuru','Bu bir sentetik duyuru metnidir.',current_date+10,'00000000-0000-4000-8000-000000011305');
insert into public.push_tokens(user_id,family_id,role,platform,token,token_type,locale) values
 ('00000000-0000-4000-8000-000000011307','10000000-0000-4000-8000-000000011301','parent','ios','c07-token-aaaa','apns','en'),
 ('00000000-0000-4000-8000-000000011307','10000000-0000-4000-8000-000000011301','parent','android','c07-token-bbbb','fcm','en'),
 ('00000000-0000-4000-8000-000000011308','10000000-0000-4000-8000-000000011302','parent','ios','c07-token-cccc','apns','tr');
insert into public.push_preferences(user_id,family_id,announcements) values('00000000-0000-4000-8000-000000011308','10000000-0000-4000-8000-000000011302',false);
insert into auth.sessions(id,user_id,created_at,updated_at) values(gen_random_uuid(),'00000000-0000-4000-8000-000000011307',now(),now());

create function pg_temp.actor(id text, admin boolean default false, family text default null) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',case when family is null then null else 'parent' end,'admin',admin))::text,true)::void$$;
create function pg_temp.allowed(sql text) returns text language plpgsql as $$
begin execute sql; return 'allowed';
exception when insufficient_privilege then return 'forbidden';
 when others then if sqlerrm='forbidden' then return 'forbidden'; end if; return 'allowed:'||sqlerrm; end$$;
create function pg_temp.gate(sql text) returns text language sql as $$ select split_part(pg_temp.allowed(sql),':',1) $$;

-- 1. Rol matrisi: izinli + yasak (her RPC iki yönde) --------------------------------------------
create temp table matrix(fn text, call text, admin text, support text, content text, finance text, release text);
insert into matrix values
 ('admin_workqueue','select public.admin_workqueue()','allowed','allowed','allowed','allowed','allowed'),
 ('admin_dashboard','select public.admin_dashboard()','allowed','forbidden','forbidden','forbidden','forbidden'),
 ('admin_families_search','select public.admin_families_search(null,null,10)','allowed','allowed','forbidden','allowed','forbidden'),
 ('finance_workspace','select public.finance_workspace(null,null)','allowed','forbidden','forbidden','allowed','forbidden'),
 ('admin_list_overrides','select public.admin_list_overrides()','allowed','forbidden','forbidden','forbidden','forbidden'),
 ('admin_support_queue','select public.admin_support_queue(''support'',null,null,''any'',null,false,null,null)','allowed','allowed','forbidden','forbidden','forbidden'),
 ('support_canned_replies','select public.support_canned_replies()','allowed','allowed','forbidden','forbidden','forbidden'),
 ('admin_learning_library','select public.admin_learning_library()','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_library_content_items','select public.admin_library_content_items(null,null,5)','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_library_content_page','select public.admin_library_content_page()','allowed','forbidden','allowed','forbidden','allowed'),
 ('admin_list_library_draft_packages','select public.admin_list_library_draft_packages()','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_list_contribution_sets','select public.admin_list_contribution_sets()','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_content_prereviews','select public.admin_content_prereviews(null,10)','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_library_group_integrity','select public.admin_library_group_integrity(5)','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_group_exams','select public.admin_group_exams()','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_group_package_catalog','select public.admin_group_package_catalog()','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_cohort_review_queue','select public.admin_cohort_review_queue(gen_random_uuid())','allowed','forbidden','allowed','forbidden','forbidden'),
 ('admin_library_publication','select public.admin_library_publication(gen_random_uuid())','allowed','forbidden','allowed','forbidden','allowed'),
 ('admin_set_library_publication','select public.admin_set_library_publication(gen_random_uuid(),gen_random_uuid(),0,''x'',''t'',null,''{plus}'',null,true,''published'',''r'')','allowed','forbidden','forbidden','forbidden','allowed'),
 ('admin_announcements','select public.admin_announcements()','allowed','forbidden','forbidden','forbidden','allowed'),
 ('admin_announcement_push_audience','select public.admin_announcement_push_audience(''50000000-0000-4000-8000-000000011301'',1)','allowed','forbidden','forbidden','forbidden','allowed'),
 ('admin_group_policy','select public.admin_group_policy(true,''{}'')','allowed','forbidden','forbidden','forbidden','forbidden'),
 ('admin_set_library_quota','select public.admin_set_library_quota(''plus'',5)','allowed','forbidden','forbidden','forbidden','forbidden'),
 ('admin_list_curriculum_candidates','select public.admin_list_curriculum_candidates()','allowed','forbidden','forbidden','forbidden','forbidden');

do $$declare r record;who record;got text;exp text;begin
 for who in select * from (values ('admin','00000000-0000-4000-8000-000000011301',true),('support','00000000-0000-4000-8000-000000011302',false),
   ('content','00000000-0000-4000-8000-000000011303',false),('finance','00000000-0000-4000-8000-000000011304',false),('release','00000000-0000-4000-8000-000000011305',false)) v(name,id,adm) loop
  for r in select * from matrix loop
   perform pg_temp.actor(who.id,who.adm);
   exp:=case who.name when 'admin' then r.admin when 'support' then r.support when 'content' then r.content when 'finance' then r.finance else r.release end;
   got:=pg_temp.gate(r.call);
   create temp table if not exists matrix_result(who text,fn text,expected text,got text);
   insert into matrix_result values(who.name,r.fn,exp,got);
  end loop;
 end loop;
end$$;
select is(got,expected,who||' → '||fn||' '||expected) from matrix_result order by fn,who;

-- Veli, süresi dolmuş içerik operatörü ve sahte admin claim'i içerik RPC'lerine ulaşamaz.
select pg_temp.actor('00000000-0000-4000-8000-000000011307',false,'10000000-0000-4000-8000-000000011301');
select is(pg_temp.gate('select public.admin_library_content_page()'),'forbidden','parent cannot read content review page');
select is(pg_temp.gate('select public.admin_learning_library()'),'forbidden','parent cannot read admin library');
select is(pg_temp.gate('select public.support_canned_replies()'),'forbidden','parent cannot read canned replies');
select pg_temp.actor('00000000-0000-4000-8000-000000011306');
select is(pg_temp.gate('select public.admin_library_content_page()'),'forbidden','expired content operator rejected');
select pg_temp.actor('00000000-0000-4000-8000-000000011302',true);
select is(pg_temp.gate('select public.admin_dashboard()'),'forbidden','forged admin claim without admins row is not admin');
select is(pg_temp.gate('select public.admin_library_content_page()'),'forbidden','forged admin claim does not grant content role');
select ok(not has_function_privilege('anon','public.admin_library_content_page(text,text,text,text,int)','execute'),'anon cannot execute content page');
select ok(not has_function_privilege('anon','public.save_support_canned_reply(uuid,uuid,int,text,text,text,text[],int,boolean)','execute'),'anon cannot save canned reply');

-- Yeniden kapılama gövdeyi değiştirmedi: yalnız yetki satırı farklı.
select ok(pg_get_functiondef('public.admin_library_content_items(text,text,int)'::regprocedure) like '%gina.assert_operation_role(array[''content''])%','content items regated to content role');
select ok(pg_get_functiondef('public.admin_set_library_publication(uuid,uuid,integer,text,text,text,plan_code[],text,boolean,text,text)'::regprocedure) like '%gina.assert_operation_role(array[''release''])%','publication decision regated to release role');
select ok(pg_get_functiondef('public.admin_set_library_publication(uuid,uuid,integer,text,text,text,plan_code[],text,boolean,text,text)'::regprocedure) like '%library_publication_review_required%','publication rules kept');
select ok(pg_get_functiondef('public.admin_group_policy(boolean,jsonb)'::regprocedure) like '%gina.assert_admin()%','group policy stays admin-only');

-- 2. Açık oturumda rol iptali: aynı JWT ile bir sonraki çağrı reddedilir ------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011303');
select is(pg_temp.gate('select public.admin_cohort_review_queue(gen_random_uuid())'),'allowed','content reads cohort queue before revocation');
update public.operations_members set revoked_at=now() where user_id='00000000-0000-4000-8000-000000011303' and role='content';
select is(pg_temp.gate('select public.admin_cohort_review_queue(gen_random_uuid())'),'forbidden','revoked content operator blocked with the same token');
select is(pg_temp.gate('select public.admin_library_content_page()'),'forbidden','revoked content operator cannot page content');
select is(pg_temp.gate('select public.admin_workqueue()'),'forbidden','revoked operator has no workqueue');
update public.operations_members set revoked_at=null where user_id='00000000-0000-4000-8000-000000011303' and role='content';
select pg_temp.actor('00000000-0000-4000-8000-000000011305');
update public.operations_members set expires_at=now()-interval '1 second' where user_id='00000000-0000-4000-8000-000000011305';
select is(pg_temp.gate('select public.admin_library_publication(gen_random_uuid())'),'forbidden','expired release operator blocked mid-session');
update public.operations_members set expires_at=now()+interval '30 days' where user_id='00000000-0000-4000-8000-000000011305';
select pg_temp.actor('00000000-0000-4000-8000-000000011301',true);
delete from public.admins where user_id='00000000-0000-4000-8000-000000011301';
select is(pg_temp.gate('select public.admin_library_content_page()'),'forbidden','removed admin loses content access immediately');
select is(pg_temp.gate('select public.admin_set_library_publication(gen_random_uuid(),gen_random_uuid(),0,''x'',''t'',null,''{plus}'',null,true,''published'',''r'')'),'forbidden','removed admin cannot publish');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000011301');

-- 3. İş kuyruğu: sorumlusuz = assignee_id boş -----------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011302');
select is((select (x->>'count')::int from jsonb_array_elements(public.admin_workqueue('support')->'items') x where x->>'key'='tickets_unassigned'),2,'unassigned counts tickets without assignee (replied one included, assigned one excluded)');
select is((select x->>'reason' from jsonb_array_elements(public.admin_workqueue('support')->'items') x where x->>'key'='tickets_unassigned'),'no_assignee','unassigned reason is assignee based');
select is((public.admin_workqueue('support')->'items')::text like '%store_notifications%',false,'support workqueue has no finance items');
select is((select count(*)::int from jsonb_array_elements(public.admin_support_queue('support','open',null,'none',null,false,null,null)))
 +(select count(*)::int from jsonb_array_elements(public.admin_support_queue('support','in_progress',null,'none',null,false,null,null))),
 (select (x->>'count')::int from jsonb_array_elements(public.admin_workqueue('support')->'items') x where x->>'key'='tickets_unassigned'),'workqueue count equals support queue assignee=none filter');
select pg_temp.actor('00000000-0000-4000-8000-000000011303');
select is((select count(*)::int from jsonb_array_elements(public.admin_workqueue()->'items') x where x->>'role'<>'content'),0,'content operator sees only content items');
select is(pg_temp.gate('select public.admin_workqueue(''support'')'),'forbidden','content operator cannot ask for support queue');

-- 4. Hazır yanıtlar ------------------------------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011302');
select is(public.support_canned_replies()->>'locale','tr','default locale tr');
select is(jsonb_array_length(public.support_canned_replies()->'replies'),5,'five Turkish replies seeded');
select is(public.support_canned_replies(null,'70000000-0000-4000-8000-000000011301')->>'locale','en','ticket family locale selects English');
select is(jsonb_array_length(public.support_canned_replies('en')->'replies'),5,'five English replies seeded');
select ok(not (public.support_canned_replies('en')->'replies')::text like '%Merhaba%','English list has no Turkish text');
select throws_ok($$select public.support_canned_replies('de')$$,'P0001','invalid_input','unknown locale rejected');
select is(public.save_support_canned_reply('80000000-0000-4000-8000-000000011301',null,null,'tr','Şifre sıfırlama','Merhaba, giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilirsiniz.','{account}',60,false)->>'revision','1','create reply');
select is(public.save_support_canned_reply('80000000-0000-4000-8000-000000011301',null,null,'tr','Şifre sıfırlama','Merhaba, giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilirsiniz.','{account}',60,false)->>'replayed','true','same request replays');
select is((select count(*)::int from gina.support_canned_replies where title='Şifre sıfırlama'),1,'replay wrote one row');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011301',null,null,'tr','Şifre sıfırlama','Farklı gövde metni burada yazıyor.','{account}',60,false)$$,'P0001','request_conflict','same request different payload conflicts');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011302',null,null,'tr','Şifre sıfırlama','Başka bir metin burada yazıyor.','{}',60,false)$$,'P0001','canned_reply_duplicate_title','duplicate active title rejected');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011303',null,null,'tr','Kategori','Geçersiz kategori metni.','{payments}',60,false)$$,'P0001','invalid_input','unknown category rejected');
create temp table c07_reply as select id from gina.support_canned_replies where title='Şifre sıfırlama';
select is(public.save_support_canned_reply('80000000-0000-4000-8000-000000011304',(select id from c07_reply),1,'tr','Şifre sıfırlama','Merhaba, "Şifremi unuttum" ile yeni şifre alabilirsiniz.','{account}',60,false)->>'revision','2','edit with expected revision');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011305',(select id from c07_reply),1,'tr','Şifre sıfırlama','Eski sürümden yazılan metin burada.','{account}',60,false)$$,'P0001','canned_reply_changed','stale revision rejected');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011306',(select id from c07_reply),2,'en','Şifre sıfırlama','Dil değiştirme denemesi burada.','{account}',60,false)$$,'P0001','invalid_input','locale cannot change on edit');
select is(public.save_support_canned_reply('80000000-0000-4000-8000-000000011307',(select id from c07_reply),2,'tr','Şifre sıfırlama','Merhaba, "Şifremi unuttum" ile yeni şifre alabilirsiniz.','{account}',60,true)->>'archived','true','archive');
select is(jsonb_array_length(public.support_canned_replies('tr')->'replies'),5,'archived reply hidden from helpers');
select is(jsonb_array_length(public.support_canned_replies('tr',null,true)->'replies'),6,'archived reply visible in management');
select is((select count(*)::int from public.audit_log where action='support.canned_reply'),3,'one audit row per real write (no replay rows)');
select pg_temp.actor('00000000-0000-4000-8000-000000011303');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011308',null,null,'tr','İçerik ekibi','İçerik ekibinin yanıtı burada.','{}',60,false)$$,'42501','forbidden','content operator cannot manage canned replies');
select pg_temp.actor('00000000-0000-4000-8000-000000011306');
select throws_ok($$select public.save_support_canned_reply('80000000-0000-4000-8000-000000011309',(select id from c07_reply),3,'tr','x2','Başka bir aktör aynı istek.','{}',60,false)$$,'42501','forbidden','expired operator cannot write');

-- 5. İçerik keyset sayfalama (233 kayıt > 200) ------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011303');
create temp table pages(n int, body jsonb);
insert into pages select 1,public.admin_library_content_page(null,null,null,null,100);
insert into pages select 2,public.admin_library_content_page(null,null,null,(select body->>'next_cursor' from pages where n=1),100);
insert into pages select 3,public.admin_library_content_page(null,null,null,(select body->>'next_cursor' from pages where n=2),100);
select is((select jsonb_array_length(body->'rows') from pages where n=1),100,'page 1 full');
select is((select jsonb_array_length(body->'rows') from pages where n=3),32,'page 3 has the rest (232 = 230 collections + 2 candidates)');
select is((select body->>'has_more' from pages where n=3),'false','last page has no more');
select is((select body->'next_cursor' from pages where n=3),'null'::jsonb,'last page has no cursor');
select is((select count(distinct r->>'id')::int from pages,jsonb_array_elements(body->'rows') r),232,'every row reached exactly once');
select is((select count(*)::int from pages,jsonb_array_elements(body->'rows') r),232,'no duplicates across pages');
select is((public.admin_library_content_page(null,null,null,null,500)->>'limit')::int,200,'limit clamped to 200');
select throws_ok($$select public.admin_library_content_page(null,null,null,'bozuk',10)$$,'P0001','cursor_invalid','bad cursor rejected');
select throws_ok($$select public.admin_library_content_page('secret',null,null,null,10)$$,'P0001','invalid_input','bad kind rejected');
-- Süzgeç değişince cursor sıfırlanır: aday süzgeci ilk sayfadan iki adayı verir.
select is((select jsonb_array_length(public.admin_library_content_page('curriculum_candidate',null,null,null,50)->'rows')),2,'candidate filter from first page');
select is((select r->>'prereview_status' from jsonb_array_elements(public.admin_library_content_page('curriculum_candidate',null,null,null,50)->'rows') r where r->>'id'='40000000-0000-4000-8000-000000011301'),'needs_admin','candidate carries AI prereview status');
select is((select r->>'grade' from jsonb_array_elements(public.admin_library_content_page('curriculum_candidate',null,null,null,50)->'rows') r where r->>'id'='40000000-0000-4000-8000-000000011302'),null,'non-numeric candidate grade is null, not an error');
select is((select jsonb_array_length(public.admin_library_content_page(null,null,'needs_admin',null,50)->'rows')),1,'server-side AI filter');
select is((select jsonb_array_length(public.admin_library_content_page(null,'reviewed',null,null,50)->'rows')),1,'status filter');
select ok(not (public.admin_library_content_page(null,null,null,null,200))::text like '%c07 ekip notu%','content page carries no support notes');

-- 6. Duyuru push hedefi ----------------------------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011305');
create temp table push_aud as select public.admin_announcement_push_audience('50000000-0000-4000-8000-000000011301',1) v;
select is((select (v->>'eligible')::int from push_aud),1,'one parent reachable by push (device + allowed + signed in)');
select is((select (v->>'devices')::int from push_aud),2,'two devices for that parent');
select is((select (v->'blocked'->>'opted_out')::int from push_aud),1,'opted-out parent counted separately');
select is((select (v->'blocked'->>'no_device')::int from push_aud),1,'parent without device counted');
select is((select (v->>'eligible')::int+(v->'blocked'->>'opted_out')::int+(v->'blocked'->>'no_device')::int from push_aud),
 (select (public.admin_preview_announcement('50000000-0000-4000-8000-000000011301',1)->>'count')::int),'push breakdown sums to recipient count');
select throws_ok($$select public.admin_announcement_push_audience('50000000-0000-4000-8000-000000011301',9)$$,'P0001','announcement_changed','stale revision rejected');

-- 7. İçerik ekibi grup fazı / katkı izi okuyabilir; veli dalı değişmedi ---------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000011303');
select throws_ok($$select public.group_exam_phases(gen_random_uuid())$$,'P0001','not_found','content operator reaches group phases (unknown group → not_found, not forbidden)');
select throws_ok($$select public.contribution_review_trail(gen_random_uuid())$$,'P0001','contribution_not_found','content operator reaches review trail');
select pg_temp.actor('00000000-0000-4000-8000-000000011302');
select throws_ok($$select public.group_exam_phases(gen_random_uuid())$$,'42501','forbidden','support operator cannot read group phases');
select pg_temp.actor('00000000-0000-4000-8000-000000011308',false,'10000000-0000-4000-8000-000000011302');
select throws_ok($$select public.group_exam_phases(gen_random_uuid())$$,'P0001','not_found','parent branch unchanged');

select * from finish();
rollback;
