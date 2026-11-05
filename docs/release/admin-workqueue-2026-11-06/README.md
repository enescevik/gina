# B01 — Ana iş kuyruğu, aile arama, hak zaman çizgisi ve override önizleme/uygulama (sunucu + core)

6 Kasım 2026 gecesi. Dal: `b01-admin-workqueue` (main `772b994` üzerine). **UI bağlanmadı, üretime yayımlanmadı.** Migration üretim Supabase'e uygulanmadı; yalnız geçici boş veritabanlarında (`gina_completion_audit` şablonundan klon) çalıştırıldı. Demo/üretim veritabanında `db reset` yapılmadı. `apps/backoffice/src/pages/{index,dashboard,families,billing,overrides}.tsx` dosyalarına dokunulmadı (A3 ajanı; UI bağlantısı sabah).

## Değişen dosyalar

| Dosya | İçerik |
|---|---|
| `supabase/migrations/20261106100000_admin_workqueue.sql` | `admin_workqueue`, `admin_families_search`, `admin_family_entitlement_timeline`, `admin_override_preview`, `admin_override_apply` RPC'leri; `gina.caller_operation_roles()`, `gina.store_event_kind()`, `gina.workqueue_item()` yardımcıları; `pg_trgm` + 6 indeks |
| `supabase/tests/097_admin_workqueue.test.sql` | 111 pgTAP kontrolü |
| `scripts/test-admin-workqueue-races.py` | Geçici DB kurar, bütün migration'ları + bütün pgTAP'ı ve 7 yarış/sınır kontrolünü çalıştırır, sonuçları bu klasöre yazar |
| `packages/core/src/admin-workqueue.ts` (+ `admin-workqueue.test.ts`, `index.ts` tek satır export) | Zod sözleşmeleri, rol sızıntısı kontrolü, keyset sayfa birleştirme, zaman çizgisi tür grupları, yanlış aile kontrolü, idempotent apply argümanları/makbuz doğrulaması |

Mevcut `admin_search_families(text,int)`, `admin_list_overrides`, `admin_grant_override`, `admin_expire_override`, `admin_save_override`, `finance_workspace` değişmedi; yayımlanmış backoffice çalışmaya devam eder.

## Yetki modeli (her çağrıda canlı)

- `gina.caller_operation_roles()`: tam yönetici (`gina.admin` claim **ve** `public.admins` satırı) → `admin, support, content, finance, release`; operatör → `operations_members`'ta süresi dolmamış ve iptal edilmemiş roller; cihaz/anonim → boş.
- `admins` satırı silinen yönetici JWT süresi bitmeden `forbidden` (42501) alır; süresi dolmuş veya `revoked_at` yazılmış operatör aynı şekilde reddedilir. Sahte `admin:true` claim'i satır yoksa işe yaramaz.
- RPC → gereken rol: `admin_workqueue` (herhangi bir rol; `p_role` verilirse çağıran o rolü taşımalı), `admin_families_search` (admin/support/finance), `admin_family_entitlement_timeline` (admin/finance), `admin_override_preview`/`admin_override_apply` (yalnız `gina.assert_admin()`).
- Veli, çocuk cihazı ve anonim hepsinde `forbidden`.

## Sözleşmeler

### `admin_workqueue(p_role text default null) → jsonb`

`{as_of, roles[], items[]}`; her kalem `{role, queue, key, count, oldest_since, oldest_waiting_seconds, reason}`. Yalnız çağıranın rollerine ait kalemler döner (**destek rolü ödeme kalemi görmez**; finans destek biletini görmez). Sayısı 0 olan kalemler de döner (boş durum için), `oldest_*` null.

| role | queue | key | reason | kaynak |
|---|---|---|---|---|
| support | support | `tickets_open` | `parent_waiting` | `help_tickets` kind=support status=open |
| support | support | `tickets_unassigned` | `no_operator_reply` | open/in_progress bilette hiç `author_role='support'` mesajı yok |
| support | support | `tickets_sla_breached` | `waiting_over_24h` | open ve `updated_at` 24 saatten eski |
| support | support | `ideas_open` | `idea_untriaged` | kind=idea status=open |
| content | review | `library_drafts` | `awaiting_editorial_review` | `gina.library_import_packages` yayımlanmamış ve sonraki revizyonu olmayan |
| content | review | `contributions_pending` | `awaiting_review` | `question_contributions` + `gina.contribution_sets` pending |
| content | review | `prereview_needs_admin` | `ai_prereview_needs_admin` | E01 `gina.content_prereviews` needs_admin / ai_rejected_suggestion |
| content | review | `scenario_revisions` / `scenario_ready_to_publish` | `scenario_revision_pending` / `scenario_reviewed_not_published` | `gina.curriculum_candidates` draft / reviewed |
| content | school | `education_calendar_drafts` | `calendar_unpublished_revision` | `gina.education_calendars` yayımlanmamış veya yeni revizyon |
| finance | billing | `store_notifications_attention` | `store_event_unprocessed_or_failed` | `store_notifications` işlenmemiş/hatalı, kirası dolmuş |
| finance | billing | `reconcile_jobs_failed` | `manual_store_check_failed` | `gina.store_reconcile_jobs` failed |
| finance | billing | `subscriptions_billing_retry` | `grace_or_on_hold` | `store_subscriptions` grace/on_hold |
| finance | billing | `overrides_expiring_7d` | `comp_ends_within_7_days` | aktif telafi 7 gün içinde bitiyor |
| release | release | `push_attention` | `push_failed_or_unconfigured` | `push_outbox` failed/skipped_unconfigured (30 gün) |
| release | release | `announcements_draft` | `announcement_unpublished` | `gina.parent_announcements` draft |
| admin | ai | `ai_failed_operations` | `ai_failed_or_uncertain` | S06 `admin_ai_failed_operations` ile aynı tanım (`ai_operation_jobs` + `prova_generation_jobs`); test eşitliği doğrular |
| admin | ai | `ai_stale_working` | `working_over_3_minutes` | 3 dakikadan eski `working` |

AI kuyruğu `admin` rolünde kaldı çünkü ayrıntı RPC'si (`admin_ai_failed_operations`) yalnız tam yöneticiye açık.

### `admin_families_search(p_query text, p_cursor text, p_limit int default 50) → jsonb`

`{as_of, query, limit, has_more, rows[], next_cursor}`. Arama: aile adı, **çocuk adı**, **e-posta parçası** (≥3 karakter), aile kimliği, davet kodu. `%`/`_`/`\` kaçırılır. Gerçek keyset sayfalama `(created_at desc, id desc)`; cursor `'<created_at>|<id>'`, `has_more` ⇔ `next_cursor` dolu. `limit` 1..200'e kırpılır; **ilk 100 sınırı yok** (120 aile 50+50+20 ile kesişimsiz dolaşıldı; `limit=200` tek sayfada 120). Sorgu >120 karakter → `invalid_input`; bozuk cursor → `cursor_invalid`.

Satır: `id, name, created_at, timezone, member_count, child_count (arşivsiz), archived_child_count, device_count, plan, plan_source (free|store|comp|beta), plan_expires_at, store_status (son abonelik durumu), active_override_count, last_activity_at (yıldız/görev/destek/abonelik/cihaz son görülme), matched_on[]`. **E-posta ve çocuk adı dönmez**; yalnız `matched_on` içinde `email` / `child_name` işareti.

İndeksler: `families(name) gin_trgm`, `children(name) gin_trgm`, `families(created_at desc,id desc)`, `star_events(family_id,created_at desc)`, `entitlement_overrides(family_id,created_at desc)`, `store_notifications(platform,store_key,received_at desc)`. `pg_trgm` (1.6) yerel şablonda ve Supabase'de mevcut; `auth.users.email` için indeks oluşturulmaz (tablo postgres'e ait değil), düz `ilike` ile taranır — sınır olarak belgelendi.

Örnek (`'Elif'`, çocuk adıyla):
```json
{"rows":[{"id":"1000…9901","name":"Örnek aile","plan":"plus","plan_source":"store","store_status":"active","child_count":1,"member_count":1,"device_count":0,"active_override_count":0,"matched_on":["child_name"],"last_activity_at":"2026-11-05T21:37:35+00:00", "…":"…"}],"limit":2,"has_more":false,"next_cursor":null,"query":"Elif"}
```

### `admin_family_entitlement_timeline(p_family_id uuid, p_cursor text, p_limit int default 50) → jsonb`

`{as_of, family{id,name,timezone,created_at,effective{plan,source,expires_at}}, limit, has_more, events[], next_cursor}`. Sabit aile bağlamı; bilinmeyen aile `family_not_found`. Olay: `{occurred_at, kind, id, family_of: store|operator, data}`; sıralama `(occurred_at, kind, id) desc`, cursor `'<occurred_at>|<kind>|<id>'`.

Türler **ayrı**:
- Mağaza olayları (`store_notifications`, aboneliğin `store_key`'i üzerinden): `store_purchase`, `store_renewal`, `store_renewal_resumed`, `store_cancel` (otomatik yenileme kapandı), `store_refund`, `store_refund_declined`, `store_refund_reversed`, `store_revoke`, `store_expired`, `store_grace`, `store_on_hold`, `store_paused`, `store_plan_change`, `store_other`; `data.processed` ve temizlenmiş `error_code`. Apple `notificationType[:subtype]` ve Google `subscription:N` eşlemesi `gina.store_event_kind()`.
- Abonelik kaydı: `store_subscription` (platform, ürün, durum, bitiş, auto_renewing).
- Operatör telafisi: `comp_granted` (gerekçe, veren), `comp_revoked` (iptal gerekçesi `audit_log`'dan), `comp_expired` (süresi geçmiş aktif telafi).
- Elle mağaza kontrolü: `store_check_requested` — `data.is_refund=false`; **iade/iptal değildir**.

Core tarafında `timelineGroup()` bu türleri `purchase|renewal|cancellation|refund|revocation|lapse|compensation|verification|other` gruplarına ayırır; UI aynı etiketi kullanamaz.

Örnek (kısaltılmış): `store_cancel` (AUTO_RENEW_DISABLED, processed) → `comp_expired` → `comp_granted` ("Önceki telafi") → `store_subscription` (plus, active) → `store_purchase` (SUBSCRIBED:INITIAL_BUY).

### `admin_override_preview(p_family_id, p_plan, p_until, p_reason) → jsonb` (yazmaz)

```
{ family{id,name,timezone,created_at,member_count,child_count},   -- yanlış aile burada görünür
  request{plan,until,reason_ok},
  before{plan,source,expires_at}, after{…}, reverts_to{…,note},   -- after = mevcut adaylar + varsayımsal telafi
  changes[{limit,before,after,direction: opens|closes|same}],     -- max_children, max_devices, max_active_tasks_per_child, max_notes, history_days, ai_weekly
  conflicts[{override_id,plan,starts_at,ends_at,reason,relation}],-- scheduled|higher_plan_active|same_plan_covers_request|same_plan_shorter|lower_plan_active
  presets[{days:7|30|90, until}],                                  -- ailenin saat diliminde gün sonu
  blockers[], can_apply, replace_required }
```
Engeller: `override_plan_free`, `override_reason_required`, `override_ends_at_invalid`, `override_too_long` (2 yıl), `plan_not_above_current` (mevcut mağaza/telafi zaten kapsıyor; girdi geçersizken eklenmez). Aktif Plus mağaza + 10 günlük Plus telafi → `plan_not_above_current`; 40 günlük Plus telafi → `after.expires_at` uzar; Pro telafi → `after.plan=pro`. Süresi geçmiş/iptal edilmiş telafiler çakışma değildir.

Örnek (Plus mağaza → Pro telafi 30 gün): `before={plus,store}`, `after={pro,comp,+30g}`, `changes`: max_children 4→8 opens, max_devices 3→∅ opens, history_days 365→∅ opens, diğerleri same.

### `admin_override_apply(p_family_id, p_plan, p_until, p_reason, p_idempotency_key uuid, p_replace_conflicts boolean default false) → jsonb`

Mevcut `admin_save_override` (→ `admin_grant_override`) **sarmalanır**: aile başına advisory kilit → `gina.override_commands` makbuzu (aynı anahtar + aynı aile/paket/süre/gerekçe + aynı yönetici → kayıtlı sonuç, `replayed:true`; farklı girdi veya başka yönetici → `request_conflict`) → önizleme engeli varsa ilk engel kodu fırlatılır → çakışma varsa `override_conflict` (ya da `p_replace_conflicts=true` ile çakışanlar `admin_expire_override` ile sonlandırılır, `replaced[]`) → `admin_save_override(key, {action:'grant',…})` → `audit_log` `entitlement_overrides.apply` (anahtar, before/after, replaced). Satır tetikleyicisinin `entitlement_overrides.insert` kaydı korunur. Dönüş: `{request_id, action:'grant', override_id, family_id, replayed, before, after, replaced}`.

## Core (`packages/core/src/admin-workqueue.ts`)

`workqueueSchema`/`groupWorkqueue` (sunucunun vermediği role ait kalem → `workqueue_role_leak`), `waitingLabel`; `familiesSearchSchema` (`.strict()` satır: e-posta gibi fazla sütun reddedilir, `has_more`⇔cursor), `normalizeFamilyQuery`, `appendFamilyPage` (sırası bozuk sayfa → `page_out_of_order`); `entitlementTimelineSchema`, `timelineGroup`, `appendTimelinePage` (başka ailenin sayfası → `timeline_family_mismatch`); `overridePreviewSchema` (`can_apply`⇔boş `blockers`), `assertPreviewFamily` (→ `override_wrong_family`), `presetUntil`, `openedLimits/closedLimits`, `overrideApplyArgs` (aynı anahtar yeniden denemede kullanılır), `readOverrideApplyResult` (anahtar/aile eşleşmeyen makbuz → `override_receipt_invalid`). i18n anahtarları (`admin.workqueue.*`, `admin.override.blocker.*`) bu dalda **eklenmedi**; UI bağlanırken backoffice i18n düzenine göre eklenir.

## Testler (gerçekten çalıştırıldı)

Ortam: `docker` içindeki yerel Supabase Postgres'te `gina_completion_audit` boş şablonundan klonlanan geçici veritabanları (`gina_b01_<rastgele>_audit`), bütün migration'lar (`20261106100000_admin_workqueue.sql` dahil) uygulandı, sonra silindi.

- **pgTAP 097** (`097_admin_workqueue.test.sql`): `1..111`, **111/111 ok**. Kapsam: veli/cihaz/sahte admin claim reddi; süresi dolmuş ve iptal edilmiş operatör reddi; destek rolü yalnız destek kalemleri (ödeme/AI yok), `p_role='finance'` → forbidden; finans yalnız ödeme kalemleri; yönetici tüm roller ve AI sayısının `admin_ai_failed_operations().total` ile eşitliği; 120 ailede 50+50+20 kesişimsiz keyset sayfalama, `limit` 200'e kırpma, bozuk cursor, `%` kaçırma, ad/çocuk adı/e-posta parçası/kimlik eşleşme işaretleri (e-posta sütunu yok); zaman çizgisinde 10 farklı tür (`store_refund`, `store_cancel`, `comp_granted/revoked/expired`, `store_check_requested is_refund=false`…), 4+4+2 sayfalama; önizlemede yanlış aile adı/çocuk sayısı, önce/sonra, `changes` yönleri, 3 hazır süre, her engel kodu, çakışma ilişkileri; apply idempotency (aynı anahtar → `replayed`, tek satır, tek `apply` denetim kaydı), farklı paket → `request_conflict`, kapsanan telafi → `plan_not_above_current`, `override_conflict` → `p_replace_conflicts` ile `replaced`; başka yöneticinin anahtarı → `request_conflict`; `admins` satırı silinince okuma ve yazma anında `forbidden`, satır yazılmadı.
- **`pnpm --filter @gina/core test`**: `Test Files 46 passed (46)`, `Tests 308 passed (308)` (yeni `admin-workqueue.test.ts` 15 test dahil).
- **`scripts/test-admin-workqueue-races.py --run-local`** → `race-checks.json` (7 yarış/sınır kontrolü, hepsi geçti): aynı yönetici aynı anahtar eşzamanlı → tek satır, özdeş makbuz (`replayed` bir tarafta true); iki yönetici farklı anahtar aynı aile/paket → biri yazdı, diğeri `plan_not_above_current`; Plus grant ile Pro replace yarışı → hiçbir an iki canlı telafi yok (gözlenen sıra `plus_first_then_replaced`); başka yönetici veya başka aile aynı anahtarı kullanamaz; yetki iptaliyle yarışan yazma (`revoke_before_write`) → forbidden, sonrası da forbidden; sayfalama sırasında yeni aile eklenince 130 kayıt 3 sayfada kesişimsiz ve tam; sahte admin claim'i reddedildi.
- **Bütün pgTAP dosyaları** aynı geçici DB'de (script hiçbir dosyayı atlamaz): `sql-checks.json` → **92 dosya, 3027 assertion geçti**; script çıktısı `{"races": 7, "files": 92, "assertions": 3027, "passed": true}`. Not: script psql oturumunu `PGTZ=Europe/Istanbul` ile açar; UTC oturumda `083_school_grade_lifecycle` ve `088_period_transfer` 21:00–24:00 UTC penceresinde `current_date` ile aile saat dilimi "bugün"ü uyuşmadığı için **B01'den bağımsız** başarısız oluyor (ilk UTC koşusunda gözlendi; aşağıda bulgu). Bu ayar o iki testteki varsayımı maskeler, düzeltmez.

## Kalan sınır / yapılmayanlar

- **UI bağlanmadı, yayımlanmadı.** `families.tsx` hâlâ `admin_search_families(p_limit:100)` kullanıyor; `overrides.tsx` eski grant/expire akışında. Sabah A3 ile bağlanır.
- `help_tickets`'ta sorumlu (assignee) sütunu yok; "sorumlusuz" = hiç operatör cevabı olmayan bilet. Gerçek atama B04 kapsamı.
- Beta test erişimi (`beta_test_access`) zaman çizgisinde olay olarak yok (tablo zaman damgası taşımıyor); `effective.source='beta'` olarak görünür.
- E-posta parçası araması `auth.users.email ilike` ile indekssiz; aile sayısı on binleri geçince e-posta için ayrı arama yolu (ör. Auth admin API) gerekir.
- `last_activity_at` için Prova denemeleri/notlar dahil edilmedi (yıldız, görev, destek, abonelik, cihaz son görülme).
- Mağaza olayı eşlemesi Apple/Google bildirim türlerine göre statik; yeni alt türler `store_other` olur.
- Yeni bulgu: `supabase/tests/083_school_grade_lifecycle.test.sql` 21:00–24:00 UTC arasında saat dilimine bağlı olarak başarısız oluyor (`current_date+1` UTC'de yarın ama Europe/Istanbul'da bugün; `change_school_grade` aile saat dilimine göre "gelecek" kararı veriyor). B01 ile ilgisi yok; düzeltilmedi.
- `pnpm --filter @gina/core typecheck`: `src/period-transfer.test.ts` içinde 19 önceden var olan hata (L01 dalından); yeni dosyalar temiz.
