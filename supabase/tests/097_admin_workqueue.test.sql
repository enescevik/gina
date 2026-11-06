begin;
select no_plan();
-- B01: iş kuyruğu rol görünürlüğü, aile arama keyset sayfalama (100+), hak zaman çizgisi tür ayrımı,
-- override önizleme/uygulama idempotency, iptal/süresi dolmuş yönetici ve veli/çocuk/cihaz reddi.
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000009701','b01-admin@example.invalid',false),
 ('00000000-0000-4000-8000-000000009702','b01-support@example.invalid',false),
 ('00000000-0000-4000-8000-000000009703','b01-finance@example.invalid',false),
 ('00000000-0000-4000-8000-000000009704','b01-expired@example.invalid',false),
 ('00000000-0000-4000-8000-000000009705','b01-revoked@example.invalid',false),
 ('00000000-0000-4000-8000-000000009706','b01-parent-zeynep@example.invalid',false),
 ('00000000-0000-4000-8000-000000009707',null,true),
 ('00000000-0000-4000-8000-000000009708','b01-admin2@example.invalid',false);
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000009701'),('00000000-0000-4000-8000-000000009708');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000009702','support',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000009703','finance',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000009704','support',now()-interval '1 minute',null),
 ('00000000-0000-4000-8000-000000009705','finance',now()+interval '30 days',now()-interval '1 minute');
insert into public.families(id,name,created_by,timezone) values
 ('10000000-0000-4000-8000-000000009701','Yıldız ailesi','00000000-0000-4000-8000-000000009706','Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000009702','Diğer aile','00000000-0000-4000-8000-000000009701','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','Elif',5),
 ('20000000-0000-4000-8000-000000009702','10000000-0000-4000-8000-000000009702','Kerem',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('60000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009707','20000000-0000-4000-8000-000000009701');
-- 120 sayfalama ailesi (ilk 100 sınırının ötesi)
insert into public.families(id,name,created_by,created_at)
 select ('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Sayfa '||g,'00000000-0000-4000-8000-000000009701',now()-make_interval(mins=>g) from generate_series(1,120) g;
-- Destek biletleri: açık (2 gün bekleyen, operatör cevapsız), işlemde (operatör cevaplı), fikir
insert into public.help_tickets(id,family_id,created_by,kind,category,subject,status,created_at,updated_at) values
 ('70000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','support','billing','Paket görünmüyor','open',now()-interval '2 days',now()-interval '2 days'),
 ('70000000-0000-4000-8000-000000009702','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','support','device','Tablet eşleşmiyor','in_progress',now()-interval '1 hour',now()-interval '1 hour'),
 ('70000000-0000-4000-8000-000000009703','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','idea','learning','Yeni ders','open',now(),now());
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body) values
 ('70000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','parent','family','Plus aldım ama görünmüyor'),
 ('70000000-0000-4000-8000-000000009702','00000000-0000-4000-8000-000000009706','parent','family','Kod kabul edilmiyor'),
 ('70000000-0000-4000-8000-000000009702','00000000-0000-4000-8000-000000009702','support','family','Bakıyoruz');
-- İçerik: bekleyen katkı ve AI ön inceleme needs_admin
insert into public.question_contributions(id,family_id,submitted_by,content,content_hash,status,consent_version)
 values('71000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','{"stem":"2+2"}','h1','pending','v1');
insert into gina.content_prereviews(target_kind,target_id,content_hash,prereview_status,prereview_at)
 values('contribution_set','71000000-0000-4000-8000-000000009701',repeat('a',64),'needs_admin',now()-interval '3 hours');
-- Ödeme: mağaza aboneliği, olaylar (satın alma, yenileme, iade), telafi (biri iptal), elle kontrol
insert into public.store_subscriptions(id,family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at,auto_renewing,created_at)
 values('72000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009706','apple','gina_plus_monthly','plus','b01-apple-key-1','active',now()+interval '20 days',true,now()-interval '40 days');
insert into public.store_notifications(id,platform,event_key,event_type,store_key,payload,processed_at,received_at) values
 ('73000000-0000-4000-8000-000000009701','apple','b01-evt-1','SUBSCRIBED:INITIAL_BUY','b01-apple-key-1','{"verified":true}',now()-interval '40 days',now()-interval '40 days'),
 ('73000000-0000-4000-8000-000000009702','apple','b01-evt-2','DID_RENEW','b01-apple-key-1','{"verified":true}',now()-interval '10 days',now()-interval '10 days'),
 ('73000000-0000-4000-8000-000000009703','apple','b01-evt-3','REFUND','b01-apple-key-1','{"verified":true}',null,now()-interval '1 day'),
 ('73000000-0000-4000-8000-000000009704','apple','b01-evt-4','DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED','b01-apple-key-1','{"verified":true}',now()-interval '2 days',now()-interval '2 days');
insert into public.entitlement_overrides(id,family_id,plan,reason,granted_by,starts_at,ends_at,revoked_at,created_at) values
 ('74000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','pro','Eski telafi','00000000-0000-4000-8000-000000009701',now()-interval '30 days',now()-interval '20 days',null,now()-interval '30 days'),
 ('74000000-0000-4000-8000-000000009702','10000000-0000-4000-8000-000000009701','pro','İptal edilen','00000000-0000-4000-8000-000000009701',now()-interval '5 days',now()+interval '5 days',now()-interval '4 days',now()-interval '5 days');
insert into gina.store_reconcile_jobs(id,actor_id,family_id,subscription_id,reason,status,code,created_at,completed_at)
 values('75000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009703','10000000-0000-4000-8000-000000009701','72000000-0000-4000-8000-000000009701','Veli iade dedi, mağazadan kontrol','failed','store_not_configured',now()-interval '3 days',now()-interval '3 days');
-- Yayın: başarısız push; AI: başarısız iş
insert into public.push_outbox(family_id,audience,kind,status,attempts,created_at) values('10000000-0000-4000-8000-000000009701','parents','task_approved','failed',3,now()-interval '6 hours');
insert into public.ai_operation_jobs(family_id,action,input_hash,lease,status,error_code,created_at) values('10000000-0000-4000-8000-000000009701','grade','h-b01',gen_random_uuid(),'failed','provider_error',now()-interval '2 hours');

create function pg_temp.actor(id text, admin boolean default false, role_name text default 'parent', family text default '10000000-0000-4000-8000-000000009701') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',role_name,'admin',admin))::text,true)::void$$;
create function pg_temp.item(q jsonb, k text) returns jsonb language sql as $$
 select x from jsonb_array_elements(q->'items') x where x->>'key'=k limit 1$$;
create function pg_temp.roles_in(q jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_agg(distinct x->>'role'),'[]') from jsonb_array_elements(q->'items') x$$;

set local role authenticated;
-- Veli, cihaz ve anonim: hepsi reddedilir
select pg_temp.actor('00000000-0000-4000-8000-000000009706');
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','parent cannot read the workqueue');
select throws_ok($$select public.admin_families_search('Yıldız')$$,'42501','forbidden','parent cannot search families');
select throws_ok($$select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')$$,'42501','forbidden','parent cannot read own family timeline through the admin RPC');
select throws_ok($$select public.admin_override_preview('10000000-0000-4000-8000-000000009701','plus',now()+interval '7 days','deneme')$$,'42501','forbidden','parent cannot preview overrides');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009701','plus',now()+interval '7 days','deneme',gen_random_uuid())$$,'42501','forbidden','parent cannot apply overrides');
select pg_temp.actor('00000000-0000-4000-8000-000000009707',false,'device');
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','device cannot read the workqueue');
select throws_ok($$select public.admin_families_search('Yıldız')$$,'42501','forbidden','device cannot search families');
-- Veli, admin claim'i taklit etse bile admins satırı yoksa reddedilir
select pg_temp.actor('00000000-0000-4000-8000-000000009706',true);
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','forged admin claim without admins row is refused');
-- Süresi dolmuş ve iptal edilmiş operatörler
select pg_temp.actor('00000000-0000-4000-8000-000000009704');
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','expired support operator is refused');
select pg_temp.actor('00000000-0000-4000-8000-000000009705');
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','revoked finance operator is refused');
select throws_ok($$select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')$$,'42501','forbidden','revoked finance operator cannot read timelines');

-- Destek operatörü: yalnız destek kalemleri; ödeme görmez
select pg_temp.actor('00000000-0000-4000-8000-000000009702');
select is(public.admin_workqueue()->'roles','["support"]'::jsonb,'support operator sees only the support role');
select is(pg_temp.roles_in(public.admin_workqueue()),'["support"]'::jsonb,'support items only');
select is((pg_temp.item(public.admin_workqueue(),'tickets_open')->>'count')::int,1,'one open support ticket');
select is((pg_temp.item(public.admin_workqueue(),'tickets_unassigned')->>'count')::int,2,'C07: unassigned = open/in-progress support tickets with no assignee (the replied in-progress ticket is still unassigned)');
select is((pg_temp.item(public.admin_workqueue(),'tickets_sla_breached')->>'count')::int,1,'two-day-old open ticket breaches SLA');
select ok((pg_temp.item(public.admin_workqueue(),'tickets_sla_breached')->>'oldest_waiting_seconds')::bigint>=2*86400-5,'oldest waiting time reported');
select is(pg_temp.item(public.admin_workqueue(),'tickets_sla_breached')->>'reason','waiting_over_24h','reason attached');
select is((pg_temp.item(public.admin_workqueue(),'ideas_open')->>'count')::int,1,'open idea counted');
select is(pg_temp.item(public.admin_workqueue(),'store_notifications_attention'),null,'support never sees billing items');
select is(pg_temp.item(public.admin_workqueue(),'ai_failed_operations'),null,'support never sees the AI failure queue');
select throws_ok($$select public.admin_workqueue('finance')$$,'42501','forbidden','support cannot request the finance queue');
select throws_ok($$select public.admin_workqueue('bogus')$$,'22023','invalid_input','unknown role rejected');
select is(public.admin_workqueue('support')->'roles','["support"]'::jsonb,'explicit own role allowed');
-- Destek aile arar ama zaman çizgisi/override göremez
select is(jsonb_array_length(public.admin_families_search('Yıldız')->'rows'),1,'support finds family by name');
select is(public.admin_families_search('Elif')->'rows'->0->>'name','Yıldız ailesi','child name search finds the family');
select is(public.admin_families_search('Elif')->'rows'->0->'matched_on','["child_name"]'::jsonb,'match flag names the child match without returning the child');
select is(public.admin_families_search('zeynep@')->'rows'->0->'matched_on','["email"]'::jsonb,'email fragment matches without returning the address');
select ok(not (public.admin_families_search('zeynep@')->'rows'->0 ? 'email'),'no email column in rows');
select is(public.admin_families_search('Yıldız')->'rows'->0->>'plan','plus','effective plan from store subscription');
select is((public.admin_families_search('Yıldız')->'rows'->0->>'child_count')::int,1,'child count');
select is(public.admin_families_search('Yıldız')->'rows'->0->>'store_status','active','latest store status');
select is((public.admin_families_search('Yıldız')->'rows'->0->>'active_override_count')::int,0,'expired and revoked comps are not active');
select throws_ok($$select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')$$,'42501','forbidden','support cannot read the entitlement timeline');
select throws_ok($$select public.admin_override_preview('10000000-0000-4000-8000-000000009701','plus',now()+interval '7 days','deneme')$$,'42501','forbidden','support cannot preview overrides');

-- Finans operatörü: yalnız ödeme kalemleri; destek görmez; zaman çizgisi türleri ayrı
select pg_temp.actor('00000000-0000-4000-8000-000000009703');
select is(pg_temp.roles_in(public.admin_workqueue()),'["finance"]'::jsonb,'finance items only');
select is((pg_temp.item(public.admin_workqueue(),'store_notifications_attention')->>'count')::int,1,'unprocessed refund notification waits');
select is((pg_temp.item(public.admin_workqueue(),'reconcile_jobs_failed')->>'count')::int,1,'failed manual store check waits');
select is(pg_temp.item(public.admin_workqueue(),'tickets_open'),null,'finance never sees support tickets');
select throws_ok($$select public.admin_override_preview('10000000-0000-4000-8000-000000009701','plus',now()+interval '7 days','deneme')$$,'42501','forbidden','finance cannot preview overrides (admin only)');
select throws_ok($$select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009799')$$,'P0001','family_not_found','unknown family rejected');
select is(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'family'->>'name','Yıldız ailesi','timeline is pinned to the family');
select is(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'family'->'effective'->>'source','store','effective source shown');
select is((select coalesce(jsonb_agg(e->>'kind' order by e->>'kind'),'[]') from jsonb_array_elements(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'events') e),
 '["comp_expired","comp_granted","comp_granted","comp_revoked","store_cancel","store_check_requested","store_purchase","store_refund","store_renewal","store_subscription"]'::jsonb,
 'refund, cancel, comp grant/revoke/expiry and manual store check are distinct kinds');
select is((select e->'data'->>'is_refund' from jsonb_array_elements(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'events') e where e->>'kind'='store_check_requested'),'false','manual store check is explicitly not a refund');
select is((select e->'data'->>'processed' from jsonb_array_elements(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'events') e where e->>'kind'='store_refund'),'false','unprocessed refund event flagged');
select is(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701')->'events'->0->>'kind','store_refund','newest event first');
-- Zaman çizgisi keyset sayfalama: 4+4+2, kesişimsiz
select is(jsonb_array_length(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701',null,4)->'events'),4,'timeline page size respected');
select is((public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701',null,4)->>'has_more')::boolean,true,'timeline has more');
select is((with p1 as (select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701',null,4) j),
  p2 as (select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701',(select j->>'next_cursor' from p1),4) j),
  p3 as (select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701',(select j->>'next_cursor' from p2),4) j)
  select jsonb_build_object('n2',jsonb_array_length((select j->'events' from p2)),'n3',jsonb_array_length((select j->'events' from p3)),'more3',(select j->>'has_more' from p3)::boolean,
   'distinct',(select count(distinct (e->>'kind')||(e->>'id')) from (select jsonb_array_elements(j->'events') e from p1 union all select jsonb_array_elements(j->'events') from p2 union all select jsonb_array_elements(j->'events') from p3) x))),
 '{"n2":4,"n3":2,"more3":false,"distinct":10}'::jsonb,'timeline pages are disjoint and complete');
select throws_ok($$select public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009701','garbage')$$,'22023','cursor_invalid','bad timeline cursor rejected');

-- Yönetici: tüm roller, AI kuyruğu S06 ile tutarlı, 100+ sayfalama
select pg_temp.actor('00000000-0000-4000-8000-000000009701',true);
select is(public.admin_workqueue()->'roles','["admin","support","content","finance","release"]'::jsonb,'full admin carries every role');
select is(pg_temp.roles_in(public.admin_workqueue()),'["admin","content","finance","release","support"]'::jsonb,'admin sees every queue');
select is((pg_temp.item(public.admin_workqueue(),'ai_failed_operations')->>'count')::int,(public.admin_ai_failed_operations()->>'total')::int,'AI failure count matches admin_ai_failed_operations');
select is((pg_temp.item(public.admin_workqueue(),'ai_failed_operations')->>'count')::int,1,'one failed AI job');
select is((pg_temp.item(public.admin_workqueue(),'push_attention')->>'count')::int,1,'failed push in release queue');
select is((pg_temp.item(public.admin_workqueue(),'contributions_pending')->>'count')::int,1,'pending contribution in review queue');
select is((pg_temp.item(public.admin_workqueue(),'prereview_needs_admin')->>'count')::int,1,'needs_admin prereview in review queue');
select is(pg_temp.roles_in(public.admin_workqueue('support')),'["support"]'::jsonb,'admin can narrow to one role');
select is(jsonb_array_length(public.admin_families_search('Sayfa',null,50)->'rows'),50,'first page holds 50 rows');
select is((public.admin_families_search('Sayfa',null,50)->>'has_more')::boolean,true,'more pages after 50');
select is((with p1 as (select public.admin_families_search('Sayfa',null,50) j),
  p2 as (select public.admin_families_search('Sayfa',(select j->>'next_cursor' from p1),50) j),
  p3 as (select public.admin_families_search('Sayfa',(select j->>'next_cursor' from p2),50) j)
  select jsonb_build_object('n2',jsonb_array_length((select j->'rows' from p2)),'n3',jsonb_array_length((select j->'rows' from p3)),'more3',(select j->>'has_more' from p3)::boolean,
   'cursor3',(select j->'next_cursor' from p3),
   'distinct',(select count(distinct r->>'id') from (select jsonb_array_elements(j->'rows') r from p1 union all select jsonb_array_elements(j->'rows') from p2 union all select jsonb_array_elements(j->'rows') from p3) x))),
 '{"n2":50,"n3":20,"more3":false,"cursor3":null,"distinct":120}'::jsonb,'120 families are reachable through three disjoint keyset pages');
select is(jsonb_array_length(public.admin_families_search('Sayfa',null,200)->'rows'),120,'limit 200 returns all 120 at once');
select is(jsonb_array_length(public.admin_families_search('Sayfa',null,999)->'rows'),120,'limit above 200 is clamped, not rejected');
select is(jsonb_array_length(public.admin_families_search(null,null,200)->'rows'),122,'empty query lists every family');
select throws_ok($$select public.admin_families_search('Sayfa','not-a-cursor')$$,'22023','cursor_invalid','bad family cursor rejected');
select throws_ok($$select public.admin_families_search(repeat('x',121))$$,'22023','invalid_input','overlong query rejected');
select is(jsonb_array_length(public.admin_families_search('%')->'rows'),0,'wildcard characters are escaped, not interpreted');
select is(public.admin_families_search('10000000-0000-4000-8000-000000009702')->'rows'->0->'matched_on','["id"]'::jsonb,'exact id lookup');

-- Önizleme: yanlış aile açık görünür, önce/sonra, çakışma, hazır süreler, engeller
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'family'->>'name','Diğer aile','preview names the family so a wrong target is visible');
select is((public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'family'->>'child_count')::int,1,'preview shows child count');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'before'->>'plan','free','before: free');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'after'->>'source','comp','after: comp');
select is((public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->>'can_apply')::boolean,true,'preview can apply');
select is((select c->>'direction' from jsonb_array_elements(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'changes') c where c->>'limit'='max_children'),'opens','max_children opens');
select is((select c->>'direction' from jsonb_array_elements(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'changes') c where c->>'limit'='ai_weekly'),'opens','ai_weekly opens');
select is((select c->>'direction' from jsonb_array_elements(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'changes') c where c->>'limit'='max_notes'),'opens','null limit means unlimited and opens');
select is(jsonb_array_length(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'presets'),3,'7/30/90 day presets');
select ok((select bool_and((p->>'until')::timestamptz>now()+make_interval(days=>(p->>'days')::int)-interval '1 day') from jsonb_array_elements(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','Destek telafisi')->'presets') p),'presets end at local day boundaries after N days');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','free',now()+interval '30 days','Destek telafisi')->'blockers','["override_plan_free"]'::jsonb,'free plan blocked');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()-interval '1 day','Destek telafisi')->'blockers','["override_ends_at_invalid"]'::jsonb,'past end blocked');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '3 years','Destek telafisi')->'blockers','["override_too_long"]'::jsonb,'too long blocked');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009702','plus',now()+interval '30 days','ab')->'blockers','["override_reason_required"]'::jsonb,'short reason blocked');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009701','plus',now()+interval '10 days','Destek telafisi')->'blockers','["plan_not_above_current"]'::jsonb,'plus comp shorter than active plus store adds nothing');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009701','plus',now()+interval '40 days','Destek telafisi')->'after'->>'expires_at',(select to_jsonb(now()+interval '40 days')#>>'{}'),'longer plus comp extends the store plan');
select is(public.admin_override_preview('10000000-0000-4000-8000-000000009701','pro',now()+interval '10 days','Destek telafisi')->'after'->>'plan','pro','pro comp upgrades over plus store');
select is(jsonb_array_length(public.admin_override_preview('10000000-0000-4000-8000-000000009701','pro',now()+interval '10 days','Destek telafisi')->'conflicts'),0,'expired and revoked comps are not conflicts');
select throws_ok($$select public.admin_override_preview('10000000-0000-4000-8000-000000009799','plus',now()+interval '30 days','Destek telafisi')$$,'P0001','family_not_found','unknown family in preview');

-- Uygulama: idempotent, denetim kaydı, çakışma, değiştirme
select is((public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009701')->>'replayed')::boolean,false,'first apply writes');
select is((public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009701')->>'replayed')::boolean,true,'same key replays');
select is((select count(*)::int from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000009702'),1,'one override row after two calls');
select is(public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009701')->>'override_id',(select id::text from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000009702'),'replay returns the same override id');
select is((select count(*)::int from public.audit_log where action='entitlement_overrides.apply' and family_id='10000000-0000-4000-8000-000000009702'),1,'single apply audit entry');
select is((select details->'before'->>'plan' from public.audit_log where action='entitlement_overrides.apply' and family_id='10000000-0000-4000-8000-000000009702'),'free','audit keeps before state');
select is((select count(*)::int from public.audit_log where action='entitlement_overrides.insert' and family_id='10000000-0000-4000-8000-000000009702'),1,'row trigger audit kept');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','pro','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009701')$$,'request_conflict','same key with a different plan conflicts');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009702')$$,'P0001','plan_not_above_current','second plus comp covered by the first is blocked');
select is((select c->>'relation' from jsonb_array_elements(public.admin_override_preview('10000000-0000-4000-8000-000000009702','pro','2027-01-10 00:00+03','Yükselt')->'conflicts') c),'lower_plan_active','active plus comp shows as a lower-plan conflict for a pro request');
select is((public.admin_override_preview('10000000-0000-4000-8000-000000009702','pro','2027-01-10 00:00+03','Yükselt')->>'replace_required')::boolean,true,'preview says replacement is required');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','pro','2027-01-10 00:00+03','Yükselt','90000000-0000-4000-8000-000000009703')$$,'P0001','override_conflict','conflict is refused without explicit replacement');
select is(jsonb_array_length(public.admin_override_apply('10000000-0000-4000-8000-000000009702','pro','2027-01-10 00:00+03','Yükselt','90000000-0000-4000-8000-000000009703',true)->'replaced'),1,'explicit replacement expires the conflicting comp');
select is((select count(*)::int from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000009702' and revoked_at is null),1,'exactly one live comp remains');
select is((select plan::text from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000009702' and revoked_at is null),'pro','live comp is pro');
select is((select e.plan::text from public.get_family_entitlement('10000000-0000-4000-8000-000000009702') e),'pro','effective entitlement is pro');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi',null)$$,'22023','invalid_input','idempotency key required');
-- Diğer yönetici aynı anahtarı kullanamaz
select pg_temp.actor('00000000-0000-4000-8000-000000009708',true);
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','plus','2027-01-15 00:00+03','Destek telafisi','90000000-0000-4000-8000-000000009701')$$,'request_conflict','another admin cannot replay a colleague''s key');
select is((select count(*)::int from jsonb_array_elements(public.admin_family_entitlement_timeline('10000000-0000-4000-8000-000000009702')->'events') e where e->>'kind' in('comp_granted','comp_revoked')),3,'timeline shows two grants and one revocation');

-- Yönetici yetkisi kaldırılınca JWT süresi beklenmez
reset role;
delete from public.admins where user_id='00000000-0000-4000-8000-000000009701';
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009701',true);
select throws_ok($$select public.admin_workqueue()$$,'42501','forbidden','removed admin loses the workqueue immediately');
select throws_ok($$select public.admin_families_search('Sayfa')$$,'42501','forbidden','removed admin loses family search');
select throws_ok($$select public.admin_override_apply('10000000-0000-4000-8000-000000009702','pro','2027-02-01 00:00+03','Deneme','90000000-0000-4000-8000-000000009704')$$,'42501','forbidden','removed admin cannot write overrides');
reset role;
select is((select count(*)::int from public.entitlement_overrides where family_id='10000000-0000-4000-8000-000000009702'),2,'no override written by the removed admin');

select * from finish();
rollback;
