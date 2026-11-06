#!/usr/bin/env bash
# H04 acceptance helper: asks PRODUCTION Supabase Auth to send ONE account e-mail to ONE address you own.
#   reset  → password-reset mail (language = that account's saved user_metadata.locale; not this flag)
#   signup → new-account confirmation mail (the new account's locale is set from --locale)
# It never prints tokens or the API response body; it prints the HTTP status and a few safe fields.
# Run by Enes (or the coordinator with his approval) only. Not run by any agent.
#
# Usage:
#   export GINA_SUPABASE_URL=https://<project-ref>.supabase.co
#   export GINA_SUPABASE_ANON_KEY=<public anon/publishable key of that project>
#   scripts/h04-auth-email-trigger.sh reset  you+gina-en1@example.com
#   scripts/h04-auth-email-trigger.sh signup you+gina-en2@example.com --locale en
# Options: --locale en|tr (signup only, default en)   --origin https://ginafamily.com (web app root)
#
# Limits (see docs/release/h04-2026-11-06/README.md):
# - These are implicit-flow links (no PKCE verifier). The confirmation link still confirms the address
#   server-side; then sign in with the password in the app. A script-sent RESET link does not open the
#   app's new-password form on web (the web client is PKCE-only) — use it to check delivery, sender,
#   subject and language; test the click-through from the app's "Forgot password" screen instead.
# - signup for an address that already has an account sends nothing (Supabase hides that); use a new
#   plus-alias. Supabase Auth rate limits apply (Auth → Rate Limits).
set -euo pipefail

die() { echo "error: $*" >&2; exit 2; }
[[ $# -ge 2 ]] || die "usage: $0 reset|signup <email> [--locale en|tr] [--origin https://...]"
action=$1; email=$2; shift 2
locale=en; origin=https://ginafamily.com
while [[ $# -gt 0 ]]; do
  case $1 in
    --locale) locale=${2:-}; shift 2 ;;
    --origin) origin=${2:-}; shift 2 ;;
    *) die "unknown option $1" ;;
  esac
done
[[ $action == reset || $action == signup ]] || die "action must be reset or signup"
[[ $email =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || die "not an e-mail address"
[[ $locale == en || $locale == tr ]] || die "--locale must be en or tr"
[[ $origin =~ ^https://[A-Za-z0-9.-]+$ ]] || die "--origin must be https://host (no path)"
: "${GINA_SUPABASE_URL:?set GINA_SUPABASE_URL}"; : "${GINA_SUPABASE_ANON_KEY:?set GINA_SUPABASE_ANON_KEY}"
[[ $GINA_SUPABASE_URL =~ ^https://[a-z0-9]+\.supabase\.co$ ]] || die "GINA_SUPABASE_URL must be https://<ref>.supabase.co"
command -v curl >/dev/null && command -v python3 >/dev/null || die "needs curl and python3"

if [[ $action == reset ]]; then
  path=/auth/v1/recover; redirect="$origin/reset-password"
else
  path=/auth/v1/signup; redirect="$origin/auth-callback"
fi
echo "About to ask $GINA_SUPABASE_URL to send ONE '$action' e-mail"
echo "  to:          $email"
echo "  redirect_to: $redirect   (must be in Auth → URL Configuration → Redirect URLs)"
[[ $action == signup ]] && echo "  locale:      $locale   (creates a NEW account with this user_metadata.locale)"
read -r -p "Type SEND to continue: " answer
[[ $answer == SEND ]] || die "cancelled, nothing sent"

body=$(mktemp); trap 'rm -f "$body"' EXIT
if [[ $action == signup ]]; then
  read -r -s -p "Password for the new test account (min 8, not reused anywhere): " pw; echo
  read -r -s -p "Repeat: " pw2; echo
  [[ ${#pw} -ge 8 && $pw == "$pw2" ]] || die "passwords empty, short or different"
  payload=$(EMAIL="$email" PW="$pw" LOCALE="$locale" python3 -c 'import json,os;print(json.dumps({"email":os.environ["EMAIL"],"password":os.environ["PW"],"data":{"locale":os.environ["LOCALE"]}}))')
  unset pw pw2
else
  payload=$(EMAIL="$email" python3 -c 'import json,os;print(json.dumps({"email":os.environ["EMAIL"]}))')
fi
enc_redirect=$(R="$redirect" python3 -c 'import os,urllib.parse;print(urllib.parse.quote(os.environ["R"],safe=""))')
sent_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
status=$(printf '%s' "$payload" | curl -sS -o "$body" -w '%{http_code}' -X POST \
  "$GINA_SUPABASE_URL$path?redirect_to=$enc_redirect" \
  -H "apikey: $GINA_SUPABASE_ANON_KEY" -H "content-type: application/json" --data-binary @-)
unset payload
echo "requested_at_utc: $sent_at"
echo "http_status:      $status"
# Safe summary only: no tokens, no user id.
python3 - "$body" "$action" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("response: (not JSON)"); sys.exit(0)
if sys.argv[2] == "signup":
    user = data.get("user", data) if isinstance(data, dict) else {}
    print("confirmation_sent_at:", bool(user.get("confirmation_sent_at")))
    print("email_confirmed:     ", bool(user.get("email_confirmed_at")))
    print("metadata_locale:     ", (user.get("user_metadata") or {}).get("locale"))
    print("session_returned:    ", "access_token" in data, "(true = confirmations are OFF in production: no mail)")
for key in ("error_code", "code", "msg", "error_description"):
    if isinstance(data, dict) and key in data:
        print(f"{key}: {str(data[key])[:160]}")
PY
[[ $status == 200 ]] || exit 1
echo "Now check the inbox: From, Subject/language, SPF/DKIM/DMARC (Show original), link host. Do not forward the link."
