# C13 — Performans ölçümü (birleşik main, C01–C11, 139 migration)

**Ortam:** geçici yerel GoTrue + PostgREST (loopback) + izole klon DB (`gina_c13p_<hex>_audit`, koşu sonunda silindi), bu Mac'te Docker Desktop — **aynı anda başka ajanların konteynerleri de çalışıyordu**. Mutlak değerler üretim gecikmesi değildir; karşılaştırma yalnız **aynı koşu içindeki** fazlar arasında anlamlıdır. Üretim/hosted projeye, yerel uygulama DB'si `postgres`'e ve `gina_completion_audit` şablonuna dokunulmadı; migration dosyası yazılmadı.

Komut (tek koşu, aynı tohum, A-B-A):

```sh
GINA_C13_CANDIDATE=docs/release/c13-2026-11-06/perf/candidate.sql \
GINA_C13_ROLLBACK=docs/release/c13-2026-11-06/perf/candidate-rollback.sql \
python3 scripts/security/c13-perf.py --run-local
```

- **önce** = main olduğu gibi (`perf-before.json`); **sonra** = `candidate.sql` izole DB'ye uygulanmış (`perf-after.json`); **önce-2** = `candidate-rollback.sql` ile orijinal tanımlar geri yüklenmiş (`perf-before2.json`, Docker kaymasını ölçmek için).
- REST/RPC: gerçek GoTrue token'ı ile supabase-js, 15 tekrar (42 gün: 7), ısınma çağrısı sayılmaz. EXPLAIN: aynı JWT claim'leriyle `authenticated` rolünde `explain (analyze, buffers)` + aynı transaction'da `track_functions='all'` ile **fonksiyon çağrı sayıları** (satır başına yardımcı çağrısını görünür kılar; transaction geri alınır).
- Tohum (sentetik): 250 rutin (220'si ölçülen çocukta; 60'ında 2 düzenleme → 370 sürüm satırı), 600 tamamlama, 1000 yıldız hareketi, 35 dersli ders programı + eğitim konumu (tatil penceresi dalı çalışır), 500 hazır kaynak, 500 not (%20 arşiv), 120 destek talebi + 90 ek (40 KB), 20 soruluk çizimli Prova (yanıt başına 30 çizgi ≈ 49,5 KB), backoffice'te 600 içerik satırı (100 koleksiyon + 400 eski öğe + 100 taslak paket) + 300 müfredat adayı, `content` rolünde operatör.
- 220 rutin bir çocuk için **üst sınır senaryosudur**; tipik aile 5–20 rutin. `plan_for_days` maliyeti rutin × gün ile doğrusal büyür.

## 1. Ölçümler (p50 / p95 ms; satır, bayt = yanıt JSON boyutu)

| Ekran / sorgu | Rol | Satır | Bayt | Önce | Sonra (aday) | Önce-2 (geri alındı) |
| --- | --- | --- | --- | --- | --- | --- |
| Bugün: `plan_for_days` 7 gün | cihaz | 7 | 178 979 | 277 / 479 | **120 / 134** | 275 / 321 |
| Bugün: `task_templates` | cihaz | 220 | 43 255 | 15,5 / 25,1 | 12 / 15,9 | 10 / 27,8 |
| Bugün: `task_completions` hafta | cihaz | 35 | 9 906 | 6,6 / 9 | 8,8 / 11,9 | 9,6 / 15 |
| Bugün: `child_star_balance` | cihaz | 1 | 104 | 7,1 / 11,1 | 8,1 / 9,3 | 8,2 / 9,7 |
| Bugün: 4 isteğin paralel toplamı | cihaz | 4 | 232 249 | 356 / 484 | **121 / 164** | 297 / 339 |
| Bugün (veli telefonunda çocuk modu): `plan_for_days` 7 gün | veli | 7 | 178 979 | 391 / 515 | **125 / 156** | 280 / 340 |
| Takvim haftası: 2 çocuk × `plan_for_days` 7 gün | veli | 2 | 260 505 | 282 / 419 | **130 / 178** | 287 / 327 |
| Takvim 42 gün: `plan_for_days` | veli | 42 | 1 074 143 | 1732 / 1872 | **776 / 881** | 1924 / 2089 |
| Takvim 42 gün: `plan_for_days` | cihaz | 42 | 1 074 143 | 1805 / 2060 | **799 / 976** | 1914 / 2166 |
| Görevler: `children` | veli | 2 | 222 | 7,9 / 10,5 | 7,5 / 11,8 | 6,9 / 11,6 |
| Görevler: `task_templates select *` | veli | 220 | 122 886 | 9,7 / 14,1 | 10,3 / 16,6 | 9,3 / 12,9 |
| Görevler: `routines_for_day` | veli | 220 | 71 725 | 449 / 598 | **31 / 44** | 406 / 435 |
| Prova inceleme: `exam_attempts` + gömülü | veli | 1 | 916 | 11,7 / 18,5 | 11 / 15 | 7,8 / 10,4 |
| Prova inceleme: `question_bank in (20)` | veli | 20 | 4 431 | 12,4 / 17,6 | 11,8 / 19,8 | 9,2 / 19,4 |
| Prova inceleme: `exam_answers` (çizimli) | veli | 20 | 994 052 | 44,1 / 58,3 | 37,5 / 54,9 | 33,8 / 104,4 |
| Prova inceleme: `get_answer_review` | veli | 1 | 160 | 8,1 / 11,8 | 5,5 / 6,9 | 6,3 / 9,3 |
| `get_saved_exam_answers_v3` (çizimli) | cihaz | 20 | 993 032 | 42,5 / 57,8 | 33 / 50,2 | 28,7 / 36,4 |
| `get_saved_exam_answers_v3` (çizimli) | veli | 20 | 993 032 | 44,4 / 117,5 | 32,1 / 47 | 24,3 / 36,8 |
| Backoffice: `admin_library_content_page` s.1 | operatör (content) | 50 | 21 922 | 17,1 / 32,2 | 14,7 / 20,8 | 9,4 / 14,2 |
| Backoffice: aynı, s.2 (keyset imleci) | operatör | 50 | 21 935 | 18,1 / 28 | 13,9 / 15,8 | 9,8 / 14,9 |
| Backoffice: aynı, `status=draft` | operatör | 50 | 21 922 | 13,5 / 18,9 | 13,4 / 15,3 | 10,9 / 14,6 |
| Kaynaklar (500): sayfa 0 | veli | 31 | 3 217 | 9,4 / 14,7 | 6,9 / 7,8 | 6,2 / 7,3 |
| Kaynaklar (500): offset 300 | veli | 31 | 3 256 | 8,6 / 10,6 | 5,6 / 8,1 | 6,5 / 8,2 |
| Notlar (500): etkin / çocuk / arşiv | veli | 21 | ~15 400 | 8,9–10,2 / ≤11,4 | 5,9–6,1 / ≤7,2 | 5,2–6,7 / ≤12,5 |
| Destek: `list_help_tickets` (120) | veli | 50 | 11 832 | 11,3 / 17,9 | 6,3 / 8 | 7,7 / 11,6 |
| Destek: `list_help_attachments` | veli | 3 | 492 | 8,7 / 11 | 7,6 / 9,6 | 5,2 / 5,7 |

Okuma: aday yalnız `plan_for_days` ve `routines_for_day` satırlarını değiştirir; önce-2 bu satırlarda önce değerlerine döner (275, 1914, 406 ms), diğer satırlar üç fazda aynı bantta (Docker gürültüsü ±%50). Fark adaydan gelir, ortam kaymasından değil.

## 2. EXPLAIN (ANALYZE, BUFFERS) — öne çıkanlar

| Sorgu (izole DB) | Önce: ms / shared hit | Sonra: ms / shared hit | Önce-2 | Fonksiyon çağrıları (önce → sonra; öz süre ms) |
| --- | --- | --- | --- | --- |
| `plan_for_days` 7 gün, cihaz | 419 / 8598 | 149 / 8613 | 285 / 8598 | `plan_version_on` 1547× 206 → 1547× 12; `task_routine_versions` 1540× 102 → 68 |
| `plan_for_days` 7 gün, veli | 362 / 8378 | 121 / 8393 | 284 / 8378 | `plan_version_on` 181 → 11 ms |
| `plan_for_days` 42 gün, veli | 1803 / 34 614 | 774 / 34 629 | 1611 / 34 614 | `plan_version_on` **9282×** 1057 → 75 ms; `task_routine_versions` **9240×** 475 → 406 ms |
| `plan_for_day` tek gün | 45 / 3802 | 24 / 3817 | 46 / 3802 | `plan_version_on` 221× 23 → 2 ms |
| `routines_for_day` | 545 / 10 943 | **21 / 2918** | 495 / 10 943 | `task_routine_versions`/`plan_version_on` **2640× → 220×** (220 rutin × 12) |
| `task_templates` cihaz | 7,4 / 914 | 7,5 / 914 | 7,4 / 914 | yardımcılar sabit: `claims` 21, `is_parent`/`is_device`/`device_allows` 2× (InitPlan) |
| `child_star_balance` cihaz | 10,4 / 1256 | 7,2 / 1256 | 5,7 / 1256 | yardımcılar 1× |
| `get_saved_exam_answers_v3` cihaz / veli | 5,3 / 1040 · 5,3 / 621 | 4,0 · 2,8 | 4,5 · 3,0 | yardımcılar 1× (satır başına değil) |
| `admin_library_content_page` | 17 / 3526 | 16 / 3527 | 14 / 3527 | `library_review_fingerprint` 100× (yalnız paket satırları; 1,8–3,1 ms) |
| `gina.library_content_items` görünümü, sahip | 4,1 / 1345 | 3,6 | 3,6 | — |
| Kaynaklar offset 300 | 1,7 / 262 | 1,6 | 1,5 | Seq Scan `learning_sources` 400 satır / 100 süzülen (500 satırda beklenen) |
| Notlar etkin / çocuk | 3,1 / 234 · 2,5 / 231 | 2,0 · 1,3 | 2,0 · 1,5 | Index `notes_active_page` |

Teşhis:

1. **`routines_for_day` (görev ekranı) — satır başına 12 kez çağrı.** `cross join lateral (select gina.task_routine_version_on(t.id,p_day) v) x` alt sorgusu planlayıcı tarafından düzleştiriliyor; `v` her referansta (12 alan) yeniden hesaplanıyor: 220 rutin → 2640 `task_routine_versions` + 2640 `plan_version_on`. FROM içinde fonksiyon (plan_for_day'deki biçim) satır başına bir kez çalışır: 545 → 21 ms, 10 943 → 2 918 blok; REST p50 449 → 31 ms.
2. **`plan_for_days` (Bugün + takvim) — rutin × gün çözümü.** Her gün `plan_for_day` → `plan_for_day_base` her rutin için sürüm geçmişini yeniden toplar (`task_routine_versions`) ve çözer (`plan_version_on`). 42 günde 220 rutinle 9240 çağrı. `plan_version_on`'un 3 CTE'li SQL gövdesi öz sürenin ~%60'ı idi; tek geçişli plpgsql karşılığı 1057 → 75 ms. Kalan maliyet `task_routine_versions` (9240×, ~400 ms) — bkz. §5.
3. **RLS InitPlan:** policy düzeyinde satır başına yardımcı çağrısı **yok** (aşağıda §3). Ölçülen tüm tablo okumalarında `is_parent`/`is_device`/`device_allows` istek başına 1–2 kez, `claims` sabit sayıda çağrılıyor.
4. **Büyük yanıtlar (DB değil, aktarım):** 20 çizimli yanıt ≈ **994 KB** (`exam_answers` ve `get_saved_exam_answers_v3`; EXPLAIN 2–5 ms, REST 30–45 ms serileştirme/aktarım). `plan_for_days` 42 gün **1,07 MB**, 7 gün 179 KB: her gün tam `timetable.lessons` (35 ders, açıklamalı) + rutin listesi tekrarlanıyor. Mobil ağda bu boyutlar DB süresinden baskın olur.
5. Küçük: cihazın `task_templates` okumasında politika alt sorgusu `task_completions` üzerinde Seq Scan yapıyor (600 satır, 7 ms; filtre InitPlan'lı `family_id`/`child_id`). Bu hacimde planlayıcı seçimi; büyüyen tamamlama geçmişinde `task_completions_child_date_idx` beklenir — üretimde `pg_stat_statements` ile izlenmeli.

## 3. RLS politika denetimi (çıplak yardımcı çağrısı)

`pg_policies` (public, gina, storage) okundu; `gina.*()` / `auth.uid|jwt|role()` (ve sabit argümanlı `gina.f('x')`) çağrısının `( SELECT … )` sarmalı olmadan geçtiği politika arandı (`qual` ve `with_check`):

- **112 politika, çıplak çağrı: 0.** 20261106180000..20261106320000 aralığında tanımlanan politikalarda da 0. Q02-1 (`20261106130000`) sonrası eklenen politikalar InitPlan biçimini korumuş.
- Fonksiyon gövdeleri: ölçülen SECURITY DEFINER fonksiyonlarda yardımcılar istek başına 1× (`get_saved_exam_answers_v3`, `child_star_balance`, `list_help_*`, `admin_library_content_page`). İstisna `plan_for_days`: `is_parent`/`is_device` yetki kontrolü gün başına 1× (42 günde 42×, ~8 ms) — düşük.

## 4. Aday (`candidate.sql`) ve eşdeğerlik kanıtı

`docs/release/c13-2026-11-06/perf/candidate.sql` — migration değil; koordinatör `20261106330000_c13_hardening.sql`'e katabilir.

1. `public.routines_for_day`: gövde aynı, yalnız `cross join lateral gina.task_routine_version_on(t.id,p_day) v` (FROM içinde fonksiyon).
2. `gina.plan_version_on`: aynı kural, tek geçişli plpgsql (SPI sorgusu yok). `known` = `eff<=gün` içinde (eff desc, revision desc NULLS FIRST) ilk; `earliest` = (eff asc, revision asc NULLS LAST) ilk; `next_known` = en küçük start. `immutable`, `search_path=''`, revoke korunur.

Eşdeğerlik (aynı koşu, `perf-before.json` → `seed`):
- `plan_version_on`: 4000 rastgele girdi (3620'si sürümlü; null effective_from/known_since, null revision, karışık sıra) orijinal gövdeyle hesaplandı, aday uygulandıktan sonra yeniden: **0 fark**.
- REST yanıtlarının sha256'sı önce = sonra: `plan_for_days` 42 gün (veli) ve 7 gün (cihaz), `routines_for_day` bugün / −60 / +200 gün, `plan_for_day` −150 gün (`unknown_before` dalı): **6/6 aynı**.
- Yetki/sahiplik: `create or replace` mevcut grant/revoke'u korur; `plan_version_on` için revoke tekrarlandı. pgTAP 096 `resolver private` assertion'ı bu durumu kontrol eder. Koordinatör katarsa bu fonksiyonları kullanan pgTAP 096, 109 ve 117 yeniden koşulmalı.

## 5. Açık kalanlar

- **`plan_for_days` yapısal maliyeti:** aday sonrası 42 gün/220 rutin ≈ 0,8 s (yerel). Kalan `task_routine_versions` gün başına yeniden toplanıyor; kalıcı çözüm pencere için her rutinin sürümlerini **bir kez** toplayıp günlere dağıtan küme tabanlı bir `plan_for_days` (çıktı sözleşmesi aynı). Tipik ailede (≤20 rutin) maliyet ~10 kat düşük; P2 öneri, bu kartta yazılmadı.
- **Yanıt boyutu:** 42 gün 1,07 MB / 7 gün 179 KB (`timetable.lessons` her günde tekrarlı); Prova inceleme ilk açılışta tüm çizimleri (~1 MB/20 soru) çekiyor. Sözleşme değişikliği gerektirir (gün başına yalnız `day_lessons`, çizimi soru açılınca yükleme) — ürün/istemci kararı.
- **Fiziksel cihaz** dokunma/çizim gecikmesi, kare hızı ve tablet ağ (Wi-Fi/4G) gecikmesi burada ölçülemez; açık.
- Üretim hacmi/donanımı ve `pg_stat_statements` ölçümü yok; buradaki değerler yerel, gürültülü ve göreli.
- Backoffice: yayınlanmış paket (`library_review_fingerprint` + varlık kontrolü dalı) tohumlanmadı; 100 taslak pakette 1,8–3,1 ms. Yayın akışlı büyük katalog ayrıca ölçülmeli.
- Altyapı notu: `scripts/q02_isolated.py` çapaları güncel `scripts/test-isolated-services.py` ile artık eşleşmiyor (Node zaman aşımı 180 → 420 s, `grant all on auth.users`). `scripts/security/c13-perf.py` önce q02 başlatıcısını dener, çapa eksikse aynı tekniği güncel çapalarla uygular (paylaşılan dosyalar değiştirilmedi). `test-q02-perf.py` vb. q02 başlatıcısını kullanan koşucular şu an çalışmaz.
