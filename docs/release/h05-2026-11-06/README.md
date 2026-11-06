# H05 — Satın alma ekranı AI onay açıklaması ve belge tutarlılığı (2026-11-06)

Kart: `docs/CLAUDE-REMAINING-WORK.md` §4 H05. Migration yok, Edge değişikliği yok, üretime dokunulmadı.

## Durum özeti

| Katman | Durum |
|---|---|
| Kod | Tamam: `apps/mobile/src/app/parent/subscription.tsx` içinde `AiUsageCard`'ın altına `subscription.aiConsentNote` (TR+EN yeni anahtar) eklendi. |
| Test | core vitest 64 dosya / 457 test geçti; core `tsc` 0; mobil `tsc --noEmit` 0; `expo lint` 0. izole servis `--ui-hold` koşusu 182/182 kontrol; Playwright (web export + izole Auth/REST) 4/4 ([ui/ui-checks.json](ui/ui-checks.json)). |
| Belge | Taslak güncellendi: Açık Rıza Metinleri A-3 fotoğraf saklama yer tutucusu kaldırıldı; Gizlilik Politikası §5 saklama paragrafı ve saklama tablosu netleştirildi; ikisinde de TR+EN değişiklik satırı. **Hukuk uzmanı onayı yok; yayımlanmadı.** |
| Yayın | Yapılmadı (bu kart yayın içermez; H08 sırasına bağlı). |
| Gerçek cihaz | Yapılmadı (web export ölçümü fiziksel cihazın yerine geçmez; C15). |

## 1. Arayüz metni

- Anahtar: `subscription.aiConsentNote`
  - TR: "Paket yalnız kullanım hakkı verir. Belge ya da fotoğraftan içe aktarma, haftalık özet gibi her yapay zekâ işlemi başlamadan önce her seferinde ayrıca onayını ister."
  - EN: "A plan only sets what you can use. Every AI action, such as importing from a document or photo or the weekly summary, asks for your separate confirmation each time before it starts."
- Olgu doğrulaması (metin uydurma değil): her AI işlem ekranında işaretsiz onay anahtarı var ve işlem onaysız başlamıyor — `components/planner/timetable-import.tsx:187,234,251`, `components/learning/prova-source-picker.tsx:260-279`, `app/parent/weekly-review.tsx:48,98,335-341`, `components/setup/ai-suggestions.tsx:127-133`.
- Görsel: mevcut `parentStyles.copy` (Nunito, mürekkep rengi) kullanıldı; yeni renk/bileşen yok.
- Playwright ölçümü (TR ve EN, 390×844 ve 768×1024): sayfada yatay taşma ≤1 px, metin görünür alan içinde, kırpılma yok, yazı 17 px, çevrilmemiş anahtar yok, sayfa hatası yok. Görüntüler: `ui/subscription-{tr-TR,en-US}-{phone,tablet}.png`.
- Çalıştırma: `GINA_QA_UI_FIXTURE=<scratchpad>/h05-ui-fixture.json python3 scripts/test-isolated-services.py --run-local --ui-hold` (arka planda) → `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:59405 EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-h05 pnpm exec expo export -p web` → `node ui/serve-export.cjs <export> 8505` → `GINA_QA_WEB=http://127.0.0.1:8505 GINA_QA_WEB_BACKEND=http://127.0.0.1:59405 GINA_QA_WEB_ANON=placeholder-anon-h05 GINA_QA_PLAYWRIGHT_PATH=… node ui/ui-check.cjs`; bitince holder sürecine `SIGUSR2`.

## 2. Yüklenen dosya yaşam döngüsü (güncel koddan)

| Davranış | Kanıt |
|---|---|
| Özel kova `gina-private-sources` (`public=false`, PNG/JPEG/PDF, 10 MB); `storage.objects` üzerinde hiçbir politika yok, tüm erişim Edge üzerinden; görüntüleme bağlantısı 120 sn | `supabase/migrations/20261102130000_learning_sources.sql:2-5,46`; `supabase/functions/learning-source/handler.ts:65-83` (migration klasöründe `storage.objects` politikası yok — grep boş) |
| Yüklemeden önce ayrı saklama onayı zorunlu (`storage_consent='private-storage-v1'`) | `20261102130000_learning_sources.sql:14,54,66` |
| **Bağlı dosya**: soru, ders programı, görev, ödül, hedef bağlantısı (`learning_source_links`), belgeden üretilmiş soru (`question_bank.provenance.document_source_id`), çok dosyalı set üyeliği, öğrenme planı maddesi varken silinmez | `supabase/migrations/20261105010000_learning_source_sets.sql:103-115` (son tanım) |
| Ders programı kaydedilince fotoğraf çocuğun ders programına bağlanır; bağlantı çocuk başına, yeni içe aktarma eskisini kaldırmaz | `20261102132000_timetable_import.sql:91`; `20261102130000_learning_sources.sql:21` (`school_timetables(child_id) on delete cascade`) |
| Bağlı kayıt silinince bağlantı düşer (cascade; öğrenme planında `set null`), dosya bağsız sayılır | `20261102130000_learning_sources.sql:19-24`; `20261103089000_learning_plan.sql:7` |
| **Bağsız dosya**: `created_at < now() - 24 saat` ve yukarıdaki bağların hiçbiri yok | `20261105010000_learning_source_sets.sql:103` |
| **İçe aktarmada kullanılmış bağsız dosya**: ayrıca son `timetable_imports` / `learning_plan_imports` işinin `created_at`'inden 7 gün geçmiş olmalı (iş başlangıcı esas; içe aktarma da 7 gün sonra `import_expired`) | `20261105010000_learning_source_sets.sql:106,108,113,115`; `20261102132000_timetable_import.sql:88` |
| Ebeveyn dosyayı silebilir (sınavda kullanılan soru görseli hariç); ders programı ekranında bağlı fotoğraflar listelenir ve silinebilir | `20261102130000_learning_sources.sql:104-110`; `learning-source/handler.ts:198-211`; `apps/mobile/src/components/planner/timetable-import.tsx:664-715`, `timetable-editor.tsx:506` |
| Kayıt silinince tetikleyici depolama nesnesini `source_deletion_queue`'ya alır; aile silinince `learning_sources` cascade ile aynı yol | `20261102130000_learning_sources.sql:7,29-37` |
| Doğrulamadan geçmeyen yükleme `invalid` olur ve nesne hemen kuyruğa alınır | `learning-source/handler.ts:157-163` |
| **Temizlik işi**: pg_cron `source-cleanup` her saat 43. dakikada Edge `source-cleanup`'ı `x-cron-secret` ile çağırır; Edge önce `expire_unlinked_learning_sources()` (100'lük parti), sonra kuyruktan 100 nesneyi siler; başarısızlar `last_attempt_at` ile yeniden denenir; mezar taşı 3 saat tutulur (2 saatlik imzalı yükleme jetonuna karşı) | `20261102130000_learning_sources.sql:123-142`; `supabase/functions/source-cleanup/index.ts:3-23`; `supabase/functions/_shared/source-cleanup.ts:2-24` |
| İşlem tamamlandı diye dosya **silinmez** (eski yer tutucudaki "işlem tamamlanınca silinir" seçeneği koda uymuyor) | yukarıdaki satırların toplamı; hiçbir AI/içe aktarma yolunda `delete_learning_source` çağrısı yok |

Üretim durumu bu kartta yeniden doğrulanmadı; son kayıt: `docs/learning/DEVELOPMENT-STATUS.md:116` (saatlik source-cleanup görevi ve Vault/Edge sırrı doğrulanmış). Gerekli sır adları: `SOURCE_CLEANUP_SECRET` (Edge) ve Vault `source_cleanup_secret`, `project_url`.

## 3. Belge değişiklikleri

- `docs/legal/acik-riza-metinleri.md` A-3 "Aktarılan veriler — fotoğraftan takvim" (TR ve EN karşılığı): `[ÜRÜN KARARI: işlem tamamlanınca silinir / [SÜRE] saklanır]` kaldırıldı; yerine yukarıdaki yaşam döngüsü ve `[AVUKAT: bu sürelerin ve bağlı fotoğrafın ders programı durdukça tutulmasının saklama ve imha politikasına uygunluğu]` notu. §8'e TR ve EN `0.2 (H05 saklama olgusu)` satırı.
- `docs/legal/gizlilik-politikasi.md` §5 "Saklama" paragrafı (TR+EN) ve saklama tablosu satırı (TR+EN): bağlı kayıt türleri, işlem bitince silinmeme, 24 saat + son içe aktarma işinden 7 gün, bağlı kaydın silinmesi, eski ders programı belgesinin kalması, saatlik temizlik/yeniden deneme, doğrulanamayan yükleme, aile silinmesi. Başlık yorumundaki 6. madde güncellendi. TR ve EN değişiklik geçmişine `0.2 (H05 saklama olgusu)` satırı.
- Rıza modeli, hukuki dayanaklar ve mevcut `[AVUKAT]` işaretleri değiştirilmedi. Sürelerin hukuki yeterliliği onaylanmadı.

## 4. Aynı değişikliği bekleyen özel kopyalar (açılmadı, düzenlenmedi)

`.codex-setup/legal-private-2026-11-06/` (gitignored; yalnız dosya adları listelendi):

- `acik-riza-metinleri.md` — A-3 fotoğraf saklama paragrafı (TR+EN) ve §8 değişiklik satırları.
- `gizlilik-politikasi.md` — §5 saklama paragrafı, saklama tablosu satırı, başlık yorumu 6. madde, TR+EN değişiklik geçmişi.

Bu kartta yalnız bu iki belge değişti; diğer özel kopyaların H05 nedeniyle değişmesi gerekmiyor. Not: `kvkk-aydinlatma-metni.md:157/384` yüklenen dosyaların saklama kuralına atıf yapıyor; o metnin aynı ayrıntıyı taşıyıp taşımayacağı hukuk incelemesine bırakıldı (bu kartta değiştirilmedi).

## 5. Sınırlar

- Uzman onayı bekleyen belgeler yayımlanmamış taslak olarak kalıyor.
- Web export ölçümü fiziksel telefon/tablet, VoiceOver/TalkBack veya dinamik yazı boyutu testinin yerine geçmez.
- Ekran görüntüsünde aile "ücretsiz erişim" fixture'ı ile görünür; mağaza satın alma düğmeleri web'de gösterilmez.
