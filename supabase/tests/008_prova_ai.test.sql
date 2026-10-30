-- Prova AI: paket kapısı, veli puanlaması, AI puanı yazımı (service_role), çalışma planı RLS.
begin;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-f@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-g@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000f', 'Aile F (ücretsiz)', '00000000-0000-0000-0000-00000000f001'),
  ('10000000-0000-0000-0000-0000000000f2', 'Aile G (Pro)', '00000000-0000-0000-0000-00000000f002');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f001'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000f002');
insert into public.children (id, family_id, name, grade) values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', 'Çocuk F', 5),
  ('20000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000f2', 'Çocuk G', 5);
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000f0d1', '20000000-0000-0000-0000-0000000000f2');
insert into public.entitlement_overrides (family_id, plan, reason, ends_at) values
  ('10000000-0000-0000-0000-0000000000f2', 'pro', 'test', now() + interval '30 days');

insert into public.question_bank (id, family_id, grade, subject, topic, kind, difficulty, stem, choices, correct_key, expected_answer) values
  ('50000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f2', 5, 'Fen Bilimleri', 'Isı', 'multiple_choice', 'orta',
   'Isı birimi?', '[{"key":"A","text":"Joule"},{"key":"B","text":"Metre"},{"key":"C","text":"Volt"},{"key":"D","text":"Watt"}]', 'A', null),
  ('50000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000f2', 5, 'Fen Bilimleri', 'Isı', 'open_ended', 'orta_ustu',
   'Isı ile sıcaklık farkı?', null, null, 'Isı enerjidir, sıcaklık ölçüdür.'),
  ('50000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-0000000000f2', 5, 'Fen Bilimleri', 'Madde', 'open_ended', 'orta',
   'Maddenin halleri?', null, null, 'Katı, sıvı, gaz.');

insert into public.exam_blueprints (id, family_id, grade, subject, name, rows) values
  ('70000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', 5, 'Fen Bilimleri', 'Senaryo 2', '[{"topic":"Isı","count":2}]');

-- Ücretsiz veli -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select is((public.get_prova_entitlement() ->> 'plan'), 'free', 'ücretsiz aile: plan free');
select is((public.get_prova_entitlement() ->> 'ai_grading')::boolean, false, 'ücretsizde AI değerlendirme yok');
select is((public.get_prova_entitlement() ->> 'ai_generate_limit')::int, 0, 'ücretsizde AI üretim kotası 0');

select lives_ok(
  $$ insert into public.exams (family_id, child_id, title, subject, grade, kind) values
     ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-0000000000f1', 'D1', 'Fen Bilimleri', 5, 'practice') $$,
  'ücretsiz: ayın ilk kütüphane denemesi'
);
select throws_ok(
  $$ insert into public.exams (family_id, child_id, title, subject, grade, kind) values
     ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-0000000000f1', 'D2', 'Fen Bilimleri', 5, 'practice') $$,
  'P0001', 'plan_limit_prova_exams',
  'ücretsiz: ayda ikinci deneme reddedilir'
);
select lives_ok(
  $$ insert into public.exams (family_id, child_id, title, subject, grade, kind) values
     ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-0000000000f1', 'Seviye', 'Fen Bilimleri', 5, 'level_test') $$,
  'ücretsiz: seviye tespiti sınırsız'
);
select is((public.get_prova_entitlement() ->> 'monthly_exams_used')::int, 1, 'kullanılan deneme sayısı yalnız practice');

-- Ücretsizde senaryolu deneme: kota henüz dolmamış bir ay simülasyonu için önceki denemeyi geçen aya taşı.
reset role;
update public.exams set created_at = now() - interval '40 days' where family_id = '10000000-0000-0000-0000-00000000000f';
set local role authenticated;
select throws_ok(
  $$ insert into public.exams (family_id, child_id, blueprint_id, title, subject, grade, kind) values
     ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-0000000000f1', '70000000-0000-0000-0000-0000000000f1', 'S', 'Fen Bilimleri', 5, 'practice') $$,
  'P0001', 'plan_limit_prova_scenarios',
  'ücretsiz: senaryolu deneme reddedilir'
);
select throws_ok(
  $$ select public.apply_ai_grades('00000000-0000-0000-0000-000000000000', '[]'::jsonb) $$,
  '42501', null,
  'veli apply_ai_grades çağıramaz'
);

-- Pro veli ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select is((public.get_prova_entitlement() ->> 'study_plan')::boolean, true, 'Pro: çalışma planı açık');

insert into public.exams (id, family_id, child_id, title, subject, grade, question_ids, status)
values ('60000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f2',
        'Fen', 'Fen Bilimleri', 5,
        array['50000000-0000-0000-0000-0000000000f1','50000000-0000-0000-0000-0000000000f2','50000000-0000-0000-0000-0000000000f3']::uuid[],
        'assigned');

-- Çocuk (cihaz) çözer
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f2", "child_id": "20000000-0000-0000-0000-0000000000f2", "admin": false}}',
  true);
select public.start_exam_attempt('60000000-0000-0000-0000-0000000000f1');
select public.submit_exam_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f1', 'A', null);
select public.submit_exam_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f2', null, 'Isı enerjidir.');
select public.submit_exam_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f3', null, 'Katı ve sıvı.');
select throws_ok(
  $$ select public.score_open_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f2', 80::smallint) $$,
  '42501', null,
  'cihaz açık uçlu puanlayamaz'
);
select public.finish_exam_attempt((select id from public.exam_attempts limit 1));

-- Veli puanlar
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

select results_eq(
  $$ select status::text, open_total, open_graded from public.exam_attempts limit 1 $$,
  $$ values ('submitted', 2, 0) $$,
  'bitince toplamlar yazılır, açık uçlular bekliyor'
);
select throws_ok(
  $$ select public.score_open_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f2', 120::smallint) $$,
  'P0001', 'invalid_score',
  '0-100 dışı puan reddedilir'
);
select throws_ok(
  $$ select public.score_open_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f1', 50::smallint) $$,
  'P0001', 'question_not_open_ended',
  'şıklı soru elle puanlanmaz'
);
select lives_ok(
  $$ select public.score_open_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000f2', 80::smallint, 'Güzel') $$,
  'veli açık uçlu puanlar'
);
select results_eq(
  $$ select score::int, graded_by from public.exam_answers where question_id = '50000000-0000-0000-0000-0000000000f2' $$,
  $$ values (80, 'parent') $$,
  'veli puanı yazılır'
);

-- service_role (prova-grade) AI puanlarını yazar
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select lives_ok(
  $$ select public.apply_ai_grades(
       (select id from public.exam_attempts where exam_id = '60000000-0000-0000-0000-0000000000f1'),
       '[{"question_id":"50000000-0000-0000-0000-0000000000f2","score":30,"kisa_geri_bildirim":"Eksik"},
         {"question_id":"50000000-0000-0000-0000-0000000000f3","score":60,"kisa_geri_bildirim":"Gaz eksik","eksikler":["gaz hali"]}]'::jsonb,
       '{"zayif_konular":["Madde"]}'::jsonb) $$,
  'service_role AI puanlarını yazar'
);
select results_eq(
  $$ select score::int, ai_score::int, graded_by from public.exam_answers
     where attempt_id = (select id from public.exam_attempts where exam_id = '60000000-0000-0000-0000-0000000000f1')
       and question_id in ('50000000-0000-0000-0000-0000000000f2', '50000000-0000-0000-0000-0000000000f3')
     order by question_id $$,
  $$ values (80, 30, 'parent'), (60, 60, 'ai') $$,
  'veli puanı AI puanını ezer; diğerine AI puanı yazılır'
);
select results_eq(
  $$ select status::text, open_graded, score_pct::int from public.exam_attempts where exam_id = '60000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('graded', 2, 80) $$,
  'tüm açık uçlular puanlı: graded, ortalama (100+80+60)/3 = 80'
);
select is(
  (select pct from public.get_attempt_topic_stats((select id from public.exam_attempts where exam_id = '60000000-0000-0000-0000-0000000000f1')) where topic = 'Madde'),
  60, 'konu bazlı sonuç'
);
insert into public.study_plans (family_id, child_id, attempt_id, subject, grade, weak_topics, plan)
values ('10000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f2',
        (select id from public.exam_attempts where exam_id = '60000000-0000-0000-0000-0000000000f1'),
        'Fen Bilimleri', 5, '[{"topic":"Madde","pct":60}]', '{"ozet":"Madde tekrar"}');

-- Planlar: veli görür, cihaz ve başka aile görmez; veli doğrudan yazamaz
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select is((select count(*)::int from public.study_plans), 1, 'veli kendi planını görür');
select throws_ok(
  $$ insert into public.study_plans (family_id, child_id, subject, grade) values
     ('10000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f2', 'Fen', 5) $$,
  '42501', null,
  'veli planı doğrudan ekleyemez'
);
select is((public.set_study_plan_status((select id from public.study_plans limit 1), 'approved')).status, 'approved', 'veli planı onaylar');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f2", "child_id": "20000000-0000-0000-0000-0000000000f2", "admin": false}}',
  true);
select is((select count(*)::int from public.study_plans), 0, 'cihaz planları göremez');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select is((select count(*)::int from public.study_plans), 0, 'başka aile planları göremez');

select * from finish();
rollback;
