-- ÖNERİ (uygulanmadı) — Q03 güvenlik denetimi, 6 Kasım 2026. docs/release/q03-2026-11-06/README.md
-- bulguları Q03-DB-1 ve Q03-DB-2. supabase/migrations altına taşınmadan önce izole DB'de
-- supabase/tests tamamı ve scripts/security/rls-matrix.py --fresh yeniden çalıştırılmalıdır.
--
-- Q03-DB-1 (düşük): gina.* özel geçmiş/durum tablolarının 12'sinde RLS kapalı. Bugün anon/authenticated
-- için tablo yetkisi yok (schema usage var, tablo grant yok); erişim yalnız security definer RPC'lerle.
-- Savunma derinliği için RLS açılır; politika eklenmez (service_role ve tablo sahibi RLS'ten muaftır).
alter table gina.child_archive_device_blocks enable row level security;
alter table gina.child_archive_state          enable row level security;
alter table gina.child_education_changes      enable row level security;
alter table gina.child_education_periods      enable row level security;
alter table gina.child_education_state        enable row level security;
alter table gina.note_changes                 enable row level security;
alter table gina.override_commands            enable row level security;
alter table gina.reward_changes               enable row level security;
alter table gina.school_grade_changes         enable row level security;
alter table gina.store_reconcile_jobs         enable row level security;
alter table gina.store_replacements           enable row level security;
alter table gina.task_routine_changes         enable row level security;

-- Q03-DB-2 (düşük): authenticated rolünde eşleşen RLS politikası olmayan doğrudan yazma yetkileri.
-- RLS bu yazmaları zaten reddeder (izole DB'de admins/devices insert denemesi 'violates row-level
-- security policy' ile reddedildi). Grant'ler niyeti bulanıklaştırır; politika eklenirse sessizce
-- açılır. Yazma yolu RPC olan tablolarda doğrudan yetki kaldırılır.
revoke insert, update, delete on public.admins              from authenticated;
revoke insert, update, delete on public.ai_summaries        from authenticated;
revoke insert, update, delete on public.child_badge_awards  from authenticated;
revoke insert, update, delete on public.child_goals         from authenticated;
revoke insert, update, delete on public.child_inventory     from authenticated;
revoke insert, delete         on public.devices             from authenticated;
revoke insert, update, delete on public.exam_answers        from authenticated;
revoke insert, update, delete on public.exam_attempts       from authenticated;
revoke insert, delete         on public.families            from authenticated;
revoke insert, update         on public.family_members      from authenticated;
revoke insert, update, delete on public.prova_ai_usage      from authenticated;
revoke insert, update, delete on public.reward_requests     from authenticated;
revoke insert, update, delete on public.star_events         from authenticated;
revoke insert, update, delete on public.store_notifications from authenticated;
revoke insert, update, delete on public.store_subscriptions from authenticated;
revoke insert, update         on public.study_plans         from authenticated;
revoke insert, update, delete on public.task_completions    from authenticated;
-- Dikkat: istemci bu tablolara doğrudan yazıyorsa (RLS politikası olmadığı için bugün zaten
-- başarısız olur) RPC yolu kullanılmalıdır. Uygulama öncesi apps/mobile ve apps/backoffice'te
-- `.from('<tablo>').insert|update|delete` çağrıları taranmalıdır.

-- Q03-DB-3 (bilgi): gina.claims(), gina.role(), gina.family_id(), gina.child_id(), gina.valid_review_document(jsonb)
-- barındırılan Supabase'in varsayılan fonksiyon ayrıcalığıyla anon için EXECUTE taşır. anon'un gina
-- şemasında USAGE yetkisi olmadığı için fiilen çağrılamaz; yine de açık revoke tutarlılık sağlar.
revoke execute on function gina.claims(), gina.role(), gina.family_id(), gina.child_id(), gina.valid_review_document(jsonb) from public, anon;
