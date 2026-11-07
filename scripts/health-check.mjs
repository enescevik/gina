#!/usr/bin/env node
// Sağlık kontrolü — kişisel veri okumaz, oturum kullanmaz, yalnız public/anon uçlar.
//   web/backoffice kök yanıtı ve güvenlik başlıkları; Supabase REST/Auth sağlık uçları (anon);
//   Edge fonksiyon listesi/sürümü (yalnız SUPABASE_ACCESS_TOKEN varsa; yoksa açıkça ATLANDI);
//   tablet alias release.json sürümü. JSON çıktı; herhangi bir kontrol başarısızsa çıkış 1.
//
// Kullanım: node scripts/health-check.mjs [--env-file PATH] [--expected-tablet-build N] [--strict] [--pretty]
//   --strict: atlanan (skip) kontroller de başarısızlık sayılır.
// Env: EXPO_PUBLIC_SUPABASE_URL (veya NEXT_PUBLIC_), EXPO_PUBLIC_SUPABASE_ANON_KEY (anon/publishable; secret reddedilir),
//      SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (isteğe bağlı, Edge listesi), CF_PAGES_PROJECT / CF_ACCESS_TEAM (varsayılan gina-backoffice / gina-family).
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { isPublicHttps, publicKeyKind } from './check-testflight.mjs';
import { checkBackofficeAccess } from './check-backoffice-access.mjs';

export const DEFAULT_ORIGINS = { web: 'https://ginafamily.com', tablet: 'https://gina-aile-enescevik--tablet.expo.app' };
const REQUIRED_WEB_HEADERS = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy'];

const check = (id, status, detail = {}) => ({ id, status, ...detail });
const timeout = () => AbortSignal.timeout(20000);

export async function checkWebRoot({ origin, fetcher }) {
  try {
    const r = await fetcher(`${origin}/`, { redirect: 'manual', signal: timeout() });
    const headers = Object.fromEntries(REQUIRED_WEB_HEADERS.map(h => [h, r.headers.has(h)]));
    const csp = r.headers.get('content-security-policy') ?? '';
    const noUnsafeInline = !/script-src[^;]*'unsafe-inline'/.test(csp);
    const noCookies = !r.headers.has('set-cookie');
    const ok = r.status === 200 && Object.values(headers).every(Boolean) && (r.headers.get('x-content-type-options') ?? '').toLowerCase() === 'nosniff' && noUnsafeInline && noCookies;
    await r.body?.cancel();
    return check('web-root', ok ? 'pass' : 'fail', { http: r.status, headers, scriptSrcNoUnsafeInline: noUnsafeInline, noCookies });
  } catch { return check('web-root', 'fail', { http: null }); }
}

export async function checkSupabase({ url, anonKey, fetcher }) {
  const results = [];
  if (!isPublicHttps(url)) return [check('supabase-rest', 'fail', { reason: 'public-https-url-required' }), check('supabase-auth', 'fail', { reason: 'public-https-url-required' })];
  const kind = publicKeyKind(anonKey);
  if (kind === 'secret') return [check('supabase-rest', 'fail', { reason: 'secret-key-refused' }), check('supabase-auth', 'fail', { reason: 'secret-key-refused' })];
  const base = new URL(url).origin;
  try {
    // Yeni publishable anahtarlarda kök OpenAPI uç noktası anon'a kapalı (401). Bunun yerine korumalı bir tabloyu
    // anon olarak oku: PostgREST ayakta ise JSON hata (401/403, PG 42501) ya da boş liste döner; 5xx/ağ hatası başarısızdır.
    const r = await fetcher(`${base}/rest/v1/families?select=id&limit=1`, { headers: kind === 'anon' || kind === 'publishable' ? { apikey: anonKey } : {}, redirect: 'manual', signal: timeout() });
    let body = null;
    try { body = await r.json(); } catch { /* gövde JSON değil */ }
    const denied = (r.status === 401 || r.status === 403) && body && typeof body === 'object' && !Array.isArray(body);
    const emptyAllowed = r.status === 200 && Array.isArray(body) && body.length === 0;
    results.push(check('supabase-rest', denied || emptyAllowed ? 'pass' : 'fail', { http: r.status, keyKind: kind, anonDenied: denied }));
  } catch { results.push(check('supabase-rest', 'fail', { http: null })); }
  try {
    const r = await fetcher(`${base}/auth/v1/health`, { headers: kind === 'anon' || kind === 'publishable' ? { apikey: anonKey } : {}, redirect: 'manual', signal: timeout() });
    let body = {};
    try { body = await r.json(); } catch { /* gövde JSON değil */ }
    results.push(check('supabase-auth', r.status === 200 && typeof body.version === 'string' ? 'pass' : 'fail', { http: r.status, version: typeof body.version === 'string' ? body.version : null }));
  } catch { results.push(check('supabase-auth', 'fail', { http: null })); }
  return results;
}

export async function checkEdgeFunctions({ ref, token, fetcher }) {
  if (!token || !ref) return check('edge-functions', 'skip', { reason: 'SUPABASE_ACCESS_TOKEN ve/veya SUPABASE_PROJECT_REF yok; Edge fonksiyon listesi okunmadı (ATLANDI, başarı değil)' });
  if (!/^[a-z]{20}$/.test(ref)) return check('edge-functions', 'fail', { reason: 'invalid-project-ref' });
  try {
    const r = await fetcher(`https://api.supabase.com/v1/projects/${ref}/functions`, { headers: { authorization: `Bearer ${token}` }, signal: timeout() });
    if (r.status !== 200) { await r.body?.cancel(); return check('edge-functions', 'fail', { http: r.status }); }
    const list = await r.json();
    const functions = (Array.isArray(list) ? list : []).map(f => ({ name: f.slug ?? f.name, version: f.version ?? null, status: f.status ?? null, verify_jwt: f.verify_jwt ?? null })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const inactive = functions.filter(f => f.status && f.status !== 'ACTIVE').map(f => f.name);
    return check('edge-functions', inactive.length ? 'fail' : 'pass', { count: functions.length, inactive, functions });
  } catch { return check('edge-functions', 'fail', { http: null }); }
}

export async function checkTabletAlias({ origin, expectedBuild, fetcher }) {
  try {
    const r = await fetcher(`${origin}/release.json`, { redirect: 'manual', signal: timeout() });
    if (r.status !== 200) { await r.body?.cancel(); return check('tablet-alias', 'fail', { http: r.status }); }
    const live = await r.json();
    const detail = { http: 200, version: live.version ?? null, build: live.build ?? null, sourceCommit: live.sourceCommit ?? null, origin: live.origin ?? null };
    const ok = /^\d+$/.test(String(live.build ?? '')) && (!expectedBuild || String(live.build) === String(expectedBuild));
    return check('tablet-alias', ok ? 'pass' : 'fail', { ...detail, expectedBuild: expectedBuild ?? null });
  } catch { return check('tablet-alias', 'fail', { http: null }); }
}

export async function runHealthChecks({ env = {}, fetcher = fetch, origins = DEFAULT_ORIGINS, expectedTabletBuild = null, strict = false, now = () => new Date() } = {}) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const ref = env.SUPABASE_PROJECT_REF ?? (isPublicHttps(url) && /^[a-z]{20}\.supabase\.co$/.test(new URL(url).hostname) ? new URL(url).hostname.split('.')[0] : null);
  const checks = [];
  checks.push(await checkWebRoot({ origin: origins.web, fetcher }));
  try {
    const access = await checkBackofficeAccess({ project: env.CF_PAGES_PROJECT ?? 'gina-backoffice', team: env.CF_ACCESS_TEAM ?? 'gina-family', preview: env.CF_PREVIEW_ORIGIN, fetcher });
    checks.push(check('backoffice-access', access.ok ? 'pass' : 'fail', { probes: access.checks.length, unprotected: access.checks.filter(c => !c.protectedByAccess).map(c => new URL(c.url).pathname) }));
  } catch (e) { checks.push(check('backoffice-access', 'fail', { reason: e.message })); }
  if (url) checks.push(...await checkSupabase({ url, anonKey, fetcher }));
  else checks.push(check('supabase-rest', 'skip', { reason: 'EXPO_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL yok (ATLANDI)' }), check('supabase-auth', 'skip', { reason: 'Supabase URL yok (ATLANDI)' }));
  checks.push(await checkEdgeFunctions({ ref, token: env.SUPABASE_ACCESS_TOKEN, fetcher }));
  checks.push(await checkTabletAlias({ origin: origins.tablet, expectedBuild: expectedTabletBuild, fetcher }));
  const failed = checks.filter(c => c.status === 'fail').map(c => c.id);
  const skipped = checks.filter(c => c.status === 'skip').map(c => c.id);
  const ok = failed.length === 0 && (!strict || skipped.length === 0);
  return { checkedAt: now().toISOString(), ok, failed, skipped, note: 'Kişisel veri okunmadı; anon/public uçlar ve oturumsuz HTTP. Atlanan kontrol başarı sayılmaz.', checks };
}

export async function main(argv = process.argv.slice(2), processEnv = process.env) {
  try {
    const { values } = parseArgs({ args: argv, options: { 'env-file': { type: 'string' }, 'expected-tablet-build': { type: 'string' }, strict: { type: 'boolean', default: false }, pretty: { type: 'boolean', default: false }, help: { type: 'boolean', default: false } } });
    if (values.help) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); return 0; }
    if (values['expected-tablet-build'] && !/^\d+$/.test(values['expected-tablet-build'])) throw new Error('invalid-expected-tablet-build');
    let env = { ...processEnv };
    if (values['env-file']) {
      if (!existsSync(values['env-file'])) throw new Error('env-file-missing');
      env = { ...parseEnv(readFileSync(values['env-file'], 'utf8')), ...processEnv };
    }
    const report = await runHealthChecks({ env, expectedTabletBuild: values['expected-tablet-build'] ?? null, strict: values.strict });
    console.log(JSON.stringify(report, null, values.pretty ? 2 : 0));
    return report.ok ? 0 : 1;
  } catch (e) {
    console.error(`health-check: ${e.message}`); // yalnız kod; env değeri yazılmaz
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
