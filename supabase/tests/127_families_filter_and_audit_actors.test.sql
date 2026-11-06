begin;
select no_plan();
-- D12 (D11-K1, D11-K2): /families "bitişi 14 gün içinde" süzgeci + sıralama (sunucu tarafı, keyset) ve
-- denetim "Yapan" etiketi için yalnız tam yöneticiye açık admin_audit_actors.
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000012701','d12-admin@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012702','d12-support@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012703','d12-content@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012704','d12-finance@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012705','d12-revoked-op@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012706','d12-parent@example.invalid',false,'{}'),
 ('00000000-0000-4000-8000-000000012707','d12-admin2@example.invalid',false,'{}');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000012701'),('00000000-0000-4000-8000-000000012707');
insert into public.operations_members(user_id,role,expires_at,revoked_at) values
 ('00000000-0000-4000-8000-000000012702','support',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000012703','content',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000012704','finance',now()+interval '30 days',null),
 ('00000000-0000-4000-8000-000000012705','support',now()+interval '30 days',now()-interval '1 day');

-- Aileler: A +3g (plus telafi), B +10g (pro telafi), C +20g (kapsam dışı), D +5g (mağaza), E ücretsiz,
-- F iptal edilmiş telafi (+2g, etkin değil), G +14g-1dk (sınırda, içeride), H gelecekte başlayan telafi (etkin değil).
insert into public.families(id,name,created_by,timezone,locale,created_at) values
 ('10000000-0000-4000-8000-000000012701','D12 A ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '8 days'),
 ('10000000-0000-4000-8000-000000012702','D12 B ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '7 days'),
 ('10000000-0000-4000-8000-000000012703','D12 C ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '6 days'),
 ('10000000-0000-4000-8000-000000012704','D12 D ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '5 days'),
 ('10000000-0000-4000-8000-000000012705','D12 E ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '4 days'),
 ('10000000-0000-4000-8000-000000012706','D12 F ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '3 days'),
 ('10000000-0000-4000-8000-000000012707','D12 G ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '2 days'),
 ('10000000-0000-4000-8000-000000012708','D12 H ailesi','00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '1 day');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000012701','00000000-0000-4000-8000-000000012706');
insert into public.entitlement_overrides(family_id,plan,reason,granted_by,starts_at,ends_at,revoked_at) values
 ('10000000-0000-4000-8000-000000012701','plus','D12 test','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+interval '3 days',null),
 ('10000000-0000-4000-8000-000000012702','pro','D12 test','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+interval '10 days',null),
 ('10000000-0000-4000-8000-000000012703','plus','D12 test','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+interval '20 days',null),
 ('10000000-0000-4000-8000-000000012706','plus','D12 test','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+interval '2 days',now()-interval '1 hour'),
 ('10000000-0000-4000-8000-000000012707','plus','D12 test','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+interval '14 days'-interval '1 minute',null),
 ('10000000-0000-4000-8000-000000012708','plus','D12 test','00000000-0000-4000-8000-000000012701',now()+interval '1 day',now()+interval '6 days',null);
insert into public.store_subscriptions(family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at,auto_renewing)
 values('10000000-0000-4000-8000-000000012704','00000000-0000-4000-8000-000000012706','apple','gina_plus_monthly','plus','d12-apple-key-1','active',now()+interval '5 days',false);
-- 25 sayfalama ailesi; bitişler ikişer ikişer aynı (eşit anahtar → id ile kesin sıra).
insert into public.families(id,name,created_by,timezone,locale,created_at)
select ('10000000-0000-4000-8000-0000001271'||lpad(g::text,2,'0'))::uuid,'D12 Sayfa '||g,'00000000-0000-4000-8000-000000012706','Europe/Istanbul','tr',now()-interval '30 days'+g*interval '1 hour'
from generate_series(1,25) g;
insert into public.entitlement_overrides(family_id,plan,reason,granted_by,starts_at,ends_at)
select ('10000000-0000-4000-8000-0000001271'||lpad(g::text,2,'0'))::uuid,'plus','D12 sayfa','00000000-0000-4000-8000-000000012701',now()-interval '1 day',now()+(g/2+1)*interval '10 hours'
from generate_series(1,25) g;

create function pg_temp.actor(id text, admin boolean default false, family text default null) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id',family,'role',case when family is null then null else 'parent' end,'admin',admin))::text,true)::void$$;
create function pg_temp.ids(j jsonb) returns uuid[] language sql as $$ select coalesce(array_agg((x->>'id')::uuid order by o),'{}') from jsonb_array_elements(j->'rows') with ordinality t(x,o) $$;
-- Bütün sayfaları cursor ile yürüyüp kimlikleri sırayla toplar; sayfa sayısını da döndürür.
create function pg_temp.walk(p_query text,p_limit int,p_days int,p_sort text) returns table(ids uuid[],pages int,dup boolean) language plpgsql as $$
declare cur text:=null; j jsonb; acc uuid[]:='{}'; n int:=0; begin
 loop
  j:=public.admin_families_search(p_query,cur,p_limit,p_days,p_sort); n:=n+1;
  acc:=acc||pg_temp.ids(j);
  if (j->>'has_more')::boolean is distinct from (j->>'next_cursor' is not null) then raise exception 'cursor_mismatch'; end if;
  exit when not (j->>'has_more')::boolean;
  cur:=j->>'next_cursor';
  if n>100 then raise exception 'runaway'; end if;
 end loop;
 return query select acc,n,(select count(*)<>count(distinct v) from unnest(acc) v);
end$$;

-- Beklenen kümeler (doğrudan tablolardan, RPC'den bağımsız) ---------------------------------
create temp table expected_expiring as
 select f.id,e.expires_at from public.families f cross join lateral gina.effective_entitlement(f.id) e
 where e.expires_at>now() and e.expires_at<=now()+interval '14 days';

-- 1. Şema ve yetki hijyeni ------------------------------------------------------------------
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_families_search'),1,'single admin_families_search signature (no ambiguous overload)');
select ok(position('roles && array[''admin'',''support'',''finance'']' in pg_get_functiondef('public.admin_families_search(text,text,int,int,text)'::regprocedure))>0,'families search keeps the C07 role gate (admin/support/finance)');
select ok(position('gina.assert_admin()' in pg_get_functiondef('public.admin_families_search(text,text,int,int,text)'::regprocedure))=0,'families search not pulled back to assert_admin');
select ok(position('gina.assert_admin()' in pg_get_functiondef('public.admin_audit_actors(uuid[])'::regprocedure))>0,'audit actors gated by full admin (assert_admin)');
select ok(not has_function_privilege('anon','public.admin_families_search(text,text,int,int,text)','execute'),'anon cannot execute families search');
select ok(not has_function_privilege('anon','public.admin_audit_actors(uuid[])','execute'),'anon cannot execute audit actors');
select ok(has_function_privilege('authenticated','public.admin_audit_actors(uuid[])','execute') and has_function_privilege('service_role','public.admin_audit_actors(uuid[])','execute'),'authenticated/service_role granted (DB gate decides)');
select ok(has_function_privilege('authenticated','public.admin_families_search(text,text,int,int,text)','execute'),'authenticated can call families search');
select is((select count(*)::int from information_schema.routine_privileges where routine_schema='public' and routine_name in('admin_families_search','admin_audit_actors') and grantee='PUBLIC'),0,'no PUBLIC execute');

-- 2. Eski çağrı biçimi (build-29 backoffice) aynen çalışır ---------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000012701',true);
select is(jsonb_array_length(public.admin_families_search(null,null,200)->'rows'),33,'positional 3-arg call lists every family');
select is(public.admin_families_search(null,null,200)->>'sort','newest','default sort is newest');
select is(public.admin_families_search(p_query=>null,p_cursor=>null,p_limit=>200)->'rows',public.admin_families_search(null,null,200,null,'newest')->'rows','named old-style call equals explicit newest');
select is(public.admin_families_search('D12 A')->'rows'->0->>'name','D12 A ailesi','one-arg call still works');
select ok((select bool_and(a.c>=b.c) from (select (x->>'created_at')::timestamptz c,o from jsonb_array_elements(public.admin_families_search(null,null,200)->'rows') with ordinality t(x,o)) a
  join (select (x->>'created_at')::timestamptz c,o from jsonb_array_elements(public.admin_families_search(null,null,200)->'rows') with ordinality t(x,o)) b on b.o=a.o+1),'newest order is created_at desc');
select ok((public.admin_families_search(null,null,5)->>'next_cursor') !~ '^expiring\|','newest cursor keeps the old <created_at>|<id> format');
select ok(not (public.admin_families_search(null,null,200,14,'expiring')->'rows'->0 ? 'sort_ts') and not (public.admin_families_search(null,null,200,14,'expiring')->'rows'->0 ? 'rn'),'internal sort columns are not returned');
select ok((select bool_and(not (x ? 'email')) from jsonb_array_elements(public.admin_families_search(null,null,200,14,'expiring')->'rows') x),'no email in rows');

-- 3. Süzgeç doğruluğu -------------------------------------------------------------------------
select is((select count(*)::int from expected_expiring),29,'fixture: 29 families end within 14 days');
select is(jsonb_array_length(public.admin_families_search(null,null,200,14,'newest')->'rows'),29,'filter returns exactly the 29');
select is((select array_agg(v order by v) from unnest(pg_temp.ids(public.admin_families_search(null,null,200,14,'expiring'))) v),
  (select array_agg(id order by id) from expected_expiring),'filter set matches effective entitlement end within 14 days');
select ok(not (pg_temp.ids(public.admin_families_search(null,null,200,14,'expiring')) && array[
  '10000000-0000-4000-8000-000000012703','10000000-0000-4000-8000-000000012705','10000000-0000-4000-8000-000000012706','10000000-0000-4000-8000-000000012708']::uuid[]),
  'excluded: +20 days, free, revoked comp, not-yet-started comp');
select ok(pg_temp.ids(public.admin_families_search(null,null,200,14,'expiring')) @> array[
  '10000000-0000-4000-8000-000000012701','10000000-0000-4000-8000-000000012702','10000000-0000-4000-8000-000000012704','10000000-0000-4000-8000-000000012707']::uuid[],
  'included: comp +3d, pro comp +10d, store +5d, boundary +14d-1min');
select is(jsonb_array_length(public.admin_families_search(null,null,200,3,'expiring')->'rows'),
  (select count(*)::int from expected_expiring where expires_at<=now()+interval '3 days'),'3-day window is a subset');
select is(jsonb_array_length(public.admin_families_search('D12 Sayfa',null,200,14,'expiring')->'rows'),25,'filter combines with text query');
select is(jsonb_array_length(public.admin_families_search('D12 C',null,200,14,'expiring')->'rows'),0,'query match outside window is filtered out');
select is(public.admin_families_search(null,null,200,14,'expiring')->>'expiring_within_days','14','echoes the window');

-- 4. Sıralama: bitişi en yakın önce, eşitlikte id, bitişsizler en sonda ------------------------
select is(pg_temp.ids(public.admin_families_search(null,null,200,14,'expiring')),
  (select array_agg(id order by expires_at,id) from expected_expiring),'expiring order: expires_at asc, id asc');
select is((select count(*)::int from (select expires_at from expected_expiring group by 1 having count(*)>1) t)>0,true,'fixture has tied expiries');
select is(public.admin_families_search(null,null,200,null,'expiring')->'rows'->32->>'plan_expires_at',null,'unfiltered expiring sort: families without an end come last');
select ok(public.admin_families_search(null,null,200,null,'expiring')->'rows'->0->>'plan_expires_at' is not null,'unfiltered expiring sort starts with an ending plan');

-- 5. Sayfalama (keyset) ---------------------------------------------------------------------
select is((select ids from pg_temp.walk(null,4,14,'expiring')),(select array_agg(id order by expires_at,id) from expected_expiring),'expiring pages (4) concatenate to the full ordered list');
select is((select pages from pg_temp.walk(null,4,14,'expiring')),8,'29 rows / 4 = 8 pages');
select is((select dup from pg_temp.walk(null,4,14,'expiring')),false,'no duplicates across expiring pages');
select is((select ids from pg_temp.walk(null,2,null,'expiring')),pg_temp.ids(public.admin_families_search(null,null,200,null,'expiring')),'unfiltered expiring paging (2) incl. infinity cursor equals one-shot list');
select is((select ids from pg_temp.walk(null,5,14,'newest')),pg_temp.ids(public.admin_families_search(null,null,200,14,'newest')),'newest+filter pages (5) equal one-shot list');
select is((select ids from pg_temp.walk(null,7,null,'newest')),pg_temp.ids(public.admin_families_search(null,null,200)),'old newest paging unchanged');
select ok((public.admin_families_search(null,null,4,14,'expiring')->>'next_cursor') ~ '^expiring\|','expiring cursor is tagged');
select throws_ok($$select public.admin_families_search(null,(public.admin_families_search(null,null,4,14,'expiring')->>'next_cursor'),4,14,'newest')$$,'22023','cursor_invalid','expiring cursor rejected under newest');
select throws_ok($$select public.admin_families_search(null,(public.admin_families_search(null,null,4)->>'next_cursor'),4,14,'expiring')$$,'22023','cursor_invalid','newest cursor rejected under expiring');
select throws_ok($$select public.admin_families_search(null,'expiring|x|y',4,14,'expiring')$$,'22023','cursor_invalid','garbage cursor rejected');
select throws_ok($$select public.admin_families_search(null,null,4,0,'expiring')$$,'22023','invalid_input','window 0 rejected');
select throws_ok($$select public.admin_families_search(null,null,4,91,'expiring')$$,'22023','invalid_input','window over 90 rejected');
select throws_ok($$select public.admin_families_search(null,null,4,14,'oldest')$$,'22023','invalid_input','unknown sort rejected');
select is(public.admin_families_search(null,null,4,14,null)->>'sort','newest','null sort falls back to newest');

-- 6. Roller: aile arama ---------------------------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000012702');
select is(jsonb_array_length(public.admin_families_search(null,null,200,14,'expiring')->'rows'),29,'support uses the filter');
select pg_temp.actor('00000000-0000-4000-8000-000000012704');
select is(jsonb_array_length(public.admin_families_search(null,null,200,14,'expiring')->'rows'),29,'finance uses the filter');
select pg_temp.actor('00000000-0000-4000-8000-000000012703');
select throws_ok($$select public.admin_families_search(null,null,10,14,'expiring')$$,'42501','forbidden','content operator denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012705');
select throws_ok($$select public.admin_families_search(null,null,10,14,'expiring')$$,'42501','forbidden','revoked operator denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012706',false,'10000000-0000-4000-8000-000000012701');
select throws_ok($$select public.admin_families_search(null,null,10,14,'expiring')$$,'42501','forbidden','parent denied');

-- 7. admin_audit_actors -------------------------------------------------------------------------
select pg_temp.actor('00000000-0000-4000-8000-000000012701',true);
create temp table actors as select * from public.admin_audit_actors(array[
 '00000000-0000-4000-8000-000000012701','00000000-0000-4000-8000-000000012707','00000000-0000-4000-8000-000000012702',
 '00000000-0000-4000-8000-000000012705','00000000-0000-4000-8000-000000012706','00000000-0000-4000-8000-0000000127ff',
 '00000000-0000-4000-8000-000000012707',null]::uuid[]);
select is((select count(*)::int from actors),6,'duplicates and nulls collapsed');
select is((select label from actors where id='00000000-0000-4000-8000-000000012707'),'d12-admin2@example.invalid','other admin resolved to email');
select is((select label from actors where id='00000000-0000-4000-8000-000000012701'),'d12-admin@example.invalid','self resolved');
select is((select label from actors where id='00000000-0000-4000-8000-000000012702'),'d12-support@example.invalid','operator resolved');
select is((select label from actors where id='00000000-0000-4000-8000-000000012705'),'d12-revoked-op@example.invalid','revoked operator still labelled in history');
select is((select label from actors where id='00000000-0000-4000-8000-000000012706'),null,'parent account not resolvable (no email oracle)');
select is((select label from actors where id='00000000-0000-4000-8000-0000000127ff'),null,'unknown id returns null label');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_name='actors' and table_schema like 'pg_temp%'),array['id','label'],'only id and label are returned');
select is((select count(*)::int from public.admin_audit_actors('{}'::uuid[])),0,'empty list returns nothing');
select throws_ok($$select * from public.admin_audit_actors(null)$$,'22023','invalid_input','null list rejected');
select throws_ok($$select * from public.admin_audit_actors((select array_agg(gen_random_uuid()) from generate_series(1,201)))$$,'22023','invalid_input','over 200 ids rejected');
select lives_ok($$select * from public.admin_audit_actors((select array_agg(gen_random_uuid()) from generate_series(1,200)))$$,'200 ids accepted');

select pg_temp.actor('00000000-0000-4000-8000-000000012702');
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','support operator denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012703');
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','content operator denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012704');
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','finance operator denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012706',false,'10000000-0000-4000-8000-000000012701');
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','parent denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012702',true);
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','forged admin claim without admins row denied');
select pg_temp.actor('00000000-0000-4000-8000-000000012701',false);
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','admins row without admin claim denied');
-- Açık oturumda yönetici kaldırılırsa aynı token reddedilir.
select pg_temp.actor('00000000-0000-4000-8000-000000012707',true);
delete from public.admins where user_id='00000000-0000-4000-8000-000000012707';
select throws_ok($$select * from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012701']::uuid[])$$,'42501','forbidden','removed admin denied with the same token');
select pg_temp.actor('00000000-0000-4000-8000-000000012701',true);
select is((select label from public.admin_audit_actors(array['00000000-0000-4000-8000-000000012707']::uuid[])),null,'former admin with no staff record is no longer resolvable');
-- anon rolü: çalıştırma yetkisi yok (PostgREST anon anahtarıyla çağrı 42501).
create function pg_temp.anon_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'allowed'; exception when insufficient_privilege then return 'denied'; end$$;
select pg_temp.actor('00000000-0000-4000-8000-000000012701',true);
set local role anon;
select set_config('d12.anon_actors',pg_temp.anon_try('select * from public.admin_audit_actors(array[''00000000-0000-4000-8000-000000012701'']::uuid[])'),true);
select set_config('d12.anon_families',pg_temp.anon_try('select public.admin_families_search(null,null,10,14,''expiring'')'),true);
reset role;
select is(current_setting('d12.anon_actors'),'denied','anon role call denied (audit actors)');
select is(current_setting('d12.anon_families'),'denied','anon role call denied (families search)');

select * from finish();
rollback;
