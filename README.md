# Gina Aile

Ebeveynler için aile uygulaması: çocukların günlük görevleri (çocuk işaretler, ebeveyn onaylar, yıldız kazanılır), takvim ve ders programı, notlar, puanlar, gelişim takibi ve haftalık AI özeti. Çocuklar tablette kendi alanlarından, ebeveynler telefondan ve webden kullanır.

## Yapı

```
apps/
  mobile/      Expo SDK 58 — iOS, Android (telefon + tablet) ve web export (veli webi)
  admin/       Next.js statik backoffice (3. hafta)
packages/
  core/        saf TypeScript: tipler, zod şemaları, tekrar kuralı, yıldız hesabı, i18n kaynakları
  api/         Supabase istemci fabrikası, sorgu/mutasyon sarmalayıcıları
  assets/      Codex'in ürettiği SVG varlıklar + manifest
  config/      paylaşılan tsconfig
supabase/
  migrations/  şema, RLS, auth hook, RPC'ler
  tests/       pgTAP testleri
  seed.sql     tatiller ve varsayılan ayarlar
```

## Gereksinimler

- Node 22.13+ ve pnpm 10 (`corepack enable`)
- Docker (yerel Supabase için)
- Xcode 26 + CocoaPods (iOS derlemesi), Android Studio (Android derlemesi)

## Komutlar

```bash
pnpm install
pnpm db:start        # yerel Supabase (Postgres, Auth, Storage)
pnpm db:reset        # migration + seed'i baştan uygula
pnpm db:test         # pgTAP testleri
pnpm db:types        # packages/core/src/database.types.ts üret
pnpm mobile          # Expo dev server
pnpm typecheck && pnpm test && pnpm lint
```

Mobil uygulama için `apps/mobile/.env` dosyasına `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` yazılır (`.env.example` örnektir). `service_role` anahtarı hiçbir istemciye konmaz.

## Kurallar

- Veri erişimi yalnızca RLS üzerinden; yazma işlemleri çoğunlukla RPC ile.
- Çocuk tableti ayrı (anonim) bir Supabase kullanıcısıdır; JWT'deki `gina` claim'i aileyi ve aktif çocuğu taşır. Tablette veli oturumu bulunmaz.
- AI çağrıları yalnız Edge Function'dan yapılır; çocuk adları takma adla gönderilir; çocuklar AI ile doğrudan etkileşmez.
- Üçüncü taraf analitik/reklam SDK'sı eklenmez.
