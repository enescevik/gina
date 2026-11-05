// Cloudflare Pages `_headers` üretimi için saf yardımcılar (scripts/cf-pages-finalize.mjs kullanır; node --test ile sınanır).
//
// Q03-HTTP-1: `/_expo/static/*` gibi bir glob, var olmayan bir yola verilen SPA fallback HTML cevabını da yakalar ve
// "immutable, max-age=31536000" ile bir yıl önbelleğe aldırır. Çare: immutable kuralı yalnız derleme çıktısında GERÇEKTEN
// var olan dosyaların tam yoluna yazılır (tam yol kuralı, fallback'e düşen hiçbir isteğe uymaz).
// Q03-HTTP-2: `_headers` dosyasında aynı yola uyan bloklar birleştirilir, ezilmez; `/s/*` için önce `! Referrer-Policy`
// ile genel değer kaldırılır, sonra tek değer verilir. `effectiveHeaders` bu birleştirmeyi taklit eder ki test edilebilsin.

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Cloudflare Pages sınırları: en çok 100 başlık kuralı, satır başına 2000 karakter.
export const CLOUDFLARE_MAX_HEADER_RULES = 100;
export const CLOUDFLARE_MAX_LINE_LENGTH = 2000;
export const STATIC_RULES_PLACEHOLDER = "{{STATIC_IMMUTABLE_RULES}}";
export const IMMUTABLE_CACHE_CONTROL = "Cache-Control: public, max-age=31536000, immutable";
// Hash'li varlık uzantıları (yedek glob kuralları ve dosya süzgeci için).
export const IMMUTABLE_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".ttf", ".otf", ".png", ".jpg", ".webp", ".svg", ".map"];

/** Çıktı klasöründeki `prefix` (ör. `_expo/static`) altındaki gerçek dosyaları URL yolu olarak listeler. */
export function listStaticAssets(outDir, prefix = "_expo/static") {
  const base = join(outDir, prefix);
  let st;
  try { st = statSync(base); } catch { return []; }
  if (!st.isDirectory()) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else files.push("/" + relative(outDir, path).split(sep).join("/"));
    }
  };
  walk(base);
  return files.sort();
}

/**
 * Immutable önbellek kuralları: her gerçek dosya için tam yol kuralı. Kural bütçesi aşılırsa uzantı bazlı glob'lara
 * döner (fallback HTML'i yine yakalayabilir; bu yüzden uyarı döner). `*`, `:` veya boşluk içeren yollar yazılmaz.
 */
export function staticImmutableRules(assetPaths, { prefix = "/_expo/static", budget = CLOUDFLARE_MAX_HEADER_RULES - 10 } = {}) {
  const safe = assetPaths.filter((p) => p.startsWith(prefix + "/") && !/[\s*:]/.test(p) && IMMUTABLE_EXTENSIONS.some((e) => p.endsWith(e)));
  const skipped = assetPaths.filter((p) => !safe.includes(p));
  if (safe.length === 0) {
    return { text: "", mode: "none", count: 0, skipped, warning: `immutable kuralı yazılmadı: ${prefix} altında dosya yok` };
  }
  if (safe.length <= budget) {
    const text = safe.map((p) => `${p}\n  ${IMMUTABLE_CACHE_CONTROL}`).join("\n");
    return { text, mode: "exact", count: safe.length, skipped, warning: null };
  }
  const exts = [...new Set(safe.map((p) => p.slice(p.lastIndexOf("."))))].sort();
  const text = exts.map((e) => `${prefix}/*${e}\n  ${IMMUTABLE_CACHE_CONTROL}`).join("\n");
  return {
    text, mode: "glob", count: exts.length, skipped,
    warning: `${safe.length} varlık > ${budget} kural bütçesi; uzantı glob'una düşüldü (var olmayan ${exts.join("/")} yolları fallback HTML'i immutable alabilir)`,
  };
}

/** Şablon yer tutucularını doldurur. `vars.staticRules` yoksa yer tutucu satırı silinir. */
export function renderHeadersTemplate(template, vars) {
  let content = template
    .replaceAll("{{SUPABASE_ORIGIN}}", vars.supabaseOrigin ?? "")
    .replaceAll("{{SUPABASE_WS_ORIGIN}}", vars.supabaseWsOrigin ?? "")
    .replaceAll("{{SCRIPT_HASHES}}", vars.scriptHashes ?? "")
    // Özet yoksa "script-src 'self' ;" kalmasın.
    .replaceAll(" ;", ";");
  if (content.includes(STATIC_RULES_PLACEHOLDER)) {
    content = content.replaceAll(STATIC_RULES_PLACEHOLDER, vars.staticRules ?? "");
  }
  return content.replace(/\n{3,}/g, "\n\n");
}

/** `_headers` metnini kural bloklarına ayırır: [{ path, headers: [{ name, value, remove }] }]. */
export function parseHeadersFile(content) {
  const rules = [];
  let current = null;
  for (const raw of content.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { path: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    if (!current) throw new Error(`_headers: yol satırı olmadan başlık: ${line.trim()}`);
    const t = line.trim();
    if (t.startsWith("!")) {
      current.headers.push({ name: t.slice(1).trim(), value: null, remove: true });
    } else {
      const i = t.indexOf(":");
      if (i < 0) throw new Error(`_headers: geçersiz başlık satırı: ${t}`);
      current.headers.push({ name: t.slice(0, i).trim(), value: t.slice(i + 1).trim(), remove: false });
    }
  }
  return rules;
}

function pathMatches(pattern, path) {
  // Cloudflare Pages: `*` her şeyi (bölü dahil) eşler, `:ad` tek bir yol parçasını eşler.
  const re = "^" + pattern.split(/(\*|:[A-Za-z_][A-Za-z0-9_]*)/).map((part, i) => {
    if (i % 2 === 0) return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    return part === "*" ? ".*" : "[^/]+";
  }).join("") + "$";
  return new RegExp(re).test(path);
}

/**
 * Cloudflare birleştirme kuralı: yola uyan her blok sırayla uygulanır; aynı ad tekrar edilirse değer EKLENİR,
 * `! Ad` o ana kadar biriken değerleri siler. Sonuç: { 'Header-Name': [değer, ...] } (adlar küçük harfe indirgenmez;
 * karşılaştırma büyük/küçük harf duyarsızdır).
 */
export function effectiveHeaders(content, path) {
  const out = new Map();
  for (const rule of parseHeadersFile(content)) {
    if (!pathMatches(rule.path, path)) continue;
    for (const h of rule.headers) {
      const key = h.name.toLowerCase();
      if (h.remove) { out.delete(key); continue; }
      const entry = out.get(key) ?? { name: h.name, values: [] };
      entry.values.push(h.value);
      out.set(key, entry);
    }
  }
  return Object.fromEntries([...out.values()].map((e) => [e.name, e.values]));
}

/** Yayın öncesi sağlamlık: kural sayısı, satır uzunluğu, aynı yol için çift başlık değeri. Hata listesi döner. */
export function validateHeadersFile(content, { probePaths = [] } = {}) {
  const errors = [];
  const rules = parseHeadersFile(content);
  if (rules.length > CLOUDFLARE_MAX_HEADER_RULES) errors.push(`${rules.length} kural > Cloudflare sınırı ${CLOUDFLARE_MAX_HEADER_RULES}`);
  const tooLong = content.split("\n").find((line) => line.length > CLOUDFLARE_MAX_LINE_LENGTH);
  if (tooLong) errors.push(`${CLOUDFLARE_MAX_LINE_LENGTH} karakteri aşan satır var (Cloudflare sınırı)`);
  for (const path of probePaths) {
    for (const [name, values] of Object.entries(effectiveHeaders(content, path))) {
      if (values.length > 1) errors.push(`${path}: ${name} ${values.length} kez gönderiliyor (${values.join(" | ")})`);
    }
  }
  return errors;
}
