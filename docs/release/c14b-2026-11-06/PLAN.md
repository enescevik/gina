# İkinci ara yayın (C14b) — plan (onay bekliyor)

6 Kasım 2026. Kaynak: main `HEAD` (D1–D9 birleşik). Bu belge plandır; **hiçbir adım çalıştırılmadı**. R02 yerine geçmez. Önceki yayın: [C14](../c14-2026-11-06/PLAN.md), kaynak `c16b8b1`.

## Kapsam

| Hedef | Şimdi canlıda | Yayınla gelecek |
|---|---|---|
| Üretim DB | 141 migration (son `20261106340000`) | **5 yeni migration**: `350000` prova_shared_ai_and_subject_fit (D1), `360000` pairing_reject_notice (D2), `370000` operator_scope_admin_and_question_notes (D3), `380000` ai_quality_fixes (D6), `390000` content_accept_and_role_admin (D7) |
| Edge | C14 kaynağı | Değişen paylaşılan modülleri kullanan **8 fonksiyon**: `prova-generate` (v7-rubric-100), `prova-grade` (v5-shared-sources), `prova-review` (review-v2), `prova-plan`, `ai-preflight`, `ai-weekly-summary`, `learning-plan-import`, `timetable-import` |
| Ayar | `question_groups.enabled=false` | **`true`** (D1 AI ortak kaynak grupları; 28 istemci grupları zaten destekliyor) |
| Veli webi / yönetim | C14 (6 Kasım 16:3x) | main (D1–D9 ekranları, `/operators`, kapsam ve kanal hataları sayfaları) |
| iOS / tablet | 0.1.0 (28) | 0.1.0 (29) TestFlight + tablet Ad Hoc |

Kapalı kalan kapılar: `content_prereview.enabled`, e-posta/SMS (X01/X02), ek AI sağlayıcıları (X04), satış.

## Eski istemci (28) uyum matrisi

| Değişiklik | 28 davranışı | Etki |
|---|---|---|
| D1 AI grup üyesini tek soru olarak ekleme | `prova_source_unavailable` | Sessiz kayıp yok; 29'da grup olarak eklenir |
| D1 `fitAccepted` taşıyan taslak | Katı şema nedeniyle açılmayabilir | Yalnız 29'da uyum kabul edilen taslaklar |
| D2 eşleme ret bildirimi | Yeni gelen kutusu türünü göstermez | Uyumlu, yalnız bildirim görünmez |
| D3 soru başına ret notu | 28 notu göstermez, genel ret görünür | Uyumlu |
| D8 PDF yazı tipi, süre doldu notu | Yok | Yalnız istemci |
| D9 istem sürümü değişimi | — | Dağıtımdan önce `uncertain` kalan puanlama işi bir kez daha ücretlenebilir (sentetik dışında iş yok, pratikte 0) |

Sonuç: 28 çalışmaya devam eder; zorunlu güncelleme yok, 29 aynı gün dağıtılır.

## Sıra (tek oturum)

1. Ön kontrol: bekleyen migration 5 / sıra dışı 0, yeni anlık görüntü (`.codex-setup/c14b/`), canlı ACL kontrolü (beklenen 0).
2. 5 migration, her biri tek işlem; ardından ledger 146, ACL 0, RLS kapalı tablo 0.
3. 8 Edge fonksiyonu (`--use-api`); sürüm listesi kaydı.
4. `question_groups.enabled=true`.
5. Web + yönetim; canlı JS hash, Access kontrolü.
6. Canlı doğrulama (sentetik hesap, sonra temizlik):
   - B1: tek `prova-grade` çağrısı; `ai_result_invalid` yerine geçerli rapor, ortak kaynak yükte.
   - `accept_ai_grade` gerçek bir öneriyle.
   - Tek `prova-generate`: grup kuruluyor mu, rubrik toplamı 100 mü, kişi adı etiketi.
   - En fazla 4 gerçek AI çağrısı.
   - `health-check.mjs --strict`.
7. DB tiplerini yeniden üret (değişiklik varsa commit).
8. iOS 29 yerel EAS build → `eas submit`; tablet 29 Ad Hoc → önizleme hash → `tablet` alias.

## Geri dönüş

- DB: ileri düzeltme. `question_groups.enabled=false` ile D1 grupları anında kapanır.
- Edge: C14 kaynağından (`c16b8b1`) yeniden dağıtım.
- Web/yönetim: `scripts/rollback.mjs` ile C14 dağıtımı.
- Tablet: `eas deploy:alias --alias tablet --id m8aeavsrur` (28).
- iOS: TestFlight'ta 28 kalır.

## Gerekenler

- **Senin onayın**: 5 migration, 8 Edge, bayrak, web/yönetim, iOS/tablet 29 ve en fazla 4 sentetik gerçek AI çağrısı.

## Yürütme kaydı (6 Kasım 2026, Enes onayı 15:38Z)

| Adım | Sonuç |
|---|---|
| Anlık görüntü | 193 tablo, 682 satır (`.codex-setup/c14b/pre-release-snapshot.json`, gitignored) |
| Ön kontrol | bekleyen 5, sıra dışı 0, ACL 0, RLS kapalı tablo 0 |
| Migration | 5/5 uygulandı; ledger 146, son `20261106390000`; sonrası ACL 0, RLS kapalı 0 |
| Edge | 8/8 dağıtıldı (`prova-generate` v21, `prova-grade` v22, `prova-review` v12, diğerleri); `content-prereview` jwt=true, `channel-unsubscribe` jwt=false değişmedi |
| Bayrak | `question_groups.enabled=true` |
| Web | https://1c0cf214.gina-web.pages.dev, canlı hash eşleşti |
| Yönetim | https://30000ffb.gina-backoffice.pages.dev, Access 12/12 korumalı |
| Sağlık | `health-check.mjs --strict` ok, başarısız/atlanan 0 |
| iOS 29 | yerel EAS store build, SHA-256 `a5ad4764cad2…`, TestFlight gönderimi `d9628cbd` |
| Tablet 29 | dağıtım `b9q067lwk9` → `tablet` alias, hash doğrulandı ([kayıt](../tablet-29-2026-11-06/release.json)) |
| Ek düzeltme | `prova-grade/v6-alternatives-full` (alternatif cevap tam puan), `8fb2eef`, yeniden dağıtıldı; canlıda ölçülmedi |
| Canlı AI ([ai/](ai/)) | 3 ücretli çağrı (tavan 4), sentetik hesap silindi, aile kapsamlı satır 0 |

Canlı AI bulguları:
- **B1 kapandı:** `prova-grade` 200, 4 öneri, kesin puan yazılmadı; tekrar ikinci iş açmadı; `accept_ai_grade` öneriyi kesin puan yaptı, eski öneri `ai_suggestion_changed` ile reddedildi, çocuk kabul edemedi, çocuk öneriyi göremedi.
- **D1 doğrulandı:** gerçek üretimde ortak tablo gerçek gruba dönüştü (1 grup, 2 üye); grup üyesi tek soru olarak eklenince `prova_source_unavailable` (beklenen), `kind:"group"` bloğuyla eklendi.
- **D9 doğrulandı:** istem `prova-generate/v7-rubric-100`; açık uçlu 4 sorunun rubrik toplamı 100.
- **Yeni kalite bulgusu (P2):** "Pastanın yarısı yenmiş, yani 0,5." cevabı 60 aldı (beklenen ≥80). Model ölçütleri harfiyen uyguladı ("2/4 yazar" ölçütünü vermedi); rubriğin `alternative_answers` listesi tam puan anlamında okunmadı. İstemde "kabul edilen alternatif cevap tam puan sayılır" kuralı gerekli.
- İlk deneme Pro izni olmadan koştu (402 `plan_has_no_ai`, sağlayıcıya istek yok); kaydı [ai/attempt1-no-override/](ai/attempt1-no-override/) içinde, ücretli sayılmaz.
