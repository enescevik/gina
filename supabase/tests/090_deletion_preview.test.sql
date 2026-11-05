begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000009001','del-owner@example.invalid',false),
 ('00000000-0000-4000-8000-000000009002','del-partner@example.invalid',false),
 ('00000000-0000-4000-8000-000000009003','del-single@example.invalid',false),
 ('00000000-0000-4000-8000-000000009004',null,true),
 ('00000000-0000-4000-8000-000000009005',null,true);
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000009001','Shared family','00000000-0000-4000-8000-000000009001'),
 ('10000000-0000-4000-8000-000000009003','Single family','00000000-0000-4000-8000-000000009003');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009001'),
 ('10000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009002'),
 ('10000000-0000-4000-8000-000000009003','00000000-0000-4000-8000-000000009003');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','Ece',5),
 ('20000000-0000-4000-8000-000000009002','10000000-0000-4000-8000-000000009001','Can',3),
 ('20000000-0000-4000-8000-000000009003','10000000-0000-4000-8000-000000009003','Oth',4);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('60000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009004','20000000-0000-4000-8000-000000009001'),
 ('60000000-0000-4000-8000-000000009003','10000000-0000-4000-8000-000000009003','00000000-0000-4000-8000-000000009005','20000000-0000-4000-8000-000000009003');
insert into public.task_templates(id,family_id,child_id,title) values('40000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','Read');
insert into public.task_completions(family_id,child_id,template_id,due_date,client_id,status) values('10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','40000000-0000-4000-8000-000000009001',current_date,gen_random_uuid(),'done');
insert into public.star_events(family_id,child_id,delta,reason,created_by) values
 ('10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001',10,'bonus','00000000-0000-4000-8000-000000009001'),
 ('10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001',-3,'adjust','00000000-0000-4000-8000-000000009001');
insert into public.exams(id,family_id,child_id,title,subject,grade,status) values('70000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','Prova','Matematik',5,'assigned');
insert into public.exam_attempts(family_id,exam_id,child_id) values('10000000-0000-4000-8000-000000009001','70000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001');
insert into public.family_rewards(id,family_id,title,cost_stars) values('80000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','Sinema',5);
insert into public.reward_requests(family_id,child_id,reward_id,cost_snapshot,idempotency_key) values('10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','80000000-0000-4000-8000-000000009001',5,gen_random_uuid());
insert into public.child_shares(family_id,child_id,created_by,label,scopes,token_hash) values('10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009001','Teacher',array['grades'],extensions.digest('deletion-test','sha256'));
insert into public.notes(id,family_id,child_id,author_user_id,body,visibility) values
 ('30000000-0000-4000-8000-000000009001','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009001','Owner private about Ece','private'),
 ('30000000-0000-4000-8000-000000009002','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009002','Partner private about Ece','private'),
 ('30000000-0000-4000-8000-000000009003','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009002','Partner shared about Ece','family'),
 ('30000000-0000-4000-8000-000000009004','10000000-0000-4000-8000-000000009001',null,'00000000-0000-4000-8000-000000009001','Owner general note','family'),
 ('30000000-0000-4000-8000-000000009005','10000000-0000-4000-8000-000000009001','20000000-0000-4000-8000-000000009002','00000000-0000-4000-8000-000000009002','Partner private about Can','private'),
 ('30000000-0000-4000-8000-000000009006','10000000-0000-4000-8000-000000009003','20000000-0000-4000-8000-000000009003','00000000-0000-4000-8000-000000009003','Single private about Oth','private');
insert into public.store_subscriptions(family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at) values
 ('10000000-0000-4000-8000-000000009001','00000000-0000-4000-8000-000000009001','apple','gina_plus_monthly','plus','del-apple-9001','active',now()+interval '30 days'),
 ('10000000-0000-4000-8000-000000009003','00000000-0000-4000-8000-000000009003','google','gina_pro_yearly','pro','del-google-9003','grace',now()+interval '3 days');
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent) values
 ('90000000-0000-4000-8000-000000009003','10000000-0000-4000-8000-000000009003','00000000-0000-4000-8000-000000009003','document','Program.pdf','application/pdf',2048,repeat('a',64),'10000000-0000-4000-8000-000000009003/program.pdf','ready','granted');
create table pg_temp.pv(label text primary key,j jsonb);
grant all on pg_temp.pv to authenticated;
create function pg_temp.actor(id text,role_name text default 'parent') returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',jsonb_build_object('family_id',case when id like '%9003' then '10000000-0000-4000-8000-000000009003' else '10000000-0000-4000-8000-000000009001' end,'role',role_name,'device_id',case when role_name='device' then '60000000-0000-4000-8000-000000009001' else null end,'child_id',case when role_name='device' then '20000000-0000-4000-8000-000000009001' else null end))::text,true)$$;
create function pg_temp.service() returns text language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
grant select on pg_temp.pv to service_role;
create function pg_temp.get(l text) returns jsonb language sql as $$select j from pg_temp.pv where label=l$$;
create function pg_temp.tok(l text) returns uuid language sql as $$select (j->>'preview_token')::uuid from pg_temp.pv where label=l$$;
create function pg_temp.ece() returns uuid language sql as $$select '20000000-0000-4000-8000-000000009001'::uuid$$;
create function pg_temp.can() returns uuid language sql as $$select '20000000-0000-4000-8000-000000009002'::uuid$$;
create function pg_temp.fill_previews() returns int language plpgsql security definer as $$
declare n int;begin
 select count(*) into n from gina.deletion_previews where actor_id=auth.uid() and created_at>now()-interval '1 hour';
 for i in 1..(30-n) loop perform public.deletion_preview('{"kind":"account"}');end loop;return 30;end$$;

set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
select throws_ok($$select public.deletion_preview(jsonb_build_object('kind','child','child_id','20000000-0000-4000-8000-000000009003'))$$,'42501','forbidden','foreign child rejected');
select throws_ok($$select public.deletion_preview('{"kind":"family"}')$$,'P0001','deletion_target_invalid','unknown target kind rejected');
select throws_ok($$select public.deletion_preview('{"kind":"child","child_id":"nope"}')$$,'P0001','deletion_target_invalid','malformed child id rejected');
select throws_ok($$select public.deletion_preview('[]')$$,'P0001','deletion_target_invalid','non-object target rejected');
insert into pg_temp.pv values('ece1',public.deletion_preview(jsonb_build_object('kind','child','child_id',pg_temp.ece())));
select is(pg_temp.get('ece1')#>>'{child,name}','Ece','preview names the child');
select is(pg_temp.get('ece1')#>>'{deletes,notes,own}','1','own note counted as deleted');
select is(pg_temp.get('ece1')#>>'{deletes,notes,shared}','1','co-parent shared note counted as deleted');
select is(pg_temp.get('ece1')#>>'{preserved,co_parent_private_notes}','1','co-parent personal note counted as preserved');
select is(pg_temp.get('ece1')#>>'{deletes,task_routines}','1','routine counted');
select is(pg_temp.get('ece1')#>>'{deletes,pending_task_reviews}','1','pending review counted');
select is(pg_temp.get('ece1')#>>'{deletes,stars,balance}','7','star balance summed');
select is(pg_temp.get('ece1')#>>'{deletes,prova,attempts}','1','attempt counted');
select is(pg_temp.get('ece1')#>>'{deletes,rewards,pending}','1','pending reward request counted');
select is(pg_temp.get('ece1')#>>'{deletes,shares,open}','1','open share counted');
select is(pg_temp.get('ece1')->>'shares_active','1','active share counted');
select is(pg_temp.get('ece1')#>>'{deletes,devices,active_sessions}','1','active device session counted');
select is(pg_temp.get('ece1')#>>'{preserved,other_children}','1','sibling stays');
select is(pg_temp.get('ece1')#>>'{preserved,family_notes}','1','family-level note preserved');
select ok((pg_temp.get('ece1')->'warnings') ? 'active_device_sessions','warns about active device session of unarchived child');
select ok((pg_temp.get('ece1')->'warnings') ? 'open_shares_revoked','warns that shares close');
select ok((pg_temp.get('ece1')->'warnings') ? 'in_progress_attempts','warns about open attempt');
select ok((pg_temp.get('ece1')->'warnings') ? 'co_parent_private_notes_kept','warns that co-parent personal note is kept');
select is(pg_temp.get('ece1')#>>'{alternatives,archive_available}','true','archive offered as reversible alternative');
select is(pg_temp.get('ece1')#>>'{subscription,cancelled_by_deletion}','false','child deletion never claims subscription cancellation');
select ok(pg_temp.tok('ece1') is not null,'preview token issued');
select ok((pg_temp.get('ece1')->>'expires_at')::timestamptz between now()+interval '14 minutes' and now()+interval '16 minutes','preview expires in 15 minutes');
select throws_ok(format($$select public.confirm_child_deletion(gen_random_uuid(),%L,%L)$$,pg_temp.can(),pg_temp.tok('ece1')),'P0001','deletion_preview_not_found','token bound to the previewed child');
select pg_temp.actor('00000000-0000-4000-8000-000000009002');
select throws_ok(format($$select public.confirm_child_deletion(gen_random_uuid(),%L,%L)$$,pg_temp.ece(),pg_temp.tok('ece1')),'P0001','deletion_preview_not_found','another parent cannot use the token');
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
update public.children set name='Ece Nur' where id=pg_temp.ece();
select throws_ok(format($$select public.confirm_child_deletion(gen_random_uuid(),%L,%L)$$,pg_temp.ece(),pg_temp.tok('ece1')),'P0001','deletion_preview_stale','changed target rejects old preview');
select is((select count(*)::int from public.children where id=pg_temp.ece()),1,'stale preview deleted nothing');
insert into pg_temp.pv values('ece2',public.deletion_preview(jsonb_build_object('kind','child','child_id',pg_temp.ece())));
reset role;
update gina.deletion_previews set expires_at=now()-interval '1 second' where token=pg_temp.tok('ece2');
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
select throws_ok(format($$select public.confirm_child_deletion(gen_random_uuid(),%L,%L)$$,pg_temp.ece(),pg_temp.tok('ece2')),'P0001','deletion_preview_expired','expired preview rejected');
insert into pg_temp.pv values('ece3',public.deletion_preview(jsonb_build_object('kind','child','child_id',pg_temp.ece())));
insert into pg_temp.pv values('done',public.confirm_child_deletion('50000000-0000-4000-8000-000000009001',pg_temp.ece(),pg_temp.tok('ece3')));
select is(pg_temp.get('done')->>'deleted','true','fresh preview deletes');
select is(pg_temp.get('done')->>'name','Ece Nur','result names the deleted child');
select is(public.confirm_child_deletion('50000000-0000-4000-8000-000000009001',pg_temp.ece(),pg_temp.tok('ece3')),pg_temp.get('done'),'same request replays the same result');
select is((select count(*)::int from public.children where id=pg_temp.ece()),0,'child removed');
select throws_ok(format($$select public.confirm_child_deletion(gen_random_uuid(),%L,%L)$$,pg_temp.ece(),pg_temp.tok('ece3')),'P0001','deletion_preview_not_found','used token cannot be replayed under a new request');
reset role;
select is((select count(*)::int from public.notes where id='30000000-0000-4000-8000-000000009001'),0,'deleting parent own private note removed');
select is((select count(*)::int from public.notes where id='30000000-0000-4000-8000-000000009003'),0,'shared note about the child removed');
select is((select child_id from public.notes where id='30000000-0000-4000-8000-000000009002'),null,'co-parent personal note detached, not deleted');
select is((select visibility::text from public.notes where id='30000000-0000-4000-8000-000000009002'),'private','detached note stays private');
select is((select count(*)::int from gina.deletion_previews where child_id=pg_temp.ece()),0,'child previews removed with the child');
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009002');
select is((select count(*)::int from public.notes where id='30000000-0000-4000-8000-000000009002'),1,'author still reads the detached note');
select pg_temp.actor('00000000-0000-4000-8000-000000009004','device');
select throws_ok($$select public.deletion_preview('{"kind":"account"}')$$,'42501','forbidden','device role cannot preview');
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
insert into pg_temp.pv values('acc',public.deletion_preview('{"kind":"account"}'));
select is(jsonb_array_length(pg_temp.get('acc')->'families'),1,'account preview lists memberships');
select is(pg_temp.get('acc')#>>'{families,0,mode}','transfer','shared family is transferred, not deleted');
select is(pg_temp.get('acc')#>>'{families,0,other_parents}','1','remaining parent counted');
select is(pg_temp.get('acc')#>>'{families,0,preserved,children}','1','children preserved for the remaining parent');
select is(pg_temp.get('acc')#>>'{families,0,deletes,own_notes}','1','only own notes deleted');
select is(pg_temp.get('acc')#>>'{families,0,preserved,ownership_transferred}','true','ownership transfer announced');
select is(pg_temp.get('acc')#>>'{subscriptions,0,purchased_by_me}','true','own store subscription listed');
select is(pg_temp.get('acc')#>>'{subscriptions,0,cancelled_by_deletion}','false','deletion never cancels the store subscription');
select is(pg_temp.get('acc')#>>'{subscriptions,0,managed_in_store}','true','subscription managed in the store');
select ok((pg_temp.get('acc')->'warnings') ? 'subscription_not_cancelled','warns about the store subscription');
select ok((pg_temp.get('acc')->'warnings') ? 'ownership_transferred','warns about ownership transfer');
select ok(not ((pg_temp.get('acc')->'warnings') ? 'family_deleted'),'shared family is not deleted');
select ok(not ((pg_temp.get('acc')->'warnings') ? 'billing_in_progress'),'no billing process pending for shared family');
select throws_ok(format($$select public.check_deletion_preview(%L,%L)$$,pg_temp.tok('acc'),'00000000-0000-4000-8000-000000009001'),'42501',null,'clients cannot run the service check');
reset role;set local role service_role;select pg_temp.service();
select is(public.check_deletion_preview(pg_temp.tok('acc'),'00000000-0000-4000-8000-000000009001')->>'status','ok','service accepts fresh account preview');
select is(public.check_deletion_preview(pg_temp.tok('acc'),'00000000-0000-4000-8000-000000009002')->>'status','not_found','token bound to its account');
select is(public.check_deletion_preview(pg_temp.tok('ece3'),'00000000-0000-4000-8000-000000009001')->>'status','not_found','child token is not an account token');
select is(public.check_deletion_preview(gen_random_uuid(),'00000000-0000-4000-8000-000000009001')->>'status','not_found','unknown token');
reset role;
insert into public.children(family_id,name,grade) values('10000000-0000-4000-8000-000000009001','Yeni',1);
set local role service_role;
select pg_temp.service();
select is(public.check_deletion_preview(pg_temp.tok('acc'),'00000000-0000-4000-8000-000000009001')->>'status','stale','family change invalidates account preview');
reset role;
update gina.deletion_previews set expires_at=now()-interval '1 second' where token=pg_temp.tok('acc');
set local role service_role;
select pg_temp.service();
select is(public.check_deletion_preview(pg_temp.tok('acc'),'00000000-0000-4000-8000-000000009001')->>'status','expired','expiry reported before staleness');
reset role;set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009003');
insert into pg_temp.pv values('single',public.deletion_preview('{"kind":"account"}'));
select is(pg_temp.get('single')#>>'{families,0,mode}','cascade','last parent deletes the family');
select is(pg_temp.get('single')#>>'{families,0,deletes,children}','1','cascade counts children');
select is(pg_temp.get('single')#>>'{families,0,children,0,name}','Oth','cascade names children');
select ok(pg_temp.get('single')#>'{families,0,children,0,counts}' is not null,'cascade includes per-child counts');
select is(pg_temp.get('single')#>>'{families,0,deletes,files,count}','1','family file counted');
select is(pg_temp.get('single')#>>'{families,0,deletes,files,bytes}','2048','file size summed');
select is(pg_temp.get('single')#>>'{families,0,deletes,anonymous_device_accounts}','1','anonymous device account counted');
select ok((pg_temp.get('single')->'warnings') ? 'family_deleted','warns that the family goes');
select ok((pg_temp.get('single')->'warnings') ? 'billing_in_progress','grace-period subscription flagged');
select ok((pg_temp.get('single')->'warnings') ? 'subscription_not_cancelled','store subscription survives deletion');
select is(pg_temp.get('single')#>>'{alternatives,archivable_children}','1','archive offered for active children');
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
select lives_ok($$select public.set_child_archived(gen_random_uuid(),pg_temp.can(),0,true)$$,'archive sibling first');
select lives_ok($$delete from public.children where id=pg_temp.can()$$,'legacy direct deletion of archived child still works');
reset role;
select is((select child_id from public.notes where id='30000000-0000-4000-8000-000000009005'),null,'legacy path also detaches co-parent personal note');
select is((select count(*)::int from public.notes where id='30000000-0000-4000-8000-000000009005'),1,'legacy path keeps the note');
select ok(not has_function_privilege('anon','public.deletion_preview(jsonb)','execute'),'anonymous preview denied');
select ok(not has_function_privilege('authenticated','public.check_deletion_preview(uuid,uuid)','execute'),'client service-check denied');
select ok(not has_table_privilege('authenticated','gina.deletion_previews','select'),'preview table private');
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-000000009003'$$,'last-parent account deletion cascades with the detach trigger present');
select is((select count(*)::int from public.families where id='10000000-0000-4000-8000-000000009003'),0,'single family removed');
select is((select count(*)::int from public.notes where id='30000000-0000-4000-8000-000000009006'),0,'single family note removed');
select is((select count(*)::int from gina.deletion_previews where actor_id='00000000-0000-4000-8000-000000009003'),0,'single account previews removed');
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009001');
select is(pg_temp.fill_previews(),30,'preview budget filled');
select throws_ok($$select public.deletion_preview('{"kind":"account"}')$$,'P0001','deletion_preview_rate_limited','preview flood limited');
select * from finish();rollback;
