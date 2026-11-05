# S06 — Çok sağlayıcılı AI ve işletim politikaları (sunucu) — 6 Kasım 2026

Durum: **KOD HAZIR, TEST EDİLDİ (izole), YAYIMLANMADI.** Gerçek sağlayıcı anahtarı yok — **X04 BEKLİYOR.** **UI bağlanmadı** (backoffice `pages/{ai,operations}.tsx` ve mobil ekranlar bu işte değiştirilmedi; sabah ayrı iş). Gerçek ücretli AI çağrısı yapılmadı; bütün sağlayıcı testleri sahte `fetch` ile.

Dal: `worktree-agent-a3b064d2c6d4c25e8` (main'e push edilmedi). Migration: `supabase/migrations/20261106060000_ai_provider_matrix.sql`. pgTAP: `supabase/tests/092_ai_provider_matrix.test.sql`.

## Değişen dosyalar

| Alan | Dosya | İçerik |
|---|---|---|
| Core | `packages/core/src/ai-capabilities.ts` (+ `.test.ts`, `index.ts` export) | Özellik → girdi → yetenek matrisi, sağlayıcı kayıtları (yalnız secret adı), paket sınırı varsayılanları, `modelSupport`, `featureSupport`, `modelDisablePreview`, `providerChangeImpact`, `mediaWithinLimit`, `estimateTokens`, `usageRow` |
| Edge | `supabase/functions/_shared/ai-provider.ts` | Ortak `AiAdapter` arayüzü (`countTokens`, `generate`, secret adı, tokenizer), adapter kaydı, `classifyAiError`, `adapterKey` (`provider_unconfigured`), `parseStructuredText` |
| Edge | `_shared/ai-adapter-anthropic.ts` | Mevcut `callClaude`'u değiştirmeden sarmalar |
| Edge | `_shared/ai-adapter-openai.ts` | OpenAI-uyumlu Chat Completions iskeleti: `response_format json_schema strict`, görsel `image_url`, PDF `file`; tokenizer tahmin; `OPENAI_API_KEY` adı |
| Edge | `_shared/ai-adapter-gemini.ts` | Gemini `countTokens` + `generateContent` iskeleti: `responseSchema`, `inlineData`; anahtar başlıkta; `GEMINI_API_KEY` adı |
| Edge | `_shared/ai-adapters.ts` | Tek kayıt listesi (yeni adapter = dosya + içe aktarma + sözleşme testi + yetenek beyanı) |
| Edge | `_shared/ai-operation.ts` | `runAiOperation` adapter üzerinden üretir; adapter yoksa rezervasyon yapmadan `ai_model_unsupported`; hata sınıflandırması ortak; iş hash'i eski alanlarla aynı (mevcut idempotency korunur) |
| Edge | `_shared/prova.ts` | `AiConfig` + `adapter/provider/capabilities`; `resolveAi` yetenek/sözleşme/sağlayıcı denetimi (`ai_model_unsupported` + nedenler + etkilenen özellikler); `apiKeyOrResponse(config?)` adapter'a göre secret adı |
| DB | `20261106060000_ai_provider_matrix.sql` | `ai_providers`, `ai_models` yetenek/sözleşme sütunları, `ai_feature_requirements`, politika satırında medya sınırı, `gina.ai_model_support`, model/ayar koruyucu tetikleyicileri, `admin_model_disable_preview`, `admin_provider_change_impact`, `admin_ai_policy_matrix`, `admin_ai_failed_operations`, `get_ai_usage` |
| Test | `_shared/ai-provider.test.ts`, `092_ai_provider_matrix.test.sql`, `ai-capabilities.test.ts` | Aşağıda |
| Doc | `docs/learning/AI-RESILIENCE-ACCEPTANCE.md` | S06 bölümü eklendi |

## Yetenek matrisi (özellik → girdi → gereken yetenek → paket)

Kaynak: `FEATURE_MATRIX` (core) = `public.ai_feature_requirements` (DB tohumu). Çıktı her satırda JSON şema ister.

| Özellik | Girdi | Gereken | Paket | Eylem / uç nokta | Aylık sınır (free/plus/pro) |
|---|---|---|---|---|---|
| Haftalık özet `weekly_summary` | metin | bağlam ≥16k | plus, pro | `weekly` / `ai-weekly-summary` | 0 / 5 / 5 |
| 7 günlük ipucu `daily_tips` | metin | bağlam ≥16k | pro | `weekly` / **ayrı uç nokta yok** | 0 / 0 / 0 (haftalık özet içinde `veliye_oneriler`) |
| Fotoğraftan takvim `photo_calendar` | görsel | vision, ≥32k | plus, pro | `import` / `timetable-import` | 0 / 5 / 20 |
| Belge analizi `document_analysis` | görsel / PDF | vision / pdf, ≥32k / ≥64k | plus, pro | `learning_import` (DB'de `import` politikasını paylaşır) / `learning-plan-import` | 0 / 5 / 20 |
| Soru üretimi `question_generation` | metin / görsel / PDF | — / vision / pdf | plus, pro | `generate` / `prova-generate` | 0 / 100 / 300 (`plans.prova_ai_generate_monthly` + bonus) |
| Açık uçlu puanlama `open_ended_grading` | metin / görsel (defter PNG) | — / vision | pro | `grade` / `prova-grade`, `prova-review` | 0 / 0 / 30 |
| Plan `study_plan` | metin | ≥32k | pro | `plan` / `prova-plan` | 0 / 0 / 30 |
| Ön inceleme `pre_review` | metin / görsel / PDF | vision / pdf | yalnız yönetici | `preflight` / `ai-preflight` | paket dışı |
| Kurulum önerisi `setup_suggestions` | metin / görsel / PDF | vision / pdf | plus, pro | `setup` / `setup-suggestions` | 0 / 10 / 30 (`plans.setup_ai_monthly`) |

Medya: görsel ≤ 4 MB, PDF ≤ 10 MB (`source-file.ts`), en çok 5 dosya (`sources.max_files`); politika satırında `max_media_items/max_media_bytes` olarak okunur. Token sınırları `ai_settings.max_input_tokens/max_output_tokens` (varsayılan 8000/1500).

### Model desteği kuralı

`ai_models` satırı **yalnız adıyla etkinleşmez.** `gina.ai_model_support(m)` ve core `modelSupport` aynı kuralı uygular:

- `adapter` dolu ve Edge kayıt listesinde (`anthropic-messages` | `openai-chat` | `gemini-generate`)
- `contract_version` dolu (sahte sunucu sözleşme testi geçmiş sürüm)
- yetenek beyanı: `context_tokens`, `tokenizer`, `supports_vision/pdf/json_schema`
- sağlayıcı kaydı `ai_providers.status = active`

Aksi hâlde `supported=false`, `reasons[]` ve `unsupported_features[]` (özellik × girdi) döner. Tetikleyiciler `active=true` yapılmasını ve etkin paket ayarının desteksiz modele bağlanmasını `ai_model_unsupported` (23514) ile reddeder. `resolveAi` aynı durumda 503 `ai_model_unsupported` + nedenler + etkilenen özellikler verir; `runAiOperation` adapter yoksa rezervasyon bile açmaz.

Tohum durumu: `claude-haiku-5-5`, `claude-sonnet-5-5` → `anthropic-messages`, vision+pdf+json, 200k, `provider_count`, `s06-v1` → desteklenir. `openai_compatible`, `gemini` → `unconfigured` (X04).

## Adapter sözleşmesi

```ts
interface AiAdapter {
  id: "anthropic-messages" | "openai-chat" | "gemini-generate";
  provider: "anthropic" | "openai_compatible" | "gemini";
  keySecretName: string;              // yalnız AD; değer Deno.env'den, asla DB/günlük
  tokenizer: "provider_count" | "estimate";
  countTokens(apiKey, cfg, system, user): Promise<number>;   // ücretli üretim yapmaz
  generate<T>(apiKey, cfg, system, user, schema): Promise<AiResult<T>>; // tek POST, tekrar yok
}
```

Hata sınıflandırması (`classifyAiError`): kod → tür → belirsiz mi → istemci hatası

| Kod | Tür | Belirsiz | İstemci |
|---|---|---|---|
| `*_429` | rate_limited | hayır | `generation_failed` |
| `*_401/403` | auth | hayır | `generation_failed` |
| diğer `*_4xx` | rejected | hayır | `generation_failed` |
| `*_5xx` | server | **evet** | `ai_result_uncertain` |
| `*_refusal` | refusal | **evet** | `ai_result_uncertain` |
| `*_max_tokens` | truncated | **evet** | `ai_result_uncertain` |
| `ai_result_invalid` (boş/bozuk/şema dışı) | invalid_output | **evet** | `ai_result_uncertain` |
| TimeoutError/AbortError, TypeError (ağ) | timeout/network | **evet** | `ai_result_uncertain` |
| `ai_input_too_large` | input_too_large | hayır | `ai_input_too_large` |
| `ai_token_count_invalid` | token_count_invalid | hayır | `generation_failed` |
| `provider_unconfigured` | unconfigured | hayır | `provider_unconfigured` |
| `ai_model_unsupported` | unsupported | hayır | `ai_model_unsupported` |

Anthropic kodları ve belirsizlik kararı önceki davranışla aynı (mevcut 15 `ai-operation` testi değişmeden geçti). Sağlayıcı gövdesi hiçbir hata mesajına eklenmez.

## İşletim RPC'leri

| RPC | Yetki | İçerik |
|---|---|---|
| `admin_ai_policy_matrix()` | admin | kill switch durumu, sağlayıcılar, modeller + destek, özellik matrisi, paket × eylem sınırları (işlem/dakika/eşzamanlı/medya) + token + model |
| `admin_model_disable_preview(p_model_id)` | admin | etkilenen paketler, özellik × girdi, aynı sağlayıcıdan desteklenen alternatifler, son 30 gün iş hacmi |
| `admin_provider_change_impact(p_from,p_to)` | admin | `blocked` + nedenler (`provider_unconfigured`, `no_supported_model`, `same_provider`), etkilenen özellikler, hedefte karşılanamayan özellik/girdi boşlukları, `new_processor`/`consent_update_required`, `cross_border_transfer`, bölge değişimi, maliyet sınıfı yönü, `key_secret_name`, aday modeller |
| `admin_ai_failed_operations(statuses, action, from, to, limit, offset)` | admin | `ai_operation_jobs` ∪ `prova_generation_jobs` arıza/belirsiz kuyruğu; filtre + sayfalama + `total`; `retryable` yalnız operatör kararı için bilgi |
| `get_ai_usage()` | veli (kendi ailesi) | paket, dönem başı/yenilenme, etkin mi, eylem başına kullanım/limit/kalan/medya sınırı, üretim kredisi, kurulum önerisi kalanı |
| `ai_model_support(p_model_id)` | admin/service | tek modelin destek raporu |

Core karşılıkları: `providerChangeImpact`, `modelDisablePreview` (UI sabah bunları veya RPC'leri bağlar).

## Testler (gerçekten çalıştırıldı)

Ortam: izole DB `gina_s06_pgtap_audit` (boş `gina_completion_audit` şablonundan klon, tüm migration'lar uygulandı; uygulama DB'sine ve üretime dokunulmadı). Deno 2.9.8, Node 22, pnpm.

```
deno test ... _shared/ai-provider.test.ts              → ok | 12 passed | 0 failed
deno test ... (AI ile ilgili 13 Edge test dosyası)      → ok | 94 passed | 0 failed
deno check (9 AI Edge giriş noktası)                    → temiz
pnpm --filter @gina/core test                            → 41 files, 267 tests passed (10 yeni)
pnpm --filter @gina/core typecheck                       → temiz
pgTAP 092_ai_provider_matrix (izole DB)                  → 1..53, 53 ok
pgTAP 012_backoffice, 069_learning_plan_import (regresyon)→ 26 ok, 42 ok
```

Yeni Deno sözleşme testleri (sahte sunucu): adapter kaydı/bilinmeyen adapter; hata sınıflandırma tablosu; **yapılandırılmamış sağlayıcı hiç çağrı yapmadan `provider_unconfigured`**; OpenAI 429/5xx/timeout/kesilme/ret/bozuk çıktı tek istek; OpenAI geçerli çıktı + usage, tahmin tavanı sağlayıcıya gitmez, anahtar yalnız başlıkta; Gemini önce `countTokens`, 429'da üretim yok, negatif sayım, SAFETY/MAX_TOKENS/bozuk çıktı/500/timeout, şema dönüşümü, anahtar URL'de değil; **iki aynı istek → tek ücretli işlem** (durumlu rezervasyon); **5xx ve kaybolan kayıt yanıtı belirsiz kalır, aynı girdi sessiz tekrar çalışmaz (409)**; 429/aşırı girdi bilinen hata, timeout belirsiz; **adaptersiz model rezervasyon ve sağlayıcıdan önce reddedilir**; Anthropic yolu adapter üzerinden değişmedi; `resolveAi` yalnız-ad modeli nedenlerle reddeder, pasif model `ai_model_unavailable`, kill switch `ai_disabled`.

pgTAP 092: yetenek sütunları ve tohumlar; yalnız-ad model `active` olamaz (23514), nedenler ve 17 etkilenen satır; sağlayıcı `unconfigured` iken beyanlı model de engellenir; etkin paket desteksiz modele bağlanamaz; PDF yeteneği kaldırılınca yalnız PDF satırları düşer; veli/cihaz yönetici RPC'lerini çağıramaz (42501), RLS sağlayıcıları gizler; veli kendi kullanımını okur; önizleme/etki/matris/kuyruk içerikleri; kill switch önizleme ve kullanıma yansır; arıza kuyruğu durum/eylem/tarih filtresi ve sayfalama.

İzole servis regresyonu (`python3 scripts/test-isolated-services.py --run-local --with-storage`; gerçek yerel Auth/PostgREST/Storage/Edge + sahte sağlayıcı sınırı, `isolated-ai-contract.mjs` dahil): **272 kontrol geçti, 0 başarısız**, `environment: disposable-local-auth-postgrest-storage-edge`, tek kullanımlık DB ve konteynerler temizlendi. Haftalık özet / öğrenme planı / kurulum önerisi uçları yeni `resolveAi` ile tek sağlayıcı üretimi, tekrar oynatma ve kota tüketimi kontrollerini geçti.

**Testte bulunan ve düzeltilen eksik:** ilk izole koşuda `weekly_edge_generation` 503 `ai_configuration_unavailable` verdi; neden, yeni `ai_providers`/`ai_feature_requirements` tablolarına `service_role` için açık `select` yetkisi verilmemesiydi (bu DB'de `public` için varsayılan ayrıcalık yok; Edge service_role ile okur). Migration'a açık `grant select ... to service_role` eklendi; ikinci koşu temiz.

Tam pgTAP paketi (izole DB, 87 dosya sırayla): **2563 ok, 0 başarısız dosya** (yetki düzeltmesinden önce koşuldu; 092 düzeltme sonrası tekrar 53/53).

## Yapılmayanlar ve kalan sınır

- **Gerçek sağlayıcı anahtarı yok — X04 BEKLİYOR.** OpenAI/Gemini adapterleri iskelettir; gerçek API ile hiç konuşulmadı, istek biçimleri sağlayıcı belgelerine göre yazıldı ve yalnız sahte sunucuyla doğrulandı. Anahtar geldiğinde: Vault/Edge secret'a yalnız adıyla kaydedilen `OPENAI_API_KEY`/`GEMINI_API_KEY`, `ai_providers.status='active'`, sonra model satırına yetenek + `contract_version` ve gerçek ortamda küçük bir `ai-preflight` dumanı gerekir. Bunlar yapılmadan model etkinleştirilemez (tetikleyici).
- **UI bağlanmadı.** Backoffice `ai.tsx`/`operations.tsx` yeni RPC'leri henüz çağırmıyor; mobil kullanım/yenilenme ekranı `get_ai_usage()`'ı henüz okumuyor.
- DB'deki `reserve_weekly_summary`, `reserve_learning_plan_import` ve `ai_provider_health` hâlâ `provider='anthropic'` sabitini kullanır; `finish_ai_operation` devre kesicisi yalnız `anthropic_*` kodlarını sayar. Bu, Anthropic yolunu korur; ikinci sağlayıcı gerçekten açılacaksa bu RPC'lerin sağlayıcı parametresi alması ayrı migration işidir.
- `daily_tips` için ayrı uç nokta yok; matris bunu açıkça `entry_point: null` ile gösterir, sınır 0.
- `document_analysis` (öğrenme planı) DB tarafında `import` politikasını paylaşır (5/20); ayrı kota istenirse politika satırı eklenmeli.
- `apiKeyOrResponse(config)` yeni imzayı destekler ama mevcut çağıranlar hâlâ parametresiz (Anthropic) çağırır; ikinci sağlayıcı açılırken çağıran uçlar `resolveAi` çıktısını geçirmeli.
- Paket sınırı kaynakları birden fazla tabloda kalır (`ai_operation_policies`, `ai_settings`, `plans.*_monthly`); **tek okunur yer** `admin_ai_policy_matrix()`/`get_ai_usage()`'dır, tek yazılır yer değildir.
- Üretime migration uygulanmadı; yayın koordinatöründe. Migration geriye uyumludur: Anthropic tohumları doldurulur, mevcut Edge kodu yeni sütunlar olmadan da çalışır (yalnız yeni `resolveAi` bu sütunları ister → **migration, Edge dağıtımından önce** uygulanmalı).
