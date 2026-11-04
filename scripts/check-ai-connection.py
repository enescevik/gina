#!/usr/bin/env python3
"""Operator-only production preflight. Keys remain in memory/private temporary files.

Requires the deployed ai-preflight function and an authenticated Supabase CLI.
--smoke performs one bounded paid generation with fixed synthetic input.
No customer data or database rows are read or modified.
"""
import argparse
import datetime
import json
import os
import secrets
import subprocess
import tempfile
import urllib.error
import urllib.request


def cli(*args):
    result = subprocess.run(["pnpm", "exec", "supabase", *args], capture_output=True, text=True)
    if result.returncode:
        # Never echo command output: responses to credential operations can contain secrets.
        raise RuntimeError("supabase_command_failed")
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--document-smoke", action="store_true")
    parser.add_argument("--feature-smoke", action="store_true", help="Four bounded paid calls: weekly summary, learning document, task and reward")
    args = parser.parse_args()
    if len(args.project_ref) != 20 or not args.project_ref.isalpha() or not args.project_ref.islower():
        raise RuntimeError("invalid_project_ref")
    names = {"GINA_PREFLIGHT_TOKEN", "GINA_PREFLIGHT_EXPIRES_AT"}
    existing = json.loads(cli("secrets", "list", "--project-ref", args.project_ref, "--output", "json"))
    if any(row.get("name") in names for row in existing):
        raise RuntimeError("preflight_already_reserved")
    keys = json.loads(cli("projects", "api-keys", "--project-ref", args.project_ref, "--output", "json"))
    key = next((row.get("api_key") for row in keys if row.get("name") == "service_role"), None)
    if not key or not key.startswith("eyJ"):
        raise RuntimeError("legacy_service_credential_unavailable")
    token = secrets.token_urlsafe(48)
    expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)).isoformat()
    report = {"project": args.project_ref, "checks": [], "temporary_access_removed": False}
    try:
        with tempfile.NamedTemporaryFile(mode="w", prefix="gina-preflight-", suffix=".env") as env:
            os.chmod(env.name, 0o600)
            env.write(f"GINA_PREFLIGHT_TOKEN={token}\nGINA_PREFLIGHT_EXPIRES_AT={expires}\n")
            env.flush()
            cli("secrets", "set", "--project-ref", args.project_ref, "--env-file", env.name)
        for mode in ["connection"] + (["smoke"] if args.smoke else []) + (["document-smoke"] if args.document_smoke else []) + (["weekly-smoke", "learning-smoke", "task-smoke", "reward-smoke"] if args.feature_smoke else []):
            request = urllib.request.Request(
                f"https://{args.project_ref}.supabase.co/functions/v1/ai-preflight",
                data=json.dumps({"mode": mode}).encode(),
                headers={"Authorization": f"Bearer {key}", "apikey": key,
                         "x-gina-preflight": token, "Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(request, timeout=140) as response:
                    status, body = response.status, json.load(response)
            except urllib.error.HTTPError as error:
                status, body = error.code, json.load(error)
            allowed = {"check", "connected", "visible_models", "valid", "model", "inputTokens", "outputTokens", "error", "provider_status", "sample"}
            report["checks"].append({"mode": mode, "status": status, **{k: v for k, v in body.items() if k in allowed}})
            if status != 200:
                break  # No automatic retries of a potentially paid generation.
    finally:
        try:
            cli("secrets", "unset", *sorted(names), "--project-ref", args.project_ref, "--yes")
            report["temporary_access_removed"] = True
        finally:
            print(json.dumps(report, ensure_ascii=False))
    return 0 if report["temporary_access_removed"] and all(row["status"] == 200 for row in report["checks"]) and report["checks"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        print(json.dumps({"error": "preflight_failed", "detail": "Sensitive command output intentionally omitted."}))
        raise SystemExit(1)
