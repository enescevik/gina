-- C08 (S06/U09/Q02): sağlayıcıya göre yönlendirme ve devre kesici, özellik/kullanım tek okuması (daily_tips
-- sunulmuyor), ortak giriş aralığı tetikleyicileri, AI puanı öneri / veli puanı kesin ayrımı ve geriye uyumlu okuma.
begin;
select plan(66);

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000011501','c08-parent@test.local'),
 ('00000000-0000-4000-8000-000000011502','c08-other@test.local'),
 ('00000000-0000-4000-8000-000000011503','c08-device@test.local'),
 ('00000000-0000-4000-8000-000000011504','c08-plus@test.local'),
 ('00000000-0000-4000-8000-000000011505','c08-free@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000011501','C08 Pro','00000000-0000-4000-8000-000000011501'),
 ('10000000-0000-4000-8000-000000011502','C08 Diğer','00000000-0000-4000-8000-000000011502'),
 ('10000000-0000-4000-8000-000000011504','C08 Plus','00000000-0000-4000-8000-000000011504'),
 ('10000000-0000-4000-8000-000000011505','C08 Free','00000000-0000-4000-8000-000000011505');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501'),
 ('10000000-0000-4000-8000-000000011502','00000000-0000-4000-8000-000000011502'),
 ('10000000-0000-4000-8000-000000011504','00000000-0000-4000-8000-000000011504'),
 ('10000000-0000-4000-8000-000000011505','00000000-0000-4000-8000-000000011505');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501','Cocuk',5);
insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values
 ('10000000-0000-4000-8000-000000011501','pro','test',now()+interval '1 day'),
 ('10000000-0000-4000-8000-000000011504','plus','test',now()+interval '1 day');
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011503','20000000-0000-4000-8000-000000011501');

create function pg_temp.as_service() returns void language sql as $$
 select set_config('request.jwt.claims','{"role":"service_role"}',true); $$;
create function pg_temp.as_parent(u text, f text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','gina',jsonb_build_object('family_id',f,'role','parent'))::text,true); $$;
create function pg_temp.hash(t text) returns text language sql as $$ select encode(extensions.digest(t,'sha256'),'hex') $$;
create function pg_temp.health(p text) returns int language sql as $$ select failures from public.ai_provider_health where provider=p $$;

-- 1. Sağlayıcı yönlendirmesi ------------------------------------------------------------------------------
select has_column('public','ai_operation_jobs','provider','iş satırı çözülmüş sağlayıcıyı taşır');
select has_column('public','prova_generation_jobs','provider','üretim işi çözülmüş sağlayıcıyı taşır');
select is((select count(*)::int from public.ai_provider_health where provider in ('anthropic','openai_compatible','gemini')),3,'her sağlayıcının ayrı sağlık satırı var');
select is(gina.ai_family_provider('10000000-0000-4000-8000-000000011501'),'anthropic','pro aile: etkin modelin sağlayıcısı');
select results_eq($$select gina.ai_error_provider(x) from unnest(array['anthropic_529','openai_503','gemini_429','ai_result_invalid']) x$$,
 $$values ('anthropic'::text),('openai_compatible'),('gemini'),(null)$$,'hata öneki → sağlayıcı');
select results_eq($$select gina.ai_breaker_code(x) from unnest(array['openai_429','gemini_500','anthropic_401','openai_400','ai_result_invalid']) x$$,
 $$values (true),(true),(false),(false),(false)$$,'devre kesici yalnız 429/5xx sayar');

set local role service_role;
select pg_temp.as_service();
-- Etkin olmayan sağlayıcıya iş açılmaz (X04: anahtar yok)
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-a'),gen_random_uuid(),'openai_compatible')->>'error',
 'provider_unconfigured','unconfigured sağlayıcı rezervasyon açmaz');
select throws_ok($$select public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-a'),gen_random_uuid(),'nope')$$,
 'P0001','invalid_input','bilinmeyen sağlayıcı reddedilir');

-- İkinci sağlayıcı (yalnız bu işlem içinde) etkin sayılır: devre kesici sağlayıcı başına
reset role;
update public.ai_providers set status='active' where id='openai_compatible';
set local role service_role;
create temp table c08_jobs(name text primary key, id uuid, lease uuid);
grant all on c08_jobs to service_role;
do $$
declare r jsonb; l uuid;
begin
 for i in 1..3 loop
  l := gen_random_uuid();
  r := public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-o'||i),l,'openai_compatible');
  insert into c08_jobs values('o'||i,(r->>'id')::uuid,l);
  perform public.finish_ai_operation((r->>'id')::uuid,l,null,'openai_503',true);
  delete from public.ai_request_attempts where family_id='10000000-0000-4000-8000-000000011501';
 end loop;
end $$;
select is((select provider from public.ai_operation_jobs where id=(select id from c08_jobs where name='o1')),'openai_compatible','iş satırına sağlayıcı yazılır');
select is((select status from public.ai_operation_jobs where id=(select id from c08_jobs where name='o1')),'uncertain','5xx belirsiz kalır (otomatik tekrar yok)');
select is(pg_temp.health('openai_compatible'),3,'OpenAI belirsiz/5xx sayacı 3');
select is(pg_temp.health('anthropic'),0,'Anthropic sayacı etkilenmez');
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-o9'),gen_random_uuid(),'openai_compatible')->>'error',
 'ai_temporarily_unavailable','OpenAI duraklatıldı');
select ok(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-a1'),'00000000-0000-4000-8000-0000000115a1') ? 'id',
 'Anthropic aynı anda çalışır (sağlayıcı başına devre kesici)');
select is((select provider from public.ai_operation_jobs where lease='00000000-0000-4000-8000-0000000115a1'),'anthropic','p_provider verilmezse aile modelinin sağlayıcısı');
-- Aynı girdi tekrar: tek hak, ikinci ücretli çağrı yok
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-a1'),gen_random_uuid())->>'error',
 'generation_in_progress','çalışan aynı istek ikinci iş açmaz');
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-o1'),gen_random_uuid(),'openai_compatible')->>'error',
 'ai_result_uncertain','belirsiz iş aynı girdide yeniden ücretli çağrı açmaz');
select lives_ok($$select public.finish_ai_operation((select id from public.ai_operation_jobs where lease='00000000-0000-4000-8000-0000000115a1'),'00000000-0000-4000-8000-0000000115a1','{"output":{}}'::jsonb)$$,'Anthropic işi biter');
select is((select status from public.ai_operation_jobs where lease='00000000-0000-4000-8000-0000000115a1'),'done','iş tamamlandı');
select is(public.reserve_ai_operation('10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','grade',pg_temp.hash('c08-a1'),gen_random_uuid())->>'id',
 (select id::text from public.ai_operation_jobs where lease='00000000-0000-4000-8000-0000000115a1'),'tamamlanmış aynı girdi önbellekten, aynı iş');
select is(pg_temp.health('openai_compatible'),3,'Anthropic başarısı OpenAI sayacını sıfırlamaz');

-- Eski iş (provider null) Anthropic sayılır
reset role;
insert into public.ai_operation_jobs(id,family_id,requested_by,action,input_hash,lease,status)
 values('00000000-0000-4000-8000-0000000115b1','10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501','plan',pg_temp.hash('legacy'),'00000000-0000-4000-8000-0000000115b2','working');
set local role service_role;
select lives_ok($$select public.finish_ai_operation('00000000-0000-4000-8000-0000000115b1','00000000-0000-4000-8000-0000000115b2',null,'anthropic_529',false)$$,'eski iş biter');
select is(pg_temp.health('anthropic'),1,'eski (provider null) işin 529 hatası Anthropic sayacına yazılır');

-- Bağlam modeli: etkin + desteklenen + aynı sağlayıcı
select is(gina.ai_context_provider('claude-haiku-5-5',null),'anthropic','desteklenen bağlam modeli');
select is(gina.ai_context_provider('claude-haiku-5-5','gemini'),null,'bağlam sağlayıcısı uyuşmazsa reddedilir');
select is(gina.ai_context_provider('yok-model',null),null,'bilinmeyen/etkin olmayan model reddedilir');

-- Prova üretimi: iş sağlayıcıyı taşır, hata işin sağlayıcısına yazılır
select ok(public.reserve_prova_generation_v2('00000000-0000-4000-8000-0000000115c1','10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501',pg_temp.hash('gen1'),3) ? 'lease','üretim rezervasyonu');
select is((select provider from public.prova_generation_jobs where id='00000000-0000-4000-8000-0000000115c1'),'anthropic','üretim işi sağlayıcısı');
select lives_ok($$select public.fail_prova_generation_v2('00000000-0000-4000-8000-0000000115c1',(select lease from public.prova_generation_jobs where id='00000000-0000-4000-8000-0000000115c1'),'anthropic_503',true)$$,'üretim belirsiz biter');
select is(pg_temp.health('anthropic'),2,'üretim hatası işin sağlayıcısına (Anthropic) yazılır');
select is(public.reserve_prova_generation_v2('00000000-0000-4000-8000-0000000115c1','10000000-0000-4000-8000-000000011501','00000000-0000-4000-8000-000000011501',pg_temp.hash('gen1'),3)->>'error',
 'ai_result_uncertain','belirsiz üretim aynı istekte ikinci ücretli çağrıya dönüşmez');

-- Yetki: istemci rezervasyon/sağlık fonksiyonlarını çağıramaz
reset role;
select ok(not has_function_privilege('authenticated','public.reserve_ai_operation(uuid,uuid,text,text,uuid,text)','execute'),'istemci rezervasyon yapamaz');
select ok(not has_function_privilege('authenticated','gina.ai_provider_outcome(text,boolean,text,boolean)','execute'),'istemci sağlık kaydı yazamaz');
select ok(not has_function_privilege('anon','public.accept_ai_grade(uuid,uuid,smallint)','execute'),'anonim AI önerisi onaylayamaz');

-- 2. Kullanım / özellik tek okuması ------------------------------------------------------------------------
update public.ai_providers set status='unconfigured' where id='openai_compatible';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011504','10000000-0000-4000-8000-000000011504');
select is((select (f->>'available')::boolean from jsonb_array_elements(public.get_ai_usage()->'features') f where f->>'feature'='weekly_summary'),true,'Plus: haftalık özet kullanılabilir');
select is((select (f->>'in_plan')::boolean from jsonb_array_elements(public.get_ai_usage()->'features') f where f->>'feature'='open_ended_grading'),false,'Plus: açık uçlu puanlama pakette yok');
select is((public.get_ai_usage()->'media'->>'max_files')::int,5,'medya: varsayılan 5 dosya');
select is((public.get_ai_usage()->'media'->>'max_files')::int,(public.get_learning_source_policy()->>'max_files')::int,'kullanım ekranı ve dosya seçici aynı sınırı okur');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select results_eq($$select (f->>'offered')::boolean,(f->>'in_plan')::boolean,(f->>'available')::boolean from jsonb_array_elements(public.get_ai_usage()->'features') f where f->>'feature'='daily_tips'$$,
 $$values (false,true,false)$$,'daily_tips: Pro pakette ama sunulmuyor → çalışıyor görünmez');
select is((select f->'inputs' from jsonb_array_elements(public.get_ai_usage()->'features') f where f->>'feature'='document_analysis'),'["image", "pdf"]'::jsonb,'Pro belge analizi: görsel+PDF');
select ok(not (public.get_ai_usage() ? 'model') and position('claude' in public.get_ai_usage()::text)=0,'kullanım yanıtı model/sağlayıcı adı sızdırmaz');
select is((public.get_ai_usage()->>'paused')::boolean,false,'Anthropic duraklatılmadı (2 hata < 3)');
reset role;
update public.app_settings set value='3'::jsonb where key='sources.max_files';
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select is((public.get_ai_usage()->'media'->>'max_files')::int,3,'yönetim 3 yapınca kullanım ekranı 3');
select is((public.get_learning_source_policy()->>'max_files')::int,3,'yönetim 3 yapınca seçici 3');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011505','10000000-0000-4000-8000-000000011505');
select is((select count(*)::int from jsonb_array_elements(public.get_ai_usage()->'features') f where (f->>'available')::boolean),0,'Free: hiçbir AI özelliği kullanılabilir görünmez');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011503","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000011501","role":"device","device_id":"30000000-0000-4000-8000-000000011501","child_id":"20000000-0000-4000-8000-000000011501"}}',true);
select throws_ok($$select public.get_ai_usage()$$,'42501',null,'çocuk cihazı kullanım okuyamaz');

-- 3. Ortak giriş aralığı ----------------------------------------------------------------------------------
reset role;
select throws_ok($$insert into public.family_rewards(family_id,title,cost_stars) values('10000000-0000-4000-8000-000000011501','Fazla',501)$$,
 '23514','invalid_input','ödül bedeli 501: ortak aralık (invalid_input, 23514)');
select lives_ok($$insert into public.family_rewards(family_id,title,cost_stars) values('10000000-0000-4000-8000-000000011501','Sınır',500)$$,'ödül bedeli 500 kabul');
select throws_ok($$insert into public.exams(family_id,child_id,title,subject,grade,question_ids,status,timed,duration_minutes)
 values('10000000-0000-4000-8000-000000011501','20000000-0000-4000-8000-000000011501','Uzun','Fen',5,'{}','draft',true,181)$$,
 '23514','invalid_input','Prova süresi 181 reddedilir (1–180)');
select lives_ok($$insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,timed,duration_minutes)
 values('50000000-0000-4000-8000-000000011599','10000000-0000-4000-8000-000000011501','20000000-0000-4000-8000-000000011501','Normal','Fen',5,'{}','draft',true,40)$$,'Prova süresi 40 kabul');
-- Mevcut satır yeniden doğrulanmaz: tetikleyiciyi atlayarak eski aralık dışı değer yazılır, başka sütun güncellenir
alter table public.exams disable trigger exams_input_range;
update public.exams set duration_minutes=200 where id='50000000-0000-4000-8000-000000011599';
alter table public.exams enable trigger exams_input_range;
select lives_ok($$update public.exams set title='Eski' where id='50000000-0000-4000-8000-000000011599'$$,'eski aralık dışı satırın başka alanı güncellenebilir');

-- 4. AI puanı öneri / veli puanı kesin ---------------------------------------------------------------------
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer) values
 ('40000000-0000-4000-8000-000000011521','10000000-0000-4000-8000-000000011501',5,'Fen','Işık','open_ended','Güneş neden ışık kaynağıdır?','Kendi ışığını üretir.'),
 ('40000000-0000-4000-8000-000000011522','10000000-0000-4000-8000-000000011501',5,'Fen','Işık','open_ended','Ay neden değildir?','Yansıtır.');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values
 ('50000000-0000-4000-8000-000000011531','10000000-0000-4000-8000-000000011501','20000000-0000-4000-8000-000000011501','Açık','Fen',5,
  array['40000000-0000-4000-8000-000000011521','40000000-0000-4000-8000-000000011522']::uuid[],'assigned'),
 ('50000000-0000-4000-8000-000000011532','10000000-0000-4000-8000-000000011501','20000000-0000-4000-8000-000000011501','Eski AI','Fen',5,
  array['40000000-0000-4000-8000-000000011521']::uuid[],'completed');
insert into public.exam_attempts(id,family_id,exam_id,child_id) values
 ('60000000-0000-4000-8000-000000011541','10000000-0000-4000-8000-000000011501','50000000-0000-4000-8000-000000011531','20000000-0000-4000-8000-000000011501');
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select public.submit_exam_answer('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',null,'Kendi ışığını üretir.');
select public.submit_exam_answer('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011522',null,'Yansıtır.');
select public.finish_exam_attempt('60000000-0000-4000-8000-000000011541');
reset role;
set local role service_role;
select pg_temp.as_service();
select results_eq($$select status::text, open_graded, provisional from public.apply_ai_grades('60000000-0000-4000-8000-000000011541',
  '[{"question_id":"40000000-0000-4000-8000-000000011521","score":90,"kisa_geri_bildirim":"İyi"},{"question_id":"40000000-0000-4000-8000-000000011522","score":40,"kisa_geri_bildirim":"Eksik"}]'::jsonb,null)$$,
 $$values ('submitted',0,true)$$,'AI puanları denemeyi kesinleştirmez');
select results_eq($$select score, ai_score::int, graded_by, ai_graded_at is not null, review_revision from public.exam_answers where attempt_id='60000000-0000-4000-8000-000000011541' order by question_id$$,
 $$values (null::smallint,90,null::text,true,0),(null::smallint,40,null::text,true,0)$$,'yalnız ai_score/ai_graded_at; score, graded_by ve inceleme revizyonu değişmez');
reset role;
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select results_eq($$select (x->>'ai_suggested')::boolean,(x->>'ai_score')::int,x->>'state' from jsonb_array_elements(public.get_attempt_summary('60000000-0000-4000-8000-000000011541')->'open_answers') x order by (x->>'position')::int$$,
 $$values (true,90,'pending'),(true,40,'pending')$$,'özet: öneri ayrı alanda, durum bekliyor');
select is((public.get_attempt_summary('60000000-0000-4000-8000-000000011541')->>'ai_suggestion_count')::int,2,'özet: öneri sayısı');
select is((select pending from public.child_topic_mastery('20000000-0000-4000-8000-000000011501') where topic='Işık'),2,'konu hakimiyeti AI önerisini puan saymaz');
select throws_ok($$select public.accept_ai_grade('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',80::smallint)$$,
 'P0001','ai_suggestion_changed','ekrandaki öneri eskiyse onay reddedilir');
select results_eq($$select status::text, open_graded, provisional from public.accept_ai_grade('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',90::smallint)$$,
 $$values ('submitted',1,true)$$,'veli önerisini kesinleştirir; diğeri bekliyor');
select results_eq($$select score::int, graded_by, review_revision from public.exam_answers where attempt_id='60000000-0000-4000-8000-000000011541' and question_id='40000000-0000-4000-8000-000000011521'$$,
 $$values (90,'parent'::text,1)$$,'kesin puan veli kaydı');
select results_eq($$select status::text, open_graded from public.accept_ai_grade('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',90::smallint)$$,
 $$values ('submitted',1)$$,'çift onay: sonuç değişmez');
select is((select review_revision from public.exam_answers where attempt_id='60000000-0000-4000-8000-000000011541' and question_id='40000000-0000-4000-8000-000000011521'),1,'çift onay revizyon artırmaz');
select results_eq($$select status::text, score_pct::int from public.score_open_answer('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011522',60::smallint,'Veli puanı')$$,
 $$values ('graded',75)$$,'veli kendi puanını verir (AI 40 değil 60): (90+60)/2');
select pg_temp.as_parent('00000000-0000-4000-8000-000000011502','10000000-0000-4000-8000-000000011502');
select throws_ok($$select public.accept_ai_grade('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',90::smallint)$$,
 'P0001','attempt_not_found','başka aile onaylayamaz');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000011503","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000011501","role":"device","device_id":"30000000-0000-4000-8000-000000011501","child_id":"20000000-0000-4000-8000-000000011501"}}',true);
select throws_ok($$select public.accept_ai_grade('60000000-0000-4000-8000-000000011541','40000000-0000-4000-8000-000000011521',90::smallint)$$,
 '42501',null,'çocuk cihazı onaylayamaz');

-- Eski kayıt: graded_by='ai' + score (C08 öncesi) yeniden yazılmaz, eskisi gibi okunur
reset role;
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,started_at,finished_at,graded_at,mc_total,mc_correct,open_total,open_graded,score_pct) values
 ('60000000-0000-4000-8000-000000011542','10000000-0000-4000-8000-000000011501','50000000-0000-4000-8000-000000011532','20000000-0000-4000-8000-000000011501',
  'graded',now()-interval '3 days',now()-interval '3 days',now()-interval '3 days',0,0,1,1,70);
insert into public.exam_answers(attempt_id,question_id,answer_text,score,ai_score,feedback,graded_by,graded_at) values
 ('60000000-0000-4000-8000-000000011542','40000000-0000-4000-8000-000000011521','Eski cevap',70,70,'Eski AI','ai',now()-interval '3 days');
set local role authenticated;
select pg_temp.as_parent('00000000-0000-4000-8000-000000011501','10000000-0000-4000-8000-000000011501');
select results_eq($$select x->>'state',(x->>'score')::int,(x->>'legacy_ai')::boolean,(x->>'ai_suggested')::boolean from jsonb_array_elements(public.get_attempt_summary('60000000-0000-4000-8000-000000011542')->'open_answers') x$$,
 $$values ('graded'::text,70,true,false)$$,'eski AI puanı: geriye uyumlu okunur, legacy_ai işaretli');
select results_eq($$select status::text, score_pct::int from public.exam_attempts where id='60000000-0000-4000-8000-000000011542'$$,
 $$values ('graded',70)$$,'eski deneme yeniden yazılmaz');

select * from finish();
rollback;
