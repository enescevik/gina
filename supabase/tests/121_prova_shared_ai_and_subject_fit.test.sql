-- D1: AI ortak kaynağı gerçek ortak kaynak grubu olur (bölünmez, iki soru ayrı sayılır, atanmış sürüm donuk);
-- soru düzeyinde dönem/program izi + gönderimde uyuşmazlık/kabul; Prova ders metni → veli onaylı katalog kimliği;
-- C05 soru-kazanım uygunluğu veli inceleme listesi (AI önerisi karar değildir).
begin;
select no_plan();
update public.plans set prova_monthly_exams=null where code='free';
update public.app_settings set value='true' where key='question_groups.enabled';
update public.ai_operation_policies set per_minute=50 where action='generate';
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000012101','d1-parent@test.local'),
 ('00000000-0000-4000-8000-000000012102','d1-other@test.local'),
 ('00000000-0000-4000-8000-000000012103','d1-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000012101','D1 A','00000000-0000-4000-8000-000000012101'),
 ('10000000-0000-4000-8000-000000012102','D1 B','00000000-0000-4000-8000-000000012102');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000012101','00000000-0000-4000-8000-000000012101'),
 ('10000000-0000-4000-8000-000000012102','00000000-0000-4000-8000-000000012102');
insert into public.children(id,family_id,name,grade) values
 ('20000000-0000-4000-8000-000000012101','10000000-0000-4000-8000-000000012101','Cocuk',6),
 ('20000000-0000-4000-8000-000000012102','10000000-0000-4000-8000-000000012102','Diger',6);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000012101','10000000-0000-4000-8000-000000012101','00000000-0000-4000-8000-000000012103','20000000-0000-4000-8000-000000012101');
insert into gina.child_education_periods(id,child_id,family_id,academic_year,grade,school,starts_on,reason) values
 ('80000000-0000-4000-8000-000000012101','20000000-0000-4000-8000-000000012101','10000000-0000-4000-8000-000000012101',2026,6,'Sentetik Ortaokulu',date '2026-09-01','initial');
insert into public.learning_credit_grants(family_id,kind,amount,ends_at,reason) values('10000000-0000-4000-8000-000000012101','ai_questions',50,now()+interval '1 day','Synthetic test');

create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012101","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012101","role":"parent"}}',true)$$;
create function pg_temp.other() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012102","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012102","role":"parent"}}',true)$$;
create function pg_temp.device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012103","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012101","role":"device","device_id":"30000000-0000-4000-8000-000000012101","child_id":"20000000-0000-4000-8000-000000012101"}}',true)$$;
create function pg_temp.service() returns void language sql as $$select set_config('request.jwt.claims','{"role":"service_role"}',true)$$;
create function pg_temp.ctx(term int default 1,program text default 'Maarif') returns jsonb language sql as $$
 select jsonb_build_object('scope','subject','track','free','term',term,'program',program,'academicYear',2026,'periodId','80000000-0000-4000-8000-000000012101','school','Sentetik Ortaokulu','schoolDeclared',false);
$$;
create function pg_temp.content(blocks jsonb,target int,ctx jsonb default pg_temp.ctx(),extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('childId','20000000-0000-4000-8000-000000012101','grade',6,'title','Fen çalışması','purpose','practice','format','school',
  'subjects','["Fen Bilimleri"]'::jsonb,'topics','[]'::jsonb,'target',target,'minutes',null,'difficulty','orta','kind','mixed','note','','step',3,'blocks',blocks)
  || case when ctx is null then '{}'::jsonb else jsonb_build_object('context',ctx) end || extra;
$$;
-- Edge `finishGeneration` satır biçimi (v6): bağlı soru gövdesi başlık + ortak metin + soru; provenance shared_prompt.
create function pg_temp.row(prompt text,shared boolean,draft uuid,body text default 'Bir bahçede bitkilerin boyu iki hafta boyunca ölçülüyor ve tabloya yazılıyor.') returns jsonb language sql as $$
 select jsonb_build_object('grade',6,'subject','Fen Bilimleri','topic','Bitkiler','kind','open_ended','difficulty','orta',
  'stem',case when shared then 'Ortak metin'||E'\n'||body||E'\n\n'||prompt else prompt end,
  'expected_answer','Sentetik cevap','solution','Sentetik çözüm','source_urls','[]'::jsonb,
  'provenance',jsonb_build_object('generator','ai','draft_id',draft,'prompt_version','prova-generate/v6-shared-groups')
   || case when shared then jsonb_build_object('shared_source_id','S1','shared_source',jsonb_build_object('id','S1','kind','text','content',body),
       'shared_source_title','Ortak metin','shared_prompt',prompt) else '{}'::jsonb end);
$$;
create function pg_temp.generate(job uuid,rows jsonb) returns jsonb language plpgsql as $$
declare n int:=jsonb_array_length(rows); ctx jsonb:=jsonb_build_object('schema','gina.generation-context.v1','promptHash',repeat('d',64),'total',n,'catalogueBound',false,'subject','Fen Bilimleri','grade',6);
begin
 perform public.reserve_prova_generation_v3(job,'10000000-0000-4000-8000-000000012101','00000000-0000-4000-8000-000000012101',repeat('d',64),n,jsonb_build_object('subject','Fen Bilimleri','grade',6,'count',n,'job',job),ctx);
 perform public.save_prova_provider_result(job,(select lease from public.prova_generation_jobs where id=job),'{"output":{"questions":[]}}');
 return public.complete_prova_generation_v2(job,(select lease from public.prova_generation_jobs where id=job),rows,'synthetic-model','prova-generate/v6-shared-groups',10,20);
end; $$;

-- Taslak (dönem 1, program Maarif) üretimden önce var olur; AI satırları bu taslağa bağlı.
set local role authenticated; select pg_temp.parent();
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012101',0,pg_temp.content('[]',3))$$,'draft with term 1 / Maarif saved');

-- 1) AI ortak kaynak → ortak kaynak grubu ------------------------------------------------------------------
set local role service_role; select pg_temp.service();
select set_config('test.r1',pg_temp.generate('60000000-0000-4000-8000-000000012101',jsonb_build_array(
 pg_temp.row('Hangi bitki daha hızlı uzamıştır? Gerekçesini yaz.',true,'50000000-0000-4000-8000-000000012101'),
 pg_temp.row('Ölçümler arasındaki farkın nedeni ne olabilir?',true,'50000000-0000-4000-8000-000000012101'),
 pg_temp.row('Fotosentez için gereken iki şeyi yaz.',false,'50000000-0000-4000-8000-000000012101')))::text,true);
select is(jsonb_array_length(current_setting('test.r1')::jsonb->'groups'),1,'one shared passage becomes one group');
select is(jsonb_array_length(current_setting('test.r1')::jsonb->'groups'->0->'question_ids'),2,'group holds the two linked questions');
select is(jsonb_array_length(current_setting('test.r1')::jsonb->'questions'),3,'three questions are returned and counted separately');
select is((select count(*)::int from jsonb_array_elements(current_setting('test.r1')::jsonb->'questions') q where q ? 'group_id'),2,'only linked questions carry group_id');
select is((select q->>'prompt' from jsonb_array_elements(current_setting('test.r1')::jsonb->'questions') q where (q->>'position')::int=1),
 'Hangi bitki daha hızlı uzamıştır? Gerekçesini yaz.','result carries the member prompt without the passage');
select set_config('test.g1',current_setting('test.r1')::jsonb->'groups'->0->>'id',true);
select set_config('test.m1',current_setting('test.r1')::jsonb->'groups'->0->'question_ids'->>0,true);
select set_config('test.m2',current_setting('test.r1')::jsonb->'groups'->0->'question_ids'->>1,true);
select set_config('test.s1',(select q->>'id' from jsonb_array_elements(current_setting('test.r1')::jsonb->'questions') q where not q ? 'group_id'),true);
reset role;
select results_eq($$select title,body,version,series_id=id,finalized_at is not null,subject,grade::int from public.question_source_groups where id=current_setting('test.g1')::uuid$$,
 $$values ('Ortak metin','Bir bahçede bitkilerin boyu iki hafta boyunca ölçülüyor ve tabloya yazılıyor.',1,true,true,'Fen Bilimleri',6)$$,'group is a finalized version-1 series with the passage once');
select results_eq($$select position,question_id::text from public.question_source_members where group_id=current_setting('test.g1')::uuid order by position$$,
 $$values (1,current_setting('test.m1')),(2,current_setting('test.m2'))$$,'members keep generation order');
select ok(not exists(select 1 from public.question_source_members where question_id=current_setting('test.s1')::uuid),'standalone AI question is not grouped');
select is((select count(*)::int from gina.question_period_tags where question_id in(current_setting('test.m1')::uuid,current_setting('test.m2')::uuid,current_setting('test.s1')::uuid) and term=1 and program='Maarif' and source='draft'),3,
 'AI questions carry the draft term/program at question level');
select throws_ok($$update public.question_bank set stem=stem||' değişti' where id=current_setting('test.m1')::uuid$$,'P0001','question_group_immutable','group member content is immutable');
select throws_ok($$delete from public.question_source_members where question_id=current_setting('test.m2')::uuid$$,'P0001','question_group_immutable','group cannot lose a member');
set local role service_role; select pg_temp.service();
select is(public.complete_prova_generation_v2('60000000-0000-4000-8000-000000012101',(select lease from public.prova_generation_jobs where id='60000000-0000-4000-8000-000000012101'),'[]','x','y',0,0)::text,
 current_setting('test.r1'),'lost reply replays the same grouped result');
reset role;
select is((select count(*)::int from public.question_source_groups where family_id='10000000-0000-4000-8000-000000012101'),1,'replay creates no second group');

set local role authenticated; select pg_temp.parent();
select is(jsonb_array_length(public.get_question_context(array[current_setting('test.m1')::uuid,current_setting('test.m2')::uuid])),2,'both members resolve the shared context');
select is((select count(distinct x->>'body')::int from jsonb_array_elements(public.get_question_context(array[current_setting('test.m1')::uuid,current_setting('test.m2')::uuid])) x),1,'one passage identity for both');
-- Bölünmez: grubun bir üyesi tek soru olarak taslağa eklenemez.
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012102',0,pg_temp.content(jsonb_build_array(jsonb_build_object('kind','question','id',current_setting('test.m1'),'source','ai')),1))$$,
 'P0001','prova_source_unavailable','a group member cannot be split into a single-question block');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012101',1,pg_temp.content(jsonb_build_array(
 jsonb_build_object('kind','group','id',current_setting('test.g1'),'source','ai'),jsonb_build_object('kind','question','id',current_setting('test.s1'),'source','ai')),3))$$,'AI group + AI question saved as two blocks');
select lives_ok($$select public.submit_prova_draft('61000000-0000-4000-8000-000000012101','50000000-0000-4000-8000-000000012101',2)$$,'draft with AI group submits');
select is((select question_ids::text[] from public.exams where id='50000000-0000-4000-8000-000000012101'),
 array[current_setting('test.m1'),current_setting('test.m2'),current_setting('test.s1')],'exam lists the two members (in order) and the standalone question separately');
select is((select subject_links from public.exams where id='50000000-0000-4000-8000-000000012101'),'[{"title":"Fen Bilimleri","subject_id":null}]'::jsonb,'unlinked subject text is kept with a null catalogue id');
-- Atanmış sürüm donuk: grup yeni sürümü sınavı değiştirmez.
select lives_ok($$select public.save_question_source_group('62000000-0000-4000-8000-000000012101','{"title":"Ortak metin","body":"Bir bahçede bitkilerin boyu üç hafta boyunca ölçülüyor ve tabloya yazılıyor.","grade":6,"subject":"Fen Bilimleri"}',
 '[{"topic":"Bitkiler","kind":"open_ended","difficulty":"orta","stem":"Yeni birinci soru metni","expected_answer":"x","solution":"y"},{"topic":"Bitkiler","kind":"open_ended","difficulty":"orta","stem":"Yeni ikinci soru metni","expected_answer":"x","solution":"y"}]','[]',current_setting('test.g1')::uuid)$$,
 'parent saves a new version of the AI group');
select is((select question_ids::text[] from public.exams where id='50000000-0000-4000-8000-000000012101'),
 array[current_setting('test.m1'),current_setting('test.m2'),current_setting('test.s1')],'assigned exam keeps the original group version');
select is((select version from public.question_source_groups where id='62000000-0000-4000-8000-000000012101'),2,'new version is a separate row in the same series');
-- Cihaz: atanmış soruların ortak metni okunur, cevap anahtarı/üretim izi okunmaz.
set local role authenticated; select pg_temp.device();
select is(jsonb_array_length(public.get_question_context(array[current_setting('test.m1')::uuid,current_setting('test.m2')::uuid])),2,'child device reads the shared passage of assigned members');
select is((select count(*)::int from public.question_bank),0,'child device cannot read question rows (answer key, provenance)');
select is((select count(*)::int from public.question_source_groups),0,'child device cannot list groups directly');

-- 2) Grup kurulamayan durumlar: gövde yine kendi başına okunur ----------------------------------------------
set local role service_role; select pg_temp.service();
select ok(not (pg_temp.generate('60000000-0000-4000-8000-000000012102',jsonb_build_array(
 pg_temp.row('Tek bağlı soru: tablodaki en kısa bitki hangisi?',true,null),
 pg_temp.row('Bağımsız soru: kök ne işe yarar?',false,null))) ? 'groups'),'a single linked question does not form a group');
reset role;
select ok((select stem like 'Ortak metin'||E'\n'||'Bir bahçede%' from public.question_bank where provenance->>'shared_prompt'='Tek bağlı soru: tablodaki en kısa bitki hangisi?'),'ungrouped linked question still carries the passage in its own stem');
select is((select count(*)::int from gina.question_period_tags t join public.question_bank q on q.id=t.question_id where q.provenance->>'shared_prompt' like 'Tek bağlı%'),0,'no draft → no invented term');
update public.app_settings set value='false' where key='question_groups.enabled';
set local role service_role; select pg_temp.service();
select ok(not (pg_temp.generate('60000000-0000-4000-8000-000000012103',jsonb_build_array(
 pg_temp.row('Kapalı bayrak birinci soru metni?',true,null),pg_temp.row('Kapalı bayrak ikinci soru metni?',true,null))) ? 'groups'),'groups flag off: no group is created');
reset role;
select is((select count(*)::int from public.question_bank where provenance->>'shared_prompt' like 'Kapalı bayrak%' and stem like 'Ortak metin'||E'\n'||'%'),2,'flag off: both questions stay self-contained');
update public.app_settings set value='true' where key='question_groups.enabled';
set local role service_role; select pg_temp.service();
select ok(not (pg_temp.generate('60000000-0000-4000-8000-000000012104',jsonb_build_array(
 pg_temp.row('Uyumsuz biçim birinci soru?',true,null)||'{"stem":"Ortak metin olmadan yazılmış gövde"}',pg_temp.row('Uyumsuz biçim ikinci soru?',true,null))) ? 'groups'),'a member whose stem does not match the passage contract is not grouped');
reset role;

-- 3) Soru düzeyinde dönem/program -------------------------------------------------------------------------
set local role authenticated; select pg_temp.parent();
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000012101','{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"İkinci dönem sorusu: sürtünme","expected_answer":"x","solution":"y","term":2,"program":"Maarif"}')$$,'manual question with term 2 saved');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"Geçersiz dönem sorusu","expected_answer":"x","solution":"y","term":3}')$$,'P0001','question_period_invalid','term 3 rejected');
select throws_ok($$select public.save_question_with_sources(gen_random_uuid(),'{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"Geçersiz program sorusu","expected_answer":"x","solution":"y","program":"  "}')$$,'P0001','question_period_invalid','blank program rejected');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000012102','{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"Eski programdan bir soru","expected_answer":"x","solution":"y","program":"Eski program"}')$$,'manual question with another program saved');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000012103','{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"Dönemi belirtilmemiş soru","expected_answer":"x","solution":"y"}')$$,'manual question without period saved');
select lives_ok($$select public.save_question_with_sources('40000000-0000-4000-8000-000000012104','{"grade":6,"subject":"Fen Bilimleri","topic":"Kuvvet","kind":"open_ended","difficulty":"orta","stem":"Aynı program farklı yazım","expected_answer":"x","solution":"y","term":1,"program":"MAARİF"}')$$,'manual question with same program different spelling saved');
reset role;
select results_eq($$select question_id::text,term::int,program,source from gina.question_period_tags where question_id::text like '40000000-0000-4000-8000-0000000121%' order by question_id$$,
 $$values ('40000000-0000-4000-8000-000000012101',2,'Maarif','parent'),('40000000-0000-4000-8000-000000012102',null,'Eski program','parent'),('40000000-0000-4000-8000-000000012104',1,'MAARİF','parent')$$,'question-level tags; untagged question has no row');
select throws_ok($$update gina.question_period_tags set term=1 where question_id='40000000-0000-4000-8000-000000012101'$$,'P0001','question_period_immutable','period tag cannot be rewritten');
set local role authenticated; select pg_temp.parent();
select set_config('test.b4',jsonb_build_array(
 jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012101','source','manual'),
 jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012102','source','manual'),
 jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012103','source','manual'),
 jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012104','source','manual'))::text,true);
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',0,pg_temp.content(current_setting('test.b4')::jsonb,4))$$,'mismatching questions can be saved (marked, not deleted)');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',1)$$,'P0001','prova_question_period_mismatch','term 2 / other program question stops submission');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',1,pg_temp.content(current_setting('test.b4')::jsonb,4,extra=>'{"fitAccepted":["40000000-0000-4000-8000-000000012101"]}'))$$,'parent accepts the term mismatch only');
select throws_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',2)$$,'P0001','prova_question_period_mismatch','accepting only the term mismatch still stops the program mismatch');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',2,pg_temp.content(current_setting('test.b4')::jsonb,4,extra=>'{"fitAccepted":"x"}'))$$,'P0001','invalid_input','fitAccepted must be an id list');
select throws_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',2,pg_temp.content(current_setting('test.b4')::jsonb,4,extra=>'{"fitAccepted":["40000000-0000-4000-8000-000000012101","40000000-0000-4000-8000-000000012101"]}'))$$,'P0001','invalid_input','duplicate accepted ids rejected');
-- Düzeltme yolu 1: velinin açık kabulü.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',2,pg_temp.content(current_setting('test.b4')::jsonb,4,extra=>'{"fitAccepted":["40000000-0000-4000-8000-000000012101","40000000-0000-4000-8000-000000012102"]}'))$$,'parent accepts both mismatches explicitly');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012103',3)$$,'accepted mismatches submit');
select is((select preparation->'fitAccepted' from public.exams where id='50000000-0000-4000-8000-000000012103'),'["40000000-0000-4000-8000-000000012101","40000000-0000-4000-8000-000000012102"]'::jsonb,'acceptance is frozen with the exam preparation');
-- Düzeltme yolu 2: taslağın dönemini değiştirmek (2. dönem, program yok) → term-1 sorusu bu kez işaretlenir.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012104',0,pg_temp.content(jsonb_build_array(
 jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012101','source','manual'),jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012103','source','manual')),2,pg_temp.ctx(2,null)))$$,'draft corrected to term 2');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012104',1)$$,'term-2 question fits a term-2 draft; untagged question never blocks');
-- Bağlamsız (eski) taslak dönem kontrolü yapmaz.
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012105',0,pg_temp.content(jsonb_build_array(jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012102','source','manual')),1,null))$$,'legacy draft without context saved');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012105',1)$$,'legacy draft is not blocked by question tags');

-- 4) Ders metni → veli onaylı katalog kimliği (C02 bağı) --------------------------------------------------
select is((public.get_prova_question_fit('20000000-0000-4000-8000-000000012101',array['40000000-0000-4000-8000-000000012101'::uuid])->'questions'->0->>'subject_id'),null,'no link → no canonical id (suggestion never links)');
select is((public.get_prova_question_fit('20000000-0000-4000-8000-000000012101',array['40000000-0000-4000-8000-000000012101'::uuid])->'questions'->0->>'term')::int,2,'fit read returns the question-level term');
select is(jsonb_array_length(public.get_prova_question_fit('20000000-0000-4000-8000-000000012101','{}')->'questions'),0,'empty question list is allowed (subject card before questions)');
select lives_ok($$select public.set_child_subject_links('63000000-0000-4000-8000-000000012101','20000000-0000-4000-8000-000000012101','[{"title":"Fen Bilimleri","subject_id":"subject-science","expected":null}]')$$,'parent confirms Fen Bilimleri → catalogue science');
select is((public.get_prova_question_fit('20000000-0000-4000-8000-000000012101',array['40000000-0000-4000-8000-000000012101'::uuid])->'questions'->0->>'subject_id'),'subject-science','question subject text resolves to the confirmed catalogue id');
select is((public.get_prova_question_fit('20000000-0000-4000-8000-000000012101',array['40000000-0000-4000-8000-000000012101'::uuid])->'questions'->0->>'subject'),'Fen Bilimleri','original subject text is kept');
select is((public.get_prova_question_fit('20000000-0000-4000-8000-000000012101','{}')->'subjects'->0->>'subject_id'),'subject-science','subject card reads the child links');
select lives_ok($$select public.save_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012106',0,pg_temp.content(jsonb_build_array(jsonb_build_object('kind','question','id','40000000-0000-4000-8000-000000012103','source','manual')),1))$$,'linked-subject draft saved');
select lives_ok($$select public.submit_prova_draft(gen_random_uuid(),'50000000-0000-4000-8000-000000012106',1)$$,'linked-subject draft submits');
select is((select subject_links from public.exams where id='50000000-0000-4000-8000-000000012106'),'[{"title":"Fen Bilimleri","subject_id":"subject-science"}]'::jsonb,'exam freezes the confirmed subject id next to the text');
select is((select subject_links from public.exams where id='50000000-0000-4000-8000-000000012101'),'[{"title":"Fen Bilimleri","subject_id":null}]'::jsonb,'earlier exam snapshot is not rewritten by a later link');
reset role;
select throws_ok($$update public.exams set subject_links='[]' where id='50000000-0000-4000-8000-000000012106'$$,'P0001','exam_content_locked','subject snapshot frozen with the assigned exam');
set local role authenticated; select pg_temp.device();
select throws_ok($$select public.get_prova_question_fit('20000000-0000-4000-8000-000000012101','{}')$$,'42501',null,'child device cannot read question fit');
set local role authenticated; select pg_temp.other();
select throws_ok($$select public.get_prova_question_fit('20000000-0000-4000-8000-000000012101','{}')$$,'42501',null,'other family cannot read question fit');
select is(jsonb_array_length(public.get_prova_question_fit('20000000-0000-4000-8000-000000012102',array['40000000-0000-4000-8000-000000012101'::uuid])->'questions'),0,'other family cannot see foreign question tags through its own child');
set local role authenticated; select pg_temp.parent();
select throws_ok($$select public.get_prova_question_fit('20000000-0000-4000-8000-000000012101',array_fill(gen_random_uuid(),array[201]))$$,'P0001','invalid_input','question list bounded');

-- 5) C05 uygunluk inceleme listesi ------------------------------------------------------------------------
reset role;
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer,solution,provenance,created_by) values
 ('40000000-0000-4000-8000-000000012111','10000000-0000-4000-8000-000000012101',6,'Türkçe','Blok 1','open_ended','Metindeki ana düşünce nedir?','x','y',
  jsonb_build_object('generator','ai','content_fit','pending_human_review','catalogue_id','70000000-0000-4000-8000-000000012101','catalogue_revision',2,'block_id','B1',
   'outcome_ids','["T.O.6.1","cell:C7"]'::jsonb,'scenario_version','cat@2:abc',
   'blueprint',jsonb_build_object('learning_blocks',jsonb_build_array(jsonb_build_object('block_id','B1','outcomes',jsonb_build_array(
     jsonb_build_object('code','T.O.6.1','cell','B7','text','Metnin ana düşüncesini belirler.'),
     jsonb_build_object('code',null,'cell','C7','text','Metindeki yardımcı düşünceleri belirler.')))))),
  '00000000-0000-4000-8000-000000012101');
set local role authenticated; select pg_temp.parent();
select is((public.list_scenario_question_fit()->'summary'->>'pending_human_review')::int,1,'pending fit counted');
select is(public.list_scenario_question_fit()->'items'->0->>'stem','Metindeki ana düşünce nedir?','reviewer sees the question');
select is(public.list_scenario_question_fit()->'items'->0->'outcomes','[{"id":"T.O.6.1","text":"Metnin ana düşüncesini belirler."},{"id":"cell:C7","text":"Metindeki yardımcı düşünceleri belirler."}]'::jsonb,'reviewer sees the full outcome wording by id (code or source cell)');
select is((public.list_scenario_question_fit()->'items'->0->>'ai_is_decision')::boolean,false,'AI suggestion is labelled as not a decision');
select throws_ok($$select public.list_scenario_question_fit('done')$$,'P0001','invalid_input','unknown state rejected');
reset role; select pg_temp.service(); set local role service_role;
select is(public.record_scenario_question_fit_suggestion('40000000-0000-4000-8000-000000012111','{"decision_reason":"all_checks_passed","confidence":0.9,"findings":[],"recommendation":"approve"}')->>'decision','pending_human_review','AI suggestion stored separately');
set local role authenticated; select pg_temp.parent();
select is(public.list_scenario_question_fit()->'items'->0->'ai_suggestion'->>'recommendation','approve','list shows the AI suggestion separately');
select is(public.list_scenario_question_fit()->'items'->0->>'decision','pending_human_review','AI suggestion does not decide');
select is((public.review_scenario_question_fit('64000000-0000-4000-8000-000000012101','40000000-0000-4000-8000-000000012111',
 '{"decision":"fit","reason":"Soru metnin ana düşüncesini doğrudan ölçüyor.","measured_outcome_ids":["T.O.6.1"],"revision":0,"confirmed":true}')->>'decision'),'fit','parent decision recorded with reason and measured outcome');
select is(jsonb_array_length(public.list_scenario_question_fit()->'items'),0,'reviewed question leaves the pending list');
select is(public.list_scenario_question_fit('reviewed')->'items'->0->>'reason','Soru metnin ana düşüncesini doğrudan ölçüyor.','reviewed list keeps the reason');
select is(public.list_scenario_question_fit('reviewed')->'items'->0->'measured_outcome_ids','["T.O.6.1"]'::jsonb,'reviewed list keeps measured outcomes');
set local role authenticated; select pg_temp.other();
select is(jsonb_array_length(public.list_scenario_question_fit('all')->'items'),0,'other family sees no fit items');
set local role authenticated; select pg_temp.device();
select throws_ok($$select public.list_scenario_question_fit()$$,'42501',null,'child device cannot list fit reviews');
set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select public.list_scenario_question_fit()$$,'42501',null,'anon has no execute grant');
reset role;
select ok(not has_function_privilege('authenticated','gina.link_ai_shared_sources(uuid,jsonb)','execute'),'grouping helper not exposed');
select ok(not has_function_privilege('authenticated','gina.tag_question_period(uuid,uuid,int,text,text)','execute'),'tag helper not exposed');
select ok(not has_table_privilege('authenticated','gina.question_period_tags','select'),'period tags not directly readable');

select * from finish();
rollback;
