# L03 — Kalıcı silmenin etki önizlemesi (sunucu)

6 Kasım 2026 gece paketi. Yalnız **sunucu + core + Edge**: migration `20261106040000_deletion_preview.sql`, `supabase/functions/delete-account/` (isteğe bağlı parametre), `packages/core/src/deletion-preview.ts`, testler. **UI bağlanmadı, hiçbir şey yayımlanmadı.** Mobil/backoffice ekranlarına dokunulmadı; üretim Supabase'e ve yerel demo DB'ye yazılmadı. Bütün SQL kontrolleri boş, tek kullanımlık bir veritabanında (`gina_completion_audit` şablonundan) çalıştı ve veritabanı sonunda silindi.

## Sözleşme

### `public.deletion_preview(p_target jsonb) → jsonb` (yalnız `authenticated`, veli)

Hedef: `{"kind":"child","child_id":"<uuid>"}` veya `{"kind":"account"}`. Önizleme hiçbir veri değiştirmez; `gina.deletion_previews` tablosuna **15 dakika** geçerli bir satır yazar ve özeti şu zarfla döner:

| Alan | Anlam |
|---|---|
| `preview_token`, `expires_at`, `generated_at`, `ttl_seconds` | Gerçek silmeye taşınan belirteç ve süresi. Yeniden doğrulama (parola/OTP) mevcut akışta ayrıca gerekir. |
| `deletes` | Silinecek kayıt türleri ve sayıları (görev rutini/kaydı, yıldız hareketi ve bakiye, rozet, ödül talebi/hedef, not (kendi/paylaşılan/çocuk yazdı), Prova (sınav/deneme/cevap/çalışma planı), takvim/ders programı/eğitim dönemi, puan, paylaşım bağlantısı (toplam/açık), cihaz (izinli/aktif oturum), AI kayıtları, dosya sayısı ve bayt). |
| `preserved` | Silinmeyecek geçmiş: diğer velinin kişisel notları, aile düzeyindeki notlar/dosyalar/sorular/ödüller, çocuğa başvuran Prova taslakları, diğer çocuklar, kullanım makbuzları. |
| `warnings` | `active_device_sessions` (arşivli değil ama açık cihaz oturumu), `open_shares_revoked`, `in_progress_attempts`, `pending_task_reviews`, `pending_reward_requests`, `co_parent_private_notes_kept`, `prova_drafts_keep_reference`; hesapta ayrıca `family_deleted`, `ownership_transferred`, `subscription_not_cancelled`, `billing_in_progress`. |
| `alternatives` | Çocukta `archive_available` (arşiv geri döndürülebilir seçenek olarak sunulur), hesapta `archivable_children`. |
| `subscription` | Her zaman `cancelled_by_deletion:false`, `managed_in_store:true`. Mağaza aboneliği silmeyle iptal edilmez, iade yapılmaz; `docs/IAP.md` ve `docs/legal/hesap-ve-veri-silme.md` ile uyumlu. |

Hesap hedefinde `families[]` kullanıcının bütün aileleri için **mod** verir: `transfer` (başka veli var → yalnız kişisel satırlar silinir, çocuklar ve aile içeriği kalan velide kalır, gerekirse sahiplik devredilir) veya `cascade` (son veli → aile, çocuklar, dosyalar, anonim cihaz hesapları, abonelik kayıtları silinir). `subscriptions[]` aktif/grace/on_hold abonelikleri `purchased_by_me` ile listeler. Bu mantık mevcut `gina.prepare_account_deletion()` davranışını yansıtır; silme fonksiyonu yeniden yazılmadı.

**Parmak izi:** Özetin kararı etkileyen bölümü (`kind`, hedef kimliği/adı/arşiv durumu, sayımlar; hesapta aile üyelikleri, çocuk listesi, abonelik durumu) SHA-256 ile saklanır. Uyarılar ve saat bağımlı alanlar (`shares_active`, `expires_at`) parmak izine girmez. Oran sınırı: aktör başına saatte 30 önizleme (`deletion_preview_rate_limited`).

### Reddedilen durumlar

| Durum | Sonuç |
|---|---|
| Başka ailenin çocuğu, geçersiz hedef, cihaz/anon rolü | `forbidden` (42501) / `deletion_target_invalid` |
| Önizlemeden sonra hedef değişti (ad, arşiv, sayımlar, yeni çocuk, abonelik durumu) | `deletion_preview_stale` — hiçbir şey silinmez |
| 15 dakika geçti | `deletion_preview_expired` |
| Belirteç başka veliye/çocuğa ait, bulunamadı, çocuk zaten silinmiş | `deletion_preview_not_found` |
| Aynı belirteç ikinci farklı istekle | `deletion_preview_used` / `not_found` (satır çocukla birlikte kalkar) |
| Diğer velinin kişisel (`private`) notu | **silinmez**; çocuk silinirken aile düzeyine ayrılır (`child_id=null`), yazarında kalır, geçmişine `save` revizyonu düşer |

### `public.confirm_child_deletion(p_request_id, p_child_id, p_preview_token) → jsonb` (veli)

Belirteci kilitler (`for update`), sahip/çocuk/aile/süre/kullanım kontrolü yapar, çocuğu `for update` kilitleyip parmak izini yeniden hesaplar; eşleşirse mevcut `delete from public.children` yolunu çalıştırır (bütün cascade/trigger'lar aynı). Aynı `p_request_id` tekrarında `gina.help_receipt` ile aynı sonucu döner; iki kez silme olmaz. Mobildeki mevcut doğrudan RLS silmesi çalışmaya devam eder (UI bağlantısı sabah); diğer velinin kişisel notunu koruyan trigger o yolda da devrededir.

### `public.check_deletion_preview(p_token, p_user_id) → {status}` (yalnız `service_role`)

`delete-account` Edge fonksiyonu gövdede isteğe bağlı `preview_token` alır: yeniden doğrulama başarılıysa bu RPC çağrılır; `status` `ok` değilse **409 `deletion_preview_<status>`** döner ve `auth.admin.deleteUser` çağrılmaz. RPC hatasında 500 ve silme yok. Belirteç burada tüketilmez: silme başarısız olursa aynı belirteçle güvenli tekrar mümkündür; başarı durumunda satır kullanıcıyla birlikte cascade silinir. `preview_token` gönderilmeyen eski istemciler için akış değişmedi.

### Güvenli tekrar / bekleme / başarısızlık

- Önizleme → (yeniden doğrulama) → onay. Onay hatası veya ağ kesintisi: aynı `p_request_id` ile tekrar güvenli; `stale`/`expired` dönerse yeni önizleme alınır ve kullanıcıya fark gösterilir.
- Silme tek transaction'dadır; yarıda kalan silme yoktur. Depolama dosyaları aile silinirken mevcut `source_deletion_queue` ile asenkron temizlenir (`files.storage_cleanup:"queued"`).
- Hiçbir içerik türüne yeni "sil" düğmesi eklenmedi; yalnız mevcut hesap/çocuk kapsamları önizlenir.

## Örnek önizleme (yapay aile, boş DB)

Tamamı: [preview-examples.json](preview-examples.json). Çocuk örneği (kısaltıldı):

```json
{
  "kind": "child",
  "child": {"id": "2000…9901", "name": "Ece", "grade": 5, "archived": false, "archive_revision": 0},
  "deletes": {
    "task_routines": 1, "task_completions": 1, "pending_task_reviews": 1,
    "stars": {"events": 1, "balance": 10}, "badges": 0,
    "notes": {"own": 1, "shared": 0, "child_authored": 0},
    "prova": {"exams": 1, "attempts": 1, "in_progress": 1, "answers": 0, "study_plans": 0},
    "shares": {"total": 1, "open": 1}, "devices": {"allowed": 1, "active_sessions": 1},
    "files": {"count": 0, "bytes": 0, "linked_family_files": 0}
  },
  "preserved": {"co_parent_private_notes": 1, "family_notes": 0, "family_files": {"count": 0, "bytes": 0}, "other_children": 1, "usage_receipts": true},
  "warnings": ["active_device_sessions", "open_shares_revoked", "in_progress_attempts", "pending_task_reviews", "co_parent_private_notes_kept"],
  "alternatives": {"archive_available": true, "already_archived": false},
  "subscription": {"affected": false, "cancelled_by_deletion": false, "managed_in_store": true},
  "preview_token": "20829ff8-…", "expires_at": "2026-11-05T21:11:10Z", "ttl_seconds": 900
}
```

Hesap örneğinde aile `transfer` modundadır: `deletes: {own_notes:1, own_shares:1, membership:1}`, `preserved: {children:2, ownership_transferred:true}`, `subscriptions[0]: {platform:"apple", plan:"plus", purchased_by_me:true, cancelled_by_deletion:false}`, `warnings: ["ownership_transferred","subscription_not_cancelled"]`.

## Core (`@gina/core`)

`deletion-preview.ts`: zod sözleşmesi (`deletionPreviewSchema`, `deletionTargetSchema`, uyarı enum'u; `cancelled_by_deletion:true` iddiası reddedilir), `previewSecondsLeft` / `isPreviewUsable` (30 sn emniyet payı), `orderedDeletionWarnings`, `childDeletionCountLines` (yalnız dolu gruplar; `deletionPreview.count.*` anahtarları), `sumChildDeletionCounts`, `formatApproximateBytes` (TR/EN), `deletionErrorKey`. i18n: `tr.json`/`en.json` içine yalnız yeni `deletionPreview.*` bloğu eklendi (23 üst anahtar; sayım, korunan, uyarı, abonelik, hata metinleri).

## Test çıktıları (gerçekten çalıştı)

- **pgTAP:** `scripts/test-deletion-preview-races.py --run-local` → boş tek kullanımlık DB'de bütün migration'lar + **87 SQL dosyası / 2.597 kontrol** geçti; yeni `090_deletion_preview.test.sql` **87 kontrol**: yanlış aile/çocuk, geçersiz hedef, cihaz rolü, sayımların doğruluğu, uyarılar, arşiv alternatifi, abonelik iptal edilmez, belirteç bağları (çocuk/veli), eski önizleme (`stale`), süre (`expired`), tekrar makbuzu, kullanılmış belirteç, diğer velinin kişisel notu (yeni RPC ve eski doğrudan yol, arşivli çocuk dahil), hesap önizlemesi (transfer/cascade, dosya sayısı/boyutu, anonim cihaz hesapları, grace abonelik → `billing_in_progress`), servis kontrolü (ok/not_found/stale/expired, istemciye kapalı), yetkiler, son veli cascade'inin trigger'la çalışması, oran sınırı. [sql-checks.json](sql-checks.json)
- **Yarış/idempotency (8 kontrol geçti):** aynı istek iki eşzamanlı onay → tek silme, aynı sonuç; sonradan tekrar → makbuz; farklı istek aynı belirteç → tek kullanım; onay ↔ ad değişikliği yarışı tutarlı (bu koşuda `rename_won_confirm_stale`); silme sırasında önizleme temiz sonuç; servis kontrolü eşzamanlı idempotent; hedef değişimini yakalar; bütün kişisel notlar korunur. [race-checks.json](race-checks.json)
- **Deno (`delete-account`):** 18 test geçti — belirteçsiz akış değişmedi; taze belirteç doğrulanıp silme; `stale/expired/used/not_found` → 409 ve silme yok; bozuk belirteç 400; RPC hatası 500; kontrol yeniden doğrulamadan sonra. [edge-checks.txt](edge-checks.txt). `deno check` handler başarılı.
- **Core:** `pnpm --filter @gina/core test` → 41 dosya / 268 test geçti (yeni 11); `tsc --noEmit` temiz. [core-checks.txt](core-checks.txt)

Yapılmayan: mobil/backoffice derleme-lint (dokunulmadı), gerçek Edge/Auth servis testi (`test-isolated-services.py`), gerçek cihaz, üretim veya demo aile üzerinde deneme.

## Kalan sınır

- **UI bağlanmadı:** `apps/mobile/src/app/parent/menu.tsx` çocuk silmede hâlâ doğrudan `from("children").delete()` kullanır; hesap silme ekranı `preview_token` göndermez. Sabah işi: önizleme ekranı (deletionPreview.* metinleri), `confirm_child_deletion` + `delete-account{preview_token}` çağrıları, güçlü onay ve yeniden doğrulama.
- Mevcut trigger fonksiyonları `gina.note_revision` ve `gina.guard_archived_child_write` yalnız **iç içe trigger'dan gelen, sadece `child_id→null` yapan `private` not güncellemesi** için dar bir istisna aldı; istemci yetkisi (`update(title,body,subject,visibility)`) değişmedi. Ayrılan not geçmişine `save` revizyonu düşer; ayrı bir `detach` eylem adı yok.
- `store_subscriptions` satırları aile cascade'inde DB'den silinir (mevcut FK); hukuki 10 yıllık satın alma kaydı mağaza/muhasebe tarafında varsayılır, önizleme `store_billing_records:true` ile bunu söyler ama DB'de saklama uygulanmadı.
- Hesap önizlemesinde `transfer` modundaki çocuklar için sayım verilmez (`counts:null`), çünkü silinmezler. Çocuk düzeyinde dosya yoktur; dosyalar aile düzeyindedir ve korunur.
- Edge tarafı belirteci tüketmez; tüketim yalnız kullanıcı silinince cascade ile olur. Önizleme oranı saatte 30; UI yenilemeyi buna göre sınırlamalı.
- Üretim migration'ı uygulanmadı; `docs/CLAUDE-REMAINING-WORK.md` L03 kutusu kapatılmadı (UI ve kabul ekranları açık).

## UI bağlama (6 Kasım gece, mobil)

Dal: `worktree-agent-a379749b164a620aa` (main'e push edilmedi). Migration eklenmedi; üretime ve yerel demo DB'ye dokunulmadı.

**Değişen dosyalar:** `apps/mobile/src/app/parent/menu.tsx`, `apps/mobile/src/components/account-deletion.tsx`, yeni `apps/mobile/src/components/deletion-preview-sheet.tsx`, `packages/core/src/i18n/{tr,en}.json` (yalnız `deletionPreview.*` altına yeni anahtar; mevcut değer değişmedi), yeni test `scripts/test-deletion-preview-ui.cjs`.

**Davranış**

- **Q00-A1-10 kapandı:** çocuk ayarları (PIN) kartındaki doğrudan `from("children").delete()` + `ConfirmAction` kaldırıldı. Kalıcı silme, menü › Ailem sekmesinin sonunda ayrı **"Tehlikeli işlemler"** kartında, çocuk başına "… profilini kalıcı sil" düğmesiyle açılır. Hesap silme de Hesap sekmesinde aynı kartın içindedir.
- **Önizleme sheet'i (`DeletionPreviewSheet`, mevcut `DecisionSheet` üstünde):** `deletion_preview` sonucu zod ile doğrulanır; silinecek sayılar (`childDeletionCountLines`), korunacaklar, sıralı uyarılar, abonelik notu (silme iptal etmez, mağazadan yönetilir → "Aboneliği mağazada yönet" `/parent/subscription`), kalan süre (dakika). Önizleme `useQuery` değil mutation ile alınır; böylece global `invalidateQueries`/realtime sessizce yeni belirteç üretmez (saatte 30 sınırı).
- **Önce arşiv:** `archive_available` ise yeşil kartta ayrı "Bunun yerine arşivle" eylemi; sheet kapanır ve mevcut önizlemeli arşiv ekranı `/parent/profile-archive?childId=…` açılır. Arşiv yolu hiçbir şey silmez.
- **Güçlü onay:** çocuk adını aynen yazma (Türkçe yerel ayarla büyük/küçük harf duyarsız); eşleşmeden, önizleme süresi 30 sn emniyet payıyla geçerli değilken veya istek sürerken "Kalıcı olarak sil" pasif. Hesapta mevcut yeniden doğrulama (şifre veya e-posta OTP) + "geri alınamaz" anahtarı sheet içinde.
- **İdempotent istek:** istek kimliği önizleme belirtecine bağlı (`randomUUID`, aynı belirteç → aynı kimlik); senkron `sending` kilidi çift dokunmayı tek isteğe indirir; kayıp yanıtta tekrar aynı kimlikle gider ve sunucu makbuzu döner.
- **Eski önizleme:** `deletion_preview_stale/expired/used/not_found` → hata metni + önizleme otomatik yenilenir ("Önizleme güncellendi…"); değişen ad yazılı onayı geçersiz kılar. Süre dolunca "Önizlemeyi yenile".
- **Hesap:** `delete-account` gövdesine `preview_token` eklenir; Edge hata gövdesindeki kod okunur (409 → önizleme yenilenir; `reauthentication_failed` → mevcut `accountV5.deleteFailed`). Aile kurulmadan önce (`(auth)/family.tsx`, `family_id` yok) önizleme RPC'si `forbidden` döneceği için eski belirteçsiz akış aynen kalır.

**Test (gerçekten çalıştı)**

- `pnpm --filter @gina/mobile exec tsc --noEmit` → çıkış 0; `pnpm --filter @gina/mobile exec expo lint` → çıkış 0, uyarı yok; `pnpm --filter @gina/core test` → 50 dosya / 356 test geçti (i18n eşliği dahil).
- `expo export -p web` → başarılı (yer tutucu kaynak `http://127.0.0.1:65431`; Playwright istekleri fixture'ın loopback proxy'sine iletir, yer tutucu anon anahtarını fixture anahtarıyla değiştirir).
- İzole servis: `GINA_QA_UI_FIXTURE=<scratchpad>/l03/fixture.json scripts/test-isolated-services.py --run-local --ui-hold` → **137/137 servis kontrolü**; UI bitince `SIGUSR2` ile bırakıldı; geçici DB ve iki container kaldırıldı ([ui/service-checks.json](ui/service-checks.json)). Başka ajanların `gina_http_*` container'larına dokunulmadı.
- Playwright (Chrome, `tr-TR`, 390×844 ve 1280×800), `scripts/test-deletion-preview-ui.cjs` → **8/8** ([ui/ui-checks.json](ui/ui-checks.json)):
  1. PIN kartında kalıcı silme yok, "Tehlikeli işlemler" ayrı;
  2. önizleme → "Bunun yerine arşivle" → arşiv ekranı, çocuk duruyor, `confirm_child_deletion` çağrısı 0;
  3. önizleme → ad yazma (yanlış ad pasif, küçük harf kabul) → **çift tıklama** → tek `confirm_child_deletion` isteği, çocuk silindi; aynı gövde REST ile tekrar → makbuz (`deleted:true`), ikinci silme yok;
  4. **eski önizleme:** önizlemeden sonra ad REST ile değişti → `deletion_preview_stale` metni, önizleme yeniden alındı, yeni ad gösterildi, eski yazılı ad onayı pasif, çocuk silinmedi;
  5. **kayıp yanıt:** sunucu silmeyi uyguladı ama istemciye 503 döndü → genel hata; tekrar → aynı `p_request_id`/belirteç, başarı, tek silme;
  6. vazgeç → çocuk duruyor (masaüstü);
  7. hesap: önizleme (aile `cascade`, sayımlar, abonelik notu), yeniden doğrulamasız onay pasif; şifre + anahtar → `delete-account` gövdesinde `preview_token` ve `confirm:true` doğrulandı; **Edge yanıtı taklit (409 `deletion_preview_stale`)** → hata metni ve önizleme yenilendi; hesap silinmedi;
  8. yatay taşma ve çalışma zamanı hatası yok.
- Görüntüler: [ui/](ui/) — `menu-danger-zone-phone`, `preview-archive-offer-phone`, `archive-path-phone`, `preview-delete-ready-phone`, `delete-done-phone`, `stale-refreshed-phone`, `lost-response-phone`, `preview-child-desktop`, `preview-account-desktop`, `preview-account-phone`, `account-stale-phone`.

**Kalan sınır**

- `delete-account` Edge fonksiyonu bu koşuda çalıştırılmadı (izole koşucu `--with-storage` olmadan Edge başlatmaz); UI'nin gönderdiği gövde gerçek, 409 yanıtı taklit. Gerçek hesap silme uçtan uca (şifre/OTP + belirteç + `auth.admin.deleteUser`) ve `expired` durumunun 15 dk beklemeli gerçek kontrolü yapılmadı (UI aynı yenileme yolunu kullanır; sunucu tarafı pgTAP ile test edildi).
- Gerçek cihaz (iOS/Android native Modal, klavye, büyük yazı) denenmedi; yalnız web exportu.
- Arşivli çocuklar menü listesinde olmadığı için "Tehlikeli işlemler"de görünmez (eski davranışla aynı); arşivden kalıcı silme girişi eklenmedi.
- `packages/core/src/database.types.ts` yeni RPC'leri içermiyor; çağrılar tek yerde türsüz `rpc` ile yapılıyor. Türler yeniden üretilince kaldırılmalı.
- `docs/CLAUDE-REMAINING-WORK.md` L03 kutusu kapatılmadı (sahiplik dışı; gerçek Edge ve cihaz kabulü açık).
