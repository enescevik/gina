#!/usr/bin/env node
// Cloudflare Pages çıktısını yayına hazırlar (veli webi ve backoffice ortak).
// - Şablon klasöründeki _headers ve _redirects dosyalarını çıktı klasörüne kopyalar.
// - {{SUPABASE_ORIGIN}}, {{SUPABASE_WS_ORIGIN}} ve {{SCRIPT_HASHES}} yer tutucularını doldurur;
//   SCRIPT_HASHES, HTML'lerdeki satır içi (src'siz, çalıştırılabilir) <script>'lerin sha256 özetleridir.
//   Böylece CSP'de 'unsafe-inline' gerekmez.
// - --spa: kökte 404.html olmadığını doğrular (Pages SPA fallback'i buna bağlıdır).
// - --remove <dosya>: yayına girmemesi gereken dosyaları siler (ör. Expo'nun _sitemap.html'i).
//
// Kullanım:
//   node scripts/cf-pages-finalize.mjs --out apps/mobile/dist --template deploy/web \
//     --supabase-url-env EXPO_PUBLIC_SUPABASE_URL --spa --remove _sitemap.html

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    template: { type: "string" },
    "supabase-url-env": { type: "string", default: "SUPABASE_URL" },
    spa: { type: "boolean", default: false },
    remove: { type: "string", multiple: true, default: [] },
  },
});

function fail(message) {
  console.error(`cf-pages-finalize: ${message}`);
  process.exit(1);
}

if (!values.out || !values.template) fail("--out ve --template zorunlu");
const outDir = values.out;
if (!existsSync(outDir)) fail(`çıktı klasörü yok: ${outDir}`);

const supabaseUrl = process.env[values["supabase-url-env"]];
if (!supabaseUrl) fail(`${values["supabase-url-env"]} ortam değişkeni tanımlı değil`);
let supabase;
try {
  supabase = new URL(supabaseUrl);
} catch {
  fail(`${values["supabase-url-env"]} geçerli bir URL değil`);
}
const supabaseOrigin = supabase.origin;
const supabaseWsOrigin = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;

for (const name of values.remove) {
  const target = join(outDir, name);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`silindi: ${relative(process.cwd(), target)}`);
  }
}

if (values.spa && existsSync(join(outDir, "404.html"))) {
  fail("kökte 404.html var; Cloudflare Pages SPA fallback'i devre dışı kalır");
}

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (entry.endsWith(".html")) yield path;
  }
}

// Çalıştırılabilir satır içi script'ler: src yok, type yok ya da JS/module.
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const executableType = /^(?:|text\/javascript|application\/javascript|module)$/i;
const hashes = new Set();
for (const file of htmlFiles(outDir)) {
  const html = readFileSync(file, "utf8");
  for (const [, attrs, body] of html.matchAll(scriptRe)) {
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] ?? "";
    if (!executableType.test(type)) continue;
    if (body.length === 0) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}
const scriptHashes = [...hashes].sort().join(" ");

for (const name of ["_headers", "_redirects"]) {
  const source = join(values.template, name);
  if (!existsSync(source)) continue;
  const content = readFileSync(source, "utf8")
    .replaceAll("{{SUPABASE_ORIGIN}}", supabaseOrigin)
    .replaceAll("{{SUPABASE_WS_ORIGIN}}", supabaseWsOrigin)
    .replaceAll("{{SCRIPT_HASHES}}", scriptHashes)
    // Özet yoksa "script-src 'self' ;" kalmasın.
    .replaceAll(" ;", ";");
  const tooLong = content.split("\n").find((line) => line.length > 2000);
  if (tooLong) fail(`${name}: 2000 karakteri aşan satır var (Cloudflare sınırı); satır içi script sayısını azaltın`);
  writeFileSync(join(outDir, name), content);
  console.log(`yazıldı: ${relative(process.cwd(), join(outDir, name))}`);
}

console.log(`Supabase: ${supabaseOrigin}; satır içi script özeti: ${hashes.size}`);
