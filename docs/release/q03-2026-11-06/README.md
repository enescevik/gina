# Q03 — Güvenlik ve geri dönüş tatbikatı (gece çalışması, 5→6 Kasım 2026)

Kaynak: `main` ≥ `de969c1` (çalışma dalı `worktree-agent-a99157d883536a878`). Bu rapor yerel kod/konfigürasyon
denetimi, izole DB'de çalıştırmalı yetki kontrolleri, oturumsuz canlı HTTP başlık kontrolü ve izole ortamda
yedek/geri yükleme tatbikatıdır. **Penetrasyon testi, "açık yok" belgesi veya üretim geri yükleme kanıtı değildir.**
Üretim Supabase'e yazılmadı, üretim reseti yapılmadı, sır değeri okunmadı/yazılmadı. Uygulama kodu ve migration
değiştirilmedi; düzeltmeler öneri olarak `patches/proposed/` altındadır (uygulanmış sayılmaz).

## Özet

| Önem | Adet | Bulgular |
|---|---|---|
| Yüksek | 0 | — |
| Orta | 2 | Q03-BK-1 (yalnız `public`/`gina` dökümü geri yüklenemez), Q03-BK-2 (veri-dökümü hedefteki migration tohum/metadata satırlarıyla çakışır) |
| Düşük | 6 | Q03-DB-1, Q03-DB-2, Q03-HTTP-1, Q03-HTTP-2, Q03-EDGE-1, Q03-DEP-1 |
| Bilgi | 4 | Q03-DB-3, Q03-EDGE-2, Q03-LEAK-1, Q03-DEP-2 |

Olumlu sonuçlar (çalıştırılarak doğrulandı): `anon` 112 public tablonun hiçbirini okuyamıyor; `authenticated` 38 `gina.*`
tablosunun hiçbirini doğrudan okuyamıyor; aile sınırı (B velisi A çocuğunu görmez) tutuyor; iptal edilen cihaz eski JWT ile
satır erişimini anında kaybediyor; 371 security definer fonksiyonun **tamamında** `search_path` sabit; depolama kovası özel,
Storage nesnelerinde hiç istemci politikası yok, görüntüleme URL'si 120 s; Edge girdi sınırları ve cron sırrı sabit-zamanlı
karşılaştırma ile korunuyor; backoffice ana ve rastgele önizleme adresleri 12/12 yolda tam olarak `gina-family` Access
girişine yönleniyor; veli webi CSP/HSTS/X-Frame/COOP başlıkları şablonla aynı; Deno npm bağımlılıklarında 0 bilinen açık;
`pnpm audit` 0 yüksek/kritik; Expo Doctor 20/20.

Üretilen dosyalar (bu klasör): `rls-matrix-fresh.json` (108 migration sıfırdan), `rls-matrix.json` (şablon + son
migration'lar), `rls-matrix.md` (tablo/fonksiyon başına okunabilir matris), `restore-drill.json` (tatbikat çıktısı).
Betikler: `scripts/security/{rls-matrix.py,render-rls-matrix.py,restore-drill.py,leak-scan.mjs}`.

---

## 1. Bağımlılık ve araç zinciri

Komutlar: `pnpm audit --json --prod`, `pnpm audit --json --dev`, `pnpm audit --json` (temiz worktree, `pnpm install
--frozen-lockfile --ignore-scripts` sonrası), Trivy 0.70 `fs --scanners vuln --include-dev-deps`, `deno.lock` npm
girdilerinden üretilen gölge `package-lock` üzerinde `npm audit`, `pnpm dlx expo-doctor`, `node --test
scripts/check-toolchain-security.test.mjs`.

| Kapsam | Araç | Sonuç | Paket / yol | Yama kanıtı |
|---|---|---|---|---|
| prod | pnpm audit | 0 yüksek/kritik, **2 orta** | glob 13.0.6 (`expo>@expo/cli>glob`), minimatch 10.2.6 (`…>glob>minimatch`) | `patches/glob@13.0.6.patch`, `patches/minimatch@10.2.6.patch`; lockfile `patchedDependencies` hash'leri yerinde; kurulumda yeniden uygulandı; davranış testi 8/8 |
| dev | pnpm audit | 0 yüksek/kritik, 1 orta, **1 düşük** | minimatch 10.2.6 (`eslint-config-next>typescript-eslint>…`), deepmerge 4.3.1 (`react-native-svg-transformer>@svgr/plugin-svgo>deepmerge`) | `patches/deepmerge@4.3.1.patch` (proje içi düzeltme; resmî düzeltme yok) |
| tümü | Trivy | 2 orta (CVE-2026-118773 glob, CVE-2026-118764 minimatch), deepmerge görünmez | aynı | aynı |
| Edge (Deno) | npm audit (gölge lock, 15 npm girdisi: supabase-js 2.118.0, pdf-lib 1.17.1, @resvg/resvg-wasm 2.6.2, pako 1.0.11, iceberg-js 0.8.1, tslib) | **0 bulgu** | — | JSR girdileri (`@std/assert`, `@std/internal`) bu taramanın dışında |
| Expo/RN | expo-doctor | **20/20 geçti** | Expo ~58.0.23, expo-router ~58.0.30, RN 0.88.1 | — |
| yamalı davranış | node --test | **8/8 geçti** | glob iptal sonrası gezinme, minimatch desen sınırı, deepmerge prototype | `patches/README.md` |

- **Q03-DEP-1 (düşük, açık/izleniyor):** Üç duyuru `pnpm audit`/Trivy'de görünmeye devam eder; yama sürüm numarasını
  değiştirmediği için araçlar yamalanmış kodu değerlendiremez. Yama kanıtı olmayan uyarı **bastırılmadı**; istisna
  eklenmedi. Kapanış koşulu: Expo CLI'nin glob ≥14.0.2 / minimatch ≥11.0.1'e geçmesi veya deepmerge'de resmî düzeltme.
  Sorumlu: araç zinciri bakımı (X04 ile birlikte). İş kimliği: Q03 → Q04 izleme.
- **Q03-DEP-2 (bilgi):** Önceki raporlardaki "minimatch 3.1.5 geniş aralıkla raporlanıyor" notu artık geçerli değil;
  3.1.5 duyuru aralığında (`>=7.0.0 <11.0.1`) değil. `patches/README.md` notu güncellendi.
- CI (`.github/workflows/security.yml`) yalnız `pnpm audit`'i çalıştırır; yüksek/kritikte durur. Deno npm gölge
  taraması ve Trivy CI'da yok (öneri: `scripts/security/` altına taşınıp haftalık işte çalıştırılabilir; bu raporda
  eklenmedi).

## 2. RLS / Storage / RPC denetimi (izole DB, çalıştırmalı)

Yöntem: `scripts/security/rls-matrix.py --run-local --fresh` boş şablon DB'de `public`/`gina` şemalarını atar,
barındırılan Supabase'in `public` şeması için verdiği varsayılan fonksiyon ayrıcalıklarını (anon/authenticated EXECUTE)
kurar ve **108 migration'ı sıfırdan** uygular; ardından katalogdan matrisi çıkarır ve sentetik iki aile + bir cihazla
yetki senaryolarını gerçekten çalıştırır. İkinci koşu (`--fresh` olmadan) mevcut test şablonu üzerinde yapılır; iki
sonuç karşılaştırılır. DB her koşu sonunda silinir.

Sayılar (fresh): 150 tablo (112 public + 38 gina), 2 görünüm (ikisi de `security_invoker`), 409 fonksiyon
(371 security definer, 237'si authenticated tarafından çağrılabilir, 6'sı anon). Tam matris: [`rls-matrix.md`](rls-matrix.md).

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| anon hiçbir public tabloyu okuyamaz | geçti | 112 tabloda `select count(*)` → permission denied |
| authenticated hiçbir `gina.*` tablosunu doğrudan okuyamaz | geçti | 38 tabloda permission denied; `gina` özel geçmişi yalnız RPC'den |
| Aile sınırı | geçti | B velisi A çocuğunu sayamaz (0), A velisi görür (1) |
| Cihaz iptali (`devices.revoked_at`) | geçti | aktif cihaz 1 çocuk görür → `revoked_at=now()` → aynı JWT ile 0. `gina.is_device()` ve `gina.device_allows()` her politika/RPC'de `revoked_at is null` denetler; `gina.role()='device'` ham kontrolü yalnız `is_device()` içinde |
| Security definer + `search_path` | geçti | 371/371 sabit (`''` veya `public`) |
| Security definer + authenticated + çağıran denetimi (heuristik) | geçti (el ile) | heuristiğin işaretlediği 22 fonksiyon tek tek okundu: `gina.has_operation_role(...)`, `gina.assert_admin()`, `gina.is_parent()`, `gina.school_bag_access()` veya eşleme kodu (`pair_device`) ile korunuyor |
| Doğrudan yazma grant'i + politika yok | **Q03-DB-2** | 17 tabloda 47 grant; izole DB'de `admins`/`devices` insert → RLS reddi (etkin açık değil) |
| RLS kapalı tablo | **Q03-DB-1** | 12 `gina.*` tablosu; grant yok, erişim yalnız RPC |
| anon çalıştırabilen fonksiyon | **Q03-DB-3** | 6: `get_shared_child_view(text)` (öğretmen paylaşımı, bilinçli), `gina.claims/role/family_id/child_id()`, `gina.valid_review_document(jsonb)` (anon'un `gina` şemasında USAGE yetkisi yok → fiilen çağrılamaz) |
| Storage | geçti | tek kova `gina-private-sources` özel, 10 MiB, png/jpeg/pdf; `storage.objects` RLS açık ve **0** politika → istemci okuma/yazma yok; tüm akış Edge'den; `createSignedUrl(…,120)`; yükleme `createSignedUploadUrl(upsert:false)` |

Bulgular:

- **Q03-DB-1 (düşük):** `gina.child_archive_device_blocks, child_archive_state, child_education_changes,
  child_education_periods, child_education_state, note_changes, override_commands, reward_changes,
  school_grade_changes, store_reconcile_jobs, store_replacements, task_routine_changes` RLS kapalı. Etki: bugün
  yok (anon/authenticated tablo yetkisi yok, PostgREST `gina` şemasını sunmuyor); gelecekte yanlışlıkla verilen bir
  grant tüm aileleri açar. Öneri: `patches/proposed/20261106_q03_gina_rls_and_grant_hygiene.sql`. Sorumlu: DB.
- **Q03-DB-2 (düşük):** 17 tabloda politika karşılığı olmayan authenticated yazma grant'leri (ör. `admins`,
  `families`, `devices`, `exam_answers`, `task_completions`). RLS reddediyor; istemcide bu tablolara doğrudan
  `.insert/.update/.delete` çağrısı yok (grep). Öneri: aynı dosyada `revoke`. Sorumlu: DB.
- **Q03-DB-3 (bilgi):** Beş `gina.*` yardımcı fonksiyonu varsayılan ayrıcalıkla anon EXECUTE taşıyor; şema USAGE yok.
  Açık `revoke` öneride.
- **Şablon sapması (bilgi, test altyapısı):** Yerel test şablonu `gina_completion_audit` üzerinde
  `admin_save_contribution_reward`, `admin_set_ai_operation_policy`, `admin_set_library_quota` fonksiyonlarının
  ACL'si **NULL** (= PUBLIC EXECUTE); anon bunları çağırabiliyor ama `gina.assert_admin()` 'forbidden' ile
  durduruyor. Sıfırdan 108 migration uygulanan DB'de ACL doğru (`revoke … from public, anon` + `grant … to
  authenticated`). Yani bu **üretim bulgusu değil**, şablonun döküm/geri yükleme sırasında ACL kaybettiğinin işaretidir
  ve §4'teki "geri yükleme sonrası ACL paritesi" kontrolünün gerekçesidir. Şablonu yenileyen ekip not almalı.

## 3. Edge / HTTP

Okunan kaynaklar: `_shared/{auth,supabase,source-file,library-source,prova}.ts`, `learning-source`, `timetable-import`,
`library-media`, `source-cleanup`, `push-send`, `iap-reconcile`, `iap-operator-reconcile`, `supabase/config.toml`
(`verify_jwt` eşlemesi).

| Konu | Durum | Not |
|---|---|---|
| JWT doğrulama | geçti | `readParent`: `auth.getUser(token)` + canlı `family_members` ve `active_families` kontrolü; anonim kullanıcı reddi; tek uygulama (`prova.ts` yeniden dışa aktarır) |
| `verify_jwt=false` fonksiyonlar | geçti | apple-notifications (Apple JWS), google-rtdn (audience + servis hesabı), iap-reconcile ve source-cleanup (`x-cron-secret`, sabit-zamanlı karşılaştırma), push-send (bearer sır), iap-operator-reconcile (PostgREST RPC üzerinden canlı finans rolü) |
| Girdi sınırları | geçti | gövde ≤4096 B (learning-source, timetable-import), ≤1024 B akış okuması (library-media), UUID regex, enum kontrolü |
| SSRF | geçti | Dosya/URL alan üç fonksiyon kullanıcıdan URL almaz; `fetch` hedefleri sabit sağlayıcı adresleridir (Anthropic, APNs, FCM, Apple/Google API). Yüklenen bayt yalnız biçim doğrulamasından geçer (`inspectSource`: PNG/JPEG başlık-chunk yürüyüşü, PDF ≤5 sayfa, ≤8192 px, ≤16 MP; APNG reddi, şifreli PDF reddi) |
| Hata mesajı sızıntısı | geçti | Tüm cevaplar beyaz listeli kodlar (`/^source_[a-z_]+$/` vb.); ham sağlayıcı/DB hatası, UUID dışı kimlik, çocuk verisi yok; `iap-reconcile` yalnız `store_key` ilk 8 karakterini döner |
| CORS | **Q03-EDGE-2 (bilgi)** | `Access-Control-Allow-Origin: *` tüm fonksiyonlarda. Yetki bearer token'a dayandığı ve çerez kullanılmadığı için CSRF riski yok; token çalınırsa origin kısıtı zaten yardımcı olmaz. Daraltma isteğe bağlı |
| push-send sır karşılaştırması | **Q03-EDGE-1 (düşük)** | `[PUSH_SEND_SECRET, SERVICE_ROLE_KEY].includes(bearer)` sabit-zamanlı değil; ayrıca servis anahtarının bu uçta bearer olarak kabulü sırrın kapsamını genişletir. Öneri: `iap-reconcile` ile aynı `timingSafeEqual`, yalnız `PUSH_SEND_SECRET`. Küçük kod değişikliği; bu turda uygulanmadı (uygulama kodu kapsam dışı) |

Canlı başlıklar (6 Kasım, oturumsuz GET, 7 istek, cf-ray kaydı var):

| Adres | HTTP | CSP | HSTS | X-Frame | COOP | Referrer | Not |
|---|---|---|---|---|---|---|---|
| `gina-web.pages.dev/` | 200 | `default-src 'self'; script-src 'self' 'sha256-…'; connect-src 'self' <supabase> wss://<supabase>; frame-ancestors 'none'; object-src 'none' …` şablonla aynı | 1 yıl, includeSubDomains | DENY | same-origin | strict-origin-when-cross-origin | Permissions-Policy, nosniff mevcut |
| `gina-web.pages.dev/s/probe` | 200 | aynı | aynı | DENY | aynı | **iki başlık**: strict-origin… + no-referrer | X-Robots noindex; Q03-HTTP-2 |
| `gina-web.pages.dev/_expo/static/<yok>.js` | **200 text/html** | aynı | aynı | DENY | aynı | — | `Cache-Control: immutable` ile HTML fallback; Q03-HTTP-1 |
| `gina-backoffice.pages.dev/` ve `/dashboard` | 302 | — | — | — | — | — | `https://gina-family.cloudflareaccess.com/cdn-cgi/access/login/gina-backoffice.pages.dev` (sorgu yazılmadı); `no-store` |

`CF_PAGES_PROJECT=gina-backoffice CF_ACCESS_TEAM=gina-family node scripts/check-backoffice-access.mjs` → `ok: true`,
12/12 (ana adres + rastgele `access-check-<uuid>` önizleme × 6 yol dahil `/brand/logo.png`) tam ekip girişine 302.

- **Q03-HTTP-1 (düşük):** `/_expo/static/*` altında olmayan yol SPA fallback ile `index.html` döner ve genel
  `immutable, max-age=31536000` kuralını alır. Güvenlik etkisi düşük (CSP 'self'); kullanılabilirlik etkisi: eksik/eski
  chunk isteği bir yıl HTML olarak önbelleklenebilir. Öneri: `patches/proposed/web-headers-static-fallback.diff`
  (immutable kuralını gerçek uzantılara daralt). Sorumlu: yayın (Q04).
- **Q03-HTTP-2 (düşük):** `/s/*` için iki `Referrer-Policy` değeri birlikte gönderiliyor; tarayıcı son geçerli değeri
  (no-referrer) uygular, davranış doğru. Öneri aynı diff'te `! Referrer-Policy` ile tekilleştirme.

## 4. Yedek ve geri yükleme planı — izole tatbikat

Bu bölüm `restore-drill.json` ile birlikte okunur; tatbikat ayrıntıları aşağıda (RESTORE-DRILL-SECTION).

## 5. Günlük / rapor sızıntı taraması

`node scripts/security/leak-scan.mjs` — 2.024 metin dosyası (node_modules, .git, dist, ikili dosyalar ve `pnpm-lock.yaml`/`patches/*.patch` hariç);
`.env*` ve anahtar dosyalarının içeriği **açılmadı**, yalnız varlığı not edildi (`apps/backoffice/.env.example`,
`apps/mobile/.env.example`). Desenler: JWT, `sb_secret_`, `sbp_`, `sk-ant-`, AWS, Google API, özel anahtar bloğu,
atanmış sır literal'i, iOS UDID (8-16), TR telefon, yer tutucu dışı e-posta, 64-hex (belge/JSON içinde, hash bağlamı hariç),
Supabase proje adresi. Değer yazılmaz; yalnız dosya:satır.

| Desen | Adet | Değerlendirme |
|---|---|---|
| `supabase_secret_key` | 1 — `scripts/check-testflight.test.mjs:24` | yanlış pozitif: test, önek adını yer tutucu olarak içeriyor |
| `private_key_block` | 1 — `supabase/functions/push-send/providers.test.ts:18` | yanlış pozitif: test çalışırken ürettiği geçici anahtarı sarar |
| JWT / sbp_ / sk-ant / AWS / Google / atanmış sır | 0 | — |
| iOS UDID / TR telefon | 0 | — |
| e-posta (yer tutucu dışı) | 4 | hesap sahibinin Access izin listesi e-postası: `docs/DEPLOY.md` (2), `docs/release/RELEASE-COMPLETION-2026-11-04.md`, `docs/release/FAMILY-EXPERIENCE-13.md`; belgeleme amacıyla bilinçli (Q03-LEAK-1). Ek: `docs/IAP.md` Google servis hesabı **örnek** biçimi; sentetik `@test.local` adresleri hariç tutuldu |
| 64-hex | 5 — `supabase/functions/prova-review/assets/provenance.json:15-19` | varlık dosyası SHA-256 kayıtları (hash bağlamı); cihaz token'ı değil |
| Supabase proje adresi | 4 — `docs/release/{FAMILY-EXPERIENCE-13,YAYIN-KURULUM-REHBERI}.md` | zaten canlı CSP başlığında herkese açık; sır değil |

- **Q03-LEAK-1 (bilgi):** Repo belgelerinde hesap sahibinin e-postası geçiyor (Access izin listesi talimatı). Kişisel
  veri olduğu için ileride `<hesap-sahibi-e-postası>` yer tutucusuna çevrilmesi önerilir; sır değil. Çocuk adı/gerçek
  aile verisi deseni bulunmadı (sentetik "Child A", "Drill child" dışında); bu, ad tabanlı tarama olmadığı için kesin
  kanıt değildir.

## 6. Çözülmeyen bulgular ve gerekçeler

| Kimlik | Önem | Neden bu turda kapanmadı | Sorumlu / iş |
|---|---|---|---|
| Q03-BK-1, Q03-BK-2 | orta | Yedek işletim süreci değişikliği gerektirir (plan §4'te); üretimde deneme yapılmadı | hesap sahibi + DB; Q04/R02 öncesi |
| Q03-DB-1, DB-2, DB-3 | düşük/bilgi | migration değişikliği kapsam dışı; öneri SQL hazır, izole testte doğrulanmadı (tam test paketi koşusu gerekir) | DB; sonraki migration turu |
| Q03-HTTP-1, HTTP-2 | düşük | `deploy/` değişikliği kapsam dışı; önizleme dağıtımında başlık doğrulaması gerekir | yayın (Q04) |
| Q03-EDGE-1 | düşük | Edge kodu kapsam dışı; 5 satırlık değişiklik, `push-send` testleriyle birlikte | Edge; S02 ile |
| Q03-DEP-1 | düşük | üst paket düzeltmesi bekleniyor; yama uygulanmış ve test edilmiş durumda | araç zinciri |

## 7. Sınırlar

- Canlı Supabase üzerinde hiçbir sorgu/çağrı yapılmadı; RLS sonuçları migration'ların izole uygulamasına aittir.
  Üretimde elle yapılmış grant/politika farkı varsa görünmez (öneri: aynı matris sorgusu salt okunur olarak üretimde
  yetkili kişi tarafından çalıştırılıp bu JSON ile karşılaştırılmalı).
- Access kontrolü HTTP yönlendirmesini doğrular; izin listesi içeriği ve başarılı yetkili giriş ayrıca kontrol edilmelidir.
- Storage blob'ları (dosya içerikleri) DB dökümünde yoktur; §4'te açıklanır.
- Üretim yedeğine erişim yoktu; Supabase'in kendi yedek/PITR ayarı bu rapordan doğrulanamadı.
