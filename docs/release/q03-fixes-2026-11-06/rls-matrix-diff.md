# RLS matrisi farkı — 20261106150000_rls_grant_hygiene öncesi/sonrası (sıfırdan tüm migration'lar)

| Özet | Önce | Sonra |
|---|---|---|
| tables | 160 | 160 |
| tables_without_rls | 15 | 0 |
| functions | 454 | 454 |
| security_definer_functions | 411 | 411 |
| security_definer_without_search_path | 0 | 0 |
| anon_executable_functions | 6 | 1 |
| authenticated_write_grants_without_policy | 50 | 0 |
| synthetic_failed | ['authenticated_write_grants_without_matching_policy', 'tables_without_rls'] | [] |

## Tablo farkları

| Tablo | Alan | Önce | Sonra |
|---|---|---|---|
| gina.bulk_archive_items | rls_enabled | False | True |
| gina.bulk_archive_runs | rls_enabled | False | True |
| gina.child_archive_device_blocks | rls_enabled | False | True |
| gina.child_archive_state | rls_enabled | False | True |
| gina.child_education_changes | rls_enabled | False | True |
| gina.child_education_periods | rls_enabled | False | True |
| gina.child_education_state | rls_enabled | False | True |
| gina.deletion_previews | rls_enabled | False | True |
| gina.note_changes | rls_enabled | False | True |
| gina.override_commands | rls_enabled | False | True |
| gina.reward_changes | rls_enabled | False | True |
| gina.school_grade_changes | rls_enabled | False | True |
| gina.store_reconcile_jobs | rls_enabled | False | True |
| gina.store_replacements | rls_enabled | False | True |
| gina.task_routine_changes | rls_enabled | False | True |
| public.admins | grant authenticated.insert | True | False |
| public.admins | grant authenticated.update | True | False |
| public.admins | grant authenticated.delete | True | False |
| public.ai_feature_requirements | grant authenticated.insert | True | False |
| public.ai_feature_requirements | grant authenticated.update | True | False |
| public.ai_feature_requirements | grant authenticated.delete | True | False |
| public.ai_summaries | grant authenticated.insert | True | False |
| public.ai_summaries | grant authenticated.update | True | False |
| public.ai_summaries | grant authenticated.delete | True | False |
| public.child_badge_awards | grant authenticated.insert | True | False |
| public.child_badge_awards | grant authenticated.update | True | False |
| public.child_badge_awards | grant authenticated.delete | True | False |
| public.child_goals | grant authenticated.insert | True | False |
| public.child_goals | grant authenticated.update | True | False |
| public.child_goals | grant authenticated.delete | True | False |
| public.child_inventory | grant authenticated.insert | True | False |
| public.child_inventory | grant authenticated.update | True | False |
| public.child_inventory | grant authenticated.delete | True | False |
| public.devices | grant authenticated.insert | True | False |
| public.devices | grant authenticated.delete | True | False |
| public.exam_answers | grant authenticated.insert | True | False |
| public.exam_answers | grant authenticated.update | True | False |
| public.exam_answers | grant authenticated.delete | True | False |
| public.exam_attempts | grant authenticated.insert | True | False |
| public.exam_attempts | grant authenticated.update | True | False |
| public.exam_attempts | grant authenticated.delete | True | False |
| public.families | grant authenticated.insert | True | False |
| public.families | grant authenticated.delete | True | False |
| public.family_members | grant authenticated.insert | True | False |
| public.family_members | grant authenticated.update | True | False |
| public.prova_ai_usage | grant authenticated.insert | True | False |
| public.prova_ai_usage | grant authenticated.update | True | False |
| public.prova_ai_usage | grant authenticated.delete | True | False |
| public.reward_requests | grant authenticated.insert | True | False |
| public.reward_requests | grant authenticated.update | True | False |
| public.reward_requests | grant authenticated.delete | True | False |
| public.star_events | grant authenticated.insert | True | False |
| public.star_events | grant authenticated.update | True | False |
| public.star_events | grant authenticated.delete | True | False |
| public.store_notifications | grant authenticated.insert | True | False |
| public.store_notifications | grant authenticated.update | True | False |
| public.store_notifications | grant authenticated.delete | True | False |
| public.store_subscriptions | grant authenticated.insert | True | False |
| public.store_subscriptions | grant authenticated.update | True | False |
| public.store_subscriptions | grant authenticated.delete | True | False |
| public.study_plans | grant authenticated.insert | True | False |
| public.study_plans | grant authenticated.update | True | False |
| public.task_completions | grant authenticated.insert | True | False |
| public.task_completions | grant authenticated.update | True | False |
| public.task_completions | grant authenticated.delete | True | False |

Toplam tablo farkı satırı: 65

## Fonksiyon farkları

| Fonksiyon | Alan | Önce | Sonra |
|---|---|---|---|
| gina.child_id() | anon_execute | True | False |
| gina.claims() | anon_execute | True | False |
| gina.family_id() | anon_execute | True | False |
| gina.role() | anon_execute | True | False |
| gina.valid_review_document(d jsonb) | anon_execute | True | False |

Toplam fonksiyon farkı satırı: 5

## Sentetik kontroller (sonra)

| Kontrol | Geçti | Ayrıntı |
|---|---|---|
| anon_cannot_read_any_public_table | True | [] |
| authenticated_cannot_read_gina_schema_tables | True | [] |
| cross_family_children_hidden | True | {'other_family': '0', 'own_family': '1'} |
| revoked_device_loses_row_access_with_stale_claims | True | {'before': '1', 'after': '0'} |
| revoked_device_zero_arg_rpcs_denied | True | {} |
| anon_executable_functions_listed | True | ['public.get_shared_child_view(p_token text)'] |
| authenticated_write_grants_without_matching_policy | True | [] |
| security_definer_without_search_path | True | [] |
| security_definer_authenticated_without_caller_check_heuristic | True | 25 öğe |
| tables_without_rls | True | [] |
