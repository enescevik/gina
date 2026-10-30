-- Öğretmenle paylaşım: anon tabloyu okuyamaz; süresi dolmuş/iptal edilmiş belirteç aynı hatayı verir;
-- kapsamlar (scopes) dışındaki veri dönmez; başka aile iptal edemez; token_hash veliye de kapalıdır.
begin;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000013a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-share-a@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-share-b@test.local', '', now(), '{}', '{}', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000013a0', 'Aile Paylaşım A', '00000000-0000-0000-0000-0000000013a1'),
  ('10000000-0000-0000-0000-0000000013b0', 'Aile Paylaşım B', '00000000-0000-0000-0000-0000000013b1');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000013a0', '00000000-0000-0000-0000-0000000013a1'),
  ('10000000-0000-0000-0000-0000000013b0', '00000000-0000-0000-0000-0000000013b1');
insert into public.children (id, family_id, name, grade, birth_date) values
  ('20000000-0000-0000-0000-0000000013a1', '10000000-0000-0000-0000-0000000013a0', 'Elif Deneme', 4, '2018-03-01');

insert into public.grades (family_id, child_id, subject, score, max_score, graded_on, note) values
  ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', 'Matematik', 85, 100, current_date - 3, 'GIZLI_NOT');
insert into public.notes (family_id, child_id, author_user_id, body, visibility) values
  ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', '00000000-0000-0000-0000-0000000013a1', 'GIZLI_NOT_GOVDE', 'teacher');

insert into public.question_bank (id, family_id, grade, subject, topic, kind, stem, choices, correct_key) values
  ('50000000-0000-0000-0000-0000000013a1', '10000000-0000-0000-0000-0000000013a0', 4, 'Matematik', 'Kesirler', 'multiple_choice', '1/2 + 1/2 = ?',
   '[{"key":"A","text":"1"},{"key":"B","text":"2"}]', 'A'),
  ('50000000-0000-0000-0000-0000000013a2', '10000000-0000-0000-0000-0000000013a0', 4, 'Matematik', 'Kesirler', 'multiple_choice', '1/4 + 1/4 = ?',
   '[{"key":"A","text":"1/2"},{"key":"B","text":"1"}]', 'A');
insert into public.exams (id, family_id, child_id, title, subject, grade, question_ids, status) values
  ('60000000-0000-0000-0000-0000000013a1', '10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', 'Kesirler denemesi', 'Matematik', 4,
   array['50000000-0000-0000-0000-0000000013a1', '50000000-0000-0000-0000-0000000013a2']::uuid[], 'completed');
insert into public.exam_attempts (id, family_id, exam_id, child_id, status, finished_at, mc_total, mc_correct, ai_feedback) values
  ('61000000-0000-0000-0000-0000000013a1', '10000000-0000-0000-0000-0000000013a0', '60000000-0000-0000-0000-0000000013a1', '20000000-0000-0000-0000-0000000013a1',
   'submitted', now() - interval '1 day', 2, 1, '{"eksikler": ["GIZLI_AI"]}');
insert into public.exam_answers (attempt_id, question_id, answer_key, is_correct) values
  ('61000000-0000-0000-0000-0000000013a1', '50000000-0000-0000-0000-0000000013a1', 'A', true),
  ('61000000-0000-0000-0000-0000000013a1', '50000000-0000-0000-0000-0000000013a2', 'B', false);

insert into public.task_templates (id, family_id, child_id, title, starts_on) values
  ('40000000-0000-0000-0000-0000000013a1', '10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', 'Kitap oku', current_date - 40);
insert into public.task_completions (family_id, child_id, template_id, due_date, status, client_id) values
  ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', '40000000-0000-0000-0000-0000000013a1', current_date - 1, 'approved', gen_random_uuid()),
  ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', '40000000-0000-0000-0000-0000000013a1', current_date - 2, 'returned', gen_random_uuid()),
  ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', '40000000-0000-0000-0000-0000000013a1', current_date - 35, 'approved', gen_random_uuid());

-- Düz belirteçleri test boyunca tutmak için geçici tablo.
create temp table share_tokens (name text primary key, id uuid, token text);
grant all on share_tokens to anon, authenticated;

-- Veli A paylaşım oluşturur
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000013a1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000013a0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);

insert into share_tokens select 'grades', s.id, s.token
  from public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'Ayşe Öğretmen', array['grades']) s;
insert into share_tokens select 'all', s.id, s.token
  from public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'Rehber öğretmen', array['grades', 'prova', 'tasks_summary'], 7) s;
insert into share_tokens select 'revoked', s.id, s.token
  from public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'Eski öğretmen', array['grades']) s;

select is((select length(token) from share_tokens where name = 'grades'), 43, 'belirteç 32 bayt base64url');
select is(
  (select count(*)::int from public.child_shares where child_id = '20000000-0000-0000-0000-0000000013a1'),
  3, 'veli kendi paylaşımlarını görür'
);
select throws_ok(
  $$ select token_hash from public.child_shares $$,
  '42501', null, 'token_hash veliye de kapalı'
);
select throws_ok(
  $$ select public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'X', array['notes']) $$,
  'P0001', 'invalid_scopes', 'kapsam dışı (notes) reddedilir'
);
select throws_ok(
  $$ select public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'X', array['grades'], 181) $$,
  'P0001', 'invalid_expiry', '180 günden uzun süre reddedilir'
);
select lives_ok(
  $$ select public.revoke_child_share((select id from share_tokens where name = 'revoked')) $$,
  'veli paylaşımı iptal eder'
);

-- Veli B başka ailenin paylaşımını göremez, iptal edemez, onun çocuğuna paylaşım açamaz
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000013b1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000013b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select is((select count(*)::int from public.child_shares), 0, 'başka aile paylaşımları görmez');
select throws_ok(
  $$ select public.revoke_child_share((select id from share_tokens where name = 'grades')) $$,
  'P0001', 'share_not_found', 'başka aile iptal edemez'
);
select throws_ok(
  $$ select public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'X', array['grades']) $$,
  'P0001', 'child_not_found', 'başka ailenin çocuğuna paylaşım açılamaz'
);

-- Süresi dolmuş paylaşım (sistem olarak eklenir)
reset role;
insert into share_tokens values ('expired', null, 'EXPIREDtokenEXPIREDtokenEXPIREDtokenEXPIRED');
insert into public.child_shares (family_id, child_id, label, scopes, token_hash, created_at, expires_at)
values ('10000000-0000-0000-0000-0000000013a0', '20000000-0000-0000-0000-0000000013a1', 'Süresi dolmuş', array['grades'],
        extensions.digest('EXPIREDtokenEXPIREDtokenEXPIREDtokenEXPIRED', 'sha256'), now() - interval '40 days', now() - interval '10 days');

-- anon (öğretmen) ---------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$ select * from public.child_shares $$, '42501', null, 'anon child_shares okuyamaz');
select throws_ok(
  $$ select public.create_child_share('20000000-0000-0000-0000-0000000013a1', 'X', array['grades']) $$,
  '42501', null, 'anon paylaşım oluşturamaz'
);

select is(
  public.get_shared_child_view((select token from share_tokens where name = 'grades')) -> 'child',
  '{"first_name": "Elif", "grade": 4}'::jsonb,
  'yalnız ad (ilk kelime) ve sınıf döner'
);
select ok(
  (public.get_shared_child_view((select token from share_tokens where name = 'grades')) ? 'grades')
  and not (public.get_shared_child_view((select token from share_tokens where name = 'grades')) ?| array['prova', 'tasks_summary']),
  'yalnız grades kapsamı döner'
);
select is(
  public.get_shared_child_view((select token from share_tokens where name = 'grades')) -> 'grades' -> 0,
  jsonb_build_object('subject', 'Matematik', 'score', 85.00, 'max_score', 100.00, 'date', current_date - 3),
  'puan satırı asgari alanlarla döner'
);
select is(
  public.get_shared_child_view((select token from share_tokens where name = 'all')) -> 'prova' -> 0 -> 'topics',
  '[{"topic": "Kesirler", "correct": 1, "total": 2}]'::jsonb,
  'Prova konu bazlı doğru/toplam döner'
);
select is(
  public.get_shared_child_view((select token from share_tokens where name = 'all')) -> 'tasks_summary',
  '{"days": 30, "completed": 1, "approved": 1, "returned": 1}'::jsonb,
  'görev özeti son 30 gün sayıları'
);
select ok(
  public.get_shared_child_view((select token from share_tokens where name = 'all'))::text !~ 'GIZLI|veli-share|2018-03-01|pin',
  'not, AI geri bildirimi, e-posta, doğum tarihi dönmez'
);

select throws_ok(
  $$ select public.get_shared_child_view((select token from share_tokens where name = 'revoked')) $$,
  'P0001', 'invalid_share', 'iptal edilmiş belirteç reddedilir'
);
select throws_ok(
  $$ select public.get_shared_child_view((select token from share_tokens where name = 'expired')) $$,
  'P0001', 'invalid_share', 'süresi dolmuş belirteç aynı hatayla reddedilir'
);
select throws_ok(
  $$ select public.get_shared_child_view('yok') $$,
  'P0001', 'invalid_share', 'geçersiz belirteç aynı hatayla reddedilir'
);

-- Görüntülenme sayacı
reset role;
select is(
  (select view_count from public.child_shares where id = (select id from share_tokens where name = 'grades')),
  4, 'her görüntüleme sayılır'
);
select ok(
  (select last_viewed_at is not null from public.child_shares where id = (select id from share_tokens where name = 'grades')),
  'son görüntülenme zamanı yazılır'
);

select * from finish();
rollback;
