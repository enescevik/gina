-- RLS senaryoları: iki aile, bir ebeveyn ve bir cihaz; JWT claim'leri request.jwt.claims ile taklit edilir.
begin;
select no_plan();

-- Test kullanıcıları (yerel auth.users) ---------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-a@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-b@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

-- Aile A ve Aile B (superuser olarak doğrudan) ------------------------------------------
insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000a', 'Aile A', '00000000-0000-0000-0000-00000000a001'),
  ('10000000-0000-0000-0000-00000000000b', 'Aile B', '00000000-0000-0000-0000-00000000b001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a001'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000b001');
insert into public.children (id, family_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Çocuk A1'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Çocuk A2'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Çocuk B1');
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000d001', '20000000-0000-0000-0000-0000000000a1');
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', 'Dişlerini fırçala', 2, current_date - 30),
  ('40000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', 'Odanı topla', 1, current_date - 30),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-0000000000b1', 'Kitap oku', 1, current_date - 30);

insert into public.task_templates(id,family_id,child_id,title,starts_on) values('40000000-0000-0000-0000-0000000000a3','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-0000000000a1','İkinci görev',current_date-30);
-- Legacy/service imported row: no receipt yet.
insert into public.task_completions(family_id,child_id,template_id,due_date,client_id,completed_by) values('10000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-0000000000b1','40000000-0000-0000-0000-0000000000b1',current_date,'50000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-00000000b001');
create function pg_temp.child() returns text language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000d001","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-00000000000a","role":"device","device_id":"30000000-0000-0000-0000-0000000000d1","child_id":"20000000-0000-0000-0000-0000000000a1"}}',true)$$;
create function pg_temp.parent() returns text language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","gina":{"family_id":"10000000-0000-0000-0000-00000000000a","role":"parent"}}',true)$$;
create function pg_temp.send(client uuid default '50000000-0000-0000-0000-000000000001',task uuid default '40000000-0000-0000-0000-0000000000a1',day date default current_date) returns public.task_completions language sql as $$select public.complete_task(task,day,client)$$;
create function pg_temp.row_id() returns uuid language sql as $$select id from public.task_completions where template_id='40000000-0000-0000-0000-0000000000a1' and due_date=current_date$$;
set local role authenticated;select pg_temp.child();
select throws_ok($$select pg_temp.send(client=>null)$$,'P0001','invalid_completion','null request denied');
select throws_ok($$select pg_temp.send(day=>null)$$,'P0001','invalid_completion','null day denied');
select throws_ok($$select pg_temp.send(day=>'infinity')$$,'P0001','invalid_completion','infinite day denied');
select throws_ok($$select pg_temp.send(client=>'50000000-0000-0000-0000-000000000091')$$,'P0001','completion_request_conflict','legacy foreign client id never returns another family row');
select is((pg_temp.send()).status::text,'done','new submission works');
select is((pg_temp.send()).id,pg_temp.row_id(),'same request recovers original completion');
select throws_ok($$select pg_temp.send(task=>'40000000-0000-0000-0000-0000000000a3')$$,'P0001','completion_request_conflict','receipt bound to original task');
select throws_ok($$select pg_temp.send(day=>current_date-1)$$,'P0001','completion_request_conflict','receipt bound to original day');
select throws_ok($$select * from gina.task_submission_receipts$$,'42501',null,'receipt table is private');
select pg_temp.parent();
select throws_ok($$select public.complete_task('40000000-0000-0000-0000-0000000000a2',current_date,'50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-0000000000a2')$$,'P0001','completion_request_conflict','parent cannot reuse request for sibling');
select public.review_task(pg_temp.row_id(),false);
select pg_temp.child();
select is((pg_temp.send()).status::text,'returned','retry after return does not resubmit');
select is((pg_temp.send('50000000-0000-0000-0000-000000000002')).status::text,'done','new explicit submission can resubmit');
select is((pg_temp.send('50000000-0000-0000-0000-000000000099')).id,pg_temp.row_id(),'second device command aliases same completion');
select pg_temp.parent();select public.review_task(pg_temp.row_id(),false);select pg_temp.child();
select is((pg_temp.send()).status::text,'returned','old original command remains inert after a second return');
select is((pg_temp.send('50000000-0000-0000-0000-000000000099')).status::text,'returned','alias command also stays inert after return');
select is((select client_id::text from public.task_completions where id=pg_temp.row_id()),'50000000-0000-0000-0000-000000000002','replays do not replace current client identity');
select is((pg_temp.send('50000000-0000-0000-0000-000000000003')).status::text,'done','another explicit submission works');
select public.undo_complete(pg_temp.row_id());
select throws_ok($$select pg_temp.send('50000000-0000-0000-0000-000000000003')$$,'P0001','completion_withdrawn','replay cannot restore undone work');
select throws_ok($$select pg_temp.send()$$,'P0001','completion_withdrawn','all prior aliases remain withdrawn');
select is((select count(*)::int from public.task_completions),0,'undo leaves no own completion');
select is((pg_temp.send('50000000-0000-0000-0000-000000000004')).status::text,'done','fresh explicit command can complete again');
select pg_temp.parent();select public.review_task(pg_temp.row_id(),true);select pg_temp.child();
select is((pg_temp.send('50000000-0000-0000-0000-000000000004')).status::text,'approved','retry preserves current approved status');
select is((select sum(delta)::int from public.star_events),2,'approval awards stars once');
select throws_ok($$select public.undo_complete(pg_temp.row_id())$$,'P0001','already_reviewed','approved work cannot be undone');
reset role;
savepoint weekday_check;
update public.task_templates set days_of_week=array[case when extract(isodow from current_date)=1 then 2 else 1 end]::smallint[] where id='40000000-0000-0000-0000-0000000000a3';
set local role authenticated;
select throws_ok($$select pg_temp.send(client=>gen_random_uuid(),task=>'40000000-0000-0000-0000-0000000000a3')$$,'P0001','template_inactive','unscheduled weekday cannot earn a completion');
reset role;rollback to weekday_check;
update public.devices set revoked_at=now() where id='30000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select throws_ok($$select pg_temp.send('50000000-0000-0000-0000-000000000004')$$,'42501','forbidden','revoked device cannot recover receipt');
reset role;
delete from public.children where id='20000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from gina.task_submission_receipts),0,'child deletion removes submission receipts');
select * from finish();rollback;
