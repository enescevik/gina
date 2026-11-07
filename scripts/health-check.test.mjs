import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkEdgeFunctions, checkSupabase, checkTabletAlias, checkWebRoot, runHealthChecks } from './health-check.mjs';

const anon = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.sig';
const serviceRole = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.sig';
const webHeaders = { 'content-security-policy': "default-src 'self'; script-src 'self' 'sha256-abc'", 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin' };
const accessRedirect = url => new Response(null, { status: 302, headers: { location: `https://gina-family.cloudflareaccess.com/cdn-cgi/access/login/${new URL(url).hostname}?meta=do-not-log` } });

/** Sahte sunucu: tüm uçlar sağlıklı. */
function healthyFetcher(overrides = {}) {
  return async (url, options = {}) => {
    const u = new URL(url);
    if (overrides[u.origin + u.pathname]) return overrides[u.origin + u.pathname](u, options);
    if (u.origin === 'https://ginafamily.com') return new Response('<html>', { status: 200, headers: webHeaders });
    if (u.hostname.endsWith('gina-backoffice.pages.dev')) return accessRedirect(url);
    if (u.pathname === '/rest/v1/families') return new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: options.headers?.apikey ? 401 : 401 });
    if (u.pathname === '/auth/v1/health') return new Response(JSON.stringify({ version: 'v2.x', name: 'GoTrue', description: 'x' }), { status: 200 });
    if (u.hostname === 'api.supabase.com') return new Response(JSON.stringify([{ slug: 'push-send', version: 12, status: 'ACTIVE', verify_jwt: false }, { slug: 'delete-account', version: 14, status: 'ACTIVE', verify_jwt: true }]), { status: 200 });
    if (u.pathname === '/release.json') return new Response(JSON.stringify({ version: '0.1.0', build: '27', sourceCommit: 'a'.repeat(40), origin: 'local-eas-build', sha256: 'f'.repeat(64) }), { status: 200 });
    return new Response('nf', { status: 404 });
  };
}

test('tüm uçlar sağlıklıyken rapor ok, Edge listesi token varsa okunur, kişisel veri yok', async () => {
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_ACCESS_TOKEN: 'mgmt-secret-do-not-log' };
  const report = await runHealthChecks({ env, fetcher: healthyFetcher(), expectedTabletBuild: '27', now: () => new Date('2026-11-06T01:00:00Z') });
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.deepEqual(report.failed, []); assert.deepEqual(report.skipped, []);
  assert.deepEqual(report.checks.map(c => c.id), ['web-root', 'backoffice-access', 'supabase-rest', 'supabase-auth', 'edge-functions', 'tablet-alias']);
  const edge = report.checks.find(c => c.id === 'edge-functions');
  assert.equal(edge.count, 2); assert.deepEqual(edge.functions.map(f => f.name), ['delete-account', 'push-send']);
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /mgmt-secret-do-not-log|do-not-log|eyJ/);
});

test('token yokken Edge listesi açıkça ATLANDI; --strict ile başarısızlık sayılır', async () => {
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: anon };
  const report = await runHealthChecks({ env, fetcher: healthyFetcher() });
  assert.equal(report.ok, true); assert.deepEqual(report.skipped, ['edge-functions']);
  assert.match(report.checks.find(c => c.id === 'edge-functions').reason, /ATLANDI/);
  assert.equal((await runHealthChecks({ env, fetcher: healthyFetcher(), strict: true })).ok, false);
  const noUrl = await runHealthChecks({ env: {}, fetcher: healthyFetcher() });
  assert.deepEqual(noUrl.skipped, ['supabase-rest', 'supabase-auth', 'edge-functions']);
});

test('web kökü: eksik CSP/nosniff, unsafe-inline, çerez veya 5xx başarısızlıktır', async () => {
  const f = headers => async () => new Response('x', { status: 200, headers });
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: f(webHeaders) })).status, 'pass');
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: f({ ...webHeaders, 'x-content-type-options': 'none' }) })).status, 'fail');
  const { 'content-security-policy': _csp, ...noCsp } = webHeaders;
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: f(noCsp) })).status, 'fail');
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: f({ ...webHeaders, 'content-security-policy': "script-src 'self' 'unsafe-inline'" }) })).status, 'fail');
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: f({ ...webHeaders, 'set-cookie': 'sid=1' }) })).status, 'fail');
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: async () => new Response('x', { status: 503, headers: webHeaders }) })).status, 'fail');
  assert.equal((await checkWebRoot({ origin: 'https://ginafamily.com', fetcher: async () => { throw new Error('offline'); } })).status, 'fail');
});

test('Supabase: service_role anahtarı istek atılmadan reddedilir; yerel URL reddedilir; auth sürümü okunur', async () => {
  let requests = 0;
  const counting = async (...a) => { requests++; return healthyFetcher()(...a); };
  const secret = await checkSupabase({ url: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: serviceRole, fetcher: counting });
  assert.deepEqual(secret.map(c => c.status), ['fail', 'fail']); assert.equal(requests, 0);
  assert.equal(JSON.stringify(secret).includes(serviceRole.slice(0, 15)), false);
  assert.deepEqual((await checkSupabase({ url: 'http://127.0.0.1:54321', anonKey: anon, fetcher: counting })).map(c => c.status), ['fail', 'fail']);
  assert.equal(requests, 0);
  const good = await checkSupabase({ url: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: anon, fetcher: counting });
  assert.deepEqual(good.map(c => c.status), ['pass', 'pass']);
  assert.equal(good[1].version, 'v2.x');
  const down = await checkSupabase({ url: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: anon, fetcher: async () => new Response('', { status: 500 }) });
  assert.deepEqual(down.map(c => c.status), ['fail', 'fail']);
});

test('Edge: pasif fonksiyon ve yetkisiz yanıt başarısızlık; geçersiz ref istek atmaz', async () => {
  const inactive = await checkEdgeFunctions({ ref: 'abcdefghijklmnopqrst', token: 't', fetcher: async () => new Response(JSON.stringify([{ slug: 'push-send', status: 'REMOVED', version: 1 }]), { status: 200 }) });
  assert.equal(inactive.status, 'fail'); assert.deepEqual(inactive.inactive, ['push-send']);
  assert.equal((await checkEdgeFunctions({ ref: 'abcdefghijklmnopqrst', token: 't', fetcher: async () => new Response('', { status: 401 }) })).status, 'fail');
  assert.equal((await checkEdgeFunctions({ ref: '../x', token: 't', fetcher: async () => assert.fail('no request') })).status, 'fail');
  assert.equal((await checkEdgeFunctions({ ref: null, token: null, fetcher: async () => assert.fail('no request') })).status, 'skip');
});

test('tablet alias: beklenen build farkı, 404 ve geçersiz kayıt başarısızlık', async () => {
  const f = healthyFetcher();
  assert.equal((await checkTabletAlias({ origin: 'https://gina-aile-enescevik--tablet.expo.app', expectedBuild: '27', fetcher: f })).status, 'pass');
  assert.equal((await checkTabletAlias({ origin: 'https://gina-aile-enescevik--tablet.expo.app', expectedBuild: '28', fetcher: f })).status, 'fail');
  assert.equal((await checkTabletAlias({ origin: 'https://gina-aile-enescevik--tablet.expo.app', expectedBuild: null, fetcher: async () => new Response('nf', { status: 404 }) })).status, 'fail');
  assert.equal((await checkTabletAlias({ origin: 'https://x.expo.app', expectedBuild: null, fetcher: async () => new Response('{"build":"abc"}', { status: 200 }) })).status, 'fail');
});

test('backoffice ana adres 200 dönerse Access kontrolü başarısız ve rapor ok=false', async () => {
  const fetcher = healthyFetcher({ 'https://gina-backoffice.pages.dev/dashboard': () => new Response('public', { status: 200 }) });
  const report = await runHealthChecks({ env: { EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: anon }, fetcher });
  assert.equal(report.ok, false); assert.deepEqual(report.failed, ['backoffice-access']);
  assert.deepEqual(report.checks.find(c => c.id === 'backoffice-access').unprotected, ['/dashboard']);
});

test('CLI: geçersiz argüman 2 döner, env dosyası yoksa hata; sır yazılmaz', () => {
  const run = args => spawnSync(process.execPath, [fileURLToPath(new URL('./health-check.mjs', import.meta.url)), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } });
  const invalid = run(['--expected-tablet-build', 'x']);
  assert.equal(invalid.status, 2, invalid.stderr);
  const missing = run(['--env-file', '/nonexistent/.env.secret']);
  // Node 22 `--env-file` bayrağını script argümanı olsa da kendisi yakalar: dosya yoksa 9 ile düşer; dosya varsa env'e yükler ve script de okur.
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /env-file-missing|not found/);
  assert.doesNotMatch(missing.stdout, /checks/);
  assert.equal(run(['--help']).status, 0);
});
