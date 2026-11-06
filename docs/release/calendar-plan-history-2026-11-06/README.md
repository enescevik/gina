# Takvim (U03) + tarihli plan geçmişi UI bağlama (L04)

6 Kasım 2026 gecesi. Dal: `worktree-agent-a335ab5c6a51526c4` (main `304f303` üzerine). **Main'e push edilmedi, üretime uygulanmadı/yayımlanmadı.** Testler yalnız geçici boş veritabanlarında ve geçici Auth/PostgREST konteynerlerinde koştu; hepsi kaldırıldı.

## Ne değişti

| Dosya | İçerik |
|---|---|
| `apps/mobile/src/components/calendar/day-plan.tsx` (yeni) | `useDayPlans` (seçili gün için kapsamdaki her çocuğa bir `plan_for_day` okuması), `planLessons` (o günün program sürümündeki dersleri salt okunur satıra çevirir), `RoutineRows`, `DaySectionTitle`, `showPlanNote` |
| `apps/mobile/src/components/planner/calendar-screen.tsx` | Gün görünümü `plan_for_day` ile; bölümler; Tümü özet satırları |
| `apps/mobile/src/components/tasks/routine-editor.tsx` | "Hangi tarihten itibaren?" (varsayılan bugün, geçmiş yok); tarih seçici kapalı bayrak arkasında (aşağıda) |
| `apps/mobile/src/components/planner/event-editor.tsx` | Başlık önerileri; tekrarlı etkinlikte "yalnız bu günü iptal et" / "bütün seriyi sil" |
| `apps/mobile/src/components/planner/plan-history-note.tsx` | Artık takvimden kullanılıyor (yalnız açıklama yorumu güncellendi) |
| `supabase/migrations/20261106200000_calendar_archived_events.sql` | Veli RLS'i: `events_parent_all` USING'e `archived_at is null` |
| `supabase/tests/106_calendar_archived_events.test.sql` (yeni) | 28 pgTAP kontrolü |
| `supabase/tests/089_bulk_archive.test.sql` | Tek satır: veli okumasıyla `archived_at` doğrulaması artık mümkün değil → "veliye görünmüyor" kontrolüne çevrildi (diğer 100 kontrol aynı) |
| `packages/core/src/i18n/{tr,en}.json` | Yalnız yeni `dayPlan.*` (24 anahtar); mevcut anahtar değişmedi |
| `scripts/test-calendar-plan-history-ui.cjs` (yeni) | Playwright akışı |

### Takvim gün görünümü
- **Geçmiş gün:** dersler `plan_for_day.timetable.day_lessons`'tan (o günün program/zil sürümü), canlı programdan türetilen `timetable_entry_key` satırları gizlenir; görevler `plan_for_day.routines`'tan (o günün rutin adı/yıldızı). Başlıkta "Geçmiş gün" rozeti ve açıklama satırı. Program `unknown_before`/`period_snapshot`/`legacy` ise `PlanHistoryNote` ("Bu günün planı kayıtlarda yok. Gösterilen, X tarihinde bilinen en eski ayar." vb.); rutinlerde de aynı not. Program hiç yoksa (tek çocukta) "Bu gün için kayıtlı ders programı yok."
- **Bugün/gelecek:** dersler ve etkinlikler eskisi gibi canlı etkinliklerden. Görevler her gün `plan_for_day`'den gelir; böylece ileri tarihli bir düzenleme bugünü değiştirmez, hedef günde "X tarihinden itibaren geçerli olacak ayarlar" notuyla görünür. "Bilinen tarihten beri" (legacy) notu yalnız geçmiş günde gösterilir (bugün her eski rutinde tekrarlanmasın diye).
- **Ayrı anlamlar:** gün altında "Dersler", "Etkinlikler", "Görevler" başlıkları (sayıyla), sonra çanta + "Ödev ve çalışmalar". Özet satırı yalnız seçili günün sayısını verir ("1 ders · 2 etkinlik · 3 görev"); başlıkta "Bugün" / "Seçili gün" / "Geçmiş gün" rozeti ile bugünün sayılarıyla karışmaz.
- **Tümü (Q00-A1-15):** çocuk başına çanta + ödev blokları tekrarlanmaz; "Çocuklara göre" altında çocuk başına tek satır (ders/görev/açık çalışma sayısı). Satıra dokununca o çocuğun tam günü (çanta, ödev) açılır. Aile etkinliği tek kez listelenir.
- `plan_for_day` hatası tüm ekranı kapatmaz: gün kartında uyarı + "Yeniden dene".

### Rutin düzenleyici — "Hangi tarihten itibaren?"
Kayıt adımında başlık her zaman görünür; inceleme adımında "Geçerlilik: Bugünden itibaren / X tarihinden itibaren". Tarih seçici (`DateChoice`, `effectiveFromProblem`: geçmiş → "Geçmiş bir tarih seçilemez…", 365 gün sonrası → reddedilir; istek `effectiveFromArg` ile — bugünse parametre gönderilmez) **`allowFutureEffective` prop'u ile açılır ve varsayılanı `false`**. Neden: L04 README'nin kuralı — canlı `task_templates` satırı ileri tarihli ayarı hemen taşır; görev listesi (`tasks-screen.tsx`), çocuğun Bugün'ü (`today-view.tsx`, `use-child-today.ts`) ve veli ana ekranı hâlâ canlı satırı okuyor ve bu dosyalar bu işin sahipliğinde değil. Bu ekranlar `plan_for_day`'e geçtiğinde çağıran (`tasks-screen.tsx`) `allowFutureEffective` geçirerek açar. Sunucu hata kodları (`plan_effective_past`, `plan_effective_invalid`) Türkçe iletiye bağlandı; kayıttan sonra `plan_for_day` önbelleği yenilenir.

### Arşivlenmiş etkinlikler
L02 yalnız cihaz politikasını daraltmıştı. Yeni migration veli politikasının **USING** kısmını `archived_at is null` ile daraltır (ad/komut/tür/rol aynı → 100'deki envanter ve 112 politika sayısı değişmedi; WITH CHECK aynı). Sonuç: veli arşivli satırı okuyamaz, doğrudan güncelleyemez/silemez; arşivli serinin istisnaları da görünmez. Arşivleme/önizleme/geri alma RPC'leri `SECURITY DEFINER` olduğu için çalışır (106'da doğrulandı). İstemci filtresi: takvim ve Bugün aynı `useFamilyEvents` sorgusunu (`lib/use-family-events.ts`) kullanır; bu dosya sahiplik dışında olduğu için orada `archived_at` filtresi eklenmedi — RLS daraltması her iki ekranı da kapsar.

### Etkinlik editörü
- **Başlık önerileri** (yalnız yeni etkinlikte): ailenin aynı türdeki eski elle eklenmiş etkinlik başlıkları, yazılan metne göre süzülür, en çok 6 çip.
- **Tekrar kapsamı:** tekrarlı etkinlikte "Yalnız bu günü iptal et" (seçili gün için `event_exceptions` satırı — takvimin mevcut iptal kuralı) ve "Bütün seriyi sil" ayrı. Düzenleme kaydı hâlâ bütün seriye uygulanır (mevcut "seriesHelp" metni); tek günü taşımak/düzenlemek şemada yok.

## Test çıktıları (gerçekten çalıştırıldı)

- `pnpm exec tsc --noEmit` (apps/mobile): çıkış 0, hata yok.
- `pnpm exec expo lint` (değişen 5 mobil dosya): uyarı/hata yok.
- **Tam pgTAP, Europe/Istanbul** (`python3 scripts/test-q02-sql.py --run-local --out …`, 03:0x'te, gece penceresi dışında): `{"files": 105, "assertions": 3919, "failures": []}` — [sql-checks-istanbul.json](sql-checks-istanbul.json). 106: 28/28, 089: 101/101, 096: 108/108, 100: 47/47.
- **Tam pgTAP, `--timezone UTC`**: `{"files": 105, "assertions": 3919, "failures": []}` — [sql-checks-utc.json](sql-checks-utc.json).
- **İzole servis** (`GINA_QA_UI_FIXTURE=<kendi yolum> python3 scripts/test-isolated-services.py --run-local --ui-hold`): iki ayrı koşu, ikisinde de 137/137 servis kontrolü; `rest_removed`, `auth_removed`, `disposable_database_removed` = true — [service-checks.json](service-checks.json) (kanıt koşusu), [service-checks-run1.json](service-checks-run1.json).
- **Web export** bu koşunun fixture URL/anon anahtarıyla (`expo export -p web`), loopback statik sunucu, **Playwright** (Chrome, tr-TR, Europe/Istanbul) 390×844 ve 1280×800 — [ui/ui-checks.json](ui/ui-checks.json), 7/7:
  1. `archived_event_hidden_from_parent_rest_read` — `bulk_archive_apply` sonrası veli REST okuması arşivli etkinliği döndürmez.
  2. `past_day_shows_that_days_routine_name_and_unknown_timetable_marker` — dün: eski rutin adı ("Kitap oku …"), yeni adlar yok; "Geçmiş gün"; program bugün kaydedildiği için "Bu günün planı kayıtlarda yok…" işareti.
  3. `future_dated_edit_keeps_today_unchanged` — `change_task_routine(…, p_effective_from = bugün+3)` sonrası canlı satır yeni adı taşıyor (`live_row_title`), takvimde bugün hâlâ "(20 dk)" sürümü.
  4. `archived_event_hidden_in_parent_calendar` — arşivli "Yüzme" yok, canlı "Piyano" var.
  5. `scheduled_day_shows_new_routine_with_note` — bugün+3: "(30 dk)" ve "… tarihinden itibaren geçerli olacak ayarlar" notu.
  6. `all_children_no_repeated_child_blocks_and_open_child_detail` — Tümü: "Çocuklara göre" satırları, hiç "Çanta listesi" bloğu yok, aile etkinliği bir kez; çocuğa dokununca çanta/ödev açılır.
  7. `phone_desktop_layout_and_runtime` — yatay taşma yok, çevrilmemiş `dayPlan.`/`planHistory.` anahtarı yok, sayfa hatası yok.
  Görüntüler: `ui/*.png`. Not: aynı fixture'da iki ön koşu yapıldı (ilk koşu geçti; ikincisi önceki koşunun aynı adlı rutinleri yüzünden test tarafında çakıştı → başlıklar koşu etiketiyle benzersizleştirildi); yukarıdaki kanıt **yeni bir fixture + yeni export** ile tek temiz koşudur. Fixture'ın kendi "Synthetic child/sibling" çocukları görüntülerde görünür.
- Kendi geçici DB/konteynerlerim kaldırıldı (rapor alanları true); statik sunucu durduruldu.

## Kalan sınır
- **İleri tarih seçici kapalı** (`allowFutureEffective=false`): görev listesi, çocuğun Bugün'ü ve veli ana ekranı `plan_for_day`'e geçmeden açılmamalı (sahiplik dışı dosyalar). İleri tarihli kayıt yalnız API ile test edildi; seçicinin kendisi UI'da çalıştırılmadı.
- Hafta özeti (geniş ekran sağ sütun) ve hafta şeridi sayıları hâlâ canlı etkinliklerden; geçmiş günde ders sayısı orada canlı programa göre olabilir. Gün kartı doğru sürümü gösterir.
- Geçmiş gün ders satırları salt okunurdur (dokununca bugünkü program editörü açılmaz).
- Program için gerçek "eski sürüm" kanıtı UI'da gösterilemedi: API ile geçmişe tarihli program kaydı yapılamaz; yalnız `unknown_before` işareti doğrulandı (sürüm çözümü pgTAP 096'da).
- Realtime: arşivleme güncellemesi artık veliye RLS ile gelmez; takvim odak/yenilemede doğru listeyi alır.
- `save_calendar_event` (definer) arşivli bir etkinlik kimliğiyle çağrılırsa onu düzenleyebilir; istemci arşivli satırı görmediği için normal akışta oluşmaz, sunucuda ayrıca reddedilmedi. `get_weekly_summary_data` (definer) arşivli etkinlikleri hâlâ sayar.
- Tek gün iptali doğrudan `event_exceptions` upsert'i (mevcut veli RLS'i); istek kimliği/çift dokunma için ayrı fiş yok (aynı satır upsert olduğundan tekrarı zararsız). Bu akış Playwright'ta çalıştırılmadı.
