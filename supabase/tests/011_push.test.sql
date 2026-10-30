-- Push: token kaydı ve RLS, tercih, outbox tetikleyicileri (kişisel veri yok), hedef seçimi.
begin;
select plan(24);
-- Yerel tohum verisinin (demo aile) kuyruğu testi etkilemesin; işlem sonunda geri alınır.
delete from public.push_outbox;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-b1@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-b2@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000b0d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'veli-c@test.local', '', now(), '{}', '{}', now(), now());

-- Hedef seçimi oturum ister (global çıkışta token susar).
insert into auth.sessions (id, user_id, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000b001', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000b002', now(), now());

insert into public.families (id, name, created_by) values
  ('10000000-0000-0000-0000-0000000000b0', 'Aile B', '00000000-0000-0000-0000-00000000b001'),
  ('10000000-0000-0000-0000-0000000000c0', 'Aile C', '00000000-0000-0000-0000-00000000c001');
insert into public.family_members (family_id, user_id) values
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000b001'),
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000b002'),
  ('10000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-00000000c001');
insert into public.children (id, family_id, name, grade) values
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b0', 'Gizli Ad', 5);
insert into public.devices (id, family_id, auth_user_id, active_child_id) values
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000b0d1', '20000000-0000-0000-0000-0000000000b1');
insert into public.task_templates (id, family_id, child_id, title, stars, starts_on) values
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b0', '20000000-0000-0000-0000-0000000000b1', 'Gizli Görev', 2, current_date - 10),
  ('40000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000b0', '20000000-0000-0000-0000-0000000000b1', 'İkinci Görev', 1, current_date - 10);

set local role authenticated;

-- Veli 1 token kaydeder
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok($$ select public.register_push_token('apns-veli-1-token', 'ios', 'tr-TR') $$, 'veli token kaydeder');
select is((select token_type || '/' || locale from public.push_tokens), 'apns/tr', 'ios → apns, yerel ayar kısalır');
select lives_ok($$ select public.register_push_token('apns-veli-1-token-yeni', 'ios', 'en') $$, 'veli token yeniler');
select is((select count(*)::int from public.push_tokens), 1, 'aynı platformdaki eski token silinir');
select throws_ok(
  $$ insert into public.push_tokens (user_id, family_id, role, platform, token, token_type) values ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-0000000000b0', 'parent', 'ios', 'dogrudan-yazma', 'apns') $$,
  '42501', null, 'doğrudan token yazımı kapalı (yalnız RPC)'
);
select throws_ok($$ select count(*) from public.push_outbox $$, '42501', null, 'veli outbox''a erişemez');
select lives_ok(
  $$ insert into public.push_preferences (user_id, family_id, exams) values ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-0000000000b0', false) $$,
  'veli kendi tercihini yazar'
);
select throws_ok(
  $$ insert into public.push_preferences (user_id, family_id) values ('00000000-0000-0000-0000-00000000b002', '10000000-0000-0000-0000-0000000000b0') $$,
  '42501', null, 'başka velinin tercihi yazılamaz'
);
select throws_ok($$ select * from public.push_claim_batch(10) $$, '42501', null, 'claim yalnız service_role');

-- Veli 2 token kaydeder ve veli 1'in token'ını göremez
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b002", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select lives_ok($$ select public.register_push_token('fcm-veli-2-token', 'android', 'tr') $$, 'ikinci veli android token kaydeder');
select is((select count(*)::int from public.push_tokens), 1, 'veli yalnız kendi token''ını görür');
delete from public.push_tokens where token = 'apns-veli-1-token-yeni';

-- Cihaz token kaydeder, görevi tikler
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000b1", "child_id": "20000000-0000-0000-0000-0000000000b1", "admin": false}}',
  true);
select lives_ok($$ select public.register_push_token('apns-tablet-token', 'ios', 'tr') $$, 'cihaz token kaydeder');
select public.complete_task('40000000-0000-0000-0000-0000000000b1', current_date, '70000000-0000-0000-0000-0000000000b1');
select public.complete_task('40000000-0000-0000-0000-0000000000b2', current_date, '70000000-0000-0000-0000-0000000000b2');

-- Aile C velisi B ailesinin token'ını kaydedemez/silemez
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000c0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
delete from public.push_tokens;
reset role;
select is((select count(*)::int from public.push_tokens), 3, 'başka kullanıcı token silemez');

select is(
  (select count(*)::int from public.push_outbox where kind = 'task_awaiting_approval' and audience = 'parents'),
  1, 'art arda iki tik tek onay bildirimine birleşir'
);
select ok(
  (select bool_and(payload::text not like '%Gizli%' and payload ? 'completion_id') from public.push_outbox),
  'payload yalnız kimlik taşır, ad/başlık yok'
);
select is(
  (select array_agg(token order by token) from public.push_targets((select id from public.push_outbox where kind = 'task_awaiting_approval'))),
  array['apns-veli-1-token-yeni', 'fcm-veli-2-token'], 'onay bildirimi iki veliye gider, tablete gitmez'
);

-- Veli 1 onaylar: tablete bildirim; veli 2 iade eder
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select public.review_task((select id from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000b1'), true);
select public.review_task((select id from public.task_completions where template_id = '40000000-0000-0000-0000-0000000000b2'), false);

-- Deneme atanır
insert into public.exams (id, family_id, child_id, title, subject, grade, status, created_by)
values ('60000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b0', '20000000-0000-0000-0000-0000000000b1',
        'Gizli Deneme', 'Fen Bilimleri', 5, 'assigned', '00000000-0000-0000-0000-00000000b001');
reset role;

select is(
  (select array_agg(kind order by kind) from public.push_outbox where audience = 'device'),
  array['exam_assigned', 'task_approved', 'task_returned'], 'onay, iade ve atama tablete kuyruğa alınır'
);
select is(
  (select array_agg(token) from public.push_targets((select id from public.push_outbox where kind = 'task_approved'))),
  array['apns-tablet-token'], 'onay bildirimi aktif çocuğun tabletine gider'
);
select is(
  (select target_child_id from public.push_outbox where kind = 'exam_assigned'),
  '20000000-0000-0000-0000-0000000000b1'::uuid, 'atama hedef çocuğu taşır'
);

-- Cihaz denemeyi bitirir → velilere; veli 1 'exams' tercihini kapattı
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b0d1", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "device", "device_id": "30000000-0000-0000-0000-0000000000b1", "child_id": "20000000-0000-0000-0000-0000000000b1", "admin": false}}',
  true);
select public.finish_exam_attempt((select id from public.start_exam_attempt('60000000-0000-0000-0000-0000000000b1')));
reset role;

select is(
  (select count(*)::int from public.push_outbox where kind = 'exam_finished' and audience = 'parents'),
  1, 'deneme bitince velilere kuyruğa alınır'
);
select is(
  (select array_agg(token) from public.push_targets((select id from public.push_outbox where kind = 'exam_finished'))),
  array['fcm-veli-2-token'], 'tercihi kapalı veli elenir'
);

-- Eylemi yapan veli kendi bildirimini almaz (çocuk modunda veli tikler)
update public.push_outbox set status = 'sent';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated", "gina": {"family_id": "10000000-0000-0000-0000-0000000000b0", "role": "parent", "device_id": null, "child_id": null, "admin": false}}',
  true);
select public.complete_task('40000000-0000-0000-0000-0000000000b2', current_date, '70000000-0000-0000-0000-0000000000b3', '20000000-0000-0000-0000-0000000000b1');
reset role;
select is(
  (select array_agg(token) from public.push_targets((select id from public.push_outbox where status = 'pending' and kind = 'task_awaiting_approval'))),
  array['fcm-veli-2-token'], 'eylemi yapan veli elenir'
);

-- İptal edilen cihaz hedeften düşer
update public.devices set revoked_at = now() where id = '30000000-0000-0000-0000-0000000000b1';
select is(
  (select count(*)::int from public.push_targets((select id from public.push_outbox where kind = 'task_approved'))),
  0, 'iptal edilen tablete bildirim gitmez'
);

-- service_role claim'i
set local role service_role;
select is((select count(*)::int from public.push_claim_batch(10)), 1, 'service_role bekleyen satırı alır');

select * from finish();
rollback;
