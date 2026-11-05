# Veritabanı geri yükleme runbook'u (Q03-BK-1 / BK-2 / BK-3)

Kaynak bulgular ve tatbikat: [`docs/release/q03-2026-11-06/README.md`](../release/q03-2026-11-06/README.md) §4;
düzeltme turu ve betik tatbikatı: [`docs/release/q03-fixes-2026-11-06/README.md`](../release/q03-fixes-2026-11-06/README.md).
Betik: `scripts/restore-database.mjs` (**varsayılan dry-run**). Bu belge üretimde **denenmemiştir**; hosted Supabase'de
süper kullanıcı yoktur, önce Supabase'in kendi yedek/PITR aracı tercih edilmelidir.

## Yedek nedir, ne değildir

- Yalnız `public`/`gina` dökümü **tam yedek değildir**: aile satırları `auth.users`'a FK ile bağlıdır (varyant A tatbikatta
  `families_created_by_fkey` ile başarısız). Veri dökümü **`auth` + `storage` + `public` + `gina`** şemalarını içermeli,
  servis metadata tabloları hariç tutulmalıdır:
  `pg_dump -Fc --data-only -n auth -n storage -n public -n gina --exclude-table-data=auth.schema_migrations --exclude-table-data=storage.migrations`.
- Şema her zaman **migration'lardan** kurulur. Şema dökümünden geri yükleme zorunluysa, döküm boyunca hedefin varsayılan
  fonksiyon ayrıcalığı kaldırılmalı ve sonra geri verilmelidir (Q03-BK-3: aksi halde 260 fonksiyon `anon`'a açılır).
- Storage **içerikleri** hiçbir DB dökümünde yoktur; kova `gina-private-sources` için nesne kopyası ayrıca alınır.
- Parola bağlantı dizesine yazılmaz (`PGPASSWORD` / `~/.pgpass`); betik bağlantı dizesini maskeleyerek yazar.

## Adımlar (betiğin yaptığı sırayla)

| # | Adım | Komut / içerik | Neden |
|---|---|---|---|
| 0 | Dry-run | `node scripts/restore-database.mjs --conn "<conninfo>" --data-dump <veri.dump>` | Planı gör; hiçbir şey çalışmaz |
| 1 | Preflight | sürüm, rol, süper kullanıcı durumu | `replica` modu süper kullanıcı ister |
| 2 | Şema | `supabase/migrations/*.sql` sırayla `psql -v ON_ERROR_STOP=1` (rol `postgres`) — veya `--schema-dump` ile: `alter default privileges … revoke execute on functions from anon, authenticated, service_role` → `pg_restore --no-owner --role=postgres` → `… grant execute …` geri | ACL paritesi (BK-3) |
| 3 | Tohum temizliği | `public`/`gina` tüm tablolar + `storage.objects/buckets` TRUNCATE | Migration tohumları (plans, app_settings, audit_log, bucket) dökümle PK çakışır (BK-2) |
| 4 | Veri | `(echo 'set session_replication_role = replica;'; pg_restore --data-only -f - veri.dump) \| psql -v ON_ERROR_STOP=1` **tek oturum** | Geçmiş yazan tetikleyiciler (`note_audit` vb.) COPY sırasında çalışıp dökümdeki satırlarla çakışır (BK-2); replica modunda tetikleyici+FK denetimi oturum düzeyinde kapalı, kalıcı değişiklik yok |
| 5 | ACL kontrolü | `scripts/security/post-restore-acl-check.sql` → **0 satır**; `proacl is null` tetikleyici dışı fonksiyon 0; `tgenabled='D'` tetikleyici 0 | BK-3 |
| 6 | Doğrulama | 11 tablo sayımı (`--expected-counts kaynak-sayim.json` ile eşitlik), yetim sorguları (aile üyesi↔auth, cihaz↔auth, aile↔created_by, kaynak dosya↔storage.objects, not geçmişi↔not) | BK-1/BK-2 |
| 7 | Uygulama kanıtı (betik dışı) | GoTrue parola girişi 200 ve JWT `gina.family_id` (tatbikatta `restore-drill.py` ile); `scripts/security/rls-matrix.py` matrisi referansla aynı; backoffice Access kontrolü | — |
| 8 | Storage içerikleri | nesneleri kovaya kopyala, `learning_sources.object_path` ile eşle, eşleşmeyeni `invalid`/silme kuyruğuna al | DB dökümü içerik taşımaz |

Gerçek çalıştırma iki kapı ister: `--execute --target-confirm <dbname>` (bağlantıdaki veritabanı adıyla birebir).
Kapsayıcı içindeki psql/pg_restore ile çalışmak için `--exec-prefix "docker exec -i <kapsayıcı>"`; süper kullanıcı için
ayrı `--superuser-conn`. Hosted ortamda süper kullanıcı yoksa `--trigger-mode disable-user` (sahip yetkisiyle
`alter table … disable trigger user`; FK denetimi açık kalır, **tatbikatta denenmedi**) veya Supabase'in geri yükleme aracı.

## Kanıt

- `scripts/security/restore-drill.py --run-local` (6 Kasım, düzeltme turunda **yeniden** koşuldu, 115 migration): A ve B
  beklenen şekilde başarısız; C (replica) ve D (şema dökümü + varsayılan ayrıcalık kaldırma) sayım/ilişki/ACL/tetikleyici
  paritesi eşit, GoTrue girişi 200, JWT doğru — `docs/release/q03-fixes-2026-11-06/restore-drill.json`.
- `scripts/restore-database.mjs --execute` izole tatbikatı: `docs/release/q03-fixes-2026-11-06/restore-database-isolated-run.json`
  (sonuç ve sınırlar düzeltme raporunda).

## Üretim için not

Üretimde çalıştırılmadı. Hesap sahibinin salt okunur `scripts/security/post-restore-acl-check.sql` sorgusunu canlıda
**bir kez** çalıştırması önerilir (geçmişte şema dökümünden geri yükleme yapılmışsa ACL kaybı burada görünür; beklenen 0 satır).
Supabase panelinde günlük yedek/PITR durumu da hesap sahibince doğrulanmalıdır (bu repo'dan görülemez).
