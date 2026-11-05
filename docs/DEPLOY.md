# Yayına alma (Cloudflare Pages) — Enes'in yapacakları

Veli webi (Expo web export) ve backoffice (statik Next.js) Cloudflare Pages'te barınır; GitHub Actions `main`'e her push'ta derleyip yükler. Hiçbir yayın ayarı yokken otomatik push yayını açık uyarıyla atlanır; bu bir yayın başarısı değildir. **Run workflow ile elle yayın** ve **kısmen kurulmuş ayarlar** eksikse iş hata verir. Güncel kullanıcı adımları: [yayın tamamlama rehberi](release/RELEASE-COMPLETION-2026-11-04.md). `service_role` anahtarı hiçbir istemciye ve hiçbir GitHub secret'ına girmez; iki uygulama da yalnız **anon (public)** anahtarı kullanır.

## 1. Cloudflare hesabı ve Pages projeleri

1. <https://dash.cloudflare.com> → hesap aç (ücretsiz plan yeter).
2. **Workers & Pages → Create → Pages → Direct Upload** ile iki proje oluştur (Git bağlantısı gerekmez, yüklemeyi Actions yapar):
   - `gina-web` (veli webi)
   - `gina-backoffice` (admin)
   GINA projeleri artık mevcut; yeniden oluşturma. Yönetim paneline ilk gerçek
   dosyaları yüklemeden önce aşağıdaki Access korumasını kur ve doğrula.
   Farklı ad kullanırsan GitHub'da **Variables** altına `CF_PAGES_WEB_PROJECT` / `CF_PAGES_BACKOFFICE_PROJECT` ekle.
3. **Account ID**: Workers & Pages sayfasının sağ panelinde (ya da adres çubuğundaki hesap kimliği).

## 2. API token (en az yetki)

**My Profile → API Tokens → Create Token → Custom token**:

- Permissions: **Account → Cloudflare Pages → Edit** (yalnız bu).
- Account Resources: yalnız kendi hesabın.
- TTL: istersen 1 yıl; bitince yenile.

## 3. GitHub secret'ları (6 Kasım 2026 itibarıyla **hiçbiri eklenmedi**)

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Bu adımı yalnız
hesap sahibi yapar (X04); ajanlar secret/variable oluşturmaz. Eksik olanların tam listesi ve
her birinin en az yetki kapsamı:

| Secret | Değer | En az yetki / kapsam | Kullanan |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 2. adımdaki özel token | **Account → Cloudflare Pages → Edit**, yalnız bu hesap; Workers/DNS/Zone yetkisi yok; TTL ≤ 1 yıl | ikisi |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare hesap kimliği (32 hex) | sır değil ama secret olarak tutulur; yalnız bu hesabı adresler | ikisi |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<proje>.supabase.co` | public kök adres; yol/sorgu yok; `localhost`/özel ağ adresi reddedilir | veli webi |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` (veya `sb_publishable_…`) | yalnız RLS arkasındaki anon rolü; `service_role`/`sb_secret_` build adımında **reddedilir** | veli webi |
| `NEXT_PUBLIC_SUPABASE_URL` | aynı URL | aynı | backoffice |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | aynı anon anahtar | aynı | backoffice |

İsteğe bağlı **Variables** (sır değil): `CF_PAGES_WEB_PROJECT`, `CF_PAGES_BACKOFFICE_PROJECT`,
`CF_ACCESS_TEAM` (varsayılanlar `gina-web`, `gina-backoffice`, `gina-family`).

**Yasak:** `service_role`, `sb_secret_…`, Supabase Management API token'ı (`SUPABASE_ACCESS_TOKEN`),
Anthropic/OpenAI anahtarları, Apple/EAS kimlik bilgileri GitHub secret'ı olarak **eklenmez**;
workflow'lar bunları istemez. Migration ve iOS/tablet yayını yerel yoldan yapılır (§7).

Elle tetiklemek için: Actions → *Deploy web* / *Deploy backoffice* → **Run workflow**.

Workflow davranışı (Q04): her çalıştırma iş özetine **yayın eşlemesi** yazar (commit, ref, run,
Node, `app.json` sürümü, hangi secret adlarının tanımlı olduğu — değer değil). Secret yoksa
push yayını hata vermeden atlanır ve özet açıkça **«YAYIN YAPILMADI — atlanan iş başarı
sayılmaz»** der; `Run workflow` ve kısmi yapılandırma hata verir. Yükleme yapılınca web için
yerel `dist` ile `gina-web.pages.dev` + dağıtım URL'si arasında dosya dosya SHA-256 karşılaştırması
(`release-local.mjs verify --target web`) ve `health-check.mjs` koşar; backoffice için Access
kapısı yüklemeden önce ve gerçek dağıtım URL'siyle sonra denetlenir. Dağıtım URL'si olmadan
«başarılı» görünen iş **«YAYIN DOĞRULANAMADI»** ile kırmızıya düşer. **Otomatik yayın, bir
workflow çalıştırmasının özetinde gerçek dağıtım URL'si ve hash eşleşmesi görülmeden
«çalışıyor» diye raporlanmaz.**

## 4. Backoffice'i Cloudflare Access ile kapat

Zero Trust → **Access → Applications → Add → Self-hosted**: alan `gina-backoffice.pages.dev` (ve sonra özel alan adı), politika **Allow → Emails → enescevik@gmail.com** (+ ekip), giriş yöntemi **One-time PIN** (e-posta OTP). Önizleme dağıtımları (`*.gina-backoffice.pages.dev`) için de aynı uygulamaya joker alan ekle. Access ek bir kapıdır; asıl yetki veritabanındadır (RLS + `admin_*` RPC'leri `gina.admin` claim'i ve `admins` tablosunu birlikte kontrol eder).

**5 Kasım 2026:** `gina-family` ekibinde ana adres ve önizlemeler tek Access
uygulamasının iki hedefi olarak korundu; yalnız hesap sahibinin kesin e-postası
izinli. Pages ayarındaki **Restrict previews** tek başına ana adresi korumaz.
İlk yüklemeden önce ve her yüklemeden sonra şu kontrol geçmelidir:

```bash
CF_PAGES_PROJECT=gina-backoffice CF_ACCESS_TEAM=gina-family node scripts/check-backoffice-access.mjs
```

Gerçek dağıtımı ayrıca kontrol etmek için `CF_PREVIEW_ORIGIN` değerini Wrangler'ın
verdiği `https://<deployment>.gina-backoffice.pages.dev` adresine ayarla. Kontrol
oturum kullanmaz, yönlendirmeyi takip etmez, uygulama ve görsel yollarının **tam
olarak doğru ekip girişine** gönderilmesini bekler. 200, ilgisiz yönlendirme,
yalnız 403 veya ağ hatası geçerli koruma kanıtı değildir. İzin listesi ve başarılı
yetkili giriş ayrıca kontrol edilir; bu HTTP kontrolü bunların yerine geçmez.
GitHub workflow'u aynı kontrolü yüklemeden önce ve sonra çalıştırır. GitHub
yayın anahtarı henüz eklenmediğinden mevcut yayın, onaylı yerel Wrangler
oturumuyla yapılmıştır; otomatik yayın kurulduğu iddia edilmez.

Yönetim girişindeki **Şifremi unuttum**, kayıtlı GINA web sıfırlama ekranını yeni
sekmede açar. Şifre GINA web'de yenilenir; sonra yönetim sekmesine dönülür.
Özel web alan adına geçilirse bu bağlantı da güncellenmelidir.

## 5. Supabase tarafı

- **Custom Access Token Hook**: Dashboard → Authentication → Hooks → *Customize Access Token (JWT) Claims* → Postgres function `public.custom_access_token_hook` → Enable. (Yerelde `supabase/config.toml` zaten açık.) Hook kapalıysa `gina` claim'i oluşmaz ve backoffice «yetkisiz» der.
- **Auth → URL Configuration**: Site URL ve Redirect URL'lere `https://gina-web.pages.dev` (sonra özel alan adı) ekle.
- **Admin kullanıcı**: önce backoffice'te kullanacağın e-postayla normal bir Supabase Auth kullanıcısı aç (Dashboard → Authentication → Users → *Add user*, ya da uygulamadan kayıt ol). Sonra SQL Editor'da:

  ```sql
  insert into public.admins (user_id)
  select id from auth.users where email = 'enescevik@gmail.com'
  on conflict do nothing;
  ```

  Yetkiyi almak için: `delete from public.admins where user_id = (select id from auth.users where email = '...');`
  Claim token yenilenince (en geç 1 saat) düşer, ama admin RPC'leri ve politikalar `admins` satırını her istekte kontrol ettiği için yetki **hemen** biter. Yetki verdikten sonra backoffice'te çıkış yapıp yeniden giriş yap (yeni token claim'i taşır).
- Backoffice'te yapılan her komp, AI ayarı ve global soru değişikliği `public.audit_log` tablosuna yazılır (Studio'dan da okunabilir).

## 6. Özel alan adı (sonra)

Alan adı alınınca (ör. `ginaaile.app`) Cloudflare'a ekle (nameserver'ları Cloudflare'a çevir), sonra Pages projesi → **Custom domains**:

- `ginaaile.app` / `app.ginaaile.app` → `gina-web`
- `admin.ginaaile.app` → `gina-backoffice` (Access uygulamasına bu alanı da ekle)

Supabase Auth Redirect URL'lerini ve gerekiyorsa CSP'yi (yalnız Supabase alan adı değişirse) güncelle. Hukuki sayfalar (`/legal/...`) yayınlanınca ASC/Play'e bu alan adıyla girilir.

## 7. Yerel yayın yolu — `scripts/release-local.mjs` (GitHub secret'ı yokken geçerli yol)

6 Kasım 2026 gecesi R01 için elle yapılan adımlar tek scripte alındı. **Varsayılan dry-run**:
komut çalıştırmaz, ağ isteği atmaz, yalnız planı yazar. Gerçek çalıştırma `--execute` ister ve
temiz çalışma ağacı + public anahtar doğrulaması + sürüm eşlemesi geçmeden başlamaz. Secret'lar
shell env'inden veya `--env-file` ile okunur; hiçbir çıktıda değer yazılmaz (yalnız adlar).

```bash
node scripts/release-local.mjs migrations:plan                 # üretimde uygulanmış ↔ yerel fark (Management API, salt okunur)
node scripts/release-local.mjs migrations:apply --execute      # bekleyenleri sırayla, her biri tek işlemde + schema_migrations kaydı
node scripts/release-local.mjs web        --execute            # build-web → wrangler pages deploy → canlı hash (ana + dağıtım URL'si)
node scripts/release-local.mjs backoffice --execute            # Access önce/sonra + build-backoffice → deploy → canlı hash
node scripts/release-local.mjs ios:build  --execute --ipa PATH # eas build:version:get → yerel EAS production build → IPA denetimi
node scripts/release-local.mjs ios:submit --execute --ipa PATH # check-testflight (statik) → eas submit → durum okuma
node scripts/release-local.mjs tablet:build   --execute --ipa PATH --expected-build N
node scripts/release-local.mjs tablet:publish --execute --ipa PATH   # kurulum klasörü → EAS Hosting önizleme → hash → yalnız `tablet` alias → tekrar hash
node scripts/release-local.mjs verify --target all --expected-build N --expected-sha256 HEX --execute
```

Gereken env (adlar): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (web/iOS/tablet),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (backoffice), `SUPABASE_ACCESS_TOKEN`
(+ `SUPABASE_PROJECT_REF` veya public URL'den türetilir; yalnız migration), Cloudflare/EAS için
açık yerel `wrangler login` / `eas login` oturumu veya `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`.
Not: Node 22, `--env-file` bayrağını script argümanı olsa da kendisi de işler; dosya yoksa Node
9 ile düşer (sır sızmaz), varsa env'e yükler ve script de okur; shell değişkenleri önceliklidir.

Kurallar: `service_role`/`sb_secret_`/yerel URL reddedilir (`public-build-env.mjs`); `--execute`
kirli ağaçta durur (`verify` hariç, o salt okunurdur); tablet alias için `--prod` hiç kullanılmaz;
önizleme hash'i doğrulanmadan alias bağlanmaz; IPA'da bundle/sürüm/build `app.json` ve EAS
uzaktaki numarayla eşleşmeden devam edilmez. Dry-run çıktısı yayın kanıtı **değildir**.

## 8. Sağlık kontrolü, alarm ve geri dönüş

`node scripts/health-check.mjs --pretty [--expected-tablet-build N] [--strict]` — kişisel veri
okumaz, oturum kullanmaz: web kökü (200 + CSP/nosniff/XFO/Referrer-Policy, `script-src`'de
`unsafe-inline` yok, çerez yok), backoffice Access kapısı (ana + önizleme, 12 yol), Supabase
REST (`/rest/v1/` anon) ve Auth (`/auth/v1/health`), Edge fonksiyon listesi/sürüm/durum (yalnız
`SUPABASE_ACCESS_TOKEN` varsa; yoksa **ATLANDI** yazar, başarı sayılmaz; `--strict` ile hata),
tablet alias `release.json` sürümü. JSON çıktı; herhangi bir `fail` → çıkış 1.

**İzleme önerisi (kişisel veri içermez):** (1) GitHub Actions'ta *Deploy web/backoffice* ve *CI*
başarısızlığı için e-posta/mobil bildirim açık; iş özetindeki «YAYIN YAPILMADI / BAŞARISIZ /
DOĞRULANAMADI» satırları tek bakışta okunur. (2) Supabase Dashboard → Reports/Usage: DB boyutu,
Edge çağrı ve hata oranı, Auth hataları; ücretsiz plan kota eşiklerinde (DB/Storage/Edge) e-posta
uyarısı. (3) Cloudflare Pages → Deployments: başarısız dağıtım bildirimi; Access → Logs yalnız
giriş başarısı/hatası (e-posta adresi içerir, rapora kopyalanmaz). (4) EAS → Builds/Submissions
e-posta bildirimi; App Store Connect → TestFlight işleme/ret e-postaları. (5) Günlük tek komut:
`health-check.mjs` çıktısı `docs/release/<tarih>/health.json` olarak saklanır (sürüm/durum
alanları; kişisel veri yok). Üçüncü taraf izleme servisi eklenmez; uygulamaya telemetri eklenmez.

**Geri dönüş (`scripts/rollback.mjs`, varsayılan dry-run):**

```bash
node scripts/rollback.mjs web        --to <pages-deployment-uuid> [--execute]   # Pages API rollback → canlı hash + health-check
node scripts/rollback.mjs backoffice --to <pages-deployment-uuid> [--execute]   # + Access kapısı kontrolü
node scripts/rollback.mjs tablet     --to <eas-hosting-deployment-id> [--execute]  # eas deploy:alias --alias tablet --id … (--prod YOK)
node scripts/rollback.mjs db         --name <snake_case> [--execute]            # ileri düzeltme migration iskeleti
```

Pages: önceki dağıtım kimliği `wrangler pages deployment list --project-name …` ile veya
`docs/release/*/release.json` (`deploymentId`) kayıtlarından; alternatif Cloudflare panosu →
Deployments → *Rollback to this deployment*. Tablet: önceki dağıtım kimliği her yayın raporunun
`package.json` `previousDeploymentId` alanında (27 için `sbfnt5ls4x`). **DB:** geri alma
migration'ı yoktur; ilke **ileri düzeltme**: önce etkilenen satırların JSON anlık görüntüsü
(`.codex-setup/`, repoya girmez) ve Supabase yedek/PITR noktası, sonra yeni `…_fix_<ad>.sql`
izole DB'de pgTAP ile denenir ve `release-local.mjs migrations:apply --execute` ile tek işlemde
uygulanır. Üretimde `db reset` çalıştırılmaz; yayımlanmış soru/puan/cevap kanıtı değiştirilmez.

## Yerelde çalıştırma ve deneme

```bash
pnpm db:start                                  # Supabase (Docker)
# backoffice
cp apps/backoffice/.env.example apps/backoffice/.env.local   # anon key'i `supabase status`tan yaz
pnpm --filter @gina/backoffice dev             # http://localhost:3100
# statik çıktı + _headers (Cloudflare'a giden dosyaların aynısı)
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/build-backoffice.mjs
EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... node scripts/build-web.mjs
pnpm exec wrangler pages dev apps/mobile/dist  # _headers/_redirects ile yerel önizleme
```

Yerel admin için: Studio (<http://127.0.0.1:54323>) → SQL Editor'da yukarıdaki `insert into public.admins` sorgusunu kendi yerel kullanıcınla çalıştır.

## Dosyalar

- `.github/workflows/deploy-web.yml`, `.github/workflows/deploy-backoffice.yml`
- `scripts/build-web.mjs`, `scripts/build-backoffice.mjs`, `scripts/cf-pages-finalize.mjs` (CSP'ye Supabase adresini ve satır içi script özetlerini yazar; üçüncü taraf kaynak yok)
- `scripts/release-local.mjs` (yerel yayın yolu, dry-run varsayılan), `scripts/health-check.mjs`, `scripts/rollback.mjs`, `scripts/release-summary.mjs` (Actions iş özeti); testleri `scripts/*.test.mjs`
- `deploy/web/_headers`, `deploy/web/_redirects` (SPA fallback: kökte `404.html` olmadığı için Pages bilinmeyen yolları `index.html`'e düşürür), `deploy/backoffice/_headers`
- `supabase/migrations/20261030120000_backoffice.sql` (`ai_models`, `ai_settings`, `audit_log`, `admin_*` RPC'leri)
