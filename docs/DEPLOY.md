# Yayına alma (Cloudflare Pages) — Enes'in yapacakları

Veli webi (Expo web export) ve backoffice (statik Next.js) Cloudflare Pages'te barınır; GitHub Actions `main`'e her push'ta derleyip yükler. Secret'lar eksikse iş **hata vermeden atlanır** (Actions'ta sarı uyarı görünür). `service_role` anahtarı hiçbir istemciye ve hiçbir GitHub secret'ına girmez; iki uygulama da yalnız **anon (public)** anahtarı kullanır.

## 1. Cloudflare hesabı ve Pages projeleri

1. <https://dash.cloudflare.com> → hesap aç (ücretsiz plan yeter).
2. **Workers & Pages → Create → Pages → Direct Upload** ile iki proje oluştur (Git bağlantısı gerekmez, yüklemeyi Actions yapar):
   - `gina-web` (veli webi)
   - `gina-backoffice` (admin)
   İlk yükleme için boş bir klasör yüklemen istenirse herhangi bir `index.html` yükle; sonrasını Actions yapar.
   Farklı ad kullanırsan GitHub'da **Variables** altına `CF_PAGES_WEB_PROJECT` / `CF_PAGES_BACKOFFICE_PROJECT` ekle.
3. **Account ID**: Workers & Pages sayfasının sağ panelinde (ya da adres çubuğundaki hesap kimliği).

## 2. API token (en az yetki)

**My Profile → API Tokens → Create Token → Custom token**:

- Permissions: **Account → Cloudflare Pages → Edit** (yalnız bu).
- Account Resources: yalnız kendi hesabın.
- TTL: istersen 1 yıl; bitince yenile.

## 3. GitHub secret'ları

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Değer | Kullanan |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 2. adımdaki token | ikisi |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare hesap kimliği | ikisi |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<proje>.supabase.co` | veli webi |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` | veli webi |
| `NEXT_PUBLIC_SUPABASE_URL` | aynı URL | backoffice |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | aynı anon anahtar | backoffice |

`service_role` anahtarını **hiçbir** secret'a koyma.

Elle tetiklemek için: Actions → *Deploy web* / *Deploy backoffice* → **Run workflow**.

## 4. Backoffice'i Cloudflare Access ile kapat

Zero Trust → **Access → Applications → Add → Self-hosted**: alan `gina-backoffice.pages.dev` (ve sonra özel alan adı), politika **Allow → Emails → enescevik@gmail.com** (+ ekip), giriş yöntemi **One-time PIN** (e-posta OTP). Önizleme dağıtımları (`*.gina-backoffice.pages.dev`) için de aynı uygulamaya joker alan ekle. Access ek bir kapıdır; asıl yetki veritabanındadır (RLS + `admin_*` RPC'leri `gina.admin` claim'i ve `admins` tablosunu birlikte kontrol eder).

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
- `deploy/web/_headers`, `deploy/web/_redirects` (SPA fallback: kökte `404.html` olmadığı için Pages bilinmeyen yolları `index.html`'e düşürür), `deploy/backoffice/_headers`
- `supabase/migrations/20261030120000_backoffice.sql` (`ai_models`, `ai_settings`, `audit_log`, `admin_*` RPC'leri)
