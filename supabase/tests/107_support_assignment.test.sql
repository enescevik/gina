begin;
select no_plan();
-- B04: destek sorumlusu, bekleme süresi, arama, fikir durumu ve benzer fikir bağı.
-- Ekip notu ve sorumlu veliye görünmez; atama görüşme revizyonunu artırmaz; destek fikre dönüşmez.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000010701','b04-admin@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000010702','b04-ayse@example.invalid',false,'{"name":"Ayşe Destek"}'),
 ('00000000-0000-4000-8000-000000010703','b04-mert@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000010704','b04-expired@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000010705','b04-content@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000010706','b04-parent@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000010707',null,true,'{}'),
 ('00000000-0000-4000-8000-000000010708','b04-parent2@example.invalid',false,'{}');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000010701');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000010702','support',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000010703','support',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000010704','support',now()-interval '1 minute',null),
 ('00000000-0000-4000-8000-000000010705','content',now()+interval '30 days',null);
insert into public.families(id,name,created_by,timezone) values
 ('10000000-0000-4000-8000-000000010701','Deniz ailesi','00000000-0000-4000-8000-000000010706','Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010702','Ova ailesi','00000000-0000-4000-8000-000000010708','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706'),
 ('10000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708');
insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000010701','10000000-0000-4000-8000-000000010701','Ece',4);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('60000000-0000-4000-8000-000000010701','10000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010707','20000000-0000-4000-8000-000000010701');
insert into public.help_tickets(id,family_id,created_by,kind,category,subject,status,created_at,updated_at) values
 ('70000000-0000-4000-8000-000000010701','10000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706','support','billing','Plus paketim görünmüyor','open',now()-interval '3 days',now()-interval '1 hour'),
 ('70000000-0000-4000-8000-000000010702','10000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708','support','device','Tablet kodu reddediliyor','in_progress',now()-interval '1 day',now()-interval '2 hours'),
 ('70000000-0000-4000-8000-000000010703','10000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706','idea','learning','Matematik oyunları ekleyin','open',now()-interval '5 days',now()-interval '5 days'),
 ('70000000-0000-4000-8000-000000010704','10000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708','idea','learning','Matematik oyunu eklenebilir mi','open',now()-interval '4 days',now()-interval '4 days'),
 ('70000000-0000-4000-8000-000000010705','10000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708','idea','other','Karanlık tema','open',now()-interval '4 days',now()-interval '4 days'),
 ('70000000-0000-4000-8000-000000010706','10000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708','support','other','Yüzde %50 indirim kodu','open',now()-interval '4 days',now()-interval '3 hours');
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body,created_at) values
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706','parent','family','Satın aldım ama görünmüyor',now()-interval '3 days'),
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010702','support','family','Kontrol ediyoruz',now()-interval '2 days'),
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010702','support','internal','Mağaza makbuzu eksik, finansa sor',now()-interval '30 hours'),
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706','parent','family','Hâlâ yok',now()-interval '26 hours'),
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010706','parent','family','Lütfen yardım',now()-interval '1 hour'),
 ('70000000-0000-4000-8000-000000010701','00000000-0000-4000-8000-000000010702','support','internal','zümrütnot yalnız ekip',now()-interval '30 minutes'),
 ('70000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010708','parent','family','Kod kabul edilmiyor',now()-interval '1 day'),
 ('70000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010703','support','family','Yeni kod üretin lütfen',now()-interval '2 hours'),
 ('70000000-0000-4000-8000-000000010706','00000000-0000-4000-8000-000000010708','parent','family','İndirim',now()-interval '3 hours');

create function pg_temp.actor(id text, admin boolean default false, role_name text default 'parent', family text default '10000000-0000-4000-8000-000000010701') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',role_name,'admin',admin))::text,true)::void$$;
create function pg_temp.ids(q jsonb) returns text[] language sql as $$
 select coalesce(array_agg(right(x->>'id',3) order by x->>'id'),'{}') from jsonb_array_elements(q) x$$;

-- Şema: idea_stage yalnız fikirde; yeni fikir 'new'; tür değişmez.
select is((select idea_stage from public.help_tickets where id='70000000-0000-4000-8000-000000010703'),'new','existing/new idea gets stage new');
select is((select idea_stage from public.help_tickets where id='70000000-0000-4000-8000-000000010701'),null,'support ticket has no idea stage');
select throws_ok($$update public.help_tickets set kind='idea' where id='70000000-0000-4000-8000-000000010701'$$,'22023','help_kind_immutable','a private support ticket cannot be turned into an idea');
select throws_ok($$update public.help_tickets set idea_stage='planned' where id='70000000-0000-4000-8000-000000010701'$$,'23514',null,'support ticket cannot carry an idea stage');
select throws_ok($$update public.help_tickets set similar_to='70000000-0000-4000-8000-000000010703' where id='70000000-0000-4000-8000-000000010701'$$,'23514',null,'support ticket cannot be linked into an idea cluster');
select throws_ok($$update public.help_tickets set similar_to='70000000-0000-4000-8000-000000010701' where id='70000000-0000-4000-8000-000000010703'$$,'22023','similar_must_be_idea','idea cannot be linked to a support ticket');
select ok(not has_function_privilege('anon','public.admin_support_queue(text,text,text,text,text,boolean,timestamptz,uuid)','execute'),'anon cannot execute queue');
select ok(not has_function_privilege('anon','public.assign_help_ticket(uuid,uuid,uuid,uuid)','execute'),'anon cannot execute assign');
select ok(not has_function_privilege('anon','public.set_idea_stage(uuid,uuid,text,uuid,text,uuid)','execute'),'anon cannot execute idea stage');

select set_config('b04.wait',(select created_at::text from public.help_messages where ticket_id='70000000-0000-4000-8000-000000010701' and body='Hâlâ yok'),true);
set local role authenticated;
-- Veli, cihaz, süresi dolmuş operatör, içerik operatörü, sahte admin claim: reddedilir.
select pg_temp.actor('00000000-0000-4000-8000-000000010706');
select throws_ok($$select public.admin_support_queue()$$,'42501','forbidden','parent cannot read the operator queue');
select throws_ok($$select public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010701')$$,'42501','forbidden','parent cannot read assignment meta of own ticket');
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010701',null,'00000000-0000-4000-8000-000000010706')$$,'42501','forbidden','parent cannot assign');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010703','new',null,'planned',null)$$,'42501','forbidden','parent cannot change idea stage');
select throws_ok($$select public.admin_support_operators()$$,'42501','forbidden','parent cannot list operators');
select pg_temp.actor('00000000-0000-4000-8000-000000010707',false,'device');
select throws_ok($$select public.admin_support_queue()$$,'42501','forbidden','device cannot read the operator queue');
select pg_temp.actor('00000000-0000-4000-8000-000000010704',false,'none',null);
select throws_ok($$select public.admin_support_queue()$$,'42501','forbidden','expired support operator refused');
select pg_temp.actor('00000000-0000-4000-8000-000000010705',false,'none',null);
select throws_ok($$select public.admin_support_queue()$$,'42501','forbidden','content operator has no support queue');
select pg_temp.actor('00000000-0000-4000-8000-000000010706',true);
select throws_ok($$select public.admin_support_queue()$$,'42501','forbidden','forged admin claim without admins row refused');

-- Destek operatörü Ayşe
select pg_temp.actor('00000000-0000-4000-8000-000000010702',false,'none',null);
select is(pg_temp.ids(public.admin_support_queue('support','all')),array['701','702','706'],'support queue lists only support tickets');
select is(pg_temp.ids(public.admin_support_queue('idea','all')),array['703','704','705'],'idea queue lists only ideas');
select is((select (x->>'waiting_since')::timestamptz from jsonb_array_elements(public.admin_support_queue('support','all')) x where x->>'id' like '%701'),
 current_setting('b04.wait')::timestamptz,
 'waiting starts at the first parent message after the last family-visible support reply (internal notes do not stop the clock)');
select is((select x->>'waiting_since' from jsonb_array_elements(public.admin_support_queue('support','all')) x where x->>'id' like '%702'),null,'answered ticket is not waiting on support');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any',null,true)),array['701','706'],'waiting filter keeps only tickets waiting on support');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any','plus paket')),array['701'],'search by subject (case-insensitive)');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any','yeni kod')),array['702'],'search by message body');
select is((select x->>'match' from jsonb_array_elements(public.admin_support_queue('support','all',null,'any','yeni kod')) x),'message','match reason is message');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any','zümrütnot')),array['701'],'operator search reaches internal team notes');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any','%9')),array[]::text[],'percent sign is literal, not a wildcard');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'any','%50')),array['706'],'literal percent matches subject');
select throws_ok($$select public.admin_support_queue('support','all',null,'any','a')$$,'22023','invalid_input','one-character search refused');
select throws_ok($$select public.admin_support_queue('support','all',null,'kimse')$$,'22023','invalid_input','bad assignee filter refused');
select is(jsonb_array_length(public.admin_support_operators()),3,'operators: admin row + two live support members (expired excluded)');
select is((public.admin_support_operators()->0->>'label'),'Ayşe Destek','caller listed first with display name');

-- Atama: revizyon artmaz, idempotent, beklenen sorumlu çakışması, operatör olmayan reddedilir.
reset role;
select is((select revision from public.help_tickets where id='70000000-0000-4000-8000-000000010701'),1,'revision before assignment');
set local role authenticated;
select is((public.assign_help_ticket('a0000000-0000-4000-8000-000000010701','70000000-0000-4000-8000-000000010701',null,'00000000-0000-4000-8000-000000010703'))->>'assignee_label','b04-mert','assign to Mert');
select is((public.assign_help_ticket('a0000000-0000-4000-8000-000000010701','70000000-0000-4000-8000-000000010701',null,'00000000-0000-4000-8000-000000010703'))->>'assignee_label','b04-mert','same request replays the receipt');
select throws_ok($$select public.assign_help_ticket('a0000000-0000-4000-8000-000000010701','70000000-0000-4000-8000-000000010701',null,'00000000-0000-4000-8000-000000010702')$$,'P0001','request_conflict','same request id with different payload is a conflict');
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010701',null,'00000000-0000-4000-8000-000000010702')$$,'P0001','assignment_changed','stale expected assignee (concurrent assign) refused');
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010702',null,'00000000-0000-4000-8000-000000010706')$$,'22023','assignee_not_operator','parent cannot be made assignee');
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010702',null,'00000000-0000-4000-8000-000000010704')$$,'22023','assignee_not_operator','expired operator cannot be made assignee');
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010702',null,'00000000-0000-4000-8000-000000010705')$$,'22023','assignee_not_operator','content-only operator cannot be made assignee');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'none')),array['702','706'],'unassigned filter');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'00000000-0000-4000-8000-000000010703')),array['701'],'filter by assignee');
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'me')),array[]::text[],'my queue is empty for Ayşe');
select is((public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010701'))->>'assignee_label','b04-mert','meta shows assignee');
select is((public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010701'))->'similar','[]'::jsonb,'support ticket has no similar-idea candidates');
-- Taslak: atamadan önce okunan revizyonla yazılan yanıt hâlâ gönderilebilir.
select is((public.reply_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010701',1,'Paketi tanımladık',false,'waiting_parent'))->>'revision','2','draft based on pre-assignment revision still sends (assignment is not a conversation change)');
select is((select x->>'waiting_since' from jsonb_array_elements(public.admin_support_queue('support','all')) x where x->>'id' like '%701'),null,'family-visible reply stops the waiting clock');
reset role;
select is((select count(*)::int from public.audit_log where action='help.assign' and target_id='70000000-0000-4000-8000-000000010701'),1,'one audit row for an idempotent assignment');
select is((select assignee_id from public.help_tickets where id='70000000-0000-4000-8000-000000010701'),'00000000-0000-4000-8000-000000010703'::uuid,'assignee persisted');
set local role authenticated;

-- Mert kendi kuyruğunu görür ve atamayı bırakabilir.
select pg_temp.actor('00000000-0000-4000-8000-000000010703',false,'none',null);
select is(pg_temp.ids(public.admin_support_queue('support','all',null,'me')),array['701'],'Mert sees his assigned ticket under me');
select is((public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010702',null,'00000000-0000-4000-8000-000000010703'))->>'assignee_id','00000000-0000-4000-8000-000000010703','Mert takes 702');
select is((public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010702','00000000-0000-4000-8000-000000010703',null))->>'assignee_id',null,'Mert releases 702');
reset role;
select is((select assigned_at from public.help_tickets where id='70000000-0000-4000-8000-000000010702'),null,'release clears assigned_at');
set local role authenticated;

-- Veli görünümü: ekip notu, sorumlu ve fikir alanları veli çıktısına girmez.
select pg_temp.actor('00000000-0000-4000-8000-000000010706');
select is((select count(*)::int from jsonb_array_elements(public.get_help_ticket('70000000-0000-4000-8000-000000010701')->'messages') m where m->>'visibility'='internal'),0,'team notes never reach the family');
select ok(not (public.get_help_ticket('70000000-0000-4000-8000-000000010701') ? 'assignee_id'),'family thread has no assignee');
select ok(not exists(select 1 from jsonb_array_elements(public.list_help_tickets(false)) x where x ? 'assignee_id' or x ? 'idea_stage' or x ? 'similar_to'),'family list has no operator fields');
select throws_ok($$select public.get_help_ticket('70000000-0000-4000-8000-000000010702')$$,'42501','forbidden','parent cannot open another family ticket');
select is((public.create_help_ticket(gen_random_uuid(),'idea','other','Sesli okuma modu','Çocuk için sesli okuma'))->>'status','open','parent can still create an idea');

-- Fikir durumu ve benzer bağ (yönetici).
select pg_temp.actor('00000000-0000-4000-8000-000000010701',true,'admin',null);
select ok(not exists(select 1 from jsonb_array_elements(public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010704')->'similar') x where jsonb_typeof(x->'linked')<>'boolean'),'unlinked candidates report linked=false, never null');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010701',null,null,'planned',null)$$,'22023','idea_only','support ticket cannot get an idea stage (no conversion to public idea)');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010703','new',null,'bogus',null)$$,'22023','invalid_input','unknown stage refused');
select is((public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010704','new',null,'reviewing','70000000-0000-4000-8000-000000010703'))->>'similar_to','70000000-0000-4000-8000-000000010703','link similar idea');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010703','new',null,'planned','70000000-0000-4000-8000-000000010704')$$,'22023','similar_cycle','cycle refused');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010704','new',null,'planned',null)$$,'P0001','idea_changed','stale expected stage refused');
select throws_ok($$select public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010705','new',null,'planned','70000000-0000-4000-8000-000000010701')$$,'22023','similar_must_be_idea','idea cannot be linked to a support ticket');
select is((public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010705','new',null,'planned','70000000-0000-4000-8000-000000010704'))->>'similar_to','70000000-0000-4000-8000-000000010703','link flattens to the root idea');
select is((select count(*)::int from jsonb_array_elements(public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010703')->'similar') x where (x->>'linked')::boolean),2,'root idea lists its two linked ideas');
select ok(exists(select 1 from jsonb_array_elements(public.admin_help_ticket_meta('70000000-0000-4000-8000-000000010704')->'similar') x where x->>'id' like '%703'),'trigram candidate/link shown for similar subject');
select is((select x->>'similar_count' from jsonb_array_elements(public.admin_support_queue('idea','all')) x where x->>'id' like '%703'),'2','queue shows similar count');
select is((public.set_idea_stage(gen_random_uuid(),'70000000-0000-4000-8000-000000010704','reviewing','70000000-0000-4000-8000-000000010703','shipped',null))->>'similar_to',null,'unlink and ship');
reset role;
select is((select revision from public.help_tickets where id='70000000-0000-4000-8000-000000010704'),1,'idea stage changes do not bump conversation revision');
select is((select count(*)::int from public.audit_log where action='help.idea_stage'),3,'idea stage changes are audited');
select ok(not exists(select 1 from public.audit_log where action in('help.assign','help.idea_stage') and details::text ilike '%zümrüt%'),'no message text in audit');

-- Atanan operatörün yetkisi bittiğinde: kayıt durur, ama yeni atama ona yapılamaz.
update public.operations_members set revoked_at=now() where user_id='00000000-0000-4000-8000-000000010703';
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000010703',false,'none',null);
select throws_ok($$select public.admin_support_queue('support','all',null,'me')$$,'42501','forbidden','revoked operator loses queue immediately');
select pg_temp.actor('00000000-0000-4000-8000-000000010702',false,'none',null);
select throws_ok($$select public.assign_help_ticket(gen_random_uuid(),'70000000-0000-4000-8000-000000010706',null,'00000000-0000-4000-8000-000000010703')$$,'22023','assignee_not_operator','revoked operator cannot receive new tickets');
select is(jsonb_array_length(public.admin_support_operators()),2,'revoked operator removed from assignee list');
reset role;

select * from finish();
rollback;
