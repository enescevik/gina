# Öneri yamaları (uygulanmamış)

Bu klasördeki dosyalar **uygulanmış değildir**; `pnpm` yaması da değildir. Denetimlerin önerdiği küçük,
kesin düzeltmelerdir. Her biri ilgili rapordaki bulgu kimliğine bağlıdır ve uygulanmadan önce izole DB /
önizleme dağıtımında doğrulanmalıdır.

| Dosya | Rapor | Bulgular | Uygulama yolu |
|---|---|---|---|
| `20261106_q03_gina_rls_and_grant_hygiene.sql` | `docs/release/q03-2026-11-06/README.md` | Q03-DB-1, Q03-DB-2, Q03-DB-3 | `supabase/migrations/` altına yeni dosya; `supabase/tests` + `scripts/security/rls-matrix.py --run-local --fresh` yeniden |
| `web-headers-static-fallback.diff` | aynı | Q03-HTTP-1, Q03-HTTP-2 | `deploy/web/_headers`; `scripts/cf-pages-finalize.mjs` ile önizleme dağıtımında başlık kontrolü |
| `post-restore-acl-check.sql` | aynı §4 | Q03-BK-3 | Geri yükleme runbook adımı; salt okunur doğrulama sorgusu üretimde hesap sahibince çalıştırılabilir |

`20261106_q03_gina_rls_and_grant_hygiene.sql` izole DB'de uygulandı: RLS kapalı `gina` tablosu 12→0, politika
karşılığı olmayan yazma grant'i 47→0; tam SQL test paketi 86 dosya / 2.464 kontrol, tek başarısızlık (`083`) öneri
olmadan da aynı (rapor §7). Bu yine de migration olarak uygulanmış sayılmaz.
