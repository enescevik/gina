begin;
select no_plan();
update public.plans set prova_monthly_exams=null;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000008801','transfer-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000008802','transfer-second-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000008803','transfer-other@example.invalid');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000008801','Synthetic','00000000-0000-4000-8000-000000008801'),
 ('10000000-0000-4000-8000-000000008802','Other','00000000-0000-4000-8000-000000008803');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000008801','00000000-0000-4000-8000-000000008801'),
 ('10000000-0000-4000-8000-000000008801','00000000-0000-4000-8000-000000008802'),
 ('10000000-0000-4000-8000-000000008802','00000000-0000-4000-8000-000000008803');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000008801','10000000-0000-4000-8000-000000008801','Synthetic',4),
 ('20000000-0000-4000-8000-000000008802','10000000-0000-4000-8000-000000008801','Sibling',6);
-- Old-period routines: two active candidates, one paused, one archived, one on the sibling.
insert into public.task_templates(id,family_id,child_id,title,icon,stars,days_of_week,starts_on) values
 ('30000000-0000-4000-8000-000000008801','10000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008801','Kitap oku','read-book',2,'{1,2,3,4,5,6,7}',current_date-40),
 ('30000000-0000-4000-8000-000000008802','10000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008801','Çantayı hazırla','pack-school-bag',1,'{1,2,3,4,5,6,7}',current_date-40),
 ('30000000-0000-4000-8000-000000008803','10000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008801','Duraklatılmış','task-custom',1,'{1}',current_date-40),
 ('30000000-0000-4000-8000-000000008805','10000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008802','Kardeş rutini','task-custom',1,'{1}',current_date-40);
update public.task_templates set active=false where id='30000000-0000-4000-8000-000000008803';
insert into public.task_templates(id,family_id,child_id,title,icon,stars,days_of_week,starts_on,active,archived_at) values
 ('30000000-0000-4000-8000-000000008804','10000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008801','Arşivli','task-custom',1,'{1}',current_date-40,false,now());
-- Unfinished plan items planned in the old period: one homework with a checked step, one study, one already done.
insert into gina.learning_plan(id,child_id,revision,content) values
 ('60000000-0000-4000-8000-000000008801','20000000-0000-4000-8000-000000008801',1,jsonb_build_object('kind','homework','title','Kesirler ödevi','subject','Matematik','topic','Kesirler','planned_on',to_char(current_date-6,'YYYY-MM-DD'),'due_on',to_char(current_date-2,'YYYY-MM-DD'),'time','17:00','steps',jsonb_build_array(jsonb_build_object('id','61000000-0000-4000-8000-000000008801','label','Sayfa 12','checked',true),jsonb_build_object('id','61000000-0000-4000-8000-000000008802','label','Sayfa 13','checked',false)),'done',false,'archived',false)),
 ('60000000-0000-4000-8000-000000008802','20000000-0000-4000-8000-000000008801',1,jsonb_build_object('kind','study','title','Fen tekrarı','subject','Fen','topic','','planned_on',to_char(current_date-3,'YYYY-MM-DD'),'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',false)),
 ('60000000-0000-4000-8000-000000008803','20000000-0000-4000-8000-000000008801',1,jsonb_build_object('kind','homework','title','Bitmiş ödev','subject','Türkçe','topic','','planned_on',to_char(current_date-5,'YYYY-MM-DD'),'due_on',null,'time',null,'steps','[]'::jsonb,'done',true,'archived',false));
create function pg_temp.ch() returns uuid language sql as $$select '20000000-0000-4000-8000-000000008801'::uuid$$;
create function pg_temp.r1() returns uuid language sql as $$select '30000000-0000-4000-8000-000000008801'::uuid$$;
create function pg_temp.r2() returns uuid language sql as $$select '30000000-0000-4000-8000-000000008802'::uuid$$;
create function pg_temp.p1() returns uuid language sql as $$select '60000000-0000-4000-8000-000000008801'::uuid$$;
create function pg_temp.p2() returns uuid language sql as $$select '60000000-0000-4000-8000-000000008802'::uuid$$;
create function pg_temp.newdays() returns smallint[] language sql as $$select array(select distinct d from unnest(array[extract(isodow from current_date)::smallint,((extract(isodow from current_date)::int % 7)+1)::smallint]) d order by d)$$;
create function pg_temp.year() returns integer language sql as $$select extract(year from current_date)::int$$;
create function pg_temp.from_id() returns uuid language sql security definer as $$select id from gina.child_education_periods where child_id=pg_temp.ch() and ends_on is not null$$;
create function pg_temp.to_id() returns uuid language sql security definer as $$select id from gina.child_education_periods where child_id=pg_temp.ch() and ends_on is null$$;
create function pg_temp.preview() returns jsonb language sql security definer as $$select public.preview_education_period_transfer(pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id())$$;
create function pg_temp.items(r1 text,r2 text,p1 text,p2 text) returns jsonb language sql security definer as $$
 select jsonb_build_object('routines',jsonb_build_array(
   jsonb_build_object('id',pg_temp.r1(),'revision',(select revision from public.task_templates where id=pg_temp.r1()),'action',r1,'days_of_week',to_jsonb(pg_temp.newdays())),
   jsonb_build_object('id',pg_temp.r2(),'revision',(select revision from public.task_templates where id=pg_temp.r2()),'action',r2)),
  'plans',jsonb_build_array(
   jsonb_build_object('id',pg_temp.p1(),'revision',(select revision from gina.learning_plan where id=pg_temp.p1()),'action',p1,'planned_on',to_char(current_date+1,'YYYY-MM-DD'),'due_on',to_char(current_date+5,'YYYY-MM-DD')),
   jsonb_build_object('id',pg_temp.p2(),'revision',(select revision from gina.learning_plan where id=pg_temp.p2()),'action',p2)))$$;
create function pg_temp.copy_r() returns public.task_templates language sql security definer as $$select * from public.task_templates where source_routine_id=pg_temp.r1()$$;
create function pg_temp.copy_p() returns gina.learning_plan language sql security definer as $$select * from gina.learning_plan where source_item_id=pg_temp.p1()$$;
create function pg_temp.q(text) returns text language plpgsql security definer as $$declare r text;begin execute $1 into r;return r;end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008801","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000008801","role":"parent"}}',true);
-- Submitted work in the old period: one pending, one approved with stars.
select lives_ok($$select public.complete_task(pg_temp.r1(),current_date-1,'40000000-0000-4000-8000-000000008801',pg_temp.ch())$$,'old period work submitted');
select lives_ok($$select public.complete_task(pg_temp.r1(),current_date-2,'40000000-0000-4000-8000-000000008802',pg_temp.ch())$$,'second old submission');
select lives_ok($$select public.review_task((select id from public.task_completions where template_id=pg_temp.r1() and due_date=current_date-2),true)$$,'old work approved');
select is((select sum(delta)::int from public.star_events where child_id=pg_temp.ch()),2,'stars earned in the old period');
-- The existing transition flow closes the old period and opens the new one; routines are untouched by it.
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),0,'initial',pg_temp.year()-1,4,'İlk Okul',make_date(pg_temp.year()-1,9,1),0,true)$$,'initial period');
select lives_ok($$select public.change_child_education(gen_random_uuid(),pg_temp.ch(),1,'new_year',pg_temp.year(),5,'İlk Okul',current_date,0,true)$$,'new year opened today');
select is((select count(*)::int from public.task_templates where child_id=pg_temp.ch() and active),2,'period transition alone leaves routines running (existing behaviour)');
-- Preview lists only active, unarchived old-period routines and unfinished old-period plan items.
select is(jsonb_array_length(pg_temp.preview()->'routines'),2,'preview lists two active old routines');
select is(jsonb_array_length(pg_temp.preview()->'plans'),2,'preview lists two unfinished plan items');
select is((select x->>'pending' from jsonb_array_elements(pg_temp.preview()->'routines') x where x->>'id'=pg_temp.r1()::text),'1','preview shows pending work of a routine');
select is((select x->>'stars_earned' from jsonb_array_elements(pg_temp.preview()->'routines') x where x->>'id'=pg_temp.r1()::text),'2','preview shows earned stars that will stay');
select is((select x->>'steps_checked' from jsonb_array_elements(pg_temp.preview()->'plans') x where x->>'id'=pg_temp.p1()::text),'1','preview shows checked steps of old plan item');
select is(pg_temp.preview()->>'revision','2','preview carries education revision');
select throws_ok($$select public.preview_education_period_transfer(pg_temp.ch(),pg_temp.to_id(),pg_temp.from_id())$$,'P0001','transfer_period','current period cannot be the source');
select throws_ok($$select public.preview_education_period_transfer(pg_temp.ch(),pg_temp.from_id(),pg_temp.from_id())$$,'P0001','transfer_period','same period rejected');
select throws_ok($$select public.preview_education_period_transfer(pg_temp.ch(),pg_temp.from_id(),gen_random_uuid())$$,'P0001','transfer_period','unknown target period rejected');
-- Empty decision list while candidates exist is a stale view, not an implicit default.
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,'{"routines":[],"plans":[]}')$$,'P0001','transfer_changed','empty selection without decisions rejected');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),1,pg_temp.items('copy','pause','copy','archive'))$$,'P0001','education_changed','stale education revision rejected');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.to_id(),pg_temp.from_id(),2,pg_temp.items('copy','pause','copy','archive'))$$,'P0001','transfer_period','reversed periods rejected');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{routines,0,revision}','99'))$$,'P0001','task_routine_changed','stale routine revision rejected');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{plans,0,revision}','99'))$$,'P0001','plan_changed','stale plan revision rejected');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{routines,0,days_of_week}','[]'))$$,'P0001','transfer_invalid','copied routine needs at least one day');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{routines,0,starts_on}',to_jsonb(to_char(current_date-1,'YYYY-MM-DD'))))$$,'P0001','transfer_invalid','copy cannot start before the new period');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{plans,0,planned_on}',to_jsonb(to_char(current_date-1,'YYYY-MM-DD'))))$$,'P0001','transfer_invalid','copied plan item cannot be planned before the new period');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,jsonb_set(pg_temp.items('copy','pause','copy','archive'),'{routines,0,action}','"delete"'))$$,'P0001','transfer_invalid','deletion is not a transfer decision');
select is((select count(*)::int from public.task_templates where child_id=pg_temp.ch()),4,'rejected attempts created nothing');
-- Explicit keep for everything: nothing is created, nothing paused, decision recorded.
select is(jsonb_array_length(public.transfer_education_period_items('50000000-0000-4000-8000-000000008801',pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),2,pg_temp.items('keep','keep','keep','keep'))->'created_routines'),0,'all-keep creates no routine');
select is((select count(*)::int from public.task_templates where child_id=pg_temp.ch() and active),2,'all-keep leaves old routines running by explicit choice');
select is(pg_temp.preview()->>'revision','3','decision advances education revision');
select is(jsonb_array_length(pg_temp.preview()->'routines'),2,'kept routines remain candidates');
-- Partial selection: copy routine 1 with new days, pause routine 2; copy plan 1 with new dates, archive plan 2.
select set_config('gina.decided',pg_temp.items('copy','pause','copy','archive')::text,true);
select lives_ok($$select public.transfer_education_period_items('50000000-0000-4000-8000-000000008802',pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),3,current_setting('gina.decided')::jsonb)$$,'partial transfer applied');
select is((select count(*)::int from public.task_templates where source_routine_id is not null),1,'exactly one routine copy created');
select is((pg_temp.copy_r()).title,'Kitap oku','copy keeps title');
select is((pg_temp.copy_r()).days_of_week,pg_temp.newdays(),'copy uses corrected days');
select is((pg_temp.copy_r()).starts_on,current_date,'copy starts in the new period');
select is((pg_temp.copy_r()).effective_from,current_date,'effective_from recorded for dated history');
select is((pg_temp.copy_r()).period_id,pg_temp.to_id(),'copy belongs to new period');
select is((pg_temp.copy_r()).source_period_id,pg_temp.from_id(),'copy remembers source period');
select is((select active from public.task_templates where id=pg_temp.r1()),false,'copied source routine paused, not deleted');
select is((select active from public.task_templates where id=pg_temp.r2()),false,'unselected routine paused explicitly');
select is((select archived_at from public.task_templates where id=pg_temp.r2()),null,'unselected routine is not archived or deleted');
select is((select count(*)::int from public.task_completions where template_id=pg_temp.r1()),2,'old submissions stay on the old routine');
select is((select count(*)::int from public.task_completions where template_id=(pg_temp.copy_r()).id),0,'no work copied into the new routine');
select is((select sum(delta)::int from public.star_events where child_id=pg_temp.ch()),2,'earned stars unchanged');
select is((select task_snapshot->>'stars' from public.task_completions where template_id=pg_temp.r1() and due_date=current_date-1),'2','pending snapshot unchanged');
select is(public.task_routine_history(pg_temp.r1())->'rows'->0->>'action','pause','source routine history records the pause');
select is(public.task_routine_history((pg_temp.copy_r()).id)->'rows'->0->>'action','create','copy has its own history');
select is(pg_temp.q('select count(*) from gina.learning_plan where source_item_id is not null'),'1','exactly one plan copy created');
select is((pg_temp.copy_p()).content->>'planned_on',to_char(current_date+1,'YYYY-MM-DD'),'plan copy uses corrected date');
select is((pg_temp.copy_p()).content->>'due_on',to_char(current_date+5,'YYYY-MM-DD'),'plan copy uses corrected due date');
select is((select count(*)::int from jsonb_array_elements((pg_temp.copy_p()).content->'steps') s where (s->>'checked')::boolean),0,'old checkmarks are not carried over');
select is(jsonb_array_length((pg_temp.copy_p()).content->'steps'),2,'steps themselves continue');
select is((pg_temp.copy_p()).revision,1,'plan copy starts at revision 1');
select is(pg_temp.q('select content->>''archived'' from gina.learning_plan where id='''||pg_temp.p1()||''''),'true','copied plan source archived');
select is(pg_temp.q('select content->>''archived'' from gina.learning_plan where id='''||pg_temp.p2()||''''),'true','unselected plan item archived explicitly');
select is(pg_temp.q('select count(*) from gina.learning_plan r, jsonb_array_elements(r.content->''steps'') s where r.id='''||pg_temp.p1()||''' and (s->>''checked'')::boolean'),'1','old plan keeps its checked step');
select is(pg_temp.q('select revision from gina.learning_plan where id='''||pg_temp.p2()||''''),'2','archived plan item versioned');
select is(jsonb_array_length(pg_temp.preview()->'routines'),0,'no candidates left after full decision');
select is(jsonb_array_length(pg_temp.preview()->'plans'),0,'no plan candidates left');
select is(pg_temp.preview()->>'revision','4','transfer advances education revision');
-- Replay of the same request returns the same result without new work.
select is(public.transfer_education_period_items('50000000-0000-4000-8000-000000008802',pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),3,current_setting('gina.decided')::jsonb)->'created_routines'->0->>'id',(pg_temp.copy_r()).id::text,'same request replays same result');
select is((select count(*)::int from public.task_templates where child_id=pg_temp.ch()),5,'replay creates no second copy');
select is(pg_temp.q('select count(*) from gina.learning_plan where child_id='''||pg_temp.ch()||''''),'4','replay creates no second plan copy');
select throws_ok($$select public.transfer_education_period_items('50000000-0000-4000-8000-000000008802',pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),3,jsonb_set(current_setting('gina.decided')::jsonb,'{routines,1,action}','"copy"'))$$,'P0001','request_conflict','same request with different decisions rejected');
select is(pg_temp.q('select count(*) from gina.child_education_changes where action=''transfer_items'' and child_id='''||pg_temp.ch()||''''),'2','each decision audited once');
-- New copy can receive work; the paused source cannot.
select lives_ok($$select public.complete_task((pg_temp.copy_r()).id,current_date,gen_random_uuid(),pg_temp.ch())$$,'new routine accepts submissions');
select throws_ok($$select public.complete_task(pg_temp.r1(),current_date,gen_random_uuid(),pg_temp.ch())$$,'P0001','template_inactive','paused source takes no new submissions');
select lives_ok($$select public.review_task((select id from public.task_completions where template_id=pg_temp.r1() and due_date=current_date-1),true)$$,'pending old work still approvable');
-- Client cannot forge source links or write period columns directly.
select throws_ok($$insert into public.task_templates(family_id,child_id,title,source_routine_id) values('10000000-0000-4000-8000-000000008801',pg_temp.ch(),'Sahte',pg_temp.r1())$$,'42501',null,'source link is server-owned');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008803","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000008802","role":"parent"}}',true);
select throws_ok($$select pg_temp.preview()$$,'42501','transfer_forbidden','other family cannot preview');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),4,'{"routines":[],"plans":[]}')$$,'42501','transfer_forbidden','other family cannot transfer');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008801","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000008801","role":"device","child_id":"20000000-0000-4000-8000-000000008801"}}',true);
select throws_ok($$select pg_temp.preview()$$,'42501','transfer_forbidden','child device cannot preview');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),4,'{"routines":[],"plans":[]}')$$,'42501','transfer_forbidden','child device cannot transfer');
-- Second parent of the same family sees the same state; archived child blocks new transfer.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000008802","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000008801","role":"parent"}}',true);
select is(pg_temp.preview()->>'revision','4','second parent reads the same revision');
select lives_ok($$select public.set_child_archived(gen_random_uuid(),pg_temp.ch(),0,true)$$,'profile archived');
select throws_ok($$select public.transfer_education_period_items(gen_random_uuid(),pg_temp.ch(),pg_temp.from_id(),pg_temp.to_id(),4,'{"routines":[],"plans":[]}')$$,'P0001','child_archived','archived child cannot transfer');
select is(pg_temp.preview()->>'archived','true','preview reports archived profile');
reset role;
select ok(not has_function_privilege('anon','public.transfer_education_period_items(uuid,uuid,uuid,uuid,integer,jsonb)','execute'),'anonymous transfer denied');
select ok(not has_function_privilege('anon','public.preview_education_period_transfer(uuid,uuid,uuid)','execute'),'anonymous preview denied');
select ok(not has_function_privilege('authenticated','gina.period_transfer_candidates(uuid,gina.child_education_periods)','execute'),'candidate helper private');
select ok(not has_column_privilege('authenticated','public.task_templates','source_routine_id','INSERT'),'source column not insertable by clients');
select * from finish();
rollback;
