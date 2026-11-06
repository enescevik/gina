# D6 — D5 gerçek AI kabulü bulgularının düzeltmesi · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-a806f94b1487b5558`, kaynak main `32365b6` (D5), sonra main `251651b`
(D1 birleşmesi) bu dala birleştirildi. **Main'e push yok, üretime dağıtım yok, gerçek AI çağrısı yok.** Tüm kanıt
yerel/izole: Deno birim testleri (sağlayıcı `fetch` sahte), tek kullanımlık şablon klonu Postgres (pgTAP).

Migration: `supabase/migrations/20261106380000_ai_quality_fixes.sql` (yalnız fonksiyon gövdeleri; tablo/veri
değişmez). pgTAP: `supabase/tests/124_ai_quality_fixes.test.sql` (31 doğrulama).

## Özet

| # | Bulgu | Durum |
|---|---|---|
| B1 | `prova-grade` gerçek modelde `ai_result_invalid` | **Düzeltildi (olası nedenler), kesin kök neden üretimde doğrulanmadı** — aşağıda tek çağrılık plan |
| B3 | AI rubriği 5–6 puan, veli rubriği 100 | **Düzeltildi (okuma tarafı)**: AI rubriği hem puanlama istemine hem veli inceleme ekranına 100 üzerinden gider |
| B4 | 10 MiB üstü PDF `source_failed`/retryable | **Düzeltildi**: `400 source_file_too_large`, `validation`, `retryable:false` |
| B5 | Free haftalık özet `503 ai_disabled` | **Düzeltildi**: `402 plan_has_no_ai` (`permission_denied` → istemci eylemi "upgrade") |
| B6 | "Ali ve Elif" gibi adlar | **İstem düzeltildi**; doğrulayıcı eklenmedi (D1 dosyası, kalan sınır) |
| Kesici | Bozuk model çıktısı ortak Anthropic sayacını artırıyor | **Düzeltildi**: içerik sonucu (bozuk/ret/kesilme) sayacı ne artırır ne sıfırlar |

## B1 — `prova-grade` toplu puanlama (P1)

**Kanıt.** D5'te iki bağımsız deneme (A: 2 şıklı + 4 açık uçlu; C: yalnız 3 cevaplı açık uçlu) aynı
`ai_result_invalid`. Model çıktısı saklanmadı; dağıtılı sürüm hangi kuralın tuttuğunu yazmıyordu. Yapılandırılmış
çıktı (`output_config.format=json_schema`) açık olduğu için yapısal hatalar (eksik alan, bozuk JSON) dışlanır;
reddi yalnız `validateGradeReport`'un **anlamsal** kuralları üretebilir.

**İstem ↔ doğrulayıcı karşılaştırması (v3, D5'te dağıtılı).** Doğrulayıcının şart koştuğu, istemin söylemediği veya
tersini istediği kurallar:

| Kural (kod) | v3 istemi | Gerçekçi model davranışı |
|---|---|---|
| `eksikler` ≤ 3 (`item`) | "somut eksikler" — **sınır yok** (yalnız öneriler için "en çok 3") | D5 gerçek `prova-review` çıktısı aynı rubrikli soru için **5** kanıt maddesi yazdı |
| `sinirlar` ≤ 5 (`fields`) | 4+ ayrı başlık + puansız her maddenin ref'i isteniyor | 3 soruda 5–6 madde doğal; C denemesinde ortak metin soruya gitmediği için ek sınır notu |
| Konu adları birebir (`topic`) | yalnız `konu_analizi` için "verilen konu adları"; güçlü/zayıf ve çalışma adımı için yok | "Çevre ve alan" birleştirmesi, küçük harf, "Genel tekrar" adımı |
| `kanitlar` = ref listesi (`evidence`) | "gerçek soru ref'lerini kullan"; alan adı "kanıtlar" | D5 `prova-review` kanıtı cümle olarak yazdı ("Öğrenci … yazmış") |
| `calisma_adimlari` ≤ 4 (`steps`) | "2–4" | genelde uyar |
| boş metin öğesi (`item`) | — | tam doğru cevapta `eksikler: [""]` |

Kanıt tablosu (eski ve yeni doğrulayıcı, aynı girdiler): [`validator-probe.json`](validator-probe.json), betik
[`validator-probe.ts`](validator-probe.ts) (eski dosya: `git show 32365b6:supabase/functions/_shared/grade-report.ts`).
v3 bu 11 gerçekçi biçimin **11'ini de** reddediyor (`item`×3, `fields`, `steps`×2, `evidence`, `topic`×3,
`envelope`). Hangisinin D5'te tuttuğu bilinmiyor; en olası adaylar `item` (eksik sayısı) ve `fields` (sınır sayısı),
çünkü istem bunları doğrudan tetikliyor ve iki deneme de aynı sonucu verdi.

**Düzeltme** (`23d5242`, `supabase/functions/_shared/grade-report.ts`, `prova-grade/index.ts`, istem sürümü
`prova-grade/v4-grade-contract`):
1. **İstek başına şema** `gradeSchema(refs)`: `degerlendirmeler.ref` yalnız puanlanacak ref'ler, her `konu`
   alanı yalnız maddelerdeki konular, `kanitlar` öğeleri yalnız mevcut ref'ler (`enum`). Yapılandırılmış çıktıda
   birleşik/uydurma konu, açıklamalı kanıt ve şıklı maddenin puanlanması **üretilemez**. Boş liste için enum yazılmaz.
2. **İstem hizalaması**: eksikler ≤ 3, sınırlar 1–5, veli desteği ≤ 5, konu adları birebir, `kanitlar` yalnız ref,
   `sure_dk` 5–20 tam sayı, yalnız `puanlama_gerekli=true` maddeler; rubrik puanları 100 üzerinden.
3. **Doğrulayıcı** — güvenlik kuralları aynı, yalnız sunum sınırları kesilir:
   - kesilir/temizlenir: eksik/öneri > 3, sınır/veli desteği > 5, çalışma adımı > 4, boş metin öğesi, yinelenen kanıt,
     konu adında yalnız Unicode/boşluk/büyük-küçük harf farkı (kanonik ada çevrilir);
   - hâlâ reddedilir: eksik/fazla/yinelenen/bilinmeyen/istenmeyen (şıklı) madde, 0–100 dışı veya kesirli puan,
     uydurma/birleşik konu, başka konunun veya olmayan sorunun kanıtı, açıklamalı kanıt, boş `konu_analizi`,
     boş `sinirlar`, 5–20 dışı süre, biçimsiz öğe. Ret kodu D5'teki sabit kural adı.
   - normalleştirilmiş çıktı tekrar doğrulayıcıdan değişmeden geçer (önbellek yolu `job.cached`).
4. İkinci ücret yok: geçersiz çıktı işi `uncertain` + `ai_result_invalid_<kural>` yazar; aynı deneme tekrarında
   rezervasyon 409 döner, sağlayıcıya ikinci istek gitmez (Deno testi).

Ek gözlem (düzeltilmedi): `prova-grade` yükü grup sorularının **ortak metnini** içermiyor (C denemesinde "Bahçenin
çevresi kaç metredir?" kenar uzunlukları olmadan gider); model `puan=null` verebilir. Doğrulayıcıyı bozmaz, kaliteyi
düşürür. D1'in grup dönüşümüyle birlikte ele alınmalı.

**Üretimde tek sentetik çağrıyla doğrulama planı** (yapılmadı; dağıtım ve çağrı onayı gerekir):
1. Bu dal main'e birleşince: `supabase db push` (yalnız `20261106380000`), `supabase functions deploy prova-grade
   prova-generate ai-weekly-summary prova-review` (`verify_jwt` açık).
2. D5 betiğinin `setup` + `override` + `prova` (2 ücretli üretim) yerine tek ücretli çağrı için: sentetik aileye elle
   rubrikli Kesirler sorusu + Çevre/Alan grubu (ücretsiz RPC), C denemesini çocuk cihazıyla doldur
   (`run-d5.mjs` `stageGrade2`), **bir** `prova-grade` çağrısı.
3. Beklenen: 200, `final:false`, `suggested:3`, `summary.prompt_version = prova-grade/v4-grade-contract`, üç
   `ai_score` dolu, `score` boş. Başarısızsa `select status,error_code from ai_operation_jobs where action='grade'
   and family_id=<sentetik>` → `ai_result_invalid_<kural>` hangi kuralın kaldığını söyler (içerik değil); ortak
   `ai_provider_health.failures` **0** kalmalı (yeni kesici kuralı).
4. Sonra `accept_ai_grade` yolu (D5'te sınanamadı) ücretsizdir: veli bir öneriyi kabul eder → `score=ai_score`,
   `graded_by=parent`. Temizlik D5 ile aynı (`delete-account`, 98 tablo sayımı).

## Devre kesici — bozuk çıktı sağlayıcı arızası sayılmaz

**Kök neden.** `gina.ai_provider_outcome` her `p_uncertain=true` sonucu sayıyordu; `classifyAiError`
`ai_result_invalid`'ı (ücret olmuş olabileceği için doğru biçimde) belirsiz işaretliyor. Sonuç: bir ailenin bozuk
model çıktısı 3 kez olursa tüm ailelerde Anthropic 2 dk duruyordu (D5'te sayaç her seferinde 1'e çıktı).

**Düzeltme** (`d2bfcc3`, migration): `gina.ai_content_outcome(code)` —
`ai_result_invalid[_kural]`, `<sağlayıcı>_refusal|max_tokens|length|truncated` sağlayıcı yanıt verdi ama çıktı
kullanılamadı demektir. Bu kodlarda sağlık sayacı **değişmez** (ne artar ne sıfırlanır); iş yine `uncertain`,
otomatik tekrar yok. 429/5xx ve `provider_outcome_unknown` (zaman aşımı/ağ) eskisi gibi sayar, 3'te duraklatır.
Tek kaynak olduğu için `finish_ai_operation` ve `fail_prova_generation_v2` (üretim) ikisi de kapsanır.

## B3 — Rubrik ölçeği

**Kök neden.** `prova-generate` istemi ölçüt puanının ölçeğini söylemiyor; model 1–2 puan yazıyor (D5: toplam 5–6).
Veli rubriği ve puanlama 0–100. Puanlama istemine "rubriğe göre puan ver" + "puan 0–100" birlikte gidiyordu.

**Düzeltme** (`bf1bbcd`): `packages/core/src/rubric-scale.ts` (bağımlılıksız) `scaleRubricTo100` (en büyük kalan,
tam sayı, toplam 100). Yalnız `provenance.generator === "ai"` olan rubrik ölçeklenir; veli rubriği olduğu gibi.
Kullanan yerler: core `readQuestionRubric` (mobil veli inceleme ekranı bunu kullanıyor — UI dosyasına dokunulmadı) ve
Edge `answerKeyExtras` (`prova-grade` ve `prova-review` yükü). Saklanan satır değişmez.

**Kalan.** Kaynakta düzeltme (`prova-generate` istemine "ölçüt puanları toplamı 100" cümlesi veya
`generation-result.ts`'te ölçekleme) D1 sahipliğinde olduğu için yapılmadı; okuma tarafı ölçeklemesi bunu gerektirmez.

## B4 — Büyük PDF hata sınıfı

**Kök neden.** `reserve_learning_source` PDF bayt sınırı denetlemiyordu; tablo `CHECK (bytes between 24 and
10485760)` yakalıyor, Edge ham hatayı `source_failed` (service_unavailable, retryable:true) yapıyordu.

**Düzeltme** (`d2bfcc3`): RPC'ye `p_mime='application/pdf' and p_bytes>10485760 → 'source_file_too_large'`
(gövde `20261105010000` ile aynı, yalnız bu satır eklendi; yetkiler aynı). Edge değişmedi: `learning-source`
`source_[a-z_]+` kodunu zaten 400 ile geçiriyor. Core sözleşmesine `source_file_too_large: validation` eklendi.
Görsel sınırı eski `source_size_or_type` kodunu korur.

## B5 — Free haftalık özet

**Kök neden.** `ai-weekly-summary` önce `resolveAi` çağırıyor; Free'nin `ai_settings.enabled=false` olduğu için 503
`ai_disabled` dönüyor ve `prepare_weekly_summary`'nin 402 `plan_has_no_ai`'si hiç görülmüyordu.

**Düzeltme** (`db45e87`): `resolveAi` 503 döndüğünde paketin `plans.ai_weekly` değeri okunur; `false` ise
`402 plan_has_no_ai` (`details.plan`). Paket haftalık özeti içeriyorsa (genel AI kapatma) ya da paket okunamazsa
asıl 503 korunur. Sağlayıcı/anahtar/hazırlık çağrısı yapılmaz.

## B6 — Kişi adları

**Kök neden.** Kural "gerçek kişi adı kullanma" idi; model "Ali, Elif"i uydurma ad sayıyor (kurala uygun okuma).

**Düzeltme** (`68ead0d`, D1'in `v6-shared-groups` istemi üzerine tek cümle): hiçbir kişi adı (uydurma/yaygın
dahil); gerekirse "bir öğrenci", "arkadaşı" gibi rol. `PROMPT_VERSION` D1 ile çakışmamak için değiştirilmedi
(istem metni iş özetine girdiği için önbellek yine ayrışır).

**Kalan.** Doğrulayıcı yok: `generation-result.ts` D1'de; ad listesine dayalı ret ücretli çıktıyı yanlış reddeder.
Gerçek modelde etkisi ölçülmedi.

## Testler (gerçek çıktı)

```
deno check (CI satır 51, 23 giriş noktası)                         → exit 0
deno test supabase/functions/ (tüm Edge testleri, izinli tek koşu)  → ok | 467 passed | 0 failed
  grade-report.test.ts (+6 D6), answer-key.test.ts (+1), ai-weekly-summary/handler.test.ts (+1)
packages/core vitest                                                → 61 dosya, 429 test, 0 hata (rubric-scale.test.ts +4)
packages/core tsc --noEmit                                          → 0
pgTAP 124_ai_quality_fixes (izole DB)                               → 31/31
python3 scripts/test-q02-sql.py --run-local (Europe/Istanbul)       → 123 dosya, 5554 doğrulama, 0 hata [tz-istanbul/]
python3 scripts/test-q02-sql.py --run-local --timezone UTC          → 123 dosya, 5554 doğrulama, 0 hata [tz-utc/]
```
(Tam pgTAP ve Deno koşuları D1 birleştirmesinden sonra.)

## Commit'ler

| Commit | İçerik |
|---|---|
| `23d5242` | B1: istek başına enum şeması, istem v4, doğrulayıcı sunum sınırları, gerçekçi fixture testleri |
| `bf1bbcd` | B3: core `rubric-scale.ts`, `readQuestionRubric`, Edge `answerKeyExtras` |
| `d2bfcc3` | Devre kesici + B4 migration, pgTAP 124, core hata kodu |
| `db45e87` | B5: haftalık özet 402 |
| `884072c` | main (D1) birleştirmesi |
| `68ead0d` | B6: `prova-generate` istem cümlesi |
| (bu rapor) | `docs/release/d6-2026-11-06/` |

## Kalan sınır
1. **B1 kök neden gerçek modelde kesinleşmedi**; düzeltme olası tüm nedenleri kapsıyor. Dağıtım + yukarıdaki tek
   sentetik çağrı gerekli. Enum şemasının gerçek Anthropic yapılandırılmış çıktısında derlenmesi de o çağrıda
   doğrulanır (birim testte sağlayıcı sahte).
2. `prova-grade` yükünde grup ortak metni yok (ek gözlem).
3. B3 kaynakta (üretim istemi) düzeltilmedi; B6 doğrulayıcısı yok — ikisi D1 dosyalarında.
4. `accept_ai_grade` gerçek öneriyle hâlâ doğrulanmadı (B1 çağrısına bağlı, ücretsiz).
5. OpenAI/Gemini adapterlerinde `enum` davranışı gerçek sağlayıcıyla sınanmadı (X04 bekliyor).
