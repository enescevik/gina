# C08 — AI yönlendirme, kota ve ortak hata sözleşmesi (S06/U09/Q02) + C04 kalan sınır 3 — 6 Kasım 2026

| Alan | Durum |
|---|---|
| Eski görev bağı | S06 (çok sağlayıcı), U09/U08 (ortak hata sözleşmesi + sınırlar), Q02 (izole kabul), C04 kalan sınır 3 (`apply_ai_grades` AI puanını `score`'a yazıyordu) |
| Kod | **KOD HAZIR** |
| Test | **TEST EDİLDİ — izole (deterministik sağlayıcı)**. Gerçek sağlayıcı sözleşme testi **BEKLİYOR** (aşağıda) |
| Yayın | **Yayımlanmadı.** Migration üretime uygulanmadı, Edge dağıtılmadı, main'e push yok |
| Dal | `worktree-agent-a8b9664a95aa16e3f` (main `11c7f45` birleştirildi; C07 `20261106270000` ve C10 `20261106300000` dahil) |

## Gerçek / taklit ayrımı (net)

| Ne | Gerçek mi? |
|---|---|
| Postgres fonksiyonları, RLS, tetikleyiciler, pgTAP | Gerçek (tek kullanımlık şablon klonu DB, iki saat dilimi) |
| Auth/PostgREST/Storage/Edge handler'ları | Gerçek yerel konteynerler + değişmemiş üretim handler'ları (`scripts/test-isolated-services.py --with-storage`) |
| AI sağlayıcısı | **Taklit:** `scripts/isolated-ai-provider.ts` deterministik sınır (yalnız loopback). Hata enjeksiyonu (429/503/zaman aşımı/yanıt kaybı/bozuk JSON) bu sınırda yapılır |
| Gövdesiz gateway 401 | **Taklit:** Playwright, ilk `prova-review` isteğine gövdesiz 401 döner (hosted `verify_jwt` reddinin benzetimi). Yenilemeden sonraki ikinci `prova-review` yanıtı **sentetiktir** (yerel Edge'de bu uç kayıtlı değil). Oturum yenileme isteği gerçek yerel Auth'a gider |
| Gerçek Anthropic çağrısı | **Yapılmadı — BEKLİYOR: sağlayıcı anahtarı izole ortama verilmedi.** `.codex-setup/.env.server` içinde Anthropic anahtarı yok (yalnız ad listesine bakıldı, değer okunmadı); GINA anahtarı Supabase secrets'ta ve okunamıyor. Ajan oturumunun kendi çalışma ortamında bir `ANTHROPIC_API_KEY` değişkeni var; GINA'ya ait olmadığı için **kullanılmadı** |
| OpenAI / Gemini | X04 **BEKLİYOR** — anahtar yok, `ai_providers.status='unconfigured'`; hiçbir model etkinleştirilmedi. Adapter yalnız sahte sunucuyla sınandı |

## Yapılanlar

### 1. Sağlayıcıdan bağımsız yönlendirme (Anthropic sabiti kaldırıldı)
- `apiKeyOrResponse(config, env?)`: secret adı çözülmüş adapter'dan (`PROVIDER_DEFAULTS` = `ai_providers` tohumu). Bütün AI uçları artık `apiKeyOrResponse(ai|config)` çağırır: `prova-generate`, `prova-grade`, `prova-plan`, `prova-review`, `setup-suggestions`, `timetable-import`, `ai-weekly-summary` (hazırlanan bağlamın adapter'ı farklıysa ona göre), `learning-plan-import` (bağlamın config'i), `ai-preflight`. OpenAI anahtarı yoksa Anthropic anahtarına **düşmez** (`provider_unconfigured`).
- `_shared/ai-route.ts` `generateWith(config)`: üretim çözülmüş adapter'la; `prova-generate`, `setup-suggestions`, `ai-preflight` artık `callClaude`'u doğrudan çağırmaz. `prova-generate` hata sınıflandırması `classifyAiError` (anthropic_/openai_/gemini_ aynı kural).
- DB (`20261106290000_ai_routing_and_grade_split.sql`):
  - `ai_operation_jobs.provider`, `prova_generation_jobs.provider` (null = C08 öncesi Anthropic işi; yeniden yazma yok).
  - Devre kesici sağlayıcı başına: `gina.ai_provider_outcome/ai_provider_paused/ai_breaker_code/ai_error_provider`; `finish_ai_operation`, `fail_prova_generation_v2`, `complete_prova_generation_v2` işin sağlayıcısına yazar. `ai_provider_health` her sağlayıcı için satır + FK.
  - `reserve_ai_operation(..., p_provider default null)`; verilmezse ailenin etkin modelinin sağlayıcısı. Etkin olmayan sağlayıcıya iş açılmaz (`provider_unconfigured`).
  - `reserve_weekly_summary` / `reserve_learning_plan_import`: `provider='anthropic'` yerine bağlam modelinin **desteklenen** (`gina.ai_model_support`) olması ve sağlayıcı eşleşmesi (`gina.ai_context_provider`).
  - `reserve_child_ai_operation` imzası bilinçli olarak **değişmedi** (mevcut 079 yetki testi); sağlayıcıyı ailenin aynı anda çözülen modelinden alır.
  - `reserve_prova_generation_v2` sağlayıcıyı aileden çözer ve işe yazar.
- C07'nin yeniden tanımladığı hiçbir `admin_*` fonksiyonu bu migration'da tanımlanmadı (kesişim kontrol edildi; pgTAP 113 191/191).

### 2. Özellik → yetenek → paket → girdi sınırı tek kaynak; mobil kullanım
- `get_ai_usage()` genişledi: `features[]` (offered / in_plan / girdi türleri / available — model desteği DB'de hesaplanır, model/sağlayıcı adı dönmez), `media` (`shared_source_limits('import')`, dosya seçiciyle aynı okuyucu), `paused`.
- Core `ai-usage.ts`: `parseAiUsage`, `aiUsageRows` (yalnız sunulan + kullanılabilir özellik satırları). Mobil `components/subscription/ai-usage-card.tsx` → `app/parent/subscription.tsx`: kullanım/limit/kalan, yenilenme tarihi, medya açıklaması, "hak harcamaz / aynı istek tek hak" notu, duraklatma uyarısı.

### 3. `daily_tips` kararı
DECISIONS satır 31 "Pro: haftalık özet + 7 günlük ipucu" yazıyor; satır 62'deki onaylı paket özeti Pro'yu "8 çocuk, Sonnet + fotoğraftan takvim 20/ay" olarak sayar. Kodda ayrı uç/kota/ekran yok (`entry_point null`, limit 0), `plans` tablosunda bayrak yok, mobil paket ekranı da vaat etmiyor ("Haftalık aile özeti" dışında AI satırı yok). Karar: **ekranda vaat edilmiyor → çalışıyor görünmesin.** `ai_feature_requirements.offered=false` (DB) = core `offered:false`; kullanım kartı ve `get_ai_usage` onu kullanılabilir göstermez (Playwright: sayfada "ipucu" yok). Ürün olarak açılacaksa öneri: Pro haftalık özet şemasına 7 günlük ipucu alanı (aynı `weekly` hakkı) + haftalık özet ekranında gösterim — **Enes kararı gerekir**.

### 4. Ortak `code/category/retryable` sözleşmesi
- Kalan uçlar `fail()` + `parentOrResponse`: `prova-generate`, `prova-grade` (ham `e.message` sızıntısı izin listesine bağlandı), `prova-plan`, `prova-review`, `ai-weekly-summary` (handler+index), `_shared/generation-result.ts`, `_shared/prova-generation-scope.ts`. Eski `error` alanı ve HTTP durumları aynı; `plan`/`max` gibi sabit eski alanlar `legacy` + `details`.
- Core `ERROR_CODE_RULES` yeni kodlar (paket kapıları, `answer_changed`, `ai_suggestion_changed` …) ve `errorAction()` (refresh_session / sign_in / retry / fix_input / upgrade / none).
- İstemci `lib/prova-ai.ts`: `ProvaAiError` kategori/retryable/eylem taşır; özel çeviri yoksa kategori metni (ham kod/JSON değil). **Gövdesiz 401 (gateway) veya `session_expired` → oturum bir kez yenilenir ve aynı gövde bir kez tekrar gönderilir**; çağıranın taslağı/state'i dokunulmaz; belirsiz ücretli sonuçta otomatik tekrar yok.
- `gina.check_input_range()` bağlandı: `gina.enforce_input_ranges()` tetikleyicisi — `family_rewards.cost_stars` (reward_cost_stars), `task_templates.stars` (task_stars), `group_exams.duration_minutes`, `exams.duration_minutes` (prova_minutes 1–180). Yalnız değişen değer denetlenir (eski satır yeniden doğrulanmaz/yazılmaz); mesaj `invalid_input` + alan/min/max, SQLSTATE eski kısıtla aynı `23514`.

### 5. Çoklu belge sınırı (varsayılan 5, yönetim = istemci = sunucu)
Sunucu tarafı U08'den; bu işte mobil `source-files-picker.tsx` toplam bayt tavanını sabit 20 MiB yerine `readSourceLimits(get_learning_source_policy())`'den okur (dar politika artık istemcide de aynı). Not: bu dosya kart sahiplik listesinde değildi; kart kapsamındaki tek satırlık sınır düzeltmesi.

### 6. AI puanı öneri, veli puanı kesin (C04 kalan sınır 3)
- `apply_ai_grades`: yalnız `ai_score/ai_feedback/ai_details/ai_graded_at`; `score/feedback/graded_by/graded_at` ve inceleme revizyonu değişmez → deneme veli onayına kadar ara sonuç.
- `accept_ai_grade(attempt, question, p_expected)`: veli ekrandaki öneriyi kesinleştirir (öneri değiştiyse `ai_suggestion_changed`, çift onay idempotent). Velinin kendi puanı mevcut `save_answer_review`/`score_open_answer` yolundan.
- Okuyucular: `child_topic_mastery` artık `coalesce(score, ai_score)` değil yalnız `score`; `get_attempt_summary` soru başına `ai_score`, `ai_suggested`, `legacy_ai`, `ai_suggestion_count` (yalnız veli/servis). `get_attempt_topic_stats`/plan `score` okur → öneri plan girdisi olmaz.
- **Eski `graded_by='ai'` satırları yeniden yazılmadı**: `score`'ları eskisi gibi okunur (044/063/108 testleri değişmeden geçer), özet `legacy_ai=true`, mobil "Eski AI puanı" etiketi.
- Mobil: inceleme çalışma alanı AI önerisini ayrı gösterir + "Öneriyi puan alanına al (70)" düğmesi (yalnız alanı doldurur; veli kaydedince kesinleşir); deneme özeti "AI önerisi 70/100 · onayın bekleniyor". `prova-grade` yanıtına `suggested`, `final:false`.
- 008 ve 101 pgTAP yeni anlama göre güncellendi (AI önerisi ara sonuç, veli onayı → graded).

## Testler (gerçekten çalıştırıldı, birleştirilmiş dal `534fd90`)

```
pgTAP 115_ai_routing_and_grade_split (izole DB)                → 66/66
python3 scripts/test-q02-sql.py --run-local (Europe/Istanbul)  → 114 dosya, 4785 assertion, 0 hata   [tz-istanbul/sql-checks.json]
python3 scripts/test-q02-sql.py --run-local --timezone UTC     → 114 dosya, 4785 assertion, 0 hata   [tz-utc/sql-checks.json]
  (008: 27, 101: 49, 113 C07: 191, 115: 66, 116 C10: 81)
CI deno check (ci.yml satır 51, tüm giriş noktaları)            → 0 hata
CI deno test batch 1 (+ yeni ai-route.test.ts, ai-provider.test.ts) → 251 passed, 0 failed
CI deno test diğer batch'ler                                   → 28 / 54 / 10 / 13 / 23 passed, 0 failed
pnpm --filter @gina/core exec vitest run                       → 404 passed (yeni ai-usage.test.ts dahil); core typecheck temiz
apps/mobile: npx tsc --noEmit → 0; npx expo lint → 0
python3 scripts/test-isolated-services.py --run-local --with-storage → 379/379 kontrol, 104'ü c08_*; cleanup tümü true   [services.json]
Playwright (expo web export + --ui-hold izole servis, Chrome headless) → 7/7   [ui/ui-checks.json, ui/*.png]
```

İzole C08 kontrolleri (`scripts/isolated-c08-contract.mjs`, gerçek Edge → deterministik sağlayıcı):
- `get_ai_usage`: daily_tips sunulmuyor; Pro özellikleri kullanılabilir; medya 5 dosya; seçici ile aynı sınır; çocuk okuyamaz; model/sağlayıcı adı yok.
- Dosya: 6 kaynak + bozuk PNG yüklendi; bozuk belge sözleşmeli gövdeyle reddedildi; 1 ve 5 dosyalı set kabul, 6 → `source_file_limit`; yönetim `sources.max_files=3` → seçici ve kullanım ekranı aynı anda 3.
- 5 dosyalı analiz gerçek `timetable-import` ile tek sağlayıcı çağrısı; **kota önizlemesi** tam 1 düştü.
- **Toplam boyut:** (geçici tam yönetici, RLS'li politika satırı) Pro `import.max_media_bytes` tek dosyaya indirildi → kullanım ekranı yeni tavanı gösterir; Edge `source_size_or_type`/`validation`, sağlayıcıya istek yok.
- Hata matrisi (her biri tek ücretli istek, sözleşmeli gövde, `retryable=false`): 429 → `generation_failed` + iş `failed`; 503 / zaman aşımı / yanıt kaybı / bozuk JSON → `ai_result_uncertain` + iş `uncertain` + `provider='anthropic'`; aynı isteğin tekrarı **ikinci ücretli çağrı yapmaz** (`ai_result_uncertain`), başka sağlayıcıya fallback yok.
- Devre kesici: 3 belirsiz sonuç → sonraki istek `ai_temporarily_unavailable` (retryable), sağlayıcıya gitmez; `get_ai_usage.paused=true`.
- Çift istek (eşzamanlı aynı gövde) → tek ücretli çağrı; biri sonuç, diğeri sonuç veya `generation_in_progress`.
- AI puanı: `prova-grade` Edge → `final:false`, satırda `score=null, ai_score=70, graded_by=null`; özet `ai_suggested`; çocuk özetinde öneri yok; eski öneriyle onay reddi; çocuk onaylayamaz; veli onayı → `score=70, graded_by=parent`, deneme `graded`; çift onay revizyonu artırmaz; tekrar AI puanlama veli puanını ezmez.

Playwright (390×844 · 768×1024 · 1280×800, yatay taşma yok, çevrilmemiş anahtar yok): kullanım kartı sayıları `get_ai_usage` ile birebir; "ipucu" görünmez; deneme ekranında öneri onay bekliyor; **gövdesiz 401 → 1 yenileme → aynı gövdeyle tek tekrar → geri bildirim taslağı korunur**; "Öneriyi puan alanına al (70)" → "Kaydet ve özete dön" → DB `70/parent`, özet `graded`, öneri etiketi kalkar; sayfa hatası yok.

Deno birim (`_shared/ai-route.test.ts`): secret adı adapter'dan (OpenAI anahtarı yokken Anthropic anahtarı okunmaz), `generateWith` yönlendirme/kayıtsız adapter, rezervasyona `p_provider` (çocuk yolu hariç), duraklatılmış/yapılandırılmamış sağlayıcı istek öncesi sözleşmeli 503, OpenAI adapter üzerinden 429/503/zaman aşımı/kayıp/bozuk JSON tek istek.

pgTAP 115 kapsamı: sağlayıcı sütunları/sağlık satırları; hata öneki ve kesici kodları; unconfigured sağlayıcıya iş yok; bilinmeyen sağlayıcı reddi; OpenAI 3 belirsiz → yalnız OpenAI duraklar, Anthropic çalışır; başarı diğer sağlayıcı sayacını sıfırlamaz; eski (provider null) iş Anthropic'e yazılır; bağlam modeli desteği; üretim işi sağlayıcısı ve belirsiz tekrar yok; yetki (istemci rezervasyon/sağlık yazamaz, anonim onaylayamaz); kullanım (Plus/Pro/Free, daily_tips, medya, yönetim 3 dosya, çocuk reddi); giriş aralığı (501/500, 181/40, eski satır yeniden doğrulanmaz); AI öneri/onay/çift onay/başka aile/cihaz; eski AI kaydı.

## Değişen dosyalar
- `supabase/migrations/20261106290000_ai_routing_and_grade_split.sql`, `supabase/tests/115_ai_routing_and_grade_split.test.sql`, `supabase/tests/{008_prova_ai,101_open_answer_pending_score}.test.sql`
- `supabase/functions/_shared/{prova,ai-operation,ai-route(yeni),ai-route.test(yeni),generation-result,generation-result.test,prova-generation-scope}.ts`
- `supabase/functions/{prova-generate,prova-grade,prova-plan,prova-review}/index.ts`, `ai-weekly-summary/{handler,index}.ts`, `learning-plan-import/handler.ts`, `setup-suggestions/handler.ts`, `timetable-import/handler.ts`, `ai-preflight/{index,feature-smoke}.ts`
- `packages/core/src/{ai-capabilities,shared-limits,attempt-summary,index}.ts`, `ai-usage.ts` + `ai-usage.test.ts` (yeni), `i18n/{tr,en}.json` (yalnız 27 yeni anahtar)
- `apps/mobile/src/app/parent/subscription.tsx`, `components/subscription/ai-usage-card.tsx` (yeni), `lib/prova-ai.ts`, `components/learning/parent-review-workspace.tsx`, `app/parent/prova/attempt/[attemptId].tsx`, `components/learning/source-files-picker.tsx`
- `scripts/{isolated-c08-contract.mjs(yeni),isolated-ai-provider.ts,isolated-source-edge.ts,test-isolated-services.mjs,test-isolated-services.py}` (Node süre sınırı 180→420 s), `.github/workflows/ci.yml` (iki Deno test dosyası)
- Bu rapor, `ui/` (betikler + 10 görüntü + `ui-checks.json`), `services.json`, `services-ui-hold.json` (birleştirme öncesi UI tutma koşusu, 381/381), `tz-istanbul/`, `tz-utc/`

Backoffice'e dokunulmadı. Kendi DB'leri (`gina_c08_*`, `gina_q02sql_*`, `gina_http_*`) ve konteynerleri silindi; makinede kalan `gina_http_fed3d…` başka bir ajana ait.

## Kalan sınır
1. **Gerçek Anthropic sözleşme testi BEKLİYOR** — GINA anahtarı izole Edge'e verilmedi. Anahtar geçici env olarak verildiğinde: `ai-preflight` (`smoke`, `document-smoke`, `weekly-smoke`…) artık çözülmüş adapter ile çalışır; birkaç sentetik çağrı yeterli.
2. **OpenAI/Gemini BEKLİYOR (X04)** — etkinleştirme yok.
3. **daily_tips:** sunulmuyor olarak işaretlendi; DECISIONS'taki "7 günlük ipucu" vaadi ya geri çekilmeli ya da haftalık özetle birlikte üretilip haftalık özet ekranında gösterilmeli (ürün kararı).
4. Gateway 401 yalnız web export + Playwright route ile benzetildi; hosted gateway ve fiziksel cihaz denemesi yok (C15).
5. `content-prereview` (C09 sahipliği) hâlâ parametresiz `apiKeyOrResponse`/`callClaude` kullanır (Anthropic varsayılanı, davranış değişmedi); `ai-preflight` operatör model listesi kontrolü Anthropic'e özeldir.
6. `setup-suggestions` sağlayıcı hatasında (429 dahil) işi belirsiz sayar (önceki muhafazakâr davranış korundu; `finish_setup_generation` yalnız belirsizlik bayrağı alır).
7. Migration üretime uygulanmadı; sıra: migration → Edge dağıtımı (yeni `p_provider` parametreleri varsayılanlı; eski Edge yeni DB ile çalışır, yeni Edge eski DB ile çalışmaz).
