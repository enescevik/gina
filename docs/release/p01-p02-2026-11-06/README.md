# P01/P02 — Prova hazırlayıcı, soru editörü, senaryo seçimi + P04 inceleme düzeltmeleri (6 Kasım 2026)

Gece P01/P02 ajanı (Claude Opus 5.5). Dal `worktree-agent-af22cd8d3e211dce5`, taban main `304f303` (≥ `e4bc2dc`). Çalışma
02:19–05:30 Europe/Istanbul. **Main'e push edilmedi; migration eklenmedi; üretime dokunulmadı; ücretli AI çağrısı yapılmadı.**
i18n'e yalnız yeni anahtar eklendi (`provaP01.*`, `provaP02.*`; tr+en, 62 anahtar); mevcut anahtar silinmedi/değiştirilmedi.

## Commit'ler (eskiden yeniye)

| Commit | İçerik |
|---|---|
| `fe90113` | inceleme alanı: boş soruda "Cevap yok", puan kutusu yer tutucusu "—" |
| `59a648f` | soru editörü üç adımlı; doğru şık başlangıçta boş |
| `bf54cc1` | hazırlayıcı: ders listesi katalog + `suggest_subject` onaylı; uygunsuz soru işareti; kaynak karışımı |
| `77bcfd6` | senaryo biliniyor/bilinmiyor, güncellik doğrulanamadı, kişiselleştirilmiş çalışma; Başlangıç çalışması; kitapçık iki nüsha |
| `4878f70` | soru editörü derin bağlantıda kaydet/vazgeç sonrası Prova merkezine döner |
| `f20517d` | çalışma/kişiselleştirilmiş dağılımda okul karşılaştırma onayı yerine çalışma onayı |
| (bu rapor) | README, `ui/ui-check.cjs`, `ui/serve-export.cjs`, görüntüler, PDF'ler |

## Ne değişti

| Ekran / bileşen | Önce | Sonra |
|---|---|---|
| `components/learning/parent-review-workspace.tsx` (inceleme alanı, P04 kalan sınırı) | Boş açık uçlu soruda alt şerit "Değerlendirme bekliyor"; puan kutusu yer tutucusu "0" (0 verilmiş gibi okunuyordu) | Soru durumu `empty` ise alt şerit **"Cevap yok"** (`parentReview.state.empty`); puan kutusu yer tutucusu **"—"**. Cevaplı açık uçlu soru "Değerlendirme bekliyor" olarak kalır. |
| `parent/prova/question.tsx` (soru editörü) | Tek uzun form | **Üç adım:** 1 Soru ve görsel → 2 Yanıt ve ölçüt → 3 Öğrenci önizlemesi. Doğru şık başlangıçta boş (hiçbir şık seçili gelmez); adım geçişinde eksik alan uyarısı ("Doğru şıkkı işaretle."); açık uçluda beklenen cevap/ölçüt zorunlu (hazırlayıcının "cevabı eksik" kuralıyla aynı). Önizleme doğru cevabı, ölçütü ve çözümü göstermez. Derin bağlantıdan açılınca Kaydet/Vazgeç Prova merkezine döner (önceden `router.back()` geçmiş yoksa ekranda kalıyordu). |
| `components/learning/prova-builder.tsx` (hazırlayıcı) | Ders listesi yalnız `current_question_bank`'tan; boş bankada ders çıkmıyordu. Uygunsuzluk yalnız son adımda genel bir hata. | Ders listesi **S04 kataloğu** (`get_guided_input_options(child,'subject')`, çocuğun sınıfına göre) + bankadaki dersler + taslaktakiler. "Başka ders ekle" artık `suggest_subject` çağırır; adaylar ve "Yazdığım gibi ekle" seçeneği gösterilir, ders yalnız veli seçince eklenir (tek aday da onay ister). Çocuk/sınıf/ders/soru türü değişince **blok bazında "Bu seçime uygun değil · …"** işareti (neden: "6. sınıf sorusu", "ders: Fen Bilimleri", "çoktan seçmeli (bu Prova açık uçlu)"); sorular silinmez, ortak kaynak grubu tek blok olarak işaretlenir/taşınır (bölünmez). Başlangıç adımında "Seçimin değişti: N soru bloğu artık uygun değil…" uyarısı. Sorular adımında taslağın kaynak karışımı: "Bu taslakta: Senin eklediğin 2 · AI önerisi 1 · Kütüphane 3 · 1 ortak kaynak grubu". |
| `parent/prova/catalog.tsx` (senaryo seçimi) | Senaryo listesi doğrudan; okulun seçimi tek onay kutusu; güncellik sorgusu başarısızsa satır hiç görünmüyordu | Senaryo listesinden önce **"Okulun senaryosunu biliyorum / Henüz bilmiyorum"**; cevap verilmeden senaryo gösterilmez (sessiz ilk seçim yok). **Bilmiyorum** yolunda senaryolar "Çalışma senaryosu · …" etiketiyle; inceleme adımında okul onay kutusu yerine "okul doğrulaması ve resmî uygunluk iddiası yoktur" notu; kayıt `save_catalog_blueprint` ile (sunucu `school_confirmed=true` yazdığı için) **yapılmaz**, tam dağılım düzenlenebilir dağılım ekranına taşınır. **Biliyorum** yolunda mevcut onay + "Dağılımı değiştirmek istiyorum". Her iki yolda "Tam senaryo: N öğrenme grubu · M soru". Kaynak güncelliği: yükleniyor satırı, "Kaynak son kontrol: tarih", sorgu hata verirse **"Güncellik doğrulanamadı."** + serbest çalışma notu (mevcut M01 durum satırları korunur). |
| `parent/prova/blueprint.tsx` (dağılım) | — | Katalogdan gelen tohum (`seed`): tam blok/adet dağılımı ile doğrudan 2. adım; etiket "Çalışma senaryosu" ya da "Okulun senaryosu". Blok/adet/konu değişirse **"Kişiselleştirilmiş çalışma"** etiketi ve "5 → 6 soru" farkı; ad boş bırakılırsa "‹senaryo› · Kişiselleştirilmiş çalışma" olarak kaydedilir. |
| `parent/prova/level.tsx` | "Seviye tespiti" | **"Başlangıç çalışması"**; açıklama "standart bir ölçme veya tanı değildir"; yeni sınav adı "‹ders› · Başlangıç çalışması" (yeni anahtarlar). |
| `parent/prova/booklet.tsx` (kitapçık) | Tek PDF; cevap anahtarı son sayfada | **Öğrenci nüshası** ve **cevap anahtarı** ayrı belgeler ("Öğrenci nüshasını oluştur" / "Cevap anahtarını ayrı oluştur"). Öğrenci nüshasında cevap/ölçüt/çözüm yok; anahtar belgesinde soru sayfaları ve kapak yok. Ortak düzen (`@gina/core` `buildBookletHtml`) değişmedi; ayrım ekranda kaçışlanmış düzenin bölüm sınırlarından yapılır. |

## Testler (gerçekten çalıştırıldı)

```
apps/mobile npx tsc --noEmit                      → exit 0 (son kodda)
apps/mobile npx expo lint                         → exit 0
pnpm --filter @gina/core test                     → 52 dosya, 365 test geçti (i18n JSON değişikliği sonrası)
expo export -p web (yer tutucu loopback backend)  → başarılı (son kodla yeniden üretildi)
scripts/test-isolated-services.py --run-local --ui-hold
  (GINA_QA_UI_FIXTURE = scratchpad'de benzersiz yol, web 127.0.0.1:8491)
  1. koşu: 137/137 servis kontrolü; auth/rest container'ları ve geçici DB silindi (45 dk tutma süresi doldu)
  2. koşu: 137/137; tam UI turu bu temiz fixture'da; SIGUSR2 ile bırakıldı → auth/rest container'ları ve geçici DB silindi
docs/release/p01-p02-2026-11-06/ui/ui-check.cjs (Playwright, Chrome headless, 390×844 · 768×1024 · 1280×800)
  → {"ok":true,"count":12}  (ui/ui-checks.json)
```

`ui/ui-checks.json` kontrolleri:
1. **Boş bankada ders seçimi:** tohumdan önce 5. sınıf bankasında yalnız "Fen", "Matematik" vardı. Hazırlayıcıda bankada olmayan Türkçe, Fen Bilimleri, Sosyal Bilgiler, İngilizce katalogdan listelendi (3 ölçü). "mat" yazıp Ekle → "“mat” için hangi dersi kastettin?" + "Yazdığım gibi ekle: mat"; ders yalnız aday seçilince eklendi.
2. **Karma taslak:** tek taslakta elle + AI (deterministik sentetik soru) + kütüphane + ortak kaynak grubu (`save_question_source_group`, 2 soru) + başka sınıf/ders sorusu. "Bu taslakta: … · 1 ortak kaynak grubu", "1 blok … uyumsuz", blokta "Bu seçime uygun değil · 6. sınıf sorusu · ders: Fen Bilimleri". Ders Türkçe'ye değişince başlangıç adımında "Seçimin değişti…" uyarısı; 5 blok korundu, görüntülemek yeni sürüm kaydetmedi.
3. **Adımlı editör:** 1. adım; 2. adımda A–D'nin hiçbiri `aria-selected=true` değil; şık işaretlenmeden Devam → "Doğru şıkkı işaretle."; önizleme çözüm metnini göstermiyor; Kaydet → soru tek kez, `correct_key='A'`.
4. **Senaryo bilinmiyor yolu:** (katalog yanıtı sentetik senaryoyla sabitlendi, güncellik RPC'si 503 döndürüldü) "Güncellik doğrulanamadı." + serbest çalışma notu; okul sorusu cevaplanmadan senaryo görünmüyor; "Henüz bilmiyorum" → "Çalışma senaryosu · …"; inceleme adımında okul onay kutusu yok, "Tam senaryo: 2 öğrenme grubu · 5 soru"; "Çalışma dağılımı olarak devam et" → dağılım ekranı; bir satır +1 → "Kişiselleştirilmiş çalışma", "5 → 6 soru"; kayıt adı "Sentetik senaryo … · Kişiselleştirilmiş çalışma", `source_context.origin = parent_entered` (katalog okul onayı `reviewed_catalogue` değil).
5. **Kitapçık iki nüsha:** iki ayrı belge yakalandı. Öğrenci nüshasında `<main>` ve sorular var, cevap anahtarı bölümü ve çözüm metni yok; anahtar belgesinde kapak ve soru sayfaları yok. A4 PDF: `ui/booklet-student-copy.pdf`, `ui/booklet-answer-key.pdf`.
6. **İnceleme boş soru:** 3 ölçüde "Bu soru için cevap gönderilmemiş." + alt şerit "Cevap yok", "Değerlendirme bekliyor" yok; cevaplı açık uçlu soruda "Değerlendirme bekliyor" kalıyor. Puan kutusu yer tutucusu "—" **yalnız masaüstünde** okundu (telefon/tablette puan kutusu ilk ekranda Çözüm sekmesi arkasında; `placeholder: null` = alan bulunamadı, doğrulanmadı).
7. Bütün görüntülerde yatay taşma yok, çevrilmemiş `provaP0x./provaBuilder./catalogFlow./parentReview.` anahtarı yok, `pageerror` yok.

Ücretli AI çağrısı yok. Yeniden çalıştırma: `node ui/serve-export.cjs <export> <port>` + `ui/ui-check.cjs` (ortam değişkenleri dosya başında; `GINA_QA_ONLY=subjects,mixed,editor,catalog,booklet,review` ile bölüm seçilebilir).

## Görüntüler (`ui/`)

- Hazırlayıcı: `builder-empty-bank-subjects-{phone,tablet,desktop}.png`, `builder-suggest-subject-phone.png`, `builder-mixed-draft-{…}.png`, `builder-mixed-draft-unsuitable-{…}.png`, `builder-scope-changed-phone.png`
- Editör: `editor-step1-{…}.png`, `editor-step2-correct-missing-phone.png`, `editor-step3-preview-{…}.png`, `editor-after-save-phone.png` (son export; derin bağlantı düzeltmesinden sonra)
- Senaryo: `catalog-scope-phone.png`, `catalog-school-question-freshness-unknown-{…}.png`, `catalog-unknown-study-{…}.png`, `blueprint-study-seed-phone.png`, `blueprint-personalized-{…}.png`, `blueprint-personalized-review-phone.png`
- Kitapçık: `booklet-two-copies-{…}.png`, `booklet-student-copy.{png,pdf}`, `booklet-answer-key.{png,pdf}`
- İnceleme: `review-blank-question-{…}.png`, `review-answered-question-phone.png`

## Kalan sınır (yapılmadı / doğrulanmadı)

1. **Hazırla / Gönderilenler / İncelenecekler ayrımı yapılmadı.** Bu ayrım Prova merkezinde (`parent/prova/index.tsx`) ve o dosya bu işin sahipliği dışında (yeni birleşti, dokunulmadı). Aynı nedenle merkezdeki "Seviye tespiti" kart başlığı (`prova.level.title`) eski adla duruyor; yeni anahtar `provaP02.level.title` hazır.
2. **Sunucu, veli girişli dağılımda da `school_confirmed: true` yazıyor** (`20261103076000_family_blueprint.sql`, `origin: parent_entered`). "Henüz bilmiyorum" yolu katalog okul onayıyla kaydetmez ve UI onay metni çalışma onayına çevrildi; ama sunucu kaydı hâlâ `school_confirmed: true` taşır. Doğru ayrım için `save_exam_blueprint`'e çalışma/okul beyanı alanı ekleyen migration gerekir (bu işte yasak). Kişiselleştirme bilgisi yalnız ad ve UI etiketiyle korunuyor, ayrı alan yok.
3. **Senaryo testi sentetik katalog yanıtıyla** yapıldı: izole DB'de yayımlanmış OYSS senaryosu yok; `get_curriculum_scenarios` yanıtı Playwright'ta sentetik bir senaryoyla, `get_curriculum_source_freshness` 503 ile sabitlendi. Gerçek katalog yayını + "biliyorum" yolu kaydı UI'da çalıştırılmadı.
4. **Dönem (term) uygunluğu işaretlenmiyor:** taslak şeması (`provaDraftSchema`, strict) ve `question_bank` dönem alanı taşımıyor; işaret sınıf, ders ve soru türüyle sınırlı. Okul/program değişimi de işaretlenmiyor.
5. "Eski giriş yolları doğru taslağa yönlensin", "aynı metin/görselden birden çok soru üretimi (AI)", "tamamen AI taslak", alternatif açık uçlu doğru cevaplar, MEB Ortak Yazılı / LGS / serbest çalışma ayrımının hazırlayıcıya taşınması **yapılmadı**.
6. AI bloğu gerçek üretim değil, `source:"ai"` etiketli deterministik sentetik sorudur; ücretli/gerçek AI yolu denenmedi.
7. Kitapçık ayrımı ekranda düzenin bölüm sınırlarından yapılıyor (`@gina/core` sahiplik dışı); düzen değişirse `invalid_booklet_layout` hatası verir. Native PDF (expo-print) yolu denenmedi; yalnız web yazdırma iframe'i yakalandı ve Chrome ile PDF'e basıldı.
8. İnceleme puan kutusu "—" telefon/tablette doğrulanmadı (yukarıda 6. madde).
9. Fiziksel cihaz yok; yalnız web export.
