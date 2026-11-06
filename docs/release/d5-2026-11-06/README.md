# D5 — Gerçek AI kabulü (C04/C05/C08/C09) · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-ad6dd18b68683d3ae`, kaynak main `88b31be` (C14 yayını). Çalışma 17:15–17:31
Europe/Istanbul. Ortam: **yayımlanmış üretim** (Supabase `gina-prod`, Edge'ler C14 sürümü, GINA'nın kendi
`ANTHROPIC_API_KEY` sırrı). Bu turda yalnız **bir sentetik veli hesabı** (`…@example.invalid`, e-posta doğrulaması
servis rolüyle `email_confirm`, depodaki `scripts/learning-service-smoke.mjs` yöntemi), **bir sentetik aile, bir
sentetik çocuk ve bir anonim sentetik tablet** kullanıldı. Gerçek aile/kullanıcı satırı okunmadı ya da değiştirilmedi.
Parola/anahtar/token yazdırılmadı; parola ve oturum yenileme belirteci yalnız gitignored `.codex-setup/d5/state.json`
içindeydi ve hesaplar silindikten sonra o dosya da silindi.

Çalıştırılan betik: [`run-d5.mjs`](run-d5.mjs) (aşamalar: setup, free-gates, override, prova, grade, grade2, weekly,
errors, errors2, breaker-reset, review, c09, cleanup, verify). Her aşamanın sonucu `stage-*.json`; her uç çağrısının
kişisel veri ve sır içermeyen özeti [`calls.jsonl`](calls.jsonl).

## Sonuç özeti

| # | Madde | Sonuç |
|---|---|---|
| 1 | Prova üretimi: kısmi + tam AI, ortak kaynak, alternatif/rubrik, ücret bir kez | **GEÇTİ** (gerçek model). İki ürün bulgusu: B2, B3 |
| 2 | MEB senaryosu | **Üretimde yayımlanmış senaryo yok** → yalnız C05 izole kanıtı geçerli. Üretimde yayın yapılmadı |
| 3 | Açık uçlu AI puanlama (`ai_score` öneri, kesin puan veli) | **Toplu puanlama (`prova-grade`) GERÇEK MODELDE BAŞARISIZ (2/2)** — B1. Soru başına inceleme (`prova-review`) gerçek modelde geçti; öneri puan yazmadı, veli kaydı kesinleştirdi. `accept_ai_grade` yolu gerçek öneriyle sınanamadı |
| 4 | `ai-preflight` + haftalık özet | **GEÇTİ** (preflight bağlantı + smoke; haftalık özet gerçek, tekrar ücretsiz). Pro hakkı servis rolüyle verildi (aşağıda; `admin_override_apply` kullanılamadı) |
| 5 | Hata sınıfları | Bozuk girdi, fazla soru, yanlış hafta, bozuk deneme kimliği, büyük görsel, kota sınırı **GEÇTİ**; büyük PDF yanlış sınıflandı — B4. Gerçek sağlayıcı 429'u üretilmedi |
| C09 | Pilot | **BEKLİYOR: kapı kararı** — pilot için `CONTENT_PREREVIEW_SECRET` sırrı gerekli, üretimde yok; sır/kapı/Vault değiştirilmedi |
| — | Temizlik | **GEÇTİ** — hesap silme yolu; 98 aile kapsamlı tabloda 0 satır, auth 0, storage 0 |

## Gerçek (ücretli) çağrılar — toplam **8** (tavan 30)

Model: `claude-sonnet-5-5` (Pro paketi `ai_settings`; sağlayıcı `anthropic`, adapter `anthropic-messages`).
Plus/Haiku yolu bu turda çağrılmadı.

| # | Uç | Amaç | Sonuç | Token (giriş/çıkış)* |
|---|---|---|---|---|
| 1 | `prova-generate` (`v5-scenario-provenance`) | Kısmi: taslakta 3 soru, "kalan 3'ü AI ile tamamla" (Matematik 5, karışık) | 200, 2 şıklı + 1 açık uçlu | 151 / 1880 |
| 2 | `prova-generate` | Tam: boş yazılı taslağı, 4 açık uçlu (Fen 5, ortak tablo notu) | 200, 4 açık uçlu, 1 ortak tablo 2 soruya bağlı | 194 / 6655 |
| 3 | `prova-grade` (`v3-answer-key`) | A denemesi: 2 şıklı + 4 açık uçlu cevap | **502 `ai_result_uncertain`** (iş `uncertain`, `ai_result_invalid`) | kaydedilmedi |
| 4 | `ai-weekly-summary` | 26 Ekim haftası (kayıtsız hafta) | 200 | kaydedilmedi (ai_operation) |
| 5 | `prova-grade` | C denemesi: yalnız 3 açık uçlu, hepsi cevaplı (teşhis) | **502 `ai_result_uncertain`** (aynı) | kaydedilmedi |
| 6 | `ai-preflight` `smoke` | Sabit sentetik yapılandırılmış çıktı | 200 `valid:true` | 227 / 9 |
| 7 | `prova-generate` (taslaksız eski yol) | 1 şıklı soru; ortak devre kesici sayacını doğal yoldan sıfırlamak için | 200 | 136 / 951 |
| 8 | `prova-review` | A denemesindeki rubrikli soru (alternatif cevapla) | 200 öneri 60/100 | kaydedilmedi |

\* `prova_ai_usage` satırlarından (silinmeden önce, [`pre-cleanup-usage.json`](pre-cleanup-usage.json)); giriş sayısı
önbelleğe alınmış sistem istemini içermez. `ai-preflight connection` modu yalnız model listesini okur (üretim değil, 14
model görünür) ve sayılmadı. Ücretsiz tekrarlar (aynı `request_id`/aynı girdi) ayrı satır olarak `calls.jsonl`'da;
hiçbiri yeni iş/ücret oluşturmadı. `calls.jsonl` 8. satırındaki haftalık istek ilk anda yanlışlıkla "paid" yazılmıştı;
sağlayıcıya gitmeden `weekly_date` ile reddedildiği (iş sayısı 0) görülünce kayıt düzeltildi.

## Mock'tan ayrım

| Ne | Bu turda |
|---|---|
| Model çağrısı | **Gerçek** Anthropic (GINA anahtarı, üretim Edge'i). Deterministik sağlayıcı kullanılmadı |
| DB/Auth/Storage/Edge | **Gerçek üretim** (C14 sürümü); yerel/izole servis yok |
| Arayüz | **Kullanılmadı** — mobil/web istemcinin çağırdığı aynı RPC ve Edge uçları doğrudan çağrıldı (ekran görüntüsü yok) |
| Çocuk cihazı | Gerçek anonim cihaz eşlemesi + çocuk PIN girişi (`role=device`), fiziksel cihaz değil |
| Kota doldurma | Sentetik aileye 4 sentetik haftalık iş satırı (servis rolü) eklendi; gerçek sağlayıcı 429'u değil |

## Ayrıntı

### 1. Prova üretimi (`stage-prova.json`, 13/13)
- Elle açık uçlu soru rubrik (2 ölçüt, 40+60) + 3 alternatif cevapla kaydedildi; ortak metinli iki soruluk grup kuruldu.
- **Kısmi:** 3 soruluk taslak + "kalan 3" → gerçek üretim 3 soru; hak 300 → 297. Aynı `request_id` tekrarı aynı soru
  kimlikleri, hak 297 (ikinci ücret yok). "Tümünü seç + taslağa ekle" hak 297. Satırlarda `generator:ai`, model,
  istem sürümü, `draft_id` var. Açık uçlu AI sorusunda 3 ölçüt + 2 alternatif cevap.
- **Tam:** boş yazılı taslağına 4 açık uçlu; hak 297 → 293 (öğe sayısı kadar, bir kez). Dört soruda da rubrik (3–4
  ölçüt) ve alternatif cevap. Model bir **ortak tablo** (`shared_sources`, `table`) üretip iki soruya bağladı.
- Kısmi taslak çocuğa atandı (6 soru), atama hak düşürmedi. Üretim işleri: 2 × `done`.
- Çocuk cihaz yükünde cevap anahtarı/rubrik/alternatif/provenance yok.

### 2. MEB senaryosu
Üretimde `curriculum_catalog.enabled=false`; `gina.curriculum_sources` 0, revizyon 0, aday 0, katalog bağı 0, yalnız 1
kaynak hedefi kaydı. **Yayımlanmış senaryo yok**, dolayısıyla senaryoya bağlı gerçek üretim yapılamadı. Geçerli kanıt
yalnız C05'in izole zinciridir ([c05 README](../c05-2026-11-06/README.md), deterministik sağlayıcı). Üretimde kaynak
indirme, aday onayı ya da yayın **yapılmadı**.

### 3. Açık uçlu AI puanlama
- **`prova-grade` (toplu, metin cevaplar): 2/2 gerçek çağrı `ai_result_invalid`.** A denemesi (şıklı + açık uçlu) ve
  yalnız açık uçlu/hepsi cevaplı C denemesi aynı sonucu verdi → neden şıklı madde değil. Sonuç doğru şekilde
  güvenli kaldı: `exam_answers.score` ve `ai_score` boş, iş `uncertain`, aynı deneme tekrarında 409 ve **ikinci ücretli
  çağrı yok**, çocuk özetinde öneri yok. Ama kullanıcı açısından **Pro "AI ile puanla" üretimde çalışmıyor** (B1).
- **`prova-review` (soru başına, aynı rubrik/alternatif yükü): gerçek öneri 60/100**, `readable:true`. Model
  "yarısı" ve "0,5"i kabul edilen eşdeğer cevap olarak tanıdı; rubrikteki "2/4 yazar (40)" ölçütü karşılanmadığı için
  yalnız 60 verdi — rubriğe uygun (testteki ≥80 beklentim rubriğe göre yanlıştı; çıktı:
  [`review-rubric-output.json`](review-rubric-output.json)). Öneri `exam_answers`'a puan yazmadı; veli
  `save_answer_review` (`p_ai_id`) ile kaydedince `score=60, graded_by=parent`. Aynı istek tekrarı aynı öneri kimliği.
- `accept_ai_grade` ile gerçek AI önerisinin kabulü **sınanamadı** (öneri üretilemedi): veli kabulü öneri olmadığı
  için `ai_suggestion_missing` ile reddedildi (puan uydurulmadı), çocuğun kabul denemesi de reddedildi
  (`stage-grade.json`; `stage-grade2.json` ilk adımda durdu).

### 4. `ai-preflight` ve haftalık özet
- `scripts/check-ai-connection.py --smoke`: bağlantı 200 (14 model görünür), smoke 200 `valid:true` `claude-sonnet-5-5`.
  Betik geçici `GINA_PREFLIGHT_TOKEN/EXPIRES_AT` sırlarını 15 dk için kurar ve kaldırır; `temporary_access_removed:true`,
  ardından `supabase secrets list` ile PREFLIGHT adlı sır kalmadığı ayrıca doğrulandı. [`ai-preflight.json`](ai-preflight.json)
- Haftalık özet (`2026-10-26`, aile bugün kurulduğu için kayıtsız hafta): 200; tekrar aynı iş (1 iş), kullanım önizlemesi
  `used 1 / 5`. Çıktı ([`weekly-summary-output.json`](weekly-summary-output.json)) çocuğu yalnız "Çocuk A" takma adıyla
  anar, kayıt yokluğunu zorlanma/başarısızlık saymaz. `get_ai_usage` model/sağlayıcı adı içermez.
- İçinde bulunulan hafta (`2026-11-02`) sağlayıcıya gitmeden `weekly_date` ile reddedilir (yalnız tamamlanmış haftalar).
- **Paket hakkı:** `admin_override_apply` yönetici JWT'si ister (`gina.assert_admin`). Sentetik bir hesaba üretimde
  geçici `admins` satırı vermek bu oturumun izin politikasınca **reddedildi; hiç çalışmadı**. Gerçek yöneticinin
  kimliğine bürünülmedi. Yerine depodaki yerleşik operatör yöntemiyle servis rolü yalnız sentetik aileye gerekçeli,
  **3 saat süreli** `pro` satırı ekledi; denetim tetikleyicisi kaydı yazdı. Satır aile ile birlikte silindi.
  → `admin_override_apply` yolu bu turda **doğrulanmadı**.

### 5. Hata sınıfları (`stage-errors.json` 10/10, `stage-errors2.json`)
| Durum | Yanıt | Sağlayıcıya gitti mi |
|---|---|---|
| Free paket `prova-generate` | 402 `plan_has_no_ai` (permission_denied) | hayır |
| Free paket haftalık özet | 503 `ai_disabled` — B5 | hayır |
| Bozuk JSON gövde | 400 `bad_request` (validation, retryable:false) | hayır |
| 40 soru (sınır 30) | 400 `too_many_questions`, `max:30` | hayır |
| Pazartesi olmayan hafta | 400 `invalid_input` | hayır |
| Bozuk deneme kimliği | 400 `attempt_id_required` | hayır |
| 5 MiB PNG | 400 `source_size_or_type` (validation, retryable:false); satır/yükleme yok | — |
| 11 MiB ve 25 MiB PDF | 400 **`source_failed` (service_unavailable, retryable:true)** — B4; satır/yükleme yok | — |
| Haftalık kota dolu (1 gerçek + 4 sentetik = 5/5) | 402 `ai_quota_exceeded` (rate_limited, retryable:false); yeni iş/deneme kaydı yok; önizleme `remaining 0` | hayır |
| Belirsiz model çıktısı (B1) | 502 `ai_result_uncertain`; tekrar 409, ikinci ücret yok | evet (1 kez) |

Gerçek sağlayıcı 429'u bilinçli olarak üretilmedi; 429/5xx/zaman aşımı matrisi C08'in izole kanıtında kalır.

### C09 — AI ön inceleme pilotu
Üretimde `content_prereview.enabled=false` (açılmadı). Pilot modu yalnız sistem sırrıyla (`x-cron-secret` =
`CONTENT_PREREVIEW_SECRET`) açılır; bu sır üretimde **yok** (C14 kaydı: "sır kapı açılırken"), `content-prereview`
`verify_jwt=true` dağıtılı. Ücretsiz yoklama: servis JWT + rastgele sır → 403; veli JWT ile pilot → 403. DEPLOY.md
adım 6 sır kurulmadan çalışamaz; görev gereği sır/kapı/Vault değiştirilmedi.
**BEKLİYOR: kapı kararı** (DEPLOY.md adım 2–3: sır + `--no-verify-jwt` dağıtımı, sonra adım 6 ≤ 9 çağrı).

## Bulgular (öncelik sırasıyla)

- **B1 — `prova-grade` gerçek modelde çıktı doğrulamasından geçmiyor (P1).** İki bağımsız deneme `ai_result_invalid`
  ile `uncertain`. Doğrulayıcı (`validateGradeReport`) ret nedenini kaydetmiyordu; model çıktısı saklanmadığından hangi
  kuralın tuttuğu bilinemedi. En olası adaylar (kanıtlanmadı): `konu_analizi.kanitlar`'a ref yerine açıklama yazılması,
  konu adlarının birleştirilmesi/yeniden adlandırılması ("Çevre ve alan"), çalışma adımı süresi. **Düzeltme commit'i
  (`1a1fb56`, dağıtılmadı):** doğrulayıcı sabit kural adını (`envelope|item|fields|topic|evidence|steps`) hataya ekler,
  `runAiOperation` bunu zaten `ai_operation_jobs.error_code`'a yazar (içerik sızmaz; davranış aynı). Sonraki adım:
  `prova-grade` bu commit'le dağıtılır, tek sentetik çağrıyla kural görülür, istem veya doğrulayıcı ona göre düzeltilir.
  Yan etki: model sözleşme ihlali ortak Anthropic devre kesicisini artırır (3'te tüm ailelerde 2 dk duraklama). Bu
  turda sayaç her seferinde 1'e çıktı; başarılı çağrılar 0'a indirdi (son durum 0).
- **B2 — AI ortak kaynağı çocuğa gösterilmiyor (P1, C04 kalan sınır 2 gerçek modelde doğrulandı).** Gerçek model ortak
  tabloyu `shared_sources`'a koydu ve iki sorunun gövdesi "Tablodaki…/Tabloda verilen…" diye başlıyor; tablo yalnız
  `provenance.shared_source`'ta, `question_source_groups`'a dönüşmüyor, çocuk yükünde yok. Bu sorular atanırsa çocuk
  çözemez. Bu turda o tam taslak **atanmadı**. Öneri: dönüştürme yapılana kadar `shared_source_id` dolu AI sorularını
  seçiciye engelli göster ya da istemde ortak kaynağı kapat.
- **B3 — AI rubrik puan ölçeği farklı (P2).** AI ölçüt puanları 1–2, soru başına toplam 5–6; veli rubriği toplam ≤ 100 ve
  puanlama 0–100. İnceleme ekranında ölçütler yan yana gösterildiğinde tutarsız görünür.
- **B4 — Büyük PDF yanlış hata sınıfı (P2).** `reserve_learning_source` PDF için bayt sınırı denetlemiyor; 10 MiB tablo
  CHECK'i yakalıyor, Edge `source_failed` / `service_unavailable` / `retryable:true` döndürüyor → istemci tekrar
  önerebilir. Görselde doğru (`source_size_or_type`). Düzeltme RPC (migration) ya da Edge ön denetimi ister; yapılmadı.
- **B5 — Free paket haftalık özet 503 `ai_disabled` (P3).** `prepare_weekly_summary`'nin 402 `plan_has_no_ai` kodu bu
  yoldan görülmez; `resolveAi` Free modeli kapalı olduğu için önce düşer. İstemci "geçici olarak kullanılamıyor" yerine
  paket yükseltme göstermeli.
- **B6 — İstem kuralı (P3).** "Gerçek kişi adı kullanma" kuralına karşın üretimde "Ali ve Elif" gibi yaygın adlar geçti.

## Temizlik ve kanıt
- Veli: `delete-account` (parola ile yeniden doğrulama) → 200; aile son veliyle kademeli silindi.
- Anonim tablet hesabı: ayrı `deleteUser` çağrısı hata döndü çünkü hesap aile silme zinciriyle zaten silinmişti;
  `getUserById` 404 (`stage-verify.json`).
- [`cleanup-verification.json`](cleanup-verification.json) (Management API, salt okunur): `family_id` sütunlu 98 public/gina
  tablosunda sentetik aile için **0 satır**; iki auth kullanıcısı 0; `gina-d5-%@example.invalid` 0; aile önekli storage
  nesnesi 0 (bu tur dosya yüklemedi); bu aileye ait audit satırı ve override audit satırı 0 kaldı.
  Ortak sağlayıcı sağlığı: anthropic/openai_compatible/gemini `failures 0`, duraklama yok.
- Geçici preflight sırları kaldırıldı (doğrulandı). Genel ayar, model, plan, politika, kapı satırı **değiştirilmedi**.
- `.codex-setup/d5/state.json` (parola, yenileme belirteci) silindi; yalnız salt okunur sorgu yardımcısı `q.mjs` kaldı.

## Kod değişikliği
| Commit | İçerik |
|---|---|
| `1a1fb56` | `fix(prova-grade)`: `validateGradeReport` hatalarına sabit kural adı; `ai-operation.ts` izin listesine `evidence|steps`; Deno testi. `deno check` (CI 51) temiz, CI 52 test grubu 263/263. **Dağıtılmadı.** Migration yok |
| (bu rapor) | `docs/release/d5-2026-11-06/` |

## Kalan sınır
1. **B1**: AI toplu puanlama üretimde çalışmıyor; düzeltmenin dağıtımı + 1 sentetik çağrı gerekli. `accept_ai_grade`
   gerçek öneriyle doğrulanmadı.
2. **B2**: AI ortak kaynaklı sorular çocuğa eksik gider; dönüştürme veya geçici engel gerekli.
3. **C09 pilotu BEKLİYOR: kapı kararı** (`CONTENT_PREREVIEW_SECRET` + `--no-verify-jwt` dağıtımı); kapı kapalı.
4. **MEB senaryosu**: üretimde yayımlanmış senaryo yok; yalnız C05 izole kanıtı.
5. **OpenAI/Gemini — X04 BEKLİYOR**: üretimde `ai_providers.status='unconfigured'`, anahtar yok; hiçbir çağrı yapılmadı.
6. `admin_override_apply` yolu bu turda kullanılamadı (izin politikası); hak servis rolüyle verildi.
7. Plus/Haiku modeli, belge/fotoğraf AI uçları (`timetable-import`, `learning-plan-import`, `setup-suggestions`),
   defter görüntülü inceleme, arayüz ve fiziksel cihaz bu turun kapsamında değil / yapılmadı. Gerçek 429 üretilmedi.
