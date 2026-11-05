# Q03 düzeltmeleri (gece çalışması, 6 Kasım 2026)

Kaynak: `main` `0cfdd8f` (Q03 raporu `docs/release/q03-2026-11-06/README.md` birleşmiş), çalışma dalı
`worktree-agent-aa6345bcf3c811218`. **Main'e push edilmedi. Üretim Supabase'e dokunulmadı; `db reset` yapılmadı; yayın
yapılmadı.** Tüm DB testleri tek kullanımlık izole klonlarda (`scripts/test-q02-sql.py`, `scripts/security/*`,
`scripts/test-e2e-family-chain.py`, `scripts/test-isolated-services.py`). UI'ya dokunulmadı.

## Uygulananlar

| Bulgu | Değişiklik | Commit |
|---|---|---|
| Q03-DB-1, DB-2, DB-3 | `supabase/migrations/20261106150000_rls_grant_hygiene.sql`: **15** `gina.*` tablosunda RLS açık (Q03'teki 12 + sonradan gelen `bulk_archive_items`, `bulk_archive_runs`, `deletion_previews`); politika karşılığı olmayan **50** authenticated yazma grant'i kaldırıldı (Q03'teki 47 + `ai_feature_requirements` ×3); `gina.claims/role/family_id/child_id/valid_review_document` anon/public EXECUTE geri alındı, authenticated/service_role açıkça yinelendi. pgTAP `supabase/tests/102_rls_grant_hygiene.test.sql` (16 kontrol). `scripts/test-q02-sql.py` `--fresh` ve `--skip-migration` A/B seçenekleri | `745588d` |
| Q03-HTTP-1, HTTP-2 | `deploy/web/_headers`: `/_expo/static/*` glob'u kaldırıldı; `scripts/cf-pages-headers.mjs` derleme çıktısında **gerçekten var olan** her hash'li dosya için tam yol immutable kuralı üretir (bütçe aşılırsa uzantı glob'una düşer ve uyarır); `/s/*` bloğunda `! Referrer-Policy` + `no-referrer`. `scripts/cf-pages-finalize.mjs` üretilen dosyayı Cloudflare birleştirme kuralını taklit eden `effectiveHeaders` ile örnek yollarda doğrular (aynı başlık iki kez gidiyorsa derleme durur). `scripts/cf-pages-headers.test.mjs` 7 test (uçtan uca `cf-pages-finalize.mjs` dahil). **Yayınlanmadı; sabah web yayınıyla gider** | `67bfdc1` |
| Q03-EDGE-1 | `supabase/functions/push-send/auth.ts`: bayt bazlı, uzunluktan bağımsız sabit zamanlı karşılaştırma; yapılandırılmış her sır her istekte karşılaştırılır (kısa devre yok); sır yoksa kapalı. **Sözleşme değişmedi**: `PUSH_SEND_SECRET` *veya* `SUPABASE_SERVICE_ROLE_KEY` bearer olarak kabul edilir (Q03 notu: servis anahtarının bu uçta kabulü sırrın kapsamını genişletir; daraltma ayrı karar). `auth.test.ts` 5 test | `a05b7c3` |
| Q03-LEAK-1 | `.github/workflows/security.yml`: `leak-scan.mjs` bilgi amaçlı adım (`continue-on-error`, `--summary $GITHUB_STEP_SUMMARY`, değer yazmaz). Allowlist: hesap sahibinin Access e-postası (3 belge), Google'ın yayımladığı RTDN servis hesabı adresi, URL userinfo test vektörleri (2), sır **adı** yazan 2 belge satırı. Tarama: 2.129 dosya, yüksek/orta 0 | `47dfce8` |
| Q03-BK-1/2/3 | `scripts/restore-database.mjs` (**dry-run varsayılan**; `--execute --target-confirm <dbname>` çift kapı; bağlantı dizesi maskeli), `scripts/security/post-restore-acl-check.sql` (0 satır beklenir), `docs/security/RESTORE-RUNBOOK.md`; `scripts/restore-database.test.mjs` 6 test | `d13933b` |

## RLS matrisi farkı (sıfırdan 115 migration, `rls-matrix.py --fresh`)

Tam fark: [`rls-matrix-diff.md`](rls-matrix-diff.md); ham: `rls-matrix-fresh-before.json`, `rls-matrix-fresh-after.json`.

| Özet | Önce | Sonra |
|---|---|---|
| tablo / fonksiyon | 160 / 454 | 160 / 454 |
| RLS kapalı tablo | 15 | **0** |
| politika karşılığı olmayan authenticated yazma grant'i | 50 | **0** |
| anon çalıştırabilen fonksiyon (tetikleyici dışı) | 6 | **1** (`get_shared_child_view`) |
| security definer `search_path` eksik | 0 | 0 |
| başarısız sentetik kontrol | 2 | **0** |

Fark satırları **yalnız beklenenler**: 65 tablo satırı (15 `rls_enabled`, 50 grant) + 5 fonksiyon satırı (`anon_execute`).
Select grant'leri, politikalar, authenticated EXECUTE değişmedi. Hiçbir grant korunmak zorunda kalınmadı: istemci kodunda
(`apps/`, `packages/`) bu 18 tabloya doğrudan `.insert/.update/.delete/.upsert` çağrısı yok; yazma yolu security definer
RPC'ler (sahip `postgres`, RLS'ten muaf).

## Test çıktıları (gerçekten çalıştırıldı)

| Test | Sonuç | Kanıt |
|---|---|---|
| pgTAP **tüm paket, sıfırdan tüm migration'lar** (`test-q02-sql.py --run-local --fresh`) | 94 dosya, **2.938** kontrol; başarısız dosyalar 066, 069, 083, 088 | `sql-checks-fresh.json` |
| aynı paket **migration olmadan** (`--skip-migration 20261106150000`) | 94 dosya, 2.934 kontrol; başarısız dosyalar **aynı** 066, 069, 083, 088 (+102 beklenen) | `sql-checks-fresh-without-migration.json` |
| pgTAP 102 tek başına, fresh | **16/16** | — |
| pgTAP tüm paket, şablon modu | 2.983 kontrol; başarısız 083, 088 ve **102#5** | `sql-checks-template.json` |
| `rls-matrix.py --fresh` sonrası | sentetik 10/10 geçti | `rls-matrix-fresh-after.json` |
| `rls-matrix.py` şablon modu sonrası | RLS kapalı 0, grant 0; anon fonksiyon 4 (= 1 + şablon sapması 3) | — |
| `test-e2e-family-chain.py --run-local` | **299 kontrol true, 0 false** | `e2e-family-chain.json` |
| `test-isolated-services.py --run-local --with-realtime --with-storage` | **285 kontrol true, 0 false** | `regression-isolated-services.json` |
| `node --test scripts/*.test.mjs` | **78/78** (yeni: headers 7, restore 6) | — |
| Deno `push-send/` | **33/33** (yeni `auth.test.ts` 5 dahil); `deno check push-send/index.ts` temiz | — |
| `restore-drill.py --run-local` (yeniden) | A/B beklenen başarısız; **C ve D**: sayım 11/11, ilişki 6/6, ACL+tetikleyici paritesi, GoTrue 200, JWT doğru | `restore-drill.json` |
| `restore-database.mjs --execute` izole tatbikat | **BAŞARILI** 79,7 s: 115 migration, replica veri yükü, ACL kontrolü 0/0/0, 11 sayım kaynakla eşit, 5 yetim sorgusu 0, veli JWT ile çocuğu görür | `restore-database-drill.json`, `restore-database-isolated-run.json` |

pgTAP başarısızlıkları hakkında: 066/069/083/088 **migration'dan bağımsızdır** (migration olmadan aynı dosyalar, aynı
kontroller başarısız; 083 Q03 raporu §7'de zaten kayıtlı). 066/069 yalnız `--fresh` modunda düşer, şablon modunda geçer
(şablon ve sıfırdan kurulum arasındaki tohum/durum farkı; ilgili paket sahiplerine not). 102#5 şablon modunda düşer çünkü
şablonun `admin_save_contribution_reward`, `admin_set_ai_operation_policy`, `admin_set_library_quota` fonksiyonlarında ACL
NULL (Q03 §2 "şablon sapması") — test bunu **doğru** yakalar; üretim eşleniği sıfırdan kurulumda 0'dır. Şablon yenilenmeli.

`restore-database.mjs` tatbikatında `function_acl_parity_with_source=false`: kaynak şablon üzerinden, hedef hosted
varsayılan ayrıcalıklarla sıfırdan kuruldu; fark `service_role=X` girdilerinin hedefte bulunması (hosted'daki beklenen
durum), anon fazlalığı **0**. Yani ACL kaybı değil, iki ortamın farkı. Tatbikat hedefi için `auth.users` üzerinde
`postgres`'e select/insert/update/delete/references/trigger verildi (hosted'da zaten vardır; şablon klonunda yoktu).

## Üretim notu

Hiçbir değişiklik üretime uygulanmadı. Öneri: hesap sahibi `scripts/security/post-restore-acl-check.sql`'i canlıda **bir
kez** salt okunur çalıştırsın (beklenen 0 satır; geçmişte şema dökümünden geri yükleme yapılmışsa Q03-BK-3 burada görünür).
Migration sıradaki normal dağıtımla gider; web `_headers` değişikliği sabah web yayınıyla gider; `push-send` yeniden
dağıtım ister.

## Kalan sınır

- Hosted Supabase'de süper kullanıcı yok: `restore-database.mjs` `replica` modu orada çalışmaz; `--trigger-mode
  disable-user` yazıldı ama **tatbikatta denenmedi**; Supabase'in kendi yedek/PITR aracı tercih edilmeli. Storage içerikleri
  DB dökümünde yok. Üretimde geri yükleme provası yapılmadı.
- `patches/proposed/` dosyaları olduğu gibi bırakıldı (öneri kaydı); `README.md`'si artık migration'a işaret etmelidir
  (bu turda güncellenmedi).
- `push-send`'de servis anahtarının bearer olarak kabulü sürüyor (sözleşme); daraltma ayrı karar.
- Backoffice `_headers` (`/_next/static/*` immutable) incelenmedi; Next statik çıktıda SPA fallback yok, aynı sorun
  beklenmez ama doğrulanmadı.
- pgTAP 066/069/088 başarısızlıkları bu turun dışında, paket sahiplerine aktarılmalı.
