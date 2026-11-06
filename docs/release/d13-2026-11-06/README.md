# D13 — Amaç duyarlı açık uçlu puanlama (`prova-grade/v7-purpose-aware`)

6 Kasım 2026. Dal `worktree-agent-a8d8ed46e8b880569`, taban `3245a39`. **Durum: KOD HAZIR + deterministik TEST EDİLDİ. Dağıtılmadı, canlı kontrol yapılmadı.** Main'e push edilmedi. Migration yok. Ücretli AI çağrısı yapılmadı.

## Sorun

`prova-grade/v6-alternatives-full` (`8fb2eef`) şu kuralı ekledi: beklenen cevaba ya da bir alternatife eşdeğer cevap, ara adım yazılmasa da tam doğrudur (90–100). Kural koşulsuzdu, bu yüzden "işlemini göster / gerekçelendir" türü soruların rubriğini de eziyordu. Böyle bir soruda yalnız doğru son cevap süreç ölçütlerinin puanını da alıyordu.

Kuralı tetikleyen canlı vaka (C14b) şuydu:
- Cevap: "Pastanın yarısı yenmiş, yani 0,5."
- Rubrik: [2/4 yazar 40, 1/2 sadeleştirir ya da yarısı der 60].
- v5 puanı 60 idi. Kural da buna karşı eklenmişti.

## Çözüm

Her açık uçlu madde artık neyi ölçtüğünü taşıyor. Puanlama kuralı bu amaca göre iki dala ayrılıyor.

### 1. Açık alan: `rubric.assesses` = `"result"` | `"process"` (isteğe bağlı)

- **Üretim (`prova-generate/v8-rubric-assesses`).**
  - Strict JSON şemasında `rubric.assesses` zorunlu bir alan. Değeri `""`, `"result"` ya da `"process"` olabilir. Şema `RUBRIC_JSON_SCHEMA` adıyla `_shared/generation-result.ts` içine taşındı ve test ediliyor.
  - İstem kuralı (`RUBRIC_ASSESSES_RULE`) şöyle:
    - Soru adım göstermeyi, açıklamayı, gerekçelendirmeyi ya da belirli bir gösterimi (kesir, şekil, tablo) istiyorsa ve ölçütler bunu puanlıyorsa değer `process` olur.
    - Soru yalnız sonucu ölçüyorsa değer `result` olur.
    - Süreç puanlanacaksa soru metni bunu açıkça istemeli.
    - Şıklı soruda değer boş kalır.
- **Doğrulayıcı.**
  - `result`, `process`, boş değer ve alanın hiç olmaması kabul edilir. Alansız eski çıktılar ve satırlar geçerli kalır.
  - Başka değerler (`both`, `Result`, sayı, mantıksal değer) reddedilir.
- **Kayıt.** `provenance.rubric` içine yalnız gerçek bir değer yazılır. Boş yer tutucu (`""`) saklanmaz.
- **Core.**
  - `readQuestionRubric` geçerli `assesses` değerini döndürür (`rubricAssessesSchema`, zod).
  - `parseRubricInput` bu alanı **üretmez**. Nedeni «Sınırlar» bölümünde.

### 2. Puanlama yükü: `degerlendirme_amaci`

`answerKeyExtras` artık her açık uçlu maddeye `degerlendirme_amaci` ekler:

| `provenance.rubric.assesses` | `degerlendirme_amaci` |
|---|---|
| `"result"` | `"sonuc"` |
| `"process"` | `"surec"` |
| yok / boş / geçersiz (eski AI satırı, veli rubriği, rubriksiz soru) | `"sorudan_cikar"` |

Alan hem `prova-grade` yüküne hem `prova-review` yüküne gider. Şıklı maddede bu alan yoktur. Yük değiştiği için aynı denemenin ücretli iş hash'i de değişir: v6 önbelleğinden eski puan dönmez.

### 3. Kural (`ANSWER_KEY_RULE`, puanlama ve inceleme ortak)

Kural `_shared/answer-key.ts` içinde tek bir kaynaktan tanımlı. `GRADE_SYSTEM` ve `REVIEW_SYSTEM` metni bu kaynaktan alır. v6'daki koşulsuz cümle kaldırıldı.

- **Ortak taban:** `alternatif_dogru_cevaplar` listesindeki her cevap, beklenen cevapla eşdeğer doğru sonuç sayılır.
- **`"sonuc"`:** eşdeğer ya da alternatif cevap, ara adım veya rubrikteki ara gösterim olmasa da tam doğru sayılır (90–100). Rubrik yalnız yanlış ya da eksik sonuçta kısmi puanı bölmek için kullanılır.
- **`"surec"`:** ölçütler yazıldığı gibi puanlanır.
  - Doğru son cevap yalnız gerçekten karşıladığı ölçütlerin puanını alır.
  - Görünmeyen adım, gerekçe ya da gösterim için puan verilmez ve eksik ölçüt belirtilir.
  - Alternatif cevaplar sonuç ölçütünde doğru sayılır.
- **`"sorudan_cikar"`:** model kararı soru metninden verir.
  - Soru açıkça adım göstermeyi, açıklamayı, gerekçelendirmeyi, nedeni yazmayı ya da belirli bir gösterimi istiyorsa süreç kuralı uygulanır.
  - Aksi halde sonuç kuralı uygulanır.
  - Model emin değilse sonuç kuralını uygular ve gerekçede hangi dalı seçtiğini yazar.

### Sürümler

| Bileşen | Önce | Sonra |
|---|---|---|
| `prova-grade` | `prova-grade/v6-alternatives-full` | `prova-grade/v7-purpose-aware` |
| `prova-generate` | `prova-generate/v7-rubric-100` | `prova-generate/v8-rubric-assesses` |
| `prova-review` (promptVersion son eki) | `:review-v2` | `:review-v3-purpose` |

`prova-review` de puan önerisi veriyor ("0–100 arası öneri"), bu yüzden aynı kuralı kullanıyor. İnceleme istemindeki "gözlenebilir adımlara göre" ifadesi "gözlenebilir sonuç ve adımlara göre" oldu, böylece sonuç dalıyla çelişmiyor.

## Dosyalar

- `supabase/functions/_shared/answer-key.ts`: `RUBRIC_ASSESSES`, `rubricAssesses`, `gradingPurpose`, `degerlendirme_amaci`, yeni `ANSWER_KEY_RULE`
- `supabase/functions/_shared/grade-report.ts`: `GRADE_SYSTEM` ortak kuralı kullanıyor
- `supabase/functions/_shared/review-report.ts`: `REVIEW_SYSTEM` ortak kuralı kullanıyor
- `supabase/functions/_shared/generation-result.ts`: `RUBRIC_ASSESSES_RULE`, `RUBRIC_JSON_SCHEMA`, doğrulayıcı, `storedRubric`
- `supabase/functions/prova-generate/index.ts`, `prova-grade/index.ts`, `prova-review/index.ts`: sürümler, şema ve istem
- `packages/core/src/prova-draft.ts`: `rubricAssessesSchema`, `QuestionRubric.assesses?`, `readQuestionRubric`
- Testler:
  - `_shared/answer-key.test.ts` (CI'daki deno test satırına eklendi; önceden CI'da çalışmıyordu)
  - `_shared/grade-report.test.ts`
  - `_shared/generation-result.test.ts`
  - `packages/core/src/prova-context.test.ts`
- `docs/release/d13-2026-11-06/run-d13.mjs`: canlı kontrol aşama betiği (**çalıştırılmadı**)

## Testler (yerel, bu dal)

| Komut | Sonuç |
|---|---|
| CI `deno check` satırı (23 giriş noktası) | temiz |
| CI ana `deno test` satırı (+`answer-key.test.ts`) | 292 geçti / 0 kaldı |
| CI `prova-review` satırı (`--allow-read=…/assets`) | 24 geçti / 0 kaldı |
| `deno test -A --frozen-lockfile --config supabase/functions/deno.json supabase/functions/` | 482 geçti / 0 kaldı |
| `packages/core`: `vitest run` | 444 geçti (63 dosya) |
| `packages/core`: `tsc --noEmit` | temiz |
| `apps/mobile`: `tsc --noEmit` | temiz |

Yeni D13 testleri şunları doğruluyor:
- **Yük amacı taşıyor:** `sonuc`, `surec`, eski satır için `sorudan_cikar`, geçersiz değer için `sorudan_cikar`, rubriksiz veli sorusu için `sorudan_cikar`. Şıklı maddede alan yok.
- **Alan sırası:** D6 yük sırası testi `degerlendirme_amaci` ile güncellendi.
- **Şema:** `assesses` zorunlu, `required` listesi `properties` ile aynı, enum `["", "result", "process"]`.
- **Doğrulayıcı:** `result`, `process`, `""`, `null` ve alansız rubrik geçer. `both`, `Result`, `1` ve `true` reddedilir.
- **Kayıt:** `process` saklanır, `""` atılır. Okuma tarafında bunlar sırasıyla `surec` ve `sorudan_cikar` olur.
- **İstem metni:** `GRADE_SYSTEM` ve `REVIEW_SYSTEM` üç dalın da cümlelerini içeriyor. v6'nın koşulsuz cümlesi yok. Şablonda çözülmemiş `${` kalmadı.
- **Core:** `readQuestionRubric` geçerli `assesses` değerini okuyor, geçersiz değeri düşürüyor. `parseRubricInput` yalnız `{criteria, alternative_answers}` döndürüyor.

Model davranışı (puanın gerçekten ≥90 ya da kısmi çıkması) deterministik olarak test edilemez. Bunun için aşağıdaki canlı kontrol önerildi.

## Önerilen canlı kontrol (koordinatör için)

**Ön koşul:** bu dalın `prova-grade`, `prova-review` ve `prova-generate` fonksiyonları dağıtılmış olmalı. Yanıttaki `summary.prompt_version` değeri `prova-grade/v7-purpose-aware` olmalı.

**Betik:** `docs/release/d13-2026-11-06/run-d13.mjs`. C14b `run-c14b.mjs` ile aynı kalıpta: sentetik hesap, aile, çocuk ve cihaz; servis rolüyle 2 saatlik gerekçeli Pro override'ı; `calls.jsonl`; ücretli çağrı tavanı 2. Beklenen ücretli çağrı **1** (tek `prova-grade`; tekrar çağrısı ücretsiz olmalı).

```
node docs/release/d13-2026-11-06/run-d13.mjs setup
node docs/release/d13-2026-11-06/run-d13.mjs override
node docs/release/d13-2026-11-06/run-d13.mjs prova
node docs/release/d13-2026-11-06/run-d13.mjs grade
node docs/release/d13-2026-11-06/run-d13.mjs cleanup
node docs/release/d13-2026-11-06/run-d13.mjs verify
```

Üç maddenin hepsinde rubrik, alternatifler ve çocuk cevabı aynı. Değişen yalnız soru metni ve amaç alanı.
- Rubrik: [Yenen kısmı 2/4 olarak yazar 40, Kesri 1/2 olarak sadeleştirir ya da yarısı der 60].
- Alternatifler: yarısı, 0,5, yarım.
- Çocuk cevabı: **"Pastanın yarısı yenmiş, yani 0,5."**

| # | Soru metni | `assesses` → yük | Beklenen | Kontrol |
|---|---|---|---|---|
| D13-1 | "… Pastanın ne kadarı yenmiştir?" | `result` → `sonuc` | eşdeğer cevap tam doğru | `ai_score ≥ 90` |
| D13-2 | "… Yenen kısmı önce kesir olarak yaz, sonra sadeleştir; işlemini göster." | `process` → `surec` | yalnız "yarısı der" ölçütü karşılandı (≈60); 2/4 ölçütü eksik | `40 ≤ ai_score ≤ 75` ve D13-2 < D13-1 |
| D13-3 (bilgi) | C14b özgün metni "… Kesir olarak yaz ve sadeleştir." | yok → `sorudan_cikar` | model metinden karar verir (büyük olasılıkla süreç) | geçme koşulu değil; yalnız yazdırılır |

Ek kontroller:
- `grade_ok`: 200 ve 3 öneri.
- `prompt_version_v7`.
- `grade_replay_no_second_job`.
- `verify` aşaması: sentetik aileden satır kalmadı.

Çıktılar `docs/release/d13-2026-11-06/` altına yazılır: `stage-*.json`, `calls.jsonl`, `grade-output.json` (çocuk adı maskeli).

**Not, amaç alanının yazılması:** veli kayıt RPC'si `assesses` alanını kabul etmiyor (aşağıya bakın). Bu yüzden betik iki sentetik soruya alanı soru taslağa girmeden **önce** servis rolüyle ekliyor. Aynı biçimi AI üretimi v8'de kendisi yazıyor.
- Güncelleme `family_id = sentetik aile` koşulunu taşır.
- `used_question_guard` soru denemede kullanıldıktan sonraki güncellemeyi engeller. Bu nedenle sıra önemli: alan `prova` aşamasında, taslak gönderilmeden önce yazılıyor.

Alternatif olarak, ücretli bir `prova-generate` çağrısıyla v8'in alanı gerçekten doldurduğu da gözlenebilir. Bu, betiğin kapsamında değil.

## Sınırlar

- **Veli rubrik düzenleyicisi amaç seçtirmiyor.** `gina.valid_question_rubric` (migration `20261106240000`, `20261106350000`'de kullanılıyor) yalnız `{criteria, alternative_answers}` anahtarlarını kabul ediyor (`r - array[...] = '{}'`). Mobilde seçici eklemek için bu fonksiyonu genişleten bir migration gerekir (slot `20261106420000`). Görev "ucuzsa" diyordu; migration zorunlu olduğu için yapılmadı. Veli rubrikleri `sorudan_cikar` ile soru metninden çıkarılır. Sonraki adım: migration ile `assesses` alanını isteğe bağlı kabul etmek, `parseRubricInput` üçüncü parametresi, düzenleyicide iki seçenekli seçici ve yalnız yeni i18n anahtarları.
- **Çıkarım modele bırakıldı.** `sorudan_cikar` dalında kararı model veriyor. Sunucuda anahtar sözcük sezgisi yok. Kasıtlı bir tercih: Türkçe ifade çeşitliliğinde (ör. "nedenini yaz", "gösteriniz", "kesirle ifade et") kural tabanlı tespit kırılgan olurdu. Belirsizlikte varsayılan dal sonuç.
- **Eski satırlar.** v7 ve öncesi AI soruları ile tüm veli soruları alan taşımıyor ve `sorudan_cikar` ile puanlanıyor. Geriye dönük doldurma yapılmadı.
- **Kütüphane (`libraryTeacherSchema.rubric`) ayrı bir biçim** (`criterion`/`max_points`). Değiştirilmedi. Kütüphane kopyalarının puanlama yüküne nasıl girdiği bu dalda incelenmedi. Alan taşımadıkları için `sorudan_cikar` ile puanlanırlar.
- **Canlı model davranışı doğrulanmadı.** Yukarıdaki kontrol koordinatöre bırakıldı.
