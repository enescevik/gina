// Q03-HTTP-1 / Q03-HTTP-2: _headers üretimi. SPA fallback HTML'i immutable önbelleğe girmez; /s/* tek Referrer-Policy taşır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOUDFLARE_MAX_HEADER_RULES,
  effectiveHeaders,
  listStaticAssets,
  renderHeadersTemplate,
  staticImmutableRules,
  validateHeadersFile,
} from "./cf-pages-headers.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));
const root = join(scripts, "..");
const template = readFileSync(join(root, "deploy/web/_headers"), "utf8");
const REAL = ["/_expo/static/js/web/entry-0123456789abcdef.js", "/_expo/static/css/app-fedcba9876543210.css"];
const MISSING = "/_expo/static/js/web/entry-stalehash.js";

function fakeDist() {
  const dist = mkdtempSync(join(tmpdir(), "gina-headers-"));
  for (const path of REAL) {
    mkdirSync(join(dist, dirname(path)), { recursive: true });
    writeFileSync(join(dist, path), "/* asset */");
  }
  writeFileSync(join(dist, "index.html"), "<!doctype html><html><head><script>window.__x=1</script></head><body></body></html>");
  return dist;
}

function render(dist) {
  const rules = staticImmutableRules(listStaticAssets(dist, "_expo/static"));
  return { rules, content: renderHeadersTemplate(template, { supabaseOrigin: "https://project.supabase.co", supabaseWsOrigin: "wss://project.supabase.co", scriptHashes: "'sha256-abc'", staticRules: rules.text }) };
}

test("immutable kuralı yalnız çıktıda var olan dosyaların tam yoluna yazılır; glob yok", () => {
  const dist = fakeDist();
  try {
    const { rules, content } = render(dist);
    assert.equal(rules.mode, "exact");
    assert.equal(rules.count, REAL.length);
    assert.equal(rules.warning, null);
    assert.ok(!/^\/_expo\/static\/\*/m.test(content), "'/_expo/static/*' glob kuralı kalmamalı");
    assert.ok(!content.split("\n").some((l) => !l.trim().startsWith("#") && l.includes("{{")), "doldurulmamış yer tutucu kalmamalı");
    for (const path of REAL) {
      assert.deepEqual(effectiveHeaders(content, path)["Cache-Control"], ["public, max-age=31536000, immutable"], path);
    }
  } finally { rmSync(dist, { recursive: true, force: true }); }
});

test("var olmayan /_expo/static yolu (SPA fallback HTML) Cache-Control almaz ama güvenlik başlıklarını alır", () => {
  const dist = fakeDist();
  try {
    const { content } = render(dist);
    const h = effectiveHeaders(content, MISSING);
    assert.equal(h["Cache-Control"], undefined, "fallback HTML immutable önbelleğe girmemeli");
    assert.ok(h["Content-Security-Policy"]?.[0].includes("default-src 'self'"));
    assert.deepEqual(h["X-Frame-Options"], ["DENY"]);
    assert.deepEqual(effectiveHeaders(content, "/")["Cache-Control"], undefined);
  } finally { rmSync(dist, { recursive: true, force: true }); }
});

test("/s/* tek Referrer-Policy (no-referrer) gönderir; kök sayfa genel değeri korur", () => {
  const dist = fakeDist();
  try {
    const { content } = render(dist);
    assert.deepEqual(effectiveHeaders(content, "/s/probe")["Referrer-Policy"], ["no-referrer"]);
    assert.deepEqual(effectiveHeaders(content, "/s/probe")["X-Robots-Tag"], ["noindex, nofollow"]);
    assert.deepEqual(effectiveHeaders(content, "/")["Referrer-Policy"], ["strict-origin-when-cross-origin"]);
    assert.deepEqual(validateHeadersFile(content, { probePaths: ["/", "/s/probe", MISSING, ...REAL] }), []);
  } finally { rmSync(dist, { recursive: true, force: true }); }
});

test("doğrulama çift başlığı ve glob'u yakalar (eski şablon davranışı)", () => {
  const legacy = template
    .replace("  ! Referrer-Policy\n", "")
    .replace("{{STATIC_IMMUTABLE_RULES}}", "/_expo/static/*\n  Cache-Control: public, max-age=31536000, immutable");
  const content = renderHeadersTemplate(legacy, { supabaseOrigin: "https://p.supabase.co", supabaseWsOrigin: "wss://p.supabase.co", scriptHashes: "" });
  const errors = validateHeadersFile(content, { probePaths: ["/s/probe"] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Referrer-Policy 2 kez/);
  assert.deepEqual(effectiveHeaders(content, MISSING)["Cache-Control"], ["public, max-age=31536000, immutable"], "eski glob fallback'i yakalıyordu");
});

test("kural bütçesi aşılırsa uzantı glob'una düşer ve uyarır; kural sayısı Cloudflare sınırında kalır", () => {
  const many = Array.from({ length: 150 }, (_, i) => `/_expo/static/js/web/chunk-${i.toString(16).padStart(8, "0")}.js`);
  const rules = staticImmutableRules(many);
  assert.equal(rules.mode, "glob");
  assert.match(rules.warning, /bütçesi/);
  assert.ok(rules.text.includes("/_expo/static/*.js"));
  const content = renderHeadersTemplate(template, { supabaseOrigin: "https://p.supabase.co", supabaseWsOrigin: "wss://p.supabase.co", scriptHashes: "", staticRules: rules.text });
  assert.ok(validateHeadersFile(content).length === 0);
  assert.ok(content.split("\n").filter((l) => l && !/^\s/.test(l) && !l.startsWith("#")).length <= CLOUDFLARE_MAX_HEADER_RULES);
});

test("boşluk/`*`/`:` içeren veya uzantısı olmayan yollar kural olmaz", () => {
  const rules = staticImmutableRules(["/_expo/static/weird file.js", "/_expo/static/a*b.js", "/_expo/static/c:d.js", "/_expo/static/noext", "/other/x.js", ...REAL]);
  assert.equal(rules.count, REAL.length);
  assert.equal(rules.skipped.length, 5);
});

test("cf-pages-finalize.mjs uçtan uca: dist/_headers fallback'i immutable yapmaz, /s/* tek Referrer-Policy", () => {
  const dist = fakeDist();
  try {
    const out = execFileSync("node", ["scripts/cf-pages-finalize.mjs", "--out", dist, "--template", "deploy/web", "--supabase-url-env", "GINA_TEST_SUPABASE_URL", "--spa"], {
      cwd: root, encoding: "utf8", env: { ...process.env, GINA_TEST_SUPABASE_URL: "https://project.supabase.co" },
    });
    assert.match(out, /immutable önbellek kuralı: 2 \(exact\)/);
    const content = readFileSync(join(dist, "_headers"), "utf8");
    assert.equal(effectiveHeaders(content, MISSING)["Cache-Control"], undefined);
    assert.deepEqual(effectiveHeaders(content, REAL[0])["Cache-Control"], ["public, max-age=31536000, immutable"]);
    assert.deepEqual(effectiveHeaders(content, "/s/probe")["Referrer-Policy"], ["no-referrer"]);
    assert.ok(effectiveHeaders(content, "/")["Content-Security-Policy"][0].includes("'sha256-"), "satır içi script özeti CSP'ye girer");
    assert.ok(content.includes("wss://project.supabase.co"));
  } finally { rmSync(dist, { recursive: true, force: true }); }
});
