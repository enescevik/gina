# C09 — AI içerik ön incelemesini işletilebilir yap (E01/B02) — 6 Kasım 2026

| Alan | Durum |
|---|---|
| Eski görev bağı | E01 (AI ön inceleme + yönetici kuyruğu), B02 (yönetim ekranı); C05 aday/kaynak, C07 rol matrisi, C08 yönlendirme ile birleşik |
| Kod | **KOD HAZIR** |
| Test | **TEST EDİLDİ — izole, deterministik sağlayıcı**. Gerçek model pilotu **BEKLİYOR: GINA anahtarıyla izole/hosted pilot** |
| Yayın | **Yayımlanmadı.** Migration üretime uygulanmadı, Edge dağıtılmadı, sır yazılmadı, main'e push yok, `db reset` yok |
| Enable kararı | **`content_prereview.enabled` kapalı kalır.** Gerekçe: gerçek model pilotu yapılmadı; 0,85 eşiği kalibre değil; Edge/sır/Vault üretimde yok. Açma koşulu: DEPLOY.md adım 6 (yanlış onay = 0) + ayrı karar |
| Dal | `worktree-agent-a62c8ee846cc13da9` (taban main `8359f5f`, C08 dahil) |

DECISIONS ilkesi korunur: **AI ön onayı ≠ yayın ≠ bağımsız eğitimci (X06) onayı.** AI kaydı yalnız `gina.content_prereviews`'te; yönetici kararı kendi sütunlarında; `ai_approved` hiçbir yayın/hak/inceleme sütununa dokunmaz.

## Yapılanlar

1. **C08 yönlendirmesi.** `content-prereview/index.ts` artık `apiKeyOrResponse(config)` (anahtar adı çözülen adapter'dan, başka sağlayıcıya düşmez) ve `generateWith` (çözülen adapter, tek ücretli çağrı) kullanır; `callClaude` doğrudan çağrılmaz. Hata sınıflandırması C08 `classifyAiError`: 401/403/400, girdi büyük, refusal, yapılandırılmamış/desteklenmeyen → tek çağrıdan sonra `needs_admin` (`provider_*`); 429/5xx/zaman aşımı/bozuk çıktı → en çok 3 deneme, sonra `retry_limit`.
2. **Sağlayıcı-farkında devre kesici.** Yeni servis RPC `content_prereview_provider(p_provider, p_ok, p_error, p_uncertain)` C08'in `gina.ai_provider_outcome/ai_provider_paused` kaydını kullanır. Çağrıdan önce duraklama kontrolü; duraklatılmışsa çağrı yok, deneme hakkı iade (`finish('pending','ai_temporarily_unavailable')` → `attempts-1`), drain o turu durdurur. Başarı/başarısızlık sağlayıcı başına yazılır. Sözleşme ihlali (şema dışı çıktı) sağlayıcı arızası sayılmaz.
3. **Görsel bayrağı.** Model görseli hiç görmez. Veritabanı görsel sayısını sayar (`gina.content_prereview_media`: katkıda `snapshot.images`, pakette `asset_hash`'li kaynaklar) ve her verdict'e `media{count, reviewed:false, image_dependent_correctness: not_applicable|not_proven}` ekler; audit kaydında da var. Edge `decide()` görselli kaydı `ai_approved` yapmaz (`media_not_reviewed`); C09 sözleşmeli verdict'le gelen görselli `ai_approved` DB'de `prereview_media_unreviewed` ile reddedilir. Prompt `prereview-v2`: modele görsellerin gösterilmediği ve görsele bağlı doğrulukta `solution_correct=unsure` yazması söylenir (sürüm yükseldiği için mevcut kayıtlar yeniden incelenir; üretimde kayıt yok).
4. **C05 bağı (eski kaynak).** `gina.prereview_candidate_source`: adayın kaynak sürümü (onaylı önce), hedef durumu, güncellik (7 gün), eskime nedeni. `superseded/withdrawn` sürüm veya emekli hedef → claim modele içerik vermez, `needs_admin` + `source_*`, bildirim ve audit; ücret yok.
5. **Aile dışı yönetici / içerik operatörü bildirimi.** `gina.operator_prereview_notices` (kayıt+içerik+prompt sürümü başına kişi başı bir satır): tam yönetici + süresi dolmamış içerik operatörü; aile üyeliği aranmaz. `operator_prereview_notices()` / `mark_operator_prereview_notices_read()` C07 `assert_operation_role(['content'])` ile canlı yetki. Push (aile üyesi yönetici) aynen sürer.
6. **Yeniden kuyruk kuralı.** `gina.content_prereview_queue`: AI kapalı/model pasif/anahtar yok/sağlayıcı yapılandırılmamış/duraklatıldı/eski kaynak nedenli `needs_admin` kayıtlar yöneticinin açık isteğiyle yeniden kuyruğa girer. Model kararları (`low_confidence`, `media_not_reviewed` …) ve `retry_limit` **girmez** (sonsuz ücret yok).
7. **Aday rozetleri.** `admin_prereview_candidate_context(ids)` (içerik + yayın rolü) → birleşik içerik listesinde aday satırında kaynak rozeti: onaylı / incelemede / fark incelemesi / eski sürüm / geri çekildi / manifest, yıl/dönem, emekli hedef, 7 günden eski kontrol, "AI'ya gönderilmez".
8. **Backoffice (yalnız `content-prereview.tsx`, `library-content-items.tsx`).** "Karar bekleyen AI ön incelemeleri" kutusu (bekleyen sayısı + nedenler, okunmamış bildirim rozeti, tek/tümünü okundu, "Listede yalnız BEKLİYOR kayıtları göster"), görsel bayrağı rozette, sağlayıcı adı, yeni neden etiketleri, istek sonucu nedenle. C07 rol davranışı (yayın ekibi salt okuma, aday kararı yönetici ekranında) değişmedi.
9. **Pilot altyapısı.** Edge pilot modu (`{"pilot":true,"confirm_paid":true,"items":[…]}`, yalnız sistem sırrı, ≤ 12 öğe, öğe başına tek çağrı, tekrar yok, içerik kaydına yazmaz, `ai.enabled`/model/anahtar/devre kesici geçerli). `scripts/prereview-pilot-set.json` (3 doğru / 3 yanlış / 3 belirsiz + beklenen karar) ve tek komutluk `scripts/prereview-pilot.ts` (`--deterministic` öz-sınama veya `--url … --confirm-paid` gerçek).
10. **Zamanlanmış drain.** `content-prereview-drain` pg_cron işi (10 dk), `gina.kick_content_prereview()` kapı kapalı / bekleyen yok / Vault sırrı yoksa istek atmaz. Adım adım yayın: [DEPLOY.md](DEPLOY.md).

C07'nin yeniden kapıladığı `admin_content_prereviews / request_content_prereview / enqueue_content_prereview` **tanımlanmadı**; değişen gövdeler yalnız servis/iç fonksiyonlar (`content_prereview_claim/finish`, `gina.content_prereview_queue/notify`). pgTAP 118 son kontrolü üç fonksiyonda `assert_operation_role` varlığını doğrular; pgTAP 113 191/191.

## Testler (gerçekten çalıştırıldı)

```
pgTAP 118_prereview_ops (izole DB)                                    → 83/83
pgTAP 113_operator_access                                             → 191/191
pgTAP 091_content_prereview (E01, değişmeden)                         → 84/84
python3 scripts/test-q02-sql.py --run-local (Europe/Istanbul)         → 115 dosya, 4868 kontrol, 0 hata  [pgtap-istanbul/sql-checks.json]
python3 scripts/test-q02-sql.py --run-local --timezone UTC            → 115 dosya, 4868 kontrol, 0 hata  [pgtap-utc/sql-checks.json]
deno test _shared/prereview.test.ts content-prereview/handler.test.ts → 23 passed, 0 failed (10 yeni C09 testi)
CI deno check (ci.yml satır 51)                                       → 0 hata
CI deno test batch (ci.yml satır 52)                                  → 261 passed, 0 failed
deno run scripts/prereview-pilot.ts --deterministic                   → 9/9, false_approvals 0  [pilot/deterministic-result.json]
pnpm --filter @gina/core test                                         → 57 dosya, 404 test geçti
pnpm --filter @gina/backoffice typecheck / lint / build               → 0 / 0 / 0
İzole servis + Playwright 1280×800 (harness/)                         → 9/9  [ui/ui-checks.json, ui/01–07]
```

**pgTAP 118 kapsamı:** C07 matrisi (içerik operatörü kuyruğu okur/kuyruğa alır; finans, yayın, süresi dolmuş operatör reddi); görsel sayısı claim'de, bayt/hash modele gitmez, görselli C09 onayı reddi, `not_proven`/`not_applicable` bayrağı; AI onayı yönetici kararı üretmez, sistem aktörlü ayrı audit (sağlayıcı + medya); eski sürüm/emekli hedef → içerik verilmez, `needs_admin`, deneme harcanmaz, ikinci claim cached; onaylı ve manifest aday normal; bildirim: aile dışı yönetici + aile üyesi yönetici + içerik operatörü alır, süresi dolmuş/finans/yayın/veli almaz, push yalnız aile üyesine; okunmamış sayısı, okundu idempotent, okuma durumu kişi başı, finans/veli/anon/iptal edilmiş operatör reddi; aday bağlamı (onaylı, eski, emekli, manifest, 7 gün); yeniden kuyruk (ai_disabled evet; low_confidence, media_not_reviewed, retry_limit hayır); duraklatılmış sağlayıcı iadesi, 3 deneme sınırı, sonrasında cached; devre kesici sağlayıcı başına (3 belirsiz → yalnız o duraklar, başarı kapatır), istemci erişemez; drain tetikleyici istemciye kapalı, kapı kapalı/Vault yokken hata vermez.

**Deno (deterministik sağlayıcı):** doğru → `ai_approved`, yanlış → `ai_rejected_suggestion`, belirsiz → `needs_admin` (her biri tek çağrı, verdict'te sağlayıcı + `advisory`); anahtar çözülen config'den (OpenAI adapter'ı), devre kesici çağrı öncesi kontrol + başarı kaydı; görsel bayrağı ve prompt notu; duraklatılmış sağlayıcıda 5 istek → 0 çağrı, 0 deneme, drain durur, kapanınca devam; 401/400/girdi büyük/yapılandırılmamış → tek çağrı + `needs_admin`, tekrar cached; 5xx belirsiz olarak devre kesiciye; 6 istek → en çok 3 ücretli çağrı; eski kaynak → 0 çağrı; kapı kapalı drain → 0 çağrı; pilot: yalnız sistem, `confirm_paid` şart, 12 sınırı, kayıt yazmaz, AI kapalıyken durur. E01'in 8 testi yeni davranışla geçti (yalnız prompt sürümü testi `v2`→`v3` değişti, çünkü varsayılan artık v2).

**İzole servis + Playwright** (`harness/run.py`, `build.py`, `edge.ts`, `serve.mjs`, `seed.sql`, `tour.cjs`): boş `gina_completion_audit` şablonundan tek kullanımlık `gina_c09_<hex>_audit`, kendi GoTrue + PostgREST konteynerleri, **değiştirilmemiş `content-prereview/index.ts`** (gerçek kullanıcı doğrulaması, `request_content_prereview`, `resolveAi`, `apiKeyOrResponse(config)`, `generateWith`, servis RPC'leri) loopback'te `deno run` ile; yalnız `api.anthropic.com` sınırı yerelde deterministik yanıtlanır (hosted model yok, ücret yok). Sistem Chrome headless.
- `scheduled_drain_through_real_edge`: cron sırrıyla drain 3 kayıt: yanlış anahtar → `ai_rejected_suggestion` (katkı `pending` kalır), görselli → `needs_admin/media_not_reviewed` + `not_proven`, eski kaynak adayı → `needs_admin/source_superseded`; sağlayıcıya **2** çağrı (aday hiç gitmedi); yanlış sır 403.
- `content_operator_without_family_sees_queue_and_notices`: aile üyeliği 0 olan içerik operatörü kutuda "3 kayıt yönetici kararı bekliyor" + "3 yeni bildirim"; outbox'ta push 0 (aile üyesi yönetici yok) — bildirim uygulama içinde.
- `media_flag_and_candidate_source_badges`: görselli satırda "1 görsel AI'ya gösterilmedi"; eski aday "eski kaynak sürümü … AI'ya gönderilmez", güncel aday "onaylı kaynak sürümü".
- `ui_request_correct_record_ai_approval_logged_apart_from_admin_decision`: UI'dan istek → gerçek Edge → `ai_approved`, 1 çağrı; audit `content_prereview.ai_approved` aktör `null`; katkı `pending`, `reviewed_by` boş; yönetici kararı hücresinde "AI" yok. Aynı istek tekrar → "önceki AI sonucu geçerli", yeni çağrı yok.
- `ui_request_ambiguous_record_lands_in_admin_queue_with_notice`: belirsiz → `needs_admin/low_confidence`, bildirim 4'e çıktı, BEKLİYOR süzgecinde görünür, AI onaylı kayıt görünmez.
- `non_family_admin_gets_notices_and_marks_read`: aile dışı tam yönetici 4 bildirim görür, tümünü okundu işaretler; operatörün okunmamışları 4 kalır.
- `admin_decision_separate_from_ai_record`: yönetici AI'nın uygun bulduğu katkıyı reddeder → katkı `rejected`, `reviewed_by`=yönetici; AI kaydı `ai_approved` olarak değişmeden kalır.
- `finance_role_cannot_see_prereview_queue`: finans tokenıyla üç RPC reddedildi. `no_page_errors`; her görüntüde yatay taşma yok.
- Deneme geçmişi: 1. tur Playwright'ın kendi Chromium'u indirilmemişti (araç) → sistem Chrome kanalı; 2. tur 9/9. Ürün kodu değişmedi.
- Temizlik: `{"…_rest": true, "…_auth": true, "db_dropped": true}`; sonradan `docker ps -a | grep gina_c09` = 0, `pg_database like 'gina_c09%' or 'gina_q02sql%'` = 0; edge/proxy süreçleri kapandı. Fixture, parolalar, anon JWT ve cron sırrı yalnız scratchpad'deydi.

## Gerçek model pilotu — BEKLİYOR

GINA'nın Anthropic anahtarı Supabase secrets'ta, yerelde okunamıyor; oturum ortamındaki `ANTHROPIC_API_KEY` GINA'ya ait olmadığı için **kullanılmadı**. Hazır olan: pilot seti, Edge pilot modu ve tek komut (DEPLOY.md adım 6). `pilot/deterministic-result.json` yalnız tesisatı kanıtlar (şema, eşik, görsel bayrağı, beklenen karar karşılaştırması); model kalitesi veya eşik kalibrasyonu **değildir**. 0,85 kalibre edilmiş sayılmaz.

## Değişen dosyalar

- `supabase/migrations/20261106320000_prereview_ops.sql` (yeni), `supabase/tests/118_prereview_ops.test.sql` (yeni)
- `supabase/functions/content-prereview/{handler,index,handler.test}.ts`, `supabase/functions/_shared/{prereview,prereview.test}.ts`
- `packages/core/src/content-prereview.ts` (yalnız `PREREVIEW_PROMPT_VERSION` aynası `prereview-v2`, tek satır)
- `apps/backoffice/src/components/{content-prereview,library-content-items}.tsx`
- `scripts/prereview-pilot.ts`, `scripts/prereview-pilot-set.json` (yeni)
- Bu klasör: README, DEPLOY.md, `harness/`, `ui/`, `pilot/`, `pgtap-istanbul/`, `pgtap-utc/`

## Kalan sınır

1. **Gerçek model pilotu BEKLİYOR** (GINA anahtarıyla izole/hosted, C14 sonrası). Enable kararı ona bağlı; kapı kapalı.
2. Hosted Edge/migration/Vault/pg_cron hiç kurulmadı; DEPLOY.md adımları üretimde doğrulanmadı. `content-prereview` `supabase/config.toml`'da yok; `--no-verify-jwt` ile dağıtılmalı (README satırıyla aynı).
3. Görseller hiç incelenmez → görselli her kayıt yönetici kararına düşer. Görme destekli inceleme (bayt gönderimi + vision modeli + `prereview-v3`) bu kartta yapılmadı.
4. `content_prereview_next` `attempts<3` kuralı E01'deki gibi; Edge 3. denemede çökerse kayıt `pending` kalır ve ancak yönetici isteğiyle (`claim` → `retry_limit`) kuyruktan çıkar (ücret yok).
5. Bildirim yalnız uygulama içi + (aile üyesi yöneticiye) push; e-posta kanalı yok (C10).
6. `admin_content_prereviews` en çok 500 kayıt döner; bekleyen sayısı bu sınırla sayılır.
7. Backoffice `database.types.ts` yeniden üretilmedi; yeni RPC'ler `review-rpc.ts` üzerinden tipsiz çağrılır. Fiziksel cihaz/ekran okuyucu kabulü yok (C15); onaylı tasarım referansıyla piksel karşılaştırması yapılmadı.
