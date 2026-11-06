# C13 — Taramalar (madde 3): bağımlılık, sızıntı, Storage/imzalı adres, Edge, canlı başlıklar

Tarih: 6 Kasım 2026, worktree `agent-a5c9983a25ff83ce2` (HEAD `cf391d8`, C01–C11 birleşmiş). Taban çizgisi:
`docs/release/q03-2026-11-06/README.md` §1/§3/§5 ve `docs/release/q03-fixes-2026-11-06/README.md`. Bu dosya o taban
çizgisini günceller; Q03 belgeleri değiştirilmedi. Üretime yazma yok, oturum açılmadı, sır yazılmadı, commit yok.
Edge kodu değiştirilmedi; öneriler aşağıda metin olarak.

## Özet

| Önem | Adet | Kimlikler |
|---|---|---|
| Yüksek | 0 | — |
| Orta | 0 | — |
| Düşük | 5 | C13-SCAN-1, C13-SCAN-2, C13-SCAN-3, C13-SCAN-5, C13-SCAN-6 |
| Bilgi | 6 | C13-SCAN-4, C13-SCAN-7, C13-SCAN-8, C13-SCAN-9, C13-SCAN-10, C13-SCAN-11 |

Bağımlılık tablosu Q03 ile **aynı** (yeni duyuru yok, yüksek/kritik 0). Sızıntı taramasında gerçek sır veya gerçek kişi
verisi bulunmadı; yeni eşleşmelerin hepsi sentetik test verisi. İki özel kova, `storage.objects` üzerinde 0 politika,
genel kova yok. Tek imzalı okuma adresi 120 sn; imzalı **yükleme** belirteci platform gereği 7200 sn (C13-SCAN-2).
Backoffice ana adres ve rastgele önizleme 12/12 Access'e yönleniyor. Veli webindeki Q03-HTTP-1/2 düzeltmesi depoda var
ama **canlıda henüz yok** (yayın bekliyor).

## 1. Bağımlılıklar (Q03 §1 güncellemesi)

| Kapsam | Komut | Sonuç (6 Kasım, C13) | Paket / yol | Q03'e göre |
|---|---|---|---|---|
| prod | `pnpm audit --json --prod` | 0 kritik/yüksek, **2 orta**, 736 bağımlılık | glob 13.0.6 GHSA-3g3m-2fjr-6pw4 / CVE-2026-118773 (`apps__mobile>expo>@expo/cli>glob`); minimatch 10.2.6 GHSA-g3hv-75wg-m249 / CVE-2026-118764 (`…>@expo/cli>glob>minimatch`) | aynı |
| dev | `pnpm audit --json --dev` | 0 kritik/yüksek, **1 orta, 1 düşük**, 618 bağımlılık | minimatch 10.2.6 (`apps__backoffice>eslint-config-next>typescript-eslint>@typescript-eslint/typescript-estree>minimatch`); deepmerge 4.3.1 GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 (`apps__mobile>react-native-svg-transformer>@svgr/plugin-svgo>deepmerge`) | aynı |
| tümü | Trivy 0.70.0 `fs --scanners vuln --include-dev-deps --skip-db-update --skip-dirs node_modules .` (önbellekli DB, 2026-11-05 19:01 UTC; indirme gerekmedi) | **2 MEDIUM** — glob 13.0.6 (düzeltme 14.0.2), minimatch 10.2.6 (düzeltme 11.0.1); deepmerge görünmez | `pnpm-lock.yaml`, 1.133 paket | aynı |
| Edge (Deno) | `node scripts/security/c13-deno-npm-audit.mjs` (yeni yardımcı; `deno.lock` npm girdilerini npm kayıt defterinin toplu duyuru ucuna salt okunur POST eder; gölge lock gerekmez) | **0 bulgu**, HTTP 200 | 15 npm girdisi (supabase-js 2.118.0 ailesi, pdf-lib 1.17.1, @resvg/resvg-wasm 2.6.2, pako 1.0.11, iceberg-js 0.8.1, tslib 1.14.1/2.8.1); JSR `@std/assert@1.0.19`, `@std/internal@1.0.14` kapsam dışı | aynı girdiler; C01–C11 yeni npm/JSR/URL içe aktarımı eklemedi (`grep` ile doğrulandı: yalnız `npm:@supabase/supabase-js@2`, `npm:pdf-lib@1.17.1`, `npm:@resvg/resvg-wasm@2.6.2`, `jsr:@std/assert`) |
| yama davranışı | `node --test scripts/check-toolchain-security.test.mjs` | **8/8 geçti** | `pnpm-lock.yaml` `patchedDependencies` hash'leri yerinde (deepmerge, glob, minimatch) | aynı |

Kanıt: `pnpm-audit-prod.json`, `pnpm-audit-dev.json`, `trivy-fs.json` (özet; tam paket listesi çıkarıldı), `trivy-fs.log`,
`deno-npm-audit.json`. Uyarılar bastırılmadı, istisna eklenmedi (`patches/README.md` ile tutarlı).

## 2. Sır / sızıntı taraması (Q03 §5 güncellemesi)

`node scripts/security/leak-scan.mjs --json leak-scan.json` → 2.532 metin dosyası (Q03: 2.024), `.env*` içeriği açılmadı
(yalnız `apps/backoffice/.env.example`, `apps/mobile/.env.example` var; 41be81e'den beri değişmediler). Çıkış kodu **1**
(allowlist dışı orta/yüksek eşleşme var). Değerler yazılmadı; triage maskeli bağlamla yapıldı.

| Desen | Adet | Yer | Değerlendirme |
|---|---|---|---|
| `private_key_block` (yüksek) | 1 | `supabase/functions/_shared/google-acknowledge.test.ts:12` | yanlış pozitif: test, `crypto.subtle.generateKey` ile çalışma anında ürettiği anahtarı PEM'e sarar (satır 10–12); allowlist'te yok |
| `assigned_secret_literal` (orta) | 2 | `scripts/health-check.test.mjs:28`, `scripts/release-local.test.mjs:38` | yanlış pozitif: geçici dizine yazılan sahte test değerleri (değer içinde "secret" sözcüğü geçen yer tutucu) |
| `tr_phone` (orta) | 9 | `packages/core/src/notification-channels.test.ts:13-14`, `scripts/test-c10-channels-ui.cjs:105`, `supabase/functions/_shared/channels/sms.test.ts:5`, `supabase/functions/push-send/channels.test.ts:29,136`, `supabase/tests/095_notification_channels.test.sql:71,113`, `scripts/prereview-pilot-set.json:152` | sentetik: dosyalardaki tüm numaralar iki değere indirgendi — `+90 555 111 22 33` (9 kez) ve `0555 000 0000` (1 kez, pilot setindeki uydurma "Deniz Kaya" PII-tespit örneği) |
| `email_non_placeholder` (düşük) | 6 | `docs/release/c05-2026-11-06/chain-checks.json:17,770`, `supabase/functions/curriculum-source-fetch/runtime-probe.ts:56` | URL userinfo reddi test vektörü (`https://<kullanıcı>@odsgm.meb.gov.tr/`), kişi değil |
| | | `docs/release/c11-2026-11-06/user-guides.md:20,24,47` | projenin kendi gönderen adresi (`…@mail.ginaaile.app`) ve Google RTDN servis hesabı biçimi; sır/kişi değil |
| `hex64_possible_device_token` (düşük) | 6 | `supabase/functions/prova-review/assets/provenance.json:15-19` (Q03'te biliniyor), `docs/release/c05-2026-11-06/chain-checks.json:59` | SHA-256 özetleri (`downloaded_hash_matches_repository_manifest`); cihaz belirteci değil |
| `supabase_project_host` (bilgi) | 17 | belgeler ve test dosyaları | canlı CSP başlığında zaten açık; sır değil |
| JWT / `sb_secret_` / `sbp_` / `sk-ant-` / AWS / Google API | 0 | — | — |

41be81e'den beri **eklenen 402 dosya** ayrıca tarandı (`git diff --name-only --diff-filter=A 41be81e..HEAD`):
JWT, `sb_secret_`, `sb_publishable_`, `sbp_`, `sk-ant-`, `sk-…`, AKIA, AIza, Resend `re_…`, `ghp_`, `xox?-`, `whsec_`,
SendGrid, özel anahtar bloğu → **0**. `(secret|api_key|token|password)\s*[=:]\s*"<16+>"` → 7 eşleşme, hepsi sahte:
`channel-unsubscribe/handler.test.ts:4` (sıfır UUID'nin base64'ü), `iap-verify/c11-client-selection.test.ts:58-74`
(`purchase-token-0123456789`), `docs/release/c09-2026-11-06/harness/run.py:140` ve
`scripts/test-curriculum-pipeline-chain.py:278` (yerel test ortamı için "local" yer tutucusu).
Takip edilen `.env`, `.pem`, `.key`, `.p8`, `.p12`, keystore, servis hesabı JSON'u: **yok** (yalnız iki `.env.example`).

## 3. Storage politikaları ve imzalı adresler (Q03 §2 Storage satırı güncellemesi)

| Kova | Tanım | public | file_size_limit | allowed_mime_types |
|---|---|---|---|---|
| `gina-private-sources` | `20261102130000_learning_sources.sql:3-5` | false | 10.485.760 (10 MiB) | image/png, image/jpeg, application/pdf |
| `gina-curriculum-sources` | `20261106010000_curriculum_source_fetch.sql:4-6` | false | 5.242.880 (5 MiB) | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |

`storage.objects` için migration'larda **hiç** `create policy` yok (grep: 0) → istemci okuma/yazma yok; tüm akış Edge
service role üzerinden. `getPublicUrl` kullanımı yok (apps, packages, functions). `supabase/config.toml` `[storage]`
50 MiB ve `s3_protocol.enabled=true` yalnız yerel geliştirme yığınıdır.

| # | Yer | Çağrı | Süre | Kim tetikler | Durum |
|---|---|---|---|---|---|
| 1 | `supabase/functions/learning-source/handler.ts:73-74` | `createSignedUrl(object_path, 120)` (`gina-private-sources`) | **120 sn** | `action:"view"`: süresi dolmamış JWT'li herhangi bir oturum (veli veya çocuk cihazı); erişim, çağıranın JWT'siyle RLS altında `get_learning_source_access` RPC'sinin satır döndürmesine bağlı | uygun |
| 2 | `supabase/functions/learning-source/handler.ts:115-116` | `createSignedUploadUrl(object_path, { upsert:false })` | **7200 sn** (storage-js 2.118.0 belgesi: "valid for 2 hours"; istemci süre parametresi yok) | `action:"reserve"`: yalnız `parentOrResponse` (canlı üyelik + aktif aile) + `reserve_learning_source` RPC; yüklemeler yalnız `SOURCE_CLEANUP_SECRET` tanımlıyken açık | **> 600 sn → C13-SCAN-2** |
| 3 | `supabase/functions/learning-source/handler.ts:63-70` | kütüphane kopyası için `libraryDataUri` (adres değil, satır içi data URI) | yanıt `expires_in:120` der ama data URI süresizdir | #1 ile aynı | bilgi (C13-SCAN-9 notu) |
| — | `apps/mobile/src/lib/learning-files.ts:199-200` | `uploadToSignedUrl` (tüketici) | #2'nin belirteci | veli uygulaması | — |
| — | `contribution-submit/index.ts:215`, `_shared/library-source.ts:9`, `_shared/prova-document.ts:90`, `learning-source/handler.ts:144` | `download` (service role, sunucu içi) | adres üretmez | ilgili Edge yetkisi | — |
| — | `curriculum-source-fetch/handler.ts:210` | `upload(…, upsert:false)` (service role) | adres üretmez | yalnız `readAdmin` | — |
| — | `_shared/source-cleanup.ts:15` | `remove` | — | zamanlayıcı/silme | — |

## 4. C01–C11'de eklenen/değişen Edge fonksiyonları (Q03 §3 güncellemesi, statik inceleme)

41be81e..HEAD: yeni `channel-unsubscribe/`, `curriculum-source-fetch/runtime-probe.ts`, `_shared/ai-route.ts`,
`_shared/answer-key.ts`, `_shared/channels/fake-smtp.ts`; değişen `content-prereview`, `curriculum-source-fetch`,
`ai-weekly-summary`, `ai-preflight`, `push-send`, `prova-*`, `learning-plan-import`, `setup-suggestions`,
`timetable-import`, `_shared/channels/{email,render}.ts`, `_shared/curriculum-source.ts`. `delete-account` 41be81e'den
beri değişmedi (önizleme belirteci kontrolü daha önce gelmiş); yine de incelendi. `config.toml`'daki tek değişiklik
`[functions.channel-unsubscribe] verify_jwt=false`.

| Fonksiyon | verify_jwt | Kimlik doğrulama | Girdi sınırı | Notlar |
|---|---|---|---|---|
| channel-unsubscribe | **false** (`config.toml:474-475`) | Yetki yalnız imzalı belirteç: biçim `^[A-Za-z0-9_-]{20,200}\.[a-f0-9]{40}$` (`handler.ts:8`); DB'de HMAC-SHA256 (160 bit kesik), süre, tek kullanım, advisory lock (`20261106300000_channel_ui_support.sql:20-46`); RPC yalnız service_role'e açık (`:53-55`) | gövde ≤2048 B akışla (`handler.ts:9,54-83`) | GET/HEAD yan etkisiz (303 sayfaya veya form); `cache-control: no-store`, `referrer-policy: no-referrer`, noindex, form CSP `default-src 'none'` (`handler.ts:22-27,46-52`); hata metinleri sabit kodlar; CORS başlığı yok (gerek yok). C13-SCAN-10 |
| content-prereview | varsayılan **true** (config.toml'da satır yok) | Zamanlayıcı: `x-cron-secret` sabit zamanlı karşılaştırma (`index.ts:7-12,18-21`; uzunluk farkı erken döner); yönetici: `auth.getUser` + anonim reddi + **kullanıcının kendi JWT'siyle** rol kapılı `request_content_prereview` RPC (`index.ts:22-33`); `pilot`/`drain` yalnız sistem (`handler.ts:247-248,254-255`) | **sınırsız `req.json()` kimlikten önce** (`handler.ts:239`) → C13-SCAN-5; pilot ≤12 öğe, drain ≤25 | hata yanıtları sabit/sınıflandırılmış kodlar; `reason` DB'den gelen sabit kodlar |
| curriculum-source-fetch | **true** (`config.toml:469-470`) | `readAdmin`: `getUser` + `gina.admin` iddiası + canlı `public.admins` satırı (`_shared/auth.ts:9-23`); RPC'ler 42501'i ayrıca uygular | gövde ≤4096 B (`handler.ts:79-80`), alan uzunlukları sınırlı | SSRF: yalnız HTTPS, port 443, userinfo reddi, izinli ana bilgisayarlar `*.meb.gov.tr`, `cdn.eba.gov.tr`, `meb.ai` yalnız ara atlama; her atlamada DNS + genel IP kontrolü, manuel yönlendirme ≤5, son adres yeniden kontrol, 2 MiB sayfa / 5 MiB dosya, ZIP yalnız merkezi dizin, MIME izin listesi + `PK` sihirli bayt (`_shared/curriculum-source.ts:16-30,43-111,160-273`); indeks adresi yönetici kayıt defterinden ve `^https://([a-z0-9-]+\.)*meb\.gov\.tr/` (`handler.ts:110`); `link_url` yalnız indeks sayfasındaki bağlantılardan biri olabilir (`handler.ts:157-158`). C13-SCAN-3, C13-SCAN-4 |
| delete-account | **true** (`config.toml:430-431`) | `getUser` + anonim reddi; parola yeniden doğrulama (`signInWithPassword`, ≤1024) veya `amr` içinde ≤300 sn'lik OTP (`handler.ts:21-33`); hedef kimlik istemciden alınmaz | ≤8192 B (`handler.ts:15-16`) | önizleme belirteci UUID + `check_deletion_preview(p_user_id)`; hata kodları sabit; yerel oturum kapatılır |
| ai-weekly-summary | true | `parentOrResponse` (canlı üyelik) | şema doğrulamalı çıktı | sabit `weekly_unavailable` |
| ai-preflight | true | işletmeci belirteci + son kullanma tarihi, sabit zamanlı (`ai-preflight/handler.ts:37-50`) | — | — |
| push-send | **false** | Q03-EDGE-1 düzeltmesi: sabit zamanlı, kısa devresiz (`push-send/auth.ts`); `SUPABASE_SERVICE_ROLE_KEY` hâlâ bearer olarak kabul (`push-send/index.ts:16-21`) | — | C13-SCAN-11 |
| prova-generate/grade/plan, setup-suggestions | true | `parentOrResponse` gövdeden **önce** | `req.json()` sınırsız ama kimlik sonrası; prova-generate `intent` ≤50.000 | bilgi |

Giden `fetch` hedefleri: sabit sağlayıcı adresleri (Anthropic, Gemini, Apple, Google) veya dağıtım ortam değişkenleri
(`OPENAI_BASE_URL` yalnız `https://` ise, `RESEND_ENDPOINT`, `SMS_API_URL`); kullanıcı/yönetici girdisinden adres alan tek
yol curriculum-source-fetch'tir. CORS: `_shared/supabase.ts:11-15` `Access-Control-Allow-Origin: *` (Q03-EDGE-2, bilgi,
değişmedi).

## 5. Canlı kontroller (oturumsuz, salt okunur; toplam 15 HTTP isteği)

`CF_PAGES_PROJECT=gina-backoffice CF_ACCESS_TEAM=gina-family node scripts/check-backoffice-access.mjs` → `ok: true`,
**12/12** 302 Access girişine (ana adres + rastgele `access-check-58cfc309-…` önizleme × `/`, `/sign-in`, `/dashboard`,
`/support`, `/library-publication`, `/brand/logo.png`). Kanıt: `backoffice-access.json`.

`curl -sI` (3 istek; ham çıktı `web-headers-raw.txt`, cf-ray IST):

| Adres | HTTP | CSP | HSTS | X-Frame | COOP | Referrer | Cache-Control | Q03 düzeltmesi canlı mı |
|---|---|---|---|---|---|---|---|---|
| `gina-web.pages.dev/` | 200 (+103 Early Hints) | şablonla aynı (`default-src 'self'`, script hash, Supabase origin, `frame-ancestors 'none'`) | 1 yıl, includeSubDomains | DENY | same-origin | strict-origin-when-cross-origin | `public, max-age=0, must-revalidate` | — |
| `/s/probe` | 200 | aynı | aynı | DENY | aynı | **iki başlık**: strict-origin-when-cross-origin + no-referrer | aynı | **Hayır — Q03-HTTP-2 canlıda sürüyor** |
| `/_expo/static/c13-missing-probe.js` | **200 text/html** | aynı | aynı | DENY | aynı | tek | **`public, max-age=31536000, immutable`** | **Hayır — Q03-HTTP-1 canlıda sürüyor** |

Depodaki düzeltme (`67bfdc1`: `deploy/web/_headers` `{{STATIC_IMMUTABLE_RULES}}` + `/s/*` `! Referrer-Policy`,
`scripts/cf-pages-headers.mjs`) doğru görünüyor; yalnız yeniden yayın bekliyor → C13-SCAN-6.

Backoffice başlıkları (`deploy/backoffice/_headers`): CSP `default-src 'self'`, `style-src 'self'` (inline yok),
`frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, HSTS, COOP, noindex; `apps/backoffice/next.config.mjs`
`output:"export"`, `poweredByHeader:false`, sunucu başlığı yok. `/_next/static/*` immutable glob'u → C13-SCAN-7.
Access arkasında olduğu için oturumsuz canlı doğrulama mümkün değil (302).

## 6. Bulgular

| Kimlik | Önem | Kanıt | Etki | Önerilen düzeltme | Kalan |
|---|---|---|---|---|---|
| C13-SCAN-1 | düşük | `pnpm-audit-*.json`, `trivy-fs.json`: glob 13.0.6, minimatch 10.2.6 (orta), deepmerge 4.3.1 (düşük) — Q03-DEP-1 ile aynı | Yamalar uygulanmış ve 8/8 test geçiyor; araçlar sürüm numarasına baktığı için uyarı sürer | Değişiklik yok; Expo CLI glob ≥14.0.2 / minimatch ≥11.0.1'e geçince yamaları kaldır | açık/izleniyor (Q03-DEP-1 devam) |
| C13-SCAN-2 | düşük | `learning-source/handler.ts:115-116`; storage-js 2.118.0 `StorageFileApi.ts:336` "valid for 2 hours" | İmzalı yükleme belirteci 7200 sn geçerli (> 600 sn hedefi). Sızarsa sahibinden önce bir kez yükleme yapılabilir. Etkisi sınırlı: `upsert:false` (tek yazım), `finalize` boyut + SHA-256 + biçim denetimi uyuşmazsa kaydı `invalid` yapar ve nesneyi silme kuyruğuna alır; yol rezervasyona özgü; yalnız doğrulanmış veliye döner | Platform süreyi kısaltmaya izin vermiyor. Sunucu tarafında: `finalize` ve rezervasyon için tazelik sınırı (ör. `learning_sources.created_at > now() - interval '15 minutes'`, aksi `source_upload_expired`), `awaiting_upload` temizliğini 24 saatten ~2 saate indirmek | açık (DB/Edge küçük değişiklik) |
| C13-SCAN-3 | düşük | `_shared/curriculum-source.ts:176-196` zamanlayıcı `transport` dönünce `finally`'de temizleniyor; gövde `readBounded` (`:207`) süresiz okunuyor | 15 sn sınırı yalnız başlıklara kadar geçerli; izinli bir MEB sunucusu gövdeyi damla damla gönderirse çağrı platform duvar saati sınırına kadar asılı kalır (yalnız yönetici tetikler, boyut sınırı korunur) | Zamanlayıcıyı gövde okunana kadar tut: `try { response = await transport(...); … const body = await readBounded(response, maxBytes); } finally { clearTimeout(timer); }` — veya tüm `fetchWithPolicy` için tek `AbortSignal.timeout(TIMEOUT_MS)` | açık |
| C13-SCAN-4 | bilgi | `_shared/curriculum-source.ts:43-48,51-77,97-110` | (a) DNS kontrolü ile `fetch` ayrı çözümleme yapar (rebinding penceresi); (b) izinli adlar `endsWith` ile tüm alt alan adlarını kabul eder; (c) IPv6'da `64:ff9b::/96` (NAT64), `2001:db8::/32`, `100::/64` reddedilmiyor. Sömürü MEB DNS denetimi gerektirir | (c) için üç önek ekle; (b) için mümkünse tam ad listesi (`odsgm.meb.gov.tr`, `meb.gov.tr`, `www.meb.gov.tr`, `cdn.eba.gov.tr`); (a) Deno'da IP'ye bağlanıp SNI ayarlamak pratik değil, kabul edilebilir | kabul/izleniyor |
| C13-SCAN-5 | düşük | `content-prereview/handler.ts:239` `await req.json()` kimlik (`:244`) öncesi; `verify_jwt` varsayılan true herkese açık anon anahtarıyla geçilir | Kimliksiz büyük JSON gövdesi bellek/CPU harcatabilir (platform istek sınırları dışında koruma yok). Diğer AI uçları kimliği gövdeden önce doğruluyor | `const raw = await req.text(); if (raw.length > 262_144) return json({ error: "invalid_input" }, 413); body = JSON.parse(raw);` (pilot 12 öğe için yeterli bir üst sınır) | açık |
| C13-SCAN-6 | düşük | `web-headers-raw.txt`: `/_expo/static/<yok>.js` → 200 text/html + immutable; `/s/probe` iki Referrer-Policy | Q03-HTTP-1/2 düzeltmesi (`67bfdc1`) depoda, canlıda değil | `gina-web` yeniden yayını (`cf-pages-finalize` + `cf-pages-headers`) sonrası aynı 3 `curl -sI` | yayın bekliyor |
| C13-SCAN-7 | bilgi | `deploy/backoffice/_headers` `/_next/static/*` immutable; ana checkout'taki son derleme `apps/backoffice/out/404.html` içeriyor | Next statik çıktıda 404.html olduğu için Pages SPA fallback yapmaz: olmayan yol HTML 200 değil 404 döner (Q03-HTTP-1 burada yok). Immutable başlığı 404 yanıtına da eklenirse eksik chunk 404'ü uzun süre önbelleklenebilir; Access arkasında, etkisi kullanılabilirlik | İsteğe bağlı: web ile aynı tam yol kuralı (`scripts/cf-pages-headers.mjs`'yi `/_next/static` öneki ile kullan) | açık; Access nedeniyle canlı doğrulanmadı |
| C13-SCAN-8 | bilgi | `leak-scan.json`: çıkış 1, allowlist dışı 1 yüksek + 11 orta, hepsi yanlış pozitif (§2) | CI adımı bilgi amaçlı; gürültü gerçek bir sızıntıyı gizleyebilir | `ALLOWLIST`'e `google-acknowledge.test.ts|private_key_block`, iki `assigned_secret_literal` test dosyası ekle; `tr_phone` için `555 111 22 33`/`555 000 00 00` sentetik numaraları desen `exclude`'una al | açık (betik değişikliği, bu turda yapılmadı) |
| C13-SCAN-9 | bilgi | Q03 §2 "tek kova" diyordu; `20261106010000_curriculum_source_fetch.sql:4-6` ikinci özel kova; `learning-source/handler.ts:63-70` data URI için `expires_in:120` | Taban çizgisi düzeltmesi; risk yok (özel, 5 MiB, yalnız xlsx, yalnız service role). `expires_in` data URI için anlamsız ama zararsız | Q03 tablosunu iki kova olarak oku | kapalı (belgelendi) |
| C13-SCAN-10 | bilgi | `20261106300000_channel_ui_support.sql:27` `sig<>split_part(...)` metin karşılaştırması; `channel-unsubscribe/handler.ts:101-107` GET'te belirteci sorgu dizesinde sayfaya taşır; `deploy/web/_headers` `/unsubscribe` için özel blok yok | Ağ üzerinden zamanlama saldırısı 160 bit HMAC'te pratik değil. Belirteç yalnız abonelikten çıkma yetkisi taşır; URL'de olduğu için CF/Supabase istek günlüklerine düşebilir. Genel `strict-origin-when-cross-origin` yalnız origin sızdırır. Barındırılan Supabase Edge, GET `text/html` yanıtlarını düz metne çevirebilir; `CHANNEL_UNSUBSCRIBE_PAGE_URL` tanımlı olmalı (canlı doğrulanmadı) | `deploy/web/_headers`'a `/unsubscribe` bloğu: `X-Robots-Tag: noindex, nofollow`, `! Referrer-Policy`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` | açık (küçük) |
| C13-SCAN-11 | bilgi | `push-send/index.ts:16-21` | Q03-EDGE-1'in sabit zamanlı kısmı kapandı; service role anahtarının bu uçta bearer olarak kabulü sözleşme gereği sürüyor | Zamanlayıcı/işletim betikleri `PUSH_SEND_SECRET`'e geçince service role kabulünü kaldır | kısmen kapalı |

## 7. Çalıştırılamayanlar / sınırlar

- Trivy DB'si önbellekten kullanıldı (`--skip-db-update`; DB 2026-11-05 19:01 UTC, bir sonraki güncelleme 2026-11-06 19:01 UTC);
  yeni DB indirilmedi.
- Deno npm denetimi gölge `package-lock` + `npm audit` yerine aynı veri kaynağının toplu duyuru ucuyla yapıldı
  (`scripts/security/c13-deno-npm-audit.mjs`); JSR paketleri için duyuru kaynağı yok.
- Backoffice canlı başlıkları Access nedeniyle okunamadı (oturum açılmadı, bilinçli).
- Edge incelemesi statiktir; hosted Supabase'te `Deno.resolveDns` ve HTML yanıt davranışı canlı denenmedi.
- Storage politikaları migration metninden okundu; hosted veritabanında `pg_policies` sorgulanmadı (üretime erişim yok).

## C13 koordinatör notu (taramalar sonrası)

- **C13-SCAN-3 düzeltildi:** `supabase/functions/_shared/curriculum-source.ts` gövde okuması aynı son tarih sinyaline
  bağlandı (`readBounded(..., signal)`, okuma `Promise.race` ile kesilir, `PolicyError("timeout")`); yeni Deno testi
  "fast headers, stalled body" → `timeout` (`_shared/curriculum-source.test.ts`).
- **C13-SCAN-5 düzeltildi:** `content-prereview/handler.ts` gövdeyi `req.text()` ile okur, `MAX_BODY_CHARS` (256 KiB) üstü
  çağıran kontrolünden önce 400; yeni Deno testi + izole zincirde gerçek Deno sürecine 300 KiB gövde → 400.
- Diğer düşük/bilgi bulguları açık (ayrıntı ana rapor §5).
