# S03 — Mağaza doğrulama sunucu sertleştirmesi (6 Kasım 2026 gece çalışması)

**Durum:** sunucu tarafı tamamlandı ve izole ortamda test edildi. **Gerçek Apple sandbox / Google Play license-tester / gerçek makbuz / sandbox satın alma testi yapılmadı — X02/X03 BEKLİYOR** (Enes mağaza hesap adımlarını canlıya alırken). Üretim Supabase'e dokunulmadı, dağıtım yapılmadı, `db reset` yok. Backoffice `billing.tsx` ve mobil `subscription.tsx` değiştirilmedi.

Kaynak: main `35c1978` üzerine, dal `worktree-agent-a589cb6380cb867eb`. Commit'ler:

| Commit | İçerik |
| --- | --- |
| `94c3098` | Migration `20261106070000_store_verification_hardening.sql` + pgTAP `094` (87 kontrol) |
| `fa7af66` | Edge: `iap-verify` handler (ack sırası, çakışma denetimi), `_shared/iap.ts`, `store-notification.ts`, Apple/Google/operatör kaynak etiketleri, `iap-reconcile` handler; 7 Deno test dosyası |
| `4af9b0e` | `packages/core` billing şeması ve `database.types.ts` (isteğe bağlı alanlar) |
| `b861549` | `scripts/test-store-hardening-races.py`; denetim anahtar ipucu daraltıldı |
| (bu commit) | `docs/IAP.md` bölümü ve bu rapor |

## Yapılanlar (S03 maddeleri)

1. **Bildirim sırası ve tekilleştirme.** Mevcut `(platform,event_key)` inbox + 5 dk sahiplik + sürüm karşılaştırması korundu. Eklenenler: kalıcı ret kodları (`account_mismatch`, `bundle_mismatch`, `not_a_subscription`, `unknown_product`, `invalid_purchase_token`, `invalid_store_state`, `invalid_jws`) inbox satırına kodla yazılır ve sağlayıcıya **200 `{ok:false,rejected}`** döner (Apple 5 kez / Pub/Sub 7 gün boşuna yeniden denemez; satır yönetimde `failed`). Geçici hatalar (`family_not_found`, 5xx, yazma hatası) 503 kalır. RTDN `eventTimeMillis` biçim kontrolü. Google'da aynı token farklı `messageId` ile iki kez gelirse iki inbox olayı olur ama hak yazımı aynı sürümlü yoldan geçer (API yeniden okunur; eski/aynı durum `stale`). Apple sırası imzalı durumun `signedDate`'inden (var olan davranış, test tablosuyla sabitlendi). İmza doğrulama hata yolları zaten açık ret veriyordu (Apple 400 `invalid_jws` inbox'a girmeden; Google 503 yapılandırma yok / 401 doğrulanmadı) — testleri korundu.
2. **Aynı makbuz iki aile.** `apply_verified_store_state` reddi (`409 account_mismatch`) değişmedi; `iap-verify` artık reddi `record_store_account_conflict` ile `public.audit_log`'a yazar (`store_subscription.account_mismatch`; reddedilen aile+veli, sahip aile, sha256, uzunluk, uzun anahtarda 4 karakter ipucu; **ham anahtar yok**). Hak taşıma: plain `update` tetikleyiciyle engelli; **operatör taşıma işlemi bu pakette yazılmadı** (ayrı kabul).
3. **Yaşam döngüsü durum makinesi.** Deno tablo testi (`_shared/iap-lifecycle.test.ts`: Apple 11 adım + API durum geçersiz kılma + sırasız bildirim; Google 12 durum) ve pgTAP 094 SQL dizisi (`get_family_entitlement` ile aile erişimi). Tablo aşağıda.
4. **Android acknowledge.** `iap-verify`: **oku → hak yaz → acknowledge → onay kaydı**; başka aileye bağlı token acknowledge edilmez; ack hatası `503 acknowledge_failed` (hak var, istemci finish çağırmaz, yeniden dener). `acknowledgeGoogle` tekrar güvenli (hata sonrası yeniden okuma, `ACKNOWLEDGED` ise başarı). `acknowledged_at` sütunu; PENDING görülmüş onaysız satırlar `iap_reconcile_candidates`'ta öncelikli. "Doğrulanmamış" etiketi: `gina.store_verification_label` → `unacknowledged` / `client_only` / `store_checked` / `store_notified` / `legacy`, `finance_workspace.detail.subscriptions[].verification`. Sahte Play sunucusuyla 7 Deno testi; gerçek Google çağrısı yok.
5. **Zamanlayıcı/reconcile.** `iap-reconcile/handler.ts` ayrıldı: cron secret sabit zamanlı (boş/eksik/benzer değer 401, DB'ye dokunmaz), anahtar yoksa 503, aday başına bağımsız hata, `unchanged` sayacı, yanıt ve günlükte token/URL yok (önceden `String(e)` ağ hatası URL'deki tokenı sızdırabilirdi — düzeltildi). Operatör makbuzu `result_kind='store_check'`; kaynak `operator`; `no_data → unchanged`; iade/iptal diye sunulmaz (pgTAP ile sabit).
6. **Hukuki URL kapısı.** Sunucu tarafında karşılık **yok**; `iap-verify`'da ret doğru yer değil (para alınmış). Öneri `docs/IAP.md`'de: `app_settings.store_sales` anahtarı + istemci ön kontrolü; UI'ya dokunulmadı.

## Durum makinesi tablosu (sahte yüklerle doğrulanan)

| Geçiş | Apple girdisi | Google girdisi | `status` | Aile erişimi | Not |
| --- | --- | --- | --- | --- | --- |
| Satın al | tx `expiresDate>now`, renewal `autoRenewStatus=1` | `ACTIVE`, ack `PENDING`→ack→`ACKNOWLEDGED` | `active` | var | kaynak `client_verify`, etiket `client_only`/`unacknowledged` → ack sonrası `client_only` |
| Yenile | yeni `transactionId`, aynı `originalTransactionId`, ileri `expiresDate`, daha yeni `signedDate` | `ACTIVE`, yeni `expiryTime` | `active` | var | sürüm artar; `notified_at` ilk bildirimle dolar |
| Yükselt | aynı original, `productId=pro`, `isUpgraded` eski tx'te | yeni token + `linkedPurchaseToken` | `active` (pro) | pro hemen | Google eski token aynı işlemde `expired` + tombstone |
| Düşür | `renewalInfo.autoRenewProductId=plus`, tx hâlâ pro | plan değişimi dönem sonunda | `active` (pro) → yenilemede plus | pro → plus | ürün değişimi ancak yeni dönemle |
| Geri yükle | aynı imzalı durum tekrar | aynı token tekrar | değişmez | değişmez | `skipped:stale`, satır tekillenmez; başka aile → 409 + denetim |
| İptal | `autoRenewStatus=0` | `CANCELED`, `expiryTime>now` | `active`, `auto_renewing=false` | **dönem sonuna kadar var** | iptal ≠ iade |
| Billing retry | `isInBillingRetryPeriod`, süre dolmuş, grace yok | `ON_HOLD` / `PAUSED` | `on_hold` | **yok** | 60 gün uzlaştırma adayı |
| Grace | `gracePeriodExpiresDate>now`, `expiresDate<=now` | `IN_GRACE_PERIOD` | `grace` | var (grace sonuna kadar) | `expires_at = grace sonu` |
| Grace bitti | grace geçmiş, ödeme yok | `EXPIRED` | `expired` | yok | |
| İade / iptal-iade | `revocationDate` (veya API status 5) | RTDN 12 / voided + API `EXPIRED` | `revoked` | **hemen yok** | geç gelen yenileme `stale`, yeniden açamaz; RTDN ipucu tek başına aktif API'yi ezemez |
| Yeniden abone | yeni `originalTransactionId` | yeni token | `active` | var | yeni satır |
| Bekleyen ödeme | — | `PENDING` | satır yok | yok | `{ok:false,pending:true}`, acknowledge yok |
| Operatör telafisi | — | — | `entitlement_overrides` | var (`comp`) | mağaza satırı değişmez; `store_check` makbuzu iade değildir |

## Test çıktıları (gerçekten çalıştırıldı, izole `gina_s03_base_audit` ve Deno)

**Deno** (`supabase/functions`, `deno test --allow-env --allow-net=127.0.0.1 --allow-read` — 7 dosya):
```
iap-operator-reconcile/handler.test.ts 18 · iap-reconcile/handler.test.ts 9 · iap-verify/handler.test.ts 15
_shared/iap-state.test.ts 10 · _shared/store-notification.test.ts 35 · _shared/iap-lifecycle.test.ts 7 · _shared/google-acknowledge.test.ts 7
ok | 101 passed | 0 failed
```
`deno check` 5 fonksiyon `index.ts` + test dosyaları: temiz. (`deno lint` yalnız depodaki mevcut kalıplar: `npm:` öneki ve test stub'larında `require-await`; yeni türde sorun yok.)

**pgTAP** (boş `gina_completion_audit` şablonundan kurulan izole DB, `≥20261103093000` migration'ları + `20261106070000` uygulanmış):
```
003_entitlements 11 · 010_iap 10 · 048_store_notification_recovery 26 · 049_atomic_store_entitlements 43
050_billing_operations 22 · 052_operator_reconciliation 31 · 094_store_verification_hardening 87   → tümü ok
Tam paket: 87 dosya, 2551 ok; 1 başarısız dosya: 083_school_grade_lifecycle (ERROR school_grade_changed)
```
083 hatası S03'ten bağımsız: aynı şablonda **S03 migration'ı olmadan** da aynı hata (`pre083` kontrolü). Ayrı bulgu olarak kaydedildi, bu pakette düzeltilmedi.

**Yarış betikleri** (`--template gina_s03_base_audit`, her senaryo kendi geçici klonunda, sonra silindi):
```
test-store-notification-races.py  simultaneous_delivery/expired_lease_race/completed_duplicates passed, stale_worker_finish rejected
test-store-state-races.py         revision_order / first_claim_two_families / replacement_vs_late_old passed
test-operator-reconcile-races.py  same_request / two_requests / two_workers / two_completions passed
test-store-hardening-races.py     two_families_one_receipt_with_audit / notification_vs_client_verify / double_acknowledge_confirmation passed
```

**Core:** `pnpm --filter @gina/core test` → 40 dosya, 257 test geçti. Backoffice `tsc --noEmit`: yeni hata yok (yalnız önceden var olan `globals.css` yan etkili import tip bildirimi).

## Değişen sözleşmeler

- `iap-verify` yeni yanıt: `503 {error:"acknowledge_failed"}` (hak yazılmış, istemci finish çağırmamalı; mevcut istemci kodu zaten `ok` değilse finish çağırmıyor). Google'da artık `refreshGoogle` yerine ayrı oku/yaz/ack adımları; başka aileye bağlı token acknowledge edilmez.
- Bildirim uçları kalıcı retlerde `200 {ok:false,rejected:<code>}` döner (eskiden 503 ve sonsuz/5x yeniden deneme).
- `iap-reconcile` yanıtına `unchanged` eklendi; `failed[].error` yalnız kod.
- `apply_verified_store_state(jsonb,uuid,uuid)` imzası aynı; `p_state.source` ve `p_state.acknowledged` isteğe bağlı. `finance_workspace` abonelik satırlarına `last_source/notified_at/acknowledged_at/verification` eklendi; `reconcile_job_receipt`'e `result_kind`. Core zod şemaları isteğe bağlı alanlarla geriye uyumlu.
- Yeni RPC `record_store_account_conflict` (service_role).

## Kalan sınır / yapılmayanlar

- **X02/X03 BEKLİYOR:** gerçek Apple sandbox satın alma, Offer Code, App Store Server API anahtarıyla `fetchAppleState`; Google license tester, gerçek acknowledge, RTDN Pub/Sub OIDC audience/gönderici ile canlı teslim, `cron.job` ve `net._http_response` kontrolü. Saat kayması ve sağlayıcı gecikmesi ancak canlıda ölçülür.
- Operatör **hak taşıma** (bir makbuzu başka aileye bağlama) işlemi yok; yalnız ret + denetim var.
- Bildirim yolunda `family_not_found` hâlâ 503 (sağlayıcı yeniden dener): kullanıcı geri yükleme yaparsa sonraki teslim eşleşir; Pub/Sub 7 gün boyunca API'ye yük bindirir. Kabul edilen davranış, ileride ayrı kuyruk düşünülebilir.
- Hukuki URL kapısının sunucu karşılığı yalnız öneri; UI ve `app_settings` anahtarı yazılmadı.
- Backoffice `billing.tsx` `verification`/`result_kind` alanlarını henüz göstermiyor (B01 ajanı); veri RPC'de hazır.
- `083_school_grade_lifecycle` pgTAP hatası S03 dışı, açık bulgu.
- Deno `deno lint` depoda zorunlu değil; mevcut kalıplar korunmuştur.
