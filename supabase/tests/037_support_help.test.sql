begin;
select no_plan();
insert into auth.users(id,email,is_anonymous)
select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'help-'||n||'@test.local',false from generate_series(3701,3709)n;
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000003701');
insert into public.families(id,name,created_by) values
 ('00000000-0000-4000-8000-000000003711','Help fixture','00000000-0000-4000-8000-000000003702'),
 ('00000000-0000-4000-8000-000000003712','Other fixture','00000000-0000-4000-8000-000000003703');
insert into public.family_members(family_id,user_id) values
 ('00000000-0000-4000-8000-000000003711','00000000-0000-4000-8000-000000003702'),
 ('00000000-0000-4000-8000-000000003711','00000000-0000-4000-8000-000000003709'),
 ('00000000-0000-4000-8000-000000003712','00000000-0000-4000-8000-000000003703');
create function pg_temp.login(n int,r text default 'none',f int default null,admin boolean default false) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',('00000000-0000-4000-8000-'||lpad(n::text,12,'0')),'role','authenticated','gina',jsonb_build_object('role',r,'family_id',case when f is not null then '00000000-0000-4000-8000-'||lpad(f::text,12,'0') end,'admin',admin))::text,true)::void;
$$;
create function pg_temp.ticket() returns uuid language sql as $$select (public.list_help_tickets()->0->>'id')::uuid$$;
create function pg_temp.msg(id int,revision int,body text,internal boolean default false,status text default null) returns jsonb language sql as $$
 select public.reply_help_ticket(('00000000-0000-4000-8000-'||lpad(id::text,12,'0'))::uuid,current_setting('test.ticket')::uuid,revision,body,internal,status);
$$;
set local role authenticated;
select pg_temp.login(3701,'none',null,true);
select lives_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003704','support',now()+interval '10 days',false,'Support fixture')$$,'root grants bounded support role');
select lives_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003705','content',now()+interval '10 days',false,'Content fixture')$$,'root grants content separately');
select lives_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003706','finance',now()+interval '10 days',false,'Finance fixture')$$,'finance membership alone grants no support access');
select throws_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003707','support',now()+interval '2 years',false,'Too long')$$,'P0001','invalid_input','role expiry bounded');
select pg_temp.login(3702,'parent',3711);
select throws_ok($$select public.create_help_ticket(gen_random_uuid(),'support','other','Short','')$$,'P0001','invalid_input','empty message rejected');
select lives_ok($$select public.create_help_ticket('00000000-0000-4000-8000-000000003721','support','device','Pairing help','Private original message')$$,'parent creates private ticket');
select set_config('test.ticket',pg_temp.ticket()::text,true);
select is((public.create_help_ticket('00000000-0000-4000-8000-000000003721','support','device','Pairing help','Private original message')->>'id')::uuid,pg_temp.ticket(),'lost create response replays ticket');
select is(jsonb_array_length(public.list_help_tickets()),1,'create retry does not duplicate');
select throws_ok($$select public.create_help_ticket('00000000-0000-4000-8000-000000003721','support','device','Different','Private original message')$$,'P0001','request_conflict','same receipt cannot change content');
select throws_ok($$select * from public.help_messages$$,'42501',null,'raw table access prohibited');
select throws_ok($$select public.list_help_tickets(true)$$,'42501','forbidden','parent cannot request operator queue');
select throws_ok($$select pg_temp.msg(3722,1,'Secret',true)$$,'P0001','invalid_input','parent cannot write internal notes');
select is((pg_temp.msg(3722,1,'Follow-up')->>'revision')::int,2,'parent reply increments revision');
select is((pg_temp.msg(3722,1,'Follow-up')->>'revision')::int,2,'reply retry keeps old revision receipt');
select is(jsonb_array_length(public.get_help_ticket(pg_temp.ticket())->'messages'),2,'retry does not duplicate messages');
select throws_ok($$select pg_temp.msg(3723,1,'Stale follow-up')$$,'P0001','help_changed','stale reply rejected explicitly');
select lives_ok($$select public.create_help_ticket('00000000-0000-4000-8000-000000003724','idea','learning','My suggestion','A separate idea queue')$$,'ideas share private lifecycle');
select is(jsonb_array_length(public.list_help_tickets(false,'idea')),1,'ideas can be filtered separately');
select pg_temp.login(3703,'parent',3712);
select is(jsonb_array_length(public.list_help_tickets()),0,'other family cannot see queue');
select throws_ok($$select public.get_help_ticket(current_setting('test.ticket')::uuid)$$,'42501','forbidden','other family cannot guess transcript');
select throws_ok($$select pg_temp.msg(3725,2,'Other family reply')$$,'42501','forbidden','other family cannot append');
select pg_temp.login(3709,'parent',3711);
select is(jsonb_array_length(public.get_help_ticket(current_setting('test.ticket')::uuid)->'messages'),2,'other current family parent can follow support');
select pg_temp.login(3704);
select is(public.my_operation_roles(),'["support"]'::jsonb,'support permission is narrow');
select throws_ok($$select public.admin_set_ai_enabled(false)$$,'42501','forbidden','support cannot change AI');
select throws_ok($$select public.admin_grant_override('00000000-0000-4000-8000-000000003711','pro','Support must not',now()+interval '1 day')$$,'42501','forbidden','support cannot give financial access');
select throws_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003704','content',now()+interval '1 day',false,'Escalate')$$,'42501','forbidden','support cannot self-escalate');
select is(jsonb_array_length(public.list_help_tickets(true,'support')),1,'support gets only requested queue');
select is((pg_temp.msg(3726,2,'Internal private note',true,'in_progress')->>'revision')::int,3,'support can record internal note');
select is(jsonb_array_length(public.get_help_ticket(current_setting('test.ticket')::uuid)->'messages'),3,'operator sees internal note');
select pg_temp.login(3702,'parent',3711);
select is(jsonb_array_length(public.get_help_ticket(current_setting('test.ticket')::uuid)->'messages'),2,'parent never sees internal note');
select pg_temp.login(3704);
select lives_ok($$select pg_temp.msg(3727,3,'Please check pairing','false','waiting_parent')$$,'support requests parent action');
select pg_temp.login(3702,'parent',3711);
select is(pg_temp.msg(3728,4,'I checked it')->>'status','open','parent response reopens waiting queue');
select is(pg_temp.msg(3729,5,'Solved, thanks',false,'closed')->>'status','closed','parent explicitly closes');
select throws_ok($$select pg_temp.msg(3730,6,'Unexpected append')$$,'P0001','help_reopen_required','closed ticket requires explicit reopen');
select is(pg_temp.msg(3730,6,'It happened again',false,'open')->>'status','open','explicit reopen preserves history');
select pg_temp.login(3706);
select throws_ok($$select public.list_help_tickets(true)$$,'42501','forbidden','finance has no support transcripts');
select pg_temp.login(3704,'device');
select throws_ok($$select public.list_help_tickets(true)$$,'42501','forbidden','device claim cannot use operator role');
select pg_temp.login(3701,'none',null,true);
select lives_ok($$select public.set_operation_member('00000000-0000-4000-8000-000000003704','support',null,true,'Revoke fixture')$$,'root revokes live membership');
select pg_temp.login(3704);
select throws_ok($$select public.get_help_ticket(current_setting('test.ticket')::uuid)$$,'42501','forbidden','revocation does not wait for JWT expiry');

-- FAQ editorial revision is independent from the published revision.
select pg_temp.login(3705);
select throws_ok($$select public.list_help_tickets(true)$$,'42501','forbidden','content role does not read tickets');
select lives_ok($$select public.save_help_article('00000000-0000-4000-8000-000000003740','00000000-0000-4000-8000-000000003750',0,'pairing','tr','all','Cihaz eşleştirme','Bir cihazı aileye bağlamak için eşleştirme kodunu kullanın.')$$,'content creates FAQ draft');
select is((public.save_help_article('00000000-0000-4000-8000-000000003740','00000000-0000-4000-8000-000000003750',0,'pairing','tr','all','Cihaz eşleştirme','Bir cihazı aileye bağlamak için eşleştirme kodunu kullanın.')->>'revision')::int,1,'FAQ save is idempotent');
select is(jsonb_array_length(public.get_help_articles('tr','ios',false)),0,'draft hidden from public reader');
select is(jsonb_array_length(public.get_help_articles('tr','ios',true)),1,'draft visible to content operator');
select throws_ok($$select public.review_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',1,'publish','Not reviewed yet')$$,'P0001','article_review_required','cannot publish without explicit review');
select lives_ok($$select public.review_help_article('00000000-0000-4000-8000-000000003741','00000000-0000-4000-8000-000000003750',1,'review','Checked instructions')$$,'review stamps revision');
select lives_ok($$select public.review_help_article('00000000-0000-4000-8000-000000003742','00000000-0000-4000-8000-000000003750',1,'publish','Approved publication')$$,'reviewed FAQ can publish');
select lives_ok($$select public.save_help_article('00000000-0000-4000-8000-000000003743','00000000-0000-4000-8000-000000003750',1,'pairing','tr','all','Yeni taslak','Bu yeni taslak henüz incelemeden geçmedi.')$$,'new edit creates separate version');
select is(public.get_help_articles('tr','ios')->0->>'title','Cihaz eşleştirme','draft edit preserves published content');
select is(public.get_help_articles('tr','ios',true)->0->>'title','Yeni taslak','editor sees latest draft');
select throws_ok($$select public.review_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',2,'publish','Try publishing')$$,'P0001','article_review_required','prior review never blesses new content');
select throws_ok($$select public.save_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',1,'pairing','tr','all','Stale title','A stale editor must not overwrite content.')$$,'P0001','help_changed','stale editor cannot overwrite draft');
select throws_ok($$select public.save_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',2,'other-slug','tr','all','New identity','Cannot silently move published article identity.')$$,'P0001','article_identity_changed','stable FAQ identity cannot silently move');
select is(jsonb_array_length(public.get_help_articles('en','ios')),0,'locale never silently mixed');
select lives_ok($$select public.review_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',2,'archive','Outdated instructions')$$,'archive withdraws live revision');
select is(jsonb_array_length(public.get_help_articles('tr','web')),0,'archived article no longer visible');
select pg_temp.login(3702,'parent',3711);
select throws_ok($$select public.get_help_articles('tr','all',true)$$,'42501','forbidden','parent cannot read unpublished FAQ');
select throws_ok($$select public.review_help_article(gen_random_uuid(),'00000000-0000-4000-8000-000000003750',2,'review','Parent approval')$$,'42501','forbidden','parent cannot approve FAQ');
reset role;
select ok(not exists(select 1 from public.audit_log where action like 'help.%' and (details::text like '%Private original message%' or details::text like '%Internal private note%')),'audit contains metadata, not transcript text');
select is((select count(*)::int from public.help_article_versions where article_id='00000000-0000-4000-8000-000000003750'),2,'article history retained');
select ok(not has_function_privilege('anon','public.get_help_ticket(uuid,bigint)','EXECUTE'),'anonymous cannot read tickets');
select ok(not has_table_privilege('authenticated','public.operations_members','INSERT'),'cannot insert own operator role');
-- Rate limits apply to new receipts, never to lost-response retries.
insert into public.help_tickets(family_id,created_by,kind,category,subject)
select '00000000-0000-4000-8000-000000003711','00000000-0000-4000-8000-000000003702','support','other','Rate fixture '||n from generate_series(1,15)n;
insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000003707','support',now()-interval '1 second');
set local role authenticated;
select pg_temp.login(3707);
select throws_ok($$select public.list_help_tickets(true)$$,'42501','forbidden','expired operator role cannot read queue');
select pg_temp.login(3702,'parent',3711);
select throws_ok($$select public.create_help_ticket(gen_random_uuid(),'support','other','Rate check','A new ticket over the limit')$$,'P0001','help_rate_limited','new tickets are rate limited');
select is((public.create_help_ticket('00000000-0000-4000-8000-000000003721','support','device','Pairing help','Private original message')->>'id')::uuid,current_setting('test.ticket')::uuid,'existing receipt still replays when rate limited');
select is(jsonb_array_length(public.get_help_ticket(current_setting('test.ticket')::uuid,0)->'messages'),0,'history cursor is respected');
select pg_temp.login(3708,'device',3711);
select throws_ok($$select public.create_help_ticket(gen_random_uuid(),'support','other','Child request','A child cannot open parent support')$$,'42501','forbidden','child cannot submit parent tickets');
reset role;
-- Account/family deletion removes private text and receipt snapshots atomically.
delete from public.families where id='00000000-0000-4000-8000-000000003711';
select is((select count(*)::int from public.help_tickets where family_id='00000000-0000-4000-8000-000000003711'),0,'family deletion removes tickets');
select is((select count(*)::int from public.help_messages where ticket_id=current_setting('test.ticket')::uuid),0,'family deletion removes messages');
select is((select count(*)::int from public.help_receipts where family_id='00000000-0000-4000-8000-000000003711'),0,'family deletion removes request snapshots');
select * from finish();
rollback;
