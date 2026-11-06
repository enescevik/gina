# D14 — Veli AI sorusunu düzenleyebilir · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-a2f2146534926498b`, taban main `3245a39`. **Main'e push yok, üretime dağıtım yok,
gerçek/ücretli AI çağrısı yok** (izole Edge'de değiştirilmemiş `prova-generate` + deterministik sağlayıcı).
D10 "Kalan sınır" 2'yi kapatır: kişi adı notu artık "Düzenle"yi önerir ve düzenleme yolu vardır.

## 1. Migration `20261106430000_ai_question_edit.sql`

**Veri kuralı:** özgün AI satırı yerinde hiç değişmez (başka taslak/sınav/raporda olabilir). Düzenleme her zaman yeni satırdır.

- `public.save_ai_question_edit(p_request_id, p_source_id, p_question) → jsonb {id, edited_from, content_review}`
  - Yalnız veli, yalnız kendi ailesinin satırı (`question_not_found`), yalnız `provenance.generator ∈ {ai, ai_edited}`
    (`ai_edit_not_ai`), grup üyesi değil (`ai_edit_group_member` → grup düzeyinde düzenlenir).
  - Alan kuralları `save_question_with_sources` ile aynı (`question_incomplete`, `question_rubric_invalid`); açık uçluda
    beklenen cevap zorunlu. Ders/sınıf/aile **kaynaktan** gelir (yükte gönderilse de yok sayılır).
  - Yeni satır provenance'ı = özgünün tamamı (model, `prompt_version`, istem, `draft_id`, katalog/kazanım bağı) +
    `generator:"ai_edited"`, `edited_from` (doğrudan kaynak), `edited_root` (ilk AI satırı; düzenlemenin düzenlemesinde korunur),
    `edited_at`, `edited_by`. AI rubriği atılır, velinin gönderdiği (100'lük) rubrik yazılır → `rubricNeedsScaling` yalnız
    `generator==="ai"` olduğundan yeniden ölçeklenmez. `source_urls` ve D1 dönem/program izi (kaynağıyla) taşınır.
    `content_fit: pending_human_review` taşıyan satırda mevcut tetikleyici yeni satırı da uygunluk incelemesine alır.
  - Kişi adı uyarısı **sunucuda yeniden denetlenir** (`gina.ai_edit_content_review`, ucuz/deterministik): yalnız özgün
    uyarıda işaretli adlar, büyük/küçük harf duyarlı, harf sınırıyla (Türkçe harfler açık sınıfta; "Şule'nin" eşleşir,
    "Elifçe"/"can" eşleşmez) gövde ve şıklarda aranır. Kalan ad → `needs_review` (kalan ad/alan, `rechecked_by:"parent_edit"`);
    hiç kalmadı → `status:"resolved", resolved_by:"parent_edit", previous_flags`. D10 özeti yalnız `needs_review`'ı gösterir,
    bu yüzden not kendiliğinden kalkar. Velinin yeni yazdığı adlar taranmaz (D9 kuralıyla aynı).
- `public.save_ai_group_edit(p_request_id, p_group_id, p_group{title,body}, p_questions[]) → jsonb {id, series_id, version, previous_id, question_ids}`
  - `question_groups.enabled` gerekir; grup ailenin, sonlanmış ve serinin **en son** sürümü olmalı (`question_group_changed`);
    tüm üyeler AI; üyeler aynı sıra ve sayıda, `source_id` ile (`question_group_mismatch`); üyede çözüm zorunlu.
  - **Yeni grup sürümü:** aynı seri, `version+1`, `previous_id`=özgün; her üye için yeni `ai_edited` satırı
    (`edit_scope:"group"`, `shared_prompt`, `shared_source_title`, `shared_source.content` yeni metin; `shared_source_id` korunur).
    Gövde `başlık\nmetin\n\nsoru` → `guard_question_group_members` sözleşmesi aynen sağlanır, sabitlik tetikleyicileri bozulmaz.
    Eski sürüm ve üyeleri değişmez (atanmış sınavlar etkilenmez); `current_question_bank` yeni sürümü gösterir.
- İkisi de `mutation_receipts` ile idempotent (tekrar = aynı sonuç; aynı istek + farklı içerik = `request_conflict`).
- **İkinci AI ücreti yok:** iş/kredi satırı yazılmaz (pgTAP + UI'da hak sayısı aynı).
- Yetki: iki RPC `public, anon`'dan geri alındı, `authenticated`'a verildi (rol içeride); 5 yardımcı hiçbir API rolüne açık
  değil. Anon EXECUTE listesi değişmedi (102 yeşil); C07 admin RPC'lerine dokunulmadı (113 yeşil).
- Taslak bloğu istemcide değişir (`replaceInProvaDraft` → mevcut `save_prova_draft`, sürüm çakışmasında yeniden dener);
  `prova_draft_questions` kaynak etiketine bakmadığından yeni sunucu kuralı gerekmedi.

## 2. Core
- `ai-question-edit.ts`: `isAiEditable`, `aiEditRoot`, `replaceProvaBlock` (yerinde değişim, bloğun `source`'u korunur; yoksa
  sona ekler, çift eklemez; D1 `fitAccepted` kabulü yeni kimliğe/üye kimliklerine taşınır), `rubricToInput`
  (`parseRubricInput` tersi), `remainingFlaggedNames` (sunucu kuralının canlı ipucu aynası). Test: 7.
- `database.types.ts`: `gen-db-types-isolated.sh --run-local` ile yeniden üretildi; fark yalnız iki yeni RPC (+6 satır).
- i18n (yalnız yeni anahtar, tr+en, 22): `d14.edit.*`, `d14.contentReview.canEdit`, ve sunucu hata kodları için
  `prova.ai.errors.{ai_edit_not_ai, ai_edit_group_member, question_not_found, question_group_not_found, question_group_changed,
  question_group_mismatch, question_group_incomplete, question_groups_unavailable}`. Var olan anahtar değişmedi.

## 3. Mobil (yeni editör yok; mevcut editörler)
- **Tek soru:** `/parent/prova/question?editFrom=<id>&draftId=…` — mevcut 3 adımlı soru editörü AI satırıyla dolar (gövde, tür,
  zorluk, şıklar/doğru şık, beklenen cevap, alternatifler + rubrik 100'lük ölçekte, çözüm, anlatım, konu, senaryo). Ders/sınıf
  kilitli ("AI önerisindeki gibi kalır"), görsel ve kütüphane paylaşımı bu yolda gizli. Canlı ipucu: "Hâlâ geçen ad: Elif" /
  "İşaretli adlar metinden çıkarıldı". Kaydet → `save_ai_question_edit` → taslakta blok yerinde değişir (yoksa eklenir) → geri.
- **AI grubu:** `/parent/prova/shared-source?aiGroupId=<id>&draftId=…` — mevcut ortak kaynak sihirbazı (D1 sürüm düzenlemesi)
  `aiEdit` kipinde: başlık/ortak metin ve her üyenin kendi sorusu/cevabı/çözümü düzenlenir; ders/sınıf kilitli, üye ekleme/çıkarma,
  görsel, paylaşım yok; rubrik/anlatım/senaryo üyede olduğu gibi (100'lük) taşınır. Kaydet → "Taslakta kullan" → grup bloğu yeni
  sürümle değişir.
- **Giriş noktaları:** AI öneri seçicisi (tek soruda "Düzenle", grupta "Ortak kaynağı ve soruları düzenle") ve taslak 3. adım
  önizlemesi ("Düzenle"; grup üyesinde grup düzenlemesini açar; önce taslak kaydedilir). Seçici, önerinin en son veli
  düzenlemesini (`edited_root` / aynı serinin en yüksek sürümü, aile RLS'iyle) gösterir, "Düzenlendi" etiketi koyar ve seçim/“taslakta”
  durumunu düzenlenmiş kimlikle yapar → not yeni içeriğe göre görünür ya da kalkar.
- D10 notu: düzenleme yolu olan yerde ikinci satır "“Düzenle” ile adı değiştirebilir…" (yeni anahtar); eski `noEdit` metni yolu
  olmayan yerlerde kalır. Yeni öğeler mevcut lila/beyaz panel ve 48pt dokunma alanı desenini kullanır, animasyon yok
  (azaltılmış hareket etkilenmez); hepsi veli ekranı, çocuk istemcisi değişmedi.

## Testler (gerçek çıktı)

```
python3 scripts/test-q02-sql.py --run-local --only 128                → {"files": 1, "assertions": 70, "failures": []}
python3 scripts/test-q02-sql.py --run-local --only 128 --timezone UTC → {"files": 1, "assertions": 70, "failures": []}
python3 scripts/test-q02-sql.py --run-local                           → {"files": 126, "assertions": 5754, "failures": []}  (pgtap-istanbul/)
python3 scripts/test-q02-sql.py --run-local --timezone UTC            → {"files": 126, "assertions": 5754, "failures": []}  (pgtap-utc/)
pnpm --filter @gina/core exec tsc --noEmit                            → exit 0
pnpm --filter @gina/core test                                         → 64 dosya, 450 test, 0 hata (yeni ai-question-edit.test.ts 7)
apps/mobile: pnpm exec tsc --noEmit                                   → exit 0; eslint (değişen 8 dosya) → 0 hata, 0 uyarı
bash scripts/gen-db-types-isolated.sh --run-local                    → +2 RPC imzası
```

**İzole servis + Playwright** (`GINA_QA_UI_PLAN=pro`, kendi fixture yolu, export yer tutucusu 127.0.0.1:59514, web 8614):
```
python3 scripts/test-isolated-services.py --run-local --with-storage --ui-hold → 465/465 servis kontrolü; storage/rest/auth + geçici DB silindi (services.json)
expo export -p web (yer tutucu loopback backend)                           → başarılı (kök dizinde app.json oluşmadı)
docs/release/d14-2026-11-06/ui/ui-check.cjs (Chrome headless, tr-TR, reducedMotion=reduce, 390×844 + 768×1024)
                                                                            → {"ok":true,"count":7} (ui/ui-checks.json)
```
Zincir (deterministik sağlayıcı; taslak konusu "Elif'in bahçesi" → D9 dedektörü adı işaretler):
1. AI 3 soru (2'si ortak kaynak grubu) üretir, 3 hak düşer; seçicide D10 notu "“Düzenle” ile…" metniyle, tek soruda "Düzenle",
   grupta "Ortak kaynağı ve soruları düzenle".
2. "Düzenle" → mevcut soru editörü AI gövdesiyle dolu, ders/sınıf kilitli, görsel yok, "Hâlâ geçen ad: Elif" → ad çıkarılınca
   "İşaretli adlar…" → "Kaydet ve taslakta kullan": yeni `ai_edited` satır taslakta, `edited_from/root`, model korunmuş,
   uyarı `resolved`; özgün satır bayt düzeyinde aynı.
3. Seçici yeniden açılınca düzenlenmiş metin + "Düzenlendi", not yalnız grup üyelerinde kalır; grup düzenlemesi (ortak metin +
   iki üye sorusu, üye ekleme düğmesi yok) → sürüm 2, aynı seri, `previous_id`, üye gövdeleri sözleşmeye uygun, uyarı çözüldü, sürüm 1 aynı.
4. 3. adım önizlemesinde "Düzenle" → ikinci düzenleme önceki düzenlenmişten başlar; blok **yerinde** değişir (sıra korunur), kök aynı.
5. Gönderim: sınav `question_ids` = düzenlenmiş soru + yeni sürüm üyeleri; düzenlemeler AI hakkını değiştirmedi.
6. Her görüntüde yatay taşma 0, çevrilmemiş anahtar 0, `pageerror` 0.

Deneme geçmişi (dürüst kayıt): aynı fixture'da 3 koşu. 1. koşu betik hatası (boş taslakta "Kalan N soruyu tamamla" düğmesi yok;
konu ve sayı zaten seçili) → betik düzeltildi. 2. koşu 3. adımda betik hatası (grubu `version=1` ile arıyordu, fixture'da başka
bir sürüm-1 grubu vardı) → grup AI üyesinden bulunacak şekilde düzeltildi. 3. koşu 7/7 temiz; kanıt bu koşudur. Uygulama kodu
koşular arasında değişmedi.

pgTAP 128 (70): yetki hijyeni; yeni satır, özgün satır bayt düzeyinde aynı; ders/sınıf/aile yükten taşınamaz; `ai_edited`,
`edited_from/root/by`; model/istem/taslak provenance'ı; veli rubriği; kaynak URL ve dönem izi; kalan ad sunucuda yeniden denetlenir
(Elif kalkar, Ali kalır), ikinci düzenlemede çözülür ve D10 özeti boş; tür değişimi ve A–D normalleştirme; tekrar/çakışma;
elle soru, başka aile, grup üyesi, 3 şık, MC rubriği, beklenen cevapsız, 100 üstü rubrik, yabancı veli, cihaz, anon reddi; cihaz
satır okuyamaz; Türkçe harf sınırı birimleri; grup → sürüm 2 (aynı seri, previous), yeni üyeler, gövde sözleşmesi, üye provenance'ı,
ortak metin/istem izi, uyarı çözümü, özgün üyeler/sürüm aynı, kütüphane görünümü yeni sürüm, taslak çözümü (grup+soru=3),
`get_question_context` yeni metni verir, tekrar, eski sürümden düzenleme reddi, sıra/sayı/çözüm/aile/bayrak hataları; iş/kredi yok.

## Eski istemci (build 29) uyumu
- Sunucuda yalnız iki **yeni** RPC ve yardımcı var; mevcut imza/dönüş değişmedi → build 29 hiçbir şeyi farklı görmez.
- Build 29'un taslak şeması (`kind/id/source`) aynı: yeni istemcinin yazdığı taslak (düzenlenmiş satır kimliği, `source:"ai"`)
  eski istemcide normal soru/grup bloğu olarak açılır ve gönderilir.
- `generator:"ai_edited"` satırını build 29 elle soru gibi gösterir: D10 notu yok (eski istemci zaten göstermiyordu), rubrik
  olduğu gibi (veli ölçeği, ölçeklenmez — doğru). Edge `answer-key`/`grade-report` aynı: `ai_edited` ölçeklenmez; grade-report
  ortak kaynağı grup üyeliğinden ya da gövdeden alır (düzenlenmiş tek soruda gövde yetkilidir). Edge dağıtımı gerekmez.
- Eski istemcide "Düzenle" yoktur; o kullanıcı için D10 öncesi durum sürer.

## Dağıtım notu (yapılmadı)
Yalnız migration `20261106430000_ai_question_edit.sql` + mobil (sonraki build/OTA; yalnız JS, yerel modül yok). Sıra serbest:
migration önce gelirse eski istemci etkilenmez; istemci önce gelirse "Düzenle" kaydı `PGRST202` (fonksiyon yok) alır ve hata gösterir.

## Kalan sınır
1. Ad denetimi yalnız özgün uyarıdaki adları arar; velinin yeni yazdığı adlar taranmaz (D9 kuralı). Tam D9 dedektörü SQL'e
   taşınmadı (Edge'de TS; listeler ve kurallar uzun).
2. Grup düzenlemesinde üye eklenip çıkarılamaz, görsel eklenemez; üye rubriği/anlatımı sihirbazda gösterilmez (aynen taşınır).
   Rubriği değiştirmek için grup dışı tek soru gerekir.
3. Düzenlenmiş tek soru gövdeden ortak kaynak metnini silerse D5 geçici kuralı (`prova_shared_source_unlinked`) atamayı durdurur
   (çocuğa eksik soru gitmez); veli metni gövdeye geri koymalıdır. Tersine, v5 satırında metni gövdeye yazmak bu kuralı çözer.
4. Seçici yalnız bu cihazın üretim günlüğündeki önerileri bilir (D10 ile aynı); başka cihazdaki düzenleme seçicide değil,
   taslakta görünür.
5. Eski düzenlenmiş satırlar silinmez/gizlenmez (kütüphanede `ai_edited` satırları görünür; kullanılmayan ara düzenlemeler kalır).
6. Gerçek cihazda görsel kontrol yapılmadı (yalnız web export + Playwright); fiziksel iPhone/iPad yok. Tasarım mevcut editör/
   sihirbaz ve lila panel desenidir; ayrı tasarım onayı alınmadı.
7. Düzenleme kipinde soru editörünün 1. adım adı/yardım metni ("Soru ve görsel", "…gerekiyorsa görselini yaz") mevcut anahtarlardır
   ve görsel alanı gizli olsa da aynen görünür (var olan anahtar değiştirilmedi).
