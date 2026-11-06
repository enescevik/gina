# H07 — Backoffice AI ön inceleme işletim hazırlığı — 6 Kasım 2026

| Alan | Durum |
|---|---|
| Sonuç | **Teknik hazırlık tamam, aktivasyon bekliyor.** "Canlı tamam" değil. |
| Kapı | `content_prereview.enabled` üretimde **kapalı kalır**; bu kart açmadı, migration değiştirmez |
| Kod | Dalda hazır: migration `20261106480000_prereview_activation_readiness.sql`, Edge `content-prereview` (auth ayrımı, kota/durdurma işleme), backoffice ileti etiketi, pilot `--only` |
| Test | İzole: pgTAP 133 (65/65), tam SQL paketi 130 dosya / 5982 kontrol / 0 hata (Europe/Istanbul + UTC), Deno 32 + CI toplu 300 geçti, izole servis + gerçek `index.ts` sondası 19/19 |
| Yayın | **Yapılmadı.** Migration üretime uygulanmadı, Edge dağıtılmadı, sır/Vault yazılmadı, cron değiştirilmedi, ücretli çağrı **0** |
| Sınır | Kütüphane sorusu üretilmedi; toplu inceleme veya yayın başlatılmadı (kart sınırı) |

DECISIONS ilkesi korunur: AI ön onayı (`ai_approved`) yalnız `gina.content_prereviews`'te tavsiye kaydıdır; yönetici kararı, yayın ve bağımsız eğitimci (X06) incelemesi ayrı kalır.

## 1. Mevcut yapının denetimi (E01/C09) ve H07'de kapatılan boşluklar

| Konu | Önce (E01/C09) | H07 sonrası |
|---|---|---|
| Kuyruk | `gina.content_prereviews`, içerik hash'i + prompt sürümü başına önbellek, 3 dk kira (lease) | Aynı. Ek: ücretli çağrı **defteri** `gina.content_prereview_calls` (claim başına bir satır, finish sonucu yazar) |
| Worker yetkisi | `x-cron-secret` = `CONTENT_PREREVIEW_SECRET` (sabit zamanlı karşılaştırma) veya kullanıcı JWT + rol kapılı `request_content_prereview` | Mantık değişmedi; `content-prereview/auth.ts`'e ayrıldı ve **test edildi** (yanlış/boş sır, sır yok, anon anahtar, anonim kullanıcı, finans/veli, kullanıcıyla drain/pilot → red) |
| Zamanlama | pg_cron `content-prereview-drain` `*/10 * * * *` → `gina.kick_content_prereview()`; kapı kapalıyken istek yok | Aynı zamanlama. Tur başına 3 kayıt (Edge 150 sn duvar saati), pg_net zaman aşımı 150 sn (önce varsayılan 5 sn); her istek/eksik Vault sırrı `gina.content_prereview_kicks`'e yazılır |
| Sağlayıcı/model | C08: `content_prereview.plan` (`"pro"`) → `resolveAi` → çözülen adapter; anahtar adı adapter'dan (`ANTHROPIC_API_KEY`), başka sağlayıcıya düşme yok; `max_output_tokens` 1500; sağlayıcı zaman aşımı 115 sn | Değişmedi |
| Kota | **Yoktu** (yalnız 10 dk'da 5 kayıt hız sınırı; yönetici isteği sınırsız) | `content_prereview.daily_call_limit` (varsayılan **25**, son 24 saat, hem drain hem yönetici yolu). Doluysa claim `daily_limit` döner: kayıt değişmez, deneme harcanmaz, drain turu durur. Ayar yok/bozuk → 0 (kapalı). Küresel kilitle yarışsız |
| Tekrar | 429/5xx/zaman aşımı/bozuk çıktı en çok 3 deneme; kalıcı hatalar tek çağrıdan sonra yöneticiye | Aynı. Ek: çağrı yapılmadığı kesin sonuçlar (`ai_temporarily_unavailable`, `provider_health_unavailable`, yapılandırma nedenleri) defterde `not_called`, kotaya sayılmaz, deneme iade edilir. **C09 sınır 4 kapandı:** 3. denemede Edge çökerse kayıt `pending` takılı kalmıyor; drain alır, claim **ücretsiz** `needs_admin/retry_limit` yapar |
| Durdurma | `content_prereview.enabled=false` (Edge her claim'de, cron her turda okur) + genel `ai.enabled` + C08 devre kesici | Aynı; ek ikinci fren `daily_call_limit=0`. Drain, kapı tur ortasında kapanırsa sonraki kayıtta durur (test) |
| Hata izleme | `audit_log` `content_prereview.%`, `ai_provider_health` | `gina.content_prereview_health()` (SQL editörü, sahip) + `public.admin_content_prereview_health()` (tam yönetici + içerik operatörü; C07 `assert_operation_role`). Kota/kullanım, sonuç dağılımı, en sık hatalar, bitmemiş çağrı, kuyruk, sağlayıcı duraklaması, cron işi + son 5 çalışma, son drain isteklerinin HTTP durumu ve **uyarı kodları** (§4) |

## 2. Kabul ölçütleri ve kanıt

| Ölçüt | Kanıt |
|---|---|
| Aynı iş bir kez ücretlenir | pgTAP 133 §4 (uçuştaki kayda ikinci claim `in_progress`, tekrar `cached`, tekrar finish `lease_lost`, defterde tek satır); Deno "3 eşzamanlı istek + tekrar → 1 çağrı"; sonda `replay_cached_no_second_charge`, `ledger_charged_once_for_item`. Yalnız içerik veya prompt sürümü değişince yeni inceleme; geçici hatada en çok 3 (sayılır, kotaya dahil) |
| AI/hatalı sonuç insan onayı sayılmaz | pgTAP 133 §5: `ai_approved` sonrası katkı `pending`, `reviewed_by/at` boş, `awaiting` doğru, audit aktörü `null`; hiçbir ön inceleme fonksiyonu karar/yayın tablosuna (`contribution_sets`, `library_publications`, `library_editorial_reviews`, `curriculum_candidates`, `library_content_items`) yazmıyor; AI kaydına yalnız ön inceleme fonksiyonları yazıyor. Deno: AI onayı yalnız claim/finish/provider RPC'lerini çağırıyor. Sonda `ai_approved_is_not_human_approval` |
| İnsan incelemesi ve yayın ayrı | Yukarıdaki yapısal kontrol + C09 pgTAP 118 / UI turu (yönetici AI'nın uygun bulduğunu reddedebiliyor, AI kaydı değişmiyor) |
| Yetkisiz iş çalışmaz | Deno `auth.test.ts` (3 test); pgTAP 133 §2/§11 (anon/veli/finans/yayın red, worker RPC'leri yalnız servis, defter istemciye kapalı); sonda: kimliksiz, yanlış/boş cron sırrı, anon anahtar, yönetici tokenıyla drain/pilot, finans, veli → **8/8 403, 0 çağrı** |
| Durdurma ve hata izleme testli | Deno: kapı tur ortasında kapanınca 1 çağrıdan sonra durur; kota sınırda durur; sağlık okunamıyorsa çağrı yok + iade. pgTAP 133 §6–§10 (kota, iade, takılı kayıt, bitmemiş çağrı, Vault eksik uyarısı, kill switch). Sonda `kill_switch_immediate`, `health_alerts_vault_secret_missing` |
| Eksik sır/hesap adları kayıtlı, değer yok | §3 |

## 3. Sır ve hesap adları (değer yok)

| Ad | Nerede | Durum (bu kartta doğrulanmadı — üretime erişim yok) |
|---|---|---|
| `CONTENT_PREREVIEW_SECRET` | Supabase Edge secrets | Aktivasyonda üretilecek (`openssl rand -base64 48`), parola yöneticisinde saklanacak |
| `content_prereview_secret` | Supabase Vault | `CONTENT_PREREVIEW_SECRET` ile **aynı** değer |
| `project_url` | Supabase Vault | `iap-reconcile` için kurulmuş olabilir; yoksa `https://<proje-ref>.supabase.co` |
| `ANTHROPIC_API_KEY` | Supabase Edge secrets | C08'den mevcut (C14b/C14c gerçek çağrılarında kullanıldı); `pro` paketinin modeli başka sağlayıcıya yönlenirse o adapter'ın anahtar adı gerekir |
| `SUPABASE_ACCESS_TOKEN` | Yerel (hesap sahibi) | `supabase functions deploy` / `db push` için |

## 4. İzleme: uyarı kodları (`select gina.content_prereview_health();`)

| Kod | Anlamı | Eylem |
|---|---|---|
| `drain_not_scheduled` | Kapı açık ama `content-prereview-drain` işi yok/pasif | §5 R3'teki `cron.schedule` |
| `drain_http_error` | Son 24 saatte drain isteği 2xx dışı döndü. **401 = Edge `verify_jwt` açık dağıtılmış**; 403 = Vault sırrı Edge sırrıyla aynı değil | `--no-verify-jwt` ile yeniden dağıt / sırrı eşitle |
| `drain_http_timeout` | pg_net 150 sn içinde yanıt almadı | Edge günlüğü; tur boyutu 3 |
| `vault_secret_missing` | Kapı açık, iş var, Vault `project_url` veya `content_prereview_secret` yok; istek atılmadı | Vault sırlarını kur |
| `daily_limit_reached` / `daily_limit_zero` | Kota doldu / kapı açıkken kota 0 | Bilinçli karar; gerekiyorsa sınırı değiştir |
| `unfinished_calls` | Claim edildi, 3 dk'dan uzun süredir sonuç yok (Edge öldü, ücret oluşmuş olabilir) | Edge günlüğü; kira dolunca yeniden denenir (3 deneme + kota içinde) |
| `retry_exhausted_pending` | 3 denemesi bitmiş kayıt bekliyor | Sonraki drain ücretsiz `needs_admin`'e taşır |
| `provider_paused` | C08 devre kesici sağlayıcıyı duraklattı | Çağrı yok; sağlayıcı durumunu kontrol et |
| `queue_stalled` | Kapı açık ve en eski bekleyen kayıt 1 saatten eski | Cron/Edge/kota uyarılarına bak |
| `ai_disabled` | Kapı açık ama genel `ai.enabled=false` | Bilinçli mi kontrol et |

Backoffice'te ayrı bir sağlık paneli **yok**; `admin_content_prereview_health` RPC'si hazır (tip üretildi) ama ekrana bağlanmadı. İzleme şimdilik SQL editöründen.

## 5. Aktivasyon runbook'u (YÜRÜTÜLMEDİ)

Her adım hesap sahibinin ayrı kararıdır; sıra zorunludur. Ücretli adımlar işaretli. Sır değerlerini terminal geçmişine bırakmayın.

**Zamanlama kararı:** iş her 10 dakikada **zamanlı kalır** ve kapı kapalıyken hiçbir şey yapmaz (tek `exists` okuması; HTTP yok, ücret yok, günlük satırı yok). Gerekçe: tek kill switch (`content_prereview.enabled`) hem Edge'i hem cron'u anında durdurur; "kapı açınca cron'u kur" gibi ikinci, unutulabilir bir adım yok. Ayrıca `verify_jwt` açık dağıtım veya eksik Vault sırrı başarısızlığa kapalıdır (çağrı yok) ve izlemede görünür.

### A0. Ön koşul ve salt okuma doğrulaması (ücretsiz)

```bash
supabase db push        # yalnız uygulanmamış migration'lar (20261106480000 dahil); db reset YOK
supabase functions deploy content-prereview     # H07 kodu; HENÜZ verify_jwt açık kalır (üretimdeki gibi)
```

```sql
select value from public.app_settings where key in ('content_prereview.enabled','content_prereview.daily_call_limit','ai.enabled','content_prereview.plan');
-- beklenen: false, 25, (true), "pro"
select jobname, schedule, active from cron.job where jobname='content-prereview-drain';   -- '*/10 * * * *', true
select name from vault.secrets where name in ('project_url','content_prereview_secret');
select gina.content_prereview_health();   -- alerts: [] (kapı kapalı)
```

### A1. Sırlar (ücretsiz)

```bash
openssl rand -base64 48   # parola yöneticisine; aşağıya yapıştırırken geçmişe yazmayın
supabase secrets set CONTENT_PREREVIEW_SECRET=<değer>
```

```sql
-- project_url zaten varsa oluşturma
select vault.create_secret('https://<proje-ref>.supabase.co','project_url');
select vault.create_secret('<CONTENT_PREREVIEW_SECRET ile aynı değer>','content_prereview_secret');
```

### A2. Edge'i JWT doğrulamasız dağıt (ücretsiz)

Zamanlayıcı ve pilot yalnız `x-cron-secret` gönderir; `verify_jwt=true` ağ geçidi bunları 401 ile reddeder (bugünkü üretim durumu: drain çalışamaz, başarısızlığa kapalı).

```bash
supabase functions deploy content-prereview --no-verify-jwt
```

Aynı yayın commit'inde `supabase/config.toml`'a ekleyin, yoksa sonraki toplu dağıtım `verify_jwt=true`'ya döner ve drain sessizce 401 alır (izlemede `drain_http_error`):

```toml
[functions.content-prereview]
verify_jwt = false
```

Ağ geçidi JWT'si olmadan güvenlik: gövde 256 KB sınırı kimlikten önce; cron yolu sabit zamanlı sır karşılaştırması, sır yoksa her sistem çağrısı red; kullanıcı yolu `auth.getUser` + rol kapılı RPC; kullanıcı tokenıyla drain/pilot asla (H07 testleri + sonda).

Doğrulama (kapı kapalı, **0 ücretli çağrı**):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$SUPABASE_URL/functions/v1/content-prereview" \
  -H 'content-type: application/json' -H 'x-cron-secret: yanlis' -d '{"drain":true}'                  # 403
curl -s -X POST "$SUPABASE_URL/functions/v1/content-prereview" -H 'content-type: application/json' \
  -H "x-cron-secret: $CONTENT_PREREVIEW_SECRET" -d '{"drain":true,"limit":1}'
# {"ok":true,"processed":0,...} veya results[0].reason = "prereview_disabled"
```

### A3. Kotayı 1'e indir (ücretsiz)

```sql
update public.app_settings set value='1' where key='content_prereview.daily_call_limit';
```

### A4. İlk sentetik pilot — **ÜCRETLİ, en çok 1 çağrı**, kapı hâlâ kapalı

Pilot içerik kaydına yazmaz, kapıya ve kotaya bağlı değildir (çağrı sayısını `--only` sınırlar); `ai.enabled`, model, anahtar ve C08 devre kesicisi geçerlidir.

```bash
CONTENT_PREREVIEW_SECRET=<değer> deno run --config supabase/functions/deno.json \
  --allow-net --allow-read --allow-write --allow-env scripts/prereview-pilot.ts \
  --url https://<proje-ref>.supabase.co --confirm-paid --only correct-square-perimeter-open \
  --out docs/release/h07-2026-11-06/pilot/hosted-1.json
```

Geçme: `meta.http_status=200`, tek sonuç, `error=null`, `summary.false_approvals=0`, beklenen `ai_approved` (veya güvenli taraf `needs_admin`). Anthropic konsolunda tek istek. 401 → A2 uygulanmamış; 503 `ai_*` → model/anahtar/AI kapısı.

Tam 9 öğelik pilot (≤ 9 ücretli çağrı, C09 DEPLOY adım 6 değerlendirme kuralı: `false_approvals` = 0) **ayrı karar**dır; enable kararının girdisi odur.

### A5. Enable — ayrı karar, yalnız pilot(lar) geçerse

```sql
update public.app_settings set value='1' where key='content_prereview.daily_call_limit';   -- ilk gün küçük başla
update public.app_settings set value='true' where key='content_prereview.enabled';
```

10–20 dk sonra: `select gina.content_prereview_health();` → `kicks[0].http_status=200`, `calls_24h ≤ 1`, `alerts` boş veya yalnız `daily_limit_reached`. Ardından yönetici kararı kuyrukta kalır; AI sonucu karar/yayın değildir. Kota adım adım (ör. 5 → 25) ayrı kararla yükseltilir. Günlük tavan = `daily_call_limit` (kayıt çağrıları; tekrar denemeler dahil) + açıkça çalıştırılan pilot öğeleri.

### R. Geri alma / durdurma (her biri bağımsız, anında)

1. **Durdur:** `update public.app_settings set value='false' where key='content_prereview.enabled';` — sonraki claim reddedilir, kick istek atmaz, uçuştaki en çok 1 çağrı tamamlanır.
2. **Kota freni:** `update public.app_settings set value='0' where key='content_prereview.daily_call_limit';`
3. **Zamanlamayı kaldır:** `select cron.unschedule('content-prereview-drain');` — geri: `select cron.schedule('content-prereview-drain','*/10 * * * *',$$ select gina.kick_content_prereview() $$);`
4. **Ağ geçidi JWT'sini geri aç:** `supabase functions deploy content-prereview` (bayraksız; `config.toml` girdisini de geri alın) — sistem çağrıları 401'e döner.
5. **Sırları kaldır:** `supabase secrets unset CONTENT_PREREVIEW_SECRET`; `delete from vault.secrets where name='content_prereview_secret';`
6. Migration geri alınmaz: yalnız ekleme (defter/kick tabloları, ayar, servis gövdeleri); içerik ve yönetici kararlarını yeniden yazmaz. AI kayıtları tavsiye olarak kalır.

## 6. Testler (gerçekten çalıştırıldı)

```
pgTAP 133_prereview_activation_readiness (izole DB)                       → 65/65
python3 scripts/test-q02-sql.py --run-local (Europe/Istanbul)             → 130 dosya, 5982 kontrol, 0 hata  [pgtap-istanbul/sql-checks.json]
python3 scripts/test-q02-sql.py --run-local --timezone UTC                → 130 dosya, 5982 kontrol, 0 hata  [pgtap-utc/sql-checks.json]
deno test content-prereview/ + _shared/prereview.test.ts                  → 32 passed (8 yeni H07: 5 handler, 3 auth)
CI deno check (ci.yml 51, content-prereview/index.ts eklendi)             → 0 hata
CI deno test toplu (ci.yml 52, auth.test.ts eklendi)                      → 300 passed, 0 failed
deno run scripts/prereview-pilot.ts --deterministic [--only …]           → 9/9 ve 1/1, false_approvals 0 (ücretsiz)
izole servis sondası harness/probe.py (C09 harness + değiştirilmemiş index.ts) → 19/19  [harness/isolated-probe-result.json]
pnpm --filter @gina/core test / tsc                                       → 64 dosya, 457 test / 0
pnpm --filter @gina/backoffice typecheck / lint / build                  → 0 / 0 / 0
bash scripts/gen-db-types-isolated.sh --run-local                         → database.types.ts +3 satır (admin_content_prereview_health)
```

İzole sonda: C09 harness'ı (boş şablondan tek kullanımlık `gina_c09_<hex>_audit`, kendi GoTrue + PostgREST, bütün migration'lar), gerçek `content-prereview/index.ts` loopback'te; yalnız `api.anthropic.com` yerelde deterministik yanıtlanır (hosted model yok, ücret yok). Sıra: kapı kapalı (0 çağrı, kick kaydı yok) → 8 yetkisiz çağrı 403 → kapı açık, kota 1 → drain 1 çağrı + `daily_limit`, yönetici isteği `retry_pending/daily_limit` → kota 10, içerik operatörü isteği `ai_approved` (1 çağrı), tekrar `cached` → katkı `pending|null`, AI audit aktörü null → sağlık okuması (operatör 200, finans 403; izole DB'de cron işi olmadığı için `drain_not_scheduled` doğru uyarı) → Vault'suz kick `vault_secret_missing` → kill switch anında (503, 0 yeni çağrı). Temizlik: REST/Auth konteynerleri ve DB silindi; sonrasında `gina_c09%`/`gina_q02sql%`/`gina_dbtypes%` DB 0, konteyner 0. Fixture, parolalar ve cron sırrı yalnız scratchpad'deydi.

Mevcut test değişikliği: pgTAP 091'in 78. kontrolü ("tükenmiş kayıt worker kuyruğundan çıkar") yeni sözleşmeye göre güncellendi: tükenmiş kayıt kuyrukta görünür kalır ki sonraki claim onu ücretsiz `retry_limit`'e taşısın (C09 sınır 4). Sonraki kontroller (4. claim `retry_limit`, tek bildirim, `cached`) değişmeden geçiyor.

## 7. Değişen dosyalar

- `supabase/migrations/20261106480000_prereview_activation_readiness.sql` (yeni; atanmış slot)
- `supabase/tests/133_prereview_activation_readiness.test.sql` (yeni; atanmış numara), `supabase/tests/091_content_prereview.test.sql` (1 kontrol)
- `supabase/functions/content-prereview/{auth.ts,auth.test.ts}` (yeni), `{handler.ts,index.ts,handler.test.ts}`
- `apps/backoffice/src/components/content-prereview.tsx` (`daily_limit` etiketi, `retry_pending` iletisi)
- `scripts/prereview-pilot.ts` (`--only`), `packages/core/src/database.types.ts` (üretildi), `.github/workflows/ci.yml` (content-prereview deno check + auth testi)
- Bu klasör: README, `harness/probe.py`, `harness/isolated-probe-result.json`, `pgtap-istanbul/`, `pgtap-utc/`

C07'nin yeniden kapıladığı üç kuyruk RPC'si tanımlanmadı (pgTAP 133 §12 + 113 geçti); anon çalıştırabilen yeni fonksiyon yok (pgTAP 102 geçti).

## 8. Açık sınırlar

1. **Aktivasyon bekliyor:** §5'in hiçbir adımı yürütülmedi; üretimdeki cron işi, Vault ve Edge sırrı durumu bu kartta okunmadı (erişim yok). Gerçek model kalitesi/eşik kalibrasyonu hâlâ C09 pilotuna bağlı.
2. Pilot çağrıları kayda bağlı olmadığından defterde/kotada sayılmaz; sınırları `--only` ve 12 öğe tavanıdır.
3. Edge 150 sn duvar saatini aşarsa (3 kayıt × en çok 115 sn) yarıda kalan çağrı ücretlenmiş olabilir; `unfinished_calls` gösterir, kira dolunca tekrar 3 deneme ve kota içinde.
4. pg_net zaman aşımında Edge'in istemci kopunca işi sürdürüp sürdürmediği hosted ortamda doğrulanmadı (`drain_http_timeout` uyarısı izlemede).
5. Backoffice sağlık paneli yok (RPC hazır). E-posta/push uyarısı yok; izleme SQL editöründen elle.
6. Görseller hâlâ modele gönderilmez → görselli kayıt her zaman yönetici kararına düşer (C09 sınırı).
