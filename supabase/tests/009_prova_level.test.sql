-- Prova: seviye tespiti (dengeli seçim, atama) ve konu hakimiyeti; aile izolasyonu.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-f@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-g@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000f', 'Aile F', '00000000-0000-0000-0000-00000000f001'),
  ('10000000-0000-0000-0000-0000000000f2', 'Aile G', '00000000-0000-0000-0000-00000000f002');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f001'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000f002');
insert into public.children (id, family_id, name, grade) values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', 'Çocuk F', 5);
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000f0d1', '20000000-0000-0000-0000-0000000000f1');

-- İki konu × dört zorluk (aile F) + aile G'nin bir sorusu (seçilmemeli).
insert into public.question_bank (id, family_id, grade, subject, topic, kind, difficulty, stem, choices, correct_key)
select ('50000000-0000-0000-0000-0000000f' || lpad(to_hex(t * 16 + d), 4, '0'))::uuid,
       '10000000-0000-0000-0000-00000000000f', 5, 'Matematik',
       case t when 0 then 'Kesirler' else 'Geometri' end,
       'multiple_choice',
       (array['kolay', 'orta', 'orta_ustu', 'zor'])[d + 1]::public.question_difficulty,
       'Soru ' || t || '-' || d,
       '[{"key":"A","text":"1"},{"key":"B","text":"2"},{"key":"C","text":"3"},{"key":"D","text":"4"}]', 'A'
from generate_series(0, 1) t, generate_series(0, 3) d;
insert into public.question_bank (id, family_id, grade, subject, topic, kind, difficulty, stem, choices, correct_key)
values ('50000000-0000-0000-0000-0000000fff01', '10000000-0000-0000-0000-0000000000f2', 5, 'Matematik', 'Kesirler',
        'multiple_choice', 'kolay', 'Başka aile', '[{"key":"A","text":"1"}]', 'A');

set local role authenticated;

-- Veli F --------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

create temp table picked on commit drop as
  select * from public.pick_level_questions('Matematik', 5::smallint, null, 2, 24);

select is((select count(*)::int from picked), 4, 'konu başı 2 → 4 soru');
select is((select count(distinct topic)::int from picked), 2, 'iki konu da temsil edilir');
select is((select count(distinct difficulty)::int from picked), 4, 'zorluklar dengeli: dört düzey de var');
select ok(
  (select bool_and(d_ok) from (
     select gina.difficulty_ord(difficulty) >= coalesce(lag(gina.difficulty_ord(difficulty)) over (order by ord), 0) as d_ok from picked
   ) x),
  'sıra kolaydan zora'
);
select is((select count(*)::int from picked where question_id = '50000000-0000-0000-0000-0000000fff01'), 0, 'başka ailenin sorusu seçilmez');
select is((select count(*)::int from public.pick_level_questions('Matematik', 5::smallint, null, 4, 3)), 3, 'üst sınır uygulanır');

select lives_ok(
  $$ select public.create_level_test('20000000-0000-0000-0000-0000000000f1', 'Matematik', 5::smallint, null, 2, 24, 'Matematik · Seviye tespiti') $$,
  'veli seviye tespiti oluşturur'
);
select results_eq(
  $$ select kind, status::text, cardinality(question_ids) from public.exams where child_id = '20000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('level_test'::text, 'assigned'::text, 4) $$,
  'deneme level_test olarak atanır'
);
select throws_ok(
  $$ select public.create_level_test('20000000-0000-0000-0000-0000000000f1', 'Tarih', 5::smallint) $$,
  'P0001', 'no_questions',
  'soru yoksa açık hata'
);

-- Cihaz: çözer ama seviye tespiti oluşturamaz / hakimiyeti okuyamaz ----------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000f1", "child_id": "20000000-0000-0000-0000-0000000000f1", "admin": false}}',
  true);

select throws_ok(
  $$ select public.create_level_test('20000000-0000-0000-0000-0000000000f1', 'Matematik', 5::smallint) $$,
  '42501', null,
  'cihaz seviye tespiti oluşturamaz'
);

select public.start_exam_attempt((select id from public.exams limit 1));
select is((select count(*)::int from public.child_topic_mastery('20000000-0000-0000-0000-0000000000f1')), 0, 'cihaz hakimiyet okuyamaz');

-- Cevaplar veli tarafından (çocuk modu) yazılır: cihaz soru konusunu göremediği için.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000f", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select public.submit_exam_answer(
         (select id from public.exam_attempts limit 1), q.id,
         case when q.topic = 'Kesirler' then 'A' else 'B' end, null)
from public.question_bank q
where q.id = any ((select question_ids from public.exams limit 1)::uuid[]);
select lives_ok($$ select public.finish_exam_attempt((select id from public.exam_attempts limit 1)) $$, 'deneme bitirilir');

select results_eq(
  $$ select topic, total, score, level_total from public.child_topic_mastery('20000000-0000-0000-0000-0000000000f1') order by topic $$,
  $$ values ('Geometri'::text, 2, 0, 2), ('Kesirler'::text, 2, 100, 2) $$,
  'konu bazlı hakimiyet: Kesirler 100, Geometri 0'
);
select is(
  (select topic from public.child_topic_mastery('20000000-0000-0000-0000-0000000000f1') limit 1),
  'Geometri',
  'en zayıf konu önce gelir'
);

-- Veli G: başka ailenin çocuğuna erişemez ------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000f2", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select throws_ok(
  $$ select public.create_level_test('20000000-0000-0000-0000-0000000000f1', 'Matematik', 5::smallint) $$,
  'P0001', 'child_not_found',
  'başka ailenin çocuğuna seviye tespiti atanamaz'
);
select is((select count(*)::int from public.child_topic_mastery('20000000-0000-0000-0000-0000000000f1')), 0, 'başka aile hakimiyeti göremez');

select * from finish();
rollback;
