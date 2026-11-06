#!/usr/bin/env node
// Yerel yayın yolu — tek giriş noktası. 6 Kasım 2026 gecesi elle yapılan R01 adımlarını
// (Management API ile migration, build-web/backoffice + wrangler pages deploy + canlı hash
// doğrulaması, yerel EAS production build + eas submit, tablet Ad Hoc paket + EAS Hosting
// önizleme → alias) tek scriptte kodlar.
//
// VARSAYILAN DRY-RUN: hiçbir komut çalışmaz, ağ isteği atılmaz; yalnız plan yazılır.
// Gerçek çalıştırma için --execute gerekir. Secret'lar env'den veya --env-file'dan okunur,
// asla yazdırılmaz; plan çıktısında yalnız değişken ADLARI görünür.
//
// Kullanım (repo kökünden):
//   node scripts/release-local.mjs <komut> [--execute] [--env-file PATH] [--json] [--allow-dirty]
//   komutlar: migrations:plan | migrations:apply | web | backoffice | ios:build | ios:submit |
//             tablet:build | tablet:publish | verify
//   ek bayraklar: --ipa PATH  --install-dir PATH  --deployment-url URL  --target web|backoffice|tablet|ios|all
//                 --expected-build N  --expected-sha256 HEX  --dist PATH
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { assertPublicBuildEnvironment } from './public-build-env.mjs';
import { isPublicHttps } from './check-testflight.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMMANDS = ['migrations:plan', 'migrations:apply', 'web', 'backoffice', 'ios:build', 'ios:submit', 'tablet:build', 'tablet:publish', 'verify'];
export const TARGETS = {
  web: { project: 'gina-web', origin: 'https://gina-web.pages.dev', dist: 'apps/mobile/dist', prefix: 'EXPO_PUBLIC_', build: 'scripts/build-web.mjs', typecheck: ['turbo', 'run', 'typecheck', '--filter=@gina/mobile...'] },
  backoffice: { project: 'gina-backoffice', origin: 'https://gina-backoffice.pages.dev', dist: 'apps/backoffice/out', prefix: 'NEXT_PUBLIC_', build: 'scripts/build-backoffice.mjs', typecheck: ['turbo', 'run', 'typecheck', 'lint', '--filter=@gina/backoffice'] },
};
export const TABLET_ALIAS_ORIGIN = 'https://gina-aile-enescevik--tablet.expo.app';
export const BUNDLE_ID = 'com.enescevik.gina';
export const EAS_PROJECT_ID = '8fc01433-eb6f-419e-a20b-edc30c8abe84';
const WEB_EXTENSIONS = ['.js', '.html', '.css'];

// ---------------------------------------------------------------- argümanlar / env

export function parseReleaseArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      execute: { type: 'boolean', default: false }, 'env-file': { type: 'string' }, json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }, 'allow-dirty': { type: 'boolean', default: false },
      ipa: { type: 'string' }, 'install-dir': { type: 'string' }, 'deployment-url': { type: 'string' },
      target: { type: 'string', default: 'all' }, 'expected-build': { type: 'string' }, 'expected-sha256': { type: 'string' },
      dist: { type: 'string' },
    },
  });
  const command = positionals[0];
  if (values.help) return { command: 'help', ...values };
  if (!COMMANDS.includes(command)) throw new Error(`unknown-command: ${command ?? '(boş)'}. Geçerli: ${COMMANDS.join(', ')}`);
  if (positionals.length > 1) throw new Error('too-many-positionals');
  if (!['all', 'web', 'backoffice', 'tablet', 'ios'].includes(values.target)) throw new Error('invalid-target');
  if (values['expected-build'] && !/^\d+$/.test(values['expected-build'])) throw new Error('invalid-expected-build');
  if (values['expected-sha256'] && !/^[a-f0-9]{64}$/i.test(values['expected-sha256'])) throw new Error('invalid-expected-sha256');
  if (values['deployment-url'] === '') delete values['deployment-url']; // CI'da boş çıktı = yok
  if (values['deployment-url']) {
    const u = new URL(values['deployment-url']);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !u.hostname.endsWith('.pages.dev')) throw new Error('invalid-deployment-url');
  }
  return { command, ...values };
}

/** Dosya varsa parseEnv ile okur; shell env önceliklidir. Değerler hiçbir yere yazılmaz. */
export function loadReleaseEnv(processEnv, envFile) {
  if (!envFile) return { ...processEnv };
  if (!existsSync(envFile)) throw new Error('env-file-missing');
  return { ...parseEnv(readFileSync(envFile, 'utf8')), ...processEnv };
}

/** Hangi env adlarının tanımlı olduğunu söyler; değer döndürmez. */
export function envPresence(env, names) {
  return Object.fromEntries(names.map(n => [n, typeof env[n] === 'string' && env[n].trim() !== '']));
}

export function requireEnv(env, names) {
  const missing = names.filter(n => !envPresence(env, [n])[n]);
  if (missing.length) throw new Error(`missing-env: ${missing.join(', ')}`);
}

export function supabaseProjectRef(env) {
  if (env.SUPABASE_PROJECT_REF) {
    if (!/^[a-z]{20}$/.test(env.SUPABASE_PROJECT_REF)) throw new Error('invalid-project-ref');
    return env.SUPABASE_PROJECT_REF;
  }
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const m = /^([a-z]{20})\.supabase\.co$/.exec(isPublicHttps(url) ? new URL(url).hostname : '');
  if (!m) throw new Error('project-ref-unresolved');
  return m[1];
}

// ---------------------------------------------------------------- kaynak / sürüm

const defaultRun = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function sourceState(run = defaultRun) {
  const commit = run('git', ['rev-parse', 'HEAD']);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const porcelain = run('git', ['status', '--porcelain']);
  const dirtyFiles = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('source-commit-unreadable');
  return { commit, branch, dirtyFiles, clean: dirtyFiles === 0 };
}

export function assertSource(state, { allowDirty = false } = {}) {
  if (!state.clean && !allowDirty) throw new Error(`source-dirty: ${state.dirtyFiles} dosya; yayın temiz çalışma ağacından yapılır (--allow-dirty yalnız dry-run incelemesi için)`);
  return state;
}

/** app.json + eas.json + (varsa) EAS uzaktaki build numarası → sürüm eşlemesi bulguları. */
export function versionMapping({ app, eas, remoteBuild = null }) {
  const expo = app.expo ?? {};
  const findings = [];
  const check = (id, ok, pass, fail) => findings.push({ id, status: ok ? 'pass' : 'block', message: ok ? pass : fail });
  check('app-version', /^\d+\.\d+\.\d+$/.test(expo.version ?? ''), `app.json sürümü ${expo.version}`, 'app.json sürümü major.minor.patch olmalı');
  check('bundle-id', expo.ios?.bundleIdentifier === BUNDLE_ID, 'bundle kimliği beklenen', 'bundle kimliği beklenenden farklı');
  check('eas-project', expo.extra?.eas?.projectId === EAS_PROJECT_ID, 'EAS proje kimliği beklenen', 'EAS proje kimliği beklenenden farklı');
  check('version-source', eas.cli?.appVersionSource === 'remote', 'sürüm kaynağı remote (build numarası EAS’te)', 'eas.json cli.appVersionSource remote olmalı');
  check('tablet-profile', eas.build?.tablet?.extends === 'production' && eas.build.tablet.distribution === 'internal' && eas.build.tablet.autoIncrement === false && eas.build.tablet.channel === 'production',
    'tablet profili production’dan türer, internal, autoIncrement kapalı', 'tablet profili production/internal/autoIncrement:false/channel:production olmalı');
  check('production-profile', eas.build?.production?.channel === 'production' && !eas.build.production.developmentClient, 'production profili store dağıtımına uygun', 'production profili development client olmamalı');
  if (remoteBuild !== null) check('remote-build', /^\d+$/.test(String(remoteBuild)), `EAS uzaktaki build numarası ${remoteBuild}`, 'EAS uzaktaki build numarası okunamadı');
  else findings.push({ id: 'remote-build', status: 'pending', message: 'EAS uzaktaki build numarası dry-run’da okunmaz (eas build:version:get)' });
  return { version: expo.version, remoteBuild, ok: !findings.some(f => f.status === 'block'), findings };
}

export function parseRemoteBuildNumber(output = '') {
  try { const j = JSON.parse(output); if (/^\d+$/.test(String(j.buildNumber ?? ''))) return String(j.buildNumber); } catch { /* text output */ }
  const m = /buildNumber\s*[-:]\s*(\d+)/i.exec(output) ?? /\b(\d{1,6})\s*$/.exec(output.trim());
  if (!m) throw new Error('remote-build-unparsed');
  return m[1];
}

// ---------------------------------------------------------------- migrations

export function parseMigrationFile(name) {
  const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(name);
  if (!m) return null;
  return { version: m[1], name: m[2], file: name };
}

export function listLocalMigrations(dir = join(ROOT, 'supabase/migrations')) {
  return readdirSync(dir).map(parseMigrationFile).filter(Boolean).sort((a, b) => a.version.localeCompare(b.version));
}

/** Uygulanmış sürüm listesine göre bekleyenler; yerelde olmayan uzak sürüm uyarı olur. */
export function pendingMigrations(local, appliedVersions) {
  const applied = new Set(appliedVersions.map(String));
  const localVersions = new Set(local.map(m => m.version));
  const pending = local.filter(m => !applied.has(m.version));
  const remoteOnly = [...applied].filter(v => !localVersions.has(v)).sort();
  const lastApplied = [...applied].sort().at(-1) ?? null;
  const outOfOrder = pending.filter(m => lastApplied && m.version < lastApplied).map(m => m.version);
  return { pending, remoteOnly, outOfOrder, lastApplied };
}

/** Migration + schema_migrations kaydı tek işlemde; başarısız olursa hiçbiri uygulanmaz. */
export function migrationApplySql({ version, name, sql }) {
  if (!/^\d{14}$/.test(version) || !/^[a-z0-9_]+$/.test(name)) throw new Error('invalid-migration-identity');
  let tag = 'gina_mig';
  while (sql.includes(`$${tag}$`)) tag += '_';
  return `begin;\n${sql.trim()}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements)\n  values ('${version}', '${name}', array[$${tag}$${sql}$${tag}$]);\ncommit;`;
}

export const APPLIED_MIGRATIONS_SQL = 'select version, name from supabase_migrations.schema_migrations order by version';

export async function managementQuery({ ref, token, query, fetcher = fetch }) {
  const response = await fetcher(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`management-query-failed: HTTP ${response.status}`); // gövde yazdırılmaz
  return response.json();
}

// ---------------------------------------------------------------- hash doğrulama

export function sha256File(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }

export function hashDirectory(dir, extensions = WEB_EXTENSIONS) {
  const files = [];
  const walk = d => {
    for (const entry of readdirSync(d).sort()) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (extensions.some(e => entry.endsWith(e))) files.push({ path: relative(dir, p).split('\\').join('/'), sha256: sha256File(p), bytes: statSync(p).size });
    }
  };
  if (!existsSync(dir)) throw new Error(`dist-missing: ${dir}`);
  walk(dir);
  return files;
}

export function servedPath(path) {
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return '/' + path.slice(0, -'index.html'.length);
  return '/' + path;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Yerel dosya özetlerini verilen kökenlerdeki canlı içerikle karşılaştırır (yeniden deneme ile). */
export async function compareLiveHashes({ files, origins, fetcher = fetch, attempts = 3, delayMs = 5000, concurrency = 6 }) {
  const results = [];
  const queue = [];
  for (const origin of origins) for (const file of files) queue.push({ origin, file });
  const worker = async () => {
    while (queue.length) {
      const { origin, file } = queue.shift();
      const url = origin.replace(/\/$/, '') + servedPath(file.path);
      let outcome = { url, path: file.path, status: null, match: false };
      for (let i = 0; i < attempts; i++) {
        try {
          const response = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
          const body = Buffer.from(await response.arrayBuffer());
          const sha256 = createHash('sha256').update(body).digest('hex');
          outcome = { url, path: file.path, status: response.status, match: response.status === 200 && sha256 === file.sha256 };
        } catch { outcome = { url, path: file.path, status: null, match: false }; }
        if (outcome.match) break;
        if (i < attempts - 1) await sleep(delayMs);
      }
      results.push(outcome);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  const mismatched = results.filter(r => !r.match);
  return { ok: mismatched.length === 0 && results.length === files.length * origins.length, total: results.length, matched: results.length - mismatched.length, mismatched };
}

export function extractDeploymentUrl(output, project) {
  const re = new RegExp(`https://([a-z0-9]{6,12})\\.${project.replace(/[-]/g, '\\-')}\\.pages\\.dev`, 'g');
  const matches = [...String(output).matchAll(re)].map(m => m[0]);
  if (!matches.length) throw new Error('deployment-url-not-found');
  return matches.at(-1);
}

// ---------------------------------------------------------------- tablet

export function tabletInstallHtml({ version, build, installUrl }) {
  const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>GINA · Tablet kurulumu</title>
<link rel="icon" type="image/png" href="icon.png?v=mint1"><link rel="apple-touch-icon" href="icon.png?v=mint1"><meta name="theme-color" content="#6650CD">
<style>*{box-sizing:border-box}body{margin:0;background:#f8f5ef;color:#292149;font-family:system-ui,-apple-system,sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px}main{width:min(100%,480px);background:white;padding:38px;border-radius:28px;box-shadow:0 16px 60px #2921490c}img{width:88px;height:88px;border-radius:22px}h1{font-size:29px;letter-spacing:-.8px;margin-bottom:8px}p{line-height:1.65;color:#625a74}a{display:block;padding:18px;text-align:center;background:#6242c6;color:white;text-decoration:none;border-radius:15px;font-weight:650;margin:28px 0}small{display:block;line-height:1.6;color:#71697e}.version{display:inline-block;background:#eee8fc;color:#51349d;border-radius:40px;padding:8px 14px;font-weight:600;margin-top:12px}ol{padding-left:22px;line-height:1.8;color:#625a74}footer{border-top:1px solid #eee8f4;margin-top:26px;padding-top:20px}</style></head>
<body><main><img src="icon.png" alt="Gina"><h1>Gina tabletinde.</h1>
<p>Kayıtlı iPad için güncel test sürümü.</p><div class="version">${escape(version)} (${escape(build)})</div>
<a href="${escape(installUrl)}">Yükle / Güncelle</a>
<ol><li>Bu sayfayı iPad’de Safari ile aç.</li><li>Yukarıdaki düğmeye dokun ve iOS kurulum onayını ver.</li><li>Yükleme tamamlandığında ana ekrandan Gina’yı aç.</li></ol>
<footer><small>TestFlight ve kablo gerekmez. Yalnız kayıtlı test cihazında çalışır. Mevcut uygulamayı silmeden güncelle. Yeni sürüm yayımlandığında bu sayfayı yeniden aç.</small></footer>
</main></body></html>
`;
}

export function tabletManifestPlist({ ipaUrl, version, build, bundleId = BUNDLE_ID, title = 'Gina Aile' }) {
  const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>items</key><array><dict>
<key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${esc(ipaUrl)}</string></dict></array>
<key>metadata</key><dict>
<key>bundle-identifier</key><string>${esc(bundleId)}</string>
<key>bundle-version</key><string>${esc(version)}</string>
<key>kind</key><string>software</string>
<key>title</key><string>${esc(title)} ${esc(version)} (${esc(build)})</string>
</dict></dict></array></dict></plist>
`;
}

/** Yerel Ad Hoc IPA için statik kurulum klasörü: index.html, manifest-N.plist, gina-N.ipa, icon.png, release.json. */
export function buildTabletInstallDir({ ipaPath, iconPath, outDir, version, build, sourceCommit, baseUrl = TABLET_ALIAS_ORIGIN, previousRelease = null }) {
  if (!/^\d+$/.test(build) || !/^\d+\.\d+\.\d+$/.test(version) || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('invalid-tablet-release-identity');
  if (!isPublicHttps(baseUrl)) throw new Error('invalid-tablet-base-url');
  if (previousRelease && Number(previousRelease.build) > Number(build)) throw new Error('refusing-older-tablet-release');
  const ipaName = `gina-${build}.ipa`, manifestName = `manifest-${build}.plist`;
  const base = baseUrl.replace(/\/$/, '');
  const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/${manifestName}`)}`;
  mkdirSync(outDir, { recursive: true });
  copyFileSync(ipaPath, join(outDir, ipaName));
  copyFileSync(iconPath, join(outDir, 'icon.png'));
  writeFileSync(join(outDir, manifestName), tabletManifestPlist({ ipaUrl: `${base}/${ipaName}`, version, build }));
  writeFileSync(join(outDir, 'index.html'), tabletInstallHtml({ version, build, installUrl }));
  const record = { version, build, sourceCommit, origin: 'local-eas-build', installUrl, sha256: sha256File(ipaPath), bytes: statSync(ipaPath).size };
  writeFileSync(join(outDir, 'release.json'), JSON.stringify(record, null, 2) + '\n');
  if (previousRelease) writeFileSync(join(outDir, 'previous-release.json'), JSON.stringify(previousRelease, null, 2) + '\n');
  return { ...record, ipaName, manifestName };
}

/** Canlı (önizleme veya alias) tablet dağıtımını yerel kayıtla karşılaştırır: release.json, manifest, IPA hash. */
export async function verifyTabletDeployment({ origin, expected, fetcher = fetch }) {
  const base = origin.replace(/\/$/, '');
  const checks = [];
  const get = async path => fetcher(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(180000) });
  try {
    const r = await get('/release.json');
    const live = r.status === 200 ? await r.json() : {};
    checks.push({ id: 'release-json', ok: r.status === 200 && String(live.build) === String(expected.build) && live.sha256 === expected.sha256 && (!expected.sourceCommit || live.sourceCommit === expected.sourceCommit), live: { build: live.build, version: live.version, sourceCommit: live.sourceCommit } });
  } catch { checks.push({ id: 'release-json', ok: false }); }
  try {
    const r = await get(`/manifest-${expected.build}.plist`);
    const text = r.status === 200 ? await r.text() : '';
    checks.push({ id: 'manifest', ok: r.status === 200 && text.includes(`<string>${BUNDLE_ID}</string>`) && text.includes(`gina-${expected.build}.ipa`) && text.includes(`(${expected.build})`) });
  } catch { checks.push({ id: 'manifest', ok: false }); }
  try {
    const r = await get(`/gina-${expected.build}.ipa`);
    const body = Buffer.from(r.status === 200 ? await r.arrayBuffer() : new ArrayBuffer(0));
    const sha256 = createHash('sha256').update(body).digest('hex');
    checks.push({ id: 'ipa-hash', ok: r.status === 200 && sha256 === expected.sha256, bytes: body.length });
  } catch { checks.push({ id: 'ipa-hash', ok: false }); }
  try {
    const r = await get(`/?v=${expected.build}`);
    const html = r.status === 200 ? await r.text() : '';
    checks.push({ id: 'page-version', ok: r.status === 200 && html.includes(`(${expected.build})`) && html.includes(`manifest-${expected.build}.plist`) });
  } catch { checks.push({ id: 'page-version', ok: false }); }
  return { origin: base, ok: checks.every(c => c.ok), checks };
}

export function parseInfoPlistJson(json) {
  const info = typeof json === 'string' ? JSON.parse(json) : json;
  const result = { bundleId: info.CFBundleIdentifier, version: info.CFBundleShortVersionString, build: info.CFBundleVersion, deviceFamilies: info.UIDeviceFamily ?? [] };
  if (result.bundleId !== BUNDLE_ID) throw new Error('ipa-bundle-mismatch');
  if (!/^\d+\.\d+\.\d+$/.test(result.version ?? '') || !/^\d+$/.test(result.build ?? '')) throw new Error('ipa-version-unreadable');
  return result;
}

/** IPA içinden Info.plist okur (macOS: unzip + plutil). Yalnız --execute yolunda çağrılır. */
export function inspectIpa(ipaPath) {
  if (!existsSync(ipaPath)) throw new Error(`ipa-missing: ${ipaPath}`);
  const plist = execFileSync('sh', ['-c', `unzip -p "$1" 'Payload/*.app/Info.plist' | plutil -convert json -o - -`, 'sh', ipaPath], { encoding: 'utf8' });
  const info = parseInfoPlistJson(plist);
  const codesign = spawnSync('codesign', ['-dv', '--verbose=2', `${ipaPath}`], { encoding: 'utf8' }); // IPA için bilgi amaçlı; .app çıkarılmadan tam doğrulama yapılmaz
  return { ...info, sha256: sha256File(ipaPath), bytes: statSync(ipaPath).size, codesignExit: codesign.status };
}

// ---------------------------------------------------------------- plan

const step = (id, title, extra = {}) => ({ id, title, ...extra });

/** Komut için adım planı. Shell adımlarının argv’si secret içermez; secret'lar env ile aktarılır (adları `env` alanında). */
export function buildPlan(command, ctx) {
  const t = TARGETS;
  const steps = [];
  const sourceSteps = () => steps.push(step('source', 'Kaynak commit ve temiz çalışma ağacı kontrolü', { kind: 'check', detail: `${ctx.source.commit.slice(0, 7)} @ ${ctx.source.branch}; dirty=${ctx.source.dirtyFiles}` }));
  const envStep = prefix => steps.push(step('public-env', `${prefix}SUPABASE_URL/ANON_KEY public doğrulaması (service_role / yerel URL reddedilir)`, { kind: 'check', env: [`${prefix}SUPABASE_URL`, `${prefix}SUPABASE_ANON_KEY`] }));
  const versionStep = () => steps.push(step('version-map', 'Sürüm/build eşlemesi (app.json, eas.json, EAS uzaktaki build numarası)', { kind: 'shell', argv: ['eas', 'build:version:get', '--platform', 'ios', '--profile', 'production', '--non-interactive', '--json'], cwd: 'apps/mobile' }));
  const pagesTarget = key => {
    const c = t[key];
    sourceSteps(); envStep(c.prefix);
    steps.push(step('deps', 'Bağımlılıklar (frozen lockfile)', { kind: 'shell', argv: ['pnpm', 'install', '--frozen-lockfile'] }));
    steps.push(step('typecheck', 'Typecheck/lint', { kind: 'shell', argv: ['pnpm', ...c.typecheck] }));
    steps.push(step('build', `Derleme → ${c.dist} (+ _headers/_redirects, CSP özetleri)`, { kind: 'shell', argv: ['node', c.build], env: [`${c.prefix}SUPABASE_URL`, `${c.prefix}SUPABASE_ANON_KEY`] }));
    steps.push(step('local-hash', `Yerel çıktı özetleri (${WEB_EXTENSIONS.join(', ')})`, { kind: 'check', detail: c.dist }));
    if (key === 'backoffice') steps.push(step('access-pre', 'Access kapısı (ana + rastgele önizleme) yüklemeden önce', { kind: 'shell', argv: ['node', 'scripts/check-backoffice-access.mjs'], env: ['CF_PAGES_PROJECT', 'CF_ACCESS_TEAM'] }));
    steps.push(step('deploy', `wrangler pages deploy ${c.dist} → ${c.project} (branch main)`, { kind: 'shell', argv: ['pnpm', 'exec', 'wrangler', 'pages', 'deploy', c.dist, `--project-name=${c.project}`, '--branch=main', '--commit-dirty=true'], env: ['CLOUDFLARE_API_TOKEN?', 'CLOUDFLARE_ACCOUNT_ID?'], note: 'Oturum: yerel wrangler login veya env token. Çıktıdan dağıtım URL’si okunur.' }));
    steps.push(step('live-hash', `Canlı hash karşılaştırması: ${c.origin} + dağıtım URL’si (tüm JS/HTML/CSS)`, { kind: 'http', detail: c.origin }));
    if (key === 'backoffice') steps.push(step('access-post', 'Access kapısı yüklemeden sonra (ana + gerçek dağıtım URL’si)', { kind: 'shell', argv: ['node', 'scripts/check-backoffice-access.mjs'], env: ['CF_PAGES_PROJECT', 'CF_ACCESS_TEAM', 'CF_PREVIEW_ORIGIN'] }));
    steps.push(step('record', 'Yayın kaydı (commit, dağıtım URL’si, dosya sayısı, eşleşme) → stdout JSON', { kind: 'check' }));
  };
  switch (command) {
    case 'migrations:plan':
    case 'migrations:apply': {
      sourceSteps();
      steps.push(step('applied', 'Üretimde uygulanmış migration listesi (Management API, salt okunur sorgu)', { kind: 'http', env: ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF|*_PUBLIC_SUPABASE_URL'], detail: APPLIED_MIGRATIONS_SQL }));
      steps.push(step('pending', 'Yerel supabase/migrations ile fark: bekleyenler, yalnız uzakta olanlar, sıra dışı olanlar', { kind: 'check', detail: `${ctx.localMigrations.length} yerel dosya; son yerel ${ctx.localMigrations.at(-1)?.version ?? '-'}` }));
      if (command === 'migrations:apply') {
        steps.push(step('snapshot', 'Uygulama öncesi kayıt: schema_migrations listesi + bekleyen migration SQL özetleri → --install-dir/migrations-pre.json', { kind: 'check', note: 'Etkilenen tabloların veri anlık görüntüsü R01’de elle alındı; burada yalnız şema kaydı. Veri yedeği için Supabase yedeği/PITR kullanılır.' }));
        steps.push(step('apply', 'Her bekleyen migration tek işlemde (begin; SQL; schema_migrations insert; commit) sırayla', { kind: 'http', note: 'Biri başarısız olursa dur; sonrakiler uygulanmaz. Geri alma migration’ı yoktur: ileri düzeltme ilkesi (docs/DEPLOY.md).' }));
        steps.push(step('verify', 'Uygulama sonrası schema_migrations yeniden okunur; bekleyen listesi boş olmalı', { kind: 'http' }));
      }
      break;
    }
    case 'web': pagesTarget('web'); break;
    case 'backoffice': pagesTarget('backoffice'); break;
    case 'ios:build': {
      sourceSteps(); envStep('EXPO_PUBLIC_'); versionStep();
      steps.push(step('deps', 'Bağımlılıklar (frozen lockfile)', { kind: 'shell', argv: ['pnpm', 'install', '--frozen-lockfile'] }));
      steps.push(step('doctor', 'Expo Doctor (newArchEnabled kalıntısı yok; SDK uyumu)', { kind: 'shell', argv: ['pnpm', 'exec', 'npx', '--yes', 'expo-doctor'], cwd: 'apps/mobile', optional: true }));
      steps.push(step('build', `Yerel EAS production build → ${ctx.ipa}`, { kind: 'shell', argv: ['eas', 'build', '--platform', 'ios', '--profile', 'production', '--local', '--non-interactive', '--output', ctx.ipa], cwd: 'apps/mobile', env: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_WEB_URL?', 'EXPO_PUBLIC_LEGAL_BASE_URL?', 'EXPO_PUBLIC_LEGAL_VERSION?'] }));
      steps.push(step('inspect', 'IPA: bundle/sürüm/build (Info.plist), SHA-256, codesign, üretim Supabase adresi pakette', { kind: 'check', detail: ctx.ipa }));
      break;
    }
    case 'ios:submit': {
      sourceSteps();
      steps.push(step('inspect', 'IPA eşlemesi: app.json sürümü ve EAS build numarası ile aynı olmalı', { kind: 'check', detail: ctx.ipa }));
      steps.push(step('static', 'Statik TestFlight yapılandırma kontrolü (salt okunur)', { kind: 'shell', argv: ['node', 'scripts/check-testflight.mjs', '--json'] }));
      steps.push(step('submit', 'eas submit (App Store Connect; ascAppId eas.json’dan)', { kind: 'shell', argv: ['eas', 'submit', '--platform', 'ios', '--profile', 'production', '--path', ctx.ipa, '--non-interactive', '--no-wait'], cwd: 'apps/mobile' }));
      steps.push(step('status', 'Gönderim durumu okunur; İŞLENDİ/TestFlight’ta görülmeden “yayımlandı” denmez', { kind: 'shell', argv: ['eas', 'submit:list', '--platform', 'ios', '--limit', '3', '--non-interactive'], cwd: 'apps/mobile', note: 'Test notları ve test kullanıcıları ASC panelinden (hesap sahibi adımı).' }));
      break;
    }
    case 'tablet:build': {
      sourceSteps(); envStep('EXPO_PUBLIC_'); versionStep();
      steps.push(step('expected-build', 'Beklenen build numarası = tamamlanmış TestFlight build’i (--expected-build veya EAS uzaktaki)', { kind: 'check', detail: ctx.expectedBuild ?? '(EAS uzaktaki değer)' }));
      steps.push(step('build', `Yerel EAS tablet (Ad Hoc) build → ${ctx.ipa}`, { kind: 'shell', argv: ['eas', 'build', '--platform', 'ios', '--profile', 'tablet', '--local', '--non-interactive', '--output', ctx.ipa], cwd: 'apps/mobile', env: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] }));
      steps.push(step('inspect', 'IPA: bundle/sürüm/build store ile aynı; get-task-allow kapalı; gömülü profilde kayıtlı cihaz sayısı öncekiyle aynı (UDID yazılmaz)', { kind: 'check', detail: ctx.ipa }));
      break;
    }
    case 'tablet:publish': {
      sourceSteps();
      steps.push(step('inspect', 'IPA sürüm/build ve SHA-256 okunur', { kind: 'check', detail: ctx.ipa }));
      steps.push(step('previous', `Canlı alias release.json önceki kayıt olarak saklanır (${TABLET_ALIAS_ORIGIN}/release.json)`, { kind: 'http' }));
      steps.push(step('install-dir', `Kurulum klasörü: index.html, manifest-N.plist, gina-N.ipa, icon.png, release.json → ${ctx.installDir}`, { kind: 'check' }));
      steps.push(step('deploy-preview', 'EAS Hosting önizleme dağıtımı (alias YOK, --prod YOK)', { kind: 'shell', argv: ['eas', 'deploy', '--export-dir', ctx.installDirRel, '--environment', 'production', '--non-interactive', '--json'], cwd: 'apps/mobile' }));
      steps.push(step('verify-preview', 'Önizleme: release.json/manifest/IPA hash/sayfa sürümü yerel paketle aynı', { kind: 'http' }));
      steps.push(step('alias', 'Yalnız `tablet` alias’ı yeni dağıtıma bağlanır (--prod YOK)', { kind: 'shell', argv: ['eas', 'deploy:alias', '--alias', 'tablet', '--id', '<önizleme dağıtım kimliği>', '--non-interactive'], cwd: 'apps/mobile' }));
      steps.push(step('verify-alias', `Canlı alias: ${TABLET_ALIAS_ORIGIN} release.json/manifest/IPA hash tekrar doğrulanır`, { kind: 'http' }));
      steps.push(step('record', 'Yayın kaydı: dağıtım kimliği, önceki dağıtım kimliği, hash, bayt → --install-dir/package.json', { kind: 'check' }));
      break;
    }
    case 'verify': {
      const want = k => ctx.target === 'all' || ctx.target === k;
      if (want('web')) steps.push(step('verify-web', `Web canlı hash: ${t.web.origin} ↔ ${ctx.dist?.web ?? t.web.dist}`, { kind: 'http' }));
      if (want('backoffice')) {
        steps.push(step('verify-backoffice-access', 'Backoffice Access kapısı (ana + önizleme)', { kind: 'shell', argv: ['node', 'scripts/check-backoffice-access.mjs'], env: ['CF_PAGES_PROJECT', 'CF_ACCESS_TEAM', 'CF_PREVIEW_ORIGIN?'] }));
        steps.push(step('verify-backoffice-hash', 'Backoffice canlı hash: Access arkasında olduğu için oturumsuz okunamaz; yalnız dağıtım URL’si + yetkili oturumla', { kind: 'check', note: 'Oturumsuz 302 beklenir; 200 alınırsa Access kapısı BOZUK demektir.' }));
      }
      if (want('tablet')) steps.push(step('verify-tablet', `Tablet alias: ${TABLET_ALIAS_ORIGIN} release.json/manifest/IPA hash ↔ beklenen (${ctx.expectedBuild ?? 'docs/release/tablet-*/release.json'})`, { kind: 'http' }));
      if (want('ios')) steps.push(step('verify-ios', 'TestFlight: statik yapılandırma (check-testflight.mjs) + eas submit:list durumu', { kind: 'shell', argv: ['node', 'scripts/check-testflight.mjs', '--json'] }));
      break;
    }
    default: throw new Error('unknown-command');
  }
  return steps;
}

export function renderPlan(command, steps, { execute, source, versions }) {
  const lines = [`release-local ${command} — ${execute ? 'GERÇEK ÇALIŞTIRMA (--execute)' : 'DRY-RUN (hiçbir komut çalışmadı, ağ isteği atılmadı)'}`];
  lines.push(`kaynak: ${source.commit} (${source.branch}) ${source.clean ? 'temiz' : `KİRLİ: ${source.dirtyFiles} dosya`}`);
  if (versions) for (const f of versions.findings) lines.push(`  ${{ pass: 'OK', block: 'ENGEL', pending: 'BEKLİYOR' }[f.status]}  ${f.message}`);
  steps.forEach((s, i) => {
    lines.push(`${String(i + 1).padStart(2)}. [${s.kind}] ${s.title}`);
    if (s.argv) lines.push(`      $ ${s.cwd ? `(cd ${s.cwd}) ` : ''}${s.argv.join(' ')}`);
    if (s.env) lines.push(`      env: ${s.env.join(', ')}  (yalnız adlar; değer yazılmaz)`);
    if (s.detail) lines.push(`      ${s.detail}`);
    if (s.note) lines.push(`      not: ${s.note}`);
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------- gerçek çalıştırma

function runStepShell(s, env) {
  const result = spawnSync(s.argv[0], s.argv.slice(1), { cwd: join(ROOT, s.cwd ?? '.'), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? '');
  if (result.status !== 0) {
    if (s.optional) { console.error(`uyarı: ${s.id} sıfır olmayan çıkış (${result.status}); isteğe bağlı adım`); return result.stdout ?? ''; }
    throw new Error(`step-failed: ${s.id} (çıkış ${result.status})`);
  }
  return result.stdout ?? '';
}

async function executePlan(command, steps, ctx) {
  const env = ctx.env;
  const record = { command, source: ctx.source, startedAt: new Date().toISOString(), steps: {} };
  let deploymentUrl = ctx.deploymentUrl ?? null;
  for (const s of steps) {
    console.log(`\n== ${s.id}: ${s.title}`);
    switch (s.id) {
      case 'source': assertSource(ctx.source, { allowDirty: false }); break; // --execute'ta kirli ağaç her zaman reddedilir
      case 'public-env': assertPublicBuildEnvironment(env, s.env[0].replace('SUPABASE_URL', '')); break;
      case 'version-map': {
        const out = runStepShell(s, env); const remoteBuild = parseRemoteBuildNumber(out);
        const versions = versionMapping({ app: ctx.app, eas: ctx.eas, remoteBuild });
        if (!versions.ok) throw new Error('version-mapping-blocked');
        record.remoteBuild = remoteBuild; break;
      }
      case 'applied': {
        const rows = await managementQuery({ ref: ctx.ref, token: env.SUPABASE_ACCESS_TOKEN, query: APPLIED_MIGRATIONS_SQL });
        record.applied = rows.map(r => String(r.version)); break;
      }
      case 'pending': {
        const diff = pendingMigrations(ctx.localMigrations, record.applied ?? []);
        record.pending = diff.pending.map(m => m.file); record.remoteOnly = diff.remoteOnly; record.outOfOrder = diff.outOfOrder;
        console.log(JSON.stringify({ pending: record.pending, remoteOnly: diff.remoteOnly, outOfOrder: diff.outOfOrder, lastApplied: diff.lastApplied }, null, 2));
        if (diff.outOfOrder.length) throw new Error('migrations-out-of-order: sıra dışı sürüm; elle karar gerekir');
        break;
      }
      case 'snapshot': {
        mkdirSync(ctx.installDir, { recursive: true });
        writeFileSync(join(ctx.installDir, 'migrations-pre.json'), JSON.stringify({ at: new Date().toISOString(), applied: record.applied, pending: record.pending }, null, 2) + '\n');
        break;
      }
      case 'apply': {
        for (const file of record.pending ?? []) {
          const m = parseMigrationFile(file);
          const sql = readFileSync(join(ROOT, 'supabase/migrations', file), 'utf8');
          console.log(`  uygulanıyor: ${file}`);
          await managementQuery({ ref: ctx.ref, token: env.SUPABASE_ACCESS_TOKEN, query: migrationApplySql({ ...m, sql }) });
        }
        break;
      }
      case 'verify': {
        const rows = await managementQuery({ ref: ctx.ref, token: env.SUPABASE_ACCESS_TOKEN, query: APPLIED_MIGRATIONS_SQL });
        const diff = pendingMigrations(ctx.localMigrations, rows.map(r => String(r.version)));
        if (diff.pending.length) throw new Error(`migrations-still-pending: ${diff.pending.map(m => m.file).join(', ')}`);
        record.appliedAfter = rows.length; break;
      }
      case 'deps': case 'typecheck': case 'build': case 'doctor': case 'static': case 'submit': case 'status': case 'access-pre': case 'deploy-preview': case 'alias': {
        if (s.id === 'alias') s.argv = s.argv.map(a => a === '<önizleme dağıtım kimliği>' ? record.previewDeploymentId : a);
        if (s.id === 'alias' && !record.previewDeploymentId) throw new Error('preview-deployment-id-missing');
        const out = runStepShell(s, { ...env, CF_PAGES_PROJECT: env.CF_PAGES_PROJECT ?? 'gina-backoffice', CF_ACCESS_TEAM: env.CF_ACCESS_TEAM ?? 'gina-family' });
        if (s.id === 'deploy-preview') {
          const m = /"id"\s*:\s*"([a-z0-9]{6,16})"/.exec(out) ?? /https:\/\/[a-z0-9-]+--([a-z0-9]{6,16})\.expo\.app/.exec(out);
          if (!m) throw new Error('preview-deployment-id-not-found');
          record.previewDeploymentId = m[1]; record.previewOrigin = `https://gina-aile-enescevik--${m[1]}.expo.app`;
        }
        break;
      }
      case 'local-hash': record.files = hashDirectory(join(ROOT, ctx.targetConfig.dist)); console.log(`  ${record.files.length} dosya özetlendi`); break;
      case 'deploy': {
        const out = runStepShell(s, env);
        deploymentUrl = extractDeploymentUrl(out, ctx.targetConfig.project); record.deploymentUrl = deploymentUrl; break;
      }
      case 'live-hash': case 'verify-web': {
        const files = record.files ?? hashDirectory(join(ROOT, ctx.dist?.web ?? TARGETS.web.dist));
        const origins = [ctx.targetConfig?.origin ?? TARGETS.web.origin, ...(deploymentUrl ? [deploymentUrl] : [])];
        const cmp = await compareLiveHashes({ files, origins });
        record.liveHash = { total: cmp.total, matched: cmp.matched, mismatched: cmp.mismatched.map(x => ({ path: x.path, status: x.status })) };
        console.log(`  ${cmp.matched}/${cmp.total} eşleşti`);
        if (!cmp.ok) throw new Error('live-hash-mismatch');
        break;
      }
      case 'access-post': case 'verify-backoffice-access': {
        runStepShell(s, { ...env, CF_PAGES_PROJECT: env.CF_PAGES_PROJECT ?? 'gina-backoffice', CF_ACCESS_TEAM: env.CF_ACCESS_TEAM ?? 'gina-family', ...(deploymentUrl ? { CF_PREVIEW_ORIGIN: deploymentUrl } : {}) });
        break;
      }
      case 'inspect': {
        record.ipa = inspectIpa(ctx.ipa);
        console.log(JSON.stringify({ bundleId: record.ipa.bundleId, version: record.ipa.version, build: record.ipa.build, sha256: record.ipa.sha256, bytes: record.ipa.bytes }, null, 2));
        if (record.ipa.version !== ctx.app.expo.version) throw new Error('ipa-version-differs-from-app-json');
        if (ctx.expectedBuild && record.ipa.build !== ctx.expectedBuild) throw new Error('ipa-build-differs-from-expected');
        if (record.remoteBuild && command === 'tablet:build' && record.ipa.build !== record.remoteBuild) throw new Error('ipa-build-differs-from-remote');
        if (isPublicHttps(env.EXPO_PUBLIC_SUPABASE_URL)) {
          const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname;
          const grep = spawnSync('sh', ['-c', `unzip -p "$1" 'Payload/*.app/main.jsbundle' | grep -c "$2"`, 'sh', ctx.ipa, host], { encoding: 'utf8' });
          record.ipa.productionEndpointEmbedded = Number(grep.stdout.trim()) > 0;
        } else record.ipa.productionEndpointEmbedded = null;
        if (['ios:build', 'tablet:build'].includes(command) && record.ipa.productionEndpointEmbedded !== true) throw new Error('production-supabase-url-not-embedded');
        break;
      }
      case 'expected-build': break;
      case 'previous': {
        try { const r = await fetch(`${TABLET_ALIAS_ORIGIN}/release.json`, { signal: AbortSignal.timeout(30000) }); if (r.ok) record.previousRelease = await r.json(); } catch { record.previousRelease = null; }
        break;
      }
      case 'install-dir': {
        const iconPath = join(ROOT, 'apps/mobile/assets/images/icon.png');
        record.tablet = buildTabletInstallDir({ ipaPath: ctx.ipa, iconPath, outDir: ctx.installDir, version: record.ipa.version, build: record.ipa.build, sourceCommit: ctx.source.commit, previousRelease: record.previousRelease });
        break;
      }
      case 'verify-preview': case 'verify-alias': case 'verify-tablet': {
        const origin = s.id === 'verify-preview' ? record.previewOrigin : TABLET_ALIAS_ORIGIN;
        const expected = record.tablet ?? ctx.expectedTablet;
        if (!expected) throw new Error('expected-tablet-release-missing: --expected-build ve --expected-sha256 ver');
        const v = await verifyTabletDeployment({ origin, expected });
        record[s.id] = v; console.log(JSON.stringify(v, null, 2));
        if (!v.ok) throw new Error(`${s.id}-failed`);
        break;
      }
      case 'verify-backoffice-hash': console.log('  oturumsuz hash okunamaz; Access kapısı kontrolü yeterli kabul edilmez, dağıtım URL’si yetkili oturumla ayrıca karşılaştırılır.'); break;
      case 'verify-ios': runStepShell(s, env); break;
      case 'record': {
        if (command === 'tablet:publish') writeFileSync(join(ctx.installDir, 'package.json'), JSON.stringify({ ...record.tablet, deploymentId: record.previewDeploymentId, previousDeploymentId: null, previousRelease: record.previousRelease, liveHashVerified: !!record['verify-alias']?.ok }, null, 2) + '\n');
        console.log(JSON.stringify({ command, source: ctx.source.commit, deploymentUrl, files: record.files?.length, liveHash: record.liveHash, tablet: record.tablet && { build: record.tablet.build, sha256: record.tablet.sha256 }, previewDeploymentId: record.previewDeploymentId }, null, 2));
        break;
      }
      default: throw new Error(`unhandled-step: ${s.id}`);
    }
  }
  record.finishedAt = new Date().toISOString();
  return record;
}

// ---------------------------------------------------------------- main

export async function main(argv = process.argv.slice(2), processEnv = process.env) {
  let args;
  try { args = parseReleaseArgs(argv); }
  catch (e) { console.error(`release-local: ${e.message}`); return 2; }
  if (args.command === 'help') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
    return 0;
  }
  try {
    const env = loadReleaseEnv(processEnv, args['env-file']);
    const source = sourceState();
    if (!args.execute && !source.clean && !args['allow-dirty']) console.error(`uyarı: çalışma ağacı kirli (${source.dirtyFiles} dosya); --execute reddedilir`);
    const app = JSON.parse(readFileSync(join(ROOT, 'apps/mobile/app.json'), 'utf8'));
    const eas = JSON.parse(readFileSync(join(ROOT, 'apps/mobile/eas.json'), 'utf8'));
    const versions = versionMapping({ app, eas });
    const target = args.command === 'web' || args.command === 'backoffice' ? args.command : null;
    const installDir = resolve(args['install-dir'] ?? join(ROOT, '.codex-setup/release-local', args.command.replace(':', '-')));
    const ctx = {
      env, source, app, eas, target: args.target, targetConfig: target ? TARGETS[target] : null,
      ipa: resolve(args.ipa ?? join(ROOT, '.codex-setup/release-local', args.command.startsWith('tablet') ? 'gina-tablet.ipa' : 'gina-production.ipa')),
      installDir, installDirRel: relative(join(ROOT, 'apps/mobile'), installDir),
      deploymentUrl: args['deployment-url'], expectedBuild: args['expected-build'], dist: args.dist ? { web: args.dist } : null,
      localMigrations: listLocalMigrations(),
      expectedTablet: args['expected-build'] && args['expected-sha256'] ? { build: args['expected-build'], sha256: args['expected-sha256'].toLowerCase() } : null,
    };
    // Env ön kontrolü: dry-run'da yalnız varlık (adlar); --execute'ta tam doğrulama adım içinde.
    const prefix = TARGETS[target]?.prefix ?? (args.command.startsWith('ios') || args.command.startsWith('tablet') ? 'EXPO_PUBLIC_' : null);
    const presence = envPresence(env, [...(prefix ? [`${prefix}SUPABASE_URL`, `${prefix}SUPABASE_ANON_KEY`] : []), 'SUPABASE_ACCESS_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']);
    if (prefix && args.execute) assertPublicBuildEnvironment(env, prefix);
    if (args.execute && args.command !== 'verify') assertSource(source); // env reddi önce; verify salt okunur, kirli ağaçta da çalışır
    if (args.command.startsWith('migrations') && args.execute) { requireEnv(env, ['SUPABASE_ACCESS_TOKEN']); ctx.ref = supabaseProjectRef(env); }
    const steps = buildPlan(args.command, ctx);
    if (args.json) console.log(JSON.stringify({ command: args.command, dryRun: !args.execute, source, versions, envPresent: presence, steps: steps.map(({ id, title, kind, argv, cwd, env: e, note }) => ({ id, title, kind, argv, cwd, env: e, note })) }, null, 2));
    else {
      console.log(renderPlan(args.command, steps, { execute: args.execute, source, versions }));
      console.log(`env mevcut: ${Object.entries(presence).map(([k, v]) => `${k}=${v ? 'var' : 'yok'}`).join(', ')}`);
    }
    if (!args.execute) { if (!args.json) console.log('\nDRY-RUN tamam. Gerçek yayın için --execute ekle; bu çıktı yayın kanıtı DEĞİLDİR.'); return 0; }
    if (!versions.ok) throw new Error('version-mapping-blocked');
    const record = await executePlan(args.command, steps, ctx);
    console.log(JSON.stringify({ ok: true, command: args.command, finishedAt: record.finishedAt }, null, 2));
    return 0;
  } catch (e) {
    // Hata metni yalnız kod/ad içerir; env değerleri veya sağlayıcı yanıt gövdesi yazılmaz.
    console.error(`release-local: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
