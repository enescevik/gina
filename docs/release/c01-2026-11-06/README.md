# C01 — P0 yanlış doğrulama ve eski sonuçları koruma (6 Kasım 2026)

Kart: `docs/CLAUDE-REMAINING-WORK.md` §4A **C01** (eski görevler: **P02 / P04 / L02 / Q02**). Ajan: Claude Opus 5.5.
Dal `worktree-agent-a1abf189c019f218e`, taban main `fcfe8e5`. **Main'e push edilmedi, üretime dokunulmadı, `db reset`
yapılmadı. Yayımlanmadı.** Durum: `KOD HAZIR` + izole SQL/core testleri geçti; cihaz/canlı kabul yok.

## Commit'ler

| Commit | İçerik |
|---|---|
| `45a359f` | migration + pgTAP 108 + core şema/yardımcılar + blueprint ekranı yükü + üretilmiş DB tipleri |
| (bu rapor commit'i) | tetikleyici adı düzeltmesi (057 sözleşmesi) + bu README |

## Değişen dosyalar

| Dosya | Ne |
|---|---|
| `supabase/migrations/20261106220000_blueprint_truth_and_archive_guard.sql` (yeni, tek migration) | Aşağıdaki dört bölüm |
| `supabase/tests/108_blueprint_truth_and_archive_guard.test.sql` (yeni) | 108 pgTAP kontrolü |
| `packages/core/src/blueprint.ts` | `blueprintInputSchema`'ya isteğe bağlı `school_scenario` (`known`/`unknown`) ve `personalization` (strict). Eski yerel günlük komutları aynen okunur. |
| `packages/core/src/blueprint-provenance.ts` (yeni) | Köken satır şeması, `blueprintProvenanceLabel`, `seedIsPersonalized`, `seedProvenanceInput` |
| `packages/core/src/legacy-score-correction.ts` (yeni) | Önizleme/uygulama yanıt şemaları, `legacyZeroSelectable`, `legacyZeroImpact` |
| `packages/core/src/blueprint-provenance.test.ts` (yeni) | 11 test |
| `packages/core/src/index.ts` | iki yeni dışa aktarım |
| `packages/core/src/database.types.ts` | `scripts/gen-db-types-isolated.sh --run-local` ile yeniden üretildi (yeni sütunlar/RPC'ler; ayrıca main'de tiplere yansımamış `20261106210000_support_assignment` yüzeyi de geldi) |
| `apps/mobile/src/app/parent/prova/blueprint.tsx` | Katalog tohumlu kayıtta `school_scenario` + `personalization` gönderilir; yerel kişiselleştirme hesabı core yardımcısına taşındı. **Görünüm değişmedi.** |

`catalog.tsx`, takvim ekranları, Edge fonksiyonları ve i18n değişmedi (gerek olmadı; aşağıda gerekçe).

## 1. Senaryo kökeni (P02)

Sorun: `save_family_blueprint` (kartta `save_exam_blueprint` diye geçiyor; gerçek ad bu) her veli girişini
`source_context.school_confirmed:true` yazıyordu; "Henüz bilmiyorum" yolu ve kişiselleştirilmiş çalışma da okul onaylı görünüyordu.

Yeni `exam_blueprints` sütunları (her biri ayrı):

| Sütun | Anlam | Kim yazar |
|---|---|---|
| `school_scenario` `known/unknown/unstated` | Velinin "okulun senaryosunu biliyorum/bilmiyorum" beyanı; eski istemci = `unstated` | `save_family_blueprint` |
| `distribution_kind` `school_catalogue/parent_study/personalized` | Dağılımın kökeni | RPC / katalog bağ tetikleyicisi |
| `school_confirmed` | **Yalnız** katalog kopyası + veli okul onayı (`save_catalog_blueprint`, `confirmed:true`) | `gina.catalog_blueprint_links` AFTER INSERT tetikleyicisi |
| `official_source_verified` + `official_verified_at` | Resmî kaynak doğrulaması, okul onayından bağımsız | yalnız `service_role`, yalnız katalog kopyasında |
| `personalization` | Kişiselleştirme metadata'sı (`basis`, `base_label`, `base_total`, `base_blocks`), isimden ayrı | `save_family_blueprint` |

Koruma katmanları: (a) CHECK `school_confirmed ⇒ school_catalogue ∧ known`, `official ⇒ school_catalogue ∧ tarih`,
`personalized ⇔ personalization`; (b) `provenance_guard` tetikleyicisi (SECURITY INVOKER) — doğrudan REST yazımı
(`authenticated`/`anon`) köken sütunlarını/JSON'u kuramaz ve değiştiremez (`blueprint_provenance_locked`, 42501); isim
değişikliği çalışır. Tetikleyici adı alfabetik olarak `protect_catalog_blueprint`'ten sonra gelir, böylece katalog kopyasının
mevcut `curriculum_copy_immutable` hatası (pgTAP 057) korunur. (c) RPC `school_confirmed`/`officially_verified` anahtarlarını
reddeder (`blueprint_invalid`).

Eski kayıt düzeltmesi `gina.backfill_blueprint_provenance()` (migration içinde bir kez çağrılır, tekrar çalıştırılabilir):
katalog bağı olan satır = okul onaylı kopya; diğerleri veli girişi. P02 ad etiketleri köken olarak okunur
(`· Çalışma senaryosu` → `unknown`, `· Okulun senaryosu` → `known` beyanı, `· Kişiselleştirilmiş çalışma` →
`personalized` + `{"basis":"legacy_name_tag"}`). `source_context` içinde `school_confirmed:false` olur; **ad, satırlar,
sınavlar, atanmış soru/cevap/puan snapshot'ları yazılmaz**. Her düzeltilen satır `gina.blueprint_provenance_corrections`
tablosuna önce/sonra ile bir kez yazılır.

## 2. Arşivli takvim kaydı (L02)

`save_calendar_event` arşivli kimlikle düzenleme, silme ve "yeni" olarak yeniden oluşturmayı `event_archived` ile reddeder.
Geri alma yalnız mevcut `bulk_restore_apply` akışıyla; geri alındıktan sonra düzenleme yine çalışır. Arşivden önce alınmış
bir isteğin kayıp-yanıt tekrarı yalnız saklı sonucu döner, satıra dokunmaz. İstemci hata kodu `P0001` olduğu için
`lib/calendar-command.ts` günlüğü temizler; `event-editor.tsx` bu kod için genel hata metni gösterir (takvim ekranı C02'de).

## 3. Haftalık özet ve gün ekranı kapsamı (L02/Q02)

İnceleme sonucu: güncel `get_weekly_summary_data` (v2) etkinlik saymıyor — takvim raporundaki "arşivli etkinlikleri
hâlâ sayar" notu v1'e (`20261030030000`) aitti. Gerçek tutarsızlık şuydu: veri çocukları **arşivli profili hariç**
sayıyor, ama takma ad eşlemesi (`gina.capture_weekly_aliases`, `get_family_weekly_review`) **bütün** çocukları
sayıyordu; arşivli ilk çocuk "Çocuk A"yı alıp canlı çocukların adını kaydırıyordu (kod incelemesiyle tespit; eski
fonksiyonla A/B koşturulmadı). Üçü artık tek yardımcıdan, `gina.weekly_children(family)`, besleniyor. Görev sayımı gün
ekranının "kaydı olan iş" kuralıyla aynı (arşivlenen rutinin kaydı sayılmaya devam eder); pgTAP bunu doğrudan
`task_completions` sayımıyla karşılaştırır. Mevcut haftalık snapshot'lar (`weekly_summary_contexts`) yeniden yazılmadı.
Edge `ai-weekly-summary` veri biçimi değişmediği için dokunulmadı.

## 4. P04 öncesi otomatik sıfırlar (P04)

Eski kural boş metinli açık uçluyu (çizim-only dahil) yalnız **deneme toplamlarında** 0 sayıyordu; `exam_answers`'a puan
yazılmamıştı. Aday: bitmiş, P04 sonrası hiç yeniden hesaplanmamış (`provisional is null`), düzeltilmemiş, en az bir
puansız + metni boş açık uçlu maddesi olan deneme.

- `preview_legacy_open_zero_corrections(p_family_id?)` — yazmaz. Veli: kendi ailesi (deneme başına önce/sonra toplam,
  maddeler `pending`/`unanswered`, korunan puan sayısı, arşivli profil `blocked`). Tam yönetici (`is_admin_strict`):
  aile belirtmezse yalnız aile başına sayı (çocuk adı yok), belirtirse o aile.
- `apply_legacy_open_zero_corrections(p_request_id, p_attempt_ids, p_family_id?)` — yalnız açıkça seçilen denemeler;
  veli kendi ailesi, yönetici aileyi adıyla vermek zorunda. Her deneme `gina.recompute_attempt_totals` ile P04 kuralına
  getirilir ve önizlemeyle eşleşmezse işlem geri alınır. `mutation_receipts` ile aynı istek aynı sonucu döner; yeni
  istek `already_corrected`; aynı istek farklı seçim `request_conflict`. Arşivli profil `child_archived`, başka aile
  `not_found`, uygun olmayan `not_eligible` döner — bunlara dokunulmaz.
- `get_legacy_open_zero_corrections(p_family_id?)` — denetim izi (önce/sonra, maddeler, rol, zaman).
- **Otomatik çalıştırma yok**; migration hiçbir denemeyi yeniden hesaplamaz. Veli/AI puanları, cevaplar, inceleme
  belgeleri, dönem/rapor snapshot'ları değişmez (pgTAP `exam_answers` özet hash'i ile doğrular).
- UI bağlanmadı (aşağıda kalan engel).

## Testler (gerçekten çalıştırıldı)

Ortam: **izole** — `supabase_db_gina` container'ında boş `gina_completion_audit` şablonundan benzersiz geçici DB'ler
(`scripts/test-q02-sql.py`, `scripts/gen-db-types-isolated.sh`); hata ayıklama için açtığım `gina_c01dbg_a1abf_audit`
silindi. Mock yok (SQL testleri gerçek Postgres + gerçek RPC'ler); gerçek kullanıcı/aile verisi yok, sentetik kimlikler.

```
pgTAP 108 (--only 108)                              → 108 ok, 0 not ok
pgTAP 057 (--only 057, tetikleyici adı düzeltmesi)   → 43 ok, 0 failure
Tam pgTAP, varsayılan Europe/Istanbul               → 107 dosya, 4104 kontrol, 0 hata (exit 0)
Tam pgTAP, --timezone UTC                           → 107 dosya, 4104 kontrol, 0 hata (exit 0)
pnpm --filter @gina/core test                       → 53 dosya, 377 test geçti (11 yeni)
pnpm --filter @gina/core typecheck                  → 0 hata
apps/mobile tsc --noEmit                            → exit 0
apps/mobile expo lint (CI=1)                        → exit 0, çıktı yok
```

İlk tam koşuda 057'nin 15. kontrolü kırıldı (yeni tetikleyici katalog kopyasında `curriculum_copy_immutable` yerine
`blueprint_provenance_locked` döndürüyordu; ikisi de engelliyor ama hata sözleşmesi değişmişti). Tetikleyici
`provenance_guard` olarak yeniden adlandırıldı; 057 ve 108 yeniden geçti, tam koşular bu düzeltmeden sonradır.

108 kapsamı: iki aile + üçüncü haftalık aile; iki veli (aynı aile), başka aile velisi, cihaz, tam yönetici, iptal edilmiş
yönetici, anonim. Negatif: istemci `school_confirmed`/`officially_verified`/yanlış beyan/kişiselleştirme sınırları, REST ile
onay/JSON/katalog kökeni taklidi, sahip rolünde bile CHECK, servis dışı resmî işaret, başka aile/cihaz RPC, arşivli
etkinlik düzenle/sil/yeniden oluştur, başka ailenin haftalık verisi, düzeltmede başka aile/boş/çift seçim/cihaz/anonim.
Idempotency: blueprint kayıp yanıt tekrarı + çakışma, backfill ikinci koşu (0 değişiklik, denetim satırı tekrarlanmaz),
takvim arşiv öncesi istek tekrarı, düzeltme aynı istek (farklı sıra) / yeni istek / çakışma.

## UI karşılaştırması

Görsel değişiklik yok: `blueprint.tsx` yalnız kayıt yüküne iki alan ekler; metin, düzen ve etiketler aynı (P02 onaylı
akış). Bu nedenle izole web servisi + Playwright **çalıştırılmadı**; yük core birim testi ve pgTAP ile doğrulandı.
Kayıt ekranının gerçek sunucuya bu yükle uçtan uca kaydı ayrıca denenmedi.

## Yayın

**Yayımlanmadı.** Sıra notu: yeni istemci, migration uygulanmamış sunucuya `school_scenario`/`personalization`
gönderirse eski `save_family_blueprint` `blueprint_invalid` döner — **önce migration, sonra istemci**. Eski 26/27 istemciler
yeni sunucuyla çalışır (anahtarlar isteğe bağlı; `unstated` olarak kaydedilir). Canlı veride düzeltilecek blueprint sayısı
bilinmiyor (üretime bağlanılmadı); migration denetim tablosuna yazar.

## Kalan engel / sınır

1. Eski yanlış puan düzeltmesi için **veli/yönetim arayüzü yok**; RPC'ler ve core şemaları hazır. Onaylı akış için
   önizleme ekranı + açık "uygula" adımı gerekir (veli Prova sonuçları veya yönetim aile sayfası).
2. Köken etiketi (`blueprintProvenanceLabel`) ekranlarda henüz gösterilmiyor; `prova-source-picker.tsx` hâlâ
   `source_context.origin`'e bakıyor (doğru, ama "beyan" ile "çalışma" ayrımı görünmüyor). Gösterim için i18n anahtarı
   eklenmedi.
3. Resmî kaynak doğrulamasını işaretleyen bir yönetim akışı yok; yalnız `service_role` doğrudan yazabilir.
4. `event-editor.tsx` `event_archived` için özel mesaj göstermiyor (takvim ekranı C02 sahipliğinde).
5. Daha önce oluşturulmuş haftalık snapshot'larda yanlış eşlenmiş takma ad varsa düzeltilmedi (snapshot korunur).
6. Fiziksel cihaz, üretim DB'si, gerçek kullanıcı akışı test edilmedi.
