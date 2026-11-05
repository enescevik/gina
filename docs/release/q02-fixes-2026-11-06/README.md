# Q02 düzeltmeleri — 2026-11-06 gecesi

**Durum: KOD HAZIR, ÜRETİME UYGULANMADI.** Üretim Supabase'e bağlanılmadı; hiçbir hosted projeye migration gönderilmedi. Tüm kanıt yerel Docker'daki izole, boş klon veritabanlarında üretildi (`gina_completion_audit` şablonu; uygulamanın yerel/demo DB'sine `db reset` yapılmadı).

- Dal: `worktree-agent-ac5fc98321f5826c4` (main `7066de1` üzerine; main'e push edilmedi).
- Migration: `supabase/migrations/20261106130000_rls_initplan_and_indexes.sql`
- pgTAP: `supabase/tests/100_q02_fixes_rls_initplan.test.sql` (47 assertion)
- Kaynak bulgular: `docs/release/q02-2026-11-06/README.md` §4 — Q02-1, Q02-2, Q02-5, Q02-8 ve gece bulunan Q02-10.

| İş | Öncelik | Sonuç |
| --- | --- | --- |
| Q02-1 RLS satır başına yardımcı fonksiyon değerlendirmesi | Yüksek | 101/110 politika aynı ad/rol/komut/tür ve aynı mantıkla `(select f())` InitPlan biçimine alındı; 271 çağrı; normalize edilmiş metin eskisiyle **birebir** (`policy-equivalence.json`). Çocuk yıldız defteri REST p50 130,7 → 16,1 ms; EXPLAIN `child_star_balance_sum` 1225 → 171 ms, 2964 → 682 blok. |
| Q02-2 eksik indexler | Orta | `star_events_family_idx`, `task_templates_family_idx`, `task_templates_child_sort_idx (child_id, sort_order)` (kısmi `where active` index'in yerine), `exams_family_created_idx (family_id, created_at desc)`. Planlayıcı 250 satırda `task_templates_family_idx` ve `task_templates_child_sort_idx`'i seçti. |
| Q02-10 pgTAP saat dilimi flake'i (21:00–24:00 UTC) | Test altyapısı | 083/088 transaction içinde `set local time zone 'Europe/Istanbul'`; `test-q02-sql.py` klon DB'yi aile saat dilimine alır (`--timezone`); CI pgTAP adımı yerel DB'yi hizalar. Pencere içinde (21:23–21:33 UTC) UTC oturumunda **önce düşen, sonra geçen** koşu kaydedildi. |
| Q02-5 `revoke_device` sözleşmesi | Düşük | Yabancı/olmayan cihaz → `device_not_found` (P0001); zaten iptal edilmiş kendi cihazı idempotent; sahte claim → `forbidden` (42501). UI değişmedi (not aşağıda). |
| Q02-8 `auth.users` DELETE yetkisi (Q03'e devir) | Düşük | `scripts/security/check-auth-delete-privilege.sql` salt okunur kontrol betiği; yerel gerçek stack'te 8/8 `ok`. |

## 1. Q02-1 — RLS politikalarında InitPlan

### Neden

`gina.is_device()` her satırda `devices` + `device_allows()` alt sorgularını, `gina.is_parent()` `family_members`/`active_families` sorgularını çalıştırıyordu. Postgres bir `stable` fonksiyonu politikada çıplak çağrıldığında satır başına değerlendirir; `(select f())` skaler alt sorgu biçiminde ise plan **InitPlan** olur ve istek başına bir kez hesaplanır. Fonksiyon `stable` olduğu için aynı istek içinde sonuç satırdan bağımsızdır; politika anlamı değişmez.

### Nasıl üretildi ve doğrulandı

1. Tüm migration'lar (main `7066de1` + M01 `20261106010000`) izole klon DB'ye uygulandı; `pg_policies` (deparse edilmiş `qual`/`with_check`) okundu.
2. 110 public politikadan 101'inde çıplak yardımcı çağrısı vardı (`gina.family_id()` 72, `is_parent()` 55, `is_device()` 22, `is_admin_strict()` 17, `child_id()` 17, `is_admin()` 15, `auth.uid()` 9, `claims()` 1 politika). Kalan 9'u `using (true)`.
3. Migration metni bu çıktıdan üretildi: `drop policy` + `create policy` aynı ad, `to authenticated`, aynı `for <cmd>`, `as restrictive` korunarak (6 restrictive), yalnız çağrılar `(select …)` içine alındı. Dosya gözle okundu (ör. `children_device_select` içinde `gina.device_allows(((select gina.claims()) ->> 'device_id')::uuid, id)` — argümanlı, satıra bağlı `device_allows` sarılmadı).
4. Yeniden uygulanan şemada `pg_policies` tekrar okundu; `( SELECT f() AS f)` sarmalayıcısı regex ile soyulup eski metinle karşılaştırıldı: **110/110 politika, 0 fark; 271 çıplak çağrı → 0, 271 InitPlan sarmalı** (`policy-equivalence.json`).
5. Yardımcılar zaten `stable` (claims, family_id, role, child_id, is_admin, is_admin_strict, is_parent, is_device, is_service); is_parent/is_device/is_admin/is_admin_strict `security definer`. Değişiklik gerekmedi; pgTAP 100 bunu assert eder.
6. pgTAP 100 `explain (format json)` ile veli ve cihaz rolünde yıldız defteri/görev listesi planlarının `InitPlan` içerdiğini doğrular; migration'sız DB'de bu assertion'lar düşer (negatif kanıt, §5).

### Politika envanteri (101; P = permissive, R = restrictive)

| Tablo | Politika | Komut | Tür | Sarmalanan çağrılar |
| --- | --- | --- | --- | --- |
| admins | admins_select_self | SELECT | P | auth.uid |
| ai_feature_requirements | ai_feature_requirements_admin | SELECT | P | is_admin_strict |
| ai_models | ai_models_admin_all | ALL | P | is_admin_strict |
| ai_operation_policies | ai_policy_admin | ALL | P | is_admin_strict |
| ai_providers | ai_providers_admin | ALL | P | is_admin_strict |
| ai_settings | ai_settings_admin_all | ALL | P | is_admin_strict |
| ai_summaries | ai_summaries_parent_select | SELECT | P | family_id, is_parent |
| answer_review_suggestions | review_suggestion_parent | SELECT | P | family_id, is_parent |
| app_settings | app_settings_admin_strict | ALL | R | is_admin, is_admin_strict |
| app_settings | app_settings_admin_write | ALL | P | is_admin |
| audit_log | audit_log_admin_select | SELECT | P | is_admin_strict |
| badge_definitions | badge_definitions_parent_write | ALL | P | family_id, is_parent |
| badge_definitions | badge_definitions_select | SELECT | P | family_id |
| child_badge_awards | child_badge_awards_device_select | SELECT | P | child_id, family_id, is_device |
| child_badge_awards | child_badge_awards_parent_select | SELECT | P | family_id, is_parent |
| child_goals | child_goals_device_select | SELECT | P | child_id, family_id, is_device |
| child_goals | child_goals_parent_select | SELECT | P | family_id, is_parent |
| child_inventory | child_inventory_device_select | SELECT | P | child_id, family_id, is_device |
| child_inventory | child_inventory_parent_select | SELECT | P | family_id, is_parent |
| child_room_preferences | child_room_preferences_device_select | SELECT | P | family_id, is_device |
| child_room_preferences | child_room_preferences_parent_all | ALL | P | family_id, is_parent |
| child_shares | child_shares_parent_delete | DELETE | P | family_id, is_parent |
| child_shares | child_shares_parent_select | SELECT | P | family_id, is_parent |
| children | children_device_select | SELECT | P | claims, family_id, is_device |
| children | children_parent_all | ALL | P | family_id, is_parent |
| contribution_rewards | rewards_admin | ALL | P | is_admin_strict |
| devices | devices_parent_select | SELECT | P | family_id, is_parent |
| devices | devices_parent_update | UPDATE | P | family_id, is_parent |
| devices | devices_self_select | SELECT | P | auth.uid |
| entitlement_overrides | entitlement_overrides_admin_all | ALL | P | is_admin |
| entitlement_overrides | entitlement_overrides_admin_strict | ALL | R | is_admin, is_admin_strict |
| entitlement_overrides | entitlement_overrides_parent_select | SELECT | P | family_id, is_parent |
| event_exceptions | event_exceptions_device_select | SELECT | P | family_id, is_device |
| event_exceptions | event_exceptions_parent_all | ALL | P | family_id, is_parent |
| events | events_device_select | SELECT | P | child_id, family_id, is_device |
| events | events_parent_all | ALL | P | family_id, is_parent |
| exam_answers | exam_answers_parent_select | SELECT | P | family_id, is_parent |
| exam_attempts | exam_attempts_device_select | SELECT | P | child_id, family_id, is_device |
| exam_attempts | exam_attempts_parent_select | SELECT | P | family_id, is_parent |
| exam_blueprints | exam_blueprints_parent_all | ALL | P | family_id, is_parent |
| exams | exams_device_select | SELECT | P | child_id, family_id, is_device |
| exams | exams_parent_all | ALL | P | family_id, is_parent |
| families | families_select | SELECT | P | family_id, is_device, is_parent |
| families | families_update_parent | UPDATE | P | family_id, is_parent |
| family_members | family_members_delete_self | DELETE | P | auth.uid |
| family_members | family_members_select | SELECT | P | family_id, is_parent |
| family_rewards | family_rewards_device_select | SELECT | P | child_id, family_id, is_device |
| family_rewards | family_rewards_parent_all | ALL | P | family_id, is_parent |
| family_room_settings | family_room_settings_parent | ALL | P | family_id, is_parent |
| family_room_settings | family_room_settings_read | SELECT | P | child_id, family_id, is_device, is_parent |
| grades | grades_parent_context | UPDATE | P | family_id, is_parent |
| grades | grades_parent_insert | INSERT | P | family_id, is_parent |
| grades | grades_parent_read | SELECT | P | family_id, is_parent |
| guided_input_options | guided_options_admin_read | SELECT | P | is_admin_strict |
| holidays | holidays_admin_strict | ALL | R | is_admin, is_admin_strict |
| holidays | holidays_admin_write | ALL | P | is_admin |
| learning_credit_grants | credit_read | SELECT | P | family_id, is_admin_strict, is_parent |
| learning_source_sets | source_sets_parent_read | SELECT | P | family_id, is_parent |
| learning_sources | source_parent_read | SELECT | P | family_id, is_parent |
| library_collections | catalog_admin | ALL | P | is_admin_strict |
| note_sync | note_sync_read | SELECT | P | auth.uid, family_id, is_parent |
| notes | notes_device_insert | INSERT | P | child_id, family_id, is_device |
| notes | notes_device_select | SELECT | P | child_id, family_id, is_device |
| notes | notes_device_update_own | UPDATE | P | child_id, family_id, is_device |
| notes | notes_parent_insert | INSERT | P | auth.uid, family_id, is_parent |
| notes | notes_parent_select | SELECT | P | auth.uid, family_id, is_parent |
| plan_products | plan_products_admin_strict | ALL | R | is_admin, is_admin_strict |
| plan_products | plan_products_admin_write | ALL | P | is_admin |
| plans | plans_admin_strict | ALL | R | is_admin, is_admin_strict |
| plans | plans_admin_write | ALL | P | is_admin |
| prova_ai_usage | prova_ai_usage_admin_select | SELECT | P | is_admin |
| prova_ai_usage | prova_ai_usage_parent_select | SELECT | P | family_id, is_parent |
| prova_drafts | prova_draft_parent_read | SELECT | P | family_id, is_parent |
| push_preferences | push_preferences_own | ALL | P | auth.uid, family_id, is_parent |
| push_tokens | push_tokens_own_delete | DELETE | P | auth.uid |
| push_tokens | push_tokens_own_select | SELECT | P | auth.uid |
| question_bank | question_bank_admin_all | ALL | P | is_admin |
| question_bank | question_bank_admin_strict | ALL | R | is_admin, is_admin_strict |
| question_bank | question_bank_global_select | SELECT | P | is_admin, is_parent |
| question_bank | question_bank_parent_all | ALL | P | family_id, is_parent |
| question_contributions | contribution_read | SELECT | P | family_id, is_admin_strict, is_parent |
| question_source_groups | question_group_parent_read | SELECT | P | family_id, is_parent |
| question_source_members | question_member_parent_read | SELECT | P | family_id, is_parent |
| reward_catalog_sync | reward_catalog_sync_read | SELECT | P | family_id, is_device, is_parent |
| reward_requests | reward_requests_device_select | SELECT | P | child_id, family_id, is_device |
| reward_requests | reward_requests_parent_select | SELECT | P | family_id, is_parent |
| school_grade_sync | school_grade_sync_parent | SELECT | P | family_id, is_parent |
| school_timetables | school_timetables_read | SELECT | P | child_id, family_id, is_device, is_parent |
| star_events | star_events_device_select | SELECT | P | child_id, family_id, is_device |
| star_events | star_events_parent_select | SELECT | P | family_id, is_parent |
| store_notifications | store_notifications_admin_select | SELECT | P | is_admin |
| store_subscriptions | store_subscriptions_parent_select | SELECT | P | family_id, is_parent |
| study_plan_calendar_items | plan_calendar_parent_read | SELECT | P | family_id, is_parent |
| study_plans | study_plans_parent_delete | DELETE | P | family_id, is_parent |
| study_plans | study_plans_parent_select | SELECT | P | family_id, is_parent |
| task_completions | task_completions_device_select | SELECT | P | child_id, family_id, is_device |
| task_completions | task_completions_parent_select | SELECT | P | family_id, is_parent |
| task_routine_sync | task_routine_sync_read | SELECT | P | child_id, family_id, is_device, is_parent |
| task_templates | task_templates_device_select | SELECT | P | child_id, family_id, is_device |
| task_templates | task_templates_parent_all | ALL | P | family_id, is_parent |
| timetable_imports | timetable_import_parent | SELECT | P | family_id, is_parent |

## 2. Q02-2 — Indexler

| Index | Gerekçe (Q02 `perf.json` → `index_candidates`) |
| --- | --- |
| `star_events_family_idx (family_id)` | Veli ana ekranı `star_events where family_id=?`: 400 satır seq scan; yalnız `(child_id, created_at)` vardı. |
| `task_templates_family_idx (family_id)` | Veli ana ekranı `task_templates where family_id=?`: 250 satır seq scan. |
| `task_templates_child_sort_idx (child_id, sort_order)` | Veli görev ekranı duraklatılmışları da okur (`child_id=? order by sort_order`); kısmi `task_templates_child_idx (child_id) where active` bunu kapsamıyordu. Tam index aktifleri de kapsadığı için kısmi index **kaldırıldı**; aynı amaçlı çift index tutulmadı. |
| `exams_family_created_idx (family_id, created_at desc)` | Prova listesi RLS `family_id` + `order by created_at desc limit 100`. |

Üretim notu: migration tek transaction'da koşar, `create index concurrently` orada çalışmaz. Üretim tabloları küçüktür (aile başına yüzlerce satır), kilit süresi kısa. Tablo büyümüşse yayın adımı: migration'daki dört `create index` satırını yayın öncesi `psql` ile `create index concurrently if not exists …` olarak ayrıca çalıştır; migration `if not exists` ile atlar.

Planlayıcı seçimi (izole DB, 250/400 satır): `home_task_templates_by_family` → `task_templates_family_idx`; `tasks_screen_templates_by_child` → `task_templates_child_sort_idx`; `star_events`/`exams` bu hacimde hâlâ seq scan (beklenen; Q02 notu "bu hacimde seq scan üretimi öngörmez").

## 3. Önce / sonra ölçümü

Ortam: `scripts/test-q02-perf.py --run-local` (Q02'nin kendi koşucusu, değiştirilmedi), geçici yerel Auth+PostgREST + izole klon DB, bu Mac'te Docker Desktop. **Mutlak değerler üretim gecikmesi değildir**; aynı makinede aynı tohumla (250 görev, 300 tamamlama, 400 yıldız, 220 not, 27 Prova) art arda ölçüldü. Önce = migration'sız (`perf-before.json`, 21:26 UTC), sonra = migration'lı (`perf-after.json` 21:40 UTC; `perf-after-2.json` tekrar).

| Sorgu (REST/RPC, 15 tekrar) | Satır | Önce p50 / p95 ms | Sonra-1 p50 / p95 ms | Sonra-2 p50 / p95 ms |
| --- | --- | --- | --- | --- |
| `home_task_templates_by_family` | 250 | 88.8 / 176.6 | 50.2 / 105.8 | 29.1 / 47 |
| `home_task_completions_week_by_family` | 28 | 11.9 / 15.5 | 29.9 / 66.8 | 25.3 / 49.4 |
| `home_star_events_by_family` | 400 | 93.8 / 119 | 27.4 / 153.7 | 23.9 / 54.5 |
| `home_approvals_done_by_family` | 43 | 66.7 / 177.2 | 29.7 / 92.4 | 31.6 / 41.7 |
| `tasks_screen_templates_by_child` | 220 | 115.3 / 197.2 | 27.3 / 108.2 | 33.2 / 56.9 |
| `child_today_templates_active` | 198 | 189.4 / 270.3 | 26.8 / 38.8 | 26.6 / 36.4 |
| `child_star_events_by_child` | 300 | 130.7 / 294 | 16.1 / 27.6 | 21 / 41.6 |
| `rpc_school_grade_records_all_page1` | 50 | 10.4 / 12.8 | 28.5 / 44.5 | 31.9 / 46.8 |
| `prova_list_exams_with_attempts_limit100` | 27 | 21.8 / 39.5 | 61 / 107 | 54.4 / 102.9 |
| `sources_ready_documents_all` | 50 | 16.1 / 20.5 | 32.7 / 57.4 | 28 / 86.6 |
| `rpc_get_saved_exam_answers_v3_device` | 20 | 51 / 74.6 | 159.9 / 326 | 256.7 / 579.2 |
| `rpc_submit_exam_answer_v3_drawn_10_strokes` | 1 | 27.2 / 55.2 | 55.3 / 119.7 | 59.8 / 136 |

| EXPLAIN (ANALYZE, BUFFERS), rol `authenticated`, izole DB | Önce ms / shared hit | Sonra-1 ms / shared hit | Sonra-2 ms / shared hit | Sonra tarama |
| --- | --- | --- | --- | --- |
| `home_task_templates_by_family` | 106.14 / 893 | 89.58 / 246 | 14.21 / 243 | idx: task_completions_child_date_idx, task_templates_family_idx; seq: - |
| `home_task_completions_week_by_family` | 44.22 / 226 | 20.65 / 248 | 13.24 / 245 | idx: -; seq: task_completions |
| `home_star_events_by_family` | 272.63 / 1343 | 11.95 / 245 | 5 / 242 | idx: -; seq: star_events |
| `home_approvals_done_by_family` | 39.84 / 279 | 4.91 / 249 | 5.4 / 246 | idx: task_completions_pending_idx; seq: - |
| `tasks_screen_templates_by_child` | 98.65 / 806 | 6.89 / 460 | 13.78 / 457 | idx: task_completions_child_date_idx, task_templates_child_sort_idx; seq: - |
| `child_star_balance_sum` | 1225.22 / 2964 | 171.06 / 682 | 80.62 / 663 | idx: -; seq: star_events |
| `sources_ready_documents_limit30` | 27.14 / 233 | 2.42 / 239 | 4.34 / 236 | idx: -; seq: learning_sources |
| `prova_list_exams_limit100` | 24.45 / 229 | 2.12 / 250 | 4.81 / 247 | idx: -; seq: exams |
| `prova_list_attempts_for_exams` | 26.76 / 257 | 5.62 / 251 | 4.68 / 248 | idx: -; seq: exam_attempts, exams |
| `review_exam_answers_by_attempt` | 24.02 / 299 | 7.39 / 245 | 7.21 / 242 | idx: exam_answers_pkey; seq: exam_attempts |
| `rpc_school_grade_records_all_page1` | 58.27 / 1127 | 92.44 / 1196 | 30.44 / 1157 | idx: -; seq: - |
| `rpc_learning_progress_30d` | 34.89 / 2531 | 108.08 / 2583 | 24.45 / 2555 | idx: -; seq: - |
| `rpc_get_saved_exam_answers_v3_device` | 36.43 / 1339 | 53.03 / 1358 | 45.9 / 1341 | idx: -; seq: - |
| `grades_child_all_direct` | 74.2 / 808 | 7.66 / 242 | 3.93 / 239 | idx: -; seq: grades |

Ölçüm zamanları (UTC): önce 2026-11-05T21:26:16.125Z, sonra-1 2026-11-05T21:40:59.639Z, sonra-2 2026-11-05T21:44:05.705Z. Tohum satırları: exam_answers 20, exam_attempts 1, task_completions 300, exams 27, question_bank 20, grades 220, learning_sources 50, mutation_receipts 75, star_events 400, task_templates 250, help_receipts 0.

Kontrol ölçümü **önce-2** (`perf-before-2.json`, 21:53 UTC, migration dosyası geçici olarak kaldırılarak aynı koşucu): ortam gece ilerledikçe belirgin yavaşladı — RLS'siz RPC'ler de 2–4 kat daha yavaş (`rpc_school_grade_records` p50 92,6 ms, `prova_list` 99,2, `sources_ready_documents_all` 142,2, `rpc_get_saved_exam_answers_v3` 250,3), RLS'li okumalar ise çok daha kötü (`child_star_events_by_child` 644,5 / 923,5 ms, `child_today_templates_active` 720,9 / 1453,2 ms; EXPLAIN `child_star_balance_sum` 664 ms / 2960 blok). Yani "sonra" tablolarındaki `rpc_*` artışları Docker ortam kaymasıdır; aynı anda alınan RLS'li satırlar 20–40 kat fark gösterir.

Okuma: RLS'nin domine ettiği okumalar (çocuk yıldız defteri, çocuk bugün listesi, veli görev ekranı, veli yıldız toplamı) 4–8 kat hızlandı ve okunan blok sayısı 3–5 kat düştü (`is_device()` alt sorguları artık satır başına koşmuyor). `rpc_*` satırlarındaki artışlar RLS'den bağımsız SECURITY DEFINER fonksiyonlardır; önce-2 kontrolü bunların ortam kayması olduğunu gösterir (EXPLAIN shared hit blokları önce/sonra aynı: 1127→1196→1157, 1339→1358→1341). Regresyon kanıtı değil; üretimde `pg_stat_statements` ile izlenmeli.

## 4. Q02-10 — pgTAP saat dilimi

Bulgu (koordinatör, 00:15 TR): 083/088 `current_date` ile `change_school_grade`/`transfer_education_period_items`'a "bugün" veriyor; fonksiyonlar aile saat diliminde (Europe/Istanbul) gün hesaplıyor. Oturum UTC iken 21:00–24:00 UTC arasında UTC günü bir gün geridedir → `school_grade_changed`, `copy starts in the new period` gibi yanlış negatifler.

Yeniden üretim (bu gece, pencere içinde): 21:23 UTC, migration'lı klon DB, `set time zone 'UTC'`: 083 `school_grade_changed` ile durdu, 088 3/81 başarısız; `set time zone 'Europe/Istanbul'`: 127/127 geçti.

Düzeltme — üç katman, migration'a dokunulmadı:

| Katman | Değişiklik | Kapsam |
| --- | --- | --- |
| Test dosyası | `083`, `088`: `begin; select no_plan();` sonrasında `set local time zone 'Europe/Istanbul';` (transaction'a bağlı, `rollback` ile biter). | **Her koşucu** (CI `supabase test db`, 38 harness, elle psql). Yalnız gerçekten tarihe duyarlı iki dosya değişti; 90+ dosya elden geçirilmedi. |
| Harness | `scripts/test-q02-sql.py`: klon oluşturulunca `alter database … set timezone to 'Europe/Istanbul'` (`--timezone UTC` ile eskisi gibi koşulabilir), `--out <dizin>`. `CREATE DATABASE … TEMPLATE` DB düzeyi ayarları kopyalamadığı için şablona değil klona yazılır; uygulamanın yerel DB'sine dokunmaz. | Tam pgTAP koşucusu |
| CI | `ci.yml` db işi: `supabase db start` sonrası `psql … -c "alter database postgres set timezone to 'Europe/Istanbul'"`, sonra `supabase test db`. `supabase/config.toml` `[db.settings]` timezone anahtarı tanımadığı için psql adımı seçildi. | GitHub Actions |

Kanıt: `sql-checks-utc.json` (UTC oturumu, 22:xx UTC, tüm dosyalar) ve `sql-checks-istanbul.json` — §5.

Kalan sınır: Oturumu aile saat dilimine almak, fonksiyonların kendi içinde `current_date`'i yanlışlıkla oturum saat diliminde kullanmasını da gizler; üretim DB UTC'dir. Bu yüzden 083/088 düzeltmesi dosya içinde açık yorumla yapıldı ve harness `--timezone UTC` ile eski davranışı istenirse koşturabilir.

## 5. Test çıktıları (gerçek koşular)

Tümü izole klon DB'de, migration'lar main `7066de1` + bu dalın `20261106130000`'i ile. Komutlar ve ham çıktılar:

| Koşu | Komut | Sonuç |
| --- | --- | --- |
| Tam pgTAP, aile saat dilimi | `python3 scripts/test-q02-sql.py --run-local --out docs/release/q02-fixes-2026-11-06/tz-istanbul` | **97 dosya, 3324 assertion, 0 hata** (`tz-istanbul/sql-checks.json`; 083: 46, 088: 81, 100: 47) |
| Tam pgTAP, UTC oturumu (pencere içinde, bitiş 21:50 UTC) | `python3 scripts/test-q02-sql.py --run-local --timezone UTC --out docs/release/q02-fixes-2026-11-06/tz-utc` | **97 dosya, 3324 assertion, 0 hata** (`tz-utc/sql-checks.json`) |
| Q02-10 yeniden üretim (düzeltme öncesi, 21:23 UTC, `set time zone 'UTC'`) | 083 + 088 | 083 `ERROR: school_grade_changed` (change_school_grade satır 14), 088 `not ok 35/36/66`, 3/81 başarısız |
| Q02-10 düzeltme sonrası (21:33 UTC, `set time zone 'UTC'`) | 083 + 088 | 127/127 geçti |
| Q02-10 karşı kanıt (21:24 UTC, `set time zone 'Europe/Istanbul'`, düzeltme öncesi) | 083 + 088 | 127/127 geçti |
| Migration'lı DB, düzeltme öncesi tüm pgTAP (varsayılan UTC, 21:28 UTC) | `runtap` (scratch) | 93 dosya, 2968 assertion; yalnız 083/088 Q02-10 hataları → RLS yeniden yazımı başka hiçbir testi kırmadı |
| pgTAP 100, migration'lı | `--only 100` | 47/47 |
| pgTAP 100, **migration'sız** temel DB (negatif kanıt) | `runtap` (scratch) | 14 başarısız / 47: InitPlan (4, 5, 21, 22, 36), index (8–14), revoke (41, 42); **33 yetki-matrisi assertion'ının hepsi aynı sonuçla geçti** → veli/cihaz/yabancı aile/sahte claim matrisi değişmedi |
| Politika denkliği | `verify_policies` (scratch) → `policy-equivalence.json` | 110 = 110 politika; qual/with_check/komut/rol/tür 0 fark; 271 çıplak → 0, 271 InitPlan |
| Perf önce/sonra | `python3 scripts/test-q02-perf.py --run-local` ×3 (+ önce-2) | §3 tabloları; `perf-before.json`, `perf-after.json`, `perf-after-2.json`, `perf-before-2.json` |
| `pnpm --filter @gina/core test` | — | **312 geçti** (16,5 s) |
| `scripts/test-e2e-family-chain.py --run-local` | — | **296/296 kontrol geçti** (`chain-details-after.json`); `notes.foreign_revoke_device_response` artık `error: device_not_found` kaydediyor (önce `null`), `foreign_revoke_device_has_no_effect` geçmeye devam etti |
| `scripts/security/check-auth-delete-privilege.sql` | yerel gerçek stack `postgres` DB, salt okunur | 8/8 `ok` (klonda 1 bilinen artefakt, §6) |

CI (`.github/workflows/ci.yml` db işi) bu dalda GitHub'da **çalıştırılmadı** (push yok); adım yerel `psql` ile aynı komut biçiminde doğrulandı (`alter database … set timezone` klon DB'de uygulanıp 97 dosya geçti).

## 6. Q02-5 ve Q02-8

- `revoke_device`: `update … where id=p_device_id and family_id=gina.family_id()` sonrası `if not found then raise exception 'device_not_found'`. Önceki davranış: sessiz `null` (Q02 `chain-details.json → notes.foreign_revoke_device_response`). İstemci: `apps/mobile/src/app/parent/menu.tsx` `revokeDevice` mutation'ı hatayı fırlatır ve `ErrorText` ile gösterir (`revokeDevice.error`); liste yalnız kendi ailesinin cihazlarını içerdiği ve zaten iptal edilmiş cihaz idempotent kaldığı için akışta yeni hata görünmesi beklenmez. UI değiştirilmedi; `device_not_found` için özel TR/EN metin istenirse U-paketine not. `scripts/test-e2e-family-chain.mjs` `foreign_revoke_device_has_no_effect` kontrolü hatayı yalnız kaydeder (`notes`), bu yüzden geçmeye devam eder.
- `scripts/security/check-auth-delete-privilege.sql`: `begin read only` içinde 8 katalog kontrolü (postgres DELETE/SELECT, supabase_auth_admin DELETE, iki tetikleyicinin kurulu/etkin olması, iki fonksiyonun SECURITY DEFINER + sahibi postgres, uygulama rollerinin execute yetkisi olmaması). Yerel gerçek stack (`postgres` DB, salt okunur): 8/8 `ok`. Klon DB'de `supabase_auth_admin has DELETE` FAIL — Q02-8'de anlatılan "OWNER değişimi ACL'yi siler" klon artefaktı (`auth.users` sahibi klonda `postgres`, gerçek stack'te `supabase_auth_admin`); üretimde beklenmez, Q03 bunu doğrular.

## 7. Üretime uygulama ve kalan sınır

- **Uygulanmadı.** Yayın adımı: `supabase db push` ile `20261106130000` (önce `20261106120000` dahil main migration'ları). Politikalar `drop`+`create` ile yeniden yazıldığı için migration transaction'ı tabloların ACCESS EXCLUSIVE kilidini kısa süre alır; düşük trafik saatinde uygula.
- Perf sayıları yerel Docker'dandır; üretimde `pg_stat_statements` ile `star_events`/`task_templates` okumaları yayın sonrası kıyaslanmalı.
- `auth.uid()` çağrıları da sarıldı (Supabase'in resmi önerisi); `gina.device_allows(uuid,uuid)` satıra bağlı olduğu için sarılmadı.
- Gelecek migration'lar yeni politika yazarken `(select gina.is_parent())` desenini kullanmalı; pgTAP 100 "çıplak çağrı = 0" assertion'ı bunu bekçi olarak tutar (yeni politika çıplak yazılırsa CI düşer).
- Q02-10: üretim DB UTC kalır; yalnız test DB/oturumları hizalandı. Fonksiyonların oturum saat dilimine bağımlı olmadığı ayrıca denetlenmedi (Q03/Q04 adayı: `current_date`/`now()::date` kullanan fonksiyon taraması).
- Çalışılmayan Q02 bulguları: Q02-4 (çizim belgeleri tek yanıtta), Q02-7 (kaynak seçici limit 30), Q02-9 — açık. Q02-3 ve Q02-6 ikinci turda yapıldı (§8).

## 8. Q02-3 ve Q02-6 (ikinci tur)

**Durum: KOD HAZIR, İZOLE TEST EDİLDİ, ÜRETİME UYGULANMADI.** Dal `worktree-agent-af50f629d5929ec48` (main `eeb57af` üzerinde, push yok). Migration `supabase/migrations/20261106170000_star_balance_and_child_delete.sql`, pgTAP `supabase/tests/103_star_balance_and_child_delete.test.sql` (47 assertion).

### Q02-3 — sunucu tarafı yıldız bakiyesi

- `public.child_star_balance(p_child_id uuid, p_day date default null) → {child_id, balance, today, today_delta}`: SECURITY DEFINER, stable. Yetki: aynı ailenin velisi **veya** o çocuğa atanmış cihaz (`gina.is_device()` ve `child_id = gina.child_id()` — `star_events_device_select` ile aynı kural; claim tek başına yetmez). Yabancı/olmayan/null çocuk → 42501 `forbidden` (varlık sızmaz). `today_delta`: ailenin saat diliminde `p_day` (verilmezse ailenin bugünü) günündeki hareketlerin toplamı — istemcinin eski `localDateOf(created_at, tz) === today` toplamıyla aynı.
- `public.family_star_balances() → table(child_id, balance)`: yalnız veli; hareketi olmayan çocuk satır döndürmez (istemcide eskisi gibi 0).
- Mobil: `apps/mobile/src/lib/use-child-today.ts` `child_star_balance(childId, today)` okur (sorgu anahtarı `["star_events", childId, today]`: mevcut realtime/yenileme anahtarları önek eşleşmesiyle geçerli); `apps/mobile/src/app/parent/index.tsx` `family_star_balances` okur ve aynı `Map<child_id, toplam>` şeklini üretir (core `starTotalsByChild`). Görünüm aynı; artık tüm defter aktarılmıyor. Core: `readChildStarBalance`, `starTotalsByChild` (+ `stars.test.ts`), `database.types.ts`'e iki RPC.
- Performans ölçümü bu turda yeniden yapılmadı (yalnız aktarılan satır sayısı defter boyundan çocuk sayısına indi).

### Q02-6 — `children` doğrudan DELETE kapatıldı

- `children_parent_all for all` → `children_parent_select` / `children_parent_insert` / `children_parent_update` (aynı InitPlan koşulu); **DELETE politikası yok**, ayrıca `revoke delete on public.children from anon, authenticated` (REST silmesi 0 satır yerine açık 42501). Kalıcı silme yalnız `deletion_preview` + `confirm_child_deletion` (makbuz, önizleme parmak izi) ve hesap/aile cascade'i ile. Politika sayısı 110 → 112 (pgTAP 100 güncellendi).
- Ön kontrol (grep, `apps/`, `packages/`, `scripts/`, `supabase/functions`): istemcide doğrudan `children` silmesi **yalnız** `apps/mobile/src/app/parent/menu.tsx:36` (`supabase.from("children").delete()`); başka kullanım yok. Bu dosyaya dokunulmadı (menü UI'si başka ajanda `confirm_child_deletion`'a taşınıyor).
- **BAĞIMLILIK — yayın sırası:** bu migration, `menu.tsx` çocuk silme akışı `confirm_child_deletion`'a taşınan sürüm mağazalarda/OTA ile yayımlanmadan **uygulanmamalı**. Aksi hâlde eski istemcide çocuk silme 42501 hatası verir (veri kaybı yok, ama özellik çalışmaz).
- Test güncellemeleri: 016/079/090 doğrudan silmenin reddini assert eder, silmeyi `confirm_child_deletion` ile yapar (cascade/not ayırma kontrolleri aynı kaldı). `scripts/test-e2e-family-chain.mjs` §15: doğrudan silme reddi, satır yerinde, yabancı önizleme/onay reddi, önizleme + onay, aynı istek tekrarı aynı sonuç, görev/tamamlama cascade.

### Testler (gerçek koşular)

```
python3 scripts/test-q02-sql.py --run-local (Europe/Istanbul)  → 103 dosya, 3813 assertion, 0 hata (2. koşu)
python3 scripts/test-q02-sql.py --run-local --timezone UTC      → 103 dosya, 3813 assertion, 0 hata
pgTAP 103 tek başına                                           → 47/47
pgTAP 103, --skip-migration 20261106170000 (A/B)               → düşer (child_star_balance yok)
scripts/test-e2e-family-chain.py --run-local                    → 317/317 (chain-details-q02-3-6.json)
pnpm --filter @gina/core test                                   → 51 dosya, 359 test geçti
pnpm --filter @gina/mobile typecheck / lint (expo lint)         → temiz / temiz
pnpm --filter @gina/core typecheck                              → temiz
```

Not: İstanbul saatindeki **ilk** tam koşuda `095_notification_channels` 3 assertion düştü ("tampered signature rejected" ve ona bağlı iki denetim kaydı). Test, imzanın son karakterini `'0'` ile değiştiriyor; imza zaten `0` ile bitiyorsa belirteç değişmiyor → bu işle ilgisiz, önceden var olan olasılıksal flake. 095 tek başına 3 kez ve tam koşu tekrarında geçti. Öneri: testte son karakteri farklı bir karakterle değiştirmek (ör. `0`→`1`).
