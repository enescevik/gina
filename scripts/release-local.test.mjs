import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  APPLIED_MIGRATIONS_SQL, buildPlan, buildTabletInstallDir, compareLiveHashes, envPresence, extractDeploymentUrl,
  hashDirectory, loadReleaseEnv, migrationApplySql, streamIncludesLiteral, parseInfoPlistJson, parseMigrationFile, parseReleaseArgs,
  parseRemoteBuildNumber, pendingMigrations, servedPath, sourceState, supabaseProjectRef, verifyTabletDeployment, versionMapping,
} from './release-local.mjs';

const root = new URL('..', import.meta.url);
const sha = buf => createHash('sha256').update(buf).digest('hex');
const anon = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.sig';
const serviceRole = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.sig';
const app = JSON.parse(readFileSync(new URL('apps/mobile/app.json', root), 'utf8'));
const eas = JSON.parse(readFileSync(new URL('apps/mobile/eas.json', root), 'utf8'));

test('argümanlar: bilinmeyen komut, geçersiz hedef/build/sha/url reddedilir; dry-run varsayılan', () => {
  assert.equal(parseReleaseArgs(['web']).execute, false);
  assert.equal(parseReleaseArgs(['web', '--execute']).execute, true);
  assert.throws(() => parseReleaseArgs(['publish-everything']), /unknown-command/);
  assert.throws(() => parseReleaseArgs(['web', 'extra']), /too-many-positionals/);
  assert.throws(() => parseReleaseArgs(['verify', '--target', 'prod']), /invalid-target/);
  assert.throws(() => parseReleaseArgs(['verify', '--expected-build', '27a']), /invalid-expected-build/);
  assert.throws(() => parseReleaseArgs(['verify', '--expected-sha256', 'abc']), /invalid-expected-sha256/);
  assert.throws(() => parseReleaseArgs(['web', '--deployment-url', 'http://x.gina-web.pages.dev']), /invalid-deployment-url/);
  assert.throws(() => parseReleaseArgs(['web', '--deployment-url', 'https://evil.invalid']), /invalid-deployment-url/);
  assert.equal(parseReleaseArgs(['web', '--deployment-url', 'https://0d64fd42.gina-web.pages.dev'])['deployment-url'], 'https://0d64fd42.gina-web.pages.dev');
  assert.equal(parseReleaseArgs(['--help']).command, 'help');
});

test('env: dosya shell’in altında kalır, yoksa hata; varlık raporu değer içermez', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gina-release-env-'));
  try {
    writeFileSync(join(dir, '.env'), 'SUPABASE_ACCESS_TOKEN=file-secret-do-not-log\nEXPO_PUBLIC_SUPABASE_URL=https://aaaaaaaaaaaaaaaaaaaa.supabase.co\n');
    const env = loadReleaseEnv({ SUPABASE_ACCESS_TOKEN: 'shell-wins' }, join(dir, '.env'));
    assert.equal(env.SUPABASE_ACCESS_TOKEN, 'shell-wins');
    assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co');
    assert.throws(() => loadReleaseEnv({}, join(dir, 'missing.env')), /env-file-missing/);
    const presence = envPresence(env, ['SUPABASE_ACCESS_TOKEN', 'CLOUDFLARE_API_TOKEN']);
    assert.deepEqual(presence, { SUPABASE_ACCESS_TOKEN: true, CLOUDFLARE_API_TOKEN: false });
    assert.equal(JSON.stringify(presence).includes('shell-wins'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('proje ref: env’den veya public URL’den; service/yerel adresten türetilmez', () => {
  assert.equal(supabaseProjectRef({ SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst' }), 'abcdefghijklmnopqrst');
  assert.equal(supabaseProjectRef({ EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' }), 'abcdefghijklmnopqrst');
  assert.throws(() => supabaseProjectRef({ SUPABASE_PROJECT_REF: '../x' }), /invalid-project-ref/);
  assert.throws(() => supabaseProjectRef({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }), /project-ref-unresolved/);
});

test('kaynak durumu: commit/branch/kirli dosya sayısı; okunamayan commit reddedilir', () => {
  const run = (cmd, args) => ({ 'rev-parse HEAD': 'a'.repeat(40), 'rev-parse --abbrev-ref HEAD': 'main', 'status --porcelain': ' M a.txt\n?? b.txt' })[args.join(' ')];
  assert.deepEqual(sourceState(run), { commit: 'a'.repeat(40), branch: 'main', dirtyFiles: 2, clean: false });
  assert.throws(() => sourceState(() => 'not-a-commit'), /source-commit-unreadable/);
});

test('sürüm eşlemesi: mevcut app.json/eas.json geçer; remote dışı kaynak ve autoIncrement’li tablet engellenir', () => {
  const ok = versionMapping({ app, eas, remoteBuild: '27' });
  assert.equal(ok.ok, true);
  assert.equal(ok.findings.find(f => f.id === 'remote-build').status, 'pass');
  assert.equal(versionMapping({ app, eas }).findings.find(f => f.id === 'remote-build').status, 'pending');
  const bad = versionMapping({ app, eas: { ...eas, cli: { appVersionSource: 'local' }, build: { ...eas.build, tablet: { ...eas.build.tablet, autoIncrement: true } } } });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.findings.filter(f => f.status === 'block').map(f => f.id).sort(), ['tablet-profile', 'version-source']);
  assert.equal(parseRemoteBuildNumber('{"buildNumber":"27"}'), '27');
  assert.equal(parseRemoteBuildNumber('iOS buildNumber - 28'), '28');
  assert.throws(() => parseRemoteBuildNumber('error: not logged in'), /remote-build-unparsed/);
});

test('migration planı: bekleyen/yalnız uzak/sıra dışı; uygulama SQL’i tek işlem ve kayıt içerir', () => {
  const local = ['20261105180000_reward_history.sql', '20261105190000_note_history.sql', '20261106010000_m01.sql', 'README.md'].map(parseMigrationFile).filter(Boolean);
  assert.equal(local.length, 3);
  const diff = pendingMigrations(local, ['20261105180000', '20261105170000']);
  assert.deepEqual(diff.pending.map(m => m.version), ['20261105190000', '20261106010000']);
  assert.deepEqual(diff.remoteOnly, ['20261105170000']);
  assert.deepEqual(diff.outOfOrder, []);
  const out = pendingMigrations(local, ['20261106010000']);
  assert.deepEqual(out.outOfOrder, ['20261105180000', '20261105190000']);
  const sql = migrationApplySql({ version: '20261105190000', name: 'note_history', sql: 'create table t (id int);\nselect $gina_mig$x$gina_mig$;' });
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  assert.match(sql, /insert into supabase_migrations\.schema_migrations \(version, name, statements\)/);
  assert.match(sql, /\$gina_mig_\$create table/); // etiket çakışmasında uzatılır
  assert.throws(() => migrationApplySql({ version: '1', name: 'x', sql: '' }), /invalid-migration-identity/);
  assert.match(APPLIED_MIGRATIONS_SQL, /^select version, name from supabase_migrations/);
});

test('hash karşılaştırma: sahte sunucuyla eşleşme, fark, 404 ve yeniden deneme; index.html kök yoldan okunur', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gina-release-hash-'));
  try {
    mkdirSync(join(dir, '_expo/static/js'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html>a</html>');
    writeFileSync(join(dir, 'sign-in.html'), '<html>b</html>');
    writeFileSync(join(dir, '_expo/static/js/app.js'), 'console.log(1)');
    writeFileSync(join(dir, '_headers'), 'ignored');
    writeFileSync(join(dir, 'favicon.ico'), 'ignored');
    const files = hashDirectory(dir);
    assert.deepEqual(files.map(f => f.path), ['_expo/static/js/app.js', 'index.html', 'sign-in.html']);
    assert.equal(servedPath('index.html'), '/');
    assert.equal(servedPath('legal/index.html'), '/legal/');
    assert.equal(servedPath('_expo/static/js/app.js'), '/_expo/static/js/app.js');
    const live = { '/': '<html>a</html>', '/sign-in.html': '<html>b</html>', '/_expo/static/js/app.js': 'console.log(1)' };
    const requested = [];
    const fetcher = async url => { const u = new URL(url); requested.push(u.origin + u.pathname); const body = live[u.pathname]; return new Response(body ?? 'not found', { status: body ? 200 : 404 }); };
    const ok = await compareLiveHashes({ files, origins: ['https://gina-web.pages.dev', 'https://abc123.gina-web.pages.dev'], fetcher, delayMs: 0 });
    assert.equal(ok.ok, true); assert.equal(ok.total, 6); assert.equal(ok.matched, 6);
    assert.ok(requested.includes('https://gina-web.pages.dev/') && requested.includes('https://abc123.gina-web.pages.dev/_expo/static/js/app.js'));
    let calls = 0;
    const stale = await compareLiveHashes({ files, origins: ['https://gina-web.pages.dev'], attempts: 2, delayMs: 0, fetcher: async url => { calls++; const u = new URL(url); return new Response(u.pathname === '/' ? '<html>OLD</html>' : live[u.pathname] ?? 'x', { status: live[u.pathname] ? 200 : 404 }); } });
    assert.equal(stale.ok, false); assert.equal(stale.matched, 2);
    assert.deepEqual(stale.mismatched.map(m => m.path), ['index.html']);
    assert.equal(calls, 4); // eşleşmeyen dosya iki kez denendi
    const offline = await compareLiveHashes({ files, origins: ['https://gina-web.pages.dev'], attempts: 1, fetcher: async () => { throw new Error('offline'); } });
    assert.equal(offline.ok, false); assert.equal(offline.matched, 0);
    assert.throws(() => hashDirectory(join(dir, 'missing')), /dist-missing/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('wrangler çıktısından dağıtım URL’si yalnız projenin pages.dev alt alanıdır', () => {
  assert.equal(extractDeploymentUrl('✨ Deployment complete! Take a peek over at https://0d64fd42.gina-web.pages.dev\n', 'gina-web'), 'https://0d64fd42.gina-web.pages.dev');
  assert.throws(() => extractDeploymentUrl('https://0d64fd42.gina-backoffice.pages.dev', 'gina-web'), /deployment-url-not-found/);
  assert.throws(() => extractDeploymentUrl('https://evil.invalid/gina-web.pages.dev', 'gina-web'), /deployment-url-not-found/);
});

test('tablet kurulum klasörü ve canlı doğrulama: manifest/IPA/release.json/sayfa; eski sürüme dönüş reddedilir', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gina-release-tablet-'));
  try {
    const ipa = join(dir, 'in.ipa'); writeFileSync(ipa, Buffer.from('fake ipa bytes for test'));
    const icon = join(dir, 'icon.png'); writeFileSync(icon, Buffer.from('png'));
    const out = join(dir, 'out');
    const base = { ipaPath: ipa, iconPath: icon, outDir: out, version: '0.1.0', build: '28', sourceCommit: 'b'.repeat(40) };
    assert.throws(() => buildTabletInstallDir({ ...base, previousRelease: { build: '29' } }), /refusing-older-tablet-release/);
    assert.throws(() => buildTabletInstallDir({ ...base, build: 'x' }), /invalid-tablet-release-identity/);
    assert.throws(() => buildTabletInstallDir({ ...base, baseUrl: 'http://localhost:8081' }), /invalid-tablet-base-url/);
    const record = buildTabletInstallDir({ ...base, previousRelease: { build: '27', sha256: 'c'.repeat(64) } });
    assert.equal(record.sha256, sha(Buffer.from('fake ipa bytes for test')));
    assert.equal(record.ipaName, 'gina-28.ipa');
    const release = JSON.parse(readFileSync(join(out, 'release.json'), 'utf8'));
    assert.equal(release.build, '28'); assert.equal(release.origin, 'local-eas-build');
    assert.match(release.installUrl, /^itms-services:\/\/\?action=download-manifest&url=https%3A%2F%2Fgina-aile-enescevik--tablet\.expo\.app%2Fmanifest-28\.plist$/);
    const manifest = readFileSync(join(out, 'manifest-28.plist'), 'utf8');
    assert.ok(manifest.includes('<string>com.enescevik.gina</string>') && manifest.includes('https://gina-aile-enescevik--tablet.expo.app/gina-28.ipa'));
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.ok(html.includes('0.1.0 (28)') && html.includes('manifest-28.plist') && html.includes('noindex'));
    assert.equal(JSON.parse(readFileSync(join(out, 'previous-release.json'), 'utf8')).build, '27');
    const served = { '/release.json': readFileSync(join(out, 'release.json')), '/manifest-28.plist': manifest, '/gina-28.ipa': readFileSync(ipa), '/': html };
    const fetcher = async (url, opts) => { assert.equal(opts.redirect, 'manual'); const body = served[new URL(url).pathname]; return new Response(body ?? 'nf', { status: body ? 200 : 404 }); };
    const good = await verifyTabletDeployment({ origin: 'https://gina-aile-enescevik--tablet.expo.app', expected: record, fetcher });
    assert.equal(good.ok, true, JSON.stringify(good));
    const tampered = await verifyTabletDeployment({ origin: 'https://gina-aile-enescevik--abc.expo.app', expected: record, fetcher: async url => new Response(new URL(url).pathname === '/gina-28.ipa' ? 'other bytes' : served[new URL(url).pathname] ?? 'nf', { status: 200 }) });
    assert.equal(tampered.ok, false);
    assert.equal(tampered.checks.find(c => c.id === 'ipa-hash').ok, false);
    const old = await verifyTabletDeployment({ origin: 'https://gina-aile-enescevik--tablet.expo.app', expected: { ...record, build: '29' }, fetcher });
    assert.equal(old.ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Info.plist: bundle farkı ve sürüm biçimi reddedilir', () => {
  assert.deepEqual(parseInfoPlistJson({ CFBundleIdentifier: 'com.enescevik.gina', CFBundleShortVersionString: '0.1.0', CFBundleVersion: '27', UIDeviceFamily: [1, 2] }), { bundleId: 'com.enescevik.gina', version: '0.1.0', build: '27', deviceFamilies: [1, 2] });
  assert.throws(() => parseInfoPlistJson({ CFBundleIdentifier: 'com.other', CFBundleShortVersionString: '0.1.0', CFBundleVersion: '27' }), /ipa-bundle-mismatch/);
  assert.throws(() => parseInfoPlistJson('{"CFBundleIdentifier":"com.enescevik.gina","CFBundleShortVersionString":"0.1","CFBundleVersion":"27"}'), /ipa-version-unreadable/);
});

test('plan: her komut kaynak kontrolüyle başlar, shell argv’leri secret taşımaz, tablet alias --prod içermez', () => {
  const ctx = { source: { commit: 'a'.repeat(40), branch: 'main', dirtyFiles: 0, clean: true }, ipa: '/tmp/x.ipa', installDir: '/tmp/out', installDirRel: '../../out', localMigrations: [], target: 'all', expectedBuild: null };
  for (const command of ['migrations:plan', 'migrations:apply', 'web', 'backoffice', 'ios:build', 'ios:submit', 'tablet:build', 'tablet:publish']) {
    const steps = buildPlan(command, ctx);
    assert.equal(steps[0].id, 'source', command);
    for (const s of steps) if (s.argv) assert.doesNotMatch(s.argv.join(' '), /eyJ|sb_secret|Bearer/, `${command}/${s.id}`);
  }
  const tablet = buildPlan('tablet:publish', ctx);
  assert.ok(tablet.every(s => !(s.argv ?? []).includes('--prod')));
  assert.ok(tablet.some(s => s.id === 'verify-preview') && tablet.findIndex(s => s.id === 'verify-preview') < tablet.findIndex(s => s.id === 'alias'));
  const bo = buildPlan('backoffice', ctx).map(s => s.id);
  assert.ok(bo.indexOf('access-pre') < bo.indexOf('deploy') && bo.indexOf('deploy') < bo.indexOf('live-hash') && bo.indexOf('live-hash') < bo.indexOf('access-post'));
  assert.deepEqual(buildPlan('verify', { ...ctx, target: 'tablet' }).map(s => s.id), ['verify-tablet']);
  assert.throws(() => buildPlan('nope', ctx), /unknown-command/);
});

test('CLI dry-run: komut çalıştırmaz, env değerini yazmaz, service_role’ü --execute’ta reddeder', () => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: anon, CLOUDFLARE_API_TOKEN: 'cf-secret-do-not-log' };
  const run = (args, extra = {}) => spawnSync(process.execPath, ['scripts/release-local.mjs', ...args], { cwd: root, encoding: 'utf8', env: { ...env, ...extra } });
  const dry = run(['web', '--allow-dirty']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /DRY-RUN/);
  assert.match(dry.stdout, /wrangler pages deploy apps\/mobile\/dist --project-name=gina-web/);
  assert.match(dry.stdout, /CLOUDFLARE_API_TOKEN=var/);
  assert.doesNotMatch(dry.stdout + dry.stderr, /cf-secret-do-not-log|abcdefghijklmnopqrst/);
  const json = run(['ios:build', '--allow-dirty', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.dryRun, true);
  assert.ok(parsed.steps.some(s => s.argv?.includes('--local')));
  const secret = run(['web', '--execute'], { EXPO_PUBLIC_SUPABASE_ANON_KEY: serviceRole });
  assert.notEqual(secret.status, 0);
  assert.match(secret.stderr, /public key required/);
  assert.doesNotMatch(secret.stderr, new RegExp(serviceRole.slice(0, 20)));
  const bad = run(['publish-all']);
  assert.equal(bad.status, 2);
});

test('IPA endpoint scan treats dots as literal and matches across chunk boundaries', async () => {
  const chunks = async function* (...parts) { for (const part of parts) yield Buffer.from(part); };
  assert.equal(await streamIncludesLiteral(chunks('https://project.', 'supabase.co'), 'project.supabase.co'), true);
  assert.equal(await streamIncludesLiteral(chunks('https://projectXsupabaseYco'), 'project.supabase.co'), false);
  assert.equal(await streamIncludesLiteral(chunks('payload'), ''), false);
});
