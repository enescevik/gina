# Öneri yamaları (uygulanmamış)

Bu klasördeki dosyalar **uygulanmış değildir**; `pnpm` yaması da değildir. Denetimlerin önerdiği küçük,
kesin düzeltmelerdir. Her biri ilgili rapordaki bulgu kimliğine bağlıdır ve uygulanmadan önce izole DB /
önizleme dağıtımında doğrulanmalıdır.

| Dosya | Rapor | Bulgular | Uygulama yolu |
|---|---|---|---|
| `20261106_q03_gina_rls_and_grant_hygiene.sql` | `docs/release/q03-2026-11-06/README.md` | Q03-DB-1, Q03-DB-2, Q03-DB-3 | `supabase/migrations/` altına yeni dosya; `supabase/tests` + `scripts/security/rls-matrix.py --run-local --fresh` yeniden |
| `web-headers-static-fallback.diff` | aynı | Q03-HTTP-1, Q03-HTTP-2 | `deploy/web/_headers`; `scripts/cf-pages-finalize.mjs` ile önizleme dağıtımında başlık kontrolü |
