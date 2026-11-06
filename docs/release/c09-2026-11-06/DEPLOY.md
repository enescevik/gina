# C09 — AI içerik ön incelemesi: C14 yayın adımları (tek dosya)

> **H07 (6 Kasım) güncellemesi:** aktivasyon için geçerli sıra artık [H07 runbook](../h07-2026-11-06/README.md#5-aktivasyon-runbooku-yürütülmedi)'tur (günlük kota `content_prereview.daily_call_limit`, ilk pilot `--only` ile ≤ 1 ücretli çağrı, drain turu 3 kayıt, sağlık okuması `gina.content_prereview_health()`). Aşağıdaki adımlar tarihsel C09 kaydıdır.

Bu dosya C14 yayın planına eklenecek **sıralı** adımlardır. Hiçbiri bu kartta üretimde uygulanmadı. Sır değeri bu dosyaya, rapora veya Git'e yazılmaz; yalnız ADI geçer. Her adımın doğrulaması ve geri dönüşü yanındadır.

**Ön koşul (sıra):** E01 `20261106050000_content_prereview.sql` → C05 `20261106250000` → C07 `20261106270000_operator_access.sql` → C08 `20261106290000_ai_routing_and_grade_split.sql` → C10 `20261106300000` → **C09 `20261106320000_prereview_ops.sql`**. C09, C08'in `gina.ai_provider_outcome/ai_provider_paused` fonksiyonlarını ve C07'nin `gina.assert_operation_role` fonksiyonunu kullanır; daha önce uygulanırsa migration hata verir (sessiz kısmi kurulum yok).

## 0. Karar: kapalı başla

`content_prereview.enabled` = `false` kalır (E01 varsayılanı; C09 değiştirmez). Adım 7'ye kadar AI çağrısı yapılmaz. Kuyruğa alma (yönetici/içerik operatörü) kapı kapalıyken de çalışır; kayıtlar `pending` bekler, ücret oluşmaz.

## 1. Migration

```bash
supabase db push   # hosted; yalnız henüz uygulanmamış migration'ları uygular. db reset YOK.
```

Doğrulama (SQL editörü, salt okuma):

```sql
select proname from pg_proc where proname in ('content_prereview_provider','operator_prereview_notices',
 'mark_operator_prereview_notices_read','admin_prereview_candidate_context','kick_content_prereview');      -- 5 satır
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('admin_content_prereviews','request_content_prereview','enqueue_content_prereview')
 and pg_get_functiondef(p.oid) like '%assert_operation_role%';                                                 -- 3 (C07 kapısı korunur)
select jobname, schedule from cron.job where jobname='content-prereview-drain';                               -- '*/10 * * * *'
select value from public.app_settings where key='content_prereview.enabled';                                  -- false
```

Geri dönüş: migration yalnız fonksiyon/tablo ekler ve servis/iç gövdeleri değiştirir; içerik verisini yeniden yazmaz. Sorun olursa `content_prereview.enabled=false` yeterlidir (drain hiçbir şey göndermez). `cron.unschedule('content-prereview-drain')` zamanlamayı kaldırır.

## 2. Edge sırrı

```bash
openssl rand -base64 48            # değeri parola yöneticisine kaydet; terminal geçmişine bırakma
supabase secrets set CONTENT_PREREVIEW_SECRET=<değer>
```

Sağlayıcı anahtarı: `pro` paketinin modeli Anthropic ise mevcut `ANTHROPIC_API_KEY` sırrı kullanılır (C08: anahtar adı çözülen adapter'dan; başka sağlayıcıya düşme yok). Yeni sağlayıcı anahtarı bu kartla eklenmez (X04).

## 3. Edge dağıtımı

```bash
supabase functions deploy content-prereview --no-verify-jwt
```

`--no-verify-jwt` gerekli: zamanlayıcı yalnız `x-cron-secret` gönderir. Kullanıcı yolu yine JWT'yi `auth.getUser` ile doğrular ve yetkiyi `request_content_prereview` RPC'si (C07: yönetici veya içerik rolü) kanıtlar. Pilot ve drain yalnız sistem sırrıyla açılır.

Doğrulama (ücretsiz, model çağrısı yok — kapı kapalı):

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/content-prereview" -H 'content-type: application/json' \
  -H "x-cron-secret: $CONTENT_PREREVIEW_SECRET" -d '{"drain":true,"limit":1}'
# beklenen: {"ok":true,"processed":0,...} veya kuyrukta kayıt varsa results[].reason = "prereview_disabled"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$SUPABASE_URL/functions/v1/content-prereview" \
  -H 'content-type: application/json' -H 'x-cron-secret: yanlis' -d '{"drain":true}'          # 403
```

## 4. pg_cron drain için Vault sırları

Migration `content-prereview-drain` işini her 10 dakikaya kurar; iş `gina.kick_content_prereview()` çağırır. Fonksiyon şu durumlarda **hiç istek atmaz**: kapı kapalı, `pending` ve süresi dolmuş kirası olan kayıt yok, ya da Vault sırları eksik.

```sql
-- project_url başka işlerde (source-cleanup) zaten varsa yeniden oluşturma.
select vault.create_secret('https://<proje-ref>.supabase.co', 'project_url');
select vault.create_secret('<CONTENT_PREREVIEW_SECRET ile AYNI değer>', 'content_prereview_secret');
```

Doğrulama: `select name from vault.secrets where name in ('project_url','content_prereview_secret');` → 2 satır. Drain sınırı: çağrı başına en çok 5 kayıt, en fazla 6 çağrı/saat → kayıt başına ≤ 3 ücretli deneme (aşağıda).

## 5. Rol ve bildirim kontrolü (ücretsiz)

- Aile üyesi olmayan yönetici ve süresi dolmamış içerik operatörü `/library?tab=items` sayfasında **Karar bekleyen AI ön incelemeleri** kutusunu ve bildirimlerini görür (`operator_prereview_notices`). Push yalnız aile üyesi yöneticiye gider (E01 davranışı).
- Finans/destek/yayın rolleri kuyruk ve bildirimleri göremez; yayın rolü yalnız aday kaynak rozetlerini görür.

## 6. Gerçek model pilotu (ücretli, ≤ 9 çağrı) — BEKLİYOR, C14 sonrası tek seferde

Kapı **kapalıyken** yapılır (pilot içerik kaydına yazmaz; `ai.enabled`, model, anahtar ve C08 devre kesicisi geçerlidir):

```bash
CONTENT_PREREVIEW_SECRET=<değer> deno run --config supabase/functions/deno.json \
  --allow-net --allow-read --allow-write --allow-env scripts/prereview-pilot.ts \
  --url https://<proje-ref>.supabase.co --confirm-paid \
  --out docs/release/c09-2026-11-06/pilot/hosted-result.json
```

Set: `scripts/prereview-pilot-set.json` — 3 doğru, 3 yanlış (kesir anahtarı, alan/çevre karışıklığı, senaryo sayı uyuşmazlığı), 3 belirsiz (görsele bağlı üçgen, eksik bilgili problem, kişisel veri). Çıkış kodu 1: yanlış onay (`false_approvals>0`) veya hata.

Değerlendirme kuralı (enable kararının girdisi):

1. `false_approvals` **0** olmalı. Değilse enable yok; `SYSTEM` metni düzeltilir, `PREREVIEW_PROMPT_VERSION` yükseltilir (`prereview-v3`), pilot tekrarlanır.
2. `correct_auto_approved / correct_total` düşükse yalnız iş yükü artar (güvenli taraf); eşik düşürülmez — tek pilot 0,85'i kalibre etmez.
3. Güven dağılımı (`summary.confidences`) rapora yazılır; eşik değişikliği ayrı ürün kararıdır.

## 7. Enable (yalnız pilot geçerse, ayrı karar)

```sql
update public.app_settings set value='true' where key='content_prereview.enabled';
```

İlk gün: kuyrukta en çok birkaç kayıt; `audit_log` `content_prereview.%` ve `ai_provider_health` izlenir. Kapatma = aynı satırı `false` yapmak (anında; drain ve Edge kapıyı her çağrıda okur).

## Ücret ve tekrar sınırları (özet)

| Durum | Ücretli çağrı |
|---|---|
| Aynı içerik + aynı prompt sürümü | 0 (`cached`) |
| İçerik veya prompt sürümü değişti | 1 yeni inceleme |
| 429 / 5xx / zaman aşımı / bozuk çıktı | en çok 3 deneme, sonra `needs_admin` + `retry_limit` (istekle yeniden kuyruğa alınmaz) |
| 401/403/400, girdi büyük, ret (refusal), yapılandırılmamış/desteklenmeyen model | 1, sonra hemen `needs_admin` (otomatik tekrar yok) |
| `content_prereview.enabled=false` | 0 (kayıt `pending` bekler; claim `prereview_disabled`) |
| Genel AI kapalı / model pasif / anahtar yok | 0 (`needs_admin` + neden; düzeltildikten sonra yönetici açık istekle yeniden kuyruğa alabilir) |
| Sağlayıcı duraklatıldı (C08 devre kesici) | 0; deneme hakkı iade edilir, drain o turu durdurur |
| Eski / geri çekilmiş kaynak sürümü veya emekli hedef (senaryo adayı) | 0 (`needs_admin` + `source_*`) |
| Görselli kayıt | 1; model görseli görmez → asla `ai_approved` değil (`media_not_reviewed`) |
