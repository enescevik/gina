-- D3 (20261106370000_operator_scope_admin_and_question_notes): operatör kapsamı yönetimi (yalnız tam yönetici,
-- idempotent, denetimli, son kapsam genişletme kilidi), başarısız teslim sayfası (süzgeç, keyset, en çok 3 yeniden
-- sıraya alma), soru bazlı katkı ret notu (sunucu, yönetim, veli izi; atomik kabul korunur), canlı yönetici kontrolü.
-- Yalnız sentetik kullanıcılar; işlem geri alınır.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000012301','d3-admin@example.invalid',false),
 ('00000000-0000-4000-8000-000000012302','d3-release@example.invalid',false),
 ('00000000-0000-4000-8000-000000012303','d3-release-scoped@example.invalid',false),
 ('00000000-0000-4000-8000-000000012304','d3-release-expired@example.invalid',false),
 ('00000000-0000-4000-8000-000000012305','d3-content@example.invalid',false),
 ('00000000-0000-4000-8000-000000012306','d3-support@example.invalid',false),
 ('00000000-0000-4000-8000-000000012307','d3-parent@example.invalid',false),
 ('00000000-0000-4000-8000-000000012308','d3-parent-other@example.invalid',false);
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000012301');
insert into public.operations_members(user_id,role,expires_at) values
 ('00000000-0000-4000-8000-000000012302','release',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012303','release',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012304','release',now()-interval '1 minute'),
 ('00000000-0000-4000-8000-000000012305','content',now()+interval '30 days'),
 ('00000000-0000-4000-8000-000000012306','support',now()+interval '30 days');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000012301','D3 aile','00000000-0000-4000-8000-000000012307'),
 ('10000000-0000-4000-8000-000000012302','D3 diğer aile','00000000-0000-4000-8000-000000012308');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000012301','00000000-0000-4000-8000-000000012307'),
 ('10000000-0000-4000-8000-000000012302','00000000-0000-4000-8000-000000012308');
insert into gina.education_places(id,kind,parent_id,name,active) values
 ('ec000000-0000-4000-8000-000000012301','region','ec000000-0000-4000-8000-000000000001','D3 Bölge A',true),
 ('ec000000-0000-4000-8000-000000012302','school','ec000000-0000-4000-8000-000000012301','D3 Okul A',true),
 ('ec000000-0000-4000-8000-000000012303','region','ec000000-0000-4000-8000-000000000001','D3 Bölge B',true),
 ('ec000000-0000-4000-8000-000000012304','region','ec000000-0000-4000-8000-000000000001','D3 Kapalı bölge',false);
insert into gina.operations_member_scopes(user_id,role,place_id) values('00000000-0000-4000-8000-000000012303','release','ec000000-0000-4000-8000-000000012303');
create function pg_temp.as_user(u text,f text,admin boolean default false) returns void language sql as $$
 select set_config('request.jwt.claims','{"sub":"'||u||'","role":"authenticated","gina":{"role":"parent"'||case when admin then ',"admin":true' else '' end||case when f is null then '' else ',"family_id":"'||f||'"' end||'}}',true)$$;
create function pg_temp.admin() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012301',null,true)$$;
create function pg_temp.release() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012302',null)$$;
create function pg_temp.content() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012305',null)$$;
create function pg_temp.support() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012306',null)$$;
create function pg_temp.parent() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301')$$;
create function pg_temp.other_parent() returns void language sql as $$select pg_temp.as_user('00000000-0000-4000-8000-000000012308','10000000-0000-4000-8000-000000012302')$$;
create function pg_temp.r(n int) returns uuid language sql as $$select ('72000000-0000-4000-8000-0000000123'||lpad(n::text,2,'0'))::uuid$$;
create function pg_temp.q(stmt text) returns text language plpgsql security definer as $$declare v text;begin execute stmt into v;return v;end$$;
grant execute on function pg_temp.q(text),pg_temp.r(int) to authenticated;
create function pg_temp.scope_allowed(u text,place uuid) returns boolean language plpgsql as $$begin
 perform set_config('request.jwt.claims','{"sub":"'||u||'","role":"authenticated","gina":{"role":"parent"}}',true);
 return gina.announcement_scope_allowed(place);end$$;

-- 0. Yüzey ---------------------------------------------------------------------------------------
select is((select string_agg(n.nspname||'.'||p.proname,',' order by n.nspname||'.'||p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','gina') and p.prokind='f' and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'EXECUTE')),
  'public.get_shared_child_view,public.unsubscribe_with_token','anon EXECUTE surface unchanged');
select ok(not has_function_privilege('service_role','public.admin_set_operator_scope(uuid,uuid,uuid,boolean,text,boolean)','EXECUTE')
  and not has_function_privilege('service_role','public.release_channel_failure_page(text,text,timestamptz,bigint,integer)','EXECUTE'),'new operator RPCs are not worker RPCs');
select ok(not has_function_privilege('authenticated','gina.contribution_question_view(jsonb,jsonb)','EXECUTE'),'note view helper is internal');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gina' and c.relname='operations_scope_commands'),'scope command receipts have RLS');
select ok(not has_table_privilege('authenticated','gina.operations_scope_commands','SELECT') and not has_table_privilege('authenticated','gina.operations_member_scopes','SELECT'),'scope tables are private');

-- 1. Kapsam yönetimi: yalnız tam yönetici -------------------------------------------------------------
set local role authenticated;
select pg_temp.release();
select throws_ok($$select public.admin_operator_scopes()$$,'42501','forbidden','release operator cannot list scopes');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'Kendine kapsam')$$,'42501','forbidden','release operator cannot change scopes');
select pg_temp.content();
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'İçerik ekibi')$$,'42501','forbidden','content operator cannot change scopes');
select pg_temp.support();
select throws_ok($$select public.admin_operator_scopes()$$,'42501','forbidden','support operator cannot list scopes');
select pg_temp.parent();
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'Veli')$$,'42501','forbidden','parent cannot change scopes');
-- Sahte admin claim'i (admins satırı yok) yetmez.
select pg_temp.as_user('00000000-0000-4000-8000-000000012302',null,true);
select throws_ok($$select public.admin_operator_scopes()$$,'42501','forbidden','admin claim without an admins row is refused');

select pg_temp.admin();
select is(jsonb_array_length(public.admin_operator_scopes()->'operators'),3,'release operators (active, scoped, expired) listed; admin and other roles not');
select is((select o->>'role_active' from jsonb_array_elements(public.admin_operator_scopes()->'operators') o where o->>'user_id'='00000000-0000-4000-8000-000000012304'),'false','expired release role shown as inactive');
select is((select o#>>'{scopes,0,name}' from jsonb_array_elements(public.admin_operator_scopes()->'operators') o where o->>'user_id'='00000000-0000-4000-8000-000000012303'),'D3 Bölge B','existing SQL scope visible');
select ok(not exists(select 1 from jsonb_array_elements(public.admin_operator_scopes()->'places') p where p->>'id'='ec000000-0000-4000-8000-000000012304'),'inactive place is not offered');
select ok(exists(select 1 from jsonb_array_elements(public.admin_operator_scopes()->'places') p where p->>'id'='ec000000-0000-4000-8000-000000012302' and p->>'parent_id'='ec000000-0000-4000-8000-000000012301'),'places carry their parent for labels');

select is(public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'Bölge A duyuruları')->>'status','granted','admin grants a region scope');
select is(public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'Bölge A duyuruları')->>'replayed','true','same request replays (double click)');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(1),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303',true,'Bölge A duyuruları')$$,'P0001','request_conflict','same request with another place is a conflict');
select is(public.admin_set_operator_scope(pg_temp.r(2),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'Tekrar ver')->>'status','unchanged','granting an existing scope is a no-op');
select is(pg_temp.q($$select count(*) from gina.operations_member_scopes where user_id='00000000-0000-4000-8000-000000012302'$$),'1','one scope row');
select is(pg_temp.q($$select count(*) from public.audit_log where action like 'operations.scope.%' and target_id='00000000-0000-4000-8000-000000012302'$$),'1','one audit row for one real change');
select is(pg_temp.q($$select details->>'place_id' from public.audit_log where action='operations.scope.granted' and target_id='00000000-0000-4000-8000-000000012302'$$),'ec000000-0000-4000-8000-000000012301','audit names the place');
select is(pg_temp.q($$select reason from public.audit_log where action='operations.scope.granted' and target_id='00000000-0000-4000-8000-000000012302'$$),'Bölge A duyuruları','audit keeps the reason');
select is(pg_temp.q($$select granted_by::text from gina.operations_member_scopes where user_id='00000000-0000-4000-8000-000000012302'$$),'00000000-0000-4000-8000-000000012301','grantor stored');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(3),'00000000-0000-4000-8000-000000012304','ec000000-0000-4000-8000-000000012301',true,'Süresi dolmuş')$$,'P0001','operator_role_required','expired release role cannot receive a scope');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(4),'00000000-0000-4000-8000-000000012305','ec000000-0000-4000-8000-000000012301',true,'İçerik operatörü')$$,'P0001','operator_role_required','scope needs the release role');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(5),'00000000-0000-4000-8000-000000012301','ec000000-0000-4000-8000-000000012301',true,'Yönetici')$$,'P0001','operator_is_admin','full admins are never scoped');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(6),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012304',true,'Kapalı yer')$$,'P0001','place_not_found','inactive place refused');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(7),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303',true,'x')$$,'P0001','invalid_input','reason required');
reset role;
-- Kapsam duyuru hedefini gerçekten daraltır (C10 tetikleyici kuralı).
select ok(not pg_temp.scope_allowed('00000000-0000-4000-8000-000000012302',null),'scoped operator can no longer target everyone');
select ok(pg_temp.scope_allowed('00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012302'),'school inside the region allowed');
select ok(not pg_temp.scope_allowed('00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303'),'other region refused');
set local role authenticated;select pg_temp.admin();
-- Son kapsamı kaldırmak "bütün bölgeler" demektir: açık onaysız yapılmaz.
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(8),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',false,'Kaldır')$$,'P0001','scope_last_would_widen','removing the last scope needs explicit confirmation');
select is(public.admin_set_operator_scope(pg_temp.r(9),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303',true,'Bölge B de')->>'scope_count','2','second scope');
select is(public.admin_set_operator_scope(pg_temp.r(10),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303',false,'Bölge B geri')->>'status','removed','non-last scope removed without extra confirmation');
select is(public.admin_set_operator_scope(pg_temp.r(11),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012303',false,'Bölge B geri')->>'status','unchanged','removing a missing scope is a no-op');
select is(public.admin_set_operator_scope(pg_temp.r(12),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',false,'Kapsam kalkıyor',true)->>'effective','all_places','last scope removed with explicit confirmation');
select is(pg_temp.q($$select count(*) from public.audit_log where action like 'operations.scope.%' and target_id='00000000-0000-4000-8000-000000012302'$$),'4','audit: grant, grant, remove, remove');
reset role;
select ok(pg_temp.scope_allowed('00000000-0000-4000-8000-000000012302',null),'operator without scope rows is global again (C10 rule)');
-- Açık oturumda admins satırı silinir: aynı JWT ile reddedilir; canlı kontrol false döner.
set local role authenticated;select pg_temp.admin();
select is(public.my_admin_access(),true,'live admin check true');
reset role;delete from public.admins where user_id='00000000-0000-4000-8000-000000012301';set local role authenticated;select pg_temp.admin();
select is(public.my_admin_access(),false,'live admin check false after the admins row is removed');
select throws_ok($$select public.admin_set_operator_scope(pg_temp.r(13),'00000000-0000-4000-8000-000000012302','ec000000-0000-4000-8000-000000012301',true,'İptal sonrası')$$,'42501','forbidden','revoked admin refused with the same token');
select pg_temp.release();
select is(public.my_admin_access(),false,'operator is not an admin');
reset role;insert into public.admins(user_id) values('00000000-0000-4000-8000-000000012301');

-- 2. Başarısız teslimler: süzgeç, sayfalama, en çok 3 yeniden sıraya alma ----------------------------
update public.app_settings set value='"smtp"' where key='channels.email.provider';
update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
insert into gina.channel_provider_status(channel,provider,configured,missing) values('email','smtp',true,'{}') on conflict(channel) do update set configured=true,missing='{}',reported_at=now();
select set_config('request.jwt.claims','',true);
insert into gina.parent_announcements(id,title,body,expires_on,status,published_at) values
 ('aa000000-0000-4000-8000-000000012301','D3 güncel duyuru','Bu duyuru yayında ve günceldir.',current_date+7,'published',now()),
 ('aa000000-0000-4000-8000-000000012302','D3 geri çekilen','Bu duyuru geri çekildi, yeniden gönderilmez.',current_date+7,'withdrawn',now());
-- 25 e-posta başarısız (güncel duyuru), 6 SMS ayar eksik, 3 mükerrer, 2 geri çekilmiş duyuru, 1 doğrulama kodu, 1 kabul edilmiş.
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,attempts,last_error,created_at)
select '00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','announcement','parent_announcement',
 '{"announcement_id":"aa000000-0000-4000-8000-000000012301","address":"secret@example.invalid"}','d3-fail-'||g,'failed',null,5,'retry_limit',now()-g*interval '1 minute'
from generate_series(1,25) g;
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,created_at)
select '00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','sms','announcement','parent_announcement',
 '{"announcement_id":"aa000000-0000-4000-8000-000000012301"}','d3-sms-'||g,'skipped','provider_unconfigured',now()-g*interval '1 minute'-interval '10 seconds'
from generate_series(1,6) g;
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,skip_reason,created_at)
select '00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','announcement','parent_announcement',
 '{"announcement_id":"aa000000-0000-4000-8000-000000012301"}','d3-dup-'||g,'skipped','duplicate_recipient',now()-g*interval '2 minute' from generate_series(1,3) g;
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,last_error,created_at)
select '00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','announcement','parent_announcement',
 '{"announcement_id":"aa000000-0000-4000-8000-000000012302"}','d3-wd-'||g,'failed','smtp:550',now()-g*interval '3 minute' from generate_series(1,2) g;
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,last_error,created_at) values
 ('00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','service','contact_verification','{"secret":"ABC123"}','d3-code','failed','smtp:550',now()),
 ('00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','announcement','parent_announcement','{"announcement_id":"aa000000-0000-4000-8000-000000012301"}','d3-ok','accepted',null,now());
-- 116 gibi eski satırlar (30 günden eski) listeye girmez.
insert into gina.channel_outbox(user_id,family_id,channel,purpose,kind,payload,dedupe_key,status,last_error,created_at) values
 ('00000000-0000-4000-8000-000000012307','10000000-0000-4000-8000-000000012301','email','announcement','parent_announcement','{"announcement_id":"aa000000-0000-4000-8000-000000012301"}','d3-old','failed','smtp:550',now()-interval '40 days');
create temp table seen(id bigint);grant all on seen to authenticated;
set local role authenticated;
select pg_temp.parent();
select throws_ok($$select public.release_channel_failure_page()$$,'42501','forbidden','parent cannot read delivery failures');
select pg_temp.content();
select throws_ok($$select public.release_channel_failure_page()$$,'42501','forbidden','content operator cannot read delivery failures');
select pg_temp.release();
select is((public.release_channel_failure_page()->>'total')::int,37,'all failed/skipped rows of the last 30 days (accepted and old rows excluded)');
select is(jsonb_array_length(public.release_channel_failure_page(null,null,null,null,10)->'rows'),10,'first page of 10');
insert into seen select (r->>'id')::bigint from jsonb_array_elements(public.release_channel_failure_page(null,null,null,null,10)->'rows') r;
create temp table cur(at timestamptz,id bigint);grant all on cur to authenticated;
insert into cur select (p#>>'{next,before}')::timestamptz,(p#>>'{next,before_id}')::bigint from (select public.release_channel_failure_page(null,null,null,null,10) p) x;
insert into seen select (r->>'id')::bigint from jsonb_array_elements(public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10)->'rows') r;
update cur set (at,id)=(select (p#>>'{next,before}')::timestamptz,(p#>>'{next,before_id}')::bigint from (select public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10) p) x);
insert into seen select (r->>'id')::bigint from jsonb_array_elements(public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10)->'rows') r;
update cur set (at,id)=(select (p#>>'{next,before}')::timestamptz,(p#>>'{next,before_id}')::bigint from (select public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10) p) x);
select is(jsonb_array_length(public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10)->'rows'),7,'last page holds the remainder (10+10+10+7)');
select ok(public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10)->'next'='null'::jsonb,'no next cursor after the last page');
insert into seen select (r->>'id')::bigint from jsonb_array_elements(public.release_channel_failure_page(null,null,(select at from cur),(select id from cur),10)->'rows') r;
select is((select count(distinct id)::int from seen),37,'pages cover every row exactly once');
select is((select count(*)::int from seen),37,'no row repeated across pages');
select is((public.release_channel_failure_page('sms')->>'total')::int,6,'channel filter');
select is((public.release_channel_failure_page(null,'duplicate_recipient')->>'total')::int,3,'reason filter: duplicate');
select is((public.release_channel_failure_page(null,'failed')->>'total')::int,28,'reason filter: failed (25 + 2 withdrawn + 1 code)');
select is((public.release_channel_failure_page(null,'requeueable')->>'total')::int,31,'requeueable: current announcement failures + unconfigured skips; never codes, duplicates or withdrawn');
select is((public.release_channel_failure_page('sms','requeueable')->>'total')::int,6,'filters combine');
select is((public.release_channel_failure_page(null,null,null,null,500)->>'limit')::int,100,'limit clamped to 100');
select throws_ok($$select public.release_channel_failure_page('push')$$,'P0001','invalid_input','unknown channel refused');
select throws_ok($$select public.release_channel_failure_page(null,'retry')$$,'P0001','invalid_input','unknown reason refused');
select throws_ok($$select public.release_channel_failure_page(null,null,now(),null)$$,'P0001','cursor_invalid','half cursor refused');
select ok(not exists(select 1 from jsonb_array_elements(public.release_channel_failure_page(null,null,null,null,100)->'rows') r
  where r ? 'payload' or r ? 'recipient' or r::text like '%secret%' or r::text like '%ABC123%'),'no address, payload or code in the list');
select is((select r->>'requeueable' from jsonb_array_elements(public.release_channel_failure_page(null,'failed',null,null,100)->'rows') r where r->>'kind'='contact_verification'),'false','verification codes are never requeueable');
-- En çok 3 kez yeniden sıraya alma (C10 RPC'si), sayfa kalan hakkı gösterir.
reset role;insert into cur(at,id) select null,(select id from gina.channel_outbox where dedupe_key='d3-fail-1');set local role authenticated;select pg_temp.release();
select is(public.release_requeue_channel((select id from cur where at is null))->>'status','queued','requeue 1');
select is(public.release_requeue_channel((select id from cur where at is null))->>'status','already_queued','double click does not queue twice');
reset role;update gina.channel_outbox set status='failed' where dedupe_key='d3-fail-1';set local role authenticated;select pg_temp.release();
select is(public.release_requeue_channel((select id from cur where at is null))->>'status','queued','requeue 2');
reset role;update gina.channel_outbox set status='failed' where dedupe_key='d3-fail-1';set local role authenticated;select pg_temp.release();
select is((select r->>'requeues_left' from jsonb_array_elements(public.release_channel_failure_page('email','failed',null,null,100)->'rows') r where (r->>'id')::bigint=(select id from cur where at is null)),'1','page shows one requeue left');
select is(public.release_requeue_channel((select id from cur where at is null))->>'status','queued','requeue 3');
reset role;update gina.channel_outbox set status='failed' where dedupe_key='d3-fail-1';set local role authenticated;select pg_temp.release();
select throws_ok($$select public.release_requeue_channel((select id from cur where at is null))$$,'P0001','channel_requeue_limit','fourth requeue refused');
select is((select r->>'requeueable' from jsonb_array_elements(public.release_channel_failure_page('email','failed',null,null,100)->'rows') r where (r->>'id')::bigint=(select id from cur where at is null)),'false','row no longer offered after 3 requeues');
select is(pg_temp.q($$select count(*) from public.audit_log where action='channel.requeue' and target_id=(select id::text from gina.channel_outbox where dedupe_key='d3-fail-1')$$),'3','one audit row per real requeue');

-- 3. Soru bazlı ret notu ---------------------------------------------------------------------------
reset role;
update public.app_settings set value='true' where key in('sources.enabled','question_groups.enabled','contribution_sets.enabled');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values
 ('40000000-0000-4000-8000-000000012301','10000000-0000-4000-8000-000000012301',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\nSekiz dilimli pasta.\n\nİki dilim kaçta kaçtır?','2/8','İki bölü sekiz.'),
 ('40000000-0000-4000-8000-000000012302','10000000-0000-4000-8000-000000012301',5,'Matematik','Kesirler','open_ended','orta',E'Pasta\nSekiz dilimli pasta.\n\nYarısı kaç dilimdir?','5','Sekizin yarısı.'),
 ('40000000-0000-4000-8000-000000012303','10000000-0000-4000-8000-000000012301',5,'Matematik','Çevre','open_ended','orta','Karenin bir kenarı 3 cm. Çevresi kaç cm?','10','Dört kenar toplanır.'),
 ('40000000-0000-4000-8000-000000012304','10000000-0000-4000-8000-000000012301',5,'Matematik','Alan','open_ended','orta','Kenarı 2 cm olan karenin alanı kaç cm²?','4','Kenar çarpı kenar.'),
 ('40000000-0000-4000-8000-000000012305','10000000-0000-4000-8000-000000012301',5,'Matematik','Kesirler','open_ended','orta',E'Elma\nOn iki elma var.\n\nÜçte biri kaç elmadır?','4','On iki bölü üç.'),
 ('40000000-0000-4000-8000-000000012306','10000000-0000-4000-8000-000000012301',5,'Matematik','Kesirler','open_ended','orta',E'Elma\nOn iki elma var.\n\nDörtte biri kaç elmadır?','3','On iki bölü dört.');
insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values
 ('50000000-0000-4000-8000-000000012301','10000000-0000-4000-8000-000000012301','50000000-0000-4000-8000-000000012301',1,'Pasta','Sekiz dilimli pasta.',5,'Matematik'),
 ('50000000-0000-4000-8000-000000012302','10000000-0000-4000-8000-000000012301','50000000-0000-4000-8000-000000012302',1,'Elma','On iki elma var.',5,'Matematik');
insert into public.question_source_members(group_id,question_id,position,prompt) values
 ('50000000-0000-4000-8000-000000012301','40000000-0000-4000-8000-000000012301',1,'İki dilim kaçta kaçtır?'),('50000000-0000-4000-8000-000000012301','40000000-0000-4000-8000-000000012302',2,'Yarısı kaç dilimdir?'),
 ('50000000-0000-4000-8000-000000012302','40000000-0000-4000-8000-000000012305',1,'Üçte biri kaç elmadır?'),('50000000-0000-4000-8000-000000012302','40000000-0000-4000-8000-000000012306',2,'Dörtte biri kaç elmadır?');
update public.question_source_groups set finalized_at=now() where id in('50000000-0000-4000-8000-000000012301','50000000-0000-4000-8000-000000012302');
create function pg_temp.teacher(ans text) returns jsonb language sql as $$select jsonb_build_object('correct_key',null,'expected_answer',ans,'solution','Çözüm: '||ans,'explanation','Açıklama.','common_misconception','Yanılgı.','next_step','Sonraki adım.','rubric',jsonb_build_object('max_points',2,'scoring','Ölçüt başına bir puan.','criteria',jsonb_build_array(jsonb_build_object('id','c1','points',1,'criterion','Sonuç doğru.'),jsonb_build_object('id','c2','points',1,'criterion','Gerekçe var.')),'missing_answer','not_answered','review_required',true))$$;
grant execute on function pg_temp.teacher(text) to authenticated;
set local role authenticated;select pg_temp.parent();
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012301','40000000-0000-4000-8000-000000012301',true,true)->>'status','pending','grouped copy pending');
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012303','40000000-0000-4000-8000-000000012303',true,true)->>'status','pending','standalone copy pending');
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012304','40000000-0000-4000-8000-000000012304',true,true)->>'status','pending','second standalone copy pending');
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012306','40000000-0000-4000-8000-000000012305',true,true)->>'status','pending','second grouped copy pending');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'{"q2":"Yarısı 4 dilimdir; cevap 5 yazılmış."}'::jsonb)$$,'42501','forbidden','parent cannot decide');
select pg_temp.release();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'{"q2":"Yarısı 4 dilimdir; cevap 5 yazılmış."}'::jsonb)$$,'42501','forbidden','release operator cannot decide (C07 content gate)');
select pg_temp.content();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',true,'Kabul',jsonb_build_object('q1',pg_temp.teacher('2/8'),'q2',pg_temp.teacher('4')),true,'{"q2":"Not yazıldı"}'::jsonb)$$,'P0001','question_notes_reject_only','question notes only with a rejection; acceptance stays whole-group');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'{"q9":"Böyle bir soru yok"}'::jsonb)$$,'P0001','question_notes_invalid','unknown question key refused');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'{"q2":"x"}'::jsonb)$$,'P0001','question_notes_invalid','too short question note refused');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'["q2"]'::jsonb)$$,'P0001','question_notes_invalid','notes must be an object');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Yarısı yanlış','{}'::jsonb,true,'{"q2":42}'::jsonb)$$,'P0001','question_notes_invalid','note must be text');
select is(pg_temp.q($$select status from gina.contribution_sets where id='61000000-0000-4000-8000-000000012301'$$),'pending','invalid notes changed nothing');
select is(public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Grubun bir sorusu düzeltilmeli.','{}'::jsonb,true,'{"q2":"  Yarısı 4 dilimdir; cevap 5 yazılmış.  "}'::jsonb)->>'status','rejected','content operator rejects the whole group with a note on one question');
select is(pg_temp.q($$select question_notes->>'q2' from gina.contribution_sets where id='61000000-0000-4000-8000-000000012301'$$),'Yarısı 4 dilimdir; cevap 5 yazılmış.','note stored trimmed under the question key');
select is(public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Grubun bir sorusu düzeltilmeli.','{}'::jsonb,true,'{"q2":"Yarısı 4 dilimdir; cevap 5 yazılmış."}'::jsonb)->>'status','rejected','same request replays');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(30),'61000000-0000-4000-8000-000000012301',false,'Grubun bir sorusu düzeltilmeli.','{}'::jsonb,true,'{"q1":"Başka not"}'::jsonb)$$,'P0001','request_conflict','same request with different notes is a conflict');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(31),'61000000-0000-4000-8000-000000012301',false,'İkinci ret','{}'::jsonb,true,'{"q1":"Başka not"}'::jsonb)$$,'P0001','contribution_changed','a decided copy cannot be re-decided');
select is(pg_temp.q($$select count(*) from public.audit_log where action='contribution_set.question_notes' and target_id='61000000-0000-4000-8000-000000012301'$$),'1','question notes audited once');
select is(pg_temp.q($$select count(*) from public.audit_log where action='contribution_set.rejected' and target_id='61000000-0000-4000-8000-000000012301'$$),'1','rejection audited once');
select is(public.admin_get_contribution_set('61000000-0000-4000-8000-000000012301')#>>'{question_notes,q2}','Yarısı 4 dilimdir; cevap 5 yazılmış.','review screen reads the question notes');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>>'{steps,0,questions,1,note}','Yarısı 4 dilimdir; cevap 5 yazılmış.','content operator trail shows per-question notes');
select is(public.admin_decide_contribution_set(pg_temp.r(32),'61000000-0000-4000-8000-000000012303',false,'Çevre hesabı düzeltilmeli.','{}'::jsonb,true,'{"q1":"Çevre 4 × 3 = 12 cm; cevap 10 yazılmış."}'::jsonb)->>'status','rejected','standalone copy rejected with a question note');
-- 6 parametreli eski çağrı aynen çalışır; notsuz kararda soru listesi boş.
select is(public.admin_decide_contribution_set(pg_temp.r(33),'61000000-0000-4000-8000-000000012304',false,'Çözüm eksik.','{}'::jsonb,true)->>'status','rejected','legacy 6-argument rejection unchanged');
select is(public.admin_get_contribution_set('61000000-0000-4000-8000-000000012304')->'question_notes','null'::jsonb,'no question notes on a legacy rejection');
reset role;
select throws_ok($$update gina.contribution_sets set question_notes='{"q1":"Değiştirildi"}' where id='61000000-0000-4000-8000-000000012301'$$,'P0001','contribution_notes_immutable','question notes cannot be rewritten');
set local role authenticated;select pg_temp.parent();
select is(jsonb_array_length(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>'{steps,0,questions}'),2,'parent sees every question of the rejected group');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>>'{steps,0,questions,1,note}','Yarısı 4 dilimdir; cevap 5 yazılmış.','parent sees the note on the second question');
select ok(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>'{steps,0,questions,0,note}'='null'::jsonb,'first question has no correction note');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>>'{steps,0,questions,1,excerpt}','Yarısı kaç dilimdir?','question identified by a short excerpt');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>>'{steps,0,questions,1,position}','2','position kept');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>>'{steps,0,review_note}','Grubun bir sorusu düzeltilmeli.','general note still shown');
select ok(public.contribution_review_trail('61000000-0000-4000-8000-000000012301')->'family_id'='null'::jsonb and public.contribution_review_trail('61000000-0000-4000-8000-000000012301')#>'{steps,0,reviewed_by}'='null'::jsonb,'family view still omits internal ids');
select is(jsonb_array_length(public.contribution_review_trail('61000000-0000-4000-8000-000000012304')#>'{steps,0,questions}'),0,'legacy rejection: no per-question list');
select pg_temp.other_parent();
select throws_ok($$select public.contribution_review_trail('61000000-0000-4000-8000-000000012301')$$,'P0001','contribution_not_found','another family cannot read the notes');
-- Düzeltme zinciri: ret notu reddedilen adımda kalır, düzeltilmiş kopyanın kabulünde not yoktur.
reset role;update public.question_bank set expected_answer='12',solution='4 × 3 = 12 cm.' where id='40000000-0000-4000-8000-000000012303';
set local role authenticated;select pg_temp.parent();
select is(public.begin_question_contribution('61000000-0000-4000-8000-000000012305','40000000-0000-4000-8000-000000012303',true,true)->>'supersedes_id','61000000-0000-4000-8000-000000012303','corrected copy links to the rejected one');
-- Kabul içe aktarma (admin_import_library_bundle) yönetici yazmasıdır (C07); kabul bu nedenle yöneticiyle.
select pg_temp.admin();
select is(public.admin_decide_contribution_set(pg_temp.r(34),'61000000-0000-4000-8000-000000012305',true,'Düzeltme kabul',jsonb_build_object('q1',pg_temp.teacher('12')),true)->>'status','approved','corrected copy accepted');
reset role;
select throws_ok($$update gina.contribution_sets set question_notes='{"q1":"Kabulden sonra"}' where id='61000000-0000-4000-8000-000000012305'$$,'P0001','question_notes_reject_only','an accepted copy cannot get question notes');
set local role authenticated;select pg_temp.parent();
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012305')#>>'{steps,1,decision}','approved','trail shows the accepted correction');
select is(jsonb_array_length(public.contribution_review_trail('61000000-0000-4000-8000-000000012305')#>'{steps,1,questions}'),0,'accepted step carries no correction notes');
select is(public.contribution_review_trail('61000000-0000-4000-8000-000000012305')#>>'{steps,0,questions,0,note}','Çevre 4 × 3 = 12 cm; cevap 10 yazılmış.','rejected step keeps its note in the chain');
-- Ortak kaynaklı grup: kabul yine bütün grup içindir.
select pg_temp.content();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(35),'61000000-0000-4000-8000-000000012306',true,'Yalnız ilk soru',jsonb_build_object('q1',pg_temp.teacher('4')),true)$$,'P0001','contribution_review_required','partial acceptance of a shared group still refused');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(35),'61000000-0000-4000-8000-000000012306',true,'Yalnız ilk soru',jsonb_build_object('q1',pg_temp.teacher('4')),true,'{"q2":"İkinci soru sonra"}'::jsonb)$$,'P0001','question_notes_reject_only','notes cannot turn into a partial acceptance');
select pg_temp.admin();
select is(public.admin_decide_contribution_set(pg_temp.r(36),'61000000-0000-4000-8000-000000012306',true,'Bütün grup kabul',jsonb_build_object('q1',pg_temp.teacher('4'),'q2',pg_temp.teacher('3')),true,'{}'::jsonb)->>'credited_questions','2','whole group accepted (7-argument call with empty notes = legacy decision)');
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(37),'61000000-0000-4000-8000-000000012306',true,'Tekrar',jsonb_build_object('q1',pg_temp.teacher('4'),'q2',pg_temp.teacher('3')),true)$$,'P0001','contribution_changed','no second acceptance');
-- Operatör rolü iptal edilince aynı JWT ile karar verilemez (C07 canlı rol).
reset role;update public.operations_members set revoked_at=now() where user_id='00000000-0000-4000-8000-000000012305';
set local role authenticated;select pg_temp.content();
select throws_ok($$select public.admin_decide_contribution_set(pg_temp.r(38),'61000000-0000-4000-8000-000000012304',false,'İptal sonrası','{}'::jsonb,true,'{"q1":"Not yazılamaz"}'::jsonb)$$,'42501','forbidden','revoked content operator refused');
reset role;
select * from finish();
rollback;
