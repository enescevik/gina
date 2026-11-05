-- Q03 düzeltme — RLS ve yetki hijyeni (Q03-DB-1, Q03-DB-2, Q03-DB-3).
-- Kaynak: docs/release/q03-2026-11-06/README.md §2 ve patches/proposed/20261106_q03_gina_rls_and_grant_hygiene.sql.
-- Uygulama davranışı değişmez: bu tabloların hiçbirine istemci doğrudan yazmaz (apps/ ve packages/ taraması:
-- .from('<tablo>').insert|update|delete|upsert yok); yazma yolu security definer RPC'lerdir (sahip postgres, RLS'ten
-- muaf). Kaldırılan grant'lerin tümü RLS politikası karşılığı olmayan, fiilen RLS tarafından reddedilen yetkilerdir.
-- Sayılar bu migration öncesi sıfırdan uygulanan 114 migration'ın matrisine göredir
-- (scripts/security/rls-matrix.py --run-local --fresh): RLS kapalı gina.* tablosu 15, politika karşılığı olmayan
-- authenticated yazma grant'i 50 (Q03 raporundaki 12/47'ye sonraki migration'lar 3 tablo + 3 grant ekledi).

-- Q03-DB-1: gina.* özel geçmiş/durum tablolarında RLS aç. anon/authenticated için tablo yetkisi yok (yalnız şema
-- USAGE), PostgREST gina şemasını sunmuyor; RLS savunma derinliğidir ve politika eklenmez: service_role ve tablo
-- sahibi (postgres; tüm RPC'ler security definer) RLS'ten muaftır, dolayısıyla hiçbir RPC akışı değişmez.
alter table gina.bulk_archive_items           enable row level security;
alter table gina.bulk_archive_runs            enable row level security;
alter table gina.child_archive_device_blocks  enable row level security;
alter table gina.child_archive_state          enable row level security;
alter table gina.child_education_changes      enable row level security;
alter table gina.child_education_periods      enable row level security;
alter table gina.child_education_state        enable row level security;
alter table gina.deletion_previews            enable row level security;
alter table gina.note_changes                 enable row level security;
alter table gina.override_commands            enable row level security;
alter table gina.reward_changes               enable row level security;
alter table gina.school_grade_changes         enable row level security;
alter table gina.store_reconcile_jobs         enable row level security;
alter table gina.store_replacements           enable row level security;
alter table gina.task_routine_changes         enable row level security;

-- Q03-DB-2: authenticated rolünde eşleşen RLS politikası olmayan doğrudan yazma yetkileri. Bunlar şema varsayılan
-- ayrıcalığından (grant all on tables) gelir; ilgili tabloda yalnız select politikası vardır, bu yüzden RLS her yazmayı
-- zaten reddeder ('new row violates row-level security policy'). Grant kaldırıldığında red 'permission denied' olur;
-- ikisi de SQLSTATE 42501, istemci sözleşmesi değişmez. Yalnız politikası olmayan komutlar kaldırılır; politikası olan
-- komutlar (ör. devices.update, families.update, family_members.delete, study_plans.delete) ve select dokunulmaz.
revoke insert, update, delete on public.admins                  from authenticated;
revoke insert, update, delete on public.ai_feature_requirements from authenticated;
revoke insert, update, delete on public.ai_summaries            from authenticated;
revoke insert, update, delete on public.child_badge_awards      from authenticated;
revoke insert, update, delete on public.child_goals             from authenticated;
revoke insert, update, delete on public.child_inventory         from authenticated;
revoke insert, delete         on public.devices                 from authenticated;
revoke insert, update, delete on public.exam_answers            from authenticated;
revoke insert, update, delete on public.exam_attempts           from authenticated;
revoke insert, delete         on public.families                from authenticated;
revoke insert, update         on public.family_members          from authenticated;
revoke insert, update, delete on public.prova_ai_usage          from authenticated;
revoke insert, update, delete on public.reward_requests         from authenticated;
revoke insert, update, delete on public.star_events             from authenticated;
revoke insert, update, delete on public.store_notifications     from authenticated;
revoke insert, update, delete on public.store_subscriptions     from authenticated;
revoke insert, update         on public.study_plans             from authenticated;
revoke insert, update, delete on public.task_completions        from authenticated;

-- Q03-DB-3: gina.* yardımcı fonksiyonları barındırılan Supabase'in varsayılan fonksiyon ayrıcalığıyla anon için
-- EXECUTE taşıyordu. anon'un gina şemasında USAGE yetkisi yoktur (fiilen çağrılamaz); açık revoke, geri yükleme
-- sonrası ACL kontrolünü (patches/proposed/post-restore-acl-check.sql) ve matrisi tutarlı kılar. authenticated
-- EXECUTE korunur: politikalar ve RPC'ler bu fonksiyonları çağıranın yetkisiyle kullanır.
revoke execute on function gina.claims()                      from public, anon;
revoke execute on function gina.role()                        from public, anon;
revoke execute on function gina.family_id()                   from public, anon;
revoke execute on function gina.child_id()                    from public, anon;
revoke execute on function gina.valid_review_document(jsonb)  from public, anon;
-- Açık grant'ler zaten 20261029200100_rls.sql ve 20261102200000_parent_answer_reviews.sql'de verilmiştir; burada
-- yinelenir ki revoke'un hemen ardından politika/RPC çağrıları için authenticated EXECUTE kesin kalsın.
grant execute on function gina.claims(), gina.role(), gina.family_id(), gina.child_id(), gina.valid_review_document(jsonb) to authenticated, service_role;
