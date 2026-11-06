-- D6 (20261106380000_ai_quality_fixes): bozuk model çıktısı/ret/kesilme ortak devre kesiciyi beslemez (iş yine
-- belirsiz kalır, otomatik tekrar yok); 429/5xx/sonucu bilinmeyen çağrı eskisi gibi sayar. B4: 10 MiB üstü PDF
-- rezervasyonda `source_file_too_large` (validation) ile reddedilir; görsel sınırı ve yetkiler değişmez.
begin;
select plan(31);

insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000012401','d6-parent@test.local');
insert into public.families(id,name,created_by) values ('10000000-0000-4000-8000-000000012401','D6','00000000-0000-4000-8000-000000012401');
insert into public.family_members(family_id,user_id) values ('10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401');
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values ('10000000-0000-4000-8000-000000012401','pro','test',now()+interval '1 day');

create function pg_temp.health(p text) returns int language sql as $$ select failures from public.ai_provider_health where provider=p $$;
create function pg_temp.paused(p text) returns boolean language sql as $$ select open_until is not null and open_until>now() from public.ai_provider_health where provider=p $$;
-- Çalışan bir AI işi (sağlayıcı anthropic) açar; kimliği = lease.
create function pg_temp.job(n int) returns uuid language sql as $$
 insert into public.ai_operation_jobs(id,family_id,requested_by,action,input_hash,lease,status,provider)
 values(('00000000-0000-4000-8000-0000000124'||lpad(n::text,2,'0'))::uuid,'10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401',
  'grade',encode(extensions.digest('d6-'||n,'sha256'),'hex'),('00000000-0000-4000-8000-0000000124'||lpad(n::text,2,'0'))::uuid,'working','anthropic')
 returning id $$;
create function pg_temp.finish(n int, code text, uncertain boolean) returns void language sql as $$
 select public.finish_ai_operation(pg_temp.job(n), ('00000000-0000-4000-8000-0000000124'||lpad(n::text,2,'0'))::uuid, null, code, uncertain) $$;
grant execute on function pg_temp.job(int), pg_temp.finish(int,text,boolean) to service_role;
update public.ai_provider_health set failures=0, open_until=null;

-- 1. Sınıflandırma --------------------------------------------------------------------------------------------
select results_eq($$select gina.ai_content_outcome(x) from unnest(array['ai_result_invalid','ai_result_invalid_evidence','ai_result_invalid_topic',
  'anthropic_refusal','openai_length','gemini_max_tokens','anthropic_max_tokens','anthropic_529','openai_429','provider_outcome_unknown','ai_result_invalidX',null]) x$$,
 $$values (true),(true),(true),(true),(true),(true),(true),(false),(false),(false),(false),(false)$$,
 'yalnız model çıktısı/ret/kesilme kodları içerik sonucu sayılır');
select is(gina.ai_breaker_code('ai_result_invalid_evidence'),false,'kesici kodu değişmedi: bozuk çıktı 429/5xx değildir');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

-- 2. Bozuk çıktı tüm aileleri durdurmaz ----------------------------------------------------------------------
select lives_ok($$select pg_temp.finish(1,'ai_result_invalid_evidence',true)$$,'bozuk çıktı işi kapanır');
select is((select status from public.ai_operation_jobs where id='00000000-0000-4000-8000-000000012401'),'uncertain','iş belirsiz kalır (ücret olmuş olabilir, otomatik tekrar yok)');
select is((select error_code from public.ai_operation_jobs where id='00000000-0000-4000-8000-000000012401'),'ai_result_invalid_evidence','tanı için kural adı saklanır');
select is(pg_temp.health('anthropic'),0,'bozuk çıktı ortak sayacı artırmaz');
select lives_ok($$select pg_temp.finish(2,'ai_result_invalid_topic',true); select pg_temp.finish(3,'ai_result_invalid',true); select pg_temp.finish(4,'anthropic_refusal',true); select pg_temp.finish(5,'anthropic_max_tokens',true)$$,
 'art arda dört içerik sonucu');
select is(pg_temp.health('anthropic'),0,'beş içerik sonucundan sonra sayaç 0');
select ok(not coalesce(pg_temp.paused('anthropic'),false),'Anthropic duraklatılmadı');
select ok(public.reserve_ai_operation('10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401','grade',encode(extensions.digest('d6-next','sha256'),'hex'),gen_random_uuid()) ? 'id',
 'bozuk çıktılardan sonra yeni iş açılabilir (aile/diğer aileler bloklanmaz)');
reset role;
delete from public.ai_request_attempts where family_id='10000000-0000-4000-8000-000000012401';
delete from public.ai_operation_jobs where input_hash=encode(extensions.digest('d6-next','sha256'),'hex');
set local role service_role;
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401','grade',encode(extensions.digest('d6-1','sha256'),'hex'),gen_random_uuid())->>'error',
 'ai_result_uncertain','aynı girdi (belirsiz iş) ikinci ücretli çağrı açmaz');

-- 3. Sağlayıcı arızası eskisi gibi sayar ---------------------------------------------------------------------
select lives_ok($$select pg_temp.finish(6,'anthropic_529',true)$$,'5xx');
select is(pg_temp.health('anthropic'),1,'5xx sayacı artırır');
select lives_ok($$select pg_temp.finish(7,'provider_outcome_unknown',true)$$,'zaman aşımı/ağ kaybı');
select is(pg_temp.health('anthropic'),2,'sonucu bilinmeyen çağrı sayar');
select lives_ok($$select pg_temp.finish(8,'ai_result_invalid_steps',true)$$,'araya bozuk çıktı');
select is(pg_temp.health('anthropic'),2,'bozuk çıktı sayacı ne artırır ne sıfırlar');
select lives_ok($$select pg_temp.finish(9,'anthropic_429',false)$$,'429');
select is(pg_temp.health('anthropic'),3,'429 sayar');
select ok(pg_temp.paused('anthropic'),'3 sağlayıcı arızasında duraklama eskisi gibi');
reset role;
update public.ai_provider_health set failures=0, open_until=null where provider='anthropic';
set local role service_role;

-- 4. Prova üretimi yolu aynı tek kaynaktan geçer ------------------------------------------------------------
reset role;
insert into public.prova_generation_jobs(id,family_id,requested_by,prompt_hash,items,status,lease,provider) values
 ('00000000-0000-4000-8000-000000012451','10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401',repeat('a',64),3,'working','00000000-0000-4000-8000-000000012452','anthropic'),
 ('00000000-0000-4000-8000-000000012453','10000000-0000-4000-8000-000000012401','00000000-0000-4000-8000-000000012401',repeat('b',64),3,'working','00000000-0000-4000-8000-000000012454','anthropic');
set local role service_role;
select lives_ok($$select public.fail_prova_generation_v2('00000000-0000-4000-8000-000000012451','00000000-0000-4000-8000-000000012452','ai_result_invalid',true)$$,'üretimde bozuk çıktı');
select is((select status from public.prova_generation_jobs where id='00000000-0000-4000-8000-000000012451'),'uncertain','üretim işi belirsiz');
select is(pg_temp.health('anthropic'),0,'üretimdeki bozuk çıktı da sayacı artırmaz');
select lives_ok($$select public.fail_prova_generation_v2('00000000-0000-4000-8000-000000012453','00000000-0000-4000-8000-000000012454','anthropic_503',true)$$,'üretimde 503');
select is(pg_temp.health('anthropic'),1,'üretimdeki 503 sayar');
reset role;

-- 5. B4: büyük PDF adıyla reddedilir --------------------------------------------------------------------------
update public.app_settings set value='true' where key='sources.enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012401","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012401","role":"parent"}}',true);
select throws_ok($$select public.reserve_learning_source(gen_random_uuid(),'document','d6.pdf','application/pdf',11*1024*1024,repeat('c',64),true)$$,
 'P0001','source_file_too_large','11 MiB PDF: source_file_too_large (önceden tablo CHECK → source_failed)');
select throws_ok($$select public.reserve_learning_source(gen_random_uuid(),'document','d6.pdf','application/pdf',25*1024*1024,repeat('c',64),true)$$,
 'P0001','source_file_too_large','25 MiB PDF');
select lives_ok($$select public.reserve_learning_source('40000000-0000-4000-8000-000000012401','document','d6.pdf','application/pdf',10485760,repeat('d',64),true)$$,
 'tam 10 MiB PDF kabul (tablo sınırıyla aynı)');
select throws_ok($$select public.reserve_learning_source(gen_random_uuid(),'question_image','d6.png','image/png',5*1024*1024,repeat('e',64),true)$$,
 'P0001','source_size_or_type','görsel 4 MiB sınırı eski koduyla');
reset role;
select ok(not has_function_privilege('anon','public.reserve_learning_source(uuid,text,text,text,int,text,boolean)','execute')
 and has_function_privilege('authenticated','public.reserve_learning_source(uuid,text,text,text,int,text,boolean)','execute'),'rezervasyon yetkileri değişmedi');
select ok(not has_function_privilege('authenticated','gina.ai_provider_outcome(text,boolean,text,boolean)','execute')
 and has_function_privilege('service_role','gina.ai_provider_outcome(text,boolean,text,boolean)','execute'),'istemci sağlık kaydı yazamaz');

select * from finish();
rollback;
