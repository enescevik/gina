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
