# H08a — pgTAP `--fresh` farkı (066 / 069) kök neden ve düzeltme

6 Kasım 2026. Kapsam: yalnız pgTAP test dosyaları. Migration, Edge, istemci ve üretim değişmedi.

## Belirti

- `python3 scripts/test-q02-sql.py --run-local --fresh` (şablondaki public/gina şemasını atıp 155 migration'ı sıfırdan uygular):
  133 dosya, 6090 doğrulama, **2 dosya kırık** — bu ikisi dışında fresh'e özgü başka hata yok (tam suite tarandı):
  - `066_weekly_summary_safety`: 32 "global pause prevents provider reservation", 33 "monthly quota before second week provider",
    34 "uncertain provider outcome recorded", 35 "uncertain request not automatically recharged".
  - `069_learning_plan_import`: `ERROR: plan_import_unavailable` — `apply_learning_plan_import` satır 16 (iş `done` değil).
- Varsayılan (şablon tabanlı) koşu: 133 dosya, 0 hata.

## Kök neden: test fikstürünün şablon verisine bağımlılığı (migration hatası değil)

İki yerel DB kuruldu (şablon + migration'lar / fresh) ve tohum tabloları karşılaştırıldı
(`app_settings`, `ai_models`, `ai_providers`, `ai_settings`, `ai_operation_policies`, `ai_provider_health`).
Tek içerik farkı `public.app_settings`:

| anahtar | şablon | fresh | kaynak |
|---|---|---|---|
| `ai.enabled` | `true` | **yok** | `supabase/seed.sql` |
| `ai.default_model`, `ai.weekly_summary_day`, `tasks.max_stars`, `app.min_supported_version` | var | yok | `supabase/seed.sql` |

`gina_completion_audit` şablonu `supabase db reset` ile kurulmuş; reset migration'lardan sonra `seed.sql`'i de çalıştırır
(`config.toml [db.seed] sql_paths = ["./seed.sql"]`). Hiçbir migration `ai.enabled` satırı eklemez. Testler kill switch'i
`update public.app_settings set value='false' where key='ai.enabled'` ile kapatıyordu; fresh DB'de satır olmadığından UPDATE
0 satır etkiledi, AI kapanmadı:

- 066/32: rezervasyon `ai_disabled` yerine iş açtı → kota sayacı ve sonraki 33–35 zincirleme kaydı.
- 069: "AI pause" adımı da etkisiz kaldı; zincir sonunda iş `done` olmadığından `apply` `plan_import_unavailable` verdi.
- Ek bulgu: `058_generation_recovery` ("completed result available with AI disabled") ve `070_weekly_summary_reader`
  ("saved job readable after plan downgrade and AI shutdown") fresh'te **yanlış nedenle geçiyordu** (AI aslında kapanmamıştı).
  `099_shared_limits` aynı kalıbı (`set value='true'`) kullanıyordu; sonucu etkilemiyordu ama aynı şekilde düzeltildi.
- Test sırası/saat bağımlılığı yok: hata deterministik, iki saat diliminde aynı.

## Üretim / taze geri yükleme etkisi (yalnız migration okunarak; üretim sorgulanmadı)

Gerçek kusur yok. Bütün okuyucular satır **yoksa AI açık** sayar ve kill switch satırı **upsert** ile yazar:

- SQL: `value='false'` varlık kontrolleri (`reserve_ai_operation`, `reserve_learning_plan_import`, weekly reader) ve
  `coalesce(... <> 'false', true)` (`ai_provider_matrix`, `ai_routing_and_grade_split`, `prereview_activation_readiness`).
- Edge `_shared/prova.ts resolveAi`: `global && global.value === false` ise kapalı.
- Backoffice `pages/ai.tsx`, `content-prereview.tsx`: `value !== false` → açık.
- Yazma: `public.admin_set_ai_enabled` → `insert ... on conflict (key) do update` (satır yoksa da çalışır).
- Diğer dört seed anahtarı uygulama/Edge/migration kodunda hiç okunmuyor.

Üretimde `seed.sql` çalıştırılıp çalıştırılmadığı migration'lardan bilinemez; iki durumda da davranış aynıdır.
Bu yüzden 20261106495000 slotuna migration **eklenmedi**: satır eksikse eklemek üretimde veri (ve `app_settings`
denetim kaydı) değiştirirdi; davranışa katkısı sıfır.

## Düzeltme: testler kendi kendine yeterli

`supabase/tests/{058,066,069,070,099}_*.test.sql`: `ai.enabled` güncellemeleri
`insert into public.app_settings(key,value) values('ai.enabled','<v>') on conflict (key) do update set value=excluded.value`
oldu (`sources.enabled` gibi migration'la gelen anahtarlar UPDATE ile kaldı). Testler `begin … rollback` içinde; şablon
değişmez. Test sayısı ve beklentiler aynı.

## Kanıt

Tek dosya fresh (Europe/Istanbul): 058 36/36, 066 46/46, 069 42/42, 070 34/34, 099 46/46, 0 hata.

Tam koşular (çıktılar bu klasörde):

| koşu | saat dilimi | dosya | doğrulama | hata | çıktı |
|---|---|---|---|---|---|
| düzeltme öncesi `--fresh` | Europe/Istanbul | 133 | 6090 | 066 (4), 069 (ERROR) | `sql-checks-fresh-before-fix.json` |
| `--fresh` | Europe/Istanbul | 133 | 6136 | 0 | `istanbul/sql-checks-fresh.json` |
| `--fresh` | UTC | 133 | 6136 | 0 | `utc/sql-checks-fresh.json` |
| varsayılan (şablon) | Europe/Istanbul | 133 | 6136 | 0 | `istanbul/sql-checks.json` |
| varsayılan (şablon) | UTC | 133 | 6136 | 0 | `utc/sql-checks.json` (ardışık iki tekrar da 0) |

Not: dört tam koşu aynı anda (paralel) başlatıldığında varsayılan+UTC koşusu bir kez `116_channel_ui_support` test 1'de
("anon may still only run the share view…") düştü (`utc/sql-checks-parallel-first-attempt.json`). Tek başına `--only 116`
ve tam suite iki kez ardışık tekrarlandı: 0 hata; yeniden üretilemedi. Testler kümede paylaşılan `anon` rolünün yetkisini okur;
aynı Docker kümesinde başka ajanların eşzamanlı harness'leri olası etken. Kalıcı kusur olarak değerlendirilmedi, izlenmeli.

## Sınırlar

- Yalnız yerel tek kullanımlık DB; üretim DB'si okunmadı/yazılmadı. Üretimde `ai.enabled` satırının varlığı doğrulanmadı (gerekmiyor).
- `scripts/test-isolated-services.py` / Playwright harness'leri bu kartta koşulmadı (migration/şema değişmedi).
- Kalıcı koruma önerisi (yapılmadı): runner'a "testin UPDATE ettiği `app_settings` anahtarı migration'larda tohumlanmış mı"
  denetimi, ya da CI'da `--fresh` koşusu.
