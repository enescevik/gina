# D10 — Kişi adı uyarısı veliye görünür · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-a30632a8ac03e3677`, kaynak main `b824f7d`. **Main'e push yok, üretime
dağıtım yok, gerçek AI çağrısı yok.** D9 "Kalan sınır" 2'nin ilk yarısını kapatır: B6 etiketi artık yalnız
`question_bank.provenance`'ta değil, üretim yanıtında ve veli ekranlarında da görünür.

## 1. Migration `20261106400000_question_content_review_surface.sql`

- `complete_prova_generation_v2` gövdesi 20261106350000 ile aynı; tek ek satır
  `v_result:=gina.attach_question_content_review(j.family_id,v_result)` (grup bağlama ve dönem izinden sonra,
  `remaining` ve işe yazmadan önce). Uyarı taşıyan her `questions[]` öğesine yalnız özet eklenir:
  ```
  "content_review": { "status": "needs_review",
                      "flags": [{ "code": "person_name", "names": ["Elif","Ali"], "fields": ["stem"], "suggestion": "…" }] }
  ```
  `detector`, istem, model, taslak kimliği gibi provenance'ın geri kalanı **girmez**; bayrak alanları beyaz listeyle
  kurulur (bilinmeyen anahtar atılır, ad/alan dizilerinde metin olmayan öğe atılır, öneri en çok 500 karakter).
  Bozuk/bilinmeyen biçimli etiket (boş ad listesi, başka `code`, `status≠needs_review`) hiç yazılmaz.
- **Uyarısız soru öğesi alan alan eskisiyle aynıdır** (anahtar eklenmez); üst düzey `ok/model/prompt_version/
  remaining/questions/groups` değişmedi.
- Sonuç `prova_generation_jobs.result`'a yazıldığı için kayıp yanıt tekrarı (`status='done'`) aynı sonucu döner;
  ikinci kredi/satır yok (test).
- Yeni yardımcılar `gina.question_content_review_summary(jsonb)` ve `gina.attach_question_content_review(uuid,jsonb)`:
  `public, anon, authenticated, service_role`'den `revoke all` (yalnız security definer v2 içinden). Yeni public
  fonksiyon yok; C07 rol kontrollü admin RPC'lerine dokunulmadı (pgTAP 113 yeşil); anon EXECUTE listesi aynı (102 yeşil).
- Taslak/kütüphane ekranları soruyu zaten aile RLS'iyle `question_bank`tan `select("*")` okuyor (provenance dahil);
  bunun için ek RPC gerekmedi. Çocuk cihazı soru satırını okuyamaz (değişmedi; 126'da test).
- `public` şemasında imza değişmedi → DB tipleri değişmez. `gen-db-types-isolated.sh --run-local` çalıştırıldı;
  çıkan fark yalnız önceki sürümlerden kalan sapma (ör. `device_pairing_*`, C13/C14 RPC'leri) olduğu için bu dala
  alınmadı (geri alındı; ayrı bir tip yenileme işi).

## 2. Core

- `question-content-review.ts`: `questionContentReviewOf(row)` — üretim sonucu öğesini (`row.content_review`) ya da
  `question_bank` satırını (`row.provenance.content_review`) savunmacı okur; `contentReviewNames(review)` — tekil adlar.
- `prova-generation-journal.ts`: soru öğesine `content_review: z.unknown().optional()`. Önceden zod tanımadığı anahtarı
  atıyordu (yerel günlükten geri yüklenen sonuçta uyarı kaybolurdu); bozuk değer ayrıştırmayı düşürmez.
- i18n (yalnız yeni anahtar, tr+en): `d10.contentReview.title`, `d10.contentReview.personName` ("Bu soruda bir kişi
  adı geçiyor: {{names}}. 'bir öğrenci' gibi bir ifade önerilir."), `d10.contentReview.noEdit`. Var olan anahtar değişmedi.

## 3. Mobil

`BuilderQuestionPreview` (`apps/mobile/src/components/learning/prova-builder-ui.tsx`) içinde `ContentReviewNote`:
şıklardan sonra, cevap bölümünden bağımsız (cevap gizliyken de görünür) sakin bir not — mevcut ortak kaynak kutusunun
lila panel deseni (`p.lilac`, 16 köşe, 12 iç boşluk), mor küçük başlık, gövde metni, soluk ikinci satır. Engellemez:
seçim, taslağa ekleme, gönderim ve sorun listesi (`issuesOf`) değişmedi. Animasyon yok (azaltılmış hareket etkilenmez);
`accessible` tek metin bloğu olarak okunur. Görünür olduğu yerler (hepsi veli):
- AI öneri seçici (`prova-source-picker.tsx`): tek soru ve grup üyesi önizlemeleri (sonuç öğesindeki `content_review`;
  grup üyesinde `stem` değiştirilse de uyarı korunur).
- Kütüphane modu ve taslak 3. adım önizlemesi (`prova-builder.tsx`): `provenance.content_review`.
**Düzenleme yolu:** uygulamada AI sorusunu düzenleyen bir ekran yok (`/parent/prova/question` yalnız yeni soru yazar);
bu yüzden bağlantı eklenmedi, not "seçmeden geçebilir ya da kendi sorunu yazabilirsin" der. Çocuk ekranları bu
bileşeni kullanmaz ve soru satırı okuyamaz.

## Testler (gerçek çıktı)

```
python3 scripts/test-q02-sql.py --run-local --only 126                 → {"files": 1, "assertions": 25, "failures": []}
python3 scripts/test-q02-sql.py --run-local --only 126 --timezone UTC  → {"files": 1, "assertions": 25, "failures": []}
python3 scripts/test-q02-sql.py --run-local                            → {"files": 125, "assertions": 5684, "failures": []}
python3 scripts/test-q02-sql.py --run-local --timezone UTC             → {"files": 125, "assertions": 5684, "failures": []}
pnpm --filter @gina/core exec tsc --noEmit                             → exit 0
pnpm --filter @gina/core test                                          → 63 dosya, 443 test, 0 hata (D9: 435; +3 D10, +5 arada)
apps/mobile: pnpm exec tsc --noEmit                                    → exit 0 (çıktı yok); eslint (2 dosya) temiz
deno test -A supabase/functions/_shared/generation-result.test.ts      → ok | 25 passed | 0 failed (Edge dosyası değişmedi)
```
pgTAP 126 (25 iddia): yardımcılar hiçbir API rolüne açık değil, v2 anon'a kapalı; yalnız etiketli soru anahtar taşır;
özet = status + beyaz liste bayrak alanları (detector/bilinmeyen anahtar yok); etiketsiz öğe tam eski anahtar kümesi;
etiketli öğe = eski + `content_review`; bozuk etiket yüzeye çıkmaz; istem/detector/model sızmaz; üst düzey alanlar
korunur; soru reddedilmez; tam provenance tabloda kalır; iş sonucu = dönen sonuç; tekrar aynı metni döner, ek kredi/satır
yok; etiketsiz üretimde anahtar yok; yardımcı birim kontrolleri (null, başka status, nesne değil, metin olmayan öğeler);
veli RLS ile etiketi okur; çocuk cihazı 0 satır.

İlk 126 koşusunda 1 hata: anahtar listesi beklentimde sıralama (`content_review` < `correct_key`) yanlıştı; test
düzeltildi, migration değişmedi.

## Eski istemci (build 29) uyumu

- Yanıta yalnız isteğe bağlı bir anahtar eklendi; eski alanlar ve türleri aynı. Build 29'un `generationResultSchema`'sı
  sıkı değil (`z.object`), tanımadığı `content_review`'u sessizce atar → ayrıştırma, yerel üretim günlüğü ve kurtarma
  akışı değişmeden çalışır; build 29 uyarıyı göstermez (yalnız yeni istemci).
- Etiketsiz sorularda yanıt bayt düzeyinde eskisiyle aynı.
- Edge `prova-generate` değişmedi (RPC sonucunu olduğu gibi döner); Edge dağıtımı gerekmez.

## Dağıtım notu (yapılmadı)
Yalnız migration: `20261106400000_question_content_review_surface.sql`. Mobil değişiklik bir sonraki build/OTA ile.
Etiketin üretilmesi için D9 Edge (`prova-generate` v7, `personNameReview`) dağıtılmış olmalı; D9 dağıtılmadıysa
migration zararsızdır (etiket yok → anahtar yok).

## Kalan sınır
1. Migration'dan **önce** tamamlanmış işlerin saklı sonucu güncellenmez: tekrarında `content_review` yoktur (o soruların
   etiketi provenance'ta durur; taslak önizlemesi yine gösterir, yalnız seçicideki eski günlük sonucu göstermez).
2. AI sorusu için düzenleme ekranı yok; not yalnız bilgi verir. Sorun listesine (`issuesOf`) ve gönderim kontrolüne
   girmez (bilinçli: engellemeyen uyarı).
3. Not, puanlama/inceleme ekranında (`parent-review-workspace`) gösterilmez: o noktada sınav zaten gönderilmiştir.
   Kitapçık/PDF ve paylaşım ekranları değişmedi.
4. Gerçek cihazda görsel kontrol yapılmadı (yalnız tsc/eslint); tasarım mevcut lila panel desenini kullanır.
5. D9'un ad listesi sınırları aynen geçerli (yanlış negatif tercih edildi; veli yazdığı sorular taranmaz).
6. `database.types.ts` ana dalda önceki migration'lara göre güncel değil (bu işten bağımsız sapma).
