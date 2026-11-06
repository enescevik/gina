# D1 — C04/C05 kalanları: AI ortak kaynak grubu, soru düzeyinde dönem/program + ders kimliği, uygunluk inceleme ekranı · 6 Kasım 2026

D1 ajanı (Claude Opus 5.5). Dal `worktree-agent-a8eea0f55a5687cff`, taban main `88b31be`, çalışma sırasında main (`32365b6`, D2/D5) birleştirildi.
**Main'e push edilmedi; üretime/hosted Edge'e dokunulmadı; `db reset` yapılmadı; gerçek/ücretli AI çağrısı yapılmadı** (izole Edge'de
değiştirilmemiş `prova-generate` + deterministik sağlayıcı). Tek migration: `20261106350000_prova_shared_ai_and_subject_fit.sql`; pgTAP `121`.
i18n'e yalnız yeni anahtar (61, tr+en; silinen/değişen yok). C07 admin RPC'lerine dokunulmadı.

| Alan | Durum |
|---|---|
| Eski görev bağlantısı | C04 kalan sınır 2 (AI ortak kaynak ↔ grup) ve 4 (dönem soru düzeyinde değil), C05 kalan 4 (veli uygunluk ekranı), C02 "Prova/kütüphane subject → kanonik kimlik (P02)", D5 bulgusu **B2** |
| Kod | KOD HAZIR (bu dal) |
| Test | TEST EDİLDİ — pgTAP 121 + tam pgTAP iki saat dilimi, Deno (CI satırları), core, mobil tsc/lint, izole servis + Playwright 3 ölçü |
| Gerçek AI kabulü | **Yapılmadı** (talimat: deterministik sağlayıcı). D5'teki gerçek çıktı biçimi fixture olarak kullanıldı |
| Fiziksel cihaz | Yapılmadı (yalnız web export) |
| Yayın | **Yayımlanmadı** |

## Commit'ler

| Commit | İçerik |
|---|---|
| `c726ffb` | Migration + pgTAP 121; Edge `prova-generate` v6 istemi, `_shared/generation-result.ts` (kendi başına okunur bağlı soru gövdesi, `shared_prompt`/`shared_source_title`) + Deno testleri |
| `31f5902` | Core (`prova-question-fit.ts`, taslak `fitAccepted`, üretim sonucunda `groups`), i18n, mobil seçici/hazırlayıcı/soru editörü, ders kimliği kartı, uygunluk ekranı |
| `c170cbe` | `docs/release/d1-2026-11-06/ui/ui-check.cjs` + `serve-export.cjs`; `scripts/test-isolated-services.mjs`'e opt-in `GINA_QA_UI_SERVICE=1` (fixture'a geçici servis anahtarı; varsayılan davranış aynı) |
| `0f5b7ab` | main birleştirmesi (D2, D5) |
| `7f6ea9d` | D5 B2: gerçek model biçimi (ortak **tablo**, 1. ve 4. soruya bağlı) fixture'ı; dönüşümsüz ortak kaynaklı AI sorusunun atanmasını engelleyen geçici kural; hazırlayıcı işareti |
| (bu rapor) | README, kanıtlar (`ui/`, `pgtap-istanbul/`, `pgtap-utc/`, `services.json`) |

## Ne değişti

**1. AI ortak kaynak → gerçek ortak kaynak grubu.**
- `prova-generate` (istem `v6-shared-groups`): bağlı soru gövdesi elle/kütüphane grup sözleşmesiyle aynı biçimde yazılır
  (`<başlık>\n<ortak metin/tablo>\n\n<soru>`; başlık "Ortak metin / Ortak tablo / Ortak görsel açıklaması"), provenance'a
  `shared_prompt` ve `shared_source_title` eklenir. İstem artık ortak kaynağa bağlı (2–12) soru üretimine izin veriyor.
- `complete_prova_generation_v2` (gövde aynı + iki çağrı): aynı işlemde `gina.link_ai_shared_sources` bağlı satırları
  `question_source_groups` (sürüm 1, kendi serisi) + `question_source_members` (üretim sırası) olarak kurar ve sonlandırır;
  mevcut tetikleyiciler (`guard_question_group_members` gövde eşleşmesi, sabitlik) aynen. Sonuç `groups[]` ve soru başına
  `group_id/prompt/position` taşır; kayıp yanıt tekrarı aynı sonucu döner, ikinci grup kurulmaz.
- Grup kurulamazsa (bayrak `question_groups.enabled` kapalı, tek bağlı soru, biçim/uzunluk dışı) sorular bağımsız kalır ama
  gövde ortak kaynağı taşıdığı için çocuk eksik soru görmez.
- Mobil seçici: grup **tek seçim** ("Ortak kaynaklı 2 soru (birlikte eklenir)"), ortak metin bir kez, üyeler kendi soru
  metniyle; "Önerilerin tümünü seç" grubu tek blok ekler; ikinci ücret yok. Taslakta `kind:"group", source:"ai"` bloğu —
  hazırlayıcıda taşınırken bölünmez, üye tek soru olarak eklenemez (`prova_source_unavailable`).
- Çocuk: her bağlı soru sayfasında ortak içerik bir kez (`get_question_context` → "Ortak içerik" kutusu + soru metni), üç
  soru ayrı sayfa/ayrı cevap.

**D5 B2 (koordinatör notu).** Gerçek `claude-sonnet-5-5` tam yazılı üretiminde bir ortak **tablo** üretip 1. ve 4. soruya
bağlamıştı ("Tablodaki…/Tabloda verilen…"). Dönüşüm `table` türünü destekler; aynı biçim (4 açık uçlu, tablo, bitişik olmayan
bağlı sorular) Deno ve pgTAP fixture'ı olarak eklendi. D5 raporu tablonun gerçek metnini saklamadığından fixture metni
sentetiktir (kişisel veri yok). **Geçici kural:** `exams` üzerinde `exam_ai_shared_source_guard` — ortak kaynağa atıf yapan
bir AI sorusu ne grup üyesi ne de gövdesinde ortak metni taşıyorsa (v5 ve öncesi satırlar) hiçbir yoldan atanamaz
(`prova_shared_source_unlinked`); hazırlayıcı aynı soruyu "çocuğa gönderilemez, çıkar ve yeniden üret" diye işaretler.
Kilitli/atanmış eski sınavlar etkilenmez. Üretimde D5'in atanmamış tam taslağındaki iki soru bu kuralla atanamaz.

**2. Soru düzeyinde dönem/program ve kanonik ders kimliği.**
- `gina.question_period_tags` (soru başına bir kez yazılır, değiştirilemez; `question_bank` satırı ve mevcut sabitlik/özet
  kuralları değişmez). Kaynak: AI → katalog adayının dönemi, yoksa üretimin taslağının `context.term/program`; elle soru →
  `save_question_with_sources` isteğe bağlı `term`/`program` (geçersiz → `question_period_invalid`); mobil editör taslaktan
  açıldığında taslağın dönemini yazar. Kütüphane/eski sorular izsizdir ve hiçbir zaman işaretlenmez.
- `submit_prova_draft`: bağlamlı taslakta bilinen soru izi ≠ taslak dönemi/programı (program `normalize_subject_alias` ile)
  ve veli açıkça kabul etmediyse `prova_question_period_mismatch`. Düzeltme yolları: "Taslaktan çıkar", Başlangıç'ta
  dönemi/programı düzeltmek, "Bilerek kullan" (`content.fitAccepted`, sınavın `preparation`'ında donar; "Kabulü geri al").
- Ders: Prova ders metni C02'nin veli onaylı çocuk ders bağına (`child_subject_links`) çözülür. Hazırlayıcıda "Ders kimliği"
  kartı: öneri (`suggest_subject`) tek başına bağlamaz, "Bağla: …" → `set_child_subject_links` (program/takvimle aynı bağ).
  Gönderilen sınav `exams.subject_links` (metin + kimlik|null) anlık görüntüsünü taşır, içerik kilidiyle donar; ders metni
  hiçbir yerde değişmez. Okuma: `get_prova_question_fit(child, question_ids)` (veli; cihaz/yabancı aile 42501).

**3. C05 soru-kazanım uygunluğu veli ekranı.** `/parent/prova/fit` (İncelenecekler sekmesinde kart, yalnız uygunluk kaydı
varsa): soru (ortak kaynaklıysa kaynakla), kazanımların tam metni (`provenance.blueprint.learning_blocks`'tan, kimlik = kod
ya da kaynak hücre), ölçtüğü kazanım seçimi, karar (Uygun / Düzeltilmeli / Uygun değil), ≥10 karakter gerekçe, açık onay →
mevcut `review_scenario_question_fit` (revizyon, makbuz). **AI önerisi ayrı kutuda**, "öneridir, karar değildir", hiçbir şeyi
önceden seçmez. Liste: `list_scenario_question_fit(pending|reviewed|all)`.

## Testler (gerçekten çalıştırıldı)

```
pgTAP 121 (tek dosya)       python3 scripts/test-q02-sql.py --run-local --only 121          → 96 ok, 0 hata
Tam pgTAP Europe/Istanbul   … --run-local --out docs/release/d1-2026-11-06/pgtap-istanbul    → 121 dosya, 5407 kontrol, 0 hata
Tam pgTAP UTC               … --run-local --timezone UTC --out …/pgtap-utc                   → 121 dosya, 5407 kontrol, 0 hata
  (main birleştirmesinden sonra; 122 dahil. Birleştirme öncesi koşu: 120 dosya, 5360, 0 hata, iki saat dilimi)
Deno (CI'daki 8 deno test satırı + deno check satırı)                                        → 266+28+55+10+6+5+13+23 = 406 geçti, 0 hata; check temiz
  (generation-result.test.ts 21: yeni 3 = bağlı gövde biçimi, uzunluk reddi, D5 tablo biçimi)
pnpm --filter @gina/core test (vitest)                                                       → 59 dosya, 422 test (yeni prova-question-fit.test.ts 7)
packages/core tsc --noEmit · apps/mobile tsc --noEmit · eslint (değişen 7 dosya)            → temiz
expo export -p web (yer tutucu loopback backend)                                             → başarılı
scripts/test-isolated-services.py --run-local --with-storage --ui-hold
  (GINA_QA_UI_PLAN=pro, GINA_QA_UI_SERVICE=1, kendi fixture yolu)                           → 465/465 servis kontrolü; storage/rest/auth + DB silindi (services.json)
docs/release/d1-2026-11-06/ui/ui-check.cjs (Playwright, Chrome headless; 390×844 · 768×1024 · 1280×800)
                                                                                             → {"ok":true,"count":10} (ui/ui-checks.json)
```

Not: tüm `supabase/functions/` klasörünü izinsiz `deno test` ile koşmak, D1 dışı dosyalarda (email-tls, google-acknowledge,
review-renderer, contribution-submit) izin kaynaklı 18 hata verir; CI bu dosyaları kendi izinleriyle koşar ve orada 0 hata.

### Kabul zinciri (`ui/ui-checks.json`, 10/10; sentetik `example.invalid` aile, izole Auth/REST/Storage/Edge)
1. Tohum: 2. dönem için yazılmış elle soru, 1. dönem/Maarif/Fen Bilimleri taslağı, senaryoya bağlı bir uygunluk sorusu + servis
   üzerinden E01 biçimli AI önerisi.
2. Ders kimliği: önce "katalog dersine bağlı değil", sunucuda bağ 0 (öneri bağlamaz) → "Bağla: Fen Bilimleri" → `subject-science`.
3. Sorular adımı: 2. dönem sorusu soru düzeyinde işaretli, "Bilerek kullan" / "Taslaktan çıkar".
4. AI "Kalan 2 soruyu AI ile tamamla" → "Ortak kaynaklı 2 soru (birlikte eklenir)", ortak metin sayfada **bir kez**; tümünü seç
   = **1 seçim**, ekle → 3/3; hak 2 düştü (tek üretim); taslakta `group/ai` bloğu, sunucuda sonlanmış grup + 2 üye.
5. Grup bloğu "Yukarı taşı" → taslak bloklar `[group, question]` (grup bölünmeden taşındı).
6. "Bilerek kullan" → gönder: sınav `question_ids` = 2 üye (sırayla) + 1 soru; `subject_links=[{Fen Bilimleri, subject-science}]`;
   `preparation.fitAccepted=[elle soru]`. Atanmış grup üyesine doğrudan güncelleme reddedildi.
7. Çocuk modu: 1/3 ve 2/3 sayfalarında ortak metin tam **bir kez**, her biri kendi soru metniyle; 3/3'te yok; çocuk yanıtlarında
   `expected_answer`/`correct_key`/`rubric`/`shared_prompt` yok.
8. Uygunluk ekranı: kazanım metinleri, ayrı AI öneri kutusu; karar/gerekçe/onay olmadan kaydet kapalı; T.O.6.1 + Uygun +
   gerekçe + onay → sunucuda `fit`, ölçülen `["T.O.6.1"]`, AI önerisi `approve` ayrı alanda, `ai_is_decision:false`.
9. Bütün görüntülerde yatay taşma yok, çevrilmemiş anahtar yok, `pageerror` yok.

Deneme geçmişi (dürüst kayıt): ilk UI koşusu 8/10'dan sonra uygunluk adımında düştü — karar sunucuya yazılmıştı, betik
"İncelenen" sekmesine kayıt bitmeden geçiyordu (test sırası); betik bekleme eklenerek düzeltildi. İkinci koşu (main
birleştirmesi + D5 kuralıyla yeni export ve yeni fixture) temiz 10/10. Kanıt ikinci koşudur.

### pgTAP 121 kapsamı (96)
AI ortak metin → tek grup (sürüm 1, sonlanmış, metin bir kez, üretim sırası), sonuçta `groups`/`group_id`/`prompt`, bağımsız
soru gruplanmaz; AI satırlarında taslak dönem/programı; üye içeriği/üyeliği değişmez; kayıp yanıt tekrarı aynı sonuç, ikinci grup
yok; `get_question_context` iki üyede aynı kaynak; üye tek soru bloğu olamaz; grup + soru taslağı gönderilir, sınavda 2+1 ayrı
kimlik; grubun yeni sürümü atanmış sınavı değiştirmez; cihaz atanmış üyelerin ortak metnini okur, soru satırlarını/grupları okuyamaz;
tek bağlı soru / bayrak kapalı / biçim uymayan satır → grup yok, gövde kendi başına okunur. Dönem: elle `term/program`, geçersiz
dönem/boş program reddi, iz değiştirilemez; uyuşmazlık gönderimi durdurur, yalnız biri kabul edilince hâlâ durur, `fitAccepted`
şekil/tekrar reddi, kabul → gönderim ve `preparation`'da donma; taslak dönemi düzeltilince geçer; izsiz soru ve bağlamsız eski
taslak engellenmez. Ders: bağ yokken kimlik null; veli onayıyla `subject-science`, metin aynen; sınav anlık görüntüsü, sonraki
bağ eski sınavı değiştirmez, kilitli sınavda değiştirilemez; cihaz/yabancı aile 42501, yabancı soru izi görünmez, 200 sınırı.
Uygunluk listesi: bekleyen sayısı, soru, kazanım metinleri (kod/hücre kimliği), AI önerisi ayrı ve karar değil, karar sonrası
bekleyen listeden çıkar, gerekçe/ölçülen çıktı korunur, yabancı aile boş, cihaz/anon reddi; iç yardımcılar ve iz tablosu dışarı
kapalı. D5: ortak **tablo** bitişik olmayan 1. ve 4. sorudan tek grup, tablo satırları aynen; v5 biçimli (tablo yalnız provenance'ta)
soru taslakta durabilir ama gönderilemez ve doğrudan `exams` eklemesiyle de atanamaz; v6 kendi başına okunur soru atanabilir.

## Değişen dosyalar
- Sunucu: `supabase/migrations/20261106350000_prova_shared_ai_and_subject_fit.sql` (yeni: `gina.link_ai_shared_sources`,
  `gina.question_period_tags` + koruma, `gina.tag_question_period`, `gina.tag_ai_generation_periods`, `gina.prova_period_mismatches`,
  `gina.ai_shared_source_unlinked` + `exam_ai_shared_source_guard`, `exams.subject_links` + koruma, `public.get_prova_question_fit`,
  `public.list_scenario_question_fit`; imzası aynı yeniden tanımlananlar: `complete_prova_generation_v2`,
  `save_question_with_sources`, `gina.validate_prova_draft`, `submit_prova_draft`), `supabase/tests/121_prova_shared_ai_and_subject_fit.test.sql`.
- Edge: `supabase/functions/prova-generate/index.ts` (istem v6), `_shared/generation-result.ts` (+ test). `_shared/catalogue-plan.ts` değişmedi.
- Core: `prova-question-fit.ts` (+ test), `prova-draft.ts` (`fitAccepted`), `prova-generation-journal.ts` (`groups`, `group_id/prompt/position`), `index.ts`, `i18n/{tr,en}.json` (61 yeni anahtar).
- Mobil: `app/parent/prova/{index,question}.tsx`, yeni `app/parent/prova/fit.tsx`; `components/learning/{prova-builder,prova-source-picker}.tsx`, yeni `components/learning/{prova-subject-links,scenario-fit-review}.tsx`.
- Test altyapısı: `scripts/test-isolated-services.mjs` (opt-in `GINA_QA_UI_SERVICE`), `docs/release/d1-2026-11-06/ui/{ui-check,serve-export}.cjs`.

## Yayın sırası (yayımlanmadı)
1. Migration `20261106350000` (main'deki `20261106360000`'dan önce sıralanır; ikisi bağımsız). Geçici kural hemen etkin olur:
   D5'teki atanmamış v5 tam taslağı (tablo bağlı iki soru) atanamaz — beklenen.
2. Aynı anda `prova-generate` yeniden dağıtımı (v6). Eski Edge + yeni migration: v5 satırları `shared_prompt` taşımadığından
   gruplanmaz ve geçici kurala takılır (çocuğa eksik soru gitmez). Yeni Edge + eski migration: gövde kendi başına okunur, grup yok.
3. Mobil sürüm. Eski istemci: sunucu sonucundaki ek alanları yok sayar ama AI grup üyesini tek soru olarak eklemeye çalışırsa
   `prova_source_unavailable` alır (sessiz kayıp yok); `fitAccepted` taşıyan taslağı katı şema nedeniyle açamayabilir (yalnız veli
   kabul ettiyse). Grup dönüşümü üretimde `question_groups.enabled=true` olmadan çalışmaz (o zaman sorular kendi başına okunur kalır).
4. Dağıtım sonrası: gerçek modelle tek sentetik üretim (C08/D5 düzeni) — grup kuruluyor mu, gövde ve tablo okunur mu.

## Kalan sınır
- **Gerçek AI ile doğrulanmadı.** Grup dönüşümü gerçek handler + deterministik sağlayıcı ve D5 biçimli fixture ile kanıtlandı;
  gerçek modelin v6 istemine (en az iki bağlı soru, ortak metni gövdede tekrar etmeme) uyumu ölçülmedi.
- Çocuk ekranında ortak içerik her bağlı soru sayfasında bir kez gösterilir (tek soru/sayfa düzeni); kitapçık/PDF'te grup
  başlığının bir kez basılması bu işte denenmedi. `visual_description` metinle tariftir, görsel üretilmez.
- Dönem izi yalnız D1 sonrası oluşturulan elle/AI sorularda var; kütüphane ve eski sorular izsizdir (işaretlenmez). Programlar
  serbest metin, normalizasyonla karşılaştırılır (katalog program kimliği yok).
- Ders kimliği çocuk başına (C02 bağı); aynı aile soru bankası farklı çocuklarda farklı bağa çözülebilir. Soru satırına kimlik yazılmaz.
- Uygunluk ekranında AI önerisini üreten çağrı yok (yalnız servis kaydı gösterilir). Kartta konu "Blok 1" ve "Blok B1" yan yana
  görünebiliyor (kozmetik).
- Native PDF, fiziksel cihaz, büyük yazı/ekran okuyucu denenmedi; kanıt web export + Playwright.

## Temizlik
İzole servis koşuları: storage/rest/auth konteynerleri ve `gina_http_<hex>_audit` DB'leri betik tarafından silindi
(`services.json` `cleanup` hepsi `true`); tam pgTAP ve 121 klonları (`gina_q02sql_*`) koşu sonunda düşürüldü (kalan 0). Statik web
sunucusu durduruldu; fixture dosyası serbest bırakmada silindi. Son kontrolde kalan tek `gina_http_79e8e36cca857867_audit` takımı
(realtime'lı) başka bir ajana ait; dokunulmadı. Scratchpad dosyaları `d1_` önekli.
