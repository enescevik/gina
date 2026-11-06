-- C09 synthetic fixture (disposable gina_c09_* DB only). No real people, schools or tokens.
begin;
-- Aile üyesi OLMAYAN tam yönetici ve içerik operatörü (C07 rolü). Tek aile: katkıyı gönderen sentetik veli.
insert into public.admins(user_id) values('{{admin}}');
insert into public.operations_members(user_id,role,expires_at) values('{{content}}','content',now()+interval '30 days');
insert into public.families(id,name,created_by,timezone) values('c0900000-0000-4000-8000-000000000001','C09 sentetik aile','{{p1}}','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values('c0900000-0000-4000-8000-000000000001','{{p1}}');

-- Katkılar (pending): doğru, belirsiz, yanlış anahtar, görselli.
insert into gina.contribution_sets(id,family_id,actor_id,snapshot,fingerprint,status,consent_version,created_at) values
 ('c0910000-0000-4000-8000-000000000001','c0900000-0000-4000-8000-000000000001','{{p1}}',
  '{"title":"C09 doğru: karenin çevresi","body":"","grade":5,"subject":"Matematik","grouped":false,"images":[],"questions":[{"key":"q1","kind":"open_ended","stem":"Bir kenarı 7 cm olan karenin çevresi kaç cm?","choices":[],"topic":"Çevre","grade":5,"subject":"Matematik","difficulty":"kolay","correct_key":null,"expected_answer":"28 cm"}]}',
  'c09-fp-1','pending','contribution-v1',now()-interval '4 hours'),
 ('c0910000-0000-4000-8000-000000000002','c0900000-0000-4000-8000-000000000001','{{p1}}',
  '{"title":"C09 belirsiz: bilyeler","body":"C09-AMBIGUOUS","grade":5,"subject":"Matematik","grouped":false,"images":[],"questions":[{"key":"q1","kind":"open_ended","stem":"Ali 12 bilyesinden biraz verdi. Kaç bilye kaldı?","choices":[],"topic":"Problemler","grade":5,"subject":"Matematik","difficulty":"kolay","correct_key":null,"expected_answer":"8"}]}',
  'c09-fp-2','pending','contribution-v1',now()-interval '3 hours'),
 ('c0910000-0000-4000-8000-000000000003','c0900000-0000-4000-8000-000000000001','{{p1}}',
  '{"title":"C09 yanlış anahtar: kesir","body":"C09-WRONG","grade":5,"subject":"Matematik","grouped":false,"images":[],"questions":[{"key":"q1","kind":"multiple_choice","stem":"3/4 + 1/4 kaçtır?","choices":["4/8","1","3/16","2/4"],"topic":"Kesirler","grade":5,"subject":"Matematik","difficulty":"kolay","correct_key":"A"}]}',
  'c09-fp-3','pending','contribution-v1',now()-interval '2 hours'),
 ('c0910000-0000-4000-8000-000000000004','c0900000-0000-4000-8000-000000000001','{{p1}}',
  '{"title":"C09 görselli: üçgen","body":"","grade":5,"subject":"Matematik","grouped":false,"images":[{"id":"c0920000-0000-4000-8000-000000000001","sha256":"cc0c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8","alt":"Kenarları etiketli üçgen"}],"questions":[{"key":"q1","kind":"open_ended","stem":"Şekildeki üçgenin çevresi kaç cm?","choices":[],"topic":"Çevre","grade":5,"subject":"Matematik","difficulty":"kolay","correct_key":null}]}',
  'c09-fp-4','pending','contribution-v1',now()-interval '1 hour');

-- Senaryo adayları: onaylı güncel kaynak + yerine yenisi gelmiş eski kaynak sürümü (C05).
insert into gina.curriculum_sources(id,source_key,exam_family,school_year,term,label,index_url,link_url,freshness,last_checked_at,created_by) values
 ('c0930000-0000-4000-8000-000000000001','oyss:2026-2027:1:c09-turkce','oyss','2026-2027',1,'C09 Türkçe (sentetik)','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','https://meb.ai/c09x','verified',now()-interval '1 day','{{admin}}');
insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,retrieved_at,last_checked_at,status,created_by) values
 ('c0930000-0000-4000-8000-000000000001',repeat('a',64),10,'application/vnd.ms-excel','https://cdn.eba.gov.tr/c09/new.xlsx',now()-interval '1 day',now()-interval '1 day','approved','{{admin}}'),
 ('c0930000-0000-4000-8000-000000000001',repeat('b',64),10,'application/vnd.ms-excel','https://cdn.eba.gov.tr/c09/old.xlsx',now()-interval '30 days',now()-interval '30 days','superseded','{{admin}}');
insert into gina.curriculum_candidates(id,external_key,source_sha256,candidate,content_hash,status,created_by) values
 ('c0940000-0000-4000-8000-000000000001','c09-tr-g5-current',repeat('a',64),'{"label":"C09 güncel senaryo","grade":5,"subject":"Türkçe","question_count":2,"blocks":[{"count":2,"outcomes":[{"code":"T.O.5.6","text":"T.O.5.6. Metnin yüzey anlamını belirleyebilme"}]}]}',repeat('a',64),'draft','{{admin}}'),
 ('c0940000-0000-4000-8000-000000000002','c09-tr-g5-old',repeat('b',64),'{"label":"C09 eski kaynak senaryosu","grade":5,"subject":"Türkçe","question_count":2,"blocks":[{"count":2,"outcomes":[{"code":"T.O.5.6","text":"T.O.5.6. Metnin yüzey anlamını belirleyebilme"}]}]}',repeat('b',64),'draft','{{admin}}');

-- Zamanlayıcının işleyeceği kuyruk: yanlış anahtar, görselli katkı, eski kaynak adayı.
select gina.content_prereview_queue('contribution_set','c0910000-0000-4000-8000-000000000003',null);
select gina.content_prereview_queue('contribution_set','c0910000-0000-4000-8000-000000000004',null);
select gina.content_prereview_queue('curriculum_candidate','c0940000-0000-4000-8000-000000000002',null);

update public.app_settings set value='true' where key='content_prereview.enabled';
insert into public.app_settings(key,value) values('ai.enabled','true') on conflict(key) do update set value='true';
commit;
