-- D10 (20261106400000_question_content_review_surface): D9/B6 kişi adı uyarısı üretim sonucunda veliye görünür.
-- Yalnız status + flags (provenance'ın geri kalanı yok); uyarısız soru öğesi eskisiyle aynı; tekrar aynı sonucu
-- döner; eski alanlar korunur; bozuk uyarı yok sayılır; çocuk cihazı soru satırını/uyarıyı okuyamaz; yeni yardımcılar
-- hiçbir role açık değildir.
begin;
select plan(25);
update public.plans set prova_monthly_exams=null where code='free';
update public.ai_operation_policies set per_minute=50 where action='generate';
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000012601','d10-parent@test.local'),
 ('00000000-0000-4000-8000-000000012603','d10-device@test.local');
insert into public.families(id,name,created_by) values ('10000000-0000-4000-8000-000000012601','D10','00000000-0000-4000-8000-000000012601');
insert into public.family_members(family_id,user_id) values ('10000000-0000-4000-8000-000000012601','00000000-0000-4000-8000-000000012601');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000012601','10000000-0000-4000-8000-000000012601','Cocuk',6);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000012601','10000000-0000-4000-8000-000000012601','00000000-0000-4000-8000-000000012603','20000000-0000-4000-8000-000000012601');
insert into public.learning_credit_grants(family_id,kind,amount,ends_at,reason) values('10000000-0000-4000-8000-000000012601','ai_questions',50,now()+interval '1 day','Synthetic test');

create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012601","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012601","role":"parent"}}',true)$$;
create function pg_temp.device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012603","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012601","role":"device","device_id":"30000000-0000-4000-8000-000000012601","child_id":"20000000-0000-4000-8000-000000012601"}}',true)$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
-- Edge `finishGeneration` satır biçimi; `review` verilirse D9 provenance etiketi.
create function pg_temp.row(stem text,review jsonb default null) returns jsonb language sql as $$
 select jsonb_build_object('grade',6,'subject','Türkçe','topic','Okuma','kind','open_ended','difficulty','orta','stem',stem,
  'expected_answer','Sentetik cevap','solution','Sentetik çözüm','source_urls','[]'::jsonb,
  'provenance',jsonb_build_object('generator','ai','prompt_version','prova-generate/v7-rubric-100','model','synthetic-model',
   'prompt',jsonb_build_object('system','GİZLİ-İSTEM','user','{}'::jsonb),'requested_by','00000000-0000-4000-8000-000000012601')
   || case when review is null then '{}'::jsonb else jsonb_build_object('content_review',review) end);
$$;
create function pg_temp.generate(job uuid,rows jsonb) returns jsonb language plpgsql as $$
declare n int:=jsonb_array_length(rows); ctx jsonb:=jsonb_build_object('schema','gina.generation-context.v1','promptHash',repeat('e',64),'total',n,'catalogueBound',false,'subject','Türkçe','grade',6);
begin
 perform public.reserve_prova_generation_v3(job,'10000000-0000-4000-8000-000000012601','00000000-0000-4000-8000-000000012601',repeat('e',64),n,jsonb_build_object('subject','Türkçe','grade',6,'count',n,'job',job),ctx);
 perform public.save_prova_provider_result(job,(select lease from public.prova_generation_jobs where id=job),'{"output":{"questions":[]}}');
 return public.complete_prova_generation_v2(job,(select lease from public.prova_generation_jobs where id=job),rows,'synthetic-model','prova-generate/v7-rubric-100',10,20);
end; $$;

-- 1) Yetki hijyeni ---------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon','gina.attach_question_content_review(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','gina.attach_question_content_review(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('service_role','gina.attach_question_content_review(uuid,jsonb)','EXECUTE'),'attach helper is not executable by any API role');
select ok(not has_function_privilege('anon','gina.question_content_review_summary(jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','gina.question_content_review_summary(jsonb)','EXECUTE'),'summary helper is not executable by API roles');
select ok(not has_function_privilege('anon','public.complete_prova_generation_v2(uuid,uuid,jsonb,text,text,integer,integer)','EXECUTE'),'complete_prova_generation_v2 stays closed to anon');

-- 2) Üretim sonucu ----------------------------------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select set_config('test.r1',pg_temp.generate('60000000-0000-4000-8000-000000012601',jsonb_build_array(
 pg_temp.row('Elif ile Ali parkta yürüyor. Kim daha hızlıdır?',
  '{"status":"needs_review","detector":"person-name/v1","flags":[{"code":"person_name","names":["Elif","Ali"],"fields":["stem"],"suggestion":"Kişi adı (Elif, Ali) yerine \"bir öğrenci\" gibi bir rol ifadesi kullanın.","extra":"x"}]}'),
 pg_temp.row('Bir öğrenci kitabını okuyor. Ana fikir nedir?'),
 pg_temp.row('Bozuk etiketli soru metni nedir?','{"status":"needs_review","flags":[{"code":"person_name","names":[]},{"code":"other","names":["X"]}]}')))::text,true);
reset role;
select is(jsonb_array_length(current_setting('test.r1')::jsonb->'questions'),3,'three questions are returned');
select is((select count(*)::int from jsonb_array_elements(current_setting('test.r1')::jsonb->'questions') q where q ? 'content_review'),1,'only the flagged question carries content_review');
select is(current_setting('test.r1')::jsonb->'questions'->0->'content_review',
 '{"status":"needs_review","flags":[{"code":"person_name","names":["Elif","Ali"],"fields":["stem"],"suggestion":"Kişi adı (Elif, Ali) yerine \"bir öğrenci\" gibi bir rol ifadesi kullanın."}]}'::jsonb,
 'summary is status + whitelisted flag fields (no detector, no unknown keys)');
select is((select array_agg(k order by k) from jsonb_object_keys(current_setting('test.r1')::jsonb->'questions'->1) k),
 array['choices','correct_key','difficulty','expected_answer','explanation','id','kind','solution','source_urls','stem','topic'],
 'unflagged question keeps exactly the legacy fields');
select is((select array_agg(k order by k) from jsonb_object_keys(current_setting('test.r1')::jsonb->'questions'->0) k),
 array['choices','content_review','correct_key','difficulty','expected_answer','explanation','id','kind','solution','source_urls','stem','topic'],
 'flagged question = legacy fields + content_review only');
select ok(not (current_setting('test.r1')::jsonb->'questions'->2 ? 'content_review'),'malformed / unknown flags are ignored, not surfaced');
select ok(position('GİZLİ-İSTEM' in current_setting('test.r1'))=0 and position('person-name/v1' in current_setting('test.r1'))=0
 and position('synthetic-model' in (current_setting('test.r1')::jsonb->'questions')::text)=0,'no other provenance (prompt, detector, model) leaks into questions');
select ok((current_setting('test.r1')::jsonb ?& array['ok','model','prompt_version','remaining','questions']),'legacy top-level fields are kept');
select is(current_setting('test.r1')::jsonb->'questions'->0->>'stem','Elif ile Ali parkta yürüyor. Kim daha hızlıdır?','question is saved, not rejected');
select is((select provenance#>>'{content_review,detector}' from public.question_bank where id=(current_setting('test.r1')::jsonb->'questions'->0->>'id')::uuid),
 'person-name/v1','full provenance stays in question_bank');
select is((select result from public.prova_generation_jobs where id='60000000-0000-4000-8000-000000012601'),current_setting('test.r1')::jsonb,'job stores the surfaced result');

-- 3) Tekrar (kayıp yanıt) aynı sonucu döner, ikinci ücret yok ----------------------------------------------------
select set_config('test.used',(select sum(consumed)::text from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id where j.family_id='10000000-0000-4000-8000-000000012601'),true);
set local role service_role; select pg_temp.service();
select is(public.complete_prova_generation_v2('60000000-0000-4000-8000-000000012601',(select lease from public.prova_generation_jobs where id='60000000-0000-4000-8000-000000012601'),'[]','x','y',0,0)::text,
 current_setting('test.r1'),'replay returns the same result including content_review');
reset role;
select is((select sum(consumed)::text from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id where j.family_id='10000000-0000-4000-8000-000000012601'),
 current_setting('test.used'),'replay consumes no extra credit');
select is((select count(*)::int from public.question_bank where family_id='10000000-0000-4000-8000-000000012601'),3,'replay inserts no rows');

-- 4) Uyarısız üretim: anahtar yazılmaz --------------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.generate('60000000-0000-4000-8000-000000012602',jsonb_build_array(
 pg_temp.row('Bir öğrenci deftere ne yazmıştır?'),pg_temp.row('Arkadaşı hangi kitabı seçmiştir?')))->'questions') q where q ? 'content_review'),
 'generation without flags returns no content_review key');
reset role;

-- 5) Yardımcı birim kontrolleri ---------------------------------------------------------------------------------
select is(gina.question_content_review_summary(null),null,'null provenance → null');
select is(gina.question_content_review_summary('{"content_review":{"status":"ok","flags":[{"code":"person_name","names":["Ali"]}]}}'),null,'other status → null');
select is(gina.question_content_review_summary('{"content_review":"needs_review"}'),null,'non-object → null');
select is(gina.question_content_review_summary('{"content_review":{"status":"needs_review","flags":[{"code":"person_name","names":["Ali",3," "],"fields":"stem","suggestion":7}]}}'),
 '{"status":"needs_review","flags":[{"code":"person_name","names":["Ali"],"fields":[],"suggestion":""}]}'::jsonb,'non-string names/fields/suggestion are dropped defensively');

-- 6) Veli soruyu (uyarı dahil) okur; çocuk cihazı okuyamaz ------------------------------------------------------
set local role authenticated; select pg_temp.parent();
select is((select provenance#>>'{content_review,flags,0,names,0}' from public.question_bank where id=(current_setting('test.r1')::jsonb->'questions'->0->>'id')::uuid),
 'Elif','parent reads the flag via family RLS (draft/library screens)');
set local role authenticated; select pg_temp.device();
select is((select count(*)::int from public.question_bank),0,'child device cannot read question rows or their content_review');
reset role;
select is((select count(*)::int from public.prova_generation_jobs j where j.family_id='10000000-0000-4000-8000-000000012601' and j.status='done'),2,'both jobs completed');

select * from finish();
rollback;
