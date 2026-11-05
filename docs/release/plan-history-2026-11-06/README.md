# Tarihli plan geçmişi (L04) — sunucu ve ortak alan

6 Kasım 2026 gece çalışması. Kaynak: main `1cd2292` (L01 birleştirilmiş) üzerinde ayrı dal. **Yayın durumu: yayımlanmadı; UI bağlanmadı.** Üretim Supabase'e, yerel demo veritabanına ve gerçek aile verisine dokunulmadı; bütün testler boş/geçici veritabanında koştu ve silindi.

## Ne yapıldı

Görev rutini (ad/gün/saat/yıldız/onay), ders programı (hücreler + zil düzeni) ve öğrenme planı kayıtlarının her sürümü artık **hangi aile-yerel günden itibaren geçerli** olduğunu (`effective_from`) ve **hangi gün bilinir olduğunu** (`known_since`) taşır. Tek sunucu çağrısı `plan_for_day(child, day)` o günün planını geçerli sürümlerden kurar. Geçmişe dönük uydurma yok: geçişten önceki sürümler `effective_from = null` ile "bilindiği günden" itibaren sayılır; daha eski günler `unknown_before` ile işaretlenir.

Migration: `supabase/migrations/20261106090000_dated_plan_history.sql`. pgTAP: `supabase/tests/096_dated_plan_history.test.sql`. Yarış: `scripts/test-plan-history-races.py`. Ortak alan: `packages/core/src/plan-history.ts`. UI taslağı (hiçbir yerden import edilmiyor): `apps/mobile/src/components/planner/plan-history-note.tsx`.

## Model

| Kaynak | Sürüm kaydı | Geçişte ne oldu |
|---|---|---|
| Görev rutini | mevcut `gina.task_routine_changes` + `effective_from`, `known_since`, `superseded_by` | Mevcut satırlar: `effective_from=null`, `known_since` = kaydın aile-yerel günü. Geçmişi başlayan ilk kaydın `before_value`'su (geçmiş öncesi ayarlar) `action='migration'` satırı olarak, başlangıç günü **ve** `known_since` olmadan tutulur ("geçişte bilinen"). Hiç geçmişi olmayan rutinler için mevcut satır `migration` kaydı olarak, `known_since` = geçiş günü ile eklenir. |
| Ders programı | yeni `gina.school_timetable_versions` (child, revision, lessons, settings, effective_from, known_since, superseded_by) | Mevcut tablo tek sürüm olarak, `known_since` = son kayıt günü, `effective_from=null`. Eski revizyonlar kaynakta yok; dönem kapanışındaki `timetable_snapshot` dönem sınırında devreye girer. |
| Öğrenme planı | yeni `gina.learning_plan_changes` (item, revision, content, source_id, done_at, effective_from, known_since, superseded_by) | Mevcut kayıtlar tek sürüm; L01 kopyalarının `effective_from` değeri korunur. |

Sürüm çözümü (`gina.plan_version_on`): bir günün sürümü, başlangıcı (`effective_from`, yoksa `known_since`) o günden sonra olmayan **en son** sürümdür. Hiçbiri yoksa en eski bilinen sürüm `status='unknown_before'` ve `unknown_before=<ilk bilinen gün>` ile döner; içerik "geçişte bilinen en eski ayar" olarak etiketlidir, o gün gerçekten geçerli olduğu iddia edilmez. Bugün ve gelecek için aynı kural güncel ya da ileriye planlanmış sürümü verir.

Üç tablonun sürüm tetikleyicileri `effective_from`'u şu sırayla alır: RPC'nin işlem içi isteği (`gina.plan_effective_from` ayarı) → yeni kayıt için `starts_on`/`effective_from` sütunu → aile-yerel bugün. Yeni bir sürüm, kendisinden **sonra** başlaması planlanmış bekleyen sürümleri `superseded_by` ile dışarıda bırakır (bugün yapılan düzenleme, önceki "haftaya başlasın" planını iptal eder).

Saat dilimi: gün sınırı `families.timezone` ile (`gina.local_day`, `gina.family_today`); 23:30/00:30 dönüşümleri pgTAP ve core testinde.

## RPC sözleşmesi

- `plan_for_day(p_child_id uuid, p_day date) → jsonb` — veli veya o çocuğun cihazı. Dönüş: `child_id, day, today, timezone, weekday, period` (o güne düşen eğitim dönemi), `routines[]` (o gün geçerli, aktif, arşivsiz ve gün uyan rutinler; her biri `revision, current_revision, title, icon, stars, days_of_week, time_of_day, requires_approval, starts_on, ends_on, effective_from, known_since, status, unknown_before`), `timetable` (`revision, lessons, day_lessons, settings` = zil düzeni, `status: known|unknown_before|period_snapshot|none`, `source: history|period_snapshot|none`, `period_id`), `plans[]` (o günü kapsayan plan kayıtlarının o günkü sürümü). Hatalar: `plan_forbidden` (42501), `plan_day_invalid`.
- `change_task_routine(p_request_id, p_id, p_revision, p_action, p_value, p_effective_from date default null)` — eski imza **kaldırıldı**, tek imza; PostgREST ada göre bağlar, eski istemci parametresiz çağırınca bugün. Yalnız `save` tarihlenebilir (`pause/resume/archive/restore` ile tarih → `task_routine_invalid`). Geçmiş tarih → `plan_effective_past`; 365 günden ileri → `plan_effective_invalid`. Sonuçta `effective_from` döner; istek fişi tarihi de içerir (aynı istek farklı tarihle → `request_conflict`).
- `save_school_timetable_request(..., p_effective_from date default null)` — aynı kurallar; `save_school_timetable(…, p_effective_from)` 5 parametreli iç çağrı eklendi, 4 parametreli eski fonksiyon (dönem geçişi, içe aktarma) olduğu gibi kalır ve bugünü kullanır.
- `save_learning_plan` değişmedi; her kayıt bugünden geçerli sürüm olarak tutulur (istemci parametresi yok).
- `task_routine_history` satırlarına `effective_from, known_since, superseded_by` eklendi.

Gönderim kuralı: `complete_task` ve gönderim anlık görüntüsü, satır **ileri tarihli** bir sürümü taşıyorsa (`task_templates.effective_from > greatest(due_date, bugün)`) o günün geçerli sürümünü kullanır; bugünkü/geçmiş düzenlemelerde mevcut davranış (084 testi) değişmedi.

## Örnek sorgu sonuçları

Geçici veritabanında sentetik aileyle ([sample-queries.json](sample-queries.json); bugün 2026-11-06, rutin 2026-10-07'den beri, `known_since` 2026-11-01 olarak eski kayıt gibi işaretlendi; bugün 5 yıldız, +7 günden 9 yıldız planlandı; program bugün kaydedildi, +3'ten yeni hücre ve zil düzeni):

| Gün | Rutin | Program |
|---|---|---|
| bugün−8 (ilk bilinenden önce) | rev 1, 2 yıldız, `status=unknown_before`, `unknown_before=2026-11-01` | `unknown_before`, `unknown_before=2026-11-06` |
| bugün−1 | rev 1, 2 yıldız, `known`, `effective_from=null`, `known_since=2026-11-01` | `unknown_before` |
| bugün | rev 2, 5 yıldız, `known`, `effective_from=2026-11-06` | rev 1, Matematik, 09:00/40/10 |
| bugün+3 | rev 2, 5 yıldız | rev 2, 08:30/45/15 |
| bugün+7 | rev 3, 9 yıldız, `effective_from=2026-11-13` | rev 2 |
| geçmiş tarihli düzenleme | `ERROR: plan_effective_past` | |

Dönem sınırı (pgTAP 096): yeni yıl bugün açılıp program boş başlatıldığında bugün yeni dönem ve boş program; bir gün öncesi kapanan dönem ve `period_snapshot` kaynaklı eski hücreler/zil düzeni (`unknown_before` = kapanış günü).

## Kontroller (gerçekten çalıştırıldı)

- **pgTAP 096**: 108 kontrol — saat dilimi 23:30/00:30 ve farklı aile dilimi; oluşturma tarihi; eski kayıt (`known_since`) ve geçişte bilinen (`migration`) sürümlerin `unknown_before` işareti; bugünkü düzenleme (eski istemci imzası) → dün eski, bugün yeni; geçmiş/çok ileri/duraklatma tarihi reddi; ileri tarihli düzenleme → bugün eski, hedef gün yeni, hafta günü etkisi; bugünkü gönderimin bugünkü yıldızı dondurması; aynı istek tekrarı ve farklı tarihli tekrar; sonraki anlık düzenlemenin bekleyen planı `superseded` yapması; gönderilmiş görev/yıldız/onay kanıtının değişmemesi; program kaydı, dönem sınırı snapshot, ileri tarihli program ve zil düzeni, geçmiş tarih reddi; öğrenme planı sürümleri; başka aile, kardeş cihazı, kendi cihazı, ikinci veli; anonim/özel fonksiyon ve tablo yetkileri; tek RPC imzası.
- **084** yalnız imza iddiası güncellendi (`change_task_routine(uuid,uuid,integer,text,jsonb,date)`); diğer kontroller aynı.
- **Tüm pgTAP**: sonuçlar [sql-checks.json](sql-checks.json). Not: 083 ve 088, `current_date` (UTC) ile aile-yerel günün ayrıştığı 00:00–03:00 Europe/Istanbul penceresinde bu değişiklikten bağımsız olarak başarısız oluyor (L04 migration'ı olmadan da aynı üç/bir hata alındı); tam koşu bu pencere dışında tekrar edildi.
- **Yarışlar** ([race-checks.json](race-checks.json)): iki veli aynı sürümle farklı `effective_from` → tek sürüm, diğeri `task_routine_changed`; aynı planlı istek iki kez → tek sürüm, aynı sonuç; bugünkü gönderim ile ileri tarihli düzenleme yarışı → gönderim o günün sürümünü dondurur; anlık düzenleme bekleyen planları `superseded` yapar; iki program kaydı aynı revizyon farklı tarih → tek sürüm, diğeri `timetable_conflict`; düzenlemeler yıldız olayı üretmez/değiştirmez.
- **Ortak alan**: `pnpm --filter @gina/core test` — 43 dosya / 275 test (yeni `plan-history.test.ts`: SQL çözücünün TS aynası, geçerlilik tarihi kuralları, aile-yerel gün, `plan_for_day` şeması).
- **Mobil**: `pnpm --filter @gina/mobile exec tsc --noEmit` temiz; yeni taslak dosyada `expo lint` temiz.

## UI bağlanmadı / yayımlanmadı

- Mobil/backoffice ekranlarına dokunulmadı (Q00 incelemesiyle çakışmamak için). `plan-history-note.tsx` yalnız taslaktır; `planHistory.*` i18n anahtarları tr/en'e eklendi, mevcut anahtar silinmedi.
- Migration üretime uygulanmadı; TestFlight/web yayını yok. Sıra: önce migration, sonra istemciler. Eski istemciler `change_task_routine`/`save_school_timetable_request`'i ada göre çağırdığından bugünü alır; `database.types.ts` yeni opsiyonel argümanı ve `plan_for_day`'i tanımlar.

## Kalan sınır

- **Canlı satır ileri tarihli ayarı hemen taşır.** `task_templates`/`school_timetables` satırları düzenlemede hemen güncellenir; `plan_for_day` ve gönderim/snapshot o günün sürümünü kullanır ama satırı doğrudan okuyan mevcut ekranlar (görev listesi, program editörü, çanta önerisi) ileri tarihli ayarı bugünden gösterir. Ekranlar `plan_for_day`'e geçene kadar veli ekranında ileri tarih seçeneği açılmamalı.
- Dönem kapanışındaki `timetable_snapshot` hâlâ canlı satırdan alınır; ileri tarihli bir program kaydı varken dönem kapatılırsa snapshot planlı sürümü içerir (sürüm tablosu doğru günü verir).
- Öğrenme planında istemci tarafı `effective_from` yok; `done`/adım işaretlemeleri de sürüm sayılır (günün planı, işaretlemeden önceki sürümü gösterir).
- `plan_for_day` gönderilmiş görevleri/puanları döndürmez; mevcut `task_completions` okumalarıyla birleştirilir. Çocuğun cihazı yalnız kendi çocuğunu okur.
- Backfill `known_since` için kaydın `created_at`/`updated_at` gününü kullanır; bu, sürümün "o günden beri bilindiği" iddiasıdır, daha eski başlangıç uydurulmaz. Dönem snapshot'ları sürüm tablosuna kopyalanmadı; sınırda okunur.
- Çanta listesi (`gina.school_bags.lessons_snapshot`) zaten kendi anlık görüntüsünü tutar; değiştirilmedi.
