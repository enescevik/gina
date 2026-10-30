-- Prova: deneme akışı (atama, soru çekme cevapsız, cevap, bitirme) ve izolasyon.
begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-e@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000e0d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000e', 'Aile E', '00000000-0000-0000-0000-00000000e001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000e001');
insert into public.children (id, family_id, name, grade) values
  ('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000e', 'Çocuk E', 5);
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000e0d1', '20000000-0000-0000-0000-0000000000e1');

-- Ebeveyn: soru + deneme oluşturur
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000e001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000e", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

insert into public.question_bank (id, family_id, grade, subject, topic, kind, difficulty, stem, choices, correct_key, solution, explanation)
values
  ('50000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000e', 5, 'Fen Bilimleri', 'Isı ve Sıcaklık', 'multiple_choice', 'orta_ustu',
   'Isı birimi nedir?', '[{"key":"A","text":"Joule"},{"key":"B","text":"Metre"},{"key":"C","text":"Volt"},{"key":"D","text":"Watt"}]', 'A', 'Isı bir enerji türüdür; SI birimi Joule.', 'Enerji birimleri konusuna bakınız.'),
  ('50000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-00000000000e', 5, 'Fen Bilimleri', 'Isı ve Sıcaklık', 'open_ended', 'orta_ustu',
   'Isı ile sıcaklık arasındaki farkı bir örnekle açıklayınız.', null, null, 'Isı enerji, sıcaklık ölçüdür; örnek beklenir.', null);

insert into public.exams (id, family_id, child_id, title, subject, grade, question_ids, timed, duration_minutes, status, created_by)
values ('60000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-0000000000e1',
        'Fen Senaryo 2 Denemesi', 'Fen Bilimleri', 5,
        array['50000000-0000-0000-0000-0000000000e1','50000000-0000-0000-0000-0000000000e2']::uuid[],
        true, 30, 'assigned', '00000000-0000-0000-0000-00000000e001');

select is((select count(*)::int from public.get_attempt_questions('60000000-0000-0000-0000-0000000000e1')), 2, 'ebeveyn deneme sorularını görür');

-- Cihaz (çocuk) olarak
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000e0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-00000000000e", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000e1", "child_id": "20000000-0000-0000-0000-0000000000e1", "admin": false}}',
  true);

select is((select count(*)::int from public.exams), 1, 'cihaz atanmış denemeyi görür');
select is((select count(*)::int from public.question_bank), 0, 'cihaz kütüphaneyi doğrudan göremez');
select ok(
  (select position('"is_correct"' in coalesce((select jsonb_agg(choices)::text from public.get_attempt_questions('60000000-0000-0000-0000-0000000000e1')), '')) = 0),
  'soru çekiminde doğru cevap anahtarı sızmaz'
);
select throws_ok(
  $$ select correct_key from public.get_attempt_questions('60000000-0000-0000-0000-0000000000e1') $$,
  '42703', null,
  'get_attempt_questions correct_key kolonu taşımaz'
);

select lives_ok($$ select public.start_exam_attempt('60000000-0000-0000-0000-0000000000e1') $$, 'cihaz denemeyi başlatır');
select is((select deadline_at is not null from public.exam_attempts limit 1), true, 'süreli denemede son süre yazılır');

select lives_ok(
  $$ select public.submit_exam_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000e1', 'A', null) $$,
  'şıklı cevap yazılır'
);
select is((select count(*)::int from public.exam_answers), 0, 'cihaz cevap satırlarını (geri bildirim dahil) doğrudan okuyamaz');
select lives_ok(
  $$ select public.submit_exam_answer((select id from public.exam_attempts limit 1), '50000000-0000-0000-0000-0000000000e2', null, 'Isı enerjidir, sıcaklık ölçümdür; çay örneği...') $$,
  'açık uçlu cevap yazılır'
);
select lives_ok($$ select public.finish_exam_attempt((select id from public.exam_attempts limit 1)) $$, 'deneme bitirilir');
select results_eq(
  $$ select mc_total, mc_correct from public.exam_attempts limit 1 $$,
  $$ values (1, 1) $$,
  'şıklı özet doğru (1/1)'
);

select * from finish();
rollback;
