-- 20261106170000_star_balance_and_child_delete:
-- Q02-3 sunucu tarafı yıldız bakiyesi (veli + o çocuğa atanmış cihaz; yabancı/kardeş reddi; eski istemci toplamıyla eşitlik).
-- Q02-6 veli REST ile `children` satırını doğrudan silemez; silme yalnız `confirm_child_deletion` ile.
begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('00000000-0000-4000-8000-000000010301','sb-owner@example.invalid',false),
 ('00000000-0000-4000-8000-000000010302','sb-other@example.invalid',false),
 ('00000000-0000-4000-8000-000000010303',null,true);
insert into public.families(id,name,created_by,timezone) values
 ('10000000-0000-4000-8000-000000010301','Star family','00000000-0000-4000-8000-000000010301','Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010302','Other family','00000000-0000-4000-8000-000000010302','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000010301','00000000-0000-4000-8000-000000010301'),
 ('10000000-0000-4000-8000-000000010302','00000000-0000-4000-8000-000000010302');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000010301','10000000-0000-4000-8000-000000010301','Ada',4),
 ('20000000-0000-4000-8000-000000010302','10000000-0000-4000-8000-000000010301','Bora',2),
 ('20000000-0000-4000-8000-000000010303','10000000-0000-4000-8000-000000010301','Cem',1),
 ('20000000-0000-4000-8000-000000010304','10000000-0000-4000-8000-000000010302','Yabancı',3);
insert into public.store_subscriptions(family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at) values
 ('10000000-0000-4000-8000-000000010301','00000000-0000-4000-8000-000000010301','apple','gina_plus_monthly','plus','sb-apple-10301','active',now()+interval '30 days');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('60000000-0000-4000-8000-000000010301','10000000-0000-4000-8000-000000010301','00000000-0000-4000-8000-000000010303','20000000-0000-4000-8000-000000010301');
-- Ada: dün +10 ve +5 (aile saatine göre), bugün +3 ve -2. Bora: bugün +7. Cem: hareket yok. Yabancı: +100.
insert into public.star_events(family_id,child_id,delta,reason,created_by,created_at) values
 ('10000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010301',10,'bonus','00000000-0000-4000-8000-000000010301',
   ((now() at time zone 'Europe/Istanbul')::date - 1 + time '12:00') at time zone 'Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010301',5,'bonus','00000000-0000-4000-8000-000000010301',
   ((now() at time zone 'Europe/Istanbul')::date - 1 + time '23:59') at time zone 'Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010301',3,'bonus','00000000-0000-4000-8000-000000010301',
   ((now() at time zone 'Europe/Istanbul')::date + time '00:01') at time zone 'Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010301',-2,'adjust','00000000-0000-4000-8000-000000010301',
   ((now() at time zone 'Europe/Istanbul')::date + time '00:02') at time zone 'Europe/Istanbul'),
 ('10000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010302',7,'bonus','00000000-0000-4000-8000-000000010301',now()),
 ('10000000-0000-4000-8000-000000010302','20000000-0000-4000-8000-000000010304',100,'bonus','00000000-0000-4000-8000-000000010302',now());

create function pg_temp.parent(id text default '00000000-0000-4000-8000-000000010301', fam text default '10000000-0000-4000-8000-000000010301') returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',jsonb_build_object('family_id',fam,'role','parent'))::text,true)$$;
create function pg_temp.device(child text default '20000000-0000-4000-8000-000000010301') returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000010303','role','authenticated','gina',jsonb_build_object(
  'family_id','10000000-0000-4000-8000-000000010301','role','device','device_id','60000000-0000-4000-8000-000000010301','child_id',child))::text,true)$$;
create table pg_temp.pv(j jsonb);
grant all on pg_temp.pv to authenticated;
create function pg_temp.ada() returns uuid language sql as $$select '20000000-0000-4000-8000-000000010301'::uuid$$;
create function pg_temp.bora() returns uuid language sql as $$select '20000000-0000-4000-8000-000000010302'::uuid$$;

-- 0. Sözleşme: imza, güvenlik, yetki.
select has_function('public','child_star_balance',array['uuid','date'],'child balance RPC exists');
select has_function('public','family_star_balances','family balance RPC exists');
select ok((select prosecdef and provolatile='s' from pg_proc where oid='public.child_star_balance(uuid,date)'::regprocedure),'child balance: security definer, stable');
select ok((select prosecdef and provolatile='s' from pg_proc where oid='public.family_star_balances()'::regprocedure),'family balance: security definer, stable');
select ok(not has_function_privilege('anon','public.child_star_balance(uuid,date)','execute'),'anon cannot read child balance');
select ok(not has_function_privilege('anon','public.family_star_balances()','execute'),'anon cannot read family balances');
select ok(has_function_privilege('authenticated','public.child_star_balance(uuid,date)','execute'),'authenticated may call child balance');

set local role authenticated;

-- 1. Veli: aile özeti eski istemci toplamıyla (child_id → sum(delta)) birebir aynı.
select pg_temp.parent();
select set_eq($$select child_id,balance from public.family_star_balances()$$,
  $$select child_id,sum(delta)::int from public.star_events where family_id='10000000-0000-4000-8000-000000010301' group by child_id$$,
  'family summary equals the client-side ledger sum');
select set_eq($$select child_id,balance from public.family_star_balances()$$,
  $$values ('20000000-0000-4000-8000-000000010301'::uuid,16),('20000000-0000-4000-8000-000000010302'::uuid,7)$$,
  'family summary: Ada 16, Bora 7, no row for Cem (client shows 0)');
select ok(not exists(select 1 from public.family_star_balances() where child_id='20000000-0000-4000-8000-000000010304'),'foreign family child never in the summary');

-- 2. Veli: çocuk bakiyesi ve bugünkü hareket (aile saat dilimi). Dün 23:59 bugüne sayılmaz, bugün 00:01 sayılır.
select is((public.child_star_balance(pg_temp.ada())->>'balance')::int,16,'parent: Ada balance 16');
select is((public.child_star_balance(pg_temp.ada())->>'today_delta')::int,1,'parent: Ada today delta +3-2 in family timezone');
select is((public.child_star_balance(pg_temp.ada())->>'today')::date,(now() at time zone 'Europe/Istanbul')::date,'today is the family-local date');
select is((public.child_star_balance(pg_temp.ada(),(now() at time zone 'Europe/Istanbul')::date-1)->>'today_delta')::int,15,'explicit day: yesterday delta 15');
select is((public.child_star_balance('20000000-0000-4000-8000-000000010303')->>'balance')::int,0,'child without ledger rows has balance 0');
select is((public.child_star_balance(pg_temp.ada())->>'balance')::int,
  (select sum(delta)::int from public.star_events where child_id=pg_temp.ada()),'child balance equals client ledger sum');
select is((public.child_star_balance(pg_temp.ada())->>'balance')::int,gina.child_star_balance(pg_temp.ada()),'equals the server reward check helper');
select throws_ok($$select public.child_star_balance('20000000-0000-4000-8000-000000010304')$$,'42501','forbidden','parent cannot read a foreign child');
select throws_ok($$select public.child_star_balance(gen_random_uuid())$$,'42501','forbidden','unknown child is indistinguishable from foreign');
select throws_ok($$select public.child_star_balance(null)$$,'42501','forbidden','null child rejected');

-- 3. Cihaz: yalnız kendi çocuğu; kardeş ve aile özeti yok (star_events RLS kuralıyla aynı).
select pg_temp.device();
select is((public.child_star_balance(pg_temp.ada())->>'balance')::int,16,'device: own child balance');
select is((public.child_star_balance(pg_temp.ada())->>'today_delta')::int,1,'device: own child today delta');
select is((public.child_star_balance(pg_temp.ada())->>'balance')::int,(select coalesce(sum(delta),0)::int from public.star_events),'device: equals what its RLS ledger read used to sum');
select throws_ok($$select public.child_star_balance('20000000-0000-4000-8000-000000010302')$$,'42501','forbidden','device cannot read a sibling');
select throws_ok($$select * from public.family_star_balances()$$,'42501','forbidden','device cannot read the family summary');
-- Sahte claim: cihaz satırı başka çocuğa atanmış; claim'deki child_id tek başına yetki vermez.
select pg_temp.device('20000000-0000-4000-8000-000000010302');
select throws_ok($$select public.child_star_balance('20000000-0000-4000-8000-000000010302')$$,'42501','forbidden','forged device child claim rejected');

-- 4. Başka ailenin velisi kendi ailesinin özetini görür, bu ailenin çocuğunu göremez.
select pg_temp.parent('00000000-0000-4000-8000-000000010302','10000000-0000-4000-8000-000000010302');
select set_eq($$select child_id,balance from public.family_star_balances()$$,$$values ('20000000-0000-4000-8000-000000010304'::uuid,100)$$,'other parent sees only own family');
select throws_ok($$select public.child_star_balance('20000000-0000-4000-8000-000000010301')$$,'42501','forbidden','other parent cannot read Ada');
-- Claim'de aile değiştirilse de üyelik yoksa ret.
select pg_temp.parent('00000000-0000-4000-8000-000000010302','10000000-0000-4000-8000-000000010301');
select throws_ok($$select * from public.family_star_balances()$$,'42501','forbidden','forged family claim without membership rejected');

-- 5. Q02-6: politika envanteri — children üzerinde DELETE politikası yok, veli select/insert/update ayrık.
reset role;
select set_eq($$select policyname::text,cmd::text from pg_policies where schemaname='public' and tablename='children'$$,
  $$values ('children_device_select','SELECT'),('children_parent_select','SELECT'),('children_parent_insert','INSERT'),('children_parent_update','UPDATE')$$,
  'children policies split by command; no ALL and no DELETE policy');
select ok(not has_table_privilege('authenticated','public.children','delete'),'authenticated has no DELETE privilege on children');
select ok(not has_table_privilege('anon','public.children','delete'),'anon has no DELETE privilege on children');
select ok(has_table_privilege('authenticated','public.children','select,insert,update'),'select/insert/update privileges kept');

set local role authenticated;
select pg_temp.parent();
-- Veli doğrudan REST silmesi: yetki hatası, satır yerinde.
select throws_ok($$delete from public.children where id='20000000-0000-4000-8000-000000010303'$$,'42501',null,'parent direct DELETE on children is refused');
select is((select count(*)::int from public.children where id='20000000-0000-4000-8000-000000010303'),1,'child row still exists after refused delete');
-- Veli hâlâ okur, ekler, günceller (eski davranış korunur).
select is((select count(*)::int from public.children),3,'parent still reads own children');
select lives_ok($$insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000010305','10000000-0000-4000-8000-000000010301','Deniz',1)$$,'parent still inserts a child');
select lives_ok($$update public.children set name='Cem Ali' where id='20000000-0000-4000-8000-000000010303'$$,'parent still updates a child');
select is((select name from public.children where id='20000000-0000-4000-8000-000000010303'),'Cem Ali','update applied');
select throws_ok($$insert into public.children(family_id,name,grade) values('10000000-0000-4000-8000-000000010302','Sızma',1)$$,'42501',null,'parent cannot insert into a foreign family');
update public.children set name='Hijack' where id='20000000-0000-4000-8000-000000010304';

-- 6. Desteklenen yol: önizleme + confirm_child_deletion siler, cascade çalışır, aynı istek tekrarı aynı sonuç.
insert into pg_temp.pv select public.deletion_preview(jsonb_build_object('kind','child','child_id','20000000-0000-4000-8000-000000010302'));
select is((select (public.confirm_child_deletion('50000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010302',(j->>'preview_token')::uuid))->>'deleted' from pg_temp.pv),'true','confirm_child_deletion deletes the previewed child');
select is((select count(*)::int from public.children where id='20000000-0000-4000-8000-000000010302'),0,'child removed through the RPC');
select is((select count(*)::int from public.family_star_balances() where child_id='20000000-0000-4000-8000-000000010302'),0,'deleted child ledger cascades out of the summary');
select is((select (public.confirm_child_deletion('50000000-0000-4000-8000-000000010301','20000000-0000-4000-8000-000000010302',(j->>'preview_token')::uuid))->>'deleted' from pg_temp.pv),'true','same request id replays the same result');

-- Cihaz da silemez.
select pg_temp.device();
select throws_ok($$delete from public.children where id='20000000-0000-4000-8000-000000010301'$$,'42501',null,'device direct DELETE refused');

-- 7. Hesap/aile cascade'i hâlâ çocukları kaldırır (yetki kaldırımı FK cascade'ini etkilemez).
reset role;
select is((select name from public.children where id='20000000-0000-4000-8000-000000010304'),'Yabancı','parent could not update a foreign child');
delete from public.families where id='10000000-0000-4000-8000-000000010302';
select is((select count(*)::int from public.children where id='20000000-0000-4000-8000-000000010304'),0,'family cascade still removes children');

select * from finish();
rollback;
