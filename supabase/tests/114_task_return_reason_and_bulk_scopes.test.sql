-- C03: geri gönderme nedeni (iki veli + çocuk cihazı + yabancı aile), eski RPC uyumu ve idempotency;
-- haftalık öneri çocuk bağı; yardım yanıt takibi ve gizlenmiş ek; takvim toplu arşiv/geri alma sayı ve geçmişi.
begin;
select plan(81);

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000011401','p114a@test.local'),
 ('00000000-0000-4000-8000-000000011402','p114b@test.local'),
 ('00000000-0000-4000-8000-000000011403','p114x@test.local'),
 ('00000000-0000-4000-8000-000000011404',null),
 ('00000000-0000-4000-8000-000000011405',null),
 ('00000000-0000-4000-8000-000000011406','ops114@test.local');
insert into public.families(id,name,created_by,invite_code) values
 ('10000000-0000-4000-8000-000000011401','Aile A','00000000-0000-4000-8000-000000011401','FA114A01'),
 ('10000000-0000-4000-8000-000000011402','Aile X','00000000-0000-4000-8000-000000011403','FA114X01');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011401','00000000-0000-4000-8000-000000011401'),
 ('10000000-0000-4000-8000-000000011401','00000000-0000-4000-8000-000000011402'),
 ('10000000-0000-4000-8000-000000011402','00000000-0000-4000-8000-000000011403');
insert into public.children(id,family_id,name,sort_order) values
 ('20000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401','Ece',1),
 ('20000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401','Can',2),
 ('20000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011402','Yabancı',1);
insert into public.devices(id,family_id,auth_user_id,name,active_child_id) values
 ('60000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401','00000000-0000-4000-8000-000000011404','Ece tablet','20000000-0000-4000-8000-000000011401'),
 ('60000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401','00000000-0000-4000-8000-000000011405','Can tablet','20000000-0000-4000-8000-000000011402');
insert into public.task_templates(id,family_id,child_id,title,stars,starts_on) values
 ('30000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','Oda',3,current_date-3),
 ('30000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','Kitap',2,current_date-3),
 ('30000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','Diş',1,current_date-3);
insert into public.task_completions(id,family_id,child_id,template_id,due_date,status,completed_at,client_id) values
 ('40000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','30000000-0000-4000-8000-000000011401',current_date,'done','2026-11-06T09:00:00Z','70000000-0000-4000-8000-000000011401'),
 ('40000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','30000000-0000-4000-8000-000000011402',current_date,'done','2026-11-06T09:05:00Z','70000000-0000-4000-8000-000000011402'),
 ('40000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','30000000-0000-4000-8000-000000011403',current_date,'done','2026-11-06T09:10:00Z','70000000-0000-4000-8000-000000011403');

create function pg_temp.as_parent(u text,f text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','gina',jsonb_build_object('role','parent','family_id',f))::text,true)$$;
create function pg_temp.as_device(u text,d text,c text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','gina',jsonb_build_object('role','device','family_id','10000000-0000-4000-8000-000000011401','device_id',d,'child_id',c))::text,true)$$;
grant execute on function pg_temp.as_parent(text,text),pg_temp.as_device(text,text,text) to authenticated;

-- Sözleşme ------------------------------------------------------------------------------------------------------
select has_column('public','task_completions','return_reason','completion stores a return reason');
select has_column('public','task_completions','return_note','completion stores a short return note');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_task_once'),1,'single review_task_once signature (no PostgREST ambiguity)');
select is((select pronargdefaults::int from pg_proc where oid='public.review_task_once(uuid,uuid,boolean,timestamptz,text,text)'::regprocedure),2,'reason and note are optional (old 4-argument calls still resolve)');
select ok(not has_function_privilege('anon','public.review_task_once(uuid,uuid,boolean,timestamptz,text,text)','execute'),'anon cannot review');
select ok(not has_function_privilege('authenticated','gina.task_completion_return_reason()','execute'),'reason trigger is not client-callable');

set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');

-- Geçersiz girdiler hiçbir şey yazmaz.
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',true,'2026-11-06T09:00:00Z','not_finished',null)$$,'P0001','invalid_input','approve cannot carry a return reason');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','lazy',null)$$,'P0001','return_reason_invalid','unknown reason rejected (no judgemental codes)');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','other',null)$$,'P0001','return_note_required','"other" needs a short note');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','other',repeat('a',141))$$,'P0001','return_note_invalid','note longer than 140 characters rejected');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z',null,'yalnız not')$$,'P0001','return_note_invalid','note without a reason rejected');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011409','40000000-0000-4000-8000-000000011401',false,'2026-11-06T08:00:00Z','not_finished',null)$$,'P0001','submission_changed','stale submission still rejected with a reason');
reset role;
select is((select status::text from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'done','invalid requests left the submission pending');
select is((select count(*)::int from public.mutation_receipts where family_id='10000000-0000-4000-8000-000000011401'),0,'invalid requests store no receipt');

-- Veli A nedenle geri gönderir.
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
create temp table first_return as select public.review_task_once('50000000-0000-4000-8000-000000011401','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','missing_part',E'  Yatağı\n da topla  ') r;
select is((select r->>'status' from first_return),'returned','return with reason succeeds');
select is((select r->>'return_reason' from first_return),'missing_part','result carries the reason');
select is((select r->>'return_note' from first_return),'Yatağı da topla','note trimmed and control characters collapsed');
select is(public.review_task_once('50000000-0000-4000-8000-000000011401','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','missing_part','Yatağı da topla'),(select r from first_return),'lost reply retry returns the stored result');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011401','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','needs_care','Başka not')$$,'P0001','request_conflict','same request id cannot change the reason');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011408','40000000-0000-4000-8000-000000011401',false,'2026-11-06T09:00:00Z','needs_care',null)$$,'P0001','already_reviewed','second tap with a new id produces no second transition');

-- Veli B (eş) aynı nedeni görür; ikinci karar üretmez.
select pg_temp.as_parent('00000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401');
select is((select return_reason||'|'||return_note from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'missing_part|Yatağı da topla','co-parent reads the same reason and note');
select is((select reviewed_by::text from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'00000000-0000-4000-8000-000000011401','reviewer recorded as the authorised parent');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011407','40000000-0000-4000-8000-000000011401',true,'2026-11-06T09:00:00Z')$$,'P0001','already_reviewed','co-parent cannot overwrite the decision with an old copy');

-- Çocuk cihazı: kendi gönderiminde nedeni görür, kardeş cihazı ve yabancı aile görmez; cihaz karar veremez.
select pg_temp.as_device('00000000-0000-4000-8000-000000011404','60000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401');
select is((select return_reason||'|'||return_note from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'missing_part|Yatağı da topla','child device reads its own return reason');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011406','40000000-0000-4000-8000-000000011402',true,'2026-11-06T09:05:00Z')$$,'42501','forbidden','child device cannot review');
select pg_temp.as_device('00000000-0000-4000-8000-000000011405','60000000-0000-4000-8000-000000011402','20000000-0000-4000-8000-000000011402');
select is((select count(*)::int from public.task_completions where id='40000000-0000-4000-8000-000000011401'),0,'sibling device cannot read the note');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011402');
select is((select count(*)::int from public.task_completions where id='40000000-0000-4000-8000-000000011401'),0,'other family cannot read the note');
select throws_ok($$select public.review_task_once('50000000-0000-4000-8000-000000011405','40000000-0000-4000-8000-000000011402',true,'2026-11-06T09:05:00Z')$$,'P0001','not_found','other family cannot review');
reset role;

-- Doğrudan güncelleme nedeni değiştiremez (yalnız inceleme yolu yazar).
update public.task_completions set return_note='Değişti' where id='40000000-0000-4000-8000-000000011401';
select is((select return_note from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'Yatağı da topla','reason only changes through a review transition');

-- Yeniden gönderim nedeni veliye bağlam olarak tutar; eski 4 argümanlı onay nedeni temizler ve tek puan yazar.
update public.task_completions set status='done',completed_at='2026-11-06T10:00:00Z' where id='40000000-0000-4000-8000-000000011401';
select is((select return_reason from public.task_completions where id='40000000-0000-4000-8000-000000011401'),'missing_part','resubmitted work keeps the previous reason for the parent');
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401');
select is(public.review_task_once('50000000-0000-4000-8000-000000011402','40000000-0000-4000-8000-000000011401',true,'2026-11-06T10:00:00Z')->>'status','approved','old 4-argument approve call still works');
select is(public.review_task_once('50000000-0000-4000-8000-000000011402','40000000-0000-4000-8000-000000011401',true,'2026-11-06T10:00:00Z')->>'status','approved','old call retry returns the receipt');
reset role;
select is((select return_reason from public.task_completions where id='40000000-0000-4000-8000-000000011401'),null,'approval clears the return reason');
select is((select count(*)::int from public.star_events where completion_id='40000000-0000-4000-8000-000000011401'),1,'double approve awards stars once');
select is((select payload from public.mutation_receipts where request_id='50000000-0000-4000-8000-000000011402'),
 jsonb_build_object('completion','40000000-0000-4000-8000-000000011401','approve',true,'completed_at','2026-11-06T10:00:00Z'::timestamptz),'reasonless receipt payload unchanged from the old contract');

-- Nedensiz geri gönderme ve eski 2 argümanlı yol bayat neden bırakmaz.
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
select is(public.review_task_once('50000000-0000-4000-8000-000000011403','40000000-0000-4000-8000-000000011402',false,'2026-11-06T09:05:00Z')->>'return_reason',null,'return without reason stores none');
select is((public.review_task('40000000-0000-4000-8000-000000011403',false)).return_reason,null,'legacy review_task path stores no reason');
select is((select r->>'reviewed_by' from first_return),'00000000-0000-4000-8000-000000011401','receipt result identifies the reviewer');
reset role;
select is(current_setting('gina.return_reason',true),'','reason setting does not leak beyond the call');

-- Haftalık öneri → görev formu çocuk bağı ------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
create temp table kids as select public.weekly_review_children((date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7)) k;
select is((select jsonb_array_length(k) from kids),2,'both active children mapped');
select is((select e->>'child_id' from kids, jsonb_array_elements(k) e where e->>'alias'='Çocuk A'),'20000000-0000-4000-8000-000000011401','alias resolves to the child id for the form');
select throws_ok($$select public.weekly_review_children(current_date-((extract(isodow from current_date)::int)%7)-1)$$,'P0001','weekly_date','non-Monday week rejected');
reset role;
alter table public.children disable trigger a_child_archive_projection;
update public.children set archived_at=now() where id='20000000-0000-4000-8000-000000011402';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
select is(jsonb_array_length(public.weekly_review_children((date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7))),1,'archived child is not offered for a new task');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011402');
select ok(not (public.weekly_review_children((date_trunc('week',now() at time zone 'Europe/Istanbul')::date-7))::text like '%20000000-0000-4000-8000-000000011401%'),'other family never sees family A children');
select pg_temp.as_device('00000000-0000-4000-8000-000000011404','60000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401');
select throws_ok($$select public.weekly_review_children(date_trunc('week',now())::date-7)$$,'42501','weekly_forbidden','child device cannot read the map');
reset role;
update public.children set archived_at=null where id='20000000-0000-4000-8000-000000011402';
alter table public.children enable trigger a_child_archive_projection;

-- Yardım yanıt takibi ----------------------------------------------------------------------------------------------
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000011406','support',now()+interval '1 day');
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
create temp table ticket as select public.create_help_ticket('51000000-0000-4000-8000-000000011401','support','device','Tablet bağlanmıyor','Merhaba, tablet bağlanmıyor.') t;
select is((select (e->>'unread')::boolean from jsonb_array_elements(public.help_ticket_updates()) e where e->>'id'=(select t->>'id' from ticket)),false,'new ticket has nothing unread');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011406","role":"authenticated","gina":{"role":null}}',true);
select is(public.reply_help_ticket('51000000-0000-4000-8000-000000011402',(select (t->>'id')::uuid from ticket),1,'Ekip içi: kontrol edildi',true)->>'revision','2','operator internal note');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
select is((select (e->>'unread')::boolean from jsonb_array_elements(public.help_ticket_updates()) e where e->>'id'=(select t->>'id' from ticket)),false,'internal team note never counts as a reply');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011406","role":"authenticated","gina":{"role":null}}',true);
select is(public.reply_help_ticket('51000000-0000-4000-8000-000000011403',(select (t->>'id')::uuid from ticket),2,'Uygulamayı güncelleyip yeniden dener misiniz?',false,'waiting_parent')->>'status','waiting_parent','operator replies to the family');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
create temp table upd as select e from jsonb_array_elements(public.help_ticket_updates()) e where e->>'id'=(select t->>'id' from ticket);
select is((select (e->>'unread')::boolean from upd),true,'family reply is unread for parent A');
select is((select e->>'status' from upd),'waiting_parent','status shown with the update');
select is((public.mark_help_ticket_read((select (t->>'id')::uuid from ticket),(select (e->>'last_support_sequence')::bigint from upd))->>'last_seen_sequence')::bigint,(select (e->>'last_support_sequence')::bigint from upd),'mark read stores the reply sequence');
select is((select (e->>'unread')::boolean from jsonb_array_elements(public.help_ticket_updates()) e where e->>'id'=(select t->>'id' from ticket)),false,'read reply no longer unread');
select is((public.mark_help_ticket_read((select (t->>'id')::uuid from ticket),0)->>'last_seen_sequence')::bigint,(select (e->>'last_support_sequence')::bigint from upd),'late older mark does not roll back');
select is((public.mark_help_ticket_read((select (t->>'id')::uuid from ticket),999999999)->>'last_seen_sequence')::bigint,(select (e->>'last_support_sequence')::bigint from upd),'future sequence capped to visible messages');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401');
select is((select (e->>'unread')::boolean from jsonb_array_elements(public.help_ticket_updates()) e where e->>'id'=(select t->>'id' from ticket)),true,'co-parent keeps their own unread state');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011402');
select is(jsonb_array_length(public.help_ticket_updates()),0,'other family sees no tickets');
select throws_ok(format('select public.mark_help_ticket_read(%L,1)',(select t->>'id' from ticket)),'42501','forbidden','other family cannot mark read');

-- Gizlenmiş ek -----------------------------------------------------------------------------------------------------
-- 1×1 PNG (sentetik).
create temp table png as select 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='::text b;
grant select on png, ticket to authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
select throws_ok(format($q$select public.add_help_attachment('52000000-0000-4000-8000-000000011401',%L,'53000000-0000-4000-8000-000000011401','image/png',%L,1,1,'{"confirmed_no_personal_data":false,"metadata_removed":true}')$q$,(select t->>'id' from ticket),(select b from png)),'P0001','help_attachment_not_redacted','attachment requires the no-personal-data confirmation');
select throws_ok(format($q$select public.add_help_attachment('52000000-0000-4000-8000-000000011401',%L,'53000000-0000-4000-8000-000000011401','image/jpeg',%L,1,1,'{"confirmed_no_personal_data":true,"metadata_removed":true}')$q$,(select t->>'id' from ticket),(select b from png)),'P0001','help_attachment_type','declared type must match the bytes');
create temp table att as select public.add_help_attachment('52000000-0000-4000-8000-000000011402',(select (t->>'id')::uuid from ticket),'53000000-0000-4000-8000-000000011402','image/png',(select b from png),1,1,'{"confirmed_no_personal_data":true,"metadata_removed":true,"cropped":true}') a;
select is((select a->>'id' from att),'53000000-0000-4000-8000-000000011402','redacted attachment stored');
select is(public.add_help_attachment('52000000-0000-4000-8000-000000011402',(select (t->>'id')::uuid from ticket),'53000000-0000-4000-8000-000000011402','image/png',(select b from png),1,1,'{"confirmed_no_personal_data":true,"metadata_removed":true,"cropped":true}'),(select a from att),'attachment retry returns the same result');
select is(jsonb_array_length(public.list_help_attachments((select (t->>'id')::uuid from ticket))),1,'one attachment listed after retry');
select is(public.get_help_attachment('53000000-0000-4000-8000-000000011402')->>'data',(select b from png),'owner reads back the same bytes');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401');
select is(public.get_help_attachment('53000000-0000-4000-8000-000000011402')->>'mime','image/png','co-parent of the family can open it');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011406","role":"authenticated","gina":{"role":null}}',true);
select is(public.get_help_attachment('53000000-0000-4000-8000-000000011402')->>'id','53000000-0000-4000-8000-000000011402','support operator can open it');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011403','10000000-0000-4000-8000-000000011402');
select throws_ok($$select public.get_help_attachment('53000000-0000-4000-8000-000000011402')$$,'42501','forbidden','other family cannot open the attachment');
select pg_temp.as_device('00000000-0000-4000-8000-000000011404','60000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401');
select throws_ok($$select public.get_help_attachment('53000000-0000-4000-8000-000000011402')$$,'42501','forbidden','child device cannot open the attachment');
select throws_ok($$select count(*) from public.help_attachments$$,'42501',null,'attachment table closed to clients');
reset role;
select is((select redaction from public.help_attachments where id='53000000-0000-4000-8000-000000011402'),'{"cropped": true, "metadata_removed": true, "confirmed_no_personal_data": true}'::jsonb,'only the redaction flags are stored with the file');

-- Takvim toplu arşiv / geri alma: sayı ve geçmiş ------------------------------------------------------------------
insert into public.events(id,family_id,child_id,type,title,starts_at,rrule) values
 ('35000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','activity','Yüzme',now()+interval '1 day',null),
 ('35000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401','activity','Satranç',now()+interval '2 days','FREQ=WEEKLY');
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011401','10000000-0000-4000-8000-000000011401');
create temp table ev_preview as select public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('event'),'child_id','20000000-0000-4000-8000-000000011401','from',current_date,'to',current_date+7)) p;
select is((select (p->'summary'->>'archivable')::int from ev_preview),2,'calendar preview lists both events of the range');
create temp table ev_apply as select public.bulk_archive_apply((select jsonb_agg(jsonb_build_object('type','event','id',i->>'id','revision',(i->>'revision')::int)) from ev_preview, jsonb_array_elements(p->'items') i),'54000000-0000-4000-8000-000000011401') r;
select is((select (r->'summary'->>'ok')::int from ev_apply),2,'two events archived');
select is(public.bulk_archive_apply((select jsonb_agg(jsonb_build_object('type','event','id',i->>'id','revision',(i->>'revision')::int)) from ev_preview, jsonb_array_elements(p->'items') i),'54000000-0000-4000-8000-000000011401'),(select r from ev_apply),'second apply with the same key returns one result');
select is((select count(*)::int from public.events where id in('35000000-0000-4000-8000-000000011401','35000000-0000-4000-8000-000000011402')),0,'archived events hidden from the parent calendar read');
select pg_temp.as_device('00000000-0000-4000-8000-000000011404','60000000-0000-4000-8000-000000011401','20000000-0000-4000-8000-000000011401');
select is((select count(*)::int from public.events where id in('35000000-0000-4000-8000-000000011401','35000000-0000-4000-8000-000000011402')),0,'archived events hidden from the child device');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011402','10000000-0000-4000-8000-000000011401');
create temp table ev_restore_preview as select public.bulk_archive_preview(jsonb_build_object('types',jsonb_build_array('event'),'child_id','20000000-0000-4000-8000-000000011401','archived',true)) p;
select is((select count(*)::int from ev_restore_preview, jsonb_array_elements(p->'items') i where (i->>'archived')::boolean),2,'co-parent sees both in the archive view');
select is((public.bulk_restore_apply((select jsonb_agg(jsonb_build_object('type','event','id',i->>'id','revision',(i->>'revision')::int)) from ev_restore_preview, jsonb_array_elements(p->'items') i),'54000000-0000-4000-8000-000000011402')->'summary'->>'ok')::int,2,'co-parent restores both');
select is((select count(*)::int from public.events where id in('35000000-0000-4000-8000-000000011401','35000000-0000-4000-8000-000000011402')),2,'restored events visible again');
create temp table hist as select public.bulk_archive_history(null) h;
grant select on hist to authenticated;
select is((select count(*)::int from hist, jsonb_array_elements(h) x where x->>'run_id' in ((select r->>'run_id' from ev_apply))),1,'archive run listed once in history');
select is((select jsonb_agg(x->>'operation' order by x->>'operation') from hist, jsonb_array_elements(h) x),'["archive", "restore"]'::jsonb,'history has exactly the archive and the restore');
select is((select (x->>'mine')::boolean from hist, jsonb_array_elements(h) x where x->>'operation'='archive'),false,'history marks the other parent''s run as not mine');
reset role;

select * from finish();
rollback;
