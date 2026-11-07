-- U03/L04 takvim: 20261106200000_calendar_archived_events — veli okuması arşivli etkinliği görmez;
-- arşiv/geri alma (SECURITY DEFINER) çalışmaya devam eder; cihaz kuralı ve politika envanteri değişmez.
begin;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000010601','cal-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000010602','cal-second@example.invalid'),
 ('00000000-0000-4000-8000-000000010603','cal-other@example.invalid'),
 ('00000000-0000-4000-8000-000000010604','cal-device@example.invalid');
insert into public.families(id,name,timezone,created_by) values
 ('10000000-0000-4000-8000-000000010601','Synthetic calendar','Europe/Istanbul','00000000-0000-4000-8000-000000010601'),
 ('10000000-0000-4000-8000-000000010602','Other calendar','Europe/Istanbul','00000000-0000-4000-8000-000000010603');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010601','00000000-0000-4000-8000-000000010601'),
 ('10000000-0000-4000-8000-000000010601','00000000-0000-4000-8000-000000010602'),
 ('10000000-0000-4000-8000-000000010602','00000000-0000-4000-8000-000000010603');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000010601','10000000-0000-4000-8000-000000010601','Ada',3),
 ('20000000-0000-4000-8000-000000010602','10000000-0000-4000-8000-000000010602','Other',3);
insert into public.devices(id,family_id,auth_user_id,active_child_id,name) values
 ('70000000-0000-4000-8000-000000010604','10000000-0000-4000-8000-000000010601','00000000-0000-4000-8000-000000010604','20000000-0000-4000-8000-000000010601','Tablet');
insert into public.events(id,family_id,child_id,type,title,starts_at,ends_at,rrule,visible_to_child,archived_at) values
 ('35000000-0000-4000-8000-000000010601','10000000-0000-4000-8000-000000010601','20000000-0000-4000-8000-000000010601','activity','Yüzme',now()+interval '1 day',now()+interval '1 day 1 hour',null,true,null),
 ('35000000-0000-4000-8000-000000010602','10000000-0000-4000-8000-000000010601','20000000-0000-4000-8000-000000010601','activity','Eski kurs',now()+interval '1 day',now()+interval '1 day 1 hour','FREQ=WEEKLY;BYDAY=MO',true,now()),
 ('35000000-0000-4000-8000-000000010603','10000000-0000-4000-8000-000000010601',null,'family','Aile pikniği',now()+interval '2 day',null,null,true,null),
 ('35000000-0000-4000-8000-000000010604','10000000-0000-4000-8000-000000010602','20000000-0000-4000-8000-000000010602','activity','Başka aile',now()+interval '1 day',null,null,true,null);
insert into public.event_exceptions(event_id,occurrence_date) values
 ('35000000-0000-4000-8000-000000010602',current_date+7),('35000000-0000-4000-8000-000000010601',current_date+1);
create function pg_temp.as_parent(uid text) returns void language sql as $$select set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated','gina',json_build_object('family_id','10000000-0000-4000-8000-000000010601','role','parent'))::text,true)$$;
create function pg_temp.archived(id uuid) returns timestamptz language sql security definer as $$select archived_at from public.events where events.id=$1$$;
create function pg_temp.exists_row(id uuid) returns boolean language sql security definer as $$select exists(select 1 from public.events where events.id=$1)$$;
create function pg_temp.title(id uuid) returns text language sql security definer as $$select title from public.events where events.id=$1$$;
create function pg_temp.rev(id uuid) returns int language sql security definer as $$select edit_revision from public.events where events.id=$1$$;

-- 1. Politika: ad/komut/tür aynı, USING arşivi dışlıyor, WITH CHECK değişmedi; sayı 112.
select is((select cmd||'/'||permissive||'/'||array_to_string(roles,',') from pg_policies where schemaname='public' and tablename='events' and policyname='events_parent_all'),'ALL/PERMISSIVE/authenticated','events_parent_all keeps command, type and role');
select ok((select qual from pg_policies where schemaname='public' and tablename='events' and policyname='events_parent_all') ~ 'archived_at IS NULL','parent USING excludes archived rows');
select ok((select with_check from pg_policies where schemaname='public' and tablename='events' and policyname='events_parent_all') !~ 'archived_at','parent WITH CHECK unchanged (no archive term)');
select ok((select qual from pg_policies where schemaname='public' and tablename='events' and policyname='events_parent_all') ~ '\( SELECT gina\.is_parent\(\) AS','helper call stays an InitPlan subquery');
select is((select count(*)::int from pg_policies where schemaname='public'),120,'public policy count (112 existing + 5 chain admin reads + 3 private reaction policies)');
select is((select count(*)::int from pg_policies where schemaname='public' and tablename='events'),2,'events still has two policies');

-- 2. Veli okuması.
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000010601');
select is((select array_agg(title order by title) from public.events),array['Aile pikniği','Yüzme'],'parent sees live events only, not the archived series or another family');
select is((select count(*)::int from public.events where id='35000000-0000-4000-8000-000000010602'),0,'archived event not readable by id');
select is((select count(*)::int from public.events where archived_at is not null),0,'no archived row through any filter');
select is((select count(*)::int from public.event_exceptions),1,'exceptions of the archived series are hidden; live one stays');
select pg_temp.as_parent('00000000-0000-4000-8000-000000010602');
select is((select count(*)::int from public.events),2,'second parent reads the same two live events');

-- 3. Doğrudan yazma: arşivli satır güncellenemez/silinemez; canlı satır mevcut kurala göre yazılır.
select pg_temp.as_parent('00000000-0000-4000-8000-000000010601');
update public.events set title='Gizli değişiklik' where id='35000000-0000-4000-8000-000000010602';
select is(pg_temp.title('35000000-0000-4000-8000-000000010602'),'Eski kurs','direct update cannot reach an archived row');
delete from public.events where id='35000000-0000-4000-8000-000000010602';
select ok(pg_temp.exists_row('35000000-0000-4000-8000-000000010602'),'direct delete cannot reach an archived row');
select lives_ok($$insert into public.events(family_id,child_id,type,title,starts_at) values('10000000-0000-4000-8000-000000010601',null,'family','Yeni etkinlik',now())$$,'parent insert still allowed');
select throws_ok($$insert into public.events(family_id,child_id,type,title,starts_at) values('10000000-0000-4000-8000-000000010602',null,'family','Yabancı',now())$$,'42501',null,'insert into another family still rejected');
select is((select count(*)::int from public.events),3,'new live event visible');
select lives_ok($$select public.save_calendar_event(gen_random_uuid(),'35000000-0000-4000-8000-000000010601',pg_temp.rev('35000000-0000-4000-8000-000000010601'),jsonb_build_object('title','Yüzme kursu','type','activity','child_id','20000000-0000-4000-8000-000000010601','starts_at',now()+interval '1 day','ends_at',null,'all_day',false,'location',null,'rrule',null))$$,'calendar command still edits a live event');
select is((select title from public.events where id='35000000-0000-4000-8000-000000010601'),'Yüzme kursu','edit visible');

-- 4. Arşiv ve geri alma (L02 RPC'leri) bu daraltmayla çalışır.
select is((select r->'summary'->>'ok' from (select public.bulk_archive_apply(jsonb_build_array(jsonb_build_object('type','event','id','35000000-0000-4000-8000-000000010601','revision',pg_temp.rev('35000000-0000-4000-8000-000000010601'))),'51000000-0000-4000-8000-000000010601') r) x),'1','bulk archive of a live event');
select ok(pg_temp.archived('35000000-0000-4000-8000-000000010601') is not null,'archived_at set (owner read)');
select is((select count(*)::int from public.events where id='35000000-0000-4000-8000-000000010601'),0,'just-archived event disappears from parent read');
select is((select count(*)::int from jsonb_array_elements(public.bulk_archive_preview('{"types":["event"],"archived":true}')->'items')),2,'restore preview still lists both archived events');
select is((select r->'summary'->>'ok' from (select public.bulk_restore_apply(jsonb_build_array(jsonb_build_object('type','event','id','35000000-0000-4000-8000-000000010602','revision',pg_temp.rev('35000000-0000-4000-8000-000000010602'))),'51000000-0000-4000-8000-000000010602') r) x),'1','restore of a hidden archived series works');
select is((select title from public.events where id='35000000-0000-4000-8000-000000010602'),'Eski kurs','restored series readable again');
select is((select count(*)::int from public.event_exceptions where event_id='35000000-0000-4000-8000-000000010602'),1,'its exception is readable again');

-- 5. Cihaz kuralı aynı; başka aile görmez; anonim erişim yok.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010604","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010601","role":"device","child_id":"20000000-0000-4000-8000-000000010601"}}',true);
select is((select array_agg(title order by title) from public.events),array['Aile pikniği','Eski kurs','Yeni etkinlik'],'device sees live events only (archived Yüzme kursu hidden)');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000010603","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000010602","role":"parent"}}',true);
select is((select array_agg(title) from public.events),array['Başka aile'],'other family sees only its own');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.events$$,'42501',null,'anon has no table privilege');
reset role;
select * from finish();
rollback;
