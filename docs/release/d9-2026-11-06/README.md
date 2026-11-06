# D9 — D6 kalanları: grup ortak metni puanlama yükünde, B3 kaynakta, B6 doğrulayıcı · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-a2d3df610d07a185f`, kaynak main `b9ac5d0` (D1 + D6 birleşik); çalışma sonunda
main `554ddc6` (D7) bu dala birleştirildi (`761b9a6`, çakışma yok). **Main'e push yok, migration yok, üretime dağıtım
yok, gerçek AI çağrısı yok.** Kanıtın tamamı yerel Deno/vitest birim testleri (sağlayıcı `fetch` sahte). Mobil UI'ya
dokunulmadı (D8).

| # | D6 "Kalan sınır" maddesi | Durum |
|---|---|---|
| 2 | `prova-grade` yükünde grup ortak metni yok | **Düzeltildi** — `prova-grade` ve `prova-review` |
| 3a | B3 kaynakta düzeltilmedi | **Düzeltildi** — `prova-generate` istemi v7, rubrik 100 üzerinden |
| 3b | B6 doğrulayıcısı yok | **Eklendi** — ret değil, `provenance.content_review` (needs_review) |

## 1. Grup ortak metni/tablosu değerlendirme yükünde (`5778d79`)

**Yük biçimi** (`_shared/grade-report.ts`, `buildGradePayload` + `sharedSourcePlan`):
```
{ "ortak_kaynaklar": [{ "kaynak": "K1", "baslik": "Ortak tablo", "icerik": "<tablo>", "maddeler": ["M1","M4"] }],
  "maddeler": [{ "ref": "M1", …, "ortak_kaynak": "K1", "soru": "<üyenin kendi sorusu>", … }, …] }
```
- Ortak içerik **bir kez** gider; bağlı maddeler `ortak_kaynak` ref'i taşır, `soru` alanı üyenin `prompt`'udur (gövdedeki
  `başlık\nmetin\n\n` öneki tekrar gönderilmez). Kaynak sırası ilk bağlı maddeye göre (K1, K2…).
- Kaynak önceliği: (1) D1 grubu — `question_source_members` + gömülü `question_source_groups(id,title,body)`;
  (2) AI provenance: v6 grupsuz satır (gövde tam `başlık\nmetin\n\nshared_prompt` ise) ve v5 ve öncesi (metin yalnız
  provenance'ta — D6'da gözlenen "kenar uzunlukları olmadan" durumu). Gövde metni başka biçimde taşıyorsa satır kaynaksız,
  gövdesiyle gider (kayıp/çift yok). Veli sorusu provenance'ı kaynak üretmez; veli/kütüphane grubu (1) yolundan gelir.
- Bilinen çocuk adı maskesi ortak başlık/metne de uygulanır.
- **Ortak kaynaklı madde yoksa yük D6 ile alan alan aynıdır** (ek anahtar yazılmaz; test alan sırasını sabitler).
- İstem `prova-grade/v5-shared-sources`: ortak kaynak kuralı + "puan=null yalnız bilgi ne soruda ne bağlı kaynakta yoksa";
  K ref'leri `degerlendirmeler`/`kanitlar`'a yazılmaz.
- **Enum şeması yapısal olarak değişmedi:** `gradeSchema(refs)` yalnız madde ref'leri (M…) üzerinden kurulur; K ref'leri
  hiçbir `enum`'a girmez (test). Doğrulayıcı (`validateGradeReport`) **değişmedi**.
- `prova-review`: aynı yardımcıyla tek soru — `ortak_kaynak: {baslik, icerik}` + `soru: prompt`; `REVIEW_SYSTEM`'e bir
  cümle; istem eki `review-v1` → `review-v2`. Ortak kaynaksız soruda yük alanları aynı.
- Sorgu: service client, `question_source_members.in(question_id, sınavın soruları)`; soru satırları zaten aile/genel
  filtresinden geçmiş, grup ailesi tetikleyiciyle soru ailesine eşit (D1). Okuma hatası → `500 data_failed`, sağlayıcıya
  gidilmez.

## 2. B3 — rubrik kaynakta 100 üzerinden (`b92fb29`)

- `prova-generate` istem `prova-generate/v7-rubric-100`; kural `RUBRIC_SCALE_RULE` (`_shared/generation-result.ts`,
  istem ve testin tek kaynağı): "bir sorunun tüm criteria puanlarının toplamı tam 100 … her puan pozitif tam sayı";
  şemada `points` açıklaması "Out of 100…". Şema tipi `number` kaldı (sağlayıcı şemasını sıkılaştırmadık).
- D6 okuma tarafı ölçeklemesi (`core/rubric-scale.ts`, `answerKeyExtras`, `readQuestionRubric`) **kaldı**: 100 toplamlı v7
  rubriği olduğu gibi okunur (`[40,40,20]`), eski küçük puanlı satır yine 100'e oranlanır (`[2,3]` → `[40,60]`).
- Üretim doğrulayıcısı (`rubricValid`) değişmedi: hem 100 toplamlı hem eski rubrik geçer.

## 3. B6 — kişi adı doğrulayıcısı (`b92fb29`)

`detectPersonNames` / `personNameReview` (`_shared/generation-result.ts`), `finishGeneration` içinde her soru için:
taranan alanlar çocuğun gördükleri — gövde (`stem`), şıklar (`choice_<key>`), bağlı ortak kaynak (`shared_source`).
Bulunursa **soru reddedilmez**, satır `provenance.content_review` taşır:
```
{ "status": "needs_review", "detector": "person-name/v1",
  "flags": [{ "code": "person_name", "names": ["Elif"], "fields": ["stem","shared_source"],
              "suggestion": "Kişi adı (Elif) yerine \"bir öğrenci\", \"arkadaşı\", \"öğretmeni\" gibi bir rol ifadesi kullanın." }] }
```
Düşük yanlış pozitif kuralları:
- Kesin liste (164 ad: yaygın Türkçe + birkaç İngilizce): büyük harfle tam sözcük ya da kesme işaretli ek (`Ali'nin`).
- Belirsiz liste (47 ad, aynı zamanda sözcük: Deniz, Umut, Bahar, Can, Metin, Ada…): yalnız cümle ortasında büyük harfle ya da
  kesme işaretli ekle. Yer/gök cismiyle çakışan adlar (Ege, Güneş, Ay, Tuna, Fırat, Asya, Nil, Medine…) listede yok.
- Bitişik büyük harfli sözcük (Mustafa Kemal, Yunus Emre'nin, Fatih Sultan Mehmet, Murat Nehri) ve unvan (Hz., Sultan,
  Mimar…) → tam ad/tarihî kişi/yer, atlanır.
- Liste dışı desen: `<Büyük harfli> adlı|isimli|adında (bir) öğrenci|çocuk|arkadaş|…` ve `named|called <Büyük harfli>`.
- Core: `packages/core/src/question-content-review.ts` — `QuestionContentReview` tipi ve savunmacı `readQuestionContentReview`
  (index'ten dışa aktarılır). **Mobil gösterim yok** (D8 sahipliği); etiket şimdilik yalnız veritabanındaki provenance'ta.
- `complete_prova_generation_v2` (SQL) provenance'ı dönüş `questions`'ına koymuyor; üretim yanıtında etiket görünmez.
  Migration eklenmedi (talimat), bu yüzden yanıta taşınmadı.

## Testler (gerçek çıktı, birleştirme sonrası `761b9a6`)

```
deno check (CI satır 51, 23 giriş noktası)                           → exit 0
CI deno test satırları 52–60 (8 satır)                               → 281+28+55+10+6+5+13+24 = 422 geçti, 0 hata
deno test -A supabase/functions/ (tüm Edge testleri, tek koşu)        → ok | 476 passed | 0 failed   (D6: 467; +9 D9)
pnpm --filter @gina/core exec tsc --noEmit                            → exit 0
pnpm --filter @gina/core test (vitest)                                → 63 dosya, 435 test, 0 hata (+2 D9)
```
Yeni testler:
- `grade-report.test.ts` (+4): D1/D5 **tablo** fixture'ı (bitişik olmayan 1. ve 4. soru) — tablo yükte tam bir kez, K1 →
  `["M1","M4"]`, üyeler kendi sorusuyla; v5 (yalnız provenance) ve v6 grupsuz biçim; başka biçimde gömülü metin kaynaksız;
  veli provenance'ı kaynak üretmez; grupsuz yük D6 alan sırasıyla aynı; maske ortak metne de uygulanır; K ref'i şemada yok;
  **ikinci ücret yok**: aynı grup denemesi aynı iş özeti (`p_hash`) üretir, geçersiz çıktı sonrası tekrar 409, sağlayıcıya
  toplam 2 istek (sayım + ilk üretim).
- `prova-review/handler.test.ts` (+1): grup üyesi — `ortak_kaynak` tablo metni birebir ve bir kez, `soru` = üye prompt'u;
  grupsuz soruda `ortak_kaynak` yok, `soru` aynı; üye sorgusu soru kimliğiyle sınırlı.
- `generation-result.test.ts` (+4): B3 kuralı + okuma ölçeklemesi geriye uyum + doğrulayıcı aynı; B6 doğru pozitifler
  (Ali/Elif, Zeynep'in, cümle ortası Deniz, "Kuzey adlı bir öğrenci", "named Tom"); 11 yanlış pozitif adayı boş (Deniz suyu,
  Güneş ışığı, Ege Bölgesi'nde, Mustafa Kemal Atatürk, Yunus Emre'nin, Hz. Ömer, Murat Nehri, "Can you…", "Ortak metin"
  başlığı, "Kaşağı adlı hikâye", D5 tablosu); adlı soru **kaydedilir** (200, 4 satır), etiket gövde/ortak kaynak/şık
  alanlarıyla; D5 tablo fixture'ında etiket yok.
- `core/question-content-review.test.ts` (+2).

Deneme geçmişi (dürüst kayıt): B6 yanlış pozitif testi ilk koşuda `Yunus Emre'nin` için "Emre" döndürdü (cümle başındaki
liste dışı "Yunus" bitişiklik kuralına girmiyordu). "Yunus" listeye eklendi ve kesme ekli soyadında önceki büyük harfli
sözcük her zaman tam ad sayıldı; ikinci koşu temiz. Worktree koruması iki kabuk komutumu (heredoc/döngü) reddetti; dosya
düzenleme aracı ve scratchpad betiği (`d9_run_ci.sh`) ile tekrarlandı.

## Commit'ler

| Commit | İçerik |
|---|---|
| `5778d79` | Grup ortak kaynağı: `grade-report.ts` yardımcıları, `prova-grade` v5, `prova-review` review-v2, testler |
| `b92fb29` | B3 istem v7 + `RUBRIC_SCALE_RULE`; B6 `detectPersonNames`/`personNameReview` + provenance etiketi; core tipi |
| `761b9a6` | main (D7) birleştirmesi |
| (bu rapor) | `docs/release/d9-2026-11-06/README.md` |

## Dağıtım notu (yapılmadı)
Yalnız Edge: `supabase functions deploy prova-grade prova-review prova-generate` (`verify_jwt` açık). Migration yok.
İstem/yük değiştiği için iş özeti değişir: dağıtımdan **önce** başlamış ve `uncertain` kalmış bir puanlama/inceleme işi,
dağıtımdan sonra aynı deneme için yeni iş kimliğiyle yeniden ücretlenebilir (her istem sürümü değişikliğindeki sınır;
D6 dağıtımı da aynı). Aynı sürüm içinde tekrar ücretsizdir (test).

## Kalan sınır
1. **Gerçek modelde doğrulanmadı.** Modelin `ortak_kaynaklar` ile `puan=null` yerine puan verdiği, v7'de rubrik toplamını
   gerçekten 100 yazdığı ve ad kuralına uyumu ölçülmedi. D6 planındaki tek sentetik `prova-grade` çağrısı (C denemesi:
   Çevre/Alan grubu) artık ortak metni de taşır; aynı çağrı bunu doğrular.
2. B6 etiketi yalnız provenance'ta: mobil veli ekranında gösterim (D8) ve üretim yanıtına taşıma (SQL dönüşü, migration)
   yapılmadı. Ad listesi sınırlı; bitişik büyük harfli sözcük kuralı "Ali Elif'e…" gibi yan yana iki adı kaçırır
   (yanlış pozitif yerine yanlış negatif tercih edildi). Veli yazdığı sorular taranmaz (yalnız AI üretimi).
3. Kitapçık/PDF ve çocuk ekranı değişmedi (D1'deki gibi her bağlı soru sayfasında ortak içerik).
4. OpenAI/Gemini adapterlerinde yeni şema açıklaması (`points.description`) gerçek sağlayıcıyla sınanmadı (X04).
