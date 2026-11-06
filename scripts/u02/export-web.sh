#!/usr/bin/env bash
# Builds the web export against a disposable local fixture (never production).
# Usage: scripts/u02/export-web.sh <fixture.json> <out-dir>
set -euo pipefail
fixture="$1"; out="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
url="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['url'])" "$fixture")"
case "$url" in http://127.0.0.1:*) ;; *) echo "refusing non-local fixture url" >&2; exit 1;; esac
anon="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['anon'])" "$fixture")"
cd "$root/apps/mobile"
EXPO_PUBLIC_SUPABASE_URL="$url" EXPO_PUBLIC_SUPABASE_ANON_KEY="$anon" npx expo export -p web --output-dir "$out" --clear
