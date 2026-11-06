#!/usr/bin/env node
// Veli webini Cloudflare Pages için derler: `expo export -p web` (apps/mobile) + _headers/_redirects.
// EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY derleme anında pakete gömülür;
// bu yüzden ikisi de tanımlı olmalıdır. service_role anahtarı burada asla kullanılmaz.
//
// Kullanım (repo kökünden): node scripts/build-web.mjs
// Çıktı: apps/mobile/dist  →  wrangler pages deploy apps/mobile/dist --project-name gina-web

import { cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPublicBuildEnvironment } from "./public-build-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try { assertPublicBuildEnvironment(process.env, "EXPO_PUBLIC_"); }
catch (error) {
  console.error(`build-web: ${error.message}`);
  process.exit(1);
}

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env });

// --clear: Metro önbelleğindeki eski EXPO_PUBLIC_* değerleri pakete sızmasın.
run("pnpm", ["--filter", "@gina/mobile", "exec", "expo", "export", "-p", "web", "--output-dir", "dist", "--clear"]);
cpSync(join(root, "deploy/web/email"), join(root, "apps/mobile/dist/email"), { recursive: true });
run("node", [
  "scripts/cf-pages-finalize.mjs",
  "--out", "apps/mobile/dist",
  "--template", "deploy/web",
  "--supabase-url-env", "EXPO_PUBLIC_SUPABASE_URL",
  "--spa",
  "--remove", "_sitemap.html",
]);
