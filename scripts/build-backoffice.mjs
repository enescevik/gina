#!/usr/bin/env node
// Backoffice'i Cloudflare Pages için derler: `next build` (output: 'export' → apps/backoffice/out) + _headers.
// Yalnız NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY kullanılır; service_role ASLA.
//
// Kullanım (repo kökünden): node scripts/build-backoffice.mjs
// Çıktı: apps/backoffice/out  →  wrangler pages deploy apps/backoffice/out --project-name gina-backoffice

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPublicBuildEnvironment } from "./public-build-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try { assertPublicBuildEnvironment(process.env, "NEXT_PUBLIC_"); }
catch (error) {
  console.error(`build-backoffice: ${error.message}`);
  process.exit(1);
}

const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit", env });

run("pnpm", ["--filter", "@gina/backoffice", "run", "build"]);
run("node", [
  "scripts/cf-pages-finalize.mjs",
  "--out", "apps/backoffice/out",
  "--template", "deploy/backoffice",
  "--supabase-url-env", "NEXT_PUBLIC_SUPABASE_URL",
]);
