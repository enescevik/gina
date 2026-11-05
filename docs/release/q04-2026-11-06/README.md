# Q04 — Yayın otomasyonu ve izleme (gece çalışması, 6 Kasım 2026)

Kaynak: main `35c1978` üzerine ayrı worktree dalı `worktree-agent-a237c13ad09b70028`. Çalışma 23:50–00:30
Europe/Istanbul. **Hiçbir yayın yapılmadı; Cloudflare/EAS/Apple/Supabase'e yazılmadı; GitHub secret/variable
oluşturulmadı; main'e push edilmedi.** Üretilen her şey yerelde dry-run ve birim testleriyle doğrulandı; gerçek
çalıştırma (`--execute`) hiç denenmedi.

## Ne eklendi

| Dosya | İçerik |
|---|---|
| `scripts/release-local.mjs` | Yerel yayın yolu tek script. Alt komutlar: `migrations:plan`, `migrations:apply`, `web`, `backoffice`, `ios:build`, `ios:submit`, `tablet:build`, `tablet:publish`, `verify`. **Dry-run varsayılan**, `--execute` ile gerçek. Her planda: kaynak commit + temiz çalışma ağacı, `public-build-env.mjs` ile public anahtar doğrulaması (service_role/`sb_secret_`/yerel URL reddi), `app.json`/`eas.json`/EAS uzaktaki build eşlemesi, yayın sonrası doğrulama (web/backoffice canlı SHA-256 dosya dosya; backoffice Access kapısı önce/sonra; tablet önizleme→alias `release.json`/manifest/IPA hash/sayfa sürümü; TestFlight statik kontrol + `eas submit:list`). Secret'lar env/`--env-file`'dan okunur; çıktıda yalnız adlar. R01 gecesinde elle yapılan adımlar (Management API ile migration tek işlem + `schema_migrations` kaydı; `build-web.mjs` + `wrangler pages deploy` + iki adreste hash; yerel `eas build --local` + `eas submit`; tablet kurulum klasörü → EAS Hosting önizleme → hash → yalnız `tablet` alias, `--prod` yok) birebir adımlandı. |
| `scripts/release-local.test.mjs` | 12 test: argüman doğrulama, env dosyası/öncelik/sır yazmama, proje ref türetme, kaynak durumu, sürüm eşlemesi (remote dışı kaynak ve `autoIncrement` tablet engeli), migration fark/sıra dışı/tek işlem SQL (dolar etiketi çakışması dahil), **sahte sunucuyla canlı hash karşılaştırması** (eşleşme, fark, 404, yeniden deneme sayısı, kök yol eşlemesi), wrangler çıktısından dağıtım URL'si, tablet kurulum klasörü + canlı doğrulama (bozulmuş IPA, eski sürüm reddi), Info.plist denetimi, plan sırası/`--prod` yokluğu/argv'de secret yokluğu, CLI dry-run ve `--execute`'ta service_role reddi. |
| `scripts/health-check.mjs` (+ `.test.mjs`, 8 test) | Web kökü (200 + CSP/nosniff/XFO/Referrer-Policy, `script-src`'de `unsafe-inline` yok, çerez yok), backoffice Access kapısı (mevcut `check-backoffice-access.mjs` ile 12 yol), Supabase REST (`/rest/v1/` anon) ve Auth health (sürüm alanı), Edge fonksiyon listesi/sürüm/durum (yalnız `SUPABASE_ACCESS_TOKEN` varsa; yoksa **ATLANDI**, `--strict` ile hata), tablet alias `release.json` (beklenen build ile karşılaştırma). JSON çıktı, `fail` → çıkış 1. Kişisel veri okunmaz; secret istek atılmadan reddedilir. |
| `scripts/rollback.mjs` (+ `.test.mjs`, 3 test) | Dry-run iskeleti: `web|backoffice --to <pages-uuid>` (Pages API rollback + canlı hash + health-check; backoffice'te Access), `tablet --to <eas-hosting-id>` (`eas deploy:alias --alias tablet --id …`, `--prod` yok, önceki kayıt doğrulaması), `db --name <slug>` (geri alma migration'ı yok → **ileri düzeltme** şablonu, izole pgTAP, `migrations:apply`). |
| `scripts/release-summary.mjs` (+ `.test.mjs`, 3 test) | GitHub Actions iş özeti: `mapping` (commit/ref/run/Node/`app.json` sürümü/secret **adlarının** varlığı) ve `result` (`READY!=true` → **«YAYIN YAPILMADI — atlanan iş başarı sayılmaz»**; başarılı iş ama dağıtım URL'si yok → **«YAYIN DOĞRULANAMADI»** çıkış 1; URL varsa «YAYIN YAPILDI» + hash/sağlık/Access sonuçları). |
| `.github/workflows/deploy-web.yml` | Yeni adımlar: yayın eşlemesi (`if: always()`), `id: deploy`, **canlı hash doğrulaması** (`release-local.mjs verify --target web --execute --deployment-url …`), **sağlık kontrolü** (`continue-on-error`), **yayın sonucu özeti** (`if: always()`). Secret yokken atlama davranışı değişmedi (`deploy-preflight.mjs`). Path tetikleyicilerine yeni scriptler eklendi. |
| `.github/workflows/deploy-backoffice.yml` | Yayın eşlemesi, `id: deploy`, yayın sonrası Access denetimi artık **gerçek dağıtım URL'si** ile (`CF_PREVIEW_ORIGIN`), yayın sonucu özeti. |
| `.github/workflows/ci.yml` | Yeni dört test dosyası `node --test` satırına eklendi. |
| `scripts/check-backoffice-access.mjs` | Tek satır: boş `CF_PREVIEW_ORIGIN` «yok» sayılır (CI'da boş çıktı rastgele önizleme adına düşer); doğrulama mantığı değişmedi, 10 mevcut testi geçiyor. |
| `docs/DEPLOY.md` | §3 secret tablosu en az yetki kapsamıyla güncellendi (CF Pages Edit token, account id, public URL/anon key; `service_role` ve Management token yasağı; «hiçbiri eklenmedi»), workflow davranışı; yeni §7 yerel yayın yolu, §8 sağlık/alarm/geri dönüş planı. |
| `docs/release/TESTFLIGHT.md` | iOS/tablet için `release-local.mjs` işaretçisi. |

Uygulama kodu ve migration değiştirilmedi. `newArchEnabled` temizliği zaten main'de yapılmış
(`app.json`'da yok; `YAYIN-KURULUM-REHBERI.md`: Expo Doctor 20/20); `ios:build` planına Expo Doctor
isteğe bağlı adım olarak eklendi, bu gece çalıştırılmadı (worktree'de `node_modules` yok).

## Dry-run örnek çıktıları (gerçek, bu dal `b6d9744` üzerinde)

`node scripts/release-local.mjs web`:

```
release-local web — DRY-RUN (hiçbir komut çalışmadı, ağ isteği atılmadı)
kaynak: b6d97447ec2a47b1a40171f0a78b0b71a40fab9d (worktree-agent-a237c13ad09b70028) temiz
  OK  app.json sürümü 0.1.0
  OK  bundle kimliği beklenen
  OK  EAS proje kimliği beklenen
  OK  sürüm kaynağı remote (build numarası EAS’te)
  OK  tablet profili production’dan türer, internal, autoIncrement kapalı
  OK  production profili store dağıtımına uygun
  BEKLİYOR  EAS uzaktaki build numarası dry-run’da okunmaz (eas build:version:get)
 1. [check] Kaynak commit ve temiz çalışma ağacı kontrolü
      b6d9744 @ worktree-agent-a237c13ad09b70028; dirty=0
 2. [check] EXPO_PUBLIC_SUPABASE_URL/ANON_KEY public doğrulaması (service_role / yerel URL reddedilir)
      env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY  (yalnız adlar; değer yazılmaz)
 3. [shell] Bağımlılıklar (frozen lockfile)
      $ pnpm install --frozen-lockfile
 4. [shell] Typecheck/lint
      $ pnpm turbo run typecheck --filter=@gina/mobile...
 5. [shell] Derleme → apps/mobile/dist (+ _headers/_redirects, CSP özetleri)
      $ node scripts/build-web.mjs
      env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY  (yalnız adlar; değer yazılmaz)
 6. [check] Yerel çıktı özetleri (.js, .html, .css)
      apps/mobile/dist
 7. [shell] wrangler pages deploy apps/mobile/dist → gina-web (branch main)
      $ pnpm exec wrangler pages deploy apps/mobile/dist --project-name=gina-web --branch=main --commit-dirty=true
      env: CLOUDFLARE_API_TOKEN?, CLOUDFLARE_ACCOUNT_ID?  (yalnız adlar; değer yazılmaz)
      not: Oturum: yerel wrangler login veya env token. Çıktıdan dağıtım URL’si okunur.
 8. [http] Canlı hash karşılaştırması: https://gina-web.pages.dev + dağıtım URL’si (tüm JS/HTML/CSS)
      https://gina-web.pages.dev
 9. [check] Yayın kaydı (commit, dağıtım URL’si, dosya sayısı, eşleşme) → stdout JSON
env mevcut: EXPO_PUBLIC_SUPABASE_URL=yok, EXPO_PUBLIC_SUPABASE_ANON_KEY=yok, SUPABASE_ACCESS_TOKEN=yok, CLOUDFLARE_API_TOKEN=yok, CLOUDFLARE_ACCOUNT_ID=yok

DRY-RUN tamam. Gerçek yayın için --execute ekle; bu çıktı yayın kanıtı DEĞİLDİR.
```

`node scripts/release-local.mjs migrations:apply` (plan adımları):

```
 1. [check] Kaynak commit ve temiz çalışma ağacı kontrolü
 2. [http] Üretimde uygulanmış migration listesi (Management API, salt okunur sorgu)
      env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF|*_PUBLIC_SUPABASE_URL  (yalnız adlar; değer yazılmaz)
      select version, name from supabase_migrations.schema_migrations order by version
 3. [check] Yerel supabase/migrations ile fark: bekleyenler, yalnız uzakta olanlar, sıra dışı olanlar
      108 yerel dosya; son yerel 20261105190000
 4. [check] Uygulama öncesi kayıt: schema_migrations listesi + bekleyen migration SQL özetleri → --install-dir/migrations-pre.json
 5. [http] Her bekleyen migration tek işlemde (begin; SQL; schema_migrations insert; commit) sırayla
      not: Biri başarısız olursa dur; sonrakiler uygulanmaz. Geri alma migration’ı yoktur: ileri düzeltme ilkesi (docs/DEPLOY.md).
 6. [http] Uygulama sonrası schema_migrations yeniden okunur; bekleyen listesi boş olmalı
```

`node scripts/release-local.mjs tablet:publish` (plan adımları):

```
 2. [check] IPA sürüm/build ve SHA-256 okunur
 3. [http] Canlı alias release.json önceki kayıt olarak saklanır (https://gina-aile-enescevik--tablet.expo.app/release.json)
 4. [check] Kurulum klasörü: index.html, manifest-N.plist, gina-N.ipa, icon.png, release.json → …/tablet-publish
 5. [shell] EAS Hosting önizleme dağıtımı (alias YOK, --prod YOK)
      $ (cd apps/mobile) eas deploy --export-dir ../../.codex-setup/release-local/tablet-publish --environment production --non-interactive --json
 6. [http] Önizleme: release.json/manifest/IPA hash/sayfa sürümü yerel paketle aynı
 7. [shell] Yalnız `tablet` alias’ı yeni dağıtıma bağlanır (--prod YOK)
      $ (cd apps/mobile) eas deploy:alias --alias tablet --id <önizleme dağıtım kimliği> --non-interactive
 8. [http] Canlı alias: https://gina-aile-enescevik--tablet.expo.app release.json/manifest/IPA hash tekrar doğrulanır
 9. [check] Yayın kaydı: dağıtım kimliği, önceki dağıtım kimliği, hash, bayt → --install-dir/package.json
```

`node scripts/rollback.mjs web --to 8b9132a2-ba72-4469-a2a9-248231515537`:

```
rollback web → 8b9132a2-ba72-4469-a2a9-248231515537 — DRY-RUN (hiçbir komut/API çağrısı yapılmadı)
1. [shell] Mevcut dağıtımları listele (hedef kimlik listede olmalı)
     $ pnpm exec wrangler pages deployment list --project-name=gina-web
2. [http] Pages üretim dağıtımını 8b9132a2-ba72-4469-a2a9-248231515537 kimliğine geri al
     POST https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/pages/projects/gina-web/deployments/8b9132a2-…/rollback
     env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (yalnız adlar)
3. [shell] Geri dönüş sonrası doğrulama: canlı hash (web)
     $ node scripts/release-local.mjs verify --target web --execute
4. [shell] Sağlık kontrolü
     $ node scripts/health-check.mjs --pretty
```

`node scripts/rollback.mjs tablet --to sbfnt5ls4x` → `eas deploy:alias --alias tablet --id sbfnt5ls4x --non-interactive`
ve `verify --target tablet --expected-build/--expected-sha256` adımları; `--prod` yok.

`health-check.mjs` bu gece **canlıya karşı çalıştırılmadı** (ağ isteği atılmaması kuralı); yalnız sahte
sunucuyla 8 birim testi. Hesap sahibi ilk gerçek çalıştırmayı yapıp çıktıyı `health.json` olarak saklar.

## Test çıktısı (gerçek)

`node --test scripts/*.test.mjs` — dal `b6d9744`, Node v22.22.2:

```
# tests 91
# pass 91
# fail 0
# skipped 0
```

Dağılım: mevcut testler (check-answer-recovery, check-backoffice-access, check-native-text,
check-notebook-layout, check-projection-refresh, check-realtime-readiness, check-testflight,
check-toolchain-security, deploy-preflight, prepare-tablet-install, public-build-env) + yeni
`release-local` 12, `health-check` 8, `rollback` 3, `release-summary` 3. Yeni testler sahte `fetch`
ile çalışır; hiçbiri ağa çıkmaz, hiçbiri gerçek secret okumaz.

Bulunan ve belgelenen tuhaflık: Node 22, `--env-file` bayrağını script argümanı olduğunda da kendisi
işler. Dosya yoksa Node 9 ile düşer (mesajda yalnız dosya yolu; sır sızmaz), varsa env'e yükler ve
script de aynı dosyayı okur; shell değişkenleri önceliklidir. Mevcut `check-testflight.mjs
--env-file` de aynı davranışı gösterir (kod değiştirilmedi, DEPLOY.md §7'de not).

## Hesap sahibinin yapacağı adımlar

1. **GitHub secret'ları** (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN`
   (yalnız *Account → Cloudflare Pages → Edit*), `CLOUDFLARE_ACCOUNT_ID`, `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   `service_role`, `sb_secret_`, Management token, Apple/EAS kimlikleri **eklenmez**. Tam tablo ve
   kapsam: `docs/DEPLOY.md §3`.
2. Secret'lar eklendikten sonra **Run workflow** ile *Deploy web*'i bir kez elle tetikle; iş özetinde
   «YAYIN YAPILDI — web: https://<id>.gina-web.pages.dev», «canlı hash doğrulaması: success» ve
   sağlık kontrolü satırını gör. *Deploy backoffice* için Access kapısı adımlarının (önce/sonra) yeşil
   olduğunu gör. **Bu kanıt görülmeden «otomatik yayın çalışıyor» denmez**; bugünkü durum: secret yok,
   iş atlanır, özet «YAYIN YAPILMADI» der.
3. Yerel yayın yolunu ilk kez **salt okunur** komutla dene: `node scripts/release-local.mjs verify
   --target tablet --expected-build 27 --expected-sha256 12cb54eedfe6e7b3a1d060a10078819ae8a0012367274946ea310fd381d0eeb0 --execute`
   ve `node scripts/health-check.mjs --pretty --expected-tablet-build 27` (public URL/anon key env'de).
   Çıktıyı `docs/release/q04-2026-11-06/` altına JSON olarak koy.
4. Bir sonraki gerçek yayında (`R02` veya ara TestFlight) adımları elle değil `release-local.mjs
   <komut> --execute` ile yap; ilk gerçek çalıştırmada çıkan sapmaları (örn. `eas deploy --json`
   çıktı biçimi, `eas build:version:get` metni, wrangler-action `deployment-url` çıktısı) bu klasöre
   not et ve scripti düzelt.
5. `docs/CLAUDE-REMAINING-WORK.md` Q04 kutusu **kapatılmaz**: kabul ölçütü «otomatik yayın
   çalıştığı gerçek kanıtla gösterilir» henüz sağlanmadı (secret yok). Bu gece kapanan kısımlar:
   yerel yol tek script, sağlık kontrolü, eşleme/özet adımları, alarm/rollback planı, testler.

## Kalan sınır — yapılmadı / doğrulanamadı

- **Gerçek çalıştırma yok.** `--execute` yolları (Management API sorgusu, wrangler/eas komutları,
  IPA denetimi `unzip`/`plutil`, EAS Hosting çıktı ayrıştırması) gerçek servislerle test edilmedi;
  dış komut çıktı biçimleri yarın ilk gerçek koşuda sapma gösterebilir. Birim testleri yalnız
  mantığı (argüman, env reddi, hash karşılaştırma, plan sırası) kanıtlar.
- **Otomatik yayın kanıtı yok.** GitHub secret'ları eklenmedi; workflow'lar yine atlar. Yeni
  adımların (`verify --execute`, `release-summary result`) CI üzerinde çalışması bu dal main'e
  alınıp bir *Deploy* işi koştuğunda görülür. YAML geçerliliği yerel ayrıştırıcıyla kontrol edildi;
  `wrangler-action@v3` `deployment-url` çıktısının varlığı belgeye göre varsayıldı, görülmedi.
- **Backoffice canlı hash** oturumsuz okunamaz (Access 302); yalnız Access kapısı denetlenir, dosya
  içeriği yetkili oturumla ayrıca karşılaştırılmalı.
- **Edge fonksiyon listesi** Management token olmadan ATLANIR; health-check bunu açık yazar.
- **Migration veri anlık görüntüsü**: `migrations:apply` yalnız `schema_migrations` kaydını saklar;
  etkilenen tabloların veri yedeği (R01'de elle yapıldı) Supabase yedeği/PITR veya elle sorguya
  bırakıldı. Management API `query` ucunun çok ifadeli `begin … commit` metnini tek işlem olarak
  çalıştırdığı R01 gecesindeki uygulamaya dayanır; otomatik testle doğrulanmadı.
- **Alarm**: üçüncü taraf izleme kurulmadı; öneri yalnız mevcut sağlayıcı bildirimleri + günlük
  `health-check` kaydıdır (DEPLOY.md §8).
- Expo Doctor bu gece çalıştırılmadı (worktree'de bağımlılık yok); `newArchEnabled` kalıntısı
  `app.json`'da yok.
