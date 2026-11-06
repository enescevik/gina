#!/usr/bin/env bash
# packages/core/src/database.types.ts dosyasını, uygulama/demo DB'sine dokunmadan üretir.
# scripts/test-q02-sql.py ile aynı yöntem: boş `gina_completion_audit` şablonundan benzersiz adlı geçici DB
# klonlanır (supabase_db_gina container'ı), bütün supabase/migrations/*.sql uygulanır, tipler
# `supabase gen types typescript --db-url ... --schema public` ile üretilir, geçici DB her durumda drop edilir.
#
# Kullanım: scripts/gen-db-types-isolated.sh --run-local [--legacy] [--out <dosya>]
#   varsayılan (fresh): şablondaki public/gina şemasını düşür, BÜTÜN migration'ları sıfırdan uygula
#                       (test-q02-sql.py --fresh ile aynı).
#   --legacy : test-q02-sql.py varsayılanı gibi şablondaki hazır şemayı koru, yalnız >= 20261103093000 uygula.
#   --out    : çıktı dosyası (varsayılan packages/core/src/database.types.ts)
# Yerel uygulama DB'si (postgres) için `db reset` YAPMAZ; `pnpm db:types` kullanmaz; üretime bağlanmaz.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER=supabase_db_gina
TEMPLATE=gina_completion_audit
OUT="$ROOT/packages/core/src/database.types.ts"
FRESH=1
RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --run-local) RUN=1 ;;
    --legacy) FRESH=0 ;;
    --out) OUT="$2"; shift ;;
    *) echo "bilinmeyen argüman: $1" >&2; exit 2 ;;
  esac
  shift
done
[ "$RUN" = 1 ] || { echo "Açık --run-local gerekli" >&2; exit 2; }

DB="gina_dbtypes_$(od -An -N5 -tx1 /dev/urandom | tr -d ' \n')_audit"
CREATED=0

psql_as() { # $1=rol $2=db ; stdin=sql
  docker exec -i "$CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U "$1" -d "$2"
}
cleanup() {
  if [ "$CREATED" = 1 ]; then
    echo "drop database $DB with (force);" | psql_as supabase_admin postgres >/dev/null \
      && echo "geçici DB silindi: $DB" >&2 || echo "UYARI: $DB drop edilemedi" >&2
  fi
}
trap cleanup EXIT

# Şablon boş olmalı (test-q02-sql.py ile aynı koruma).
EMPTY="$(echo 'begin read only; select count(*) from public.families; select count(*) from auth.users; commit;' | psql_as supabase_admin "$TEMPLATE")"
[ "$EMPTY" = "$(printf '0\n0')" ] || { echo "Şablon $TEMPLATE boş değil; durduruldu" >&2; exit 1; }

echo "create database $DB owner postgres template $TEMPLATE;" | psql_as supabase_admin postgres
CREATED=1
echo "grant references on auth.users to postgres; create publication supabase_realtime;" | psql_as supabase_admin "$DB"

if [ "$FRESH" = 1 ]; then
  psql_as supabase_admin "$DB" <<'SQL'
drop schema public cascade; drop schema if exists gina cascade; create schema public authorization postgres;
grant usage, create on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
drop publication if exists supabase_realtime; create publication supabase_realtime;
SQL
fi

COUNT=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if [ "$FRESH" = 0 ] && [[ "$name" < "20261103093000" ]]; then
    { grep -i '^alter publication supabase_realtime add table ' "$f" || true; } | psql_as postgres "$DB" >/dev/null
  else
    psql_as postgres "$DB" < "$f" >/dev/null || { echo "Migration başarısız: $name" >&2; exit 1; }
  fi
  COUNT=$((COUNT + 1))
done
echo "uygulanan migration: $COUNT (fresh=$FRESH) db=$DB" >&2

TMP="$(mktemp)"
if ! (cd "$ROOT" && pnpm exec supabase gen types typescript \
    --db-url "postgresql://postgres:postgres@127.0.0.1:54322/$DB" --schema public) > "$TMP"; then
  rm -f "$TMP"; echo "gen types başarısız" >&2; exit 1
fi
[ -s "$TMP" ] || { rm -f "$TMP"; echo "Boş çıktı" >&2; exit 1; }
mv "$TMP" "$OUT"
echo "yazıldı: $OUT ($(wc -l < "$OUT" | tr -d ' ') satır)" >&2
